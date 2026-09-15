# 相关决议（Relevant Decisions）— 全链 SA 复用

> SA8 前置门禁产出（issue #383：[ADR 0029] P3 — 组合面与 lease 类型（缝 2：runtime + registry））。
> 只摘录相关决策、条款与关联点，不重写原义、不作业务设计；引用处保留原文措辞，
> 需要时按编号回查 ADR 全文。裁决见 `wiki/raw/task_issue-383_conflict_report.md`。
>
> 基准快照：worktree `mabf/issue-383` HEAD `de2ff55`（含 `8a4fa40` ADR 0029 设计基线、
> `1b639e0` #381 P1 W1 冻结解除与 total 下沉、`de2ff55` #382 P2 缝 1 where 过滤原语）；
> `docs/adr/` 共 28 份逐个盘点，无一被整体 superseded（0027 对 0016/0024 的交付条款
> 修订、0018 对 0010 的局部取代、0029 对 0028 的词表演进均属条款级演进，非整体取代）；
> CONTEXT.md 为现行词汇表（「过滤窗口」词条已随 ADR 基线落地，缝 3 已闭合）。
> issue #383 评论 REST 快照为空（无 Owner 评论）；前置票 #382 已合并（#398），无阻塞。

## 相关 ADR

### ADR 0029 过滤窗口——窗口读的 where 词表演进（accepted，2026-09-16）——核心相关（本任务的规范权威）

- 与本任务的关联点：issue #383 即其验收「缝 2（lease 两方法公共面）」实现票（P3；P1 #381、P2 #382 已 CLOSED/合并）。缝 2 范围 = runtime 组合面接收 `where` + registry lease 透传与类型面。
- 核心条款（原文摘录）：
  - §1 公共面：「`readArray` / `readMap` 的 options 增可选 `where`：`readonly WhereTerm[]`；不新增第四个读方法、不改 readData；恒四键结算 `{ ok, value, schema, truncated }` 与十四键 runtime 面不动。」——**「十四键 runtime 面不动」指键集/方法面不动，`where` 是 options 词表加法**。
  - §2 谓词项 v1：`WhereTerm = { field: string（v1 恰单段字面键，点号不拆分）, equals: string | number | boolean | null（标量闭集；number 须 Number.isFinite）}`；「数组 = 合取（全部满足）」；「空数组 `WINDOW_OPTIONS_INVALID`（……『要全集』的唯一写法是不传 `where`）」；「数组长度上限 16（实现票可调的哨兵值）」；「同 field 重复项合法」；「容器结构深相等、`in`、范围、OR/NOT、多段 field 全部是备案演进位（数组项形态加法，`where` 自身形状永不再变）」。
  - §4 管线序与对称性：「规范管线：**where（候选集筛选）→ orderBy（匹配集总序）→ n（窗口前缀）**」；「readArray **对称获得** `where`……`where` 不触碰 orderBy 面词表（readArray 仍仅 `by:'index'`）」。
  - §5 结算（**缝 2 的直接规范**）：「**匹配总数恒不承诺**（计数不可短路）」；「`truncated` 双语义：无 where：精确（`kept < total`，照旧）；有 where：**装满判定**——`kept === n` → `true`（可能还有匹配未入窗）；`kept < n` → `false`（扫完了，确定没有更多）」；「✂ 段：无 where 照现状按 truncated 装配（既有快照逐字节不变）；**有 where 永不装配**，过滤槽不呈现」；「计数诉求诚实降级为无兑现渠道：要计数给大 n」；「W1……成功结算……`{ ok: true, value, total: number | undefined }`——total 键恒在：无 where = 零值域标识计数（ADR 0028 现状语义）；有 where = `undefined`」（W1 三键是 doc-runtime 缝 1 面；**lease 恒四键不含 total**——备选节明文否决「结算加第五键 total：破坏恒四键 own 键集纪律」）。
  - §6 敌意校验与失败面（**缝 2 的 S3 镜像义务**）：「where 形状校验沿 S3 canonical 纪律：键集白名单（恰 `field`/`equals` 两键）、plain object 原型链、零 `[[Get]]`、零 accessor 执行、trap 异常收编——doc-runtime W1 权威校验与 runtime S3 镜像**两层同步扩**」；「失败码复用三码族：目标缺席 `WINDOW_TARGET_ABSENT`、载体不符 `WINDOW_CARRIER_MISMATCH`、规则非法（含 where 形状）`WINDOW_OPTIONS_INVALID`」。
  - §7 schema 无关与 authority 划界：「谓词比较的是**实际数据值**……schema 通道（元素口径投影文本）不受 where 影响」；「`where` 是读侧选择机制、谓词无领域语义（机制而非策略）……本决策不得被援引为在 where 上生长规则引擎的先例」。
  - §8 W1 冻结解除与镜像清账（P1 已执行）：「S4 候选计数自 namespace-runtime **下沉**进 W1……runtime 删除 S4 与全部出处标记镜像复制件……收缩为纯组合层（S3 净化 / S5 锚链 / S6 ✂ 装配）」——缝 2 不得在组合层重新引入计数或第三套 where 校验权威。
  - 备选（已否决，约束缝 2 形状）：独立 query/find API；「结算加第五键 total」；「✂ 段呈现过滤槽：文法复杂、输出可能很长；✂ 不装配后调用方自知查询参数」；容器深相等 equals。
  - 验收三缝之缝 2（**本票验收条文**）：「**缝 2（lease 两方法公共面）**：truncated 双语义、✂ 装配规则（无 where 逐字节不变 / 有 where 永不装配）、恒四键 own 键集、组合式 depth 等价锚、registry 透传、类型面 fail-closed（where 词表 / 数组形态 / 标量闭集）；先例 = issue #369 组合面测试家族与 runtime-data-interface.test-d」。

