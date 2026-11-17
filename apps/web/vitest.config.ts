import { defineConfig } from "vitest/config";

// Telas e componentes do web: mínimo de 85% (módulos, docs/agents/travas.md §4.1).
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
      ],
      thresholds: { lines: 85, branches: 85, functions: 85, statements: 85 },
    },
  },
});
