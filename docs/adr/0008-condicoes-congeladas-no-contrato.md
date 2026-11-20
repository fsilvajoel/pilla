# ADR-0008 — Condições congeladas no contrato

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | [PRD-001](../prd/PRD-001-mvp-gestao-emprestimos.md) RF-40/41, RN-C12 |

## Contexto
Multa, mora, carência e taxa têm valores padrão ajustáveis em formulário. Se o contrato apenas apontar para o padrão, mudar o formulário alteraria retroativamente contratos já firmados.

## Decisão
- Na criação do contrato, todas as condições (taxa, multa, mora, carência, regra de vencimento) são **copiadas** para o próprio contrato.
- Ajustes por contrato são permitidos só em RASCUNHO.
- Os parâmetros padrão têm histórico (`vigente_desde`) e são auditados.

## Consequências
- Contrato é autocontido: recalcular no futuro dá o mesmo resultado.
- Mudança de política vale só para contratos novos.

## Alternativas consideradas
- **Referência ao parâmetro global**: efeito retroativo indesejado.
