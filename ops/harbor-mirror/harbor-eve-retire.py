"""Run by EVE: preserve destination-only files in a sibling recovery tree."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

source = Path('/jfs-dialogue-alishprod01/data/users/TARS/harbor-tasks')
destination = Path('/jfs-dialogue-alishprod01/alignment_data_forge/rl_tasks/harbor-tasks')
generation, expected_digest = sys.argv[1:]
assert re.fullmatch(r'[0-9]{8}T[0-9]{6}-[a-f0-9]{10}', generation)
assert re.fullmatch(r'[a-f0-9]{64}', expected_digest)
recovery = destination.parent / '.harbor-tasks-mirror-history' / generation / 'retired'

def inventory(root):
    assert root.is_dir() and not root.is_symlink()
    result = {}
    for directory, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            p = Path(directory) / name
            s = p.lstat()
            assert stat.S_ISREG(s.st_mode) or stat.S_ISDIR(s.st_mode), 'Unsupported file type'
            if stat.S_ISREG(s.st_mode):
                result[p.relative_to(root).as_posix()] = [s.st_size, s.st_mtime_ns]
    return result

src = inventory(source)
assert src, 'Empty source'
actual_digest = hashlib.sha256(json.dumps(src, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
assert actual_digest == expected_digest, 'Source changed before retirement'
dst = inventory(destination)
extras = sorted(dst.keys() - src.keys())
for rel in extras:
    old, new = destination / rel, recovery / rel
    assert not new.exists(), 'Recovery collision'
    new.parent.mkdir(parents=True, exist_ok=True)
    os.rename(old, new)
# Only retired files' ancestors can have become empty; avoid a whole-tree scan.
parents = {(destination / rel).parent for rel in extras}
for p in sorted(parents, key=lambda item: len(item.parts), reverse=True):
    while p != destination:
        try:
            p.rmdir()
        except OSError:
            break
        p = p.parent
print(json.dumps({'retired_files': len(extras), 'recovery': str(recovery)}))
