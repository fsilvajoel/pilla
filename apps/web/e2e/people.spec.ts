import { expect, test, type Page } from "@playwright/test";

// E9-T22: fluxo de pessoas ponta a ponta contra a API real e o Postgres do compose (migrate + seed aplicados).
// Os testes rodam em série porque compartilham a pessoa criada no primeiro.
test.describe.configure({ mode: "serial" });

/** CPF válido (dígitos verificadores) a partir de 9 dígitos; único por execução para não colidir com dados antigos. */
function cpfFrom(base: string): string {
  const digits = base.split("").map(Number);
  const check = (len: number): number => {
    const sum = digits.slice(0, len).reduce((acc, d, i) => acc + d * (len + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  digits.push(check(9));
  digits.push(check(10));
  return digits.join("");
}

const seed = String(Date.now() % 1_000_000_000).padStart(9, "0");
const cpf = cpfFrom(seed);
const fullName = `Teste E2E ${seed}`;
const phone = `+5511${String(9_00000000 + (Number(seed) % 99_999_999))}`;
const newPhone = "+5511912345678";

const consoleErrors: string[] = [];
let personUrl = "";

test.beforeEach(({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });
});

async function fillPerson(page: Page, name: string, document: string, phoneNumber: string): Promise<void> {
  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("CPF").fill(document);
  await page.getByLabel("Telefone").fill(phoneNumber);
}

async function addAddress(page: Page, street: string, primary: boolean): Promise<void> {
  await page.getByRole("button", { name: "Adicionar endereço" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Rua").fill(street);
  await dialog.getByLabel("Número").fill("100");
  await dialog.getByLabel("Bairro").fill("Centro");
  await dialog.getByLabel("Cidade").fill("São Paulo");
  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /^SP/ }).click();
  await dialog.getByLabel("CEP").fill("01001000");
  if (primary) await dialog.getByLabel("Endereço principal").check();
  await dialog.getByRole("button", { name: /Salvar|Adicionar|Criar/ }).click();
  await expect(dialog).toBeHidden();
}

test("cria pessoa com indicador e abre a ficha", async ({ page }) => {
  await page.goto("/pessoas/nova");
  await expect(page.getByRole("heading", { level: 1, name: "Nova pessoa" })).toBeVisible();
  await fillPerson(page, fullName, cpf, phone);
  await page.getByLabel("Indicado por").fill("Ana");
  await page.getByRole("list", { name: "Resultados da busca" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page).toHaveURL(/\/pessoas\/[0-9a-f-]{36}$/);
  personUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: fullName }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Ana/ })).toBeVisible();
});

test("acha a pessoa pelo CPF na lista", async ({ page }) => {
  await page.goto("/pessoas");
  await page.getByRole("searchbox", { name: "Buscar pessoas" }).fill(cpf);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/search=/);
  await expect(page.getByRole("row", { name: new RegExp(fullName) })).toBeVisible();
});

test("adiciona dois endereços e troca o principal", async ({ page }) => {
  await page.goto(personUrl);
  await addAddress(page, "Rua Um", true);
  await addAddress(page, "Rua Dois", false);

  const rows = page.locator("div.border.rounded-lg", { hasText: /Rua (Um|Dois)/ });
  await expect(rows.filter({ hasText: "Rua Um" }).getByText("Principal", { exact: true })).toBeVisible();
  await rows.filter({ hasText: "Rua Dois" }).getByRole("button", { name: "Tornar principal" }).click();
  await expect(rows.filter({ hasText: "Rua Dois" }).getByText("Principal", { exact: true })).toBeVisible();
  await expect(rows.filter({ hasText: "Rua Um" }).getByText("Principal", { exact: true })).toHaveCount(0);
});

test("adiciona uma chave PIX", async ({ page }) => {
  await page.goto(personUrl);
  await page.getByRole("tab", { name: "Chaves PIX" }).click();
  await page.getByRole("button", { name: "Adicionar chave" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill(cpf);
  await dialog.getByRole("button", { name: /Salvar|Adicionar|Criar/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Chaves PIX" })).toBeVisible();
  await expect(page.getByText(/^CPF: \d{3}\.\d{3}\.\d{3}-\d{2}/).first()).toBeVisible();
});

test("edita o telefone e vê na ficha", async ({ page }) => {
  await page.goto(`${personUrl}/editar`);
  await page.getByLabel("Telefone").clear();
  await page.getByLabel("Telefone").fill(newPhone);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(personUrl);
  await expect(page.getByText("912345678")).toBeVisible();
});

test("CPF repetido mostra o erro no campo", async ({ page }) => {
  await page.goto("/pessoas/nova");
  await fillPerson(page, `${fullName} duplicada`, cpf, phone);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByLabel("CPF")).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/pessoas\/nova$/);
});

test("nenhum erro de console no fluxo", () => {
  // O 409 do CPF repetido gera um "Failed to load resource" do navegador; qualquer outro erro conta.
  const unexpected = consoleErrors.filter((text) => !/status of 409/.test(text));
  expect(unexpected).toEqual([]);
});
