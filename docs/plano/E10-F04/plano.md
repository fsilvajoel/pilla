# E10-F04: ativar com desembolso

Plano da feature. Cartões: E10-T07 (testes, claude) e E10-T08 (implementação, baidu, com Sonnet de reserva). Referências: PRD-001 RF-12, RFC-002 §3.4, RFC-004 §3, §6 e §7, ADR-0006, `docs/plano/E10.md` D6, D7, D8 e D11, RN-C03, RN-C04, RN-C05, RN-C16.

## Escopo

Entra:
- `POST /api/v1/loans/{id}/activate` (`activateLoanRequest`: `disbursedAt`, `accountId`, `firstDueDate`), com `If-Match`. Em uma transação:
  - checa a conta por `treasury/public`;
  - gera as parcelas por `@pilla/finance` (schedule);
  - grava `disbursed_at`, `account_id`, ACTIVE e `status_changed_at`;
  - escreve `LoanActivated` no `core.outbox`;
  - grava a auditoria.
- Contrato de RENEWAL ou RENEGOTIATION: a origem passa a RENEWED ou RENEGOTIATED na mesma transação, com o evento `LoanRenewed` ou `LoanRenegotiated`. Não há desembolso em dinheiro (D8).
- Datas em Brasília (D11).

Fora:
- Consumidores do outbox e lançamento no ledger (E12).
- RN-C10 (aviso de caixa insuficiente, sem bloqueio; decisão de 21/11), da E12.

## Critérios de aceite
- A1: a ativação responde 200 em ACTIVE, com `disbursed_at` e `account_id`.
- A2: as parcelas batem com o cronograma do CA-01 (T-14).
- A3: grava um `LoanActivated` válido no Zod de `packages/schemas/src/events`.
- A4: conta inexistente ou inativa dá 422 em `accountId`.
- A5: `firstDueDate` que não é posterior a `disbursedAt` dá 422 `FIRST_DUE_DATE_BEFORE_DISBURSEMENT`.
- A6: contrato fora de DRAFT dá 409 `LOAN_NOT_EDITABLE`, e versão errada dá 409 `VERSION_CONFLICT`. Nada é gravado na recusa.
- A7: na renovação, a origem vira RENEWED e o evento `LoanRenewed` é gravado.
- A8: origem que não está mais ACTIVE dá 409.

## Casos de teste
- C1 a C5: feliz (parcelas, outbox, auditoria, datas).
- C6 a C10: recusas, cada uma conferindo que não houve escrita.
- C11 a C13: renovação, renegociação e origem que já não está ACTIVE.
