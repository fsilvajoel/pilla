import { defineConfig } from "vitest/config";

// travas §1: 100% de linhas e ramos em packages/finance.
// passWithNoTests só até o primeiro teste da E1 (cartão E1-T01 remove).
export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
