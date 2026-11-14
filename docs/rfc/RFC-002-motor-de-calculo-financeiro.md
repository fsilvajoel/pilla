# RFC-002 — Motor de cálculo financeiro

| Campo | Valor |
|---|---|
| Status | Aprovado |
| Autor | Claude (tech lead) |
| Criado | 2026-11-14 |
| Implementa | [PRD-001](../prd/PRD-001-mvp-gestao-emprestimos.md) (RN-C, RN-E, RN-R) |
| Depende de | [ADR-0004](../adr/0004-dinheiro-em-centavos.md), [ADR-0005](../adr/0005-valores-derivados.md) |

---

## 1. Objetivo

Especificar **uma única** biblioteca de cálculo (no M0) usada por simulação, contrato, recebimentos, portal e importação. Funções **puras**: mesma entrada → mesma saída, sem banco, sem relógio implícito (a data de referência é sempre parâmetro).

## 2. Convenções

- Valores em **centavos inteiros**. Taxas em decimal com 4 casas (6,33% = `0.0633`).
- Arredondamento: **meio para cima** (half-up), apenas ao converter um resultado fracionário em centavos, uma vez por resultado.
- **Arredondamento comercial** (RN-C03): `arred_passo(valor, passo)` = múltiplo de `passo` mais próximo (empate sobe); `passo` padrão = 500 centavos (R$ 5), vindo do contrato.
- Mês comercial de 30 dias para mora *pro rata die*.
- `ref` = data de referência (hoje ou data do pagamento), sempre explícita.

## 3. Funções

### 3.1 `juros_simples(principal, taxa, periodos) → centavos`
`arred(principal × taxa × periodos)`

### 3.2 `dividir(total, n) → [centavos]`
`base = floor(total / n)`; parcelas 1..n-1 = `base`; última = `total − base × (n − 1)`.

### 3.3 `gerar_vencimentos(primeiro_vencimento, unidade, intervalo, n) → [data]`
RN-C04: 1º vencimento e periodicidade são **negociados**. A parcela i (1..n) vence em:
- `unidade = MES`: `adicionar_meses(primeiro_vencimento, (i − 1) × intervalo)`, sempre a partir da **data original** (não da parcela anterior), para que um dia 31 volte a ser 31 depois de fevereiro. Dia inexistente → último dia do mês.
- `unidade = DIA`: `primeiro_vencimento + (i − 1) × intervalo` dias corridos.

Erro se `primeiro_vencimento ≤ data_desembolso` ou `intervalo < 1`.

### 3.4 `gerar_cronograma(modalidade, principal, taxa, n, regra_vencimento) → [Parcela]`

`taxa` é **sempre ao mês** (PRD RN-C02). Cada período de parcela vale `fator` meses: `unidade = MES` → `fator = intervalo`; `unidade = DIA` → `fator = intervalo / 30`. Para não usar fração, o cálculo é feito em inteiros e arredondado uma vez: `juros = arred(principal × taxa × n × intervalo_em_dias / 30)` (ou `× intervalo_em_meses`). A função `taxa_do_periodo(taxa, regra)` existe só para exibição.

| Modalidade | Total | Parcela i |
|---|---|---|
| `PARCELADO_JUROS_SIMPLES` | `principal + juros_simples(principal, taxa, n × fator)` | principal_i = `dividir(principal, n)[i]`; juros_i = `dividir(juros, n)[i]`; total_i = soma |
| `PARCELA_UNICA` | idem com n = 1 | uma parcela |
| `SO_JUROS` | indeterminado | gera **só o próximo período**: juros = `juros_simples(principal_em_aberto, taxa, fator)`, principal = 0. Novo período gerado quando o anterior vence/é pago. Quitação: principal em aberto + juros do período corrente |
| `PERSONALIZADO` | soma das parcelas informadas | informadas manualmente (importação/casos especiais) |

> Dividir principal e juros separadamente garante que a soma das parcelas feche exatamente com principal e juros totais.

### 3.4.1 Arredondamento comercial no cronograma (RN-C03)
Para `PARCELADO_JUROS_SIMPLES` e `PARCELA_UNICA`:
1. `juros = arred_passo(juros_exatos, passo)`
2. `parcela = arred_passo((principal + juros) / n, passo)`
3. `total = parcela × n`; `juros_efetivos = total − principal`
4. principal de cada parcela = `dividir(principal, n)`; juros de cada parcela = `parcela − principal_i` (a soma fecha exatamente).

