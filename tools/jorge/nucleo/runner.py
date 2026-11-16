#!/usr/bin/env python3
"""Núcleo do Jorge: runner fixo (só o Joel altera tools/jorge/nucleo/**). O Jorge é o único agente que altera o
harness; o comportamento dele (prompt, modelo do relatório, limites dentro do teto) mora em tools/jorge/agente/**,
que ele mesmo pode evoluir.

Uso:
  jorge.py review --escopo <arquivo.md | "texto"> [--retro tools/alice-harness/runs/retro-X.md ...] [--modelo M]
  jorge.py auto              # gatilho (timer): feature concluída não revista, ou caixa com itens e >= N h do último Review
  jorge.py anotar "<texto>"  # caixa de entrada para o próximo Review (Claude ou Joel)

Contrato de saída (Joel, 16/11/2026): o Jorge NÃO reporta ao Claude. A saída padrão é UMA linha
`JORGE_STATUS=<status> versao=<harness-vN|-> [motivo=...] [push=...]` e o código de saída diz o mesmo:
  0 aplicada | 10 sem_mudancas | 11 nada_a_fazer | 20 nao_aplicada | 40 erro
Relatório, conversa, diff e custo ficam em tools/jorge/logs/<versão>/; o relatório final vai no commit e no push.

Invariantes mecânicas (não dependem de aprovação): estado.json, .env real, .claude, núcleo, apps e packages nunca
mudam; orçamento/cota da Bia nunca sobe fora de tests/. Travas (guard_hook, política, linhas de orçamento) são
aplicadas, mas em commit separado com trailer `Trava: sim`, para auditoria do Joel.
Perguntas do Jorge vão para o Joel no relatório e não bloqueiam: o item fica adiado e o resto segue.
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
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Optional

import yaml

HERE = Path(__file__).resolve().parent          # tools/jorge/nucleo
JORGE = HERE.parent                             # tools/jorge
REPO = JORGE.parents[1]
LOGS = JORGE / "logs"
AGENTE = JORGE / "agente"
CAIXA = LOGS / "caixa.md"
VISTAS = LOGS / "features-vistas.json"
WT_ROOT = REPO.parent / ".jorge-wt"
HARNESS = "tools/alice-harness"
RUNS = HARNESS + "/runs"
EXIT = {"aplicada": 0, "sem_mudancas": 10, "nada_a_fazer": 11, "nao_aplicada": 20, "erro": 40}

Json = dict[str, Any]


class Skip(Exception):
    """Nada a fazer agora (motivo vai na linha de status)."""


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


def merge_cfg(nucleo: Json, agente: Json) -> Json:
    """Junta núcleo (fixo) e agente (editável pelo Jorge). O agente só escolhe dentro do que o núcleo permite."""
    cfg: Json = {k: v for k, v in nucleo.items() if k not in ("limites_maximos", "modelos_permitidos", "agente_padrao")}
    padrao: Json = nucleo["agente_padrao"]
    a_api: Json = agente.get("api") if isinstance(agente.get("api"), dict) else {}
    a_lim: Json = agente.get("limites") if isinstance(agente.get("limites"), dict) else {}
    model = str(a_api.get("model") or padrao["model"])
    if model not in nucleo["modelos_permitidos"]:
        model = padrao["model"]
    cfg["api"] = dict(nucleo["api"], model=model)
    lim: Json = {}
    for k, teto in nucleo["limites_maximos"].items():
        try:
            v = int(a_lim.get(k, padrao["limites"][k]))
        except (TypeError, ValueError):
            v = int(padrao["limites"][k])
        lim[k] = max(1, min(v, int(teto)))
    cfg["limites"] = lim
    cfg["modelos_ok"] = list(nucleo["modelos_permitidos"])
    return cfg


def load_cfg(agente_dir: Path = AGENTE) -> Json:
    nucleo: Json = yaml.safe_load((HERE / "nucleo.yaml").read_text())
    try:
        agente = yaml.safe_load((agente_dir / "config.yaml").read_text()) or {}
        if not isinstance(agente, dict):
            agente = {}
    except (OSError, yaml.YAMLError):
        agente = {}  # config do agente quebrada: o núcleo segue com o padrão
    return merge_cfg(nucleo, agente)


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


def is_test_path(rel: str) -> bool:
    return "/tests/" in "/" + rel or os.path.basename(rel).startswith("test_")


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


# ---------- política de caminhos e invariantes ----------

class Paths:
    def __init__(self, cfg: Json, wt: Path) -> None:
        c = cfg["caminhos"]
        self.write: list[str] = c["escrita"]
        self.forbidden: list[str] = c["proibidos"]
        self.read_forbidden: list[str] = c["leitura_proibida"]
        self.secrets: list[str] = c["segredos"]
        self.secret_ok: list[str] = c["segredos_excecao"]
        self.locks: list[str] = c["travas"]
        o = cfg["orcamento"]
        self.budget_re = re.compile(o["padrao"])
        self.budget_cap = int(o["teto_novo"])
        self.wt = wt

    def secret(self, n: str) -> bool:
        return matches(n, self.secrets) and not matches(n, self.secret_ok)

    def readable(self, rel: str) -> Path:
        n = normalize(rel)
        if self.secret(n) or matches(n, self.read_forbidden):
            raise PermissionError(f"leitura proibida: {n}")
        if n == RUNS or n.startswith(RUNS + "/"):
            return self._inside(REPO, n)  # runs/ não é versionado: lido do checkout principal
        return self._inside(self.wt, n)

    def write_problem(self, n: str, old: str, new: str) -> Optional[str]:
        if self.secret(n) or matches(n, self.forbidden) or not matches(n, self.write):
            return f"escrita proibida: {n} (permitido: {', '.join(self.write)}; nunca segredos, núcleo, estado, apps, packages)"
        v = self.budget_raises(n, old, new)
        return f"{n}: orçamento/cota não pode subir ({'; '.join(v)})" if v else None

    def writable(self, rel: str, old: str, new: str) -> Path:
        n = normalize(rel)
        prob = self.write_problem(n, old, new)
        if prob:
            raise PermissionError(prob)
        return self._inside(self.wt, n)

    def budget_raises(self, rel: str, old: str, new: str) -> list[str]:
        """Invariante: fora de tests/, nenhum valor de orçamento/cota sobe. Valor novo sem antigo: no máximo teto_novo."""
        if is_test_path(rel):
            return []
        a, b = set(old.splitlines()), set(new.splitlines())

        def values(lines: set[str]) -> dict[str, int]:
            out: dict[str, int] = {}
            for line in lines:
                for m in self.budget_re.finditer(line):
                    k = re.sub(r"[_\W]", "", m.group(1).lower())
                    out[k] = max(out.get(k, 0), int(m.group(2)))
            return out

        removed, added = values(a - b), values(b - a)
        return [f"{k}: {removed.get(k, '-')} → {v}" for k, v in added.items() if v > removed.get(k, self.budget_cap)]

    def is_lock(self, rel: str, old: str, new: str) -> bool:
        if matches(rel, self.locks):
            return True
        if is_test_path(rel):
            return False
        a, b = set(old.splitlines()), set(new.splitlines())
        return any(self.budget_re.search(line) for line in a ^ b)

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


def suite_fails(out: str) -> int:
    """Falhas + erros da linha 'FAILED (...)' do unittest (0 se não houver)."""
    m = re.search(r"^FAILED \(([^)]*)\)", out, re.M)
    return sum(int(x) for x in re.findall(r"(?:failures|errors)=(\d+)", m.group(1))) if m else 0


# ---------- ferramentas ----------

def tool_specs(phase: str) -> list[Json]:
    def f(name: str, desc: str, props: Json, req: list[str]) -> Json:
        return {"type": "function", "function": {"name": name, "description": desc,
                "parameters": {"type": "object", "properties": props, "required": req}}}
    s = {"type": "string"}
    i = {"type": "integer"}
    read = [
        f("list_files", "Lista um diretório (relativo à raiz do repo). tools/alice-harness/runs/ vem do checkout principal.", {"path": s}, ["path"]),
        f("read_file", "Lê linhas numeradas de um arquivo (paginação por start/end).", {"path": s, "start": i, "end": i}, ["path"]),
        f("search_code", "git grep -n -E nos arquivos versionados.", {"pattern": s, "path": s}, ["pattern"]),
        f("metricas", "Métricas reais do harness: tipo 'evolution' (antes/depois por versão do harness) ou 'metrics' (resumo de runs/metrics.jsonl).", {"tipo": s}, ["tipo"]),
        f("run_tests", "Roda a suíte do harness (unittest) e devolve o resumo.", {}, []),
        f("perguntar_joel", "Registra uma pergunta para o Joel no relatório. NÃO bloqueia: o item ligado fica 'adiada — aguardando Joel' e você segue com o resto.", {"pergunta": s, "item": s}, ["pergunta"]),
    ]
    if phase == "analise":
        return read + [f("submit_report", "Entrega o relatório de versão (markdown, no modelo) e encerra a ANÁLISE.", {"markdown": s}, ["markdown"])]
    return read + [
        f("write_file", "Grava o arquivo inteiro (só caminhos permitidos).", {"path": s, "content": s}, ["path", "content"]),
        f("edit_file", "Troca um trecho exato e único (old) por new.", {"path": s, "old": s, "new": s}, ["path", "old", "new"]),
        f("delete_file", "Apaga um arquivo (só caminhos permitidos).", {"path": s}, ["path"]),
        f("finish", "Encerra a APLICAÇÃO com o resumo pedido no prompt.", {"summary": s}, ["summary"]),
    ]


class Tools:
    def __init__(self, cfg: Json, st: State) -> None:
        self.cfg = cfg
        self.lim: Json = cfg["limites"]
        self.st = st
        self.paths = Paths(cfg, st.wt)
        self.ended: Optional[str] = None

    def call(self, name: str, args: Json) -> str:
        fn: Optional[Callable[[Json], str]] = getattr(self, "t_" + name, None)
        allowed = {t["function"]["name"] for t in tool_specs(self.st.d["phase"])}
        if fn is None or name not in allowed:
            return f"ERRO: ferramenta {name} indisponível na fase {self.st.d['phase']}"
        try:
            return fn(args)
        except (PermissionError, ValueError, FileNotFoundError, IsADirectoryError, NotADirectoryError, KeyError, UnicodeDecodeError) as e:
            return f"ERRO: {e}"

    def t_list_files(self, a: Json) -> str:
        n = normalize(a.get("path") or ".")
        p = self.paths.readable(n or ".")
        out = []
        for e in sorted(p.iterdir()):
            rel = f"{n}/{e.name}" if n else e.name
            if self.paths.secret(rel) or matches(rel, self.paths.read_forbidden) or e.name == "__pycache__":
                continue
            out.append(e.name + ("/" if e.is_dir() else ""))
        cap = 300
        return "\n".join(out[-cap:]) + (f"\n[{len(out) - cap} entradas mais antigas omitidas]" if len(out) > cap else "") or "(vazio)"

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
        keep = [ln for ln in r.stdout.splitlines()
                if not (self.paths.secret(ln.split(":", 1)[0]) or matches(ln.split(":", 1)[0], self.paths.read_forbidden))]
        cap = int(self.lim["linhas_busca"])
        return "\n".join(keep[:cap]) + (f"\n[... {len(keep) - cap} resultados a mais]" if len(keep) > cap else "") or "(nada)"

    def t_metricas(self, a: Json) -> str:
        tipo = a.get("tipo")
        if tipo not in ("evolution", "metrics"):
            return "ERRO: tipo deve ser 'evolution' ou 'metrics'"
        r = sh([sys.executable, "alice.py", tipo], REPO / HARNESS, 120)
        out = (r.stdout + r.stderr).strip().splitlines()
        cap = int(self.lim["linhas_busca"])
        return "\n".join(out[-cap:]) or "(sem saída)"

    def t_run_tests(self, a: Json) -> str:
        ok, ran, out = run_suite(self.st.wt, int(self.lim["timeout_testes_s"]))
        self.st.d["suites"].append({"fase": self.st.d["phase"], "ok": ok, "ran": ran, "em": now()})
        tail = "\n".join(out.splitlines()[-int(self.lim["linhas_saida_testes"]):])
        return f"{'VERDE' if ok else 'VERMELHO'} — {ran} testes (referência: {self.st.d['baseline_ran']})\n{tail}"

    def _old(self, n: str) -> str:
        p = self.st.wt / n
        return p.read_text() if p.is_file() else ""

    def t_write_file(self, a: Json) -> str:
        n = normalize(a["path"])
        p = self.paths.writable(n, self._old(n), a["content"])
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(a["content"])
        return f"gravado {n} ({len(a['content'].splitlines())} linhas)"

    def t_edit_file(self, a: Json) -> str:
        n = normalize(a["path"])
        text = self._old(n)
        k = text.count(a["old"]) if a["old"] else 0
        if k != 1:
            return f"ERRO: trecho old aparece {k} vezes em {n}; precisa ser exato e único"
        new = text.replace(a["old"], a["new"])
        self.paths.writable(n, text, new).write_text(new)
        return f"editado {n}"

    def t_delete_file(self, a: Json) -> str:
        n = normalize(a["path"])
        p = self.paths.writable(n, self._old(n), "")
        p.unlink()
        return f"apagado {n}"

    def t_perguntar_joel(self, a: Json) -> str:
        self.st.d["perguntas_joel"].append({"item": a.get("item") or "", "pergunta": a["pergunta"], "fase": self.st.d["phase"], "em": now()})
        return "Registrada no relatório para o Joel. Trate o item como 'adiada — aguardando Joel' e siga com o resto."

    def t_submit_report(self, a: Json) -> str:
        self.st.d["report"] = a["markdown"]
        (self.st.logdir / "relatorio-proposta.md").write_text(a["markdown"])
        self.ended = "analise"
        return "relatório recebido; aguarde o runner"

    def t_finish(self, a: Json) -> str:
        self.st.d["finish"] = a["summary"]
        self.ended = "aplicacao"
        return "recebido; o runner fará a verificação final"


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
    """Devolve 'fim' (fase encerrada pela ferramenta) ou 'limite'."""
    phase = st.d["phase"]
    tools = Tools(cfg, st)
    lim = cfg["limites"]
    teto = float(cfg["custo"]["teto_creditos_review"])
    budget = int(lim["passos_analise" if phase == "analise" else "passos_aplicacao"])
    if phase == "aplicacao":
        budget += int(st.d.get("extra_passos", 0))
        if st.d.get("reparo_ativo"):  # reparo pode ir até perto do teto de aborto
            teto = teto * float(cfg["custo"]["fator_aborto"]) * 0.9
    end_tool = "submit_report" if phase == "analise" else "finish"
    while st.d["steps"][phase] < budget + 2:
        spent = float(st.d["usage"]["creditos"])
        if spent > teto * float(cfg["custo"]["fator_aborto"]):
            raise RuntimeError(f"teto de créditos estourado: {spent} > {teto}")
        forced = st.d["steps"][phase] >= budget or spent >= teto
        specs = [t for t in tool_specs(phase) if t["function"]["name"] == end_tool] if forced else tool_specs(phase)
        if forced and not st.d.get("forcado_" + phase):
            st.d["forcado_" + phase] = True
            st.d["messages"].append({"role": "user", "content": f"Limite de passos ou de créditos atingido. Chame {end_tool} agora com o que tiver (marque o que não terminou)."})
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
            if st.d["repeat"] >= int(lim["repeticao_aviso"]):
                result += "\nAVISO: chamada idêntica repetida; mude de abordagem."
            st.d["messages"].append({"role": "tool", "tool_call_id": c["id"], "content": result})
        st.save()
        if tools.ended == phase:
            return "fim"
    return "limite"


# ---------- gatilho, caixa e features ----------

def done_features(root: Path = REPO) -> list[str]:
    """Features com todas as etapas `done` em docs/plano/*/estado.json (só leitura)."""
    out = []
    for p in sorted(root.glob("docs/plano/*/estado.json")):
        try:
            d = json.loads(p.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        stages = d.get("stages")
        if isinstance(stages, dict) and stages and all(isinstance(s, dict) and s.get("status") == "done" for s in stages.values()):
            out.append(str(d.get("feature") or p.parent.name))
    return out


def seen_features() -> list[str]:
    try:
        return list(json.loads(VISTAS.read_text()))
    except (OSError, json.JSONDecodeError):
        return []


def last_review_start() -> Optional[datetime]:
    times = []
    for p in LOGS.glob("harness-v*/estado.json"):
        try:
            times.append(datetime.fromisoformat(json.loads(p.read_text())["inicio"]))
        except (OSError, json.JSONDecodeError, KeyError, ValueError):
            continue
    return max(times, default=None)


def reviews_today() -> int:
    today = datetime.now().astimezone().date().isoformat()
    n = 0
    for p in LOGS.glob("harness-v*/estado.json"):
        try:
            n += str(json.loads(p.read_text()).get("inicio", "")).startswith(today)
        except (OSError, json.JSONDecodeError):
            continue
    return n


def alice_busy() -> bool:
    try:
        return sh([sys.executable, "alice.py", "status"], REPO / HARNESS, 30).returncode == 1
    except subprocess.TimeoutExpired:
        return True


def recent_retros(since: Optional[datetime]) -> list[str]:
    out = []
    for p in sorted((REPO / RUNS).glob("retro-*.md")):
        if since is None or datetime.fromtimestamp(p.stat().st_mtime).astimezone() > since:
            out.append(f"{RUNS}/{p.name}")
    return out[-10:]


def auto_scope(cfg: Json) -> tuple[str, list[str]]:
    a = cfg["auto"]
    new = [f for f in done_features() if f not in seen_features()]
    caixa = CAIXA.read_text().strip() if CAIXA.exists() else ""
    last = last_review_start()
    due = bool(caixa) and (last is None or datetime.now().astimezone() - last >= timedelta(hours=float(a["horas_minimas_caixa"])))
    retros = recent_retros(last)
    if not new and not due and not retros:
        raise Skip("nada_novo")
    motivo = ("fim de feature: " + ", ".join(new)) if new else ("retrospectiva nova" if retros else "caixa de entrada")
    escopo = (
        f"Review automático ({motivo}).\n\n"
        + (f"## Features concluídas desde o último Review\n" + "\n".join(f"- {f}: docs/plano/{f}/" for f in new) + "\n\n" if new else "")
        + "## Onde olhar\n- Retros recentes e logs em tools/alice-harness/runs/ (leitura liberada; .env nunca).\n"
          "- Ferramenta `metricas` (evolution/metrics) para medir antes/depois.\n"
          "- Itens 'adiada' dos relatórios anteriores em tools/jorge/logs/harness-v*/relatorio.md.\n"
        + "\n(A caixa de entrada, se houver, vem anexada abaixo pelo runner.)\n"
    )
    return escopo, retros


def anotar(text: str) -> None:
    LOGS.mkdir(exist_ok=True)
    with CAIXA.open("a") as f:
        f.write(f"- [{now()}] {text.strip()}\n")


# ---------- início, final e integração ----------

def next_version() -> str:
    nums = [int(m.group(1)) for p in LOGS.glob("harness-v*") if (m := re.match(r"harness-v(\d+)$", p.name))]
    return f"harness-v{max(nums, default=0) + 1}"


def module_map(wt: Path) -> str:
    files = git(wt, "ls-files", HARNESS, "docs/agents", ".agents", "tools/jorge/agente").splitlines()
    rows = []
    for f in files:
        if "/runs/" in f or f.endswith((".pyc", ".gitkeep")):
            continue
        try:
            n = len((wt / f).read_text(errors="replace").splitlines())
        except (IsADirectoryError, FileNotFoundError, UnicodeDecodeError):
            continue
        rows.append(f"{f} ({n})")
    return "\n".join(rows)


def start(cfg: Json, escopo: str, retros: list[str], modelo: Optional[str]) -> State:
    if git(REPO, "status", "--porcelain", "--", HARNESS, "docs/agents", ".agents", "tools/jorge/agente", "tools/jorge/nucleo"):
        raise Skip("checkout_sujo")
    version = next_version()
    base = git(REPO, "rev-parse", "HEAD")
    wt = WT_ROOT / version
    branch = f"jorge/{version}"
    WT_ROOT.mkdir(exist_ok=True)
    git(REPO, "worktree", "add", "-b", branch, str(wt), base)
    if (REPO / "node_modules").exists():
        (wt / "node_modules").symlink_to(REPO / "node_modules")  # hooks de commit (lefthook/commitlint)
    if modelo and modelo not in cfg["modelos_ok"]:
        modelo = None
    st = State({
        "version": version, "status": "rodando", "phase": "analise", "base": base, "branch": branch, "wt": str(wt),
        "base_branch": git(REPO, "rev-parse", "--abbrev-ref", "HEAD"),
        "model": modelo or cfg["api"]["model"], "inicio": now(), "steps": {"analise": 0, "aplicacao": 0},
        "suites": [], "repeat": 0, "perguntas_joel": [],
        "usage": {"requisicoes": 0, "erros": 0, "sem_usage": 0, "entrada": 0, "saida": 0, "raciocinio": 0,
                  "cache_lido": 0, "creditos": 0.0, "modelos": []},
        "messages": [],
    })
    st.logdir.mkdir(parents=True, exist_ok=True)
    caixa = CAIXA.read_text().strip() if CAIXA.exists() else ""
    if caixa:
        escopo += f"\n\n## Caixa de entrada (anotações do Claude/Joel desde o último Review)\n{caixa}\n"
        (st.logdir / "caixa.md").write_text(caixa + "\n")
        CAIXA.unlink()
    VISTAS.write_text(json.dumps(sorted(set(seen_features()) | set(done_features())), ensure_ascii=False))
    (st.logdir / "escopo.md").write_text(escopo)
    st.save()
    ok, ran, out = run_suite(wt, int(cfg["limites"]["timeout_testes_s"]))
    st.d["baseline_ok"], st.d["baseline_ran"], st.d["baseline_fails"] = ok, ran, (0 if ok else suite_fails(out))
    (st.logdir / "suite-referencia.txt").write_text(out)
    ref = (f"VERDE, {ran} testes" if ok else
           f"VERMELHA, {ran} testes, {st.d['baseline_fails']} falhas/erros — consertar isso é prioridade deste Review")
    lim = cfg["limites"]
    retro_txt = "\n".join(f"- {r}" for r in retros) or "- (nenhuma indicada; liste tools/alice-harness/runs/ se precisar)"
    system = (agent_file(wt, "jorge.md") + "\n\n---\n# Modelo do relatório\n" + agent_file(wt, "relatorio-modelo.md")
              + "\n\n---\n# Regras fixas do núcleo (não editáveis por você)\n" + (HERE / "regras.md").read_text())
    st.d["messages"] = [
        {"role": "system", "content": system},
        {"role": "user", "content": (
            f"# Review — {version}\n"
            f"- Data: {st.d['inicio']}\n- Base git: {base} (branch {st.d['base_branch']}); worktree isolado em branch {branch}\n"
            f"- Modelo: {st.d['model']}\n"
            f"- Suíte de referência: {ref} (`python3 -m unittest discover -s tests` em {HARNESS})\n"
            f"- Limites: {lim['passos_analise']} passos na análise, {lim['passos_aplicacao']} na aplicação; "
            f"read_file até {lim['linhas_por_leitura']} linhas; teto de {cfg['custo']['teto_creditos_review']} créditos neste Review.\n\n"
            f"## Escopo recebido\n{escopo}\n\n## Retros indicadas\n{retro_txt}\n\n"
            f"## Mapa (arquivo e nº de linhas)\n{module_map(wt)}\n\n"
            f"FASE: ANÁLISE (só leitura). Termine com submit_report."
        )},
    ]
    st.save()
    st.log(f"início {version} base={base} modelo={st.d['model']}")
    return st


def agent_file(wt: Path, name: str) -> str:
    """Prompt e modelo do relatório vêm do worktree (versão do agente na base); se sumirem, o núcleo tem cópia mínima."""
    p = wt / "tools/jorge/agente" / name
    text = p.read_text() if p.is_file() else ""
    return text if len(text) >= 200 else (HERE / "padrao" / name).read_text()


def changed_paths(wt: Path) -> list[str]:
    out = git(wt, "status", "--porcelain", "--untracked-files=all")
    paths = []
    for line in out.splitlines():
        p = line[3:].split(" -> ")[-1].strip('"')
        if p != "node_modules":
            paths.append(p)
    return paths


def content_at(wt: Path, rev: str, rel: str) -> str:
    r = sh(["git", "show", f"{rev}:{rel}"], wt)
    return r.stdout if r.returncode == 0 else ""


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


def commit(wt: Path, st: State, files: list[str], msg: str, trailers: str) -> None:
    git(wt, "add", "-A", "--", *files)
    r = sh(["git", "commit", "-q", "-m", msg, "-m", trailers], wt, 300)
    if r.returncode != 0:
        (st.logdir / "commit-erro.txt").write_text(r.stdout + r.stderr)
        raise RuntimeError("commit recusado pelos hooks (ver commit-erro.txt)")


def verify(cfg: Json, st: State) -> Json:
    """Checagem final: invariantes por arquivo, arquivos do agente e suíte. Aceita suíte ainda vermelha se a
    referência já era vermelha e o Jorge reduziu as falhas sem perder testes."""
    wt = st.wt
    paths = Paths(cfg, wt)
    changed = changed_paths(wt)
    problems: list[str] = []
    codes: list[str] = []
    bad: list[str] = []
    locks: list[str] = []
    for p in changed:
        old, new = content_at(wt, "HEAD", p), ((wt / p).read_text(errors="replace") if (wt / p).is_file() else "")
        prob = paths.write_problem(p, old, new)
        if prob:
            problems.append(prob)
            codes.append("invariante")
            bad.append(p)
        elif paths.is_lock(p, old, new):
            locks.append(p)
    for name in ("jorge.md", "relatorio-modelo.md"):
        f = wt / "tools/jorge/agente" / name
        if not f.is_file() or len(f.read_text(errors="replace")) < 200:
            problems.append(f"tools/jorge/agente/{name} sumiu ou ficou vazio")
            codes.append("agente_vazio")
            bad.append(f"tools/jorge/agente/{name}")
    ok, ran, out = run_suite(wt, int(cfg["limites"]["timeout_testes_s"]))
    (st.logdir / "suite-final.txt").write_text(out)
    fails = 0 if ok else suite_fails(out)
    base_ran, base_fails = int(st.d["baseline_ran"]), int(st.d.get("baseline_fails", 0))
    melhorou = not st.d.get("baseline_ok", True) and ran >= base_ran and 0 < fails < base_fails
    if not ok and not melhorou:
        problems.append(f"suíte final vermelha ({ran} testes, {fails} falhas/erros; referência {base_ran} testes, {base_fails} falhas)")
        codes.append("suite_vermelha")
    if ran < base_ran:
        problems.append(f"descoberta caiu: {ran} < {base_ran} testes")
        codes.append("descoberta_caiu")
    tail = "\n".join(out.splitlines()[-int(cfg["limites"]["linhas_saida_testes"]):])
    return {"changed": changed, "problems": problems, "codes": codes, "bad": bad, "locks": locks,
            "ok": ok or melhorou, "ran": ran, "fails": fails, "tail": tail}


def revert_files(wt: Path, files: list[str]) -> None:
    for p in files:
        if content_at(wt, "HEAD", p) or sh(["git", "cat-file", "-e", f"HEAD:{p}"], wt).returncode == 0:
            git(wt, "checkout", "HEAD", "--", p)
        elif (wt / p).is_file():
            (wt / p).unlink()


def finalize(cfg: Json, st: State) -> str:
    wt = st.wt
    v = verify(cfg, st)
    revertidos: list[str] = []
    if v["changed"] and v["problems"] and v["bad"]:
        revert_files(wt, v["bad"])  # tira só o que violou invariante e verifica o resto de novo
        revertidos = list(v["bad"])
        v = verify(cfg, st)
    changed, problems, locks, ok, ran = v["changed"], v["problems"], v["locks"], v["ok"], v["ran"]
    if problems:
        st.d["motivo"] = ",".join(dict.fromkeys(v["codes"]))
    if changed:
        sh(["git", "add", "-A", "-N", "--", *changed], wt)
        (st.logdir / "diff.patch").write_text(git(wt, "diff", "HEAD"))
        git(wt, "reset", "-q")
    status = "sem_mudancas" if not changed else ("nao_aplicada" if problems else "aplicada")
    if status == "nao_aplicada":
        git(wt, "checkout", "--", ".")
        git(wt, "clean", "-fdq", "--", HARNESS, "docs/agents", ".agents", "tools/jorge/agente")
        locks = []
    perguntas = st.d["perguntas_joel"]
    report = (st.d.get("report") or "# (o Jorge não entregou relatório)\n")
    report += (
        f"\n\n---\n## Verificação do runner\n- Status: **{status}**\n- Base: `{st.d['base']}`\n"
        f"- Suíte final: {'VERDE' if ok else 'VERMELHA'}, {ran} testes (referência {st.d['baseline_ran']})\n"
        f"- Arquivos alterados: {', '.join(changed) or 'nenhum'}\n"
        f"- Rodadas de reparo usadas: {st.d.get('reparos', 0)}\n"
        f"- Revertidos só estes (invariante): {', '.join(revertidos) or 'nenhum'}\n"
        f"- Travas (commit separado `Trava: sim`, auditoria do Joel): {', '.join(locks) or 'nenhuma'}\n"
        f"- Problemas: {'; '.join(problems) or 'nenhum'}\n"
        + ("\n## Perguntas ao Joel (não bloquearam o Review)\n" + "".join(
            f"- {('**' + q['item'] + '**: ') if q['item'] else ''}{q['pergunta']}\n" for q in perguntas) if perguntas else "")
        + f"\n## Resumo do finish\n{st.d.get('finish') or '(sem finish)'}\n" + cost_table(st)
    )
    rel = f"tools/jorge/logs/{st.version}/relatorio.md"
    (wt / rel).parent.mkdir(parents=True, exist_ok=True)
    (wt / rel).write_text(report)
    trailers = f"Report: {rel}\nJorge-Model: {st.d['model']}"
    if status == "aplicada":
        normal = [p for p in changed if p not in locks]
        if normal:
            commit(wt, st, normal + ([] if locks else [rel]), f"feat(alice-harness): {st.version} by jorge", trailers)
        if locks:
            commit(wt, st, locks + [rel], f"feat(alice-harness): {st.version} locks by jorge",
                   trailers + "\nTrava: sim\nTrava-Arquivos: " + ", ".join(locks))
    else:
        commit(wt, st, [rel], f"docs(jorge): {st.version} report ({status})", trailers)
    st.d["commit"] = git(wt, "rev-parse", "HEAD")
    integrate(cfg, st)
    return status


def integrate(cfg: Json, st: State) -> None:
    """Rebase se o principal andou, merge --ff-only, limpeza e push (só se não houver commit alheio sem push)."""
    wt, b = st.wt, st.d["base_branch"]
    if git(REPO, "rev-parse", "--abbrev-ref", "HEAD") != b:
        raise RuntimeError(f"checkout principal saiu da branch {b}; branch {st.d['branch']} ficou para merge")
    head = git(REPO, "rev-parse", "HEAD")
    if head != st.d["base"]:
        r = sh(["git", "rebase", "-q", head], wt, 300)
        if r.returncode != 0:
            sh(["git", "rebase", "--abort"], wt)
            raise RuntimeError(f"rebase sobre {head} falhou; branch {st.d['branch']} preservada")
        ok, ran, _ = run_suite(wt, int(cfg["limites"]["timeout_testes_s"]))
        if not ok:
            raise RuntimeError(f"suíte vermelha após rebase ({ran}); branch {st.d['branch']} preservada")
        st.log(f"rebase sobre {head}")
    r = sh(["git", "merge", "--ff-only", "-q", st.d["branch"]], REPO)
    if r.returncode != 0:
        (st.logdir / "merge-erro.txt").write_text(r.stdout + r.stderr)
        raise RuntimeError(f"merge --ff-only falhou; branch {st.d['branch']} preservada")
    sh(["git", "worktree", "remove", "--force", str(wt)], REPO)
    sh(["git", "branch", "-q", "-D", st.d["branch"]], REPO)
    st.d["push"] = push(cfg, st, head)


def push(cfg: Json, st: State, before: str) -> str:
    if not cfg["git"]["push"]:
        return "desligado"
    b = st.d["base_branch"]
    sh(["git", "fetch", "-q", "origin", b], REPO, 120)
    if sh(["git", "rev-parse", "--verify", "-q", f"origin/{b}"], REPO).returncode != 0:
        return "adiado_sem_remoto"
    if git(REPO, "rev-list", "--count", f"origin/{b}..{before}") != "0":
        return "adiado_commits_alheios"  # não empurra trabalho de outro agente junto
    r = sh(["git", "push", "-q", "origin", b], REPO, int(cfg["git"]["timeout_push_s"]))
    if r.returncode != 0:
        (st.logdir / "push-erro.txt").write_text(r.stdout + r.stderr)
        return "falhou"
    return "ok"


def drive(cfg: Json, st: State) -> str:
    if run_phase(cfg, st) == "limite":
        raise RuntimeError("análise acabou sem submit_report")
    st.d["phase"] = "aplicacao"
    st.d["messages"].append({"role": "user", "content": (
        "FASE: APLICAÇÃO liberada pelo runner. Aplique as evoluções do seu relatório, uma por vez, com teste e "
        "run_tests após cada uma. Travas podem ser aplicadas (vão para commit separado, auditadas pelo Joel); "
        "invariantes são bloqueio mecânico. Termine com finish.")})
    st.save()
    run_phase(cfg, st)
    rep: Json = cfg.get("reparo") or {}
    n = int(rep.get("rodadas", 0))
    for i in range(n):  # o mecânico vê o que a verificação reprovou e conserta antes de qualquer reversão
        v = verify(cfg, st)
        if not v["changed"] or not v["problems"]:
            break
        st.d["reparos"] = i + 1
        st.d["reparo_ativo"] = True
        st.d["extra_passos"] = int(st.d.get("extra_passos", 0)) + int(rep.get("passos", 20))
        st.d.pop("forcado_aplicacao", None)
        st.d["messages"].append({"role": "user", "content": (
            f"VERIFICAÇÃO FINAL DO RUNNER REPROVOU — rodada de reparo {i + 1}/{n}. Nada foi revertido ainda.\n"
            "Problemas:\n" + "".join(f"- {p}\n" for p in v["problems"])
            + f"\nFim da saída da suíte:\n{v['tail']}\n\n"
            "Conserte a causa (ou desfaça só a mudança culpada, mantendo as outras), rode run_tests e chame finish. "
            "Registre no relatório o que reprovou e o que você fez.")})
        st.save()
        run_phase(cfg, st)
    st.d["phase"] = "final"
    st.save()
    return finalize(cfg, st)


def emit(st: Optional[State], status: str, motivo: str = "") -> int:
    if st is not None:
        st.d["status"] = status
        st.d["fim"] = now()
        st.save()
        st.log(f"status {status} {motivo}".strip())
    extra = (f" motivo={motivo}" if motivo else "") + (f" push={st.d['push']}" if st and st.d.get("push") else "")
    print(f"JORGE_STATUS={status} versao={st.version if st else '-'}{extra}")
    return EXIT[status]


def main() -> int:
    ap = argparse.ArgumentParser(prog="jorge.py")
    sub = ap.add_subparsers(dest="cmd", required=True)
    rv = sub.add_parser("review")
    rv.add_argument("--escopo", required=True)
    rv.add_argument("--retro", action="append", default=[])
    rv.add_argument("--modelo")
    sub.add_parser("auto")
    an = sub.add_parser("anotar")
    an.add_argument("texto")
    args = ap.parse_args()
    LOGS.mkdir(exist_ok=True)
    if args.cmd == "anotar":
        anotar(args.texto)
        print("JORGE_CAIXA=ok")
        return 0
    lock = (LOGS / ".lock").open("w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return emit(None, "nada_a_fazer", "outra_execucao")
    st: Optional[State] = None
    try:
        cfg = load_cfg()
        if args.cmd == "auto":
            escopo, retros = auto_scope(cfg)
            if reviews_today() >= int(cfg["custo"]["max_reviews_dia"]):
                raise Skip("limite_diario")
            if alice_busy():
                raise Skip("alice_ocupada")
            st = start(cfg, escopo, retros, None)
        else:
            escopo = Path(args.escopo).read_text() if Path(args.escopo).is_file() else args.escopo
            st = start(cfg, escopo, args.retro, args.modelo)
        status = drive(cfg, st)
        return emit(st, status, st.d.get("motivo", "") if status == "nao_aplicada" else "")
    except Skip as e:
        return emit(None, "nada_a_fazer", str(e))
    except Exception as e:  # noqa: BLE001 — qualquer falha vira status erro + log, nunca relato ao Claude
        if st is not None:
            st.log(f"ERRO: {type(e).__name__}: {e}")
            (st.logdir / "erro.txt").write_text(f"{type(e).__name__}: {e}\n")
        else:
            LOGS.joinpath("erro-inicio.txt").write_text(f"{now()} {type(e).__name__}: {e}\n")
        return emit(st, "erro")
