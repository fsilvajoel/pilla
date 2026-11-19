# Revisão dos testes E7-F02

revisor: subagente independente (general-purpose, sonnet, 19/11), que não escreveu os testes; somente leitura.

## Conferência
- [x] A1..A4 têm cenário na camada `unit`; os 9 nomes do `estado.json` batem com os `it(...)`.
- [x] Imports iguais às linhas fechadas dos cartões E7-T04 e E7-T06.
- [x] Valores esperados vêm do plano e da RFC-004 §5; `toStrictEqual` na lib; `internalNotes` conferido com e sem texto.
- [x] Rejeições: `personId` vazio (`ZodError`), `lateFee` "2" (`MoneyError`), tela sem cliente (alerta, sem `onSubmit`).
- [x] Sem asserção vazia, teste pulado ou `any`; submit assíncrono com `findByRole` guardado; um `render` por teste.
- [x] Sem campo de conta na tela (`queryByLabelText("Conta")` nulo; decisões de 19/11 §4).
- [x] `expect-red`: PASS (9 testes, todos falhando contra a casca).

## Achados (baixos, não bloqueantes)
- `gracePeriodDays` e `lateInterest` só com valores padrão; `newLoanFormDefaults` só com `mockDefaultTerms`.
- O gate de mutação cobre `new-loan.ts`; se sobreviver mutante, acrescentar caso.

## Veredito
aprovado

# Revisão final E7-F02

revisor: subagente independente (general-purpose, sonnet, 19/11), que não escreveu o código; somente leitura.
arquivos: `apps/web/lib/new-loan.ts`, `apps/web/components/new-loan-form.tsx`, `apps/web/vitest.config.ts`; testes assinados sem alteração.

## Rodada 1: reprovado
- Achado alto: as duas exclusões de cobertura de `new-loan.ts` e `new-loan-form.tsx` continuavam no `vitest.config.ts`
  (o `sed` procurou `@stub`, mas as linhas diziam `stub` sem `@`). Corrigido na hora; sem defeito aberto.

## Rodada 2 (mesmo revisor, após a correção)
- [x] A1..A4: defaults com `formatReais(cents(BigInt(bps)))`; corpo da RFC-004 §5 com `toStrictEqual`; `internalNotes` só quando
  digitado; sem cliente dá `ZodError` e o alerta; multa sem vírgula dá `MoneyError`.
- [x] Sem campo de conta (decisões de 19/11 §4); rótulos em `<label>`, `role="status"` e `role="alert"`.
- [x] Marcadores `@stub E7-T05` e `E7-T07` e as duas exclusões de cobertura removidos; imports só os do `done` dos cartões.
- [x] Sem `any`, `as`, `!`, `@ts-*` ou segredos.

## Gates (19/11)
| Gate | Resultado |
|---|---|
| `expect-red` | PASS (9 testes, todos falhando contra a casca) |
| `tests-reviewed --sign` | PASS (2 testes) |
| `coverage` | PASS (100% nos dois arquivos) |
| `mutation` | PASS (new-loan.ts 100%, 16/16) |
| `e2e` | PASS (nenhum critério e2e) |

## Achados
- nenhum pendente.

## Defeitos abertos
- nenhum.

## Veredito
aprovado
