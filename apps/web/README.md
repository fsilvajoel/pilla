# @pilla/web

Frontend do pilla: Next.js (App Router) + TypeScript estrito + Tailwind CSS v4 + shadcn/ui ([RFC-003 §4.4](../../docs/rfc/RFC-003-stack-tecnologica.md), estado conforme a [ADR-0013](../../docs/adr/0013-estado-no-frontend.md)).

## Onde fica cada coisa
- `app/`: rotas (App Router). Telas em `app/<rota>/page.tsx`; route groups `(admin)` e `(portal)` com layouts próprios. Tema e tokens de cor em `app/globals.css`.
- `components/ui/`: componentes do shadcn/ui (código copiado para o repo; `components.json` configura o gerador).
- `components/`: componentes do pilla montados com os de `ui/`.
- `lib/`: utilitários (`cn` em `lib/utils.ts`).
- Testes ao lado do arquivo: `page.tsx` → `page.test.tsx` (modelo: `app/page.test.tsx`; vitest + Testing Library, jsdom).

## Regras
- Só importa de `packages/*` (`@pilla/schemas`, `@pilla/finance`); nunca de `apps/api` nem de banco (dependency-cruiser).
- `export default` só nos arquivos especiais do Next (`page`, `layout`, `loading`, `error`, `not-found`…); no resto, export nomeado.

## Como rodar
```bash
pnpm --filter @pilla/web dev        # http://<ip-da-vm>:3000 (escuta em 0.0.0.0)
pnpm --filter @pilla/web test       # vitest com cobertura (mínimo 85%)
pnpm --filter @pilla/web build      # build de produção; depois `start`
pnpm --filter @pilla/web typecheck  # gera os tipos de rota (next typegen) e roda o tsc
```
