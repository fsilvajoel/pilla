"""Spec for metrics.py: one JSON line per run, plus a summary used to calibrate task cards."""
import json
import tempfile
import unittest
from pathlib import Path

from metrics import append, load, summary


def rec(status, kind="implement", attempts=1, seconds=10.0, prompt=100, output=50):
    return {"task": "T", "kind": kind, "status": status, "attempts": attempts, "toolCalls": 3,
            "seconds": seconds, "promptTokens": prompt, "outputTokens": output}


class MetricsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "sub" / "metrics.jsonl"

    def tearDown(self):
        self.tmp.cleanup()

    def test_append_creates_dirs_and_writes_one_line_per_record(self):
        append(self.path, rec("done"))
        append(self.path, rec("failed"))
        lines = self.path.read_text().splitlines()
        self.assertEqual(len(lines), 2)
        self.assertEqual(json.loads(lines[1])["status"], "failed")

    def test_load_missing_file_is_empty(self):
        self.assertEqual(load(self.path), [])

    def test_load_skips_malformed_lines(self):
        self.path.parent.mkdir(parents=True)
        self.path.write_text('{"status": "done"}\nnot json\n\n{"status": "failed"}\n')
        self.assertEqual([r["status"] for r in load(self.path)], ["done", "failed"])

    def test_summary(self):
        s = summary([rec("done", attempts=1, seconds=10, prompt=100, output=40),
                     rec("failed", attempts=3, seconds=30, prompt=300, output=60),
                     rec("done", kind="test-author", attempts=2, seconds=20, prompt=200, output=50)])
        self.assertEqual(s["runs"], 3)
        self.assertEqual(s["done"], 2)
        self.assertAlmostEqual(s["successRate"], 2 / 3)
        self.assertAlmostEqual(s["avgAttempts"], 2.0)
        self.assertAlmostEqual(s["avgSeconds"], 20.0)
        self.assertEqual(s["aliceTokens"], {"prompt": 600, "output": 150})
        self.assertEqual(s["byKind"]["implement"]["runs"], 2)
        self.assertEqual(s["byKind"]["test-author"]["done"], 1)

    def test_summary_empty(self):
        s = summary([])
        self.assertEqual(s["runs"], 0)
        self.assertEqual(s["successRate"], 0)
        self.assertEqual(s["byKind"], {})


if __name__ == "__main__":
    unittest.main()
