# Harness-adaV1

Esqueleto de harness portátil para um fluxo de agentes local ao projeto.
É genérico e foi feito para ser movido sem mudar as referências internas; tudo o que é do projeto alvo fica em
`harness.project.yaml`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `agent/` | índice dos papéis; as definições são os subagentes em `../.claude/agents/` |
| `../.claude/skills/` | conhecimento reutilizável (fonte única): `.claude/skills/<nome>/SKILL.md` |
| `capability/` | comportamentos que juntam skills, policies e gates |
| `policy/` | regras globais (inclui [idioma](policy/idioma.md)) |
| `workflow/` | sequência de etapas e passagens |
| `gate/` | critérios que aprovam ou bloqueiam (PASS/FAIL) |
| `script/` | utilitários do harness (checks portable e skill-format) |
| `tests/` | validação do próprio harness |

## Regras de arquitetura
- Agente é papel, não tecnologia; quem executa cada papel vem de `roles` no yaml.
- Skill é conhecimento e boa prática.
- Capability agrupa skills, policies e gates num comportamento reutilizável.
- Policy define regra do sistema todo; regra repetida vira policy.
- Script executa ação; texto não executa nada.
- Gate responde PASS/FAIL contra critério objetivo.
- Workflow orquestra a sequência de trabalho.

## Contrato
- Documentação em Markdown, em pt-BR ([policy/idioma.md](policy/idioma.md)).
- Lógica de execução em `script/` (harness) e em `scripts/` do projeto (gates, hook).
- Ponto de entrada: o workflow [feature](workflow/feature.md), conduzido pela sessão principal do Claude Code.
- Configuração real do projeto em `harness.project.yaml` (papéis, comandos, checks, textos proibidos).
