import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cookieSecure } from "./cookie-secure";

/** Nome do cookie de sessão, o mesmo da API (E14 D4). */
export const SESSION_COOKIE = "pilla_session";

/** Caminho interno seguro para redirecionar; qualquer outra coisa (`//x`, `http:`, `\`) vira `/`. */
export function safeNextPath(value: string | null | undefined): string {
  if (value === undefined || value === null) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f]/.test(value)) return "/";
  return value;
}

/** Valor do cookie de sessão da requisição atual, ou `undefined` (também fora de uma requisição). */
export async function readSessionToken(): Promise<string | undefined> {
  try {
    const store = await cookies();
    return store.get(SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

/** Grava o cookie de sessão do Next (E14 D4): HttpOnly, Secure, SameSite=Lax, Path=/, sem Max-Age. */
export async function writeSessionToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure: cookieSecure(), sameSite: "lax", path: "/" });
}

export async function clearSessionToken(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Caminho da requisição atual (sem `proxy.ts`, vem do cabeçalho `next-url`); `/` quando indisponível. */
export async function currentPath(): Promise<string> {
  const list = await headers();
  return safeNextPath(list.get("next-url"));
}

/** Manda para o login guardando a rota de origem em `next`. */
export function redirectToLogin(next?: string): never {
  const path = safeNextPath(next);
  redirect(path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`);
}
