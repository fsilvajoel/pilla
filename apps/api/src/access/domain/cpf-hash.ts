import { createHmac } from "node:crypto";

/** HMAC-SHA256 (hex, 64) do CPF digitado, com a chave `PILLA_ACCESS_HASH_KEY` (E15 D5); o CPF nunca é gravado. */
export function hashCpf(cpf: string, key: string): string {
  return createHmac("sha256", key).update(cpf).digest("hex");
}
