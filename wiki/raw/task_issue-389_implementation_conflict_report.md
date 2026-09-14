# SA8 实现后冲突复审报告 — issue #389：复制来源与订阅终止（变更订阅 T3）

- 复审对象：**implementation**（SA3 交付切片 = 4 个 runtime 源文件改动 + 2 个新契约文件；
  对已批准契约/设计、ADR 0030/0018/0010 与冻结公共/生命周期面逐项核对）
- 复审轮：2026-09-15（iteration 0；dispatch `sa-3177dc67-60fa-49a6-85df-40f299ee022d`；
  本报告为 issue #389 首份 implementation 冲突报告，闭合前置报告
  `task_issue-389_conflict_report.md` §10 登记的 `requiresConflictRecheck = true`）
- Worktree：`/home/wangjian/nomicore-fix-issue-389`（branch `mabf/issue-389`，基线 HEAD
  `28faeae`；实现为未提交工作树改动——`git status` 实读：tracked 修改恰 4 文件
  `watch-map.ts`/`runtime.ts`/`schema-write.ts`/`replication-session.ts`，untracked 新增恰
  2 测试文件 + wiki/artifacts 证据；`docs/adr/**`、`CONTEXT.md`、`docs/protocols/**`、
  `packages/ws-replication/**`、`packages/namespace-registry/src/**` **零 diff**——规范基准未被触碰）
- 结论速览：**verdict = clear**；21 项对照 = **9 × implements-existing-decision +
  12 × no-conflict**；0 hard-conflict；0 override；0 evolution-required；
  前置报告 §8-3 清单 ①–⑦ **逐项闭合**；**requiresConflictRecheck = false**（本复查即实现后
  复查，已闭合）。1 条非阻断证据卫生备注（stale log，见 §8-2——事实已由本轮直接核验）。

---

## 1. Reviewed subject

**implementation**。被审 diff（`git diff HEAD` + 2 新文件，本轮全部实读）：

| 路径 | 改动 | 设计落点 |
|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | hub 接口 +`terminateAll(reason): Promise<void>`；`WatchSubscription` +`terminated`/`drainResolve`；泵 `finally` drain 结算；句柄 `unsubscribe` 首行 terminated → 幂等 no-op（不清队）；头注 T3 交付说明 | §7-D1/D2 |
| `packages/namespace-runtime/src/runtime.ts` | `createWatchHub` 构造位前移（V3c''-pre）；`schemaWriteEnv`/`replicationHost` 各捕获 `watchHub`；关闭 admission 分型 `closeAfterFenceNormal`/`closeAfterFenceReset`（共享首步 fanout 终止；reset 风味 = 终止 + 投递结算并入 close 承诺；缓存完整 admission 承诺 + 第二入口早退） | §7-D5-a/b/c（F-1） |
| `packages/namespace-runtime/src/schema-write.ts` | `SchemaWriteEnv` +`watchHub` 字段；S5.6 一行 `void env.watchHub.terminateAll('schema-changed')`（S5.5 `installed` 判定后、S6 前） | §7-D3 |
| `packages/namespace-runtime/src/replication-session.ts` | `RuntimeReplicationHost` +`watchHub` 字段；R5.7 一行 `void host.watchHub.terminateAll('schema-changed')`（R5.6 `text` 变化块内、结局+diag 后、R6 前） | §7-D4（B-T3-2） |
| `packages/namespace-registry/test/issue-389-change-subscription-t3-fixture.ts`（新，631 行） | 共享 fixture（双 Registry 装配沿 #387/#369 seam 先例、replica stub、T3Sink、终止屏障） | SA6 §12.4 |
| `packages/namespace-registry/test/issue-389-change-subscription-termination-red.test.ts`（新，17 用例） | C1–C11 + C4b + CAP + NC3/NC5/NC6 + 3 装置自检 | SA6 §12.2–12.5 |

`watch-end` 产出点全仓恰 3 处（本轮 grep 独立复核）：S5.6（schema-write.ts:323）、
R5.7（replication-session.ts:828）、reset admission（runtime.ts:658）——reason 词表恒两值。

