from __future__ import annotations

import re
from pathlib import Path

TOOL_CONTRACT = {
    "name": "replace_function",
    "purpose": "Substitui pelo nome o bloco inteiro de uma função num arquivo-fonte.",
    "inputs": {"path": "string", "name": "string", "code": "string"},
    "outputs": {"result": "string"},
}


def replace_function(path: str, name: str, code: str) -> str:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Caminho inexistente: {path}")

    original = file_path.read_text(encoding="utf-8")
    lines = original.splitlines(keepends=True)
    pattern = re.compile(rf"^(\s*)def\s+{re.escape(name)}\s*\(.*?\):\s*$", re.MULTILINE)
    match = pattern.search(original)

    if match is None:
        raise ValueError(f"Função não encontrada: {name}")

    start_line = original.count("\n", 0, match.start()) + 1
    indent = match.group(1)
    end_index = start_line - 1
    current_indent = 0

    for index in range(start_line, len(lines)):
        line = lines[index]
        stripped = line.lstrip()
        if not stripped:
            continue
        if line.startswith(indent + " ") or line.startswith(indent + "\t"):
            current_indent += 1
            continue
        if current_indent == 0:
            end_index = index
            break
        current_indent = 0

    replacement = code.rstrip("\n") + "\n"
    if end_index == start_line - 1:
        end_index = len(lines)

    new_lines = lines[: start_line - 1] + [replacement] + lines[end_index:]
    file_path.write_text("".join(new_lines), encoding="utf-8")
    return f"ok: function {name} replaced in {path}"
