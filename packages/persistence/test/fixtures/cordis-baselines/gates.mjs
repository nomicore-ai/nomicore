#!/usr/bin/env node
/**
 * Mechanical repository-shape gates for issue #470 (design §15, R7 + RA-2).
 *
 *   G1' manifest / lockfile / artifacts: outside the 8-file release allowlist
 *       (PV-2) the original zero-diff semantics stand; the allowlisted files are a
 *       controlled opening whose line-level shape is adjudicated by G13 alone
 *   G2  persistence / dsh-persistence / namespace-registry src allowlist
 *   G3  ws-replication: tracked changes ⊆ {package.json} (its version line is
 *       adjudicated by G13) ∧ untracked ⊆ the four named fixture files; plugin.ts
 *       and the four named fixtures themselves stay zero-diff
 *   G4  public entry files zero-diff
 *   G5  public surface snapshot: capture at BASE and compare with the tracked
 *       snapshot, then run the runtime surface test in the default layout
 *   G6  `git diff --check` clean and `git status --porcelain artifacts/` empty
 *   G7  docs/ (incl. docs/adr/) zero-diff
 *   G8  production src has no baseline/channel environment branch
 *   G9  tsconfig / vitest.config zero-diff (R1 anti-masking)
 *   G10 legacy Root direct-read scan (A5-1)
 *   G11 forbidden volatile/internal API scan (A9-1)
 *   G12 facility directory allowlist (T-3)
 *   G13 release batch audit — two-state: `absent` (clean pre-release tree, C1) or
 *       `exact` (release candidate `R`); any other shape is red (#472 design §7.3)
 *
 * IMPORTANT — comparison direction. The design writes G2/G3 as `$BASE..HEAD`.
 * In this worktree the implementation changes are *uncommitted* (the Controller
 * stages/commits them later), so `$BASE..HEAD` would be vacuously empty and the
 * gate would silently pass. Every gate here therefore compares BASE against the
 * **working tree** (`git diff --name-only <BASE> -- <paths>`) and additionally
 * reports untracked files (`git ls-files --others --exclude-standard`), which is
 * a strict superset of the committed-range check: zero-diff obligations are not
 * relaxed, they are enforced one step earlier.
 *
 * Exit 0 = every gate passed. Exit 1 = at least one gate failed (the gate id and
 * the offending paths are printed). Exit 2 = the gate harness itself could not
 * run (e.g. the base snapshot worktree is stale).
 *
 * Modes:
 *   node gates.mjs                       # run all gates
 *   node gates.mjs --write-surface-snapshot  # (re)capture public-surface.base.json
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../../../..')
/**
 * PV-1 (#472 design §7.1): the canonical BASE for every diff/gate. Re-pinned from
 * `d59a4d1` (#470) to the #472 base so the audit surface contains exactly this
 * ticket's diff. `baselines.json`'s `base` field stays at `d59a4d1` as the #470
 * fixture provenance record and is frozen byte-for-byte by G13.f — this constant
 * is the single normative BASE (SA2-10: no second pinned string).
 */
const BASE = '6be891a3a0cb32fe21c3a6bf485f33428052ce7b'
const SURFACE_SNAPSHOT = path.join(HERE, 'public-surface.base.json')
const BASE_WORKTREE = path.join(REPO, '.worktrees/base-snapshot')
/**
 * PV-7 (#472 design §8, option A): the public entry surface is 7 entries — the
 * same set #471's SA10 recorded (`ws-replication/testing`, `clock`,
 * `namespace-registry` were missing from the #471 snapshot/test files).
 */
const PUBLIC_ENTRIES = [
  ['@nomicore/persistence', 'packages/persistence/src/index.ts'],
  ['@nomicore/persistence/testing', 'packages/persistence/src/testing.ts'],
  ['@nomicore/dsh-persistence', 'packages/dsh-persistence/src/index.ts'],
  ['@nomicore/ws-replication', 'packages/ws-replication/src/index.ts'],
  ['@nomicore/ws-replication/testing', 'packages/ws-replication/src/testing.ts'],
  ['@nomicore/clock', 'packages/clock/src/index.ts'],
  ['@nomicore/namespace-registry', 'packages/namespace-registry/src/index.ts'],
]
// G3 (design F-7): the only ws-replication paths that may differ from BASE are the four
// new test files. `plugin.ts` and the four named fixtures are zero-diff (D-5 anti-regression).
const WS_ALLOW_NEW_FILES = [
  'packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts',
  'packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts',
  'packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts',
  'packages/ws-replication/test/cordis-baseline-support.ts',
]
const FACILITY_DIR = 'packages/persistence/test/fixtures/cordis-baselines'
/**
 * G12 (T-3): only these five facility files may differ from BASE. #472 adds the
 * surface snapshot (option A recapture, design §7.5) — without the opening the
 * correct 7-entry snapshot fix would be judged red by our own gate. The
 * `baselines.json` entry is a *nominal* entry since #472: its batch-level freeze
 * is enforced by G13.f + acquire's N-5 integrity control, not by this gate
 * (PV-6 note / design §7.5). `acquire.mjs`, `root-probe.mjs` and
 * `provenance-b3.json` stay zero-diff and any new file in the directory is red.
 */
const FACILITY_ALLOW = [
  `${FACILITY_DIR}/baselines.json`,
  `${FACILITY_DIR}/run-baseline.mjs`,
  `${FACILITY_DIR}/gates.mjs`,
  `${FACILITY_DIR}/root-test-known-red.json`,
  `${FACILITY_DIR}/public-surface.base.json`,
]
/**
 * G13 (#472 design §7.3, PV-2/PV-3/PV-4/PV-8a/PV-8b): the single source of the
 * release batch shape. `base` references the same BASE constant (SA2-10: no
 * second pinned string). Ticket-level pin — re-pinned by the next release
 * ticket. `versions` maps the 7 release manifests to their `from`→`to` version
 * lines (design §6.1).
 */
const RELEASE_BATCH = {
  base: BASE,
  versions: new Map([
    ['packages/persistence/package.json', { from: '0.4.0', to: '0.5.0' }],
    ['packages/dsh-persistence/package.json', { from: '0.4.0', to: '0.5.0' }],
    ['packages/namespace-runtime/package.json', { from: '0.4.0', to: '0.5.0' }],
    ['packages/namespace-registry/package.json', { from: '0.4.0', to: '0.5.0' }],
    ['packages/namespace-api/package.json', { from: '0.3.0', to: '0.4.0' }],
    ['packages/ws-replication/package.json', { from: '0.5.0', to: '0.6.0' }],
    ['apps/yjs-server/package.json', { from: '0.5.0', to: '0.6.0' }],
  ]),
  manifest: 'artifacts/local-packages/manifest.json',
  baselines: `${FACILITY_DIR}/baselines.json`,
  frozenLedger: `${FACILITY_DIR}/root-test-known-red.json`,
  catalog: 'scripts/package-catalog.mjs',
}
/** PV-2: the exact 8-file release allowlist for G1′/G13. */
const RELEASE_FILES = [...RELEASE_BATCH.versions.keys(), RELEASE_BATCH.manifest]
/** PV-8a: the C1 facility files (this ticket's facility commit). */
const C1_FACILITY_FILES = [
  `${FACILITY_DIR}/gates.mjs`,
  `${FACILITY_DIR}/run-baseline.mjs`,
  `${FACILITY_DIR}/public-surface.base.json`,
  'packages/persistence/test/cordis-public-surface.test.ts',
]
/**
 * PV-8a tracked wiki surface — `wiki/raw/task_issue-472*.md`, mechanical verdict
 * pinned by SA8 §14.3 (iteration 3, erratum E-5): the direct parent directory must
 * be exactly `wiki/raw` AND the basename must match. A `wiki/`-root file
 * (`wiki/task_issue-472_probe.md`) or a deeper one
 * (`wiki/raw/nested/task_issue-472_probe.md`, `wiki/other/…`) is tracked-scope
 * red — the wildcard of the pinned glob only covers `wiki/raw/`'s direct children.
 */
function isTicketDoc(file) {
  const posix = file.split(path.sep).join('/')
  return path.posix.dirname(posix) === 'wiki/raw' && /^task_issue-472.*\.md$/.test(path.posix.basename(posix))
}
/** G11 (T-2 pinned empty set): no such usage may exist anywhere in production src. */
const FORBIDDEN_API_ALLOW = []
const G8_CHANNEL_PATTERN = /CORDIS_BASELINE|ROOT_CHANNEL|NOMICORE_CORDIS_|rc\.12/
const G8_ENV_PATTERN = /process\.env/
/**
 * G8 (design §7.3: scan surface = every production src tree, the apps and domains
 * src roots included; semantic judge = "no baseline/channel env branch"): the app
 * edge has exactly one legitimate configuration read in BASE
 * (`apps/yjs-server/src/main.ts` NOMICORE_CONFIG). It is pinned line-by-line instead
 * of exempting the whole apps src tree, so the exemption is auditable and any new
 * env read anywhere (including the app edge) is a hit. Channel/baseline markers are
 * NEVER allowed, not even on these two lines.
 */
const G8_ENV_LINE_ALLOW = new Set([
  'apps/yjs-server/src/main.ts:36',
  'apps/yjs-server/src/main.ts:37',
])

function fail(stage, message) {
  console.error(`[gates] FAIL <${stage}> ${message}`)
  process.exit(2)
}

