#!/usr/bin/env node
/**
 * Canonical baseline runner for issue #470 (design §8.4, §8.6–§8.8).
 *
 * One isolated workspace per baseline (rebuilt every run) is materialized from
 * the CURRENT WORKING TREE:
 *
 *   tracked files (`git ls-files`)  ∪  NEW_FILES (§11.1 N1–N11 explicit list)
 *
 * The NEW_FILES union is what makes the red-light phase honest (SA2 F3): at step
 * ③ the new test files are untracked, and a `git ls-files`-only copy would make
 * every cell fail as "missing file" instead of failing for the target reason.
 * Every NEW_FILE is existence-prechecked; a missing one fails materialization with
 * exit 2 and the missing list (a missing-file red is never recorded as evidence).
 *
 * Commands: node + git + tsc + vitest only (no bare pnpm/npm — design §18 I4).
 * The workspace never receives NODE_OPTIONS=--conditions=nomicore-source: tsc
 * resolves `@nomicore/*` through `customConditions`, vitest through the config
 * alias list, and `@deepseek-ai/*` through the overlay package exports (§8.4
 * "resolution channel analysis"). The root-test cell, which runs in the default
 * repository layout, keeps that env verbatim.
 *
 * Evidence (SA6 §12.5 contract): every cell writes
 *   { baseline, suite, status, resolvedRealpaths, provenanceDigest, testNames, logPath }
 * to `.cache/cordis-baselines/evidence/<baseline>/<suite>.json`.
 *
 * #472 additions (design §7.4): `--all --matrix` writes
 * `.cache/cordis-baselines/evidence/run-marker.json` ({startedAt, head, tree,
 * porcelain}) BEFORE any cell, records `runHead`/`runTree` in `matrix.json`
 * (additive), and runs the fail-closed `auditEvidence()` at the end (missing /
 * corrupt / stale / cross-tree / digest-mismatch / escaping-or-dangling logPath /
 * out-of-class artifacts => MATRIX FAIL). The same audit is available standalone
 * via `--audit-evidence` (exit 0 iff `problems=[]`).
 *
 * Usage:
 *   node run-baseline.mjs --baseline B1 [--mode typecheck] [--suite <name>]...
 *   node run-baseline.mjs --suite root-test
 *   node run-baseline.mjs --all --matrix
 *   node run-baseline.mjs --audit-evidence
 *   node run-baseline.mjs --baseline B3 --suite provenance --suite root-probe --fault fallback
 */
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../../../..')
const CACHE = path.join(REPO, '.cache/cordis-baselines')
const EVIDENCE = path.join(CACHE, 'evidence')
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, 'baselines.json'), 'utf8'))
const PROVENANCE = JSON.parse(fs.readFileSync(path.join(HERE, 'provenance-b3.json'), 'utf8'))
const NODE = process.execPath
const TSC = path.join(REPO, 'node_modules/typescript/bin/tsc')
const VITEST = path.join(REPO, 'node_modules/vitest/vitest.mjs')

const BASELINE_SUITES = MANIFEST.suites

// E7 / A7-4: identity-first order is a mechanical load-time invariant.
if (BASELINE_SUITES[0] !== 'provenance' || BASELINE_SUITES[1] !== 'root-probe') {
  console.error('[run-baseline] FAIL <usage> BASELINE_SUITES must start with provenance → root-probe (A7-4)')
  process.exit(2)
}
const CHANNEL_TEST = 'packages/persistence/test/cordis-root-channel.test.ts'
const REAL_TIMER_TEST = 'packages/persistence/test/cordis-root-real-timer.test.ts'
const PROVENANCE_TEST = 'packages/persistence/test/cordis-baseline-provenance.test.ts'
const DSH_PROFILE_TEST = 'packages/dsh-persistence/test/dsh-profile-acceptance.test.ts'
const UNLOAD_TEST = 'packages/namespace-registry/test/registry-sa7-rev1.test.ts'
const WS_PACKAGE_FILES = [
  'packages/ws-replication/test/ws-replication-plugin.test.ts',
  'packages/ws-replication/test/ws-replication-issue299-ac-red.test.ts',
  'packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts',
  'packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts',
]
const WS_CHANNEL_TEST = 'packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts'
const WS_TIMERS_TEST = 'packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts'
const WS_LIFECYCLE_TEST = 'packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts'
/** AC8-③: the issue420 session-host round belongs to the lifecycle suite (design F-3). */
const WS_LIFECYCLE_FILES = [
  WS_LIFECYCLE_TEST,
  'packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts',
]
/** AC6-A6-4: the wire/structure guards must have three-baseline cell evidence (SA8 B-4). */
const GUARD_PROXY_FILES = [
  'packages/clock/test/clock-guard-proxy-consumption.test.ts',
  'packages/namespace-registry/test/registry-guard-proxy-consumption.test.ts',
  'packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts',
  'packages/ws-replication/test/ws-replication-issue246-interop-matrix.test.ts',
  'packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts',
  'packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts',
  // A6-1 (SA10 §3.3): `nomicoreHubSessionHost` is the fifth guard-Proxy face. Its
  // consumption assertions live in the new channel file (the existing Hub/Peer guard file
  // is BASE-frozen), so the guard-proxy suite must run that file on every baseline.
  WS_CHANNEL_TEST,
]
const APP_COMPOSITION_FILES = [
  'apps/yjs-server/test/third-party-composition-red.test.ts',
  'apps/yjs-server/test/third-party-timer-ownership-red.test.ts',
  'apps/yjs-server/test/issue270-regression-anchors.test.ts',
  'apps/yjs-server/test/issue270-server-integration-red.test.ts',
  'apps/yjs-server/test/on-fatal-error-issue288.test.ts',
  'apps/yjs-server/test/persistence-drain-shutdown.test.ts',
  'packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts',
]
const UNLOAD_FILES = [
  'packages/namespace-registry/test/registry-sa7-rev1.test.ts',
  'packages/namespace-registry/test/registry-sa7-cordis.test.ts',
]
/**
 * T-1a: the pinned 23-name lifecycle enumeration (21 = 3 entries × 7 scenarios,
 * plus the β/γ supplement). `observed` counts only these names; the `coverage`
 * self-check (non-`L.` name) is a cell-level predicate but never a unit.
 */
const LIFECYCLE_UNITS = [
  ...['hub-listen', 'peer-dial', 'session-host'].flatMap((entry) =>
    ['startup', 'timer-fired', 'timer-cancelled', 'explicit-stop', 'fiber-dispose', 'service-revoked', 'remount']
      .map((scenario) => `L.${entry}.${scenario}`),
  ),
  'L.edge-beta.minimal-round',
  'L.async-gamma.minimal-round',
]
const WS_ALLOW = ['packages/ws-replication/src/plugin.ts', ...WS_PACKAGE_FILES]
const PERSISTENCE_ALLOW = ['packages/persistence/src/service.ts']
const ALLOW = [...PERSISTENCE_ALLOW, ...WS_ALLOW]

/** §11.1 N1–N11 — paths that may not be tracked yet when the red matrix runs. */
const NEW_FILES = [
  'packages/persistence/test/cordis-root-channel.test.ts',
  'packages/persistence/test/cordis-root-real-timer.test.ts',
  'packages/persistence/test/cordis-baseline-provenance.test.ts',
  'packages/persistence/test/cordis-public-surface.test.ts',
  'packages/persistence/test/fixtures/cordis-baselines/baselines.json',
  'packages/persistence/test/fixtures/cordis-baselines/provenance-b3.json',
  'packages/persistence/test/fixtures/cordis-baselines/public-surface.base.json',
  'packages/persistence/test/fixtures/cordis-baselines/acquire.mjs',
  'packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs',
  'packages/persistence/test/fixtures/cordis-baselines/root-probe.mjs',
  'packages/persistence/test/fixtures/cordis-baselines/gates.mjs',
  'packages/persistence/test/fixtures/cordis-baselines/root-test-known-red.json',
  'packages/ws-replication/test/ws-replication-cordis-root-channel.test.ts',
  'packages/ws-replication/test/ws-replication-cordis-root-timers.test.ts',
  'packages/ws-replication/test/ws-replication-cordis-baseline-lifecycle.test.ts',
  'packages/ws-replication/test/cordis-baseline-support.ts',
  'apps/yjs-server/test/third-party-timer-ownership-red.test.ts',
  'packages/dsh-persistence/test/dsh-profile-direct-apply-order.test.ts',
]

function fail(stage, message) {
  console.error(`[run-baseline] FAIL <${stage}> ${message}`)
  process.exit(2)
}

function log(message) {
  console.log(`[run-baseline] ${message}`)
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
}

function sha256hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function relative(target) {
  return path.relative(REPO, target)
}

