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


from edits import apply_edit_tolerant, closest_snippet, replace_function

TS = '''import type { Cents } from "./money";

/** doc */
export function roundToStep(_value: Cents, _step: Cents): Cents {
  throw new Error("not implemented");
}

export function other(): number {
  if (true) {
    return 1;
  }
  return 2;
}
'''


class ReplaceFunctionTest(unittest.TestCase):
    def test_replaces_whole_exported_function_by_name(self):
        new = "export function roundToStep(value: Cents, step: Cents): Cents {\n  return value;\n}"
        out = replace_function(TS, "roundToStep", new)
        self.assertIn("return value;", out)
        self.assertNotIn("not implemented", out)
        self.assertIn("/** doc */", out)
        self.assertIn("export function other(): number {\n  if (true) {", out)

    def test_handles_nested_braces(self):
        out = replace_function(TS, "other", "export function other(): number {\n  return 3;\n}")
        self.assertIn("return 3;", out)
        self.assertNotIn("return 2;", out)
        self.assertIn("not implemented", out)

    def test_does_not_duplicate_the_doc_comment_the_model_sends_again(self):
        # erro 16: o modelo reenvia o /** */ junto com a função e o comentário do esboço aparecia duas vezes
        new = "/** doc */\nexport function roundToStep(value: Cents, step: Cents): Cents {\n  return value;\n}"
        out = replace_function(TS, "roundToStep", new)
        self.assertEqual(out.count("/** doc */"), 1)
        self.assertIn("return value;", out)

    def test_multiline_doc_comment_is_kept_once(self):
        ts = "/**\n * a\n * b\n */\nexport function f(): number {\n  return 1;\n}\n"
        new = "/**\n * a\n * b\n */\nexport function f(): number {\n  return 2;\n}"
        out = replace_function(ts, "f", new)
        self.assertEqual(out, ts.replace("return 1", "return 2"))

    def test_keeps_helper_above_and_drops_only_the_doc_comment(self):
        new = "const h = 1;\n\n/** doc */\nexport function roundToStep(value: Cents): Cents {\n  return value + h;\n}"
        out = replace_function(TS, "roundToStep", new)
        self.assertEqual(out.count("/** doc */"), 1)
        self.assertIn("const h = 1;", out)

    def test_comment_of_the_code_is_kept_when_the_file_has_none(self):
        ts = "export function f(): number {\n  return 1;\n}\n"
        out = replace_function(ts, "f", "// novo\nexport function f(): number {\n  return 2;\n}")
        self.assertIn("// novo", out)

    def test_unknown_function_raises(self):
        with self.assertRaisesRegex(ValueError, "não encontrada"):
            replace_function(TS, "nope", "x")

    def test_code_must_declare_the_same_function(self):
        with self.assertRaisesRegex(ValueError, "roundToStep"):
            replace_function(TS, "roundToStep", "export function wrong() {}")


class TolerantEditTest(unittest.TestCase):
    def test_exact_match_still_works(self):
        self.assertEqual(apply_edit_tolerant("a\nb\n", "b", "c"), "a\nc\n")

    def test_ignores_line_number_prefixes_and_indentation(self):
        old = "5\texport function roundToStep(_value: Cents, _step: Cents): Cents {\n6\t    throw new Error(\"not implemented\");"
        out = apply_edit_tolerant(TS, old, "export function roundToStep(v: Cents, s: Cents): Cents {\n  return v;")
        self.assertIn("  return v;\n}", out)
        self.assertNotIn("not implemented", out)

    def test_not_found_message_shows_closest_snippet(self):
        with self.assertRaisesRegex(ValueError, "parecido"):
            apply_edit_tolerant(TS, "throw new Error(\"not implementd\");", "x")

    def test_closest_snippet(self):
        self.assertIn("not implemented", closest_snippet(TS, "throw new Eror(\"not implemented\")"))
