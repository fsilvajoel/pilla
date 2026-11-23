import type { AdminMeResponse } from "@pilla/schemas";
import type { Database } from "../../db/database";

/** Sessão recém-criada: o token vai só no cookie; a linha guarda o hash (E14 D3). */
export type NewAdminSession = { readonly token: string; readonly expiresAt: Date };

/** Esboço do E14-T03; a implementação é do E14-T04. */
export function createAdminSession(_db: Database, _adminUserId: string, _ip: string): Promise<NewAdminSession> {
  return Promise.reject(new Error("esboço: não implementado"));
}

/** Esboço do E14-T03: admin da sessão viva, ou `null` (ausente, vencida ou admin inativo). */
export function resolveAdminSession(_db: Database, _token: string): Promise<AdminMeResponse | null> {
  return Promise.reject(new Error("esboço: não implementado"));
}

/** Esboço do E14-T03: apaga a sessão do token, se existir. */
export function endSession(_db: Database, _token: string): Promise<void> {
  return Promise.reject(new Error("esboço: não implementado"));
}
