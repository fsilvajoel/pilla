"""Spec do laço automático do plan-run (E4-T03: 10 rodadas orquestradas à mão; 330 turnos do Claude).
Alice e Bia são dublês: nada de rede nem GPU."""
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import bia
from alice import PlanOps, plan_run, run_card
from cards import validate_plan
from retro import write_retro
from review import signer_problems

TEST_CARD = {"id": "X-T1", "kind": "test-author", "assignee": "alice", "allowedPaths": ["a.test.ts"], "done": ["d"]}
IMPL_CARD = {"id": "X-T2", "kind": "implement", "assignee": "alice", "allowedPaths": ["a.ts"], "dependsOn": ["X-T1"]}


class FakeOps(PlanOps):
    def __init__(self, reviews: list[int], write_codes: list[int] | None = None, quota: int | None = 40) -> None:
        self.reviews, self.write_codes, self.quota = list(reviews), list(write_codes or []), quota
        self.calls: list[str] = []
        self.counter = {"aliceIn": 0, "aliceOut": 0, "biaIn": 0, "biaOut": 0, "biaRequests": 0}

    def alice_run(self, card: dict, repo: Path) -> dict:
        self.calls.append(f"alice:{card['id']}")
        return {"exit": 0, "status": "done", "aliceTokens": {"prompt": 100, "output": 10}}

    def bia_write(self, card: dict, repo: Path) -> int:
        self.calls.append(f"bia-write:{card['id']}")
        self.counter["biaRequests"] += 1
        self.counter["biaIn"] += 50
        return self.write_codes.pop(0) if self.write_codes else 0

    def bia_review(self, card: dict, repo: Path) -> int:
        self.calls.append(f"bia-review:{card['id']}")
        self.counter["biaRequests"] += 1
        return self.reviews.pop(0)

    def local_gate(self, card: dict, repo: Path) -> int:
        self.calls.append(f"gate:{card['id']}")
        self.counter["aliceIn"] += 7
        return self.reviews.pop(0)

    def review_problems(self, card: dict, repo: Path) -> list[str]:
        return []

    def quota_left(self, repo: Path) -> int | None:
        return self.quota

    def reserve(self) -> int:
        return 5

    def usage(self) -> dict[str, int]:
        return dict(self.counter)


def write_notes(repo: Path, cid: str) -> None:
    f = repo / "docs/plano/revisao" / f"{cid}.md"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text("# Revisão\n\n## Problemas\n- linha 12 (regra 5): falta o caso `ownerCpf`\n")


class PlanRunLoopTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_rejected_then_approved_runs_a_second_round(self):
        ops = FakeOps(reviews=[2, 0])
        rec = run_card(TEST_CARD, self.repo, 3, ops)
        self.assertEqual(rec["status"], "done")
        self.assertEqual([r["review"] for r in rec["rounds"]], ["reprovado", "aprovado"])
        self.assertEqual(ops.calls, ["alice:X-T1", "bia-review:X-T1"] * 2)
        self.assertEqual(rec["aliceTokens"], {"prompt": 200, "output": 20})
        self.assertEqual(rec["bia"]["requests"], 2)

    def test_rounds_exhausted_escalate_with_last_notes_and_skip_dependents(self):
        write_notes(self.repo, "X-T1")
        ops = FakeOps(reviews=[2, 2, 2])
        results = plan_run({"X-T1": TEST_CARD, "X-T2": IMPL_CARD}, ["X-T1", "X-T2"], self.repo, 3, ops)
        self.assertEqual(results[0]["status"], "escalated")
        self.assertEqual(len(results[0]["rounds"]), 3)
        self.assertIn("ownerCpf", results[0]["lastNotes"][0])
        self.assertEqual(results[1]["status"], "skipped (dependência falhou)")
        self.assertNotIn("alice:X-T2", ops.calls)

    def test_approved_test_lets_the_implement_card_run(self):
        ops = FakeOps(reviews=[0])
        results = plan_run({"X-T1": TEST_CARD, "X-T2": IMPL_CARD}, ["X-T1", "X-T2"], self.repo, 3, ops)
        self.assertEqual([r["status"] for r in results], ["done", "done"])
        self.assertEqual(len(results[1]["rounds"]), 1)

    def test_bia_writer_is_gated_locally_never_by_bia_review(self):
        card = {**TEST_CARD, "assignee": "bia"}
        ops = FakeOps(reviews=[2, 0])
        rec = run_card(card, self.repo, 3, ops)
        self.assertEqual(rec["status"], "done")
        self.assertEqual(ops.calls, ["bia-write:X-T1", "gate:X-T1"] * 2)
        self.assertEqual(rec["rounds"][0]["biaRequests"], 1)
        self.assertEqual(rec["rounds"][0]["aliceIn"], 7)

    def test_bia_write_with_red_checks_is_a_new_round_without_review(self):
        card = {**TEST_CARD, "assignee": "bia"}
        ops = FakeOps(reviews=[0], write_codes=[2, 0])
        rec = run_card(card, self.repo, 3, ops)
        self.assertEqual([r["exec"] for r in rec["rounds"]], ["failed", "done"])
        self.assertEqual(ops.calls.count("gate:X-T1"), 1)

    def test_quota_in_reserve_stops_the_whole_queue(self):
        ops = FakeOps(reviews=[], quota=5)
        results = plan_run({"X-T1": TEST_CARD, "X-T2": IMPL_CARD}, ["X-T1", "X-T2"], self.repo, 3, ops)
        self.assertEqual(results[0]["status"], "quota")
        self.assertEqual(results[1]["status"], "skipped (cota da Bia na reserva)")
        self.assertEqual(ops.calls, [])

    def test_quota_hit_during_review_stops_without_more_rounds(self):
        ops = FakeOps(reviews=[4])
        rec = run_card(TEST_CARD, self.repo, 3, ops)
        self.assertEqual((rec["status"], len(rec["rounds"])), ("quota", 1))

    def test_claude_cards_are_skipped(self):
        ops = FakeOps(reviews=[])
        results = plan_run({"X-T1": {**TEST_CARD, "assignee": "claude"}}, ["X-T1"], self.repo, 3, ops)
        self.assertEqual(results[0]["status"], "skipped (assignee claude)")


