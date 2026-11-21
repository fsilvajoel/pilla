# E11-F07: encargos depois de pagamento parcial

Plano da feature. Cartões: E11-T12 (testes, bia), E11-T13 (implementação em `packages/finance`, baidu), E11-T14 (testes das leituras, claude) e E11-T15 (leituras, baidu). Referências: RFC-002 §3.5, §3.6 e §3.7, PRD-001 RN-E01, RN-E02 e RN-R04, ADR-0004, ADR-0005, `docs/plano/E11.md` D11.

## Por que existe

A RFC-002 §3.5 diz: "Pagamento parcial: a multa já paga não é cobrada de novo; a mora corre sobre o novo em aberto a partir da data do pagamento. (Detalhe a validar nos testes.)". Hoje `lateChargesAt` e `allocatePayment` só recebem `openPrincipal` e `openInterest` e recalculam multa e mora sobre o em aberto desde o vencimento: depois de um pagamento parcial a multa voltaria inteira. Sem esta correção, o saldo depois de confirmar não bate com "saldo antes menos o valor pago" e a quitação nunca fecha em centavos exatos. Como só existe alocação confirmada a partir da F03, a F07 precisa estar pronta antes dela.

Regra aprovada pelo Joel em 21/11 (`pendencias-pm.md`, E11-T12): vale o texto da RFC e a F07 segue.

## Escopo

Entra:
- `packages/finance/src/partial-charges.ts` (novo): dado o histórico de pagamentos confirmados de uma parcela (`paidAt`, encargos, juros e principal pagos, em ordem de `paidAt`), dobra o histórico num estado: multa já cobrada, encargos ainda devidos (pagamento menor que os encargos) e data de onde a mora corre. Os encargos na data `ref` passam a ser: encargos devidos que sobraram + mora sobre o novo em aberto desde a última data de pagamento + multa só se ainda não foi cobrada.
- `OpenInstallment` (`balance.ts`) ganha o histórico **opcional**; sem ele, tudo se comporta como hoje (compatível com os chamadores da E10 e com todos os testes da E3/E4). `lateChargesAt`, `outstandingBalance`, `payoffAmount`, `loanStanding` e `allocatePayment` passam a usar o histórico quando presente. A assinatura exata fica para o refinamento da feature (restrição: compatível com o que existe; só bigint em centavos).
- `payments/public.confirmedAllocationsByLoan` devolve também, por parcela, os pagamentos confirmados (data e três componentes), sem os estornados; os campos atuais não mudam.
- `lending/application/loan-assessment.ts` (detalhe, cotação de quitação, standing) e o caso de uso `previewAllocation` da F01 passam o histórico à biblioteca, num ponto só.

Fora: mudar a regra de carência (só isenta encargos de mora, E10 F05); gravar encargos (ADR-0005).

## Critérios de aceite
- A1: sem histórico, o resultado é idêntico ao de hoje.
- A2: depois de um pagamento parcial que cobriu a multa, a multa não é cobrada de novo.
- A3: a mora corre sobre o novo em aberto a partir da data do pagamento.
- A4: pagamento menor que os encargos deixa o resto dos encargos devido, sem cobrar duas vezes.
- A5: vários pagamentos são dobrados por `paidAt`, não pela ordem de gravação.
- A6: `allocatePayment` com histórico paga encargos, depois juros, depois principal; a soma é o valor.
- A7: `PAYMENT_EXCEEDS_BALANCE` usa o saldo com histórico.
- A8: propriedade: pagar `outstandingBalance(ref)` zera `outstandingBalance(ref)`, com ou sem histórico.
- A9: `confirmedAllocationsByLoan` traz os pagamentos por parcela, sem estornados, mantendo os campos antigos.
- A10: o detalhe do contrato não cobra a multa de novo depois de parcial.
- A11: a cotação de quitação usa o histórico.
- A12: `standing` continua calculado só pela carência e pelo em aberto.

## Casos de teste
- C1: sem histórico (valores da E3/E4 intactos).
- C2 a C4: multa uma vez, mora desde o pagamento, parcela vencida.
- C5, C6: pagamento menor que os encargos.
- C7: ordem por `paidAt`.
- C8 a C10: alocação com histórico, soma, excesso.
- C11: propriedade de quitação.
- C12, C13: porta pública.
- C14 a C16: detalhe, cotação e standing.

## Riscos
- Mexer em `@pilla/finance` pode mudar valores da E10: os testes antigos são protegidos (`protectedTests`) e o histórico é opcional.
- Pagamento retroativo confirmado depois de outro mais novo: a dobra por `paidAt` cobre.

## Dependências
- E10-T10 (leituras). Bloqueia a F03.
