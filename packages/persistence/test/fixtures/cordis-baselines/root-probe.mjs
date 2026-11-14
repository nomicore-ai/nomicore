#!/usr/bin/env node
/**
 * Independent Cordis Root channel probe (design §8.5 / SA6 §12.3).
 *
 * This script is deliberately independent of the production seam: it imports
 * only the baseline `Context` / `TimerService` artifacts resolved from the
 * directory given by `--resolve-from`, and it reads the Root channel with
 * `Reflect` + `Symbol.for('cordis.root')` only. It never imports
 * `@nomicore/*` (in particular never `service.ts` / `plugin.ts`).
 *
 * Expectations come from `baselines.json` `probes[<expected channel>]`:
 *
 *   npm B1/B2 (legacy): legacy read on the root context is the root context,
 *                       the global symbol read is undefined, Context.root static
 *                       is undefined, and the fiber legacy read is the root.
 *   DSH B3   (symbol):  legacy read on the root context is undefined, the global
 *                       symbol read is the root context, Context.root static is
 *                       `Symbol.for('cordis.root')`, and the fiber legacy read is
 *                       undefined or throws the rc.12 inject error.
 *
 * Exit codes: 0 = every expectation matched, 1 = mismatch (printed), 2 = load
 * failure. A probe that only reports "some channel exists" is not acceptable
 * (SA6 §12.3 failure condition).
 */
import * as path from 'node:path'
import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../../../..')
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, 'baselines.json'), 'utf8'))
const ROOT_SYMBOL = Symbol.for('cordis.root')

function parseArgs(argv) {
  const options = { resolveFrom: path.join(REPO, 'packages/persistence'), expected: 'legacy', json: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--resolve-from') options.resolveFrom = path.resolve(argv[++i] ?? '')
    else if (arg === '--expected') options.expected = argv[++i]
    else if (arg === '--json') options.json = true
    else if (arg === '--baseline') {
      const id = argv[++i]
      const baseline = MANIFEST.baselines[id]
      if (baseline === undefined) throw new Error(`unknown baseline ${id}`)
      options.expected = baseline.expectedChannel
    } else {
      throw new Error(`unknown argument ${arg}`)
    }
  }
  if (!['legacy', 'symbol'].includes(options.expected)) {
    throw new Error(`--expected must be legacy|symbol, got ${options.expected}`)
  }
  return options
}

function packageDirFromEntry(entry) {
  let dir = path.dirname(entry)
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return fs.realpathSync(dir)
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`cannot locate package.json above ${entry}`)
}

function resolvePackage(requireFrom, name) {
  const require = createRequire(path.join(requireFrom, 'probe-anchor.cjs'))
  const entry = require.resolve(name)
  return { entry, dir: packageDirFromEntry(entry) }
}

let resolveFrom = process.cwd()

