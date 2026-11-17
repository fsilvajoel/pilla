"""Fotografia operacional explícita; entradas do Claude não são estados do runner."""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Callable, TypeVar

T = TypeVar('T')

AGENTS: tuple[str, ...] = ('alice', 'bia')
ENTRIES: Path = Path('docs/agents/quadro-entradas.json')
OUTPUT: Path = Path('docs/agents/quadro.md')


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                         prefix=f'.{path.name}.', delete=False) as f:
            name = f.name
            f.write(text)
        os.replace(name, path)
    finally:
        if name is not None:
            Path(name).unlink(missing_ok=True)


def clean(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError('texto obrigatório')
    # Never allow an entry to create extra Markdown rows, links or fake agent fields.
    text = ' '.join(value.split()).replace('\\', '/').replace('|', '/').replace('[', '(').replace(']', ')')
    text = text.replace('<', '(').replace('>', ')')[:160]
    if not text or text == '?':
        raise ValueError('texto não pode estar vazio ou ser ?')
    return text


def entries(repo: Path) -> dict[str, object]:
    try:
        data = json.loads((repo / ENTRIES).read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def set_leva(repo: Path, text: str) -> None:
    data = entries(repo)
    data['leva'] = clean(text)
    atomic_write(repo / ENTRIES, json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def set_fila(repo: Path, agent: str, text: str) -> None:
    if agent not in AGENTS:
        raise ValueError('agente deve ser alice ou bia')
    value = clean(text)
    data = entries(repo)
    filas = data.get('filas')
    data['filas'] = {**(filas if isinstance(filas, dict) else {}), agent: value}
    atomic_write(repo / ENTRIES, json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def field(value: object) -> str:
    return clean(value) if isinstance(value, str) and value.strip() and value.strip() != '?' else '?'


def alice_current(repo: Path) -> str:
    # The lock belongs to the harness and may be stale after a crash; do not infer a live task from it.
    from alice import ACTIVE
    try:
        data = json.loads(ACTIVE.read_text())
        if Path(str(data['repo'])).resolve() != repo.resolve():
            return '?'
        pid = int(data['pid'])
        if pid <= 0 or not Path(f'/proc/{pid}').exists():
            return '?'
        return field(data.get('task'))
    except (OSError, ValueError, TypeError, KeyError):
        return '?'


def bia_quota(repo: Path) -> object:
    import bia
    return bia.quota(bia.api_key(repo))


def safe(source: Callable[[], T], fallback: T) -> T:
    try:
        return source()
    except (Exception, SystemExit):
        return fallback


def quota_remaining(data: object) -> str:
    if not isinstance(data, dict):
        return '?'
    value = data.get('remaining')
    return str(value) if type(value) is int and value >= 0 else '?'


def generate(repo: Path, *, now: Callable[[], datetime] = lambda: datetime.now().astimezone(),
             quota: Callable[[], object] | None = None,
             alice_state: Callable[[], object] | None = None) -> str:
    repo = repo.resolve()
    data = entries(repo)
    raw_filas = data.get('filas')
    filas: dict[str, object] = raw_filas if isinstance(raw_filas, dict) else {}
    vals = {agent: safe(lambda agent=agent: field(filas.get(agent)), '?') for agent in AGENTS}
    leva = safe(lambda: field(data.get('leva')), '?')
    current = field(safe(alice_state or (lambda: alice_current(repo)), '?'))
    q = quota_remaining(safe(quota or (lambda: bia_quota(repo)), {}))
    timestamp = now().isoformat(timespec='seconds')
    lines = ['# Quadro — fotografia', '', f'Gerado em: {timestamp}', '', f'- Leva: {leva}',
             f'- Alice: cartão {current}; fila {vals["alice"]}',
             f'- Bia: fila {vals["bia"]}; cota OpenRouter {q}; reset 00:00 UTC (21h BRT)',
             '',
             '## Filas', *(f'{agent.title()} → {vals[agent]}' for agent in AGENTS), '',
             'Fotografia manual; ? = fonte ausente ou indisponível. Gere novamente para atualizar.', '']
    text = '\n'.join(lines)
    atomic_write(repo / OUTPUT, text)
    return text
