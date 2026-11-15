/** Texto que substitui o valor de um campo sensível no log. */
export const REDACTED = "[REDACTED]";

/**
 * Cópia de `value` pronta para o log (travas.md §4.7): em objetos simples e arrays, em qualquer profundidade, o
 * valor de toda chave sensível vira `REDACTED`. Chave sensível: nome que, em minúsculas, é ou termina com `cpf`,
 * `phone`, `email`, `password` ou `token` (ex.: `accessToken`, `ownerCpf`). Não altera `value`; o que não é
 * objeto simples nem array (Date, Error, texto, número, null) volta como veio.
 */
export function redact(value: unknown): unknown {
  throw new Error(`not implemented: ${String(value)}`);
}
