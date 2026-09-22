/**
 * SA6 最小复现 / 能力缺口探针 — issue #447（γ-T1）：
 * 「γ 公共会话工厂/句柄 + 延迟可注入异步 FIFO 管道夹具 + 首个跨缝协议回合（OPEN→bootstrap→close）」。
 *
 * 这是**诊断与验收契约的可执行证据**，不是 issue #447 的交付实现（交付验收套件见契约报告
 * §12：`packages/ws-replication/test/ws-replication-issue447-*.test.ts` + `-api.test-d.ts`，
 * 由设计与实现票落地）。dispatch 明示「produce only your acceptance-contract artifact」
 * ——本文件不在 vitest include 面内（`wiki/raw/**`），只作探针运行，不修改任何生产代码。
 *
 * 运行（真实源码；期望 GAP 全数成立 + ORACLE/NC 全绿，exit 0）：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-447_sa6_capability_probe.mts
 *
 * 规范依据（本探针只观察已冻结事实，不发明行为）：
 *   - ADR 0032 附录 A4（`docs/adr/0032-transport-decoupling-edge-session-split.md:55-99`）；
 *   - 协议 §24（`docs/protocols/instance-replication-v1.md:1091-1154`）——γ 缝消息词汇、
 *     宿主传输义务、两相记账、三态锚；
 *   - issue #447 简报（`wiki/raw/task_issue-447.md:15-28`）。
 *
 * 检查 id 与契约报告 `task_issue-447_sa6_contract.md` §5/§12 对应：
 *   GAP-1  γ 公共工厂/句柄面零导出（`src/index.ts` 运行时导出 15 个 = β 冻结集）
 *   GAP-2  β 句柄无回执消费成员（`handleReceipt` 缺席；公共成员 = 5）
 *   GAP-3  γ 缝词汇在 `src/**` 零命中（receipt/tag/frame{tag…}），且跨线程面零依赖约束保持
 *   GAP-4  无「每 (连接, namespace) 一对专用 FIFO 通道 + 延迟可注入」夹具（src/testing 与 test 面）
 *   GAP-5  盖章点已同步携带序号，但 edge 未接线回执（mux 钩子被丢弃 = 回执生产点缺席）
 *   GAP-6  `bootstrapSnapshotSeq` 两态（undefined | number）——三态扩面缺席（源码锚）
 *   ORACLE-1 β 形态 OPEN→bootstrap→close 整回合 golden wire trace（字节 + skeleton + 摘要）
 *   ORACLE-2 同场景复跑确定性（控制帧字节等 + skeleton 等；数据帧按 424 口径的语义等）
 *   ORACLE-3 β 同步签名不可承载异步中继（返回 0 = 未发送/被拒）→ 响亮 `ACK_STATE_VIOLATION`
 *           （= γ 负控「保序条款被违反而非 park」断言在既有实现上敏感）
 *   NC-1    严格逐字节全帧比对对场景内容敏感（内容变 → 差异字符串；控制帧仍逐字节等）
 */
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const WS = new URL('packages/ws-replication/', ROOT);
/** 与 harness 同一 ESM 实例（经包 node_modules 符号链接 → 同一 realpath，避免双 Yjs 实例）。 */
const Y = (await import(
  new URL('packages/ws-replication/node_modules/yjs/dist/yjs.mjs', ROOT).href
)) as typeof import('yjs');

const indexMod = (await import(new URL('packages/ws-replication/src/index.ts', ROOT).href)) as Record<
  string,
  unknown
>;
const testingMod = (await import(
  new URL('packages/ws-replication/src/testing.ts', ROOT).href
)) as Record<string, unknown>;
const frameIo = (await import(new URL('packages/ws-replication/src/frame-io.ts', ROOT).href)) as {
  OutboundQueue: new (
    emitRaw: (bytes: Uint8Array, sequence: number) => void,
    limits: unknown,
    onSequenceExhausted?: () => void,
    onEmitted?: (info: { kind: 'control' | 'data'; byteLength: number }) => void,
  ) => {
    emitFrame(frame: Uint8Array): number;
    sendControlFrame(frame: Uint8Array): number;
  };
};
const defaults = (await import(
  new URL('packages/ws-replication/src/defaults.ts', ROOT).href
)) as Record<string, unknown>;

const sharded = (await import(
  new URL('packages/ws-replication/test/issue424-sharded-hub.ts', ROOT).href
)) as Record<string, any>;
const driver = (await import(new URL('packages/ws-replication/test/driver.ts', ROOT).href)) as Record<
  string,
  any
