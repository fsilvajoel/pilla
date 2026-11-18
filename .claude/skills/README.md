# Skills

Fonte única das skills do repositório: o Claude Code carrega daqui e o `Harness-adaV1` aponta para cá
(`skill_dir: ../.claude/skills`). Formato verificado pelo gate `skill-format`
(`python3 ../harness-ada/script/check_skill_format.py .claude/skills`): uma pasta por skill, `SKILL.md` com frontmatter, `name`
igual ao nome da pasta e `description` não vazia.

## Skills próprias (pt-BR, seções do [_modelo.md](_modelo.md))

| Skill | Uso |
|---|---|
| escrever-teste | etapa tests de uma feature (subagente test-writer) |
| revisar-teste | revisão dos testes antes da implementação (subagente reviewer) |
| editar-arquivo | etapa implement (subagente implementer) |

## Skills de terceiros

Copiadas de [tech-leads-club/agent-skills](https://github.com/tech-leads-club/agent-skills) (licença MIT, ver `LICENSE-tech-leads-club-agent-skills`), **fixadas no commit `e74dc8a`** (2026-11-10), em modo cópia, sem atualização automática. Scripts revisados antes da instalação. Toda skill nova de terceiro entra na lista `THIRD_PARTY` de `../harness-ada/script/check_skill_format.py`.

Ajustes locais sobre a cópia: a pasta `web-accessibility` virou `accessibility` (igual ao `name` do frontmatter) e o link para a skill `web-quality-audit`, que não foi instalada, virou texto; em `security-best-practices` saíram as referências de stacks que o pilla não usa (Go, Django, Flask, FastAPI, Vue, jQuery).

| Skill | Uso no pilla |
|---|---|
| coding-guidelines | regras contra erros comuns de IA ao codar |
| tactical-ddd | revisão dos modelos de domínio |
| coupling-analysis, modular-design-principles | auditoria de acoplamento entre módulos a cada entrega |
| the-judge | revisão de PR baseada em evidência |
| security-threat-model, security-best-practices | modelo de ameaças (obrigatório antes do portal) e revisão de segurança |
| gh-fix-ci | diagnóstico de CI quebrado |
| harness-eval | avaliação do AGENTS.md e das travas |
| react-best-practices, accessibility | frontend Next.js e acessibilidade do portal |

## Regras locais (prevalecem sobre o texto das skills)
- **the-judge**: revisão em **pt-BR**; **nunca** publicar no GitHub (`post_review.py`) sem o ok do Joel. Sem ok, entregar o resultado localmente.
- Skills que sugerirem ferramentas ou estruturas diferentes das ADRs/RFCs aceitas (ex.: Prisma, outra estrutura de pastas) **perdem** para os documentos do projeto.
- Atualizar uma skill = nova cópia de um commit revisado + atualizar o hash acima.
