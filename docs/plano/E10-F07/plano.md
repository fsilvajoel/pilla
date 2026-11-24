# E10-F07: baixa como perda

Plano da feature. Cartões: E10-T13 (testes, bia) e E10-T14 (implementação, baidu). Referências: PRD-001 RF-16, RFC-004 §3 e §7, ADR-0006, RN-C19.

## Escopo

Entra:
- `POST /api/v1/loans/{id}/write-off` (`writeOffLoanRequest`: `reason`), com `If-Match`.
- O contrato ACTIVE vira WRITTEN_OFF, com `write_off_reason` e `status_changed_at`.
- Grava a auditoria e o `LoanWrittenOff` no outbox, com `outstandingPrincipalCents` igual ao principal em aberto.

Fora: o efeito contábil (consumidor na E12).

## Critérios de aceite
- A1: a baixa responde 200 e o contrato fica WRITTEN_OFF.
- A2: o motivo é gravado.
- A3: o evento é gravado com o principal em aberto.
- A4: as recusas funcionam:
  - motivo vazio dá 400 `VALIDATION_FAILED`;
  - contrato fora de ACTIVE dá 409;
  - versão errada dá 409.

## Casos de teste
- C1 a C4: caminho feliz e evento.
- C5 a C7: recusas.

## Contrato

`POST /loans/{id}/write-off`, `If-Match`, corpo `writeOffLoanRequest` `{reason}` (`reasonSchema`, texto útil). Resposta 200 com o contrato WRITTEN_OFF. Evento `LoanWrittenOff` (`packages/schemas/src/events/loan-written-off.ts`) com `outstandingPrincipalCents` = principal em aberto (da F05). Regra: RN-C19 (justificativa obrigatória; o saldo deixa de ser cobrado e de contar como capital emprestado).

## Domínio das entradas

| Entrada | Aceito | Rejeitado | Erro | Fonte |
|---|---|---|---|---|
| `reason` | texto com 1 caractere útil ou mais | vazio, só espaços | 400 `VALIDATION_FAILED` em `reason` | RN-C19 |
| status | ACTIVE | demais | 409 `LOAN_NOT_EDITABLE` | RFC-004 §3 |
| `If-Match` | versão atual | outra | 409 `VERSION_CONFLICT` | D9 |

## Dependências

F05 (principal em aberto). Corre em paralelo com F06. Destrava F09 e F10.

## Riscos

- Baixa é irreversível no MVP: a tela (F09) exige o motivo e confirmação.
- Nada é gravado na recusa (nem auditoria nem outbox).
