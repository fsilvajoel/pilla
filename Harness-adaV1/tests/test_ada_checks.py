import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_cli(*args):
    return subprocess.run(
        [sys.executable, str(ROOT / "script" / "ada.py"), *args],
        cwd=str(ROOT),
        text=True,
        capture_output=True,
        check=False,
    )


def test_ada_runs_configured_checks():
    proc = run_cli("--project", str(ROOT), "--check")
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["status"] == "passed"
    assert any(item["name"] == "portable" for item in payload["checks"])
    assert any(item["name"] == "tool-contract" for item in payload["checks"])
