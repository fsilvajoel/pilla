# AGENTS.md — Guia para agentes construtores do pilla

Vale para **todo agente** que escreve código aqui: Claude (tech lead), Alice (modelo local) e qualquer outro.
Documentação em pt-BR; código em inglês ([ADR-0012](docs/adr/0012-idioma-codigo-ingles-docs-portugues.md)).

> Princípio: **documento orienta, máquina obriga.** Toda regra importante deste guia tem uma trava automática (teste, tipo, lint, CI ou o ambiente da Alice). Regra sem trava é exceção e está marcada.

---

## 1. Antes de qualquer tarefa

1. Leia [docs/README.md](docs/README.md), o [glossário](docs/glossario.md) e os documentos citados na tarefa.
2. Só implemente o que está em PRD/RFC **Aprovado** e ADR **Aceito**.
3. Toda tarefa tem um **cartão de tarefa** (§6). Sem cartão, não comece.
4. **Nunca invente.** Não sabe como uma biblioteca funciona? Siga §8 (documentação oficial ou pergunta). Código baseado em suposição é rejeitado na revisão.
5. Encontrou conflito ou lacuna nos documentos? **Pare e pergunte.** Não decida regra de negócio.

## 2. Papéis

| Quem | Faz | Não faz |
|---|---|---|
| **Joel** | decide produto e arquitetura; aprova docs e PRs; faz merge | — |
| **Claude** (tech lead) | recorta tarefas; escreve **assinaturas, testes e travas**; arquitetura, segurança, integração entre módulos; responde dúvidas da Alice; revisa; comita | ficar no meio do ciclo de tentativa e erro da Alice |
| **Alice** (local) | implementa até os testes passarem; código repetitivo; rascunhos de docs/PR; resumos; pesquisa em docs oficiais | alterar testes, configs, docs aprovados, dependências; segurança/autenticação; comitar |

### Economia de tokens do Claude (regra de operação)
- O ciclo **tentar → testar → corrigir** roda no ambiente da Alice (GPU local); o Claude só recebe o **resultado aprovado** pelas travas.
- O retorno ao Claude é **compacto**: status, testes, arquivos, linhas, perguntas. Nunca o histórico da Alice.
- Pedidos à Alice apontam **caminhos de arquivo**; conteúdo não é colado na conversa do Claude.
- Leitura e resumo de arquivos/logs grandes: delegue à Alice; o Claude lê só o necessário.
- Revisão proporcional ao risco (§10).
- Cada execução registra tokens da Alice; acompanhamos a economia por tarefa.

## 3. Fluxo de trabalho (TDD)

```
1. Claude: cartão de tarefa + assinaturas (tipos/interfaces, corpo `throw new Error('not implemented')`)
2. Claude: testes que falham, cada um citando o ID da regra (CA-xx, T-xx, RN-xx)
3. Claude: commit "test: ..." no branch da tarefa  → os testes ficam PROTEGIDOS
4. Alice: implementa no ambiente dela até a verificação completa passar (§9)
5. Alice: dúvida → docs oficiais ou ask_claude (§8)
6. Ambiente: verificação final + checagem do diff → relatório compacto ao Claude
7. Claude: revisão (§10) → commit "feat: ..." com Co-Authored-By da Alice → PR
8. Joel: aprova e faz merge
```

Testes vêm **antes** do código e são escritos por quem **não** implementa. Quem implementa não altera teste.

## 4. Travas (guardrails) por camada

Coluna "Quando": `E0` = entra no esqueleto do projeto; `E1+` = entra junto com o primeiro código do tipo; `Futuro` = planejado.

### 4.1 Especificação executável (testes)
| Trava | Detalhe | Quando |
|---|---|---|
| Testes com ID | `it('CA-12 rounds 92.50 to 95', ...)`; toda regra RN/CA/T tem teste | E1+ |
| Testes de propriedade | fast-check com semente fixa: soma das parcelas = total; alocação = valor pago; nenhum valor negativo; arredondamento sempre múltiplo do passo | E1+ |
| Exemplos de ouro | casos do PRD (CA-01…) e da planilha anonimizada como dados de teste fixos | E1+ |
| Cobertura mínima | `packages/finance`: 100% linhas e ramos; módulos: 85%; falha o CI abaixo disso | E0 |
| Teste de mutação | Stryker em `packages/finance`; score mínimo 90% (garante que os testes pegam erro de verdade) | E1+ |
| Testes de contrato da API | respostas validadas contra os esquemas de `packages/schemas` (RFC-004) | E2+ |
| Testes de isolamento do portal | CA-09/09b: CPF A nunca vê dados de B; limite por IP | E6 |
| Testes de integração | PostgreSQL real (Testcontainers), todas as migrações aplicadas | E2+ |
| Determinismo | relógio e gerador de id **injetados**; teste sem rede; sem `sleep` | E0 |

