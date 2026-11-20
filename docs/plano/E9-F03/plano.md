# Plano E9-F03: rotas de pessoas

Plano da feature para E9-T04, E9-T05 e E9-T06 (`docs/plano/E9.yaml`). Referências: PRD-001 RF-01, RF-03 e RF-04; RFC-004 §§2, 3 e 6; RFC-005 §3; `docs/plano/E9.md` D1, D3, D7, D8 e D9; planos E5-F02 e E5-F05; e decisões do Joel de 20/11/2026. A feature depende da base HTTP da E9-F02 e dos repositórios E5-F02/E5-F05.

## Escopo

- `POST /api/v1/people`: cadastrar pessoa, validar o corpo, recusar CPF repetido e devolver `201` com `Location`.
- `GET /api/v1/people`: listar e buscar por nome ou CPF, com cursor opaco e limite.
- `GET /api/v1/people/{id}`: ler apenas os dados básicos. Endereços, PIX, indicador/indicados agregados e ficha completa são E9-F04/F05.
- `PATCH /api/v1/people/{id}`: editar os campos permitidos por RF-01; a versão esperada vem no corpo.
- Schemas de entrada e resposta para create, list/query, detalhe básico e update; adicionar `DUPLICATE_CPF` ao catálogo e ao schema de erros.

Fora: rotas e regras de endereços/PIX, ficha agregada, desativação, autenticação/guard, contratos e pagamentos, front-end e E2E Playwright (E9-F11).

As buscas ignoram maiúsculas e acentos; CPF é pesquisado por prefixo de dígitos. Para uma busca composta apenas por dígitos, a lista é a união das correspondências por trecho no nome e prefixo do CPF; uma busca com letras e dígitos é tratada como busca por nome, conforme E5-F05 e o cartão E9-T05.

## Contrato

Base `/api/v1`; JSON na borda HTTP validado por Zod e erros em `application/problem+json` (D1, RFC-004 §2). O controller traduz HTTP; os casos de uso coordenam os repositórios existentes. A API fica aberta nesta épica, conforme D3.

- **`POST /people`** recebe `createPersonRequest`: objeto estrito com `fullName`, `cpf` e `phone` obrigatórios; opcionais `email`, `birthDate`, `referredById` e `notes`. Campos opcionais ausentes são omitidos no insert. O ID é gerado com `newId()` de `apps/api/src/core/public/ids.ts`; `active` e `version` vêm do banco (`true` e `1`). Responde `201`, `Content-Type: application/json`, `Location: /api/v1/people/{id}` e um `PersonResponse` com os dados básicos criados.
- **`GET /people`** recebe `search` (padrão `""`), `limit` (padrão `20`, inteiro entre `1` e `100`) e `cursor` opcional. Sem busca, lista pessoas ativas, conforme o contrato da infra E5-F05. Responde `200` com `PersonListResponse`: `{ items, nextCursor }`; `nextCursor` é `null` na última página.
- **`GET /people/{id}`** recebe ID UUID v7. Responde `200` com `PersonResponse` básico, incluindo `version`; não inclui endereços, PIX, `referrer` nem `referrals`. ID inexistente responde `404 NOT_FOUND`.
- **`PATCH /people/{id}`** recebe `updatePersonRequest`: os campos editáveis de create em forma parcial e `version` inteiro não negativo obrigatório. `referredById` e `active` não são editáveis. Campo ausente não muda; `null` limpa `email`, `birthDate` ou `notes`, mas não é permitido para CPF. A versão válida incrementa em um e a resposta é `200` com `PersonResponse` contendo a versão nova. A versão divergente responde `409 VERSION_CONFLICT`; pessoa inexistente responde `404 NOT_FOUND`.
- Erros de entrada inválida: `400`, `Content-Type: application/problem+json`, corpo com `title: "Validação falhou"`, `status: 400`, `detail: "Dados inválidos."`, `code: "VALIDATION_FAILED"` e `errors` por campo. CPF repetido em create ou update: `409`, `DUPLICATE_CPF`, detalhe `"CPF já cadastrado."`. Indicador inexistente no create: `404 NOT_FOUND`, detalhe `"Recurso não encontrado."`.
- O esquema `PersonResponse` desta feature contém os campos básicos `id`, `fullName`, `cpf`, `phone`, opcionais `email`, `birthDate`, `notes`, e `active`, `version`. Campos opcionais nulos do banco são omitidos no JSON. O schema é estrito. A resposta de PATCH também usa esse schema.
- A ordenação, o cursor opaco e os detalhes da consulta reutilizam o contrato de `listPersons` E5-F05. O cursor malformado vira `400 VALIDATION_FAILED`, associado ao campo `cursor`.

