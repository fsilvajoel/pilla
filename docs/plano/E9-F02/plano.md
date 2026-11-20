# Plano E9-F02: base da API NestJS (bootstrap, health, banco, validação Zod, problem+json)

Plano da feature (etapa 1 do workflow feature). Cartões: `docs/plano/E9.yaml`, E9-T02 (test-author, Bia) e E9-T03 (implement). Referências: `docs/plano/E9.md` D1 e D3, RFC-003 §4.2, RFC-004 §2 e §6, ADR-0002, ADR-0017, `docs/travas.md` (dependências e env validado). Rascunho do Pepe reprovado em duas tentativas e plano escrito pelo planner Claude (ver `estado.json`, `stages.plan`). Não é cartão de tela: não leva `shadcn` nem `tailwind-css`.

## Escopo

Entra:
- Bootstrap NestJS em `apps/api`: `bootstrap(env)` sobe o app em `127.0.0.1:PILLA_API_PORT` com prefixo `/api/v1` (D1, D3: a API escuta só em 127.0.0.1).
- `GET /api/v1/health`: 200 com o estado do banco (E9-T02 done).
- Provider de banco: `DATABASE_URL` lido do ambiente (E9-T03 done); testes trocam o provider por PGlite.
- Leitura e validação das variáveis de ambiente com Zod (`docs/travas.md`: app não sobe com config inválida).
- Pipe de validação Zod (`ZodValidationPipe`), usado por parâmetro (`@Body(new ZodValidationPipe(schema))`), só na borda HTTP (D1). Schema vem de `@pilla/schemas`; as rotas de pessoas só chegam na E9-F03, então os testes usam rotas fixture declaradas no próprio arquivo de teste.
- Filtro global `application/problem+json` (RFC-004 §2 e §6): 400 `VALIDATION_FAILED` com `errors` por campo, 404 `NOT_FOUND`, erro inesperado 500 sem stack e sem a mensagem interna, e `ProblemException` para as features seguintes lançarem qualquer `code` do catálogo.
- OpenAPI gerado do zod (ADR-0017, RFC-004): `GET /api/v1/openapi.json` com `z.toJSONSchema` (zod 4, sem dependência nova).
- Schema `healthResponseSchema` em `packages/schemas` (RFC-004: o zod é a fonte da verdade).
- Testes de contrato de rota com Supertest (ADR-0017).

Fora: rotas de pessoas (E9-F03), login e guard (D3), logger estruturado (pino), docker e migrations (E9-F01), CORS, throttling, Swagger UI.

Cartões: `docs/plano/E9.yaml`, E9-T02 e E9-T03. O planejamento achou lacunas nos `allowedPaths`, nas dependências e no código de 500 (ver Pendências e `revisao.md`).

## Contrato

Esboço em `docs/plano/E9-F02/esboco-api.txt` (cada bloco marca o arquivo de destino; assinaturas que lançam `Error("esboço: não implementado")`). Decoradores do Nest exigem `experimentalDecorators` e injeção explícita: todo parâmetro de construtor leva `@Inject(<token>)`, porque o esbuild do Vitest não emite `design:paramtypes`. Exports nomeados, sem `export default`, sem `any`.

