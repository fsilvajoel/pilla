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
