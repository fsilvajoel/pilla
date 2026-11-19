# Plano E6-F02: tela de simulação de empréstimo

## Escopo
Entra o componente `LoanSimulation`, que é a tela onde o ADMIN simula um empréstimo sem gravar nada (PRD-001 RF-10).
Ele recebe os campos do formulário, calcula no navegador com `simulate` e `toSimulateRequest` (E6-F01, ADR-0013) e
mostra o resumo (total, juros e parcela) e o cronograma. Para entrada inválida, mostra um alerta no lugar do resultado.

Entra também o primeiro e2e real (Playwright) da rota `/emprestimos/simular`.

Fica de fora:
- a página `apps/web/app/(admin)/emprestimos/simular/page.tsx`, que já existe e não muda;
- `todayInBrt` (`apps/web/lib/today.ts`), que pertence à E7-F01 (E7-T02);
- as regras de cálculo e de leitura do formulário (E6-F01) e os defeitos D1 a D3, que são da E6-F01;
- gravar o contrato e chamar a API.

Arquivos alterados: `apps/web/components/loan-simulation.tsx` (implementação),
`apps/web/components/loan-simulation.test.tsx` e `apps/web/e2e/loan-simulation.e2e.ts` (testes, etapa 2).

## Contrato
- `apps/web/components/loan-simulation.tsx`: `export interface LoanSimulationProps { readonly disbursementDate: IsoDate }`
- `apps/web/components/loan-simulation.tsx`: `export function LoanSimulation({ disbursementDate }: LoanSimulationProps): JSX.Element`

Tela (textos exatos):
- campos com rótulo: "Valor emprestado", "Taxa ao mês (%)", "Nº de parcelas", "Periodicidade" (select com as opções
  Semanal `WEEKLY`, Quinzenal `BIWEEKLY`, Mensal `MONTHLY` e Bimestral `BIMONTHLY`) e "1º vencimento"
  (`input type="date"`); botão "Simular";
- resumo: uma lista de descrição `<dl>` com um par `<dt>` rótulo / `<dd>` valor (papéis `term`/`definition`) por
  item, cada `<dd>` logo após o seu `<dt>`, com os rótulos exatos "Total a receber", "Juros" e "Parcela"; "Total a
  receber" e "Juros" no formato `R$ ` + `formatReais`; "Parcela" no formato `<n> × R$ <valor>` (ex.:
  `6 × R$ 1.150,00`). O resumo não é tabela; estrutura: um único `<dl>` com três pares `<dt>rótulo</dt><dd>valor</dd>`, nesta ordem:
  "Total a receber", "Juros", "Parcela" (ex.: `<dt>Total a receber</dt><dd>R$ 6.900,00</dd>`). O resumo não é tabela
  (a única tabela da tela é o cronograma);
- tabela com as colunas Nº, Vencimento (`dd/mm/aaaa`), Principal, Juros e Parcela (`formatReais`, sem `R$`);
- erro: um elemento `role="alert"` com o texto "Confira os campos da simulação.", sem resumo e sem tabela.

## Arquivos de produção
Viram `sources` no estado; os marcados como domínio viram `domainSources` (gate mutação). Domínio = regra de negócio
ou cálculo; tela, adaptador e cola não são domínio.

| Arquivo | Domínio |
|---|---|
| `apps/web/components/loan-simulation.tsx` | não |

`page.tsx` não entra em `sources`, porque não muda e é coberto só pelo e2e.

## Domínio das entradas
Os limites vêm de `toSimulateRequest` (E6-F01) e de `simulateLoanRequest` (`packages/schemas`). A tela não acrescenta
regra; qualquer erro desses vira o alerta.

