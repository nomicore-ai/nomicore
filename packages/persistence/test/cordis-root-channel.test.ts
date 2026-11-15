/**
 * Red-light contract — issue #470 AC1 / AC5 / AC9 (design §13 AC1 row, §14 D1–D3,
 * D9–D11): the persistence Host wiring leaf must resolve the Cordis Root timer
 * channel symbol-first (`Symbol.for('cordis.root')`) with the legacy `root`
 * instance property as fallback, must fail loudly and synchronously at plugin
 * apply time when the channel is absent / malformed / the host is not an object,
 * and must never fall back to an ambient timer.
 *
 * Synthetic channel shapes (symbol injection/absence, malformed values, both
 * absent, read-rejected) are built with a Proxy over a real `Context` that
 * intercepts exactly two keys (`Symbol.for('cordis.root')` and `'root'`) and
 * forwards everything else — independent of Cordis' internal proxying, so the
 * same shape is reachable on all three baselines.
 *
 * The observation vocabulary is behavior-only: recorded arm counts, recorded
 * legacy-channel read counts, recorded store writes/snapshots, and the
 * synchronous apply throw. No source-text assertions.
 */
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { TimerService } from '@deepseek-ai/cordis-plugin-timer'
import * as Y from 'yjs'
import { createSystemClockPlugin } from '@nomicore/clock'
import {
  createMemoryPersistencePlugin,
  NOMICORE_PERSISTENCE_SERVICE,
  type MemoryPersistence,
} from '../src/index.js'

const ROOT_SYMBOL = Symbol.for('cordis.root')
const NEW_ROOT_MESSAGE =
  'required Cordis root timer context is unavailable: the host root context must expose a callable timeout via '
  + "Symbol.for('cordis.root') or the legacy root property"
const EXISTING_TIMER_MESSAGE =
  'required Cordis service "timer" is unavailable: install @deepseek-ai/cordis-plugin-timer before the persistence plugin'
const ALICE = Object.freeze({ userId: 'u' })
/** Persistence store key: the adapter's `(owner.userId, docId)` composite key. */
const storeKey = (docId: string): string => `${ALICE.userId}\u0000${docId}`
const SCHEDULE = { debounceMs: 5, maxDirtyMs: 20 } as const

// ---------------------------------------------------------------- helpers

type ChannelMode =
  | { readonly kind: 'value'; readonly value: unknown }
  | { readonly kind: 'absent' }
  | { readonly kind: 'throws'; readonly message: string }

interface RootTimerProbe {
  readonly armCount: number
  readonly pending: number
  readonly delays: readonly number[]
  timeout(callback: () => void, delayMs: number): () => void
  fireAll(): void
}

/** Recording root timer capability: arms nothing ambient, fires only when told to. */
function createRootTimerProbe(): RootTimerProbe {
  const entries: Array<{ callback: () => void, delayMs: number, cancelled: boolean, fired: boolean }> = []
  let armCount = 0
  return {
    get armCount() {
      return armCount
    },
    get pending() {
      return entries.filter((entry) => !entry.cancelled && !entry.fired).length
    },
    get delays() {
      return entries.map((entry) => entry.delayMs)
    },
    timeout(callback: () => void, delayMs: number) {
      armCount += 1
      const entry = { callback, delayMs, cancelled: false, fired: false }
      entries.push(entry)
      return () => {
        entry.cancelled = true
      }
    },
    fireAll() {
      for (let guard = 0; guard < 100; guard += 1) {
        const next = entries.find((entry) => !entry.cancelled && !entry.fired)
        if (next === undefined) return
        next.fired = true
        next.callback()
      }
      throw new Error('root timer probe did not settle within 100 arms')
    },
  }
}

interface TimerServiceProbe {
  readonly armCount: number
  timeout(callback: () => void, delayMs: number): () => void
}

/** Recording timer *service* capability (the seam only requires a callable `timeout`). */
function createTimerServiceProbe(): TimerServiceProbe {
  let armCount = 0
  return {
    get armCount() {
      return armCount
    },
    timeout() {
      armCount += 1
      return () => {}
    },
  }
}

interface ControlledContext {
  readonly ctx: Context
  readonly base: Context
  readonly reads: { symbol: number, legacy: number }
}

function readChannel(mode: ChannelMode | undefined): unknown {
  if (mode === undefined || mode.kind === 'absent') return undefined
  if (mode.kind === 'throws') throw new Error(mode.message)
  return mode.value
}

/**
 * Real Cordis Context whose two Root channel keys are controlled by the test.
 * Every other property is read from the real context and method calls are bound
 * to it, so cordis service/effect/plugin mechanics stay genuine.
 */
