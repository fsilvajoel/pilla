# E5-F05: edição, busca e listagem de pessoas (infra)

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E5.yaml`; referência: PRD-001 RF-01 e RF-04, RN-P01, RN-P02, RFC-004 §2, §3 e §6, RFC-005 §3, decisão de 17/11 (`personListResponse`/`personSummary`) e respostas de PM da E5-F02 em `docs/plano/pendencias-pm.md`.

## Escopo

- E5-T11 (Bia): `apps/api/src/people/infra/person-update.test.ts`, os testes de `updatePerson`.
- E5-T12 (Alice): `apps/api/src/people/infra/person-update.ts` (update com controle de versão) e a saída da trava do stub.
- E5-T13 (Bia): `apps/api/src/people/infra/person-write-error.test.ts`, os testes de `personWriteErrorCode`.
- E5-T14 (Alice): `apps/api/src/people/infra/person-write-error.ts` (tradução pura dos erros de escrita conhecidos) e a saída da trava do stub.
- E5-T15 (Bia): `apps/api/src/people/infra/person-list.test.ts`, os testes de `listPersons`.
- E5-T16 (Alice): `apps/api/src/people/infra/person-list.ts` e a saída da trava do stub.
- Fora:
  - camada HTTP (controller, caso de uso, Zod de update/listagem, `PATCH /people/{id}`, `GET /people`, `If-Match`, status e corpo de resposta): a api ainda não tem `http/` nem casos de uso; vira feature própria;
  - desativação, `active` no update e RN-P04: desativar é ação de negócio (`POST /people/{id}/...`, RFC-004 §2), não edição;
  - `referredById` no update, endereços, PIX, ficha completa e o módulo CONTRATOS.

## Riscos

- `UPDATE ... WHERE id AND version ... RETURNING` devolve `[]` tanto para id ausente quanto para versão divergente: o E5-T12 precisa de uma leitura extra para separar `NOT_FOUND` de `VERSION_CONFLICT`.
- O erro de escrita chega como `DrizzleQueryError` com `cause.code` e `cause.constraint` (verificado no PGlite com drizzle-orm 0.45.4, também em `db.execute(sql...)`). Não comparar a mensagem.
- Teste que monta o esperado a partir da entrada: barrado por `check-test-quality.mjs`; esperados escritos como literais.
- Teste que passa contra o stub: barrado pelo `expect-red.mjs`.
- `updated_at` comparado com o relógio: a linha-base é gravada com `updated_at` literal no passado e o teste só confere que mudou.
- `birth_date` lido por `client.query` volta como `Date`: o select do teste usa `::text`.
- Cobertura 0/0 com a trava do stub: o cartão de implementação remove a linha e o check exige 100%.

## Contrato

Infra, sem regra de domínio (`domainSources` vazio). Mesmo molde de `person-repository.ts` (E5-F02).

### Atualização: `apps/api/src/people/infra/person-update.ts`

```ts
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { NewPersonRow } from "./person-repository";

