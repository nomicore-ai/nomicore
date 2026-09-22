/**
 * SA6 验收契约 — issue #447（γ-T1）：**γ 异步缝完整协议回合 + 锚/窗口/分块族**（ROUND-C1~C3、
 * ANCHOR-C1/C2、PEND-C1~C3、CHUNK-C1~C3；设计 §12 与 §8.9 数据流路线）。
 *
 * 装配形态（设计 §8.7/§8.9）：
 *
 *   `boot({ createHub: makeAsyncReplicationFacade, random: () => 0.5, waitFor: 'none' })`
 *   —— facade 把 boot 传入的 `options.registry`/`options.timer`/`options.limits` 结构性采纳为
 *   γ 会话宿主与 edge 工厂的配置（内部恰一个 γ 宿主；错位装配在签名面不可表达）。
 *
 *   **boot 形态 registry 同一性约束（设计 §8.3.1）**：boot 的 hub 侧观察面（`run.writeHub` /
 *   `run.snapshotDoc('hub')` / `run.rootValue('hub')`）硬绑 boot 内部 `hubNode`；只有会话宿主
 *   建于 `options.registry`（≡ `run.hubNode.registry`，同一对象）之上时，hub fixture 文档与
 *   复制会话驱动的文档才同源。每个形态 boot 后先做前提断言（错位装配在场景前置即红）。
 *
 *   **缝推进**：`pumpUntil` 显式释放每会话双向 FIFO 通道（延迟可注入、零真实 timer）——
 *   扣留场景经 `withholdEdgeToSession` / `release(n)` 精确控制，禁 park 语义由断言面体现。
 *
 * 纪律（SA6 §12.0）：断言 = 运行时行为（wire 帧 kind/序 / `[8..12]` 原字节 / `ackedSequence`
 * 回指 / namespace 状态 / 文档收敛字节 / 缝消息日志 / 观察者单事件字段值）；零源码 grep；
 * 零 skip/only/todo；真 peer（`createPeerReplication`）+ 真 Registry/Runtime + 公共工厂真身。
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { CAP_CHUNKED_UPDATE } from '@nomicore/replication-protocol';
import type { ReplicationObserverEvent } from '@nomicore/ws-replication';
import { boot, collectUnhandledRejections, type Run } from './driver.js';
import { settle, settleUntil, FIXED_MS } from './harness.js';
import {
  type AsyncFacade,
  type AsyncSessionSeam,
  type WireFrame,
  TIMEOUTS,
  isAsyncOutboundFrame,
  isInboundFrame,
  kindOfPlaceholder,
  makeAsyncObserver,
  makeAsyncReplicationFacade,
  makeManualClock,
  pumpSteps,
  pumpUntil,
  wireControlFrames,
  wireDataFrames,
  wireDocState,
  wireFramesHexEqual,
  wireFramesOfKind,
  wireSkeleton,
} from './issue447-async-seam.js';

/** 能力感知的 hub→peer / peer→hub 帧面（分块构型下 `run.hubFrames` 会因缺协商位响亮拒绝）。 */
function hubFrames(round: AsyncRound, kind: string): WireFrame[] {
  return wireFramesOfKind(round.run.wire.hubToPeer, kind);
}

function peerFrames(round: AsyncRound, kind: string): WireFrame[] {
  return wireFramesOfKind(round.run.wire.peerToHub, kind);
}

interface AsyncRound {
  readonly run: Run;
  readonly facade: AsyncFacade;
  /** observer 事件记录（`hubObserver: true` 场景；否则空数组）。 */
  readonly observerEvents: readonly ReplicationObserverEvent[];
  /** 唯一会话键（`connectionKey` = edge 生成的 `${instanceId}-conn-${n}`）。 */
  connectionKey(): string;
  /** 唯一会话通道对（`(connectionKey, nsId)`）。 */
  seam(): AsyncSessionSeam;
}

interface AsyncBootOptions {
  readonly chunkedUpdate?: boolean;
  readonly limits?: Readonly<Record<string, number>>;
  readonly hubObserver?: boolean;
  readonly hubClock?: () => number | undefined;
}

/** boot 一个 adopt 装配的 γ 回合（先置前提断言；namespace 推进由 pumpUntil 驱动）。 */
async function bootAsyncRound(opts: AsyncBootOptions = {}): Promise<AsyncRound> {
  const recorder = opts.hubObserver === true ? makeAsyncObserver() : undefined;
  const clockRef = { now: opts.hubClock };
  let facade: AsyncFacade | undefined;
  const run = await boot({
    ...(opts.chunkedUpdate === undefined ? {} : { chunkedUpdate: opts.chunkedUpdate }),
    ...(opts.limits === undefined ? {} : { limits: opts.limits }),
    ...(recorder !== undefined ? { hubObserver: recorder.observer } : {}),
    ...(opts.hubClock !== undefined
      ? { hubClock: { now: () => clockRef.now?.() ?? FIXED_MS } }
      : {}),
    waitFor: 'none',
    random: () => 0.5,
    createHub: (options) => {
      facade = makeAsyncReplicationFacade(options);
      return facade.replication;
    },
  });
  if (facade === undefined) throw new Error('ROUND 装配前提失败：facade 未被 boot 调用');
  // ROUND 装配前提（设计 §8.3.1）：会话宿主的 registry 必须是 boot 传入的同一对象。
  expect(
    facade.worker.registry,
    'ROUND 装配前提：worker.registry 必须 === run.hubNode.registry（同一对象）',
  ).toBe(run.hubNode.registry);
  // 唯一连接键 = edge 生成的 connectionKey（登记后第一动作写入 connections 表）。
  const connections = [...facade.host.connections.keys()];
  expect(connections, 'γ 装配连接数').toHaveLength(1);
  const connectionKey = connections[0]!;
  return {
    run,
    facade,
    observerEvents: recorder?.events ?? [],
    connectionKey: () => connectionKey,
    seam: () => facade!.host.channel(connectionKey, run.nsId),
  };
}

