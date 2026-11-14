/**
 * Red-light contract — issue #470 AC2 (design §13 AC2 row, §14 D4): the same
 * published Memory/File persistence plugins must complete flush / retry / drain /
 * dispose / service-revoke on every baseline through the real baseline
 * `TimerService` (no fake scheduler anywhere in this file).
 *
 * It also carries the AC3(c) persistence-result assertion (SA6 §12.2 AC3 (c);
 * SA10 M2): a dependent fiber consumes `nomicorePersistence` through `inject`,
 * its accepted `saveDoc` is gated inside the write slot, the persistence fiber is
 * disposed (service revoked → dependent unloading → adapter NOT disposed), and
 * after the gate releases the newest generation must reach the store within the
 * deadline through the real `TimerService` — observed strictly before the adapter
 * dispose event, with zero unhandled rejections.
 *
 * Real-Timer evidence: `TimerService.prototype.timeout` is instrumented BEFORE
 * any `TimerService` is constructed (design §8.6 / SA2 F8: the timer mixes its
 * methods into the context at provide time, so the patch must precede
 * construction). The meter records arm count and live (pending) timer count; the
 * pending counter is decremented both when the armed disposer is called and when
 * the timer fires naturally, so "dispose 后 pending = 0" is an honest statement
 * about live timers.
 *
 * All waiting is deadline-based predicate polling (5s deadline), never a fixed
 * number of settle rounds (SA6 §7 / §8.6). Every scenario asserts observable
 * state: store write count, decoded committed snapshot content, status
 * vocabulary, and rejection behaviour after dispose.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { TimerService } from '@deepseek-ai/cordis-plugin-timer'
import * as Y from 'yjs'
import { createSystemClockPlugin } from '@nomicore/clock'
import {
  NOMICORE_PERSISTENCE_SERVICE,
  createFilePersistencePlugin,
  createMemoryPersistencePlugin,
  type DocHandle,
  type DocPersistence,
  type FilePersistence,
  type MemoryPersistence,
} from '../src/index.js'

const ROOT_USER = Object.freeze({ userId: 'u' })
/** Persistence store key: the adapter's `(owner.userId, docId)` composite key. */
const storeKey = (docId: string): string => `${ROOT_USER.userId}\u0000${docId}`
const SCHEDULE = { debounceMs: 10, maxDirtyMs: 40, retryDelayMs: 10 } as const
const DEADLINE_MS = 5000

// ---------------------------------------------------------------- real-timer meter

interface TimerMeter {
  arms: number
  pending: number
}

const meter: TimerMeter = { arms: 0, pending: 0 }
type TimeoutFn = (callback: () => void, delay: number) => () => void
let originalTimeout: TimeoutFn | undefined

beforeAll(() => {
  originalTimeout = TimerService.prototype.timeout as unknown as TimeoutFn
  const original = originalTimeout
  ;(TimerService.prototype as unknown as { timeout: TimeoutFn }).timeout = function patchedTimeout(
    this: TimerService,
    callback: () => void,
    delay: number,
  ) {
    if (typeof callback !== 'function') {
      return (original as unknown as (...args: unknown[]) => () => void).call(this, callback, delay)
    }
    meter.arms += 1
    meter.pending += 1
    let live = true
    const settle = () => {
      if (!live) return
      live = false
      meter.pending -= 1
    }
    const disposer = original.call(this, () => {
      settle()
      callback()
    }, delay)
    return () => {
      settle()
      disposer()
    }
  }
})

afterAll(() => {
  if (originalTimeout !== undefined) {
    ;(TimerService.prototype as unknown as { timeout: TimeoutFn }).timeout = originalTimeout
  }
})

beforeEach(() => {
  meter.arms = 0
  meter.pending = 0
})

// ---------------------------------------------------------------- helpers

function makeDoc(docId: string, value = 1): Y.Doc {
  const doc = new Y.Doc()
  doc.getMap('META').set('docId', docId)
  doc.getMap('ROOT').set('n', value)
  return doc
}

function decode(snapshot: Uint8Array | undefined): number | undefined {
  if (snapshot === undefined) return undefined
  const doc = new Y.Doc()
  Y.applyUpdate(doc, snapshot)
  return doc.getMap('ROOT').get('n') as number | undefined
}

