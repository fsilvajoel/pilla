# RFC-004 — Contrato da API e catálogo de eventos

| Campo | Valor |
|---|---|
| Status | Aprovado |
| Autor | Claude (tech lead) |
| Criado | 2026-11-14 |
| Implementa | [PRD-001](../prd/PRD-001-mvp-gestao-emprestimos.md) (RF-xx) |
| Depende de | [RFC-001](RFC-001-dominios-e-integracao.md), [ADR-0003](../adr/0003-eventos-de-dominio-com-outbox.md), [ADR-0004](../adr/0004-dinheiro-em-centavos.md), [ADR-0012](../adr/0012-idioma-codigo-ingles-docs-portugues.md) |

---

## 1. Objetivo

Definir o contrato entre front e back e entre módulos, para que agentes diferentes construam partes que se encaixam. Os esquemas Zod em `packages/schemas` são a implementação deste documento; o OpenAPI é gerado a partir deles.

## 2. Convenções

| Item | Regra |
|---|---|
| Base | `/api/v1` · REST · JSON |
| Nomes | rotas em inglês, kebab-case, plural (`/loans`, `/pix-keys`); campos em camelCase ([glossário](../glossario.md)) |
| Dinheiro | inteiro em centavos, sufixo `Cents`: `"principalCents": 500000` |
| Taxas | inteiro em pontos-base (1 bp = 0,01%), sufixo `Bps`: 6,33% → `"monthlyInterestRateBps": 633` |
| Datas de negócio | `"YYYY-MM-DD"` · instantes: ISO 8601 com fuso (`2026-11-14T15:30:00-03:00`) |
| IDs | UUID v7 (ordenável por tempo) |
| Enums | MAIÚSCULAS em inglês, conforme glossário |
| Ações de negócio | `POST /recurso/{id}/acao` (`/loans/{id}/activate`), não `PATCH status` |
| Idempotência | `POST` que cria/altera dinheiro aceita cabeçalho `Idempotency-Key`; repetir a chave devolve a mesma resposta |
| Concorrência | recursos editáveis têm `version`; `PATCH` exige `If-Match: <version>` → `409` se mudou |
| Paginação | `?limit=50&cursor=...` → `{ "items": [], "nextCursor": "..." }` |
| Erros | `application/problem+json` (RFC 9457) com `code` estável em inglês e `detail` em pt-BR (§6) |
| Autenticação | ADMIN: cookie de sessão. CLIENTE: cookie de sessão do portal criado por CPF ([ADR-0011](../adr/0011-autenticacao-cpf-senha-sessao.md)) |

Campos calculados ([ADR-0005](../adr/0005-valores-derivados.md)) aparecem nas respostas, nunca nas entradas.

## 3. Endpoints — ADMIN

### Acesso (`access`)
| Método e rota | Faz | RF |
|---|---|---|
| `POST /auth/admin/login` `{username, password}` | cria sessão | RN-A05 |
| `POST /auth/admin/logout` | encerra sessão | |
| `GET /auth/me` | usuário logado | |
| `PUT /portal-access/{personId}` `{enabled}` | habilita/desabilita portal | RF-60 |

### Pessoas (`people`)
| Método e rota | Faz | RF |
|---|---|---|
| `GET /people?search=&limit=&cursor=` | lista/busca por nome ou CPF | RF-04 |
| `POST /people` | cadastra | RF-01 |
| `GET /people/{id}` | ficha (dados + resumo de contratos via consulta pública de `lending`) | RF-04 |
| `PATCH /people/{id}` | edita | RF-01 |
| `POST /people/{id}/addresses` · `PATCH`/`DELETE /addresses/{id}` | endereços | RF-02 |
| `POST /people/{id}/pix-keys` · `PATCH`/`DELETE /pix-keys/{id}` | chaves PIX | RF-02 |

