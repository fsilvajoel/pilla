# E11-F04: estornar pagamento e rejeitar pendente

Plano da feature. Cartões: E11-T07 (testes, claude Sonnet) e E11-T08 (implementação, baidu, com Sonnet de reserva); E11-T16 (testes de rejeitar) e E11-T17 (implementação, claude Sonnet). Referências: PRD-001 RF-22, RN-R07, RN-R10 e RN-R11, RFC-004 §3, §6 e §7, RFC-005 §5, ADR-0006, `docs/plano/pendencias-pm.md`, `docs/plano/decisoes-2026-11-19.md` §4, `docs/plano/E11.md` D3, D4, D8, D10 e D12.

## Escopo

Entra:
- `POST /api/v1/payments/{id}/reverse` com `{reason}` (`reversePaymentRequest`, já existe) e `If-Match`. Em uma transação, com `FOR UPDATE` no pagamento e no contrato:
  1. confere CONFIRMED (senão 409 `PAYMENT_NOT_CONFIRMED`) e a versão;
  2. contrato RENEWED ou RENEGOTIATED: 422 `REVERSAL_BLOCKED_BY_SUCCESSOR` (RN-R11, `isReversalBlocked`);
  3. marca `reversed_at` em todas as alocações do pagamento e o pagamento como REVERSED (`reversed_at`, `reversed_by`, `reversal_reason`, `version + 1`); nada é apagado nem editado (RN-R07, ADR-0006);
  4. se o contrato é PAID_OFF e depois do estorno sobra principal ou juros em aberto, chama `lending/public.reopenLoan(tx, ...)`: ACTIVE, `status_changed_at`, auditoria e `LoanReopened` com o motivo (RN-R10, `reopensOnReversal`). Contrato ACTIVE ou WRITTEN_OFF não muda de status;
  5. auditoria e `PaymentReversed` (as alocações do pagamento, o motivo) no `core.outbox`.
- Resposta 200 `paymentResponse` (REVERSED, `allocations` vazio, `loanStatus` depois da operação).
- A porta `lending/public` ganha `reopenLoan`.

Fora: lançamento REVERSAL na tesouraria (E12); estornar pagamento PENDING_REVIEW (não existe estorno de pendente; o descarte é a rejeição abaixo); ajuste manual no sucessor (RN-R11, fora do MVP).

## Rejeitar pagamento pendente (E11-T16 e E11-T17)

Decisão do Joel (21/11, `pendencias-pm.md`): o pendente lançado por engano (valor, data ou contrato errado) é descartado com motivo, não editado.

Entra:
- `POST /api/v1/payments/{id}/reject` com `{reason}` (`rejectPaymentRequest`, mesmo `reasonSchema` do estorno) e `If-Match`. Em uma transação, com `FOR UPDATE` no pagamento: confere PENDING_REVIEW (senão 409 `PAYMENT_NOT_PENDING`) e a versão; grava status REJECTED, `rejected_at`, `rejected_by`, `rejection_reason` e `version + 1`; grava a auditoria com o motivo.
- Sem efeito financeiro: nenhuma alocação, nenhum evento no `core.outbox`, nenhuma mudança no contrato, na pessoa ou na tesouraria (RN-R01).
- REJECTED é estado final e a linha fica (imutabilidade, ADR-0006): não confirma, não estorna (409 `PAYMENT_NOT_CONFIRMED`) e não volta a pendente. Sai da fila de conferência (`listPendingReviewPayments` só devolve PENDING_REVIEW) e aparece em `GET /payments?status=REJECTED`.
- Migração em `apps/api/migrations/payments`: colunas `rejected_at`, `rejected_by`, `rejection_reason` e `payments_status_check` com os quatro status (RFC-005 §5). `paymentStatusSchema` ganha REJECTED. RFC-004 §3 e §6 e RFC-005 §5 já estão atualizadas.

