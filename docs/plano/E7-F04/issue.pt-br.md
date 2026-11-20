# [E7-F04] Registre um pagamento com uma chave Pix de destino

<!-- ada-feature:E7-F04 -->

> Entrega **E7** · Etapa: done · Progresso: 100%
> Gerado dos docs do repositório; não edite à mão (o próximo sync sobrescreve).

## Resumo e escopo

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

## Regras e critérios

- **RF-20** ADMIN registra pagamento: contrato, data, valor, método (PIX, BOLETO, ESPÉCIE, TRANSFERÊNCIA), conta de destino. Comprovante (arquivo): **v1.1**, fora do MVP ([decisoes-2026-11-19](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-19.md) §3).

- **RN-R09** Contratos QUITADO, RENOVADO, RENEGOCIADO e CANCELADO **não aceitam pagamento**. A mensagem indica o contrato sucessor, quando houver. Exceção: BAIXADO_PERDA (RN-C20).

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
- saída: nos quatro fechados, alerta "Contrato encerrado" com o aviso do status e nenhum campo nem botão de envio; `onSubmit` não é chamado; em `WRITTEN_OFF` e `ACTIVE` o formulário aparece
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

## Cartões

### E7-T11 — Escreva os testes para toPaymentDraft

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: nenhuma
- Referências: [PRD-001 RF-20](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-004 §2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md), [docs/plano/decisoes-2026-11-19.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-19.md)
- Ler antes: `apps/web/lib/payment-draft.ts`, `packages/schemas/src/api/payments/create-payment.ts`, `packages/schemas/src/common.ts`, `packages/finance/src/index.ts`, `packages/finance/src/money.ts`
- Skills: `escrever-teste`

**DoD (definição de pronto)**
- todos os testes falham agora contra o stub em HEAD e passariam com uma implementação correta (run_check 0)
- import { describe, expect, it } from "vitest";
- import { MoneyError } from "@pilla/finance";
- import { ZodError } from "zod";
- import type { PaymentFormValues } from "./payment-draft";
- import { toPaymentDraft } from "./payment-draft";
- teste "constrói o pagamento RFC-004": o exemplo fornece o pagamento das dicas, amountCents 115000, método "PIX", sem chave de comprovante (RFC-004 §5, PRD-001 RF-20)
- teste "aceita os quatro métodos": o exemplo com "PIX", "BOLETO", "CASH" e "BANK_TRANSFER" fornece o mesmo pagamento para cada método e nunca lança erro (decisão do Joel de 19/11: sem comprovante)
- teste "rejeita um valor inválido": amount "1150" e "1.150,5" lançam MoneyError, e "0,00" e "-5,00" lançam ZodError (RFC-004 §2)
- teste "rejeita uma data, conta e empréstimo inválidos": paidAt "2026-02-30", destinationKey "" e loanId "abc" lançam ZodError (PRD-001 RF-20)
- teste "não limita a data nem o valor": paidAt "2099-01-01" e "2000-01-01" e amount "90.000.000,00" fornecem o pagamento sem erro (decisões do Joel de 19/11: sem restrição de data nem valor máximo no MVP)
- nunca editar apps/web/lib/payment-draft.ts
- Pode alterar: `apps/web/lib/payment-draft.test.ts`
- Verificações:
  - `! pnpm --filter @pilla/web exec vitest run lib/payment-draft.test.ts`
  - `node scripts/check-test-quality.mjs apps/web/lib/payment-draft.test.ts`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- as linhas de import do done são os únicos imports do arquivo, cada nome nelas é utilizado, e nada mais é importado
