# Testes da feature E4-F04

Escritos pela Bia numa chamada (etapa 2, ADR-0014).

| Cenário | Descrição | Cartão | Teste |
|---|---|---|---|
| C9 | objeto literal com chave própria constructor é tratado como objeto simples e tem chaves sensíveis redigidas | E4-T08 | redacts sensitive keys and keeps constructor and name keys |
| C10 | o mesmo objeto, dentro de outro objeto e dentro de um array, também é redigido | E4-T08 | redacts sensitive keys in nested object / redacts sensitive keys in object inside array |

Reparos em lote: 0. Checks: todos verdes

Arquivos (sha do blob):
- `apps/api/src/log/redact-prototype.test.ts` eb4282abc4a967dc5d8045ca412e02ebeeb3e576