function git(args, options = {}) {
  const result = execFileSync('git', args, { cwd: REPO, encoding: 'utf8', ...options })
  return typeof result === 'string' ? result : ''
}

function parseArgs(argv) {
  const options = { writeSurfaceSnapshot: false }
  for (const arg of argv) {
    if (arg === '--write-surface-snapshot') options.writeSurfaceSnapshot = true
    else fail('usage', `unknown argument ${arg}`)
  }
  return options
}

// ---------------------------------------------------------------- path helpers

function listManifests() {
  const manifests = ['package.json']
  for (const top of ['packages', 'apps', 'domains']) {
    const dir = path.join(REPO, top)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      const manifest = path.join(dir, name, 'package.json')
      if (fs.existsSync(manifest)) manifests.push(path.relative(REPO, manifest))
    }
  }
  return manifests
}

function listTsconfigs() {
  const configs = ['tsconfig.base.json', 'tsconfig.typecheck.json', 'vitest.config.ts']
  for (const top of ['packages', 'apps', 'domains']) {
    const dir = path.join(REPO, top)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      for (const file of ['tsconfig.json', 'tsconfig.build.json', 'vitest.config.ts']) {
        const config = path.join(dir, name, file)
        if (fs.existsSync(config)) configs.push(path.relative(REPO, config))
      }
    }
  }
  return configs
}

/**
 * Changed tracked paths vs BASE plus untracked files under the same pathspec.
 *
 * #472 single-primitive discipline (design §7.3.g, SA2-13): every diff used for
 * allowlist/changeset adjudication carries `--no-renames`, so a rename is always
 * "old path deleted + new path added" (two records) and can never fold the
 * deletion of an out-of-allowlist path into a single allowed new path. The
 * pathspec-limited gates were already immune (a rename whose old path is outside
 * the pathspec cannot pair, and the four `WS_ALLOW_NEW_FILES` entries are
 * tracked at BASE, not add candidates — SA2-18), but the flag makes the
 * discipline uniform instead of relying on that accident.
 */
function changedPaths(pathspec) {
  const tracked = git(['diff', '--no-renames', '--name-only', BASE, '--', ...pathspec])
    .split('\n')
    .filter(Boolean)
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...pathspec])
    .split('\n')
    .filter(Boolean)
  return [...new Set([...tracked, ...untracked])].sort()
}

/** Whole-tree tracked changeset vs BASE — never a pathspec variant (G13.g). */
function wholeTreeChangedPaths() {
  return git(['diff', '--no-renames', '--name-only', BASE]).split('\n').filter(Boolean).sort()
}

/** `git status --porcelain` untracked entries (NUL-safe, all files, no dir collapse). */
function untrackedPaths() {
  const raw = git(['status', '--porcelain=v1', '--untracked-files=all', '-z'])
  return raw
    .split('\0')
    .filter(Boolean)
    .filter((entry) => entry.startsWith('?? '))
    .map((entry) => entry.slice(3))
    .sort()
}

/** Raw bytes of a BASE blob (byte comparison never goes through rename detection). */
function baseBlob(file) {
  return execFileSync('git', ['show', `${BASE}:${file}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 })
}

function workBlob(file) {
  return fs.readFileSync(path.join(REPO, file))
}

function baseBlobText(file) {
  return baseBlob(file).toString('utf8')
}

function baseBlobJson(file) {
  return JSON.parse(baseBlobText(file))
}

/** Order-insensitive deep equality (object key order is not a semantic change). */
function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!deepEqual(a[key], b[key])) return false
  }
  return true
}

function assertNoChange(gate, label, pathspec) {
  const changed = changedPaths(pathspec)
  if (changed.length > 0) {
    return { gate, ok: false, detail: `${label} must be byte-identical to BASE; changed:\n  ${changed.join('\n  ')}` }
  }
  return { gate, ok: true, detail: `${label}: no diff vs BASE (${pathspec.length} pathspec entries)` }
}

function assertAllowlist(gate, label, pathspec, allowed) {
  const changed = changedPaths(pathspec)
  const unexpected = changed.filter((file) => !allowed.includes(file))
  if (unexpected.length > 0) {
    return {
      gate,
      ok: false,
      detail: `${label} allowlist violated; unexpected:\n  ${unexpected.join('\n  ')}\nchanged: ${changed.join(', ') || '(none)'}`,
    }
  }
  return { gate, ok: true, detail: `${label}: changed = [${changed.join(', ') || '(none)'}] ⊆ allowlist` }
}

// ---------------------------------------------------------------- G5 capture

/**
 * Declaration-driven symlink farm (design §8.4 step 2 / §15 G5 step 3).
 * `@nomicore/*` -> sibling package directory inside `treeRoot`; every other
 * declared dependency -> realpath of the MAIN repository's existing install
 * (the base worktree has no node_modules of its own). Type-only packages
 * (`@types/*`) and packages whose root export is not resolvable are located via
 * `<name>/package.json`. Returns the linked package count; throws when a declared
 * dependency cannot be resolved (loud, never silently skipped).
 */
function buildFarm(treeRoot) {
  const requireFrom = (pkgDir) => createRequire(path.join(pkgDir, 'package.json'))
  const packageDirOf = (name, pkgDir) => {
    const require = requireFrom(pkgDir)
    for (const spec of [name, `${name}/package.json`]) {
      try {
        const entry = require.resolve(spec)
        let dir = path.dirname(entry)
        for (let i = 0; i < 12; i++) {
          if (fs.existsSync(path.join(dir, 'package.json'))) return fs.realpathSync(dir)
          const parent = path.dirname(dir)
          if (parent === dir) break
          dir = parent
        }
      } catch {
        // try the next probe
      }
    }
    return undefined
  }
  const workspaceIndex = new Map()
  for (const top of ['packages', 'apps', 'domains']) {
    const dir = path.join(treeRoot, top)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir)) {
      const manifest = path.join(dir, name, 'package.json')
      if (!fs.existsSync(manifest)) continue
      const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'))
      if (typeof parsed.name === 'string') workspaceIndex.set(parsed.name, path.dirname(manifest))
    }
  }
  let linked = 0
  const unresolved = []
  for (const [name, workspaceDir] of workspaceIndex) {
    const parsed = JSON.parse(fs.readFileSync(path.join(workspaceDir, 'package.json'), 'utf8'))
    const deps = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) }
    for (const dep of Object.keys(deps)) {
      let target = workspaceIndex.get(dep)
      if (target === undefined) {
        target = packageDirOf(dep, path.join(REPO, path.relative(treeRoot, workspaceDir)))
      }
      if (target === undefined) {
        unresolved.push(`${name} -> ${dep}`)
        continue
      }
      const link = path.join(workspaceDir, 'node_modules', ...dep.split('/'))
      fs.mkdirSync(path.dirname(link), { recursive: true })
      try {
        fs.symlinkSync(path.resolve(target), link, 'dir')
        linked += 1
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
      }
    }
  }
  if (unresolved.length > 0) {
    throw new Error(`declared dependencies could not be resolved:\n  ${unresolved.join('\n  ')}`)
  }
  return { linked, packages: workspaceIndex.size }
}

async function captureSurfaceAtBase() {
  const worktrees = git(['worktree', 'list', '--porcelain'])
  if (worktrees.includes(BASE_WORKTREE)) {
    fail(
      'G5',
      `stale base snapshot worktree at ${path.relative(REPO, BASE_WORKTREE)}. `
      + 'Clean it up first: git worktree remove --force .worktrees/base-snapshot && git worktree prune',
    )
  }
  let added = false
  try {
    git(['worktree', 'add', '--detach', '.worktrees/base-snapshot', BASE], { stdio: ['ignore', 'inherit', 'inherit'] })
    added = true
    const farm = buildFarm(BASE_WORKTREE)
    const script = `
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
const base = process.argv[2]
const entries = JSON.parse(process.argv[3])
const out = {}
for (const [name, rel] of entries) {
  const mod = await import(pathToFileURL(path.join(base, rel)).href)
  out[name] = Object.keys(mod).sort()
}
process.stdout.write(JSON.stringify(out))
`
    const scriptPath = path.join(REPO, '.cache/cordis-baselines/g5-capture.mjs')
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true })
    fs.writeFileSync(scriptPath, script)
    const output = execFileSync(
      process.execPath,
      [
        '--import',
        pathToFileURL(path.join(REPO, 'node_modules/tsx/dist/loader.mjs')).href,
        scriptPath,
        BASE_WORKTREE,
        JSON.stringify(PUBLIC_ENTRIES),
      ],
      {
        cwd: BASE_WORKTREE,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '--conditions=nomicore-source' },
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    )
    return { surface: JSON.parse(output), farm }
  } finally {
    if (added) {
      try {
        git(['worktree', 'remove', '--force', '.worktrees/base-snapshot'], { stdio: ['ignore', 'inherit', 'inherit'] })
      } catch (error) {
        console.error(`[gates] WARN failed to remove base snapshot worktree: ${error.message}`)
      }
    }
  }
}

function readSnapshot() {
  if (!fs.existsSync(SURFACE_SNAPSHOT)) {
    fail(
      'G5',
      `missing ${path.relative(REPO, SURFACE_SNAPSHOT)}; capture it once with `
      + '`node packages/persistence/test/fixtures/cordis-baselines/gates.mjs --write-surface-snapshot`',
    )
  }
  return JSON.parse(fs.readFileSync(SURFACE_SNAPSHOT, 'utf8'))
}

