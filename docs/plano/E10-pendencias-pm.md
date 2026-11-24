# E10: pendências de PM

Perguntas que os docs aprovados não respondem, para o Joel (PM). Cada uma traz a resposta padrão sugerida; o refinamento só a aplica depois do ok. Formato da fila: `docs/plano/pendencias-pm.md`.

## 1. Conta na ativação de renovação e renegociação (E10-F04)
- status: aberta
- pergunta: renovar e renegociar não movimentam dinheiro (RN-C16, RN-C18), mas `activateLoanRequest` exige `accountId` e o banco exige conta em contrato ACTIVE (RN-C05). Qual conta usar na ativação desses contratos?
- opções: a) o ADMIN escolhe a conta na ativação, como no contrato normal; b) a API herda a conta do contrato de origem e a tela não pergunta
- sugestão padrão: b) herdar a conta da origem, porque não há dinheiro envolvido e evita pergunta inútil
- resposta:

## 2. Trocar a pessoa de um rascunho (E10-F03, E10-F12)
- status: aberta
- pergunta: o ADMIN pode trocar a pessoa de um DRAFT já criado?
- opções: a) não, cancela e cria outro; b) sim, `personId` entra no PATCH
- sugestão padrão: a) não (o `updateLoanRequest` atual recusa `personId`); evita reavaliar o aviso RN-C11
- resposta:

## 3. PATCH sem `If-Match` (E10-F03)
- status: aberta
- pergunta: o que responder quando o cabeçalho falta: 428 ou 409?
- opções: a) 428 Precondition Required; b) 409 `VERSION_CONFLICT`
- sugestão padrão: b) 409 `VERSION_CONFLICT`: a RFC-004 §6 só define 409 para `If-Match` desatualizado e não prevê 428; o web trata um erro só
- resposta:

## 4. Ordenação e tamanho da lista de contratos (E10-F05)
- status: aberta
- pergunta: qual a ordem padrão e o tamanho da página em `GET /loans`?
- opções: a) mais recentes primeiro, 20 por página; b) por próximo vencimento
- sugestão padrão: a) mais recentes primeiro (número do contrato decrescente), 20 por página
- resposta:

## 5. Confirmação da baixa como perda (E10-F09)
- status: aberta
- pergunta: a baixa pede uma segunda confirmação além do motivo, já que não tem desfazer no MVP?
- opções: a) só o motivo obrigatório; b) motivo mais caixa de confirmação "entendo que não há desfazer"
- sugestão padrão: b) com confirmação, pelo custo do erro (RN-C19)
- resposta:
