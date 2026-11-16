#!/usr/bin/env python3
"""Bia: revisora independente de testes, por API (OpenRouter). Nome dado pelo Joel em 15/11/2026.

Por que existe (erro 11): quem escreve o cartão (Claude) não pode aprovar o teste feito a partir dele. A Bia
lê só o contrato (readFirst, regras) e o que vai revisar; não vê o raciocínio do Claude.

    python3 bia.py card  <plano> <ID>   revisa o cartão test-author antes de ir para quem escreve
    python3 bia.py test  <plano> <ID>   revisa o teste entregue e grava docs/plano/revisao/<ID>.md assinada
    python3 bia.py write <plano> <ID>   escreve o teste do cartão (experimento: Bia escreve, outro revisa)
    opções: --model <id OpenRouter>  --as <nome do revisor na assinatura>  --repo <raiz>

Regras dela: nunca calcula valor (na sonda errou dígito verificador); cobra fonte de literal, acusa contradição,
asserção vazia, teste que refaz o algoritmo e comportamento do contrato sem teste. Os checks mecânicos do cartão
rodam antes: com check vermelho a revisão nem é pedida. Resposta bruta em runs/bia/<id>.json (com o sha lido).
Saída: 0 aprovado, 2 reprovado, 3 erro de API ou de resposta.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import yaml

from alice import restore_allowed, run_cmd
from review import RAW_DIR, blob_sha, review_file
from rules import rules_text

URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
HERE = Path(__file__).resolve().parent


def api_key(repo: Path) -> str:
    if os.environ.get("OPEN_ROUTER_API_KEY"):
        return os.environ["OPEN_ROUTER_API_KEY"]
    for f in (HERE / ".env", repo / ".env"):
        if f.exists():
            for line in f.read_text().splitlines():
                if line.startswith("OPEN_ROUTER_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("bia: falta OPEN_ROUTER_API_KEY (.env)")


def chat(messages: list[dict], model: str, key: str, timeout: int = 900, tries: int = 4) -> dict:
    body = json.dumps({"model": model, "messages": messages}).encode()
    for n in range(tries):
        req = urllib.request.Request(URL, body, {"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read())
            if data.get("choices"):
                return data
            err = data.get("error") or data
        except urllib.error.HTTPError as e:
            err = f"HTTP {e.code}: {e.read()[:300]!r}"
        except (urllib.error.URLError, TimeoutError) as e:
            err = str(e)
        if n + 1 < tries:
            time.sleep(30 * (n + 1))  # free tier: 429 e fila são comuns
    raise RuntimeError(f"OpenRouter falhou {tries}x: {err}")


def contract(repo: Path, card: dict) -> str:
    """O que a Bia pode ler: regras citadas e readFirst (menos os arquivos do próprio cartão)."""
    mine = {str(p) for p in card.get("allowedPaths") or []}
    parts = []
    if card.get("rules"):
        parts.append("Regras de negócio citadas:\n" + rules_text(repo, [str(r) for r in card["rules"]]))
    for f in card.get("readFirst") or []:
        if str(f) not in mine and (repo / str(f)).is_file():
            parts.append(f"=== {f} ===\n{(repo / str(f)).read_text()}")
    return "\n\n".join(parts)


def run_checks(repo: Path, card: dict) -> list[tuple[str, int, str]]:
    return [(str(c), *run_cmd(str(c), repo)) for c in card.get("checks") or []]


def parse_json(text: str) -> dict:
    a, b = text.find("{"), text.rfind("}")
    if a < 0 or b < a:
        raise ValueError("resposta sem JSON")
    return json.loads(text[a:b + 1])


def save_raw(data: dict, extra: dict) -> str:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    rid = str(data.get("id") or f"local-{time.strftime('%Y%m%d-%H%M%S')}")
    (RAW_DIR / f"{rid}.json").write_text(json.dumps({**extra, "response": data}, ensure_ascii=False, indent=1))
    return rid


def usage(data: dict) -> str:
    u = data.get("usage") or {}
    return f"tokens bia: entrada={u.get('prompt_tokens', 0)} saída={u.get('completion_tokens', 0)} custo={u.get('cost', 0)}"


TEST_RULES = """Você é a Bia, revisora independente de testes. O teste foi escrito ANTES da implementação (TDD) e vai
decidir se a implementação está pronta. Teste serve para barrar defeito: precisa ser possível de passar com uma
implementação correta e precisa afirmar o contrato, sem refazer o algoritmo.
Revise SÓ contra o contrato e o cartão. Procure:
1) teste impossível: casos que se contradizem ou contradizem o contrato (mesma entrada esperando erro e valor);
2) asserção que sempre passa ou não afirma nada;
3) valor literal esperado que não está no cartão nem no contrato (sem fonte). NUNCA calcule valores você mesma
   (dígito verificador, hash, soma): só pergunte se o literal tem fonte;
