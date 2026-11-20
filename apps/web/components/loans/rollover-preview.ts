import type { PayoffQuoteResponse } from "@pilla/schemas";

export type RolloverKind = "RENEWAL" | "RENEGOTIATION";

export type RolloverPreview = {
  /** principal do novo contrato */
  readonly newPrincipalCents: number;
  /** parte do saldo que entra no principal sem ser principal (juros e encargos), só na renegociação */
  readonly capitalizedCents: number;
};

/**
 * Valores do novo DRAFT, calculados da cotação de hoje como a API faz (D8): renovar leva o principal em aberto;
 * renegociar leva o saldo devedor inteiro e capitaliza o que excede o principal (RN-C17).
 */
export function rolloverPreview(kind: RolloverKind, quote: PayoffQuoteResponse): RolloverPreview {
  if (kind === "RENEWAL") return { newPrincipalCents: quote.principalCents, capitalizedCents: 0 };
  return { newPrincipalCents: quote.amountCents, capitalizedCents: quote.amountCents - quote.principalCents };
}