function parseArgs(argv) {
  const options = {
    baselines: [],
    suites: [],
    typecheck: false,
    all: false,
    matrix: false,
    fault: undefined,
    rootTest: false,
    auditEvidence: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const value = () => {
      const next = argv[++i]
      if (next === undefined) fail('usage', `${arg} requires a value`)
      return next
    }
    if (arg === '--baseline') options.baselines.push(value())
    else if (arg === '--suite') options.suites.push(value())
    else if (arg === '--mode') {
      const mode = value()
      if (mode !== 'typecheck') fail('usage', `unsupported --mode ${mode}`)
      options.typecheck = true
    } else if (arg === '--all') options.all = true
    else if (arg === '--matrix') options.matrix = true
    else if (arg === '--fault') options.fault = value()
    else if (arg === '--audit-evidence') options.auditEvidence = true
    else fail('usage', `unknown argument ${arg}`)
  }
  if (options.suites.includes('root-test')) {
    options.rootTest = true
    options.suites = options.suites.filter((suite) => suite !== 'root-test')
  }
  for (const suite of options.suites) {
    // Every suite literal comes from the manifest (BASELINE_SUITES). `gates` is not a
    // suite: the gates cell is only produced by `--all --matrix` (design E3 cleanup).
    if (!BASELINE_SUITES.includes(suite)) {
      fail('usage', `unknown suite ${suite}`)
    }
  }
  if (options.fault !== undefined) {
    if (!['fallback', 'substitute-npm', 'substitute-rc12', 'legacy-shim'].includes(options.fault)) {
      fail('usage', `unknown fault ${options.fault}`)
    }
  }
  if (options.auditEvidence
    && (options.all || options.matrix || options.fault !== undefined || options.rootTest
      || options.typecheck || options.baselines.length > 0 || options.suites.length > 0)) {
    fail('usage', '--audit-evidence is a standalone mode (it audits the canonical evidence directory as-is)')
  }
  return options
}

// ---------------------------------------------------------------- artifacts

function provenanceDigestFor(baselineId) {
  const baseline = MANIFEST.baselines[baselineId]
  const payload =
    baseline.kind === 'npm'
      ? Object.entries(baseline.packages).map(([name, spec]) => `${name}@${spec.version}:${spec.integrity}`).join('\n')
      : `dsh:${baseline.commit}:${sha256hex(Buffer.from(JSON.stringify(PROVENANCE.outputs), 'utf8'))}`
  return sha256hex(Buffer.from(payload, 'utf8'))
}

function ensureArtifacts(baselineId) {
  const args = [path.join(HERE, 'acquire.mjs'), '--baseline', baselineId]
  const result = spawnSync(NODE, args, { cwd: REPO, encoding: 'utf8' })
  if (result.status !== 0) {
    fail('acquire', `acquire.mjs --baseline ${baselineId} exited ${result.status}\n${result.stdout}\n${result.stderr}`)
  }
  return result.stdout
}

// ---------------------------------------------------------------- workspace materialize

function copyTrackedTree(workspace) {
  const listed = execFileSync('git', ['ls-files', '-z'], { cwd: REPO, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 })
  const files = listed.toString('utf8').split('\0').filter(Boolean)
  let copied = 0
  for (const file of files) {
    const source = path.join(REPO, file)
    if (!fs.existsSync(source)) continue
    const target = path.join(workspace, file)
    mkdirp(path.dirname(target))
    fs.copyFileSync(source, target)
    copied += 1
  }
  return copied
}

function copyNewFiles(workspace) {
  const missing = NEW_FILES.filter((file) => !fs.existsSync(path.join(REPO, file)))
  if (missing.length > 0) {
    fail('materialize', `NEW_FILES missing from the working tree (a missing-file red is never valid evidence):\n  ${missing.join('\n  ')}`)
  }
  for (const file of NEW_FILES) {
    const target = path.join(workspace, file)
    mkdirp(path.dirname(target))
    fs.copyFileSync(path.join(REPO, file), target)
  }
  return NEW_FILES.length
}

function listWorkspacePackages(treeRoot) {
  const index = new Map()
  for (const top of ['packages', 'apps', 'domains']) {
    const dir = path.join(treeRoot, top)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      const manifest = path.join(dir, name, 'package.json')
      if (!fs.existsSync(manifest)) continue
      const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'))
      if (typeof parsed.name === 'string') index.set(parsed.name, path.dirname(manifest))
    }
  }
  return index
}

/**
 * Declaration-driven symlink farm (design §8.4 step 2):
 *   `@nomicore/*`               -> sibling package inside the workspace
 *   `@deepseek-ai/*`            -> the baseline overlay (the only per-baseline variance)
 *   every other dependency      -> realpath of the repository's existing install
 * No `@nomicore/*` is ever placed in the workspace root node_modules (C13: the
 * `core-dsh-boundary` reverse-dependency guard must stay genuinely green).
 */
function buildFarm(workspace, overlayDir, overrides) {
  const workspaceIndex = listWorkspacePackages(workspace)
  const packageDirOf = (name, sourcePackageDir) => {
    const require = createRequire(path.join(sourcePackageDir, 'package.json'))
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
        // next probe
      }
    }
    return undefined
  }
  const unresolved = []
  let linked = 0
  for (const [name, workspaceDir] of workspaceIndex) {
    const repoDir = path.join(REPO, path.relative(workspace, workspaceDir))
    const parsed = JSON.parse(fs.readFileSync(path.join(workspaceDir, 'package.json'), 'utf8'))
    const deps = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) }
    for (const dep of Object.keys(deps)) {
      let target
      if (overrides[dep] !== undefined) target = overrides[dep]
      else if (dep.startsWith('@nomicore/')) target = workspaceIndex.get(dep)
      else if (dep.startsWith('@deepseek-ai/')) target = path.join(overlayDir, 'node_modules', ...dep.split('/'))
      else target = packageDirOf(dep, repoDir)
      if (target === undefined || (dep.startsWith('@nomicore/') && !fs.existsSync(target))) {
        unresolved.push(`${name} -> ${dep}`)
        continue
      }
      if (dep.startsWith('@deepseek-ai/') && !fs.existsSync(target)) {
        unresolved.push(`${name} -> ${dep} (overlay ${relative(target)} missing)`)
        continue
      }
      const link = path.join(workspaceDir, 'node_modules', ...dep.split('/'))
      mkdirp(path.dirname(link))
      try {
        fs.symlinkSync(path.resolve(target), link, 'dir')
        linked += 1
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
      }
    }
  }
  if (unresolved.length > 0) {
    fail('materialize', `declared dependencies could not be linked:\n  ${unresolved.join('\n  ')}`)
  }
  // Workspace root: only the toolchain and @types (never @nomicore/*).
  const rootNodeModules = path.join(workspace, 'node_modules')
  mkdirp(rootNodeModules)
  for (const tool of ['typescript', 'vitest', 'tsx']) {
    const target = path.join(REPO, 'node_modules', tool)
    if (fs.existsSync(target)) {
      try {
        fs.symlinkSync(fs.realpathSync(target), path.join(rootNodeModules, tool), 'dir')
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
      }
    }
  }
  const typesSource = packageDirOf('@types/node', path.join(REPO, 'packages/persistence'))
  if (typesSource !== undefined) {
    const typesRoot = path.dirname(typesSource)
    mkdirp(path.join(rootNodeModules, '@types'))
    for (const entry of fs.readdirSync(typesRoot)) {
      try {
        fs.symlinkSync(path.join(fs.realpathSync(typesRoot), entry), path.join(rootNodeModules, '@types', entry), 'dir')
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
      }
    }
  }
  return { linked, packages: workspaceIndex.size }
}

function faultOverrides(baselineId, fault) {
  if (fault === undefined) return {}
  const overlay = (id) => path.join(CACHE, 'overlay', id, 'node_modules/@deepseek-ai')
  const repoDefault = (name) => {
    const require = createRequire(path.join(REPO, 'packages/persistence/package.json'))
    let dir = path.dirname(require.resolve(name))
    while (!fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir)
    return fs.realpathSync(dir)
  }
  if (fault === 'fallback') {
    // The rc.12 workspace is linked against the repository default install.
    return {
      '@deepseek-ai/cordis': repoDefault('@deepseek-ai/cordis'),
      '@deepseek-ai/cordis-plugin-timer': repoDefault('@deepseek-ai/cordis-plugin-timer'),
      '@deepseek-ai/cosmokit': path.join(path.dirname(repoDefault('@deepseek-ai/cordis')), 'cosmokit'),
    }
  }
  if (fault === 'substitute-npm') {
    // rc.12 workspace, cordis only, replaced by npm 4.1.0 (same name/version).
    return { '@deepseek-ai/cordis': path.join(overlay('B2'), 'cordis') }
  }
  if (fault === 'substitute-rc12') {
    // npm B2 workspace, cordis only, replaced by the DSH source build.
    return { '@deepseek-ai/cordis': path.join(CACHE, 'dsh/build/cordis') }
  }
  if (fault === 'legacy-shim') return {}
  return {}
}

