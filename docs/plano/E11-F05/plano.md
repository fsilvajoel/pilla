# E11-F05: web, cliente de pagamentos, formulário com prévia e fila de conferência

Plano da feature. Cartões:
- E11-T11: cliente server-side, claude (inclui `reject`).
- E11-T09: telas, claude. É cartão de tela, então leva `shadcn` e `tailwind-css`.

Referências: ADR-0013, PRD-001 RF-20 a RF-23, RN-R09 a RN-R11, `docs/plano/decisoes-2026-11-19.md` §3, `docs/plano/E11.md` D2, D6, D8 e D13. Sem teste automatizado novo nesta fase (emenda da ADR-0017); a revisão é visual.

## Escopo

Entra:
- `apps/web/lib/api/payments.ts` sobre o wrapper da E9-T15: prévia, registrar (com `Idempotency-Key`), listar, confirmar, rejeitar e estornar (com `If-Match`). Respostas passam pelos schemas de `@pilla/schemas`; problem+json vira `ApiProblem`.
- `/emprestimos/[id]/pagamento` ligada à API (sai o `mock-data`):
  - cabeçalho: contrato e saldo devedor;
  - contrato fechado: aviso do status e link para o sucessor, quando houver;
  - campos: conta de destino (`GET /accounts`, conta base pré-selecionada), data (padrão hoje em Brasília), valor e método. Sem comprovante e sem chave Pix (D2);
  - a prévia (RF-23): tabela por parcela (encargos, juros, principal, situação depois) e saldo depois, atualizada ao mudar valor ou data; em DRAFT mostra que a distribuição é calculada na confirmação;
  - envia e mostra "Pagamento registrado para conferência.".
- `/pagamentos`: fila de conferência.
  - Padrão PENDING_REVIEW; filtros por status e por contrato; paginação por cursor.
  - "Confirmar" e "Rejeitar" (diálogo que exige o motivo) em cada pendente; "Estornar" em cada confirmado, com diálogo que exige o motivo.
  - Estado vazio "Nenhum pagamento.".
- Entrada "Pagamentos" no `admin-nav`; no detalhe do contrato, "Registrar pagamento" (DRAFT, ACTIVE e WRITTEN_OFF) e "Pagamentos do contrato" (`/pagamentos?loanId=`).
- Mensagens em pt-BR para `PAYMENT_EXCEEDS_BALANCE`, `LOAN_CLOSED_FOR_PAYMENTS`, `LOAN_NOT_ACTIVE`, `PAYMENT_NOT_PENDING`, `PAYMENT_NOT_CONFIRMED`, `REVERSAL_BLOCKED_BY_SUCCESSOR` e `VERSION_CONFLICT`.
- Os testes antigos `payment-form.test.tsx` e `payment-draft.test.ts` (E7) só mudam para continuar verdes com o novo corpo (`accountId`).

Fora: comprovante e sua tela (v1.1); portal do cliente; tela de alertas (E13).

## Critérios de aceite
- As duas rotas abrem com dados da API.
- Carregando, vazio e erro aparecem.
- Registrar mostra a prévia antes de enviar; em DRAFT, o aviso de que a distribuição vem na confirmação.
- Confirmar e Estornar atualizam a fila e mostram os erros em pt-BR.
- "Estornar" e "Rejeitar" não deixam enviar sem motivo.
- Contrato fechado bloqueia o formulário.
- O código de pagamento não importa `lib/mock-data.ts`.
- Não há erro no console.
- Typecheck, lint e `pnpm --filter @pilla/web test` passam.

## Dependências
- F04 (API completa, incluindo rejeitar), E10-T15 e E10-T16 (cliente e telas de lending), `GET /accounts` (E10-T04).
