#!/usr/bin/env python3
"""PreToolUse hook do Claude Code (e4-guardrails B, G, H). Nega, com exit 2:
(a) Read/Grep/Glob/Bash que toque tools/alice-harness/runs/ fora de retro-*;
(b) Write/Edit em arquivo de allowedPaths de cartão da Alice ainda não done (docs/plano/*.yaml),
    salvo casca de implement marcada com '// @stub <ID>' (ver stub_text_ok);
(c) Bash com python3, node ou vitest que cite esses arquivos, exceto se a Alice já entregou o cartão
    (revisão: rodar a suíte uma vez é permitido; reescrever continua proibido);
(d) git commit com arquivo de cartão da Alice sem 'Card-Done: <ID>', salvo casca marcada staged
    de implement com 'Card-Stub: <ID>'; em test-author exige revisão staged completa (erro 11);
    Done com etiqueta 'stub <ID>' ainda no índice é recusado (erro 12);
(e) git commit/push com --no-verify (never-no-verify).
Done = trailer 'Card-Done: <ID>' num commit (Card-Reopen desfaz), ou ID citado em commit até LEGACY_UNTIL
(cartões fechados antes do trailer existir). Entregue = status done no resumo plan-*.json da fila E arquivo do cartão
alterado na árvore (entrega pendente de revisão; resumo antigo de entrega revertida não conta).
Lê runs/ só aqui dentro; o bloqueio vale para as ferramentas do Claude."""
from __future__ import annotations

import fnmatch
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from review import review_problems  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
RUNS = REPO / "tools" / "alice-harness" / "runs"
CARD_ID = re.compile(r"\b(E\d+)-T(\d{2})(?:\s+(?:to|a|até)\s+E\d+-T(\d{2}))?\b")
RUNS_REF = re.compile(r"(?:^|[\s'\"=(/])(?:\S*alice-harness/)?runs/([^\s'\";|&)<>]*)")
LEGACY_UNTIL = "ef3dd6f"  # último commit antes do trailer Card-Done
TRAILER = re.compile(r"^Card-(Done|Reopen):\s*(E\d+-T\d{2})\s*$", re.M)
GIT_COMMIT = re.compile(r"\bgit\b(?:\s+-C\s+\S+)?\s+commit\b")
NO_VERIFY = re.compile(r"\bgit\b[^|;&]*\b(?:commit|push)\b[^|;&]*\s(?:--no-verify|-n)\b")
INTERP = re.compile(r"(?:^|[\s;&|(/])(python3?|node|vitest|tsx|npx)\b")


def deny(msg: str) -> None:
    print(f"e4-guardrails: {msg}", file=sys.stderr)
    sys.exit(2)


def git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, text=True).stdout


def done_ids() -> set[str]:
    ids: set[str] = set()
    for e, a, b in CARD_ID.findall(git("log", "--format=%B", LEGACY_UNTIL)):
        for n in range(int(a), int(b or a) + 1):
            ids.add(f"{e}-T{n:02d}")
    msgs = git("log", "--reverse", "--format=%B%x00", f"{LEGACY_UNTIL}..HEAD")
    for kind, cid in TRAILER.findall(msgs):
        (ids.add if kind == "Done" else ids.discard)(cid)
    return ids


def delivered_ids() -> set[str]:
    ids: set[str] = set()
    for f in RUNS.glob("plan-*.json"):
        try:
            ids |= {r.get("task") for r in json.loads(f.read_text()) if r.get("status") == "done"}
        except (json.JSONDecodeError, OSError, AttributeError):
            continue
    return ids


def open_cards() -> list[dict]:
    done, out = done_ids(), []
    for f in sorted((REPO / "docs" / "plano").glob("*.yaml")):
        for c in (yaml.safe_load(f.read_text()) or {}).get("cards") or []:
            if c.get("assignee") == "alice" and c.get("id") not in done:
                out.append(c)
    return out