function materialize(baselineId, fault) {
  const suffix = fault === undefined ? '' : `--fault-${fault}`
  const workspace = path.join(CACHE, 'workspaces', `${baselineId}${suffix}`)
  rmrf(workspace)
  mkdirp(workspace)
  const tracked = copyTrackedTree(workspace)
  const added = copyNewFiles(workspace)
  const baseline = MANIFEST.baselines[baselineId]
  const overrides = faultOverrides(baselineId, fault)
  const overlayDir = path.join(CACHE, 'overlay', baselineId)
  const farm = buildFarm(workspace, overlayDir, overrides)
  const filesPresent = Object.fromEntries(NEW_FILES.map((file) => [file, fs.existsSync(path.join(workspace, file))]))
  const allPresent = Object.values(filesPresent).every(Boolean)
  if (!allPresent) fail('materialize', 'workspace is missing NEW_FILES after materialization')
  log(
    `materialized ${relative(workspace)} (${tracked} tracked + ${added} new files, ${farm.packages} packages, `
    + `${farm.linked} links${fault === undefined ? '' : `, fault=${fault}`})`,
  )
  return { workspace, filesPresent, farm, overlayDir, expectedChannel: baseline.expectedChannel, baseline }
}

// ---------------------------------------------------------------- execution helpers

function envForWorkspace(extra = {}) {
  const env = { ...process.env, ...extra }
  // The workspace must not inherit the root layout's source condition (§8.4).
  delete env.NODE_OPTIONS
  if (extra.NODE_OPTIONS !== undefined) env.NODE_OPTIONS = extra.NODE_OPTIONS
  return env
}

/**
 * Per-cell identity environment for the workspace test runs (design §8.4/§8.5):
 * which baseline this workspace is, where its canonical overlay lives, the tree
 * root to scan for a second copy, and the expected Root channel. Test-only env —
 * it never reaches production src (gate G8).
 */
function cellEnv(baselineId, workspace) {
  const baseline = MANIFEST.baselines[baselineId]
  return {
    NOMICORE_CORDIS_RUNNER_MODE: '1',
    NOMICORE_CORDIS_BASELINE: baselineId,
    NOMICORE_CORDIS_BASELINE_ROOT: path.join(CACHE, 'overlay', baselineId),
    NOMICORE_CORDIS_TREE_ROOT: workspace,
    NOMICORE_CORDIS_EXPECTED_CHANNEL: baseline.expectedChannel,
    NOMICORE_CORDIS_DSH_CLONE: path.join(CACHE, 'dsh/clone'),
  }
}