| Entrada | Formato aceito | Mínimo | Máximo | Exemplos rejeitados | Erro esperado | Fonte |
|---|---|---|---|---|---|---|
| Valor emprestado | reais com vírgula e 2 casas, milhar com ponto opcional (`5.000,00`, `5000,00`) | `0,01` | sem teto | `"5000"`, `"5000,0"`, `"0,00"`, `"-1,00"`, `""` | alerta (MoneyError ou ZodError) | RFC-004 §5; `parseReais`; `simulateLoanRequest` |
| Taxa ao mês (%) | percentual com vírgula e 2 casas (`6,33`) | `0,00` | sem teto (D2) | `"6"`, `"-6,33"`, `""` | alerta (MoneyError ou ZodError) | RFC-004 §5; E6-F01; D2, D3 |
| Nº de parcelas | inteiro em texto | `1` | sem teto | `"0"`, `"-1"`, `"6,5"`, `""` | alerta (ZodError) | `simulateLoanRequest`; D1 (`"1e1"` e `" 6 "` hoje passam) |
| Periodicidade | um dos 4 valores do select | – | – | nenhum pela tela (lista fechada) | – | E6-F01 `frequencyOf` |
| 1º vencimento | data `aaaa-mm-dd` (anos 1900 a 2999) depois de `disbursementDate` | dia seguinte ao desembolso | 2999-12-31 | `""`, igual ou anterior ao desembolso | alerta (ZodError ou DueDateError) | PRD-001 RN-C04 |
| `disbursementDate` (prop) | `IsoDate` | – | – | – | – (tipo garante) | decisoes-2026-11-17 §2 (hoje em BRT) |

## Riscos
- O resultado aparece com valores errados por formatação (centavos ou `R$`): A2 confere os textos exatos.
- A tela some ou quebra com erro em vez de mostrar o alerta: A3 cobre uma rejeição de cada campo editável.
- O componente passa nos testes de unidade, mas a rota não funciona: A4 (e2e) abre `/emprestimos/simular` de verdade.
- O e2e depende de `todayInBrt`, que ainda é esboço: a página lança erro até a E7-F01 ser entregue (ver Dependências).

## Dependências
- E6-F01 (entregue): `simulate`, `toSimulateRequest`, `frequencyOf`.
- `packages/finance` (`formatReais`, `generateSchedule`, `DueDateError`) e `packages/schemas` (`simulateLoanRequest`).
- E7-F01 / E7-T02 (`todayInBrt`): necessária para o gate e2e (A4), porque `page.tsx` a chama.
- Playwright já configurado em `apps/web/playwright.config.ts` (`e2e/**/*.e2e.ts`, porta 3100).

## Critérios de aceite

### A1: a tela mostra os campos e o botão
- entrada: render de `LoanSimulation` com `disbursementDate` `2026-11-14`
- domínio: todas as entradas da tabela
- saída: campos com os rótulos "Valor emprestado", "Taxa ao mês (%)", "Nº de parcelas", "Periodicidade" (4 opções:
  Semanal, Quinzenal, Mensal e Bimestral) e "1º vencimento"; botão "Simular"
- erro: nenhum
- fonte: PRD-001 RF-10
- camada: unit

### A2: simular mostra o resumo e o cronograma
- entrada: valor `5.000,00`, taxa `6,33`, parcelas `6`, Mensal, 1º vencimento `2026-12-14`, desembolso `2026-11-14`;
  e CA-11: valor `1.000,00`, taxa `10,00`, parcelas `4`, Semanal, 1º vencimento `2026-11-21`
- domínio: valores válidos de todas as entradas
- saída: RFC-004 §5 → "Total a receber" `R$ 6.900,00`, "Juros" `R$ 1.900,00`, "Parcela" `6 × R$ 1.150,00`, tabela
  com 6 linhas e a 1ª linha `1`, `14/12/2026`, `833,33`, `316,67`, `1.150,00`; CA-11 → "Parcela" `4 × R$ 275,00`,
  "Total a receber" `R$ 1.100,00`
- erro: nenhum
- fonte: RFC-004 §5; PRD-001 RF-10, CA-11
- camada: unit