### ADR 0028 窗口读——readArray / readMap 的确定性选窗（accepted，2026-09-14）——核心相关（被 0029 词表演进的基契约）

- 与本任务的关联点：无 where 路径的**零漂移基准**（AC1 逐字节一致的对象）；排序/条目/失败/分层纪律全部沿它；#383 不得回归其任何条款。
- 核心条款（原文摘录）：
  - §1 公共面：`readArray` / `readMap` 两方法（lease 层），`n` 必填 ≥1 整数（`n:0` 非法）。
  - §3 值形态：统一条目列表 `[{index,value}]` / `[{key,value}]`；「身份随行」；「呈现序 = 有序基之序」。
  - §4 depth 组合式语义：「每个入选项 ≡ `readData(项路径, { depth, maxChildrenPerNode })`」；「终点宽度由 `n` 治理」——缝 2 等价锚的规范出处（ADR 0029 §4「组合式 depth……照搬 ADR 0028」）。
  - §7 结算与失败：「恒四键 `{ ok, value, schema, truncated }`；`truncated === kept < total`；窗口事实（`kept n/total N` + 基与方向）进 ✂ 段；total=0 时 `truncated:false`、无 ✂」；三稳定码 `WINDOW_TARGET_ABSENT`（响亮不吸收）/ `WINDOW_CARRIER_MISMATCH` / `WINDOW_OPTIONS_INVALID`；「敌意通道：options / orderBy 封闭数据形状校验，零外抛、零 accessor 执行」。
  - §9 分层与契约归属：「`@nomicore/namespace-runtime`：组合选窗与元素口径投影文本；`@nomicore/namespace-registry`：lease 公共面与类型别名」；「**readData 与 ADR-0024 的 options 零改动**」。

### ADR 0027 readData 投影文本化（accepted）——相关（恒四键与 ✂ 载体权威）

- 条款摘录：§1「成功分支**恒四键** `{ ok, value, schema, truncated }`」；「截断事实的唯一载体 = 投影文本内的 **✂ 段**」；L63 已备案同型态「文本不存在时截断事实仅剩 `truncated: true` 布尔；要消歧 → 无预算重读」。
- 关联点：窗口读 ✂ 窗口事实块是 ADR-0027 决策 1 的「窗口对偶」（`window-read.ts` L92–93）；ADR 0029 §5 在 where 在场时**显式决定** ✂ 永不装配——截断信号仅剩 `truncated` 布尔（装满判定），属已接受决策内的既定例外，非对 0027 的未授权偏离。readData options 闭合形状 `{ depth?, maxChildrenPerNode? }` 零变化。

### ADR 0008 NamespaceRuntime 读写能力与单序列器（accepted）——相关（runtime 读边界与停接纳）

- 条款摘录：「普通 open/read 不应再次编译或校验 VFSL」；「读取只观察调用瞬间已经提交的 live Y.Doc」；读取不进 sequencer；修订节 L123「**read 停接纳稳定码 `RUNTIME_READ_DISABLED`**：`close()` 进入 `closing`/`closed` 后，公共 read 的 lifecycle 失败……经同步结果联合返回该稳定码分支——lifecycle 失败不是路径缺陷，不借用路径失败码」；L178–179「读取保持 schema 无关、不进 sequencer、失败通道（`PATH_NOT_ALLOWED` / `RUNTIME_READ_DISABLED`）与读取保留不变量均不变」。
- 关联点：AC「close 后带 where 读 → `RUNTIME_READ_DISABLED`（停接纳不豁免，四键失败形）」即此条款在窗口面的既有覆盖（`runtime.ts` readArray/readMap S1 gate 先行、零 options 读取）；失败形 own 键集 = `{ok, code, path, message}` 恰四键（`RuntimeReadDisabledResult`）。

