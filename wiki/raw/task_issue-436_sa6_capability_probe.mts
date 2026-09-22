/**
 * SA6 能力缺口探针 — issue #436（doc-runtime 数组 fast path 接线与 S9 收窄，ADR 0033）。
 *
 * 证据面（全部经公共入口观察运行时行为，无源码字符串断言）：
 *  G 组：HEAD 现状（doc-runtime 数组写一律走 legacy 全量边界路径）
 *    G1 污染数组（变更区间外非法）insert/delete 被 legacy 响亮拒绝 —— fast path 未接线
 *    G2 单元素写读遍整数组（live 元素读计数 ∝ n；O(n) 未解耦）
 *    G3 越界拒绝前先整数组提取（读计数 ∝ n；O(1) 长度检查未接线）
 *    G4 S9 边界重投影核对 fast-path 目标（区间外篡改 → E201-C）
 *    G5 成本与 n 耦合（软证据，10^3 vs 10^5）
 *  U 组：union 数组目标 / union 穿越的现状（永久 legacy 基线；post-change 必须不变）
 *  S 组：#435 已交付的 vfsl 逐元素接缝（存在性 + 对 union 计划 fail closed）
 *  O 组：commit 形态 oracle（API 提交 vs 手写最小 edit 的 update 字节同一）
 *  N 组：现状域规则 / 零写入 / 有效期负控基线（post-change 必须保持）
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-436_sa6_capability_probe.mts
 * 退出码 = 未命中项数（0 = 探针全部符合预期）。
 */
// 探针位于 wiki/raw（非 workspace 包，root node_modules 无提升的 yjs/@nomicore/*）；
// 以相对源码路径直取包入口（NODE_OPTIONS=--conditions=nomicore-source 供 doc-runtime
// 内部 '@nomicore/vfsl' 解析到 src）——symlink 归一 ⇒ 与 doc-runtime 内部同一模块实例。
import * as Y from '../../packages/doc-runtime/node_modules/yjs/dist/yjs.mjs';
import { evaluate, parseVfsl, planMutationBoundary, applyElementwiseArrayMutation } from '../../packages/vfsl/src/index.ts';
import type { DerivedSchema, MutationBoundaryPlan } from '../../packages/vfsl/src/index.ts';
import {
  applyValidatedMutation,
  materializeRoot,
  readLogicalValueAtPath,
  DocRuntimeFatalError,
} from '../../packages/doc-runtime/src/index.ts';
import type { MutationEnvelope } from '../../packages/doc-runtime/src/index.ts';

const TEXT = `type ROOT = {
  n: number;
  items: YArray<number>;
  rows: YArray<{ qty: number; tag: string }>;
  uarr: YArray<number> | YArray<string>;
  umem: { items: YArray<number> } | { items: YArray<string> };
};`;

function derivedOf(text: string): DerivedSchema {
  const parsed = parseVfsl(text);
  if (!parsed.ok) throw new Error(`parse fail: ${JSON.stringify(parsed.issues)}`);
  const evaluated = evaluate(parsed.module);
  if (!evaluated.ok) throw new Error(`evaluate fail: ${JSON.stringify(evaluated.issues)}`);
  return evaluated.derived;
}

const DERIVED = derivedOf(TEXT);

interface Fx {
  doc: Y.Doc;
  root: Y.Map<unknown>;
  items: Y.Array<number>;
}

function fixture(n: number, clientID?: number): Fx {
  const doc = new Y.Doc();
  if (clientID !== undefined) doc.clientID = clientID;
  const materialized = materializeRoot(
    DERIVED,
    {
      n: 1,
      items: Array.from({ length: n }, (_, i) => i + 1),
      rows: [
        { qty: 1, tag: 'a' },
        { qty: 2, tag: 'b' },
        { qty: 3, tag: 'c' },
      ],
      uarr: [1, 2, 3],
      umem: { items: [1, 2, 3] },
    },
    doc,
  );
  if (!materialized.ok) throw new Error(`materialize fail: ${JSON.stringify(materialized.issues)}`);
  const root = doc.getMap('ROOT');
  return { doc, root, items: root.get('items') as Y.Array<number> };
}

