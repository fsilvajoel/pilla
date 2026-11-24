# Revisão E12-F02 (lançamento manual)

revisor: claude Opus (revisão final da E12, 23/11). Referências conferidas: PRD-001 RF-30, RN-T01 e RN-T04,
`docs/plano/E12.md` D4, plano A1 a A11.

## Revisão dos testes (etapa 3): APROVADO
- `apps/api/src/treasury/http/account-entries.http.test.ts` C1 a C16 cobrem A1 a A10: sinais por tipo, auditoria,
  idempotência (mesma chave e chave diferente), data de hoje tarde da noite em Brasília, data futura, conta inexistente
  e inativa, recusas do corpo via `it.each` (linha 271) sem gravar nada, retirada acima do saldo.
- `packages/schemas/src/api/treasury/account-entry.test.ts` C17 a C20 cobrem A11. Schemas: 68 testes verdes.

## Revisão final (etapa 6), rodada 1: APROVADO COM RESSALVAS
Conforme D4: sinal pelo tipo, ajuste com justificativa, 400 em data futura
(`apps/api/src/treasury/application/create-account-entry.ts:79`), 404 e 400 de conta, auditoria
`ledger_entry.created` só na primeira gravação (`ledger-repository.ts`, `insertEntryWithAudit`), chave única no banco
(migração `0001_ledger_idempotency_key.sql`).

Bloqueantes: nenhum.

Não bloqueantes (registrados em [D6](../../defeitos/D6.md)):
1. `apps/api/src/treasury/application/create-account-entry.ts:72-75`: o replay da `Idempotency-Key` devolve o
   lançamento existente sem conferir `accountId` nem corpo; a mesma chave em outra conta responde 201 com o lançamento
   da primeira. Mesmo padrão de `payments`; esperado seria 409 ou 422 em chave reaproveitada com corpo diferente.
2. `apps/api/src/treasury/http/accounts.controller.ts:20` aceita chave de até 200 caracteres; `payments.controller.ts:23`
   aceita 100. Sem regra escrita; alinhar.
3. Auditoria com `actorId` nulo e `createdBy` provisório (`PROVISIONAL_ACTOR_ID`), como nas demais features antes da
   sessão de admin ligar o ator real.

Processo: `estado.json` sem `criteria`, `scenarios` e `testShas`; gates `tests-reviewed`, `coverage`, `mutation` e
`e2e` sem PASS registrado.