**Tipos e assinaturas dos schemas**

- Importar `cpfSchema`, `idSchema`, `isoDateSchema` e `phoneSchema` de `../../common` nos arquivos de `packages/schemas/src/api/people/`.
- Importar `z` de `"zod"` em cada arquivo novo ou ajustado de schema.
- Exportar em `create-person.ts`: `createPersonRequest`, `CreatePersonRequest`, `personSummarySchema`, `PersonSummary`, `personListResponse`, `PersonListResponse`. Ajustar `personSummarySchema.cpf` para `cpfSchema.nullable()`, mantendo os demais campos estritos.
- Criar em `person-list-query.ts`: `personListQuery`, `PersonListQuery`, `search`, `limit` e `cursor`; a query aceita `search: string`, `limit: z.int().min(1).max(100).default(20)` e `cursor: z.string().nullable().optional()`.
- Criar em `person-response.ts`: `personResponse`, `PersonResponse`, estrito com `id`, `fullName`, `cpf`, `phone`, opcionais não nulos `email`, `birthDate`, `notes`, `active`, `version`.
- Criar em `update-person.ts`: `updatePersonRequest`, `UpdatePersonRequest`, com campos parciais editáveis, `version: z.int().nonnegative()`, `email/birthDate/notes` nullable, e CPF não nullable.
- Reexportar os schemas e tipos por `packages/schemas/src/index.ts`.
- Ajustar `packages/schemas/src/api/problem.ts`: adicionar `"DUPLICATE_CPF"` ao `errorCodeSchema` e `409` a `errorStatus`.

**Divergências explícitas com os cartões e o contrato de front informado:**

- D9 e E9-T05 pedem `If-Match`, `428` sem cabeçalho e `ETag` no sucesso; decisão do Joel de 20/11 define `version` no corpo do PATCH. Este plano segue o corpo: não exige `If-Match` nem define `ETag`.
- O `personDetailResponse` fornecido para o front inclui `referrer`, `referrals`, `addresses` e `pixKeys`, mas essa ficha agregada está no escopo de E9-F05. E9-F03 usa `PersonResponse` básico; E9-F05 compõe a resposta agregada.
- O `personSummarySchema` fornecido não aceita CPF nulo, mas a infra E5-F05 pode retornar pessoas importadas sem CPF. Neste plano, o CPF de resumo/lista é nullable para que todos os registros possam ser listados. Isso diverge do schema fornecido e exige ajuste explícito no contrato do front.
- O schema `updatePersonRequest` fornecido não aceita `null` nos opcionais, mas a decisão PM resolvida em E5-F05 determina que `null` limpa e-mail, nascimento e observações. Este plano permite esses `null`, mantendo CPF não nulo.
- Os schemas fornecidos não normalizam CPF ou telefone mascarados. Embora E9-T05 diga que entradas mascaradas são normalizadas, este plano segue os schemas fornecidos: CPF deve conter 11 dígitos válidos e telefone deve estar em E.164; valores mascarados são recusados com `400 VALIDATION_FAILED`.
- E9-T05 diz que indicador inexistente dá `400`; a resposta PM resolvida em `docs/plano/pendencias-pm.md` escolheu `404 NOT_FOUND`. Este plano segue a decisão PM.
- E9-T05 previa busca sem acento somente depois de decisão PM; o Joel decidiu em 20/11 que a busca ignora acentos. Este plano segue a decisão mais recente e exige alteração da consulta E5-F05.

## Arquivos de produção

