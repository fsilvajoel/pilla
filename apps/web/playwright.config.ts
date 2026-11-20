import { defineConfig, devices } from "@playwright/test";

// Testes e2e do web (gate e2e do harness, harness.project.yaml gates.e2e). Só Chromium. As telas de contrato falam com a
// API real (sobe aqui) e o Postgres do .env; as demais telas ainda usam dados de mentira (lib/mock-data.ts).
const port = 3100;
const baseURL = `http://127.0.0.1:${String(port)}`;
// API real do e2e de contratos (E10-T18): porta própria, banco do .env já migrado e semeado (db:migrate, db:seed).
const apiPort = 3101;
const apiBaseURL = `http://127.0.0.1:${String(apiPort)}/api/v1`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
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
      command: "pnpm --filter @pilla/api start",
      url: `${apiBaseURL}/accounts`,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
      env: { PILLA_API_PORT: String(apiPort) },
    },
    {
      command: `pnpm exec next dev --hostname 127.0.0.1 --port ${String(port)}`,
      url: baseURL,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
      env: { PILLA_API_URL: apiBaseURL },
    },
  ],
});
