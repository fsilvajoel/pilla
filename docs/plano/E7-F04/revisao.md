# Revisão dos testes E7-F04

revisor: Claude (orquestração, 19/11; mesma sessão que escreveu os testes, revisão contra o plano)

## Conferência
- [x] Todo critério A1..A8 (inclusive A4b) tem cenário na camada `unit` e teste de nome igual ao do `estado.json`.
- [x] Valores esperados vêm do plano (115000, "chave-pix@exemplo.com", 9000000000); `toStrictEqual` no draft; `toThrow`
  só com classe (`MoneyError`, `ZodError`).
- [x] Rejeições por entrada: amount ("1150", "1.150,5", "0,00", "-5,00"), paidAt ("2026-02-30"), destinationKey (""),
  loanId ("abc"); na tela, Valor "1150" e chave vazia.
- [x] Sem `userEvent`, sem `getByText` para h1/botão, submit assíncrono com `findByRole` guardado; `queryBy*` nulo
  para Comprovante e para o formulário fechado.
- [x] Sem asserção vazia, teste pulado ou `any`; `check-test-quality`, typecheck, lint e prettier verdes.
- [x] `expect-red`: PASS (15 testes, todos falhando contra a casca).

## Veredito
aprovado
