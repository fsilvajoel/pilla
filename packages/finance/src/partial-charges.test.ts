import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { allocatePayment, AllocationError } from "./allocation";
import { lateChargesAt, outstandingBalance } from "./balance";
import type { LateTerms, OpenInstallment } from "./balance";
import { addDays, isoDate } from "./date";
import type { IsoDate } from "./date";
import { bps, cents } from "./money";
import { lateChargesWithHistory } from "./partial-charges";
import type { InstallmentPayment } from "./partial-charges";

// multa 10%, mora 30% a.m. (1% ao dia), carência 0, passo 1: contas exatas em centavos.
const terms: LateTerms = {
  finePercent: bps(1000n),
  lateInterestMonthlyRate: bps(3000n),
  graceDays: 0,
  roundingStep: cents(1n),
};
// CA-05 (E3/E4): multa 2%, mora 1% a.m., passo 500.
const ca05Terms: LateTerms = {
  finePercent: bps(200n),
  lateInterestMonthlyRate: bps(100n),
  graceDays: 0,
  roundingStep: cents(500n),
};

function installment(
  number: number,
  dueDate: string,
  principal: bigint,
  interest: bigint,
  payments?: readonly InstallmentPayment[],
): OpenInstallment {
  const base = { number, dueDate: isoDate(dueDate), openPrincipal: cents(principal), openInterest: cents(interest) };
  return payments === undefined ? base : { ...base, payments };
}

function payment(paidAt: string, lateCharges: bigint, interest: bigint, principal: bigint): InstallmentPayment {
  return {
    paidAt: isoDate(paidAt),
    lateCharges: cents(lateCharges),
    interest: cents(interest),
    principal: cents(principal),
  };
}

// parcela vencida em 01/02/2027 com 1.000,00 em aberto (principal 800,00 + juros 200,00).
const DUE = "2027-02-01";
// 10 dias depois do vencimento: multa 100,00 + mora 100,00 = encargos de 200,00.
const FIRST_PAYMENT = "2027-02-11";

describe("no history (A1, C1)", () => {
  it("CA-05 keeps its value with an empty history", () => {
    const withEmpty = installment(1, DUE, 80000n, 20000n, []);
    expect(lateChargesAt(withEmpty, ca05Terms, isoDate("2027-02-16"))).toBe(2500n);
    expect(outstandingBalance([withEmpty], ca05Terms, isoDate("2027-02-16"))).toBe(102500n);
  });

  it("an empty history gives the same charges as no history at all", () => {
    const ref = isoDate("2027-03-20");
    const none = installment(1, DUE, 80000n, 20000n);
    const empty = installment(1, DUE, 80000n, 20000n, []);
    expect(lateChargesWithHistory(empty, terms, ref)).toBe(lateChargesAt(none, terms, ref));
    // 47 dias: multa 100,00 + mora 1% x 47 x 1.000,00 = 470,00
    expect(lateChargesWithHistory(empty, terms, ref)).toBe(10000n + 47000n);
  });
});

describe("fine once, late interest from the payment date (A2, A3, C2 to C4)", () => {
  // pagou 500,00 em 11/02: encargos 200,00 + juros 200,00 + principal 100,00; sobra principal 700,00.
  const paid = [payment(FIRST_PAYMENT, 20000n, 20000n, 10000n)];
  const afterPartial = installment(1, DUE, 70000n, 0n, paid);

  it("C2: the fine already paid is not charged again, only the new late interest", () => {
    // 10 dias depois do pagamento: mora 1% x 10 x 700,00 = 70,00 (sem histórico viria multa 70,00 + mora 140,00)
    expect(lateChargesAt(afterPartial, terms, isoDate("2027-02-21"))).toBe(7000n);
    expect(outstandingBalance([afterPartial], terms, isoDate("2027-02-21"))).toBe(77000n);
  });

  it("C3: on the payment date itself nothing more is charged", () => {
    expect(lateChargesAt(afterPartial, terms, isoDate(FIRST_PAYMENT))).toBe(0n);
    expect(outstandingBalance([afterPartial], terms, isoDate(FIRST_PAYMENT))).toBe(70000n);
  });

  it("C3: the late interest grows with the days since the payment, not since the due date", () => {
    expect(lateChargesWithHistory(afterPartial, terms, isoDate("2027-03-03"))).toBe(14000n);
  });

  it("C4: a payment made before the due date charges nothing and the fine still comes once, on the new open amount", () => {
    // pagou 300,00 em 20/02 para vencimento em 01/03 (juros 200,00 + principal 100,00); sobra 700,00
    const early = installment(1, "2027-03-01", 70000n, 0n, [payment("2027-02-20", 0n, 20000n, 10000n)]);
    // 10 dias de atraso: multa 70,00 + mora 70,00
    expect(lateChargesAt(early, terms, isoDate("2027-03-11"))).toBe(14000n);
  });
});

