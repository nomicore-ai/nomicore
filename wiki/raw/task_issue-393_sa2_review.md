# SA2 设计攻击评审 — Issue #393：FileDiagnosticLog 自绑定（P0）+ manager 泛化导出（P1）+ skill 文档（P2）

- 评审人：SA2（attack-design）；日期：2026-09-14；worktree：`/home/wangjian/nomicore-fix-issue-393`（HEAD `dcb3766`，与设计/SA6/SA8 报告一致）
- 被审对象：`wiki/raw/task_issue-393_design.md`（SA1 设计，iteration 0，§15 确认无前序评审输入）
- 评审方法：全部关键锚点（设计 §2 B1–B12、§5 上游事实表、SA8 §2 事实锚点）本轮**直接对源码复核**，非转引；4 个 SA6 红灯契约文件逐行阅读；仓内调用面全量 grep。

---

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| 任务简报（issue 正文 + AC + comment 5664521867） | `wiki/raw/task_issue-393.md` | 存在，已读 |
| SA1 设计 | `wiki/raw/task_issue-393_design.md` | 存在，已读（505 行） |
| SA6 诊断与验收契约 | `wiki/raw/task_issue-393_sa6_contract.md` | 存在，已读（approve；4 契约文件 + 10 份证据 log 经 `git status` 核实在 worktree） |
| SA8 前置产物 `_relevant_decisions.md` / `_conflict_report.md` | `wiki/raw/` | **不存在**（设计 §6/SA6 §3/SA8 报告 §2 一致确认）——冻结约束改由 SA8 **设计后**冲突报告承担 |
| SA8 设计后冲突复查报告 | `wiki/raw/task_issue-393_design_conflict_report.md` | 存在，已读（verdict `clear`；§2 收编决策摘录职能） |
| 源码/治理文本 | `file.ts` / `create-diagnostic.ts` / `diag-pump.ts` / `registry.ts` / `types.ts` / `runtime.ts` / `replication-session.ts` / `diagnostics.ts` / `index.ts`（yjs-server）/ `app.ts` / `config.ts` / `lifecycle.ts` / `health.ts` / `retention.ts` / 两个 app 测试 / `cordis-host.md` / `SKILL.md` / `cordis-plugin-hosting.md` / NDCL+registry AGENTS / `tsconfig.base.json` | 已读，锚点逐条复核 |

固定输入中唯一缺失项（前置 SA8 产物）已有补位裁决（SA8 设计后报告，`clear`），不构成无法判断安全性的缺口。

## 2. Verdict

**approve**

- 无 BLOCKER、无 MAJOR。设计可安全实施。
- P0 形状与 Owner comment 5664521867 逐字一致（identity 公式、registry 零改动、不加 `initStream`、类型收紧作废）；AC5「接受落盘」定案与 issue 倾向、SA6 §12.3、R4 契约、SA8 §3 裁定四方一致。
- 设计引用的 12 组事实锚点（B1–B12）全部经本轮独立复核为**准确**（见 §5/§9 表）；关键回归安全前提（仓内无 raw log 直传既有测试、无 log 形状枚举断言、构造产物单一字面量点）经全量 grep 独立证实。
- 4 条 MINOR 观察见 §14，均不阻断。

---

