"""Spec for edits.py: exact-string replacement used by the edit_file tool."""
import unittest

from edits import apply_edit


class EditsTest(unittest.TestCase):
    def test_replaces_unique_occurrence(self):
        self.assertEqual(apply_edit("a = 1\nb = 2\n", "b = 2", "b = 3"), "a = 1\nb = 3\n")

    def test_multiline_old_string(self):
        self.assertEqual(apply_edit("x\ny\nz\n", "x\ny\n", "w\n"), "w\nz\n")

    def test_not_found_raises(self):
        with self.assertRaisesRegex(ValueError, "não encontrado"):
            apply_edit("abc", "zzz", "y")

    def test_ambiguous_raises_with_count(self):
        with self.assertRaisesRegex(ValueError, "3 vezes"):
            apply_edit("x x x", "x", "y")

    def test_replace_all(self):
        self.assertEqual(apply_edit("x x x", "x", "y", replace_all=True), "y y y")

    def test_empty_old_raises(self):
        with self.assertRaises(ValueError):
            apply_edit("abc", "", "y")

    def test_identical_old_and_new_raises(self):
        with self.assertRaises(ValueError):
            apply_edit("abc", "b", "b")


if __name__ == "__main__":
    unittest.main()
