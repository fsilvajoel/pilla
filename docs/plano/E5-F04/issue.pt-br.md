# [E5-F04] Efeito de uma reversão de pagamento no status do empréstimo (RN-R10, RN-R11)

<!-- ada-feature:E5-F04 -->

> Entrega **E5** · Etapa: done · Progresso: 100%
> Gerado dos docs do repositório; não edite à mão (o próximo sync sobrescreve).

## Resumo e escopo

- E5-T09 (Bia): `apps/api/src/lending/domain/reversal.test.ts`, os testes de `isReversalBlocked` e `reopensOnReversal`.
- E5-T10 (Alice): `apps/api/src/lending/domain/reversal.ts` e a saída da trava do stub no `vitest.config.ts`.
- Fora: o caso de uso do estorno (banco, auditoria, recálculo do saldo).
- Status de destino ao reabrir: ACTIVE (`decisoes-2026-11-19.md` §4); fica no caso de uso, fora desta feature.

## Regras e critérios

- **RN-R10** Estorno que faz um contrato QUITADO voltar a ter saldo → contrato volta para ATIVO (evento `ContratoReaberto`).

- **RN-R11** Estorno de pagamento de contrato RENOVADO ou RENEGOCIADO é **bloqueado** (o contrato seguinte já depende dele). Correção = ajuste manual justificado no contrato sucessor.

- A1: `isReversalBlocked` é true só para `RENEWED` e `RENEGOTIATED` (RN-R11).
- A2: `reopensOnReversal` é true só para `PAID_OFF` com saldo maior que zero (RN-R10).
- A3: 100% de linhas e ramos de `reversal.ts`; typecheck e lint verdes; sem `@stub` nem exclusão.

## Contrato

_Sem contrato no plano._

## Cartões

### E5-T09 — Escreva os testes para isReversalBlocked e reopensOnReversal

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: nenhuma
- Referências: [PRD-001 RN-R10](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RN-R11](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-001 M2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-001-dominios-e-integracao.md)
- Ler antes: `apps/api/src/lending/domain/reversal.ts`

**DoD (definição de pronto)**
- todos os testes falham agora contra o stub em HEAD e passariam com uma implementação correta (run_check 0)
- import { describe, expect, it } from "vitest";
- import { isReversalBlocked, reopensOnReversal } from "./reversal";
- isReversalBlocked retorna true para "RENEWED" e "RENEGOTIATED" e false para "ACTIVE", "PAID_OFF" e "WRITTEN_OFF" (RN-R11)
- reopensOnReversal de "PAID_OFF" e 1n retorna true, de "PAID_OFF" e 0n retorna false, de "ACTIVE" e 500n retorna false (RN-R10)
- nunca edite apps/api/src/lending/domain/reversal.ts
- Pode alterar: `apps/api/src/lending/domain/reversal.test.ts`
- Verificações:
  - `! pnpm --filter @pilla/api exec vitest run src/lending/domain/reversal.test.ts`
  - `node scripts/check-test-quality.mjs apps/api/src/lending/domain/reversal.test.ts`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- as linhas de importação do arquivo feito são as únicas importações do arquivo, cada nome nelas é utilizado, e nada mais é importado
- isReversalBlocked recebe um texto de status do tipo LoanStatus e retorna um booleano
- reopensOnReversal recebe o status e outstandingCents, o saldo restante após a reversão em centavos como bigint, e retorna um booleano
- para cada caso, há um único expect com toBe true ou toBe false
- cada status e cada bigint é um literal escrito no it, nunca extraído de uma lista ou loop
- há um único describe para isReversalBlocked com cinco it e um único describe para reopensOnReversal com três it
- escreva o arquivo completo do teste, em seguida execute run_check 0, 1, 2 e 3

### E5-T10 — Implemente isReversalBlocked e reopensOnReversal e remova o esboço

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E5-T09`
- Referências: [PRD-001 RN-R10](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RN-R11](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-001 M2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-001-dominios-e-integracao.md)
- Ler antes: `apps/api/src/lending/domain/reversal.ts`, `apps/api/vitest.config.ts`

**DoD (definição de pronto)**
- todos os testes em apps/api/src/lending/domain/reversal.test.ts passam com 100% de cobertura de linha e ramo de reversal.ts (run_check 0)
- reversal.ts não possui a linha '// @stub E5-T10' e apps/api/vitest.config.ts não possui nenhuma linha que exclua src/lending/domain/reversal.ts
- isReversalBlocked retorna true apenas para RENEWED e RENEGOTIATED (RN-R11)
- reopensOnReversal retorna true apenas quando o status é PAID_OFF e outstandingCents está acima de zero (RN-R10)
- a linha de import type, os comentários e as assinaturas permanecem, enquanto os parâmetros perdem o sublinhado inicial
- Pode alterar: `apps/api/src/lending/domain/reversal.ts`, `apps/api/vitest.config.ts`
- Testes protegidos: `apps/api/src/lending/domain/reversal.test.ts`
- Verificações:
  - `pnpm --filter @pilla/api exec vitest run src/lending/domain/reversal.test.ts --coverage --coverage.include=src/lending/domain/reversal.ts --coverage.exclude=none --coverage.thresholds.lines=100 --coverage.thresholds.branches=100`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- o único arquivo lido é apps/api/src/lending/domain/reversal.ts, pois os passos estão nestas dicas
- isReversalBlocked é uma linha única: status igual a RENEWED ou status igual a RENEGOTIATED
- reopensOnReversal é uma linha única: status igual a PAID_OFF e outstandingCents maior que 0n, um literal bigint
- no if e no switch, os testes cobrem ambos os lados de cada comparação
- a linha de vitest.config.ts a ser removida é aquela dentro de coverage.exclude com src/lending/domain/reversal.ts e o comentário stub E5-T10
- uma edição de reversal.ts que substitui os dois corpos e remove a linha do stub, uma edição de apps/api/vitest.config.ts que remove a linha com o stub E5-T10, em seguida execute run_check 0, 1 e 2

## Referências

- PRD: [docs/prd/PRD-001-mvp-gestao-emprestimos.md](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md)
- [RFC-001 M2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-001-dominios-e-integracao.md)
- plano.md: [docs/plano/E5-F04/plano.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F04/plano.md)
- revisao.md: [docs/plano/E5-F04/revisao.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F04/revisao.md)
- testes.md: [docs/plano/E5-F04/testes.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F04/testes.md)
- auditoria.md: [docs/plano/E5-F04/auditoria.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F04/auditoria.md)

## Telas

_Sem telas._

## Estado

- Etapa: done
- Progresso: 100%
- Bloqueio: não
- `E5-T09`: done
- `E5-T10`: done
