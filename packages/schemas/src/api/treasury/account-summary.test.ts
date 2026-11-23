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

// RF-31, A9: a conta traz o saldo derivado (ADR-0005), inteiro e possivelmente negativo (A10 da F02).
const account = {
  id: "01936f8e-7b2c-7cde-8f00-000000000002",
  name: "Conta base",
  active: true,
  balanceCents: 1000000,
};

describe("accountSummarySchema (RF-31, A9)", () => {
  const parse = async (input: unknown): Promise<ParseResult> =>
    (await loadSchema("./account-summary", "accountSummarySchema")).safeParse(input);

  it("accepts an account with an integer balanceCents", async () => {
    expect((await parse(account)).success).toBe(true);
  });

  it("accepts a zero balance", async () => {
    expect((await parse({ ...account, balanceCents: 0 })).success).toBe(true);
  });

  it("accepts a negative balance", async () => {
    expect((await parse({ ...account, balanceCents: -2500 })).success).toBe(true);
  });

  it("refuses a missing balanceCents", async () => {
    expect((await parse(without(account, "balanceCents"))).success).toBe(false);
  });

  it.each([10.5, "100", null])("refuses balanceCents %j", async (balanceCents) => {
    expect((await parse({ ...account, balanceCents })).success).toBe(false);
  });

  it("refuses an unknown key", async () => {
    expect((await parse({ ...account, extra: 1 })).success).toBe(false);
  });
});

describe("accountListResponse (RF-31, A9)", () => {
  const parse = async (input: unknown): Promise<ParseResult> =>
    (await loadSchema("./account-summary", "accountListResponse")).safeParse(input);

  it("accepts a list of accounts with balanceCents", async () => {
    expect((await parse({ items: [account] })).success).toBe(true);
  });

  it("refuses a listed account without balanceCents", async () => {
    expect((await parse({ items: [without(account, "balanceCents")] })).success).toBe(false);
  });
});
