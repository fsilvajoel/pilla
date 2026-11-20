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
