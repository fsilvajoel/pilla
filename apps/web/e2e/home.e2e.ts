import { expect, test } from "@playwright/test";

// Fumaça: o Next sobe e a página inicial renderiza no navegador.
test("home page renders the app name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "pilla" })).toBeVisible();
});
