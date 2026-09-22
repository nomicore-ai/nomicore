# 实现设计 — issue #437：lease 端到端数组逐元素校验行为钉死（ADR 0033）

- 角色：SA1（iteration 0；无 SA2 评审输入，无既有设计待修订）
- 任务类型：**feature（测试立法）** —— 只新增测试/fixture/证据，**生产实现零改动**
- 上游：`wiki/raw/task_issue-437.md`（AC1–AC6）、`wiki/raw/task_issue-437_sa6_contract.md`（approve；
  HEAD `02c7cfb` 契约 20/20 绿、旧实现基线 `7407ce0` 判别组 6 红/14 绿、探针 32/32）
- 交付基线：SA6 已在 worktree 落位冻结三件套（md5 已复核一致，见 §7.6）；
  实现阶段职责 = 采纳/守约/跑门禁，而非重写

---

## 1. 任务类型、目标与非目标

### 1.1 目标

ADR 0033 的语义已随 #435（vfsl 逐元素接缝 `applyElementwiseArrayMutation`）与
#436（doc-runtime fast path 接线）落地，但**最高 seam（lease `mutateData`）零回归锚**
（SA6 §5.1 census：lease(registry) 面 array-* 覆盖 0 件）。本票把 ADR 0033 的
用户可见行为变化与不变量在 lease seam 立法成端到端回归测试，使后续演进（把非 union
数组写退回全量边界、改 issue 路径/域规则、改 union 分流、改诊断 carrier 形态、破坏
复制增量）在任何现有红灯上显形。

### 1.2 非目标

- 不改任何生产实现：`packages/*/src/**`、`apps/**`、`domains/**`、构建/测试配置零改动
  （issue 正文「本 ticket 不改实现」；ADR 0033 状态行：复制协议、诊断捕获、
  namespace-runtime 写槽零改动）。
- 不重复 #435/#436 已立法的面：vfsl 接缝一致性 fixture（ADR 0033 决策 5）、
  doc-runtime 双轨/E201/S9 面（决策 3）保持不动，本票不另造其等价物。
- 不做线级（ws transport / wire-frame）复制烟测（ADR 0033 明文协议零改动；
  SA6 §15 残余 1，如需另开票）。
- 不做并发/多写者竞争、大 n（n≥512）性能基准（#436 doc-runtime 面承担，ADR 决策 6）。

## 2. 当前行为与证据锚点（HEAD `02c7cfb`）

写链（全为生产代码，测试只经最上层入口观察）：

| 环节 | 锚点 | 事实 |
|---|---|---|
| lease seam | `packages/namespace-registry/src/lease.ts:392-394` | `mutateData(mutation)` 原样透传 `entry.runtime.mutateData(mutation)`；`readData` 同为透传（`:330-331`）——lease 是用户可见判别联合的最终形状 |
| runtime 写槽 | `packages/namespace-runtime/src/write.ts:187` | `applyValidatedMutation(tools.derived, env.doc, snap.value)` 是唯一 Y.Doc 写入口，在 sequencer 槽内、`await` 快照之后执行（⇒ 读计数包装必须覆盖整个 `mutateData` promise 窗口，见 §7.4）；诊断捕获窗口 `doc.on('update')` 同槽订阅（`:177-207`） |
| 信封形状门 | `packages/doc-runtime/src/mutation.ts:245-258,649,654` | 批量信封（`ops` 非空数组、双形态互斥、路径嵌套）、`array-insert values 必须是非空数组`、`array-delete count 必须是严格正整数` —— 空载荷在此被拒（先于域规则） |
| ADR 0033 闸门 | `packages/doc-runtime/src/mutation-local.ts:314-374`（`case 'array'`） | 双条件合取 `plan.node.kind === 'array' && resolve(boundaryNode).kind === 'array'` → fast path（F1 载体 O(1) → F2 live `length` O(1)（属性读，不经 get/toArray/forEach）→ F3 `applyElementwiseArrayMutation` 域规则/逐新值 O(k) → F4 `buildDetachedValue` O(k) → F5 `install-facts` 收窄验证）；否则 legacy 全量边界 walk（union 数组目标 / 两树分歧） |
| vfsl 接缝 | `packages/vfsl/src/index.ts:139`、`packages/vfsl/src/validate-patch.ts:1079` | `applyElementwiseArrayMutation`（#435 交付）；越界域 message 同源（`validate-patch.ts:994,1004,1113,1132`） |
| 域规则 message | `packages/doc-runtime/src/mutation.ts:820,829` | `array-insert index 越界（不 clamp）`、`array-delete 范围越界（不 clamp、不接受越界 no-op）` |
| union 仲裁 message | `packages/vfsl/src/validate.ts:529`（`联合成员 ${winner+1}/${N}：`）+ `:203/243`（`类型不匹配：期望 number，实际 …`） | C1 逐字判决的源文本 |
| 污染注入面 | `packages/namespace-runtime/src/replication-session.ts:491+`（`applyRemoteUpdate`） | A2 只做形状/陷阱安全拷贝接纳——trusted raw 面，零 VFSL 预校验（ADR 0010 哲学）；ROOT 载体摘要检查照旧放行 |
| session 协议面 | `packages/namespace-runtime/src/replication-session.ts:166-169` | `encodeStateVector/encodeDiff/subscribeOwnedUpdates/applyRemoteUpdate`；`localRole`/`remoteInstanceId`/`direction` 派生冻结（`:424-428`） |
| 诊断公共面 | `packages/namespace-diagnostic-log/src/index.ts` | `createBoundedMemoryDiagnosticLog`、`AttemptRecord`、`UpdateCarrier`（inline carrier：`base64/crc32c/format/payloadLength/storage`） |
| Registry testing seam | `packages/namespace-registry/src/testing.ts:86,126` | `createRegistryTestScheduler`、`createNamespaceRegistryForTesting`（受控 clock/scheduler/randomBytes/role/diagnosticLog 注入） |
| 发现面 | `vitest.config.ts`（`include: ['packages/*/test/**/*.test.ts', …]`）；`tsconfig.typecheck.json`（含 `packages/*/test/**/*.ts`）；`packages/namespace-registry/tsconfig.json`（只含 `src/**`） | 两测试文件被根 `pnpm test` 真实收集；fixture 非 `.test.ts` 不入测试发现面；测试源类型检查走宽 typecheck |

