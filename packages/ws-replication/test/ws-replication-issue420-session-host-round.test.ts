/**
 * issue #420 AC2/AC5 —— 内存管道对驱动的完整协议回合 + session 侧零重检入站 sequence
 * （SA6 §12.2 A1–A12 / §12.5 C5a–C5d；设计 §7 D2/D3/D7、§12）。
 *
 * 装配（无 socket、无跨线程面）：真 peer ↔ 内存双端 wire ↔ 真 edge + 宿主桥 + 公共
 * `createHubSessionHost` + 真 Registry/Runtime（夹具 `issue420-shim-hub.ts`）。
 *
 * 纪律：断言全部为运行时行为/wire 原字节；零 skip/only/todo；零软化。
 * W1/RA4' 修正读法：出站（`onFrame`）缝帧恒占位 0；入站（`handleFrame`）非 OPEN 帧携带
 * wire 序（OPEN 中继序 = 桥合成 0，协议无消费者——SA6 E3 边界登记）。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encodeStateAsUpdate } from 'yjs';
import {
  decodeMessage,
  encodeMessage,
  type DecodedMessage,
} from '@nomicore/replication-protocol';
import {
  createHubSessionHost,
  type HubReplication,
  type HubReplicationOptions,
  type ReplicationObserverEvent,
} from '@nomicore/ws-replication';
import { HubNamespaceChannel } from '../src/hub-namespace.js';
import { boot, collectUnhandledRejections, advanceMs } from './driver.js';
import {
  HUB_INSTANCE,
  HUB_OWNER,
  PEER_INSTANCE,
  PEER_OWNER,
  settle,
  settleUntil,
} from './harness.js';
import {
  createShimHubForTesting,
  type ShimHub,
  type ShimHubOptions,
} from './issue420-shim-hub.js';

// ═══════════════════════════ 断言辅助 ═══════════════════════════

/** namespace 域 kind 全集（缝上唯一合法 kind 集；对应零 diff 通道的分派壳）。 */
const NAMESPACE_DOMAIN_KINDS: ReadonlySet<string> = new Set([
  'OPEN_NAMESPACE',
  'BOOTSTRAP_ACK',
  'SYNC_STEP1',
  'SYNC_STEP2',
  'SYNC_APPLIED',
  'RESYNC_REQUIRED',
  'UPDATE',
  'UPDATE_ACK',
  'CLOSE_NAMESPACE',
  'CLOSE_OK',
  'ERROR',
  'UPDATE_CHUNK',
]);

/** 连接级/方向域 kind（绝不上缝——A3 负控面）。 */
const CONNECTION_LEVEL_KINDS: readonly string[] = [
  'HELLO',
  'HELLO_ACK',
  'GOAWAY',
  'OPEN_OK',
  'BOOTSTRAP_SNAPSHOT',
  'IDENTITY_CHANGED',
];

interface ShimCapture {
  readonly createHub: (options: HubReplicationOptions) => HubReplication;
  get(): ShimHub;
}

function captureShimHub(shimOptions?: ShimHubOptions): ShimCapture {
  let shim: ShimHub | undefined;
  return {
    createHub: (options) => {
      shim = createShimHubForTesting(options, shimOptions);
      return shim.replication;
    },
    get: () => {
      if (shim === undefined) throw new Error('shim hub 尚未创建');
      return shim;
    },
  };
}

function errorCodes(frames: readonly DecodedMessage[]): string[] {
  return frames
    .filter((f) => f.message.kind === 'ERROR')
    .map((f) => (f.message as { code: string }).code);
}

function sequences(frames: readonly DecodedMessage[]): number[] {
  return frames.map((f) => f.header.sequence).sort((left, right) => left - right);
}

function channelEdges(
  events: readonly ReplicationObserverEvent[],
): Array<{ readonly from: string; readonly to: string }> {
  return events.flatMap((event) =>
    event.type === 'channel-state-changed' && event.side === 'hub'
      ? [{ from: event.from, to: event.to }]
      : [],
  );
}

function fatalCodes(events: readonly ReplicationObserverEvent[]): string[] {
  return events.flatMap((event) =>
    event.type === 'connection-failed' ? [String(event.code)] : [],
  );
}

