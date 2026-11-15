"""Spec for the gates borrowed (as ideas) from harness-toolkit: LI-044..LI-048."""
import unittest

from gates import StallDetector, classify, duplicated_runs, gap_feedback, redact, split_problems

PROBLEMS = """arquivo alterado fora de allowedPaths: package.json
check 0 falhou (exit 2): pnpm --filter @pilla/schemas typecheck
src/a.ts(3,1): error TS2322: Type 'string' is not assignable
check 1 falhou (exit 1): pnpm --filter @pilla/schemas test
  FAIL  api.test.ts > accepts a valid body"""


class GapFeedbackTest(unittest.TestCase):
    def test_splits_one_problem_per_entry_keeping_check_output(self):
        items = split_problems(PROBLEMS)
        self.assertEqual(len(items), 3)
        self.assertIn("error TS2322", items[1])

    def test_classifies_each_problem(self):
        self.assertEqual([classify(p) for p in split_problems(PROBLEMS)], ["escopo", "typecheck", "teste"])
        self.assertEqual(classify("nenhum arquivo alterado: a tarefa pede escrita"), "vazio")
        self.assertEqual(classify("src/a.ts: any: const x: any = 1"), "proibido")
        self.assertEqual(classify("algo novo"), "outro")

    def test_numbers_gaps_and_lists_next_steps(self):
        text, cats = gap_feedback(PROBLEMS, [])
        self.assertIn("3 lacuna(s)", text)
        self.assertIn("1. [escopo]", text)
        self.assertIn("Próximos passos", text)
        self.assertNotIn("MESMA FALHA", text)
        self.assertEqual(cats, ["escopo", "typecheck", "teste"])

    def test_escalates_a_category_that_failed_last_attempt_too(self):
        text, _ = gap_feedback(PROBLEMS, [["typecheck"]])
        self.assertEqual(text.count("MESMA FALHA"), 1)


class StallTest(unittest.TestCase):
    def test_counts_identical_consecutive_calls(self):
        s = StallDetector()
        self.assertEqual([s.see("read_file", {"path": "a"}) for _ in range(3)], [1, 2, 3])
        self.assertEqual(s.see("read_file", {"path": "b"}), 1)

    def test_finish_and_ask_reset(self):
        s = StallDetector()
        s.see("run_check", {"index": 0})
        s.see("run_check", {"index": 0})
        self.assertEqual(s.see("finish", {}), 0)
        self.assertEqual(s.see("run_check", {"index": 0}), 1)


class DuplicationTest(unittest.TestCase):
    BLOCK = [f"  const v{i} = compute({i}, total);" for i in range(6)]

    def test_flags_a_copied_run(self):
        hits = duplicated_runs(["export function f() {", *self.BLOCK, "}"], {"src/b.ts": "\n".join(self.BLOCK)})
        self.assertEqual(len(hits), 1)
        self.assertIn("src/b.ts", hits[0])

    def test_ignores_whitespace_and_trivial_lines(self):
        spaced = [l.replace("  ", "    ") for l in self.BLOCK]
        self.assertTrue(duplicated_runs(spaced, {"b.ts": "\n".join(self.BLOCK)}))
        imports = [f'import {{ x{i} }} from "./m{i}";' for i in range(8)]
        self.assertEqual(duplicated_runs(imports, {"b.ts": "\n".join(imports)}), [])

    def test_short_overlap_is_not_duplication(self):
        self.assertEqual(duplicated_runs(self.BLOCK[:5], {"b.ts": "\n".join(self.BLOCK)}), [])


class RedactTest(unittest.TestCase):
    def test_masks_secret_shapes(self):
        text, n = redact("postgres://app:s3cretpw@db/x\nAPI_TOKEN=abcdefghijkl\nghp_" + "a" * 36)
        self.assertEqual(n, 3)
        self.assertNotIn("s3cretpw", text)
        self.assertNotIn("abcdefghijkl", text)
        self.assertIn("postgres://app:[REDACTED:url-password:", text)

    def test_same_value_same_mask(self):
        a, _ = redact('password: "hunter2hunter2"')
        b, _ = redact('token = "hunter2hunter2"')
        self.assertEqual(a.split("REDACTED:assignment:")[1][:8], b.split("REDACTED:assignment:")[1][:8])

    def test_leaves_code_alone(self):
        code = "password: z.string().min(1).max(200),\nconst tokenCount = 3;"
        self.assertEqual(redact(code), (code, 0))


if __name__ == "__main__":
    unittest.main()
