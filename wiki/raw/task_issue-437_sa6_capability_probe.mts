/**
 * SA6 能力缺口探针 — issue #437（lease 端到端：数组逐元素校验行为钉死，ADR 0033）。
 *
 * 证据面（全部经公共入口观察运行时行为；无源码字符串断言）：
 *   G 组：能力缺口事实（既有 lease/runtime 测试面的 array-* 覆盖形态分类，静态清单）
 *   P1 组：AC1 判别面——同一污染/同一 op 在「非 union 快轨」与「union legacy 轨」的
 *          A/B 对照（⇒ 契约 AC1 的 ok:true 断言对闸门敏感，非恒真）
 *   P2 组：AC2 不变量事实（issue 路径 index+j / 越界逐字 / 空载荷形状门）
 *   P3 组：AC4 诊断形态事实（root-mutation committed update carrier 键集 + 重放）
 *   P4 组：AC5 复制事实（owned update → peer apply 收敛 / diff 定点 / 增量形态）
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-437_sa6_capability_probe.mts
 * 退出码 = 未命中项数（0 = 探针全部符合预期）。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// 探针位于 wiki/raw（非 workspace 包，root node_modules 无提升的 yjs）——以相对
// 源码路径直取载体（symlink 归一 ⇒ 与 fixture/registry 内部同一模块实例）。
import * as Y from '../../packages/namespace-registry/node_modules/yjs/dist/yjs.mjs';
import {
  applyRawRemote,
  carrierBytes,
  countElementReadsAsync,
  openLeaseFixture,
  openPeerFixture,
  readArray,
  rootArray,
  rootMutationRecord,
  updateCarrierOf,
  waitForAttemptRecords,
  waitForOwnedUpdates,
} from '../../packages/namespace-registry/test/issue-437-lease-array-e2e-fixture.ts';

let failures = 0;
let checks = 0;

function check(id: string, ok: boolean, detail: string): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`);
}

async function flushMicrotasks(times = 24): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

// ── G：能力缺口事实（既有测试面对 array-* 覆盖形态分类）─────────────────────

function testFilesMentioningArrayOps(): Array<{ file: string; seam: string }> {
  const roots = ['packages/namespace-registry/test', 'packages/namespace-runtime/test', 'packages/doc-runtime/test', 'packages/vfsl/test'];
  const found: Array<{ file: string; seam: string }> = [];
  for (const root of roots) {
    for (const name of readdirSync(root)) {
      if (!name.endsWith('.ts')) continue;
      const text = readFileSync(join(root, name), 'utf8');
      if (!text.includes('array-insert') && !text.includes('array-delete')) continue;
      const seam = root.includes('namespace-registry')
        ? 'lease(registry)'
        : root.includes('namespace-runtime')
          ? 'runtime.mutateData'
          : root.includes('doc-runtime')
            ? 'doc-runtime.applyValidatedMutation'
            : 'vfsl seams';
      found.push({ file: join(root, name), seam });
    }
  }
  return found.sort((a, b) => a.file.localeCompare(b.file));
}

const census = testFilesMentioningArrayOps();
console.log('G0 array-* 覆盖清单（既有 + 本票）：');
for (const entry of census) console.log(`     - [${entry.seam}] ${entry.file}`);
const registryFiles = census.filter((entry) => entry.seam === 'lease(registry)');
check(
  'G1',
  registryFiles.every((entry) => entry.file.includes('issue-437')),
  `lease(registry) 面 array-* 覆盖 = ${registryFiles.length} 件，全部属本票新产物（旧覆盖 = 0）`,
);

// ── P1：AC1 判别面（非 union 快轨 vs union legacy 轨 A/B）───────────────────

{
  const fx = await openLeaseFixture({ replication: true });
  await applyRawRemote(fx.session!, fx.doc, (doc) => {
    rootArray(doc, 'items').insert(0, ['oops']);
    rootArray(doc, 'uarr').insert(0, [true]);
  });
  check('P1a', JSON.stringify(readArray(fx.lease, ['items'])) === '["oops",1,2,3,4,5]', `非 union 污染可读：${JSON.stringify(readArray(fx.lease, ['items']))}`);
  check('P1b', JSON.stringify(readArray(fx.lease, ['uarr'])) === '[true,7,8,9]', `union 污染可读：${JSON.stringify(readArray(fx.lease, ['uarr']))}`);

  const fast = await fx.lease.mutateData({ op: 'array-delete', path: ['items'], index: 2, count: 1 });
  check('P1c', fast.ok === true, `非 union 污染数组 delete → ${JSON.stringify(fast)}（目标行为：照常成功）`);
  check('P1d', JSON.stringify(readArray(fx.lease, ['items'])) === '["oops",1,3,4,5]', `污染保留：${JSON.stringify(readArray(fx.lease, ['items']))}`);

  const legacy = await fx.lease.mutateData({ op: 'array-delete', path: ['uarr'], index: 1, count: 1 });
  check(
    'P1e',
    legacy.ok === false && JSON.stringify((legacy as { issues: unknown[] }).issues) === JSON.stringify([{ message: '联合成员 1/2：类型不匹配：期望 number，实际 boolean', path: ['uarr', 0] }]),
    `union 污染数组 delete → ${JSON.stringify(legacy)}（legacy 全量边界轨：响亮拒绝）`,
  );
  check('P1f', JSON.stringify(readArray(fx.lease, ['uarr'])) === '[true,7,8,9]', `union 拒绝零写入：${JSON.stringify(readArray(fx.lease, ['uarr']))}`);
  await flushMicrotasks();
  check('P1g', fx.ownedUpdates.length === 1, `恰一次提交（快轨 delete）；owned updates = ${fx.ownedUpdates.length}`);
}

// ── P2：AC2 不变量事实 ─────────────────────────────────────────────────

{
  const fx = await openLeaseFixture({ replication: true });
  const bad = await fx.lease.mutateData({ op: 'array-insert', path: ['items'], index: 1, values: [8, 'x', 'y'] });
  const badPaths = bad.ok ? [] : bad.issues.map((issue) => issue.path);
  check('P2a', JSON.stringify(badPaths) === '[["items",2],["items",3]]', `非法新元素 issue 路径 index+j：${JSON.stringify(badPaths)}`);
  const nested = await fx.lease.mutateData({ op: 'array-insert', path: ['rows'], index: 1, values: [{ qty: 'x', tag: 'q' }] });
  const nestedPaths = nested.ok ? [] : nested.issues.map((issue) => issue.path);
  check('P2b', JSON.stringify(nestedPaths) === '[["rows",1,"qty"]]', `嵌套子路径：${JSON.stringify(nestedPaths)}`);

  const oobDelete = await fx.lease.mutateData({ op: 'array-delete', path: ['items'], index: 5, count: 1 });
  check('P2c', oobDelete.ok === false && JSON.stringify(oobDelete.issues) === JSON.stringify([{ message: 'array-delete 范围越界（不 clamp、不接受越界 no-op）', path: ['items', 5] }]), `越界 delete：${JSON.stringify(oobDelete)}`);
  const oobInsert = await fx.lease.mutateData({ op: 'array-insert', path: ['items'], index: 6, values: [1] });
  check('P2d', oobInsert.ok === false && JSON.stringify(oobInsert.issues) === JSON.stringify([{ message: 'array-insert index 越界（不 clamp）', path: ['items', 6] }]), `越界 insert：${JSON.stringify(oobInsert)}`);

  const emptyValues = await fx.lease.mutateData({ op: 'array-insert', path: ['items'], index: 1, values: [] });
  check('P2e', emptyValues.ok === false, `空载荷 values:[] 在信封形状门被拒：${JSON.stringify(emptyValues)}`);
  const emptyBatch = await fx.lease.mutateData({ ops: [] });
  check('P2f', emptyBatch.ok === false, `空批量 ops:[] 在信封形状门被拒：${JSON.stringify(emptyBatch)}`);

  check('P2g', JSON.stringify(readArray(fx.lease, ['items'])) === '[1,2,3,4,5]', `一切拒绝零写入：${JSON.stringify(readArray(fx.lease, ['items']))}`);
  await flushMicrotasks();
  check('P2h', fx.ownedUpdates.length === 0, `一切拒绝零 update；owned updates = ${fx.ownedUpdates.length}`);
}

// ── P3：AC4 诊断形态事实 ───────────────────────────────────────────────

{
  const fx = await openLeaseFixture({ diagnostics: true });
  const log = fx.log!;
  const baseState = Y.encodeStateAsUpdate(fx.doc);
  const written = await fx.lease.mutateData({ op: 'array-insert', path: ['items'], index: 5, values: [42] });
  check('P3a', written.ok === true, `数组写 ok：${JSON.stringify(written)}`);
  const records = await waitForAttemptRecords(log, 1);
  check('P3b', records.length === 1, `恰一条 attempt record：${records.length}`);
  const record = rootMutationRecord(log, 0);
  check('P3c', record.operation === 'root-mutation' && record.stage === 'transaction', `记录分类：${record.operation}/${record.stage}/${record.result.kind}`);
  const carrier = updateCarrierOf(record);
  const carrierKeys = Object.keys(carrier).sort().join(',');
  check('P3d', carrierKeys === 'base64,crc32c,format,payloadLength,storage', `carrier 键集：${carrierKeys}`);
  const replayed = new Y.Doc();
  Y.applyUpdate(replayed, baseState);
  Y.applyUpdate(replayed, carrierBytes(carrier));
  check('P3e', JSON.stringify(rootArray(replayed, 'items').toJSON()) === '[1,2,3,4,5,42]', `同基态重放收敛：${JSON.stringify(rootArray(replayed, 'items').toJSON())}`);
  const empty = new Y.Doc();
  Y.applyUpdate(empty, carrierBytes(carrier));
  check('P3f', empty.getMap('ROOT').size === 0, `无基态不物化（真增量）：ROOT.size = ${empty.getMap('ROOT').size}`);
}

// ── P4：AC5 复制事实 ───────────────────────────────────────────────────

{
  const hub = await openLeaseFixture({ replication: true });
  const peer = await openPeerFixture(hub);
  const baseState = Y.encodeStateAsUpdate(hub.doc);
  const written = await hub.lease.mutateData({ op: 'array-delete', path: ['items'], index: 0, count: 1 });
  check('P4a', written.ok === true, `hub 数组写 ok：${JSON.stringify(written)}`);
  await waitForOwnedUpdates(hub, 1);
  const update = hub.ownedUpdates[0]!;
  const plain = new Y.Doc();
  Y.applyUpdate(plain, baseState);
  Y.applyUpdate(plain, update);
  check('P4b', JSON.stringify(rootArray(plain, 'items').toJSON()) === '[2,3,4,5]', `owned update 同基态重放：${JSON.stringify(rootArray(plain, 'items').toJSON())}`);
  const applied = await peer.session!.applyRemoteUpdate(update);
  check('P4c', applied.ok === true, `peer apply 收敛判定：${JSON.stringify(applied)}`);
  check('P4d', JSON.stringify(readArray(peer.lease, ['items'])) === '[2,3,4,5]', `peer 逻辑值：${JSON.stringify(readArray(peer.lease, ['items']))}`);
  const rest = hub.session!.encodeDiff(peer.session!.encodeStateVector());
  const fixpoint = await peer.session!.applyRemoteUpdate(rest);
  check('P4e', fixpoint.ok === true, `diff 定点 apply：${JSON.stringify(fixpoint)}`);
  check('P4f', JSON.stringify(readArray(peer.lease, ['items'])) === '[2,3,4,5]', `定点后值不变：${JSON.stringify(readArray(peer.lease, ['items']))}`);
  const status = peer.session!.getStatus();
  check('P4g', status.state === 'open' && status.direction === 'hub-to-peer', `session 状态面：${status.state}/${status.direction}`);
}

// ── P5：AC3 结构性证据（双轨读计数 ∝ n vs O(k)）──────────────────────────

{
  const n = 64;
  const fx = await openLeaseFixture({
    replication: true,
    items: Array.from({ length: n }, (_, index) => index),
    uarr: Array.from({ length: n }, (_, index) => index),
  });
  const fastReads = await countElementReadsAsync(rootArray(fx.doc, 'items'), () =>
    fx.lease.mutateData({ op: 'array-delete', path: ['items'], index: 2, count: 1 }),
  );
  const legacyReads = await countElementReadsAsync(rootArray(fx.doc, 'uarr'), () =>
    fx.lease.mutateData({ op: 'array-delete', path: ['uarr'], index: 2, count: 1 }),
  );
  check('P5a', fastReads <= 8, `fast 轨元素读计数 = ${fastReads}（n=${n}；O(k) 解耦）`);
  check('P5b', legacyReads >= n, `union legacy 轨元素读计数 = ${legacyReads}（n=${n}；仍全量边界校验）`);
  check('P5c', legacyReads > fastReads, `双轨读计数分离：fast=${fastReads} vs legacy=${legacyReads}`);
}

console.log(`\n探针命中 ${checks - failures}/${checks}；failures=${failures}`);
process.exit(failures);
