#!/usr/bin/env python3
"""Verified CASE submission archives -> TARS JFS -> shared JFS. No evaluation calls.

Python standard library only. See README.md for installation, recovery and bounds.
"""
import argparse
import base64
import contextlib
import concurrent.futures
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

SCHEMA = 'case.submission-harbor-archive.v1'
INDEX_SCHEMA = 'case.submission-harbor-archive-index.v1'
VOLUME = 'jfs-dialogue-alishprod01'
REGION = 'ali-shanghai-prod-01'
JFS = Path('/' + VOLUME)
STAGING = JFS / 'data/users/TARS/harbor-task-archives'
SHARED = JFS / 'alignment_data_forge/rl_tasks/harbor-task-archives'
RAW = JFS / 'data/users/TARS/harbor-tasks'
RAW_SHARED = JFS / 'alignment_data_forge/rl_tasks/harbor-tasks'
RAW_STATE = Path('/home/TARS/.local/state/harbor-tasks-mirror')
STATE = Path('/home/TARS/.local/state/harbor-task-archives')
CONFIG = Path('/home/TARS/.config/harbor-task-archives/config.json')
EVE_CONFIG = Path('/home/TARS/.config/harbor-tasks-mirror/eve.json')
EVE_API = 'https://transfer.xaminim.com/api/v1'
SHA = re.compile(r'^[a-f0-9]{64}$')
CHUNK_BYTES = 16 * 1024 * 1024


def now():
    return time.strftime('%Y-%m-%dT%H:%M:%S%z')


def log(event, **fields):
    print(json.dumps(dict(time=now(), event=event, **fields), ensure_ascii=False), flush=True)


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()


