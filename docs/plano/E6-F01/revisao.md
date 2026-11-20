# Revisão dos testes E6-F01 (rodada 1)

revisor: reviewer
arquivo: apps/web/lib/simulation.test.ts 3a6688e5d47668f003d91d5c1bdffadd098acc8a
arquivo: apps/web/lib/simulation-form.test.ts e9d4cc8df2777967043fd5a9241731c0e2b01493

`pnpm gate expect-red E6-F01`: PASS (12 teste(s), todos falhando)

- [x] C1 — simulation.test.ts:7-21: toEqual exato das 4 opções (DAY 7, DAY 15, MONTH 1, MONTH 2), igual a A3/RN-C04. Nome sem ID (achado 1).
- [x] C2 — simulation.test.ts:36-53: toBe 190000n/690000n/115000n, toHaveLength(6) e toEqual da linha 1 {1, "2026-12-14", 83333n, 31667n, 115000n}, igual a A1/RFC-004 §5. Nome sem ID.
- [x] C3 — simulation.test.ts:64-68: toBe 27500n e 110000n, igual a A2/CA-11. Sem juros, como manda o A2. Nome sem ID.
- [ ] C4 — simulation.test.ts:70-76: toThrow(DueDateError) com vencimento igual ao desembolso (RN-C04), mas nenhum A<n> cobre o cenário; o estado.json o ligava ao A1 (achado 2).
- [ ] C5 — simulation-form.test.ts:16-26: toEqual completo (ok). simulation-form.test.ts:36-40 (CA-11): confere só 2 campos (achado 3).
- [x] C6 — simulation-form.test.ts:42-56: "5000" com toThrow(MoneyError) e "0" com toThrow(ZodError), igual a A4. Nome sem ID.
- [x] Proteções — os esboços só trocaram o marcador e a mensagem; os testes estão iguais ao commit 2338087.

## Veredito
reprovado

## Achados
1. simulation.test.ts:7,11,15,19,36,43,64,70 e simulation-form.test.ts:16,36,42,50: os nomes dos testes não começam pelo ID do cenário nem citam o A<n> (passo 2 da skill escrever-teste). Correção: prefixo "C<n> (A<n>): ".
2. plano.md e estado.json: C4 sem critério próprio. Correção: criar A6 (RN-C04) e ligar o C4 a ele.
3. simulation-form.test.ts:36-40: o C5 do CA-11 confere só monthlyInterestRateBps e frequency. Correção: toEqual com o corpo inteiro.

## Lacunas
- A4 só testa o valor fora do formato, não a taxa. Opcional; precisaria entrar no C6 do plano.
- A5 só se confere na revisão final.

# Revisão dos testes E6-F01 (rodada 2)

revisor: reviewer
arquivo: apps/web/lib/simulation.test.ts 01e4d34d627438824b4d89709448791b53964198
arquivo: apps/web/lib/simulation-form.test.ts 46cffa50156713f5a8d3072c154290e3267cb3a7

`pnpm gate expect-red E6-F01`: PASS (12 teste(s), todos falhando)

- [x] C1 (A3) — simulation.test.ts:7-21: quatro testes "C1 (A3): ..." com toEqual exato de DAY 7, DAY 15, MONTH 1 e MONTH 2 (RN-C04).
- [x] C2 (A1) — simulation.test.ts:36-53: toBe 190000n/690000n/115000n, toHaveLength(6) e toEqual da linha 1 {1, "2026-12-14", 83333n, 31667n, 115000n} (RFC-004 §5).
- [x] C3 (A2) — simulation.test.ts:64-68: toBe 27500n e 110000n (CA-11), sem juros, como manda o A2.
- [x] C4 (A6) — simulation.test.ts:70-76: toThrow(DueDateError) com vencimento igual ao desembolso; A6 em plano.md:70, estado.json liga C4→A6.
- [x] C5 (A4) — simulation-form.test.ts:16-26 (RFC-004 §5) e 36-46 (CA-11): toEqual do corpo inteiro, valores das "Entradas dos exemplos" do plano.
- [x] C6 (A4) — simulation-form.test.ts:48-62: "5000" lança MoneyError e "0" lança ZodError.
- [x] Proteções — esboços iguais aos da rodada 1; nos testes só mudaram os prefixos e o toEqual do C5 do CA-11.
- [x] Rastreio — estado.json e testes.md com os 12 nomes "C<n> (A<n>): ".

## Veredito
aprovado

## Lacunas
- A4 só testa formato errado no valor, não na taxa (opcional; o C6 não pede).
- A5 (cobertura 100%, typecheck, lint) fica para a revisão final.

# Revisão final E6-F01 (rodada 3)

revisor: reviewer
arquivo: apps/web/lib/simulation.test.ts 01e4d34d627438824b4d89709448791b53964198 (igual ao assinado)
arquivo: apps/web/lib/simulation-form.test.ts 46cffa50156713f5a8d3072c154290e3267cb3a7 (igual ao assinado)

