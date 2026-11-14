# Skills de terceiros

Copiadas de [tech-leads-club/agent-skills](https://github.com/tech-leads-club/agent-skills) (licença MIT, ver `LICENSE-tech-leads-club-agent-skills`), **fixadas no commit `e74dc8a`** (2026-11-10), em modo cópia, sem atualização automática. Scripts revisados antes da instalação.

| Skill | Uso no pilla |
|---|---|
| coding-guidelines | regras contra erros comuns de IA ao codar (também no pedido da Alice) |
| tactical-ddd | revisão dos modelos de domínio |
| coupling-analysis, modular-design-principles | auditoria de acoplamento entre módulos a cada entrega |
| the-judge | revisão de PR baseada em evidência |
| security-threat-model, security-best-practices | modelo de ameaças (obrigatório antes do portal) e revisão de segurança |
| gh-fix-ci | diagnóstico de CI quebrado |
| harness-eval | avaliação do AGENTS.md e das travas |
| react-best-practices, web-accessibility | frontend Next.js e acessibilidade do portal |

## Regras locais (prevalecem sobre o texto das skills)
- **the-judge**: revisão em **pt-BR**; **nunca** publicar no GitHub (`post_review.py`) sem o ok do Joel. Sem ok, entregar o resultado localmente.
- Skills que sugerirem ferramentas ou estruturas diferentes das ADRs/RFCs aceitas (ex.: Prisma, outra estrutura de pastas) **perdem** para os documentos do projeto.
- Atualizar uma skill = nova cópia de um commit revisado + atualizar o hash acima.
