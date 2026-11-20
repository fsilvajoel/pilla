# Testes da feature E7-F04

Escritos na etapa 2 (E7-T11 e E7-T13), contra a casca do HEAD (todos vermelhos no `expect-red`).

| Cenário | Descrição | Cartão | Teste |
|---|---|---|---|
| C1 | exemplo RFC-004, sem `receipt` | E7-T11 | builds the RFC-004 payment |
| C2 | os quatro métodos passam | E7-T11 | accepts the four methods |
| C3 | valor fora do formato (`MoneyError`) ou não positivo (`ZodError`) | E7-T11 | rejects a bad amount |
| C4 | data, chave e contrato inválidos (`ZodError`) | E7-T11 | rejects a bad date, account and loan |
| C4b | sem restrição de data nem valor máximo | E7-T11 | does not limit the date nor the amount |
| C5 | tela com contrato, saldo e quatro campos, sem Comprovante | E7-T13 | shows the loan and the fields |
| C6 | envio do exemplo e envio com CASH | E7-T13 | registers the RFC-004 payment / accepts cash |
| C7 | valor inválido e chave Pix vazia | E7-T13 | rejects a bad amount / rejects an empty Pix key |
| C8 | contrato fechado bloqueia; WRITTEN_OFF mantém o formulário | E7-T13 | blocks a paid off contract / blocks a renewed contract / blocks a renegotiated contract / blocks a cancelled contract / keeps the form for a written off contract |

Observação: o plano previa um `it` para os quatro status fechados e um para o ACTIVE; aqui há um `it` por status
fechado (mensagem de falha mais clara). ACTIVE é o status do `exampleLoanDetail`, já exercitado em C5 a C7.
