# E10-F10: E2E do ciclo de contratos

Plano da feature. Cartão: E10-T18 (claude). Referências: PRD-001 RF-11 a RF-13 e RF-16 a RF-18, `docs/plano/E10.md`. O arquivo é `apps/web/e2e/loans.e2e.ts`, porque o Playwright usa `testMatch **/*.e2e.ts`.

## Escopo

Entra, contra a API e o Postgres reais (compose, migrate e seed):
- criar um DRAFT para uma pessoa do seed, editar e ativar com a conta base, e ver 6 parcelas no detalhe;
- cancelar outro DRAFT;
- baixar um terceiro contrato com motivo;
- tentar renovar com juros em aberto e ver a mensagem de recusa em pt-BR.

Fora:
- Renovação bem-sucedida e quitação, que dependem de pagamento (E11 e E13).
- Teste de componente (não há teste de web nesta fase, só o E2E da épica).

## Critérios de aceite
- `pnpm --filter @pilla/web e2e` passa.
- Não há erro no console.
