#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


def discover_workflows(workflow_dir: Path) -> dict[str, dict[str, str]]:
    if not workflow_dir.exists():
        return {}
    workflows: dict[str, dict[str, str]] = {}
    for path in sorted(workflow_dir.glob("*.md")):
        if path.name.startswith("_") or path.name == "README.md":
            continue
        title = ""
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("# "):
                title = line[2:].strip()
                break
        workflows[path.stem] = {"path": str(path), "title": title}
    return workflows


def run_workflow(project_root: Path, workflow_name: str) -> dict:
    workflow_dir = project_root / "workflow"
    workflows = discover_workflows(workflow_dir)
    if workflow_name not in workflows:
        raise KeyError(f"Workflow desconhecido: {workflow_name}")
    info = workflows[workflow_name]
    return {
        "workflow": workflow_name,
        "title": info["title"],
        "path": info["path"],
        "stages": ["plan", "execute", "validate", "review"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Roda uma definição de workflow do harness")
    parser.add_argument("--project", type=Path, required=True, help="Raiz do projeto com workflow/ e harness.project.yaml")
    parser.add_argument("--workflow", default="coordination", help="Nome do workflow a rodar")
    args = parser.parse_args()
    result = run_workflow(args.project, args.workflow)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
