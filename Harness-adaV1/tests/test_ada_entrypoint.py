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


def test_ada_lists_project_components():
    proc = run_cli("--project", str(ROOT), "--list")
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["name"] == "Harness-adaV1"
    assert "components" in payload
    assert "agent" in payload["components"]


def test_ada_runs_workflow_metadata():
    proc = run_cli("--project", str(ROOT), "--workflow", "coordination")
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["workflow"] == "coordination"
    assert payload["title"]
    assert "stages" in payload


def test_ada_status_reports_clean_parity():
    proc = run_cli("--project", str(ROOT), "--status")
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["status"] == "ok"
    assert payload["missing_directories"] == []
    assert payload["legacy_matches"] == []