| Arquivo | Tipo | Teste | Motivo |
|---|---|---|---|
| `packages/schemas/src/api/people/create-person.ts` | existente, ajustar | contrato | Permitir CPF nullable em `personSummarySchema`; conservar validação de create. |
| `packages/schemas/src/api/people/person-list-query.ts` | novo | contrato | Schema de query e resposta da lista. |
| `packages/schemas/src/api/people/person-response.ts` | novo | contrato | Resposta básica, com versão. |
| `packages/schemas/src/api/people/update-person.ts` | novo | contrato | PATCH parcial, versão obrigatória e nulabilidade dos opcionais editáveis. |
| `packages/schemas/src/api/problem.ts` | existente, ajustar | contrato | Incluir `DUPLICATE_CPF` e status `409`. |
| `apps/api/src/people/infra/person-list.ts` | existente, ajustar | unit | Tornar a comparação do nome insensível a acentos sem perder busca por CPF, ordenação e cursor. |
| `apps/api/src/people/application/create-person.ts` | novo | unit | Criar pessoa, mapear erros conhecidos e formar resultado básico. |
| `apps/api/src/people/application/list-people.ts` | novo | unit | Normalizar query HTTP para o contrato existente de `listPersons`. |
| `apps/api/src/people/application/get-person.ts` | novo | unit | Ler por ID e mapear inexistência. |
| `apps/api/src/people/application/update-person.ts` | novo | unit | Separar a versão dos campos, chamar `updatePerson` e mapear resultados/erros. |
| `apps/api/src/people/http/people.controller.ts` | novo | unit | Declarar rotas, validar parâmetros/corpos/query e traduzir respostas e cabeçalhos. |
| `apps/api/src/people/people.module.ts` | novo | unit | Compor controller e providers do módulo. |
| `apps/api/src/app.module.ts` | existente, ajustar | unit | Registrar `PeopleModule`. |

`packages/schemas/src/index.ts` recebe somente reexports. `apps/api/src/core/public/ids.ts` e os repositórios de `people/infra/` são dependências existentes, não devem ser duplicados nem alterados, salvo `person-list.ts` para a nova busca sem acentos. RFC-004 §6 recebe a linha do erro `DUPLICATE_CPF`; documentação não é fonte executável. `domainSources` não inclui layout ou arquivos gerados. Nenhum arquivo fica dispensado: `exemptSources` vazio.

## Domínio das entradas

| Entrada | Domínio aceito | Rejeição e resposta | Fonte |
|---|---|---|---|
| `POST` body | Objeto estrito; nome aparado, 1–150 caracteres; CPF de 11 dígitos com verificadores válidos; telefone E.164; e-mail válido até 254; data ISO; `referredById` UUID v7; observações aparadas, 1–2000 | campo inválido ou extra: `400 VALIDATION_FAILED`; valores nulos não são aceitos nos opcionais de create | Contrato fornecido; `common.ts`; RF-01, RF-03 |
| CPF de create/update | CPF válido e único | duplicado: `409 DUPLICATE_CPF`, detalhe `"CPF já cadastrado."` | RN-P01; D8; RFC-005 §3; decisão PM |
| `referredById` de create | UUID v7 de pessoa existente | inexistente: `404 NOT_FOUND`; autorreferência não é alcançável por create porque o ID é gerado pela API | RN-P02; `pendencias-pm.md`; RFC-005 §3 |
| `GET search` | string; vazio significa sem busca; nome por trecho sem distinção de caixa ou acento; CPF por prefixo após remover pontuação | busca só de dígitos une nome e CPF; busca mista é apenas nome; nenhum resultado é `{ items: [], nextCursor: null }` | RF-04; E5-F05; decisão Joel 20/11 |
| `GET limit` | inteiro decimal de `1` a `100`; default `20` | ausente → `20`; `0`, negativo, `101`, decimal, notação exponencial, vazio ou texto → `400 VALIDATION_FAILED` no campo `limit` | RFC-004 §2/§6; E5-F05 |
| `GET cursor` | ausente ou cursor opaco produzido pela infra | cursor malformado → `400 VALIDATION_FAILED` no campo `cursor` | RFC-004 §2; E5-F05 |
| `GET id` / `PATCH id` | UUID v7 | registro inexistente → `404 NOT_FOUND` | RFC-004 §2; RFC-005 §3 |
| `PATCH body` | campos editáveis parciais mais `version` inteiro não negativo; `email`, `birthDate`, `notes` aceitam `null`; CPF não aceita `null` | campo desconhecido, CPF nulo, versão ausente, negativa ou não inteira → `400 VALIDATION_FAILED`; versão antiga em registro existente → `409 VERSION_CONFLICT` | RF-01; RFC-004 §2; E5-F05; decisão Joel 20/11 |
| resposta de lista | resumo estrito com `id`, `fullName`, `cpf`, `phone`, `active`; CPF pode ser nulo | propriedade ausente/extra ou tipo inválido não passa em `PersonListResponse` | RFC-004 §2; E5-F05; RFC-005 §3 |
| resposta básica | `id`, `fullName`, `cpf`, `phone`, opcionais não nulos `email`, `birthDate`, `notes`, `active`, `version` | propriedade extra ou tipo inválido não passa em `PersonResponse` | RF-01; RFC-005 §3; escolha deste plano para separar E9-F03 de E9-F05 |

