# E14-F01: contrato `adminMeResponse`, hash de senha e token de sessão

Plano da feature. Cartões: E14-T01 (testes) e E14-T02 (implementação). Referências: PRD-001 RN-A05, ADR-0011, RFC-003 §4.5, RFC-005 (schema `access`), `docs/plano/E14.md` D2, D3 e D5.

## Escopo

Entra:
- `packages/schemas/src/api/access/admin-me.ts`: `adminMeResponse = z.strictObject({id: uuid, username: 1..100, role: z.literal("ADMIN")})`, exportado no índice.
- `apps/api/src/access/domain/password.ts`: `hashPassword(plain)`, `verifyPassword(hash, plain)` e `verifyAgainstDummy(plain)`, com argon2id (m=19456 KiB, t=2, p=1).
- `apps/api/src/access/domain/session-token.ts`: `newSessionToken()` (32 bytes aleatórios em base64url) e `sessionIdOf(token)` (SHA-256 hex).
- Dependência nova `argon2` só em `apps/api` (liberada em `docs/travas.md`).

Fora: rotas (F02), guard (F03), política de tamanho de senha (F05, no seed).

## Domínio das entradas

| Peça | Entrada | Válido | Rejeitado | Fonte |
|---|---|---|---|---|
| `adminMeResponse.id` | uuid | uuid v7 | texto qualquer | RFC-005 |
| `adminMeResponse.username` | texto | 1 a 100 | vazio, 101+ | `admin_users.username`, `adminLoginRequest` |
| `adminMeResponse.role` | literal | `ADMIN` | `CLIENT`, outro | ADR-0011 |
| `verifyPassword(hash, plain)` | hash argon2 codificado | hash válido | hash malformado → `false`, sem exceção | D2 |

## Critérios de aceite
- A1: `adminMeResponse` aceita o objeto válido.
- A2: `adminMeResponse` recusa chave extra, papel `CLIENT`, id que não é uuid e nome vazio.
- A3: `hashPassword` devolve hash argon2id com os parâmetros de D2 e sal diferente a cada chamada.
- A4: `verifyPassword` é `true` só para a mesma senha.
- A5: `verifyPassword` com hash malformado devolve `false` e não lança.
- A6: `verifyAgainstDummy` devolve sempre `false` e faz uma verificação real (tempo constante).
- A7: `newSessionToken` devolve 43 caracteres base64url; duas chamadas diferem.
- A8: `sessionIdOf` devolve SHA-256 hex de 64 caracteres minúsculos, estável para o mesmo token.

## Casos de teste
- `packages/schemas/src/api/access/admin-me.test.ts`: C1 (válido), C2 (chave extra), C3 (papel CLIENT), C4 (id inválido e nome vazio).
- `apps/api/src/access/domain/password.test.ts`: C5 (prefixo `$argon2id$v=19$m=19456,t=2,p=1$`), C6 (dois hashes da mesma senha diferem), C7 (senha certa), C8 (senha errada), C9 (hash malformado), C10 (dummy).
- `apps/api/src/access/domain/session-token.test.ts`: C11 (tamanho e alfabeto), C12 (dois tokens diferem), C13 (id = SHA-256 conhecido de um token fixo).

## Riscos
- argon2 é nativo: confirmar que o `pnpm install` baixa o binário pronto no Debian 13 e no CI; se não, parar e avisar (não trocar de biblioteca sem ADR).
- Testes de hash são lentos (~50 ms cada): poucos casos.

## Dependências
Nenhuma. Destrava F02 e F05.
