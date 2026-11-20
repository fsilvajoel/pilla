# Banco local de desenvolvimento

PostgreSQL 17 em Docker, só para desenvolvimento. Nunca aponte estes comandos para produção. Dados do seed são fictícios.

## Variáveis (`.env`, modelo em `.env.example`)

| Variável | Uso |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | credenciais e nome do banco criados pelo contêiner (obrigatórias) |
| `POSTGRES_PORT` | porta publicada em `127.0.0.1`; inteiro de **1024 a 65535** (o compose recusa não numérico e acima de 65535; a faixa mínima é regra do projeto) |
| `DATABASE_URL` | `postgres://usuario:senha@host:porta/banco`, lida pela API e pelos scripts; o seed só aceita host `127.0.0.1` ou `localhost` |

Crie o `.env` a partir do `.env.example` (`cp .env.example .env && chmod 600 .env`) e mantenha `DATABASE_URL` coerente com as `POSTGRES_*`.

## Subir

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d --wait
```

O volume nomeado `pilla-pgdata` guarda os dados: `down` seguido de `up` (sem `-v`) não perde nada.

## Migrar

```bash
pnpm --filter @pilla/api db:migrate
```

Aplica as pastas de `apps/api/migrations/` na ordem de `migrationFolders`. Pode rodar de novo sem efeito.

## Semear

```bash
pnpm --filter @pilla/api db:seed
```

Insere 6 pessoas fictícias (8 endereços, 8 chaves PIX, uma indicação) numa transação. Idempotente.

## Zerar

```bash
docker compose --env-file .env -f infra/docker-compose.yml down -v
docker compose --env-file .env -f infra/docker-compose.yml up -d --wait
pnpm --filter @pilla/api db:migrate
pnpm --filter @pilla/api db:seed
```

`down -v` apaga o volume `pilla-pgdata` e todos os dados.