- `apps/api/src/core/http/env.ts`: `ApiEnv = { readonly host: "127.0.0.1"; readonly port: number; readonly databaseUrl: string }`; `readApiEnv(env: Readonly<Record<string, string | undefined>>): ApiEnv` (lança `Error` com a mensagem das linhas de domínio; nunca inclui o valor lido na mensagem).
- `apps/api/src/core/http/problem-exception.ts`: `ProblemFieldError = { readonly field: string; readonly message: string }`; `class ProblemException extends HttpException` com `constructor(code: ErrorCode, detail: string, errors?: readonly ProblemFieldError[])` e campos `readonly code: ErrorCode`, `readonly detail: string`, `readonly errors: readonly ProblemFieldError[] | undefined`; status = `errorStatus[code]` (de `@pilla/schemas`).
- `apps/api/src/core/http/zod-validation.pipe.ts`: `class ZodValidationPipe<T> implements PipeTransform<unknown, T>` com `constructor(schema: ZodType<T>)` e `transform(value: unknown, metadata: ArgumentMetadata): T` (devolve a saída do schema; em falha lança `ProblemException("VALIDATION_FAILED", "Dados inválidos.", errors)`). `errors` tem um item por campo recusado (o primeiro problema de cada caminho), `field` = caminho com `.`; problema na raiz usa `metadata.type` (`"body"`, `"query"`, `"param"` ou `"custom"`).
- `apps/api/src/core/http/problem-details.filter.ts`: `@Catch() class ProblemDetailsFilter implements ExceptionFilter` com `constructor(@Inject(HttpAdapterHost) adapterHost: HttpAdapterHost)` e `catch(exception: unknown, host: ArgumentsHost): void`. Responde `Content-Type: application/problem+json` e corpo `Problem` (`problemSchema`, `status` = `errorStatus[code]`). Mapeamento: `ProblemException` mantém o `code`, o `detail` e os `errors`; `HttpException` 404 vira `NOT_FOUND`; `HttpException` 400 que não é `ProblemException` (ex.: JSON malformado) vira `VALIDATION_FAILED` sem `errors`; qualquer outra coisa vira `INTERNAL_ERROR` 500 (Pendência P1). Títulos e detalhes: `VALIDATION_FAILED` "Validação falhou" / "Dados inválidos."; `NOT_FOUND` "Não encontrado" / "Recurso não encontrado."; `INTERNAL_ERROR` "Erro interno" / "Erro interno do servidor."; `ProblemException` de outro `code` usa o próprio `code` como `title` e o `detail` recebido. O erro 500 é registrado no log do servidor (`Logger.error`) e nunca vai no corpo.
- `apps/api/src/core/http/health.controller.ts`: `@Controller("health") class HealthController` com `constructor(@Inject(DATABASE) db: Database)` e `check(): Promise<HealthResponse>` (`@Get()`; consulta `select 1`; sucesso `{ status: "ok", database: "up" }`; falha da consulta `{ status: "degraded", database: "down" }`; sempre HTTP 200, conforme o done do E9-T02).
- `apps/api/src/core/http/openapi.ts`: `OpenApiDocument` (tipo exato do objeto abaixo); `buildOpenApiDocument(): OpenApiDocument`; `@Controller("openapi.json") class OpenApiController` com `@Get() document(): OpenApiDocument`. Documento: `openapi: "3.1.0"`, `info: { title: "pilla API", version: "0.1.0" }`, `servers: [{ url: "/api/v1" }]`, `paths["/health"].get` com `operationId: "getHealth"` e respostas `200` (`application/json`, `$ref: "#/components/schemas/HealthResponse"`) e `500` (`application/problem+json`, `$ref: "#/components/schemas/Problem"`), `components.schemas.HealthResponse = z.toJSONSchema(healthResponseSchema)` e `components.schemas.Problem = z.toJSONSchema(problemSchema)`.
- `apps/api/src/core/http/configure-app.ts`: `configureApp(app: INestApplication): void` (prefixo global `api/v1` e `ProblemDetailsFilter` global).
- `apps/api/src/db/database.ts`: `type Database = NodePgDatabase | PgliteDatabase`; `const DATABASE: unique symbol` e `const DATABASE_HANDLE: unique symbol` (tokens); `DatabaseHandle = { readonly db: Database; close(): Promise<void> }`; `createDatabase(databaseUrl: string): DatabaseHandle` (`pg.Pool` + `drizzle-orm/node-postgres`; o Pool só conecta na primeira consulta; `close` chama `pool.end()`).
- `apps/api/src/app.module.ts`: `@Module({}) class AppModule implements OnApplicationShutdown` com `static forRoot(env: ApiEnv): DynamicModule` (controllers `HealthController` e `OpenApiController`; providers `DATABASE_HANDLE` por `createDatabase(env.databaseUrl)` e `DATABASE` = `handle.db`) e `onApplicationShutdown(): Promise<void>` que chama `handle.close()`. Testes trocam o provider com `overrideProvider(DATABASE_HANDLE)` (PGlite).
- `apps/api/src/main.ts`: `bootstrap(env: Readonly<Record<string, string | undefined>>): Promise<INestApplication>` (`readApiEnv`, `NestFactory.create(AppModule.forRoot(env))`, `configureApp`, `listen(port, host)`). O processo é iniciado por um script `start` do `apps/api/package.json` que chama `bootstrap(process.env)`; assim `main.ts` não tem efeito colateral na importação e entra na cobertura.
- `packages/schemas/src/api/core/health.ts`: `healthResponseSchema = z.strictObject({ status: z.enum(["ok", "degraded"]), database: z.enum(["up", "down"]) })`; `type HealthResponse = z.infer<typeof healthResponseSchema>`; reexportado em `packages/schemas/src/index.ts`.

## Arquivos de produção

