# E7-F03: lista de contratos e detalhe com parcelas

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E7.yaml`; referências: PRD-001 RF-18; RFC-004 §5;
`docs/glossario.md`; decisões do Joel de 17/11 (`docs/plano/decisoes-2026-11-17.md`).

## Escopo

- E7-T08 (Bia): `apps/web/components/loan-list.test.tsx` e `apps/web/components/loan-detail.test.tsx`; telas
  pequenas, sem submit, num cartão só.
- E7-T09 → E7-T15 (Alice): `apps/web/components/loan-list.tsx`, rota `/emprestimos`. E7-T09 faz o render básico
  (link "Novo contrato", tabela e contrato ativo; check só com `-t "shows the RFC-004 loan"`, stub mantido); E7-T15
  faz a lista vazia, o "—" e o rótulo de contrato fechado, tira o stub e a exclusão do `vitest.config.ts` e roda o
  arquivo inteiro com cobertura.
- E7-T10 → E7-T16 (Alice): `apps/web/components/loan-detail.tsx`, rota `/emprestimos/[id]`. E7-T10 faz título,
  resumo e parcelas (check com `-t "shows the summary|shows the installments"`, stub mantido); E7-T16 faz a
  situação e o link "Registrar pagamento", tira o stub e roda o arquivo inteiro com cobertura.
- Refatiamento de 17/11: E7-T09 e E7-T10 falharam no teto de 20 chamadas lendo cinco arquivos; cada cartão novo lê
  só o componente (e `labels.ts` no E7-T09), com os tipos e as assinaturas na dica.
- Fora: filtros e paginação da lista, API de verdade, ações de ativar e cancelar (pendente do Joel).

## Tipos e imports (conferidos no código; valem para os testes e para a implementação)

- `LoanList` (`apps/web/components/loan-list.tsx`), prop `loans: readonly LoanListItem[]`; `LoanDetail`
  (`apps/web/components/loan-detail.tsx`), prop `loan: LoanDetailResponse` (tipos de `@pilla/schemas`, só na
  implementação).
- O teste passa as fixtures de `@/lib/mock-data` como estão (`exampleLoanListItem`, `paidOffLoanListItem`,
  `exampleLoanDetail`, `draftLoanDetail`) e não importa tipo.
- Ids: `exampleLoanDetail`/`exampleLoanListItem` = `01936f8e-7b2c-7cde-8f00-000000000002` (2026-0012, Maria da
  Silva); `paidOffLoanListItem` = 2026-0003; `draftLoanDetail` é DRAFT.
- `verbatimModuleSyntax` e `noUnusedLocals` estão ligados: tipo só entra com `import type`, e nada é importado sem
  uso. As linhas de import exatas de cada arquivo de teste estão no `done` do cartão (lista fechada); o `vi` vem
  numa linha própria (`import { vi } from "vitest";`) por causa do validador de cartões.

## Como o teste consulta a tela

- Colunas da lista: `getByRole("columnheader", { name })` com Contrato, Cliente, Valor emprestado, Saldo devedor,
  Próximo vencimento, Situação.
- Linha: `getByRole("row", { name: /2026-0012/ })` e as células com `within(linha)`; `getByText` com o texto
  inteiro da célula, nunca parte.
- Links: `getByRole("link", { name: "2026-0012" })` com `href` "/emprestimos/01936f8e-7b2c-7cde-8f00-000000000002";
  "Novo contrato" com `href` "/emprestimos/novo"; "Registrar pagamento" com `href`
  "/emprestimos/01936f8e-7b2c-7cde-8f00-000000000002/pagamento"; ausência com `queryByRole(...)` e `toBeNull()`.
- Lista vazia: `getByText("Nenhum contrato.")` e `queryByRole("table")` nulo.
- Detalhe: `getByRole("heading", { level: 1, name: "Contrato 2026-0012" })`; resumo "R$ 5.000,00",
  "R$ 1.900,00", "R$ 6.900,00", "R$ 2.300,00", "R$ 4.600,00".
- Parcelas: linha 14/12/2026 conferida só por "Paga" ("1.150,00" aparece duas vezes nela); linha 14/02/2027 com
  "1.150,00" e "Aberta" ("0,00" aparece duas vezes nela, Pago e Encargos). O done do E7-T08 pedia "0,00" e
  o teste entregue em 17/11 tem esse `getByText` que nunca passa: a Bia refaz o `loan-detail.test.tsx` (decisão
  de reabrir o E7-T08 é do Joel).
- Sem submit: `render` e `getBy` bastam.
- Não há `userEvent` no projeto: só `fireEvent` de `@testing-library/react`. Modelo: `apps/web/app/page.test.tsx`.
- Um `render` por teste (dois renders repetem rótulos, botões e textos e o `getBy` acha mais de um).

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
