/**
 * SA6 最小复现 / 诊断探针 — issue #441（ADR 0034「Record/parent fast path 接线与 S9 收窄」）：
 * doc-runtime 侧能力缺口（闸门分流 / O(n)→O(k) / S9 收窄）+ 目标行为可达性 + 判据敏感性。
 *
 * 这是**诊断与验收契约的可执行证据**，不是 issue #441 的交付实现（交付 = 验收契约测试
 * `packages/doc-runtime/test/issue-441-record-fastpath-{contract,control}.test.ts` + 共享夹具
 * `...-fixture.ts`）。本文件不在 vitest include 面内（`wiki/raw/**`），只作探针运行。
 *
 * 运行（真实源码；期望全部检查命中，exit 0）：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-441_sa6_capability_probe.mts
 *
 * 检查 id（与契约报告 §5/§9 对应）：
 *   P1  规划闸门形状（纯 vfsl planMutationBoundary）：Record set/delete kind=record、
 *       封闭对象 delete kind=parent、union map 位 kind=union、Record 值位 union 不改变 kind
 *   G1/G2 HEAD 能力缺口：非 union Record 位与封闭对象 delete **一律** legacy 全量边界路径
 *       （S5 整 map/父对象提取 + S6 全量重建 + S9 重投影）——触达面外污染连带阻断
 *   G3  成本 ∝ n / ∝ 父字段数（live Y.Map entry 读计数；结构性证据）
 *   G4  S9 现状：快照边界重投影核覆盖全部 record/parent 提交（触达面外同事务篡改 → E201-C）
 *   G5  现状语义快照（域规则逐字 + 零写入 + commit 最小 edit 形态）
 *   S1  目标接缝已存在且行为达标：#440 交付的 `applyElementwiseEntryMutation`
 *   NC  负控基线：union map 位 / union 穿越仍 legacy（污染阻断、篡改 E201）——闸门不得过度接管
 */
import { strict as assert } from 'node:assert';
// yjs 解析仅在包内 node_modules 可达（探针位于 wiki/raw，不迁就根依赖面）；与 #436 探针同款。
import * as Y from '../../packages/doc-runtime/node_modules/yjs/dist/yjs.mjs';
import { applyElementwiseEntryMutation, planMutationBoundary } from '../../packages/vfsl/src/index.js';
import type { MutationBoundaryPlan, ValueSchema } from '../../packages/vfsl/src/index.js';
import {
  DERIVED,
  capture,
  countMapReads,
  fixture,
  item,
  logicalValueAt,
  rawItemEntry,
  rawSet,
  run,
  sameBytes,
  stateBytes,
  summarizeThrown,
  tamperOnNextLocalCommit,
  taskKey,
  withUpdates,
} from '../../packages/doc-runtime/test/issue-441-record-fastpath-fixture.js';

let checks = 0;
const failures: string[] = [];

function check(id: string, ok: boolean, detail: unknown): void {
  checks += 1;
  const line = `${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(detail)}`;
  console.log(line);
  if (!ok) failures.push(line);
}

function issuesOf(result: { ok: boolean } & Record<string, unknown>): unknown {
  return result.ok ? null : (result as { issues?: unknown }).issues;
}

function plan(path: Array<string | number>, op: 'set' | 'delete'): MutationBoundaryPlan | { reject: unknown } {
  const r = planMutationBoundary(DERIVED, path, op);
  return r.ok ? r.plan : { reject: r.result };
}

/** 值树 ref 解析（`derived.values` 别名表；仅探针/契约的静态断言面使用）。 */
function derefValue(v: ValueSchema): ValueSchema {
  let cur = v;
  const seen = new Set<string>();
  while (cur.kind === 'ref') {
    if (seen.has(cur.name)) throw new Error(`value ref 环：${cur.name}`);
    seen.add(cur.name);
    cur = DERIVED.values[cur.name]!;
  }
  return cur;
}

