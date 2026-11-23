import type { RequestActor } from "../public/actor";

/** Ator fixo dos testes HTTP de módulo (E14 D8); a ligação com createTestApp é a E14-T06. */
export const TEST_ADMIN_ACTOR: RequestActor = {
  type: "ADMIN",
  adminUserId: "01970000-0000-7000-8000-00000000ad01",
  ip: "127.0.0.1",
};
