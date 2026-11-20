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
        "app/\\(admin\\)/layout.tsx", // dispensa-estilo E9-F06 (exemptSources): só devolve <AdminShell>; revisão visual
        "components/shared/page-header.tsx", // stub E9-F06: sai quando o E9-T13 implementar
        "components/shared/empty-state.tsx", // stub E9-F06: sai quando o E9-T13 implementar
        "components/shared/form-field.tsx", // stub E9-F06: sai quando o E9-T13 implementar
        "components/shared/data-table.tsx", // stub E9-F06: sai quando o E9-T13 implementar
        "components/shared/confirm-dialog.tsx", // stub E9-F06: sai quando o E9-T13 implementar
        "components/shared/status-badge.tsx", // stub E9-F06: sai quando o E9-T13 implementar
        "components/shared/admin-nav.tsx", // stub E9-F06: sai quando o E9-T13 implementar
        "components/shared/admin-shell.tsx", // stub E9-F06: sai quando o E9-T13 implementar
        "lib/mock-data.ts", // dados de mentira das telas do ADMIN (decisões do Joel de 17/11), sem lógica
      ],
      thresholds: { lines: 85, branches: 85, functions: 85, statements: 85 },
    },
  },
});
