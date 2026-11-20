# Módulo `finance` (ficha)

> ≤ 300 palavras. Atualizar no mesmo PR que muda a API pública ou um invariante.

- **Propósito:** Motor de cálculo financeiro para gestão de parcelas, juros, encargos e alocação de pagamentos.
- **Regras que implementa:** RFC-002, RN-C02, RN-C03, RN-C04, RN-C08, RN-E01, RN-E02, RN-R02, RN-R03, RN-R04, RN-C12, T-06, T-07.
- **API pública** (`src/index.ts`):
    - `bps`, `cents`, `formatReais`, `parseReais`, `MoneyError`, `Cents`, `Bps` (Money)
    - `addDays`, `addMonths`, `DateError`, `daysBetween`, `isoDate`, `IsoDate` (Date)
    - `roundToStep`, `RoundingError` (Rounding)
    - `simpleInterest`, `InterestError`, `Periods` (Interest)
    - `splitEvenly`, `SplitError` (Split)
    - `DueDateError`, `generateDueDates`, `DueDatesInput`, `Frequency` (DueDates)
    - `generateSchedule`, `periodsFor`, `ScheduleError`, `ScheduledInstallment`, `ScheduleInput`, `ScheduleTerms` (Schedule)
    - `calculateLateCharges`, `LateCharges`, `LateChargesInput` (LateCharges)
    - `lateChargesAt`, `loanStanding`, `openAmount`, `outstandingBalance`, `payoffAmount`, `LateTerms`, `LoanStanding`, `OpenInstallment` (Balance)
    - `allocatePayment`, `AllocationError`, `PaymentAllocation` (Allocation)
- **Invariantes:**
    - Dinheiro é representado em `bigint` (centavos).
    - Juros e taxas usam pontos-base (`Bps`).
    - Arredondamento comercial (`roundToStep`) é aplicado em encargos e cronogramas.
    - Soma das parcelas no cronograma deve fechar exatamente com o principal e juros totais.
    - Quitação antecipada (`payoffAmount`) sem desconto (RN-C08).
    - Alocação segue a ordem: encargos → juros → principal.
- **Eventos:** N/A.
- **Mapa de arquivos:**
    - `money.ts`: Tipos e utilitários de moeda.
    - `date.ts`: Manipulação de datas.
    - `rounding.ts`: Arredondamento comercial.
    - `interest.ts`: Cálculo de juros simples.
    - `split.ts`: Divisão de valores.
    - `due-dates.ts`: Geração de datas de vencimento.
    - `schedule.ts`: Geração de cronogramas de parcelas.
    - `late-charges.ts`: Cálculo de multas e juros de mora.
    - `balance.ts`: Saldo devedor e status do empréstimo.
    - `allocation.ts`: Alocação de pagamentos em parcelas.
- **Armadilhas:** [LI-019](../licoes.md) (Reuso de `roundToStep`).
