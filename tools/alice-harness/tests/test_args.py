"""Spec for tool-argument hygiene in alice.py (malformed tool calls from the local model)."""
import unittest

from alice import clean_path, missing_args_message


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


if __name__ == "__main__":
    unittest.main()