既有测试布局（不可动）：`packages/vfsl/test/issue-435-elementwise-array-*`（接缝立法 +
B6 恒等 accept noop）、`packages/doc-runtime/test/issue-436-array-fastpath-*`（双轨/零写入/
S9 面）。lease(registry) 面此前 array-* 覆盖 0 件（SA6 §5.1）。

## 3. 能力缺口（Feature 面，非 Bug 根因）

- 症状：ADR 0033 的用户可见行为（污染数组写照常成功、O(k) 解耦、issue 路径、诊断/
  复制形态）在最高 seam 无任何回归锚；语义漂移不会在任何现有红灯上显形。
- 直接缺口点：#435/#436 的立法分别止于 vfsl 接缝与 doc-runtime `applyValidatedMutation`；
  lease/registry seam（含真实 Registry 装配、复制会话、诊断绑定）零覆盖。
- 目标行为已实现（probe P1–P5 32/32；HEAD 契约 20/20 绿）——本票缺的是**立法**，不是修复。
- 敏感性与方向判别已证：同一夹具/同一污染/同一 op 在旧实现 `7407ce0`（pre-#436）聚焦
  6 红（AC1-a..e + AC2-d；红因逐字 = legacy 全量边界拒绝 + O(n) 读计数 127>8）/
  14 绿（不变量 + 负控），稳定 3 轮；HEAD 稳定 5 轮 20/20 绿。

## 4. Owner 要求落实

维护者 REST issue-comment read 返回 `[]` —— **无 owner comment 需求面**。唯一需求面 =
issue 正文 AC1–AC6 + Parent PR #434 + Blocked by #436（已合，HEAD 含 `f61e583`）。

