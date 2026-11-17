#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


IGNORED_NAMES = {"README.md", "_modelo.md", "__init__.py", "_contract.py"}


def discover_entries(base_dir: Path) -> list[str]:
    if not base_dir.exists():
        return []
    items: list[str] = []
    for item in sorted(base_dir.iterdir()):
        if item.name in IGNORED_NAMES:
            continue
        if item.is_dir():
            items.append(item.name)
        elif item.is_file():
            items.append(item.stem)
    return items


def build_manifest(project_root: Path) -> dict[str, list[str]]:
    mapped = {
        "agent": project_root / "agent",
        "skill": project_root / "skill",
        "capability": project_root / "capability",
        "policy": project_root / "policy",
        "workflow": project_root / "workflow",
        "gate": project_root / "gate",
        "script": project_root / "script",
        "tools": project_root / "tools",
    }
    return {name: discover_entries(path) for name, path in mapped.items()}
