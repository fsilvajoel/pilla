# E5-F03: status do contrato fechado para pagamento (RN-R09)

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E5.yaml`; referência: PRD-001 RN-R09 e RN-C20, RFC-001 M2.

## Escopo

- E5-T07 (Bia): `apps/api/src/lending/domain/loan-status.test.ts`, os testes de `isClosedForPayments`.
- E5-T08 (Alice): `apps/api/src/lending/domain/loan-status.ts` e a saída da trava do stub no `vitest.config.ts`.
- `LoanStatus` é tipo local da api, com os 7 status do check `loans_status_check` (`@pilla/schemas` só na borda HTTP, `decisoes-2026-11-19.md` §4; precedente: `LoanStanding` local em `@pilla/finance`).
- Fora: transições de status (ativar e cancelar: `decisoes-2026-11-19.md` §4), status `DRAFT` (a RN-R09 não fala dele) e o uso da regra no caso de uso de pagamento.

## Riscos

- Teste que lista os status num laço: o hint pede um `it` por status com literal.
- Esquecer que `WRITTEN_OFF` aceita pagamento (RN-C20): há teste explícito.
- Cobertura 0/0 com a trava do stub ainda no `vitest.config.ts`: o E5-T08 remove a linha e o check exige 100% (e4-guardrails, erro 17).

## Dependências

- Casca no HEAD: `loan-status.ts` com `// @stub E5-T08`, `LoanStatus` completo e a função lançando `not implemented`.
- Linha de exclusão da casca em `coverage.exclude` do `apps/api/vitest.config.ts`.

## Critérios de aceite

- A1: `isClosedForPayments` é true para `PAID_OFF`, `RENEWED`, `RENEGOTIATED` e `CANCELLED` (RN-R09).
- A2: `isClosedForPayments` é false para `ACTIVE` e `WRITTEN_OFF` (RN-R09, RN-C20).
- A3: 100% de linhas e ramos de `loan-status.ts`; typecheck e lint verdes; sem `@stub` nem exclusão.

## Cenários

- C1: `PAID_OFF`, `RENEWED`, `RENEGOTIATED` e `CANCELLED` dão true.
- C2: `ACTIVE` dá false.
- C3: `WRITTEN_OFF` dá false (RN-C20).
