# E7-F03: lista de contratos e detalhe com parcelas

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E7.yaml`; referências: PRD-001 RF-18; RFC-004 §5;
`docs/glossario.md`; decisões do Joel de 17/11 (`docs/plano/decisoes-2026-11-17.md`).

## Escopo

- E7-T08 (Bia): `apps/web/components/loan-list.test.tsx` e `apps/web/components/loan-detail.test.tsx`; telas
  pequenas, sem submit, num cartão só.
- E7-T09 (Alice): `apps/web/components/loan-list.tsx`, rota `/emprestimos`.
- E7-T10 (Alice): `apps/web/components/loan-detail.tsx`, rota `/emprestimos/[id]`.
- Fora: filtros e paginação da lista, API de verdade, ações de ativar e cancelar (pendente do Joel).

## Riscos

- Valores esperados montados à mão no teste: os textos vêm das fixtures de `mock-data.ts`, que seguem a RFC-004 §5.
- Rótulos repetidos no componente: a Alice usa `apps/web/lib/labels.ts`.
- Cobertura 0/0 por causa da exclusão `stub <ID>`: os checks passam `--coverage.exclude=none`.

## Dependências

- `LoanListItem` e `LoanDetailResponse` de `@pilla/schemas`; `labels.ts` e `mock-data.ts` do commit de preparo.
- `formatReais` e `cents` de `@pilla/finance` (E1).

## Critérios de aceite

- A1: a linha do 2026-0012 mostra o link para o detalhe, R$ 5.000,00, R$ 4.600,00, 14/02/2027 e "Em dia".
- A2: o contrato quitado mostra "Quitado" e "—"; a lista vazia mostra "Nenhum contrato."; há link "Novo contrato".
- A3: o detalhe do 2026-0012 mostra R$ 5.000,00, 1.900,00, 6.900,00, 2.300,00 e 4.600,00.
- A4: a parcela 1 (14/12/2026) está "Paga" e a 3 (14/02/2027, 1.150,00) "Aberta".
- A5: "Registrar pagamento" só aparece no contrato ACTIVE; 85% de cobertura de cada componente; typecheck e lint
  verdes.

## Cenários

- C1: lista com o contrato do exemplo.
- C2: lista com contrato quitado e lista vazia.
- C3: resumo do detalhe.
- C4: linhas das parcelas.
- C5: link de pagamento no ACTIVE e ausente no DRAFT.