- um write_file de todo o arquivo de teste, em seguida run_check 0, 1, 2 e 3
- no topo do describe, duas consts: loanId "01936f8e-7b2c-7cde-8f00-000000000002" e example tipado PaymentFormValues com destinationKey "chave-pix@exemplo.com", paidAt "2026-12-13", amount "1.150,00" e method "PIX"
- a chamada é toPaymentDraft(loanId, values) com dois argumentos e nenhum arquivo; retorna PaymentFields diretamente, não um objeto com payment e receipt
- o pagamento do primeiro teste, verificado com toStrictEqual, é { loanId: "01936f8e-7b2c-7cde-8f00-000000000002", destinationKey: "chave-pix@exemplo.com", paidAt: "2026-12-13", amountCents: 115000, method: "PIX" }
- a anotação de tipo mantém o método PIX sem ampliar para string, e PaymentMethod é PIX, BOLETO, CASH ou BANK_TRANSFER
- PaymentFields é inferido a partir do zod, veja common.ts, portanto amountCents é um literal numérico simples, nunca bigint
- no teste sem limite, o valor "90.000.000,00" resulta em amountCents 9000000000, um literal numérico simples
- cada chamada inválida está dentro de uma função fornecida ao expect, e toThrow aceita apenas a classe, MoneyError ou ZodError, nunca um objeto
- o teste do método pode usar um it com os quatro métodos escritos explicitamente como quatro chamadas (sem loop), cada uma verificada com toStrictEqual

### E7-T12 — Implementar toPaymentDraft

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T11`
- Referências: [PRD-001 RF-20](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-004 §2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [ADR-0013](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0013-estado-no-frontend.md), [docs/plano/decisoes-2026-11-19.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-19.md)
- Ler antes: `apps/web/lib/payment-draft.ts`, `apps/web/lib/payment-draft.test.ts`, `packages/schemas/src/api/payments/create-payment.ts`, `packages/finance/src/index.ts`
- Skills: `editar-arquivo`, `coding-guidelines`

**DoD (definição de pronto)**
- todos os testes em apps/web/lib/payment-draft.test.ts passam com 100% de cobertura de linha e ramo de payment-draft.ts (run_check 0)
- a linha de import type de payment-draft.ts permanece, e as únicas importações de valor são estas duas linhas
- import { parseReais } from "@pilla/finance";
- import { paymentFieldsSchema } from "@pilla/schemas";
- toPaymentDraft(loanId: string, values: PaymentFormValues): PaymentFields envia o valor por meio de parseReais e os campos por meio de paymentFieldsSchema.parse, sem verificação da data e sem limite máximo de valor
- manter os tipos, a assinatura e os comentários /** */ inalterados, exceto que os parâmetros perdem o sublinhado inicial
- payment-draft.ts não possui a linha '// @stub E7-T12' e apps/web/vitest.config.ts não possui uma linha que exclui lib/payment-draft.ts
- Pode alterar: `apps/web/lib/payment-draft.ts`, `apps/web/vitest.config.ts`
- Testes protegidos: `apps/web/lib/payment-draft.test.ts`
- Verificações:
  - `pnpm --filter @pilla/web exec vitest run lib/payment-draft.test.ts --coverage --coverage.include=lib/payment-draft.ts --coverage.exclude=none --coverage.thresholds.lines=100 --coverage.thresholds.branches=100`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- parseReais converte para centavos (bigint) e Number transforma-o no número esperado pelo esquema
- o resultado é o objeto { loanId, destinationKey, paidAt, amountCents, method } passado através de paymentFieldsSchema.parse, que o retorna
- não adicione regra de data nem de valor máximo, apenas o que paymentFieldsSchema já faz
- um write_file para payment-draft.ts, em seguida um edit_file para apps/web/vitest.config.ts que remove a linha com o stub E7-T12, e depois run_check 0, 1 e 2

### E7-T13 — Escreva os testes para o componente PaymentForm

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T12`
- Referências: [PRD-001 RF-20](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RN-R09](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md), [docs/plano/decisoes-2026-11-19.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-19.md)
- Ler antes: `apps/web/components/payment-form.tsx`, `apps/web/lib/payment-draft.ts`, `apps/web/lib/mock-data.ts`, `apps/web/lib/labels.ts`, `packages/schemas/src/api/payments/create-payment.ts`, `packages/schemas/src/common.ts`, `apps/web/app/page.test.tsx`, `apps/web/vitest.setup.ts`
- Skills: `escrever-teste`, `accessibility`

