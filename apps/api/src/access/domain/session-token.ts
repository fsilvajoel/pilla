import { createHash, randomBytes } from "node:crypto";

/** Valor do cookie de sessão: 32 bytes aleatórios em base64url (E14 D3). */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Id da linha em `sessions`: SHA-256 hex do token; o valor do cookie nunca é gravado (E14 D3). */
export function sessionIdOf(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
