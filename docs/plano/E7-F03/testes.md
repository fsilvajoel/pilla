# Testes da feature E7-F03

Escritos pela Bia numa chamada (etapa 2, ADR-0014).

| Cenário | Descrição | Cartão | Teste |
|---|---|---|---|
| C1 | lista com o contrato do exemplo | E7-T08 | shows the RFC-004 loan |
| C2 | lista com contrato quitado e lista vazia | E7-T08 | shows a closed loan / shows an empty list |
| C3 | resumo do detalhe | E7-T08 | shows the summary |
| C4 | linhas das parcelas | E7-T08 | shows the installments |
| C5 | link de pagamento no ACTIVE e ausente no DRAFT | E7-T08 | links the payment of an active loan / hides the payment link of a draft |

Reparos em lote: 1. Checks: todos verdes

Arquivos (sha do blob):
- `apps/web/components/loan-detail.test.tsx` 4f9349fcfcaf60446ed19264e1bfae093f13fb9c
- `apps/web/components/loan-list.test.tsx` bf474e45e71869bb6d8ce5354c2be59693a68761
