# Testes da feature E5-F02

Escritos na etapa 2 (E5-T05), contra a casca do HEAD (todos vermelhos no `expect-red`).

| Cenário | Critério | Camada | O que prova | Teste |
|---|---|---|---|---|
| C1 | A1 | unit | pessoa só com nome, CPF e telefone recebe os padrões: e-mail, nascimento, indicador e observações nulos, ativa, versão 1 | C1 (A1) |
| C2 | A2 | unit | pessoa com todos os campos e indicador guarda cada valor; CPF nulo e indicador igual ao id da indicadora | C2 (A2) |
| C3 | A3 | unit | CPF repetido é rejeitado pelo banco e o erro sobe | C3 (A3) |
| C4 | A4 | unit | pessoa gravada por SQL é lida com campos em camelCase, padrões e `createdAt` como data | C4 (A4) |
| C5 | A4 | unit | id inexistente devolve `null` | C5 (A4) |

Arquivo: apps/api/src/people/infra/person-repository.test.ts (unit). Sem e2e.
