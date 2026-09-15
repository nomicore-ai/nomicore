# SA3 Implementation Report — issue #387：watchMap 无谓词形态垂直通路（变更订阅 T1 / tracer bullet）

- Worktree：`/home/wangjian/nomicore-fix-issue-387`（branch `mabf/issue-387`，HEAD `6df1c61`，实现未提交）
- 轮次：**iteration 1（重试轮）**——在 SA1 设计 iteration 2（649 行）+ SA2 评审 iteration 2
  （**approve**，0 × BLOCKER / 0 × MAJOR，Required revisions = 无）+ SA8 设计后冲突复审
  iteration 2（**clear**，`requiresConflictRecheck=true`）下，闭合设计 §8-1 明列的
  **唯一剩余实现缺口**（⑨⑩ 两行冻结形态）并复跑设计 §12 三条门禁。
- 结论：**实现完成，三门禁全绿（① exit 0 / ② exit 0 / ③ exit 0）；SA6 红灯契约转绿
  （行为 21/21 + 类型契约零 Type Error）；#369 负控 33/33 且断言 diff = 0；P0 AC5 锚
  7/7；DENY 域零 diff。无阻塞、无越界、无验收语义改动。**

---

## Inputs consumed

| 输入 | 状态 | 消费点 |
|---|---|---|
| `wiki/raw/task_issue-387.md`（brief） | 在场 | AC1–AC10 + 演示场景；评论 0 条（dispatch 复确认 REST `[]`） |
| `wiki/raw/task_issue-387_design.md`（SA1 **iteration 2**，649 行） | 在场（被执行的冻结设计） | §7 冻结表（B-2/B-3/B-4/B-5 + D1–D10，含 ③b/D9 两类桩形态）、§8-A–G、§10 影响矩阵、§11 ALLOW/DENY、§12 三门禁与预期值 |
| `wiki/raw/task_issue-387_sa2_review.md`（**iteration 2，approve**） | 在场 | Required revisions = 无；§13/N-2「剩余实现缺口恰两行」= 本轮全部工作面 |
| `wiki/raw/task_issue-387_design_conflict_report.md`（SA8 **iteration 2，clear**） | 在场 | §8-1 两行落盘义务 + §8-3 实现后复查清单 ①–⑪（本报告提供门禁证据，不自裁闭合） |
| `wiki/raw/task_issue-387_sa6_contract.md` | 在场 | 绑定表 B-1–B-7、红线契约三件套、非目标边界 |
| `docs/adr/0030-change-subscription.md`（HEAD 零 diff） | 在场 | 规范权威；D8/③b/D9 的裁决基准 |
| `packages/namespace-registry/AGENTS.md`、`packages/ws-replication/AGENTS.md`、`packages/namespace-runtime/AGENTS.md` | 在场 | 模块契约：公共 API 仅经 `src/index.ts`；test controls 归 explicit testing surface（⑩ 落位依据） |
| 契约三件套（fixture / 行为 red / lease surface `test-d`） | 在场，**SA3 零改动**（mtime 19:09–20:25，早于本轮编辑） | 红灯转绿 + 类型面 |
| Owner 要求 | 无（REST 快照 `[]`） | 无条款需映射 |

## Existing worktree reconciliation

- **iteration 0 实现整体保留**：上一轮已落盘的 18 处 ALLOW 内修改 + 1 新模块（`watch-map.ts`）
  经与 SA1 iteration 2 设计全文对账（§8-A–G 类型面/建立状态机/推导/真变/泵/lease 侧/runtime
  装配）**语义一致**，本轮零回退、零重写；唯一增量 = 设计 §11 iteration 2 新增的两行 ALLOW
  义务（⑨⑩）。
