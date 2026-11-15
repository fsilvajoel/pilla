import { defineConfig } from "drizzle-kit";

// Uma pasta de migração por schema (RFC-005 §8); cada módulo ganha o seu arquivo igual a este.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/people/infra/schema.ts",
  out: "./migrations/people",
  schemaFilter: ["people"],
});
