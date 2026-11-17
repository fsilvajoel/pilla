# Testes da feature E5-F03

Escritos pela Bia numa chamada (etapa 2, ADR-0014).

| Cenário | Descrição | Cartão | Teste |
|---|---|---|---|
| C1 | PAID_OFF, RENEWED, RENEGOTIATED e CANCELLED dão true | E5-T07 | returns true for PAID_OFF |
| C1 | PAID_OFF, RENEWED, RENEGOTIATED e CANCELLED dão true | E5-T07 | returns true for RENEWED |
| C1 | PAID_OFF, RENEWED, RENEGOTIATED e CANCELLED dão true | E5-T07 | returns true for RENEGOTIATED |
| C1 | PAID_OFF, RENEWED, RENEGOTIATED e CANCELLED dão true | E5-T07 | returns true for CANCELLED |
| C2 | ACTIVE dá false | E5-T07 | returns false for ACTIVE |
| C3 | WRITTEN_OFF dá false (RN-C20) | E5-T07 | returns false for WRITTEN_OFF |

Reparos em lote: 0. Checks: todos verdes

Arquivos (sha do blob):
- `apps/api/src/lending/domain/loan-status.test.ts` 9d20132123e34a174eb6a24c38989098feca71a8
