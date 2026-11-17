# Testes da feature E5-F01

Escritos pela Bia numa chamada (etapa 2, ADR-0014).

| Cenário | Descrição | Cartão | Teste |
|---|---|---|---|
| C1 | uuidV7(1645557742000, 7c c3 98 c4 dc 0c 0c 07 39 8f) dá 017f22e2-79b0-7cc3-98c4-dc0c0c07398f | E5-T01 | gives the RFC 9562 A.6 vector |
| C2 | tempo 0 com bytes zero dá 00000000-0000-7000-8000-000000000000; tempo máximo com bytes 0xff dá ffffffff-ffff-7fff-bfff-ffffffffffff | E5-T01 | gives the zero lower bound / gives the max upper bound |
| C3 | random de 9 ou 11 bytes e unixMs -1, 1.5 ou 2^48 lançam RangeError | E5-T01 | throws RangeError for random length 9 / throws RangeError for random length 11 / throws RangeError for unixMs -1 / throws RangeError for unixMs 1.5 / throws RangeError for unixMs 281474976710656 |
| C4 | newId casa com o regex de UUID v7 e duas chamadas diferem | E5-T01 | matches UUID v7 pattern and two calls differ |
| C5 | o tempo de newId fica entre Date.now antes e depois da chamada | E5-T01 | time in first 12 hex digits is between Date.now before and after |
| C6 | entrada ADMIN completa é lida de volta igual em core.audit_log | E5-T03 | stores ADMIN entry with all fields |
| C7 | entrada SYSTEM com actorId, before e ip nulos é lida de volta com nulos | E5-T03 | stores SYSTEM entry with nullable fields as null |
| C8 | o mesmo id duas vezes é rejeitado (chave primária) | E5-T03 | rejects on duplicate id (primary key) |

Reparos em lote: 0. Checks: todos verdes

Arquivos (sha do blob):
- `apps/api/src/core/public/audit.test.ts` 9dea1c1fb6e36912978e40550e29dee6196b1f76
- `apps/api/src/core/public/ids.test.ts` db8b4eb3baf8a647fd7173fce9a7bfaef6105251
