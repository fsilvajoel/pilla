# ADR-0005 — Valores derivados não são fonte da verdade

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | [PRD-001](../prd/PRD-001-mvp-gestao-emprestimos.md) §1–2 |

## Contexto
Na planilha, saldo, total e situação são digitados e ficaram inconsistentes (sinais trocados, totais que não batem).

## Decisão
- A fonte da verdade são **fatos**: contrato com condições, parcelas geradas, pagamentos, alocações, movimentações.
- Saldo devedor, total pago, situação, status de parcela, encargos, saldo de conta e indicadores são **calculados** pelas funções do M0.
- Visões de leitura/cache (*read models*) são permitidas para desempenho, desde que **reconstruíveis** a partir dos fatos e nunca editadas à mão.

## Consequências
- Impossível ter saldo divergente dos pagamentos.
- Cálculo pode custar mais em consulta; mitigado por read models quando necessário (estudo de escalabilidade).
- Testes de "reconstrução" comparam read model × cálculo a partir dos fatos.

## Alternativas consideradas
- **Armazenar saldo e atualizar a cada operação**: rápido, mas sujeito a divergência.