def atomic(path, value, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp-' + uuid.uuid4().hex)
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(value if isinstance(value, bytes) else json_bytes(value))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
        fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        if tmp.exists():
            tmp.unlink()


def read(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def check_deadline(deadline=None):
    if deadline is not None and time.monotonic() >= deadline:
        raise TimeoutError('Run budget reached; progress retained for next run')


def stream_hash(stream, deadline=None):
    digest = hashlib.sha256()
    while True:
        check_deadline(deadline)
        chunk = stream.read(4 * 1024 * 1024)
        if not chunk:
            return digest.hexdigest()
        digest.update(chunk)


def file_hash(path, deadline=None):
    if not stat.S_ISREG(path.lstat().st_mode):
        raise ValueError('Expected a regular file')
    with path.open('rb') as stream:
        return stream_hash(stream, deadline)


def component(value):
    if not isinstance(value, str) or not value or len(value) > 200 or value in ('.', '..') or re.search(r'[\x00-\x1f\x7f/\\]', value):
        raise ValueError('Unsafe or missing path component')
    return value


def safe_path(root, value):
    if not isinstance(value, str):
        raise ValueError('Expected a relative path')
    parts = value.split('/')
    for part in parts:
        component(part)
    path = root
    if root.is_symlink():
        raise ValueError('Root is a symlink')
    for part in parts:
        path = path / part
        if path.is_symlink():
            raise ValueError('Symlink in managed path')
    return path


def task_name(source_path):
    parts = [part for part in (source_path or '').replace('\\', '/').split('/') if part and part != '.']
    if not parts:
        raise ValueError('Harbor task has no source path')
    return component((parts[-2] if len(parts) > 1 and parts[-1].lower() in ('task', 'payload') else parts[-1]).strip())


def artifact_sha(task, submission):
    value = task.get('contentSha256')
    if value and SHA.fullmatch(value):
        return value
    # Follow CASE's exporter: prefer a linked archive named after the task,
    # otherwise accept only one unambiguous immutable source artifact.
    items = {item['id']: item for event in submission.get('sourceEvents', []) for item in event.get('items', [])}
    linked = [items[i] for i in task.get('sourceItemIds', []) if i in items and items[i].get('artifactId')]
    if task.get('artifactId'):
        linked = [item for item in linked if item['artifactId'] == task['artifactId']]
    else:
        named = [item for item in linked if re.sub(r'(?i)(\.tar\.gz|\.tgz|\.zip|\.tar|\.gz)$', '', item.get('displayName', '')).lower() == task_name(task.get('sourcePath')).lower()]
        if named:
            linked = named
    candidates = {item.get('contentSha256') for item in linked}
    if len(candidates) == 1:
        value = next(iter(candidates))
        if isinstance(value, str) and SHA.fullmatch(value):
            return value
    raise ValueError('Task lacks an unambiguous immutable artifact checksum: ' + task['id'])


def requests_from_catalog(catalog):
    requests = []
    for vendor in catalog['vendors']:
        for submission in vendor['submissions']:
            tasks = [{'taskVersionId': component(task['id']), 'name': task_name(task.get('sourcePath')),
                      'artifactSha256': artifact_sha(task, submission)} for task in submission.get('tasks', []) if task.get('format') == 'harbor' and task.get('kind') == 'task']
            if not tasks:
                continue
            if len(tasks) > 1000 or len({t['name'] for t in tasks}) != len(tasks) or len({t['taskVersionId'] for t in tasks}) != len(tasks):
                raise ValueError('Duplicate or excessive tasks in submission')
            # Key order and UTF-8 serialization match normalizeSubmissionRequest.
            requests.append({'schemaVersion': SCHEMA, 'vendorId': component(vendor['id'].strip()),
                             'storageVendorId': component((vendor.get('harborStorageId') or vendor['id']).strip()),
                             'submissionId': component(submission['id'].strip()),
                             'tasks': sorted(tasks, key=lambda task: task['name'].encode('utf-16-be'))})
    identities = [(r['vendorId'], r['submissionId']) for r in requests]
    if not requests or len(set(identities)) != len(identities):
        raise ValueError('Empty or duplicate Harbor submission catalog; refusing replacement')
    return sorted(requests, key=lambda r: (r['vendorId'], r['submissionId']))


def revision(request):
    return hashlib.sha256(json.dumps(request, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def archive_path(request):
    return request['vendorId'] + '/' + request['submissionId'] + '/' + revision(request) + '.zip'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('Unexpected redirect from authenticated API')


OPENER = urllib.request.build_opener(NoRedirect)


def api(method, url, auth, payload=None, query=None):
    if query:
        url += '?' + urllib.parse.urlencode(query)
    req = urllib.request.Request(url, method=method, data=json_bytes(payload) if payload is not None else None,
                                 headers={'Authorization': auth, 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip'})
    try:
        with OPENER.open(req, timeout=45) as response:
            if response.headers.get('Content-Encoding') == 'gzip':
                with gzip.GzipFile(fileobj=response) as stream:
                    return json.load(stream)
            return json.load(response)
    except urllib.error.HTTPError as exc:
        # Gateway build failures are structured and do not contain credentials.
        if exc.code == 409 and url.endswith('/submission-archives'):
            data = json.load(exc)
            if data.get('status') == 'failed':
                return data
        raise RuntimeError('API HTTP ' + str(exc.code)) from None
    except (urllib.error.URLError, OSError):
        raise RuntimeError('API transport failed; operation state retained') from None


def private_config(path):
    if not stat.S_ISREG(path.lstat().st_mode) or path.stat().st_mode & 0o077:
        raise ValueError('Credentials must be a private regular file')
    return read(path)


class Eve:
    def __init__(self):
        value = private_config(EVE_CONFIG)
        self.auth = 'Basic ' + base64.b64encode((value['access_key'] + ':' + value['secret_key']).encode()).decode()

    def call(self, method, path, payload=None, query=None):
        value = api(method, EVE_API + path, self.auth, payload, query)
        if value.get('code') != 200:
            raise RuntimeError('EVE application error ' + str(value.get('code')))
        return value['data']


@contextlib.contextmanager
def lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def verify_archive(path, receipt, request, raw=None, deadline=None):
    if path.stat().st_size != receipt['sizeBytes'] or file_hash(path, deadline) != receipt['sha256']:
        raise ValueError('Archive length or checksum mismatch')
    with zipfile.ZipFile(path) as archive:
        info = archive.infolist()
        names = [item.filename for item in info]
        if len(names) != len(set(names)) or 'manifest.json' not in names:
            raise ValueError('Duplicate files or missing archive manifest')
        if archive.getinfo('manifest.json').file_size > 128 * 1024 * 1024:
            raise ValueError('Archive manifest too large')
        manifest_bytes = archive.read('manifest.json')
        if hashlib.sha256(manifest_bytes).hexdigest() != receipt['manifestSha256']:
            raise ValueError('Manifest checksum mismatch')
        manifest = json.loads(manifest_bytes)
        if any(manifest.get(key) != value for key, value in request.items()) or manifest.get('revision') != revision(request):
            raise ValueError('Manifest does not match exact CASE task versions')
        files = manifest['files']
        paths = [item['path'] for item in files]
        if len(set(paths)) != len(paths) or set(names) != set(paths) | {'manifest.json'}:
            raise ValueError('Archive entries differ from manifest')
        if receipt['fileCount'] != len(files) or receipt['taskCount'] != len(request['tasks']):
            raise ValueError('Receipt counts differ from manifest')
        task_names = {task['name'] for task in request['tasks']}
        if not {name + '/task.toml' for name in task_names}.issubset(paths):
            raise ValueError('Missing task completion marker')
        raw_prefix = request['storageVendorId'] + '/' + request['submissionId'] + '/'
        for item in files:
            check_deadline(deadline)
            if item['path'].split('/')[0] not in task_names or item['sourceKey'] != raw_prefix + item['path']:
                raise ValueError('Manifest source path mismatch')
            safe_path(Path('/unused'), item['path'])
            entry = archive.getinfo(item['path'])
            mode = (entry.external_attr >> 16)
            if entry.is_dir() or stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0, stat.S_IFREG)):
                raise ValueError('Archive contains a link or special file')
            if entry.file_size != item['sizeBytes'] or mode & 0o777 != int(item['mode'], 8):
                raise ValueError('Archive file size or mode mismatch')
            with archive.open(entry) as stream:
                if stream_hash(stream, deadline) != item['sha256']:
                    raise ValueError('Archive member checksum mismatch')
            if raw is not None:
                source = safe_path(raw, item['sourceKey'])
                if source.stat().st_size != item['sizeBytes'] or file_hash(source, deadline) != item['sha256']:
                    raise ValueError('Archive differs from the completed raw JFS mirror')
        if raw is not None:
            actual = set()
            for name in task_names:
                root = safe_path(raw, raw_prefix + name)
                for directory, dirs, filenames in os.walk(root, followlinks=False):
                    for filename in dirs + filenames:
                        candidate = Path(directory) / filename
                        if candidate.is_symlink():
                            raise ValueError('Symlink in raw mirror')
                    actual.update((Path(directory) / filename).relative_to(raw / raw_prefix).as_posix() for filename in filenames)
            if actual != set(paths):
                raise ValueError('Raw mirror inventory differs from archive')
    return len(files)


def download(config, receipt, request, deadline):
    if receipt['sizeBytes'] > 2 * CHUNK_BYTES:
        return download_ranges(config, receipt, request, deadline)
    path = safe_path(STAGING, archive_path(request))
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix('.part')
    size = part.stat().st_size if part.exists() else 0
    if size > receipt['sizeBytes']:
        part.unlink()
        size = 0
    if size != receipt['sizeBytes']:
        req = urllib.request.Request(config['gateway_url'] + '/submission-archives/' + revision(request) + '.zip',
            headers={'Authorization': 'Bearer ' + config['gateway_token'], **({'Range': 'bytes=' + str(size) + '-'} if size else {})})
        try:
            with OPENER.open(req, timeout=45) as response:
                expected_range = 'bytes ' + str(size) + '-' + str(receipt['sizeBytes'] - 1) + '/' + str(receipt['sizeBytes'])
                if (size and (response.status != 206 or response.headers.get('Content-Range') != expected_range)) or response.headers.get('X-Content-SHA256') != receipt['sha256']:
                    raise ValueError('Download response does not match immutable archive')
                with part.open('ab' if size else 'wb') as stream:
                    while True:
                        check_deadline(deadline)
                        chunk = response.read(4 * 1024 * 1024)
                        if not chunk:
                            break
                        stream.write(chunk)
                    stream.flush()
                    os.fsync(stream.fileno())
        except urllib.error.URLError:
            raise RuntimeError('Archive download interrupted; partial file retained') from None
    if part.stat().st_size != receipt['sizeBytes'] or file_hash(part, deadline) != receipt['sha256']:
        part.unlink()
        raise ValueError('Downloaded archive checksum mismatch; partial discarded')
    os.replace(part, path)
    return path


def download_ranges(config, receipt, request, deadline):
    """Bounded parallel HTTP ranges, committed as separate verified pieces.

    Never use a sparse file's length as proof of a resumable prefix. Only complete
    pieces get receipts; assembly is sequential and the entire ZIP is hashed.
    """
    rev = revision(request)
    path = safe_path(STAGING, archive_path(request))
    path.parent.mkdir(parents=True, exist_ok=True)
    pieces = safe_path(STAGING, '.downloads/' + rev)
    pieces.mkdir(parents=True, exist_ok=True)
    stopped = threading.Event()
    count = (receipt['sizeBytes'] + CHUNK_BYTES - 1) // CHUNK_BYTES
    url = config['gateway_url'] + '/submission-archives/' + rev + '.zip'

    def fetch_piece(index):
        start = index * CHUNK_BYTES
        end = min(start + CHUNK_BYTES, receipt['sizeBytes']) - 1
        target = pieces / (str(index) + '.bin')
        metadata = pieces / (str(index) + '.json')
        previous = read(metadata)
        if previous and previous.get('start') == start and previous.get('end') == end and target.exists() and target.stat().st_size == end - start + 1 and file_hash(target, deadline) == previous.get('sha256'):
            return target
        tmp = target.with_suffix('.tmp')
        descriptor = target.with_suffix('.request.json')
        identity = {'start': start, 'end': end, 'archiveSha256': receipt['sha256']}
        if read(descriptor) != identity:
            if tmp.exists():
                tmp.unlink()
            atomic(descriptor, identity)
        if tmp.exists() and (not stat.S_ISREG(tmp.lstat().st_mode) or tmp.stat().st_size > end - start + 1):
            raise ValueError('Invalid partial range file')
        for attempt in range(4):
            check_deadline(deadline)
            if stopped.is_set():
                raise RuntimeError('Another range failed; partial pieces retained')
            written = tmp.stat().st_size if tmp.exists() else 0
            if written == end - start + 1:
                break
            offset = start + written
            expected = 'bytes ' + str(offset) + '-' + str(end) + '/' + str(receipt['sizeBytes'])
            req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + config['gateway_token'], 'Range': 'bytes=' + str(offset) + '-' + str(end)})
            try:
                with OPENER.open(req, timeout=45) as response:
                    if response.status != 206 or response.headers.get('Content-Range') != expected or response.headers.get('X-Content-SHA256') != receipt['sha256']:
                        raise ValueError('Range response does not match immutable archive')
                    # These prefixes are written sequentially by this program,
                    # never preallocated. Final ZIP SHA-256 is still mandatory.
                    with tmp.open('ab') as stream:
                        while True:
                            check_deadline(deadline)
                            if stopped.is_set():
                                raise RuntimeError('Another range failed; partial pieces retained')
                            chunk = response.read(256 * 1024)
                            if not chunk:
                                break
                            if written + len(chunk) > end - start + 1:
                                raise ValueError('Range response exceeded expected length')
                            stream.write(chunk)
                            written += len(chunk)
                        stream.flush()
                        os.fsync(stream.fileno())
                if written != end - start + 1:
                    raise OSError('Incomplete range response; prefix retained')
                break
            except (urllib.error.URLError, OSError):
                check_deadline(deadline)
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)
        if not tmp.exists() or tmp.stat().st_size != end - start + 1:
            raise OSError('Range remains incomplete')
        piece_sha = file_hash(tmp, deadline)
        os.replace(tmp, target)
        atomic(metadata, {'start': start, 'end': end, 'sha256': piece_sha})
        return target

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(fetch_piece, i) for i in range(count)]
        try:
            for future in concurrent.futures.as_completed(futures):
                future.result()
        except Exception:
            stopped.set()
            for future in futures:
                future.cancel()
            raise
    part = path.with_suffix('.part')
    digest = hashlib.sha256()
    with part.open('wb') as stream:
        for index in range(count):
            with (pieces / (str(index) + '.bin')).open('rb') as source:
                while True:
                    check_deadline(deadline)
                    chunk = source.read(4 * 1024 * 1024)
                    if not chunk:
                        break
                    stream.write(chunk)
                    digest.update(chunk)
        stream.flush()
        os.fsync(stream.fileno())
    if part.stat().st_size != receipt['sizeBytes'] or digest.hexdigest() != receipt['sha256']:
        # Individual range receipts prove local completion, not remote identity.
        # The complete expected ZIP checksum remains the acceptance boundary.
        shutil.rmtree(pieces)
        part.unlink()
        raise ValueError('Assembled archive checksum mismatch; pieces discarded')
    os.replace(part, path)
    shutil.rmtree(pieces)
    return path