function expectE201(thrown: unknown): { fatal: boolean; phase: string | null; committed: boolean | null; head: string } {
  const s = summarizeThrown(thrown);
  return { fatal: s.fatal, phase: s.phase, committed: s.committed, head: s.message.slice(0, 96) };
}

// ═══════════════════════════════════════════════════════════════════════════
// P1 规划闸门形状（ADR 0034 决策 1；零 base 读）
// ═══════════════════════════════════════════════════════════════════════════

const pRecordSet = plan(['tasks', 't1'], 'set');
check('P1a', 'kind' in pRecordSet && pRecordSet.kind === 'record' && pRecordSet.relPath.length === 1
  && pRecordSet.prefix.join('/') === 'tasks' && pRecordSet.node.kind === 'object'
  && pRecordSet.node.fields.some((f) => f.name === '<key>'), pRecordSet);

const pRecordDelete = plan(['tasks', 't1'], 'delete');
check('P1b', 'kind' in pRecordDelete && pRecordDelete.kind === 'record', pRecordDelete);

const pParent = plan(['obj', 'opt'], 'delete');
check('P1c', 'kind' in pParent && pParent.kind === 'parent' && pParent.node.kind === 'object'
  && !pParent.node.fields.some((f) => f.name === '<key>'), pParent);

const pUnionMap = plan(['maybe', 'm1'], 'set');
check('P1d', 'kind' in pUnionMap && pUnionMap.kind === 'union', pUnionMap);

const pValueUnion = plan(['blobs', 'b1'], 'set');
check('P1e', 'kind' in pValueUnion && pValueUnion.kind === 'record' && pValueUnion.node.kind === 'object'
  && pValueUnion.node.fields.some((f) => f.name === '<key>' && derefValue(f.value).kind === 'union'), pValueUnion);

const pDeep = plan(['outer', 'inner', 'n1'], 'set');
check('P1f', 'kind' in pDeep && pDeep.kind === 'record' && pDeep.prefix.join('/') === 'outer/inner', pDeep);

const pDynamicDelete = plan(['tasks', 't9'], 'delete');
check('P1g', 'kind' in pDynamicDelete && pDynamicDelete.kind === 'record', pDynamicDelete);

const pClosedUnknown = plan(['obj', 'zzz'], 'delete');
check('P1h', 'reject' in pClosedUnknown, pClosedUnknown);

const pUnionCross = plan(['umem', 'inner', 'u2'], 'set');
check('P1i', 'kind' in pUnionCross && pUnionCross.kind === 'union', pUnionCross);

// ═══════════════════════════════════════════════════════════════════════════
// G1/G2 HEAD 缺口：非 union Record 位与封闭对象 delete 一律 legacy 全量路径
// ═══════════════════════════════════════════════════════════════════════════

// G1a Record set + 触达面外（兄弟 entry）载体错位污染 → legacy S5 walk 阻断
{
  const fx = fixture();
  rawSet(fx.tasks, 't2', 'oops');
  const before = stateBytes(fx.doc);
  const captured = withUpdates(fx.doc, () => run(fx, { op: 'set', path: ['tasks', 't2'], value: item('x', 1) }));
  check('G1a', captured.result.ok === false && captured.count === 0 && sameBytes(before, stateBytes(fx.doc)), {
    result: captured.result, updates: captured.count,
  });
  const fx2 = fixture();
  rawSet(fx2.tasks, 't2', 'oops');
  const r2 = run(fx2, { op: 'set', path: ['tasks', 't1'], value: item('x', 1) });
  check('G1a2', r2.ok === false, { issues: issuesOf(r2) });
}

// G1b Record delete（目标键干净、兄弟 entry 污染）→ legacy S5 walk 阻断
{
  const fx = fixture();
  rawSet(fx.tasks, 't2', 'oops');
  const before = stateBytes(fx.doc);
  const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['tasks', 't1'] }));
  check('G1b', captured.result.ok === false && captured.count === 0 && sameBytes(before, stateBytes(fx.doc)), {
    result: captured.result, updates: captured.count,
  });
}

