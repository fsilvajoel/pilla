# ADR-0015 — Harness Ada externo e agnóstico ao modelo

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-17 (revisado em 2026-11-18) |
| Origem | Decisão do Joel (17/11 e 18/11); substitui a [ADR-0014](0014-orquestracao-por-feature.md) |

## Contexto
A ADR-0014 orquestrava as features por um motor Python próprio (cartões, rodadas, papéis em JSON), com
implementação por um modelo local. O motor exigia manutenção própria, duplicava o que os agentes de IA já fazem
(subagentes, hooks, permissões) e deixava regras importantes em texto, sem trava mecânica.

A primeira versão desta ADR amarrava o harness ao Claude Code e o mantinha dentro do repositório. Em 18/11 o
Joel definiu que o harness trabalha **sobre** o projeto, não pertence a ele, e que qualquer agente de IA deve
poder conduzi-lo.

## Decisão
- O único harness do projeto é o **Ada**. Ele fica **fora do repositório**, em `../harness-ada` (repositório
  próprio), e o pilla só guarda o lado do projeto: features em `docs/plano/<feature>/` e as ADRs.
- O harness é **agnóstico ao modelo e à ferramenta**. Qualquer agente de IA (Claude Code, Codex ou outro) pode
  ser o orquestrador, desde que siga o [workflow feature](../../../harness-ada/workflow/feature.md).
- O núcleo é neutro: workflow, papéis, políticas e gates em Markdown, e gates mecânicos executáveis por linha de
  comando (`pnpm gate <gate> <feature>`, que gravam o resultado no `estado.json` da feature).
- O que é específico de uma ferramenta é **adaptador** e não muda o núcleo. O primeiro adaptador é o do Claude
  Code, que será usado em breve: subagentes em `.claude/agents/` (planner, test-writer, reviewer, implementer) e
  um hook PreToolUse (`scripts/guard-hook.mts`) que bloqueia acesso a `.env`, comandos que pulam hooks do git e
  escrita fora do repositório. Outras ferramentas ganham adaptadores próprios quando forem usadas.
- O motor Python e o harness antigo (cartões, rodadas e scripts de check por cartão) foram removidos em
  17/11/2026. Os planos `docs/plano/E*.yaml` ficam como registro de escopo; os checks deles são comandos de shell.

## Consequências
- Positivas: um só caminho de execução; liberdade de trocar de modelo ou ferramenta sem refazer o processo;
  travas de processo viram código testado (`pnpm test:harness`); o harness pode servir a outros projetos.
- Negativas: cada ferramenta precisa de um adaptador, e travas que dependem dela (como o hook) só valem onde o
  adaptador existe; o harness e o projeto são versionados em repositórios separados.
- Obrigatório: toda feature segue o workflow feature, com gates PASS registrados antes da revisão final, qualquer
  que seja o agente; nenhum commit pula hooks.
- Pendente: mover os gates e o adaptador do Claude Code (`.claude/agents/`, `scripts/gates.mts`,
  `scripts/guard-hook.mts`) para o `harness-ada`; o plugin do Claude Code fica para depois.

## Alternativas consideradas
- Manter o motor Python da ADR-0014 — custo de manutenção alto e regras fora de trava mecânica.
- Amarrar o harness ao Claude Code (primeira versão desta ADR) — impede usar outros modelos.
- Implementação por modelo local em laço próprio — falhou nas medições registradas na ADR-0014.
