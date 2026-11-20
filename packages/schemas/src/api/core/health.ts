// stub E9-F02: o schema recusa tudo até o E9-T03; o tipo já é o final (contrato primeiro, ADR-0017).
import { z } from "zod";

export type HealthResponse = { readonly status: "ok" | "degraded"; readonly database: "up" | "down" };
export const healthResponseSchema: z.ZodType<HealthResponse> = z.never();
