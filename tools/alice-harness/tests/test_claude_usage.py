"""Spec for claude_usage.py: real Claude token usage from the session transcript."""
import json
import tempfile
import unittest
from pathlib import Path

from claude_usage import load, window, weighted


def line(mid, ts, out, read):
    return json.dumps({"type": "assistant", "timestamp": ts, "message": {"id": mid, "usage": {"input_tokens": 1, "cache_creation_input_tokens": 10, "cache_read_input_tokens": read, "output_tokens": out}}})


class ClaudeUsageTest(unittest.TestCase):
    def test_dedupes_repeated_message_ids_and_filters_window(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "s.jsonl"
            f.write_text("\n".join([line("a", "2026-01-01T10:00", 100, 1000), line("a", "2026-01-01T10:00", 100, 1000),
                                    line("b", "2026-01-01T11:00", 50, 2000), "not json", json.dumps({"type": "user"})]))
            rows = load(f)
            self.assertEqual(len(rows), 2)
            self.assertEqual(window(rows)["output_tokens"], 150)
            self.assertEqual(window(rows, "2026-01-01T10:30")["turns"], 1)

    def test_weighted_units(self):
        w = {"input_tokens": 10, "cache_creation_input_tokens": 100, "cache_read_input_tokens": 1000, "output_tokens": 20}
        self.assertEqual(weighted(w), 10 + 200 + 100 + 100)
