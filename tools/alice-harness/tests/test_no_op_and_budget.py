"""Edição que não muda nada não é 'ok' e o limite de chamadas não é só um aviso (E4-T05: 61 chamadas, limite 20)."""
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

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


class RunBudgetLoopTest(unittest.TestCase):
    def run_script(self, turns, limit=2, check_code=1, check_text="teste vermelho"):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            (repo / "run").mkdir()
            card = {"id": "E9-X", "kind": "implement", "allowedPaths": ["a.ts"],
                    "checks": ["test --coverage"], "budget": {"toolCalls": limit, "attempts": 4}, "refactor": False}
            run = Run(card, repo, repo / "run")
            run.messages = [{"role": "system", "content": "teste"}, {"role": "user", "content": "comece"}]
            seen = []
            def chat():
                if not turns:
                    raise AssertionError("esperava encerrar após os turnos")
                return turns.pop(0)
            def check(cmd):
                seen.append(cmd)
                return (check_code, check_text, False)
            run.chat = chat
            run.check = check
            def read_file(_tools, path):
                seen.append(path)
                return "ok"
            with mock.patch.object(run, "verify", return_value=(False, f"check 0 falhou: {check_text}")), \
                 mock.patch.object(run, "compact"), mock.patch.object(run, "log"), \
                 mock.patch("alice.Tools.read_file", read_file), \
                 contextlib.redirect_stdout(io.StringIO()) as stdout:
                exit_code = run.loop()
            return exit_code, json.loads(stdout.getvalue()), seen, run.messages

    @staticmethod
    def turn(*names):
        return {"role": "assistant", "content": "", "tool_calls": [
            {"id": f"call_{i}", "function": {"name": name, "arguments": {"path": f"file{i}"} if name == "read_file" else {}}}
            for i, name in enumerate(names)]}

    def test_batch_cannot_execute_past_grace_and_warning_precedes_next_turn(self):
        turns = [self.turn("read_file", "read_file"), self.turn(*(["read_file"] * 6))]
        code, rep, seen, messages = self.run_script(turns)
        self.assertEqual(code, 2)
        self.assertEqual(rep["status"], "failed")
        self.assertEqual(len(seen), 6)  # two before nudge, four in grace; seventh tool refused
        self.assertLess(next(i for i, m in enumerate(messages) if "Limite de chamadas desta tentativa" in m.get("content", "")),
                        next(i for i, m in enumerate(messages) if m.get("role") == "assistant" and i > 2))
        self.assertIn("check 0 falhou", rep["message"])

    def test_valid_finish_inside_grace_still_requires_verification(self):
        turns = [self.turn("read_file", "read_file"), self.turn("finish"),
                 self.turn(*(["read_file"] * 2)), self.turn(*(["read_file"] * 5))]
        code, rep, _, messages = self.run_script(turns)
        self.assertEqual(code, 2)
        self.assertNotEqual(rep["status"], "done")
        self.assertTrue(any(m.get("tool_name") == "finish" for m in messages))

    def test_check_after_warning_does_not_make_red_run_green(self):
        turns = [self.turn("read_file", "read_file"),
                 {"role": "assistant", "content": "", "tool_calls": [
                     {"id": "check", "function": {"name": "run_check", "arguments": {"index": -1}}}]},
                 self.turn(*(["read_file"] * 4))]
        code, rep, seen, _ = self.run_script(turns, check_text="All files | Unknown% (0/0)")
        self.assertEqual(code, 2)
        self.assertIn("0/0", rep["message"])
        self.assertIn("test --coverage", seen)  # run_check atendido, ainda vermelho
        self.assertNotIn("ignorado: o aviso pediu run_check", rep["message"])


if __name__ == "__main__":
    unittest.main()
