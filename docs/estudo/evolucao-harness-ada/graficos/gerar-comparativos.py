from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch


OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)

plt.rcParams.update({
    "font.family": "sans-serif",
    "axes.titlesize": 16,
    "axes.labelsize": 12,
    "xtick.labelsize": 11,
    "ytick.labelsize": 11,
})


def save(name: str) -> None:
    plt.tight_layout()
    plt.savefig(OUT / name, dpi=160, bbox_inches="tight", facecolor="white")
    plt.close()


def evolution():
    labels = ["V0\nexperimental", "V1\nharness estruturado", "V2\nmotor determinístico"]
    orchestration = [80, 72, 25]
    evidence = [35, 68, 95]
    automation = [45, 58, 90]

    x = range(len(labels))
    width = 0.24
    fig, ax = plt.subplots(figsize=(12, 7))
    ax.bar([i - width for i in x], orchestration, width, label="Intervenção do orquestrador")
    ax.bar(x, evidence, width, label="Evidência objetiva")
    ax.bar([i + width for i in x], automation, width, label="Execução determinística")
    ax.set_xticks(list(x), labels)
    ax.set_ylim(0, 100)
    ax.set_ylabel("Índice comparativo")
    ax.set_title("Evolução do controle da execução", loc="left")
    ax.legend(frameon=False)
    ax.grid(axis="y", alpha=0.25)
    save("05-evolucao-controle.png")


def architecture():
    fig, ax = plt.subplots(figsize=(13, 7))
    ax.set_xlim(0, 13)
    ax.set_ylim(0, 7)
    ax.axis("off")

    boxes = [
        (0.5, 2.4, 3.0, 2.2, "#DCEBFA", "CONTROL PLANE\nPython"),
        (4.8, 2.4, 3.0, 2.2, "#FCE7D8", "EXECUTION PLANE\nModels + tools"),
        (9.1, 2.4, 3.0, 2.2, "#DFF1DF", "ARTIFACT PLANE\nDocs + evidence"),
    ]
    for x, y, w, h, color, text in boxes:
        patch = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05,rounding_size=0.12",
                               facecolor=color, edgecolor="#607080")
        ax.add_patch(patch)
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
                fontsize=13, fontweight="bold")

    ax.annotate("", xy=(4.7, 3.5), xytext=(3.6, 3.5),
                arrowprops={"arrowstyle": "->", "lw": 2, "color": "#607080"})
    ax.annotate("", xy=(9.0, 3.5), xytext=(7.9, 3.5),
                arrowprops={"arrowstyle": "->", "lw": 2, "color": "#607080"})
    ax.text(6.5, 5.8, "V2: regras fora do modelo, evidência dentro do sistema",
            ha="center", fontsize=18)
    ax.text(6.5, 1.1,
            "Scheduler  •  machine de estados  •  worktrees  •  gates  •  event log  •  fallback",
            ha="center", fontsize=11)
    save("06-arquitetura-v2.png")


def test_policy():
    rows = [
        ("Layout / CSS", "Nenhum", "Visual"),
        ("Componente sem lógica", "Nenhum", "Visual"),
        ("Lógica na tela", "Extrair", "Unitário"),
        ("Validação / formulário", "Completo", "Unit + prop"),
        ("Regra / cálculo", "Completo", "Unit + prop + mut"),
        ("Contrato crítico", "Completo", "Unit + e2e"),
    ]
    fig, ax = plt.subplots(figsize=(12, 7))
    ax.axis("off")
    table = ax.table(
        cellText=rows,
        colLabels=["Tipo", "TDD", "Evidência"],
        loc="center",
        cellLoc="left",
        colWidths=[0.34, 0.23, 0.43],
    )
    table.auto_set_font_size(False)
    table.set_fontsize(13)
    table.scale(1, 2.2)
    ax.set_title("UI não é sinônimo de TDD", loc="left", fontsize=18, pad=20)
    save("07-politica-condicional-testes.png")


def local_engine():
    labels = ["Motor determinístico", "Qwen local", "Modelo pago crítico"]
    values = [95, 55, 75]
    colors = ["#2a78d6", "#7f9fb8", "#eb6834"]
    fig, ax = plt.subplots(figsize=(12, 6))
    bars = ax.barh(labels, values, color=colors)
    ax.set_xlim(0, 100)
    ax.set_xlabel("Adequação ao pipeline")
    ax.set_title("Onde usar coordenação, modelo local e modelo crítico", loc="left")
    for bar, value in zip(bars, values):
        ax.text(value + 1, bar.get_y() + bar.get_height() / 2,
                f"{value}", va="center", fontweight="bold")
    ax.grid(axis="x", alpha=0.25)
    save("08-papel-dos-modelos.png")


if __name__ == "__main__":
    evolution()
    architecture()
    test_policy()
    local_engine()
