#!/usr/bin/env bash
# SA6 CI-repair RED proof (issue #420 / PR #429).
#
# Controlled experiment: hold the tree at the repaired head (production bytes provably
# identical to the CI-failing head 3f470fb) and restore ONLY the two #423 consumer test
# files to their pre-repair bytes. The red is thereby attributable exactly to the stale
# internal-splice import binding, not to any environment/fixture difference.
#
# Side effect is temporary and self-reversed (git restore --source=HEAD). Tracked-file
# cleanliness is re-verified at the end.
set -u
OUT=artifacts/sa6-issue420-ci-repair
F1=packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts
F2=packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts

echo "HEAD=$(git rev-parse HEAD)" | tee "$OUT/07-red-driver.log"

echo "### preconditions" | tee -a "$OUT/07-red-driver.log"
{
  echo "# tracked-file worktree status before swap (expect empty):"
  git status --porcelain --untracked-files=no
  echo "# production tree diff 3f470fb..HEAD (expect empty => only the consumer files move):"
  git diff --stat 3f470fb HEAD -- packages/ws-replication/src packages/ws-replication/test/issue420-shim-hub.ts docs CONTEXT.md .github scripts package.json vitest.config.ts
  echo "# tracked diff 3f470fb..HEAD (expect the 2 consumer files only):"
  git diff --name-only 3f470fb HEAD -- packages/
} > "$OUT/07-red-preconditions.log" 2>&1
cat "$OUT/07-red-preconditions.log" | tee -a "$OUT/07-red-driver.log"

echo "### swap consumer files to 3f470fb bytes" | tee -a "$OUT/07-red-driver.log"
sha256sum "$F1" "$F2" > "$OUT/07-red-sha256-head-before.log"
git restore --source=3f470fb --worktree -- "$F1" "$F2"
sha256sum "$F1" "$F2" > "$OUT/07-red-sha256-3f470fb.log"
for f in "$F1" "$F2"; do
  if diff -q <(git show "3f470fb:$f") "$f" > /dev/null; then echo "SWAP_OK $f"; else echo "SWAP_FAIL $f"; fi
done | tee -a "$OUT/07-red-driver.log"

echo "### red 1: package typecheck (tsconfig include = src+test)" | tee -a "$OUT/07-red-driver.log"
pnpm exec tsc -p packages/ws-replication/tsconfig.json > "$OUT/07-red-prefix-package-tsc.log" 2>&1
echo "PREFIX_PACKAGE_TSC_EXIT=$?" | tee -a "$OUT/07-red-driver.log"

echo "### red 2: root pnpm typecheck (CI typecheck job, verbatim)" | tee -a "$OUT/07-red-driver.log"
pnpm typecheck > "$OUT/07-red-prefix-root-typecheck.log" 2>&1
echo "PREFIX_ROOT_TYPECHECK_EXIT=$?" | tee -a "$OUT/07-red-driver.log"

echo "### red 3: focused vitest on the two consumer files (CI shard command form)" | tee -a "$OUT/07-red-driver.log"
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run "$F1" "$F2" --typecheck.enabled=false --passWithNoTests=false > "$OUT/07-red-prefix-focused.log" 2>&1
echo "PREFIX_FOCUSED_EXIT=$?" | tee -a "$OUT/07-red-driver.log"
echo "PREFIX_FOCUSED_TYPEERROR_COUNT=$(grep -c 'TypeError: (0 , createHubSessionHost) is not a function' "$OUT/07-red-prefix-focused.log")" | tee -a "$OUT/07-red-driver.log"

echo "### restore HEAD bytes" | tee -a "$OUT/07-red-driver.log"
git restore --source=HEAD --worktree -- "$F1" "$F2"
sha256sum "$F1" "$F2" > "$OUT/07-red-sha256-restored.log"
{
  echo "# sha256 comparison head-before vs restored (expect identical):"
  diff "$OUT/07-red-sha256-head-before.log" "$OUT/07-red-sha256-restored.log" && echo "SHA256_IDENTICAL"
  echo "# tracked-file worktree status after restore (expect empty):"
  git status --porcelain --untracked-files=no
} > "$OUT/07-red-restore-check.log" 2>&1
cat "$OUT/07-red-restore-check.log" | tee -a "$OUT/07-red-driver.log"
echo "RED_HARNESS_DONE"