function runVitest(baselineIdForRun, workspace, files, options = {}) {
  const { label, repeat, extraEnv, evidenceDir } = options
  const directory = evidenceDir ?? path.join(EVIDENCE, 'tmp')
  mkdirp(directory)
  const jsonPath = path.join(directory, `${label}.vitest.json`)
  const logPath = path.join(directory, `${label}.log`)
  const args = [
    VITEST,
    'run',
    '--config',
    'vitest.config.ts',
    '--passWithNoTests=false',
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${jsonPath}`,
    ...files,
  ]
  void repeat
  const result = spawnSync(NODE, args, {
    cwd: workspace,
    encoding: 'utf8',
    env: envForWorkspace({ ...(cellEnv(baselineIdForRun, workspace)), ...(extraEnv ?? {}) }),
    maxBuffer: 128 * 1024 * 1024,
  })
  fs.writeFileSync(logPath, `${result.stdout ?? ''}\n${result.stderr ?? ''}`)
  let json
  if (fs.existsSync(jsonPath)) {
    try {
      json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    } catch (error) {
      json = undefined
      log(`WARN unparsable vitest JSON for ${label}: ${error.message}`)
    }
  }
  const testNames = []
  const assertions = []
  let passed = 0
  let failed = 0
  for (const file of json?.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      const name = assertion.fullName ?? assertion.title
      const title = assertion.title ?? name
      testNames.push(name)
      assertions.push({ name, title, status: assertion.status })
      if (assertion.status === 'passed') passed += 1
      else if (assertion.status === 'failed') failed += 1
    }
  }
  return {
    status: result.status,
    exitCode: result.status,
    testNames,
    assertions,
    counts: { passed, failed, total: testNames.length, numTotalTests: json?.numTotalTests },
    logPath: relative(logPath),
    jsonPath: relative(jsonPath),
    evidence: json,
  }
}

function runTscProject(workspace, project, evidenceDir, label) {
  const logPath = path.join(evidenceDir, `${label}.log`)
  const result = spawnSync(NODE, [TSC, '-p', project], {
    cwd: workspace,
    encoding: 'utf8',
    env: envForWorkspace(),
    maxBuffer: 64 * 1024 * 1024,
  })
  fs.writeFileSync(logPath, `${result.stdout ?? ''}\n${result.stderr ?? ''}`)
  return { project, exitCode: result.status, logPath: relative(logPath), output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() }
}

function resolvedRealpaths(workspace) {
  const require = createRequire(path.join(workspace, 'packages/persistence/package.json'))
  const packageDir = (name) => {
    const entry = require.resolve(name)
    let dir = path.dirname(entry)
    while (!fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir)
    return fs.realpathSync(dir)
  }
  const result = {}
  for (const name of ['@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-timer']) {
    result[name] = relative(packageDir(name))
  }
  // Cosmokit is a transitive dependency: resolved from the resolved cordis
  // position. A polluted/faulted workspace may leave it unresolvable — this is
  // evidence metadata only (never an assertion), so record the fact instead of
  // aborting the cell. Identity assertions live in the provenance/root-probe
  // tests, which turn red on their own terms.
  try {
    const cosmokit = createRequire(path.join(packageDir('@deepseek-ai/cordis'), 'package.json')).resolve('@deepseek-ai/cosmokit')
    let dir = path.dirname(cosmokit)
    while (!fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir)
    result['@deepseek-ai/cosmokit'] = relative(fs.realpathSync(dir))
  } catch {
    result['@deepseek-ai/cosmokit'] = '<unresolved>'
  }
  return result
}

function writeEvidence(baselineId, suite, payload) {
  const dir = path.join(EVIDENCE, baselineId)
  mkdirp(dir)
  fs.writeFileSync(path.join(dir, `${suite}.json`), `${JSON.stringify(payload, null, 2)}\n`)
  return relative(path.join(dir, `${suite}.json`))
}

function baseCell(baselineId, suite, materialized) {
  return {
    baseline: baselineId,
    suite,
    status: 'fail',
    resolvedRealpaths: resolvedRealpaths(materialized.workspace),
    provenanceDigest: provenanceDigestFor(baselineId),
    testNames: [],
    logPath: '',
    expectedChannel: materialized.expectedChannel,
    filesPresent: materialized.filesPresent,
    allFilesPresent: Object.values(materialized.filesPresent).every(Boolean),
  }
}

function listPersistenceContractFiles(workspace) {
  const dir = path.join(workspace, 'packages/persistence/test')
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.test.ts'))
    .sort()
    .map((name) => `packages/persistence/test/${name}`)
  for (const file of files) {
    if (!fs.existsSync(path.join(workspace, file))) fail('suite-contract', `contract file disappeared: ${file}`)
  }
  return files
}

function ensureFiles(workspace, files, suite) {
  const missing = files.filter((file) => !fs.existsSync(path.join(workspace, file)))
  if (missing.length > 0) {
    fail(`suite-${suite}`, `target files missing from the workspace:\n  ${missing.join('\n  ')}`)
  }
}

// ---------------------------------------------------------------- suite runners

/** E4a: every runVitest call site carries the legacy-shim fault env (design F-1). */
function faultEnv(fault) {
  return fault === 'legacy-shim' ? { NOMICORE_CORDIS_FAULT: 'legacy-shim' } : {}
}

/**
 * T-1a unit accounting. The pinned enumeration is a *title* enumeration: vitest's
 * JSON reporter joins `ancestorTitles` with a single space (it does not use the
 * `' > '` separator the design text assumes), so the baseline label can only be
 * stripped reliably by reading `assertion.title`. `title` is exactly the per-test
 * name the design pins (`L.<entry>.<scenario>` / `coverage`); the full name stays
 * in `testNames` as evidence only.
 */
function unitNameOf(assertion) {
  return assertion.title ?? assertion.name ?? ''
}

function lifecycleUnits(assertions) {
  const seen = new Set()
  const foreign = []
  for (const assertion of assertions) {
    const unit = unitNameOf(assertion)
    if (!unit.startsWith('L.')) continue
    if (!LIFECYCLE_UNITS.includes(unit)) foreign.push(unit)
    if (assertion.status === 'passed') seen.add(unit)
  }
  const missing = LIFECYCLE_UNITS.filter((unit) => !seen.has(unit))
  return {
    units: { expected: LIFECYCLE_UNITS.length, observed: seen.size, missing },
    foreignUnits: [...new Set(foreign)].sort(),
    coverage: assertions.some((assertion) => unitNameOf(assertion) === 'coverage' && assertion.status === 'passed'),
  }
}

/**
 * Per-repeat lifecycle judgement (SA9-4): 23/23 pinned units observed, the `coverage`
 * self-check green, no `L.` name outside the pinned enumeration, and the AC8-③ issue420
 * session-host round contributing at least one test — computed for one run.
 */
function lifecycleJudgement(run) {
  const judgement = lifecycleUnits(run.assertions)
  // AC8-③/F-3: the issue420 session-host round belongs to this suite — the evidence must
  // show that file contributing tests, not merely "some names".
  const issue420 = (run.evidence?.testResults ?? []).find((file) =>
    String(file.name ?? '').replaceAll('\\', '/').endsWith('packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts'),
  )
  const issue420Tests = (issue420?.assertionResults ?? []).length
  const hasIssue420 = issue420Tests > 0
  // T-1a pass predicate: 23/23 units observed, the `coverage` self-check green, no `L.`
  // name outside the pinned enumeration, and the issue420 round present (fail-closed).
  const ok = judgement.units.observed === LIFECYCLE_UNITS.length
    && judgement.coverage
    && judgement.foreignUnits.length === 0
    && hasIssue420
  return {
    units: judgement.units,
    foreignUnits: judgement.foreignUnits,
    coverage: judgement.coverage,
    issue420: { present: hasIssue420, tests: issue420Tests },
    ok,
  }
}

function runSuite(baselineId, suite, materialized, fault, evidenceSubdir) {
  const cell = baseCell(baselineId, suite, materialized)
  const evidenceDir = path.join(EVIDENCE, baselineId, evidenceSubdir ?? '')
  mkdirp(evidenceDir)
  const extraFaultEnv = faultEnv(fault)

  // ---- multi-run (repeat) suites: provenance / contract / real-timer / dsh-profile /
  // unload (two files) / ws-cordis-timers (repeat 3) / replication-lifecycle (repeat 3)
  if (suite === 'provenance' || suite === 'contract' || suite === 'real-timer'
    || suite === 'dsh-profile' || suite === 'unload' || suite === 'ws-cordis-timers'
    || suite === 'replication-lifecycle') {
    const files =
      suite === 'provenance'
        ? [PROVENANCE_TEST]
        : suite === 'contract'
          ? listPersistenceContractFiles(materialized.workspace)
          : suite === 'real-timer'
            ? [REAL_TIMER_TEST]
            : suite === 'dsh-profile'
              ? [DSH_PROFILE_TEST]
              : suite === 'unload'
                ? UNLOAD_FILES
                : suite === 'ws-cordis-timers'
                  ? [WS_TIMERS_TEST]
                  : WS_LIFECYCLE_FILES
    ensureFiles(materialized.workspace, files, suite)
    const repeat = suite === 'real-timer' || suite === 'ws-cordis-timers' || suite === 'replication-lifecycle' ? 3 : 1
    const runs = []
    for (let attempt = 1; attempt <= repeat; attempt++) {
      runs.push(
        runVitest(baselineId, materialized.workspace, files, {
          label: repeat === 1 ? `${baselineId}-${suite}` : `${baselineId}-${suite}-repeat${attempt}`,
          evidenceDir,
          extraEnv: extraFaultEnv,
        }),
      )
      if (runs[runs.length - 1].exitCode !== 0) break
    }
    const run = runs[runs.length - 1]
    cell.testNames = run.testNames
    cell.counts = run.counts
    cell.logPath = run.logPath
    cell.exitCode = run.exitCode
    cell.repeat = repeat
    cell.repeatRuns = runs.map((entry) => ({ exitCode: entry.exitCode, counts: entry.counts, logPath: entry.logPath }))
    if (suite === 'unload') {
      const hasR5P = run.testNames.some((name) => name.startsWith('R5P.') || name.includes('R5P.'))
      cell.r5p = { present: hasR5P, passed: hasR5P && run.exitCode === 0 }
      if (!hasR5P) cell.note = 'R5P. test name not found in the unload suite'
    }
    let lifecycleOk = true
    if (suite === 'replication-lifecycle') {
      // SA9-4: the 23-name enumeration / coverage / foreign-name / issue420 predicates are
      // evaluated for EVERY repeat, not only for the last one, and all of them must pass.
      // A later repeat can otherwise mask a collection or naming defect in an earlier one.
      const judgements = runs.map((entry) => lifecycleJudgement(entry))
      cell.repeatJudgements = judgements
      const last = judgements[judgements.length - 1]
      cell.units = last.units
      cell.foreignUnits = last.foreignUnits
      cell.coverage = last.coverage
      cell.issue420 = last.issue420
      lifecycleOk = runs.length === repeat && judgements.every((entry) => entry.ok)
    }
    const everyRepeatGreen = runs.every((entry) => entry.exitCode === 0 && entry.counts.failed === 0 && entry.counts.total > 0)
    cell.status = everyRepeatGreen && lifecycleOk && (!cell.r5p || cell.r5p.passed) ? 'pass' : 'fail'
    return cell
  }

  if (suite === 'root-probe') {
    const probeLog = path.join(evidenceDir, `${baselineId}-root-probe.mjs.log`)
    const probe = spawnSync(
      NODE,
      [
        path.join(HERE, 'root-probe.mjs'),
        '--resolve-from',
        path.join(materialized.workspace, 'packages/persistence'),
        '--baseline',
        baselineId,
        '--json',
      ],
      { cwd: REPO, encoding: 'utf8', env: envForWorkspace() },
    )
    fs.writeFileSync(probeLog, `${probe.stdout ?? ''}\n${probe.stderr ?? ''}`)
    ensureFiles(materialized.workspace, [CHANNEL_TEST], suite)
    const channel = runVitest(baselineId, materialized.workspace, [CHANNEL_TEST], {
      label: `${baselineId}-root-probe`,
      evidenceDir,
      extraEnv: extraFaultEnv,
    })
    cell.testNames = channel.testNames
    cell.counts = channel.counts
    cell.logPath = channel.logPath
    cell.exitCode = channel.exitCode
    cell.probe = {
      exitCode: probe.status,
      logPath: relative(probeLog),
      report: (() => {
        try {
          return JSON.parse(probe.stdout)
        } catch {
          return undefined
        }
      })(),
    }
    cell.status =
      probe.status === 0 && channel.exitCode === 0 && channel.counts.failed === 0 && channel.counts.total > 0
        ? 'pass'
        : 'fail'
    return cell
  }

  // ---- per-file suites: ws-package / guard-proxy / composition-root
  if (suite === 'ws-package' || suite === 'guard-proxy' || suite === 'composition-root') {
    const files = suite === 'ws-package'
      ? WS_PACKAGE_FILES
      : suite === 'guard-proxy'
        ? GUARD_PROXY_FILES
        : APP_COMPOSITION_FILES
    ensureFiles(materialized.workspace, files, suite)
    const runs = []
    let failed = 0
    let passed = 0
    const names = []
    for (const file of files) {
      const run = runVitest(baselineId, materialized.workspace, [file], {
        label: `${baselineId}-${suite}-${path.basename(file, '.test.ts')}`,
        evidenceDir,
        extraEnv: extraFaultEnv,
      })
      runs.push({ file, exitCode: run.exitCode, counts: run.counts, logPath: run.logPath })
      failed += run.counts.failed
      passed += run.counts.passed
      names.push(...run.testNames)
      if (run.exitCode !== 0 || run.counts.failed > 0 || run.counts.total === 0) failed += 1
    }
    cell.testNames = names
    cell.counts = { passed, failed, total: names.length }
    cell.files = runs
    cell.filesPresent = Object.fromEntries(files.map((file) => [file, fs.existsSync(path.join(materialized.workspace, file))]))
    cell.logPath = runs[0]?.logPath ?? ''
    cell.status = failed === 0 && names.length > 0 ? 'pass' : 'fail'
    if (suite === 'guard-proxy') {
      // A6-4 / SA8 B-4: the interop matrix and both structure guards must be present and
      // green. Presence is a *file-level* fact (the runner holds the exact three paths —
      // their test titles are Chinese sentences, so substring-matching English words in
      // titles is not a presence proof); "green" is that file's own run: exit 0, zero
      // failed, at least one test actually executed. The per-file titles are kept as
      // evidence so the presence claim is auditable without re-deriving it.
      const a64Targets = {
        issue246: 'ws-replication-issue246-interop-matrix.test.ts',
        issue418Contract: 'ws-replication-issue418-edge-session-split-contract.test.ts',
        issue418Structure: 'ws-replication-issue418-edge-session-split-structure.test.ts',
      }
      cell.a64 = {}
      for (const [key, fileName] of Object.entries(a64Targets)) {
        const run = runs.find((entry) => entry.file.endsWith(fileName))
        const ok = run !== undefined && run.exitCode === 0 && run.counts.failed === 0 && run.counts.total > 0
        cell.a64[key] = ok
        if (!ok) cell.status = 'fail'
        if (!ok) cell.note = `A6-4 guard-proxy file missing or not green: ${fileName}`
      }
    }
    return cell
  }

  // ---- single-file, repeat-1 suite: ws-cordis-channel
  if (suite === 'ws-cordis-channel') {
    ensureFiles(materialized.workspace, [WS_CHANNEL_TEST], suite)
    const run = runVitest(baselineId, materialized.workspace, [WS_CHANNEL_TEST], {
      label: `${baselineId}-${suite}`,
      evidenceDir,
      extraEnv: extraFaultEnv,
    })
    cell.testNames = run.testNames
    cell.counts = run.counts
    cell.logPath = run.logPath
    cell.exitCode = run.exitCode
    cell.repeat = 1
    cell.repeatRuns = [{ exitCode: run.exitCode, counts: run.counts, logPath: run.logPath }]
    cell.status = run.exitCode === 0 && run.counts.failed === 0 && run.counts.total > 0 ? 'pass' : 'fail'
    return cell
  }

  fail('suite', `unsupported suite ${suite}`)
}

function runTypecheckCell(baselineId, materialized) {
  const projectList = execFileSync(NODE, ['-e', "process.stdout.write(require('./package.json').scripts.typecheck)"], {
    cwd: REPO,
    encoding: 'utf8',
  })
  const projects = [...projectList.matchAll(/tsc -p (\S+)/g)].map((match) => match[1])
  if (projects.length === 0) fail('typecheck', 'could not parse the root scripts.typecheck project list')
  const evidenceDir = path.join(EVIDENCE, baselineId)
  mkdirp(evidenceDir)
  const results = []
  for (const project of projects) {
    const label = `${baselineId}-typecheck-${project.replace(/[/.]/g, '_')}`
    results.push(runTscProject(materialized.workspace, project, evidenceDir, label))
  }
  const failed = results.filter((result) => result.exitCode !== 0)
  const logPath = path.join(evidenceDir, `${baselineId}-typecheck.json`)
  fs.writeFileSync(logPath, `${JSON.stringify(results.map(({ project, exitCode, logPath: projectLog }) => ({ project, exitCode, logPath: projectLog })), null, 2)}\n`)
  return {
    baseline: baselineId,
    suite: 'typecheck',
    status: failed.length === 0 ? 'pass' : 'fail',
    resolvedRealpaths: resolvedRealpaths(materialized.workspace),
    provenanceDigest: provenanceDigestFor(baselineId),
    testNames: [],
    logPath: relative(logPath),
    projectCount: projects.length,
    projects: results.map(({ project, exitCode }) => ({ project, exitCode })),
    failures: failed.map((result) => ({ project: result.project, exitCode: result.exitCode, logPath: result.logPath, output: result.output.slice(0, 4000) })),
    filesPresent: materialized.filesPresent,
  }
}

function runGatesCell() {
  const logPath = path.join(EVIDENCE, 'gates', 'gates.log')
  mkdirp(path.dirname(logPath))
  const result = spawnSync(NODE, [path.join(HERE, 'gates.mjs')], { cwd: REPO, encoding: 'utf8' })
  fs.writeFileSync(logPath, `${result.stdout ?? ''}\n${result.stderr ?? ''}`)
  return {
    baseline: 'default',
    suite: 'gates',
    status: result.status === 0 ? 'pass' : 'fail',
    resolvedRealpaths: {},
    provenanceDigest: provenanceDigestFor('B3'),
    testNames: [],
    logPath: relative(logPath),
    exitCode: result.status,
    // #472 D-10 / SA2-5: keep EVERY `[gates]` line (13 gates = 14 lines incl. the
    // summary). The old `slice(-12)` silently dropped G1′ at 12 gates and would drop
    // G2 at 13 — a magic constant drifts with the gate count.
    summary: (result.stdout ?? '').split('\n').filter((line) => line.startsWith('[gates]')),
  }
}

function readKnownRedLedger() {
  const ledgerPath = path.join(HERE, 'root-test-known-red.json')
  if (!fs.existsSync(ledgerPath)) fail('root-test', 'missing root-test-known-red.json (S4 ledger)')
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
  return {
    knownRed: new Set(ledger.knownRed ?? []),
    environmentRed: new Set(ledger.environmentRed ?? []),
    ticket: ledger.ticket,
  }
}

function runRootTestCell() {
  const logPath = path.join(EVIDENCE, 'root-test', 'root-test.log')
  const jsonPath = path.join(EVIDENCE, 'root-test', 'root-test.vitest.json')
  mkdirp(path.dirname(logPath))
  if (!fs.existsSync(VITEST)) fail('root-test', `default layout vitest missing at ${relative(VITEST)}`)
  // SA9-1 (evidence fail-closed): the JSON reporter file is the ONLY accepted evidence, and
  // it must be produced by THIS run. A JSON left behind by an earlier run is not evidence:
  // delete it before the run, then require presence, parsability, a fresh mtime, a positive
  // total and exact name/count agreement. Any failure is a red cell — the known-red ledger
  // may explain failures, never missing evidence.
  fs.rmSync(jsonPath, { force: true })
  const startedAt = Date.now()
  const result = spawnSync(
    NODE,
    [
      VITEST,
      'run',
      '--typecheck',
      '--passWithNoTests=false',
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${jsonPath}`,
    ],
    {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '--conditions=nomicore-source' },
      maxBuffer: 256 * 1024 * 1024,
    },
  )
  fs.writeFileSync(logPath, `${result.stdout ?? ''}\n${result.stderr ?? ''}`)
  const problems = []
  if (result.status === null) problems.push('root-test vitest process was terminated by a signal')
  let json
  if (!fs.existsSync(jsonPath)) {
    problems.push('root-test JSON evidence missing: the reporter wrote no file for this run')
  } else {
    try {
      json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    } catch (error) {
      problems.push(`root-test JSON unparsable: ${error.message}`)
    }
    const writtenAt = fs.statSync(jsonPath).mtimeMs
    if (writtenAt < startedAt) {
      problems.push(`root-test JSON is stale: mtime=${new Date(writtenAt).toISOString()} predates this run (${new Date(startedAt).toISOString()})`)
    }
  }
  // B-3b: failedTestNames must be extracted from the JSON reporter (incl. the test-d
  // lane). A count-level approximation is never accepted.
  let counts
  const testNames = []
  const failedTestNames = []
  if (json !== undefined) {
    counts = { numTotalTests: json.numTotalTests, numPassedTests: json.numPassedTests, numFailedTests: json.numFailedTests }
    for (const testFile of json.testResults ?? []) {
      for (const assertion of testFile.assertionResults ?? []) {
        const name = assertion.fullName ?? assertion.title
        testNames.push(name)
        if (assertion.status === 'failed') failedTestNames.push(name)
      }
    }
    const finite = (value) => typeof value === 'number' && Number.isFinite(value)
    if (![counts.numTotalTests, counts.numPassedTests, counts.numFailedTests].every(finite)) {
      problems.push(`root-test JSON counts are not finite numbers: ${JSON.stringify(counts)}`)
    } else {
      if (counts.numTotalTests <= 0) problems.push('root-test JSON reports zero tests (--passWithNoTests=false must make that impossible)')
      if (testNames.length !== counts.numTotalTests) {
        problems.push(`root-test JSON test extraction mismatch: numTotalTests=${counts.numTotalTests} extracted=${testNames.length}`)
      }
      if (failedTestNames.length !== counts.numFailedTests) {
        problems.push(`root-test JSON failed-name extraction mismatch: numFailedTests=${counts.numFailedTests} extracted=${failedTestNames.length}`)
      }
    }
  }
  const ledger = readKnownRedLedger()
  // B-3d: complete-test-name set inclusion (never a count-level approximation).
  const failedUnexpected = failedTestNames.filter((name) => !ledger.knownRed.has(name) && !ledger.environmentRed.has(name))
  const disclosure = {
    knownRed: [...ledger.knownRed].sort(),
    environmentRed: [...ledger.environmentRed].sort(),
    failedTestNames: [...failedTestNames].sort(),
    failedUnexpected: [...failedUnexpected].sort(),
    statement: 'root-test is judged by the frozen known-red ledger (SA8 B-3a…e) on fresh, complete JSON evidence; this ticket does not claim the root-test / CI / all existing tests are green.',
  }
  const pnpmProbe = spawnSync('pnpm', ['--version'], { cwd: REPO, encoding: 'utf8' })
  const evidenceOk = problems.length === 0
  return {
    baseline: 'default',
    suite: 'root-test',
    status: evidenceOk && failedUnexpected.length === 0 ? 'pass' : 'fail',
    exitCode: result.status,
    resolvedRealpaths: {},
    provenanceDigest: provenanceDigestFor('B1'),
    testNames,
    failedTestNames,
    failedUnexpected,
    disclosure,
    evidence: { jsonPath: relative(jsonPath), fresh: evidenceOk, problems },
    ledger: { knownRed: ledger.knownRed.size, environmentRed: ledger.environmentRed.size },
    logPath: relative(logPath),
    counts: counts === undefined
      ? undefined
      : {
          passed: counts.numPassedTests,
          failed: counts.numFailedTests,
          total: counts.numTotalTests,
          ...counts,
        },
    diagnostics: {
      node: process.version,
      pnpmProbe: { exitCode: pnpmProbe.status, stdout: (pnpmProbe.stdout ?? '').trim().slice(0, 200), stderr: (pnpmProbe.stderr ?? '').trim().slice(0, 400) },
      command: 'NODE_OPTIONS=--conditions=nomicore-source node <repo>/node_modules/vitest/vitest.mjs run --typecheck --passWithNoTests=false',
    },
  }
}

