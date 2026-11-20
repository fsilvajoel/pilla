# ADR-0009 — Funcionalidades opcionais como módulos plugáveis

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | [PRD-001](../prd/PRD-001-mvp-gestao-emprestimos.md) §4 (score fora do MVP) |

## Contexto
Score/risco, cobrança automática e relatórios são desejados, mas não entram no MVP. Eles não podem exigir mudanças nos módulos centrais quando chegarem.

## Decisão
- Funcionalidades opcionais são **módulos separados** que **só consomem eventos** e consultas públicas; não alteram dados de outros módulos.
- Os módulos centrais já publicam os eventos que esses módulos precisarão (`ParcelaVencida`, `PagamentoConfirmado`, `ContratoQuitado`…), mesmo sem consumidor no MVP.
- Cada módulo opcional pode ser ligado/desligado por configuração (*feature flag*).
- Primeiro candidato: **M5 Risco (Score)** — histórico append-only de pontos (pessoa, data, pontos, motivo, origem) com pesos parametrizáveis; no início apenas informa, não bloqueia.

## Consequências
- Ligar o score depois = novo módulo + reprocessar eventos históricos para montar o histórico inicial.
- Exige manter o catálogo de eventos estável e versionado (ADR-0003).

## Alternativas consideradas
- **Campos de score dentro de Pessoa**: mistura domínios e engessa o cálculo.
