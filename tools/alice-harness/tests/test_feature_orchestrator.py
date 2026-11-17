"""Spec do orquestrador por feature (ADR-0014), sem rede nem GPU: Bia e Alice são dublês."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from feature import FeatureOps, Orchestrator, audit_schema_problems, cmd_feature, cmd_feature_accept, tests_schema_problems

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
TEST = {"id": "E9-T01", "kind": "test-author", "assignee": "bia", "title": "t", "allowedPaths": ["a.test.ts"],
        "readFirst": ["a.ts"], "done": ["linha um", "linha dois"], "checks": ["expect-red a.test.ts", "quality a.test.ts"]}
IMPL = {"id": "E9-T02", "kind": "implement", "assignee": "alice", "allowedPaths": ["a.ts"], "protectedTests": ["a.test.ts"],
        "dependsOn": ["E9-T01"], "done": ["passa"], "checks": ["vitest --coverage a.ts"]}
PLAN = {"cards": [TEST, IMPL], "features": [{"id": "E9-F01", "title": "f", "cards": ["E9-T01", "E9-T02"], "biaBudget": 3}]}


def tests_json(content: str = "good", scenarios: tuple[str, ...] = ("C1", "C2")) -> str:
    return json.dumps({"files": [{"path": "a.test.ts", "content": content}],
                       "scenarios": [{"id": c, "descricao": "d", "card": "E9-T01", "teste": "it"} for c in scenarios]})


def audit_json(verdict: str = "aprovado", extra: str = "") -> str:
    return json.dumps({"verdict": verdict, "gaps": [{"cenario": "C9", "explicacao": "falta"}] if extra else [],
                       "extraTests": [{"path": "a.test.ts", "content": extra}] if extra else [],
                       "itens": {"E9-T01": [{"n": 1, "ok": True, "onde": "it primeiro, linha 3"}, {"n": 2, "ok": True, "onde": "it segundo, linha 7"}]}})


class FakeOps(FeatureOps):
    """Checks pelo conteúdo: teste 'bad' reprova a qualidade; stub ('throw') deixa o expect-red verde; teste
    'extra' só passa com a implementação 'impl2'; a Alice escreve 'impl' e, na segunda vez, 'impl2'."""

    def __init__(self, repo: Path, replies: list[str], left: int | None = 40) -> None:
        self.repo, self.replies, self.left = repo, list(replies), left
        self.calls: list[list[dict]] = []
        self.runs: list[dict] = []
        self.reviews: list[tuple[str, str, bool]] = []

    def bia_chat(self, messages: list[dict]) -> dict:
        self.calls.append([dict(m) for m in messages])
        return {"id": f"gen-{len(self.calls)}", "choices": [{"message": {"content": self.replies.pop(0)}}]}

    def model(self) -> str:
        return "m"

    def quota_left(self) -> int | None:
        return self.left

    def reserve(self) -> int:
        return 5

    def usage(self) -> dict[str, int]:
        return {"biaIn": 10 * len(self.calls), "biaOut": len(self.calls)}

    def run_checks(self, card: dict) -> list[tuple[str, int, str]]:
        test = (self.repo / "a.test.ts").read_text() if (self.repo / "a.test.ts").is_file() else ""
        impl = (self.repo / "a.ts").read_text()
        out = []
        for c in card.get("checks") or []:
            if c.startswith("expect-red"):
                code = 0 if "throw" in impl else 1
            elif c.startswith("quality"):
                code = 1 if "bad" in test else 0
            else:
                code = 0 if "impl" in impl and ("extra" not in test or "impl2" in impl) else 1
            out.append((c, code, "All files | 90% (9/10)\n" if "--coverage" in c and code == 0 else f"saída de {c}"))
        return out

    def format(self, files: list[str]) -> None:
        pass

    def restore(self, card: dict, keep: Path) -> None:
        pass

    def plan_run(self, cards: dict[str, dict], ids: list[str], rounds: int) -> list[dict]:
        self.runs.append(cards)
        (self.repo / "a.ts").write_text("impl2\n" if len(self.runs) > 1 else "impl\n")
        return [{"task": i, "status": "done", "aliceTokens": {"prompt": 100, "output": 10}} for i in ids]

    def save_raw(self, data: dict, extra: dict) -> str:
        return str(data["id"])

    def write_review(self, card: dict, signer: str, path: str, sha: str, items: dict[int, dict], problems: list[dict], ok: bool) -> Path:
        self.reviews.append((card["id"], signer, ok))
        return self.repo / "r.md"

    def mechanical(self, line: str) -> str:
        return ""


class OrchestratorTest(unittest.TestCase):
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

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def orc(self, ops: FakeOps, plan: dict = PLAN) -> Orchestrator:
        return Orchestrator(self.repo, plan, "E9-F01", ops, self.out)

    def test_happy_path_spends_two_requests_and_writes_artifacts(self):
        ops = FakeOps(self.repo, [tests_json(), audit_json()])
        orc = self.orc(ops)
        self.assertEqual(orc.run("all", 3), ["plan: done", "tests: done", "implement: done", "audit: done", "review: ready"])
        self.assertEqual(orc.state["biaRequests"], 2)
        self.assertTrue(orc.state["expectRed"])
        sha = orc.state["testShas"]["a.test.ts"]
        self.assertEqual(ops.runs[0]["E9-T02"]["featureTests"], {"a.test.ts": sha})
        self.assertEqual(ops.reviews, [("E9-T01", "auditoria-bia m gen-2-E9-T01", True)])
        for f in ("testes.md", "auditoria.md", "revisao-final.md", "estado.json"):
            self.assertTrue((self.repo / "docs" / "plano" / "E9-F01" / f).is_file(), f)
        self.assertIn("2/3 requisições", (self.repo / "docs" / "plano" / "E9-F01" / "revisao-final.md").read_text())

    def test_tests_checks_see_head_stub_without_touching_index_or_implementation(self):
        (self.repo / "a.ts").write_text("staged\n")
        subprocess.run(["git", "add", "a.ts"], cwd=self.repo, check=True)
        (self.repo / "a.ts").write_text("impl\n")
        before = subprocess.check_output(["git", "show", ":a.ts"], cwd=self.repo)
        ops = FakeOps(self.repo, [tests_json()])
        orc = self.orc(ops)
        self.assertEqual(orc.run("tests", 3), ["tests: done"])
        self.assertEqual(len(ops.calls), 1)
        self.assertEqual((self.repo / "a.ts").read_text(), "impl\n")
        self.assertEqual(subprocess.check_output(["git", "show", ":a.ts"], cwd=self.repo), before)

    def test_tests_stub_git_error_does_not_approve(self):
        ops = FakeOps(self.repo, [tests_json()])
        orc = self.orc(ops)
        real_run = subprocess.run
        def fail_stub(args, **kwargs):
            if args[:2] == ["git", "show"] and args[2].startswith("HEAD:"):
                raise subprocess.CalledProcessError(1, args)
            return real_run(args, **kwargs)
        with mock.patch.object(orc, "prefix", return_value="contexto"), mock.patch("feature.subprocess.run", side_effect=fail_stub):
            self.assertEqual(orc.run("tests", 3), ["tests: error"])
        self.assertEqual((self.repo / "a.ts").read_text(), "throw\n")

    def test_prefix_is_identical_across_calls(self):
        ops = FakeOps(self.repo, [tests_json(), audit_json()])
        self.orc(ops).run("all", 3)
        a, b = ops.calls[0][0]["content"], ops.calls[1][0]["content"]
        cut = a.index("# ETAPA:")
        self.assertEqual(a[:cut], b[:cut])

    def test_qa_prompt_uses_existing_readfirst_types_on_initial_and_repair(self):
        schema = self.repo / "request-schema.ts"
        schema.write_text("export type Request = { count: number };\n")
        plan = {**PLAN, "cards": [{**TEST, "readFirst": ["request-schema.ts"]}, IMPL]}
        ops = FakeOps(self.repo, [tests_json("bad"), tests_json("good")])
        self.assertEqual(self.orc(ops, plan).run("tests", 3), ["tests: done"])
        for call in ops.calls:
            text = call[0]["content"]
            self.assertIn("count: number", text)
            self.assertIn("import type", text)
        self.assertIn("diagnósticos", ops.calls[1][-1]["content"])
        self.assertNotIn("tsconfig", self.orc(FakeOps(self.repo, []), PLAN).prefix())

    def test_out_of_schema_gets_one_retry(self):
        ops = FakeOps(self.repo, [tests_json(scenarios=("C1",)), tests_json(), audit_json()])
        orc = self.orc(ops)
        self.assertEqual(orc.run("tests", 3), ["tests: done"])
        self.assertEqual(orc.state["stages"]["tests"]["biaRequests"], 2)
        self.assertIn("C2", ops.calls[1][-1]["content"])

    def test_out_of_schema_twice_is_error_and_stops(self):
        ops = FakeOps(self.repo, ["não é json", "{}"])
        orc = self.orc(ops)
        out = orc.run("all", 3)
        self.assertEqual(out[-1], "tests: error")
        self.assertEqual(ops.runs, [])
        self.assertIn("fora do esquema", orc.state["stages"]["tests"]["message"])

    def test_shared_checks_fail_before_spending_bia_or_touching_tests(self):
        class SharedOps(FakeOps):
            def run_checks(self, card):
                if card.get("checks") == ["pnpm --filter @pilla/web typecheck"]:
                    return [(card["checks"][0], 1, "erro em teste alheio")]
                return super().run_checks(card)
        plan = {**PLAN, "cards": [{**TEST, "checks": ["expect-red a.test.ts", "quality a.test.ts",
                                                       "pnpm --filter @pilla/web typecheck"]}, IMPL]}
        ops = SharedOps(self.repo, [tests_json()])
        orc = self.orc(ops, plan)
        self.assertEqual(orc.run("tests", 3), ["tests: escalated"])
        self.assertEqual(ops.calls, [])
        self.assertEqual(orc.state["biaRequests"], 0)
        self.assertFalse((self.repo / "a.test.ts").exists())
        self.assertIn("typecheck", orc.stage("tests")["message"])

    def test_old_untracked_test_is_restored_before_shared_checks(self):
        (self.repo / "a.test.ts").write_text("rejeitado\n")
        plan = {**PLAN, "cards": [{**TEST, "checks": ["expect-red a.test.ts", "quality a.test.ts",
                                                       "pnpm --filter @pilla/web typecheck"]}, IMPL]}
        class SharedOps(FakeOps):
            def run_checks(self, card):
                if card.get("checks") == ["pnpm --filter @pilla/web typecheck"]:
                    code = 1 if (self.repo / "a.test.ts").is_file() else 0
                    return [(card["checks"][0], code, "teste antigo na árvore")]
                result = super().run_checks(card)
                return [(c, 0 if c == "pnpm --filter @pilla/web typecheck" else code, out)
                        for c, code, out in result]
            restore = FeatureOps.restore
        ops = SharedOps(self.repo, [tests_json()])
        orc = self.orc(ops, plan)
        self.assertEqual(orc.run("tests", 3), ["tests: done"], orc.stage("tests").get("message"))
        self.assertEqual(len(ops.calls), 1)
        self.assertEqual((orc.log_dir / "previous/a.test.ts").read_text(), "rejeitado\n")
        self.assertEqual((self.repo / "a.test.ts").read_text(), "good\n")

    def test_restore_error_is_not_green_or_spent(self):
        class BrokenOps(FakeOps):
            def restore(self, card, keep):
                raise OSError("não foi possível guardar")
        ops = BrokenOps(self.repo, [tests_json()])
        orc = self.orc(ops)
        self.assertEqual(orc.run("tests", 3), ["tests: error"])
        self.assertEqual(ops.calls, [])

    def test_shared_checks_pass_then_normal_test_checks_still_run(self):
        plan = {**PLAN, "cards": [{**TEST, "checks": ["expect-red a.test.ts", "quality a.test.ts",
                                                       "pnpm --filter @pilla/web typecheck"]}, IMPL]}
        class SharedOps(FakeOps):
            def run_checks(self, card):
                if card.get("checks") == ["pnpm --filter @pilla/web typecheck"]:
                    return [(card["checks"][0], 0, "sem erro")]
                result = super().run_checks(card)
                return [(c, 0 if c == "pnpm --filter @pilla/web typecheck" else code, out) for c, code, out in result]
        ops = SharedOps(self.repo, [tests_json("bad"), tests_json("good")])
        self.assertEqual(self.orc(ops, plan).run("tests", 3), ["tests: done"])
        self.assertEqual(len(ops.calls), 2)
        self.assertIn("quality a.test.ts", ops.calls[1][-1]["content"])

    def test_red_checks_get_one_batch_repair(self):
        ops = FakeOps(self.repo, [tests_json("bad"), tests_json("good")])
        orc = self.orc(ops)
        self.assertEqual(orc.run("tests", 3), ["tests: done"])
        self.assertEqual(orc.state["stages"]["tests"]["repairs"], 1)
        self.assertIn("quality a.test.ts", ops.calls[1][-1]["content"])

    def test_red_after_repair_escalates_without_implementing(self):
        ops = FakeOps(self.repo, [tests_json("bad"), tests_json("bad")])
        orc = self.orc(ops)
        self.assertEqual(orc.run("all", 3)[-1], "tests: escalated")
        self.assertEqual(ops.runs, [])

    def test_failed_implement_restores_partial_code_and_keeps_tests(self):
        class PartialOps(FakeOps):
            restore = FeatureOps.restore
            def plan_run(self, cards, ids, rounds):
                (self.repo / "a.ts").write_text("broken\n")
                return [{"task": i, "status": "failed", "aliceTokens": {"prompt": 20, "output": 2}} for i in ids]
        ops = PartialOps(self.repo, [tests_json()])
        orc = self.orc(ops)
        self.assertEqual(orc.run("tests", 3), ["tests: done"])
        self.assertEqual(orc.run("implement", 3), ["implement: failed"])
        self.assertEqual((self.repo / "a.ts").read_text(), "throw\n")
        self.assertEqual((orc.log_dir / "previous/a.ts").read_text(), "broken\n")
        self.assertEqual((self.repo / "a.test.ts").read_text(), "good\n")
        self.assertEqual(orc.stage("implement")["cards"], {"E9-T02": "failed"})

    def test_implement_restore_failure_is_error_not_done(self):
        class BrokenRestore(FakeOps):
            def plan_run(self, cards, ids, rounds):
                return [{"task": i, "status": "failed"} for i in ids]
            def restore(self, card, keep):
                if card["kind"] == "implement":
                    raise OSError("não foi possível salvar implementação")
        ops = BrokenRestore(self.repo, [tests_json()])
        orc = self.orc(ops)
        self.assertEqual(orc.run("tests", 3), ["tests: done"])
        self.assertEqual(orc.run("implement", 3), ["implement: error"])
        self.assertIn("não foi possível", orc.stage("implement")["message"])

    def test_recheck_existing_tests_without_bia_updates_sha(self):
        ops = FakeOps(self.repo, [tests_json("bad"), tests_json("bad")])
        orc = self.orc(ops)
        self.assertEqual(orc.run("tests", 3), ["tests: escalated"])
        before = orc.state["testShas"]["a.test.ts"]
        (self.repo / "a.test.ts").write_text("good\n")
        resumed = self.orc(FakeOps(self.repo, []))
        self.assertEqual(resumed.run("recheck-tests", 3), ["recheck-tests: done"])
        self.assertEqual(resumed.state["biaRequests"], 2)
        self.assertNotEqual(resumed.state["testShas"]["a.test.ts"], before)
        self.assertTrue(resumed.state["expectRed"])
        self.assertIn("todos verdes", (resumed.dir / "testes.md").read_text())

    def test_recheck_refuses_red_missing_or_untrusted_state_without_bia(self):
        ops = FakeOps(self.repo, [tests_json("bad"), tests_json("bad")])
        self.assertEqual(self.orc(ops).run("tests", 3), ["tests: escalated"])
        resumed = self.orc(FakeOps(self.repo, []))
        self.assertEqual(resumed.run("recheck-tests", 3), ["recheck-tests: escalated"])
        self.assertEqual(resumed.state["biaRequests"], 2)
        (self.repo / "a.test.ts").unlink()
        self.assertEqual(resumed.run("recheck-tests", 3), ["recheck-tests: error"])
        (self.repo / "a.test.ts").write_text("good\n")
        resumed.state["scenarios"] = []
        self.assertEqual(resumed.run("recheck-tests", 3), ["recheck-tests: error"])
        self.assertNotEqual(resumed.stage("tests")["status"], "done")
        self.assertEqual(self.orc(FakeOps(self.repo, [])).state["biaRequests"], 2)

    def test_quota_in_reserve_spends_nothing(self):
        ops = FakeOps(self.repo, [tests_json()], left=5)
        orc = self.orc(ops)
        self.assertEqual(orc.run("tests", 3), ["tests: quota"])
        self.assertEqual(ops.calls, [])

    def test_finish_drops_stale_diagnostic_but_keeps_counters(self):
        orc = self.orc(FakeOps(self.repo, []))
        orc.finish("tests", "error", 0, message="antigo", red=["check"])
        orc.stage("tests")["biaRequests"] = 2
        previous = orc.stage("tests")["seconds"]
        orc.finish("tests", "done", 0)
        self.assertNotIn("message", orc.stage("tests"))
        self.assertNotIn("red", orc.stage("tests"))
        self.assertEqual(orc.stage("tests")["biaRequests"], 2)
        self.assertGreaterEqual(orc.stage("tests")["seconds"], previous)
        orc.finish("tests", "error", 0, message="novo", red=["novo"])
        self.assertEqual(orc.stage("tests")["message"], "novo")

    def test_feature_records_usage_when_chat_raises(self):
        class ErrorOps(FakeOps):
            def bia_chat(self, messages):
                self.calls.append(messages)
                raise RuntimeError("falha")
        ops = ErrorOps(self.repo, [])
        orc = self.orc(ops)
        self.assertEqual(orc.run("tests", 3), ["tests: error"])
        self.assertEqual(orc.state["stages"]["tests"]["biaIn"], 10)
        self.assertEqual(orc.state["stages"]["tests"]["biaOut"], 1)

    def test_feature_budget_caps_requests(self):
        plan = {**PLAN, "features": [{**PLAN["features"][0], "biaBudget": 1}]}
        ops = FakeOps(self.repo, [tests_json(scenarios=("C1",)), tests_json()])
        orc = self.orc(ops, plan)
        self.assertEqual(orc.run("tests", 3), ["tests: quota"])
        self.assertEqual(len(ops.calls), 1)

    def test_complement_reruns_alice_and_reaudits_once(self):
        ops = FakeOps(self.repo, [tests_json(), audit_json("complementar", "good extra"), audit_json()])
        orc = self.orc(ops)
        self.assertEqual(orc.run("all", 3)[-2:], ["audit: done", "review: ready"])
        self.assertEqual(len(ops.runs), 2)
        self.assertEqual(orc.state["biaRequests"], 3)
        self.assertEqual((self.repo / "a.test.ts").read_text(), "good extra\n")
        self.assertIn("aplicados: a.test.ts", (self.repo / "docs" / "plano" / "E9-F01" / "auditoria.md").read_text())

    def test_complement_that_fails_checks_is_refused_and_restored(self):
        ops = FakeOps(self.repo, [tests_json(), audit_json("complementar", "bad extra")])
        orc = self.orc(ops)
        self.assertEqual(orc.run("all", 3)[-1], "audit: escalated")
        self.assertEqual((self.repo / "a.test.ts").read_text(), "good\n")
        self.assertEqual(ops.reviews, [("E9-T01", "auditoria-bia m gen-2-E9-T01", False)])
        self.assertIn("recusados", (self.repo / "docs" / "plano" / "E9-F01" / "auditoria.md").read_text())

    def test_complement_expect_red_runs_against_stub_and_keeps_impl(self):
        ops = FakeOps(self.repo, [tests_json(), audit_json("complementar", "good extra"), audit_json()])
        orc = self.orc(ops)
        orc.run("all", 3)
        self.assertEqual((self.repo / "a.ts").read_text(), "impl2\n")

    def test_review_refuses_missing_empty_or_failing_coverage(self):
        ops = FakeOps(self.repo, [tests_json(), audit_json()])
        orc = self.orc(ops)
        original = ops.run_checks
        def checks(card):
            return [(cmd, code, "All files | Unknown% (0/0)" if "--coverage" in cmd else out)
                    for cmd, code, out in original(card)]
        ops.run_checks = checks
        self.assertEqual(orc.run("all", 3)[-1], "review: error")
        self.assertIn("erro 17", orc.stage("review")["message"])
        self.assertFalse((orc.dir / "revisao-final.md").exists())
        ops.run_checks = lambda card: [(cmd, code, "sem tabela" if "--coverage" in cmd else out)
                                      for cmd, code, out in original(card)]
        self.assertEqual(orc.run("review", 3), ["review: error"])
        ops.run_checks = lambda card: [(cmd, 1 if "--coverage" in cmd else code,
                                        "All files | 90% (9/10)" if "--coverage" in cmd else out)
                                      for cmd, code, out in original(card)]
        self.assertEqual(orc.run("review", 3), ["review: error"])
        ops.run_checks = lambda card: [(cmd, code, "All files | 90% (9/10)" if "--coverage" in cmd else out)
                                      for cmd, code, out in original(card)]
        self.assertEqual(orc.run("review", 3), ["review: ready"])

    def test_accept_only_ready_review_after_all_other_stages(self):
        ops = FakeOps(self.repo, [tests_json(), audit_json()])
        orc = self.orc(ops)
        with self.assertRaisesRegex(ValueError, "review.*ready"):
            orc.accept()
        self.assertEqual(orc.run("all", 3)[-1], "review: ready")
        orc.stage("audit")["status"] = "escalated"
        with self.assertRaisesRegex(ValueError, "audit"):
            orc.accept()
        orc.stage("audit")["status"] = "done"
        orc.save()
        self.assertEqual(orc.accept(), "done")
        self.assertEqual(self.orc(FakeOps(self.repo, [])).state["stages"]["review"]["status"], "done")
        self.assertEqual(orc.accept(), "done")
        self.assertEqual(cmd_feature_accept("E9-F01", self.repo), 0)
        self.assertEqual(orc.run("all", 3)[-1], "review: done (já feito)")
        (self.repo / "docs/plano/E9-F01/estado.json").write_text(json.dumps({"feature": "E9-F01", "stages": {"review": {"status": "ready"}}}))
        self.assertEqual(cmd_feature_accept("E9-F01", self.repo), 2)
        self.assertEqual(json.loads((self.repo / "docs/plano/E9-F01/estado.json").read_text())["stages"]["review"]["status"], "ready")

    def test_all_resumes_after_done_stages(self):
        ops = FakeOps(self.repo, [tests_json()])
        self.orc(ops).run("tests", 3)
        ops2 = FakeOps(self.repo, [audit_json()])
        out = self.orc(ops2).run("all", 3)
        self.assertEqual(out[:2], ["plan: done", "tests: done (já feito)"])
        self.assertEqual(out[-1], "review: ready")

    def test_cross_feature_dependency_requires_done_card_before_agents(self):
        plan = {"cards": [
            {**TEST, "id": "E9-T01"}, {**IMPL, "id": "E9-T02"},
            {**TEST, "id": "E9-T03", "allowedPaths": ["b.test.ts"], "dependsOn": ["E9-T02"]},
            {**IMPL, "id": "E9-T04", "allowedPaths": ["b.ts"], "protectedTests": ["b.test.ts"], "dependsOn": ["E9-T03"]}],
            "features": [{**PLAN["features"][0]},
                         {"id": "E9-F02", "title": "f2", "cards": ["E9-T03", "E9-T04"], "biaBudget": 2}]}
        target = self.repo / "docs/plano/E9-F02"
        target.mkdir()
        (target / "plano.md").write_text(PLANO)
        (self.repo / "b.ts").write_text("throw\n")
        plan_file = self.repo / "p.yaml"
        plan_file.write_text(json.dumps(plan))
        class F02Ops(FakeOps):
            def bia_chat(self, messages):
                self.calls.append([dict(m) for m in messages])
                data = json.loads(tests_json())
                data["files"][0]["path"] = "b.test.ts"
                data["scenarios"] = [{**s, "card": "E9-T03"} for s in data["scenarios"]]
                return {"id": "f02", "choices": [{"message": {"content": json.dumps(data)}}]}
            def run_checks(self, card):
                return [(c, 0, "verde") for c in card.get("checks") or []]
        ops = F02Ops(self.repo, [])
        # Sem produtor, ou com tests done mas implementação falha, nenhum check/agente de F02 roda.
        for prior in (None,
                      {"feature": "E9-F01", "stages": {"tests": {"status": "done"}}},
                      {"feature": "E9-F01", "stages": {"implement": {"status": "failed", "cards": {"E9-T02": "done"}}}},
                      {"feature": "E9-F01", "stages": {"implement": {"status": "done", "cards": {"E9-T02": "skipped"}}}},
                      {"feature": "E9-F99", "stages": {"implement": {"status": "done", "cards": {"E9-T02": "done"}}}}):
            source = self.repo / "docs/plano/E9-F01/estado.json"
            if prior is None:
                source.unlink(missing_ok=True)
            else:
                source.write_text(json.dumps(prior))
            self.assertEqual(cmd_feature(plan_file, "E9-F02", self.repo, "tests", 3, self.out, ops), 5)
            self.assertEqual(ops.calls, [])
        source.write_text(json.dumps({"feature": "E9-F01", "stages": {"implement": {
            "status": "done", "cards": {"E9-T02": "done"}}}}))
        self.assertEqual(cmd_feature(plan_file, "E9-F02", self.repo, "tests", 3, self.out, ops), 0)
        self.assertEqual(len(ops.calls), 1)
        # Apenas dependência interna no produtor não requer estado prévio.
        source.unlink()
        own_ops = FakeOps(self.repo, [tests_json()])
        self.assertEqual(cmd_feature(plan_file, "E9-F01", self.repo, "tests", 3, self.out, own_ops), 0)

    def test_cmd_feature_refuses_legacy_budget_before_any_request(self):
        plan_file = self.repo / "p.yaml"
        legacy = {**PLAN, "features": [{**PLAN["features"][0], "biaBudget": 11}]}  # TEMPORÁRIO 17/11: era 4 (teto 3)
        plan_file.write_text(json.dumps(legacy))
        ops = FakeOps(self.repo, [])
        self.assertEqual(cmd_feature(plan_file, "E9-F01", self.repo, "all", 3, self.out, ops), 5)
        self.assertEqual(ops.calls, [])

    def test_cmd_feature_refuses_bad_plan_before_any_request(self):
        (self.repo / "docs" / "plano" / "E9-F01" / "plano.md").write_text("# só título\n")
        plan_file = self.repo / "p.yaml"
        plan_file.write_text(json.dumps(PLAN))
        ops = FakeOps(self.repo, [])
        self.assertEqual(cmd_feature(plan_file, "E9-F01", self.repo, "all", 3, self.out, ops), 5)
        self.assertEqual(ops.calls, [])

    def test_cmd_feature_writes_retro_and_plan_json(self):
        plan_file = self.repo / "p.yaml"
        plan_file.write_text(json.dumps(PLAN))
        ops = FakeOps(self.repo, [tests_json(), audit_json()])
        self.assertEqual(cmd_feature(plan_file, "E9-F01", self.repo, "all", 3, self.out, ops), 0)
        retro = next(self.out.glob("retro-*.md")).read_text()
        self.assertIn("## Feature E9-F01", retro)
        self.assertTrue(list(self.out.glob("plan-*.json")))

    def test_audit_review_passes_the_commit_gate(self):
        import bia
        import review
        raw = self.out / "raw"
        with mock.patch.object(bia, "RAW_DIR", raw), mock.patch.object(review, "RAW_DIR", raw):
            ops = RealReviewOps(self.repo, [tests_json(), audit_json()])
            self.assertEqual(self.orc(ops).run("all", 3)[-1], "review: ready")
            self.assertEqual(review.review_problems(self.repo, TEST, "worktree"), [])
            (self.repo / "a.test.ts").write_text("mudou\n")
            self.assertTrue(review.review_problems(self.repo, TEST, "worktree"))


class RealReviewOps(FakeOps):
    """Revisão e resposta bruta de verdade (bia.py), para conferir contra o portão do commit (review.py)."""

    def __init__(self, repo: Path, replies: list[str]) -> None:
        super().__init__(repo, replies)
        import bia
        self.bia = bia

    save_raw = FeatureOps.save_raw
    write_review = FeatureOps.write_review
    mechanical = FeatureOps.mechanical


class SchemaTest(unittest.TestCase):
    def test_tests_schema_rejects_foreign_path(self):
        obj = {"files": [{"path": "x.ts", "content": "y"}], "scenarios": [{"id": "C1", "teste": "it"}]}
        self.assertTrue(any("fora" in p for p in tests_schema_problems(obj, {"a.test.ts"}, ["C1"])))

    def test_audit_approved_with_extra_tests_is_out_of_schema(self):
        obj = json.loads(audit_json("aprovado", "x"))
        self.assertTrue(any("aprovado" in p for p in audit_schema_problems(obj, {"a.test.ts"}, {"E9-T01": [1, 2]})))

    def test_audit_needs_every_asked_line(self):
        obj = json.loads(audit_json())
        self.assertTrue(audit_schema_problems(obj, {"a.test.ts"}, {"E9-T01": [1, 2, 3]}))


if __name__ == "__main__":
    unittest.main()
