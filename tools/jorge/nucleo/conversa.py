"""Conversa do Joel com o Jorge (proposta de 16/11/2026): canal direto, em ida e volta, SÓ LEITURA.

Uso:
  jorge.py conversar "mensagem"          # continua a conversa aberta (ou abre uma) e imprime a resposta
  jorge.py conversar                     # modo interativo (terminal): /nova abre outra conversa, /sair encerra
  jorge.py conversar --nova "mensagem"   # começa uma conversa nova
  jorge.py conversar --modelo gpt-6-astra "mensagem"

Regras:
- O Jorge só lê (list_files, read_file, search_code, metricas). Nada de escrita, suíte, commit ou push.
- O que for combinado ele registra com `registrar_combinado` na caixa de entrada; entra no próximo Review
  (timer) ou na hora com `jorge.py review --escopo "aplicar o combinado na conversa"`.
- Histórico e custo ficam em tools/jorge/logs/conversas/<id>/ (o Claude não lê; o hook também nega ao Claude
  rodar `conversar`: é canal do Joel).
- Trava própria (logs/.conversa.lock): não disputa a trava do Review; pode conversar com um Review rodando.
"""
from __future__ import annotations

import argparse
import fcntl
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import runner
from runner import AGENTE, HERE, LOGS, REPO, Json, State, Tools, anotar, now, tool_specs

CONVERSAS = LOGS / "conversas"
ATUAL = "atual.txt"
LEITURA = ("list_files", "read_file", "search_code", "metricas")
CORTE_FERRAMENTA = 300  # resultado de ferramenta de turnos anteriores é cortado para não reler tudo a cada mensagem

PADRAO = {"passos_por_mensagem": 15, "teto_creditos_mensagem": 150, "teto_creditos_conversa": 600}

MODO = """# Modo conversa (definido pelo núcleo; vale acima do resto deste prompt)
Você está conversando diretamente com o Joel, dono do projeto, fora de um Review.
- Só leitura: você NÃO altera nada agora. Não existe fase, relatório nem submit_report/finish nesta conversa.
- Responda em português do Brasil, curto e direto: o Joel lê pelo celular. Cite arquivo:linha quando ajudar.
- Antes de afirmar algo sobre o harness ou sobre um Review passado, confira com as ferramentas (os relatórios
  ficam em tools/jorge/logs/harness-vN/relatorio.md).
- Quando vocês combinarem uma mudança, registre-a com registrar_combinado (uma por chamada, com o porquê).
  Diga ao Joel que ela entra no próximo Review, ou na hora com
  `python3 tools/jorge/jorge.py review --escopo "aplicar o combinado na conversa"`.
- Se o pedido exigir algo que o núcleo proíbe (ex.: subir orçamento da Bia, mexer em nucleo/), explique o porquê
  e diga o que o Joel precisaria mudar no núcleo."""


def conversa_specs() -> list[Json]:
    specs = [t for t in tool_specs("analise") if t["function"]["name"] in LEITURA]
    specs.append({"type": "function", "function": {
        "name": "registrar_combinado",
        "description": "Registra na caixa de entrada do próximo Review algo combinado com o Joel nesta conversa.",
        "parameters": {"type": "object", "properties": {"texto": {"type": "string"}}, "required": ["texto"]}}})
    return specs


def ultimos_reviews(n: int = 5) -> str:
    linhas: list[tuple[int, str]] = []
    for p in LOGS.glob("harness-v*/estado.json"):
        try:
            d: Json = json.loads(p.read_text())
            num = int(p.parent.name.removeprefix("harness-v"))
        except (OSError, ValueError, json.JSONDecodeError):
            continue
        motivo = f" motivo={d['motivo']}" if d.get("motivo") else ""
        linhas.append((num, f"- {p.parent.name}: {d.get('status', '?')}{motivo} (início {d.get('inicio', '?')})"))
    return "\n".join(t for _, t in sorted(linhas)[-n:]) or "- (nenhum)"


def sistema() -> str:
    agente = AGENTE / "jorge.md"
    papel = agente.read_text() if agente.is_file() else (HERE / "padrao" / "jorge.md").read_text()
    return (MODO + "\n\n---\n" + papel + "\n\n---\n# Regras fixas do núcleo\n" + (HERE / "regras.md").read_text()
            + "\n\n---\n# Últimos Reviews\n" + ultimos_reviews())


def abrir(cfg: Json, nova: bool, modelo: Optional[str]) -> State:
    CONVERSAS.mkdir(parents=True, exist_ok=True)
    atual = CONVERSAS / ATUAL
    cid = "" if nova or not atual.exists() else atual.read_text().strip()
    if cid and (CONVERSAS / cid / "estado.json").is_file():
        st = State(json.loads((CONVERSAS / cid / "estado.json").read_text()))
        if modelo in cfg["modelos_ok"]:
            st.d["model"] = modelo
        return st
    cid = datetime.now().strftime("%Y%m%d-%H%M%S")
    st = State({
        "version": f"conversas/{cid}", "id": cid, "phase": "conversa", "wt": str(REPO), "inicio": now(),
        "model": modelo if modelo in cfg["modelos_ok"] else cfg["api"]["model"],
        "repeat": 0, "suites": [], "baseline_ran": 0, "combinados": [],
        "usage": {"requisicoes": 0, "erros": 0, "sem_usage": 0, "entrada": 0, "saida": 0, "raciocinio": 0,
                  "cache_lido": 0, "creditos": 0.0, "modelos": []},
        "messages": [{"role": "system", "content": sistema()}],
    })
    st.save()
    atual.write_text(cid + "\n")
    return st


