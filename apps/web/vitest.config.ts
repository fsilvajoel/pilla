import { configDefaults, defineConfig } from "vitest/config";

// Lógica do web (lib/ e utilitários): mínimo de 85% (módulos, docs/travas.md §4.1); telas ficam fora (ADR-0017).
export default defineConfig({
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, ".next/**", "**/.stryker-tmp/**"],
    coverage: {
      provider: "v8",
      // Só a lógica (lib/ e utilitários): telas e componentes ficam sem teste unitário nesta fase (ADR-0017); o fluxo
      // deles é coberto pelo e2e (apps/web/e2e).
      include: ["lib/**/*.{ts,tsx}", "components/people/format.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "lib/utils.ts", // cn() do shadcn/ui: só repassa para clsx + tailwind-merge
        "lib/mock-data.ts", // dados de mentira das telas do ADMIN (decisões do Joel de 17/11), sem lógica
      ],
      thresholds: { lines: 85, branches: 85, functions: 85, statements: 85 },
    },
  },
});
