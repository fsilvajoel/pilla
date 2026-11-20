# E10-F01: conta nula em rascunho e transições de status

Plano da feature. Cartões: `docs/plano/E10.yaml`, E10-T01 (testes, bia) e E10-T02 (implementação, baidu). Referências: RFC-005 §4 e §8, RFC-001 M2, ADR-0006, `docs/plano/decisoes-2026-11-19.md`, `docs/plano/E10.md` D4, D8 e D9, RN-C06, RN-R09.
Não é cartão de tela.

## Escopo

Entra:
- Migração gerada por `pnpm --filter @pilla/api db:regen loans-account-nullable lending`: `loans.account_id` passa a aceitar nulo, com o check `loans_account_id_check` `status IN ('DRAFT','CANCELLED') OR account_id IS NOT NULL` (D4).
- `apps/api/src/lending/domain/loan-transitions.ts`: funções puras `canEdit`, `canCancel`, `canActivate` (só de DRAFT) e `canRenew`, `canRenegotiate`, `canWriteOff` (só de ACTIVE), sobre `LoanStatus`.
- Ajuste da linha de `account_id` na RFC-005 §4 (só essa linha e o check).

Fora: endpoints (F03 em diante), eventos, telas, qualquer outro campo de `loans`.

## Critérios de aceite
- A1: as funções de transição aceitam só os status de origem acima.
- A2: qualquer outro status retorna `false`.
- A3: as funções não importam infra, Nest nem Zod.
- A4: as funções usam o `LoanStatus` de `loan-status.ts`.
- A5: DRAFT e CANCELLED com `account_id` nulo são gravados; ACTIVE com `account_id` nulo é recusado pelo banco.

## Casos de teste
- C1 a C8: uma tabela status × função, um caso por status (DRAFT, ACTIVE, RENEWED, RENEGOTIATED, PAID_OFF, WRITTEN_OFF, CANCELLED).
- C9 a C11: insert de DRAFT nulo (passa), de CANCELLED nulo (passa) e de ACTIVE nulo (falha com o nome do check).
