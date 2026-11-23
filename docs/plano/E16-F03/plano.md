# E16-F03: portas de escrita para pessoa, contrato e pagamento importados

Plano da feature. Cartões: E16-T05 (testes, opus) e E16-T06 (implementação, sonnet). Referências: PRD-001 RF-70, RN-P01 e RN-C09, RFC-004 §7, RFC-005 §4, ADR-0002, ADR-0005, ADR-0006, `docs/plano/E10.md` D10, `docs/plano/E16.md` D5 a D7, `docs/plano/pendencias-pm.md` (E16-T05, E16-T06).

## Escopo

Cada módulo expõe uma função em `public/` que recebe a **transação de quem chama** (como `markLoanPaidOff`) e nunca confirma sozinha. O módulo `imports` (F04) é o único chamador.

- `people/public/create-imported-person.ts`: `createImportedPerson(tx, {name, cpf|null, actorId}) → {personId, reused}`. CPF já existente devolve a pessoa (`reused` true); sem CPF cria com `cpf` nulo (RN-P01). Não casa por nome.
- `lending/public/import-loan.ts`: `importLoan(tx, plan, actorId) → {loanId, loanNumber}`. Insere o contrato direto `ACTIVE` com `originType` IMPORT, `disbursedAt` = `contractedAt`, conta base (falha se ausente ou inativa), número pela sequência anual do ano de `contractedAt`, termos de atraso copiados dos padrão vigentes (ADR-0008), parcelas do plano (CUSTOM com totais dados; `INSTALLMENT`, `SINGLE_PAYMENT` e `INTEREST_ONLY` com a primeira parcela). Grava auditoria `loan.imported` e `LoanActivated` com `originType` IMPORT.
- `payments/public/record-imported-payment.ts`: `recordImportedPayment(tx, {loanId, personId, accountId, paidAt, amountCents, method, installments}) → {paymentId, storedCents, excessCents, paidOff}`. Aloca com `allocatePayment` em ordem de parcela, grava um pagamento `CONFIRMED` (`channel` ADMIN, `isRecovery` falso) com as alocações e `PaymentConfirmed`; se zera o saldo chama `markLoanPaidOff` (RN-C09, `LoanPaidOff`).

Fora: editar ou apagar importado; pagamento por parcela; recuperação; qualquer coluna ou migração nova nesses módulos; HTTP.

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `cpf` | 11 dígitos ou nulo | - | - | não 11 dígitos | erro de domínio (o módulo `imports` já validou) | RN-P01 |
| `principalCents` | inteiro | 1 | - | 0, negativo | erro (CHECK do banco) | RFC-005 §4 |
| `installments[].totalCents` | inteiro | 0 | - | ≠ principal + juros | erro | RFC-005 §4 |
| `accountId` | uuid de conta ativa | - | - | inexistente, inativa | erro de domínio | E10 D5 |
| `amountCents` (pagamento) | inteiro | 1 | - | 0 (não grava) | devolve `storedCents` 0 | D7 |

## Critérios de aceite

- A1: sem CPF cria pessoa com `cpf` nulo; com CPF válido cria com os 11 dígitos.
- A2: CPF já existente devolve o mesmo `personId` e `reused` true, sem pessoa nova.
- A3: a porta roda na transação do chamador e some junto no rollback.
- A4: `importLoan` grava contrato `ACTIVE` com `originType` IMPORT, `disbursedAt` = `contractedAt` e o número `AAAA-NNNN` do ano do contrato.
- A5: copia os termos de atraso vigentes (ADR-0008); `CUSTOM` e `INTEREST_ONLY` aceitos (E10 D10).
- A6: grava as parcelas do plano; `INTEREST_ONLY` só a primeira.
- A7: grava auditoria `loan.imported` e `LoanActivated` com `originType` IMPORT válido no schema do evento.
- A8: conta ausente ou inativa falha sem gravar nada.
- A9: `recordImportedPayment` grava um `CONFIRMED` (canal ADMIN, método dado, sem recuperação) com alocações por parcela em ordem.
- A10: grava `PaymentConfirmed` com as alocações.
- A11: valor acima do saldo grava só o alocável e devolve `excessCents`.
- A12: pagamento que zera o saldo chama `markLoanPaidOff` (status `PAID_OFF`, `LoanPaidOff`).
- A13: valor zero não grava nada.

## Casos de teste

- `people/public/create-imported-person.test.ts`: C1 a C3 (A1 a A3).
- `lending/public/import-loan.test.ts`: C4 a C9 (A4 a A8), fixture com conta base do seed.
- `payments/public/record-imported-payment.test.ts`: C10 a C14 (A9 a A13).
Todos com PGlite, dados fictícios.

## Riscos

- Escreve em três módulos: a ordem de quem chama (pessoa, contrato, pagamento) é da F04; as portas não se chamam entre si além de `markLoanPaidOff`.
- Número do contrato do ano do histórico consome a sequência desse ano (pendência E16-T05; padrão aplicado).
- Método `CASH` do pagamento é suposição (pendência E16-T06).

## Dependências

F01 (só tipos de motivo; as portas não importam o schema do relatório, mas o contrato do plano vem da F02). Paralela à F02. Destrava F04.
