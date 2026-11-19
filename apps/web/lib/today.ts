import { isoDate, type IsoDate } from "@pilla/finance";

/** Deslocamento fixo de Brasília (UTC−3), sem horário de verão (decisão do Joel de 17/11). */
const BRT_OFFSET_MS = 10_800_000; // 3 horas em milissegundos

/**
 * Dia de hoje em Brasília, "AAAA-MM-DD" (decisões do Joel de 17/11: a simulação desembolsa hoje em BRT).
 * O instante vem por parâmetro (RFC-002: nada de relógio dentro da lógica). Desloca `now` em UTC−3 fixo e
 * pega o dia UTC do resultado; marca o texto com `isoDate` de `@pilla/finance`.
 * Ex.: 2026-11-18T02:30:00Z é 23h30 de 2026-11-17 em Brasília. Data inválida: `toISOString` lança RangeError.
 */
export function todayInBrt(now: Date): IsoDate {
  const shifted = new Date(now.getTime() - BRT_OFFSET_MS);
  return isoDate(shifted.toISOString().slice(0, 10));
}
