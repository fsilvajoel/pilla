"""Gates inspired by tech-leads-club/harness-toolkit (ideas only; Elastic License 2.0, no code copied).

- classify/gap_feedback: numbered gaps with a category and runtime-computed next steps (toolkit: gap feedback,
  failure classification, autopilot, progressive context) — LI-044.
- StallDetector: same tool call with the same arguments in a row (toolkit: shell stall) — LI-045.
- duplicated_runs: added code that already exists in another file (toolkit: duplication gate) — LI-046.
- redact: secret-shaped spans masked in tool output before the model or the log sees them (toolkit: secret
  redaction) — LI-047.
- an implement/test-author/docs/research/cards run that changed nothing is not done (toolkit: empty-diff
  anti-ship) — LI-048 (wired in alice.Run.verify).
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

# ---------------------------------------------------------------- failure classification + autopilot

CATEGORIES: list[tuple[str, re.Pattern[str]]] = [
    ("vazio", re.compile(r"nenhum arquivo alterado")),
    ("escopo", re.compile(r"fora de allowedPaths")),
    ("proibido", re.compile(r": (suppression|any|console|focused/skipped test): ")),
    ("esboço", re.compile(r"ESBOÇO|linha do 'Pronto quando'")),
    ("duplicação", re.compile(r"código duplicado")),
    ("checklist", re.compile(r"summary sem linha para|'ok' sem prova|veredito contra o check")),
    ("typecheck", re.compile(r"check \d+ falhou.*(tsc|typecheck|py_compile)|error TS\d+")),
    ("lint", re.compile(r"check \d+ falhou.*(lint|eslint|check-avoid)")),
    ("mutação", re.compile(r"check \d+ falhou.*(mutation|stryker)")),
    ("teste", re.compile(r"check \d+ falhou")),
]

NEXT_STEPS = {
    "vazio": "escreva os arquivos do cartão (write_file/replace_function) e rode run_check antes do finish.",
    "escopo": "view_diff; desfaça (edit_file) o que estiver fora de allowedPaths; se precisa mexer em outro arquivo, ask_claude.",
    "proibido": "edit_file na linha citada trocando o atalho pela solução de verdade (nunca suprima o aviso).",
    "esboço": "read_file do arquivo citado; implemente o que falta (replace_function) e deixe o código igual à linha do 'Pronto quando'.",
    "duplicação": "importe a função/constante que já existe no arquivo citado em vez de copiar o trecho.",
    "checklist": "refaça o summary: uma linha por item com arquivo:linha real (read_file) ou a busca/check que prova.",
    "typecheck": "read_file no arquivo:linha do primeiro erro; corrija só aquela linha; run_check do typecheck.",
    "lint": "read_file no arquivo:linha do primeiro erro; ache o nome da regra na seção LINT do pedido e aplique o exemplo 'certo'; run_check do lint.",
    "mutação": "leia os mutantes sobreviventes; peça ao Claude (ask_claude) o caso de teste que falta — você não edita testes.",
    "teste": "leia o nome do teste que falhou e o esperado × recebido; corrija o código (não o teste); run_check.",
}


def classify(problem: str) -> str:
    for name, rx in CATEGORIES:
        if rx.search(problem):
            return name
    return "outro"


def split_problems(problems: str) -> list[str]:
    """One problem per entry: a new entry starts at a line that is not an indented/continuation line of a check."""
    out: list[str] = []
    for line in problems.splitlines():
        starts = re.match(r"(check \d+ falhou|arquivo alterado|summary sem|'ok' sem|veredito contra|nenhum arquivo|código duplicado|[^\s:]+\.[a-z]{1,4}: )", line)
        if starts or not out:
            out.append(line)
        else:
            out[-1] += "\n" + line
    return [p for p in out if p.strip()]


def gap_feedback(problems: str, history: list[list[str]]) -> tuple[str, list[str]]:
    """Numbered gaps + next steps. `history` = categories of the previous failed attempts (oldest first).
    A category that failed in the previous attempt too escalates the hint (progressive context)."""
    items = split_problems(problems)
    cats = [classify(p) for p in items]
    previous = set(history[-1]) if history else set()
    lines = [f"VERIFICAÇÃO REPROVADA ({len(items)} lacuna(s)). Feche todas e chame finish de novo:"]
    for i, (p, c) in enumerate(zip(items, cats), 1):
        lines.append(f"{i}. [{c}] {p}")
    lines.append("Próximos passos (calculados pelo ambiente, nesta ordem):")
    for i, c in enumerate(dict.fromkeys(cats), 1):
        step = NEXT_STEPS.get(c, "leia a mensagem inteira e corrija a causa.")
        if c in previous:
            step += " MESMA FALHA DA TENTATIVA ANTERIOR: mude a abordagem; se não souber como, ask_claude com o erro."
        lines.append(f"{i}. {step}")
    return "\n".join(lines), cats

# ---------------------------------------------------------------- stall detection


class StallDetector:
    """Counts identical consecutive tool calls (name + arguments). `finish` and ask_claude never count."""

    def __init__(self, warn_at: int = 3, stop_at: int = 5):
        self.warn_at, self.stop_at = warn_at, stop_at
        self.last: str | None = None
        self.count = 0

    def see(self, name: str, args: dict) -> int:
        if name in ("finish", "ask_claude"):
            self.last, self.count = None, 0
            return 0
        key = name + json.dumps(args, sort_keys=True, ensure_ascii=False, default=str)
        self.count = self.count + 1 if key == self.last else 1
        self.last = key
        return self.count

    def message(self) -> str:
        return (f"Você repetiu a mesma chamada {self.count} vezes seguidas e o resultado não muda. "
                "Pare de repetir: leia o resultado anterior, mude a abordagem ou use ask_claude.")

# ---------------------------------------------------------------- duplication

TRIVIAL = re.compile(r"^[\s{}()\[\];,]*$|^\s*(//|#|\*|/\*\*|\*/|import |from |export \* from|\}\)?;?$)")


def _norm(line: str) -> str:
    return re.sub(r"\s+", " ", line).strip()


def duplicated_runs(added: list[str], others: dict[str, str], window: int = 6) -> list[str]:
    """Windows of `window` consecutive non-trivial added lines that also appear, in order, in another file."""
    lines = [_norm(l) for l in added if not TRIVIAL.match(l) and len(_norm(l)) > 3]
    if len(lines) < window:
        return []
    index: dict[str, str] = {}
    for path, text in others.items():
        olines = [_norm(l) for l in text.splitlines() if not TRIVIAL.match(l) and len(_norm(l)) > 3]
        for i in range(len(olines) - window + 1):
            index.setdefault(hashlib.sha1("\n".join(olines[i:i + window]).encode()).hexdigest(), path)
    hits: list[str] = []
    i = 0
    while i <= len(lines) - window:
        h = hashlib.sha1("\n".join(lines[i:i + window]).encode()).hexdigest()
        if h in index:
            hits.append(f"{index[h]} (a partir de: {lines[i][:80]})")
            i += window
        else:
            i += 1
    return hits


def other_sources(repo: Path, tracked: list[str], exclude: set[str], suffix: str) -> dict[str, str]:
    out = {}
    for f in tracked:
        if f in exclude or not f.endswith(suffix) or re.search(r"\.test\.|/tests?/|test_", f):
            continue
        p = repo / f
        if p.is_file() and p.stat().st_size < 200_000:
            out[f] = p.read_text(errors="replace")
    return out

# ---------------------------------------------------------------- secret redaction

SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("private-key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)")),
    ("github-token", re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b")),
    ("aws-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("slack-token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")),
    ("url-password", re.compile(r"://[^/\s:@]+:(?P<v>[^/\s@]{3,})@")),
    ("assignment", re.compile(r"(?i)\b(?:password|passwd|secret|token|api[_-]?key)\w*[\"']?\s*[=:]\s*[\"'](?P<v>[^\"'\s]{8,})[\"']")),
    ("env-line", re.compile(r"(?m)^[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY)[A-Z0-9_]*=(?P<v>\S{8,})")),
]


def redact(text: str) -> tuple[str, int]:
    """Masks secret-shaped spans as [REDACTED:<kind>:<hash8>]; the hash lets two masks be compared without the value."""
    n = 0

    def mask(kind: str):
        def sub(m: re.Match[str]) -> str:
            nonlocal n
            n += 1
            value = m.group("v") if "v" in m.groupdict() else m.group(0)
            tag = f"[REDACTED:{kind}:{hashlib.sha256(value.encode()).hexdigest()[:8]}]"
            if "v" not in m.groupdict():
                return tag
            a, b = m.span("v")
            return m.group(0)[: a - m.start()] + tag + m.group(0)[b - m.start():]
        return sub

    for kind, rx in SECRET_PATTERNS:
        text = rx.sub(mask(kind), text)
    return text, n
