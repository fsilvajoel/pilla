"""e4-guardrails F/G/H: teste possível e revisado antes de virar base de implementação (erro 11)."""
import shutil
import subprocess
import tempfile
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

from alice import protected_test_problems, restore_allowed
from cards import quality_problems
import json

import bia
import review
from review import blob_sha, review_problems, template

TEST = "src/a.test.ts"
AUTHOR = {"id": "E9-T01", "kind": "test-author", "assignee": "alice", "allowedPaths": [TEST],
          "done": ["fails now", "f(1) is valid (RN-P01)"]}


def git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)


class CoverageCheckTest(unittest.TestCase):
    def test_global_empty_coverage_fails_but_other_checks_do_not(self):
        from alice import run_cmd
        result = subprocess.CompletedProcess([], 0, "All files | Unknown% (0/0)\n", "")
        with tempfile.TemporaryDirectory() as d, mock.patch("alice.subprocess.run", return_value=result):
            code, text = run_cmd("vitest run --coverage", Path(d))
            self.assertNotEqual(code, 0)
            self.assertIn("0/0", text)
            self.assertEqual(run_cmd("vitest run", Path(d))[0], 0)
            result.stdout = "All files | 90% (9/10)\n"
            self.assertEqual(run_cmd("vitest run --coverage", Path(d))[0], 0)
            result.returncode = 1
            self.assertEqual(run_cmd("vitest run --coverage", Path(d))[0], 1)

    def test_non_final_filtered_check_passes_only_when_green(self):
        # JV17-5: check não-final (-t, sem --coverage) depende só do exit; 0/0 na saída não reprova.
        from alice import run_cmd
        cmd = "pnpm vitest run a.test.ts -t E9-T02"
        result = subprocess.CompletedProcess([], 0, "Tests 3 passed\nAll files | Unknown% (0/0)\n", "")
        with tempfile.TemporaryDirectory() as d, mock.patch("alice.subprocess.run", return_value=result):
            self.assertEqual(run_cmd(cmd, Path(d))[0], 0)
            result.returncode = 1
            self.assertNotEqual(run_cmd(cmd, Path(d))[0], 0)


class RepoCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        git(self.repo, "init", "-q")
        git(self.repo, "config", "user.email", "t@t")
        git(self.repo, "config", "user.name", "t")
        (self.repo / "src").mkdir()
        (self.repo / TEST).write_text("it('a', () => { expect(f(1)).toBe(2); });\n")
        (self.repo / "src/a.ts").write_text("export const f = 1;\n")
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-qm", "init")
        self.raw_dir, review.RAW_DIR, bia.RAW_DIR = review.RAW_DIR, self.repo / "raw", self.repo / "raw"

    def tearDown(self):
        review.RAW_DIR = bia.RAW_DIR = self.raw_dir
        self.tmp.cleanup()

    def sign(self, name="bia", card="E9-T01", sha=None):
        (self.repo / "raw").mkdir(exist_ok=True)
        meta = {"card": card, "task": "test", "path": TEST, "sha": sha or blob_sha(self.repo, TEST, "worktree")}
        (self.repo / "raw/r1.json").write_text(json.dumps(meta))
        return f"revisor: {name} m r1\n"

    def write_review(self, mark="x", evidence="it 'a' confere f(1)", name="bia"):
        text = self.sign(name) + template(self.repo, AUTHOR).replace("- [ ] fails now — ", f"- [{mark}] fails now — {evidence}")
        text = text.replace("- [ ] f(1) is valid (RN-P01) — ", f"- [{mark}] f(1) is valid (RN-P01) — {evidence}")
        f = self.repo / "docs/plano/revisao/E9-T01.md"
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(text)
        return f


