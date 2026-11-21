import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// E13-T13: bloco "Pagamentos pendentes de conferência" de /alertas (RF-20, RF-50) contra a API e o Postgres reais.
// O pagamento é registrado e confirmado pela API da E11 (POST /payments, POST /payments/{id}/confirm).
test.setTimeout(120_000); // o `next dev` compila cada rota na primeira visita

const apiURL = "http://127.0.0.1:3101/api/v1"; // a API do e2e (playwright.config.ts)
const paymentCents = 10_000;

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

/** "R$ 1.234,56" para centavos. */
function reaisToCents(text: string): number {
  return Number(text.replace(/\D/g, ""));
}

async function createActiveLoan(
  page: Page,
  personName: string,
  firstDueDate: string,
): Promise<{ id: string; number: string }> {
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
  const number = /\d{4}-\d+/.exec((await heading.textContent()) ?? "")?.[0] ?? "";
  expect(number).not.toBe("");
  const id = /[0-9a-f-]{36}$/.exec(new URL(page.url()).pathname)?.[0] ?? "";
  await page.getByLabel("Data do desembolso").fill(brasiliaDate(-30));
  await page.getByLabel("Conta de desembolso").selectOption({ label: "Conta principal" });
  await page.getByRole("button", { name: "Ativar", exact: true }).click();
  await expect(page.getByText(/· Ativo/)).toBeVisible();
  return { id, number };
}

async function activeAccountId(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${apiURL}/accounts`);
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { items: { id: string; name: string; active: boolean }[] };
  const account = body.items.find((item) => item.active && item.name === "Conta principal");
  expect(account).toBeDefined();
  return account?.id ?? "";
}

test("lists a registered payment in the pending review block and drops it once confirmed", async ({
  page,
  request,
}) => {
  const errors = watchConsole(page);
  const loan = await createActiveLoan(page, "Ana Souza", brasiliaDate(0));
  const accountId = await activeAccountId(request);

  const registered = await request.post(`${apiURL}/payments`, {
    data: {
      loanId: loan.id,
      accountId,
      paidAt: brasiliaDate(0),
      amountCents: paymentCents,
      method: "PIX",
    },
  });
  expect(registered.status()).toBe(201);
  const payment = (await registered.json()) as { id: string; version: number; status: string };
  expect(payment.status).toBe("PENDING_REVIEW");

  const pendingRow = () =>
    page
      .getByRole("region", { name: /^Pagamentos pendentes de conferência/ })
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: loan.number, exact: true }) });
  const installmentRow = () =>
    page
      .getByRole("region", { name: /^Vencendo hoje/ })
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: loan.number, exact: true }) });

  await page.goto("/alertas");
  await expect(page.getByRole("heading", { level: 1, name: "Alertas" })).toBeVisible();
  await expect(pendingRow()).toHaveCount(1);
  await expect(pendingRow()).toContainText("Ana Souza");
  await expect(pendingRow()).toContainText("R$ 100,00");
  // o pagamento pendente ainda não abate a parcela
  const openBefore = reaisToCents(await installmentRow().getByRole("cell").nth(4).innerText());
  expect(openBefore).toBeGreaterThan(paymentCents);

  await pendingRow().getByRole("link", { name: loan.number, exact: true }).click();
  await expect(page).toHaveURL(`/emprestimos/${loan.id}`);

  const confirmed = await request.post(`${apiURL}/payments/${payment.id}/confirm`, {
    headers: { "If-Match": String(payment.version) },
    data: {},
  });
  expect(confirmed.status()).toBe(200);
  expect(((await confirmed.json()) as { status: string }).status).toBe("CONFIRMED");

  await page.goto("/alertas");
  await expect(page.getByRole("heading", { level: 1, name: "Alertas" })).toBeVisible();
  await expect(installmentRow()).toHaveCount(1);
  await expect(pendingRow()).toHaveCount(0);
  const openAfter = reaisToCents(await installmentRow().getByRole("cell").nth(4).innerText());
  expect(openAfter).toBe(openBefore - paymentCents);
  expect(errors).toEqual([]);
});
