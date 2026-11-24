# E12-F02: aporte, retirada e ajuste

Plano da feature. Cartões: E12-T11 (testes de schema, bia), E12-T03 (testes HTTP, claude Sonnet) e E12-T04 (implementação, baidu, com Sonnet de reserva). Referências: PRD-001 RF-30, RN-T01 e RN-T04, RFC-004 §2, §3 e §6, RFC-005 §6, ADR-0004, ADR-0006, `docs/plano/E12.md` D4, `docs/plano/pendencias-pm.md` (E12-T03).

## Escopo

Entra:
- `POST /api/v1/accounts/{id}/entries` com `accountEntryRequest` (já existe, com regras testadas em `api.test.ts`) e
  cabeçalho opcional `Idempotency-Key`. Em uma transação:
  1. conta inexistente: 404 `NOT_FOUND`; conta inativa: 400 `VALIDATION_FAILED` com `accountId`;
  2. `entryDate` depois de hoje em Brasília: 400 `VALIDATION_FAILED` com `entryDate`;
  3. grava o lançamento: CAPITAL_IN com `+amountCents`, CAPITAL_OUT com `-amountCents`, ADJUSTMENT com o valor como veio;
     `component`, `source_type`, `source_id` e `source_event_id` nulos; `justification` como veio; `created_by` = ator
     da requisição (provisório, como em payments);
  4. auditoria `ledger_entry.created` com o lançamento.
- Resposta 201 `accountEntryResponse` `{id, accountId, type, component, amountCents, entryDate, justification,
  sourceType, sourceId, createdAt}` (novo em `packages/schemas/src/api/treasury/account-entry.ts`; `amountCents` com
  sinal, como gravado).
- `Idempotency-Key`: coluna nova `ledger_entries.idempotency_key text null` com unique (migração
  `apps/api/migrations/treasury/0001_ledger_idempotency_key.sql` e linha nova na RFC-005 §6). Repetir a chave devolve
  201 com o lançamento já gravado, sem gravar outro.
- Saldo negativo depois de retirada ou ajuste: aceito (pendência de PM, padrão).

Fora: editar ou apagar lançamento (ADR-0006: a correção é um ajuste novo); lançamento manual com tipo de sistema
(DISBURSEMENT, REPAYMENT, REVERSAL: barrado pelo schema); `POST /accounts`; limite `max_committed_bps`.

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `id` | UUID | - | - | "x" | 400; inexistente 404; inativa 400 | RFC-004 §2 |
| `type` | CAPITAL_IN, CAPITAL_OUT, ADJUSTMENT | - | - | DISBURSEMENT, REPAYMENT, REVERSAL, "x" | 400 `VALIDATION_FAILED` | RF-30 |
| `amountCents` (aporte, retirada) | inteiro positivo | 1 | limite de `positiveCentsSchema` | 0, -1, 10.5, "100" | 400 | ADR-0004 |
| `amountCents` (ajuste) | inteiro com sinal | limite de `signedCentsSchema` | idem | 0, 10.5 | 400 | ADR-0004 |
| `entryDate` | YYYY-MM-DD | - | hoje em Brasília | "02/01/2027", amanhã | 400 formato e futuro | ADR-0004 |
| `justification` | texto (`reasonSchema`) | 1 caractere útil | limite do `reasonSchema` | "", "   " | 400; obrigatória no ajuste | RF-30, RFC-005 |
| `Idempotency-Key` | texto | 1 | 200 | "" | 400 | RFC-004 §2 |

## Critérios de aceite

- A1: aporte grava `+amountCents`, sem componente nem origem, e responde 201 com o lançamento.
- A2: retirada recebe valor positivo e grava `-amountCents`.
- A3: ajuste grava o valor com o sinal recebido e a justificativa.
- A4: auditoria gravada para cada lançamento.
- A5: mesma `Idempotency-Key` duas vezes grava um só lançamento e as duas respostas trazem o mesmo `id`.
- A6: `entryDate` de hoje é aceito; de amanhã dá 400 `VALIDATION_FAILED` em `entryDate`.
- A7: conta inexistente dá 404; conta inativa dá 400 `VALIDATION_FAILED` em `accountId`.
- A8: corpo inválido (tipo de sistema, valor zero ou fracionado, retirada negativa, ajuste sem justificativa, chave
  desconhecida) dá 400 `VALIDATION_FAILED`.
- A9: nenhuma recusa grava lançamento ou auditoria.
- A10: retirada maior que o saldo é aceita (padrão da pendência de PM).
- A11: `accountEntryResponse` exige inteiros, `type` do enum de seis tipos, `component` e origem nulos ou do enum,
  datas ISO, e recusa chave desconhecida.

## Casos de teste

- `apps/api/src/treasury/http/account-entries.http.test.ts`: C1 a C3 aporte, retirada, ajuste positivo e negativo;
  C4 auditoria; C5 idempotência; C6, C7 data de hoje e futura; C8, C9 conta inexistente e inativa; C10 a C14 corpo
  inválido; C15 nenhuma recusa grava; C16 retirada acima do saldo.
- `packages/schemas/src/api/treasury/account-entry.test.ts`: C17 a C20 `accountEntryResponse` (válido manual, válido
  automático com componente e origem, float, chave desconhecida, tipo fora do enum).

## Riscos

- Lançamento manual com data retroativa muda o saldo de dias passados no extrato (é o esperado; o extrato mostra
  `createdAt`).
- Unique de `idempotency_key` nulo não colide: os automáticos seguem pelo `source_event_id`.

## Dependências

E12-T02 (`SYSTEM_ACTOR_ID` e o ledger já recebendo eventos; os testes contam lançamentos da conta). Destrava F05.