function surfaceDiff(expected, actual) {
  const problems = []
  for (const name of Object.keys(expected)) {
    const want = expected[name]
    const got = actual[name]
    if (got === undefined) {
      problems.push(`${name}: missing from capture`)
      continue
    }
    const missing = want.filter((key) => !got.includes(key))
    const added = got.filter((key) => !want.includes(key))
    if (missing.length > 0) problems.push(`${name}: missing exports ${missing.join(', ')}`)
    if (added.length > 0) problems.push(`${name}: unexpected exports ${added.join(', ')}`)
  }
  return problems
}

function runSurfaceRuntimeTest() {
  const testFile = path.join(REPO, 'packages/persistence/test/cordis-public-surface.test.ts')
  if (!fs.existsSync(testFile)) {
    return { ok: false, detail: 'missing packages/persistence/test/cordis-public-surface.test.ts (AC7 runtime anchor)' }
  }
  try {
    execFileSync(
      process.execPath,
      [path.join(REPO, 'node_modules/vitest/vitest.mjs'), 'run', 'packages/persistence/test/cordis-public-surface.test.ts', '--passWithNoTests=false'],
      {
        cwd: REPO,
        env: { ...process.env, NODE_OPTIONS: '--conditions=nomicore-source' },
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      },
    )
    return { ok: true, detail: 'runtime surface test passed (default layout)' }
  } catch (error) {
    const stdout = error.stdout ?? ''
    const stderr = error.stderr ?? ''
    return { ok: false, detail: `runtime surface test failed:\n${(stdout + stderr).slice(-2000)}` }
  }
}


// ---------------------------------------------------------------- G10 (A5-1) legacy Root direct reads

const G10_LINE_ALLOW = new Set([
  'packages/persistence/src/service.ts:86',
  'packages/ws-replication/src/plugin.ts:251',
  'packages/ws-replication/test/ws-replication-plugin.test.ts:19',
  'packages/ws-replication/test/ws-replication-issue299-ac-red.test.ts:171',
  'packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts:39',
])
const G10_FILE_ALLOW = new Set([
  'packages/persistence/test/cordis-root-channel.test.ts',
  'packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts',
])
const CORDIS_FACE = /@deepseek-ai\/cordis|\bTimerService\b|\bContext\b/
/**
 * V_ctx (design §9.2 R1 word list, pinned text): `ctx` / `context` / `host`, or a token
 * **ending in** `ctx`/`Ctx` — case-sensitive, no character class in front of the suffix
 * (`fiberCtx`/`timerCtx` are in the list, `fiberCTX`/`Context`/`docContext` are not).
 */
const inVctx = (token) => token !== null
  && (token === 'ctx' || token === 'context' || token === 'host'
    || token.endsWith('ctx') || token.endsWith('Ctx'))
/** V_M4 (design §9.2 R1): the two property-read primitives. */
const V_M4 = new Set(['Reflect.get', 'safeReadChannel'])

function commentSpan(line) {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('*') || trimmed.startsWith('/*')) return line.length - trimmed.length
  let quote = null
  for (let i = 0; i < line.length - 1; i++) {
    const char = line[i]
    if (quote) {
      if (char === quote && line[i - 1] !== '\\') quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue }
    if (char === '/' && line[i + 1] === '/') return i
  }
  return -1
}

function insideString(line, index) {
  let quote = null
  for (let i = 0; i < index; i++) {
    const char = line[i]
    if (quote) {
      if (char === quote && line[i - 1] !== '\\') quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') quote = char
  }
  return quote !== null
}

/** Cast-paren receiver: the FIRST identifier inside the cast parens; unresolvable => null. */
function castParenFirstIdentifier(before) {
  let depth = 0
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === ')') depth += 1
    else if (before[i] === '(') {
      depth -= 1
      if (depth === 0) {
        const inner = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(before.slice(i + 1).trim())
        return inner ? inner[0] : null
      }
    }
  }
  return null
}

function receiverOf(line, dotIndex) {
  const before = line.slice(0, dotIndex).replace(/[\s?]+$/, '')
  const match = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(before)
  if (match) return match[1]
  if (before.endsWith(')')) return castParenFirstIdentifier(before)
  return null
}

function receiverOfBracket(line, index) {
  const before = line.slice(0, index).replace(/\[\s*['"]\s*$/, '').replace(/\s+$/, '')
  if (before.endsWith(']')) return null
  const match = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(before)
  if (match) return match[1]
  if (before.endsWith(')')) return castParenFirstIdentifier(before)
  return null
}

function calleeOfLiteral(line, literalIndex) {
  let start = -1
  for (let i = literalIndex - 1; i >= 0; i--) {
    const char = line[i]
    if (char === ')') return null
    if (char === '(') { start = i; break }
  }
  if (start < 0) return null
  const before = line.slice(0, start).replace(/\s+$/, '')
  const match = /([A-Za-z_$][A-Za-z0-9_$.]*)$/.exec(before)
  return match ? match[1] : null
}

/**
 * M4 callee attribution (design §9.2 R1 M4 + I-1③ / SA8 §14.8-2). The pinned semantics
 * bind *call-argument positions*: the callee of a `'root'` literal is the dotted chain of
 * the call whose argument list holds the literal. The single-line judge above cannot see
 * a call whose `(` (or whose argument) is on another line, so a whole-file lexer recovers
 * the enclosing call for the literals that judge leaves unattributed. **Fail-closed**: a
 * literal that is the first token of a call argument but whose call chain cannot be
 * mechanically attributed is recorded as `callee=UNRESOLVED-CROSSLINE` ⇒ candidate ⇒
 * class 6 — it is never silently dropped as a non-candidate. Literals that are not call
 * arguments (case labels, type unions, template JSON, comment prose, array/object
 * elements, nested function bodies) stay non-candidates, exactly as the pinned table's
 * definition/enumeration rows require.
 */
const M4_UNRESOLVED = 'UNRESOLVED-CROSSLINE'

/**
 * Whole-file lexer: for each real `'root'` literal, its innermost enclosing call context.
 *
 * Explicit lexical rules (SA9-2 comment blindness + SA9-8 regex/nested-template corners):
 *
 *   R-COMMENT  `// …` and `/* … *​/` (JSDoc included) are not code. Comments are
 *              **transparent for token adjacency**: both the "previous significant
 *              token" that decides `argumentStart` and the dotted-callee chain skip
 *              them. A formatted comment between `(` and `'root'` — or between the
 *              callee chain and its `(` — therefore behaves like whitespace instead of
 *              silently downgrading the literal to a non-candidate.
 *   R-STRING   `'…'` / `"…"` delimiters and their interior are code. A closed
 *              `'root'`/`"root"` literal is recorded together with the last significant
 *              code character before its opening quote (`argumentStart` evidence).
 *   R-REGEX    `/` starts a regex literal iff the previous significant code token cannot
 *              end an expression: punctuation in `([{,;:=!&|?+-*%~^<>` or a prefix
 *              keyword (`return typeof case in of instanceof new delete void throw do
 *              else yield await`). Otherwise it is the division operator. The regex body
 *              (character classes included) is opaque, so `(`, `)` or a quote inside a
 *              regex can never mutate the paren stack or the string state. A regex
 *              literal cannot span a line: if no closing `/` is found on that line the
 *              line remainder is opaque and the lexer is marked `unresolved`.
 *   R-TEMPLATE A backtick opens template text; `${` switches to a code expression whose
 *              `}` at brace depth 0 returns to template text; backticks nest. Template
 *              text is opaque data (a `'root'` there is never a candidate), while
 *              `${…}` expression code is lexed normally, and nested templates keep the
 *              enclosing template frame instead of closing it early.
 *   R-FAILCLOSED When the lexer cannot decide (unterminated regex, template or block
 *              comment), every later call-argument-position literal is reported as
 *              `UNRESOLVED-CROSSLINE` ⇒ class 6. An unattributable argument is never
 *              silently dropped.
 */
function m4ContextsOf(text) {
  const contexts = new Map()
  const parens = []
  /** 1 = code character; comments, regex bodies and template text stay 0 (opaque). */
  const codeMask = new Uint8Array(text.length)
  /** Template nesting frames: `{ type: 'template' }` | `{ type: 'expr', brace }`. */
  const frames = []
  const lineStarts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1)
  const locate = (index) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid] <= index) lo = mid
      else hi = mid - 1
    }
    return { line: lo + 1, column: index - lineStarts[lo] }
  }
  const prevCodeIndex = (index) => {
    for (let i = index; i >= 0; i--) if (codeMask[i] === 1) return i
    return -1
  }
  /** Previous non-whitespace *code* character: whitespace and comments are transparent. */
  const prevSignificantIndex = (index) => {
    for (let i = index; i >= 0; i--) {
      if (codeMask[i] === 1 && !/\s/.test(text[i])) return i
    }
    return -1
  }
  const inTemplateText = () => frames.length > 0 && frames[frames.length - 1].type === 'template'
  const regexAllowedAfter = (index) => {
    const cursor = prevSignificantIndex(index - 1)
    if (cursor < 0) return true
    const char = text[cursor]
    if ('([{,;:=!&|?+-*%~^<>'.includes(char)) return true
    if (!/[A-Za-z0-9_$]/.test(char)) return false
    let start = cursor
    while (start >= 0 && /[A-Za-z0-9_$]/.test(text[start])) start -= 1
    return ['return', 'typeof', 'case', 'in', 'of', 'instanceof', 'new', 'delete', 'void', 'throw', 'do', 'else', 'yield', 'await']
      .includes(text.slice(start + 1, cursor + 1))
  }
  /** Dotted chain immediately before `index`, comments transparent, whitespace is a separator. */
  const chainBefore = (index) => {
    let cursor = prevCodeIndex(index - 1)
    let chain = ''
    while (cursor >= 0 && /[A-Za-z0-9_$.]/.test(text[cursor])) {
      chain = text[cursor] + chain
      cursor = prevCodeIndex(cursor - 1)
    }
    return /^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(chain) ? chain : null
  }
  const enclosingCall = () => {
    for (let depth = parens.length - 1; depth >= 0; depth--) {
      if (parens[depth].callLike) return parens[depth]
    }
    return null
  }
  let unresolved = false
  let quote = null
  let quoteStart = -1
  let quoteArgumentStart = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inTemplateText()) {
      if (char === '\\') { i += 1; continue }
      if (char === '`') { codeMask[i] = 1; frames.pop(); continue }
      if (char === '$' && text[i + 1] === '{') {
        codeMask[i] = 1
        codeMask[i + 1] = 1
        frames.push({ type: 'expr', brace: 0 })
        i += 1
      }
      continue // template text stays opaque
    }
    if (quote !== null) {
      codeMask[i] = 1
      if (char === '\\') { if (i + 1 < text.length) codeMask[i + 1] = 1; i += 1; continue }
      if (char !== quote) continue
      if ((quote === "'" || quote === '"') && text.slice(quoteStart + 1, i) === 'root') {
        const { line, column } = locate(quoteStart)
        const enclosing = enclosingCall()
        contexts.set(`${line}:${column}`, {
          callee: enclosing === null ? null : enclosing.callee,
          callLike: enclosing !== null,
          openLine: enclosing === null ? -1 : locate(enclosing.openIndex).line,
          argumentStart: quoteArgumentStart,
        })
      }
      quote = null
      quoteStart = -1
      quoteArgumentStart = false
      continue
    }
    if (char === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2)
      if (close < 0) { unresolved = true; break } // R-FAILCLOSED: unterminated block comment
      i = close + 1 // comment characters stay opaque (mask 0), newlines included
      continue
    }
    if (char === '/' && text[i + 1] === '/') {
      const close = text.indexOf('\n', i + 2)
      if (close < 0) break
      i = close - 1
      continue
    }
    if (char === '/' && regexAllowedAfter(i)) {
      let inClass = false
      let close = -1
      for (let j = i + 1; j < text.length; j++) {
        const inner = text[j]
        if (inner === '\n') break
        if (inner === '\\') { j += 1; continue }
        if (inner === '[') { inClass = true; continue }
        if (inner === ']') { inClass = false; continue }
        if (inner === '/' && !inClass) { close = j; break }
      }
      codeMask[i] = 1
      if (close < 0) {
        // R-FAILCLOSED: undecidable regex-like slash — the line remainder is opaque.
        unresolved = true
        const eol = text.indexOf('\n', i)
        i = (eol < 0 ? text.length : eol) - 1
        continue
      }
      codeMask[close] = 1
      let flag = close + 1
      while (flag < text.length && /[a-z]/.test(text[flag])) { codeMask[flag] = 1; flag += 1 }
      i = flag - 1
      continue
    }
    codeMask[i] = 1
    if (char === "'" || char === '"') {
      quote = char
      quoteStart = i
      const previous = prevSignificantIndex(i - 1)
      quoteArgumentStart = previous >= 0 && (text[previous] === '(' || text[previous] === ',')
      continue
    }
    if (char === '`') { frames.push({ type: 'template' }); continue }
    if (frames.length > 0 && frames[frames.length - 1].type === 'expr') {
      const frame = frames[frames.length - 1]
      if (char === '{') { frame.brace += 1; continue }
      if (char === '}') {
        if (frame.brace === 0) frames.pop()
        else frame.brace -= 1
        continue
      }
    }
    if (char === '(') {
      const previous = prevSignificantIndex(i - 1)
      const lastChar = previous >= 0 ? text[previous] : ''
      parens.push({
        callee: chainBefore(i),
        callLike: /[A-Za-z0-9_$)\]>.]/.test(lastChar),
        openIndex: i,
      })
      continue
    }
    if (char === ')') parens.pop()
  }
  return { contexts, unresolved }
}

