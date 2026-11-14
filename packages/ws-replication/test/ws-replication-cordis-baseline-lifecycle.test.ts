/**
 * issue #471 — AC2 / AC3 / AC4 / AC5 behaviour matrix (design §8, §10, §11-N5).
 *
 * Three entries × seven scenarios on the **real baseline `TimerService`**
 * (`TimerService.prototype.timeout` is instrumented before any construction), plus
 * the β (`createHubReplicationEdge` + `createHubSessionHost`) and γ
 * (`createHubAsyncSessionHost`) minimal rounds and the `coverage` completeness
 * self-check.
 *
 * Accounting (design §8.1 / T-1a):
 *   unit name   = L.<entry>.<scenario>   — 21 names (3 entries × 7 scenarios)
 *               + L.edge-beta.minimal-round + L.async-gamma.minimal-round = 23
 *   JSON name   = `<baseline> > L.…`     — the baseline segment lives in the label
 *   `coverage`  — a non-`L.` self-check name; it is NOT counted into `units`
 *                 (each baseline cell reports observed === 23) but must be present
 *                 and passed.
 *
 * Timing discipline (SA6 §7): every wait is a predicate poll with a deadline; no
 * fixed settle rounds, no fake scheduler.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { encodeMessage, decodeMessage } from '@nomicore/replication-protocol'
import {
  NOMICORE_HUB_REPLICATION_SERVICE,
  NOMICORE_HUB_SESSION_HOST_SERVICE,
  NOMICORE_PEER_REPLICATION_SERVICE,
  createHubReplicationPlugin,
  createPeerReplicationPlugin,
  requireHubReplication,
  requireHubSessionHost,
  requirePeerReplication,
  type DuplexTransport,
  type ReplicationObserverEvent,
} from '@nomicore/ws-replication'
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing'
import { createNamespaceRegistryForTesting } from '@nomicore/namespace-registry/testing'
import {
  HUB_OWNER,
  HUB_INSTANCE,
  PEER_INSTANCE,
  makeHubNamespace,
  makeNode,
  makeWire,
  settleUntil,
  type ReplicaNode,
  type Wire,
} from './harness.js'
import { TEST_TOKEN } from './driver.js'
import { createShimHubForTesting } from './issue420-shim-hub.js'
import { makeAsyncReplicationFacade, pumpUntil } from './issue447-async-seam.js'
import {
  BASELINE_LABEL,
  createRealTimerAssembly,
  delay,
  expectQuiet,
  installRealTimerMeter,
  waitFor,
  type TimerMeter,
} from './cordis-baseline-support.js'

const HELLO_MS = 30
const BOOTSTRAP_MS = 30
const CLOSE_MS = 30
const QUIET_MS = HELLO_MS * 3

type Entry = 'hub-listen' | 'peer-dial' | 'session-host'
type Scenario =
  | 'startup'
  | 'timer-fired'
  | 'timer-cancelled'
  | 'explicit-stop'
  | 'fiber-dispose'
  | 'service-revoked'
  | 'remount'

const ENTRY_OF: Record<Entry, { role: 'hub' | 'peer'; instanceId: string }> = {
  'hub-listen': { role: 'hub', instanceId: HUB_INSTANCE },
  'peer-dial': { role: 'peer', instanceId: PEER_INSTANCE },
  'session-host': { role: 'hub', instanceId: HUB_INSTANCE },
}

/** The pinned 23-name enumeration (T-1a-1); the runner holds the same list. */
const LIFECYCLE_UNITS: readonly string[] = [
  ...(['hub-listen', 'peer-dial', 'session-host'] as const).flatMap((entry) =>
    (['startup', 'timer-fired', 'timer-cancelled', 'explicit-stop', 'fiber-dispose', 'service-revoked', 'remount'] as const).map(
      (scenario) => `L.${entry}.${scenario}`,
    ),
  ),
  'L.edge-beta.minimal-round',
  'L.async-gamma.minimal-round',
]

const unit = (entry: Entry, scenario: Scenario): string => `L.${entry}.${scenario}`

/** Units whose assertions completed in this run (the `coverage` self-check reads this). */
const completedUnits = new Set<string>()

let meter: TimerMeter
let restoreMeter: () => void

beforeAll(() => {
  const installed = installRealTimerMeter()
  meter = installed.meter
  restoreMeter = installed.restore
})

afterAll(() => {
  restoreMeter()
})

