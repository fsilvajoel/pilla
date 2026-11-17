import { z } from "zod";

// Primitivas de fio (JSON) da RFC-004 §2. Dinheiro e taxa chegam como número inteiro;
// a conversão para Cents/Bps (bigint) acontece na borda do domínio, não aqui.

/** UUID v7 (RFC-004 §2: ids ordenáveis por tempo). */
export const idSchema = z.uuidv7();
/** Centavos, inteiro >= 0 (sufixo `Cents`). */
export const centsSchema = z.int().nonnegative();
/** Centavos, inteiro > 0 (valores que não podem ser zero, como um pagamento). */
export const positiveCentsSchema = z.int().positive();
/** Centavos com sinal próprio, nunca zero (ajuste de tesouraria, RFC-005). */
export const signedCentsSchema = z.int().refine((cents) => cents !== 0, "valor não pode ser zero");
/** Pontos-base, inteiro >= 0 (sufixo `Bps`; 6,33% = 633). */
export const bpsSchema = z.int().nonnegative();
/** Data de negócio "YYYY-MM-DD" válida no calendário. */
export const isoDateSchema = z.iso.date();
/** Instante ISO 8601 com fuso ("2026-11-14T15:30:00-03:00"). */
export const instantSchema = z.iso.datetime({ offset: true });
/** Texto livre obrigatório (motivos de estorno, reabertura, baixa). */
export const reasonSchema = z.string().trim().min(1).max(500);

/** Telefone E.164 (RFC-005 `persons.phone`, decisões do Joel de 17/11): "+5511987654321". */
export const phoneSchema = z.string().regex(/^[+][1-9][0-9]{7,14}$/);
/** Número do contrato `AAAA-NNNN` (RFC-005 `loans.loan_number`): "2026-0012". */
export const loanNumberSchema = z.string().regex(/^\d{4}-\d{4}$/);

/** CPF só com dígitos (RFC-005 `persons.cpf`), com os dois dígitos verificadores válidos (RN-P01). */
export const cpfSchema = z
  .string()
  .regex(/^\d{11}$/)
  .refine((cpf) => !/^(\d)\1{10}$/.test(cpf) && cpfCheckDigit(cpf, 9) && cpfCheckDigit(cpf, 10), {
    message: "invalid CPF check digits",
  });

/** Dígito `n` (9 ou 10) do CPF: soma ponderada dos anteriores, ×10 mod 11, e 10 vira 0. */
function cpfCheckDigit(cpf: string, n: number): boolean {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (cpf.charCodeAt(i) - 48) * (n + 1 - i);
  return ((sum * 10) % 11) % 10 === cpf.charCodeAt(n) - 48;
}