## 3. 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| P0：`FileDiagnosticLog` 增 `runtimeEmitterFor` identity 匹配成员；registry 探测零改动 | §1 目标 1；§7.1-D1/D2/D4；§8.1 | ✅ 成员公式 `ns === namespaceId ? emitter : undefined` 与 issue 正文逐字一致；§8.2 路由表证明 registry 三态零改动下自然组合入泵路径 |
| P0：不加 `initStream`（缺席 no-op；stream 构造期 eager 建立） | §7.1-D3（非目标 + B6/B7 依据） | ✅ `create-diagnostic.ts:552-554` 缺席 no-op、`file.ts:1458-1503` 构造期建流均复核属实；G3 守卫锚定 |
| P0：其他 ns 解析 undefined → 泵内丢弃（无跨 ns 写入） | §7.1-D2；§8.3 路线③；R3 映射 | ✅ `diag-pump.ts:134-139` drain 内 resolver undefined → 静默丢弃复核属实 |
| P0：DSH 两部署零代码改动（tarball + 重启） | §10 调用方矩阵前两行；§13-R6 | ✅ 仓外面诚实标记不可本 worktree 证明，未伪装解决 |
| AC5：无归属公共入口拒绝落盘语义显式定案 + 契约测试 | §7.1-D5（定案：接受落盘 + 5 条理由 + 边界）；§12 R4 | ✅ 见 §6 专项核查 |
| P1：`@nomicore/yjs-server` 导出泛化 manager（去 `enabled`/`EventSink` 本地语义）；app 内部消费同一导出 | §7.2（签名/类型/notify 收口/单份实现/app 适配）；§10 | ✅ 泛化签名与 issue P1 节措辞对应；单份实现经「app.ts 继续从 `./diagnostics.js` 导入 + index 同源 re-export」兑现且规避 app↔index 循环（index.ts 现状 `export … from './app.js'` 复核属实） |
| P2：`cordis-host.md` 配置节（单 ns/多 ns/裸 `{emitter}` 陷阱/Hub·Peer 示例）+ `SKILL.md` 路由 | §7.3 | ✅ 四要素与 issue P2 节逐项对应；断言可满足性见 §12 |
| AC：NDCL 版本 bump、根 typecheck + 相关包测试全绿 | §11（package.json 0.1.8→0.1.9）；§12 完成门禁 | ✅ 0.1.8 现值复核属实；yjs-server 版本决策留发布评审（R7）与 AC 仅强制 NDCL 一致 |
| 非目标不静默扩大 | §1 非目标（6 项） | ✅ 与 issue 明文裁定的独立处理项/非目标一一对应，无伪装解决（R4/R5/R6 处置诚实） |

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| 5664521867（OWNER，裁决记录） | 2026-09-14T13:12:42Z | §4 映射表（8 行）+ §7.1/§7.2/§7.3 | ✅ 逐条核对完整：自然组合必须工作（主契约载体 = raw log 直传，SA6 R1–R4，非 manager-binding 主路径）；P0 identity 公式逐字一致；不加 initStream；类型收紧 fail-fast 作废（设计通篇与 4 契约文件均无类型拒绝断言——本轮复核属实）；P1 降级为多 ns 正路；P2 文档；AC5 显式定案入契约测试 |
| （映射完整性） | — | §4 第 2 列含 Comment ID + updated_at | ✅ 满足 skill 映射纪律 |

