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

## Domínio das entradas

O repositório não valida: grava o que recebe e o banco é o juiz (CHECKs e índices da RFC-005 §3). A validação de formato (CPF com dígito verificador, telefone E.164) é do caso de uso e do Zod da borda, fora desta feature.

| Entrada | Formato aceito pelo banco | Rejeitado pelo banco (erro sobe sem tratamento) | Fonte |
|---|---|---|---|
| `id` | uuid | texto que não é uuid | RFC-005 §3 |
| `fullName`, `phone` | obrigatórios; `phone` `^[+][1-9][0-9]{7,14}$` | nulo; `phone` fora do padrão (`persons_phone_check`) | RFC-005 §3 |
| `cpf` | 11 dígitos ou nulo | fora de `^[0-9]{11}$` (`persons_cpf_check`); repetido (`persons_cpf_key`, só entre não nulos) | RN-P01, RFC-005 §3 |
| `email`, `birthDate`, `notes` | opcionais; `birthDate` texto `AAAA-MM-DD` | data inválida | RFC-005 §3 |
| `referredById` | id de pessoa existente ou nulo | inexistente (`persons_referred_by_id_fkey`); igual ao `id` (`persons_referred_by_id_check`) | RN-P02 |
| `findPersonById.id` | qualquer uuid | (nenhuma: id ausente dá `null`) | PRD-001 RF-04 |

Os testes desta feature cobrem só o CPF repetido (C3); os demais erros do banco já são provados em `persons.test.ts` (RFC-005 §3).

## Dependências

- Casca **ainda não existe no HEAD** (verificado em 19/11): `person-repository.ts` não existe e `apps/api/vitest.config.ts` não tem a linha de exclusão. O orquestrador cria a casca na etapa 1 (workflow feature) antes do E5-T05: o arquivo com o contrato acima (imports `eq` ausente, `persons` só como tipo), a linha `// @stub E5-T06`, `NewPersonRow` e as duas funções lançando `Error("esboço: não implementado")` com os comentários `/** */`, e a linha de exclusão com o comentário `stub E5-T06` em `coverage.exclude`.
- Tabela `people.persons` já migrada (RFC-005 §3), com `cpf` único e opcional e `referred_by_id` para a própria tabela.
- Caminho: o plano segue `apps/api/src/<módulo>/...` (como E5-F01), não o `src/modules/...` da RFC-003; a divergência não afeta esta feature.

## Critérios de aceite

Molde: entrada, domínio, saída, erro, fonte, camada.

- A1: `insertPerson(db, {id, fullName, cpf, phone})` sem os demais campos resolve `undefined` e a linha fica com `email`, `birth_date`, `referred_by_id` e `notes` nulos, `active` true e `version` 1. Domínio: tabela acima. Erro: nenhum. Fonte: RFC-005 §3. Camada: unit.
- A2: `insertPerson` com `referredById` de pessoa existente e `cpf` nulo grava todos os campos como vieram. Fonte: RN-P02, RN-P01 (cpf pode ser nulo), RFC-005 §3. Camada: unit.
- A3: `insertPerson` com CPF já gravado rejeita (a promessa falha); o erro do banco sobe sem tratamento, sem tradução nem código próprio. Fonte: RN-P01, RFC-005 §3. Camada: unit.
- A4: `findPersonById(db, id)` devolve a linha com as chaves em camelCase (`PersonRow`: `birthDate` texto `AAAA-MM-DD`, `createdAt` `Date`) ou `null` quando o id não existe. Fonte: PRD-001 RF-04, RFC-005 §3. Camada: unit.
- A5: todos os testes passam com 100% de linhas e ramos de `person-repository.ts`; typecheck e lint verdes; nenhuma linha `@stub` nem exclusão no `vitest.config.ts`. Camada: unit (gate coverage).

## Cenários

- C1 (A1): Maria só com nome, CPF e telefone fica com email, nascimento, indicador e notas nulos, ativa e versão 1.
- C2 (A2): João, sem CPF e indicado pela Ana, tem todos os campos gravados e `referred_by_id` igual ao id da Ana.
- C3 (A3): Rui Filho com o CPF do Rui é rejeitado.
- C4 (A4): Carla, inserida por SQL, é lida por `findPersonById` com os campos em camelCase e `createdAt` do tipo `Date`.
- C5 (A4): id inexistente dá `null`.

## Fora do plano (perguntas de PM não bloqueantes)

Abertas em `docs/plano/pendencias-pm.md` para o caso de uso `createPerson` (feature futura); não travam a E5-F02: código de erro de CPF duplicado, código de erro de indicador inexistente, CPF obrigatório em cadastro novo.
