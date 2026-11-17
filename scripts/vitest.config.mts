import { defineConfig } from "vitest/config";

// Testes dos scripts de harness da raiz (gates e hook do Claude Code).
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ["*.test.mts"],
  },
});
