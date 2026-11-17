# Travas (guardrails) por camada

> Detalhe do [AGENTS.md](../AGENTS.md). Travas do processo dos agentes (papéis, gates, ferramentas): [Harness-adaV1/](../Harness-adaV1/README.md).

Implementação da E0: configs na raiz, `packages/config/`, `scripts/` e `.github/` (`pnpm verify` roda tudo). Coluna "Quando": `E0` = entra no esqueleto do projeto; `E1+` = entra junto com o primeiro código do tipo; `Futuro` = planejado.

## 4.1 Especificação executável (testes)
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

## 4.2 Tipos
| Trava | Detalhe | Quando |
|---|---|---|
| TypeScript máximo | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `useUnknownInCatchVariables` | E0 |
| Tipos de marca (branded) | `Cents`, `Bps`, `IsoDate`, `PersonId`, `LoanId`… impossível somar `Cents` com `Bps` ou trocar ids | E1 |
| Dinheiro só `bigint` | `Cents = bigint & {__brand}`; conversão só por funções de `packages/finance` | E1 |
| Fronteiras com Zod | toda entrada externa (HTTP, evento, CSV, env) passa por `schema.parse`; dentro do sistema só tipos já validados | E2+ |
| Variáveis de ambiente validadas | `env.ts` com Zod; app não sobe com config inválida | E2 (junto com os apps) |

## 4.3 Lint (ESLint) — proibições
| Proibido | Por quê | Quando |
|---|---|---|
| `any`, `as` (exceto em testes), `!` (non-null) | burla os tipos | E0 |
| `@ts-ignore`, `@ts-nocheck`, `eslint-disable` | burla as travas; comentário de desligar regra não tem efeito (`noInlineConfig`) | E0 |
| `parseFloat`, `Number()`, `Math.*`, literal decimal em `packages/finance` e domínios | dinheiro em ponto flutuante ([ADR-0004](docs/adr/0004-dinheiro-em-centavos.md)) | E1 |
| `new Date()`, `Date.now()` em `domain/` | relógio deve ser injetado | E0 |
| `console.*` | usar o logger | E0 |
| `.only`, `.skip`, `expect(true)` em testes | teste desligado/inútil | E0 |
| SQL por concatenação de string | injeção | E2 |
| `export default` | nomes estáveis para busca e refatoração | E0 |
| textos pt-BR fora do arquivo de mensagens | [ADR-0012](docs/adr/0012-idioma-codigo-ingles-docs-portugues.md) | E2+ |

## 4.4 Arquitetura (dependency-cruiser + testes de arquitetura)
| Regra | Quando |
|---|---|
| módulo A só importa de `modules/B/public/` | E0 |
| `domain/` não importa framework (NestJS, Drizzle, Zod de HTTP) | E0 |
| `packages/finance` não importa nada do projeto nem bibliotecas externas | E0 |
| `apps/web` não importa de `apps/api` (só `packages/*`) | E0 |
| rotas do portal não importam DTOs do ADMIN | E6 |
| sem ciclos de importação | E0 |
| repositórios de um módulo só referenciam tabelas do próprio schema (teste de arquitetura sobre os schemas Drizzle) | E2 |

## 4.5 Banco
| Trava | Quando |
|---|---|
| restrições da [RFC-005](docs/rfc/RFC-005-modelo-fisico-banco.md) (CHECK, UNIQUE, NOT NULL) — o banco recusa dado inválido mesmo se o código falhar | E2+ |
| migrações só para frente; CI verifica que o schema gerado bate com as migrações (`drizzle-kit check`) | E2 |
| migração já mergeada é **imutável** (CI compara hash) | E2 |
| tabelas append-only sem `UPDATE`/`DELETE` no código (lint/teste) | E4 |

## 4.6 Invariantes em tempo de execução
O domínio verifica e **lança erro** se violar: soma das alocações = valor do pagamento; soma das parcelas = total do contrato; saldo nunca negativo; transição de status permitida pela máquina de estados (RFC-001). | E1+

## 4.7 Segurança e dados
| Trava | Quando |
|---|---|
| gitleaks (pre-commit e CI): nenhum segredo no git | E0 |
| `.env` fora do git; `.env.example` sempre sincronizado (script de CI compara as chaves) | E0 |
| logger com redação automática de `cpf`, `phone`, `email`, `password`, `token` | E2 (junto com os apps) |
| dados de teste só fictícios; gerador de CPF válido falso; proibido dado da planilha real | E2 (junto com os apps) |
| `pnpm audit` no CI (falha em vulnerabilidade alta) | E0 |
| **lista de dependências permitidas**: CI falha se `package.json` ganhar dependência fora da lista (ver "Dependências permitidas" abaixo); nova dependência = pedido ao Claude/Joel | E0 |
| lockfile congelado no CI (`pnpm install --frozen-lockfile`) | E0 |
| cabeçalhos de segurança e CORS restrito na API | E2 |

## 4.8 Git, PR e CI
| Trava | Quando |
|---|---|
| commits em inglês no padrão Conventional Commits (commitlint) | E0 |
| hooks locais (lefthook): pre-commit = format + lint + gitleaks; pre-push = typecheck + testes | E0 |
| CI obrigatório: install, typecheck, lint, fronteiras, testes, cobertura, gitleaks, audit, dependências permitidas | E0 |
| `main` protegida: só via PR, CI verde e aprovação do Joel | E0 (configurar no GitHub: pendente, Joel) |
| CODEOWNERS: `docs/adr/`, `docs/prd/`, `AGENTS.md`, configs de lint/CI → Joel | E0 |
| modelo de PR (pt-BR) com checklist: IDs, testes, docs, prints | E0 |
| PR pequeno: aviso acima de 400 linhas alteradas (exceto gerados) | E0 |

# Dependências permitidas

Qualquer outra exige aprovação (Claude propõe, Joel aprova) e atualização desta lista.

- **Runtime API/worker**: `@nestjs/*`, `drizzle-orm`, `pg`, `zod`, `nestjs-zod`, `pino`, `nestjs-pino`, `argon2`, `pg-boss`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@nestjs/throttler`, `uuidv7`
- **Runtime web**: `next`, `react`, `react-dom`, `tailwindcss`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-query`, `zustand`, `@pilla/schemas` e `@pilla/finance` (workspace), componentes shadcn/ui (código no repo) e suas dependências (`@radix-ui/*`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`)
- **`packages/finance`**: nenhuma
- **Dev**: `typescript`, `vitest`, `@vitest/coverage-v8`, `fast-check`, `@stryker-mutator/*`, `testcontainers`, `@testcontainers/postgresql`, `@playwright/test`, `eslint`, `typescript-eslint`, `dependency-cruiser`, `prettier`, `drizzle-kit`, `@electric-sql/pglite` (PostgreSQL em processo para testes de banco, sem Docker), `turbo`, `lefthook`, `@commitlint/*`, `tsx`, `@types/node` (tipos do Node só no código Node, ADR-0010 emenda 2026-11-15); web (RFC-003 §4.4): `@types/react`, `@types/react-dom`, `@tailwindcss/postcss`, `postcss`, `shadcn` (CLI e `shadcn/tailwind.css`), `@next/eslint-plugin-next`, `eslint-plugin-react-hooks`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `jsdom`

