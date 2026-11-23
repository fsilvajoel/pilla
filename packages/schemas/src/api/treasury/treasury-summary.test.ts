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

const without = (obj: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj).filter(([name]) => name !== key));

// RF-32, D7: caixa, emprestado, percentuais em bps (0 a 10000, somando 10000), indicadores do mês. ADR-0004: inteiros.
const summary = {
  month: "2027-01",
  cashCents: 7000000,
  lentCents: 3000000,
  committedBps: 3000,
  availableBps: 7000,
  maxCommittedBps: 8000,
  interestReceivedCents: 120000,
  lateChargesReceivedCents: 5000,
  recoveredCents: 0,
  lossesCents: 0,
  forecastCents: 450000,
};

describe("treasurySummaryResponse (RF-32, A12)", () => {
  const parse = async (input: unknown): Promise<ParseResult> =>
    (await loadSchema("./treasury-summary", "treasurySummaryResponse")).safeParse(input);

  it("accepts a complete summary", async () => {
    expect((await parse(summary)).success).toBe(true);
  });

  it("accepts null committedBps and availableBps together (empty portfolio)", async () => {
    const empty = { ...summary, cashCents: 0, lentCents: 0, committedBps: null, availableBps: null };
    expect((await parse(empty)).success).toBe(true);
  });

  it("accepts a null maxCommittedBps", async () => {
    expect((await parse({ ...summary, maxCommittedBps: null })).success).toBe(true);
  });

  it("accepts the bounds 0/10000 and 10000/0", async () => {
    expect((await parse({ ...summary, committedBps: 0, availableBps: 10000 })).success).toBe(true);
    expect((await parse({ ...summary, committedBps: 10000, availableBps: 0 })).success).toBe(true);
  });

  it("accepts a negative cashCents", async () => {
    expect((await parse({ ...summary, cashCents: -1000 })).success).toBe(true);
  });

  it.each([
    [10001, -1],
    [-1, 10001],
    [3000, 6999],
    [3000, 7001],
    [3000.5, 6999.5],
  ])("refuses committedBps %j with availableBps %j", async (committedBps, availableBps) => {
    expect((await parse({ ...summary, committedBps, availableBps })).success).toBe(false);
  });

  it.each([
    [3000, null],
    [null, 7000],
  ])("refuses a single null percentage (%j, %j)", async (committedBps, availableBps) => {
    expect((await parse({ ...summary, committedBps, availableBps })).success).toBe(false);
  });

  it.each(["2027-13", "2027-1", "01/2027", "2027-01-15", "1999-12"])("refuses month %j", async (month) => {
    expect((await parse({ ...summary, month })).success).toBe(false);
  });

  it.each([
    "cashCents",
    "lentCents",
    "interestReceivedCents",
    "lateChargesReceivedCents",
    "recoveredCents",
    "lossesCents",
    "forecastCents",
    "maxCommittedBps",
  ])("refuses a float %s", async (key) => {
    expect((await parse({ ...summary, [key]: 10.5 })).success).toBe(false);
  });

  it("refuses an unknown key", async () => {
    expect((await parse({ ...summary, extra: 1 })).success).toBe(false);
  });

  it("refuses a missing forecastCents", async () => {
    expect((await parse(without(summary, "forecastCents"))).success).toBe(false);
  });
});