beforeEach(() => {
  meter.reset()
})

interface EntryHandle {
  readonly ctx: import('@deepseek-ai/cordis').Context
  readonly fiber: import('@deepseek-ai/cordis').Fiber
  readonly entry: Entry
  readonly listenCalls: number
  readonly dials: () => number
  readonly closes: Array<Readonly<{ code: number; reason: string }>>
  readonly events: ReplicationObserverEvent[]
  readonly namespaceId: string
  /** Deliver one inbound transport to the hub listener (hub-listen entry only). */
  acceptTransport(): { closeCount: () => number }
  /** Open one namespace session (session-host entry only). */
  openSession(): { close: () => Promise<void> }
  disposeRoot(): Promise<void>
}

async function mountEntry(entry: Entry, options: { autoDispose?: boolean } = {}): Promise<EntryHandle> {
  const registryNode: ReplicaNode = makeNode(entry === 'peer-dial' ? 'peer' : 'hub')
  const fixture = entry === 'session-host' ? await makeHubNamespace(registryNode) : undefined
  const namespaceId = fixture?.namespaceId ?? `ns-${'a1'.repeat(16)}`
  const assembly = createRealTimerAssembly({
    role: ENTRY_OF[entry].role,
    instanceId: ENTRY_OF[entry].instanceId,
    registry: registryNode.registry,
    withRegistry: true,
  })
  const ctx = assembly.ctx
  const events: ReplicationObserverEvent[] = []
  const closes: Array<Readonly<{ code: number; reason: string }>> = []
  let listenCalls = 0
  let dialCount = 0
  let accept: ((transport: DuplexTransport, identity?: unknown) => void) | undefined

  const timeouts = { helloTimeoutMs: HELLO_MS, bootstrapTimeoutMs: BOOTSTRAP_MS, closeTimeoutMs: CLOSE_MS }
  let plugin: { apply(ctx: unknown): unknown }
  if (entry === 'hub-listen') {
    plugin = createHubReplicationPlugin(
      { listen: { host: '127.0.0.1', port: 0 }, tokens: [], authorization: [] },
      {
        timeouts,
        listen: {
          listen: async (listenOptions: { accept: (transport: DuplexTransport, identity?: unknown) => void }) => {
            listenCalls += 1
            accept = listenOptions.accept
            return { port: 1, close: async () => undefined }
          },
        },
      } as never,
    )
  } else if (entry === 'peer-dial') {
    plugin = createPeerReplicationPlugin(
      { expectedHubInstanceId: HUB_INSTANCE },
      {
        timeouts,
        backoff: { baseMs: 4, maxMs: 32, resetAfterMs: 20 },
        random: () => 0.5,
        dial: () => {
          dialCount += 1
          const duplex = createMemoryDuplexTransport()
          duplex.hub.onClose((info) => closes.push({ code: info.code, reason: info.reason }))
          return duplex.peer
        },
      },
    )
  } else {
    plugin = createHubReplicationPlugin(
      { listen: false, timeouts },
      { observer: (event) => events.push(event) },
    )
  }
  const fiber = ctx.plugin(plugin)
  await fiber.await()
  const handle: EntryHandle = {
    ctx,
    fiber,
    entry,
    listenCalls,
    dials: () => dialCount,
    closes,
    events,
    namespaceId,
    acceptTransport() {
      const duplex = createMemoryDuplexTransport()
      duplex.peer.onClose((info) => closes.push({ code: info.code, reason: info.reason }))
      accept!(duplex.hub, { peerInstanceId: PEER_INSTANCE })
      return { closeCount: () => closes.length }
    },
    openSession() {
      const service = requireHubSessionHost(ctx)
      const session = service.open({
        connectionKey: 'conn-1',
        remoteInstanceId: PEER_INSTANCE,
        namespaceId,
        authorization: { ok: true, localOwner: HUB_OWNER, permissions: { read: true, submit: true } },
        selectedCapabilities: 0,
      })
      session.handleFrame(encodeMessage(
        { kind: 'OPEN_NAMESPACE', namespaceId, hasLocalReplica: false },
        { sequence: 1 },
      ))
      return { close: () => session.close() }
    },
    async disposeRoot() {
      await assembly.dispose()
    },
  }
  return handle
}

