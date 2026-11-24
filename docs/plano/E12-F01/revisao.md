# Revisão E12-F01 (lançamentos automáticos por evento)

revisor: claude Opus (revisão final da E12, 23/11). Base: `chore/e12-revisao` a partir de `docs/mvp-planning` (3faea69).
Referências conferidas: PRD-001 RN-T02 e RN-T03, `docs/plano/E12.md` D1 a D3 e D8, plano A1 a A14.

## Revisão dos testes (etapa 3): APROVADO
- `apps/api/src/core/infra/outbox-dispatcher.test.ts` C1 a C12 cobrem A9 a A13: publicação sem consumidor, reentrega
  com `processed_events`, `attempts`, `last_error` (500 caracteres), limite de 5, rollback sem `processed_events`,
  lote de 100 em ordem, poller sem sobreposição.
- `apps/api/src/treasury/application/ledger-consumer.test.ts` C13 a C22 cobrem A1 a A8 e A10 (RENEWAL e RENEGOTIATION
  via `it.each` na linha 193, IMPORT, componente zero, RECOVERY, estorno espelhado também da recuperação, estorno antes
  do REPAYMENT, tipos ignorados, payload inválido).
- `apps/api/src/treasury/http/ledger-from-events.http.test.ts` C23 e C24 cobrem A14 pela API real.
- Rodado: 22 arquivos, 167 testes verdes (`vitest run src/treasury src/core/infra src/lending/public`).
- Ressalva: `estado.json` lista 3 arquivos de teste; `outbox-error-paths.test.ts`, `ledger-repository.test.ts` e
  `monotonic-id.test.ts` também valem para a feature e não estão em `tests`.

## Revisão final (etapa 6), rodada 1: APROVADO COM RESSALVAS
Conforme D1 a D3: um evento por transação, `processed_events` com ON CONFLICT DO NOTHING
(`apps/api/src/core/infra/outbox-dispatcher.ts`), poller de 2 s com trava (`outbox-poller.ts`), REPAYMENT na ordem
LATE_CHARGES, INTEREST, PRINCIPAL, RECOVERY único, REVERSAL datado de hoje em Brasília e falha sem REPAYMENT
(`apps/api/src/treasury/application/ledger-consumer.ts:66-93`). O insert vazio em `ledger-consumer.ts:62` é
inalcançável: `paymentConfirmedPayload` exige soma das alocações igual a `amountCents` positivo
(`packages/schemas/src/events/payment-confirmed.ts:30`). `pnpm depcruise` sem violação.

Bloqueantes: nenhum.

Não bloqueantes (registrados em [D6](../../defeitos/D6.md)):
1. `apps/api/src/treasury/application/ledger-consumer.ts:8` importa `lending/public/brasilia-today`, dependência
   treasury → lending fora da porta declarada em D8 (sem ciclo; o mesmo vale para `create-account-entry.ts:7` e
   `treasury-summary.ts:3`). Ou D8 passa a listar a porta, ou o utilitário vai para `core`.
2. `apps/api/src/core/infra/outbox-dispatcher.ts:44`: `dispatchOutbox(db, consumers)` sem o `options` previsto em D1
   (lote e limite fixos). Divergência de contrato, sem efeito no comportamento.

Processo (impede o gate de auditoria em PASS, não é defeito de código):
- `estado.json` sem `criteria`, `scenarios` e `testShas`: `pnpm gate tests-reviewed E12-F01` dá FAIL
  ("estado sem `criteria`").
- `sources` com glob (`apps/api/src/treasury/application/**`): `pnpm gate coverage E12-F01` dá FAIL ("arquivo de
  `sources` não existe"). Gates de mutação e e2e não rodados.
