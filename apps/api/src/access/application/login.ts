import type { AdminLoginRequest, AdminMeResponse } from "@pilla/schemas";
import type { Database } from "../../db/database";
import { verifyAgainstDummy, verifyPassword } from "../domain/password";
import { adminUserRepository } from "../infra/admin-user-repository";
import { createAdminSession } from "./sessions";

export type AdminLoginResult = { readonly admin: AdminMeResponse; readonly token: string };

/**
 * Confere usuário e senha e abre a sessão; `null` para usuário inexistente, inativo ou senha errada, sem distinguir
 * (E14 D2). Usuário inexistente paga o custo de uma verificação contra o hash fixo, para o tempo não revelar quem existe.
 */
export async function loginAdmin(
  db: Database,
  request: AdminLoginRequest,
  ip: string,
): Promise<AdminLoginResult | null> {
  const users = adminUserRepository(db);
  const user = await users.findByUsername(request.username);
  const valid =
    user === null
      ? await verifyAgainstDummy(request.password)
      : await verifyPassword(user.passwordHash, request.password);
  if (user === null || !valid || !user.active) return null;
  const { token } = await createAdminSession(db, user.id, ip);
  await users.setLastLogin(user.id, new Date());
  return { admin: { id: user.id, username: user.username, role: "ADMIN" }, token };
}
