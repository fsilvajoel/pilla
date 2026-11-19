# E7-F02: novo contrato com os termos padrão

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E7.yaml`; referências: PRD-001 RF-11, RF-41 e
CA-05; RFC-004 §2 e §5; ADR-0013; decisões do Joel de 17/11 (`docs/plano/decisoes-2026-11-17.md`).

## Escopo

- E7-T04 (Bia) e E7-T05 (Alice): `apps/web/lib/new-loan.ts`, com `newLoanFormDefaults` (termos padrão →
  textos da tela) e `toCreateLoanRequest` (textos → `CreateLoanRequest`, validado por `createLoanRequest`).
- E7-T06 (Bia) e E7-T07 (Alice): `apps/web/components/new-loan-form.tsx`, tela "Novo contrato" (rota
  `/emprestimos/novo`) com os campos da simulação mais Cliente, Multa, Mora, Carência e Observações internas.
- Fora: API de verdade, ativação do contrato e escolha da conta (decisão em `decisoes-2026-11-19.md` §4), SINGLE_PAYMENT na tela,
  prévia do cronograma.

## Tipos e imports (conferidos no código; valem para os testes e para a implementação)

- `NewLoanFormValues` (`import type` de `./new-loan`) estende `SimulationFormValues` (`./simulation-form`, E6):
  todos os campos são texto, menos `frequency` (`FrequencyPreset`: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY").
  Campos novos: `personId`, `lateFee`, `lateInterest`, `gracePeriodDays`, `internalNotes`. O `example` do teste é
  um literal tipado `NewLoanFormValues` (a anotação impede "MONTHLY" de virar `string`).
- `newLoanFormDefaults(defaults: DefaultTermsResponse): NewLoanFormValues` e
  `toCreateLoanRequest(values: NewLoanFormValues): CreateLoanRequest` (`apps/web/lib/new-loan.ts`).
- `CreateLoanRequest` (`@pilla/schemas`) é inferido do Zod: números comuns, nunca bigint. Corpo esperado do exemplo
  da RFC-004 §5 (comparar com `toStrictEqual`, que distingue chave ausente de `undefined`):
  `{ personId: "01936f8e-7b2c-7cde-8f00-000000000001", type: "INSTALLMENT", principalCents: 500000,
  monthlyInterestRateBps: 633, installmentCount: 6, frequency: { unit: "MONTH", interval: 1 },
  firstDueDate: "2026-12-14", lateFeeBps: 200, lateInterestMonthlyBps: 100, gracePeriodDays: 0 }`.
- `mockDefaultTerms` (`@/lib/mock-data`): `lateFeeBps` 200, `lateInterestMonthlyBps` 100, `gracePeriodDays` 0,
  `suggestedMonthlyRateBps` 633, `roundingStepCents` 500.
- Erros: `MoneyError` de `@pilla/finance`, `ZodError` de `zod`; `toThrow(Classe)`.
- `NewLoanForm` (`apps/web/components/new-loan-form.tsx`), props `people`, `defaults`, `onSubmit?`; o teste passa
  `mockPeople`, `mockDefaultTerms` e um `vi.fn()`.
- `verbatimModuleSyntax` e `noUnusedLocals` estão ligados: tipo só entra com `import type`, e nada é importado sem
  uso. As linhas de import exatas de cada arquivo de teste estão no `done` do cartão (lista fechada); o `vi` vem
  numa linha própria (`import { vi } from "vitest";`) por causa do validador de cartões.

## Como o teste consulta a tela

- E7-T04 não tem tela: chamadas diretas, `expect(() => toCreateLoanRequest(...)).toThrow(ZodError)`.
- Rótulos (`getByLabelText`, texto inteiro, com os parênteses): "Cliente", "Valor emprestado", "Taxa ao mês (%)",
  "Nº de parcelas", "Periodicidade", "1º vencimento", "Multa (%)", "Mora ao mês (%)", "Carência (dias)",
  "Observações internas". Botão: `getByRole("button", { name: "Criar contrato" })`.
- Valores iniciais com `toHaveValue` (sempre texto): "6,33", "2,00", "1,00", "0", Periodicidade "MONTHLY",
  Observações internas "".
- Preencher o exemplo: Cliente = id de Maria da Silva, Valor emprestado "5.000,00", Nº de parcelas "6",
  1º vencimento "2026-12-14"; o resto fica no padrão.
- Sucesso: status "Contrato criado em rascunho."; erro: alerta "Confira os campos do contrato.".
- Submit assíncrono (React Hook Form): `await screen.findByRole("status")` ou `("alert")`, guardar o elemento e
  conferir com `toHaveTextContent`; as conferências do `onSubmit` vêm depois. Nunca `await expect(findBy...)`.
- Não há `userEvent` no projeto: só `fireEvent` de `@testing-library/react`. Modelo: `apps/web/app/page.test.tsx`.
- Um `render` por teste (dois renders repetem rótulos, botões e textos e o `getBy` acha mais de um).

## Riscos

- Reaproveitar a simulação: depende do `toSimulateRequest` da E6-T04 pronto; o E7-T04 espera por ele.
- `number` (API) × `bigint` (motor): os bps dos termos padrão passam por `cents` e `formatReais`, e o teste fixa
  "6,33", "2,00" e "1,00".
- Submit assíncrono: o teste espera o status/alerta com `findByRole`.

## Dependências

- `toSimulateRequest` e `SimulationFormValues` de `apps/web/lib/simulation-form.ts` (E6-T04).
- `createLoanRequest`, `DefaultTermsResponse` e `PersonSummary` de `@pilla/schemas`, no commit de preparo.
- `parseReais`, `formatReais`, `cents` de `@pilla/finance` (E1); `mockPeople` e `mockDefaultTerms` de
  `apps/web/lib/mock-data.ts`.

## Critérios de aceite

- A1: os termos padrão (200, 100, 0, 633) aparecem como "2,00", "1,00", "0" e "6,33", Mensal, resto vazio.
- A2: o exemplo da RFC-004 §5 com Maria vira o corpo completo: 500000, 633, 6 parcelas mensais, 1º vencimento
  2026-12-14, multa 200, mora 100, carência 0.
- A3: `internalNotes` só vai quando digitado; Multa "3,00" vira `lateFeeBps` 300.
- A4: sem cliente → ZodError e alerta "Confira os campos do contrato."; multa sem vírgula → MoneyError.
- A5: 100% de linhas e ramos de `new-loan.ts`, 85% de `new-loan-form.tsx`; typecheck e lint verdes.

## Cenários

- C1: valores iniciais a partir dos termos padrão.
- C2: corpo do exemplo da RFC-004 §5.
- C3: observações internas presentes e omitidas.
- C4: entrada inválida (sem cliente, multa sem vírgula).
- C5: tela pré-preenchida, envio do exemplo, multa ajustada e envio sem cliente.
