import { z } from "zod";
import { idSchema } from "../../common";

/** Resposta de POST /auth/admin/login e GET /auth/admin/me (RFC-004 §3, ADR-0011). */
export const adminMeResponse = z.strictObject({
  id: idSchema,
  username: z.string().min(1).max(100),
  role: z.literal("ADMIN"),
});

export type AdminMeResponse = z.infer<typeof adminMeResponse>;
