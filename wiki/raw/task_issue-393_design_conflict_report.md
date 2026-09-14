# SA8 设计后冲突复查报告 — Issue #393

- Reviewed subject: **design**（SA1 设计 `wiki/raw/task_issue-393_design.md` + 上游 SA6 契约
  `wiki/raw/task_issue-393_sa6_contract.md`，实现前门禁；task brief `wiki/raw/task_issue-393.md`
  一并复核——前置门禁产物（`_relevant_decisions.md` / `_conflict_report.md`）历史上缺失，
  本报告 §2 收编其决策摘录职能）
- 复查人：SA8（conflict-gate）；日期：2026-09-14；worktree：`/home/wangjian/nomicore-fix-issue-393`（HEAD `dcb3766`）
- 被审对象状态：SA6 verdict **approve**（红灯契约 4 文件 + 10 份证据 log 在 worktree，`git status` 可见）；
  SA1 设计自评 `requiresConflictRecheck: true`（其 §14 三条理由，本报告逐条裁决）
- `wiki/raw/task_issue-393_sa2_review.md` 不存在（iteration 0，无评审输入；skill 允许缺省）

---

## 1. 复查范围与方法

对照基准 = ADR 全集（`docs/adr/0001–0028`，无 superseded 项命中本面）+ 根 `CONTEXT.md` +
协议文档（`docs/protocols/instance-replication-v1.md`——本面零触碰，仅确认无涉）+
模块 AGENTS 明确收录的决策（registry / namespace-diagnostic-log / yjs-server / apps / docs）。
Owner comment 5664521867 已对 GitHub 原文复核（OWNER 关联、updated 2026-09-14T13:12:42Z，
与 task brief 转录逐字一致）。源码（types.ts / create-diagnostic.ts / diag-pump.ts / file.ts /
diagnostics.ts / registry.ts / schema.ts）仅用于确认设计引用的事实锚点，不作为冲突基准。

关键事实锚点已逐条直接复核（非转引）：seam 三成员（`types.ts:899-903`）、三态路由
（`create-diagnostic.ts:391-417`）、泵 drain 静默丢弃（`diag-pump.ts:136-139`）、
无归属同步共享通道（`create-diagnostic.ts:530-541`；`registry.ts:2201/2211`）、
File adapter 现形状（`file.ts:118-131` 接口无 `runtimeEmitterFor`；`:1529-1541` 构造产物）、
manager 冻结语义（`diagnostics.ts:37-49/105-163`）、record 面无 ns 字段（`schema.ts:184-185`）、
NDCL 0.1.8 与 index re-export（`package.json:3`；`src/index.ts:71-90`）。

## 2. Inputs and decision set（相关决策摘录）

