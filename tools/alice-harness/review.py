"""Revisão do Claude sobre teste entregue pela Alice (e4-guardrails G, erro 11 da lista).

Um teste de cartão test-author só vira base de outro cartão depois de revisado linha a linha contra o `done`.
A revisão fica em docs/plano/revisao/<ID>.md:

    # Revisão E4-T01
    revisor: bia <modelo> <id da resposta>
    arquivo: packages/schemas/src/fake-cpf.test.ts <sha do blob>
    - [x] <linha do done, copiada> — <onde o teste confere isso>
    ...

Quem revisa é a Bia (bia.py test), nunca o Claude: quem escreveu o cartão não aprova o teste feito a partir
dele. A assinatura aponta para a resposta bruta em runs/bia/<id>.json, que guarda o sha lido; sem ela, ou com
outro sha, a revisão não vale. O sha amarra a revisão ao conteúdo: mudou o teste, a revisão vence. Quem
confere: o hook do Claude (git commit), o pré-voo do implement (alice.py run) e `alice.py review`.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

REVIEW_DIR = Path("docs/plano/revisao")
ITEM = re.compile(r"^- \[( |x)\] (.+?) — (.+)$")
FILE_LINE = re.compile(r"^arquivo: (\S+) ([0-9a-f]{40})$")
SIGNED = re.compile(r"^revisor: (\S+) (\S+) (\S+)$", re.M)
RAW_DIR = Path(__file__).resolve().parent / "runs" / "bia"


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
                f"a Bia revisa com `bia.py test <plano> {cid}`"]
    out = []
    files = {m.group(1): m.group(2) for m in map(FILE_LINE.match, text.splitlines()) if m}
    out += signature_problems(cid, text, files)
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


def signature_problems(cid: str, text: str, files: dict[str, str]) -> list[str]:
    """A revisão vale só com a resposta bruta do revisor (não o Claude) sobre o mesmo sha (erro 11)."""
    m = SIGNED.search(text)
    if not m:
        return [f"{cid}: revisão sem assinatura 'revisor: <nome> <modelo> <id>': rode `bia.py test <plano> {cid}`"]
    name, _, rid = m.groups()
    if name.lower() == "claude":
        return [f"{cid}: o Claude não assina revisão de teste (erro 11): rode `bia.py test <plano> {cid}`"]
    try:
        meta = json.loads((RAW_DIR / f"{rid}.json").read_text())
    except (OSError, ValueError):
        return [f"{cid}: a assinatura aponta para {rid}, mas a resposta bruta não existe: rode `bia.py test` de novo"]
    if meta.get("card") != cid or meta.get("task") != "test" or files.get(str(meta.get("path"))) != meta.get("sha"):
        return [f"{cid}: a resposta bruta {rid} é de outro cartão ou de outra versão do teste: rode `bia.py test` de novo"]
    return []
