#!/usr/bin/env python3
"""PreToolUse hook do Claude Code (decisão do Joel, 16/11/2026): o Jorge é o ÚNICO que altera o harness.
Nega ao Claude, com exit 2:
(a) Write/Edit/MultiEdit/NotebookEdit em tools/alice-harness/**, docs/agents/**, .agents/policy.yaml,
    tools/jorge/** (núcleo é do Joel, agente é do Jorge), .claude/settings*.json, .claude/hooks/** e nas units
    systemd do Jorge;
(b) Bash que cite esses caminhos junto de operação de escrita (redirecionamento, sed -i, tee, mv, cp, rm,
    git add/checkout/restore/apply/reset/revert/cherry-pick/am/stash, patch, truncate, open(...'w'));
(c) Read/Grep/Glob/Bash que toque tools/jorge/logs/ ou o worktree .jorge-wt/: o Jorge só devolve status.
Rodar o próprio Jorge (`tools/jorge/jorge.py review|auto|anotar`) é permitido."""
from __future__ import annotations

import json
import os
import re
import sys

REPO = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
PROTECTED = re.compile(
    r"(?:^|[^\w.-])(?:tools/alice-harness/|code/alice-harness(?:/|$)|docs/agents/|\.agents/policy\.yaml|tools/jorge/"
    r"|\.claude/settings[^/]*\.json|\.claude/hooks/|\.config/systemd/user/jorge-)"
)
LOGS = re.compile(r"(?:tools/jorge/logs|\.jorge-wt)(?:/|\b)")
WRITER = re.compile(
    r"(?:[^0-9&]>|>>|\bsed\s+-i|\btee\b|\bmv\b|\bcp\b|\brm\b|\btruncate\b|\bpatch\b|\binstall\b|\bln\b"
    r"|\bgit\b[^|;&]*\b(?:add|checkout|restore|apply|reset|revert|cherry-pick|am|stash|mv|rm)\b"
    r"|open\([^)]*['\"][wa]|write_text|\bperl\s+-[a-z]*i)"
)
RUN_JORGE = re.compile(r"^\s*(?:cd\s+\S+\s*&&\s*)?(?:python3\s+)?\S*tools/jorge/jorge\.py\s+(?:review|auto|anotar)\b[^|;&><`$]*$")


def deny(msg: str) -> None:
    print(f"guarda-jorge: {msg}", file=sys.stderr)
    sys.exit(2)


def rel(path: str) -> str:
    p = os.path.realpath(os.path.expanduser(path))
    return os.path.relpath(p, REPO) if p.startswith(REPO + os.sep) else p


def main() -> None:
    data = json.load(sys.stdin)
    tool = data.get("tool_name", "")
    inp = data.get("tool_input") or {}
    if tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        path = rel(inp.get("file_path") or inp.get("notebook_path") or "")
        if PROTECTED.search("/" + path):
            deny(f"{path} é área do Jorge/núcleo. Anote o problema com `tools/jorge/jorge.py anotar \"...\"` para o próximo Review.")
        return
    if tool in ("Read", "Grep", "Glob"):
        text = " ".join(rel(str(v)) if k in ("file_path", "path") else str(v) for k, v in inp.items())
        if LOGS.search(text):
            deny("os logs do Jorge não são para o Claude; só o status.")
        return
    if tool == "Bash":
        cmd = str(inp.get("command") or "")
        if RUN_JORGE.match(cmd):
            return
        if LOGS.search(cmd):
            deny("os logs/worktree do Jorge não são para o Claude; só o status.")
        if PROTECTED.search(cmd) and WRITER.search(cmd):
            deny("comando escreve na área do Jorge/núcleo. Só o Jorge altera o harness; anote com jorge.py anotar.")


if __name__ == "__main__":
    main()
