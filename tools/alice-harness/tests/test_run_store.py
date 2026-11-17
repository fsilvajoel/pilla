import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import alice
import review
from feature import load_snapshot, rollback
from run_store import compact_runs, delivered_ids, metrics_path, read_archived_file, summarize_context


class RunStoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.runs = self.root / "runs"
        self.repo = self.root / "repo"
        self.archive = self.root / "archive"
        self.index = self.root / "state" / "run-index.json"
        self.index_patch = mock.patch("run_store.default_index_path", return_value=self.index)
        self.index_patch.start()
        self.addCleanup(self.index_patch.stop)
        self.lessons = self.repo / "docs/memoria/licoes.md"
        self.runs.mkdir()
        self.repo.mkdir()
        self.lessons.parent.mkdir(parents=True)
        self.lessons.write_text(
            "# Lições\n"
            "| ID | Data | Lição | Origem |\n|---|---|---|---|\n"
            "| LI-001 | hoje | lição antiga | teste |\n"
            "| LI-002 | hoje | lição recente | teste |\n"
        )

    def tearDown(self):
        self.tmp.cleanup()

    def test_summary_is_atomic_and_keeps_canonical_lesson_references(self):
        output = self.runs / "contexto.md"
        text = summarize_context(self.lessons, output)

        self.assertEqual(output.read_text(), text)
        self.assertIn("LI-002", text)
        self.assertIn("docs/memoria/licoes.md", text)

    def test_metrics_path_prefers_external_store_and_falls_back_to_legacy(self):
        external = self.root / "state" / "metrics.jsonl"
        legacy = self.runs / "metrics.jsonl"
        legacy.write_text('{"task":"legacy"}\n')
        with mock.patch("run_store.default_metrics_path", return_value=external):
            self.assertEqual(metrics_path(self.runs), legacy)
            external.parent.mkdir(parents=True)
            external.write_text('{"task":"external"}\n')
            self.assertEqual(metrics_path(self.runs), external)

    def test_dry_run_and_compaction_preserve_live_runs_and_archive_references(self):
        done = self.runs / "E1-T01/20261117-100000"
        done.mkdir(parents=True)
        (done / "state.json").write_text(json.dumps({"_status": "done"}))
        (done / "log.jsonl").write_text('{"kind":"tool","result":"ok"}\n')

        waiting = self.runs / "E2-T01/20261117-100100"
        waiting.mkdir(parents=True)
        (waiting / "state.json").write_text(json.dumps({
            "_status": "needs_input", "_repo": str(self.repo), "id": "E2-T01", "_touched": []
        }))
        (waiting / "log.jsonl").write_text('{"kind":"answer","result":"pending"}\n')

        stale = self.runs / "E4-T01/20261116-090000"
        stale.mkdir(parents=True)
        (stale / "state.json").write_text(json.dumps({"_status": "running"}))
        (stale / "log.jsonl").write_text('{"kind":"tool","result":"interrupted"}\n')
        old_time = 1_000_000_000
        os.utime(stale / "state.json", (old_time, old_time))

        recent = self.runs / "E4-T02/20261117-120000"
        recent.mkdir(parents=True)
        (recent / "state.json").write_text(json.dumps({"_status": "running"}))

        (self.runs / "plan-20261117-100000.json").write_text(
            json.dumps([{"task": "E1-T01", "status": "done"}])
        )
        (self.runs / "retro-20261117-100000.md").write_text("# Retro\n\n- lição do teste\n")
        (self.runs / "bia").mkdir()
        raw = {"card": "E3-T01", "task": "test", "path": "a.test.ts", "sha": "f" * 40, "writer": "alice"}
        (self.runs / "bia/rev-1.json").write_text(json.dumps(raw))
        (self.runs / "plan-tasks").mkdir()
        (self.runs / "plan-tasks/E1-T01.yaml").write_text("cards: []\n")

        preview = compact_runs(self.runs, self.lessons, self.archive)
        self.assertEqual(preview["mode"], "dry-run")
        self.assertGreater(preview["files"], 0)
        self.assertTrue((done / "state.json").exists())
        self.assertFalse((self.runs / "index.json").exists())
        self.assertFalse(self.index.exists())

        applied = compact_runs(self.runs, self.lessons, self.archive, apply=True)
        self.assertEqual(applied["archived"], preview["files"])
        self.assertFalse((waiting / "state.json").exists())
        self.assertFalse((stale / "state.json").exists())
        self.assertTrue((recent / "state.json").exists())
        self.assertFalse((done / "state.json").exists())
        self.assertIn("LI-002", (self.runs / "contexto.md").read_text())
        self.assertIn("lição do teste", (self.runs / "retro-pendente.md").read_text())
        self.assertEqual({p.name for p in self.runs.iterdir() if p.is_file()},
                         {"contexto.md", "retro-pendente.md"})
        self.assertTrue(self.index.is_file())
        self.assertEqual(delivered_ids(self.runs), {"E1-T01"})
        self.assertEqual(read_archived_file(self.runs, "E1-T01/20261117-100000/log.jsonl", self.archive),
                         b'{"kind":"tool","result":"ok"}\n')

        with mock.patch.object(review, "RAW_DIR", self.runs / "bia"):
            text = "revisor: bia model rev-1\narquivo: a.test.ts " + "f" * 40 + "\n"
            self.assertEqual(review.signature_problems("E3-T01", text, {"a.test.ts": "f" * 40}), [])

        second = compact_runs(self.runs, self.lessons, self.archive, apply=True)
        self.assertEqual(second["files"], 0)
        self.assertIsNone(second["archive"])
        self.assertFalse((waiting / "state.json").exists())

        with (
            mock.patch.object(alice, "RUNS", self.runs),
            mock.patch.object(alice, "apply_policy"),
            mock.patch.object(alice, "foreign_changes", return_value=[]),
            mock.patch.object(alice, "Run") as run_class,
            mock.patch.object(alice, "lock"),
            mock.patch.object(alice, "unlock"),
        ):
            run_class.return_value.loop.return_value = 0
            self.assertEqual(alice.cmd_resume(waiting, "answer"), 0)
            run_class.assert_called_once()
        self.assertEqual(json.loads((waiting / "state.json").read_text())["_status"], "needs_input")
        self.assertTrue((waiting / "log.jsonl").is_file())

    def test_active_lock_blocks_compaction(self):
        (self.runs / "ACTIVE.json").write_text('{"pid":1}')
        with self.assertRaisesRegex(RuntimeError, "não compacte durante operações Alice"):
            compact_runs(self.runs, self.lessons, self.archive, apply=True)
        self.assertFalse((self.runs / "COMPACTING.json").exists())

    def test_feature_snapshots_remain_verifiable_and_restorable_from_archive(self):
        feature_id = "E9-F01"
        stage_names = ("plan", "tests", "implement", "audit", "review")
        feature_state = self.repo / "docs" / "plano" / feature_id / "estado.json"
        feature_state.parent.mkdir(parents=True)
        feature_state.write_text(json.dumps({"stages": {name: {"status": "pending"} for name in stage_names}}))

        source = "good snapshot\n"
        snapshot = self.runs / "feature" / feature_id / "snapshots/E9-T01/20261117"
        saved = snapshot / "files/src/a.ts"
        saved.parent.mkdir(parents=True)
        saved.write_text(source)
        manifest = {
            "card": "E9-T01",
            "files": {"src/a.ts": {"sha256": hashlib.sha256(source.encode()).hexdigest(), "mode": 0o644}},
        }
        manifest_path = snapshot / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True))
        digest = hashlib.sha256(manifest_path.read_bytes()).hexdigest()

        compact_runs(self.runs, self.lessons, self.archive, apply=True)

        self.assertEqual(load_snapshot(snapshot, digest, self.runs), manifest)
        target = self.repo / "src/a.ts"
        target.parent.mkdir(parents=True)
        target.write_text("changed\n")
        keep = self.runs / "feature" / feature_id / "later-run"
        rollback(self.repo, snapshot, keep, self.runs)
        self.assertEqual(target.read_text(), source)
        self.assertEqual((keep / "previous/src/a.ts").read_text(), "changed\n")


if __name__ == "__main__":
    unittest.main()
