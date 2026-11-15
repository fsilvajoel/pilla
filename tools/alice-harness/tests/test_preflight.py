"""LI-056: errors of the card are found before the model starts, and are not blamed on it."""
import subprocess
import tempfile
import unittest
from pathlib import Path

from alice import foreign_changes, preflight_problems


def card(**kw):
    base = {"id": "X-1", "kind": "implement", "allowedPaths": ["src/a.ts"], "checks": ["python3 -c pass"],
            "readFirst": [], "protectedTests": []}
    base.update(kw)
    return base


class PreflightTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_unknown_command_and_missing_files(self):
        problems = preflight_problems(card(checks=["no-such-binary-xyz --version"], readFirst=["src/model.ts"],
                                           protectedTests=["src/a.test.ts"]), self.repo, lambda c: 1)
        self.assertEqual(len(problems), 3)
        self.assertIn("comando não encontrado", problems[0])
        self.assertIn("src/model.ts não existe", problems[1])
        self.assertIn("src/a.test.ts não existe", problems[2])

    def test_writing_card_needs_a_red_check_before_starting(self):
        ran = []
        green = preflight_problems(card(checks=["python3 a", "python3 b"]), self.repo, lambda c: ran.append(c) or 0)
        self.assertEqual(len(green), 1)
        self.assertIn("já passam", green[0])
        self.assertEqual(ran, ["python3 a", "python3 b"])
        ran.clear()
        self.assertEqual(preflight_problems(card(checks=["python3 a", "python3 b"]), self.repo, lambda c: ran.append(c) or 1), [])
        self.assertEqual(ran, ["python3 a"])  # stops at the first red check

    def test_review_card_may_start_all_green(self):
        self.assertEqual(preflight_problems(card(kind="pre-review", allowedPaths=[]), self.repo, lambda c: 0), [])


class ForeignChangesTest(unittest.TestCase):
    def test_lists_only_changes_that_are_not_the_cards(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            subprocess.run(["git", "init", "-q", d], check=True)
            (repo / "src").mkdir()
            for name in ("src/a.ts", "src/old.ts", "src/mine.ts", "harness.py"):
                (repo / name).write_text("x")
            c = card(_baseDirty=["src/old.ts"])
            self.assertEqual(foreign_changes(repo, c, ["src/mine.ts"]), ["harness.py"])


if __name__ == "__main__":
    unittest.main()
