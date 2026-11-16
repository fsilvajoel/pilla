"""Testes do runner e do hook do Jorge: python3 -m unittest tools/jorge/test_jorge.py (da raiz do repo)."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import jorge  # noqa: E402

HOOK = Path(__file__).resolve().parent / "guarda_claude.py"
REPO = Path(__file__).resolve().parents[2]


def hook(tool: str, **inp: str) -> int:
    r = subprocess.run([sys.executable, str(HOOK)], input=json.dumps({"tool_name": tool, "tool_input": inp}),
                       text=True, capture_output=True)
    return r.returncode


class HookTest(unittest.TestCase):
    def test_claude_nao_edita_harness(self) -> None:
        self.assertEqual(hook("Edit", file_path=str(REPO / "tools/alice-harness/cards.py")), 2)
        self.assertEqual(hook("Write", file_path=str(REPO / "docs/agents/travas.md")), 2)
        self.assertEqual(hook("Write", file_path=str(REPO / ".agents/policy.yaml")), 2)
        self.assertEqual(hook("Edit", file_path=str(REPO / "tools/jorge/jorge.py")), 2)
        self.assertEqual(hook("Edit", file_path=str(REPO / ".claude/settings.json")), 2)
        self.assertEqual(hook("Edit", file_path="/home/debian/code/alice-harness/alice.py"), 2)

    def test_claude_edita_produto(self) -> None:
        self.assertEqual(hook("Edit", file_path=str(REPO / "apps/api/src/x.ts")), 0)

    def test_bash(self) -> None:
        self.assertEqual(hook("Bash", command="sed -i s/a/b/ tools/alice-harness/cards.py"), 2)
        self.assertEqual(hook("Bash", command="echo x > tools/alice-harness/x.py"), 2)
        self.assertEqual(hook("Bash", command="git checkout -- tools/alice-harness/"), 2)
        self.assertEqual(hook("Bash", command="cat tools/alice-harness/README.md"), 0)
        self.assertEqual(hook("Bash", command="cd tools/alice-harness && python3 -m unittest discover -s tests 2>&1 | tail"), 0)
        self.assertEqual(hook("Bash", command="python3 tools/jorge/jorge.py review --escopo e.md"), 0)

    def test_logs_do_jorge(self) -> None:
        self.assertEqual(hook("Read", file_path=str(REPO / "tools/jorge/logs/harness-v1/relatorio.md")), 2)
        self.assertEqual(hook("Bash", command="cat tools/jorge/logs/harness-v1/runner.log"), 2)
        self.assertEqual(hook("Read", file_path=str(REPO / "tools/jorge/logs/harness-v1/pergunta.md")), 0)
        self.assertEqual(hook("Bash", command="ls ../.jorge-wt"), 2)


class PathsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.st = jorge.State({"wt": self.tmp.name, "travas_aprovadas": False, "version": "harness-v0"})
        self.p = jorge.Paths(jorge.load_cfg(), self.st)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_escrita(self) -> None:
        self.p.writable("tools/alice-harness/cards.py", "", "x = 1\n")
        for bad in ("apps/api/x.ts", "tools/jorge/jorge.py", "tools/alice-harness/.env", "tools/alice-harness/runs/a.json",
                    "docs/plano/E4-F02/estado.json", "../fora.py", "/etc/passwd", ".claude/settings.json"):
            with self.assertRaises((PermissionError, ValueError), msg=bad):
                self.p.writable(bad, "", "x")

    def test_trava(self) -> None:
        with self.assertRaises(PermissionError):
            self.p.writable("tools/alice-harness/scripts/guard_hook.py", "", "x")
        with self.assertRaises(PermissionError):
            self.p.writable("tools/alice-harness/feature.py", "a\n", "a\nbiaBudget = 9\n")
        self.st.d["travas_aprovadas"] = True
        self.p.writable("tools/alice-harness/scripts/guard_hook.py", "", "x")

    def test_leitura(self) -> None:
        for bad in ("tools/alice-harness/.env", "tools/alice-harness/runs/plan-1.json", ".git/config"):
            with self.assertRaises(PermissionError, msg=bad):
                self.p.readable(bad)
        self.p.readable("tools/alice-harness/runs/retro-20261116-102113.md")


if __name__ == "__main__":
    unittest.main()
