"""Exceção nao-compensa-alice (Joel, 17/11): a Bia implementa um cartão aprovado. Sem os três campos, bia +
implement continua recusado; com eles, o implement conta cada requisição no biaBudget da feature e para
como escalated quando o orçamento acaba (nunca estoura). Sem rede nem GPU."""
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import bia
from alice import PlanOps, plan_run, run_card
from cards import bia_impl_exception, feature_problems, validate_plan
from feature import Orchestrator
from test_feature_orchestrator import IMPL, PLANO, TEST, FakeOps as FeatureFake, tests_json

EXC = {"exception": "nao-compensa-alice", "exceptionReason": "estourou 20 toolCalls 2x mesmo refatiado",
       "exceptionApprovedBy": "Joel 2026-11-17"}


def card(**extra: object) -> dict:
    return {"id": "X-T2", "title": "t", "kind": "implement", "assignee": "bia", "allowedPaths": ["a.ts"],
            "protectedTests": ["a.test.ts"], "checks": ["true"], "done": ["d"], **extra}


class CardRuleTest(unittest.TestCase):
    def problems(self, c: dict) -> list[str]:
        return [p for p in validate_plan({"delivery": "X", "cards": [c]}, set(), set()) if "assignee" in p]

    def test_bia_implement_without_exception_is_refused(self):
        self.assertTrue(self.problems(card()))
        self.assertTrue(self.problems(card(exception="nao-compensa-alice")))
        self.assertTrue(self.problems(card(**{**EXC, "exceptionReason": " "})))
        self.assertTrue(self.problems(card(**{**EXC, "exceptionApprovedBy": "Claude 2026-11-17"})))
        self.assertTrue(self.problems(card(**{**EXC, "exception": "outra"})))

    def test_bia_implement_with_exception_is_accepted(self):
        self.assertTrue(bia_impl_exception(card(**EXC)))
        self.assertEqual(self.problems(card(**EXC)), [])
        unknown = [p for p in validate_plan({"delivery": "X", "cards": [card(**EXC)]}, set(), set()) if "desconhecido" in p]
        self.assertEqual(unknown, [])

    def test_exception_does_not_open_other_kinds(self):
        self.assertTrue(self.problems(card(**EXC, kind="docs")))

    def test_feature_accepts_bia_implement_only_with_exception(self):
        def plan(impl: dict) -> dict:
            return {"cards": [TEST, impl], "features": [{"id": "E9-F01", "title": "f", "cards": ["E9-T01", "E9-T02"], "biaBudget": 3}]}
        self.assertEqual(feature_problems(plan({**IMPL, "assignee": "bia", **EXC}), lambda p: PLANO), [])
        self.assertIn("precisa de assignee alice", " ".join(feature_problems(plan({**IMPL, "assignee": "bia"}), lambda p: PLANO)))


class ImplOps(PlanOps):
    """Dublê: cada chamada de bia_implement gasta `cost` requisições (até o teto) e devolve `code`."""

    def __init__(self, code: int = 0, cost: int = 1, repo: Path | None = None) -> None:
        self.code, self.cost, self.repo = code, cost, repo
        self.counter = {"aliceIn": 0, "aliceOut": 0, "biaIn": 0, "biaOut": 0, "biaRequests": 0}
        self.caps: list[int | None] = []

    def bia_implement(self, card: dict, repo: Path, cap: int | None) -> int:
        self.caps.append(cap)
        spend = self.cost if cap is None else min(self.cost, cap)
        self.counter["biaRequests"] += spend
        if self.repo is not None and self.code == 0:
            (self.repo / "a.ts").write_text("impl\n")
        return self.code if spend == self.cost else 6

    def alice_run(self, card: dict, repo: Path) -> dict:
        raise AssertionError("cartão da Bia não vai para a Alice")

    def bia_review(self, card: dict, repo: Path) -> int:
        raise AssertionError("a Bia não revisa o próprio código")

    def local_gate(self, card: dict, repo: Path) -> int:
        raise AssertionError("implement não passa pelo portão de teste")

    def quota_left(self, repo: Path) -> int | None:
        return 40

    def reserve(self) -> int:
        return 5

    def usage(self) -> dict[str, int]:
        return dict(self.counter)


class RunCardTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_implement_with_writer_bia_runs_and_counts_requests(self):
        ops = ImplOps(code=0, cost=2)
        rec = run_card(card(**EXC, biaCap=5), self.repo, 3, ops)
        self.assertEqual(rec["status"], "done")
        self.assertEqual(rec["bia"]["requests"], 2)
        self.assertEqual(ops.caps, [5])
        self.assertEqual(rec["rounds"][0]["review"], "-")

    def test_exhausted_budget_is_escalated_without_calling(self):
        ops = ImplOps()
        rec = run_card(card(**EXC, biaCap=0), self.repo, 3, ops)
        self.assertEqual(rec["status"], "escalated")
        self.assertEqual(ops.caps, [])
        self.assertIn("orçamento", rec["message"])

    def test_budget_running_out_mid_card_is_escalated(self):
        ops = ImplOps(cost=3)
        rec = run_card(card(**EXC, biaCap=2), self.repo, 3, ops)
        self.assertEqual(rec["status"], "escalated")
        self.assertEqual(rec["bia"]["requests"], 2)

    def test_plan_run_discounts_previous_cards_from_the_cap(self):
        ops = ImplOps(cost=2)
        cards = {"X-T2": card(**EXC, biaCap=3), "X-T3": card(**EXC, id="X-T3", biaCap=3)}
        res = plan_run(cards, ["X-T2", "X-T3"], self.repo, 3, ops)
        self.assertEqual([r["status"] for r in res], ["done", "escalated"])
        self.assertEqual(ops.caps, [3, 1])
        self.assertEqual(sum(r["bia"]["requests"] for r in res), 3)


