"""LI-053/LI-059: o veredito de um item que cita o check precisa bater com o check (e com a regra citada)."""
import unittest

from alice import bound_checks, bound_rules, red_check_oks

ITEMS = ["C1 every schema has a test; run_check 2 (rule S4) proves it",
         "C3 fields use the primitives; run_check 2 (rule S3) proves it",
         "C5 every schema is exported; run_check 2 (rule S1) proves it", "C6 names match the RFC",
         "C7 follows the sheet; run_check 1 lists it"]
OUT_S3 = "a.ts:5 S3 campo cpf usa `z.string()` (use cpfSchema)"


def verdicts(**kw: str) -> str:
    return "\n".join(f"{k} {v} - prova" for k, v in kw.items())


class BoundChecksTest(unittest.TestCase):
    def test_binds_items_to_check_and_rule(self):
        self.assertEqual(bound_checks(ITEMS), {"C1": 2, "C3": 2, "C5": 2, "C7": 1})
        self.assertEqual(bound_rules(ITEMS), {"C1": "S4", "C3": "S3", "C5": "S1"})

    def test_ok_on_the_flagged_rule_is_refused(self):
        red = red_check_oks(verdicts(C1="ok", C3="ok", C5="ok", C7="ok"), ITEMS, {1: (0, ""), 2: (1, OUT_S3)})
        self.assertEqual([r.split()[0] for r in red], ["C3"])
        self.assertIn("regra S3", red[0])

    def test_falta_when_only_another_rule_is_red_is_refused(self):
        red = red_check_oks(verdicts(C1="falta", C3="falta", C5="ok", C7="ok"), ITEMS, {1: (0, ""), 2: (1, OUT_S3)})
        self.assertEqual([r.split()[0] for r in red], ["C1"])
        self.assertIn("não acusa a regra S4", red[0])

    def test_item_without_rule_follows_the_whole_check(self):
        self.assertEqual(red_check_oks(verdicts(C7="falta"), ITEMS, {1: (1, "x.ts:1 usa z.number()")}), [])
        self.assertEqual([r.split()[0] for r in red_check_oks(verdicts(C7="ok"), ITEMS, {1: (1, "x")})], ["C7"])
        self.assertEqual([r.split()[0] for r in red_check_oks(verdicts(C7="falta"), ITEMS, {1: (0, "")})], ["C7"])

    def test_parcial_and_unbound_items_are_free(self):
        self.assertEqual(red_check_oks(verdicts(C3="parcial", C6="falta"), ITEMS, {2: (0, "")}), [])

    def test_rule_id_must_match_whole(self):
        out = "a.ts:1 S10 algo"
        self.assertEqual(red_check_oks(verdicts(C5="ok"), ITEMS, {2: (1, out)}), [])

    def test_message_is_classified_as_checklist(self):
        from gates import classify
        self.assertEqual(classify("veredito contra o check em: C3 (...)"), "checklist")


if __name__ == "__main__":
    unittest.main()
