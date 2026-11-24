import { idSchema, portalAccessRequest, type PortalAccessRequest } from "@pilla/schemas";
import { z } from "zod";
import { apiFetch } from "./client";

// LACUNA: `portalAccessResponse` (E15-T01) ainda não está em @pilla/schemas neste branch. Espelha E15.md D2
// (`{personId, enabled, enabledAt}`) e deve ser trocado pelo do pacote quando o E15-T01 entrar.
export const portalAccessResponse = z.strictObject({
  personId: idSchema,
  enabled: z.boolean(),
  enabledAt: z.iso.datetime({ offset: true }).nullable(),
});
export type PortalAccessResponse = z.infer<typeof portalAccessResponse>;

/** GET /portal-access/{personId}: estado do acesso da pessoa ao portal (RF-60). */
export function getPortalAccess(personId: string): Promise<PortalAccessResponse> {
  return apiFetch({ path: `/portal-access/${personId}`, schema: portalAccessResponse });
}

/** PUT /portal-access/{personId}: liga ou desliga o acesso (só ADMIN, D13). */
export function setPortalAccess(personId: string, enabled: boolean): Promise<PortalAccessResponse> {
  const body: PortalAccessRequest = portalAccessRequest.parse({ enabled });
  return apiFetch({ method: "PUT", path: `/portal-access/${personId}`, body, schema: portalAccessResponse });
}