// ═══════════════════════════ AC2：内存管道对完整回合 ═══════════════════════════

describe('@420 AC2：公共 SessionHost 工厂 + 内存管道完整协议回合', () => {
  it('A1–A3：能力门 + 缝纯度（纯 JSON/字节）+ 缝纪律（仅 namespace 域 kind）', async () => {
    // A1 能力门：公共入口导出（缺即 undefined——HEAD 的红因）。
    expect(typeof createHubSessionHost).toBe('function');
    const capture = captureShimHub();
    const run = await boot({ createHub: capture.createHub });
    const probes = capture.get().probes;

    // A2：描述子纯 JSON（structuredClone 深等 + JSON 往返等值）。
    const input = probes.openInputs[0];
    if (input === undefined) throw new Error('A2：描述子未观测到（宿主未 open）');
    expect(input.namespaceId).toBe(run.nsId);
    expect(input.remoteInstanceId).toBe(PEER_INSTANCE);
    expect(input.connectionKey).toMatch(new RegExp(`^${HUB_INSTANCE}-conn-\\d+$`));
    expect(input.selectedCapabilities).toBe(0); // HELLO 交集 = 0/0
    expect(input.authorization).toEqual({
      ok: true,
      localOwner: HUB_OWNER,
      permissions: { read: true, submit: true },
    });
    expect(structuredClone(input)).toEqual(input);
    expect(JSON.parse(JSON.stringify(input))).toEqual(input);
    // 敏感性负控：掺函数闭包 → DataCloneError（判据非恒真）。
    expect(() => structuredClone({ ...input, authorize: () => undefined })).toThrow();

    // A2/C4d：缝内进出项均 `instanceof Uint8Array`；无 live 对象过缝。
    expect(probes.seamFramesIn.length).toBeGreaterThan(0);
    expect(probes.seamFramesOut.length).toBeGreaterThan(0);
    for (const frame of [...probes.seamFramesIn, ...probes.seamFramesOut]) {
      expect(frame.bytes).toBeInstanceOf(Uint8Array);
      expect(structuredClone(frame.bytes)).toEqual(frame.bytes);
    }
    for (const value of Object.values(input)) {
      expect(value).not.toBeInstanceOf(HubNamespaceChannel);
      expect(typeof value).not.toBe('function');
    }
    // sink 回传面恒 number（E1 承重：被分配 wire 序）。
    expect(probes.sinkReturns.length).toBeGreaterThan(0);
    for (const assigned of probes.sinkReturns) expect(typeof assigned).toBe('number');

    // A3：缝内 kind 全集 ⊆ namespace 域 kind；零连接级/方向域帧。
    const kinds = new Set(probes.seamFramesIn.map((frame) => frame.kind));
    expect(kinds.size).toBeGreaterThan(0);
    for (const kind of kinds) expect(NAMESPACE_DOMAIN_KINDS.has(kind)).toBe(true);
    for (const forbidden of CONNECTION_LEVEL_KINDS) expect(kinds.has(forbidden as never)).toBe(false);
  });

  it('A4–A8：OPEN 恰一 + authorize 恰一次（edge 侧）+ bootstrap/reconcile/live + wire 序与缝序纪律', async () => {
    const hubEvents: ReplicationObserverEvent[] = [];
    const capture = captureShimHub();
    const run = await boot({
      createHub: capture.createHub,
      hubObserver: (event) => hubEvents.push(event),
    });
    const probes = capture.get().probes;

    // A4：wire 恰一 OPEN_OK；authorize 恰一次且发生在 edge 侧。
    expect(run.hubFrames('OPEN_OK')).toHaveLength(1);
    expect(run.authorizer.calls).toEqual([
      { instanceIdentity: PEER_INSTANCE, namespaceId: run.nsId },
    ]);
    expect(probes.sessionsOpened).toBe(1);
    expect(probes.handles.size).toBe(1);

    // A5：bootstrap——wire 恰一 BOOTSTRAP_SNAPSHOT；对端 ACK 回指快照帧 wire 序 → reconciling。
    const snapshots = run.hubFrames('BOOTSTRAP_SNAPSHOT');
    expect(snapshots).toHaveLength(1);
    const bootstrapAcks = run.peerFrames('BOOTSTRAP_ACK');
    expect(bootstrapAcks).toHaveLength(1);
    expect(bootstrapAcks[0]?.message).toMatchObject({
      ackedSequence: snapshots[0]?.header.sequence,
    });
    expect(channelEdges(hubEvents).some((edge) => edge.to === 'reconciling')).toBe(true);

    // A6：reconcile 帧齐备 → 双方 live；hub/peer doc 收敛（同一状态字节）。
    expect(run.hubFrames('SYNC_STEP1').length).toBeGreaterThanOrEqual(1);
    expect(run.hubFrames('SYNC_STEP2').length).toBeGreaterThanOrEqual(1);
    expect(run.hubFrames('SYNC_APPLIED').length).toBeGreaterThanOrEqual(1);
    expect(run.namespaceState()).toBe('live');
    expect(channelEdges(hubEvents).some((edge) => edge.to === 'live')).toBe(true);
    expect([...encodeStateAsUpdate(run.snapshotDoc('hub'))]).toEqual([
      ...encodeStateAsUpdate(run.snapshotDoc('peer')),
    ]);

    // A7：live 双向——peer→hub UPDATE 落盘 + UPDATE_ACK 回指入站 wire 序。
    await run.writePeer({ n: 7, extra: 5 });
    await settleUntil(() => run.hubFrames('UPDATE_ACK').length >= 1, 'peer UPDATE_ACK');
    const peerUpdates = run.peerFrames('UPDATE');
    expect(peerUpdates).toHaveLength(1);
    const hubAcks = run.hubFrames('UPDATE_ACK');
    expect(hubAcks).toHaveLength(1);
    expect(hubAcks[0]?.message).toMatchObject({
      ackedSequence: peerUpdates[0]?.header.sequence,
    });
    expect(run.rootValue('hub', 'n')).toBe(7);
    // hub 侧真实写 → UPDATE 出帧 + peer ACK 结算（update-acked；零 resync-required）。
    const hubUpdatesBefore = run.hubFrames('UPDATE').length;
    await run.writeHub({ n: 43 });
    const hubUpdates = run.hubFrames('UPDATE');
    expect(hubUpdates.length).toBe(hubUpdatesBefore + 1);
    const peerAcks = run.peerFrames('UPDATE_ACK');
    expect(peerAcks[peerAcks.length - 1]?.message).toMatchObject({
      ackedSequence: hubUpdates[hubUpdatesBefore]?.header.sequence,
    });
    expect(hubEvents.some((event) => event.type === 'update-acked')).toBe(true);
    expect(hubEvents.some((event) => event.type === 'resync-required')).toBe(false);

    // A8：wire 序自 1 严格 +1（两方向独立），无 0 占位泄漏。
    const wire = run.frames();
    for (const direction of [wire.peerToHub, wire.hubToPeer]) {
      const seqs = sequences(direction);
      expect(seqs).toEqual(seqs.map((_, index) => index + 1));
    }
    // W1/RA4'：出站缝帧恒占位 0；入站非 OPEN 帧携带 wire 序（逐帧可回指 wire 原帧）。
    for (const frame of probes.seamFramesOut) expect(frame.placeholderSequence).toBe(0);
    const nonOpenInbound = probes.seamFramesIn.filter((frame) => frame.kind !== 'OPEN_NAMESPACE');
    expect(nonOpenInbound.length).toBeGreaterThan(0);
    for (const frame of nonOpenInbound) {
      expect(frame.sequence).toBeGreaterThan(0);
      expect(
        run
          .frames()
          .peerToHub.some(
            (wireFrame) =>
              wireFrame.header.sequence === frame.sequence && wireFrame.message.kind === frame.kind,
          ),
        `${frame.kind}#${frame.sequence} 必须回指 wire 原帧`,
      ).toBe(true);
    }
    // OPEN 中继序 = 桥合成值（登记例外：协议无消费者）。
    const openInbound = probes.seamFramesIn.filter((frame) => frame.kind === 'OPEN_NAMESPACE');
    expect(openInbound.length).toBeGreaterThanOrEqual(1);
    for (const frame of openInbound) expect(frame.sequence).toBe(0);
    // 序回传承重锚：正回传至少发生一次（A12 红臂证明该回传是承重事实）。
    expect(probes.sinkReturns.filter((assigned) => assigned > 0).length).toBeGreaterThan(0);
  });

  it('A4-W2 负控：ok-投影 localOwner 与 entry owner 不符 → 无 OPEN_OK + NAMESPACE_NOT_FOUND + 零成功打开', async () => {
    let openCalls = 0;
    let openedOk = 0;
    const capture = captureShimHub();
    const run = await boot({
      createHub: capture.createHub,
      // 描述子 localOwner ≠ hub fixture entry owner：registry.open 主人不符（零存在性泄露）。
      authorize: async () => ({
        ok: true as const,
        localOwner: PEER_OWNER,
        permissions: { read: true, submit: true },
      }),
      wrapHubRegistry: (registry) =>
        new Proxy(registry, {
          get(target, property, receiver) {
            if (property === 'open') {
              return async (...args: unknown[]) => {
                openCalls += 1;
                const result = await (target.open as (...inner: unknown[]) => Promise<unknown>)(
                  ...args,
                );
                if ((result as { ok?: boolean }).ok === true) openedOk += 1;
                return result;
              };
            }
            const value = Reflect.get(target, property, receiver) as unknown;
            return typeof value === 'function'
              ? (value as (...inner: unknown[]) => unknown).bind(target)
              : value;
          },
        }),
      waitFor: 'failed',
    });
    expect(run.hubFrames('OPEN_OK')).toHaveLength(0);
    expect(errorCodes(run.hubFrames('ERROR'))).toEqual(['NAMESPACE_NOT_FOUND']);
    expect(openedOk).toBe(0); // 零成功打开（被拒 ns 零会话资源唤起）
    expect(openCalls).toBeGreaterThanOrEqual(1); // 主人不符由 registry 判定（单点）
    expect(run.authorizer.calls).toEqual([
      { instanceIdentity: PEER_INSTANCE, namespaceId: run.nsId },
    ]);
    expect(run.namespaceState()).toBe('failed');
    expect(capture.get().probes.sessionsOpened).toBe(1);
  });

  it('A9：CLOSE 回合——CLOSE_OK 回指入站 wire 序 + settled 信号恰一次 + 终态', async () => {
    const hubEvents: ReplicationObserverEvent[] = [];
    const capture = captureShimHub();
    const run = await boot({
      createHub: capture.createHub,
      hubObserver: (event) => hubEvents.push(event),
    });
    const probes = capture.get().probes;
    await run.peer.removeTarget(run.nsId);
    await settleUntil(() => run.hubFrames('CLOSE_OK').length >= 1, 'CLOSE_OK');
    await settle();
    const closeRequests = run.peerFrames('CLOSE_NAMESPACE');
    expect(closeRequests).toHaveLength(1);
    const closeOks = run.hubFrames('CLOSE_OK');
    expect(closeOks).toHaveLength(1);
    expect(closeOks[0]?.message).toMatchObject({
      ackedSequence: closeRequests[0]?.header.sequence,
    });
    // settled 恰一次（生产通道单调性）并经 onSignal 转发至 edge（drain 判据）。
    expect(
      probes.signals.filter((signal) => signal.type === 'settled' && signal.namespaceId === run.nsId),
    ).toHaveLength(1);
    expect(channelEdges(hubEvents).some((edge) => edge.to === 'closed')).toBe(true);
    expect(fatalCodes(hubEvents)).toEqual([]);
  });

  it('A10–A11：terminateUnauthorized 收口（零 fatal）+ hub.close() drain 幂等 + 零 unhandled rejection', async () => {
    const unhandled = collectUnhandledRejections();
    const hubEvents: ReplicationObserverEvent[] = [];
    const capture = captureShimHub();
    const run = await boot({
      createHub: capture.createHub,
      hubObserver: (event) => hubEvents.push(event),
    });
    try {
      const probes = capture.get().probes;
      const handle = probes.handles.get(run.nsId);
      if (handle === undefined) throw new Error('A10：公共句柄未观测到');
      const fatalBefore = fatalCodes(hubEvents).length;
      const pendingBefore = run.hubNode.scheduler.pending();
      // A10：live 后直调 revoke 链信号——该 ns 离开 live，双方终态，零 connection-fatal。
      await handle.terminateUnauthorized();
      await settle();
      expect(channelEdges(hubEvents).some((edge) => edge.to === 'failed')).toBe(true);
      expect(fatalCodes(hubEvents).length).toBe(fatalBefore);
      expect(errorCodes(run.hubFrames('ERROR'))).toContain('NAMESPACE_UNAUTHORIZED');
      // A11：hub.close() resolve + 幂等（同一 promise）；drain 后无残留 timer 增长。
      const wire = run.wire;
      const first = run.hub.close();
      expect(run.hub.close()).toBe(first);
      await expect(first).resolves.toBeUndefined();
      await settle();
      expect(wire.peerSideCloseInfo?.code).toBe(1001);
      expect(run.hubNode.scheduler.pending()).toBeLessThanOrEqual(pendingBefore);
      const framesAfterClose = wire.hubToPeer.length;
      await advanceMs(run, 30_000);
      expect(wire.hubToPeer.length).toBe(framesAfterClose); // 无残留 timer 召回出帧
      expect(unhandled.events).toEqual([]);
    } finally {
      unhandled.dispose();
    }
  });

  it('A12 红臂（变异正控）：宿主不回传被分配序 → bootstrap ACK 处响亮 ACK_STATE_VIOLATION 收口', async () => {
    const hubEvents: ReplicationObserverEvent[] = [];
    const capture = captureShimHub({ suppressSequenceReturn: true });
    const run = await boot({
      createHub: capture.createHub,
      hubObserver: (event) => hubEvents.push(event),
      waitFor: 'none', // 回合结果 = 红：不可达 live，故不作 live 等待
    });
    await settle();
    const probes = capture.get().probes;
    // 被断言的对象（回合结果）= 红：未达 live。
    expect(run.namespaceState()).not.toBe('live');
    // 断言（绿）= 观察到 bootstrap ACK 违约的连接级收口。
    expect(errorCodes(run.hubFrames('ERROR'))).toContain('ACK_STATE_VIOLATION');
    expect(probes.signals).toContainEqual({
      type: 'connection-fatal',
      code: 'ACK_STATE_VIOLATION',
    });
    expect(run.wire.peerSideCloseInfo).toEqual({ code: 1002, reason: 'protocol-error' });
    expect(fatalCodes(hubEvents)).toContain('ACK_STATE_VIOLATION');
  });
});

