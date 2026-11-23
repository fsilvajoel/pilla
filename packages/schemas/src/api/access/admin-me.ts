import { z } from "zod";

/** Esboço do E14-T01 (recusa tudo); o contrato de E14-F01 (id uuid, username 1..100, role ADMIN) é do E14-T02. */
export const adminMeResponse: z.ZodType<{ id: string; username: string; role: "ADMIN" }> = z.never();