| 来源 | 要求 | 设计落实位置 |
|---|---|---|
| issue AC1 | 污染数组 array-delete 照常成功；触达面外非法数据不被普通写发现 | §7.2 契约 AC1-a..e（判别组） |
| issue AC2 | 非法新元素零写入 + issue 路径 `[...arrayPath, index+j]` 不变；越界拒绝不变；空批量 noop 不变 | §7.2 AC2-a..d + 负控 C4/C5；「空批量」措辞歧义定案见 §7.5 |
| issue AC3 | union 数组目标端到端行为与性能路径不变（仍全量边界校验） | §7.2 负控 C1–C3 + C7 + AC2-d legacy 对照腿 |
| issue AC4 | 诊断烟测：committed update bytes 记录形态不变 | §7.2 AC4-a/b |
| issue AC5 | 复制烟测：fast path 提交经 replication apply 对端收敛、无协议面变化 | §7.2 AC5-a/b + 负控 C6 |
| issue AC6 | 根 `pnpm typecheck` 与 `pnpm test` 绿 | §9 验证映射 |
| issue 正文 | 不改实现、最高 seam 立法 | §1.2 非目标 + §10 文件范围 DENY LIST |

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| lease(registry) 面 array-* 覆盖 0 件 | §5.1 census（`artifacts/sa6-issue437-coverage-census.log`）+ probe G1 | 本设计把该面定为立法落点（§7.1） |
| 目标行为在 lease seam 已可达（`ok:true`、污染保留、恰一 owned update、issue 路径、越界逐字、空载荷形状拒绝、诊断/复制形态、读计数 fast=0/legacy=191） | probe P1–P5（`artifacts/sa6-issue437-probe.log`，exit 0） | 契约断言集合即这些事实的冻结（§7.2） |
| 旧实现 `7407ce0` 判别组 6 红/14 绿、红集稳定（md5 `762f1f30…`） | `artifacts/sa6-issue437-baseline-{focused,stability-1..3}.log` | 判别组 = AC1-a..e + AC2-d；设计保留其敏感性论证（§7.3） |
| HEAD 20/20 绿稳定 5 轮；根 gates 绿 | `artifacts/sa6-issue437-head-*.log`、`sa6-issue437-post-*.log` | 实现阶段复跑门禁即验收（§9） |
| 冻结指纹：契约 `62de8c31…`、负控 `34f50039…`、夹具 `9fa5995f…`、探针 `3b647b42…` | §16 清单 | 本设计已在 worktree 复核四件 md5 全部一致（§7.6）；作为采纳基线 |
| 污染只经 `session.applyRemoteUpdate`（非直写 doc）；fixture doc 引用仅基态/oracle | 契约 §12.4；fixture `applyRawRemote` | 装置纪律立法（§7.7） |

上游事实与源码无矛盾（§2 锚点逐一对上）。

## 6. SA8 约束落实

#437 无 SA8 工件（`_relevant_decisions.md` / `_conflict_report.md` 不存在，iteration 0
确认）。替代规范约束面：

| 约束源 | 设计位置 | 处理方式 | 需设计后冲突复查 |
|---|---|---|---|
| ADR 0033 决策 1（闸门/永久双轨） | §7.2 AC1-a..e + 负控 C1–C3 | 只立法、不改闸门 | 否 |
| ADR 0033 决策 2（O(k)/零写入/issue 路径/commit 形态不变） | §7.2 AC2-a..d、AC4-b | 域 message/path 逐字冻结为兼容契约 | 否 |
| ADR 0033 决策 4（触达面收窄：污染 delete 转成功） | §7.2 AC1 判别组 | 行为变化钉正 | 否 |
| ADR 0033 决策 5（逐元素一致性 fixture） | 不触碰 | #435 已交付，本票不重复 | 否 |
| ADR 0033 决策 6（性能软验收） | §7.4 结构性读计数代理 | 机器无关计数，不钉毫秒 | 否 |
| ADR 0033 状态行（协议/诊断/写槽零改动） | §1.2、§10 DENY LIST | 测试-only | 否 |
| 仓库测试纪律（零 skip/only/todo、零 env override、零源码字符串断言、真实入口发现） | §7.7 | 三件套已符合；实现阶段守约 | 否 |
| `packages/namespace-registry/AGENTS.md`（公共入口、testing seam、根 gates） | §7.1、§9 | 夹具只用公共 API + `/testing` 导出 | 否 |
| `docs/AGENTS.md`（wiki/raw 为证据面） | 本文件落位 `wiki/raw/` 固定路径 | 惯例一致 | 否 |

本设计不修订任何既有决策（只执行 ADR 0033 自带的「钉回归测试」要求），不需要
SA8 冲突复查（详见 §13）。

## 7. 设计决策与主要备选方案

### 7.1 最高 seam 选择：lease `mutateData`/`readData`（Registry testing seam 装配）

**决策**：测试唯一观察入口 = `lease.mutateData(envelope)` / `lease.readData(path)`，
装配走真实 Registry testing seam（`createNamespaceRegistryForTesting` +
`createRegistryTestScheduler` + 固定 clock + 计数 randomBytes）→ 生产 Runtime →
`registry.open` → `lease`。污染注入唯一经
`lease.openReplicationSession(...)` + `session.applyRemoteUpdate(raw Yjs update)`
（trusted raw 面）；诊断经 `createBoundedMemoryDiagnosticLog` 公共面绑定。

