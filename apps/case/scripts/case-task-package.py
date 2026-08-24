#!/usr/bin/env python3
"""Safely inspect source ZIPs and build deterministic task packages.

This utility treats every archive entry as untrusted data. It never imports or
executes delivered code. The output package contains the selected task
directory's contents at its root and preserves only the executable permission
bit needed by task entrypoints.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import tarfile
import tempfile
import zipfile


TOOL_NAME = "case-task-package"
TOOL_VERSION = "1.0.1"
DEFAULT_MAX_ENTRIES = 20_000
DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024 * 1024
DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024
DEFAULT_MAX_DEPTH = 40
DEFAULT_MAX_RATIO = 1_000
COPY_CHUNK_BYTES = 1024 * 1024


class UnsafeArchiveError(RuntimeError):
    pass


def safe_zip_entries(
    archive: zipfile.ZipFile,
    *,
    max_entries: int,
    max_total_bytes: int,
    max_file_bytes: int,
    max_depth: int,
    max_ratio: int,
) -> tuple[list[tuple[zipfile.ZipInfo, PurePosixPath]], int]:
    infos = archive.infolist()
    if len(infos) > max_entries:
        raise UnsafeArchiveError(f"archive has {len(infos)} entries; limit is {max_entries}")

    seen: set[str] = set()
    entries: list[tuple[zipfile.ZipInfo, PurePosixPath]] = []
    total_bytes = 0
    for info in infos:
        name = decoded_zip_name(info)
        if not name or "\\" in name or "\x00" in name:
            raise UnsafeArchiveError(f"unsafe ZIP entry name: {name!r}")
        path = PurePosixPath(name)
        if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
            raise UnsafeArchiveError(f"unsafe ZIP entry path: {name!r}")
        if len(path.parts) > max_depth:
            raise UnsafeArchiveError(f"ZIP entry exceeds depth limit: {name!r}")
        normalized = path.as_posix().rstrip("/")
        if normalized in seen:
            raise UnsafeArchiveError(f"duplicate ZIP entry path: {name!r}")
        seen.add(normalized)
        if info.flag_bits & 0x1:
            raise UnsafeArchiveError(f"encrypted ZIP entry is unsupported: {name!r}")
        if info.file_size < 0 or info.compress_size < 0:
            raise UnsafeArchiveError(f"ZIP entry has invalid size: {name!r}")
        if info.file_size > max_file_bytes:
            raise UnsafeArchiveError(f"ZIP entry exceeds file-size limit: {name!r}")
        total_bytes += info.file_size
        if total_bytes > max_total_bytes:
            raise UnsafeArchiveError(f"archive exceeds total uncompressed-size limit: {total_bytes}")
        if info.file_size and info.compress_size == 0:
            raise UnsafeArchiveError(f"ZIP entry has an invalid compression ratio: {name!r}")
        if info.compress_size and info.file_size / info.compress_size > max_ratio:
            raise UnsafeArchiveError(f"ZIP entry exceeds compression-ratio limit: {name!r}")

        mode = (info.external_attr >> 16) & 0xFFFF
        file_type = stat.S_IFMT(mode)
        is_directory = info.is_dir() or name.endswith("/")
        if file_type not in {0, stat.S_IFREG, stat.S_IFDIR}:
            raise UnsafeArchiveError(f"ZIP entry is a link, device, or special file: {name!r}")
        if is_directory and file_type == stat.S_IFREG:
            raise UnsafeArchiveError(f"ZIP directory has a regular-file mode: {name!r}")
        if not is_directory and file_type == stat.S_IFDIR:
            raise UnsafeArchiveError(f"ZIP file has a directory mode: {name!r}")
        entries.append((info, path))
    return entries, total_bytes


def decoded_zip_name(info: zipfile.ZipInfo) -> str:
    name = info.filename
    if info.flag_bits & 0x800:
        return name
    try:
        candidate = name.encode("cp437").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name
    return candidate if candidate != name and contains_cjk(candidate) else name


def contains_cjk(value: str) -> bool:
    return any(
        "\u3040" <= character <= "\u30ff"
        or "\u3400" <= character <= "\u9fff"
        or "\uf900" <= character <= "\ufaff"
        or "\uac00" <= character <= "\ud7af"
        for character in value
    )


def inspect_zip(path: Path, limits: argparse.Namespace) -> dict[str, object]:
    with zipfile.ZipFile(path) as archive:
        entries, total_bytes = safe_zip_entries(archive, **limit_kwargs(limits))
        return {
            "tool": TOOL_NAME,
            "toolVersion": TOOL_VERSION,
            "archive": str(path.resolve()),
            "archiveSha256": sha256_file(path),
            "archiveSizeBytes": path.stat().st_size,
            "entryCount": len(entries),
            "uncompressedSizeBytes": total_bytes,
            "safe": True,
        }


def extract_zip(path: Path, destination: Path, limits: argparse.Namespace) -> dict[str, object]:
    if destination.exists() and any(destination.iterdir()):
        raise UnsafeArchiveError(f"extraction destination is not empty: {destination}")
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    extracted_bytes = 0
    extracted_files = 0
    try:
        with zipfile.ZipFile(path) as archive:
            entries, declared_total = safe_zip_entries(archive, **limit_kwargs(limits))
            for info, relative in entries:
                target = destination.joinpath(*relative.parts)
                resolved_parent = target.parent.resolve()
                if resolved_parent != root and root not in resolved_parent.parents:
                    raise UnsafeArchiveError(f"ZIP entry escapes extraction root: {info.filename!r}")
                if info.is_dir() or info.filename.endswith("/"):
                    target.mkdir(parents=True, exist_ok=True)
                    target.chmod(0o755)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                mode = (info.external_attr >> 16) & 0xFFFF
                output_mode = 0o755 if mode & 0o111 else 0o644
                flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
                if hasattr(os, "O_NOFOLLOW"):
                    flags |= os.O_NOFOLLOW
                descriptor = os.open(target, flags, output_mode)
                written = 0
                try:
                    with archive.open(info, "r") as source, os.fdopen(descriptor, "wb") as output:
                        descriptor = -1
                        while chunk := source.read(COPY_CHUNK_BYTES):
                            written += len(chunk)
                            extracted_bytes += len(chunk)
                            if written > info.file_size or extracted_bytes > limits.max_total_bytes:
                                raise UnsafeArchiveError(f"ZIP entry exceeded declared or configured size: {info.filename!r}")
                            output.write(chunk)
                finally:
                    if descriptor >= 0:
                        os.close(descriptor)
                if written != info.file_size:
                    raise UnsafeArchiveError(f"ZIP entry size changed during extraction: {info.filename!r}")
                target.chmod(output_mode)
                extracted_files += 1
        if extracted_bytes != declared_total:
            raise UnsafeArchiveError("extracted byte count does not match the inspected archive")
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        raise
    return {
        "tool": TOOL_NAME,
        "toolVersion": TOOL_VERSION,
        "archiveSha256": sha256_file(path),
        "destination": str(destination.resolve()),
        "fileCount": extracted_files,
        "extractedSizeBytes": extracted_bytes,
        "safe": True,
    }


def package_directory(source: Path, output: Path, limits: argparse.Namespace) -> dict[str, object]:
    source = source.resolve()
    if not source.is_dir():
        raise UnsafeArchiveError(f"task source is not a directory: {source}")
    entries = sorted(source.rglob("*"), key=lambda value: value.relative_to(source).as_posix())
    if len(entries) > limits.max_entries:
        raise UnsafeArchiveError(f"task has {len(entries)} entries; limit is {limits.max_entries}")
    total_bytes = 0
    file_count = 0
    for path in entries:
        details = path.lstat()
        if stat.S_ISLNK(details.st_mode) or not (stat.S_ISREG(details.st_mode) or stat.S_ISDIR(details.st_mode)):
            raise UnsafeArchiveError(f"task contains a link, device, or special file: {path}")
        if stat.S_ISREG(details.st_mode):
            if details.st_size > limits.max_file_bytes:
                raise UnsafeArchiveError(f"task file exceeds file-size limit: {path}")
            total_bytes += details.st_size
            file_count += 1
            if total_bytes > limits.max_total_bytes:
                raise UnsafeArchiveError(f"task exceeds total size limit: {total_bytes}")

    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise UnsafeArchiveError(f"output already exists: {output}")
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{output.name}.", dir=output.parent)
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        with temporary.open("wb") as raw:
            with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
                    for path in entries:
                        relative = path.relative_to(source).as_posix()
                        details = path.lstat()
                        info = tarfile.TarInfo(relative)
                        info.uid = 0
                        info.gid = 0
                        info.uname = ""
                        info.gname = ""
                        info.mtime = 0
                        if stat.S_ISDIR(details.st_mode):
                            info.type = tarfile.DIRTYPE
                            info.mode = 0o755
                            info.size = 0
                            archive.addfile(info)
                        else:
                            info.type = tarfile.REGTYPE
                            info.mode = 0o755 if details.st_mode & 0o111 else 0o644
                            info.size = details.st_size
                            with path.open("rb") as content:
                                archive.addfile(info, content)
        temporary.replace(output)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return {
        "tool": TOOL_NAME,
        "toolVersion": TOOL_VERSION,
        "source": str(source),
        "output": str(output.resolve()),
        "contentSha256": sha256_file(output),
        "sizeBytes": output.stat().st_size,
        "fileCount": file_count,
        "uncompressedSizeBytes": total_bytes,
        "archiveFormat": "tar+gzip",
        "archiveRoot": "task_contents",
    }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(COPY_CHUNK_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


def limit_kwargs(arguments: argparse.Namespace) -> dict[str, int]:
    return {
        "max_entries": arguments.max_entries,
        "max_total_bytes": arguments.max_total_bytes,
        "max_file_bytes": arguments.max_file_bytes,
        "max_depth": arguments.max_depth,
        "max_ratio": arguments.max_ratio,
    }


def add_limits(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--max-entries", type=int, default=DEFAULT_MAX_ENTRIES)
    parser.add_argument("--max-total-bytes", type=int, default=DEFAULT_MAX_TOTAL_BYTES)
    parser.add_argument("--max-file-bytes", type=int, default=DEFAULT_MAX_FILE_BYTES)
    parser.add_argument("--max-depth", type=int, default=DEFAULT_MAX_DEPTH)
    parser.add_argument("--max-ratio", type=int, default=DEFAULT_MAX_RATIO)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog=TOOL_NAME)
    commands = root.add_subparsers(dest="command", required=True)
    inspect = commands.add_parser("inspect-zip")
    inspect.add_argument("archive", type=Path)
    add_limits(inspect)
    extract = commands.add_parser("extract-zip")
    extract.add_argument("archive", type=Path)
    extract.add_argument("destination", type=Path)
    add_limits(extract)
    package = commands.add_parser("package-dir")
    package.add_argument("source", type=Path)
    package.add_argument("output", type=Path)
    add_limits(package)
    return root


def main() -> None:
    arguments = parser().parse_args()
    try:
        if arguments.command == "inspect-zip":
            result = inspect_zip(arguments.archive, arguments)
        elif arguments.command == "extract-zip":
            result = extract_zip(arguments.archive, arguments.destination, arguments)
        else:
            result = package_directory(arguments.source, arguments.output, arguments)
        print(json.dumps(result, sort_keys=True))
    except (UnsafeArchiveError, zipfile.BadZipFile, OSError) as error:
        print(json.dumps({"safe": False, "error": str(error)}, sort_keys=True))
        raise SystemExit(2) from error


if __name__ == "__main__":
    main()
