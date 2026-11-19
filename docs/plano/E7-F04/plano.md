# E7-F04: registrar pagamento com comprovante e conta de destino

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E7.yaml`; referências: PRD-001 RF-20 e RN-R06;
RFC-004 §2, §5 e §6; ADR-0013; decisões do Joel de 17/11 (`docs/plano/decisoes-2026-11-17.md`).

## Escopo

- E7-T11 (Bia) e E7-T12 (Alice): `apps/web/lib/payment-draft.ts`, `toPaymentDraft` (textos e arquivo →
  `PaymentFields` validado e pedido de upload do comprovante), com `ReceiptRequiredError` (RN-R06).
- E7-T13 (Bia) e E7-T14 (Alice): `apps/web/components/payment-form.tsx`, rota `/emprestimos/[id]/pagamento`.
- Fora: upload real do comprovante e chamada à API (pendente do Joel), conferência do pagamento, estorno.
- Fora: tela de atualização de pagamento por contrato (v1.1, `docs/plano/decisoes-2026-11-19.md`).

## Tipos e imports (conferidos no código; valem para os testes e para a implementação)

- `toPaymentDraft(loanId: string, values: PaymentFormValues, receipt: ReceiptFile | null): PaymentDraft`
  (`apps/web/lib/payment-draft.ts`). `PaymentFormValues` (`import type` de `./payment-draft`): `accountId`,
  `paidAt`, `amount` texto e `method: PaymentMethod` ("PIX" | "BOLETO" | "CASH" | "BANK_TRANSFER"); o literal
  tipado impede "PIX" de virar `string`.
- `ReceiptFile` = `Pick<File, "name" | "size" | "type">`: no teste da função, um objeto literal basta (sem `File`).
- `PaymentDraft` = `{ payment: PaymentFields; receipt: AttachmentUploadUrlRequest | null }`. Esperado do exemplo:
  `payment` = `{ loanId: "01936f8e-7b2c-7cde-8f00-000000000002", accountId: "01936f8e-7b2c-7cde-8f00-000000000004",
  paidAt: "2026-12-13", amountCents: 115000, method: "PIX" }` (número comum, nunca bigint) e `receipt` =
  `{ fileName: "comprovante.pdf", contentType: "application/pdf", sizeBytes: 204800 }`.
- `ReceiptRequiredError` (classe de `./payment-draft`) com `code` "RECEIPT_REQUIRED"; `MoneyError` de
  `@pilla/finance`; `ZodError` de `zod`; `maxAttachmentBytes` é valor de `@pilla/schemas`.
- `PaymentForm` (`apps/web/components/payment-form.tsx`), props `loan`, `accounts`, `onSubmit?`; o teste passa
  `exampleLoanDetail`, `mockAccounts` e um `vi.fn()`.
- `verbatimModuleSyntax` e `noUnusedLocals` estão ligados: tipo só entra com `import type`, e nada é importado sem
  uso. As linhas de import exatas de cada arquivo de teste estão no `done` do cartão (lista fechada); o `vi` vem
  numa linha própria (`import { vi } from "vitest";`) por causa do validador de cartões.

## Como o teste consulta a tela

- E7-T11 não tem tela: `expect(() => toPaymentDraft(...)).toThrow(Classe)`, só a classe.
- Tela: `getByRole("heading", { level: 1, name: "Registrar pagamento" })` e o botão
  `getByRole("button", { name: "Registrar pagamento" })` (mesmo nome; nunca `getByText`). Textos "Contrato 2026-0012"
  e "Saldo devedor R$ 4.600,00".
- Rótulos: "Conta de destino", "Data do pagamento", "Valor", "Método", "Comprovante". Conta de destino = id da
  Conta principal; Método começa em PIX e CASH aparece como "Espécie".
- Arquivo: `new File([...], "comprovante.pdf", { type: "application/pdf" })` e `fireEvent.change` no rótulo
  "Comprovante" com `target.files` só com ele; `sizeBytes` esperado = `file.size`.
- Sucesso: status "Pagamento registrado para conferência."; sem comprovante: alerta "Anexe o comprovante
  (obrigatório exceto em espécie)."; outros erros: alerta "Confira os campos do pagamento.".
- Submit assíncrono (React Hook Form): `await screen.findByRole("status")` ou `("alert")`, guardar o elemento e
  conferir com `toHaveTextContent`; as conferências do `onSubmit` vêm depois. Nunca `await expect(findBy...)`.
- Não há `userEvent` no projeto: só `fireEvent` de `@testing-library/react`. Modelo: `apps/web/app/page.test.tsx`.
- Um `render` por teste (dois renders repetem rótulos, botões e textos e o `getBy` acha mais de um).

## Riscos

- RN-R06 testada só na tela: o E7-T11 testa os três métodos que exigem comprovante e o CASH sem arquivo.
- Arquivo no jsdom: o teste da tela usa `new File` e `fireEvent.change` com `target.files`.
- `number` × `bigint`: "1.150,00" vira 115000 (número) no pagamento.

## Dependências

- `paymentFieldsSchema`, `PaymentMethod`, `attachmentUploadUrlRequest`, `maxAttachmentBytes`, `AccountSummary` e
  `LoanDetailResponse` de `@pilla/schemas`; `paymentMethodLabel` de `apps/web/lib/labels.ts`.
- `parseReais` de `@pilla/finance` (E1); `exampleLoanDetail` e `mockAccounts` de `apps/web/lib/mock-data.ts`.

## Critérios de aceite

- A1: o exemplo (1.150,00 em 2026-12-13, PIX, comprovante.pdf) vira `amountCents` 115000 e o pedido de upload do
  PDF.
- A2: CASH sem arquivo passa com `receipt` null; PIX, BOLETO e BANK_TRANSFER sem arquivo lançam
  `ReceiptRequiredError` com code "RECEIPT_REQUIRED".
- A3: valor sem vírgula lança MoneyError; GIF ou PDF acima de `maxAttachmentBytes` lançam ZodError.
- A4: a tela mostra contrato e saldo, registra o exemplo com o status "Pagamento registrado para conferência." e
  mostra os dois alertas conforme o erro.
- A5: 100% de linhas e ramos de `payment-draft.ts`, 85% de `payment-form.tsx`; typecheck e lint verdes.

## Cenários

- C1: pagamento do exemplo com comprovante.
- C2: espécie sem comprovante.
- C3: método que exige comprovante sem arquivo.
- C4: valor e arquivo inválidos.
- C5: tela: campos, envio do exemplo, alerta do comprovante, espécie e valor inválido.
