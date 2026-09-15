# SA4 实现静态审查 — issue #389：复制来源与订阅终止（变更订阅 T3）

- 审查轮：2026-09-15（iteration 0；dispatch `sa-fba1ec4a-41b7-41c2-8573-41434fc7de6f`，phase = implementation-review）
- 被审对象：SA3 交付切片 = tracked 修改恰 4 文件（`watch-map.ts` / `runtime.ts` /
  `schema-write.ts` / `replication-session.ts`）+ 新增 2 契约文件（fixture 631 行 +
  行为契约 594 行 / 17 用例）；`git status` / `git diff --stat HEAD` 本轮实读核对
- 审查方法：逐行实读 4 个源文件全部 diff 与周边段（含 watch-map 泵/队列/句柄全读、
  runtime 关闭 admission 与 close()/beginResetFence、schema-write S1–S7、
  replication-session R1–R7、registry reset 槽 ⑥ 与 lease 释放清理）、两份新测试文件
  全读、证据日志抽检（红/绿/回归/typecheck/全仓/4 mutation）、独立 grep（watch-end
  产出面/reason 词表/terminateAll 调用点）、独立静态编译检查
  （`npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0，本轮亲测）；未修改任何
  实现/设计/测试，未运行测试或服务
- 结论速览：**verdict = approve**。设计 D1–D6 与 SA1 冻结位（B-T3-0–B-T3-6、
  §15-4/§15-5）逐点在源码落位；ALLOW 6 行恰合、DENY 全清单零触碰；契约 C1–C11 +
  CAP + NC3/NC5/NC6 真实经 runner 触发、断言纪律合规、4 项 mutation 全部击穿；
  红面首因统一（终止编排缺席）。0 BLOCKER / 0 MAJOR；5 条非阻断观察（含 1 条
  SA8 已登记的 stale 证据日志，事实已由 SA8 与本轮双重独立复核成立）。

---

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-389.md`（Host brief；issue 评论 **0 条**，dispatch 明示 REST 实读空数组） | 在场 | 需求源 AC1–AC7；无 owner 条款 |
| `wiki/raw/task_issue-389_sa6_contract.md`（approve 附 SA1 冻结条件） | 在场 | 验收契约 C1–C11 / NC1–NC6 / B-T3-0–6 / §12.3–12.6 |
| `wiki/raw/task_issue-389_design.md`（iteration 1） | 在场 | 实现权威（§5 冻结裁定、§7-D1–D6、§11 ALLOW/DENY、§12 验收映射） |
| `wiki/raw/task_issue-389_sa2_review.md`（iteration 1，approve；F-1 已解决 + N-1–N-5） | 在场 | 设计批准与实现锚（S-4 竞态窗口结构性核验） |
| `wiki/raw/task_issue-389_sa3_impl.md` | 在场 | 被审自述与证据索引 |
| `wiki/raw/task_issue-389_relevant_decisions.md` + `..._conflict_report.md`（前置门禁 clear，requiresConflictRecheck=true） | 在场 | SA8 约束面 |
| `wiki/raw/task_issue-389_implementation_conflict_report.md`（**实现后冲突门**：verdict = clear；§8-3 ①–⑦ 逐项闭合；requiresConflictRecheck = **false**） | 在场 | post-implementation conflict gate 对账（§3 下方专表） |
| 实际 diff + 4 源文件当前态 + 2 新测试文件 | 本轮独立实读 | §4–§9 |
| `artifacts/sa3-issue389-{red-contract-final,green-contract,regression-gates,typecheck,test-typecheck,package-tests,full-suite,mutation-M1..M4}.log` + `artifacts/sa6-issue389-*.log` | 在场（抽检） | 证据核验（§9；§12-N-O1 含 1 条 stale log 备注） |
| `docs/adr/0030` / `0018` / `0010(#133 round-2)`、`CONTEXT.md` L65–67、两包 `AGENTS.md` | 在场 | 规范与包边界 |

---

## 2. Verdict

