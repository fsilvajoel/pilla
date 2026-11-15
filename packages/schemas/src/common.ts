import { z } from "zod";

// Primitivas de fio (JSON) da RFC-004 §2. Dinheiro e taxa chegam como número inteiro;
// a conversão para Cents/Bps (bigint) acontece na borda do domínio, não aqui.

/** UUID v7 (RFC-004 §2: ids ordenáveis por tempo). */
export const idSchema = z.uuidv7();
/** Centavos, inteiro >= 0 (sufixo `Cents`). */
export const centsSchema = z.int().nonnegative();
/** Centavos, inteiro > 0 (valores que não podem ser zero, como um pagamento). */
export const positiveCentsSchema = z.int().positive();
/** Pontos-base, inteiro >= 0 (sufixo `Bps`; 6,33% = 633). */
export const bpsSchema = z.int().nonnegative();
/** Data de negócio "YYYY-MM-DD" válida no calendário. */
export const isoDateSchema = z.iso.date();
/** Instante ISO 8601 com fuso ("2026-11-14T15:30:00-03:00"). */
export const instantSchema = z.iso.datetime({ offset: true });
/** Texto livre obrigatório (motivos de estorno, reabertura, baixa). */
export const reasonSchema = z.string().trim().min(1).max(500);