// ---------------------------------------------------------------- evidence audit

/**
 * Fail-closed evidence audit (#472 design §7.4, D13 / N-6…N-9).
 *
 * Checks, one miss => exit 1 with the full `problems` array printed:
 *   1. run marker exists/parsable; standalone mode binds the current HEAD to
 *      `marker.head`; BOTH modes compare `git write-tree` to `marker.tree`
 *      (tracked/index tree drift during the run is a red point).
 *   2. the 39 baseline cells + gates + root-test (= 41) exist, parse, are
 *      `status === 'pass'`, and their baseline/suite fields match the
 *      directory/filename placement.
 *   3. digest expectations: 39 baseline cells pin `provenanceDigestFor(baseline)`,
 *      the gates cell pins B3, the root-test cell pins B1 (runner zero-change).
 *   4. freshness: every required evidence file's mtime >= marker mtime;
 *      `matrix.json.generatedAt >= marker.startedAt`.
 *   5. `matrix.json` has exactly 41 cells, the (baseline, suite) multiset matches,
 *      every cell passes; the root-test cell carries `failedUnexpected === []`
 *      and finite positive counts.
 *   6. logPath judgement: every recorded log path (cell/repeat/per-file/root-probe
 *      mjs log, plus the 15 per-project typecheck logs and the derived
 *      `*.vitest.json` siblings) exists, resolves inside `evidence/` (no `..`
 *      escape / outside absolute path / default-runner `tmp/` reference) and is
 *      fresh.
 *   7. directory discipline: exact top-level allowlist, the six allowed file
 *      classes under `evidence/<B>/`, fault-* directories recursively only
 *      `*.log` / `*.vitest.json`, and exact contents for gates/root-test/matrix.
 *
 * Threat model (design §7.4): this catches accidental stale/cross-run reuse and
 * mid-run tree drift, not adversarial forgery — the latter is covered by the
 * single-tree marker binding and the final-verification rerun on `R`.
 */
