#!/usr/bin/env python3
"""Runner do Jorge: único agente que altera o harness (tools/alice-harness). Modelo via Abacus RouteLLM.

Uso (pelo Claude ou pelo Joel, a cada Review do processo):
  jorge.py review --escopo <arquivo.md | "texto"> [--retro runs/retro-X.md ...] [--modelo M] [--travas-aprovadas]
  jorge.py responder <harness-vN> --resposta "<texto>"   # só quando o status foi `pergunta`

Contrato de saída (Joel, 16/11/2026): o Jorge NÃO reporta ao Claude. A saída padrão é UMA linha
`JORGE_STATUS=<status> versao=<harness-vN>` e o código de saída diz o mesmo:
  0 aplicada | 10 sem_mudancas | 20 nao_aplicada | 30 pergunta | 40 erro
Relatório, conversa, diff e custo ficam em tools/jorge/logs/<versão>/ (o relatório final também vai no commit).
Em `pergunta`, a única coisa que o Claude lê é tools/jorge/logs/<versão>/pergunta.md.

Fluxo: worktree isolado (branch jorge/<versão>) → suíte de referência → ANÁLISE (só leitura, submit_report)
→ APLICAÇÃO (escrita restrita, run_tests, finish) → suíte final + escopo do diff + travas → commit no worktree
→ merge --ff-only no checkout principal. Falha: reverte o código e commita só o relatório (não aplicado).
"""
from __future__ import annotations

import argparse
import fcntl
import fnmatch
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional

import yaml

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
LOGS = HERE / "logs"
WT_ROOT = REPO.parent / ".jorge-wt"
HARNESS = "tools/alice-harness"
RETRO = re.compile(r"^tools/alice-harness/runs/retro-[\w.-]+\.md$")
EXIT = {"aplicada": 0, "sem_mudancas": 10, "nao_aplicada": 20, "pergunta": 30, "erro": 40}

Json = dict[str, Any]


# ---------- utilidades ----------

def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def sh(args: list[str], cwd: Path, timeout: int = 120, env: Optional[dict[str, str]] = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, timeout=timeout, env=env)


def git(cwd: Path, *args: str) -> str:
    r = sh(["git", *args], cwd)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout.strip()


def load_cfg() -> Json:
    return yaml.safe_load((HERE / "config.yaml").read_text())


def api_key() -> str:
    env = REPO / HARNESS / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            k, _, v = line.partition("=")
            if k.strip() in ("ABACUSAI_API_KEY", "ABACUSAI_API_") and v.strip():
                return v.strip().strip("\"'")
    k = os.environ.get("ABACUSAI_API_KEY", "")
    if not k:
        raise RuntimeError("chave ABACUSAI_API_KEY ausente em tools/alice-harness/.env")
    return k


def matches(rel: str, patterns: list[str]) -> bool:
    for p in patterns:
        if fnmatch.fnmatch(rel, p):
            return True
        if p.startswith("**/") and fnmatch.fnmatch(rel, p[3:]):
            return True
        if p.endswith("/**") and rel == p[:-3]:
            return True
    return False


def normalize(rel: str) -> str:
    if not rel or os.path.isabs(rel):
        raise ValueError("caminho deve ser relativo à raiz do repositório")
    n = os.path.normpath(rel)
    if n == ".." or n.startswith("../"):
        raise ValueError("caminho fora do repositório")
    return "" if n == "." else n


# ---------- estado ----------

class State:
    def __init__(self, data: Json) -> None:
        self.d = data

    @property
    def version(self) -> str:
        return str(self.d["version"])

    @property
    def wt(self) -> Path:
        return Path(self.d["wt"])

    @property
    def logdir(self) -> Path:
        return LOGS / self.version

    def save(self) -> None:
        self.logdir.mkdir(parents=True, exist_ok=True)
        (self.logdir / "estado.json").write_text(json.dumps(self.d, ensure_ascii=False, indent=1))

    def log(self, text: str) -> None:
        self.logdir.mkdir(parents=True, exist_ok=True)
        with (self.logdir / "runner.log").open("a") as f:
            f.write(f"[{now()}] {text}\n")

    @classmethod
    def load(cls, version: str) -> "State":
        return cls(json.loads((LOGS / version / "estado.json").read_text()))


# ---------- política de caminhos ----------

