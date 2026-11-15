import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { allocatePayment } from "./allocation";
import { outstandingBalance } from "./balance";
import type { LateTerms, OpenInstallment } from "./balance";
import { addDays, isoDate } from "./date";
import { bps, cents } from "./money";
import { generateSchedule, ScheduleError } from "./schedule";
import { splitEvenly } from "./split";

// travas §1: propriedades com semente fixa (reprodutível no CI).
const params = { seed: 20261114, numRuns: 300 };
const sum = (values: readonly bigint[]): bigint => values.reduce((a, b) => a + b, 0n);
const start = isoDate("2027-01-01");

const scheduleArb = fc.record({
  principal: fc.bigInt({ min: 10000n, max: 100_000_000n }),
  rate: fc.bigInt({ min: 0n, max: 2000n }),
  count: fc.integer({ min: 1, max: 36 }),
  unit: fc.constantFrom<"DAY" | "MONTH">("DAY", "MONTH"),
  interval: fc.integer({ min: 1, max: 60 }),
});

const termsArb = fc.record({
  fine: fc.bigInt({ min: 0n, max: 1000n }),
  late: fc.bigInt({ min: 0n, max: 1000n }),
  grace: fc.integer({ min: 0, max: 10 }),
});

const installmentsArb = fc.array(
  fc.record({
    principal: fc.bigInt({ min: 0n, max: 1_000_000n }),
    interest: fc.bigInt({ min: 0n, max: 300_000n }),
    offset: fc.integer({ min: 0, max: 400 }),
  }),
  { minLength: 1, maxLength: 12 },
);

describe("properties", () => {
  it("splitEvenly: parts sum to total and none is negative", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 12n }), fc.integer({ min: 1, max: 500 }), (total, n) => {
        const parts = splitEvenly(cents(total), n);
        expect(parts).toHaveLength(n);
        expect(sum(parts)).toBe(total);
        expect(parts.every((p) => p >= 0n)).toBe(true);
      }),
      params,
    );
  });

  it("generateSchedule: installments sum to the total, principal closes, values are non-negative multiples of the step", () => {
    fc.assert(
      fc.property(scheduleArb, ({ principal, rate, count, unit, interval }) => {
        let schedule;
        try {
          schedule = generateSchedule({
            type: "INSTALLMENT",
            principal: cents(principal),
            monthlyInterestRate: bps(rate),
            count,
            frequency: { unit, interval },
            firstDueDate: addDays(start, 30),
            disbursementDate: start,
            roundingStep: cents(500n),
          });
        } catch (error) {
          // única recusa aceitável: arredondamento que deixaria juros negativos
          expect(error).toBeInstanceOf(ScheduleError);
          return;
        }
        const first = schedule[0]?.total ?? 0n;
        expect(schedule).toHaveLength(count);
        expect(sum(schedule.map((i) => i.principal))).toBe(principal);
        expect(sum(schedule.map((i) => i.total))).toBe(first * BigInt(count));
        expect(first % 500n).toBe(0n);
        for (const i of schedule) {
          expect(i.total).toBe(first);
          expect(i.principal + i.interest).toBe(i.total);
          expect(i.principal >= 0n && i.interest >= 0n).toBe(true);
        }
      }),
      params,
    );
  });

  it("allocatePayment: allocations sum to the payment, never exceed what is open, nothing negative", () => {
    fc.assert(
      fc.property(
        installmentsArb,
        termsArb,
        fc.integer({ min: 0, max: 500 }),
        fc.bigInt({ min: 1n, max: 10n ** 9n }),
        (rows, t, refOffset, rawAmount) => {
          const terms: LateTerms = {
            finePercent: bps(t.fine),
            lateInterestMonthlyRate: bps(t.late),
            graceDays: t.grace,
            roundingStep: cents(500n),
          };
          const installments: OpenInstallment[] = rows.map((r, index) => ({
            number: index + 1,
            dueDate: addDays(start, r.offset),
            openPrincipal: cents(r.principal),
            openInterest: cents(r.interest),
          }));
          const ref = addDays(start, refOffset);
          const balance = outstandingBalance(installments, terms, ref);
          fc.pre(balance > 0n);
          const amount = cents(((rawAmount - 1n) % balance) + 1n); // 1..balance
          const allocations = allocatePayment(amount, installments, terms, ref);
          expect(sum(allocations.map((a) => a.lateCharges + a.interest + a.principal))).toBe(amount);
          for (const a of allocations) {
            const source = installments[a.installmentNumber - 1];
            expect(a.lateCharges >= 0n && a.interest >= 0n && a.principal >= 0n).toBe(true);
            expect(a.interest <= (source?.openInterest ?? 0n)).toBe(true);
            expect(a.principal <= (source?.openPrincipal ?? 0n)).toBe(true);
          }
          if (amount === balance) expect(allocations.every((a) => a.status === "PAID")).toBe(true);
        },
      ),
      params,
    );
  });
});
