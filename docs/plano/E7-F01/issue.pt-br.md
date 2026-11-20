# [E7-F01] Formulário de registro de pessoa e hoje em Brasília

<!-- ada-feature:E7-F01 -->

> Entrega **E7** · Etapa: done · Progresso: 100%
> Gerado dos docs do repositório; não edite à mão (o próximo sync sobrescreve).

## Resumo e escopo

- E7-T01 (Bia): `apps/web/lib/today.test.ts` e `apps/web/components/person-form.test.tsx`.
- E7-T02 (Alice): `apps/web/lib/today.ts`, `todayInBrt(now)` → `IsoDate` do dia em Brasília (UTC−3 fixo, sem horário de verão)
  fixo). Usado pela página `/emprestimos/simular` como data do desembolso.
- E7-T03 (Alice): `apps/web/components/person-form.tsx`, tela "Cadastrar pessoa" (rota `/pessoas/nova`) com
  React Hook Form e `createPersonRequest` de `@pilla/schemas`.
- Fora: API de verdade (o `onSubmit` só recebe o corpo), lista e edição de pessoas, RF-02 e RF-04, máscara de
  CPF e telefone.

Cartões: `docs/plano/E7.yaml` (E7-T01, E7-T02, E7-T03)

## Regras e critérios

- **RF-01** ADMIN cadastra/edita pessoa (nome, CPF, telefone, e-mail, nascimento, observações).

- **RF-03** ADMIN registra quem indicou a pessoa.

- **RN-P01** CPF único e válido. Pode ficar pendente apenas em registros importados.

### A1: data de hoje em Brasília
- entrada: `now: Date` (instante UTC)
- domínio: `now` (Date válido)
- saída: `IsoDate` "YYYY-MM-DD" do dia civil em UTC−3; "2026-11-17" para 2026-11-18T02:30:00Z e para
  2026-11-17T15:00:00Z
- erro: Date inválido lança `RangeError`
- fonte: decisões 17/11 (data de desembolso = hoje em Brasília, exemplos de referência)
- camada: unit, prop, mut

### A2: cadastro só com campos obrigatórios
- entrada: formulário com nome "Maria da Silva", CPF "52998224725", telefone "+5511987654321"; opcionais vazios
- domínio: `fullName`, `cpf`, `phone` válidos; `email`, `birthDate`, `referredById`, `notes` vazios
- saída: o formulário tem os 7 rótulos ("Nome completo", "CPF", "Telefone", "E-mail", "Nascimento",
  "Indicado por", "Observações") e o botão "Cadastrar"; `onSubmit` recebe exatamente
  `{ fullName: "Maria da Silva", cpf: "52998224725", phone: "+5511987654321" }` e a tela mostra o status
  "Pessoa cadastrada."
- erro: nenhum
- fonte: RF-01; RFC-005 `persons`; `create-person.ts`
- camada: unit

### A3: cadastro com indicação
- entrada: A2 mais "Indicado por" = João Pereira (id `01936f8e-7b2c-7cde-8f00-000000000003`)
- domínio: `referredById` entre os ids de `mockPeople`
- saída: `onSubmit` recebe `{ fullName: "Maria da Silva", cpf: "52998224725", phone: "+5511987654321",
  referredById: "01936f8e-7b2c-7cde-8f00-000000000003" }`
- erro: nenhum
- fonte: RF-03; RN-P02
- camada: unit

### A4: rejeição de campo fora do domínio
- entrada: um campo por vez fora do domínio (telefone sem +55/E.164, CPF com DV errado, e-mail sem domínio,
  nascimento "2026-13-01", nome vazio, observações só com espaços) com os demais válidos; e `now` inválido em `todayInBrt`
- domínio: `phone` aceita apenas `+` seguido de 1-9 e 7 a 14 dígitos; `cpf` aceita 11 dígitos sem máscara,
  dígitos verificadores válidos e não repetidos; `email` aceita e-mail válido do Zod com máximo 254;
  `birthDate` aceita data válida `YYYY-MM-DD`; `fullName` aceita texto aparado de 1 a 150 caracteres; `notes` aceita texto aparado de 1 a 2000 caracteres;
  `now` aceita somente `Date` com instante válido
- saída: `onSubmit` não é chamado
- erro: a tela mostra o alerta "Confira os campos do cadastro."; `todayInBrt(new Date("x"))` lança
  `RangeError` (tipo exato)
