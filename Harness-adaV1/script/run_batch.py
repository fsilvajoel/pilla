#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def discover_tasks(tasks_dir: Path) -> list[Path]:
    if not tasks_dir.exists():
        return []
    return sorted(tasks_dir.glob("*.yaml")) + sorted(tasks_dir.glob("*.yml"))


def run_task(task_path: Path, repo_root: Path) -> dict:
    command = ["python3", str(task_path)]
    completed = subprocess.run(command, cwd=str(repo_root), capture_output=True, text=True, check=False)
    return {
        "task": task_path.name,
        "returncode": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Roda em sequência as tarefas da fila")
    parser.add_argument("--repo", type=Path, required=True, help="Raiz do repositório")
    parser.add_argument("--tasks-dir", type=Path, default=None, help="Diretório com as tarefas em YAML")
    args = parser.parse_args()

    tasks_dir = args.tasks_dir or args.repo / "tasks"
    tasks = discover_tasks(tasks_dir)
    if not tasks:
        print(json.dumps({"tasks": [], "status": "empty"}, indent=2, ensure_ascii=False))
        return 0

    results = [run_task(task, args.repo) for task in tasks]
    print(json.dumps({"tasks": [t["task"] for t in results], "status": "ok", "results": results}, indent=2, ensure_ascii=False))
    return 0 if all(item["returncode"] == 0 for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