owner 要求的核心命题——「direct `createFileDiagnosticLog(...)` → `diagnosticLog` 必须经 identity 匹配 FileDiagnosticLog 自绑定支持，而非 configuration blame 或 fail-fast 收紧」——设计 §1 目标 1、§7.1-D1/D4、§8.2 路由表第 3 行、§7.1 备选表第 1 行（fail-fast 明确列为 Owner 作废）共同兑现，无残留的「配置错误」定性措辞。

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| B1 `FileDiagnosticLog` 现成员无 `runtimeEmitterFor`（`file.ts:118-131` 接口 / `:1529-1541` 产物） | §7.1-D1 增成员 | ✅ 复核属实；产物字面量为**单一构造点**（`:1544` 唯一 return），增一处成员即覆盖一切模式（J6 形状完备在 `:1517-1527`）——设计的「一切构造分支恒提供」是结构事实 |
| B2 三态路由 + 非抛探测（`create-diagnostic.ts:309-318/391-417`） | §7.1-D4 registry 零改动 | ✅ 复核属实：`typeof candidate === 'function'` 探测在场成员即入泵路径 |
| B3 legacy `resolveRuntimeDiag` 恒 undefined → Runtime 无 `diagnosticEmitter` → 全部 runtime 发射点 no-op | §3 根因链第 2/3 步 | ✅ `runtime.ts:547/750/876-884`、`replication-session.ts:487-496` 复核属实 |
| B4 跨 ns 写入现存缺陷（其它候选 ns 的 create 记录落本流） | §8.3 路线③；R3 | ✅ legacy `emitOutcome` 忽略 namespaceId 直发共享 emitter（`:425-427`）复核属实 |
| B5 泵 O(1) wrapper / per-ns FIFO / 容量 256 / drop-newest | §8.3 路线①；§9 | ✅ `DIAG_PUMP_MAX_QUEUE_PER_NAMESPACE = 256`（`diag-pump.ts:119`）、单飞 drain（`:171-181`）复核属实 |
| B6 `initStream` 缺席 no-op + 无归属恒走同步共享通道 | §7.1-D3/D5 | ✅ `create-diagnostic.ts:552-554/530-541`、`registry.ts:2201/2211` 复核属实 |
| B7 一切模式形状完备返回（emitter 照常构造） | §7.1-D2 | ✅ `file.ts:1517-1527` 复核属实；disabled/failed 下 resolver 返回 silent emitter 与「泵内丢弃」观察面等价（SA6 §15-未知 2 备案两形态，设计选统一实现并给理由） |
| B8/B9 manager 现签名（`DiagnosticsConfig`+`EventSink`）与 3 个仓内调用点 | §7.2；§10 | ✅ `diagnostics.ts:80-83`、`app.ts:278-284`、两个 app 测试 `:171-175`/`:75-77,135-137` 旧签名复核属实；破坏面穷尽（外部无消费者——index 现无 diagnostics 导出，复核属实） |
| B10 skill 文档现状 | §7.3 | ✅ `cordis-host.md` Process 第 5 步（`:14`）、`SKILL.md:16` 路由行无诊断措辞复核属实 |
| B11 NDCL `FileRetentionConfig` 已公共导出、`FileDiagnosticLog` 经 index re-export | §7.2-4；§8.1 | ✅ `index.ts:71-74/90` 复核属实——新成员自动流经公共面，index 零改动成立 |
| B12 SA6 契约在 worktree、全量 4 failed/392 passed | §12 | ✅ 4 契约文件 + 10 log 经 `git status` 核实；`full-suite.log` 尾部 `4 failed | 392 passed`、`15 failed | 4737 passed`、`Type Errors 1 failed` 与设计引用一致 |
| SA8 冻结面（seam 成员名 / legacy 逐字节 / record schema / manager 丢弃语义 / ADR 文本） | §6 表 9 行 + §11 DENY | ✅ 设计承诺与 SA8 §5 表逐项对应；本轮复核 seam `types.ts:899-903`、legacy `:419-463`、manager binding 语义（`diagnostics.ts:145-187`）现状与「零漂移承诺」前提相符 |
| SA8 §8-b 实现期核对清单 | 设计 §11/§12 已内建（DENY + 完成门禁） | ✅ 无遗漏 |

上游事实与源码**无矛盾**：设计的全部锚点行号/符号本轮独立复核一致（含 SA6 引用的同批锚点）。

## 6. 设计内部一致性

- 正文 §7.1-D1（required 方法成员 + 产物闭包成员）与 §8.1 接口 diff、§8.2 路由表、§12 验收映射相互一致；与 SA6 类型面契约（optional 目标形态 `FileDiagnosticLog extends { runtimeEmitterFor?: ResolverShape }`，`surface.test-d.ts:20` 复核）兼容——required 成员满足 optional 目标，设计的 required 选择有明确理由（形状完备纪律的诚实表达）。
- D5「接受落盘」的论证链自洽且被三方独立文本交叉印证：issue 正文「倾向接受落盘」→ SA6 §12.3（5 条理由 + legacy 现状实测）→ 设计 §7.1-D5（引用同一实测）→ R4 契约（`issue-393-ndcl-self-binding-red.test.ts:271-302` 头注写死定案与边界）→ SA8 §3（ADR-0011 L125「acceptance 前拒绝在对应公共入口记录」支持记录方向；语义二元边界裁定互补不冲突）。无「附录承认但正文未改」式伪修订。
- 非目标（不加 `initStream`、不动 registry、不做类型收紧）与 §7.1 备选表、§11 DENY、§12 断言面（无类型拒绝断言）一致。
- 唯一发现的不一致为计数性笔误（见 §14-O2：§7.2-5「4 个类型导出」实列 5 个名称），不影响实施。

