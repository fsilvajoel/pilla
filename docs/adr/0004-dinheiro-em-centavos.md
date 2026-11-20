# ADR-0004 — Dinheiro em centavos inteiros; taxas em decimal

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | [RFC-002](../rfc/RFC-002-motor-de-calculo-financeiro.md) |

## Contexto
Ponto flutuante gera erros de centavos (0,1 + 0,2 ≠ 0,3). Num sistema financeiro, um centavo errado quebra a conciliação.

## Decisão
- Todo valor monetário é um **inteiro em centavos** (tipo `Dinheiro` do M0), no código e no banco.
- Taxas são **decimais de precisão fixa** (4 casas) com periodicidade explícita.
- Arredondamento **meio para cima**, aplicado uma vez por resultado, apenas no M0.
- Divisão em partes coloca o resíduo na última parte.
- Proibido `float`/`double` para dinheiro em qualquer camada (inclusive JSON da API: centavos inteiros ou string decimal).

## Consequências
- Somas sempre fecham.
- Formatação para R$ acontece só na apresentação.

## Alternativas consideradas
- **Decimal com casas**: válido, mas inteiro é mais simples e portável entre linguagens/banco.
