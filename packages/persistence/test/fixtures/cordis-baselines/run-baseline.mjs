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
 * Usage:
 *   node run-baseline.mjs --baseline B1 [--mode typecheck] [--suite <name>]...
 *   node run-baseline.mjs --suite root-test
 *   node run-baseline.mjs --all --matrix
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
    else fail('usage', `unknown argument ${arg}`)
  }
  if (options.suites.includes('root-test')) {
    options.rootTest = true
    options.suites = options.suites.filter((suite) => suite !== 'root-test')
  }
  for (const suite of options.suites) {
    if (![...BASELINE_SUITES, 'ws-package', 'gates'].includes(suite)) {
      fail('usage', `unknown suite ${suite}`)
    }
  }
  if (options.fault !== undefined) {
    if (!['fallback', 'substitute-npm', 'substitute-rc12', 'legacy-shim'].includes(options.fault)) {
      fail('usage', `unknown fault ${options.fault}`)
    }
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
  let passed = 0
  let failed = 0
  for (const file of json?.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      testNames.push(assertion.fullName ?? assertion.title)
      if (assertion.status === 'passed') passed += 1
      else if (assertion.status === 'failed') failed += 1
    }
  }
  return {
    status: result.status,
    exitCode: result.status,
    testNames,
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

function runSuite(baselineId, suite, materialized, fault, evidenceSubdir) {
  const cell = baseCell(baselineId, suite, materialized)
  const evidenceDir = path.join(EVIDENCE, baselineId, evidenceSubdir ?? '')
  mkdirp(evidenceDir)
  if (suite === 'provenance' || suite === 'contract' || suite === 'real-timer' || suite === 'dsh-profile' || suite === 'unload') {
    const files =
      suite === 'provenance'
        ? [PROVENANCE_TEST]
        : suite === 'contract'
          ? listPersistenceContractFiles(materialized.workspace)
          : suite === 'real-timer'
            ? [REAL_TIMER_TEST]
            : suite === 'dsh-profile'
              ? [DSH_PROFILE_TEST]
              : [UNLOAD_TEST]
    ensureFiles(materialized.workspace, files, suite)
    const repeat = suite === 'real-timer' ? 3 : 1
    const runs = []
    for (let attempt = 1; attempt <= repeat; attempt++) {
      runs.push(
        runVitest(baselineId, materialized.workspace, files, {
          label: repeat === 1 ? `${baselineId}-${suite}` : `${baselineId}-${suite}-repeat${attempt}`,
          evidenceDir,
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
    const everyRepeatGreen = runs.every((entry) => entry.exitCode === 0 && entry.counts.failed === 0 && entry.counts.total > 0)
    cell.status = everyRepeatGreen && (!cell.r5p || cell.r5p.passed) ? 'pass' : 'fail'
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
      extraEnv: fault === 'legacy-shim' ? { NOMICORE_CORDIS_FAULT: 'legacy-shim' } : {},
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
  if (suite === 'ws-package') {
    ensureFiles(materialized.workspace, WS_PACKAGE_FILES, suite)
    const runs = []
    let failed = 0
    let passed = 0
    const names = []
    for (const file of WS_PACKAGE_FILES) {
      const run = runVitest(baselineId, materialized.workspace, [file], {
        label: `${baselineId}-ws-package-${path.basename(file, '.test.ts')}`,
        evidenceDir,
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
    cell.filesPresent = Object.fromEntries(WS_PACKAGE_FILES.map((file) => [file, fs.existsSync(path.join(materialized.workspace, file))]))
    cell.logPath = runs[0]?.logPath ?? ''
    cell.status = failed === 0 && names.length > 0 ? 'pass' : 'fail'
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
    summary: (result.stdout ?? '').split('\n').filter((line) => line.startsWith('[gates]')).slice(-12),
  }
}

function runRootTestCell() {
  const logPath = path.join(EVIDENCE, 'root-test', 'root-test.log')
  const jsonPath = path.join(EVIDENCE, 'root-test', 'root-test.vitest.json')
  mkdirp(path.dirname(logPath))
  if (!fs.existsSync(VITEST)) fail('root-test', `default layout vitest missing at ${relative(VITEST)}`)
  const result = spawnSync(NODE, [VITEST, 'run', '--typecheck', '--reporter=default', '--reporter=json', `--outputFile.json=${jsonPath}`], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '--conditions=nomicore-source' },
    maxBuffer: 256 * 1024 * 1024,
  })
  fs.writeFileSync(logPath, `${result.stdout ?? ''}\n${result.stderr ?? ''}`)
  // §12.5 evidence contract: testNames/failedTestNames are backfilled from the
  // vitest JSON reporter so the failure list is machine-readable, not log-only.
  let counts
  let testNames = []
  let failedTestNames = []
  try {
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    counts = { numTotalTests: json.numTotalTests, numPassedTests: json.numPassedTests, numFailedTests: json.numFailedTests }
    for (const testFile of json.testResults ?? []) {
      for (const assertion of testFile.assertionResults ?? []) {
        const name = assertion.fullName ?? assertion.title
        testNames.push(name)
        if (assertion.status === 'failed') failedTestNames.push(name)
      }
    }
  } catch {
    counts = undefined
  }
  // Diagnostics (not a gate): the environment pnpm shim version mismatch is
  // recorded so a reader can tell environmental red from regressions.
  const pnpmProbe = spawnSync('pnpm', ['--version'], { cwd: REPO, encoding: 'utf8' })
  return {
    baseline: 'default',
    suite: 'root-test',
    status: result.status === 0 ? 'pass' : 'fail',
    resolvedRealpaths: {},
    provenanceDigest: provenanceDigestFor('B1'),
    testNames,
    failedTestNames,
    logPath: relative(logPath),
    exitCode: result.status,
    counts,
    diagnostics: {
      node: process.version,
      pnpmProbe: { exitCode: pnpmProbe.status, stdout: (pnpmProbe.stdout ?? '').trim().slice(0, 200), stderr: (pnpmProbe.stderr ?? '').trim().slice(0, 400) },
      command: 'NODE_OPTIONS=--conditions=nomicore-source node <repo>/node_modules/vitest/vitest.mjs run --typecheck',
    },
  }
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
    cell.counts === undefined ? (cell.projectCount !== undefined ? `${cell.projectCount} projects` : '-') : `${cell.counts.passed}/${cell.counts.total}`,
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

  if (options.all) {
    const cells = []
    for (const baselineId of Object.keys(MANIFEST.baselines)) {
      const baselineCells = runBaselineCells(baselineId, { typecheck: true, suites: BASELINE_SUITES })
      for (const cell of baselineCells) writeEvidence(baselineId, cell.suite, cell)
      cells.push(...baselineCells)
    }
    const wsPackageCells = runBaselineCells('B1', { typecheck: false, suites: ['ws-package'] })
    for (const cell of wsPackageCells) writeEvidence('B1', cell.suite, cell)
    cells.push(...wsPackageCells)
    const gatesCell = runGatesCell()
    writeEvidence('gates', 'gates', gatesCell)
    cells.push(gatesCell)
    const rootTestCell = runRootTestCell()
    writeEvidence('root-test', 'root-test', rootTestCell)
    cells.push(rootTestCell)
    writeEvidence('matrix', 'matrix', { generatedAt: new Date().toISOString(), cells })
    printMatrix(cells)
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
