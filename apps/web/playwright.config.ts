import { defineConfig, devices } from "@playwright/test";

// Testes e2e do web (gate e2e do harness, harness.project.yaml gates.e2e). Só Chromium: o app é interno e
// as telas usam dados de mentira (lib/mock-data.ts), então não há API nem banco para subir.
const port = 3100;
const baseURL = `http://127.0.0.1:${String(port)}`;

// Fluxo de pessoas (people.spec.ts): API real (Nest + Postgres do docker compose, já migrado e semeado) e um segundo
// `next dev` apontado para ela. Pré-requisito: `docker compose up -d`, `pnpm --filter @pilla/api db:migrate` e `db:seed`.
const apiPort = 3930;
const peoplePort = 3110;
const peopleURL = `http://127.0.0.1:${String(peoplePort)}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Um worker: três dev servers + Chromium em paralelo estouram a memória da VM de desenvolvimento.
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", testMatch: "**/*.e2e.ts", use: { ...devices["Desktop Chrome"] } },
    {
      name: "people",
      testMatch: "**/people.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: peopleURL,
        // /dev/shm pequeno em VM faz o Chromium cair ("Target crashed").
        launchOptions: { args: ["--disable-dev-shm-usage"] },
      },
    },
  ],
  // Porta própria (3100) para não colidir com o `pnpm dev` (3000); reaproveita um servidor já de pé fora do CI.
  webServer: [
    {
      command: `pnpm exec next dev --hostname 127.0.0.1 --port ${String(port)}`,
      env: { NEXT_DIST_DIR: ".next-e2e" },
      url: baseURL,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @pilla/api start",
      cwd: "../..",
      env: { PILLA_API_PORT: String(apiPort) },
      url: `http://127.0.0.1:${String(apiPort)}/api/v1/health`,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
    },
    {
      command: `pnpm exec next dev --hostname 127.0.0.1 --port ${String(peoplePort)}`,
      env: { NEXT_DIST_DIR: ".next-people", PILLA_API_URL: `http://127.0.0.1:${String(apiPort)}/api/v1` },
      url: peopleURL,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 120_000,
    },
  ],
});