def raw_ready(request):
    if (RAW_STATE / 'eve-active.json').exists() or not (RAW_STATE / 'eve-last-success.json').exists():
        raise RuntimeError('Raw mirror publication is not complete')
    roots = set((RAW_STATE / 'current-tasks.list').read_text().splitlines())
    for task in request['tasks']:
        root = request['storageVendorId'] + '/' + request['submissionId'] + '/' + task['name']
        if root not in roots or not safe_path(RAW, root + '/task.toml').is_file() or not safe_path(RAW_SHARED, root + '/task.toml').is_file():
            raise RuntimeError('Task is not yet in both completed raw mirrors')


def index_entry(request, receipt=None, error=None):
    entry = {key: request[key] for key in ('vendorId', 'submissionId')}
    entry.update(revision=revision(request), taskCount=len(request['tasks']), status='ready' if receipt else 'pending')
    if receipt:
        entry.update(path=archive_path(request), sha256=receipt['sha256'], sizeBytes=receipt['sizeBytes'])
    if error:
        entry['reason'] = error
    return entry


def endpoint(path):
    return {'type': 'jfs', 'name': VOLUME, 'path': '/' + path.relative_to(JFS).as_posix() + '/'}


def start_publication(index):
    generation = time.strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:12]
    outbox = STAGING / '.outbox' / generation
    outbox.mkdir(parents=True)
    base = read(SHARED / 'index.json', {})
    known = {(entry.get('path'), entry.get('sha256')) for entry in base.get('submissions', []) if entry['status'] == 'ready'}
    files = []
    for entry in index['submissions']:
        if entry['status'] != 'ready' or (entry['path'], entry['sha256']) in known:
            continue
        source = safe_path(STAGING, entry['path'])
        target = safe_path(outbox, entry['path'])
        target.parent.mkdir(parents=True, exist_ok=True)
        os.link(source, target)
        files.append({key: entry[key] for key in ('path', 'sizeBytes', 'sha256')})
    index_data = json_bytes(index)
    atomic(outbox / 'index.json', index_data)
    plan = {'generation': generation, 'indexSha256': hashlib.sha256(index_data).hexdigest(),
            'baseIndexSha256': file_hash(SHARED / 'index.json') if (SHARED / 'index.json').exists() else None, 'files': files}
    atomic(outbox / 'plan.json', plan)
    # Publish our own trusted helper, never code from a delivered task.
    scripts = STAGING / '.scripts'
    script_data = Path(__file__).read_bytes()
    script = scripts / (hashlib.sha256(script_data).hexdigest() + '.py')
    if not script.exists():
        atomic(script, script_data)
    active = {'generation': generation, 'phase': 'transfer', 'planSha256': file_hash(outbox / 'plan.json'), 'script': str(script)}
    atomic(STATE / 'active.json', active)
    log('publication_prepared', generation=generation, new_archives=len(files))


