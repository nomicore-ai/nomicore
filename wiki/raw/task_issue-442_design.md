# 任务 issue #442 设计 — lease `mutateData` 端到端 Record/parent 逐 entry 校验行为钉死（ADR 0034）

- 任务 slug：`issue-442`；迭代 0（本设计为首版，无既有 `task_issue-442_design.md` 需原位修订）
- 任务类型：**feature**（能力缺口 = **验证覆盖面缺口**）——Issue 正文明示「本 ticket 不改实现，只把新语义
  在最高 seam 上立法成回归测试」
- 上游输入（均已读取）：
  - 任务简报：`wiki/raw/task_issue-442.md`（Issue #442 正文 + AC1–AC7 + Blocked by #441；Comments 空）
  - **SA6 验收契约（approve）**：`wiki/raw/task_issue-442_sa6_contract.md`
  - SA6 能力探针（可执行证据）：`wiki/raw/task_issue-442_sa6_capability_probe.mts`
  - SA6 证据日志：`artifacts/sa6-issue442-*.log`（probe-head 7 轮、probe-baseline 4 轮、coverage-census、
    pre-typecheck、pre-test、head-focused-441-437）
  - 母法：`docs/adr/0034-record-and-parent-elementwise-validation.md`
  - 同构先例：`docs/adr/0033-elementwise-yarray-mutation-validation.md`、
    `packages/namespace-registry/test/issue-437-lease-array-e2e-{fixture,contract,control}.ts`
  - 前序立法面：`packages/doc-runtime/test/issue-441-record-fastpath-{contract,control,fixture}.ts`、
    `wiki/raw/task_issue-441_sa6_contract.md`
- 缺失输入（iteration 0，`ls wiki/raw` 核对）：`task_issue-442_relevant_decisions.md`、
  `task_issue-442_conflict_report.md`、`task_issue-442_sa2_review.md`、既有 #442 测试——均不存在；
  替代约束面见 §6（直读 ADR 0034/0033 与 `CONTEXT.md` 逐 entry 例外 / 触达面收窄词条）
- 修订基线：HEAD `c42fb47`（含 #441 `61778bc`）；判别基线 `3fd6aa8`（pre-#441）。
  `git diff --stat 3fd6aa8 HEAD -- packages/` 恰为 `doc-runtime/src/mutation-local.ts`（+76/−11）、
  `mutation.ts`（+21/−11）与 #441 三份测试（本会话复核）；`pnpm-lock.yaml`/`package.json`/
  `vitest.config.ts` 两修订逐字节相同

---

## 1. 任务类型、目标与非目标

**目标**：在**最高 seam**（真实 Registry testing seam → 生产 Runtime 装配 → `registry.open` →
`lease.mutateData` / `lease.readData`）新增 3 个测试文件（共享 fixture + 契约测试 + 负控测试），把
ADR 0034（经 #441 落地）带来的用户可见行为变化与不变量立法成端到端回归测试，覆盖简报 AC1–AC6；
AC7 = 根 gates 保持绿。

**非目标**（Issue 正文 + ADR 0034「不做什么」+ SA6 §10/§11 共同划定）：

- 不改任何生产实现（`packages/**/src/**` 零改动；本设计 ALLOW LIST 不含任何 `src` 路径）
- 不在 lease seam 重复立法 #441 已锚的 doc-runtime 内部面：S9 安装事实核（`VerifyPlan.install-facts`）、
  E201-C 触达面内同事务 observer 篡改、`DocRuntimeFatalError` 面、commit 字节与手写最小 edit 的逐字节等价
  （#441 NB/NC/ND 组已锚；lease seam 无法区分重投影核，SA6 §11 已裁定排除）
- 不重复立法 #440 vfsl 逐 entry 接缝面（`issue-440-elementwise-entry-*`）
- 不立法 union 穿越位（#441 fixture 的 `umem` 形态）——union 穿越是 kind=`union` 计划，与 union map 位
  同走 legacy，#441 NA4 已锚；本票 schema 不引入该形态
- 不为 raw-replication 污染补异步/抽样审计机制（ADR 0034 决策 4 明文不建）
- 不钉毫秒级性能阈值（ADR 0034 决策 6 软验收；只用机器无关结构性读计数）

## 2. 当前行为与证据锚点

### 2.1 实现面（HEAD，#441 已合入）

| 事实 | 锚点 |
|---|---|
| record/parent 计划按双条件闸门分流：`plan.node.kind==='object' ∧ resolve(boundaryNode).kind==='map'` → fast path；否则（union map 位 / union 穿越 / 两树分歧）→ legacy 全量边界路径（代码与 `3fd6aa8` 逐字一致） | `packages/doc-runtime/src/mutation-local.ts:285-305`（闸门注释与条件）、`:344-381`（legacy 分支） |
| fast path 五步：F1 载体 O(1)（错位即 `Yjs 载体错位（ROOT）：期望 Y.Map，实际 plain value`、path `[]`）→ F2 `has(key)` 在场性 O(1) → F3 接缝 `applyElementwiseEntryMutation`（set = 键 Pattern + 新值 schema、delete 不查键 Pattern、旧值不读）→ F4 detached 构造 O(新值) → F5 `verify:{kind:'install-facts'}` | `mutation-local.ts:306-342` |
| Record **值位** union 不参与闸门（entry 整值替换）；union **map 位**在规划层冻结 kind=`union` 进不了 fast 分支 | `mutation-local.ts:293-296` |
| 写信封形态：单操作 `{op:'set'|'delete'|'array-insert'|'array-delete', path, …}` 或批量 `{ops:[…]}`（ADR 0026 互斥） | `packages/doc-runtime/src/mutation.ts:69-104`（`ValidatedMutation`/`GuardedMutation`/`BatchedMutation`/`MutationEnvelope`） |
| lease 透传：`mutateData(mutation) → entry.runtime.mutateData(mutation)`（released 检查后）；`readData` 双重载原样透传；session 公共面 `encodeStateVector`/`encodeDiff`/`subscribeOwnedUpdates`/`applyRemoteUpdate`/`getStatus` 经 core | `packages/namespace-registry/src/lease.ts:392-394`、`:312-337`、`:294-305` |
| Registry testing seam：`createNamespaceRegistryForTesting(persistence, { clock, scheduler, randomBytes, role, diagnosticLog })`；`createRegistryTestScheduler` | `packages/namespace-registry/src/testing.ts:86`、`:126` |
| 诊断绑定形态：`createBoundedMemoryDiagnosticLog({ inputPolicy:'digest', issuesPolicy:'full', updateCapture:true })` + `diagnosticLog:{ emitter, runtimeEmitterFor }` | #437 fixture `issue-437-lease-array-e2e-fixture.ts:281-299`（生产形状 binding 先例）；`packages/namespace-diagnostic-log/src/index.ts`（公共面） |

