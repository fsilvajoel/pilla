import { z } from "zod";
import { idSchema } from "../../common";

const addressFields = {
  street: z.string().trim().min(1).max(150),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().min(1).max(100).optional(),
  district: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  /** UF em maiúsculas (RFC-005 `addresses.state char(2)`). */
  state: z.string().regex(/^[A-Z]{2}$/),
  /** CEP só com dígitos (RFC-005 `addresses.postal_code char(8)`). */
  postalCode: z.string().regex(/^\d{8}$/),
  isPrimary: z.boolean(),
};

/** Endereço de uma pessoa (RFC-005 `addresses`, RF-02). */
export const addressSchema = z.strictObject({ id: idSchema, ...addressFields });
export type Address = z.infer<typeof addressSchema>;

/** POST /people/{id}/addresses (RFC-004, RF-02). `isPrimary` omitido = false. */
export const createAddressRequest = z.strictObject({
  ...addressFields,
  isPrimary: addressFields.isPrimary.optional(),
});
export type CreateAddressRequest = z.infer<typeof createAddressRequest>;

/** PATCH /addresses/{id} (RFC-004, RF-02): só os campos enviados mudam. */
export const updateAddressRequest = createAddressRequest.partial();
export type UpdateAddressRequest = z.infer<typeof updateAddressRequest>;
