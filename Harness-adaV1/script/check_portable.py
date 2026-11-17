#!/usr/bin/env python3
"""Gate portable: o harness não pode citar o projeto alvo nem caminhos locais.

A lista de textos proibidos fica em `portable.forbidden` no
`harness.project.yaml`, que é o único arquivo autorizado a contê-los.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from script.project_config import CONFIG_NAME, get_str_list, load_config

SKIPPED_PARTS = {".git", ".venv", "__pycache__", ".pytest_cache", ".harness"}


def forbidden_tokens(project_root: Path) -> list[str]:
    """Lê `portable.forbidden` do yaml do projeto."""
    return get_str_list(load_config(project_root), "portable", "forbidden")


def find_forbidden(project_root: Path, tokens: list[str]) -> list[tuple[str, str]]:
    """Devolve pares (caminho relativo, texto proibido) encontrados."""
    matches: list[tuple[str, str]] = []
    config_path = project_root / CONFIG_NAME
    for path in sorted(project_root.rglob("*")):
        if not path.is_file() or path == config_path:
            continue
        if any(part in SKIPPED_PARTS for part in path.relative_to(project_root).parts):
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for token in tokens:
            if token in content:
                matches.append((str(path.relative_to(project_root)), token))
    return matches


def main() -> int:
    project_root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT
    tokens = forbidden_tokens(project_root)
    if not tokens:
        print("Gate portable falhou.")
        print(f"- {CONFIG_NAME} não declara portable.forbidden")
        return 1
    matches = find_forbidden(project_root, tokens)
    if matches:
        print("Gate portable falhou.")
        for path, token in matches:
            print(f"- {path} contém texto proibido: {token}")
        return 1
    print("Gate portable passou.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
