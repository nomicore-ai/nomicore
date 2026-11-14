/**
 * issue #471 — AC1 / A1-1…A1-7 (design §9.1) on every baseline.
 *
 * The Host timer adapter (`packages/ws-replication/src/plugin.ts` seam) must resolve
 * the Cordis Root timer channel symbol-first with the legacy `root` property as
 * fallback, must fail loudly and synchronously when the channel is present but
 * malformed or entirely absent, must cascade through `timer.ctx` → plugin `ctx`
 * only when a whole host is absent, and must never fall back to an ambient timer.
 *
 * Observation vocabulary is behaviour-only: recorded Root-channel arm counts,
 * recorded legacy-channel read counts, the synchronous apply throw message,
 * recorded transport closes and published service visibility. No source-text
 * assertions (SA6 §12.0).
 *
 * Fault discipline (design §9.1 / N-2): `NOMICORE_CORDIS_FAULT=legacy-shim`
 * injects a legacy `root` capability on the SAME controlled context, which turns
 * the "legacy absent" / "double absence" assertions red for the target reason.
 *
 * A5-2 (fixture channel self-description): every injection point names its shape —
 * `C.symbol-only.*` / `C.legacy-only.*` / `C.both.*` / `C.malformed.*` /
 * `C.absent.*` — and the five-shape set is enumerated by this describe structure.
 */
import { describe, expect, it } from 'vitest'
import { encodeMessage } from '@nomicore/replication-protocol'
import { provideClock } from '@nomicore/clock'
import { provideInstance } from '@nomicore/instance'
import { provideNomicoreRegistry } from '@nomicore/namespace-registry'
import type { ReplicationObserverEvent } from '@nomicore/ws-replication'
import {
  createHubReplicationPlugin,
  createPeerReplicationPlugin,
  NOMICORE_HUB_REPLICATION_SERVICE,
  NOMICORE_HUB_SESSION_HOST_SERVICE,
  NOMICORE_PEER_REPLICATION_SERVICE,
  requireHubSessionHost,
} from '@nomicore/ws-replication'
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing'
import { HUB_OWNER, makeHubNamespace, makeNode, PEER_INSTANCE } from './harness.js'
import {
  BASELINE_LABEL,
  controlledContext,
  createRealTimerAssembly,
  delay,
  EXPECTED_CHANNEL,
  expectQuiet,
  recordingRootTimer,
  recordingTimerService,
  ROOT_SYMBOL,
  waitFor,
  type ChannelMode,
  type RecordingRootTimer,
} from './cordis-baseline-support.js'

const ROOT_TIMER_MESSAGE = 'required Cordis root timer context is unavailable'
const TIMER_SERVICE_MESSAGE = 'required Cordis service "timer" is unavailable'
const AUTHORIZATION = {
  ok: true as const,
  localOwner: HUB_OWNER,
  permissions: { read: true as const, submit: true as const },
}
const HELLO_TIMEOUT_MS = 40

type Entry = 'hub-listen' | 'peer-dial' | 'session-host'
const ENTRIES: readonly Entry[] = ['hub-listen', 'peer-dial', 'session-host']

interface MountOptions {
  readonly channels?: { symbol?: ChannelMode; legacy?: ChannelMode }
  readonly timerCtx?: unknown
  readonly provideTimer?: boolean
  readonly timeouts?: Record<string, number>
}

interface Consequences {
  /** Number of observed terminal consequences (transport closes / namespace finalization). */
  count(): number
  describe(): string
}

interface MountedEntry {
  readonly reads: { symbol: number; legacy: number }
  readonly consequences: Consequences
  /** Start the entry's first timer-arming action (hello / dial / bootstrap). */
  start(): Promise<void>
  dispose(): Promise<void>
}

const ROLE_OF: Record<Entry, 'hub' | 'peer'> = { 'hub-listen': 'hub', 'peer-dial': 'peer', 'session-host': 'hub' }
const INSTANCE_OF: Record<Entry, string> = { 'hub-listen': 'hub-one', 'peer-dial': 'peer-one', 'session-host': 'hub-one' }

