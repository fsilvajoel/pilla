# [E7-F02] Novo formulário de empréstimo com termos padrão

<!-- ada-feature:E7-F02 -->

> Entrega **E7** · Etapa: done · Progresso: 100%
> Gerado dos docs do repositório; não edite à mão (o próximo sync sobrescreve).

## Resumo e escopo

- E7-T04 (Bia) e E7-T05 (Alice): `apps/web/lib/new-loan.ts`, com `newLoanFormDefaults` (termos padrão →
  textos da tela) e `toCreateLoanRequest` (textos → `CreateLoanRequest`, validado por `createLoanRequest`).
- E7-T06 (Bia) e E7-T07 (Alice): `apps/web/components/new-loan-form.tsx`, tela "Novo contrato" (rota
  `/emprestimos/novo`) com os campos da simulação mais Cliente, Multa, Mora, Carência e Observações internas.
- Fora: API de verdade, ativação do contrato e escolha da conta (decisão em `decisoes-2026-11-19.md` §4), SINGLE_PAYMENT na tela,
  prévia do cronograma.

## Regras e critérios

- **RF-11** ADMIN cria contrato a partir da simulação (status RASCUNHO).

- **RF-41** No formulário de contrato, os parâmetros vêm preenchidos com o padrão e podem ser ajustados **antes da ativação**.

- **CA-05** Parcela de 1.000,00 em aberto, multa 2%, mora 1% a.m., 15 dias de atraso, carência 0 — multa 20,00 + mora 5,00 = 1.025,00

- A1: os termos padrão (200, 100, 0, 633) aparecem como "2,00", "1,00", "0" e "6,33", Mensal, resto vazio.
- A2: o exemplo da RFC-004 §5 com Maria vira o corpo completo: 500000, 633, 6 parcelas mensais, 1º vencimento
  2026-12-14, multa 200, mora 100, carência 0.
- A3: `internalNotes` só vai quando digitado; Multa "3,00" vira `lateFeeBps` 300.
- A4: sem cliente → ZodError e alerta "Confira os campos do contrato."; multa sem vírgula → MoneyError.
- A5: 100% de linhas e ramos de `new-loan.ts`, 85% de `new-loan-form.tsx`; typecheck e lint verdes.

## Contrato

_Sem contrato no plano._

## Cartões

