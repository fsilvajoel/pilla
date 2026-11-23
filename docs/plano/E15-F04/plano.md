# E15-F04: leituras do portal (lista e detalhe), isolamento e vazamento

Plano da feature. Cartões: E15-T07 (testes, **Opus**) e E15-T08 (implementação, Sonnet). Referências: PRD-001 RF-61 a
RF-63, RN-A02, CA-09, ADR-0005, ADR-0007, RFC-004 §4 e §5, `docs/plano/E15.md` D1, D2, D8, D9, D10, D11;
`docs/plano/E10.md` (detalhe e `assessLoan`); `docs/plano/pendencias-pm.md` (E15-T07).

## Escopo

Entra:
- `GET /api/v1/portal/loans` e `GET /api/v1/portal/loans/{id}` em
  `apps/api/src/lending/http/portal-loans.controller.ts`, guardados por `PortalSessionGuard` e `@PortalPerson()` (F02).
- `apps/api/src/lending/application/portal-loans-service.ts`: lista os contratos `ACTIVE` e `PAID_OFF` com
  `person_id = personId da sessão`; detalhe com `WHERE id = :id AND person_id = :personId AND status IN (...)`: o
  filtro **vai na consulta**, não depois. Monta o DTO por whitelist (campo a campo, nunca espalhando a linha).
  Usa `assessLoan`, `confirmedAllocationsByLoan` e `todayInBrasilia`.
- `apps/api/src/payments/public/loan-payments.ts`: `confirmedPaymentsOfLoan(db, loanId)` → `{paidAt, amountCents,
  method}[]`, `CONFIRMED` não estornados, mais antigos primeiro; nada além disso sai do módulo.
- Respostas validadas contra `portalLoanListResponse`/`portalLoanDetailResponse` antes de sair (parse, não só tipo).
- `Cache-Control: no-store`.

Fora: paginação; filtros; contrato `DRAFT`, `CANCELLED`, `RENEWED`, `RENEGOTIATED`, `WRITTEN_OFF` (padrão da
pendência); qualquer escrita; nome da pessoa.

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `id` (caminho) | uuid | - | - | não uuid | 404 (igual ao inexistente) | D10 |
| contrato | da pessoa da sessão, ACTIVE ou PAID_OFF | - | - | de outra pessoa, DRAFT, CANCELLED, outros status, inexistente | 404 `NOT_FOUND`, corpo idêntico | CA-09 |
| cookie | sessão do portal válida | - | - | ausente, vencida, acesso desabilitado | 401 | F02 |
| query string e corpo | nenhum | - | - | `?personId=`, `?cpf=` são ignorados | - | RFC-004 §4 |

## Critérios de aceite

- A1: a lista traz só contratos da pessoa da sessão, `ACTIVE` antes de `PAID_OFF`, `situation` correta (`CURRENT`,
  `OVERDUE`, `PAID_OFF`), `outstandingCents` e `nextDueDate` (nulo no quitado). Pessoa sem contrato: `{items: []}`.
- A2: o detalhe de contrato ACTIVE em dia, ACTIVE em atraso (encargos > 0, parcela `OVERDUE`) e PAID_OFF bate com os
  números do detalhe do ADMIN (`GET /loans/{id}`) na mesma data: `totalCents`, `paidCents`, `outstandingCents`,
  parcelas e encargos.
- A3: `nextInstallment` é a primeira parcela não paga com `amountCents` = total menos o pago; com pagamento parcial
  mostra o que falta; `null` no quitado.
- A4: `payments` só tem `CONFIRMED` não estornado (um `PENDING_REVIEW`, um `REJECTED` e um `REVERSED` semeados não
  aparecem), com `paidAt`, `amountCents`, `method`, mais antigos primeiro.
- A5: CA-09: com a sessão do cliente A, `GET /portal/loans/{id de B}` e `GET /portal/loans/{id inexistente}` dão 404
  com **corpo idêntico**; a lista de A não contém contrato de B; `?personId=` de B na lista não muda nada.
- A6: contrato `DRAFT` ou `CANCELLED` ou `WRITTEN_OFF` de A: 404 para A.
- A7: vazamento (D10 c e d): as chaves do JSON do detalhe e da lista (aninhadas) são exatamente as do schema; o corpo
  serializado não contém o CPF, nome, telefone, e-mail, chave PIX, observação interna nem texto de comprovante
  semeados; nenhum id de pagamento nem de conta aparece.
- A8: sem cookie 401; sessão vencida 401; acesso desabilitado depois do login 401; sessão de ADMIN 401 no portal.
- A9: `POST`, `PUT`, `PATCH`, `DELETE` em `/portal/loans` e `/portal/loans/{id}` não são atendidos (404 ou 405,
  nunca 2xx); nenhuma linha do banco muda depois de uma bateria de leituras (contagem antes e depois).
- A10: o resultado é derivado: nada é gravado por ler (ADR-0005).
- A11: com a data de hoje injetada, parcela vencida ontem já aparece `OVERDUE` e com encargos (mesma regra da E10).

## Casos de teste

`apps/api/src/lending/http/portal-loans.http.test.ts` (PGlite, sessões semeadas direto em `access.sessions` via
helper de teste, pessoas A e B com dados sensíveis semeados): C1..C3 lista; C4..C8 detalhe; C9..C11 isolamento (A5,
A6); C12..C13 vazamento (A7); C14 guarda (A8); C15 somente leitura (A9). `apps/api/src/payments/public/loan-payments.test.ts`:
C16..C18 estados de pagamento e campos.

## Riscos

- Divergência entre o que o ADMIN vê e o que o cliente vê: a A2 compara com o detalhe do ADMIN para pegar.
- Alguém reaproveitar o DTO do ADMIN no futuro: o `strictObject` e a A7 quebram o teste.

## Dependências

F01, F02 (guarda), E10 (`assessLoan`, detalhe), E11 (`CONFIRMED`/`REVERSED`). Destrava F05A, F05B.
