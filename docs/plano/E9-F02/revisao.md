# Refinamento funcional E9-F02

refinador: refiner (Claude); segunda opinião: pepe
rodada: 2

## Requisitos
- [x] Todo `A<n>` (A1 a A13) está no molde fixo, com saída exata e uma camada ou mais; A6 só falta o `code` do 500 (P1).
- [x] Toda regra tem fonte; toda entrada externa tem linha na tabela de domínio, com rejeição e erro exato (env, corpo, query, JSON malformado, rota desconhecida, exceção).
- [x] Contrato, arquivos de produção, dependências e arquivos de teste previstos bastam para escrever os testes e implementar sem adivinhar (P1, P2 e P3 resolvidas na rodada 2).

## Cartões
| Cartão | DoR | DoD |
|---|---|---|
| E9-T02 | ajustado | ajustado |
| E9-T03 | ajustado | ajustado |

## Veredito
ajustado (rodada 2; a rodada 1 foi pendencia-pm)

## Mudanças
- rodada 1: nenhuma aplicada. Esta sessão só podia escrever em `docs/plano/E9-F02/`, então os ajustes de cartão abaixo ficam propostos (o orquestrador os aplica em `docs/plano/E9.yaml`, só nos cartões E9-T02 e E9-T03):
  - E9-T02 `allowedPaths`: acrescentar `packages/schemas/src/api/core/health.test.ts`; manter os dois padrões atuais (`apps/api/src/core/http/*.test.ts`, `apps/api/src/app.test.ts`). `checks`: incluir `pnpm --filter @pilla/schemas exec vitest run src/api/core/health.test.ts` (com `!` na frente, como o primeiro check) e manter o `check-test-quality` com o novo caminho.
  - E9-T02 `done` (hoje 3 itens genéricos), trocar por itens verificáveis ligados ao plano: env (A1, A2, C1 a C7); pipe (A3, C8 a C11); 400, 404, 500 e `ProblemException` (A4 a A7, C12 a C21) com `application/problem+json` e os textos exatos de `title` e `detail`; health ok e `degraded` (A8, A9); composição, bootstrap e OpenAPI (A10 a A12); contrato de health (A13). Rotas fixture só dentro dos testes.
  - E9-T02 `readFirst`/`refs`: `docs/plano/E9-F02/plano.md`, `docs/plano/E9-F02/esboco-api.txt`, `packages/schemas/src/api/problem.ts`, `docs/adr/0017-estrategia-de-testes.md`.
  - E9-T03 `allowedPaths`: acrescentar `apps/api/src/core/http/**` (já tem), `apps/api/tsconfig.json`, `pnpm-lock.yaml`, `docs/travas.md`, `packages/schemas/src/api/core/health.ts`, `packages/schemas/src/index.ts`, `docs/rfc/RFC-004-api-e-eventos.md` (P1) e `apps/api/package.json` (já tem; recebe `@nestjs/*`, `reflect-metadata`, `rxjs`, `@pilla/schemas`, `fast-check`, `supertest`, `@types/supertest`, script `start`).
  - E9-T03 `checks`: acrescentar `pnpm --filter @pilla/schemas test`, `pnpm --filter @pilla/schemas typecheck`, `pnpm check:schemas` e `pnpm --filter @pilla/api test` (cobertura 100% da API). `protectedTests`: incluir os testes novos de T02 (lista do plano) e o de schemas.
  - E9-T03 `done`: incluir o `OpenApiController`, `readApiEnv` com as mensagens exatas, o schema de health, `experimentalDecorators`, `@Inject` explícito em todo construtor e o script `start` que chama `bootstrap(process.env)`.
  - `skills` de E9-T03: o cartão toca só backend, sem skills de tela; manter `[editar-arquivo, coding-guidelines, modular-design-principles]` (nenhuma é de `apps/web`).
- plano.md: sem alteração nesta rodada.

## Pendências de PM (rodada 1; todas resolvidas na rodada 2, ver abaixo)
- E9-F02: P1 (Joel): código de erro para 500. A RFC-004 §6 não tem `code` para erro interno e o `problemSchema` só aceita `code` que mapeie o `status`. Sugestão padrão: `INTERNAL_ERROR`, status 500, `detail` "Erro interno do servidor.", acrescentado à RFC-004 §6, a `errorCodeSchema` e a `errorStatus` (como o D8 fez com `DUPLICATE_CPF`). Opções: (a) `INTERNAL_ERROR` (sugerida); (b) outro nome, ex. `INTERNAL_SERVER_ERROR`.
- E9-F02: P2 (Joel, travas §7): aprovar `reflect-metadata`, `rxjs`, `supertest` e `@types/supertest`. Sugestão padrão: aprovar os quatro e listar em `docs/travas.md`.
- Entradas não gravadas em `docs/plano/pendencias-pm.md` (arquivo em commit por outro agente nesta sessão); o orquestrador as transcreve.

## Segunda opinião (pepe, 19/11)
- veredito do pepe: ressalvas (10 itens, `nvidia/nemotron-3.5-lightning:free`, 2 passos).
- incorporados: A6 depende de P1 (itens 1 e 6, já P1); `z.toJSONSchema` com `.refine` incerto (item 3, já R4); `allowedPaths` de T02 e T03 sem os arquivos de schemas (itens 4 e 5, já P3 e Mudanças); `done` do T02 genérico e do T03 sem validação de env (itens 8 e 9, nas Mudanças); JSON malformado sem item no `done` (item 10, nas Mudanças).
- descartados: item 2 (as mensagens exatas estão no plano, a fonte é a regra de env validado em `docs/travas.md`); item 7 (o catálogo da RFC-004 §6 tem os codes que `ProblemException` aceita, e `INTERNAL_ERROR` entra por P1).

## Rodada 2 (19/11)
- Decisões do Joel: P1 aprovado (`INTERNAL_ERROR`, 500); P2 aprovado (`reflect-metadata`, `rxjs`, `supertest`, `@types/supertest`; os dois últimos em dev). Gravadas como resolvidas em `docs/plano/pendencias-pm.md`.
- Aplicado: RFC-004 §6 (linha 500 `INTERNAL_ERROR`); `docs/travas.md` §7 (runtime e dev); P3 nos cartões E9-T02 e E9-T03 de `docs/plano/E9.yaml` (allowedPaths, checks, protectedTests, readFirst e done enxutos com A/C do plano); `plano.md` Pendências marcadas como resolvidas. `errorCodeSchema` e `errorStatus` ficam para o E9-T03 (`packages/schemas/src/api/problem.ts` entrou no allowedPaths).
- Esboço: dependências instaladas antes da etapa tests (R2) e esboço copiado com o marcador `stub E9-F02` e exclusão de cobertura.
- Segunda opinião da rodada 2 (pepe, `nvidia/nemotron-3.5-lightning:free`, 5 passos): aprovado. Ressalva descartada: o pepe leu que `errorCodeSchema` e `errorStatus` "já incluem" `INTERNAL_ERROR`; não incluem, a mudança é do E9-T03 (cartão). A ressalva de `revisao.md` desatualizado foi superada por esta rodada.
- Esboço ampliado: além do `esboco-api.txt`, `ProblemDetailsFilter`, `AppModule` e `OpenApiController` ganharam stub (o plano os cita no Contrato). `experimentalDecorators` ligado em `apps/api/tsconfig.json` já no esboço, porque os testes da Bia usam decoradores nas rotas fixture e o cartão T02 não pode editar o tsconfig.
- Veredito da rodada 2: ajustado. Pronto para a etapa tests.
