#!/usr/bin/env bash
# SA6 门禁证据脚本（issue #435）：pre-contract 基线（新契约文件移出 include 面）→ post-contract（文件在位）。
HOLD=artifacts/sa6-issue435-hold
mkdir -p "$HOLD"
restore() { mv "$HOLD"/issue-435-* packages/vfsl/test/ 2>/dev/null; }
trap restore EXIT
mv packages/vfsl/test/issue-435-* "$HOLD/"
echo "=== PRE-CONTRACT BASELINE (issue-435 files held out) $(date -u +%FT%TZ) ==="
echo "--- pnpm typecheck ---"
pnpm typecheck > artifacts/sa6-issue435-baseline2-typecheck.log 2>&1; echo "PRE_TYPECHECK_EXIT:$?"
echo "--- pnpm test ---"
pnpm test > artifacts/sa6-issue435-baseline2-test.log 2>&1; echo "PRE_TEST_EXIT:$?"
restore
ls packages/vfsl/test/ | grep -c '^issue-435'
echo "=== POST-CONTRACT (contract/control/test-d in place) $(date -u +%FT%TZ) ==="
echo "--- pnpm typecheck ---"
pnpm typecheck > artifacts/sa6-issue435-post-typecheck.log 2>&1; echo "POST_TYPECHECK_EXIT:$?"
echo "--- pnpm test ---"
pnpm test > artifacts/sa6-issue435-post-test.log 2>&1; echo "POST_TEST_EXIT:$?"
