import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { portfolioFigures } from "../../lending/public/portfolio-figures";

// Contrato ACTIVE sem parcelas gravadas: não tem principal em aberto nem previsão (E12 D7).
let migrated: MigratedTestDb;
let client: PGlite;

beforeAll(async () => {
  migrated = await migratedTestDb();
  client = migrated.client;
});
afterAll(async () => {
  await client.close();
});

describe("portfolioFigures without installments", () => {
  it("counts an ACTIVE loan with no installments as zero", async () => {
    const account = "01970000-0000-7000-8000-0000000000d1";
    const person = "01970000-0000-7000-8000-0000000000c1";
    await client.query(
      "insert into people.persons (id, full_name, cpf, phone) values ($1, 'Ana Souza', '52998224725', '+5511987654321')",
      [person],
    );
    await client.query("insert into treasury.accounts (id, name, active) values ($1, 'Conta ativa', true)", [account]);
    await client.query(
      `insert into lending.loans
         (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
          frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id, capitalized_amount_cents,
          late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
       values ('01970000-0000-7000-8000-0000000001a1', '2026-0001', $1, 'INSTALLMENT', 'ACTIVE', 100000, 500, 1,
          'MONTH', 1, '2026-11-30', '2026-11-10', '2026-11-14', $2, 0, 200, 0, 0, 100)`,
      [person, account],
    );
    expect(await portfolioFigures(migrated.db, { monthStart: "2026-12-01", monthEnd: "2026-12-31" })).toEqual({
      activeOutstandingPrincipalCents: 0,
      writtenOffOutstandingPrincipalCents: 0,
      forecastCents: 0,
    });
  });
});
