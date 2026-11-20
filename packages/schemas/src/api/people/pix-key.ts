import { z } from "zod";
import { idSchema } from "../../common";

/** Tipos de chave PIX (RFC-005 `pix_keys.type`). */
export const pixKeyTypeSchema = z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"]);
export type PixKeyType = z.infer<typeof pixKeyTypeSchema>;

const pixKeyValue = z.string().trim().min(1).max(140);

/** Chave PIX de uma pessoa (RFC-005 `pix_keys`, RF-02). */
export const pixKeySchema = z.strictObject({
  id: idSchema,
  type: pixKeyTypeSchema,
  value: pixKeyValue,
  isPrimary: z.boolean(),
});
export type PixKey = z.infer<typeof pixKeySchema>;

/** POST /people/{id}/pix-keys (RFC-004, RF-02). `isPrimary` omitido = false. */
export const createPixKeyRequest = z.strictObject({
  type: pixKeyTypeSchema,
  value: pixKeyValue,
  isPrimary: z.boolean().optional(),
});
export type CreatePixKeyRequest = z.infer<typeof createPixKeyRequest>;

/** PATCH /pix-keys/{id} (RFC-004, RF-02): só os campos enviados mudam. */
export const updatePixKeyRequest = createPixKeyRequest.partial();
export type UpdatePixKeyRequest = z.infer<typeof updatePixKeyRequest>;
