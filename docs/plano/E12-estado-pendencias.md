# E12: pendências do estado.json (24/11)

O que foi preenchido nos `estado.json` de E12-F01 a F06 e o que não pôde ser comprovado sem rodar os gates.

## Preenchido (comprovável no repositório)
- `sources`: globs trocados pelos arquivos de produção que os commits de implementação da feature tocaram
  (E12-T02, T04, T06, T08, T14, T09) mais os que o plano nomeia; todos existem. Fora de `sources` ficaram os arquivos
  de ligação (`app.module.ts`, `packages/schemas/src/index.ts`) e SQL/snapshots de migração, que o gate de
  cobertura (vitest, 100%) não mede de forma útil.
- `criteria`, `scenarios`: critérios A<n> do `plano.md` que têm teste nomeado no arquivo; `teste` é o título real do
  `it(...)`. F01 a F04 em camada `unit` (testes HTTP e de schema); F05 e F06 em `e2e`.
- `testShas` (F01 a F04): `git hash-object` dos arquivos de `tests` na versão atual da branch.

## Pendente
- Gates tests-reviewed, coverage, mutation e e2e: não foram rodados (sem `pnpm`, a máquina está sem memória). Os
  status FAIL antigos em `gates` ficam até alguém rodar `pnpm gate ...`. A cobertura de 100% por arquivo de `sources`
  não foi conferida e pode falhar em algum arquivo.
- `testShas` assinados sem o gate `expect-red` registrado (os testes nasceram vermelhos, commits "red", mas o PASS não
  foi gravado). A revisão dos testes (`testReview`) foi do Opus, sem `--sign`. Se a branch `fix/e12-d6` alterar
  arquivos de teste, o sha precisa ser regerado.
- Critérios sem cenário (sem título de teste próprio): F02 A9 (coberto dentro de C7 a C15) e F04 A6 (previsão do
  mês, coberta em `portfolio-figures.test.ts`). Nos demais, um teste representativo por critério foi ligado; outros
  C<n> do plano estão nos mesmos arquivos.
- F05: `tests` segue vazio (sem teste de tela, ADR-0017). Critérios A1, A4, A5 e A7 sem evidência; A2, A3 e A6 só
  pelo E2E de `treasury.e2e.ts`, que nunca rodou verde (portas 3100/3101). `entry-actions.test.ts` e
  `treasury-format.test.ts` existem e passam, mas não foram ligados (não comprovam um critério A<n>).
- F06: `sources` vazio (feature só de E2E; o lint estrito e o gate de cobertura recusam), `implement` pendente, A2 (sem
  espera fixa) e A3 (dados próprios) sem cenário. `testShas` de F05 e F06 não assinados: E2E não executado.
- Percentual de E12 não sobe: `mutation_e2e` exige gates `mutation` e `e2e` em PASS, e a revisão final segue em
  `needs_input` (D6, D7 de PM).