### 2.2 运行时行为事实（SA6 探针 HEAD 实测，7 轮 31/31 稳定）

见 §7.3/§7.4 用例表「冻结值」列（全部来自 `artifacts/sa6-issue442-probe-head.log` 的
`EVIDENCE` 行与 `wiki/raw/task_issue-442_sa6_contract.md` §5.2，非源码抄写）。关键锚：
A8 静态判别 `缺少必填字段 "req"` @ `['obj','req']`；B1–B8 域规则逐字 message/path；U3 fast 轨
`valueReads=1`（n=64）/ union legacy `514`（∝ n）；E1/E2 carrier 键集
`[base64,crc32c,format,payloadLength,storage]`、record 键集 10 键同构；R1–R3 收敛与最小增量。

### 2.3 覆盖缺口（Feature 根因）

`packages/namespace-registry/test/` 无任何 `issue-442-*` 文件；既有 `mutateData` 用例载荷分布
`set` 156 / `delete` 9 / `array-insert` 13 / `array-delete` 17，**无 Record/parent 的 raw 污染判别
用例**（SA6 §5.1 覆盖普查，`artifacts/sa6-issue442-coverage-census.log`）。ADR 0034 语义立法面止于
vfsl（#440 接缝）与 doc-runtime（#441 接线），均不经过 registry 装配、lease 代理、诊断泵与复制
session 扇出——这些上层行为（信封形状门、批量折迭、update 事件扇出、owned update、诊断 attempt
record）只在 lease seam 可观察。

## 3. 能力缺口（根因链承接）

最深根因 = **最高 seam 缺 3 件套**（共享 fixture + 契约 + 负控）。后果面 = 后续任一演进（Runtime
快照/装配、lease 代理、诊断 emitter、复制写槽）造成 Record/parent 语义漂移时，根 gate 无红灯。
本设计不主张「漂移必然发生」，只主张「发生则当前无锚」（SA6 §8-6 同款不夸张立场）。

## 4. Owner要求落实

维护者 REST issue-comment read 返回 `[]`（Host 明示 `Current owner-comment requirements: none`）；
简报 Comments 段为空。**无 owner 附加要求**，无 Owner-评论映射行可列。唯一需求面 = 简报 AC1–AC7，
逐条映射见 §12 验收表（AC → 契约组 → 用例 ID → 证据）。

## 5. 复现和根因承接（SA6 契约 → 设计响应）

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| SA6 结论 **approve**：能力缺口 = lease 最高 seam 回归覆盖面缺口；HEAD 行为已逐条正确（31/31） | `task_issue-442_sa6_contract.md` 头部、§5.2 | 设计为**纯测试交付**（3 文件），零生产改动；§7.2-7.4 把契约 §12.2/12.3 规格落为可实施 fixture/用例设计 |
| 判别组在旧实现 `3fd6aa8` 按 ADR 0034 取代前的旧语义失败（15 条：A1–A11、U3 fast 半、U4、V3、R3），不变量组两面同绿 | 契约 §5.3、`artifacts/sa6-issue442-probe-baseline*.log`（4 轮 31/31 命中旧语义期望） | 交付测试只断言 HEAD 期望（无 `--baseline` 分支，契约 §14 纪律）；判别性由 SA6 基线证据承载，红面复跑为可选复核（§12 验证命令 4） |
| 交付测试文件与用例规格已冻结：fixture/契约 30/负控 4、schema、绑定面 B-1–B-8 | 契约 §12.1-12.4 | §7.1-7.4 全量承接；「ID 语义、断言集合、判别/不变量分组与冻结值不得改变」在本设计中逐字保留 |
| **计数矛盾（记录，不静默复制）**：契约 §1/§13 称「契约 30 + 负控 4 = 34」并推 `5757→5791`，但其 §12.2/12.3 逐 ID 枚举为 A11+B8+U2+V3+E2+R3 = **29 契约 + 4 负控 = 33**；探针场景为 31（U1/U2 移入负控为 C1/C2、B7 场景在 C4 独立重锚） | 契约 §12.2/§12.3 vs §1/§13 | 以逐 ID 枚举（33）为准：SA6 报告的「34/5791」为其自身算术笔误，非语义差异。落地后根 gate 期望为 **471→473 files、5757→5790 tests**；若实现期实际落盘 its 数不同，以「零 skip/only/todo 且逐 ID 覆盖 §12.3 全表」为验收准绳，不机械对齐笔误数字（§13 风险 R-6） |
| 读计数是结构性代理，存在未覆盖出口逃逸的理论失明 | 契约 §15、§9-E3 | fixture 读计数助手全覆盖 8 种 `Y.Map` 出口（§7.2.4）；成本断言与行为断言成对使用，不单独承担判定（§7.5.3） |
| `obj.deep` 同键覆盖污染依赖固定 clientID 决胜 | 契约 §15、探针 `applyRawRemote` | fixture 冻结 `HUB_CLIENT_ID=4242`/`REMOTE_CLIENT_ID=999999`；污染一律写新键，唯一例外 `obj.deep` 同键覆盖（确定性由 clientID 决胜，§7.2.5） |
| fixture 零 vitest 依赖、污染只经 `session.applyRemoteUpdate`、断言零源码字符串 | 契约 §12.4 | §7.2.1/§9.1 全量承接为硬性实现约束 |

## 6. SA8约束落实（无 SA8 工件；替代约束面）