### ADR 0009 Namespace Registry leases 与宿主生命周期（accepted）——相关（lease 代理面与透传）

- 条款摘录（§NamespaceLease）：「Lease 是调用方唯一能力入口，代理 Runtime 除 `close()` 外的同步读取、投影、status、ROOT mutation 和 SCHEMA replacement；不公开裸 Runtime、DocHandle、Y.Doc 或 live Yjs 引用」；「release 后，除 `getStatus()` 外的操作通过其既有同步/异步结果通道返回稳定 `NAMESPACE_LEASE_RELEASED`」。
- 关联点：`readArray`/`readMap` 是 lease 代理同步读取面的既组成员（ADR 0028 §1 落地，issue #369）；registry 透传纪律 = ADR-0024 决策 6「registry lease 原样透传」同款（`lease.ts` L309–316 raw 引用直传、`types.ts` L468–485 单源别名 + `lease.ts` Equal 锁）——`where` 进 lease 面是 options 词表加法经既有透传通道，非 lease 面形状变化。

### ADR 0024 readData 形状预算（accepted）——相关（结构盲纪律，经 0027/0028/0029 引用）

- 关联点：值感知谓词筛选不进 readData options 的纪律源头；CONTEXT.md「形状预算」（L50）：「预算的 width 是**护栏**而非选择器——有意义的 N 项选择……走窗口读（ADR-0028）」。#383 不触碰 readData/预算轴。

### ADR 0023 Cordis 冻结服务表面（accepted）——弱相关

- 关联点：冻结的是**服务对象字面量构造纪律**（`nomicoreRegistry`/`nomicoreHubReplication`/`nomicorePeerReplication`/`clock` 等含函数成员的服务面，getter 化）。NamespaceLease 实例与 per-namespace Runtime 闭包不在其影响表内；#383 不触碰任何服务对象构造。

### ADR 0002 全新重写，authority 完全出范围（accepted）——相关（authority 划界）

- 条款摘录：「旧系统既有的 authority 规则体系……**完全排除在范围外，不保留接口**」。
- 关联点：ADR 0029 §7 已划界——where 谓词无领域语义（机制而非策略），非 authority 回潮；不得援引为规则引擎先例。

### 其余 ADR（0001/0003–0007/0010–0022/0025/0026）——无关或弱相关

- 与缝 2（runtime 组合面 + registry lease 透传）无条款交集：VFSL 语言/投影/校验（0001/0003/0004/0005/0007/0017–0021）、复制与分块传输（0010/0013/0022）、诊断日志（0011/0014）、持久化（0006）、实例身份（0012）、条件写/原子信封（0025/0026——ADR 0029 仅借用其「词汇」备案深相等演进位）、schema 投影旧版（0016——已被 0027 条款级修订）。

## CONTEXT.md 词条（现行词汇表，缝 3 已闭合）

- 「形状预算」（L50）：护栏 vs 选择器分工句（见上）。
- 「窗口读（window read）」（L61–63）：两方法、n 必填 ≥1、WindowTerm 词表、条目列表身份随行、组合式 depth、排序总序与平局锚、index 基位置序（issue #376）、schema 通道元素口径投影文本、三失败码；结尾「其谓词过滤词表演进（where）见『过滤窗口』」。
- 「过滤窗口（filtered window read）」（L65–67）：「窗口读的词表演进（ADR 0029）……**合取**语义……在选窗前过滤候选集（管线序 where → orderBy → n……readArray 对称获得）。**匹配总数不承诺**……where 在场时结算 `total` 位为 undefined、✂ 段永不装配，`truncated` 退化为装满判定（`kept === n` = 可能还有；`kept < n` = 确定没有）；where 缺席时沿窗口读精确语义（total = 标识计数、truncated = kept < total、✂ 照旧）。field 缺席 / 值非标量 / non-finite / 不可下钻安静不匹配……谓词无领域语义」；_Avoid_：「期望 ✂ 段或过滤槽呈现（where 在场永不装配）」「期望匹配总数或计数探针（要计数给大 n）」「OR/NOT/in/范围/多段 field（v1 词表外响亮拒绝，均为备案演进位）」。

## 模块 AGENTS（明确收录的边界）

