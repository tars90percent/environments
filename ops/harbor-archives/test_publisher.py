import copy
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import zipfile

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).with_name('publisher.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


def request():
    return {'schemaVersion': p.SCHEMA, 'vendorId': 'vendor', 'storageVendorId': 'vendor', 'submissionId': 'delivery',
            'tasks': [{'taskVersionId': 'version:1', 'name': 'task', 'artifactSha256': 'a' * 64}]}


def archive(root, req=None):
    req = req or request()
    content = {'task/task.toml': b'version = "1.0"\n', 'task/tests/test.sh': b'#!/bin/sh\nexit 0\n'}
    files = [{'path': path, 'sourceKey': 'vendor/delivery/' + path, 'sha256': hashlib.sha256(data).hexdigest(), 'sizeBytes': len(data), 'mode': '755' if path.endswith('.sh') else '644'} for path, data in content.items()]
    manifest = dict(req, revision=p.revision(req), files=files)
    manifest_data = p.json_bytes(manifest)
    path = root / 'test.zip'
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED, allowZip64=True) as z:
        for item in files:
            info = zipfile.ZipInfo(item['path'])
            info.create_system = 3
            info.external_attr = (0o100000 | int(item['mode'], 8)) << 16
            z.writestr(info, content[item['path']])
        z.writestr('manifest.json', manifest_data)
    receipt = {'schemaVersion': p.SCHEMA, 'revision': p.revision(req), 'sha256': p.file_hash(path), 'sizeBytes': path.stat().st_size,
               'fileCount': 2, 'taskCount': 1, 'sourceBytes': sum(map(len, content.values())), 'manifestSha256': hashlib.sha256(manifest_data).hexdigest()}
    return path, receipt, content


