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
        if r.get("status") == "card_error":  # the card writer's error, not the model's (LI-056)
            flags = [" · ".join(str(r.get("message", "")).splitlines())[:200]]
        lines.append(f"| {r['task']} | {r.get('status')} | {r.get('seconds', '-')} | {r.get('attempts', '-')} | {r.get('toolCalls', '-')} | {total} | {'; '.join(flags) or 'ok'} |")
    if repeated:
        lines += ["", "## Erros de ferramenta mais repetidos", ""] + [f"- {n}× {msg}" for msg, n in repeated.most_common(5)]
    lines += ["", "Cartão com sinal → dividir, preparar melhor o esboço ou corrigir a ferramenta; registrar lição em docs/memoria/licoes.md."]
    text = "\n".join(lines) + "\n"
    out.write_text(text)
    return text
