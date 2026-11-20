import { z } from "zod";

/** POST /auth/admin/login (RFC-004). */
export const adminLoginRequest = z.strictObject({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export type AdminLoginRequest = z.infer<typeof adminLoginRequest>;
