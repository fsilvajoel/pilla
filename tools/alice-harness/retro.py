"""Retrospective after each queue: flag unhealthy cards and repeated tool errors (LI-016/LI-017)."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

LIMITS = {"seconds": 180, "attempts": 2, "toolCalls": 20}
MAX_TOOL_ERROR_RATE = 0.25


def health_flags(rec: dict) -> list[str]:
    flags = [f"{k} {rec.get(k)} > {v}" for k, v in LIMITS.items() if (rec.get(k) or 0) > v]
    calls = rec.get("toolCalls") or 0
    if calls and (rec.get("toolErrors") or 0) / calls > MAX_TOOL_ERROR_RATE:
        flags.append(f"erro de ferramenta em {rec['toolErrors']}/{calls} chamadas")
    return flags


def tool_error_summary(events: list[dict]) -> tuple[int, list[tuple[str, int]]]:
    errors = [f"{e.get('name')}: {str(e.get('result', ''))[:60]}" for e in events
              if e.get("kind") == "tool" and str(e.get("result", "")).startswith(("ERRO", "BLOQUEADO"))]
    return len(errors), Counter(errors).most_common(3)


def rounds_section(results: list[dict]) -> list[str]:
    """Rodadas do laço do plan-run, com tokens por rodada; no escalated, as notas da última reprovação, para o Claude
    decidir sem abrir log."""
    out: list[str] = []
    for r in results:
        if not r.get("rounds"):
            continue
        out += ["", f"## Rodadas de {r['task']} ({r.get('assignee')}): {r.get('status')}", "",
                "| Rodada | Quem escreve | Execução | Revisão | s | Alice entrada/saída | Bia entrada/saída | Requisições Bia |",
                "|---|---|---|---|---|---|---|---|"]
        for x in r["rounds"]:
            out.append(f"| {x['n']} | {x.get('writer')} | {x.get('exec')} | {x.get('review')} | {x.get('seconds', '-')} | "
                       f"{x.get('aliceIn', 0)}/{x.get('aliceOut', 0)} | {x.get('biaIn', 0)}/{x.get('biaOut', 0)} | {x.get('biaRequests', 0)} |")
        if r.get("status") == "escalated":
            out += ["", f"Escalado ao Claude depois de {len(r['rounds'])} rodadas; dependentes pulados. Notas da última reprovação:"]
            out += [f"- {' '.join(str(n).split())}" for n in r.get("lastNotes") or []] or ["- (a revisão não deixou nota com apoio no pronto)"]
        elif r.get("message") and r.get("status") != "done":
            out.append(f"\n{' '.join(str(r['message']).split())[:300]}")
    return out


def write_retro(results: list[dict], runs: Path, out: Path) -> str:
    lines = ["# Retrospectiva da fila", "", "| Cartão | Status | s | Tentativas | Chamadas | Erros de ferramenta | Sinais |", "|---|---|---|---|---|---|---|"]
    repeated: Counter = Counter()
    for r in results:
        runs_of = sorted((runs / r["task"]).glob("*/log.jsonl")) if (runs / r["task"]).exists() else []
        events = [json.loads(l) for l in runs_of[-1].read_text().splitlines()] if runs_of else []
        total, top = tool_error_summary(events)
        repeated.update(dict(top))
        rec = {**r, "toolErrors": total}
        flags = health_flags(rec) if r.get("status") in ("done", "failed") else []
        if r.get("status") == "needs_input":  # a pergunta só existia no log da execução, que o Claude não pode abrir
            flags = [f"pergunta da Alice: {' '.join(str(r.get('question', '?')).split())}" + (f" (resume {r['runDir']})" if r.get("runDir") else "")]
        if r.get("status") == "card_error":  # the card writer's error, not the model's (LI-056)
            flags = [" · ".join(str(r.get("message", "")).splitlines())[:200]]
        lines.append(f"| {r['task']} | {r.get('status')} | {r.get('seconds', '-')} | {r.get('attempts', '-')} | {r.get('toolCalls', '-')} | {total} | {'; '.join(flags) or 'ok'} |")
    lines += rounds_section(results)
    if repeated:
        lines += ["", "## Erros de ferramenta mais repetidos", ""] + [f"- {n}× {msg}" for msg, n in repeated.most_common(5)]
    lines += ["", "Cartão com sinal → dividir, preparar melhor o esboço ou corrigir a ferramenta; registrar lição em docs/memoria/licoes.md."]
    text = "\n".join(lines) + "\n"
    out.write_text(text)
    return text
