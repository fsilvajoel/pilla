# Revisão dos testes E6-F02 (rodada 1)

revisor: reviewer
arquivo: apps/web/components/loan-simulation.test.tsx 98ee1712c2fe2a303eb8d82df031b11e982452bf
arquivo: apps/web/e2e/loan-simulation.e2e.ts 1a360f053f8baa7cad53b5f543bf587e6035c567

`pnpm gate expect-red E6-F02`: PASS (9 teste(s), todos falhando). Conferido rodando o vitest: os 9 caem em
`Error: not implemented` (loan-simulation.tsx:23), não em import nem tipo; `tsc --noEmit` do `@pilla/web` limpo.
O e2e (C10, C11) cai hoje porque `page.tsx` chama `todayInBrt` (esboço da E7-F01); esperado, não reprova.

Contas conferidas na fonte (não no plano):
- RFC-004 §5: juros 190000, total 690000, parcela 115000, linha 1 {1, 2026-12-14, 83333, 31667, 115000}.
  `splitEvenly` põe o resto na última parte, então a 1ª é 833,33. `periodsFor` não usa a distância entre
  desembolso e 1º vencimento, então o 2099-12-14 do e2e não muda os valores.
- PRD-001 CA-11: juros 93,33 → 95; 1.095 ÷ 4 → parcela 275,00; total 1.100,00.

- [x] C1 — test.tsx:75-90: os 4 inputs pelo rótulo, `type="date"` no 1º vencimento, `SELECT` com textos e values
  exatos (toEqual) e o botão "Simular". Igual a A1.
- [ ] C2 — test.tsx:92-101: textos exatos `R$ 6.900,00`, `R$ 1.900,00`, `6 × R$ 1.150,00`, sem alerta; mas não liga
  rótulo a valor (achado 1).
- [x] C3 — test.tsx:103-120: cabeçalhos exatos (toEqual), 6 linhas de dados e 1ª linha
  `["1","14/12/2026","833,33","316,67","1.150,00"]`. Igual a A2/RFC-004 §5.
- [ ] C4 — test.tsx:122-128: `4 × R$ 275,00` e `R$ 1.100,00` exatos, sem alerta; mesmo problema do C2 (achado 1).
- [x] C5 a C9 — test.tsx:130-158: cada um troca só um campo do exemplo RFC ("5000", "6", "0", "2026-11-14", "") e
  confere `{alert: "Confira os campos da simulação.", hasSummary: false, hasTable: false}` (toEqual, 62-72).
  Uma rejeição por campo editável, igual a A3.
- [ ] C10 — e2e.ts:16-24: heading e textos exatos, sem alerta; mesmo problema do C2 (achado 1).
- [x] C11 — e2e.ts:26-32: `toHaveText` exato do alerta, sem "Total a receber" e sem tabela. 2000-01-14 é passado
  para qualquer "hoje" real.
- [x] Nomes — os 11 testes têm exatamente o nome do `estado.json`.
- [x] Camadas — A1 a A3 unit em `tests`, A4 e2e em `e2e`. `domainSources` vazio (tela), então sem `prop`/mutação.
- [x] Fragilidade — unit usa datas fixas (desembolso 2026-11-14), sem relógio, timers nem ordem; o assíncrono do
  formulário é esperado com `findBy*`. O e2e depende do relógio só via `todayInBrt`: 2099-12-14 vale até 2099 e
  fica abaixo do teto 2999-12-31; 2000-01-14 é sempre passado. Aceitável.
- [x] Bordas — n/a justificados: a tela não acrescenta regra; as bordas de `toSimulateRequest`/`simulateLoanRequest`
  estão na E6-F01 (D1 a D3 registrados lá); periodicidade é select fechado; `disbursementDate` é garantido pelo tipo.
- [x] Proteções — o commit 9f378ad não toca `loan-simulation.tsx`, `page.tsx` nem `lib/`.

## Veredito
reprovado

## Achados
1. test.tsx:95-99, test.tsx:125-126 e e2e.ts:19-22: o teste acha "Total a receber", "Juros" e os valores
   separados, sem ligar cada rótulo ao seu valor. Uma tela que troque total e juros (ou mostre
   `R$ 1.100,00` como juros no CA-11) passa em C2, C4 e C10, e A2/A4 pedem "Total a receber" `R$ 6.900,00` e
   "Juros" `R$ 1.900,00`. Como `domainSources` é vazio, a mutação também não pegaria. Correção: fixar no contrato
   do plano a estrutura do resumo (ex.: `<dl>` com `<dt>` rótulo e `<dd>` valor, papéis `term`/`definition`) e
   conferir os pares com toEqual, ex. `[["Total a receber","R$ 6.900,00"],["Juros","R$ 1.900,00"],["Parcela","6 × R$ 1.150,00"]]`,
   no C2, no C4 (CA-11: total `R$ 1.100,00` e parcela `4 × R$ 275,00`) e no C10.

