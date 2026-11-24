import { z } from "zod";
import { idSchema, instantSchema } from "../../common";

/** Motivos de revisão de uma linha importada: lista fechada (RF-70, E16.md D4). */
export const importReviewReasonSchema = z.enum([
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
]);
export type ImportReviewReason = z.infer<typeof importReviewReasonSchema>;

/** Motivos de rejeição: dado obrigatório ausente ou falha inesperada ao gravar a linha. */
export const importRejectReasonSchema = z.enum(["MISSING_REQUIRED", "ROW_FAILED"]);
export type ImportRejectReason = z.infer<typeof importRejectReasonSchema>;

/** Só REVIEW e REJECTED aparecem no relatório; as linhas OK entram apenas nos totais (E16.md D9). */
export const importRowStatusSchema = z.enum(["REVIEW", "REJECTED"]);
export type ImportRowStatus = z.infer<typeof importRowStatusSchema>;

const countSchema = z.int().min(0).max(2000);

export const importReportTotals = z.strictObject({
  rows: countSchema,
  ok: countSchema,
  review: countSchema,
  rejected: countSchema,
  personsCreated: countSchema,
  personsReused: countSchema,
  personsWithoutCpf: countSchema,
  loansCreated: countSchema,
  paymentsCreated: countSchema,
});
export type ImportReportTotals = z.infer<typeof importReportTotals>;

export const importReportRow = z.strictObject({
  lineNumber: z.int().min(1).max(2001),
  status: importRowStatusSchema,
  reasons: z.array(z.union([importReviewReasonSchema, importRejectReasonSchema])).min(1),
  personId: idSchema.nullable(),
  loanId: idSchema.nullable(),
});
export type ImportReportRow = z.infer<typeof importReportRow>;

/** Resposta de POST /imports/spreadsheet e GET /imports/{id} (RFC-004 §3). */
export const importReportResponse = z.strictObject({
  id: idSchema,
  createdAt: instantSchema,
  totals: importReportTotals,
  rows: z.array(importReportRow),
});
export type ImportReportResponse = z.infer<typeof importReportResponse>;
