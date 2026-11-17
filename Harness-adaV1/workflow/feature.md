# Workflow: feature

## Objetivo
Entregar uma feature numa sequência controlada em que **os testes revisados decidem o pronto** e a implementação
só começa depois deles.

## Participantes
Papéis de [agent/](../agent/README.md); quem executa cada papel vem de `roles` no `harness.project.yaml`.

| Papel | Etapas |
|---|---|
| coordinator | conduz todas; dá o aceite na review |
| planner | plan |
| reviewer | tests, revisão dos testes, audit |
| developer | implement |

## Etapas

| # | Etapa | Papel | Skills / capability | Tools | Gates de saída | Artefato |
|---|---|---|---|---|---|---|
| 1 | plan | planner | [planner](../../.claude/agents/planner.md) / [planning](../capability/planning.md) | `search_code`, `list_files` | cartões validados | [plano.md](feature-artefatos/plano.md) |
| 2 | tests | reviewer | [escrever-teste](../../.claude/skills/escrever-teste/SKILL.md) / [testing](../capability/testing.md) | `run_cmd` (`commands.test`) | [expect-red](../gate/expect-red.md) | [testes.md](feature-artefatos/testes.md) |
| 3 | revisão dos testes | reviewer (outra instância, não quem escreveu) | [revisar-teste](../../.claude/skills/revisar-teste/SKILL.md) / [testing](../capability/testing.md) | `run_cmd` | [expect-red](../gate/expect-red.md), sha registrado | [testes.md](feature-artefatos/testes.md) (`sha do blob`) |
| 4 | implement | developer, um cartão por vez | [editar-arquivo](../../.claude/skills/editar-arquivo/SKILL.md) / [code-modification](../capability/code-modification.md) | `replace_function`, `run_cmd` | [edit-guard](../gate/edit-guard.md), [testes-revisados](../gate/testes-revisados.md), [done-checks](../gate/done-checks.md) | diff + `estado.json` |
| 5 | audit | reviewer | [revisar-teste](../../.claude/skills/revisar-teste/SKILL.md) / [testing](../capability/testing.md) | `run_cmd` (`commands.test`, `commands.coverage`) | [cobertura](../gate/cobertura.md), [auditoria](../gate/auditoria.md) | [auditoria.md](feature-artefatos/auditoria.md) |
| 6 | review | coordinator | — | `run_cmd` (`commands.verify`) | todos do "Pronto quando" | [revisao-final.md](feature-artefatos/revisao-final.md) |

**Bloqueio:** a etapa 4 não começa sem as etapas 2 e 3 concluídas, com `expectRed = true` e `testShas` gravados
no [estado](feature-artefatos/estado.md). Teste alterado depois da revisão volta para a etapa 3.

Regras que valem em todas as etapas: [policy/quality.md](../policy/quality.md).

## Pronto quando
Todos os gates abaixo estão **PASS**; qualquer FAIL bloqueia o aceite.

- [ ] [done-checks](../gate/done-checks.md): verde em **todos** os cartões.
- [ ] [testes-revisados](../gate/testes-revisados.md): sha atual de cada teste bate com o sha revisado.
- [ ] [expect-red](../gate/expect-red.md): verdadeiro antes da implementação.
- [ ] [cobertura](../gate/cobertura.md): presente para os arquivos tocados e não vazia (**0/0 é falha**).
- [ ] [auditoria](../gate/auditoria.md): veredito aprovado.

## Estados de falha
Significado e ação de cada estado estão em [feature-artefatos/estado.md](feature-artefatos/estado.md#estados-de-falha).

| Estado | Onde costuma aparecer |
|---|---|
| `quota` | tests, revisão dos testes, audit |
| `card_error` | plan, implement |
| `needs_input` | qualquer etapa |
| `failed` | tests, implement |
| `error` | qualquer gate |