**理由**：
1. issue 正文指定「经 lease `mutateData` 的端到端测试」——lease 是用户可见判别联合
   （`{ok:true}` / `{ok:false, issues}`）的最终形状面（`lease.ts:392-394` 透传）；
2. 该 seam 传递性覆盖完整生产链：信封形状门 → 规划 → ADR 0033 闸门 → vfsl 接缝 →
   Yjs 单事务提交 → S6/S7 槽收口 → 诊断捕获窗口 → 复制 owned-update 扇出——
   任何一环漂移都在此显形；
3. registry 包测试面同时是诊断绑定与复制会话的**装配**面（AGENTS.md：registry 是
   runtime/lease/session 的 host 级 owner）——AC4/AC5 只在此 seam 可端到端观察。

**备选方案（未选，理由）**：
- doc-runtime `applyValidatedMutation` seam：#436 已立法；无 Registry 装配/lease 信封/
  会话/诊断绑定面，观察不到「用户可见」行为；
- namespace-runtime 内部 seam：低于 lease，丢 lease 透传与 registry 编排（open/session
  生命周期），且需 internal import；
- ws-replication / `apps/yjs-server` 线级烟测：ADR 0033 明文协议零改动；协议承载物
  （owned update 字节）在 session 面即可观察（SA6 §15 残余 1 的边界与此一致）。

### 7.2 测试矩阵与文件边界（冻结结构）

三件套位于 `packages/namespace-registry/test/`（真实发现面 glob
`packages/*/test/**/*.test.ts`；fixture 非 `.test.ts`，零 vitest 依赖，供两侧与探针消费）：

**`issue-437-lease-array-e2e-contract.test.ts`（13 tests）**：

| 组 | test | 断言要点 | 旧实现 |
|---|---|---|---|
| AC1 行为变化（判别组） | AC1-a | 值污染（`items[0]='oops'` 经 raw apply）后 `array-delete` → `{ok:true}`、污染保留 `['oops',1,3,4,5]`、恰一 owned update | **红** |
| | AC1-b | 值污染不阻断 `array-insert`（合法新值过、污染零读取零修复） | **红** |
| | AC1-c | 元素载体非法（`rows` 含裸 number）+ delete → `{ok:true}` | **红** |
| | AC1-d | 元素字段值非法（`qty:'x'` Y.Map）+ delete → `{ok:true}` | **红** |
| | AC1-e | 批量信封 `{ops:[array-delete]}` 内同样分流 `{ok:true}` | **红** |
| AC2 不变量 | AC2-a | 非法新元素整笔零写入 + issue 路径 `[items,2]/[items,3]`（index+j）+ 嵌套 `[rows,1,'qty']` + 零 update | 绿 |
| | AC2-b | 越界 delete/insert 逐字 message + path + 零写入零 update | 绿 |
| | AC2-c | 空载荷（`values:[]`/`count:0`）与空批量（`{ops:[]}`）信封形状门拒绝（同码同 path）+ 零写入 | 绿 |
| | AC2-d | fast 轨元素读计数 ≤8 且 union legacy 轨 ≥n（n=64；判别组） | **红**（127>8） |
| AC4 诊断烟测 | AC4-a | `root-mutation`/`transaction`/`committed effect:update` + inline carrier 键集（`base64,crc32c,format,payloadLength,storage`）+ 同基态重放收敛 + 空 doc 不物化 ROOT | 绿 |
| | AC4-b | 数组写 vs 标量 set 写 record/carrier 键集逐键同构 | 绿 |
| AC5 复制烟测 | AC5-a | hub 写 → owned update → 纯 Y.Doc 同基态重放 + peer `applyRemoteUpdate` 收敛 + diff 定点 + session 状态面（`open`/`hub-to-peer`/`localRole`/`remoteInstanceId`） | 绿 |
| | AC5-b | owned update 对空 doc 不物化（最小增量）+ 每提交恰一事件 + 二次写再恰一 | 绿 |

**`issue-437-lease-array-e2e-control.test.ts`（7 tests，旧新同绿）**：
C1 union 污染照旧响亮拒绝（逐字 `联合成员 1/2：类型不匹配：期望 number，实际 boolean`
+ path `['uarr',0]` + 零写入零 update）；C2 union 干净写 ok；C3 union 非法新值 issue
path `['uarr',1]`；C4 域规则（`index===length` append、`index+count===length` delete
不 clamp，两轨）；C5 干净写恰一提交；C6 批量信封单事务单事件；C7 union legacy 读计数
∝n（≥64）。