Critérios de aceite:
- A1: o pendente vira REJECTED com `rejectedAt`, `rejectedBy`, `rejectionReason` e `version + 1`; resposta 200 `paymentResponse` com `allocations` vazio.
- A2: auditoria gravada com o motivo; a linha continua em `GET /payments?status=REJECTED`.
- A3: nenhuma alocação, nenhum evento no outbox; o detalhe do contrato (`paidCents`, `outstandingCents`, status) fica idêntico, inclusive em DRAFT.
- A4: o pagamento sai de `listPendingReviewPayments` (`count` e `totalCents` caem) e não confirma depois (409 `PAYMENT_NOT_PENDING`).
- A5: CONFIRMED, REVERSED ou já REJECTED dá 409 `PAYMENT_NOT_PENDING`; estornar REJECTED dá 409 `PAYMENT_NOT_CONFIRMED`.
- A6: versão errada dá 409 `VERSION_CONFLICT`; motivo ausente ou em branco dá 400 `VALIDATION_FAILED`; inexistente dá 404; nenhuma recusa grava algo.
- A7: o banco aceita REJECTED e continua recusando outro valor em `payments_status_check`.
- A8: `rejectPaymentRequest` exige `reason` e recusa chaves desconhecidas.

Casos de teste (E11-T16): C1 a C8 rejeição e ausência de efeito; C9 fila e confirmação posterior; C10 a C16 recusas; C17, C18 check do banco; C19, C20 schema.

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `id` | UUID | - | - | "x" | 400; inexistente 404 | RFC-004 §2 |
| `If-Match` | versão inteira | 1 | - | ausente | como E10 D9; diferente 409 `VERSION_CONFLICT` | RFC-004 §2 |
| `reason` | texto (`reasonSchema` de `common`) | 1 caractere útil | limite do `reasonSchema` | "", "   " | 400 `VALIDATION_FAILED` | RF-22, ADR-0006 |

## Critérios de aceite
- A1: o estorno deixa o pagamento REVERSED com `reversedAt`, `reversedBy`, `reversalReason` e `version + 1`.
- A2: todas as alocações dele recebem `reversed_at`; nenhuma linha some.
- A3: o detalhe do contrato volta ao estado anterior à confirmação (parcelas e `outstandingCents`).
- A4: auditoria gravada.
- A5: o estorno de um pagamento que não é o último é aceito e as alocações dos demais ficam como estão.
- A6: contrato ACTIVE ou WRITTEN_OFF não muda de status.
- A7: um `PaymentReversed` válido em `paymentReversedV1`, com as mesmas alocações e o motivo.
- A8: estornar pagamento de contrato PAID_OFF que volta a ter saldo reabre para ACTIVE, com `status_changed_at` e auditoria.
- A9: o evento `LoanReopened` é gravado com o motivo.
- A10: o contrato só reabre se, depois do estorno, restar principal ou juros em aberto (`reopensOnReversal`); com saldo zero ele continua PAID_OFF.
- A11: contrato RENEWED dá 422 `REVERSAL_BLOCKED_BY_SUCCESSOR`.
- A12: o mesmo para RENEGOTIATED; nada é gravado.
- A13: pagamento PENDING_REVIEW, REVERSED ou REJECTED dá 409 `PAYMENT_NOT_CONFIRMED`.
- A14: versão errada dá 409 `VERSION_CONFLICT`.
- A15: motivo ausente ou em branco dá 400.
- A16: pagamento inexistente dá 404.
- A17: nenhuma recusa grava algo.
- A18: `reversePaymentRequest` exige `reason` e recusa chaves desconhecidas.

## Casos de teste
- C1 a C7: estorno feliz (campos, alocações marcadas, detalhe restaurado, auditoria, pagamento do meio).
- C8, C9: evento.
- C10 a C12: reabertura (PAID_OFF reabre, ACTIVE e WRITTEN_OFF não mudam).
- C13, C14: bloqueio por sucessor.
- C15 a C20: recusas.
- C21, C22: schema.

## Riscos
- Estorno e confirmação ao mesmo tempo: as duas travam o pagamento e o contrato.
- Saldo após estorno depende de data: usa o em aberto de principal e juros (sem encargos), então não varia com o dia.

## Dependências
- F03 (confirmar), `lending/domain/reversal.ts` (E5). E11-T16 depende só de E11-T04; E11-T17 espera E11-T16 e E11-T06 (mesmo controller e mesma pasta de aplicação).
