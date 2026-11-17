#!/usr/bin/env python3
from __future__ import annotations

import ast
from pathlib import Path

root = Path(__file__).resolve().parents[1]
tools_dir = root / "tools"
errors: list[str] = []

for file in sorted(tools_dir.glob("*.py")):
    if file.name in {"__init__.py", "_contract.py"}:
        continue
    try:
        tree = ast.parse(file.read_text(encoding="utf-8"), filename=str(file))
    except SyntaxError as exc:
        errors.append(f"{file.name}: syntax error: {exc}")
        continue

    has_contract = any(
        isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "TOOL_CONTRACT" for target in node.targets)
        for node in tree.body
    )
    if not has_contract:
        errors.append(f"{file.name}: missing TOOL_CONTRACT")

if errors:
    print("Gate tool-contract falhou.")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("Gate tool-contract passou.")
