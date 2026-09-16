import copy
import contextlib
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
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
    def test_audit_cli_verifies_both_copies_and_reports_success_with_its_timestamp(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path, receipt, _ = archive(root)
            state, staging, shared = root / 'state', root / 'staging', root / 'shared'
            index = {'schemaVersion': p.INDEX_SCHEMA, 'submissions': [p.index_entry(request(), receipt)]}
            for destination in (staging, shared):
                p.atomic(destination / p.archive_path(request()), path.read_bytes())
                p.atomic(destination / 'index.json', index)
            output = io.StringIO()
            with mock.patch.object(p, 'STATE', state), mock.patch.object(p, 'STAGING', staging), mock.patch.object(p, 'SHARED', shared), mock.patch.object(p.sys, 'argv', ['publisher', '--audit', '--seconds', '30']), contextlib.redirect_stdout(output):
                p.main()
            report = p.read(state / 'last-audit.json')
            self.assertEqual(report['archives'], 1)
            message = json.loads(output.getvalue())
            self.assertEqual(message['event'], 'audit_success')
            self.assertEqual(message['time'], report['time'])
            self.assertFalse((state / 'last-error.json').exists())

    def test_manifest_api_is_independent_of_zip_cache_and_retains_trusted_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path, receipt, _ = archive(root)
            with zipfile.ZipFile(path) as z:
                data = z.read('manifest.json')
            response = dict(receipt, status='ready', manifestJson=data.decode())
            config = {'gateway_url': 'https://example.test', 'gateway_token': 'test'}
            with mock.patch.object(p, 'STATE', root / 'state'), mock.patch.object(p, 'api', return_value=response) as call:
                manifest_path, saved = p.prepare_manifest(config, request())
                self.assertEqual(manifest_path.read_bytes(), data)
                self.assertNotIn('sha256', saved)  # No ZIP identity received from Railway.
                self.assertEqual(call.call_args.args[1], 'https://example.test/submission-manifest')
                self.assertEqual(p.prepare_manifest(config, request()), (manifest_path, saved))
                self.assertEqual(call.call_count, 1)
                manifest_path.write_bytes(data + b' ')
                with self.assertRaisesRegex(ValueError, 'checksum'):
                    p.prepare_manifest(config, request())

    def test_manifest_rejects_changed_source_mapping_or_selection_and_wrong_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            path, receipt, _ = archive(Path(directory))
            with zipfile.ZipFile(path) as z:
                manifest = json.loads(z.read('manifest.json'))
            for key, value in [('sourceKey', 'another/private/file'), ('mode', '4755'), ('sizeBytes', -1)]:
                altered = copy.deepcopy(manifest)
                altered['files'][0][key] = value
                data = p.json_bytes(altered)
                with self.assertRaises(ValueError):
                    p.checked_manifest(data, dict(receipt, manifestSha256=hashlib.sha256(data).hexdigest()), request())
            with self.assertRaisesRegex(ValueError, 'exact CASE'):
                p.checked_manifest(p.json_bytes(manifest), dict(receipt, revision='0' * 64), request())

    def test_legacy_and_checksum_paths_reuse_verified_archives_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path, receipt, _ = archive(root)
            with mock.patch.object(p, 'STAGING', root / 'staging'), mock.patch.object(p, 'api', side_effect=AssertionError('No network')):
                for relative in (p.archive_path(request()), p.archive_path(request(), receipt['sha256'])):
                    destination = p.STAGING / relative
                    p.atomic(destination, path.read_bytes())
                    saved = p.reuse_archive(request(), dict(receipt, path=relative))
                    self.assertEqual(p.index_entry(request(), saved)['path'], relative)
                    self.assertEqual(p.index_entry(request(), saved)['manifestSha256'], receipt['manifestSha256'])
                    self.assertEqual(p.reuse_archive(request(), saved), saved)
                with self.assertRaisesRegex(ValueError, 'identity'):
                    p.receipt_path(request(), dict(receipt, path='vendor/delivery/unrelated.zip'))

    def test_raw_readiness_requires_completed_publication_and_both_task_markers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with mock.patch.multiple(p, RAW_STATE=root / 'state', RAW=root / 'raw', RAW_SHARED=root / 'shared'):
                p.atomic(p.RAW_STATE / 'eve-last-success.json', {})
                p.atomic(p.RAW_STATE / 'current-tasks.list', b'vendor/delivery/task\n')
                for destination in (p.RAW, p.RAW_SHARED):
                    p.atomic(destination / 'vendor/delivery/task/task.toml', b'v')
                p.raw_ready(request())
                p.atomic(p.RAW_STATE / 'eve-active.json', {})
                with self.assertRaisesRegex(RuntimeError, 'not complete'):
                    p.raw_ready(request())
                (p.RAW_STATE / 'eve-active.json').unlink()
                (p.RAW_SHARED / 'vendor/delivery/task/task.toml').unlink()
                with self.assertRaisesRegex(RuntimeError, 'both completed'):
                    p.raw_ready(request())

    def test_failed_explicit_rebuild_keeps_previous_verified_archive_current(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path, receipt, _ = archive(root)
            state, staging, shared = root / 'state', root / 'staging', root / 'shared'
            p.atomic(staging / p.archive_path(request()), path.read_bytes())
            p.atomic(state / 'verified' / (p.revision(request()) + '.json'), receipt)
            index = {'submissions': [p.index_entry(request(), receipt)]}
            p.atomic(staging / 'index.json', index)
            p.atomic(shared / 'index.json', index)
            task = {'id': 'version:1', 'kind': 'task', 'format': 'harbor', 'sourcePath': 'task', 'artifactId': 'artifact', 'contentSha256': 'a' * 64}
            catalog = {'vendors': [{'id': 'vendor', 'submissions': [{'id': 'delivery', 'tasks': [task]}]}]}
            config = {'case_url': 'https://case.test', 'gateway_url': 'https://gateway.test', 'case_token': 'test'}
            args = SimpleNamespace(submission=['delivery'], plan=False, rebuild=True, seconds=30, retry_failed=False)
            with mock.patch.multiple(p, STATE=state, STAGING=staging, SHARED=shared, RAW_STATE=root / 'raw-state'), \
                 mock.patch.object(p, 'private_config', return_value=config), mock.patch.object(p, 'api', return_value=catalog), \
                 mock.patch.object(p, 'Eve'), mock.patch.object(p, 'raw_ready'), mock.patch.object(p, 'log'), \
                 mock.patch.object(p, 'prepare_manifest', return_value=(root / 'manifest.json', {})), \
                 mock.patch.object(p, 'build_archive', side_effect=ValueError('source mismatch')), \
                 mock.patch.object(p, 'start_publication') as publish, \
                 mock.patch.object(p.time, 'sleep', side_effect=TimeoutError('stop test')):
                with self.assertRaises(TimeoutError):
                    p.run(args)
                publish.assert_not_called()
            entry = p.read(state / 'status.json')['submissions'][0]
            self.assertEqual(entry['status'], 'ready')
            self.assertEqual(entry['path'], p.archive_path(request()))
            self.assertIn('source mismatch', entry['reason'])
            self.assertEqual(p.read(shared / 'index.json'), index)

    def test_rebuild_requires_explicit_selection(self):
        with mock.patch.object(p.sys, 'argv', ['publisher', '--rebuild']), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as caught:
                p.main()
            self.assertEqual(caught.exception.code, 2)

    def test_api_negotiates_and_decodes_compressed_catalog(self):
        class Response(io.BytesIO):
            headers = {'Content-Encoding': 'gzip'}
        def open_request(req, timeout):
            self.assertEqual(req.headers['Accept-encoding'], 'gzip')
            return Response(gzip.compress(b'{"vendors": []}'))
        with mock.patch.object(p.OPENER, 'open', open_request):
            self.assertEqual(p.api('GET', 'https://example.test/v1/catalog', 'Bearer test'), {'vendors': []})

    def test_catalog_resolves_direct_and_legacy_artifacts_without_incidental_notes(self):
        task = {'id': 'version:1', 'kind': 'task', 'format': 'harbor', 'sourcePath': 'delivered/task/payload', 'artifactId': 'task.tar.gz', 'contentSha256': 'a' * 64}
        submission = {'id': 'delivery', 'tasks': [task], 'sourceEvents': []}
        catalog = {'vendors': [{'id': 'vendor', 'submissions': [submission]}]}
        self.assertEqual(p.requests_from_catalog(catalog), [request()])
        self.assertEqual(p.revision(request()), 'c8a75daba8f1e3a7e81174564d3ad09d5b8ab4d831b1d877b60f290ae05c0ed9')
        task['classification'] = {'note': 'changed'}
        self.assertEqual(p.requests_from_catalog(catalog), [request()])
        task['contentSha256'] = None
        task['artifactId'] = None
        task['sourceItemIds'] = ['whole', 'named']
        submission['sourceEvents'] = [{'items': [{'id': 'whole', 'artifactId': 'whole.zip', 'displayName': 'whole.zip', 'contentSha256': 'b' * 64},
                                                {'id': 'named', 'artifactId': 'task.zip', 'displayName': 'task.zip', 'contentSha256': 'a' * 64}]}]
        self.assertEqual(p.requests_from_catalog(catalog), [request()])
        task['contentSha256'] = 'c' * 64  # Legacy task-content digest, not archive SHA.
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
            p.atomic(shared / 'file.zip', b'previous')
            plan['files'][0]['sha256'] = p.file_hash(incoming / 'file.zip')
            p.atomic(incoming / 'plan.json', plan)
            with self.assertRaisesRegex(ValueError, 'immutable archive path'):
                p.promote(generation, p.file_hash(incoming / 'plan.json'), shared)
            self.assertEqual((shared / 'file.zip').read_bytes(), b'previous')
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