// G1c Record delete 目标键自身污染 → legacy S5 walk 亦阻断（触达面 = 目标键位未成立）
{
  const fx = fixture();
  rawSet(fx.tasks, 't2', 'oops');
  const r = run(fx, { op: 'delete', path: ['tasks', 't2'] });
  check('G1c', r.ok === false, { issues: issuesOf(r) });
}

// G1d Record set + 兄弟 entry 载体正确但值非法 → legacy S6 全量重建 + validateSubtree 阻断
{
  const fx = fixture();
  rawSet(fx.tasks, 't2', rawItemEntry('bad', 'x'));
  const r = run(fx, { op: 'set', path: ['tasks', 't1'], value: item('ok', 1) });
  check('G1d', r.ok === false, { issues: issuesOf(r) });
}

// G1e 带 keyPattern 的 Record：兄弟键违约 → legacy S6 全量重校验阻断
{
  const fx = fixture();
  rawSet(fx.codes, 'nope', rawItemEntry('n', 1));
  const r = run(fx, { op: 'set', path: ['codes', 'id-2'], value: item('c2', 2) });
  check('G1e', r.ok === false, { issues: issuesOf(r) });
}

// G1f Record 值位 union（blobs）+ 兄弟 entry 污染 → legacy 全量路径阻断（值位 union 不改变现状）
{
  const fx = fixture();
  rawSet(fx.blobs, 'b1', 'oops');
  const r = run(fx, { op: 'set', path: ['blobs', 'b2'], value: item('v', 5) });
  check('G1f', r.ok === false, { issues: issuesOf(r) });
}

// G1g 封闭对象 delete（optional 目标）+ 兄弟字段污染 → legacy S5 父值提取阻断
{
  const fx = fixture();
  rawSet(fx.obj, 'deep', 5);
  const r = run(fx, { op: 'delete', path: ['obj', 'opt'] });
  check('G1g', r.ok === false, { issues: issuesOf(r) });
}

// G1h 封闭对象 delete（required 目标）+ 兄弟字段污染 → 先被 S5 载体错位拦下（非静态必填判定）
{
  const fx = fixture();
  rawSet(fx.obj, 'deep', 5);
  const r = run(fx, { op: 'delete', path: ['obj', 'req'] });
  check('G1h', r.ok === false, { issues: issuesOf(r) });
}

// G1i 批量信封内的 Record set 同样被触达面外污染连带拒绝（整体零写入）
{
  const fx = fixture();
  rawSet(fx.tasks, 't2', 'oops');
  const before = stateBytes(fx.doc);
  const r = run(fx, { ops: [{ op: 'set', path: ['tasks', 't1'], value: item('x', 1) }] });
  check('G1i', r.ok === false && sameBytes(before, stateBytes(fx.doc)), { issues: issuesOf(r) });
}

// G1j 干净写照常成功（现行行为正确，缺口仅在触达面/成本）
{
  const fx = fixture();
  const setR = run(fx, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) });
  const delR = run(fx, { op: 'delete', path: ['tasks', 't0'] });
  const objR = run(fx, { op: 'delete', path: ['obj', 'opt'] });
  check('G1j', setR.ok && delR.ok && objR.ok, {
    set: setR, delete: delR, obj: objR,
    tasks: fx.tasks.toJSON(), obj: fx.obj.toJSON(),
  });
}

