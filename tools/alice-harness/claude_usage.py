"""Claude token usage from a Claude Code session transcript (.jsonl), grouped by time windows (study data)."""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

FIELDS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")


def session_files(transcript: Path) -> list[Path]:
    """The session transcript plus its subagents. Claude Code keeps a subagent (Agent tool, sidechain) in
    <projeto>/<sessão>/subagents/agent-<id>.jsonl, next to <projeto>/<sessão>.jsonl; a subagent path maps back to its session."""
    t = Path(transcript)
    if t.parent.name == "subagents":
        t = t.parent.parent.parent / f"{t.parent.parent.name}.jsonl"
    subs = sorted((t.parent / t.stem / "subagents").glob("agent-*.jsonl"))
    return ([t] if t.exists() else []) + subs


def load(transcript: Path) -> list[tuple[str, dict]]:
    """One (timestamp, usage) per assistant message id (the transcript repeats a message once per content block),
    over the session transcript and its subagents."""
    seen: dict[str, tuple[str, dict]] = {}
    lines = [ln for f in session_files(transcript) for ln in f.read_text(errors="replace").splitlines()]
    for line in lines:
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = e.get("message") or {}
        if e.get("type") == "assistant" and msg.get("usage") and msg.get("id"):
            seen[msg["id"]] = (e["timestamp"], msg["usage"])
    return sorted(seen.values())


def _instant(value: str) -> datetime:
    """Naive ISO timestamps from older transcripts/commits are UTC, not local time."""
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return (dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def window(rows: list[tuple[str, dict]], since: str = "", until: str = "~") -> dict:
    start = _instant(since) if since else None
    end = _instant(until) if until != '~' else None
    tot = {k: 0 for k in FIELDS} | {"turns": 0}
    for t, u in rows:
        instant = _instant(t)
        if (start is None or start <= instant) and (end is None or instant < end):
            tot["turns"] += 1
            for k in FIELDS:
                tot[k] += int(u.get(k) or 0)
    return tot


def weighted(w: dict) -> int:
    """Approximate cost in input-token units: cache read 0.1x, 1h cache write 2x, output 5x (Opus-class pricing ratios)."""
    return round(w["input_tokens"] + 2 * w["cache_creation_input_tokens"] + 0.1 * w["cache_read_input_tokens"] + 5 * w["output_tokens"])


COST_WEIGHTS = {"input_tokens": 1, "cache_creation_input_tokens": 1.25, "cache_read_input_tokens": 0.1, "output_tokens": 5}


def cost(w: dict) -> int:
    """e4-guardrails D: the only Claude number for retro and report (input 1, cache write 1.25, cache read 0.1, output 5)."""
    return round(sum(k * w[f] for f, k in COST_WEIGHTS.items()))


def load_all(repo: Path, root: Path | None = None) -> list[tuple[str, dict]]:
    """Usage of every transcript whose session ran in the repo or in a folder above it (all sessions, compacted ones too,
    and their subagents)."""
    repo = Path(repo).resolve()
    seen: dict[str, tuple[str, dict]] = {}
    base = root or Path.home() / ".claude" / "projects"
    for f in sorted([*base.glob("*/*.jsonl"), *base.glob("*/*/subagents/agent-*.jsonl")]):
        for line in f.read_text(errors="replace").splitlines():
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            msg = e.get("message") or {}
            cwd = e.get("cwd")
            if e.get("type") != "assistant" or not msg.get("usage") or not msg.get("id") or not cwd:
                continue
            c = Path(cwd)
            if c == repo or c in repo.parents or repo in c.parents:
                seen[msg["id"]] = (e["timestamp"], msg["usage"])
    return sorted(seen.values())


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(['git', '-C', str(repo), *args], capture_output=True, text=True, check=True).stdout


def _card_ids(source: str) -> set[str]:
    """Only structured card IDs, never a matching substring of another ID or a comment."""
    try:
        plan = yaml.safe_load(source) or {}
    except yaml.YAMLError:
        return set()
    if not isinstance(plan, dict) or not isinstance(plan.get('cards'), list):
        return set()
    return {str(c['id']) for c in plan['cards'] if isinstance(c, dict) and isinstance(c.get('id'), str)}


def card_since(repo: Path, ids: list[str]) -> str | None:
    """Parent time of first commit adding each requested card to a versioned YAML plan (UTC); None if any is absent."""
    requested = set(ids)
    found: dict[str, int] = {}
    try:
        commits = _git(repo, 'log', '--reverse', '--format=%H', '--', 'docs/plano').split()
        for sha in commits:
            # Diff only changed YAML paths; do not scan every version of every file.
            changed = _git(repo, 'diff-tree', '--root', '--no-commit-id', '--name-only', '-r', sha, '--', 'docs/plano').splitlines()
            for path in changed:
                if not path.endswith(('.yaml', '.yml')):
                    continue
                try:
                    current = _card_ids(_git(repo, 'show', f'{sha}:{path}'))
                except subprocess.CalledProcessError:  # deleted/renamed path
                    current = set()
                try:
                    parent = _card_ids(_git(repo, 'show', f'{sha}^:{path}'))
                except subprocess.CalledProcessError:  # initial file in this commit
                    parent = set()
                added = (current - parent) & requested - found.keys()
                if added:
                    try:
                        timestamp = int(_git(repo, 'show', '-s', '--format=%ct', f'{sha}^').strip())
                    except subprocess.CalledProcessError:  # root commit
                        timestamp = int(_git(repo, 'show', '-s', '--format=%ct', sha).strip())
                    found.update({cid: timestamp for cid in added})
            if len(found) == len(requested):
                break
    except (subprocess.CalledProcessError, ValueError):
        return None
    if len(found) != len(requested) or not found:
        return None
    return datetime.fromtimestamp(min(found.values()), timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')


def latest_transcript(cwd: Path | None = None) -> Path | None:
    """Newest Claude Code session transcript (override with CLAUDE_TRANSCRIPT); `load` adds its subagents.
    A subagent counts as activity of its session, so the newest file among both picks the session."""
    import os
    if os.environ.get("CLAUDE_TRANSCRIPT"):
        return Path(os.environ["CLAUDE_TRANSCRIPT"])
    files = sorted([*Path.home().glob(".claude/projects/*/*.jsonl"), *Path.home().glob(".claude/projects/*/*/subagents/agent-*.jsonl")],
                   key=lambda p: p.stat().st_mtime)
    return session_files(files[-1])[0] if files else None


if __name__ == "__main__":
    rows = load(Path(sys.argv[1]))
    print(json.dumps(window(rows, *(sys.argv[2:4])), indent=1))
