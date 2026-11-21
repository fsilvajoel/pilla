# E13-F04B: E2E dos pagamentos pendentes de conferência

Plano da feature. Cartão: E13-T13 (claude). Referências: PRD-001 RF-20 e RF-50, `docs/plano/E11.md`, `docs/plano/E13-F03C/plano.md`. Arquivo `apps/web/e2e/alerts-pending.e2e.ts`.

## Dependência
F03C, F04A e a E11-T04 (`POST /payments`). Para confirmar o pagamento no passo final, usa a rota de confirmação da E11 (E11-F03) pela API; se ela ainda não existir quando esta feature rodar, o passo "confirmar e sumir do bloco" fica fora e volta com a E11-F03.

## Escopo

Entra:
- Registrar um pagamento em contrato ativo via `POST /payments` (contexto de request do Playwright) e ver o item em "Pagamentos pendentes de conferência", com valor e link do contrato.
- Confirmar o pagamento pela API da E11 e ver o item sair do bloco, enquanto os blocos de parcelas refletem o novo valor em aberto.

Fora: formulário de pagamento e fila de conferência da E11 (testadas no E2E da E11-F06).

## Critérios de aceite
- `pnpm --filter @pilla/web e2e` passa com o spec novo.
- Sem erro no console.
