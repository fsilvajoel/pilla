# Revisão final E5-F01

revisor: Claude (orquestração, 19/11)
arquivos: `apps/api/src/core/public/ids.ts` e `audit.ts`; testes assinados `ids.test.ts` e `audit.test.ts`.

## Critérios de aceite
- [x] A1: `uuidV7` dá o vetor da RFC 9562 A.6 e respeita versão 7 e variante 10 nos limites (C1, C2).
- [x] A2: `RangeError` para tempo fora de 48 bits, não inteiro ou negativo e para random diferente de 10 bytes (C3).
- [x] A3: `newId` gera UUID v7 válido, distinto, com o tempo da chamada (C4, C5).
- [x] A4: `recordAudit` grava como veio, com nulos, e o erro do banco sobe (C6, C7, C8).
- [x] A5: 100% de linhas e ramos; sem `@stub` nem exclusão em `apps/api/vitest.config.ts`; suíte da api 252/252.

## Gates (19/11)
| Gate | Resultado |
|---|---|
| `expect-red` | PASS (13 testes, todos falhando contra os stubs de ids.ts e audit.ts; implementações restauradas) |
| `tests-reviewed --sign` | PASS (2 testes assinados) |
| `coverage` | PASS (100% em ids.ts e audit.ts) |
| `mutation` | PASS (94,12%, 32/34; mínimo 80%) |
| `e2e` | PASS (nenhum critério e2e) |

## Diff
- `ids.test.ts` C5: `id.replaceAll("-", "")` (correção do C5 da Bia, autorizada pelo Joel); por isso o sha foi assinado agora.
- `ids.ts` implementado com `DataView`, sem dependência nova; removida a exclusão do stub no `vitest.config.ts`.
- Estado migrado para o formato novo (A1 a A3 com unit e mut; A4 unit).

## Achados
- Mutantes sobreviventes: L9 e L12 de `ids.ts`, só o texto das mensagens de `RangeError` (o teste confere o tipo, não a mensagem). Sem impacto de comportamento.

## Defeitos abertos
- nenhum.

## Veredito
aprovado
