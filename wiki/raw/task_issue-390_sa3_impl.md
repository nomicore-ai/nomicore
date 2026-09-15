# SA3 Implementation Report — issue #390：溢出降级与父路径删除（变更订阅 T4）

- 分支 `mabf/issue-390`，HEAD `28faeae`（T1 #387 已合入；ADR 0030 已在库 `6df1c61`）
- 任务类型：feature（红灯 = 目标能力缺口）；TDD：红灯契约落盘 → 复现红 → 实现 → 红转绿
- 本轮 dispatch：`sa-e208707b-630b-4e4b-ad9c-3912e7fa40b8`（role `mabf-sa3`，phase implementation，iteration 1）。
  前序 SA3 尝试以 **Host observer/schema failure** 结束、**未产出业务 verdict**；本报告为该 worktree 上实现的
  **独立复核 + 完成**记录：实现产物经字节级比对确认无漂移，红/绿证据在本轮**独立重新推导**（不引用前序 verdict）。
- 范围：兑现 SA6 契约（`wiki/raw/task_issue-390_sa6_contract.md`，verdict = approve）与 SA1 设计
  （`wiki/raw/task_issue-390_design.md`）§7-D1–D8 / §8-A / §11 ALLOW LIST；SA2 评审
  （`wiki/raw/task_issue-390_sa2_review.md`）= approve、零 BLOCKER/MAJOR。

