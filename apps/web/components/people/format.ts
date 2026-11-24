/** CPF no formato 000.000.000-00; devolve o valor original se não tiver 11 dígitos; nulo vira "—" (ficha com CPF vazio). */
export function formatCpf(cpf: string | null): string {
  if (cpf === null) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Telefone no formato (00) 00000-0000 ou (00) 0000-0000. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

/** Instante ISO (ou data) em dd/mm/aaaa, pela data civil de Brasília (UTC−3 fixo, sem horário de verão). */
export function formatPortalAccessDate(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return iso;
  const day = new Date(instant.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [year = "", month = "", date = ""] = day.split("-");
  return `${date}/${month}/${year}`;
}