**`issue-437-lease-array-e2e-fixture.ts`（共享装置，非测试入口）** 边界：
- 数据设计：`SCHEMA_437` 四形状——`items: YArray<number>`（fast 目标）、
  `rows: YArray<{qty,tag}>`（载体/字段污染面）、`uarr: YArray<number>|YArray<string>`
  （union 永久 legacy 轨）、`n: number`（诊断标量对照）；
- 装置面：doc 构建（固定 `HUB_CLIENT_ID=4242`、`SCHEMA/META/ROOT` 三 map）、最小
  persistence stub（`createDoc/loadDoc/saveDoc/importDoc`——`registry.importReplica`
  唯一必需能力）、计数 randomBytes（只服务 128-bit 请求）、固定 clock、
  `createNamespaceRegistryForTesting` 装配（可选 diagnosticLog 绑定：emitter +
  per-namespace `runtimeEmitterFor`）、`registry.open` + schema-ready 沉降、
  `enableReplication` + `openReplicationSession` + ownedUpdates 捕获、
  `openPeerFixture`（hub 快照 + `importReplica` bootstrap 的 peer）；
- 助手面：`readValue/readArray`（只经 `lease.readData`）、`rootArray`（**仅测试装置**
  的 doc 导航 oracle——ROOT 内数组必须经 `doc.getMap('ROOT').get(key)`）、
  `applyRawRemote`（污染注入：对端固定 `REMOTE_CLIENT_ID`、以 live doc 当刻状态为基态
  求增量、经 `session.applyRemoteUpdate`）、`countElementReadsAsync`（§7.4）、
  `settleUntil`（有界 `setImmediate` 轮）、诊断助手（`waitForAttemptRecords`/
  `rootMutationRecord`/`updateCarrierOf`/`carrierBytes`）。

**AC → 组映射**：AC1→AC1-a..e；AC2→AC2-a..d + C4/C5；AC3→C1–C3 + C7 + AC2-d legacy 腿；
AC4→AC4-a/b；AC5→AC5-a/b + C6；AC6→根 gates（§9）。

### 7.3 判别组设计（防恒真/防夹具自证）

- **A/B 闸门对照**：同一夹具、同一污染手法、同一 op，仅目标数组声明类型不同——
  非 union `items`（快轨 `ok:true`）vs union `uarr`（legacy 轨 `ok:false` 逐字判决）
  ⇒ AC1 的 `ok:true` 断言对闸门敏感；负控 C1 是同一断言集合的 union 腿。
- **规模对照**：同规模 n=64 单元素 delete，fast 轨读计数 0（≤8 钳制）vs union legacy
  轨 191（≥64 下限）⇒ AC2-d/C7 对 O(k)/O(n) 解耦敏感。
- **独立通道**：探针（tsx，非 vitest）复核同一 A/B（P1e/P1f/P5a/P5b），排除 vitest
  夹具自证。
- **旧实现基线**：`7407ce0`（#435 已合、#436 未合——恰为「ADR 0033 行为变化在 lease
  seam 尚未生效」的实现面；更早提交会把 vfsl 接缝也移除、红因混入）同一命令 6 红
  /14 绿且红集 3 轮稳定 ⇒ 红/绿归因于 #436 接线，非环境/夹具/入口。
- **污染真实性**：写前 `readData` 断言污染在场（AC1 各前置）；union 腿同污染被拒 ⇒
  污染确实在 live doc。

### 7.4 性能路径的结构性代理（AC2-d/C7；AC3 性能腿）

不钉毫秒（ADR 决策 6「软验收」；机器相关阈值被仓库纪律排除）。代理 = **live 元素读
计数**：包装目标 `Y.Array` 实例的 `get`（+1/次）、`toArray`/`forEach`（+length/次），
计数窗口覆盖整个 `mutateData` await 窗口——因为域判定在 sequencer 槽内、`await` 之后
执行（`write.ts:187`），窄窗口会漏计。`finally` 中 `delete` 包装（prototype 方法复位，
零残留）。fast 轨阈 ≤8（k=1 的小常数余量；F2 用 `length` 属性读、不经被计数的三个
方法，HEAD 实测 0）；legacy 轨阈 ≥n。两阈均与机器无关、与 n 解耦/耦合的方向即断言。

### 7.5 「空批量 noop」措辞定案（issue AC2 歧义）