iteration 0 无 `task_issue-442_relevant_decisions.md` / `_conflict_report.md`。按纪律直读相关 ADR
并标记设计后冲突复查（§14）：

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| ADR 0034 决策 1（Record set/delete 逐 entry fast path + 闸门 + 永久双轨 + 值位 union 不阻断） | §7.3 A1–A11、V1–V3、U3/U4；§7.4 C1–C3 | 立法为行为/成本断言；不触碰实现 | 否（消费既有决策） |
| ADR 0034 决策 2（封闭对象 delete 静态判定；`has` 拒 no-op 不变） | §7.3 A6–A8、B4–B6；§7.4 C4 | 同上 | 否 |
| ADR 0034 决策 3（S9 收窄） | §1 非目标 | **不重复立法**（#441 FC/NB 组已锚；lease seam 不可观察） | **是**（非重复立法边界由本设计划定，SA8 复核边界划分不越权） |
| ADR 0034 决策 4（触达面 = map/父载体 + 目标键位；触达面外污染不阻断不修复） | §7.3 A1–A11；§7.3 B7（触达面内载体位仍响亮拒绝） | 立法为污染保留 + `ok` 位 + 零写入断言 | **是**（对「不修复」的负向断言形态见 §7.5.2） |
| ADR 0034 决策 5（容器合法性 ⟺ 逐 entry 合法；禁止 map 级约束特判） | §7.3 B1–B8 逐字域规则 | 立法为逐字 message/path 冻结 | 否 |
| ADR 0033 同构先例（lease 立法纪律：testing seam、raw 污染、结构性读计数、诊断/复制烟测） | §7.2 全部（#437 fixture 为结构模板） | 复用先例形态，Map 读计数为新移植 | 否 |
| ADR 0010 trusted raw replication 面（污染注入通道合法性） | §7.2.3 `applyRawRemote` | 污染只经 `session.applyRemoteUpdate` | 否 |
| ADR 0011/0014 诊断 best-effort（emit 不改业务结局；`updateCapture` carrier 形态） | §7.3 E1/E2；§8 路线 4 | 只读观察 attempt record/carrier，不 wire 新发射 | 否 |
| `packages/namespace-registry/AGENTS.md`（lease 独立 caller capability；公共 API + explicit testing surface；public-surface guard 须覆盖每个导出） | §7.2.1（fixture 只消费公共面 + `/testing`）；§11（不改 `src/index.ts`，无新公共导出） | 测试文件非导出面，不触发 public-surface guard 变更 | 否 |
| `packages/doc-runtime/AGENTS.md`（公共 API 只经 `src/index.ts`；不暴露 live 可写 ROOT） | §1 非目标 | 本票不改 doc-runtime；fixture 经 lease 面断言，`doc` 引用仅装置面 | 否 |
| 简报 AC7 根 gates | §12 验证命令 2/3 | 落地后复跑 `pnpm typecheck`/`pnpm test` | 否 |

## 7. 设计决策与主要备选方案

### 7.1 交付物形态：3 文件（沿用 #437 三件套先例）

| 产物 | 路径 | 角色 |
|---|---|---|
| 共享 fixture（非测试入口） | `packages/namespace-registry/test/issue-442-lease-record-e2e-fixture.ts` | schema/seed/Registry 装配/污染注入/读取/读计数/诊断/复制助手；**零 vitest 依赖**（vitest 只收集 `*.test.ts`，`vitest.config.ts` include 面不含裸 fixture——SA6 §14 已实证） |
| 契约测试 | `packages/namespace-registry/test/issue-442-lease-record-e2e-contract.test.ts` | 29 its：A1–A11（AC1）、B1–B8（AC2）、U3–U4（AC3）、V1–V3（AC4）、E1–E2（AC5）、R1–R3（AC6） |
| 负控测试 | `packages/namespace-registry/test/issue-442-lease-record-e2e-control.test.ts` | 4 its（恒绿）：C1–C4，独立文件承载 A/B 对照（其失败 = 判别断言失去敏感性） |

**备选（未选）**：全部塞进单文件——被否：负控必须独立于契约文件存在（SA6 §12.4 明文）；单文件
膨胀到 33 its 也弱化「契约/负控失败语义分离」的评审面。**备选（未选）**：把 lease 面断言追加进
#441 doc-runtime 测试——被否：seam 不同（不经 Registry 装配/信封门/诊断泵/复制扇出），且违反
#441 已合面的冻结。

### 7.2 fixture 设计（`issue-442-lease-record-e2e-fixture.ts`）

#### 7.2.1 装配与依赖边界

- 导入面（全部公共）：`yjs`、`@nomicore/persistence`（仅类型 `DocHandle`/`DocPersistence`/`User`）、
  `@nomicore/namespace-registry`（类型 `NamespaceLease`/`NamespaceRegistry`/`RegistryRandomBytes`/
  `ReplicationSession`）+ `@nomicore/namespace-registry/testing`
  （`createNamespaceRegistryForTesting`/`createRegistryTestScheduler`）、
  `../../namespace-diagnostic-log/src/index.js`（`createBoundedMemoryDiagnosticLog` 与类型——沿 #437
  fixture 同款相对源码导入，`@nomicore/namespace-diagnostic-log` 本就是 registry 包依赖，双上下文
  （vitest alias / tsx `--conditions=nomicore-source`）解析一致）
- 零 vitest 导入；本地 `assert(condition, message): asserts condition`；有界 `settleUntil(read, message,
  rounds=400)`（`setImmediate` 轮，零 `setTimeout` 竞猜——#437/探针同款时序纪律）
- Registry 装配：`createNamespaceRegistryForTesting(new LeaseRecordPersistence(seed), { clock:{now:()
  => NOW_MS}, scheduler:createRegistryTestScheduler(), randomBytes:counterRandomBytes(), role,
  diagnosticLog? })` → `registry.open({userId}, NS)` → `waitForSchemaReady(lease)`（settle 到
  `getStatus().lease==='active' ∧ runtime.schema.state==='ready'`）

#### 7.2.2 冻结 schema 与 seed

schema 逐字冻结（SA6 契约 §12.2；探针 `SCHEMA_TEXT`）：

```
type Item = { title: string; qty: number & Int<0, 100> };
type Alt = { label: string; n: number & Int<0, 10> };
type ROOT = {
  n: number;
  tasks: Record<string, Item>;
  codes: Record<string & Pattern<"^(id-[0-9]+)$">, Item>;
  blobs: Record<string, Item | Alt>;
  maybe: Record<string, Item> | { fixed: string };
  outer: { inner: Record<string, Item> };
  obj: { req: string; opt?: number; unk: unknown; deep: { d: string } };
};
```

七个 ROOT 字段各司一职：`n` 标量对照（E2 键集同构）；`tasks` 非 union Record 主面；`codes` 键
Pattern 面；`blobs` 值位 union（仍 fast path）；`maybe` union map 位（永久 legacy 负例）；`outer.inner`
深层 Record（path rebase）；`obj` 封闭对象 delete 面（required/optional/unknown 三类字段 + 深层
污染位 `deep`）。

