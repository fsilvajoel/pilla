"""Testes do núcleo e do hook do Jorge: python3 -m unittest tools/jorge/nucleo/test_jorge.py (da raiz do repo)."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import runner  # noqa: E402

HOOK = Path(__file__).resolve().parent / "guarda_claude.py"
REPO = Path(__file__).resolve().parents[3]


def hook(tool: str, **inp: str) -> int:
    r = subprocess.run([sys.executable, str(HOOK)], input=json.dumps({"tool_name": tool, "tool_input": inp}),
                       text=True, capture_output=True)
    return r.returncode


class HookTest(unittest.TestCase):
    def test_claude_nao_edita_harness_nem_jorge(self) -> None:
        for p in ("tools/alice-harness/cards.py", "docs/agents/travas.md", ".agents/policy.yaml", "tools/jorge/jorge.py",
                  "tools/jorge/nucleo/runner.py", "tools/jorge/agente/jorge.md", ".claude/settings.json"):
            self.assertEqual(hook("Edit", file_path=str(REPO / p)), 2, p)
        self.assertEqual(hook("Edit", file_path="/home/debian/code/alice-harness/alice.py"), 2)
        self.assertEqual(hook("Write", file_path="/home/debian/.config/systemd/user/jorge-auto.timer"), 2)

    def test_claude_edita_produto(self) -> None:
        self.assertEqual(hook("Edit", file_path=str(REPO / "apps/api/src/x.ts")), 0)

    def test_bash(self) -> None:
        self.assertEqual(hook("Bash", command="sed -i s/a/b/ tools/alice-harness/cards.py"), 2)
        self.assertEqual(hook("Bash", command="echo x > tools/alice-harness/x.py"), 2)
        self.assertEqual(hook("Bash", command="git checkout -- tools/alice-harness/"), 2)
        self.assertEqual(hook("Bash", command="cp x tools/jorge/agente/jorge.md"), 2)
        self.assertEqual(hook("Bash", command="cat tools/alice-harness/README.md"), 0)
        self.assertEqual(hook("Bash", command="cd tools/alice-harness && python3 -m unittest discover -s tests 2>&1 | tail"), 0)
        self.assertEqual(hook("Bash", command="python3 tools/jorge/jorge.py review --escopo e.md"), 0)
        self.assertEqual(hook("Bash", command="python3 tools/jorge/jorge.py auto"), 0)
        self.assertEqual(hook("Bash", command='python3 tools/jorge/jorge.py anotar "resume deveria aceitar ID"'), 0)
        self.assertEqual(hook("Bash", command='python3 tools/jorge/jorge.py anotar "x" > tools/jorge/agente/a'), 2)

    def test_logs_do_jorge(self) -> None:
        self.assertEqual(hook("Read", file_path=str(REPO / "tools/jorge/logs/harness-v1/relatorio.md")), 2)
        self.assertEqual(hook("Read", file_path=str(REPO / "tools/jorge/logs/caixa.md")), 2)
        self.assertEqual(hook("Bash", command="cat tools/jorge/logs/harness-v1/runner.log"), 2)
        self.assertEqual(hook("Bash", command="ls ../.jorge-wt"), 2)


def cfg() -> runner.Json:
    return runner.load_cfg()


class CfgTest(unittest.TestCase):
    def test_tetos_do_nucleo(self) -> None:
        import yaml
        nucleo = yaml.safe_load((runner.HERE / "nucleo.yaml").read_text())
        c = runner.merge_cfg(nucleo, {"api": {"model": "gpt-qualquer"}, "limites": {"passos_analise": 9999, "linhas_busca": "x"}})
        self.assertEqual(c["api"]["model"], nucleo["agente_padrao"]["model"])
        self.assertEqual(c["limites"]["passos_analise"], nucleo["limites_maximos"]["passos_analise"])
        self.assertEqual(c["limites"]["linhas_busca"], nucleo["agente_padrao"]["limites"]["linhas_busca"])
        self.assertEqual(c["api"]["base_url"], nucleo["api"]["base_url"])
        c = runner.merge_cfg(nucleo, {"api": {"model": "gpt-6-astra"}, "limites": {"passos_analise": 10}})
        self.assertEqual((c["api"]["model"], c["limites"]["passos_analise"]), ("gpt-6-astra", 10))

    def test_config_quebrada_cai_no_padrao(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            Path(d, "config.yaml").write_text("api: [: quebrado")
            c = runner.load_cfg(Path(d))
            self.assertEqual(c["limites"]["passos_analise"], 40)


class PathsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.p = runner.Paths(cfg(), Path(self.tmp.name))

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_escrita(self) -> None:
        for ok in ("tools/alice-harness/cards.py", "tools/jorge/agente/jorge.md", "tools/alice-harness/.env.example",
                   "docs/agents/travas.md"):
            self.p.writable(ok, "", "x = 1\n")
        for bad in ("apps/api/x.ts", "packages/db/x.ts", "tools/jorge/jorge.py", "tools/jorge/nucleo/runner.py",
                    "tools/jorge/logs/harness-v1/relatorio.md", "tools/alice-harness/.env", "tools/alice-harness/.env.local",
                    "tools/alice-harness/runs/a.json", "docs/plano/E4-F02/estado.json", "../fora.py", "/etc/passwd",
                    ".claude/settings.json"):
            with self.assertRaises((PermissionError, ValueError), msg=bad):
                self.p.writable(bad, "", "x")

    def test_orcamento_nao_sobe(self) -> None:
        f = "tools/alice-harness/feature.py"
        with self.assertRaises(PermissionError):
            self.p.writable(f, "biaBudget = 3\n", "biaBudget = 5\n")
        with self.assertRaises(PermissionError):
            self.p.writable(f, "", 'budget = d.get("biaBudget", 9)\n')
        with self.assertRaises(PermissionError):
            self.p.writable(f, "BIA_RESERVE = 1\n", "BIA_RESERVE = 2\n")
        self.p.writable(f, "biaBudget = 5\n", "biaBudget = 2\n")       # descer pode
        self.p.writable(f, "", 'budget = d.get("biaBudget", 3)\n')      # novo até o teto
        self.p.writable(f, "biaRequests = 1\n", "biaRequests = 7\n")    # contador não é orçamento
        self.p.writable("tools/alice-harness/tests/test_feature.py", "", '{"biaBudget": 9, "biaRequests": 3}\n')

    def test_trava_e_commit_separado(self) -> None:
        self.assertTrue(self.p.is_lock("tools/alice-harness/scripts/guard_hook.py", "", "x"))
        self.assertTrue(self.p.is_lock("tools/alice-harness/feature.py", "biaBudget = 3\n", "biaBudget = 2\n"))
        self.assertFalse(self.p.is_lock("tools/alice-harness/gates.py", "a\n", "a\nb\n"))
        self.assertFalse(self.p.is_lock("tools/alice-harness/tests/test_x.py", "", "estado.json biaBudget = 3\n"))
        self.p.writable("tools/alice-harness/scripts/guard_hook.py", "", "x")  # trava aplica, sem aprovação prévia

    def test_leitura(self) -> None:
        for bad in ("tools/alice-harness/.env", ".git/config", "node_modules/x/package.json"):
            with self.assertRaises(PermissionError, msg=bad):
                self.p.readable(bad)
        self.assertEqual(self.p.readable("tools/alice-harness/runs/plan-1.json"), (runner.REPO / "tools/alice-harness/runs/plan-1.json").resolve())
        self.assertEqual(self.p.readable("tools/alice-harness/.env.example"), (Path(self.tmp.name) / "tools/alice-harness/.env.example").resolve())


class SuiteTest(unittest.TestCase):
    def test_conta_falhas(self) -> None:
        self.assertEqual(runner.suite_fails("Ran 9 tests\n\nFAILED (failures=2, errors=1)"), 3)
        self.assertEqual(runner.suite_fails("Ran 9 tests\n\nOK"), 0)

    def test_vazamento_da_suite(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            wt = Path(d)
            subprocess.run(["git", "init", "-q", str(wt)], check=True)
            (wt / ".gitignore").write_text("__pycache__/\n")
            h = wt / runner.HARNESS / "tests"
            h.mkdir(parents=True)
            (h / "test_vaza.py").write_text(
                "import unittest, pathlib\n"
                "class T(unittest.TestCase):\n"
                "    def test_x(self):\n"
                "        p = pathlib.Path(__file__).resolve().parents[3] / 'docs/plano/X/vazou.txt'\n"
                "        p.parent.mkdir(parents=True, exist_ok=True); p.write_text('x')\n")
            ok, ran, _, leaks = runner.run_suite_clean(runner.Paths(runner.load_cfg(), wt), wt, 60)
            self.assertTrue(ok)
            self.assertEqual(leaks, ["docs/plano/X/vazou.txt"])
            self.assertFalse((wt / "docs/plano/X/vazou.txt").exists())

    def test_reparo_no_cfg(self) -> None:
        self.assertGreaterEqual(int(runner.load_cfg()["reparo"]["rodadas"]), 1)


class FeaturesTest(unittest.TestCase):
    def test_feature_concluida(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            for name, st in (("A", {"plan": {"status": "done"}, "tests": {"status": "done"}}),
                             ("B", {"plan": {"status": "done"}, "tests": {"status": "running"}}), ("C", {})):
                p = Path(d, "docs/plano", name)
                p.mkdir(parents=True)
                (p / "estado.json").write_text(json.dumps({"feature": name, "stages": st}))
            self.assertEqual(runner.done_features(Path(d)), ["A"])


if __name__ == "__main__":
    unittest.main()
