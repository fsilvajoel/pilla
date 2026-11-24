import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { portalLoanDetailResponse, portalLoanListResponse, type LoanDetailResponse } from "@pilla/schemas";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionIdOf } from "../../access/domain/session-token";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { loginAsAdmin, type AdminAgent } from "../../core/http/test-admin-agent";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

// Leituras do portal (RF-61 a RF-63, CA-09, E15 D8 a D11, E15-F04 C1 a C15): lista, detalhe, isolamento, vazamento
// e somente leitura. Hoje em Brasília: 2026-11-20. Os dados sensíveis semeados são textos fáceis de achar.
const env: ApiEnv = {
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: "postgres://u:p@127.0.0.1:1/pilla",
  accessHashKey: "chave-de-teste-do-hash-com-mais-de-32-caracteres",
};
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const ANA = uuid(1);
const BETO = uuid(2);
const ACCOUNT = uuid(3);
const USER = uuid(4);
const RECEIPT = uuid(5);
const CURRENT = uuid(11);
const OVERDUE = uuid(12);
const PAID_OFF_OLD = uuid(13);
const PAID_OFF_NEW = uuid(14);
const DRAFT = uuid(15);
const CANCELLED = uuid(16);
const WRITTEN_OFF = uuid(17);
const RENEWED = uuid(18);
const RENEGOTIATED = uuid(19);
const BETO_LOAN = uuid(20);
const UNKNOWN = uuid(99);
const TOKEN_ANA = "a".repeat(43);
const TOKEN_BETO = "b".repeat(43);
const NOW = new Date("2026-11-20T15:00:00Z");
const MINUTE = 60_000;
const SECRETS = [
  "52998224725",
  "11144477735",
  "Ana Souza",
  "Beto Moraes",
  "+5511987654321",
  "+5511987654302",
  "ana.sigilo@example.com",
  "beto.sigilo@example.com",
  "chave-pix-sigilosa-ana",
  "observacao-interna-ana",
  "observacao-interna-beto",
  "comprovante-sigiloso.pdf",
  "E2E-SIGILO",
  "Conta Sigilosa",
  "nota-interna-contrato",
];
const LIST_KEYS = ["id", "loanNumber", "nextDueDate", "outstandingCents", "principalCents", "situation"];
const DETAIL_KEYS = [
  "id",
  "installments",
  "lateChargesCents",
  "loanNumber",
  "nextInstallment",
  "outstandingCents",
  "paidCents",
  "payments",
  "principalCents",
  "situation",
  "totalCents",
];
const INSTALLMENT_KEYS = ["amountCents", "dueDate", "lateChargesCents", "number", "paidCents", "status"];
const NEXT_KEYS = ["amountCents", "dueDate", "number"];
const PAYMENT_KEYS = ["amountCents", "method", "paidAt"];

type ListItem = {
  id: string;
  loanNumber: string;
  situation: string;
  nextDueDate: string | null;
  outstandingCents: number;
};
type Detail = {
  id: string;
  situation: string;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  lateChargesCents: number;
  nextInstallment: { number: number; dueDate: string; amountCents: number } | null;
  installments: {
    number: number;
    dueDate: string;
    amountCents: number;
    paidCents: number;
    lateChargesCents: number;
    status: string;
  }[];
  payments: { paidAt: string; amountCents: number; method: string }[];
};

let client: PGlite;
let app: INestApplication;
let baseUrl: string;
let admin: AdminAgent;
let counter = 1000;
const nextId = (): string => uuid(++counter);

const asAna = (): { cookie: string } => ({ cookie: `pilla_portal=${TOKEN_ANA}` });
const portal = (path: string, cookie = `pilla_portal=${TOKEN_ANA}`): request.Test =>
  request(baseUrl).get(`/api/v1/portal${path}`).set("Cookie", cookie);

