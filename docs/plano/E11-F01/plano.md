# E11-F01: prévia da alocação e porta de leitura do contrato

Plano da feature. Cartões: E11-T01 (testes, claude) e E11-T02 (implementação, baidu, com Sonnet de reserva). Referências: PRD-001 RF-23, RN-R02 a RN-R05 e RN-R09, RFC-001 M2, RFC-002 §3.6, RFC-004 §3 e §6, ADR-0005, `docs/plano/E11.md` D1, D3, D5, D6 e D7.

## Escopo

Entra:
- `POST /api/v1/payments/allocation-preview` (`allocationPreviewRequest` já existe: `loanId`, `amountCents`, `paidAt`). Não grava nada.
- Resposta nova `allocationPreviewResponse` em `allocation-preview.ts`:
  - `loanId`, `loanStatus`, `paidAt`, `amountCents`;
  - `deferred` (true em DRAFT: a distribuição só existe na confirmação);
  - `isRecovery` (true em WRITTEN_OFF);
  - `allocations[]`: `installmentNumber`, `dueDate`, `lateChargesCents`, `interestCents`, `principalCents`, `installmentStatusAfter` (`PAID` ou `PARTIAL`);
  - `totals`: `lateChargesCents`, `interestCents`, `principalCents` (a soma é `amountCents`);
  - `outstandingBeforeCents`, `outstandingAfterCents` (nulos quando `deferred`);
  - `paysOff` (o saldo zera; sempre false em DRAFT e em WRITTEN_OFF).
- Caso de uso `previewAllocation` em `payments/application`, que a F02 e a F03 reaproveitam: parcelas em aberto = parcelas do contrato menos as alocações confirmadas, `allocatePayment` com `ref = paidAt`, encargos pelas condições copiadas no contrato (ADR-0008).
- Porta de leitura `apps/api/src/lending/public/loan-for-payment.ts`:
  - `loadLoanForPayment(db, loanId, opts?: {forUpdate?: boolean}): Promise<PaymentLoan | null>`;
  - `PaymentLoan`: `id`, `loanNumber`, `personId`, `status` (`LoanStatus` de `lending/domain`), `accountId`, `disbursedAt`, `successorLoanId` (contrato cujo `origin_loan_id` é este), `lateTerms` (`LateTerms` de `@pilla/finance`), `installments[]` (`id`, `number`, `dueDate`, `principalCents`, `interestCents`);
  - `findLoanNumbers(db, ids): Promise<Map<string, string>>` (para as listas).
  - Tipos simples, sem linha do Drizzle; o leitor fica em `lending/infra/payment-loan-reader.ts`.
- `PaymentsModule` e `PaymentsController` (rota `payments`), registrados no `app.module.ts`.

Fora: gravar pagamento (F02), qualquer escrita em `lending` (F03/F04), histórico de pagamentos para os encargos (F07: a prévia passa a ser exata depois dela, mas só há alocações confirmadas a partir da F03).

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `loanId` | UUID | - | - | "x", "" | 400 `VALIDATION_FAILED`; contrato inexistente 404 `NOT_FOUND` | RFC-004 §2 |
| `amountCents` | inteiro positivo | 1 | saldo devedor em `paidAt` (ACTIVE, WRITTEN_OFF) | 0, -1, 10.5, "100" | 400; acima do saldo 422 `PAYMENT_EXCEEDS_BALANCE` | ADR-0004, RN-R03 |
| `paidAt` | `AAAA-MM-DD` | `disbursedAt` (fora de DRAFT) | hoje em Brasília | "2026-13-01", data futura, anterior ao desembolso | 400 ou 422 `VALIDATION_FAILED` no campo `paidAt` | RN-E02, E10 D11 |

## Critérios de aceite
- A1: a parcela mais antiga em aberto recebe primeiro; dentro dela, encargos, depois juros, depois principal (RN-R02).
- A2: a sobra passa para a parcela seguinte.
- A3: pagamento menor que a parcela deixa `installmentStatusAfter` PARTIAL (RN-R04); pagamento antes do vencimento é normal, sem desconto (RN-R05).
- A4: a soma de `allocations` e de `totals` é `amountCents`.
- A5: `outstandingBeforeCents` e `outstandingAfterCents` batem com `outstandingBalance` de `@pilla/finance` em `paidAt`.
- A6: `paysOff` é true só quando o pagamento zera o saldo.
- A7: valor acima do saldo dá 422 `PAYMENT_EXCEEDS_BALANCE`.
- A8: PAID_OFF, RENEWED, RENEGOTIATED e CANCELLED dão 422 `LOAN_CLOSED_FOR_PAYMENTS`.
- A9: o 422 acima traz `successorLoanId` quando há contrato sucessor.
- A10: `paidAt` anterior ao desembolso ou futura dá 422 `VALIDATION_FAILED` em `paidAt`.
- A11: contrato inexistente dá 404; nada é gravado em nenhum caso (payments, outbox, auditoria).
- A12: DRAFT responde 200 com `deferred` true, `allocations` vazio e saldos nulos.
- A13: WRITTEN_OFF responde 200 com `isRecovery` true.
- A14: o schema de resposta é feito só de inteiros e recusa totais que não somam `amountCents`.

## Casos de teste
- C1 a C6: distribuição (uma parcela, parcial, transborda para a seguinte, parcela vencida com encargos, pagamento adiantado, ordem por vencimento).
- C7, C8: saldos antes e depois; `paysOff`.
- C9 a C14: recusas (acima do saldo, quatro status fechados com e sem sucessor, data, contrato inexistente), cada uma conferindo que nada foi gravado.
- C15, C16: DRAFT e WRITTEN_OFF.
- C17, C18: schema.

## Riscos
- Dependência circular entre `lending` e `payments`: `payments` só importa `lending/public`; o depcruise é o teste.
- A prévia e a confirmação divergirem: a F03 reusa `previewAllocation`; o teste da F03 compara os dois.