def promote(generation, plan_sha, shared=SHARED):
    """Idempotent trusted EVE helper: hash copies, rename archives, commit index last."""
    if not re.fullmatch(r'\d{8}T\d{6}-[a-f0-9]{12}', generation) or not SHA.fullmatch(plan_sha):
        raise ValueError('Invalid publication identity')
    shared.mkdir(parents=True, exist_ok=True)
    with lock(shared / '.publish.lock'):
        done = shared / '.receipts' / (generation + '.json')
        if done.exists():
            if read(done)['planSha256'] != plan_sha:
                raise ValueError('Generation receipt conflicts')
            return
        incoming = shared / '.incoming' / generation
        if file_hash(incoming / 'plan.json') != plan_sha:
            raise ValueError('Transfer plan checksum mismatch')
        plan = read(incoming / 'plan.json')
        if plan['generation'] != generation or file_hash(incoming / 'index.json') != plan['indexSha256']:
            raise ValueError('Transferred index identity mismatch')
        current = file_hash(shared / 'index.json') if (shared / 'index.json').exists() else None
        if current not in (plan['baseIndexSha256'], plan['indexSha256']):
            raise ValueError('A newer publication is already current')
        for item in plan['files']:
            target = safe_path(shared, item['path'])
            candidate = safe_path(incoming, item['path'])
            source = candidate if candidate.exists() else target
            if source.stat().st_size != item['sizeBytes'] or file_hash(source) != item['sha256']:
                raise ValueError('Shared archive failed checksum verification')
            if candidate.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                os.replace(candidate, target)
                os.chmod(target, 0o644)
        index = read(incoming / 'index.json')
        for item in index['submissions']:
            if item['status'] == 'ready' and safe_path(shared, item['path']).stat().st_size != item['sizeBytes']:
                raise ValueError('Current index references a missing archive')
        atomic(shared / 'index.json', (incoming / 'index.json').read_bytes(), 0o644)
        atomic(done, {'generation': generation, 'planSha256': plan_sha, 'indexSha256': plan['indexSha256'], 'verifiedAt': now()}, 0o644)
        # Keep tiny generation plans for diagnostics; archive bytes moved above.


