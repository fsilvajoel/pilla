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


def test_delegate_decision_runs_local_validation_first():
    proc = run_cli("--project", str(ROOT), "--delegate")
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["decision"] in {"execute", "delegate"}
    assert "checks" in payload


def test_delegate_to_explicit_target_returns_handoff():
    proc = run_cli("--project", str(ROOT), "--delegate", "--delegate-to", "platform", "--reason", "structural issue")
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["decision"] == "delegate"
    assert payload["delegated_to"] == "platform"
    assert "structural issue" in payload["reason"]
