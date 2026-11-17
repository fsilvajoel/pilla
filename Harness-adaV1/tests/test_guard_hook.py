import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from script.guard_hook import guard_event


def test_guard_allows_normal_edit():
    result = guard_event({"cwd": str(ROOT), "tool_name": "Write", "tool_input": {"path": "README.md", "content": "hello"}})
    assert result["allowed"] is True


def test_guard_blocks_run_access():
    result = guard_event({"cwd": str(ROOT), "tool_name": "Read", "tool_input": {"path": "runs/plan.json"}})
    assert result["allowed"] is False


def test_guard_blocks_disallowed_shell_command():
    result = guard_event({"cwd": str(ROOT), "tool_name": "Bash", "tool_input": {"command": "git commit --no-verify"}})
    assert result["allowed"] is False
