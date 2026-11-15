import { defineConfig } from "vitest/config";

// travas §1: 100% de linhas e ramos em packages/finance.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/.stryker-tmp/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
