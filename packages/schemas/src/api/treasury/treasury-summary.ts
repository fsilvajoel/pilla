import { z } from "zod";
import { bpsSchema, isoDateSchema } from "../../common";
import { balanceCentsSchema } from "./account-statement";

/** Mês do painel: AAAA-MM, de 2000-01 em diante (E12 D7). */
export const monthSchema = z
  .string()
  .length(7)
  .refine((month) => isoDateSchema.safeParse(`${month}-01`).success && month >= "2000-01");

/** Consulta de GET /treasury/summary: `month` opcional (padrão: mês corrente em Brasília). */
export const treasurySummaryQuery = z.strictObject({ month: monthSchema.optional() });
export type TreasurySummaryQuery = z.infer<typeof treasurySummaryQuery>;

const MAX_BPS = 10000;

/** Resposta 200 de GET /treasury/summary (RF-32, E12 D7): tudo derivado na hora (ADR-0005), em centavos inteiros e bps. */
export const treasurySummaryResponse = z
  .strictObject({
    month: monthSchema,
    cashCents: balanceCentsSchema,
    lentCents: balanceCentsSchema,
    committedBps: bpsSchema.max(MAX_BPS).nullable(),
    availableBps: bpsSchema.max(MAX_BPS).nullable(),
    maxCommittedBps: bpsSchema.max(MAX_BPS).nullable(),
    interestReceivedCents: balanceCentsSchema,
    lateChargesReceivedCents: balanceCentsSchema,
    recoveredCents: balanceCentsSchema,
    lossesCents: balanceCentsSchema,
    forecastCents: balanceCentsSchema,
  })
  .refine(
    (summary) =>
      summary.committedBps === null || summary.availableBps === null
        ? summary.committedBps === summary.availableBps
        : summary.committedBps + summary.availableBps === MAX_BPS,
    { message: "committedBps and availableBps must both be null or add up to 10000" },
  );
export type TreasurySummaryResponse = z.infer<typeof treasurySummaryResponse>;
