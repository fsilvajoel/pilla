# [E5-F02] Repositório de pessoas (inserção e leitura por ID)

<!-- ada-feature:E5-F02 -->

> Entrega **E5** · Etapa: implement · Progresso: 50%
> Gerado dos docs do repositório; não edite à mão (o próximo sync sobrescreve).

## Resumo e escopo

- E5-T05 (Bia): `apps/api/src/people/infra/person-repository.test.ts`, os testes de `insertPerson` e `findPersonById`.
- E5-T06 (Alice): `apps/api/src/people/infra/person-repository.ts` (insert e select por id com drizzle) e a saída da trava do stub.
- Fora: caso de uso `createPerson` (códigos de erro de CPF duplicado e indicador inexistente, corpo da resposta), edição, busca e listagem (ordenação, cursor), endereços, PIX e todo o módulo CONTRATOS; dependem das decisões do Joel.

## Regras e critérios

- **RF-01** ADMIN cadastra/edita pessoa (nome, CPF, telefone, e-mail, nascimento, observações).

- **RF-04** ADMIN vê a ficha da pessoa: contratos, pagamentos, situação, indicados.

Molde: entrada, domínio, saída, erro, fonte, camada.

- A1: `insertPerson(db, {id, fullName, cpf, phone})` sem os demais campos resolve `undefined` e a linha fica com `email`, `birth_date`, `referred_by_id` e `notes` nulos, `active` true e `version` 1. Domínio: tabela acima. Erro: nenhum. Fonte: RFC-005 §3. Camada: unit.
- A2: `insertPerson` com `referredById` de pessoa existente e `cpf` nulo grava todos os campos como vieram. Fonte: RN-P02, RN-P01 (cpf pode ser nulo), RFC-005 §3. Camada: unit.
- A3: `insertPerson` com CPF já gravado rejeita (a promessa falha); o erro do banco sobe sem tratamento, sem tradução nem código próprio. Fonte: RN-P01, RFC-005 §3. Camada: unit.
- A4: `findPersonById(db, id)` devolve a linha com as chaves em camelCase (`PersonRow`: `birthDate` texto `AAAA-MM-DD`, `createdAt` `Date`) ou `null` quando o id não existe. Fonte: PRD-001 RF-04, RFC-005 §3. Camada: unit.
- A5: todos os testes passam com 100% de linhas e ramos de `person-repository.ts`; typecheck e lint verdes; nenhuma linha `@stub` nem exclusão no `vitest.config.ts`. Camada: unit (gate coverage).

## Contrato

Arquivo `apps/api/src/people/infra/person-repository.ts` (infra, sem regra de domínio; `domainSources` vazio). Mesmo molde de `core/public/audit.ts` (E5-F01).

```ts
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { persons, type PersonRow } from "./schema";

export type NewPersonRow = typeof persons.$inferInsert;
export function insertPerson(db: PgDatabase<PgQueryResultHKT>, row: NewPersonRow): Promise<void>;
export function findPersonById(db: PgDatabase<PgQueryResultHKT>, id: string): Promise<PersonRow | null>;
```

Teste: `apps/api/src/people/infra/person-repository.test.ts` (camada `unit`, contra o PGlite migrado de `migratedTestDb`, como `persons.test.ts`). Sem e2e, sem dependência nova.

## Cartões

### E5-T05 — Escreva os testes para insertPerson e findPersonById

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: nenhuma
- Referências: [PRD-001 RF-01](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RF-04](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-005 §3](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md)
- Ler antes: `docs/plano/E5-F02/plano.md`, `apps/api/src/people/infra/person-repository.ts`, `apps/api/src/people/infra/persons.test.ts`

**DoD (definição de pronto)**
- todos os testes falham atualmente contra o stub em HEAD e passariam com uma implementação correta (run_check 0)
- import type { PGlite } from "@electric-sql/pglite";
- import type { PgliteDatabase } from "drizzle-orm/pglite";
- import { afterAll, beforeAll, describe, expect, it } from "vitest";
- import { migratedTestDb } from "../../db/test-db";
- import { findPersonById, insertPerson } from "./person-repository";
- insertPerson de Maria resolve para toBeUndefined e sua linha possui email, birth_date, referred_by_id e notes como null, active como true e versão 1 (padrões RFC-005 §3)
- insertPerson de Ana e depois de João armazena todos os campos de João, seu cpf como null e seu referred_by_id como o id de Ana (RN-P02, RN-P01 permite que cpf seja null)
- após insertPerson de Rui ter sucesso, insertPerson de Rui Filho com o mesmo cpf rejeita.toThrow (RN-P01, cpf único)
- findPersonById de Carla, inserida via SQL, toMatchObject seus campos em camelCase com os padrões e seu createdAt toBeInstanceOf Date (PRD-001 RF-04)
- findPersonById de um id que não está na tabela resolve para toBeNull (PRD-001 RF-04)
- nunca editar apps/api/src/people/infra/person-repository.ts
- Pode alterar: `apps/api/src/people/infra/person-repository.test.ts`
- Verificações:
  - `! pnpm --filter @pilla/api exec vitest run src/people/infra/person-repository.test.ts`
  - `node scripts/check-test-quality.mjs apps/api/src/people/infra/person-repository.test.ts`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- as linhas de import do done são os únicos imports do arquivo, cada nome nelas é utilizado e nada mais é importado
