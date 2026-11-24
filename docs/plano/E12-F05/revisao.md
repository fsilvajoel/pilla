# Revisão E12-F05 (tela /caixa e aviso de caixa)

revisor: claude Opus (revisão final da E12, 23/11). Referências conferidas: PRD-001 RF-30 a RF-32, RN-C10,
ADR-0017, `docs/plano/E12.md` D6 e D9, plano A1 a A7.

## Revisão dos testes (etapa 3): NÃO SE APLICA (sem teste de tela), lacuna registrada
- A etapa de testes não rodou (`stages.tests` pendente, `tests: []`). Pela ADR-0017 e pela decisão de 19/11 a tela fica
  sem teste nesta fase; os fluxos A1 a A6 ficam com o E2E da E12-F06, que ainda não foi executado.
- Há lógica extraída com teste e verde, fora do `estado.json`: `apps/web/components/treasury/treasury-format.test.ts`
  (`formatBps(null)` vira "—", D7) e `apps/web/components/treasury/entry-actions.test.ts` (4 testes).
- A regra do aviso RN-C10 (`apps/web/components/loans/loan-draft-actions.tsx:40`, `principalCents > balanceCents`)
  está no componente, sem teste unitário; só o E2E da F06 (passo 3) a cobre.

## Revisão final (etapa 6), rodada 1: APROVADO COM RESSALVAS
Conferido por leitura: item "Caixa" no menu (`apps/web/components/shared/admin-nav.tsx:20`), cliente com schemas em
`apps/web/lib/api/treasury.ts` (A7, sem `any`), percentual nulo como "—" (`components/treasury/treasury-format.ts:11`),
aviso RN-C10 que não bloqueia a ativação (`loan-draft-actions.tsx:112-117`).

Bloqueantes: nenhum.

Não bloqueantes (registrados em [D6](../../defeitos/D6.md)):
1. A1 a A6 sem evidência de execução: dependem do E2E da F06, não rodado.
2. `estado.json` com `tests: []` apesar de dois arquivos de teste da feature.

Processo: sem `criteria`, `scenarios` e `testShas`; gates sem PASS registrado.
