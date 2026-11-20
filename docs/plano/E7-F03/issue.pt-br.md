# [E7-F03] Lista de empréstimos e detalhes do empréstimo com parcelas

<!-- ada-feature:E7-F03 -->

> Entrega **E7** · Etapa: done · Progresso: 100%
> Gerado dos docs do repositório; não edite à mão (o próximo sync sobrescreve).

## Resumo e escopo

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
- Fora: filtros e paginação da lista, API de verdade, ações de ativar e cancelar (decisão em `decisoes-2026-11-19.md` §4).

## Regras e critérios

- **RF-18** ADMIN vê cronograma com situação de cada parcela e encargos calculados.

- A1: a linha do 2026-0012 mostra o link para o detalhe, R$ 5.000,00, R$ 4.600,00, 14/02/2027 e "Em dia".
- A2: o contrato quitado mostra "Quitado" e "—"; a lista vazia mostra "Nenhum contrato."; há link "Novo contrato".
- A3: o detalhe do 2026-0012 mostra R$ 5.000,00, 1.900,00, 6.900,00, 2.300,00 e 4.600,00.
- A4: a parcela 1 (14/12/2026) está "Paga" e a 3 (14/02/2027, 1.150,00) "Aberta".
- A5: "Registrar pagamento" só aparece no contrato ACTIVE; 85% de cobertura de cada componente; typecheck e lint
  verdes.

## Contrato

_Sem contrato no plano._

## Cartões

