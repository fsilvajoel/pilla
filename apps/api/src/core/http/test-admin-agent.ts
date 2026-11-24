// Apoio dos testes HTTP que sobem o AppModule real: semeia um admin, faz login e devolve um cliente com o cookie.
import type { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { hashPassword } from "../../access/domain/password";

export type AdminAgent = ReturnType<typeof request.agent>;

const ADMIN_ID = "01970000-0000-7000-8000-00000000ad02";
const USERNAME = "test-admin";
// Senha fictícia, só dos testes.
// Cada login sai de um IP de documentação diferente, para não esbarrar no limite de tentativas por IP.
let nextIp = 0;
const PASSWORD = "senha ficticia de teste http";

/** Semeia um admin ativo no banco do teste, entra pela rota real de login e devolve o cliente com o cookie de sessão. */
export async function loginAsAdmin(baseUrl: string, client: PGlite): Promise<AdminAgent> {
  await client.query(
    "insert into access.admin_users (id, username, password_hash, active) values ($1, $2, $3, true) on conflict (id) do nothing",
    [ADMIN_ID, USERNAME, await hashPassword(PASSWORD)],
  );
  const login = await request(baseUrl)
    .post("/api/v1/auth/admin/login")
    .set("X-Forwarded-For", `198.51.100.${String((nextIp++ % 250) + 1)}`)
    .send({ username: USERNAME, password: PASSWORD });
  if (login.status !== 200) throw new Error(`admin login failed in test setup: ${String(login.status)}`);
  const raw: unknown = login.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
  const cookie = (cookies.find((c) => c.startsWith("pilla_session=")) ?? "").split(";")[0] ?? "";
  if (cookie === "") throw new Error("admin login gave no session cookie");
  return request.agent(baseUrl).set("Cookie", cookie);
}
