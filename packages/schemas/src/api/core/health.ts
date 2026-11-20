// Resposta de GET /health (ADR-0017: contrato primeiro; o zod é a fonte da verdade).
import { z } from "zod";

export const healthResponseSchema = z.strictObject({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["up", "down"]),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
