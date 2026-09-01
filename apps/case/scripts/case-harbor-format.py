#!/usr/bin/env python3

import importlib.metadata
import json
import sys
from pathlib import Path


def emit(value: dict[str, object]) -> None:
    print(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def harbor_version() -> str:
    try:
        return importlib.metadata.version("harbor")
    except importlib.metadata.PackageNotFoundError:
        return "unknown"


def main() -> int:
    version = harbor_version()
    try:
        from harbor.models.task.task import Task
    except Exception as error:
        emit({"error": f"Unable to import Harbor's task validator: {type(error).__name__}: {error}"})
        return 2

    if sys.argv[1:] == ["--version"]:
        emit({"harborVersion": version})
        return 0
    if len(sys.argv) != 2:
        emit({"error": "Usage: case-harbor-format.py <task-directory>"})
        return 2

    task_root = Path(sys.argv[1]).resolve()
    if not (task_root / "task.toml").is_file():
        emit({"valid": False, "harborVersion": version, "reason": "task.toml is missing from the task root"})
        return 0
    if not (task_root / "environment").is_dir():
        emit({"valid": False, "harborVersion": version, "reason": "environment/ is missing from the task root"})
        return 0

    try:
        valid = Task.is_valid_dir(task_root)
    except Exception as error:
        emit({
            "valid": False,
            "harborVersion": version,
            "reason": f"{type(error).__name__}: {error}",
        })
        return 0

    emit({
        "valid": valid,
        "harborVersion": version,
        "reason": None if valid else "Harbor Task.is_valid_dir returned false",
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
