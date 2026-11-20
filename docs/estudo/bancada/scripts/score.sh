#!/bin/bash
# nota de implement: aplica o diff do perfil na base e confere os 3 cartões
p=$1; OUT=$(realpath ${2:-$(dirname $0)}); cd ~/code/pilla-score; git reset -q --hard a984aec; git clean -qfd packages
git apply $OUT/$p-impl.diff 2>/dev/null || { echo "$p: diff não aplica"; exit; }
F="packages/schemas/src/api/access/portal-access.ts packages/schemas/src/api/lending/payoff-quote.ts packages/schemas/src/api/core/attachment-upload-url.ts"
for f in $F; do n=$(basename $f .ts)
  esb=$(grep -c "ESBOÇO\|z.never" $f); typ=$(grep -c "^export type" $f); strict=$(grep -c "strictObject" $f)
  echo "$p $n: esboço=$esb exportType=$typ strict=$strict"; done
pnpm -s --filter @pilla/schemas typecheck >/dev/null 2>&1 && echo "$p typecheck ok" || echo "$p typecheck FALHA"
for s in portalAccessRequest payoffQuoteQuery attachmentUploadUrlRequest; do
  r=$(cd packages/schemas && npx vitest run -t "$s" 2>&1 | grep -E "^ +Tests " | tr -s " "); echo "$p $s: $r"; done
node scripts/check-avoid.mjs docs/memoria/libs/zod.md packages/schemas/src 2>&1 | tail -1 | sed "s/^/$p /"