lease seam 可观察事实：空载荷（`values: []` / `count: 0`）与空批量（`{ops: []}`）在
**信封形状门**被拒（`mutation.ts:245-258,649,654`），旧新同码同 path、零写入零 update。
「恒等 accept 的 noop」是 vfsl 接缝性质，已由 #435 B6
（`packages/vfsl/test/issue-435-elementwise-array-contract.test.ts:167`）钉死。本票按
**lease seam 可观察行为**立法：AC2-c 钉「空载荷判决不变（形状拒绝 + 零写入零 update）」。
该定案与 Owner 无冲突（无 owner comment 面；AC 措辞歧义已在 SA6 契约 §2 显式记录）。

### 7.6 采纳基线与变更政策（实现阶段的职责边界）

SA6 冻结三件套 + 探针已落位 worktree（untracked）；本设计复核四件 md5 与契约 §16
完全一致（`62de8c31…`/`34f50039…`/`9fa5995f…`/`3b647b42…`）。实现阶段（SA3）职责：

1. **原样采纳**冻结三件套为实现交付物；不改写、不重排、不软化断言；
2. 跑 §9 全部门禁并落证据日志（`artifacts/` 惯例命名）；
3. 任何对三件套的修改**只允许**来自评审 finding 的逐条落实，且必须：保持 §7.2 矩阵
   覆盖不缩水、保持判别组敏感性（§7.3）、保持装置纪律（§7.7），并重新冻结 md5
   记录于实现 notes；
4. 若聚焦套件在实现阶段出现红灯：那是**生产回归信号**（HEAD 已 20/20 绿），上报
   Controller 路由，不得为绿而改测试或改生产代码。

### 7.7 装置纪律（契约纪律的立法边界）

- 断言只观察运行时行为：lease 判别联合、issue message/path、`readData` 逻辑值、
  owned update 字节与收敛、诊断 record/carrier、session 状态面；**零源码字符串断言**；
- 期望值来源：现行实现冻结常量（域 message/path、union 仲裁 message、carrier 键集）
  或机制性 oracle（同基态重放、空 doc 不物化、peer apply/diff 定点、A/B 对照）；
- 污染注入统一经 replication apply（trusted raw seam）；fixture 的 `doc` 引用只用于
  构造对端基态与字节 oracle，绝不断言 live 值（live 值只经 `lease.readData`）；
- 远端污染一律**插入新元素**（不写既有键/元素）——避免并发项按 clientID 决胜的
  不确定合并；clientID 全固定（hub/peer/remote）；
- 零随机源、零真实时钟、零 `setTimeout` 竞猜（有界 `setImmediate` 轮沉降）；
- 零 skip/only/todo、零 env 分支、零测试侧 try/catch 吞错；
- fixture 零 vitest 依赖（本地 `assert` + 沉降），探针与两侧测试共用同一装置 ⇒
  探针是独立验证通道而非复制粘贴；
- 诊断包引用走相对源路径 `../../namespace-diagnostic-log/src/index.js`——registry 测试
  面的既有惯例（`registry-create-diagnostic-red.test.ts:95`、
  `issue-393-ndcl-self-binding-red.test.ts:59` 等；依赖层 registry 不依赖
  diagnostic-log 包名），且引用的是该包**公共 index**，非内部 subpath。

## 8. 接口、状态机与数据流

**无生产接口/状态机/数据流变化**（测试-only）。设计改变的是**观察面**：新增三条
测试时数据流路线（全部只读观察 + 显式注入）：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| L1 污染注入 | `applyRawRemote(session, liveDoc, mutate)`：对端 doc（固定 clientID）以 live 基态求增量 | 对端 doc 内存构造，mutate 只 insert 新元素 | 增量 = `Y.encodeStateAsUpdate(remote, sv(liveDoc))` | `session.applyRemoteUpdate(diff)`（trusted raw，A2 形状门） | live doc 经 Yjs 合并 | `readData` 可见污染（写前断言） | `applied.ok` 断言；fixture 生命周期随 registry 关闭 | AC1-a..e/C1 前置 |
| L2 lease 写 | `lease.mutateData(envelope)`（单 op / 批量 ops） | sequencer 槽 `applyValidatedMutation` 单事务（唯一 Y.Doc 写入口） | 信封形状门 → 闸门分流（fast/legacy）→ 零写入纪律（拒绝先于写） | Yjs 最小区间 edit；事务 update 事件 → 诊断 carrier；owned update 扇出 | `lease.readData` 逻辑值；`log.records()`；`subscribeOwnedUpdates` | `{ok:true}`/`{ok:false,issues}` + 逻辑值 + 恰一 record/update | 拒绝零写入零 update（ownedUpdates.length 断言）；fatal 面不触发 | 全部 AC/C |
| L3 对端收敛 | hub owned update bytes | — | ①纯 Y.Doc 同基态重放 ②peer `applyRemoteUpdate` ③`encodeDiff(sv)` 定点 apply | 三通道独立 | peer `readData`；`session.getStatus()` | 三通道同逻辑值 + diff 定点为空增量且值不变 | `applied.ok`/`fixpoint.ok` 断言 | AC5-a/b |