### A3: entrada inválida mostra o alerta sem resultado
- entrada: o exemplo da RFC-004 §5 com um campo trocado por um valor rejeitado
- domínio: exemplos rejeitados de valor, taxa, parcelas e 1º vencimento
- saída: um `role="alert"` com o texto "Confira os campos da simulação." e nenhum "Total a receber" nem tabela
- erro: MoneyError, ZodError ou DueDateError tratados pela tela (nada é lançado para fora)
- fonte: PRD-001 RN-C04; RFC-004 §5; `simulateLoanRequest`
- camada: unit

### A4: a rota /emprestimos/simular simula de ponta a ponta
- entrada: navegador em `/emprestimos/simular`; exemplo da RFC-004 §5 com 1º vencimento `2099-12-14`; depois o mesmo
  exemplo com 1º vencimento `2000-01-14`
- domínio: valores válidos; 1º vencimento anterior a hoje (BRT)
- saída: heading "Simular empréstimo"; com 2099-12-14, "Total a receber" `R$ 6.900,00`, "Juros" `R$ 1.900,00` e
  "Parcela" `6 × R$ 1.150,00`; com 2000-01-14, o alerta "Confira os campos da simulação."
- erro: DueDateError (vira alerta) para a data passada
- fonte: PRD-001 RF-10, RN-C04; decisoes-2026-11-17 §2; RFC-004 §5
- camada: e2e

## Cenários
- C1 (A1, unit): render mostra os 5 campos com rótulo, as 4 opções da periodicidade e o botão "Simular" (fonte PRD-001 RF-10)
- C2 (A2, unit): exemplo da RFC-004 §5 mostra no `<dl>` os pares "Total a receber" `R$ 6.900,00`, "Juros" `R$ 1.900,00`
  e "Parcela" `6 × R$ 1.150,00` (fonte RFC-004 §5)
- C3 (A2, unit): exemplo da RFC-004 §5 mostra 6 linhas, e a 1ª é `1`, `14/12/2026`, `833,33`, `316,67`, `1.150,00` (fonte RFC-004 §5)
- C4 (A2, unit): CA-11 mostra no `<dl>` os pares "Parcela" `4 × R$ 275,00` e "Total a receber" `R$ 1.100,00` (fonte
  PRD-001 CA-11; a fonte não traz os juros finais, só o intermediário 95, então "Juros" não é conferido)
- C5 (A3, unit): valor `5000` sem vírgula mostra o alerta e nenhum resultado
- C6 (A3, unit): taxa `6` sem vírgula mostra o alerta e nenhum resultado
- C7 (A3, unit): parcelas `0` mostra o alerta e nenhum resultado
- C8 (A3, unit): 1º vencimento igual ao desembolso `2026-11-14` mostra o alerta (fonte PRD-001 RN-C04)
- C9 (A3, unit): 1º vencimento vazio mostra o alerta
- C10 (A4, e2e): `/emprestimos/simular` com o exemplo e 1º vencimento `2099-12-14` mostra no `<dl>` os pares do C2
  (resumo da RFC-004 §5)
- C11 (A4, e2e): `/emprestimos/simular` com 1º vencimento `2000-01-14` mostra o alerta (fonte PRD-001 RN-C04)

## Arquivos de teste previstos
- `apps/web/components/loan-simulation.test.tsx` (pacote `pnpm --filter @pilla/web`; camada unit)
- `apps/web/e2e/loan-simulation.e2e.ts` (camada e2e)

## Pendências
- O gate e2e (A4) depende de `todayInBrt` (E7-T02, feature E7-F01), que ainda é esboço e faz a página lançar erro.
  Recomendação: entregar a E7-F01 antes da etapa de implementação da E6-F02 (ou ao menos antes do gate e2e), em vez
  de trazer `today.ts` para esta feature.
- Limites sem teto (valor, taxa e nº de parcelas) e os defeitos D1 a D3 são da E6-F01; aqui ficam só registrados.
