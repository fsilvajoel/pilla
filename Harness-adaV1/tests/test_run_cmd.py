import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.run_cmd import run_cmd


def test_run_cmd_executes_simple_command():
    code, stdout, stderr = run_cmd(["python3", "-c", "print('ok')"], cwd=Path(__file__).resolve().parents[1])
    assert code == 0
    assert stdout.strip() == "ok"
    assert stderr == ""
