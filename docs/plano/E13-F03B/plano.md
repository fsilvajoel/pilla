# E13-F03B: web, tela de alertas com os blocos de parcelas

Plano da feature. Cartão: E13-T11 (tela, claude): leva `shadcn` e `tailwind-css`. Referências: PRD-001 RF-50, ADR-0005, ADR-0013, `docs/plano/E13-F02A/plano.md` (contrato), `docs/plano/E13.md` D2, D8 e D10, `docs/plano/E10-F08/plano.md`. Sem teste automatizado nesta fase; revisão visual e cobertura pelo E2E (F04A).

## Dependência
Depende da F02A (consulta), da E10-T15 e da E9-T13. Roda em paralelo à E11.

## Escopo

Entra:
- `apps/web/lib/api/dashboard.ts`: `getDashboardToday`, parseado com `dashboardTodayResponse`.
- `/alertas` com três blocos nesta ordem, cada um com contagem e total em R$ no título:
  - "Vencendo hoje";
  - "Vencendo na semana";
  - "Atrasadas": cada linha mostra também "N dias de atraso", encargos e total a pagar.
- Cada linha: pessoa, número do contrato (link para `/emprestimos/{loanId}`), parcela, vencimento, valor em aberto.
- Estado vazio por bloco ("Nenhuma parcela vencendo hoje." e equivalentes) e `loading.tsx`.
- Cabeçalho com a data de referência (hoje em Brasília).
- Item "Alertas" no menu lateral.
- O campo `pendingReview` da resposta é ignorado aqui: o bloco só aparece na F03C, para o zero devolvido pela F02A não parecer "nada pendente" (D2).

Fora: bloco de pendentes (F03C); filtros; paginação; ações sobre parcela.

## Critérios de aceite
- A tela abre com dados da API e mostra os três blocos.
- Contagem e total do título batem com as linhas.
- Linhas atrasadas mostram dias, encargos e total.
- Estados vazio, carregando e erro aparecem.
- Links vão ao detalhe do contrato.
- Não há erro no console. Typecheck e lint passam.
