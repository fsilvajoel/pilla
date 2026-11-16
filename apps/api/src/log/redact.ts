/** Texto que substitui o valor de um campo sensível no log. */
export const REDACTED = "[REDACTED]";

/**
 * Cópia de `value` pronta para o log (travas.md §4.7): em objetos simples e arrays, em qualquer profundidade, o
 * valor de toda chave sensível vira `REDACTED`. Chave sensível: nome que, em minúsculas, é ou termina com `cpf`,
 * `phone`, `email`, `password` ou `token` (ex.: `accessToken`, `ownerCpf`). Não altera `value`; o que não é
 * objeto simples nem array (Date, Error, texto, número, null) volta como veio.
 */
export function redact(value: unknown): unknown {
  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && (v.constructor === Object || Object.getPrototypeOf(v) === null);

  const isSensitiveKey = (key: string): boolean => {
    const lower = key.toLowerCase();
    return (
      lower.endsWith("cpf") ||
      lower.endsWith("phone") ||
      lower.endsWith("email") ||
      lower.endsWith("password") ||
      lower.endsWith("token")
    );
  };

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const val = value[key];
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = redact(val);
    }
  }

  return result;
}
