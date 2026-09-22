#!/usr/bin/env bash
# SA6 CI-repair NEGATIVE CONTROL (mutation sensitivity): prove the repaired #423 suites
# still bind real runtime behavior — a one-line semantic mutation of the internal splice
# seam (dropping the `accounting` passthrough that the seam contract carries) must turn
# them red. Temporary, self-reversed (git restore --source=HEAD).
set -u
OUT=artifacts/sa6-issue420-ci-repair
SRC=packages/ws-replication/src/hub-session.ts
F1=packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts
F2=packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts

echo "HEAD=$(git rev-parse HEAD)" | tee "$OUT/09-mutation-driver.log"
sha256sum "$SRC" > "$OUT/09-mutation-sha256-before.log"
{
  echo "# tracked-file status before mutation (expect empty):"
  git status --porcelain --untracked-files=no
} > "$OUT/09-mutation-preconditions.log" 2>&1
cat "$OUT/09-mutation-preconditions.log" | tee -a "$OUT/09-mutation-driver.log"

# mutation: drop the accounting passthrough at the sink's seam-facing data sender
perl -0pi -e "s/this\.sendData\(namespaceId, bytes, accounting\)/this.sendData(namespaceId, bytes, undefined)/" "$SRC"
echo "# mutated line:" | tee -a "$OUT/09-mutation-driver.log"
grep -n "this.sendData(namespaceId, bytes, undefined)" "$SRC" | tee -a "$OUT/09-mutation-driver.log"

NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run "$F1" "$F2" --typecheck.enabled=false --passWithNoTests=false > "$OUT/09-mutation-focused.log" 2>&1
echo "MUTATION_FOCUSED_EXIT=$?" | tee -a "$OUT/09-mutation-driver.log"
echo "MUTATION_FAILED_CASES=$(grep -c '^ FAIL' "$OUT/09-mutation-focused.log")" | tee -a "$OUT/09-mutation-driver.log"

git restore --source=HEAD --worktree -- "$SRC"
sha256sum "$SRC" > "$OUT/09-mutation-sha256-restored.log"
{
  echo "# sha256 comparison before vs restored (expect identical):"
  diff "$OUT/09-mutation-sha256-before.log" "$OUT/09-mutation-sha256-restored.log" && echo "SHA256_IDENTICAL"
  echo "# tracked-file status after restore (expect empty):"
  git status --porcelain --untracked-files=no
  echo "# stale binding re-verified absent in production tree:"
  grep -c "sendData(namespaceId, bytes, accounting)" "$SRC"
} > "$OUT/09-mutation-restore-check.log" 2>&1
cat "$OUT/09-mutation-restore-check.log" | tee -a "$OUT/09-mutation-driver.log"
echo "MUTATION_HARNESS_DONE"
