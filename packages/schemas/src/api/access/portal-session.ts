import { z } from "zod";
import { cpfSchema } from "../../common";

/** POST /portal/session (RFC-004). */
export const portalSessionRequest = z.strictObject({
  cpf: cpfSchema,
});

export type PortalSessionRequest = z.infer<typeof portalSessionRequest>;
