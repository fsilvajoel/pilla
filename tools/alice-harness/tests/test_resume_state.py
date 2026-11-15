"""LI-051: save() must keep what resume needs (repo path, files dirty before the run)."""
import json
import tempfile
import unittest
from pathlib import Path


class ResumeStateTest(unittest.TestCase):
    def test_state_keeps_repo_and_base_dirty(self):
        from alice import Run
        with tempfile.TemporaryDirectory() as tmp:
            card = {"id": "X-1", "title": "t", "allowedPaths": ["a.ts"], "checks": [],
                    "_repo": tmp, "_baseDirty": ["b.ts"], "_question": "drop me"}
            r = Run(card, Path(tmp), Path(tmp))
            r.messages = []
            r.save("needs_input")
            state = json.loads((Path(tmp) / "state.json").read_text())
            self.assertEqual(state["_repo"], tmp)
            self.assertEqual(state["_baseDirty"], ["b.ts"])
            self.assertNotIn("_question", state)


if __name__ == "__main__":
    unittest.main()