export type PersonChanges = Partial<Omit<Pick<NewPersonRow, "fullName" | "cpf" | "phone" | "email" | "birthDate" | "notes">, "cpf"> & { cpf?: string }>;
export type UpdatePersonResult = "UPDATED" | "NOT_FOUND" | "VERSION_CONFLICT";
/** Grava as mudanças se a versão bate; soma 1 em version e põe updated_at = now(). Erro do banco sobe sem tratamento. */
export function updatePerson(db: PgDatabase<PgQueryResultHKT>, id: string, expectedVersion: number, changes: PersonChanges): Promise<UpdatePersonResult>;
```

`UPDATED`: a linha com o id e a versão esperada foi gravada. `NOT_FOUND`: o id não existe. `VERSION_CONFLICT`: o id existe e a versão difere (RFC-004 §2). Campo omitido não muda. `person-repository.ts` não é editado.

O campo `cpf` não aceita `null` em `PersonChanges` da infra. `null` limpa `email`, `birthDate` e `notes`; essa limpeza é uma regra da borda HTTP/Zod de uma feature separada, não da infra. O PATCH não expõe `referredById` nem `active` nesta feature.

Teste: `apps/api/src/people/infra/person-update.test.ts` (camada `unit`, PGlite migrado de `migratedTestDb`).

### Tradução de erros de escrita: `apps/api/src/people/infra/person-write-error.ts`

```ts
export type PersonWriteErrorCode = "DUPLICATE_CPF" | "NOT_FOUND";
/** Traduz o erro de escrita do banco no code da borda; null para qualquer outro erro. */
export function personWriteErrorCode(error: unknown): PersonWriteErrorCode | null;
```

Função pura. `cause.code === "23505"` e `cause.constraint === "persons_cpf_key"` dão `DUPLICATE_CPF`; `cause.code === "23503"` e `cause.constraint === "persons_referred_by_id_fkey"` dão `NOT_FOUND` (respostas de PM da E5-F02). Qualquer outra coisa, inclusive a autorreferência (`23514` / `persons_referred_by_id_check`), dá `null`. Não há código na API decidido para a autorreferência por enquanto; `referredById` continua fora da edição nesta feature e `personWriteErrorCode` continua devolvendo `null` para o erro real.

Teste: `apps/api/src/people/infra/person-write-error.test.ts` (camada `unit`; um caso usa erro real do PGlite).

### Listagem: `apps/api/src/people/infra/person-list.ts`

```ts
export type PersonSummaryRow = { id: string; fullName: string; cpf: string | null; phone: string; active: boolean };
export type PersonListQuery = { search: string; limit: number; cursor: string | null; active: boolean | null };
export type PersonListPage = { items: PersonSummaryRow[]; nextCursor: string | null };
export function listPersons(db: PgDatabase<PgQueryResultHKT>, query: PersonListQuery): Promise<PersonListPage>;
```

Forma da decisão de 17/11; `cpf` é nulo para registro importado sem CPF (RN-P01).

- `search`: trecho sem distinção de caixa em `full_name`; nos dígitos do CPF, prefixo após ignorar ponto e traço da busca. Não usa `unaccent` nem ignora acentos em nome.
  - Busca só de dígitos trata nome OU CPF (RF-04, "nome ou CPF"): casa o nome por trecho sem caixa ou o CPF por prefixo.
- `active`: `null` filtra somente pessoas ativas; `true` filtra somente ativas; `false` filtra somente inativas. A ausência de `?active=` da borda chega como `null`.
- `limit`: padrão da borda `20`, máximo `100`; a borda valida `1..100` e devolve `400 VALIDATION_FAILED` fora da faixa. A infra recebe `limit` já validado e nunca devolve mais itens que esse número.
- Ordenação: `lower(full_name)` ascendente e `id` ascendente como desempate.
- `cursor`: opaco; codifica em base64 o último nome normalizado usado na ordenação e o último id, em JSON UTF-8 com a forma `{ "fullName": string, "id": string }`.
- `nextCursor`: `null` quando não há próxima página; a borda não inventa cursor para a última página.

## Domínio das entradas

O banco é o juiz do formato (CHECKs e índices da RFC-005 §3); a validação de entrada é do caso de uso e do Zod da borda, fora desta feature.

| Entrada | Formato aceito | Rejeitado | Fonte |
|---|---|---|---|
| `updatePerson.id` | UUID de pessoa existente | UUID sem registro → `"NOT_FOUND"` (sem erro lançado) | RFC-004 §2; RFC-005 §3 |
| `expectedVersion` | versão atual da linha | versão diferente em pessoa existente → `"VERSION_CONFLICT"`, linha intacta | RFC-004 §2 |
| `changes` | subconjunto de `fullName`, `cpf`, `phone`, `email`, `birthDate`, `notes`; `referredById` e `active` não existem; `cpf` aceita `string`, não `null`; `email`, `birthDate` e `notes` aceitam `null` na borda para limpar | CPF já usado → erro `23505` / `persons_cpf_key` sobe; demais CHECKs do banco sobem; `cpf: null` é recusado pelo Zod da borda antes da infra | RF-01; RN-P01; RFC-005 §3 |
| `personWriteErrorCode(error)` | qualquer valor (`unknown`) | sem as duas chaves reconhecidas → `null` | RFC-004 §6; respostas PM E5-F02 |
| `listPersons.search` | string; nome usa trecho sem caixa; CPF usa prefixo dos dígitos depois de ignorar ponto e traço | não há rejeição específica na infra; validações de query são da borda | RF-04; respostas PM E5-F05 |
| `listPersons.limit` | inteiro já validado pela borda em `1..100`; padrão da borda `20`; máximo `100` | `0`, negativo, `101`, decimal, texto ou demais valores fora de `1..100` → `400 VALIDATION_FAILED` na borda; a infra não valida nem converte | RFC-004 §2 e §6; respostas PM E5-F05 |
| `listPersons.cursor` | `string \| null`; base64 opaco do último nome normalizado e id | cursor malformado é responsabilidade da borda/caso de uso fora desta infra | RFC-004 §2; respostas PM E5-F05 |
| `listPersons.active` | `boolean \| null`; `null` só ativas, `true` só ativas, `false` só inativas | ausente na query da borda chega como `null`; valores não booleanos são recusados pelo Zod da borda | respostas PM E5-F05 |

## Dependências

- E5-T06 fechado: fornece `NewPersonRow` e o padrão de teste com `migratedTestDb`.
- O orquestrador cria as cascas `// @stub E5-T12`, `// @stub E5-T14` e `// @stub E5-T16` (assinaturas acima, corpo `throw new Error("esboço: não implementado")`) e as linhas de exclusão em `apps/api/vitest.config.ts` (`// stub E5-T12`, etc.) depois que a E5-F02 fechar.
- T12 depende de T11, T14 de T13, T16 de T15.

