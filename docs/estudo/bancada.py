"""Bancada de modelos: coleta os resultados de cada execução e gera o relatório.

Uso: python3 docs/estudo/bancada.py <pasta-da-bancada>
A pasta tem r1/, r2/, ... e, em cada uma, para cada perfil:
  <perfil>-impl.score   nota dos cartões implement (score.sh)
  <perfil>-t23.out      saída do plan-run da pré-revisão
  <perfil>-runs/        cópia de tools/alice-harness/runs (metrics.jsonl)
Gera docs/estudo/bancada/resultados.json, docs/estudo/bancada-modelos.md e graficos/bancada-*.png.
"""
from __future__ import annotations

import json
import re
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROFILES = ["gemma", "qwen35", "qwen38", "gptoss"]
LABEL = {
    "gemma": "Gemma 4 12B (Q4_K_M) — linha de base",
    "qwen35": "Qwen 3.5 9B (Q4_K_M)",
    "qwen38": "Qwen 3.8 27B (UD-IQ2_XXS, ~2 bits)",
    "gptoss": "gpt-oss 20B (MXFP4, raciocínio low)",
}
IMPL = {"portal-access": "E2-T15", "payoff-quote": "E2-T19", "attachment-upload-url": "E2-T22"}
SCHEMA = {"portalAccessRequest": "E2-T15", "payoffQuoteQuery": "E2-T19", "attachmentUploadUrlRequest": "E2-T22"}
# gabarito da pré-revisão (defeitos plantados): item -> veredito esperado
EXPECTED = {"C1": "ok", "C2": "ok", "C3": "falta", "C4": "falta", "C5": "falta", "C6": "ok", "C7": "falta"}
DEFECT = {"C3": "D1 centavos sem positiveCentsSchema", "C4": "D4 regex de CPF fora de common.ts",
          "C5": "D2 export faltando no index.ts", "C7": "D3 z.number().int() (o check acusa)"}
# arquivo que a evidência precisa citar para o achado contar como localizado (C5 é ausência: sem arquivo)
WHERE = {"C3": "allocation-preview", "C4": "portal-session", "C7": "attachment-upload-url"}


def metrics(runs: Path, profile: str) -> list[dict]:
    f = runs / "metrics.jsonl"
    rows = [json.loads(l) for l in f.read_text().splitlines() if l.strip()] if f.exists() else []
    return [r for r in rows if r.get("profile") == profile]


def impl_score(text: str) -> dict[str, dict]:
    out = {c: {} for c in IMPL.values()}
    for line in text.splitlines():
        m = re.match(r"\S+ ([\w-]+): esboço=(\d+) exportType=(\d+) strict=(\d+)", line)
        if m and m[1] in IMPL:
            out[IMPL[m[1]]].update(stub=int(m[2]) > 0, exportType=int(m[3]) > 0, strict=int(m[4]) > 0)
        m = re.match(r"\S+ (\w+): .*Tests\s+(?:(\d+) failed \| )?(\d+) passed", line)
        if m and m[1] in SCHEMA:
            out[SCHEMA[m[1]]]["testsPass"] = not m[2]
        m = re.match(r"\S+ (\w+): ?$", line)
        if m and m[1] in SCHEMA:
            out[SCHEMA[m[1]]]["testsPass"] = False
    tc = "typecheck ok" in text
    for c in out.values():
        c["typecheck"] = tc
        c["clean"] = bool(c.get("testsPass") and c.get("exportType") and c.get("strict") and not c.get("stub") and tc)
    return out


def review_score(t23_out: str, runs: Path) -> dict:
    """Lê o plan-*.json citado na saída (na cópia de runs) e compara cada item com o gabarito."""
    m = re.search(r'"summary": "[^"]*/(plan-[^"]+\.json)"', t23_out)
    msg, status = "", "sem resultado"
    if m and (runs / m[1]).exists():
        rows = json.loads((runs / m[1]).read_text())
        msg, status = rows[0].get("message") or "", rows[0].get("status") or ""
    verdict, evidence = {}, {}
    for k, v, ev in re.findall(r"(?m)^\s*(C\d)\s*[:\-]?\s*(ok|falta|parcial|n/a)\b(.*)$", msg):
        verdict.setdefault(k, v)
        evidence.setdefault(k, ev)
    found = [k for k, v in EXPECTED.items() if v == "falta" and verdict.get(k) in ("falta", "parcial")]
    false_pos = [k for k, v in EXPECTED.items() if v == "ok" and verdict.get(k) in ("falta", "parcial")]
    # item sem veredito não conta como acerto (uma execução reprovada não tem summary e fica com 0)
    right = sum(k in verdict and (verdict[k] in ("falta", "parcial")) == (v == "falta") for k, v in EXPECTED.items())
    located = [k for k in found if k not in WHERE or WHERE[k] in evidence.get(k, "")]
    return {"status": status, "verdict": verdict, "defectsFound": found, "defectsLocated": located,
            "falsePositives": false_pos,
            "itemsRight": right, "summary": msg[:3000]}


