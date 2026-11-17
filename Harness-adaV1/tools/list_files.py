from __future__ import annotations

from pathlib import Path

TOOL_CONTRACT = {
    "name": "list_files",
    "purpose": "Lista arquivos sob a raiz do projeto, sem diretórios de build e cache.",
    "inputs": {"path": "string"},
    "outputs": {"result": "string"},
}


EXCLUDED_DIRS = {".git", "node_modules", "dist", ".turbo", ".next", "__pycache__", ".venv", ".pytest_cache"}


def list_files(path: str = ".") -> str:
    root = Path(path)
    if not root.exists():
        raise FileNotFoundError(f"Caminho inexistente: {path}")

    files: list[str] = []
    for item in sorted(root.rglob("*")):
        if item.is_dir() and item.name in EXCLUDED_DIRS:
            continue
        if item.is_file() and not any(part in EXCLUDED_DIRS for part in item.parts):
            files.append(item.relative_to(root).as_posix())
    return "\n".join(files) if files else "(vazio)"
