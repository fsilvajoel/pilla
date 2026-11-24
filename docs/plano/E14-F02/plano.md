# E14-F02: login, logout e `me` com sessão por cookie

Plano da feature. Cartões: E14-T03 (testes) e E14-T04 (implementação). Referências: PRD-001 RN-A05, ADR-0007, ADR-0011, RFC-003 §4.5, RFC-004 §3 e §6, RFC-005 (`access.admin_users`, `access.sessions`), `docs/plano/E14.md` D1, D3 a D6.

## Escopo

Entra:
- `POST /api/v1/auth/admin/login` com `adminLoginRequest` (já existe): 200 `adminMeResponse` e `Set-Cookie: pilla_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/`. Grava a sessão (`id` = SHA-256 do token, papel ADMIN, `admin_user_id`, `ip`, `expires_at` = agora + 12 h) e `last_login_at`.
- `POST /api/v1/auth/admin/logout`: 204, apaga a sessão, devolve o cookie expirado; sem cookie também 204.
- `GET /api/v1/auth/me`: 200 `adminMeResponse`; 401 sem sessão válida.
- `access/application/sessions.ts`: criar, resolver (com inatividade de 2 h, limite absoluto, admin ativo, `last_seen_at` no máximo uma vez por minuto) e encerrar sessão; apagar sessão vencida ao encontrá-la.
- Leitura do cabeçalho `Cookie` sem dependência nova (`core/http/session-cookie.ts`).
- `@nestjs/throttler` só no login: 5 por minuto por IP; excesso vira 429 `TOO_MANY_REQUESTS` problem+json.

Fora: guard global e `@Public` (F03; nesta feature `logout` e `me` resolvem a sessão por conta própria); login de cliente (RF-60, D10); auditoria de login (D5).

## Domínio das entradas

| Campo | Formato | Válido | Rejeitado | Erro | Fonte |
|---|---|---|---|---|---|
| `username` | texto, aparado | 1 a 100 | vazio, só espaços, 101+ | 400 `VALIDATION_FAILED` | `adminLoginRequest` |
| `password` | texto | 1 a 200 | vazio, 201+ | 400 | idem |
| chaves | só as duas | | qualquer outra | 400 | `strictObject` |
| cookie `pilla_session` | 43 base64url | sessão existente, viva, admin ativo | ausente, desconhecido, vencido, admin inativo | 401 `UNAUTHENTICATED` | D3, D4 |
| tentativas | por IP | até 5 por minuto | 6ª no minuto | 429 `TOO_MANY_REQUESTS` | D6, pendência E14-T03 |

Mensagem do 401 no login: sempre "Usuário ou senha inválidos." (não revela se o usuário existe).

## Critérios de aceite
- A1: login certo dá 200 com `adminMeResponse` e um `Set-Cookie` com os quatro atributos.
- A2: a linha de `sessions` tem `id` = SHA-256 do valor do cookie; o valor em claro não é gravado.
- A3: `last_login_at` é preenchido; `expires_at` = criação + 12 h; `ip` é o da requisição.
- A4: usuário inexistente, senha errada e usuário inativo dão o mesmo 401, sem cookie e sem linha nova.
- A5: corpo inválido dá 400; nenhuma resposta contém a senha.
- A6: 6ª tentativa no minuto do mesmo IP dá 429, mesmo com a senha certa; outro IP passa.
- A7: `me` com cookie válido dá 200.
- A8: `me` sem cookie, com token desconhecido, inativo há mais de 2 h, após `expires_at` ou de admin desativado dá 401; a sessão vencida é apagada.
- A9: `last_seen_at` só avança quando tem mais de 1 minuto.
- A10: logout dá 204, apaga a linha e expira o cookie; o cookie antigo dá 401 no `me`; sem cookie também 204.

## Casos de teste
- `apps/api/src/access/application/sessions.test.ts` (PGlite, relógio falso): C12 a C16 do lado do serviço (inatividade, absoluto, admin inativo, apagar vencida, `last_seen_at`).
- `apps/api/src/access/http/auth.http.test.ts` (supertest): C1 a C4 (login certo, cookie, linha, `last_login_at`), C5 a C9 (falhas e 400), C10 e C11 (429 e outro IP), C17 e C18 (logout).

## Riscos
- `Secure` em teste com supertest: o cookie é só conferido no cabeçalho, não reenviado pelo cliente HTTP; os testes montam o cabeçalho `Cookie` à mão.
- Throttler em memória zera ao reiniciar a API e não vale entre réplicas (aceito: uma instância, ADR-0001).
- Tempo constante: usuário inexistente chama `verifyAgainstDummy`.

## Dependências
F01 (hash, token, schema).