### E7-T04 — Escrever os testes para newLoanFormDefaults e toCreateLoanRequest

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E6-T04`
- Referências: [PRD-001 RF-11](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RF-41](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 CA-05](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- Ler antes: `apps/web/lib/new-loan.ts`, `apps/web/lib/simulation-form.ts`, `apps/web/lib/mock-data.ts`, `packages/schemas/src/api/lending/create-loan.ts`, `packages/schemas/src/common.ts`, `packages/finance/src/index.ts`, `packages/finance/src/money.ts`
- Skills: `escrever-teste`

**DoD (definição de pronto)**
- todos os testes falham agora contra o stub em HEAD e passariam com uma implementação correta (run_check 0)
- import { describe, expect, it } from "vitest";
- import { MoneyError } from "@pilla/finance";
- import { ZodError } from "zod";
- import { mockDefaultTerms } from "@/lib/mock-data";
- import type { NewLoanFormValues } from "./new-loan";
- import { newLoanFormDefaults, toCreateLoanRequest } from "./new-loan";
- teste "preenche os termos padrão": newLoanFormDefaults de mockDefaultTerms é o objeto de padrões das dicas, com "6,33", "2,00", "1,00" e "0" (PRD-001 RF-41, CA-05)
- teste "constrói o exemplo RFC-004": toCreateLoanRequest de example é o pedido das dicas, com principalCents 500000 e monthlyInterestRateBps 633 (RFC-004 §5, PRD-001 CA-05)
- teste "mantém as notas internas": notas "cliente antigo" adiciona internalNotes "cliente antigo" a esse pedido, e notas vazias deixam a chave de fora (decisões do Joel de 17/11)
- teste "rejeita entrada inválida": uma personId vazia lança ZodError e lateFee "2" sem a vírgula lança MoneyError (PRD-001 RF-11, RFC-004 §2)
- nunca edite apps/web/lib/new-loan.ts
- Pode alterar: `apps/web/lib/new-loan.test.ts`
- Verificações:
  - `! pnpm --filter @pilla/web exec vitest run lib/new-loan.test.ts`
  - `node scripts/check-test-quality.mjs apps/web/lib/new-loan.test.ts`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- as linhas de import do done são os únicos imports do arquivo, cada nome nelas é utilizado, e nada mais é importado
- um write_file de todo o arquivo de teste, em seguida run_check 0, 1, 2 e 3
- o exemplo é um const tipado NewLoanFormValues no topo do describe, escrito como um literal completo: amount "5.000,00", monthlyRate "6,33", installmentCount "6", frequency "MONTHLY", firstDueDate "2026-12-14", personId "01936f8e-7b2c-7cde-8f00-000000000001", lateFee "2,00", lateInterest "1,00", gracePeriodDays "0", internalNotes ""
- o objeto de valores padrão, verificado com toStrictEqual, é { amount: "", monthlyRate: "6,33", installmentCount: "", frequency: "MONTHLY", firstDueDate: "", personId: "", lateFee: "2,00", lateInterest: "1,00", gracePeriodDays: "0", internalNotes: "" }
- o request, verificado com toStrictEqual, é um const sem anotação de tipo: { personId: "01936f8e-7b2c-7cde-8f00-000000000001", type: "INSTALLMENT", principalCents: 500000, monthlyInterestRateBps: 633, installmentCount: 6, frequency: { unit: "MONTH", interval: 1 }, firstDueDate: "2026-12-14", lateFeeBps: 200, lateInterestMonthlyBps: 100, gracePeriodDays: 0 }
- o teste de notes espalha example com internalNotes cliente antigo e espera que o request espalhado contenha o mesmo internalNotes, enquanto o exemplo como está fornece o request sem a chave
- todos os campos de NewLoanFormValues são do tipo string, exceto frequency, FrequencyPreset de ./simulation, e a anotação de tipo mantém MONTHLY para evitar que seja alargado para string
- CreateLoanRequest é inferido a partir de zod, conforme visto em common.ts, portanto seus números são literais number simples, nunca bigint, nem envoltos com cents ou bps
- toStrictEqual é utilizado porque toEqual aceitaria uma chave com undefined, e as notas vazias devem omitir a chave
- mockDefaultTerms possui lateFeeBps 200, lateInterestMonthlyBps 100, gracePeriodDays 0, suggestedMonthlyRateBps 633 e roundingStepCents 500, sendo utilizado apenas no primeiro teste
- cada chamada ruim espalha um exemplo com personId vazio ou com lateFee 2, fica dentro de uma função fornecida para expect, e toThrow assume a classe ZodError do zod ou MoneyError de @pilla/finance

### E7-T05 — Implementar newLoanFormDefaults e toCreateLoanRequest.

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T04`
- Referências: [PRD-001 RF-11](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RF-41](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [ADR-0013](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0013-estado-no-frontend.md)
- Ler antes: `apps/web/lib/new-loan.ts`, `apps/web/lib/new-loan.test.ts`, `apps/web/lib/simulation-form.ts`, `packages/schemas/src/api/lending/create-loan.ts`, `packages/finance/src/index.ts`
- Skills: `editar-arquivo`, `coding-guidelines`

**DoD (definição de pronto)**
- Todos os testes em apps/web/lib/new-loan.test.ts passam com 100% de cobertura de linha e ramo de new-loan.ts (run_check 0).
- As duas linhas de import type de new-loan.ts permanecem, e as únicas importações de valor são estas três linhas.
- import { cents, formatReais, parseReais } from "@pilla/finance";
- import { createLoanRequest } from "@pilla/schemas";
- import { toSimulateRequest } from "./simulation-form";
- newLoanFormDefaults escreve os bps com formatReais e cents de @pilla/finance, nunca com as.
- toCreateLoanRequest reutiliza toSimulateRequest para os campos de simulação, parseReais para lateFee e lateInterest, e createLoanRequest.parse para o objeto inteiro
- mantenha a interface, as assinaturas e os comentários /** */ inalterados, exceto que os parâmetros perdem o sublinhado inicial
- new-loan.ts não possui a linha '// @stub E7-T05' e apps/web/vitest.config.ts não possui uma linha que exclui lib/new-loan.ts
- Pode alterar: `apps/web/lib/new-loan.ts`, `apps/web/vitest.config.ts`
- Testes protegidos: `apps/web/lib/new-loan.test.ts`
- Verificações:
  - `pnpm --filter @pilla/web exec vitest run lib/new-loan.test.ts --coverage --coverage.include=lib/new-loan.ts --coverage.exclude=none --coverage.thresholds.lines=100 --coverage.thresholds.branches=100`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- cents recebe um bigint e formatReais recebe Cents, portanto o número dos fluxos de dados passa por BigInt e cents primeiro, e 633 é lido como 6,33
- parseReais fornece Cents, um bigint, e Number converte-o no número que o esquema da solicitação espera
- espalhe a solicitação de simulação para o novo objeto e adicione internalNotes apenas quando o texto não estiver vazio, pois o teste verifica com toStrictEqual
- uma write_file de new-loan.ts, em seguida uma edit_file de apps/web/vitest.config.ts que remove a linha com o stub E7-T05, e depois execute run_check 0, 1 e 2

### E7-T06 — Escreva os testes para o componente NewLoanForm

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T05`
- Referências: [PRD-001 RF-11](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RF-41](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 CA-05](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- Ler antes: `apps/web/components/new-loan-form.tsx`, `apps/web/lib/new-loan.ts`, `apps/web/lib/mock-data.ts`, `packages/schemas/src/api/lending/create-loan.ts`, `packages/schemas/src/common.ts`, `apps/web/app/page.test.tsx`, `apps/web/vitest.setup.ts`
- Skills: `escrever-teste`, `accessibility`

**DoD (definição de pronto)**
- todos os testes falham agora contra o stub em HEAD e passariam com uma implementação correta (run_check 0)
- import { fireEvent, render, screen } from "@testing-library/react";
- import { describe, expect, it } from "vitest";
- import { vi } from "vitest";
- import { mockDefaultTerms, mockPeople } from "@/lib/mock-data";
- import { NewLoanForm } from "./new-loan-form";
- test "exibe os campos rotulados": "Cliente", "Valor emprestado", "Nº de parcelas", "Periodicidade", "1º vencimento" e botão "Criar contrato" (PRD-001 RF-11)
- test "inicia com os termos padrão": "Taxa ao mês (%)" "6,33", "Multa (%)" "2,00", "Mora ao mês (%)" "1,00", "Carência (dias)" "0", "Observações internas" "" (PRD-001 RF-41, CA-05)
- test "cria o exemplo RFC-004": o exemplo fornece o status "Contrato criado em rascunho." e onSubmit recebe a solicitação das dicas (RFC-004 §5)
- test "ajusta um padrão": o exemplo com Multa "3,00" fornece ao onSubmit a mesma solicitação com lateFeeBps 300 (PRD-001 RF-41, RFC-004 §2)
- teste "solicita ao cliente": o exemplo sem Cliente exibe o alerta "Confira os campos do contrato." e onSubmit não é chamado (decisões de Joel de 17/11)
- nunca edite apps/web/components/new-loan-form.tsx
- Pode alterar: `apps/web/components/new-loan-form.test.tsx`
- Verificações:
  - `! pnpm --filter @pilla/web exec vitest run components/new-loan-form.test.tsx`
  - `node scripts/check-test-quality.mjs apps/web/components/new-loan-form.test.tsx`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- as linhas de import do done são os únicos imports do arquivo, cada nome nelas é utilizado, e nada mais é importado
- um write_file de todo o arquivo de teste, em seguida run_check 0, 1, 2 e 3
- renderize NewLoanForm com people mockPeople, defaults mockDefaultTerms e onSubmit uma const criada com vi.fn, uma vez por teste
- getByLabelText captura o texto completo do rótulo exatamente como escrito no done, incluindo os parênteses
- um auxiliar preenche o exemplo com fireEvent.change em screen.getByLabelText: Cliente recebe 01936f8e-7b2c-7cde-8f00-000000000001, o valor da opção de Maria da Silva, Valor emprestado recebe 5.000,00, Nº de parcelas recebe 6 e 1º vencimento recebe 2026-12-14
- o teste de defaults também verifica que Periodicidade possui o valor MONTHLY, e os rótulos com o símbolo de porcentagem são escritos exatamente como no done
- Taxa, Periodicidade, Multa, Mora e Carência mantêm seus valores padrão no exemplo, e o teste adjust altera Multa para 3,00 após o auxiliar
- todos os campos são inputs de texto, exceto Cliente e Periodicidade, que são selects, 1º vencimento, um input do tipo date, e Observações internas, uma textarea, portanto cada toHaveValue recebe uma string
- a solicitação esperada é um const sem anotação de tipo, e o ajuste do teste espalha-o com lateFeeBps 300: { personId: "01936f8e-7b2c-7cde-8f00-000000000001", type: "INSTALLMENT", principalCents: 500000, monthlyInterestRateBps: 633, installmentCount: 6, frequency: { unit: "MONTH", interval: 1 }, firstDueDate: "2026-12-14", lateFeeBps: 200, lateInterestMonthlyBps: 100, gracePeriodDays: 0 }
- o clique é fireEvent.click no screen.getByRole com role button e nome Criar contrato
- o submit é assíncrono, portanto aguarde screen.findByRole com role status ou alert, mantenha esse elemento e verifique-o com toHaveTextContent, nunca aguarde expect de uma promessa findBy, e as verificações de onSubmit vêm após isso
- apps/web/app/page.test.tsx é o modelo, e não há userEvent no projeto, apenas @testing-library/react

### E7-T07 — implemente o componente NewLoanForm

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T06`
- Referências: [PRD-001 RF-11](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RF-41](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [ADR-0013](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0013-estado-no-frontend.md)
- Ler antes: `apps/web/components/new-loan-form.tsx`, `apps/web/components/new-loan-form.test.tsx`, `apps/web/lib/new-loan.ts`
- Skills: `editar-arquivo`, `react-best-practices`, `react-best-practices#rerender-derived-state-no-effect`

**DoD (definição de pronto)**
- todos os testes em apps/web/components/new-loan-form.test.tsx passam com pelo menos 85% de cobertura de new-loan-form.tsx (run_check 0)
- as duas linhas de import type de new-loan-form.tsx permanecem, e as únicas outras importações são estas quatro linhas
- import type { NewLoanFormValues } from "@/lib/new-loan";
- import { newLoanFormDefaults, toCreateLoanRequest } from "@/lib/new-loan";
- import { useState } from "react";
- import { useForm } from "react-hook-form";
- o formulário utiliza o useForm do react-hook-form tipado com NewLoanFormValues, os valores padrão vindos de newLoanFormDefaults e o register em cada campo
- o submit chama toCreateLoanRequest dentro de bloco try e catch; o catch exibe o alerta do comentário /** */
- mantenha "use client", a interface de props, a assinatura e o comentário /** */ inalterados, exceto que os props são destruturados sem aliases com sublinhado
- new-loan-form.tsx não possui a linha '// @stub E7-T07' e apps/web/vitest.config.ts não possui linha que exclui components/new-loan-form.tsx
- Pode alterar: `apps/web/components/new-loan-form.tsx`, `apps/web/vitest.config.ts`
- Testes protegidos: `apps/web/components/new-loan-form.test.tsx`
- Verificações:
  - `pnpm --filter @pilla/web exec vitest run components/new-loan-form.test.tsx --coverage --coverage.include=components/new-loan-form.tsx --coverage.exclude=none`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- os rótulos, as opções de seleção, o botão e as duas mensagens estão escritos no comentário /** */ de new-loan-form.tsx, copie-os de lá
- todos os campos são entradas de texto simples, exceto Cliente e Periodicidade (seleção), 1º vencimento (input do tipo data) e Observações internas (área de texto)
- mantenha o resultado em useState e exiba o status ou o alerta proveniente dele, invocando a onSubmit opcional com encadeamento opcional
- um write_file para new-loan-form.tsx, seguido de um edit_file para apps/web/vitest.config.ts que remove a linha contendo o stub E7-T07, e em seguida execute run_check 0, 1 e 2

## Referências

- PRD: [docs/prd/PRD-001-mvp-gestao-emprestimos.md](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md)
- [RFC-004 §5](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-004-api-e-eventos.md)
- [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- [ADR-0013](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0013-estado-no-frontend.md)
- plano.md: [docs/plano/E7-F02/plano.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F02/plano.md)
- revisao.md: [docs/plano/E7-F02/revisao.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F02/revisao.md)
- testes.md: [docs/plano/E7-F02/testes.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F02/testes.md)

## Telas

_Sem telas._

## Estado

- Etapa: done
- Progresso: 100%
- Bloqueio: não
- `E7-T04`: done
- `E7-T05`: done
- `E7-T06`: done
- `E7-T07`: done
