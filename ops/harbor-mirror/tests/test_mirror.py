"""Linux-only puller tests using a fake rclone and temporary, synthetic trees."""
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'harbor-tasks-mirror'
TASK = 'vendor/submission/task'

FAKE_RCLONE = r'''
import json
import os
from pathlib import Path
import shutil
import sys

command, remote, *args = sys.argv[1:]
root = Path(os.environ['FIXTURE_REMOTE'])
assert remote.startswith('harbor:fixture/')
source = root / remote.removeprefix('harbor:fixture/')
with open(os.environ['FIXTURE_CALLS'], 'a') as log:
    log.write(json.dumps([command, remote]) + '\n')
if os.environ.get('FIXTURE_FAIL') == command:
    sys.exit(1)
if command == 'lsd':
    for child in sorted(source.iterdir()):
        if child.is_dir():
            print('0 2026-09-17 00:00:00 -1 ' + child.name)
elif command == 'sync':
    assert args[args.index('--exclude') + 1] == '/task.toml'
    assert '--size-only' in args and '--delete-after' in args
    destination = Path(args[0])
    destination.mkdir(parents=True, exist_ok=True)
    for file in source.rglob('*'):
        if file.is_file() and file != source / 'task.toml':
            target = destination / file.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(file, target)
elif command == 'copyto':
    assert source.name == 'task.toml'
    shutil.copyfile(source, args[0])
else:
    raise AssertionError('Unexpected fake-rclone command')
'''