function describe(value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  return typeof value
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  resolveFrom = options.resolveFrom
  const cordis = resolvePackage(resolveFrom, '@deepseek-ai/cordis')
  const timer = resolvePackage(resolveFrom, '@deepseek-ai/cordis-plugin-timer')
  // Cosmokit is a transitive dependency: resolve it from the resolved cordis
  // realpath so the probe observes the same artifact the seam will use.
  const cosmokit = resolvePackage(cordis.dir, '@deepseek-ai/cosmokit')

  const cordisModule = await import(pathToFileURL(cordis.entry).href)
  const timerModule = await import(pathToFileURL(timer.entry).href)
  const Context = cordisModule.Context
  const TimerService = timerModule.TimerService
  if (typeof Context !== 'function') throw new Error('baseline cordis exposes no Context')
  if (typeof TimerService !== 'function') throw new Error('baseline timer exposes no TimerService')

  const ctx = new Context()
  new TimerService(ctx)

  const observations = {}
  observations.rootCtxLegacy = (() => {
    try {
      const value = Reflect.get(ctx, 'root')
      return value === undefined ? 'absent' : value === ctx ? 'root-context' : `other:${describe(value)}`
    } catch (error) {
      return `throws:${error?.message ?? String(error)}`
    }
  })()
  observations.rootCtxSymbol = (() => {
    try {
      const value = Reflect.get(ctx, ROOT_SYMBOL)
      return value === undefined ? 'absent' : value === ctx ? 'root-context' : `other:${describe(value)}`
    } catch (error) {
      return `throws:${error?.message ?? String(error)}`
    }
  })()
  observations.contextRootStatic = (() => {
    const value = Context.root
    if (value === undefined) return 'absent'
    return value === ROOT_SYMBOL ? 'symbol' : `other:${String(value)}`
  })()
  observations.hitChannelTimeout = (() => {
    const hit = options.expected === 'legacy' ? Reflect.get(ctx, 'root') : Reflect.get(ctx, ROOT_SYMBOL)
    return typeof hit?.timeout === 'function' ? 'function' : `missing:${describe(hit?.timeout)}`
  })()

  let fiberCtx
  const fiber = ctx.plugin({ name: 'root-probe-fiber', apply: (inner) => { fiberCtx = inner } })
  await fiber
  if (fiberCtx === undefined) throw new Error('probe fiber never received a context')
  observations.fiberLegacy = (() => {
    try {
      const value = Reflect.get(fiberCtx, 'root')
      return value === undefined ? 'absent' : value === ctx ? 'root-context' : `other:${describe(value)}`
    } catch (error) {
      return `throws:${error?.message ?? String(error)}`
    }
  })()
  observations.fiberSymbol = (() => {
    try {
      const value = Reflect.get(fiberCtx, ROOT_SYMBOL)
      return value === undefined ? 'absent' : value === ctx ? 'root-context' : `other:${describe(value)}`
    } catch (error) {
      return `throws:${error?.message ?? String(error)}`
    }
  })()
  await fiber.dispose()
  await ctx.fiber.dispose()

  const expected = MANIFEST.probes[options.expected]
  const failures = []
  const check = (key, actual, want) => {
    if (actual !== want) failures.push(`${key}: expected ${want}, observed ${actual}`)
  }
  check('rootCtxLegacy', observations.rootCtxLegacy, expected.rootCtxLegacy)
  check('rootCtxSymbol', observations.rootCtxSymbol, expected.rootCtxSymbol)
  check('contextRootStatic', observations.contextRootStatic, expected.contextRootStatic)
  check('hitChannelTimeout', observations.hitChannelTimeout, expected.hitChannelTimeout)
  if (expected.fiberLegacy === 'absent-or-throw') {
    if (observations.fiberLegacy !== 'absent' && !observations.fiberLegacy.startsWith('throws:')) {
      failures.push(`fiberLegacy: expected absent-or-throw, observed ${observations.fiberLegacy}`)
    }
  } else {
    check('fiberLegacy', observations.fiberLegacy, expected.fiberLegacy)
  }

  const report = {
    ok: failures.length === 0,
    expectedChannel: options.expected,
    resolveFrom: path.relative(REPO, resolveFrom),
    observations,
    resolvedRealpaths: {
      '@deepseek-ai/cordis': path.relative(REPO, cordis.dir),
      '@deepseek-ai/cordis-plugin-timer': path.relative(REPO, timer.dir),
      '@deepseek-ai/cosmokit': path.relative(REPO, cosmokit.dir),
    },
    failures,
  }
  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`[root-probe] expected=${options.expected} resolveFrom=${report.resolveFrom}`)
    for (const [key, value] of Object.entries(observations)) console.log(`  ${key} = ${value}`)
    for (const failure of failures) console.error(`[root-probe] MISMATCH ${failure}`)
  }
  process.exit(failures.length === 0 ? 0 : 1)
}

try {
  await main()
} catch (error) {
  console.error(`[root-probe] FAIL <load> ${error?.stack ?? error}`)
  process.exit(2)
}