## Lacunas
- C2 usa `selector: ":not(th)"` para "Juros" e C3 usa `findByRole("table")` (uma só tabela): ambos supõem que o
  resumo não é tabela. Com o achado 1 resolvido no contrato isso some.
- C4 não confere os juros do CA-11 (`R$ 100,00`); o A2 não pede. Opcional.

# Revisão dos testes E6-F02 (rodada 2)

revisor: reviewer
arquivo: apps/web/components/loan-simulation.test.tsx 82cb8569dd6b9dc4ef5176ec6eaa6a464d432c6a
arquivo: apps/web/e2e/loan-simulation.e2e.ts 939bb341419d1448748dd834d2aba1d2ac5e241b

Diff revisado: 3fd6e8d..51e4125. `pnpm gate expect-red E6-F02`: PASS (9 teste(s), todos falhando), rodado de novo
nesta revisão; no vitest os 9 caem em `Error: not implemented` (relatório JSON, 9 de 9), `tsc --noEmit` limpo.

- [x] Achado 1 (contrato) — plano.md, Contrato: o resumo vira um único `<dl>` com pares `<dt>`/`<dd>` na ordem
  "Total a receber", "Juros", "Parcela", e não é tabela. C2, C4 e C10 do plano citam os pares.
- [x] C2 — test.tsx:63-71 (`summaryPairs`: cada `term` com o `<dd>` irmão seguinte, dentro de `<dl>`; senão `null`) e
  test.tsx:106-110: toEqual dos 3 pares exatos. Trocar total e juros, ou tirar um `<dd>`, falha. No jsdom `dt`/`dd`
  têm papéis `term`/`definition` (aria-query conferido).
- [x] C4 — test.tsx:136-140: o Map vem de `summaryPairs`, então `get("Total a receber")` é o `<dd>` daquele `<dt>`:
  liga rótulo a valor, não só confere presença. Ordem dos 3 rótulos com toEqual; total `R$ 1.100,00` e parcela
  `4 × R$ 275,00` com toBe. Trocar total e juros dá `R$ 100,00` no total e falha.
- [x] C10 — e2e.ts:19-22: `dl > dt` e `dl > dt + dd` com toHaveText em lista (ordem e quantidade exatas). Cada `dd`
  precisa vir logo depois de um `dt`, e as duas listas têm de bater posição a posição: trocar valores ou faltar um
  `dd` falha.
- [x] Resto sem mudança — C1, C3, C5 a C9 e C11 iguais à rodada 1 (só entrou o helper); nomes iguais aos do
  `estado.json`; camadas, bordas e fragilidade como na rodada 1.
- [x] Proteções — 51e4125 não toca `loan-simulation.tsx`, `page.tsx` nem `lib/`.

## Veredito
aprovado

## Lacunas
- plano.md, Contrato (resumo): a frase "O resumo não é tabela" aparece duas vezes. É só redação e não muda o contrato.
- C4 continua sem conferir os juros do CA-11. Está justificado no plano: a fonte só dá o valor intermediário 95.

# Revisão final E6-F02

revisor: reviewer
diff: `a9b1817..d61ec19` (implementação). O `6f7a0b9` (chore: `.env.example` e glob `app/\(admin\)` da exclusão de
cobertura) fica fora da feature e não foi auditado.

## Critérios de aceite
- [x] A1 — `loan-simulation.tsx:68-89`: rótulos "Valor emprestado", "Taxa ao mês (%)", "Nº de parcelas",
  "Periodicidade" e "1º vencimento" ligados por `htmlFor`/`id`; select com as 4 opções de `frequencyOptions`
  (`:23-28`, values WEEKLY/BIWEEKLY/MONTHLY/BIMONTHLY e textos Semanal/Quinzenal/Mensal/Bimestral); `type="date"` no
  1º vencimento (`:87`); botão "Simular" (`:89`). C1 verde.
