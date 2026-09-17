"""Offline controller tests: temporary trees and a fake EVE client only."""
import contextlib
import importlib.machinery
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
loader = importlib.machinery.SourceFileLoader('mirror_pipeline', str(ROOT / 'harbor-tasks-pipeline'))
spec = importlib.util.spec_from_loader(loader.name, loader)
pipeline = importlib.util.module_from_spec(spec)
loader.exec_module(pipeline)


class FakeEve:
    def __init__(self, source, destination):
        self.source, self.destination = source, destination
        self.calls = []
        self.statuses = ['Successful']
        self.matches = []
        self.failed_files = 0

    def call(self, method, path, payload=None, query=None):
        self.calls.append((method, path, payload, query))
        if method == 'POST' and path == '/transfer':
            shutil.copytree(self.source, self.destination, dirs_exist_ok=True)
            return {'task_id': 'transfer-1'}
        if method == 'POST' and path == '/transfer/retry':
            return {}
        if method == 'GET' and path == '/transfers/v2':
            return {'tasks': self.matches, 'total': len(self.matches)}
        if method == 'GET' and path in ('/transfer', '/fs/execute'):
            status = self.statuses.pop(0) if len(self.statuses) > 1 else self.statuses[0]
            return {'status': status, 'failed': self.failed_files}
        raise AssertionError('Unexpected EVE call: ' + method + ' ' + path)


class ControllerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        self.destination = self.root / 'destination'
        self.state = self.root / 'state'
        for p in (self.source, self.destination, self.state):
            p.mkdir()
        task = self.source / 'vendor/submission/task'
        task.mkdir(parents=True)
        (task / 'task.toml').write_text('version = "1.0"\n')
        (task / 'instruction.md').write_text('Synthetic data; never execute.\n')
        (self.state / 'current-tasks.list').write_text('vendor/submission/task\n')
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        self.patches.enter_context(patch.multiple(pipeline, STATE=self.state, SOURCE=self.source,
                                                  DEST=self.destination, MIRROR='/fixture/mirror'))
        self.run = self.patches.enter_context(patch.object(pipeline.subprocess, 'run'))
        self.patches.enter_context(patch.object(pipeline.time, 'sleep'))
        self.patches.enter_context(contextlib.redirect_stdout(io.StringIO()))
        self.eve = FakeEve(self.source, self.destination)

    def synced(self):
        shutil.copytree(self.source, self.destination, dirs_exist_ok=True)
        self.last_success()

    def last_success(self):
        pipeline.atomic(self.state / 'eve-last-success.json',
                        {'source_digest': pipeline.digest(pipeline.scan(self.source))})

    def active(self, phase='transfer', operation=None):
        value = {'generation': '20260917T120000-0123456789',
                 'source_digest': pipeline.digest(pipeline.scan(self.source)), 'phase': phase}
        if operation is not None:
            value['operation'] = operation
        pipeline.atomic(self.state / 'eve-active.json', value)
        return value

    def test_unchanged_source_and_matching_destination_do_not_call_eve(self):
        self.synced()
        pipeline.main(self.eve)
        self.run.assert_called_once_with(['/fixture/mirror'], check=True)
        self.assertEqual(self.eve.calls, [])
        report = pipeline.read(self.state / 'eve-last-success.json')
        self.assertEqual(report['files'], 2)
        self.assertEqual(report['verification'], 'relative paths and sizes')
        self.assertFalse((self.state / 'eve-active.json').exists())

    def test_unchanged_source_with_missing_destination_file_still_transfers(self):
        self.synced()
        (self.destination / 'vendor/submission/task/instruction.md').unlink()
        pipeline.main(self.eve)
        self.assertEqual([(m, p) for m, p, _, _ in self.eve.calls],
                         [('POST', '/transfer'), ('GET', '/transfer')])
        payload = self.eve.calls[0][2]
        self.assertEqual(payload['task']['transfer_strategy'], 'cover')
        self.assertFalse(payload['task']['delete_src'])
        self.assertTrue((self.destination / 'vendor/submission/task/instruction.md').exists())

    def test_staging_failure_does_not_submit_eve_or_advance_success(self):
        self.synced()
        before = (self.state / 'eve-last-success.json').read_bytes()
        self.run.side_effect = subprocess.CalledProcessError(1, '/fixture/mirror')
        with self.assertRaises(subprocess.CalledProcessError):
            pipeline.main(self.eve)
        self.assertEqual(self.eve.calls, [])
        self.assertEqual((self.state / 'eve-last-success.json').read_bytes(), before)

    def test_resume_saved_transfer_before_touching_staging(self):
        self.synced()
        self.active(operation={'path': '/transfer', 'payload': pipeline.transfer_payload(),
                               'started': 1, 'retries': 0, 'task_id': 'existing'})
        pipeline.main(self.eve)
        self.run.assert_not_called()
        self.assertEqual(self.eve.calls[0], ('GET', '/transfer', None, {'taskId': 'existing'}))
        self.assertFalse(any(method == 'POST' for method, _, _, _ in self.eve.calls))

    def test_uncertain_transfer_is_reconciled_without_resubmission(self):
        self.synced()
        payload = pipeline.transfer_payload()
        self.active(operation={'path': '/transfer', 'payload': payload, 'started': 1, 'retries': 0})
        self.eve.matches = [{'src': payload['src'], 'dst': payload['dst'],
                             'task': {'task_id': 'recovered'}}]
        pipeline.main(self.eve)
        self.run.assert_not_called()
        self.assertEqual(self.eve.calls[0][1], '/transfers/v2')
        self.assertFalse(any(method == 'POST' for method, _, _, _ in self.eve.calls))

    def test_ambiguous_submission_preserves_active_state(self):
        self.synced()
        payload = pipeline.transfer_payload()
        state = self.active(operation={'path': '/transfer', 'payload': payload, 'started': 1, 'retries': 0})
        self.eve.matches = [{'src': payload['src'], 'dst': payload['dst'], 'task': {'task_id': x}}
                            for x in ('first', 'second')]
        with self.assertRaisesRegex(RuntimeError, 'matching task count=2'):
            pipeline.main(self.eve)
        self.run.assert_not_called()
        self.assertEqual(pipeline.read(self.state / 'eve-active.json'), state)
        self.assertFalse(any(method == 'POST' for method, _, _, _ in self.eve.calls))

    def test_transfer_retries_are_bounded_and_keep_same_task(self):
        state = self.active()
        self.eve.statuses = ['Failed']
        with self.assertRaisesRegex(RuntimeError, 'EVE task stopped: Failed'):
            pipeline.operation(self.eve, state, '/transfer', pipeline.transfer_payload())
        posts = [(path, query) for method, path, _, query in self.eve.calls if method == 'POST']
        self.assertEqual(posts, [('/transfer', None)] +
                         [('/transfer/retry', {'taskId': 'transfer-1'})] * 3)
        self.assertEqual(pipeline.read(self.state / 'eve-active.json')['operation']['retries'], 3)

    def test_success_with_failed_files_is_rejected(self):
        self.eve.failed_files = 1
        with self.assertRaisesRegex(RuntimeError, 'success with failed files'):
            pipeline.main(self.eve)
        self.assertTrue((self.state / 'eve-active.json').exists())
        self.assertFalse((self.state / 'eve-last-success.json').exists())

    def test_changed_staging_during_resume_cannot_be_marked_successful(self):
        self.synced()
        self.active(phase='verify')
        (self.source / 'vendor/submission/task/instruction.md').write_text('Changed fixture')
        with self.assertRaisesRegex(RuntimeError, 'Staging changed'):
            pipeline.main(self.eve)
        self.run.assert_not_called()
        self.assertTrue((self.state / 'eve-active.json').exists())

    def test_destination_only_files_need_retirement_not_another_copy(self):
        self.synced()
        extra = self.destination / 'vendor/submission/retired/task.toml'
        extra.parent.mkdir(parents=True)
        extra.write_text('Retired fixture')
        phases = []

        def retire(eve, state, path, payload):
            phases.append((state['phase'], path))
            extra.rename(self.root / 'retired-marker')

        with patch.object(pipeline, 'operation', side_effect=retire), \
             patch.object(pipeline, 'reconcile_payload', return_value={'fixture': True}):
            pipeline.main(self.eve)
        self.assertEqual(phases, [('reconcile', '/fs/execute')])
        self.assertEqual((self.root / 'retired-marker').read_text(), 'Retired fixture')

    def test_symlink_and_missing_completion_marker_are_rejected(self):
        (self.source / 'unsafe').symlink_to(self.root)
        with self.assertRaisesRegex(RuntimeError, 'link or special file'):
            pipeline.scan(self.source)
        (self.source / 'unsafe').unlink()
        (self.source / 'vendor/submission/task/task.toml').unlink()
        with self.assertRaisesRegex(RuntimeError, 'completion marker'):
            pipeline.validate_source(pipeline.scan(self.source))


if __name__ == '__main__':
    unittest.main()
