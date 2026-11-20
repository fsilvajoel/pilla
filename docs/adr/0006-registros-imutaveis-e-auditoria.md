# ADR-0006 — Registros financeiros imutáveis e auditoria

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | [RFC-001](../rfc/RFC-001-dominios-e-integracao.md) |

## Contexto
Dinheiro exige rastreabilidade: quem lançou, quando, e o que mudou. Apagar ou editar um pagamento destrói o histórico.

## Decisão
- Movimentações, alocações e pagamentos confirmados são **append-only**: correção = **lançamento compensatório** (estorno, ajuste) com justificativa.
- Contrato ATIVO não é editado; mudanças geram novo contrato vinculado (renegociação/renovação).
- Nenhuma exclusão física de dados de negócio; exclusão lógica quando aplicável.
- Toda ação de escrita gera **registro de auditoria** (usuário, data, antes/depois) pelo componente único do M0.

## Consequências
- Histórico completo e conciliável.
- Volume de dados cresce; aceitável.
- LGPD: pedido de eliminação de dados pessoais é atendido por **anonimização** da Pessoa, preservando os registros financeiros.

## Alternativas consideradas
- **CRUD com update/delete livre**: simples, sem rastreabilidade.
- **Event sourcing completo**: mais poderoso, mas complexo demais para o MVP; pode ser estudado num módulo depois.
