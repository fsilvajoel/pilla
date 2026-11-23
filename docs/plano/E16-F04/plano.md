# E16-F04: módulo `imports` (tabelas, POST e GET)

Plano da feature. Cartões: E16-T07 (testes HTTP, sonnet) e E16-T08 (implementação, sonnet). Referências: PRD-001 RF-70 e RN-P01, RFC-004 §3 e §6, RFC-005 §6, ADR-0002, ADR-0006, `docs/plano/E16.md` D1, D2, D6 a D10, `docs/plano/pendencias-pm.md` (E16-T03 a E16-T07).

## Escopo

Entra (`apps/api/src/imports/`):
- `infra/schema.ts` e migração `apps/api/migrations/imports/0000_imports.sql`: schema `imports`; `import_batches` (`id`, `file_sha256` único, contagens, `created_by`, `created_at`); `import_rows` (`batch_id`, `line_number`, `status`, `reasons text[]`, `person_id`, `loan_id`, `payment_id`; sem FK para outros módulos).
- `application/import-service.ts`: calcula SHA-256 do corpo (409 `IMPORT_ALREADY_DONE` se já existe); `parseCsv` + `classifyRow` (F02); para cada linha, **uma transação**: pessoa (`createImportedPerson`, com reaproveitamento de nome na própria importação, D5), contrato (`importLoan`), pagamento (`recordImportedPayment`); erro inesperado na linha: rollback dela, linha `REJECTED` com motivo `ROW_FAILED` e segue. Ao fim grava lote, linhas e auditoria `import.created`.
- `http/imports.controller.ts`: `POST /imports/spreadsheet` (ADMIN, `text/csv`, corpo cru limitado a 2 MB) e `GET /imports/{id}`; DTO pelo `importReportResponse` da F01.
- Registro em `app.module.ts`.

Fora: assíncrono; multipart; reprocessar; desfazer; tela (F05).

## Contrato

Ver `docs/plano/E16.md` (Contrato). `rows` do relatório: só REVIEW e REJECTED, ordenadas por `lineNumber`.

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| corpo | `text/csv` UTF-8 | 1 linha de dados | 2 MB, 2000 linhas | vazio, sem coluna obrigatória, maior que o limite | 422 `VALIDATION_FAILED` | D2 |
| `Content-Type` | `text/csv` | - | - | outro | 415 ou 422 `VALIDATION_FAILED` | D2 |
| arquivo repetido | mesmo SHA-256 | - | - | já importado | 409 `IMPORT_ALREADY_DONE` | D8 |
| `{id}` | uuid | - | - | inexistente | 404 `NOT_FOUND` | RFC-004 §6 |
| ator | ADMIN | - | - | PORTAL, anônimo | 401/403 | RFC-004 §1 |

## Critérios de aceite

- A1: só ADMIN usa as duas rotas.
- A2: corpo vazio, sem coluna obrigatória, acima de 2000 linhas ou 2 MB: 422 e nada gravado.
- A3: CSV fictício com linhas OK, REVIEW e REJECTED responde 201 com `totals` corretos.
- A4: linha OK cria pessoa, contrato `ACTIVE` IMPORT e um pagamento `CONFIRMED`; REVIEW cria contrato CUSTOM listado com motivos; REJECTED não cria nada.
- A5: mesmo CPF reaproveita a pessoa; CPF em branco cria pessoa sem CPF e soma `personsWithoutCpf`; mesmo nome sem CPF no arquivo reaproveita a pessoa e marca `DUPLICATE_PERSON_NAME`.
- A6: falha forçada numa linha a deixa REJECTED e preserva as demais.
- A7: mesmo arquivo de novo: 409 com o id do primeiro lote e nada novo gravado.
- A8: `GET` devolve o mesmo relatório (só REVIEW e REJECTED nas linhas); id desconhecido 404; `core.audit_log` tem `import.created`.
- A9: após `dispatchOutbox` (E12-T02) o caixa tem um DISBURSEMENT negativo por contrato datado `data_contrato` e REPAYMENT datado `data_ultimo_pagamento`.
- A10: nenhum teste usa dado real.

## Casos de teste

- `imports/http/imports.http.test.ts`: C1 (A1); C2 a C4 (A2); C5, C6 (A3, A4); C7 a C9 (A5); C10 (A6); C11 (A7); C12, C13 (A8).
- `imports/http/imports-ledger.http.test.ts`: C14, C15 (A9), depende de E12-T02.

## Riscos

- Linha que falha por erro inesperado fica `REJECTED` com `ROW_FAILED` (motivo de rejeição da F01, junto de `MISSING_REQUIRED`).
- Requisição longa (2000 linhas, uma transação cada): aceito no MVP (D2); o limite protege.
- Lote gravado depois das linhas: queda no meio deixa contratos sem lote; reenviar o arquivo cria de novo. Aceito e avisado.

## Dependências

F02 e F03 (e F01). E12-T02 só para A9. Destrava F05.
