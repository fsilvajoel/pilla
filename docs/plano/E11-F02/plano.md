# E11-F02: registrar pagamento, listar e porta de pendentes (PRIORIDADE)

Plano da feature. Cartões: E11-T03 (testes, claude) e E11-T04 (implementação, claude Sonnet). Referências: PRD-001 RF-20 e RF-50, RN-R01, RN-R03, RN-R04, RN-R09, RN-C20, RFC-004 §2, §3 e §6, RFC-005 §5, ADR-0004, ADR-0006, `docs/plano/E11.md` D1, D2, D6 a D9, `docs/plano/decisoes-2026-11-19.md` §3 e §5.

**Prioridade do caminho crítico.** Esta feature destrava a RF-50 (pagamentos pendentes de conferência) da E13: a E13-F02 depende de E11-T04. Os testes (E11-T03) só dependem da E10 e começam junto com a F01; a implementação (E11-T04) espera E11-T02 (prévia e porta de leitura de `lending/public`). F07, F03 e as seguintes não bloqueiam a E13.

## Escopo

Entra:
- `POST /api/v1/payments`: registra em PENDING_REVIEW.
  - Corpo `createPaymentRequest`: `{loanId, accountId, paidAt, amountCents, method}`, estrito. Saem `destinationKey` e `receiptAttachmentId`/`RECEIPT_REQUIRED` (v1.1, D2). `paymentFieldsSchema` passa a ter os mesmos cinco campos, porque a web o usa.
  - Cabeçalho opcional `Idempotency-Key` (D8).
  - Em uma transação: confere contrato (D6), valor e data (D7, mesma regra e mesmo caso de uso da prévia), conta ativa (`treasury/public.isActiveAccount`); grava `payments.payments` com `status` PENDING_REVIEW, `channel` ADMIN, `person_id` copiado do contrato, `created_by`, `version` 1; grava a auditoria.
  - Não grava alocação, nem evento, nem muda o saldo (RN-R01). Em DRAFT aceita sem checar saldo (decisão de 20/11).
  - Resposta 201 `paymentResponse`.
- `GET /api/v1/payments?status=&loanId=&limit=&cursor=`: lista (RFC-004 §3) com `paymentListItem` (`loanNumber` e `personName` vêm de `lending/public.findLoanNumbers` e `people/public.findPersonNames`). Ordem: PENDING_REVIEW do mais antigo para o mais novo; os demais do mais novo para o mais antigo.
- Schemas novos em `packages/schemas/src/api/payments/`:
  - `payment-views.ts`: `paymentStatusSchema` (`PENDING_REVIEW`, `CONFIRMED`, `REVERSED`), `paymentListItemSchema` (`id`, `loanId`, `loanNumber`, `personId`, `personName`, `accountId`, `paidAt`, `amountCents`, `method`, `status`, `isRecovery`, `createdAt`, `confirmedAt` nulo, `reversedAt` nulo), `paymentResponse` (item + `version`, `reversalReason` nulo, `loanStatus`, `allocations[]` com `installmentNumber`, `lateChargesCents`, `interestCents`, `principalCents`; vazio fora de CONFIRMED), `paymentListQuery`, `paymentListResponse`.
  - `pending-payments.ts`: o contrato da E13 (abaixo).
- Porta pública `payments/public/pending-payments.ts` (abaixo).
- `errorCodeSchema` e `errorStatus` (`packages/schemas/src/api/problem.ts`) ganham os três códigos novos (D9), que a RFC-004 §6 já lista (aprovado pelo Joel em 21/11).

Fora: confirmar e estornar (F03, F04); descartar pagamento lançado por engano (rejeitar, F04: E11-T16 e E11-T17); comprovante (v1.1); consulta e tela de alertas (E13).

## Contrato para a E13 (RF-50)

A E13 consome só isto; o que está aqui não muda sem aviso (só entram campos opcionais).

`packages/schemas/src/api/payments/pending-payments.ts`, exportado de `@pilla/schemas`:

```ts
export const pendingPaymentSchema = z.strictObject({
  id: idSchema,
  loanId: idSchema,
  personId: idSchema,
  accountId: idSchema,
  paidAt: isoDateSchema,            // data do pagamento informada
  amountCents: positiveCentsSchema,
  method: paymentMethodSchema,
  registeredAt: z.iso.datetime({ offset: true }), // created_at, instante com fuso
});
export type PendingPayment = z.infer<typeof pendingPaymentSchema>;

export const pendingPaymentsSummarySchema = z.strictObject({
  count: z.int().nonnegative(),   // todos os PENDING_REVIEW, não só a página
  totalCents: centsSchema,             // soma dos valores de todos os PENDING_REVIEW
  items: z.array(pendingPaymentSchema),
});
export type PendingPaymentsSummary = z.infer<typeof pendingPaymentsSummarySchema>;
```

`apps/api/src/payments/public/pending-payments.ts`:

```ts
export type { PendingPayment, PendingPaymentsSummary } from "@pilla/schemas";
export function listPendingReviewPayments(
  db: Database,
  opts?: { readonly limit?: number }, // padrão 50, máximo 200
): Promise<PendingPaymentsSummary>;
```

