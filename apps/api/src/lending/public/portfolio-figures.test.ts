import type { PGlite } from "@electric-sql/pglite";
import { isoDate } from "@pilla/finance";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { confirmedAllocationsByLoan } from "../../payments/public/confirmed-allocations";
import { quotePayoff } from "../application/loan-assessment";
import { selectActiveLoans, selectInstallmentsByLoan } from "../infra/loan-queries";
import { portfolioFigures } from "./portfolio-figures";

// Porta lida pelo painel da tesouraria (E12 D7, D8; RF-32, RN-T01; ADR-0005: tudo calculado, nada gravado).
// Carteira semeada (valores em centavos, conferidos à mão):
// L1 ACTIVE, parcelas P 100.000 + I 20.000:
//   #1 vence 2026-11-20, paga inteira; #2 vence 2026-12-10, pagos I 20.000 + P 30.000 (falta P 70.000);
//   #3 vence 2027-01-10, aberta. Principal em aberto: 70.000 + 100.000 = 170.000.
// L2 ACTIVE, parcelas P 200.000 + I 50.000: #1 vence 2026-12-20, #2 vence 2027-01-20.
//   Uma alocação de pagamento estornado (P 200.000) não conta. Principal em aberto: 400.000.
// L3 WRITTEN_OFF, parcelas P 300.000 + I 60.000: #1 vence 2026-11-15 (pagos P 50.000 + I 60.000),
//   #2 vence 2026-12-15. Principal em aberto: 250.000 + 300.000 = 550.000.
// L4 DRAFT, L5 PAID_OFF, L6 RENEWED: parcelas em dezembro que não entram em nada.
// Previsão (principal + juros em aberto, sem encargos, só ACTIVE, pelo vencimento):
//   dez/2026 = L1#2 70.000 + L2#1 250.000 = 320.000; jan/2027 = L1#3 120.000 + L2#2 250.000 = 370.000;
//   nov/2026 = 0 (L1#1 paga; L3 baixado).

const PERSON = "01970000-0000-7000-8000-0000000000c1";
const ACCOUNT = "01970000-0000-7000-8000-0000000000d1";
const ADMIN = "01970000-0000-7000-8000-0000000000e1";
const L1 = "01970000-0000-7000-8000-0000000001a1";
const L2 = "01970000-0000-7000-8000-0000000001a2";
const L3 = "01970000-0000-7000-8000-0000000001a3";
const L4 = "01970000-0000-7000-8000-0000000001a4";
const L5 = "01970000-0000-7000-8000-0000000001a5";
const L6 = "01970000-0000-7000-8000-0000000001a6";

const DECEMBER = { monthStart: "2026-12-01", monthEnd: "2026-12-31" } as const;
const JANUARY = { monthStart: "2027-01-01", monthEnd: "2027-01-31" } as const;
const NOVEMBER = { monthStart: "2026-11-01", monthEnd: "2026-11-30" } as const;

let handle: MigratedTestDb;
let client: PGlite;
let sequence = 0;
const nextId = (): string => {
  sequence += 1;
  return `01970000-0000-7000-8000-${String(1000000000000 + sequence).slice(1)}`;
};

beforeAll(async () => {
  handle = await migratedTestDb();
  client = handle.client;
});
afterAll(async () => handle.close());
beforeEach(async () => {
  await client.query("delete from payments.payment_allocations");
  await client.query("delete from payments.payments");
  await client.query("delete from lending.installments");
  await client.query("delete from lending.loans");
});

type Installment = {
  readonly id: string;
  readonly number: number;
  readonly dueDate: string;
  readonly principalCents: number;
  readonly interestCents: number;
};

