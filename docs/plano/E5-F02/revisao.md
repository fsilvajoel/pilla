# Revisão final E5-F02 (fechamento do E5, 23/11)

revisor: reviewer
base: `3faea69` (docs/mvp-planning); teste `person-repository.test.ts` b78b1319d1e85282b19c11271ca4ebf1db8be927 (= sha assinado em `estado.json:127`)

## Critérios de aceite
- [x] A1 — `person-repository.ts:8-10`: `await db.insert(persons).values(row)`, sem retorno. C1 (`person-repository.test.ts:19-58`): `resolves.toBeUndefined()` e linha literal com email, birth_date, referred_by_id e notes nulos, active true, version 1.
- [x] A2 — mesmo código; C2 (`test.ts:60-109`): João com `cpf` nulo e `referredById` da Ana, todos os campos literais (RN-P01 permite nulo, RN-P02 indicador existente).
- [x] A3 — `person-repository.ts:9`: sem if/try/catch; o erro do banco sobe. C3 (`test.ts:111-132`) exige `cause.message` com `persons_cpf_key`, que bate com `migrations/people/0001_people_tables.sql:58` (índice único parcial, só não nulos).
- [x] A4 — `person-repository.ts:13-16`: `select().from(persons).where(eq(persons.id, id))` e `rows[0] ?? null`. C4 (`test.ts:147-176`): camelCase, `birthDate` texto (`schema.ts:29`, `date()` modo string), `createdAt`/`updatedAt` `Date`, sem chave snake_case; C5 (`test.ts:178-182`): `null`.
- [x] A5 — 100% linhas/ramos/funções de `person-repository.ts` (3/3, 2/2, 2/2); typecheck e lint verdes; sem `@stub E5` em `apps/api/src` nem exclusão em `vitest.config.ts`.

Contrato: imports, `NewPersonRow` e as duas assinaturas batem literalmente com `plano.md:23-31` e com o `done` do E5-T06 (`E5.yaml`). Sem `any`, `@ts-ignore` nem `eslint-disable`. `NewPersonRow` já é consumido por `person-update.ts:3` (E5-F05), sem quebrar.

## Gates (rodados nesta revisão)
| Gate | Resultado |
|---|---|
| `vitest run person-repository.test.ts --coverage` (check do E5-T06) | PASS (5/5, 100%) |
| `pnpm --filter @pilla/api typecheck` / `lint` | PASS / PASS |
| `pnpm gate tests-reviewed E5-F02` | PASS (sha assinado = sha do arquivo) |
| `pnpm gate coverage E5-F02` | PASS |
| `pnpm gate e2e E5-F02` | PASS (nenhum critério e2e) |
| `pnpm gate mutation E5-F02` | não rodado de novo: "nada a medir" (`domainSources` vazio), aceito pelo plano (infra pura) e pelo D4 |

## Achados da rodada anterior
- RN-P01 citada no comentário (`person-repository.ts:7`): resolvido.
- `testes.md` presente (`docs/plano/E5-F02/testes.md`): resolvido.
- `stages.testReview`/`implement` em `done`: resolvido.
- Mutação sem medição: aceita; registrada e fechada em `docs/defeitos/D4.md`.

## Coerência das demais features do E5 (estado.json x código x testes)
Conferido: todo `scenarios[].teste` existe no `arquivo` citado; todo arquivo de `tests` existe e tem o sha assinado; `tests-reviewed`, `coverage` e `e2e` rodados de novo; os `domainSources` (ids.ts, loan-status.ts, reversal.ts) não mudaram depois da medição de mutação registrada. 64/64 testes verdes nos arquivos de teste do E5 mais `persons.test.ts`.
- E5-F01 (ids, audit): coerente; tests-reviewed, coverage (100%) e e2e PASS.
- E5-F03 (loan-status): coerente; PASS nos três.
- E5-F04 (reversal): coerente; PASS nos três.
- E5-F05 (update, write-error, list): **incoerente hoje**. `pnpm gate coverage E5-F05` dá FAIL: `person-list.ts` com lines 38/39, branches 18/20. O E9-T06 (`16898f6`, mesclado em `340ff7f`) mudou `person-list.ts` depois da revisão aprovada (`967acd2`): fold de acento (`person-list.ts:40-50`) e guarda de regex (`person-list.ts:59-61`), que deixam `person-list.ts:64` e o ramo acentuado de `person-list.ts:44` sem teste nos arquivos de `tests` da E5-F05. `defensive-branches.test.ts:49` e `person-list.d5.test.ts` cobrem a linha 64, mas não estão em `tests` de nenhum `estado.json`, e o ramo da linha 44 continua sem cobertura mesmo com eles (95% de ramos). O `review: done` da E5-F05 vale para o código de 19/11, não para o HEAD. Além disso, `estado.json` da E5-F05 só tem os gates `expect-red` e `tests-reviewed`; sem `coverage`, `mutation` e `e2e` gravados, o `status.py` a deixa em `mutation_e2e` (88%) e o E5 não chega a 100%.
  - fora do escopo desta revisão (E5-F02); não alterado aqui. Ação do orquestrador: abrir `docs/defeitos/D6.md` (origem `revisão`, feature E5-F05, camada unit) para cobrir o ramo acentuado e a busca só de pontuação nos testes da feature (ou incluir os arquivos em `tests`) e rodar `pnpm gate coverage E5-F05` de novo.