### E7-T08 — Escreva os testes para os componentes LoanList e LoanDetail

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: nenhuma
- Referências: [PRD-001 RF-18](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [docs/glossario.md](https://github.com/fsilvajoel/pilla/blob/main/docs/glossario.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- Ler antes: `apps/web/components/loan-list.tsx`, `apps/web/components/loan-detail.tsx`, `apps/web/lib/mock-data.ts`, `apps/web/lib/labels.ts`, `packages/schemas/src/api/lending/loan-views.ts`, `apps/web/app/page.test.tsx`, `apps/web/vitest.setup.ts`
- Skills: `escrever-teste`, `accessibility`

**DoD (definição de pronto)**
- todos os testes falham atualmente contra os stubs em HEAD e passariam com uma implementação correta (executar run_check 0 e 1)
- import { render, screen, within } from "@testing-library/react";
- import { describe, expect, it } from "vitest";
- import { exampleLoanListItem, paidOffLoanListItem } from "@/lib/mock-data";
- import { LoanList } from "./loan-list";
- import { draftLoanDetail, exampleLoanDetail } from "@/lib/mock-data";
- import { LoanDetail } from "./loan-detail";
- loan-list testa "mostra o empréstimo RFC-004": a linha 2026-0012 vincula-se a "/emprestimos/01936f8e-7b2c-7cde-8f00-000000000002" e exibe "R$ 4.600,00", "14/02/2027" e "Em dia" (RFC-004 §5, decisões do Joel de 17/11)
- loan-list testa "mostra um empréstimo encerrado", linha 2026-0003 com "Quitado", "R$ 0,00" e "—", e "mostra uma lista vazia", "Nenhum contrato." e sem tabela (decisões do Joel de 17/11)
- loan-detail testa "mostra o resumo": h1 "Contrato 2026-0012" e "R$ 1.900,00", "R$ 6.900,00", "R$ 2.300,00" e "R$ 4.600,00" (RFC-004 §5, decisões do Joel de 17/11)
- loan-detail testa "mostra as parcelas": a linha de 14/12/2026 tem "Paga", a linha de 14/02/2027 tem "1.150,00" e "Aberta" (RFC-004 §5)
- loan-detail testa "vincula o pagamento de um empréstimo ativo" para "/emprestimos/01936f8e-7b2c-7cde-8f00-000000000002/pagamento" e "oculta o link de pagamento de um rascunho" (decisões do Joel de 17/11)
- nunca edite apps/web/components/loan-list.tsx nem apps/web/components/loan-detail.tsx
- Pode alterar: `apps/web/components/loan-list.test.tsx`, `apps/web/components/loan-detail.test.tsx`
- Verificações:
  - `! pnpm --filter @pilla/web exec vitest run components/loan-list.test.tsx`
  - `! pnpm --filter @pilla/web exec vitest run components/loan-detail.test.tsx`
  - `node scripts/check-test-quality.mjs apps/web/components/loan-list.test.tsx`
  - `node scripts/check-test-quality.mjs apps/web/components/loan-detail.test.tsx`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- as linhas de import dos arquivos concluídos são os únicos imports, cada nome nelas é utilizado e nada mais é importado
- loan-list.test.tsx possui a linha do testing-library, a linha do vitest, a linha exampleLoanListItem e a linha ./loan-list, enquanto loan-detail.test.tsx possui a linha do testing-library, a linha do vitest, a linha draftLoanDetail e a linha ./loan-detail
- um write_file por arquivo de teste, seguido da execução de run_check nos índices 0, 1, 2, 3, 4 e 5
- o primeiro teste de loan-list renderiza empréstimos contendo apenas exampleLoanListItem, o teste fechado (closed) renderiza exampleLoanListItem e paidOffLoanListItem, e o teste vazio (empty) renderiza uma lista vazia
- o primeiro teste de loan-list também localiza getByRole columnheader pelo nome Contrato, Cliente, Valor emprestado, Saldo devedor, Próximo vencimento e Situação
- uma linha é encontrada com getByRole com role row e um nome regex, como /2026-0012/ ou /14\/12\/2026/, e suas células são consultadas com within nessa linha
- na linha 2026-0012, o link é getByRole com role link e nome 2026-0012, verificado com toHaveAttribute href, e a linha também contém Maria da Silva e R$ 5.000,00
- na linha 2026-0003, os textos são Quitado, R$ 2.000,00, R$ 0,00 e o traço da próxima data de vencimento
- o teste vazio localiza getByText Nenhum contrato., queryByRole table é null, e getByRole link com nome Novo contrato possui href /emprestimos/novo
- o teste de resumo localiza getByRole heading com nível 1 e nome Contrato 2026-0012, bem como R$ 5.000,00 também
- o link ativo é getByRole link com nome Registrar pagamento em exampleLoanDetail, e o teste de rascunho verifica queryByRole link com aquele nome toBeNull em draftLoanDetail
- um render por teste, porque dois renders no mesmo teste repetem o cabeçalho, os links e os textos e getBy encontra mais de um
- passar os fixtures de @/lib/mock-data como estão, nunca novos objetos, portanto não é necessária importação de tipo
- cada string getByText é o texto inteiro de uma célula ou um dd, exatamente como escrito, nunca parte ou expressão regular
- na linha 14/12/2026 o texto 1.150,00 aparece duas vezes, Parcela e Pago, portanto aquela linha é verificada apenas por Paga
- na linha 14/02/2027 o texto 0,00 aparece duas vezes, Pago e Encargos, portanto aquela linha é verificada apenas por 1.150,00 e Aberta
- cada href é escrito como a string literal inteira do done, nunca concatenado
- esses componentes não possuem submit, portanto render e getBy são suficientes, e apps/web/app/page.test.tsx é o modelo

### E7-T09 — Implemente o render básico do componente LoanList

- Tipo: `implement` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T08`
- Referências: [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- Ler antes: `apps/web/components/loan-list.tsx`, `apps/web/lib/labels.ts`
- Skills: `editar-arquivo`, `react-best-practices`, `react-best-practices#rendering-conditional-render`

**DoD (definição de pronto)**
- o teste "mostra o empréstimo RFC-004" de apps/web/components/loan-list.test.tsx passa (run_check 0)
- as duas linhas de import type de loan-list.tsx permanecem, e os únicos imports de valor são estas três linhas
- import { cents, formatReais } from "@pilla/finance";
- import Link from "next/link";
- import { loanStandingLabel, loanStatusLabel } from "@/lib/labels";
- o link Novo contrato para /emprestimos/novo, em seguida a tabela com os seis cabeçalhos de colunas do comentário /** */ e uma linha por empréstimo, key id
- as quantias utilizam formatReais e centavos de @pilla/finance, enquanto as etiquetas são provenientes de apps/web/lib/labels.ts, nunca sendo reescritas no componente
- manter a linha '// @stub E7-T09', a interface de props, a assinatura e o comentário /** */ inalterados, exceto que o prop é destruturado sem o alias com sublinhado
- a lista vazia e o traço para uma data nula são deixados para E7-T15
- Pode alterar: `apps/web/components/loan-list.tsx`
- Testes protegidos: `apps/web/components/loan-list.test.tsx`
- Verificações:
  - `pnpm --filter @pilla/web exec vitest run components/loan-list.test.tsx -t "shows the RFC-004 loan"`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- os arquivos a ler são os dois de readFirst, o único arquivo a escrever é apps/web/components/loan-list.tsx, e o teste não é lido
- LoanListItem de @pilla/schemas possui id, loanNumber e personName como string, principalCents e outstandingCents como number, status como LoanStatus, standing como LoanStanding ou null, e nextDueDate como uma string aaaa-mm-dd ou null
- centavos de @pilla/finance recebe um bigint e retorna Cents, formatReais recebe Cents e retorna o texto sem R$, portanto cada número passa por BigInt, depois centavos, e finalmente formatReais
- loanStandingLabel e loanStatusLabel são registros indexados por LoanStanding e LoanStatus, e uma chave nula é um erro de tipo, logo a etiqueta de standing é lida apenas quando status é ACTIVE e standing não é null; caso contrário, exibe-se a etiqueta de status
- a data em dd/mm/aaaa provém da divisão do texto pelo traço e junção das partes em ordem reversa com uma barra, e uma data nula pode exibir o traço já existente
- cada valor é o texto completo da própria célula td, e a célula Contrato contém o Link com o texto loanNumber
- O Link de next/link renderiza um âncora com href, e o componente não precisa de "use client"
- uma write_file para loan-list.tsx, em seguida run_check 0, 1 e 2

### E7-T15 — Finalize o componente LoanList com a lista vazia e o empréstimo encerrado

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T09`
- Referências: [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- Ler antes: `apps/web/components/loan-list.tsx`
- Skills: `editar-arquivo`, `react-best-practices`, `react-best-practices#rendering-conditional-render`

**DoD (definição de pronto)**
- todos os testes em apps/web/components/loan-list.test.tsx passam com pelo menos 85% de cobertura de loan-list.tsx (run_check 0)
- sem empréstimos, o texto "Nenhum contrato." substitui a tabela, e o link Novo contrato permanece
- uma nextDueDate nula exibe "—" e um empréstimo não ACTIVE exibe o loanStatusLabel com seu status
- as imports, a interface de props, a assinatura e o comentário /** */ permanecem conforme deixado por E7-T09
- <!--t:1b4b4e1324-->loan-list.tsx has no '// @stub E7-T09' line and apps/web/vitest.config.ts has no line that excludes components/loan-list.tsx (run_check 3)<!--/t-->
- Pode alterar: `apps/web/components/loan-list.tsx`, `apps/web/vitest.config.ts`
- Testes protegidos: `apps/web/components/loan-list.test.tsx`
- Verificações:
  - `pnpm --filter @pilla/web exec vitest run components/loan-list.test.tsx --coverage --coverage.include=components/loan-list.tsx --coverage.exclude=none`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`
  - `! grep -n "stub E7-T09" apps/web/components/loan-list.tsx apps/web/vitest.config.ts`

**Dicas**
- o componente já renderiza o empréstimo ativo, portanto apenas a lista vazia, o traço e o rótulo de status de um empréstimo fechado são alterados
- edit_file em loan-list.tsx, nunca um novo write_file do arquivo inteiro
- a tabela não é renderizada quando os empréstimos estão vazios, logo queryByRole table é nulo
- o traço é o caractere único de "done", ou seja, todo o texto do seu td
- um edit_file em apps/web/vitest.config.ts remove a linha com o stub E7-T09, e um edit_file em loan-list.tsx remove a linha do stub
- edit_file em loan-list.tsx, os dois edit_file das linhas do stub, em seguida run_check 0, 1, 2 e 3

### E7-T10 — Implemente o render básico do componente LoanDetail

- Tipo: `implement` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T08`
- Referências: [PRD-001 RF-18](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- Ler antes: `apps/web/components/loan-detail.tsx`
- Skills: `editar-arquivo`, `react-best-practices`, `react-best-practices#rendering-conditional-render`

**DoD (definição de pronto)**
- os testes "mostra o resumo" e "mostra as parcelas" do arquivo apps/web/components/loan-detail.test.tsx passam (run_check 0)
- as duas linhas de importação de tipo de loan-detail.tsx permanecem, e as únicas importações de valor são estas duas linhas
- import { cents, formatReais } from "@pilla/finance";
- import { installmentStatusLabel } from "@/lib/labels";
- o h1, o personName, o dl dos cinco pares de resumo e a tabela de parcelas do comentário /** */
- mantenha a linha '// @stub E7-T10', a interface de props, a assinatura e o comentário /** */ inalterados, exceto que o prop é destruturado sem o alias com sublinhado
- a situação do empréstimo e o link de pagamento são deixados para E7-T16
- Pode alterar: `apps/web/components/loan-detail.tsx`
- Testes protegidos: `apps/web/components/loan-detail.test.tsx`
- Verificações:
  - `pnpm --filter @pilla/web exec vitest run components/loan-detail.test.tsx -t "shows the summary|shows the installments"`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- o único arquivo a ler é apps/web/components/loan-detail.tsx, o único arquivo a escrever é o mesmo arquivo, e o teste não é lido
- LoanDetailResponse de @pilla/schemas possui loanNumber e personName como string, principalCents, interestCents, totalCents, paidCents e outstandingCents como number, e installments como um array de LoanInstallment
- LoanInstallment possui number como número, dueDate como string no formato aaaa-mm-dd, totalCents, paidCents e lateChargesCents como números e status como InstallmentStatus
- centavos de @pilla/finance recebe um bigint e retorna Cents, formatReais recebe Cents e retorna o texto sem R$, portanto cada número passa por BigInt, depois centavos, e finalmente formatReais
- o texto do h1 é exatamente "Contrato " seguido de loanNumber, cada valor de resumo é "R$ " seguido do montante formatado como o texto completo do próprio dd, e cada valor da tabela é o texto completo do próprio td
- a data em dd/mm/aaaa é obtida dividindo o texto pelo hífen e juntando as partes em ordem reversa com uma barra
- os parcelamentos são lidos usando map sobre o array, nunca por índice
- um write_file para loan-detail.tsx, seguido de run_check 0, 1 e 2

### E7-T16 — Conclua o componente LoanDetail com a situação e o link de pagamento

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T10`
- Referências: [PRD-001 RF-18](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- Ler antes: `apps/web/components/loan-detail.tsx`
- Skills: `editar-arquivo`, `react-best-practices`, `react-best-practices#rendering-conditional-render`

**DoD (definição de pronto)**
- todos os testes em apps/web/components/loan-detail.test.tsx passam com pelo menos 85% de cobertura de loan-detail.tsx (run_check 0)
- as importações de valor tornam-se estas três linhas
- import { cents, formatReais } from "@pilla/finance";
- import Link from "next/link";
- import { installmentStatusLabel, loanStandingLabel, loanStatusLabel } from "@/lib/labels";
- a situação exibe o loanStatusLabel do status e, quando standing não for nulo, também o loanStandingLabel do standing
- apenas quando status é ACTIVE, o link Registrar pagamento para "/emprestimos/" mais id mais "/pagamento"
- loan-detail.tsx não possui a linha '// @stub E7-T10' e apps/web/vitest.config.ts não possui uma linha que exclua components/loan-detail.tsx
- Pode alterar: `apps/web/components/loan-detail.tsx`, `apps/web/vitest.config.ts`
- Testes protegidos: `apps/web/components/loan-detail.test.tsx`
- Verificações:
  - `pnpm --filter @pilla/web exec vitest run components/loan-detail.test.tsx --coverage --coverage.include=components/loan-detail.tsx --coverage.exclude=none`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- o componente já renderiza o h1, o resumo e a tabela, portanto apenas as importações, a situação e o link mudam
- edit_file em loan-detail.tsx, nunca um novo write_file do arquivo inteiro
- LoanDetailResponse tem id como string, status como LoanStatus e standing como LoanStanding ou null, e uma chave null em loanStandingLabel é um erro de tipo
- O Link de next/link renderiza um âncora com href, e o componente não precisa de "use client"
- um edit_file em apps/web/vitest.config.ts remove a linha com o stub E7-T10, e um edit_file em loan-detail.tsx remove a linha do stub
- as chamadas a edit_file em loan-detail.tsx, o edit_file de vitest.config.ts e, em seguida, execute run_check 0, 1 e 2

## Referências

- PRD: [docs/prd/PRD-001-mvp-gestao-emprestimos.md](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md)
- [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md)
- [docs/glossario.md](https://github.com/fsilvajoel/pilla/blob/main/docs/glossario.md)
- [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- plano.md: [docs/plano/E7-F03/plano.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F03/plano.md)
- revisao.md: [docs/plano/E7-F03/revisao.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F03/revisao.md)
- testes.md: [docs/plano/E7-F03/testes.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F03/testes.md)

## Telas

_Sem telas._

## Estado

- Etapa: done
- Progresso: 100%
- Bloqueio: não
- `E7-T08`: done
- `E7-T09`: done
- `E7-T15`: done
- `E7-T10`: done
- `E7-T16`: done