>;
const harness = (await import(new URL('packages/ws-replication/test/harness.ts', ROOT).href)) as Record<
  string,
  any
>;

const { boot, collectUnhandledRejections } = driver;
const { settle, settleUntil } = harness;
const { createHubSessionHost, DEFAULT_REPLICATION_LIMITS, DEFAULT_REPLICATION_TIMEOUTS } = indexMod as {
  createHubSessionHost: (config: any) => { open(input: any): any };
  DEFAULT_REPLICATION_LIMITS: any;
  DEFAULT_REPLICATION_TIMEOUTS: any;
};

// ═══════════════════════════ 结果账 ═══════════════════════════

const gaps: Array<{ id: string; ok: boolean; detail: string }> = [];
const oracles: Array<{ id: string; ok: boolean; detail: string }> = [];

async function gap(id: string, run: () => Promise<string> | string): Promise<void> {
  try {
    const detail = await run();
    gaps.push({ id, ok: true, detail });
    console.log(`GAP   ${id} CONFIRMED  ${detail}`);
  } catch (err) {
    gaps.push({ id, ok: false, detail: (err as Error).message });
    console.log(`GAP   ${id} NOT-CONFIRMED  ${(err as Error).message}`);
  }
}

async function oracle(id: string, run: () => Promise<string> | string): Promise<void> {
  try {
    const detail = await run();
    oracles.push({ id, ok: true, detail });
    console.log(`ORACLE ${id} GREEN  ${detail}`);
  } catch (err) {
    oracles.push({ id, ok: false, detail: (err as Error).message });
    console.log(`ORACLE ${id} RED  ${(err as Error).message}`);
  }
}

const sha256 = (chunks: readonly Uint8Array[]): string => {
  const hash = createHash('sha256');
  for (const chunk of chunks) hash.update(chunk);
  return hash.digest('hex');
};

const sourceOf = (relative: string): string =>
  readFileSync(new URL(relative, ROOT), { encoding: 'utf8' });

// ═══════════════════════════ GAP：能力缺口（现状缺面） ═══════════════════════════

await gap('GAP-1', () => {
  const names = Object.keys(indexMod).sort();
  const gammaLike = names.filter((name) => /receipt|async|gamma|tag|pipe|fifo/i.test(name));
  assert.deepEqual(
    gammaLike,
    [],
    `src/index.ts 出现 γ 候选导出：${JSON.stringify(gammaLike)}`,
  );
  // β 冻结集（#420/#421/#422 已发布面）——append-only 基线，本轮实测 15 个。
  assert.equal(names.length, 15, `运行时导出数 = ${names.length}（期望 β 冻结集 15）`);
  return `运行时导出 ${names.length} 个，γ 候选 0；β 冻结集 = ${JSON.stringify(names)}`;
});

await gap('GAP-2', () => {
  const host = createHubSessionHost({
    registry: {},
    instanceId: 'hub-probe',
    limits: DEFAULT_REPLICATION_LIMITS,
    timeouts: DEFAULT_REPLICATION_TIMEOUTS,
    timer: { setTimeout: () => 0, clearTimeout: () => {} },
  });
  const handle = host.open({
    connectionKey: 'probe-conn',
    remoteInstanceId: 'peer-probe',
    namespaceId: `ns-${'0'.repeat(32)}`,
    authorization: { ok: true, localOwner: true, permissions: { read: true, submit: true } },
    selectedCapabilities: 0,
  });
  assert.equal(typeof handle.handleReceipt, 'undefined', 'β 句柄竟已有 handleReceipt');
  assert.equal(typeof handle.onReceipt, 'undefined', 'β 句柄竟已有 onReceipt');
  const publicMembers = Object.getOwnPropertyNames(Object.getPrototypeOf(handle))
    .filter((name) => !/^(constructor|deliverFrame|emitConnectionFatal|emitSignal|makePort)$/.test(name))
    .sort();
  assert.deepEqual(
    publicMembers,
    ['close', 'handleFrame', 'onFrame', 'onSignal', 'terminateUnauthorized'],
    `β 公共成员集变化：${JSON.stringify(publicMembers)}`,
  );
  return `β 句柄公共成员 = ${JSON.stringify(publicMembers)}；handleReceipt 缺席（第三 port 形态 = 0）`;
});

