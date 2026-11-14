# Glossário (português → código)

Fonte única dos nomes usados no código ([ADR-0012](adr/0012-idioma-codigo-ingles-docs-portugues.md)). Termo novo entra aqui **antes** de entrar no código.

## Módulos

| Documento | Código (módulo / schema do banco) |
|---|---|
| M0 Núcleo compartilhado | `core` (+ pacote `packages/finance` para cálculo) |
| M1 Pessoas | `people` |
| M2 Crédito | `lending` |
| M3 Recebimentos | `payments` |
| M4 Tesouraria | `treasury` |
| M6 Acesso | `access` |
| Portal do cliente | `portal` (front) |
| Futuros: M5 Risco, M7 Atendimento | `risk`, `messaging` |

## Entidades e campos

| Português | Código | Observação |
|---|---|---|
| Pessoa | `Person` | |
| Endereço | `Address` | |
| Chave PIX | `PixKey` | |
| Indicado por | `referredById` | |
| Contrato (de empréstimo) | `Loan` | "contract" evitado: confunde com contrato de API |
| Número do contrato | `loanNumber` | |
| Principal | `principal` | |
| Taxa de juros (ao mês) | `monthlyInterestRate` | |
| Parcela | `Installment` | |
| Cronograma | `schedule` | |
| Vencimento | `dueDate` | |
| 1º vencimento | `firstDueDate` | |
| Periodicidade | `frequency` = `{ unit, interval }` | `unit`: `DAY` \| `MONTH` |
| Desembolso | `disbursement` / `disbursedAt` | |
| Saldo devedor | `outstandingBalance` | calculado |
| Situação (em dia / em atraso) | `standing`: `CURRENT` \| `OVERDUE` | calculado |
| Encargos de atraso | `lateCharges` | |
| Multa | `lateFee` (`lateFeeRate`) | |
| Juros de mora | `lateInterest` (`lateInterestMonthlyRate`) | |
| Carência | `gracePeriodDays` | |
| Parâmetros padrão | `DefaultTerms` | |
| Passo de arredondamento | `roundingStep` | centavos; padrão 500 |
| Renovação | `Renewal` (`renew`) | |
| Renegociação | `Renegotiation` (`renegotiate`) | |
| Quitação / quitação antecipada | `payoff` / `earlyPayoff` | |
| Baixa como perda | `writeOff` | |
| Contrato de origem | `originLoanId` | |
| Valor capitalizado | `capitalizedAmount` | renegociação |
| Recuperação (pagamento após baixa) | `recovery` | |
| Pagamento | `Payment` | |
| Alocação (distribuição do pagamento) | `PaymentAllocation` (`allocate`) | |
| Comprovante | `receipt` (arquivo: `Attachment`) | |
| Identificador da transação PIX | `pixEndToEndId` | |
| Estorno | `reversal` (`reverse`) | |
| Conta base | `Account` | |
| Movimentação | `LedgerEntry` | |
| Aporte / Retirada | `CAPITAL_IN` / `CAPITAL_OUT` | |
| Capital comprometido | `committedCapital` | calculado |
| Anexo | `Attachment` | |
| Auditoria | `AuditLog` | |
| Acesso ao portal | `PortalAccess` | |
| Registro de acesso | `AccessLog` | |

## Enums

| Português | Código |
|---|---|
| **Modalidade** | `LoanType` |
| Parcelado com juros simples | `INSTALLMENT` |
| Parcela única | `SINGLE_PAYMENT` |
| Só juros | `INTEREST_ONLY` |
| Personalizado | `CUSTOM` |
| **Status do contrato** | `LoanStatus` |
| Rascunho · Ativo · Quitado | `DRAFT` · `ACTIVE` · `PAID_OFF` |
| Renovado · Renegociado | `RENEWED` · `RENEGOTIATED` |
| Baixado como perda · Cancelado | `WRITTEN_OFF` · `CANCELLED` |
| **Status da parcela** (calculado) | `InstallmentStatus` |
| Aberta · Parcial · Paga | `OPEN` · `PARTIAL` · `PAID` |
| Vencida · Vencida parcial | `OVERDUE` · `OVERDUE_PARTIAL` |
| **Status do pagamento** | `PaymentStatus` |
| Pendente de conferência · Confirmado · Estornado | `PENDING_REVIEW` · `CONFIRMED` · `REVERSED` |
| **Método** | `PaymentMethod` |
| PIX · Boleto · Espécie · Transferência | `PIX` · `BOLETO` · `CASH` · `BANK_TRANSFER` |
| **Tipo de movimentação** | `LedgerEntryType` |
| Aporte · Retirada · Desembolso | `CAPITAL_IN` · `CAPITAL_OUT` · `DISBURSEMENT` |
| Recebimento · Estorno · Ajuste | `REPAYMENT` · `REVERSAL` · `ADJUSTMENT` |
| **Papel** | `Role`: `ADMIN` · `CLIENT` |

## Eventos

| Português | Código |
|---|---|
| ContratoAtivado | `LoanActivated` |
| ContratoQuitado | `LoanPaidOff` |
| ContratoRenovado | `LoanRenewed` |
| ContratoRenegociado | `LoanRenegotiated` |
| ContratoBaixado | `LoanWrittenOff` |
| ContratoReaberto | `LoanReopened` |
| PagamentoConfirmado | `PaymentConfirmed` |
| PagamentoEstornado | `PaymentReversed` |
| ParcelaPaga | `InstallmentPaid` |
| ParcelaVencida | `InstallmentOverdue` |

## Funções de cálculo (RFC-002)

| Português | Código |
|---|---|
| `juros_simples` | `simpleInterest` |
| `dividir` | `splitEvenly` |
| `gerar_vencimentos` | `generateDueDates` |
| `gerar_cronograma` | `generateSchedule` |
| `encargos` | `calculateLateCharges` |
| `alocar` | `allocatePayment` |
| `saldo_devedor` | `outstandingBalance` |
| `valor_quitacao` | `payoffAmount` |
| `situacao` | `loanStanding` |
| `taxa_do_periodo` | `periodRate` |
| `arred` | `roundHalfUp` |
| `arred_passo` | `roundToStep` |
