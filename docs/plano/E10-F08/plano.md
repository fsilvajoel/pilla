# E10-F08: web, cliente da API e telas de novo, lista e detalhe

Plano da feature. Cartões:
- E10-T15: cliente server-side, claude.
- E10-T16: telas, claude. É cartão de tela, então leva `shadcn` e `tailwind-css`.

Referências: ADR-0013, PRD-001 RF-11, RF-12, RF-17, RF-18 e RF-41, `docs/plano/decisoes-2026-11-17.md` e `-19.md`, `docs/plano/E10.md` D11 e D12. Sem teste automatizado nesta fase (decisão de 19/11); a revisão é visual.

## Escopo

Entra:
- `apps/web/lib/api/lending.ts` e `treasury.ts`, sobre o wrapper da E9-T15. As respostas passam pelos schemas de `@pilla/schemas`; problem+json vira `ApiProblem`.
- `/emprestimos/novo`:
  - taxas pré-preenchidas por `GET /settings/default-terms`;
  - Server Action que chama `POST /loans`;
  - mensagem "Contrato criado em rascunho.".
- `/emprestimos`: lista da API com filtros e o estado vazio "Nenhum contrato.".
- `/emprestimos/[id]`: o cronograma e, em DRAFT, as ações:
  - "Ativar": data (padrão hoje em Brasília) e seleção de conta vinda de `GET /accounts`;
  - "Cancelar": só confirmação.
- O código de empréstimos deixa de usar `lib/mock-data.ts`.

Fora:
- Renovar, renegociar, baixa e quitação (F09).
- Pagamento (E11).
- A tela de simulação. A rota `simular` fica como está (D2).

## Critérios de aceite
- As três rotas abrem com dados da API.
- Os estados de carregando, vazio e erro aparecem.
- Ativar e Cancelar só aparecem em DRAFT.
- Não há erro no console.
- Typecheck e lint passam.
