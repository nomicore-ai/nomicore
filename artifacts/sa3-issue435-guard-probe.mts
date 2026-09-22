/**
 * SA3 临时诊断探针（不落仓：/tmp）— issue #435 守卫/闸门/纯度面运行时核对。
 * 核对设计 §8.3 message 冻结表逐字落地 + E100 边界 + 纯函数性（探针非仓内测试，不进 include 面）。
 */
import {
  applyElementwiseArrayMutation,
  evaluate,
  parseVfsl,
  planMutationBoundary,
} from '/home/wangjian/nomicore-fix-issue-435/packages/vfsl/src/index.ts';
import type { ValidateResult } from '/home/wangjian/nomicore-fix-issue-435/packages/vfsl/src/index.ts';

const SCHEMA = [
  'type Item = { name: string; qty: number & Int<0, 100> };',
  'type ROOT = {',
  '  items: YArray<Item>;',
  '  uarr: YArray<Item> | YArray<string>;',
  '};',
  '',
].join('\n');

const parsed = parseVfsl(SCHEMA);
if (!parsed.ok) throw new Error('parse failed');
const evaluated = evaluate(parsed.module);
if (!evaluated.ok) throw new Error('evaluate failed');
const derived = evaluated.derived;

let failures = 0;
function check(name: string, cond: boolean, detail: string): void {
  if (cond) {
    console.log(`  [PASS] ${name}`);
  } else {
    failures += 1;
    console.log(`  [FAIL] ${name} :: ${detail}`);
  }
}

function plan(path: readonly (string | number)[], op: 'array-insert' | 'array-delete' | 'set') {
  const p = planMutationBoundary(derived, [...path], op);
  if (!p.ok) throw new Error(`plan failed: ${JSON.stringify(p.result)}`);
  return p.plan;
}
const itemsPlan = plan(['items'], 'array-insert');
const unionPlan = plan(['uarr'], 'array-insert');
const setPlan = plan(['items'], 'set');

function bytes(r: ValidateResult): string {
  return JSON.stringify(r);
}

// ── 1. 闸门 G-A：非 array 计划（kind=target）────────────────────────────────
{
  const before = JSON.stringify(setPlan);
  const r = applyElementwiseArrayMutation(derived, setPlan, { length: 0 }, { op: 'array-insert', index: 0, values: [] });
  check(
    'G-A fail closed + message 逐字',
    bytes(r) ===
      JSON.stringify({
        ok: false,
        issues: [
          {
            message:
              '逐元素数组校验仅服务 planMutationBoundary 的 array-* 计划（要求 kind=array 且 relPath 为空；实际 kind=target、relPath 长度=0）；其他计划请走 applyMutationAtBoundary',
            path: ['items'],
          },
        ],
      }),
    bytes(r),
  );
  check('A2 plan 未被突变', JSON.stringify(setPlan) === before, 'plan mutated');
}

// ── 2. 闸门 G-B：union 数组目标（node.kind=union）──────────────────────────
{
  const r = applyElementwiseArrayMutation(derived, unionPlan, { length: 1 }, { op: 'array-insert', index: 1, values: [{ name: 'b', qty: 2 }] });
  check(
    'G-B fail closed + message 逐字',
    bytes(r) ===
      JSON.stringify({
        ok: false,
        issues: [
          {
            message:
              '逐元素数组校验要求边界值节点为 array（实际 union）；union 数组目标永久走 applyMutationAtBoundary 整体验证（ADR 0033 决策 1）',
            path: ['uarr'],
          },
        ],
      }),
    bytes(r),
  );
}

// ── 3. 载体域事实守卫 F-1（-1 / NaN / 1.5 / 缺失）───────────────────────────
{
  const expected =
    '逐元素数组校验的载体域事实非法：length 必须是非负安全整数';
  for (const [label, facts] of [
    ['length=-1', { length: -1 }],
    ['length=NaN', { length: Number.NaN }],
    ['length=1.5', { length: 1.5 }],
    ['length 缺失', {} as { length: number }],
  ] as const) {
    const r = applyElementwiseArrayMutation(derived, itemsPlan, facts, { op: 'array-insert', index: 0, values: [] });
    check(
      `F-1 ${label}`,
      bytes(r) === JSON.stringify({ ok: false, issues: [{ message: expected, path: ['items'] }] }),
      bytes(r),
    );
  }
}

// ── 4. insert 载荷守卫 P-1（负 index / 非整数 / values 非数组）──────────────
{
  const expected = '逐元素数组校验载荷非法：array-insert 要求 index 为非负安全整数、values 为数组';
  const cases: Array<[string, unknown]> = [
    ['index=-1', { op: 'array-insert', index: -1, values: [] }],
    ['index=1.5', { op: 'array-insert', index: 1.5, values: [] }],
    ['values 非数组', { op: 'array-insert', index: 0, values: 'x' }],
  ];
  for (const [label, payload] of cases) {
    const r = applyElementwiseArrayMutation(
      derived,
      itemsPlan,
      { length: 2 },
      payload as Parameters<typeof applyElementwiseArrayMutation>[3],
    );
    check(
      `P-1 ${label}`,
      bytes(r) === JSON.stringify({ ok: false, issues: [{ message: expected, path: ['items'] }] }),
      bytes(r),
    );
  }
}