// G1k/G1l 触达面内载体位：Record map / 封闭对象父载体本身被替换为非 Y.Map → 响亮拒绝
//     （fast path 的 F1 载体检查必须与 legacy S5 首错同文案同 path——path [] 边界相对）
{
  const fx = fixture();
  rawSet(fx.root, 'tasks', 'oops');
  const before = stateBytes(fx.doc);
  const captured = withUpdates(fx.doc, () => run(fx, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
  const issues = captured.result.ok ? null : captured.result.issues;
  check('G1k', captured.result.ok === false && captured.count === 0 && sameBytes(before, stateBytes(fx.doc))
    && JSON.stringify(issues) === JSON.stringify([
      { message: 'Yjs 载体错位（ROOT）：期望 Y.Map，实际 plain value', path: [] },
    ]), { issues, updates: captured.count });
}
{
  const fx = fixture();
  rawSet(fx.root, 'obj', 'oops');
  const r = run(fx, { op: 'delete', path: ['obj', 'opt'] });
  const issues = r.ok ? null : r.issues;
  check('G1l', r.ok === false
    && JSON.stringify(issues) === JSON.stringify([
      { message: 'Yjs 载体错位（ROOT）：期望 Y.Map，实际 plain value', path: [] },
    ]), { issues });
}

// ═══════════════════════════════════════════════════════════════════════════
// G3 成本 ∝ n / ∝ 父字段数（live Y.Map entry 读计数）
// ═══════════════════════════════════════════════════════════════════════════

function recordSetCounts(n: number): { value: number; presence: number } {
  const fx = fixture({ tasksN: n });
  const counted = countMapReads(fx.tasks, () => run(fx, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
  assert.equal(counted.result.ok, true);
  return { value: counted.counts.valueReads, presence: counted.counts.presenceReads };
}

function recordDeleteCounts(n: number): { value: number; presence: number } {
  const fx = fixture({ tasksN: n });
  const counted = countMapReads(fx.tasks, () => run(fx, { op: 'delete', path: ['tasks', 't0'] }));
  assert.equal(counted.result.ok, true);
  return { value: counted.counts.valueReads, presence: counted.counts.presenceReads };
}

function closedDeleteCounts(which: 'narrow' | 'wide'): { value: number; presence: number } {
  const fx = fixture();
  const map = which === 'narrow' ? fx.narrow : fx.wide;
  const counted = countMapReads(map, () => run(fx, { op: 'delete', path: [which, 'target'] }));
  assert.equal(counted.result.ok, true);
  return { value: counted.counts.valueReads, presence: counted.counts.presenceReads };
}

const set512 = recordSetCounts(512);
const set4096 = recordSetCounts(4096);
const del512 = recordDeleteCounts(512);
const del4096 = recordDeleteCounts(4096);
const narrowDel = closedDeleteCounts('narrow');
const wideDel = closedDeleteCounts('wide');
check('G3', true, {
  recordSet: { n512: set512, n4096: set4096 },
  recordDelete: { n512: del512, n4096: del4096 },
  closedDelete: { narrow4Fields: narrowDel, wide14Fields: wideDel },
});

// 反证：整 map 批量出口逃逸计数同样被计入（keys()/toJSON()/forEach/Symbol.iterator）
{
  const fx = fixture({ tasksN: 64 });
  const counted = countMapReads(fx.tasks, () => {
    fx.tasks.toJSON();
    return [fx.tasks.keys(), fx.tasks.values(), fx.tasks.entries()];
  });
  check('G3b', counted.counts.valueReads >= 4 * 64, counted.counts);
}

// G3c 软证据（ADR 0034 决策 6 面；不钉毫秒阈值、不进契约）：10³ vs 10⁵ entry 单键写耗时
{
  const t0 = Date.now();
  const small = fixture({ tasksN: 1000 });
  const smallSetup = Date.now() - t0;
  const t1 = Date.now();
  const big = fixture({ tasksN: 100000 });
  const bigSetup = Date.now() - t1;
  const t2 = Date.now();
  const smallRun = run(small, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) });
  const smallMs = Date.now() - t2;
  const t3 = Date.now();
  const bigRun = run(big, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) });
  const bigMs = Date.now() - t3;
  check('G3c', smallRun.ok === true && bigRun.ok === true, {
    setupMs: { n1000: smallSetup, n100000: bigSetup },
    setMs: { n1000: smallMs, n100000: bigMs },
    ratio: smallMs === 0 ? null : Number((bigMs / smallMs).toFixed(2)),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// G4 S9 现状：边界重投影核覆盖全部 record/parent 提交
// ═══════════════════════════════════════════════════════════════════════════

// G4a Record set + 触达面外（兄弟键）同事务篡改 → E201-C
{
  const fx = fixture();
  tamperOnNextLocalCommit(fx.doc, () => {
    fx.tasks.delete('t2');
  });
  const thrown = capture(() => run(fx, { op: 'set', path: ['tasks', 't1'], value: item('x', 1) }));
  check('G4a', expectE201(thrown).fatal, { e201: expectE201(thrown), tasks: fx.tasks.toJSON() });
}

// G4b Record delete + 触达面外兄弟键同事务篡改 → E201-C
{
  const fx = fixture();
  tamperOnNextLocalCommit(fx.doc, () => {
    fx.tasks.delete('t2');
  });
  const thrown = capture(() => run(fx, { op: 'delete', path: ['tasks', 't0'] }));
  check('G4b', expectE201(thrown).fatal, { e201: expectE201(thrown) });
}

// G4c 封闭对象 delete + 触达面外兄弟字段同事务篡改 → E201-C
{
  const fx = fixture();
  tamperOnNextLocalCommit(fx.doc, () => {
    fx.obj.set('deep', 5);
  });
  const thrown = capture(() => run(fx, { op: 'delete', path: ['obj', 'opt'] }));
  check('G4c', expectE201(thrown).fatal, { e201: expectE201(thrown) });
}

// G4d 负控：union map 位（maybe）提交 + 触达面外篡改 → E201-C（legacy 双核必须保持）
{
  const fx = fixture();
  tamperOnNextLocalCommit(fx.doc, () => {
    fx.maybe.delete('m1');
  });
  const thrown = capture(() => run(fx, { op: 'set', path: ['maybe', 'm2'], value: item('mm', 6) }));
  check('G4d', expectE201(thrown).fatal, { e201: expectE201(thrown) });
}

// G4e 安装事实核现状：目标键自身被同事务覆写 → E201-C（fast path 落地后仍必须保留）
{
  const fx = fixture();
  tamperOnNextLocalCommit(fx.doc, () => {
    fx.tasks.set('t1', rawItemEntry('z', 9));
  });
  const thrown = capture(() => run(fx, { op: 'set', path: ['tasks', 't1'], value: item('x', 1) }));
  check('G4e', expectE201(thrown).fatal, { e201: expectE201(thrown) });
}

// G4f 安装事实核现状：delete 目标键被同事务重插 → E201-C
{
  const fx = fixture();
  tamperOnNextLocalCommit(fx.doc, () => {
    fx.tasks.set('t1', rawItemEntry('z', 9));
  });
  const thrown = capture(() => run(fx, { op: 'delete', path: ['tasks', 't1'] }));
  check('G4f', expectE201(thrown).fatal, { e201: expectE201(thrown) });
}

// G4g 安装事实核现状（两轨共享单实现）：目标键被**同逻辑值的不同实例**同事务替换 →
//     事实核 `parent.get(key) !== installed` 检出 → E201-C（fast path 落地后仍必须保留）
{
  const fx = fixture();
  tamperOnNextLocalCommit(fx.doc, () => {
    fx.tasks.set('t1', rawItemEntry('t1', 2)); // 与基线 item('t1',2) 逻辑等值、实例不同
  });
  const thrown = capture(() => run(fx, { op: 'set', path: ['tasks', 't1'], value: item('x', 1) }));
  check('G4g', expectE201(thrown).fatal, { e201: expectE201(thrown), tasks: fx.tasks.toJSON() });
}

// ═══════════════════════════════════════════════════════════════════════════
// G5 现状语义快照（域规则逐字 + 零写入 + commit 最小 edit 形态）
// ═══════════════════════════════════════════════════════════════════════════

// G5a Record delete no-op
{
  const fx = fixture();
  const before = stateBytes(fx.doc);
  const captured = withUpdates(fx.doc, () => run(fx, { op: 'delete', path: ['tasks', 't99'] }));
  check('G5a', captured.result.ok === false && captured.count === 0 && sameBytes(before, stateBytes(fx.doc)), {
    result: captured.result, updates: captured.count,
  });
}

// G5b Record set 键 Pattern 违约
{
  const fx = fixture();
  const before = stateBytes(fx.doc);
  const captured = withUpdates(fx.doc, () => run(fx, { op: 'set', path: ['codes', 'nope'], value: item('n', 1) }));
  check('G5b', captured.result.ok === false && captured.count === 0 && sameBytes(before, stateBytes(fx.doc)), {
    result: captured.result, updates: captured.count,
  });
}

// G5c Record set 新值非法（值 schema 拒绝）
{
  const fx = fixture();
  const before = stateBytes(fx.doc);
  const captured = withUpdates(fx.doc, () => run(fx, { op: 'set', path: ['tasks', 't9'], value: { title: 'x', qty: 'y' } }));
  check('G5c', captured.result.ok === false && captured.count === 0 && sameBytes(before, stateBytes(fx.doc)), {
    result: captured.result, updates: captured.count,
  });
}

// G5d Record delete：不查键 Pattern（现键违约仍可删）——现行语义
{
  const fx = fixture();
  rawSet(fx.codes, 'nope', rawItemEntry('n', 1));
  const r = run(fx, { op: 'delete', path: ['codes', 'nope'] });
  check('G5d', r.ok === true && fx.codes.has('nope') === false, { result: r, codes: fx.codes.toJSON() });
}

// G5e 封闭对象 delete：必填字段静态拒绝 / optional / unknown 允许 / 缺席 no-op
{
  const fx = fixture();
  const req = run(fx, { op: 'delete', path: ['obj', 'req'] });
  const unk = run(fx, { op: 'delete', path: ['obj', 'unk'] });
  const opt = run(fx, { op: 'delete', path: ['obj', 'opt'] });
  const optAgain = run(fx, { op: 'delete', path: ['obj', 'opt'] });
  check('G5e', req.ok === false && unk.ok === true && opt.ok === true && optAgain.ok === false, {
    req, unk, opt, optAgain, obj: fx.obj.toJSON(),
  });
}

// G5f commit 形态：delete 终态字节 ≡ 手写 Y.Map.delete（同 clientID）
{
  const viaApi = fixture({ clientID: 4242 });
  const apiCapture = withUpdates(viaApi.doc, () => run(viaApi, { op: 'delete', path: ['tasks', 't0'] }));
  const viaManual = fixture({ clientID: 4242 });
  const manualCapture = withUpdates(viaManual.doc, () => {
    viaManual.doc.transact(() => {
      viaManual.tasks.delete('t0');
    });
  });
  check('G5f', apiCapture.count === 1 && manualCapture.count === 1
    && sameBytes(stateBytes(viaApi.doc), stateBytes(viaManual.doc))
    && sameBytes(apiCapture.events[0]!, manualCapture.events[0]!), {
    apiUpdates: apiCapture.count, manualUpdates: manualCapture.count,
    apiBytes: apiCapture.events[0]!.length, manualBytes: manualCapture.events[0]!.length,
  });
}

// G5g commit 形态：Record set 单 update、增量字节长度与 n 解耦（最小 edit；时钟 varint 余量）
{
  const small = fixture({ tasksN: 3, clientID: 7 });
  const big = fixture({ tasksN: 512, clientID: 7 });
  const smallCapture = withUpdates(small.doc, () => run(small, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
  const bigCapture = withUpdates(big.doc, () => run(big, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
  check('G5g', smallCapture.count === 1 && bigCapture.count === 1
    && Math.abs(smallCapture.events[0]!.length - bigCapture.events[0]!.length) <= 8, {
    small: smallCapture.events[0]!.length, big: bigCapture.events[0]!.length,
  });
}

// G5g2 commit 形态：Record set 终态/增量字节 ≡ 手写最小 edit（raw Y.Map 逐字段构造，同 clientID）
{
  const viaApi = fixture({ tasksN: 5, clientID: 991 });
  const apiCapture = withUpdates(viaApi.doc, () => run(viaApi, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
  const viaManual = fixture({ tasksN: 5, clientID: 991 });
  const manualCapture = withUpdates(viaManual.doc, () => {
    viaManual.doc.transact(() => {
      const m = new Y.Map<unknown>();
      m.set('title', 'nine');
      m.set('qty', 9);
      viaManual.tasks.set('t9', m);
    });
  });
  check('G5g2', apiCapture.count === 1 && manualCapture.count === 1
    && sameBytes(stateBytes(viaApi.doc), stateBytes(viaManual.doc))
    && sameBytes(apiCapture.events[0]!, manualCapture.events[0]!), {
    apiBytes: apiCapture.events[0]!.length, manualBytes: manualCapture.events[0]!.length,
    stateEqual: sameBytes(stateBytes(viaApi.doc), stateBytes(viaManual.doc)),
  });
}

// G5h 复制面：增量 update 应用到同基态对端后逻辑值一致
{
  const fx = fixture({ clientID: 777 });
  const replica = new Y.Doc();
  Y.applyUpdate(replica, Y.encodeStateAsUpdate(fx.doc));
  const captured = withUpdates(fx.doc, () => run(fx, { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) }));
  Y.applyUpdate(replica, captured.events[0]!);
  check('G5h', captured.count === 1 && JSON.stringify(logicalValueAt(replica, ['tasks', 't9'])) === JSON.stringify(item('nine', 9)), {
    updates: captured.count, replicaValue: logicalValueAt(replica, ['tasks', 't9']),
  });
}

// G5i 批量：双 Record 键写 = 单事务单 update
{
  const fx = fixture();
  const captured = withUpdates(fx.doc, () => run(fx, {
    ops: [
      { op: 'set', path: ['tasks', 't8'], value: item('eight', 8) },
      { op: 'set', path: ['tasks', 't9'], value: item('nine', 9) },
    ],
  }));
  check('G5i', captured.result.ok === true && captured.count === 1, { result: captured.result, updates: captured.count });
}

// G5j commit 形态：封闭对象 delete 终态字节 ≡ 手写 Y.Map.delete（同 clientID）
{
  const viaApi = fixture({ clientID: 5150 });
  const apiCapture = withUpdates(viaApi.doc, () => run(viaApi, { op: 'delete', path: ['obj', 'opt'] }));
  const viaManual = fixture({ clientID: 5150 });
  const manualCapture = withUpdates(viaManual.doc, () => {
    viaManual.doc.transact(() => {
      viaManual.obj.delete('opt');
    });
  });
  check('G5j', apiCapture.count === 1 && manualCapture.count === 1
    && sameBytes(stateBytes(viaApi.doc), stateBytes(viaManual.doc))
    && sameBytes(apiCapture.events[0]!, manualCapture.events[0]!), {
    apiBytes: apiCapture.events[0]!.length, manualBytes: manualCapture.events[0]!.length,
  });
}

// G5k 反证：commit 字节 oracle 对**构造形态**敏感——逻辑等价（键序无关）但 entry 字段
//     插入序不同的 raw 构造 ⇒ 增量字节不同（防「只看逻辑值」的伪 oracle）
{
  const viaApi = fixture({ tasksN: 5, clientID: 991 });
  const apiCapture = withUpdates(viaApi.doc, () => run(viaApi, { op: 'set', path: ['tasks', 't1'], value: item('x', 1) }));
  const viaRebuild = fixture({ tasksN: 5, clientID: 991 });
  const rebuildCapture = withUpdates(viaRebuild.doc, () => {
    viaRebuild.doc.transact(() => {
      const m = new Y.Map<unknown>();
      m.set('qty', 1); // 与 Item 声明序相反（title 先 / qty 先）；逻辑值键集相同
      m.set('title', 'x');
      viaRebuild.tasks.set('t1', m);
    });
  });
  const canon = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
    if (v !== null && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return `{${Object.keys(o).sort().map((k) => `${k}:${canon(o[k])}`).join(',')}}`;
    }
    return JSON.stringify(v);
  };
  const logicalEqual = canon(logicalValueAt(viaApi.doc, ['tasks', 't1']))
    === canon(logicalValueAt(viaRebuild.doc, ['tasks', 't1']));
  check('G5k', logicalEqual && !sameBytes(apiCapture.events[0]!, rebuildCapture.events[0]!), {
    logicalEqual,
    bytesEqual: sameBytes(apiCapture.events[0]!, rebuildCapture.events[0]!),
    apiBytes: apiCapture.events[0]!.length,
    rebuildBytes: rebuildCapture.events[0]!.length,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// S1 目标接缝已存在（#440 交付；vfsl 公共导出，行为达标）
// ═══════════════════════════════════════════════════════════════════════════

{
  const recordPlan = plan(['tasks', 't1'], 'set');
  const parentReqPlan = plan(['obj', 'req'], 'delete');
  const parentOptPlan = plan(['obj', 'opt'], 'delete');
  const unionPlan = plan(['maybe', 'm1'], 'set');
  const okSet = 'kind' in recordPlan
    ? applyElementwiseEntryMutation(DERIVED, recordPlan, { has: true }, { op: 'set', value: item('x', 1) })
    : { ok: false, issues: [{ message: 'plan 拒绝', path: [] }] };
  const okDelete = 'kind' in recordPlan
    ? applyElementwiseEntryMutation(DERIVED, recordPlan, { has: true }, { op: 'delete' })
    : { ok: false, issues: [{ message: 'plan 拒绝', path: [] }] };
  const noopDelete = 'kind' in recordPlan
    ? applyElementwiseEntryMutation(DERIVED, recordPlan, { has: false }, { op: 'delete' })
    : { ok: false, issues: [{ message: 'plan 拒绝', path: [] }] };
  const parentReq = 'kind' in parentReqPlan
    ? applyElementwiseEntryMutation(DERIVED, parentReqPlan, { has: true }, { op: 'delete' })
    : { ok: false, issues: [{ message: 'plan 拒绝', path: [] }] };
  const parentOpt = 'kind' in parentOptPlan
    ? applyElementwiseEntryMutation(DERIVED, parentOptPlan, { has: true }, { op: 'delete' })
    : { ok: false, issues: [{ message: 'plan 拒绝', path: [] }] };
  const unionFail = 'kind' in unionPlan
    ? applyElementwiseEntryMutation(DERIVED, unionPlan, { has: true }, { op: 'set', value: item('x', 1) })
    : { ok: false, issues: [{ message: 'plan 拒绝', path: [] }] };
  check('S1a', okSet.ok === true && okDelete.ok === true && noopDelete.ok === false, { okSet, okDelete, noopDelete });
  check('S1b', parentReq.ok === false && parentOpt.ok === true && unionFail.ok === false, { parentReq, parentOpt, unionFail });
}

// ═══════════════════════════════════════════════════════════════════════════
// NC 负控基线：union map 位 / union 穿越仍 legacy
// ═══════════════════════════════════════════════════════════════════════════

{
  const fx = fixture();
  rawSet(fx.maybe, 'm1', 'oops');
  const r = run(fx, { op: 'set', path: ['maybe', 'm2'], value: item('mm', 6) });
  check('NC1', r.ok === false, { issues: issuesOf(r) });
}

{
  const fx = fixture();
  rawSet(fx.maybe, 'm1', 'oops');
  const r = run(fx, { op: 'delete', path: ['maybe', 'm1'] });
  check('NC2', r.ok === false, { issues: issuesOf(r) });
}

{
  const fx = fixture();
  const r = run(fx, { op: 'set', path: ['maybe', 'm2'], value: item('mm', 6) });
  check('NC3', r.ok === true, { result: r, maybe: fx.maybe.toJSON() });
}

// ═══════════════════════════════════════════════════════════════════════════

console.log(`\nchecks=${checks} failures=${failures.length}`);
if (failures.length > 0) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log('exit 0 — 全部检查命中');
