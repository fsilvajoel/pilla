# Harness-adaV1

Esqueleto de harness portátil para um fluxo de agentes local ao projeto.
É genérico e foi feito para ser movido sem mudar as referências internas; tudo o que é do projeto alvo fica em
`harness.project.yaml`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `agent/` | índice dos papéis; as definições são os subagentes em `../.claude/agents/` |
| `skill/` | conhecimento reutilizável: `skill/<nome>/SKILL.md` |
| `capability/` | comportamentos que juntam skills, tools, policies e gates |
| `policy/` | regras globais (inclui [idioma](policy/idioma.md)) |
| `tools/` | integrações externas e wrappers de comando |
| `workflow/` | sequência de etapas e passagens |
| `gate/` | critérios que aprovam ou bloqueiam (PASS/FAIL) |
| `script/` | orquestração e utilitários do projeto |
| `tests/` | validação do próprio harness |

## Regras de arquitetura
- Agente é papel, não tecnologia; quem executa cada papel vem de `roles` no yaml.
- Skill é conhecimento e boa prática.
- Capability agrupa skills, tools e policies num comportamento reutilizável.
- Policy define regra do sistema todo; regra repetida vira policy.
- Tool executa ação.
- Gate responde PASS/FAIL contra critério objetivo.
- Workflow orquestra a sequência de trabalho.

## Contrato
- Documentação em Markdown, em pt-BR ([policy/idioma.md](policy/idioma.md)).
- Lógica de execução em `script/` ou `tools/`.
- Ponto de entrada: `python3 script/ada.py --project .`.
- Configuração real do projeto em `harness.project.yaml` (papéis, comandos, checks, textos proibidos).
