# SA1 实现设计 — Issue #393：FileDiagnosticLog 自绑定（P0）+ manager 泛化导出（P1）+ skill 诊断日志文档（P2）

- 仓库：`welltop-jim-wang/nomicore`；worktree：`/home/wangjian/nomicore-fix-issue-393`；HEAD：`dcb3766`
- 任务类型：**Bug 修复**（主修复 P0 为产品缺陷修复；P1 公共面增量；P2 文档交付）
- 上游：`wiki/raw/task_issue-393.md`（issue 正文 + Owner comment 5664521867）、
  `wiki/raw/task_issue-393_sa6_contract.md`（SA6 验收契约，approved；4 个红灯契约文件已在
  worktree、`git status` 可见）。`_relevant_decisions.md` / `_conflict_report.md` /
  `_sa2_review.md` 不存在（见 §6/§14）。

---

## 1. 任务类型、目标与非目标

**症状（bug）**：外部 Host（DSH `nomicore-host` Hub 侧 / `mabf-runner` Peer 侧）把
`createFileDiagnosticLog(...)` 产物直接传给 registry 插件的 `{ diagnosticLog }`，结果只产出
`manifest.json` 与 `current.json`，`segments/` 恒空——namespace 持续 root-mutation 与
replication apply，但 runtime 级 emission 零落盘、零错误、零警告（observability 系统以
最坏失效模式失效）。

**目标**：

1. **P0（主修复）**：`FileDiagnosticLog` 增加 identity 匹配成员 `runtimeEmitterFor`，
   使「`createFileDiagnosticLog(...)` 产物直传 `diagnosticLog`」这一自然组合直接进入
   #226 生产泵路径；registry 探测逻辑零改动。
2. **P1**：`apps/yjs-server` 的 `createHostDiagnosticsManager` 泛化签名后从公共入口导出
   （多 namespace Host 的正路）；app 内部消费同一实现。
3. **P2**：`.agents/skills/nomicore/cordis-host.md` 新增诊断日志配置节 +
   `SKILL.md` 路由行。
4. 显式定案并契约化「无归属公共入口拒绝」的落盘语义（AC5，见 §7.1-D5）。

**非目标**：

- 不改 registry 侧成员名与探测逻辑（`create-diagnostic.ts` / `diag-pump.ts` /
  `registry.ts` / registry `types.ts` 零改动——Owner 裁决的 P0 形状）。
- 不做 Host 侧类型收紧 fail-fast（Owner 已作废；自然用法工作后不存在需响的错误用法）。
- 不为 File adapter 增加 `initStream` 成员（泵路径对缺席成员已有 no-op 语义；stream 在
  构造期已 eager 建立）。
- 不在本票处理 `diag-pump-drop` 观测事件在生产 Host 的管道缺口（issue 明文「独立处理」）。
- 不给 memory adapter（`createBoundedMemoryDiagnosticLog`）加自绑定（测试用途面，
  非 DSH 部署路径；见 §13 残余）。
- 不热修复既有进程内已构造的 Runtime（自绑定在装配期成立；DSH 走「新 tarball + 重启」）。

---

## 2. 当前行为与证据锚点

| # | 事实 | 锚点（文件:行 / 符号） |
|---|---|---|
| B1 | `FileDiagnosticLog` 公共接口成员 = `emitter` / `streamId` / `rootDir` / `namespaceId` / `sweepRetention`，**无** `runtimeEmitterFor` | `packages/namespace-diagnostic-log/src/adapters/file.ts:118-131`（接口）；`:1529-1541`（构造产物字面量） |
| B2 | registry 诊断装配三态路由：`diagnosticLog` 缺席/畸形 emitter → no-op；emitter 在场无 `runtimeEmitterFor` → legacy 路径；两者在场 → #226 泵路径。探测 = 构造期一次非抛读取 `typeof candidate === 'function'` | `packages/namespace-registry/src/create-diagnostic.ts:391-417`（`createDiagRuntime`）、`:309-318`（`readRuntimeEmitterResolver`）、`:419-463`（legacy 路径）、`:466-585`（泵路径） |
| B3 | legacy 路径 `resolveRuntimeDiag` 恒 `() => undefined` → `runtimeOptionsFor` 无 `diagnosticEmitter` → Runtime `diagEnv.emitter === undefined` → 该 Runtime 全部 runtime 级发射点（root-mutation / schema-replacement / replication-enable / replication-epoch-bump / replication-apply）不构造 slot diag、发射 no-op | `create-diagnostic.ts:462`；`packages/namespace-registry/src/registry.ts:817/833`；`packages/namespace-runtime/src/runtime.ts:547/740-818/880`；`packages/namespace-runtime/src/replication-session.ts:484-496`（`applyRemoteUpdate` 的 `emitRejection`） |
| B4 | raw log 直传时 registry 仅 create 路径发射 create 尝试（open/importReplica 结构性不发射 create 记录）；共享 `emitter` 就是该 ns 自己的流写面 → legacy 回落把**其它候选 ns** 的 create 记录写进本流（跨 ns 写入缺陷，SA6 臂 D0 实测计数 1→2） | `registry.ts:1403-1586`（create 路径发射点）；SA6 §8 步骤 5 / 臂 D0；R3 红灯锚 |
| B5 | 泵路径下 RuntimeFactory 第三参 = O(1) 延迟 wrapper（不现场解析）：`emit` → `enqueueEmit(namespaceId, emission)`；drain 内 `resolveEmitterOnce` 形状门解析，undefined → 静默丢弃（per-ns FIFO，容量 256，满队 drop-newest） | `create-diagnostic.ts:477-479/577-584`；`packages/namespace-registry/src/diag-pump.ts:129-146/171-218` |
| B6 | 泵路径下 `initStream` 成员缺席 → no-op（路由层保证 + `pumpInitStream` 可选调用双保险）；无归属公共入口拒绝（`namespaceId === undefined`）**恒走同步共享通道** `emitAttempt(emitter, …)`，不经泵 | `create-diagnostic.ts:467-476/530-541`；`registry.ts:2201/2211`（`emitEarlyOutcome(undefined, …)`） |
| B7 | File adapter 在一切模式（ready/disabled/failed）形状完备返回：emitter 照常构造，sink 按 mode 静默；stream/manifest 在构造期 eager 建立（#153 语义） | `file.ts:1517-1527`（形状完备返回 J6）、`:1458-1503`（建流/续写） |
| B8 | 生产供应方形状先例：`apps/yjs-server/src/diagnostics.ts` 的 manager binding（共享 `emitter` 恒丢弃+计数；`runtimeEmitterFor` 数据键控；`initStream` 建流；retire/close 丢弃桩）——当前签名 `(config: Readonly<DiagnosticsConfig>, deps: { sink: EventSink; now: () => number })`，`DiagnosticsConfig`/`EventSink` 为 app 本地类型 | `apps/yjs-server/src/diagnostics.ts:80-83/145-167`；`apps/yjs-server/src/config.ts:111-121`（`DiagnosticsConfig` 含 `enabled`）；`apps/yjs-server/src/lifecycle.ts:14-18`（`EventSink` stdout 语义） |
| B9 | `apps/yjs-server/src/index.ts` 当前**不**导出 manager；app 内部 `app.ts:280` 经 `./diagnostics.js` 直呼构造；两个既有 app 测试以旧签名 `{ enabled: true, … }, { sink, now }` 调用 | `apps/yjs-server/src/index.ts`（grep 无 diagnostics 导出）；`apps/yjs-server/src/app.ts:60-62/278-284`；`apps/yjs-server/test/diagnostic-replay-host-lifecycle-sa7.test.ts:171-175`；`apps/yjs-server/test/host-diagnostics-retirement-sa7-228.test.ts:75-77/135-137` |
| B10 | skill 文档现状：`cordis-host.md` Process 第 5 步只提「pass a host-owned adapter (e.g. `createFileDiagnosticLog` …)」，无独立配置节、无多 ns/裸 `{emitter}` 陷阱/Hub·Peer 示例；`SKILL.md` 路由行（L16）不含诊断日志/observability 措辞 | `.agents/skills/nomicore/cordis-host.md:14`；`.agents/skills/nomicore/SKILL.md:16` |
| B11 | NDCL 公共面已导出 `FileRetentionConfig`（P1 泛化配置可直接引用，摆脱 app 本地类型）；`FileDiagnosticLog` 类型经 `src/index.ts` re-export，新增成员自动流经公共面（index 无需改动） | `packages/namespace-diagnostic-log/src/index.ts:68-74/90`；`packages/namespace-diagnostic-log/src/retention.ts:11` |
| B12 | SA6 契约（4 文件、14 运行时红灯 + 1 类型面红灯 + 6 守卫绿）已在 worktree；全量套件修复前 `4 failed / 392 passed`，失败文件全部为本票契约（no-regression 面成立）；根因双向绿推演（仅实例层注入 identity resolver → 4/4 绿）已证契约可翻转 | `wiki/raw/task_issue-393_sa6_contract.md` §12/§13；`artifacts/sa6-issue393-full-suite.log`、`artifacts/sa6-issue393-green-capability.log` |