Todos os arquivos têm lógica (validação, mapeamento, consulta, composição testada pelo app) e entram em `sources`. Nenhum é dispensado: não há arquivo só de layout/estilo (`dispensa-estilo`) nem código de biblioteca copiado ou gerado (`dispensa-biblioteca`); `exemptSources` fica vazio. `domainSources` fica vazio: é infraestrutura HTTP e cola, sem regra de negócio nem cálculo de domínio (a mutação não tem o que medir; o gate de mutação não se aplica).

| Arquivo | Domínio | Teste | Motivo |
|---|---|---|---|
| `apps/api/src/core/http/env.ts` | não | tdd | valida e converte `PILLA_API_PORT` e `DATABASE_URL` (propriedade com `prop`) |
| `apps/api/src/core/http/problem-exception.ts` | não | tdd | liga `code` ao status do catálogo; usado por pipe e features |
| `apps/api/src/core/http/zod-validation.pipe.ts` | não | tdd | validação e montagem de `errors` por campo |
| `apps/api/src/core/http/problem-details.filter.ts` | não | tdd | mapeamento de exceção para problem+json e ocultação do erro interno |
| `apps/api/src/core/http/health.controller.ts` | não | tdd | ramo banco ok e banco indisponível |
| `apps/api/src/core/http/openapi.ts` | não | tdd | documento gerado do zod e rota que o serve |
| `apps/api/src/core/http/configure-app.ts` | não | tdd | prefixo e filtro global (rota fora do prefixo dá 404) |
| `apps/api/src/db/database.ts` | não | tdd | cria o pool e fecha; tokens de injeção |
| `apps/api/src/app.module.ts` | não | tdd | composição e fechamento do pool; coberta pelo teste do app |
| `apps/api/src/main.ts` | não | tdd | `bootstrap` valida o ambiente e escuta a porta |
| `packages/schemas/src/api/core/health.ts` | não | tdd | contrato da resposta (ADR-0017: `safeParse` antes da regra) |

Ficam fora de `sources` (configuração, não produção): `apps/api/package.json`, `apps/api/tsconfig.json` (`experimentalDecorators`), `pnpm-lock.yaml`, `docs/travas.md`, `docs/rfc/RFC-004-api-e-eventos.md` (§6, código de 500) e `packages/schemas/src/index.ts` (só reexport; coberto pelo teste de schemas).

## Domínio das entradas

| Entrada | Formato aceito | Mínimo | Máximo | Exemplos rejeitados | Erro esperado | Fonte |
|---|---|---|---|---|---|---|
| `PILLA_API_PORT` | só dígitos ASCII, sem espaço nem sinal | 1024 | 65535 | ausente, `""`, `"   "`, `" 3000 "`, `"3000.0"`, `"3e3"`, `"+3000"`, `"-1"`, `"0"`, `"1023"`, `"65536"`, `"99999999999999999999"`, `"abc"` | `readApiEnv` lança `Error` com `PILLA_API_PORT ausente: informe um inteiro de 1024 a 65535.` (ausente, `""` ou só espaços) ou `PILLA_API_PORT inválida: informe um inteiro de 1024 a 65535.`; o app não sobe | `docs/travas.md` (env validado, app não sobe com config inválida); faixa 1024 a 65535 pela decisão P4 do E9-F01 (`docs/plano/E9-F01/plano.md`) |
| `DATABASE_URL` | URL `postgres://usuario:senha@host:porta/banco` (esquema `postgres` ou `postgresql`), sem espaço em volta | host e nome do banco não vazios | sem limite definido | ausente, `""`, `"   "`, `" postgres://u:p@h:5432/db "`, `"localhost:5432"`, `"mysql://u:p@h:3306/db"`, `"postgres://u:p@h:abc/db"`, `"postgres://u:p@h:5432"` (sem banco), `"postgres://u:p@:5432/db"` (sem host) | `Error` com `DATABASE_URL ausente: informe postgres://usuario:senha@host:porta/banco.` ou `DATABASE_URL inválida: informe postgres://usuario:senha@host:porta/banco.`; a mensagem nunca traz o valor lido (senha); o app não sobe | `docs/plano/E9.md` D2 e D4 (`.env`), `docs/travas.md`, plano E9-F01 (mesmo formato) |
| Corpo (`@Body`) validado pelo pipe | o que o schema do parâmetro aceita; nos testes o schema fixture é `{ name: string min 1, age: inteiro 0 a 150 }` estrito | schema | schema | `{}`, `{"name":""}`, `{"name":"Ana","age":151}`, `{"name":"Ana","age":-1}`, `{"name":"Ana","age":"30"}`, `{"name":"Ana","age":30,"role":"admin"}`, `null`, `[]` | 400 `VALIDATION_FAILED` com `errors` (um item por campo) | RFC-004 §6; D1; E9-T02 done |
| Query (`@Query`) validada pelo pipe | nos testes: `limit` só dígitos ASCII, inteiro 1 a 100 (formato da paginação, RFC-004 §2 `?limit=50`) | 1 | 100 | `"0"`, `"101"`, `" 6 "`, `"1e1"`, `"6.5"`, `"-1"`, `"abc"`, `""` | 400 `VALIDATION_FAILED`, `errors` com `field: "limit"` | RFC-004 §2 (paginação) e §6; o limite 100 é do fixture do teste, não regra da API |
| Corpo JSON malformado | JSON válido | n/a | n/a | `{"name":` (truncado), texto livre | 400 `VALIDATION_FAILED` sem `errors` (risco R3) | RFC-004 §6 |
| Rota desconhecida (qualquer método) | n/a | n/a | n/a | `GET /api/v1/nao-existe`, `GET /health` (fora do prefixo), `POST /api/v1/health` | 404 `NOT_FOUND` problem+json | RFC-004 §6; E9-T02 done |
| Exceção não tratada em rota | qualquer `Error` | n/a | n/a | `Error("senha=segredo-123")` | 500 `INTERNAL_ERROR` problem+json sem a mensagem e sem stack (P1) | E9-T02 done; RFC-004 §2 |

