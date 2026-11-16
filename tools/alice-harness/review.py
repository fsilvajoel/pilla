"""Revisão do Claude sobre teste entregue pela Alice (e4-guardrails G, erro 11 da lista).

Um teste de cartão test-author só vira base de outro cartão depois de revisado linha a linha contra o `done`.
A revisão fica em docs/plano/revisao/<ID>.md:

    # Revisão E4-T01
    arquivo: packages/schemas/src/fake-cpf.test.ts <sha do blob>
    - [x] <linha do done, copiada> — <onde o teste confere isso>
    ...

O sha amarra a revisão ao conteúdo lido: mudou o teste, a revisão vence. Quem confere: o hook do Claude
(git commit), o pré-voo do implement (alice.py run) e `alice.py review <plano> <ID>` (gera o modelo).
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

REVIEW_DIR = Path("docs/plano/revisao")
ITEM = re.compile(r"^- \[( |x)\] (.+?) — (.+)$")
FILE_LINE = re.compile(r"^arquivo: (\S+) ([0-9a-f]{40})$")


def review_file(repo: Path, cid: str) -> Path:
    return repo / REVIEW_DIR / f"{cid}.md"


def blob_sha(repo: Path, path: str, where: str) -> str | None:
    """sha do arquivo em `where`: 'worktree', 'staged' (índice) ou 'HEAD'."""
    if where == "worktree":
        args = ["git", "hash-object", path]
    else:
        args = ["git", "rev-parse", f"{'' if where == 'staged' else 'HEAD'}:{path}"]
    p = subprocess.run(args, cwd=repo, capture_output=True, text=True)
    return p.stdout.strip() if p.returncode == 0 else None


def template(repo: Path, card: dict) -> str:
    lines = [f"# Revisão {card['id']}", ""]
    for path in card.get("allowedPaths") or []:
        lines.append(f"arquivo: {path} {blob_sha(repo, str(path), 'worktree') or '?'}")
    lines.append("")
    lines += [f"- [ ] {d} — " for d in card.get("done") or []]
    return "\n".join(lines) + "\n"


def review_problems(repo: Path, card: dict, where: str = "HEAD", text: str | None = None) -> list[str]:
    """Vazio = revisão completa e do conteúdo atual em `where`. `text` substitui a leitura do arquivo."""
    cid = card.get("id", "?")
    f = review_file(repo, cid)
    if text is None:
        if where == "staged":
            p = subprocess.run(["git", "show", f":{f.relative_to(repo)}"], cwd=repo, capture_output=True, text=True)
            text = p.stdout if p.returncode == 0 else None
        elif where == "HEAD":
            p = subprocess.run(["git", "show", f"HEAD:{f.relative_to(repo)}"], cwd=repo, capture_output=True, text=True)
            text = p.stdout if p.returncode == 0 else None
        else:
            text = f.read_text() if f.exists() else None
    if text is None:
        return [f"{cid}: falta a revisão {f.relative_to(repo)} ({'no commit' if where == 'HEAD' else where}); "
                f"gere com `alice.py review <plano> {cid}` e confira cada linha do done no teste"]
    out = []
    files = {m.group(1): m.group(2) for m in map(FILE_LINE.match, text.splitlines()) if m}
    for path in card.get("allowedPaths") or []:
        sha = blob_sha(repo, str(path), where)
        if path not in files:
            out.append(f"{cid}: a revisão não cita {path} (linha 'arquivo: <caminho> <sha>')")
        elif files[path] != sha:
            out.append(f"{cid}: a revisão leu outra versão de {path} (sha {files[path][:8]} ≠ {str(sha)[:8]}): revise de novo")
    items = [m for m in map(ITEM.match, text.splitlines()) if m]
    done = [str(d) for d in card.get("done") or []]
    reviewed = {m.group(2).strip(): m for m in items}
    for d in done:
        m = reviewed.get(d.strip())
        if not m:
            out.append(f"{cid}: a revisão não tem a linha do done: {d[:70]}")
        elif m.group(1) != "x":
            out.append(f"{cid}: linha do done não aprovada ([ ]): {d[:70]}")
        elif len(m.group(3).strip()) < 8:
            out.append(f"{cid}: linha do done sem evidência (onde o teste confere): {d[:70]}")
    return out
