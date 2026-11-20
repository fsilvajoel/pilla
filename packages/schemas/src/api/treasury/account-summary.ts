import { z } from "zod";
import { idSchema } from "../../common";

/** Conta resumida: opção da "Conta de destino" do pagamento (RF-20; RFC-005 `accounts`). */
export const accountSummarySchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(100),
  active: z.boolean(),
});
export type AccountSummary = z.infer<typeof accountSummarySchema>;

/** Resposta 200 de GET /accounts (RFC-004). */
export const accountListResponse = z.strictObject({
  items: z.array(accountSummarySchema),
});
export type AccountListResponse = z.infer<typeof accountListResponse>;