def collect(bench: Path) -> list[dict]:
    rows = []
    for rep in sorted(bench.glob("r[0-9]*")):
        for p in PROFILES:
            runs = rep / f"{p}-runs"
            if not runs.exists():
                continue
            ms = metrics(runs, p)
            impl = impl_score((rep / f"{p}-impl.score").read_text()) if (rep / f"{p}-impl.score").exists() else {}
            rev = review_score((rep / f"{p}-t23.out").read_text(), runs) if (rep / f"{p}-t23.out").exists() else {}
            rows.append({"rep": rep.name, "profile": p, "model": (ms[0]["model"] if ms else ""),
                         "cards": [{k: m.get(k) for k in ("task", "kind", "status", "attempts", "toolCalls", "seconds",
                                    "promptTokens", "outputTokens", "outTokPerSec", "promptTokPerSec",
                                    "failureCategories", "stalls", "toolErrors", "serverErrors", "harnessRev")} for m in ms],
                         "implement": impl, "review": rev})
    return rows


def summarize(rows: list[dict]) -> dict[str, dict]:
    s = {}
    for p in PROFILES:
        rs = [r for r in rows if r["profile"] == p]
        if not rs:
            continue
        impl_cards = [c for r in rs for c in r["cards"] if c["kind"] == "implement"]
        rev_cards = [c for r in rs for c in r["cards"] if c["kind"] == "pre-review"]
        scored = [v for r in rs for v in r["implement"].values()]
        mean = lambda xs: round(statistics.mean(xs), 1) if xs else 0  # noqa: E731
        s[p] = {
            "reps": len(rs),
            "implDone": f"{sum(c['status'] == 'done' for c in impl_cards)}/{len(impl_cards)}",
            "implFirstPass": f"{sum(c['status'] == 'done' and not c['failureCategories'] for c in impl_cards)}/{len(impl_cards)}",
            "implClean": f"{sum(v.get('clean', False) for v in scored)}/{len(scored)}",
            "implRejections": mean([len(c["failureCategories"] or []) for c in impl_cards]),
            "implSeconds": mean([c["seconds"] for c in impl_cards]),
            "reviewDone": f"{sum(c['status'] == 'done' for c in rev_cards)}/{len(rev_cards)}",
            "reviewRejections": mean([len(c["failureCategories"] or []) for c in rev_cards]),
            "serverErrors": sum(c.get("serverErrors") or 0 for c in impl_cards + rev_cards),
            "defectsFound": mean([len(r["review"].get("defectsFound", [])) for r in rs]),
            "defectsLocated": mean([len(r["review"].get("defectsLocated", [])) for r in rs]),
            "falsePositives": mean([len(r["review"].get("falsePositives", [])) for r in rs]),
            "itemsRight": mean([r["review"].get("itemsRight", 0) for r in rs]),
            "reviewSeconds": mean([c["seconds"] for c in rev_cards]),
            "outTokPerSec": mean([c["outTokPerSec"] for c in impl_cards + rev_cards if c.get("outTokPerSec")]),
            "outputTokens": sum(c["outputTokens"] or 0 for c in impl_cards + rev_cards),
            "promptTokens": sum(c["promptTokens"] or 0 for c in impl_cards + rev_cards),
            "failureCategories": sorted({x for c in impl_cards + rev_cards for a in (c["failureCategories"] or []) for x in a}),
            "stalls": sum(c.get("stalls") or 0 for c in impl_cards + rev_cards),
        }
    return s