- **iteration 0 报告的三项缺口已由设计闭合，不再是偏差**：
  - **B-1（范围不足）** → 设计 §11 ALLOW 增 ⑨⑩ 两行 + DENY 两行逐行级改判 + §11 头部
    「同路径重叠优先序」；本轮按逐行冻结形态落盘（见下）；
  - **B-2（事实陈述被实现否决）** → 设计 §2.13/§2.14/§10 重写（十处结构实现点 + 五类检索
    模式 + 编译器仲裁）；
  - **A-1（ROOT 载体构造期抛错）** → 吸收为设计冻结 **D10 / 建立场 ③b 门**（容错捕获 +
    复用 `WATCH_MAP_CARRIER_MISMATCH` 码 + 专属 message，不新增注册表条目）；实现已在
    iteration 0 落盘（`captureRootMap`）且本轮 P0 锚 7/7 复证。
- **⑧ 已在 iteration 0 于 ALLOW 路径内修复**（`registry-open.test.ts` `makeRuntime` stub）；
  本轮该文件零新增改动。
- **本轮（重试）实际改动 = 恰 2 个文件**：
  1. ⑨ `packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`
     `makeStubRuntime` 补 D9(a) throw stub（+同款注释）+ 可选 section 陈旧计数
     「14 键面」→「15 键面」（设计 §11 ALLOW 行明列的 R5 可选项）；
  2. ⑩ `packages/ws-replication/src/testing.ts` `decorateLease` 补
     `watchMap: lease.watchMap.bind(lease),` 恰一行（D9(b) 装饰器诚实透传）。
  `git diff --numstat`：⑨ = +6/−1（1 行计数注释替换 + 2 行注释 + 3 行桩），⑩ = +1/−0。

## Changed paths

