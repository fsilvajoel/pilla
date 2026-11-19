export type PersonWriteErrorCode = "DUPLICATE_CPF" | "NOT_FOUND";

/** Traduz o erro de escrita do banco no code da borda; null para qualquer outro erro. */
export function personWriteErrorCode(error: unknown): PersonWriteErrorCode | null {
  if (typeof error !== "object" || error === null || !("cause" in error)) return null;
  const cause = error.cause;
  if (typeof cause !== "object" || cause === null) return null;
  if (!("code" in cause) || !("constraint" in cause)) return null;
  if (cause.code === "23505" && cause.constraint === "persons_cpf_key") return "DUPLICATE_CPF";
  if (cause.code === "23503" && cause.constraint === "persons_referred_by_id_fkey") return "NOT_FOUND";
  return null;
}