**DoD (definição de pronto)**
- todos os testes falham agora contra o stub em HEAD e passariam com uma implementação correta (run_check 0)
- import { fireEvent, render, screen } from "@testing-library/react";
- import { describe, expect, it } from "vitest";
- import { vi } from "vitest";
- import { exampleLoanDetail } from "@/lib/mock-data";
- import { PaymentForm } from "./payment-form";
- test "exibe o empréstimo e os campos": h1 e botão "Registrar pagamento", "Contrato 2026-0012", "Saldo devedor R$ 4.600,00" e as 4 labels das dicas, sendo "Chave Pix de destino" um campo de texto, sem "Comprovante" (RFC-004 §5, PRD-001 RF-20)
- test "registra o pagamento RFC-004": o exemplo fornece o status "Pagamento registrado para conferência." e onSubmit recebe o pagamento das dicas (RFC-004 §5, PRD-001 RF-20)
- test "aceita dinheiro vivo": o exemplo com Método "CASH" fornece a mesma solicitação de pagamento ao onSubmit com método "CASH", sem solicitar recibo (decisão do Joel de 19/11: sem comprovante)
- test "rejeita um valor incorreto ou uma chave Pix vazia": Valor "1150" e Chave Pix de destino vazia, cada um gera o alerta "Confira os campos do pagamento." e onSubmit não é chamado (decisões do Joel de 17/11)
- test "bloqueia um contrato encerrado": com status "PAID_OFF", "RENEWED", "RENEGOTIATED" e "CANCELLED", a tela exibe o alerta "Este contrato não aceita pagamento." e não possui o campo Valor nem o botão "Registrar pagamento", e onSubmit não é chamado (PRD-001 RN-R09, decisão do Joel de 19/11: a tela bloqueia o formulário)
- test "mantém o formulário para um contrato aberto": com status "WRITTEN_OFF", os campos Valor e o botão "Registrar pagamento" estão na tela e não há tal alerta (PRD-001 RN-C20)
- nunca editar apps/web/components/payment-form.tsx
- Pode alterar: `apps/web/components/payment-form.test.tsx`
- Verificações:
  - `! pnpm --filter @pilla/web exec vitest run components/payment-form.test.tsx`
  - `node scripts/check-test-quality.mjs apps/web/components/payment-form.test.tsx`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- as linhas de import do done são os únicos imports do arquivo, cada nome nelas é utilizado, e nada mais é importado
- um write_file de todo o arquivo de teste, em seguida run_check 0, 1, 2 e 3
- render PaymentForm com o exemplo de empréstimo exampleLoanDetail e onSubmit como uma const criada com vi.fn, uma vez por teste; não há prop accounts e nem mockAccounts
- os quatro labels são Chave Pix de destino, Data do pagamento, Valor e Método, cada um encontrado com getByLabelText; Comprovante é verificado com queryByLabelText e retorna null
- um helper preenche o exemplo usando fireEvent.change em screen.getByLabelText: Chave Pix de destino recebe chave-pix@exemplo.com digitado como texto, Data do pagamento recebe 2026-12-13 e Valor recebe 1.150,00, e Método já começa em PIX
- o pagamento esperado é { loanId: "01936f8e-7b2c-7cde-8f00-000000000002", destinationKey: "chave-pix@exemplo.com", paidAt: "2026-12-13", amountCents: 115000, method: "PIX" }, um PaymentFields sem comprovante
- um empréstimo encerrado é { ...exampleLoanDetail, status: "PAID_OFF" } e assim por diante, com o status literal; escreva os quatro renders um após o outro, um para cada status
- o select Método usa as chaves de paymentMethodLabel como valores das opções, portanto o teste de caixa altera-o para CASH, cujo texto da opção é Espécie
- Registrar pagamento é tanto o h1 quanto o botão, logo o cabeçalho é getByRole com heading de nível 1 e aquele nome, o clique é fireEvent.click em getByRole button com aquele nome, nunca getByText
- os números esperados são do tipo plain number, nunca bigint
- o submit é assíncrono, portanto aguarde o screen.findByRole com o papel status ou alert, mantenha esse elemento e verifique-o com toHaveTextContent, nunca aguarde um promise findBy no expect, e as verificações de onSubmit devem ocorrer após isso
- a tela bloqueada não é assíncrona, portanto getByRole alert é suficiente ali
- apps/web/app/page.test.tsx é o modelo, e não há userEvent no projeto, apenas @testing-library/react

