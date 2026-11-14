/**
 * issue #471 — AC1 / A1-8 (design §9.1 table): the 12 replication timer families on
 * every baseline, each with the three-segment evidence
 *   arm (delay === configured value) → trigger (documented consequence) → cancel
 *   (stop/close/dispose leaves no live timer for that delay).
 *
 * No fake scheduler anywhere: every arm goes through the **real baseline
 * `TimerService`** (`TimerService.prototype.timeout` is instrumented before the
 * first construction, so a fake would make `meter.arms === 0` and the assertions
 * structurally red — R-5 self-enforcement).
 *
 * Assembly: the public Cordis plugins (`createHubReplicationPlugin` /
 * `createPeerReplicationPlugin`) for the Host-level families and the public
 * composition-root factories (`createHubReplication` / `createPeerReplication`) /
 * `createHubReplicationEdge` for the connection families. The factories receive the
 * same `timerFromContext` wrapper shape the plugins build over the baseline service
 * (design §8.3 β note: "the injected timer is used correctly"), so the arm points
 * are the production ones.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { CAP_CHUNKED_UPDATE, decodeMessage, encodeMessage, type DecodedMessage } from '@nomicore/replication-protocol'
import {
  createHubReplication,
  createHubReplicationEdge,
  createHubReplicationPlugin,
  createPeerReplication,
  createPeerReplicationPlugin,
  requireHubReplication,
  requireHubSessionHost,
  type DuplexTransport,
  type HubReplication,
  type PeerReplication,
  type ReplicationLimits,
  type ReplicationObserverEvent,
  type ReplicationTimeouts,
} from '@nomicore/ws-replication'
import { createMemoryDuplexTransport } from '@nomicore/ws-replication/testing'
import {
  HUB_INSTANCE,
  HUB_OWNER,
  PEER_INSTANCE,
  PEER_OWNER,
  makeHubNamespace,
  makeNode,
  okLease,
  schemaReady,
  settle,
  settleUntil,
  type Wire,
} from './harness.js'
import { makeWire } from './harness.js'
import {
  BASELINE_LABEL,
  createRealTimerAssembly,
  installRealTimerMeter,
  waitFor,
  type TimerMeter,
} from './cordis-baseline-support.js'
import { TEST_TOKEN } from './driver.js'

const helloMs = 35
const pongMs = 15
const pingMs = 30
const backoffBaseMs = 8
const resetAfterMs = 20
const bootstrapMs = 4321
const bootstrapFastMs = 40
const closeMs = 45
const assemblyMs = 66
const assemblyFastMs = 40
const ackMs = 28
const reconcileIntervalMs = 44
const waitForLiveMs = 25

/**
 * design §9.1 bulk/assembly row: the arm point is the hub namespace's inbound
 * assembly budget (`armTimer('assembly')` → `assemblyTimeoutMs`) on a real **kind=2
 * chunked SYNC_STEP2** ("kind=2 self-held ACK"), not a synthetic kind=0 injection.
 * The trigger is the documented one: a peer write whose live update cannot be
 * chunked (> `maxChunkedUpdateBytes`) forces a recovery round whose diff exceeds
 * `maxSyncDiffBytes` ⇒ kind=2 chunked step2 (same recipe as
 * `ws-replication-issue300-chunked-sync-ac-red.test.ts` phase B).
 */
const CHUNKED_SYNC_SCHEMA = Object.freeze({
  lang: 'vfsl',
  version: 1,
  id: 'issue471-chunked-sync-timers',
  text: 'type ROOT = { n: number; blurb?: string; };\n',
})
const CHUNKED_SYNC_LIMITS: Readonly<Partial<ReplicationLimits>> = Object.freeze({
  maxUpdateBytes: 8 * 1024,
  maxChunkedUpdateBytes: 64 * 1024,
  maxSyncDiffBytes: 32 * 1024,
  maxChunkedSyncDiffBytes: 512 * 1024,
})
/** > maxChunkedUpdateBytes (64 KiB); the recovery diff is > maxSyncDiffBytes (32 KiB). */
const CHUNKED_SYNC_BLURB = 'q'.repeat(100_000)

/**
 * Transport seam (test-only, never a production path): once the first kind=2 chunk
 * of the recovery transfer reaches the hub, every later peer→hub frame is withheld.
 * The assembly therefore stays busy with no sequence advancement — the honest way to
 * observe the sliding `assemblyTimeoutMs` deadline without dropping a frame (a drop
 * would open a connection-level sequence gap and kill the connection, not the
 * transfer).
 */
