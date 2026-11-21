# E13-F02B: painel de alertas, pagamentos pendentes de conferência

Plano da feature. Cartões: E13-T09 (testes, claude) e E13-T10 (implementação, baidu). Referências: PRD-001 RF-50 e RF-20, ADR-0002, ADR-0005, RFC-004 §3, RFC-005 §5, `docs/plano/E13-F02A/plano.md` (contrato), `docs/plano/E10.md` D5, `docs/plano/E11.md`.

## Dependência

Depende da F02A e do `POST /payments` da E11 (E11-F02, cartão E11-T04), que grava `PENDING_REVIEW`. A E11 está sendo refinada em paralelo; esta feature só lê `docs/plano/E11*` e não os edita. Folga: a tabela `payments.payments` e o índice parcial `payments_pending_review_idx` já existem (E5), então os testes podem semear linhas `PENDING_REVIEW` direto no banco; só o E2E (F04B) precisa da rota real.

## Escopo

Entra:
- Porta pública de leitura `pendingReviewPayments()` em `apps/api/src/payments/public`: pagamentos com status `PENDING_REVIEW`, mais antigo primeiro, com `id`, `loanId`, `personId`, `amountCents`, `paidAt`, `method`, `createdAt`.
- O painel troca o `pendingReview` fixo da F02A pela leitura real: o `lending` junta `loanNumber` e `loanStatus` (tabela própria) e `personName` (`people/public`).
- Inclui pagamento de contrato DRAFT, com `loanStatus` DRAFT (decisão da E11, 20/11: DRAFT aceita pendente e só aloca na confirmação).

Fora: confirmar ou estornar (E11-F03, F04); o contrato do schema (fechado na F02A: esta feature não altera `packages/schemas`); paginação (D7).

## Contrato
Sem schema novo. `pendingReviewItem` e `block` como na F02A. `count` = número de pagamentos pendentes; `totalCents` = soma de `amountCents`.

## Regras
| Regra | Fonte |
|---|---|
| Só `PENDING_REVIEW`; `CONFIRMED` e `REVERSED` ficam fora | RF-50, RFC-005 §5 |
| Mais antigo primeiro (`createdAt` asc, desempate por `id`) | decisão desta feature: quem espera há mais tempo aparece primeiro |
| `payments` não importa `lending`; `lending` lê `payments` só por `payments/public` | ADR-0002 |

## Domínio da entrada
Sem entrada externa.

## Critérios de aceite
- A1: a porta devolve só `PENDING_REVIEW`.
- A2: ordem por `createdAt` crescente.
- A3: `count` e `totalCents` do bloco batem com as linhas pendentes.
- A4: cada item traz os campos do `pendingReviewItem`.
- A5: pagamento de contrato DRAFT aparece com `loanStatus` DRAFT.
- A6: confirmar o pagamento (rota da E11) o tira do bloco.
- A7: pagamento estornado ou confirmado nunca aparece.
- A8: os três blocos de parcelas respondem exatamente como na F02A (regressão); o teste do `pendingReview` fixo é substituído.

## Casos de teste
- C1 a C4: porta (só pendentes, ordem, vazio, outros status).
- C5 a C12: bloco (totais, campos, DRAFT, confirmar remove, estornado, pessoa e contrato).
- C13: regressão dos blocos de parcelas.

## Arquivos de produção
- `apps/api/src/payments/public/` e `apps/api/src/payments/infra/pending-review-reader.ts` (novo).
- `apps/api/src/lending/application/` e `infra/loan-queries.ts` (busca de contratos por id, qualquer status).

## Classificação TDD
Todos TDD. Sem dispensa.
