# E12-F01: despachante do outbox e lançamentos automáticos no ledger

Plano da feature. Cartões: E12-T01 (testes, claude Opus) e E12-T02 (implementação, claude Sonnet). Referências: PRD-001 RN-T02 e RN-T03, RFC-004 §7, RFC-005 §2 e §6, ADR-0003, ADR-0004, ADR-0006, `docs/plano/E10.md` D6 e D7, `docs/plano/E12.md` D1 a D3 e D8, `docs/plano/pendencias-pm.md` (E12-T01).

## Escopo

Entra:
- `apps/api/src/core/infra/outbox-dispatcher.ts` (novo, genérico, sem saber de tesouraria):
  1. lê até 100 linhas de `core.outbox` com `published_at` nulo e `attempts < 5`, ordem `occurred_at`, `id`;
  2. para cada evento abre uma transação; para cada consumidor cujo `eventTypes` contém o `event_type`, grava
     `core.processed_events (consumer, event_id)` com `ON CONFLICT DO NOTHING`; se a linha já existia pula o consumidor,
     senão chama `handle(tx, event)`;
  3. depois de todos os consumidores, grava `published_at = now`; evento sem consumidor interessado também é marcado;
  4. se um consumidor lança erro: rollback do evento inteiro, depois `attempts + 1` e `last_error` (até 500 caracteres)
     em transação à parte; o lote segue com o próximo evento;
  5. devolve `{ published, failed }` (contagens).
- `apps/api/src/core/infra/outbox-poller.ts` (novo): provider Nest; em `onApplicationBootstrap` agenda
  `dispatchOutbox` a cada `OUTBOX_POLL_INTERVAL_MS = 2000` (constante); não inicia outra rodada enquanto uma está em
  curso; em `onModuleDestroy` cancela o intervalo. Consumidores pelo token `OUTBOX_CONSUMERS` (core).
- `apps/api/src/core/infra/system-actor.ts` (novo): `SYSTEM_ACTOR_ID`, UUID v7 fixo do ator "sistema".
- `apps/api/src/treasury/application/ledger-consumer.ts` (novo): consumidor `treasury-ledger` com as regras abaixo;
  `apps/api/src/treasury/public/outbox-consumers.ts` (novo) exporta `treasuryOutboxConsumers`; `app.module.ts`
  registra o poller e liga o token à lista.
- Regras do consumidor (D3), sempre na `accountId` do payload, `created_by = SYSTEM_ACTOR_ID`, `source_event_id` = id
  do evento:
  - `LoanActivated` sem `originType` ou com IMPORT → DISBURSEMENT, PRINCIPAL, `-principalCents`, LOAN, `loanId`,
    `entry_date = disbursedAt`. RENEWAL ou RENEGOTIATION → nada.
  - `PaymentConfirmed` sem `isRecovery` → REPAYMENT, PAYMENT, `paymentId`, `entry_date = paidAt`, um lançamento por
    componente (LATE_CHARGES, INTEREST, PRINCIPAL) com a soma das alocações; componente com soma zero não gera linha.
  - `PaymentConfirmed` com `isRecovery` → um REPAYMENT componente RECOVERY de `amountCents`.
  - `PaymentReversed` → para cada REPAYMENT com `source_type = PAYMENT` e `source_id = paymentId`, um REVERSAL com o
    mesmo componente e `-amount_cents`, mesma conta, `entry_date` = hoje em Brasília. Sem REPAYMENT do pagamento: erro
    (o evento volta a ser tentado).
  - Payload que não passa no schema do evento (`packages/schemas/src/events`): erro.
  - Qualquer outro tipo: o consumidor não se inscreve.

Fora: lançamentos manuais (F02); leitura de saldo (F03); publicação para fora do processo (fila externa); tela de
eventos parados; reprocessamento automático depois de 5 tentativas (manual: zerar `attempts`).

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `event_type` | texto | - | - | tipo sem consumidor | nenhum: marcado publicado | RFC-004 §7 |
| `payload` | JSON do schema v1 do tipo | - | - | campo faltando, valor não inteiro | falha: `attempts + 1`, `last_error` | RFC-004 §7, ADR-0004 |
| `attempts` | inteiro | 0 | 4 para ser lido | ≥ 5 | não é lido | D1 |
| lote | linhas por rodada | 1 | 100 | - | o resto fica para a próxima rodada | D1 |
| `originType` | RENEWAL, RENEGOTIATION, IMPORT ou ausente | - | - | outro (barrado pelo schema) | falha | RFC-004 §7 |

