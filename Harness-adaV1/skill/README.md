# Skills

Conhecimento reutilizável: quando usar uma capability, quando não usar, que padrões preferir e que limites valem.
Skill é instrução, não execução; execução fica em tools e scripts. Regras que se repetem entre skills ficam em
[policy/](../policy/README.md).

## Formato
Toda skill é `skill/<nome>/SKILL.md` com frontmatter `name` (igual à pasta) e `description`.
Skill própria segue também as seções do [_modelo.md](_modelo.md). Gate: [skill-format](../gate/skill-format.md).

## Skills próprias (pt-BR)
| Skill | Uso |
|---|---|
| [escrever-cartao](escrever-cartao/SKILL.md) | escrever e revisar cartões de tarefa |
| [escrever-teste](escrever-teste/SKILL.md) | escrever testes antes da implementação |
| [revisar-teste](revisar-teste/SKILL.md) | revisar testes antes da implementação |
| [editar-arquivo](editar-arquivo/SKILL.md) | editar arquivos na implementação |
| [pesquisa-web](pesquisa-web/SKILL.md) | pesquisa externa com fonte oficial |

## Skills de terceiros (idioma original, sem alteração)
Listadas em `THIRD_PARTY` de `script/check_skill_format.py`. Fonte: repositório `tech-leads-club/agent-skills`,
commit `e74dc8a`. Licença MIT ([LICENSE-tech-leads-club-agent-skills](../LICENSE-tech-leads-club-agent-skills)),
exceto `harness-eval` e `the-judge`, em CC-BY-4.0 (ver o frontmatter de cada uma).
`accessibility` vem da skill `web-accessibility` da mesma fonte; a pasta segue o `name` do frontmatter.

accessibility, coding-guidelines, coupling-analysis, gh-fix-ci, harness-eval, modular-design-principles,
react-best-practices, security-best-practices, security-threat-model, tactical-ddd, the-judge.

Para atualizar: copiar a pasta da fonte num commit revisado, sem editar o conteúdo, e atualizar o commit acima.