def pending_delivery(card: dict) -> bool:
    """A entrega está na árvore, ainda sem commit (a retro antiga não conta se o arquivo foi revertido)."""
    paths = [str(p) for p in card.get("allowedPaths") or []]
    return bool(paths) and bool(git("status", "--porcelain", "--", *paths).strip())


def reviewable_ids() -> set[str]:
    delivered = delivered_ids()
    return {c["id"] for c in open_cards() if c.get("id") in delivered and pending_delivery(c)}


def open_paths(skip: set[str] = frozenset()) -> list[str]:
    return [str(p) for c in open_cards() if c.get("id") not in skip for p in c.get("allowedPaths") or []]


def stub_marks(cid: str) -> list[str]:
    """Etiquetas 'stub <ID>' no índice: exclusão provisória (ex.: cobertura) enquanto o implement não fecha."""
    out = git("grep", "--cached", "-n", "-w", "-e", f"stub {cid}")
    return [":".join(line.split(":", 2)[:2]) for line in out.splitlines() if line]


# Stub marcado (decisão do Joel, 17/11): a linha '// @stub <ID>' identifica a casca de um cartão de implement.
# Com a marca, o Claude pode escrever e commitar (Card-Stub) a casca; sem ela, o arquivo é trabalho da Alice.
# Rede contra solução escondida: placeholder obrigatório, nenhum 'return' e o expect-red dos testes da Bia.
# Card-Done com a marca ainda no índice é recusado (stub_marks casa '@stub <ID>').
STUB_THROW = re.compile(r'throw\s+new\s+Error\s*\(\s*([\x27\"])not implemented\1\s*\)')
STUB_RETURN = re.compile(r'\breturn\b')


def stub_marker(cid: str) -> re.Pattern[str]:
    return re.compile(rf'^\s*//\s*@stub\s+{re.escape(cid)}\s*$', re.M)


def stub_text_ok(text: str, cid: str) -> bool:
    """Casca TS/TSX marcada para o cartão: marca, ao menos um placeholder e nenhum return."""
    return bool(stub_marker(cid).search(text)) and bool(STUB_THROW.search(text)) and not STUB_RETURN.search(text)


def stub_path_ok(path: str) -> bool:
    return bool(re.fullmatch(r'[\w./-]+\.tsx?', path)) and '..' not in Path(path).parts


def staged_stub(path: str, cid: str) -> bool:
    """Arquivo staged de código TS/TSX que é casca marcada do cartão."""
    if not stub_path_ok(path):
        return False
    blob = subprocess.run(['git', '-C', str(REPO), 'show', f':{path}'], capture_output=True, text=True)
    return not blob.returncode and stub_text_ok(blob.stdout, cid)


def card_of(target: str) -> dict | None:
    for c in open_cards():
        if any(target == str(p) or fnmatch.fnmatch(target, str(p)) for p in c.get("allowedPaths") or []):
            return c
    return None


def stub_write_ok(target: str, tool: str, inp: dict) -> bool:
    """Write/Edit do Claude em arquivo de cartão só se o resultado continua casca marcada de implement."""
    card = card_of(target)
    if not card or card.get("kind") != "implement" or not stub_path_ok(target):
        return False
    if tool == "Write":
        text = inp.get("content")
    elif tool == "Edit":
        try:
            old = (REPO / target).read_text()
        except OSError:
            return False
        a, b = inp.get("old_string") or "", inp.get("new_string") or ""
        if not a or a not in old:
            return False
        text = old.replace(a, b) if inp.get("replace_all") else old.replace(a, b, 1)
    else:
        return False
    return isinstance(text, str) and stub_text_ok(text, card["id"])


def has_trailer(cmd: str, kind: str, cid: str) -> bool:
    return bool(re.search(rf'(?:^|[\x27\"\n])Card-{kind}:\s*{re.escape(cid)}(?=[\x27\"\n]|$)', cmd))


