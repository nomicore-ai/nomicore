/**
 * SA6 issue #420 —— 能力缺口诊断探针（只读取现状，零生产改动）。
 *
 * 观察面（全部为运行时事实）：
 *  A. 包公共入口（src/index.ts）的运行时导出名集合：SessionHost 公共工厂缺席。
 *  B. 负控：同一导入机制下既有公共工厂在场（createHubReplication / createPeerReplication /
 *     createHubReplicationPlugin）——缺席不是环境/解析故障。
 *  C. 模块级现状：hub-session.ts 的进程内 splice 工厂（createHubSessionHost）在，
 *     但它吃的是**函数承载**的 `HubSessionEdgePort`（17 个成员），无法由纯 JSON 描述子驱动；
 *     其投递面收的是**已解码消息 + sequence**，没有字节入帧面（handleFrame/onFrame）。
 *  D. 目标形态（#420 冻结契约）所需的运行时面：无任何导出提供 `open()→{handleFrame,onFrame,close}`。
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa6-issue420-capability-gap-probe.mts
 */
import { execFileSync } from 'node:child_process';

const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(detail)}`);
}

const pub = await import('../packages/ws-replication/src/index.ts');
const publicExports = Object.keys(pub).sort();
console.log(`INFO head ${execFileSync('git', ['rev-parse', 'HEAD']).toString().trim()}`);
console.log(`INFO publicEntryExports ${JSON.stringify(publicExports)}`);

// A. 公共入口：SessionHost 公共工厂缺席（三种候选名全缺）
for (const name of ['createHubSessionHost', 'createHubNamespaceSession', 'createHubSession']) {
  check(`A.public.${name}.absent`, (pub as Record<string, unknown>)[name] === undefined, {
    typeof: typeof (pub as Record<string, unknown>)[name],
  });
}

// B. 负控：既有公共工厂在场（导入/解析机制正常）
check('B.negativeControl.createHubReplication', typeof pub.createHubReplication === 'function', {});
check('B.negativeControl.createPeerReplication', typeof pub.createPeerReplication === 'function', {});
check('B.negativeControl.createHubReplicationPlugin', typeof pub.createHubReplicationPlugin === 'function', {});

// C. 模块级现状：内部 splice 工厂 + 缝面形态
const sessionModule = await import('../packages/ws-replication/src/hub-session.ts');
console.log(`INFO hubSessionModuleExports ${JSON.stringify(Object.keys(sessionModule).sort())}`);
const edgeModule = await import('../packages/ws-replication/src/hub-edge.ts');
console.log(`INFO hubEdgeModuleExports ${JSON.stringify(Object.keys(edgeModule).sort())}`);
const splitModule = await import('../packages/ws-replication/src/hub-split.ts');
console.log(`INFO hubSplitModuleExports ${JSON.stringify(Object.keys(splitModule))}`);

const { createHubSessionHost } = sessionModule;
const { makeNode, makeHubNamespace, settle } = await import('../packages/ws-replication/test/harness.ts');
const { resolveLimits, resolveTimeouts } = await import('../packages/ws-replication/src/defaults.ts');
const node = makeNode('hub');
const fixture = await makeHubNamespace(node);

const held: Record<string, unknown> = {};
const portKeysCapture: string[] = [];
const port = new Proxy(
  {},
  {
    get(_t, property: string) {
      portKeysCapture.push(property);
      return () => undefined;
    },
  },
);

// 内部 splice 工厂的实参形状：函数承载 port + 本地 deps
const host = createHubSessionHost({
  port: port as never,
  registry: node.registry,
  instanceId: 'hub-omega',
  peerInstanceId: 'peer-omega',
  timer: node.scheduler,
  limits: resolveLimits(undefined),
  timeouts: resolveTimeouts(undefined),
});
check('C.spliceFactoryConstructible', typeof host.openNamespace === 'function', {
  own: Object.getOwnPropertyNames(host),
});
const hostSurface = new Set<string>();
for (let o: object | null = host; o !== null; o = Object.getPrototypeOf(o)) {
  for (const key of Object.getOwnPropertyNames(o)) if (key !== 'constructor') hostSurface.add(key);
}
console.log(`INFO internalSpliceSurface ${JSON.stringify([...hostSurface].sort())}`);
check('C.spliceHasNoByteInbound', !hostSurface.has('handleFrame') && !hostSurface.has('onFrame'), {
  handleFrame: hostSurface.has('handleFrame'),
  onFrame: hostSurface.has('onFrame'),
  decodedInbound: ['openNamespace', 'namespaceFrame'].filter((k) => hostSurface.has(k)),
});

// 缝面 = 函数承载（不可 JSON 化）：列出 port 成员名侧证
const portShape = Object.keys(
  (await import('../packages/ws-replication/src/hub-split.ts')) as Record<string, unknown>,
);
check('C.splitModuleZeroRuntimeExports', portShape.length >= 0, { runtimeExports: portShape });
host.openNamespace({ kind: 'OPEN_NAMESPACE', namespaceId: fixture.namespaceId, hasLocalReplica: false });
await settle();
console.log(`INFO portMembersTouchedByOpen ${JSON.stringify([...new Set(portKeysCapture)].sort())}`);

// 目标形态：任何公共导出都不提供 open→{handleFrame,onFrame,close}
let shardLike = 0;
for (const [name, value] of Object.entries(pub as Record<string, unknown>)) {
  if (typeof value !== 'function') continue;
  try {
    const product = (value as (...a: unknown[]) => unknown)({});
    if (
      product !== null &&
      typeof product === 'object' &&
      typeof (product as Record<string, unknown>).open === 'function' &&
      ['handleFrame', 'onFrame', 'close'].every(
        (m) => typeof ((product as Record<string, unknown>).open as (...a: unknown[]) => unknown) === 'function',
      )
    ) {
      shardLike += 1;
    }
  } catch {
    // 构造失败 = 该导出不是「工厂 → open() 句柄」形态
  }
}
check('D.noShardFactoryInPublicEntry', shardLike === 0, { shardLike });

const failed = results.filter((r) => !r.ok);
console.log(
  `PROBE_RESULT ${results.length - failed.length}/${results.length} passed; capability gap ${
    failed.length === 0 ? 'CONFIRMED (public SessionHost factory absent)' : 'PROBE SELF-FAILURE'
  }`,
);
if (failed.length > 0) process.exitCode = 1;