- fonte: `create-person.ts`, `common.ts` (`cpfSchema`, `phoneSchema`, `isoDateSchema`); RN-P01; RFC-005
- camada: unit

Nota: cobertura (100% de linhas e ramos de `today.ts`, 85% de `person-form.tsx`), typecheck e lint não são
critérios `A<n>`; já são cobrados pelos gates.

## Contrato

- `apps/web/lib/today.ts`: `todayInBrt(now: Date): IsoDate` (`IsoDate` de `@pilla/finance`, texto com marca:
  `toBe("2026-11-17")` funciona sem importar tipo; a implementação usa só `isoDate` de `@pilla/finance` como valor).
- `apps/web/components/person-form.tsx`: `PersonForm` com props `people: readonly PersonSummary[]` e
  `onSubmit?: (request: CreatePersonRequest) => void` (`import type` de `@pilla/schemas`, só na implementação).
  O campo "Nascimento" é texto (`<input type="text">`, validado por `isoDateSchema`), nunca `type="date"`: no jsdom
  o `type="date"` zera valor inválido para `""` e o C9 passaria sem alerta; o campo precisa preservar o texto digitado.
  O teste passa `mockPeople` (`@/lib/mock-data`) e um `vi.fn()`; não importa tipo.
- `CreatePersonRequest` é inferido do Zod: `{ fullName, cpf, phone }` mais os opcionais `email`, `birthDate`,
  `referredById`, `notes`, que ficam de fora quando vazios. Esperado no teste:
  `{ fullName: "Maria da Silva", cpf: "52998224725", phone: "+5511987654321" }` e, na indicação, o mesmo com
  `referredById: "01936f8e-7b2c-7cde-8f00-000000000003"` (João Pereira em `mockPeople`).
- `verbatimModuleSyntax` e `noUnusedLocals` estão ligados: tipo só entra com `import type`, e nada é importado sem
  uso. As linhas de import exatas de cada arquivo de teste estão no `done` do cartão (lista fechada); o `vi` vem
  numa linha própria (`import { vi } from "vitest";`) por causa do validador de cartões.

## Cartões

