# E7-F04: registrar pagamento com chave Pix de destino (sem comprovante)

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E7.yaml`; referências: PRD-001 RF-20; RFC-004 §2 e §5;
ADR-0013; decisões do Joel de 17/11 (`docs/plano/decisoes-2026-11-17.md`) e de 19/11 §3
(`docs/plano/decisoes-2026-11-19.md`: sem comprovante no MVP); respostas do Joel de 19/11 sobre valor, data,
chave Pix e contrato fechado (seção Decisões).

## Escopo

- E7-T11 (Bia) e E7-T12 (Alice): `apps/web/lib/payment-draft.ts`, `toPaymentDraft` (textos da tela →
  `PaymentFields` validado por `paymentFieldsSchema`).
- E7-T13 (Bia) e E7-T14 (Alice): `apps/web/components/payment-form.tsx`, tela "Registrar pagamento" (rota
  `/emprestimos/[id]/pagamento`) com Chave Pix de destino (campo de texto), Data do pagamento, Valor e Método; contrato fechado (RN-R09) bloqueia o
  formulário.
- Fora, comprovante (decisão 19/11 §3; v1.1): campo e upload de arquivo, visualização, `ReceiptRequiredError`,
  `ReceiptFile`, pedido de upload (`attachmentUploadUrlRequest`), RN-R06 e `RECEIPT_REQUIRED`. O formulário não tem
  campo "Comprovante" e `onSubmit` não recebe `receipt`.
- Fora, `createPaymentRequest` (RN-R06 na API): fora desta feature, outra feature. Nada é criado nem alterado aqui.
- Fora: chamada à API, conferência (confirmar) do pagamento, estorno, prévia da distribuição (RF-23), tela de
  atualização de pagamento por contrato (v1.1, `decisoes-2026-11-19.md` §2).

## Contrato

- `apps/web/lib/payment-draft.ts`: `toPaymentDraft(loanId: string, values: PaymentFormValues): PaymentFields`
  (muda: perde o 3º parâmetro e o tipo `PaymentDraft`; `PaymentFields` vem de `@pilla/schemas`).
- `PaymentFormValues` (inalterado): `destinationKey`, `paidAt`, `amount` texto e `method: PaymentMethod`
  ("PIX" | "BOLETO" | "CASH" | "BANK_TRANSFER").
- `apps/web/components/payment-form.tsx`: `PaymentForm({ loan, onSubmit? })`, com
  `onSubmit?: (payment: PaymentFields) => void`. Sem select de contas, a prop `accounts` não é mais usada (some do
  contrato; ajuste de preparo da casca, ver Riscos).

Esperado do exemplo (1.150,00 em 2026-12-13, PIX, conta principal): `{ loanId: "01936f8e-7b2c-7cde-8f00-000000000002",
destinationKey: "chave-pix@exemplo.com", paidAt: "2026-12-13", amountCents: 115000, method: "PIX" }`
(número comum, nunca bigint; comparar com `toStrictEqual`).

## Decisões do Joel (19/11)

1. Valor máximo: sem limite de negócio no MVP, só o limite técnico já existente (inteiro seguro do `z.int()`).
   Pendência futura (pós-MVP): definir se haverá máximo; sem regra nova agora.
2. Data do pagamento: sem restrição no MVP (pode ser futura ou anterior ao desembolso). Só vale o formato de data
   válida no calendário.
3. Conta de destino: não é select; é campo de texto com a chave Pix, rótulo "Chave Pix de destino". Sem lista de
   contas, sem "só contas ativas".
4. Contrato fechado (RN-R09): a tela bloqueia o formulário (não envia). Fecham: `PAID_OFF`, `RENEWED`,
   `RENEGOTIATED`, `CANCELLED`; `ACTIVE` e `WRITTEN_OFF` aceitam pagamento (RN-C20). A tela mostra o aviso "Este
   contrato não aceita pagamento." (texto proposto, Joel confirma) em `role="alert"` e não renderiza o formulário
   nem o botão de envio.
5. RN-R06 na API (`createPaymentRequest`): fora desta feature, outra feature.

## Arquivos de produção

| Arquivo | Domínio |
|---|---|
| `apps/web/lib/payment-draft.ts` | sim (converte e valida o pagamento) |
| `apps/web/components/payment-form.tsx` | não (tela) |

## Tipos e imports (valem para os testes e para a implementação)

- `MoneyError` de `@pilla/finance`; `ZodError` de `zod`; `toThrow(Classe)`, só a classe.
- `PaymentForm`: props `loan`, `onSubmit?`; o teste passa `exampleLoanDetail` (ou o mesmo com `status` fechado) e
  um `vi.fn()`; `mockAccounts` não é usado.
- `verbatimModuleSyntax` e `noUnusedLocals` estão ligados: tipo só entra com `import type`, e nada é importado sem
  uso. As linhas de import exatas de cada teste ficam no `done` do cartão (lista fechada); o `vi` vem numa linha
  própria (`import { vi } from "vitest";`) por causa do validador de cartões.

## Como o teste consulta a tela

- E7-T11 não tem tela: `expect(() => toPaymentDraft(...)).toThrow(Classe)`.
- Tela: `getByRole("heading", { level: 1, name: "Registrar pagamento" })` e o botão
  `getByRole("button", { name: "Registrar pagamento" })` (mesmo nome; nunca `getByText`). Textos "Contrato 2026-0012"
  e "Saldo devedor R$ 4.600,00".
- Rótulos (`getByLabelText`): "Chave Pix de destino" (input de texto), "Data do pagamento", "Valor", "Método". Não
  existe "Comprovante" (há teste de que não aparece) nem select de conta. O teste digita no campo o valor
  `chave-pix@exemplo.com`; Método começa em PIX e CASH
  aparece como "Espécie".
- Contrato fechado: com `{ ...exampleLoanDetail, status: "PAID_OFF" }` (e RENEWED, RENEGOTIATED, CANCELLED) a tela
  mostra o alerta "Este contrato não aceita pagamento.", e `queryByLabelText("Valor")` e
  `queryByRole("button", { name: "Registrar pagamento" })` são null; `onSubmit` não é chamado.
- Sucesso: status "Pagamento registrado para conferência."; qualquer erro: alerta "Confira os campos do
  pagamento.".
- Submit assíncrono (React Hook Form): `await screen.findByRole("status")` ou `("alert")`, guardar o elemento e
  conferir com `toHaveTextContent`; as conferências do `onSubmit` vêm depois. Nunca `await expect(findBy...)`.
- Não há `userEvent` no projeto: só `fireEvent` de `@testing-library/react`. Modelo: `apps/web/app/page.test.tsx`.
- Um `render` por teste.

## Domínio das entradas

| Entrada | Formato aceito | Mínimo | Máximo | Exemplos rejeitados | Erro esperado | Fonte |
|---|---|---|---|---|---|---|
| `amount` (Valor) | reais com vírgula e exatamente 2 casas, milhar com ponto opcional: `1.150,00`, `50,00` | 0,01 (`amountCents` inteiro > 0) | só o limite técnico de inteiro seguro do `z.int()`; sem limite de negócio no MVP (decisão 1; pendência futura pós-MVP) | `""`, `"1150"`, `"1150.00"`, `"1.150,5"`, `"abc"`, `"0,00"`, `"-5,00"` | formato: `MoneyError`; zero e negativo: `ZodError` em `amountCents`; tela: alerta "Confira os campos do pagamento." e não chama `onSubmit` | `parseReais` (`@pilla/finance`); `positiveCentsSchema` (`common.ts`); RFC-004 §2; RF-20 |
| `paidAt` (Data do pagamento) | `AAAA-MM-DD` válido no calendário (input `type="date"`) | sem restrição (decisão 2) | sem restrição (decisão 2; data futura ou anterior ao desembolso passa) | `""`, `"2026-13-01"`, `"2026-02-30"`, `"13/12/2026"`, `"2026-1-1"` | `ZodError` em `paidAt`; alerta "Confira os campos do pagamento." | `common.ts` `isoDateSchema` (`z.iso.date()`); RF-20; RFC-004 §2 |
| `destinationKey` (Chave Pix de destino) | texto livre digitado no campo (decisão 3), sem lista de contas; `paymentFieldsSchema.destinationKey` é `z.string().trim().min(1)` | 1 caractere após trim | sem limite definido (pendência) | `""`, `"   "` | `ZodError` em `destinationKey`; alerta "Confira os campos do pagamento." | `create-payment.ts` `paymentFieldsSchema`; RF-20; decisão 3 |
| `method` (Método) | um de `PIX`, `BOLETO`, `CASH`, `BANK_TRANSFER` (select; começa em PIX) | 1 valor | 1 valor | `""`, `"pix"`, `"CARD"` | `ZodError` em `method`. **Exceção sem cenário de teste:** o tipo `PaymentMethod` e o select impedem o valor inválido (sem `as` no lint); a regra fica coberta pelo `paymentMethodSchema` em `@pilla/schemas` | `create-payment.ts` `paymentMethodSchema`; RF-20 |
| `loanId` (do `loan.id`, não digitado) | id (UUID v7) do contrato exibido | 1 id | 1 id | `""`, `"abc"` | `ZodError` em `loanId` (chamada direta de `toPaymentDraft`) | `common.ts` `idSchema`; RFC-004 §2 |

Sem entrada de arquivo no MVP. Contrato fechado (RN-R09) não é entrada: é o `loan.status` exibido, e a tela bloqueia
o formulário (decisão 4).

## Riscos

- Resíduo do comprovante nos stubs do HEAD (`payment-draft.ts`, `payment-form.tsx`) e nos cartões: a E7-T11/T13
  não escrevem testes de comprovante e a casca precisa perder `ReceiptRequiredError`, `ReceiptFile`, `PaymentDraft`
  e o comentário do campo "Comprovante" antes dos testes (ajuste de preparo, fora do plano).
- `createPaymentRequest` (RN-R06 na API): fora desta feature, outra feature (decisão 5); esta usa só
  `paymentFieldsSchema`.
- A casca do `PaymentForm` ainda tem a prop `accounts` e o select: sai no ajuste de preparo, junto com o resíduo do
  comprovante.
- `number` × `bigint`: "1.150,00" vira 115000 (número) no pagamento; o teste usa literal numérico.
- Submit assíncrono: o teste espera o status/alerta com `findByRole`.

## Dependências

- `paymentFieldsSchema`, `PaymentFields`, `PaymentMethod` e `LoanDetailResponse` (com `status`) de
  `@pilla/schemas`; `paymentMethodLabel` de `apps/web/lib/labels.ts`.
- `parseReais`, `formatReais`, `cents` de `@pilla/finance` (E1); `exampleLoanDetail` de
  `apps/web/lib/mock-data.ts`.

## Critérios de aceite

### A1: monta o pagamento do exemplo
- entrada: `loanId` 01936f8e-...-000000000002, `destinationKey` "chave-pix@exemplo.com", `paidAt` "2026-12-13",
  `amount` "1.150,00", `method` "PIX"
- domínio: `amount`, `paidAt`, `destinationKey`, `method`, `loanId`
- saída: `{ loanId, destinationKey, paidAt: "2026-12-13", amountCents: 115000, method: "PIX" }`, sem chave `receipt`
- erro: nenhum
- fonte: RF-20; RFC-004 §5
- camada: unit

### A2: os quatro métodos passam sem arquivo
- entrada: o exemplo com `method` "PIX", "BOLETO", "CASH" e "BANK_TRANSFER"
- domínio: `method`
- saída: o mesmo pagamento com o `method` correspondente, sem exigir comprovante
- erro: nenhum (nenhum método lança erro de comprovante)
- fonte: decisão 19/11 §3; RF-20
- camada: unit

### A3: rejeita valor fora do formato ou não positivo
- entrada: `amount` "1150" (sem vírgula), "1.150,5", "0,00" e "-5,00"
- domínio: `amount`
- saída: nenhuma
- erro: "1150" e "1.150,5": `MoneyError`; "0,00" e "-5,00": `ZodError`
- fonte: RFC-004 §2; `parseReais`; `positiveCentsSchema`
- camada: unit

### A4: rejeita data, conta e contrato inválidos
- entrada: `paidAt` "2026-02-30"; `destinationKey` ""; `loanId` "abc"
- domínio: `paidAt`, `destinationKey`, `loanId`
- saída: nenhuma
- erro: `ZodError`
- fonte: `isoDateSchema`; `paymentFieldsSchema`; `idSchema`; RF-20
- camada: unit

### A4b: não restringe a data nem o valor máximo
- entrada: o exemplo com `paidAt` "2099-01-01" e com `paidAt` "2000-01-01" (antes do desembolso); `amount` "90.000.000,00"
- domínio: `paidAt`, `amount`
- saída: o pagamento correspondente, sem erro
- erro: nenhum (sem regra de data nem de valor máximo no MVP)
- fonte: decisões 1 e 2 do Joel de 19/11
- camada: unit

### A5: tela mostra o contrato e os quatro campos
- entrada: `PaymentForm` com `exampleLoanDetail`
- domínio: nenhuma (só exibição)
- saída: h1 e botão "Registrar pagamento", "Contrato 2026-0012", "Saldo devedor R$ 4.600,00", rótulos "Chave Pix de
  destino" (campo de texto, não select), "Data do pagamento", "Valor", "Método" (começa em PIX; CASH aparece como "Espécie"); não há "Comprovante"
- erro: nenhum
- fonte: RF-20; decisão 19/11 §3
- camada: unit

### A6: tela registra o exemplo sem arquivo
- entrada: Chave Pix de destino `chave-pix@exemplo.com`, "2026-12-13", "1.150,00", PIX, clique em "Registrar pagamento"
- domínio: `amount`, `paidAt`, `destinationKey`, `method`
- saída: status "Pagamento registrado para conferência."; `onSubmit` chamado uma vez com o pagamento do A1
- erro: nenhum
- fonte: RF-20; RFC-004 §5
- camada: unit

### A8: tela bloqueia contrato fechado
- entrada: `PaymentForm` com `{ ...exampleLoanDetail, status }` para `PAID_OFF`, `RENEWED`, `RENEGOTIATED` e `CANCELLED`; e com `WRITTEN_OFF` e `ACTIVE`
- domínio: `loan.status`
- saída: nos quatro fechados, alerta "Este contrato não aceita pagamento." e nenhum campo nem botão de envio; `onSubmit` não é chamado; em `WRITTEN_OFF` e `ACTIVE` o formulário aparece
- erro: nenhum
- fonte: RN-R09; RN-C20; decisão 4 do Joel de 19/11
- camada: unit

### A7: tela recusa entrada inválida
- entrada: o exemplo com Valor "1150", e o exemplo com a Chave Pix de destino vazia
- domínio: `amount`, `destinationKey`
- saída: `onSubmit` não é chamado
- erro: alerta "Confira os campos do pagamento." (nunca mensagem de comprovante)
- fonte: decisões do Joel de 17/11; RF-20
- camada: unit

## Cenários

- C1 (A1, unit): exemplo → `amountCents` 115000, PIX, sem `receipt` (RF-20, RFC-004 §5).
- C2 (A2, unit): o exemplo com BOLETO, CASH e BANK_TRANSFER, sem arquivo, dá o pagamento com o método certo (decisão 19/11 §3).
- C3 (A3, unit): `amount` "1150" e "1.150,5" → `MoneyError`; "0,00" e "-5,00" → `ZodError` (RFC-004 §2).
- C4 (A4, unit): `paidAt` "2026-02-30", `destinationKey` "" e `loanId` "abc" → `ZodError` (RF-20).
- C4b (A4b, unit): `paidAt` "2099-01-01" e "2000-01-01" e `amount` "90.000.000,00" passam sem erro (decisões 1 e 2).
- C5 (A5, unit): tela: título, contrato, saldo, quatro rótulos (Chave Pix de destino como texto), Método em PIX, ausência de "Comprovante".
- C6 (A6, unit): tela: envio do exemplo → status e `onSubmit` com o pagamento; Método CASH também envia.
- C7 (A7, unit): tela: Valor "1150" e Chave Pix vazia → alerta "Confira os campos do pagamento." e `onSubmit` não chamado.
- C8 (A8, unit): tela: `PAID_OFF`, `RENEWED`, `RENEGOTIATED`, `CANCELLED` → alerta e sem formulário; `WRITTEN_OFF` → formulário (decisão 4, RN-R09, RN-C20).

## Arquivos de teste previstos

- `apps/web/lib/payment-draft.test.ts` (pacote `@pilla/web`; camada unit)
- `apps/web/components/payment-form.test.tsx` (pacote `@pilla/web`; camada unit)
- e2e: nenhum (sem API nesta feature)

Metas de cobertura (cobradas pelos checks do `done`, não são critério): 100% de linhas e ramos de
`payment-draft.ts`, 85% de `payment-form.tsx`.

## Pendências

- Valor máximo do pagamento: pendência futura (pós-MVP); sem regra de negócio agora (decisão 1).
- Tamanho máximo da chave Pix de destino (`destinationKey`): não definido; o schema só exige texto não vazio após trim. Joel define
  o limite (e se o nome do campo muda) em outra feature.
- Texto do aviso de contrato fechado e status `DRAFT` (a RN-R09 não fala dele; hoje a tela o deixa aceitar): Joel
  confirma.
