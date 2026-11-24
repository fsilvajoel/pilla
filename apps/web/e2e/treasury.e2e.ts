import { expect, test, type Locator, type Page } from "@playwright/test";

// E12-T10: tesouraria (aporte, retirada, ajuste, desembolso, recebimento e estorno) contra a API e o Postgres reais,
// com o poller do outbox ligado. Os efeitos por evento (DISBURSEMENT, REPAYMENT, REVERSAL) chegam até ~2 s depois:
// toda espera é uma nova leitura da tela (expect.poll com reload), nunca uma pausa fixa.
// O banco é compartilhado e só cresce: o teste mede diferenças contra a leitura inicial, nunca valores absolutos.
test.setTimeout(480_000); // o `next dev` compila cada rota na primeira visita

// cada leitura percorre as páginas do extrato (20 linhas por página), que só cresce: folga larga.
const POLL: { timeout: number; intervals: number[] } = { timeout: 120_000, intervals: [500, 1_000, 1_500] };

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

/** "R$ 1.234,56" ou "-R$ 1.234,56" vira centavos com sinal. */
function parseMoney(text: string): number {
  const match = /(-?)R\$\s*([\d.]*\d),(\d{2})/.exec(text);
  if (match === null) throw new Error(`Valor monetário não encontrado em: ${text}`);
  const cents = Number((match[2] ?? "").replaceAll(".", "")) * 100 + Number(match[3]);
  return match[1] === "-" ? -cents : cents;
}

/** Centavos em reais pt-BR sem o "R$", como se digita nos campos. */
function toReais(valueCents: number): string {
  return (valueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Centavos com sinal como a tela mostra: "R$ 10,00" ou "-R$ 10,00". */
function money(valueCents: number): string {
  return `${valueCents < 0 ? "-" : ""}R$ ${toReais(Math.abs(valueCents))}`;
}

function card(page: Page, label: string): Locator {
  return page
    .getByRole("region", { name: "Painel da tesouraria" })
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(label, { exact: true }) });
}

/** Valor do indicador do painel, em centavos. */
async function cardCents(page: Page, label: string): Promise<number> {
  return parseMoney(await card(page, label).locator('[data-slot="card-title"]').innerText());
}

/** Saldo final do extrato exibido, em centavos. */
async function closingCents(page: Page): Promise<number> {
  const text = await page.getByText(/Saldo final:/).innerText();
  return parseMoney(text.slice(text.indexOf("Saldo final:")));
}

const LOAD_ERROR = "Não foi possível carregar o caixa.";

/** Falha na hora se a tela do caixa mostrou o erro de carga, em vez de esperar o timeout. */
async function assertCashLoaded(page: Page): Promise<void> {
  if ((await page.getByText(LOAD_ERROR).count()) > 0) throw new Error(`Tela /caixa mostrou: ${LOAD_ERROR}`);
}

/** Relê a tela até o indicador do painel e o saldo final do extrato baterem com o esperado. */
async function expectCash(page: Page, expectedCents: number): Promise<void> {
  await expect
    .poll(async () => {
      await page.goto("/caixa");
      await assertCashLoaded(page);
      return closingCents(page);
    }, POLL)
    .toBe(expectedCents);
  expect(await cardCents(page, "Caixa")).toBe(expectedCents);
}

function statementRows(page: Page): Locator {
  return page
    .getByRole("table")
    .getByRole("row")
    .filter({ hasNot: page.getByRole("columnheader") });
}

