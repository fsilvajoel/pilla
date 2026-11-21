import { expect, test, type Page } from "@playwright/test";

// E13-T06: parâmetros padrão (RF-40, RF-41, CA-10) e alertas de parcelas (RF-50) contra a API e o Postgres reais.
// O bloco de pendentes de conferência fica para a E13-F04B. Datas sempre relativas a hoje em Brasília.
test.setTimeout(120_000); // o `next dev` compila cada rota na primeira visita

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

/** Hoje em Brasília (YYYY-MM-DD), somado a `days` dias de calendário. */
function brasiliaDate(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const moment = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return moment.toISOString().slice(0, 10);
}

function dateBr(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** Cria um DRAFT de 3 parcelas mensais com os padrões pré-preenchidos; devolve o caminho e o número do contrato. */
async function createDraft(
  page: Page,
  personName: string,
  firstDueDate: string,
): Promise<{ path: string; number: string }> {
  await page.goto("/emprestimos/novo");
  await expect(page.getByRole("heading", { level: 1, name: "Novo contrato" })).toBeVisible();
  await page.getByLabel("Cliente").selectOption({ label: personName });
  await page.getByLabel("Valor emprestado").fill("3.000,00");
  await page.getByLabel("Taxa ao mês (%)").fill("6,33");
  await page.getByLabel("Nº de parcelas").fill("3");
  await page.getByLabel("Periodicidade").selectOption("MONTHLY");
  await page.getByLabel("1º vencimento").fill(firstDueDate);
  await page.getByRole("button", { name: "Criar contrato" }).click();
  await expect(page).toHaveURL(/\/emprestimos\/[0-9a-f-]{36}$/);
  const heading = page.getByRole("heading", { level: 1, name: /^Contrato \d{4}-\d+/ });
  await expect(heading).toBeVisible();
  const title = (await heading.textContent()) ?? "";
  const number = /\d{4}-\d+/.exec(title)?.[0] ?? "";
  expect(number).not.toBe("");
  return { path: new URL(page.url()).pathname, number };
}

/** Ativa o DRAFT aberto com a data de desembolso informada (a ativação exige 1º vencimento posterior a ela). */
async function activate(page: Page, disbursedAt: string): Promise<void> {
  await page.getByLabel("Data do desembolso").fill(disbursedAt);
  await page.getByLabel("Conta de desembolso").selectOption({ label: "Conta principal" });
  await page.getByRole("button", { name: "Ativar", exact: true }).click();
  await expect(page.getByText(/· Ativo/)).toBeVisible();
}

async function readLateFee(page: Page): Promise<string> {
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  const field = page.getByLabel("Multa por atraso (%)");
  await expect(field).toHaveValue(/^\d+,\d{2}$/); // o valor só aparece com o formulário hidratado
  return field.inputValue();
}

async function saveLateFee(page: Page, value: string): Promise<void> {
  await page.goto("/configuracoes");
  const field = page.getByLabel("Multa por atraso (%)");
  await expect(field).toHaveValue(/^\d+,\d{2}$/); // espera hidratar antes de digitar
  await field.fill(value);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("status")).toHaveText("Parâmetros atualizados.");
}

/** Valor diferente do atual, para a mudança ser sempre real. */
function otherFee(current: string): string {
  return current === "7,77" ? "7,78" : "7,77";
}

test("shows the seeded terms, saves a new late fee and keeps it after reload", async ({ page }) => {
  const errors = watchConsole(page);
  const original = await readLateFee(page);
  expect(original).toMatch(/^\d+,\d{2}$/);
  await expect(page.getByLabel("Juros de mora (% ao mês)")).toHaveValue(/^\d+,\d{2}$/);
  await expect(page.getByLabel("Carência (dias)")).toHaveValue(/^\d+$/);
  await expect(page.getByLabel("Taxa de juros sugerida (% ao mês)")).toHaveValue(/^\d+,\d{2}$/);
  await expect(page.getByLabel("Passo de arredondamento (R$)")).toHaveValue(/^\d+,\d{2}$/);

  const changed = otherFee(original);
  try {
    await saveLateFee(page, changed);
    await page.reload();
    await expect(page.getByLabel("Multa por atraso (%)")).toHaveValue(changed);
  } finally {
    await saveLateFee(page, original); // deixa os parâmetros como encontrou
  }
  await page.reload();
  await expect(page.getByLabel("Multa por atraso (%)")).toHaveValue(original);
  expect(errors).toEqual([]);
});

test("CA-10: a contract created before the change keeps the old late fee, one created after gets the new one", async ({
  page,
}) => {
  const errors = watchConsole(page);
  const original = await readLateFee(page);
  const changed = otherFee(original);
  const before = await createDraft(page, "Ana Souza", "2099-12-14");
  try {
    await saveLateFee(page, changed);
    await page.goto("/emprestimos/novo");
    await expect(page.getByLabel("Multa (%)")).toHaveValue(changed); // RF-41: o novo padrão pré-preenche
    const after = await createDraft(page, "Ana Souza", "2099-12-14");

    await page.goto(`${before.path}/editar`);
    await expect(page.getByLabel("Multa (%)")).toHaveValue(original);
    await page.goto(`${after.path}/editar`);
    await expect(page.getByLabel("Multa (%)")).toHaveValue(changed);
  } finally {
    await saveLateFee(page, original);
  }
  expect(errors).toEqual([]);
});

test("lists installments due today, this week and overdue in their blocks, linking to the contract", async ({
  page,
}) => {
  const errors = watchConsole(page);
  const dueToday = brasiliaDate(0);
  const dueWeek = brasiliaDate(3);
  const dueLate = brasiliaDate(-5);

  const today = await createDraft(page, "Bruno Lima", dueToday);
  await activate(page, brasiliaDate(-30));
  const week = await createDraft(page, "Carla Dias", dueWeek);
  await activate(page, brasiliaDate(-1));
  const late = await createDraft(page, "Diego Rocha", dueLate);
  await activate(page, brasiliaDate(-40));

  await page.goto("/alertas");
  await expect(page.getByRole("heading", { level: 1, name: "Alertas" })).toBeVisible();
  const rowOf = (block: RegExp, number: string) =>
    page
      .getByRole("region", { name: block })
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: number, exact: true }) });

  const todayRow = rowOf(/^Vencendo hoje/, today.number);
  await expect(todayRow).toHaveCount(1);
  await expect(todayRow).toContainText("Bruno Lima");
  await expect(todayRow).toContainText(dateBr(dueToday));

  const weekRow = rowOf(/^Vencendo na semana/, week.number);
  await expect(weekRow).toHaveCount(1);
  await expect(weekRow).toContainText("Carla Dias");
  await expect(weekRow).toContainText(dateBr(dueWeek));

  const lateRow = rowOf(/^Atrasadas/, late.number);
  await expect(lateRow).toHaveCount(1);
  await expect(lateRow).toContainText("Diego Rocha");
  await expect(lateRow).toContainText(dateBr(dueLate));
  await expect(lateRow).toContainText("5 dias de atraso");
  const charges = lateRow.getByRole("cell").nth(6); // Encargos: multa + mora, maiores que zero
  await expect(charges).toHaveText(/^R\$ [\d.]+,\d{2}$/);
  await expect(charges).not.toHaveText("R$ 0,00");

  // a linha leva ao contrato
  await lateRow.getByRole("link", { name: late.number, exact: true }).click();
  await expect(page).toHaveURL(late.path);
  await page.goto("/alertas");
  await todayRow.getByRole("link", { name: today.number, exact: true }).click();
  await expect(page).toHaveURL(today.path);
  expect(errors).toEqual([]);
});