- [x] A2 — `:56-59`: `toSimulateRequest(values)` e `simulate(request, disbursementDate)` (E6-F01, ADR-0013), sem API.
  Resumo `:96-103`: um único `<dl>` com `dt`/`dd` na ordem "Total a receber", "Juros", "Parcela"; total e juros como
  `R$ ` + `formatReais` (`reais`, `:46-48`); parcela `${String(count)} × R$ …` (`:102`). Cronograma `:104-125`:
  cabeçalhos Nº, Vencimento, Principal, Juros, Parcela; data `dd/mm/aaaa` (`formatDate`, `:41-44`) e valores em
  `formatReais` sem `R$`. RFC-004 §5 (conferida na fonte: juros 190000, total 690000, parcela 115000, linha 1
  {1, 2026-12-14, 83333, 31667, 115000}) bate com C2/C3 verdes; CA-11 com C4 verde.
- [x] A3 — `:60-62`: todo erro de `toSimulateRequest`/`simulate` (MoneyError, ZodError, DueDateError da RN-C04) vira
  `outcome.kind = "invalid"`, que mostra só o `<p role="alert">Confira os campos da simulação.</p>` (`:92`); resumo e
  tabela só existem em `kind = "result"` (`:94`), então somem juntos. Nada é lançado para fora. C5 a C9 verdes.
- [ ] A4 — **pendência conhecida, não reprovação da implementação.** O componente não tem nada específico da rota;
  o e2e cai antes de chegar nele: `page.tsx` chama `todayInBrt` (`apps/web/lib/today.ts`, `@stub E7-T02`, lança
  `Error("not implemented")`) e a rota responde "This page couldn’t load" (`error-context.md` do Playwright, C10 e
  C11 sem o heading "Simular empréstimo"). Já previsto no plano (Riscos, Dependências e Pendências). Fecha quando a
  E7-F01 entregar `todayInBrt` e `pnpm gate e2e E6-F02` der PASS.

Contrato: `LoanSimulationProps { readonly disbursementDate: IsoDate }` e
`LoanSimulation({ disbursementDate }: LoanSimulationProps): JSX.Element` (`:14-17`, `:53`), iguais ao plano.

## Gates
| Gate | Resultado |
|---|---|
| `pnpm gate tests-reviewed E6-F02` | PASS (2 testes, sha assinado; `git hash-object` = 82cb856… e 939bb34…) |
| `pnpm gate coverage E6-F02` | PASS (100% em `components/loan-simulation.tsx`) |
| `pnpm gate mutation E6-F02` | PASS (nada a medir: `domainSources` vazio, tela não é domínio) |
| `pnpm gate e2e E6-F02` | FAIL — C10 e C11, por `todayInBrt` esboço (E7-F01); pendência conhecida |
| `pnpm verify` | vermelho só em `@pilla/api#test` (16 testes de `ids.ts` e `isClosedForPayments`, E5-F01/F03/F04, já falhavam antes); typecheck e lint verdes; `@pilla/web` 29/29 |

## Diff
- Escopo: `apps/web/components/loan-simulation.tsx` (do plano), `apps/web/vitest.config.ts` (só tira o esboço
  E6-T06 da exclusão de cobertura, etapa 4 do workflow) e `estado.json`. `page.tsx`, `lib/` e os testes assinados
  não mudaram. Nenhuma dependência nova (`react-hook-form` já era do web).
- AGENTS.md §8 e `docs/memoria/lint.md`: sem `any`, `as`, `!`, `@ts-*`, `eslint-disable`, `console.` ou TODO;
  número em template com `String()`; promessa do `handleSubmit` com `void`; `@stub E6-T06` removido; `tsc --noEmit` e
  ESLint do arquivo limpos. Tipagem forte: `Outcome` como união discriminada, `frequencyOptions` com
  `FrequencyPreset`, `defaultValues: SimulationFormValues`. IDs no código: PRD-001 RF-10, ADR-0013, RN-C04, RFC-002.
  Nenhum segredo, IP ou dado real.
- Achados: nenhum.

## Lacunas
- Nenhuma em A1 a A3. A4 aberta só pela dependência externa acima.
- Observação (não é achado da feature): o campo "Nº de parcelas" é texto com `inputMode="numeric"`, então `"1e1"` e
  `" 6 "` continuam aceitos pela tela. Já é o D1 (aberto, E6-F01), que o plano deixou fora do escopo.

## Defeitos abertos
- nenhum novo (D1 a D3 seguem abertos, da E6-F01).

## Veredito
aprovado (implementação de A1 a A3); feature **não fecha** até o gate e2e (A4) passar depois da E7-F01.
