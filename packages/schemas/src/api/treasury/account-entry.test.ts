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

// ADR-0004: dinheiro em centavos inteiros, com sinal como gravado. Ids fictícios em UUID v7.
const manual = {
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
};
const automatic = {
  ...manual,
  id: "01936f8e-7b2c-7cde-8f00-000000000003",
  type: "REPAYMENT",
  component: "INTEREST",
  amountCents: 31667,
  justification: null,
  sourceType: "PAYMENT",
  sourceId: "01936f8e-7b2c-7cde-8f00-000000000004",
};

describe("accountEntryResponse (RF-30, A11)", () => {
  const parse = async (input: unknown): Promise<ParseResult> =>
    (await loadSchema("./account-entry", "accountEntryResponse")).safeParse(input);

  it("accepts a manual entry with null component and source", async () => {
    expect((await parse(manual)).success).toBe(true);
  });

  it("accepts an automatic entry with component and source from the enums", async () => {
    expect((await parse(automatic)).success).toBe(true);
  });

  it("accepts a negative amountCents, as recorded", async () => {
    expect((await parse({ ...manual, type: "CAPITAL_OUT", amountCents: -250000 })).success).toBe(true);
  });

  it("refuses a float amountCents", async () => {
    expect((await parse({ ...manual, amountCents: 10.5 })).success).toBe(false);
  });

  it("refuses an unknown key", async () => {
    expect((await parse({ ...manual, extra: true })).success).toBe(false);
  });

  it.each(["CAPITAL_IN", "CAPITAL_OUT", "ADJUSTMENT", "DISBURSEMENT", "REPAYMENT", "REVERSAL"])(
    "accepts the ledger type %s",
    async (type) => {
      expect((await parse({ ...manual, type })).success).toBe(true);
    },
  );

  it.each(["TRANSFER", "capital_in", ""])("refuses the type %j outside the six ledger types", async (type) => {
    expect((await parse({ ...manual, type })).success).toBe(false);
  });

  it.each(["FEES", "principal"])("refuses the component %j outside the enum", async (component) => {
    expect((await parse({ ...automatic, component })).success).toBe(false);
  });

  it("refuses a sourceType outside the enum", async () => {
    expect((await parse({ ...automatic, sourceType: "PERSON" })).success).toBe(false);
  });
});
