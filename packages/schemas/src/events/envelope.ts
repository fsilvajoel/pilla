import { z } from "zod";
import { idSchema, instantSchema } from "../common";

/**
 * RFC-004 §7: envelope comum a todos os eventos (v1). `strictObject` recusa campo extra:
 * payload só com ids e valores, nunca dado pessoal.
 */
export function eventV1<const T extends string, P extends z.ZodType>(type: T, payload: P) {
  return z.strictObject({
    id: idSchema,
    type: z.literal(type),
    version: z.literal(1),
    occurredAt: instantSchema,
    aggregateId: idSchema,
    payload,
  });
}