class Paths:
    def __init__(self, cfg: Json, st: State) -> None:
        c = cfg["caminhos"]
        self.write: list[str] = c["escrita"]
        self.forbidden: list[str] = c["proibidos"]
        self.read_forbidden: list[str] = c["leitura_proibida"]
        self.locks: list[str] = c["travas"]
        self.lock_re = re.compile(c["trava_padrao_diff"])
        self.st = st

    def readable(self, rel: str) -> Path:
        n = normalize(rel)
        if RETRO.match(n):
            return self._inside(REPO, n)  # retros não são versionadas: vêm do checkout principal
        if n.startswith("tools/alice-harness/runs") or matches(n, self.read_forbidden):
            raise PermissionError(f"leitura proibida: {n}")
        return self._inside(self.st.wt, n)

    def writable(self, rel: str, old: str, new: str) -> Path:
        n = normalize(rel)
        if matches(n, self.forbidden) or not matches(n, self.write):
            raise PermissionError(f"escrita proibida: {n} (permitido: {', '.join(self.write)})")
        if not self.st.d["travas_aprovadas"] and self.is_lock(n, old, new):
            raise PermissionError(f"{n}: mudança de trava; travas aprovadas: não. Deixe adiada — aguardando Joel.")
        return self._inside(self.st.wt, n)

    def is_lock(self, rel: str, old: str, new: str) -> bool:
        if matches(rel, self.locks):
            return True
        a, b = set(old.splitlines()), set(new.splitlines())
        return any(self.lock_re.search(line) for line in a ^ b)

    @staticmethod
    def _inside(root: Path, rel: str) -> Path:
        full = (root / rel).resolve()
        if full != root.resolve() and root.resolve() not in full.parents:
            raise PermissionError("caminho escapa do repositório (symlink?)")
        return full


# ---------- suíte ----------

def run_suite(wt: Path, timeout: int) -> tuple[bool, int, str]:
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": os.environ.get("HOME", "/tmp"), "LANG": "C.UTF-8"}
    try:
        r = sh([sys.executable, "-m", "unittest", "discover", "-s", "tests"], wt / HARNESS, timeout, env)
    except subprocess.TimeoutExpired:
        return False, 0, f"suíte estourou {timeout}s"
    out = (r.stdout + r.stderr).strip()
    m = re.search(r"^Ran (\d+) tests?", out, re.M)
    ran = int(m.group(1)) if m else 0
    ok = r.returncode == 0 and ran > 0 and re.search(r"^OK\b", out, re.M) is not None
    return ok, ran, out


# ---------- ferramentas ----------

def tool_specs(phase: str) -> list[Json]:
    def f(name: str, desc: str, props: Json, req: list[str]) -> Json:
        return {"type": "function", "function": {"name": name, "description": desc,
                "parameters": {"type": "object", "properties": props, "required": req}}}
    s = {"type": "string"}
    i = {"type": "integer"}
    read = [
        f("list_files", "Lista um diretório (relativo à raiz do repo).", {"path": s}, ["path"]),
        f("read_file", "Lê linhas numeradas de um arquivo (paginação por start/end).", {"path": s, "start": i, "end": i}, ["path"]),
        f("search_code", "git grep -n -E no repositório.", {"pattern": s, "path": s}, ["pattern"]),
        f("run_tests", "Roda a suíte do harness (unittest) e devolve o resumo.", {}, []),
        f("perguntar_claude", "EXCEÇÃO: pergunta decisiva ao Claude que você não consegue resolver. Pausa a execução.", {"pergunta": s}, ["pergunta"]),
    ]
    if phase == "analise":
        return read + [f("submit_report", "Entrega o relatório de versão (markdown, no modelo) e encerra a ANÁLISE.", {"markdown": s}, ["markdown"])]
    return read + [
        f("write_file", "Grava o arquivo inteiro (só caminhos permitidos).", {"path": s, "content": s}, ["path", "content"]),
        f("edit_file", "Troca um trecho exato e único (old) por new.", {"path": s, "old": s, "new": s}, ["path", "old", "new"]),
        f("finish", "Encerra a APLICAÇÃO com o resumo pedido no prompt.", {"summary": s}, ["summary"]),
    ]


