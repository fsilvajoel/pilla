"""LI-054: the lint rules go into the request, scoped to the files of the card."""
import tempfile
import unittest
from pathlib import Path

from alice import LINT_FALLBACK, lint_scopes, lint_sheet

SHEET = """# Cola do lint

intro que não vai para o pedido

## Todo TypeScript
<!-- scope: ts | probe: packages/schemas/src -->

- `no-console`: sem console.

## Código puro
<!-- scope: pure | probe: packages/finance/src -->

- `no-restricted-properties`: sem Math.

## Testes
<!-- scope: test | probe: packages/finance/src | suffix: .test.ts -->

- `no-restricted-syntax`: sem .only.
"""


def card(paths, kind="implement"):
    return {"allowedPaths": paths, "kind": kind}


class LintSheetTest(unittest.TestCase):
    def test_scopes_follow_the_card_files(self):
        self.assertEqual(lint_scopes(card(["packages/schemas/src/api/x.ts"])), ["ts"])
        self.assertEqual(lint_scopes(card(["packages/finance/src/x.ts"])), ["ts", "pure"])
        self.assertEqual(lint_scopes(card(["apps/api/src/lending/domain/loan.ts"])), ["ts", "pure"])
        self.assertEqual(lint_scopes(card(["packages/finance/src/x.test.ts"], "test-author")), ["ts", "pure", "test"])
        self.assertEqual(lint_scopes(card(["docs/memoria/modulos/finance.md"], "docs")), [])
        self.assertEqual(lint_scopes(card([], "pre-review")), [])

    def test_only_matching_sections_reach_the_request(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            (repo / "docs/memoria").mkdir(parents=True)
            (repo / "docs/memoria/lint.md").write_text(SHEET)
            text = lint_sheet(repo, card(["packages/schemas/src/x.ts"]))
            self.assertIn("check obrigatório", text)
            self.assertIn("no-console", text)
            self.assertNotIn("Math", text)
            self.assertNotIn(".only", text)
            self.assertNotIn("scope:", text)
            self.assertNotIn("intro", text)
            self.assertIn("Math", lint_sheet(repo, card(["packages/finance/src/x.ts"])))
            self.assertEqual(lint_sheet(repo, card(["docs/x.md"], "docs")), "")

    def test_missing_sheet_falls_back_to_the_short_rule(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(lint_sheet(Path(d), card(["packages/schemas/src/x.ts"])), LINT_FALLBACK)


if __name__ == "__main__":
    unittest.main()
