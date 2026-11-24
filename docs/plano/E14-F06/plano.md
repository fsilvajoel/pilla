# E14-F06: tela de login e proteção das rotas no web

Plano da feature. Cartão: E14-T11 (implementação; sem teste de tela nesta fase, E13 D10). Referências: PRD-001 RN-A01 e RN-A05, ADR-0011, ADR-0013, RFC-004 §3, `docs/plano/E14.md` D4 e D12.

## Escopo

Entra:
- `app/login/page.tsx` (fora do grupo `(admin)`): campos "Usuário" e "Senha" com rótulo, botão "Entrar", erro genérico. Server action em `app/login/actions.ts`: chama `POST /auth/admin/login` repassando `X-Forwarded-For`, copia o valor de `pilla_session` para um cookie do Next (HttpOnly, Secure, SameSite=Lax, Path=/) e redireciona para `next` se for caminho interno, senão para `/`.
- `app/(admin)/layout.tsx`: chama `GET /auth/me`; sem sessão redireciona para `/login?next=<caminho>`; passa o nome ao `AdminShell`.
- `lib/api/client.ts`: repassa o cookie em toda chamada; 401 redireciona para `/login`.
- `AdminShell`: nome do admin e botão "Sair" (server action: `POST /auth/admin/logout`, apaga o cookie do Next, vai para `/login`).

Dentro: `apps/web/proxy.ts` (D12 reaberta: redireciona sem cookie; a API segue valendo). Fora: "lembrar de mim"; troca de senha pela tela; portal do cliente.

## Domínio das entradas

| Situação | Tela | Fonte |
|---|---|---|
| campos vazios | validação do formulário, sem chamar a API | `adminLoginRequest` |
| 401 da API | "Usuário ou senha inválidos." | D5 |
| 429 da API | "Muitas tentativas. Aguarde um minuto." | D6 |
| `next` externo (`//x`, `http:`) | ignorado, vai para `/` | D12 (open redirect) |

## Critérios de aceite
- A1: `/login` abre sem sessão; formulário acessível por teclado, com rótulos.
- A2: login certo grava o cookie do Next e vai para `next` interno ou `/`.
- A3: 401 e 429 mostram as mensagens acima; a senha não volta na página.
- A4: rota do grupo `(admin)` sem sessão vai para `/login?next=<caminho>`.
- A5: "Sair" encerra a sessão na API, apaga o cookie e vai para `/login`.

## Casos de teste
Sem teste unitário de tela (E13 D10). O comportamento é provado pelo e2e da F07 (C1 a C3).

## Riscos
- Cookie `Secure` em `next dev` sem HTTPS: navegadores aceitam em `localhost`; confirmar no e2e.
- Mocks dos e2e existentes: o layout passa a chamar `/auth/me`; F07 cobre.

## Dependências
F02 (rotas) e F03 (guard; sem ele as rotas seguem abertas e a proteção não é provada).
