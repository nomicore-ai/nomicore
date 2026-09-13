# SA8 前置门禁相关决策摘录 — issue #364

任务：T2 readData 投影文本化原子切换（恒四键、截断事实单一载体、组合层退役）。
本文件只摘录与被审对象（task brief `wiki/raw/task_issue-364.md` + SA6 验收契约
`wiki/raw/task_issue-364_sa6_contract.md`）相关的决策、条款与关联点；不重写原义，
不作业务设计。裁决见 `wiki/raw/task_issue-364_conflict_report.md`。

## 决策集合状态盘点

- 全部 27 个 ADR 均在场；与本任务相关且**当前有效（accepted，无 superseded）**：
  0003、0008、0009、0016、0019、0023、0024（含 2026-09-14 #359 amendment）、0027。
- 0016 与 0024 的状态行已显式登记被 ADR 0027 修订（指针在文内），修订链完整。
- CONTEXT.md L38–58 已含 ADR 0027 词汇（投影文本 / ✂ 段 / 截断省略 / 形状预算）。
- 协议文档 `docs/protocols/instance-replication-v1.md` 与本任务无关（readData 是
  本地 seam，非 wire 契约）；诊断日志（0011/0014）与本任务无关。

## ADR 0027 readData 投影文本化（权威，2026-09-14 已接受）

- **决策 1**（`docs/adr/0027-readdata-projection-text.md` L18–25）：成功分支恒四键
  `{ ok, value, schema, truncated }`；`schema` = 投影文本（string）或 `null`；
  `truncated` 布尔保留；结构化 `truncations` 键删除（截断事实唯一载体 = 文本内
  ✂ 段）；`options` 闭合形状 `{ depth?, maxChildrenPerNode? }` 零变化；失败分支
  形状与语义不动；`schema: null` 单义不变（null 直通，非空串）；单 API（不设
  姊妹方法/双通道）。→ 关联 task AC1/AC5/AC6、SA6 CT-1/CT-5/CT-6。
- **决策 2**（L27–32）：`renderProjectionText(projection, truncations?)` 零选项纯
  函数、同步、逐字节确定；输入类型 = `ReadDataSchemaProjection` 系**保留为公共
  类型**（仍是 resolver 输出契约与渲染器入参契约，vfsl 包面零破坏）；文本组装序
  = 组合层前贴头行 → 渲染器正文 → ✂ 段；口径恒 first-line。→ 关联 AC2/AC7、
  CT-2/CT-7；T1 #363 已交付渲染器（HEAD `f8a06fe`，`packages/vfsl/src/index.ts`
  L154 公共导出）。
- **决策 3**（L34–42）：文法规格（规范性）：头行 `# readData [<path>] {depth:N}`
  与 ✂ 段为规范文法；✂ 段承担截断事实契约职责。ADR 未给全逐字节细节（path 记法、
  数字段、行注入折叠、预算段键序、与正文分隔）→ SA6 附录 A 冻结（契约 §15 U1）。
  → 关联 AC3/AC4、CT-3/CT-4。
- **决策 4**（L44–48）：投影 detach 深拷贝层退役（渲染器进程内直读 resolver 产物，
  文本天然 detached）；readData 结果类型坍缩为单一四键形（预算 / legacy 双结果联合
  消失）；registry lease 类型别名跟随，透传零语义变化。→ 关联 AC7/AC8、CT-7/CT-8。
  注意与 ADR 0024 决策 6 的联合解释张力（见冲突报告第 3 节第 8 行）。
- **决策 5**（L50–53）：破坏性 minor bump（0.x 无跨 minor 稳定承诺，消费方可
  枚举）；DSH 探针工具零代码改动。→ 关联 AC10（issue 明示 bump 归发布流程，
  本票不改版本号）。
- **对既有 ADR 的修订**（L55–58）：0016 交付条款被取代（四件套退出公共读面、
  深拷贝条款退役；三元组动机、always-on、null 单义、resolver 条款原文延续）；
  0024 决策 4 恒五键再修订为恒四键、决策 3 截断清单通道由 ✂ 段取代；0024 决策
  1/2/3(语义)/5/6/7 及 #359 amendment 在渲染器输入侧不变。
- **验收缝**（L76–81）：缝 1（vfsl 渲染器，T1 已交付）；缝 2（readData 公共面：
  恒四键、`schema` ≡ `renderProjectionText(resolveSchemaAtPath(…))` 一致性锚、
  头行拼接、null 单义与失败分支、options 零变化回归、truncated 与 ✂ 一致性）；
  缝 3（文档负控：四件套/恒五键旧词汇清退，投影文本词汇在场）——本票 = 缝 2+3。
