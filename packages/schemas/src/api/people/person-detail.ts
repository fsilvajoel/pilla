import { z } from "zod";
import { cpfSchema, idSchema, isoDateSchema, phoneSchema } from "../../common";
import { addressSchema } from "./address";
import { personSummarySchema } from "./create-person";
import { pixKeySchema } from "./pix-key";

/** Resposta 200 de GET /people/{id} (RFC-004, RF-04): ficha. Resumo de contratos fica para a entrega de crédito. */
export const personDetailResponse = z.strictObject({
  id: idSchema,
  fullName: z.string().min(1),
  cpf: cpfSchema,
  phone: phoneSchema,
  email: z.email().optional(),
  birthDate: isoDateSchema.optional(),
  notes: z.string().optional(),
  active: z.boolean(),
  version: z.int().nonnegative(),
  referrer: personSummarySchema.nullable(),
  referrals: z.array(personSummarySchema),
  addresses: z.array(addressSchema),
  pixKeys: z.array(pixKeySchema),
});
export type PersonDetailResponse = z.infer<typeof personDetailResponse>;