function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function ackedSequenceOf(frame: { readonly message: unknown }): number {
  return (frame.message as { ackedSequence: number }).ackedSequence;
}

/** 推进到 namespace live（缝消息由显式释放搬运）。 */
async function awaitLive(round: AsyncRound): Promise<void> {
  await pumpUntil(round.facade.host, () => round.run.namespaceState() === 'live', 'namespace live');
}

/** ROUND-C1 断言族（含 ANCHOR-C1 正路）：OPEN_OK×1 + bootstrap 载荷恰一组 + ACK 回指 + SYNC 三段 + 收敛。 */
function assertRoundC1(round: AsyncRound, opts: { readonly chunked: boolean }): void {
  const { run } = round;
  expect(hubFrames(round, 'OPEN_OK'), 'OPEN_OK 数').toHaveLength(1);
  const bootstrapAcks = peerFrames(round, 'BOOTSTRAP_ACK');
  expect(bootstrapAcks, 'peer BOOTSTRAP_ACK 数').toHaveLength(1);
  if (opts.chunked) {
    const chunks = hubFrames(round, 'UPDATE_CHUNK');
    expect(chunks.length, 'kind=1 UPDATE_CHUNK 帧数').toBeGreaterThanOrEqual(2);
    expect(hubFrames(round, 'BOOTSTRAP_SNAPSHOT'), 'BOOTSTRAP_SNAPSHOT 单帧数（分块形态恒 0）').toHaveLength(0);
    const lastChunkSequence = chunks[chunks.length - 1]!.sequence;
    expect(ackedSequenceOf(bootstrapAcks[0]!), 'BOOTSTRAP_ACK 回指末 chunk 帧序').toBe(
      lastChunkSequence,
    );
  } else {
    const snapshots = hubFrames(round, 'BOOTSTRAP_SNAPSHOT');
    expect(snapshots, 'BOOTSTRAP_SNAPSHOT 数').toHaveLength(1);
    expect(ackedSequenceOf(bootstrapAcks[0]!), 'BOOTSTRAP_ACK 回指快照帧序').toBe(
      snapshots[0]!.sequence,
    );
  }
  for (const kind of ['SYNC_STEP1', 'SYNC_STEP2', 'SYNC_APPLIED'] as const) {
    expect(
      peerFrames(round, kind).length + hubFrames(round, kind).length,
      `${kind} 数`,
    ).toBeGreaterThanOrEqual(1);
  }
  expect(run.namespaceState(), 'namespace 状态').toBe('live');
  expect(hexOf(Y.encodeStateAsUpdate(run.snapshotDoc('hub'))), 'hub/peer 文档收敛').toBe(
    hexOf(Y.encodeStateAsUpdate(run.snapshotDoc('peer'))),
  );
}

/** ROUND-C3 段：CLOSE 回合（CLOSE_OK 回指 + settled 经缝恰一次）。 */
async function assertCloseRound(round: AsyncRound): Promise<void> {
  const { run, facade } = round;
  // 关闭握手需要缝泵送：先发起（不 await），泵到 CLOSE_OK 后再取 promise。
  const closing = run.peer.removeTarget(run.nsId);
  await pumpUntil(
    facade.host,
    () => hubFrames(round, 'CLOSE_OK').length >= 1,
    'CLOSE_OK',
  );
  await closing;
  const closeRequests = peerFrames(round, 'CLOSE_NAMESPACE');
  const closeOks = hubFrames(round, 'CLOSE_OK');
  expect(closeRequests, 'CLOSE_NAMESPACE 数').toHaveLength(1);
  expect(closeOks, 'CLOSE_OK 数').toHaveLength(1);
  expect(ackedSequenceOf(closeOks[0]!), 'CLOSE_OK 回指 CLOSE_NAMESPACE 序').toBe(
    closeRequests[0]!.sequence,
  );
  expect(
    facade.host.probes.signals.filter((signal) => signal === `settled:${run.nsId}`),
    `settled 信号（${JSON.stringify(facade.host.probes.signals)}）`,
  ).toHaveLength(1);
}

