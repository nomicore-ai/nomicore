/**
 * SA6 验收契约 — issue #393：FileDiagnosticLog 在 registry 接缝静默半工作
 * （自然组合零 runtime 记录 / segments 无 root-mutation 根因）。
 *
 * 契约来源：
 * - `wiki/raw/task_issue-393.md`（issue 正文 + 维护者 comment 5664521867 裁决：
 *   自然组合 = 两个公共导出的直接组合必须工作；主修方向 P0 =
 *   `FileDiagnosticLog` 自绑定 `runtimeEmitterFor`（identity 匹配本 namespace），
 *   registry 探测逻辑零改动；「类型收紧 fail-fast」作废）；
 * - ADR-0011（Interface 与 seam：emitter 小接口；业务模块不依赖日志存储实现）；
 *   ADR-0014-LOG（stream 建立/续写；producer 只供 bytes）；
 * - #155「归因键是数据不是时间」（`runtimeEmitterFor(namespaceId)` 数据键控）；
 * - #226（泵路径路由三态；公共入口无归属拒绝恒走同步共享通道）；
 * - #150 `{emitter}` 字面量 legacy 契约（逐字节冻结，零漂移）。
 *
 * 红灯核心（当前 HEAD = dcb3766；2026-09-14 诊断会话 + 本条复跑）：
 * - `FileDiagnosticLog`（`packages/namespace-diagnostic-log/src/adapters/file.ts:118`
 *   接口 / `:1529` 构造产物）无 `runtimeEmitterFor` 成员 → registry
 *   `createDiagRuntime` 走 legacy 回落（`create-diagnostic.ts:417-463`，
 *   `resolveRuntimeDiag` 恒 undefined）→ Runtime 构造无 `diagnosticEmitter` → 该
 *   namespace 的 runtime 级 emission（root-mutation / replication-enable /
 *   replication-apply）**从不产生**；create 尝试仍经共享 emitter 落同一流
 *   （「静默半工作」现象本体）。
 * - 同一根因的第二后果：raw log 的共享 emitter 是**该 ns 的** emitter，因此
 *   legacy 回落会把**其它候选 namespace** 的 create 记录写进本 ns 的流
 *   （跨 namespace 写入；R3 红灯锚）。
 *
 * 契约分类（当前 HEAD 判定；修复 = P0 自绑定落地）：
 * - R0/R1/R2/R3/R4 —— **红灯**（P0 缺口）：identity 匹配成员缺席、runtime 级
 *   emission 零落盘、replication apply 零落盘、跨 ns 写入、无归属拒绝落盘语义
 *   未经泵路径见证。
 * - G1/G2/G3/G4 —— **绿灯守护锚**（修复后必须保持）：直发 emitter 落盘（排除
 *   适配器静默失败假设）、#150 legacy 字面量零漂移、不新增 `initStream` 成员、
 *   显式 `{emitter, runtimeEmitterFor}` binding 经泵路径落盘（证明 registry/runtime
 *   装配面本身可用 —— 缺口边界精确 = `FileDiagnosticLog` 未自绑定）。
 *
 * AC5 裁决（无归属公共入口拒绝的落盘语义，显式定案）：**接受落盘**。理由与边界见
 * 本文件 R4 用例头注（单 ns 自绑定 log 的共享通道 = 本流自身；多 ns Host 的正路是
 * P1 导出的 manager，其 `unattributed` 恒丢弃语义保持 #226/#228 冻结）。
 *
 * 载具纪律：全部断言读取**运行时落盘行为**（strict reader 回读 segments），无源码
 * 字符串断言；测试经根 vitest include（各包 test 目录 glob）真实发现。
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createMemoryPersistence } from '@nomicore/persistence';
import type { DocPersistence, User } from '@nomicore/persistence';
import { createTestScheduler } from '@nomicore/persistence/testing';
import { createNamespaceRegistryForTesting, createRegistryTestScheduler } from '@nomicore/namespace-registry/testing';
import type { NamespaceLease, NamespaceRegistry } from '@nomicore/namespace-registry';
import {
  createFileDiagnosticLog,
  readStreamStrict,
  type FileDiagnosticLog,
  type NamespaceDiagnosticChangeEmission,
} from '../../namespace-diagnostic-log/src/index.js';

// ── 固定夹具 ────────────────────────────────────────────────────────────────

const NOW_MS = 1_700_000_000_000;
const NOW_ISO = new Date(NOW_MS).toISOString();
const OWNER: User = Object.freeze({ userId: 'u-alice' });
const SCHEMA = Object.freeze({
  lang: 'vfsl',
  version: 1,
  id: 'issue-393',
  text: 'type ROOT = { n: number; k1?: number; };\n',
});
const ROOT0 = Object.freeze({ n: 1 });
/** 确定性计数随机源 → 首个候选 id 恒为 ns-000…01、第二个 ns-000…02。 */
const NS_FIRST = 'ns-00000000000000000000000000000001';
const NS_SECOND = 'ns-00000000000000000000000000000002';

