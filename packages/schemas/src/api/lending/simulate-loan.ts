// MÓDULO-MODELO da API (E2-T13, Claude). Cada corpo de requisição segue esta forma, um arquivo por rota.
import { z } from "zod";
import { bpsSchema, centsSchema, isoDateSchema, positiveCentsSchema } from "../../common";

/** Glossário: INSTALLMENT (parcelado, juros simples) · SINGLE_PAYMENT (parcela única). */
export const loanTypeSchema = z.enum(["INSTALLMENT", "SINGLE_PAYMENT"]);
/** Glossário: periodicidade `{ unit, interval }`; a cada `interval` dias ou meses. */
export const frequencySchema = z.strictObject({ unit: z.enum(["DAY", "MONTH"]), interval: z.int().positive() });

/** POST /loans/simulate (RFC-004 §3 lending, RF-10): calcula sem gravar. */
export const simulateLoanRequest = z
  .strictObject({
    type: loanTypeSchema,
    principalCents: positiveCentsSchema,
    monthlyInterestRateBps: bpsSchema,
    installmentCount: z.int().positive(),
    frequency: frequencySchema,
    firstDueDate: isoDateSchema,
  })
  .refine((r) => r.type === "INSTALLMENT" || r.installmentCount === 1, {
    message: "SINGLE_PAYMENT has exactly one installment",
    path: ["installmentCount"],
  });
export type SimulateLoanRequest = z.infer<typeof simulateLoanRequest>;

/** Linha do cronograma (RFC-005 `installments`: total = principal + juros). */
export const scheduleLineSchema = z
  .strictObject({
    number: z.int().positive(),
    dueDate: isoDateSchema,
    principalCents: centsSchema,
    interestCents: centsSchema,
    totalCents: centsSchema,
  })
  .refine((l) => l.totalCents === l.principalCents + l.interestCents, {
    message: "totalCents must equal principalCents + interestCents",
    path: ["totalCents"],
  });

/** Resposta 200 de POST /loans/simulate (RFC-004 §5). */
export const simulateLoanResponse = z.strictObject({
  interestCents: centsSchema,
  totalCents: centsSchema,
  installmentAmountCents: centsSchema,
  periodRateBps: bpsSchema,
  schedule: z.array(scheduleLineSchema).min(1),
});
export type SimulateLoanResponse = z.infer<typeof simulateLoanResponse>;