## 2. Inputs and decision set

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-389.md`（brief，AC1–AC7；**issue 评论 0 条**——dispatch 明示 REST 实读空数组，与 brief/SA6 §2/SA3 §1 一致 → 无 owner override 面） | 在场 | 需求源 |
| `wiki/raw/task_issue-389_sa6_contract.md`（approve 附 SA1 冻结条件） | 在场 | 验收契约（C1–C11/NC1–NC6/B-T3-0–6/§12.6 红线） |
| `wiki/raw/task_issue-389_design.md`（iteration 1，SA2 approve） | 在场 | 实现权威（§5 冻结裁定 = SA6 默认全票；§7-D1–D6；§11 ALLOW/DENY；§12 验收映射） |
| `wiki/raw/task_issue-389_sa2_review.md`（iteration 1，approve；F-1 已解决 + N-1–N-5） | 在场 | 设计批准与实现锚 |
| `wiki/raw/task_issue-389_sa3_impl.md`（SA3 实现报告） | 在场 | 被审实现的自述与验证证据索引 |
| `wiki/raw/task_issue-389_relevant_decisions.md` + `..._conflict_report.md`（前置门禁 clear；§5 冻结面、§8-3 复查清单） | 在场 | 本复查的对照基准 |
| `docs/adr/0030-change-subscription.md`（已接受，零 diff） | 在场 | §4/§5/§6/§7/验收节/备选节逐条款 |
| `docs/adr/0018-peer-schema-rearm.md`（已接受，零 diff） | 在场 | §1 同步段/§3 fatal/§4 通知面/§6-§7 冻结 |
| `docs/adr/0010-...md` issue #133 round-2 修订节（已接受，零 diff） | 在场 | reset 冻结次序 + R2-2 close 终止 sessions |
| ADR 0008（+修订节）/0009（+#134/deleteNamespace 修订节）/0011/0014/0023/0027/0028 + `CONTEXT.md` 词条 + 两包 AGENTS | 在场 | 交叉冻结面 |
| 实际 diff + 全部被改文件当前态实读（watch-map/runtime/schema-write/replication-session 关键段逐行；index.ts/internal.ts grep） | 本轮独立 | §3 Evidence |
| `artifacts/sa3-issue389-*.log`（红/绿/回归/全仓/4 mutation/typecheck）+ `artifacts/sa6-issue389-*.log` | 在场 | 证据抽检（§8-2 含 1 条 stale log 备注） |

决策集状态：ADR 全集 28 篇均「已接受」；被取代条款（0007←0008、0016/0024←0027、
0010 reset-切-schema←0018 §7）与本 diff **零接触面**。SA8 未运行任何测试；动态结论
全部引自 SA3 证据日志（本轮抽检 log 与自述一致，除 §8-2 备注的一处 stale capture），
静态/结构性结论由本轮源码实读独立得出；另执行一次只读 `tsc -p tsconfig.typecheck.json
--noEmit`（静态编译检查，非测试运行）以消解 §8-2 的证据矛盾。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0030 §4（L51） | `watch-end` reason `'schema-changed'`（本地 `replaceSchema` 或 Peer re-arm）；流末条、此后静默 | S5.6（`schema-write.ts:323`，位于 S5.5 `sync.kind !== 'installed'` 失败分支 early-return **之后**——fatal 路径逐字不动、零终止产出（设计 §7-D3 边界 + Alt-7））、S6 `await notifyDirty` 之前）与 R5.7（`replication-session.ts:828`，`text` 变化块内、re-arm 结局+diag 配对后、R6 `dirtyStart` 前）两路径产出；`terminateAll` 队尾追加 + 从 `subscriptions` 摘除（此后 `onRootTransaction` 结构性零入队 = 静默） | **implements-existing-decision** | 源码实读（本轮）；C3/C4/C4b/C6/C8 绿（17/17，`artifacts/sa3-issue389-green-contract.log`）；M4（错 reason）变异被 C3 击穿 | 无 |
| 2 | ADR 0030 §4（L51） | `'doc-replaced'`（reset / bootstrap import / genesis 一族） | `closeAfterFenceReset`（`runtime.ts:656–671`）：`watchHub.terminateAll('doc-replaced')` 在关闭 admission 同步段、投递结算并入 close 承诺（`barrier.then(await delivered; shutdown)`）；registry reset 槽零改动（`await closePromise` 后归档 ⟹ 结算即已投递末条）；import/genesis 按 SA6 §15-4/设计 §5 收窄为 reset（排他创建/新 doc ⟹ 订阅在场时结构性不可达） | **implements-existing-decision** | `runtime.ts` 实读；`registry.ts` 零 diff；C5 免 poll 断言绿（流 `['data','watch-end']` 恰合） | 无 |
| 3 | ADR 0030 §4（L43–53 + 备选 L86） | 三 kind 形状封闭；`watch-end {kind,reason}` 两键；origin 恰两态、无 'admin'；通知不含值 | 终止项 = `Object.freeze({ kind: 'watch-end', reason })` 恰两键（`watch-map.ts:528`）；通知联合类型零改动（L73 既有成员）；词表恒 `'schema-changed' \| 'doc-replaced'`（本轮 grep：src 内 reason 字面量仅此两值）；零 onEnd/独立回调（备选 L80 否决面零复活） | **implements-existing-decision** | watch-map.ts 实读；C3/C5 `toStrictEqual` 恰两键断言绿 | 无 |
| 4 | ADR 0030 §5（L57–58） | 宁多勿漏；**绝不按 origin 过滤**（唯一不变量） | `classifyOrigin`（watch-map.ts:305–311）与本 diff 零接触；无任何 origin 分支新增；复制 apply 经 per-session symbol 结构性直达 | no-conflict | diff 实读（该函数零改动）；C1/C2 + NC3 补充绿 | 无 |
| 5 | ADR 0030 §6（L64–66） | 挂点 = 事务提交后异步分发；三来源全覆盖；throw 静默隔离；有界队列溢出 → `invalidate-all` | 终止项复用订阅 FIFO 队列与既有单飞泵（20 微任务让步/项、逐 listener try/catch X1）；容量豁免**仅限终止项**（`terminateAll` 直 push，不经 `enqueueData` 容量检查；data 溢出清队 + 单条 `invalidate-all` 语义逐字不变，watch-map.ts:427–436）；schema 路径 `void` fire-and-forget、reset 路径 await（沿设计 D1-3） | **implements-existing-decision** | watch-map.ts 实读；CAP 用例绿（64 笔快连 → `invalidate-all` 后 `watch-end` 恒末条）；M1（绕队列同步直调）被 C8/CAP 击穿 | 无 |
| 6 | ADR 0030 §7（L69–73） | runtime 承担 schema 安装/doc 替换的**终止编排**；registry 仅 lease 公共面；**通知不出进程** | 终止编排全部落 `namespace-runtime`（hub 方法 + env 字段均为包内模块面）；`registry.ts`/`lease.ts`/`types.ts`/`index.ts` 零 diff；`ws-replication/**` + `docs/protocols/**` 零 diff | **implements-existing-decision** | `git status`/`git diff` 实读（本轮） | 无 |
| 7 | ADR 0030 验收节（L90–92） | 主缝 = lease 公共面（零新接缝）；`watch-end` 两 reason 含 Peer re-arm 路径 | 全部断言经 lease/registry 公共面；fixture 经 `createNamespaceRuntimeWithSeam` 测试 seam 装配 = #387/#369 逐字先例（非新 seam）；hub 方法不经 `index.ts`（watch 类型仍 #387 type-only 面）；`internal.ts` 零 watch/SchemaWriteEnv/ReplicationHost 引用（grep） | **implements-existing-decision** | index.ts/internal.ts grep（本轮）；C11 绿；registry-open 16 键 / phase5 r2 15 键守卫在 V8 86/86 内绿 | 无 |
| 8 | ADR 0030 §1（L16） | `unsubscribe` 幂等；主动退订零通知；lease 释放即清理 | 句柄非 terminated 路径逐字不变（unsubscribed 标志 + 清队 + 摘除）；terminated → 首行 no-op（不清队、零通知）；lease 侧双幂等包装零改动（lease.ts 零 diff——包装仍摘 `activeWatches` 登记，hub 侧 no-op，与 SA2 §3-AC4 核验一致） | **implements-existing-decision** | watch-map.ts:501–512 实读；C7（unsubscribe ×2 零 throw 零通知）绿；#387 契约 21/21（V8） | 无 |
| 9 | ADR 0030 §3（L33–39）+ CONTEXT L66 | 建立判定全部由 active schema；订阅生命周期只与 lease 和 schema 耦合 | `watchMap` 建立门零改动（①lifecycle/②listener/③schema/③b 载体/④path 快照——diff 未触及）；schema-changed 后 lease 仍 `active`、重建按新 tools；doc-replaced 后 released 通道 + 重新 open/import（B-T3-5） | no-conflict | watch-map.ts 建立门实读（零 diff）；C9/C10 绿 | 无 |
| 10 | ADR 0018 §1（L26–38） | apply 槽提交后 schema 同步段位置（live 提交后、`await notifyDirty` 前）；不产生新槽类型、不插队、dirty/ACK 照常 | R5.7 = 同段内一行同步调用 + `void`（槽不 await 投递）；`schemaBefore.text !== schemaAfter.text` 门内（检测成本纪律零变化）；R6 `dirtyStart`/ACK/结果联合（含 `schemaRearm` 携带）零改动 | **implements-existing-decision** | replication-session.ts:804–828 实读；replication-session round2 25/25 + 全仓 re-arm/replication 契约族绿（V8/V10） | 无 |
| 11 | ADR 0018 §3（L55–73）+ B-T3-2（SA1 冻结 = 发） | re-arm 失败 = fatal 双码、tools 不动、apply 不回滚 | R5.7 位于 `rearmPeerActiveSchema` 结局与 `diagFatalTx` 配对**之后**、对 applied/failed 两结局**无条件**发终止（终止因 = 已提交 text 变更，与成败正交）；fatal 结算路径逐字不动 | **implements-existing-decision** | replication-session.ts:817–828 实读；C4b（构造 fatal INVALID → watch-end 仍达且 apply ok 携 `schemaRearm.kind:'failed'`）绿 | 无 |
| 12 | ADR 0018 §4（L88） | 不加 lease 级 promise/事件；通知面归 watchMap | 终止信号全部经 watchMap 通知流；零 observer 借道、零新事件面、零 lease 级 promise | no-conflict | diff 范围实读（仅 3 产出点皆 hub 通道） | 无 |
| 13 | ADR 0018 §6/§7（L120–141） | wire 协议零变更；Hub 行为不变 | `ws-replication/**`、`docs/protocols/**` 零 diff；`applyRemoteUpdate` 签名/结果形状零改动（副作用仅为 text 变化时终止订阅——设计 §10 行 5 预告面） | no-conflict | git diff 实读 | 无 |
| 14 | ADR 0010 #133 round-2 §2（L283–285） | fence 槽绝不创建/等待 close barrier；槽结算后懒 continuation 创建唯一 barrier；归档在 close 后；`NAMESPACE_RESET_*` 冻结 | fence 槽体零改动（`beginResetFence` 槽内 ①–④ 仅双源核验 + 同步 arm closing）；终止编排挂在 `startCloseAfterFence()` continuation（= ADR 明文允许创建 barrier 的层）；barrier 仍经 `lazyCloseBarrier()` 恰创建一次（`close.ts` 零 diff）；registry reset 槽 ⑥ 次序零改动 | no-conflict | runtime.ts:628–671 + registry.ts 零 diff 实读；phase5 fence r2 7/7（双向 same-promise、release 恰一次）+ phase5 reset/bootstrap/identity 契约族绿（V8/V10） | 无 |
| 15 | ADR 0010 R2-2 + runtime AGENTS（F-1 修订面） | `close()` 同步终止/detach 全部存活 ReplicationSession（两入口共享 admission 首步） | 共享同步首步 `fanout.terminateAll('runtime-close')` 在**两种风味**中显式保持（`closeAfterFenceNormal`:647、`closeAfterFenceReset`:657——后者在 terminateAll('doc-replaced') 之前，次序 = 现状）；正常风味 = fanout 终止 + 静默 `watchHub.shutdown()` + barrier（现状逐字）；`close()` 幂等早退保持 | no-conflict | runtime.ts 实读；runtime-replication-session-round2 25/25（R2-2 族：close 后终态 closed、conflicted 不降级、重复 close 同实例）绿 | 无 |
| 16 | ADR 0008 修订节 + runtime AGENTS | 单一严格 FIFO；槽序不变；reads/信号在 FIFO 之外 | 终止**入队**在槽内同步段（S5.6/R5.7/reset admission 同步段）、**投递**经槽外微任务泵（沿 T1 交付形态）；零新槽类型、零插队、sequencer 零改动 | no-conflict | 源码实读；NC1（#387 21/21）绿 | 无 |
| 17 | ADR 0009 #134 + deleteNamespace 修订节 | release 幂等/released 通道/不追踪在途；删除 ≠ 替换 | released 通道零改动（C10 走既有 `NamespaceLeaseReleasedError`）；delete/shutdown/idle close 均经公共 `close()` → **正常风味**（watch 订阅静默清场——§15-5 冻结：不发 watch-end，reason 词表封闭两值）；`terminateAll('doc-replaced')` 唯一挂点 = reset admission，与其余路径零接触 | no-conflict | runtime.ts 实读（reset 风味仅 `beginResetFence` 消费）；C10/装置自检绿 | 无 |
| 18 | ADR 0008 L101（v1 无公共事件订阅；#387 SA8 窄读沿用） | 公共事件面封闭 | T3 零新增公共成员（lease 16 键/runtime 15 键/index 导出面/通知三 kind 形状全冻结）；`beginResetFence` 仍 non-enumerable | no-conflict | index.ts/internal.ts 零 diff（grep）；C11 + 两键集守卫绿 | 无 |
| 19 | ADR 0011/0014 + CONTEXT `_Avoid_` | 诊断变更日志槽外纪律；watch 通知非诊断 | 终止不经诊断日志（零 `namespace-diagnostic-log` 改动、零 diag emit 新点——S5.6/R5.7 均为 hub 通道纯内存操作） | no-conflict | git diff 实读；grep 零诊断面接触 | 无 |
| 20 | ADR 0027/0028 + 守卫门 | readData 四键 helper 门；窗口读/#369 负控 | 读面零 diff；契约中 readData 成功形状断言经集中化 `expectReadDataOkKeys`（C11 内） | no-conflict | 测试文件实读；NC2（#369 33/33）绿（V8） | 无 |
| 21 | 设计 §7-D1–D6/§11 ALLOW-DENY（SA2 approve 版） | 实现逐点落位 + 范围纪律 | D1（terminateAll 语义四条：快照注销/容量豁免/结算承诺永不 reject/幂等）、D2（terminated 分立 + unsubscribe no-op + 泵 finally drain 恰一次）、D5-a/b/c（构造序/分型/完整 admission 承诺缓存 + 第二入口早退不重跑风味体）全部落位；改动恰 = ALLOW 6 行、DENY 全清单零触碰（含 `schema-rearm.ts`/`close.ts`/既有测试零 diff）；N-1（barrier reject 跳过收口良性注记）、N-3（不对称注记 + C3 text 实变信封）、N-5（CAP 落盘）全部有落点 | no-conflict | 逐文件 diff 实读；phase5 T2 双向 same-promise 绿 | 无 |

裁决分布：**implements-existing-decision × 9**（行 1/2/3/5/6/7/8/10/11）、
**no-conflict × 12**（行 4/9/12/13/14/15/16/17/18/19/20/21）。
每项均引用决策路径与具体条款；无一项以「符合 ADR」了结。

### 前置报告 §8-3 清单闭合对账

| 项 | 清单要求 | 本轮核验 | 状态 |
|---|---|---|---|
| ① | 三条路径流末条 `{kind:'watch-end',reason}` 逐字且其后零通知（含 invalidate-all） | 结构性（队尾追加 + 摘除 = 零入队点；shutdown 只清集合内存活订阅——terminated 已摘除、队列保全）+ C3/C4/C4b/C5 `toStrictEqual`、C6/C8(iii)/CAP 静默断言绿 | **闭合** |
| ② | origin 两态无过滤 | `classifyOrigin` 零改动 + C1/C2/NC3 绿（`["local","replication"]` 同流 FIFO） | **闭合** |
| ③ | 键集守卫 16/15、零新增公共成员/导出 | C11 绿 + registry-open/phase5 r2 守卫在 V8 86/86 内绿 + index/internal 零 diff | **闭合** |
| ④ | ADR 0018 槽语义零漂移（同步段位置/dirty/ACK/fatal 双码/tools 不动/apply 不回滚） | R5.7 挂点实读核实 + round2 25/25 + 全仓 re-arm/replication 族绿（V10 4770） | **闭合** |
| ⑤ | ADR 0010 reset 冻结次序零破坏（identity 前置/稳定码/barrier 唯一） | fence 槽体零改动 + barrier 恰一次 + registry 零 diff + phase5 reset/bootstrap/identity 契约绿 | **闭合** |
| ⑥ | B-T3-2/B-T3-6 按 SA1 冻结值 | B-T3-2（failed 也发）：R5.7 无条件覆盖两结局 + C4b 绿；B-T3-6（必达）：unsubscribe no-op 不清队 + force-release 经句柄收敛 no-op + 溢出只在 data 路径 + C8(ii) 绿 + M2/M3 变异击穿 | **闭合** |
| ⑦ | NC1（#387 21/21）/NC2（#369 33/33）/NC3–NC6 全绿 | V8 = 86/86（21+33+7+25）+ 新契约内 NC3/NC5/NC6 锚绿（17/17） | **闭合** |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

零 override：issue #389 评论 = 0 条（无 Owner 覆盖）；ADR 全集/CONTEXT/协议零 diff（无新
修订或版本升级）；实现未启用任何决策文本的演进豁免条款。SA1 冻结位（B-T3-2/3/6）的
实例化取值 = SA6 契约默认（实现逐条一致，SA3 §1 对账表经本轮源码实读独立复核）。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 核验） |
|---|---|---|---|
| 复制 wire / 协议 / session 公共面 | instance-replication-v1 帧/错误码/reason；`openReplicationSession`/`applyRemoteUpdate`/`subscribeOwnedUpdates` 签名语义 | ADR 0030 §7 L73；ADR 0018 §6 | **保持**（`ws-replication/**`、`docs/protocols/**` 零 diff；apply 结果联合零改动） |
| 通知三 kind 形状与词表 | `{kind,origin,changes}`/`{kind,origin}`/`{kind,reason}`；reason 恰两值；origin 恰两值；通知不含值 | ADR 0030 §4 L43–52；CONTEXT L66 | **保持**（终止项恰两键冻结字面量；联合类型零改动；词表 grep 恒两值） |
| readData 交付形状 | 恒四键 + 投影文本 + ✂ 段；helper 门 | ADR 0027；守卫门 #333/#336/#364 | **保持**（读面零 diff；C11 经 `expectReadDataOkKeys`） |
| 窗口读 API 与 #369 负控 | `readArray`/`readMap`/`WINDOW_*`；#369 契约 33/33 | ADR 0028 | **保持**（零 diff；V8 内 33/33 绿） |
| lease / runtime 公共键集 | lease 恰 16 键、runtime 恰 15 键；零新增成员/导出/子路径 | AC7；#387 B-T3-0 | **保持**（C11 + 两键集守卫绿；index/internal 零 diff；`beginResetFence` non-enumerable 保持） |
| ADR 0018 槽语义 | 同步段位置；dirty/ACK 照常；fatal 双码/tools 不动/apply 不回滚 | ADR 0018 §1/§3 | **保持**（R5.7 同段内 `void`；re-arm 结算路径逐字不动；round2/全仓绿） |
| ADR 0010 reset 冻结次序与稳定码 | fence→closing→唯一 barrier→归档；fence 槽不建/不等 barrier；`NAMESPACE_RESET_*` | ADR 0010 #133 round-2 §2 | **保持**（fence 槽体零改动；barrier 恰一次；registry 零 diff；phase5 族绿） |
| ADR 0008/0009 生命周期与失败通道 | 槽序；`errors.ts` append-only；release 幂等/released 通道/不追踪在途 | ADR 0008 修订节；ADR 0009 #134 | **保持**（sequencer/errors/close.ts 零 diff；C10 released 通道；close 同步终止 sessions 两风味一致） |
| 诊断变更日志 | emission/record schema/retention/槽外纪律 | ADR 0011/0014；CONTEXT `_Avoid_` | **保持**（零诊断面接触） |
| 持久化格式与 Registry 构造 | snapshot docstore；`ctx.provide` 访问器纪律 | ADR 0006；ADR 0023 | **保持**（零持久化/registry src 改动） |

## 6. Evolution requirements

**无。** 本实现不改变任何已决定契约：`watch-end` 产出、FIFO 终止、reset admission 终止
编排全部是 ADR 0030 §4/§6/§7 明文义务的兑现；B-T3-2/3/6 按前置门禁裁决属决策文本未覆盖
缺口的实例化（取值 = SA6 默认），实现未扩大任何 override；零 ADR/CONTEXT/协议修订需求。
前置报告 §6 的唯一 evolution 触发预案（「force-released lease 一律静默」读法）**未发生**——
实现选择了投递结算机制（AC3 在 lease 公共面满足）。

分期义务交接（非本票、登记防丢失）：T2 #388（谓词面）、T4 #390（溢出注入/父路径删除
编排 + runtime 键集纯加法验收——本票 CAP 只锁「溢出语义不变 + 终止项恒入队」）、
T5 #391（文档面，含 N-2/N-3 措辞输入）；已登记残余 R3（S5.5 不可达防御分支零终止）/
R4（re-arm fatal 后重建按旧 tools）均不越出已接受决策边界。

## 7. Hard conflicts

**无。** 21 项对照（§3）无一项 hard-conflict：实现与 ADR 0030 §4/§5/§6/§7/验收节为忠实
兑现；与 ADR 0018 §1/§3/§4/§6 的接触面（同步段挂点、failed 分支、通知面归属、wire 零改）
全部相容且被既有契约族 + 新契约锁定；与 ADR 0010 #133 冻结次序、R2-2 close 终止 sessions
（F-1 修订面）、ADR 0008/0009 生命周期纪律均为零破坏或逐字保持；SA6 §12.6 六条实现期
红线逐条核验通过（§3 行 4/6/13/18/19/20 + §5 表）。

## 8. Required actions

1. **无阻断项。** 本复查闭合前置报告 §10 的 `requiresConflictRecheck = true`（§3 对账表
   ①–⑦ 全闭合）。
2. **非阻断证据卫生备注（建议在 finalize 前修正）**：`artifacts/sa3-issue389-test-typecheck.log`
   是一份 **stale 中间态捕获**——内容含 4 条 TS 错误（fixture L450/451/460/461 的宽谓词
   `reason: string`/`origin: string`），与 SA3 §6.2-V5 引用它证明的「exit 0」结论相矛盾；
   当前交付树的 fixture 已改用窄谓词（`'schema-changed' \| 'doc-replaced'` /
   `'local' \| 'replication'`，宽返回注解经协变合法）。本轮已对交付树直接执行同款静态
   编译检查 `npx tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**，事实成立、仅日志
   文件未更新为最终态。SA3（或 finalize 前）应以最终树重捕该日志；不影响本门任何裁决。
3. **交接**：SA4/SA7 活链路与最终动态验收（C1–C11 红绿复现、回归门复跑）按分工继续，
   其结论属实现质量域，非冲突面；T4 #390/T5 #391 按 §6 分期表交接。

## 9. Verdict

**clear** —— 交付实现（4 runtime 源文件 + 2 契约文件）对已批准契约/设计（SA6 approve +
SA1 iteration 1 + SA2 approve）、ADR 0030/0018/0010 及全部冻结公共/生命周期面为**忠实兑现**：
三条终止路径挂点与冻结值逐字落位（S5.6/R5.7/reset admission）；F-1 共享首步在两种 close
风味中显式保持（R2-2 回归族 25/25 绿）；fence→closing→唯一 barrier→归档 冻结次序零破坏
（registry/close.ts 零 diff，phase5 族绿）；词表/键集/wire/读面/诊断/持久化零接触；
红→绿（10 红 → 17/17 绿）与 4 项 mutation 敏感度证据在档；DENY LIST 全清单零触碰。
裁决分布：implements-existing-decision × 9、no-conflict × 12、hard-conflict × 0、
evolution-required × 0、override × 0。无输入缺失（issue 评论 0 条 = 无 owner 条款）；
无证据不足（唯一 stale log 的事实已由本轮静态编译检查直接核验成立，§8-2）。

## 10. requiresConflictRecheck

**false**。理由：本报告即前置门禁登记的实现后冲突复查，其触发面——生命周期次序（reset
admission 终止投递 vs force-release/close barrier、close 承诺缓存组成）、失败语义（B-T3-2
failed 分支）、状态机段挂点（S5.5/R5.6 同步段入队时机）、公共通知行为（watch-end 形状/
流末条/静默/unsubscribe no-op）——已全部经本轮源码级结构性核验 + 证据日志对账闭合
（§3 对账表 ①–⑦）；公共 API/wire/schema/持久化面零接触（§5）。剩余开放项（SA4/SA7 动态
验收、T4/T5 分期票、已登记残余 R3/R4）均不构成新的决策冲突面。