## Riscos

- A busca sem acentos conflita com a regra anterior de E5-F05 e exige alteração de `person-list.ts`. Normalizar apenas a query não basta: a comparação no banco também precisa ignorar acentos. O teste HTTP com PGlite deve provar `"jose"` encontrando `"José"`; a técnica precisa funcionar no PostgreSQL 17 sem alterar ordenação/cursor.
- E9-T06 autoriza `apps/api/src/people/infra/person-list.ts`; E9-T04 protege `packages/schemas/src/api/people/people.test.ts` e E9-T05 autoriza esse teste de contrato junto do teste HTTP.
- As divergências de `PersonSummary` nullable, limpeza com `null`, dados básicos versus ficha agregada e entrada mascarada precisam ser propagadas ao contrato do front; não devem ser “corrigidas” silenciosamente pelo implementador.
- A infra `listPersons` já faz busca case-insensitive, prefixo CPF, união quando só dígitos, ordenação e keyset cursor. Mudanças precisam preservar os cenários E5-F05, inclusive cursores e limite.
- A validação HTTP usa `ZodValidationPipe` e `ProblemDetailsFilter` da E9-F02. Respostas de erro devem continuar válidas em `problemSchema`; para erros de validação, conferir o campo e o code sem fixar texto interno do Zod que não está definido pelo contrato.
- O controlador não deve implementar regra de negócio nem acessar tabelas diretamente; regras ficam na aplicação e persistência nos repositórios do módulo.

## Dependências

- E9-F02 concluída: NestJS, prefixo `/api/v1`, `ZodValidationPipe`, `ProblemDetailsFilter`, `ProblemException` e banco injetável.
- E5-F02: `insertPerson`, `findPersonById`, `NewPersonRow`, `PersonRow` e gerador existente `newId()`.
- E5-F05: `updatePerson`, `listPersons`, `personWriteErrorCode`; incluir a atualização da busca sem acentos antes de implementar E9-T06.
- `@pilla/schemas`: `createPersonRequest`, `cpfSchema`, `idSchema`, `phoneSchema`, `isoDateSchema`, `problemSchema` e catálogo de erros.
- Testes de rota usam PGlite e migrações já existentes; sem nova dependência de runtime.

## Critérios de aceite

### A1: criação e contrato da resposta

- **entrada:** `POST /api/v1/people` com `{ fullName: "Ana Costa", cpf: "52998224725", phone: "+5511987654321" }`; `newId()` no teste retorna `01970000-0000-7000-8000-000000000001`.
- **domínio:** create válido, defaults de banco, resposta básica.
- **saída:** status `201`; `Content-Type: application/json`; `Location: /api/v1/people/01970000-0000-7000-8000-000000000001`; corpo exatamente `{ id: "01970000-0000-7000-8000-000000000001", fullName: "Ana Costa", cpf: "52998224725", phone: "+5511987654321", active: true, version: 1 }`, válido em `PersonResponse`; linha gravada com `active = true`, `version = 1`, demais opcionais nulos.
- **erro:** nenhum.
- **fonte:** RF-01; RN-P01; RFC-004 §§2–3; RFC-005 §3; E5-F02.
- **camada:** unit.

### A2: validação do create

- **entrada:** corpos válidos e inválidos contra `createPersonRequest`.
- **domínio:** nome aparado e limites; CPF com dígitos verificadores; telefone E.164; e-mail/data/UUID/observações opcionais; objeto estrito.
- **saída:** `"  Ana Costa  "` é armazenado como `"Ana Costa"`; todos os válidos passam no schema.
- **erro:** CPF mascarado `"529.982.247-25"`, CPF inválido `"11111111111"`, telefone mascarado `"(11) 99999-0000"`, nome vazio/só espaços, nome com 151 caracteres, e-mail inválido e chave extra respondem `400 application/problem+json`, `code: "VALIDATION_FAILED"`, `title: "Validação falhou"`, `detail: "Dados inválidos."`; `errors` contém os campos recusados.
- **fonte:** contrato fornecido; `common.ts`; RFC-004 §§2 e 6; divergência do `done` E9-T05 sobre normalização de entradas mascaradas.
- **camada:** unit.

