#!/usr/bin/env python3
"""Gate skill-format: toda skill é `skill/<nome>/SKILL.md` com frontmatter válido.

Regras (detalhes em `gate/skill-format.md`):

- em `skill/` só há pastas, `README.md` e `_modelo.md`;
- cada pasta tem `SKILL.md` começando com frontmatter `---`;
- o frontmatter tem `name` igual ao nome da pasta e `description` não vazia;
- skills próprias (as que não estão em `THIRD_PARTY`) têm também as seções do
  `skill/_modelo.md`: Propósito, Contexto de uso, Passos, Limitações e
  Exemplos práticos.

Saída: uma linha por problema; código 0 se passou, 1 se falhou.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Skills de terceiros, copiadas sem alteração de conteúdo (proveniência em
# skill/README.md). Só delas não se exigem as seções do modelo.
THIRD_PARTY: frozenset[str] = frozenset(
    {
        "accessibility",
        "coding-guidelines",
        "coupling-analysis",
        "gh-fix-ci",
        "harness-eval",
        "modular-design-principles",
        "react-best-practices",
        "security-best-practices",
        "security-threat-model",
        "tactical-ddd",
        "the-judge",
    }
)

# Seções obrigatórias das skills próprias: cabeçalho `## ` que começa com o texto.
REQUIRED_SECTIONS: tuple[str, ...] = (
    "Propósito",
    "Contexto de uso",
    "Passos",
    "Limitações",
    "Exemplos práticos",
)

ALLOWED_FILES: frozenset[str] = frozenset({"README.md", "_modelo.md"})


def parse_frontmatter(text: str) -> dict[str, str] | None:
    """Lê os campos escalares do frontmatter; None se não houver frontmatter.

    Entende `chave: valor`, valores entre aspas e blocos `>`/`|` com
    continuação indentada. Mapas aninhados (ex.: `metadata:`) são ignorados.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration:
        return None

    fields: dict[str, str] = {}
    index = 1
    while index < end:
        line = lines[index]
        index += 1
        if not line.strip() or line.startswith((" ", "\t", "#")) or ":" not in line:
            continue
        key, value = line.split(":", 1)
        value = value.strip()
        is_block = value in {">", "|", ">-", "|-", ">+", "|+"}
        if is_block or not value:
            block: list[str] = []
            while index < end and (lines[index].startswith((" ", "\t")) or not lines[index].strip()):
                block.append(lines[index].strip())
                index += 1
            if not is_block:
                # `chave:` sem valor seguida de linhas indentadas é mapa ou
                # lista aninhada, não campo escalar.
                fields[key.strip()] = ""
                continue
            value = " ".join(part for part in block if part)
        elif len(value) >= 2 and value[0] in {"'", '"'} and value[-1] == value[0]:
            value = value[1:-1]
        fields[key.strip()] = value.strip()
    return fields


def section_titles(text: str) -> list[str]:
    """Títulos `## ` fora de blocos de código."""
    titles: list[str] = []
    in_fence = False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if not in_fence and line.startswith("## "):
            titles.append(line[3:].strip())
    return titles


def check_skill(skill_dir: Path) -> list[str]:
    """Problemas de uma pasta de skill (lista vazia se estiver certa)."""
    name = skill_dir.name
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.is_file():
        return [f"skill/{name}: falta SKILL.md"]
    text = skill_file.read_text(encoding="utf-8")
    fields = parse_frontmatter(text)
    if fields is None:
        return [f"skill/{name}/SKILL.md: sem frontmatter (--- no início e no fim)"]

    problems: list[str] = []
    declared = fields.get("name", "")
    if declared != name:
        problems.append(f"skill/{name}/SKILL.md: name '{declared}' difere do nome da pasta")
    if not fields.get("description", "").strip():
        problems.append(f"skill/{name}/SKILL.md: description vazia ou ausente")

    if name not in THIRD_PARTY:
        titles = section_titles(text)
        for section in REQUIRED_SECTIONS:
            if not any(title.startswith(section) for title in titles):
                problems.append(f"skill/{name}/SKILL.md: falta a seção '## {section}'")
    return problems


def check_skills(skill_root: Path) -> list[str]:
    """Problemas de todo o diretório `skill/`."""
    if not skill_root.is_dir():
        return [f"{skill_root.name}: diretório de skills ausente"]
    problems: list[str] = []
    for entry in sorted(skill_root.iterdir()):
        if entry.name.startswith(".") or entry.name == "__pycache__":
            continue
        if entry.is_dir():
            problems.extend(check_skill(entry))
        elif entry.name not in ALLOWED_FILES:
            problems.append(f"skill/{entry.name}: arquivo solto; skill vai em skill/<nome>/SKILL.md")
    return problems


def main() -> int:
    skill_root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "skill"
    problems = check_skills(skill_root)
    if problems:
        print("Gate skill-format falhou.")
        for problem in problems:
            print(f"- {problem}")
        return 1
    print("Gate skill-format passou.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
