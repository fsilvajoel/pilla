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


class WeakEvidenceTest(unittest.TestCase):
    def test_ok_needs_existing_line_or_search_or_check(self):
        from alice import weak_evidence
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            (repo / "a.ts").write_text("x\ny\n")
            items = ["C1 a", "C2 b", "C3 c", "C4 d", "C5 e", "C6 mutation score"]
            summary = "\n".join([
                "C1 ok - a.ts:2",
                "C2 ok - a.ts:9",
                "C3 ok - a.ts",
                "C4 ok - search_code 'Math' -> 0 resultados",
                "C5 falta - nada",
                "C6 ok - run_check 1 -> 94%",
            ])
            self.assertEqual(weak_evidence(summary, items, repo), ["C2", "C3"])

    def test_every_item_needs_a_search_or_several_files(self):  # LI-033
        from alice import weak_evidence
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            for n in "abc":
                (repo / f"{n}.ts").write_text("x\n")
            items = ["C1 every payload is strict", "C2 every id uses idSchema", "C3 every schema is exported"]
            (repo / "index.ts").write_text("a\nb\nc\n")
            items.append("C4 every schema is exported from index.ts")
            summary = "\n".join(["C1 ok - a.ts:1", "C2 ok - a.ts:1, b.ts:1, c.ts:1", "C3 ok - search_code 'export' -> 10",
                                 "C4 ok - index.ts:1,2,3"])
            self.assertEqual(weak_evidence(summary, items, repo), ["C1"])


class PathNotesTest(unittest.TestCase):
    def test_notes_follow_the_package_of_the_card(self):
        from alice import path_notes
        self.assertIn("bigint", path_notes(["packages/finance/src/split.ts"]))
        schemas = path_notes(["packages/schemas/src/events/x.ts"])
        self.assertIn("nunca bigint", schemas)
        self.assertNotIn("literais 100n", schemas)
        self.assertEqual(path_notes(["docs/x.md"]), "")


