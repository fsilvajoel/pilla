// @stub E7-T02
import type { IsoDate } from "@pilla/finance";

/**
 * Dia de hoje no fuso de Brasília, "AAAA-MM-DD" (decisões do Joel de 17/11: a simulação desembolsa hoje em BRT).
 * O instante vem por parâmetro (RFC-002: nada de relógio dentro da lógica). Formata `now` com
 * `Intl.DateTimeFormat` no locale "en-CA" (que já escreve AAAA-MM-DD) e `timeZone: "America/Sao_Paulo"`, e
 * marca o texto com `isoDate` de `@pilla/finance`. Ex.: 2026-11-18T02:30:00Z é 23h30 de 2026-11-17 em Brasília.
 */
export function todayInBrt(_now: Date): IsoDate {
  throw new Error("not implemented");
}