### 4.2 Tipos
| Trava | Detalhe | Quando |
|---|---|---|
| TypeScript máximo | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `useUnknownInCatchVariables` | E0 |
| Tipos de marca (branded) | `Cents`, `Bps`, `IsoDate`, `PersonId`, `LoanId`… impossível somar `Cents` com `Bps` ou trocar ids | E1 |
| Dinheiro só `bigint` | `Cents = bigint & {__brand}`; conversão só por funções de `packages/finance` | E1 |
| Fronteiras com Zod | toda entrada externa (HTTP, evento, CSV, env) passa por `schema.parse`; dentro do sistema só tipos já validados | E2+ |
| Variáveis de ambiente validadas | `env.ts` com Zod; app não sobe com config inválida | E0 |

### 4.3 Lint (ESLint) — proibições
| Proibido | Por quê | Quando |
|---|---|---|
| `any`, `as` (exceto em testes), `!` (non-null) | burla os tipos | E0 |
| `@ts-ignore`, `@ts-nocheck`, `eslint-disable` | burla as travas (só com aprovação do Claude e justificativa) | E0 |
| `parseFloat`, `Number()`, `Math.*`, literal decimal em `packages/finance` e domínios | dinheiro em ponto flutuante ([ADR-0004](docs/adr/0004-dinheiro-em-centavos.md)) | E1 |
| `new Date()`, `Date.now()` em `domain/` | relógio deve ser injetado | E0 |
| `console.*` | usar o logger | E0 |
| `.only`, `.skip`, `expect(true)` em testes | teste desligado/inútil | E0 |
| SQL por concatenação de string | injeção | E2 |
| `export default` | nomes estáveis para busca e refatoração | E0 |
| textos pt-BR fora do arquivo de mensagens | [ADR-0012](docs/adr/0012-idioma-codigo-ingles-docs-portugues.md) | E2+ |

### 4.4 Arquitetura (dependency-cruiser + testes de arquitetura)
| Regra | Quando |
|---|---|
| módulo A só importa de `modules/B/public/` | E0 |
| `domain/` não importa framework (NestJS, Drizzle, Zod de HTTP) | E0 |
| `packages/finance` não importa nada do projeto nem bibliotecas externas | E0 |
| `apps/web` não importa de `apps/api` (só `packages/*`) | E0 |
| rotas do portal não importam DTOs do ADMIN | E6 |
| sem ciclos de importação | E0 |
| repositórios de um módulo só referenciam tabelas do próprio schema (teste de arquitetura sobre os schemas Drizzle) | E2 |

### 4.5 Banco
| Trava | Quando |
|---|---|
| restrições da [RFC-005](docs/rfc/RFC-005-modelo-fisico-banco.md) (CHECK, UNIQUE, NOT NULL) — o banco recusa dado inválido mesmo se o código falhar | E2+ |
| migrações só para frente; CI verifica que o schema gerado bate com as migrações (`drizzle-kit check`) | E2 |
| migração já mergeada é **imutável** (CI compara hash) | E2 |
| tabelas append-only sem `UPDATE`/`DELETE` no código (lint/teste) | E4 |

### 4.6 Invariantes em tempo de execução
O domínio verifica e **lança erro** se violar: soma das alocações = valor do pagamento; soma das parcelas = total do contrato; saldo nunca negativo; transição de status permitida pela máquina de estados (RFC-001). | E1+

### 4.7 Segurança e dados
| Trava | Quando |
|---|---|
| gitleaks (pre-commit e CI): nenhum segredo no git | E0 |
| `.env` fora do git; `.env.example` sempre sincronizado (script de CI compara as chaves) | E0 |
| logger com redação automática de `cpf`, `phone`, `email`, `password`, `token` | E0 |
| dados de teste só fictícios; gerador de CPF válido falso; proibido dado da planilha real | E0 |
| `pnpm audit` no CI (falha em vulnerabilidade alta) | E0 |
| **lista de dependências permitidas**: CI falha se `package.json` ganhar dependência fora da lista (§11); nova dependência = pedido ao Claude/Joel | E0 |
| lockfile congelado no CI (`pnpm install --frozen-lockfile`) | E0 |
| cabeçalhos de segurança e CORS restrito na API | E2 |