def advance_publication(eve):
    active = read(STATE / 'active.json')
    if not active:
        return False
    generation = active['generation']
    done = read(SHARED / '.receipts' / (generation + '.json'))
    if done:
        if done['planSha256'] != active['planSha256'] or file_hash(SHARED / 'index.json') != done['indexSha256']:
            raise ValueError('Shared publication receipt mismatch')
        index = read(STAGING / '.outbox' / generation / 'index.json')
        atomic(STAGING / 'index.json', index, 0o644)
        atomic(STATE / 'last-success.json', dict(done, ready=sum(e['status'] == 'ready' for e in index['submissions']), pending=sum(e['status'] != 'ready' for e in index['submissions'])))
        (STATE / 'active.json').unlink()
        shutil.rmtree(STAGING / '.outbox' / generation)
        log('shared_publication_verified', **read(STATE / 'last-success.json'))
        return True
    path = '/transfer' if active['phase'] == 'transfer' else '/fs/execute'
    payload = ({'task': {'transfer_type': 'transfer', 'transfer_strategy': 'cover', 'delete_src': False, 'ttl': 86400},
                'src': endpoint(STAGING / '.outbox' / generation), 'dst': endpoint(SHARED / '.incoming' / generation)}
               if path == '/transfer' else {'region': REGION, 'cmd_name': 'python3', 'cmd_args': active['script'] + ' --promote ' + generation + ' ' + active['planSha256']})
    op = active.get('operation')
    if not op:
        op = {'started': int(time.time()), 'path': path, 'payload': payload}
        active['operation'] = op
        atomic(STATE / 'active.json', active)
        op['task_id'] = eve.call('POST', path, payload)['task_id']
        atomic(STATE / 'active.json', active)
        log('eve_submitted', generation=generation, phase=active['phase'], task_id=op['task_id'])
        return True
    if 'task_id' not in op:
        if path == '/fs/execute':
            # The helper is generation-scoped, locked, idempotent, and guarded by
            # base-index checksum. A lost POST response can be safely resubmitted.
            op['task_id'] = eve.call('POST', path, payload)['task_id']
        else:
            matches = []
            page = 1
            while True:
                data = eve.call('GET', '/transfers/v2', query={'start_time': op['started'] - 5, 'end_time': int(time.time()) + 5, 'page': page, 'size': 500})
                for task in data.get('tasks', []):
                    if all(all(task.get(side, {}).get(key) == payload[side][key] for key in ('type', 'name', 'path')) for side in ('src', 'dst')):
                        matches.append(task['task']['task_id'])
                if page * 500 >= data.get('total', 0):
                    break
                page += 1
            if len(matches) != 1:
                raise RuntimeError('Uncertain EVE copy; matching task count=' + str(len(matches)))
            op['task_id'] = matches[0]
        atomic(STATE / 'active.json', active)
    data = eve.call('GET', path, query={'taskId': op['task_id']})
    status = data.get('status')
    atomic(STATE / 'eve-progress.json', {key: data.get(key) for key in ('status', 'copied', 'copied_bytes', 'failed', 'total', 'total_bytes')})
    if status == 'Successful':
        if data.get('failed', 0):
            raise RuntimeError('EVE reported failed copies')
        if active['phase'] == 'transfer':
            active['phase'] = 'promote'
            active.pop('operation')
            atomic(STATE / 'active.json', active)
        elif not (SHARED / '.receipts' / (generation + '.json')).exists():
            raise RuntimeError('EVE helper finished without a verified publication receipt')
    elif status in ('Failed', 'Timeout') and path == '/transfer' and op.get('retries', 0) < 3:
        op['retries'] = op.get('retries', 0) + 1
        atomic(STATE / 'active.json', active)
        eve.call('POST', '/transfer/retry', query={'taskId': op['task_id']})
    elif status in ('Failed', 'Timeout') and path == '/fs/execute' and active.get('promote_retries', 0) < 3:
        active['promote_retries'] = active.get('promote_retries', 0) + 1
        active.pop('operation')
        atomic(STATE / 'active.json', active)
    elif status not in ('Pending', 'Running', 'Scheduled'):
        raise RuntimeError('EVE operation stopped: ' + str(status))
    return True


