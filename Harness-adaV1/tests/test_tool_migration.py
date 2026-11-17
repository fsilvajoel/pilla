import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.list_files import list_files
from tools.replace_function import replace_function
from tools.search_code import search_code


def test_list_files_reports_project_files():
    files = list_files(Path(__file__).resolve().parents[1])
    assert "tests/test_tool_migration.py" in files
    assert "tools/list_files.py" in files


def test_search_code_finds_pattern():
    result = search_code(Path(__file__).resolve().parents[1], "TOOL_CONTRACT")
    assert "tools/list_files.py" in result


def test_replace_function_rewrites_target_block(tmp_path):
    target = tmp_path / "demo.py"
    target.write_text("def first():\n    return 1\n\ndef second():\n    return 2\n")
    message = replace_function(str(target), "second", "def second():\n    return 99\n")
    assert "ok" in message
    assert "return 99" in target.read_text()