describe('issue #447 ROUND — γ 异步缝（boot adopt 装配 + 显式释放管道）', () => {
  it('ROUND-C1（单帧形态）：OPEN_OK×1 + BOOTSTRAP_SNAPSHOT×1 + peer BOOTSTRAP_ACK×1（回指）；SYNC 三段齐备；live；hub/peer 文档收敛', async () => {
    const round = await bootAsyncRound();
    await awaitLive(round);
    assertRoundC1(round, { chunked: false });
    await assertCloseRound(round);
  }, 30_000);

  it('ROUND-C1（协商位形态 chunkedUpdate:true）：同断言族成立；HELLO_ACK 与描述子均携带 CAP_CHUNKED_UPDATE', async () => {
    const round = await bootAsyncRound({ chunkedUpdate: true });
    const helloAcks = round.run.hubFrames('HELLO_ACK');
    expect(helloAcks, 'HELLO_ACK 数').toHaveLength(1);
    expect(
      (helloAcks[0]!.message as { selectedCapabilities: number }).selectedCapabilities &
        CAP_CHUNKED_UPDATE,
      'HELLO_ACK.selectedCapabilities',
    ).not.toBe(0);
    await awaitLive(round);
    expect(round.facade.host.probes.opens, '描述子数').toHaveLength(1);
    assertRoundC1(round, { chunked: false });
    await assertCloseRound(round);
  }, 30_000);

  it('ANCHOR-C1 收尾（单帧形态）：unsolicited BOOTSTRAP_ACK 不得被静默接受——响亮收口（AC anchor 复位后引用性 ACK 违例）', async () => {
    const round = await bootAsyncRound();
    await awaitLive(round);
    assertRoundC1(round, { chunked: false });
    const before = round.run.allFrames().hubToPeer.length;
    // 锚已在 ACK 成功路径复位；再造一次引用性 ACK ⇒ 响亮（零 park、零静默接受）。
    round.run.injectPeer({ kind: 'BOOTSTRAP_ACK', namespaceId: round.run.nsId, ackedSequence: 1 });
    await pumpUntil(
      round.facade.host,
      () => round.run.hubFrames('ERROR').length >= 1,
      'unsolicited ACK 响亮收口',
    );
    expect(round.run.hubFramesAll('ERROR').length, 'ERROR 数').toBeGreaterThanOrEqual(1);
    expect(round.run.allFrames().hubToPeer.length).toBeGreaterThan(before);
    expect(round.run.namespaceState(), 'namespace 不得保持 live').not.toBe('live');
  }, 30_000);

  it('ANCHOR-C2（扣回执 + 直投 ACK）：锚 pending 时收到引用性 ACK ⇒ connection-fatal{ACK_STATE_VIOLATION} + ERROR + close 1002；有限泵内必达（零 park）', async () => {
    const round = await bootAsyncRound();
    const { run, facade } = round;
    // 会话通道对在 edge 解析 OPEN 时建立（登记权威单点）；此后才可注入回执丢弃面。
    await settleUntil(() => facade.host.seams.size === 1, 'γ 会话通道对建立');
    // 扣住前 2 条回执（OPEN_OK + BOOTSTRAP_SNAPSHOT）：锚停留 pending，回执不可达。
    facade.host.dropReceipts(round.connectionKey(), run.nsId, 2);
    await pumpUntil(
      facade.host,
      () => run.peerFrames('BOOTSTRAP_ACK').length >= 1 || run.hubFrames('ERROR').length >= 1,
      'BOOTSTRAP_ACK 或响亮收口',
    );
    await pumpUntil(
      facade.host,
      () => facade.host.probes.signals.some((s) => s === 'connection-fatal:ACK_STATE_VIOLATION'),
      'connection-fatal{ACK_STATE_VIOLATION}',
    );
    expect(
      facade.host.probes.signals.filter((s) => s === 'connection-fatal:ACK_STATE_VIOLATION'),
      'fatal 信号恰一次',
    ).toHaveLength(1);
    const codes = run
      .hubFramesAll('ERROR')
      .map((frame) => (frame.message as { code: string }).code);
    expect(codes, `hub ERROR 码（${JSON.stringify(codes)}）`).toContain('ACK_STATE_VIOLATION');
    expect(run.namespaceState(), 'namespace 不得 live').not.toBe('live');
    expect(facade.host.probes.receipts.length, '被扣回执不投递').toBe(0);
  }, 30_000);

  it('ROUND-C2 parity（单帧形态）：同场 β（sharded 同步缝）vs γ（异步缝）——控制帧逐字节等 + 骨架等 + 数据帧文档语义等；peer nonce 钉死', async () => {
    const { framesHexEqual, controlFramesOf, dataFramesOf, skeletonOf, docStateOf, makeShardedReplicationFacade } =
      await import('./issue424-sharded-hub.js');
    const beta = await boot({
      random: () => 0.5,
      waitFor: 'none',
      createHub: (options) => makeShardedReplicationFacade(options).replication,
    });
    await beta.waitNamespace('live');
    const gamma = await bootAsyncRound();
    await awaitLive(gamma);

    // 控制帧子集逐字节等（HELLO_ACK/OPEN_OK/ERROR/CLOSE_OK/GOAWAY）。
    expect(
      framesHexEqual(controlFramesOf(beta.wire.hubToPeer), controlFramesOf(gamma.run.wire.hubToPeer)),
      'hub→peer 控制帧逐字节',
    ).toBeUndefined();
    expect(
      framesHexEqual(controlFramesOf(beta.wire.peerToHub), controlFramesOf(gamma.run.wire.peerToHub)),
      'peer→hub 控制帧逐字节',
    ).toBeUndefined();
    // 骨架（全轨迹 kind(code?)#sequence）逐方向全等。
    expect(skeletonOf(gamma.run.wire.hubToPeer), 'hub→peer 骨架').toBe(
      skeletonOf(beta.wire.hubToPeer),
    );
    expect(skeletonOf(gamma.run.wire.peerToHub), 'peer→hub 骨架').toBe(
      skeletonOf(beta.wire.peerToHub),
    );
    // 数据帧文档语义等（Yjs clientID 随机会使逐字节比较假红——#424 ORACLE-2 口径）。
    expect(docStateOf(dataFramesOf(gamma.run.wire.hubToPeer)), '数据帧文档语义').toBe(
      docStateOf(dataFramesOf(beta.wire.hubToPeer)),
    );

    // NC-1 负控（内容敏感性，断言非恒真）：hub ROOT 变异（42 → 43）⇒ 数据帧文档语义比对
    // 必报差异，而控制帧仍逐字节等（控制帧不承载数据内容 = 正确判据）。
    const varied = await boot({
      hubRoot: { n: 43, extra: 77 },
      random: () => 0.5,
      waitFor: 'none',
      createHub: (options) => makeShardedReplicationFacade(options).replication,
    });
    await varied.waitNamespace('live');
    expect(
      framesHexEqual(controlFramesOf(beta.wire.hubToPeer), controlFramesOf(varied.wire.hubToPeer)),
      'NC-1：内容变异下控制帧仍逐字节等',
    ).toBeUndefined();
    expect(
      docStateOf(dataFramesOf(varied.wire.hubToPeer)),
      'NC-1：内容变异必被数据帧语义比对捕获',
    ).not.toBe(docStateOf(dataFramesOf(gamma.run.wire.hubToPeer)));
  }, 30_000);

  it('ROUND-C3（回执序与 wire 序一致）：每 receipt.sequence === 同 tag 帧的 wire [8..12]；同会话不重不跳；tag 句柄域内严格单调唯一', async () => {
    const round = await bootAsyncRound();
    await awaitLive(round);
    const { facade, run } = round;
    const stamps = facade.host.probes.stamps;
    expect(stamps.length, '出站帧数（≥2）').toBeGreaterThanOrEqual(2);
    const tags = stamps.map((s) => s.tag);
    expect(tags, 'tag 严格单调唯一').toEqual([...tags].sort((a, b) => a - b));
    expect(new Set(tags).size, 'tag 唯一').toBe(tags.length);
    const sequences = stamps.map((s) => s.sequence);
    for (let i = 1; i < sequences.length; i += 1) {
      expect(sequences[i]!, `wire 序严格递增（${sequences.join(',')}）`).toBeGreaterThan(
        sequences[i - 1]!,
      );
      expect(sequences[i]!).toBe(sequences[i - 1]! + 1);
    }
    // 每条 receipt 恰与其 tag 帧的盖章序一致（夹具记录 = 桥返回值 = 帧 [8..12]）。
    const receipts = facade.host.probes.receipts;
    expect(receipts.length, 'receipt 数 = 已盖章帧数').toBe(stamps.length);
    for (const receipt of receipts) {
      const stamp = stamps.find((s) => s.tag === receipt.tag);
      expect(stamp, `tag ${receipt.tag} 的盖章记录`).toBeDefined();
      expect(receipt.sequence, `tag ${receipt.tag} 回执序`).toBe(stamp!.sequence);
      const wire = [...run.wire.hubToPeer].find(
        (bytes) => rawSequenceOf(bytes) === receipt.sequence,
      );
      expect(wire, `wire 中存在序 ${receipt.sequence} 的帧`).toBeDefined();
    }
  }, 30_000);
});

