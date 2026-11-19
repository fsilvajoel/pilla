// @stub E5-T14
export type PersonWriteErrorCode = "DUPLICATE_CPF" | "NOT_FOUND";

/** Traduz o erro de escrita do banco no code da borda; null para qualquer outro erro. */
export function personWriteErrorCode(_error: unknown): PersonWriteErrorCode | null {
  throw new Error("esboço: não implementado");
}