async function seedLoan(
  id: string,
  loanNumber: string,
  status: string,
  rows: readonly Omit<Installment, "id">[],
): Promise<Installment[]> {
  const principal = rows.reduce((total, row) => total + row.principalCents, 0);
  const draft = status === "DRAFT";
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, $2, $3, 'INSTALLMENT', $4, $5, 1000, $6, 'MONTH', 1, $7, '2026-10-01', $8, $9,
        200, 100, 0, 100)`,
    [
      id,
      loanNumber,
      PERSON,
      status,
      principal,
      rows.length,
      rows[0]?.dueDate ?? "2026-11-01",
      draft ? null : "2026-10-01",
      draft ? null : ACCOUNT,
    ],
  );
  const seeded: Installment[] = [];
  for (const row of rows) {
    const installment: Installment = { ...row, id: nextId() };
    await client.query(
      `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        installment.id,
        id,
        installment.number,
        installment.dueDate,
        installment.principalCents,
        installment.interestCents,
        installment.principalCents + installment.interestCents,
      ],
    );
    seeded.push(installment);
  }
  return seeded;
}

type Allocation = { readonly installment: Installment; readonly principal: number; readonly interest: number };

/** Pagamento já confirmado (ou estornado) com as suas alocações, gravado direto (sem passar pela rota). */
async function seedPayment(
  loanId: string,
  allocations: readonly Allocation[],
  options: { readonly reversed: boolean; readonly recovery: boolean },
): Promise<void> {
  const paymentId = nextId();
  const amount = allocations.reduce((total, item) => total + item.principal + item.interest, 0);
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, is_recovery,
        confirmed_at, confirmed_by, reversed_at, reversed_by, reversal_reason, created_by, version)
     values ($1, $2, $3, $4, '2026-11-20', $5, 'PIX', 'ADMIN', $6, $7,
        '2026-11-20T15:00:00Z', $8, $9, $10, $11, $8, 2)`,
    [
      paymentId,
      loanId,
      PERSON,
      ACCOUNT,
      amount,
      options.reversed ? "REVERSED" : "CONFIRMED",
      options.recovery,
      ADMIN,
      options.reversed ? "2026-11-21T15:00:00Z" : null,
      options.reversed ? ADMIN : null,
      options.reversed ? "Pagamento em duplicidade" : null,
    ],
  );
  for (const item of allocations) {
    await client.query(
      `insert into payments.payment_allocations
         (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents, reversed_at)
       values ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [
        nextId(),
        paymentId,
        loanId,
        item.installment.id,
        item.interest,
        item.principal,
        options.reversed ? "2026-11-21T15:00:00Z" : null,
      ],
    );
  }
}

const PAID = { reversed: false, recovery: false } as const;

async function seedL1(): Promise<void> {
  const [first, second] = await seedLoan(L1, "2026-0001", "ACTIVE", [
    { number: 1, dueDate: "2026-11-20", principalCents: 100000, interestCents: 20000 },
    { number: 2, dueDate: "2026-12-10", principalCents: 100000, interestCents: 20000 },
    { number: 3, dueDate: "2027-01-10", principalCents: 100000, interestCents: 20000 },
  ]);
  if (first === undefined || second === undefined) throw new Error("parcelas do L1 não semeadas");
  await seedPayment(L1, [{ installment: first, principal: 100000, interest: 20000 }], PAID);
  await seedPayment(L1, [{ installment: second, principal: 30000, interest: 20000 }], PAID);
}

async function seedL2(): Promise<void> {
  const [first] = await seedLoan(L2, "2026-0002", "ACTIVE", [
    { number: 1, dueDate: "2026-12-20", principalCents: 200000, interestCents: 50000 },
    { number: 2, dueDate: "2027-01-20", principalCents: 200000, interestCents: 50000 },
  ]);
  if (first === undefined) throw new Error("parcela do L2 não semeada");
  await seedPayment(L2, [{ installment: first, principal: 200000, interest: 50000 }], {
    reversed: true,
    recovery: false,
  });
}

async function seedL3(): Promise<void> {
  const [first] = await seedLoan(L3, "2026-0003", "WRITTEN_OFF", [
    { number: 1, dueDate: "2026-11-15", principalCents: 300000, interestCents: 60000 },
    { number: 2, dueDate: "2026-12-15", principalCents: 300000, interestCents: 60000 },
  ]);
  if (first === undefined) throw new Error("parcela do L3 não semeada");
  await seedPayment(L3, [{ installment: first, principal: 50000, interest: 60000 }], {
    reversed: false,
    recovery: true,
  });
}

