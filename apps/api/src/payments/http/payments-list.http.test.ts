import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { paymentListResponse } from "@pilla/schemas";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const ANA = uuid(1);
const BRUNO = uuid(2);
const ACCOUNT = uuid(3);
const USER = uuid(4);
const LOAN_ANA = uuid(11);
const LOAN_BRUNO = uuid(12);

let client: PGlite;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: migrated.db, close: () => Promise.resolve() })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  app.useLogger(false);
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  await client.query("delete from payments.payments");
  await client.query("delete from lending.loans");
  await client.query("delete from people.persons");
  await client.query(
    `insert into people.persons (id, full_name, cpf, phone) values
       ($1, 'Ana Souza', '52998224725', '+5511987654321'),
       ($2, 'Bruno Lima', '11144477735', '+5511987654322')`,
    [ANA, BRUNO],
  );
  for (const [id, number, person] of [
    [LOAN_ANA, "2026-0001", ANA],
    [LOAN_BRUNO, "2026-0002", BRUNO],
  ] as const) {
    await client.query(
      `insert into lending.loans
         (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
          frequency_unit, frequency_interval, first_due_date, contracted_at, late_fee_bps, late_interest_monthly_bps,
          grace_period_days, rounding_step_cents)
       values ($1, $2, $3, 'INSTALLMENT', 'DRAFT', 500000, 633, 5, 'MONTH', 1, '2026-09-20', '2026-08-15', 250, 120, 0, 500)`,
      [id, number, person],
    );
  }
});

type Item = {
  id: string;
  loanId: string;
  loanNumber: string;
  personId: string;
  personName: string;
  accountId: string;
  paidAt: string;
  amountCents: number;
  method: string;
  status: string;
  isRecovery: boolean;
  version: number;
  createdAt: string;
  confirmedAt: string | null;
  reversedAt: string | null;
};
type Page = { items: Item[]; nextCursor: string | null; code?: string; errors?: { field: string }[] };
type Result = { status: number; body: Page };

async function list(query = ""): Promise<Result> {
  const res = await request(baseUrl).get(`/api/v1/payments${query}`);
  return { status: res.status, body: res.body as Page };
}
const idsOf = (page: Page): string[] => page.items.map((item) => item.id);

// Oito pagamentos de dois contratos. PENDING_REVIEW: P1 e P4 no mesmo instante (desempata por id), P3, P2.
// Os demais: C1 e C3 no mesmo instante, R1 (estornado) e C2.
const P1 = uuid(201);
const P2 = uuid(202);
const P3 = uuid(203);
const P4 = uuid(204);
const C1 = uuid(205);
const R1 = uuid(206);
const C3 = uuid(207);
const C2 = uuid(208);

async function seedPayment(
  id: string,
  loanId: string,
  status: string,
  createdAt: string,
  amountCents = 1000,
): Promise<void> {
  const person = loanId === LOAN_ANA ? ANA : BRUNO;
  const confirmed = status === "CONFIRMED" || status === "REVERSED";
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_at, created_by,
        confirmed_at, confirmed_by, reversed_at, reversed_by, reversal_reason)
     values ($1, $2, $3, $4, '2026-11-01', $5, 'PIX', 'ADMIN', $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      loanId,
      person,
      ACCOUNT,
      amountCents,
      status,
      createdAt,
      USER,
      confirmed ? createdAt : null,
      confirmed ? USER : null,
      status === "REVERSED" ? createdAt : null,
      status === "REVERSED" ? USER : null,
      status === "REVERSED" ? "Valor errado" : null,
    ],
  );
}