### E7-T14 — Implemente o componente PaymentForm

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T13`
- Referências: [PRD-001 RF-20](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RN-R09](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [ADR-0013](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0013-estado-no-frontend.md), [docs/plano/decisoes-2026-11-19.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-19.md)
- Ler antes: `apps/web/components/payment-form.tsx`, `apps/web/components/payment-form.test.tsx`, `apps/web/lib/payment-draft.ts`, `apps/web/lib/labels.ts`, `packages/finance/src/index.ts`
- Skills: `editar-arquivo`, `react-best-practices`, `react-best-practices#rerender-derived-state-no-effect`

**DoD (definição de pronto)**
- todos os testes em apps/web/components/payment-form.test.tsx passam com pelo menos 85% de cobertura de payment-form.tsx (run_check 0)
- as linhas de import type de @pilla/schemas e react permanecem, a linha de import type de @/lib/payment-draft é 'import type { PaymentFormValues } from "@/lib/payment-draft";', e os únicos imports de valor são os outros quatro
- import { cents, formatReais } from "@pilla/finance";
- import { useState } from "react";
- import { useForm } from "react-hook-form";
- import { paymentMethodLabel } from "@/lib/labels";
- import { toPaymentDraft } from "@/lib/payment-draft";
- o formulário utiliza o useForm do react-hook-form tipado com PaymentFormValues e registra cada um dos quatro campos; Chave Pix de destino é um campo de texto, não uma seleção, e não há campo Comprovante
- o submit chama toPaymentDraft(loan.id, values) dentro de blocos try e catch; qualquer erro exibe o alerta "Confira os campos do pagamento." e onSubmit não é chamado
- quando loan.status é PAID_OFF, RENEWED, RENEGOTIATED ou CANCELLED (PRD-001 RN-R09), o componente retorna o título, as linhas de contrato e saldo e o alerta "Este contrato não aceita pagamento" sem formulário nem botão; ACTIVE, WRITTEN_OFF e DRAFT exibem o formulário
- manter "use client", a interface de props (loan e onSubmit opcional, sem contas), a assinatura e o comentário /** */ inalterados, exceto que os props são destruturados sem aliases com sublinhado
- payment-form.tsx não possui a linha '// @stub E7-T14' e apps/web/vitest.config.ts não possui linha que exclui components/payment-form.tsx
- Pode alterar: `apps/web/components/payment-form.tsx`, `apps/web/vitest.config.ts`
- Testes protegidos: `apps/web/components/payment-form.test.tsx`
- Verificações:
  - `pnpm --filter @pilla/web exec vitest run components/payment-form.test.tsx --coverage --coverage.include=components/payment-form.tsx --coverage.exclude=none`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- os rótulos, o campo de texto, as opções do select, o botão e as mensagens estão escritos no comentário /** */ de payment-form.tsx; copie-os de lá
- "Contrato 2026-0012" e "Saldo devedor R$ 4.600,00" são cada um o texto completo de um elemento, pois o teste os localiza com getByText
- cents recebe um bigint e formatReais recebe Cents, portanto outstandingCents passa por BigInt e depois por cents
- a verificação do status fechado é uma lista const dos quatro statuses fechados e o loan.status é testado contra ela, sendo derivada durante o renderização, sem efeito e sem estado
- as opções de Método provêm das chaves de paymentMethodLabel de @/lib/labels
- mantenha o resultado em useState e chame a onSubmit opcional com encadeamento opcional
- um write_file de payment-form.tsx, em seguida um edit_file de apps/web/vitest.config.ts que remove a linha com o stub E7-T14, e depois run_check 0, 1 e 2

## Referências

- PRD: [docs/prd/PRD-001-mvp-gestao-emprestimos.md](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md)
- [RFC-004 §2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md)
- [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md)
- [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- [docs/plano/decisoes-2026-11-19.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-19.md)
- [ADR-0013](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0013-estado-no-frontend.md)
- plano.md: [docs/plano/E7-F04/plano.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F04/plano.md)
- revisao.md: [docs/plano/E7-F04/revisao.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F04/revisao.md)
- testes.md: [docs/plano/E7-F04/testes.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F04/testes.md)

## Telas

_Sem telas._

## Estado

- Etapa: done
- Progresso: 100%
- Bloqueio: não
- `E7-T11`: done
- `E7-T12`: done
- `E7-T13`: done
- `E7-T14`: done
