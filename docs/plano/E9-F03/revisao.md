# Refinamento funcional E9-F03

refinador: refiner
rodada: 1

## Requisitos
- [x] Todo `A<n>` é observável e está no molde fixo (entrada, domínio, saída, erro, fonte, camada).
- [x] Toda regra tem fonte; toda entrada externa tem linha na tabela de domínio, com rejeição e erro exato.
- [x] Contrato, arquivos de produção, dependências e arquivos de teste previstos bastam para escrever os testes e implementar sem adivinhar.

## Cartões
| Cartão | DoR | DoD |
|---|---|---|
| E9-T04 | ajustado | ajustado |
| E9-T05 | ajustado | ajustado |
| E9-T06 | ajustado | ajustado |

## Veredito
ajustado

## Mudanças
- `docs/plano/E9-F03/plano.md`: completou tipos, imports e assinaturas dos schemas exportados (fonte: plano da feature e contrato fornecido em `packages/schemas/src/api/people/`).
- `docs/plano/E9.yaml` E9-T04: corrigiu refs, readFirst, allowedPaths, testes protegidos e DoD para schemas, CPF nullable, PATCH nullable e `DUPLICATE_CPF` (fonte: decisão Joel de 20/11 e D8).
- `docs/plano/E9.yaml` E9-T05: incluiu os testes de schema no escopo, corrigiu referrer para 404, remoção de normalização mascarada, busca sem acentos, limites, concorrência por `version` e CPF duplicado; adicionou `expect-red` (fonte: decisões Joel de 20/11 e plano E9-F03).
- `docs/plano/E9.yaml` E9-T06: incluiu `person-list.ts` no allowedPaths, listou readFirst e testes protegidos, e alinhou o DoD à implementação sem `If-Match`, `428` ou `ETag` (fonte: decisão Joel de 20/11).
- `docs/plano/E9-F03/plano.md`: removeu pendências técnicas já resolvidas pelos cartões (fonte: ajustes de escopo desta rodada).

## Pendências de PM
- nenhuma
