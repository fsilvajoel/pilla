import { z } from "zod";

// Resposta de GET /api/v1/health: o estado do banco vai no corpo, sempre com HTTP 200.
export const healthResponseSchema = z.strictObject({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["up", "down"]),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
