"""Edição que não muda nada não é 'ok' e o limite de chamadas não é só um aviso (E4-T05: 61 chamadas, limite 20)."""
import tempfile
import unittest
from pathlib import Path

from alice import Run, Tools
from gates import CallBudget

SRC = "pkg/src/a.ts"
TEXT = "function h() {\n  return 1;\n}\n\nexport function f() {\n  return 2;\n}\n"


class NoOpEditTest(unittest.TestCase):
    def tools(self, repo: Path) -> Tools:
        (repo / "pkg" / "src").mkdir(parents=True)
        (repo / SRC).write_text(TEXT)
        card = {"id": "E9-X", "title": "x", "allowedPaths": [SRC], "checks": [], "rules": []}
        (repo / "run").mkdir()
        return Tools(Run(card, repo, repo / "run"))

    def test_edit_file_that_leaves_the_file_equal_says_nothing_changed(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            tools = self.tools(repo)
            # edição já aplicada (o 'old' sumiu, o 'new' está no arquivo): antes devolvia 'ok' e o modelo repetia
            out = tools.edit_file(SRC, "return 0;", "  return 1;")
            self.assertTrue(out.startswith("NADA MUDOU"), out)
            self.assertEqual((repo / SRC).read_text(), TEXT)

    def test_replace_function_with_the_same_code_says_nothing_changed(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            tools = self.tools(repo)
            out = tools.replace_function(SRC, "f", "export function f() {\n  return 2;\n}")
            self.assertTrue(out.startswith("NADA MUDOU"), out)

    def test_a_real_edit_is_still_ok(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            tools = self.tools(repo)
            self.assertTrue(tools.edit_file(SRC, "return 2;", "return 3;").startswith("ok"))
            self.assertTrue(tools.replace_function(SRC, "f", "export function f() {\n  return 4;\n}").startswith("ok"))


class CallBudgetTest(unittest.TestCase):
    def run_calls(self, budget: CallBudget, n: int) -> list[str]:
        out = []
        for _ in range(n):
            budget.tick()
            out.append(budget.status())
        return out

    def test_nudges_once_at_the_limit_then_stops_when_ignored(self):
        b = CallBudget(5, grace=2)
        states = self.run_calls(b, 8)
        self.assertEqual(states, ["ok", "ok", "ok", "ok", "nudge", "ok", "ok", "stop"])

    def test_finish_resets_the_budget(self):
        b = CallBudget(3, grace=1)
        self.assertEqual(self.run_calls(b, 3)[-1], "nudge")
        b.finished()
        self.assertEqual(self.run_calls(b, 2), ["ok", "ok"])

    def test_total_never_passes_limit_plus_grace_plus_one(self):
        b = CallBudget(20)
        n = 0
        while True:
            n += 1
            b.tick()
            if b.status() == "stop":
                break
        self.assertEqual(n, 25)


if __name__ == "__main__":
    unittest.main()
