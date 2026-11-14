"""Spec for policy.py: guardrail policy = policy.default.yaml (harness) overridden by <repo>/.agents/policy.yaml."""
import re
import tempfile
import unittest
from pathlib import Path

from policy import load_policy


class PolicyTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, text):
        (self.repo / ".agents").mkdir(exist_ok=True)
        (self.repo / ".agents" / "policy.yaml").write_text(text)

    def test_defaults_without_repo_file(self):
        p = load_policy(self.repo)
        self.assertIn("nodejs.org", p["officialDomains"])
        self.assertIn("docs.python.org", p["officialDomains"])
        self.assertIn(".env", p["denyRead"])
        self.assertIn("*.test.ts", p["protectedWrite"])
        self.assertIn("AGENTS.md", p["protectedWrite"])
        self.assertEqual(p["limits"], {"maxWriteLines": 400, "maxToolOutput": 6000, "maxContextChars": 90000})

    def test_forbidden_added_are_compiled_label_regex_pairs(self):
        p = load_policy(self.repo)
        labels = {label for label, _ in p["forbiddenAdded"]}
        self.assertTrue({"suppression", "any", "console", "focused/skipped test", "TODO without id"} <= labels)
        for _, rx in p["forbiddenAdded"]:
            self.assertIsInstance(rx, re.Pattern)
        hits = lambda s: [label for label, rx in p["forbiddenAdded"] if rx.search(s)]
        self.assertIn("any", hits("const x: any = 1"))
        self.assertIn("suppression", hits("// @ts-ignore"))
        self.assertIn("TODO without id", hits("// TODO fix"))
        self.assertNotIn("TODO without id", hits("// TODO(RN-C03) fix"))
        self.assertEqual(hits("const total = 1"), [])

    def test_repo_file_replaces_lists(self):
        self.write("officialDomains: [example.org]\n")
        p = load_policy(self.repo)
        self.assertEqual(p["officialDomains"], ["example.org"])
        self.assertIn(".env", p["denyRead"])  # untouched keys keep defaults

    def test_repo_file_merges_limits_per_key(self):
        self.write("limits:\n  maxWriteLines: 300\n")
        p = load_policy(self.repo)
        self.assertEqual(p["limits"]["maxWriteLines"], 300)
        self.assertEqual(p["limits"]["maxToolOutput"], 6000)

    def test_repo_forbidden_added(self):
        self.write("forbiddenAdded:\n  - {label: debugger, pattern: '\\bdebugger\\b'}\n")
        p = load_policy(self.repo)
        self.assertEqual([label for label, _ in p["forbiddenAdded"]], ["debugger"])

    def test_unknown_key_is_rejected(self):
        self.write("officalDomains: [typo.org]\n")
        with self.assertRaises(ValueError):
            load_policy(self.repo)

    def test_invalid_regex_is_rejected(self):
        self.write("forbiddenAdded:\n  - {label: bad, pattern: '([unclosed'}\n")
        with self.assertRaises(ValueError):
            load_policy(self.repo)

    def test_empty_file_means_defaults(self):
        self.write("")
        self.assertEqual(load_policy(self.repo)["limits"]["maxWriteLines"], 400)


if __name__ == "__main__":
    unittest.main()
