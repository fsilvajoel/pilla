const TIME_ZONE = "America/Sao_Paulo";

/** Data de hoje em Brasília (E10 D11), no formato AAAA-MM-DD. */
export function todayInBrasilia(now: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE }).format(now);
}
