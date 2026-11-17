"""Fotografia operacional explícita; entradas do Claude não são estados do runner."""
from __future__ import annotations

import json
import os
import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Callable

AGENTS = ('alice', 'bia', 'jorge')
ENTRIES = Path('docs/agents/quadro-entradas.json')
OUTPUT = Path('docs/agents/quadro.md')
VALID_STATUS = {'aplicada', 'sem_mudancas', 'nada_a_fazer', 'nao_aplicada', 'erro'}


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                         prefix=f'.{path.name}.', delete=False) as f:
            name = f.name
            f.write(text)
        os.replace(name, path)
    finally:
        if name is not None:
            Path(name).unlink(missing_ok=True)


def clean(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError('texto obrigatório')
    # Never allow an entry to create extra Markdown rows, links or fake agent fields.
    text = ' '.join(value.split()).replace('\\', '/').replace('|', '/').replace('[', '(').replace(']', ')')
    text = text.replace('<', '(').replace('>', ')')[:160]
    if not text or text == '?':
        raise ValueError('texto não pode estar vazio ou ser ?')
    return text


def entries(repo: Path) -> dict:
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
        raise ValueError('agente deve ser alice, bia ou jorge')
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


def last_jorge(repo: Path) -> tuple[str, str] | None:
    root = repo / 'tools/jorge/logs'
    if not root.is_dir():
        return None
    dirs = []
    for path in root.iterdir():
        match = re.fullmatch(r'harness-v(\d+)', path.name)
        if match and path.is_dir():
            dirs.append((int(match[1]), path))
    for number, path in sorted(dirs, reverse=True):
        try:
            data = json.loads((path / 'estado.json').read_text())
            if isinstance(data, dict) and data.get('status') in VALID_STATUS and data.get('version') == f'harness-v{number}':
                return data['status'], data['version']
        except (OSError, ValueError):
            continue
    return None


def bia_quota(repo: Path) -> dict:
    import bia
    return bia.quota(bia.api_key(repo))


def safe(source: Callable, fallback):
    try:
        return source()
    except (Exception, SystemExit):
        return fallback


def quota_remaining(data: object) -> str:
    if not isinstance(data, dict):
        return '?'
    value = data.get('remaining')
    return str(value) if type(value) is int and value >= 0 else '?'


def generate(repo: Path, *, now: Callable = lambda: datetime.now().astimezone(),
             quota: Callable | None = None, alice_state: Callable | None = None,
             jorge_state: Callable | None = None) -> str:
    repo = repo.resolve()
    data = entries(repo)
    filas = data.get('filas')
    filas = filas if isinstance(filas, dict) else {}
    vals = {agent: safe(lambda agent=agent: field(filas.get(agent)), '?') for agent in AGENTS}
    leva = safe(lambda: field(data.get('leva')), '?')
    current = field(safe(alice_state or (lambda: alice_current(repo)), '?'))
    q = quota_remaining(safe(quota or (lambda: bia_quota(repo)), {}))
    last = safe(jorge_state or (lambda: last_jorge(repo)), None)
    if not isinstance(last, tuple) or len(last) != 2 or last[0] not in VALID_STATUS or not re.fullmatch(r'harness-v\d+', str(last[1])):
        last = ('?', '?')
    timestamp = now().isoformat(timespec='seconds')
    lines = ['# Quadro — fotografia', '', f'Gerado em: {timestamp}', '', f'- Leva: {leva}',
             f'- Alice: cartão {current}; fila {vals["alice"]}',
             f'- Bia: fila {vals["bia"]}; cota OpenRouter {q}; reset 00:00 UTC (21h BRT)',
             f'- Jorge: JORGE_STATUS={last[0]} versao={last[1]}; fila {vals["jorge"]}', '',
             '## Filas', *(f'{agent.title()} → {vals[agent]}' for agent in AGENTS), '',
             'Fotografia manual; ? = fonte ausente ou indisponível. Gere novamente para atualizar.', '']
    text = '\n'.join(lines)
    atomic_write(repo / OUTPUT, text)
    return text