### Crédito (`lending`)
| Método e rota | Faz | RF/RN |
|---|---|---|
| `POST /loans/simulate` | calcula sem gravar (mesmo `packages/finance` do front) | RF-10 |
| `POST /loans` | cria em DRAFT, copiando os parâmetros padrão | RF-11, RN-C12 |
| `PATCH /loans/{id}` | edita, só em DRAFT | RN-C06 |
| `POST /loans/{id}/activate` `{disbursedAt, accountId}` | ativa, gera parcelas, publica `LoanActivated` | RF-12, RN-C05 |
| `POST /loans/{id}/cancel` | DRAFT → CANCELLED | RF-17 |
| `POST /loans/{id}/renew` `{firstDueDate, ...ajustes}` | cria contrato novo em DRAFT ligado ao atual | RF-13, RN-C13–16 |
| `POST /loans/{id}/renegotiate` `{...novas condições}` | idem, com saldo capitalizado | RF-14, RN-C17–18 |
| `POST /loans/{id}/write-off` `{reason}` | baixa como perda | RF-16, RN-C19 |
| `GET /loans/{id}/payoff-quote?date=` | valor para quitar na data | RF-15 |
| `GET /loans?personId=&status=&standing=` | lista | |
| `GET /loans/{id}` | contrato + cronograma + calculados | RF-18 |
| `GET /settings/default-terms` · `PUT` | parâmetros padrão | RF-40 |

> Renovar/renegociar devolvem o **novo** contrato em DRAFT; o anterior só muda de status quando o novo é ativado (evita contrato "pendurado" se a operação for abandonada).

### Recebimentos (`payments`)
| Método e rota | Faz | RF/RN |
|---|---|---|
| `POST /payments/allocation-preview` `{loanId, amountCents, paidAt}` | mostra a distribuição antes de gravar | RF-23 |
| `POST /payments` | registra em PENDING_REVIEW | RF-20 |
| `POST /payments/{id}/confirm` | confirma, aloca, publica `PaymentConfirmed` | RF-21 |
| `POST /payments/{id}/reverse` `{reason}` | estorna | RF-22, RN-R07/R10/R11 |
| `GET /payments?status=&loanId=` | lista | |

### Anexos (`core`)
| Método e rota | Faz |
|---|---|
| `POST /attachments/upload-url` `{fileName, contentType, sizeBytes}` | URL assinada para envio direto ao armazenamento |
| `POST /attachments` `{storageKey, sha256, ...}` | registra o anexo enviado |
| `GET /attachments/{id}/download-url` | URL assinada de leitura (curta duração) |

### Tesouraria (`treasury`)
| Método e rota | Faz | RF |
|---|---|---|
| `GET /accounts` · `POST /accounts` | contas | |
| `POST /accounts/{id}/entries` `{type: CAPITAL_IN \| CAPITAL_OUT \| ADJUSTMENT, amountCents, entryDate, justification}` | lançamento manual | RF-30 |
| `GET /accounts/{id}/entries?from=&to=` | extrato | RF-31 |
| `GET /treasury/summary` | caixa, emprestado, % comprometido/disponível, juros, perdas, recuperado, previsão do mês | RF-32 |

### Painel e importação
| Método e rota | Faz | RF |
|---|---|---|
| `GET /dashboard/today` | vencendo hoje/semana, atrasadas, pagamentos pendentes | RF-50 |
| `POST /imports/spreadsheet` (CSV) · `GET /imports/{id}` | importação + relatório "a revisar" | RF-70 |

## 4. Endpoints — Portal do cliente

| Método e rota | Faz | RF |
|---|---|---|
| `POST /portal/session` `{cpf}` | cria sessão do portal (limite por IP; resposta genérica) | RF-61, RN-A04 |
| `DELETE /portal/session` | sai | |
| `GET /portal/loans` | contratos da pessoa da sessão | RF-61 |
| `GET /portal/loans/{id}` | detalhe para o cliente (DTO próprio, sem dados internos) | RF-62/63 |

Nenhum endpoint do portal recebe `personId`: a pessoa vem **só** da sessão ([ADR-0007](../adr/0007-controle-de-acesso-por-papeis.md)).

## 5. Exemplos

**Simulação** — `POST /api/v1/loans/simulate`
```json
{
  "type": "INSTALLMENT",
  "principalCents": 500000,
  "monthlyInterestRateBps": 633,
  "installmentCount": 6,
  "frequency": { "unit": "MONTH", "interval": 1 },
  "firstDueDate": "2026-12-14"
}
```
Resposta `200`:
```json
{
  "interestCents": 190000,
  "totalCents": 690000,
  "installmentAmountCents": 115000,
  "periodRateBps": 633,
  "schedule": [
    { "number": 1, "dueDate": "2026-12-14", "principalCents": 83333, "interestCents": 31667, "totalCents": 115000 }
  ]
}
```