### 4.8 Git, PR e CI
| Trava | Quando |
|---|---|
| commits em inglês no padrão Conventional Commits (commitlint) | E0 |
| hooks locais (lefthook): pre-commit = format + lint + gitleaks; pre-push = typecheck + testes | E0 |
| CI obrigatório: install, typecheck, lint, fronteiras, testes, cobertura, gitleaks, audit, dependências permitidas | E0 |
| `main` protegida: só via PR, CI verde e aprovação do Joel | E0 (configurar no GitHub) |
| CODEOWNERS: `docs/adr/`, `docs/prd/`, `AGENTS.md`, configs de lint/CI → Joel | E0 |
| modelo de PR (pt-BR) com checklist: IDs, testes, docs, prints | E0 |
| PR pequeno: aviso acima de 400 linhas alteradas (exceto gerados) | E0 |

### 4.9 Ambiente da Alice (`alice-harness`)
| Trava | Detalhe |
|---|---|
| Ferramentas permitidas | `list_files`, `read_file`, `search_code`, `write_file`, `run_check`, `web_search`, `fetch_page`, `ask_claude`, `finish`. Nada além (sem shell livre, sem git, sem rede livre) |
| Leitura | só dentro do repositório; bloqueados `.env*`, `.git/`, `node_modules/`, arquivos fora do repo (caminho real resolvido, sem `..` nem links simbólicos para fora) |
| Escrita | **só nos caminhos do cartão de tarefa** (`allowedPaths`) |
| Arquivos protegidos (nunca escreve) | `**/*.test.ts`, `**/*.spec.ts`, `test/**`, `docs/**`, `AGENTS.md`, `CLAUDE.md`, `package.json`, lockfile, `tsconfig*`, `eslint*`, `.dependency-cruiser*`, `vitest*`, `stryker*`, `.github/**`, migrações já existentes |
| `run_check` | comandos fixos do cartão (`pnpm --filter X test` etc.), com tempo limite; saída truncada |
| Web | `web_search` (Brave) e `fetch_page` só em domínios oficiais (§8); texto da web marcado como **dado não confiável** no contexto dela |
| Limites | até 5 tentativas por tarefa, 25 chamadas de ferramenta por tentativa, arquivo escrito ≤ 400 linhas, tempo total configurável |
| Verificação final | o próprio ambiente roda a verificação completa (§9) antes de reportar sucesso |
| Checagem do diff | rejeita se: tocou fora de `allowedPaths`; introduziu `any`, `@ts-ignore`, `eslint-disable`, `.only`, `.skip`, `TODO` sem ID, `console.`; adicionou dependência |
| Relatório compacto | status, testes, arquivos, linhas, tokens usados, perguntas pendentes |
| Registro | cada execução em `runs/<tarefa>/` (JSONL com chamadas e tokens), fora do repositório |

## 5. Estrutura e convenções

Estrutura: [RFC-003 §4.1](docs/rfc/RFC-003-stack-tecnologica.md). Cada módulo da API:
```
modules/<module>/
  public/   # única porta de entrada para outros módulos (serviços, tipos, eventos)
  domain/   # entidades, regras, máquina de estados — TS puro
  infra/    # repositórios Drizzle, schema do banco do módulo
  http/     # controllers e DTOs (Zod de packages/schemas)
```
- Nomes: [glossário](docs/glossario.md). Termo novo entra no glossário antes do código.
- Dinheiro, taxas, datas, erros e eventos: [RFC-004 §2](docs/rfc/RFC-004-api-e-eventos.md).
- Erros de domínio: classes com `code` do catálogo (RFC-004 §6); texto pt-BR só no arquivo de mensagens.
- Um arquivo, uma responsabilidade; funções puras sempre que possível.
- Comentário explica **por quê**, não o quê; cite o ID da regra (`// RN-C03`).

## 6. Cartão de tarefa

Todo trabalho começa por um cartão (em `docs/plano/` ou na issue):

```yaml
id: E1-T03
title: Implement roundToStep
refs: [RN-C03, RFC-002 §2, T-13, CA-12]
dependsOn: [E1-T01]
assignee: alice            # alice | claude
allowedPaths:
  - packages/finance/src/rounding.ts
protectedTests:
  - packages/finance/src/rounding.test.ts
checks:
  - pnpm --filter @pilla/finance test -- rounding
  - pnpm --filter @pilla/finance typecheck
  - pnpm --filter @pilla/finance lint
done:
  - todos os testes de rounding.test.ts passam
  - cobertura 100% em rounding.ts
officialDocs: []           # links já conhecidos, se houver
budget: { attempts: 5, toolCalls: 25 }
```

## 7. Modelo de pedido para a Alice

O ambiente monta o pedido a partir do cartão:
```
Você é a Alice, desenvolvedora do projeto pilla. Tarefa: <id> — <title>.
Regras: siga AGENTS.md; código em inglês; NÃO altere testes; escreva só em <allowedPaths>.
Leia primeiro: <refs como caminhos de arquivo>, os testes protegidos, os arquivos vizinhos.
Pronto quando: <done>. Verifique com run_check.
Se não souber como algo funciona: web_search/fetch_page em documentação oficial, ou ask_claude.
NUNCA invente API, opção ou comportamento. Ao terminar, chame finish com um resumo de 3 linhas.
```