async function seedOutsiders(): Promise<void> {
  await seedLoan(L4, "2026-0004", "DRAFT", [
    { number: 1, dueDate: "2026-12-05", principalCents: 400000, interestCents: 10000 },
  ]);
  await seedLoan(L5, "2026-0005", "PAID_OFF", [
    { number: 1, dueDate: "2026-12-08", principalCents: 500000, interestCents: 100000 },
  ]);
  await seedL6();
}

async function seedL6(): Promise<void> {
  await seedLoan(L6, "2026-0006", "RENEWED", [
    { number: 1, dueDate: "2026-12-25", principalCents: 700000, interestCents: 70000 },
  ]);
}

async function seedPortfolio(): Promise<void> {
  await seedL1();
  await seedL2();
  await seedL3();
  await seedOutsiders();
}

describe("portfolioFigures (E12-F04, D7, D8)", () => {
  it("answers zero for every figure on an empty portfolio", async () => {
    expect(await portfolioFigures(handle.db, DECEMBER)).toEqual({
      activeOutstandingPrincipalCents: 0,
      writtenOffOutstandingPrincipalCents: 0,
      forecastCents: 0,
    });
  });

  it("sums open principal by status and matches the payoff quote of every active loan", async () => {
    await seedPortfolio();
    const figures = await portfolioFigures(handle.db, DECEMBER);
    expect(figures).toEqual({
      activeOutstandingPrincipalCents: 570000,
      writtenOffOutstandingPrincipalCents: 550000,
      forecastCents: 320000,
    });

    // Conferência cruzada com a regra já usada na quitação (D8): mesmo principal em aberto.
    const active = await selectActiveLoans(handle.db);
    const installmentsByLoan = await selectInstallmentsByLoan(
      handle.db,
      active.map((loan) => loan.id),
    );
    let quoted = 0;
    for (const loan of active) {
      const allocations = await confirmedAllocationsByLoan(handle.db, loan.id);
      quoted += quotePayoff(
        loan,
        installmentsByLoan.get(loan.id) ?? [],
        allocations,
        isoDate("2026-12-01"),
      ).principalCents;
    }
    expect(active.map((loan) => loan.id)).toEqual([L1, L2]);
    expect(figures.activeOutstandingPrincipalCents).toBe(quoted);
  });

  it("counts the open principal of written-off loans, net of the recovery already allocated", async () => {
    await seedL3();
    expect(await portfolioFigures(handle.db, DECEMBER)).toEqual({
      activeOutstandingPrincipalCents: 0,
      writtenOffOutstandingPrincipalCents: 550000,
      forecastCents: 0,
    });
  });

  it("subtracts a partial principal allocation and forecasts only what is still open", async () => {
    await seedL1();
    expect(await portfolioFigures(handle.db, DECEMBER)).toEqual({
      activeOutstandingPrincipalCents: 170000,
      writtenOffOutstandingPrincipalCents: 0,
      forecastCents: 70000,
    });
  });

  it("forecasts by due month, ignores reversed allocations and leaves non-active loans out", async () => {
    await seedPortfolio();
    expect((await portfolioFigures(handle.db, JANUARY)).forecastCents).toBe(370000);
    expect((await portfolioFigures(handle.db, NOVEMBER)).forecastCents).toBe(0);
    const december = await portfolioFigures(handle.db, DECEMBER);
    expect(december.forecastCents).toBe(320000);
    expect(december.activeOutstandingPrincipalCents).toBe(570000);
  });

  it("leaves a renewed loan out of the active principal and of the forecast", async () => {
    await seedL2();
    await seedL6();
    expect(await portfolioFigures(handle.db, DECEMBER)).toEqual({
      activeOutstandingPrincipalCents: 400000,
      writtenOffOutstandingPrincipalCents: 0,
      forecastCents: 250000,
    });
  });
});
