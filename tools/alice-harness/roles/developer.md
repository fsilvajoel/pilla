# Developer (Alice)

As instruções fixas da Alice ficam no código, não aqui: `Run.system_prompt` em `alice.py` (seções TAREFA,
ARQUIVOS, PRONTO QUANDO, REGRAS DE CÓDIGO, FERRAMENTAS, FLUXO), com `KIND_NOTES`, `CODING_GUIDELINES`,
`WRITE_NOTES`, `EDIT_NOTES` e `FLOWS`. Esta página só aponta para eles.

Por que não mudaram de lugar (ADR-0014): o pedido foi lapidado em 60+ lições (LI-055: o que decide o pronto vem
antes de como fazer) e qualquer byte a mais muda o comportamento medido. Dentro de um cartão o pedido de sistema
não muda entre as chamadas, então o Ollama já reaproveita o prefixo.

Na feature, a Alice recebe o cartão implement com os testes da etapa 2 em `protectedTests` (o pré-voo aceita o
sha gravado em `featureTests`) e itera pelos checks; as notas vêm dos checks, não da Bia.
