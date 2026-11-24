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

// RF-31, ADR-0004: todos os valores em centavos inteiros com sinal; saldo sempre derivado (ADR-0005).
const item = {
  id: "01936f8e-7b2c-7cde-8f00-000000000001",
  accountId: "01936f8e-7b2c-7cde-8f00-000000000002",
  type: "CAPITAL_IN",
  component: null,
  amountCents: 1000000,
  entryDate: "2027-01-02",
  justification: "aporte inicial",
  sourceType: null,
  sourceId: null,
  createdAt: "2027-01-02T12:00:00-03:00",
  balanceAfterCents: 1000000,
};
const statement = {
  accountId: "01936f8e-7b2c-7cde-8f00-000000000002",
  from: "2027-01-01",
  to: "2027-01-31",
  openingBalanceCents: 0,
  closingBalanceCents: 1000000,
  items: [item],
  nextCursor: null,
};

describe("accountStatementResponse (RF-31, A9)", () => {
  const parse = async (input: unknown): Promise<ParseResult> =>
    (await loadSchema("./account-statement", "accountStatementResponse")).safeParse(input);

  it("accepts a statement with items", async () => {
    expect((await parse(statement)).success).toBe(true);
  });

  it("accepts null from, to and nextCursor, and an empty period", async () => {
    const empty = { ...statement, from: null, to: null, items: [], closingBalanceCents: 0 };
    expect((await parse(empty)).success).toBe(true);
  });

  it("accepts a cursor string", async () => {
    expect((await parse({ ...statement, nextCursor: "opaque-cursor" })).success).toBe(true);
  });

  it("accepts negative signed balances and amounts", async () => {
    const negative = {
      ...statement,
      openingBalanceCents: -500,
      closingBalanceCents: -3000,
      items: [{ ...item, type: "CAPITAL_OUT", amountCents: -2500, balanceAfterCents: -3000 }],
    };
    expect((await parse(negative)).success).toBe(true);
  });

  it.each(["openingBalanceCents", "closingBalanceCents"])("refuses a float %s", async (key) => {
    expect((await parse({ ...statement, [key]: 10.5 })).success).toBe(false);
  });

  it.each(["openingBalanceCents", "closingBalanceCents", "items"])("refuses a missing %s", async (key) => {
    expect((await parse(without(statement, key))).success).toBe(false);
  });

  it("refuses a float amountCents in an item", async () => {
    expect((await parse({ ...statement, items: [{ ...item, amountCents: 10.5 }] })).success).toBe(false);
  });

  it("refuses a float balanceAfterCents in an item", async () => {
    expect((await parse({ ...statement, items: [{ ...item, balanceAfterCents: 10.5 }] })).success).toBe(false);
  });

  it("refuses an item without balanceAfterCents", async () => {
    expect((await parse({ ...statement, items: [without(item, "balanceAfterCents")] })).success).toBe(false);
  });

  it("refuses an unknown key in the statement", async () => {
    expect((await parse({ ...statement, extra: 1 })).success).toBe(false);
  });

  it("refuses an unknown key in an item", async () => {
    expect((await parse({ ...statement, items: [{ ...item, extra: 1 }] })).success).toBe(false);
  });
});