const tempRoots: string[] = [];
function freshTempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}
afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function makeCounterRandomBytes(): (length: number) => Uint8Array {
  let counter = 0;
  return (length: number): Uint8Array => {
    if (length !== 16) throw new Error(`受控随机源必须按 128-bit（16 字节）请求，实际请求 ${length} 字节`);
    counter += 1;
    const hex = counter.toString(16).padStart(32, '0');
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  };
}

function makeMemoryPersistence(): DocPersistence {
  const scheduler = createTestScheduler();
  return createMemoryPersistence({ scheduler, schedule: { debounceMs: 1, maxDirtyMs: 1 } });
}

/** 有界 macrotask 展开：diag-pump 以 setImmediate 排空（SUT 自身调度语义，非到达型 poll）。 */
async function drainPump(rounds = 12): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
}

function makeRegistry(persistence: DocPersistence, diagnosticLog: unknown): NamespaceRegistry {
  return createNamespaceRegistryForTesting(persistence, {
    clock: { now: () => NOW_MS },
    scheduler: createRegistryTestScheduler(),
    randomBytes: makeCounterRandomBytes(),
    diagnosticLog,
  } as never);
}

function makeFileLog(rootDir: string, namespaceId: string): FileDiagnosticLog {
  return createFileDiagnosticLog({ rootDir, namespaceId, clock: { now: () => NOW_MS } });
}

function okLease(result: unknown): NamespaceLease {
  const r = result as { ok?: boolean; lease?: NamespaceLease };
  expect(r.ok, `create/open 应成功，实际：${JSON.stringify(result)}`).toBe(true);
  if (r.ok !== true || r.lease === undefined) throw new Error('unreachable');
  return r.lease;
}

interface AttemptView {
  readonly operation: string | undefined;
  readonly code: string | undefined;
  readonly resultKind: string | undefined;
}

/** segments 回读（唯一判据面 = 落盘 record；strict reader = 包公共读面）。 */
function readAttempts(rootDir: string, namespaceId: string, streamId: string): AttemptView[] {
  const read = readStreamStrict({ rootDir, namespaceId, streamId });
  expect(read.status, `strict reader 读取失败：${JSON.stringify(read)}`).toBe('ok');
  return read.records
    .filter((entry) => entry.ok && entry.record !== null)
    .map((entry) => entry.record as unknown as Record<string, unknown>)
    .filter((record) => record.recordKind === 'attempt')
    .map((record) => ({
      operation: typeof record.operation === 'string' ? record.operation : undefined,
      code: typeof record.code === 'string' ? record.code : undefined,
      resultKind:
        record.result !== null && typeof record.result === 'object'
          ? ((record.result as { kind?: unknown }).kind as string | undefined)
          : undefined,
    }));
}

/** 非抛读取 P0 契约成员（缺席 = 当前红灯；断言先行、失败即止，无级联 TypeError）。 */
function requireRuntimeEmitterFor(log: FileDiagnosticLog): (namespaceId: string) => unknown {
  const member = (log as unknown as { runtimeEmitterFor?: unknown }).runtimeEmitterFor;
  expect(
    typeof member,
    'P0：FileDiagnosticLog 必须自带 runtimeEmitterFor（identity 匹配本 namespace 的数据键控解析成员）',
  ).toBe('function');
  if (typeof member !== 'function') throw new Error('unreachable after assertion');
  return member as (namespaceId: string) => unknown;
}

