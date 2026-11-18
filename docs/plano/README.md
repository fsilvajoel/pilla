# Plano de entrega

Fluxo de entrega: [workflow feature do Harness-adaV1](../../../harness-ada/workflow/feature.md). Registro histórico abaixo: os "cartões", a Alice e o `alice.py` citados aqui são do harness antigo, removido em 17/11/2026 ([ADR-0015](../adr/0015-harness-adav1-no-claude-code.md)); as lições LI-xxx que não constam mais em [licoes.md](../memoria/licoes.md) foram podadas.

| Entrega | Objetivo | Pronto quando |
|---|---|---|
| **E0** Esqueleto | monorepo, toolchain e **todas as travas `E0`** de [travas.md](../travas.md) funcionando no CI | CI verde num PR vazio e vermelho em PR com cada violação de exemplo |
| **E1** Motor financeiro | `packages/finance` completo (RFC-002), TDD | todos os casos T-01..T-14 e CA-01..CA-08 do cálculo passando; cobertura 100%; mutação ≥ 90% |
| **E2a** Contratos de eventos | `packages/schemas`: os 10 eventos da RFC-004 §7 em Zod, a partir de um módulo-modelo | 10 blocos de `events.test.ts` verdes; cobertura 100%; pré-revisão com evidência |
| E2b+ | apps (api, worker, web), módulos | depois da E2a, com as métricas dela |

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

## Status da E1 (2026-11-14)
Concluída: 141 testes, cobertura 100%, mutação 94,4% (meta 90). `generateSchedule`, `allocatePayment` e `balance` escritos direto pelo Claude (LI-021); pré-revisão (E1-T19) e ficha do módulo (E1-T20) pela Alice.
Questões para o Joel (não decididas no código):
- Cronograma: se o arredondamento da parcela deixar juros negativos em alguma parcela (principal pequeno, taxa ~0), `generateSchedule` recusa com `ScheduleError` em vez de inventar regra.
- Mora sobre pagamento parcial (RFC-002 §6): hoje os encargos são recalculados sobre o em aberto desde o vencimento; a multa já paga não é descontada.
- `status_parcela` (RFC-002 §3.7) ficou para a E2b: depende de "vencida" contar ou não a carência.

## E2a: contratos de eventos (`packages/schemas`, lote da Alice)

Ciclo por cartão (pedido do Joel): executar → analisar sucesso/falha → melhorar o harness → próximo cartão. Evolução medida com `alice.py evolution` e registrada em `docs/estudo/dados.json` (`evolucao`).

| Cartão | Quem | O quê |
|---|---|---|
| E2-T01 | claude ✅ | módulo-modelo: primitivas de fio (`common.ts`), envelope `eventV1`, `PaymentConfirmed` completo e `events.test.ts` em tabela para os 10 eventos |
| E2-T02..T10 | alice | um evento por cartão (troca só o `z.never()` do esboço, seguindo `payment-confirmed.ts`) |
| E2-T11 | alice (`pre-review`) | checklist C1..C7 com evidência verificável (LI-026) |

Por que este lote: repetitivo, pequeno (um esboço de < 25 linhas por cartão), com modelo pronto ao lado e teste em tabela — o perfil em que a Alice rende (LI-018/019).

## E2b-1: corpos da API (`packages/schemas/src/api`, lote da Alice)

Mesmo formato da E2a. Entram só os corpos que a RFC-004 §3 define campo a campo.

| Cartão | Quem | O quê |
|---|---|---|
| E2-T13 | claude ✅ | módulo-modelo: `cpfSchema` (RN-P01), `problemSchema` (§6, code → status), `simulate-loan.ts` (pedido e resposta, §5) e `api.test.ts` em tabela |
| E2-T14..T22 | alice | um corpo por cartão: login, acesso ao portal, sessão do portal, ativar, baixar, quitação, prévia de alocação, estorno, URL de upload |
| E2-T23 | alice (`pre-review`) | checklist C1..C7 com evidência |
| E2-T24 | alice ✅ (perfil `qwen35`) | refactor: `allocationsTotal` compartilhada pelos dois eventos de pagamento (42 s, sem reprovação) |

Decisões do Joel (2026-11-15), já nos esquemas:
- Lançamento manual de tesouraria (`treasury/account-entry.ts`): `CAPITAL_IN`/`CAPITAL_OUT` sempre positivos, o sinal vem do tipo; `ADJUSTMENT` com sinal próprio (nunca zero) e `justification` obrigatória só nele.
- Anexos: PDF e imagens (JPEG, PNG, WebP, HEIC/HEIF do iPhone); máximo de 10 MiB (escolha do Claude, a confirmar).
- Limites de texto confirmados: usuário 100, senha 200, nome de arquivo 255.

## Estado dos cartões (2026-11-15)

Todos os 55 cartões de E0, E1 e E2 (até o E2-T24) já foram executados; **não há cartão pendente**. Os planos ficam
como registro e como molde. Em 2026-11-15 as regras de escrita viraram validação (`alice.py cards`): os cartões
antigos da Alice acusaram 26 problemas (20 dicas de técnica dentro do `done`, 3 arquivos citados sem caminho, 2 checks
sem mensagem, 1 orçamento curto), todos corrigidos; a dica de técnica passou para o campo `hints`. O próximo lote (E2b)
nasce já sob essas regras e começa por um cartão só.