## 8. Dúvidas: documentação oficial ou pergunta (nunca invenção)

Ordem obrigatória quando faltar conhecimento:
1. **Documentos do projeto** (`docs/`, código vizinho).
2. **Documentação oficial** via `web_search` + `fetch_page`, só nestes domínios:
   `nodejs.org`, `typescriptlang.org`, `docs.nestjs.com`, `orm.drizzle.team`, `zod.dev`, `nextjs.org`, `react.dev`, `tailwindcss.com`, `ui.shadcn.com`, `react-hook-form.com`, `tanstack.com`, `vitest.dev`, `fast-check.dev`, `stryker-mutator.io`, `playwright.dev`, `testcontainers.com`, `node.testcontainers.org`, `postgresql.org`, `pnpm.io`, `turbo.build`, `eslint.org`, `typescript-eslint.io`, `developer.mozilla.org`, `github.com/<repositório oficial da biblioteca>`.
3. **`ask_claude`**: pausa a tarefa e envia **só a pergunta** (objetiva, com o trecho mínimo). O Claude pesquisa e devolve **só a resposta necessária**; a tarefa continua de onde parou.

Regra de negócio nunca é pesquisada na web: dúvida de negócio vai para `ask_claude` (e, se preciso, para o Joel).

## 9. Definição de pronto

- [ ] Testes do cartão passam; nenhum teste alterado por quem implementou.
- [ ] `typecheck`, `lint`, fronteiras (dependency-cruiser), cobertura e (em `finance`) mutação dentro dos mínimos.
- [ ] Sem `any`, `@ts-ignore`, `eslint-disable`, `.only/.skip`, `console.`, TODO sem ID.
- [ ] Nenhum arquivo fora de `allowedPaths`; nenhuma dependência nova.
- [ ] Nomes conforme glossário; textos pt-BR no arquivo de mensagens.
- [ ] IDs das regras citados no código (onde a regra é aplicada) e no PR.
- [ ] Docs atualizados se o comportamento mudou (feito pelo Claude).

## 10. Revisão do Claude (proporcional ao risco)

| Risco | Exemplos | Revisão |
|---|---|---|
| Baixo | código gerado de tabela (schemas, migrações), componentes simples | diff na diagonal; confia nas travas |
| Médio | regra de negócio coberta por teste | lê a lógica principal; confere IDs e nomes |
| Alto | dinheiro em fluxo entre módulos, autenticação, portal, eventos, migração com dados | leitura completa; pode pedir teste extra |

Checklist: faz sentido com o documento? Há atalho que passa no teste mas viola a regra? Algo inventado (API, opção) sem origem?

## 11. Dependências permitidas

Qualquer outra exige aprovação (Claude propõe, Joel aprova) e atualização desta lista.

- **Runtime API/worker**: `@nestjs/*`, `drizzle-orm`, `pg`, `zod`, `nestjs-zod`, `pino`, `nestjs-pino`, `argon2`, `pg-boss`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@nestjs/throttler`, `uuidv7`
- **Runtime web**: `next`, `react`, `react-dom`, `tailwindcss`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-query`, `zustand`, componentes shadcn/ui (código no repo) e suas dependências (`@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`)
- **`packages/finance`**: nenhuma
- **Dev**: `typescript`, `vitest`, `@vitest/coverage-v8`, `fast-check`, `@stryker-mutator/*`, `testcontainers`, `@testcontainers/postgresql`, `@playwright/test`, `eslint`, `typescript-eslint`, `dependency-cruiser`, `prettier`, `drizzle-kit`, `turbo`, `lefthook`, `@commitlint/*`, `tsx`

## 12. Commits e PRs

- Commit: inglês, Conventional Commits (`feat(lending): generate installment schedule`), cita IDs no corpo.
- PR: título em inglês; corpo em pt-BR (o que, por quê, IDs, como testar, riscos).
- Commit com código da Alice: `Co-Authored-By: Alice (local model) <alice@localhost>`.
- Nunca comitar `.env`, dados reais, arquivos gerados ou `runs/`.

## 13. Nunca

- `float` para dinheiro; segredo no código; dado pessoal real em teste ou log.
- Ler/escrever tabela de outro módulo; chamar o interior de outro módulo.
- Editar ADR aceita (cria-se outra que substitui), teste protegido ou trava para "fazer passar".
- Inventar comportamento de biblioteca ou regra de negócio.
- Push direto na `main`.
