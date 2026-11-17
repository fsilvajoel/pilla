"""Compact generated run artifacts while preserving resumability and audit references."""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import zipfile
from contextlib import contextmanager
from pathlib import Path

CARD_RUN = re.compile(r"E\d+-T\d+$")
TERMINAL_RUN_STATUSES = {"done", "failed", "card_error", "error"}
ORPHANED_RUNNING_AGE_SECONDS = 24 * 60 * 60
ACTIVITY_MARKERS = ("ACTIVE.json", "QUEUE_ACTIVE.json", "FEATURE_ACTIVE.json")
COMPACTING_MARKER = "COMPACTING.json"
KEEP_ROOT_FILES = {
    "contexto.md", "retro-pendente.md", "resumo-logs.md", *ACTIVITY_MARKERS, COMPACTING_MARKER
}


def default_state_root() -> Path:
    return Path.home() / ".local" / "state" / "alice-harness"


def default_archive_root() -> Path:
    return default_state_root() / "run-archives"


def default_index_path() -> Path:
    return default_state_root() / "run-index.json"


def default_metrics_path() -> Path:
    return default_state_root() / "metrics.jsonl"


def metrics_path(runs: Path) -> Path:
    external = default_metrics_path()
    legacy = runs / "metrics.jsonl"
    return external if external.exists() or not legacy.exists() else legacy


def _read_index(runs: Path) -> dict:
    path = default_index_path()
    if not path.exists():
        path = runs / "index.json"
    if not path.exists():
        return {"version": 1, "archives": {}, "delivered": [], "retroSources": []}
    data = json.loads(path.read_text())
    if not isinstance(data, dict) or data.get("version") != 1:
        raise ValueError(f"índice de runs inválido: {path}")
    if not isinstance(data.get("archives"), dict) or not isinstance(data.get("delivered"), list):
        raise ValueError(f"índice de runs incompleto: {path}")
    data.setdefault("retroSources", [])
    return data


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    os.replace(tmp, path)


def read_archived_file(runs: Path, relative_path: str, archive_root: Path | None = None) -> bytes | None:
    """Read an archived artifact and verify its recorded digest; return None if it is not indexed."""
    index = _read_index(runs)
    info = index["archives"].get(relative_path)
    if not isinstance(info, dict):
        return None
    root = archive_root or Path(index.get("archiveRoot") or default_archive_root())
    archive = root / str(info["archive"])
    with zipfile.ZipFile(archive) as zf:
        content = zf.read(str(info["member"]))
    if hashlib.sha256(content).hexdigest() != info.get("sha256"):
        raise ValueError(f"artefato arquivado corrompido: {relative_path}")
    return content


def delivered_ids(runs: Path) -> set[str]:
    return {str(cid) for cid in _read_index(runs)["delivered"]}


