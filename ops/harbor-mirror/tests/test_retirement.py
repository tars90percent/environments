"""Exercise the captured EVE helper against temporary, synthetic file trees."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

HELPER = Path(__file__).resolve().parents[1] / 'harbor-eve-retire.py'
GENERATION = '20260917T120000-0123456789'


class RetirementTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.destination = self.root / 'source', self.root / 'destination'
        for folder in (self.source, self.destination):
            folder.mkdir()
            (folder / 'retained.txt').write_text('Retain this fixture.')
        stat = (self.source / 'retained.txt').stat()
        self.digest = hashlib.sha256(json.dumps({'retained.txt': [stat.st_size, stat.st_mtime_ns]},
                                               sort_keys=True, separators=(',', ':')).encode()).hexdigest()

    def execute(self, digest=None):
        # Replace only the two hard-coded filesystem roots; all helper logic is
        # the exact installed source. No JFS mount or remote service is touched.
        source = HELPER.read_text()
        for old, new in [('/jfs-dialogue-alishprod01/data/users/TARS/harbor-tasks', self.source),
                         ('/jfs-dialogue-alishprod01/alignment_data_forge/rl_tasks/harbor-tasks', self.destination)]:
            self.assertEqual(source.count(repr(old)), 1)
            source = source.replace(repr(old), repr(str(new)))
        with patch('sys.argv', [str(HELPER), GENERATION, digest or self.digest]), \
             contextlib.redirect_stdout(io.StringIO()):
            exec(compile(source, str(HELPER), 'exec'), {'__name__': '__main__'})

    def test_extras_are_preserved_and_empty_ancestors_removed(self):
        extra = self.destination / 'retired/task/old.txt'
        extra.parent.mkdir(parents=True)
        extra.write_bytes(b'Original extra bytes')
        self.execute()
        saved = self.root / '.harbor-tasks-mirror-history' / GENERATION / 'retired/retired/task/old.txt'
        self.assertEqual(saved.read_bytes(), b'Original extra bytes')
        self.assertFalse((self.destination / 'retired').exists())
        self.assertEqual((self.destination / 'retained.txt').read_text(), 'Retain this fixture.')

    def test_wrong_source_digest_leaves_destination_untouched(self):
        extra = self.destination / 'extra.txt'
        extra.write_text('Keep on failed verification')
        with self.assertRaisesRegex(AssertionError, 'Source changed'):
            self.execute('0' * 64)
        self.assertTrue(extra.exists())
        self.assertFalse((self.root / '.harbor-tasks-mirror-history').exists())

    def test_existing_recovery_file_cannot_be_overwritten(self):
        extra = self.destination / 'extra.txt'
        extra.write_text('New extra')
        saved = self.root / '.harbor-tasks-mirror-history' / GENERATION / 'retired/extra.txt'
        saved.parent.mkdir(parents=True)
        saved.write_text('Previous evidence')
        with self.assertRaisesRegex(AssertionError, 'Recovery collision'):
            self.execute()
        self.assertEqual(saved.read_text(), 'Previous evidence')
        self.assertEqual(extra.read_text(), 'New extra')

    def test_destination_symlink_cannot_escape_retirement_tree(self):
        (self.destination / 'escape').symlink_to(self.source)
        with self.assertRaisesRegex(AssertionError, 'Unsupported file type'):
            self.execute()
        self.assertTrue((self.source / 'retained.txt').is_file())


if __name__ == '__main__':
    unittest.main()
