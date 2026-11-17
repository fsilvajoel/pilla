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
    def run_script(self, turns, limit=2, check_code=1, check_text="teste vermelho", verified=None):
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
            with mock.patch.object(run, "verify", return_value=verified or (False, f"check 0 falhou: {check_text}")), \
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


    # JV17-2: aviso a 70% e check final automático no limite, sem aumentar o teto
    def test_budget_20_warns_on_14th_call_with_6_left_and_runs_final_check(self):
        turns = [self.turn(*(["read_file"] * 14)), self.turn(*(["read_file"] * 6)), self.turn(*(["read_file"] * 5))]
        code, rep, seen, messages = self.run_script(turns, limit=20, check_text="All files | Unknown% (0/0)")
        tool_msgs = [m for m in messages if m.get("role") == "tool"]
        warned = [i for i, m in enumerate(tool_msgs) if "restam" in m["content"]]
        self.assertEqual(warned, [13])  # 14ª chamada, uma vez só
        self.assertIn("AVISO: restam 6 chamadas; feche: rode os checks e entregue", tool_msgs[13]["content"])
        nudge = next(m["content"] for m in messages if "Limite de chamadas desta tentativa" in m.get("content", ""))
        self.assertIn("Check final automático: vermelho", nudge)
        self.assertIn("0/0", nudge)
        self.assertEqual(code, 2)
        self.assertEqual(rep["status"], "failed")  # 0/0 continua vermelho
        self.assertEqual(rep["toolCalls"], 24)  # teto inalterado: 20 + grace 4
        self.assertNotIn("test --coverage", seen)  # check automático não gasta chamada de ferramenta

    def test_green_auto_check_still_requires_finish(self):
        turns = [self.turn("read_file", "read_file"), self.turn(*(["read_file"] * 5))]
        code, rep, _, messages = self.run_script(turns, verified=(True, ""))
        self.assertIn("Check final automático: verde", next(m["content"] for m in messages if "Limite de chamadas" in m.get("content", "")))
        self.assertEqual(code, 2)
        self.assertEqual(rep["status"], "failed")  # verde sem finish não vira done
        self.assertIn("finish não foi chamado", rep["message"])


    # JV17-3: write bloqueado lista os permitidos e indica o destino; 2º bloqueio seguido no mesmo path pede para parar
    def test_blocked_write_lists_allowed_and_second_consecutive_says_stop(self):
        def write(path, i):
            return {"id": f"w{i}", "function": {"name": "write_file", "arguments": {"path": path, "content": f"x{i}"}}}
        turns = [{"role": "assistant", "content": "", "tool_calls": [
                     write("src/a.ts", 0), write("src/a.ts", 1),
                     {"id": "r", "function": {"name": "read_file", "arguments": {"path": "a.ts"}}},
                     write("src/a.ts", 2)]},
                 self.turn(*(["read_file"] * 5))]
        _, rep, _, messages = self.run_script(turns, limit=4)
        writes = [m["content"] for m in messages if m.get("tool_name") == "write_file"]
        self.assertTrue(writes[0].startswith("BLOQUEADO: escrita fora de allowedPaths: src/a.ts"))
        self.assertIn("Permitidos: a.ts", writes[0])
        self.assertIn("Destino: escreva em a.ts", writes[0])
        self.assertNotIn("pare de tentar", writes[0])
        self.assertTrue(writes[1].startswith("BLOQUEADO: pare de tentar src/a.ts"))
        self.assertNotIn("pare de tentar", writes[2])  # uma leitura permitida no meio zera a contagem
        self.assertEqual(rep["status"], "failed")


    # JV17-4: relatório com chamadas por tipo e a última saída vermelha (redigida, limitada)
    def test_report_counts_tools_by_kind_and_keeps_last_red_check(self):
        secret = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"
        turns = [{"role": "assistant", "content": "", "tool_calls": [
                     {"id": "w", "function": {"name": "write_file", "arguments": {"path": "b.ts", "content": "x"}}},
                     {"id": "c", "function": {"name": "run_check", "arguments": {"index": -1}}}]},
                 self.turn(*(["read_file"] * 5))]
        _, rep, _, _ = self.run_script(turns, check_text=f"FAIL token={secret} " + "x" * 5000)
        self.assertEqual(rep["toolsByKind"], {"read": 4, "write": 0, "run_check": 1, "bloqueadas": 1, "outras": 0})
        red = rep["lastRedCheck"]
        self.assertEqual((red["check"], red["exit"]), ("test --coverage", 1))
        self.assertNotIn(secret, red["output"])
        self.assertLess(len(red["output"]), 800)

    def test_green_check_clears_old_red_output(self):
        with tempfile.TemporaryDirectory() as d:
            run = Run({"id": "E9-X", "kind": "implement", "allowedPaths": ["a.ts"], "checks": ["t"],
                       "budget": {"toolCalls": 5, "attempts": 2}}, Path(d), Path(d))
            run.note_check("t", 1, "vermelho")
            self.assertEqual(run.stats["last_red"]["output"], "vermelho")
            run.note_check("t", 0, "verde")
            self.assertNotIn("last_red", run.stats)


class CallBudgetWarningTest(unittest.TestCase):
    def test_warns_once_at_70_percent(self):
        b = CallBudget(20)
        got = []
        for i in range(1, 21):
            b.tick()
            w = b.warning()
            if w:
                got.append((i, w))
        self.assertEqual(got, [(14, "restam 6 chamadas; feche: rode os checks e entregue")])
        self.assertEqual((b.limit, b.grace), (20, 4))

    def test_small_limit_does_not_warn_before_nudge(self):
        b = CallBudget(2)
        b.tick(); b.tick()
        self.assertIsNone(b.warning())

    def test_finish_rearms_the_warning(self):
        b = CallBudget(10)
        for _ in range(7):
            b.tick()
        self.assertIsNotNone(b.warning())
        b.finished()
        for _ in range(7):
            b.tick()
        self.assertEqual(b.warning(), "restam 3 chamadas; feche: rode os checks e entregue")

if __name__ == "__main__":
    unittest.main()
