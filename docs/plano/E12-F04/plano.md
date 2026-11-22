# E12-F04: painel da tesouraria

Plano da feature. Cartões: E12-T13 (testes de schema, bia), E12-T07 (testes HTTP e da porta, claude Opus) e E12-T08 (implementação, claude Sonnet). Referências: PRD-001 RF-32, RN-T01, RN-C10, RFC-004 §3, RFC-005 §6, ADR-0004, ADR-0005, `docs/plano/E12.md` D5, D7 e D8, `docs/plano/E13.md` (mesmas leituras de `loan-assessment.ts`), `docs/plano/pendencias-pm.md` (E12-T07).

## Escopo

Entra:
- `GET /api/v1/treasury/summary?month=YYYY-MM` (padrão: mês corrente em Brasília) → 200 `treasurySummaryResponse`
  (novo em `packages/schemas/src/api/treasury/treasury-summary.ts`):
  - `month`; `cashCents` (soma de todos os lançamentos das contas ativas, porta `account-balance.ts` da F03);
  - `lentCents`: principal em aberto (principal das parcelas menos o principal alocado e não estornado) dos contratos
    ACTIVE;
  - `committedBps` = `floor(lentCents * 10000 / (cashCents + lentCents))` e `availableBps` = `10000 - committedBps`;
    ambos nulos se `cashCents + lentCents <= 0`; `maxCommittedBps` da conta base (pode ser nulo; só exibido);
  - do mês (`entry_date` no mês): `interestReceivedCents` = soma de INTEREST (REPAYMENT e REVERSAL),
    `lateChargesReceivedCents` = idem LATE_CHARGES, `recoveredCents` = idem RECOVERY;
  - `lossesCents`: principal em aberto dos contratos WRITTEN_OFF (total, não do mês);
  - `forecastCents`: principal mais juros em aberto das parcelas de contratos ACTIVE com vencimento no mês (as já
    vencidas do mês entram; sem encargos de mora).
- Porta nova `apps/api/src/lending/public/portfolio-figures.ts`: `portfolioFigures(db, { monthStart, monthEnd })` →
  `{ activeOutstandingPrincipalCents, writtenOffOutstandingPrincipalCents, forecastCents }`, montada com as leituras de
  `lending/infra/loan-queries.ts` e `openInstallments` de `loan-assessment.ts` (sem copiar a conta).
- Controller e serviço em `apps/api/src/treasury` (`treasury-summary.controller.ts`, `application/treasury-summary.ts`).

Fora: `loan_positions` (decisão de 20/11); bloqueio por `max_committed_bps`; gráfico histórico; indicadores por conta;
inadimplência (é do painel de alertas, E13).

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `month` | YYYY-MM, opcional | 2000-01 | - | "2027-13", "2027-1", "01/2027" | 400 `VALIDATION_FAILED` | D7 |

## Critérios de aceite

- A1: base vazia: todos os valores 0 e `committedBps`/`availableBps` nulos.
- A2: depois de um aporte de 100.000,00 e de ativar um contrato de 30.000,00: `cashCents` 7.000.000,
  `lentCents` 3.000.000, `committedBps` 3000, `availableBps` 7000.
- A3: confirmar um pagamento reduz `lentCents` só pelo principal pago, soma o principal e os juros ao caixa, e
  `interestReceivedCents` e `lateChargesReceivedCents` do mês sobem pelos componentes pagos.
- A4: estornar o pagamento desfaz A3 no mês do estorno (juros do mês voltam).
- A5: baixar um contrato tira o principal dele de `lentCents` e põe em `lossesCents`; recebimento de recuperação soma em
  `recoveredCents` e no caixa e não mexe em `interestReceivedCents`.
- A6: `forecastCents` soma principal e juros em aberto das parcelas ACTIVE com vencimento no mês; parcela paga não
  entra; parcela parcialmente paga entra pelo que falta; contrato DRAFT, PAID_OFF e WRITTEN_OFF não entram.
- A7: `month` de outro mês muda só os indicadores do mês e a previsão; caixa, emprestado e perdas são de agora.
- A8: `cashCents + lentCents <= 0` dá percentuais nulos.
- A9: `month` inválido dá 400.
- A10: a porta `portfolioFigures` dá os mesmos números que a soma de `outstandingCents` do detalhe de cada contrato
  (principal) para uma carteira com contratos em vários estados.
- A11: nada é gravado (ADR-0005).
- A12: `treasurySummaryResponse` exige inteiros, `committedBps` e `availableBps` entre 0 e 10000 ou nulos e
  somando 10000 quando presentes, `month` YYYY-MM, e recusa chave desconhecida.

## Casos de teste

- `apps/api/src/treasury/http/treasury-summary.http.test.ts` (fluxo pela API e `dispatchOutbox`): C1 vazio; C2 aporte
  e ativação; C3 pagamento; C4 estorno; C5 baixa e recuperação; C6 outro mês; C7 percentuais nulos; C8 a C10 `month`
  inválido.
- `apps/api/src/lending/public/portfolio-figures.test.ts` (PGlite): C11 a C15 principal em aberto por estado,
  parcial, previsão do mês, contrato renovado fora.
- `packages/schemas/src/api/treasury/treasury-summary.test.ts`: C16 a C20.

## Riscos

- Conta de `lentCents` e `lossesCents` cruza lending e payments; só pela porta pública de lending, que já usa
  `confirmedAllocationsByLoan` de payments (sem ciclo).
- O caixa depende do poller; nos testes, sempre `dispatchOutbox` antes de ler.
- Definições de previsão, período, perdas e juros: pendências de PM com padrão; mudar uma muda um critério e um teste.

## Dependências

E12-T06 (`account-balance.ts`); E12-T02 (ledger por eventos). Destrava F05.
