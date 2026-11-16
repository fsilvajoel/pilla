import { defineConfig } from "vitest/config";

// Contratos são o ponto de encaixe entre módulos: 100% de linhas e ramos, como o motor financeiro.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts",
        "src/fake-cpf.ts", // stub E4-T02: sai no commit Card-Done do cartão (e4-guardrails H)
      ],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