4) teste que reimplementa o algoritmo em vez de afirmar propriedades ou valores da fonte;
5) linha do PRONTO QUANDO que nenhum teste confere.
Responda SÓ com JSON, em pt-BR:
{"veredito":"aprovado"|"reprovado",
 "itens":[{"n":<número da linha do pronto>,"ok":true|false,"onde":"<nome do it e linha do teste que confere>"}],
 "problemas":[{"linha":<linha do teste>,"regra":<1-5>,"explicacao":"..."}]}
Aprovado só se não houver problema e todos os itens forem ok."""


def review_test(repo: Path, card: dict, model: str, name: str) -> int:
    path = str((card.get("allowedPaths") or [None])[0])
    if not (repo / path).is_file():
        print(f"bia: {path} não existe")
        return 2
    checks = run_checks(repo, card)
    red = [(c, code, out) for c, code, out in checks if code != 0]
    if red:
        print("bia: checks do cartão vermelhos, revisão não pedida:\n" + "\n".join(f"$ {c}\nexit={code}\n{out[-1500:]}" for c, code, out in red))
        return 2
    done = [str(d) for d in card.get("done") or []]
    src = (repo / path).read_text()
    numbered = "\n".join(f"{i + 1:3d}  {line}" for i, line in enumerate(src.splitlines()))
    prompt = (f"{TEST_RULES}\n\n# CONTRATO\n{contract(repo, card)}\n\n# CARTÃO {card['id']}: {card.get('title', '')}\n"
              f"PRONTO QUANDO:\n" + "\n".join(f"{i + 1}. {d}" for i, d in enumerate(done)) +
              "\n\nChecks mecânicos (já rodaram e passaram): " + "; ".join(c for c, _, _ in checks) +
              f"\n\n# TESTE {path} (com número de linha)\n{numbered}\n")
    sha = blob_sha(repo, path, "worktree")
    try:
        data = chat([{"role": "user", "content": prompt}], model, api_key(repo))
        verdict = parse_json(data["choices"][0]["message"]["content"] or "")
    except (RuntimeError, ValueError, KeyError) as e:
        print(f"bia: {e}")
        return 3
    rid = save_raw(data, {"card": card["id"], "task": "test", "path": path, "sha": sha, "reviewer": name, "model": model})
    items = {int(i.get("n", 0)): i for i in verdict.get("itens") or [] if str(i.get("n", "")).isdigit()}
    problems = verdict.get("problemas") or []
    ok = verdict.get("veredito") == "aprovado" and not problems and all(items.get(n + 1, {}).get("ok") for n in range(len(done)))
    lines = [f"# Revisão {card['id']}", "", f"revisor: {name} {model} {rid}", f"arquivo: {path} {sha}", ""]
    for n, d in enumerate(done, 1):
        it = items.get(n, {})
        mark = "x" if ok and it.get("ok") else " "
        lines.append(f"- [{mark}] {d} — {str(it.get('onde') or 'sem resposta').strip()}")
    if problems:
        lines += ["", "## Problemas"] + [f"- linha {p.get('linha')} (regra {p.get('regra')}): {p.get('explicacao')}" for p in problems]
    f = review_file(repo, card["id"])
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text("\n".join(lines) + "\n")
    print(f"{'aprovado' if ok else 'reprovado'} por {name} ({model}): {f.relative_to(repo)}\n{usage(data)}")
    for p in problems:
        print(f"  - linha {p.get('linha')} (regra {p.get('regra')}): {p.get('explicacao')}")
    return 0 if ok else 2


CARD_RULES = """Você é a Bia, revisora independente. Abaixo está um cartão que pede a outro agente um ARQUIVO DE TESTE
(TDD, antes da implementação). Diga se o cartão permite escrever um teste possível e útil. Procure:
1) linhas do PRONTO QUANDO que se contradizem entre si ou contradizem o contrato;
2) valor literal sem fonte no contrato ou nas regras (NUNCA calcule o valor você mesma; só cobre a fonte);
3) linha que obriga o teste a refazer o algoritmo em vez de afirmar propriedade;
4) comportamento do contrato que nenhuma linha cobre (só os importantes);
5) linha vaga, que não dá para conferir lendo o teste.
Responda SÓ com JSON, em pt-BR:
{"veredito":"aprovado"|"reprovado","problemas":[{"linha":<n do pronto ou 0>,"regra":<1-5>,"explicacao":"..."}]}"""


def review_card(repo: Path, card: dict, model: str, name: str) -> int:
    done = [str(d) for d in card.get("done") or []]
    shown = {k: card.get(k) for k in ("id", "title", "rules", "refs", "allowedPaths", "checks", "hints")}
    prompt = (f"{CARD_RULES}\n\n# CONTRATO\n{contract(repo, card)}\n\n# CARTÃO\n{yaml.safe_dump(shown, allow_unicode=True, sort_keys=False)}"
              "PRONTO QUANDO:\n" + "\n".join(f"{i + 1}. {d}" for i, d in enumerate(done)))
    try:
        data = chat([{"role": "user", "content": prompt}], model, api_key(repo))
        verdict = parse_json(data["choices"][0]["message"]["content"] or "")
    except (RuntimeError, ValueError, KeyError) as e:
        print(f"bia: {e}")
        return 3
    rid = save_raw(data, {"card": card["id"], "task": "card", "reviewer": name, "model": model})
    problems = verdict.get("problemas") or []
    ok = verdict.get("veredito") == "aprovado" and not problems
    f = repo / "docs/plano/revisao" / f"{card['id']}-cartao.md"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text("\n".join([f"# Revisão do cartão {card['id']}", "", f"revisor: {name} {model} {rid}",
                            f"veredito: {'aprovado' if ok else 'reprovado'}", ""] +
                           [f"- linha {p.get('linha')} (regra {p.get('regra')}): {p.get('explicacao')}" for p in problems]) + "\n")
    print(f"cartão {'aprovado' if ok else 'reprovado'} por {name} ({model}): {f.relative_to(repo)}\n{usage(data)}")
    for p in problems:
        print(f"  - linha {p.get('linha')} (regra {p.get('regra')}): {p.get('explicacao')}")
    return 0 if ok else 2


WRITE_RULES = """Você é a Bia e vai escrever UM arquivo de teste (vitest, TypeScript) ANTES da implementação (TDD).
O teste serve para barrar defeito: afirme propriedades do contrato e os valores literais que o cartão dá.
Nunca calcule valores esperados (dígito verificador, hash) e nunca refaça o algoritmo no teste.
Cada linha do PRONTO QUANDO precisa de um teste que a confira. Os checks do cartão rodam no seu arquivo e o
resultado volta para você se algo falhar. Responda SÓ com o arquivo inteiro num bloco ```ts."""


def write_test(repo: Path, card: dict, model: str, rounds: int = 3) -> int:
    path = str((card.get("allowedPaths") or [None])[0])
    log_dir = RAW_DIR / f"write-{card['id']}-{time.strftime('%Y%m%d-%H%M%S')}"
    log_dir.mkdir(parents=True, exist_ok=True)
    restore_allowed(repo, card, log_dir)
    done = [str(d) for d in card.get("done") or []]
    messages = [{"role": "user", "content": (
        f"{WRITE_RULES}\n\n# CONTRATO\n{contract(repo, card)}\n\n# CARTÃO {card['id']}: {card.get('title', '')}\n"
        f"Arquivo: {path}\nPRONTO QUANDO:\n" + "\n".join(f"- {d}" for d in done) +
        "\nDicas:\n" + "\n".join(f"- {h}" for h in card.get("hints") or []) +
        "\nChecks:\n" + "\n".join(f"{i}: {c}" for i, c in enumerate(card.get("checks") or [])))}]
    key, tokens = api_key(repo), [0, 0]
    for n in range(1, rounds + 1):
        try:
            data = chat(messages, model, key)
        except RuntimeError as e:
            print(f"bia: {e}")
            return 3
        u = data.get("usage") or {}
        tokens[0] += u.get("prompt_tokens", 0)
        tokens[1] += u.get("completion_tokens", 0)
        text = data["choices"][0]["message"]["content"] or ""
        (log_dir / f"round-{n}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
        m = re.search(r"```(?:ts|typescript)?\n(.*?)```", text, re.S)
        if not m:
            messages += [{"role": "assistant", "content": text}, {"role": "user", "content": "Responda só com o arquivo num bloco ```ts."}]
            continue
        (repo / path).write_text(m.group(1))
        red = [(c, code, out) for c, code, out in run_checks(repo, card) if code != 0]
        print(f"rodada {n}: {'checks verdes' if not red else f'{len(red)} check(s) vermelho(s)'}")
        if not red:
            print(f"bia escreveu {path} em {n} rodada(s); tokens bia: entrada={tokens[0]} saída={tokens[1]}")
            return 0
        messages += [{"role": "assistant", "content": text},
                     {"role": "user", "content": "Checks vermelhos; corrija o arquivo inteiro:\n" +
                      "\n".join(f"$ {c}\nexit={code}\n{out[-2000:]}" for c, code, out in red)}]
    print(f"bia não fechou {path} em {rounds} rodadas; tokens bia: entrada={tokens[0]} saída={tokens[1]}")
    return 2


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("task", choices=["card", "test", "write"])
    ap.add_argument("plan", type=Path)
    ap.add_argument("id")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--as", dest="name", default="bia")
    ap.add_argument("--repo", type=Path, default=Path("."))
    ns = ap.parse_args()
    if ns.name.lower() == "claude":
        sys.exit("bia: o Claude não assina revisão (erro 11)")
    repo = ns.repo.resolve()
    card = next((c for c in (yaml.safe_load(ns.plan.read_text()) or {}).get("cards", []) if c.get("id") == ns.id), None)
    if not card or card.get("kind") != "test-author":
        sys.exit(f"bia: {ns.id} não é cartão test-author em {ns.plan}")
    if ns.task == "card":
        return review_card(repo, card, ns.model, ns.name)
    if ns.task == "test":
        return review_test(repo, card, ns.model, ns.name)
    return write_test(repo, card, ns.model)


if __name__ == "__main__":
    sys.exit(main())
