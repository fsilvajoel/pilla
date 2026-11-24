# E15-F02: sessão do portal (entrada por CPF, limite, log, cookie, guarda)

Plano da feature. Cartões: E15-T03 (testes, **Opus**) e E15-T04 (implementação, **Opus**). Referências: PRD-001 RN-A04,
RN-A02, CA-09b, ADR-0007, ADR-0011, RFC-004 §4 e §6, RFC-005 §7, legal L-08, `docs/plano/E15.md` D1 a D7 e D10,
`docs/plano/pendencias-pm.md` (E15-T03).

## Escopo

Entra:
- `POST /api/v1/portal/session` `{cpf}` e `DELETE /api/v1/portal/session` (D2, D3, D4, D6).
- `apps/api/src/access/application/portal-session-service.ts`: fluxo da entrada (valida, trava por IP, conta janela,
  acha pessoa por CPF, lê `portal_access`, grava `access_logs`, cria `sessions`). `portal-rate-limit.ts`: contagem na
  janela de 60 s com `pg_advisory_xact_lock` por IP. `cpf-hash.ts`: HMAC-SHA256 hex com `PILLA_ACCESS_HASH_KEY`.
- `apps/api/src/access/http/portal-session.controller.ts`, `session-cookie.ts` (monta e lê o cookie `pilla_portal`).
- `apps/api/src/access/public/portal-session.guard.ts` e decorador `@PortalPerson()` (D7), exportados para o
  `lending` (F04) e para quem vier depois.
- `apps/api/src/people/public/person-by-cpf.ts`: `findPersonIdByCpf(db, cpf): Promise<string | null>` (só o id).
- `PILLA_ACCESS_HASH_KEY` em `apps/api/src/core/http/env.ts` (obrigatória, mínimo 32 caracteres, mensagem sem o valor),
  `.env.example` (placeholder), `ApiEnv` e o `app.module.ts`.

Fora: habilitar acesso (F03); leituras (F04); apagar linhas vencidas por rotina; 2º fator; tela.

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `cpf` | 11 dígitos válidos | 11 | 11 | pontuação, curto, dígito errado, repetido, campo extra | 400 `VALIDATION_FAILED` | `cpfSchema` |
| tentativas por IP | contagem na janela de 60 s (sem `RATE_LIMITED`) | 0 | 30 aceitas | 31ª em diante | 429 `TOO_MANY_REQUESTS` + `Retry-After` | D4, CA-09b |
| cookie `pilla_portal` | 43 caracteres base64url | - | - | ausente, malformado, hash sem sessão, vencido | 401 `UNAUTHENTICATED` | D6, D7 |
| inatividade | 30 min | - | 30 min | `last_seen_at` mais velho | 401 | D6 |
| teto da sessão | 2 h | - | 2 h | `expires_at` passado | 401 | D6 |
| `PILLA_ACCESS_HASH_KEY` | texto | 32 | - | ausente, curta | app não sobe | D5 |

## Critérios de aceite

- A1: CPF de pessoa com acesso habilitado: 204, `Set-Cookie` `pilla_portal` com `HttpOnly`, `Secure`, `SameSite=Lax`,
  `Path=/api/v1/portal`; em `sessions`: `id` = SHA-256 do token (o token não aparece no banco), `role` CLIENT,
  `person_id`, `ip`, `expires_at` = agora + 2 h; em `access_logs`: uma linha `OK`.
- A2: CPF inexistente, pessoa sem linha em `portal_access` e pessoa desabilitada devolvem **status, corpo e cabeçalhos
  iguais** (401 `UNAUTHENTICATED`, "Não foi possível entrar com este CPF."), sem `Set-Cookie`; o log separa `NOT_FOUND`
  (os dois primeiros) e `DISABLED`.
- A3: `access_logs.cpf_hash` é o HMAC-SHA256 do CPF; o CPF em texto não está em nenhuma tabela, resposta nem log de
  aplicação; trocar a chave muda o hash.
- A4: CA-09b: 30 CPFs diferentes em 1 minuto do mesmo IP passam (cada um com seu resultado); o 31º recebe 429 com
  `Retry-After`, grava `RATE_LIMITED` e não consulta pessoa; outro IP não é afetado; depois que a janela esvazia
  (relógio injetado) o IP volta a entrar; linhas `RATE_LIMITED` não contam no limite.
- A5: 40 entradas paralelas do mesmo IP deixam no máximo 30 passarem (trava por IP).
- A6: CPF malformado: 400, conta na janela, log `NOT_FOUND`, sem consulta de pessoa.
- A7: guarda: sem cookie, cookie lixo, cookie de sessão apagada, sessão vencida por inatividade e por teto: 401; sessão
  válida entrega o `personId` e renova `last_seen_at` (mas nunca passa de `expires_at`).
- A8: guarda reconfere o acesso: se `portal_access.enabled` virou false depois do login, a próxima chamada é 401.
- A9: sessão de ADMIN (`role = ADMIN`, cookie de outro nome) não vale no guarda do portal; cookie do portal não vale
  como ADMIN (teste do `role`).
- A10: `DELETE /portal/session` apaga a linha de `sessions` e manda `Set-Cookie` expirado; sem cookie também dá 204.
- A11: nova entrada da mesma pessoa apaga as sessões vencidas dela; as válidas ficam.
- A12: o app não sobe sem `PILLA_ACCESS_HASH_KEY` ou com chave curta; a mensagem de erro não contém o valor.
- A13: nenhuma resposta do portal tem `Set-Cookie` além do da A1 e do A10; `Cache-Control: no-store` em toda resposta
  do portal.

## Casos de teste

- `apps/api/src/access/application/portal-rate-limit.test.ts` (PGlite, relógio injetado): C1..C6 janela, borda 30/31,
  outro IP, esvaziar, `RATE_LIMITED` fora da conta, concorrência.
- `apps/api/src/access/http/portal-session.http.test.ts`: C7..C14 entrada feliz, três respostas iguais, hash, CPF
  malformado, cookie, saída, `Cache-Control`.
- `apps/api/src/access/http/portal-guard.http.test.ts` (rota de teste protegida): C15..C21 guarda (A7..A9, A11).
- `apps/api/src/core/http/env.test.ts`: C22..C23 chave obrigatória e curta.

## Riscos

- IP errado atrás de proxy deixa todos os clientes no mesmo balde (ou o limite inútil). Fora da entrega; pendência de
  infra (E15-T03).
- Diferença de tempo entre "não existe" e "desabilitado": o fluxo faz sempre a mesma sequência de consultas e grava a
  linha de log antes de decidir; o teste confere a sequência, não o relógio.
- Chave do hash vaza ou muda: o log antigo deixa de casar. Aceito (o log não é consultado por cliente).

## Dependências

F01 (`createPortalSessionRequest`). E5 (`persons.cpf`). Destrava F04, F05A, F07A.
