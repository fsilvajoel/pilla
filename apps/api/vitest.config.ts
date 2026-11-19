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
        "src/people/infra/person-repository.ts", // stub E5-T06: sai quando a implementação real entrar
      ],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
