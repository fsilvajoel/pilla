# E4-F02: redact de campos sensíveis no log

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E4.yaml`; referência: RFC-003 §4.1.

## Escopo

- E4-T03 (Bia): `apps/api/src/log/redact.test.ts`, os testes de `redact` e `REDACTED`.
- E4-T04 (Alice): `apps/api/src/log/redact.ts` sem recursão (C1, C2, C3, C7, C8), mantendo os comentários `/** */` do stub.
- E4-T05 (Alice): recursão em objetos e arrays (C4, C5, C6), com 100% de cobertura.
- Fora: ligar o `redact` no logger (cartão próprio) e qualquer outro arquivo.

## Riscos

- Teste que refaz o algoritmo ou calcula o esperado: barrado por `check-test-quality.mjs` e pela auditoria.
- Teste que passa contra o stub: barrado pelo `expect-red.mjs`.
- Implementação que muta a entrada ou trata `Date`/`Error` como objeto simples: cenários C6 e C7.
- Cobertura incompleta: o check do E4-T05 exige 100% de linhas e ramos da implementação.

## Dependências

- Stub da implementação no HEAD (lança), com `redact(value: unknown): unknown` e `REDACTED`.
- vitest com cobertura no `@pilla/api` (`apps/api/vitest.config.ts`); RFC-003 §4.1 (log sem dado pessoal).

## Critérios de aceite

- A1: `redact` troca por `REDACTED` o valor de toda chave sensível, em qualquer profundidade.
- A2: chaves não sensíveis e valores que não são objeto simples saem iguais.
- A3: a entrada nunca é alterada.
- A4: todos os testes passam com 100% de linhas e ramos da implementação; typecheck e lint verdes.

## Cenários

- C1: cada uma das chaves cpf, phone, email, password e token tem o valor trocado por REDACTED.
- C2: chave que termina com nome sensível, sem diferenciar maiúsculas (accessToken, ownerCpf, userEmail, PASSWORD), vira REDACTED.
- C3: outras chaves mantêm o valor (name, amountCents, id).
- C4: objeto aninhado é redigido em qualquer profundidade.
- C5: objeto dentro de array é redigido.
- C6: a entrada não muda, com array aninhado incluído (comparar com structuredClone feito antes).
- C7: Date, Error, string, número e null voltam como vieram (toBe).
- C8: objeto sem protótipo (criado com `Object.create(null)`) também é objeto simples: a chave sensível dele vira REDACTED.

## Notas de fechamento
- `biaBudget: 6` é exceção: 3 requisições se perderam porque a etapa de testes rodou os checks contra uma implementação na árvore, e não contra o stub (falha do harness). O custo normal de uma feature é 2 a 3 (testes em lote, um reparo, auditoria).
- A cobertura de 100% só passou a ser medida no fechamento: o `vitest.config.ts` ainda excluía o `redact.ts` (trava do stub), e o check dava 0/0 e verde.
- Furo achado na revisão do Claude: `{ constructor: "x", cpf: "123" }` não é tratado como objeto simples e sai sem redação. Vai para um cartão de correção (teste C9 da Bia, correção da Alice).