async function seedLoan(id: string, number: string, personId: string, status = "ACTIVE", graceDays = 0): Promise<void> {
  const draft = status === "DRAFT";
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents, internal_notes)
     values ($1, $2, $3, 'INSTALLMENT', $4, 500000, 633, 2, 'MONTH', 1, '2026-09-20', '2026-08-15', $5, $6,
        250, 120, $7, 500, 'nota-interna-contrato')`,
    [id, number, personId, status, draft ? null : "2026-08-20", draft ? null : ACCOUNT, graceDays],
  );
}
async function seedInstallment(loanId: string, number: number, dueDate: string): Promise<string> {
  const id = nextId();
  await client.query(
    `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
     values ($1, $2, $3, $4, 100000, 20000, 120000)`,
    [id, loanId, number, dueDate],
  );
  return id;
}
type PaymentSeed = {
  loanId: string;
  personId?: string;
  installmentId: string | null;
  paidAt: string;
  method: string;
  amount: number;
  principal?: number;
  interest?: number;
  status?: string;
  reversed?: boolean;
};
async function seedPayment(payment: PaymentSeed): Promise<string> {
  const id = nextId();
  const person = payment.personId ?? ANA;
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by, reversed_at,
        pix_end_to_end_id, receipt_attachment_id)
     values ($1, $2, $3, $4, $5, $6, $7, 'ADMIN', $8, $9, $10, $11, $12)`,
    [
      id,
      payment.loanId,
      person,
      ACCOUNT,
      payment.paidAt,
      payment.amount,
      payment.method,
      payment.status ?? "CONFIRMED",
      USER,
      payment.reversed === true ? "2026-11-18T10:00:00Z" : null,
      `E2E-SIGILO-${id}`,
      payment.method === "CASH" ? null : RECEIPT,
    ],
  );
  if (payment.installmentId !== null) {
    await client.query(
      `insert into payments.payment_allocations
         (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents, reversed_at)
       values ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [
        nextId(),
        id,
        payment.loanId,
        payment.installmentId,
        payment.interest ?? 0,
        payment.principal ?? 0,
        payment.reversed === true ? "2026-11-18T10:00:00Z" : null,
      ],
    );
  }
  return id;
}
async function seedSession(token: string, personId: string, lastSeenAt = NOW): Promise<void> {
  await client.query(
    `insert into access.sessions (id, role, person_id, created_at, expires_at, last_seen_at, ip)
     values ($1, 'CLIENT', $2, $3, $4, $5, '203.0.113.5')`,
    [sessionIdOf(token), personId, NOW, new Date(NOW.getTime() + 2 * 3_600_000), lastSeenAt],
  );
}

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env, { outboxPoller: false })] })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: migrated.db, close: () => Promise.resolve() })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  app.useLogger(false);
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
  admin = await loginAsAdmin(baseUrl, client);
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  for (const table of [
    "payments.payment_allocations",
    "payments.payments",
    "lending.installments",
    "lending.loans",
    "access.portal_access",
    "people.pix_keys",
    "people.persons",
    "treasury.accounts",
    "core.attachments",
  ]) {
    await client.query(`delete from ${table}`);
  }
  await client.query("delete from access.sessions where role = 'CLIENT'");
  await client.query(
    `insert into people.persons (id, full_name, cpf, phone, email, notes) values
     ($1, 'Ana Souza', '52998224725', '+5511987654321', 'ana.sigilo@example.com', 'observacao-interna-ana'),
     ($2, 'Beto Moraes', '11144477735', '+5511987654302', 'beto.sigilo@example.com', 'observacao-interna-beto')`,
    [ANA, BETO],
  );
  await client.query("insert into people.pix_keys (id, owner_person_id, type, value) values ($1, $2, 'RANDOM', $3)", [
    nextId(),
    ANA,
    "chave-pix-sigilosa-ana",
  ]);
  await client.query("insert into treasury.accounts (id, name, active) values ($1, 'Conta Sigilosa', true)", [ACCOUNT]);
  await client.query(
    `insert into core.attachments (id, kind, file_name, content_type, size_bytes, sha256, storage_key, uploaded_by, uploaded_at)
     values ($1, 'RECEIPT', 'comprovante-sigiloso.pdf', 'application/pdf', 10, $2, 'k/comprovante-sigiloso', $3, $4)`,
    [RECEIPT, "a".repeat(64), USER, NOW],
  );
  for (const personId of [ANA, BETO]) {
    await client.query(
      `insert into access.portal_access (person_id, enabled, enabled_at, enabled_by)
       select $1, true, $2, id from access.admin_users limit 1`,
      [personId, NOW],
    );
  }
  await seedSession(TOKEN_ANA, ANA);
  await seedSession(TOKEN_BETO, BETO);

  // Ana: 0001 em dia (1 parcela paga, 1 paga em parte); 0002 em atraso (vencida ontem); 0003 e 0004 quitados.
  await seedLoan(CURRENT, "2026-0001", ANA);
  const paid = await seedInstallment(CURRENT, 1, "2026-10-20");
  const partial = await seedInstallment(CURRENT, 2, "2026-12-20");
  await seedPayment({
    loanId: CURRENT,
    installmentId: paid,
    paidAt: "2026-10-18",
    method: "PIX",
    amount: 120000,
    principal: 100000,
    interest: 20000,
  });
  await seedPayment({
    loanId: CURRENT,
    installmentId: partial,
    paidAt: "2026-11-05",
    method: "CASH",
    amount: 60000,
    principal: 40000,
    interest: 20000,
  });
  await seedPayment({
    loanId: CURRENT,
    installmentId: null,
    paidAt: "2026-11-06",
    method: "PIX",
    amount: 777,
    status: "PENDING_REVIEW",
  });
  await seedPayment({
    loanId: CURRENT,
    installmentId: null,
    paidAt: "2026-11-07",
    method: "PIX",
    amount: 888,
    status: "REJECTED",
  });
  await seedPayment({
    loanId: CURRENT,
    installmentId: partial,
    paidAt: "2026-11-08",
    method: "PIX",
    amount: 999,
    status: "REVERSED",
    reversed: true,
    principal: 500,
  });
  await seedLoan(OVERDUE, "2026-0002", ANA);
  await seedInstallment(OVERDUE, 1, "2026-11-19");
  await seedInstallment(OVERDUE, 2, "2026-12-19");
  for (const [id, number] of [
    [PAID_OFF_OLD, "2026-0003"],
    [PAID_OFF_NEW, "2026-0004"],
  ] as const) {
    await seedLoan(id, number, ANA, "PAID_OFF");
    const done = await seedInstallment(id, 1, "2026-09-20");
    await seedPayment({
      loanId: id,
      installmentId: done,
      paidAt: "2026-09-19",
      method: "BOLETO",
      amount: 120000,
      principal: 100000,
      interest: 20000,
    });
  }
  // Fora do portal: rascunho, cancelado, baixado, renovado e renegociado de Ana.
  for (const [id, number, status] of [
    [DRAFT, "2026-0005", "DRAFT"],
    [CANCELLED, "2026-0006", "CANCELLED"],
    [WRITTEN_OFF, "2026-0007", "WRITTEN_OFF"],
    [RENEWED, "2026-0008", "RENEWED"],
    [RENEGOTIATED, "2026-0009", "RENEGOTIATED"],
  ] as const) {
    await seedLoan(id, number, ANA, status);
    await seedInstallment(id, 1, "2026-12-20");
  }
  await seedLoan(BETO_LOAN, "2026-0010", BETO);
  await seedInstallment(BETO_LOAN, 1, "2026-11-10");
});
afterEach(() => {
  vi.useRealTimers();
});

const adminDetail = async (id: string): Promise<LoanDetailResponse> =>
  (await admin.get(`/api/v1/loans/${id}`)).body as LoanDetailResponse;

describe("GET /portal/loans", () => {
  it("C1 (A1): lists only the ACTIVE and PAID_OFF loans of the session person, ACTIVE first, newest number first", async () => {
    const r = await portal("/loans");
    expect(r.status).toBe(200);
    expect(portalLoanListResponse.safeParse(r.body).success).toBe(true);
    const items = (r.body as { items: ListItem[] }).items;
    expect(items.map((item) => item.loanNumber)).toEqual(["2026-0002", "2026-0001", "2026-0004", "2026-0003"]);
    expect(items.map((item) => item.situation)).toEqual(["OVERDUE", "CURRENT", "PAID_OFF", "PAID_OFF"]);
  });

  it("C1 (A1): gives outstandingCents and nextDueDate of the admin view, and null date plus zero when paid off", async () => {
    const items = ((await portal("/loans")).body as { items: ListItem[] }).items;
    const [overdue, current, paidOff] = items;
    expect(current).toMatchObject({ id: CURRENT, principalCents: 500000, nextDueDate: "2026-12-20" });
    expect(current?.outstandingCents).toBe((await adminDetail(CURRENT)).outstandingCents);
    expect(overdue).toMatchObject({ id: OVERDUE, nextDueDate: "2026-11-19" });
    expect(overdue?.outstandingCents).toBe((await adminDetail(OVERDUE)).outstandingCents);
    expect(paidOff).toMatchObject({ outstandingCents: 0, nextDueDate: null });
  });

  it("C2 (A1): a person with no loans gets {items: []}", async () => {
    await client.query(
      "delete from lending.installments where loan_id in (select id from lending.loans where person_id = $1)",
      [BETO],
    );
    await client.query("delete from lending.loans where person_id = $1", [BETO]);
    const r = await portal("/loans", `pilla_portal=${TOKEN_BETO}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ items: [] });
  });

  it("C3: answers with Cache-Control no-store and no Set-Cookie", async () => {
    const r = await portal("/loans");
    expect(r.headers["cache-control"]).toContain("no-store");
    expect(r.headers["set-cookie"]).toBeUndefined();
  });
});

