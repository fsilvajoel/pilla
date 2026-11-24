# Revisão E12-F03 (extrato e saldo)

revisor: claude Opus (revisão final da E12, 23/11). Referências conferidas: PRD-001 RF-31 e RN-T01,
`docs/plano/E12.md` D5 e D8, plano A1 a A9.

## Revisão dos testes (etapa 3): APROVADO
- `apps/api/src/treasury/http/account-statement.http.test.ts` C1 a C12 cobrem A1 a A5, A7 e A8: saldo acumulado,
  período com abertura e fechamento, limites inclusivos, mesmo dia por `created_at` e não por id, paginação sem repetir
  nem pular com o saldo certo na página 2, automáticos e manuais, período vazio, recusas e 404.
- `apps/api/src/treasury/http/accounts.http.test.ts` C13 e C14 cobrem A6; schemas `account-statement.test.ts` e
  `account-summary.test.ts` cobrem A9.
- Ressalva: `account-statement-cursor.http.test.ts`, `account-balance.test.ts`, `ledger-entries.test.ts` e
  `accounts.test.ts` também cobrem a feature e não estão em `tests` do `estado.json`.

## Revisão final (etapa 6), rodada 1: APROVADO COM RESSALVAS
Conforme D5 e RN-T01: saldo sempre derivado (soma com janela sobre `entry_date, created_at, id` da conta inteira e
filtro depois, `apps/api/src/treasury/infra/ledger-statement.ts`), cursor validado por ida e volta e por existência na
conta, `GET /accounts` com `balanceCents` por soma (`infra/account-repository.ts`), porta
`treasury/public/account-balance.ts`.

Bloqueantes: nenhum.

Não bloqueantes (registrados em [D6](../../defeitos/D6.md)):
1. `apps/api/src/treasury/application/account-statement.ts:44`: abertura, fechamento e página saem de três consultas
   em `Promise.all`, fora de uma transação. Um lançamento gravado entre elas pode deixar `closingBalanceCents`
   diferente do `balanceAfterCents` do último item. Raro com um admin; resolve com uma transação `REPEATABLE READ`.

Processo: `estado.json` sem `criteria`, `scenarios` e `testShas`; gates `tests-reviewed`, `coverage`, `mutation` e
`e2e` sem PASS registrado.