### A3: CPF duplicado

- **entrada:** create com CPF `52998224725` já gravado por outra pessoa.
- **domínio:** unicidade de CPF entre valores não nulos.
- **saída:** não cria segunda pessoa.
- **erro:** status `409`, `Content-Type: application/problem+json`, corpo `{ title: "DUPLICATE_CPF", status: 409, detail: "CPF já cadastrado.", code: "DUPLICATE_CPF" }`.
- **fonte:** RN-P01; RFC-005 §3; D8; resposta PM de 19/11.
- **camada:** unit.

### A4: indicador no create

- **entrada:** corpo de create com `referredById` igual a `01970000-0000-7000-8000-000000000002`, primeiro com essa pessoa gravada e depois sem ela.
- **domínio:** indicador deve ser pessoa existente; `referredById` omitido não grava referência.
- **saída:** quando existe, a nova pessoa grava `referred_by_id` com o ID fornecido.
- **erro:** quando inexiste, status `404`, `Content-Type: application/problem+json`, corpo `{ title: "Não encontrado", status: 404, detail: "Recurso não encontrado.", code: "NOT_FOUND" }`.
- **fonte:** RN-P02; RFC-005 §3; resposta PM em `docs/plano/pendencias-pm.md` (19/11), em divergência de E9-T05.
- **camada:** unit.

### A5: listagem padrão e resposta

- **entrada:** `GET /api/v1/people` com pessoas ativas e inativas, inclusive uma importada com `cpf: null`.
- **domínio:** query ausente usa busca vazia, limite `20`, cursor `null`; a infra filtra somente pessoas ativas por padrão.
- **saída:** status `200`; corpo passa em `PersonListResponse`; cada item tem exatamente `id`, `fullName`, `cpf`, `phone`, `active`; pessoa ativa sem CPF aparece com `cpf: null`; `nextCursor` é `null` se não há próxima página. Banco vazio responde exatamente `{ items: [], nextCursor: null }`.
- **erro:** nenhum.
- **fonte:** RFC-004 §2; E5-F05 A7, A8 e A14; RFC-005 §3; divergência explícita sobre CPF nullable.
- **camada:** unit.

### A6: busca por nome e CPF

- **entrada:** pessoas `"José Lima"` (`52998224725`), `"JOSE Santos"` (`11144477735`) e `"Lote 529 Silva"` (`39053344705`); buscas `"jose"`, `"529.982"` e `"529"`.
- **domínio:** trecho no nome sem distinguir caixa ou acento; CPF casa por prefixo dos dígitos e ignora pontuação; busca composta só de dígitos combina nome e CPF; busca mista é apenas nome.
- **saída:** `"jose"` retorna `"José Lima"` e `"JOSE Santos"`; `"529.982"` retorna somente `"José Lima"`; `"529"` retorna `"José Lima"` e `"Lote 529 Silva"`, nessa ordem por `lower(full_name)` e ID.
- **erro:** nenhum.
- **fonte:** RF-04; E5-F05 A10–A13, A16; decisão Joel de 20/11 (acentos e caixa).
- **camada:** unit.

### A7: paginação e limites

- **entrada:** `GET /api/v1/people?limit=1` sobre `"Bia Nunes"`, `"Davi Melo"` e `"Eva Reis"`; a segunda chamada repassa o `nextCursor` recebido, sem decodificá-lo.
- **domínio:** cursor opaco; ordenação por nome normalizado e ID; máximo de itens igual a `limit`.
- **saída:** página 1 contém só Bia e `nextCursor` não nulo; página 2 só Davi e `nextCursor` não nulo; página 3 só Eva e `nextCursor: null`. A sequência não repete nem omite pessoa. Sem `limit`, usa `20`; `limit=100` é aceito.
- **erro:** `limit=0`, `-1`, `101`, `1.5`, `1e1`, vazio ou `"abc"` responde `400 application/problem+json`, `code: "VALIDATION_FAILED"`, com `errors` para `limit`. Cursor inválido responde `400`, `VALIDATION_FAILED`, campo `cursor`.
- **fonte:** RFC-004 §§2 e 6; E5-F05 A9, A13, A15 e A17; E9-T04.
- **camada:** unit.

### A8: leitura básica por ID