## Lacunas
- nenhuma em critério de aceite da E5-F02.

## Veredito
aprovado (E5-F02). Ressalva para o fechamento do E5: E5-F05 com gate coverage em FAIL no HEAD, acima.

# Revisão final E5-F02

revisor: reviewer
diff: `git diff HEAD` (base ff464a4, casca do stub); teste b78b1319d1e85282b19c11271ca4ebf1db8be927 (= sha assinado)

## Critérios de aceite
- [x] A1 — `person-repository.ts:8-10`: `await db.insert(persons).values(row)`, sem retorno; C1 (`person-repository.test.ts:19-58`) prova `resolves.toBeUndefined()` e a linha literal com email, birth_date, referred_by_id e notes nulos, active true, version 1.
- [x] A2 — mesmo código; C2 (`test.ts:60-109`) grava João com `cpf` nulo e `referredById` da Ana e lê todos os campos literais.
- [x] A3 — `person-repository.ts:9`: sem try/catch, sem if, sem tradução; o `DrizzleQueryError` sobe. C3 (`test.ts:111-132`) exige `cause.message` contendo `persons_cpf_key`; tradução quebraria o teste.
- [x] A4 — `person-repository.ts:13-16`: `select().from(persons).where(eq(persons.id, id))` e `rows[0] ?? null`. C4 (`test.ts:147-176`) prova camelCase, `birthDate` texto (`schema.ts:30`, `date()` modo string), `createdAt`/`updatedAt` `Date` e ausência de chave snake_case; C5 (`test.ts:178-182`) prova `null`.
- [x] A5 — 100% de linhas e ramos de `person-repository.ts`; typecheck e lint verdes; sem `@stub` no arquivo e sem exclusão no `vitest.config.ts:12`.

Contrato: imports, `NewPersonRow` e as duas assinaturas batem literalmente com o plano (`person-repository.ts:1-5,8,13`). Sem `any`, `@ts-ignore` nem `eslint-disable` nos dois arquivos.

## Gates
| Gate | Resultado |
|---|---|
| `vitest run src/people/infra/person-repository.test.ts` | PASS (5/5) |
| `pnpm --filter @pilla/api typecheck` / `lint` | PASS / PASS |
| `pnpm gate tests-reviewed E5-F02` | PASS (1 teste com sha assinado) |
| `pnpm gate coverage E5-F02` | PASS (100% em `person-repository.ts`) |
| `pnpm gate mutation E5-F02` | PASS **sem medição**: "nada a medir: `domainSources` vazio e nenhum critério mut" |
| `pnpm gate e2e E5-F02` | PASS (nenhum critério e2e) |
| `pnpm verify` | verde |

## Diff
- Escopo do implementer (E5-T06 `allowedPaths`): só `person-repository.ts` e `vitest.config.ts`. Ok.
- Fora do escopo da feature na árvore de trabalho (não é do implementer): `harness.project.yaml` e `.claude/agents/refiner.md` (mudança de harness, planner no Copilot) e arquivos `issue.*` de outras features.
- Achados (nenhum bloqueante):
  - baixa — gate de mutação passou sem medir nada (`estado.json` `domainSources: []`). Coerente com o plano (infra, sem regra de domínio), mas o PASS não é evidência de qualidade do teste; a robustez vem só da revisão manual (C1-C5 não aceitam retorno arbitrário).
  - baixa — `estado.json`: `stages.testReview` e `stages.implement` seguem `pending` com `tests-reviewed`, `coverage` e `mutation` em PASS; o orquestrador acerta as etapas.
  - baixa — `person-repository.ts:7`: o comentário não cita RN-P01 (AGENTS.md §8, "IDs das regras citados no código"); a regra é aplicada pelo banco, não pelo código.
  - baixa — `harness.project.yaml` e `.claude/agents/refiner.md` alterados na mesma árvore: o commit da E5-F02 não deve levá-los.
  - observação — continua faltando `docs/plano/E5-F02/testes.md` (rodadas 1 e 2 da revisão dos testes).