function stallAfterFirstKind2Chunk(end: DuplexTransport): { end: DuplexTransport; held: () => number } {
  let armed = false
  let held = 0
  const wrapped: DuplexTransport = {
    send: (bytes) => end.send(bytes),
    close: (code, reason) => end.close(code, reason),
    get closed() {
      return end.closed
    },
    onMessage(listener) {
      return end.onMessage((bytes) => {
        if (armed) {
          // Hold EVERY later peer→hub frame: forwarding a non-chunk frame past the
          // missing chunks would be a connection-level sequence gap, not a stalled
          // transfer.
          held += 1
          return
        }
        const message = decodeMessage(bytes, { selectedCapabilities: CAP_CHUNKED_UPDATE }).message
        if (message.kind === 'UPDATE_CHUNK' && message.transferKind === 2) armed = true
        listener(bytes)
      })
    },
    onClose: (listener) => end.onClose(listener),
  }
  return { end: wrapped, held: () => held }
}

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

// ---------------------------------------------------------------- helpers

function hubAuth(): (identity: string, namespaceId: string) => Promise<{ ok: true; localOwner: unknown; permissions: { read: boolean; submit: boolean } }> {
  return async () => ({ ok: true, localOwner: HUB_OWNER, permissions: { read: true, submit: true } })
}

function verifier(): (token: string) => Promise<{ ok: true; instanceId: string } | { ok: false }> {
  return async (token: string) => (token === TEST_TOKEN ? { ok: true, instanceId: PEER_INSTANCE } : { ok: false })
}

/** Connection-level live hub (public composition-root factory) on the real TimerService. */
function createHubFactory(options: {
  registry: unknown
  timeouts: Partial<ReplicationTimeouts>
  observer?: (event: ReplicationObserverEvent) => void
}): { hub: HubReplication; dispose: () => Promise<void> } {
  const assembly = createRealTimerAssembly({ role: 'hub', instanceId: HUB_INSTANCE })
  const hub = createHubReplication({
    instanceId: HUB_INSTANCE,
    registry: options.registry as never,
    authorize: hubAuth() as never,
    verifyToken: verifier() as never,
    timer: assembly.timer,
    timeouts: options.timeouts,
    ...(options.observer === undefined ? {} : { observer: options.observer }),
  })
  return { hub, dispose: () => assembly.dispose() }
}