await gap('GAP-3', () => {
  const files = readdirSync(new URL('packages/ws-replication/src', ROOT)).filter((name) =>
    name.endsWith('.ts'),
  );
  const patterns: ReadonlyArray<readonly [string, RegExp]> = [
    ['receipt', /receipt/i],
    ['handleReceipt', /handleReceipt/],
    ['tag-token', /\btag\b/],
    ['frame{tag', /frame\s*\{\s*tag/],
    ['ConnectionSender-tag', /tag\s*:\s*(?:number|string)/],
  ];
  const hits: string[] = [];
  for (const name of files) {
    const text = sourceOf(`packages/ws-replication/src/${name}`);
    for (const [label, pattern] of patterns) {
      if (pattern.test(text)) hits.push(`${name}:${label}`);
    }
  }
  assert.deepEqual(hits, [], `src/** 出现 γ 缝词汇：${JSON.stringify(hits)}`);
  // 跨线程面零依赖约束（ADR A4.1）——现状保持，γ 必须继续保持。
  const threadPattern = /worker_threads|MessageChannel|MessagePort/u;
  const threadHits = files.filter((name) =>
    threadPattern.test(sourceOf(`packages/ws-replication/src/${name}`)),
  );
  assert.deepEqual(threadHits, [], `src/** 出现跨线程面 API：${JSON.stringify(threadHits)}`);
  return `src/** ${files.length} 文件：γ 缝词汇命中 0（${patterns.map(([l]) => l).join('/')}）；跨线程面命中 0`;
});

await gap('GAP-4', () => {
  const testingNames = Object.keys(testingMod).sort();
  const pipeLike = testingNames.filter((name) => /pipe|fifo|delay|latency|pump/i.test(name));
  assert.deepEqual(pipeLike, [], `src/testing.ts 出现管道类导出：${JSON.stringify(pipeLike)}`);
  const testFiles = readdirSync(new URL('packages/ws-replication/test', ROOT)).filter((name) =>
    /\.(test|test-d)\.ts$/.test(name),
  );
  const issue447 = testFiles.filter((name) => /447/.test(name));
  assert.deepEqual(issue447, [], `已存在 #447 验收文件：${JSON.stringify(issue447)}`);
  const fixtureHits: string[] = [];
  for (const name of testFiles) {
    const text = sourceOf(`packages/ws-replication/test/${name}`);
    if (/handleReceipt|\breceipt\b/i.test(text)) fixtureHits.push(`${name}:receipt`);
    if (/injectLatency|latencyMs\s*:\s*number.*pipe|FifoChannel|AsyncPipe/i.test(text)) {
      fixtureHits.push(`${name}:latency-pipe`);
    }
  }
  assert.deepEqual(fixtureHits, [], `test/** 出现 γ 夹具痕迹：${JSON.stringify(fixtureHits)}`);
  return `testing 导出 ${testingNames.length} 个（无管道/延迟类）；test/** ${testFiles.length} 文件：receipt/延迟管道夹具命中 0；#447 验收文件 0`;
});

await gap('GAP-5', () => {
  const hookArgs: Array<readonly [number, number]> = [];
  const queue = new frameIo.OutboundQueue(
    (bytes, sequence) => {
      hookArgs.push([bytes.byteLength, sequence]);
    },
    DEFAULT_REPLICATION_LIMITS,
  );
  const dataFrame = new Uint8Array(64);
  const controlFrame = new Uint8Array(48);
  const dataSeq = queue.emitFrame(dataFrame);
  const controlSeq = queue.sendControlFrame(controlFrame);
  assert.equal(dataSeq, 1, `data 盖章序 = ${dataSeq}`);
  assert.equal(controlSeq, 2, `control 盖章序 = ${controlSeq}`);
  assert.deepEqual(
    hookArgs,
    [
      [64, 1],
      [48, 2],
    ],
    `mux 钩子参数 = ${JSON.stringify(hookArgs)}`,
  );
  // 每次盖章同步可见于 emitRaw 钩子——但 edge 侧把该钩子接成 (bytes) => transport.send(bytes)，
  // 序号被丢弃 ⇒ 缝上无回执生产点。
  const edge = sourceOf('packages/ws-replication/src/hub-edge.ts');
  assert.ok(
    /new OutboundQueue\([\s\S]{0,200}\(bytes\)\s*=>\s*\{[\s\S]{0,120}transport\.send\(bytes\)/.test(edge),
    'edge 的 emitRaw 接线形态与报告锚（hub-edge.ts:195-202）不符',
  );
  assert.ok(!/receipt/i.test(edge), 'hub-edge.ts 竟已含 receipt');
  return `mux 钩子同步拿到盖章序（${JSON.stringify(hookArgs)}），但 hub-edge.ts 的 emitRaw 丢弃序号（无回执生产点）`;
});

await gap('GAP-6', () => {
  const ns = sourceOf('packages/ws-replication/src/hub-namespace.ts');
  assert.ok(
    /private bootstrapSnapshotSeq: number \| undefined;/.test(ns),
    'bootstrapSnapshotSeq 声明形态变化',
  );
  const writes = [...ns.matchAll(/this\.bootstrapSnapshotSeq = ([^;]+);/g)].map((m) => m[1]!.trim());
  assert.deepEqual(
    writes,
    ['lastChunkSequence', 'seq > 0 ? seq : undefined', 'undefined'],
    `bootstrapSnapshotSeq 写点 = ${JSON.stringify(writes)}`,
  );
  const discriminators = [...ns.matchAll(/this\.bootstrapSnapshotSeq === undefined/g)].length;
  assert.equal(discriminators, 1, `undefined 判别点 = ${discriminators}`);
  return `两态（undefined | number）；写点 = ${JSON.stringify(writes)}；undefined 判别 1 处（ACK_STATE_VIOLATION）；无 pending 中间态`;
});

// ═══════════════════════════ ORACLE：β 形态 golden 回合与敏感负控 ═══════════════════════════

interface BetaRound {
  readonly run: any;
  readonly facade: any;
  readonly hubToPeer: readonly Uint8Array[];
  readonly peerToHub: readonly Uint8Array[];
  readonly digestHubToPeer: string;
  readonly digestPeerToHub: string;
  readonly skeletonHubToPeer: string;
  readonly skeletonPeerToHub: string;
}

async function betaRound(opts: { chunkedUpdate?: boolean; hubRootN?: number } = {}): Promise<BetaRound> {
  let facade: any;
  const run = await boot({
    // 确定性连接 nonce：HELLO.connectionNonce 由注入 random() 生成（peer-connection.ts:409-413），
    // HELLO_ACK 回显之——不钉死则跨 run 逐字节比对恒假红（非契约面）。
    random: () => 0.5,
    ...(opts.chunkedUpdate === undefined ? {} : { chunkedUpdate: opts.chunkedUpdate }),
    ...(opts.hubRootN === undefined ? {} : { hubRoot: { n: opts.hubRootN, extra: 77 } }),
    createHub: (options: any) => {
      facade = sharded.makeShardedReplicationFacade(options);
      return facade.replication;
    },
  });
  assert.ok(facade !== undefined, 'β facade 未被 boot 调用');
  // ROUND 装配前提（同 #424 §12.2）：会话宿主 registry 必须 === boot hub registry（同一对象）。
  assert.equal(facade.worker.registry, run.hubNode.registry, 'β 装配前提：registry 引用不同一');
  // OPEN→bootstrap 阶段（boot 默认等待 live）。
  const snapshots = run.hubFrames('BOOTSTRAP_SNAPSHOT');
  assert.equal(snapshots.length, 1, `BOOTSTRAP_SNAPSHOT 数 = ${snapshots.length}`);
  const bootstrapAcks = run.peerFrames('BOOTSTRAP_ACK');
  assert.equal(bootstrapAcks.length, 1, `peer BOOTSTRAP_ACK 数 = ${bootstrapAcks.length}`);
  assert.equal(
    bootstrapAcks[0].message.ackedSequence,
    snapshots[0].header.sequence,
    'BOOTSTRAP_ACK 未回指快照帧序',
  );
  assert.equal(run.namespaceState(), 'live', `namespace 状态 = ${String(run.namespaceState())}`);
  // close 回合。
  await run.peer.removeTarget(run.nsId);
  await settleUntil(() => run.hubFrames('CLOSE_OK').length >= 1, 'CLOSE_OK');
  await settle();
  const closeRequests = run.peerFrames('CLOSE_NAMESPACE');
  const closeOks = run.hubFrames('CLOSE_OK');
  assert.equal(closeRequests.length, 1, `CLOSE_NAMESPACE 数 = ${closeRequests.length}`);
  assert.equal(closeOks.length, 1, `CLOSE_OK 数 = ${closeOks.length}`);
  assert.equal(closeOks[0].message.ackedSequence, closeRequests[0].header.sequence, 'CLOSE_OK 未回指');
  const timeline = run.timeline();
  const hubToPeer = timeline.filter((item: any) => item.direction === 'hub-to-peer').map((item: any) => item.bytes);
  const peerToHub = timeline.filter((item: any) => item.direction === 'peer-to-hub').map((item: any) => item.bytes);
  return {
    run,
    facade,
    hubToPeer,
    peerToHub,
    digestHubToPeer: sha256(hubToPeer),
    digestPeerToHub: sha256(peerToHub),
    skeletonHubToPeer: sharded.skeletonOf(hubToPeer),
    skeletonPeerToHub: sharded.skeletonOf(peerToHub),
  };
}

let roundA: BetaRound | undefined;
let roundB: BetaRound | undefined;

await oracle('ORACLE-1', async () => {
  roundA = await betaRound();
  const convergence =
    Buffer.from(Y.encodeStateAsUpdate(roundA.run.snapshotDoc('hub'))).toString('hex') ===
    Buffer.from(Y.encodeStateAsUpdate(roundA.run.snapshotDoc('peer'))).toString('hex');
  assert.ok(convergence, 'hub/peer 文档未收敛');
  assert.ok(/BOOTSTRAP_SNAPSHOT#\d+/.test(roundA.skeletonHubToPeer), 'skeleton 缺 BOOTSTRAP_SNAPSHOT');
  assert.ok(/CLOSE_OK#\d+/.test(roundA.skeletonHubToPeer), 'skeleton 缺 CLOSE_OK');
  const controlSha = sha256(sharded.controlFramesOf(roundA.hubToPeer));
  return `golden trace：hub→peer ${roundA.hubToPeer.length} 帧 sha256=${roundA.digestHubToPeer.slice(0, 16)}…（控制帧子集 sha256=${controlSha.slice(0, 16)}…）；peer→hub ${roundA.peerToHub.length} 帧 sha256=${roundA.digestPeerToHub.slice(0, 16)}…；skeleton(hub→peer)=${roundA.skeletonHubToPeer}`;
});

await oracle('ORACLE-2', async () => {
  roundB = await betaRound();
  const context = roundB;
  assert.ok(roundA !== undefined, 'ORACLE-1 未先运行');
  const controlDiff = sharded.framesHexEqual(
    sharded.controlFramesOf(roundA.hubToPeer),
    sharded.controlFramesOf(context.hubToPeer),
  );
  assert.equal(controlDiff, undefined, `控制帧字节差异：${String(controlDiff)}`);
  assert.equal(roundA.skeletonHubToPeer, context.skeletonHubToPeer, 'skeleton(hub→peer) 不同');
  assert.equal(roundA.skeletonPeerToHub, context.skeletonPeerToHub, 'skeleton(peer→hub) 不同');
  const fullDiff = sharded.framesHexEqual(roundA.hubToPeer, context.hubToPeer);
  return `复跑确定性：控制帧逐字节等；skeleton 等；全帧差异 = ${fullDiff === undefined ? '无（连数据帧字节也等）' : fullDiff + '（Yjs clientID 随机，符合 #424 口径）'}；摘要 A=${roundA.digestHubToPeer.slice(0, 12)}… B=${context.digestHubToPeer.slice(0, 12)}…`;
});

await oracle('ORACLE-3', async () => {
  // γ 反证：β 的同步签名「监听者同步返回被分配 wire 序」不能承载异步中继。
  // 装配一个**异步中继宿主桥**（帧真实送到 edge 盖章，但对 session 回传 0 = 未发送/被拒）。
  let facade: any;
  const events: any[] = [];
  const run = await boot({
    waitFor: 'handshake',
    random: () => 0.5,
    hubObserver: (event: any) => events.push(event),
    createHub: (options: any) => {
      const inner = createHubSessionHost({
        registry: options.registry,
        instanceId: options.instanceId,
        limits: sharded.LIMITS,
        timeouts: sharded.TIMEOUTS,
        timer: options.timer,
      });
      const relayed: number[] = [];
      const asyncHost = {
        open(input: any) {
          const handle = inner.open(input);
          return {
            handleFrame: (frame: Uint8Array) => handle.handleFrame(frame),
            onFrame: (listener: any) =>
              handle.onFrame((frame: Uint8Array, lane: 'control' | 'data') => {
                relayed.push(frame.byteLength);
                // 异步中继（模拟「跨线程：先投管道、回执后到」）——对 session 立即回 0。
                queueMicrotask(() => {
                  listener(frame, lane);
                });
                return 0;
              }),
            onSignal: (listener: any) => handle.onSignal(listener),
            terminateUnauthorized: () => handle.terminateUnauthorized(),
            close: () => handle.close(),
          };
        },
      };
      const worker = { index: 0, registry: options.registry, host: asyncHost };
      const host = sharded.makeShardedHost(() => worker, {
        authorize: options.authorize,
        ...(options.verifyToken === undefined ? {} : { verifyToken: options.verifyToken }),
        timer: options.timer,
      });
      facade = {
        replication: {
          accept: (transport: any, request: any) => host.accept(transport, request),
          acceptTrusted: (transport: any, identity: any) => host.acceptTrusted(transport, identity),
          get connections() {
            return [...host.connections.values()];
          },
          revoke: async () => undefined,
          requestReauth: () => undefined,
          close: () => Promise.resolve(),
        },
        host,
        worker,
      };
      return facade.replication;
    },
  });
  await settleUntil(
    () => run.hubFrames('ERROR').length >= 1 || run.connectionState() === 'closed',
    '异步中继宿主的响亮收口',
  );
  await settle();
  const errors = run.hubFrames('ERROR');
  const codes = errors.map((frame: any) => frame.message.code);
  // edge 主动收口 ⇒ **对端**（peer 端）观测到 close；hub 端 closeInfo 仅在 peer 主动断开时写入。
  const closeInfo = run.wires[0]?.peerSideCloseInfo;
  const fatalSignals = facade.host.probes.signals.filter((signal: string) =>
    signal.startsWith('connection-fatal'),
  );
  assert.equal(run.namespaceState() === 'live', false, '异步中继形态竟到达 live');
  assert.deepEqual(codes, ['ACK_STATE_VIOLATION'], `ERROR 码 = ${JSON.stringify(codes)}`);
  assert.equal(closeInfo?.code, 1002, `peer 观测 close code = ${String(closeInfo?.code)}`);
  assert.ok(fatalSignals.length >= 1, '未观测到 connection-fatal 信号');
  // β 的 0 值语义（「未发送/被拒」）在该实验里被判为致命违反——即 γ 需要新 port 形态。
  return `异步中继下 β 响亮收口：ERROR=${JSON.stringify(codes)}，close=${String(closeInfo?.code)}/${String(closeInfo?.reason)}，fatal 信号 = ${JSON.stringify(fatalSignals)}；namespace 未 live（保序条款违反 = 响亮失败而非 park）`;
});

await oracle('NC-1', async () => {
  assert.ok(roundA !== undefined, 'ORACLE-1 未先运行');
  const mutated = await betaRound({ hubRootN: 43 });
  const controlDiff = sharded.framesHexEqual(
    sharded.controlFramesOf(roundA.hubToPeer),
    sharded.controlFramesOf(mutated.hubToPeer),
  );
  assert.equal(controlDiff, undefined, `控制帧本应不受内容影响，却出现：${String(controlDiff)}`);
  const fullDiff = sharded.framesHexEqual(roundA.hubToPeer, mutated.hubToPeer);
  assert.notEqual(fullDiff, undefined, '场景内容变化后全帧逐字节比对仍等于（断言恒真，无敏感性）');
  assert.notEqual(roundA.digestHubToPeer, mutated.digestHubToPeer, '内容变化未反映到摘要');
  return `内容变异（hubRoot.n 42→43）：全帧比对给出差异「${String(fullDiff)}」且摘要变化（断言敏感）；控制帧仍逐字节等`;
});

// ═══════════════════════════ 未处理拒绝卫生 + 结果与退出码 ═══════════════════════════

const unhandled = collectUnhandledRejections();
await settle();
unhandled.dispose();
assert.deepEqual(unhandled.events, [], `unhandled rejection：${JSON.stringify(unhandled.events)}`);

const gapsConfirmed = gaps.filter((entry) => entry.ok).length;
const failedOracles = oracles.filter((entry) => !entry.ok);
console.log(`SA6_PROBE_RESULT gaps=${gapsConfirmed}/${gaps.length} oracles=${oracles.length - failedOracles.length}/${oracles.length}`);
if (gapsConfirmed !== gaps.length) {
  console.log('SA6_PROBE_VERDICT=REJECT (能力缺口未确认)');
  process.exitCode = 1;
} else if (failedOracles.length > 0) {
  console.log(`SA6_PROBE_VERDICT=ORACLE_RED (${failedOracles.map((entry) => entry.id).join(',')})`);
  process.exitCode = 2;
} else {
  console.log('SA6_PROBE_VERDICT=CONFIRMED (能力缺口成立；目标行为 oracle 全绿)');
}