## Lacunas
- nenhuma em critério de aceite. Os demais erros do banco da tabela de domínio (phone, cpf fora do padrão, fkey, auto-indicação) ficam provados em `persons.test.ts`, como o plano declara.

## Defeitos abertos
Os achados baixos acima não foram corrigidos nesta revisão; o orquestrador registra em `docs/defeitos/D<n>.md` (próximo livre: D4), origem `revisão`, feature E5-F02, e cita aqui.
- pendente de registro: mutação sem medição; estágios do `estado.json`; RN-P01 sem citação no código; falta `testes.md`.

## Veredito
aprovado

# Revisão dos testes E5-F02 (rodada de ajuste)

revisor: reviewer
rodada: 2 (delta de C3 e C4)
arquivo: apps/api/src/people/infra/person-repository.test.ts b78b1319d1e85282b19c11271ca4ebf1db8be927

Mecânico: `pnpm gate expect-red E5-F02` PASS (5 testes, todos falhando contra a casca); `check-test-quality.mjs` ok; typecheck e lint de `@pilla/api` verdes; `person-repository.ts` e `vitest.config.ts` sem diff contra o HEAD.

- [x] C3 (A3) — linhas 121-132: `rejects.toMatchObject({ cause: { message: stringContaining("persons_cpf_key") } })`. Esperado literal; o nome bate com o índice único parcial da migration (`apps/api/migrations/people/0001_people_tables.sql:58`). Olhar a `cause` é o certo no drizzle 0.45 (`DrizzleQueryError` embrulha o erro do Postgres). Uma implementação que traduza o erro de CPF agora falha o teste: fecha o achado médio da rodada 1.
- [x] Cast `as string` (linha 130) — necessário: `expect.stringContaining` é tipado `(expected: string) => any` no vitest; sem o cast o lint dá `130:16 @typescript-eslint/no-unsafe-assignment` (conferido com eslint via stdin). Não esconde `any` no teste.
- [x] C4 (A4) — linhas 147-176: `updatedAt` `toBeInstanceOf(Date)` e lista literal de seis chaves snake_case ausentes em `Object.keys(person)`. Fecha o achado baixo da rodada 1.
- [x] Esperados literais; nada calculado a partir da entrada; sem `any`.
- [x] C1, C2 e C5 sem mudança.

Achados: nenhum bloqueante.
- observação: segue faltando `docs/plano/E5-F02/testes.md` (rodada 1).

Veredito: aprovado. Orquestrador assina `pnpm gate tests-reviewed E5-F02 --sign`.

# Revisão dos testes E5-F02

revisor: reviewer
rodada: 1
arquivo: apps/api/src/people/infra/person-repository.test.ts 4d858baf886d095d136461b67d2808c69e2d94a6

Mecânico: `pnpm gate expect-red E5-F02` PASS (5 testes, todos falhando contra a casca); `check-test-quality.mjs` ok; typecheck e lint verdes; `person-repository.ts` e `vitest.config.ts` sem diff contra o HEAD.

- [x] every test fails now against the stub in HEAD — expect-red PASS; os 5 falham com `esboço: não implementado` (casca lança síncrono, linhas 21-28, 62, 113, 151, 171).
- [x] os 5 imports do `done` — linhas 1-5, exatamente esses, todos usados.
- [x] Maria (C1/A1) — linhas 19-58: `resolves.toBeUndefined()` e `toEqual` de linha literal com email, birth_date, referred_by_id e notes nulos, active true, version 1.
- [x] Ana e João (C2/A2) — linhas 60-109: todos os campos literais, cpf null, `referred_by_id` igual ao id da Ana (constante literal da linha 61).
- [x] Rui e Rui Filho (C3/A3) — linhas 111-129: primeiro insert ok, segundo com o mesmo cpf `rejects.toThrow()`.
- [x] Carla (C4/A4) — linhas 144-167: inserida por SQL, `toMatchObject` em camelCase com os padrões e `createdAt` `toBeInstanceOf(Date)`.
- [x] id inexistente (C5/A4) — linhas 169-173: `toBeNull()`.
- [x] never edit person-repository.ts — sem diff contra o HEAD.
- [x] A5 — gate coverage na etapa 4 (não é teste desta etapa).

