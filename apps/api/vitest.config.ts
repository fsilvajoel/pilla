import { defineConfig } from "vitest/config";

// Migração e repositórios: 100% como em packages/schemas. O schema.ts é declarativo (os callbacks de
// índice só rodam no drizzle-kit) e é conferido pelos testes de banco, não pela cobertura.
export default defineConfig({
  test: {
    // Cada arquivo sobe um PGlite (~centenas de MB de WASM); em paralelo a VM de 5 GB fica sem memória.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/infra/schema.ts",
        // stub E9-F02 (E9-T03): saem quando a implementação real entrar
        "src/core/http/env.ts",
        "src/core/http/problem-exception.ts",
        "src/core/http/zod-validation.pipe.ts",
        "src/core/http/problem-details.filter.ts",
        "src/core/http/health.controller.ts",
        "src/core/http/openapi.ts",
        "src/core/http/configure-app.ts",
        "src/db/database.ts",
        "src/app.module.ts",
        "src/main.ts",
      ],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
