"""Testes da conversa Joel ↔ Jorge: python3 -m unittest tools/jorge/nucleo/test_conversa.py (da raiz do repo).
A API nunca é chamada: runner.chat é trocado por respostas prontas."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import conversa  # noqa: E402
import runner  # noqa: E402

HOOK = Path(__file__).resolve().parent / "guarda_claude.py"


def texto(t: str, cred: float = 1.0) -> dict[str, Any]:
    return {"choices": [{"message": {"role": "assistant", "content": t}}], "usage": {"credits_used": cred}}


def ferramenta(nome: str, args: dict[str, Any], cred: float = 1.0) -> dict[str, Any]:
    call = {"id": f"c-{nome}", "type": "function", "function": {"name": nome, "arguments": json.dumps(args)}}
    return {"choices": [{"message": {"role": "assistant", "content": None, "tool_calls": [call]}}],
            "usage": {"credits_used": cred}}


class ConversaTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        logs = Path(self.tmp.name)
        self.patches = [mock.patch.object(conversa, "LOGS", logs), mock.patch.object(conversa, "CONVERSAS", logs / "conversas"),
                        mock.patch.object(runner, "LOGS", logs), mock.patch.object(runner, "CAIXA", logs / "caixa.md")]
        for p in self.patches:
            p.start()
        self.cfg = runner.load_cfg()
        self.respostas: list[dict[str, Any]] = []
        self.enviado: list[list[dict[str, Any]]] = []

        def chat(cfg: runner.Json, st: runner.State, tools: list[runner.Json]) -> runner.Json:
            self.enviado.append([dict(m) for m in st.d["messages"]])
            data = self.respostas.pop(0)
            runner.add_usage(st, data)
            return data

        self.patches.append(mock.patch.object(runner, "chat", chat))
        self.patches[-1].start()

    def tearDown(self) -> None:
        for p in reversed(self.patches):
            p.stop()
        self.tmp.cleanup()

    def test_responde_e_continua_a_mesma_conversa(self) -> None:
        self.respostas = [texto("oi, Joel"), texto("segue")]
        st = conversa.abrir(self.cfg, False, None)
        self.assertEqual(conversa.responder(self.cfg, st, "oi"), "oi, Joel")
        st2 = conversa.abrir(self.cfg, False, None)
        self.assertEqual(st2.d["id"], st.d["id"])
        self.assertEqual(conversa.responder(self.cfg, st2, "e aí?"), "segue")
        self.assertEqual([m["role"] for m in st2.d["messages"]], ["system", "user", "assistant", "user", "assistant"])
        self.assertIn("Modo conversa", st2.d["messages"][0]["content"])

    def test_nova_abre_outra(self) -> None:
        a = conversa.abrir(self.cfg, False, None)
        with mock.patch.object(conversa, "datetime") as dt:
            dt.now.return_value.strftime.return_value = "outra"
            b = conversa.abrir(self.cfg, True, None)
        self.assertNotEqual(a.d["id"], b.d["id"])

    def test_le_mas_nao_escreve(self) -> None:
        self.respostas = [ferramenta("read_file", {"path": "tools/jorge/agente/config.yaml", "end": 3}),
                          ferramenta("write_file", {"path": "tools/alice-harness/x.py", "content": "x"}),
                          texto("pronto")]
        st = conversa.abrir(self.cfg, False, None)
        self.assertEqual(conversa.responder(self.cfg, st, "olhe"), "pronto")
        tools = [m["content"] for m in st.d["messages"] if m["role"] == "tool"]
        self.assertIn("config.yaml", tools[0])
        self.assertIn("só leitura", tools[1])
        self.assertFalse((runner.REPO / "tools/alice-harness/x.py").exists())
        nomes = {t["function"]["name"] for t in conversa.conversa_specs()}
        self.assertEqual(nomes, set(conversa.LEITURA) | {"registrar_combinado"})

    def test_segredo_continua_proibido(self) -> None:
        self.respostas = [ferramenta("read_file", {"path": "tools/alice-harness/.env"}), texto("ok")]
        st = conversa.abrir(self.cfg, False, None)
        conversa.responder(self.cfg, st, "leia o .env")
        self.assertIn("ERRO", [m for m in st.d["messages"] if m["role"] == "tool"][0]["content"])

    def test_combinado_vai_para_a_caixa(self) -> None:
        self.respostas = [ferramenta("registrar_combinado", {"texto": "cobertura 0/0 reprova"}), texto("anotado")]
        st = conversa.abrir(self.cfg, False, None)
        conversa.responder(self.cfg, st, "combinado?")
        caixa = runner.CAIXA.read_text()
        self.assertIn("cobertura 0/0 reprova", caixa)
        self.assertIn(st.d["id"], caixa)

    def test_limite_de_passos_forca_resposta(self) -> None:
        cfg = dict(self.cfg, conversa={"passos_por_mensagem": 2})
        self.respostas = [ferramenta("search_code", {"pattern": "x"})] * 3 + [texto("parei")]
        st = conversa.abrir(cfg, False, None)
        self.assertEqual(conversa.responder(cfg, st, "procure"), "parei")
        self.assertIn("Limite desta mensagem", json.dumps(st.d["messages"], ensure_ascii=False))

    def test_teto_da_conversa(self) -> None:
        cfg = dict(self.cfg, conversa={"teto_creditos_conversa": 5})
        self.respostas = [texto("caro", cred=6)]
        st = conversa.abrir(cfg, False, None)
        conversa.responder(cfg, st, "1")
        self.assertIn("teto", conversa.responder(cfg, st, "2"))
        self.assertEqual(self.respostas, [])

    def test_corta_resultado_antigo(self) -> None:
        self.respostas = [ferramenta("read_file", {"path": "tools/jorge/nucleo/runner.py"}), texto("a"), texto("b")]
        st = conversa.abrir(self.cfg, False, None)
        conversa.responder(self.cfg, st, "leia")
        conversa.responder(self.cfg, st, "e?")
        tool = [m for m in self.enviado[-1] if m["role"] == "tool"][0]["content"]
        self.assertLess(len(tool), conversa.CORTE_FERRAMENTA + 60)


class HookConversaTest(unittest.TestCase):
    def hook(self, cmd: str) -> int:
        r = subprocess.run([sys.executable, str(HOOK)], input=json.dumps({"tool_name": "Bash", "tool_input": {"command": cmd}}),
                           text=True, capture_output=True)
        return r.returncode

    def test_claude_nao_conversa_com_o_jorge(self) -> None:
        self.assertEqual(self.hook('python3 tools/jorge/jorge.py conversar "oi"'), 2)
        self.assertEqual(self.hook("cd /home/debian/code/pilla && tools/jorge/jorge.py conversar --nova x"), 2)
        self.assertEqual(self.hook('python3 tools/jorge/jorge.py anotar "x"'), 0)


if __name__ == "__main__":
    unittest.main()
