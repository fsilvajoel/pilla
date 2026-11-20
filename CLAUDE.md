# pilla

Projeto do Joel, desenvolvido na VM 258 `dev` (`~/code/pilla`). Regras gerais da casa e como chamar a Alice: `~/.claude/CLAUDE.md`.

## O que é
Sistema de gestão de empréstimos (financeira), modular. Produto de estudo de arquitetura escalável. **Antes de codar, leia `AGENTS.md` e `docs/README.md`** (PRD, RFCs, ADRs e regras para agentes). Só implementar PRD/RFC aprovados e ADRs aceitas; citar os IDs nos commits.

## Regras do projeto
- Repositório **público**: nada de IP, senha, token ou detalhe da infraestrutura em arquivo versionado.
- Commits pequenos; `main` sempre funcionando.
- Idioma (ADR-0012): código, commits e títulos de PR em **inglês**; docs, comentários de código, corpo de PR e textos do sistema em **pt-BR**. Nomes do domínio: `docs/glossario.md`.
- Processo dos agentes: harness único `../harness-ada/` (fora do repositório), agnóstico ao modelo; adaptador atual: Claude Code (agentes em `.claude/agents/`, gates em `scripts/gates.mts`, hook `scripts/guard-hook.mts`; ver `../harness-ada/workflow/feature.md` e ADR-0015). O harness antigo (cartões, `alice.py`) foi removido; a Alice segue só como ferramenta avulsa opcional.

## Configuração e segredos (`.env`)
- `.env`: valores reais (senhas, tokens, chaves, URLs internas). **Nunca vai para o git** (está no `.gitignore`), permissão `600`. Não exibir o conteúdo dele em respostas, logs ou commits, e não mandá-lo à Alice.
- `.env.example`: vai para o git. Mesmas variáveis do `.env`, com valores de exemplo e um comentário por variável.
- Variável nova: adicionar no `.env` **e** no `.env.example` no mesmo commit.
- O código lê tudo do ambiente (`.env`); nada de segredo escrito no código.
- Antes de cada commit: `git status` e conferir que o `.env` não aparece.

## Skills
- Fonte única das skills: a pasta compartilhada do harness, `../harness-ada/skill/` (próprias e de terceiros; terceiros fixadas em commit revisado; ver o `README.md` de lá). `.claude/skills` é link simbólico para ela (o Claude Code carrega por aí). Todos os papéis leem todas as skills. Regras locais do pilla, que prevalecem sobre o texto das skills: `the-judge` revisa em pt-BR e **só publica no GitHub com ok do Joel**; ADRs/RFCs vencem qualquer sugestão das skills (ex.: Prisma, outra estrutura de pastas). Skill de terceiro com uma stack que o pilla não usa: ignorar essa parte.
