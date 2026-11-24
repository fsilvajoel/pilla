import { z } from "zod";
import { idSchema, instantSchema } from "../../common";

/** PUT /portal-access/{personId} (RFC-004, E15 D2). */
export const setPortalAccessRequest = z.strictObject({
  enabled: z.boolean(),
});

export type SetPortalAccessRequest = z.infer<typeof setPortalAccessRequest>;

/** Nome anterior, mantido para quem já o importa. */
export const portalAccessRequest = setPortalAccessRequest;
export type PortalAccessRequest = SetPortalAccessRequest;

/** Resposta de PUT e GET /portal-access/{personId}: `enabledAt` é nulo para quem nunca teve acesso. */
export const portalAccessResponse = z.strictObject({
  personId: idSchema,
  enabled: z.boolean(),
  enabledAt: instantSchema.nullable(),
});

export type PortalAccessResponse = z.infer<typeof portalAccessResponse>;