def begin_activity(runs: Path, marker_name: str, info: dict) -> Path:
    if marker_name not in ACTIVITY_MARKERS:
        raise ValueError(f"marcador de atividade inválido: {marker_name}")
    runs.mkdir(parents=True, exist_ok=True)
    maintenance = runs / COMPACTING_MARKER
    if maintenance.exists():
        raise RuntimeError("compactação de runs em andamento; tente novamente")
    marker = runs / marker_name
    try:
        fd = os.open(marker, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise RuntimeError(f"operação Alice já em andamento: {marker_name}") from error
    try:
        os.write(fd, json.dumps(info, ensure_ascii=False).encode())
    finally:
        os.close(fd)
    if maintenance.exists():
        marker.unlink(missing_ok=True)
        raise RuntimeError("compactação de runs começou; operação cancelada")
    return marker


def end_activity(marker: Path) -> None:
    marker.unlink(missing_ok=True)


@contextmanager
def run_activity(runs: Path, marker_name: str, info: dict):
    marker = begin_activity(runs, marker_name, info)
    try:
        yield
    finally:
        end_activity(marker)


def restore_archived_tree(runs: Path, relative_directory: str) -> bool:
    """Rehydrate a run directory lazily, validating all files against the archive index."""
    relative = Path(relative_directory)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("caminho de execução arquivada inválido")
    prefix = relative.as_posix().rstrip("/") + "/"
    index = _read_index(runs)
    archived = [name for name in index["archives"] if name.startswith(prefix)]
    if not archived:
        return False
    root = runs.resolve()
    for name in archived:
        destination = runs / name
        if not destination.resolve().is_relative_to(root):
            raise ValueError(f"caminho fora de runs no índice: {name}")
        content = read_archived_file(runs, name)
        if content is None:
            raise ValueError(f"artefato ausente no índice: {name}")
        if destination.exists():
            if hashlib.sha256(destination.read_bytes()).hexdigest() != hashlib.sha256(content).hexdigest():
                raise ValueError(f"arquivo de execução diverge do arquivo: {name}")
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        tmp = destination.with_name(destination.name + ".restore.tmp")
        tmp.write_bytes(content)
        os.replace(tmp, destination)
    return (runs / relative / "state.json").is_file()


def _files_below(path: Path) -> set[Path]:
    return {p for p in path.rglob("*") if p.is_file()}


def _archive_candidates(runs: Path) -> tuple[set[Path], int]:
    candidates: set[Path] = set()
    skipped_live = 0

    for task_dir in runs.iterdir():
        if not task_dir.is_dir() or not CARD_RUN.fullmatch(task_dir.name):
            continue
        for run_dir in task_dir.iterdir():
            state_path = run_dir / "state.json"
            if not run_dir.is_dir() or not state_path.is_file():
                continue
            try:
                status = json.loads(state_path.read_text()).get("_status")
            except (OSError, ValueError, AttributeError):
                skipped_live += 1
                continue
            age = time.time() - state_path.stat().st_mtime
            if status in TERMINAL_RUN_STATUSES or status == "needs_input" or (
                status == "running" and age >= ORPHANED_RUNNING_AGE_SECONDS
            ):
                candidates.update(_files_below(run_dir))
            else:
                skipped_live += 1

    for category in ("bia", "plan-tasks"):
        path = runs / category
        if path.is_dir():
            candidates.update(_files_below(path))

    feature_root = runs / "feature"
    if feature_root.is_dir():
        for feature_dir in feature_root.iterdir():
            if feature_dir.is_dir():
                candidates.update(_files_below(feature_dir))

    for path in runs.iterdir():
        if not path.is_file() or path.name in KEEP_ROOT_FILES:
            continue
        if path.name.startswith(("plan-", "retro-")) or path.name in {
            "extract_rules.py", "regras_aprendidas_temp.md", "regras_brutas.txt"
        }:
            candidates.add(path)

    return {p for p in candidates if p.is_file()}, skipped_live


def _delivery_ids(paths: set[Path], current: set[str]) -> set[str]:
    delivered = set(current)
    for path in paths:
        if not path.name.startswith("plan-") or path.suffix != ".json":
            continue
        results = json.loads(path.read_text())
        if not isinstance(results, list):
            raise ValueError(f"resumo de fila inválido: {path}")
        for result in results:
            if isinstance(result, dict) and result.get("status") == "done" and result.get("task"):
                delivered.add(str(result["task"]))
    return delivered


def _context_text(lessons: Path) -> str:
    lines = [line for line in lessons.read_text().splitlines() if line.startswith("| LI-")]
    recent = lines[-12:]
    return (
        "# Contexto operacional resumido\n\n"
        "Gerado por `alice.py runs summarize`; fonte completa: `docs/memoria/licoes.md`.\n"
        "Lições mais recentes (IDs preservados para consulta):\n\n"
        + ("\n".join(["| ID | Data | Lição | Origem |", "|---|---|---|---|", *recent]) if recent else "_Sem lições registradas._")
        + "\n"
    )


def summarize_context(lessons: Path, output: Path) -> str:
    text = _context_text(lessons)
    _write_text(output, text)
    return text


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text)
    os.replace(tmp, path)


