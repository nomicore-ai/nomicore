# SA3 Implementation Report — issue #437：lease 端到端数组逐元素校验行为钉死（ADR 0033）

- 角色：SA3（TDD 执行者，iteration 0）
- 基线 HEAD：`02c7cfb`（含 #435 `006e416`、#436 `f61e583`）
- 任务类型：**feature（测试立法）** —— 生产实现零改动
- 结论：**完成**。SA6 冻结三件套（契约 13 + 负控 7）+ 探针按设计原样采纳，聚焦套件
  20/20 绿、探针 32/32 exit 0、根 `pnpm typecheck` exit 0、宽 tsc exit 0、
  根 `pnpm test` 466 files / 5667 tests 全绿（两新文件被真实收集）；生产面零 diff。

---

## Inputs consumed

| 输入 | 存在性 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-437.md`（任务简报，AC1–AC6；Comments 节空） | ✓ | 需求面 |
| `wiki/raw/task_issue-437_design.md`（SA1 设计，354 行） | ✓ | 实施依据（ALLOW/DENY、§7.6 采纳政策、§9 门禁） |
| `wiki/raw/task_issue-437_sa2_review.md`（SA2 review） | ✓ | verdict approve；无 BLOCKER/MAJOR；4 MINOR 观察 |
| `wiki/raw/task_issue-437_sa6_contract.md`（SA6 契约，approve） | ✓ | 红灯契约、冻结指纹 §16、门禁清单 §13 |
| `wiki/raw/task_issue-437_sa6_capability_probe.mts` | ✓ | 独立证据通道（32 项） |
| 冻结三件套（契约/负控/夹具） | ✓ | 采纳为实现交付物（md5 复核一致） |
| `task_issue-437_relevant_decisions.md` / `_conflict_report.md` / `_design_conflict_report.md` | ✗（不存在） | iteration 0 无 SA8 工件；无冲突复查输入 |
| Owner comments | ✗（REST issue-comment read `[]`） | 无 owner comment 需求面 |
| 既有 `wiki/raw/task_issue-437_sa3_impl.md` | ✗（首次落位） | 无既有实现待修订 |

---

## Existing worktree reconciliation

- 工作树起点 = SA6 落位状态：**全部为 untracked 新增**（三件套 + 探针 + wiki 四件 +
  `artifacts/sa6-issue437-*.log`）；`git diff`（tracked 面）为空。
- **无既有 SA3 报告、无未提交实现改动** → 无过时/冲突实现需要修正或删除。
- 冻结指纹逐件复核（md5，与 SA6 契约 §16 声称值逐字一致）：

| 冻结件 | md5 | SA6 §16 声称值 | 一致 |
|---|---|---|---|
| `packages/namespace-registry/test/issue-437-lease-array-e2e-contract.test.ts` | `62de8c3109d5bce2dffe328034e2129c` | `62de8c31…` | ✓ |
| `packages/namespace-registry/test/issue-437-lease-array-e2e-control.test.ts` | `34f5003938b3db5a3b1c8f97a9c4f034` | `34f50039…` | ✓ |
| `packages/namespace-registry/test/issue-437-lease-array-e2e-fixture.ts` | `9fa5995f24833b96ec848ca654ccb1dc` | `9fa5995f…` | ✓ |
| `wiki/raw/task_issue-437_sa6_capability_probe.mts` | `3b647b42dda08554d679efacbbb42674` | `3b647b42…` | ✓ |

- 实物规模复核：契约文件 13 个 `it()`、负控 7 个 `it()`，与设计 §7.2 矩阵逐一对应
  （AC1-a..e、AC2-a/b/d/c、AC4-a/b、AC5-a/b；C1–C7）。
- 采纳政策（设计 §7.6）：**原样采纳，未改写、未重排、未软化任何断言**；SA3 未触碰
  三件套/探针内容（md5 复跑后不变）。

### 判据纪律 sweep（实现阶段守约复核）

| 检查 | 结果 |
|---|---|
| `.skip` / `.only` / `.todo` / `it.each` | 零命中（三件套 + 探针） |
| `process.env` 分支 | 零命中 |
| `setTimeout` 真实时钟竞猜 | 零命中（仅注释中作为「零 setTimeout 竞猜」的纪律声明出现） |
| 源码字符串断言 | 零命中；断言只观察 lease 判别联合 / issue message·path / `readData` 逻辑值 / owned update 字节与收敛 / 诊断 record·carrier / session 状态面 |
| 吞错 `catch` | 零命中；夹具唯一 `try` 是 `countElementReadsAsync` 的 `finally` 包装复位（读计数，非吞错） |
| 发现面真实入口 | 三件套两 `*.test.ts` 匹配根 `vitest.config.ts` include；fixture 非测试入口 |

---

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `artifacts/sa3-issue437-focused.log` | §10 ALLOW「`artifacts/sa3-issue437-*.log`（实现阶段新增）」 | 聚焦套件证据（20/20） |
| `artifacts/sa3-issue437-probe.log` | 同上 | 探针证据（32/32 exit 0） |
| `artifacts/sa3-issue437-root-typecheck.log` | 同上 | 根 `pnpm typecheck` 证据（exit 0） |
| `artifacts/sa3-issue437-wide-typecheck.log` | 同上 | 宽 tsc 测试源类型面证据（exit 0） |
| `artifacts/sa3-issue437-root-test.log` | 同上 | 根 `pnpm test` 证据（466/5667 全绿） |
| `wiki/raw/task_issue-437_sa3_impl.md` | §10 ALLOW（SA3 固定产物位，本报告） | 新建实现报告 |

**实现交付物（SA3 零改动，原样采纳 SA6 冻结件）**：

| Path | md5 | 角色 |
|---|---|---|
| `packages/namespace-registry/test/issue-437-lease-array-e2e-contract.test.ts` | `62de8c31…` | lease seam 契约 13 tests（AC1-a..e / AC2-a..d / AC4-a/b / AC5-a/b） |
| `packages/namespace-registry/test/issue-437-lease-array-e2e-control.test.ts` | `34f50039…` | 负控 7 tests（C1–C7；A/B 对照 + union legacy 结构性锚） |
| `packages/namespace-registry/test/issue-437-lease-array-e2e-fixture.ts` | `9fa5995f…` | 共享装置（非测试入口，零 vitest 依赖） |
| `wiki/raw/task_issue-437_sa6_capability_probe.mts` | `3b647b42…` | 独立证据通道（tsx；G0/G1 + P1–P5） |

---

## SA2 Finding落实

`wiki/raw/task_issue-437_sa2_review.md` §13 **Required revisions 为空表**——无 BLOCKER、
无 MAJOR。§14 四条 MINOR 观察落实如下（均不要求修改三件套；设计 §7.6 第 3 条只允许
因评审 finding 落实而修改，且须重冻结 md5）：

| Finding ID | 严重度 | 实现 | 结果 |
|---|---|---|---|
| O-1（§7.7 理由性表述与事实不符） | MINOR | 按 SA2 建议在实现 notes 更正，**不动三件套**：`packages/namespace-registry/package.json:27` 确含 `"@nomicore/namespace-diagnostic-log": "workspace:*"`，设计 §7.7「依赖层 registry 不依赖 diagnostic-log 包名」不成立；夹具的**实践**（相对源路径直引该包公共 `src/index.js`）与 registry 测试面既有惯例一致（`registry-create-diagnostic-red.test.ts:95`、`registry-issue-249-pump-red.test.ts:67`、`issue-393-ndcl-self-binding-red.test.ts:59`、`registry-issue-226-red.test.ts:66`、`diag-pump-scheduler-injection.test.ts:3` 共 5 处实锚），引用的是公共 index、非内部 subpath，且宽 tsc + 根测试双绿。理由表述更正为：「沿 registry 测试面既有惯例直引源码 index，以在 `--conditions=nomicore-source` 下取源码形态（模块实例同一），引用面为该包公共 index。」 | 更正已记录于本报告；三件套 md5 不变 |
| O-2（§7.2 矩阵 AC2 排序 a/b/c/d vs 文件实际 a/b/d/c） | MINOR | 纯文档排序差异；各 test 独立夹具、互不依赖，语义零差。冻结件按 SA6 实际声明序（AC2-a、AC2-b、AC2-d、AC2-c）原样采纳 | 不改文件；无语义差异 |
| O-3（§8 L1「fixture 生命周期随 registry 关闭」措辞） | MINOR | 测试未显式 close/shutdown registry（与包内主流惯例一致：受控 fake scheduler 零真实 timer，无泄漏面）；措辞应为「fixture 生命周期随测试进程结束；受控 scheduler 零真实 timer」 | 不改文件；措辞更正记录于此 |
| O-4（探针经 `node_modules/yjs` 直取模块实例） | MINOR | 探针为冻结证据件、不在测试发现面；本轮复跑 exit 0（依赖布局未变） | 探针 32/32 绿，无动作 |

---

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `artifacts/sa3-issue437-focused.log` | 设计 §10 ALLOW：`artifacts/sa3-issue437-*.log`（实现阶段新增） | 聚焦门禁证据 |
| `artifacts/sa3-issue437-probe.log` | 同上 | 探针证据 |
| `artifacts/sa3-issue437-root-typecheck.log` | 同上 | 根 typecheck 证据 |
| `artifacts/sa3-issue437-wide-typecheck.log` | 同上 | 宽 tsc 证据 |
| `artifacts/sa3-issue437-root-test.log` | 同上 | 根 test 证据 |
| `wiki/raw/task_issue-437_sa3_impl.md` | 技能固定产物位 + 设计 §10 ALLOW（`wiki/raw/` 证据面） | 实现报告 |

未新增/修改任何其他路径。**DENY LIST 未被触碰**：`git diff`（tracked 面）为空；
`git diff --name-only -- 'packages/*/src' 'apps' 'domains' 'vitest.config.ts' 'tsconfig*.json'
'package.json' 'packages/*/package.json'` 输出为空；`git status --short` 仅含 SA6 落位的
untracked 新增与本轮新增的 5 个证据日志 + 本报告。

---

## Verification

| Command | Result | Evidence |
|---|---|---|
| `md5sum` 四件冻结件 | 与 SA6 §16 逐字一致（见上表） | 本报告 §Existing worktree reconciliation |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/namespace-registry/test/issue-437-lease-array-e2e-contract.test.ts packages/namespace-registry/test/issue-437-lease-array-e2e-control.test.ts`（SA6/设计 §9 指定的聚焦红灯契约） | **2 passed (2) / 20 passed (20)**（契约 13 + 负控 7）、`Type Errors no errors`、`FOCUSED_EXIT:0` | `artifacts/sa3-issue437-focused.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-437_sa6_capability_probe.mts`（独立通道敏感性复核） | **32/32 命中、`failures=0`、`PROBE_EXIT:0`**；P5a fast=0 / P5b legacy=191（n=64） | `artifacts/sa3-issue437-probe.log` |
| `pnpm typecheck`（根 15 包） | **exit 0**（`TYPECHECK_EXIT:0`） | `artifacts/sa3-issue437-root-typecheck.log` |
| `pnpm exec tsc -p tsconfig.typecheck.json --noEmit`（含 `packages/*/test/**` 的测试源类型面） | **exit 0**（`WIDE_TSC_EXIT:0`，契约/夹具/负控零 TS 噪声） | `artifacts/sa3-issue437-wide-typecheck.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck`（= 根 `pnpm test`） | **466 files / 5667 tests 全绿**、`Type Errors no errors`、`ROOT_TEST_EXIT:0`；两新文件被真实收集：L378 `issue-437-lease-array-e2e-contract.test.ts (13 tests)`、L584 `issue-437-lease-array-e2e-control.test.ts (7 tests)` | `artifacts/sa3-issue437-root-test.log` |
| `git diff` / `git diff --name-only -- <生产与配置面>` / `git status --short`（生产零改动核对） | tracked 面 diff 为空；生产与配置面 changed paths 为空；仅 untracked 新增（测试三件套 + 探针 + wiki + 证据日志） | 本节「File scope check」；`git status --short` 输出 |