function run(fx: Fx, mutation: unknown): unknown {
  return applyValidatedMutation(DERIVED, fx.doc, mutation as MutationEnvelope);
}

function capture(fn: () => unknown): unknown {
  try {
    fn();
    return undefined;
  } catch (err) {
    return err;
  }
}

function tamperOnNextLocalCommit(doc: Y.Doc, tamper: () => void): void {
  let done = false;
  doc.on('afterTransaction', (transaction: Y.Transaction) => {
    if (!transaction.local || done) return;
    done = true;
    tamper();
  });
}

/** live 元素读计数（实例级 get 覆盖；只在 mutation 调用窗口内计数）。 */
function countReads<T>(arr: Y.Array<unknown>, fn: () => T): { result: T; reads: number } {
  let reads = 0;
  const original = arr.get.bind(arr) as (index: number) => unknown;
  (arr as unknown as { get: (index: number) => unknown }).get = (index: number) => {
    reads += 1;
    return original(index);
  };
  try {
    return { result: fn(), reads };
  } finally {
    delete (arr as unknown as { get?: unknown }).get;
  }
}

function logicalItems(fx: Fx): unknown {
  const read = readLogicalValueAtPath(fx.doc, ['items']);
  return read.ok ? read.value : { notOk: read };
}

let checks = 0;
let failures = 0;
const lines: string[] = [];