- **已知限制**（L60–64）：1) 公开无损 JSON 通道退场（程序化结构消费走仓内
  resolver 直达——AC2 的 `compileSchemaEnvelope` oracle 属仓内用法）；2)
  `schema:null` × 预算读只剩 `truncated` 布尔；3) marker 容器线索不带元素类型名。

## ADR 0016 readData 语义 schema 投影（语义面延续，交付条款被 0027 取代）

- 状态行 L4：交付条款由 ADR-0027 修订（四件套退出公共读面、交付形态改投影文本、
  每次读投影深拷贝条款退役），语义面条款原文延续。
- **null 单义**（L26）：三种情形不区分，`null` 不是读的失败，`ok` 恒真；路径合法
  但值缺席时 schema 照常返回。→ AC5、CT-5 E1。
- **always-on**（L77，经 0024 收窄注）：每次成功读都返回 schema 投影，无 opt-in。
  → 文本形态下 `schema` 键恒在场（string|null）。
- **resolver 条款**（L52–73 + 0019 修订节 + 0024 修订节）：`resolveSchemaAtPath`
  三参、`ref` 缺失抛 `InternalError`（可信域，不进结果联合）。→ CT-5 E5 逃逸锚；
  vfsl AGENTS 明文收录同一例外。
- **ADR 0008 D8 封口镜像**（ADR 0008 L167–179，其第 2 点明示交付纪律「以 ADR 0016
  为权威」）：`derived` 只经 readData 投影受控只读进入公共面；`module` 与 validator
  仍永不进入公共面。

## ADR 0024 readData 形状预算（值通道与失败面权威，交付形状被 0027 再修订）

- 状态行 L4：决策 3/4 的截断清单通道与恒五键形状由 ADR-0027 再修订（恒四键，
  截断事实载体 = 投影文本 ✂ 段）；**决策 1/2/5/6/7 及 #359 amendment 未被 0027
  修订**，继续有效。
- **决策 1**（L20–31）：options 封闭形状；非法 options（含未知键）→ `READ_OPTIONS_INVALID`
  （同步、不抛、不借用路径/生命周期码）；不传 options = 完整投影。→ AC6、CT-6。
- **决策 2 + #359 amendment 第 1/2 条**（L33–45、L160–177）：值内截断两形态
  （depth 折叠壳 + 条目；width 键省略）；E1 吸收纪律（不引入「键在、值 undefined」
  第三态）。→ CT-4 D7 值通道零变化负控。
- **决策 5 + #359 amendment 第 3 条**（L80–97、L178–196）：投影同 depth 裁剪、
  width 对投影无操作、可见性切片规则（docs 在场 ⟺ 位置可见）——**渲染器输入侧
  契约**（T1 已实现）；两通道截断位置对齐（计层规则，契约级承诺）→ CT-4 D3/D4。
- **决策 6**（L99–101）：预算属 ADR 0008 读域；`readLogicalValueAtPath` 三参；
  runtime 组合同预算；registry lease 原样透传；不新增第二条读路径；
  `READ_OPTIONS_INVALID` 只属预算联合（零泄漏——runtime.ts L140–146 类型注释
  明文「该联合不含 READ_OPTIONS_INVALID（零泄漏：无 options 调用结构上不可达
  该码）」）。→ CT-8 解释的关键约束。
- **决策 7**（L103–109）：类型面 `DeepOptional<PathAt<…>>`；预算读不是写前完整
  快照——typed-access 纪律三句（SA6 CT-10 J1 要求原文保留 L126/L130/L132）。
- 验收节「width 对投影无操作」句（L139）：仅触发 width 的预算读 schema 投影与
  同路径无预算读逐字节相等——该句成文于 JSON 投影 + 无头行时代；0027 决策 3
  头行事实性（含预算段）使**全文**必然不等，语义性质收窄为渲染器正文逐字节相等
  （SA6 §11 排除项 + CT-4 D4/E1 负控承载）。

## ADR 0008 NamespaceRuntime 读写能力与单序列器（读域框架，未被 0027 触碰）

- 读取不进 sequencer、只观察已提交事实（L18、L30）；读取保留不变量。
- 失败通道：路径/载体/lifecycle 失败走同步结果联合；`RUNTIME_READ_DISABLED`
  （修订节 1，L123）；读停接纳先于一切 options 触达（#336 B-1）。