**红灯转绿说明**：本票为 test-only 立法任务，SA6 冻结契约在 HEAD `02c7cfb` 本就是
「目标行为已实现、缺回归锚」面（旧实现 `7407ce0` 判别组 6 红/14 绿，SA6 §13 证据）。
SA3 在实现阶段原样采纳并复跑指定门禁：**聚焦红灯契约 20/20 转绿（本实现下无红）**，
未以 fallback、env override、skip、软化断言或修改验收语义取得绿色；三件套与探针
md5 复跑后与冻结值一致。

---

## Deferred verification

SA3 职责范围外（本报告不主张已验证，交由 SA4/SA7 与后续票）：

1. **旧实现判别组复跑**（`7407ce0` detached worktree）：SA6 已提供 3 轮稳定证据
   （6 红/14 绿，红集 = AC1-a..e + AC2-d，md5 `762f1f30…`）；SA3 未重建基线 worktree
   复跑（设计 §9 未将其列为实现阶段门禁；方法学保留于 SA6 §4/§7）。
2. **聚焦套件重复稳定性轮**：SA6 已提供 HEAD 5 轮 20/20；SA3 本轮单轮 20/20 绿。
3. **线级（ws transport / wire-frame）复制烟测、并发/多写者数组写竞争、n≥512 性能基准**：
   设计 §12 与 SA6 §15 明示为票外残余（分别引 ADR 0033「协议零改动」、ADR 决策 6、
   #436 面承担）。