function controlledContext(channels: { symbol?: ChannelMode, legacy?: ChannelMode } = {}): ControlledContext {
  const base = new Context()
  const reads = { symbol: 0, legacy: 0 }
  const ctx = new Proxy(base, {
    get(target, key) {
      if (key === ROOT_SYMBOL) {
        reads.symbol += 1
        return readChannel(channels.symbol)
      }
      if (key === 'root') {
        reads.legacy += 1
        return readChannel(channels.legacy)
      }
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
    },
  }) as Context
  return { ctx, base, reads }
}

interface MemoryStore {
  readonly snapshots: Map<string, Uint8Array>
  readonly writeCount: () => number
  writeSnapshot(key: string, snapshot: Uint8Array): Promise<void>
}

/** Recording store hook: the only writer of the memory adapter's observable store. */
function createMemoryStore(): MemoryStore {
  const snapshots = new Map<string, Uint8Array>()
  let writes = 0
  return {
    snapshots,
    writeCount: () => writes,
    async writeSnapshot(key: string, snapshot: Uint8Array) {
      writes += 1
      snapshots.set(key, snapshot.slice())
    },
  }
}

function makeDoc(docId: string, value = 1): Y.Doc {
  const doc = new Y.Doc()
  doc.getMap('META').set('docId', docId)
  doc.getMap('ROOT').set('n', value)
  return doc
}

function snapshotValue(snapshot: Uint8Array | undefined): number | undefined {
  if (snapshot === undefined) return undefined
  const doc = new Y.Doc()
  Y.applyUpdate(doc, snapshot)
  return doc.getMap('ROOT').get('n') as number | undefined
}