- 公共面只暴露 detached 投影；handle/Y.Doc/sequencer/生产工厂/测试 seam 包内
  （L97；runtime AGENTS 同款）。
- ADR 0024 修订节（L223–239）：读语义 = 预算内投影 + 截断清单；本 ADR 读取保留
  不变量不变。

## ADR 0009 NamespaceRegistry 与租约（lease 面权威）

- L40–44：lease 独立 caller capability；release 幂等；released 后操作返回稳定
  `NAMESPACE_LEASE_RELEASED`（resolve 不 reject）。→ CT-1 A5。
- registry AGENTS：公共 API 只经 `src/index.ts`；lease 透传零语义变化由
  `Equal` 组合锁锚定（`packages/namespace-registry/src/lease.ts` L410–422）。

## ADR 0003 / 0019 / 0023（外围约束）

- 0003：ValueSchema 9-kind 封闭语义联合冻结——本任务不扩展（截断标记仍是投影
  包装联合，且退出公共读面）；0027 备选节明文否决 wire 层紧凑化以保 0003/0024
  冻结面。
- 0019 决策 7：docs 切片三来源并入 memberDocs（0016 修订节 L108–126）——渲染器
  输入侧，T1 已承载，本任务零触碰。
- 0023：Cordis 服务表面 getter 化/冻结——lease 类型别名跟随不构成服务表面重设计。

## 模块 AGENTS 明确收录的决策（SA6 §3 已转写，本摘录核对一致）

- `packages/namespace-runtime/AGENTS.md`：读在 FIFO sequencer 之外；公共 API 只
  暴露 detached 投影；handle/live Y.Doc/sequencer/生产构造器/测试 seam 包内；
  registry 是 entry/lease/idle/生产装配唯一 owner。
- `packages/namespace-registry/AGENTS.md`：lease 独立 capability；release 幂等；
  公共 API 只经 `src/index.ts`。
- `packages/vfsl/AGENTS.md`：`resolveSchemaAtPath` 的 `derived` 是可信域入参，
  畸形派生抛 `InternalError` 不进结果联合；公共 API 只经 `src/index.ts`。
- `packages/doc-runtime/AGENTS.md`：读取 schema 无关；公共面不暴露 live 可写
  ROOT/SCHEMA/META。
- 根 `AGENTS.md`：typed Namespace 写纪律（本票零写路径改动；组合层不得引入
  cast）；改 `packages/` 前读最近 AGENTS；改 `docs/` 前读 `docs/AGENTS.md`。
- `docs/AGENTS.md`：CONTEXT.md 是词表权威；ADR 是历史记录，修订须显式登记；
  文档不得发明实现行为；`wiki/raw/` 是证据非规范契约。

## CONTEXT.md 词汇基准（L38–58，ADR 0027 提交已写完）

- 「Data」「语义 schema 投影」「投影文本」「形状预算」「截断省略」「截断事实段
  （✂ 段）」词条均已是投影文本词汇（含 _Avoid_ 列：「把 JSON 四件套当 readData
  交付物」「期望结构化截断清单键（已退役）」）。本票对 CONTEXT.md 只做零漂移
  核对，不需重写。

## HEAD 事实基线（本门禁复核，`f8a06fe` = `origin/adr0027-projection-text` tip）

- readData 成功分支两处恒五键（`runtime.ts` L572–578 无预算 / L600–606 预算），
  `schema` 位为 JSON 四件套对象——SA6 E1 探针实测一致（probe log
  `PROBE_BASELINE_KEYS=["ok","value","schema","truncated","truncations"]`）。
- 渲染器已公共导出（`packages/vfsl/src/index.ts` L154）但生产面零接线
  （`grep renderProjectionText packages/*/src | grep -v vfsl/src` → 0 命中）；
  头行 `# readData` 在 src 树 0 命中——SA6 E4/E5 复核一致。
- detach 深拷贝符号在场（`read-schema-projection.ts` L142–169
  `detachReadSchemaProjection`/`cloneValueSchema` 家族）——待退役面真实存在。
- 结果联合双名在场（`runtime.ts` L148–172）：legacy 联合不含 `READ_OPTIONS_INVALID`
  （零泄漏注释明文）；registry Equal 组合锁在场（`lease.ts` L410–422）。
- 根 typecheck exit 0 / 根测试 381 files 4540 tests 全绿（SA6 baseline log）——
  红灯只可能来自目标断言（SA6 E2 红签名：恰四键断言处红，received 多 `truncations`）。
