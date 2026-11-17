#!/usr/bin/env python3
"""Ponto de entrada do harness: lista, estado, checks, delegação, workflow e fila."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from script.check_portable import find_forbidden, forbidden_tokens
from script.project_config import Config, load_config
from script.registry import build_manifest


def load_project_config(project_root: Path) -> Config:
    """Carrega o yaml do projeto; falha se ele não existir."""
    return load_config(project_root, required=True)


def build_summary(project_root: Path, config: Config) -> dict[str, object]:
    """Resumo do projeto: nome, entrada, checks e diretórios."""
    return {
        "project_root": str(project_root),
        "name": config.get("name", "unnamed"),
        "entrypoint": config.get("entrypoint"),
        "checks": config.get("checks", []),
        "directories": {
            "agent": config.get("agent_dir", "agent"),
            "skill": config.get("skill_dir", "skill"),
            "capability": config.get("capability_dir", "capability"),
            "policy": config.get("policy_dir", "policy"),
            "tool": config.get("tool_dir", "tools"),
            "workflow": config.get("workflow_dir", "workflow"),
            "gate": config.get("gate_dir", "gate"),
            "script": config.get("script_dir", "script"),
        },
    }


def run_workflow(project_root: Path, workflow_name: str) -> dict[str, object]:
    """Executa a definição de um workflow e devolve os metadados."""
    from script.run_workflow import run_workflow as run_workflow_def

    return run_workflow_def(project_root, workflow_name)


def run_batch(project_root: Path, tasks_dir: Path | None = None) -> dict[str, object]:
    """Roda as tarefas da fila (`tasks/` ou `tasks_dir`)."""
    from script.run_batch import discover_tasks, run_task

    target_dir = tasks_dir or project_root / "tasks"
    tasks = discover_tasks(target_dir)
    if not tasks:
        return {"tasks": [], "status": "empty", "project_root": str(project_root)}

    results = [run_task(task, project_root) for task in tasks]
    return {
        "tasks": [item["task"] for item in results],
        "status": "ok" if all(item["returncode"] == 0 for item in results) else "failed",
        "results": results,
    }


def project_status(project_root: Path) -> dict[str, object]:
    """Confere diretórios obrigatórios e textos proibidos (gate portable)."""
    required_dirs = [
        "agent",
        "skill",
        "capability",
        "policy",
        "workflow",
        "gate",
        "script",
        "tools",
    ]
    missing_dirs = [name for name in required_dirs if not (project_root / name).exists()]
    matches = [f"{path}:{token}" for path, token in find_forbidden(project_root, forbidden_tokens(project_root))]

    return {
        "project_root": str(project_root),
        "status": "ok" if not missing_dirs and not matches else "warning",
        "required_directories": required_dirs,
        "missing_directories": missing_dirs,
        "legacy_matches": matches,
        "components": build_manifest(project_root),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Ponto de entrada do Harness-adaV1")
    parser.add_argument("--project", type=Path, required=True, help="Raiz do projeto com o harness.project.yaml")
    parser.add_argument("--list", action="store_true", help="Lista os componentes encontrados no projeto")
    parser.add_argument("--status", action="store_true", help="Relatório de estado: diretórios obrigatórios e gate portable")
    parser.add_argument("--check", action="store_true", help="Roda os checks declarados no harness.project.yaml")
    parser.add_argument("--delegate", action="store_true", help="Decide entre executar localmente ou delegar, depois de validar")
    parser.add_argument("--delegate-to", help="Papel que recebe a delegação (opcional)")
    parser.add_argument("--reason", help="Motivo da delegação (opcional)")
    parser.add_argument("--workflow", metavar="NAME", help="Roda um workflow pelo nome e imprime os metadados")
    parser.add_argument("--batch", action="store_true", help="Roda as tarefas da fila do projeto ou de --tasks-dir")
    parser.add_argument("--tasks-dir", type=Path, help="Diretório com as tarefas para --batch")
    args = parser.parse_args()

    config = load_project_config(args.project)
    summary = build_summary(args.project, config)

    if args.workflow:
        result = run_workflow(args.project, args.workflow)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if args.batch:
        result = run_batch(args.project, args.tasks_dir)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result.get("status") in {"ok", "empty"} else 1

    if args.status:
        status = project_status(args.project)
        print(json.dumps(status, indent=2, ensure_ascii=False))
        return 0 if status["status"] == "ok" else 1

    if args.check:
        from script.run_checks import run_project_checks

        result = run_project_checks(args.project)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["status"] == "passed" else 1

    if args.delegate:
        from script.validate_then_delegate import decide_task

        result = decide_task(args.project, args.delegate_to, args.reason)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if args.list:
        summary["components"] = build_manifest(args.project)

    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
