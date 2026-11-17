# Testes da feature E6-F02

Escritos pela Bia numa chamada (etapa 2, ADR-0014).

| Cenário | Descrição | Cartão | Teste |
|---|---|---|---|
| C1 | render mostra os campos e o botão | E6-T05 | shows inputs labelled Valor emprestado, Taxa ao mês (%), Nº de parcelas, Periodicidade, 1º vencimento and a button Simular |
| C2 | preencher o exemplo da RFC-004 §5 e clicar em Simular mostra o resumo | E6-T05 | shows Total a receber, Juros and Parcela for the RFC-004 §5 example |
| C3 | no mesmo resultado, a tabela tem a linha da 1ª parcela | E6-T05 | shows the first installment row with 14/12/2026, 833,33, 316,67 and 1.150,00 |
| C4 | valor 5000 sem vírgula e Simular mostra um elemento com role alert | E6-T05 | shows an alert when amount 5000 without comma is submitted |

Reparos em lote: 0. Checks: todos verdes

Arquivos (sha do blob):
- `apps/web/components/loan-simulation.test.tsx` 8b9d5dc4f9fd8d655249da2231a073a636a807ad
