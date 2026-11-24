// Formatação do portal (E15 D12): reais com vírgula e datas dd/mm/aaaa. Funções puras.

const reaisFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Centavos inteiros em reais, ex.: 114983 vira "R$ 1.149,83". */
export function formatReais(cents: number): string {
  // O espaço sem quebra do Intl vira espaço comum para o texto ficar igual ao da tabela de textos.
  return reaisFormat.format(cents / 100).replace(/ /g, " ");
}

/** "AAAA-MM-DD" em "dd/mm/aaaa"; texto fora do formato volta sem mudança. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3] ?? ""}/${match[2] ?? ""}/${match[1] ?? ""}`;
}

/** Tira pontos, traço e espaços do CPF colado; fica só com os dígitos. */
export function stripCpfPunctuation(raw: string): string {
  return raw.replace(/\D/g, "");
}
