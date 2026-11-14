/**
 * issue #471 — shared *test-only* support for the three-baseline behaviour suites
 * (`ws-cordis-channel`, `ws-cordis-timers`, `replication-lifecycle`).
 *
 * This file is deliberately NOT a `*.test.ts`: the root `vitest.config.ts` glob
 * (`packages/*\/test/**\/*.test.ts`) never collects it, and it is registered in
 * `run-baseline.mjs` `NEW_FILES` so the baseline workspaces receive it.
 *
 * It is a test observation helper (meter / predicate polling / controlled channel
 * shapes), NOT a second verification facility: the single artifact acquisition
 * (`acquire.mjs`), probe (`root-probe.mjs`) and runner (`run-baseline.mjs`) stay
 * untouched (AC7 / design §8.1).
 *
 * Naming (design §8.1 / D-7 / T-1a):
 *   describe label   = NOMICORE_CORDIS_BASELINE ?? 'default'
 *   lifecycle unit   = L.<entry>.<scenario>   (baseline segment lives in the label)
 *   JSON full name   = `<label> > L.<entry>.<scenario>`
 *
 * No test hard-codes a `.cache` path (SA8 B-2): the runner injects the only
 * baseline identity env the tests read.
 */
import { Context } from '@deepseek-ai/cordis'
import { TimerService } from '@deepseek-ai/cordis-plugin-timer'
import { createSystemClockPlugin, provideClock } from '@nomicore/clock'
import { provideInstance } from '@nomicore/instance'
import { provideNomicoreRegistry } from '@nomicore/namespace-registry'
import type { NamespaceRegistry } from '@nomicore/namespace-registry'
import type { ReplicationTimer } from '@nomicore/ws-replication'

// ---------------------------------------------------------------- identity

/** describe label: the baseline id under the runner, `default` in the repository layout. */
export const BASELINE_LABEL: string = process.env.NOMICORE_CORDIS_BASELINE ?? 'default'
/** Expected Root channel: only asserted when the baseline runner injected it (runner mode). */
export const EXPECTED_CHANNEL: 'legacy' | 'symbol' | undefined =
  process.env.NOMICORE_CORDIS_EXPECTED_CHANNEL === 'legacy' || process.env.NOMICORE_CORDIS_EXPECTED_CHANNEL === 'symbol'
    ? (process.env.NOMICORE_CORDIS_EXPECTED_CHANNEL as 'legacy' | 'symbol')
    : undefined
/** Runner mode flag — strict identity equality assertions only run here (design D-7). */
export const RUNNER_MODE: boolean = process.env.NOMICORE_CORDIS_RUNNER_MODE === '1'
/** N-2 legacy-shim fault injection (design §9.1 fault consumption discipline). */
export const FAULT: string | undefined = process.env.NOMICORE_CORDIS_FAULT

export const ROOT_SYMBOL = Symbol.for('cordis.root') as unknown as symbol
/** Legacy Root channel property key (kept as a constant so the literal never sits in a call-arg position). */
const LEGACY_ROOT_KEY = 'root'

// ---------------------------------------------------------------- real TimerService meter

export interface TimerArm {
  readonly delay: number
  settled: boolean
  fired: boolean
}

export interface TimerMeter {
  /** Total number of arms seen since the last reset. */
  readonly arms: number
  readonly entries: readonly TimerArm[]
  /** Live (armed and neither fired nor disposed) timers, all delays. */
  pending(): number
  /** Live (armed and neither fired nor disposed) timers for one configured delay. */
  pendingFor(delay: number): number
  /** Number of arms recorded for one configured delay. */
  armsFor(delay: number): number
  delays(): number[]
  includes(delay: number): boolean
  reset(): void
}

interface TimeoutFn {
  (callback: () => void, delay: number): () => void
}

/**
 * Instrument `TimerService.prototype.timeout` BEFORE any `TimerService` is
 * constructed (design §9.1 / A1-8: the timer service mixes `timeout` into the
 * context at provide time, so the patch must precede construction). The pending
 * counter is decremented both when the armed disposer runs and when the timer
 * fires naturally, so "pending === 0 after dispose" is an honest statement about
 * live timers.
 */
