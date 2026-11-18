# pilla

Projeto do Joel, desenvolvido na VM 258 `dev` (`~/code/pilla`). Regras gerais da casa e como chamar a Alice: `~/.claude/CLAUDE.md`.

## O que é
Sistema de gestão de empréstimos (financeira), modular. Produto de estudo de arquitetura escalável. **Antes de codar, leia `AGENTS.md` e `docs/README.md`** (PRD, RFCs, ADRs e regras para agentes). Só implementar PRD/RFC aprovados e ADRs aceitas; citar os IDs nos commits.

## Regras do projeto
- Repositório **público**: nada de IP, senha, token ou detalhe da infraestrutura em arquivo versionado.
- Commits pequenos; `main` sempre funcionando.
- Idioma (ADR-0012): código, commits e títulos de PR em **inglês**; docs, comentários de código, corpo de PR e textos do sistema em **pt-BR**. Nomes do domínio: `docs/glossario.md`.
- Processo dos agentes: harness único `Harness-adaV1/`, executado pelo Claude Code (agentes em `.claude/agents/`, gates em `scripts/gates.mts`, hook `scripts/guard-hook.mts`; ver `Harness-adaV1/workflow/feature.md` e ADR-0015). O harness antigo (cartões, `alice.py`) foi removido; a Alice segue só como ferramenta avulsa opcional.

## Configuração e segredos (`.env`)
- `.env`: valores reais (senhas, tokens, chaves, URLs internas). **Nunca vai para o git** (está no `.gitignore`), permissão `600`. Não exibir o conteúdo dele em respostas, logs ou commits, e não mandá-lo à Alice.
- `.env.example`: vai para o git. Mesmas variáveis do `.env`, com valores de exemplo e um comentário por variável.
- Variável nova: adicionar no `.env` **e** no `.env.example` no mesmo commit.
- O código lê tudo do ambiente (`.env`); nada de segredo escrito no código.
- Antes de cada commit: `git status` e conferir que o `.env` não aparece.

## Skills
- Fonte única das skills: `.claude/skills/` (próprias e de terceiros; terceiros fixadas em commit revisado; ver `.claude/skills/README.md`). Regras locais de lá prevalecem: `the-judge` revisa em pt-BR e **só publica no GitHub com ok do Joel**; ADRs/RFCs vencem qualquer sugestão das skills.