async function seedMix(): Promise<void> {
  await seedPayment(P1, LOAN_ANA, "PENDING_REVIEW", "2026-11-01T10:00:00Z");
  await seedPayment(P4, LOAN_BRUNO, "PENDING_REVIEW", "2026-11-01T10:00:00Z");
  await seedPayment(P3, LOAN_ANA, "PENDING_REVIEW", "2026-11-02T10:00:00Z");
  await seedPayment(P2, LOAN_BRUNO, "PENDING_REVIEW", "2026-11-03T10:00:00Z");
  await seedPayment(C1, LOAN_ANA, "CONFIRMED", "2026-11-05T10:00:00Z");
  await seedPayment(C3, LOAN_BRUNO, "CONFIRMED", "2026-11-05T10:00:00Z");
  await seedPayment(R1, LOAN_ANA, "REVERSED", "2026-11-06T10:00:00Z");
  await seedPayment(C2, LOAN_BRUNO, "CONFIRMED", "2026-11-07T10:00:00Z");
}

describe("GET /api/v1/payments: filters and fields (E11-F02, A15)", () => {
  it("C19 (A15): lists every payment as a valid page when there is no filter", async () => {
    await seedMix();
    const { status, body } = await list();
    expect(status).toBe(200);
    expect(paymentListResponse.safeParse(body).success).toBe(true);
    expect(body.items).toHaveLength(8);
    expect(body.nextCursor).toBeNull();
  });

  it("C19 (A15): an empty list is 200 with no items and no cursor", async () => {
    expect((await list()).body).toEqual({ items: [], nextCursor: null });
  });

  it.each([
    ["PENDING_REVIEW", [P1, P4, P3, P2]],
    ["CONFIRMED", [C2, C3, C1]],
    ["REVERSED", [R1]],
  ])("C19 (A15): status=%s keeps only that status", async (statusFilter, expected) => {
    await seedMix();
    const { status, body } = await list(`?status=${statusFilter}`);
    expect(status).toBe(200);
    expect(idsOf(body)).toEqual(expected);
    expect(body.items.every((item) => item.status === statusFilter)).toBe(true);
  });

  it("C19 (A15): loanId keeps only the payments of that loan; with status it narrows both", async () => {
    await seedMix();
    expect(idsOf((await list(`?loanId=${LOAN_ANA}`)).body)).toEqual([P1, P3, R1, C1]);
    expect(idsOf((await list(`?loanId=${LOAN_BRUNO}&status=CONFIRMED`)).body)).toEqual([C2, C3]);
    expect(idsOf((await list(`?loanId=${uuid(99)}`)).body)).toEqual([]);
  });

  it("C22 (A15): each item carries the loan number and the person name besides the payment fields", async () => {
    await seedMix();
    const { body } = await list("?status=PENDING_REVIEW");
    const first = body.items[0];
    expect(first).toMatchObject({
      id: P1,
      loanId: LOAN_ANA,
      loanNumber: "2026-0001",
      personId: ANA,
      personName: "Ana Souza",
      accountId: ACCOUNT,
      paidAt: "2026-11-01",
      amountCents: 1000,
      method: "PIX",
      status: "PENDING_REVIEW",
      isRecovery: false,
      version: 1,
      confirmedAt: null,
      reversedAt: null,
    });
    expect(new Date(first?.createdAt ?? "").toISOString()).toBe("2026-11-01T10:00:00.000Z");
    expect(body.items[1]).toMatchObject({ loanNumber: "2026-0002", personName: "Bruno Lima" });
  });

  it("C22 (A15): confirmed and reversed items carry their instants", async () => {
    await seedMix();
    const { body } = await list("?loanId=" + LOAN_ANA);
    const reversed = body.items.find((item) => item.id === R1);
    const confirmed = body.items.find((item) => item.id === C1);
    expect(new Date(reversed?.reversedAt ?? "").toISOString()).toBe("2026-11-06T10:00:00.000Z");
    expect(new Date(reversed?.confirmedAt ?? "").toISOString()).toBe("2026-11-06T10:00:00.000Z");
    expect(new Date(confirmed?.confirmedAt ?? "").toISOString()).toBe("2026-11-05T10:00:00.000Z");
    expect(confirmed?.reversedAt).toBeNull();
  });

  it("C19 (A15): rejects an invalid status, loanId, limit, cursor and an unknown parameter with 400", async () => {
    for (const query of [
      "?status=PAID",
      "?loanId=x",
      "?limit=0",
      "?limit=101",
      "?limit=abc",
      "?cursor=",
      "?cursor=nao-e-cursor",
      "?owner=x",
    ]) {
      const { status, body } = await list(query);
      expect(status, query).toBe(400);
      expect(body.code, query).toBe("VALIDATION_FAILED");
    }
    expect((await list("?cursor=nao-e-cursor")).body.errors?.map((error) => error.field)).toEqual(["cursor"]);
  });
});