## 7. 状态机与并发攻击

装配路由状态机（§8.2）为既有三态、P0 仅迁移 raw log 的落点；本轮攻击未发现设计缺口：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| S1 | raw log 直传（P0 后） | 本 ns root-mutation / replication-apply | 槽内 O(1) 入队 → macrotask drain → identity 解析命中 → append 本流 | 无（`resolveRuntimeDiag` wrapper `create-diagnostic.ts:577-584` + `diag-pump.ts` 单飞 drain 复核；SA6 双向绿推演 4/4 佐证） | 无 |
| S2 | 同上 | **其它候选 ns** 的 create/emission | resolver(otherNs)=undefined → drain 内静默丢弃，本流计数不变 | 无（R3 契约 + 臂 D 佐证；legacy 跨 ns 写入缺陷 B4 同步消除） | 无 |
| S3 | pump 路径 | namespaceId 生成前的公共入口拒绝（停接纳/identity） | 恒同步共享通道（不经泵）→ 自绑定 log 的共享 emitter = 本流写面 → 恰 1 条 rejected 落本流 | 无（`registry.ts:2201/2211` + `create-diagnostic.ts:533-536` 复核；R4 守护） | 无 |
| S4 | disabled/failed 模式 log 直传 | 本 ns emission | resolver 返回 silent emitter → 管线 → sink 按 mode 静默 → 零记录零 throw | 无（D2 统一实现；观察面与泵内丢弃不可区分——SA6 §15-未知 2 备案） | 无 |
| S5 | drain 期间新入队（同 ns） | burst | 单飞 drain 同轮继续消费，FIFO 保序 | 无（既有 #249 泵结构，P0 零触碰） | 无 |
| S6 | shutdown 后迟到泵任务 | resolver 仍命中（log 流仍存活） | 迟到记录落本流（#226/#228 既有语义，泵与 shutdown 零耦合） | 无（非 P0 引入；对所有 binding 形状一致） | 无 |
| S7 | 进程内已构造 Runtime（升级不重启） | — | 不回溯补挂（自绑定装配期成立） | 无（§1 非目标显式声明；DSH 走重启路径；SA6 §15-未知 1 备案） | 无 |
| S8 | 重复调用 `runtimeEmitterFor(ns)` | — | 闭包捕获恒返回同一 emitter 实例 | 无（§9 幂等声明与实现形状一致） | 无 |