class ToolsLI028Test(unittest.TestCase):
    def make(self, repo):
        from alice import Run, Tools
        card = {"id": "X", "title": "x", "allowedPaths": ["pkg/src/a.ts"], "protectedTests": ["pkg/src/a.test.ts"], "checks": [], "rules": []}
        d = repo / "run"
        d.mkdir()
        return Tools(Run(card, repo, d))

    def test_package_relative_paths_resolve_to_card_paths(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            (repo / "pkg" / "src").mkdir(parents=True)
            (repo / "pkg" / "src" / "a.ts").write_text("const a = 1;\n")
            (repo / "pkg" / "src" / "a.test.ts").write_text("test\n")
            tools = self.make(repo)
            self.assertIn("test", tools.read_file("src/a.test.ts"))
            self.assertEqual(tools.resolve("nope.ts"), "nope.ts")

    def test_repeating_an_applied_edit_is_not_an_error(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            (repo / "pkg" / "src").mkdir(parents=True)
            (repo / "pkg" / "src" / "a.ts").write_text("const a = 1;\n")
            tools = self.make(repo)
            self.assertTrue(tools.edit_file("pkg/src/a.ts", "const a = 1;", "const a = 2;").startswith("ok"))
            again = tools.edit_file("src/a.ts", "const a = 1;", "const a = 2;")
            self.assertIn("já contém", again)
            self.assertEqual((repo / "pkg" / "src" / "a.ts").read_text(), "const a = 2;\n")

    def test_short_file_is_shown_after_edit(self):  # LI-029
        import alice
        self.assertIn("conteúdo atual", alice.current_view("a\nb\n"))
        self.assertEqual(alice.current_view("x\n" * 60), "")

    def test_lib_sheets_follow_the_package_dependencies(self):
        import json, tempfile, alice
        from pathlib import Path
        with tempfile.TemporaryDirectory() as d:
            r = Path(d)
            (r / "packages/schemas").mkdir(parents=True)
            (r / "packages/schemas/package.json").write_text(json.dumps({"dependencies": {"zod": "^4"}}))
            (r / "docs/memoria/libs").mkdir(parents=True)
            (r / "docs/memoria/libs/zod.md").write_text("use z.int()")
            (r / "docs/memoria/libs/react.md").write_text("hooks")
            out = alice.lib_sheets(r, {"allowedPaths": ["packages/schemas/src/a.ts"]})
            self.assertIn("z.int()", out)
            self.assertNotIn("hooks", out)
            self.assertIn("hooks", alice.lib_sheets(r, {"allowedPaths": [], "libs": ["react"]}))
            cited = {"allowedPaths": [], "checklist": ["C8 follows the sheet (docs/memoria/libs/react.md)"]}
            self.assertIn("hooks", alice.lib_sheets(r, cited))


class PreReviewGateTest(unittest.TestCase):
    def test_red_check_is_evidence_in_pre_review_but_a_gate_in_implement(self):  # LI-036
        import subprocess, alice
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            subprocess.run(["git", "init", "-q", d], check=True)
            base = {"id": "E9-T01", "title": "t", "allowedPaths": [], "checks": ["false"], "done": ["x"]}
            review = alice.Run({**base, "kind": "pre-review"}, repo, repo)
            self.assertEqual(review.verify(), (True, ""))
            implement = alice.Run({**base, "kind": "implement"}, repo, repo)
            self.assertFalse(implement.verify()[0])


class ShortPathEvidenceTest(unittest.TestCase):
    def test_unique_suffix_counts_as_a_real_file(self):  # LI-037
        import subprocess
        from alice import weak_evidence
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            (repo / "pkg/a/src").mkdir(parents=True); (repo / "pkg/b/src").mkdir(parents=True)
            (repo / "pkg/a/src/index.ts").write_text("1\n2\n3\n")
            (repo / "pkg/b/src/index.ts").write_text("1\n")
            (repo / "pkg/a/src/only.ts").write_text("1\n2\n")
            subprocess.run(["git", "init", "-q", d], check=True)
            subprocess.run(["git", "-C", d, "add", "."], check=True)
            self.assertEqual(weak_evidence("C1 ok - only.ts:2\nC2 ok - src/index.ts:1", ["C1 x", "C2 y"], repo), ["C2"])


class ReadRulePathTest(unittest.TestCase):
    def test_read_rule_with_a_file_path_reads_the_file(self):  # LI-038
        import subprocess, alice
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d); (repo / "docs").mkdir(); (repo / "docs/glossario.md").write_text("Empréstimo\n")
            subprocess.run(["git", "init", "-q", d], check=True)
            run = alice.Run({"id": "E9-T01", "title": "t", "kind": "pre-review", "allowedPaths": [], "checks": [], "done": ["x"]}, repo, repo)
            out = alice.Tools(run).read_rule("docs/glossario.md")
            self.assertIn("Empréstimo", out)


class LineRangeEvidenceTest(unittest.TestCase):
    def test_a_range_counts_every_line_it_covers(self):  # LI-040
        from alice import weak_evidence
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d); (repo / "index.ts").write_text("x\n" * 13)
            self.assertEqual(weak_evidence("C1 ok - index.ts:4-13\nC2 ok - index.ts:4-5", ["C1 every a", "C2 every b"], repo), ["C2"])


class DoneLineTest(unittest.TestCase):
    def test_stub_marker_and_literal_done_lines(self):  # LI-041, LI-042
        from alice import done_line_problems
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d); f = repo / "a.ts"
            card = {"allowedPaths": ["a.ts"], "done": ["export type A = z.infer<typeof a>;", 'import line: import { x } from "../c"; never']}
            f.write_text('/** ESBOÇO: troque */\nimport { x } from "../c";\nexport const a = 1;\n')
            probs = done_line_problems(card, repo)
            self.assertEqual(len(probs), 2)
            self.assertIn("ESBOÇO", probs[0]); self.assertIn("export type A", probs[1])
            f.write_text('import { x } from "../c";\nexport const a = 1;\nexport type A = z.infer<typeof a>;\n')
            self.assertEqual(done_line_problems(card, repo), [])

    def test_run_check_proves_only_items_about_a_check(self):  # LI-043
        from alice import weak_evidence
        with tempfile.TemporaryDirectory() as d:
            summary = "C1 ok - run_check 1 -> 100%\nC2 ok - run_check 0 -> 94%"
            self.assertEqual(weak_evidence(summary, ["C1 no regex outside common.ts", "C2 mutation score >= 90%"], Path(d)), ["C1"])


if __name__ == "__main__":
    unittest.main()
