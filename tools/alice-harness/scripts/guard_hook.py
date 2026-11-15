#!/usr/bin/env python3
"""PreToolUse hook do Claude Code (e4-guardrails B). Nega, com exit 2:
(a) Read/Grep/Glob/Bash que toque tools/alice-harness/runs/ fora de retro-*;
(b) Write/Edit em arquivo de allowedPaths de cartão da Alice ainda não done (docs/plano/*.yaml);
(c) Bash com python3, node ou vitest que cite esses mesmos arquivos.
Done = id citado em commit (também "E3-T04 to E3-T06") ou status done em runs/plan-*.json.
Lê runs/ só aqui dentro; o bloqueio vale para as ferramentas do Claude."""
from __future__ import annotations

import fnmatch
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[3]
RUNS = REPO / "tools" / "alice-harness" / "runs"
CARD_ID = re.compile(r"\b(E\d+)-T(\d{2})(?:\s+(?:to|a|até)\s+E\d+-T(\d{2}))?\b")
RUNS_REF = re.compile(r"(?:^|[\s'\"=(/])(?:\S*alice-harness/)?runs/([^\s'\";|&)<>]*)")
INTERP = re.compile(r"(?:^|[\s;&|(/])(python3?|node|vitest|tsx|npx)\b")


def deny(msg: str) -> None:
    print(f"e4-guardrails: {msg}", file=sys.stderr)
    sys.exit(2)


def done_ids() -> set[str]:
    log = subprocess.run(["git", "-C", str(REPO), "log", "--format=%B"], capture_output=True, text=True).stdout
    ids = set()
    for e, a, b in CARD_ID.findall(log):
        for n in range(int(a), int(b or a) + 1):
            ids.add(f"{e}-T{n:02d}")
    for f in RUNS.glob("plan-*.json"):
        try:
            ids |= {r.get("task") for r in json.loads(f.read_text()) if r.get("status") == "done"}
        except (json.JSONDecodeError, OSError, AttributeError):
            continue
    return ids


def open_paths() -> list[str]:
    done, out = done_ids(), []
    for f in sorted((REPO / "docs" / "plano").glob("*.yaml")):
        for c in (yaml.safe_load(f.read_text()) or {}).get("cards") or []:
            if c.get("assignee") == "alice" and c.get("id") not in done:
                out += [str(p) for p in c.get("allowedPaths") or []]
    return out


CWD = Path.cwd()


def rel(path: str) -> str:
    p = Path(path)
    try:
        return str((p if p.is_absolute() else CWD / p).resolve().relative_to(REPO))
    except ValueError:
        return str(p)


def touches_runs(text: str) -> bool:
    if "runs/" not in text:
        return False
    if "alice-harness/runs" not in text and "alice-harness" not in str(CWD):
        return False
    for m in RUNS_REF.finditer(text):
        tail = (m.group(1) or "").rsplit("/", 1)[-1]
        if not tail.startswith("retro-"):
            return True
    return False


def main() -> None:
    global CWD
    ev = json.load(sys.stdin)
    CWD = Path(ev.get("cwd") or Path.cwd())
    tool, inp = ev.get("tool_name", ""), ev.get("tool_input") or {}
    path = inp.get("file_path") or inp.get("notebook_path") or inp.get("path") or ""
    cmd = inp.get("command") or ""
    if tool in ("Read", "Grep", "Glob"):
        target = rel(path) if path else ""
        if target.startswith("tools/alice-harness/runs") and not Path(target).name.startswith("retro-"):
            deny(f"{tool} em {target}: log de cartão é proibido (só retro-*). Erro 2 da lista.")
        if tool == "Glob" and "runs/" in str(inp.get("pattern", "")) and "retro-" not in str(inp.get("pattern", "")):
            deny("Glob em runs/: log de cartão é proibido (só retro-*).")
    if tool == "Bash" and touches_runs(cmd):
        deny("Bash toca tools/alice-harness/runs/ fora de retro-*: log de cartão é proibido. Erro 2 da lista.")
    if tool in ("Write", "Edit", "NotebookEdit", "MultiEdit") and path:
        target = rel(path)
        for p in open_paths():
            if target == p or fnmatch.fnmatch(target, p):
                deny(f"{tool} em {target}: arquivo de cartão da Alice ainda não done. Erro 1 da lista (escrever a solução).")
    if tool == "Bash" and INTERP.search(cmd):
        for p in open_paths():
            if p in cmd or Path(p).name in cmd:
                deny(f"Bash com interpretador cita {p}, arquivo de cartão não done. Erro 3 da lista (simular portão).")
    sys.exit(0)


if __name__ == "__main__":
    main()
