# E14-F05: seed do primeiro admin

Plano da feature. Cartões: E14-T09 (testes) e E14-T10 (implementação). Referências: PRD-001 RN-A05, ADR-0011, `docs/plano/E14.md` D9, `apps/api/scripts/seed.mts`.

## Escopo

Entra:
- `access/application/seed-admin.ts`: `seedAdmin(db, {username, password}) → "created" | "updated"`. Cria admin ativo (id uuid v7, hash argon2id) ou, se o nome já existe, troca o hash, reativa, sobe `version` e mantém o id.
- `apps/api/scripts/seed-admin.mts` e o script `db:seed-admin` no `package.json` da API: `pnpm --filter @pilla/api db:seed-admin -- --username <nome>`. Senha lida do terminal sem eco, duas vezes; fora de TTY, uma linha do stdin. Recusa `DATABASE_URL` que não seja localhost (como o `seed.mts`). Imprime só "created" ou "updated" e o nome.
- Duas linhas no `apps/api/README.md`.

Fora: tela de cadastro de admin, troca de senha pela tela, recuperação por e-mail (pendência E14-T09); variável de ambiente nova (nenhuma senha em env ou arquivo).

## Domínio das entradas

| Campo | Válido | Rejeitado | Erro | Fonte |
|---|---|---|---|---|
| `username` | 1 a 100 após aparar | vazio, 101+ | erro sem escrita | `admin_users.username` |
| `password` | 12 a 200 caracteres, sem regra de composição | 11 ou menos, 201+ | erro sem escrita | D9, pendência E14-T09 |
| confirmação (TTY) | igual à primeira | diferente | script sai com código 1 | D9 |
| `DATABASE_URL` | host localhost ou 127.0.0.1 | outro host | script sai com código 1 | `seed.mts` |

## Critérios de aceite
- A1: tabela vazia → um admin ativo, hash que confere, retorno "created".
- A2: nome existente (mesmo inativo) → hash trocado, ativo, `version` + 1, id mantido, retorno "updated"; outros admins intactos.
- A3: senha fora de 12..200 ou nome fora de 1..100 → erro e nada gravado; nome aparado.
- A4: nenhuma mensagem de erro contém a senha.

## Casos de teste
- `apps/api/src/access/application/seed-admin.test.ts` (PGlite): C1 e C2 (criar), C3 e C4 (reset e outros intactos), C5 a C8 (limites de senha e nome, aparar), C9 (sem vazamento).
- O script em si é coberto pelo e2e (F07, `globalSetup`).

## Riscos
- Senha em histórico do shell: o script não aceita senha por argumento.
- `check-env-example`: o cartão roda `node scripts/check-env-example.mjs` para provar que não há variável nova.

## Dependências
F01 (`hashPassword`).
