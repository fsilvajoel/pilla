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

# Revisão final E7-F04

revisor: Claude (orquestração, 19/11)
arquivos: `apps/web/lib/payment-draft.ts`, `apps/web/components/payment-form.tsx`; testes assinados sem alteração.

## Critérios de aceite
- [x] A1..A4b: `toPaymentDraft` converte com `parseReais` e valida com `paymentFieldsSchema.parse`, sem regra de data nem
  de valor máximo. Testes verdes.
- [x] A5..A7: tela com quatro campos (Chave Pix de destino como texto), sem Comprovante; sucesso e erro com
  `role="status"` e `role="alert"`; `onSubmit` só no sucesso.
- [x] A8: PAID_OFF, RENEWED, RENEGOTIATED e CANCELLED mostram o alerta e não renderizam formulário; WRITTEN_OFF, ACTIVE e
  DRAFT aceitam.

## Gates (19/11)
| Gate | Resultado |
|---|---|
| `expect-red` | PASS (15 testes, todos falhando contra a casca) |
| `tests-reviewed --sign` | PASS (2 testes, sha assinado) |
| `coverage` | PASS (100% nos dois arquivos) |
| `mutation` | PASS (payment-draft.ts 100%) |
| `e2e` | PASS (nenhum critério e2e) |

## Diff
- Removidos os marcadores `@stub E7-T12` e `@stub E7-T14` e as duas exclusões de cobertura do `vitest.config.ts`.
- Sem `any`, `as` solto, `!`, `@ts-*` ou segredos.

## Achados
- nenhum.

## Defeitos abertos
- nenhum.

## Veredito
aprovado
