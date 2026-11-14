#!/usr/bin/env node
/**
 * Mechanical repository-shape gates for issue #470 (design §15, R7 + RA-2).
 *
 *   G1' manifest / lockfile / artifacts zero-diff (superset of SA6 §12.4 gate #1)
 *   G2  persistence / dsh-persistence / namespace-registry src allowlist
 *   G3  ws-replication allowlist (plugin.ts + the four named fixtures)
 *   G4  public entry files zero-diff
 *   G5  public surface snapshot: capture at BASE and compare with the tracked
 *       snapshot, then run the runtime surface test in the default layout
 *   G6  `git diff --check` clean and `git status --porcelain artifacts/` empty
 *   G7  docs/ (incl. docs/adr/) zero-diff
 *   G8  production src has no baseline/channel environment branch
 *   G9  tsconfig / vitest.config zero-diff (R1 anti-masking)
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
const BASE = '279dba4ac81b7c7520e3d0b87b5c4d621a86a517'
const SURFACE_SNAPSHOT = path.join(HERE, 'public-surface.base.json')
const BASE_WORKTREE = path.join(REPO, '.worktrees/base-snapshot')
const PUBLIC_ENTRIES = [
  ['@nomicore/persistence', 'packages/persistence/src/index.ts'],
  ['@nomicore/persistence/testing', 'packages/persistence/src/testing.ts'],
  ['@nomicore/dsh-persistence', 'packages/dsh-persistence/src/index.ts'],
  ['@nomicore/ws-replication', 'packages/ws-replication/src/index.ts'],
]
const WS_ALLOW = [
  'packages/ws-replication/src/plugin.ts',
  'packages/ws-replication/test/ws-replication-plugin.test.ts',
  'packages/ws-replication/test/ws-replication-issue299-ac-red.test.ts',
  'packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts',
  'packages/ws-replication/test/ws-replication-guard-proxy-consumption.test.ts',
]
const PERSISTENCE_ALLOW = ['packages/persistence/src/service.ts']
const G8_PATTERN = /process\.env|CORDIS_BASELINE|ROOT_CHANNEL|rc\.12/

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

/** Changed tracked paths vs BASE plus untracked files under the same pathspec. */
function changedPaths(pathspec) {
  const tracked = git(['diff', '--name-only', BASE, '--', ...pathspec])
    .split('\n')
    .filter(Boolean)
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...pathspec])
    .split('\n')
    .filter(Boolean)
  return [...new Set([...tracked, ...untracked])].sort()
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
  return { gate: 'G5', ok: true, detail: `4 entries match base snapshot; ${runtime.detail}` }
}

function gateG8() {
  const hits = []
  for (const dir of ['packages/persistence/src', 'packages/dsh-persistence/src', 'packages/ws-replication/src']) {
    const root = path.join(REPO, dir)
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const abs = path.join(current, entry.name)
        if (entry.isDirectory()) walk(abs)
        else if (entry.isFile() && /\.(ts|tsx|mts|cts|js|mjs)$/.test(entry.name)) {
          const lines = fs.readFileSync(abs, 'utf8').split('\n')
          lines.forEach((line, index) => {
            if (G8_PATTERN.test(line)) hits.push(`${path.relative(REPO, abs)}:${index + 1}: ${line.trim()}`)
          })
        }
      }
    }
    walk(root)
  }
  if (hits.length > 0) {
    return { gate: 'G8', ok: false, detail: `production src contains baseline/channel environment branches:\n  ${hits.join('\n  ')}` }
  }
  return { gate: 'G8', ok: true, detail: 'no process.env / CORDIS_BASELINE / ROOT_CHANNEL / rc.12 in the three production src trees' }
}

function gateG6() {
  const problems = []
  try {
    const output = git(['diff', '--check'])
    if (output.trim() !== '') problems.push(`git diff --check reported whitespace errors:\n${output}`)
  } catch (error) {
    problems.push(`git diff --check failed: ${error.stdout ?? error.message}`)
  }
  const artifacts = git(['status', '--porcelain', '--', 'artifacts/'])
  if (artifacts.trim() !== '') problems.push(`artifacts/ is dirty:\n${artifacts}`)
  if (problems.length > 0) return { gate: 'G6', ok: false, detail: problems.join('\n') }
  return { gate: 'G6', ok: true, detail: 'git diff --check clean; artifacts/ untouched' }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.writeSurfaceSnapshot) {
    const result = await gateG5(true)
    process.exit(result.ok ? 0 : 1)
  }
  const results = []
  results.push(assertNoChange('G1\u2032', 'manifests / lockfile / artifacts', ['pnpm-lock.yaml', ...listManifests(), 'artifacts']))
  results.push(
    assertAllowlist('G2', 'persistence · dsh-persistence · namespace-registry src', [
      'packages/persistence/src',
      'packages/dsh-persistence/src',
      'packages/namespace-registry/src',
    ], PERSISTENCE_ALLOW),
  )
  results.push(assertAllowlist('G3', 'ws-replication allowlist', ['packages/ws-replication'], WS_ALLOW))
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