class ReviewTest(RepoCase):
    def test_missing_incomplete_and_stale_reviews_are_refused(self):
        self.assertIn("falta a revisão", review_problems(self.repo, AUTHOR, "worktree")[0])
        self.write_review(mark=" ")
        self.assertEqual(len(review_problems(self.repo, AUTHOR, "worktree")), 2)
        self.write_review(evidence="ok")
        self.assertIn("sem evidência", review_problems(self.repo, AUTHOR, "worktree")[0])
        self.write_review()
        self.assertEqual(review_problems(self.repo, AUTHOR, "worktree"), [])
        (self.repo / TEST).write_text("it('b', () => { expect(f(2)).toBe(3); });\n")
        self.assertIn("outra versão", " ".join(review_problems(self.repo, AUTHOR, "worktree")))

    def test_claude_cannot_sign_and_the_raw_answer_must_match(self):
        self.write_review(name="alice")  # ela escreve o teste: não aprova o próprio
        self.assertIn("não assina", review_problems(self.repo, AUTHOR, "worktree")[0])
        f = self.write_review(name="claude")
        self.assertIn("não assina", review_problems(self.repo, AUTHOR, "worktree")[0])
        f.write_text(f.read_text().replace("revisor: claude m r1\n", ""))
        self.assertIn("sem assinatura", review_problems(self.repo, AUTHOR, "worktree")[0])
        self.write_review()
        self.sign(sha="0" * 40)
        self.assertIn("outra versão do teste", review_problems(self.repo, AUTHOR, "worktree")[0])