describe("payment smaller than the charges (A4, C5, C6)", () => {
  it("C5: the unpaid charges stay owed and are not charged twice", () => {
    // 11/02: encargos 200,00, pagou só 50,00 de encargos; em aberto continua 1.000,00
    const partial = installment(1, DUE, 80000n, 20000n, [payment(FIRST_PAYMENT, 5000n, 0n, 0n)]);
    // 21/02: sobra 150,00 + mora 1% x 10 x 1.000,00 = 100,00
    expect(lateChargesAt(partial, terms, isoDate("2027-02-21"))).toBe(25000n);
    expect(outstandingBalance([partial], terms, isoDate("2027-02-21"))).toBe(125000n);
  });

  it("C5: paid and owed together equal what would be charged in one go", () => {
    // sem histórico em 21/02: multa 100,00 + mora 200,00 = 300,00; já pagos 50,00
    const none = installment(1, DUE, 80000n, 20000n);
    const partial = installment(1, DUE, 80000n, 20000n, [payment(FIRST_PAYMENT, 5000n, 0n, 0n)]);
    const ref = isoDate("2027-02-21");
    expect(lateChargesAt(partial, terms, ref) + 5000n).toBe(lateChargesAt(none, terms, ref));
  });

  it("C6: two payments smaller than the charges carry the remainder forward", () => {
    // 11/02 paga 50,00 (sobra 150,00); 21/02 deve 150,00 + mora 100,00 = 250,00 e paga 80,00 (sobra 170,00)
    const partial = installment(1, DUE, 80000n, 20000n, [
      payment(FIRST_PAYMENT, 5000n, 0n, 0n),
      payment("2027-02-21", 8000n, 0n, 0n),
    ]);
    // 03/03: 170,00 + mora 1% x 10 x 1.000,00 = 100,00
    expect(lateChargesAt(partial, terms, isoDate("2027-03-03"))).toBe(27000n);
  });
});

describe("payment without charges paid (legacy data)", () => {
  it("leaves the charges as if computed on the open amount since the due date", () => {
    // pagou 500,00 só de juros e principal em 11/02, sem pagar encargos: nada é marcado como cobrado
    const legacy = installment(1, DUE, 70000n, 0n, [payment(FIRST_PAYMENT, 0n, 20000n, 10000n)]);
    // 21/02, 20 dias: multa 70,00 + mora 1% x 20 x 700,00 = 140,00
    expect(lateChargesAt(legacy, terms, isoDate("2027-02-21"))).toBe(21000n);
  });
});

describe("order of the history (A5, C7)", () => {
  const first = payment(FIRST_PAYMENT, 20000n, 20000n, 10000n);
  const second = payment("2027-02-21", 7000n, 0n, 10000n);
  // em aberto hoje: principal 800,00 - 100,00 - 100,00 = 600,00
  const ref = isoDate("2027-03-03");

  it("folds by paidAt when the history comes in order", () => {
    // mora de 1% x 10 dias x 600,00 desde 21/02
    expect(lateChargesAt(installment(1, DUE, 60000n, 0n, [first, second]), terms, ref)).toBe(6000n);
  });

  it("folds by paidAt when the history comes in reverse insertion order", () => {
    expect(lateChargesAt(installment(1, DUE, 60000n, 0n, [second, first]), terms, ref)).toBe(6000n);
  });
});

