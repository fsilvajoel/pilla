import { describe, expect, it } from "vitest";

type ParseResult = { success: boolean };
type SchemaLike = { safeParse(input: unknown): ParseResult };

// Carrega o schema na hora do teste: enquanto ele não existe, cada caso falha com a causa certa (RN-T01).
async function loadSchema(file: string, name: string): Promise<SchemaLike> {
  const mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
  const schema = mod[name] as SchemaLike | undefined;
  if (schema === undefined) throw new Error(`${name} is not exported by ${file}`);
  return schema;
}

// RF-70, ADR-0004: contagens inteiras; relatório só com linhas REVIEW e REJECTED (E16.md D9).
const totals = {
  rows: 10,
  ok: 7,
  review: 2,
  rejected: 1,
  personsCreated: 8,
  personsReused: 1,
  personsWithoutCpf: 3,
  loansCreated: 9,
  paymentsCreated: 4,
};
const reviewRow = {
  lineNumber: 3,
  status: "REVIEW",
  reasons: ["SCHEDULE_MISMATCH", "CPF_INVALID"],
  personId: "01936f8e-7b2c-7cde-8f00-000000000001",
  loanId: "01936f8e-7b2c-7cde-8f00-000000000002",
};
const rejectedRow = {
  lineNumber: 5,
  status: "REJECTED",
  reasons: ["MISSING_REQUIRED"],
  personId: null,
  loanId: null,
};
const report = {
  id: "01936f8e-7b2c-7cde-8f00-000000000003",
  createdAt: "2027-01-02T12:00:00-03:00",
  totals,
  rows: [reviewRow, rejectedRow],
};

const reviewReasons = [
  "SCHEDULE_MISMATCH",
  "TYPE_UNKNOWN",
  "RATE_MISSING",
  "INSTALLMENTS_MISSING",
  "FIRST_DUE_MISSING",
  "DATE_NOT_PARSEABLE",
  "CPF_INVALID",
  "PAID_EXCEEDS_TOTAL",
  "PAID_DATE_MISSING",
  "DUPLICATE_PERSON_NAME",
];

describe("importReportResponse (RF-70, A1 a A3)", () => {
  const parse = async (input: unknown): Promise<ParseResult> =>
    (await loadSchema("./import-report", "importReportResponse")).safeParse(input);

  it("accepts a report with review and rejected rows", async () => {
    expect((await parse(report)).success).toBe(true);
  });

  it("accepts a report without rows", async () => {
    expect((await parse({ ...report, rows: [] })).success).toBe(true);
  });

  it.each(reviewReasons)("accepts the review reason %s", async (reason) => {
    const row = { ...reviewRow, reasons: [reason] };
    expect((await parse({ ...report, rows: [row] })).success).toBe(true);
  });

  it.each(["MISSING_REQUIRED", "ROW_FAILED"])("accepts the rejected reason %s", async (reason) => {
    const row = { ...rejectedRow, reasons: [reason] };
    expect((await parse({ ...report, rows: [row] })).success).toBe(true);
  });

  it("accepts null personId and loanId", async () => {
    const row = { ...reviewRow, personId: null, loanId: null };
    expect((await parse({ ...report, rows: [row] })).success).toBe(true);
  });

  it.each(Object.keys(totals))("refuses a negative total %s", async (key) => {
    expect((await parse({ ...report, totals: { ...totals, [key]: -1 } })).success).toBe(false);
  });

  it("refuses a float total", async () => {
    expect((await parse({ ...report, totals: { ...totals, rows: 1.5 } })).success).toBe(false);
  });

  it("refuses lineNumber 0", async () => {
    expect((await parse({ ...report, rows: [{ ...reviewRow, lineNumber: 0 }] })).success).toBe(false);
  });

  it("refuses a row with status OK", async () => {
    expect((await parse({ ...report, rows: [{ ...reviewRow, status: "OK" }] })).success).toBe(false);
  });

  it("refuses an unknown reason", async () => {
    expect((await parse({ ...report, rows: [{ ...reviewRow, reasons: ["NOPE"] }] })).success).toBe(false);
  });

  it("refuses empty reasons", async () => {
    expect((await parse({ ...report, rows: [{ ...reviewRow, reasons: [] }] })).success).toBe(false);
  });

  it("refuses a non-uuid personId", async () => {
    expect((await parse({ ...report, rows: [{ ...reviewRow, personId: "abc" }] })).success).toBe(false);
  });

  it("refuses a non-uuid loanId", async () => {
    expect((await parse({ ...report, rows: [{ ...reviewRow, loanId: "abc" }] })).success).toBe(false);
  });

  it("refuses an unknown key in the report", async () => {
    expect((await parse({ ...report, extra: 1 })).success).toBe(false);
  });

  it("refuses an unknown key in totals", async () => {
    expect((await parse({ ...report, totals: { ...totals, extra: 1 } })).success).toBe(false);
  });

  it("refuses an unknown key in a row", async () => {
    expect((await parse({ ...report, rows: [{ ...reviewRow, extra: 1 }] })).success).toBe(false);
  });
});
