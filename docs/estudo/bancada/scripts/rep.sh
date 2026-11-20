#!/bin/bash
# repetição N da bancada: rep.sh N perfil...   (saída em r<N>/)
N=$1; shift; B=$(dirname $(readlink -f $0)); OUT=$B/r$N; mkdir -p $OUT
cd ~/code/pilla-bench; H=tools/alice-harness; BASE=5286a25
for p in "$@"; do
  echo "== r$N $p $(date +%T)"
  rm -rf ~/code/pilla-bench/tools/alice-harness/runs
  git checkout -q -f bench/models && git reset -q --hard $BASE && git clean -qfd packages docs
  ALICE_PROFILE=$p python3 $H/alice.py plan-run docs/plano/E2.yaml E2-T15 E2-T19 E2-T22 --repo . > $OUT/$p-impl.out 2>&1
  git diff > $OUT/$p-impl.diff
  $B/score.sh $p $OUT > $OUT/$p-impl.score 2>&1
  echo "   impl ok $(date +%T)"
  git checkout -q -f bench/t23 && git clean -qfd packages docs
  ALICE_PROFILE=$p python3 $H/alice.py plan-run docs/plano/E2.yaml E2-T23 --repo . > $OUT/$p-t23.out 2>&1
  echo "   t23 ok $(date +%T)"
  cp -r $H/runs $OUT/$p-runs
done
echo "== fim r$N $(date +%T)"
