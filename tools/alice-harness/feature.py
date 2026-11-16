"""Orquestrador por feature (ADR-0014; docs/agents/orquestracao.md): Claude planeja e revisa, Bia testa e audita,
Alice implementa. Reaproveita o que já existe: `plan_run` (Alice, local), `bia.chat` (cota e reserva),
`run_checks`, `restore_allowed`, `format_touched` e a revisão assinada de `review.py`. Nunca commita.

    alice.py feature <plano.yaml> <F> [--stage plan|tests|implement|audit|review|all] [--rounds N]

Estado em docs/plano/<F>/estado.json; artefatos em docs/plano/<F>/ (testes.md, auditoria.md, revisao-final.md).
"""
from __future__ import annotations

import json
import os
import shutil
from contextlib import contextmanager
import subprocess
import time
from pathlib import Path
from typing import Callable, NamedTuple

import yaml

import gates
from cards import feature_plan_path, feature_problems, plan_scenarios

HERE = Path(__file__).resolve().parent
ROLES = HERE / "roles"
STAGES = ("plan", "tests", "implement", "audit", "review")
Checks = list[tuple[str, int, str]]


def role_section(name: str, section: str) -> str:
    """Seção '## <section>' de roles/<name>.md (instrução fixa do papel)."""
    text = (ROLES / f"{name}.md").read_text()
    return text.split(f"## {section}\n", 1)[1].split("\n## ", 1)[0].strip()


# ---------------------------------------------------------------- esquemas das mensagens (validados aqui)
def file_problems(obj: object, key: str, paths: set[str], every: bool) -> list[str]:
    files = obj.get(key) if isinstance(obj, dict) else None
    if not isinstance(files, list):
        return [f"'{key}' precisa ser uma lista de {{path, content}}"]
    out, seen = [], set()
    for f in files:
        if not isinstance(f, dict) or not isinstance(f.get("path"), str) or not isinstance(f.get("content"), str):
            out.append(f"item de '{key}' sem path e content em texto")
            continue
        if f["path"] not in paths:
            out.append(f"{f['path']} fora dos arquivos de teste da feature ({', '.join(sorted(paths))})")
        elif not f["content"].strip():
            out.append(f"{f['path']} vazio")
        seen.add(f["path"])
    if every and (missing := paths - seen):
        out.append(f"faltam arquivos: {', '.join(sorted(missing))}")
    return out


def tests_schema_problems(obj: object, paths: set[str], scenarios: list[str]) -> list[str]:
    out = file_problems(obj, "files", paths, every=True)
    sc = obj.get("scenarios") if isinstance(obj, dict) else None
    if not isinstance(sc, list) or not all(isinstance(s, dict) for s in sc):
        return out + ["'scenarios' precisa ser uma lista de {id, descricao, card, teste}"]
    got = {str(s.get("id")) for s in sc if str(s.get("teste") or "").strip()}
    if missing := [c for c in scenarios if c not in got]:
        out.append(f"cenários do plano sem teste: {', '.join(missing)}")
    return out


def audit_schema_problems(obj: object, paths: set[str], asked: dict[str, list[int]]) -> list[str]:
    if not isinstance(obj, dict):
        return ["a resposta precisa ser um objeto JSON"]
    out = []
    if obj.get("verdict") not in ("aprovado", "complementar"):
        out.append("verdict precisa ser 'aprovado' ou 'complementar'")
    if not isinstance(obj.get("gaps", []), list):
        out.append("'gaps' precisa ser lista")
    out += file_problems({"extraTests": obj.get("extraTests", [])}, "extraTests", paths, every=False)
    items = obj.get("itens")
    if not isinstance(items, dict):
        return out + ["'itens' precisa ser um objeto {<ID>: [{n, ok, onde}]}"]
    for cid, ns in asked.items():
        rows = items.get(cid)
        if not isinstance(rows, list):
            out.append(f"itens sem o cartão {cid}")
            continue
        got = {int(r["n"]) for r in rows if isinstance(r, dict) and str(r.get("n", "")).isdigit()}
        if missing := [n for n in ns if n not in got]:
            out.append(f"{cid}: itens sem as linhas {', '.join(map(str, missing))} do pronto")
    if obj.get("verdict") == "aprovado" and (obj.get("gaps") or obj.get("extraTests")):
        out.append("'aprovado' só sem gaps e sem extraTests")
    return out


