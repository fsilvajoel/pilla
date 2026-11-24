import { cents, formatReais } from "@pilla/finance";

/** Centavos com sinal em reais pt-BR: "R$ 10,00" ou "-R$ 10,00". */
export function formatMoney(valueCents: number): string {
  const text = `R$ ${formatReais(cents(BigInt(Math.abs(valueCents))))}`;
  return valueCents < 0 ? `-${text}` : text;
}

/** Pontos-base em percentual pt-BR ("7.500" vira "75,00%"); nulo vira "—". */
export function formatBps(bps: number | null): string {
  if (bps === null) return "—";
  return `${(bps / 100).toFixed(2).replace(".", ",")}%`;
}
