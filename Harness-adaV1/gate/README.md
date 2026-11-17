# Gates

Critérios objetivos que aprovam ou bloqueiam uma execução. Um gate responde só **PASS** ou **FAIL**.

O cálculo da resposta fica na tool ou no script correspondente; o gate documenta a condição e a evidência.
Formato de cada arquivo: [_modelo.md](_modelo.md).

| Gate | Pergunta | Executor |
|---|---|---|
| [portable](portable.md) | o harness está livre de referências ao projeto alvo? | `script/check_portable.py` |
| [skill-format](skill-format.md) | toda skill segue `.claude/skills/<nome>/SKILL.md` com frontmatter? | `script/check_skill_format.py` |
| [tool-contract](tool-contract.md) | toda tool declara o contrato? | `script/check_tool_contract.py` |
| [redact](redact.md) | segredos saem mascarados? | `tools/redact.py` |
| [edit-guard](edit-guard.md) | a escrita ficou dentro do escopo? | `script/guard_hook.py` |
| [ssh-gate](ssh-gate.md) | o comando privilegiado passou pelo portão do projeto? | motor externo |
| [done-checks](done-checks.md) | o pronto do cartão foi conferido? | motor do workflow |
| [testes-revisados](testes-revisados.md) | os testes revisados continuam com o mesmo sha? | motor do workflow |
| [expect-red](expect-red.md) | os testes falharam contra o esboço antes da implementação? | motor do workflow |
| [cobertura](cobertura.md) | há cobertura dos arquivos tocados, não vazia? | motor do workflow |
| [auditoria](auditoria.md) | a auditoria aprovou? | motor do workflow |
