# E13-F02A: painel de alertas, blocos de parcelas (contrato completo)

Plano da feature. Cartões: E13-T08 (testes de schema, bia), E13-T03 (testes HTTP, claude) e E13-T04 (implementação, baidu). Referências: PRD-001 RF-50, RN-E01 a RN-E03, ADR-0004, ADR-0005, RFC-002 §3.5, RFC-004 §3, `docs/plano/E10-F05/plano.md`, `docs/plano/E10.md` D5 e D11, `docs/plano/E13.md` D1 a D4 e D7.

## Escopo

Entra:
- `GET /api/v1/dashboard/today` (RFC-004 §3): sem parâmetros; a data de referência é hoje em Brasília (E10 D11).
- Quatro blocos no contrato `dashboardTodayResponse`; a F02A calcula três (`dueToday`, `dueThisWeek`, `overdue`) e devolve o quarto (`pendingReview`) como `{count: 0, totalCents: 0, items: []}` fixo. A F02B só troca o fixo (D2).
- Fonte: contratos ACTIVE, suas parcelas e as alocações confirmadas, pelo mesmo `assessLoan` e `@pilla/finance` da E10-F05. Nada é gravado (ADR-0005); sem rotina diária (D4).
- Só entram parcelas com valor em aberto maior que zero (principal + juros ainda não alocados) de contratos ACTIVE.
- Reaproveita a regra da E10-F05: OVERDUE logo após o vencimento; carência só isenta encargos de mora (padrão 0); mora só sobre o saldo em aberto.

Fora: pendentes de conferência (F02B); paginação (D7); qualquer escrita; `loan_positions`.

## Contrato

Arquivo `packages/schemas/src/api/lending/dashboard-today.ts`. Dinheiro em centavos inteiros (ADR-0004). Todos `strictObject`.

```ts
dueInstallmentItem = {
  loanId, loanNumber, personId, personName,
  installmentNumber: int > 0,
  dueDate: isoDate,
  openCents: cents,            // principal + juros em aberto da parcela
  status: "OPEN" | "PARTIAL",
}
overdueInstallmentItem = {
  loanId, loanNumber, personId, personName,
  installmentNumber, dueDate,
  openCents,
  daysOverdue: int >= 1,       // hoje - vencimento, em dias
  lateChargesCents: cents,     // multa + mora na data, sobre o saldo em aberto
  totalDueCents: cents,        // openCents + lateChargesCents
  status: "OVERDUE" | "OVERDUE_PARTIAL",
}
pendingReviewItem = {          // preenchido na F02B
  paymentId, loanId, loanNumber, personName,
  loanStatus: loanStatusSchema,
  amountCents: positiveCents,
  paidAt: isoDate,
  method: "PIX" | "BOLETO" | "CASH" | "BANK_TRANSFER",
  createdAt: instant,
}
block<T> = { count: int >= 0, totalCents: cents, items: T[] }
dashboardTodayResponse = {
  referenceDate: isoDate,      // hoje em Brasília
  weekEndDate: isoDate,        // referenceDate + 7 dias
  dueToday: block<dueInstallmentItem>,
  dueThisWeek: block<dueInstallmentItem>,
  overdue: block<overdueInstallmentItem>,
  pendingReview: block<pendingReviewItem>,
}
```

Totais: `dueToday` e `dueThisWeek`, soma de `openCents`; `overdue`, soma de `totalDueCents`; `pendingReview`, soma de `amountCents`. `count` = `items.length`.

## Regras

| Bloco | Regra | Fonte |
|---|---|---|
| `dueToday` | vencimento = hoje | RF-50 |
| `dueThisWeek` | hoje < vencimento ≤ hoje + 7 dias (pendência E13-F02A, padrão a) | RF-50 |
| `overdue` | vencimento < hoje e em aberto > 0 | RF-50, RN-E01 |
| encargos | `lateChargesAt` na data de hoje, saldo em aberto | RN-E01, RN-E02, RFC-002 §3.5 |
| ordem | `dueToday` por número do contrato; `dueThisWeek` por vencimento; `overdue` por `daysOverdue` desc; empate: contrato, depois parcela | decisão desta feature |

## Domínio da entrada
Sem entrada externa (sem parâmetros, corpo nem query). Parâmetro desconhecido na query é ignorado, como nas demais consultas da E10.

## Critérios de aceite
- A1: parcela em aberto com vencimento hoje está em `dueToday`.
- A2: vencimento amanhã e em hoje + 7 estão em `dueThisWeek`; hoje + 8 não está em nenhum.
- A3: vencimento ontem está em `overdue`.
- A4: parcela PAID e parcelas de contrato fora de ACTIVE não aparecem.
- A5: `openCents` desconta as alocações confirmadas; pagamento parcial muda o status para PARTIAL/OVERDUE_PARTIAL.
- A6: `count` e `totalCents` batem com os itens.
- A7: `daysOverdue` é hoje menos o vencimento.
- A8: `lateChargesCents` bate com `@pilla/finance` na data, sobre o saldo em aberto; com carência 0, 1 dia de atraso já tem encargos.
- A9: com carência 3, a parcela está em `overdue` com `lateChargesCents` 0 até o dia 3; `totalDueCents` = `openCents` + encargos.
- A13: a ordem dos blocos segue a tabela de regras.
- A14: `pendingReview` sai `{count 0, totalCents 0, items []}`, mesmo com pagamentos PENDING_REVIEW no banco.
- A15: nenhuma linha é gravada; banco vazio responde 200 com quatro blocos vazios.
- A10 a A12 (schema): forma da resposta, itens obrigatórios por bloco, chaves desconhecidas e decimais rejeitados; o `pendingReview` vazio é válido.

## Casos de teste
- C1 a C8: classificação por bloco e status do contrato.
- C9 a C13: valores em aberto, parcial, totais.
- C14 a C19: atraso, dias, encargos, carência 0 e 3, total a pagar.
- C20 a C22: ordem.
- C23: marcador do `pendingReview` fixo.
- C24: nada gravado e banco vazio.
- C17 a C26 (schema, cartão E13-T08): forma, obrigatórios, estrito, inteiros.

## Arquivos de produção
- `packages/schemas/src/api/lending/dashboard-today.ts` (novo) e `packages/schemas/src/index.ts`.
- `apps/api/src/lending/application/` (agrupador do painel; exporta o auxiliar de parcela em aberto de `loan-assessment.ts`).
- `apps/api/src/lending/infra/loan-queries.ts`: `selectActiveLoans`.
- `apps/api/src/lending/http/dashboard.controller.ts` (novo) e `lending.module.ts`.

## Classificação TDD
Todos TDD. Sem dispensa. O controller só delega; o agrupador é função pura sobre `assessLoan` e a data.