identity 比较无状态、无时间键（#155「归因键是数据不是时间」合规——纯字符串比较复核），未发现竞态面。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E1 | resolver 返回后 emitter 同步 throw（append 失败） | 泵 drain 逐任务 try/catch 吞没（`diag-pump.ts:129-146`）；业务零影响 | 无缺口（既有边界，P0 零新增 throw 面——新成员纯闭包零 IO） | 无 |
| E2 | 共享通道 emitter throw（无归属拒绝落盘时） | `emitAttempt` 吞没（`create-diagnostic.ts:296-303` 复核，AC4 锚） | 无缺口 | 无 |
| E3 | issues 投影 throw | `assembleEmission` 组装失败 → 该条诚实丢弃 | 无缺口（§8.3 路线②如实记载） | 无 |
| E4 | 泵满队（>256/ns） | drop-newest + `diag-pump-drop`（observer 缺席时静默） | 已知缺口但为 issue 明文裁定的独立处理项（§13-R4 备案，未伪装解决） | 无（follow-up 票） |
| E5 | onEvent throw（P1 泛化后） | manager `notify` 收口吞没（§7.2-3）——比现状（沿栈上抛由 registry 吞）收紧 | 无缺口（ADR-0011 隔离条款正向落实；P1-R2 零 throw 断言守护；现状 `deps.sink` 直呼复核属实，行为差异 §13-R3 诚实备案） | 无 |
| E6 | 回滚（P0 后写入的记录 / P1 破坏签名回退） | record schema 零触碰（`recordVersion:1` 不变）→ revert 提交即回滚；旧读者可读 | 无缺口 | 无 |
| E7 | 静默降级伪装成功 | 保留的静默点（其它 ns 泵内丢弃、无归属落本流）均为显式定案语义 + 契约锚（R3/R4）+ P2 文档；P0 消除的正是「静默半工作」 | 无缺口 | 无 |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `FileDiagnosticLog` +required 成员（类型面） | 无。仓内唯一 `FileDiagnosticLog` 类型对象字面量 = `file.ts:1529` 构造点（全量 grep `: FileDiagnosticLog = {` / `satisfies` / `as FileDiagnosticLog` 复核）；其余消费全部经 `createFileDiagnosticLog`/`ReturnType<typeof …>`/Map 值类型，required 化不产生类型破坏 | grep 证据（本轮）；设计 §8.1「纯增量」论证 | 无 |
| log 产物运行时形状（新增 enumerable 成员） | 无。仓内无 `Object.keys(log)` 类成员枚举断言（NDCL 测试的 `Object.keys` 断言全部针对 manifest/current.json 文件内容——逐条复核）；`FILE_INTERNAL` 为 non-enumerable defineProperty，不受影响 | `file-adapter-layout.test.ts:101/117/145` 等；设计 §8.1「已核 Object.keys(log) 类断言为零」独立证实 | 无 |
| registry seam `NamespaceRegistryDiagnosticLog` | 无。concrete required 成员结构满足 seam optional 成员（`types.ts:899-903` 复核）；签名逐字同形 | `types.ts:899-903` | 无 |
| 既有 #150 契约测试（`{emitter: log.emitter}` 字面量注入） | 无。字面量不含新成员 → 仍走 legacy；**关键前提独立证实：仓内无任何既有测试直传 raw log 对象**（全部为 `{emitter}` 字面量 / 手写 binding / manager binding——全量 grep `diagnosticLog:` 复核），故 P0 不会静默改道任何既有测试的路径 | `registry-create-diagnostic-red.test.ts:726/753`、`sa7-dynamic:638/663`、`issue-249-coverage:323` 等 | 无 |
| yjs-server `createHostDiagnosticsManager` 签名破坏 | 无缺口。破坏面 = app.ts + 2 个 app 测试（3 处，复核穷尽：index 现无导出 → 外部零消费者）；两测试为 `{enabled, …}, {sink, now}` 旧形（复核属实），机械适配入 ALLOW，零断言改动可行（测试断言面只读事件数组/落盘） | `app.ts:278-284`；`diagnostic-replay-host-lifecycle-sa7.test.ts:171-175`；`host-diagnostics-retirement-sa7-228.test.ts:75-77/135-137` | 无 |
| `tsc -p apps/yjs-server/tsconfig.json` 验证入口 | 真实存在（apps/yjs-server/AGENTS.md Verification 明文收录；tsconfig 文件在场） | AGENTS + `ls apps/yjs-server/` | 无 |
| app.ts `onEvent: this.sink` 类型适配 | 无阻断。`EventSink = (e: Readonly<Record<string, unknown>>) => void`（`lifecycle.ts:18`）；`HostDiagnosticsManagerEvent` 三成员均为 type-alias 对象字面量（`DiagnosticLogHealthEvent` 为 type alias 联合——`health.ts:23` 复核，非 interface）→ 隐式索引签名成立，逆变可赋值；`this.config.diagnostics` 为引用传参（含 `enabled` 超集）无 excess-property 检查；`DiagnosticsRetentionConfig` 两字段与 `FileRetentionConfig` 逐字段同形（复核） | `lifecycle.ts:18`；`health.ts:23`；`config.ts:97-110` vs `retention.ts:11-22` | 无（若实现期 tsc 意外不满足，机械兜底 `(e) => this.sink(e)` 不改设计语义——设计 §12 的 tsc 门禁会拦截） |
| DSH `nomicore-host` / `mabf-runner`（仓外） | 零代码改动主张有装配期生效路径支撑（plugin `host.diagnosticLog` → `createDiagRuntime`，`plugin.ts:199` 复核）；仓外验证诚实标记（R6） | `plugin.ts:190-205` | 无 |
| memory adapter 消费者 | 不变（无自绑定为显式非目标 R5；`memory.ts` 无 `runtimeEmitterFor` 复核属实——测试用途面无生产直传消费者） | grep | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| per-ns identity 解析（本 log 是否为该 ns 的日志） | NDCL File adapter（持有 `namespaceId` + `emitter` 事实） | `file.ts` 成员（§7.1-D1） | ✅ 事实 Owner 自持解析，registry 零感知 |
| 路由/泵/归因投递 | namespace-registry（#226 既有） | 零改动（DENY） | ✅ |
| 多 ns 生命周期（缓存/retire/close） | yjs-server manager（#155/#228 既有） | P1 仅签名泛化，语义零漂移 | ✅ |
| 文档化正路 | `.agents/skills/nomicore/`（宿主集成指引 Owner） | §7.3 | ✅ |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 生产供应方 binding（`runtimeEmitterFor` 数据键控） | `apps/yjs-server/src/diagnostics.ts`（#155/#226/#228） | P0 复用**逐字相同**的 seam 成员名与语义（identity 版）；P1 导出该既有实现 | 一致 | 无平行通道：P0 是同一 seam 的第二个供应方（per-ns 自绑定族），P1 是既有实现去 app 本地化 |
| app 公共导出先例 | `createNodeHubListenAdapter`（`index.ts` re-export 自 transport 模块） | manager 同款导出模式 | 一致 | 不新开包、不搬包内契约 |
| Host 直传 adapter 文档承诺 | `docs/integration/cordis-plugin-hosting.md:171`「宿主自行构造 adapter（如 `createFileDiagnosticLog`）经 `host: { diagnosticLog }` 注入」 | P0 使该承诺从「半真」转「全真」 | 一致 | SA8 §3 已裁定 implements-existing-decision |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| log 归属 ns | 构造期 `namespaceId`（config） | `runtimeEmitterFor` 纯闭包比较 | 无（无镜像状态/无时间序依赖；构造期一次成型后只读） |
| 流写面 | 构造期 `emitter`（单一构造点） | resolver 返回同一实例 | 无（幂等） |
| manager 实现 | `diagnostics.ts` 单模块 | app 经 `./diagnostics.js`、公共经 index re-export 同一符号 | 无（全仓一份；app 不从 index 回导，无循环） |