---

## 3. 根因与能力缺口（承接 SA6 §8）

**根因链（SA6 已证明，设计全量承接）**：

1. **症状**：raw log 直传 → segments 只有 create 尝试、零 runtime 记录；DSH 的「0 记录」
   = 无 create 流量（workload 是 open+mutate）+ 无 runtime 记录。
2. **直接故障点**：`createDiagRuntime` 对 raw log 取 legacy 回落（B2/B3）。
3. **触发条件**：`FileDiagnosticLog` 无 `runtimeEmitterFor` 成员（B1）——SA6 R0 红灯
   `typeof === 'undefined'`。
4. **最深根因（能力缺口）**：adapter 已持数据键控归因所需的全部事实（`namespaceId` +
   `emitter`，均为 public 成员），但没有把 #155 泵路径所需的解析成员暴露为公共面；
   两个 nomicore 公共导出的自然组合因此落入 #150 过渡态形状——runtime 级可观测性从不
   产生且零反馈。Owner 裁决：这是产品缺陷，不是配置错误。
5. **放大因素**：静默回落是「受支持形状」无告警；manifest/current.json 构造期 eager 建立
   使日志外观存活；**同根因第二缺陷** = legacy 共享 emitter 恰是本 ns 写面 → 其它候选 ns
   的 create 记录被写进本流（跨 ns 写入，B4）。

**排除项（SA6 §11 已证，不重做）**：适配器写面（臂 A/G1）、registry 泵/装配面（臂 C/G4）、
环境/夹具（H4）、DSH 配置错位（H5）、策略丢弃（H6）、排空不足（H7）、类型收紧方向（H8，
Owner 作废）。

---

## 4. Owner 要求落实

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| 5664521867（OWNER，裁决记录） | 2026-09-14T13:12:42Z | 自然组合（`createFileDiagnosticLog(...)` 产物直传 `diagnosticLog`）必须直接工作；不工作 = bug，非配置错误 | §1 目标 1；§7.1 P0 全节；主契约载体即 raw log 直传（SA6 R1–R4） |
| 同上 | 同上 | P0 = `FileDiagnosticLog` 自绑定：增 `runtimeEmitterFor(namespaceId) = ns === this.namespaceId ? emitter : undefined`；registry 探测逻辑零改动 | §7.1-D1/D2/D4；§8 接口 diff |
| 同上 | 同上 | 不加 `initStream`（泵路径缺席成员已有 no-op；stream 构造期 eager 建立，resume 照常） | §7.1-D3（非目标 + 依据 B6/B7） |
| 同上（issue 正文 P0 节） | 同上 | 无归属公共入口拒绝经共享 emitter 落该流——倾向接受落盘，实现时显式定案并写入契约测试 | §7.1-D5（定案：接受落盘 + 理由 + 边界）；SA6 §12.3 契约已锚 |
| 同上 | 同上 | 「类型收紧 fail-fast」作废；裸 `{emitter}` 弱化为文档陷阱 | §7.3 P2（陷阱说明）；无任何类型拒绝断言（SA6 §2 已核） |
| 同上（正文 P1 节） | 同上 | P1 = `@nomicore/yjs-server` 导出泛化 manager（去 `enabled`/`EventSink` 本地语义，`onEvent?` / `now`）；app 内部消费同一导出，全仓一份 | §7.2（签名/类型/单份实现/app 适配） |
| 同上（正文 P2 节） | 同上 | P2 = `cordis-host.md` 配置节（单 ns 直传 / 多 ns manager / 裸 `{emitter}` 陷阱 / Hub·Peer 示例）+ `SKILL.md` 路由 | §7.3 |
| 同上（正文 AC） | 同上 | 版本 bump、根 typecheck 与相关包测试全绿 | §11 文件范围（package.json）；§12 验收映射 |

