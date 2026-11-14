#!/usr/bin/env bash
# Runs task cards in sequence and records wall time per task.
cd "$(dirname "$0")/.." || exit 1
for t in "$@"; do
  s=$(date +%s)
  python3 alice.py run "tasks/$t.yaml" --repo . > "runs/$t.report.json" 2>&1
  code=$?
  echo "$t exit=$code seconds=$(( $(date +%s) - s ))" >> runs/batch.log
done
