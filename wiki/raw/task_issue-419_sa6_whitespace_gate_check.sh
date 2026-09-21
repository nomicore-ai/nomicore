#!/usr/bin/env bash
# SA6 / issue #419 -- evidence-contract conflict: registered original bytes vs the mandatory
# Controller staging gate `git diff --cached --check`.
#
# CONFLICT (reproduced in sections 0-2):
#   SA6 contract section 17 originally registered artifacts/sa6-issue419-runner-trigger.log over its
#   raw tool-emitted bytes (sha256 96abbb72..., 70 lines / 4322 bytes, last two bytes `\n\n`).
#   SA9 section 3-F1 (MAJOR) ordered those bytes restored (fix path 1); SA3 restored them from the
#   dangling object-store blob c183ba29... . The Controller's mandatory gate now rejects that exact
#   registered original as `new blank line at EOF` (Git rule blank-at-eof), so fix path 1 is not
#   stageable. A second, independent finding sits on the same staged changeset:
#   artifacts/sa3-issue419-f1-evidence-restore.log:20 (a trailing space, rule blank-at-eol), which
#   also violates the repo's committed .editorconfig ([*] trim_trailing_whitespace = true).
#   Both named fallbacks -- SA3 f1 log section 8 (R1/R2) and SA8 section 7-2 -- are: SA6/Controller
#   re-register the canonical-form hash in section 17, with a written explanation.
#
# CANONICAL FORM C1 (defined by the repo's own committed policy, not by this script):
#   .editorconfig [*]: end_of_line = lf, insert_final_newline = true, trim_trailing_whitespace = true
#   Controller gate:   Git whitespace rules blank-at-eol + blank-at-eof (both enabled by default)
#   => no trailing space/tab before any LF, no trailing space/tab at EOF, exactly one final LF.
#   Section 17 hashes are registered over C1. Non-C1 raw observations are recorded as superseded.
#
# Read-only by default: reproduces the red gate, discriminates the fired rules, derives
# canonical(asset) for the two artifacts, proves the full staged changeset turns green on a PRIVATE
# COPY of the index, and documents the Controller repair path. It never writes the real index, the
# worktree artifacts or any tracked file (the only object-store write is the idempotent
# content-addressed blob of the canonical f1 log, needed to exercise staging on the private index).
#
#   (default)      read-only diagnosis + verification
#   --log FILE     same, writing a gate-clean evidence log to FILE (trailing whitespace inside
#                  reported output is replaced in place by ASCII {SP}/{TAB} tokens; the log is
#                  verified byte-exact canonical before exit)
#   --registry     section 17 registry cross-check against computed bytes (read-only)
#   --apply        CONTROLLER ACTION (SA6 does not execute it): write canonical bytes for the two
#                  artifacts and stage exactly those two paths; aborts unless the post-state hashes
#                  equal the section 17 registrations and the gate is green.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$REPO_ROOT" || exit 2