### 生命周期对称性

无新增生命周期面：P0 成员无 acquire/release（闭包）；stream/manifest/retention 面零触碰；P1 `close()/retireNamespace()` 语义冻结不动（P1-R3/R4 守护）；P2 纯文档。停机链「diagnostics O(1) close」次序在 P2 文档中与 yjs-server AGENTS 对齐（§7.3-2）✅。

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 无归属拒绝的「另立丢弃上报成员」 | 共享 emitter 通道（既有） | 设计明确拒绝（备选表第 3 行） | ✅ 不新增平行通道 |
| registry 侧启发式识别 raw log | 非抛成员探测（既有） | 设计明确拒绝（备选表第 4 行，违反 Owner 零改动） | ✅ |
| 独立 `@nomicore/host-diagnostics` 包 | yjs-server 公共面 | 设计明确拒绝（P1 备选，超 issue 裁决范围） | ✅ |
| 第二套 manager 实现 | `diagnostics.ts` | app 消费同一导出（§7.2-6） | ✅ 单份 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 9 项逐路径核对 | `file.ts`（P0 唯一实现面）/ NDCL `package.json` / `diagnostics.ts` / yjs-server `index.ts` / `app.ts` / 两个 app 测试 / `cordis-host.md` / `SKILL.md` | ✅ 与正文 §7.1–§7.3 的全部改动点一一对应，无缺失（如 `src/index.ts`（NDCL）确无需改动——B11 复核属实，DENY 合理） |
| DENY 与正文无冲突 | registry/runtime/replication 包零改动 = §7.1-D4/§10；4 契约文件 SA6 owned = NDCL AGENTS「改实现不改测试断言」；schema/record/reader/retention 冻结面 = NDCL AGENTS；`config.ts`/`lifecycle.ts` app 本地类型保持 = §7.2-4/7 | ✅ |
| ALLOW 无无理由扩张 | 每项均有正文小节锚 | ✅ |
| follow-up 未掩盖必要项 | R4（pump-drop 观测）/R5（memory adapter）/R6（DSH 仓外）均为 issue 明文裁定或显式非目标 | ✅ |
| `wiki/raw/task_issue-393*.md` DENY（Host/SA6 输入） | 本评审产物按 skill 约定为 SA2 唯一写入面，不冲突 | ✅ |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1（identity + B 臂转正） | `issue-393-ndcl-self-binding-red.test.ts` R0/R1（已存在；本轮通读：断言面 = resolver typeof/identity/undefined + strict reader 回读 `root-mutation` ≥1 含 committed——行为观察非源码文本） | 无；红灯真实性经 `red-contracts.log`（14 红/6 绿）与 `full-suite.log`（15 failed 全部为本票）双重佐证 | 无 |
| AC2（replication apply） | 同文件 R2（真实 session + apply committed 回读） | 无 | 无 |
| AC3（#150 零漂移） | G2 + 既有五套基线（`baseline-registry.log` 55/55 复核存在） | 无 | 无 |
| AC4（跨 ns 不落本流） | R3（第二 ns create 前后本流计数不变） | 无 | 无 |
| AC5（定案 + 契约） | R4（泵路径判别 + `REGISTRY_NOT_ACCEPTING` 恰 1 条 rejected）；legacy 现状落盘实测在 `green-capability.log` 尾部复核存在 | 无 | 无 |
| P0 适配器边界（resume 自绑定、不加 initStream） | NDCL 包内 R1–R3 + G1/G2 + `surface.test-d.ts`（optional 目标形态容忍 required 声明——设计选择与契约兼容性复核成立） | 无 | 无 |
| P1（导出/泛化/多 ns/丢弃语义） | `issue-393-manager-export-and-skill-docs-red.test.ts` P1-R1–R4（本轮通读：动态 import 公共入口 + 真实落盘 + onEvent 事件；未泛化敏感性经 SA6 probe `deps.sink is not a function` 佐证） | 无 | 无 |
| P1 破坏面收敛 | `vitest run apps/yjs-server/test` + `tsc -p apps/yjs-server/tsconfig.json`（AGENTS 真实入口） | 无 | 无 |
| P2（文档交付物） | P2-R1/R2 文档内容契约（section 提取 + 正则）；设计 §7.3 四要素可满足全部正则（标题「## 诊断日志…」命中 /diagnostic/i；`createFileDiagnosticLog`、`createHostDiagnosticsManager`、`legacy`、`Hub`、`Peer` 均在计划内容中） | 无 | 无 |
| 完成门禁 | 根 `pnpm typecheck` + `pnpm test`（含 `--typecheck` 面，`Type Errors 1 failed` 现状 = 本票类型契约，修复后须归零） | 无 | 无 |
| 测试观察行为而非源码文本 | 全部运行时断言读 strict reader / 事件回调；P2 例外有 SA6 §12.4 论证（交付物本体即文档） | 无 | 无 |
| 错误路径伪绿风险 | 守卫 6 绿锚（G1–G4、NDCL G1/G2）证明断言非恒红/恒绿；红灯原因逐条为缺口本身（SA6 §13） | 无 | 无 |