seed（`buildLeaseRecordDoc(options)`，`doc.clientID = HUB_CLIENT_ID`；SCHEMA/META 照 #441/#437 先例）：
`n=1`；`tasks`：`t0..t{tasksN-1}`（默认 3，`itemEntry(`t${i}`, (i%100)+1)`）；`codes`：`id-1`；`blobs`：
`b0..b{blobsN-1}`（默认 1）；`maybe`：`m0..m{maybeN-1}`（默认 1）；`outer.inner`：`n1`；`obj`：
`req='r'`、`opt=1`、`unk={k:1}`、`deep={d:'d'}`。尺寸参数（`tasksN`/`blobsN`/`maybeN`）服务
U3/U4/V3 的 n=64/256 两档。

常量：`NS_442='ns-442-lease-record'`、`OWNER_442={userId:'u-442'}`（frozen）、
`NOW_MS=1_700_442_000_000`、`HUB_INSTANCE_ID='hub-442'`、`PEER_INSTANCE_ID='peer-442'`、
`HUB_CLIENT_ID=4242`、`REMOTE_CLIENT_ID=999_999`。

#### 7.2.3 fixture 形状与关键装置语义

```ts
interface LeaseRecordFixture {
  readonly registry: NamespaceRegistry;
  readonly lease: NamespaceLease;
  readonly doc: Y.Doc;            // 装置面引用：仅基态字节快照/读计数导航/peer bootstrap
  readonly persistence: LeaseRecordPersistence;
  readonly namespaceId: string;
  readonly session: ReplicationSession | undefined;      // replication:true 时
  readonly ownedUpdates: Uint8Array[];                    // session owned update 捕获
  readonly log: BoundedMemoryDiagnosticLog | undefined;   // diagnostics:true 时
  readonly updateEvents: Uint8Array[];                    // doc 'update' 事件捕获（B-4/B-8 锚）
}
```

- `openLeaseFixture(options)`：`doc.on('update', u => updateEvents.push(u.slice()))` 在
  `registry.open` **之前**挂上（从零基态计数；污染 apply 与业务写都各自 +1，用例以「前后差值」
  断言恰 1）。replication 装配 = `enableReplication()` → `openReplicationSession({localRole:role,
  remoteInstanceId})` → `subscribeOwnedUpdates`；diagnostics 装配 = §2.1 的生产形状 binding。
- `openPeerFixture(hub)`：hub 状态全量快照（`snapshot.clientID = HUB_CLIENT_ID+1`）→ 空
  persistence 的 peer registry → `registry.importReplica(owner, NS, snapshot, identity)`（identity 取
  hub `getStatus().runtime.replication` 的 `replicationId`/`replicationEpoch`）→ `waitForSchemaReady` →
  `openReplicationSession({localRole:'peer', remoteInstanceId:HUB_INSTANCE_ID})` + owned 捕获；
  `updateEvents` 在 import **之后**挂（bootstrap 增量不计入）。
- 污染注入 `applyRawRemote(fx, mutate, label)`：远端副本（`clientID=REMOTE_CLIENT_ID`）以 live doc
  当刻状态为基态 → 施加 `mutate(remote)` → `encodeStateAsUpdate(remote, encodeStateVector(live))` 求
  增量 → `session.applyRemoteUpdate(diff)`（trusted raw 面，零 VFSL 预校验）。**禁止**在 lease 层
  直写 live Y.Doc。
- 读取助手：`readValue(lease, path)`（`readData` 成功值，失败 throw）；`rawMapAt(doc, path)`（装置面
  导航到 live `Y.Map`，仅污染构造与读计数锚定用）。
- 零写入锚：`stateBytes(doc)=Y.encodeStateAsUpdate(doc)` 前后 `sameBytes` 比较 + `updateEvents`
  差值为 0 +（复制 fixture）`ownedUpdates.length===0`。

#### 7.2.4 Map 读计数助手（新移植；#437 数组版的对偶）

`countMapReadsAsync(map, run): Promise<{valueReads, presenceReads}>`：对 live `Y.Map` 实例包装 8 个
读取出口——`get`（valueReads 逐次）、`has`（presenceReads 逐次）、`keys`/`values`/`entries`/
`toJSON`/`Symbol.iterator`/`forEach`（各按 `map.size` 计入 valueReads）；包装覆盖整个 `await run()`
窗口（`mutateData` 的实际判定在 sequencer 槽内、await 之后执行——#437 `countElementReadsAsync`
注释同款事实）；`finally` 中 `delete` 全部包装（零残留）。**纪律**：读计数只作结构性成本代理，
成对行为断言承担判定（§7.5.3）。

#### 7.2.5 确定性纪律

零真实时钟（固定 `NOW_MS`）；计数 randomBytes（128-bit 请求、幂等序列）；受控 scheduler；零网络、
零真实并发、零随机源；clientID 全显式固定（hub 4242 / remote 999999 / peer 快照 4243 / 重放对照
doc 987654）。污染一律**插入新键**（`t9`/`nope`/`b9`/`n9`/`mz`），唯一同键覆盖 = `obj.deep`→5
（A6/A7/A8 场景；clientID 决胜确定）。诊断/复制异步扇出用有界 `settleUntil` 沉降（400 轮上限，
SA6 实测 <10 轮）。

### 7.3 契约测试规格（29 its；断言与冻结值逐字承接 SA6 §12.3）

契约文件按 AC 分组 `describe`（'issue #442 AC1 — …' 至 'AC6 — …'），每 SA6 ID 一个 `it`。下表
「断言」列为运行时行为断言集合（判别联合结果、逐字 issue message/path、`readData` 逻辑值、update
事件数、状态字节、读计数、诊断 record/carrier、复制 owned update）；所有 `ok:false` 分支一律附
零写入锚（`stateBytes` 前后逐字节不变；表内标注「零 update」处并断言 update 事件差值为 0——
与 SA6 §12.3 逐行同强度，不擅自加严或软化）。