class WriteImplTest(unittest.TestCase):
    """write_impl de verdade com o chat da Bia como dublê: só escreve allowedPaths, checks são o portão."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name) / "repo"
        self.repo.mkdir()
        (self.repo / "a.test.ts").write_text("it('x', () => {});\n")
        (self.repo / "a.ts").write_text("throw\n")
        self.card = card(**EXC, checks=["grep -q impl a.ts"], keepWorktree=True)
        raw = Path(self.tmp.name) / "raw"
        for p in (mock.patch.object(bia, "RAW_DIR", raw), mock.patch.object(bia, "api_key", lambda r: "k"),
                  mock.patch.object(bia, "format_touched", lambda r, f: None)):
            p.start()
            self.addCleanup(p.stop)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def fake_chat(self, replies: list[str], fail: int = 0):
        def chat(messages, model, key, timeout=900, tries=3):
            self.tries.append(tries)
            for _ in range(min(fail, tries)):
                bia.USAGE["biaRequests"] += 1
            if fail:
                raise RuntimeError("OpenRouter falhou")
            bia.USAGE["biaRequests"] += 1
            return {"choices": [{"message": {"content": replies.pop(0)}}]}
        self.tries: list[int] = []
        return mock.patch.object(bia, "chat", chat)

    def test_writes_allowed_file_until_checks_are_green(self):
        replies = ["FILE: b.ts\n```ts\nimpl\n```", "FILE: a.ts\n```ts\nainda não\n```", "FILE: a.ts\n```ts\nimpl\n```"]
        start = bia.USAGE["biaRequests"]
        with self.fake_chat(replies):
            self.assertEqual(bia.write_impl(self.repo, self.card, "m", 3, 5), 0)
        self.assertEqual((self.repo / "a.ts").read_text(), "impl\n")
        self.assertFalse((self.repo / "b.ts").exists())
        self.assertEqual(bia.USAGE["biaRequests"] - start, 3)

    def test_never_spends_past_max_requests(self):
        start = bia.USAGE["biaRequests"]
        with self.fake_chat(["FILE: a.ts\n```ts\nnão\n```"] * 3):
            self.assertEqual(bia.write_impl(self.repo, self.card, "m", 3, 2), 6)
        self.assertEqual(bia.USAGE["biaRequests"] - start, 2)
        self.assertEqual(self.tries, [2, 1])

    def test_failed_retries_are_capped_by_the_budget(self):
        start = bia.USAGE["biaRequests"]
        with self.fake_chat([], fail=3):
            self.assertEqual(bia.write_impl(self.repo, self.card, "m", 3, 2), 6)
        self.assertEqual(bia.USAGE["biaRequests"] - start, 2)

    def test_card_error_before_spending(self):
        (self.repo / "a.ts").write_text("impl\n")  # check já verde: LI-025
        with self.fake_chat([]):
            self.assertEqual(bia.write_impl(self.repo, self.card, "m", 3, 2), 5)
        self.assertEqual(self.tries, [])


class FeatureBiaImplementTest(unittest.TestCase):
    """O orquestrador passa o que resta do biaBudget e soma o gasto no estado da feature."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name) / "repo"
        self.out = Path(self.tmp.name) / "out"
        self.out.mkdir()
        (self.repo / "docs" / "plano" / "E9-F01").mkdir(parents=True)
        (self.repo / "docs" / "plano" / "E9-F01" / "plano.md").write_text(PLANO)
        (self.repo / "a.ts").write_text("throw\n")
        for args in (["init", "-q"], ["add", "."], ["-c", "user.email=x@x", "-c", "user.name=x", "commit", "-qm", "init"]):
            subprocess.run(["git", *args], cwd=self.repo, check=True)
        self.plan = {"cards": [TEST, {**IMPL, "assignee": "bia", **EXC}],
                     "features": [{"id": "E9-F01", "title": "f", "cards": ["E9-T01", "E9-T02"], "biaBudget": 3}]}

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def orc(self, impl: ImplOps) -> Orchestrator:
        repo = self.repo

        class Ops(FeatureFake):
            def plan_run(self, cards, ids, rounds):
                self.runs.append(cards)
                return plan_run(cards, ids, repo, rounds, impl)
        return Orchestrator(self.repo, self.plan, "E9-F01", Ops(self.repo, [tests_json()]), self.out)

    def test_implement_by_bia_charges_the_feature_budget(self):
        impl = ImplOps(code=0, cost=1, repo=self.repo)
        orc = self.orc(impl)
        self.assertEqual(orc.run("tests", 3), ["tests: done"])
        self.assertEqual(orc.state["biaRequests"], 1)
        self.assertEqual(orc.run("implement", 3), ["implement: done"])
        self.assertEqual(impl.caps, [2])
        self.assertEqual(orc.state["biaRequests"], 2)
        self.assertEqual(orc.stage("implement")["biaRequests"], 1)
        self.assertIn("E9-T02", orc.stage("implement")["snapshots"])

    def test_exhausted_budget_escalates_and_rolls_back(self):
        impl = ImplOps(code=2, cost=5, repo=self.repo)
        orc = self.orc(impl)
        self.assertEqual(orc.run("tests", 3), ["tests: done"])
        (self.repo / "a.ts").write_text("partial\n")  # sobra que o checkpoint guarda e o rollback devolve
        self.assertEqual(orc.run("implement", 3), ["implement: escalated"])
        self.assertEqual(orc.state["biaRequests"], 3)  # 1 dos testes + 2 do implement: teto 3, nunca 4+
        self.assertEqual(orc.stage("implement")["cards"], {"E9-T02": "escalated"})
        self.assertEqual(impl.caps, [2])

    def test_budget_already_spent_does_not_call_bia(self):
        impl = ImplOps(code=0, repo=self.repo)
        orc = self.orc(impl)
        self.assertEqual(orc.run("tests", 3), ["tests: done"])
        orc.state["biaRequests"] = 3
        self.assertEqual(orc.run("implement", 3), ["implement: escalated"])
        self.assertEqual(impl.caps, [])
        self.assertEqual(orc.state["biaRequests"], 3)


if __name__ == "__main__":
    unittest.main()