function gitOutput(args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim()
}

function writeRunMarker() {
  mkdirp(EVIDENCE)
  const marker = {
    startedAt: new Date().toISOString(),
    head: gitOutput(['rev-parse', 'HEAD']),
    tree: gitOutput(['write-tree']),
    porcelain: gitOutput(['status', '--porcelain']),
  }
  fs.writeFileSync(path.join(EVIDENCE, 'run-marker.json'), `${JSON.stringify(marker, null, 2)}\n`)
  return marker
}

function readJsonEvidence(absolutePath, label, problems) {
  if (!fs.existsSync(absolutePath)) {
    problems.push(`missing required evidence: ${relative(absolutePath)}`)
    return undefined
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    problems.push(`unparsable evidence: ${relative(absolutePath)} (${error.message})`)
    return undefined
  }
}

/** The required 41-cell evidence set: 39 baseline cells + gates + root-test. */
function requiredEvidenceCells() {
  const cells = []
  for (const baselineId of Object.keys(MANIFEST.baselines)) {
    cells.push({ baseline: baselineId, suite: 'typecheck' })
    for (const suite of BASELINE_SUITES) cells.push({ baseline: baselineId, suite })
  }
  cells.push({ baseline: 'default', suite: 'gates' })
  cells.push({ baseline: 'default', suite: 'root-test' })
  return cells
}

function evidencePathFor(cell) {
  const dir = cell.baseline === 'default' ? cell.suite : cell.baseline
  return path.join(EVIDENCE, dir, `${cell.suite}.json`)
}

const EVIDENCE_ROOT = path.resolve(EVIDENCE)

/** Check 6(a)/(b): resolve, require containment in evidence/ and no tmp/ default. */
function containedEvidencePath(relPath, label, problems) {
  const absolute = path.resolve(REPO, relPath)
  const fromRoot = path.relative(EVIDENCE_ROOT, absolute)
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) {
    problems.push(`${label}: path escapes evidence/: ${relPath}`)
    return undefined
  }
  if (fromRoot.split(path.sep)[0] === 'tmp') {
    problems.push(`${label}: path references the default-runner tmp dir: ${relPath}`)
    return undefined
  }
  return absolute
}

function checkEvidenceFile(relPath, label, problems, markerTime, kind) {
  const absolute = containedEvidencePath(relPath, label, problems)
  if (absolute === undefined) return
  if (!fs.existsSync(absolute)) {
    problems.push(`${label}: file does not exist: ${relPath}`)
    return
  }
  if (markerTime !== undefined && fs.statSync(absolute).mtimeMs < markerTime) {
    problems.push(`${label}: stale (mtime predates the run marker): ${relPath}`)
  }
  if (kind === 'vitest') {
    const jsonAbsolute = absolute.replace(/\.log$/, '.vitest.json')
    if (jsonAbsolute === absolute) {
      problems.push(`${label}: vitest log path does not end in .log: ${relPath}`)
      return
    }
    checkEvidenceFile(relative(jsonAbsolute), `${label} (vitest JSON)`, problems, markerTime, 'plain')
  }
}

/** Check 6: every recorded log path of a required cell, plus the derived JSONs. */
function checkCellLogPaths(cell, problems, markerTime) {
  const label = `${cell.baseline}/${cell.suite}`
  if (typeof cell.logPath !== 'string' || cell.logPath === '') {
    problems.push(`${label}: missing logPath`)
  } else {
    // gates/root-test/typecheck logPath files are not produced by runVitest (no
    // derived `*.vitest.json`); root-test's JSON is checked via evidence.jsonPath.
    const plainLogSuites = new Set(['typecheck', 'gates', 'root-test'])
    checkEvidenceFile(cell.logPath, `${label} logPath`, problems, markerTime, plainLogSuites.has(cell.suite) ? 'plain' : 'vitest')
    if (cell.suite === 'typecheck') {
      const aggregate = readJsonEvidence(path.resolve(REPO, cell.logPath), `${label} typecheck aggregate`, problems)
      if (Array.isArray(aggregate)) {
        if (aggregate.length !== 15) {
          problems.push(`${label}: typecheck aggregate must carry 15 per-project logs, got ${aggregate.length}`)
        }
        for (const project of aggregate) {
          if (typeof project.logPath !== 'string') {
            problems.push(`${label}: typecheck aggregate entry ${JSON.stringify(project.project)} is missing logPath`)
            continue
          }
          checkEvidenceFile(project.logPath, `${label} typecheck ${project.project}`, problems, markerTime, 'plain')
        }
      } else if (aggregate !== undefined) {
        problems.push(`${label}: typecheck aggregate is not an array`)
      }
    }
  }
  for (const run of cell.repeatRuns ?? []) {
    if (typeof run.logPath !== 'string') problems.push(`${label}: repeat run is missing logPath`)
    else checkEvidenceFile(run.logPath, `${label} repeat`, problems, markerTime, 'vitest')
  }
  for (const entry of cell.files ?? []) {
    if (typeof entry.logPath !== 'string') problems.push(`${label}: per-file run is missing logPath (${entry.file ?? '?'})`)
    else checkEvidenceFile(entry.logPath, `${label} ${path.basename(String(entry.file ?? 'file'))}`, problems, markerTime, 'vitest')
  }
  if (cell.probe !== undefined) {
    if (typeof cell.probe.logPath !== 'string') problems.push(`${label}: root-probe is missing the probe logPath`)
    else checkEvidenceFile(cell.probe.logPath, `${label} root-probe.mjs`, problems, markerTime, 'plain')
  }
  if (cell.evidence !== undefined && typeof cell.evidence.jsonPath === 'string') {
    checkEvidenceFile(cell.evidence.jsonPath, `${label} vitest JSON`, problems, markerTime, 'plain')
  }
}

