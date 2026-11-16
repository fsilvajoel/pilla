"""e4-guardrails F/G/H: teste possível e revisado antes de virar base de implementação (erro 11)."""
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

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
        f = self.write_review(name="claude")
        self.assertIn("não assina", review_problems(self.repo, AUTHOR, "worktree")[0])
        f.write_text(f.read_text().replace("revisor: claude m r1\n", ""))
        self.assertIn("sem assinatura", review_problems(self.repo, AUTHOR, "worktree")[0])
        self.write_review()
        self.sign(sha="0" * 40)
        self.assertIn("outra versão do teste", review_problems(self.repo, AUTHOR, "worktree")[0])


class BiaTest(RepoCase):
    def card(self, checks):
        return {**AUTHOR, "checks": checks, "readFirst": ["src/a.ts"]}

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