def _compact_runs(
    runs: Path,
    lessons: Path,
    archive_root: Path | None = None,
    apply: bool = False,
) -> dict:
    """Preview or archive closed artifacts; default is non-mutating."""
    runs = runs.resolve()
    archive_root = (archive_root or default_archive_root()).expanduser().resolve()
    if archive_root == runs or runs in archive_root.parents:
        raise ValueError("o arquivo de runs deve ficar fora da pasta runs")
    if any((runs / name).exists() for name in ACTIVITY_MARKERS):
        raise RuntimeError("Alice está ocupada; aguarde `alice.py status` ficar livre antes de compactar runs")

    index = _read_index(runs)
    candidates, skipped_live = _archive_candidates(runs)
    size = sum(path.stat().st_size for path in candidates)
    result = {
        "mode": "apply" if apply else "dry-run",
        "files": len(candidates),
        "bytes": size,
        "liveOrUnclassified": skipped_live,
        "persistentFilesAfterApply": sorted(
            KEEP_ROOT_FILES - set(ACTIVITY_MARKERS) - {COMPACTING_MARKER}
        ),
        "archiveRoot": str(archive_root),
    }
    if not apply:
        return result
    archive_name: str | None = None
    if candidates:
        stamp = time.strftime("%Y%m%d-%H%M%S")
        archive_name = f"runs-{stamp}.zip"
        suffix = 1
        while (archive_root / archive_name).exists():
            archive_name = f"runs-{stamp}-{suffix}.zip"
            suffix += 1

    new_entries: dict[str, dict[str, str]] = {}
    retro_sources = set(str(item) for item in index.get("retroSources", []))
    retro_sections = []
    for path in sorted(candidates):
        relative = path.relative_to(runs).as_posix()
        data = path.read_bytes()
        new_entries[relative] = {
            "archive": archive_name or "",
            "member": relative,
            "sha256": hashlib.sha256(data).hexdigest(),
        }
        if path.name.startswith("retro-") and path.suffix == ".md" and relative not in retro_sources:
            retro_sections.append(f"## Fonte arquivada: `{relative}`\n\n{data.decode('utf-8', errors='replace').rstrip()}\n")
            retro_sources.add(relative)

    delivered = _delivery_ids(candidates, set(str(cid) for cid in index["delivered"]))
    archive_path: Path | None = None
    if candidates:
        archive_root.mkdir(parents=True, exist_ok=True)
        if archive_name is None:
            raise RuntimeError("nome do arquivo de runs não foi definido")
        archive_path = archive_root / archive_name
        tmp_archive = archive_path.with_suffix(".zip.tmp")
        with zipfile.ZipFile(tmp_archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for path in sorted(candidates):
                relative = path.relative_to(runs).as_posix()
                zf.write(path, relative)
        with zipfile.ZipFile(tmp_archive) as zf:
            for relative, info in new_entries.items():
                digest = hashlib.sha256(zf.read(info["member"])).hexdigest()
                if digest != info["sha256"]:
                    tmp_archive.unlink(missing_ok=True)
                    raise OSError(f"verificação do arquivo falhou para {relative}")
        os.replace(tmp_archive, archive_path)

    archives = {**index["archives"], **new_entries}
    updated = {
        "version": 1,
        "archiveRoot": str(archive_root) if new_entries else index.get("archiveRoot", str(archive_root)),
        "archives": archives,
        "delivered": sorted(delivered),
        "retroSources": sorted(retro_sources),
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }

    if retro_sections:
        existing = (runs / "retro-pendente.md").read_text() if (runs / "retro-pendente.md").exists() else \
            "# Retrospectivas consolidadas\n\n"
        additions = [section for section in retro_sections
                     if f"## Fonte arquivada: `{section.split('`', 2)[1]}`" not in existing]
        if additions:
            _write_text(runs / "retro-pendente.md", existing.rstrip() + "\n\n" + "\n".join(additions) + "\n")
    summarize_context(lessons, runs / "contexto.md")
    _write_json(default_index_path(), updated)
    legacy_index = runs / "index.json"
    if legacy_index.exists():
        legacy_index.unlink()

    removed = 0
    for path in sorted(candidates):
        try:
            path.unlink()
            removed += 1
        except FileNotFoundError:
            continue
    for path in sorted((p for p in runs.rglob("*") if p.is_dir()), reverse=True):
        try:
            path.rmdir()
        except OSError:
            pass

    result.update({
        "archived": removed,
        "archive": str(archive_path) if archive_path else None,
        "persistentFiles": sum(
            1 for p in runs.iterdir() if p.is_file() and p.name not in (*ACTIVITY_MARKERS, COMPACTING_MARKER)
        ),
    })
    return result


def compact_runs(
    runs: Path,
    lessons: Path,
    archive_root: Path | None = None,
    apply: bool = False,
) -> dict:
    runs = runs.resolve()
    if not apply:
        return _compact_runs(runs, lessons, archive_root, apply=False)

    marker = runs / COMPACTING_MARKER
    runs.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(marker, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise RuntimeError("compactação de runs já está em andamento") from error
    try:
        os.write(fd, json.dumps({"pid": os.getpid(), "since": time.time()}).encode())
    finally:
        os.close(fd)
    try:
        busy = [name for name in ACTIVITY_MARKERS if (runs / name).exists()]
        if busy:
            raise RuntimeError("não compacte durante operações Alice: " + ", ".join(busy))
        return _compact_runs(runs, lessons, archive_root, apply=True)
    finally:
        marker.unlink(missing_ok=True)