/** Provide the four Host services the replication plugins inject. */
function provideHostServices(
  ctx: import('@deepseek-ai/cordis').Context,
  entry: Entry,
  timer: unknown,
  registry: unknown,
): void {
  provideInstance(ctx, Object.freeze({ instanceId: INSTANCE_OF[entry], role: ROLE_OF[entry] }) as never)
  provideClock(ctx, { now: () => 1 })
  ctx.provide('timer', timer as never)
  provideNomicoreRegistry(ctx, registry as never)
}

/** Observes the entry's natural terminal consequences without touching production code. */
function transportConsequences(): { record: (transport: import('@nomicore/ws-replication').DuplexTransport) => void } & Consequences {
  const closes: Array<{ code: number; reason: string }> = []
  const self = {
    record(transport: import('@nomicore/ws-replication').DuplexTransport) {
      transport.onClose((info) => {
        closes.push({ code: info.code, reason: info.reason })
      })
    },
    count: () => closes.length,
    describe: () => JSON.stringify(closes),
  }
  return self
}

async function mountEntry(entry: Entry, options: MountOptions = {}): Promise<MountedEntry> {
  const controlled = controlledContext(options.channels ?? {})
  const ctx = controlled.ctx
  const timerService = recordingTimerService()
  const timerValue = {
    timeout: timerService.timeout,
    ...(options.timerCtx === undefined ? {} : { ctx: options.timerCtx }),
  }
  const timeouts = options.timeouts ?? {}
  const consequences = transportConsequences()
  const observerEvents: ReplicationObserverEvent[] = []

  let start: () => Promise<void>
  if (entry === 'session-host') {
    const node = makeNode('hub')
    const fixture = await makeHubNamespace(node)
    provideHostServices(ctx, entry, options.provideTimer === false ? undefined : timerValue, node.registry)
    const plugin = createHubReplicationPlugin(
      { listen: false, ...(Object.keys(timeouts).length > 0 ? { timeouts } : {}) },
      { observer: (event) => observerEvents.push(event) },
    )
    await plugin.apply(ctx)
    const service = requireHubSessionHost(ctx)
    const namespaceEvents = (): number =>
      observerEvents.filter((event) => event.type === 'namespace-failed' || event.type === 'chunked-sync-aborted').length
    consequences.count = namespaceEvents
    consequences.describe = () => JSON.stringify(observerEvents.map((event) => event.type))
    start = async () => {
      const handle = service.open({
        connectionKey: 'conn-1',
        remoteInstanceId: PEER_INSTANCE,
        namespaceId: fixture.namespaceId,
        authorization: AUTHORIZATION,
        selectedCapabilities: 0,
      })
      handle.handleFrame(encodeMessage(
        { kind: 'OPEN_NAMESPACE', namespaceId: fixture.namespaceId, hasLocalReplica: false },
        { sequence: 1 },
      ))
    }
  } else if (entry === 'peer-dial') {
    let dialled = 0
    const plugin = createPeerReplicationPlugin(
      { expectedHubInstanceId: 'hub-one', ...(Object.keys(timeouts).length > 0 ? { timeouts } : {}) },
      {
        dial: () => {
          dialled += 1
          const duplex = createMemoryDuplexTransport()
          consequences.record(duplex.hub)
          return duplex.peer
        },
        random: () => 0.5,
      },
    )
    provideHostServices(ctx, entry, options.provideTimer === false ? undefined : timerValue, { open: () => undefined })
    plugin.apply(ctx)
    start = async () => {
      await waitFor(() => dialled > 0, 'peer dial')
    }
  } else {
    let accept: ((transport: import('@nomicore/ws-replication').DuplexTransport, identity?: unknown) => void) | undefined
    const plugin = createHubReplicationPlugin(
      {
        listen: { host: '127.0.0.1', port: 0 },
        tokens: [],
        authorization: [],
        ...(Object.keys(timeouts).length > 0 ? { timeouts } : {}),
      },
      {
        listen: {
          listen: async (listenOptions: { accept: (transport: import('@nomicore/ws-replication').DuplexTransport, identity?: unknown) => void }) => {
            accept = listenOptions.accept
            return { port: 1, close: async () => undefined }
          },
        },
      } as never,
    )
    provideHostServices(ctx, entry, options.provideTimer === false ? undefined : timerValue, { open: () => undefined })
    await plugin.apply(ctx)
    start = async () => {
      await waitFor(() => accept !== undefined, 'hub listener accept')
      const duplex = createMemoryDuplexTransport()
      consequences.record(duplex.peer)
      accept!(duplex.hub, { peerInstanceId: PEER_INSTANCE })
    }
  }
  return {
    reads: controlled.reads,
    consequences,
    start,
    dispose: async () => {
      await controlled.base.fiber.dispose()
    },
  }
}

