# Policy: auto-validation

## Objetivo
Garantir que a tarefa seja validada localmente antes de qualquer escalada ou delegação.

## Regras
- Rodar os checks do projeto antes de delegar.
- Não escalar falha que se resolve com correção local estreita.
- Anexar a saída do check que falhou como evidência da passagem.
- Manter o escopo delegado estreito e ligado à falha confirmada.

## Comportamento padrão
1. Rodar a validação ativa (`ada.py --check` ou equivalente).
2. Se passar, seguir com a execução local.
3. Se falhar, decidir se o problema é local ou estrutural.
4. Delegar só com motivo concreto e a evidência anexada ([delegation](delegation.md)).