def report(rows: list[dict], s: dict[str, dict]) -> str:
    L = ["# Bancada de modelos: o mesmo harness em quatro modelos locais", "",
         "Gerado por `docs/estudo/bancada.py` a partir dos registros do harness. Não edite à mão.",
         "Leitura e conclusões: [bancada/analise.md](bancada/analise.md). Scripts e gabarito: [bancada/scripts/](bancada/scripts/).", "",
         "![Qualidade](graficos/bancada-qualidade.png)", "", "![Velocidade](graficos/bancada-velocidade.png)", "",
         "## Montagem", "",
         "- Mesmo harness (`tools/alice-harness`, perfis em `models.yaml`), mesmos cartões, mesma GPU de 12 GB.",
         "- Todos os modelos cabem 100% na GPU com contexto de 32k (o harness compacta em ~28 mil tokens).",
         "- Implementação: E2-T15, E2-T19, E2-T22 a partir dos esboços (`z.never()`) do E2-T13.",
         "- Pré-revisão: E2-T23 sobre os corpos prontos com **4 defeitos plantados** (C3, C4, C5, C7);",
         "  C1, C2 e C6 estão corretos. Nota = itens com o veredito certo (de 7).",
         "- Cada modelo roda várias vezes (temperatura > 0): os números são médias por repetição.", "",
         "## Comparativo", "",
         "| Modelo | Rep. | Impl. done | Sem reprovação | Impl. limpa | Reprovações/cartão | s/cartão | Defeitos achados (de 4) | …no arquivo certo | Falsos positivos | Itens certos (de 7) | tok/s |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for p, x in s.items():
        L.append(f"| {LABEL[p]} | {x['reps']} | {x['implDone']} | {x['implFirstPass']} | {x['implClean']} | {x['implRejections']} | "
                 f"{x['implSeconds']} | {x['defectsFound']} | {x['defectsLocated']} | {x['falsePositives']} | {x['itemsRight']} | {x['outTokPerSec']} |")
    L += ["", "*Sem reprovação* = o 1º finish já passou na verificação do harness. Toda execução aprovada tem ao menos 2",
          "tentativas, porque depois da aprovação vem uma rodada obrigatória de limpeza; por isso contamos reprovações.",
          "*Impl. limpa* = testes do cartão passam, typecheck ok, `strictObject`, `export type` e nenhum esboço restante",
          "(conferido pelo Claude depois, fora do harness). *No arquivo certo* = a evidência do item cita o arquivo",
          "do defeito (um 'falta' com a prova errada não conta). Itens certos olha só o veredito.", ""]
    for p, x in s.items():
        L += [f"## {LABEL[p]}", "",
              f"- Tokens: {x['promptTokens']} de entrada, {x['outputTokens']} de saída; {x['outTokPerSec']} tok/s de saída.",
              f"- Pré-revisão: {x['reviewDone']} done, {x['reviewSeconds']} s em média, {x['reviewRejections']} reprovação(ões) por execução.",
              f"- Erros 5xx do Ollama absorvidos pelo harness (LI-049): {x['serverErrors']}.",
              f"- Categorias de falha que o harness devolveu: {', '.join(x['failureCategories']) or 'nenhuma'}; travamentos: {x['stalls']}.", "",
              "| Rep. | Cartão | Status | Tent. | Chamadas | s | Reprovações (categorias) | Nota |", "|---|---|---|---|---|---|---|---|"]
        for r in [r for r in rows if r["profile"] == p]:
            for c in r["cards"]:
                if c["kind"] == "implement":
                    v = r["implement"].get(c["task"], {})
                    nota = "limpa" if v.get("clean") else ", ".join(k for k, bad in (
                        ("esboço", v.get("stub")), ("sem export type", not v.get("exportType")),
                        ("sem strict", not v.get("strict")), ("testes", not v.get("testsPass")),
                        ("typecheck", not v.get("typecheck"))) if bad) or "?"
                else:
                    rv = r["review"]
                    wrong = [k for k in rv.get("defectsFound", []) if k not in rv.get("defectsLocated", [])]
                    nota = (f"{rv.get('itemsRight', 0)}/7; achou {', '.join(rv.get('defectsFound', [])) or 'nada'}"
                            + (f" (prova errada: {', '.join(wrong)})" if wrong else "")
                            + (f"; falso positivo {', '.join(rv['falsePositives'])}" if rv.get("falsePositives") else ""))
                cats = " → ".join("+".join(a) for a in (c["failureCategories"] or [])) or "—"
                L.append(f"| {r['rep']} | {c['task']} | {c['status']} | {c['attempts']} | {c['toolCalls']} | {c['seconds']} | {cats} | {nota} |")
        L.append("")
    L += ["## Gabarito da pré-revisão", ""] + [f"- {k}: {v}" for k, v in DEFECT.items()] + [""]
    return "\n".join(L)


def charts(s: dict[str, dict]) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib ausente: sem gráficos")
        return
    names = [p for p in s]
    frac = lambda t: int(t.split("/")[0]) / max(int(t.split("/")[1]), 1) * 100  # noqa: E731
    fig, ax = plt.subplots(1, 2, figsize=(11, 4))
    x = range(len(names))
    ax[0].bar([i - 0.2 for i in x], [frac(s[p]["implFirstPass"]) for p in names], 0.4, label="sem reprovação")
    ax[0].bar([i + 0.2 for i in x], [frac(s[p]["implClean"]) for p in names], 0.4, label="limpa (conferida)")
    ax[0].set_xticks(list(x), names); ax[0].set_ylabel("% dos cartões"); ax[0].set_title("Implementação"); ax[0].legend()
    ax[1].bar([i - 0.2 for i in x], [s[p]["defectsFound"] for p in names], 0.4, label="defeitos achados (de 4)")
    ax[1].bar([i + 0.2 for i in x], [s[p]["falsePositives"] for p in names], 0.4, label="falsos positivos")
    ax[1].set_xticks(list(x), names); ax[1].set_title("Pré-revisão"); ax[1].legend()
    fig.tight_layout(); fig.savefig(HERE / "graficos" / "bancada-qualidade.png", dpi=120)
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.bar(names, [s[p]["outTokPerSec"] for p in names]); ax.set_ylabel("tok/s de saída"); ax.set_title("Velocidade (GPU 12 GB)")
    fig.tight_layout(); fig.savefig(HERE / "graficos" / "bancada-velocidade.png", dpi=120)


def main() -> int:
    bench = Path(sys.argv[1])
    rows = collect(bench)
    s = summarize(rows)
    out = HERE / "bancada"
    out.mkdir(exist_ok=True)
    (out / "resultados.json").write_text(json.dumps({"resumo": s, "execucoes": rows}, ensure_ascii=False, indent=1))
    (HERE / "bancada-modelos.md").write_text(report(rows, s))
    charts(s)
    print(json.dumps(s, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
