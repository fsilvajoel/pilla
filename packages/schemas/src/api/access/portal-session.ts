import { z } from "zod";
import { cpfSchema } from "../../common";

/** POST /portal/session (RFC-004, E15 D2): só o CPF; 204 sem corpo e `Set-Cookie`. */
export const createPortalSessionRequest = z.strictObject({
  cpf: cpfSchema,
});

export type CreatePortalSessionRequest = z.infer<typeof createPortalSessionRequest>;

/** Nome anterior, mantido para quem já o importa. */
export const portalSessionRequest = createPortalSessionRequest;
export type PortalSessionRequest = CreatePortalSessionRequest;
