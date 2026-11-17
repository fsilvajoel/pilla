# E6-F01: cálculo da simulação no navegador

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E6.yaml`; referências: PRD-001 RF-10, RN-C03,
RN-C04 e CA-11; RFC-002 §3.4; RFC-004 §5; ADR-0013 (simulação calculada no navegador com `packages/finance`,
formulário validado pelos esquemas de `packages/schemas`).

## Escopo

- E6-T01 (Bia): testes de `apps/web/lib/simulation.ts`. Três cartões da Alice, em sequência, protegem o mesmo
  teste: E6-T02 `frequencyOf` (opção da tela → periodicidade do motor; check só com `-t frequencyOf`), E6-T07
  `simulate` (corpo `SimulateLoanRequest` → juros, total, parcela e cronograma via `generateSchedule`; check só com
  `-t simulate`, stub mantido) e E6-T09 (remove o stub e a exclusão do `vitest.config.ts`; arquivo inteiro com
  cobertura 100%).
- E6-T03 (Bia) e E6-T04 (Alice, depois do E6-T09): `apps/web/lib/simulation-form.ts`, com `toSimulateRequest`
  (textos da tela → `SimulateLoanRequest`, validado por `simulateLoanRequest`).
- Fora: modalidade SINGLE_PAYMENT na tela, "a cada N dias" livre, "Por parcela: x%" (`taxa_do_periodo` não existe
  no motor e o arredondamento para periodicidade em dias não está definido), campo Cliente, criar contrato.

## Tipos e imports (conferidos no código; valem para os testes e para a implementação)

- `SimulateLoanRequest` (`import type` de `@pilla/schemas`) é inferido do Zod (`packages/schemas/src/common.ts`):
  `type` "INSTALLMENT" | "SINGLE_PAYMENT"; `principalCents`, `monthlyInterestRateBps`, `installmentCount` são
  `number` comuns (500000, 633, 6), nunca bigint; `frequency` é `{ unit: "DAY" | "MONTH", interval: number }`;
  `firstDueDate` é `string` ("2026-12-14"). No teste, o corpo é um literal tipado com números e textos puros:
  nada de `cents`, `bps` ou `isoDate` dentro dele.
- `simulate(request, disbursementDate)`: o 2º argumento é `IsoDate` (texto com marca), feito com `isoDate("2026-11-14")`
  de `@pilla/finance`. É a única entrada com marca.
- `SimulationResult` (de `./simulation`): `interest`, `total`, `installmentAmount` são `Cents` (bigint com marca):
  compare com `toBe(190000n)`. `schedule` é `readonly ScheduledInstallment[]` com os campos `number`, `dueDate`,
  `principal`, `interest`, `total` (`packages/finance/src/schedule.ts`), não os nomes `principalCents`/`interestCents`/
  `totalCents` da resposta da API (`scheduleLineSchema`).
- `frequencyOf` devolve `Frequency` (`{ unit, interval }`); compare com `toEqual` contra o objeto literal.
- `toSimulateRequest(values: SimulationFormValues)`: todos os campos de `SimulationFormValues` são texto, menos
  `frequency` (`FrequencyPreset`: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY"). Devolve `SimulateLoanRequest`
  (números puros).
- Erros: `DueDateError` e `MoneyError` são classes de `@pilla/finance`; `ZodError` é classe de `zod`.
- `verbatimModuleSyntax` e `noUnusedLocals` estão ligados: tipo (`SimulateLoanRequest`, `SimulationFormValues`,
  `Cents`, `Frequency`...) só entra com `import type`, e nada é importado sem uso. As linhas de import exatas de cada
  arquivo de teste estão no `done` do cartão.
- Entradas dos exemplos: RFC-004 §5 = INSTALLMENT, 500000, 633, 6 parcelas, MONTH 1, 1º vencimento 2026-12-14,
  desembolso 2026-11-14. CA-11 = INSTALLMENT, 100000, 1000, 4 parcelas, DAY 7, 1º vencimento 2026-11-21,
  desembolso 2026-11-14 (as datas do CA-11 são escolha do plano; o valor da parcela não depende delas).

## Riscos

- Teste que passa contra o HEAD: os stubs lançam `not implemented`, e o `expect-red.mjs` barra teste verde.
- Cobertura 0/0 por causa da exclusão `stub <ID>` do `vitest.config.ts`: os checks dos implements passam
  `--coverage.exclude=none` e exigem 100% de linhas e ramos do arquivo.
- Conversão errada entre `number` (contrato da API) e `bigint` (motor): coberta pelo exemplo da RFC-004 §5.

## Dependências

- `generateSchedule`, `parseReais`, `cents`, `bps`, `isoDate` de `@pilla/finance` (E1).
- `simulateLoanRequest` e `SimulateLoanRequest` de `@pilla/schemas` (E2-T13).

## Critérios de aceite

- A1: o exemplo da RFC-004 §5 dá juros 1.900,00, total 6.900,00, parcela 1.150,00 e 6 linhas; a 1ª vence em
  2026-12-14 com principal 833,33 e juros 316,67.
- A2: o CA-11 do PRD-001 (1.000,00 a 10% a.m., semanal, 4 parcelas) dá parcela 275,00 e total 1.100,00.
  O "juros 95" do CA-11 é o valor antes do arredondamento da parcela; `interest` aqui é a soma dos juros das
  parcelas (total menos principal), por isso não entra no teste.
- A3: Semanal = 7 dias, Quinzenal = 15 dias, Mensal = 1 mês, Bimestral = 2 meses (exemplos da RN-C04).
- A4: os textos "5.000,00" e "6,33" viram 500000 e 633 no corpo; texto fora do formato lança erro.
- A5: 100% de linhas e ramos dos dois arquivos; typecheck e lint verdes.

## Cenários

- C1: `frequencyOf` das quatro opções.
- C2: `simulate` do exemplo da RFC-004 §5 com desembolso em 2026-11-14.
- C3: `simulate` do CA-11.
- C4: `simulate` com 1º vencimento igual ao desembolso lança erro (RN-C04).
- C5: `toSimulateRequest` do exemplo da RFC-004 §5 e do CA-11.
- C6: `toSimulateRequest` com valor sem vírgula ou 0 parcelas lança erro.