Garantias:
- Só linhas PENDING_REVIEW, qualquer contrato (inclusive DRAFT), do mais antigo (`created_at`, depois `id`) para o mais novo.
- `count` e `totalCents` cobrem todas as pendentes; `items` respeita `limit`.
- Só ids e valores (sem nome de pessoa nem número do contrato): a E13 enriquece por `people/public` e `lending/public.findLoanNumbers`. Objetos simples, sem linha do Drizzle; `payments/public` não importa `lending`, `people` nem `treasury`.
- O tipo em `payments/public` vem de `@pilla/schemas` (mesma forma que a E13 valida na resposta do painel).
- Leitura pura (nada gravado), usa o índice `payments_pending_review_idx`. `isRecovery` e a data do contrato não entram no contrato: se a E13 precisar, acrescenta-se campo opcional.
- Coberto por `pending-payments.test.ts`, que a E13 não pode quebrar.

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `loanId` | UUID | - | - | "x" | 400; inexistente 404 | RFC-004 §2 |
| `accountId` | UUID de conta ativa | - | - | inexistente, inativa | 422 `VALIDATION_FAILED` em `accountId` | RN-T04, E10 D5 |
| `paidAt` | `AAAA-MM-DD` | `disbursedAt` (fora de DRAFT) | hoje em Brasília | futura, anterior ao desembolso | 422 em `paidAt` | RN-E02 |
| `amountCents` | inteiro positivo | 1 | saldo em `paidAt` (ACTIVE, WRITTEN_OFF); sem teto em DRAFT | 0, -5, 1.5 | 400; acima 422 `PAYMENT_EXCEEDS_BALANCE` | ADR-0004, RN-R03 |
| `method` | `PIX`, `BOLETO`, `CASH`, `BANK_TRANSFER` | - | - | "TED", "pix" | 400 | glossário |
| `Idempotency-Key` | texto não vazio, até 100 caracteres | 1 | 100 | "" | 400 | RFC-004 §2 |
| chaves extras (`destinationKey`, `receiptAttachmentId`, `channel`...) | - | - | - | qualquer | 400 `VALIDATION_FAILED` | schema estrito |

## Critérios de aceite
- A1: o registro responde 201 PENDING_REVIEW, `version` 1, `personId` copiado do contrato, canal ADMIN.
- A2: grava uma linha de auditoria na mesma transação.
- A3: não grava alocação nem evento no outbox (RN-R01).
- A4: o saldo do contrato (`GET /loans/{id}`) não muda.
- A5: `paymentResponse` traz `allocations` vazio e `loanStatus`.
- A6: em DRAFT o pagamento é aceito como PENDING_REVIEW e não aloca nada (decisão de 20/11).
- A7: em WRITTEN_OFF o pagamento é aceito (RN-C20).
- A8: contrato inexistente dá 404.
- A9: conta inexistente ou inativa dá 422 em `accountId`.
- A10: valor acima do saldo (ACTIVE) dá 422 `PAYMENT_EXCEEDS_BALANCE`.
- A11: PAID_OFF, RENEWED, RENEGOTIATED e CANCELLED dão 422 `LOAN_CLOSED_FOR_PAYMENTS`, com `successorLoanId` quando houver (RN-R09).
- A12: `paidAt` anterior ao desembolso ou futura dá 422 em `paidAt`.
- A13: chave desconhecida, `destinationKey` e `receiptAttachmentId` dão 400; nada é gravado em nenhuma recusa.
- A14: a mesma `Idempotency-Key` devolve o mesmo pagamento e cria uma linha só (D8).
- A15: `GET /payments` filtra por `status` e `loanId`, pagina por cursor sem repetir itens e traz `loanNumber` e `personName`.
- A16: a fila PENDING_REVIEW sai do mais antigo para o mais novo.
- A17: `listPendingReviewPayments` devolve só PENDING_REVIEW, do mais antigo para o mais novo.
- A18: `count` e `totalCents` cobrem todas as pendentes, não só a página.
- A19: `limit` vale (padrão 50, máximo 200); a porta devolve objetos simples e passa no depcruise.
- A20: os schemas da seção "Contrato para a E13" e `createPaymentRequest` passam nos testes de schema.

## Casos de teste
- C1 a C6: registro feliz (campos, auditoria, sem alocação nem evento, saldo intacto, resposta, método CASH sem comprovante).
- C7, C8: DRAFT e WRITTEN_OFF.
- C9 a C16: recusas (contrato inexistente, conta inexistente e inativa, acima do saldo, quatro status fechados, data, chaves extras), cada uma conferindo que nada foi gravado.
- C17, C18: idempotência com e sem chave.
- C19 a C22: lista (filtros, ordem, cursor, nomes).
- C23 a C27: porta (só pendentes, ordem, totais acima do limite, limite padrão e máximo, objetos simples).
- C28 a C31: schemas.

## Riscos
- Mudar o contrato da E13 depois: os campos estão fixos acima; qualquer mudança passa pela E13.
- Duas requisições com a mesma chave ao mesmo tempo: a violação de `payments_idempotency_key_key` relê a linha e responde igual.
- Soma dos pendentes maior que o saldo: tratada na confirmação (D7).