def commit_problems(cmd: str) -> list[str]:
    staged = [line for line in git("diff", "--cached", "--name-only").splitlines() if line]
    out = []
    for c in open_cards():
        paths = [str(p) for p in c.get("allowedPaths") or []]
        mine = [f for f in staged if any(f == p or fnmatch.fnmatch(f, p) for p in paths)]
        tagged = has_trailer(cmd, 'Done', c['id'])
        stub = has_trailer(cmd, 'Stub', c['id'])
        if not mine and not tagged and not stub:
            continue
        stub_ok = c.get('kind') == 'implement' and bool(mine) and all(staged_stub(p, c['id']) for p in mine)
        if stub and not tagged and not stub_ok:
            out.append(f"{c['id']}: Card-Stub exige arquivo de implement staged com '// @stub {c['id']}', "
                       "placeholder 'not implemented' e nenhum return")
        if mine and not tagged and not (stub and stub_ok):
            out.append(f"{', '.join(mine)} é de {c['id']}: o commit precisa do trailer 'Card-Done: {c['id']}'")
        if c.get("kind") == "test-author":
            out += review_problems(REPO, c, "staged")
        if tagged:
            out += [f"{c['id']}: a etiqueta de stub continua em {hit} (tire a exclusão de cobertura no mesmo commit)"
                    for hit in stub_marks(c["id"])]
    return out


CWD = Path.cwd()


def rel(path: str) -> str:
    p = Path(path)
    try:
        return str((p if p.is_absolute() else CWD / p).resolve().relative_to(REPO))
    except ValueError:
        return str(p)


def touches_runs(text: str) -> bool:
    if "runs/" not in text:
        return False
    if "alice-harness/runs" not in text and "alice-harness" not in str(CWD):
        return False
    for m in RUNS_REF.finditer(text):
        tail = (m.group(1) or "").rsplit("/", 1)[-1]
        if not tail.startswith("retro-"):
            return True
    return False


def main() -> None:
    global CWD
    ev = json.load(sys.stdin)
    CWD = Path(ev.get("cwd") or Path.cwd())
    tool, inp = ev.get("tool_name", ""), ev.get("tool_input") or {}
    path = inp.get("file_path") or inp.get("notebook_path") or inp.get("path") or ""
    cmd = inp.get("command") or ""
    if tool in ("Read", "Grep", "Glob"):
        target = rel(path) if path else ""
        if target.startswith("tools/alice-harness/runs") and not Path(target).name.startswith("retro-"):
            deny(f"{tool} em {target}: log de cartão é proibido (só retro-*). Erro 2 da lista.")
        if tool == "Glob" and "runs/" in str(inp.get("pattern", "")) and "retro-" not in str(inp.get("pattern", "")):
            deny("Glob em runs/: log de cartão é proibido (só retro-*).")
    if tool == "Bash" and touches_runs(cmd):
        deny("Bash toca tools/alice-harness/runs/ fora de retro-*: log de cartão é proibido. Erro 2 da lista.")
    if tool in ("Write", "Edit", "NotebookEdit", "MultiEdit") and path:
        target = rel(path)
        for p in open_paths():
            if (target == p or fnmatch.fnmatch(target, p)) and not stub_write_ok(target, tool, inp):
                deny(f"{tool} em {target}: arquivo de cartão da Alice ainda não done. Erro 1 da lista (escrever a solução).")
    if tool == "Bash" and NO_VERIFY.search(cmd):
        deny("--no-verify é proibido: o verify é o portão de qualidade (never-no-verify).")
    if tool == "Bash" and GIT_COMMIT.search(cmd):
        problems = commit_problems(cmd)
        if problems:
            deny("commit de entrega da Alice recusado (erro 11):\n- " + "\n- ".join(problems))
    if tool == "Bash" and INTERP.search(cmd):
        for p in open_paths(skip=reviewable_ids()):
            if p in cmd or Path(p).name in cmd:
                deny(f"Bash com interpretador cita {p}, arquivo de cartão não done. Erro 3 da lista (simular portão).")
    sys.exit(0)


if __name__ == "__main__":
    main()
