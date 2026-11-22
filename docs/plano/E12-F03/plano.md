# E12-F03: extrato e saldo derivado

Plano da feature. Cartões: E12-T12 (testes de schema, bia), E12-T05 (testes HTTP, claude Sonnet) e E12-T06 (implementação, baidu, com Sonnet de reserva). Referências: PRD-001 RF-31 e RN-T01, RFC-004 §2 e §3, RFC-005 §6, ADR-0004, ADR-0005, ADR-0006, `docs/plano/E12.md` D5 e D8.

## Escopo

Entra:
- `GET /api/v1/accounts/{id}/entries?from&to&limit&cursor` → 200 `accountStatementResponse`:
  - `accountId`, `from`, `to` (como recebidos, ou nulos);
  - `openingBalanceCents` = soma dos lançamentos com `entry_date < from` (0 sem `from`);
  - `closingBalanceCents` = soma dos lançamentos com `entry_date <= to` (saldo atual sem `to`);
  - `items`: lançamentos com `from <= entry_date <= to`, ordem `entry_date`, `created_at`, `id` crescente, cada um com
    os campos de `accountEntryResponse` mais `balanceAfterCents` (saldo acumulado da conta até aquela linha, inclusive);
  - `nextCursor` (paginação da RFC-004 §2; `limit` padrão 50, máximo 200).
- `GET /api/v1/accounts` passa a trazer `balanceCents` (soma de todos os lançamentos) em cada conta.
- Porta nova `apps/api/src/treasury/public/account-balance.ts`: `accountBalanceCents(db, accountId)` e
  `totalBalanceCents(db)` (contas ativas), para o painel (F04).
- Schemas: `packages/schemas/src/api/treasury/account-statement.ts` (novo) e `account-summary.ts` com `balanceCents`.

Fora: saldo materializado (ADR-0005: sempre derivado); extrato de várias contas; exportar CSV ou PDF; filtro por tipo.

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `id` | UUID | - | - | "x" | 400; inexistente 404 | RFC-004 §2 |
| `from`, `to` | YYYY-MM-DD, opcionais | - | - | "2027-13-01", "01/02/2027"; `from > to` | 400 `VALIDATION_FAILED` | ADR-0004 |
| `limit` | inteiro | 1 | 200 | 0, 201, "x" | 400 | RFC-004 §2 |
| `cursor` | opaco, devolvido pela API | - | - | adulterado | 400 | RFC-004 §2 |

## Critérios de aceite

- A1: sem filtros, o extrato traz todos os lançamentos em ordem e `balanceAfterCents` acumulado; `closingBalanceCents`
  é a soma de tudo.
- A2: com `from` e `to`, só entram os do período; `openingBalanceCents` é a soma antes de `from`;
  `balanceAfterCents` do primeiro item é `openingBalanceCents + amountCents`; `closingBalanceCents` é o
  `balanceAfterCents` do último.
- A3: lançamentos no mesmo dia ficam na ordem de `created_at`.
- A4: com `limit`, `nextCursor` leva à página seguinte sem repetir nem pular linha, e o saldo acumulado continua certo
  na segunda página.
- A5: lançamentos automáticos (desembolso, recebimento, estorno) e manuais aparecem com `type`, `component`,
  `sourceType` e `sourceId`.
- A6: `GET /accounts` traz `balanceCents` igual ao `closingBalanceCents` do extrato sem filtros; conta sem lançamentos
  tem 0.
- A7: período sem lançamentos devolve `items` vazio e `openingBalanceCents` = `closingBalanceCents`.
- A8: `from > to`, data inválida, `limit` fora do intervalo ou cursor adulterado dão 400; conta inexistente dá 404.
- A9: os schemas exigem inteiros com sinal em `amountCents` e nos saldos, `balanceAfterCents` em cada item, e recusam
  chave desconhecida; `accountSummarySchema` exige `balanceCents` inteiro (pode ser negativo).

## Casos de teste

- `apps/api/src/treasury/http/account-statement.http.test.ts`: C1, C2 extrato completo e por período; C3 ordem no
  mesmo dia; C4, C5 paginação; C6 automáticos e manuais; C7 período vazio; C8 a C12 recusas e 404.
- `apps/api/src/treasury/http/accounts.http.test.ts` (existente, ganha casos): C13, C14 `balanceCents` com e sem
  lançamentos.
- `packages/schemas/src/api/treasury/account-statement.test.ts`: C15 a C18.
- `packages/schemas/src/api/treasury/account-summary.test.ts`: C19, C20.

## Riscos

- Soma acumulada em conta grande: a janela (`SUM() OVER`) roda no banco; com `cursor` o saldo inicial da página é a soma
  antes da primeira linha dela. Volume do MVP é pequeno.
- `api.test.ts` tem exemplo de `accountListResponse` sem `balanceCents`; o cartão de implementação atualiza o exemplo.

## Dependências

E12-T02 (há lançamentos automáticos para listar). Destrava F04 (porta de saldo) e F05.
