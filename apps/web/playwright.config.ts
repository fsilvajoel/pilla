import { defineConfig, devices } from "@playwright/test";

// Testes e2e do web (gate e2e do harness, harness.project.yaml gates.e2e). Só Chromium. As telas de pessoas
// falam com a API real (Postgres do compose já de pé, com `db:migrate` e `db:seed` aplicados); as demais usam mock.
const port = 3100;
const baseURL = `http://127.0.0.1:${String(port)}`;
const apiPort = 3001;
const apiURL = `http://127.0.0.1:${String(apiPort)}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/*.e2e.ts", "**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Porta própria (3100) para não colidir com o `pnpm dev` (3000); reaproveita um servidor já de pé fora do CI.
  webServer: [
    {
      // API NestJS; lê DATABASE_URL e PILLA_API_PORT do .env da raiz (script `start` do @pilla/api).
      command: "pnpm --filter @pilla/api start",
      url: `${apiURL}/api/v1/health`,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
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