RUNNER=artifacts/sa6-issue419-runner-trigger.log
F1LOG=artifacts/sa3-issue419-f1-evidence-restore.log
CONTRACT=wiki/raw/task_issue-419_sa6_contract.md
SCRIPT=wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh
EVLOG=artifacts/sa6-issue419-eof-gate-conflict.log
SCRATCH="$REPO_ROOT/.scratch/sa6-419-gate"
IDX="$(git rev-parse --git-path index)"
case "$IDX" in /*) ;; *) IDX="$REPO_ROOT/$IDX" ;; esac

# Legacy (superseded) registrations = the raw bytes SA3 restored.
REG_RUNNER_RAW=96abbb72ecefdc3ad2b37bc8cfcdbb011e7c43b409c0b5f130c7a3e7a1b2e06c
REG_F1_RAW=2932f2a773a4c0a6a30432983685b613bb51a16504fd61f9e376167002d974a3
# Canonical (C1) registrations recorded in section 17 by this SA6 amendment.
REG_RUNNER_C1=23787bf1a40c183b69c9903a4c26cedb0737b391f490fb5eb9156f361bfed372
REG_F1_C1=3b861d2dc34eff92686d52d29e746acade673831769ca9226fd5835304b45c15
BLOB_RUNNER_C1=46ff267d3451c22147b759002aee3345d09871a9
BLOB_F1_C1=0996a3249e81f201f57aafb8278f5a4e4b11948c
BLOB_RUNNER_RAW=c183ba296bbb886931b1b2adc2e24d4f930f0d7a

MODE=report
LOG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --log) LOG="${2:-}"; shift 2 ;;
    --registry) MODE=registry; shift ;;
    --apply) MODE=apply; shift ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
hr() { say '----------------------------------------------------------------'; }
run() { say "\$ $*"; "$@"; }
canon() { perl -0pe 's/[ \t]+(?=\n)//g; s/[ \t]+\z//; s/\n*\z/\n/' "$1"; }
sha() { sha256sum "$1" | cut -d' ' -f1; }
blob() { git hash-object "$1"; }
# Report gate output with real trailing whitespace replaced in place by ASCII {SP}/{TAB} tokens, so
# this evidence log can never itself carry a blank-at-eol defect.
esc_ws() { perl -pe 's{([ \t]+)$}{ my $w=$1; $w =~ s/\t/{TAB}/g; $w =~ s/ /{SP}/g; $w }e'; }
# gate_out <index-file|-> [path...]
gate_out() {
  local idxf="$1"; shift
  local out rc
  if [[ "$idxf" == "-" ]]; then
    out="$(git diff --cached --check -- "$@" 2>&1)"; rc=$?
  else
    out="$(GIT_INDEX_FILE="$idxf" git diff --cached --check -- "$@" 2>&1)"; rc=$?
  fi
  if [[ -n "$out" ]]; then printf '%s\n' "$out" | esc_ws; fi
  printf 'GATE_RC=%s\n' "$rc"
  return 0
}

report() {
hr
say 'SA6 issue #419 -- registered bytes vs staging gate: repro + repair verification'
say 'C1 = .editorconfig [*] {end_of_line=lf, insert_final_newline=true, trim_trailing_whitespace=true}'
say '     + Git gate rules {blank-at-eol, blank-at-eof}; section 17 hashes are registered over C1.'
say 'Owner comment REST snapshot = [] (empty; per dispatch) -- no owner requirements, comment IDs or'
say 'timestamps exist to incorporate.'
say "worktree=$REPO_ROOT"
say "HEAD=$(git rev-parse HEAD)  git=$(git --version | cut -d' ' -f3)"
hr
say 'SECTION 0 -- staged changeset and the red gate (real index, read-only)'
run git status --porcelain -uall
say '$ git diff --cached --check'
gate_out -
say '# Finding set is exactly 2, one per artifact; the rest of the staged changeset is clean:'
say '$ git diff --cached --check -- wiki/'
gate_out - wiki/
hr
say 'SECTION 1 -- byte facts for the two staged artifacts'
say "\$ sha256sum $RUNNER $F1LOG"
sha256sum "$RUNNER" "$F1LOG"
say "\$ wc -l -c $RUNNER $F1LOG"
wc -l -c "$RUNNER" "$F1LOG"
say "\$ git hash-object $RUNNER $F1LOG"
blob "$RUNNER"; blob "$F1LOG"
say '$ git cat-file -s HEAD:<runner> ; git show HEAD:<runner> | sha256sum ; git show HEAD:<runner> | wc -l -c'
git cat-file -s "HEAD:$RUNNER"
git show "HEAD:$RUNNER" | sha256sum
git show "HEAD:$RUNNER" | wc -l -c
say '$ git rev-parse HEAD:<runner>   # committed blob: the drift-free, gate-clean form'
git rev-parse "HEAD:$RUNNER"
say '$ tail -c 12 <runner> | od -c   # last bytes are ...s) LF LF => blank line 70 at EOF'
tail -c 12 "$RUNNER" | od -c
say '$ sed -n 20p <f1log> | od -c   # line 20 is <, SPACE, LF => trailing space (blank-at-eol)'
sed -n '20p' "$F1LOG" | od -c
say '$ grep -c CR <runner> <f1log>   # 0 0: end_of_line=lf holds, no CR bytes'
grep -c $'\r' "$RUNNER" "$F1LOG"
hr
say 'SECTION 2 -- rule discrimination (which gate rule fires; can the gate be silenced?)'
say '$ git -c core.whitespace=-blank-at-eof diff --cached --check'
say '# => only the f1 trailing-space finding survives: blank-at-eof rejects the registered original'
out="$(git -c core.whitespace=-blank-at-eof diff --cached --check 2>&1)"; rc=$?
if [[ -n "$out" ]]; then printf '%s\n' "$out" | esc_ws; fi
say "GATE_RC=$rc"
say '$ git -c core.whitespace=-blank-at-eol diff --cached --check'
say '# => only the EOF blank-line finding survives: blank-at-eol rejects the f1 log line 20'
out="$(git -c core.whitespace=-blank-at-eol diff --cached --check 2>&1)"; rc=$?
if [[ -n "$out" ]]; then printf '%s\n' "$out" | esc_ws; fi
say "GATE_RC=$rc"
say '$ git -c core.whitespace=-blank-at-eol,-blank-at-eof diff --cached --check'
say '# Path B1 (silence the rules via config): green without touching any byte. REJECTED: it tampers'
say '# with the mandatory gate, contradicts committed .editorconfig, and leaves section 17 demanding'
say '# bytes that can never be committed.'
out="$(git -c core.whitespace=-blank-at-eol,-blank-at-eof diff --cached --check 2>&1)"; rc=$?
if [[ -n "$out" ]]; then printf '%s\n' "$out"; fi
say "GATE_RC=$rc"
printf 'artifacts/** whitespace=-blank-at-eol,-blank-at-eof\n' > "$SCRATCH/attrs.probe"
say '$ git -c core.attributesFile=<probe> diff --cached --check'
say '# Path B2 (per-path exemption via .gitattributes): same silencing, same rejection (needs design'
say '# authority; would blind the gate over every future artifacts/ change).'
out="$(git -c core.attributesFile="$SCRATCH/attrs.probe" diff --cached --check 2>&1)"; rc=$?
if [[ -n "$out" ]]; then printf '%s\n' "$out"; fi
say "GATE_RC=$rc"
say '# No override exists in the live repo:'
say "core.whitespace_set=$(git config --get core.whitespace >/dev/null 2>&1 && echo yes || echo no)  tracked_gitattributes=$(git ls-files .gitattributes | wc -l)  tracked_editorconfig=$(git ls-files .editorconfig | wc -l)"
hr
say 'SECTION 3 -- canonical form C1 applied to the two artifacts (byte-exact deltas)'
canon "$RUNNER" > "$SCRATCH/canon-runner.log"
canon "$F1LOG" > "$SCRATCH/canon-f1.log"
say "canon(<runner>) sha256=$(sha "$SCRATCH/canon-runner.log") lines=$(wc -l < "$SCRATCH/canon-runner.log") bytes=$(wc -c < "$SCRATCH/canon-runner.log") blob=$(blob "$SCRATCH/canon-runner.log")"
say "  registered C1 hash MATCH: $([[ "$(sha "$SCRATCH/canon-runner.log")" == "$REG_RUNNER_C1" ]] && echo YES || echo NO)"
say "  equals committed HEAD blob bytes: $(cmp -s "$SCRATCH/canon-runner.log" <(git cat-file blob "$BLOB_RUNNER_C1") && echo YES || echo NO)"
say "\$ diff $RUNNER <canon-runner>"
diff "$RUNNER" "$SCRATCH/canon-runner.log" | esc_ws
say '# => exactly one deleted line 70 (empty): the single final LF; no content byte changes'
say "  whitespace-stripped content sha256, raw vs C1: $(tr -d '[:space:]' < "$RUNNER" | sha256sum | cut -d' ' -f1) / $(tr -d '[:space:]' < "$SCRATCH/canon-runner.log" | sha256sum | cut -d' ' -f1)"
say "  legacy raw registration (superseded): $REG_RUNNER_RAW (70 lines/4322 bytes, blob $BLOB_RUNNER_RAW)"
say "canon(<f1log>)  sha256=$(sha "$SCRATCH/canon-f1.log") lines=$(wc -l < "$SCRATCH/canon-f1.log") bytes=$(wc -c < "$SCRATCH/canon-f1.log") blob=$(blob "$SCRATCH/canon-f1.log")"
say "  registered C1 hash MATCH: $([[ "$(sha "$SCRATCH/canon-f1.log")" == "$REG_F1_C1" ]] && echo YES || echo NO)"
say "\$ diff $F1LOG <canon-f1>"
diff "$F1LOG" "$SCRATCH/canon-f1.log" | esc_ws
say '# => exactly one changed line 20: < SPACE becomes < ; line count unchanged, -1 byte'
say "  byte delta: $(perl -e 'local $/; my $a=<>; my $b=<>; my $i=0; $i++ while $i<length($b) && substr($a,$i,1) eq substr($b,$i,1); printf "first_diff_offset_0based=%d orig_byte=0x%02x suffix_identical=%s", $i, ord(substr($a,$i,1)), (substr($a,$i+1) eq substr($b,$i) ? "YES":"NO");' "$F1LOG" "$SCRATCH/canon-f1.log")"
say "  whitespace-stripped content sha256, raw vs C1: $(tr -d '[:space:]' < "$F1LOG" | sha256sum | cut -d' ' -f1) / $(tr -d '[:space:]' < "$SCRATCH/canon-f1.log" | sha256sum | cut -d' ' -f1)"
say "  legacy raw registration (superseded): $REG_F1_RAW (221 lines/15421 bytes)"
hr
say 'SECTION 4 -- negative controls and mutation sensitivity'
say '$ git diff --no-index --check /dev/null <canonical candidate>   # silent; rc 1 = bytes differ'
git diff --no-index --check /dev/null "$SCRATCH/canon-runner.log" >/dev/null 2>&1; say "  canon-runner.log rc=$? (silent)"
git diff --no-index --check /dev/null "$SCRATCH/canon-f1.log" >/dev/null 2>&1; say "  canon-f1.log     rc=$? (silent)"
say '# NC1: other section 17 assets are already canonical, i.e. the C1 rule does not blanket-fail logs'
for f in artifacts/sa6-issue419-probe-green.log artifacts/sa6-issue419-mutation-sensitivity.log artifacts/sa6-issue419-capability-gap.log artifacts/sa6-issue419-package-tsc-baseline.log; do
  say "  $f canonical=$([[ "$(sha "$f")" == "$(canon "$f" | sha256sum | cut -d' ' -f1)" ]] && echo YES || echo NO) sha256=$(sha "$f")"
done
say '# MC1: canonical(runner) + one final LF must re-trip blank-at-eof'
cp "$SCRATCH/canon-runner.log" "$SCRATCH/mut-runner.log"; printf '\n' >> "$SCRATCH/mut-runner.log"
out="$(git diff --no-index --check /dev/null "$SCRATCH/mut-runner.log" 2>&1)"; rc=$?
if [[ -n "$out" ]]; then printf '%s\n' "$out"; fi
say "  MUTATION_RC=$rc sha256=$(sha "$SCRATCH/mut-runner.log")"
say '# MC2: canonical(f1) + the one removed space must re-trip blank-at-eol and restore the raw bytes'
perl -e 'local $/; my $b=<>; substr($b,1330,0)=" "; print $b' "$SCRATCH/canon-f1.log" > "$SCRATCH/mut-f1.log"
out="$(git diff --no-index --check /dev/null "$SCRATCH/mut-f1.log" 2>&1)"; rc=$?
if [[ -n "$out" ]]; then printf '%s\n' "$out" | esc_ws; fi
say "  MUTATION_RC=$rc sha256=$(sha "$SCRATCH/mut-f1.log") re-trip_equals_registered_raw=$([[ "$(sha "$SCRATCH/mut-f1.log")" == "$REG_F1_RAW" ]] && echo YES || echo NO)"
say '# => the gate assertion is sensitive to exactly the two bytes under repair, and the repair is minimal'
hr
say 'SECTION 5 -- full staged changeset turns green on a PRIVATE COPY of the index'
say "real index = $IDX (sha256=$(sha "$IDX"))"
cp "$IDX" "$SCRATCH/index.control"
say "\$ GIT_INDEX_FILE=<copy> git diff --cached --check   # faithfulness control: must stay red"
gate_out "$SCRATCH/index.control"
cp "$IDX" "$SCRATCH/index.canonical"
say "\$ git hash-object -w <canon-f1>   # idempotent content-addressed blob $BLOB_F1_C1"
git hash-object -w "$SCRATCH/canon-f1.log"
say "\$ GIT_INDEX_FILE=<copy> git update-index --add --cacheinfo 100644,$BLOB_RUNNER_C1,$RUNNER"
GIT_INDEX_FILE="$SCRATCH/index.canonical" git update-index --add --cacheinfo "100644,$BLOB_RUNNER_C1,$RUNNER"; say "update_rc=$?"
say "\$ GIT_INDEX_FILE=<copy> git update-index --add --cacheinfo 100644,$BLOB_F1_C1,$F1LOG"
GIT_INDEX_FILE="$SCRATCH/index.canonical" git update-index --add --cacheinfo "100644,$BLOB_F1_C1,$F1LOG"; say "update_rc=$?"
say '$ GIT_INDEX_FILE=<copy> git diff --cached --check   # the mandatory gate, repaired'
gate_out "$SCRATCH/index.canonical"
say '$ GIT_INDEX_FILE=<copy> git diff --cached --stat'
GIT_INDEX_FILE="$SCRATCH/index.canonical" git diff --cached --stat
say '$ GIT_INDEX_FILE=<copy> git ls-files -s -- <both artifacts>'
GIT_INDEX_FILE="$SCRATCH/index.canonical" git ls-files -s -- "$RUNNER" "$F1LOG"
say '# => after the repair the commit no longer touches runner-trigger.log at all (C1 bytes == HEAD'
say '#    bytes); the f1 log enters in its C1 form. Real index untouched:'
say "real index sha256 after all work = $(sha "$IDX")  (unchanged => this evidence is non-mutating)"
hr
say 'SECTION 6 -- repair path (Controller actions)'
say 'R1  git restore --source=HEAD --staged --worktree -- artifacts/sa6-issue419-runner-trigger.log'
say "    # writes C1 bytes = committed HEAD blob $BLOB_RUNNER_C1 / sha256 $REG_RUNNER_C1 (69 lines/4321 B)"
say 'R2  perl -0pe s/[ \t]+(?=\n)//g;s/[ \t]+\z//;s/\n*\z/\n/ artifacts/sa3-issue419-f1-evidence-restore.log'
say '    # -1 byte at 0-based offset 1330 (line 20 "< " -> "<") => sha256 '"$REG_F1_C1"' (221 lines/15420 B)'
say '    git add -- artifacts/sa3-issue419-f1-evidence-restore.log'
say "R3  git add -- $CONTRACT $SCRIPT $EVLOG"
say "    # registry amendment + this script + this evidence log (log sha256 recorded in section 17)"
say 'R4  git diff --cached --check   # expect rc=0, no output (proved above on the private index copy)'
say "R5  post-commit: git show HEAD:$RUNNER | sha256sum == $REG_RUNNER_C1"
say '    # supersedes the legacy expectation 96abbb72... in SA3 f1 log section 8/R1 and SA8 section 7-2'
say "R6  optional one-shot execution: bash $SCRIPT --apply"
hr
say 'INFERRED (not proven): the committed copy drifted (HEAD blob 46ff267d...) via a commit-time EOF'
say 'canonicalizer; no such tool is observable from this worktree. PROVEN: HEAD bytes = registered raw'
say 'bytes minus exactly one final LF, with all 69 content lines byte-identical.'
say 'REJECTED ALTERNATIVES: B1 config silencing and B2 .gitattributes exemption (section 2); B3 excluding'
say 'the asset from the commit (loses a registered evidence asset, leaves a dirty tree); B4/B5 accepting a'
say 'red gate or keeping the raw hash authoritative (blocks the mandatory gate); B6 normalizing without'
say 're-registration (exactly the SA9 section 3-F1 defect).'
hr
say 'RESULT: red gate reproduced (2 findings / 2 rules); C1 derived and proved minimal (runner -1 LF,'
say 'f1 -1 space); C1 candidates gate-clean; full staged changeset green on the private index copy;'
say 'real index and worktree artifacts untouched.'
hr
}

registry() {
hr
say 'REGISTRY CHECK -- section 17 rows vs computed bytes (read-only; C1 = canonical form)'
say "worktree=$REPO_ROOT HEAD=$(git rev-parse HEAD)"
row() {
  local p="$1" exp="$2" got can stat
  if [[ ! -f "$p" ]]; then printf 'MISSING   %s\n' "$p"; return; fi
  got="$(sha "$p")"; can="$(canon "$p" | sha256sum | cut -d' ' -f1)"
  if [[ "$got" == "$can" ]]; then stat=canonical; else stat=NON-CANONICAL; fi
  printf '%-58s %s sha256=%s registry=%s %s\n' "$p" "$stat" "$got" "${exp:-<none>}" "$([[ "$got" == "$exp" ]] && echo MATCH || echo 'MISMATCH (expected only until R1/R2)')"
}
row wiki/raw/task_issue-419_sa6_route_key_probe.mts b340dcd37681d9a5499d82647e9536de637addb1994baca0a874165d843e1407
row wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts 3631b43f29f3471bac6a8ea34cd74cfecd70af14e2a54b535b160132f4da0e19
row artifacts/sa6-issue419-probe-green.log 1960c24a7011331f24f5c9ebb5f6951b17d2787b9dd3bddcb1edd5ffb5a1560a
row artifacts/sa6-issue419-mutation-sensitivity.log c8f67f9bdf7d59211be5264950452713ca4844a111a7f9d0a6952089678accc8
row artifacts/sa6-issue419-capability-gap.log b054b3c022cd7c5383c59980ab1a0fa93262e863459ed71c9b3b96edab63a175
row artifacts/sa6-issue419-package-tsc-baseline.log 1f23a7a0ed185aeb2df7f0ac660dcc430854e38ceaa9d9d68eecba038a5b24a4
say "-- runner-trigger.log: registry is over C1 (canonical projection of the working tree)"
say "   C1        sha256=$(canon "$RUNNER" | sha256sum | cut -d' ' -f1) registry=$REG_RUNNER_C1 $([[ "$(canon "$RUNNER" | sha256sum | cut -d' ' -f1)" == "$REG_RUNNER_C1" ]] && echo MATCH || echo MISMATCH)"
say "   HEAD blob $(git rev-parse "HEAD:$RUNNER") sha256=$(git show "HEAD:$RUNNER" | sha256sum | cut -d' ' -f1) (committed bytes == C1: $([[ "$(git show "HEAD:$RUNNER" | sha256sum | cut -d' ' -f1)" == "$REG_RUNNER_C1" ]] && echo YES || echo NO))"
say "   working-tree sha256=$(sha "$RUNNER") = superseded raw registration $REG_RUNNER_RAW $([[ "$(sha "$RUNNER")" == "$REG_RUNNER_RAW" ]] && echo MATCH || echo MISMATCH)"
say "-- f1 log: registry is over C1"
say "   C1        sha256=$(canon "$F1LOG" | sha256sum | cut -d' ' -f1) registry=$REG_F1_C1 $([[ "$(canon "$F1LOG" | sha256sum | cut -d' ' -f1)" == "$REG_F1_C1" ]] && echo MATCH || echo MISMATCH)"
say "   working-tree sha256=$(sha "$F1LOG") = superseded raw registration $REG_F1_RAW $([[ "$(sha "$F1LOG")" == "$REG_F1_RAW" ]] && echo MATCH || echo MISMATCH)"
row "$SCRIPT" "$(sha "$SCRIPT")"
row "$EVLOG" "$(sha "$EVLOG")"
say "-- git blob entries for the canonical forms"
say "   $BLOB_RUNNER_C1 $RUNNER (C1)   $BLOB_F1_C1 $F1LOG (C1)"
hr
}

if [[ "$MODE" == registry ]]; then
  registry
  exit 0
fi

if [[ "$MODE" == apply ]]; then
  say 'MODE=apply -- Controller action; SA6 does not execute this mode'
  mkdir -p "$SCRATCH"
  git restore --source=HEAD --staged --worktree -- "$RUNNER" || exit 3
  canon "$F1LOG" > "$SCRATCH/canon-f1.log" || exit 3
  cat "$SCRATCH/canon-f1.log" > "$F1LOG" || exit 3
  git add -- "$F1LOG" || exit 3
  say "post-apply runner sha256=$(sha "$RUNNER") (expect $REG_RUNNER_C1)"
  say "post-apply f1     sha256=$(sha "$F1LOG") (expect $REG_F1_C1)"
  if [[ "$(sha "$RUNNER")" != "$REG_RUNNER_C1" || "$(sha "$F1LOG")" != "$REG_F1_C1" ]]; then
    say 'ABORT: post-apply hash mismatch'; exit 4
  fi
  run git diff --cached --check
  gate_out -
  rm -rf "$SCRATCH"
  exit 0
fi

mkdir -p "$SCRATCH"
if [[ -n "$LOG" ]]; then
  report > "$SCRATCH/report.raw"
  rc=$?
  if [[ $rc -ne 0 ]]; then printf 'ABORT: report rc=%s\n' "$rc" >&2; rm -rf "$SCRATCH"; exit 3; fi
  perl -0pe 's/[ \t]+(?=\n)//g; s/\n*\z/\n/' "$SCRATCH/report.raw" > "$LOG"
  cmp -s "$SCRATCH/report.raw" "$LOG"; net=$?
  tws=$(grep -cP '[ \t]+$' "$LOG" || true)
  eof=$(perl -e 'local $/; my $b=<>; print $b =~ /\n\n\z/ ? 1 : 0' "$LOG")
  git diff --no-index --check /dev/null "$LOG" >/dev/null 2>&1; lrc=$?
  printf 'LOG=%s\nLOG_SHA256=%s\nLOG_LINES=%s\nLOG_BYTES=%s\nLOG_TRAILING_WS_LINES=%s\nLOG_BLANK_LINE_AT_EOF=%s\nLOG_NOINDEX_CHECK_RC=%s\nCANONICALIZATION_NET_CHANGED_BYTES=%s\n' \
    "$LOG" "$(sha "$LOG")" "$(wc -l < "$LOG")" "$(wc -c < "$LOG")" "$tws" "$eof" "$lrc" "$net" >&2
  if [[ "$tws" != 0 || "$eof" != 0 || "$lrc" != 1 || "$net" != 0 ]]; then
    printf 'ABORT: evidence log is not byte-exact gate-clean\n' >&2; rm -rf "$SCRATCH"; exit 5
  fi
else
  report
fi
rm -rf "$SCRATCH"
if [[ -d "$SCRATCH" ]]; then say 'ABORT: scratch not removed'; exit 6; fi
exit 0