describe("GET /portal/loans/{id}", () => {
  it("C4 (A2): an ACTIVE current loan matches the admin figures of the same date", async () => {
    const r = await portal(`/loans/${CURRENT}`);
    expect(r.status).toBe(200);
    expect(portalLoanDetailResponse.safeParse(r.body).success).toBe(true);
    const body = r.body as Detail;
    const reference = await adminDetail(CURRENT);
    expect(body).toMatchObject({
      id: CURRENT,
      loanNumber: "2026-0001",
      situation: "CURRENT",
      principalCents: 500000,
      totalCents: reference.totalCents,
      paidCents: reference.paidCents,
      outstandingCents: reference.outstandingCents,
      lateChargesCents: 0,
    });
    expect(body.installments).toEqual(
      reference.installments.map((item) => ({
        number: item.number,
        dueDate: item.dueDate,
        amountCents: item.totalCents,
        paidCents: item.paidCents,
        lateChargesCents: item.lateChargesCents,
        status: item.status,
      })),
    );
    expect(body.installments.map((item) => item.status)).toEqual(["PAID", "PARTIAL"]);
  });

  it("C5 (A2, A3, A11): an overdue loan shows late charges, an OVERDUE installment and the first unpaid one as next", async () => {
    const body = (await portal(`/loans/${OVERDUE}`)).body as Detail;
    const reference = await adminDetail(OVERDUE);
    expect(body.situation).toBe("OVERDUE");
    expect(body.installments[0]).toMatchObject({ number: 1, dueDate: "2026-11-19", status: "OVERDUE" });
    expect(body.installments[0]?.lateChargesCents).toBeGreaterThan(0);
    expect(body.lateChargesCents).toBe(reference.installments.reduce((sum, item) => sum + item.lateChargesCents, 0));
    expect(body.outstandingCents).toBe(reference.outstandingCents);
    expect(body.nextInstallment).toEqual({ number: 1, dueDate: "2026-11-19", amountCents: 120000 });
  });

  it("C6 (A3): the next installment is the first unpaid one with total minus paid", async () => {
    const body = (await portal(`/loans/${CURRENT}`)).body as Detail;
    expect(body.nextInstallment).toEqual({ number: 2, dueDate: "2026-12-20", amountCents: 60000 });
  });

  it("C7 (A2, A3): a PAID_OFF loan has no next installment, nothing outstanding and no late charges", async () => {
    const body = (await portal(`/loans/${PAID_OFF_OLD}`)).body as Detail;
    expect(body).toMatchObject({
      situation: "PAID_OFF",
      nextInstallment: null,
      outstandingCents: 0,
      lateChargesCents: 0,
      paidCents: 120000,
    });
  });

  it("C8 (A4): payments are only the confirmed, not reversed ones, oldest first, with three fields", async () => {
    const body = (await portal(`/loans/${CURRENT}`)).body as Detail;
    expect(body.payments).toEqual([
      { paidAt: "2026-10-18", amountCents: 120000, method: "PIX" },
      { paidAt: "2026-11-05", amountCents: 60000, method: "CASH" },
    ]);
  });
});