- **entrada:** `GET /api/v1/people/01970000-0000-7000-8000-000000000001` para pessoa existente.
- **domínio:** leitura por ID; opcionais nulos são omitidos.
- **saída:** status `200`, `Content-Type: application/json`, corpo exatamente `{ id: "01970000-0000-7000-8000-000000000001", fullName: "Ana Costa", cpf: "52998224725", phone: "+5511987654321", active: true, version: 1 }`, válido em `PersonResponse`; não contém `addresses`, `pixKeys`, `referrer` nem `referrals`.
- **erro:** ID desconhecido responde `404 application/problem+json` com `{ title: "Não encontrado", status: 404, detail: "Recurso não encontrado.", code: "NOT_FOUND" }`.
- **fonte:** RF-01/RF-04; RFC-004 §§2–3; D7; escopo E9-F03, ficha agregada E9-F05.
- **camada:** unit.

### A9: validação e campos editáveis do PATCH

- **entrada:** `PATCH /api/v1/people/{id}` com `{ version: 3, notes: null, email: null, birthDate: null }`.
- **domínio:** update parcial; campos omitidos ficam intactos; opcionais autorizados podem ser limpos; CPF, `referredById` e `active` não podem ser limpos/editados.
- **saída:** status `200`; corpo `PersonResponse` mostra `version: 4`, mantém CPF e telefone, e omite `email`, `birthDate` e `notes`; linha do banco confirma os nulos e versão nova.
- **erro:** `version` ausente, negativa ou não inteira; `cpf: null`; campo extra; ou tentativa de alterar `referredById`/`active` responde `400 application/problem+json`, `code: "VALIDATION_FAILED"`, com campos recusados.
- **fonte:** RF-01; decisão PM E5-F05 em `pendencias-pm.md`; contrato fornecido com ajuste explícito para null; divergência E9-T04.
- **camada:** unit.

### A10: concorrência otimista pelo corpo

- **entrada:** PATCH com `version: 1` sobre pessoa que está em versão `2`; também PATCH sem `version`.
- **domínio:** comparação com versão corrente feita por `updatePerson`; o corpo, não `If-Match`, fornece a versão esperada.
- **saída:** nenhuma alteração na linha em caso de conflito.
- **erro:** versão antiga responde `409 application/problem+json` com `{ title: "VERSION_CONFLICT", status: 409, detail: "Versão desatualizada.", code: "VERSION_CONFLICT" }`; versão ausente responde `400 VALIDATION_FAILED`, não `428`.
- **fonte:** RFC-004 §§2 e 6; E5-F05 A3; decisão Joel de 20/11, divergente de D9 e E9-T05.
- **camada:** unit.

### A11: CPF duplicado no PATCH

- **entrada:** PATCH com versão atual e CPF já pertencente a outra pessoa.
- **domínio:** unicidade de CPF também vale na edição.
- **saída:** os dados e a versão da pessoa alvo permanecem inalterados.
- **erro:** status `409`, `application/problem+json`, corpo `{ title: "DUPLICATE_CPF", status: 409, detail: "CPF já cadastrado.", code: "DUPLICATE_CPF" }`.
- **fonte:** RN-P01; RFC-005 §3; D8; `personWriteErrorCode`.
- **camada:** unit.

## Cenários

IDs fixos válidos UUID v7: `01970000-0000-7000-8000-000000000001` (Ana), `...000000000002` (indicador), `...000000000003` (segunda pessoa). CPFs fictícios válidos para os testes: `52998224725`, `11144477735`, `39053344705`.