/** Check 1: marker binding. */
function auditRunMarker(problems, standalone) {
  const markerPath = path.join(EVIDENCE, 'run-marker.json')
  if (!fs.existsSync(markerPath)) {
    problems.push('missing run marker: evidence/run-marker.json (a matrix run without a start marker is not evidence)')
    return undefined
  }
  let marker
  try {
    marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
  } catch (error) {
    problems.push(`run marker unparsable: ${error.message}`)
    return undefined
  }
  for (const field of ['startedAt', 'head', 'tree', 'porcelain']) {
    if (typeof marker[field] !== 'string') problems.push(`run marker: field ${field} missing/not a string`)
  }
  if (typeof marker.startedAt === 'string' && !Number.isFinite(Date.parse(marker.startedAt))) {
    problems.push('run marker: startedAt is not a parsable timestamp')
  }
  if (standalone) {
    const head = gitOutput(['rev-parse', 'HEAD'])
    if (head !== marker.head) {
      problems.push(`evidence belongs to another tree: marker.head=${marker.head} current HEAD=${head}`)
    }
  }
  const tree = gitOutput(['write-tree'])
  if (tree !== marker.tree) {
    problems.push(`tracked tree drifted during the run: marker.tree=${marker.tree} current write-tree=${tree}`)
  }
  return marker
}

/** Checks 2/3/4: required cell set, identity digests, freshness. */
function auditRequiredCells(problems, markerTime) {
  for (const cell of requiredEvidenceCells()) {
    const label = `${cell.baseline}/${cell.suite}`
    const file = evidencePathFor(cell)
    const parsed = readJsonEvidence(file, label, problems)
    if (parsed === undefined) continue
    if (markerTime !== undefined && fs.statSync(file).mtimeMs < markerTime) {
      problems.push(`${label}: stale evidence (mtime predates the run marker): ${relative(file)}`)
    }
    if (parsed.status !== 'pass') problems.push(`${label}: status=${JSON.stringify(parsed.status)}`)
    if (parsed.baseline !== cell.baseline) {
      problems.push(`${label}: baseline field=${JSON.stringify(parsed.baseline)} ≠ placement ${cell.baseline}`)
    }
    if (parsed.suite !== cell.suite) {
      problems.push(`${label}: suite field=${JSON.stringify(parsed.suite)} ≠ filename ${cell.suite}`)
    }
    const expectedDigest = cell.suite === 'gates'
      ? provenanceDigestFor('B3')
      : cell.suite === 'root-test'
        ? provenanceDigestFor('B1')
        : provenanceDigestFor(cell.baseline)
    if (parsed.provenanceDigest !== expectedDigest) {
      problems.push(`${label}: provenanceDigest=${JSON.stringify(parsed.provenanceDigest)} expected ${expectedDigest}`)
    }
    checkCellLogPaths(parsed, problems, markerTime)
  }
}

/** Check 5: matrix cell multiset / all-pass / root-test ledger predicate. */
function auditMatrix(problems, marker) {
  const matrix = readJsonEvidence(path.join(EVIDENCE, 'matrix', 'matrix.json'), 'matrix', problems)
  if (matrix === undefined) return
  if (!Array.isArray(matrix.cells)) {
    problems.push('matrix.json: cells is not an array')
    return
  }
  const expectedKeys = requiredEvidenceCells().map((cell) => `${cell.baseline}/${cell.suite}`).sort()
  if (matrix.cells.length !== 41) {
    problems.push(`matrix.json: expected exactly 41 cells, got ${matrix.cells.length}`)
  }
  const actualKeys = matrix.cells.map((cell) => `${cell.baseline}/${cell.suite}`).sort()
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    const missing = expectedKeys.filter((key) => !actualKeys.includes(key))
    const unexpected = actualKeys.filter((key) => !expectedKeys.includes(key))
    problems.push(`matrix.json: (baseline, suite) multiset mismatch; missing=[${missing.join(', ')}] unexpected=[${unexpected.join(', ')}]`)
  }
  for (const cell of matrix.cells) {
    if (cell.status !== 'pass') problems.push(`matrix.json: cell ${cell.baseline}/${cell.suite} status=${JSON.stringify(cell.status)}`)
  }
  const rootCell = matrix.cells.find((cell) => cell.suite === 'root-test')
  if (rootCell === undefined) {
    problems.push('matrix.json: missing the root-test cell')
  } else {
    if (!Array.isArray(rootCell.failedUnexpected) || rootCell.failedUnexpected.length !== 0) {
      problems.push(`matrix.json: root-test failedUnexpected must be [], got ${JSON.stringify(rootCell.failedUnexpected)} (a new red is a regression, never a ledger item)`)
    }
    const counts = rootCell.counts ?? {}
    for (const key of ['passed', 'failed', 'total']) {
      if (!Number.isFinite(counts[key])) problems.push(`matrix.json: root-test counts.${key} is not a finite number`)
    }
    if (Number.isFinite(counts.total) && counts.total <= 0) {
      problems.push('matrix.json: root-test counts.total must be positive (--passWithNoTests=false must make zero impossible)')
    }
  }
  if (marker !== undefined) {
    if (typeof matrix.generatedAt !== 'string' || !Number.isFinite(Date.parse(matrix.generatedAt))) {
      problems.push('matrix.json: generatedAt missing/unparsable')
    } else if (Date.parse(matrix.generatedAt) < Date.parse(marker.startedAt)) {
      problems.push(`matrix.json: generatedAt ${matrix.generatedAt} predates the run marker ${marker.startedAt}`)
    }
    if (matrix.runHead !== marker.head) {
      problems.push(`matrix.json: runHead=${JSON.stringify(matrix.runHead)} ≠ marker.head=${marker.head} (single-tree binding)`)
    }
    if (matrix.runTree !== marker.tree) {
      problems.push(`matrix.json: runTree=${JSON.stringify(matrix.runTree)} ≠ marker.tree=${marker.tree} (tracked tree binding)`)
    }
  }
}

/** Check 7: exact directory discipline against the real evidence layout. */
function auditFaultDirectory(dir, label, problems) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      problems.push(`${label}/${entry.name}: nested directory inside a fault-* directory`)
      continue
    }
    if (!entry.name.endsWith('.log') && !entry.name.endsWith('.vitest.json')) {
      problems.push(`${label}/${entry.name}: only {*.log, *.vitest.json} may live in a fault-* directory`)
    }
  }
}

function auditEvidenceDirectory(problems) {
  const allowedTopDirs = new Set(['B1', 'B2', 'B3', 'gates', 'root-test', 'matrix', 'tmp'])
  for (const entry of fs.readdirSync(EVIDENCE, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!allowedTopDirs.has(entry.name)) problems.push(`evidence/: unexpected directory ${entry.name}`)
    } else if (entry.name !== 'run-marker.json') {
      problems.push(`evidence/: unexpected file ${entry.name}`)
    }
  }
  const cellJsonNames = new Set(['typecheck', ...BASELINE_SUITES].map((suite) => `${suite}.json`))
  for (const baselineId of Object.keys(MANIFEST.baselines)) {
    const dir = path.join(EVIDENCE, baselineId)
    if (!fs.existsSync(dir)) {
      problems.push(`evidence/: missing baseline directory ${baselineId}`)
      continue
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name
      const label = `evidence/${baselineId}/${name}`
      if (entry.isDirectory()) {
        if (!name.startsWith('fault-')) {
          problems.push(`${label}: unexpected directory`)
          continue
        }
        auditFaultDirectory(path.join(dir, name), label, problems)
        continue
      }
      const allowed = cellJsonNames.has(name)
        || name === `${baselineId}-typecheck.json`
        || (name.startsWith(`${baselineId}-`) && name.endsWith('.log'))
        || (name.startsWith(`${baselineId}-`) && name.endsWith('.vitest.json'))
        || (name.startsWith('fault-') && name.endsWith('.json'))
      if (!allowed) problems.push(`${label}: file outside the six allowed classes`)
    }
  }
  const fixedDirectories = {
    gates: ['gates.json', 'gates.log'],
    'root-test': ['root-test.json', 'root-test.log', 'root-test.vitest.json'],
    matrix: ['matrix.json'],
  }
  for (const [dirName, allowed] of Object.entries(fixedDirectories)) {
    const dir = path.join(EVIDENCE, dirName)
    if (!fs.existsSync(dir)) {
      problems.push(`evidence/: missing directory ${dirName}`)
      continue
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() || !allowed.includes(entry.name)) {
        problems.push(`evidence/${dirName}/${entry.name}: outside the allowed set {${allowed.join(', ')}}`)
      }
    }
  }
}

