#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Sequence


def run_cmd(command: Sequence[str], cwd: str | Path | None = None, timeout: int | None = None) -> tuple[int, str, str]:
    """Executa um comando de shell e devolve (exit_code, stdout, stderr)."""
    completed = subprocess.run(
        list(command),
        cwd=str(cwd) if cwd is not None else None,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    return completed.returncode, completed.stdout, completed.stderr


TOOL_CONTRACT = {
    "name": "run_cmd",
    "purpose": "Executa um comando capturando stdout e stderr.",
    "inputs": {
        "command": "Sequence[str]",
        "cwd": "str | Path | None",
        "timeout": "int | None",
    },
    "outputs": {
        "result": "tuple[int, str, str]",
    },
}
