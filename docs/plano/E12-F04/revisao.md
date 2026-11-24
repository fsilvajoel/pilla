# Revisão E12-F04 (painel da tesouraria)

revisor: claude Opus (revisão final da E12, 23/11). Referências conferidas: PRD-001 RF-32, RN-T01, RN-C10,
`docs/plano/E12.md` D7 e D8, plano A1 a A12.

## Revisão dos testes (etapa 3): APROVADO
- `apps/api/src/treasury/http/treasury-summary.http.test.ts` C1 a C10 e A11 cobrem A1 a A9 e A11, inclusive D7 nulo
  com caixa negativo (C7) e `month` inválido (linha 324).
- `apps/api/src/lending/public/portfolio-figures.test.ts` C11 a C15 cobrem A10 (bate com a cotação de quitação de cada
  contrato ativo), parcial, previsão por vencimento e renovado fora; `portfolio-figures-no-installments.test.ts` e
  `committed-shares.test.ts` complementam e não estão em `tests` do `estado.json`.
- `packages/schemas/src/api/treasury/treasury-summary.test.ts` C16 a C20 cobrem A12.

## Revisão final (etapa 6), rodada 1: APROVADO COM RESSALVAS
D7 conferida: `committedBps` e `availableBps` nulos com caixa negativo ou base menor ou igual a zero
(`apps/api/src/treasury/application/committed-shares.ts:58-59`), e o refine do schema exige os dois nulos ou somando
10000. Nada é gravado (ADR-0005). Leitura de lending só pela porta `lending/public/portfolio-figures.ts` (D8).

Bloqueantes: nenhum.

Não bloqueantes (registrados em [D6](../../defeitos/D6.md)):
1. `lossesCents`: D7 diz "principal em aberto dos WRITTEN_OFF (bruto)"; a implementação abate o principal pago pela
   recuperação (C5 em `treasury-summary.http.test.ts:263-294`: perdas caem de 3.000.000 para 2.650.000 enquanto
   `recoveredCents` sobe 500.000). É coerente com "principal em aberto", mas "bruto" sugere o contrário. Confirmar com
   PM (pendência E12-T07 item 3) e ajustar D7 ou o código.
2. `apps/api/src/treasury/infra/summary-queries.ts:13-28`: `monthLedgerTotals` soma todas as contas, ativas ou não;
   `cashCents` soma só as ativas. Sem efeito no MVP (uma conta, RN-T04); diverge quando houver conta inativa.
3. `apps/api/src/treasury/infra/summary-queries.ts:38-44`: `maxCommittedBps` vem da primeira conta ativa por
   `createdAt`, não de `BASE_ACCOUNT_ID`.
4. `apps/api/src/lending/public/portfolio-figures.ts:27`: uma consulta de alocações por contrato (N+1). Aceitável no
   volume do MVP.

Processo: `estado.json` sem `criteria`, `scenarios` e `testShas`; gates `tests-reviewed`, `coverage`, `mutation` e
`e2e` sem PASS registrado.