- `packages/namespace-runtime/AGENTS.md`：读取留在 sequencer 之外（「Reads stay outside that sequencer」）；「Public APIs expose detached projections only」（活 Y.Doc/sequencer/内部件不外露）；完成 runtime 契约变更前跑根 `pnpm typecheck` / `pnpm test`。
- `packages/namespace-registry/AGENTS.md`：lease 是独立调用方能力、release 幂等；「Add public APIs only through `src/index.ts`」（若缝 2 需在 registry/runtime 公共面增类型导出，须经各自 `src/index.ts` 并纳入 public-surface 守卫）；根 typecheck + 测试门。
- `packages/doc-runtime/AGENTS.md`（若缝 2 需微调 W1）：「Keep reads schema-independent」「Add public APIs only through `src/index.ts`; public-surface guard tests must account for every export」——预期缝 2 零 doc-runtime 改动（W1 已于 #398 交付 where 与 `total: number | undefined`）。

## 当前代码事实（证据，非决策文本；仅用于确认基线状态）

- `packages/namespace-runtime/src/window-read.ts`（HEAD `de2ff55`）：组合层当前为**缝 1 中间态**——入口 fail-closed 分支（A2′/D8）`total === undefined ⟺ W1 已应用 where` → `seamWhereNotImplemented` 响亮 `WINDOW_OPTIONS_INVALID`（L161–168、L432–446，注释明言「缝 2 落地时本分支被『truncated 双语义 + ✂ 永不装配 + S3 镜像扩展』整体取代」）；S3 `canonicalWindowBudget` options 键集白名单**恰四键**（`n`/`orderBy`/`depth`/`maxChildrenPerNode`，L229–232——`where` 在场即「键集漂移」→ 视图不稳定两出口）；S6 `truncated = kept < total`、✂ 块按 truncated ∧ 正文非 null 装配（L189–197）；`total` 只从 W1 结算直通（零重算，单源纪律）。
- `packages/namespace-runtime/src/runtime.ts`：十四键公共面（L181「D2 十键协议 + close + 复制管理两键 + 窗口读两键 = 十四键」）；readArray/readMap 编排 S1 lifecycle gate 先行（`closing`/`closed` → `readDisabled`，零 options 读取、零 doc 触碰，L675–706）；`RuntimeReadDisabledResult` own 键集恰四键 `{ok, code:'RUNTIME_READ_DISABLED', path, message}`（L128–133）。
- `packages/namespace-registry/src/lease.ts`（L309–316）：`readArray`/`readMap` released 短路（`NAMESPACE_LEASE_RELEASED`）→ active 期 `entry.runtime.readArray/readMap(path, options)` **raw 引用直传**；L440–450 Equal 别名锁（lease options/result ≡ runtime 签名）。
- `packages/namespace-registry/src/types.ts`（L468–485）：`NamespaceLeaseReadArrayOptions = NamespaceRuntimeReadArrayOptions`、结果联合 = runtime 窗口联合 | released issue——单源别名链 `lease → runtime → doc-runtime`。
- `packages/doc-runtime/src/window.ts`（#398 后）：W1 options 键集白名单**恰五键**（含 `where`，L307–311）；`validateWhere`/`validateWhereTerm` 判据 = 数组形态、非空、≤16（`WHERE_TERM_LIMIT`）、稀疏空洞非法、零 accessor、plain object 原型链、恰 `field`/`equals` 两键、field 字符串、equals 标量闭集（finite number）——S3 镜像须与此**判据一致**；成功结算恰三键 `{ok:true, value, total}`、`total` 无 where = 候选标识计数 / 有 where = `undefined`（L246–249）；`WhereTerm` 自 `src/index.ts` type-only 导出（doc-runtime 层）。
- 类型面现状：`ReadArrayWindowOptions`/`ReadMapWindowOptions` 已含 `where?: readonly WhereTerm[]` 且 per-face `orderBy` 判别（readArray 仅 `IndexWindowTerm`、readMap `KeyWindowTerm | FieldWindowTerm`）——经单源别名链**已透传到 runtime 与 lease 类型面**（编译期 where 非数组/未知键/标量闭集/by-dir 词表混用拒绝的载体已在）；`WhereTerm` 尚未自 namespace-runtime / namespace-registry `src/index.ts` 再导出（调用方现只能结构化书写）。
- 测试先例在场：`packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts`、`runtime-data-interface.test-d.ts`；`packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`、`issue-369-window-read-lease-surface.test-d.ts`、`issue-382-lease-where-no-silent-pass.test.ts`（**条件不变式耐久形态**：`ok:true` ⟹ 条目全部满足谓词 / `ok:false` ⟹ 码恒 `WINDOW_OPTIONS_INVALID`——缝 2 落地后无需退役、必须继续绿）。
- 前置票状态：#381（P1）经 #392 合并（`1b639e0`）；#382（P2 缝 1）经 #398 合并（`de2ff55`）；父 PR #380（adr-0029-filtered-window 阶段集成）阶段收官统一合并——#383 同支累积，无中间态污染 main。