class BiaTest(RepoCase):
    def setUp(self):
        super().setUp()
        self._local, bia.local_review = bia.local_review, lambda prompt: None  # sem rede nos testes

    def tearDown(self):
        bia.local_review = self._local
        super().tearDown()

    def card(self, checks):
        return {**AUTHOR, "checks": checks, "readFirst": ["src/a.ts"]}

    def test_local_rejection_spends_no_request(self):
        """GPU local é grátis, o OpenRouter tem 50/dia: se a Alice já reprova, a Bia não é chamada."""
        calls = []
        old, bia.chat = bia.chat, lambda *a, **k: calls.append(a)
        bia.local_review = lambda prompt: [{"linha": 3, "regra": 2, "explicacao": "falta `PRONTO_TOKEN`"},
                                           {"linha": 3, "regra": 2, "explicacao": "repetido `PRONTO_TOKEN`"},
                                           {"linha": 5, "regra": 1, "explicacao": "troque `toBe` por toEqual"}]
        try:
            (self.repo / TEST).write_text("it('a', () => { expect(f(1)).toBe(true); });\n")
            card = {**self.card(["true"]), "done": ["fails now", "uses PRONTO_TOKEN", "returned as it came (toBe)"]}
            self.assertEqual(bia.review_test(self.repo, card, "m", "bia"), 2)
            self.assertEqual(bia.review_card(self.repo, card, "m", "bia"), 2)
        finally:
            bia.chat = old
        self.assertEqual(calls, [])
        self.assertIn("## Descartadas", review.review_file(self.repo, AUTHOR["id"]).read_text())
        # a reprovação volta para a próxima rodada da Alice, sem repetição, e não vale como aprovação
        # só a nota com apoio no pronto (cita o que ele exige e o arquivo não tem); a que contradiz fica de fora
        self.assertEqual(review.rejection_notes(self.repo, AUTHOR["id"]), ["- linha 3 (regra 2): falta `PRONTO_TOKEN`"])
        self.assertTrue(review_problems(self.repo, AUTHOR, "worktree"))

    def test_local_review_needs_two_samples_on_the_same_line(self):
        """A Alice local alucina às vezes: problema de uma amostra só não reprova nem vira nota."""
        bia.local_review = self._local
        def run(samples):
            it = iter(samples)
            old, bia.local_sample = bia.local_sample, lambda prompt: next(it)
            try:
                return bia.local_review("p", samples=3)
            finally:
                bia.local_sample = old
        p = lambda line, why="x": {"linha": line, "regra": 1, "explicacao": why}
        self.assertEqual(run([[p(12, "real")], [p(2, "alucinação")], [p(12, "de novo"), p(30)]]), [p(12, "real")])
        self.assertIsNone(run([[p(2)], [], []]))  # só uma amostra acusou
        self.assertIsNone(run([[], [], "não chega aqui"]))  # duas aprovaram: para cedo
        self.assertIsNone(run([None]))  # GPU fora do ar: segue para a Bia

    def test_quota_reserve_stops_before_the_request(self):
        sent = []
        olds = bia.quota, urllib.request.urlopen
        bia.quota = lambda key: {"used": 46, "limit": 50, "remaining": 4}
        urllib.request.urlopen = lambda *a, **k: sent.append(a)
        try:
            with self.assertRaises(bia.QuotaError):
                bia.chat([{"role": "user", "content": "x"}], "m", "k")
            bia.api_key = lambda repo: "k"
            self.assertEqual(bia.review_test(self.repo, self.card(["true"]), "m", "bia"), 4)
        finally:
            bia.quota, urllib.request.urlopen = olds
        self.assertEqual(sent, [])

    def test_network_retries_count_and_error_usage_when_available(self):
        def reply(payload):
            response = mock.MagicMock()
            response.__enter__.return_value.read.return_value = json.dumps(payload).encode()
            return response
        old = dict(bia.USAGE)
        try:
            with mock.patch.object(bia, "quota", return_value={}), mock.patch.object(bia.time, "sleep"), \
                 mock.patch.object(bia.urllib.request, "urlopen", side_effect=[reply({"error": "retry", "usage": {"prompt_tokens": 3, "completion_tokens": 2}}), reply({"choices": [{}], "usage": {"prompt_tokens": 4, "completion_tokens": 1}})]):
                bia.chat([], "m", "k", tries=2)
            self.assertEqual(bia.USAGE["biaRequests"] - old["biaRequests"], 2)
            self.assertEqual(bia.USAGE["biaIn"] - old["biaIn"], 7)
            self.assertEqual(bia.USAGE["biaOut"] - old["biaOut"], 3)
            with mock.patch.object(bia, "quota", return_value={}), mock.patch.object(bia.urllib.request, "urlopen", side_effect=TimeoutError("timeout")):
                with self.assertRaises(RuntimeError):
                    bia.chat([], "m", "k", tries=1)
            self.assertEqual(bia.USAGE["biaRequests"] - old["biaRequests"], 3)
            self.assertEqual(bia.USAGE["biaIn"] - old["biaIn"], 7)
        finally:
            bia.USAGE.clear()
            bia.USAGE.update(old)

    def test_red_check_skips_the_api(self):
        calls = []
        old, bia.chat = bia.chat, lambda *a, **k: calls.append(a)
        try:
            self.assertEqual(bia.review_test(self.repo, self.card(["false"]), "m", "bia"), 2)
        finally:
            bia.chat = old
        self.assertEqual(calls, [])

    def test_approved_review_passes_the_gate(self):
        answer = {"veredito": "aprovado", "problemas": [],
                  "itens": [{"n": 1, "ok": True, "onde": "check expect-red"}, {"n": 2, "ok": True, "onde": "it 'a' linha 1"}]}
        sent = []
        def fake(messages, model, key, **k):
            sent.append(messages[0]["content"])
            return {"id": "gen-1", "choices": [{"message": {"content": json.dumps(answer)}}]}
        old, bia.chat, bia.api_key = bia.chat, fake, lambda repo: "k"
        try:
            self.assertEqual(bia.review_test(self.repo, self.card(["true"]), "m", "bia"), 0)
        finally:
            bia.chat = old
        self.assertIn("export const f = 1", sent[0])  # contrato vai, raciocínio do Claude não
        self.assertEqual(review_problems(self.repo, AUTHOR, "worktree"), [])
        answer["problemas"] = [{"linha": 1, "regra": 1, "explicacao": "x"}]
        old, bia.chat = bia.chat, fake
        try:
            self.assertEqual(bia.review_test(self.repo, self.card(["true"]), "m", "bia"), 2)
        finally:
            bia.chat = old
        self.assertIn("não aprovada", review_problems(self.repo, AUTHOR, "worktree")[0])

    def test_write_formats_before_checks(self):
        """O pre-commit roda prettier: o arquivo da Bia sai formatado pelo harness (LI-052, erro 14)."""
        order = []
        reply = {"choices": [{"message": {"content": "```ts\nit('a', () => {})\n```"}}]}
        olds = bia.chat, bia.api_key, bia.format_touched, bia.run_checks, bia.restore_allowed
        bia.chat, bia.api_key = (lambda *a, **k: reply), (lambda repo: "k")
        bia.format_touched = lambda repo, files: order.append(("fmt", files))
        bia.run_checks = lambda repo, card: order.append(("checks",)) or []
        bia.restore_allowed = lambda *a: None
        try:
            self.assertEqual(bia.write_test(self.repo, self.card(["true"]), "m"), 0)
        finally:
            bia.chat, bia.api_key, bia.format_touched, bia.run_checks, bia.restore_allowed = olds
        self.assertEqual(order, [("fmt", [TEST]), ("checks",)])

    def test_mechanical_lines_are_not_asked(self):
        """run_check e never edit são do harness: a Bia não responde e isso não pode reprovar (erro 13)."""
        card = {**self.card(["true"]), "done": ["every test fails now (run_check 0)", "f(1) is valid (RN-P01)",
                                               "never edit src/a.ts"]}
        sent = []
        def fake(messages, model, key, **k):
            sent.append(messages[0]["content"])
            answer = {"veredito": "aprovado", "problemas": [], "itens": [{"n": 2, "ok": True, "onde": "it 'a' linha 1"}]}
            return {"id": "gen-2", "choices": [{"message": {"content": json.dumps(answer)}}]}
        old, bia.chat, bia.api_key = bia.chat, fake, lambda repo: "k"
        try:
            self.assertEqual(bia.review_test(self.repo, card, "m", "bia"), 0)
        finally:
            bia.chat = old
        self.assertNotIn("run_check 0", sent[0].split("PRONTO QUANDO:")[1].split("Checks mecânicos")[0])
        self.assertIn("2. f(1) is valid", sent[0])
        self.assertEqual(review_problems(self.repo, card, "worktree"), [])