| ID | 场景 | 断言（冻结值 = HEAD 实测） |
|---|---|---|
| A1 | `tasks.t9='oops'` raw 污染 → set `tasks.t3` | `ok:true`；污染保留 `'oops'`；恰 1 update；`tasks.t3={title:'t3',qty:3}` |
| A2 | 同污染 → delete `tasks.t0` | `ok:true`；恰 1 update；`t0` 消失；污染保留 |
| A3 | 同污染 → delete 污染键自身 `tasks.t9` | `ok:true`；恰 1 update；`t9` 消失（delete 不读旧值） |
| A4 | 兄弟 entry 值非法（`t9=Item{qty:'x'}`）→ set `tasks.t3` | `ok:true`；恰 1 update；`t9.qty` 仍 `'x'`（不修复） |
| A5 | 兄弟键违约 `codes.nope` → set `codes.id-2` | `ok:true`；恰 1 update；`id-2` 写入；`nope` 保留 |
| A6 | `obj.deep=5` 污染 → delete `obj.opt` | `ok:true`；恰 1 update；`opt` 消失；`deep` 仍 5 |
| A7 | 同污染 → delete `obj.unk` | `ok:true`；恰 1 update；`unk` 消失；污染不连坐 |
| A8 | 同污染 → delete `obj.req` | `ok:false`；**逐字** `缺少必填字段 "req"`、path `['obj','req']`（静态判定）；零写入零 update |
| A9 | `blobs.b9='oops'` 污染 → set `blobs.b2`（Item） | `ok:true`；恰 1 update；`b9` 保留（值位 union 不阻断 fast path） |
| A10 | `outer.inner.n9='oops'` 污染 → set `outer.inner.n2` | `ok:true`；恰 1 update；深层写入正确；`n9` 保留 |
| A11 | 同 A1 污染 → 批量 `{ops:[set t7, set t8]}` | `ok:true`；**单事务单 update**（差值恰 1）；两键写入；污染保留 |
| B1 | set `tasks.t9={title:'x',qty:'y'}` | 逐字 `类型不匹配：期望 number，实际 string`、path `['tasks','t9','qty']`；零写入零 update |
| B2 | set `codes.nope` | 逐字 `Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/`、path `['codes','nope']`；零写入零 update |
| B3 | delete `tasks.zz` | 逐字 `delete 目标键不存在（拒绝 no-op）`、path `['tasks','zz']`；零写入 |
| B4 | delete `obj.req` | 逐字 `缺少必填字段 "req"`、path `['obj','req']`；零写入 |
| B5 | delete `obj.unk`（unknown 标量） | `ok:true`；`unk` 消失 |
| B6 | delete `obj.opt` 后重复 delete | 首删 `ok:true`；重复 → 逐字 no-op 文案、path `['obj','opt']` |
| B7 | `ROOT.tasks` 本身 raw 置 plain → set `tasks.t3` | 逐字 `Yjs 载体错位（ROOT）：期望 Y.Map，实际 plain value`、**path `[]`**；零写入零 update |
| B8 | 深层非法新值 set `outer.inner.n2` | 逐字同 B1 文案、path `['outer','inner','n2','qty']`（跨深度 rebase）；零写入 |
| U3 | n=64（tasks/blobs/maybe 同档）：`tasks` set 读计数 vs `maybe` set 读计数 | fast：`tasks` `valueReads ≤ 8`；union legacy：`maybe` `valueReads ≥ n`（实测 514） |
| U4 | `tasks` set：n=64 vs n=256 | 两侧 `valueReads ≤ 8` 且**相等**（实测 1 与 1；与 n 解耦） |
| V1 | `blobs.b2`=Item / `blobs.b3`=Alt（clean） | 两支成员均 `ok:true` |
| V2 | `blobs.b2={title:'x',n:5}` | `ok:false`；恰 2 条 issue，逐字：`联合成员 1/2：缺少必填字段 "qty"` @ `['blobs','b2','qty']` 与 `联合成员 1/2：未知字段 "n"：封闭对象不接受未声明键` @ `['blobs','b2','n']`；零写入零 update |
| V3 | `blobs` set：n=64 vs n=256 | 两侧 `valueReads ≤ 8` 且相等（值位 union 不阻断；实测 1 与 1） |
| E1 | 诊断：set `tasks.t3`（diagnostics fixture） | 恰 1 条 `root-mutation` attempt（settle 后）；`stage='transaction'`；`source={kind:'local'}`；`result.kind='committed' ∧ effect='update'`；inline carrier（`storage='inline'`、`format='yjs-update-v1'`、`payloadLength>0`、`crc32c` 为 8 位 hex）；carrier 重放：同基态 + bytes → `tasks.t3` 在场（真事务增量）；空 doc 应用 bytes → `ROOT` size 0（最小增量、不物化） |
| E2 | set `tasks.t3` + set `n`（record 写 vs 标量写） | 两条 root-mutation record 的排序键集逐键相同（实测 10 键 `attemptId,input,observedAt,operation,recordKind,result,sequence,source,stage,streamId`）；两 carrier 排序键集逐键相同（实测 5 键 `base64,crc32c,format,payloadLength,storage`） |
| R1 | hub set `tasks.t3` → owned update → peer apply | settle 到 ≥1 owned update；增量应用到同基态纯 Y.Doc（clientID 987654）含 `t3`；`peer.session.applyRemoteUpdate(update)` `ok`；peer 与 hub 的 `readData(['tasks','t3'])` 逻辑值相等；diff 定点（`hub.encodeDiff(peer.encodeStateVector())` 再 apply 后逻辑值仍 `{title:'t3',qty:3}`）；session `getStatus().state='open'`、`direction='hub-to-peer'`、`localRole='peer'`、`remoteInstanceId='hub-442'` |
| R2 | 同 R1 + 第二笔 delete `tasks.t0` | 首笔 owned update 对空 doc 不物化 ROOT、同基态重放含 `t3`；两笔提交 = 恰 2 个 owned update 事件 |
| R3 | `tasks.t9='oops'` 污染在场（peer bootstrap 自含污染）→ set `tasks.t3` → 复制 | `ok:true`；peer apply 后既得 `t3` 新值**又保留** `t9='oops'`（非整 map 重写） |

### 7.4 负控测试规格（4 its，恒绿；独立文件承载 A/B 对照）

| ID | 场景 | 断言 |
|---|---|---|
| C1 | `maybe.mz='oops'` 污染 → set `maybe.m2` | 逐字 `Yjs 载体错位（ROOT.mz）：期望 Y.Map，实际 plain value`、path `['mz']`；零写入零 update（与 A1 同污染同 op 的 A/B 对照 ⇒ A 组 `ok:true` 非恒真） |
| C2 | `maybe` 干净 set `m2` / delete `m0` | 均 `ok:true`（legacy 轨可用性不变） |
| C3 | `maybe`（maybeN=64）set 读计数 | `valueReads ≥ n`（全量边界校验仍在；实测 514） |
| C4 | `ROOT.tasks` 载体位（同 B7 场景）独立 A/B 对照 | 逐字拒绝、path `[]`、零写入零 update（fast path 未放松载体检查） |

