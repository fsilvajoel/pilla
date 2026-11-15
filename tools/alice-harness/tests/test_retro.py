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

    def test_tool_error_summary_groups_repeated_errors(self):
        events = [{"kind": "tool", "name": "edit_file", "result": "ERRO: não encontrado"}] * 3 + \
                 [{"kind": "tool", "name": "write_file", "result": "ERRO: faltou argumento path"},
                  {"kind": "tool", "name": "run_check", "result": "$ x exit=0"}]
        total, top = tool_error_summary(events)
        self.assertEqual(total, 4)
        self.assertEqual(top[0], ("edit_file: ERRO: não encontrado", 3))
