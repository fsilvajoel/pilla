import { expect, test, type Page } from "@playwright/test";

// E11-T10: ciclo de pagamentos (registrar, conferir, confirmar, estornar e quitar) contra a API e o Postgres reais.
test.setTimeout(120_000); // o `next dev` compila cada rota na primeira visita
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
  await expect(page.getByText(/· Rascunho/)).toBeVisible();
  return new URL(page.url()).pathname;
}

async function activate(page: Page): Promise<void> {
  await page.getByLabel("Conta de desembolso").selectOption({ label: "Conta principal" });
  await page.getByRole("button", { name: "Ativar", exact: true }).click();
  await expect(page.getByText(/· Ativo/)).toBeVisible();
}

/** Texto (sem o "R$ ") do campo de um resumo do detalhe, ex.: "Saldo devedor". */
async function summaryValue(page: Page, label: string): Promise<string> {
  const text = await page.getByText(label, { exact: true }).locator("xpath=following-sibling::dd").first().innerText();
  return text.replace("R$", "").trim();
}

/** Valor da 1ª parcela, lido da tabela do detalhe (coluna "Parcela"). */
async function firstInstallmentAmount(page: Page): Promise<string> {
  const cells = page.getByRole("table").getByRole("row").nth(1).getByRole("cell");
  return (await cells.nth(2).innerText()).trim();
}

/** Abre o formulário de pagamento do contrato, preenche o valor e envia. */
async function registerPayment(page: Page, detail: string, amount: string): Promise<void> {
  await page.goto(`${detail}/pagamento`);
  await expect(page.getByRole("heading", { level: 1, name: "Registrar pagamento" })).toBeVisible();
  await page.getByLabel("Valor").fill(amount);
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
}

async function openQueue(page: Page, detail: string, status: string): Promise<void> {
  const loanId = detail.split("/").pop() ?? "";
  await page.goto(`/pagamentos?loanId=${loanId}&status=${status}`);
  await expect(page.getByRole("heading", { level: 1, name: "Pagamentos" })).toBeVisible();
}

async function confirmFirst(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("Pagamento confirmado.")).toBeVisible();
}

async function reverseFirst(page: Page, reason: string): Promise<void> {
  await page.getByRole("button", { name: "Estornar", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Motivo").fill(reason);
  await page.getByRole("dialog").getByRole("button", { name: "Estornar", exact: true }).click();
  await expect(page.getByText("Pagamento estornado.")).toBeVisible();
}

test("registers a payment, confirms it, then reverses it with a reason", async ({ page }) => {
  const errors = watchConsole(page);
  const detail = await createDraft(page, "Ana Souza");
  await activate(page);
  const installment = await firstInstallmentAmount(page);
  const balanceBefore = await summaryValue(page, "Saldo devedor");

  await page.goto(`${detail}/pagamento`);
  await page.getByLabel("Valor").fill(installment);
  await expect(page.getByRole("region", { name: "Prévia da alocação" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Prévia da alocação" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado para conferência.")).toBeVisible();

  await openQueue(page, detail, "PENDING_REVIEW");
  await expect(page.getByRole("table").getByText("Aguardando conferência")).toBeVisible();
  await confirmFirst(page);

  await page.goto(detail);
  await expect(page.getByRole("table").getByRole("row").nth(1).getByText("Paga", { exact: true })).toBeVisible();
  expect(await summaryValue(page, "Saldo devedor")).not.toBe(balanceBefore);

  await openQueue(page, detail, "CONFIRMED");
  await reverseFirst(page, "Pagamento lançado no contrato errado");

  await page.goto(detail);
  await expect(page.getByRole("table").getByRole("row").nth(1).getByText("Paga", { exact: true })).toHaveCount(0);
  expect(await summaryValue(page, "Saldo devedor")).toBe(balanceBefore);
  expect(errors).toEqual([]);
});

test("pays the whole payoff quote to settle the loan and reopens it on reversal", async ({ page }) => {
  const errors = watchConsole(page);
  const detail = await createDraft(page, "Bruno Lima");
  await activate(page);

  await page.goto(`${detail}/quitacao`);
  const quote = (await page.getByText("Total para quitar").locator("xpath=following-sibling::dd").innerText())
    .replace("R$", "")
    .trim();

  await registerPayment(page, detail, quote);
  await expect(page.getByText("Pagamento registrado para conferência.")).toBeVisible();
  await openQueue(page, detail, "PENDING_REVIEW");
  await confirmFirst(page);

  await page.goto(detail);
  await expect(page.getByText(/· Quitado/)).toBeVisible();

  await openQueue(page, detail, "CONFIRMED");
  await reverseFirst(page, "Quitação lançada por engano");

  await page.goto(detail);
  await expect(page.getByText(/· Ativo/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("refuses an amount above the balance and registers nothing", async ({ page }) => {
  const errors = watchConsole(page);
  const detail = await createDraft(page, "Carla Dias");
  await activate(page);

  await registerPayment(page, detail, "999.999,00");
  await expect(page.getByText("O valor é maior que o saldo devedor do contrato.").first()).toBeVisible();
  await expect(page.getByText("Pagamento registrado para conferência.")).toHaveCount(0);

  await openQueue(page, detail, "PENDING_REVIEW");
  await expect(page.getByText("Nenhum pagamento.")).toBeVisible();
  expect(errors.filter((text) => !text.includes("422"))).toEqual([]);
});

test("registers a payment on a DRAFT loan, refuses to confirm it and confirms after activation", async ({ page }) => {
  const errors = watchConsole(page);
  const detail = await createDraft(page, "Diego Rocha");

  // o rascunho ainda não tem cronograma: o valor é livre e a prévia só avisa que a distribuição vem na confirmação
  await registerPayment(page, detail, "1.000,00");
  await expect(page.getByText("Pagamento registrado para conferência.")).toBeVisible();

  await openQueue(page, detail, "PENDING_REVIEW");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "O contrato não está ativo." })).toBeVisible();

  await page.goto(detail);
  await activate(page);
  await openQueue(page, detail, "PENDING_REVIEW");
  await confirmFirst(page);

  await page.goto(detail);
  await expect(page.getByRole("table").getByRole("row").nth(1).getByText("Parcial", { exact: true })).toBeVisible();
  expect(errors.filter((text) => !text.includes("409"))).toEqual([]);
});
