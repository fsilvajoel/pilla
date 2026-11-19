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