- abrir o banco de dados como persons.test.ts faz, com let db e let client preenchidos antesAll via migratedTestDb e client fechado em afterAll
- Maria possui o id "01970000-0000-7000-8000-000000000001", fullName "Maria Souza", cpf "52998224725", telefone "+5511987654321" e nada mais
- Ana possui o id "01970000-0000-7000-8000-000000000002", fullName "Ana Costa", cpf null, telefone "+5511900000002"
- João possui o id "01970000-0000-7000-8000-000000000003", fullName "João Lima", cpf null, telefone "+5521912345678", email "joao@example.com", birthDate "1985-03-09"
- João também possui referredById "01970000-0000-7000-8000-000000000002" e notes "indicado pela Ana"
- Rui possui o id "01970000-0000-7000-8000-000000000004", fullName "Rui Alves", cpf "11144477735", telefone "+5511900000004"
- Rui Filho possui o id "01970000-0000-7000-8000-000000000005", fullName "Rui Alves Filho", cpf "11144477735", telefone "+5511900000005"
- Carla possui o id "01970000-0000-7000-8000-000000000010", full_name "Carla Dias", cpf "39053344705", telefone "+5531988887777", birth_date "1992-07-01"
- o id desconhecido é "01970000-0000-7000-8000-000000000099"
- insertPerson recebe o banco de dados e um objeto com as colunas das pessoas em camelCase; assim, os campos opcionais não utilizados são omitidos e nunca definidos como undefined
- a consulta select após insertPerson é client.query de "select full_name, cpf, phone, email, birth_date::text as birth_date, referred_by_id, notes, active, version from people.persons where id = $1" com o id, e toEqual está aplicado às rows
- birth_date passa por ::text nessa consulta select, porque uma coluna de data lida bruta pelo client.query retorna como Date, não como texto
- Carla entra com client.query de "insert into people.persons (id, full_name, cpf, phone, birth_date) values ($1, $2, $3, $4, $5)" e seus cinco valores
- findPersonById de Carla retorna birthDate "1992-07-01" como texto, email, referredById, notes e anonymizedAt null, active true e version 1
- cada row e objeto esperado é um literal escrito no teste, nunca construído a partir da entrada
- há um describe para insertPerson com três it e um describe para findPersonById com dois it
- há um write_file do arquivo de teste inteiro, seguido por run_check 0, 1, 2 e 3

### E5-T06 — Implemente insertPerson e findPersonById e remova o esqueleto (stub)

- Tipo: `implement` · Responsável: `alice` · Estado: ready

**DoR (pronto para começar)**
- Depende de: `E5-T05`
- Referências: [PRD-001 RF-01](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RF-04](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-005 §3](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md)
- Ler antes: `docs/plano/E5-F02/plano.md`, `apps/api/src/people/infra/person-repository.ts`, `apps/api/vitest.config.ts`

**DoD (definição de pronto)**
- todos os testes em apps/api/src/people/infra/person-repository.test.ts passam com 100% de cobertura de linha e ramo de person-repository.ts (run_check 0)
- person-repository.ts não possui a linha '// @stub E5-T06' e apps/api/vitest.config.ts não possui nenhuma linha que exclua src/people/infra/person-repository.ts
- import { eq } from "drizzle-orm";
- import { persons, type PersonRow } from "./schema";
- insertPerson aguarda a inserção da linha na tabela persons e retorna nada, sem if, nem try e nem catch, de modo que o erro único de CPF RN-P01 sobe intocado
- findPersonById seleciona de persons onde a coluna id é igual a id, e retorna a primeira linha ou null quando não há nenhuma
- o tipo NewPersonRow, os comentários /** */ e as assinaturas permanecem, enquanto os parâmetros perdem o sublinhado inicial
- as assinaturas são insertPerson(db: PgDatabase<PgQueryResultHKT>, row: NewPersonRow): Promise<void> e findPersonById(db: PgDatabase<PgQueryResultHKT>, id: string): Promise<PersonRow | null> (o mesmo tipo de banco de dados que recordAudit em core/public/audit.ts)
- Pode alterar: `apps/api/src/people/infra/person-repository.ts`, `apps/api/vitest.config.ts`
- Testes protegidos: `apps/api/src/people/infra/person-repository.test.ts`
- Verificações:
  - `pnpm --filter @pilla/api exec vitest run src/people/infra/person-repository.test.ts --coverage --coverage.include=src/people/infra/person-repository.ts --coverage.exclude=none --coverage.thresholds.lines=100 --coverage.thresholds.branches=100`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- o único arquivo lido é apps/api/src/people/infra/person-repository.ts, pois os passos estão nestas dicas
- a linha de import type de ./schema no HEAD torna-se a segunda linha de import do done, que traz persons como um valor, e a linha de import type de drizzle-orm/pg-core permanece
- o import de eq fica acima da linha de import type de drizzle-orm/pg-core
- o insert é db.insert de persons com os valores da row, e o select é db.select de persons com where e eq em persons.id
- a primeira row ou null é o primeiro elemento com ?? null, o único ramo, e os dois testes findPersonById cobrem ambos os lados
- a linha de vitest.config.ts a ser deletada é a que está dentro de coverage.exclude com src/people/infra/person-repository.ts e o comentário stub E5-T06
- uma edição de arquivo person-repository.ts que reescreve as linhas de import, os dois corpos e deleta a linha do stub, uma edição de arquivo apps/api/vitest.config.ts que deleta a linha com o stub E5-T06, em seguida run_check 0, 1 e 2

## Referências

- PRD: [docs/prd/PRD-001-mvp-gestao-emprestimos.md](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md)
- [RFC-005 §3](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md)
- plano.md: [docs/plano/E5-F02/plano.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F02/plano.md)
- revisao.md: [docs/plano/E5-F02/revisao.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F02/revisao.md)

## Telas

_Sem telas._

## Estado

- Etapa: implement
- Progresso: 50%
- Bloqueio: não
- `E5-T05`: done
- `E5-T06`: ready
