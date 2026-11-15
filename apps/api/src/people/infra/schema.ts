import { pgSchema } from "drizzle-orm/pg-core";

// Schema `people` (RFC-005 §3): pessoas, endereços e chaves Pix.
export const people = pgSchema("people");
