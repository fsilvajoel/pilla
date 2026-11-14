#!/usr/bin/env bash
# Testa a chave do Brave sem exibi-la. Uso: scripts/check-brave.sh
set -euo pipefail
cd "$(dirname "$0")/.."
KEY=$(grep -E '^BRAVE_SEARCH_API_KEY=' .env | cut -d= -f2- | tr -d '"'"'"' \r')
[ -n "$KEY" ] || { echo "ERRO: BRAVE_SEARCH_API_KEY vazia no .env"; exit 1; }
RESP=$(curl -s -m 20 -w '\n%{http_code}' -G 'https://api.search.brave.com/res/v1/web/search' \
  --data-urlencode 'q=NestJS modules site:docs.nestjs.com' --data-urlencode 'count=3' \
  -H 'Accept: application/json' -H "X-Subscription-Token: $KEY")
CODE=$(tail -n1 <<<"$RESP"); BODY=$(sed '$d' <<<"$RESP")
echo "HTTP $CODE"
if [ "$CODE" = 200 ]; then jq -r '.web.results[]? | "- \(.title) — \(.url)"' <<<"$BODY"; else jq -c '.' <<<"$BODY" 2>/dev/null | cut -c1-300 || echo "$BODY" | cut -c1-300; fi
