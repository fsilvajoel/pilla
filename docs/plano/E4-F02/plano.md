# E4-F02: redact de campos sensíveis no log

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E4.yaml`; referência: RFC-003 §4.1.

## Escopo

- E4-T03 (Bia): `apps/api/src/log/redact.test.ts`, os testes de `redact` e `REDACTED`.
- E4-T04 (Alice): `apps/api/src/log/redact.ts`, a implementação, mantendo os comentários `/** */` do stub.
- Fora: ligar o `redact` no logger (cartão próprio) e qualquer outro arquivo.

## Riscos

- Teste que refaz o algoritmo ou calcula o esperado: barrado por `check-test-quality.mjs` e pela auditoria.
- Teste que passa contra o stub: barrado pelo `expect-red.mjs`.
- Implementação que muta a entrada ou trata `Date`/`Error` como objeto simples: cenários C6 e C7.
- Cobertura incompleta: o check do E4-T04 exige 100% de linhas e ramos da implementação.

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
