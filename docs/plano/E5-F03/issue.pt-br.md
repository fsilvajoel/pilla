# [E5-F03] Status do empréstimo fechado para pagamentos (RN-R09)

<!-- ada-feature:E5-F03 -->

> Entrega **E5** · Etapa: done · Progresso: 100%
> Gerado dos docs do repositório; não edite à mão (o próximo sync sobrescreve).

## Resumo e escopo

- E5-T07 (Bia): `apps/api/src/lending/domain/loan-status.test.ts`, os testes de `isClosedForPayments`.
- E5-T08 (Alice): `apps/api/src/lending/domain/loan-status.ts` e a saída da trava do stub no `vitest.config.ts`.
- `LoanStatus` é tipo local da api, com os 7 status do check `loans_status_check` (`@pilla/schemas` só na borda HTTP, `decisoes-2026-11-19.md` §4; precedente: `LoanStanding` local em `@pilla/finance`).
- Fora: transições de status (ativar e cancelar: `decisoes-2026-11-19.md` §4), status `DRAFT` (a RN-R09 não fala dele) e o uso da regra no caso de uso de pagamento.

## Regras e critérios

- **RN-R09** Contratos QUITADO, RENOVADO, RENEGOCIADO e CANCELADO **não aceitam pagamento**. A mensagem indica o contrato sucessor, quando houver. Exceção: BAIXADO_PERDA (RN-C20).

- **RN-C20** Pagamento recebido depois da baixa é permitido (**recuperação**): entra na conta como recebimento e no indicador "recuperado"; o contrato continua BAIXADO_PERDA.

- A1: `isClosedForPayments` é true para `PAID_OFF`, `RENEWED`, `RENEGOTIATED` e `CANCELLED` (RN-R09).
- A2: `isClosedForPayments` é false para `ACTIVE` e `WRITTEN_OFF` (RN-R09, RN-C20).
- A3: 100% de linhas e ramos de `loan-status.ts`; typecheck e lint verdes; sem `@stub` nem exclusão.

## Contrato

_Sem contrato no plano._

## Cartões

### E5-T07 — Escreva os testes para isClosedForPayments

- Tipo: `test-author` · Responsável: `bia` · Estado: done

**DoR (pronto para começar)**
- Depende de: nenhuma
- Referências: [PRD-001 RN-R09](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RN-C20](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-001 M2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-001-dominios-e-integracao.md)
- Ler antes: `apps/api/src/lending/domain/loan-status.ts`

**DoD (definição de pronto)**
- todos os testes falham agora contra o stub em HEAD e passariam com uma implementação correta (run_check 0)
- import { describe, expect, it } from "vitest";
- import { isClosedForPayments } from "./loan-status";
- isClosedForPayments retorna true para "PAID_OFF", "RENEWED", "RENEGOTIATED" e "CANCELLED" (RN-R09)
- isClosedForPayments retorna false para "ACTIVE" (RN-R09) e para "WRITTEN_OFF" (RN-C20, um empréstimo com baixa ainda exige pagamentos)
- nunca edite apps/api/src/lending/domain/loan-status.ts
- Pode alterar: `apps/api/src/lending/domain/loan-status.test.ts`
- Verificações:
  - `! pnpm --filter @pilla/api exec vitest run src/lending/domain/loan-status.test.ts`
  - `node scripts/check-test-quality.mjs apps/api/src/lending/domain/loan-status.test.ts`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`

**Dicas**
- as linhas de importação do arquivo feito são as únicas importações do arquivo, cada nome nelas é utilizado, e nada mais é importado
- isClosedForPayments recebe um texto de status do tipo LoanStatus e retorna um booleano
- para cada um dos seis casos (it), cada um com uma expect e toBe true ou toBe false, há seis it em um único describe referente a isClosedForPayments
- o status em cada it é uma string literal, nunca extraída de uma lista ou de um loop
- o status DRAFT não recebe teste, pois RN-R09 não o nomeia
- escreve-se um write_file do arquivo de teste inteiro, em seguida executa-se run_check 0, 1, 2 e 3

### E5-T08 — implementar isClosedForPayments e remover o esboço (stub)

- Tipo: `implement` · Responsável: `alice` · Estado: done

**DoR (pronto para começar)**
- Depende de: `E5-T07`
- Referências: [PRD-001 RN-R09](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [PRD-001 RN-C20](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md), [RFC-001 M2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-001-dominios-e-integracao.md)
- Ler antes: `apps/api/src/lending/domain/loan-status.ts`, `apps/api/vitest.config.ts`

**DoD (definição de pronto)**
- todos os testes em apps/api/src/lending/domain/loan-status.test.ts passam com 100% de cobertura de linha e ramificação de loan-status.ts (run_check 0)
- o arquivo loan-status.ts não possui a linha '// @stub E5-T08' e apps/api/vitest.config.ts não possui uma linha que exclui src/lending/domain/loan-status.ts (run_check 3)
- isClosedForPayments retorna true apenas para PAID_OFF, RENEWED, RENEGOTIATED e CANCELLED (RN-R09), portanto WRITTEN_OFF retorna false (RN-C20)
- o tipo LoanStatus, os comentários e a assinatura permanecem, enquanto o parâmetro perde o sublinhado inicial
- loan-status.ts não possui linha de importação
- Pode alterar: `apps/api/src/lending/domain/loan-status.ts`, `apps/api/vitest.config.ts`
- Testes protegidos: `apps/api/src/lending/domain/loan-status.test.ts`
- Verificações:
  - `pnpm --filter @pilla/api exec vitest run src/lending/domain/loan-status.test.ts --coverage --coverage.include=src/lending/domain/loan-status.ts --coverage.exclude=none --coverage.thresholds.lines=100 --coverage.thresholds.branches=100`
  - `pnpm --filter @pilla/api typecheck`
  - `pnpm --filter @pilla/api lint`
  - `! grep -n "stub E5-T08" apps/api/src/lending/domain/loan-status.ts apps/api/vitest.config.ts`

**Dicas**
- o único arquivo lido é apps/api/src/lending/domain/loan-status.ts, pois os passos estão nestas dicas
- acima da função, uma const CLOSED_FOR_PAYMENTS tipada como ReadonlySet de LoanStatus, um novo Set com os quatro status fechados
- o corpo é uma única linha que retorna a existência desse conjunto para o status, sem if e sem switch
- a linha de vitest.config.ts a remover é a que está dentro de coverage.exclude com src/lending/domain/loan-status.ts e o comentário stub E5-T08
- um arquivo edit_file de loan-status.ts que adiciona o const, substitui o corpo e remove a linha do placeholder, um arquivo edit_file de apps/api/vitest.config.ts que remove a linha com o placeholder E5-T08, em seguida execute run_check 0, 1, 2 e 3

## Referências

- PRD: [docs/prd/PRD-001-mvp-gestao-emprestimos.md](https://github.com/fsilvajoel/pilla/blob/main/docs/prd/PRD-001-mvp-gestao-emprestimos.md)
- [RFC-001 M2](https://github.com/fsilvajoel/pilla/blob/main/docs/rfc/RFC-001-dominios-e-integracao.md)
- plano.md: [docs/plano/E5-F03/plano.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F03/plano.md)
- revisao.md: [docs/plano/E5-F03/revisao.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F03/revisao.md)
- testes.md: [docs/plano/E5-F03/testes.md](https://github.com/fsilvajoel/pilla/blob/main/docs/plano/E5-F03/testes.md)

## Telas

_Sem telas._

## Estado

- Etapa: done
- Progresso: 100%
- Bloqueio: não
- `E5-T07`: done
- `E5-T08`: done
