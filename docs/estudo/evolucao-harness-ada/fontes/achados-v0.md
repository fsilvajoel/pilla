# Achados: orquestração de três agentes (Claude, Bia, Alice)

Resumo para o estudo de caso e os artigos, atualizado em 16/11/2026. Fonte única: [fatos-v0.md](fatos-v0.md) (rodadas 11 e 12, "Orquestração por feature" e "Prova 2"). Rascunho da Alice (local, 112 s, 3.654 entrada / 966 saída), revisado pelo Claude (4 erros factuais corrigidos).

## Contexto

O pilla é construído por três agentes:
- **Claude**, o tech lead pago, planeja e revisa.
- **Bia**, um modelo grande no OpenRouter (cota grátis de 50 requisições por dia), escreve e audita os testes.
- **Alice**, um modelo local na GPU (grátis), implementa.

A pergunta do estudo é quanto do trabalho dá para tirar do agente pago sem perder qualidade, e onde o fluxo trava.

## O que mudamos

- **Laço automático** (`plan-run --rounds N`): Alice, checks, revisão e notas giram sozinhos até aprovar ou esgotar as rodadas. O Claude só entra no começo e no fim.
- **Testes com a Bia**: quem escreve o teste é o modelo grande, não a Alice.
- **Fluxo por feature** (ADR-0014), em 5 etapas:
  1. o Claude escreve o plano com cenários numerados;
  2. a Bia escreve todos os testes numa chamada;
  3. a Alice implementa;
  4. a Bia audita numa chamada;
  5. o Claude aprova.

## Números

| | Manual (15/11) | Laço automático (rodadas 11 e 12) | Por feature, prova 1 | Por feature, prova 2 |
|---|---|---|---|---|
| Requisições da Bia | ≈10 | 3 e 5 | 1 | 0 |
| Custo do Claude | 330 turnos, ≈5M | ≈0,6M e ≈0,4M | ≈3,07M (construção do fluxo, uma vez) | – |
| Testes | nunca passaram do portão | `error` e `escalated` | todos os checks verdes em 1 requisição e 28 s | já prontos |
| Implementação (Alice) | – | não chegou | falhou: 36 chamadas, 971 s, 2,48M de entrada | falhou: 35 chamadas, 616 s, 1,92M de entrada |

O custo do Claude está em tokens equivalentes: entrada 1, gravação de cache 1,25, leitura de cache 0,1, saída 5.

## O que deu errado

- **Rodadas 11 e 12:** o portão local por consenso de amostras deu `error` (amostra sem JSON) e depois reprovou três vezes sem nenhuma nota com apoio no pronto.
- **Prova 1:** os testes fecharam, mas a Alice estourou o limite de chamadas no cartão de implementação.
- **Prova 2:** o cartão foi dividido ao meio. A Alice gastou quase o mesmo número de chamadas (35 contra 36), sem nenhum erro de ferramenta, para metade da função.

## Lições

1. **O custo pago é turno do Claude.** 64% do custo é releitura de contexto. Tirar o Claude do laço entre rodadas cortou a leva de ≈5M para ≈0,4–0,6M.
2. **Plano com cenários + modelo grande escrevendo teste funciona.** Uma requisição fechou o que 12 rodadas por cartão não fecharam.
3. **Juiz local ruidoso não pode bloquear sozinho.** Reprovação sem nota apoiada passou a valer como inconclusiva, não como rodada gasta.
4. **Tamanho não é o único limite.** O modelo de tamanho mede se arquivo e resposta cabem na janela, mas não quantos passos a tarefa pede. Cada passo reenvia o histórico: 35 chamadas viraram 1,9M de tokens para ~15 linhas.
5. **Orquestrador custa caro uma vez.** Construir o fluxo por feature custou ≈3M de Claude e só se paga quando as features fecharem. Até agora nenhuma fechou a implementação.

## Próximos passos

- Diagnosticar, numa sessão própria e num cartão descartável, por que a Alice não converge. Hipótese não verificada: um check que nunca fica verde.
- Fechar a E4-F02 (E4-T04, E4-T05, auditoria e aprovação) e medir a primeira feature completa.
- Comparar com o Claude fazendo a mesma tarefa sozinho (custo × qualidade × tempo).
