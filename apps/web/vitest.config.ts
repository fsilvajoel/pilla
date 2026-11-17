import { defineConfig } from "vitest/config";

// Telas e componentes do web: mínimo de 85% (módulos, docs/travas.md §4.1).
export default defineConfig({
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "app/layout.tsx", // casca <html>/<body> do Next; não renderiza dentro do jsdom
        "components/ui/**", // código gerado pelo shadcn/ui; coberto pelos testes das telas que o usam
        "lib/utils.ts", // cn() do shadcn/ui: só repassa para clsx + tailwind-merge
        "lib/simulation.ts", // stub E6-T02: sai no commit Card-Done do cartão (e4-guardrails H)
        "lib/simulation-form.ts", // stub E6-T04: sai no commit Card-Done do cartão (e4-guardrails H)
        "components/loan-simulation.tsx", // stub E6-T06: sai no commit Card-Done do cartão (e4-guardrails H)
        "app/(admin)/**/page.tsx", // casca de rota do ADMIN: só monta o componente com os dados de mentira
        "lib/mock-data.ts", // dados de mentira das telas do ADMIN (decisões do Joel de 17/11), sem lógica
        "lib/today.ts", // stub E7-T02: sai no commit Card-Done do cartão (e4-guardrails H)
        "components/person-form.tsx", // stub E7-T03: sai no commit Card-Done do cartão (e4-guardrails H)
        "lib/new-loan.ts", // stub E7-T05: sai no commit Card-Done do cartão (e4-guardrails H)
        "components/new-loan-form.tsx", // stub E7-T07: sai no commit Card-Done do cartão (e4-guardrails H)
        "components/loan-list.tsx", // stub E7-T09: sai no commit Card-Done do cartão (e4-guardrails H)

        "lib/payment-draft.ts", // stub E7-T12: sai no commit Card-Done do cartão (e4-guardrails H)
        "components/payment-form.tsx", // stub E7-T14: sai no commit Card-Done do cartão (e4-guardrails H)
      ],
      thresholds: { lines: 85, branches: 85, functions: 85, statements: 85 },
    },
  },
});