### 7.5 断言形态决策

**7.5.1 逐字 message/path 冻结**：B1–B8、A8、C1、C4 的 message 用 `toBe`/逐字相等断言（非
`includes`），path 用序列化相等——这是「立法」的本体；SA6 在旧新两修订实测逐字相同（§6-C3），
钉死不构成对 #441 实现细节的过度耦合，而是把 ADR 0034 决策 5 的域规则固化为用户可见契约。

**7.5.2 「不修复」的负向断言形态**：污染保留断言 = 污染键/值在写后**逐字不变**（`'oops'`、
`qty:'x'`、`deep===5`、`nope` 在场），并辅以「恰 1 update 事件」（整 map 重写必然产生更大增量/
多事件，R3 再以对端保留污染直接证伪整 map 重写）。不为「不修复」引入额外文档级字节全等断言
（污染写与业务写各自产生 update，`encodeStateAsUpdate` 全等只用于**拒绝分支**零写入锚）。

**7.5.3 读计数阈值与字节形态**：成本断言用**形态 + 不等式 + 跨规模相等**（≤8、≥n、n=64 与
n=256 相等），不钉 `valueReads===1` 精确值（预留无害余量，防计数面轻微演化伪红；SA6 冻结的
判据即 ≤8/≥n/相等）。E1/E2 carrier 同理只钉**形态**（inline/format/正长度/8-hex crc32c/重放
收敛/不物化/键集同构），`payloadLength=43`、`crc32c='be9fa1fe'` 是 SA6 证据值而非断言字面量
（AC5 的「记录形态不变」由键集同构 + 重放 oracle + 不物化承载；字节级「旧新相同」已由 SA6 C6
两面实证，无需在交付测试里钉魔数）。

**7.5.4 判别性承载**：交付测试只断言 HEAD 期望；「旧实现必红」由 SA6 基线证据（`--baseline`
4 轮 31/31 命中旧语义）承载，交付测试不携带 baseline 分支、不读环境变量（SA6 §14：`--baseline`
仅探针 CLI 参数）。

### 7.6 非重复立法边界（与 #440/#441 面的分界）

| 面 | 归属 | 本票处理 |
|---|---|---|
| vfsl 逐 entry 接缝语义（键 Pattern/值 schema 判定本体） | #440 `issue-440-elementwise-entry-*` | 不动 |
| doc-runtime 闸门接线、S9 安装事实核、E201-C、fatal 面、commit 字节 vs 手写 edit 等价 | #441 FA–ND（45 tests） | 不动；lease 面不重复（不可观察或已锚） |
| union 穿越位（`umem` 形态） | #441 NA4 | 本票 schema 不引入 |
| 数组逐元素（ADR 0033）lease 面立法 | #437 三件套 | 不动；fixture 命名/结构同构但独立成套（schema 不同、助手族不同） |
| lease seam 用户可见行为（本票） | **新增** issue-442 三件套 | AC1–AC6 全部 |

### 7.7 主要备选方案（未选及原因）

1. **在 doc-runtime 测试里加 lease 断言**——doc-runtime 包无法装配 Registry（依赖方向相反），
   且最高 seam 的信封门/诊断泵/复制扇出在该包不可观察；违反「最高 seam」任务定义。
2. **用 `registry-phase5-replication-session-red` 既有会话夹具复用**——该夹具锚会话面语义，
   无 schema 化 ROOT/诊断 binding/读计数装置；复用会把 #442 断言耦合进非本票语义的夹具，红因
   混淆。
3. **性能断言钉毫秒**——ADR 0034 决策 6 明文软验收；机器相关阈值必然 flakes；改用结构性读计数
   （SA6 §7 同判）。
4. **fixture 直接 import vitest 的 expect**——破坏「零 vitest 依赖」先例（#437 fixture 注释明示
   该纪律的动机：fixture 需可被非 vitest 上下文（探针）消费且断言语义自持）。

## 8. 接口、状态机和数据流

**接口变化**：无。本票零生产接口/类型/导出变化；唯一「接口」是新增测试文件对既有公共面的消费
（§7.2.1）。**状态机变化**：无（测试观察既有 lease/session/runtime 生命周期，不引入新状态）。

### 数据流路线（测试装置驱动的真实执行顺序）

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 1 污染注入 | 测试调 `applyRawRemote(fx, mutate)`；远端副本（clientID 999999） | 远端 doc 上 `mutate`（新键插入 / `obj.deep` 同键覆盖） | `encodeStateAsUpdate(remote, sv(live))` 求增量 | 经 `session.applyRemoteUpdate(diff)`（trusted raw 面，零 VFSL 预校验）进入 live doc（sequencer 有序） | lease `readData` 可读到 raw 污染值 | live doc 获得 schema 外数据 + 恰 1 update 事件 + owned update 0（raw apply 非 owned） | apply 返回判别联合，`ok:false` 即断言前置失败（fixture assert throw） | A1–A11/C1/R3 前置 |
| 2 业务写（fast path） | 测试调 `lease.mutateData({op:'set'/'delete',path,…})` 或 `{ops:[…]}` | doc-runtime F4 detached 构造 → guarded Yjs 事务单键 commit | lease released 检查 → runtime 写 sequencer → `planMutationBoundary` 闸门（object∧map）→ F1 载体/F2 在场/F3 接缝域规则/F4 构造/F5 install-facts | live Y.Doc（单事务） | `readData(path)` 逻辑值；doc `update` 事件；`stateBytes` | `ok:true` + 恰 1 update + 目标键终态 + 污染保留；或 `ok:false` + issues（逐字）+ 零写入锚（§7.3 表内标注处并零 update） | 拒绝 = 零写入零 update（事务前 fail）；事务后不变量失败为 fatal（不在本票面） | A/B 组、C4 |
| 3 诊断扇出 | 路线 2 提交（diagnostics fixture） | 事务内 emitter 发 attempt record | 诊断泵 `setImmediate` 异步投递（best-effort；ADR 0011） | `BoundedMemoryDiagnosticLog`（updateCapture:inline carrier） | `log.records()` 过滤 attempt/root-mutation | 恰 1 record；stage/source/result/carrier 形态；carrier 重放 = 真事务增量 | emit 永不 throw、不改业务结局；settle 400 轮上限后 assert | E1/E2 |
| 4 复制收敛 | 路线 2 提交（replication fixture）→ owned update 扇出（异步） | session owned update 生成 | hub→peer 方向；`subscribeOwnedUpdates` 捕获 | `peer.session.applyRemoteUpdate(update)`（同一 trusted raw 面） | peer `lease.readData` 与 hub 逻辑值比对；`encodeDiff`/`encodeStateVector` 定点 | peer 收敛新值且保留污染；1 提交 = 1 owned 事件；最小增量（空 doc 不物化 ROOT） | apply 判别联合 `ok:false` 即断言失败；settle 有界 | R1–R3 |

