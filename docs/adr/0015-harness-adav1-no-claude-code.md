# ADR-0015 — Harness-adaV1 executado pelo Claude Code

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-17 |
| Origem | Decisão do Joel (17/11); substitui a [ADR-0014](0014-orquestracao-por-feature.md) |

## Contexto
A ADR-0014 orquestrava as features por um motor Python próprio (cartões, rodadas, papéis em JSON), com
implementação por um modelo local. O motor exigia manutenção própria, duplicava o que o Claude Code já faz
(subagentes, hooks, permissões) e deixava regras importantes em texto, sem trava mecânica.

## Decisão
- O único harness do projeto é o [Harness-adaV1](../../Harness-adaV1/README.md), conduzido pela sessão principal
  do Claude Code no [workflow feature](../../Harness-adaV1/workflow/feature.md).
- Os papéis são subagentes do Claude Code em `.claude/agents/` (planner, test-writer, reviewer, implementer).
- Os gates mecânicos (expect-red, testes revisados, cobertura) rodam em `scripts/gates.mts` (`pnpm gate <gate>
  <feature>`) e gravam o resultado no `estado.json` da feature.
- Um hook PreToolUse (`scripts/guard-hook.mts`, registrado em `.claude/settings.json`) bloqueia acesso a `.env`,
  comandos que pulam hooks do git e escrita fora do repositório (exceto memória e temp do próprio Claude).
- O motor Python e o harness antigo (cartões, rodadas e scripts de check por cartão) foram removidos em
  17/11/2026. Os planos `docs/plano/E*.yaml` ficam como registro de escopo; os checks deles são comandos de shell.

## Consequências
- Positivas: um só caminho de execução; travas de processo viram código testado (`pnpm test:harness`); menos
  código próprio para manter.
- Negativas: o fluxo depende do Claude Code (subagentes e hooks); trocar de ferramenta exige reescrever os papéis.
- Obrigatório: toda feature segue o workflow feature, com gates PASS registrados antes da revisão final; nenhum
  commit pula hooks.

## Alternativas consideradas
- Manter o motor Python da ADR-0014 — custo de manutenção alto e regras fora de trava mecânica.
- Implementação por modelo local em laço próprio — falhou nas medições registradas na ADR-0014.
