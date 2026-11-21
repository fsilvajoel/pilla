import { defineConfig, devices } from "@playwright/test";

// Testes e2e do web (gate e2e do harness, harness.project.yaml gates.e2e). Só Chromium. As telas de pessoas e de
// contratos falam com a API real (Postgres do .env já migrado e semeado: db:migrate, db:seed); as demais usam mock.
const port = 3100;
const baseURL = `http://127.0.0.1:${String(port)}`;
// Uma API só para todo o e2e, em porta própria (3101), para não depender da PILLA_API_PORT do .env.
const apiPort = 3101;
const apiURL = `http://127.0.0.1:${String(apiPort)}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/*.e2e.ts", "**/*.spec.ts"],
  fullyParallel: false,
  workers: 1, // um `next dev` e uma API compartilhados: em paralelo a primeira compilação das rotas trava
  forbidOnly: true,
  retries: 0,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Porta própria (3100) para não colidir com o `pnpm dev` (3000); reaproveita um servidor já de pé fora do CI.
  webServer: [
    {
      // API NestJS; o script `start` do @pilla/api lê DATABASE_URL do .env da raiz.
      command: "pnpm --filter @pilla/api start",
      url: `${apiURL}/api/v1/health`,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
      env: { PILLA_API_PORT: String(apiPort) },
    },
    {
      command: `pnpm exec next dev --hostname 127.0.0.1 --port ${String(port)}`,
      url: baseURL,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
      env: { PILLA_API_URL: `${apiURL}/api/v1` },
    },
  ],
});