---

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 三臂差分：A 直发落盘 / B 自然组合 0 条 runtime 记录（复现）/ C 显式 `{emitter, runtimeEmitterFor}` 立即落盘 | SA6 §5；`artifacts/sa6-issue393-differential-arms.log` | 缺口边界精确 = log 未自绑定；P0 只补该成员，registry 零改动（§7.1-D4） |
| 双向绿推演：仅实例层注入 identity `runtimeEmitterFor` → R0–R4 4/4 绿 | SA6 §9；`artifacts/sa6-issue393-green-capability.log` | P0 实现路径已被证明充分；设计接口与之逐字一致（§8） |
| 臂 D0：raw log + 第二 ns create → 本流计数 1→2（跨 ns 写入现存缺陷） | 同上 | P0 后其它 ns 解析 undefined → 泵内丢弃，R3 转绿（§7.1-D2；§12） |
| 臂 E：identity binding + shutdown 后 create → `REGISTRY_NOT_ACCEPTING` rejected 恰 1 条落本流；无归属面今天即落盘（legacy 共享通道 = 本流 emitter） | 同上 + SA6 §12.3 理由 5 | AC5 定案「接受落盘」= 保持现状零漂移，非新增行为（§7.1-D5） |
| 臂 G/G2：replication-apply rejected/committed 落盘 | 同上 | runtime 级 emission 共用同一装配（B3/B5）；P0 无需触碰 runtime/replication 包 |
| 契约红灯原因逐条为缺口本身；全量套件其余 392 文件零失败 | SA6 §13；`artifacts/sa6-issue393-full-suite.log` | 实现只需按 §8 落位即可翻转；无需改契约文件（DENY LIST） |
| P1 敏感性：未泛化 manager 在 `{onEvent, now}` 下 `deps.sink is not a function` | SA6 §9（临时 probe，已删） | §7.2 签名泛化 + 既有调用点适配为必改项（含 2 个 app 测试文件） |

上游事实与源码**无矛盾**：SA6 引用的 `file.ts:118/1529`、`create-diagnostic.ts:309-318/417-463/530-541`、
`registry.ts:817-860/2201/2211`、`runtime.ts:740/748`、`replication-session.ts:484-492`、registry
`types.ts:899-903` 全部在本轮直接复核一致（§2 表）。

---

## 6. SA8 约束落实

固定位置无 `task_issue-393_relevant_decisions.md` / `_conflict_report.md`（SA6 §1/§3 同样未携带）。
适用的冻结约束改由下列已读文本承担（本轮直接读取源码 + ADR/AGENTS 治理文本核验）：

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| seam 成员名冻结（#150/#155/#226）：`emitter` / `initStream` / `runtimeEmitterFor`；Runtime 侧 `diagnosticEmitter` + `clock` 成对 | §7.1-D1、§8 | 只使用既有成员名，不发明任何新字段名；P0 使 adapter 满足 #155 已定义的生产供应方契约（registry `types.ts:885-903` 明文「生产供应方（Host 管理器）恒返回良构 emitter」——File adapter 成为第二个生产供应方） | 否（名字零新增） |
| #150 legacy 契约逐字节冻结：裸 `{emitter}` 字面量仍走 legacy 路径 | §7.1-D4、§12 | registry 三态路由零改动；G2 守卫保持绿 | 否 |
| #155「归因键是数据不是时间」 | §7.1-D2 | identity 比较 = 纯字符串数据键控，无时间/顺序状态 | 否 |
| #226/#228 manager 冻结语义：共享 `emitter` 恒 `unattributed` 丢弃 + 计数；retire/close 丢弃桩 | §7.2、§7.1-D5 边界 | P1 只改签名与导出，binding 语义零漂移（P1-R2/R3/R4 守护）；与 P0 自绑定的「接受落盘」边界互补、写死进文档与契约 | **是**（语义二元边界值得 SA8 复核，见 §14） |
| ADR-0011 / ADR-0014-LOG：emit 同步不 throw、best-effort、接线在 write sequencer slot 之外；ADR-0014 amendment「有界同步 append、只移调用点」 | §9 | 自绑定成员是纯闭包解析（零 IO、零 throw）；实际 append 仍由泵 drain 在业务槽外触发（B5 既有机制） | 否 |
| File adapter 冻结面（#152/#153）：`emit` 有界同步 append；manifest 创建后不可变；reopen 三分支 | §7.1-D3、§13 回滚 | 不触碰 schema/manifest/roll/reader 面；resume 路径同一构造产物自绑定（SA6 NDCL R3） | 否 |
| 模块边界：registry 侧诊断装配零导出公共面；NDCL 新成员经 `src/index.ts` 公共面 + 版本 bump 承载 | §11 | NDCL index.ts 无需改动（类型经既有 re-export 流经，B11）；版本 bump 0.1.8→0.1.9 | 否 |
| ADR 0012 / apps AGENTS：app 是组合根、公共导出经 `src/index.ts`、stdout NDJSON 事件面 | §7.2 | manager 导出走 `apps/yjs-server/src/index.ts`；app 事件面（`diagnostic-log*`）词表零变更 | 否 |
| SA8 产物缺失本身 | §14 | 按 skill 纪律标记需要设计后冲突复查 | **是** |

---

## 7. 设计决策与主要备选方案

### 7.1 P0 —— `FileDiagnosticLog` 自绑定（主修复）

**D1：接口成员——required 方法成员，identity 匹配**

`FileDiagnosticLog`（`file.ts:118-131`）新增：

```ts
export interface FileDiagnosticLog {
  emitter: NamespaceDiagnosticChangeEmitter
  readonly streamId: string
  readonly rootDir: string
  readonly namespaceId: string
  /**
   * #393 自绑定：identity 匹配本 namespace 的数据键控解析（#155 生产泵路径成员）。
   * ns === 本 log 的 namespaceId → 本流 emitter；其它 ns → undefined（泵内静默
   * 丢弃——杜绝跨 namespace 写错流）。一切模式（ready/disabled/failed）同一实现
   * （形状完备，J6）：disabled/failed 下返回的 emitter 即构造期照常构造的 silent
   * emitter，emit 经管线后 sink 按 mode 静默——观察面与「泵内丢弃」等价。
   * 纯闭包字符串比较：零 IO、零 throw、零状态。
   */
  runtimeEmitterFor(namespaceId: string): NamespaceDiagnosticChangeEmitter | undefined
  sweepRetention(options?: { now?: number }): RetentionSweepReport
}
```

构造产物字面量（`file.ts:1529-1541`）新增一个闭包成员，与接口声明方法形态兼容：

