#!/usr/bin/env bash
# SA3 independent green + regression battery for issue #390 (iteration 1 recheck).
set -u
cd /home/wangjian/nomicore-fix-issue-390
export NODE_OPTIONS=--conditions=nomicore-source

echo "=== GREEN 1: #390 behavior contract ==="
npx vitest run packages/namespace-registry/test/issue-390-watch-invalidation-red.test.ts \
  --typecheck.enabled=false > artifacts/sa3-issue390-green-behavior-recheck.log 2>&1
echo "GREEN_BEHAVIOR_EXIT=$?"
tail -12 artifacts/sa3-issue390-green-behavior-recheck.log

echo "=== GREEN 2: #390 type surface ==="
npx vitest run packages/namespace-registry/test/issue-390-watch-invalidation-surface.test-d.ts \
  > artifacts/sa3-issue390-green-typesurface-recheck.log 2>&1
echo "GREEN_TYPESURFACE_EXIT=$?"
tail -12 artifacts/sa3-issue390-green-typesurface-recheck.log

echo "=== GREEN 3: #390 contract repeat x3 (determinism, A2 timing) ==="
for i in 1 2 3; do
  npx vitest run packages/namespace-registry/test/issue-390-watch-invalidation-red.test.ts \
    --typecheck.enabled=false 2>&1 | tail -4
  echo "REPEAT_${i}_EXIT=${PIPESTATUS[0]}"
done > artifacts/sa3-issue390-green-repeat-recheck.log 2>&1
cat artifacts/sa3-issue390-green-repeat-recheck.log

echo "=== REGRESSION 1: #387 T1 contract (21 cases) ==="
npx vitest run packages/namespace-registry/test/issue-387-watch-map-tracer-red.test.ts \
  --typecheck.enabled=false > artifacts/sa3-issue390-regression-issue387-recheck.log 2>&1
echo "ISSUE387_EXIT=$?"
tail -8 artifacts/sa3-issue390-regression-issue387-recheck.log

echo "=== STATIC 1: test-tree tsc (tsconfig.typecheck.json) ==="
npx tsc -p tsconfig.typecheck.json --noEmit > artifacts/sa3-issue390-green-test-tsc-recheck.log 2>&1
echo "TEST_TSC_EXIT=$?"
wc -l artifacts/sa3-issue390-green-test-tsc-recheck.log; cat artifacts/sa3-issue390-green-test-tsc-recheck.log

echo "=== STATIC 2: root pnpm typecheck ==="
pnpm typecheck > artifacts/sa3-issue390-root-typecheck-recheck.log 2>&1
echo "ROOT_TYPECHECK_EXIT=$?"
tail -6 artifacts/sa3-issue390-root-typecheck-recheck.log

echo "=== REGRESSION 2: affected packages full suites ==="
npx vitest run packages/namespace-registry packages/namespace-runtime \
  --typecheck.enabled=false > artifacts/sa3-issue390-package-suites-recheck.log 2>&1
echo "PACKAGE_SUITES_EXIT=$?"
tail -10 artifacts/sa3-issue390-package-suites-recheck.log

echo "=== DONE ==="
