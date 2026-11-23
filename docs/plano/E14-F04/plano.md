# E14-F04: ator real na auditoria e no `created_by`

Plano da feature. Cartões: E14-T07 (testes) e E14-T08 (implementação). Referências: PRD-001 RN-A03, ADR-0007, RFC-005, `docs/plano/E14.md` D1, D8 e D11.

## Escopo

Entra:
- Controllers de payments e lending recebem `@CurrentActor()` e passam o `RequestActor` aos serviços.
- payments: `created_by`, `confirmed_by`, `rejected_by`, `reversed_by` e a auditoria (`actor_type` ADMIN, `actor_id`, `ip`) vêm do ator; sai `PROVISIONAL_ACTOR_ID`.
- lending: criar, editar, ativar, baixar como perda, quitar e reabrir gravam auditoria com o ator; `loans.created_by` do ator; `lending/public/mark-loan-paid-off.ts` e `reopen-loan.ts` recebem o ator.
- `default_terms`: a linha nova leva `created_by` do ator (hoje copia o da linha anterior).
- treasury: se os lançamentos manuais da E12-F02 já estiverem na `main`, o `created_by` deles vem do ator; se não, nada.

Fora: gravações automáticas (consumidores do outbox) seguem com `SYSTEM_ACTOR_ID`; FK em `created_by` (não existe no schema e não entra); auditoria de login e logout (D5).

## Domínio das entradas

| Origem da escrita | `actor_type` | `actor_id` / `created_by` | `ip` |
|---|---|---|---|
| rota HTTP com sessão ADMIN | ADMIN | `adminUserId` da sessão | IP do ator (F03) |
| consumidor do outbox | SYSTEM | `SYSTEM_ACTOR_ID` | nulo |

## Critérios de aceite
- A1: em payments, registrar, confirmar, rejeitar e estornar gravam os campos `*_by` com o `adminUserId`.
- A2: a auditoria de payments tem `actor_type` ADMIN, `actor_id` e `ip` do ator.
- A3: em lending, as seis ações gravam auditoria com o ator; `loans.created_by` é o `adminUserId`.
- A4: `PUT /settings/default-terms` grava `created_by` do ator, não o da linha anterior.
- A5: nenhuma linha de auditoria gravada por essas rotas tem `actor_id` nulo; `PROVISIONAL_ACTOR_ID` some do código.

## Casos de teste
- `apps/api/src/payments/http/payments-actor.http.test.ts`: C1 a C5 (com ator explícito no `createTestApp`, diferente do padrão).
- `apps/api/src/lending/http/loans-actor.http.test.ts`: C6 a C9.
- `apps/api/src/lending/http/default-terms-actor.http.test.ts`: C10.
- C11 (sem `actor_id` nulo) distribuído nos três arquivos.

## Riscos
- Mudança de assinatura dos serviços toca muitos testes existentes: o ator padrão do `createTestApp` evita editar `*.http.test.ts`; testes de serviço que chamam direto passam o `TEST_ADMIN_ACTOR`.
- Conflito com a E12 em andamento em treasury: o cartão só mexe em treasury se o código já existir.

## Dependências
F03 (`@CurrentActor`, `RequestActor`, `createTestApp` com ator).
