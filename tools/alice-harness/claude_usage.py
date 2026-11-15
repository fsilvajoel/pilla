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
