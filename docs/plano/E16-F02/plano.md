# E16-F02: parser CSV, mapa de colunas e classificação por linha (domínio puro)

Plano da feature. Cartões: E16-T03 (testes, opus) e E16-T04 (implementação, sonnet). Referências: PRD-001 RF-70 e RN-P01, RFC-002 §3, ADR-0002, ADR-0004, ADR-0005, `docs/plano/E16.md` D3, D4, D5 e D7, `docs/plano/pendencias-pm.md` (E16-T03, E16-T07).

## Escopo

Entra (tudo em `apps/api/src/imports/domain/`, TS puro, sem relógio implícito: data de referência por parâmetro):
- `parse-csv.ts`: texto → linhas de campos; separador `,` ou `;` detectado, BOM e CRLF tolerados, aspas; erro tipado para vazio, cabeçalho sem coluna obrigatória e mais de 2000 linhas.
- `column-map.ts`: **único** arquivo que conhece os nomes das colunas (D3); converte dinheiro para centavos, taxa para bps, datas para `AAAA-MM-DD`; valor ilegível vira `null` (nunca lança).
- `classify-row.ts`: `classifyRow(raw, referenceDate) → { status: OK|REVIEW|REJECTED, reasons, plan }`, onde `plan` traz `person {name, cpf|null}`, `loan {type, principalCents, monthlyRateBps, frequency, contractedAt, installments[]}` e `payment {amountCents, paidAt, allocations}|null` e `paidOff`.
  - OK: reconstrói o cronograma com `generateSchedule` e compara ao centavo com `valor_parcela`.
  - REVIEW: motivos de D4; o plano vira CUSTOM com parcelas da planilha (`splitEvenly` para repartir principal e juros).
  - REJECTED: `MISSING_REQUIRED`, sem plano.
  - CPF em branco: OK com `personWithoutCpf`; CPF inválido: `CPF_INVALID`, cpf nulo.
  - Pagamento: um consolidado, alocado com `allocatePayment` em ordem de parcela; excedente → `PAID_EXCEEDS_TOTAL`.
- `normalize-name.ts`: nome normalizado (D5), usado pelo módulo na F04.

Fora: gravar qualquer coisa (F03/F04); casar pessoa com o banco; ler arquivo/HTTP.

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| arquivo | texto UTF-8 | 1 linha de dados | 2000 linhas, 2 MB | vazio, sem cabeçalho obrigatório | erro tipado (vira 422) | D2 |
| `valor_emprestado` | `1234,56` ou `1234.56` | 0,01 | - | zero, negativo, texto | REJECTED `MISSING_REQUIRED` | D3, ADR-0004 |
| `taxa_mensal` | percentual | 0 | - | negativo, texto | `RATE_MISSING` (REVIEW) | D3 |
| `parcelas` | inteiro | 1 | - | 0, decimal | `INSTALLMENTS_MISSING` | D3 |
| datas | ISO ou DD/MM/AAAA | - | - | impossível (31/02), texto livre | `DATE_NOT_PARSEABLE` | D3 |
| `cpf` | 11 dígitos, com ou sem máscara | - | - | dígito verificador errado | `CPF_INVALID` | RN-P01 |
| `tipo` | PARCELADO, UNICA, SO_JUROS ou vazio | - | - | outro | `TYPE_UNKNOWN` | D3 |

## Critérios de aceite

- A1: separador `,` e `;`, BOM, CRLF e campo entre aspas com separador são lidos igual.
- A2: arquivo vazio, cabeçalho sem `nome`, `valor_emprestado` ou `data_contrato`, e mais de 2000 linhas dão erro tipado.
- A3: cabeçalho em qualquer ordem; coluna desconhecida é ignorada.
- A4: linha com número de campos diferente do cabeçalho vira REJECTED `MISSING_REQUIRED` (não derruba o arquivo).
- A5: `1234,56` e `1234.56` valem 123456 centavos; `5` e `5,5` valem 500 e 550 bps.
- A6: data ilegível ou impossível vira `null`, sem exceção.
- A7: linha cujo cronograma reconstruído bate ao centavo com `valor_parcela` é OK, com o tipo certo.
- A8: cada motivo de D4 tem um caso; o plano é CUSTOM; a soma dos totais das parcelas = `valor_parcela` × `parcelas`; cada `totalCents` = principal + juros.
- A9: sem `valor_parcela`, uma parcela de principal no primeiro vencimento (ou contrato + 30 dias), juros 0.
- A10: sem nome, valor ≤ 0 ou data de contrato inutilizável: REJECTED, sem plano.
- A11: CPF em branco não gera motivo; inválido gera `CPF_INVALID` e cpf nulo; válido volta com 11 dígitos.
- A12: `total_pago` gera um pagamento consolidado; igual ao total marca `paidOff`; maior que o total grava só o alocável e marca `PAID_EXCEEDS_TOTAL`; sem data, `PAID_DATE_MISSING`.
- A13: nenhum arquivo do domínio importa Nest, Drizzle, outro módulo nem usa `Date.now`.

## Casos de teste

- `parse-csv.test.ts`: C1 a C6 (A1 a A4).
- `column-map.test.ts`: C7 a C11 (A5, A6) e C12 nomes do cabeçalho (A3).
- `classify-row.test.ts`: C13 OK nos três tipos (A7); C14 a C22 um por motivo (A8); C23 sem `valor_parcela` (A9); C24 REJECTED (A10); C25 a C27 CPF (A11); C28 a C31 pagamento (A12). Fixtures só fictícias (CPFs de `packages/schemas/src/fake-cpf.ts`).

## Riscos

- Tolerância do "bate ao centavo" (padrão 0, pergunta E16-T07): constante única em `classify-row.ts`.
- Colunas são sugestão (E16-T03): troca de nomes só em `column-map.ts` e no teste dele.

## Dependências

F01 (motivos). Paralela à F03. Destrava F04.