// ═══════════════════════════ AC5：session 侧零重检 sequence ═══════════════════════════

describe('@420 AC5：session 侧重检入站 sequence 的代码不存在', () => {
  it('C5b 负控：同一非法序在 edge → SEQUENCE_VIOLATION + close(1002) + 零缝投递', async () => {
    const capture = captureShimHub();
    const run = await boot({ createHub: capture.createHub });
    const probes = capture.get().probes;
    const seamBefore = probes.seamFramesIn.length;
    // 跳过一序（edge 单点校验：expectedSeq 不符 → 连接级致命，帧不进缝）。
    run.injectPeer(
      { kind: 'CLOSE_NAMESPACE', namespaceId: run.nsId, reasonCode: 'client-close' },
      { sequence: run.nextPeerSeq() + 1 },
    );
    await settle();
    expect(errorCodes(run.hubFrames('ERROR'))).toContain('SEQUENCE_VIOLATION');
    expect(run.wire.peerSideCloseInfo).toEqual({ code: 1002, reason: 'protocol-error' });
    expect(probes.seamFramesIn.length).toBe(seamBefore);
  });

  it('C5a 正锚：回退/重复序经公共 handleFrame 仍被消费并回显该序（零 fatal）+ C5c 结构门', async () => {
    const hubEvents: ReplicationObserverEvent[] = [];
    const capture = captureShimHub();
    const run = await boot({
      createHub: capture.createHub,
      hubObserver: (event) => hubEvents.push(event),
    });
    const probes = capture.get().probes;
    const handle = probes.handles.get(run.nsId);
    if (handle === undefined) throw new Error('C5a：公共句柄未观测到');
    // 前置：该 ns 在回合中已消费过 wire 序 2（回退序 = 真实重复，非新序）。
    expect(run.frames().peerToHub.some((frame) => frame.header.sequence === 2)).toBe(true);
    const fatalBefore = fatalCodes(hubEvents).length;
    const signalsBefore = probes.signals.filter(
      (signal) => signal.type === 'connection-fatal',
    ).length;
    // 经公共字节入口投递回退序 CLOSE_NAMESPACE（seq=2）——session 半边不得重检。
    handle.handleFrame(
      encodeMessage(
        { kind: 'CLOSE_NAMESPACE', namespaceId: run.nsId, reasonCode: 'client-close' },
        { sequence: 2 },
      ),
    );
    await settle();
    const closeOks = run.hubFrames('CLOSE_OK');
    expect(closeOks).toHaveLength(1);
    expect(closeOks[0]?.message).toMatchObject({ ackedSequence: 2 });
    expect(errorCodes(run.hubFrames('ERROR'))).toEqual([]);
    expect(fatalCodes(hubEvents).length).toBe(fatalBefore);
    expect(
      probes.signals.filter((signal) => signal.type === 'connection-fatal').length,
    ).toBe(signalsBefore);
    expect(channelEdges(hubEvents).some((edge) => edge.to === 'closed')).toBe(true);
    // C5c 补充结构门：公共字节入口的解码调用不含入站序期望（模式命中 0）。
    const source = readFileSync(new URL('../src/hub-session-host.ts', import.meta.url), 'utf8');
    expect(source.includes('expectedSequence')).toBe(false);
  });
});

