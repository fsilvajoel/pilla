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
    return {"cards": [TEST, IMPL], "features": [{"id": "E9-F01", "title": "t", "cards": ["E9-T01", "E9-T02"], "biaBudget": 3, **feat}]}


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
        self.assertEqual(feature_problems(plan(biaBudget=3), lambda p: PLANO), [])
        for budget in (1, 4, 6, 10, "4"):
            self.assertTrue(feature_problems(plan(biaBudget=budget), lambda p: PLANO), budget)

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


import json
import subprocess
import tempfile
from pathlib import Path
from unittest import mock

import review
from alice import protected_test_problems


class AuditSignatureTest(unittest.TestCase):
    """A Bia escreve e audita o teste da feature: a assinatura só vale com números mecânicos (ADR-0014)."""

    def problems(self, meta: dict) -> list[str]:
        with tempfile.TemporaryDirectory() as d:
            raw = Path(d)
            (raw / "aud-1.json").write_text(json.dumps({"card": "E9-T01", "task": "test", "path": "a.test.ts", "sha": "f" * 40, **meta}))
            text = f"revisor: auditoria-bia m aud-1\narquivo: a.test.ts {'f' * 40}\n"
            with mock.patch.object(review, "RAW_DIR", raw):
                return review.signature_problems("E9-T01", text, {"a.test.ts": "f" * 40})

    def test_with_mechanical_numbers_it_is_valid(self):
        self.assertEqual(self.problems({"feature": "E9-F01", "writer": "bia", "mechanical": {"expectRed": True, "checksGreen": True}}), [])

    def test_without_feature_or_numbers_it_is_refused(self):
        self.assertTrue(self.problems({"writer": "bia", "mechanical": {"expectRed": True, "checksGreen": True}}))
        self.assertTrue(self.problems({"feature": "E9-F01", "writer": "bia", "mechanical": {"expectRed": False, "checksGreen": True}}))

    def test_plain_bia_still_cannot_sign_her_own_test(self):
        with tempfile.TemporaryDirectory() as d:
            raw = Path(d)
            (raw / "r.json").write_text(json.dumps({"card": "E9-T01", "task": "test", "path": "a.test.ts", "sha": "f" * 40, "writer": "bia"}))
            with mock.patch.object(review, "RAW_DIR", raw):
                got = review.signature_problems("E9-T01", "revisor: bia m r\n", {"a.test.ts": "f" * 40})
        self.assertTrue(got)


class FeatureTestsPreflightTest(unittest.TestCase):
    """O implement da feature roda antes do commit do teste: vale só o sha gravado na etapa de testes."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)
        (self.repo / "a.test.ts").write_text("it('x', () => {});\n")
        self.sha = review.blob_sha(self.repo, "a.test.ts", "worktree")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_uncommitted_test_is_refused_without_feature(self):
        got = protected_test_problems({"protectedTests": ["a.test.ts"]}, self.repo)
        self.assertIn("não está commitado", " ".join(got))

    def test_feature_sha_is_accepted(self):
        self.assertEqual(protected_test_problems({"protectedTests": ["a.test.ts"], "featureTests": {"a.test.ts": self.sha}}, self.repo), [])

    def test_changed_after_tests_stage_is_refused(self):
        got = protected_test_problems({"protectedTests": ["a.test.ts"], "featureTests": {"a.test.ts": "0" * 40}}, self.repo)
        self.assertIn("mudou depois", " ".join(got))