class Tools:
    def __init__(self, cfg: Json, st: State) -> None:
        self.cfg = cfg
        self.lim: Json = cfg["limites"]
        self.st = st
        self.paths = Paths(cfg, st)
        self.ended: Optional[str] = None
        self.question: Optional[str] = None

    def call(self, name: str, args: Json) -> str:
        fn: Optional[Callable[[Json], str]] = getattr(self, "t_" + name, None)
        allowed = {t["function"]["name"] for t in tool_specs(self.st.d["phase"])}
        if fn is None or name not in allowed:
            return f"ERRO: ferramenta {name} indisponível na fase {self.st.d['phase']}"
        try:
            return fn(args)
        except (PermissionError, ValueError, FileNotFoundError, IsADirectoryError, KeyError) as e:
            return f"ERRO: {e}"

    def t_list_files(self, a: Json) -> str:
        p = self.paths.readable(a.get("path", "."))
        out = []
        for e in sorted(p.iterdir()):
            rel = os.path.relpath(e, self.st.wt if not RETRO.match(str(e)) else REPO)
            if matches(rel, self.paths.read_forbidden) or e.name == "__pycache__":
                continue
            out.append(e.name + ("/" if e.is_dir() else ""))
        return "\n".join(out[:300]) or "(vazio)"

    def t_read_file(self, a: Json) -> str:
        lines = self.paths.readable(a["path"]).read_text(errors="replace").splitlines()
        start = max(1, int(a.get("start") or 1))
        end = min(len(lines), int(a.get("end") or len(lines)), start + int(self.lim["linhas_por_leitura"]) - 1)
        body = "\n".join(f"{n}\t{lines[n - 1]}" for n in range(start, end + 1))
        more = f"\n[... {len(lines) - end} linhas a mais; peça start={end + 1}]" if end < len(lines) else ""
        return f"{a['path']} ({len(lines)} linhas)\n{body}{more}"

    def t_search_code(self, a: Json) -> str:
        path = normalize(a.get("path") or ".") or "."
        r = sh(["git", "grep", "-n", "-I", "-E", "-e", a["pattern"], "--", path], self.st.wt)
        keep = [ln for ln in r.stdout.splitlines() if not matches(ln.split(":", 1)[0], self.paths.read_forbidden)]
        cap = int(self.lim["linhas_busca"])
        return "\n".join(keep[:cap]) + (f"\n[... {len(keep) - cap} resultados a mais]" if len(keep) > cap else "") or "(nada)"

    def t_run_tests(self, a: Json) -> str:
        ok, ran, out = run_suite(self.st.wt, int(self.lim["timeout_testes_s"]))
        self.st.d["suites"].append({"fase": self.st.d["phase"], "ok": ok, "ran": ran, "em": now()})
        tail = "\n".join(out.splitlines()[-int(self.lim["linhas_saida_testes"]):])
        return f"{'VERDE' if ok else 'VERMELHO'} — {ran} testes (referência: {self.st.d['baseline_ran']})\n{tail}"

    def t_write_file(self, a: Json) -> str:
        rel = a["path"]
        current = self.st.wt / normalize(rel)
        old = current.read_text() if current.is_file() else ""
        p = self.paths.writable(rel, old, a["content"])
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(a["content"])
        return f"gravado {rel} ({len(a['content'].splitlines())} linhas)"

    def t_edit_file(self, a: Json) -> str:
        p0 = self.paths.readable(a["path"])
        text = p0.read_text()
        n = text.count(a["old"])
        if n != 1:
            return f"ERRO: trecho old aparece {n} vezes em {a['path']}; precisa ser exato e único"
        new = text.replace(a["old"], a["new"])
        self.paths.writable(a["path"], text, new).write_text(new)
        return f"editado {a['path']}"

    def t_submit_report(self, a: Json) -> str:
        self.st.d["report"] = a["markdown"]
        (self.st.logdir / "relatorio-proposta.md").write_text(a["markdown"])
        self.ended = "analise"
        return "relatório recebido; aguarde o runner"

    def t_finish(self, a: Json) -> str:
        self.st.d["finish"] = a["summary"]
        self.ended = "aplicacao"
        return "recebido; o runner fará a verificação final"

    def t_perguntar_claude(self, a: Json) -> str:
        self.question = a["pergunta"]
        return ""


# ---------- modelo ----------