**approve** —— 实现对批准设计（SA1 iteration 1 / SA2 approve）、SA6 验收契约（附冻结
条件全部满足：B-T3-2/B-T3-3/B-T3-6 冻结值 = SA6 默认且逐条落位）与 ADR 0030 §4/§5/§6/§7、
ADR 0018 §1/§3、ADR 0010 #133 冻结次序为**忠实兑现**；实现后冲突门（SA8 implementation
conflict report）已闭合（clear / requiresConflictRecheck=false，其关键主张经本轮源码
独立复核成立：产出点恰 3、reason 词表封闭两值、registry 零 diff、键集守卫绿）。
测试真实、可判、经 runner 触发且对四类错误实现（绕队列/清队/撤豁免/错 reason）敏感。
无 BLOCKER / 无 MAJOR；非阻断观察见 §12。

---

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 复制 apply `data` + `origin:'replication'`；本地恒 `'local'`（零新实现 + 回归锁） | `classifyOrigin`（watch-map.ts:331–334）零改动；C1/C2 + NC3 补充绿（`["local","replication"]` 同流 FIFO、零 watch-end） | ✅ 落实（补锚形态，与 SA6「HEAD 已具备」判定一致） |
| AC2 Hub 本地 `replaceSchema` → 全部存活订阅 `watch-end:'schema-changed'` | S5.6（schema-write.ts:314–323）：S5.5 `installed` 判定后、S6 `await notifyDirty()` 前同步段 `void env.watchHub.terminateAll('schema-changed')`；C3 绿（oracle：`replaceSchema ok` + `getSchema().text` 切换 V2） | ✅ 落实（B-T3-1 挂点逐字） |
| AC2 Peer 复制 apply 槽 schema re-arm（ADR 0018）同 reason | R5.7（replication-session.ts:820–828）：`text` 变化块内、re-arm 结局 + failed-diag 配对后、R6 前同步段；**applied/failed 两结局无条件**（B-T3-2 冻结 = 发）；C4（applied + 指纹双侧一致 oracle）与 C4b（fatal INVALID 构造 → `schemaRearm.kind:'failed'` 且 watch-end 仍达、apply 仍 ok）绿 | ✅ 落实 |
| AC3 doc 替换（reset）→ `watch-end:'doc-replaced'` | `closeAfterFenceReset`（runtime.ts:655–671）：`terminateAll('doc-replaced')` 在关闭 admission 同步段、投递结算（`await delivered`）并入 close 承诺；registry reset 槽零改动（`startCloseAfterFence` → `forceReleaseOutstandingLeases` → `await closePromise` → archive，registry.ts:1860–1898 实读核对）；C5 免 poll 断言绿（reset 结算即流含已投递末条） | ✅ 落实（B-T3-3 冻结机制逐字） |
| AC4 `watch-end` 流末条：此后静默、已注销；`unsubscribe` 幂等 no-op | `terminateAll` 队尾追加 + 从 `subscriptions` 摘除（= 零入队点结构性静默）；句柄 `unsubscribe` 首行 `terminated` → no-op **不清队**（watch-map.ts:502–512）；C6（终止后写 + 双预算 400 ×2 零新增）与 C7（×2 零 throw，嵌于 C5/C9）绿 | ✅ 落实 |
| AC5 FIFO：终止与滞留 data 同流有序、不丢 | 同槽序：handler data 入队（事务提交同步回调）→ 终止项队尾追加；终止后零写者；C8 三断言（末位 / dataKeys==['t3','t4','t5'] / 终止后零通知）绿；M1（绕队列）击穿 C8+CAP、M2（清队）击穿 C8(ii) | ✅ 落实（B-T3-6 必达） |
| AC6 终止后重建只与 lease/schema 耦合 | C9（schema-changed：lease `active` + 重新 `watchMap` 按 V2 建立并投递 + 旧句柄双退订 no-op）；C10（doc-replaced：released 通道 `NamespaceLeaseReleasedError` + 重新 open 后新订阅可用零终止信号） | ✅ 落实 |
| AC7 全部经 lease 公共面、零新接缝 | C11：lease 恰 16 键 / runtime 恰 15 键 / kind ⊆ 三 kind 闭集 / readData 经 `expectReadDataOkKeys`；`index.ts`/`internal.ts` 零 diff（本轮 grep：hub 接口与 env 字段全为包内模块面）；键集守卫（registry-open / phase5 r2）在 V8 86/86 内绿 | ✅ 落实 |
| Owner 评论条款 | issue #389 评论数 = 0（dispatch REST 实读 `[]`；brief/SA6 §2/SA3 §1 三方一致） | 无条款可遗漏；无旧评论覆盖最新要求的风险 |
| SA2 F-1（MAJOR，iteration 0）——close admission 共享首步 | `closeAfterFenceNormal`（runtime.ts:646–653）= fanout 终止 + 静默 `watchHub.shutdown()` + barrier（与改前 `closeAfterFence` 逐字等价）；`closeAfterFenceReset` 首行早退后第二入口复用同一实例、admission 恰执行一次；R2-2 回归族 25/25 + phase5 fence 7/7（含双向 same-promise）绿 | ✅ 落实（SA3 §4 表核实成立） |
| SA2 N-1–N-5 | N-1 = 实现注记（runtime.ts:662–666，未构造可 reject 第二承诺链）；N-2 = T5 #391 措辞登记；N-3 = S5.6 注释 + C3 用 text 实变信封（未设同文本零终止断言）；N-4 = 完整 admission 承诺缓存 + 早退不重跑风味体；N-5 = CAP 落盘（64 笔快连 → `invalidate-all` ≥1 且 watch-end 恒末条） | ✅ 全部落位 |
| **post-implementation conflict gate**（本 dispatch 明示项） | `wiki/raw/task_issue-389_implementation_conflict_report.md`：verdict = **clear**、0 hard-conflict / 0 override / 0 evolution-required、前置报告 §8-3 ①–⑦ 逐项闭合、requiresConflictRecheck = **false**；本轮独立复核其承重主张：产出点恰 3 处（schema-write.ts:323 / replication-session.ts:828 / runtime.ts:658）、reason 字面量全仓恰 `'schema-changed'|'doc-replaced'`、registry/lease/schema-rearm/close 零 diff、键集不变 | ✅ 门已闭合且主张成立；SA4 未发现新 ADR 冲突风险（requiresConflictRecheck 不提交） |

