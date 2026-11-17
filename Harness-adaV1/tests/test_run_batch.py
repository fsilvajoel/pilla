import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from script.run_batch import discover_tasks


def test_discover_tasks_finds_yaml_files(tmp_path):
    (tmp_path / "one.yaml").write_text("task: ok\n")
    (tmp_path / "two.yml").write_text("task: ok\n")
    tasks = discover_tasks(tmp_path)
    assert len(tasks) == 2
    assert {t.name for t in tasks} == {"one.yaml", "two.yml"}
