import { defineConfig, devices } from "@playwright/test";

// Testes e2e do web (gate e2e do harness, harness.project.yaml gates.e2e). Só Chromium: o app é interno e
// as telas usam dados de mentira (lib/mock-data.ts), então não há API nem banco para subir.
const port = 3100;
const baseURL = `http://127.0.0.1:${String(port)}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Porta própria (3100) para não colidir com o `pnpm dev` (3000); reaproveita um servidor já de pé fora do CI.
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${String(port)}`,
    url: baseURL,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});
