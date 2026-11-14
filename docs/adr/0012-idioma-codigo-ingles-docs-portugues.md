# ADR-0012 — Código em inglês, documentação em português

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | Decisão do Joel |

## Contexto
As regras de negócio estão escritas em português (contrato, parcela, quitação). Sem uma regra, cada agente escolheria um idioma para os nomes no código e o resultado seria uma mistura (`Contrato.dueDate`, `LoanParcela`).

## Decisão
- **Inglês** em tudo que é código e termo técnico: identificadores, arquivos e pastas, tabelas e colunas, schemas do banco, rotas da API, nomes de eventos, valores de enum, comentários no código, nomes de testes, **mensagens de commit e títulos de PR**.
- **Português (pt-BR)** em: documentação (`docs/`, README, CLAUDE.md), **corpo (descrição) dos PRs** e **todos os textos do sistema exibidos ao usuário** (telas, mensagens de erro, e-mails, WhatsApp). Não há outro idioma de interface no MVP.
- A tradução de cada termo do negócio é **única** e está no [glossário](../glossario.md). Termo novo: entra no glossário antes de entrar no código.
- Textos exibidos ao usuário ficam num arquivo de mensagens (pt-BR), não espalhados no código.

## Consequências
- Código consistente e legível por qualquer ferramenta ou pessoa; documentação acessível ao Joel.
- Os documentos usam termos em português; o agente consulta o glossário para saber o nome no código.
- Siglas brasileiras sem tradução natural ficam como estão: `cpf`, `pix`, `boleto`.

## Alternativas consideradas
- **Tudo em português**: mistura inevitável com frameworks e bibliotecas em inglês.
- **Tudo em inglês, inclusive docs**: dificulta a leitura e a validação pelo dono do produto.

## Histórico
- 2026-11-14: ajustada no mesmo dia, antes de qualquer código, por decisão do Joel (commits e títulos de PR em inglês; corpo do PR em pt-BR).