def cortar_antigos(st: State) -> None:
    for m in st.d["messages"]:
        c = m.get("content")
        if m.get("role") == "tool" and isinstance(c, str) and len(c) > CORTE_FERRAMENTA:
            m["content"] = c[:CORTE_FERRAMENTA] + " [... cortado; leia de novo se precisar]"


def responder(cfg: Json, st: State, texto: str) -> str:
    lim: Json = dict(PADRAO, **(cfg.get("conversa") or {}))
    passos = int(lim["passos_por_mensagem"])
    teto_msg, teto_conv = float(lim["teto_creditos_mensagem"]), float(lim["teto_creditos_conversa"])
    gasto0 = float(st.d["usage"]["creditos"])
    if gasto0 >= teto_conv:
        return f"(teto de {teto_conv:g} créditos desta conversa atingido; abra outra com --nova)"
    cortar_antigos(st)
    st.d["messages"].append({"role": "user", "content": texto})
    tools = Tools(cfg, st)
    specs = conversa_specs()
    forcado = False
    for passo in range(passos + 2):
        gasto = float(st.d["usage"]["creditos"])
        if not forcado and (passo >= passos or gasto - gasto0 >= teto_msg or gasto >= teto_conv):
            forcado = True
            st.d["messages"].append({"role": "user", "content": "Limite desta mensagem atingido. Responda agora em texto, sem ferramentas, com o que já sabe."})
        msg: Json = runner.chat(cfg, st, specs)["choices"][0]["message"]
        st.d["messages"].append({k: v for k, v in msg.items() if k in ("role", "content", "tool_calls") and v is not None})
        calls: list[Json] = msg.get("tool_calls") or []
        if not calls:
            st.save()
            return str(msg.get("content") or "").strip() or "(resposta vazia)"
        for c in calls:
            st.d["messages"].append({"role": "tool", "tool_call_id": c["id"], "content": executar(tools, st, c, forcado)})
        st.save()
    return "(o Jorge não respondeu dentro do limite desta mensagem)"


def executar(tools: Tools, st: State, call: Json, forcado: bool) -> str:
    if forcado:
        return "ERRO: limite atingido; responda em texto."
    name = call["function"]["name"]
    try:
        args: Json = json.loads(call["function"].get("arguments") or "{}")
    except json.JSONDecodeError:
        return "ERRO: argumentos inválidos"
    if name == "registrar_combinado":
        texto = str(args.get("texto") or "").strip()
        if not texto:
            return "ERRO: texto vazio"
        anotar(f"[combinado com o Joel na conversa {st.d['id']}] {texto}")
        st.d["combinados"].append({"texto": texto, "em": now()})
        return "registrado na caixa de entrada do próximo Review"
    if name not in LEITURA:
        return f"ERRO: {name} não existe na conversa (só leitura)"
    return tools.call(name, args)


def rodape(st: State, antes: float, req_antes: int) -> str:
    u = st.d["usage"]
    return (f"— {st.d['model']} · {u['requisicoes'] - req_antes} chamadas · {u['creditos'] - antes:.1f} créditos "
            f"(conversa {st.d['id']}: {u['creditos']:.1f})")


def turno(cfg: Json, st: State, texto: str) -> str:
    antes, req = float(st.d["usage"]["creditos"]), int(st.d["usage"]["requisicoes"])
    resposta = responder(cfg, st, texto)
    return f"{resposta}\n\n{rodape(st, antes, req)}"


def main(args: argparse.Namespace) -> int:
    LOGS.mkdir(exist_ok=True)
    lock = (LOGS / ".conversa.lock").open("w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("outra conversa com o Jorge está aberta neste momento", file=sys.stderr)
        return 11
    try:
        cfg = runner.load_cfg()
        st = abrir(cfg, bool(args.nova), args.modelo)
        if args.mensagem:
            print(turno(cfg, st, args.mensagem))
            return 0
        if not sys.stdin.isatty():
            texto = sys.stdin.read().strip()
            if texto:
                print(turno(cfg, st, texto))
            return 0
        print(f"Conversa {st.d['id']} com o Jorge ({st.d['model']}). /nova abre outra, /sair encerra.")
        while True:
            try:
                texto = input("\nJoel> ").strip()
            except (EOFError, KeyboardInterrupt):
                return 0
            if texto in ("/sair", "/q"):
                return 0
            if texto == "/nova":
                st = abrir(cfg, True, args.modelo)
                print(f"Conversa {st.d['id']} aberta.")
                continue
            if texto:
                print("\nJorge> " + turno(cfg, st, texto))
    except Exception as e:  # noqa: BLE001
        print(f"erro: {type(e).__name__}: {e}", file=sys.stderr)
        return 40
