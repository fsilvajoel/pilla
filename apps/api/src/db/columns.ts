import { timestamp } from "drizzle-orm/pg-core";

// Instante sempre com fuso (RFC-005 §1); o modo "date" devolve Date em vez de string.
export const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