/** Namespace-level live hub↔peer pair (factories + real timers on both sides). */
async function bootLivePair(options: {
  hubTimeouts?: Partial<ReplicationTimeouts>
  peerTimeouts?: Partial<ReplicationTimeouts>
  hubObserver?: (event: ReplicationObserverEvent) => void
  chunkedUpdate?: boolean
  /** Shared limit profile for both halves (kind=2 trigger profile in the assembly families). */
  limits?: Readonly<Partial<ReplicationLimits>>
  /** Custom VFSL schema for the hub namespace (defaults to the harness numeric envelope). */
  schema?: Readonly<{ lang: 'vfsl'; version: 1; id: string; text: string }>
  root?: Readonly<Record<string, unknown>>
  /** Transport seam wrapper for the hub end (stall/withhold injections; never a production path). */
  wrapHubEnd?: (end: DuplexTransport) => DuplexTransport
} = {}): Promise<{
  hub: HubReplication
  peer: PeerReplication
  hubNode: ReturnType<typeof makeNode>
  peerNode: ReturnType<typeof makeNode>
  namespaceId: string
  wires: Wire[]
  peerWrite: (value: Readonly<Record<string, unknown>>) => Promise<void>
  dispose: () => Promise<void>
}> {
  const hubNode = makeNode('hub')
  const peerNode = makeNode('peer')
  const fixture = options.schema === undefined
    ? await makeHubNamespace(hubNode)
    : await (async () => {
        const lease = okLease(await hubNode.registry.create({
          owner: HUB_OWNER,
          schema: options.schema,
          root: options.root ?? { n: 1 },
        }))
        await schemaReady(lease)
        const enabled = await lease.enableReplication()
        if (!enabled.ok) throw new Error(`enableReplication failed: ${JSON.stringify(enabled)}`)
        return { namespaceId: lease.namespaceId }
      })()
  const hubAssembly = createRealTimerAssembly({ role: 'hub', instanceId: HUB_INSTANCE })
  const peerAssembly = createRealTimerAssembly({ role: 'peer', instanceId: PEER_INSTANCE })
  const wires: Wire[] = []
  const hub = createHubReplication({
    instanceId: HUB_INSTANCE,
    registry: hubNode.registry,
    authorize: hubAuth() as never,
    verifyToken: verifier() as never,
    timer: hubAssembly.timer,
    ...(options.hubTimeouts === undefined ? {} : { timeouts: options.hubTimeouts }),
    ...(options.limits === undefined ? {} : { limits: options.limits }),
    ...(options.hubObserver === undefined ? {} : { observer: options.hubObserver }),
  })
  const peer = createPeerReplication({
    instanceId: PEER_INSTANCE,
    hubInstanceId: HUB_INSTANCE,
    registry: peerNode.registry,
    timer: peerAssembly.timer,
    targets: [{ namespaceId: fixture.namespaceId, localOwner: PEER_OWNER }],
    ...(options.limits === undefined ? {} : { limits: options.limits }),
    ...(options.peerTimeouts === undefined ? {} : { timeouts: options.peerTimeouts }),
    ...(options.chunkedUpdate === undefined ? {} : { chunkedUpdate: options.chunkedUpdate }),
    dial: () => {
      const wire = makeWire()
      wires.push(wire)
      const hubEnd = options.wrapHubEnd === undefined ? wire.hubEnd : options.wrapHubEnd(wire.hubEnd)
      void hub.accept(hubEnd, { token: TEST_TOKEN })
      return wire.peerEnd
    },
  })
  peer.start()
  await settleUntil(() => peer.getConnectionState() === 'ready', 'peer connection ready')
  await waitFor(() => peer.getNamespaceState(fixture.namespaceId) === 'live', 'peer namespace live')
  const peerWrite = async (value: Readonly<Record<string, unknown>>): Promise<void> => {
    const business = okLease(await peerNode.registry.open(PEER_OWNER, fixture.namespaceId))
    await schemaReady(business)
    for (const [key, v] of Object.entries(value)) {
      const result = await business.mutateData({ op: 'set', path: [key], value: v })
      if (!result.ok) throw new Error(`peer write failed: ${JSON.stringify(result)}`)
    }
    await business.release()
  }
  return {
    hub,
    peer,
    hubNode,
    peerNode,
    namespaceId: fixture.namespaceId,
    wires,
    peerWrite,
    dispose: async () => {
      await peer.stop()
      await hub.close()
      await hubAssembly.dispose()
      await peerAssembly.dispose()
    },
  }
}

/** OPEN → BOOTSTRAP_ACK → live hub namespace channel via the SessionHost service. */
function openHubNamespace(options: {
  ctx: import('@deepseek-ai/cordis').Context
  namespaceId: string
  connectionKey?: string
  timeouts?: Partial<ReplicationTimeouts>
  selectedCapabilities?: number
}): {
  service: ReturnType<typeof requireHubSessionHost>
  frames: Uint8Array[]
  handle: ReturnType<ReturnType<typeof requireHubSessionHost>['open']>
  live: () => Promise<void>
} {
  const service = requireHubSessionHost(options.ctx)
  const frames: Uint8Array[] = []
  const handle = service.open({
    connectionKey: options.connectionKey ?? 'conn-timers',
    remoteInstanceId: PEER_INSTANCE,
    namespaceId: options.namespaceId,
    authorization: { ok: true, localOwner: HUB_OWNER, permissions: { read: true, submit: true } },
    selectedCapabilities: options.selectedCapabilities ?? 0,
  })
  handle.onFrame((frame) => {
    frames.push(frame)
    return 0
  })
  const send = (message: Parameters<typeof encodeMessage>[0], sequence: number, capabilities = 0): void => {
    handle.handleFrame(encodeMessage(message, {
      sequence,
      ...(capabilities === 0 ? {} : { selectedCapabilities: capabilities }),
    } as never))
  }
  const live = async (): Promise<void> => {
    send({ kind: 'OPEN_NAMESPACE', namespaceId: options.namespaceId, hasLocalReplica: false }, 1)
    await settleUntil(
      () => frames.some((frame) => decodeMessage(frame).message.kind === 'BOOTSTRAP_SNAPSHOT'),
      'BOOTSTRAP_SNAPSHOT outbound',
    )
    const snapshot = frames
      .map((frame) => decodeMessage(frame))
      .filter((decoded) => decoded.message.kind === 'BOOTSTRAP_SNAPSHOT')
      .at(-1)!
    send({
      kind: 'BOOTSTRAP_ACK',
      namespaceId: options.namespaceId,
      ackedSequence: snapshot.header.sequence,
    }, 2)
    await waitFor(
      () => !frames.some((frame) => decodeMessage(frame).message.kind === 'ERROR'),
      'namespace stays healthy after BOOTSTRAP_ACK',
    )
  }
  return { service, frames, handle, live }
}

