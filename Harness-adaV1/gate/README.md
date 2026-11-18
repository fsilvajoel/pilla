# Gates

Critérios objetivos que aprovam ou bloqueiam uma execução. Um gate responde só **PASS** ou **FAIL**.

O cálculo da resposta fica no script correspondente; o gate documenta a condição e a evidência. Gate marcado como
**manual** é decidido por um subagente e registrado no estado. Pular um gate é FAIL.
Formato de cada arquivo: [_modelo.md](_modelo.md).

| Gate | Pergunta | Executor |
|---|---|---|
| [portable](portable.md) | o harness está livre de referências ao projeto alvo? | `script/check_portable.py` |
| [skill-format](skill-format.md) | toda skill segue `.claude/skills/<nome>/SKILL.md` com frontmatter? | `script/check_skill_format.py` |
| [edit-guard](edit-guard.md) | a tool respeita hooks do git, `.env` e o repositório? | hook `PreToolUse` (`scripts/guard-hook.mts`) |
| [done-checks](done-checks.md) | a feature está pronta? | `pnpm verify` |
| [testes-revisados](testes-revisados.md) | os testes revisados continuam com o mesmo sha? | `pnpm gate tests-reviewed <feature> [--sign]` |
| [expect-red](expect-red.md) | os testes falharam contra o esboço antes da implementação? | `pnpm gate expect-red <feature>` |
| [cobertura](cobertura.md) | a cobertura passa nos limites e não é vazia? | `pnpm gate coverage <feature>` |
| [auditoria](auditoria.md) | a auditoria aprovou? | manual (`reviewer`) |