## 9. 验收与验证映射

| 需求或风险 | 现有证据（SA6） | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 行为变化钉正 | 契约 13/13 绿 + 基线 AC1-a..e 红 | 聚焦：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/namespace-registry/test/issue-437-lease-array-e2e-contract.test.ts packages/namespace-registry/test/issue-437-lease-array-e2e-control.test.ts` | 20/20 passed、Type Errors: no errors |
| AC2 不变量（零写入/issue 路径/越界/空载荷/O(k)） | 同上（AC2-a..d；基线仅 AC2-d 红） | 同上 | 同上 |
| AC3 union 双轨不变 | 负控 C1–C3/C7 绿（旧新同绿） | 同上 | 同上 |
| AC4 诊断形态不变 | AC4-a/b 绿 | 同上 | 同上 |
| AC5 复制收敛无协议变化 | AC5-a/b + C6 绿 | 同上 | 同上 |
| 判别敏感性（非恒真） | 探针 32/32 exit 0 + 基线 6 红/14 绿 | 探针复跑：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-437_sa6_capability_probe.mts` | exit 0、`failures=0` |
| AC6 根门禁 | `sa6-issue437-post-typecheck.log`（exit 0）、`sa6-issue437-post-root-test.log`（466 files/5667 tests 全绿） | 根 `pnpm typecheck`；根 `pnpm test`（= `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`） | 双 exit 0；全绿、两新文件被真实收集（各自 13/7 tests 的 run 行） |
| 测试源类型面 | `sa6-issue437-typecheck-tests.log`（`tsc -p tsconfig.typecheck.json --noEmit` exit 0） | 同命令复跑 | exit 0 |
| 生产零改动 | 契约 §16（`git diff` 空） | 实现阶段收尾 `git status/diff` 核对 | `packages/*/src/**`、`apps/**`、`domains/**`、`vitest.config.ts`、`tsconfig*.json`、`package.json` 零 diff |

注：根 `pnpm test` 的文件/用例总数以「全绿 + 两新文件被收集」为判据（绝对计数随并行
合入漂移，不钉死）。

## 10. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `wiki/raw/task_issue-437_design.md` | 本设计（新建） | SA1 固定产物位 |
| `packages/namespace-registry/test/issue-437-lease-array-e2e-contract.test.ts` | 采纳冻结件（已在位；修改仅限评审落实 + 重冻结 md5） | AC1/AC2/AC4/AC5 契约（13 tests） |
| `packages/namespace-registry/test/issue-437-lease-array-e2e-control.test.ts` | 同上 | C1–C7 负控（7 tests） |
| `packages/namespace-registry/test/issue-437-lease-array-e2e-fixture.ts` | 同上 | 共享装置（§7.2 边界） |
| `wiki/raw/task_issue-437_sa6_capability_probe.mts` | 采纳冻结件 | 探针证据通道 |
| `artifacts/sa6-issue437-*.log` | 保留（已在位） | SA6 证据惯例（#436 先例已随 merge 提交同类日志） |
| `artifacts/sa3-issue437-*.log`（实现阶段新增） | 新增证据日志 | 实现阶段门禁证据（沿 #436 `sa3-issue436-*` 命名先例） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/src/**` | ADR 0033 改造面（#436 已交付） | 本票不改实现（issue 正文） |
| `packages/vfsl/src/**`、`packages/vfsl/test/issue-435-*` | 逐元素接缝与一致性 fixture（#435） | 同上；且属 ADR 决策 5 立法面 |
| `packages/namespace-runtime/src/**` | 写槽/会话/诊断管线 | ADR 0033 状态行：写槽零改动 |
| `packages/namespace-registry/src/**` | lease/registry 编排 | 生产面零改动 |
| `packages/namespace-diagnostic-log/src/**` | 诊断捕获 | ADR 0033 状态行：诊断捕获零改动 |
| `packages/doc-runtime/test/issue-436-*` | #436 契约/负控/夹具 | 既有切片立法不动（SA6 §10） |
| `packages/ws-replication/**`、`apps/yjs-server/**`、`packages/replication-protocol/**` | 复制协议面 | ADR 0033 明文协议零改动；线级烟测为票外（§1.2） |
| `docs/adr/**`、`CONTEXT.md`、`docs/protocols/**` | 规范面 | 本票不改任何决策/词汇；无新域词 |
| `vitest.config.ts`、`tsconfig.base.json`、`tsconfig.typecheck.json`、`packages/*/tsconfig.json` | 发现/类型检查配置 | 两测试文件已匹配现有 glob；不为例外改配置 |
| `packages/*/package.json`、`pnpm-lock.yaml` | 依赖面 | 零新依赖（fixture 只用既有 devDep 与相对源引用） |
| `packages/namespace-registry/test/` 下既有非 #437 测试 | 相邻测试面 | 与本票无涉；避免夹具面漂移 |