async function waitFor(predicate: () => boolean, label: string, deadlineMs = DEADLINE_MS): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < deadlineMs) {
    if (predicate()) return
    await new Promise<void>((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`waitFor timed out after ${deadlineMs}ms: ${label}`)
}

function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

interface Deferred {
  readonly promise: Promise<void>
  resolve(): void
}

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function createContext(): Context {
  const ctx = new Context()
  createSystemClockPlugin().apply(ctx)
  new TimerService(ctx)
  return ctx
}

interface UnhandledCollector {
  readonly events: unknown[]
  dispose(): void
}

function collectUnhandledRejections(): UnhandledCollector {
  const events: unknown[] = []
  const handler = (reason: unknown) => {
    events.push(reason)
  }
  process.on('unhandledRejection', handler)
  return {
    events,
    dispose: () => process.off('unhandledRejection', handler),
  }
}

interface MemoryHarness {
  readonly ctx: Context
  readonly plugin: ReturnType<typeof createMemoryPersistencePlugin>
  readonly adapter: MemoryPersistence
  readonly snapshots: Map<string, Uint8Array>
  readonly faults: { remaining: number }
  writes(): number
  dispose(): Promise<void>
}

function createMemoryHarness(): MemoryHarness {
  const snapshots = new Map<string, Uint8Array>()
  let writes = 0
  // Fault injection is armed by the retry scenario AFTER createDoc committed its
  // initial snapshot (createDoc writes once; the flush scenario asserts that
  // saveDoc itself adds no synchronous write on top of the create commit).
  const faults = { remaining: 0 }
  const ctx = createContext()
  const plugin = createMemoryPersistencePlugin({
    schedule: SCHEDULE,
    writeSnapshot: async (key, snapshot) => {
      if (faults.remaining > 0) {
        faults.remaining -= 1
        throw new Error('memory store write rejected (injected)')
      }
      writes += 1
      snapshots.set(key, snapshot.slice())
    },
  })
  plugin.apply(ctx)
  return {
    ctx,
    plugin,
    adapter: plugin.instance!,
    snapshots,
    faults,
    writes: () => writes,
    dispose: async () => {
      await ctx.fiber.dispose()
    },
  }
}

interface FileHarness {
  readonly ctx: Context
  readonly plugin: ReturnType<typeof createFilePersistencePlugin>
  readonly adapter: FilePersistence
  readonly rootDir: string
  snapshotPath(docId: string): string
  readSnapshot(docId: string): Uint8Array | undefined
  /** Nanosecond mtime of the committed snapshot file: changes on every write. */
  snapshotVersion(docId: string): string | undefined
  dispose(): Promise<void>
}

const tempDirs = new Set<string>()

function createFileHarness(): FileHarness {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomicore-cordis-baseline-file-'))
  tempDirs.add(rootDir)
  const ctx = createContext()
  // The plugin factory derives the scheduler from the Cordis Root channel: no
  // injected scheduler anywhere in this suite.
  const plugin = createFilePersistencePlugin({ rootDir, schedule: SCHEDULE })
  plugin.apply(ctx)
  const snapshotPath = (docId: string) => path.join(rootDir, 'users', ROOT_USER.userId, `${docId}.snapshot`)
  return {
    ctx,
    plugin,
    adapter: plugin.instance!,
    rootDir,
    snapshotPath,
    readSnapshot: (docId) => {
      const file = snapshotPath(docId)
      if (!fs.existsSync(file)) return undefined
      return fs.statSync(file).isFile() ? fs.readFileSync(file) : undefined
    },
    snapshotVersion: (docId) => {
      const file = snapshotPath(docId)
      if (!fs.existsSync(file)) return undefined
      const stat = fs.statSync(file, { bigint: true })
      return `${stat.mtimeNs}:${stat.size}`
    },
    dispose: async () => {
      await ctx.fiber.dispose()
    },
  }
}

interface DirtyResult {
  readonly doc: Y.Doc
  readonly handle: DocHandle
  /** Store write count observed immediately before saveDoc (createDoc has committed). */
  readonly writesBeforeSave: number
}

async function dirty(
  adapter: {
    createDoc: (user: { userId: string }, docId: string, doc: Y.Doc) => Promise<DocHandle>
    saveDoc: (handle: DocHandle) => Promise<void>
  },
  docId: string,
  value: number,
  reads?: () => number,
  beforeSave?: () => void,
): Promise<DirtyResult> {
  const doc = makeDoc(docId, value)
  const handle = await adapter.createDoc(ROOT_USER, docId, doc)
  beforeSave?.()
  const writesBeforeSave = reads?.() ?? 0
  await adapter.saveDoc(handle)
  return { doc, handle, writesBeforeSave }
}

afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true })
})