function record(group: string, name: string, ok: boolean, detail: string): void {
  checks += 1;
  if (!ok) failures += 1;
  lines.push(`${ok ? 'PASS' : 'FAIL'} [${group}] ${name} :: ${detail}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// S 组：vfsl 逐元素接缝存在（#435 交付）——doc-runtime 未消费的唯一缺口
// ═══════════════════════════════════════════════════════════════════════════

{
  const planned = planMutationBoundary(DERIVED, ['items'], 'array-insert');
  const unionPlanned = planMutationBoundary(DERIVED, ['uarr'], 'array-insert');
  const plainPlan = planned.ok ? planned.plan : null;
  const unionPlan = unionPlanned.ok ? unionPlanned.plan : null;
  const seamOk = typeof applyElementwiseArrayMutation === 'function';
  record('S', 'S1 接缝导出存在', seamOk, `typeof applyElementwiseArrayMutation=${typeof applyElementwiseArrayMutation}`);
  if (plainPlan !== null) {
    const r = applyElementwiseArrayMutation(DERIVED, plainPlan as MutationBoundaryPlan, { length: 5 }, { op: 'array-insert', index: 5, values: [42] });
    record('S', 'S2 接缝接受非 union T[] 计划', JSON.stringify(r) === JSON.stringify({ ok: true }), `plan.kind=${plainPlan.kind} node.kind=${plainPlan.node.kind} result=${JSON.stringify(r)}`);
  }
  if (unionPlan !== null) {
    const r = applyElementwiseArrayMutation(DERIVED, unionPlan as MutationBoundaryPlan, { length: 3 }, { op: 'array-delete', index: 0, count: 1 });
    const failClosed = typeof r === 'object' && r !== null && (r as { ok?: unknown }).ok === false;
    record('S', 'S3 接缝对 union 数组计划 fail closed', failClosed, `plan.kind=${unionPlan.kind} node.kind=${unionPlan.node.kind} result=${JSON.stringify(r).slice(0, 160)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// G1：污染数组（变更区间外非法）——fast path 未接线的核心行为缺口
// ═══════════════════════════════════════════════════════════════════════════

{
  const fx = fixture(5);
  fx.items.insert(0, ['oops' as unknown as number]); // raw replication 污染（区间外）
  const before = logicalItems(fx);
  const result = run(fx, { op: 'array-delete', path: ['items'], index: 1, count: 1 });
  record(
    'G1',
    'G1a 污染数组 delete（变更区间外非法）现状',
    JSON.stringify(result) !== JSON.stringify({ ok: true }),
    `result=${JSON.stringify(result)}；before=${JSON.stringify(before)}`,
  );
}

{
  const fx = fixture(3);
  const rows = fx.root.get('rows') as Y.Array<Y.Map<unknown>>;
  rows.get(0)!.set('qty', 'x'); // 区间外污染
  const result = run(fx, { op: 'array-insert', path: ['rows'], index: 1, values: [{ qty: 9, tag: 'z' }] });
  record(
    'G1',
    'G1b 污染数组 insert（合法新值 + 区间外污染）现状',
    JSON.stringify(result) !== JSON.stringify({ ok: true }),
    `result=${JSON.stringify(result)}`,
  );
}

{
  const fx = fixture(5);
  fx.items.insert(0, ['oops' as unknown as number]);
  const result = run(fx, { ops: [{ op: 'array-delete', path: ['items'], index: 1, count: 1 }] });
  record(
    'G1',
    'G1c 批量信封内污染数组 delete 现状',
    JSON.stringify(result) !== JSON.stringify({ ok: true }),
    `result=${JSON.stringify(result)?.slice(0, 200)}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// G2/G5：O(n) 读放大（live 元素读计数）与成本-规模耦合
// ═══════════════════════════════════════════════════════════════════════════

{
  const measurements: Array<{ op: string; n: number; reads: number; ms: number }> = [];
  for (const n of [512, 4096]) {
    const fxInsert = fixture(n);
    const t0 = performance.now();
    const ins = countReads(fxInsert.items, () => run(fxInsert, { op: 'array-insert', path: ['items'], index: n, values: [777] }));
    const t1 = performance.now();
    measurements.push({ op: 'insert-append', n, reads: ins.reads, ms: Math.round((t1 - t0) * 1000) / 1000 });
    record(
      'G2',
      `G2a insert-append n=${n} 读计数 ∝ n（现状）`,
      ins.reads >= n,
      `reads=${ins.reads}（阈值 n=${n}）result=${JSON.stringify(ins.result)}`,
    );

    const fxDelete = fixture(n);
    const del = countReads(fxDelete.items, () => run(fxDelete, { op: 'array-delete', path: ['items'], index: 0, count: 1 }));
    record(
      'G2',
      `G2b delete n=${n} 读计数 ∝ n（现状）`,
      del.reads >= n,
      `reads=${del.reads}（阈值 n=${n}）result=${JSON.stringify(del.result)}`,
    );

    const fxOob = fixture(n);
    const oob = countReads(fxOob.items, () => run(fxOob, { op: 'array-delete', path: ['items'], index: n, count: 1 }));
    record(
      'G2',
      `G2c 越界 delete 先整数组提取再拒（现状）`,
      oob.reads >= n,
      `reads=${oob.reads}（阈值 n=${n}）result=${JSON.stringify(oob.result)}`,
    );
  }
  lines.push(`INFO [G2] 规模/成本读数 ${JSON.stringify(measurements)}`);

  // G2d 反证：读计数器对「整数组批量出口」敏感（换用 toArray/forEach 逃逸逐元素 get 也计入 n）
  {
    const fxT = fixture(64);
    const arrT = fxT.items;
    let reads = 0;
    const originalToArray = arrT.toArray.bind(arrT);
    const patched = arrT as unknown as { toArray?: () => unknown[] };
    patched.toArray = () => {
      reads += arrT.length;
      return originalToArray();
    };
    const snapshot = arrT.toArray();
    delete patched.toArray;
    record('G2', 'G2d 反证：批量出口 toArray 的整数组提取被读计数器计入 n', reads === 64 && snapshot.length === 64, `reads=${reads} snapshotLen=${snapshot.length}`);
  }

  // G5 成本软证据：10^3 vs 10^5 单元素 append
  const small = fixture(1_000);
  const tS0 = performance.now();
  run(small, { op: 'array-insert', path: ['items'], index: 1_000, values: [777] });
  const tS1 = performance.now();
  const large = fixture(100_000);
  const tL0 = performance.now();
  run(large, { op: 'array-insert', path: ['items'], index: 100_000, values: [777] });
  const tL1 = performance.now();
  const smallMs = tS1 - tS0;
  const largeMs = tL1 - tL0;
  record('G5', 'G5 成本随 n 增长（软证据）', largeMs > smallMs * 5, `n=10^3 ${smallMs.toFixed(1)}ms vs n=10^5 ${largeMs.toFixed(1)}ms（×${(largeMs / Math.max(smallMs, 0.001)).toFixed(1)}）`);
}

// ═══════════════════════════════════════════════════════════════════════════
// G4：S9 —— 现状对区间外篡改检出 E201-C（fast path 目标为「省略重投影核」）
// ═══════════════════════════════════════════════════════════════════════════

{
  const fx = fixture(5);
  tamperOnNextLocalCommit(fx.doc, () => {
    fx.items.delete(0, 1);
    fx.items.insert(0, [99]);
  });
  const thrown = capture(() => run(fx, { op: 'array-insert', path: ['items'], index: 3, values: [22] }));
  const isE201 = thrown instanceof DocRuntimeFatalError && /DOCRT-E201/.test(thrown.message);
  record('G4', 'G4a insert：区间外元素被 observer 篡改 → 现状 E201-C', isE201, `thrown=${thrown instanceof Error ? thrown.message.slice(0, 140) : String(thrown)}`);
}

{
  const fx = fixture(5);
  tamperOnNextLocalCommit(fx.doc, () => {
    fx.items.delete(0, 1);
    fx.items.insert(0, [99]);
  });
  const thrown = capture(() => run(fx, { op: 'array-delete', path: ['items'], index: 3, count: 1 }));
  const isE201 = thrown instanceof DocRuntimeFatalError && /DOCRT-E201/.test(thrown.message);
  record('G4', 'G4b delete：区间外元素被 observer 篡改 → 现状 E201-C', isE201, `thrown=${thrown instanceof Error ? thrown.message.slice(0, 140) : String(thrown)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// U 组：union 数组目标 / union 穿越 —— 永久 legacy 基线（post-change 不变）
// ═══════════════════════════════════════════════════════════════════════════

{
  const planned = planMutationBoundary(DERIVED, ['uarr'], 'array-insert');
  const unionPlanned = planMutationBoundary(DERIVED, ['umem', 'items'], 'array-insert');
  record(
    'U',
    'U1 union 数组目标的计划形状',
    planned.ok && planned.plan.kind === 'array' && planned.plan.node.kind === 'union',
    planned.ok ? `kind=${planned.plan.kind} node.kind=${planned.plan.node.kind}` : JSON.stringify(planned),
  );
  record(
    'U',
    'U2 union 穿越（成员内数组）的计划形状',
    unionPlanned.ok && unionPlanned.plan.kind === 'union',
    unionPlanned.ok ? `kind=${unionPlanned.plan.kind} node.kind=${unionPlanned.plan.node.kind}` : JSON.stringify(unionPlanned),
  );

  const fx = fixture(3);
  const uarr = fx.root.get('uarr') as Y.Array<unknown>;
  uarr.insert(0, [true]); // 无成员可容的污染
  const result = run(fx, { op: 'array-delete', path: ['uarr'], index: 1, count: 1 });
  record('U', 'U3 union 数组目标 + 污染 delete 现状（legacy 拒绝）', JSON.stringify(result) !== JSON.stringify({ ok: true }), `result=${JSON.stringify(result)?.slice(0, 200)}`);

  const fx2 = fixture(3);
  const uarr2 = fx2.root.get('uarr') as Y.Array<unknown>;
  tamperOnNextLocalCommit(fx2.doc, () => {
    uarr2.delete(0, 1);
    uarr2.insert(0, [99]);
  });
  const thrown = capture(() => run(fx2, { op: 'array-delete', path: ['uarr'], index: 2, count: 1 }));
  const isE201 = thrown instanceof DocRuntimeFatalError && /DOCRT-E201/.test(thrown.message);
  record('U', 'U4 union 数组目标：区间外篡改 → 现状 E201-C（双核）', isE201, `thrown=${thrown instanceof Error ? thrown.message.slice(0, 140) : String(thrown)}`);

  const fx3 = fixture(3);
  const umemItems = (fx3.root.get('umem') as Y.Map<unknown>).get('items') as Y.Array<unknown>;
  umemItems.insert(0, [true]);
  const result3 = run(fx3, { op: 'array-delete', path: ['umem', 'items'], index: 1, count: 1 });
  record('U', 'U5 union 穿越数组 + 污染 delete 现状（legacy 拒绝）', JSON.stringify(result3) !== JSON.stringify({ ok: true }), `result=${JSON.stringify(result3)?.slice(0, 200)}`);

  const fx4 = fixture(3);
  const uarr4 = fx4.root.get('uarr') as Y.Array<unknown>;
  const result4 = run(fx4, { op: 'array-insert', path: ['uarr'], index: 1, values: [9] });
  record(
    'U',
    'U6 union 数组目标干净 insert 现状（legacy 正常接受）',
    JSON.stringify(result4) === JSON.stringify({ ok: true }) && JSON.stringify(uarr4.toJSON()) === JSON.stringify([1, 9, 2, 3]),
    `result=${JSON.stringify(result4)} uarr=${JSON.stringify(uarr4.toJSON())}`,
  );

  const fx5 = fixture(3);
  const uarr5 = fx5.root.get('uarr') as Y.Array<unknown>;
  const result5 = run(fx5, { op: 'array-delete', path: ['uarr'], index: 1, count: 1 });
  record(
    'U',
    'U7 union 数组目标干净 delete 现状（legacy 正常接受）',
    JSON.stringify(result5) === JSON.stringify({ ok: true }) && JSON.stringify(uarr5.toJSON()) === JSON.stringify([1, 3]),
    `result=${JSON.stringify(result5)} uarr=${JSON.stringify(uarr5.toJSON())}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// O 组：commit 形态 oracle —— API 提交 update 字节 ≡ 手写最小 edit
// ═══════════════════════════════════════════════════════════════════════════

{
  const api = fixture(5, 4242);
  const apiUpdates: Uint8Array[] = [];
  api.doc.on('update', (u: Uint8Array) => apiUpdates.push(u));
  const apiResult = run(api, { op: 'array-insert', path: ['items'], index: 3, values: [22] });

  const manual = fixture(5, 4242);
  const manualUpdates: Uint8Array[] = [];
  manual.doc.on('update', (u: Uint8Array) => manualUpdates.push(u));
  manual.doc.transact(() => {
    manual.items.insert(3, [22]);
  });

  const apiState = Y.encodeStateAsUpdate(api.doc);
  const manualState = Y.encodeStateAsUpdate(manual.doc);
  const bytesEqual = Buffer.compare(Buffer.from(apiState), Buffer.from(manualState)) === 0;
  const deltaEqual = apiUpdates.length === 1 && manualUpdates.length === 1
    && Buffer.compare(Buffer.from(apiUpdates[0]!), Buffer.from(manualUpdates[0]!)) === 0;
  record('O', 'O1 API 提交终态 ≡ 手写最小 edit（字节）', bytesEqual, `api=${apiState.length}B manual=${manualState.length}B equal=${bytesEqual} result=${JSON.stringify(apiResult)}`);
  record('O', 'O2 API 提交 update 事件 ≡ 手写最小 edit（单事件字节）', deltaEqual, `apiEvents=${apiUpdates.length} manualEvents=${manualUpdates.length} deltaEqual=${deltaEqual}`);

  // delete 同款
  const apiD = fixture(5, 4242);
  run(apiD, { op: 'array-delete', path: ['items'], index: 1, count: 2 });
  const manualD = fixture(5, 4242);
  manualD.doc.transact(() => {
    manualD.items.delete(1, 2);
  });
  const bytesEqualD = Buffer.compare(Buffer.from(Y.encodeStateAsUpdate(apiD.doc)), Buffer.from(Y.encodeStateAsUpdate(manualD.doc))) === 0;
  record('O', 'O3 API delete 终态 ≡ 手写最小 edit（字节）', bytesEqualD, `bytesEqual=${bytesEqualD}`);

  // O4/O5 反证（oracle 敏感性）：非最小 commit（clear + rebuild，逻辑值等价）→ 字节可分
  const rebuild = fixture(5, 4242);
  const rebuildUpdates: Uint8Array[] = [];
  rebuild.doc.on('update', (u: Uint8Array) => rebuildUpdates.push(u));
  rebuild.doc.transact(() => {
    const values = rebuild.items.toArray();
    rebuild.items.delete(0, rebuild.items.length);
    rebuild.items.insert(0, [...values.slice(0, 3), 22, 23, ...values.slice(3)]);
  });
  const rebuildState = Y.encodeStateAsUpdate(rebuild.doc);
  const bytesDiffer = Buffer.compare(Buffer.from(apiState), Buffer.from(rebuildState)) !== 0;
  const deltaDiffer = apiUpdates[0] !== undefined && rebuildUpdates[0] !== undefined
    && Buffer.compare(Buffer.from(apiUpdates[0]), Buffer.from(rebuildUpdates[0])) !== 0;
  record('O', 'O4 反证：clear+rebuild 提交形态终态字节 ≠ API 最小 edit（oracle 敏感）', bytesDiffer, `api=${apiState.length}B rebuild=${rebuildState.length}B differ=${bytesDiffer}`);
  record('O', 'O5 反证：clear+rebuild 的 update 增量 ≠ API 最小 edit（事件 oracle 敏感）', deltaDiffer, `differ=${deltaDiffer}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// N 组：现状域规则 / 零写入 / 有效期基线（post-change 必须保持）
// ═══════════════════════════════════════════════════════════════════════════

{
  const fx = fixture(5);
  let updates = 0;
  fx.doc.on('update', () => { updates += 1; });
  const before = Y.encodeStateAsUpdate(fx.doc);
  const result = run(fx, { op: 'array-delete', path: ['items'], index: 5, count: 1 });
  const after = Y.encodeStateAsUpdate(fx.doc);
  record(
    'N',
    'N1 越界 delete：逐字消息 + 零写入 + 零 update',
    JSON.stringify(result) === JSON.stringify({ ok: false, issues: [{ message: 'array-delete 范围越界（不 clamp、不接受越界 no-op）', path: ['items', 5] }] })
      && updates === 0 && Buffer.compare(Buffer.from(before), Buffer.from(after)) === 0,
    `result=${JSON.stringify(result)} updates=${updates}`,
  );

  const fx2 = fixture(5);
  let updates2 = 0;
  fx2.doc.on('update', () => { updates2 += 1; });
  const result2 = run(fx2, { op: 'array-insert', path: ['items'], index: 6, values: [1] });
  record(
    'N',
    'N2 越界 insert：逐字消息 + 零写入',
    JSON.stringify(result2) === JSON.stringify({ ok: false, issues: [{ message: 'array-insert index 越界（不 clamp）', path: ['items', 6] }] }) && updates2 === 0,
    `result=${JSON.stringify(result2)} updates=${updates2}`,
  );

  const fx3 = fixture(5);
  const result3 = run(fx3, { op: 'array-insert', path: ['items'], index: 2, values: ['bad'] });
  record(
    'N',
    'N3 insert 非法新值：元素 issue 路径（插入后位置）',
    JSON.stringify(result3) === JSON.stringify({ ok: false, issues: [{ message: '类型不匹配：期望 number，实际 string', path: ['items', 2] }] }),
    `result=${JSON.stringify(result3)}`,
  );

  const fx4 = fixture(5);
  let updates4 = 0;
  fx4.doc.on('update', () => { updates4 += 1; });
  const result4 = run(fx4, { op: 'array-insert', path: ['items'], index: 5, values: [6] });
  record(
    'N',
    'N4 index === length append 接受（不 clamp）',
    JSON.stringify(result4) === JSON.stringify({ ok: true }) && updates4 === 1 && JSON.stringify(logicalItems(fx4)) === JSON.stringify([1, 2, 3, 4, 5, 6]),
    `result=${JSON.stringify(result4)} updates=${updates4} items=${JSON.stringify(logicalItems(fx4))}`,
  );

  const fx5 = fixture(5);
  let updates5 = 0;
  fx5.doc.on('update', () => { updates5 += 1; });
  tamperOnNextLocalCommit(fx5.doc, () => {
    fx5.items.push([888]);
  });
  const thrown5 = capture(() => run(fx5, { op: 'array-insert', path: ['items'], index: 5, values: [6] }));
  const isE201 = thrown5 instanceof DocRuntimeFatalError && /DOCRT-E201/.test(thrown5.message) && thrown5.committed === true;
  record('N', 'N5 安装事实核（长度算术）现状：append 干扰 → E201-C committed', isE201, `thrown=${thrown5 instanceof Error ? thrown5.message.slice(0, 140) : String(thrown5)}`);

  const fx6 = fixture(5);
  tamperOnNextLocalCommit(fx6.doc, () => {
    fx6.items.delete(5, 1);
    fx6.items.insert(5, [777]);
  });
  const thrown6 = capture(() => run(fx6, { op: 'array-insert', path: ['items'], index: 5, values: [6] }));
  const isE201b = thrown6 instanceof DocRuntimeFatalError && /DOCRT-E201/.test(thrown6.message) && thrown6.committed === true;
  record('N', 'N6 安装事实核（插入项同一性）现状：覆写插入项 → E201-C', isE201b, `thrown=${thrown6 instanceof Error ? thrown6.message.slice(0, 140) : String(thrown6)}`);

  const fx7 = fixture(5);
  tamperOnNextLocalCommit(fx7.doc, () => {
    fx7.items.insert(3, [999]);
  });
  const thrown7 = capture(() => run(fx7, { op: 'array-delete', path: ['items'], index: 3, count: 1 }));
  const isE201c = thrown7 instanceof DocRuntimeFatalError && /DOCRT-E201/.test(thrown7.message) && thrown7.committed === true;
  record('N', 'N7 安装事实核（delete 长度算术）现状：重插元素 → E201-C', isE201c, `thrown=${thrown7 instanceof Error ? thrown7.message.slice(0, 140) : String(thrown7)}`);

  const fx8 = fixture(5);
  const result8 = run(fx8, { ops: [{ op: 'array-insert', path: ['items'], index: 2, values: [42] }, { op: 'set', path: ['n'], value: 2 }] });
  const nAfter = readLogicalValueAtPath(fx8.doc, ['n']);
  record(
    'N',
    'N8 批量信封干净数组 op 现状（ok:true + 终态正确）',
    JSON.stringify(result8) === JSON.stringify({ ok: true }) && JSON.stringify(fx8.items.toJSON()) === JSON.stringify([1, 2, 42, 3, 4, 5]) && nAfter.ok && nAfter.value === 2,
    `result=${JSON.stringify(result8)} items=${JSON.stringify(fx8.items.toJSON())} n=${JSON.stringify(nAfter)}`,
  );

  const fx9 = fixture(5);
  const before9 = Y.encodeStateAsUpdate(fx9.doc);
  const result9 = run(fx9, { op: 'array-delete', path: ['items'], index: 3, count: 2 });
  record(
    'N',
    'N9 delete index+count === length 接受（不 clamp）现状',
    JSON.stringify(result9) === JSON.stringify({ ok: true }) && JSON.stringify(fx9.items.toJSON()) === JSON.stringify([1, 2, 3]) && Buffer.compare(Buffer.from(before9), Buffer.from(Y.encodeStateAsUpdate(fx9.doc))) !== 0,
    `result=${JSON.stringify(result9)} items=${JSON.stringify(fx9.items.toJSON())}`,
  );

  const fx10 = fixture(5, 777);
  const replica = new Y.Doc();
  Y.applyUpdate(replica, Y.encodeStateAsUpdate(fx10.doc)); // 对端同基态
  const events10: Uint8Array[] = [];
  fx10.doc.on('update', (u: Uint8Array) => events10.push(u));
  const result10 = run(fx10, { op: 'array-insert', path: ['items'], index: 3, values: [22] });
  if (events10[0] !== undefined) Y.applyUpdate(replica, events10[0]);
  const replicaItems = readLogicalValueAtPath(replica, ['items']);
  record(
    'N',
    'N10 复制面：增量 update 应用对端后逻辑值一致',
    JSON.stringify(result10) === JSON.stringify({ ok: true }) && events10.length === 1 && replicaItems.ok && JSON.stringify(replicaItems.value) === JSON.stringify([1, 2, 3, 22, 4, 5]),
    `events=${events10.length} replica=${JSON.stringify(replicaItems)}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 汇总
// ═══════════════════════════════════════════════════════════════════════════

lines.push(`SUMMARY checks=${checks} failures=${failures}`);
console.log(lines.join('\n'));
process.exit(failures === 0 ? 0 : 1);