function serviceOf(handle: EntryHandle): { status: unknown; stop: () => Promise<void> } {
  if (handle.entry === 'hub-listen') return requireHubReplication(handle.ctx) as never
  if (handle.entry === 'peer-dial') return requirePeerReplication(handle.ctx) as never
  return requireHubSessionHost(handle.ctx) as never
}

const serviceNameOf: Record<Entry, string> = {
  'hub-listen': NOMICORE_HUB_REPLICATION_SERVICE,
  'peer-dial': NOMICORE_PEER_REPLICATION_SERVICE,
  'session-host': NOMICORE_HUB_SESSION_HOST_SERVICE,
}

function otherEntryServices(entry: Entry): readonly string[] {
  if (entry === 'hub-listen') return [NOMICORE_HUB_SESSION_HOST_SERVICE]
  if (entry === 'session-host') return [NOMICORE_HUB_REPLICATION_SERVICE]
  return [NOMICORE_HUB_REPLICATION_SERVICE, NOMICORE_HUB_SESSION_HOST_SERVICE]
}

/** Run one scenario against a fresh assembly. */
async function withEntry(entry: Entry, run: (handle: EntryHandle) => Promise<void>): Promise<void> {
  const handle = await mountEntry(entry)
  try {
    await run(handle)
  } finally {
    try {
      await handle.fiber.dispose()
    } catch {
      // already disposed by the scenario
    }
    await handle.disposeRoot()
  }
}

