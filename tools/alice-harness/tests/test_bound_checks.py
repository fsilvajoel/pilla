"""LI-053: a checklist item that names its check cannot be 'ok' while that check is red."""
import unittest

from alice import bound_checks, red_check_oks

ITEMS = ["C1 every schema has a test", "C3 fields use the primitives; run_check 2 (rule S3) proves it",
         "C5 every schema is exported; run_check 2 (rule S1) proves it", "C7 follows the sheet; run_check 1 lists it"]
SUMMARY = "C1 ok - a.ts:1\nC3 ok - run_check 2\nC5 falta - index.ts:3\nC7 ok - run_check 1"


class BoundChecksTest(unittest.TestCase):
    def test_binds_only_items_that_name_a_check(self):
        self.assertEqual(bound_checks(ITEMS), {"C3": 2, "C5": 2, "C7": 1})

    def test_ok_with_red_check_is_refused(self):
        self.assertEqual(red_check_oks(SUMMARY, ITEMS, {1: 0, 2: 1}), ["C3 (run_check 2 está vermelho)"])

    def test_green_checks_and_non_ok_verdicts_pass(self):
        self.assertEqual(red_check_oks(SUMMARY, ITEMS, {1: 0, 2: 0}), [])
        self.assertEqual(red_check_oks(SUMMARY.replace("C3 ok", "C3 falta"), ITEMS, {1: 0, 2: 1}), [])

    def test_message_is_classified_as_checklist(self):
        from gates import classify
        self.assertEqual(classify("'ok' sem prova em: C3 (run_check 2 está vermelho). O check..."), "checklist")


if __name__ == "__main__":
    unittest.main()