## Critérios de aceite

Molde: entrada, domínio, saída, erro, fonte, camada.

- **A1:** `updatePerson` com id e versão atuais resolve `"UPDATED"`, grava os seis campos, não mexe nos omitidos, leva `version` de 3 a 4 (linha-base com `version` 3) e muda `updated_at`. Fonte: RF-01, RFC-004 §2, RFC-005 §3. Camada: unit (PGlite).
- **A2:** id sem registro resolve `"NOT_FOUND"`, sem erro. Fonte: RFC-004 §2. Camada: unit (PGlite).
- **A3:** id existente com versão diferente resolve `"VERSION_CONFLICT"`; nome e versão gravados não mudam. Fonte: RFC-004 §2. Camada: unit (PGlite).
- **A4:** CPF já usado por outra pessoa rejeita com `cause.code` `"23505"` e `cause.constraint` `"persons_cpf_key"`. Fonte: RN-P01, RFC-005 §3. Camada: unit (PGlite).
- **A5:** `personWriteErrorCode` dá `"DUPLICATE_CPF"` e `"NOT_FOUND"` só para as duas combinações; constraint diferente, `{}`, `null`, `"texto"`, `{ cause: null }` e `{ cause: "x" }` dão `null` (um caso por ramo falso do narrowing). Fonte: RFC-004 §6, respostas PM E5-F02. Camada: unit.
- **A6:** erro real de autorreferência (`23514` / `persons_referred_by_id_check`) dá `null`; não há código na API decidido para ela por enquanto e `referredById` continua fora da edição nesta feature. Fonte: RN-P02, RFC-005 §3, resposta PM E5-T13. Camada: unit (PGlite) para a tradução; HTTP fora desta feature.
- **A7:** item da lista tem exatamente `{id, fullName, cpf, phone, active}`, com `cpf` nulo quando a linha não tem CPF. Fonte: decisão de 17/11 e resposta PM E5-T15. Camada: unit (PGlite).
- **A8:** banco vazio dá exatamente `{ items: [], nextCursor: null }`. Fonte: RFC-004 §2. Camada: unit (PGlite).
- **A9:** `items.length` nunca passa de `limit`; a infra recebe `limit` já validado pela borda em `1..100` (provado no C14, páginas de uma linha). Fonte: RFC-004 §2 e resposta PM E5-T15. Camada: unit (PGlite).
- **A10:** busca por nome considera trecho sem distinguir caixa, usando `lower(full_name)`; a busca `"bia"` encontra `"Bia Nunes"` e não encontra `"Ana Costa"`. Fonte: RFC-005 §3, resposta PM E5-T15. Camada: unit (PGlite).
- **A11:** busca por CPF usa prefixo nos dígitos, ignorando ponto e traço na entrada da busca; `"529982"` encontra `"52998224725"` e não encontra `"11144477735"`. Fonte: RF-04, resposta PM E5-T15. Camada: unit (PGlite).
- **A12:** a listagem ordena por `lower(full_name)` ascendente e usa `id` ascendente para desempatar. Fonte: resposta PM E5-T15. Camada: unit (PGlite).
- **A13:** (C14, keyset provado com ordem por nome discordando da ordem por id) a paginação usa cursor opaco em base64 do último nome normalizado e id e devolve `nextCursor` não nulo até a última página, cuja próxima página dá `nextCursor: null`. Fonte: RFC-004 §2, resposta PM E5-T15. Camada: unit (PGlite).
- **A14:** `active: null` ou `active: true` lista somente ativas; `active: false` lista somente inativas. A borda passa `null` quando `?active=` está ausente. Fonte: resposta PM E5-T15. Camada: unit (PGlite).
- **A15:** na borda HTTP, `limit` ausente vira `20`, máximo `100`, e `0`, negativo, `101`, decimal ou texto fora de `1..100` devolve `400 VALIDATION_FAILED`; esta validação fica fora da infra. Fonte: RFC-004 §2 e §6, resposta PM E5-T15. Camada: HTTP fora desta feature.
- **A16:** busca só de dígitos trata nome OU CPF: devolve a união de quem tem o trecho no nome (sem caixa) e de quem tem o CPF começando pelos dígitos, na ordem de A12; `"529"` devolve `"Ana CPF"` (CPF `52998224725`, pelo prefixo) e `"Lote 529 Silva"` (CPF `11144477735`, pelo trecho do nome). Fonte: RF-04, Decisões do PM (19/11). Camada: unit (PGlite).

