# Testes E6-F02

| Cenário | Critério | Camada | Arquivo | Teste |
|---|---|---|---|---|
| C1 | A1 | unit | apps/web/components/loan-simulation.test.tsx | C1 (A1): shows the five labelled fields, the four frequency options and the Simular button |
| C2 | A2 | unit | apps/web/components/loan-simulation.test.tsx | C2 (A2): RFC-004 §5 example shows R$ 6.900,00, R$ 1.900,00 and 6 × R$ 1.150,00 |
| C3 | A2 | unit | apps/web/components/loan-simulation.test.tsx | C3 (A2): RFC-004 §5 example shows 6 rows and the first is 1, 14/12/2026, 833,33, 316,67, 1.150,00 |
| C4 | A2 | unit | apps/web/components/loan-simulation.test.tsx | C4 (A2): CA-11 shows 4 × R$ 275,00 and R$ 1.100,00 |
| C5 | A3 | unit | apps/web/components/loan-simulation.test.tsx | C5 (A3): amount 5000 without comma shows the alert and no result |
| C6 | A3 | unit | apps/web/components/loan-simulation.test.tsx | C6 (A3): rate 6 without comma shows the alert and no result |
| C7 | A3 | unit | apps/web/components/loan-simulation.test.tsx | C7 (A3): installment count 0 shows the alert and no result |
| C8 | A3 | unit | apps/web/components/loan-simulation.test.tsx | C8 (A3): first due date equal to disbursement date shows the alert |
| C9 | A3 | unit | apps/web/components/loan-simulation.test.tsx | C9 (A3): empty first due date shows the alert |
| C10 | A4 | e2e | apps/web/e2e/loan-simulation.e2e.ts | C10 (A4): /emprestimos/simular shows the RFC-004 §5 summary |
| C11 | A4 | e2e | apps/web/e2e/loan-simulation.e2e.ts | C11 (A4): /emprestimos/simular shows the alert for a past first due date |

## Checklist de bordas
A tela não acrescenta regra (plano, "Domínio das entradas"): toda rejeição vem de `toSimulateRequest` e
`simulateLoanRequest`, cujas bordas são testadas na E6-F01 (`simulation-form.test.ts`, `simulation.test.ts`; D1 a D3
registrados lá). Aqui basta uma rejeição por campo editável chegando ao alerta.

| Entrada | Vazio | Só espaços | Espaços em volta | 1e1 | Separador | Negativo | Zero | Limite | Limite+1 | Muito grande | Caractere inválido |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Valor emprestado | n/a: E6-F01 | n/a: E6-F01 | n/a: E6-F01 | n/a: E6-F01 | C5 | n/a: E6-F01 | n/a: E6-F01 | n/a: E6-F01 | n/a: sem teto | n/a: sem teto | n/a: E6-F01 |
| Taxa ao mês (%) | n/a: E6-F01 | n/a: E6-F01 | n/a: E6-F01 | n/a: E6-F01 | C6 | n/a: E6-F01 | n/a: E6-F01 | n/a: E6-F01 | n/a: sem teto (D2) | n/a: sem teto | n/a: E6-F01 |
| Nº de parcelas | n/a: E6-F01 | n/a: E6-F01 | n/a: D1 (E6-F01) | n/a: D1 (E6-F01) | n/a: E6-F01 | n/a: E6-F01 | C7 | n/a: E6-F01 | n/a: sem teto | n/a: sem teto | n/a: E6-F01 |
| Periodicidade | n/a: select fechado | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| 1º vencimento | C9 | n/a: input date | n/a: input date | n/a: input date | n/a: input date | n/a | n/a | C8 (igual ao desembolso); C11 (passado) | n/a: E6-F01 | n/a: E6-F01 | n/a: input date |
| `disbursementDate` (prop) | n/a: tipo `IsoDate` | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## Arquivos de teste
- apps/web/components/loan-simulation.test.tsx (unit)
- apps/web/e2e/loan-simulation.e2e.ts (e2e)

## Expect-red
`pnpm gate expect-red E6-F02`: PASS, 9 teste(s), todos falhando com `Error: not implemented` (esboço de
`LoanSimulation`). O e2e (C10, C11) falha hoje porque `page.tsx` chama `todayInBrt`, ainda esboço (E7-F01); esperado
até a E7-F01 ser entregue.