// ═══════════════════════════ AC4：缝纯度结构门 ═══════════════════════════

describe('@420 AC4：缝两侧只过 Uint8Array 与纯 JSON；包内零跨线程面依赖/类型', () => {
  it('C4a：src/** 与 package.json 对跨线程面 API 命中的结构门为 0（实现后须保持）', () => {
    // AC 明文要求「零依赖或类型」⇒ 本项是本族唯一允许的**补充**结构判据（行为判据另在
    // A2/A3/A8 + C4b/C4c/C4d，二者不得互相替代）。
    const pattern = /worker_threads|MessageChannel|MessagePort/u;
    const packageRoot = new URL('../', import.meta.url);
    expect(pattern.test(readFileSync(new URL('package.json', packageRoot), 'utf8'))).toBe(false);
    const sources = readdirSync(new URL('src', packageRoot)).filter((name) => name.endsWith('.ts'));
    expect(sources.length).toBeGreaterThan(0);
    for (const name of sources) {
      const text = readFileSync(new URL(`src/${name}`, packageRoot), 'utf8');
      expect(pattern.test(text), `src/${name} 命中跨线程面 API`).toBe(false);
    }
  });

  it('C4b–C4d：描述子纯 JSON + 帧即字节 + 无 live 对象过缝（负控敏感性）', async () => {
    const capture = captureShimHub();
    const run = await boot({ createHub: capture.createHub });
    const probes = capture.get().probes;
    const input = probes.openInputs[0];
    if (input === undefined) throw new Error('C4b：描述子未观测到');
    // C4b：可 structuredClone 且 JSON 往返等值；掺函数 → DataCloneError（判据非恒真）。
    expect(structuredClone(input)).toEqual(input);
    expect(JSON.parse(JSON.stringify(input))).toEqual(input);
    expect(() => structuredClone({ ...input, hooks: { onFrame: () => 1 } })).toThrow();
    // C4c：缝内进项为字节（入站非 OPEN 帧带 wire 序、出站恒占位 0）。
    for (const frame of probes.seamFramesIn) {
      expect(frame.bytes).toBeInstanceOf(Uint8Array);
      if (frame.kind !== 'OPEN_NAMESPACE') expect(frame.sequence).toBeGreaterThan(0);
    }
    for (const frame of probes.seamFramesOut) {
      expect(frame.bytes).toBeInstanceOf(Uint8Array);
      expect(frame.placeholderSequence).toBe(0);
      expect(decodeMessage(frame.bytes).header.sequence).toBe(0);
    }
    // C4d：无 live 对象过缝（通道实例/函数绝不出现在描述子与缝帧上）。
    expect(input).not.toBeInstanceOf(HubNamespaceChannel);
    for (const value of Object.values(input)) {
      expect(value).not.toBeInstanceOf(HubNamespaceChannel);
    }
    expect(run.namespaceState()).toBe('live');
  });
});
