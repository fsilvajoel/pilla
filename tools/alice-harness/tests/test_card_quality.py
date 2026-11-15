"""Spec for cards.quality_problems: errors of whoever writes the card, each one seen in a real run."""
import unittest

from cards import min_tool_calls, quality_problems


def card(**kw):
    base = {"id": "E2-T30", "title": "Implement x", "kind": "implement", "assignee": "alice", "rules": [],
            "allowedPaths": ["packages/schemas/src/api/x.ts"], "protectedTests": ["packages/schemas/src/api/api.test.ts"],
            "readFirst": ["packages/schemas/src/common.ts"],
            "checks": ["pnpm --filter @pilla/schemas exec vitest run src/api/api.test.ts -t x",
                       "pnpm --filter @pilla/schemas typecheck", "pnpm --filter @pilla/schemas lint"],
            "done": ["all x tests in api.test.ts pass", "export type X = z.infer<typeof x>;"],
            "budget": {"attempts": 4, "toolCalls": 20, "minutes": 6}}
    base.update(kw)
    return base


def problems(**kw):
    return quality_problems(card(**kw), exists=lambda p: True, packages={"@pilla/schemas"})


class CardQualityTest(unittest.TestCase):
    def assertFlag(self, text, **kw):
        found = problems(**kw)
        self.assertTrue(any(text in p for p in found), f"{text!r} not in {found}")

    def test_good_card_is_clean(self):
        self.assertEqual(problems(), [])

    def test_unknown_fields_are_not_silently_ignored(self):
        self.assertFlag("campo desconhecido 'readfirst'", readfirst=[])
        self.assertFlag("budget.calls desconhecido", budget={"calls": 3})

    def test_done_literal_must_be_code_only(self):  # LI-051, the E2-T24 card as first written
        self.assertFlag("'export function' no done", done=[
            "x.ts exports: export function total(a: readonly A[]): number (the reduce of today), with export type A = z.infer<typeof a>;"])
        self.assertFlag("código e texto misturados", done=["export type A = the type inferred from the schema of this file;"])
        self.assertEqual(problems(done=['import { idSchema, isoDateSchema } from "../../common"; never write a new regex']), [])

    def test_done_is_the_result_not_the_editing_technique(self):
        self.assertFlag("técnica de edição no done ('edit_file')", done=["one edit_file call; the file stays under 25 lines"])
        self.assertEqual(problems(hints=["one edit_file call"]), [])

    def test_files_named_in_done_must_be_given_to_the_model(self):  # LI-024, LI-030
        self.assertFlag("o done cita _modelo.md", done=["<= 300 words following _modelo.md"])
        self.assertFlag("o done cita docs/glossario.md", done=["names match docs/glossario.md"])
        self.assertEqual(problems(done=["names match docs/glossario.md"], readFirst=["docs/glossario.md"]), [])

    def test_rule_ids_in_the_text_must_be_injected(self):  # LI-004
        self.assertFlag("fora de rules", done=["rounds half-up once (T-03)"])
        self.assertEqual(problems(done=["rounds half-up once (T-03)"], rules=["T-03"]), [])

    def test_checks_run_without_a_shell_and_must_explain_failures(self):
        self.assertFlag("sintaxe de shell", checks=card()["checks"] + ["grep -q x a.ts && echo ok"])
        self.assertFlag("'node -e' sem mensagem", checks=card()["checks"] + ['node -e "process.exit(1)"'], budget={"toolCalls": 30})
        self.assertFlag("pacote @pilla/schema, que não existe", checks=[c.replace("schemas ", "schema ") for c in card()["checks"]])

    def test_typescript_card_needs_test_typecheck_and_lint(self):  # LI-054, LI-025
        self.assertFlag("sem check de lint", checks=card()["checks"][:2])
        self.assertFlag("sem check de typecheck", checks=[card()["checks"][0], card()["checks"][2]])
        self.assertFlag("implement sem check de teste", checks=card()["checks"][1:])

    def test_budget_must_fit_the_checks(self):  # E2-T24: 5 checks, 23 calls, budget 20
        five = card()["checks"] + ["node scripts/a.mjs", "node scripts/b.mjs"]
        self.assertEqual(min_tool_calls(card(checks=five)), 23)
        self.assertFlag("budget.toolCalls 20 < 23", checks=five)

    def test_missing_files_and_globs(self):
        missing = quality_problems(card(), exists=lambda p: False, producible={"packages/schemas/src/common.ts"}, packages={"@pilla/schemas"})
        self.assertTrue(any("protectedTests cita" in p for p in missing))
        self.assertFalse(any("readFirst cita" in p for p in missing))
        self.assertFlag("curinga", allowedPaths=["packages/schemas/src/**"])

    def test_checklist_items_point_at_real_checks(self):  # LI-053
        review = dict(kind="pre-review", allowedPaths=[], protectedTests=[], done=["one line per item"],
                      checks=["pnpm --filter @pilla/schemas test"])
        self.assertFlag("run_check 2, que não existe", checklist=["C1 exported; run_check 2 proves it"], **review)
        self.assertFlag("chave repetida", checklist=["C1 a", "C1 b"], **review)
        self.assertEqual(problems(checklist=["C1 exported; run_check 0 proves it"], **review), [])

    def test_text_rules_apply_only_to_the_local_model(self):
        self.assertEqual(problems(assignee="claude", done=["follow travas.md; one edit_file call"]), [])

    def test_hint_never_carries_the_solution(self):  # e4-guardrails C, the E4-T02 card as first written
        self.assertFlag("hint com fórmula", hints=["check digit n: sum of digit i times (n + 1 - i), then (sum * 10) % 11 % 10"])
        self.assertFlag("hint com fórmula", hints=['partial index: uniqueIndex("x").on(t.cpf)'])
        self.assertEqual(problems(hints=["a plain object is one whose prototype is Object.prototype or null (Object.getPrototypeOf)",
                                         "use it.each for the list of sensitive keys"]), [])

    def test_whole_write_file_must_fit_the_output(self):  # e4-guardrails C: limit derived from the card
        lines = lambda n: (lambda path: n)
        whole = ["one write_file of the whole file, then run_check 0, 1 and 2"]
        found = quality_problems(card(hints=whole), exists=lambda p: True, packages={"@pilla/schemas"}, line_count=lines(400))
        self.assertTrue(any("~400 linhas; cabem 341" in p for p in found), found)
        self.assertEqual(quality_problems(card(hints=whole), exists=lambda p: True, packages={"@pilla/schemas"}, line_count=lines(120)), [])
        small = quality_problems(card(hints=whole, maxOutputTokens=2048), exists=lambda p: True, packages={"@pilla/schemas"}, line_count=lines(120))
        self.assertTrue(any("cabem 85" in p for p in small), small)
        self.assertFlag("sem tamanho previsto", hints=whole)
        self.assertEqual(problems(hints=whole, sizeNote="uma função; ~60 linhas"), [])
        self.assertFlag("~500 linhas", hints=whole, sizeNote="500 linhas")


if __name__ == "__main__":
    unittest.main()
