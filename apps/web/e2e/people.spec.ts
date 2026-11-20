import { expect, test, type Page } from "@playwright/test";

// Fluxo de pessoas contra a API e o Postgres reais (ver playwright.config.ts). Endereços e chaves PIX ficam
// para quando as rotas existirem. Cada execução usa CPF e nome únicos, então o banco não precisa de limpeza.

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

async function createPerson(page: Page, fields: { name: string; cpf: string; phone: string }): Promise<void> {
  await page.goto("/pessoas/nova");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome completo").fill(fields.name);
  await page.getByLabel("CPF").fill(fields.cpf);
  await page.getByLabel("Telefone").fill(fields.phone);
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
