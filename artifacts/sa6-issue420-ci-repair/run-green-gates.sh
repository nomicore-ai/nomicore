#!/usr/bin/env bash
# SA6 CI-repair acceptance harness (green side) — CI-verbatim commands against HEAD.
set -u
OUT=artifacts/sa6-issue420-ci-repair
echo "HEAD=$(git rev-parse HEAD)"

echo "### 03 package suite (ws-replication, 90 files)"
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication/test --typecheck.enabled=false --passWithNoTests=false > "$OUT/03-head-package-suite.log" 2>&1
echo "PACKAGE_SUITE_EXIT=$?"

for s in 1 6; do
  echo "### 04 shard $s/6 (CI verbatim)"
  files=$(node scripts/ci-test-shard.mjs $s 6)
  test -n "$files" || { echo "SHARD_${s}_EMPTY"; exit 2; }
  echo "SHARD_${s}_FILES=$(printf '%s\n' "$files" | wc -l)" > "$OUT/04-head-shard-${s}-meta.log"
  printf '%s\n' "$files" >> "$OUT/04-head-shard-${s}-meta.log"
  NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run $files --typecheck.enabled=false --passWithNoTests=false > "$OUT/04-head-shard-${s}.log" 2>&1
  echo "SHARD_${s}_EXIT=$?" >> "$OUT/04-head-shard-${s}.log"
done

echo "### 05 vitest --typecheck.only (CI Typecheck tests step)"
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck.only --passWithNoTests=false > "$OUT/05-head-typecheck-only.log" 2>&1
echo "TYPECHECK_ONLY_EXIT=$?"
echo "ALL_DONE"
