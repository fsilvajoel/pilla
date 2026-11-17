#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def rel_path(path: str, cwd: Path) -> str:
    p = Path(path)
    if not p.is_absolute():
        p = (cwd / p).resolve()
    try:
        return str(p.relative_to(cwd.resolve()))
    except ValueError:
        return str(p)


def guard_event(event: dict) -> dict:
    cwd = Path(event.get("cwd") or ".").resolve()
    tool_name = str(event.get("tool_name") or "")
    tool_input = event.get("tool_input") or {}
    target = str(tool_input.get("path") or tool_input.get("file_path") or tool_input.get("command") or "")

    if tool_name in {"Read", "Grep", "Glob"}:
        target_rel = rel_path(target, cwd)
        if "runs/" in target_rel and not target_rel.startswith("runs/retro-"):
            return {"allowed": False, "reason": "read access to protected run artifacts is denied"}

    if tool_name in {"Write", "Edit"}:
        target_rel = rel_path(target, cwd)
        if target_rel.startswith("runs/"):
            return {"allowed": False, "reason": "writes to runs/ are forbidden for regular edits"}

    raw_command = str(tool_input.get("command") or "")
    if raw_command and re.search(r"(^|\s)(git\s+commit|git\s+push|python3|node|vitest|npx)\b", raw_command):
        if "--no-verify" in raw_command or "runs/" in raw_command:
            return {"allowed": False, "reason": "command violates guard policy"}

    return {"allowed": True, "reason": "ok"}


def main() -> int:
    payload = json.loads(sys.stdin.read() or "{}")
    result = guard_event(payload)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    raise SystemExit(0 if result["allowed"] else 2)


if __name__ == "__main__":
    raise SystemExit(main())
