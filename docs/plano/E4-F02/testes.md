# Testes da feature E4-F02

Escritos pela Bia numa chamada (etapa 2, ADR-0014).

| Cenário | Descrição | Cartão | Teste |
|---|---|---|---|
| C1 | cada uma das chaves cpf, phone, email, password e token tem o valor trocado por REDACTED | E4-T03 | C1,C2: key cpf is redacted / replaces value with REDACTED (e similarly for phone, email, password, token) |
| C2 | chave que termina com nome sensível, sem diferenciar maiúsculas (accessToken, ownerCpf, userEmail, PASSWORD), vira REDACTED | E4-T03 | C1,C2: key accessToken is redacted / replaces value with REDACTED (e similarly for ownerCpf, userEmail, PASSWORD) |
| C3 | outras chaves mantêm o valor (name, amountCents, id) | E4-T03 | C3: key name keeps its value / returns the same value (e similarly for amountCents, id) |
| C4 | objeto aninhado é redigido em qualquer profundidade | E4-T03 | C4: nested objects / redacts sensitive keys at any depth |
| C5 | objeto dentro de array é redigido | E4-T03 | C5: objects inside arrays / redacts sensitive keys in each array element |
| C6 | a entrada não muda, com array aninhado incluído (comparar com structuredClone feito antes) | E4-T03 | C6: input is not mutated / returns a new object and leaves the original intact, including nested arrays |
| C7 | Date, Error, string, número e null voltam como vieram (toBe) | E4-T03 | C7: non-plain-object values are returned as they came / Date is returned by reference (e similarly for Error, string, number, null) |
| C8 | objeto sem protótipo (criado com Object.create(null)) também é objeto simples: a chave sensível dele vira REDACTED | E4-T03 | C8: object without prototype is treated as plain object / redacts sensitive keys in an object with null prototype |

Reparos em lote: 1. Checks: todos verdes

Arquivos (sha do blob):
- `apps/api/src/log/redact.test.ts` b6571add2936f547d4a5af135aacd88ca6341558