# ---------------------------------------------------------------- operações (os testes trocam por dublês)
class FeatureOps:
    def __init__(self, repo: Path) -> None:
        import bia  # tardio: bia importa alice
        self.bia, self.repo = bia, repo

    def bia_chat(self, messages: list[dict]) -> dict:
        return self.bia.chat(messages, self.bia.DEFAULT_MODEL, self.bia.api_key(self.repo))

    def model(self) -> str:
        return str(self.bia.DEFAULT_MODEL)

    def quota_left(self) -> int | None:
        try:
            q = self.bia.quota(self.bia.api_key(self.repo))
        except SystemExit:
            return None
        return int(q["remaining"]) if q and "remaining" in q else None

    def reserve(self) -> int:
        return int(self.bia.RESERVE)

    def usage(self) -> dict[str, int]:
        return dict(self.bia.USAGE)

    def run_checks(self, card: dict) -> Checks:
        return self.bia.run_checks(self.repo, card)

    def format(self, files: list[str]) -> None:
        from alice import format_touched
        format_touched(self.repo, files)

    def restore(self, card: dict, keep: Path) -> None:
        from alice import restore_allowed
        restore_allowed(self.repo, card, keep)

    def plan_run(self, cards: dict[str, dict], ids: list[str], rounds: int) -> list[dict]:
        from alice import PlanOps, plan_run
        return plan_run(cards, ids, self.repo, rounds, PlanOps())

    def save_raw(self, data: dict, extra: dict) -> str:
        return str(self.bia.save_raw(data, extra))

    def write_review(self, card: dict, signer: str, path: str, sha: str, items: dict[int, dict], problems: list[dict], ok: bool) -> Path:
        done = [str(d) for d in card.get("done") or []]
        asked = [(n, d) for n, d in enumerate(done, 1) if not self.bia.mechanical(d)]
        ti = self.bia.TestInput(path, "", sha, asked, "")
        return Path(self.bia.write_review(self.repo, card, signer, ti, items, problems, ok))

    def mechanical(self, line: str) -> str:
        return str(self.bia.mechanical(line))


class Feature(NamedTuple):
    fid: str
    title: str
    budget: int
    tests: list[dict]
    impls: list[dict]


def load_feature(plan: dict, fid: str) -> Feature:
    feat = next((f for f in plan.get("features") or [] if f.get("id") == fid), None)
    if feat is None:
        raise SystemExit(f"feature {fid} não está no plano")
    cards = {c["id"]: c for c in plan.get("cards") or []}
    members = [cards[c] for c in feat.get("cards") or [] if c in cards]
    return Feature(fid, str(feat.get("title", "")), int(feat.get("biaBudget", 0)),
                   [c for c in members if c.get("kind") == "test-author"], [c for c in members if c.get("kind") == "implement"])


def blob_sha(repo: Path, path: str) -> str:
    """O mesmo sha que review.py confere (blob do worktree)."""
    from review import blob_sha as sha
    return str(sha(repo, path, "worktree") or "")


def red_text(red: Checks, width: int = 2000) -> str:
    text = "\n".join(f"$ {c}\nexit={code}\n{out[-width:]}" for c, code, out in red)
    return gates.redact(text)[0]


def numbered(src: str) -> str:
    return "\n".join(f"{i + 1:3d}  {line}" for i, line in enumerate(src.splitlines()))