```ts
const log: FileDiagnosticLog = {
  emitter,
  streamId,
  rootDir: config.rootDir,
  namespaceId,
  runtimeEmitterFor: (ns: string) => (ns === namespaceId ? emitter : undefined),
  sweepRetention: …,
}
```

声明为 **required**（非 optional）：产物在一切构造分支恒提供该成员（形状完备纪律）；
SA6 类型面契约用 optional 目标形态（`FileDiagnosticLog extends { runtimeEmitterFor?: … }`），
required 成员同样满足——两种声明均绿，设计选 required 以诚实表达「恒在场」。
与 seam `NamespaceRegistryDiagnosticLog.runtimeEmitterFor?`（registry `types.ts:902`）结构
兼容：concrete 产品的 required 成员满足 seam 的 optional 成员。

**D2：一切模式统一 identity 解析（含 disabled/failed）**

不自查 mode：disabled/failed 模式下 identity 匹配同样返回构造期 emitter（silent sink）。
SA6 §15-未知 2 已备案两种等价形态；选统一实现的理由：(a) 与 J6「一切模式 emitter 照常
构造」同构，resolver 不引入 mode 耦合分支；(b) 语义上「本 log 是该 ns 的日志对象」与
「流是否可写」正交；(c) 代码最小（单行闭包）。观察面等价：emit → 管线 → mode 静默 sink
→ 零记录、零 throw；与「解析 undefined → 泵内丢弃」不可区分。

**D3：不加 `initStream`**

泵路径对缺席 `initStream` 成员已有 no-op 语义（B6：`create-diagnostic.ts:553` 直接 return；
`pumpInitStream` 可选调用双保险）；File adapter 的 stream 在构造期 eager 建立（B7），
`resumeStreamId` 续写路径同一构造产物（SA6 NDCL R3 锚）。加 `initStream` 反而违反
「per-ns File adapter 进程寿命内一实例」（manager 的 D3 单 writer 语义）并扩大公共面。
G3 守卫（成员缺席）保持绿。

**D4：registry 零改动**

Owner 裁决 + SA6 根因链（B2 探测逻辑已正确）：`readRuntimeEmitterResolver` 非抛读取
`typeof === 'function'` → 自绑定成员在场即路由入泵路径，`resolveRuntimeDiag` 返回 O(1)
wrapper（B5）→ Runtime 侧 `diagnosticEmitter` 到位（B3 链闭合）。本设计不触碰
`packages/namespace-registry/src/**` 与 `packages/namespace-runtime/src/**`。

**D5：AC5 定案——无归属公共入口拒绝：接受落盘（与 SA6 §12.3 一致）**

- **语义**：泵路径下 `emitEarlyOutcome(namespaceId === undefined, …)`（acceptance/identity
  拒绝、namespaceId 生成前，`registry.ts:2201/2211`）经 #226 的同步共享通道
  （`create-diagnostic.ts:530-541`，**现状行为，零改动**）发射；自绑定 `FileDiagnosticLog`
  的共享通道 `emitter` 就是该 ns 自己的流写面 → 记录落本流，且 record 面无 ns 字段、
  不伪造归属。
- **理由**：(1) log 对象按构造即 per-namespace（`namespaceId` + 单 stream），落本流不构成
  跨流写入；(2) 该拒绝类无候选 id，数据键控解析结构性不可用；(3) 丢弃会重演本 issue
  定性的「无错误/零输出」最坏失效模式；(4) 另立丢弃通道成员违反 P0 最小公共面纪律；
  (5) **非新增行为**——SA6 probe 实测今天（legacy 共享通道）即落 1 条
  `namespace-create/REGISTRY_NOT_ACCEPTING` rejected，P0 只补 runtime 级通道，无归属面
  零漂移。
- **边界（互补不冲突）**：该定案仅约束自绑定的 per-namespace `FileDiagnosticLog`；多 ns
  Host 正路 = P1 manager，其共享 `emitter` 保持 `unattributed` 恒丢弃 + 计数（#226/#228
  冻结，P1-R2 守护）。两条语义写进 P2 文档。
- **守护**：registry 契约 R4（`runtimeEmitterFor` 在场判别 + 恰落一次 +
  `result.kind='rejected'`）。

**P0 备选方案与未选原因**：

| 备选 | 未选原因 |
|---|---|
| Host 侧类型收紧 fail-fast（原方案） | Owner comment 5664521867 明确作废；自然用法修复后不存在需响的错误用法 |
| mode 门控 resolver（disabled/failed → undefined） | 见 D2——观察面等价但引入 mode 耦合；无收益 |
| 另立「丢弃上报」成员承载无归属拒绝 | 违反 P0 最小公共面纪律（不加 `initStream` 同理）；且丢弃重演静默失效 |
| registry 侧自动探测 raw log（识别 `namespaceId`/`emitter` 成员组合） | 改动探测逻辑 = 违反 Owner「registry 探测零改动」；且启发式识别比显式成员更脆弱 |

### 7.2 P1 —— `@nomicore/yjs-server` 导出泛化 manager（多 ns Host 正路）

**签名泛化**（`apps/yjs-server/src/diagnostics.ts`）——摆脱 app 本地类型
（`DiagnosticsConfig.enabled` 与 `EventSink` stdout 语义）：

```ts
import type { DiagnosticLogHealthEvent, FileRetentionConfig } from '@nomicore/namespace-diagnostic-log'

/** 泛化配置：无 enabled 标志（是否启用诊断是 Host 组合根的决策，不是 manager 语义）。 */
export interface HostDiagnosticsManagerConfig {
  readonly rootDir: string
  readonly updateCapture?: boolean
  readonly inputPolicy?: 'none' | 'digest' | 'redacted' | 'full'
  readonly retention?: Readonly<FileRetentionConfig> | null | undefined
}

/** manager 事件（既有 app NDJSON 事件形状的类型化公共面；词表/字段零变更）。 */
export type HostDiagnosticsManagerEvent =
  | ({ readonly event: 'diagnostic-log'; readonly namespaceId: string } & DiagnosticLogHealthEvent)
  | { readonly event: 'diagnostic-log-emission-dropped'; readonly reason: DiagnosticEmissionDropReason; readonly namespaceId?: string }
  | { readonly event: 'diagnostic-log-manager-failed'; readonly namespaceId: string; readonly code: string }

export interface HostDiagnosticsManagerDeps {
  /** 事件回调（泛化 sink）：缺席 → 事件静默不上报（流写面照常）；throw → manager 吞没。 */
  readonly onEvent?: (event: HostDiagnosticsManagerEvent) => void
  /** 注入时钟（必需——ADR-0009 禁墙钟 fallback；adapter manifest/genesis/sweep 同源）。 */
  readonly now: () => number
}

export function createHostDiagnosticsManager(
  config: Readonly<HostDiagnosticsManagerConfig>,
  deps: HostDiagnosticsManagerDeps,
): HostDiagnosticsManager
```