| Path | Design section | Change | 轮次 |
|---|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | §8-A/B/C/D/E/G | **新增**：`createWatchHub`（构造期 ROOT `observeDeep` 容错捕获单挂点 / 建立状态机含 ③b / 事务级定位符推导 C-1–C-4 / 真变判定 / 有界队列 + 槽外单飞微泵 / `shutdown`）+ 三类型 + 容量单参数位（默认 16） | it0 |
| `packages/namespace-runtime/src/runtime.ts` | §8-G | 第 15 键 `watchMap`（接口 JSDoc + 字面量透传）+ `createWatchHub` 装配 + `closeAfterFence` 并置 `watchHub.shutdown()` | it0 |
| `packages/namespace-runtime/src/errors.ts` | §7-B3/B4、§11 | append-only：`WATCH_MAP_CARRIER_MISMATCH_CODE` / `WATCH_MAP_SCHEMA_UNAVAILABLE_CODE` / `WatchMapError`；`RuntimeReadDisabledError` getter 词表 +`'watchMap'`（additive） | it0 |
| `packages/namespace-runtime/src/index.ts` | §7-B5 | type-only 三别名转出（值导出面仍恰一键） | it0 |
| `packages/namespace-registry/src/types.ts` | §8-A/F | `NamespaceLease` 第 16 键 `watchMap` + 三 lease 单源别名 | it0 |
| `packages/namespace-registry/src/lease.ts` | §7-D6、§8-F | `watchMap` 实现（released throw + 透传 + 双幂等登记）+ `activeWatches` + doRelease 首调同步段清理 + 五条 Equal 锁 | it0 |
| `packages/namespace-registry/src/index.ts` | §11 | type-only 三别名转出 | it0 |
| `packages/namespace-registry/test/registry-open.test.ts` | §11（键集 + ⑧） | lease 键集 15 → 16；同文件 `makeRuntime` 补 D9(a) throw stub | it0 |
| `packages/namespace-runtime/test/runtime-registry-internal-seam.test.ts` | §11 | runtime 键集 14 → 15 | it0 |
| `packages/namespace-runtime/test/runtime-phase5-reset-fence-r2.test.ts` | §11 | runtime 键集 14 → 15（+ it 标题陈旧计数同步） | it0 |
| `packages/namespace-runtime/test/runtime-close-lifecycle.test.ts` | §11 | runtime 键集 14 → 15（负向事件订阅词审计 L177–182 未动） | it0 |
| `packages/namespace-registry/test/registry-idle.test.ts` | §11（D9(a)） | class 桩补最小 `watchMap` throw 成员 + import | it0 |
| `packages/namespace-registry/test/registry-sa7-concurrency.test.ts` | §11（D9(a)） | 同上 | it0 |
| `packages/namespace-registry/test/registry-sa7-hostile.test.ts` | §11（D9(a)） | 同上 | it0 |
| `packages/namespace-registry/test/registry-sa7-rev1.test.ts` | §11（D9(a)） | 同上 | it0 |
| `packages/namespace-registry/test/registry-shutdown.test.ts` | §11（D9(a)） | 同上 | it0 |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test.ts` | §11（D9(a)） | 字面量桩补一行 `watchMap` throw stub | it0 |
| `packages/namespace-registry/test/registry-readdata-projection-text-red.test.ts` | §11（D9(a)） | 同上 | it0 |
| **`packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`** | **§11 ALLOW ⑨ 行（B-1⑨）** | `makeStubRuntime` 字面量补 D9(a) throw stub（+同款注释）；section 计数注释「14 键面」→「15 键面」；**断言零改动** | **本轮** |
| **`packages/ws-replication/src/testing.ts`** | **§11 ALLOW ⑩ 行（B-1⑩ / D9(b)）** | `decorateLease` 字面量补 `watchMap: lease.watchMap.bind(lease),` **恰一行**；导出面/wire 帧/其余成员零改动 | **本轮** |

**零改动确认**：SA6 契约三件套（fixture / 行为 red / lease surface `test-d`）**未改一字**；
`readData` / 窗口读 / 复制面 / 诊断 / wire / 持久化源码零 diff；`docs/**`、`CONTEXT.md`、
`vitest.config.ts`、`package.json` 零 diff；`registry.ts` / `observer.ts` / `testing.ts`
（registry 侧）/ `replication-session.ts` / `sequencer.ts` / `write.ts` 零 diff；
`packages/ws-replication/src/index.ts` 零 diff。

## SA2 Finding 落实

SA2 iteration 2 verdict = **approve，Required revisions = 无**；本轮工作面 = 其 §13 + N-2
明列的「剩余实现缺口恰两行」，逐条落实：

| SA2/SA8 条目 | 实现 | 结果 |
|---|---|---|
| B-1① registry-open `makeRuntime`（路径在 ALLOW） | iteration 0 已补 D9(a) throw stub | **落实**（门禁① 由 3 错降为 2 错，本轮 0 错） |
| B-1② issue-369 `makeStubRuntime`（原 DENY 明文，改判为 §11 ALLOW ⑨ 行） | 本轮补 D9(a) throw stub 恰一成员 + 同款注释；断言零改动 | **落实**（门禁① 该 TS2741 消失；#369 仍 33/33） |
| B-1③ ws-replication `decorateLease`（原 ALLOW 外，改判为 §11 ALLOW ⑩ 行） | 本轮补 `watchMap: lease.watchMap.bind(lease),` 恰一行（与邻成员同款透传） | **落实**（门禁③ 该 TS2741 消失；导出面/wire 零 diff） |
| B-2 影响面检索模式扩为五类 + 编译器仲裁 | iteration 0 实现已按编译器实证收敛；本轮门禁①③ exit 0 = 十处清单完备的终审证据 | **落实**（无第 11 处结构点） |
| A-1 → D10 / ③b | `captureRootMap` 容错捕获 + 建立场 ③b 响亮拒绝 + `shutdown` 守卫（iteration 0 落盘） | **落实**（P0 AC5 7/7 绿 = 构造与 ROOT 载体解耦） |
| N-1 实现后复查（沿 SA8 §8-3 ①–⑪） | 本报告 §Verification 提供 ①②⑨⑩⑪ 的门禁/行为证据；清单闭合裁决属 SA8 | **证据齐备，待 SA8 裁决** |
| N-2 重试执行提示 | ⑨ stub + 注释 + 计数措辞；⑩ 一行透传——与本轮 diff 逐字一致 | **落实** |
| N-3 行号微漂移 | 以内容检索定位（未依赖行号） | **落实** |
| N-4 沿袭登记（T4 注入/溢出、R9 消费指引等） | 未触碰（属 T4 #390 / T5 #391） | **无需动作** |
| N-5 §7-D3/§8-B⑤ 未列 `optional` 透明解包（设计文本微瑕） | 属设计文本面（SA3 不改文档）；实现侧 `resolveCarrierKind` 已做 optional 解包且 E3 正例绿 | **记录（非阻塞）**，转 SA1 后续文本同步 |
| iteration 0 最小整改请求 1–4 | 设计 iteration 2 §11（两 ALLOW 行 + 两 DENY 改判 + 优先序）、§2.13/§2.14/§10/§12（计数 ×10）、§6/§15（SA8 同步） | **全部adopted 已复核** |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | §11 ALLOW 第 1 行（新增） | 唯一新实现载体 |
| `packages/namespace-runtime/src/runtime.ts` | §11 ALLOW 第 2 行 | 第 15 键 + hub 装配 + close 收口 |
| `packages/namespace-runtime/src/errors.ts` | §11 ALLOW 第 3 行 | 两稳定码 + `WatchMapError`（getter 词表 additive） |
| `packages/namespace-runtime/src/index.ts` | §11 ALLOW 第 4 行 | type-only 三别名 |
| `packages/namespace-registry/src/types.ts` | §11 ALLOW 第 5 行 | lease 第 16 键 + 三别名 |
| `packages/namespace-registry/src/lease.ts` | §11 ALLOW 第 6 行 | 实现 + 登记 + 清理 + 五锁 |
| `packages/namespace-registry/src/index.ts` | §11 ALLOW 第 7 行 | type-only 三别名 |
| `packages/namespace-registry/test/registry-open.test.ts` | §11 ALLOW 第 8 行（键集 + ⑧） | 键集 15→16 + 同文件 stub |
| `packages/namespace-runtime/test/runtime-registry-internal-seam.test.ts` | §11 ALLOW 第 9 行 | 键集 14→15 |
| `packages/namespace-runtime/test/runtime-phase5-reset-fence-r2.test.ts` | §11 ALLOW 第 10 行 | 键集 14→15 |
| `packages/namespace-runtime/test/runtime-close-lifecycle.test.ts` | §11 ALLOW 第 11 行 | 键集 14→15（负向审计不动） |
| `packages/namespace-registry/test/registry-idle.test.ts` | §11 ALLOW 第 12 行 | 结构桩成员 |
| `packages/namespace-registry/test/registry-sa7-concurrency.test.ts` | §11 ALLOW 第 13 行 | 同上 |
| `packages/namespace-registry/test/registry-sa7-hostile.test.ts` | §11 ALLOW 第 14 行 | 同上 |
| `packages/namespace-registry/test/registry-sa7-rev1.test.ts` | §11 ALLOW 第 15 行 | 同上 |
| `packages/namespace-registry/test/registry-shutdown.test.ts` | §11 ALLOW 第 16 行 | 同上 |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test.ts` | §11 ALLOW 第 17 行 | 字面量桩一行 |
| `packages/namespace-registry/test/registry-readdata-projection-text-red.test.ts` | §11 ALLOW 第 18 行 | 同上 |
| `packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts` | **§11 ALLOW ⑨ 行**（B-1⑨，本轮取用） | `makeStubRuntime` D9(a) stub 成员 + 计数注释；断言零改动 |
| `packages/ws-replication/src/testing.ts` | **§11 ALLOW ⑩ 行**（B-1⑩，本轮取用） | `decorateLease` 一行透传（testing surface，不进生产 API） |

未取用的可选授权：`issue-387-watch-map-tracer-red.test.ts` E4 逐字码收紧、
`issue-387-watch-map-lease-surface.test-d.ts` 追加 B-5 别名 Equal 锁——均为「可选、非必须」，
本轮**契约文件零改动**（更保守：不触验收语义）。

## Verification

| # | Command | Result | Evidence |
|---|---|---|---|
| V1 | **门禁①（设计 §12）**：`npx tsc -p tsconfig.typecheck.json --noEmit` | **exit 0，零输出**（修前：exit 2，恰 2 处 TS2741 = ⑨ `issue-369…(871,3)` + ⑩ `testing.ts(44,3)`） | `artifacts/sa3-issue387-retry-gate1-test-tsc.log`（修前基线 `-test-tsc2.log`） |
| V2 | **门禁③（设计 §12）**：`pnpm typecheck`（14 包 src 树） | **exit 0**（修前：exit 2，唯一红 = ⑩） | `artifacts/sa3-issue387-retry-gate3-root-typecheck.log`（修前 `-root-typecheck.log`） |
| V3 | **门禁②（设计 §12）**：`pnpm test`（`vitest run --typecheck`） | **`Test Files 394 passed (394)`、`Tests 4753 passed (4753)`、`Type Errors: no errors`、无 `Errors` 段、exit 0**（修前：行为已全绿但 `Errors 2 errors` + exit 1） | `artifacts/sa3-issue387-retry-gate2-root-test.log`（修前 `-root-test-final.log`） |
| V4 | 红灯契约 + 类型契约 + #369 负控 + P0 锚：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck <387 tracer-red / 387 lease-surface test-d / #369 negctl / P0 sequencer>` | **4 files / 63 tests passed，Type Errors: no errors，exit 0**——tracer-red **21/21**（实现前 20 红 / 1 绿）、lease-surface `test-d` **2/2**、#369 **33/33**、P0 **7/7** | `artifacts/sa3-issue387-retry-contract-and-negctl.log` |
| V5 | ⑨ 负控不变式：`git diff -U0` 该文件逐行审计 | 改动 = 1 行计数注释替换 + 2 行注释 + 3 行桩成员；`grep -E '\b(expect\|it\|describe\|test)\('` **零命中** → **断言 diff = 0** | 本轮终端实录；`git diff --numstat` = `6 1` |
| V6 | 受影响 12 测试文件逐文件在 V3 全量内通过 | registry-open 32 / internal-seam 5 / phase5-reset-fence-r2 7 / close-lifecycle 10 / registry-idle 18 / sa7-concurrency 4 / sa7-hostile 6 / sa7-rev1 6 / registry-shutdown 12 / readdata-budget-passthrough 5 / readdata-projection-text-red 6 / issue-369 33——**全绿** | V3 日志逐文件行 |
| V7 | 冻结面零 diff：`git status --porcelain -- docs CONTEXT.md vitest.config.ts package.json <DENY src 清单> packages/replication-protocol packages/persistence packages/ws-replication/src/index.ts` | **零命中**（唯一命中 = SA6 fixture 未跟踪文件，非 SA3 改动）；`packages/ws-replication` 改动 = `src/testing.ts` 恰 `1 0` | 本轮终端实录 |

**SA8 §8-3 实现后复查清单（①–⑪）证据对账（裁决属 SA8，本报告只供证据）**：
① lease 16 / runtime 15 键 + 四处 `Object.keys` 审计 —— V3 内四处守卫文件全绿（16/16 与 14→15 断言）；
② **十处结构实现点补齐后门禁① tsc exit 0 与根 typecheck exit 0 —— 达成（V1/V2）**；
③ 两码 append-only、既有码零改动、③b 无新注册表条目 —— iteration 0 落盘形态 + 本轮零触碰；
④ 通知恒三 kind 闭集、不含值 —— V4 tracer-red N1 哨兵/闭集断言绿；
⑤ D8 无过滤行为 —— `classifyOrigin` 无过滤分支在产（T1 契约不证 `'replication'` 面，按非目标留 T3）；
⑥ doRelease 清理时序 —— lease 侧实现位次（`entry.leases.delete` 后、`dispatchObserver` 前）+ L2 断言绿；
⑦ 观察器零 throw —— handler 整体 try/catch，X1 断言绿；
⑧ released lease → `NamespaceLeaseReleasedError` —— 实现 + V4 绿；
⑨ 两 index type-only 追加、值导出面不变 —— V3 内 phase5 值导出审计断言绿；
⑩ ③b 分界行为：map 形 ROOT 下缺席容器建立成功（E3）+ **P0 文件 7/7 保持全绿 —— 达成（V4）**；
⑪ **负控不变式：issue-369 33/33 + 断言 diff = 0（V4/V5）；ws-replication 导出面/wire 帧 diff = 0（V7，⑩ 仅一行成员）**。

## Deferred verification

- **SA8 实现后冲突复查（§8-3 ①–⑪）的闭合裁决**：`requiresConflictRecheck=true` 保持至 SA8
  按本报告证据复核；SA3 不自行闭合该门。
- SA4 设计面复核与 SA7 最终动态验证（真实环境验收）不在 SA3 职责内。
- 设计明示分期义务：T2 #388（`where` 词表 + options 槽）、T3 #389（`'replication'` 断言编排 +
  `watch-end`）、T4 #390（队列上限 testing 注入 + 溢出/父路径删除验收）、T5 #391（三方文档面）。
- 未取用的可选授权（E4 逐字码断言、B-5 别名 Equal 锁）保持未取用；若后续要求，属契约文件
  面改动，需另行授权。
- 设计文本微瑕 N-5（`optional` 透明解包未写入 §7-D3/§8-B⑤ 规格文本）：属设计文档面
  （DENY），转 SA1 文本同步，不阻塞实现。

## Deviations or blockers

- **本轮无 deviation、无 blocker**：设计可实施、ALLOW/DENY 边界明确、红灯契约与设计一致；
  两条剩余冻结形态按逐行级改判落盘，三门禁全绿。
- 历史偏差状态（均已在设计 iteration 2 内闭合，无残留）：A-1（构造期 ROOT 载体抛错）→
  D10/③b 设计冻结 + 实现落盘；B-1（影响面清单不足）→ §11 ALLOW/DENY 改判；B-2（两处事实
  陈述被否证）→ §2.13/§2.14/§10 重写。
- ⑨ 的计数注释同步（「14 键面」→「15 键面」）取用了设计 §11 ALLOW 行的显式可选项（R5）；
  不触及任何断言行（V5 实证）。
- **明确未做**：未改 SA6 契约三件套；未触任何 DENY 路径；未以 skip/only/env override/fallback
  伪造通过；未执行 `git add` / `commit` / `push` / PR / finalize。

## Suggested commit message

```
feat(#387): lease watchMap 键容器变更订阅垂直通路（ADR 0030 T1 tracer bullet）

- runtime 新增 watch-map.ts：构造期 ROOT observeDeep 容错捕获单挂点（D10）、
  schema 侧建立判定（含 ③b ROOT 载体门）、事务级定位符推导（同事务同 key 合并）、
  无过滤 origin 分类（null→local / symbol→replication）、有界队列 + 槽外单飞微泵、
  回调 throw 静默隔离、close 同步段 shutdown
- runtime 第 15 键 watchMap；errors.ts append-only 追加 WATCH_MAP_* 两码与
  WatchMapError；runtime/registry 两 index type-only 三别名
- registry lease 第 16 键 watchMap（released throw + 透传 + 双幂等登记 +
  release 同步段清理）与五条 Equal 锁
- 四处键集守卫 15→16 / 14→15；十处结构实现点按 D9 形态补齐
  （替身恒同步 throw / ws-replication testing surface 装饰器诚实透传）
- 契约：#387 行为契约 21/21 与类型契约全绿（契约文件零改动）；
  #369 负控 33/33 且断言 diff = 0；P0 AC5 7/7
- 门禁：测试树 tsc exit 0、根 pnpm typecheck exit 0、pnpm test 394 files /
  4753 tests / Errors 0 / exit 0
```
