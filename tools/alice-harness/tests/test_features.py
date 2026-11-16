"""Spec do bloco `features:` do plano (ADR-0014): validação antes de gastar qualquer requisição."""
import unittest

from cards import feature_problems, plan_scenarios

PLANO = """# Plano
## Escopo
x
## Riscos
x
## Dependências
x
## Critérios de aceite
- A1: y
## Cenários
- C1: chave sensível vira REDACTED
- C2: entrada não muda
"""
TEST = {"id": "E9-T01", "kind": "test-author", "assignee": "bia", "allowedPaths": ["a.test.ts"]}
IMPL = {"id": "E9-T02", "kind": "implement", "assignee": "alice", "allowedPaths": ["a.ts"], "protectedTests": ["a.test.ts"]}


def plan(**feat: object) -> dict:
    return {"cards": [TEST, IMPL], "features": [{"id": "E9-F01", "title": "t", "cards": ["E9-T01", "E9-T02"], "biaBudget": 4, **feat}]}


class FeatureProblemsTest(unittest.TestCase):
    def test_good_feature_has_no_problem(self):
        self.assertEqual(feature_problems(plan(), lambda p: PLANO), [])

    def test_plan_without_features_is_untouched(self):
        self.assertEqual(feature_problems({"cards": [TEST]}, lambda p: None), [])

    def test_missing_plan_md(self):
        self.assertIn("falta docs/plano/E9-F01/plano.md", " ".join(feature_problems(plan(), lambda p: None)))

    def test_missing_section_and_scenarios(self):
        got = " ".join(feature_problems(plan(), lambda p: "## Escopo\n## Cenários\nnada\n"))
        self.assertIn("'## Riscos'", got)
        self.assertIn("- C<n>", got)

    def test_budget_bounds(self):
        self.assertTrue(feature_problems(plan(biaBudget=10), lambda p: PLANO))
        self.assertTrue(feature_problems(plan(biaBudget="4"), lambda p: PLANO))

    def test_test_author_must_be_bia_and_cover_protected_tests(self):
        p = plan()
        p["cards"] = [{**TEST, "assignee": "alice"}, {**IMPL, "protectedTests": ["b.test.ts"]}]
        got = " ".join(feature_problems(p, lambda x: PLANO))
        self.assertIn("assignee bia", got)
        self.assertIn("b.test.ts", got)

    def test_unknown_card_field_and_double_owner(self):
        p = plan(extra=1)
        p["features"].append({"id": "E9-F02", "title": "u", "cards": ["E9-T01", "E8-T01"], "biaBudget": 2})
        got = " ".join(feature_problems(p, lambda x: PLANO))
        self.assertIn("campo desconhecido 'extra'", got)
        self.assertIn("já é da feature E9-F01", got)
        self.assertIn("E8-T01 não está", got)

    def test_scenarios_are_parsed(self):
        self.assertEqual([c for c, _ in plan_scenarios(PLANO)], ["C1", "C2"])


if __name__ == "__main__":
    unittest.main()