Achados (nenhum bloqueante):
- média — linha 128: `rejects.toThrow()` sem matcher não prova o erro exato da tabela de domínio (`persons_cpf_key`) nem o "sem tradução" do A3; uma implementação que traduza o erro passaria. Segue o `done` do cartão e o precedente de `audit.test.ts:116`; o "sem try/catch" fica para a revisão final (E5-T06 `done`). Se for apertar, o drizzle 0.45 embrulha o erro (`DrizzleQueryError`), então o matcher teria de olhar a `cause`.
- baixa — linhas 153-166: `toMatchObject` é parcial; não confere `updatedAt` nem a ausência de chave em snake_case. Coerente com o plano (C4).
- observação: falta `docs/plano/E5-F02/testes.md` (molde `feature-artefatos/testes.md`); os cenários estão só em `estado.json`.

Veredito: aprovado (conteúdo dos testes). Assinatura pendente: `pnpm gate tests-reviewed E5-F02 --sign` deu FAIL "A5: sem scenario da camada unit com arquivo em `tests`"; A5 é critério de gate (coverage, typecheck, lint), sem `C<n>` no plano. O orquestrador acerta o `estado.json` (tirar A5 de `criteria`, como na E6-F01, ou mapeá-lo) e assina; os testes não mudam.

# Refinamento funcional E5-F02

refinador: refiner
rodada: 1

## Requisitos
- [x] Todo `A<n>` é observável e está no molde fixo (entrada, domínio, saída, erro, fonte, camada): ajustado (A1 a A5 reescritos com camada e fonte).
- [x] Toda regra tem fonte; toda entrada externa tem linha na tabela de domínio, com rejeição e erro exato: ajustado (tabela criada).
- [ ] Contrato, arquivos de produção, dependências e arquivos de teste previstos bastam: contrato e dependências completados, mas a **casca não existe no HEAD** (ação do orquestrador, abaixo).

## Cartões
| Cartão | DoR | DoD |
|---|---|---|
| E5-T05 | ajustado (readFirst ganhou o plano; `person-repository.ts` e a exclusão no vitest.config.ts ainda não existem) | ok |
| E5-T06 | ajustado (readFirst ganhou o plano; depende da mesma casca) | ajustado (assinaturas literais no `done`) |

## Veredito
ajustado (sem pergunta de PM bloqueante; três entradas abertas na fila são do `createPerson`, fora do escopo)

Condição para a etapa 2: o orquestrador criar a casca (arquivo com `// @stub E5-T06`, `NewPersonRow`, duas funções lançando, e a linha de exclusão em `coverage.exclude` do `apps/api/vitest.config.ts`) e o `estado.json` (`sources` = `person-repository.ts`, `domainSources` = [], `criteria` A1 a A5 unit, `tests`, `e2e` [], `stages.plan = done`, `stages.refinement` com `verdict` ajustado e `round` 1).

## Mudanças
- `docs/plano/E5-F02/plano.md`: seções Contrato, Domínio das entradas e Dependências reescritas; A1 a A5 no molde com camada; cenários com o critério (fonte: RFC-005 §3, RN-P01, RN-P02, PRD-001 RF-04, `core/public/audit.ts` para o tipo do db).
- `docs/plano/E5.yaml` E5-T05 e E5-T06: `readFirst` com o plano; E5-T06 `done` com as assinaturas literais (fonte: contrato do plano).
- `docs/plano/pendencias-pm.md`: três entradas (CPF duplicado, indicador inexistente, CPF obrigatório no cadastro).
- Observação: o `rejects.toThrow` do C3 é genérico; o erro exato (mensagem do PGlite/drizzle) não está provado e não foi inventado.

## Pendências de PM
- E5-T06: código de erro de CPF duplicado no `createPerson` (não bloqueia).
- E5-T06: erro de indicador inexistente no `createPerson` (não bloqueia).
- E5-T06: CPF obrigatório no cadastro novo (não bloqueia).

## Rodada 2
Respostas de PM aplicadas em `docs/plano/pendencias-pm.md` (409 `DUPLICATE_CPF`; 404 `NOT_FOUND` para indicador inexistente; CPF obrigatório e válido no cadastro, nulo só na importação). Não alteram o escopo da E5-F02: `createPerson` segue fora.

## Limitação conhecida
O gate de mutação passou sem medir nada (`domainSources` vazio); o repositório não tem mutação medida nesta feature.