function auditEvidence({ standalone }) {
  const problems = []
  if (!fs.existsSync(EVIDENCE)) {
    problems.push(`missing evidence directory: ${relative(EVIDENCE)} (a matrix run without evidence is never a pass)`)
    return { problems, marker: undefined }
  }
  const marker = auditRunMarker(problems, standalone)
  const markerPath = path.join(EVIDENCE, 'run-marker.json')
  const markerTime = fs.existsSync(markerPath) ? fs.statSync(markerPath).mtimeMs : undefined
  auditRequiredCells(problems, markerTime)
  auditMatrix(problems, marker)
  auditEvidenceDirectory(problems)
  return { problems, marker }
}

function printAudit(problems, context) {
  if (problems.length === 0) {
    log(`EVIDENCE AUDIT PASS (${context}): 41 cells, identity digests, freshness, logPath containment, directory discipline`)
    return
  }
  console.error(`[run-baseline] EVIDENCE AUDIT FAIL (${context}): ${problems.length} problem(s)`)
  for (const problem of problems) console.error(`  - ${problem}`)
}

// ---------------------------------------------------------------- fault orchestration

function runFault(options, baselineId, suites) {
  const materialized = materialize(baselineId, options.fault)
  const extraEnv = options.fault === 'legacy-shim' ? { NOMICORE_CORDIS_FAULT: 'legacy-shim' } : {}
  const cells = []
  for (const suite of suites) {
    cells.push(runSuite(baselineId, suite, materialized, options.fault, `fault-${options.fault}`))
  }
  const innerFailed = cells.some((cell) => cell.status === 'fail')
  const payload = {
    baseline: baselineId,
    suite: `fault:${options.fault}:${suites.join('+')}`,
    fault: options.fault,
    expected: 'fail',
    observed: innerFailed ? 'fail' : 'pass',
    code: innerFailed ? 1 : 0,
    status: innerFailed ? 'pass' : 'fail',
    resolvedRealpaths: cells[0]?.resolvedRealpaths ?? {},
    provenanceDigest: provenanceDigestFor(baselineId),
    testNames: cells.flatMap((cell) => cell.testNames ?? []),
    logPath: cells[0]?.logPath ?? '',
    cells: cells.map((cell) => ({ suite: cell.suite, status: cell.status, exitCode: cell.exitCode, logPath: cell.logPath, note: cell.note })),
    env: extraEnv,
  }
  const evidencePath = writeEvidence(baselineId, `fault-${options.fault}`, payload)
  console.log(`[run-baseline] fault ${options.fault} @ ${baselineId}: expected=fail observed=${payload.observed} code=${payload.code} -> ${evidencePath}`)
  if (!innerFailed) {
    console.error(`[run-baseline] NEGATIVE CONTROL FAILED: ${options.fault} was expected to fail inside the polluted workspace but passed`)
    process.exit(1)
  }
  process.exit(0)
}

// ---------------------------------------------------------------- matrix

function runBaselineCells(baselineId, { typecheck, suites }) {
  ensureArtifacts(baselineId)
  const materialized = materialize(baselineId, undefined)
  const cells = []
  if (typecheck) cells.push(runTypecheckCell(baselineId, materialized))
  for (const suite of suites) cells.push(runSuite(baselineId, suite, materialized))
  return cells
}

function printMatrix(cells) {
  const header = ['baseline', 'suite', 'status', 'exit', 'tests', 'evidence']
  const rows = cells.map((cell) => [
    cell.baseline,
    cell.suite,
    cell.status,
    String(cell.exitCode ?? cell.counts?.failed ?? ''),
    cell.counts === undefined
      ? (cell.projectCount !== undefined ? `${cell.projectCount} projects` : '-')
      // SA9-7-1: one field convention (`counts.passed/total`); the root-test row keeps its
      // real counts and states the ledger size instead of printing `undefined/undefined`.
      : `${cell.counts.passed}/${cell.counts.total}${cell.ledger === undefined ? '' : ` (${cell.counts.failed} known-red: ${cell.ledger.knownRed} frozen + ${cell.ledger.environmentRed} environment)`}`,
    cell.logPath,
  ])
  const widths = header.map((value, index) => Math.max(value.length, ...rows.map((row) => row[index].length)))
  const line = (row) => row.map((value, index) => value.padEnd(widths[index])).join('  ')
  console.log(line(header))
  for (const row of rows) console.log(line(row))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  mkdirp(EVIDENCE)

  // `--audit-evidence`: standalone fail-closed audit of the canonical evidence
  // directory (#472 design §7.4). No redirectable evidence dir on purpose: the
  // negative controls pollute the canonical directory (backup -> pollute -> red ->
  // restore) so an auditor can never be pointed at a doctored copy.
  if (options.auditEvidence) {
    const { problems } = auditEvidence({ standalone: true })
    printAudit(problems, 'standalone --audit-evidence')
    process.exit(problems.length === 0 ? 0 : 1)
  }

  if (options.all) {
    // The run marker is written BEFORE any cell is produced: it binds the evidence
    // to this single candidate tree (SA6 §12.0.1/§12.0.2) and is the freshness base.
    const marker = writeRunMarker()
    log(`run marker: head=${marker.head.slice(0, 12)} tree=${marker.tree.slice(0, 12)} startedAt=${marker.startedAt}`)
    const cells = []
    for (const baselineId of Object.keys(MANIFEST.baselines)) {
      const baselineCells = runBaselineCells(baselineId, { typecheck: true, suites: BASELINE_SUITES })
      for (const cell of baselineCells) writeEvidence(baselineId, cell.suite, cell)
      cells.push(...baselineCells)
    }
    const gatesCell = runGatesCell()
    writeEvidence('gates', 'gates', gatesCell)
    cells.push(gatesCell)
    const rootTestCell = runRootTestCell()
    writeEvidence('root-test', 'root-test', rootTestCell)
    cells.push(rootTestCell)
    writeEvidence('matrix', 'matrix', {
      generatedAt: new Date().toISOString(),
      runHead: marker.head,
      runTree: marker.tree,
      cells,
    })
    printMatrix(cells)
    // Built-in audit: a red audit is MATRIX FAIL regardless of the cell statuses
    // (green cells never offset an audit red — design §7.4).
    const audit = auditEvidence({ standalone: false })
    printAudit(audit.problems, 'built-in matrix audit')
    if (audit.problems.length > 0) {
      console.error('[run-baseline] MATRIX FAIL: evidence audit red — green cells never offset an audit red')
      process.exit(1)
    }
    const failed = cells.filter((cell) => cell.status !== 'pass')
    if (failed.length > 0) {
      console.error(`[run-baseline] MATRIX FAIL: ${failed.length}/${cells.length} cell(s) red — green cells never offset a red cell`)
      for (const cell of failed) console.error(`  RED ${cell.baseline}/${cell.suite} (log ${cell.logPath})`)
      process.exit(1)
    }
    console.log(`[run-baseline] MATRIX PASS: ${cells.length} cells`)
    process.exit(0)
  }

  if (options.rootTest && options.baselines.length === 0) {
    const cell = runRootTestCell()
    writeEvidence('root-test', 'root-test', cell)
    printMatrix([cell])
    process.exit(cell.status === 'pass' ? 0 : 1)
  }

  if (options.baselines.length === 0) fail('usage', 'specify --baseline <B1|B2|B3>, --suite root-test, or --all --matrix')
  if (options.baselines.length > 1) fail('usage', '--baseline accepts a single baseline (use --all --matrix for the full matrix)')
  const baselineId = options.baselines[0]
  if (MANIFEST.baselines[baselineId] === undefined) fail('usage', `unknown baseline ${baselineId}`)

  if (options.suites.length === 0 && !options.typecheck) fail('usage', 'specify at least one --suite or --mode typecheck')

  if (options.fault !== undefined) {
    if (options.typecheck) fail('usage', '--fault runs behaviour suites only')
    const suites = options.suites.length > 0 ? options.suites : ['provenance', 'root-probe']
    ensureArtifacts(baselineId)
    runFault(options, baselineId, suites)
  }

  ensureArtifacts(baselineId)
  const materialized = materialize(baselineId, undefined)
  const cells = []
  if (options.typecheck) cells.push(runTypecheckCell(baselineId, materialized))
  for (const suite of options.suites) {
    const cell = runSuite(baselineId, suite, materialized)
    writeEvidence(baselineId, suite, cell)
    cells.push(cell)
  }
  printMatrix(cells)
  const failed = cells.filter((cell) => cell.status !== 'pass')
  process.exit(failed.length === 0 ? 0 : 1)
}

try {
  await main()
} catch (error) {
  console.error(`[run-baseline] FAIL <internal> ${error?.stack ?? error}`)
  process.exit(2)
}
