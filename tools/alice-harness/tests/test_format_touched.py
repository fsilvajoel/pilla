"""LI-052: the harness formats the files the model touched with the repo's prettier."""
import os
import tempfile
import unittest
from pathlib import Path

from alice import format_touched

FAKE = "#!/bin/sh\nshift\nfor f in \"$@\"; do printf 'formatted\\n' > \"$f\"; done\n"


class FormatTouchedTest(unittest.TestCase):
    def repo(self, d: str, with_prettier: bool = True) -> Path:
        r = Path(d)
        (r / "a.ts").write_text("x")
        (r / "b.py").write_text("y")
        if with_prettier:
            b = r / "node_modules" / ".bin"
            b.mkdir(parents=True)
            (b / "prettier").write_text(FAKE)
            os.chmod(b / "prettier", 0o755)
        return r

    def test_formats_only_prettier_files_and_reports_changes(self):
        with tempfile.TemporaryDirectory() as d:
            r = self.repo(d)
            self.assertEqual(format_touched(r, ["a.ts", "b.py", "gone.ts"]), ["a.ts"])
            self.assertEqual((r / "a.ts").read_text(), "formatted\n")
            self.assertEqual((r / "b.py").read_text(), "y")

    def test_no_prettier_no_change(self):
        with tempfile.TemporaryDirectory() as d:
            r = self.repo(d, with_prettier=False)
            self.assertEqual(format_touched(r, ["a.ts"]), [])
            self.assertEqual((r / "a.ts").read_text(), "x")


if __name__ == "__main__":
    unittest.main()
