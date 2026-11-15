"""Spec for tool-argument hygiene in alice.py (malformed tool calls from the local model)."""
import unittest

from alice import checklist_gaps, clean_path, missing_args_message


class ArgsTest(unittest.TestCase):
    def test_clean_path_strips_markdown_debris(self):
        self.assertEqual(clean_path("docs/estudo/graficos.py`)\n"), "docs/estudo/graficos.py")
        self.assertEqual(clean_path(" `src/a.ts` "), "src/a.ts")
        self.assertEqual(clean_path('"src/a.ts",'), "src/a.ts")

    def test_clean_path_keeps_normal_paths(self):
        self.assertEqual(clean_path("packages/finance/src/round(1).ts"), "packages/finance/src/round(1).ts")

    def test_missing_args_message_names_args_and_hint(self):
        msg = missing_args_message("edit_file", {"path": "x", "new": "y"})
        self.assertIn("old", msg)
        self.assertIn("edit_file(path, old, new", msg)
        self.assertIn("write_file", msg)

    def test_no_message_when_complete(self):
        self.assertIsNone(missing_args_message("edit_file", {"path": "x", "old": "a", "new": "b"}))


class ChecklistTest(unittest.TestCase):
    ITEMS = ["C1 lint rules active", "C2 boundaries enforced", "C3 main protected"]

    def test_every_item_needs_its_own_line_with_status(self):
        summary = "C1 ok - eslint.mjs:30\nC2 ok - .dependency-cruiser.cjs\nC3 falta - configurar no GitHub"
        self.assertEqual(checklist_gaps(summary, self.ITEMS), [])

    def test_missing_item_is_reported(self):
        self.assertEqual(checklist_gaps("C1 ok - x\nC3 falta - y", self.ITEMS), ["C2"])

    def test_bare_no_findings_fails_every_item(self):
        self.assertEqual(checklist_gaps("sem achados", self.ITEMS), ["C1", "C2", "C3"])

    def test_line_without_status_word_does_not_count(self):
        self.assertEqual(checklist_gaps("C1\nC2 ok - a\nC3 falta - b", self.ITEMS), ["C1"])


if __name__ == "__main__":
    unittest.main()
