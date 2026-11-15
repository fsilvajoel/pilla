"""LI-060: arquivos gerados por um check (migração do drizzle-kit) não são escrita da Alice."""
import tempfile
import unittest
from pathlib import Path

from alice import Guard
from cards import quality_problems


class GuardGeneratedTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.guard = Guard(Path(self.tmp.name), ["apps/api/src/core/infra/schema.ts"], [], ["apps/api/migrations/core/*"])

    def tearDown(self):
        self.tmp.cleanup()

    def test_refuses_hand_written_generated_file(self):
        with self.assertRaisesRegex(PermissionError, "arquivo gerado.*run_check"):
            self.guard.check_write("apps/api/migrations/core/meta/_journal.json")

    def test_still_allows_the_source_file(self):
        self.assertEqual(self.guard.check_write("apps/api/src/core/infra/schema.ts"), "apps/api/src/core/infra/schema.ts")


class CardGeneratedTest(unittest.TestCase):
    CARD = {"id": "E3-T01", "kind": "implement", "assignee": "alice", "allowedPaths": ["a/schema.ts"],
            "protectedTests": ["a/x.test.ts"], "checks": ["pnpm --filter @p/api db:regen", "pnpm --filter @p/api test"],
            "done": ["ok"], "generatedPaths": ["a/migrations/*"]}

    def test_generated_paths_is_a_known_field(self):
        self.assertFalse([p for p in quality_problems(self.CARD) if "generatedPaths" in p])

    def test_same_path_in_generated_and_allowed_is_a_problem(self):
        card = {**self.CARD, "allowedPaths": ["a/schema.ts", "a/migrations/*"]}
        self.assertTrue([p for p in quality_problems(card) if "LI-060" in p])


if __name__ == "__main__":
    unittest.main()