要点：

1. **binding / close / retireNamespace 零漂移**：`HostDiagnosticsManager` 接口与实现语义
   （共享 `emitter` 恒 `unattributed` 丢弃+计数；`runtimeEmitterFor` 数据键控；retire →
   `namespace-deleted` 丢弃桩；close → `manager-closed` 丢弃桩）不动——P1-R2/R3/R4 即其
   行为守护。SA6 P1 双向绿推演（泛化镜像实现）已证该签名满足全部断言。
2. **`onEvent` 缺席语义**：事件静默不上报（通用消费者可能只要流写面）；流写面与泵投递
   完全不受影响。内部以单一 `notify` 辅助收口：`try { deps.onEvent?.(e) } catch { /* 吞没 */ }`。
3. **`onEvent` throw 隔离（防御性收紧）**：现状 `deps.sink(...)` 直呼，Host sink throw 会
   沿 emit 栈上抛（registry 侧吞没边界兜底）。泛化为公共 API 后，manager 自身吞没事件
   通道违约（ADR-0011「observability 绝不影响业务结果」的直接落实）——emit 面零 throw
   成为 manager 自身的公共承诺（P1-R2 的零 throw 断言因此不依赖调用方良心）。
4. **retention 类型单源**：引用 NDCL 公共 `FileRetentionConfig`（B11），不再经 app
   `config.ts` 的 `DiagnosticsRetentionConfig`（形状逐字段相同，但后者是 app 本地类型）。
5. **公共导出**（`apps/yjs-server/src/index.ts`）：`export { createHostDiagnosticsManager }
   from './diagnostics.js'` + `export type { HostDiagnosticsManager, HostDiagnosticsManagerConfig,
   HostDiagnosticsManagerDeps, HostDiagnosticsManagerEvent, DiagnosticEmissionDropReason }`。
6. **app 内部消费同一实现（单份）**：`app.ts` 调用点改为泛化形
   `createHostDiagnosticsManager(this.config.diagnostics, { onEvent: this.sink, now: () =>
   requireClock(this.ctx).now() })`——`this.sink`（`EventSink`，接受
   `Readonly<Record<string, unknown>>`）对窄事件参数型安全（逆变放宽）；`this.config.diagnostics`
   （含 `enabled` 的超集对象）结构满足泛化配置（引用传参无 excess-property 检查）。
   `app.ts` 继续 `import … from './diagnostics.js'`：index re-export 的与 app 消费的是
   同一模块符号（全仓一份实现）；不从 `./index.js` 回导（index 已 `export … from './app.js'`，
   反向导入制造 app↔index 循环）。
7. **既有调用点机械适配**（仅调用形状，零断言改动）：§B9 两个 app 测试
   `{ enabled: true, rootDir, … }, { sink: (e) => …, now }` →
   `{ rootDir, … }, { onEvent: (e) => …, now }`（SA6 probe 实测未适配即
   `deps.sink is not a function`）。`config.ts` 的 `DiagnosticsConfig`（含 `enabled`）
   保持不动——它是 app 配置面，enabled 属 app 决策。

**P1 备选方案**：把泛化 manager 上移到独立包（如 `@nomicore/host-diagnostics`）——未选：
超出 issue 裁决范围（「从 index.ts 导出」），引入新包/发布面成本；yjs-server 已是
Hub/Peer 组合根公共面的事实载体（`createNodeHubListenAdapter` 先例）。

### 7.3 P2 —— skill 诊断日志配置节与路由

**`cordis-host.md`**：新增二级节「## 诊断日志（Diagnostic change log）」（置于 Process
之后、Guardrails 之前；标题含「诊断日志」满足 P2-R1 节定位），内容四要素：

1. **单 ns 正路（P0 后）**：`const log = createFileDiagnosticLog({ rootDir, namespaceId, … })`
   → `createNamespaceRegistryPlugin(config, { diagnosticLog: log })`——产物直传即完整正路
   （自绑定 `runtimeEmitterFor`；runtime 级 root-mutation / replication-apply 记录落
   `segments/`）；注记「P0 前的既有直传接线升级包版本 + 重启即恢复，无需改 Host 代码」。
2. **多 ns 正路**：`import { createHostDiagnosticsManager } from '@nomicore/yjs-server'` →
   传 `manager.binding`；生命周期义务（namespace 删除工作流先 `retireNamespace(ns)`；
   停机链诊断 O(1) `close()`——与 yjs-server AGENTS 单一停机链次序一致）。
3. **裸 `{emitter}` 陷阱**：手写 `{ emitter }` 字面量 = #150 legacy 冻结形状——只记 create
   尝试、runtime 级记录结构性缺席、**零错误零警告**（本 issue 的失效模式本体）；正确修法
   不是加 observer，而是换上述两条正路之一。
4. **无归属语义边界 + Hub/Peer 组合根示例**：单 ns 自绑定 log 的无归属公共入口拒绝
   （如 shutdown 后 create 的 `REGISTRY_NOT_ACCEPTING`）落本流（单 ns 可解释语义）；
   多 ns manager 的共享通道恒 `unattributed` 丢弃+计数——不要混用两种形状。附 Hub 与
   Peer 两个最小组合根片段（含 `{ diagnosticLog }` 注入位置）。
   Process 第 5 步（`cordis-host.md:14`）补一句指向该节。

**`SKILL.md`**：路由行（L16）扩为「…Registry、namespace 创建/open、**namespace 诊断日志
（diagnostic change log）/observability 配置**、role-specific replication plugins, or
shutdown: read cordis-host.md」——满足 P2-R2（含 cordis-host.md 的行 + 诊断日志/observability
措辞）。不新开分支文件：诊断日志配置属 Cordis host 组合根事务，与 Guardrail「不发明
startNomicoreHubRuntime 类 helper」一致的正路文档化。

---

## 8. 接口、状态机和数据流

### 8.1 接口 diff 汇总