describe("allocation with history (A6, A7, C8 to C10)", () => {
  // 11/02 pagou 50,00 só de encargos; em 21/02 devem 250,00 de encargos (150,00 + mora 100,00)
  const history = [payment(FIRST_PAYMENT, 5000n, 0n, 0n)];
  const ref = isoDate("2027-02-21");
  const owing = installment(1, DUE, 80000n, 20000n, history);
  const future = installment(2, "2027-06-01", 40000n, 10000n);

  it("C8: pays the owed charges first, then interest, then principal", () => {
    expect(allocatePayment(cents(30000n), [owing], terms, ref)).toEqual([
      { installmentNumber: 1, lateCharges: 25000n, interest: 5000n, principal: 0n, status: "PARTIAL" },
    ]);
  });

  it("C8: the whole balance closes the installment", () => {
    expect(allocatePayment(cents(125000n), [owing], terms, ref)).toEqual([
      { installmentNumber: 1, lateCharges: 25000n, interest: 20000n, principal: 80000n, status: "PAID" },
    ]);
  });

  it("C9: the leftover goes to the next installment and the parts sum to the amount", () => {
    const allocations = allocatePayment(cents(130000n), [owing, future], terms, ref);
    expect(allocations).toEqual([
      { installmentNumber: 1, lateCharges: 25000n, interest: 20000n, principal: 80000n, status: "PAID" },
      { installmentNumber: 2, lateCharges: 0n, interest: 5000n, principal: 0n, status: "PARTIAL" },
    ]);
    const total = allocations.reduce((sum, a) => sum + a.lateCharges + a.interest + a.principal, 0n);
    expect(total).toBe(130000n);
  });

  it("C10: one cent above the history-aware balance is refused", () => {
    // sem histórico o saldo em 21/02 seria 1.300,00; com histórico é 1.250,00
    expect(() => allocatePayment(cents(125001n), [owing], terms, ref)).toThrow(AllocationError);
    expect(() => allocatePayment(cents(125001n), [owing], terms, ref)).toThrow("PAYMENT_EXCEEDS_BALANCE");
  });
});

describe("property: paying the whole balance clears it (A8, C11)", () => {
  const params = { seed: 20261121, numRuns: 300 };
  const termsArb = fc.record({
    fine: fc.bigInt({ min: 0n, max: 1000n }),
    late: fc.bigInt({ min: 0n, max: 1000n }),
    grace: fc.integer({ min: 0, max: 10 }),
    step: fc.constantFrom(1n, 100n, 500n),
  });
  const installmentsArb = fc.array(
    fc.record({
      principal: fc.bigInt({ min: 1n, max: 1_000_000n }),
      interest: fc.bigInt({ min: 0n, max: 300_000n }),
      offset: fc.integer({ min: 0, max: 200 }),
    }),
    { minLength: 1, maxLength: 5 },
  );
  // pagamentos parciais antes do final: dia seguinte (>= 0) e percentual do saldo
  const stepsArb = fc.array(
    fc.record({ gap: fc.integer({ min: 0, max: 60 }), percent: fc.bigInt({ min: 1n, max: 99n }) }),
    { maxLength: 4 },
  );
  const start = isoDate("2027-01-01");

  it("leaves outstandingBalance at zero at the same date, with or without earlier partial payments", () => {
    fc.assert(
      fc.property(termsArb, installmentsArb, stepsArb, fc.integer({ min: 0, max: 90 }), (t, rows, steps, lastGap) => {
        const lateTerms: LateTerms = {
          finePercent: bps(t.fine),
          lateInterestMonthlyRate: bps(t.late),
          graceDays: t.grace,
          roundingStep: cents(t.step),
        };
        let state: OpenInstallment[] = rows.map((r, i) =>
          installment(i + 1, addDays(start, r.offset), r.principal, r.interest, []),
        );
        let date: IsoDate = start;
        const apply = (amount: bigint, on: IsoDate): void => {
          const allocations = allocatePayment(cents(amount), state, lateTerms, on);
          state = state.map((inst) => {
            const a = allocations.find((x) => x.installmentNumber === inst.number);
            if (a === undefined) return inst;
            return {
              ...inst,
              openPrincipal: cents(inst.openPrincipal - a.principal),
              openInterest: cents(inst.openInterest - a.interest),
              payments: [
                ...(inst.payments ?? []),
                { paidAt: on, lateCharges: a.lateCharges, interest: a.interest, principal: a.principal },
              ],
            };
          });
        };
        for (const step of steps) {
          date = addDays(date, step.gap);
          const partial = (outstandingBalance(state, lateTerms, date) * step.percent) / 100n;
          if (partial > 0n) apply(partial, date);
        }
        const ref = addDays(date, lastGap);
        const whole = outstandingBalance(state, lateTerms, ref);
        if (whole > 0n) apply(whole, ref);
        expect(outstandingBalance(state, lateTerms, ref)).toBe(0n);
      }),
      params,
    );
  });
});