async function waitFor(predicate: () => boolean, label: string, deadlineMs = 5000): Promise<void> {
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

interface Harness {
  readonly controlled: ControlledContext
  readonly timer: TimerServiceProbe
  readonly store: MemoryStore
  readonly plugin: ReturnType<typeof createMemoryPersistencePlugin>
  dispose(): Promise<void>
}

/** Build a clock + timer + controlled-channel context ready for plugin apply. */
function harness(
  channels: { symbol?: ChannelMode, legacy?: ChannelMode } = {},
  options: { provideTimer?: boolean } = {},
): Harness {
  const controlled = controlledContext(channels)
  createSystemClockPlugin().apply(controlled.ctx)
  const timer = createTimerServiceProbe()
  if (options.provideTimer !== false) controlled.ctx.provide('timer', timer as never)
  const store = createMemoryStore()
  const plugin = createMemoryPersistencePlugin({ schedule: SCHEDULE, writeSnapshot: store.writeSnapshot })
  return {
    controlled,
    timer,
    store,
    plugin,
    dispose: async () => {
      await controlled.base.fiber.dispose()
    },
  }
}

async function createAndSave(instance: MemoryPersistence, docId: string, value: number): Promise<Y.Doc> {
  const doc = makeDoc(docId, value)
  const handle = await instance.createDoc(ALICE, docId, doc)
  await instance.saveDoc(handle)
  return doc
}

function captureMessage(action: () => void): string {
  try {
    action()
  } catch (error) {
    return (error as Error).message
  }
  return '<no throw>'
}

// ---------------------------------------------------------------- AC1 channel matrix

describe('AC1 Root 通道解析（symbol 优先 / legacy 兜底 / 缺席与形状不符 apply 期 loud fail）', () => {
  it('symbol 合法时优先：legacy 零读取、仅 symbol timer 武装（sentinel）', async () => {
    const symbolTimer = createRootTimerProbe()
    const legacyTimer = createRootTimerProbe()
    const fixture = harness({
      symbol: { kind: 'value', value: symbolTimer },
      legacy: { kind: 'value', value: legacyTimer },
    })
    try {
      fixture.plugin.apply(fixture.controlled.ctx)
      const instance = fixture.plugin.instance!
      expect(instance).toBeDefined()
      await createAndSave(instance, 'd-priority', 7)

      expect(symbolTimer.armCount).toBeGreaterThan(0)
      expect(legacyTimer.armCount).toBe(0)
      expect(fixture.controlled.reads.legacy).toBe(0)

      symbolTimer.fireAll()
      await waitFor(() => fixture.store.writeCount() > 0, 'symbol-channel flush')
      expect(snapshotValue(fixture.store.snapshots.get(storeKey('d-priority')))).toBe(7)
    } finally {
      await fixture.dispose()
    }
  })

  it('symbol 缺席时 legacy 兜底：flush 正常完成', async () => {
    const legacyTimer = createRootTimerProbe()
    const fixture = harness({
      symbol: { kind: 'absent' },
      legacy: { kind: 'value', value: legacyTimer },
    })
    try {
      fixture.plugin.apply(fixture.controlled.ctx)
      const instance = fixture.plugin.instance!
      await createAndSave(instance, 'd-legacy', 11)

      expect(legacyTimer.armCount).toBeGreaterThan(0)
      legacyTimer.fireAll()
      await waitFor(() => fixture.store.writeCount() > 0, 'legacy-channel flush')
      expect(snapshotValue(fixture.store.snapshots.get(storeKey('d-legacy')))).toBe(11)
    } finally {
      await fixture.dispose()
    }
  })

  it('symbol 存在但 timeout 非 function：apply 同步 throw 稳定文案，legacy 零读取', () => {
    const legacyTimer = createRootTimerProbe()
    const fixture = harness({
      symbol: { kind: 'value', value: { timeout: 'not-a-function' } },
      legacy: { kind: 'value', value: legacyTimer },
    })
    const ambient = vi.spyOn(globalThis, 'setTimeout')
    try {
      const message = captureMessage(() => fixture.plugin.apply(fixture.controlled.ctx))
      expect(message).toBe(NEW_ROOT_MESSAGE)
      expect(fixture.controlled.ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBeUndefined()
      expect(fixture.controlled.reads.legacy).toBe(0)
      expect(legacyTimer.armCount).toBe(0)
      expect(ambient).not.toHaveBeenCalled()
    } finally {
      ambient.mockRestore()
      void fixture.dispose()
    }
  })

  it('legacy 存在但 timeout 非 function：apply 同步 throw 同一稳定文案（malformed legacy 不静默）', () => {
    const fixture = harness({
      symbol: { kind: 'absent' },
      legacy: { kind: 'value', value: { timeout: undefined } },
    })
    try {
      expect(captureMessage(() => fixture.plugin.apply(fixture.controlled.ctx))).toBe(NEW_ROOT_MESSAGE)
      expect(fixture.controlled.ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBeUndefined()
    } finally {
      void fixture.dispose()
    }
  })

  it('双通道皆缺席：apply 同步 throw 同一稳定文案', () => {
    const fixture = harness({ symbol: { kind: 'absent' }, legacy: { kind: 'absent' } })
    try {
      const message = captureMessage(() => fixture.plugin.apply(fixture.controlled.ctx))
      expect(message).toBe(NEW_ROOT_MESSAGE)
      expect(fixture.controlled.ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBeUndefined()
    } finally {
      void fixture.dispose()
    }
  })

  it('双通道读取皆被 Proxy 拒绝：apply 同步 throw 同一稳定文案（read-rejected 归一，D10）', () => {
    const fixture = harness({
      symbol: { kind: 'throws', message: 'proxy denied cordis.root' },
      legacy: { kind: 'throws', message: 'cannot get property "root" without inject' },
    })
    try {
      const message = captureMessage(() => fixture.plugin.apply(fixture.controlled.ctx))
      expect(message).toBe(NEW_ROOT_MESSAGE)
      expect(message).not.toContain('proxy denied')
      expect(message).not.toContain('without inject')
      expect(fixture.controlled.ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBeUndefined()
    } finally {
      void fixture.dispose()
    }
  })

  it('symbol 读取抛错 + legacy 可读：归一为缺席，arm legacy，proxy 异常零泄漏（safeGet pin，D11）', async () => {
    const legacyTimer = createRootTimerProbe()
    const fixture = harness({
      symbol: { kind: 'throws', message: 'cannot get property "cordis.root" without inject' },
      legacy: { kind: 'value', value: legacyTimer },
    })
    try {
      expect(() => fixture.plugin.apply(fixture.controlled.ctx)).not.toThrow()
      const instance = fixture.plugin.instance!
      expect(instance).toBeDefined()
      await createAndSave(instance, 'd-read-throw', 13)
      expect(legacyTimer.armCount).toBeGreaterThan(0)
      legacyTimer.fireAll()
      await waitFor(() => fixture.store.writeCount() > 0, 'legacy flush after symbol read throw')
      expect(snapshotValue(fixture.store.snapshots.get(storeKey('d-read-throw')))).toBe(13)
    } finally {
      await fixture.dispose()
    }
  })

  it('timer service 缺失：apply 同步 throw 既有文案', () => {
    const fixture = harness({ symbol: { kind: 'value', value: createRootTimerProbe() } }, { provideTimer: false })
    try {
      expect(captureMessage(() => fixture.plugin.apply(fixture.controlled.ctx))).toBe(EXISTING_TIMER_MESSAGE)
      expect(fixture.controlled.ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBeUndefined()
    } finally {
      void fixture.dispose()
    }
  })

  it('timer service 形状不符（timeout 非 function）：apply 同步 throw 既有文案', () => {
    const controlled = controlledContext({ symbol: { kind: 'value', value: createRootTimerProbe() } })
    createSystemClockPlugin().apply(controlled.ctx)
    controlled.ctx.provide('timer', { timeout: 42 } as never)
    try {
      expect(captureMessage(() => createMemoryPersistencePlugin({ schedule: SCHEDULE }).apply(controlled.ctx))).toBe(
        EXISTING_TIMER_MESSAGE,
      )
      expect(controlled.ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBeUndefined()
    } finally {
      void controlled.base.fiber.dispose()
    }
  })

  it('sentinel：未 fire 的 timer capability 不发生 flush（无 ambient timer）', async () => {
    const symbolTimer = createRootTimerProbe()
    const fixture = harness({ symbol: { kind: 'value', value: symbolTimer }, legacy: { kind: 'absent' } })
    try {
      fixture.plugin.apply(fixture.controlled.ctx)
      const instance = fixture.plugin.instance!
      // createDoc commits the initial snapshot; saveDoc is the dirty notification
      // and must not add a synchronous store write on top of that.
      const doc = makeDoc('d-sentinel', 17)
      const handle = await instance.createDoc(ALICE, 'd-sentinel', doc)
      const writesAfterCreate = fixture.store.writeCount()
      await instance.saveDoc(handle)
      expect(fixture.store.writeCount()).toBe(writesAfterCreate)
      expect(symbolTimer.armCount).toBeGreaterThan(0)
      // No ambient timer may fire the flush while the armed capability is silent.
      await delay(SCHEDULE.debounceMs * 8 + 40)
      expect(fixture.store.writeCount()).toBe(writesAfterCreate)
      symbolTimer.fireAll()
      await waitFor(() => fixture.store.writeCount() > writesAfterCreate, 'sentinel flush after explicit fire')
      expect(snapshotValue(fixture.store.snapshots.get(storeKey('d-sentinel')))).toBe(17)
    } finally {
      await fixture.dispose()
    }
  })
})

// ---------------------------------------------------------------- AC9 default options

describe('AC9 无新增配置/条件装配', () => {
  it('默认 options：无新增配置即 boot + saveDoc + flush', async () => {
    const ctx = new Context()
    createSystemClockPlugin().apply(ctx)
    // Real baseline TimerService: the default Host assembly (clock → timer → persistence).
    new TimerService(ctx)
    const store = createMemoryStore()
    // Only the pre-existing observability hook is passed — no root/channel/baseline option.
    const plugin = createMemoryPersistencePlugin({ writeSnapshot: store.writeSnapshot })
    plugin.apply(ctx)
    const instance = plugin.instance!
    expect(ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBe(instance)
    expect(instance.getStatus()).toBe('ready')
    await createAndSave(instance, 'd-default', 23)
    // Default schedule (debounce 500ms): the flush must land inside the deadline.
    await waitFor(() => store.writeCount() > 0, 'default-options flush', 5000)
    expect(snapshotValue(store.snapshots.get(storeKey('d-default')))).toBe(23)
    await ctx.fiber.dispose()
    expect(ctx.get(NOMICORE_PERSISTENCE_SERVICE)).toBeUndefined()
  })
})

// ---------------------------------------------------------------- baseline channel shape

describe('基线通道形状（SA6 §12.3，root-probe suite）', () => {
  const expected = (process.env.NOMICORE_CORDIS_EXPECTED_CHANNEL ?? 'legacy') as 'legacy' | 'symbol'
  const fault = process.env.NOMICORE_CORDIS_FAULT

  it('基线通道精确命中期望形态，且不出现「至少命中一个通道」的弱断言', () => {
    const ctx = new Context()
    // The TimerService mixes `timeout` into the context: without it the channel
    // would have no capability at all on either baseline.
    new TimerService(ctx)
    if (fault === 'legacy-shim') {
      // F9: the shim and the shape assertion act on the SAME controlled context
      // (no cross-object, no cross-process shimming). On the symbol baseline this
      // must turn the "legacy is absent" assertion red.
      Object.defineProperty(ctx, 'root', { value: { timeout: () => () => {} }, configurable: true, enumerable: false })
    }
    const legacy = Reflect.get(ctx, 'root')
    const symbol = Reflect.get(ctx, ROOT_SYMBOL)
    if (expected === 'symbol') {
      expect(legacy).toBeUndefined()
      expect(symbol).toBe(ctx)
      expect((Context as unknown as { root?: unknown }).root).toBe(ROOT_SYMBOL)
      expect(typeof (symbol as Context).timeout).toBe('function')
    } else {
      expect(legacy).toBe(ctx)
      expect(symbol).toBeUndefined()
      expect((Context as unknown as { root?: unknown }).root).toBeUndefined()
      expect(typeof (legacy as Context).timeout).toBe('function')
    }
  })
})
