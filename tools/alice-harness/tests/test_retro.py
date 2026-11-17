"""Spec for retro.py: per-card health check after each queue (LI-017)."""
import unittest

from retro import health_flags, tool_error_summary


class RetroTest(unittest.TestCase):
    def test_healthy_card_has_no_flags(self):
        self.assertEqual(health_flags({"seconds": 45, "attempts": 2, "toolCalls": 13, "toolErrors": 1}), [])

    def test_unhealthy_card_lists_each_reason(self):
        flags = health_flags({"seconds": 480, "attempts": 4, "toolCalls": 64, "toolErrors": 43})
        self.assertEqual(len(flags), 4)
        self.assertTrue(any("erro de ferramenta" in f for f in flags))

    def test_question_of_a_paused_card_shows_in_the_retro(self):
        """E4-T03 rodada 9: needs_input sem a pergunta; ela só existia no log, que o Claude não pode abrir."""
        import tempfile
        from pathlib import Path
        from retro import write_retro
        with tempfile.TemporaryDirectory() as d:
            text = write_retro([{"task": "X", "status": "needs_input", "question": "phoneNumber\né sensível?", "runDir": "dir/X/1"}],
                               Path(d), Path(d) / "retro.md")
        self.assertIn("pergunta da Alice: phoneNumber é sensível? (resume dir/X/1)", text)

    def test_tool_error_summary_groups_repeated_errors(self):
        events = [{"kind": "tool", "name": "edit_file", "result": "ERRO: não encontrado"}] * 3 + \
                 [{"kind": "tool", "name": "write_file", "result": "ERRO: faltou argumento path"},
                  {"kind": "tool", "name": "run_check", "result": "$ x exit=0"}]
        total, top = tool_error_summary(events)
        self.assertEqual(total, 4)
        self.assertEqual(top[0], ("edit_file: ERRO: não encontrado", 3))


class RetroKindsAndRedTest(unittest.TestCase):
    """JV17-4: contagem por tipo e última saída vermelha na retro; sucesso não herda saída antiga."""
    def write(self, results, events=None):
        import json
        import tempfile
        from pathlib import Path
        from retro import write_retro
        with tempfile.TemporaryDirectory() as d:
            if events is not None:
                log = Path(d) / "X" / "1" / "log.jsonl"
                log.parent.mkdir(parents=True)
                log.write_text("".join(json.dumps(e) + "\n" for e in events))
            return write_retro(results, Path(d), Path(d) / "retro.md")

    def test_kinds_from_report_and_red_output_redacted(self):
        secret = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"
        text = self.write([{"task": "X", "status": "failed", "toolCalls": 9,
                            "toolsByKind": {"read": 5, "write": 2, "run_check": 1, "bloqueadas": 1, "outras": 0},
                            "lastRedCheck": {"check": "pnpm test", "exit": 1, "output": f"FAIL {secret} " + "y" * 2000}}])
        self.assertIn("| 5/2/1/1 |", text)
        self.assertIn("## Última saída vermelha de X: `pnpm test` (exit 1)", text)
        self.assertNotIn(secret, text)
        self.assertNotIn("y" * 700, text)

    def test_done_card_does_not_show_old_red_output(self):
        text = self.write([{"task": "X", "status": "done", "lastRedCheck": {"check": "t", "exit": 1, "output": "velho"}}])
        self.assertNotIn("Última saída vermelha", text)
        self.assertNotIn("velho", text)

    def test_kinds_counted_from_log_for_legacy_records(self):
        events = [{"kind": "tool", "name": "read_file", "result": "ok"}, {"kind": "tool", "name": "edit_file", "result": "ok"},
                  {"kind": "tool", "name": "write_file", "result": "BLOQUEADO: x"}, {"kind": "tool", "name": "run_check", "result": "exit=1"}]
        self.assertIn("| 1/1/1/1 |", self.write([{"task": "X", "status": "failed"}], events))