def chat(cfg: Json, st: State, tools: list[Json]) -> Json:
    api = cfg["api"]
    body = json.dumps({"model": st.d["model"], "messages": st.d["messages"], "tools": tools, "tool_choice": "auto"}).encode()
    req = urllib.request.Request(api["base_url"].rstrip("/") + "/chat/completions", data=body, method="POST",
                                 headers={"Authorization": f"Bearer {api_key()}", "Content-Type": "application/json"})
    last = ""
    for attempt in range(int(api["retries"]) + 1):
        try:
            with urllib.request.urlopen(req, timeout=int(api["timeout_s"])) as r:
                data: Json = json.loads(r.read())
            add_usage(st, data)
            return data
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read()[:300]!r}"
            if e.code < 500 and e.code != 429:
                break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last = str(e)
        st.d["usage"]["erros"] += 1
        st.log(f"falha na API ({last}); nova tentativa")
        time.sleep(5 * 2 ** attempt)
    raise RuntimeError(f"API indisponível: {last}")


def add_usage(st: State, data: Json) -> None:
    u: Json = data.get("usage") or {}
    acc: Json = st.d["usage"]
    acc["requisicoes"] += 1
    acc["modelos"] = sorted(set(acc["modelos"]) | {str(data.get("model") or st.d["model"])})
    if not u:
        acc["sem_usage"] += 1
        return
    acc["entrada"] += int(u.get("prompt_tokens") or 0)
    acc["saida"] += int(u.get("completion_tokens") or 0)
    acc["raciocinio"] += int((u.get("completion_tokens_details") or {}).get("reasoning_tokens") or 0)
    acc["cache_lido"] += int((u.get("prompt_tokens_details") or {}).get("cached_tokens") or 0)
    acc["creditos"] = round(acc["creditos"] + float(u.get("credits_used") or 0), 2)


# ---------- laço de uma fase ----------