## Inputs consumed

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-390.md`（简报，6 条 AC） | 已读 | AC1–AC6 映射 |
| `wiki/raw/task_issue-390_design.md`（SA1 设计，449 行） | 已读 | D1–D8、§8-A 接口表、§11 ALLOW/DENY、§12 验收映射 |
| `wiki/raw/task_issue-390_sa6_contract.md`（SA6 契约） | 已读 | §12.1 B-1–B-7、§12.2 A1–A9/NC1–NC6、§12.3 fixture、§12.4 路径、§12.5 断言纪律 |
| `wiki/raw/task_issue-390_sa2_review.md`（SA2 评审，approve） | 已读 | §13 无 Required revision；§14 M1–M4 非阻断观察 |
| `wiki/raw/task_issue-390_conflict_report.md`（SA8 前置门禁，clear / recheck=true） | 已读 | §8-1..8-4 义务 |
| `artifacts/sa6-issue390-*.log`（8 份探针/基线） | 在场 | 缺口与基线锚点 |
| 前序 `wiki/raw/task_issue-390_sa3_impl.md` + `artifacts/sa3-issue390-*.log` | 已读 | 待复核实现状态（前序尝试产物） |
| REST `issues/390/comments` | **[]（0 条）** | 无 owner-scoped 要求、无 override 载体（dispatch 现场复核一致） |

## Existing worktree reconciliation

起始态（本轮读到的前序尝试遗留）：

- **tracked 改动 5 件**（`git diff --stat` = 177 insertions / 19 deletions）：`namespace-runtime/src/watch-map.ts`、
  `namespace-runtime/src/runtime.ts`、`namespace-registry/src/{testing,registry,types}.ts` —— 全部落在设计 §11 ALLOW LIST；
- **未跟踪 3 件新增测试**：#390 fixture / 行为契约 / 类型契约（SA6 §12.4 冻结路径）；
- 未跟踪 evidence：`artifacts/sa3-issue390-*.log`（9 份）与 `wiki/raw/task_issue-390_sa3_impl.md`（前序报告）；
- **零 commit**：`git log --oneline -1` = `28faeae`（与 SA6/SA1/SA2 基线一致）。

复核动作与结论：

1. 逐文件重读 5 个实现 diff 与设计 §7-D2/D3/D4/D5 逐条对照——**无过时、无冲突、无越界**改动，保留；
2. 落盘前安全备份：`git diff > impl.patch`（411 行）+ 5 文件副本 + `sha256sum` 清单（`/tmp/sa3-390-backup`）；
3. 红灯复核采用「备份 → `git checkout -- <5 路径>`（tracked diff = 0 行）→ 跑红 → trap 无条件还原 → `sha256sum -c`」
   路径；还原后 `sha256sum -c live.sha256` 5/5 OK、`cmp` 5/5 IDENTICAL、`git diff --stat` 仍为 177/19——
   **实现产物与复核前逐字节一致**；
4. 红/绿两侧使用**同一测试文件修订**（红灯仅回退 5 个实现文件，测试三件套未动）。

**无待修订/待删除项**；前序尝试未产出业务 verdict，本轮以独立证据补齐 TDD 闭环。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | §7-D3/D4、§8-A、D8 | `+detectStructuralInvalidation`（严格祖先前缀 + 链上键 delete/update 真变 → 结构性失效；`add` 旁路；序列载体段保守失效）；`+enqueueInvalidateAll` 降级入队单点（清队 + 恰两键 freeze + 槽外泵调度）；handler 每订阅**先于** `collectChanges` 短路；`enqueueData` 溢出分支改调单点（逐字节等价重构）；头注与 C-3 注释同步更新 |
| `packages/namespace-runtime/src/runtime.ts` | §7-D2、§8-A | `NamespaceRuntimeSeamInput` / `RuntimeForRegistryDiagnostic` 加法可选字段；`createNamespaceRuntime` 条件展开；`captureSeamInput` 形状门（≥1 有限整数，TypeError，前置于 enqueue）+ 捕获返回；L576 `createWatchHub(doc, state, captured.watchQueueCapacity)` |
| `packages/namespace-registry/src/testing.ts` | §7-D1/D2、§8-A | `NamespaceRegistryTestingOverrides` 加法可选字段 `watchQueueCapacity?: number`（唯一注入面）+ internal 对象字段 + 透传；头注增量 |
| `packages/namespace-registry/src/registry.ts` | §7-D2/D5、§8-A | `RegistryRuntimeOptions` / `NamespaceRegistryInternalOptions` 加法可选字段；`resolveWatchQueueCapacity` 单点（undefined→undefined；非 number→TypeError；域违例→RangeError，零值回显）；`createRegistryInternal` 内紧随 `resolveIdleTimeoutMs` 之后调用；`runtimeOptionsFor` 两条返回路径携带该字段 |
| `packages/namespace-registry/src/types.ts` | §7-D5、§8-A | `+2` 条稳定 message 常量（`…_WATCH_QUEUE_CAPACITY_TYPE` / `…_RANGE`），零插值、零值回显 |
| `packages/namespace-registry/test/issue-390-watch-invalidation-fixture.ts` | §7-D6、SA6 §12.3/§12.4 | **新增**：schema（`tasks` 必填 / `optionalTasks?` 已物化 / `optionalGroups?` 两级嵌套 / `meta` 无关负控）、`watchQueueCapacityOverride` B-1 绑定单点、缺省生产 runtimeFactory 通路 `openWatchLease`、NotificationSink + 同订阅后续写屏障助手（自包含，不 import #387 fixture） |
| `packages/namespace-registry/test/issue-390-watch-invalidation-red.test.ts` | SA6 §12.2/§12.4/§12.5 | **新增**：行为契约 14 用例（A1/A2/A3/A3b/A4/A5/A6/A7/A8/A9 + NC1–NC6） |
| `packages/namespace-registry/test/issue-390-watch-invalidation-surface.test-d.ts` | SA6 §12.5-8 | **新增**：类型契约（字段在场 + `@ts-expect-error` 负例 + `invalidate-all` 恰两键 + 主入口/lease 面零泄漏负锚） |
| `wiki/raw/task_issue-390_sa3_impl.md` | 技能固定产物 | 本报告（原位更新） |
| `artifacts/sa3-issue390-*-recheck.log`（8 份） | 证据面（非源码/非测试） | 本轮独立红/绿/回归/typecheck 原始输出 |
| `artifacts/sa3-issue390-{red,green}-recheck.sh`（2 份） | 证据面（非源码/非测试） | 红灯回退-还原与绿灯批次的**可复跑**脚本（含 trap 无条件还原 + sha256 校验） |

（前序尝试遗留的 `artifacts/sa3-issue390-*.log` 9 份保持原样，未删除。）

## SA2 Finding落实

SA2 §13：**零 BLOCKER、零 MAJOR**——无 Required revision。§14 非阻断观察：

| Finding ID | Implementation | Result |
|---|---|---|
| M1（设计 D2「组合语义」：两参 `runtimeFactory` 类型面无法消费第三参） | 无代码/测试动作：容量随第三参到达自定义工厂（JS 运行面可达、类型面 overrides 仍两参形）；设计文本属 SA1 文件，SA3 不修改 | 无需落实（记录） |
| M2（DENY 行 `packages/namespace-runtime/test/**` 读作「既有测试冻结」） | 未新增、未修改任何 runtime 包测试；`packages/namespace-runtime/**` 仅 `src/watch-map.ts` / `src/runtime.ts` 两条 ALLOW 路径 | 落实（零 runtime 测试改动） |
| M3（容器创建事务 kind 不钉） | `add` 旁路保留 T1 逐字节行为；A6/A3b **不钉**创建事务 kind（只断恰一条失效信号 + 重建后条目 `data`）；NC2 条目级语义零漂移 | 落实（最小噪声档） |
| M4（seam 形状/域违例统一 TypeError vs registry 二分） | `captureSeamInput` 统一 TypeError（沿本文件逐字段形状门先例，为直连 seam 的不可达防御面）；registry 单点维持 TypeError/RangeError 二分 | 落实（设计 D5 原样） |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | ALLOW 第 1 行 | D3/D4 父删编排与降级单点 |
| `packages/namespace-runtime/src/runtime.ts` | ALLOW 第 2 行 | D2 runtime 侧装配缝 + L576 接线 + 形状门 |
| `packages/namespace-registry/src/testing.ts` | ALLOW 第 3 行 | D1/D2 唯一注入面 |
| `packages/namespace-registry/src/registry.ts` | ALLOW 第 4 行 | D2/D5 internal 装配缝 + 校验单点 |
| `packages/namespace-registry/src/types.ts` | ALLOW 第 5 行 | D5 两条稳定 message |
| `packages/namespace-registry/test/issue-390-watch-invalidation-fixture.ts` | ALLOW 第 6 行 | D6 新 fixture（SA6 §12.4 冻结路径） |
| `packages/namespace-registry/test/issue-390-watch-invalidation-red.test.ts` | ALLOW 第 7 行 | SA6 §12.2 行为契约 |
| `packages/namespace-registry/test/issue-390-watch-invalidation-surface.test-d.ts` | ALLOW 第 8 行 | SA6 §12.5-8 类型契约 |
| `wiki/raw/task_issue-390_sa3_impl.md` | 技能固定产物（非源码） | 实现报告 |
| `artifacts/sa3-issue390-*-recheck.log`、`artifacts/sa3-issue390-{red,green}-recheck.sh` | 证据面（非源码/非测试） | 原始命令输出 + 可复跑脚本 |

DENY LIST 核对（`git status --porcelain` 实读，本轮复核）：`internal.ts`、两包 `index.ts`、`lease.ts`、`plugin.ts`、
`errors.ts`、`sequencer.ts`/`write.ts`/`schema-write.ts`/复制族/`window-read.ts`/诊断族、全部既有测试（含
`issue-387-*`）、`docs/adr/0030-*.md`、`CONTEXT.md`、`docs/protocols/instance-replication-v1.md`、
`vitest.config.ts`、两包 `package.json`、`tsconfig*.json` —— **零改动**（tracked diff 仅 5 个 ALLOW 源文件）。

契约面独立核对：三件套仅 import `@nomicore/namespace-registry`（公共入口）与
`@nomicore/namespace-registry/testing`（既有 testing 子路径）；**零** internal seam / `createWatchHub` 直连 /
新子路径；`grep` 无 `skip|only|todo|fails` 标记、无 `fs`/源码字符串断言。

## Verification

| Command | Result | Evidence |
|---|---|---|
| **红灯（本轮独立重推）行为契约**：备份 5 实现文件 → `git checkout -- <5 路径>`（tracked diff = 0）→ `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/namespace-registry/test/issue-390-watch-invalidation-red.test.ts --typecheck.enabled=false` | **EXIT=1；8 failed / 6 passed (14)**。8 红恰为 A1/A2、A7、A3、A3b、A4、A5、A6、A9（全部「`invalidate-all` 永不到达」5s 超时）；6 绿恰为基线回归边界 NC1、NC2、A8、NC3、NC4、NC5 | `artifacts/sa3-issue390-red-behavior-recheck.log` |
| **红灯类型契约（同一回退态）**：`npx tsc -p tsconfig.typecheck.json --noEmit` | **EXIT=2**，恰 2 条错误、均为注入位缺席：`surface.test-d.ts(25,61) TS2339` + `(84,7) TS2353` | `artifacts/sa3-issue390-red-typecheck-recheck.log` |
| **还原完整性**：trap 无条件还原 + `sha256sum -c live.sha256` + `cmp` | 5/5 **OK / IDENTICAL**；`git diff --stat` 恢复为 `5 files changed, 177 insertions(+), 19 deletions(-)` | 脚本 `artifacts/sa3-issue390-red-recheck.sh` 输出（`RESTORE_SHA256_OK`） |
| **绿灯行为契约**：`NODE_OPTIONS=… npx vitest run …/issue-390-watch-invalidation-red.test.ts --typecheck.enabled=false` | **14 passed (14)**、EXIT=0（8 红全转绿；6 基线绿未漂移） | `artifacts/sa3-issue390-green-behavior-recheck.log` |
| **绿灯类型契约**：`npx vitest run …/issue-390-watch-invalidation-surface.test-d.ts` | **3 passed**、`Type Errors no errors`、EXIT=0 | `artifacts/sa3-issue390-green-typesurface-recheck.log` |
| **确定性复跑 ×3**（A2 承重时序 / capacity=1 触发） | 3/3 轮 `14 passed (14)`、EXIT=0 | `artifacts/sa3-issue390-green-repeat-recheck.log` |
| **#387 T1 回归**：`npx vitest run …/issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false` | **21 passed (21)**、EXIT=0（T1 契约逐字节不漂移） | `artifacts/sa3-issue390-regression-issue387-recheck.log` |
| **测试树 typecheck**：`npx tsc -p tsconfig.typecheck.json --noEmit` | **EXIT=0**、零输出（0 行；含 type-guard / lease surface / #390 surface 全部 `*.test-d.ts`） | `artifacts/sa3-issue390-green-test-tsc-recheck.log` |
| **根 typecheck**：`pnpm typecheck` | **EXIT=0**（14 个 tsconfig 全通过） | `artifacts/sa3-issue390-root-typecheck-recheck.log` |
| **受影响包全量族**（设计 §12 回归边界）：`npx vitest run packages/namespace-registry packages/namespace-runtime --typecheck.enabled=false` | **95 files / 1020 tests passed**、EXIT=0（含 registry-open 16 键、公共面/导出审计、runtime guard/import 图审计） | `artifacts/sa3-issue390-package-suites-recheck.log` |

**红→绿同版本论证**：红灯在 `git checkout --` 回退 5 个实现文件后、测试三件套保持当前修订时采集；还原经
sha256/`cmp` 证明与采集红灯前逐字节一致 ⇒ 红/绿两侧测试与实现版本严格可比（红灯日志 11797 字节与前序尝试
红灯日志**同尺寸**，佐证失败集合确定性）。

**红灯真实性（与 SA6 §13 两条独立红因一致）**：① 父删/祖先删/整替/同事务删 = 零失效信号（事件在场、通知缺席）；
② `watchQueueCapacity` 注入位类型 + 运行双缺席（TS2339/TS2353 + 字段被忽略）。AC4（A6 在 HEAD 为红是本任务的
**信号**缺口，其「重建后条目 data」段落为基线绿）、A8、NC1–NC5 不依赖失效信号者为基线绿，**未伪称红灯**；实现后
全部保持绿。

### SA8 §8-4 实现后复查证据（供 SA8 闭合 recheck）

| 项 | 证据 | 结果 |
|---|---|---|
| ① override 字段未泄漏公共契约/主入口 | A8 绿（`Object.keys(lease)` 恒 16 键、`'watchQueueCapacity' in lease === false`、runtime status 投影无该键）；类型锚绿（`CreateNamespaceRegistryOptions`、`NamespaceLease`、主入口零成员）；`index.ts`/`plugin.ts` 零改动 | 闭合 |
| ② 默认容量仍为实现常量（不套用复制 fanout 纪律） | `WATCH_QUEUE_CAPACITY_DEFAULT = 16` 单点未动；NC1 绿（不注入 → 两次写不溢出、零失效信号）；公共类型/文档零数值 | 闭合 |
| ③ 三 kind 形状逐键未变 | A9/NC6 绿（`invalidate-all` `toStrictEqual` 恰两键；`data` 恰三键 + 定位符恰两键；零 version/rev/watch-end） | 闭合 |
| ④ 两触发源订阅存活（簿记零摘除） | A2 自愈 `data`、A3/A4/A5 删除/祖删/整替后 `data` 恢复、A6 横跨缺席期零重新订阅——均绿；`subscriptions`/`unsubscribed` 写入点零改动 | 闭合 |
| ⑤ sequencer/槽序 diff 零触碰 | tracked diff 无 `sequencer.ts`/`write.ts`；降级路径全同步有界（清队 + push + 泵调度）、分发仍在既有槽外微任务泵 | 闭合 |
| ⑥ 复制面零改动 | diff 无 `replication-*.ts`；零 needs-resync / wire 接触 | 闭合 |
| ⑦ T2/T3 未顺带实现 | 零新 `WATCH_MAP_*` 码；无 `where`/`watch-end`/`errors.ts` 改动 | 闭合 |

### 契约 B-1–B-7 落实核对（本轮逐条实读）

| 绑定 | 实现/测试落点 | 核实 |
|---|---|---|
| B-1 容量注入位 | `NamespaceRegistryTestingOverrides.watchQueueCapacity?` → internal → `runtimeOptionsFor` 第三参 → seam → `createWatchHub` 第三参 | fixture 绑定单点 `watchQueueCapacityOverride()`；A1/A2 运行敏感 + NC1 对照 |
| B-2 溢出触发模式 | capacity=1 + 同同步段两次 un-awaited 写；断言 `syncCallbacks === 0` | A1/A2/A7 绿（红侧 A1/A2/A7 超时）；复跑 ×3 稳定 |
| B-3 形状 | `Object.freeze({kind:'invalidate-all', origin})` 单点构造；无 reason/changes/version/rev | A9 + 类型 `_invalidateAllKeys` 断言绿 |
| B-4 父删/整替/`add` 不钉 | `detectStructuralInvalidation`（严格祖先 + 链上键 delete/update 真变；`add` 旁路） | A3/A3b/A4/A5 绿；A6 重建事务不钉 kind |
| B-5 订阅存活 | 簿记零摘除、无 `watch-end` | A2/A3/A3b/A4/A5/A6 均含存活断言 |
| B-6 默认数值不断言 | NC1 只断「不溢出、零失效信号」 | 绿 |
| B-7 事务级原子 + FIFO | 结构性失效短路条目聚合、降级单点清队 | A3b 恰一条 + 零无关通知；A2 恰零 data 越过降级信号 |

## Deferred verification

- **SA7 动态/最终验收**与真实环境验收（本实现仅完成 SA6 指定红灯转绿 + 受影响包 typecheck/静态检查）。
- **全仓 `pnpm test`**（domains/apps 等非受影响面）未运行——超出 SA3 职责；受影响两包全量族已跑（1020/1020）。
- 复制面端到端（`origin:'replication'` 验收属 T3 #389）；文档词条（T5 #391）；谓词 `where`（T2 #388）。
- `watchQueueCapacity` 非法值门（TypeError/RangeError）与 seam 形状门为设计 D5 **超出契约断言面**的 fail-loud 加门
  （SA6 §15-4 明示契约只要求 `1` 被兑现），未落契约断言；如需动态锚可由 SA7 决定。

## Deviations or blockers

**无阻塞项。** 记录实现说明（均在设计授权内、语义零偏离）：

1. `resolveWatchQueueCapacity` 实现为 `registry.ts` **模块私有单点**（不导出）——设计 D5 要求「单点 + 构造期校验」，
   未要求导出；保持 `registry.ts` 值导出面与内部 seam 面零变化。行为与设计逐条一致。
2. seam 形状门对形状/域违例统一 `TypeError`（设计 D5 原文；SA2 M4 记为可接受；registry 单点仍为 TypeError/RangeError 二分）。
3. A6/A3b 的重建事务**不断言**通知 kind（T1 N4 边界 + 设计 §7-D3 `add` 旁路）——断言承重在「恰一条失效信号 +
   重建后条目 `data` + 零重新订阅」，不弱化 AC3/AC4。
4. 设计 §14 声明 iteration 0 无前序评审（该文件未回写 SA2 结果）；设计文件属 SA1 面，SA3 不修改；本报告代为实现侧
   finding 映射（见上表）。
5. 前序 SA3 尝试以 Host observer/schema failure 结束且无业务 verdict——本轮以独立红/绿证据闭环，未沿用其结论。

## Suggested commit message

```
fix(#390): watchMap 溢出降级装配 + 父路径删除结构性失效（ADR 0030 T4）

- watch-map：严格祖先 delete/整替 → 单条 invalidate-all（detectStructuralInvalidation，
  先于条目聚合短路；add 旁路保 T1 行为；序列载体段保守失效）；降级入队单点
  enqueueInvalidateAll（溢出与结构性失效共用，B-7 清队语义）；订阅簿记零摘除
- runtime/registry：watchQueueCapacity 经 testing overrides 加法字段 → internal 装配缝
  → runtimeOptionsFor 第三参 → seam 形状门/捕获 → createWatchHub 第三参；缺省 =
  实现常量（数值不进公共契约）；resolveWatchQueueCapacity 构造期 fail-loud 二分门
- 契约测试：#390 三件套（A1–A9 + NC1–NC6 + 类型面）；#387 21/21、根/测试树 typecheck
  与 registry+runtime 全量族（1020）保持绿
```