class PublisherTests(unittest.TestCase):
    def test_api_negotiates_and_decodes_compressed_catalog(self):
        class Response(io.BytesIO):
            headers = {'Content-Encoding': 'gzip'}
        def open_request(req, timeout):
            self.assertEqual(req.headers['Accept-encoding'], 'gzip')
            return Response(gzip.compress(b'{"vendors": []}'))
        with mock.patch.object(p.OPENER, 'open', open_request):
            self.assertEqual(p.api('GET', 'https://example.test/v1/catalog', 'Bearer test'), {'vendors': []})

    def test_catalog_resolves_direct_and_legacy_artifacts_without_incidental_notes(self):
        task = {'id': 'version:1', 'kind': 'task', 'format': 'harbor', 'sourcePath': 'delivered/task/payload', 'contentSha256': 'a' * 64}
        submission = {'id': 'delivery', 'tasks': [task], 'sourceEvents': []}
        catalog = {'vendors': [{'id': 'vendor', 'submissions': [submission]}]}
        self.assertEqual(p.requests_from_catalog(catalog), [request()])
        self.assertEqual(p.revision(request()), 'c8a75daba8f1e3a7e81174564d3ad09d5b8ab4d831b1d877b60f290ae05c0ed9')
        task['classification'] = {'note': 'changed'}
        self.assertEqual(p.requests_from_catalog(catalog), [request()])
        task['contentSha256'] = None
        task['sourceItemIds'] = ['whole', 'named']
        submission['sourceEvents'] = [{'items': [{'id': 'whole', 'artifactId': 'whole.zip', 'displayName': 'whole.zip', 'contentSha256': 'b' * 64},
                                                {'id': 'named', 'artifactId': 'task.zip', 'displayName': 'task.zip', 'contentSha256': 'a' * 64}]}]
        self.assertEqual(p.requests_from_catalog(catalog), [request()])
        submission['sourceEvents'][0]['items'][1]['displayName'] = 'ambiguous.zip'
        with self.assertRaisesRegex(ValueError, 'unambiguous'):
            p.requests_from_catalog(catalog)

    def test_archive_checks_bytes_versions_modes_and_raw_inventory_without_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path, receipt, content = archive(root)
            raw = root / 'raw'
            for name, data in content.items():
                dest = raw / 'vendor/delivery' / name
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
            self.assertEqual(p.verify_archive(path, receipt, request(), raw), 2)
            (raw / 'vendor/delivery/task/task.toml').write_bytes(b'x' * len(content['task/task.toml']))
            with self.assertRaisesRegex(ValueError, 'raw JFS mirror'):
                p.verify_archive(path, receipt, request(), raw)
            changed = copy.deepcopy(request())
            changed['tasks'][0]['taskVersionId'] = 'version:2'
            with self.assertRaisesRegex(ValueError, 'exact CASE task versions'):
                p.verify_archive(path, receipt, changed)
            path.write_bytes(path.read_bytes()[:-1])
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                p.verify_archive(path, receipt, request())

    def test_shared_promotion_is_verified_atomic_and_recovers_after_partial_rename(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path, receipt, _ = archive(root)
            shared = root / 'shared'
            generation = '20260914T000000-' + 'a' * 12
            incoming = shared / '.incoming' / generation
            relative = p.archive_path(request())
            dest = incoming / relative
            dest.parent.mkdir(parents=True)
            dest.write_bytes(path.read_bytes())
            index = {'schemaVersion': p.INDEX_SCHEMA, 'submissions': [p.index_entry(request(), receipt)]}
            p.atomic(incoming / 'index.json', index)
            plan = {'generation': generation, 'baseIndexSha256': None, 'indexSha256': p.file_hash(incoming / 'index.json'),
                    'files': [{'path': relative, 'sizeBytes': receipt['sizeBytes'], 'sha256': receipt['sha256']}]}
            p.atomic(incoming / 'plan.json', plan)
            plan_sha = p.file_hash(incoming / 'plan.json')
            original = p.atomic
            def interrupted(target, *args, **kwargs):
                if target == shared / 'index.json':
                    raise OSError('process interrupted before index commit')
                return original(target, *args, **kwargs)
            with mock.patch.object(p, 'atomic', interrupted):
                with self.assertRaisesRegex(OSError, 'interrupted'):
                    p.promote(generation, plan_sha, shared)
            self.assertFalse((shared / 'index.json').exists())
            self.assertTrue((shared / relative).exists())
            p.promote(generation, plan_sha, shared)
            self.assertEqual(p.read(shared / 'index.json'), index)
            p.promote(generation, plan_sha, shared)
            self.assertEqual(p.file_hash(shared / relative), receipt['sha256'])

    def test_corrupt_transfer_keeps_previous_index_and_archives(self):
        with tempfile.TemporaryDirectory() as directory:
            shared = Path(directory)
            previous = {'submissions': [], 'generation': 'old'}
            p.atomic(shared / 'index.json', previous)
            generation = '20260914T000000-' + 'b' * 12
            incoming = shared / '.incoming' / generation
            p.atomic(incoming / 'index.json', {'submissions': []})
            p.atomic(incoming / 'file.zip', b'bad')
            plan = {'generation': generation, 'baseIndexSha256': p.file_hash(shared / 'index.json'), 'indexSha256': p.file_hash(incoming / 'index.json'),
                    'files': [{'path': 'file.zip', 'sha256': '0' * 64, 'sizeBytes': 3}]}
            p.atomic(incoming / 'plan.json', plan)
            with self.assertRaisesRegex(ValueError, 'checksum verification'):
                p.promote(generation, p.file_hash(incoming / 'plan.json'), shared)
            self.assertEqual(p.read(shared / 'index.json'), previous)

    def test_unsafe_paths_links_and_empty_catalog_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('../escape', '/absolute', 'a/../../x', 'a//b', 'a\\b'):
                with self.assertRaises(ValueError):
                    p.safe_path(root, name)
            (root / 'link').symlink_to('/tmp')
            with self.assertRaises(ValueError):
                p.safe_path(root, 'link/file')
        with self.assertRaisesRegex(ValueError, 'Empty'):
            p.requests_from_catalog({'vendors': []})

    def test_download_resumes_only_matching_archive_and_keeps_partial_on_interruption(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path, receipt, _ = archive(root)
            data = path.read_bytes()
            staging = root / 'staging'
            partial = staging / p.archive_path(request())
            partial.parent.mkdir(parents=True)
            partial.with_suffix('.part').write_bytes(data[:10])
            class Response(io.BytesIO):
                status = 206
                headers = {'X-Content-SHA256': receipt['sha256'], 'Content-Range': 'bytes 10-' + str(len(data) - 1) + '/' + str(len(data))}
            def open_request(req, timeout):
                self.assertEqual(req.headers['Range'], 'bytes=10-')
                return Response(data[10:])
            with mock.patch.object(p, 'STAGING', staging), mock.patch.object(p.OPENER, 'open', open_request):
                downloaded = p.download({'gateway_url': 'https://example.test', 'gateway_token': 'secret'}, receipt, request(), None)
            self.assertEqual(downloaded.read_bytes(), data)
            self.assertFalse(partial.with_suffix('.part').exists())

    def test_lost_eve_copy_response_recovers_existing_operation_without_duplicate_post(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / 'state'
            staging = root / 'staging'
            shared = root / 'shared'
            generation = '20260914T000000-' + 'c' * 12
            active = {'generation': generation, 'phase': 'transfer', 'planSha256': 'd' * 64, 'script': '/trusted.py'}
            p.atomic(state / 'active.json', active)
            calls = []
            class FakeEve:
                def call(self, method, path, payload=None, query=None):
                    calls.append((method, path))
                    if method == 'POST':
                        raise RuntimeError('response lost after creation')
                    if path == '/transfers/v2':
                        saved = p.read(state / 'active.json')['operation']['payload']
                        return {'total': 1, 'tasks': [dict(saved, task={'task_id': 'existing-operation'})]}
                    return {'status': 'Successful', 'failed': 0}
            with mock.patch.multiple(p, STATE=state, STAGING=staging, SHARED=shared, JFS=root):
                with self.assertRaisesRegex(RuntimeError, 'response lost'):
                    p.advance_publication(FakeEve())
                saved = p.read(state / 'active.json')
                self.assertIn('operation', saved)
                self.assertNotIn('task_id', saved['operation'])
                p.advance_publication(FakeEve())
                self.assertEqual(p.read(state / 'active.json')['phase'], 'promote')
                self.assertEqual(sum(method == 'POST' for method, _ in calls), 1)


if __name__ == '__main__':
    unittest.main()