def run_phase(cfg: Json, st: State) -> str:
    """Devolve 'fim' (fase encerrada pela ferramenta), 'pergunta' ou 'limite'."""
    phase = st.d["phase"]
    tools = Tools(cfg, st)
    lim = cfg["limites"]
    budget = int(lim["passos_analise" if phase == "analise" else "passos_aplicacao"])
    end_tool = "submit_report" if phase == "analise" else "finish"
    while st.d["steps"][phase] < budget + 2:
        forced = st.d["steps"][phase] >= budget
        specs = [t for t in tool_specs(phase) if t["function"]["name"] == end_tool] if forced else tool_specs(phase)
        if forced and not st.d.get("forcado_" + phase):
            st.d["forcado_" + phase] = True
            st.d["messages"].append({"role": "user", "content": f"Limite de passos da fase atingido. Chame {end_tool} agora com o que tiver (marque o que não terminou)."})
        msg: Json = chat(cfg, st, specs)["choices"][0]["message"]
        st.d["steps"][phase] += 1
        st.d["messages"].append({k: v for k, v in msg.items() if k in ("role", "content", "tool_calls") and v is not None})
        calls: list[Json] = msg.get("tool_calls") or []
        if not calls:
            st.d["messages"].append({"role": "user", "content": f"Use as ferramentas. A fase só termina com {end_tool}."})
            st.save()
            continue
        for c in calls:
            name = c["function"]["name"]
            try:
                args: Json = json.loads(c["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            sig = name + json.dumps(args, sort_keys=True)
            st.d["repeat"] = st.d["repeat"] + 1 if sig == st.d.get("last_sig") else 1
            st.d["last_sig"] = sig
            if st.d["repeat"] >= int(lim["repeticao_aborta"]):
                raise RuntimeError(f"laço: {name} repetida {st.d['repeat']} vezes")
            result = tools.call(name, args)
            if tools.question is not None and name == "perguntar_claude":
                st.d["pending_question"] = {"id": c["id"], "texto": tools.question}
                tools.question = None
                continue
            if st.d["repeat"] >= int(lim["repeticao_aviso"]):
                result += "\nAVISO: chamada idêntica repetida; mude de abordagem."
            st.d["messages"].append({"role": "tool", "tool_call_id": c["id"], "content": result})
        st.save()
        if st.d.get("pending_question"):
            return "pergunta"
        if tools.ended == phase:
            return "fim"
    return "limite"


# ---------- início, final e integração ----------

def next_version() -> str:
    nums = [int(m.group(1)) for p in LOGS.glob("harness-v*") if (m := re.match(r"harness-v(\d+)$", p.name))]
    return f"harness-v{max(nums, default=0) + 1}"


def module_map(wt: Path) -> str:
    files = git(wt, "ls-files", HARNESS, "docs/agents", ".agents").splitlines()
    rows = []
    for f in files:
        if "/runs/" in f or f.endswith((".pyc", ".gitkeep")):
            continue
        try:
            n = len((wt / f).read_text(errors="replace").splitlines())
        except (IsADirectoryError, FileNotFoundError):
            continue
        rows.append(f"{f} ({n})")
    return "\n".join(rows)


def start(args: argparse.Namespace, cfg: Json) -> State:
    if git(REPO, "status", "--porcelain", "--", HARNESS, "docs/agents", ".agents", "tools/jorge"):
        raise RuntimeError("há alteração não commitada no harness/docs/agents/tools/jorge do checkout principal")
    pend = [p.parent.name for p in LOGS.glob("harness-v*/estado.json") if json.loads(p.read_text()).get("status") == "pergunta"]
    if pend:
        raise RuntimeError(f"revisão pendente de resposta: {pend[0]}")
    version = next_version()
    escopo = Path(args.escopo).read_text() if Path(args.escopo).is_file() else args.escopo
    base = git(REPO, "rev-parse", "HEAD")
    wt = WT_ROOT / version
    branch = f"jorge/{version}"
    WT_ROOT.mkdir(exist_ok=True)
    git(REPO, "worktree", "add", "-b", branch, str(wt), base)
    if (REPO / "node_modules").exists():
        (wt / "node_modules").symlink_to(REPO / "node_modules")  # hooks de commit (lefthook/commitlint)
    st = State({
        "version": version, "status": "rodando", "phase": "analise", "base": base, "branch": branch, "wt": str(wt),
        "base_branch": git(REPO, "rev-parse", "--abbrev-ref", "HEAD"),
        "model": args.modelo or cfg["api"]["model"], "travas_aprovadas": bool(args.travas_aprovadas),
        "inicio": now(), "steps": {"analise": 0, "aplicacao": 0}, "suites": [], "repeat": 0,
        "usage": {"requisicoes": 0, "erros": 0, "sem_usage": 0, "entrada": 0, "saida": 0, "raciocinio": 0,
                  "cache_lido": 0, "creditos": 0.0, "modelos": []},
        "messages": [],
    })
    (st.logdir).mkdir(parents=True, exist_ok=True)
    (st.logdir / "escopo.md").write_text(escopo)
    ok, ran, out = run_suite(wt, int(cfg["limites"]["timeout_testes_s"]))
    st.d["baseline_ok"], st.d["baseline_ran"] = ok, ran
    (st.logdir / "suite-referencia.txt").write_text(out)
    if not ok:
        st.save()
        raise RuntimeError(f"suíte de referência vermelha ({ran} testes): aplicação automática bloqueada")
    lim = cfg["limites"]
    retros = "\n".join(f"- {r}" for r in args.retro) or "- (nenhuma indicada; liste tools/alice-harness/runs/ não é permitido, peça só retro-*)"
    system = (HERE / "jorge.md").read_text() + "\n\n---\n# Modelo do relatório\n" + (HERE / "relatorio-modelo.md").read_text()
    st.d["messages"] = [
        {"role": "system", "content": system},
        {"role": "user", "content": (
            f"# Review — {version}\n"
            f"- Data: {st.d['inicio']}\n- Base git: {base} (branch {st.d['base_branch']}); worktree isolado em branch {branch}\n"
            f"- Modelo: {st.d['model']}\n- Travas aprovadas: {'sim' if st.d['travas_aprovadas'] else 'não'}\n"
            f"- Suíte de referência: VERDE, {ran} testes (`python3 -m unittest discover -s tests` em {HARNESS})\n"
            f"- Limites: {lim['passos_analise']} passos na análise, {lim['passos_aplicacao']} na aplicação; "
            f"read_file até {lim['linhas_por_leitura']} linhas por chamada.\n"
            f"- Saída: você não fala com o Claude; ele só vê o status. Tudo que importa vai no relatório. "
            f"`perguntar_claude` é exceção para decisão que você não consegue tomar.\n\n"
            f"## Escopo recebido\n{escopo}\n\n## Retros indicadas\n{retros}\n\n"
            f"## Mapa (arquivo e nº de linhas)\n{module_map(wt)}\n\n"
            f"FASE: ANÁLISE (só leitura). Termine com submit_report."
        )},
    ]
    st.save()
    st.log(f"início {version} base={base} modelo={st.d['model']} travas={st.d['travas_aprovadas']}")
    return st


def changed_paths(wt: Path) -> list[str]:
    out = git(wt, "status", "--porcelain", "--untracked-files=all")
    paths = []
    for line in out.splitlines():
        p = line[3:].split(" -> ")[-1].strip('"')
        if p != "node_modules":
            paths.append(p)
    return paths


def cost_table(st: State) -> str:
    u = st.d["usage"]
    return (
        "\n## Custo da execução do Jorge (runner)\n\n| Medida | Valor |\n|---|---:|\n"
        f"| Modelo(s) | {', '.join(u['modelos'])} |\n| Requisições | {u['requisicoes']} (falhas re-tentadas: {u['erros']}, sem usage: {u['sem_usage']}) |\n"
        f"| Tokens de entrada | {u['entrada']} |\n| Entrada em cache | {u['cache_lido']} |\n| Tokens de saída | {u['saida']} |\n"
        f"| Raciocínio (já na saída) | {u['raciocinio']} |\n| Créditos Abacus | {u['creditos']} |\n"
        f"| Passos análise / aplicação | {st.d['steps']['analise']} / {st.d['steps']['aplicacao']} |\n"
        f"| Suítes rodadas | {len(st.d['suites'])} |\n| Início / fim | {st.d['inicio']} / {now()} |\n"
    )


def finalize(cfg: Json, st: State) -> str:
    wt = st.wt
    paths = Paths(cfg, st)
    changed = changed_paths(wt)
    problems: list[str] = []
    for p in changed:
        if matches(p, paths.forbidden) or not matches(p, paths.write):
            problems.append(f"arquivo fora da área permitida: {p}")
    diff = git(wt, "diff", "HEAD") if changed else ""
    if not st.d["travas_aprovadas"]:
        if any(matches(p, paths.locks) for p in changed):
            problems.append("trava alterada sem aprovação")
        if any(paths.lock_re.search(l) for l in diff.splitlines() if l[:1] in "+-" and l[:3] not in ("+++", "---")):
            problems.append("linha de orçamento/estado alterada sem aprovação")
    ok, ran, out = run_suite(wt, int(cfg["limites"]["timeout_testes_s"]))
    (st.logdir / "suite-final.txt").write_text(out)
    if not ok:
        problems.append(f"suíte final vermelha ({ran} testes)")
    if ran < int(st.d["baseline_ran"]):
        problems.append(f"descoberta caiu: {ran} < {st.d['baseline_ran']} testes")
    if changed:
        (st.logdir / "diff.patch").write_text(diff + "".join(
            f"\n# novo arquivo: {p}\n" for p in changed if p not in diff))
    status = "sem_mudancas" if not changed else ("nao_aplicada" if problems else "aplicada")
    if status == "nao_aplicada":
        git(wt, "checkout", "--", ".")
        git(wt, "clean", "-fdq", "--", HARNESS, "docs/agents", ".agents")
    report = (st.d.get("report") or "# (o Jorge não entregou relatório)\n")
    report += (
        f"\n\n---\n## Verificação do runner\n- Status: **{status}**\n- Base: `{st.d['base']}`\n"
        f"- Suíte final: {'VERDE' if ok else 'VERMELHA'}, {ran} testes (referência {st.d['baseline_ran']})\n"
        f"- Arquivos alterados: {', '.join(changed) or 'nenhum'}\n"
        f"- Problemas: {'; '.join(problems) or 'nenhum'}\n"
        f"- Travas aprovadas: {'sim' if st.d['travas_aprovadas'] else 'não'}\n"
        f"\n## Resumo do finish\n{st.d.get('finish') or '(sem finish)'}\n" + cost_table(st)
    )
    rel = f"tools/jorge/logs/{st.version}/relatorio.md"
    (wt / rel).parent.mkdir(parents=True, exist_ok=True)
    (wt / rel).write_text(report)
    to_add = ([p for p in changed] if status == "aplicada" else []) + [rel]
    git(wt, "add", "--", *to_add)
    msg = (f"feat(alice-harness): {st.version} by jorge" if status == "aplicada"
           else f"docs(jorge): {st.version} report ({status})")
    r = sh(["git", "commit", "-q", "-m", msg, "-m", f"Report: {rel}\nJorge-Model: {st.d['model']}"], wt, 300)
    if r.returncode != 0:
        (st.logdir / "commit-erro.txt").write_text(r.stdout + r.stderr)
        raise RuntimeError("commit recusado pelos hooks (ver commit-erro.txt)")
    st.d["commit"] = git(wt, "rev-parse", "HEAD")
    if git(REPO, "rev-parse", "--abbrev-ref", "HEAD") != st.d["base_branch"]:
        raise RuntimeError(f"checkout principal saiu da branch {st.d['base_branch']}; branch {st.d['branch']} ficou para merge")
    r = sh(["git", "merge", "--ff-only", "-q", st.d["branch"]], REPO)
    if r.returncode != 0:
        (st.logdir / "merge-erro.txt").write_text(r.stdout + r.stderr)
        raise RuntimeError(f"merge --ff-only falhou; branch {st.d['branch']} preservada")
    sh(["git", "worktree", "remove", "--force", str(wt)], REPO)
    sh(["git", "branch", "-q", "-d", st.d["branch"]], REPO)
    return status


def drive(cfg: Json, st: State) -> str:
    if st.d["phase"] == "analise":
        r = run_phase(cfg, st)
        if r == "pergunta":
            return "pergunta"
        if r == "limite":
            raise RuntimeError("análise acabou sem submit_report")
        st.d["phase"] = "aplicacao"
        st.d["messages"].append({"role": "user", "content": (
            f"FASE: APLICAÇÃO liberada pelo runner. Travas aprovadas: {'sim' if st.d['travas_aprovadas'] else 'não'}. "
            "Aplique as evoluções do seu relatório, uma por vez, com teste e run_tests após cada uma. Termine com finish.")})
        st.save()
    if st.d["phase"] == "aplicacao":
        r = run_phase(cfg, st)
        if r == "pergunta":
            return "pergunta"
        st.d["phase"] = "final"
        st.save()
    return finalize(cfg, st)


def emit(st: Optional[State], status: str) -> int:
    if st is not None:
        st.d["status"] = status
        st.d["fim"] = now()
        st.save()
        st.log(f"status {status}")
    extra = f" arquivo=tools/jorge/logs/{st.version}/pergunta.md" if st and status == "pergunta" else ""
    print(f"JORGE_STATUS={status} versao={st.version if st else '-'}{extra}")
    return EXIT[status]


def main() -> int:
    ap = argparse.ArgumentParser(prog="jorge.py")
    sub = ap.add_subparsers(dest="cmd", required=True)
    rv = sub.add_parser("review")
    rv.add_argument("--escopo", required=True)
    rv.add_argument("--retro", action="append", default=[])
    rv.add_argument("--modelo")
    rv.add_argument("--travas-aprovadas", action="store_true", help="só o Joel autoriza")
    rs = sub.add_parser("responder")
    rs.add_argument("versao")
    rs.add_argument("--resposta", required=True)
    args = ap.parse_args()
    cfg = load_cfg()
    LOGS.mkdir(exist_ok=True)
    lock = (LOGS / ".lock").open("w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("JORGE_STATUS=erro versao=- motivo=outra_execucao")
        return EXIT["erro"]
    st: Optional[State] = None
    try:
        if args.cmd == "review":
            st = start(args, cfg)
        else:
            st = State.load(args.versao)
            q = st.d.pop("pending_question", None)
            if st.d.get("status") != "pergunta" or not q:
                raise RuntimeError("não há pergunta pendente nesta versão")
            st.d["messages"].append({"role": "tool", "tool_call_id": q["id"], "content": f"Resposta do Claude: {args.resposta}"})
            (st.logdir / "pergunta.md").unlink(missing_ok=True)
            with (st.logdir / "perguntas.md").open("a") as f:
                f.write(f"## {now()}\n**Jorge:** {q['texto']}\n\n**Claude:** {args.resposta}\n\n")
            st.d["status"] = "rodando"
        status = drive(cfg, st)
        if status == "pergunta":
            (st.logdir / "pergunta.md").write_text(st.d["pending_question"]["texto"] + "\n")
        return emit(st, status)
    except Exception as e:  # noqa: BLE001 — qualquer falha vira status erro + log, nunca relato ao Claude
        if st is not None:
            st.log(f"ERRO: {type(e).__name__}: {e}")
            (st.logdir / "erro.txt").write_text(f"{type(e).__name__}: {e}\n")
        else:
            LOGS.joinpath("erro-inicio.txt").write_text(f"{now()} {type(e).__name__}: {e}\n")
        return emit(st, "erro")


if __name__ == "__main__":
    sys.exit(main())
