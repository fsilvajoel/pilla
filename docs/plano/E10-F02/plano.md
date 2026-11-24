# E10-F02: portas públicas de leitura e GET /accounts

Plano da feature. Cartões: E10-T03 (testes, claude) e E10-T04 (implementação, baidu). Referências: RFC-001 M2 (módulos falam só por `public`), RFC-004 §3, RFC-005 §5 e §6, ADR-0002, `docs/plano/E10.md` D5, RN-T04, RN-R01.

## Escopo

Entra:
- `people/public`: `findPersonNames(ids)` e `personExists(id)`.
- `treasury/public`: `isActiveAccount(id)`.
- `treasury/http`: `GET /api/v1/accounts`, que responde `accountListResponse` com as contas ativas primeiro.
- `payments/public`: `confirmedAllocationsByLoan(loanId)`, que soma por parcela as alocações de pagamentos CONFIRMED com `reversed_at` nulo, separadas por componente (principal, juros, encargos).
- Seed: uma conta base ativa "Conta principal", com id fixo e idempotente (pendência PEND-01).

Fora: criar ou editar contas (E12), lançamentos de ledger (E11/E12), saldo de conta.

## Critérios de aceite
- A1: `findPersonNames` devolve os nomes dos ids existentes e omite os desconhecidos.
- A2: `isActiveAccount` é verdadeiro só para conta existente e ativa.
- A3: `GET /accounts` responde 200 no schema da RFC-004.
- A4: o seed roda duas vezes sem duplicar a conta.
- A5: só alocações de pagamentos CONFIRMED não estornados contam.
- A6: as portas devolvem tipos simples (sem linha do Drizzle) e passam no depcruise.

## Casos de teste
- C1, C2: pessoa (existe ou não existe).
- C3 a C5: conta ativa, inativa e inexistente.
- C6, C7: lista de contas e seed repetido.
- C8 a C11: alocações (confirmado, PENDING_REVIEW, REVERSED, duas parcelas).

## Contrato

```ts
// people/public
findPersonNames(ids: string[]): Promise<Map<string, string>>;
personExists(id: string): Promise<boolean>;
// treasury/public
isActiveAccount(id: string): Promise<boolean>;
// payments/public
confirmedAllocationsByLoan(loanId: string): Promise<ConfirmedAllocation[]>; // por parcela: principal, juros, encargos
```

Rota: `GET /api/v1/accounts` responde `accountListResponse` (`packages/schemas/src/api/treasury/account-summary.ts`), contas ativas primeiro. Seed em `apps/api/scripts/seed.mts` (`pnpm --filter @pilla/api db:seed`), conta base de id fixo, `ON CONFLICT DO NOTHING`.

## Domínio das entradas

| Entrada | Aceito | Rejeitado | Fonte |
|---|---|---|---|
| `ids` de `findPersonNames` | lista de uuids (pode ter inexistentes) | - (inexistente é omitido) | RFC-004 §3 |
| `accountId` de `isActiveAccount` | uuid | - (inexistente ou inativa dá `false`) | RN-T04 |
| `loanId` de `confirmedAllocationsByLoan` | uuid | - (sem alocação dá lista vazia) | RN-R01 |
| alocação contada | pagamento CONFIRMED, `reversed_at` nulo | PENDING_REVIEW, REVERSED | RFC-005 §5 |

## Dependências

F01. Destrava F03 (pessoa e conta), F04 (conta ativa) e F05 (alocações). Exige `ApiEnv` e módulos registrados em `app.module.ts`.

## Riscos

- Uma porta que vaza linha do Drizzle quebra a regra de módulos (RFC-001 M2); o depcruise do cartão pega.
- Seed não idempotente duplicaria a conta base; o caso C7 roda duas vezes.
- A lista de contas é só leitura aqui; cadastro e saldo são da E12.
