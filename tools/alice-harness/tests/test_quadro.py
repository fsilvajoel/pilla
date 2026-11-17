"""Fotografia operacional: entradas estruturadas, falha fechada e CLI sem rede."""
import contextlib
import io
import json
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest import mock

import alice
import quadro


class QuadroTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        self.clock = lambda: datetime(2026, 11, 16, 23, 10, tzinfo=timezone(timedelta(hours=-3)))

    def test_cli_writes_structured_entries_atomically_and_rejects_bad_input(self):
        with mock.patch('sys.argv', ['alice.py', 'leva', 'E5: começar', '--repo', str(self.repo)]):
            self.assertEqual(alice.main(), 0)
        with mock.patch('sys.argv', ['alice.py', 'fila', 'alice', 'E5-T01, E5-T02', '--repo', str(self.repo)]):
            self.assertEqual(alice.main(), 0)
        data = json.loads((self.repo / 'docs/agents/quadro-entradas.json').read_text())
        self.assertEqual(data, {'leva': 'E5: começar', 'filas': {'alice': 'E5-T01, E5-T02'}})
        with mock.patch('sys.argv', ['alice.py', 'fila', 'inexistente', 'X', '--repo', str(self.repo)]):
            with self.assertRaises(SystemExit):
                alice.main()
        self.assertEqual(json.loads((self.repo / 'docs/agents/quadro-entradas.json').read_text()), data)
        with mock.patch.object(quadro.os, 'replace', side_effect=OSError('sem espaço')):
            with self.assertRaises(OSError):
                quadro.set_fila(self.repo, 'bia', 'E5-T03')
        self.assertEqual(json.loads((self.repo / 'docs/agents/quadro-entradas.json').read_text()), data)

    def test_snapshot_uses_isolated_sources_and_is_short(self):
        quadro.set_leva(self.repo, 'E5: iniciar')
        for agent in ('alice', 'bia', 'jorge'):
            quadro.set_fila(self.repo, agent, agent.upper())
        text = quadro.generate(self.repo, now=self.clock, quota=lambda: {'remaining': 12},
                               alice_state=lambda: 'E5-T01', jorge_state=lambda: ('aplicada', 'harness-v9'))
        self.assertEqual(text, (self.repo / 'docs/agents/quadro.md').read_text())
        self.assertIn('2026-11-16T23:10:00-03:00', text.splitlines()[2])
        self.assertIn('Alice: cartão E5-T01; fila ALICE', text)
        self.assertIn('Bia: fila BIA; cota OpenRouter 12; reset 00:00 UTC (21h BRT)', text)
        self.assertIn('Jorge: JORGE_STATUS=aplicada versao=harness-v9; fila JORGE', text)
        self.assertLessEqual(len(text.splitlines()), 40)
        self.assertEqual(sum(line.startswith('- Alice:') for line in text.splitlines()), 1)

    def test_bad_or_missing_sources_do_not_become_empty_or_zero(self):
        quadro.set_fila(self.repo, 'alice', 'E5-T01')
        text = quadro.generate(self.repo, now=self.clock, quota=lambda: (_ for _ in ()).throw(OSError('offline')),
                               alice_state=lambda: (_ for _ in ()).throw(ValueError('broken')),
                               jorge_state=lambda: ('aplicada', 'harness-v9'))
        self.assertIn('Alice: cartão ?; fila E5-T01', text)
        self.assertIn('Bia: fila ?; cota OpenRouter ?', text)
        self.assertIn('Jorge: JORGE_STATUS=aplicada versao=harness-v9; fila ?', text)
        self.assertIn('- Leva: ?', text)
        self.assertNotIn('vazia', text)
        self.assertNotIn('cota OpenRouter 0', text)
        (self.repo / 'docs/agents/quadro-entradas.json').write_text('{bad json')
        text = quadro.generate(self.repo, now=self.clock, quota=lambda: {'remaining': 'broken'},
                               alice_state=lambda: '?', jorge_state=lambda: None)
        self.assertIn('cota OpenRouter ?', text)
        self.assertIn('Jorge: JORGE_STATUS=? versao=?', text)

    def test_last_jorge_is_numeric_and_terminal_only(self):
        for n, status in ((9, 'aplicada'), (10, 'erro'), (11, None)):
            target = self.repo / f'tools/jorge/logs/harness-v{n}'
            target.mkdir(parents=True)
            (target / 'estado.json').write_text(json.dumps({'version': f'harness-v{n}', 'status': status}))
        self.assertEqual(quadro.last_jorge(self.repo), ('erro', 'harness-v10'))
        (self.repo / 'tools/jorge/logs/harness-v10/estado.json').write_text('{broken')
        self.assertEqual(quadro.last_jorge(self.repo), ('aplicada', 'harness-v9'))

    def test_multiline_input_does_not_inject_rows_and_failed_publish_keeps_old(self):
        quadro.set_leva(self.repo, 'E5\n- Jorge: falsa | texto longo ' + 'x' * 300)
        quadro.set_fila(self.repo, 'bia', 'B1\n- Alice: falsa')
        old = quadro.generate(self.repo, now=self.clock, quota=lambda: {}, alice_state=lambda: '?', jorge_state=lambda: None)
        self.assertEqual(sum(line.startswith('- Jorge:') for line in old.splitlines()), 1)
        self.assertLessEqual(len(old.splitlines()), 40)
        with mock.patch.object(quadro.os, 'replace', side_effect=OSError('falhou')):
            with self.assertRaises(OSError):
                quadro.generate(self.repo, now=self.clock, quota=lambda: {}, alice_state=lambda: '?', jorge_state=lambda: None)
        self.assertEqual((self.repo / 'docs/agents/quadro.md').read_text(), old)

    def test_documentation_explains_manual_snapshot(self):
        root = Path(__file__).resolve().parents[3]
        for rel in ('tools/alice-harness/README.md', 'docs/agents/orquestracao.md',
                    'docs/agents/cartao-de-tarefa.md'):
            text = (root / rel).read_text()
            for command in ('alice.py leva', 'alice.py fila', 'alice.py quadro'):
                self.assertIn(command, text, rel)
            self.assertIn('fotografia manual', text.lower(), rel)
            self.assertIn('quadro.md', text, rel)

    def test_cli_quadro_delegates_without_network(self):
        with mock.patch.object(quadro, 'generate', return_value='fotografia') as generate, \
             mock.patch('sys.argv', ['alice.py', 'quadro', '--repo', str(self.repo)]), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(alice.main(), 0)
        generate.assert_called_once_with(self.repo.resolve())


if __name__ == '__main__':
    unittest.main()
