"""Spec for rules.py: look up business-rule definitions by ID in the repo's markdown docs."""
import tempfile
import unittest
from pathlib import Path

from rules import find_rule, index_rules, rules_text

PRD = """# PRD
Texto que cita RN-C03 sem definir.
- **RN-C03** Arredondamento para múltiplo de R$ 5:
  1. juros;
  2. parcela.
- **RN-C04** Outra regra.

| ID | Entrada | Saída |
|---|---|---|
| T-01 | `split(689900, 6)` | `[114983 x5, 114985]` |
| T-02 | outro | caso |
"""
RFC = """# RFC
| 422 | `LOAN_CLOSED` | RN-C03 |
- **RN-C03** duplicada em outro arquivo (a primeira definição vale).
"""


class RulesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "docs" / "prd").mkdir(parents=True)
        (self.root / "docs" / "prd" / "a-prd.md").write_text(PRD)
        (self.root / "docs" / "z-rfc.md").write_text(RFC)
        (self.root / "docs" / "notes.txt").write_text("- **X-01** not markdown\n")

    def tearDown(self):
        self.tmp.cleanup()

    def test_index_maps_ids_to_first_definition(self):
        idx = index_rules(self.root)
        self.assertEqual(idx["RN-C03"], ("docs/prd/a-prd.md", 3))
        self.assertEqual(idx["T-01"], ("docs/prd/a-prd.md", 10))
        self.assertIn("RN-C04", idx)
        self.assertIn("T-02", idx)

    def test_index_ignores_mentions_headers_and_non_markdown(self):
        idx = index_rules(self.root)
        self.assertNotIn("ID", idx)
        self.assertNotIn("422", idx)
        self.assertNotIn("X-01", idx)

    def test_find_bullet_includes_indented_continuation(self):
        text = find_rule(self.root, "RN-C03")
        self.assertTrue(text.startswith("docs/prd/a-prd.md:3\n"))
        self.assertIn("1. juros;", text)
        self.assertIn("2. parcela.", text)
        self.assertNotIn("RN-C04", text)

    def test_find_table_row_only_that_row(self):
        text = find_rule(self.root, "T-01")
        self.assertIn("114985", text)
        self.assertNotIn("T-02", text)

    def test_find_unknown_returns_none(self):
        self.assertIsNone(find_rule(self.root, "RN-Z99"))

    def test_rules_text_joins_and_flags_missing(self):
        text = rules_text(self.root, ["T-02", "NOPE-01"])
        self.assertIn("outro", text)
        self.assertIn("(não encontrada: NOPE-01)", text)

    def test_block_is_capped_at_40_lines(self):
        long = "- **RN-L01** start\n" + "".join(f"  linha {i}\n" for i in range(100))
        (self.root / "docs" / "long.md").write_text(long)
        self.assertLessEqual(len(find_rule(self.root, "RN-L01").splitlines()), 41)


if __name__ == "__main__":
    unittest.main()
