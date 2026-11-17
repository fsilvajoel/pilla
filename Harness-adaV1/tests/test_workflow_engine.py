import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from script.run_workflow import run_workflow


def test_run_workflow_returns_known_flow():
    result = run_workflow(ROOT, "coordination")
    assert result["workflow"] == "coordination"
    assert "stages" in result
    assert result["path"].endswith("workflow/coordination.md")