`SO_JUROS`: juros do período = `arred_passo(juros_exatos_do_periodo, passo)`. Encargos: `arred_passo(multa + mora, passo)`.

### 3.5 `encargos(parcela_em_aberto, vencimento, ref, multa_pct, mora_pct_mes, carencia_dias) → {multa, mora}`
- `dias = ref − vencimento`. Se `dias ≤ carencia_dias` ou em aberto = 0 → zero.
- `multa = arred(em_aberto × multa_pct)` (uma vez).
- `mora = arred(em_aberto × mora_pct_mes × dias / 30)` (sempre ao mês, independente da periodicidade das parcelas).
- Base = principal + juros em aberto da parcela (encargos não geram encargos).
- Pagamento parcial: a multa já paga não é cobrada de novo; a mora corre sobre o novo em aberto a partir da data do pagamento. *(Detalhe a validar nos testes.)*

### 3.6 `alocar(valor, parcelas_em_aberto, ref) → [Alocacao] | erro`
1. Ordena parcelas por vencimento (mais antiga primeiro).
2. Para cada parcela: paga **encargos** → **juros** → **principal**.
3. Sobra passa para a próxima parcela.
4. Se `valor > saldo_devedor_total(ref)` → erro `PAGAMENTO_EXCEDE_SALDO`.

### 3.7 Agregados
- `saldo_devedor(contrato, ref)` = Σ (em aberto das parcelas) + encargos(ref).
- `valor_quitacao(contrato, ref)` = saldo_devedor (sem desconto — RN-C08).
- `situacao(contrato, ref)` = `EM_ATRASO` se existe parcela vencida além da carência com em aberto > 0; senão `EM_DIA`.
- `status_parcela(parcela, alocacoes, ref)`.

## 4. Casos de teste obrigatórios

Os critérios CA-01 a CA-08 do PRD, mais:

| # | Entrada | Esperado |
|---|---|---|
| T-01 | `dividir(689900, 6)` | `[114983 ×5, 114985]` |
| T-02 | `dividir(500000, 6)` (principal do CA-01) | `[83333 ×5, 83335]` |
| T-03 | `juros_simples(500000, 0.0633, 6)` | `189900` |
| T-04 | SO_JUROS, principal 800.000 (8.000,00), 10% | parcela do período = 80.000 (800,00) |
| T-05 | `alocar(150000, [parcela 115000 vencida há 0 dias, parcela 115000 futura])` | 1ª PAGA; 35.000 na 2ª (PARCIAL) |
| T-06 | `alocar` acima do saldo | erro `PAGAMENTO_EXCEDE_SALDO` |
| T-07 | encargos com dias = carência | zero |
| T-08 | `gerar_vencimentos(2027-01-05, DIA, 7, 4)` | 05/01, 12/01, 19/01, 26/01 |
| T-09 | `gerar_vencimentos(2027-01-31, MES, 1, 4)` | 31/01, 28/02, 31/03, 30/04 |
| T-10 | `gerar_vencimentos(2027-01-15, MES, 2, 3)` | 15/01, 15/03, 15/05 |
| T-11 | 100.000 (1.000,00), 10% a.m., DIA 7, n = 4 | juros exatos 9.333 → 9.500; parcela 109.500 ÷ 4 = 27.375 → 27.500; total 110.000 |
| T-13 | `arred_passo` com passo 500: 9.100 · 9.250 · 9.333 · 9.749 | 9.000 · 9.500 · 9.500 · 9.500 |
| T-14 | cronograma do CA-01 | principal 83.333 ×5 + 83.335; juros da parcela = 115.000 − principal (31.667 ×5 + 31.665) |
| T-12 | CA-01 com DIA 30 em vez de MES 1 | mesmo total (fator = 1) |

## 5. Alternativas consideradas

- **Tabela Price / juros compostos**: não reflete a prática atual (planilha usa juros simples). Pode entrar como nova modalidade sem mudar as demais.
- **Parcelas em centavos exatos, com resíduo na última**: descartado por decisão de produto (RN-C03); o negócio trabalha com valores redondos (múltiplos de R$ 5), como na planilha.

## 6. Questões abertas

- Mora sobre pagamento parcial (3.5).