## Critérios de aceite

- A1: `LoanActivated` sem `originType` gera um DISBURSEMENT PRINCIPAL de `-principalCents`, `source_type` LOAN,
  `source_id` = `loanId`, `entry_date` = `disbursedAt`, `created_by` = `SYSTEM_ACTOR_ID`, na conta do evento.
- A2: com `originType` RENEWAL ou RENEGOTIATION nenhum lançamento é gravado e o evento fica publicado.
- A3: com `originType` IMPORT o DISBURSEMENT é gravado (padrão da pendência de PM).
- A4: `PaymentConfirmed` com várias alocações gera REPAYMENT por componente com a soma de cada um; a soma dos
  lançamentos é `amountCents`; componente zero não gera linha.
- A5: `PaymentConfirmed` com `isRecovery` gera um único REPAYMENT RECOVERY de `amountCents`.
- A6: `PaymentReversed` gera um REVERSAL por REPAYMENT do pagamento, com o mesmo componente e valor oposto, datado de
  hoje em Brasília; a soma dos lançamentos do pagamento volta a zero.
- A7: `PaymentReversed` sem REPAYMENT do pagamento não grava nada, soma 1 em `attempts`, grava `last_error` e não marca
  `published_at`; numa rodada seguinte, já com o REPAYMENT, o REVERSAL é gravado.
- A8: `LoanWrittenOff`, `LoanPaidOff`, `LoanReopened`, `InstallmentPaid` e tipo desconhecido não geram lançamento e
  ficam publicados.
- A9: rodar o despachante duas vezes não duplica lançamento; zerar `published_at` de um evento já consumido e rodar de
  novo também não (`processed_events`).
- A10: payload inválido falha só aquele evento; os demais do lote são publicados; depois de 5 falhas o evento não é mais
  lido.
- A11: a ordem é `occurred_at`; uma rodada lê no máximo 100 eventos.
- A12: um erro no meio do `handle` não deixa lançamento parcial (rollback do evento) nem linha em `processed_events`.
- A13: o poller chama o despachante no intervalo, não sobrepõe rodadas e para ao fechar o app.
- A14: fluxo real: ativar um contrato e confirmar um pagamento pela API e rodar o despachante deixa o saldo da conta
  igual a `-principal + pago`; estornar e rodar de novo devolve o saldo a `-principal`.

## Casos de teste

- `apps/api/src/core/infra/outbox-dispatcher.test.ts` (PGlite, consumidores falsos): C1 a C3 publicação, evento sem
  consumidor; C4, C5 reentrega e `processed_events`; C6 a C8 falha, `attempts`, `last_error`, limite de 5; C9 rollback
  sem `processed_events`; C10 ordem e lote de 100; C11, C12 poller com relógio falso (intervalo, sem sobreposição,
  parada).
- `apps/api/src/treasury/application/ledger-consumer.test.ts` (PGlite, eventos gravados com `writeOutboxEvent` e
  `dispatchOutbox`): C13 a C15 desembolso (novo, renovação, renegociação, importado); C16 a C18 recebimento por
  componente, componente zero, recuperação; C19, C20 estorno e estorno antes do recebimento; C21 tipos ignorados; C22
  payload inválido.
- `apps/api/src/treasury/http/ledger-from-events.http.test.ts` (fluxo pela API): C23, C24 ativar, confirmar, estornar.

## Riscos

- O estorno é datado no dia do processamento, não no dia do estorno; com o poller a 2 s, só difere perto da meia-noite.
  Aceito.
- Evento antigo no outbox de bases de teste será consumido na primeira rodada.
- Payload inválido parado no outbox é sinal de defeito do produtor; aparece no log de erro.

## Dependências

E11-T06 e E11-T08 (`PaymentConfirmed` e `PaymentReversed` no outbox); E10 ativação (`LoanActivated`); `core.processed_events`
(migração `core/0000_outbox.sql`). Destrava F02, F03 e F04.