| # | 决策源 | 状态 | 与本设计的关联点 |
|---|---|---|---|
| D1 | ADR 0011 §产品契约（best-effort 隔离：emit/排队/持久化/背压/丢弃/关闭失败不得改变业务结果；adapter 以 non-throwing 有界 emitter seam 接收） | accepted | P0 新成员纯闭包零 IO/零 throw；append 仍在泵 macrotask drain（业务槽外） |
| D2 | ADR 0011 §覆盖范围 L55-63 + §时序 L125（首版应记录 create/ROOT mutation/SCHEMA replacement/replication apply/replication management；**acceptance 前拒绝在对应公共入口记录**） | accepted | P0 使自然组合兑现 runtime 级覆盖；AC5 无归属拒绝落盘的直接依据 |
| D3 | ADR 0011 §Interface 与 seam L107-119（业务模块依赖小 emitter 接口；emit 不 throw、无 durability promise） | accepted | `runtimeEmitterFor` 返回该 emitter；resolver 违约由 Registry 既有防御隔离 |
| D4 | ADR 0014 §Writer + 2026-08-28 首切片 amendment（有界同步 append；**调用点必须在 write sequencer slot 之外**；未来 queue/batch 切片不得改 emitter 公共 seam/record schema/manifest policy） | accepted | P0 不改 emit 路径与调用点；建流/append 时机仍由 #226 泵控制 |
| D5 | ADR 0014 §Stream/generation、§打开与尾部恢复、§Retention 与删除（manifest 创建后不可变；reopen 三分支；冻结项改变才新建 generation） | accepted | 设计 DENY 全部冻结面；resume 路径同一构造产物自绑定 |
| D6 | ADR 0014 record schema（v1 封闭 operation 词表；record 身份 = (streamId, sequence)；**无 namespaceId 字段**） | accepted | 零 schema 触碰；AC5 记录不伪造归属 |
| D7 | ADR 0009（Persistence/Registry 依赖外部 Clock/Timer，不 fallback 系统时钟） | accepted | P1 泛化 deps `now` 保持必需；app 经 `requireClock` |
| D8 | CONTEXT.md 词条：namespace 诊断变更日志 / 变更尝试 / stream generation / 语义 emission / storage projection（L212-234） | 现行词表 | 无词表/reason/术语演进；`FileDiagnosticLog` 面未入 CONTEXT（grep 复核零命中） |
| D9 | `packages/namespace-registry/AGENTS.md`（诊断发射面须读 ADR 0011/0014 + NDCL AGENTS；公共 API 只经 `src/index.ts`） | 模块收录 | P0 registry 零改动（DENY） |
| D10 | `packages/namespace-diagnostic-log/AGENTS.md`（契约测试 SA6 owned 改实现不改断言；node:fs 仅 file.ts/reader.ts；schema 指纹钉死；observer 事件白名单；不依赖 yjs/clock/registry/persistence） | 模块收录 | P0 仅改 file.ts 接口+产物字面量+JSDoc；契约测试 DENY |
| D11 | `apps/yjs-server/AGENTS.md` + `apps/AGENTS.md`（组合根；只消费包公共导出；单一停机链「diagnostics O(1) close」；stdout NDJSON 事件面） | 模块收录 | P1 增量导出 + 签名泛化；close/retire 语义与事件词表零漂移 |
| D12 | `docs/integration/cordis-plugin-hosting.md:171`（宿主自行构造 adapter（如 `createFileDiagnosticLog`）经 `host: { diagnosticLog }` 注入——根 AGENTS「Third-party plugin hosting」收录） | 模块收录 | 文档化接线承诺：自然组合启用诊断日志——P0 兑现其完整语义 |
| D13 | Owner comment 5664521867（2026-09-14T13:12:42Z，OWNER；GitHub 原文已复核） | override 权威 | §4 Overrides 表 |

