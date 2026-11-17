"""Testes do gate skill-format (`script/check_skill_format.py`)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from script.check_skill_format import THIRD_PARTY, check_skills

SECOES = "\n".join(
    f"## {titulo}\ntexto\n"
    for titulo in ("Propósito", "Contexto de uso", "Passos", "Limitações", "Exemplos práticos")
)


def escrever_skill(raiz: Path, nome: str, conteudo: str) -> None:
    pasta = raiz / nome
    pasta.mkdir(parents=True)
    (pasta / "SKILL.md").write_text(conteudo, encoding="utf-8")


def frontmatter(nome: str, descricao: str = "faz algo") -> str:
    return f"---\nname: {nome}\ndescription: {descricao}\n---\n\n# {nome}\n\n"


def test_skill_propria_completa_passa(tmp_path: Path) -> None:
    escrever_skill(tmp_path, "minha", frontmatter("minha") + SECOES)
    assert check_skills(tmp_path) == []


def test_sem_frontmatter_falha(tmp_path: Path) -> None:
    escrever_skill(tmp_path, "minha", "# minha\n\n" + SECOES)
    assert check_skills(tmp_path) == ["skill/minha/SKILL.md: sem frontmatter (--- no início e no fim)"]


def test_name_diferente_da_pasta_falha(tmp_path: Path) -> None:
    escrever_skill(tmp_path, "minha", frontmatter("outra") + SECOES)
    assert check_skills(tmp_path) == ["skill/minha/SKILL.md: name 'outra' difere do nome da pasta"]


def test_description_vazia_falha(tmp_path: Path) -> None:
    escrever_skill(tmp_path, "minha", frontmatter("minha", "") + SECOES)
    assert check_skills(tmp_path) == ["skill/minha/SKILL.md: description vazia ou ausente"]


def test_arquivo_solto_e_pasta_sem_skill_falham(tmp_path: Path) -> None:
    (tmp_path / "solta.md").write_text("# solta\n", encoding="utf-8")
    (tmp_path / "vazia").mkdir()
    (tmp_path / "README.md").write_text("# ok\n", encoding="utf-8")
    assert check_skills(tmp_path) == [
        "skill/solta.md: arquivo solto; skill vai em skill/<nome>/SKILL.md",
        "skill/vazia: falta SKILL.md",
    ]


def test_skill_propria_sem_secao_falha(tmp_path: Path) -> None:
    corpo = SECOES.replace("## Limitações\n", "## Outra\n")
    escrever_skill(tmp_path, "minha", frontmatter("minha") + corpo)
    assert check_skills(tmp_path) == ["skill/minha/SKILL.md: falta a seção '## Limitações'"]


def test_skill_de_terceiro_dispensa_secoes(tmp_path: Path) -> None:
    nome = sorted(THIRD_PARTY)[0]
    escrever_skill(tmp_path, nome, frontmatter(nome) + "## Qualquer\n")
    assert check_skills(tmp_path) == []


def test_skills_reais_do_harness_passam() -> None:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "script" / "check_skill_format.py")],
        cwd=str(ROOT),
        text=True,
        capture_output=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout
    assert proc.stdout.strip() == "Gate skill-format passou."
