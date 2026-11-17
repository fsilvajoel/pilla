#!/usr/bin/env python3
"""Valida localmente antes de delegar (policy/delegation.md).

Sem destino explícito, a falha estrutural vai para o papel `platform`.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from script.run_checks import run_project_checks


DEFAULT_DELEGATE = "platform"


def decide_task(project_root: Path, delegated_to: str | None = None, reason: str | None = None) -> dict[str, object]:
    """Executa localmente se os checks passam; senão delega."""
    checks = run_project_checks(project_root)
    if delegated_to:
        return {
            "decision": "delegate",
            "project_root": str(project_root),
            "delegated_to": delegated_to,
            "reason": reason or "delegação explícita pedida",
            "checks": checks,
        }

    if checks["status"] == "passed":
        return {
            "decision": "execute",
            "project_root": str(project_root),
            "reason": "validação local passou; sem necessidade de delegar",
            "checks": checks,
        }

    return {
        "decision": "delegate",
        "project_root": str(project_root),
        "delegated_to": DEFAULT_DELEGATE,
        "reason": reason or "validação local falhou antes da delegação",
        "checks": checks,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Decide se a tarefa roda localmente ou é delegada, depois de validar")
    parser.add_argument("--project", type=Path, required=True, help="Raiz do projeto a validar")
    parser.add_argument("--delegate-to", help="Papel que recebe a tarefa delegada (opcional)")
    parser.add_argument("--reason", help="Motivo da delegação (opcional)")
    args = parser.parse_args()

    result = decide_task(args.project, args.delegate_to, args.reason)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