4. **AC2「空批量 noop」的 vfsl 恒等 accept 面**：按设计 §7.5 定案归 #435 B6
   （`packages/vfsl/test/issue-435-elementwise-array-contract.test.ts:167`）；lease seam
   按可观察事实立法为空载荷形状拒绝不变（AC2-c 已在位且绿）。
5. **SA4/SA7 的独立评审与最终动态验证**：不在 SA3 职责内。

---

## Deviations or blockers

- **无阻断项，无设计偏离**。SA3 未修改任何生产实现、未修改 SA6 冻结件、未修改验收语义、
  未新增 skip/only/todo、未添加 env 分支或 fallback。
- 唯一非代码动作：按 SA2 O-1/O-2/O-3 建议，在**本报告**（而非三件套）中更正设计 §7.7
  理由性表述与 §8 L1 措辞，并记录 AC2 声明序差异；三件套 md5 不变（设计 §7.6 第 3 条）。
- 外部环境：Node v24 / pnpm 10.28.2 / vitest 3.2.7 全部本地可用；本轮无网络、无服务、
  无长驻进程；根 `pnpm test` 单轮 408.52s（含 `--typecheck`），全部前台受控执行并已收敛。

---

## Suggested commit message

```
test(namespace-registry): pin lease-seam array elementwise validation behavior (#437)

Adopt the SA6-approved lease end-to-end contract for ADR 0033: 13 contract
tests (AC1 polluted-array writes succeed, AC2 zero-write / issue-path /
bounds / empty-payload invariants + O(k) read-count proxy, AC4 diagnostic
carrier shape, AC5 replication convergence) plus 7 negative controls
(C1-C7 union legacy track, domain rules, single-commit, batch envelope).

Test-only: no production change (git diff empty). Focused suite 20/20 green,
capability probe 32/32 exit 0, root pnpm typecheck exit 0, wide tsc exit 0,
root pnpm test 466 files / 5667 tests green with both new files collected.
Evidence: artifacts/sa3-issue437-*.log; report wiki/raw/task_issue-437_sa3_impl.md.
```