class EscalatedRetroTest(unittest.TestCase):
    def test_retro_shows_rounds_tokens_and_last_notes(self):
        rec = {"task": "X-T1", "assignee": "alice", "status": "escalated", "lastNotes": ["- linha 12 (regra 5): falta `ownerCpf`"],
               "rounds": [{"n": i, "writer": "alice", "exec": "done", "review": "reprovado", "seconds": 30,
                           "aliceIn": 1000 * i, "aliceOut": 10, "biaIn": 0, "biaOut": 0, "biaRequests": 1} for i in (1, 2, 3)]}
        with tempfile.TemporaryDirectory() as d:
            text = write_retro([rec], Path(d), Path(d) / "retro.md")
        self.assertIn("## Rodadas de X-T1 (alice): escalated", text)
        self.assertIn("| 3 | alice | done | reprovado | 30 | 3000/10 | 0/0 | 1 |", text)
        self.assertIn("Escalado ao Claude depois de 3 rodadas", text)
        self.assertIn("falta `ownerCpf`", text)


class AssigneeBiaTest(unittest.TestCase):
    def problems(self, kind: str) -> list[str]:
        card = {"id": "X-T1", "title": "t", "kind": kind, "assignee": "bia", "allowedPaths": ["a.test.ts"], "checks": ["true"], "done": ["d"]}
        return [p for p in validate_plan({"delivery": "X", "cards": [card]}, set(), set()) if "assignee" in p]

    def test_bia_only_in_test_author(self):
        self.assertEqual(self.problems("test-author"), [])
        self.assertTrue(self.problems("implement"))

    def test_writer_is_never_the_final_gate(self):
        self.assertTrue(signer_problems("X", "bia", "bia"))
        self.assertTrue(signer_problems("X", "alice-local", "alice"))
        self.assertEqual(signer_problems("X", "alice-local", "bia"), [])
        self.assertEqual(signer_problems("X", "bia", "alice"), [])

    def test_bia_does_not_review_her_own_test(self):
        with mock.patch.object(bia, "test_input") as ti:
            self.assertEqual(bia.review_test(Path("."), {**TEST_CARD, "assignee": "bia"}, "m", "bia"), 3)
            ti.assert_not_called()


class LocalGateTest(unittest.TestCase):
    def run_gate(self, verdicts: list[dict]) -> tuple[int, str]:
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            ti = bia.TestInput("a.test.ts", "src", "f" * 40, [(1, "d")], "pedido")
            with mock.patch.object(bia, "test_input", return_value=ti), \
                    mock.patch.object(bia, "local_verdict", side_effect=verdicts), \
                    mock.patch.object(bia, "save_raw", return_value="local-X"), \
                    mock.patch("builtins.print"):
                code = bia.local_gate(repo, {**TEST_CARD, "assignee": "bia"})
            return code, (repo / "docs/plano/revisao/X-T1.md").read_text()

    def test_two_approvals_sign_as_alice_local(self):
        ok = {"veredito": "aprovado", "itens": [{"n": 1, "ok": True, "onde": "it 'x' linha 3"}], "problemas": []}
        code, text = self.run_gate([ok, ok])
        self.assertEqual(code, 0)
        self.assertIn("revisor: alice-local", text)
        self.assertIn("- [x] d — it 'x' linha 3", text)

    def test_same_line_twice_rejects(self):
        bad = {"veredito": "reprovado", "problemas": [{"linha": 4, "regra": 2, "explicacao": "vazio"}]}
        code, text = self.run_gate([bad, bad])
        self.assertEqual(code, 2)
        self.assertIn("pré-revisão local", text)

    def test_unavailable_is_not_approval(self):
        with mock.patch.object(bia, "test_input", return_value=bia.TestInput("a", "s", None, [], "p")), \
                mock.patch.object(bia, "local_verdict", return_value=None), mock.patch("builtins.print"):
            self.assertEqual(bia.local_gate(Path("."), {**TEST_CARD, "assignee": "bia"}), 3)


if __name__ == "__main__":
    unittest.main()