def run(args):
    config = private_config(CONFIG)
    for key in ('case_url', 'gateway_url'):
        if not config[key].startswith('https://') or config[key].endswith('/'):
            raise ValueError('API origin must be HTTPS without trailing slash')
    catalog = api('GET', config['case_url'] + '/v1/catalog', 'Bearer ' + config['case_token'])
    requests = requests_from_catalog(catalog)
    selected = set(args.submission or [r['submissionId'] for r in requests])
    if selected - {r['submissionId'] for r in requests}:
        raise ValueError('Requested submission is not in the current Harbor catalog')
    if args.plan:
        log('plan', submissions=len(requests), selected=len(selected), tasks=sum(len(r['tasks']) for r in requests), requests=[{'vendorId': r['vendorId'], 'submissionId': r['submissionId'], 'revision': revision(r), 'tasks': len(r['tasks'])} for r in requests])
        return
    deadline = time.monotonic() + args.seconds
    STAGING.mkdir(parents=True, exist_ok=True)
    eve = Eve()
    errors = {}
    retry_sent = set()
    while True:
        check_deadline(deadline)
        if read(STATE / 'active.json'):
            advance_publication(eve)
            time.sleep(min(5, max(0, deadline - time.monotonic())))
            continue
        entries = []
        for request in requests:
            check_deadline(deadline)
            rev = revision(request)
            receipt_file = STATE / 'verified' / (rev + '.json')
            saved = read(receipt_file)
            path = safe_path(STAGING, archive_path(request))
            details = path.stat() if path.exists() else None
            if saved and details and details.st_size == saved['sizeBytes'] and details.st_mtime_ns == saved['localMtimeNs']:
                entries.append(index_entry(request, saved))
                continue
            receipt = None
            if request['submissionId'] in selected:
                try:
                    with lock(RAW_STATE / 'run.lock'):
                        raw_ready(request)
                    payload = dict(request)
                    if args.retry_failed and rev not in retry_sent:
                        payload['retry'] = True
                    result = api('POST', config['gateway_url'] + '/submission-archives', 'Bearer ' + config['gateway_token'], payload)
                    retry_sent.add(rev)
                    if result.get('revision') != rev:
                        raise ValueError('Gateway revision differs from planned identity')
                    if result['status'] == 'ready':
                        receipt = {key: result[key] for key in ('schemaVersion', 'revision', 'sha256', 'sizeBytes', 'sourceBytes', 'fileCount', 'taskCount', 'manifestSha256')}
                        if not path.exists() or path.stat().st_size != receipt['sizeBytes'] or file_hash(path, deadline) != receipt['sha256']:
                            path = download(config, receipt, request, deadline)
                        with lock(RAW_STATE / 'run.lock'):
                            raw_ready(request)
                            verify_archive(path, receipt, request, RAW, deadline)
                        receipt['localMtimeNs'] = path.stat().st_mtime_ns
                        atomic(receipt_file, receipt)
                        log('archive_verified', submission=request['submissionId'], tasks=len(request['tasks']), files=receipt['fileCount'], bytes=receipt['sizeBytes'])
                        errors.pop(rev, None)
                    elif result['status'] == 'failed':
                        errors[rev] = 'Gateway rejected source integrity; inspect gateway build log'
                    else:
                        errors[rev] = result['status']
                except TimeoutError:
                    raise
                except (ValueError, RuntimeError, OSError, zipfile.BadZipFile) as exc:
                    errors[rev] = type(exc).__name__ + ': ' + str(exc)
                    receipt = None
                    log('submission_pending', submission=request['submissionId'], reason=errors[rev])
            entries.append(index_entry(request, receipt, errors.get(rev)))
        # Re-read the supported catalog before publishing a selection. A change
        # during a long build cannot silently become the current index.
        fresh = requests_from_catalog(api('GET', config['case_url'] + '/v1/catalog', 'Bearer ' + config['case_token']))
        if fresh != requests:
            requests = fresh
            if not args.submission:
                selected = {r['submissionId'] for r in requests}
            continue
        old = read(STAGING / 'index.json', {})
        # Transient poll messages stay in private status, not the shared index.
        public_entries = [{k: v for k, v in entry.items() if k != 'reason'} for entry in entries]
        status = {'time': now(), 'ready': sum(e['status'] == 'ready' for e in entries), 'pending': sum(e['status'] != 'ready' for e in entries), 'submissions': entries}
        atomic(STATE / 'status.json', status)
        if old.get('submissions') != public_entries or not (SHARED / 'index.json').exists():
            start_publication({'schemaVersion': INDEX_SCHEMA, 'generatedAt': now(), 'submissions': public_entries})
            continue
        if all(entry['status'] == 'ready' for entry in entries if entry['submissionId'] in selected):
            log('up_to_date', ready=status['ready'], pending=status['pending'])
            return
        time.sleep(min(15, max(0, deadline - time.monotonic())))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', action='store_true')
    parser.add_argument('--submission', action='append')
    parser.add_argument('--seconds', type=int, default=2100)
    parser.add_argument('--retry-failed', action='store_true')
    parser.add_argument('--status', action='store_true')
    parser.add_argument('--audit', action='store_true')
    parser.add_argument('--promote', nargs=2, metavar=('GENERATION', 'PLAN_SHA256'))
    args = parser.parse_args()
    if args.promote:
        promote(*args.promote)
        return
    if args.status:
        log('status', progress=read(STATE / 'status.json'), active=read(STATE / 'active.json'), last_success=read(STATE / 'last-success.json'), last_error=read(STATE / 'last-error.json'))
        return
    if not 30 <= args.seconds <= 3300:
        parser.error('--seconds must be 30–3300')
    os.umask(0o077)
    STATE.mkdir(parents=True, exist_ok=True)
    try:
        with lock(STATE / 'run.lock'):
            if args.audit:
                if (STATE / 'active.json').exists():
                    raise RuntimeError('Finish the active publication before auditing')
                if file_hash(STAGING / 'index.json') != file_hash(SHARED / 'index.json'):
                    raise ValueError('Staging and shared indexes differ')
                index = read(STAGING / 'index.json')
                deadline = time.monotonic() + args.seconds
                ready = [item for item in index['submissions'] if item['status'] == 'ready']
                for item in ready:
                    for root in (STAGING, SHARED):
                        path = safe_path(root, item['path'])
                        if path.stat().st_size != item['sizeBytes'] or file_hash(path, deadline) != item['sha256']:
                            raise ValueError('Archive audit failed: ' + item['path'])
                report = {'time': now(), 'archives': len(ready), 'tasks': sum(item['taskCount'] for item in ready), 'bytes': sum(item['sizeBytes'] for item in ready), 'verification': 'SHA-256 of every current ZIP in staging and shared JFS'}
                atomic(STATE / 'last-audit.json', report)
                log('audit_success', **report)
            else:
                run(args)
    except BlockingIOError:
        log('already_running')
    except TimeoutError:
        log('run_budget_reached', message='Progress retained; next invocation resumes')
    except Exception as exc:
        atomic(STATE / 'last-error.json', {'time': now(), 'type': type(exc).__name__, 'message': str(exc)})
        log('publisher_failed', error_type=type(exc).__name__, message=str(exc))
        sys.exit(1)


if __name__ == '__main__':
    main()
