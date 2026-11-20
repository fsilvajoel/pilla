# Testes da feature E7-F02

Escritos na etapa 2 (E7-T04 e E7-T06), contra a casca do HEAD (todos vermelhos no `expect-red`).

| Cenário | Critério | Descrição | Cartão | Teste |
|---|---|---|---|---|
| C1 | A1 | termos padrão viram "6,33", "2,00", "1,00", "0" | E7-T04 | fills the default terms |
| C2 | A2 | exemplo da RFC-004 §5 vira o corpo completo | E7-T04 | builds the RFC-004 example |
| C3 | A3 | observações internas só quando digitadas | E7-T04 | keeps the internal notes |
| C4 | A4 | sem cliente (`ZodError`), multa sem vírgula (`MoneyError`) | E7-T04 | rejects bad input |
| C5 | A1 | tela com valores iniciais dos termos padrão | E7-T06 | starts with the default terms |
| C5b | A1 | tela com os campos rotulados, sem campo de conta | E7-T06 | shows the labelled fields |
| C5c | A2 | envio do exemplo chama `onSubmit` e mostra o status | E7-T06 | creates the RFC-004 example |
| C5d | A3 | multa "3,00" vira `lateFeeBps` 300 | E7-T06 | adjusts a default |
| C5e | A4 | envio sem cliente mostra o alerta e não chama `onSubmit` | E7-T06 | asks for the client |

Observação: a tela não tem campo de conta (decisão de 19/11 §4; a conta sai na ativação, RF-12), conferido por `queryByLabelText("Conta")`.