/** Apply must fail synchronously with the frozen message, leaving no service and no arm. */
async function expectSynchronousRejection(
  entry: Entry,
  options: { channels?: { symbol?: ChannelMode; legacy?: ChannelMode }; timerCtx?: unknown; provideTimer?: boolean },
  expectedMessage: string = ROOT_TIMER_MESSAGE,
): Promise<{ rejected: boolean; armCount: number }> {
  const controlled = controlledContext(options.channels ?? {})
  const ctx = controlled.ctx
  const timerService = recordingTimerService()
  const timerValue = {
    timeout: timerService.timeout,
    ...(options.timerCtx === undefined ? {} : { ctx: options.timerCtx }),
  }
  provideHostServices(ctx, entry, options.provideTimer === false ? undefined : timerValue, { open: () => undefined })
  let rejected = false
  let message = '<no throw>'
  try {
    if (entry === 'peer-dial') {
      createPeerReplicationPlugin({ expectedHubInstanceId: 'hub-one' }, { dial: () => createMemoryDuplexTransport().peer }).apply(ctx)
    } else if (entry === 'session-host') {
      await createHubReplicationPlugin({ listen: false }).apply(ctx)
    } else {
      await createHubReplicationPlugin(
        { listen: { host: '127.0.0.1', port: 0 }, tokens: [], authorization: [] },
        { listen: { listen: async () => ({ port: 1, close: async () => undefined }) } },
      ).apply(ctx)
    }
  } catch (error) {
    rejected = true
    message = (error as Error).message
  }
  const service = entry === 'peer-dial'
    ? ctx.get(NOMICORE_PEER_REPLICATION_SERVICE)
    : entry === 'session-host'
      ? ctx.get(NOMICORE_HUB_SESSION_HOST_SERVICE)
      : ctx.get(NOMICORE_HUB_REPLICATION_SERVICE)
  const armCount = timerService.armCount
  await controlled.base.fiber.dispose()
  expect(message).toBe(expectedMessage)
  expect(rejected, 'apply must reject synchronously for a malformed/absent channel').toBe(true)
  expect(service, 'no service may be published when the channel is unusable').toBeUndefined()
  return { rejected, armCount }
}

function symbolChannel(runtime: RecordingRootTimer): ChannelMode {
  return { kind: 'value', value: runtime }
}

function legacyChannel(runtime: RecordingRootTimer): ChannelMode {
  return { kind: 'value', value: runtime }
}