class PreflightTest(RepoCase):
    def implement(self):
        return {"id": "E9-T02", "kind": "implement", "protectedTests": [TEST]}

    def plan(self, cards):
        import yaml
        d = self.repo / "docs/plano"
        d.mkdir(parents=True, exist_ok=True)
        (d / "E9.yaml").write_text(yaml.safe_dump({"delivery": "E9", "cards": cards}))

    def test_test_must_be_committed_and_reviewed(self):
        self.plan([AUTHOR])
        self.assertIn("falta a revisão", protected_test_problems(self.implement(), self.repo)[0])
        self.write_review()
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-qm", "review")
        self.assertEqual(protected_test_problems(self.implement(), self.repo), [])
        (self.repo / TEST).write_text("it('b', () => { expect(f(2)).toBe(3); });\n")
        self.assertIn("não está commitado", protected_test_problems(self.implement(), self.repo)[0])

    def test_quality_check_runs_when_the_script_exists(self):
        if not shutil.which("node"):
            self.skipTest("sem node")
        scripts = self.repo / "scripts"
        scripts.mkdir()
        shutil.copy(Path(__file__).resolve().parents[3] / "scripts/check-test-quality.mjs", scripts)
        (self.repo / TEST).write_text("it('a', () => { expect(r).toBeInstanceOf(Object); });\n")
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-qm", "bad test")
        self.assertIn("Q1", protected_test_problems(self.implement(), self.repo)[0])


class RestoreTest(RepoCase):
    def test_leftovers_are_kept_and_the_card_starts_from_head(self):
        run_dir = self.repo / "run"
        (self.repo / "src/a.ts").write_text("export const f = 2;\n")
        (self.repo / "src/new.ts").write_text("x\n")
        moved = restore_allowed(self.repo, {"allowedPaths": ["src/a.ts", "src/new.ts", "src/none.ts"]}, run_dir)
        self.assertEqual(moved, ["src/a.ts", "src/new.ts"])
        self.assertEqual((self.repo / "src/a.ts").read_text(), "export const f = 1;\n")
        self.assertFalse((self.repo / "src/new.ts").exists())
        self.assertEqual((run_dir / "previous/src/a.ts").read_text(), "export const f = 2;\n")
        self.assertEqual(restore_allowed(self.repo, {"allowedPaths": ["src/a.ts"]}, run_dir), [])


class TestAuthorCardTest(unittest.TestCase):
    def card(self, **kw):
        base = {"id": "E9-T01", "kind": "test-author", "assignee": "alice", "allowedPaths": [TEST],
                "checks": [f"node scripts/check-test-quality.mjs {TEST}", "typecheck", "lint"], "done": ["fails now"]}
        base.update(kw)
        return base

    def rules(self, card):
        return [p for p in quality_problems(card) if "E4-F" in p]

    def test_good_card_passes(self):
        self.assertEqual(self.rules(self.card(done=["f(1) is valid (RN-P01)", 'returns "12345678909" (RFC-005 §3)'])), [])

    def test_quality_check_is_required(self):
        self.assertIn("check-test-quality", self.rules(self.card(checks=["typecheck", "lint"]))[0])

    def test_value_without_source_and_too_many_behaviors(self):
        self.assertIn("sem fonte", self.rules(self.card(done=['f(1) returns "00000000191"']))[0])
        self.assertIn("comportamentos", self.rules(self.card(done=[f"b{i}" for i in range(6)]))[0])


if __name__ == "__main__":
    unittest.main()