export function installRealTimerMeter(): { meter: TimerMeter; restore: () => void } {
  const entries: TimerArm[] = []
  const original = TimerService.prototype.timeout as unknown as TimeoutFn
  const meter: TimerMeter = {
    get arms() {
      return entries.length
    },
    get entries() {
      return entries
    },
    pending() {
      return entries.filter((entry) => !entry.settled).length
    },
    pendingFor(delay: number) {
      return entries.filter((entry) => entry.delay === delay && !entry.settled).length
    },
    armsFor(delay: number) {
      return entries.filter((entry) => entry.delay === delay).length
    },
    delays() {
      return entries.map((entry) => entry.delay)
    },
    includes(delay: number) {
      return entries.some((entry) => entry.delay === delay)
    },
    reset() {
      entries.length = 0
    },
  }
  ;(TimerService.prototype as unknown as { timeout: TimeoutFn }).timeout = function patchedTimeout(
    this: TimerService,
    callback: () => void,
    delay: number,
  ) {
    // The promise form (`timeout(delay)`) is not used by the replication seam; forward it
    // unchanged so the meter never changes service semantics.
    if (typeof callback !== 'function') {
      return (original as unknown as (...args: unknown[]) => () => void).call(this, callback, delay)
    }
    const entry: TimerArm = { delay, settled: false, fired: false }
    entries.push(entry)
    const settle = (): void => {
      entry.settled = true
    }
    const disposer = original.call(this, () => {
      entry.fired = true
      settle()
      callback()
    }, delay)
    return () => {
      settle()
      disposer()
    }
  }
  return {
    meter,
    restore: () => {
      ;(TimerService.prototype as unknown as { timeout: TimeoutFn }).timeout = original
    },
  }
}

// ---------------------------------------------------------------- helpers

export function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

/** Predicate polling with a hard deadline — never a fixed number of settle rounds (SA6 §7). */
export async function waitFor(predicate: () => boolean, label: string, deadlineMs = 3000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < deadlineMs) {
    if (predicate()) return
    await delay(2)
  }
  throw new Error(`waitFor timed out after ${deadlineMs}ms: ${label}`)
}

/** Assert that a predicate stays false for one configured window (deadline-based, not a sleep). */
export async function expectQuiet(
  predicate: () => boolean,
  windowMs: number,
  label: string,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < windowMs) {
    if (predicate()) throw new Error(`unexpected consequence inside the quiet window: ${label}`)
    await delay(2)
  }
}

export function captureMessage(action: () => unknown): string {
  try {
    action()
  } catch (error) {
    return (error as Error).message
  }
  return '<no throw>'
}

export interface EventSink<T> {
  readonly events: T[]
  push(event: T): void
}

export function createEventSink<T>(): EventSink<T> {
  const events: T[] = []
  return {
    events,
    push(event: T) {
      events.push(event)
    },
  }
}

// ---------------------------------------------------------------- controlled Root channel shapes

export type ChannelMode =
  | { readonly kind: 'value'; readonly value: unknown }
  | { readonly kind: 'absent' }
  | { readonly kind: 'throws'; readonly message: string }

export interface RecordingRootTimer {
  readonly armCount: number
  readonly pending: number
  readonly delays: readonly number[]
  readonly callbacks: ReadonlyArray<() => void>
  timeout(callback: () => void, delayMs: number): () => void
  /** Fire up to `count` pending entries (bounded: retry loops must not run away). */
  fire(count?: number): void
  /** Fire up to `count` pending entries armed with exactly `delayMs`. */
  fireDelay(delayMs: number, count?: number): number
}

/**
 * Recording Root timer capability: it never runs anything by itself (`setTimeout`
 * is never consulted), so a "sentinel" host proves the seam does not fall back to
 * an ambient timer (A1-7 / N-4).
 */
export function recordingRootTimer(): RecordingRootTimer {
  const entries: Array<{ callback: () => void; delayMs: number; cancelled: boolean; fired: boolean }> = []
  return {
    get armCount() {
      return entries.length
    },
    get pending() {
      return entries.filter((entry) => !entry.cancelled && !entry.fired).length
    },
    get delays() {
      return entries.map((entry) => entry.delayMs)
    },
    get callbacks() {
      return entries.map((entry) => entry.callback)
    },
    timeout(callback: () => void, delayMs: number) {
      const entry = { callback, delayMs, cancelled: false, fired: false }
      entries.push(entry)
      return () => {
        entry.cancelled = true
      }
    },
    fire(count = Number.POSITIVE_INFINITY) {
      for (let fired = 0; fired < count; fired += 1) {
        const next = entries.find((entry) => !entry.cancelled && !entry.fired)
        if (next === undefined) return
        next.fired = true
        next.callback()
      }
    },
    fireDelay(delayMs: number, count = 1) {
      let fired = 0
      for (; fired < count; fired += 1) {
        const next = entries.find((entry) => !entry.cancelled && !entry.fired && entry.delayMs === delayMs)
        if (next === undefined) return fired
        next.fired = true
        next.callback()
      }
      return fired
    },
  }
}

export interface ControlledContext {
  readonly ctx: Context
  readonly base: Context
  readonly reads: { symbol: number; legacy: number }
}

function readChannel(mode: ChannelMode | undefined): unknown {
  if (mode === undefined || mode.kind === 'absent') return undefined
  if (mode.kind === 'throws') throw new Error(mode.message)
  return mode.value
}

