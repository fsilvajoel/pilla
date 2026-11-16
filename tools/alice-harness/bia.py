#!/usr/bin/env python3
"""Bia: revisora independente de testes, por API (OpenRouter). Nome dado pelo Joel em 15/11/2026.

Por que existe (erro 11): quem escreve o cartão (Claude) não pode aprovar o teste feito a partir dele. A Bia
lê só o contrato (readFirst, regras) e o que vai revisar; não vê o raciocínio do Claude.

    python3 bia.py card  <plano> <ID>   revisa o cartão test-author antes de ir para quem escreve
    python3 bia.py test  <plano> <ID>   revisa o teste entregue e grava docs/plano/revisao/<ID>.md assinada
    python3 bia.py write <plano> <ID>   escreve o teste do cartão (assignee: bia; outro revisa)
    python3 bia.py gate  <plano> <ID>   portão final de teste escrito pela Bia: pré-revisão local por consenso
                                        (a Bia não revisa o próprio teste; docs/agents/travas.md 4.9)
    opções: --model <id OpenRouter>  --as <nome do revisor na assinatura>  --repo <raiz>

Regras dela: nunca calcula valor (na sonda errou dígito verificador); cobra fonte de literal, acusa contradição,
asserção vazia, teste que refaz o algoritmo e comportamento do contrato sem teste. Os checks mecânicos do cartão
rodam antes: com check vermelho a revisão nem é pedida. Resposta bruta em runs/bia/<id>.json (com o sha lido).
Saída: 0 aprovado, 2 reprovado, 3 erro de API ou de resposta, 4 cota do OpenRouter na reserva.

Economia (Joel, 16/11): o free tier dá 50 requisições por dia (free_model_daily_requests em /api/v1/key); a GPU
local da Alice não tem custo. Então: a Alice escreve teste e código; antes de cada chamada à Bia, a Alice faz a
mesma revisão localmente (--no-pre desliga) e, se ela já achar problema, a requisição não sai; a cota é lida antes
de cada chamada e a Bia para com BIA_RESERVE (padrão 5) restantes; 429 de cota esgotada não é repetido.
`bia.py write` é último recurso (gasta até 3 requisições).
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
from typing import NamedTuple

import yaml

from alice import MODEL as ALICE_MODEL, PROFILE_NAME, chat_options, format_touched, load_profile, post_chat, restore_allowed, run_cmd
from review import RAW_DIR, blob_sha, rejection_notes, review_file
from rules import rules_text

URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
HERE = Path(__file__).resolve().parent
KEY_URL = "https://openrouter.ai/api/v1/key"
RESERVE = int(os.environ.get("BIA_RESERVE", "5"))
SIGNERS_REFUSED = ("claude", "alice")  # quem escreve cartão ou teste não aprova (erro 11)


class QuotaError(RuntimeError):
    pass


# tokens e requisições gastos neste processo; o plan-run lê a diferença por rodada
USAGE: dict[str, int] = {"aliceIn": 0, "aliceOut": 0, "biaIn": 0, "biaOut": 0, "biaRequests": 0}


def quota(key: str) -> dict:
    """{used, limit, remaining} das requisições free do dia; {} se a consulta falhar (não bloqueia)."""
    try:
        req = urllib.request.Request(KEY_URL, headers={"Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return (json.load(r).get("data") or {}).get("free_model_daily_requests") or {}
    except (urllib.error.URLError, TimeoutError, ValueError):
        return {}


def quota_line(key: str) -> str:
    q = quota(key)
    return f"cota OpenRouter: {q.get('remaining', '?')}/{q.get('limit', '?')} restantes hoje" if q else "cota OpenRouter: ?"


def api_key(repo: Path) -> str:
    if os.environ.get("OPEN_ROUTER_API_KEY"):
        return os.environ["OPEN_ROUTER_API_KEY"]
    for f in (HERE / ".env", repo / ".env"):
        if f.exists():
            for line in f.read_text().splitlines():
                if line.startswith("OPEN_ROUTER_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("bia: falta OPEN_ROUTER_API_KEY (.env)")


def chat(messages: list[dict], model: str, key: str, timeout: int = 900, tries: int = 3) -> dict:
    q = quota(key)
    if q and int(q.get("remaining", 0)) <= RESERVE:
        raise QuotaError(f"cota OpenRouter na reserva ({q.get('remaining')}/{q.get('limit')} restantes, BIA_RESERVE={RESERVE})")
    body = json.dumps({"model": model, "messages": messages}).encode()
    for n in range(tries):
        req = urllib.request.Request(URL, body, {"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read())
            if data.get("choices"):
                u = data.get("usage") or {}
                USAGE["biaRequests"] += 1
                USAGE["biaIn"] += int(u.get("prompt_tokens", 0))
                USAGE["biaOut"] += int(u.get("completion_tokens", 0))
                return data
            err = data.get("error") or data
        except urllib.error.HTTPError as e:
            err = f"HTTP {e.code}: {e.read()[:300]!r}"
            if e.code == 429 and int((quota(key) or {"remaining": 1}).get("remaining", 1)) <= 0:
                raise QuotaError(f"cota diária do OpenRouter esgotada: {err}") from e
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


MECHANICAL = re.compile(r"\brun_check\b|^never edit\b", re.I)


def mechanical(line: str) -> str:
    """Linha do done que o harness garante, não o teste: run_check N (checks) e never edit (allowedPaths)."""
    if not MECHANICAL.search(line):
        return ""
    return "check mecânico (passou antes da revisão)" if "run_check" in line else "allowedPaths/protectedTests do harness"


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


LOCAL_SAMPLES = int(os.environ.get("BIA_LOCAL_SAMPLES", "3"))


def local_verdict(prompt: str) -> dict | None:
    """Uma revisão na GPU da Alice: o JSON do veredito, None se falhar."""
    prof = load_profile(PROFILE_NAME)
    opts, think = chat_options(prof, {})
    payload = {"model": prof.get("model", ALICE_MODEL), "stream": False, "think": think, "options": opts,
               "messages": [{"role": "user", "content": prompt}]}
    try:
        data = post_chat(payload, int(prof.get("timeout", 600)))
        verdict = parse_json(data["message"]["content"] or "")
    except (RuntimeError, ValueError, KeyError, OSError) as e:
        print(f"pré-revisão local indisponível ({e})")
        return None
    USAGE["aliceIn"] += int(data.get("prompt_eval_count", 0))
    USAGE["aliceOut"] += int(data.get("eval_count", 0))
    print(f"pré-revisão local (alice {PROFILE_NAME}): {verdict.get('veredito')}; tokens alice: "
          f"entrada={data.get('prompt_eval_count', 0)} saída={data.get('eval_count', 0)}")
    return verdict


def local_sample(prompt: str) -> list[dict] | None:
    """Problemas se a Alice local reprovar, [] se aprovar, None se falhar."""
    verdict = local_verdict(prompt)
    if verdict is None:
        return None
    return (verdict.get("problemas") or []) if verdict.get("veredito") == "reprovado" else []


def local_review(prompt: str, samples: int | None = None) -> list[dict] | None:
    """Pré-revisão grátis por consenso: a Alice local varia de rodada a rodada e às vezes alucina (16/11: "it.each
    não existe"), então só vale o problema cuja linha aparece em pelo menos 2 amostras. Devolve esses problemas
    (um por linha) ou None (aprovou, sem consenso ou indisponível: segue para a Bia)."""
    samples = samples or LOCAL_SAMPLES
    need = min(2, samples)
    runs: list[list[dict]] = []
    for _ in range(samples):
        got = local_sample(prompt)
        if got is None:
            return None
        runs.append(got)
        votes: dict[str, int] = {}
        for r in runs:
            for line in {str(p.get("linha")) for p in r}:
                votes[line] = votes.get(line, 0) + 1
        agreed = [line for line, v in votes.items() if v >= need]
        if agreed:
            first: dict[str, dict] = {}
            for r in runs:
                for p in r:
                    first.setdefault(str(p.get("linha")), p)
            return [first[line] for line in agreed]
        if sum(1 for r in runs if not r) >= need:  # aprovou em maioria: não gasta mais GPU
            break
    return None


LAST_LOCAL: list[dict] = []


CODE = re.compile(r"`([^`]+)`")


def grounded(problem: dict, done: list[str], src: str) -> bool:
    """Nota local só vale se citar (entre crases) algo que o pronto exige e o arquivo não tem. As notas soltas da
    pré-revisão local contradiziam o pronto em 3 de 4 casos (E4-T03, 16/11) e pioraram a rodada seguinte."""
    pronto = "\n".join(map(str, done))
    return any(code in pronto and code not in src for code in CODE.findall(str(problem.get("explicacao") or "")))


def write_rejection(repo: Path, cid: str, path: str, sha: str, problems: list[dict],
                    done: list[str] | None = None, src: str = "") -> None:
    """Reprovação local também vira revisao/<ID>.md (sem assinatura válida): a próxima rodada da Alice lê só os
    problemas com apoio no pronto; os demais ficam registrados à parte."""
    keep = [p for p in problems if grounded(p, done or [], src)]
    item = lambda p: f"- linha {p.get('linha')} (regra {p.get('regra')}): {p.get('explicacao')}"
    lines = [f"# Revisão {cid}", "", f"revisor: alice-local {PROFILE_NAME} -", f"arquivo: {path} {sha}", "",
             "veredito: reprovado (pré-revisão local)", "", "## Problemas"]
    lines += [item(p) for p in keep]
    if dropped := [p for p in problems if p not in keep]:
        lines += ["", "## Descartadas (sem apoio no pronto; não vão para a Alice)"] + [item(p) for p in dropped]
    f = review_file(repo, cid)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text("\n".join(lines) + "\n")
    print(f"reprovação gravada em {f.relative_to(repo)}")


def pre_rejected(prompt: str, pre: bool) -> bool:
    problems = local_review(prompt) if pre else None
    LAST_LOCAL[:] = problems or []
    for p in problems or []:
        print(f"  - linha {p.get('linha')} (regra {p.get('regra')}): {p.get('explicacao')}")
    if problems:
        print("a Alice reprovou localmente: nenhuma requisição ao OpenRouter. Corrija ou rode com --no-pre se discordar.")
    return bool(problems)


class TestInput(NamedTuple):
    path: str
    src: str
    sha: str | None
    asked: list[tuple[int, str]]
    prompt: str


def test_input(repo: Path, card: dict) -> TestInput | None:
    """O pedido de revisão do teste (o mesmo para a Bia e para a Alice local); None se falta o arquivo ou há check vermelho."""
    path = str((card.get("allowedPaths") or [None])[0])
    if not (repo / path).is_file():
        print(f"bia: {path} não existe")
        return None
    checks = run_checks(repo, card)
    red = [(c, code, out) for c, code, out in checks if code != 0]
    if red:
        print("bia: checks do cartão vermelhos, revisão não pedida:\n" + "\n".join(f"$ {c}\nexit={code}\n{out[-1500:]}" for c, code, out in red))
        return None
    done = [str(d) for d in card.get("done") or []]
    asked = [(n, d) for n, d in enumerate(done, 1) if not mechanical(d)]
    src = (repo / path).read_text()
    numbered = "\n".join(f"{i + 1:3d}  {line}" for i, line in enumerate(src.splitlines()))
    prompt = (f"{TEST_RULES}\n\n# CONTRATO\n{contract(repo, card)}\n\n# CARTÃO {card['id']}: {card.get('title', '')}\n"
              f"PRONTO QUANDO:\n" + "\n".join(f"{n}. {d}" for n, d in asked) +
              "\n\nChecks mecânicos (já rodaram e passaram): " + "; ".join(c for c, _, _ in checks) +
              f"\n\n# TESTE {path} (com número de linha)\n{numbered}\n")
    return TestInput(path, src, blob_sha(repo, path, "worktree"), asked, prompt)


def write_review(repo: Path, card: dict, signer: str, ti: TestInput, items: dict[int, dict], problems: list[dict], ok: bool) -> Path:
    done = [str(d) for d in card.get("done") or []]
    lines = [f"# Revisão {card['id']}", "", f"revisor: {signer}", f"arquivo: {ti.path} {ti.sha}", ""]
    for n, d in enumerate(done, 1):
        it, mech = items.get(n, {}), mechanical(d)
        mark = "x" if ok and (mech or it.get("ok")) else " "
        lines.append(f"- [{mark}] {d} — {mech or str(it.get('onde') or 'sem resposta').strip()}")
    if problems:
        lines += ["", "## Problemas"] + [f"- linha {p.get('linha')} (regra {p.get('regra')}): {p.get('explicacao')}" for p in problems]
    f = review_file(repo, card["id"])
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text("\n".join(lines) + "\n")
    return f


def verdict_items(verdict: dict) -> dict[int, dict]:
    return {int(i.get("n", 0)): i for i in verdict.get("itens") or [] if str(i.get("n", "")).isdigit()}


def review_test(repo: Path, card: dict, model: str, name: str, pre: bool = True) -> int:
    writer = str(card.get("assignee") or "alice")
    if name.lower() == writer:
        print(f"bia: {name} escreveu o teste de {card['id']} e não o revisa; o portão é `bia.py gate`")
        return 3
    ti = test_input(repo, card)
    if ti is None:
        return 2
    path, sha, asked, src, prompt = ti.path, ti.sha, ti.asked, ti.src, ti.prompt
    if pre_rejected(prompt, pre):
        write_rejection(repo, card["id"], path, sha or "", LAST_LOCAL, card.get("done") or [], src)
        return 2
    try:
        data = chat([{"role": "user", "content": prompt}], model, api_key(repo))
        verdict = parse_json(data["choices"][0]["message"]["content"] or "")
    except QuotaError as e:
        print(f"bia: {e}")
        return 4
    except (RuntimeError, ValueError, KeyError) as e:
        print(f"bia: {e}")
        return 3
    rid = save_raw(data, {"card": card["id"], "task": "test", "path": path, "sha": sha, "reviewer": name, "model": model, "writer": writer})
    items = verdict_items(verdict)
    problems = verdict.get("problemas") or []
    missing = [n for n, _ in asked if not items.get(n, {}).get("ok")]
    ok = verdict.get("veredito") == "aprovado" and not problems and not missing
    f = write_review(repo, card, f"{name} {model} {rid}", ti, items, problems, ok)
    print(f"{'aprovado' if ok else 'reprovado'} por {name} ({model}): {f.relative_to(repo)}\n{usage(data)}")
    for p in problems:
        print(f"  - linha {p.get('linha')} (regra {p.get('regra')}): {p.get('explicacao')}")
    if missing:
        print(f"  - itens do pronto sem ok da Bia: {', '.join(map(str, missing))}")
    elif not ok and not problems:
        print(f"  - veredito '{verdict.get('veredito')}' sem problema listado")
    return 0 if ok else 2


def local_gate(repo: Path, card: dict, samples: int | None = None) -> int:
    """Portão final de teste escrito pela Bia (travas.md 4.9): a Alice local revisa com o mesmo pedido da Bia; aprova
    com 2 amostras aprovadas (todos os itens ok), reprova com problema na mesma linha em 2 amostras ou sem consenso.
    Os checks (expect-red, qualidade, tipos, lint) já passaram em test_input. 0 aprovado, 2 reprovado, 3 indisponível."""
    if str(card.get("assignee")) != "bia":
        print(f"gate: {card['id']} não foi escrito pela Bia; quem revisa é `bia.py test`")
        return 3
    ti = test_input(repo, card)
    if ti is None:
        return 2
    samples = samples or LOCAL_SAMPLES
    need = min(2, samples)
    verdicts: list[dict] = []
    approved: list[dict] = []
    votes: dict[str, int] = {}
    for _ in range(samples):
        v = local_verdict(ti.prompt)
        if v is None:
            return 3
        verdicts.append(v)
        approved = [x for x in verdicts if x.get("veredito") == "aprovado" and not x.get("problemas")
                    and all(verdict_items(x).get(n, {}).get("ok") for n, _ in ti.asked)]
        votes = {}
        for x in verdicts:
            for line in {str(p.get("linha")) for p in x.get("problemas") or []}:
                votes[line] = votes.get(line, 0) + 1
        if len(approved) >= need or any(c >= need for c in votes.values()):
            break
    model = load_profile(PROFILE_NAME).get("model", ALICE_MODEL)
    if len(approved) >= need:
        rid = save_raw({"id": f"local-{card['id']}-{time.strftime('%Y%m%d-%H%M%S')}", "samples": verdicts},
                       {"card": card["id"], "task": "test", "path": ti.path, "sha": ti.sha, "reviewer": "alice-local",
                        "model": model, "writer": "bia"})
        f = write_review(repo, card, f"alice-local {model} {rid}", ti, verdict_items(approved[0]), [], True)
        print(f"aprovado pela alice-local por consenso ({len(approved)}/{len(verdicts)}): {f.relative_to(repo)}")
        return 0
    agreed = [line for line, c in votes.items() if c >= need]
    first: dict[str, dict] = {}
    for x in verdicts:
        for p in x.get("problemas") or []:
            first.setdefault(str(p.get("linha")), p)
    problems = [first[line] for line in agreed] or list(first.values())
    write_rejection(repo, card["id"], ti.path, ti.sha or "", problems, card.get("done") or [], ti.src)
    print(f"reprovado pela alice-local ({'consenso' if agreed else 'sem consenso'}; {len(verdicts)} amostras)")
    return 2


CARD_RULES = """Você é a Bia, revisora independente. Abaixo está um cartão que pede a outro agente um ARQUIVO DE TESTE
(TDD, antes da implementação). Diga se o cartão permite escrever um teste possível e útil. Procure:
1) linhas do PRONTO QUANDO que se contradizem entre si ou contradizem o contrato;
2) valor literal sem fonte no contrato ou nas regras (NUNCA calcule o valor você mesma; só cobre a fonte);
3) linha que obriga o teste a refazer o algoritmo em vez de afirmar propriedade;
4) comportamento do contrato que nenhuma linha cobre (só os importantes);
5) linha vaga, que não dá para conferir lendo o teste.
Responda SÓ com JSON, em pt-BR:
{"veredito":"aprovado"|"reprovado","problemas":[{"linha":<n do pronto ou 0>,"regra":<1-5>,"explicacao":"..."}]}"""


def review_card(repo: Path, card: dict, model: str, name: str, pre: bool = True) -> int:
    done = [str(d) for d in card.get("done") or []]
    shown = {k: card.get(k) for k in ("id", "title", "rules", "refs", "allowedPaths", "checks", "hints")}
    prompt = (f"{CARD_RULES}\n\n# CONTRATO\n{contract(repo, card)}\n\n# CARTÃO\n{yaml.safe_dump(shown, allow_unicode=True, sort_keys=False)}"
              "PRONTO QUANDO:\n" + "\n".join(f"{i + 1}. {d}" for i, d in enumerate(done)))
    if pre_rejected(prompt, pre):
        return 2
    try:
        data = chat([{"role": "user", "content": prompt}], model, api_key(repo))
        verdict = parse_json(data["choices"][0]["message"]["content"] or "")
    except QuotaError as e:
        print(f"bia: {e}")
        return 4
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
        "\nChecks:\n" + "\n".join(f"{i}: {c}" for i, c in enumerate(card.get("checks") or [])) +
        "".join("\n# REVISÃO ANTERIOR (reprovada; o número da linha é do arquivo antigo)\n" + "\n".join(notes)
                for notes in [rejection_notes(repo, card["id"])] if notes))}]
    key, tokens = api_key(repo), [0, 0]
    for n in range(1, rounds + 1):
        try:
            data = chat(messages, model, key)
        except QuotaError as e:
            print(f"bia: {e}")
            return 4
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
        format_touched(repo, [path])  # LI-052: o pre-commit roda prettier; formatar é do harness
        red =[(c, code, out) for c, code, out in run_checks(repo, card) if code != 0]
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
    ap.add_argument("task", choices=["card", "test", "write", "gate"])
    ap.add_argument("plan", type=Path)
    ap.add_argument("id")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--as", dest="name", default="bia")
    ap.add_argument("--repo", type=Path, default=Path("."))
    ap.add_argument("--no-pre", dest="pre", action="store_false", help="pula a pré-revisão local da Alice")
    ns = ap.parse_args()
    if ns.name.lower() in SIGNERS_REFUSED:
        sys.exit(f"bia: {ns.name} não assina revisão: quem escreve cartão ou teste não aprova (erro 11)")
    repo = ns.repo.resolve()
    card = next((c for c in (yaml.safe_load(ns.plan.read_text()) or {}).get("cards", []) if c.get("id") == ns.id), None)
    if not card or card.get("kind") != "test-author":
        sys.exit(f"bia: {ns.id} não é cartão test-author em {ns.plan}")
    if ns.task == "card":
        code = review_card(repo, card, ns.model, ns.name, ns.pre)
    elif ns.task == "test":
        code = review_test(repo, card, ns.model, ns.name, ns.pre)
    elif ns.task == "gate":
        code = local_gate(repo, card)
    else:
        code = write_test(repo, card, ns.model)
    print(quota_line(api_key(repo)))
    return code


if __name__ == "__main__":
    sys.exit(main())
