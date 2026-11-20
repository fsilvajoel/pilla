# E10-F03: criar, editar e cancelar rascunho; ler condições padrão

Plano da feature. Cartões: E10-T05 (testes, claude) e E10-T06 (implementação, baidu). Referências: PRD-001 RF-11, RF-17 e RF-41, RFC-004 §3 e §6, ADR-0006, ADR-0008, `docs/plano/E10.md` D1, D9 e D10, RN-C01, RN-C02, RN-C06, RN-C11, RN-C12.

## Escopo

Entra:
- `POST /api/v1/loans`: cria DRAFT com `loanNumber` AAAA-NNNN, tirado de `loan_number_sequences` na mesma transação. Copia para o contrato as três taxas de encargo, o `grace_period_days` (0 por padrão) e o `rounding_step` de `default_terms` (ADR-0008). `account_id` fica nulo. Grava uma linha de auditoria. A resposta traz o aviso de RN-C11: contagem de contratos ativos e atrasados da pessoa.
- `PATCH /api/v1/loans/{id}`: exige `If-Match` com a versão (D9) e funciona só em DRAFT. Usa o schema novo `updateLoanRequest`: parcial dos campos de criação, sem `personId` e estrito.
- `POST /api/v1/loans/{id}/cancel`: DRAFT vira CANCELLED, com `status_changed_at` e auditoria. Não grava no outbox.
- `GET /api/v1/settings/default-terms`: devolve a linha de maior `effective_from`.
- Modalidades aceitas: INSTALLMENT e SINGLE_PAYMENT (D10). As demais dão 422.

Fora: ativar (F04), editar `default_terms` (E13, RF-41), simulação (D2).

## Critérios de aceite
- A1: a criação responde 201 em DRAFT, com o número no formato AAAA-NNNN.
- A2: a criação copia as condições padrão para o contrato.
- A3: `personId` desconhecido dá 422 `VALIDATION_FAILED` no campo `personId`.
- A4: a criação grava uma linha de auditoria.
- A5: o PATCH altera o DRAFT e incrementa a versão.
- A6: versão errada dá 409 `VERSION_CONFLICT`.
- A7: PATCH fora de DRAFT dá 409 `LOAN_NOT_EDITABLE`.
- A8: cancelar um DRAFT o deixa CANCELLED, com auditoria e sem linha no outbox.
- A9: cancelar fora de DRAFT dá 409.
- A10: `GET /settings/default-terms` devolve a linha vigente.
- A11: `updateLoanRequest` recusa `personId` e chaves desconhecidas.

## Casos de teste
- C1 a C8: criação. Feliz, com cópia das taxas, pessoa inexistente, valor zero, prazo inválido, modalidade INTEREST_ONLY (422), sequência de número e aviso RN-C11.
- C9 a C13: PATCH. Feliz, sem If-Match (428 ou 409, conforme a RFC-004 §6), versão errada, ACTIVE e CANCELLED.
- C14 a C16: cancelamento. DRAFT, ACTIVE e auditoria.
- C17: condições padrão com duas vigências.
- C18 a C20: schema `updateLoanRequest`.