（每条路线均单仓内闭环，无跨进程/跨持久化边界；路线 4 的 hub/peer 为同进程两个 Registry 实例，
传输面为 Yjs update bytes——协议承载物零变化即 AC6 断言集。）

## 9. 错误、恢复、并发和幂等

- **错误语义**：被测面一切失败都是判别联合 `ok:false + issues`（非 throw）；fixture 对**装置前提**
  失败（open/enable/import/readData 失败）就地 throw（红），对**被测行为**只断言返回值。零吞错、
  零 skip/only/todo、零 env override、零 fallback、零软化断言。
- **恢复/回滚**：无需回滚——纯测试新增，git revert 三文件即完全回退；无生产状态迁移。
- **并发**：每 it 独立 fixture（独立 registry/namespace/doc），无跨 it 共享态；namespace 写
  sequencer 单线程有序（污染 apply 与业务写同槽排序，断言不受竞态影响）；异步扇出（owned update、
  诊断泵）一律有界 `settleUntil`，零真实 sleep。`maxWorkers:1`（vitest.config.ts）进一步消除
  并行干扰。
- **幂等**：fixture 每次全新构造（无幂等诉求）；`registry.open` 对同 NS 在 Persistence 已 seed 的
  doc 上恢复（`loadDoc` 路径），`importReplica` 走 peer 专用导入面——两者都是既有已测生命周期，
  本票仅消费。
- **资源清理**：测试不显式 release lease/shutdown registry（既有 #437 契约同款做法：进程内
  vitest worker 回收；无端口/文件句柄/长驻进程）；读计数包装在 `finally` 中删除，零残留。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| vitest runner（根 `pnpm test`） | 收集 `packages/*/test/**/*.test.ts` | 多收集 2 个新测试文件（fixture 不收集） | 无（include 面已覆盖；`vitest.config.ts:15`） | SA6 §14 发现性实测：同目录 #437 两文件实跑 2 files/20 tests |
| 根 `pnpm typecheck` | 15 包 `tsc -p`（registry tsconfig 只含 `src/**`） | 不变——测试文件不进包 tsc 面（仓库既有模式，#437/#441 同款） | 无 | `packages/namespace-registry/tsconfig.json` include；root `package.json` scripts |
| `lease.mutateData`/`readData` 生产调用方 | 既有行为 | 零变化（本票零生产改动） | 无 | §11 DENY LIST |
| #441 doc-runtime 测试 | 45 tests 绿 | 零变化、零耦合 | 无 | `packages/doc-runtime/test/issue-441-*` |
| #437 lease 数组测试 | 20 tests 绿 | 零变化（独立 fixture，无共享文件） | 无 | `packages/namespace-registry/test/issue-437-*` |
| 实现期 SA（SA3/SA8） | — | 按 §7.2–§7.4 规格落盘 3 文件 | 仅 ALLOW LIST 三路径 + 本设计产物 | SA6 §12.2「本轮按 dispatch 未落盘，由实现期 SA 按此规格落地」 |
| registry public-surface guard 测试 | 锚 `src/index.ts` 导出面 | 不触发（无新导出；fixture 非导出面） | 无 | `packages/namespace-registry/AGENTS.md` Boundaries |

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `wiki/raw/task_issue-442_design.md` | 新建（本设计） | SA1 设计产物固定位置 |
| `packages/namespace-registry/test/issue-442-lease-record-e2e-fixture.ts` | 新建（共享 fixture，~450 行量级） | §7.2 全部装置；契约/负控共用 |
| `packages/namespace-registry/test/issue-442-lease-record-e2e-contract.test.ts` | 新建（29 its） | §7.3 AC1–AC6 立法 |
| `packages/namespace-registry/test/issue-442-lease-record-e2e-control.test.ts` | 新建（4 its） | §7.4 负控 A/B 对照 |

