import { z } from "zod";

/** PUT /portal-access/{personId} (RFC-004). */
export const portalAccessRequest = z.strictObject({
  enabled: z.boolean(),
});

export type PortalAccessRequest = z.infer<typeof portalAccessRequest>;
