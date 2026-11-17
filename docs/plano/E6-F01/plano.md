# E6-F01: cálculo da simulação no navegador

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E6.yaml`; referências: PRD-001 RF-10, RN-C03,
RN-C04 e CA-11; RFC-002 §3.4; RFC-004 §5; ADR-0013 (simulação calculada no navegador com `packages/finance`,
formulário validado pelos esquemas de `packages/schemas`).

## Escopo

- E6-T01 (Bia) e E6-T02 (Alice): `apps/web/lib/simulation.ts`, com `frequencyOf` (opção da tela → periodicidade
  do motor) e `simulate` (corpo `SimulateLoanRequest` → juros, total, parcela e cronograma via `generateSchedule`).
  O E6-T02 também põe `apps/web/AGENTS.md` no `.gitignore`.
- E6-T03 (Bia) e E6-T04 (Alice): `apps/web/lib/simulation-form.ts`, com `toSimulateRequest` (textos da tela →
  `SimulateLoanRequest`, validado por `simulateLoanRequest`).
- Fora: modalidade SINGLE_PAYMENT na tela, "a cada N dias" livre, "Por parcela: x%" (`taxa_do_periodo` não existe
  no motor e o arredondamento para periodicidade em dias não está definido), campo Cliente, criar contrato.

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
