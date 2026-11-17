from __future__ import annotations

import re
from pathlib import Path

from tools.list_files import list_files

TOOL_CONTRACT = {
    "name": "search_code",
    "purpose": "Busca um padrão regex nos arquivos-fonte do projeto.",
    "inputs": {"path": "string", "pattern": "string"},
    "outputs": {"result": "string"},
}


def search_code(path: str = ".", pattern: str = ".") -> str:
    root = Path(path)
    if not root.exists():
        raise FileNotFoundError(f"Caminho inexistente: {path}")

    regex = re.compile(pattern)
    hits: list[str] = []
    for item in sorted(root.rglob("*")):
        if not item.is_file():
            continue
        if any(part in {".git", "node_modules", "dist", ".turbo", ".next", "__pycache__", ".venv", ".pytest_cache"} for part in item.parts):
            continue
        try:
            text = item.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for line_number, line in enumerate(text.splitlines(), start=1):
            if regex.search(line):
                hits.append(f"{item.relative_to(root).as_posix()}:{line_number}:{line.strip()[:200]}")
    return "\n".join(hits) if hits else "(nenhuma ocorrência)"