async function createAndOpen(
  registry: NamespaceRegistry,
  expectedNamespaceId?: string,
): Promise<{ namespaceId: string; lease: NamespaceLease }> {
  const lease = okLease(await registry.create({ owner: OWNER, schema: SCHEMA, root: ROOT0 }));
  if (expectedNamespaceId !== undefined) expect(lease.namespaceId).toBe(expectedNamespaceId);
  const namespaceId = lease.namespaceId;
  await lease.release();
  const reopened = okLease(await registry.open(OWNER, namespaceId));
  return { namespaceId, lease: reopened };
}

// ══════════════════════════ P0 红灯：自绑定缺口 ══════════════════════════

describe('#393 P0 — FileDiagnosticLog 自绑定 runtimeEmitterFor（identity 匹配）', () => {
  it('R0 (RED): runtimeEmitterFor 在场、identity 匹配本 ns、对其它 ns 解析 undefined', () => {
    const rootDir = freshTempRoot('issue393-r0-');
    const log = makeFileLog(rootDir, NS_FIRST);
    const resolver = requireRuntimeEmitterFor(log);
    expect(resolver(NS_FIRST), '本 namespace 必须解析回自身 emitter（identity 匹配）').toBe(log.emitter);
    expect(resolver(NS_SECOND), '其它 namespace 必须解析 undefined（泵内丢弃，无跨 ns 写入）').toBeUndefined();
    expect(resolver('ns-not-a-namespace-at-all')).toBeUndefined();
  });

  it('R1 (RED): raw log + open + mutate → 本 ns 流出现 root-mutation 记录', async () => {
    const rootDir = freshTempRoot('issue393-r1-');
    const log = makeFileLog(rootDir, NS_FIRST);
    const registry = makeRegistry(makeMemoryPersistence(), log);
    const { namespaceId, lease } = await createAndOpen(registry, NS_FIRST); // 自然组合：整对象直传
    const write = await lease.mutateData({ op: 'set', path: ['n'], value: 2 });
    expect(write, `业务写必须成功（日志隔离面不得改变业务结果）：${JSON.stringify(write)}`).toEqual({ ok: true });
    await drainPump();

    const attempts = readAttempts(rootDir, namespaceId, log.streamId);
    const runtimeRecords = attempts.filter((record) => record.operation === 'root-mutation');
    expect(
      runtimeRecords.length,
      `runtime 级 emission 必须经 registry 泵路径落到本 ns 流；实际记录：${JSON.stringify(attempts)}`,
    ).toBeGreaterThanOrEqual(1);
    expect(runtimeRecords.some((record) => record.resultKind === 'committed')).toBe(true);

    await lease.release();
    await registry.shutdown();
  });

  it('R2 (RED): replication apply（runtime 级 emission，共用同一装配）同样落盘', async () => {
    const rootDir = freshTempRoot('issue393-r2-');
    const log = makeFileLog(rootDir, NS_FIRST);
    const persistence = makeMemoryPersistence();
    const registry = makeRegistry(persistence, log);
    const { namespaceId, lease } = await createAndOpen(registry, NS_FIRST);
    for (let i = 0; i < 400; i += 1) {
      const status = lease.getStatus() as unknown as { runtime?: { schema?: { state?: string } } };
      if (status.runtime?.schema?.state === 'ready') break;
      await Promise.resolve();
    }
    expect(await lease.enableReplication()).toEqual({ ok: true });
    const opened = await lease.openReplicationSession({ localRole: 'hub', remoteInstanceId: 'peer-a' });
    expect(opened.ok, `session 必须可开：${JSON.stringify(opened)}`).toBe(true);
    if (!opened.ok || opened.session === undefined) throw new Error('unreachable');

    // 可信远端槽（镜像 registry-phase5-replication-session-red 的 makeRemoteUpdate）：
    // 以 liveDoc 当前状态 bootstrap 独立副本，再写**新键**（新键无并发项 → 结果确定）。
    const handle = await persistence.loadDoc(OWNER, namespaceId);
    expect(handle, 'live 文档必须可经 Persistence 公共读面取得').not.toBeNull();
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(handle!.doc));
    peer.getMap('ROOT').set('k1', 7);
    const applied = await opened.session.applyRemoteUpdate(Y.encodeStateAsUpdate(peer));
    expect(applied.ok, `apply 必须成功：${JSON.stringify(applied)}`).toBe(true);
    await drainPump();

    const attempts = readAttempts(rootDir, namespaceId, log.streamId);
    const applyRecords = attempts.filter((record) => record.operation === 'replication-apply');
    expect(
      applyRecords.length,
      `replication-apply 是同一 runtime 诊断装配的 emission，必须落本 ns 流；实际：${JSON.stringify(attempts)}`,
    ).toBeGreaterThanOrEqual(1);
    expect(applyRecords.some((record) => record.resultKind === 'committed')).toBe(true);

    await opened.session.close();
    await lease.release();
    await registry.shutdown();
  });

  it('R3 (RED): 其它 namespace 的 emission 不落本流（解析 undefined → 泵内丢弃，无跨 ns 写入）', async () => {
    const rootDir = freshTempRoot('issue393-r3-');
    const log = makeFileLog(rootDir, NS_FIRST);
    const registry = makeRegistry(makeMemoryPersistence(), log);

    const first = okLease(await registry.create({ owner: OWNER, schema: SCHEMA, root: ROOT0 }));
    expect(first.namespaceId).toBe(NS_FIRST);
    await drainPump();
    const before = readAttempts(rootDir, NS_FIRST, log.streamId).length;

    const second = okLease(await registry.create({ owner: OWNER, schema: SCHEMA, root: { n: 2 } }));
    expect(second.namespaceId, '第二个 create 必须是不同候选 ns').toBe(NS_SECOND);
    await drainPump();
    const after = readAttempts(rootDir, NS_FIRST, log.streamId).length;

    expect(after, `其它 ns 的 create 记录不得追加进本流（before=${before}, after=${after}）`).toBe(before);

    await first.release();
    await second.release();
    await registry.shutdown();
  });

  it('R4 (RED-anchor + 定案守护): 无归属公共入口拒绝落本流（单 ns 自绑定 = 接受落盘）', async () => {
    // ── AC5 显式定案：接受落盘 ──
    // 泵路径下 `emitEarlyOutcome(namespaceId === undefined, …)`（acceptance/identity 拒绝，
    // namespaceId 生成前）按 #226 走**同步共享通道**（create-diagnostic.ts:530-541）；自绑定
    // 的 FileDiagnosticLog 的共享通道 `emitter` 就是本 ns 自己的流 emitter → 记录落本流。
    // 裁决理由：(a) log 对象按构造即 per-namespace（namespaceId + 单流），落本流不构成
    // 跨流写入；(b) 该拒绝类无候选 id，数据键控解析结构性不可用；(c) 丢弃会重演本 issue
    // 定性的「最坏失效模式 = 零输出、零反馈」；(d) 替代方案（另立丢弃通道成员）与 P0
    // 「最小公共面改动」纪律（不加 initStream）相悖。
    // 边界：多 ns Host 的正路 = P1 导出的 manager，其 `unattributed` 恒丢弃 + 计数语义
    // 保持 #226/#228 冻结（P1 契约在 apps/yjs-server 侧另行锚定）；本裁决仅约束自绑定
    // 的 per-namespace FileDiagnosticLog。
    const rootDir = freshTempRoot('issue393-r4-');
    const log = makeFileLog(rootDir, NS_FIRST);
    requireRuntimeEmitterFor(log); // 泵路径判别的契约锚（当前红灯）
    const registry = makeRegistry(makeMemoryPersistence(), log);
    const lease = okLease(await registry.create({ owner: OWNER, schema: SCHEMA, root: ROOT0 }));
    await lease.release();
    await registry.shutdown();

    const rejected = await registry.create({ owner: OWNER, schema: SCHEMA, root: ROOT0 });
    expect(rejected).toMatchObject({ ok: false, code: 'REGISTRY_NOT_ACCEPTING' });
    await drainPump();

    const attempts = readAttempts(rootDir, NS_FIRST, log.streamId);
    const landed = attempts.filter((record) => record.code === 'REGISTRY_NOT_ACCEPTING');
    expect(
      landed.length,
      `无归属公共入口拒绝按定案必须恰落一次本流；实际：${JSON.stringify(attempts)}`,
    ).toBe(1);
    expect(landed[0]!.resultKind).toBe('rejected');
  });
});