Mensagens de erro de `errors[].message` vêm do schema; os textos acima de `title` e `detail` são escolha do plano (RFC-004 §6 manda `detail` em pt-BR, sem texto fixo), ajustáveis pelo PM.

## Riscos

- R1, decoradores no Vitest: o esbuild não emite `design:paramtypes`; por isso todo parâmetro leva `@Inject(token)`. Os decoradores exigem `experimentalDecorators: true` no `apps/api/tsconfig.json` (fora dos `allowedPaths` do E9-T03; ver P3). Com `verbatimModuleSyntax`, tipos usados em parâmetro decorado entram com `import type`.
- R2, dependências ainda não instaladas e não permitidas (P2): sem `@nestjs/*`, `reflect-metadata`, `rxjs` e `supertest` instalados, nem o esboço compila nem o E9-T02 chega ao expect-red.
- R3, JSON malformado: o `body-parser` do Express pode responder antes do filtro global do Nest. Se o teste C16 mostrar isso, o implementer registra o tratamento no `configureApp`; o critério A4 vale igual.
- R4, `z.toJSONSchema(problemSchema)` precisa aceitar o `.refine`; se lançar, o implementer exporta o schema sem o `refine` para a geração (sem mudar `problemSchema`). Conferir no C23.
- R5, `INTERNAL_ERROR` não existe no catálogo: `problemSchema` exige `status` igual a `errorStatus[code]`, então o 500 só valida depois de P1 ser aplicado em `packages/schemas`.
- R6, `HttpException` com status fora do catálogo (401, 403, 405, 413, 415...) cai em `INTERNAL_ERROR` 500 até as features trazerem esses `code` por `ProblemException`. Risco aceito nesta feature (sem guard, D3).
- R7, o pool do `pg` não conecta até a primeira consulta, então o teste do app sobe o `AppModule` real sem Postgres; nenhum teste desta feature fala com o PostgreSQL de verdade (provado depois no E9-F11).
- R8, a cobertura de `apps/api` exige 100% em tudo de `src/` (`vitest.config.ts`); por isso `main.ts` exporta `bootstrap` em vez de executar na importação.

## Dependências

- E9-F01 (pg e @types/pg, `.env` com `DATABASE_URL`) e `apps/api/src/db/migrate.ts` (PGlite de teste via `migratedTestDb`).
- `@pilla/schemas` (`problemSchema`, `errorStatus`, `ErrorCode`) como dependência `workspace:*` do `apps/api`.
- Runtime já permitido em `docs/travas.md`: `@nestjs/*` (`common`, `core`, `platform-express`, `testing`), `pg`, `zod`, `drizzle-orm`. Falta aprovar: `reflect-metadata`, `rxjs` (peer do Nest), `supertest` e `@types/supertest` (dev). `fast-check` já é permitido e entra em `devDependencies` do `apps/api` para as propriedades.
- Sem `@types/express`: o filtro usa `HttpAdapterHost` (`setHeader` e `reply`), sem importar tipos do Express.

