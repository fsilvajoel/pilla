# Testes da feature E5-F04

Escritos pela Bia numa chamada (etapa 2, ADR-0014).

| Cenário | Descrição | Cartão | Teste |
|---|---|---|---|
| C1 | RENEWED e RENEGOTIATED bloqueiam o estorno | E5-T09 | returns true for RENEWED / returns true for RENEGOTIATED |
| C2 | ACTIVE, PAID_OFF e WRITTEN_OFF não bloqueiam | E5-T09 | returns false for ACTIVE / returns false for PAID_OFF / returns false for WRITTEN_OFF |
| C3 | PAID_OFF com saldo 1n reabre | E5-T09 | returns true for PAID_OFF with 1n |
| C4 | PAID_OFF com saldo 0n não reabre | E5-T09 | returns false for PAID_OFF with 0n |
| C5 | ACTIVE com saldo 500n não reabre | E5-T09 | returns false for ACTIVE with 500n |

Reparos em lote: 0. Checks: todos verdes

Arquivos (sha do blob):
- `apps/api/src/lending/domain/reversal.test.ts` 84f1e86eb462747d0b3d2b2f8c265f17cb3cdac6