### E7-T01 — Escreva os testes para os componentes todayInBrt e PersonForm

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: nenhuma
- Referências: [PRD-001 RF-01](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RF-03](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RN-P01](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-005 persons](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- Ler antes: `apps/web/lib/today.ts`, `apps/web/components/person-form.tsx`, `apps/web/lib/mock-data.ts`, `packages/schemas/src/api/people/create-person.ts`, `packages/schemas/src/common.ts`, `packages/finance/src/index.ts`, `apps/web/app/page.test.tsx`, `apps/web/vitest.setup.ts`, `docs/plano/decisoes-2026-11-17.md`
- Skills: `escrever-teste`, `accessibility`

**DoD (definição de pronto)**
- todos os testes falham agora contra os stubs no HEAD e passariam com uma implementação correta (executar run_check 0 e 1)
- import { describe, expect, it } from "vitest";
- import { todayInBrt } from "./today";
- import fc from "fast-check";
- import { fireEvent, render, screen } from "@testing-library/react";
- import { vi } from "vitest";
- import { mockPeople } from "@/lib/mock-data";
- import { PersonForm } from "./person-form";
- today.test.ts: o método todayInBrt para os instantes "2026-11-18T02:30:00Z" e "2026-11-17T15:00:00Z" retorna "2026-11-17" em ambos os casos; uma propriedade instant válida corresponde a UTC menos 3 horas, enquanto Invalid Date lança RangeError (decisões de Joel de 17/11)
- pessoa-form teste "exibe os campos rotulados": rótulos "Nome completo", "CPF", "Telefone", "E-mail", "Nascimento", "Indicado por", "Observações" e botão "Cadastrar" (PRD-001 RF-01)
- teste "envia apenas os campos preenchidos": "Maria da Silva", "52998224725" e "+5511987654321" resultam no status "Pessoa cadastrada." e onSubmit recebe apenas fullName, cpf e telefone (decisões de Joel de 17/11)
- teste "envia o indicativo": os mesmos campos mais "Indicado por" com valor "01936f8e-7b2c-7cde-8f00-000000000003" adicionam referredById com aquele id ao corpo da requisição (PRD-001 RF-03)
- teste "rejeita um telefone sem +55": Telefone "11987654321" resulta no alerta "Confira os campos do cadastro." e onSubmit não é chamado (RFC-005 pessoas, decisões de Joel de 17/11)
- teste "rejeita um CPF inválido": CPF "52998224726" resulta no alerta "Confira os campos do cadastro." e onSubmit não é chamado (PRD-001 RN-P01, RFC-005 pessoas)
- test "rejeita um e-mail inválido": O e-mail "maria@" gera o alerta "Confira os campos do cadastro." e onSubmit não é chamado (PRD-001 RF-01, create-person.ts)
- test "rejeita uma data de nascimento inválida": Nascimento "2026-13-01" gera o alerta "Confira os campos do cadastro." e onSubmit não é chamado (PRD-001 RF-01, common.ts isoDateSchema)
- test "rejeita um nome vazio": Nome completo "" gera o alerta "Confira os campos do cadastro." e onSubmit não é chamado (PRD-001 RF-01, create-person.ts min(1))
- nunca edite apps/web/lib/today.ts nem apps/web/components/person-form.tsx
- Pode alterar: `apps/web/lib/today.test.ts`, `apps/web/components/person-form.test.tsx`
- Verificações:
  - `! pnpm --filter @pilla/web exec vitest run lib/today.test.ts`
  - `! pnpm --filter @pilla/web exec vitest run components/person-form.test.tsx`
  - `node scripts/check-test-quality.mjs apps/web/lib/today.test.ts`
  - `node scripts/check-test-quality.mjs apps/web/components/person-form.test.tsx`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- as linhas de import dos done são as únicas imports, cada nome nelas é utilizado e nada mais é importado
- today.test.ts possui a linha describe do vitest e a linha ./today, e person-form.test.tsx possui a linha describe do vitest, a linha vi do vitest, a linha testing-library, a linha mock-data e a linha ./person-form
- um write_file por arquivo de teste, em seguida execute run_check 0, 1, 2, 3, 4 e 5
- todayInBrt recebe uma Date criada a partir do texto instantâneo e retorna IsoDate de @pilla/finance, uma string brandida, portanto toBe contra o texto puro funciona e não é necessária importação de tipo
- renderize PersonForm com people definido como mockPeople e onSubmit configurado para um const criado com vi.fn, executando o renderização uma vez por teste
- preencha cada campo utilizando fireEvent.change em screen.getByLabelText com o texto completo do rótulo e um alvo cujo valor seja o texto; no caso do select Indicado por, utilize a opção cujo valor seja o id da pessoa
- 01936f8e-7b2c-7cde-8f00-000000000003 corresponde a João Pereira em mockPeople, enquanto Nome completo, CPF e Telefone recebem Maria da Silva, 52998224725 e +5511987654321
- o corpo esperado do primeiro teste é o objeto contendo fullName, cpf e phone sem outras chaves, e o teste referente adiciona referredById
- o clique deve ser executado via fireEvent.click em screen.getByRole com role button e name Cadastrar, nunca getByText
- como o submit é assíncrono, utilize await screen.findByRole com role status ou alert, mantenha esse elemento e verifique-o com toHaveTextContent; evite await expect de uma promessa findBy, e as verificações de onSubmit devem ocorrer após isso
- apps/web/app/page.test.tsx é o modelo, e não há userEvent no projeto, apenas @testing-library/react

### E7-T02 — Implemente todayInBrt

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T01`
- Referências: [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md), [RFC-002](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-002-motor-de-calculo-financeiro.md)
- Ler antes: `apps/web/lib/today.ts`, `apps/web/lib/today.test.ts`, `packages/finance/src/index.ts`
- Skills: `editar-arquivo`, `coding-guidelines`

**DoD (definição de pronto)**
- todos os testes em apps/web/lib/today.test.ts passam com 100% de cobertura de linha e ramo de today.ts (run_check 0)
- a linha de import type e o valor import de today.ts permanecem como estão: 'import { isoDate, type IsoDate } from "@pilla/finance";' (uma linha)
- o dia provém do deslocamento de now por um offset UTC−3 fixo (10_800_000 ms, uma constante nomeada com comentário) e da extração dos primeiros 10 caracteres de toISOString, e o texto recebe sua marcação via isoDate de @pilla/finance, nunca via as
- o parâmetro perde o sublinhado inicial; o comentário /** */ é reescrito para descrever o offset fixo, e a RangeError de uma data inválida provém de toISOString
- today.ts não possui a linha '// @stub E7-T02' e apps/web/vitest.config.ts não possui linha que exclui lib/today.ts
- Pode alterar: `apps/web/lib/today.ts`, `apps/web/vitest.config.ts`
- Testes protegidos: `apps/web/lib/today.test.ts`
- Verificações:
  - `pnpm --filter @pilla/web exec vitest run lib/today.test.ts --coverage --coverage.include=lib/today.ts --coverage.exclude=none --coverage.thresholds.lines=100 --coverage.thresholds.branches=100`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- o texto da data de toISOString já está no formato AAAA-MM-DD, portanto slice(0, 10) fornece o texto que isoDate espera; não é necessário Intl
- um write_file de today.ts, seguido de um edit_file de apps/web/vitest.config.ts que remove a linha com o stub E7-T02, e em seguida run_check 0, 1 e 2

### E7-T03 — Implemente o componente PersonForm

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E7-T01`
- Referências: [PRD-001 RF-01](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RF-03](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [ADR-0013](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0013-estado-no-frontend.md), [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- Ler antes: `apps/web/components/person-form.tsx`, `apps/web/components/person-form.test.tsx`, `packages/schemas/src/api/people/create-person.ts`
- Skills: `editar-arquivo`, `react-best-practices`, `react-best-practices#rerender-derived-state-no-effect`

**DoD (definição de pronto)**
- todos os testes em apps/web/components/person-form.test.tsx passam com pelo menos 85% de cobertura de person-form.tsx (run_check 0)
- {'as linhas de importação de tipo de person-form.tsx permanecem; a importação de valor de @pilla/schemas pode compartilhar uma linha com suas importações de tipo': 'import { createPersonRequest, type CreatePersonRequest, type PersonSummary } from "@pilla/schemas";'}
- import { useState } from "react";
- import { useForm } from "react-hook-form";
- o formulário utiliza useForm do react-hook-form tipado com PersonFormValues e register em cada campo, com todos os valores padrão ""
- o campo "Nascimento" é um input de texto (não type="date") para que uma data de nascimento inválida chegue a createPersonRequest e exiba o alerta (C9)
- o submit constrói o corpo sem os campos opcionais vazios e valida-o com createPersonRequest.parse dentro de try e catch; o catch exibe o alerta do comentário /** */
- manter "use client", as interfaces, a assinatura e o comentário /** */ inalterados, exceto que os props são destruturados sem aliases de sublinhado e o input de data de nascimento é type="text" (como dito na linha acima), não type="date"
- person-form.tsx não possui a linha '// @stub E7-T03' e apps/web/vitest.config.ts não possui uma linha que exclua o componente components/person-form.tsx
- Pode alterar: `apps/web/components/person-form.tsx`, `apps/web/vitest.config.ts`
- Testes protegidos: `apps/web/components/person-form.test.tsx`
- Verificações:
  - `pnpm --filter @pilla/web exec vitest run components/person-form.test.tsx --coverage --coverage.include=components/person-form.tsx --coverage.exclude=none`
  - `pnpm --filter @pilla/web typecheck`
  - `pnpm --filter @pilla/web lint`

**Dicas**
- os rótulos, as opções de seleção, o botão e as duas mensagens estão escritos no comentário /** */ de person-form.tsx, copie-os de lá
- mantenha o resultado em useState, seja sucesso ou erro, e exiba o status ou o alerta a partir dele
- cada rótulo envolve seu campo ou aponta para ele com htmlFor e id, para que getByLabelText o encontre
- onSubmit é opcional, portanto chame-o com encadeamento opcional
- um write_file de person-form.tsx, em seguida um edit_file de apps/web/vitest.config.ts que remove a linha com o stub E7-T03, e depois run_check 0, 1 e 2

## Referências

- PRD: [docs/prd/PRD-001-mvp-gestao-emprestimos.md](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md)
- [RFC-005 persons](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-005-modelo-fisico-banco.md)
- [docs/plano/decisoes-2026-11-17.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/decisoes-2026-11-17.md)
- [RFC-002](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-002-motor-de-calculo-financeiro.md)
- [ADR-0013](https://github.com/fsilvajoel/pilla/blob/main/docs/adr/0013-estado-no-frontend.md)
- plano.md: [docs/plano/E7-F01/plano.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F01/plano.md)
- revisao.md: [docs/plano/E7-F01/revisao.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E7-F01/revisao.md)

## Telas

_Sem telas._

## Estado

- Etapa: done
- Progresso: 100%
- Bloqueio: não
- `E7-T01`: done
- `E7-T02`: done
- `E7-T03`: done