## Critérios de aceite

Camada: Supertest sobre o app Nest em memória é `unit` (sem navegador, sem rede); `e2e` é só Playwright (E9-F11). Não há critério `mut` (nenhum `domainSources`).

### A1: leitura de PILLA_API_PORT
- entrada: `env.PILLA_API_PORT` e `env.DATABASE_URL = "postgres://u:p@127.0.0.1:5432/pilla"`
- domínio: `PILLA_API_PORT`
- saída: `readApiEnv({ PILLA_API_PORT: "3000", DATABASE_URL })` devolve `{ host: "127.0.0.1", port: 3000, databaseUrl: DATABASE_URL }`; `"1024"` e `"65535"` são aceitos; para todo inteiro de 1024 a 65535, `String(n)` devolve `port === n`
- erro: `Error("PILLA_API_PORT ausente: informe um inteiro de 1024 a 65535.")` ou `Error("PILLA_API_PORT inválida: informe um inteiro de 1024 a 65535.")`, conforme a tabela
- fonte: `docs/travas.md` (env validado); plano E9-F01 (P4); D3 (host fixo 127.0.0.1)
- camada: unit, prop

### A2: leitura de DATABASE_URL
- entrada: `env.DATABASE_URL` com `PILLA_API_PORT = "3000"`
- domínio: `DATABASE_URL`
- saída: a URL válida volta igual em `databaseUrl`; `postgresql://u:p@db:5432/pilla` também é aceita
- erro: `Error("DATABASE_URL ausente: informe postgres://usuario:senha@host:porta/banco.")` ou `Error("DATABASE_URL inválida: informe postgres://usuario:senha@host:porta/banco.")`; a mensagem não contém o texto lido nem a senha
- fonte: `docs/travas.md`; D2 e D4; plano E9-F01
- camada: unit, prop

### A3: ZodValidationPipe
- entrada: `value` e `metadata` (`body` ou `query`) com o schema do pipe
- domínio: corpo e query validados
- saída: valor válido devolve a saída do schema (com `transform`/coerção aplicada); valor inválido lança `ProblemException` com `code` `VALIDATION_FAILED` (status 400), `detail` `"Dados inválidos."` e `errors` com um item por campo recusado, na ordem do schema, `field` com o caminho separado por `.`, e `field` igual a `metadata.type` para problema na raiz
- erro: o pipe nunca devolve valor inválido nem lança outro tipo de erro; para qualquer entrada, os `field` de `errors` não se repetem
- fonte: RFC-004 §6; D1; E9-T02 done
- camada: unit, prop

### A4: corpo ou query inválidos respondem 400 problem+json
- entrada: `POST /api/v1/fixtures/echo` e `GET /api/v1/fixtures/list` (rotas fixture do teste, com o pipe)
- domínio: corpo, query e JSON malformado
- saída: status 400, `Content-Type` começando em `application/problem+json`, corpo igual a `{ title: "Validação falhou", status: 400, detail: "Dados inválidos.", code: "VALIDATION_FAILED", errors: [...] }` e que passa em `problemSchema.safeParse`; JSON malformado: mesmo corpo sem `errors`
- erro: nenhum
- fonte: RFC-004 §2 e §6; E9-T02 done
- camada: unit

### A5: rota desconhecida responde 404 problem+json
- entrada: qualquer rota fora do mapa, ou fora do prefixo `/api/v1`
- domínio: rota desconhecida
- saída: status 404, `application/problem+json`, corpo `{ title: "Não encontrado", status: 404, detail: "Recurso não encontrado.", code: "NOT_FOUND" }`
- erro: nenhum
- fonte: RFC-004 §6; E9-T02 done
- camada: unit

### A6: erro inesperado responde 500 sem vazar
- entrada: rota fixture que lança `Error("senha=segredo-123")`; e, na propriedade, `Error` com mensagem qualquer
- domínio: exceção não tratada
- saída: status 500, `application/problem+json`, corpo `{ title: "Erro interno", status: 500, detail: "Erro interno do servidor.", code: "INTERNAL_ERROR" }` (P1) que passa em `problemSchema.safeParse`; o texto da resposta não contém a mensagem lançada, `stack` nem linha de stack (`/\n\s+at /`); a mensagem e o stack vão para `Logger.error`
- erro: nenhum
- fonte: E9-T02 done; RFC-004 §2 (problem+json); P1 pendente para o `code`
- camada: unit, prop

