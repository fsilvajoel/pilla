import { configDefaults, defineConfig } from "vitest/config";

// Telas e componentes do web: mínimo de 85% (módulos, docs/travas.md §4.1).
export default defineConfig({
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, ".next/**", "**/.stryker-tmp/**"],
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "app/layout.tsx", // casca <html>/<body> do Next; não renderiza dentro do jsdom
        "components/ui/**", // código gerado pelo shadcn/ui; coberto pelos testes das telas que o usam
        "lib/utils.ts", // cn() do shadcn/ui: só repassa para clsx + tailwind-merge
        "app/\\(admin\\)/**/page.tsx", // parênteses escapados: no glob, "(admin)" sem escape é grupo e não casa o nome da pasta; casca de rota do ADMIN: só monta o componente com os dados de mentira
        "lib/mock-data.ts", // dados de mentira das telas do ADMIN (decisões do Joel de 17/11), sem lógica
        "lib/new-loan.ts", // stub E7-T05: sai quando a implementação real entrar
        "components/new-loan-form.tsx", // stub E7-T07: sai quando a implementação real entrar
      ],
      thresholds: { lines: 85, branches: 85, functions: 85, statements: 85 },
    },
  },
});