class Orchestrator:
    def __init__(self, repo: Path, plan: dict, fid: str, ops: FeatureOps, runs: Path) -> None:
        self.repo, self.plan, self.ops, self.runs = repo, plan, ops, runs
        self.f = load_feature(plan, fid)
        self.dir = repo / "docs" / "plano" / fid
        self.state_file = self.dir / "estado.json"
        self.state: dict = json.loads(self.state_file.read_text()) if self.state_file.is_file() else \
            {"feature": fid, "stages": {}, "biaRequests": 0, "testShas": {}, "expectRed": False}
        self.log_dir = runs / "feature" / fid / time.strftime("%Y%m%d-%H%M%S")

    # --- estado e orçamento
    def save(self) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(self.state, ensure_ascii=False, indent=1) + "\n")

    def stage(self, name: str) -> dict:
        return self.state["stages"].setdefault(name, {"status": "pending"})

    def finish(self, name: str, status: str, t0: float, **extra: object) -> str:
        st = self.stage(name)
        for key in ("message", "red"):
            st.pop(key, None)
        st.update({"status": status, "seconds": st.get("seconds", 0) + round(time.time() - t0), **extra})
        self.save()
        return status

    def test_paths(self) -> set[str]:
        return {str(p) for c in self.f.tests for p in c.get("allowedPaths") or []}

    def can_call(self) -> str:
        """'' se pode gastar uma requisição; senão o motivo (orçamento da feature ou cota na reserva)."""
        if self.state["biaRequests"] >= self.f.budget:
            return f"orçamento da feature esgotado ({self.state['biaRequests']}/{self.f.budget} requisições)"
        left = self.ops.quota_left()
        if left is not None and left <= self.ops.reserve():
            return f"cota da Bia na reserva ({left} restantes, BIA_RESERVE={self.ops.reserve()})"
        return ""

    def ask(self, stage: str, messages: list[dict], check: Callable[[object], list[str]]) -> tuple[dict | None, str, dict]:
        """Uma chamada da Bia no esquema da etapa; fora do esquema, 1 nova tentativa; depois error com motivo.
        Devolve (objeto, motivo do erro ou da cota, resposta bruta)."""
        data: dict = {}
        for attempt in (1, 2):
            if why := self.can_call():
                return None, f"quota: {why}", data
            before = self.ops.usage()
            self.state["biaRequests"] += 1  # reserva por chat; ledger por tentativa ainda depende de autoridade externa
            st = self.stage(stage)
            st["biaRequests"] = st.get("biaRequests", 0) + 1
            try:
                data = self.ops.bia_chat(messages)
                content = str(data["choices"][0]["message"]["content"] or "")
            except (RuntimeError, KeyError, IndexError) as e:
                kind = "quota" if type(e).__name__ == "QuotaError" else "error"
                return None, f"{kind}: {type(e).__name__}: {gates.redact(str(e))[0][:200]}", data
            finally:
                after = self.ops.usage()
                st["biaIn"] = st.get("biaIn", 0) + after.get("biaIn", 0) - before.get("biaIn", 0)
                st["biaOut"] = st.get("biaOut", 0) + after.get("biaOut", 0) - before.get("biaOut", 0)
                self.save()
            try:
                import bia
                obj: object = bia.parse_json(content)
                problems = check(obj)
            except ValueError as e:
                obj, problems = None, [f"JSON inválido: {e}"]
            if not problems and isinstance(obj, dict):
                messages.append({"role": "assistant", "content": content})
                return obj, "", data
            if attempt == 1:
                messages += [{"role": "assistant", "content": content},
                             {"role": "user", "content": "Saída fora do esquema: " + "; ".join(problems[:8]) +
                              ". Responda SÓ com o objeto JSON da etapa, completo."}]
        return None, "error: resposta fora do esquema 2x: " + "; ".join(problems[:4]), data

    # --- contexto estável (prefixo idêntico em todas as chamadas da feature)
    def prefix(self) -> str:
        import bia
        parts = [role_section("qa", "Papel"), f"# FEATURE {self.f.fid}: {self.f.title}",
                 "# PLANO\n" + (self.repo / feature_plan_path(self.f.fid)).read_text().strip()]
        shown: set[str] = set()
        for c in self.f.tests:
            done = [str(d) for d in c.get("done") or []]
            parts.append(f"# CARTÃO {c['id']} (test-author): {c.get('title', '')}\nArquivo: {', '.join(map(str, c.get('allowedPaths') or []))}\n"
                         "PRONTO QUANDO:\n" + "\n".join(f"{n}. {d}" for n, d in enumerate(done, 1)) +
                         "\nDicas:\n" + "\n".join(f"- {h}" for h in c.get("hints") or []) +
                         "\nChecks:\n" + "\n".join(f"{i}: {k}" for i, k in enumerate(c.get("checks") or [])))
        for c in self.f.impls:
            parts.append(f"# CARTÃO {c['id']} (implement, outra agente): {c.get('title', '')}\nA implementação vai cumprir:\n" +
                         "\n".join(f"- {d}" for d in c.get("done") or []))
        for c in self.f.tests:  # readFirst do HEAD: o stub e o contrato, não a implementação em andamento
            text = bia.contract(self.repo, {**c, "readFirst": []})
            for f in map(str, c.get("readFirst") or []):
                if f not in shown and f not in map(str, c.get("allowedPaths") or []) and (src := self.head_text(f)) is not None:
                    text += ("\n\n" if text else "") + f"=== {f} ===\n{src}"
                shown.add(f)
            if text:
                parts.append("# CONTRATO\n" + text)
        return "\n\n".join(parts)

    def head_text(self, path: str) -> str | None:
        p = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=self.repo, capture_output=True, text=True)
        if p.returncode == 0:
            return p.stdout
        return (self.repo / path).read_text() if (self.repo / path).is_file() else None

    # --- etapa 1
    def stage_plan(self) -> str:
        t0 = time.time()
        problems = [p for p in feature_problems(self.plan, lambda p: (self.repo / p).read_text() if (self.repo / p).is_file() else None)
                    if p.startswith(self.f.fid)]
        return self.finish("plan", "done" if not problems else "card_error", t0, problems=problems)

    # --- etapa 2
    def write_files(self, files: list[dict]) -> list[str]:
        written = []
        for f in files:
            (self.repo / f["path"]).parent.mkdir(parents=True, exist_ok=True)
            (self.repo / f["path"]).write_text(f["content"] if f["content"].endswith("\n") else f["content"] + "\n")
            written.append(f["path"])
        self.ops.format(written)  # LI-052: formatar é do harness
        return written

    def test_checks(self, skip_expect_red: bool = False) -> Checks:
        out: Checks = []
        for c in self.f.tests:
            card = {**c, "checks": [k for k in c.get("checks") or [] if not (skip_expect_red and "expect-red" in str(k))]}
            out += self.ops.run_checks(card)
        return out

    @contextmanager
    def implementation_stub(self):
        """Troca só o worktree pelo HEAD para checks TDD; nunca altera o índice."""
        saved = {}
        head = {}
        paths = {str(p) for c in self.f.impls for p in c.get("allowedPaths") or []}
        for path in sorted(paths):
            target = self.repo / path
            saved[path] = (target.read_bytes(), target.stat().st_mode) if target.is_file() else None
            proc = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=self.repo, capture_output=True)
            if proc.returncode:
                exists = subprocess.run(["git", "cat-file", "-e", f"HEAD:{path}"], cwd=self.repo, capture_output=True)
                if exists.returncode == 0:
                    raise RuntimeError(f"não foi possível ler stub HEAD:{path}")
                head[path] = None
            else:
                head[path] = proc.stdout
        changed = []
        try:
            for path in sorted(paths):
                target = self.repo / path
                changed.append(path)
                if head[path] is None:
                    target.unlink(missing_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(head[path])
            yield
        finally:
            for path in reversed(changed):
                target = self.repo / path
                if saved[path] is None:
                    target.unlink(missing_ok=True)
                else:
                    target.write_bytes(saved[path][0])
                    os.chmod(target, saved[path][1])

    def checks_against_stub(self) -> Checks:
        with self.implementation_stub():
            return self.test_checks()

    def stage_tests(self) -> str:
        t0 = time.time()
        self.log_dir.mkdir(parents=True, exist_ok=True)
        for c in self.f.tests:  # entrega antiga (rodadas por cartão) sai da árvore, sem se perder
            self.ops.restore(c, self.log_dir)
            old = self.repo / "docs" / "plano" / "revisao" / f"{c['id']}.md"
            if old.is_file():
                (self.log_dir / "previous").mkdir(parents=True, exist_ok=True)
                shutil.move(str(old), str(self.log_dir / "previous" / old.name))
        scenarios = [c for c, _ in plan_scenarios((self.repo / feature_plan_path(self.f.fid)).read_text())]
        paths = self.test_paths()
        messages = [{"role": "user", "content": self.prefix() + "\n\n# ETAPA: TESTES\n" + role_section("qa", "Etapa: testes")}]
        obj, why, _ = self.ask("tests", messages, lambda o: tests_schema_problems(o, paths, scenarios))
        if obj is None:
            return self.finish("tests", why.split(":", 1)[0], t0, message=why)
        self.write_files(obj["files"])
        try:
            red = [r for r in self.checks_against_stub() if r[1] != 0]
        except (OSError, RuntimeError, subprocess.SubprocessError) as e:
            return self.finish("tests", "error", t0, message=f"stub: {e}")
        repairs = 0
        if red:  # no máximo 1 reparo, com todos os erros juntos
            repairs = 1
            messages.append({"role": "user", "content": "# ETAPA: REPARO\n" + role_section("qa", "Etapa: reparo") + "\n\n" + red_text(red)})
            fixed, why, _ = self.ask("tests", messages, lambda o: tests_schema_problems(o, paths, scenarios))
            if fixed is None:
                return self.finish("tests", why.split(":", 1)[0], t0, message=why, red=[c for c, _, _ in red])
            obj = {**fixed, "scenarios": fixed.get("scenarios") or obj["scenarios"]}
            self.write_files(obj["files"])
            try:
                red = [r for r in self.checks_against_stub() if r[1] != 0]
            except (OSError, RuntimeError, subprocess.SubprocessError) as e:
                return self.finish("tests", "error", t0, message=f"stub: {e}")
        self.state["testShas"] = {p: blob_sha(self.repo, p) for p in sorted(paths)}
        self.state["expectRed"] = not red
        self.state["scenarios"] = obj["scenarios"]
        self.write_tests_md(obj["scenarios"], red, repairs)
        if red:
            return self.finish("tests", "escalated", t0, repairs=repairs, red=[c for c, _, _ in red],
                               message="checks vermelhos depois do reparo em lote: decide o Claude")
        return self.finish("tests", "done", t0, repairs=repairs)

    def write_tests_md(self, scenarios: list[dict], red: Checks, repairs: int) -> None:
        lines = [f"# Testes da feature {self.f.fid}", "", "Escritos pela Bia numa chamada (etapa 2, ADR-0014).", "",
                 "| Cenário | Descrição | Cartão | Teste |", "|---|---|---|---|"]
        lines += [f"| {s.get('id')} | {str(s.get('descricao', '')).replace('|', '/')} | {s.get('card', '')} | {str(s.get('teste', '')).replace('|', '/')} |"
                  for s in scenarios]
        lines += ["", f"Reparos em lote: {repairs}. Checks: " + ("todos verdes" if not red else "vermelhos: " + "; ".join(c for c, _, _ in red)),
                  "", "Arquivos (sha do blob):"] + [f"- `{p}` {sha}" for p, sha in self.state["testShas"].items()]
        (self.dir / "testes.md").write_text("\n".join(lines) + "\n")

    # --- etapa 3
    def stage_implement(self) -> str:
        t0 = time.time()
        if self.state["stages"].get("tests", {}).get("status") != "done":
            return self.finish("implement", "skipped", t0, message="etapa de testes não está done")
        cards = {c["id"]: {**c, "featureTests": dict(self.state["testShas"])} for c in self.f.impls}
        results = self.ops.plan_run(cards, list(cards), self.rounds)
        tok = {"prompt": sum(int((r.get("aliceTokens") or {}).get("prompt", 0)) for r in results),
               "output": sum(int((r.get("aliceTokens") or {}).get("output", 0)) for r in results)}
        self.results += results
        st = self.stage("implement")
        prev = st.get("aliceTokens") or {"prompt": 0, "output": 0}
        status = "done" if all(r.get("status") == "done" for r in results) else \
            next(str(r.get("status")) for r in results if r.get("status") != "done")
        return self.finish("implement", status, t0, aliceTokens={k: prev[k] + tok[k] for k in tok},
                           cards={str(r.get("task")): str(r.get("status")) for r in results})

    # --- etapa 4
    def impl_checks(self) -> Checks:
        out: Checks = []
        for c in self.f.impls:
            out += self.ops.run_checks(c)
        return out

    def impl_diff(self) -> str:
        parts = []
        for c in self.f.impls:
            for p in c.get("allowedPaths") or []:
                d = subprocess.run(["git", "diff", "HEAD", "--", str(p)], cwd=self.repo, capture_output=True, text=True).stdout
                parts.append(d or f"(sem diff em {p})")
        return "\n".join(parts)

    def with_stub(self, fn: Callable[[], Checks]) -> Checks:
        """Roda `fn` com a implementação de volta ao HEAD (stub) e a devolve depois: expect-red do complemento."""
        saved: dict[str, str] = {}
        for c in self.f.impls:
            for p in map(str, c.get("allowedPaths") or []):
                if (self.repo / p).is_file():
                    saved[p] = (self.repo / p).read_text()
                    subprocess.run(["git", "checkout", "HEAD", "--", p], cwd=self.repo, check=True)
        try:
            return fn()
        finally:
            for p, text in saved.items():
                (self.repo / p).write_text(text)

    def audit_prompt(self, checks: Checks, final: bool) -> str:
        tests = "\n\n".join(f"# TESTE {p} (com número de linha)\n{numbered((self.repo / p).read_text())}" for p in sorted(self.test_paths()))
        coverage = "\n".join(f"$ {c}\nexit={code}\n{out[-1500:]}" for c, code, out in checks[:1])
        rest = "; ".join(f"{c}: exit={code}" for c, code, _ in checks[1:])
        note = "\nEsta é a re-auditoria depois do complemento: extraTests não é mais aceito (deixe a lista vazia)." if final else ""
        return (self.prefix() + "\n\n# ETAPA: AUDITORIA\n" + role_section("qa", "Etapa: auditoria") + note +
                f"\n\n# NÚMEROS MECÂNICOS\nexpect-red contra o stub: {'passou' if self.state['expectRed'] else 'não passou'}\n"
                f"Cobertura e testes:\n{gates.redact(coverage)[0]}\nOutros checks: {rest}\n\n{tests}\n\n# DIFF DA IMPLEMENTAÇÃO\n{self.impl_diff()}")

    def asked(self) -> dict[str, list[int]]:
        return {c["id"]: [n for n, d in enumerate(map(str, c.get("done") or []), 1) if not self.ops.mechanical(d)] for c in self.f.tests}

    def stage_audit(self) -> str:
        t0 = time.time()
        if self.state["stages"].get("implement", {}).get("status") != "done":
            return self.finish("audit", "skipped", t0, message="implementação não está done: a Bia não é chamada")
        checks = self.impl_checks()
        if red := [r for r in checks if r[1] != 0]:
            return self.finish("audit", "escalated", t0, message="checks da implementação vermelhos: a Bia não é chamada",
                               red=[c for c, _, _ in red])
        paths, asked = self.test_paths(), self.asked()
        obj, why, data = self.ask("audit", [{"role": "user", "content": self.audit_prompt(checks, False)}],
                                  lambda o: audit_schema_problems(o, paths, asked))
        if obj is None:
            return self.finish("audit", why.split(":", 1)[0], t0, message=why)
        audits = [obj]
        complement = self.complement(obj.get("extraTests") or [])
        if complement["applied"]:
            checks = self.impl_checks()
            if [r for r in checks if r[1] != 0]:  # a Alice itera de novo, local, com os testes novos
                self.stage_implement()
                checks = self.impl_checks()
            if not [r for r in checks if r[1] != 0] and not self.can_call():
                again, why2, data2 = self.ask("audit", [{"role": "user", "content": self.audit_prompt(checks, True)}],
                                              lambda o: audit_schema_problems({**o, "extraTests": []} if isinstance(o, dict) else o, paths, asked))
                if again is not None:
                    audits.append({**again, "extraTests": []})
                    data = data2
                else:
                    complement["reaudit"] = why2
            else:
                complement["reaudit"] = "não feita: " + ("checks vermelhos depois do complemento" if [r for r in checks if r[1] != 0] else self.can_call())
        green = not [r for r in checks if r[1] != 0] and not [r for r in self.test_checks(skip_expect_red=True) if r[1] != 0]
        last = audits[-1]
        self.write_reviews(last, data, green)
        self.write_audit_md(audits, complement, checks, green)
        status = "done" if green and last.get("verdict") == "aprovado" else "escalated"
        return self.finish("audit", status, t0, verdict=last.get("verdict"), gaps=len(last.get("gaps") or []),
                           extraTests=complement["applied"], checksGreen=green)

    def complement(self, extra: list[dict]) -> dict:
        """extraTests em lote: validador (esquema) já passou; checks do teste e expect-red contra o stub. Reprovou: volta."""
        out: dict = {"proposed": [e.get("path") for e in extra], "applied": [], "refused": ""}
        if not extra or self.state.get("complemented"):
            return out
        self.state["complemented"] = True
        backup = {p: (self.repo / p).read_text() for p in self.test_paths() if (self.repo / p).is_file()}
        self.write_files(extra)
        red = [r for r in self.test_checks(skip_expect_red=True) if r[1] != 0]
        red += [r for r in self.with_stub(self.expect_red_checks) if r[1] != 0]
        if red:
            for p, text in backup.items():
                (self.repo / p).write_text(text)
            out["refused"] = "; ".join(f"{c} (exit {code})" for c, code, _ in red)
            return out
        self.state["testShas"] = {p: blob_sha(self.repo, p) for p in sorted(self.test_paths())}
        out["applied"] = [e["path"] for e in extra]
        self.save()
        return out

    def expect_red_checks(self) -> Checks:
        out: Checks = []
        for c in self.f.tests:
            out += self.ops.run_checks({**c, "checks": [k for k in c.get("checks") or [] if "expect-red" in str(k)]})
        return out

    def write_reviews(self, audit: dict, data: dict, green: bool) -> None:
        """Revisão assinada `auditoria-bia` (review.audit_problems): vale só com os números mecânicos."""
        mech = {"expectRed": bool(self.state["expectRed"]), "checksGreen": green}
        items = audit.get("itens") or {}
        for c in self.f.tests:
            path = str((c.get("allowedPaths") or [""])[0])
            sha = blob_sha(self.repo, path)
            rows = {int(r["n"]): r for r in items.get(c["id"]) or [] if isinstance(r, dict) and str(r.get("n", "")).isdigit()}
            rid = self.ops.save_raw({**data, "id": f"{data.get('id') or 'audit'}-{c['id']}"},
                                    {"card": c["id"], "task": "test", "path": path, "sha": sha, "reviewer": "auditoria-bia",
                                     "model": self.ops.model(), "writer": "bia", "feature": self.f.fid, "mechanical": mech})
            ok = audit.get("verdict") == "aprovado" and green and all(rows.get(n, {}).get("ok") for n in self.asked()[c["id"]])
            self.ops.write_review(c, f"auditoria-bia {self.ops.model()} {rid}", path, sha, rows,
                                  [{"linha": "-", "regra": "gap", "explicacao": g.get("explicacao")} for g in audit.get("gaps") or []], ok)

    def write_audit_md(self, audits: list[dict], comp: dict, checks: Checks, green: bool) -> None:
        lines = [f"# Auditoria da feature {self.f.fid}", "", "Bia (etapa 4, ADR-0014), apoiada nos números mecânicos.", "",
                 f"- expect-red contra o stub: {'passou' if self.state['expectRed'] else 'não passou'}",
                 f"- checks no fim: {'todos verdes' if green else 'vermelhos'} ({'; '.join(f'{c.split()[-1]} exit={code}' for c, code, _ in checks)})"]
        for i, a in enumerate(audits, 1):
            lines += ["", f"## {'Auditoria' if i == 1 else 'Re-auditoria depois do complemento'}", "", f"veredito: {a.get('verdict')}"]
            lines += [f"- lacuna {g.get('cenario', '?')}: {g.get('explicacao', '')}" for g in a.get("gaps") or []] or ["- sem lacunas"]
        lines += ["", "## Complemento (extraTests)", f"- propostos: {', '.join(map(str, comp['proposed'])) or 'nenhum'}",
                  f"- aplicados: {', '.join(comp['applied']) or 'nenhum'}"]
        if comp.get("refused"):
            lines.append(f"- recusados (checks ou expect-red): {comp['refused']}")
        if comp.get("reaudit"):
            lines.append(f"- re-auditoria: {comp['reaudit']}")
        (self.dir / "auditoria.md").write_text("\n".join(lines) + "\n")

    # --- etapa 5 (o orquestrador só prepara; quem decide e commita é o Claude)
    def stage_review(self) -> str:
        t0 = time.time()
        st = self.state["stages"]
        checks = self.test_checks(skip_expect_red=True) + self.impl_checks()
        plano = (self.repo / feature_plan_path(self.f.fid)).read_text()
        criteria = [line for line in plano.split("## Critérios de aceite", 1)[-1].split("\n## ", 1)[0].splitlines() if line.startswith("- ")]
        lines = [f"# Revisão final da feature {self.f.fid}: {self.f.title}", "",
                 "Para o Claude (etapa 5): ler isto e o diff; aprovar = commit com um `Card-Done` por cartão.", "",
                 "| Etapa | Status | Segundos | Bia (req.) |", "|---|---|---|---|"]
        lines += [f"| {s} | {st.get(s, {}).get('status', '-')} | {st.get(s, {}).get('seconds', '-')} | {st.get(s, {}).get('biaRequests', 0)} |" for s in STAGES[1:4]]
        lines += ["", "## Critérios de aceite (do plano)"] + criteria
        lines += ["", "## Pronto de cada cartão × evidência"]
        for c in self.f.tests:
            f = self.repo / "docs" / "plano" / "revisao" / f"{c['id']}.md"
            lines.append(f"- {c['id']}: revisão `{f.relative_to(self.repo)}` " + ("presente" if f.is_file() else "ausente"))
        lines += [f"- {c['id']}: {c.get('title', '')} ({st.get('implement', {}).get('cards', {}).get(c['id'], '-')})" for c in self.f.impls]
        lines += ["", "## Checks agora"] + [f"- exit={code} `{c}`" for c, code, _ in checks]
        cov = next((out for c, _, out in checks if "--coverage" in c), "")
        lines += ["", "## Cobertura (vitest)", "```", "\n".join(l for l in cov.splitlines() if "|" in l)[-1200:] or "(sem tabela)", "```"]
        aud = st.get("audit", {})
        lines += ["", "## Auditoria", f"- veredito: {aud.get('verdict', '-')}; lacunas: {aud.get('gaps', '-')}; extraTests aplicados: {aud.get('extraTests') or 'nenhum'}",
                  "- detalhes: `auditoria.md`; cenários: `testes.md`"]
        left = self.ops.quota_left()
        tok = st.get("implement", {}).get("aliceTokens") or {}
        bia_in = sum(int(st.get(s, {}).get("biaIn", 0)) for s in STAGES)
        bia_out = sum(int(st.get(s, {}).get("biaOut", 0)) for s in STAGES)
        lines += ["", "## Custo", f"- Bia: {self.state['biaRequests']}/{self.f.budget} requisições; tokens {bia_in} entrada / {bia_out} saída; cota restante: {'?' if left is None else left}",
                  f"- Alice: {tok.get('prompt', 0)} entrada / {tok.get('output', 0)} saída (local)"]
        (self.dir / "revisao-final.md").write_text("\n".join(lines) + "\n")
        return self.finish("review", "ready", t0)

    # --- condução
    rounds = 3
    results: list[dict] = []

    def run(self, stage: str, rounds: int) -> list[str]:
        self.rounds, self.results = rounds, []
        steps: dict[str, Callable[[], str]] = {"plan": self.stage_plan, "tests": self.stage_tests, "implement": self.stage_implement,
                                               "audit": self.stage_audit, "review": self.stage_review}
        if stage != "all":
            return [f"{stage}: {steps[stage]()}"]
        out = []
        for s in STAGES:
            if s != "plan" and s != "review" and self.state["stages"].get(s, {}).get("status") == "done":
                out.append(f"{s}: done (já feito)")
                continue
            status = steps[s]()
            out.append(f"{s}: {status}")
            if status not in ("done", "ready"):
                break
        return out


def retro_text(orc: Orchestrator, summary: list[str], runs: Path) -> str:
    from retro import write_retro
    stamp = time.strftime("%Y%m%d-%H%M%S")
    text = write_retro(orc.results, runs, runs / f"retro-{stamp}.md") if orc.results else f"# Retro {stamp}\n"
    st = orc.state["stages"]
    text += f"\n## Feature {orc.f.fid}\n" + "\n".join(f"- {s}" for s in summary) + "\n"
    for s in STAGES:
        if (m := st.get(s, {}).get("message")):
            text += f"- {s}: {m}\n"
    left = orc.ops.quota_left()
    text += f"- Bia (OpenRouter): {orc.state['biaRequests']}/{orc.f.budget} requisições da feature; cota restante: {'?' if left is None else left}\n"
    (runs / f"retro-{stamp}.md").write_text(text)
    if orc.results:  # o hook do Claude reconhece a entrega pelo plan-*.json (guard_hook.delivered_ids)
        (runs / f"plan-{stamp}.json").write_text(json.dumps(orc.results, ensure_ascii=False, indent=1))
    return text


def cmd_feature(plan_path: Path, fid: str, repo: Path, stage: str, rounds: int, runs: Path, ops: FeatureOps | None = None) -> int:
    plan = yaml.safe_load(plan_path.read_text()) or {}
    repo = repo.resolve()
    orc = Orchestrator(repo, plan, fid, ops or FeatureOps(repo), runs)
    if stage in ("all", "tests") and orc.stage_plan() != "done":
        print("plano da feature com problema (etapa 1, do Claude):\n- " + "\n- ".join(orc.stage("plan").get("problems") or []))
        return 5
    summary = orc.run("tests" if stage == "tests" else stage, rounds) if stage != "all" else orc.run("all", rounds)
    print(retro_text(orc, summary, runs))
    last = summary[-1].split(": ", 1)[1] if summary else ""
    return 0 if last in ("done", "ready") or last.startswith("done") else 2