// ── 5. delete 载荷守卫 P-2（负 count / 非整数 index）────────────────────────
{
  const expected = '逐元素数组校验载荷非法：array-delete 要求 index 与 count 为非负安全整数';
  for (const [label, payload] of [
    ['count=-1', { op: 'array-delete', index: 0, count: -1 }],
    ['count=1.5', { op: 'array-delete', index: 0, count: 1.5 }],
    ['index=-1', { op: 'array-delete', index: -1, count: 1 }],
  ] as const) {
    const r = applyElementwiseArrayMutation(derived, itemsPlan, { length: 2 }, payload);
    check(
      `P-2 ${label}`,
      bytes(r) === JSON.stringify({ ok: false, issues: [{ message: expected, path: ['items'] }] }),
      bytes(r),
    );
  }
  // 域内 count=0 维持 legacy 谓词镜像结论（接受）
  const zero = applyElementwiseArrayMutation(derived, itemsPlan, { length: 2 }, { op: 'array-delete', index: 0, count: 0 });
  check('delete count=0 界内接受（镜像 legacy 谓词）', bytes(zero) === '{"ok":true}', bytes(zero));
}

// ── 6. E100 崩溃边界（手造 plan 缺 node）───────────────────────────────────
{
  const malformed = { prefix: ['items'], relPath: [], kind: 'array' } as unknown as Parameters<typeof applyElementwiseArrayMutation>[1];
  const r = applyElementwiseArrayMutation(derived, malformed, { length: 1 }, { op: 'array-insert', index: 0, values: [] });
  const ok = r.ok === false && r.issues.length === 1 && r.issues[0]!.path.length === 0 && r.issues[0]!.message.startsWith('VFSL-E100: 内部错误（意外异常）:');
  check('E100 收编手造 plan（path=[]、不抛错）', ok, bytes(r));
}

// ── 7. 域规则逐字 + 越界路径 ───────────────────────────────────────────────
{
  const domainInsert = applyElementwiseArrayMutation(derived, itemsPlan, { length: 1 }, { op: 'array-insert', index: 2, values: [{ name: 'a', qty: 1 }] });
  check(
    'D-I message/path 逐字（index=2 > length=1）',
    bytes(domainInsert) ===
      JSON.stringify({ ok: false, issues: [{ message: 'array-insert index 越界（不 clamp）', path: ['items', 2] }] }),
    bytes(domainInsert),
  );
  const domainDelete = applyElementwiseArrayMutation(derived, itemsPlan, { length: 1 }, { op: 'array-delete', index: 1, count: 1 });
  check(
    'D-D message/path 逐字（index=1 >= length=1）',
    bytes(domainDelete) ===
      JSON.stringify({ ok: false, issues: [{ message: 'array-delete 范围越界（不 clamp、不接受越界 no-op）', path: ['items', 1] }] }),
    bytes(domainDelete),
  );
  // 空批量 + index===length：恒等接受
  const emptyBatch = applyElementwiseArrayMutation(derived, itemsPlan, { length: 3 }, { op: 'array-insert', index: 3, values: [] });
  check('空批量 index===length 恒等接受', bytes(emptyBatch) === '{"ok":true}', bytes(emptyBatch));
  // 元素非法 rebase
  const bad = applyElementwiseArrayMutation(derived, itemsPlan, { length: 1 }, { op: 'array-insert', index: 1, values: [{ name: 'b', qty: 'x' }] });
  check(
    'E-* issue rebase [...arrayPath, index+j, ...rel]',
    bytes(bad) === JSON.stringify({ ok: false, issues: [{ message: '类型不匹配：期望 number，实际 string', path: ['items', 1, 'qty'] }] }),
    bytes(bad),
  );
}

// ── 8. 纯度：四输入零突变 ──────────────────────────────────────────────────
{
  const facts = { length: 1 };
  const payload = { op: 'array-insert' as const, index: 1, values: [{ name: 'b', qty: 2 }] };
  const snap = { plan: JSON.stringify(itemsPlan), facts: JSON.stringify(facts), payload: JSON.stringify(payload), derived: JSON.stringify(derived) };
  const r1 = applyElementwiseArrayMutation(derived, itemsPlan, facts, payload);
  const r2 = applyElementwiseArrayMutation(derived, itemsPlan, facts, payload);
  check('纯度：四输入零突变', JSON.stringify(itemsPlan) === snap.plan && JSON.stringify(facts) === snap.facts && JSON.stringify(payload) === snap.payload && JSON.stringify(derived) === snap.derived, 'input mutated');
  check('确定性：重复调用逐字节相同', bytes(r1) === bytes(r2), `${bytes(r1)} vs ${bytes(r2)}`);
}

console.log(`\n=== 汇总：failures=${failures} ===`);
process.exit(failures === 0 ? 0 : 1);
