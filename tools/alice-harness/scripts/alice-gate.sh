#!/usr/bin/env bash
# SSH forced command for Alice's dedicated key: only harness commands and read-only inspection.
# authorized_keys: command="~/code/pilla/tools/alice-harness/scripts/alice-gate.sh",no-port-forwarding,no-agent-forwarding,no-pty ssh-ed25519 ...
set -euo pipefail
cmd="${SSH_ORIGINAL_COMMAND:-}"
H="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$H/../.." && pwd)"
log() { printf '%s %s\n' "$(date -Is)" "$1" >> "$H/runs/gate.log"; }
deny() { log "DENY $cmd"; echo "alice-gate: comando não permitido. Use alice.py run|resume|rule|metrics." >&2; exit 126; }
case "$cmd" in *[\;\&\|\`\$\>\<]*|*'..'*) deny ;; esac
read -r -a argv <<< "$cmd"
case "${argv[0]:-}" in
  alice) argv=(python3 "$H/alice.py" "${argv[@]:1}") ;;
  git) cd "$REPO"; [[ "${argv[1]:-}" =~ ^(status|log|diff|show)$ ]] || deny ;;
  cat|ls) for a in "${argv[@]:1}"; do [[ "$a" == runs/* || "$a" == "$H"/runs/* ]] || deny; done; cd "$H" ;;
  *) deny ;;
esac
if [[ "${argv[0]}" == python3 ]]; then [[ "${argv[2]:-}" =~ ^(run|resume|rule|metrics)$ ]] || deny; fi
log "ALLOW $cmd"
exec "${argv[@]}"