// ══════════════════ 绿灯守护锚（修复后必须保持） ══════════════════

describe('#393 守护锚 — 正控 / legacy 零漂移 / 装配面可用性', () => {
  it('G1 (GREEN): 直发 emitter.emit(root-mutation) 落盘（排除适配器静默失败/缓冲假设）', () => {
    const rootDir = freshTempRoot('issue393-g1-');
    const log = makeFileLog(rootDir, NS_FIRST);
    const emission: NamespaceDiagnosticChangeEmission = {
      operation: 'root-mutation',
      stage: 'transaction',
      observedAt: NOW_ISO,
      source: { kind: 'local' },
      input: { status: 'not-accessed' },
      result: { kind: 'committed', effect: 'noop' },
    };
    log.emitter.emit(emission);
    const attempts = readAttempts(rootDir, NS_FIRST, log.streamId);
    expect(attempts.some((record) => record.operation === 'root-mutation')).toBe(true);
  });

  it('G2 (GREEN): #150 legacy 字面量 {emitter} 零漂移——create 尝试落盘、runtime 记录缺席', async () => {
    const rootDir = freshTempRoot('issue393-g2-');
    const log = makeFileLog(rootDir, NS_FIRST);
    const registry = makeRegistry(makeMemoryPersistence(), { emitter: log.emitter });
    const lease = okLease(await registry.create({ owner: OWNER, schema: SCHEMA, root: ROOT0 }));
    const write = await lease.mutateData({ op: 'set', path: ['n'], value: 2 });
    expect(write).toEqual({ ok: true });
    await drainPump();

    const attempts = readAttempts(rootDir, NS_FIRST, log.streamId);
    expect(attempts.filter((record) => record.operation === 'namespace-create').length).toBe(1);
    expect(
      attempts.filter((record) => record.operation === 'root-mutation').length,
      'legacy 形状（无 runtimeEmitterFor）= Runtime 无 diagnosticEmitter——runtime 级记录结构性缺席',
    ).toBe(0);

    await lease.release();
    await registry.shutdown();
  });

  it('G3 (GREEN): 不新增 initStream 成员（泵路径缺席 → no-op；stream 构造期已 eager 建立）', () => {
    const rootDir = freshTempRoot('issue393-g3-');
    const log = makeFileLog(rootDir, NS_FIRST);
    expect((log as unknown as Record<string, unknown>).initStream).toBeUndefined();
  });

  it('G4 (GREEN): 显式 {emitter, runtimeEmitterFor} binding 经泵路径落盘（装配面本身可用）', async () => {
    const rootDir = freshTempRoot('issue393-g4-');
    const log = makeFileLog(rootDir, NS_FIRST);
    const binding = {
      emitter: log.emitter,
      runtimeEmitterFor: (namespaceId: string) => (namespaceId === NS_FIRST ? log.emitter : undefined),
    };
    const registry = makeRegistry(makeMemoryPersistence(), binding);
    const { namespaceId, lease } = await createAndOpen(registry, NS_FIRST);
    const write = await lease.mutateData({ op: 'set', path: ['n'], value: 2 });
    expect(write).toEqual({ ok: true });
    await drainPump();

    const attempts = readAttempts(rootDir, namespaceId, log.streamId);
    expect(
      attempts.filter((record) => record.operation === 'root-mutation').length,
      '生产泵路径（#226）在显式 binding 下必须落盘——缺口边界 = FileDiagnosticLog 未自绑定',
    ).toBeGreaterThanOrEqual(1);

    await lease.release();
    await registry.shutdown();
  });
});
