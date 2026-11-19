# Revisão final E7-F03

revisor: Claude (orquestração, 19/11)
arquivos: `apps/web/components/loan-list.tsx`, `apps/web/components/loan-detail.tsx`; testes assinados
`loan-list.test.tsx` (bf474e4...) e `loan-detail.test.tsx` (4f9349f...), sem alteração.

## Critérios de aceite
- [x] A1: `loan-list.tsx` mostra link do contrato para `/emprestimos/<id>`, valores `R$ ` + `formatReais`, vencimento
  dd/mm/aaaa e "Em dia" via `loanStandingLabel`. Teste "shows the RFC-004 loan" verde.
- [x] A2: contrato quitado mostra "Quitado" e "—"; lista vazia mostra "Nenhum contrato."; link "Novo contrato" para
  `/emprestimos/novo`. Testes "shows a closed loan" e "shows an empty list" verdes.
- [x] A3: `loan-detail.tsx` mostra título "Contrato 2026-0012" e o resumo em `dl`/`dt`/`dd` com 5.000,00, 1.900,00,
  6.900,00, 2.300,00 e 4.600,00. Teste "shows the summary" verde.
- [x] A4: parcela 14/12/2026 "Paga" e 14/02/2027 com 1.150,00 "Aberta". Teste "shows the installments" verde.
- [x] A5: link "Registrar pagamento" só com status ACTIVE (testes "links the payment..." e "hides the payment link of a
  draft"); typecheck e lint do `@pilla/web` limpos; cobertura 100% (mínimo do plano 85%).

## Gates (19/11)
| Gate | Resultado |
|---|---|
| `expect-red` | PASS (7 testes, todos falhando contra stubs temporários `not implemented`; implementação restaurada, sha conferido) |
| `tests-reviewed --sign` | PASS (2 testes, sha assinado) |
| `coverage` | PASS (100% em loan-list.tsx e loan-detail.tsx) |
| `mutation` | PASS (nada a medir: `domainSources` vazio, telas) |
| `e2e` | PASS (nenhum critério e2e) |
| `pnpm verify` | vermelho só em `@pilla/api#test` por `src/core/public/ids.ts` (stub E5-T02, E5-F01), fora desta feature; `@pilla/web` verde |

## Diff
- `loan-list.tsx`: removido o marcador `@stub E7-T09`; `apps/web/vitest.config.ts`: removida a exclusão de cobertura do stub.
- Estado migrado para o formato novo (criteria A1..A5, scenarios com camada e critério).
- Sem `any`, `as` solto, `!`, `@ts-*` ou segredos nos dois componentes (o `as const` de `summaryItems` é de literal).

## Achados
- nenhum.

## Defeitos abertos
- nenhum.

## Veredito
aprovado
