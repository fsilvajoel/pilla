import { expect, test, type Page } from "@playwright/test";

// E6-F02 A4: a rota /emprestimos/simular simula de ponta a ponta (docs/plano/E6-F02/plano.md, C10 e C11).
// Exemplo da RFC-004 §5; o desembolso é hoje em BRT (todayInBrt, E7-F01).
async function simulate(page: Page, firstDueDate: string): Promise<void> {
  await page.goto("/emprestimos/simular");
  await expect(page.getByRole("heading", { level: 1, name: "Simular empréstimo" })).toBeVisible();
  await page.getByLabel("Valor emprestado").fill("5.000,00");
  await page.getByLabel("Taxa ao mês (%)").fill("6,33");
  await page.getByLabel("Nº de parcelas").fill("6");
  await page.getByLabel("Periodicidade").selectOption("MONTHLY");
  await page.getByLabel("1º vencimento").fill(firstDueDate);
  await page.getByRole("button", { name: "Simular" }).click();
}

test("C10 (A4): /emprestimos/simular shows the RFC-004 §5 summary", async ({ page }) => {
  await simulate(page, "2099-12-14");

  await expect(page.getByText("Total a receber")).toBeVisible();
  await expect(page.getByText("R$ 6.900,00", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 1.900,00", { exact: true })).toBeVisible();
  await expect(page.getByText("6 × R$ 1.150,00", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("C11 (A4): /emprestimos/simular shows the alert for a past first due date", async ({ page }) => {
  await simulate(page, "2000-01-14");

  await expect(page.getByRole("alert")).toHaveText("Confira os campos da simulação.");
  await expect(page.getByText("Total a receber")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
});
