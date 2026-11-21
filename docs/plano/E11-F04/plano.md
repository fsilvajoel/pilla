# E11-F04: estornar pagamento

Plano da feature. Cartões: E11-T07 (testes, claude Sonnet) e E11-T08 (implementação, baidu, com Sonnet de reserva). Referências: PRD-001 RF-22, RN-R07, RN-R10 e RN-R11, RFC-004 §3, §6 e §7, ADR-0006, `docs/plano/decisoes-2026-11-19.md` §4, `docs/plano/E11.md` D3, D4, D8, D10 e D12.

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

Fora: lançamento REVERSAL na tesouraria (E12); estornar pagamento PENDING_REVIEW (não existe estorno de pendente; ver pergunta aberta sobre descarte); ajuste manual no sucessor (RN-R11, fora do MVP).

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
- A13: pagamento PENDING_REVIEW ou REVERSED dá 409 `PAYMENT_NOT_CONFIRMED`.
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
- F03 (confirmar), `lending/domain/reversal.ts` (E5).