---

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1-1 快照迭代注销（置 `terminated`、摘除、队尾追加 `Object.freeze({kind,reason})` 恰两键、`schedulePump`） | watch-map.ts:520–536（顺序与设计逐字一致：executor 同步置 `drainResolve` 后才 `schedulePump`，无丢唤醒窗口） | 一致 | — |
| D1-2 容量豁免（上界只治理 `enqueueData`；终止项恒入队，瞬时 ≤ capacity+1） | `terminateAll` 直 `queue.push`，不经容量检查；溢出降级路径（watch-map.ts:431–446）逐字未动 | 一致 | — |
| D1-3 投递结算承诺（排空即 resolve、永不 reject、零订阅立即 resolve；schema 侧 `void` / reset 侧 await） | watch-map.ts:363–371（泵 `finally`：`terminated && queue.length===0` → resolve 恰一次并清回调位）；runtime.ts:658–661；535（`drains.length===0 → Promise.resolve()`） | 一致 | — |
| D1-4 幂等（多次调用各作用于当时存活集合） | 摘除集合 ⟹ 已终止订阅天然不重复；每订阅恰一条终止项（C3/C5 `toStrictEqual` 末条断言） | 一致 | — |
| D2 `terminated`/`unsubscribed` 分立；泵排空至队空；`unsubscribe` terminated → 首行 no-op 不清队 | watch-map.ts:156–162/349–351（泵循环条件未改，terminated 订阅 `unsubscribed` 恒 false → 排空收尾）/502–506 | 一致 | — |
| D3 `SchemaWriteEnv.watchHub` 字段 + S5.5 `installed` 后 / S6 前一行 | schema-write.ts:96–98/314–323；S5.5 失败分支 early-return 位于终止产出**之前**（fatal 结算逐字不动，Alt-7 边界保持） | 一致 | — |
| D4 `RuntimeReplicationHost.watchHub` + R5.6 `text` 块内 / 结局+diag 后 / R6 前 | replication-session.ts:353–355/820–828；`schemaBefore` 仅 peer 捕获（:675–676）⟹ hub 角色零终止产出（与 ADR 0018 peer 专属 re-arm 对齐；hub 方向 SCHEMA 变更被 R4 protected-field 拒绝，无漏路径） | 一致 | — |
| D5-a 构造位前移（依赖仅 doc/state；两 env 捕获同一局部量） | runtime.ts:551–571/617（INV-N14 捕获局部量纪律；纯语句序调整） | 一致 | — |
| D5-b 分型 + 共享首步（F-1）+ reset 风味投递结算 + 防御收口后置 | runtime.ts:631–671；正常风味与改前逐字等价；reset 风味 `barrier.then(await delivered; shutdown())`；N-1 注记在场 | 一致 | — |
| D5-c 同一承诺不变量（缓存完整 admission 承诺；首调用者固定风味；第二入口不重跑） | runtime.ts:604/625–629/655–671/902–916；`lazyCloseBarrier` 先置 barrier 后被 admission 覆写——两步全同步、无观察窗口；phase5 T2 双向 same-promise 7/7 绿 | 一致 | — |
| D5-d registry 零改动即满足契约 | registry.ts 零 diff；reset 槽 ⑥ 次序（startCloseAfterFence → forceRelease → await closePromise → archive）实读核对：终止入队先于 force-release，lease 清理经句柄对 terminated 为 no-op（lease.ts:235–244 零 diff） | 一致 | — |
| D5-e 有界性（≤(capacity+1)×20 微任务/订阅，无墙钟无 I/O） | 泵结构核实；C6 预算 400 > 340 上界，确定性 | 一致 | — |
| D6 公共面零新增 | index.ts / internal.ts 零 diff；`NamespaceRuntimeWatchHub` 不经 index 导出；无新 `*.test-d.ts`（公共类型零变化） | 一致 | — |
| B-T3-0/1/2/3/4/5/6 + §15-4/§15-5 冻结值 | 逐条见 §3 与上表；§15-5：delete/shutdown/idle 全走正常风味（静默）——`terminateAll('doc-replaced')` 唯一挂点 = reset admission | 全部 = 冻结值 | — |
| 设计明确但实现缺失 | 未发现（全部决策有落点） | — | — |
| 实现偏离设计 | 未发现必要偏离；SA3 §8 声明的 4 条「实现期注记」（早退复用 / barrier 懒创建保持 / `V3c''-pre` 注释标签 / 契约窄谓词）均为设计明文允许或纯注释/类型面 | — | — |

