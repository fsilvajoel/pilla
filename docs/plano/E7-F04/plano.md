# E7-F04: registrar pagamento com comprovante e conta de destino

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E7.yaml`; referências: PRD-001 RF-20 e RN-R06;
RFC-004 §2, §5 e §6; ADR-0013; decisões do Joel de 17/11 (`docs/plano/decisoes-2026-11-17.md`).

## Escopo

- E7-T11 (Bia) e E7-T12 (Alice): `apps/web/lib/payment-draft.ts`, `toPaymentDraft` (textos e arquivo →
  `PaymentFields` validado e pedido de upload do comprovante), com `ReceiptRequiredError` (RN-R06).
- E7-T13 (Bia) e E7-T14 (Alice): `apps/web/components/payment-form.tsx`, rota `/emprestimos/[id]/pagamento`.
- Fora: upload real do comprovante e chamada à API (pendente do Joel), conferência do pagamento, estorno.

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
