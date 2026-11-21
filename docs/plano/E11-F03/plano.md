# E11-F03: confirmar pagamento

Plano da feature. Cartões: E11-T05 (testes, claude Opus) e E11-T06 (implementação, claude Sonnet). Referências: PRD-001 RF-21, RN-R01 a RN-R04, RN-R09, RN-C09, RN-C20, RN-T03, RFC-002 §3.6, RFC-004 §3, §6 e §7, ADR-0005, ADR-0006, `docs/plano/E10.md` D3, `docs/plano/E11.md` D3 a D10.

## Escopo

Entra:
- `POST /api/v1/payments/{id}/confirm`, com `If-Match: <version>` e corpo vazio. Em uma transação, com `FOR UPDATE` no pagamento e no contrato:
  1. confere PENDING_REVIEW (senão 409 `PAYMENT_NOT_PENDING`) e a versão (409 `VERSION_CONFLICT`);
  2. lê o contrato por `lending/public.loadLoanForPayment(..., {forUpdate: true})`. ACTIVE e WRITTEN_OFF seguem; DRAFT dá 409 `LOAN_NOT_ACTIVE` (o pagamento continua PENDING_REVIEW e confirma depois da ativação); PAID_OFF, RENEWED, RENEGOTIATED e CANCELLED dão 422 `LOAN_CLOSED_FOR_PAYMENTS`;
  3. recalcula a distribuição com `previewAllocation` (F01), `ref = paidAt`, usando as alocações já confirmadas (com o histórico da F07); valor acima do saldo agora dá 422 `PAYMENT_EXCEEDS_BALANCE`; `paidAt` anterior ao desembolso dá 422 em `paidAt`;
  4. grava uma linha em `payment_allocations` por parcela tocada;
  5. marca o pagamento CONFIRMED (`confirmed_at`, `confirmed_by`, `version + 1`); em WRITTEN_OFF grava `is_recovery = true`;
  6. se o contrato é ACTIVE e o saldo zerou, chama `lending/public.markLoanPaidOff(tx, ...)`: PAID_OFF, `status_changed_at`, auditoria e `LoanPaidOff` (`paidOffAt = paidAt`) (RN-C09, E10 D3). Em WRITTEN_OFF o contrato continua baixado (RN-C20);
  7. grava a auditoria e os eventos no `core.outbox`: `PaymentConfirmed`, e uma `InstallmentPaid` por parcela que passou a PAID (D10).
- Resposta 200 `paymentResponse` (com `allocations` e o `loanStatus` depois da operação).
- A porta `lending/public` ganha `markLoanPaidOff`, que usa a transição já existente em `lending/domain`.

Fora: lançamento no ledger (consumidor da tesouraria, E12); estorno (F04); descartar pendente (pergunta aberta); cálculo dos encargos após parcial (F07, pré-requisito desta feature).

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `id` | UUID | - | - | "x" | 400; inexistente 404 | RFC-004 §2 |
| `If-Match` | `3` ou `"3"` | 1 | - | ausente, "abc" | como `loans.controller` (E10 D9); versão diferente 409 `VERSION_CONFLICT` | RFC-004 §2 |
| corpo | vazio | - | - | qualquer chave | 400 | schema estrito |

## Critérios de aceite
- A1: confirmar grava uma alocação por parcela tocada, com a distribuição de `previewAllocation` na data do pagamento.
- A2: o pagamento vira CONFIRMED com `confirmedAt`, `confirmedBy` e `version + 1`.
- A3: `GET /loans/{id}` passa a mostrar `paidCents` e `outstandingCents` menores (RN-R01).
- A4: a soma das alocações é o valor do pagamento (RN-T03).
- A5: a distribuição confirmada é a mesma da prévia para o mesmo estado do contrato.
- A6: um `PaymentConfirmed` válido em `paymentConfirmedV1`, na mesma transação.
- A7: uma `InstallmentPaid` por parcela que virou PAID, com `daysLate`.
- A8: auditoria gravada.
- A9: saldo zero leva o contrato ACTIVE a PAID_OFF, com `status_changed_at`, auditoria e `LoanPaidOff`.
- A10: pagamento parcial mantém ACTIVE.
- A11: pagar o valor da cotação de quitação (E10) quita o contrato.
- A12: confirmar pagamento de contrato DRAFT dá 409 `LOAN_NOT_ACTIVE`; o pagamento fica PENDING_REVIEW.
- A13: depois da ativação o mesmo pagamento confirma e aloca (decisão de 20/11).
- A14: em WRITTEN_OFF a confirmação grava `isRecovery` true, aloca e o contrato continua WRITTEN_OFF, sem `LoanPaidOff`.
- A15: pagamento que não está PENDING_REVIEW dá 409 `PAYMENT_NOT_PENDING`.
- A16: versão errada dá 409 `VERSION_CONFLICT`.
- A17: valor acima do saldo no momento da confirmação dá 422 `PAYMENT_EXCEEDS_BALANCE`.
- A18: contrato fechado nesse meio-tempo dá 422 `LOAN_CLOSED_FOR_PAYMENTS`.
- A19: `paidAt` anterior ao desembolso dá 422.
- A20: nenhuma recusa grava algo e o pagamento continua PENDING_REVIEW.
- A21: duas confirmações simultâneas cuja soma excede o saldo: uma passa e a outra recebe 422; nenhuma parcela fica alocada a mais.

## Casos de teste
- C1 a C7: alocação (uma parcela, várias, parcial, com encargos, ordem, leitura do detalhe, soma).
- C8 a C11: eventos, auditoria e atomicidade (falha no meio não deixa linha).
- C12 a C14: PAID_OFF (zera, parcial, igual à cotação).
- C15, C16: DRAFT recusado e depois confirmado após ativar.
- C17: recuperação em WRITTEN_OFF.
- C18 a C24: recusas.
- C25: concorrência (PGlite, duas confirmações; `confirm-concurrency.test.ts`).

## Riscos
- Dinheiro alocado em dobro: travas `FOR UPDATE` e teste C25.
- Ordem de confirmação diferente da ordem de `paidAt`: a distribuição vale para o estado no instante da confirmação (D5); o histórico da F07 trata a ordem por `paidAt`.
- `markLoanPaidOff` deixa `lending` e `payments` na mesma transação: aceito no MVP (D4); revisar quando houver consumidor de outbox.

## Dependências
- F02 (registro), F07 (encargos com histórico), E10-T08 (cronograma) e E10-T10 (leituras).