/**
 * M4 candidate judgement: `{ candidate, callee, token }`. The ratified single-line judge
 * runs first; the cross-line judge only places literals that judge leaves unattributed.
 * A lexer that could not decide its state (`unresolved`) reports every argument-position
 * literal as `UNRESOLVED-CROSSLINE` ⇒ class 6 (never a silent non-candidate).
 */
function m4CandidateOf(line, lex, ln, column) {
  const sameLine = calleeOfLiteral(line, column)
  if (sameLine !== null) return { candidate: true, callee: sameLine, token: `callee=${sameLine}` }
  const context = lex.contexts.get(`${ln}:${column}`)
  if (context === undefined || !context.callLike || !context.argumentStart) return { candidate: false }
  if (lex.unresolved || context.callee === null) return { candidate: true, callee: null, token: `callee=${M4_UNRESOLVED}` }
  return { candidate: true, callee: context.callee, token: `callee=${context.callee}` }
}

/** Full G10 sweep over the design §9.2 R0 surface (facility directory excluded). */
function sweepLegacyRootReads() {
  const hits = { 1: [], 2: [], 3: [], 5: [], '5D-R': [], '5D-C': [], 6: [] }
  let scanned = 0
  let faced = 0
  for (const root of listScanRoots()) {
    for (const abs of walkSourceFiles(root)) {
      const rel = path.relative(REPO, abs).split(path.sep).join('/')
      if (rel.startsWith(`${FACILITY_DIR}/`)) continue // G12 domain, not the G10 surface
      const text = fs.readFileSync(abs, 'utf8')
      scanned += 1
      const hasFace = CORDIS_FACE.test(text)
      if (hasFace) faced += 1
      const lines = text.split('\n')
      const m4Lex = m4ContextsOf(text)
      for (let ln = 1; ln <= lines.length; ln++) {
        const line = lines[ln - 1]
        const relLine = `${rel}:${ln}`
        const commentAt = commentSpan(line)
        const push = (category, form, extra) => hits[category].push(`${relLine} [${form} ${extra}] ${line.trim().slice(0, 110)}`)
        const allowed = G10_LINE_ALLOW.has(relLine) || G10_FILE_ALLOW.has(rel)
        const faceNote = hasFace ? '' : '; unfaced'

        const tokenRe = /\broot\b/g
        let token
        while ((token = tokenRe.exec(line)) !== null) {
          const i = token.index
          let dotIndex = -1
          if (line[i - 1] === '.' && line[i - 2] !== '.') dotIndex = i - 1
          else {
            const chain = /\?\.\s*$/.exec(line.slice(0, i))
            if (chain) dotIndex = i - chain[0].length
          }
          const isM2 = /\[\s*['"]$/.test(line.slice(0, i)) && /^\s*['"]\s*\]/.test(line.slice(i + 4))
          if (dotIndex === -1 && !isM2) continue
          const form = isM2 ? 'M2' : 'M1'
          // R2 classification table, first hit wins in the pinned row order 1 → 2 → 3 → 4 → 5 → 5D → 6.
          const inComment = commentAt >= 0 && i > commentAt
          const inStringLiteral = dotIndex !== -1 && insideString(line, dotIndex)
          if (allowed) { push(1, form, '(allowlist)'); continue } // row 1
          // row 2 is a *code* position: a same-name helper call; a literal inside a string is row 3.
          if (!inComment && !inStringLiteral && /^\s*\(/.test(line.slice(i + 4))) { push(2, form, '(root( helper call)'); continue }
          // row 3 is a *code* position: string-literal interior (comment prose is row 5).
          if (!inComment && inStringLiteral) { push(3, form, '(string interior)'); continue }
          // row 4 (definition position `root:` / `'root':` key form) is structurally non-candidate:
          // the M1/M2 matchers require `.root` / `['root']`, so no key form can reach this point.
          if (inComment) { push(5, form, '(comment)'); continue } // row 5
          const receiver = dotIndex !== -1 ? receiverOf(line, dotIndex) : receiverOfBracket(line, i)
          if (receiver === null) { push(6, form, `(receiver=UNRESOLVED${faceNote})`); continue } // row 6, fail-closed
          if (!inVctx(receiver)) { push('5D-R', form, `(receiver=${receiver}${faceNote})`); continue } // row 5D
          push(6, form, `(receiver=${receiver})`)
        }

        const destructuringRe = /\b(const|let|var)\s*(\{[^}]*\})\s*=\s*\(?\s*([A-Za-z_$][A-Za-z0-9_$.]*)/g
        let destructuring
        while ((destructuring = destructuringRe.exec(line)) !== null) {
          if (!/\broot\b/.test(destructuring[2])) continue
          const i = destructuring.index
          if (allowed) { push(1, 'M3', '(allowlist)'); continue }
          if (commentAt >= 0 && i > commentAt) { push(5, 'M3', '(comment)'); continue }
          const source = destructuring[3]
          if (!inVctx(source)) { push('5D-R', 'M3', `(source=${source}${faceNote})`); continue }
          push(6, 'M3', `(source=${source})`)
        }

        const literalRe = /(['"])root\1/g
        let literal
        while ((literal = literalRe.exec(line)) !== null) {
          const i = literal.index
          const m4 = m4CandidateOf(line, m4Lex, ln, i)
          if (!m4.candidate) continue // not a call-argument position ⇒ not an M4 candidate (R1 M4 does not bind it)
          if (allowed) { push(1, 'M4', `(allowlist ${m4.token})`); continue }
          if (commentAt >= 0 && i > commentAt) { push(5, 'M4', '(comment)'); continue }
          if (m4.callee !== null && !V_M4.has(m4.callee)) { push('5D-C', 'M4', `(${m4.token})`); continue }
          push(6, 'M4', `(${m4.token})`) // includes the fail-closed UNRESOLVED-CROSSLINE attribution
        }
      }
    }
  }
  return { hits, scanned, faced }
}

/**
 * I-3: each regression sample asserts CLASS + discriminating token, so the receiver/callee
 * resolution itself is under test (not just the class). Samples are the design §9.2
 * self-check table's real tree anchors (16 rows) plus the cast probes required by SA2 F-9
 * (below). A row with category `none` asserts the anchor is a non-candidate in *every*
 * class — for the definition/enumeration positions the pinned table declares structurally
 * non-candidate, so a regression there cannot hide as a silent drop.
 */
const G10_SAMPLES = [
  ['packages/namespace-registry/src/registry.ts:1472', '5D-R', 'receiver=payload'],
  ['packages/namespace-registry/src/registry.ts:711', '5D-R', 'receiver=record'],
  ['packages/namespace-registry/src/registry.ts:1506', '5D-R', 'receiver=p'],
  ['packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts:147', '5D-R', 'receiver=fx'],
  ['apps/yjs-server/src/app.ts:864', '5D-R', 'receiver=args'],
  ['apps/yjs-server/src/app.ts:880', '5D-R', 'receiver=args'],
  ['packages/namespace-api/src/request-body.ts:131', '5D-C', 'callee=Object.prototype.hasOwnProperty.call'],
  ['packages/namespace-api/src/create-namespace.ts:292', '5D-C', 'callee=validationProblemResponse'],
  ['packages/namespace-runtime/src/schema-write.ts:383', '5D-R', 'receiver=snap'],
  ['packages/namespace-registry/test/registry-create.test.ts:548', '5D-R', 'receiver=input2'],
  ['packages/ws-replication/test/harness.ts:537', '5D-R', 'receiver=opts'],
  ['packages/persistence/src/service.ts:46', 3, 'string interior'],
  ['packages/ws-replication/test/ws-replication-issue301-chunked-completeness-ac-red.test.ts:624', 2, 'root('],
  ['packages/doc-runtime/test/materialize-root.test.ts:782', 'none', '[M1 spread expansion `[...root.keys()]` is a non-candidate]'],
  ['packages/persistence/src/service.ts:86', 1, 'allowlist'],
  ['packages/ws-replication/src/plugin.ts:251', 1, 'allowlist'],
]

function classifySampleText(line) {
  // Minimal single-line classification used only by the synthetic cast probes: it reuses
  // the exact receiver/callee resolvers above and walks the pinned R2 row order
  // 1 → 2 → 3 → 4 → 5 → 5D → 6 (rows 2/3 are code positions, see the sweep).
  const commentAt = commentSpan(line)
  const tokenRe = /\broot\b/g
  let token
  while ((token = tokenRe.exec(line)) !== null) {
    const i = token.index
    let dotIndex = -1
    if (line[i - 1] === '.' && line[i - 2] !== '.') dotIndex = i - 1
    else {
      const chain = /\?\.\s*$/.exec(line.slice(0, i))
      if (chain) dotIndex = i - chain[0].length
    }
    const isM2 = /\[\s*['"]$/.test(line.slice(0, i)) && /^\s*['"]\s*\]/.test(line.slice(i + 4))
    if (dotIndex === -1 && !isM2) continue
    const inComment = commentAt >= 0 && i > commentAt
    const inStringLiteral = dotIndex !== -1 && insideString(line, dotIndex)
    if (!inComment && !inStringLiteral && /^\s*\(/.test(line.slice(i + 4))) return { category: 2, token: 'root(' }
    if (!inComment && inStringLiteral) return { category: 3, token: 'string' }
    if (inComment) return { category: 5, token: 'comment' }
    const receiver = dotIndex !== -1 ? receiverOf(line, dotIndex) : receiverOfBracket(line, i)
    if (receiver === null) return { category: 6, token: 'receiver=UNRESOLVED' }
    if (!inVctx(receiver)) return { category: '5D-R', token: `receiver=${receiver}` }
    return { category: 6, token: `receiver=${receiver}` }
  }
  return { category: 'none', token: '' }
}

/** Synthetic M4 probe: multi-line snippet → `{category, token}` per candidate literal. */
function classifyM4SampleText(text) {
  // Reuses the exact M4 candidate/lexer judge the sweep uses (I-1③ fail-closed included).
  const lines = text.split('\n')
  const lex = m4ContextsOf(text)
  const out = []
  for (let ln = 1; ln <= lines.length; ln++) {
    const literalRe = /(['"])root\1/g
    let literal
    while ((literal = literalRe.exec(lines[ln - 1])) !== null) {
      const m4 = m4CandidateOf(lines[ln - 1], lex, ln, literal.index)
      if (!m4.candidate) continue
      const category = m4.callee !== null && !V_M4.has(m4.callee) ? '5D-C' : 6
      out.push({ category, token: m4.token })
    }
  }
  return out
}

/** I-1① cast probes + comment/case/fail-closed boundary probes (synthetic, design §9.2 table). */
const G10_CAST_PROBES = [
  ['const r = (ctx as any).root', 6, 'receiver=ctx'],
  ['const r = (host as Context).root', 6, 'receiver=host'],
  ["const r = (ctx as X)['root']", 6, 'receiver=ctx'],
  ["const r = (ctx as Record<string,unknown>)['root']", 6, 'receiver=ctx'],
  ["const r = (snap as Record<string, unknown>)['root']", '5D-R', 'receiver=snap'],
  ['const r = (input2 as { root: unknown }).root', '5D-R', 'receiver=input2'],
  ['const r = fiberCtx.root', 6, 'receiver=fiberCtx'],
  ['const r = timerCtx?.root', 6, 'receiver=timerCtx'],
  ['const r = fiberCTX.root', '5D-R', 'receiver=fiberCTX'],
  ['const r = ACtx.root', 6, 'receiver=ACtx'], // V_ctx suffix is anchored only at the end (word list, case-sensitive)
  ['const r = $ctx.root', 6, 'receiver=$ctx'],
  ['const r = (0 as any).root', 6, 'receiver=UNRESOLVED'],
  ['const r = a[i].root', 6, 'receiver=UNRESOLVED'],
  [' * reads ctx.root', 5, 'comment'],
  ['/* ctx.root */', 5, 'comment'],
  ["const v = ctx.root('hub', nsId)", 2, 'root('],
  ['const v = ctx.rootValue(1)', 'none', ''],
  ['const v = [...root.keys()]', 'none', ''], // spread expansion is not a read (design §9.2 self-check table)
]

/**
 * I-1③ / SA4-1 cross-line M4 probes + SA9-2 comment variants + SA9-8 regex/nested-template
 * rules (synthetic, multi-line). Each row asserts CLASS + token: a `'root'` argument whose
 * call sits on another line is attributed to that call (class 6 when it is a pinned read
 * primitive), a formatted comment between `(`/`,` and the literal (or inside the callee
 * chain) stays transparent for token adjacency, a regex body or template text never
 * mutates the lexer state, an undecidable lexer state fails closed to
 * class 6 with an explicit UNRESOLVED-CROSSLINE token, and non-argument continuations
 * (array element, object key, nested arrow body, template text) stay non-candidates.
 */
const G10_M4_PROBES = [
  ["const legacy = Reflect.get(\n  ctx,\n  'root'\n)", 6, 'callee=Reflect.get'],
  ["const legacy = Reflect.get(ctx,\n  'root')", 6, 'callee=Reflect.get'],
  ["const legacy = safeReadChannel(\n  host, 'root')", 6, 'callee=safeReadChannel'],
  ["const legacy = (ctx as Fn)\n  ('root')", 6, 'callee=UNRESOLVED-CROSSLINE'],
  ["writeFatal(\n  'root',\n  'code')", '5D-C', 'callee=writeFatal'],
  ["const audit = { 'root': 1 }", 'none', ''],
  ["const hosts = [\n  'root',\n]", 'none', ''],
  ["const body = () =>\n  'root'", 'none', ''],
  // ---- SA9-2 comment variants (same-line / cross-line × block / line / JSDoc). A comment
  // between the argument separator and the literal — or between the callee chain and its
  // `(` — is transparent token adjacency, never a silent non-candidate (R-COMMENT).
  ["const legacy = Reflect.get(ctx, /* why */ 'root')", 6, 'callee=Reflect.get'],
  ["const legacy = Reflect.get(ctx, /** why */ 'root')", 6, 'callee=Reflect.get'],
  ["const legacy = Reflect.get(\n  ctx,\n  /* why */ 'root',\n)", 6, 'callee=Reflect.get'],
  ["const legacy = Reflect.get(\n  ctx,\n  /** why */ 'root',\n)", 6, 'callee=Reflect.get'],
  ["const legacy = Reflect.get(\n  ctx,\n  // explain why the legacy key is needed\n  'root',\n)", 6, 'callee=Reflect.get'],
  ["const legacy = Reflect.get(\n  // why the legacy key is needed\n  ctx,\n  'root'\n)", 6, 'callee=Reflect.get'],
  ["const legacy = Reflect /* why */ .get(\n  ctx,\n  'root',\n)", 6, 'callee=UNRESOLVED'],
  ["const legacy = Reflect/* why */.get(\n  ctx,\n  'root',\n)", 6, 'callee=Reflect.get'],
  ["Reflect.get(\n  ctx,\n  // 'root' appears in this comment only\n  value,\n)", 'none', ''],
  // ---- SA9-8 regex literals (R-REGEX): the body is opaque, division stays division.
  ["const re = /\\)/\nconst legacy = Reflect.get(\n  ctx,\n  'root'\n)", 6, 'callee=Reflect.get'],
  ["const re = /\\/\\* not a comment/\nconst legacy = Reflect.get(\n  ctx,\n  'root')", 6, 'callee=Reflect.get'],
  ["const q = a / b; const legacy = Reflect.get(\n  ctx,\n  'root')", 6, 'callee=Reflect.get'],
  ["const re = /x/\nconst legacy = Reflect.get(\n  ctx,\n  'root')", 6, 'callee=Reflect.get'],
  ["const re = /'/; const legacy = Reflect.get(\n  ctx,\n  'root')", 6, 'callee=Reflect.get'],
  // ---- SA9-8 nested templates (R-TEMPLATE): `${…}` is code, template text is data.
  ["const t = `${ { a: 1 } }`\nconst legacy = Reflect.get(\n  ctx,\n  'root')", 6, 'callee=Reflect.get'],
  ["const t = `${ Reflect.get(ctx, 'root') }`", 6, 'callee=Reflect.get'],
  ["const t = `${ Reflect.get(\n  ctx,\n  'root')\n }`", 6, 'callee=Reflect.get'],
  ["const t = `${ `inner ${ Reflect.get(\n  ctx,\n  'root') }` }`", 6, 'callee=Reflect.get'],
  ["const t = `outer ${ `inner ${ 1 }` }`\nconst legacy = Reflect.get(\n  ctx,\n  'root')", 6, 'callee=Reflect.get'],
  ["const t = `text 'root' only`", 'none', ''],
  // ---- R-FAILCLOSED: an undecidable lexer state never silently drops a later argument.
  ["const re = /abc\nconst legacy = Reflect.get(\n  ctx,\n  'root'\n)", 6, 'callee=UNRESOLVED'],
]

function gateG10() {
  const { hits, scanned, faced } = sweepLegacyRootReads()
  const problems = []
  const summary = Object.fromEntries(Object.entries(hits).map(([category, list]) => [category, list.length]))
  const seamHits = hits[1].filter((hit) => hit.includes('packages/persistence/src/service.ts:86') || hit.includes('packages/ws-replication/src/plugin.ts:251'))
  if (seamHits.length < 2) problems.push('seam self-validation failed: both seam lines must produce a class-1 M4 hit')
  if (!hits[1].some((hit) => hit.includes('callee=safeReadChannel'))) problems.push('seam self-validation failed: no safeReadChannel M4 hit')
  for (const [anchor, category, token] of G10_SAMPLES) {
    if (category === 'none') {
      const appeared = Object.values(hits).some((list) => list.some((hit) => hit.startsWith(`${anchor} `)))
      if (appeared) problems.push(`regression sample ${anchor} must stay a non-candidate ${token}`)
      continue
    }
    const list = hits[category] ?? []
    if (!list.some((hit) => hit.startsWith(`${anchor} `) && hit.includes(token))) {
      problems.push(`regression sample ${anchor} must classify as ${category} with token ${token}`)
    }
  }
  for (const [line, category, token] of G10_CAST_PROBES) {
    const got = classifySampleText(line)
    if (String(got.category) !== String(category) || !String(got.token).includes(token)) {
      problems.push(`cast probe ${JSON.stringify(line)} expected ${category}/${token}, got ${got.category}/${got.token}`)
    }
  }
  for (const [text, category, token] of G10_M4_PROBES) {
    const got = classifyM4SampleText(text)
    const flat = got.map((hit) => `${hit.category}/${hit.token}`).join(' | ') || '(no candidate)'
    if (category === 'none') {
      if (got.length > 0) problems.push(`M4 cross-line probe ${JSON.stringify(text)} expected no candidate, got ${flat}`)
      continue
    }
    if (!got.some((hit) => String(hit.category) === String(category) && hit.token.includes(token))) {
      problems.push(`M4 cross-line probe ${JSON.stringify(text)} expected ${category}/${token}, got ${flat}`)
    }
  }
  if (hits[6].length > 0) {
    problems.push(`class 6 (Cordis-context legacy root direct read) must be empty, got ${hits[6].length}:\n  ${hits[6].join('\n  ')}`)
  }
  // (e) the complete hit list (including every exclusion and its reason) is printed.
  console.log(`[gates] G10 sweep scanned=${scanned} cordis_faced=${faced} categories=${JSON.stringify(summary)}`)
  for (const category of ['1', '2', '3', '5', '5D-R', '5D-C', '6']) {
    if ((hits[category] ?? []).length === 0) continue
    console.log(`[gates] G10 cat ${category} (${hits[category].length})`)
    for (const hit of hits[category]) console.log(`  ${hit}`)
  }
  if (problems.length > 0) {
    return { gate: 'G10', ok: false, detail: problems.join('\n') }
  }
  return {
    gate: 'G10',
    ok: true,
    detail: `legacy Root direct reads: class 6 empty (${summary['5D-R'] + summary['5D-C']} domain-data rejects recorded: 5D-R=${summary['5D-R']} 5D-C=${summary['5D-C']}); seam self-validation 2/2; regression samples ${G10_SAMPLES.length}/${G10_SAMPLES.length}; cast probes ${G10_CAST_PROBES.length}/${G10_CAST_PROBES.length}; cross-line M4 probes ${G10_M4_PROBES.length}/${G10_M4_PROBES.length}; ${scanned} files scanned`,
  }
}

// ---------------------------------------------------------------- G11 (A9-1) forbidden API scan

const FORBIDDEN_PATTERNS = [
  ['volatile config', /volatile\s+config/],
  ['internal/config', /internal\/config/],
  ['internal/update', /internal\/update/],
  ['internal/commit', /internal\/commit/],
  ['cordis private fiber store', /\bfiber\b\s*\.\s*(?:store|_store)\b|\broot\[symbols\.(?:store|internal)\]/],
]

function gateG11() {
  const hits = []
  for (const root of listSrcRoots()) {
    for (const abs of walkSourceFiles(root)) {
      const rel = path.relative(REPO, abs).split(path.sep).join('/')
      const lines = fs.readFileSync(abs, 'utf8').split('\n')
      lines.forEach((line, index) => {
        for (const [label, pattern] of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) hits.push(`${rel}:${index + 1} [${label}] ${line.trim().slice(0, 110)}`)
        }
      })
    }
  }
  const unexpected = hits.filter((hit) => !FORBIDDEN_API_ALLOW.some((allowed) => hit.startsWith(allowed)))
  if (unexpected.length > 0) {
    return { gate: 'G11', ok: false, detail: `forbidden API usage in production src:\n  ${unexpected.join('\n  ')}` }
  }
  return { gate: 'G11', ok: true, detail: 'no volatile config / internal config-update-commit / private fiber store read (allowlist is the pinned empty set)' }
}

// ---------------------------------------------------------------- G12 facility allowlist

function gateG12() {
  const changed = changedPaths([FACILITY_DIR])
  const unexpected = changed.filter((file) => !FACILITY_ALLOW.includes(file))
  if (unexpected.length > 0) {
    return {
      gate: 'G12',
      ok: false,
      detail: `facility directory allowlist violated (I-2: a weakened G12 makes the G10 surface blind):\n  ${unexpected.join('\n  ')}\nchanged: ${changed.join(', ') || '(none)'}`,
    }
  }
  return {
    gate: 'G12',
    ok: true,
    detail: `facility files: changed = [${changed.join(', ') || '(none)'}] ⊆ 5-file closed allowlist (acquire/root-probe/provenance-b3 zero-diff; public-surface.base.json is the #472 7-entry recapture; baselines.json is a nominal entry — its batch freeze is enforced by G13.f + acquire N-5, not by this gate; any new file in the directory is red)`,
  }
}

// ---------------------------------------------------------------- G13 release batch audit

/** Byte-identity to the BASE blob (never routed through rename pairing). */
function bytesIdenticalToBase(file) {
  try {
    return baseBlob(file).equals(workBlob(file))
  } catch {
    return false
  }
}

/**
 * Publishable workspace manifests at BASE — `(packages|apps|domains)/<pkg>/package.json`
 * parsed from the BASE blob and filtered to `private !== true` (exactly 15 for this
 * ticket). Reading BASE instead of the working tree keeps the set immune to
 * working-tree tampering; a newly added package file is still caught by G13.g's
 * whole-tree changeset. Self-contained: deliberately does not import
 * `scripts/package-catalog.mjs` (whose byte-freeze is G13.e).
 */
function listPublishableManifestsAtBase() {
  const problems = []
  const manifests = git(['ls-tree', '-r', '--name-only', BASE])
    .split('\n')
    .filter((file) => /^(?:packages|apps|domains)\/[^/]+\/package\.json$/.test(file))
    .sort()
  const publishable = []
  for (const file of manifests) {
    try {
      const manifest = baseBlobJson(file)
      if (manifest.private !== true) publishable.push({ file, manifest })
    } catch (error) {
      problems.push(`${file}: BASE blob is not parsable JSON (${error.message})`)
    }
  }
  if (publishable.length !== 15) {
    problems.push(`expected exactly 15 publishable workspace manifests at BASE ${BASE.slice(0, 7)}, found ${publishable.length}`)
  }
  return { publishable, problems }
}

/** PV-8a: tracked changeset ⊆ allowlist, untracked ⊆ `wiki/**`; violations name the file. */
function g13ChangesetProblems(allowed) {
  const problems = []
  for (const file of wholeTreeChangedPaths()) {
    if (!allowed.has(file) && !isTicketDoc(file)) {
      problems.push(`tracked change outside the release allowlist: ${file}`)
    }
  }
  for (const file of untrackedPaths()) {
    if (!file.startsWith('wiki/')) problems.push(`untracked path outside wiki/: ${file}`)
  }
  return problems
}

/**
 * G13 state `absent` (PV-8a "C1" form): the clean pre-release tree. All 15
 * publishable manifests still carry their BASE version, the three frozen
 * artifacts (release manifest / known-red ledger / baselines.json) are
 * byte-identical, and the whole-tree changeset contains none of the 8 release
 * files (allowlist = the 4 C1 facility files + `wiki/raw/task_issue-472*.md`).
 */
function g13AbsentState() {
  const problems = []
  const { publishable, problems: listProblems } = listPublishableManifestsAtBase()
  problems.push(...listProblems)
  for (const { file, manifest } of publishable) {
    let working
    try {
      working = JSON.parse(fs.readFileSync(path.join(REPO, file), 'utf8'))
    } catch (error) {
      problems.push(`${file}: working manifest unreadable/unparsable (${error.message})`)
      continue
    }
    if (working.version !== manifest.version) {
      problems.push(`${file}: version ${JSON.stringify(working.version)} ≠ BASE ${manifest.version} (absent state requires the release surface untouched)`)
    }
  }
  for (const file of [RELEASE_BATCH.manifest, RELEASE_BATCH.frozenLedger, RELEASE_BATCH.baselines]) {
    if (!bytesIdenticalToBase(file)) problems.push(`${file}: not byte-identical to BASE (absent state freezes this artifact)`)
  }
  problems.push(...g13ChangesetProblems(new Set(C1_FACILITY_FILES)))
  return problems
}

/**
 * G13 state `exact` (release candidate `R`): PV-3 version table + manifest
 * cross-check + PV-4 numstat + PV-5/PV-8b byte freezes + PV-8a whole-tree bind.
 */
function g13ExactState() {
  const problems = []
  const { publishable, problems: listProblems } = listPublishableManifestsAtBase()
  problems.push(...listProblems)
  const pinnedFiles = new Set(RELEASE_BATCH.versions.keys())
  const workingPublishables = new Map()
  for (const { file } of publishable) {
    try {
      workingPublishables.set(file, JSON.parse(fs.readFileSync(path.join(REPO, file), 'utf8')))
    } catch (error) {
      problems.push(`${file}: working manifest unreadable/unparsable (${error.message})`)
    }
  }

  // a. 7 pinned manifests: deep-equal except `version`, version === to, text diff
  //    exactly one pinned deletion + one pinned addition (PV-3).
  for (const [file, { from, to }] of RELEASE_BATCH.versions) {
    const working = workingPublishables.get(file)
    if (working === undefined) continue
    if (working.version !== to) {
      problems.push(`${file}: version=${JSON.stringify(working.version)} expected ${to} (PV-3)`)
    }
    const baseManifest = baseBlobJson(file)
    const baseRest = { ...baseManifest }
    const workRest = { ...working }
    delete baseRest.version
    delete workRest.version
    if (!deepEqual(baseRest, workRest)) {
      problems.push(`${file}: manifest differs from BASE beyond the "version" line (dependency/field change) — PV-3 deep equality failed`)
    }
    const diff = git(['diff', '--no-renames', BASE, '--', file]).split('\n')
    const removed = diff.filter((line) => line.startsWith('-') && !line.startsWith('---'))
    const added = diff.filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    if (removed.length !== 1 || added.length !== 1) {
      problems.push(`${file}: text diff must be exactly 1 deletion + 1 addition, got ${removed.length} deletion(s) + ${added.length} addition(s) (PV-3)`)
    } else if (removed[0] !== `-  "version": "${from}",` || added[0] !== `+  "version": "${to}",`) {
      problems.push(`${file}: text diff is not the pinned version line shape (expected -  "version": "${from}", / +  "version": "${to}",) (PV-3)`)
    }
  }

  // b. the other 8 publishable manifests + root + domains manifest + lockfile are
  //    byte-identical to BASE (PV-3 / A5-2). Byte comparison, rename-immune.
  const bytePinned = [
    ...[...workingPublishables.keys()].filter((file) => !pinnedFiles.has(file)).sort(),
    'package.json',
    'domains/vfs3-assets/package.json',
    'pnpm-lock.yaml',
  ]
  for (const file of bytePinned) {
    if (!bytesIdenticalToBase(file)) problems.push(`${file}: not byte-identical to BASE (PV-3)`)
  }

  // c. release manifest: exactly 15 keys; filename ↔ name/working version cross-check
  //    (same derivation as build-local-packages.mjs L24); PV-4 numstat 7 additions +
  //    7 deletions; every changed key is one of the 7 target filenames; no old
  //    filename lingers anywhere.
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(REPO, RELEASE_BATCH.manifest), 'utf8'))
  } catch (error) {
    problems.push(`${RELEASE_BATCH.manifest}: unreadable/unparsable (${error.message})`)
  }
  if (manifest !== undefined && typeof manifest === 'object' && manifest !== null) {
    const keys = Object.keys(manifest)
    if (keys.length !== 15) problems.push(`${RELEASE_BATCH.manifest}: expected exactly 15 keys, got ${keys.length}`)
    const expectedByPackage = new Map()
    for (const { file } of publishable) {
      const working = workingPublishables.get(file)
      if (working === undefined) continue
      const expected = `${working.name.replace('@', '').replace('/', '-')}-${working.version}.tgz`
      expectedByPackage.set(working.name, expected)
      if (manifest[working.name] !== expected) {
        problems.push(`${RELEASE_BATCH.manifest}: ${working.name} → ${JSON.stringify(manifest[working.name])} expected ${expected} (filename ↔ name/version cross-check)`)
      }
    }
    const numstat = git(['diff', '--no-renames', '--numstat', BASE, '--', RELEASE_BATCH.manifest]).trim()
    const rows = numstat === '' ? [] : numstat.split('\n').map((line) => line.split('\t'))
    const addedLines = rows.reduce((total, [added]) => total + (Number(added) || 0), 0)
    const removedLines = rows.reduce((total, [, removed]) => total + (Number(removed) || 0), 0)
    if (rows.length !== 1 || addedLines !== 7 || removedLines !== 7) {
      problems.push(`${RELEASE_BATCH.manifest}: diff must be exactly 7 additions + 7 deletions (PV-4), got ${rows.length} file(s) with ${addedLines} addition(s) + ${removedLines} deletion(s)`)
    }
    const plusKeys = new Map()
    const minusKeys = new Map()
    for (const line of git(['diff', '--no-renames', BASE, '--', RELEASE_BATCH.manifest]).split('\n')) {
      // the last manifest key has no trailing comma — the pattern must accept both
      const match = /^([+-])  "([^"]+)": "([^"]+)",?$/.exec(line)
      if (match === null) continue
      const [, sign, name, filename] = match
      if (sign === '+') plusKeys.set(name, filename)
      else minusKeys.set(name, filename)
    }
    const targetNames = new Set()
    for (const [file, { from }] of RELEASE_BATCH.versions) {
      const baseManifest = baseBlobJson(file)
      targetNames.add(baseManifest.name)
      const oldFilename = `${baseManifest.name.replace('@', '').replace('/', '-')}-${from}.tgz`
      if (Object.values(manifest).includes(oldFilename)) {
        problems.push(`${RELEASE_BATCH.manifest}: stale filename lingers: ${oldFilename}`)
      }
    }
    if (plusKeys.size !== 7 || minusKeys.size !== 7) {
      problems.push(`${RELEASE_BATCH.manifest}: expected exactly 7 changed keys, got ${plusKeys.size} addition key(s) + ${minusKeys.size} deletion key(s) (PV-4)`)
    }
    for (const [name, filename] of plusKeys) {
      if (!targetNames.has(name)) problems.push(`${RELEASE_BATCH.manifest}: unexpected added key ${name} (not one of the 7 pinned packages)`)
      if (expectedByPackage.get(name) !== filename) {
        problems.push(`${RELEASE_BATCH.manifest}: added line for ${name} is not the §6.1 target filename (got ${filename})`)
      }
    }
    for (const name of minusKeys.keys()) {
      if (!targetNames.has(name)) problems.push(`${RELEASE_BATCH.manifest}: unexpected removed key ${name} (not one of the 7 pinned packages)`)
    }
  }

  // d/e/f. byte freezes — ledger (S4), catalog (A5-2), baselines.json (PV-8b).
  for (const file of [RELEASE_BATCH.frozenLedger, RELEASE_BATCH.catalog, RELEASE_BATCH.baselines]) {
    if (!bytesIdenticalToBase(file)) problems.push(`${file}: not byte-identical to BASE (G13 byte-freeze)`)
  }

  // g. whole-tree changeset binding (PV-8a) — the 4 C1 facility files + the 8
  //    release files + `wiki/raw/task_issue-472*.md`; untracked ⊆ `wiki/**`.
  problems.push(...g13ChangesetProblems(new Set([...C1_FACILITY_FILES, ...RELEASE_FILES])))
  return problems
}

function gateG13() {
  const absentProblems = g13AbsentState()
  if (absentProblems.length === 0) {
    return {
      gate: 'G13',
      ok: true,
      detail: 'state=absent (release surface untouched: 15 publishable manifests at BASE versions; release manifest / known-red ledger / baselines.json byte-identical; tree changeset ⊆ 4 C1 facility files + wiki/raw/task_issue-472*.md)',
    }
  }
  const exactProblems = g13ExactState()
  if (exactProblems.length === 0) {
    const versions = [...RELEASE_BATCH.versions].map(([file, { from, to }]) => {
      const name = baseBlobJson(file).name.replace('@nomicore/', '')
      return `${name} ${from}→${to}`
    })
    return {
      gate: 'G13',
      ok: true,
      detail: `state=exact; versions: ${versions.join(', ')}; release manifest 7/7 filenames; ledger / catalog / baselines.json byte-identical; tree changeset ⊆ 8 release files + 4 C1 facility files + wiki/raw/task_issue-472*.md`,
    }
  }
  const format = (label, problems) => `${label} (${problems.length} problem(s)):\n  ${problems.join('\n  ')}`
  return {
    gate: 'G13',
    ok: false,
    detail: `release batch shape is neither absent nor exact (#472 PV-1…PV-8b):\n${format('absent', absentProblems)}\n${format('exact', exactProblems)}`,
  }
}

// ---------------------------------------------------------------- gates

async function gateG5(writeSurfaceSnapshot) {
  const captured = await captureSurfaceAtBase()
  const surface = captured.surface
  if (writeSurfaceSnapshot) {
    fs.writeFileSync(SURFACE_SNAPSHOT, `${JSON.stringify(surface, null, 2)}\n`)
    console.log(`[gates] wrote ${path.relative(REPO, SURFACE_SNAPSHOT)} (${captured.farm.packages} packages, ${captured.farm.linked} links)`)
    return { gate: 'G5', ok: true, detail: 'surface snapshot captured' }
  }
  const snapshot = readSnapshot()
  const problems = surfaceDiff(snapshot, surface)
  const runtime = runSurfaceRuntimeTest()
  if (problems.length > 0 || !runtime.ok) {
    return {
      gate: 'G5',
      ok: false,
      detail: `public surface drift vs base snapshot:\n  ${problems.join('\n  ') || '(none)'}\n${runtime.detail}`,
    }
  }
  return { gate: 'G5', ok: true, detail: `${PUBLIC_ENTRIES.length} entries match base snapshot; ${runtime.detail}` }
}

function listSrcRoots() {
  const roots = []
  for (const top of ['packages', 'apps', 'domains']) {
    const dir = path.join(REPO, top)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      const src = path.join(dir, name, 'src')
      if (fs.existsSync(src)) roots.push(src)
    }
  }
  return roots
}

function listScanRoots() {
  const roots = []
  for (const top of ['packages', 'apps', 'domains']) {
    const dir = path.join(REPO, top)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      for (const sub of ['src', 'test']) {
        const root = path.join(dir, name, sub)
        if (fs.existsSync(root)) roots.push(root)
      }
    }
  }
  return roots
}

function walkSourceFiles(root) {
  const out = []
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
      const abs = path.join(current, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (entry.isFile() && /\.(ts|tsx|mts|cts|js|mjs)$/.test(entry.name)) out.push(abs)
    }
  }
  walk(root)
  return out
}

function gateG8() {
  const hits = []
  for (const root of listSrcRoots()) {
    for (const abs of walkSourceFiles(root)) {
      const rel = path.relative(REPO, abs).split(path.sep).join('/')
      const lines = fs.readFileSync(abs, 'utf8').split('\n')
      lines.forEach((line, index) => {
        const channel = G8_CHANNEL_PATTERN.test(line)
        const env = G8_ENV_PATTERN.test(line)
        if (channel || (env && !G8_ENV_LINE_ALLOW.has(`${rel}:${index + 1}`))) {
          hits.push(`${rel}:${index + 1}: ${line.trim()}`)
        }
      })
    }
  }
  if (hits.length > 0) {
    return { gate: 'G8', ok: false, detail: `production src contains baseline/channel environment branches:\n  ${hits.join('\n  ')}` }
  }
  return {
    gate: 'G8',
    ok: true,
    detail: `no baseline/channel env marker in any production src tree; process.env only at the ${G8_ENV_LINE_ALLOW.size} pinned app-config lines (${[...G8_ENV_LINE_ALLOW].join(', ')})`,
  }
}

function gateG6() {
  const problems = []
  try {
    const output = git(['diff', '--check', BASE])
    if (output.trim() !== '') problems.push(`git diff --check reported whitespace errors:\n${output}`)
  } catch (error) {
    problems.push(`git diff --check failed: ${error.stdout ?? error.message}`)
  }
  const artifacts = git(['status', '--porcelain', '--', 'artifacts/'])
  if (artifacts.trim() !== '') problems.push(`artifacts/ is dirty:\n${artifacts}`)
  if (problems.length > 0) return { gate: 'G6', ok: false, detail: problems.join('\n') }
  return { gate: 'G6', ok: true, detail: `git diff --check ${BASE.slice(0, 7)} clean; artifacts/ untouched` }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.writeSurfaceSnapshot) {
    const result = await gateG5(true)
    process.exit(result.ok ? 0 : 1)
  }
  const results = []
  // G1′ (#472 design §7.2, PV-2): the 8 release files form the controlled opening;
  // every other manifest / lockfile / artifacts path keeps its zero-diff semantics.
  // The line-level shape of the 8 files is adjudicated by G13 alone.
  results.push(
    assertAllowlist(
      'G1\u2032',
      'manifests / lockfile / artifacts (release allowlist: 7 package.json version lines + local manifest)',
      ['pnpm-lock.yaml', ...listManifests(), 'artifacts'],
      RELEASE_FILES,
    ),
  )
  // G2 (F-7): zero diff on the three src trees that have no new files of this ticket.
  results.push(
    assertNoChange('G2', 'persistence · dsh-persistence · namespace-registry src', [
      'packages/persistence/src',
      'packages/dsh-persistence/src',
      'packages/namespace-registry/src',
    ]),
  )
  // G3 (#472 design §7.2): tracked diff ⊆ {packages/ws-replication/package.json} and
  // untracked ⊆ the four named fixture files. The two clauses are checked separately:
  // the four fixtures are tracked at BASE, so a combined allowlist would silently
  // legalize editing them (SA2-18: G3 is immune to rename folding because those four
  // paths are tracked, not add candidates).
  const wsTracked = git(['diff', '--no-renames', '--name-only', BASE, '--', 'packages/ws-replication'])
    .split('\n')
    .filter(Boolean)
  const wsUntracked = git(['ls-files', '--others', '--exclude-standard', '--', 'packages/ws-replication'])
    .split('\n')
    .filter(Boolean)
  const wsUnexpectedTracked = wsTracked.filter((file) => file !== 'packages/ws-replication/package.json')
  const wsUnexpectedUntracked = wsUntracked.filter((file) => !WS_ALLOW_NEW_FILES.includes(file))
  results.push({
    gate: 'G3',
    ok: wsUnexpectedTracked.length === 0 && wsUnexpectedUntracked.length === 0,
    detail:
      `ws-replication allowlist (tracked ⊆ {package.json} ∧ untracked ⊆ 4 new files): `
      + `tracked=[${wsTracked.join(', ') || '(none)'}] untracked=[${wsUntracked.join(', ') || '(none)'}]`
      + (wsUnexpectedTracked.length > 0 ? `\nunexpected tracked:\n  ${wsUnexpectedTracked.join('\n  ')}` : '')
      + (wsUnexpectedUntracked.length > 0 ? `\nunexpected untracked:\n  ${wsUnexpectedUntracked.join('\n  ')}` : ''),
  })
  results.push(
    assertNoChange('G4', 'public entry files', [
      'packages/ws-replication/src/index.ts',
      'packages/persistence/src/index.ts',
    ]),
  )
  results.push(await gateG5(false))
  results.push(gateG6())
  results.push(assertNoChange('G7', 'docs/ (including docs/adr/)', ['docs']))
  results.push(gateG8())
  results.push(assertNoChange('G9', 'tsconfig / vitest.config', listTsconfigs()))
  results.push(gateG10())
  results.push(gateG11())
  results.push(gateG12())
  results.push(gateG13())

  let failed = 0
  for (const result of results) {
    console.log(`[gates] ${result.ok ? 'PASS' : 'FAIL'} ${result.gate}: ${result.detail}`)
    if (!result.ok) failed += 1
  }
  if (failed > 0) {
    console.error(`[gates] ${failed}/${results.length} gate(s) failed`)
    process.exit(1)
  }
  console.log(`[gates] all ${results.length} gates passed`)
}

await main()
