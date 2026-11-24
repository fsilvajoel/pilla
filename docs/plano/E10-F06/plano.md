# E10-F06: renovar e renegociar

Plano da feature. Cartões: E10-T11 (testes, claude Opus) e E10-T12 (implementação, claude Sonnet). Referências: PRD-001 RF-13 e RF-14, RFC-004 §3, §6 e §7, `docs/plano/E10.md` D8, RN-C13 a RN-C18.

## Escopo

Entra:
- `POST /api/v1/loans/{id}/renew`:
  - só para contrato ACTIVE, com juros e encargos vencidos pagos (senão, 422 `RENEWAL_REQUIRES_INTEREST_PAID`);
  - cria um novo DRAFT com `origin_type` RENEWAL, `origin_loan_id` e principal igual ao principal em aberto.
- `POST /api/v1/loans/{id}/renegotiate`:
  - cria um novo DRAFT com `origin_type` RENEGOTIATION;
  - o principal é o saldo devedor na data;
  - grava `capitalized_amount_cents` = saldo − principal em aberto.
- Novos schemas `renewLoanRequest` e `renegotiateLoanRequest`: `firstDueDate` obrigatório, mais ajustes de taxa, prazo e frequência.
- A origem continua ACTIVE até a ativação do novo contrato (F04). Cancelar o novo não mexe na origem (D8).

Fora:
- Ledger e pagamento (renovação não tem desembolso).
- Telas (F09).

## Critérios de aceite
- A1: a renovação responde 201 com um novo DRAFT de RENEWAL.
- A2: o principal do novo contrato é o principal em aberto da origem.
- A3: juros ou encargos em aberto dão 422.
- A4: a origem continua ACTIVE.
- A5: a renegociação responde 201 com um novo DRAFT de RENEGOTIATION.
- A6: o principal do novo contrato é o saldo na data.
- A7: `capitalized_amount_cents` está correto.
- A8: origem fora de ACTIVE dá 409. Não há escrita no outbox, no ledger nem em pagamentos.
- A9: os schemas validam os campos.

## Casos de teste
- C1 a C7: renovação.
- C8 a C12: renegociação.
- C13 e C14: origem inválida.
- C15 a C18: schemas.

## Contrato

Schemas existentes: `renewLoanRequest` e `renegotiateLoanRequest` (`firstDueDate` obrigatório; `monthlyInterestRateBps`, `installmentCount`, `frequency` opcionais; estritos). Resposta 201 com o novo DRAFT (mesmo formato da criação). `POST /loans/{id}/renew` e `/renegotiate` exigem `If-Match` da origem. Eventos `LoanRenewed` e `LoanRenegotiated` só saem na ativação do novo (F04), não aqui.

## Domínio das entradas

| Entrada | Aceito | Rejeitado | Erro | Fonte |
|---|---|---|---|---|
| origem | ACTIVE | os demais | 409 `LOAN_NOT_EDITABLE` | RFC-004 §3 |
| juros e encargos vencidos (renovar) | todos pagos | algum em aberto | 422 `RENEWAL_REQUIRES_INTEREST_PAID` | RN-C14 |
| `firstDueDate` | AAAA-MM-DD | ausente ou inválido | 400 `VALIDATION_FAILED` | RN-C15 |
| ajustes | taxa em bps, prazo inteiro positivo, periodicidade válida | chave desconhecida | 400 | RN-C15, RN-C17 |

Renovar: principal do novo = principal em aberto (RN-C15). Renegociar: principal do novo = saldo devedor na data, `capitalized_amount_cents` = saldo menos principal em aberto (RN-C17).

## Dependências

F05 (saldo e principal em aberto) e F04 (ativação fecha o ciclo). Destrava F09.

## Riscos

- Renovação com pagamento parcial de juros é recusada; o caminho é a renegociação (RN-C14).
- Os testes de ativação (F04) são protegidos nesta feature: a mudança de origem na ativação não pode regredir.
- Fluxo de duas etapas (DRAFT agora, origem muda na ativação): ver D8 de `E10.md`.