| 面 | 变更 | 兼容性 |
|---|---|---|
| NDCL `FileDiagnosticLog`（公共类型） | +`runtimeEmitterFor(namespaceId): emitter \| undefined`（required；§7.1-D1） | 纯增量；消费方按 `{emitter}` 字面量注入 registry 的既有用法零影响（结构子集）；registry seam 零改动即路由入泵 |
| NDCL 构造产物（运行时） | `createFileLog` 产物字面量 +1 闭包成员（一切模式，§7.1-D2） | `FILE_INTERNAL` 符号与既有成员零漂移；无枚举成员集的测试（已核 `Object.keys(log)` 类断言为零） |
| yjs-server 公共入口 | +`createHostDiagnosticsManager` + 4 个类型导出（§7.2-5） | 纯增量导出 |
| `createHostDiagnosticsManager` 签名 | 配置去 `enabled`（超集传入仍合法）；deps `{sink}` → `{onEvent?}`；`now` 保持必需 | 破坏性仅限**仓内 3 个调用点**（app.ts + 2 测试，§7.2-6/7 已列机械适配）；外部无消费者（此前未导出） |
| registry / runtime / replication-protocol / ws-replication 公共面 | **零改动** | — |

### 8.2 装配路由状态机（P0 后，registry 侧零改动、三态不变）

| `diagnosticLog` 形状 | `createDiagRuntime` 路由 | 可观察结果 |
|---|---|---|
| 缺席 / emitter 畸形 | no-op diag + undefined 解析器 | 零日志（既有） |
| `{ emitter }` 字面量（legacy，#150） | legacy：共享 emitter 直发 | 仅 create 尝试；G2 守卫（零漂移） |
| **raw `FileDiagnosticLog`（P0 后自然组合）** 或显式/manager binding（有 `runtimeEmitterFor`） | **#226 泵路径**：槽内 O(1) 入队 → macrotask drain → identity 解析 → 本 ns 落盘 / 其它 ns 静默丢弃；无归属（`namespaceId===undefined`）恒同步共享通道 | runtime 级记录落 segments；无跨 ns 写入；无归属拒绝落本流（D5） |

### 8.3 数据流路线（P0 改变的运行时数据路径）

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| ① runtime 级 emission（root-mutation / schema-replacement / replication-enable / replication-epoch-bump / replication-apply） | Runtime write slot / replication session `applyRemoteUpdate`（`runtime.ts:740-818`、`replication-session.ts:489-496`）；输入 = 已组装 `NamespaceDiagnosticChangeEmission` | 无（捕获点纯内存入队） | `diagEnv.emitter.emit`（= registry O(1) wrapper）→ `enqueueEmit(ns, emission)` 跨 registry/NDCL 包边界（纯数据，无引用共享——emission 为 plain snapshot） | per-ns 泵队列（≤256，FIFO）→ `setImmediate` drain → `resolveEmitterOnce`（identity 匹配）→ File emitter 管线 → `appendSemantic` 有界同步 append | `segments/{seg}.jsonl`（NDCL 单进程独占根目录，ADR-0014 §Writer） | `readStreamStrict` 回读：本 ns `root-mutation`/`replication-apply` committed/rejected 记录 | drain 内解析违约/emitter throw → 吞没（B5 边界）；满队 drop-newest + `diag-pump-drop`（observer 缺席时静默——issue 已裁定独立处理） | registry 契约 R1/R2；NDCL R2 |
| ② 无归属公共入口拒绝 | registry `create` 停接纳/identity 拒绝（`registry.ts:2201/2211`） | 同步共享通道 `emitAttempt(emitter, …)` | 组装（issues 投影 throw → 丢该条）→ File emitter 管线（#150 既有路径） | 同步 append 本流 | 同① | 本流恰 1 条 `namespace-create` rejected 记录（record 面无 ns 字段） | emitter throw → registry 吞没（AC4 锚） | registry 契约 R4；臂 E |
| ③ 其它候选 ns 的 emission/create 结局 | 同 ns 的 create/open 流量经同一 registry 实例 | 泵入队（create 结局）或共享通道（legacy 不再触达） | drain 内 `resolver(otherNs) === undefined` | **无写入**（队列任务丢弃） | — | 本流记录数不变（跨 ns 写入缺陷消除） | 静默丢弃（单 ns 日志的诚实语义；D11/i1 边界） | registry 契约 R3；臂 D vs D0 |
| ④ manager 事件（P1） | adapter observer / drop 桩 / manager 防御 | 无 | `notify(e)` → `deps.onEvent?.` | 无持久化（Host 回调） | Host 消费 | `diagnostic-log*` 事件序列（词表零变更） | onEvent throw → manager 吞没（§7.2-3）；缺席 → 静默 | P1-R2/R3/R4 |
| ⑤ P0 不改变的面 | manifest/current.json 创建、genesis、roll、retention、strict reader、record schema、wire/复制协议 | — | — | — | — | 逐字节现状 | — | 既有全套件（#150/#153/#154/#227 等） |

### 8.4 P2 数据流

无运行时数据流变化（纯文档交付；P2 断言即文档内容契约——SA6 §12.4 已论证交付物本体
即文档时不存在可运行行为面）。

---

## 9. 错误、恢复、并发和幂等

- **emit / resolver 零 throw**：`runtimeEmitterFor` 是纯闭包字符串比较（无 IO、无属性
  读取外部对象、无 throw 路径）；实际 append 的同步 throw 风险仍由泵 drain 的逐任务
  try/catch（B5）与 emitter 管线（ADR-0011 接口契约）既有边界收编——P0 不新增任何
  可 throw 面。
- **并发与竞态**：identity 比较无状态、无顺序依赖（#155「归因键是数据不是时间」）；
  per-ns FIFO 与单飞 drain 由既有泵保证（#249）；自绑定成员在构造期一次成型，此后
  只读闭包——无并发面。
- **幂等**：`runtimeEmitterFor(ns)` 多次调用恒返回同一 `emitter` 实例（闭包捕获）；
  registry 构造期一次读取后缓存 resolver 引用——重复解析零额外成本。
- **恢复/回滚**：P0/P1 全部为代码增量，无持久化格式、schema、wire 变化——回滚 = revert
  提交。P0 期间写入的 record 与 P0 前同 schema（`recordVersion:1` 不变），旧版本读者
  可读（回滚不产生不可读日志）。部署回滚路径：tarball 回退 + 重启（与生效路径对称）。