## 13. Required revisions

无 BLOCKER / MAJOR finding。无需修订即可实施。

## 14. Non-blocking observations

- **O1（P2 文档补一句陷阱，建议）**：§7.3 四要素未显式覆盖「`log.namespaceId` 与实际 open/mutate 的 namespace 不一致 → 该 ns 全部记录（含 create）解析 undefined 泵内丢弃、零输出零反馈」这一残余静默面——它是本 issue「最坏失效模式」在 identity 语义下的唯一复现路径。建议 `cordis-host.md` 单 ns 正路段补一句「`namespaceId` 必须即目标 namespace（单 ns log 只记录自己归属的 ns；多 ns 用 manager）」。属文档完备性，非阻断（identity 语义是 Owner 定案；R3 已契约化诚实丢弃）。
- **O2（计数笔误）**：§7.2-5/§8.1 称「4 个类型导出」但列名 5 个（`HostDiagnosticsManager`/`…Config`/`…Deps`/`…Event`/`DiagnosticEmissionDropReason`）。实现按列名清单为准即可；P1-R1 契约只锁 factory 运行时导出，无行为影响。
- **O3（版本策略备案）**：required 成员加入公共接口在严格 semver 语义下属 implementor-breaking；仓内惯例为发布提交统一 patch 位递增（0.1.7→0.1.8 先例复核），且 AC 仅要求「版本 bump」，0.1.8→0.1.9 可接受。建议随 R7 一并在发布评审确认是否升 0.2.0 以向下streaming消费者传递公共面语义变化。
- **O4（类型适配兜底备案）**：`onEvent: this.sink` 的可赋值性依赖 type-alias 联合的隐式索引签名（`DiagnosticLogHealthEvent` 为 type alias，复核属实，判定成立）。若实现期 `tsc -p apps/yjs-server` 意外报错，机械兜底 `onEvent: (e) => this.sink(e)` 不改变设计语义——设计 §12 已含该 tsc 门禁，可拦截。

