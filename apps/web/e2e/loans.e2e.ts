import { expect, test, type Page } from "@playwright/test";

// E10-T18: ciclo de vida do contrato contra a API e o Postgres reais (pessoa e conta base do seed).
test.setTimeout(90_000); // o `next dev` compila cada rota na primeira visita
// Cada teste cria os próprios contratos; o banco só cresce, então nada aqui depende de contagem global.

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

/** Cria um DRAFT de 6 parcelas mensais para uma pessoa do seed e fica no detalhe. */
async function createDraft(page: Page, personName: string): Promise<string> {
  await page.goto("/emprestimos/novo");
  await expect(page.getByRole("heading", { level: 1, name: "Novo contrato" })).toBeVisible();
  await page.getByLabel("Cliente").selectOption({ label: personName });
  await page.getByLabel("Valor emprestado").fill("5.000,00");
  await page.getByLabel("Taxa ao mês (%)").fill("6,33");
  await page.getByLabel("Nº de parcelas").fill("6");
  await page.getByLabel("Periodicidade").selectOption("MONTHLY");
  await page.getByLabel("1º vencimento").fill("2099-12-14");
  await page.getByRole("button", { name: "Criar contrato" }).click();
  await expect(page).toHaveURL(/\/emprestimos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: /^Contrato \d{4}-\d+/ })).toBeVisible();
  await expect(page.getByText(/· Rascunho/)).toBeVisible();
  return new URL(page.url()).pathname;
}

async function activate(page: Page): Promise<void> {
  await page.getByLabel("Conta de desembolso").selectOption({ label: "Conta principal" });
  await page.getByRole("button", { name: "Ativar", exact: true }).click();
  await expect(page.getByText(/· Ativo/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Renovar" })).toBeVisible();
}

test("creates a DRAFT, activates it with the base account and shows 6 installments", async ({ page }) => {
  const errors = watchConsole(page);
  await createDraft(page, "Ana Souza");
  await activate(page);
  // cabeçalho + 6 parcelas
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(7);
  expect(errors).toEqual([]);
});

test("creates a DRAFT and cancels it", async ({ page }) => {
  const errors = watchConsole(page);
  await createDraft(page, "Bruno Lima");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar contrato" }).click();
  await expect(page.getByText(/· Cancelado/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Ativar", exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("writes off an ACTIVE loan with a reason and shows it as written off", async ({ page }) => {
  const errors = watchConsole(page);
  const detail = await createDraft(page, "Carla Dias");
  await activate(page);
  await page.getByRole("link", { name: "Baixar como perda" }).click();
  await expect(page).toHaveURL(`${detail}/baixa`);

  // motivo é obrigatório
  await page.getByRole("button", { name: "Baixar como perda" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page).toHaveURL(`${detail}/baixa`);

  await page.getByLabel("Motivo").fill("Cliente sem contato há meses");
  await page.getByRole("button", { name: "Baixar como perda" }).click();
  await expect(page).toHaveURL(detail);
  await expect(page.getByText(/· Baixado como perda/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Renovar" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("quotes the payoff and renews an ACTIVE loan into a new DRAFT", async ({ page }) => {
  const errors = watchConsole(page);
  const detail = await createDraft(page, "Diego Rocha");
  await activate(page);

  await page.getByRole("link", { name: "Cotação de quitação" }).click();
  await expect(page).toHaveURL(`${detail}/quitacao`);
  await expect(page.getByText("Total para quitar")).toBeVisible();
  await expect(page.getByText("Principal em aberto")).toBeVisible();
  await expect(page.getByText("Juros em aberto")).toBeVisible();
  await expect(page.getByText("Encargos por atraso")).toBeVisible();

  await page.goto(detail);
  await page.getByRole("link", { name: "Renovar" }).click();
  await expect(page).toHaveURL(`${detail}/renovar`);
  await expect(page.getByText("Novo principal")).toBeVisible();
  await expect(page.getByText("R$ 5.000,00")).toBeVisible();
  await page.getByLabel("1º vencimento").fill("2099-12-14");
  await page.getByRole("button", { name: "Renovar", exact: true }).click();
  await expect(page).toHaveURL(/\/emprestimos\/[0-9a-f-]{36}$/);
  expect(new URL(page.url()).pathname).not.toBe(detail);
  await expect(page.getByText(/· Rascunho/)).toBeVisible();
  expect(errors).toEqual([]);
});
