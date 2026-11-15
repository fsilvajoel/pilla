"""Spec for the per-run learning loop: harness version in metrics, check cache, document lookup (LI-022..LI-024)."""
import subprocess
import tempfile
import unittest
from pathlib import Path

from metrics import evolution_table, rev_at
from rules import find_doc

RFC = """# RFC-007 — Exemplo

## 1. Objetivo
Texto do objetivo.

## 3. Funções
### 3.1 `a()`
corpo a
### 3.2 `b()`
corpo b
## 4. Casos
"""


class EvolutionTest(unittest.TestCase):
    def test_rev_at_picks_last_commit_not_after_the_run(self):
        history = [("2026-11-14T10:00:00", "aaa"), ("2026-11-14T12:00:00", "bbb")]
        self.assertEqual(rev_at("2026-11-14T09:00:00", history), "?")
        self.assertEqual(rev_at("2026-11-14T11:00:00", history), "aaa")
        self.assertEqual(rev_at("2026-11-14T12:00:00", history), "bbb")

    def test_table_groups_by_version_in_order_of_first_use(self):
        recs = [
            {"task": "A", "status": "failed", "seconds": 100, "attempts": 3, "toolCalls": 40, "promptTokens": 1000, "harnessRev": "v1", "toolErrors": 20},
            {"task": "B", "status": "done", "seconds": 30, "attempts": 1, "toolCalls": 10, "promptTokens": 100, "harnessRev": "v2", "toolErrors": 1},
            {"task": "C", "status": "done", "seconds": 50, "attempts": 2, "toolCalls": 10, "promptTokens": 300, "harnessRev": "v2", "toolErrors": 1},
        ]
        rows = evolution_table(recs).splitlines()[2:]
        self.assertTrue(rows[0].startswith("| v1 | 1 | 0/1 (0%) | 100 |"))
        self.assertIn("50%", rows[0])
        self.assertTrue(rows[1].startswith("| v2 | 2 | 2/2 (100%) | 40 |"))
        self.assertIn("| 10% |", rows[1])
        self.assertIn("B, C", rows[1])

    def test_old_records_get_inferred_version(self):
        table = evolution_table([{"task": "X", "status": "done", "at": "2026-11-14T11:00:00"}], [("2026-11-14T10:00:00", "aaa")])
        self.assertIn("| aaa (inferido) | 1 |", table)


class FindDocTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "docs" / "rfc").mkdir(parents=True)
        (self.root / "docs" / "rfc" / "RFC-007-exemplo.md").write_text(RFC)

    def tearDown(self):
        self.tmp.cleanup()

    def test_outline_lists_headings_with_lines(self):
        out = find_doc(self.root, "RFC-007")
        self.assertIn("docs/rfc/RFC-007-exemplo.md", out)
        self.assertIn("3: ## 1. Objetivo", out)
        self.assertIn("7: ### 3.1 `a()`", out)

    def test_section_stops_at_next_heading_of_same_level(self):
        out = find_doc(self.root, "RFC-007 §3.1")
        self.assertIn("corpo a", out)
        self.assertNotIn("corpo b", out)
        whole = find_doc(self.root, "RFC-007 §3")
        self.assertIn("corpo b", whole)
        self.assertNotIn("Casos", whole)

    def test_unknown_doc_or_section_is_none(self):
        self.assertIsNone(find_doc(self.root, "RFC-008"))
        self.assertIsNone(find_doc(self.root, "RFC-007 §9"))
        self.assertIsNone(find_doc(self.root, "RN-C03"))


class TreeFingerprintTest(unittest.TestCase):
    def test_changes_only_when_the_tree_changes(self):
        from alice import tree_fingerprint
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
            (repo / "a.txt").write_text("1")
            subprocess.run(["git", "add", "."], cwd=repo, check=True)
            subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "x"], cwd=repo, check=True)
            base = tree_fingerprint(repo)
            self.assertEqual(base, tree_fingerprint(repo))
            (repo / "a.txt").write_text("2")
            edited = tree_fingerprint(repo)
            self.assertNotEqual(base, edited)
            (repo / "new.ts").write_text("x")
            self.assertNotEqual(edited, tree_fingerprint(repo))
            (repo / "new.ts").write_text("y")
            self.assertNotEqual(edited, tree_fingerprint(repo))


if __name__ == "__main__":
    unittest.main()