---

## 附：本轮独立复核清单（证据基础）

源码锚点：`file.ts:118-131/1440-1545`、`create-diagnostic.ts:255-303/305-353/391-586`、`diag-pump.ts:119/129-146/171-218`、`registry.ts:805-860/1403-1586/2190-2225`、`types.ts:880-903`、`runtime.ts:540-560/736-762/876-884`、`replication-session.ts:480-500`、`diagnostics.ts:1-210`、`index.ts`（yjs-server 全文）、`app.ts:55-70/270-295`、`config.ts:95-125`、`lifecycle.ts:14-20`、`health.ts:1-40`、`retention.ts:1-30`、NDCL `index.ts:60-95`、`plugin.ts:190-205`。契约文件 4 个逐行通读。全量 grep：`diagnosticLog:`（38 处注入面全分类）、`createFileDiagnosticLog` 消费面、`FileDiagnosticLog` 字面量构造、`Object.keys` 形状断言、CONTEXT.md/ADR `FileDiagnosticLog` 零命中、`SKILL.md:16`/`cordis-host.md:14` 行锚、NDCL 版本 0.1.8 与 0.1.7→0.1.8 先例、`DIAG_PUMP_MAX_QUEUE_PER_NAMESPACE=256`。证据 log：`full-suite.log`（4/392、15/4737、Type Errors 1）、`red-contracts.log`（14/6）、`green-capability.log`（R0–R4 4/4 + legacy 无归属落盘实测）尾部核对。
