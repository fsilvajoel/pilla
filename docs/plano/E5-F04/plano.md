# E5-F04: efeito do estorno no status do contrato (RN-R10, RN-R11)

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E5.yaml`; referência: PRD-001 RN-R10 e RN-R11, RFC-001 M2.

## Escopo

- E5-T09 (Bia): `apps/api/src/lending/domain/reversal.test.ts`, os testes de `isReversalBlocked` e `reopensOnReversal`.
- E5-T10 (Alice): `apps/api/src/lending/domain/reversal.ts` e a saída da trava do stub no `vitest.config.ts`.
- Fora: o caso de uso do estorno (banco, auditoria, recálculo do saldo) e o status de destino ao reabrir.

## Riscos

- Teste que deriva o esperado de uma lista: o hint pede literal em cada `it`.
- Saldo zero contado como reabertura: há teste de `PAID_OFF` com 0.
- Cobertura 0/0 com a trava do stub ainda no `vitest.config.ts`: o E5-T10 remove a linha e o check exige 100% (e4-guardrails, erro 17).

## Dependências

- E5-F03 antes (o `LoanStatus` vem de `loan-status.ts`, só o tipo; a casca dele já está no HEAD).
- Casca no HEAD: `reversal.ts` com `// @stub E5-T10` e as duas funções lançando `not implemented`.
- Linha de exclusão da casca em `coverage.exclude` do `apps/api/vitest.config.ts`.

## Critérios de aceite

- A1: `isReversalBlocked` é true só para `RENEWED` e `RENEGOTIATED` (RN-R11).
- A2: `reopensOnReversal` é true só para `PAID_OFF` com saldo maior que zero (RN-R10).
- A3: 100% de linhas e ramos de `reversal.ts`; typecheck e lint verdes; sem `@stub` nem exclusão.

## Cenários

- C1: `RENEWED` e `RENEGOTIATED` bloqueiam o estorno.
- C2: `ACTIVE`, `PAID_OFF` e `WRITTEN_OFF` não bloqueiam.
- C3: `PAID_OFF` com saldo 1n (bigint, ADR-0004) reabre.
- C4: `PAID_OFF` com saldo 0n não reabre.
- C5: `ACTIVE` com saldo 500n não reabre.
