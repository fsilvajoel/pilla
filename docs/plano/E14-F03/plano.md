# E14-F03: guard global ADMIN, rotas públicas e ator da requisição

Plano da feature. Cartões: E14-T05 (testes) e E14-T06 (implementação). Referências: PRD-001 RN-A01 e RN-A05, ADR-0007, ADR-0011, RFC-004 §6, `docs/plano/E14.md` D1, D7 e D8.

## Escopo

Entra:
- `core/public/actor.ts`: tipo `RequestActor = {type: "ADMIN"; adminUserId: string; ip: string | null}`.
- `core/http/public.ts`: decorator `@Public()`; `core/http/actor.ts`: `@CurrentActor()`; `core/http/client-ip.ts`: IP do cliente (X-Forwarded-For só se a conexão vem do loopback).
- `access/http/admin-session.guard.ts`: `AdminSessionGuard` como `APP_GUARD` no `AppModule`. Rota sem `@Public`: resolve a sessão (F02); sem sessão 401 `UNAUTHENTICATED`; sessão `CLIENT` 403 `FORBIDDEN`; ADMIN válida põe o ator na requisição.
- `@Public()` em health, OpenAPI e login.
- `createTestApp(controllers, providers, {actor})`: por padrão injeta `TEST_ADMIN_ACTOR` (`core/http/test-actor.ts`) sem guard; `{actor: null}` não injeta. Os `*.http.test.ts` existentes seguem sem mudança.
- `AccessModule` entra no `AppModule`.

Fora: trocar o ator nos serviços (F04); papel por rota ou permissões finas (só existe ADMIN no MVP, RN-A01).

## Domínio das entradas

| Situação | Resultado | Erro | Fonte |
|---|---|---|---|
| rota `@Public`, sem cookie | segue | | D7 |
| rota protegida, sem cookie / token desconhecido / vencido | bloqueia | 401 `UNAUTHENTICATED` | RFC-004 §6 |
| rota protegida, sessão `CLIENT` | bloqueia | 403 `FORBIDDEN` | RN-A01, ADR-0011 |
| rota protegida, sessão `ADMIN` | segue com ator | | D1 |
| conexão do loopback com `X-Forwarded-For` | ip = primeiro endereço do cabeçalho | | D7 |
| conexão de fora com `X-Forwarded-For` | ip = endereço da conexão | | D7 |

## Critérios de aceite
- A1: rota protegida sem cookie dá 401.
- A2: token desconhecido ou sessão vencida dá 401.
- A3: sessão CLIENT dá 403.
- A4: sessão ADMIN passa e `@CurrentActor()` recebe `{type, adminUserId, ip}`.
- A5: health, OpenAPI e login respondem sem cookie; logout e `me` não são públicos.
- A6: regra do IP (loopback com e sem cabeçalho).
- A7: o `AppModule` inteiro com PGlite dá 401 em `GET /api/v1/people` e `GET /api/v1/loans` sem cookie e 200 depois do login.
- A8: `createTestApp` sem opção injeta `TEST_ADMIN_ACTOR`; com `{actor: null}` não há ator.

## Casos de teste
- `apps/api/src/access/http/admin-session.guard.test.ts`: C1 a C6 (sem cookie, desconhecido, vencido, CLIENT, ADMIN, ator recebido), C7 e C8 (públicas e não públicas).
- `apps/api/src/core/http/actor.test.ts`: C9 e C10 (IP), C13 (`createTestApp`).
- `apps/api/src/app.auth.test.ts`: C11 e C12 (app inteiro).

## Riscos
- Guard global quebra rota pública esquecida: C7 cobre health e OpenAPI; a suíte inteira roda no cartão de implementação.
- Módulos de negócio importando `access`: o depcruise do cartão barra; eles usam só `core`.

## Dependências
F02 (resolver sessão).
