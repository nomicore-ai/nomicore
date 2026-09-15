/**
 * issue #382（ADR 0029 缝 1）lease 面 `where` 无静默通过 —— 条件不变式（耐久形态）。
 *
 * 契约来源：
 * - SA6 验收契约 `wiki/raw/task_issue-382_sa6_contract.md` §12.5 P4：lease `where` 调用
 *   **若 `ok:true`，则返回条目必须全部满足谓词**（禁止静默未过滤通过）；**若 `ok:false`，
 *   则码必须是 `WINDOW_OPTIONS_INVALID`**；
 * - SA8 前置门禁 `wiki/raw/task_issue-382_conflict_report.md` A2（缝序一致性）：缝 1 落地
 *   后、缝 2 落地前的中间态，lease 面实传 `where` 必须**响亮失败**，不得静默落到
 *   「未过滤四键成功面」；SA8 设计后复审 `task_issue-382_design_conflict_report.md` A2′
 *   （该响亮由 `composeWindowRead` 入口 fail-closed 分支保证）；
 * - `docs/adr/0029-filtered-window-read.md` §5（`total` 恒不承诺；`truncated` 双语义与
 *   ✂ 规则属缝 2）。
 *
 * 形态选择（SA6 §12.5 P4 明文）：本文件是**条件不变式**而非「缝 1 后必须 ok:false」的严格
 * 断言——缝 2 落地（lease 面接收 `where`、truncated 双语义、✂ 永不装配、S3 镜像扩展）后本
 * 文件**无需退役**：缝 2 态下 `ok:true` 的条目仍必须全部满足谓词，缝 1 态下失败码恒为
 * `WINDOW_OPTIONS_INVALID`。严格形态（缝 1 期间 lease where 必须 `ok:false`）只作实现期
 * 审计证据（SA6 §12.3.7 F7），不写成会随缝 2 变红的持久测试。
 *
 * 断言纪律：全部锚定运行时行为（结果联合、条目值、own 键集、`truncated`）；fixture 复用
 * #369 窗口读共享 fixture（同一目录、非测试文件）；零 skip/only/todo、零 env override、
 * 零 fallback、零源码字符串断言。
 */
import { describe, expect, it } from 'vitest';
import type {
  NamespaceLeaseReadArrayResult,
  NamespaceLeaseReadMapResult,
} from '@nomicore/namespace-registry';
// 成功形状经集中化 helper 表达（issue #333/#336/#364 恒四键断言收敛门；family B 零字面量）。
import { expectReadDataOkKeys } from '../../namespace-runtime/test/helpers/readdata-ok-shape.js';
import { makeWindowLease, type WindowLeaseFixture } from './issue-369-window-read-fixture.js';

/** 谓词项（v1 单段字面键 + 标量闭集等值；本文件只消费公开语义）。 */
interface WherePredicate {
  readonly field: string;
  readonly equals: string | number | boolean | null;
}

/** 条目值的单段字段读（descriptor 读；条目值是投影产物 plain 记录）。 */
function fieldOf(value: unknown, field: string): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const desc = Object.getOwnPropertyDescriptor(value as Record<string, unknown>, field);
    if (desc !== undefined && desc.enumerable === true && desc.get === undefined) return desc.value;
  }
  return undefined;
}

type LeaseWindowResult = NamespaceLeaseReadMapResult | NamespaceLeaseReadArrayResult;

/**
 * 条件不变式断言（SA6 §12.5 P4 逐字）：
 * - `ok:true`（缝 2 态）⟹ 条目必须全部满足谓词——静默未过滤通过即红；
 * - `ok:false`（缝 1 中间态）⟹ 码必须是 `WINDOW_OPTIONS_INVALID`——缝 1 的 where 已在 W1
 *   生效，组合层绝不得回落未过滤成功面，也绝不得改判其它码。
 */
function expectNoSilentPass(result: LeaseWindowResult, predicate: WherePredicate, label: string): void {
  if (result.ok === true) {
    for (const entry of result.value) {
      expect(
        fieldOf(entry.value, predicate.field),
        `${label}：ok:true 的条目必须满足谓词（禁止静默未过滤通过）`,
      ).toBe(predicate.equals);
    }
    return;
  }
  expect(result.code, `${label}：缝 1 中间态必须响亮（WINDOW_OPTIONS_INVALID）`).toBe('WINDOW_OPTIONS_INVALID');
}

async function withLease(run: (fixture: WindowLeaseFixture) => void): Promise<void> {
  const fixture = await makeWindowLease();
  try {
    run(fixture);
  } finally {
    await fixture.lease.release();
    await fixture.registry.shutdown();
  }
}

describe('issue #382 lease 面 where 无静默通过（条件不变式；SA6 §12.5 P4 / SA8 A2）', () => {
  it('键面：lease.readMap(…, {n, where}) 绝不静默未过滤通过（缝 1 响亮 / 缝 2 已过滤）', async () => {
    await withLease(({ lease }) => {
      expectNoSilentPass(
        lease.readMap(['tasks'], { n: 2, where: [{ field: 'priority', equals: 5 }] }),
        { field: 'priority', equals: 5 },
        'readMap priority=5',
      );
      expectNoSilentPass(
        lease.readMap(['tasks'], { n: 3, where: [{ field: 'title', equals: 'beta' }] }),
        { field: 'title', equals: 'beta' },
        'readMap title=beta',
      );
    });
  });

  it('数组面：lease.readArray(…, {n, where}) 同款（标量元素全安静不匹配时亦不得静默未过滤）', async () => {
    await withLease(({ lease }) => {
      expectNoSilentPass(
        lease.readArray(['taskList'], { n: 2, where: [{ field: 'priority', equals: 2 }] }),
        { field: 'priority', equals: 2 },
        'readArray taskList priority=2',
      );
      expectNoSilentPass(
        lease.readArray(['workRecords'], { n: 2, where: [{ field: 'state', equals: 'claimed' }] }),
        { field: 'state', equals: 'claimed' },
        'readArray workRecords state=claimed（标量元素 ⇒ 缝 2 态零匹配）',
      );
    });
  });

  it('负控：无 where 的 lease 四键基线不变（own 键集 / truncated === kept < total）', async () => {
    await withLease(({ lease }) => {
      const result = lease.readMap(['tasks'], { n: 2 });
      expect(result.ok, `无 where 基线应成功：${JSON.stringify(result)}`).toBe(true);
      if (result.ok !== true) throw new Error('unreachable');
      // 恒四键 own 键集经集中化形状 helper 断言（禁止就地字面量；#333/#336/#364 收敛门）。
      expectReadDataOkKeys(result);
      expect(result.value.map((entry) => entry.key)).toEqual(['t1', 't2']);
      expect(result.truncated).toBe(true); // kept 2 < total 3（P1 语义零回归）
      expect('total' in (result as object)).toBe(false); // lease 恒四键：total 不上 lease 结算（F2）
    });
  });
});