## Critérios de aceite
- [x] A1 — simulation.ts:41-59: `generateSchedule` com `roundingStep` 500n, `interest`/`total` somados das linhas; teste C2 em simulation.test.ts:36-53 (190000n, 690000n, 115000n, 6 linhas, linha 1 {83333n, 31667n}) passa.
- [x] A2 — simulation.ts:57 (`total / BigInt(installmentCount)`); teste C3 em simulation.test.ts:64-68 (27500n, 110000n) passa.
- [x] A3 — simulation.ts:20-31: `switch` exaustivo das 4 opções; testes C1 em simulation.test.ts:7-21 passam.
- [x] A4 — simulation-form.ts:86-95: `parseReais` → `Number` → `simulateLoanRequest.parse`; C5 (simulation-form.test.ts:16-46) e C6 (48-62) passam. Taxa fora do formato: ver Lacunas.
- [x] A5 — `pnpm gate coverage E6-F01` PASS com 100% de linhas, ramos, funções e statements em lib/simulation.ts e lib/simulation-form.ts (exclusões tiradas do vitest.config.ts); `tsc -p tsconfig.json` saída 0; `eslint .` saída 0.
- [x] A6 — simulation.ts:47-49 repassa as datas ao motor, que lança; teste C4 em simulation.test.ts:70-76 (`DueDateError`) passa.

## Gates
| Gate | Resultado |
|---|---|
| `pnpm gate tests-reviewed E6-F01` | PASS (2 testes com sha assinado) |
| `pnpm gate coverage E6-F01` | PASS (100% em lib/simulation.ts, lib/simulation-form.ts) |
| `vitest run lib/simulation.test.ts lib/simulation-form.test.ts` | 12/12 verdes |
| `pnpm --filter web typecheck` / `lint` | verde / verde |
| `pnpm verify` | não rodado aqui (etapa 6) |

## Diff
- Escopo: só os arquivos do plano (simulation.ts, simulation-form.ts, vitest.config.ts, artefatos da feature), mais a mudança de harness em scripts/gates*.mts (item à parte, abaixo). Os testes diferem do HEAD só pelo que a rodada 2 assinou (prefixos e toEqual do C5).
- Tipos: sem `any`, sem `as`; marcas via `cents`/`bps`/`isoDate`. `Number ↔ BigInt` correto nos dois sentidos: `BigInt(number)` em simulation.ts:44-46 recebe inteiro já validado pelo Zod; em simulation-form.ts:89,91 `Number(bigint)` perderia precisão acima de 2^53, mas o `z.int()` do Zod 4 rejeita inteiro inseguro (sondado: "99.999.999.999.999.999,99" → ZodError). Valor/taxa negativos → ZodError (`positive`/`nonnegative`).
- Stubs: `@stub E6-T02` e `@stub E6-T04` removidos, junto com as duas exclusões. Fica só o stub E6-T06 (`components/loan-simulation.tsx`), fora do escopo.
- Achados:
  1. (baixa) simulation-form.ts:92: `Number(values.installmentCount)` aceita "1e1" (→ 10) e " 6 " (→ 6); "6.5" e "" caem no Zod. Ponto aberto para a tela (E6-T06): validar só dígitos ou usar `input type="number"`.
  2. (baixa) simulation-form.ts:91: a taxa reaproveita `parseReais`, então aceita milhar ("1.000,00" → 100000 bps = 1000% a.m.) e não tem teto. Nenhum A<n> define limite; não bloqueia.
  3. (info) simulation.ts:57: a divisão bigint trunca; está certa só porque o motor dá parcelas iguais (RN-C03, comentário na linha 56). Se o motor mudar, o `installmentAmount` erra calado. Não bloqueia.

## Mudança de harness (scripts/gates.mts, scripts/gates.test.mts)
- O gate coverage passa a rodar só os testes de `tests` do estado e a medir só os arquivos de produção deles (`productionFile`: tira o `.test`), com `--coverage.include` por arquivo (glob escapado), `--coverage.exclude=` vazio e limiar de 100% nas quatro métricas; arquivo fora do relatório, 0/0 ou abaixo de 100% é FAIL com nome e métrica.
- Testes: gates.test.mts cobre PASS, escape de `(admin)`, branches 3/4, arquivo excluído do relatório, arquivo de produção ausente (sem rodar o vitest), teste fora do relatório e `productionFile`. `pnpm test:harness` 90/90; tsc e eslint dos scripts saída 0. Tipagem sem `any`.
- Achados:
  4. (baixa) gates.mts `productionFile`: a convenção "1 teste → 1 arquivo de mesmo nome" é rígida; feature com teste que exercita outro arquivo (ou `x.spec.ts`) cai em FAIL "nome sem .test" ou deixa de medir o arquivo real. Aceitável como regra do harness, mas convém registrar em `../harness-ada/gate/cobertura.md`.
  5. (info) A suíte inteira do pacote, com o `vitest.config` e as exclusões dele, deixa de ser checada pelo gate e fica só com o `pnpm verify` (docstring diz isso). Coerente com o pedido do Joel.
- Veredito do item: aprovado.

## Lacunas
- A4 (taxa fora do formato): **risco aceito**. Não há teste; o comportamento foi sondado nesta revisão ("6" → MoneyError, "-6,33" → ZodError), mas sem teste assinado. Custo baixo de fechar depois: um caso a mais no C6 (exige nova revisão de testes).
- A5: **coberta** (gate coverage PASS a 100% nos dois arquivos, typecheck e lint verdes).

## Veredito
aprovado
