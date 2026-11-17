# E5-F01: base dos comandos da api (id UUID v7 e registro de auditoria)

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E5.yaml`; referência: RFC-004 §2, RFC-005 §1 e §2, ADR-0006, RFC-001 §5.

## Escopo

- E5-T01 (Bia): `apps/api/src/core/public/ids.test.ts`, os testes de `uuidV7` e `newId`.
- E5-T02 (Alice): `apps/api/src/core/public/ids.ts` (UUID v7 da RFC 9562 §5.7, sem dependência nova) e a saída da trava do stub no `vitest.config.ts`.
- E5-T03 (Bia): `apps/api/src/core/public/audit.test.ts`, os testes de `recordAudit` contra o PGlite migrado.
- E5-T04 (Alice): `apps/api/src/core/public/audit.ts` (insert em `core.audit_log`) e a saída da trava do stub.
- Fora: vocabulário de `action`/`entityType`, ator sem autenticação, auditoria dentro de transação de caso de uso e qualquer outro arquivo (decisões do Joel, lista do relatório de 17/11).

## Riscos

- Teste que refaz o algoritmo do UUID ou calcula o esperado: barrado por `check-test-quality.mjs`; os esperados são o vetor da RFC 9562 A.6 e os limites (tudo zero, tudo um).
- Teste que passa contra o stub: barrado pelo `expect-red.mjs`.
- Ramo inalcançável por causa do `noUncheckedIndexedAccess` (índice em `Uint8Array`): o hint do E5-T02 manda usar `DataView`.
- Cobertura 0/0 com a trava do stub ainda no `vitest.config.ts`: o último cartão de cada arquivo remove a linha e o check exige 100% (e4-guardrails, erro 17).

## Dependências

- Cascas no HEAD (lançam `not implemented`): `ids.ts` com `// @stub E5-T02` e `audit.ts` com `// @stub E5-T04`, `ActorType` e `AuditEntry` completos.
- Linhas de exclusão das duas cascas em `coverage.exclude` do `apps/api/vitest.config.ts`.
- Tabela `core.audit_log` já migrada (RFC-005 §2) e `migratedTestDb` em `apps/api/src/db/test-db.ts`.

## Critérios de aceite

- A1: `uuidV7` devolve o texto do vetor da RFC 9562 A.6 e respeita versão 7 e variante 10 nos limites.
- A2: `uuidV7` lança `RangeError` para tempo fora de 48 bits, não inteiro ou negativo, e para random diferente de 10 bytes.
- A3: `newId` gera UUID v7 válido, distinto a cada chamada, com o tempo da chamada.
- A4: `recordAudit` grava a entrada como veio, com nulos, e o erro do banco sobe sem tratamento.
- A5: todos os testes passam com 100% de linhas e ramos de `ids.ts` e `audit.ts`; typecheck e lint verdes; nenhuma linha `@stub` nem exclusão no `vitest.config.ts`.

## Cenários

- C1: `uuidV7(1645557742000, 7c c3 98 c4 dc 0c 0c 07 39 8f)` dá `017f22e2-79b0-7cc3-98c4-dc0c0c07398f`.
- C2: tempo 0 com bytes zero dá `00000000-0000-7000-8000-000000000000`; tempo máximo com bytes 0xff dá `ffffffff-ffff-7fff-bfff-ffffffffffff`.
- C3: random de 9 ou 11 bytes e unixMs -1, 1.5 ou 2^48 lançam `RangeError`.
- C4: `newId` casa com o regex de UUID v7 e duas chamadas diferem.
- C5: o tempo de `newId` fica entre `Date.now` antes e depois da chamada.
- C6: entrada ADMIN completa é lida de volta igual em `core.audit_log`.
- C7: entrada SYSTEM com `actorId`, `before` e `ip` nulos é lida de volta com nulos.
- C8: o mesmo id duas vezes é rejeitado (chave primária).