### A7: ProblemException leva qualquer code do catálogo
- entrada: rota fixture que lança `new ProblemException("VERSION_CONFLICT", "Versão desatualizada.")`
- domínio: `code` do catálogo
- saída: status 409, `application/problem+json`, corpo `{ title: "VERSION_CONFLICT", status: 409, detail: "Versão desatualizada.", code: "VERSION_CONFLICT" }`
- erro: nenhum
- fonte: RFC-004 §6; `errorStatus` de `packages/schemas`
- camada: unit

### A8: health com o banco disponível
- entrada: `GET /api/v1/health` com PGlite migrado no lugar do provider
- domínio: rota de health
- saída: 200, `application/json`, corpo `{ "status": "ok", "database": "up" }` que passa em `healthResponseSchema.safeParse`
- erro: nenhum
- fonte: E9-T02 done; RFC-004 §2
- camada: unit

### A9: health com o banco indisponível
- entrada: `GET /api/v1/health` com o PGlite já fechado (`client.close()`)
- domínio: rota de health
- saída: 200, corpo `{ "status": "degraded", "database": "down" }`; sem detalhe do erro do banco na resposta
- erro: nenhum
- fonte: E9-T02 done ("200 with the database status")
- camada: unit

### A10: composição do app
- entrada: `AppModule.forRoot(env)` e `configureApp`
- domínio: prefixo, provider de banco, ciclo de vida
- saída: `GET /api/v1/health` responde 200 e `GET /health` responde 404 problem+json; com `DATABASE_HANDLE` trocado, o app não abre conexão; sem troca, o app sobe e fecha com `DATABASE_URL` válida sem Postgres no ar; `app.close()` chama `close()` do handle exatamente uma vez
- erro: nenhum
- fonte: D1; E9-T03 done (provider lê `DATABASE_URL`; testes injetam PGlite)
- camada: unit

### A11: bootstrap
- entrada: `bootstrap(env)` com `PILLA_API_PORT` livre (escolhida no teste) e `DATABASE_URL` válida
- domínio: `PILLA_API_PORT`, `DATABASE_URL`
- saída: devolve o app já escutando em `127.0.0.1:<porta>` e `GET http://127.0.0.1:<porta>/api/v1/health` responde 200 ou 200 degraded
- erro: com env inválido, `bootstrap` rejeita com a mensagem de A1 ou A2 antes de criar o app
- fonte: D1 e D3; E9-T03 done (listens on 127.0.0.1:PILLA_API_PORT with prefix /api/v1)
- camada: unit

### A12: OpenAPI gerado do zod
- entrada: `buildOpenApiDocument()` e `GET /api/v1/openapi.json`
- domínio: rota do documento
- saída: o JSON da rota é igual ao documento descrito no Contrato; `components.schemas.HealthResponse` é igual a `z.toJSONSchema(healthResponseSchema)` e `components.schemas.Problem` é igual a `z.toJSONSchema(problemSchema)`; todo `$ref` aponta para um schema existente em `components.schemas`
- erro: nenhum
- fonte: ADR-0017 (OpenAPI gerado do zod entra com o NestJS); RFC-004 §1 e RFC-003 §4.2
- camada: unit

### A13: contrato da resposta de health
- entrada: objetos para `healthResponseSchema.safeParse`
- domínio: resposta de health
- saída: `{ status: "ok", database: "up" }` e `{ status: "degraded", database: "down" }` têm `success: true`
- erro: `{}`, `{ status: "ok" }`, `{ status: "fail", database: "up" }`, `{ status: "ok", database: "up", extra: 1 }` e `null` têm `success: false`
- fonte: ADR-0017 (contrato primeiro); RFC-004 (zod como fonte)
- camada: unit

## Cenários

