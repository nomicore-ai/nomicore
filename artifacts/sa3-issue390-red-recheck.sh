#!/usr/bin/env bash
# SA3 independent red re-derivation for issue #390 (iteration 1 recheck).
# Reverts ONLY the 5 ALLOW implementation files to HEAD, captures red behavior +
# red test-tree typecheck, then restores byte-identical content from backup and
# verifies sha256 identity. Safe by construction: restore happens unconditionally.
set -u
cd /home/wangjian/nomicore-fix-issue-390

IMPL="packages/namespace-registry/src/registry.ts packages/namespace-registry/src/testing.ts packages/namespace-registry/src/types.ts packages/namespace-runtime/src/runtime.ts packages/namespace-runtime/src/watch-map.ts"
BACKUP=/tmp/sa3-390-backup

restore() {
  echo "=== RESTORE ==="
  for f in $IMPL; do cp "$BACKUP/$f" "$f"; done
  (cd "$BACKUP" && sha256sum -c live.sha256) && echo "RESTORE_SHA256_OK"
  git diff --stat
}
trap restore EXIT

echo "=== REVERT IMPL TO HEAD ==="
git checkout -- $IMPL
echo "tracked diff after revert:"; git diff --stat; echo "diff-lines=$(git diff | wc -l)"

echo "=== RED: behavior contract (HEAD impl + #390 tests) ==="
NODE_OPTIONS=--conditions=nomicore-source npx vitest run \
  packages/namespace-registry/test/issue-390-watch-invalidation-red.test.ts \
  --typecheck.enabled=false > artifacts/sa3-issue390-red-behavior-recheck.log 2>&1
echo "RED_BEHAVIOR_EXIT=$?"
tail -30 artifacts/sa3-issue390-red-behavior-recheck.log

echo "=== RED: test-tree typecheck (HEAD impl + #390 tests) ==="
npx tsc -p tsconfig.typecheck.json --noEmit > artifacts/sa3-issue390-red-typecheck-recheck.log 2>&1
echo "RED_TSC_EXIT=$?"
cat artifacts/sa3-issue390-red-typecheck-recheck.log
