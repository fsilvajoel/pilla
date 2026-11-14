# Plano de entrega

Cartões no formato de [docs/agents/cartao-de-tarefa.md](../agents/cartao-de-tarefa.md), um arquivo por entrega. Validação: `python3 tools/alice-harness/alice.py cards docs/plano/E0.yaml docs/plano/E1.yaml --repo .`

| Entrega | Objetivo | Pronto quando |
|---|---|---|
| **E0** Esqueleto | monorepo, toolchain e **todas as travas `E0`** de [travas.md](../agents/travas.md) funcionando no CI | CI verde num PR vazio e vermelho em PR com cada violação de exemplo |
| **E1** Motor financeiro | `packages/finance` completo (RFC-002), TDD | todos os casos T-01..T-14 e CA-01..CA-08 do cálculo passando; cobertura 100%; mutação ≥ 90% |
| E2+ | apps (api, worker, web), módulos | planejado depois da E1, com as métricas dela |

## E0: esqueleto (quase tudo do Claude: configs são protegidas para a Alice)

| Cartão | Quem | O quê | Arquivos principais |
|---|---|---|---|
| E0-T01 | claude | Node LTS + pnpm (corepack), `package.json` raiz, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc` | raiz |
| E0-T02 | claude | `packages/config`: tsconfig estrito (flags de travas §2) e ESLint com as proibições de travas §3 | `packages/config/**` |
| E0-T03 | claude | `packages/finance` vazio compilando: Vitest, cobertura 100% como limite, Stryker configurado | `packages/finance/{package.json,tsconfig.json,vitest.config.ts,stryker.config.json}` |
| E0-T04 | claude | `packages/schemas` vazio compilando (Zod) | `packages/schemas/**` |
| E0-T05 | claude | dependency-cruiser com as regras de fronteira (travas §4) | `.dependency-cruiser.cjs` |
| E0-T06 | claude | lefthook + commitlint + gitleaks (pre-commit) | `lefthook.yml`, `commitlint.config.cjs` |
| E0-T07 | claude | scripts: `.env.example` sincronizado, lista de dependências permitidas, `pnpm verify` (tudo de uma vez) | `scripts/**` |
| E0-T08 | claude | CI no GitHub Actions rodando `pnpm verify` + gitleaks | `.github/workflows/ci.yml` |
| E0-T09 | alice (`pre-review`) | revisar a E0 contra travas.md e listar trava `E0` faltando | — |

Dependências: T01 → T02 → (T03, T04, T05) → T06 → T07 → T08 → T09.

## E1: motor financeiro (`packages/finance`, TDD)

Nomes pelo [glossário](../glossario.md). Dinheiro `Cents` (bigint), taxa `Bps` (inteiro), datas `IsoDate`. Cada função: um cartão de **testes** (Claude escreve, ou Alice em `test-author` quando marcado, sempre com revisão do Claude) e um de **implementação** (Alice).

| Par | Função (arquivo `packages/finance/src/…`) | Regras | Testes por |
|---|---|---|---|
| T01 | tipos `Cents`, `Bps`, `IsoDate` e conversões (`money.ts`, `date.ts`) | — | Claude implementa também (são travas) |
| T02/T03 | `roundToStep` (`rounding.ts`) | RN-C03, T-13 | Claude |
| T04/T05 | `splitEvenly` (`split.ts`) | T-01, T-02 | **Alice `test-author`** (experimento) |
| T06/T07 | `simpleInterest` (`interest.ts`) | T-03 | Claude |
| T08/T09 | `generateDueDates` (`due-dates.ts`) | RN-C04, T-08, T-09, T-10 | Claude |
| T10/T11 | `generateSchedule` (`schedule.ts`) | RN-C03, T-04, T-11, T-12, T-14, CA-01 | Claude |
| T12/T13 | `calculateLateCharges` (`late-charges.ts`) | RN-E01, RN-E02, T-07 | **Alice `test-author`** (experimento) |
| T14/T15 | `allocatePayment` (`allocation.ts`) | T-05, T-06 | Claude |
| T16/T17 | `outstandingBalance`, `payoffAmount`, `loanStanding` (`balance.ts`) | RN-C08 | Claude |
| T18 | testes de propriedade (fast-check): somas fecham, nada negativo | — | Claude |
| T19 | `pre-review` do pacote inteiro + mutação ≥ 90% | — | Alice |
| T20 | ficha do módulo `docs/memoria/modulos/finance.md` | — | Alice (`docs`) |

Checks padrão de implementação: `pnpm --filter @pilla/finance test -- <arquivo>`, `pnpm --filter @pilla/finance typecheck`, `pnpm --filter @pilla/finance lint`. Todos dependem de E0-T03.

## Métricas que esta fase alimenta (estudo)
Por cartão: tentativas, tokens da Alice, segundos, correções do Claude na revisão. Comparação planejada: repetir 1 par (T06/T07) feito só pelo Claude.

## Status da E0 (2026-11-14)
Concluída: `pnpm verify` verde; cada trava testada com uma violação de exemplo (lint, fronteiras, segredo, commit, dependência fora da lista).

| Trava E0 | Status |
|---|---|
| 23 de 26 linhas E0 de travas.md | ✅ ativas |
| Determinismo: relógio injetado | ✅ (lint em `finance` e `domain/`) · "teste sem rede / sem sleep": ⏳ E1 |
| Cobertura 85% nos módulos | ⏳ E2 (ainda não há módulos) |
| `main` protegida no GitHub | ⏳ Joel configura (Settings → Branches) |
| env com Zod, logger com redação, gerador de CPF falso | movidas para E2 (dependem dos apps) |

Pré-revisão da Alice (E0-T09): respondeu "sem achados" em 39 s, um falso negativo (LI-013). Revisão feita pelo Claude.