### 实现后冲突门对账（dispatch 明示项）

SA8 implementation conflict report（clear / requiresConflictRecheck=false）的 21 项对照
中，本轮对可直接静态核验的承重项做了独立复核，全部成立：watch-end 产出点恰 3 处；
reason 词表封闭两值；正常 close 风味保留 fanout 首步（R2-2）；fence 槽体零改动；
`schema-rearm.ts`/`close.ts`/`registry.ts`/`lease.ts`/`types.ts`/`index.ts`/
ws-replication/docs/CONTEXT 零 diff；诊断面零接触。SA8 §8-2 的 stale log 备注经本轮
复核实录于 §12-N-O1。

---

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 终止编排（schema 安装 / doc 替换） | runtime（ADR 0030 §7） | watch-map hub + 三个 runtime 侧挂点；registry/lease 零改动 | ✅ |
| 订阅生命周期登记/清理 | lease（capability 随 lease） | lease.ts 既有 `activeWatches` 零改动；terminated 收敛为 no-op | ✅ |
| reset 编排（fence/force-release/archive） | registry | registry.ts 零改动；机制经 runtime 关闭 admission 达成 | ✅ |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 会话批量终止 | `createSessionFanout.terminateAll('runtime-close')`（replication-session.ts:240/328，close admission 共享首步） | watch hub `terminateAll(reason)`（同命名同幂等形态，对象分立：session 集 vs 订阅集） | 一致（结构同源） | 沿既有「快照迭代 + 摘除 + 幂等」先例；两者无交叉依赖（设计 §7-D5-b 论证） |
| 异步分发泵 | fanout `schedulePump`（20 微任务让步/项） | 终止项复用订阅既有 FIFO 队列与单飞泵（零第二泵） | 一致 | ADR §6 挂点纪律；M1 变异证明未绕队列 |
| 关闭 barrier 懒创建 | `lazyCloseBarrier`（公共 close 与 fence 共用） | 两风味均经同一入口；reset 仅追加结算段 | 一致 | ADR 0010 #133 冻结次序零破坏（phase5 族 7/7） |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 订阅存活集 | hub `subscriptions` Set | `terminated`/`unsubscribed` 标志（摘除即注销，无双登记） | 无（单一集合） |
| close 承诺 | `closePromise` 单缓存 | 无第二缓存/副本 | 无（D5-c 早退复用同一实例） |
| schema 生效事实 | `state.schemaState/activeTools`（S5.5/R5.6 既有安装点） | 终止编排不携带第二 schema 状态，只消费安装结果 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| `watchMap`（六门校验全前置） | `unsubscribe`（幂等；terminated → no-op）/ `terminateAll`（摘除 + 队尾终止项 + drain 承诺）/ `shutdown`（幂等防御收口，只作用集合内存活订阅——terminated 已摘除、队列保全） | listener throw 逐投递隔离（X1）；drain 承诺永不 reject；barrier reject 时收口跳过为良性（N-1） | ✅ 对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二分发通道（终止直调 listener） | 订阅 FIFO 泵 | 无——终止项入同一队列（M1 变异即红） | 不存在 |
| 第二清理 worker / retry loop | 无（也无需） | 无 | 不存在 |
| `terminateAll` vs `shutdown` 分工 | — | 终止（带信号、保投递）vs 收口（静默、清集合）——头注与接口注释明示分工 | 非重复 |

