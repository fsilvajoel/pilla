"""Stub marcado ('// @stub <ID>'): o Claude escreve e commita (Card-Stub) a casca; nunca substitui Card-Done."""
import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import yaml

HOOK = Path(__file__).resolve().parents[1] / 'scripts/guard_hook.py'
spec = importlib.util.spec_from_file_location('card_guard_hook', HOOK)
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


def git(repo, *args):
    return subprocess.run(['git', '-C', str(repo), *args], capture_output=True, text=True, check=True).stdout


STUB = '''// @stub E9-T02
import { cents } from "@pilla/finance";
export interface Output {
  value: bigint;
}
/** Computes the output. */
export function simulate(_value: bigint): Output {
  throw new Error("not implemented");
}
'''

TSX_STUB = '''"use client";
// @stub E9-T02
export function LoanSimulation({ disbursementDate: _d }: { disbursementDate: string }): never {
  throw new Error("not implemented");
}
'''


class CardStubTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        git(self.repo, 'init', '-q')
        git(self.repo, 'config', 'user.email', 't@t')
        git(self.repo, 'config', 'user.name', 't')
        plan = self.repo / 'docs/plano/E9.yaml'
        plan.parent.mkdir(parents=True)
        plan.write_text(yaml.safe_dump({'cards': [
            {'id': 'E9-T02', 'kind': 'implement', 'assignee': 'alice',
             'allowedPaths': ['apps/web/lib/simulation.ts', 'apps/web/components/loan-simulation.tsx']},
            {'id': 'E9-T04', 'kind': 'test-author', 'assignee': 'alice', 'allowedPaths': ['apps/web/lib/simulation.test.ts']},
        ]}))
        git(self.repo, 'add', '.')
        git(self.repo, 'commit', '-qm', 'init')
        self.patch = mock.patch.object(hook, 'REPO', self.repo)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.done = mock.patch.object(hook, 'done_ids', return_value=set())
        self.done.start()
        self.addCleanup(self.done.stop)

    def stage(self, path='apps/web/lib/simulation.ts', text=STUB):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        git(self.repo, 'add', '--', path)

    def test_marked_stub_requires_matching_trailer(self):
        self.stage()
        self.assertTrue(hook.commit_problems('git commit -m "prepare"'))
        self.assertEqual(hook.commit_problems('git commit -m "prepare" -m "Card-Stub: E9-T02"'), [])
        self.assertTrue(hook.commit_problems('git commit -m "Card-Stub: E9-T03"'))
        self.assertTrue(hook.commit_problems('git commit -m "notCard-Stub: E9-T02"'))

    def test_tsx_with_directive_and_destructured_props(self):
        self.stage('apps/web/components/loan-simulation.tsx', TSX_STUB)
        self.assertEqual(hook.commit_problems('git commit -m "Card-Stub: E9-T02"'), [])

    def test_unmarked_or_code_cannot_hide_behind_stub(self):
        for text in (STUB.replace('// @stub E9-T02\n', ''),
                     STUB.replace('@stub E9-T02', '@stub E9-T09'),
                     STUB.replace('throw new Error("not implemented");', 'return { value: _value };'),
                     STUB.replace('not implemented', 'done'),
                     '// @stub E9-T02\n/* throw new Error("not implemented") */\nexport function simulate() { return 1; }\n'):
            with self.subTest(text=text):
                self.stage(text=text)
                self.assertTrue(hook.commit_problems('git commit -m "Card-Stub: E9-T02"'))
        self.stage()
        self.stage('apps/web/lib/simulation.test.ts', 'it("stub", () => {});\n')
        self.assertTrue(hook.commit_problems('git commit -m "Card-Stub: E9-T02"'))
        self.assertTrue(hook.commit_problems('git commit -m "Card-Stub: E9-T02" -m "Card-Stub: E9-T04"'))

    def test_tracked_stub_can_be_revised_but_missing_blob_refused(self):
        self.stage()
        git(self.repo, 'commit', '-qm', 'tracked')
        self.stage(text=STUB + '\n')
        self.assertEqual(hook.commit_problems('git commit -m "Card-Stub: E9-T02"'), [])
        git(self.repo, 'rm', '-q', '--cached', 'apps/web/lib/simulation.ts')
        self.assertTrue(hook.commit_problems('git commit -m "Card-Stub: E9-T02"'))

    def test_done_refused_while_marker_staged(self):
        self.stage()
        self.assertTrue(any('etiqueta de stub' in p for p in hook.commit_problems('git commit -m "Card-Done: E9-T02"')))
        marker = self.repo / 'vitest.config.ts'
        marker.write_text('// stub E9-T02\n')
        git(self.repo, 'add', 'vitest.config.ts')
        self.assertTrue(any('etiqueta de stub' in p for p in hook.commit_problems('git commit -m "Card-Done: E9-T02"')))
        git(self.repo, 'commit', '-qm', 'prepare', '-m', 'Card-Stub: E9-T02')
        self.assertEqual(hook.TRAILER.findall(git(self.repo, 'log', '-1', '--format=%B')), [])

    def test_write_edit_allowed_only_for_marked_stub(self):
        path = 'apps/web/lib/simulation.ts'
        self.assertTrue(hook.stub_write_ok(path, 'Write', {'content': STUB}))
        self.assertFalse(hook.stub_write_ok(path, 'Write', {'content': STUB.replace('// @stub E9-T02\n', '')}))
        self.assertFalse(hook.stub_write_ok(path, 'Write', {'content': STUB.replace(
            'throw new Error("not implemented");', 'return { value: _value };')}))
        self.assertFalse(hook.stub_write_ok('apps/web/lib/simulation.test.ts', 'Write', {'content': STUB}))
        self.stage()
        self.assertTrue(hook.stub_write_ok(path, 'Edit', {'old_string': 'Computes', 'new_string': 'Calcula'}))
        self.assertFalse(hook.stub_write_ok(path, 'Edit', {'old_string': '// @stub E9-T02\n', 'new_string': ''}))
        self.assertFalse(hook.stub_write_ok(path, 'Edit', {
            'old_string': 'throw new Error("not implemented");', 'new_string': 'return { value: _value };'}))
        self.assertFalse(hook.stub_write_ok(path, 'Edit', {'old_string': 'absent', 'new_string': 'x'}))


if __name__ == '__main__':
    unittest.main()