/**
 * Real Cordis Context whose two Root channel keys are controlled by the test.
 * Every other property is read from the real context and method calls are bound to
 * it, so cordis service/effect/plugin mechanics stay genuine (same technique as
 * `packages/persistence/test/cordis-root-channel.test.ts`).
 *
 * N-2 fault discipline: when `NOMICORE_CORDIS_FAULT === 'legacy-shim'` a legacy
 * `root` capability is injected on the SAME controlled context for every shape
 * that did not explicitly declare a legacy channel — the "legacy is absent" /
 * "double absence" assertions then turn red for the target reason, exactly as the
 * existing probe does.
 */
export function controlledContext(channels: { symbol?: ChannelMode; legacy?: ChannelMode } = {}): ControlledContext {
  const base = new Context()
  const reads = { symbol: 0, legacy: 0 }
  const declared = { ...channels }
  if (FAULT === 'legacy-shim' && declared.legacy === undefined) {
    declared.legacy = { kind: 'value', value: { timeout: () => () => {} } }
  }
  const ctx = new Proxy(base, {
    get(target, key) {
      if (key === (ROOT_SYMBOL as unknown as PropertyKey)) {
        reads.symbol += 1
        return readChannel(declared.symbol)
      }
      if (key === LEGACY_ROOT_KEY) {
        reads.legacy += 1
        return readChannel(declared.legacy)
      }
      const value = Reflect.get(target, key, target) as unknown
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
    },
  }) as unknown as Context
  return { ctx, base, reads }
}

// ---------------------------------------------------------------- assembly shims

/** Timer-service probe whose `timeout` only records (never fires by itself). */
export function recordingTimerService(): { timeout: (callback: () => void, delayMs: number) => () => void; armCount: number } {
  const capability = recordingRootTimer()
  const probe = {
    armCount: 0,
    timeout(callback: () => void, delayMs: number) {
      probe.armCount += 1
      return capability.timeout(callback, delayMs)
    },
  }
  return probe
}

export interface RuntimeDependencies {
  readonly role: 'hub' | 'peer'
  readonly instanceId: string
  readonly registry?: unknown
  readonly timer?: unknown
}

/**
 * Minimal Host dependency shim: Instance → Clock → Timer → Registry. The timer
 * value is injected verbatim (`{ timeout, ctx }` capability or a real
 * `TimerService`), so the production seam performs its own two-hop resolution.
 */
export function provideRuntimeDependencies(ctx: Context, options: RuntimeDependencies): void {
  provideInstance(ctx, Object.freeze({ instanceId: options.instanceId, role: options.role }) as never)
  provideClock(ctx, { now: () => 1 })
  ctx.provide('timer', (options.timer ?? recordingTimerService()) as never)
  provideNomicoreRegistry(ctx, (options.registry ?? { open: () => undefined }) as unknown as NamespaceRegistry)
}

export interface RealTimerAssembly {
  readonly ctx: Context
  readonly base: Context
  readonly timerService: TimerService
  /** `ReplicationTimer` bridge over the baseline service (used by the public factories). */
  readonly timer: ReplicationTimer
  dispose(): Promise<void>
}

/**
 * Minimal real-`TimerService` assembly (design §8.1 recipe, registry-free subset):
 * `new Context()` → instance → clock → `new TimerService(ctx)`. The timer bridge is
 * the `timerFromContext` wrapper shape the plugins build (`rootTimer.timeout` arms,
 * `dispose` clears), so the factories consume the baseline service directly.
 */
export function createRealTimerAssembly(options: {
  role: 'hub' | 'peer'
  instanceId: string
  registry?: unknown
  withRegistry?: boolean
}): RealTimerAssembly {
  const base = new Context()
  createSystemClockPlugin().apply(base)
  provideInstance(base, Object.freeze({ instanceId: options.instanceId, role: options.role }) as never)
  const timerService = new TimerService(base)
  if (options.withRegistry === true) {
    provideNomicoreRegistry(base, options.registry as unknown as NamespaceRegistry)
  }
  const timer = timerBridge(timerService)
  return {
    ctx: base,
    base,
    timerService,
    timer,
    dispose: async () => {
      await base.fiber.dispose()
    },
  }
}

/** `ReplicationTimer` over a real `TimerService` instance (mirrors the seam wrapper). */
export function timerBridge(service: TimerService): ReplicationTimer {
  return {
    setTimeout: (callback, delayMs) => service.timeout(callback, delayMs),
    clearTimeout: (handle) => {
      if (typeof handle === 'function') (handle as () => void)()
    },
  }
}

/** `DuplexTransport` close recorder over the memory duplex ends used by the suites. */
export interface CloseRecorder {
  readonly closes: Array<Readonly<{ code: number; reason: string }>>
  readonly closed: () => boolean
}

export function recordCloses(transport: {
  closed: boolean
  onClose(listener: (info: { code: number; reason: string }) => void): () => void
}): CloseRecorder {
  const closes: Array<Readonly<{ code: number; reason: string }>> = []
  transport.onClose((info) => {
    closes.push({ code: info.code, reason: info.reason })
  })
  return { closes, closed: () => transport.closed }
}
