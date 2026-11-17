"""Spec for claude_usage.py: real Claude token usage from the session transcript."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from alice import card_cost
from claude_usage import card_since, cost, load, load_all, session_files, window, weighted


def line(mid, ts, out, read):
    return json.dumps({"type": "assistant", "timestamp": ts, "message": {"id": mid, "usage": {"input_tokens": 1, "cache_creation_input_tokens": 10, "cache_read_input_tokens": read, "output_tokens": out}}})


class ClaudeUsageTest(unittest.TestCase):
    def test_dedupes_repeated_message_ids_and_filters_window(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "s.jsonl"
            f.write_text("\n".join([line("a", "2026-01-01T10:00", 100, 1000), line("a", "2026-01-01T10:00", 100, 1000),
                                    line("b", "2026-01-01T11:00", 50, 2000), "not json", json.dumps({"type": "user"})]))
            rows = load(f)
            self.assertEqual(len(rows), 2)
            self.assertEqual(window(rows)["output_tokens"], 150)
            self.assertEqual(window(rows, "2026-01-01T10:30")["turns"], 1)

    def test_weighted_units(self):
        w = {"input_tokens": 10, "cache_creation_input_tokens": 100, "cache_read_input_tokens": 1000, "output_tokens": 20}
        self.assertEqual(weighted(w), 10 + 200 + 100 + 100)


class CostTest(unittest.TestCase):  # e4-guardrails D
    def test_cost_weights(self):
        w = {"input_tokens": 10, "cache_creation_input_tokens": 100, "cache_read_input_tokens": 1000, "output_tokens": 20}
        self.assertEqual(cost(w), 10 + 125 + 100 + 100)

    def test_load_all_sums_every_session_of_the_repo(self):
        def entry(mid, cwd):
            return json.dumps({"type": "assistant", "timestamp": "2026-01-01T10:00", "cwd": cwd,
                               "message": {"id": mid, "usage": {"output_tokens": 1}}})
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "a").mkdir(); (root / "b").mkdir()
            (root / "a" / "s1.jsonl").write_text("\n".join([entry("x", "/r"), entry("x", "/r")]))
            (root / "a" / "s2.jsonl").write_text(entry("y", "/r/tools"))       # compacted session continues in a new file
            (root / "b" / "s3.jsonl").write_text("\n".join([entry("z", "/"), entry("w", "/other")]))  # a parent folder counts, a sibling does not
            rows = load_all(Path("/r"), root)
            self.assertEqual(window(rows)["turns"], 3)


class CardCostTest(unittest.TestCase):
    def test_card_since_finds_yaml_cards_with_distinct_formatting_and_no_prefix_match(self):
        with tempfile.TemporaryDirectory() as d:
            repo = Path(d)
            subprocess.run(['git', 'init', '-q', str(repo)], check=True)
            subprocess.run(['git', '-C', str(repo), 'config', 'user.email', 'test@example.org'], check=True)
            subprocess.run(['git', '-C', str(repo), 'config', 'user.name', 'Test'], check=True)
            plan = repo / 'docs/plano'
            plan.mkdir(parents=True)
            def commit(content, stamp):
                (plan / 'E9.yaml').write_text(content)
                subprocess.run(['git', '-C', str(repo), 'add', '.'], check=True)
                with patch.dict('os.environ', {'GIT_AUTHOR_DATE': stamp, 'GIT_COMMITTER_DATE': stamp}):
                    subprocess.run(['git', '-C', str(repo), 'commit', '-qm', 'plan'], check=True)
            commit('cards:\n  - id: E9-T010\n', '2026-01-01T09:00:00+00:00')
            commit('cards:\n  - id: E9-T010\n  - id : "E9-T01"\n', '2026-01-01T10:00:00+00:00')
            commit('cards:\n  - id: E9-T010\n  - id : "E9-T01"\n  - {id: E9-T02}\n', '2026-01-01T11:00:00+00:00')
            self.assertEqual(card_since(repo, ['E9-T01']), '2026-01-01T09:00:00')
            self.assertEqual(card_since(repo, ['E9-T02']), '2026-01-01T10:00:00')
            self.assertIsNone(card_since(repo, ['E9-T03']))
            with patch('alice.load_all') as read:
                with self.assertRaisesRegex(ValueError, 'E9-T03'):
                    card_cost(repo, ['E9-T03'])
                read.assert_not_called()

    def test_window_compares_instants_and_excludes_until(self):
        rows = [('2026-01-01T10:30:00+03:00', {'output_tokens': 1}),
                ('2026-01-01T04:30:00-03:00', {'output_tokens': 2}),
                ('2026-01-01T07:30:01Z', {'output_tokens': 4})]
        self.assertEqual(window(rows, '2026-01-01T07:30:00Z', '2026-01-01T08:30:00+01:00')['output_tokens'], 0)
        self.assertEqual(window(rows, '2026-01-01T04:30:00-03:00', '2026-01-01T07:30:01Z')['output_tokens'], 3)
        with self.assertRaises(ValueError):
            window(rows, 'not a date')


class SubagentTest(unittest.TestCase):
    """16/11: claude-usage e cost só liam <sessão>.jsonl; o subagente fica em <sessão>/subagents/agent-<id>.jsonl."""

    def tree(self, root: Path) -> Path:
        def entry(mid: str) -> str:
            return json.dumps({"type": "assistant", "timestamp": "2026-01-01T10:00", "cwd": "/r",
                               "message": {"id": mid, "usage": {"output_tokens": 1}}})
        (root / "p" / "s1" / "subagents").mkdir(parents=True)
        (root / "p" / "s1.jsonl").write_text(entry("main"))
        (root / "p" / "s1" / "subagents" / "agent-a1.jsonl").write_text(entry("sub1"))
        (root / "p" / "s1" / "subagents" / "agent-a2.jsonl").write_text("\n".join([entry("sub2"), entry("sub2")]))
        (root / "p" / "s1" / "subagents" / "agent-a2.meta.json").write_text("{}")
        return root / "p" / "s1.jsonl"

    def test_load_sums_session_and_subagents_from_either_path(self):
        with tempfile.TemporaryDirectory() as d:
            main = self.tree(Path(d))
            self.assertEqual(window(load(main))["turns"], 3)
            sub = main.parent / "s1" / "subagents" / "agent-a1.jsonl"
            self.assertEqual(session_files(sub)[0], main)
            self.assertEqual(window(load(sub))["turns"], 3)

    def test_load_all_includes_subagents(self):
        with tempfile.TemporaryDirectory() as d:
            self.tree(Path(d))
            self.assertEqual(window(load_all(Path("/r"), Path(d)))["turns"], 3)

