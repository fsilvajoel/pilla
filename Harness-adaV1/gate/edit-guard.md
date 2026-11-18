# Gate: edit-guard

## Objetivo
Impedir, antes de a tool rodar, ações que pulam os hooks do git, tocam segredos ou escrevem fora do repositório.

## Executor
Hook `PreToolUse` do Claude Code em `.claude/settings.json`, que roda `scripts/guard-hook.mts` em toda chamada de
Bash, Read, Edit, Write, MultiEdit, NotebookEdit, Grep e Glob. Bloqueio = código de saída 2, motivo no stderr.
Evento inválido também bloqueia (falha fechada).

## Critério de sucesso (PASS)
A chamada não cai em nenhuma regra abaixo e segue normalmente.

## Critério de falha (FAIL)
- Bash com `--no-verify` (inclusive abreviado), `git commit -n` (também agrupado, como `-an`), troca de
  `core.hooksPath` ou `LEFTHOOK=`;
- qualquer tool ou comando que cite `.env` ou variante (`.env.local`, `.env*`); `.env.example` é permitido;
- Edit/Write/MultiEdit/NotebookEdit com caminho fora do repositório (symlinks resolvidos).

## Limites
Não analisa para onde um comando Bash escreve (redirecionamento, `cp`, `mv`); escopo do plano continua sendo
conferido na revisão. Regra de fundo: [policy/editing.md](../policy/editing.md).

## Evidência esperada
Mensagem `guard-hook: <motivo>` devolvida ao agente; testes em `scripts/guard-hook.test.mts`.