async function newEntry(
  page: Page,
  input: { kind: "Aporte" | "Retirada" | "Ajuste"; sign?: "Entrada" | "Saída"; amount: string; reason: string },
): Promise<void> {
  await page.getByRole("button", { name: "Novo lançamento" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Novo lançamento" })).toBeVisible();
  await dialog.getByLabel("Tipo").selectOption({ label: input.kind });
  if (input.sign !== undefined) await dialog.getByLabel("Sentido do ajuste").selectOption({ label: input.sign });
  await dialog.getByLabel("Valor (R$)").fill(input.amount);
  await dialog.getByLabel("Justificativa").fill(input.reason);
  await dialog.getByRole("button", { name: "Gravar" }).click();
  await expect(page.getByText("Lançamento gravado.")).toBeVisible();
  await expect(dialog).toBeHidden();
}

/** Linha do extrato da página atual cujo texto contém o trecho. */
function rowWith(page: Page, text: string): Locator {
  return statementRows(page).filter({ hasText: text });
}

/**
 * O extrato é do mais antigo ao mais novo e vem em páginas de 20 ("Carregar mais"): percorre as páginas e conta as
 * linhas que contêm todos os trechos. Deixa a tela na última página lida.
 */
async function countRows(page: Page, texts: readonly string[], stopAtFirst = false): Promise<number> {
  // só o dia de hoje (Brasília): o extrato do banco de dev é longo e só cresce, e percorrê-lo todo estoura a espera
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  await page.goto(`/caixa?from=${today}`);
  await assertCashLoaded(page);
  let total = 0;
  for (let guard = 0; guard < 200; guard += 1) {
    let rows = statementRows(page);
    for (const text of texts) rows = rows.filter({ hasText: text });
    total += await rows.count();
    if (stopAtFirst && total > 0) return total;
    const more = page.getByRole("link", { name: "Carregar mais" });
    if ((await more.count()) === 0) return total;
    const href = await more.getAttribute("href");
    if (href === null) return total;
    await page.goto(href);
    await assertCashLoaded(page);
  }
  throw new Error("Extrato com páginas demais para percorrer.");
}

/** Relê o extrato até haver pelo menos `atLeast` linhas novas além da contagem anterior. */
async function expectRowsGrow(page: Page, texts: readonly string[], before: number, atLeast: number): Promise<void> {
  await expect.poll(async () => (await countRows(page, texts)) - before, POLL).toBeGreaterThanOrEqual(atLeast);
}

/** Relê o extrato até achar a linha com o texto e devolve o localizador (na página onde ela está). */
async function openRow(page: Page, text: string): Promise<Locator> {
  await expect.poll(async () => countRows(page, [text], true), POLL).toBe(1);
  return rowWith(page, text);
}

test("posts deposit, adjustment and withdrawal and shows signs, balance after and the statement row", async ({
  page,
}) => {
  const errors = watchConsole(page);
  const tag = `e2e-${String(Date.now())}`;

  await page.goto("/caixa");
  await expect(page.getByRole("heading", { level: 1, name: "Caixa" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Painel da tesouraria" })).toBeVisible();
  const start = await closingCents(page);

  await newEntry(page, { kind: "Aporte", amount: "10.000,00", reason: `${tag} aporte` });
  await expectCash(page, start + 1_000_000);
  const deposit = await openRow(page, `${tag} aporte`);
  await expect(deposit).toContainText("Aporte");
  await expect(deposit).toContainText("R$ 10.000,00");
  await expect(deposit.getByRole("cell").nth(3)).not.toContainText("-R$");

  await newEntry(page, { kind: "Ajuste", sign: "Saída", amount: "250,00", reason: `${tag} ajuste` });
  await expectCash(page, start + 1_000_000 - 25_000);
  const adjustment = await openRow(page, `${tag} ajuste`);
  await expect(adjustment).toContainText("Ajuste");
  await expect(adjustment).toContainText("-R$ 250,00");

  await newEntry(page, { kind: "Retirada", amount: "100,00", reason: `${tag} retirada` });
  await expectCash(page, start + 1_000_000 - 25_000 - 10_000);
  const withdrawal = await openRow(page, `${tag} retirada`);
  await expect(withdrawal).toContainText("Retirada");
  await expect(withdrawal).toContainText("-R$ 100,00");
  // o saldo após da linha mais recente é o saldo final
  await expect(withdrawal).toContainText(money(start + 1_000_000 - 25_000 - 10_000));

  expect(errors).toEqual([]);
});

test("requires a reason on an adjustment and refuses a zero amount", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/caixa");
  await page.getByRole("button", { name: "Novo lançamento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tipo").selectOption({ label: "Ajuste" });
  await dialog.getByLabel("Valor (R$)").fill("0,00");
  await dialog.getByRole("button", { name: "Gravar" }).click();
  await expect(dialog.getByText("Informe um valor maior que zero, como 1.500,00.")).toBeVisible();
  await expect(dialog.getByText("Informe a justificativa do ajuste.")).toBeVisible();
  await dialog.getByRole("button", { name: "Voltar" }).click();
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test("warns about low cash on activation, then disbursement, repayment and reversal reach the treasury", async ({
  page,
}) => {
  const errors = watchConsole(page);

  // linha de base lida com a tela
  await page.goto("/caixa");
  const cash0 = await closingCents(page);
  const lent0 = await cardCents(page, "Emprestado");
  const interest0 = await cardCents(page, "Juros recebidos no mês");

  // principal sempre acima do caixa atual, para o aviso RN-C10 aparecer
  const principal = Math.max(500_000, Math.ceil(Math.max(cash0, 0) / 100_000) * 100_000 + 100_000);
  const disbursementText = ["Desembolso", `-R$ ${toReais(principal)}`] as const;
  const repaymentPrincipal = ["Pagamento recebido", "Principal"] as const;
  const repaymentInterest = ["Pagamento recebido", "Juros"] as const;
  const reversal = ["Estorno"] as const;
  const disbursements0 = await countRows(page, disbursementText);
  const principalRows0 = await countRows(page, repaymentPrincipal);
  const interestRows0 = await countRows(page, repaymentInterest);
  const reversals0 = await countRows(page, reversal);
  await page.goto("/emprestimos/novo");
  await expect(page.getByRole("heading", { level: 1, name: "Novo contrato" })).toBeVisible();
  await page.getByLabel("Cliente").selectOption({ label: "Ana Souza" });
  await page.getByLabel("Valor emprestado").fill(toReais(principal));
  await page.getByLabel("Taxa ao mês (%)").fill("6,33");
  await page.getByLabel("Nº de parcelas").fill("6");
  await page.getByLabel("Periodicidade").selectOption("MONTHLY");
  await page.getByLabel("1º vencimento").fill("2099-12-14");
  await page.getByRole("button", { name: "Criar contrato" }).click();
  await expect(page).toHaveURL(/\/emprestimos\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/· Rascunho/)).toBeVisible();
  const detail = new URL(page.url()).pathname;

  // aviso RN-C10: aparece ao escolher a conta e não bloqueia a ativação
  await expect(page.getByText(/O caixa registrado/)).toHaveCount(0);
  await page.getByLabel("Conta de desembolso").selectOption({ label: "Conta principal" });
  const warning = page.getByRole("status").filter({ hasText: "O caixa registrado" });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText(`é menor que o valor do contrato (R$ ${toReais(principal)})`);
  await expect(warning).toContainText("Você pode ativar mesmo assim.");
  const activateButton = page.getByRole("button", { name: "Ativar", exact: true });
  await expect(activateButton).toBeEnabled();
  await activateButton.click();
  await expect(page.getByText(/· Ativo/)).toBeVisible();

  // o desembolso chega pelo poller: saldo cai, "emprestado" sobe
  await expectCash(page, cash0 - principal);
  await expect
    .poll(async () => {
      await page.goto("/caixa");
      return cardCents(page, "Emprestado");
    }, POLL)
    .toBe(lent0 + principal);
  await expectRowsGrow(page, disbursementText, disbursements0, 1);
  await expect(card(page, "Caixa").locator('[data-slot="card-title"]')).toContainText("-R$");

  // pagamento da 1ª parcela: registrar e confirmar
  await page.goto(detail);
  const installmentText = await page.getByRole("table").getByRole("row").nth(1).getByRole("cell").nth(2).innerText();
  const installment = parseMoney(`R$ ${installmentText.replace("R$", "").trim()}`);
  await page.goto(`${detail}/pagamento`);
  await expect(page.getByRole("heading", { level: 1, name: "Registrar pagamento" })).toBeVisible();
  await page.getByLabel("Valor").fill(toReais(installment));
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado para conferência.")).toBeVisible();
  const loanId = detail.split("/").pop() ?? "";
  await page.goto(`/pagamentos?loanId=${loanId}&status=PENDING_REVIEW`);
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("Pagamento confirmado.")).toBeVisible();

  // recebimento por componente e juros do mês
  await expectCash(page, cash0 - principal + installment);
  await expectRowsGrow(page, repaymentPrincipal, principalRows0, 1);
  await expectRowsGrow(page, repaymentInterest, interestRows0, 1);
  await expect
    .poll(async () => {
      await page.goto("/caixa");
      return cardCents(page, "Juros recebidos no mês");
    }, POLL)
    .toBeGreaterThan(interest0);

  // estorno: linhas de REVERSAL e saldo de volta ao pós-desembolso
  await page.goto(`/pagamentos?loanId=${loanId}&status=CONFIRMED`);
  await page.getByRole("button", { name: "Estornar", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Motivo").fill("Estorno do teste e2e da tesouraria");
  await page.getByRole("dialog").getByRole("button", { name: "Estornar", exact: true }).click();
  await expect(page.getByText("Pagamento estornado.")).toBeVisible();

  await expectCash(page, cash0 - principal);
  await expectRowsGrow(page, reversal, reversals0, 2);
  await expect
    .poll(async () => {
      await page.goto("/caixa");
      return cardCents(page, "Juros recebidos no mês");
    }, POLL)
    .toBe(interest0);

  expect(errors).toEqual([]);
});
