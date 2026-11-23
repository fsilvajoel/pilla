# E16-F01: schemas do relatório de importação

Plano da feature. Cartões: E16-T01 (testes, haiku) e E16-T02 (implementação, haiku). Referências: PRD-001 RF-70, RFC-004 §3 e §6, ADR-0004, `docs/plano/E16.md` D3, D4, D8 e D9.

## Escopo

Entra:
- `packages/schemas/src/api/imports/import-report.ts` (novo): `importReviewReasonSchema` e motivos de rejeição `MISSING_REQUIRED` e `ROW_FAILED` (lista fechada de revisão: `SCHEDULE_MISMATCH`, `TYPE_UNKNOWN`, `RATE_MISSING`, `INSTALLMENTS_MISSING`, `FIRST_DUE_MISSING`, `DATE_NOT_PARSEABLE`, `CPF_INVALID`, `PAID_EXCEEDS_TOTAL`, `PAID_DATE_MISSING`, `DUPLICATE_PERSON_NAME`), `importRowStatusSchema`, `importReportResponse` (estrito).
- Código de erro `IMPORT_ALREADY_DONE` (409) no catálogo da RFC-004 §6.
- Exportação em `packages/schemas/src/index.ts`.

Fora: tipos do CSV cru (ficam no domínio da API, F02); schema de requisição (corpo é `text/csv`, sem JSON).

## Contrato

| Peça | Forma |
|---|---|
| `importReportResponse` | `{id: uuid, createdAt: instant, totals: {rows, ok, review, rejected, personsCreated, personsReused, personsWithoutCpf, loansCreated, paymentsCreated}, rows: {lineNumber, status: REVIEW\|REJECTED, reasons: (ImportReviewReason\|MISSING_REQUIRED)[], personId: uuid\|null, loanId: uuid\|null}[]}` |

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| totais | inteiro | 0 | 2000 | negativo, decimal | 400 | D2 |
| `lineNumber` | inteiro | 1 | 2001 | 0, negativo | 400 | D2 |
| `status` em `rows` | REVIEW, REJECTED | - | - | OK, outro | 400 | D9 |
| `reasons` | lista de motivos | 1 | - | motivo fora da lista, vazia | 400 | D4 |

## Critérios de aceite

- A1: o schema aceita o relatório do contrato e recusa campo extra (estrito).
- A2: recusa total negativo ou não inteiro, `lineNumber` 0, status `OK` em `rows`, motivo desconhecido e `reasons` vazia.
- A3: `personId` e `loanId` aceitam nulo; REJECTED traz `MISSING_REQUIRED` ou `ROW_FAILED`.

## Casos de teste

`packages/schemas/src/api/imports/import-report.test.ts`: C1 relatório válido; C2 a C5 recusas de A2; C6 nulos de A3.

## Riscos

Lista de motivos crescer na F02; o schema é a fonte única, a F02 só importa dele.

## Dependências

Nenhuma. Destrava F02 e F03.
