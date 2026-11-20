import { bigint, timestamp } from "drizzle-orm/pg-core";

// Instante sempre com fuso (RFC-005 §1); o modo "date" devolve Date em vez de string.
export const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// Dinheiro em centavos como bigint (ADR-0004); o modo "number" é exato até 2^53 centavos.
export const cents = (name: string) => bigint(name, { mode: "number" });
