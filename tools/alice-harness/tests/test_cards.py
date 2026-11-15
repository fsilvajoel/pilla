"""Spec for cards.py: validate a delivery plan (docs/plano/E*.yaml) before any card runs."""
import unittest

from cards import validate_plan


def card(**kw):
    base = {"id": "E1-T01", "title": "Implement splitEvenly", "kind": "implement", "assignee": "alice",
            "rules": ["T-01"], "allowedPaths": ["packages/finance/src/split.ts"],
            "protectedTests": ["packages/finance/src/split.test.ts"],
            "checks": ["pnpm --filter @pilla/finance test -- split"], "done": ["T-01 passes"]}
    base.update(kw)
    return base


RULES = {"T-01", "T-02", "RN-C03"}


class CardsTest(unittest.TestCase):
    def check(self, cards, rules=RULES, external=()):
        return validate_plan({"delivery": "E1", "title": "Finance", "cards": cards}, rules, set(external))

    def test_valid_plan_has_no_problems(self):
        self.assertEqual(self.check([card(), card(id="E1-T02", dependsOn=["E1-T01"], rules=["T-02"])]), [])

    def test_top_level_requires_delivery_and_cards(self):
        self.assertTrue(validate_plan({"cards": []}, RULES, set()))
        self.assertTrue(validate_plan({"delivery": "E1"}, RULES, set()))

    def test_missing_required_field(self):
        c = card(); del c["checks"]
        self.assertTrue(any("E1-T01" in p and "checks" in p for p in self.check([c])))

    def test_empty_checks_or_done(self):
        self.assertTrue(self.check([card(checks=[])]))
        self.assertTrue(self.check([card(done=[])]))

    def test_id_format_and_uniqueness(self):
        self.assertTrue(self.check([card(id="T1")]))
        self.assertTrue(any("duplicado" in p for p in self.check([card(), card()])))

    def test_kind_and_assignee(self):
        self.assertTrue(self.check([card(kind="hack")]))
        self.assertTrue(self.check([card(assignee="bob")]))

    def test_unknown_rule_id(self):
        problems = self.check([card(rules=["RN-Z99"])])
        self.assertTrue(any("RN-Z99" in p for p in problems))

    def test_unknown_dependency_unless_external(self):
        self.assertTrue(self.check([card(dependsOn=["E0-T09"])]))
        self.assertEqual(self.check([card(dependsOn=["E0-T09"])], external=["E0-T09"]), [])

    def test_dependency_cycle(self):
        problems = self.check([card(dependsOn=["E1-T02"]), card(id="E1-T02", dependsOn=["E1-T01"])])
        self.assertTrue(any("ciclo" in p for p in problems))

    def test_alice_implement_requires_protected_tests(self):
        self.assertTrue(self.check([card(protectedTests=[])]))
        self.assertEqual(self.check([card(assignee="claude", protectedTests=[])]), [])

    def test_allowed_paths_cannot_include_protected_tests(self):
        c = card(allowedPaths=["packages/finance/src/split.ts", "packages/finance/src/split.test.ts"])
        self.assertTrue(any("protegido" in p for p in self.check([c])))

    def test_empty_allowed_paths_only_for_pre_review(self):
        self.assertTrue(self.check([card(allowedPaths=[])]))
        self.assertEqual(self.check([card(kind="pre-review", allowedPaths=[], protectedTests=[], checklist=["C1 x"])]), [])

    def test_budget_limits(self):
        self.assertTrue(self.check([card(budget={"attempts": 9, "toolCalls": 25})]))
        self.assertTrue(self.check([card(budget={"attempts": 3, "toolCalls": 99})]))
        self.assertEqual(self.check([card(budget={"attempts": 5, "toolCalls": 30})]), [])
        self.assertTrue(self.check([card(budget={"attempts": 5, "toolCalls": 31})]))

    def test_time_budget_limit(self):
        self.assertEqual(self.check([card(budget={"attempts": 5, "toolCalls": 30, "minutes": 10})]), [])
        self.assertTrue(self.check([card(budget={"attempts": 5, "toolCalls": 30, "minutes": 16})]))

    def test_alice_tasks_stay_small(self):
        three = ["packages/finance/src/a.ts", "packages/finance/src/b.ts", "packages/finance/src/c.ts"]
        self.assertTrue(any("pequen" in p for p in self.check([card(allowedPaths=three)])))
        self.assertEqual(self.check([card(assignee="claude", allowedPaths=three, protectedTests=[])]), [])

    def test_pre_review_requires_checklist(self):
        c = card(kind="pre-review", allowedPaths=[], protectedTests=[])
        self.assertTrue(any("checklist" in p for p in self.check([c])))
        self.assertEqual(self.check([card(kind="pre-review", allowedPaths=[], protectedTests=[], checklist=["C1 lint"])]), [])

    def test_reuse_needs_its_import_line(self):  # LI-030
        bad = self.check([card(done=["allocations (reuse allocationSchema, min 1)"])])
        self.assertTrue(any("LI-030" in x for x in bad))
        ok = card(done=["reuse allocationSchema", 'import { allocationSchema } from "./payment-confirmed"'])
        self.assertEqual(self.check([ok]), [])

    def test_research_needs_a_good_reason(self):
        base = dict(kind="research", protectedTests=[], allowedPaths=["docs/pesquisa/pix.md"], rules=[])
        bad = self.check([card(**base)])
        self.assertEqual(len([x for x in bad if "research" in x]), 3)
        good = card(**base, question="Qual o limite do Pix noturno?",
                    why={"category": "regulation", "reason": "regra do Banco Central; não está nos docs e muda o limite RN-X"})
        self.assertEqual(self.check([good]), [])
        self.assertTrue(self.check([card(**{**base, "allowedPaths": ["src/x.ts"]}, question="q",
                                          why={"category": "regulation", "reason": "x" * 40})]))


if __name__ == "__main__":
    unittest.main()