describe("GET /api/v1/payments: order and cursor (E11-F02, A15, A16)", () => {
  it("C20 (A16): PENDING_REVIEW goes from the oldest to the newest, ties by id", async () => {
    await seedMix();
    expect(idsOf((await list("?status=PENDING_REVIEW")).body)).toEqual([P1, P4, P3, P2]);
  });

  it("C20 (A16): the other statuses go from the newest to the oldest, ties by id descending", async () => {
    await seedMix();
    expect(idsOf((await list("?status=CONFIRMED")).body)).toEqual([C2, C3, C1]);
  });

  it("C20 (A16): with no status filter the pending queue comes first, then the rest, newest first", async () => {
    await seedMix();
    expect(idsOf((await list()).body)).toEqual([P1, P4, P3, P2, C2, R1, C3, C1]);
  });

  it("C21 (A15): the cursor pages through the mixed list without repeating or skipping an item", async () => {
    await seedMix();
    const first = await list("?limit=3");
    expect(idsOf(first.body)).toEqual([P1, P4, P3]);
    expect(first.body.nextCursor).not.toBeNull();
    const second = await list(`?limit=3&cursor=${encodeURIComponent(first.body.nextCursor ?? "")}`);
    expect(idsOf(second.body)).toEqual([P2, C2, R1]);
    const third = await list(`?limit=3&cursor=${encodeURIComponent(second.body.nextCursor ?? "")}`);
    expect(idsOf(third.body)).toEqual([C3, C1]);
    expect(third.body.nextCursor).toBeNull();
  });

  it("C21 (A15): a page of one item at a time visits every payment once, in the same order", async () => {
    await seedMix();
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 10; guard++) {
      const { body }: Result = await list(`?limit=1${cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`}`);
      seen.push(...idsOf(body));
      cursor = body.nextCursor;
      if (cursor === null) break;
    }
    expect(seen).toEqual([P1, P4, P3, P2, C2, R1, C3, C1]);
  });

  it("C21 (A15): the cursor also works inside a status filter and with the loan filter", async () => {
    await seedMix();
    const first = await list("?status=CONFIRMED&limit=2");
    expect(idsOf(first.body)).toEqual([C2, C3]);
    const second = await list(`?status=CONFIRMED&limit=2&cursor=${encodeURIComponent(first.body.nextCursor ?? "")}`);
    expect(idsOf(second.body)).toEqual([C1]);
    expect(second.body.nextCursor).toBeNull();
    const byLoan = await list(`?loanId=${LOAN_ANA}&limit=3`);
    expect(idsOf(byLoan.body)).toEqual([P1, P3, R1]);
    const rest = await list(`?loanId=${LOAN_ANA}&limit=3&cursor=${encodeURIComponent(byLoan.body.nextCursor ?? "")}`);
    expect(idsOf(rest.body)).toEqual([C1]);
  });

  it("C21 (A15): the limit defaults to 20 and accepts up to 100", async () => {
    for (let n = 0; n < 22; n++) {
      await seedPayment(uuid(300 + n), LOAN_ANA, "PENDING_REVIEW", `2026-11-01T10:${String(n).padStart(2, "0")}:00Z`);
    }
    const page = await list();
    expect(page.body.items).toHaveLength(20);
    expect(page.body.nextCursor).not.toBeNull();
    const all = await list("?limit=100");
    expect(all.body.items).toHaveLength(22);
    expect(all.body.nextCursor).toBeNull();
  });
});
