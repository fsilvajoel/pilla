import { z } from "zod";
import { idSchema, instantSchema, isoDateSchema, signedCentsSchema } from "../../common";

/** Saldo derivado em centavos: inteiro com sinal, zero permitido (ADR-0004, ADR-0005). */
export const balanceCentsSchema = z.int();

/** Lançamento do extrato (RF-31; não é o accountEntryResponse do lançamento manual, F02): o lançamento do ledger mais o saldo acumulado até ele, inclusive (ADR-0005). */
export const accountStatementEntry = z.strictObject({
  id: idSchema,
  accountId: idSchema,
  type: z.enum(["CAPITAL_IN", "CAPITAL_OUT", "DISBURSEMENT", "REPAYMENT", "REVERSAL", "ADJUSTMENT"]),
  component: z.enum(["PRINCIPAL", "INTEREST", "LATE_CHARGES", "RECOVERY"]).nullable(),
  amountCents: signedCentsSchema,
  entryDate: isoDateSchema,
  justification: z.string().nullable(),
  sourceType: z.enum(["LOAN", "PAYMENT"]).nullable(),
  sourceId: idSchema.nullable(),
  createdAt: instantSchema,
  balanceAfterCents: balanceCentsSchema,
});
export type AccountStatementEntry = z.infer<typeof accountStatementEntry>;

/** Resposta 200 de GET /accounts/{id}/entries (RFC-004 §3): extrato com saldo inicial e final derivados do ledger. */
export const accountStatementResponse = z.strictObject({
  accountId: idSchema,
  from: isoDateSchema.nullable(),
  to: isoDateSchema.nullable(),
  openingBalanceCents: balanceCentsSchema,
  closingBalanceCents: balanceCentsSchema,
  items: z.array(accountStatementEntry),
  nextCursor: z.string().nullable(),
});
export type AccountStatementResponse = z.infer<typeof accountStatementResponse>;

/** Consulta de GET /accounts/{id}/entries. `limit` vem como texto na URL: padrão 50, de 1 a 200. */
export const accountStatementQuery = z
  .strictObject({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    limit: z
      .string()
      .max(3)
      .refine((text) => text !== "" && Array.from(text).every((char) => "0123456789".includes(char)))
      .transform((text) => Number(text))
      .pipe(z.int().min(1).max(200))
      .default(50),
    cursor: z.string().min(1).max(100).optional(),
  })
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    message: "from must not be after to",
    path: ["from"],
  });
export type AccountStatementQuery = z.infer<typeof accountStatementQuery>;