- **失败诚实性**：无新增静默 fallback。P0 消除的是「静默半工作」本身；保留的静默点
  （泵内其它 ns 丢弃、无归属面落盘）均为显式定案语义并有契约锚（R3/R4）+ 文档（P2）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| DSH `nomicore-host`（仓外，Hub 侧 `src/index.ts:173-185`） | raw log 直传 → legacy 回落 → 零 runtime 记录 | 同一接线 → 泵路径 → 记录落盘 | **零代码改动**（升级 NDCL 版本 + 重启；仓外验证，见 §13-R6） | issue 正文；SA6 §10 部署面 |
| DSH `mabf-runner`（仓外，Peer 侧 `src/nomicore-runtime.ts:75-85`） | 同上 | 同上（replication-apply 落盘） | 零代码改动 | 同上 |
| registry `createDiagRuntime` | 非抛探测 optional 成员 | 同一二进制行为：成员在场 → 泵路径 | 零改动（DENY） | `create-diagnostic.ts:309-318/391-417` |
| Runtime / replication session（`diagnosticEmitter` 消费） | emitter 缺席 → no-op | emitter 在场 → 发射（既有代码路径，仅环境变化） | 零改动（DENY） | `runtime.ts:547/740-818/880` |
| yjs-server `app.ts:278-284` | 旧签名 `{sink, now}` + 全量 `DiagnosticsConfig` | 泛化签名 `{onEvent: this.sink, now}` | 调用点 deps 键名适配（§7.2-6） | B9 |
| yjs-server 测试 `diagnostic-replay-host-lifecycle-sa7.test.ts:171-175` | 旧签名构造 manager | 泛化签名（`{rootDir,…}` + `{onEvent, now}`） | 机械适配（零断言改动；ALLOW） | B9；SA6 P1 敏感性 probe |
| yjs-server 测试 `host-diagnostics-retirement-sa7-228.test.ts:75-77/135-137` | 同上 | 同上 | 机械适配（ALLOW） | B9 |
| 以 `{emitter: log.emitter}` 字面量注入的既有 #150 契约测试 | legacy 路径 | legacy 路径（零漂移） | 零改动（DENY——G2 守卫） | SA6 §6 G2；`registry-create-diagnostic-red.test.ts` 等五套 |
| NDCL memory adapter 消费者 | `{emitter}` 形状 | 不变（无自绑定；非目标） | 零改动 | `adapters/memory.ts`；§1 非目标 |
| skill 消费者（独立项目 Host 作者） | 无诊断日志配置指引（易落裸 `{emitter}` 陷阱） | 单 ns / 多 ns 正路 + 陷阱说明 | 文档新增（§7.3） | B10 |

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/namespace-diagnostic-log/src/adapters/file.ts` | `FileDiagnosticLog` 接口 + 构造产物字面量 + JSDoc（§7.1-D1/D2） | P0 主修复唯一实现面 |
| `packages/namespace-diagnostic-log/package.json` | version `0.1.8` → `0.1.9`（minor 增量） | AC：公共面变化版本 bump |
| `apps/yjs-server/src/diagnostics.ts` | 签名泛化 + `HostDiagnosticsManagerConfig/Event/Deps` 类型 + `notify` 收口（§7.2-1/2/3/4） | P1 泛化与单份实现载体 |
| `apps/yjs-server/src/index.ts` | +`createHostDiagnosticsManager` 与 4 个类型导出（§7.2-5） | P1 公共入口（P1-R1） |
| `apps/yjs-server/src/app.ts` | manager 调用点 deps 适配 `{onEvent, now}`（§7.2-6） | P1「app 内部消费同一导出」 |
| `apps/yjs-server/test/diagnostic-replay-host-lifecycle-sa7.test.ts` | 调用形状机械适配（`makeHost`，零断言改动） | 签名泛化的必然后果（B9） |
| `apps/yjs-server/test/host-diagnostics-retirement-sa7-228.test.ts` | 同上（两处调用） | 同上 |
| `.agents/skills/nomicore/cordis-host.md` | 新增「## 诊断日志」节 + Process 第 5 步交叉引用（§7.3） | P2-R1 |
| `.agents/skills/nomicore/SKILL.md` | 路由行 L16 扩诊断日志/observability 措辞（§7.3） | P2-R2 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/namespace-registry/src/**`（含 `create-diagnostic.ts`、`diag-pump.ts`、`registry.ts`、`types.ts`） | 探测/路由/泵本体 | Owner 裁决「registry 探测逻辑零改动」；seam 成员名冻结（#150/#155/#226） |
| `packages/namespace-runtime/src/**` | runtime 级发射消费方 | 既有代码路径按环境变化即可工作（G4 已证装配面可用） |
| `packages/namespace-diagnostic-log/test/issue-393-file-log-runtime-emitter-for-red.test.ts`、`…-surface.test-d.ts` | SA6 红灯契约（本票） | SA6 owned——改实现不改测试断言（包 AGENTS） |
| `packages/namespace-registry/test/issue-393-ndcl-self-binding-red.test.ts` | 同上 | 同上 |
| `apps/yjs-server/test/issue-393-manager-export-and-skill-docs-red.test.ts` | 同上 | 同上 |
| `packages/namespace-diagnostic-log/src/index.ts` | 公共面 re-export | 无需改动：`FileDiagnosticLog` 类型经既有导出流经新成员（B11） |
| `packages/namespace-diagnostic-log/src/{schema.ts,record.ts,health.ts,pipeline.ts,emission.ts,reader.ts,retention.ts,read-session.ts}` | 冻结面 | record schema 指纹钉死、健康事件白名单、storage 语义零触碰 |
| `packages/namespace-diagnostic-log/src/adapters/memory.ts` | memory adapter | 非目标（§1）；测试用途面 |
| `docs/adr/**` | 决策冻结源 | 本设计不修订任何 ADR 文本 |
| `CONTEXT.md` | 域文档 | 无词表/reason 演进；`FileDiagnosticLog` 面未在 CONTEXT.md 记载（已核 grep 零命中） |
| `apps/yjs-server/src/config.ts`、`apps/yjs-server/src/lifecycle.ts` | app 配置/事件面 | `DiagnosticsConfig.enabled` 与 `EventSink` 保持 app 本地（§7.2-4/7） |
| `artifacts/sa6-issue393-*.log` | SA6 证据 | 不可变证据 |
| `wiki/raw/task_issue-393*.md` | Host/SA6 输入与本设计产物 | Host-owned / 本设计为唯一 SA1 写入面 |

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1：`runtimeEmitterFor` identity 匹配；自然组合 → root-mutation 落盘（B 臂转正） | SA6 R0/R1 红（`artifacts/sa6-issue393-red-contracts.log`）；双向绿推演（`…green-capability.log`） | `packages/namespace-registry/test/issue-393-ndcl-self-binding-red.test.ts` R0/R1（已存在，实现后复跑） | R0/R1 绿：resolver 函数、`resolver(ns)===log.emitter`、`resolver(otherNs)===undefined`；本 ns 流 ≥1 条 `root-mutation` committed |
| AC2：replication apply 落盘 | SA6 R2 红；臂 G/G2 | 同文件 R2 | `replication-apply`（含 committed）落本流 |
| AC3：#150 legacy 契约零漂移 | 基线五套 55/55 绿（`…baseline-registry.log`）+ G2 绿锚 | 同文件 G2 + 既有 `registry-create-diagnostic-red/sa7-dynamic` 等五套复跑 | 裸 `{emitter}`：恰 1 条 create、0 条 runtime 记录；五套全绿 |
| AC4（AC 列表第 4 条）：其它 ns 不落本流 | 臂 D vs D0；R3 红（1→2） | 同文件 R3 | 第二 ns create 前后本流记录数不变 |
| AC5：无归属拒绝落盘语义显式定案 + 契约 | 臂 E；SA6 §12.3 定案（接受落盘） | 同文件 R4 | `runtimeEmitterFor` 在场 + shutdown 后 create → 恰 1 条 `REGISTRY_NOT_ACCEPTING` rejected 落本流 |
| P0 适配器边界（含 resume 自绑定、不加 initStream、emitter 零漂移） | SA6 NDCL R1–R3 红、G1/G2 绿 | `packages/namespace-diagnostic-log/test/issue-393-file-log-runtime-emitter-for-red.test.ts` + `…surface.test-d.ts` 复跑 | 全绿（类型面 `HasSelfBinding=true`，G 守卫保持） |
| P1：导出 + 泛化 + 多 ns 路由 + 丢弃语义 | SA6 P1-R1…R4 红；敏感性/双向绿 probe | `apps/yjs-server/test/issue-393-manager-export-and-skill-docs-red.test.ts` 复跑 | P1-R1…R4 绿：`{onEvent, now}` 无 throw、ns-a 恰 1 条 root-mutation、`unattributed`/`manager-closed`/`namespace-deleted` 上报齐备 |
| P1 破坏面收敛：app + 既有测试调用点 | B9（3 处调用点） | `vitest run apps/yjs-server/test` + `tsc -p apps/yjs-server/tsconfig.json` | 既有套件零回归（含 `host-diagnostics-*`、`diagnostic-replay-*`） |
| P2：文档交付物 | SA6 P2-R1/R2 红 | 同 P1 契约文件 P2 段 | cordis-host.md 节含四要素；SKILL.md 路由行命中 |
| AC 完成门禁 | 全量套件修复前 `4 failed/392 passed`（`…full-suite.log`） | 根 `pnpm typecheck` + `pnpm test`（含 `--typecheck` 面） | 本票 4 契约文件全绿、15 红→0、守卫 6/6 绿、既有 392 文件零失败 |
| 版本 bump | `package.json` 0.1.8 | `git diff` 核验（发布评审门，非测试断言） | NDCL 0.1.9；yjs-server 版本是否随公共导出 bump 由发布评审定（AC 仅强制 NDCL） |
| DSH 零改动恢复 | issue 正文「下个 tarball 批次 + 重启」 | 仓外验证（不在本 worktree 可证范围，§13-R6） | 部署方日志恢复 |