- C1 (A1, unit): `PILLA_API_PORT: "3000"` devolve `port: 3000`, `host: "127.0.0.1"`; `"1024"` e `"65535"` aceitos (fonte travas, P4 do E9-F01)
- C2 (A1, unit): rejeita `"1023"`, `"65536"`, `"0"`, `"-1"`, `" 3000 "`, `"3000.0"`, `"3e3"`, `"+3000"`, `"abc"` e `"99999999999999999999"` com a mensagem `PILLA_API_PORT inválida: informe um inteiro de 1024 a 65535.`
- C3 (A1, unit): `PILLA_API_PORT` ausente, `""` e `"   "` rejeitados com `PILLA_API_PORT ausente: informe um inteiro de 1024 a 65535.`
- C4 (A1, prop): para todo inteiro `n` de 1024 a 65535, `readApiEnv` com `String(n)` devolve `port === n`; para todo inteiro fora da faixa, lança
- C5 (A2, unit): `postgres://u:p@127.0.0.1:5432/pilla` e `postgresql://u:p@db:5432/pilla` aceitas e devolvidas iguais
- C6 (A2, unit): rejeita `"localhost:5432"`, `"mysql://u:p@h:3306/db"`, `"postgres://u:p@h:abc/db"`, `"postgres://u:p@h:5432"`, `"postgres://u:p@:5432/db"` e `" postgres://u:p@h:5432/db "` com `DATABASE_URL inválida: informe postgres://usuario:senha@host:porta/banco.`; ausente, `""` e `"   "` com `DATABASE_URL ausente: ...`
- C7 (A2, prop): para toda senha `s` (texto sem `:`, `@`, `/`, `?`, `#`, `%` nem espaço), a URL `postgres://u:<s>@h:5432/db` com a porta inválida lança e a mensagem não contém `s`
- C8 (A3, unit): com schema `{ name: string min 1 "Nome é obrigatório.", age: inteiro 0 a 150 }` estrito, `transform({ name: "Ana", age: 30 }, { type: "body" })` devolve o mesmo objeto
- C9 (A3, unit): `transform({}, { type: "body" })` lança `ProblemException` `VALIDATION_FAILED` com `errors[0].field === "name"` e `errors[1].field === "age"`; `{ name: "", age: 30 }` dá `errors` igual a `[{ field: "name", message: "Nome é obrigatório." }]`
- C10 (A3, unit): `{ name: "Ana", age: 151 }`, `{ name: "Ana", age: -1 }`, `{ name: "Ana", age: "30" }` apontam `field: "age"`; `{ name: "Ana", age: 30, role: "admin" }`, `null` e `[]` apontam `field: "body"`; o mesmo schema com `{ type: "query" }` aponta `field: "query"`
- C11 (A3, prop): para qualquer valor gerado, o pipe devolve a saída do schema ou lança `ProblemException` com `errors` sem `field` repetido e sem `message` vazio
- C12 (A4, unit): `POST /api/v1/fixtures/echo` com `{ "name": "Ana", "age": 30 }` responde 201 com o mesmo corpo (o pipe deixa o valor válido passar)
- C13 (A4, unit): o mesmo POST com `{}` responde 400 com `Content-Type: application/problem+json`, `code: "VALIDATION_FAILED"`, `title: "Validação falhou"`, `detail: "Dados inválidos."`, e `errors` com os campos `name` e `age`; o corpo passa em `problemSchema.safeParse`
- C14 (A4, unit): `GET /api/v1/fixtures/list?limit=0`, `?limit=101`, `?limit=%206%20`, `?limit=1e1`, `?limit=6.5`, `?limit=-1`, `?limit=abc` e `?limit=` respondem 400 `VALIDATION_FAILED` com `errors[0].field === "limit"`; `?limit=1` e `?limit=100` respondem 200
- C15 (A4, unit): `POST` com `{"name":"Ana","age":151}` responde 400 com `errors` igual a `[{ field: "age", message: <texto não vazio> }]`
- C16 (A4, unit): `POST` com corpo `{"name":` (JSON truncado) e `Content-Type: application/json` responde 400 `VALIDATION_FAILED` sem a chave `errors` (risco R3)
- C17 (A5, unit): `GET /api/v1/nao-existe` responde 404 com `application/problem+json` e corpo `{ title: "Não encontrado", status: 404, detail: "Recurso não encontrado.", code: "NOT_FOUND" }`
- C18 (A5, unit): `GET /health` (sem prefixo) e `POST /api/v1/health` respondem 404 `NOT_FOUND`
- C19 (A6, unit): `GET /api/v1/fixtures/boom` (lança `Error("senha=segredo-123")`) responde 500 `application/problem+json` com `code: "INTERNAL_ERROR"`, `title: "Erro interno"`, `detail: "Erro interno do servidor."`; o texto da resposta não contém `segredo-123`, `stack` nem linha de stack (`/\n\s+at /`); `Logger.error` foi chamado com a mensagem
- C20 (A6, prop): para qualquer mensagem `m` (texto com pelo menos 8 caracteres), um `Error(m)` lançado devolve 500, corpo que passa em `problemSchema.safeParse` e texto da resposta sem `m`
- C21 (A7, unit): `GET /api/v1/fixtures/conflict` (lança `ProblemException("VERSION_CONFLICT", "Versão desatualizada.")`) responde 409 com `code: "VERSION_CONFLICT"`, `title: "VERSION_CONFLICT"`, `detail: "Versão desatualizada."`; com `errors` informados, eles vão no corpo
- C22 (A8, unit): `GET /api/v1/health` com PGlite migrado responde 200, `application/json`, corpo `{ status: "ok", database: "up" }` que passa em `healthResponseSchema.safeParse`
- C23 (A9, unit): com o PGlite fechado antes da chamada, `GET /api/v1/health` responde 200 com `{ status: "degraded", database: "down" }` e o texto da resposta não contém a mensagem do erro do banco
- C24 (A10, unit): `AppModule.forRoot(env)` com `DATABASE_HANDLE` trocado por PGlite: `GET /api/v1/health` 200 e `GET /health` 404 `NOT_FOUND`; `app.close()` chama o `close` do handle uma vez
- C25 (A10, unit): `AppModule.forRoot({ host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:5432/pilla" })` sem troca sobe, fecha e não abre conexão; `createDatabase` devolve `db` e `close()` resolve
- C26 (A11, unit): `bootstrap({ PILLA_API_PORT: <porta livre >= 1024>, DATABASE_URL })` devolve o app escutando; `GET http://127.0.0.1:<porta>/api/v1/health` responde 200; `app.getHttpServer().address()` tem `address: "127.0.0.1"` e `port` igual
- C27 (A11, unit): `bootstrap({ PILLA_API_PORT: "80", DATABASE_URL })` e `bootstrap({ PILLA_API_PORT: "3000" })` rejeitam com as mensagens de A1 e A2, sem criar o app
- C28 (A12, unit): `GET /api/v1/openapi.json` responde 200 com o documento do Contrato (`openapi: "3.1.0"`, `servers: [{ url: "/api/v1" }]`, caminho `/health`); `components.schemas.HealthResponse` e `components.schemas.Problem` iguais a `z.toJSONSchema(...)` dos schemas; todo `$ref` resolve em `components.schemas` (risco R4)
- C29 (A13, unit): `healthResponseSchema.safeParse` aceita os dois objetos válidos
- C30 (A13, unit): rejeita `{}`, `{ status: "ok" }`, `{ status: "fail", database: "up" }`, `{ status: "ok", database: "up", extra: 1 }` e `null`

