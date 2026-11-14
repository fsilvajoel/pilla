import json
import matplotlib.pyplot as plt
from pathlib import Path
from matplotlib.ticker import FuncFormatter

# Configuration
DATA_FILE = Path(__file__).parent / "dados.json"
OUTPUT_DIR = Path(__file__).parent / "graficos"
OUTPUT_DIR.mkdir(exist_ok=True)

# Style settings
plt.rcParams.update({
    "figure.figsize": (16, 9),
    "figure.dpi": 100,
    "axes.facecolor": "#fcfcfb",
    "axes.edgecolor": "#898781",
    "axes.grid": True,
    "grid.color": "#e1e0d9",
    "grid.linestyle": "-",
    "grid.linewidth": 1,
    "text.color": "#0b0b0b",
    "axes.titlesize": 16,
    "axes.labelsize": 14,
    "xtick.labelsize": 12,
    "ytick.labelsize": 12,
    "font.family": "sans-serif"
})

def format_thousands(x, pos):
    return f"{x:,.0f}".replace(",", ".")

def save_plot(filename):
    plt.tight_layout(rect=[0, 0, 1, 0.93])
    plt.savefig(OUTPUT_DIR / filename, bbox_inches="tight", pad_inches=0.3)
    plt.close()

def main():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 01-toy-antes-depois.png
    plt.figure()
    ax = plt.gca()
    ax.set_axisbelow(True)
    toys = data["toy"]
    y_pos = range(len(toys))

    # Horizontal stacked bars
    # entrada (blue) + saida (orange)
    for i, toy in enumerate(toys):
        entrada = toy["entrada"]
        saida = toy["saida"]
        total = entrada + saida

        ax.barh(i, entrada, height=0.5, color="#2a78d6", label="Entrada" if i == 0 else "", edgecolor="white", linewidth=2)
        ax.barh(i, saida, left=entrada, height=0.5, color="#eb6834", label="Saída" if i == 0 else "", edgecolor="white", linewidth=2)

        # Total label at the end
        max_val = max([t["entrada"] + t["saida"] for t in toys])
        ax.text(total + (0.01 * max_val), i, f"{total:,.0f}".replace(",", "."), va="center", fontweight="bold", fontsize=13, color="#0b0b0b")

    ax.set_yticks(y_pos)
    ax.set_yticklabels([t["rotulo"] for t in toys])
    ax.invert_yaxis()  # Top to bottom
    ax.set_title("Mesma tarefa, três versões: tokens da Alice", loc="left")
    ax.legend(loc="lower right", fontsize=13, frameon=False)
    ax.xaxis.set_major_formatter(FuncFormatter(format_thousands))
    ax.set_xlim(0, 1.3 * max_val)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    # Gridlines only along the value axis (x)
    ax.xaxis.grid(True)
    ax.yaxis.grid(False)
    save_plot("01-toy-antes-depois.png")

    # 02-think.png
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 9), dpi=100, sharey=True)
    fig.patch.set_facecolor("#fcfcfb")

    think_data = data["think"]
    modos = [t["modo"] for t in think_data]
    saidas = [t["saida"] for t in think_data]
    segundos = [t["segundos"] for t in think_data]

    x_pos = range(len(modos))

    # Left: saida tokens
    ax1.bar(x_pos, saidas, color="#2a78d6", width=0.5)
    ax1.set_title("Saída (Tokens)")
    ax1.set_xticks(x_pos)
    ax1.set_xticklabels(modos, rotation=0)
    for i, v in enumerate(saidas):
        ax1.text(i, v + 1, f"{v}", ha="center", fontsize=13, color="#0b0b0b")

    # Right: segundos
    ax2.bar(x_pos, segundos, color="#2a78d6", width=0.5)
    ax2.set_title("Tempo (Segundos)")
    ax2.set_xticks(x_pos)
    ax2.set_xticklabels(modos, rotation=0)
    for i, v in enumerate(segundos):
        ax2.text(i, v + 1, f"{v}", ha="center", fontsize=13, color="#0b0b0b")

    for ax in [ax1, ax2]:
        ax.set_axisbelow(True)
        ax.set_facecolor("#fcfcfb")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.xaxis.grid(False)
        ax.yaxis.grid(True)

    fig.suptitle("Raciocínio estendido ligado × desligado", fontsize=18, x=0.02, ha="left")
    plt.tight_layout(rect=[0, 0, 1, 0.93])
    plt.savefig(OUTPUT_DIR / "02-think.png")
    plt.close()

    # 03-tarefas.png
    plt.figure()
    ax = plt.gca()
    ax.set_axisbelow(True)
    tarefas = data["tarefas"]
    y_pos = range(len(tarefas))

    max_entrada = max([t["entrada"] for t in tarefas])

    for i, t in enumerate(tarefas):
        entrada = t["entrada"]
        status = t["status"]
        tentativas = t["tentativas"]

        ax.barh(i, entrada, height=0.5, color="#2a78d6")

        if status == "done":
            label = f" · {tentativas} {'tentativa' if tentativas == 1 else 'tentativas'} · ✓"
        else:
            label = f" · ✗ falso positivo"

        ax.text(entrada + (0.01 * max_entrada), i, f"{entrada:,.0f}".replace(",", ".") + label, va="center", fontsize=13, color="#0b0b0b")

    ax.set_yticks(y_pos)
    ax.set_yticklabels([f"{t['id']} · {t['o_que']}" for t in tarefas])
    ax.invert_yaxis()
    ax.set_title("Tokens de entrada por tarefa (cresce com o histórico)", loc="left")
    ax.xaxis.set_major_formatter(FuncFormatter(format_thousands))
    ax.set_xlim(0, 1.3 * max_entrada)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.xaxis.grid(True)
    ax.yaxis.grid(False)
    save_plot("03-tarefas.png")

    # 04-divisao-tokens.png
    plt.figure()
    ax = plt.gca()
    ax.set_axisbelow(True)
    div = data["divisao_v1"]

    labels = ['Claude (estimado)', 'Alice · entrada', 'Alice · saída']
    values = [div["claude_estimado"], div["alice_entrada"], div["alice_saida"]]
    colors = ["#eb6834", "#2a78d6", "#2a78d6"]

    y_pos = range(len(labels))
    ax.barh(y_pos, values, height=0.5, color=colors)

    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels)
    ax.invert_yaxis()

    max_v = max(values)
    for i, v in enumerate(values):
        ax.text(v + (0.01 * max_v), i, f"{v:,.0f}".replace(",", "."), va="center", fontsize=13, color="#0b0b0b")

    ax.set_xlim(0, 1.3 * max_v)
    ax.set_title("Quem gastou os tokens na V1", loc="left")
    ax.xaxis.set_major_formatter(FuncFormatter(format_thousands))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.xaxis.grid(True)
    ax.yaxis.grid(False)
    save_plot("04-divisao-tokens.png")

if __name__ == "__main__":
    main()