describe(BASELINE_LABEL, () => {
  // ------------------------------------------------------------ A1-1 / A1-2 / A5-2
  describe('C.symbol-only', () => {
    for (const entry of ENTRIES) {
      it(`C.symbol-only.${entry}`, async () => {
        const symbolRuntime = recordingRootTimer()
        const mounted = await mountEntry(entry, { channels: { symbol: symbolChannel(symbolRuntime) } })
        await mounted.start()
        await waitFor(() => symbolRuntime.armCount > 0, `${entry}: symbol channel arms the first timer`)
        expect(mounted.reads.legacy, 'legacy channel read count must be 0 when the symbol channel exists').toBe(0)
        expect(mounted.reads.symbol).toBeGreaterThan(0)
        await mounted.dispose()
      })
    }
  })

  describe('C.legacy-only', () => {
    for (const entry of ENTRIES) {
      it(`C.legacy-only.${entry}`, async () => {
        const legacyRuntime = recordingRootTimer()
        const mounted = await mountEntry(entry, { channels: { legacy: legacyChannel(legacyRuntime) } })
        await mounted.start()
        await waitFor(() => legacyRuntime.armCount > 0, `${entry}: legacy channel arms the first timer`)
        expect(mounted.reads.legacy).toBeGreaterThan(0)
        await mounted.dispose()
      })
    }
  })

  describe('C.both.priority', () => {
    for (const entry of ENTRIES) {
      it(`C.both.priority.${entry}`, async () => {
        const symbolRuntime = recordingRootTimer()
        const legacyRuntime = recordingRootTimer()
        const mounted = await mountEntry(entry, {
          channels: { symbol: symbolChannel(symbolRuntime), legacy: legacyChannel(legacyRuntime) },
        })
        await mounted.start()
        await waitFor(() => symbolRuntime.armCount > 0, `${entry}: symbol channel wins`)
        expect(legacyRuntime.armCount, 'legacy channel must never arm while the symbol channel exists').toBe(0)
        expect(mounted.reads.legacy, 'legacy getter read count must be 0').toBe(0)
        await mounted.dispose()
      })
    }
  })

  // ------------------------------------------------------------ A1-3 malformed
  describe('C.malformed', () => {
    for (const entry of ENTRIES) {
      it(`C.malformed.${entry}`, async () => {
        const legacyRuntime = recordingRootTimer()
        const outcome = await expectSynchronousRejection(entry, {
          channels: {
            symbol: { kind: 'value', value: { timeout: 'not-a-function' } },
            legacy: legacyChannel(legacyRuntime),
          },
        })
        expect(outcome.armCount, 'zero timer arms on a malformed channel').toBe(0)
        expect(legacyRuntime.armCount, 'a malformed symbol channel must not fall through to legacy').toBe(0)
      })
    }
  })

  // ------------------------------------------------------------ A1-4 double absence
  describe('C.absent', () => {
    for (const entry of ENTRIES) {
      it(`C.absent.${entry}`, async () => {
        const outcome = await expectSynchronousRejection(entry, { channels: {} })
        expect(outcome.armCount, 'zero timer arms on double absence').toBe(0)
      })
    }
  })

  // ------------------------------------------------------------ A1-5 timer service
  describe('C.timer-service', () => {
    for (const entry of ENTRIES) {
      it(`C.timer-service.missing.${entry}`, async () => {
        const outcome = await expectSynchronousRejection(entry, { channels: {}, provideTimer: false }, TIMER_SERVICE_MESSAGE)
        expect(outcome.rejected).toBe(true)
      })

      it(`C.timer-service.malformed.${entry}`, async () => {
        const controlled = controlledContext({})
        const ctx = controlled.ctx
        provideHostServices(ctx, entry, { timeout: 'not-a-function' }, { open: () => undefined })
        let message = '<no throw>'
        try {
          if (entry === 'peer-dial') {
            createPeerReplicationPlugin({ expectedHubInstanceId: 'hub-one' }, { dial: () => createMemoryDuplexTransport().peer }).apply(ctx)
          } else if (entry === 'session-host') {
            await createHubReplicationPlugin({ listen: false }).apply(ctx)
          } else {
            await createHubReplicationPlugin(
              { listen: { host: '127.0.0.1', port: 0 }, tokens: [], authorization: [] },
              { listen: { listen: async () => ({ port: 1, close: async () => undefined }) } },
            ).apply(ctx)
          }
        } catch (error) {
          message = (error as Error).message
        }
        await controlled.base.fiber.dispose()
        expect(message).toBe(TIMER_SERVICE_MESSAGE)
      })
    }
  })

  // ------------------------------------------------------------ A1-6 two-hop cascade
  describe('C.cascade', () => {
    it('C.cascade.timer-context-first.hub-listen', async () => {
      const timerCtxRuntime = recordingRootTimer()
      const pluginCtxRuntime = recordingRootTimer()
      const mounted = await mountEntry('hub-listen', {
        channels: { symbol: symbolChannel(pluginCtxRuntime) },
        timerCtx: { [ROOT_SYMBOL]: { timeout: timerCtxRuntime.timeout } },
      })
      await mounted.start()
      await waitFor(() => timerCtxRuntime.armCount > 0, 'timer.ctx channel used')
      expect(pluginCtxRuntime.armCount, 'plugin ctx channel must not arm when timer.ctx provides one').toBe(0)
      await mounted.dispose()
    })

    it('C.cascade.plugin-context-fallback.hub-listen', async () => {
      const pluginCtxRuntime = recordingRootTimer()
      const mounted = await mountEntry('hub-listen', {
        channels: { symbol: symbolChannel(pluginCtxRuntime) },
        timerCtx: {},
      })
      await mounted.start()
      await waitFor(() => pluginCtxRuntime.armCount > 0, 'plugin ctx fallback used')
      await mounted.dispose()
    })

    it('C.cascade.timer-context-undefined.hub-listen', async () => {
      const pluginCtxRuntime = recordingRootTimer()
      const mounted = await mountEntry('hub-listen', {
        channels: { symbol: symbolChannel(pluginCtxRuntime) },
        timerCtx: undefined,
      })
      await mounted.start()
      await waitFor(() => pluginCtxRuntime.armCount > 0, 'timer.ctx undefined cascades to plugin ctx')
      await mounted.dispose()
    })

    it('C.cascade.timer-context-null.hub-listen', async () => {
      const pluginCtxRuntime = recordingRootTimer()
      await expectSynchronousRejection('hub-listen', {
        channels: { symbol: symbolChannel(pluginCtxRuntime) },
        timerCtx: null,
      })
      expect(pluginCtxRuntime.armCount, 'a null timer.ctx is malformed — no fallback to the plugin ctx').toBe(0)
    })
  })

  // ------------------------------------------------------------ A1-7 no ambient timer
  describe('C.sentinel', () => {
    for (const entry of ENTRIES) {
      it(`C.sentinel.${entry}`, async () => {
        const sentinel = recordingRootTimer()
        const mounted = await mountEntry(entry, {
          channels: { symbol: symbolChannel(sentinel) },
          timeouts: { helloTimeoutMs: HELLO_TIMEOUT_MS, bootstrapTimeoutMs: HELLO_TIMEOUT_MS },
        })
        await mounted.start()
        await waitFor(() => sentinel.armCount > 0, `${entry}: sentinel armed by the first timer`)
        expect(mounted.consequences.count(), 'no consequence may happen before the sentinel is fired').toBe(0)
        // Silence beyond the configured window: an ambient `setTimeout` would have
        // produced the consequence by now (that is exactly what N-4 falsifies).
        await expectQuiet(
          () => mounted.consequences.count() > 0,
          HELLO_TIMEOUT_MS * 3,
          `${entry}: no ambient timer drives the consequence`,
        )
        // Fire only the entry's configured delay: an earlier arm from the registry test
        // scheduler (10 s) must not be consumed by the sentinel.
        expect(sentinel.fireDelay(HELLO_TIMEOUT_MS)).toBeGreaterThan(0)
        await delay(2)
        // Firing the sentinel explicitly is what produces the consequence.
        await waitFor(() => mounted.consequences.count() > 0, `${entry}: consequence after explicit fire`)
        await mounted.dispose()
      })
    }
  })

  // ------------------------------------------------------------ baseline identity (runner mode)
  describe('C.channel-identity', () => {
    it(`C.channel-identity.${BASELINE_LABEL}`, async () => {
      const assembly = createRealTimerAssembly({ role: 'hub', instanceId: 'hub-one' })
      const legacy = Reflect.get(assembly.base, 'root')
      const symbol = Reflect.get(assembly.base, ROOT_SYMBOL as unknown as PropertyKey)
      if (EXPECTED_CHANNEL === 'symbol') {
        expect(legacy, 'symbol baseline must not expose the legacy root property').toBeUndefined()
        expect(symbol).toBe(assembly.base)
      } else if (EXPECTED_CHANNEL === 'legacy') {
        expect(legacy).toBe(assembly.base)
        expect(symbol).toBeUndefined()
      } else {
        // Default repository layout: exactly one channel is reachable.
        expect(legacy === undefined && symbol === undefined).toBe(false)
      }
      await assembly.dispose()
    })
  })
})