SA1 不执行测试；上表「已存在」契约由实现角色复跑翻转，「建议」无新增（SA6 契约已全覆盖
本设计面——这也是设计以契约为验收载体的依据）。

---

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 定性 | 处置 |
|---|---|---|---|
| R1 | AC5 语义二元性（自绑定 log 接受无归属落盘 vs manager 恒丢弃）被误推广 | 低（两条正路各有契约+文档锚） | P2 文档显式写边界；§14 标记 SA8 复核 |
| R2 | P1 签名破坏仓内调用点 | 低（已穷尽：app.ts + 2 测试；外部无消费者） | ALLOW LIST 机械适配 + app 套件回归 |
| R3 | `notify` 吞没 onEvent throw 与现状（沿栈上抛由 registry 吞）行为差异 | 极低（观测面收紧，业务面无差） | §7.2-3 已述；P1-R2 零 throw 断言守护 |
| R4 | 泵满队丢弃在生产 Host 不可见（`diag-pump-drop` 需 observer） | 已知（issue 明文弱化、独立处理） | follow-up 票（不在本任务伪装解决） |
| R5 | memory adapter 无自绑定（直传仍 legacy） | 非目标（测试用途面，无生产直传消费者） | 残余备案；如后续需要另开票（同样模式） |
| R6 | DSH 零改动恢复 + 重启生效为仓外事实 | 部署面验证 | 不可在本 worktree 证明；设计已保证装配期生效路径（§8.2） |
| R7 | yjs-server 公共导出后成为第三方依赖面（版本承诺） | 低 | 版本 bump 决策留发布评审（§12） |
| R8 | 回滚安全性 | 无格式/schema/wire 变化 | §9 回滚段；旧读者可读新记录 |

任务内必要条件均已覆盖（无未解决的必要条件伪装为 follow-up；R4/R5/R6 为显式非目标或
已裁定独立处理项）。

---

## 14. 是否需要设计后 ADR 冲突复查及理由

**需要（`requiresConflictRecheck: true`）**。理由：

1. **SA8 产物缺失**：固定位置无 `task_issue-393_relevant_decisions.md` /
   `_conflict_report.md`——本设计的冻结面核对（§6）由 SA1 直接读 ADR/源码完成，未经
   SA8 独立裁决，按纪律应标记复查。
2. **公共 API 变化**：NDCL `FileDiagnosticLog` 增量成员 + yjs-server 新公共导出——属
   「公共API变化」类。
3. **AC5 定案的语义边界**：自绑定 per-ns log「接受落盘」与 #226/#228 manager
   「`unattributed` 恒丢弃」构成并存的两条受支持语义；设计判定互补不冲突（§7.1-D5），
   但该判定触及 #226/#228 冻结语义的解释边界，值得 SA8 复核确认非决策修订。

明确**不需要**复查的面：seam 成员名（零新增）、record schema/manifest/wire（零触碰）、
registry 三态路由与 legacy 逐字节行为（零改动）、ADR 文本（零修订）。

---

## 15. 评审修订映射

`wiki/raw/task_issue-393_sa2_review.md` 不存在（iteration 0，无评审输入）——本节留空；
出现评审输入后按 skill §10 逐条落实并回填。