// ---------------------------------------------------------------- memory adapter

describe('AC2 真实 Timer × Memory 适配器（三基线）', () => {
  it('flush：saveDoc 不同步写，真实 Timer 在 deadline 内提交含最新 generation 的快照', async () => {
    const fixture = createMemoryHarness()
    try {
      const { doc, handle, writesBeforeSave } = await dirty(fixture.adapter, 'd-flush', 1, () => fixture.writes())
      // Dirty notification must not perform a synchronous store write.
      expect(fixture.writes()).toBe(writesBeforeSave)
      expect(decode(fixture.snapshots.get(storeKey('d-flush')))).toBe(1)

      doc.getMap('ROOT').set('n', 2)
      await fixture.adapter.saveDoc(handle)
      expect(fixture.writes()).toBe(writesBeforeSave)
      await waitFor(() => decode(fixture.snapshots.get(storeKey('d-flush'))) === 2, 'memory flush committed')
      expect(meter.arms).toBeGreaterThan(0)
    } finally {
      await fixture.dispose()
    }
  })

  it('retry：store 前 2 次失败进入 persistence-degraded，saveDoc 仍 resolve，恢复后 deadline 内 ready 且提交最新 generation', async () => {
    const fixture = createMemoryHarness()
    try {
      const { doc, handle } = await dirty(
        fixture.adapter,
        'd-retry',
        3,
        undefined,
        () => {
          // Arm the store fault only after createDoc committed its initial snapshot.
          fixture.faults.remaining = 2
        },
      )
      await waitFor(() => fixture.adapter.getStatus() === 'persistence-degraded', 'memory degraded')
      // degraded is not a rejection reason on the dirty-notification path (ADR-0006).
      doc.getMap('ROOT').set('n', 4)
      await expect(fixture.adapter.saveDoc(handle)).resolves.toBeUndefined()
      await waitFor(() => fixture.adapter.getStatus() === 'ready', 'memory recovered', DEADLINE_MS)
      await waitFor(() => decode(fixture.snapshots.get(storeKey('d-retry'))) === 4, 'memory latest generation after recovery')
      expect(meter.arms).toBeGreaterThan(0)
    } finally {
      await fixture.dispose()
    }
  })

  it('drain：返回后已提交最新快照，随后超过 debounce 零新增写', async () => {
    const fixture = createMemoryHarness()
    try {
      const { doc, handle } = await dirty(fixture.adapter, 'd-drain', 5, () => fixture.writes())
      doc.getMap('ROOT').set('n', 6)
      await fixture.adapter.saveDoc(handle)
      const before = fixture.writes()
      await fixture.adapter.drain()
      expect(fixture.writes()).toBeGreaterThan(before)
      expect(decode(fixture.snapshots.get(storeKey('d-drain')))).toBe(6)
      const afterDrain = fixture.writes()
      await delay(SCHEDULE.debounceMs * 4 + 30)
      expect(fixture.writes()).toBe(afterDrain)
    } finally {
      await fixture.dispose()
    }
  })

  it('dispose：status=disposed、pending=0、等待超过 debounce 无新写、后续 load/save 响亮拒绝、重复 dispose 幂等', async () => {
    const fixture = createMemoryHarness()
    try {
      const { handle } = await dirty(fixture.adapter, 'd-dispose', 6)
      await fixture.adapter.dispose()
      expect(fixture.adapter.getStatus()).toBe('disposed')
      expect(meter.pending).toBe(0)
      const writes = fixture.writes()
      await delay(SCHEDULE.debounceMs * 4 + 30)
      expect(fixture.writes()).toBe(writes)
      await expect(fixture.adapter.saveDoc(handle)).rejects.toThrow()
      await expect(fixture.adapter.loadDoc(ROOT_USER, 'd-dispose')).rejects.toThrow()
      await expect(fixture.adapter.dispose()).resolves.toBeUndefined()
    } finally {
      await fixture.dispose()
    }
  })

  it('service-revoke：fiber dispose 后 service 撤除、adapter disposed、零 unhandled', async () => {
    const unhandled = collectUnhandledRejections()
    const ctx = createContext()
    try {
      const plugin = createMemoryPersistencePlugin({
        schedule: SCHEDULE,
        writeSnapshot: async () => {},
      })
      const fiber = ctx.plugin(plugin)
      await fiber
      const adapter = plugin.instance!
      expect(ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBe(adapter)
      const { handle } = await dirty(adapter, 'd-revoke', 7)
      await adapter.saveDoc(handle)
      await fiber.dispose()
      expect(ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBeUndefined()
      expect(adapter.getStatus()).toBe('disposed')
      await new Promise<void>((resolve) => setImmediate(resolve))
      await delay(SCHEDULE.debounceMs * 4 + 30)
      expect(unhandled.events).toEqual([])
    } finally {
      unhandled.dispose()
      await ctx.fiber.dispose()
    }
  })
})

// ---------------------------------------------------------------- file adapter

describe('AC2 真实 Timer × File 适配器（三基线）', () => {
  it('flush：saveDoc 不同步写，真实 Timer 在 deadline 内提交含最新 generation 的快照', async () => {
    const fixture = createFileHarness()
    try {
      const { doc, handle } = await dirty(fixture.adapter, 'd-flush', 1)
      const versionBeforeSave = fixture.snapshotVersion('d-flush')
      doc.getMap('ROOT').set('n', 2)
      await fixture.adapter.saveDoc(handle)
      // Dirty notification must not perform a synchronous store write.
      expect(fixture.snapshotVersion('d-flush')).toBe(versionBeforeSave)
      expect(decode(fixture.readSnapshot('d-flush'))).toBe(1)
      await waitFor(() => decode(fixture.readSnapshot('d-flush')) === 2, 'file flush committed')
      expect(meter.arms).toBeGreaterThan(0)
    } finally {
      await fixture.dispose()
    }
  })

  it('retry：snapshot 路径预置目录使 rename 确定性失败 → degraded，saveDoc 仍 resolve，移除占位后 deadline 内恢复并提交最新 generation', async () => {
    const fixture = createFileHarness()
    try {
      const { doc, handle } = await dirty(
        fixture.adapter,
        'd-retry',
        3,
        undefined,
        () => {
          // POSIX rename(file → existing directory) fails deterministically: replace
          // the initial committed snapshot with a directory of the same name.
          fs.rmSync(fixture.snapshotPath('d-retry'), { force: true })
          fs.mkdirSync(fixture.snapshotPath('d-retry'), { recursive: true })
        },
      )
      doc.getMap('ROOT').set('n', 4)
      await expect(fixture.adapter.saveDoc(handle)).resolves.toBeUndefined()
      await waitFor(() => fixture.adapter.getStatus() === 'persistence-degraded', 'file degraded')
      fs.rmdirSync(fixture.snapshotPath('d-retry'))
      await waitFor(() => fixture.adapter.getStatus() === 'ready', 'file recovered')
      await waitFor(() => decode(fixture.readSnapshot('d-retry')) === 4, 'file latest generation after recovery')
      expect(meter.arms).toBeGreaterThan(0)
    } finally {
      await fixture.dispose()
    }
  })

  it('drain：返回后已提交最新快照，随后超过 debounce 零新增写', async () => {
    const fixture = createFileHarness()
    try {
      const { doc, handle } = await dirty(fixture.adapter, 'd-drain', 5)
      doc.getMap('ROOT').set('n', 6)
      await fixture.adapter.saveDoc(handle)
      await fixture.adapter.drain()
      expect(decode(fixture.readSnapshot('d-drain'))).toBe(6)
      const afterDrain = fixture.snapshotVersion('d-drain')
      await delay(SCHEDULE.debounceMs * 4 + 30)
      expect(fixture.snapshotVersion('d-drain')).toBe(afterDrain)
    } finally {
      await fixture.dispose()
    }
  })

  it('dispose：status=disposed、pending=0、等待超过 debounce 无新写、后续 load/save 响亮拒绝、重复 dispose 幂等', async () => {
    const fixture = createFileHarness()
    try {
      const { handle } = await dirty(fixture.adapter, 'd-dispose', 6)
      await fixture.adapter.dispose()
      expect(fixture.adapter.getStatus()).toBe('disposed')
      expect(meter.pending).toBe(0)
      const version = fixture.snapshotVersion('d-dispose')
      await delay(SCHEDULE.debounceMs * 4 + 30)
      expect(fixture.snapshotVersion('d-dispose')).toBe(version)
      await expect(fixture.adapter.saveDoc(handle)).rejects.toThrow()
      await expect(fixture.adapter.loadDoc(ROOT_USER, 'd-dispose')).rejects.toThrow()
      await expect(fixture.adapter.dispose()).resolves.toBeUndefined()
    } finally {
      await fixture.dispose()
    }
  })

  it('service-revoke：fiber dispose 后 service 撤除、adapter disposed、零 unhandled', async () => {
    const unhandled = collectUnhandledRejections()
    const ctx = createContext()
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomicore-cordis-baseline-file-revoke-'))
    tempDirs.add(rootDir)
    try {
      const plugin = createFilePersistencePlugin({ rootDir, schedule: SCHEDULE })
      const fiber = ctx.plugin(plugin)
      await fiber
      const adapter = plugin.instance!
      expect(ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBe(adapter)
      const { handle } = await dirty(adapter, 'd-revoke', 7)
      await adapter.saveDoc(handle)
      await fiber.dispose()
      expect(ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBeUndefined()
      expect(adapter.getStatus()).toBe('disposed')
      await new Promise<void>((resolve) => setImmediate(resolve))
      await delay(SCHEDULE.debounceMs * 4 + 30)
      expect(unhandled.events).toEqual([])
    } finally {
      unhandled.dispose()
      await ctx.fiber.dispose()
    }
  })
})

// ---------------------------------------------------------------- AC3(c) unload window

/** `FiberState.UNLOADING` (cordis declares it as a `const enum`, no runtime value). */
const FIBER_STATE_UNLOADING = 5

interface DependentWriter {
  readonly name: string
  readonly inject: readonly string[]
  apply(ctx: Context): void
  /** Create the dependent's live document (the Registry `create` counterpart). */
  open(initialValue: number): Promise<void>
  /** The dependent's accepted-write path (the Registry `mutateData` counterpart). */
  write(value: number): Promise<void>
  /** Release the dependent's drain barrier (the dependent's own shutdown settle). */
  releaseUnloadBarrier(): void
  readonly adapter: DocPersistence | undefined
  readonly unloadStarted: boolean
}

/**
 * Dependent fiber for the AC3(c) window, i.e. the persistence-side equivalent of
 * the Registry R5P dependency (SA10 M2 requires the equivalent scenario on the
 * persistence side; `packages/namespace-registry/test/**` is outside this
 * iteration's ALLOW list).
 *
 * It consumes `nomicorePersistence` through `inject`, so revoking the service
 * cascades into this fiber's unload. Its unload effect (a) awaits the accepted
 * in-flight write and (b) then awaits a test-anchored drain barrier. That is what
 * keeps the persistence fiber in `UNLOADING` — service already revoked, adapter
 * NOT disposed — while the real baseline `TimerService` commits the newest
 * generation. No persistence API is called to force the flush: the only commit
 * path inside the window is the debounce timer armed by the dirty notification.
 */
function createDependentWriter(docId: string): DependentWriter {
  const barrier = deferred()
  let adapter: DocPersistence | undefined
  let doc: Y.Doc | undefined
  let handle: DocHandle | undefined
  let inFlight: Promise<void> | undefined
  let unloadStarted = false
  return {
    name: 'ac3c-dependent-writer',
    inject: [NOMICORE_PERSISTENCE_SERVICE],
    apply(ctx: Context) {
      // Capture the injected service once: the dependent writes through the public
      // persistence service, exactly like the Registry does while draining writes.
      adapter = ctx.nomicorePersistence
      ctx.effect(() => async () => {
        unloadStarted = true
        await inFlight // the write accepted before the unload window must settle
        await barrier.promise // the dependent's own drain quiescence (test-anchored)
      }, 'ac3c-dependent-unload')
    },
    async open(initialValue: number): Promise<void> {
      if (adapter === undefined) throw new Error('dependent writer is not applied')
      const created = makeDoc(docId, initialValue)
      doc = created
      handle = await adapter.createDoc(ROOT_USER, docId, created)
    },
    async write(value: number): Promise<void> {
      if (adapter === undefined || doc === undefined || handle === undefined) {
        throw new Error('dependent writer has no live document')
      }
      doc.getMap('ROOT').set('n', value)
      inFlight = adapter.saveDoc(handle)
      return inFlight
    },
    releaseUnloadBarrier: () => {
      barrier.resolve()
    },
    get adapter() {
      return adapter
    },
    get unloadStarted() {
      return unloadStarted
    },
  }
}

describe('AC3(c) UNLOADING 窗口 × 真实 Timer（三基线）', () => {
  it('dependent 排空窗口内已接纳写在真实 Timer 上提交最新 generation；adapter dispose 严格晚于该提交；零 unhandled', async () => {
    const unhandled = collectUnhandledRejections()
    const ctx = createContext()
    const docId = 'd-unload-window'
    const snapshots = new Map<string, Uint8Array>()
    const events: string[] = []
    const saveGate = deferred()
    let saveGateEntered = false
    let writeSettled = false
    let dependent: DependentWriter | undefined
    let dependentFiber: ReturnType<Context['plugin']> | undefined
    let persistenceFiber: ReturnType<Context['plugin']> | undefined
    let disposal: Promise<void> | undefined
    try {
      const plugin = createMemoryPersistencePlugin({
        schedule: SCHEDULE,
        writeSnapshot: async (key, snapshot) => {
          snapshots.set(key, snapshot.slice())
        },
      })
      persistenceFiber = ctx.plugin(plugin)
      await persistenceFiber
      const adapter = plugin.instance!
      expect(adapter.getStatus()).toBe('ready')

      dependent = createDependentWriter(docId)
      dependentFiber = ctx.plugin(dependent)
      await dependentFiber
      expect(dependent.adapter).toBe(adapter)
      expect(ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBe(adapter)

      // The dependent's live doc + initial committed snapshot (generation 1).
      await dependent.open(1)
      expect(decode(snapshots.get(storeKey(docId)))).toBe(1)

      // Adapter dispose is recorded as an event so "strictly after the commit" is
      // an observable order, not an inference (R5P's event-order discipline).
      const originalDispose = adapter.dispose.bind(adapter)
      adapter.dispose = async () => {
        events.push('adapter-dispose-start')
        await originalDispose()
        events.push('adapter-dispose-complete')
      }
      // Gate the accepted write inside the write slot (R5P's S6 anchor): saveDoc is
      // entered but does not reach the lifecycle until the gate releases.
      const originalSaveDoc = adapter.saveDoc.bind(adapter)
      adapter.saveDoc = async (handle: DocHandle) => {
        if (!saveGateEntered) {
          saveGateEntered = true
          await saveGate.promise
        }
        return originalSaveDoc(handle)
      }

      const writePromise = dependent.write(2)
      void writePromise.then(
        () => {
          writeSettled = true
        },
        () => {
          writeSettled = true
        },
      )
      await waitFor(() => saveGateEntered, 'accepted write entered the gated saveDoc slot')
      expect(decode(snapshots.get(storeKey(docId)))).toBe(1) // newest generation not committed yet

      // Unload the persistence fiber: service revoked → dependent fiber unloading →
      // adapter NOT disposed (the ordered lifecycle effect awaits the dependent).
      disposal = persistenceFiber.dispose()
      await waitFor(
        () =>
          persistenceFiber!.state === FIBER_STATE_UNLOADING
          && ctx.get(NOMICORE_PERSISTENCE_SERVICE) === undefined,
        'persistence fiber is UNLOADING and the service is already revoked',
      )
      await waitFor(
        () => dependentFiber!.state === FIBER_STATE_UNLOADING && dependent!.unloadStarted,
        'dependent fiber is UNLOADING and awaiting the accepted write',
      )
      expect(events).toEqual([]) // adapter dispose has not started
      expect(writeSettled).toBe(false) // the accepted write is still in flight
      const armsBeforeFlush = meter.arms

      // Release the accepted write. Only the dirty notification may commit from
      // here on: no adapter.drain(), no manual flush, no store write by the test.
      saveGate.resolve()
      await expect(writePromise).resolves.toBeUndefined()

      await waitFor(
        () => decode(snapshots.get(storeKey(docId))) === 2,
        'newest generation snapshot committed inside the UNLOADING window',
      )
      events.push('snapshot-committed')
      // The commit was armed on the real baseline TimerService (meter counts
      // `TimerService.prototype.timeout` arms) — an ambient timer would not.
      expect(meter.arms).toBeGreaterThan(armsBeforeFlush)
      expect(events).toEqual(['snapshot-committed']) // still no adapter dispose
      expect(persistenceFiber.state).toBe(FIBER_STATE_UNLOADING) // the window is still open

      dependent.releaseUnloadBarrier()
      await disposal
      await new Promise<void>((resolve) => {
        setImmediate(resolve)
      })

      expect(events).toEqual(['snapshot-committed', 'adapter-dispose-start', 'adapter-dispose-complete'])
      expect(events.indexOf('snapshot-committed')).toBeLessThan(events.indexOf('adapter-dispose-start'))
      expect(adapter.getStatus()).toBe('disposed')
      expect(ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBeUndefined()
      expect(unhandled.events).toEqual([])
    } finally {
      saveGate.resolve()
      dependent?.releaseUnloadBarrier()
      await disposal?.catch(() => {})
      await ctx.fiber.dispose()
      unhandled.dispose()
    }
  })
})
