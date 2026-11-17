# Policy: idioma

## Objetivo
Um idioma só por tipo de texto, para o harness não misturar línguas.

## Regras
- **Texto do harness em pt-BR**: todo `.md` (agentes, skills, capabilities, policies, workflows, gates, READMEs),
  docstrings, comentários e mensagens impressas pelos scripts e tools.
- **Código em inglês**: identificadores, chaves de configuração e nomes de campos de estado.
- **Commits em inglês.**
- Nomes de arquivo e pasta já estáveis em inglês (`agent/`, `gate/portable.md`, `code-modification.md`) podem
  ficar: renomear quebra links e referências sem ganho. Arquivo novo pode usar pt-BR ou inglês.
- Exceção: skills de terceiros (lista `THIRD_PARTY` em `script/check_skill_format.py`) ficam no idioma original,
  sem tradução, para poderem ser atualizadas da fonte.

## Configuração
`language` no `harness.project.yaml`: `docs: pt-BR`, `code: en`, `commits: en`.