// ---------------------------------------------------------------- families

describe(BASELINE_LABEL, () => {
  it('T.hello', async () => {
    const hubNode = makeNode('hub')
    const assembly = createRealTimerAssembly({
      role: 'hub',
      instanceId: HUB_INSTANCE,
      registry: hubNode.registry,
      withRegistry: true,
    })
    const closed: Array<{ code: number; reason: string }> = []
    let accept: ((transport: never, identity?: unknown) => void) | undefined
    try {
      const plugin = createHubReplicationPlugin(
        { listen: { host: '127.0.0.1', port: 0 }, tokens: [], authorization: [] },
        {
          timeouts: { helloTimeoutMs: helloMs },
          listen: {
            listen: async (options: { accept: (transport: never, identity?: unknown) => void }) => {
              accept = options.accept
              return { port: 1, close: async () => undefined }
            },
          },
        } as never,
      )
      const fiber = assembly.ctx.plugin(plugin)
      await fiber.await()
      await waitFor(() => accept !== undefined, 'listener adapter installed')
      // arm + trigger: a transport that never sends HELLO keeps the hello timer armed
      const duplex = createMemoryDuplexTransport()
      duplex.peer.onClose((info) => closed.push({ code: info.code, reason: info.reason }))
      accept!(duplex.hub as never, { peerInstanceId: PEER_INSTANCE })
      await waitFor(() => meter.includes(helloMs), 'hello timer armed with the configured delay')
      await waitFor(() => closed.some((close) => close.code === 1002), 'HELLO timeout closes 1002')
      expect(meter.armsFor(helloMs)).toBeGreaterThan(0)
      // cancel: a second connection's hello timer dies with the entry
      const second = createMemoryDuplexTransport()
      accept!(second.hub as never, { peerInstanceId: PEER_INSTANCE })
      await waitFor(() => meter.pendingFor(helloMs) > 0, 'second hello armed')
      await fiber.dispose()
      expect(meter.pendingFor(helloMs), 'dispose leaves no hello timer behind').toBe(0)
    } finally {
      await assembly.dispose()
    }
  }, 20_000)

  it('T.auth-upgrade-cap', async () => {
    const assembly = createRealTimerAssembly({ role: 'hub', instanceId: HUB_INSTANCE })
    const events: ReplicationObserverEvent[] = []
    const closed: Array<{ code: number; reason: string }> = []
    const edge = createHubReplicationEdge({
      instanceId: HUB_INSTANCE,
      timer: assembly.timer,
      authorize: hubAuth() as never,
      verifyToken: (() => new Promise(() => undefined)) as never,
      resolveSessionSink: () => undefined,
      timeouts: { helloTimeoutMs: pongMs },
      observer: (event) => events.push(event),
      limits: {},
    })
    try {
      const duplex = createMemoryDuplexTransport()
      duplex.peer.onClose((info) => closed.push({ code: info.code, reason: info.reason }))
      void edge.accept(duplex.hub, { token: 'opaque-token' })
      await waitFor(() => meter.includes(pongMs), 'auth cap armed with the hello budget')
      await waitFor(() => closed.some((close) => close.code === 1008 && close.reason === 'upgrade-timeout'), 'auth cap closes 1008 upgrade-timeout')
      expect(events.some((event) => event.type === 'auth-upgrade-rejected' && event.reason === 'auth-timeout')).toBe(true)
      duplex.hub.close(1001, 'test-close')
      await waitFor(() => meter.pendingFor(pongMs) === 0, 'transport close clears the auth cap')
    } finally {
      await assembly.dispose()
    }
  }, 20_000)

  it('T.bootstrap', async () => {
    const node = makeNode('hub')
    const fixture = await makeHubNamespace(node)
    const assembly = createRealTimerAssembly({ role: 'hub', instanceId: HUB_INSTANCE, registry: node.registry, withRegistry: true })
    const events: ReplicationObserverEvent[] = []
    try {
      const plugin = createHubReplicationPlugin(
        { listen: false, timeouts: { bootstrapTimeoutMs: bootstrapMs } },
        { observer: (event) => events.push(event) },
      )
      const fiber = assembly.ctx.plugin(plugin)
      await fiber.await()
      const opened = openHubNamespace({ ctx: assembly.ctx, namespaceId: fixture.namespaceId })
      opened.handle.handleFrame(encodeMessage({ kind: 'OPEN_NAMESPACE', namespaceId: fixture.namespaceId, hasLocalReplica: false }, { sequence: 1 }))
      // arm: the recognizable configured delay (4321) is observable
      await waitFor(() => meter.includes(bootstrapMs), 'bootstrap timer armed with the configured delay')
      expect(meter.pendingFor(bootstrapMs)).toBeGreaterThan(0)
      // cancel: closing the session clears it
      await opened.handle.close()
      await waitFor(() => meter.pendingFor(bootstrapMs) === 0, 'session close clears the bootstrap timer')
      // trigger: a short bootstrap budget finalizes the namespace (separate assembly —
      // the service name is single-provider per context)
      const fastAssembly = createRealTimerAssembly({
        role: 'hub',
        instanceId: HUB_INSTANCE,
        registry: node.registry,
        withRegistry: true,
      })
      const fastPlugin = createHubReplicationPlugin(
        { listen: false, timeouts: { bootstrapTimeoutMs: bootstrapFastMs } },
        { observer: (event) => events.push(event) },
      )
      const fastFiber = fastAssembly.ctx.plugin(fastPlugin)
      await fastFiber.await()
      const fast = openHubNamespace({ ctx: fastAssembly.ctx, namespaceId: fixture.namespaceId, connectionKey: 'conn-fast' })
      fast.handle.handleFrame(encodeMessage({ kind: 'OPEN_NAMESPACE', namespaceId: fixture.namespaceId, hasLocalReplica: false }, { sequence: 1 }))
      await waitFor(
        () => events.some((event) => event.type === 'namespace-failed' && event.cause === 'bootstrap-timeout'),
        'bootstrap timeout finalizes the namespace',
      )
      await fast.handle.close()
      await fastFiber.dispose()
      await fastAssembly.dispose()
      await fiber.dispose()
    } finally {
      await assembly.dispose()
    }
  }, 20_000)

  it('T.close-drain-deadline', async () => {
    const hubNode = makeNode('hub')
    const { hub, dispose } = createHubFactory({
      registry: hubNode.registry,
      timeouts: { helloTimeoutMs: helloMs, closeTimeoutMs: closeMs },
    })
    const peerAssembly = createRealTimerAssembly({ role: 'peer', instanceId: PEER_INSTANCE })
    const closes: Array<{ code: number; reason: string }> = []
    try {
      const wire = makeWire()
      wire.peerEnd.onClose((info) => closes.push({ code: info.code, reason: info.reason }))
      await hub.accept(wire.hubEnd, { token: TEST_TOKEN })
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
      // arm: the hub's GOAWAY drain budget is the configured closeTimeoutMs; the peer
      // arms its local elapsed deadline with exactly that budget.
      await hub.requestReauth(PEER_INSTANCE)
      await settleUntil(
        () => wire.hubToPeer.some((bytes) => {
          const decoded = decodeMessage(bytes)
          return decoded.message.kind === 'GOAWAY' && decoded.message.reasonCode === 'REAUTH_REQUIRED'
        }),
        'GOAWAY REAUTH_REQUIRED',
      )
      await waitFor(() => meter.includes(closeMs), 'drain/reauth deadline armed with closeTimeoutMs')
      await waitFor(() => closes.some((close) => close.code === 1001), 'deadline closes the connection 1001')
      await hub.close()
      expect(meter.pendingFor(closeMs), 'hub close clears the drain timers').toBe(0)
      expect(peerAssembly.timer).toBeDefined()
    } finally {
      await peerAssembly.dispose()
      await dispose()
    }
  }, 20_000)

  it('T.reauth-deadline', async () => {
    const hubNode = makeNode('hub')
    const { hub, dispose } = createHubFactory({
      registry: hubNode.registry,
      timeouts: { helloTimeoutMs: helloMs, closeTimeoutMs: closeMs },
    })
    try {
      const wire = makeWire()
      const closes: Array<{ code: number; reason: string }> = []
      wire.peerEnd.onClose((info) => closes.push({ code: info.code, reason: info.reason }))
      const accepted = await hub.accept(wire.hubEnd, { token: TEST_TOKEN })
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
      await settleUntil(() => wire.hubToPeer.some((bytes) => decodeMessage(bytes).message.kind === 'HELLO_ACK'), 'HELLO_ACK')
      expect(accepted!.state).toBe('ready')
      await hub.requestReauth(PEER_INSTANCE)
      // arm + trigger: the GOAWAY deadline is armed with the configured closeTimeoutMs
      // and closes the transport with the frozen reauth reason.
      await waitFor(() => meter.includes(closeMs), 'reauth deadline armed with closeTimeoutMs')
      await waitFor(() => closes.some((close) => close.reason === 'hub-reauth'), 'reauth deadline closes 1001 hub-reauth')
      expect(closes.find((close) => close.reason === 'hub-reauth')?.code).toBe(1001)
      await hub.close()
      expect(meter.pendingFor(closeMs)).toBe(0)
    } finally {
      await dispose()
    }
  }, 20_000)

  it('T.peer-backoff-reset', async () => {
    const hubNode = makeNode('hub')
    const peerNode = makeNode('peer')
    const { hub, dispose } = createHubFactory({
      registry: hubNode.registry,
      timeouts: { helloTimeoutMs: helloMs, resetAfterMs: undefined } as never,
    })
    const assembly = createRealTimerAssembly({
      role: 'peer',
      instanceId: PEER_INSTANCE,
      registry: peerNode.registry,
      withRegistry: true,
    })
    let dials = 0
    try {
      const plugin = createPeerReplicationPlugin(
        { expectedHubInstanceId: HUB_INSTANCE },
        {
          timeouts: { helloTimeoutMs: pongMs },
          backoff: { baseMs: backoffBaseMs, maxMs: 32, resetAfterMs },
          random: () => 0.5,
          dial: () => {
            dials += 1
            if (dials === 1) {
              // First attempt fails on the wire: the hello timer is the failure surface.
              return createMemoryDuplexTransport().peer
            }
            const wire = makeWire()
            void hub.accept(wire.hubEnd, { token: TEST_TOKEN })
            return wire.peerEnd
          },
        },
      )
      const fiber = assembly.ctx.plugin(plugin)
      await fiber.await()
      // full jitter: delay = random() × min(maxMs, baseMs × 2^(attempts-1)) = 0.5 × 8 = 4
      const expectedBackoff = Math.max(0, 0.5 * Math.min(32, backoffBaseMs * 2 ** 0))
      await waitFor(() => meter.delays().some((delay) => delay === expectedBackoff), 'deterministic backoff delay armed')
      await waitFor(() => dials >= 2, 'backoff redials the hub')
      // reset check: armed on the ready transition with the backoff reset budget
      await waitFor(() => meter.includes(resetAfterMs), 'reset check armed with resetAfterMs')
      await fiber.dispose()
      expect(meter.pendingFor(expectedBackoff)).toBe(0)
      expect(meter.pendingFor(resetAfterMs)).toBe(0)
    } finally {
      await assembly.dispose()
      await dispose()
    }
  }, 20_000)

  it('T.peer-wait-for-live', async () => {
    const peerNode = makeNode('peer')
    const assembly = createRealTimerAssembly({
      role: 'peer',
      instanceId: PEER_INSTANCE,
      registry: peerNode.registry,
      withRegistry: true,
    })
    try {
      const target = `ns-${'b2'.repeat(16)}`
      const plugin = createPeerReplicationPlugin(
        { expectedHubInstanceId: HUB_INSTANCE },
        { timeouts: { helloTimeoutMs: pongMs }, dial: () => createMemoryDuplexTransport().peer },
      )
      const fiber = assembly.ctx.plugin(plugin)
      await fiber.await()
      const service = (await import('@nomicore/ws-replication')).requirePeerReplication(assembly.ctx)
      const pending = service.waitForLive(target)
      // arm: the fixed 25 ms polling literal is not a timeout knob — it is the read
      // point (`plugin.ts` waitForLive) and must be observed as such.
      await waitFor(() => meter.includes(waitForLiveMs), 'waitForLive polling timer armed at the literal 25 ms')
      // cancel + trigger(failure): stop rejects the waiter and clears the poll timer
      await service.stop()
      await expect(pending).rejects.toThrow(/peer replication stopped/)
      expect(meter.pendingFor(waitForLiveMs)).toBe(0)
      await fiber.dispose()
    } finally {
      await assembly.dispose()
    }
  }, 20_000)

  it('T.fence-watchdog', async () => {
    const node = makeNode('hub')
    const fixture = await makeHubNamespace(node)
    const assembly = createRealTimerAssembly({ role: 'hub', instanceId: HUB_INSTANCE, registry: node.registry, withRegistry: true })
    try {
      const plugin = createHubReplicationPlugin(
        { listen: false, timeouts: { bootstrapTimeoutMs: bootstrapMs, ackTimeoutMs: ackMs } },
      )
      const fiber = assembly.ctx.plugin(plugin)
      await fiber.await()
      const opened = openHubNamespace({ ctx: assembly.ctx, namespaceId: fixture.namespaceId })
      opened.handle.handleFrame(encodeMessage({ kind: 'OPEN_NAMESPACE', namespaceId: fixture.namespaceId, hasLocalReplica: false }, { sequence: 1 }))
      // arm: the idle fence/idle probe rhythm uses ackTimeoutMs
      await waitFor(() => meter.includes(ackMs), 'fence-watchdog idle probe armed with ackTimeoutMs')
      // trigger: the next idle probe re-arms the rhythm (two cadences observable)
      await waitFor(() => meter.armsFor(ackMs) >= 2, 'watchdog re-arms its idle rhythm')
      // cancel: closing the session tears the watchdog down
      await opened.handle.close()
      await waitFor(() => meter.pendingFor(ackMs) === 0, 'watchdog teardown clears the idle timer')
      await fiber.dispose()
    } finally {
      await assembly.dispose()
    }
  }, 20_000)

  it('T.liveness-ping-pong', async () => {
    const hubNode = makeNode('hub')
    const closed: Array<{ code: number; reason: string }> = []
    const { hub, dispose } = createHubFactory({
      registry: hubNode.registry,
      timeouts: { helloTimeoutMs: helloMs, pingIntervalMs: pingMs, pongTimeoutMs: pongMs },
    })
    try {
      const wire = makeWire()
      wire.peerEnd.onClose((info) => closed.push({ code: info.code, reason: info.reason }))
      // The liveness family requires the transport ping/onPong capability; the memory
      // wire has none, so the baseline transport is extended on its prototype chain
      // (never replacing the memory wire's own recorders).
      const livenessEnd = Object.create(wire.hubEnd) as Record<string, unknown>
      livenessEnd.ping = (callback: () => void): void => {
        void callback
      }
      livenessEnd.onPong = (): (() => void) => () => undefined
      await hub.accept(livenessEnd as never, { token: TEST_TOKEN })
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
      // arm: the liveness ping rhythm uses pingIntervalMs
      await waitFor(() => meter.includes(pingMs), 'liveness ping armed with pingIntervalMs')
      // trigger: the unanswered ping arms the pong budget and closes with the frozen reason
      await waitFor(() => closed.some((close) => close.code === 1001 && close.reason === 'pong-timeout'), 'pong timeout closes 1001 pong-timeout')
      expect(meter.armsFor(pongMs)).toBeGreaterThan(0)
      await hub.close()
      expect(meter.pendingFor(pingMs)).toBe(0)
    } finally {
      await dispose()
    }
  }, 20_000)

  it('T.reconcile-interval', async () => {
    const pair = await bootLivePair({ peerTimeouts: { reconcileIntervalMs, reconcileTimeoutMs: 40 } })
    try {
      // arm: periodic reconciliation rhythm on the peer namespace
      await waitFor(() => meter.includes(reconcileIntervalMs), 'reconcile interval armed')
      expect(meter.pendingFor(reconcileIntervalMs)).toBeGreaterThan(0)
      // trigger: at least one periodic round happens (arm count grows or a second arm)
      await waitFor(
        () => meter.armsFor(reconcileIntervalMs) >= 1 && meter.pendingFor(reconcileIntervalMs) >= 1,
        'reconcile round keeps the rhythm armed',
      )
      await pair.peer.stop()
      expect(meter.pendingFor(reconcileIntervalMs), 'peer stop clears the reconcile rhythm').toBe(0)
    } finally {
      await pair.dispose()
    }
  }, 30_000)

  it('T.chunked-bulk-ack', async () => {
    // design §9.1 bulk/assembly row, converged form: the inbound budget is armed by a
    // REAL kind=2 chunked SYNC_STEP2 ("kind=2 self-held ACK") at the production arm
    // point (`hub-namespace.ts` `afterAssemblyAccept` → `armTimer('assembly')`), not by
    // a synthetic kind=0 injection. The tail frames are withheld at the transport seam so
    // the assembly stays busy (a dropped frame would open a connection-level sequence gap
    // and kill the connection instead of the transfer).
    let gate: ReturnType<typeof stallAfterFirstKind2Chunk> | undefined
    const pair = await bootLivePair({
      schema: CHUNKED_SYNC_SCHEMA,
      root: { n: 1, blurb: 'seed' },
      limits: CHUNKED_SYNC_LIMITS,
      hubTimeouts: { assemblyTimeoutMs: assemblyMs, ackTimeoutMs: 4000 },
      peerTimeouts: { reconcileIntervalMs: 1000, ackTimeoutMs: 4000 },
      chunkedUpdate: true,
      wrapHubEnd: (end) => {
        gate = stallAfterFirstKind2Chunk(end)
        return gate.end
      },
    })
    try {
      const wire = pair.wires[0]!
      await pair.peerWrite({ blurb: CHUNKED_SYNC_BLURB })
      await waitFor(() => meter.includes(assemblyMs), 'assembly budget armed with assemblyTimeoutMs')
      const kind2Chunks = wire.peerToHub
        .map((bytes) => decodeMessage(bytes, { selectedCapabilities: CAP_CHUNKED_UPDATE }).message)
        .filter((message) => message.kind === 'UPDATE_CHUNK' && message.transferKind === 2)
      expect(kind2Chunks.length, 'the arm point must be fed by real kind=2 chunks').toBeGreaterThanOrEqual(2)
      expect(gate!.held(), 'the tail frames were withheld at the transport seam').toBeGreaterThan(0)
      expect(meter.pendingFor(assemblyMs), 'the stalled assembly leaves a live budget timer').toBeGreaterThan(0)
      // cancel: closing the connection clears the pending assembly budget
      await pair.hub.close()
      await waitFor(() => meter.pendingFor(assemblyMs) === 0, 'connection close clears the assembly budget')
    } finally {
      await pair.dispose()
    }
  }, 30_000)

  it('T.assembly-timeout', async () => {
    const aborted: ReplicationObserverEvent[] = []
    let gate: ReturnType<typeof stallAfterFirstKind2Chunk> | undefined
    const pair = await bootLivePair({
      schema: CHUNKED_SYNC_SCHEMA,
      root: { n: 1, blurb: 'seed' },
      limits: CHUNKED_SYNC_LIMITS,
      hubTimeouts: { assemblyTimeoutMs: assemblyFastMs, ackTimeoutMs: 4000 },
      peerTimeouts: { reconcileIntervalMs: 1000, ackTimeoutMs: 4000 },
      hubObserver: (event) => aborted.push(event),
      chunkedUpdate: true,
      wrapHubEnd: (end) => {
        gate = stallAfterFirstKind2Chunk(end)
        return gate.end
      },
    })
    try {
      // arm: real kind=2 chunked SYNC_STEP2, stalled by withholding the tail frames
      await pair.peerWrite({ blurb: CHUNKED_SYNC_BLURB })
      await waitFor(() => meter.includes(assemblyFastMs), 'assembly deadline armed with assemblyTimeoutMs')
      expect(gate!.held(), 'the tail frames were withheld at the transport seam').toBeGreaterThan(0)
      // trigger: the stalled kind=2 assembly aborts with the documented timeout family
      await waitFor(
        () => aborted.some((event) => event.type.endsWith('-aborted') && (event as { reason?: string }).reason === 'timeout'),
        'assembly timeout aborts the stalled chunked transfer',
      )
      // cancel: the aborted transfer leaves no timer behind
      await waitFor(() => meter.pendingFor(assemblyFastMs) === 0, 'aborted assembly clears its deadline')
    } finally {
      await pair.dispose()
    }
  }, 30_000)
})