@unittest.skipUnless(sys.platform.startswith('linux'), 'Requires Linux, GNU utilities and Bash 4+')
class MirrorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.remote, self.destination, self.state = [self.root / name for name in ('remote', 'destination', 'state')]
        for directory in (self.remote, self.destination, self.state):
            directory.mkdir()
        self.calls = self.root / 'calls.jsonl'
        rclone = self.root / 'rclone'
        rclone.write_text('#!' + sys.executable + '\n' + FAKE_RCLONE)
        rclone.chmod(0o700)
        mountpoint = self.root / 'mountpoint'
        mountpoint.write_text('#!/bin/sh\nexit 0\n')
        mountpoint.chmod(0o700)
        config = self.root / 'railway.env'
        config.write_text('RCLONE_S3_BUCKET=fixture\n')

        # Rebind only installation paths. All shell control flow stays unchanged.
        # No installed executable, real credential, network or JFS path is used.
        replacements = {
            'readonly RCLONE=/usr/bin/rclone': 'readonly RCLONE=' + shlex.quote(str(rclone)),
            'readonly DEST=/jfs-dialogue-alishprod01/data/users/TARS/harbor-tasks': 'readonly DEST=' + shlex.quote(str(self.destination)),
            'readonly MOUNT=/jfs-dialogue-alishprod01': 'readonly MOUNT=' + shlex.quote(str(self.root)),
            'readonly ENV_FILE=/home/TARS/.config/harbor-tasks-mirror/railway.env': 'readonly ENV_FILE=' + shlex.quote(str(config)),
            'readonly STATE_DIR=/home/TARS/.local/state/harbor-tasks-mirror': 'readonly STATE_DIR=' + shlex.quote(str(self.state)),
            'readonly STATE_FILE=/home/TARS/.local/state/harbor-tasks-mirror/current-tasks.list': 'readonly STATE_FILE=' + shlex.quote(str(self.state / 'current-tasks.list')),
            'readonly RECOVERY_DIR=/jfs-dialogue-alishprod01/data/users/TARS/.harbor-tasks-mirror-history/$(date -u +%Y%m%dT%H%M%S)-$$': 'readonly RECOVERY_DIR=' + shlex.quote(str(self.root / 'recovery')),
            '/usr/bin/mountpoint': shlex.quote(str(mountpoint)),
        }
        source = SCRIPT.read_text()
        for old, new in replacements.items():
            self.assertEqual(source.count(old), 1)
            source = source.replace(old, new)
        self.script = self.root / 'mirror'
        self.script.write_text(source)
        self.task = self.remote / TASK
        self.task.mkdir(parents=True)
        (self.task / 'task.toml').write_text('version = "1.0"\n')
        (self.task / 'instruction.md').write_text('Synthetic fixture; never execute.\n')
        self.checkpoint = self.state / 'current-tasks.list'
        self.checkpoint.write_text('')
        (self.state / 'last-success').write_text('Previous success\n')

    def run_mirror(self, failure=None):
        result = subprocess.run(['bash', str(self.script)], capture_output=True, text=True, timeout=30,
                                env={**os.environ, 'FIXTURE_REMOTE': str(self.remote),
                                     'FIXTURE_CALLS': str(self.calls), 'FIXTURE_FAIL': failure or ''})
        if failure:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return [json.loads(line)[0] for line in self.calls.read_text().splitlines()]

    def test_payload_precedes_marker_and_checkpoint(self):
        calls = self.run_mirror()
        self.assertEqual(calls[-2:], ['sync', 'copyto'])
        self.assertEqual((self.destination / TASK / 'instruction.md').read_bytes(),
                         (self.task / 'instruction.md').read_bytes())
        self.assertEqual((self.destination / TASK / 'task.toml').read_bytes(),
                         (self.task / 'task.toml').read_bytes())
        self.assertEqual(self.checkpoint.read_text(), TASK + '\n')

    def test_payload_failure_does_not_publish_marker_or_advance_checkpoint(self):
        calls = self.run_mirror('sync')
        self.assertNotIn('copyto', calls)
        self.assertFalse((self.destination / TASK / 'task.toml').exists())
        self.assertEqual(self.checkpoint.read_text(), '')
        self.assertEqual((self.state / 'last-success').read_text(), 'Previous success\n')

    def test_marker_failure_does_not_publish_marker_or_advance_checkpoint(self):
        self.run_mirror('copyto')
        self.assertTrue((self.destination / TASK / 'instruction.md').exists())
        self.assertFalse((self.destination / TASK / 'task.toml').exists())
        self.assertEqual(self.checkpoint.read_text(), '')
        self.assertEqual((self.state / 'last-success').read_text(), 'Previous success\n')

    def test_checkpointed_task_without_marker_is_retried(self):
        self.checkpoint.write_text(TASK + '\n')
        calls = self.run_mirror()
        self.assertIn('sync', calls)
        self.assertTrue((self.destination / TASK / 'task.toml').exists())

    def test_completed_root_is_not_rescanned_for_changed_files(self):
        shutil.copytree(self.task, self.destination / TASK)
        self.checkpoint.write_text(TASK + '\n')
        (self.task / 'instruction.md').write_text('Upstream change at the same root')
        calls = self.run_mirror()
        self.assertNotIn('sync', calls)
        self.assertNotIn('copyto', calls)
        self.assertEqual((self.destination / TASK / 'instruction.md').read_text(),
                         'Synthetic fixture; never execute.\n')

    def test_empty_discovery_preserves_destination_and_checkpoint(self):
        shutil.copytree(self.task, self.destination / TASK)
        self.checkpoint.write_text(TASK + '\n')
        shutil.rmtree(self.remote / 'vendor')
        # Empty successful listing is also a refused run, not a deletion request.
        self.run_mirror('empty')
        self.assertTrue((self.destination / TASK / 'task.toml').exists())
        self.assertEqual(self.checkpoint.read_text(), TASK + '\n')

    def test_failed_discovery_preserves_destination_and_checkpoint(self):
        shutil.copytree(self.task, self.destination / TASK)
        self.checkpoint.write_text(TASK + '\n')
        self.run_mirror('lsd')
        self.assertTrue((self.destination / TASK / 'task.toml').exists())
        self.assertEqual(self.checkpoint.read_text(), TASK + '\n')

    def test_retired_task_is_moved_to_recovery(self):
        old = 'vendor/submission/retired'
        shutil.copytree(self.task, self.destination / old)
        self.checkpoint.write_text(old + '\n')
        self.run_mirror()
        self.assertFalse((self.destination / old).exists())
        self.assertEqual((self.root / 'recovery/retired' / old / 'task.toml').read_bytes(),
                         (self.task / 'task.toml').read_bytes())
        self.assertEqual(self.checkpoint.read_text(), TASK + '\n')


if __name__ == '__main__':
    unittest.main()
