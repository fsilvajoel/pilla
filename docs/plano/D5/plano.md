# Plano D5: cursor da lista de pessoas e lower() do Postgres

## Escopo
Corrige o defeito [D5](../../defeitos/D5.md). Entra: `apps/api/src/people/infra/person-list.ts` e o teste
`person-list.d5.test.ts`. Fica de fora: busca mista letra+dígito com prefixo de CPF e cursor com id não-UUID.

## Contrato
- `apps/api/src/people/infra/person-list.ts`: `listPersons(db, query): Promise<PersonListPage>` (inalterado). O cursor
  continua opaco; a chave de ordenação dentro dele vem do Postgres.

## Arquivos de produção
| Arquivo | Domínio |
|---|---|
| `apps/api/src/people/infra/person-list.ts` | não |

## Domínio das entradas
| Entrada | Formato aceito | Mínimo | Máximo | Exemplos rejeitados | Erro esperado | Fonte |
|---|---|---|---|---|---|---|
| `fullName` (ordenação/cursor) | texto Unicode qualquer | 1 caractere | sem novo limite | nenhum (nada novo é rejeitado) | n/a | E5-F05 |

## Critérios de aceite
### A1: paginação com caracteres não ASCII não repete nem pula
- entrada: "ΟΔΥΣΣΕΑΣ", "Ωμέγα Souza", "Éder Lima", "Bruno Paz"; `limit: 1`
- domínio: `fullName`
- saída: 4 itens no total, cada um uma vez
- erro: nenhum
- fonte: D5 (reprodução)
- camada: unit

## Cenários
- C1 (A1, unit): paginar de 1 em 1 devolve as 4 pessoas exatamente uma vez (fonte D5)

## Arquivos de teste previstos
- `apps/api/src/people/infra/person-list.d5.test.ts` (pacote `@pilla/api`; camada unit)

Regressão: `person-list.test.ts` (E5-F05) roda junto, sem alteração.

## Pendências
- nenhuma
