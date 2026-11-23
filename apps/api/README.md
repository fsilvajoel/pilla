# @pilla/api

Comandos de banco (rodar com `DATABASE_URL` local no `.env` da raiz):

- `pnpm --filter @pilla/api db:seed-admin -- --username <nome>`: cria ou redefine o primeiro admin. A senha é digitada no terminal (sem eco, duas vezes) ou vem de uma linha da entrada padrão; nunca em argumento ou variável de ambiente.
