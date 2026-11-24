# E10-F05: lista, detalhe e cotação de quitação

Plano da feature. Cartões: E10-T09 (testes, claude) e E10-T10 (implementação, baidu). Referências: PRD-001 RF-15 e RF-18, RFC-002 §3.5 e §3.7, RFC-004 §3, ADR-0005, `docs/plano/E10.md` D3, D5 e D11, RN-C08, RN-E01 a RN-E03, RN-R08.

## Escopo

Entra:
- `GET /api/v1/loans`:
  - filtros `personId`, `status` e `standing`;
  - paginação por cursor;
  - `personName` vindo de `people/public`;
  - `outstandingCents` e `nextDueDate` calculados.
- `GET /api/v1/loans/{id}`: detalhe com as parcelas. Por parcela:
  - `paidCents`, das alocações confirmadas (`payments/public`);
  - `lateChargesCents` na data de hoje em Brasília;
  - status OPEN, PARTIAL, PAID, OVERDUE ou OVERDUE_PARTIAL.
- `standing` do contrato.
- `GET /api/v1/loans/{id}/payoff-quote?date=`: principal em aberto + juros em aberto + encargos na data, sem desconto. Só para ACTIVE. Entra também o `payoffQuoteResponse` em `payoff-quote.ts`.
- Nada calculado é gravado (ADR-0005).

Fora:
- A quitação em si: é um pagamento normal da E11, e PAID_OFF é decidido no confirm (D3).
- `loan_positions`: o painel da E12 lê esta consulta pública, calculada na hora.

## Critérios de aceite
- A1: os filtros funcionam.
- A2: o cursor pagina sem repetir itens.
- A3: a lista traz `personName`.
- A4: `paidCents` conta só pagamentos confirmados.
- A5: os encargos batem com `@pilla/finance` na data; a mora incide só sobre o saldo em aberto da parcela (decisão de 20/11).
- A6: a parcela fica OVERDUE logo após o vencimento; a carência só isenta encargos de mora (default 0 dias). O standing segue a mesma regra.
- A7: a cotação bate com a soma dos componentes.
- A8: data anterior a `disbursedAt` dá 422.
- A9: contrato fora de ACTIVE dá 409 `LOAN_NOT_EDITABLE`.
- A10: o schema de resposta é feito só de inteiros.

## Casos de teste
- C1 a C6: lista.
- C7 a C12: detalhe, com parcela paga, parcial (mora só sobre o saldo em aberto), vencida (com e sem carência de encargos) e estorno.
- C13 a C16: cotação.
- C17 e C18: schema.

## Contrato

Schemas já existentes em `packages/schemas/src/api/lending/loan-views.ts`: `loanListResponse` (`items` de `loanListItemSchema`: `id`, `loanNumber`, `personName`, `principalCents`, `outstandingCents`, `status`, `standing` nulo fora de ACTIVE, `nextDueDate`; mais `nextCursor`), `loanDetailResponse` (condições copiadas, `totalCents`, `interestCents`, `paidCents`, `outstandingCents`, `installments` com `number`, `dueDate`, `totalCents`, `paidCents`, `lateChargesCents`, `status`) e, novo nesta feature, `payoffQuoteResponse` / `payoffQuoteQuery` em `payoff-quote.ts`.

| Rota | Entrada | Erros |
|---|---|---|
| `GET /loans` | `personId`, `status`, `standing`, `cursor`, `limit` | 400 `VALIDATION_FAILED` |
| `GET /loans/{id}` | - | 404 |
| `GET /loans/{id}/payoff-quote` | `?date=AAAA-MM-DD` | 422 data anterior a `disbursedAt`; 409 `LOAN_NOT_EDITABLE` fora de ACTIVE |

Consultas em `infra/loan-queries.ts`; cálculo de encargos, status e saldo só de `@pilla/finance` (`late-charges`, `balance`, `allocation`), sem aritmética duplicada na API.

## Dependências

F02 (nomes e alocações), F04 (contratos ACTIVE com parcelas). Destrava F06, F07, F08 e a E11 (que lê a cotação).

## Riscos

- Dependência de data: os testes fixam o "hoje" (`brasilia-today`) para o resultado não variar.
- Estorno: alocação de pagamento REVERSED não conta em `paidCents`.
- Valor calculado gravado por engano violaria a ADR-0005.
