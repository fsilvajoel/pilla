import json
import os
from pathlib import Path
from typing import List, Dict, Any

def append(path: Path, record: Dict[str, Any]) -> None:
    """Appends a record to a JSONL file, creating directories if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

def load(path: Path) -> List[Dict[str, Any]]:
    """Loads records from a JSONL file, skipping malformed lines."""
    if not path.exists():
        return []
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records

def summary(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculates summary metrics from a list of records."""
    runs = len(records)
    done = sum(1 for r in records if r.get("status") == "done")
    
    success_rate = done / runs if runs > 0 else 0
    avg_attempts = sum(r.get("attempts", 0) for r in records) / runs if runs > 0 else 0
    avg_seconds = sum(r.get("seconds", 0) for r in records) / runs if runs > 0 else 0
    
    alice_tokens = {"prompt": 0, "output": 0}
    by_kind = {}
    
    for r in records:
        kind = r.get("kind", "implement")
        alice_tokens["prompt"] += r.get("promptTokens", 0)
        alice_tokens["output"] += r.get("outputTokens", 0)
        
        if kind not in by_kind:
            by_kind[kind] = {"runs": 0, "done": 0}
        
        by_kind[kind]["runs"] += 1
        if r.get("status") == "done":
            by_kind[kind]["done"] += 1
            
    return {
        "runs": runs,
        "done": done,
        "successRate": success_rate,
        "avgAttempts": avg_attempts,
        "avgSeconds": avg_seconds,
        "aliceTokens": alice_tokens,
        "byKind": by_kind
    }
