# Testes da feature E6-F01

Escritos pela Bia numa chamada (etapa 2, ADR-0014).

| Cenário | Descrição | Cartão | Teste |
|---|---|---|---|
| C1 | frequencyOf das quatro opções | E6-T01 | gives DAY 7 for WEEKLY |
| C1 | frequencyOf das quatro opções | E6-T01 | gives DAY 15 for BIWEEKLY |
| C1 | frequencyOf das quatro opções | E6-T01 | gives MONTH 1 for MONTHLY |
| C1 | frequencyOf das quatro opções | E6-T01 | gives MONTH 2 for BIMONTHLY |
| C2 | simulate do exemplo da RFC-004 §5 com desembolso em 2026-11-14 | E6-T01 | RFC-004 §5 example gives interest 190000n total 690000n installmentAmount 115000n |
| C2 | simulate do exemplo da RFC-004 §5 com desembolso em 2026-11-14 | E6-T01 | RFC-004 §5 example schedule has length 6 and first line matches |
| C3 | simulate do CA-11 | E6-T01 | CA-11 gives installmentAmount 27500n and total 110000n |
| C4 | simulate com 1º vencimento igual ao desembolso lança erro (RN-C04) | E6-T01 | throws DueDateError when firstDueDate equals disbursementDate |
| C5 | toSimulateRequest do exemplo da RFC-004 §5 e do CA-11 | E6-T03 | RFC-004 §5 form gives expected SimulateLoanRequest |
| C5 | toSimulateRequest do exemplo da RFC-004 §5 e do CA-11 | E6-T03 | CA-11 form gives monthlyInterestRateBps 1000 and frequency DAY 7 |
| C6 | toSimulateRequest com valor sem vírgula ou 0 parcelas lança erro | E6-T03 | amount without comma throws MoneyError |
| C6 | toSimulateRequest com valor sem vírgula ou 0 parcelas lança erro | E6-T03 | installmentCount zero throws ZodError |

Reparos em lote: 0. Checks: todos verdes

Arquivos (sha do blob):
- `apps/web/lib/simulation-form.test.ts` e9d4cc8df2777967043fd5a9241731c0e2b01493
- `apps/web/lib/simulation.test.ts` 3a6688e5d47668f003d91d5c1bdffadd098acc8a
