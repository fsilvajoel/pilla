# E5-F02: repositório de pessoas (inserir e ler por id)

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E5.yaml`; referência: PRD-001 RF-01 e RF-04, RFC-005 §3, RN-P01, RN-P02.

## Escopo

- E5-T05 (Bia): `apps/api/src/people/infra/person-repository.test.ts`, os testes de `insertPerson` e `findPersonById`.
- E5-T06 (Alice): `apps/api/src/people/infra/person-repository.ts` (insert e select por id com drizzle) e a saída da trava do stub.
- Fora: caso de uso `createPerson` (códigos de erro de CPF duplicado e indicador inexistente, corpo da resposta), edição, busca e listagem (ordenação, cursor), endereços, PIX e todo o módulo CONTRATOS; dependem das decisões do Joel.

## Riscos

- Teste que monta o esperado a partir da entrada: barrado por `check-test-quality.mjs`; esperados escritos como literais.
- Teste que passa contra o stub: barrado pelo `expect-red.mjs`.
- `birth_date` lido por `client.query` volta como `Date`: o select do teste usa `::text`.
- Campo opcional passado como `undefined` muda o insert do drizzle: o hint manda omitir.
- Cobertura 0/0 com a trava do stub: o E5-T06 remove a linha e o check exige 100%.

## Dependências

- Casca no HEAD: `person-repository.ts` com `// @stub E5-T06`, `NewPersonRow = typeof persons.$inferInsert` e as duas funções lançando.
- Linha de exclusão da casca em `coverage.exclude` do `apps/api/vitest.config.ts`.
- Tabela `people.persons` já migrada (RFC-005 §3), com `cpf` único e opcional e `referred_by_id` para a própria tabela.

## Critérios de aceite

- A1: `insertPerson` grava a linha com os defaults da RFC-005 §3 (`active` true, `version` 1, opcionais nulos).
- A2: indicação (RN-P02) e CPF nulo (RN-P01) são gravados como vieram.
- A3: CPF repetido é rejeitado pelo banco e o erro sobe sem tratamento (RN-P01).
- A4: `findPersonById` devolve a linha em camelCase ou `null`.
- A5: todos os testes passam com 100% de linhas e ramos de `person-repository.ts`; typecheck e lint verdes; nenhuma linha `@stub` nem exclusão no `vitest.config.ts`.

## Cenários

- C1: Maria só com nome, CPF e telefone fica com email, nascimento, indicador e notas nulos, ativa e versão 1.
- C2: João, sem CPF e indicado pela Ana, tem todos os campos gravados e `referred_by_id` igual ao id da Ana.
- C3: Rui Filho com o CPF do Rui é rejeitado.
- C4: Carla, inserida por SQL, é lida por `findPersonById` com os campos em camelCase e `createdAt` do tipo `Date`.
- C5: id inexistente dá `null`.