## Cenários

Ids na faixa `01970000-0000-7000-8000-0000000001NN` (update/erros) e `...0000000002NN` (lista; C14 usa 213, 214 e 219); CPFs fictícios válidos `52998224725`, `11144477735`, `39053344705`.

- **C1 (A1):** linha-base `01970000-0000-7000-8000-000000000100`, `"Ana Costa"`, CPF `"52998224725"`, telefone `"+5511987654321"`, `updated_at` `'2026-01-01 00:00:00+00'`, versão 3. `updatePerson(db, id, 3, { fullName: "Ana Teixeira", cpf: "39053344705", phone: "+5511987654000", email: "ana@example.com", birthDate: "1990-04-15", notes: "dados revisados" })` → `"UPDATED"`; leitura SQL dá esses seis valores, `version` 4, `active` true, `referred_by_id` null e `updated_at` diferente de `2026-01-01`.
- **C2 (A2):** `updatePerson(db, "01970000-0000-7000-8000-000000000199", 1, { fullName: "Pessoa Nova" })` → `"NOT_FOUND"`.
- **C3 (A3):** linha-base `...000000000101`, `"Bruno Dias"`, versão 1; `updatePerson(db, id, 0, { fullName: "Nome não aplicado" })` → `"VERSION_CONFLICT"`; leitura dá `"Bruno Dias"` e versão 1.
- **C4 (A4):** `...000000000100` com CPF `"52998224725"` e `...000000000101` com `"11144477735"`; `updatePerson(db, "...000000000100", 1, { cpf: "11144477735" })` rejeita com `cause.code` `"23505"` e `cause.constraint` `"persons_cpf_key"`.
- **C5 (A5):** `{ cause: { code: "23505", constraint: "persons_cpf_key" } }` → `"DUPLICATE_CPF"`; `{ cause: { code: "23503", constraint: "persons_referred_by_id_fkey" } }` → `"NOT_FOUND"`; `{ cause: { code: "23505", constraint: "outra_constraint" } }` → `null`; `{}` → `null`.
- **C6 (A6):** `db.execute(sql\`insert ... id = referred_by_id = '01970000-0000-7000-8000-000000000102'\`)` rejeita; o valor rejeitado tem `cause.code` `"23514"` e `cause.constraint` `"persons_referred_by_id_check"`, e `personWriteErrorCode` dele dá `null`.
- **C18 (A5):** um caso por ramo falso do narrowing, todos esperando `null`: `personWriteErrorCode(null)`, `personWriteErrorCode("texto")`, `personWriteErrorCode({ cause: null })` e `personWriteErrorCode({ cause: "x" })`.
- **C7 (A7):** `...000000000200`, `"Caio Lima"`, CPF null, `"+5511987654200"` → item `{ id: "01970000-0000-7000-8000-000000000200", fullName: "Caio Lima", cpf: null, phone: "+5511987654200", active: true }`.
- **C8 (A8):** banco vazio, `{ search: "", limit: 20, cursor: null, active: null }` → `{ items: [], nextCursor: null }`.
- **C9 (A9):** fundido no C14 (a prova de `limit` está nas páginas de uma linha).
- **C10 (A1):** linha-base `...000000000103`, `"Carla Mendes"`, CPF `"39053344705"`, telefone `"+5511987654103"`, email `"carla@example.com"`, birth date `"1988-05-20"` e notes `"dados antigos"`; versão 3; `updatePerson(db, id, 3, { email: null, birthDate: null, notes: null })` → `"UPDATED"`; leitura dá `email null`, `birth_date null`, `notes null`, CPF `"39053344705"` intacto e versão 4.
- **C11 (A10):** linhas `01970000-0000-7000-8000-000000000204` `"Ana Costa"` CPF `"52998224725"`, `01970000-0000-7000-8000-000000000205` `"Bia Nunes"` CPF `"11144477735"` e `01970000-0000-7000-8000-000000000206` `"bia santos"` CPF `"39053344705"`; `listPersons(db, { search: "BIA", limit: 20, cursor: null, active: null })` → os itens completos `{ id: "01970000-0000-7000-8000-000000000205", fullName: "Bia Nunes", cpf: "11144477735", phone: "+5511987654205", active: true }` e `{ id: "01970000-0000-7000-8000-000000000206", fullName: "bia santos", cpf: "39053344705", phone: "+5511987654206", active: true }`, nesta ordem, seguidos de `nextCursor: null`. Segunda chamada com as mesmas linhas, `search: "SANTOS"` (caixa diferente do dado, trecho no meio do nome) → somente `{ id: "01970000-0000-7000-8000-000000000206", fullName: "bia santos", cpf: "39053344705", phone: "+5511987654206", active: true }`, `nextCursor: null`; `"Bia Nunes"` e `"Ana Costa"` não aparecem.
- **C12 (A11):** linhas `01970000-0000-7000-8000-000000000207` `"Ana CPF"` CPF `"52998224725"` e `01970000-0000-7000-8000-000000000208` `"Bia CPF"` CPF `"11144477735"`; `listPersons(db, { search: "529.982.247-25", limit: 20, cursor: null, active: null })` normaliza a busca para `"52998224725"` e lista somente `{ id: "01970000-0000-7000-8000-000000000207", fullName: "Ana CPF", cpf: "52998224725", phone: "+5511987654207", active: true }`, `nextCursor: null`. Prefixo parcial, mesmas linhas: `search: "529982"` → somente o item de `"Ana CPF"` (`...207`, CPF `52998224725`, mesmo literal), não `"Bia CPF"` (CPF `11144477735`), `nextCursor: null`; `search: "982247"` (dígitos do meio do CPF, não prefixo) → `{ items: [], nextCursor: null }`.
- **C13 (A12):** inseridas nesta ordem física: `01970000-0000-7000-8000-000000000211` `"Ana Souza"` CPF `"39053344705"` telefone `"+5511987654211"`, `01970000-0000-7000-8000-000000000210` `"Ana Souza"` CPF `"11144477735"` telefone `"+5511987654210"` (mesmo nome, id menor inserido depois), `01970000-0000-7000-8000-000000000209` `"Bruno Lima"` CPF `"52998224725"` telefone `"+5511987654209"` e `01970000-0000-7000-8000-000000000212` `"ana lima"` CPF null telefone `"+5511987654212"`; todas ativas. `listPersons(db, { search: "", limit: 20, cursor: null, active: null })` → ordem literal por `lower(full_name)` e depois `id`: `"ana lima"` id `...212`, `"Ana Souza"` id `...210`, `"Ana Souza"` id `...211`, `"Bruno Lima"` id `...209`; `nextCursor: null`. Prova `lower`: com `ORDER BY full_name` em collation C (byte a byte) `"Bruno Lima"` (`B`) viria antes de `"ana lima"` (`a`); prova o desempate: sem `id`, os dois `"Ana Souza"` sairiam na ordem física (`...211` antes de `...210`).
- **C14 (A9, A13):** três pessoas em que a ordem por `lower(full_name)` discorda da ordem por `id`: `01970000-0000-7000-8000-000000000219` `"Bia Nunes"` CPF `"52998224725"` telefone `"+5511987654219"`, `01970000-0000-7000-8000-000000000214` `"Davi Melo"` CPF `"11144477735"` telefone `"+5511987654214"` e `01970000-0000-7000-8000-000000000213` `"Eva Reis"` CPF `"39053344705"` telefone `"+5511987654213"` (por `id` a ordem seria Eva, Davi, Bia; por nome é Bia, Davi, Eva), todas ativas. `listPersons` com `search: ""`, `limit: 1`, `active: null`, começando em `cursor: null` e repassando só o `nextCursor` recebido (cursor opaco: o teste não decodifica): página 1 → somente `{ id: "01970000-0000-7000-8000-000000000219", fullName: "Bia Nunes", cpf: "52998224725", phone: "+5511987654219", active: true }` e `nextCursor` não nulo; página 2 → somente `{ id: "01970000-0000-7000-8000-000000000214", fullName: "Davi Melo", cpf: "11144477735", phone: "+5511987654214", active: true }` e `nextCursor` não nulo; página 3 → somente `{ id: "01970000-0000-7000-8000-000000000213", fullName: "Eva Reis", cpf: "39053344705", phone: "+5511987654213", active: true }` e `nextCursor: null`. A sequência completa (Bia, Davi, Eva) sai sem repetição nem falta; cada página tem no máximo `limit` item.
- **C15 (A14):** linhas `01970000-0000-7000-8000-000000000215` `"Ativa Silva"` com `active: true` e `01970000-0000-7000-8000-000000000216` `"Inativa Souza"` com `active: false`; `listPersons(db, { search: "", limit: 20, cursor: null, active: null })` ou `active: true` → somente `{ id: "01970000-0000-7000-8000-000000000215", fullName: "Ativa Silva", cpf: "52998224725", phone: "+5511987654215", active: true }`; `active: false` → somente `{ id: "01970000-0000-7000-8000-000000000216", fullName: "Inativa Souza", cpf: "39053344705", phone: "+5511987654216", active: false }`; ambos com `nextCursor: null`.
- **C16 (A15, fora da infra):** `GET /people` sem `limit` passa `limit: 20`; `limit: 100` passa `100`; `limit: 0`, `limit: 101`, `limit: 1.5` e `limit: "abc"` devolvem `400` com `code: "VALIDATION_FAILED"`. Esta validação é da borda HTTP/Zod.
- **C17 (A16):** linhas `01970000-0000-7000-8000-000000000217` `"Lote 529 Silva"` CPF `"11144477735"` telefone `"+5511987654217"` e `01970000-0000-7000-8000-000000000218` `"Ana CPF"` CPF `"52998224725"` telefone `"+5511987654218"`, ambas ativas, inseridas nessa ordem; `listPersons(db, { search: "529", limit: 20, cursor: null, active: null })` → `{ id: "01970000-0000-7000-8000-000000000218", fullName: "Ana CPF", cpf: "52998224725", phone: "+5511987654218", active: true }` e `{ id: "01970000-0000-7000-8000-000000000217", fullName: "Lote 529 Silva", cpf: "11144477735", phone: "+5511987654217", active: true }`, nesta ordem, `nextCursor: null`.

## Decisões do PM (Joel, 19/11)

- `active: null` e `active: true` fazem a mesma coisa (só ativas); não existe valor para "todas".
- Busca com entrada só de dígitos trata nome OU CPF (RF-04): casa nome por trecho ou CPF por prefixo (cenário C17, critério A16).

## Fora do plano

- A implementação da borda HTTP (Zod/controller/caso de uso), `PATCH /people/{id}`, `GET /people`, `If-Match`, status e corpo de resposta fica em feature separada.
- `referredById` e `active` não fazem parte de `PersonChanges`; desativação é ação de negócio separada.
- Campos opcionais `email`, `birthDate` e `notes` podem ser limpos com `null` pela borda HTTP/Zod, mas `cpf: null` é recusado na borda e não existe em `PersonChanges` da infra.
- A validação do `limit` da query e o mapeamento `?active=` para `boolean | null` ficam na borda HTTP; a infra recebe valores já válidos.
- Decisão de autorreferência: sem código na API por enquanto; `referredById` continua fora de `PersonChanges` e da edição nesta feature. `personWriteErrorCode` continua devolvendo `null` no erro `23514` / `persons_referred_by_id_check`.
