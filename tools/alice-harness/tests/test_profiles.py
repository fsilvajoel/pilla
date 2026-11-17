"""Model profiles (bench of models through the same harness)."""
import unittest
from unittest import mock

import alice


class ProfileTest(unittest.TestCase):
    def test_default_and_origin_follow_yaml_environment_priority(self):
        with mock.patch.dict(alice.os.environ, {}, clear=True):
            self.assertEqual(alice.resolve_profile({}), ("qwen35", "models.yaml:default"))
            self.assertEqual(alice.resolve_profile({"ALICE_PROFILE": "gemma"}), ("gemma", ".env:ALICE_PROFILE"))
            with mock.patch.dict(alice.os.environ, {"ALICE_PROFILE": "qwen38"}):
                self.assertEqual(alice.resolve_profile({"ALICE_PROFILE": "gemma"}), ("qwen38", "ambiente:ALICE_PROFILE"))
        with self.assertRaises(SystemExit):
            alice.load_profile("inexistente")

    def test_default_profile_keeps_the_baseline(self):
        prof = alice.load_profile("gemma")
        opts, think = alice.chat_options(prof, {})
        self.assertEqual(prof["model"], "alice")
        self.assertEqual(opts, {"temperature": 0.2, "num_ctx": 32768, "num_predict": 8192})
        self.assertIs(think, False)

    def test_card_overrides_think_and_output(self):
        opts, think = alice.chat_options({"num_ctx": 16384, "think": "low"}, {"think": True, "maxOutputTokens": 2000})
        self.assertEqual((opts["num_ctx"], opts["num_predict"], think), (16384, 2000, True))

    def test_profile_think_level_and_sampling_pass_through(self):
        opts, think = alice.chat_options({"think": "medium", "top_p": 1.0, "top_k": 20, "model": "x"}, {})
        self.assertEqual(think, "medium")
        self.assertEqual((opts["top_p"], opts["top_k"]), (1.0, 20))
        self.assertNotIn("model", opts)

    def test_unknown_profile_is_an_error(self):
        with self.assertRaises(SystemExit):
            alice.load_profile("nope")

    def test_rate(self):
        self.assertEqual(alice.rate(100, 2_000_000_000), 50.0)
        self.assertEqual(alice.rate(5, 0), 0.0)


if __name__ == "__main__":
    unittest.main()
