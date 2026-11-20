# Testes da feature E6-F01

| Cenário | Descrição | Critério | Teste |
|---|---|---|---|
| C1 | frequencyOf das quatro opções | A3 | C1 (A3): gives DAY 7 for WEEKLY |
| C1 | frequencyOf das quatro opções | A3 | C1 (A3): gives DAY 15 for BIWEEKLY |
| C1 | frequencyOf das quatro opções | A3 | C1 (A3): gives MONTH 1 for MONTHLY |
| C1 | frequencyOf das quatro opções | A3 | C1 (A3): gives MONTH 2 for BIMONTHLY |
| C2 | simulate do exemplo da RFC-004 §5 com desembolso em 2026-11-14 | A1 | C2 (A1): RFC-004 §5 example gives interest 190000n total 690000n installmentAmount 115000n |
| C2 | simulate do exemplo da RFC-004 §5 com desembolso em 2026-11-14 | A1 | C2 (A1): RFC-004 §5 example schedule has length 6 and first line matches |
| C3 | simulate do CA-11 | A2 | C3 (A2): CA-11 gives installmentAmount 27500n and total 110000n |
| C4 | simulate com 1º vencimento igual ao desembolso lança erro (RN-C04) | A6 | C4 (A6): throws DueDateError when firstDueDate equals disbursementDate |
| C5 | toSimulateRequest do exemplo da RFC-004 §5 e do CA-11 | A4 | C5 (A4): RFC-004 §5 form gives expected SimulateLoanRequest |
| C5 | toSimulateRequest do exemplo da RFC-004 §5 e do CA-11 | A4 | C5 (A4): CA-11 form gives expected SimulateLoanRequest |
| C6 | toSimulateRequest com valor sem vírgula ou 0 parcelas lança erro | A4 | C6 (A4): amount without comma throws MoneyError |
| C6 | toSimulateRequest com valor sem vírgula ou 0 parcelas lança erro | A4 | C6 (A4): installmentCount zero throws ZodError |

Reparos em lote: 0. Checks: todos verdes

Arquivos (sha do blob):
- `apps/web/lib/simulation-form.test.ts` 46cffa50156713f5a8d3072c154290e3267cb3a7
- `apps/web/lib/simulation.test.ts` 01e4d34d627438824b4d89709448791b53964198
