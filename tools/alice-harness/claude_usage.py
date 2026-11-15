"""Claude token usage from a Claude Code session transcript (.jsonl), grouped by time windows (study data)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

FIELDS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")


def load(transcript: Path) -> list[tuple[str, dict]]:
    """One (timestamp, usage) per assistant message id (the transcript repeats a message once per content block)."""
    seen: dict[str, tuple[str, dict]] = {}
    for line in transcript.read_text().splitlines():
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = e.get("message") or {}
        if e.get("type") == "assistant" and msg.get("usage") and msg.get("id"):
            seen[msg["id"]] = (e["timestamp"], msg["usage"])
    return sorted(seen.values())


def window(rows: list[tuple[str, dict]], since: str = "", until: str = "~") -> dict:
    tot = {k: 0 for k in FIELDS} | {"turns": 0}
    for t, u in rows:
        if since <= t < until:
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
    """Usage of every transcript whose session ran in the repo or in a folder above it (all sessions, compacted ones too)."""
    repo = Path(repo).resolve()
    seen: dict[str, tuple[str, dict]] = {}
    for f in sorted((root or Path.home() / ".claude" / "projects").glob("*/*.jsonl")):
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


def card_since(repo: Path, ids: list[str]) -> str | None:
    """Start of the preparation: commit time of the parent of the first commit that put any of the cards in docs/plano (UTC)."""
    import subprocess
    import time
    starts = []
    for cid in ids:
        out = subprocess.run(["git", "-C", str(repo), "log", "--reverse", "--format=%H", "-S", f"id: {cid}", "--", "docs/plano"],
                             capture_output=True, text=True).stdout.split()
        if not out:
            return None
        parent = subprocess.run(["git", "-C", str(repo), "log", "-1", "--format=%ct", f"{out[0]}^"],
                                capture_output=True, text=True).stdout.strip()
        if not parent:
            parent = subprocess.run(["git", "-C", str(repo), "log", "-1", "--format=%ct", out[0]], capture_output=True, text=True).stdout.strip()
        starts.append(int(parent))
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(min(starts)))


def latest_transcript(cwd: Path | None = None) -> Path | None:
    """Newest Claude Code transcript (override with CLAUDE_TRANSCRIPT)."""
    import os
    if os.environ.get("CLAUDE_TRANSCRIPT"):
        return Path(os.environ["CLAUDE_TRANSCRIPT"])
    files = sorted(Path.home().glob(".claude/projects/*/*.jsonl"), key=lambda p: p.stat().st_mtime)
    return files[-1] if files else None


if __name__ == "__main__":
    rows = load(Path(sys.argv[1]))
    print(json.dumps(window(rows, *(sys.argv[2:4])), indent=1))
