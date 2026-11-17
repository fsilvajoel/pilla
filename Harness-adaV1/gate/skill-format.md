# Gate: skill-format

## Objetivo
Garantir que toda skill seja descoberta pelo agente e siga o mesmo formato.

## Critério de sucesso (PASS)
- `skill/` contém só pastas, `README.md` e `_modelo.md`;
- cada pasta tem `SKILL.md` com frontmatter (`---` no início e no fim);
- o frontmatter tem `name` igual ao nome da pasta e `description` não vazia;
- skill própria tem também as seções do [modelo](../skill/_modelo.md): `## Propósito`, `## Contexto de uso`,
  `## Passos...`, `## Limitações`, `## Exemplos práticos`.

**Própria × terceiro:** a lista `THIRD_PARTY` em `script/check_skill_format.py` nomeia as skills de terceiros
(copiadas sem alterar o conteúdo). Toda pasta fora da lista é tratada como própria. Para adicionar uma skill de
terceiro, inclua o nome na lista e registre a proveniência em [skill/README.md](../skill/README.md).

## Critério de falha (FAIL)
Arquivo solto em `skill/`, pasta sem `SKILL.md`, frontmatter ausente, `name` diferente da pasta,
`description` vazia ou seção obrigatória ausente em skill própria.

## Evidência esperada
Saída de `python3 script/check_skill_format.py`: "Gate skill-format passou." ou uma linha por problema.
