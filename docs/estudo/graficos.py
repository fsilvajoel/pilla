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
    "grid.linewidth": 0.5,
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
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / filename)
    plt.close()

def main():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 01-toy-antes-depois.png
    plt.figure()
    ax = plt.gca()
    toys = data["toy"]
    y_pos = range(len(toys))
    
    # Horizontal stacked bars
    # entrada (blue) + saida (orange)
    for i, toy in enumerate(toys):
        entrada = toy["entrada"]
        saida = toy["saida"]
        total = entrada + saida
        
        ax.barh(i, entrada, color="#2a78d6", label="Entrada" if i == 0 else "", edgecolor="white", linewidth=2)
        ax.barh(i, saida, left=entrada, color="#eb6834", label="Saída" if i == 0 else "", edgecolor="white", linewidth=2)
        
        # Total label at the end
        ax.text(total + 5000, i, f"{total:,.0f}".replace(",", "."), va="center", fontweight="bold")

    ax.set_yticks(y_pos)
    ax.set_yticklabels([t["rotulo"] for t in toys])
    ax.invert_yaxis()  # Top to bottom
    ax.set_title("Mesma tarefa, três versões: tokens da Alice", loc="left")
    ax.legend(loc="lower right")
    ax.xaxis.set_major_formatter(FuncFormatter(format_thousands))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
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
    ax1.bar(x_pos, saidas, color="#2a78d6")
    ax1.set_title("Saída (Tokens)")
    ax1.set_xticks(x_pos)
    ax1.set_xticklabels(modos, rotation=45)
    for i, v in enumerate(saidas):
        ax1.text(i, v + 5, f"{v}", ha="center")
        
    # Right: segundos
    ax2.bar(x_pos, segundos, color="#2a78d6")
    ax2.set_title("Tempo (Segundos)")
    ax2.set_xticks(x_pos)
    ax2.set_xticklabels(modos, rotation=45)
    for i, v in enumerate(segundos):
        ax2.text(i, v + 2, f"{v}", ha="center")

    for ax in [ax1, ax2]:
        ax.set_facecolor("#fcfcfb")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
    
    fig.suptitle("Raciocínio estendido ligado × desligado", fontsize=18, x=0.1, y=0.95)
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.savefig(OUTPUT_DIR / "02-think.png")
    plt.close()

    # 03-tarefas.png
    plt.figure()
    ax = plt.gca()
    tarefas = data["tarefas"]
    y_pos = range(len(tarefas))
    
    for i, t in enumerate(tarefas):
        entrada = t["entrada"]
        status = t["status"]
        tentativas = t["tentativas"]
        
        ax.barh(i, entrada, color="#2a78d6")
        
        if status == "done":
            label = f" · {tentativas} · ✓"
        else:
            label = f" · ✗ (falso positivo)"
            
        ax.text(entrada + 5000, i, f"{entrada:,.0f}".replace(",", ".") + label, va="center")

    ax.set_yticks(y_pos)
    ax.set_yticklabels([f"{t['id']} · {t['o_que']}" for t in tarefas])
    ax.invert_yaxis()
    ax.set_title("Tokens de entrada por tarefa (cresce com o histórico)", loc="left")
    ax.xaxis.set_major_formatter(FuncFormatter(format_thousands))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    save_plot("03-tarefas.png")

    # 04-divisao-tokens.png
    plt.figure()
    ax = plt.gca()
    div = data["divisao_v1"]
    
    labels = ['Claude (estimado)', 'Alice · entrada', 'Alice · saída']
    values = [div["claude_estimado"], div["alice_entrada"], div["alice_saida"]]
    colors = ["#eb6834", "#2a78d6", "#2a78d6"]
    
    y_pos = range(len(labels))
    ax.barh(y_pos, values, color=colors)
    
    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels)
    ax.invert_yaxis()
    
    for i, v in enumerate(values):
        ax.text(v + 5000, i, f"{v:,.0f}".replace(",", "."), va="center")
        
    ax.set_title("Quem gastou os tokens na V1", loc="left")
    ax.xaxis.set_major_formatter(FuncFormatter(format_thousands))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    save_plot("04-divisao-tokens.png")

if __name__ == "__main__":
    main()
