#!/usr/bin/env python3
"""Roda os checks declarados em `checks` no `harness.project.yaml`."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import TypedDict

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from script.project_config import Config, get_str_list, load_config


class CheckResult(TypedDict, total=False):
    name: str
    status: str
    reason: str
    returncode: int
    stdout: str
    stderr: str


class ChecksReport(TypedDict):
    project_root: str
    status: str
    checks: list[CheckResult]


def command_for_check(project_root: Path, check_name: str) -> list[str] | None:
    """Comando de cada check conhecido; None quando não há executor."""
    script_root = project_root / "script"
    mapping: dict[str, list[str]] = {
        "portable": [sys.executable, str(script_root / "check_portable.py"), str(project_root)],
        "skill-format": [sys.executable, str(script_root / "check_skill_format.py"), str(project_root / "skill")],
        "tool-contract": [sys.executable, str(script_root / "check_tool_contract.py")],
        "redact": [sys.executable, "-c", "from tools.redact import redact; print(redact('token=abc123'))"],
        "edit-guard": [sys.executable, str(script_root / "guard_hook.py")],
    }
    command = mapping.get(check_name)
    if command is None:
        return None
    if check_name == "edit-guard" and not (script_root / "guard_hook.py").exists():
        return None
    return command


def run_check(project_root: Path, check_name: str) -> CheckResult:
    """Roda um check e devolve status, código e saídas."""
    command = command_for_check(project_root, check_name)
    if command is None:
        return {"name": check_name, "status": "skipped", "reason": "nenhum executor configurado"}

    completed = subprocess.run(command, cwd=str(project_root), capture_output=True, text=True, check=False)
    return {
        "name": check_name,
        "status": "passed" if completed.returncode == 0 else "failed",
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
    }


def run_project_checks(project_root: Path) -> ChecksReport:
    """Roda todos os checks do yaml; passa se nenhum falhar."""
    config: Config = load_config(project_root)
    results = [run_check(project_root, name) for name in get_str_list(config, "checks")]
    status = "passed" if all(item.get("status") in {"passed", "skipped"} for item in results) else "failed"
    return {"project_root": str(project_root), "status": status, "checks": results}


def main() -> int:
    project_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    result = run_project_checks(project_root)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