## 11. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| 生产调用方（一切经 lease 的业务写/读、复制对端、诊断消费方） | — | **零变化**（生产零改动） | 无 | `git diff` 空（SA6 §16）；本设计 §10 DENY |
| 根 vitest 发现面 | 收集 `packages/*/test/**/*.test.ts` | 新增收集两文件（13+7 tests） | 无配置改动 | `vitest.config.ts` include；SA6 §14 实测 L377/L646 |
| 宽 typecheck（`tsconfig.typecheck.json`） | 含 `packages/*/test/**/*.ts` | 新增三文件入类型检查 | 无 | SA6 §13 `WIDE_TSC_EXIT:0` |
| 探针（`task_issue-437_sa6_capability_probe.mts`） | — | 消费 fixture（`.ts` 直引，tsx 运行） | 无 | 探针 import 列表 |
| 未来演进（改闸门/域规则/诊断 carrier/复制增量者） | 无红灯显形 | 判别组或不变量组红灯 | 这是本票目的 | 基线 6 红/14 绿的实测可显形性 |

## 12. 风险、回滚与残余问题

| 风险 | 评估 | 缓解/回滚 |
|---|---|---|
| 逐字 message 断言脆（域文案演进即红） | **有意为之**：ADR 0033 决策 2 把 issue 路径/顺序定为兼容行为；message 文案同源冻结（`mutation.ts`/`validate.ts`） | 红灯即契约变化信号 → 走决策修订（ADR），不走静默改断言 |
| 读计数包装残留/污染其他用例 | 低：`finally` 删除实例包装（非 prototype 替换）；作用域限单数组实例单 await 窗口 | fixture 注释明示；稳定性 5 轮实测 |
| 判别组在未来重构中变恒真/恒绿 | 中：闸门若被移除，AC1 断言与负控 C1 同化 | A/B 双腿 + 探针独立通道 + （必要时）基线 worktree 复跑判别（SA6 已留方法学） |
| 根 `pnpm test` 计数漂移导致误判 | 低 | 验收判据 = 全绿 + 两文件被收集（§9 注），不钉绝对计数 |
| 污染注入被误认为绕过复制 seam | 低 | `applyRemoteUpdate` 单通道 + 写前 `readData` 可见性断言 + union 腿反证（§7.3） |
| 回滚 | 单 commit 撤三件套 + 探针 + 证据即完全回滚（生产面本就零改动） | — |

**残余问题（非本票任务内必要条件，明示为票外）**：线级（ws transport）复制烟测、
并发/多写者数组写竞争、n≥512 性能基准、恒等 accept noop 的 vfsl 面归属（#435 B6 已有）
——与 SA6 §15 残余清单一致；如需另开票。

## 13. 是否需要设计后 ADR 冲突复查

**否**。理由：本设计零生产语义变化——不改公共 API/协议/wire/schema/持久化/状态机，
不触碰 ADR 冻结面，不修订任何既有决策；它只把 ADR 0033 已接受的决策 1/2/4（及其
「钉回归测试」的自我要求）在 lease seam 执行成测试。唯一一处措辞定案（§7.5「空批量
noop」按 lease seam 可观察事实立法）不与任何 ADR 或 Owner 输入冲突（无 owner comment
面；vfsl 面归属已由 #435 B6 钉死，两不重叠）。

## 14. 评审修订映射

iteration 0：`wiki/raw/task_issue-437_sa2_review.md` 不存在，无适用 finding。后续评审
输入到达时，逐条落实并在此表记录 Finding → 修订位置映射。
