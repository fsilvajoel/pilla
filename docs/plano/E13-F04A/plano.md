# E13-F04A: E2E de parâmetros e alertas de parcelas

Plano da feature. Cartão: E13-T06 (claude). Referências: PRD-001 RF-40, RF-41, RF-50 e CA-10, `docs/plano/E13.md`, `docs/plano/E10-F10/plano.md`. Playwright contra API e Postgres reais (compose up, migrate, seed), no arquivo `apps/web/e2e/settings-alerts.e2e.ts`.

## Dependência
F03A, F03B e a infra de E2E da E10-T18. Não depende da E11.

## Escopo

Entra:
- Parâmetros: abrir `/configuracoes`, ver os termos do seed, alterar a multa, salvar, recarregar e ver o novo valor; restaurar no fim.
- CA-10: contrato criado antes da mudança mantém a multa antiga no detalhe; contrato criado depois mostra a nova.
- Alertas: contratos ativados com parcela vencendo hoje, na semana e atrasada aparecem cada um no seu bloco; a atrasada mostra dias e encargos; as linhas levam ao contrato.
- Datas calculadas em relação a hoje em Brasília dentro do próprio teste; nunca fixas.

Fora: bloco de pendentes (F04B); teste de tela (ADR-0017 emenda: só E2E cobre tela).

## Critérios de aceite
- `pnpm --filter @pilla/web e2e` passa com o spec novo.
- O spec deixa os parâmetros como os encontrou.
- Sem erro no console.
