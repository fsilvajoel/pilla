# E4-F04: redact de objeto com chave `constructor`

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E4-F04.yaml`; referência: RFC-003 §4.1.
Origem: furo achado na revisão final da E4-F02 (`docs/plano/E4-F02/plano.md`, notas de fechamento).

Substitui a E4-F03, que parou na etapa de testes (cota 2/2 da Bia, `expect-red` vermelho). Causa: erro de
cartão. O cenário C11 (instância de classe volta como veio) já passa contra o HEAD, então nenhum arquivo que o
contenha consegue falhar inteiro, como o `expect-red` exige. Cenário de regressão não entra em cartão
test-author com `expect-red`: o C11 já está coberto pelo C7 da E4-F02 em `redact.test.ts`, que o check do
E4-T09 roda.

## Escopo

- E4-T08 (Bia): `apps/api/src/log/redact-prototype.test.ts`, arquivo novo só com o cenário do furo. Arquivo
  separado porque o `expect-red` exige que todos os testes do arquivo falhem contra o HEAD, e os testes da E4-F02
  já passam.
- E4-T09 (Alice): `apps/api/src/log/redact.ts`, o teste de objeto simples passa a usar o protótipo.
- Fora: qualquer outra mudança no redact ou nos testes da E4-F02.

## Riscos

- Teste que passa contra o HEAD: barrado pelo `expect-red.mjs`; por isso só cenários que falham hoje.
- Correção que passa a redigir instância de classe (Date, Error, classe própria): o C7 da E4-F02, em
  `redact.test.ts`, roda no check do E4-T09.
- Cobertura incompleta: o check do E4-T09 exige 100% de linhas e ramos do `redact.ts`.

## Dependências

- `redact` e `REDACTED` em `apps/api/src/log/redact.ts` (E4-F02, 0b99370).

## Critérios de aceite

- A1: objeto literal com chave própria `constructor` é tratado como objeto simples e tem as chaves sensíveis redigidas.
- A2: instância de classe continua voltando como veio (C7 da E4-F02).
- A3: os testes da E4-F02 seguem verdes; 100% de linhas e ramos do `redact.ts`; typecheck e lint verdes.

## Cenários

- C9: `{ constructor: "x", cpf: "123", name: "Ana" }` vira `{ constructor: "x", cpf: REDACTED, name: "Ana" }`.
- C10: o mesmo objeto, dentro de outro objeto e dentro de um array, também é redigido.