- **C1 (A1):** criar Ana com CPF `52998224725` e telefone `+5511987654321`; `newId()` retorna `01970000-0000-7000-8000-000000000001`. Esperado: `201`, `Location: /api/v1/people/01970000-0000-7000-8000-000000000001`, corpo `{ id: "01970000-0000-7000-8000-000000000001", fullName: "Ana Costa", cpf: "52998224725", phone: "+5511987654321", active: true, version: 1 }`; no banco, opcionais null.
- **C2 (A2):** `"  Ana Costa  "` é armazenado como `"Ana Costa"`. CPF `"529.982.247-25"`, `"11111111111"`, telefone `"(11) 99999-0000"`, nome vazio/só espaços, nome com 151 caracteres, e-mail inválido e propriedade extra respondem status `400`, `code: "VALIDATION_FAILED"`, `title: "Validação falhou"`, `detail: "Dados inválidos."`; `errors` lista exatamente os campos inválidos.
- **C3 (A3):** criar pessoa com CPF `52998224725` e depois outra com o mesmo CPF; segunda resposta é exatamente o problem `409 DUPLICATE_CPF` descrito em A3; existe somente uma linha com esse CPF.
- **C4 (A4):** criar pessoa com `referredById: "01970000-0000-7000-8000-000000000002"` existente; resposta `201` e linha criada tem esse `referred_by_id`. Repetir com esse ID ausente; resposta exatamente o problem `404 NOT_FOUND` descrito em A4.
- **C5 (A5):** com Ana ativa e pessoa importada ativa sem CPF, listagem sem query tem status `200`, itens `{id, fullName, cpf, phone, active}` exatos em ordem alfabética, `cpf: null` para importada e `nextCursor: null`; a inativa não aparece. Banco vazio retorna `{ items: [], nextCursor: null }`.
- **C6 (A6):** com José Lima/CPF `52998224725`, JOSE Santos/CPF `11144477735` e Lote 529 Silva/CPF `39053344705`, `search=jose` retorna José e JOSE; `search=529.982` retorna somente José; `search=529` retorna José e Lote 529 Silva nessa ordem. Cada item contém exatamente `{id, fullName, cpf, phone, active}`.
- **C7 (A7):** pessoas Bia/Davi/Eva com `limit=1` dão páginas Bia, Davi, Eva nessa ordem, cada uma com um item; dois primeiros cursores não são nulos e o último é nulo. Limites `0`, `-1`, `101`, `1.5`, `1e1`, vazio e `abc` dão `400 VALIDATION_FAILED` em `limit`. Cursor malformado dá `400 VALIDATION_FAILED` em `cursor`.
- **C8 (A8):** GET para Ana retorna o objeto básico exato de A8; GET para `01970000-0000-7000-8000-000000000099` retorna o problem `404 NOT_FOUND` exato de A8.
- **C9 (A9):** pessoa versão 3, com os campos opcionais preenchidos, recebe PATCH `{ version: 3, notes: null, email: null, birthDate: null }`; resposta `200`, corpo tem `version: 4`, esses três campos omitidos e CPF/telefone originais; banco confirma nulls e versão 4. `version` ausente, `version: -1`, `version: 1.5`, `cpf: null`, `active` ou `referredById` respondem `400 VALIDATION_FAILED`.
- **C10 (A10):** pessoa persistida na versão 2 recebe PATCH `{ version: 1, fullName: "Nome não aplicado" }`; resposta problem `409 VERSION_CONFLICT` exata de A10 e nome/versão permanecem intactos. PATCH sem `version` retorna `400 VALIDATION_FAILED`, não `428`.
- **C11 (A11):** duas pessoas com CPFs distintos; PATCH da primeira com CPF da segunda e versão atual retorna problem `409 DUPLICATE_CPF` exato de A11; CPF e versão da primeira permanecem inalterados.

## Arquivos de teste previstos

- `packages/schemas/src/api/people/people.test.ts` (`@pilla/schemas`, contrato): schemas de create, query/list, resposta básica e update; validação estrita, limites, nulabilidade e resposta de lista com CPF nulo. Cenários C2, C5 e C9.
- `apps/api/src/people/http/people.http.test.ts` (`@pilla/api`, Supertest + PGlite migrado): rotas, cabeçalhos, bodies, erros e persistência; C1–C11.
- E2E: nenhum. O fluxo com Postgres real pertence à E9-F11.

## Pendências
- **Contrato compartilhado:** propagar ao front as decisões divergentes registradas acima: resumo permite CPF nulo; PATCH aceita null para e-mail/nascimento/observações e leva `version` no corpo; detalhe desta etapa é básico; entradas mascaradas não são normalizadas pelos schemas fornecidos.
- **Busca sem acentos:** definir na implementação técnica uma comparação no banco que ignore diacríticos, preservar os testes E5-F05 de busca/ordenação/cursor e comprovar com PostgreSQL 17. A decisão de produto está resolvida pelo Joel em 20/11; não reabrir essa decisão.
- **Nenhuma pendência de produto** para `DUPLICATE_CPF`, versão no corpo do PATCH, busca sem acentos, regra de principal de endereço/PIX ou promoção ao excluir principal. Endereços/PIX e a ficha agregada permanecem em E9-F04/F05.
