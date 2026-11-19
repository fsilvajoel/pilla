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