Rotas fixture dos testes (declaradas dentro do arquivo de teste, nunca em produção): `POST /fixtures/echo` (corpo validado), `GET /fixtures/list` (query validada), `GET /fixtures/boom` (lança `Error("senha=segredo-123")`), `GET /fixtures/conflict` (lança `ProblemException("VERSION_CONFLICT", "Versão desatualizada.")`).

## Arquivos de teste previstos

- `apps/api/src/core/http/env.test.ts` (pacote `pnpm --filter @pilla/api`; camadas unit, prop): C1 a C7
- `apps/api/src/core/http/zod-validation.pipe.test.ts` (unit, prop): C8 a C11
- `apps/api/src/core/http/problem-details.filter.test.ts` (unit, prop; usa Supertest com as rotas fixture): C12 a C21
- `apps/api/src/core/http/health.controller.test.ts` (unit): C22 e C23
- `apps/api/src/core/http/openapi.test.ts` (unit): C28
- `apps/api/src/app.test.ts` (unit): C24 a C27
- `packages/schemas/src/api/core/health.test.ts` (pacote `@pilla/schemas`; unit): C29 e C30
- e2e: nenhum (o fluxo ponta a ponta com Postgres real é a E9-F11)

## Pendências

- P1 (resolvida, Joel 19/11: aprovado): `INTERNAL_ERROR` com status 500 e `detail` "Erro interno do servidor.". A RFC-004 §6 já o lista; `errorCodeSchema` e `errorStatus` em `packages/schemas/src/api/problem.ts` ganham o code no E9-T03 (mesmo padrão do D8 com `DUPLICATE_CPF`).
- P2 (resolvida, Joel 19/11: aprovado): `reflect-metadata`, `rxjs` (runtime), `supertest` e `@types/supertest` (dev) em `docs/travas.md` §7; instalados antes da etapa tests para o esboço compilar.
- P3 (resolvida, aplicada na rodada 2): `allowedPaths`, `checks`, `protectedTests`, `readFirst` e `done` dos cartões E9-T02 e E9-T03 ajustados em `docs/plano/E9.yaml` (ver `revisao.md`). O E9-T03 também ganha `packages/schemas/src/api/problem.ts` (P1); a RFC-004 §6 já foi editada na rodada 2, fora do cartão.