ADR 全集扫描结论：**无任何 ADR/协议文本记载** `diagnosticLog` 注入 seam、`runtimeEmitterFor`
成员或 `FileDiagnosticLog` 公共面（grep `docs/adr/**`、`docs/protocols/**` 零命中）——该 seam 的
冻结权威 = seam 类型自身 + #150/#155/#226 任务谱系（wiki 证据，非规范）+ Owner 裁决；设计对其
的「冻结面」承诺因此是**自律约束**而非 ADR 义务，本报告按最严口径逐项核对（§5）。

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0011 | §产品契约：日志 emit/排队/持久化/丢弃失败不得改变业务结果；adapter 违约被隔离 | P0 成员 = 纯闭包字符串比较（零 IO、零 throw、零状态，设计 §7.1-D1/D2）；实际 append 仍在泵 drain 逐任务 try/catch + emitter 管线既有边界 | no-conflict | `create-diagnostic.ts:339-353/477-479`；`diag-pump.ts:129-146`；设计 §9 | 无 |
| ADR 0011 | §覆盖范围 L55-63：首版应记录全部可能修改 Y.Doc 的路径（create/ROOT/SCHEMA/replication apply/management） | 现状：文档化接线（cordis-plugin-hosting.md:171）下 runtime 级记录结构性不产生（SA6 根因链第 4 步）；P0 使自然组合交付完整覆盖集 | **implements-existing-decision** | ADR 0011 L55-63；`docs/integration/cordis-plugin-hosting.md:171`；SA6 §8；设计 §3 | 无（P0 即兑现） |
| ADR 0011 | §时序 L125：acceptance 前拒绝在对应公共入口记录 | AC5 定案「接受落盘」：无归属公共入口拒绝（`REGISTRY_NOT_ACCEPTING` 等）经共享 emitter 落本流——记录拒绝恰是该条款的义务方向；丢弃才是偏离 | **implements-existing-decision** | ADR 0011 L40-42（`acceptance` 阶段）+ L125；CONTEXT.md「变更尝试」（被拒请求也属变更尝试）；`registry.ts:2201/2211`；设计 §7.1-D5 | 无 |
| ADR 0011 | §Interface 与 seam L107-119 | `runtimeEmitterFor` 是 registry 注入 seam 的既有可选成员（#155 增量），非 emitter 接口变更；返回物即 ADR-0011 小 emitter；resolver 同步、非抛 | no-conflict | `types.ts:899-903`（含 sync-only 契约 L892-893）；设计 §8.1 | 无 |
| ADR 0014 | §Writer + 首切片 amendment（slot 外接线纪律；emitter seam/schema/manifest 不因演进改变） | P0 零触碰 emit 路径/调用点/schema/manifest；建流与 append 时机仍全由 #226 泵在业务槽外控制；不加 `initStream`（缺席 no-op 既有语义） | no-conflict | `create-diagnostic.ts:467-476/552-554`；NDCL AGENTS Boundaries；设计 §7.1-D3 | 无 |
| ADR 0014 | §Stream/generation/恢复/Retention 冻结面 | DENY LIST 全覆盖（schema/record/reader/retention/health 等零触碰）；resume 同一构造产物 → 自绑定随构造期成立（SA6 NDCL R3 锚） | no-conflict | 设计 §11 DENY；`file.ts` reopen 分支 | 无 |
| ADR 0014 | record schema：封闭词表、无 ns 字段、身份 (streamId, sequence) | 零 schema 变更；`namespace-create` 为既有词表成员；无归属记录不携带/不伪造 ns 归属（record 面结构性无该字段） | no-conflict | `schema.ts:184-185`；ADR 0014 L69-79 | 无 |
| ADR 0009 | 外部 Clock 注入、禁系统时钟 fallback | P1 泛化 deps `now: () => number` 保持**必需**（比现状更严不更松）；app 调用点 `requireClock(this.ctx).now()` | no-conflict | ADR 0009 L83；设计 §7.2；`app.ts:278-284` | 无 |
| CONTEXT.md | 语义 emission / storage projection / 词表纪律（update-omitted reason 三值等） | 无词表演进、无新术语、无 emission 面变化；「自绑定/identity 匹配」是既有「数据键控归因」（#155）概念的实现，非新域词 | no-conflict | CONTEXT.md L212-234；设计 §6 | 无 |
| registry seam（types.ts + #150/#155/#226 谱系） | seam 成员名 `emitter`/`initStream?`/`runtimeEmitterFor?`；三态探测路由；#150 legacy 逐字节 | P0 复用**逐字相同**的成员名 `runtimeEmitterFor`；registry 探测/路由/泵零改动（DENY）；裸 `{emitter}` 字面量仍走 legacy（G2 守卫）；raw log 因成员在场由 legacy 切换至泵路径 = Owner 裁决的产品修复本体 | no-conflict（另见下行 JSDoc 措辞注记） | `types.ts:899-903`；`create-diagnostic.ts:309-318/391-417/419-463`；SA6 G2；设计 §7.1-D4 | 无 |
| registry seam JSDoc（types.ts:888-890） | 「生产供应方（Host 管理器）恒返回良构 emitter…返回 undefined/throw/畸形形状 = seam 违约，被 Registry 隔离为『无诊断』」 | 自绑定对**非本 ns** 返回 undefined。裁定：该条款文义自限于「Host 管理器」供应方族；成员声明签名本身合法化 undefined 返回（`=> … \| undefined`）；Registry 对 undefined 解析的既有实际契约 = `resolveEmitterOnce` 形状门 → 泵 drain 静默丢弃（`create-diagnostic.ts:544` 注释「解析违约（throw/畸形/**undefined**）→ drain 内静默丢弃（D11/i1）」；`diag-pump.ts:136-139`）；Owner 裁决明文背书「其他 ns 解析 undefined → 泵内静默丢弃（单 ns 日志的诚实语义）」 | no-conflict（附措辞澄清建议，见 §8-a） | `types.ts:888-903`；`diag-pump.ts:136-139`；`create-diagnostic.ts:544`；Owner comment 5664521867（issue 正文 P0 节） | 无（本变更集不改 registry——DENY；JSDoc 措辞澄清留待任何触碰 registry 的后续票随行） |
| #226/#228 manager 冻结语义 | 共享 `emitter` 恒 `unattributed` 丢弃+计数；retire → `namespace-deleted` 桩；close → `manager-closed` 桩 | P1 仅签名泛化（`enabled` 去除、`sink`→`onEvent?`、`now` 保持必需）+ 导出；binding/close/retire 语义零漂移（P1-R2/R3/R4 守护；SA6 双向绿推演已证）；**onEvent throw 吞没为防御性收紧**（现状 sink throw 沿栈上抛由 registry 吞）——只收紧观测面、不动业务面，ADR 0011 隔离条款的正向落实 | no-conflict | `diagnostics.ts:37-49/105-163`；设计 §7.2-1/3；SA6 §12.2 | 无 |
| AC5 定案 vs manager 丢弃（语义二元边界） | 两条并存语义：自绑定 per-ns log 无归属拒绝**落本流**；manager 共享通道**恒丢弃+计数** | 裁定：不构成决策冲突——(1) 无任何 ADR/CONTEXT 文本要求共享通道必须丢弃（「unattributed 恒丢弃」仅是 manager 实现与其任务谱系的冻结面）；(2) 自绑定形状的落盘行为**非新增**（SA6 probe 实测现状 legacy 共享通道即落 1 条，P0 后同一发射点零改动）；(3) 两族供应方各持契约（R4 / P1-R2）且边界写入 P2 文档。互补不冲突的判定成立 | no-conflict | ADR 0011 L125（支持记录）；SA6 §12.3 理由 5；`create-diagnostic.ts:530-541`；设计 §7.1-D5 边界 | 无 |
| yjs-server / apps AGENTS | 组合根边界：只消费包公共导出；单一停机链；stdout NDJSON 事件面；不把包内契约搬进 app | P1 从 `src/index.ts` 增量导出（Owner 明文指令的落点）；manager 逻辑本就生于 app（非包内契约上移）；app 内部消费同一模块符号（单份实现，无循环导出）；事件词表/字段零变更；`enabled` 保持 app 本地配置 | no-conflict | apps/AGENTS.md；yjs-server/AGENTS.md；`index.ts:53-54`（现状仅类型导出）；设计 §7.2-5/6/7 | 无 |
| NDCL AGENTS | 契约测试 SA6 owned；环境绑定（node:fs 仅 file.ts/reader.ts）；schema 指纹钉死；observer 白名单；依赖面 | P0 改动面 = `file.ts` 接口 + 构造产物字面量 + JSDoc + `package.json` 版本；纯闭包成员零新增 IO/绑定/依赖；4 契约文件 DENY（实现者不得改断言）；schema/health 零触碰 | no-conflict | NDCL AGENTS Contract/Boundaries；设计 §11 | 无 |
| Owner comment 5664521867 | 自然组合必须工作（非配置错误）；P0 identity 自绑定公式；不加 `initStream`；类型收紧作废；P1 导出泛化 manager；P2 文档；AC5 显式定案入契约测试 | 设计 §4 映射逐条核对**完整**：主契约载体即 raw log 直传（SA6 R1-R4）；无任何 fail-fast/类型拒绝断言（SA6 §2 已核，本轮复核 4 契约文件无此类断言）；`runtimeEmitterFor` 公式与 Owner 表述逐字一致；required 声明满足 SA6 optional 目标形态 | implements-existing-decision（Owner 义务兑现） | GitHub comment 5664521867（已复核原文）；设计 §4/§7.1-D1；SA6 §2 | 无 |
| P2 skill 文档 | `.agents/skills/nomicore/` 现状：cordis-host.md:14 第 5 步已把 raw adapter 直传写作启用正路；SKILL.md:16 路由行无诊断日志措辞 | P0 后该既有指引从「半真」变「全真」；P2 增配置节/路由为纯增量文档交付，与任何决策文档零矛盾 | no-conflict | cordis-host.md:14；SKILL.md:16；设计 §7.3；SA6 §12.4 | 无 |

**分类计数**：no-conflict × 15；implements-existing-decision × 3；evolution-required × 0；hard-conflict × 0。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| issue #393 初版定性（「Host binding 形状错误」）及其主修方向（类型收紧 fail-fast + manager 导出为主修） | Owner comment 5664521867（2026-09-14T13:12:42Z，OWNER；GitHub 原文已复核一致） | 仅 issue #393 的修复方向：自然组合必须工作 = 产品缺陷；类型收紧作废；manager 降级为 P1 多 ns 正路；AC5 倾向接受落盘并要求显式定案入契约测试 | P0 identity 自绑定（`ns === namespaceId ? emitter : undefined`）；registry 探测零改动；不加 `initStream`；R4 契约化定案 |

说明：本 override 覆盖的是 **issue 自身的早期方向**，不覆盖任何 ADR/CONTEXT/协议决策——
全部分析未发现需要击败的规范决策文本（§2 扫描结论）。SA8 未替 Owner 或 SA1 创造任何新 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计承诺，实现复查逐项核对 diff） |
|---|---|---|---|
| registry seam 成员名 `emitter` / `initStream?` / `runtimeEmitterFor?` | `packages/namespace-registry/src/types.ts:899-903` | 零新增字段名；新成员**逐字复用** seam 名 | ✅ 承诺零改动（DENY `packages/namespace-registry/src/**`） |
| registry 探测与三态路由 | `create-diagnostic.ts:309-318/391-417` | `readRuntimeEmitterResolver` / `createDiagRuntime` 零漂移 | ✅ DENY |
| #150 legacy 路径逐字节（裸 `{emitter}` 字面量 → 仅 create 尝试） | `create-diagnostic.ts:419-463`；SA6 G2 守卫 | registry 零改动 ⇒ 结构性保持 | ✅（G2 复跑锚） |
| Runtime / replication 发射消费面 | `runtime.ts` / `replication-session.ts`（`diagnosticEmitter`+`clock` 成对） | DENY `packages/namespace-runtime/src/**` | ✅ 仅环境变化（emitter 到位） |
| record schema 指纹/词表、manifest 不可变、JSONL/frame 格式、retention/删除协议 | NDCL AGENTS（`schema-freeze.test.ts` 钉死）；ADR 0014 | DENY schema/record/reader/retention/health 等 | ✅ |
| manager binding 冻结语义（`unattributed` 丢弃+计数 / `namespace-deleted` / `manager-closed` 桩） | `diagnostics.ts:37-49/105-163`；#226/#228 | P1-R2/R3/R4 守护 | ✅ 承诺零漂移（实现复查重点项之一） |
| stdout NDJSON 事件词表（`diagnostic-log*`） | yjs-server AGENTS；`diagnostics.ts` 健康面 | P1 类型化公共面 = 既有事件形状，词表/字段零变更 | ✅ |
| NDCL 环境绑定与依赖面（node:fs 仅 file.ts/reader.ts；不依赖 yjs/clock/registry/persistence） | NDCL AGENTS Boundaries | 纯闭包成员，零新增绑定/依赖 | ✅ |
| NDCL 公共 re-export 面 | `src/index.ts:68-90` | 类型经既有 re-export 流经新成员，index 零改动 | ✅（实现后由 typecheck 佐证） |
| ADR 文本 + CONTEXT.md | 设计 §11 DENY | 零修订 | ✅（本报告裁定无需修订，见 §6） |
| SA6 契约文件 4 个 + `artifacts/sa6-issue393-*.log` | SA6 owned；不可变证据 | DENY（改实现不改断言） | ✅ |

## 6. Evolution requirements

**无。** 全部对照项落 no-conflict / implements-existing-decision：

- P0 的公共面变化（`FileDiagnosticLog` 增 required 成员）不与任何 ADR/CONTEXT/协议条款冲突
  （§2 扫描：该面从未入规范文本）；per docs/AGENTS「update every normative document whose
  stated contract changed」——本轮核对无任何规范文档的既有陈述因 P0/P1/P2 变为不实：
  cordis-plugin-hosting.md:171 的接线描述由「半真」转「全真」（无需改动即准确）；
  NDCL README 未枚举 log 对象成员面（新增成员不使任何陈述失真）；CONTEXT.md 无涉。
- AC5 定案不改任何既有契约的可观察行为（自绑定形状现状即落盘——SA6 实测；manager 形状
  冻结不动），属「显式定案 + 契约化」而非语义修订。
- P1 签名破坏面 = 仓内 3 调用点（app.ts + 2 测试，B9 已复核旧签名在场），外部无消费者
  （此前未导出）；机械适配已在 ALLOW LIST。yjs-server 版本 bump 留发布评审（设计 §12）。

## 7. Hard conflicts

**无。** 未发现任何无合法 override 的硬冲突；亦未发现证据不足项（设计引用的关键锚点本轮
全部直接复核一致，含 §2 所列 10 组事实锚点；唯一 GitHub 外部事实——Owner comment——已对
原文复核）。

## 8. Required actions

**阻塞项：无。** 非阻塞建议（不构成 verdict 条件）：

- **a（措辞澄清，后续票随行）**：任何未来触碰 `packages/namespace-registry/src/types.ts` 的
  变更集，宜随行澄清 `:888-890` JSDoc 的供应方族范围（Host 管理器族 = 受管 ns 恒良构 emitter
  或丢弃桩；per-ns 自绑定族 = 非本 ns 返回 undefined 为诚实语义，泵内静默丢弃）。本票 registry
  为 DENY，不得为此改文件；现行文本与代码行为已相容（§3 裁定），不构成冲突。
- **b（实现期核对清单，供 implementation 复查）**：(1) `file.ts` 改动不越出「接口 + 构造产物
  字面量 + JSDoc」；(2) manager binding/close/retire 语义 diff 零漂移（P1-R2/R3/R4 转绿且既有
  app 套件零回归）；(3) registry/runtime/replication 包零 diff；(4) 4 契约文件与 SA6 证据 log
  零改动；(5) NDCL 版本 0.1.8→0.1.9 落盘；(6) P2 文档边界段把两种无归属语义明确写为
  供应方范围限定（设计 §7.3-4 已计划，保留）。
- **c（残余备案确认）**：memory adapter 无自绑定（R5）与 `diag-pump-drop` 生产观测缺口（R4）
  均为 issue 明文裁定的显式非目标/独立处理项，设计未伪装解决——符合纪律，无需行动。

## 9. Verdict

**clear**

- 全部对照项为 no-conflict（15）或 implements-existing-decision（3，均属 ADR 0011 覆盖义务与
  Owner 裁决义务的兑现）；无 evolution-required、无 hard-conflict。
- SA1 §14 的三条 recheck 理由逐条裁决：(1)「SA8 产物缺失」——本报告即为补位裁决，缺失本身
  不再生效；(2)「公共 API 变化」——已裁决为无冲突增量（§3），实现核对义务转入
  requiresConflictRecheck；(3)「AC5 语义边界触及 #226/#228 冻结语义解释边界」——已裁决
  互补不冲突（§3 语义二元边界行），且不改任何冻结面行为。
- 对设计 §1–§15 的具体裁定：P0/P1/P2 全部通过；AC5「接受落盘」定案成立；DENY/ALLOW 清单
  与各决策义务一致（含「改实现不改测试断言」「公共导出经 index.ts」「版本 bump 承载公共面
  变化」）；无作废的「类型收紧 fail-fast」残留（设计通篇与 4 契约文件均无类型拒绝断言）。

## 10. requiresConflictRecheck

**true**

理由：本报告为**实现前**设计裁决；下列面尚待实现 diff 核对方可闭合——公共 API 变化
（NDCL 类型成员 + yjs-server 新导出）、失败/可观测语义定案的实现兑现（R4 / P1-R2 的
accept-persist 与 unattributed-drop 双语义边界）、冻结面零漂移承诺（§5 表 10 项中
「Actual result」多为设计承诺而非已落地事实）。纯 no-conflict 的文档面（P2）无需单独复查，
但与实现同变更集验证。建议按 skill「implementation 复查」触发条件执行：SA4/SA9 产出后或
实际 diff 触碰 DENY 边界时。