**Portal** — `GET /api/v1/portal/loans/{id}` (campos permitidos, RF-62)
```json
{
  "loanNumber": "2026-0012",
  "principalCents": 500000,
  "totalCents": 690000,
  "paidCents": 230000,
  "outstandingCents": 460000,
  "standing": "CURRENT",
  "nextInstallment": { "number": 3, "dueDate": "2027-02-14", "amountCents": 115000 },
  "installments": [ { "number": 1, "dueDate": "2026-12-14", "amountCents": 115000, "status": "PAID" } ],
  "payments": [ { "paidAt": "2026-12-13", "amountCents": 115000, "method": "PIX" } ]
}
```

## 6. Catálogo de erros (`code`)

| HTTP | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_FAILED` | entrada inválida (lista de campos em `errors`) |
| 401 | `UNAUTHENTICATED` | sem sessão |
| 403 | `FORBIDDEN` | papel sem permissão / recurso de outra pessoa |
| 404 | `NOT_FOUND` | inexistente (portal usa 404 também para "não é seu") |
| 409 | `VERSION_CONFLICT` | `If-Match` desatualizado |
| 422 | `LOAN_NOT_EDITABLE` | editar contrato fora de DRAFT |
| 422 | `INSUFFICIENT_ACCOUNT_BALANCE` | RN-C10 |
| 422 | `FIRST_DUE_DATE_BEFORE_DISBURSEMENT` | RN-C04 |
| 422 | `PAYMENT_EXCEEDS_BALANCE` | RN-R03 |
| 422 | `LOAN_CLOSED_FOR_PAYMENTS` | RN-R09 (inclui `successorLoanId`) |
| 422 | `RENEWAL_REQUIRES_INTEREST_PAID` | RN-C14 |
| 422 | `REVERSAL_BLOCKED_BY_SUCCESSOR` | RN-R11 |
| 422 | `RECEIPT_REQUIRED` | RN-R06 |
| 422 | `DUPLICATE_PIX_TRANSACTION` | mesmo `pixEndToEndId` já registrado |
| 429 | `TOO_MANY_REQUESTS` | limite do portal/login |
| 500 | `INTERNAL_ERROR` | erro inesperado; o `detail` é fixo ("Erro interno do servidor."), sem mensagem interna nem stack |

Os textos em pt-BR de cada `code` ficam no arquivo de mensagens do sistema.

## 7. Catálogo de eventos

Envelope (todos):
```json
{ "id": "uuid-v7", "type": "PaymentConfirmed", "version": 1, "occurredAt": "2026-11-14T15:30:00-03:00", "aggregateId": "uuid", "payload": {} }
```

| Evento (v1) | Produtor | Payload | Consumidores (MVP) |
|---|---|---|---|
| `LoanActivated` | lending | `loanId, personId, accountId, principalCents, disbursedAt, originLoanId?, originType?` | treasury (DISBURSEMENT, exceto quando `originType` = renovação/renegociação); lending (muda status do contrato de origem) |
| `LoanPaidOff` | lending | `loanId, personId, paidOffAt` | treasury |
| `LoanReopened` | lending | `loanId, reason` | treasury |
| `LoanRenewed` | lending | `loanId, successorLoanId` | treasury |
| `LoanRenegotiated` | lending | `loanId, successorLoanId, capitalizedCents` | treasury |
| `LoanWrittenOff` | lending | `loanId, outstandingPrincipalCents, reason` | treasury (perdas) |
| `PaymentConfirmed` | payments | `paymentId, loanId, personId, accountId, paidAt, amountCents, allocations: [{installmentId, lateChargesCents, interestCents, principalCents}], isRecovery` | lending (verifica quitação), treasury (REPAYMENT por componente) |
| `PaymentReversed` | payments | `paymentId, loanId, accountId, amountCents, allocations, reason` | lending (reabertura), treasury (REVERSAL) |
| `InstallmentPaid` | payments | `installmentId, loanId, paidAt, daysLate` | — (futuro: risk) |
| `InstallmentOverdue` | lending (rotina diária) | `installmentId, loanId, personId, dueDate, outstandingCents` | — (futuro: messaging, risk) |

Regras: payload só com ids e valores (sem dados pessoais); mudança incompatível → `version` 2 publicada em paralelo até os consumidores migrarem.

## 8. Questões abertas

- Formato do CSV de importação (depende do mapeamento coluna → campo; virá com a tarefa E7).