describe("isolation (CA-09)", () => {
  it("C9 (A5): another person's loan and an unknown id give the same 404 body", async () => {
    const theirs = await portal(`/loans/${BETO_LOAN}`);
    const unknown = await portal(`/loans/${UNKNOWN}`);
    expect(theirs.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(theirs.text).toBe(unknown.text);
    expect(theirs.body).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(theirs.headers["content-type"]).toBe(unknown.headers["content-type"]);
  });

  it("C9 (A5): an id that is not a uuid also gives the same 404", async () => {
    const junk = await portal("/loans/nao-e-uuid");
    expect(junk.status).toBe(404);
    expect(junk.text).toBe((await portal(`/loans/${UNKNOWN}`)).text);
  });

  it("C10 (A5): the list of Ana never has a loan of Beto, even asking for ?personId= or ?cpf=", async () => {
    for (const query of ["", `?personId=${BETO}`, "?cpf=11144477735", `?personId=${BETO}&cpf=11144477735`]) {
      const ids = ((await portal(`/loans${query}`)).body as { items: ListItem[] }).items.map((item) => item.id);
      expect(ids).toEqual([OVERDUE, CURRENT, PAID_OFF_NEW, PAID_OFF_OLD]);
    }
  });

  it("C10 (A5): the session of Beto sees only his loan, and Ana's loans are 404 for him", async () => {
    const own = ((await portal("/loans", `pilla_portal=${TOKEN_BETO}`)).body as { items: ListItem[] }).items;
    expect(own.map((item) => item.id)).toEqual([BETO_LOAN]);
    expect((await portal(`/loans/${CURRENT}`, `pilla_portal=${TOKEN_BETO}`)).status).toBe(404);
  });

  it.each([
    ["DRAFT", DRAFT],
    ["CANCELLED", CANCELLED],
    ["WRITTEN_OFF", WRITTEN_OFF],
    ["RENEWED", RENEWED],
    ["RENEGOTIATED", RENEGOTIATED],
  ])("C11 (A6): a %s loan of Ana is 404 for Ana, like an unknown id", async (_status, id) => {
    const r = await portal(`/loans/${id}`);
    expect(r.status).toBe(404);
    expect(r.text).toBe((await portal(`/loans/${UNKNOWN}`)).text);
  });
});

describe("leak (RF-63, D10 c and d)", () => {
  it("C12 (A7): the keys of the list and the detail are exactly the schema keys, nested ones too", async () => {
    const items = ((await portal("/loans")).body as { items: Record<string, unknown>[] }).items;
    for (const item of items) expect(Object.keys(item).sort()).toEqual(LIST_KEYS);
    const detail = (await portal(`/loans/${CURRENT}`)).body as Record<string, unknown>;
    expect(Object.keys(detail).sort()).toEqual(DETAIL_KEYS);
    const nested = detail as unknown as Detail;
    expect(Object.keys(nested.nextInstallment ?? {}).sort()).toEqual(NEXT_KEYS);
    for (const installment of nested.installments) expect(Object.keys(installment).sort()).toEqual(INSTALLMENT_KEYS);
    expect(nested.payments.length).toBeGreaterThan(0);
    for (const payment of nested.payments) expect(Object.keys(payment).sort()).toEqual(PAYMENT_KEYS);
  });

  it("C13 (A7): no response carries a seeded CPF, name, phone, e-mail, Pix key, note, receipt, account or id of other tables", async () => {
    const replies = [await portal("/loans"), await portal(`/loans/${CURRENT}`), await portal(`/loans/${OVERDUE}`)];
    replies.push(await portal(`/loans/${PAID_OFF_OLD}`), await portal(`/loans/${BETO_LOAN}`));
    for (const r of replies) {
      const dump = r.text + JSON.stringify(r.headers);
      for (const secret of SECRETS) expect(dump).not.toContain(secret);
      for (const id of [ANA, BETO, ACCOUNT, USER, RECEIPT]) expect(dump).not.toContain(id);
    }
    const paymentIds = (await client.query<{ id: string }>("select id from payments.payments")).rows.map(
      (row) => row.id,
    );
    const detail = (await portal(`/loans/${CURRENT}`)).text;
    for (const id of paymentIds) expect(detail).not.toContain(id);
  });
});

describe("guard", () => {
  const paths = ["/loans", `/loans/${CURRENT}`];

  it.each(paths)("C14 (A8): GET %s without a cookie gives 401 UNAUTHENTICATED", async (path) => {
    const r = await request(baseUrl).get(`/api/v1/portal${path}`);
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
  });

  it.each(paths)("C14 (A8): GET %s with an idle session (30 min) gives 401", async (path) => {
    vi.setSystemTime(new Date(NOW.getTime() + 31 * MINUTE));
    expect((await portal(path)).status).toBe(401);
  });

  it.each(paths)("C14 (A8): GET %s after the access was disabled gives 401", async (path) => {
    expect((await portal(path)).status).toBe(200);
    await client.query("update access.portal_access set enabled = false where person_id = $1", [ANA]);
    expect((await portal(path)).status).toBe(401);
  });

  it.each(paths)("C14 (A8): GET %s with an ADMIN session gives 401", async (path) => {
    expect((await admin.get(`/api/v1/portal${path}`)).status).toBe(401);
  });

  it("C14 (A8): the portal cookie does not open the ADMIN routes", async () => {
    expect((await request(baseUrl).get(`/api/v1/loans/${CURRENT}`).set("Cookie", asAna().cookie)).status).toBe(401);
  });
});

describe("read-only (D11)", () => {
  const writes = ["post", "put", "patch", "delete"] as const;
  const paths = ["/loans", `/loans/${CURRENT}`];

  it.each(writes.flatMap((verb) => paths.map((path) => [verb, path] as const)))(
    "C15 (A9): %s %s is never 2xx",
    async (verb, path) => {
      const r = await request(baseUrl)
        [verb](`/api/v1/portal${path}`)
        .set("Cookie", asAna().cookie)
        .send({ enabled: true });
      expect(r.status).toBeGreaterThanOrEqual(400);
    },
  );

  it("C15 (A10): a battery of reads changes no row count in any table", async () => {
    const tables = (
      await client.query<{ table_schema: string; table_name: string }>(
        `select table_schema, table_name from information_schema.tables
         where table_type = 'BASE TABLE' and table_schema in ('access', 'core', 'lending', 'payments', 'people', 'treasury')`,
      )
    ).rows;
    expect(tables.length).toBeGreaterThan(10);
    const counts = async (): Promise<Record<string, number>> => {
      const entries: [string, number][] = [];
      for (const { table_schema: schema, table_name: name } of tables) {
        const { rows } = await client.query<{ total: string }>(`select count(*) as total from ${schema}.${name}`);
        entries.push([`${schema}.${name}`, Number(rows[0]?.total)]);
      }
      return Object.fromEntries(entries);
    };
    const before = await counts();
    for (const id of [CURRENT, OVERDUE, PAID_OFF_OLD, BETO_LOAN, UNKNOWN]) await portal(`/loans/${id}`);
    await portal("/loans");
    await portal("/loans", `pilla_portal=${TOKEN_BETO}`);
    expect(await counts()).toEqual(before);
  });
});
