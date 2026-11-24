# E15-F05B: web, detalhe do contrato no portal

Plano da feature. Cartão: E15-T10 (Sonnet). Referências: PRD-001 RF-62, RF-64, `docs/plano/E15.md` D2, D9, D12, D14,
D15, `docs/plano/E15-F05A/plano.md` (textos e arquivos de apoio).

## Escopo

Entra: `apps/web/app/(portal)/portal/contratos/[id]/page.tsx` (+ `loading.tsx`, `not-found.tsx`), componentes em
`apps/web/components/portal/`, e os textos novos em `apps/web/lib/portal-texts.ts` (mesmo arquivo da F05A).

Fora: baixar comprovante, pagar, contato com o credor, gráficos.

## Textos (RF-64), exatamente estes

| Onde | Texto |
|---|---|
| Voltar | "Voltar para os meus contratos" |
| Resumo | "Valor emprestado", "Total a pagar", "Já pago", "Falta pagar" (todos em reais) |
| Próxima parcela | "Próxima parcela: R$ 1.149,83 em 15/12/2026." (quitado: "Contrato quitado. Nada a pagar.") |
| Atraso | "Você tem parcelas em atraso. Os encargos de atraso somam R$ X." (só se `lateChargesCents > 0`) |
| Seção parcelas | "Parcelas" com colunas "Parcela", "Vence em", "Valor", "Já pago", "Situação" |
| Situação da parcela | "Paga", "Em aberto", "Paga em parte", "Atrasada", "Atrasada, paga em parte" |
| Seção pagamentos | "Pagamentos que recebemos" com "Data", "Valor", "Forma" |
| Forma | "Pix", "Boleto", "Dinheiro", "Transferência" |
| Sem pagamentos | "Ainda não recebemos pagamentos deste contrato." |
| Contrato inexistente ou de outro | "Não encontramos este contrato." (404 igual nos dois casos) |

## Critérios de aceite

- A1: a página mostra o resumo, a próxima parcela, a tabela de parcelas e a de pagamentos com os valores da API,
  formatados (R$ com vírgula, `dd/mm/aaaa`).
- A2: com `lateChargesCents = 0` o aviso de atraso não aparece; com valor, aparece com o total; parcela atrasada tem
  texto e cor.
- A3: contrato quitado mostra a frase de quitado, sem "próxima parcela" e sem aviso de atraso.
- A4: 404 da API mostra "Não encontramos este contrato." com link de volta; 401 volta a `/portal` com a frase de sessão
  vencida; a tela não diferencia "inexistente" de "de outro cliente".
- A5: a tela não mostra, em nenhum lugar, dado que a API não devolve (nome, CPF, contato, taxas); tabelas rolam na
  horizontal em 360 px sem quebrar a página (em celular, cada parcela vira um bloco empilhado).
- A6: revisão visual: em dia, em atraso com encargos, parcial, quitado, sem pagamentos, 404; sem erro no console.

## Dependências

F04, F05A. Destrava F07A.