---

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts`（+68/−6） | ALLOW 行 1 | D1/D2 终止原语与状态机（①hub 方法 ②terminated/drainResolve ③泵 finally ④退订豁免 ⑤头注） | ✅ 恰合 |
| `packages/namespace-runtime/src/runtime.ts`（+52/−10） | ALLOW 行 2 | D5-a 构造位前移、D5-b/c 分型与承诺缓存、D3/D4 字段接线 | ✅ 恰合 |
| `packages/namespace-runtime/src/schema-write.ts`（+17） | ALLOW 行 3 | D3 S5.6 一行 + env 字段 + 头注 | ✅ 恰合 |
| `packages/namespace-runtime/src/replication-session.ts`（+13） | ALLOW 行 4 | D4 R5.7 一行 + host 字段 | ✅ 恰合 |
| `packages/namespace-registry/test/issue-389-change-subscription-t3-fixture.ts`（新增 631 行） | ALLOW 行 5 | SA6 §12.4 fixture 规格（双 Registry 装配 / replica stub / sink / 终止屏障 / readData helper） | ✅ 恰合 |
| `packages/namespace-registry/test/issue-389-change-subscription-termination-red.test.ts`（新增 594 行 / 17 用例） | ALLOW 行 6 | C1–C11 + NC3/NC5/NC6 + CAP + 装置自检 | ✅ 恰合 |

- DENY 全清单零触碰：`git diff HEAD --name-only` 恰上述 4 tracked 文件；`registry.ts`/
  `lease.ts`/`types.ts`/`index.ts`、`ws-replication/**`、`docs/**`/`CONTEXT.md`、读面
  （`read-schema-projection`/`window-read`/`projection`）、`namespace-diagnostic-log/**`、
  `schema-rearm.ts`/`p0.ts`/`close.ts`/`write.ts`、全部既有测试——零 diff（本轮实读）。
- 未修改 ALLOW 中任何既有测试（回归基线原样：#387 21/21、#369 33/33、phase5 7/7、
  round2 25/25 全绿，V8 日志）。
- untracked 内容 = 2 测试文件 + artifacts 证据日志 + wiki Host/SA 输入文档，均非生产面。

---

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| 通知联合新增可达值 `watch-end`（类型 T1 已冻结） | watchMap 消费方（仓内零生产调用方，T1 后首次投产） | 流末条两键纯数据；消费方按 reason 重建（文档面归 T5 #391） | 低（新增面首次投产，无既有 caller 破坏） | — |
| `unsubscribe()` 在 terminated 态变为 no-op（不清队） | 全部句柄持有者（含 lease 释放清理 lease.ts:235–244） | 非 terminated 行为逐字不变（#387 L1 冻结保持）；terminated no-op 是 AC4 本义；force-release 清理经句柄收敛（M3 变异证明 C5/C10 敏感） | 无 | — |
| `replaceSchema` ok 后新增副作用（终止订阅） | hub lease 调用方 | 接口/结果形状零变化；lease.ts 透传零改动 | 无 | — |
| `applyRemoteUpdate` 结果联合携带 `schemaRearm` | ws-replication 层 / 测试 | 签名与结果形状零改动；副作用 = text 变化时终止（含 failed）；round2 25/25 + 全仓 4770 绿 | 无 | — |
| `registry.resetReplica` 结算时点 | 调用方 | ok 结算 = 终止项已投递（多一段有界微任务）；归档时序不变；phase5 reset/bootstrap/identity 族绿 | 低（结算延迟有界，R1 已评估） | — |
| 公共 `close()` / idle close / deleteNamespace / shutdown | registry L1145/L1992/L2148 消费点 | 正常风味逐字保持（fanout 终止 + 静默收口）；R2-2 族 25/25 绿 | 无 | — |
| close 承诺缓存组成变化（barrier → 完整 admission） | phase5 fence 契约 / R2-2 族 | 同一实例不变量显式保持（双向 same-promise 7/7）；release 恰一次 | 无 | — |
| 诊断日志 / observer 面 | — | 终止不经诊断（零 emit 新点、零包改动） | 无 | — |

漏查 caller：未发现（`SchemaWriteEnv`/`RuntimeReplicationHost` 全仓构造点唯一 =
runtime.ts，接口必填字段不产生第二装配点）。

---

## 8. 错误、恢复与并发

- **泵竞态（本轮专项推演）**：`terminateAll` 的入队 → 置 `drainResolve` → `schedulePump`
  三步与泵的让步后重检（watch-map.ts:350–351）/`finally`（:363–371）在 run-to-completion
  下无交错窗口——泵在途则重检命中队列、泵已退则 `pumpScheduled===false` 新泵启动，
  **无丢唤醒、无悬挂 drain**；泵不存在「带非空队列退出」路径（terminated ⟹
  `unsubscribed` 恒 false，while 条件与 re-check 只在队空时退出）。
- **清队点穷举（B-T3-6 必达）**：主动退订（no-op）/ lease force-release（经句柄 →
  no-op）/ reset 路径 `shutdown()`（后置到投递结算后且只作用集合内存活订阅——
  terminated 已摘除）/ 溢出清队（仅 `enqueueData` data 路径，terminated 订阅不在
  handler 迭代集内）——terminated 队列免于全部清队点。M2/M3 变异实证契约敏感。
- **终止产出零 throw**：`terminateAll` 体 = 集合快照迭代 + push + Promise 构造，无抛点；
  drain 承诺永不 reject ⟹ S5.6/R5.7 的 `void` 无 unhandled rejection；reset 风味
  `.then` 内零抛点（N-1 注记禁止第二可 reject 承诺链——实现遵守）。
- **listener throw**：终止项投递沿用逐投递 try/catch（X1），不影响 drain 结算与其余
  订阅（与 data 投递同一代码路径，#387 契约 X1 锁定）。
- **barrier reject**（`handle.release` 失败）：reset 风味成功臂跳过防御收口——良性
  （terminated 已摘除、lifecycle='closed' 拒新订阅、终止项经独立泵送达）；registry
  映射既有 fatal 通道（reset 槽 ⑥ try/catch，零改动）。
- **重入**：listener 内重建订阅（C9 实测）——新订阅独立对象/独立泵；lifecycle/schemaState
  门照常裁决（schema-changed 后新 tools 已装，重建按 V2）。
- **风味竞抢**（fence armed 与 `startCloseAfterFence` 之间的公共 close 插入）：runtime
  seam 层可达（phase5 T2 用例 1 实测 `startP === closeP` 早退路径）但 registry 层结构性
  不可达带活订阅（SA2 S-4 核验：idle close 被 phase 门挡、delete/reset 同 key carrier
  FIFO 串行、shutdown 先 await carrier tail）——早退时正常 close 只发生在零 lease ⟹
  零订阅场景，无消费者可见损失；设计 D5-c 明文此语义。
- **幂等**：`terminateAll`（集合语义）/ `unsubscribe`（双态）/ `close()`（同实例）/
  `release`（ADR 0009）全幂等。
- **失败可重试性 / 回滚**：mismatch/missing 零破坏期零终止（订阅照旧存活，正确——doc
  未被替换）；终止不可逆流语义，重建即恢复（AC6）——与设计 §9 一致。

---

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| C1/C2（AC1+NC3） | 本地 `origin:'local'`、复制 apply `origin:'replication'` 恰三键逐字、同流 FIFO、零 watch-end | vitest include `packages/*/test/**/*.test.ts`（`vitest.config.ts` L15；green log 实跑） | 无 | — |
| C3（AC2-A） | oracle（ok + text 切换）→ 流 `[data, watch-end]`、末条恰两键 reason 逐字、lease 仍 active | 同上 | 无（text 实变信封，未设同文本零终止断言——N-3 落实） | — |
| C4/C4b（AC2-B + B-T3-2） | re-arm oracle（`schemaRearm.kind` + 指纹双侧一致）；failed 分支 watch-end 仍达且 apply ok | 同上 | 无 | — |
| C5（AC3 + B-T3-3） | reset ok + archive 恰 1 → **免 poll** 断言流已含已投递末条 doc-replaced；lease released；`unsubscribe` ×2 零 throw 零通知（C7） | 同上 | 无（免 poll = 机制级断言，强于 SA6 默认「最终送达」） | — |
| C6（AC4） | 终止后写 + `microtasks(400)` ×2 双预算 → 计数不变、末条仍 watch-end | 同上 | 无（屏障式静默断言，非 sleep） | — |
| C8（AC5 + B-T3-6） | 3 笔快连事务 + 立即 replaceSchema：(i) 末位 (ii) dataKeys 恰 `[t3,t4,t5]`（必达）(iii) 终止后零通知 | 同上 | 无（M1/M2 变异分别击穿 (i)/(ii)） | — |
| CAP（容量豁免） | 64 笔快连 → `invalidate-all` ≥1（溢出语义不变）+ watch-end 恒末条 | 同上 | 无（SA2 N-5 优选落盘已兑现） | — |
| C9/C10（AC6） | schema 路径重建（active + V2 投递 + 旧句柄 no-op）；doc 路径 released 通道 + 重新 open 新订阅零终止 | 同上 | 无 | — |
| C11（AC7） | lease 16 键 / runtime 15 键 / kind ⊆ 闭集 / readData 经集中化 helper | 同上 | 无 | — |
| NC5/NC6/NC3 补充 | 数据缺席/容器删除不终结；无效写零通知；origin 无过滤 | 同上 | 无 | — |
| 装置自检 ×3 | hub/peer/reset 前提 oracle（身份投影/import 排他/双源一致） | 同上 | 无（红不来自装置的红面证明） | — |
| NC1/NC2 | #387 21/21、#369 33/33 | V8 回归门实跑 | 无 | — |

断言纪律核查（SA6 §12.5 逐条）：零 `skip/only/todo`（本轮 grep，仅头注提及）；零
`setTimeout`/sleep（等待 = `expect.poll` 5ms/2s 先例 + `microtasks` 预算）；形状全部
`toStrictEqual`（恰两键/恰三键/定位符恰两键、reason 逐字）；零源码字符串断言；零 env
override（仅仓内既有 `NODE_OPTIONS=--conditions=nomicore-source`）；静默断言 = 屏障；
oracle 双侧（本地 text 切换 / peer 指纹一致）。

触发与类型入口：新契约文件被 vitest include 命中（green log + full-suite log 内
17/17）；fixture 无 describe/it 不被收集（先例同款）；测试程序
`tsconfig.typecheck.json` 含新两文件——本轮独立 `tsc --noEmit` → **exit 0**。

红绿与敏感度：实现前红 = 10 failed / 7 passed（首因统一 = `waitForWatchEnd` 超时 =
流中无 watch-end；`artifacts/sa3-issue389-red-contract-final.log` 实读）；实现后
17/17；mutation M1（绕队列）→ C8+CAP 红、M2（清队）→ C8 红、M3（撤退订豁免）→
C5+C10 红、M4（错 reason）→ C3 红——四类错误实现全部被击穿。

覆盖缺口（全部非契约义务，见 §12-N-O3）：多订阅同刻终止（AC2「全部存活订阅」）未设
多 sink 用例；peer 路径滞留 data FIFO（apply 同时携带 schema+data）未设专用用例
（C4 的 data 在 apply 前已送达，非滞留构造——SA6 §12.3 C8 配方本就只指定本地路径）；
watch-end 投递的 listener throw 隔离未直接断言（与 data 同一泵路径，#387 X1 已锁）；
`terminateAll` 连续两次幂等未直接断言。

---

## 10. Required revisions

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance | Suggested routing |
|---|---|---|---|---|---|---|
| —（无阻断项） | — | — | — | — | — | — |

---

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| peer 路径「同 update 携带 schema+ROOT data」的滞留 data FIFO（data 在 R5 入队、终止在 R5.7 队尾追加） | 活链路验收（SA7 域）：peer apply 一笔混合 update 后断言 `[data(replication), watch-end]` 序 | data 先达、watch-end 末条、终止后零通知 | watch-end 先于 data 或 data 丢失 |
| reset 多订阅/多 lease 并发下的投递结算（drain = `Promise.all`，各订阅泵并发） | 活链路：N 订阅 + M lease 下 resetReplica，断言全部 sink 末条 doc-replaced 且 reset 结算免 poll | 每个 reset 前存活 sink 恰一条已投递末条 | 任一 sink 缺末条或 reset 结算早于投递 |
| watch-end 投递中 listener throw 的隔离与 drain 结算（X1 在终止项上的行为） | 活链路：坏消费者 + 好消费者同刻终止 | 坏消费者 throw 不影响好消费者收齐、drain 照常 resolve、写/reset 结果不变 | drain 悬挂或好消费者缺终止项 |
| CAP/全仓套件在 CI 调度下的稳定性（纯微任务驱动，理论零 flake） | CI 全量复跑 `pnpm test` | 4770 全绿复现 | 任何 flake |
| `closeAfterFenceReset` 早退风味（runtime seam 层公共 close 抢先）在 registry 真实编排下的不可达性 | 既有 phase5 族复跑 + registry 并发契约 | same-promise 断言绿、无 silent-watch-loss 场景 | 出现带活订阅的早退风味 |

---

## 12. Non-blocking observations

| # | 观察 | 处置建议 |
|---|---|---|
| N-O1 | **证据卫生**：`artifacts/sa3-issue389-test-typecheck.log` 为中间态 stale 捕获——内容含 4 条 TS 错误（fixture L450/451/460/461 宽谓词旧形态），与 SA3 §6.2-V5 引用它证明的「exit 0」相矛盾；交付树已改窄谓词，最终事实成立（SA8 复跑 exit 0 + 本轮独立 `tsc -p tsconfig.typecheck.json --noEmit` exit 0 双重确认）。SA8 §8-2 已登记 | finalize 前以最终树重捕该日志（SA3/收尾侧动作；不影响本裁决——实现与测试本体无恙） |
| N-O2 | 红面边界与 SA6 §12.4 预测略有出入：实测红 = 10（含 C9/C11），预测 C9/C11 在 HEAD 绿。差异源于 C9/C11 的实现版内嵌终止前置屏障（`waitForWatchEnd`），与 SA6 §12.2 自身对 C9 的「终止前置条件红」标注一致；首因仍统一为「watch-end 缺席」，无弱化、无误归因 | 无需动作（SA3 V1 已如实记录红名单）；建议 T4/T5 轮回写 SA6 §12.4 措辞 |
| N-O3 | 覆盖缺口（均非 SA6 契约义务）：① 多订阅同刻终止无多 sink 用例；② peer 路径滞留 data FIFO 无专用用例（C8 只覆盖本地路径，契约配方如此）；③ watch-end 投递的 listener throw 隔离未直接断言；④ `terminateAll` 连续两次幂等无直接断言。实现结构上均已覆盖（快照迭代 / 同槽 FIFO / 同泵 X1 / 集合摘除） | 建议作为后续票（T4 #390 或契约加固轮）的候选锚点，登记 §11 动态验证项 |
| N-O4 | `closeAfterFenceReset` 在 `closePromise` 已置位时早退（不跑 fanout/watch 终止）——runtime seam 层「公共 close 抢先」排序（phase5 T2 用例 1 锁定 `startP === closeP`）下不产出 doc-replaced；registry 可达排序中该窗口恒零活订阅（SA2 S-4 结构性核验：idle/delete/shutdown 门与 carrier 串行） | 无需动作（设计 D5-c 明文语义）；残余风险已入 §11 末行动态验证 |
| N-O5 | fixture 的 `runtimeRef` 观测位经 `runtimeFactory` 测试 seam（C11 键集断言的 runtime 读数）——#387/#369 逐字先例、SA6 §12.4/SA8 行 7 认可的非新 seam；测试断言本体仍仅消费 lease/registry 公共面 | 无需动作（先例一致） |

---

## 收尾核对

- 本报告为 `wiki/raw/task_issue-389_sa4_review.md` 首次落盘（此前不存在，本轮创建）。
- 未修改任何实现/设计/测试文件；唯一可写产物 = 本报告。
- 未运行测试/服务；唯一主动命令 = 只读 git/grep + 一次静态编译检查（`tsc --noEmit`，
  exit 0）。
- requiresConflictRecheck：不提交（未发现新 ADR 冲突风险；SA8 实现后门已闭合为 false，
  其承重主张经本轮独立复核成立）。