describe(BASELINE_LABEL, () => {
  // ---------------------------------------------------------------- entry × scenario

  for (const entry of ['hub-listen', 'peer-dial', 'session-host'] as const) {
    describe(entry, () => {
      // 1. startup
      it(unit(entry, 'startup'), async () => {
        await withEntry(entry, async (handle) => {
          expect(handle.listenCalls).toBeLessThanOrEqual(1)
          if (entry === 'hub-listen') expect(handle.listenCalls).toBe(1)
          if (entry === 'peer-dial') expect(handle.dials()).toBe(1)
          const service = serviceOf(handle)
          expect(service).toBeDefined()
          expect((service.status as { state: string }).state).toBe('ready')
          // The two Hub entrances stay mutually exclusive (ADR 0032 decision 5).
          for (const name of otherEntryServices(entry)) {
            expect(handle.ctx.get(name as never), `${name} must be absent on the ${entry} entry`).toBeUndefined()
          }
          if (entry === 'hub-listen') {
            expect((service.status as { connections: number }).connections).toBe(0)
          }
          if (entry === 'session-host') {
            expect((service.status as { sessions: number }).sessions).toBe(0)
          }
        })
        completedUnits.add(unit(entry, 'startup'))
      })

      // 2. timer fired
      it(unit(entry, 'timer-fired'), async () => {
        await withEntry(entry, async (handle) => {
          if (entry === 'hub-listen') {
            handle.acceptTransport()
            await waitFor(() => meter.includes(HELLO_MS), 'hub hello timer armed with the configured delay')
            await waitFor(() => handle.closes.some((close) => close.code === 1002), 'hub HELLO timeout closes 1002')
            expect(meter.armsFor(HELLO_MS)).toBeGreaterThan(0)
          } else if (entry === 'peer-dial') {
            await waitFor(() => handle.dials() >= 1, 'peer dialled once')
            await waitFor(() => meter.includes(HELLO_MS), 'peer hello timer armed with the configured delay')
            await waitFor(
              () => handle.closes.some((close) => close.code === 1001 && close.reason === 'hello-timeout'),
              'peer hello timeout closes 1001 hello-timeout',
            )
            // A failed attempt schedules the deterministic full-jitter backoff (random = 0.5)
            // and redials: the second dial is the backoff consequence.
            await waitFor(() => handle.dials() >= 2, 'backoff redials the hub')
            expect(meter.delays().some((delayMs) => delayMs !== HELLO_MS)).toBe(true)
          } else {
            const session = handle.openSession()
            await waitFor(() => meter.includes(BOOTSTRAP_MS), 'session-host bootstrap timer armed')
            await waitFor(
              () => handle.events.some((event) => event.type === 'namespace-failed' && event.cause === 'bootstrap-timeout'),
              'bootstrap timeout finalizes the namespace',
            )
            await session.close()
          }
        })
        completedUnits.add(unit(entry, 'timer-fired'))
      }, 20_000)

      // 3. timer cancelled
      it(unit(entry, 'timer-cancelled'), async () => {
        await withEntry(entry, async (handle) => {
          if (entry === 'hub-listen') {
            handle.acceptTransport()
            await waitFor(() => meter.pendingFor(HELLO_MS) > 0, 'hub hello timer pending')
            handle.acceptTransport() // second connection; the first is cancelled below
            const before = handle.closes.length
            await serviceOf(handle).stop()
            expect(meter.pendingFor(HELLO_MS), 'stop() clears every hello timer').toBe(0)
            await expectQuiet(
              () => handle.closes.slice(before).some((close) => close.code === 1002),
              QUIET_MS,
              'no HELLO timeout may fire after stop()',
            )
          } else if (entry === 'peer-dial') {
            await waitFor(() => meter.pendingFor(HELLO_MS) > 0, 'peer hello timer pending')
            await serviceOf(handle).stop()
            expect(meter.pendingFor(HELLO_MS), 'stop() clears the hello timer').toBe(0)
            const dialsAtStop = handle.dials()
            await expectQuiet(() => handle.dials() > dialsAtStop, QUIET_MS, 'no backoff redial after stop()')
          } else {
            const session = handle.openSession()
            await waitFor(() => meter.pendingFor(BOOTSTRAP_MS) > 0, 'bootstrap timer pending')
            await session.close()
            await waitFor(() => meter.pendingFor(BOOTSTRAP_MS) === 0, 'session close clears the bootstrap timer')
            await expectQuiet(
              () => handle.events.some((event) => event.type === 'namespace-failed'),
              QUIET_MS,
              'no bootstrap timeout may fire after the session closed',
            )
          }
        })
        completedUnits.add(unit(entry, 'timer-cancelled'))
      }, 20_000)

      // 4. explicit stop
      it(unit(entry, 'explicit-stop'), async () => {
        await withEntry(entry, async (handle) => {
          const service = serviceOf(handle)
          const first = service.stop()
          const second = service.stop()
          expect(second, 'stop() must be idempotent (same Promise)').toBe(first)
          expect(handle.ctx.get(serviceNameOf[entry] as never), 'service stays registered during drain').toBeDefined()
          await first
          const status = service.status as { state: string; connections?: number; sessions?: number }
          expect(status.state).toBe('stopped')
          if (entry === 'hub-listen') expect(status.connections).toBe(0)
          if (entry === 'session-host') expect(status.sessions).toBe(0)
          // Drain ≠ revoke: the service is still published (revocation owns the next scenario).
          expect(handle.ctx.get(serviceNameOf[entry] as never)).toBeDefined()
        })
        completedUnits.add(unit(entry, 'explicit-stop'))
      }, 20_000)

      // 5. fiber dispose without an explicit stop
      it(unit(entry, 'fiber-dispose'), async () => {
        const unhandled: unknown[] = []
        const onUnhandled = (reason: unknown): void => {
          unhandled.push(reason)
        }
        process.on('unhandledRejection', onUnhandled)
        try {
          await withEntry(entry, async (handle) => {
            if (entry === 'hub-listen') handle.acceptTransport()
            if (entry === 'session-host') handle.openSession()
            await waitFor(() => meter.pending() > 0, `${entry}: timers are armed before dispose`)
            await handle.fiber.dispose()
            await waitFor(() => meter.pendingFor(HELLO_MS) === 0 && meter.pendingFor(BOOTSTRAP_MS) === 0, 'ordered effect cleared the entry timers')
            await delay(5)
          })
        } finally {
          process.off('unhandledRejection', onUnhandled)
        }
        expect(unhandled).toEqual([])
        completedUnits.add(unit(entry, 'fiber-dispose'))
      }, 20_000)

      // 6. service revoked
      it(unit(entry, 'service-revoked'), async () => {
        await withEntry(entry, async (handle) => {
          await handle.fiber.dispose()
          expect(handle.ctx.get(serviceNameOf[entry] as never), 'fiber dispose revokes the service').toBeUndefined()
          const requireFn = entry === 'hub-listen'
            ? () => requireHubReplication(handle.ctx)
            : entry === 'peer-dial'
              ? () => requirePeerReplication(handle.ctx)
              : () => requireHubSessionHost(handle.ctx)
          expect(requireFn).toThrow(/unavailable/)
          for (const name of otherEntryServices(entry)) {
            expect(handle.ctx.get(name as never), `${name} never appeared`).toBeUndefined()
          }
        })
        completedUnits.add(unit(entry, 'service-revoked'))
      }, 20_000)

      // 7. remount (+ double-mount negative control)
      it(unit(entry, 'remount'), async () => {
        const handle = await mountEntry(entry)
        try {
          await handle.fiber.dispose()
          const plugin = entry === 'hub-listen'
            ? createHubReplicationPlugin(
                { listen: { host: '127.0.0.1', port: 0 }, tokens: [], authorization: [] },
                { timeouts: { helloTimeoutMs: HELLO_MS, closeTimeoutMs: CLOSE_MS }, listen: { listen: async () => ({ port: 1, close: async () => undefined }) } } as never,
              )
            : entry === 'peer-dial'
              ? createPeerReplicationPlugin(
                  { expectedHubInstanceId: HUB_INSTANCE },
                  { timeouts: { helloTimeoutMs: HELLO_MS }, dial: () => createMemoryDuplexTransport().peer },
                )
              : createHubReplicationPlugin({ listen: false, timeouts: { bootstrapTimeoutMs: BOOTSTRAP_MS } })
          const second = handle.ctx.plugin(plugin)
          await second.await()
          expect((serviceOf(handle).status as { state: string }).state).toBe('ready')
          expect(handle.ctx.get(serviceNameOf[entry] as never)).toBeDefined()
          // The old handle is gone: the first plugin instance must not be the owner anymore.
          expect(handle.fiber).not.toBe(second)
          // Negative control (N-5): a second mount WITHOUT revoking the first must fail loudly.
          const duplicate = handle.ctx.plugin(plugin)
          await expect(duplicate.await()).rejects.toThrow(/registered|provided|already/i)
          await second.dispose()
          expect(handle.ctx.get(serviceNameOf[entry] as never)).toBeUndefined()
        } finally {
          await handle.disposeRoot()
        }
        completedUnits.add(unit(entry, 'remount'))
      }, 20_000)
    })
  }

  // ---------------------------------------------------------------- EDGE β minimal round

  it('L.edge-beta.minimal-round', async () => {
    const node = makeNode('hub')
    const fixture = await makeHubNamespace(node)
    const assembly = createRealTimerAssembly({ role: 'hub', instanceId: HUB_INSTANCE })
    const wire: Wire = makeWire()
    let sinkOpened = 0
    let sessionHandle: { close: () => Promise<void> } | undefined
    const shim = createShimHubForTesting({
      instanceId: HUB_INSTANCE,
      registry: node.registry,
      timer: assembly.timer,
      authorize: async () => ({
        ok: true,
        localOwner: HUB_OWNER,
        permissions: { read: true, submit: true },
      }),
      verifyToken: async (token: string) => (token === TEST_TOKEN ? { ok: true, instanceId: PEER_INSTANCE } : { ok: false }),
      timeouts: { bootstrapTimeoutMs: BOOTSTRAP_MS, closeTimeoutMs: CLOSE_MS },
    })
    try {
      const accepted = await shim.replication.accept(wire.hubEnd, { token: TEST_TOKEN })
      expect(accepted).toBeDefined()
      sinkOpened += 1
      wire.peerEnd.send(encodeMessage({
        kind: 'HELLO',
        peerInstanceId: PEER_INSTANCE,
        expectedHubInstanceId: HUB_INSTANCE,
        protocolVersions: [1],
        requiredCapabilities: 0,
        optionalCapabilities: 0,
        connectionNonce: new Uint8Array(16),
      }, { sequence: 1 }))
      await settleUntil(() => wire.hubToPeer.some((bytes) => decodeMessage(bytes).message.kind === 'HELLO_ACK'), 'HELLO_ACK')
      wire.peerEnd.send(encodeMessage({
        kind: 'OPEN_NAMESPACE',
        namespaceId: fixture.namespaceId,
        hasLocalReplica: false,
      }, { sequence: 2 }))
      await settleUntil(
        () => wire.hubToPeer.some((bytes) => decodeMessage(bytes).message.kind === 'OPEN_OK'),
        'OPEN_OK across the β seam',
      )
      // One namespace frame crosses the seam and is answered.
      wire.peerEnd.send(encodeMessage({ kind: 'CLOSE_NAMESPACE', namespaceId: fixture.namespaceId, reasonCode: 'USER_CLOSE' }, { sequence: 3 }))
      await settleUntil(
        () => wire.hubToPeer.some((bytes) => decodeMessage(bytes).message.kind === 'CLOSE_OK'),
        'CLOSE_OK across the β seam',
      )
      expect(sinkOpened).toBe(1)
      await shim.replication.close()
      await waitFor(() => meter.pending() === 0, 'β round leaves no armed timer behind')
    } finally {
      await sessionHandle?.close().catch(() => undefined)
      await assembly.dispose()
    }
    completedUnits.add('L.edge-beta.minimal-round')
  }, 30_000)

  // ---------------------------------------------------------------- ASYNC γ minimal round

  it('L.async-gamma.minimal-round', async () => {
    const node = makeNode('hub')
    const fixture = await makeHubNamespace(node)
    const assembly = createRealTimerAssembly({ role: 'hub', instanceId: HUB_INSTANCE })
    const wire: Wire = makeWire()
    const facade = makeAsyncReplicationFacade({
      registry: node.registry,
      authorize: async () => ({
        ok: true,
        localOwner: HUB_OWNER,
        permissions: { read: true, submit: true },
      }),
      verifyToken: async (token: string) => (token === TEST_TOKEN ? { ok: true, instanceId: PEER_INSTANCE } : { ok: false }),
      timer: assembly.timer,
      timeouts: { bootstrapTimeoutMs: BOOTSTRAP_MS, closeTimeoutMs: CLOSE_MS },
    })
    try {
      const accepted = await facade.host.accept(wire.hubEnd, { token: TEST_TOKEN })
      expect(accepted).toBeDefined()
      wire.peerEnd.send(encodeMessage({
        kind: 'HELLO',
        peerInstanceId: PEER_INSTANCE,
        expectedHubInstanceId: HUB_INSTANCE,
        protocolVersions: [1],
        requiredCapabilities: 0,
        optionalCapabilities: 0,
        connectionNonce: new Uint8Array(16),
      }, { sequence: 1 }))
      await pumpUntil(
        facade.host,
        () => wire.hubToPeer.some((bytes) => decodeMessage(bytes).message.kind === 'HELLO_ACK'),
        'HELLO_ACK',
      )
      wire.peerEnd.send(encodeMessage({
        kind: 'OPEN_NAMESPACE',
        namespaceId: fixture.namespaceId,
        hasLocalReplica: false,
      }, { sequence: 2 }))
      await pumpUntil(
        facade.host,
        () => wire.hubToPeer.some((bytes) => decodeMessage(bytes).message.kind === 'OPEN_OK'),
        'OPEN_OK across the γ seam',
      )
      // The γ seam vocabulary: session→edge `frame{tag,bytes,lane}` plus the
      // edge→session `receipt{tag,sequence}` (ADR 0032 A4).
      const frames = facade.host.probes.outbound
      expect(frames.length, 'γ outbound frames crossed the seam').toBeGreaterThan(0)
      expect(facade.host.probes.receipts.length, 'γ receipts were registered').toBeGreaterThan(0)
      expect(facade.host.probes.receipts.every((receipt) => receipt.sequence > 0)).toBe(true)
      wire.peerEnd.send(encodeMessage({ kind: 'CLOSE_NAMESPACE', namespaceId: fixture.namespaceId, reasonCode: 'USER_CLOSE' }, { sequence: 3 }))
      await pumpUntil(
        facade.host,
        () => wire.hubToPeer.some((bytes) => decodeMessage(bytes).message.kind === 'CLOSE_OK'),
        'CLOSE_OK across the γ seam',
      )
      await facade.replication.close()
      await waitFor(() => meter.pending() === 0, 'γ round leaves no armed timer behind')
    } finally {
      await assembly.dispose()
    }
    completedUnits.add('L.async-gamma.minimal-round')
  }, 30_000)

  // ---------------------------------------------------------------- completeness self-check

  it('coverage', () => {
    const declared = new Set(LIFECYCLE_UNITS)
    expect(LIFECYCLE_UNITS.length, 'the pinned enumeration is exactly 23 units').toBe(23)
    const missing = [...declared].filter((name) => !completedUnits.has(name))
    expect(missing, 'every pinned unit must have run and passed in this file').toEqual([])
    expect(completedUnits.size).toBe(23)
    // Fail-closed direction (T-1a-3) is enforced by the runner; here we prove the
    // enumeration has no duplicate and no `L.` name outside the pinned set.
    expect(new Set(LIFECYCLE_UNITS).size).toBe(23)
    expect(createNamespaceRegistryForTesting).toBeTypeOf('function')
  })
})
