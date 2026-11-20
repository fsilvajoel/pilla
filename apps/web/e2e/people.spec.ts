import { expect, test, type Page } from "@playwright/test";

// Fluxo de pessoas contra a API e o Postgres reais (ver playwright.config.ts): cadastro, busca, edição, indicação,
// endereços e chaves PIX. Cada execução usa CPF e nome únicos, então o banco não precisa de limpeza.

function cpfDigit(digits: readonly number[]): number {
  const sum = digits.reduce((acc, d, i) => acc + d * (digits.length + 1 - i), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** CPF válido, aleatório e formatado (000.000.000-00). */
function randomCpf(): string {
  let base: number[] = [];
  do {
    base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  } while (base.every((d) => d === base[0]));
  const d1 = cpfDigit(base);
  const d2 = cpfDigit([...base, d1]);
  const all = [...base, d1, d2].join("");
  return `${all.slice(0, 3)}.${all.slice(3, 6)}.${all.slice(6, 9)}-${all.slice(9)}`;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function watchConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function createPerson(
  page: Page,
  fields: { name: string; cpf: string; phone: string; referrerName?: string },
): Promise<void> {
  await page.goto("/pessoas/nova");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome completo").fill(fields.name);
  await page.getByLabel("CPF").fill(fields.cpf);
  await page.getByLabel("Telefone").fill(fields.phone);
  if (fields.referrerName !== undefined) {
    await page.getByLabel("Indicado por").fill(fields.referrerName);
    await page
      .getByRole("list", { name: "Resultados da busca" })
      .getByRole("button", { name: new RegExp(fields.referrerName) })
      .click();
  }
  await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
}

test("creates a person, finds it by name without accents and by CPF prefix, edits and clears a field", async ({
  page,
}) => {
  const consoleErrors = watchConsoleErrors(page);
  const unique = Date.now().toString(36);
  const name = `Joaquim Conceição ${unique}`;
  const cpf = randomCpf();

  await createPerson(page, { name, cpf, phone: "11987654321" });
  await expect(page).toHaveURL(/\/pessoas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("(11) 98765-4321")).toBeVisible();

  // Busca sem acento e sem diferenciar maiúsculas.
  await page.goto("/pessoas");
  await page.getByRole("searchbox", { name: "Buscar pessoas" }).fill(`joaquim conceicao ${unique}`);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();

  // Busca por prefixo do CPF (só dígitos).
  await page.getByRole("searchbox", { name: "Buscar pessoas" }).fill(onlyDigits(cpf).slice(0, 8));
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();

  // Edição: telefone novo e e-mail preenchido, depois e-mail limpo (null).
  await page
    .getByRole("row", { name: new RegExp(name) })
    .getByRole("link")
    .click();
  await page.getByRole("link", { name: "Editar pessoa" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Telefone").fill("21912345678");
  await page.getByLabel("E-mail (opcional)").fill("joaquim@example.com");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("(21) 91234-5678")).toBeVisible();
  await expect(page.getByText("joaquim@example.com")).toBeVisible();

  await page.getByRole("link", { name: "Editar pessoa" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Indicado por")).toBeVisible();
  await page.getByLabel("E-mail (opcional)").fill("");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("(21) 91234-5678")).toBeVisible();
  await expect(page.getByText("joaquim@example.com")).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

test("shows the field error for a repeated CPF", async ({ page }) => {
  const unique = Date.now().toString(36);
  const cpf = randomCpf();

  await createPerson(page, { name: `Primeira ${unique}`, cpf, phone: "11987654321" });
  await expect(page).toHaveURL(/\/pessoas\/[0-9a-f-]{36}$/);

  await createPerson(page, { name: `Segunda ${unique}`, cpf, phone: "11987654322" });
  await expect(page.getByRole("alert").filter({ hasText: "CPF já cadastrado" })).toBeVisible();
  await expect(page.getByLabel("CPF")).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/pessoas\/nova$/);
});

test("reports a version conflict when the record changed in another tab", async ({ page, context }) => {
  const unique = Date.now().toString(36);
  await createPerson(page, { name: `Conflito ${unique}`, cpf: randomCpf(), phone: "11987654321" });
  await expect(page).toHaveURL(/\/pessoas\/[0-9a-f-]{36}$/);
  const editUrl = `${page.url()}/editar`;

  const other = await context.newPage();
  await page.goto(editUrl);
  await other.goto(editUrl);
  // Espera a hidratação: o submit só vira Server Action depois dela.
  await page.waitForLoadState("networkidle");
  await other.waitForLoadState("networkidle");

  await other.getByLabel("Telefone").fill("21911112222");
  await other.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(other.getByText("(21) 91111-2222")).toBeVisible();

  await page.getByLabel("Telefone").fill("31933334444");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Esta ficha foi alterada por outra pessoa").first()).toBeVisible();
  await expect(page).toHaveURL(/\/editar$/);
});

test("shows the referrer and the referrals on the person sheet", async ({ page }) => {
  const unique = Date.now().toString(36);
  const referrerName = `Indicadora ${unique}`;
  const referralName = `Indicado ${unique}`;

  await createPerson(page, { name: referrerName, cpf: randomCpf(), phone: "11987654321" });
  await expect(page.getByRole("heading", { level: 1, name: referrerName })).toBeVisible();
  const referrerUrl = page.url();

  await createPerson(page, { name: referralName, cpf: randomCpf(), phone: "11987654322", referrerName });
  await expect(page.getByRole("heading", { level: 1, name: referralName })).toBeVisible();
  await expect(page.getByText(referrerName)).toBeVisible();

  await page.goto(referrerUrl);
  await expect(page.getByText(referralName)).toBeVisible();
});

async function openSheetOfNewPerson(page: Page, label: string): Promise<void> {
  const name = `${label} ${Date.now().toString(36)}`;
  await createPerson(page, { name, cpf: randomCpf(), phone: "11987654321" });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function addAddress(page: Page, street: string, number: string, primary: boolean): Promise<void> {
  await page.getByRole("button", { name: "Adicionar endereço" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Rua").fill(street);
  await dialog.getByLabel("Número").fill(number);
  await dialog.getByLabel("Bairro").fill("Centro");
  await dialog.getByLabel("Cidade").fill("Campinas");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: /^SP/ }).click();
  await dialog.getByLabel("CEP").fill("13010000");
  if (primary) await dialog.getByLabel("Endereço principal").check();
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(dialog).toHaveCount(0);
}

test("adds addresses, swaps the primary and deletes without promoting another", async ({ page }) => {
  const consoleErrors = watchConsoleErrors(page);
  await openSheetOfNewPerson(page, "Enderecos");

  await expect(page.getByText("Nenhum endereço cadastrado.")).toBeVisible();
  await addAddress(page, "Rua Alfa", "10", false);
  await expect(page.getByText("Rua Alfa, 10")).toBeVisible();
  // O primeiro endereço nasce principal, mesmo sem marcar.
  const alfa = page.locator("div.border.p-4", { hasText: "Rua Alfa, 10" });
  await expect(alfa.getByText("Principal", { exact: true })).toBeVisible();

  await addAddress(page, "Rua Beta", "20", false);
  const beta = page.locator("div.border.p-4", { hasText: "Rua Beta, 20" });
  await expect(beta).toBeVisible();
  await expect(beta.getByText("Principal", { exact: true })).toHaveCount(0);

  // Trocar o principal.
  await beta.getByRole("button", { name: "Tornar principal" }).click();
  await expect(beta.getByText("Principal", { exact: true })).toBeVisible();
  await expect(alfa.getByText("Principal", { exact: true })).toHaveCount(0);

  // Excluir o principal não promove o outro.
  await beta.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("Rua Beta, 20")).toHaveCount(0);
  await expect(page.getByText("Rua Alfa, 10")).toBeVisible();
  await expect(alfa.getByText("Principal", { exact: true })).toHaveCount(0);

  // Recarregar confirma que veio do banco.
  await page.reload();
  await expect(page.getByText("Rua Alfa, 10")).toBeVisible();
  await expect(page.getByText("Rua Beta, 20")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

async function addPix(page: Page, email: string): Promise<void> {
  await page.getByRole("button", { name: "Adicionar chave" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "E-mail" }).click();
  await dialog.getByLabel("Valor").fill(email);
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(dialog).toHaveCount(0);
}

test("adds PIX keys, accepts a duplicate, swaps the primary and deletes", async ({ page }) => {
  const consoleErrors = watchConsoleErrors(page);
  await openSheetOfNewPerson(page, "Pix");
  await page.getByRole("tab", { name: "Chaves PIX" }).click();

  await expect(page.getByText("Nenhuma chave PIX cadastrada.")).toBeVisible();
  const unique = Date.now().toString(36);
  const first = `primeira.${unique}@example.com`;
  const second = `segunda.${unique}@example.com`;
  await addPix(page, first);
  const rows = page.locator("div.border.p-4", { hasText: first });
  await expect(rows).toHaveCount(1);
  await expect(rows.getByText("Principal", { exact: true })).toBeVisible();

  await addPix(page, second);
  const secondRow = page.locator("div.border.p-4", { hasText: second });
  await expect(secondRow.getByText("Principal", { exact: true })).toHaveCount(0);

  // Chave duplicada é aceita.
  await addPix(page, first);
  await expect(rows).toHaveCount(2);

  // Trocar o principal.
  await secondRow.getByRole("button", { name: "Tornar principal" }).click();
  await expect(secondRow.getByText("Principal", { exact: true })).toBeVisible();
  await expect(rows.getByText("Principal", { exact: true })).toHaveCount(0);

  // Excluir o principal não promove outra.
  await secondRow.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText(second)).toHaveCount(0);
  await expect(rows).toHaveCount(2);
  await expect(rows.getByText("Principal", { exact: true })).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});
