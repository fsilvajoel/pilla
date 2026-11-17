# Workflow: coordination

## Objetivo
Conduzir qualquer pedido escolhendo o workflow certo e mantendo cada papel na sua responsabilidade.

## Participantes
| Papel | Função aqui |
|---|---|
| coordinator | conduz todas as etapas |
| papel da tarefa | planner, reviewer ou developer, conforme o workflow escolhido |

## Etapas

| # | Etapa | Papel | Skills / capability | Tools | Gate de saída | Artefato |
|---|---|---|---|---|---|---|
| 1 | definir objetivo e resultado esperado | coordinator | — | — | objetivo verificável escrito | pedido / plano |
| 2 | escolher o workflow | coordinator | — | `ada.py --status` | workflow existe em `workflow/` | — |
| 3 | ligar o papel à tarefa | coordinator | capability da etapa | — | papel existe em `roles` | cartão |
| 4 | executar no menor escopo válido | papel da tarefa | skills da capability | tools da capability | gates da etapa | saída da etapa |
| 5 | validar | coordinator | — | `ada.py --check`, `run_cmd` | gates do workflow escolhido | evidência dos gates |

## Responsabilidade por camada
- Agente: como agir num papel.
- Skill: contexto e orientação.
- Capability: agrupa skills, tools, policies e gates da tarefa.
- Tool: executa a ação concreta.
- Policy: limita o processo globalmente.
- Gate: decide PASS/FAIL de forma objetiva.

## Pronto quando
- [ ] Todos os gates do workflow escolhido estão PASS.
- [ ] `ada.py --check` passa (checks do harness).
- [ ] A saída final corresponde ao objetivo e ao escopo da etapa 1.

## Estados de falha
Os mesmos do workflow escolhido; para feature, ver [feature-artefatos/estado.md](feature-artefatos/estado.md#estados-de-falha).
