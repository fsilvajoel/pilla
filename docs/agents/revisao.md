# Revisão do Claude (proporcional ao risco)

> Detalhe do [AGENTS.md](../../AGENTS.md).

| Risco | Exemplos | Revisão |
|---|---|---|
| Baixo | código gerado de tabela (schemas, migrações), componentes simples | diff na diagonal; confia nas travas |
| Médio | regra de negócio coberta por teste | lê a lógica principal; confere IDs e nomes |
| Alto | dinheiro em fluxo entre módulos, autenticação, portal, eventos, migração com dados | leitura completa; pode pedir teste extra |

Checklist: faz sentido com o documento? Há atalho que passa no teste mas viola a regra? Algo inventado (API, opção) sem origem?

