import { adminMeResponse, type AdminLoginRequest, type AdminMeResponse } from "@pilla/schemas";
import { headers } from "next/headers";
import { apiFetch, apiUrl } from "./client";
import { parseProblem } from "./problem";
import { SESSION_COOKIE, readSessionToken } from "./session";

export interface LoginResult {
  admin: AdminMeResponse;
  token: string;
}

function tokenFromSetCookie(values: readonly string[]): string | null {
  const prefix = `${SESSION_COOKIE}=`;
  const line = values.find((value) => value.startsWith(prefix));
  if (line === undefined) return null;
  const token = line.slice(prefix.length).split(";")[0] ?? "";
  return token === "" ? null : token;
}

/** POST /auth/admin/login: repassa o IP do cliente e devolve o token do `Set-Cookie` da API. */
export async function loginAdmin(body: AdminLoginRequest): Promise<LoginResult> {
  const incoming = await headers();
  const forwarded = incoming.get("x-forwarded-for") ?? incoming.get("x-real-ip");
  const res = await fetch(apiUrl("/auth/admin/login"), {
    method: "POST",
    headers: {
      accept: "application/json, application/problem+json",
      "content-type": "application/json",
      ...(forwarded === null ? {} : { "x-forwarded-for": forwarded }),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    const value: unknown = text === "" ? null : JSON.parse(text);
    json = value;
  } catch {
    json = null;
  }
  if (!res.ok) throw parseProblem(res.status, json);
  const admin = adminMeResponse.safeParse(json);
  const token = tokenFromSetCookie(res.headers.getSetCookie());
  if (!admin.success || token === null) throw parseProblem(res.status, null);
  return { admin: admin.data, token };
}

/** GET /auth/me: o admin da sessão atual; falha com `ApiProblem` 401 sem sessão. */
export function getMe(): Promise<AdminMeResponse> {
  return apiFetch({ path: "/auth/me", schema: adminMeResponse, redirectOnUnauthorized: false });
}

/** POST /auth/admin/logout: encerra a sessão na API; ignora o resultado (o cookie do Next é apagado em seguida). */
export async function logoutAdmin(): Promise<void> {
  const token = await readSessionToken();
  if (token === undefined) return;
  await fetch(apiUrl("/auth/admin/logout"), {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    cache: "no-store",
  });
}
