# ADR-0010 — TypeScript ponta a ponta (NestJS, Next.js, PostgreSQL) em monorepo

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | [RFC-003](../rfc/RFC-003-stack-tecnologica.md) |

## Contexto
PostgreSQL, Next.js, Tailwind e TypeScript já estão definidos. Falta o backend (Node × Python). O objetivo do projeto é reúso máximo e domínios claros.

## Decisão
- Backend em **Node.js + TypeScript (strict)** com **NestJS**; acesso a dados com **Drizzle ORM**; validação com **Zod**.
- **Monorepo** pnpm + Turborepo: `apps/api`, `apps/worker`, `apps/web`, `packages/finance`, `packages/schemas`.
- `packages/finance` (motor da RFC-002) e `packages/schemas` (esquemas de API e eventos) são a **única implementação** e são usados por API, worker e web.
- PostgreSQL com um schema por módulo; fronteiras checadas por dependency-cruiser no CI.
- Python fica reservado para módulos futuros orientados a dados (ex.: Score), integrados por eventos (ADR-0009).

## Consequências
- Uma linguagem; tipos compartilhados entre front e back.
- Dinheiro depende da disciplina da ADR-0004 (inteiros/`bigint`), sem `Decimal` nativo.
- API e worker escalam separadamente.

## Alternativas consideradas
Ver RFC-003 §3 e §5 (Python, Fastify puro, Prisma, Next.js como backend).

## Emenda 2026-11-15: tipagem forte em todo lugar possível
Decisão do Joel: a tipagem forte vale em todo lugar possível, pela qualidade do produto.
- Código que roda em Node (`apps/api`, futuro `apps/worker`) usa `@types/node` na versão do Node do projeto, assim APIs do runtime como `structuredClone` são checadas pelo compilador, em vez de contornadas.
- Pacotes compartilhados com o navegador (`packages/finance`, `packages/schemas`) ficam sem tipos de runtime: só a lib ES. Assim o compilador barra `Buffer`, `process` etc. em código que também vai para o `apps/web`.
- `any`, cast para `any` e `@ts-ignore` continuam proibidos (lint e travas do harness); `unknown` + estreitamento é o caminho.