（实现期如需在 `artifacts/` 落验证日志，属 Host 侧证据目录惯例，不算范围扩大；除上表外零改动。）

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/src/**`（`mutation-local.ts`/`mutation.ts` 等） | #441 fast path 实现 | Issue 明示「不改实现」；HEAD 行为已逐条正确（SA6 31/31） |
| `packages/doc-runtime/test/issue-441-*` | #441 立法面 | 已合面冻结；非重复立法（§7.6） |
| `packages/vfsl/**`、`packages/vfsl/test/issue-440-*` | #440 接缝面 | 同上 |
| `packages/namespace-registry/src/**`（含 `index.ts`/`testing.ts`/`lease.ts`） | 被测公共面 | 零生产改动；无新公共导出（AGENTS.md：公共 API 只经 `src/index.ts`） |
| `packages/namespace-registry/test/issue-437-*` | 数组立法（ADR 0033） | 独立范围；共享会耦合红因 |
| `packages/namespace-runtime/**`、`packages/namespace-diagnostic-log/**`、`packages/persistence/**` | 装置依赖的生产面 | 只消费不修改 |
| `vitest.config.ts`、根 `package.json`、`pnpm-lock.yaml` | runner/依赖面 | include 面已覆盖；fixture 只用既有依赖（yjs/registry/testing/diagnostic-log/persistence 类型），零新依赖 |
| `docs/adr/**`、`CONTEXT.md`、`docs/**` | 规范文档 | 无决策/词汇变化（ADR 0034 已是母法；本票为其补验证，非改契约） |
| `wiki/raw/task_issue-442.md`、`wiki/raw/task_issue-442_sa6_contract.md`、`wiki/raw/task_issue-442_sa6_capability_probe.mts` | Host/SA6 上游产物 | 只读输入（evidence，非 normative——docs/AGENTS.md） |

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 行为变化：污染 Record map 写/删目标键合法即成功；封闭对象 delete 同理（旧语义连带拒绝） | SA6 §5.2/§5.3（HEAD 31/31、baseline 判别组 15 条旧语义红） | A1–A11 | HEAD 全 `ok:true` + 污染保留 + 恰 1 update；A8 message 级判别 |
| AC2 不变量：键 Pattern/非法新值零写入 + issue 路径不变；no-op delete；必填拒/unknown 允许 | SA6 §5.2 逐字证据（旧新同） | B1–B8 | 逐字 message/path + 零写入零 update；B5/B6 允许面 |
| AC3 union map 位端到端行为与性能路径不变（仍全量边界校验） | SA6 U1/U3 两面相同 | C1–C3（+U3 union 半） | 污染照旧逐字拒绝；干净写照常；读计数 ≥ n |
| AC4 Record 值位 union 仍 fast path | SA6 U3/V3 读计数对比 | V1–V3 | 两支成员接受、非法值两 issue 拒绝、读计数 ≤8 且跨 n 相等 |
| AC5 诊断烟测：committed update bytes 记录形态不变 | SA6 E1/E2 + C6（旧新 byte 级相同） | E1–E2 | record/carrier 形态、重放 oracle、不物化、键集同构 |
| AC6 复制烟测：fast path 提交经 replication apply 收敛、协议面不变 | SA6 R1–R3 | R1–R3 | peer 收敛、最小增量、1 提交=1 事件、污染保留、session 状态 |
| AC7 根 gates 绿 | SA6 pre-contract：typecheck exit 0、test 471 files/5757 tests | 落地后复跑根 gates | `pnpm typecheck` exit 0；`pnpm test` 473 files、5757+33=**5790** tests 全过（SA6 报告「5791/34」系其 §12.3 枚举 33 的算术笔误，见 §5 承接表）；零 skip/only/todo |
| （验证命令 1）聚焦面 | SA6 §13 先例 | `npx vitest run packages/namespace-registry/test/issue-442-lease-record-e2e-{contract,control}.test.ts` | 2 files / 33 tests passed，`Type Errors: no errors`，exit 0 |
| （验证命令 2）根 typecheck | pre-contract 已 exit 0 | `pnpm typecheck` | exit 0（15 包；测试文件不在包 tsc 面，§10） |
| （验证命令 3）根 test | pre-contract 471/5757 | `pnpm test` | 全绿，文件 +2、用例 +33 |
| （验证命令 4）判别性复核（可选；SA6 已证） | `artifacts/sa6-issue442-probe-baseline*.log` | detached worktree @ `3fd6aa8` 复制三文件后跑聚焦面 | 15 its（A1–A11、U3、U4、V3、R3）红且失败原因恰为旧语义连带拒绝/读计数 ∝ n；其余 18 its 绿 |
| （验证命令 5）稳定性 | SA6 7+4 轮先例 | 聚焦面复跑 ≥3 轮 | 逐轮 33/33、零 flakes |

## 13. 风险、回滚和残余问题

| # | 风险 | 缓解 | 残余 |
|---|---|---|---|
| R-1 | 读计数代理失明（未来实现经未包装出口整 map 提取） | 8 出口全覆盖 + union ≥n 反证（C3）+ 行为断言成对承担判定（§7.5.3） | 理论残留；接受（SA6 §15 同判） |
| R-2 | 逐字 message 钉死与后续文案演进冲突 | 这正是立法目的：文案变化须经 #442 面显形（改测试须过评审）；ADR 0034 决策 5 域规则本就要求逐字兼容 | 无 |
| R-3 | E1/E2 形态断言漏掉字节级漂移 | 键集同构 + 重放 oracle + 不物化已覆盖「形态」语义；字节级不变由 SA6 C6 两面证据 + R2 最小增量锚补强 | 若未来 carrier 增可选键，E2 同构断言会显形（预期行为） |
| R-4 | `obj.deep` 同键覆盖依赖 clientID 决胜 | fixture 冻结两端 clientID；Yjs 并发同键按 clientID 决胜是确定性的 | 无 |
| R-5 | U4/V3 的 n=256 fixture 拖慢套件 | 纯内存、无 IO；#441 ND4 同档规模先例可接受；`maxWorkers:1` 下增量秒级 | 无 |
| R-6 | 落地 its 数与 SA6 报告「34」不一致引发验收争议 | §5 承接表已记录矛盾并以枚举 33 为准；验收准绳 =「零 skip 且逐 ID 覆盖 §12.3 全表」，不机械对齐报告数字 | 需 Controller/SA7 知悉该口径 |
| R-7 | fixture 与 #437 fixture 常量重名（`NOW_MS`/`HUB_CLIENT_ID` 等） | 两文件互不 import；vitest 模块隔离；命名加 `_442` 后缀的常量（NS_442/OWNER_442/SCHEMA_442）已区分，通用名（NOW_MS 等）保持文件内私有不导出 | 无 |
| R-8 | 回滚 | 纯新增：删除三文件即完全回退，根 gates 回到 471/5757 基线 | 无 |

**任务内必要条件**：无未决阻塞。**明确 follow-up（非本票）**：① raw 污染的异步/抽样审计
（ADR 0034 明文「需要时另行设计」）；② 合法性重建与 carrier 覆盖面审计（CONTEXT.md 已登记
follow-up）；③ 若 SA8 裁决需要 lease 面 S9 烟测，另立票（SA6 §15 已判非本票 AC）。

## 14. 是否需要设计后 ADR 冲突复查及理由

**需要（`requiresConflictRecheck: true`）**，理由收敛为两点：

1. **SA8 工件缺席**（iteration 0 无 `_relevant_decisions.md`/`_conflict_report.md`）：本设计的约束面
   由 SA1 直读 ADR 0034/0033 + CONTEXT.md 词条 + 包 AGENTS.md 替代建立（§6）；按流程应对无 SA8
   筛查的设计补一次冲突复查。
2. **两处解释性决策需 SA8 确认不越权**：(a) §7.6 的非重复立法边界（S9/E201-C/fatal 面不回落
   lease seam）是对 ADR 0034 验证面清单的划分；(b) §5 对 SA6 契约「30+4=34」vs 枚举「29+4=33」
   计数矛盾的仲裁（以枚举为准）。两者均不修订任何 ADR 决策本体，但属对冻结证据的解读，宜经
   复核确认。

本设计**不**触碰公共 API、wire、schema、持久化或状态机语义，不修订既有决策，不引入新的生命
周期所有权或失败语义（纯测试新增）；上述复查属证据解读面，而非语义变更面。