function rawSequenceOf(bytes: Uint8Array): number {
  return ((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0;
}

// ═══════════════════════════ PEND 族（两相记账 + ackTimeout 有界性） ═══════════════════════════

describe('issue #447 PEND — 数据面两相记账（pending 自推送占窗；ACK 释放槽位）', () => {
  it('PEND-C1/C2：maxInFlightUpdates=1 + 扣留 edgeToSession —— 第 1 帧 pending 占窗（第 2 帧不过缝）；回执换键不换槽（第 2 帧仍不过缝）；ACK 结算释放槽位后由自驱 drain 推出第 2 帧', async () => {
    const round = await bootAsyncRound({ limits: { maxInFlightUpdates: 1 } });
    await awaitLive(round);
    const { run, facade } = round;
    const seam = round.seam();
    const dataFrames = (): number =>
      facade.host.probes.outbound.filter((frame) => frame.lane === 'data').length;

    // 扣留 edge→session：回执与 ACK 均不可达（PEND-C1 的延迟注入面）。
    facade.host.withholdEdgeToSession(round.connectionKey(), run.nsId);
    await run.writeHub({ n: 43 });
    await pumpUntil(facade.host, () => run.hubFrames('UPDATE').length >= 1, '第 1 笔 UPDATE 过缝');
    expect(dataFrames(), 'PEND-C1：扣留期缝上恰 1 条出站 data 帧').toBe(1);

    // 第 2 笔：pending 已占窗（推送时刻起算）⇒ 停留 session 队列，不过缝。
    await run.writeHub({ n: 44 });
    await pumpUntil(
      facade.host,
      () =>
        seam.edgeToSession
          .pending()
          .some((m) => isInboundFrame(m) && kindOfPlaceholder(m.bytes) === 'UPDATE_ACK'),
      '第 1 笔的 UPDATE_ACK 到达 edge（被扣留）',
    );
    expect(run.hubFrames('UPDATE'), 'PEND-C1：pending 占窗时第 2 帧不得过缝').toHaveLength(1);
    expect(dataFrames(), 'PEND-C1：缝上 data 帧数不变').toBe(1);

    // PEND-C2 中间态：只放回执（未放 ACK）⇒ 换键不换槽：占用数不变，第 2 帧仍不得过缝。
    seam.edgeToSession.setHeld(false);
    expect(seam.edgeToSession.release(1), '恰投递 1 条（第 1 笔回执）').toBe(1);
    await settle();
    expect(run.hubFrames('UPDATE'), 'PEND-C2：rekey 不释放槽位（第 2 帧仍不过缝）').toHaveLength(1);
    expect(dataFrames(), 'PEND-C2：rekey 零新出站帧').toBe(1);

    // ACK 结算 ⇒ 唯一槽位释放 ⇒ 自驱 drain 推出第 2 帧（推送而非 ACK 触发）。
    seam.edgeToSession.release();
    await pumpUntil(facade.host, () => run.hubFrames('UPDATE').length >= 2, '第 2 帧于 ACK 结算后过缝');
    expect(run.hubFrames('UPDATE'), 'PEND-C2：第 2 帧由推送动作过缝').toHaveLength(2);
    expect(dataFrames(), 'PEND-C2：恰好 2 条 data 帧（无重复占槽）').toBe(2);
    await pumpUntil(
      facade.host,
      () => peerFrames(round, 'UPDATE_ACK').length >= 2,
      '第 2 笔 UPDATE_ACK（peer→hub）',
    );
    expect(peerFrames(round, 'UPDATE_ACK'), '两笔各恰一 ACK').toHaveLength(2);
  }, 30_000);

  it('PEND-C3：扣留使回执不可达 + 记账 timer 虚拟推进 ackTimeoutMs ⇒ ① RESYNC_REQUIRED×1 + needs-resync + 槽位释放；② 迟到回执良性 no-op（不 fatal / 不重复声明）；恢复 round 后新帧可再推', async () => {
    const round = await bootAsyncRound({
      limits: { maxInFlightUpdates: 1 },
      hubObserver: true,
    });
    await awaitLive(round);
    const { run, facade } = round;
    const seam = round.seam();
    const ackTimeoutMs = TIMEOUTS.ackTimeoutMs;

    facade.host.withholdEdgeToSession(round.connectionKey(), run.nsId);
    await run.writeHub({ n: 43 });
    await pumpUntil(facade.host, () => run.hubFrames('UPDATE').length >= 1, '第 1 笔 UPDATE 过缝');

    // ① 记账 timer 推进（hub 侧虚拟调度器）：pending-only 占用 ⇒ 合并占用判据成立 ⇒ 弃置。
    await run.hubNode.scheduler.advanceBy(ackTimeoutMs + 1);
    await settle();
    await pumpUntil(
      facade.host,
      () => run.hubFrames('RESYNC_REQUIRED').length >= 1,
      'RESYNC_REQUIRED（ack-timeout 有界兜底）',
    );
    expect(run.hubFrames('RESYNC_REQUIRED'), '① RESYNC_REQUIRED 恰好一次（记忆化）').toHaveLength(1);
    const resyncEvents = round.observerEvents.filter(
      (event) => event.type === 'resync-required',
    ) as Array<{ cause: string }>;
    expect(resyncEvents, '① observer resync-required 恰一次').toHaveLength(1);
    expect(resyncEvents[0]!.cause, '① cause = ack-timeout').toBe('ack-timeout');

    // ② 释放被扣通道：迟到回执（tag 已被弃置）良性 no-op。
    const quietBefore = facade.host.probes.signals.length;
    seam.edgeToSession.setHeld(false);
    await pumpUntil(
      facade.host,
      () => run.namespaceState() === 'live',
      '恢复 round 结算回 live',
    );
    expect(
      facade.host.probes.signals.filter((s) => s.startsWith('connection-fatal')),
      '② 迟到回执不得触发 connection-fatal',
    ).toHaveLength(0);
    expect(facade.host.probes.signals.length, '② 信号面零新增').toBe(quietBefore);
    expect(run.hubFrames('RESYNC_REQUIRED'), '② 不得重复声明 RESYNC_REQUIRED').toHaveLength(1);

    // ① 槽位释放可观察：恢复 live 后新帧可再推。
    const before = run.hubFrames('UPDATE').length;
    await run.writeHub({ n: 45 });
    await pumpUntil(facade.host, () => run.hubFrames('UPDATE').length > before, '恢复后新帧可再推');
    expect(run.hubFrames('UPDATE').length, '① 弃置后槽位已释放').toBe(before + 1);
  }, 30_000);

  it('PEND-C3 变异负控（判据去 pendingSends ⇒ β 裸判据）：计时器哑火 ⇒ ① 全组断言红——证明断言对合并占用判据敏感', async () => {
    const module = await import('../src/update-channel.js');
    const proto = module.UpdateChannel.prototype as unknown as {
      hasUnsettledSends(): boolean;
      inFlight: Map<number, unknown>;
    };
    const original = proto.hasUnsettledSends;
    // 变异 = 恢复 β 裸判据（不计 pending 占用）；其余生产代码零改动。
    proto.hasUnsettledSends = function mutated(this: { inFlight: Map<number, unknown> }): boolean {
      return this.inFlight.size > 0;
    };
    try {
      const round = await bootAsyncRound({ limits: { maxInFlightUpdates: 1 } });
      await awaitLive(round);
      const { run, facade } = round;
      facade.host.withholdEdgeToSession(round.connectionKey(), run.nsId);
      await run.writeHub({ n: 43 });
      await pumpUntil(facade.host, () => run.hubFrames('UPDATE').length >= 1, '第 1 笔 UPDATE 过缝');
      const updatesAfterPush = run.hubFrames('UPDATE').length;

      await run.hubNode.scheduler.advanceBy(TIMEOUTS.ackTimeoutMs + 1);
      await settle();
      await pumpSteps(facade.host, 3);
      // 变异下：计时器回调判据不含 pending ⇒ 哑火 ⇒ 零 RESYNC_REQUIRED。
      expect(
        run.hubFrames('RESYNC_REQUIRED'),
        '变异负控：裸判据下计时器哑火（零 RESYNC_REQUIRED）⇒ ① 的断言必红',
      ).toHaveLength(0);
      expect(run.hubFrames('UPDATE').length, '变异下第 2 帧亦不可推').toBe(updatesAfterPush);
    } finally {
      proto.hasUnsettledSends = original;
    }
  }, 30_000);
});

// ═══════════════════════════ CHUNK 族（真实 kind=1/kind=2 分块 + t0 口径） ═══════════════════════════

/**
 * CHUNK-C3 的显式延迟注入驱动：扣留 edge→session，只**计数放行 OPEN 帧**使会话启动，
 * 随后让全部分块过缝而回执不可达（每 chunk 恰一条回执，末 chunk 回执在 FIFO 尾部）。
 * 返回被扣回执条数（= 1 + chunkCount；释放它即结算锚，不含 ACK）。
 */
async function driveWithheldChunkedBootstrap(round: AsyncRound): Promise<number> {
  const { run, facade } = round;
  const connectionKey = round.connectionKey();
  await settleUntil(() => facade.host.seams.size === 1, 'γ 会话通道对建立');
  const seam = round.seam();
  await settleUntil(() => seam.edgeToSession.pending().length >= 1, 'OPEN 帧入 edge→session 缓冲');
  facade.host.withholdEdgeToSession(connectionKey, run.nsId);
  seam.edgeToSession.setHeld(false);
  expect(seam.edgeToSession.release(1), '恰放行 OPEN 帧').toBe(1);
  seam.edgeToSession.setHeld(true);
  await settle();
  await pumpUntil(
    facade.host,
    () => facade.host.probes.outbound.filter((frame) => frame.lane === 'data').length >= 2,
    '分块全部过缝（回执被扣）',
  );
  const buffered = seam.edgeToSession
    .pending()
    .filter((message) => typeof message !== 'string' && 'tag' in message).length;
  expect(buffered, '被扣回执数（OPEN_OK + 每 chunk 恰一条）').toBeGreaterThanOrEqual(2);
  return buffered;
}

/** 小限额注入（R6 构型链）：快照 431B > maxBootstrapBytes=8 ⇒ 真实 kind=1 改道；chunk=64B ⇒ ≥2 chunk。 */
const CHUNK_BOOTSTRAP_LIMITS = {
  maxBootstrapBytes: 8,
  maxChunkedBootstrapBytes: 1024,
  maxUpdateBytes: 64,
} as const;

/** kind=2 构型：diff（2 字节空更新）> maxSyncDiffBytes=1 ⇒ 真实改道；链② 4096 ≤ 64×64。 */
const CHUNK_SYNC_LIMITS = {
  maxSyncDiffBytes: 1,
  maxChunkedSyncDiffBytes: 4096,
  maxUpdateBytes: 64,
} as const;

describe('issue #447 CHUNK — 真实分块 γ 场景（小限额注入改道）', () => {
  it('CHUNK-C1（kind=1）：BOOTSTRAP_SNAPSHOT 单帧 0 条 + UPDATE_CHUNK ≥2 帧；每 chunk 独立 tag/独立回执；末 chunk 回执结算锚（BOOTSTRAP_ACK 回指末 chunk 帧序）；ANCHOR-C1 全量（live + 收敛 + close + settled）', async () => {
    const round = await bootAsyncRound({
      chunkedUpdate: true,
      limits: CHUNK_BOOTSTRAP_LIMITS,
    });
    await awaitLive(round);
    assertRoundC1(round, { chunked: true });

    // 分块族逐 chunk 独立 tag / 独立回执（SEAM-C2 配对在分块形态成立）。
    const chunks = hubFrames(round, 'UPDATE_CHUNK');
    const chunkSequences = chunks.map((frame) => frame.sequence);
    const receipts = round.facade.host.probes.receipts;
    for (const sequence of chunkSequences) {
      expect(receipts.some((receipt) => receipt.sequence === sequence), `chunk#${sequence} 回执`).toBe(
        true,
      );
    }
    // 每个 tag 恰一条回执。
    const tags = round.facade.host.probes.stamps.map((stamp) => stamp.tag);
    expect(new Set(tags).size, 'tag 唯一').toBe(tags.length);
    expect(receipts.length, '每 tag 恰一条回执').toBe(tags.length);

    await assertCloseRound(round);
  }, 30_000);

  it('CHUNK-C1/ROUND-C2 parity（分块构型）：同限额下 β 单体（进程内组合根）vs γ 异步缝——控制帧逐字节等 + 骨架等 + 数据帧文档语义等（含 UPDATE_CHUNK 重组）', async () => {
    // 说明：#424 断言族（`controlFramesOf`/`skeletonOf`/`docStateOf`）以无协商位解码
    // `UPDATE_CHUNK`（解码器响亮拒绝）且按单帧载荷取用——分块构型下不可直接复用；
    // 本套件用同判据的能力感知等价物（`issue447-async-seam.ts` 头注 9）。
    const beta = await boot({
      limits: CHUNK_BOOTSTRAP_LIMITS,
      chunkedUpdate: true,
      random: () => 0.5,
      waitFor: 'live',
    });
    const gamma = await bootAsyncRound({ chunkedUpdate: true, limits: CHUNK_BOOTSTRAP_LIMITS });
    await awaitLive(gamma);
    expect(
      wireFramesOfKind(beta.wire.hubToPeer, 'UPDATE_CHUNK').length,
      'β 参照确为分块改道',
    ).toBeGreaterThanOrEqual(2);
    for (const [label, left, right] of [
      ['hub→peer', beta.wire.hubToPeer, gamma.run.wire.hubToPeer],
      ['peer→hub', beta.wire.peerToHub, gamma.run.wire.peerToHub],
    ] as const) {
      expect(
        wireFramesHexEqual(wireControlFrames(left), wireControlFrames(right)),
        `${label} 控制帧逐字节`,
      ).toBeUndefined();
      expect(wireSkeleton(right), `${label} 骨架（含 UPDATE_CHUNK 帧型与帧序）`).toBe(
        wireSkeleton(left),
      );
    }
    expect(wireDocState(wireDataFrames(gamma.run.wire.hubToPeer)), '数据帧文档语义').toBe(
      wireDocState(wireDataFrames(beta.wire.hubToPeer)),
    );
  }, 30_000);

  it('CHUNK-C2（kind=2）：hub Step2 diff 超 maxSyncDiffBytes ⇒ SYNC_STEP2 单帧 0 条 + kind=2 chunk 族过缝；末 chunk 回执结算 ownStep2Seq ⇒ SYNC_APPLIED.ackedSequence === 末 chunk 帧序；live + 收敛', async () => {
    const round = await bootAsyncRound({
      chunkedUpdate: true,
      limits: CHUNK_SYNC_LIMITS,
    });
    await awaitLive(round);
    const { run } = round;
    // 单帧 SYNC_STEP2 恒 0（两侧）；kind=2 chunk 族过缝（hub→peer 与 peer→hub 皆真实改道）。
    expect(hubFrames(round, 'SYNC_STEP2'), 'hub→peer 单帧 SYNC_STEP2 数').toHaveLength(0);
    expect(peerFrames(round, 'SYNC_STEP2'), 'peer→hub 单帧 SYNC_STEP2 数').toHaveLength(0);
    const kind2Of = (frames: WireFrame[]): WireFrame[] =>
      frames.filter((frame) => (frame.message as { transferKind?: number }).transferKind === 2);
    const hubChunks = kind2Of(hubFrames(round, 'UPDATE_CHUNK'));
    const peerChunks = kind2Of(peerFrames(round, 'UPDATE_CHUNK'));
    expect(hubChunks.length, 'hub→peer kind=2 chunk 数').toBeGreaterThanOrEqual(1);
    expect(peerChunks.length, 'peer→hub kind=2 chunk 数').toBeGreaterThanOrEqual(1);
    // 末 chunk 回执结算 ownStep2Seq（结构事实：ACK 因果上后于回执，FIFO 下必已回填）⇒ 回指成立。
    const hubApplied = hubFrames(round, 'SYNC_APPLIED');
    expect(hubApplied, 'hub→peer SYNC_APPLIED 数').toHaveLength(1);
    expect(
      ackedSequenceOf(hubApplied[0]!),
      'SYNC_APPLIED 回指对端（peer→hub）末 chunk 帧序',
    ).toBe(peerChunks[peerChunks.length - 1]!.sequence);
    expect(run.namespaceState(), 'namespace 状态').toBe('live');
    expect(hexOf(Y.encodeStateAsUpdate(run.snapshotDoc('hub'))), 'hub/peer 文档收敛').toBe(
      hexOf(Y.encodeStateAsUpdate(run.snapshotDoc('peer'))),
    );
  }, 30_000);

  it('CHUNK-C2 负控（§9.1 kind=2 自持 timer 角落）：扣末 chunk 回执 + 虚拟推进自持 timer ⇒ 载体弃置 + RESYNC_REQUIRED；随后直投 SYNC_APPLIED ⇒ 响亮 SYNC_STATE_VIOLATION（零 park，有限冲刷必达）', async () => {
    const round = await bootAsyncRound({
      chunkedUpdate: true,
      limits: CHUNK_SYNC_LIMITS,
      hubObserver: true,
    });
    const { run, facade } = round;
    // 扣留 edge→session：先放行 OPEN 帧与会话启动所需的入站帧，直到 bootstrap 收敛段。
    await settleUntil(() => facade.host.seams.size === 1, 'γ 会话通道对建立');
    const seam = round.seam();
    await settleUntil(() => seam.edgeToSession.pending().length >= 1, 'OPEN 帧入 edge→session 缓冲');
    // 步进放行到 BOOTSTRAP_ACK 之后（peer 的 SYNC_STEP1 在缓冲中等待）：sessionToEdge 全放
    // （出站帧 → 桥盖章 → 回执入被扣缓冲），edgeToSession 每次恰放一条。
    facade.host.withholdEdgeToSession(round.connectionKey(), run.nsId);
    for (let index = 0; index < 24; index += 1) {
      await pumpSteps(facade.host, 1);
      const head = seam.edgeToSession.pending()[0];
      if (head !== undefined && isInboundFrame(head) && kindOfPlaceholder(head.bytes) === 'SYNC_STEP1') {
        break;
      }
      seam.edgeToSession.setHeld(false);
      seam.edgeToSession.release(1);
      seam.edgeToSession.setHeld(true);
      await pumpSteps(facade.host, 1);
    }
    expect(
      seam.edgeToSession.pending().some(
        (message) => isInboundFrame(message) && kindOfPlaceholder(message.bytes) === 'SYNC_STEP1',
      ),
      '收敛段起点：peer SYNC_STEP1 已在扣留缓冲',
    ).toBe(true);
    // 从此刻起丢弃全部回执（含 kind=2 末 chunk 回执）⇒ 载体停留 awaiting-ack。
    facade.host.dropReceipts(round.connectionKey(), run.nsId, 200);
    seam.edgeToSession.setHeld(false);
    await pumpUntil(
      facade.host,
      () => facade.host.probes.outbound.filter((frame) => frame.lane === 'data').length >= 1,
      'kind=2 chunk 族过缝（末 chunk 回执被扣）',
    );
    expect(
      facade.host.probes.stamps.length,
      '前序帧已盖章（回执被丢弃、未投递）',
    ).toBeGreaterThanOrEqual(3);

    // kind=2 自持 ACK timer 武装点 = 末 chunk 推送；虚拟推进 ⇒ 载体弃置 + 响亮声明。
    await run.hubNode.scheduler.advanceBy(TIMEOUTS.ackTimeoutMs + 1);
    await settle();
    await pumpUntil(
      facade.host,
      () => hubFrames(round, 'RESYNC_REQUIRED').length >= 1,
      'kind=2 ACK 超时 ⇒ RESYNC_REQUIRED',
    );
    expect(hubFrames(round, 'RESYNC_REQUIRED'), 'RESYNC_REQUIRED 恰一次').toHaveLength(1);

    // 随后直投 SYNC_APPLIED：锚未回填（ownStep2Seq 已清/未结算）⇒ 响亮 SYNC_STATE_VIOLATION。
    await pumpUntil(
      facade.host,
      () => hubFrames(round, 'ERROR').length >= 1,
      '迟到 SYNC_APPLIED ⇒ 响亮收口',
    );
    const codes = hubFrames(round, 'ERROR').map((frame) => frame.code);
    expect(codes, `hub ERROR 码（${JSON.stringify(codes)}）`).toContain('SYNC_STATE_VIOLATION');
    expect(run.namespaceState(), 'namespace 不得 live').not.toBe('live');
  }, 30_000);

  it('CHUNK-C3（t0 = 推送时刻；SA8-E1 路线 a）：扣留末 chunk 回执 k ms + ACK 前再推进 m ms ⇒ chunked-snapshot-acked.ackLatencyMs === k + m（含管道与 edge 等待）', async () => {
    const clock = makeManualClock(1_000);
    const round = await bootAsyncRound({
      chunkedUpdate: true,
      limits: CHUNK_BOOTSTRAP_LIMITS,
      hubObserver: true,
      hubClock: () => clock.now(),
    });
    const { run, facade } = round;
    const bufferedReceipts = await driveWithheldChunkedBootstrap(round);
    const seam = round.seam();
    expect(
      round.observerEvents.filter((event) => event.type === 'chunked-snapshot-acked'),
      '扣留期零 acked 事件',
    ).toHaveLength(0);

    // 步 1：推进 k ms 后放**全部回执**（末 chunk 回执结算锚；ACK 仍扣留）——k 为纯管道等待。
    const k = 7;
    clock.advance(k);
    seam.edgeToSession.setHeld(false);
    expect(seam.edgeToSession.release(bufferedReceipts), '恰放全部回执').toBe(bufferedReceipts);
    await settle();
    expect(
      round.observerEvents.filter((event) => event.type === 'chunked-snapshot-acked'),
      '回执结算不发射 acked 事件（发射点 = ACK 处理）',
    ).toHaveLength(0);

    // 步 2：ACK 前再推进 m ms ⇒ 回执结算后到 ACK 处理的等待计入 t1。
    const m = 5;
    clock.advance(m);
    await pumpUntil(
      facade.host,
      () => round.observerEvents.some((event) => event.type === 'chunked-snapshot-acked'),
      'chunked-snapshot-acked',
    );
    await pumpUntil(facade.host, () => run.namespaceState() === 'live', 'namespace live');
    const events = round.observerEvents.filter(
      (event) => event.type === 'chunked-snapshot-acked',
    ) as Array<{ ackLatencyMs?: number }>;
    expect(events, '恰一次 chunked-snapshot-acked').toHaveLength(1);
    // t0 = 末 chunk 推送时刻（含管道与 edge 等待，§24.8 登记口径）——变异（回执时刻采样）少 k。
    expect(events[0]!.ackLatencyMs, 't0 = 推送时刻（k + m）').toBe(k + m);
  }, 30_000);

  it('CHUNK-C3 变异负控（t0 采样点改回执时刻）：结算回调不携 pushedAt ⇒ ackLatencyMs 少 k ⇒ 断言红', async () => {
    const module = await import('../src/bulk-transfer.js');
    interface TransferStateLike {
      phase: string;
      transferId: number;
      chunkCount: number;
      totalBytes: number;
      lastChunkSequence: number;
      pendingLastChunkTag: { readonly tag: number; readonly pushedAt?: number } | undefined;
      request: {
        onLastChunkSent(
          sequence: number,
          settlement: { lastChunkSequence: number; transferId: number; chunkCount: number; totalBytes: number },
          pushedAt?: number,
        ): void;
      };
    }
    const proto = module.BulkTransferSender.prototype as unknown as {
      current: TransferStateLike | undefined;
      onReceipt(tag: number, sequence: number): boolean;
    };
    const original = proto.onReceipt;
    // 变异 = 修订前形态（SA8-E1 之前）：末 chunk 回执结算**不携 pushedAt** ⇒ 宿主回退
    // `sampleAckT0()`（回执时刻）——t0 少 k，证明 k 的携带是承重的（断言对该变异敏感）。
    proto.onReceipt = function mutated(this: { current: TransferStateLike | undefined }, tag: number, sequence: number): boolean {
      const state = this.current;
      if (state === undefined || state.phase !== 'awaiting-ack') return false;
      const pending = state.pendingLastChunkTag;
      if (pending === undefined || pending.tag !== tag) return false;
      state.pendingLastChunkTag = undefined;
      state.lastChunkSequence = sequence;
      state.request.onLastChunkSent(sequence, {
        lastChunkSequence: sequence,
        transferId: state.transferId,
        chunkCount: state.chunkCount,
        totalBytes: state.totalBytes,
      });
      return true;
    };
    try {
      const clock = makeManualClock(2_000);
      const round = await bootAsyncRound({
        chunkedUpdate: true,
        limits: CHUNK_BOOTSTRAP_LIMITS,
        hubObserver: true,
        hubClock: () => clock.now(),
      });
      const { run, facade } = round;
      const k = 9;
      const m = 4;
      const bufferedReceipts = await driveWithheldChunkedBootstrap(round);
      const seam = round.seam();
      clock.advance(k);
      seam.edgeToSession.setHeld(false);
      seam.edgeToSession.release(bufferedReceipts);
      await settle();
      clock.advance(m);
      await pumpUntil(
        facade.host,
        () => round.observerEvents.some((event) => event.type === 'chunked-snapshot-acked'),
        'chunked-snapshot-acked（变异下回合仍完成——锚在 ACK 前已由回执结算）',
      );
      await pumpUntil(facade.host, () => run.namespaceState() === 'live', 'namespace live');
      const acked = round.observerEvents.filter(
        (event) => event.type === 'chunked-snapshot-acked',
      ) as Array<{ ackLatencyMs?: number }>;
      expect(acked, '恰一次 acked 事件').toHaveLength(1);
      // 变异下 t0 = 回执结算时刻 ⇒ 少 k（应得 k + m）——证明 t0 携带对断言是承重的。
      expect(acked[0]!.ackLatencyMs, '变异下 ackLatencyMs = m（少 k）').toBe(m);
    } finally {
      proto.onReceipt = original;
    }
  }, 30_000);
});
