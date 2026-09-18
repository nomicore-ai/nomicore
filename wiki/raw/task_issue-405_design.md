# SA1 实施架构设计 — Issue #405 `readData 面：maxBytes 交付总量收/拒闸（tracer）`

- 派发：`sa-f601b28b-e8e6-478c-aa45-0e101f1a43a1`（role `mabf-sa1`，phase `design`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-405`（branch `mabf/issue-405`，HEAD `fc6c1d3a4d…` = ADR 0031 入仓提交）
- 上游输入：SA6 验收契约 **rev2**（`wiki/raw/task_issue-405_sa6_contract.md`，494 行）、SA8 冲突门禁报告（`wiki/raw/task_issue-405_design_conflict_report.md`，verdict `clear`，RA-1/2/3 已闭合）、SA8 决议摘录（`wiki/raw/task_issue-405_relevant_decisions.md`）、任务简报（`wiki/raw/task_issue-405.md`，Comments 段空、REST `[]`）
- 母法：`docs/adr/0031-readdata-byte-budget.md`（决策 1–6 + 「对既有 ADR 的修订」+ 「验收」节）；术语面：`CONTEXT.md` L53–55「字节预算」词条
- 本设计为**实现前设计**：不含生产代码落地、不落盘测试、不运行门禁；SA6 §12.2/§12.3 的契约文件与断言组是验收权威，本设计给出实现架构、组合次序、类型传播、测试策略与文档义务的落地路径。

---

## 1. 任务类型、目标与非目标

**任务类型：Feature（tracer）**。ADR 0031 已接受、文档基座已入仓；`maxBytes` 面在 HEAD 零落地（SA6 §5 P1/P2：任何携带 `maxBytes` 的 `readData` 调用命中 options 键空间白名单 → `READ_OPTIONS_INVALID`「未知键」；类型面 `NamespaceRuntimeReadDataOptions` 仍是 doc-runtime 两键别名，`READ_BUDGET_EXCEEDED` 编译不可表达）。本设计把 ADR 0031 的 readData 面兑现为可实施架构。

**目标**：

1. `readData(path, options)` options 闭合形状扩为三键 `{ depth?, maxChildrenPerNode?, maxBytes? }`；`maxBytes` = 有限整数 **1..2^53−1**（`Number.isSafeInteger(v) && v >= 1`，SA8 RA-1 已钉死，非自由位）。
2. 校验与度量住 `@nomicore/namespace-runtime` 组合层（ADR 0031 决策 4）；交付总量 = 值通道 `utf8(JSON.stringify(value))`（紧凑、键序 = 交付序、`value === undefined` 计 0）+ schema 通道投影文本 UTF-8（✂ 段与头行自然计入、`schema: null` 计 0）；≤ 预算成功（成功交付物与同参无 `maxBytes` 读**逐字节相同**），> 预算零交付返回五键失败分支 `{ ok:false; code:'READ_BUDGET_EXCEEDED'; path; measuredBytes; message }`（`measuredBytes` 只报合计）。
3. registry lease 的 options 与结果类型别名**单源跟随**（lease 源码零改动），别名锁断言延伸。
4. 作用域文档词汇重录（**OBL-DOC-1**）按 SA6 §3.3 台账落地；窗口面三面义务（**OBL-WIN-1**）保持挂账、本票不动。

**非目标**：

- 不实现 `readArray` / `readMap` 的 `maxBytes`（D6：独立票；本票递延期守卫 = 窗口面携 `maxBytes` 维持 `WINDOW_OPTIONS_INVALID` 现行为）。
- 不改 `@nomicore/doc-runtime`（下传 options 仍为两键）、不改 `@nomicore/vfsl`（渲染器零选项纯函数）、不改投影文本头行/✂ 文法（头行**不记** `maxBytes`——D7，ADR 明文）。
- 不引入裁剪/部分交付/`over:'trim'`（ADR 0031 登记的演进位，`_Avoid_` 全家排除）。
- 不做性能阈值断言（ADR 0031 决策 6：`maxBytes` 不治理物化工作量；SA6 §7 无阈值）。
- 不新增校验码（复用 `READ_OPTIONS_INVALID`；唯一新码 `READ_BUDGET_EXCEEDED`，ADR 0031 决策 1/3）。

## 2. 当前行为与证据锚点（源码事实）

| # | 事实 | 锚点 |
|---|---|---|
| B1 | `NamespaceRuntimeReadDataOptions = ReadLogicalValueAtPathOptions`（doc-runtime 两键单源别名） | `packages/namespace-runtime/src/runtime.ts` L153–154 |
| B2 | 预算联合 `NamespaceRuntimeReadDataBudgetResult = ReadDataOkResult \| ReadLogicalValueBudgetFailure \| RuntimeReadDisabledResult`；失败面 = `PATH_NOT_ALLOWED \| READ_OPTIONS_INVALID`（+ lifecycle `RUNTIME_READ_DISABLED`），无 `READ_BUDGET_EXCEEDED` 名目 | runtime.ts L185–188、L148–151 |
| B3 | `readData` 双重载：预算在前、legacy 在后（`ReturnType` 取末签名 → registry `_readAlias` 锚前提）；实现体编排 S1 lifecycle gate → S2a 无 options 分支 → S2b 三参分支 → C 接缝净化 → P 投影 → 恒四键组装 | runtime.ts L239–245、L711–764 |
| B4 | 三参分支现状：`readLogicalValueAtPath(doc, path, options)` **直传 raw options**（T1 权威校验：G0 path 守卫 → OPT options 校验 → N0 probeRoot → N1 导航）；失败原样透传；成功后 `canonicalReadOptions(options)` 以同款读纪律重读 raw，失败走出口①（T1 重派发）/出口②（`seamReadOptionsInvalid` 接缝终态） | runtime.ts L738–757；`packages/doc-runtime/src/read.ts` L132–150 |
| B5 | `canonicalReadOptions`：键空间白名单恰 `depth`/`maxChildrenPerNode` 两键；descriptor data-property 取值（零 `[[Get]]`）；present-undefined 剥离；-0 归一；整体 try 收编 trap 异常；产出全新两键 plain 对象（`ResolveSchemaBudgetOptions`，直接喂 resolver） | runtime.ts L1041–1068、L1074–1076 |
| B6 | T1（doc-runtime `validateReadOptions`）读纪律：宿主 plain 判定 → `Object.keys` 键空间（own enumerable string）→ 逐键 `getOwnPropertyDescriptor`（accessor 拒、值 undefined ≡ 缺席、≥0 有限整数、-0 归一）；每个键恰好消耗 **2 次** descriptor 读（`Object.keys` 枚举过滤 1 次 + 显式 descriptor 读 1 次）；内层 try 收编探测期异常 | doc-runtime/src/read.ts L326–361 |
| B7 | **既有测试钉死 raw options 的 descriptor 读次数**：F-x5（状态化 trap，第 3 次起抛）期望 `descriptorCalls() === 4`（T1 #1/#2 → 净化 #3 抛 → 重派发 #4 抛）；F-x6（交替 trap，仅第 3 次抛）期望 `=== 5`（净化 #3 抛 → 重派发 #4/#5 过 → 出口②）；两处均只断言 code = `READ_OPTIONS_INVALID`、恰四键、message 非空、path 回显——**message 文本未钉死** | `packages/namespace-runtime/test/runtime-readdata-shape-budget-red.test.ts` L537–559 |
| B8 | 既有定序锚：F6 非法 path + 非法 options → `PATH_NOT_ALLOWED`（G0 优先于 options 校验）；F7 closing/closed + 非法 options → `RUNTIME_READ_DISABLED`（lifecycle 先于一切 options 触达） | 同上 L518–535；doc-runtime read.ts L133–138 |
| B9 | lease `readData` 双重载 raw 引用原样直传（released 短路优先、零预算解释/零校验/零敌意触达）；`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` Equal 锁在 `lease.ts` L478–489 | `packages/namespace-registry/src/lease.ts` L311–332、L472–489；`src/types.ts` L465–478、L732–738 |
| B10 | 头行 budgetSuffix 只认 depth/width 两轴；渲染器 `renderProjectionText` 零选项；`schema: null` 单义直通 | `packages/namespace-runtime/src/read-schema-projection.ts` L67–89、L155–195 |
| B11 | **既有类型锁钉死两键形状**：`runtime-readdata-shape-budget.test-d.ts` L86–89 `Equal<NamespaceRuntimeReadDataOptions, { depth?: number; maxChildrenPerNode?: number }>`（注释「doc-runtime 单源类型别名（零复制）」）——三键化后此锁**必须原位修订**，否则 root typecheck 编译红 | 该文件 L86–89 |
| B12 | `tsconfig.base.json` L10 `exactOptionalPropertyTypes: true`；`readData` 不进 sequencer、同步、零缓存（ADR 0008 + runtime AGENTS）；EOPT 下显式 `maxBytes: undefined` 对 TS 字面量调用者是编译错误 → D1 只在运行时/JS 调用者可观测 | tsconfig.base.json；`packages/namespace-runtime/AGENTS.md` |
| B13 | `git status` 零生产改动；SA6 全部探针已清理，证据留档 `artifacts/sa6-issue405-*.log` | SA6 §16；SA8 §2 事实核验 |

## 3. 根因 / 能力缺口（承接 SA6 §8）

能力缺口链（SA6 已证，本设计直接承接）：ADR 0024 曾把字节级预算委托给调用方 → ADR 0027 让 ✂ 段成为截断事实唯一载体 → 消费侧自造字节闸会砍前缀灭失 ✂ → ADR 0031 把预算收回引擎（整体序列化即度量、收/拒不裁剪），**但只有文档、零实现**。直接缺口：options 闭合形状只有两键，`maxBytes` 命中 T1 键空间白名单即拒（SA6 P1：A1≡A2≡A3–A8 逐字相同，值域判定从未发生）；类型链三处（runtime options 宿主 / 结果联合 / registry 别名 + Equal 锁）与组合层两道键空间闸（T1 与 canonical）构成本设计的**放大因素**——只改任何单点都会留下编译红或形状漂移（SA6 §8 放大因素①②③）。

## 4. Owner 要求落实

无 owner 评论（简报 Comments 段空；REST issue-comments 读取 `[]`；SA6 §2 与 SA8 §2 一致确认）。不存在评论来源的 override、豁免或附加义务。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| —（无） | — | 无 owner 评论 | 本节即为记录 |

## 5. 复现和根因承接

| 上游事实（SA6 契约 rev2） | 证据位置 | 设计响应 |
|---|---|---|
| P1 行为缺口：`maxBytes` ≡ 未知键（A1–A11），HEAD 拒绝来自键空间判定而非值域 | SA6 §5 P1；`artifacts/sa6-issue405-probe-runtime.log` | §7 DD-2/DD-3：组合层新增**拆分读**（split）把 `maxBytes` 从 T1 视野中剥离，T1 继续权威校验两轴与未知键；§7 DD-4 度量闸 |
| P2 类型面缺口：TS2353×4 / TS2322 / TS2367 / TS2339 | SA6 §5 P2；`…-probe-types.log` | §7 DD-5：runtime 自持三键闭合形状 + 预算联合追加五键失败成员；registry 经单源别名自动跟随 |
| P3 断言可实现性：参考闸门 10/11 绿、HEAD 11/11 红、红因单一 | SA6 §5 P3、§9 E3 | 度量与校验都住 runtime 组合层（ADR 0031 决策 4），本设计组合次序见 §8 |
| P4 D2 域边界：HEAD 对 `2^53` 域内外零判别力；C-LIMIT 必须组级判据 | SA6 §5 P4；`…-probe-d2-domain.log` | §7 DD-2：split 的 `maxBytes` 域判定 = `Number.isSafeInteger(v) && v >= 1`；§12 验收引用 SA6 G5 组级判据 |
| §12.0 冻结 fixture 与字节锚 R0–R12（CJK 种子、raw 变体、total/total−1 成对） | SA6 §12.0 | §11 ALLOW LIST 新 fixture 按此冻结；锚常量与文本同变更集更新（§13 风险 R-4） |
| §12.3 G1–G12 断言组 + §12.4 红/绿判定表 + §12.5 反伪绿 R1–R11 | SA6 §12.3–12.5 | §12 验收映射逐组承接；本设计的失败优先级阶梯（§8）是 G10/R8 的实现依据 |
| 既有 F-x5/F-x6 descriptor 读次数钉死 4/5（本设计补充核实的上游事实，见 §2 B7） | `runtime-readdata-shape-budget-red.test.ts` L537–559 | **§7 DD-2 的强制约束**：split 的读形态必须逐字镜像 T1（`Object.keys` + 逐键显式 descriptor），保证既有两键敌意面的读次序与计数零漂移（§8 数据流逐跳推演） |
| HEAD 既有 readData 面 27+5+2 测试全绿（基线） | `artifacts/sa6-issue405-runner-trigger.log` | §12 G7/G12 回归门禁；DENY LIST 保护既有红测/夹具零编辑 |

## 6. SA8 约束落实

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| ADR 0031 决策 1（域句：有限整数 1..2^53−1；三读面同条款；缺席 ≡ 不设预算；无魔法默认） | §7 DD-2、DD-6（D2 已收口） | 域判定实现为 `Number.isSafeInteger(v) && v >= 1`；`2^53`/`2^53+2`/`1e21` → `READ_OPTIONS_INVALID`；缺席/非 enumerable/present-undefined ≡ 不设预算 | 实现后核对（RA-8） |
| ADR 0031 决策 2（规范度量、账本不进公共面） | §7 DD-4 | 度量 = 交付后一次序列化遍历（O(交付字节)），成功面恒四键不加 bytes 键 | 实现后核对 |
| ADR 0031 决策 3（五键失败分支、`measuredBytes` 只报合计、≤ 判定、不裁剪、三面同码同文同载荷形） | §7 DD-4、DD-7 | 恰五键 own 键集；message 文案三面共用（面区分靠调用现场）；OBL-WIN-1 窗口面票须逐字镜像本票文案 | 实现后核对 |
| ADR 0031 决策 4（分层落点 + 零变化清单） | §7 DD-1、DD-3；§11 DENY LIST | doc-runtime/vfsl/渲染器/头行/✂/`DeepOptional`/无 options 逐字节全部零变化；lease 别名单源跟随 | 实现后核对（§12.8 第 4 条 git diff 证据） |
| ADR 0031 决策 5（缺席目标照常计量、终态非 no-op、where 无对撞） | §7 DD-4；§12 G6 | 闸在投影文本组装之后，`schema: null` 计 0、`value === undefined` 计 0 由构造保证 | 否 |
| ADR 0031 决策 6（使用指引进 typed-access 与作用域文档） | §7 DD-9（Phase B 重录内容含分工指引） | OBL-DOC-1 兑现 | 实现后核对 |
| SA8 RA-5：D1/D3/D4/D5 按观测面锁收口，D1/D3 选择会改断言字面 | §7 DD-6（全部收口） | D1 ≡ 缺席（沿 R1）；D3 runtime 自持三键 interface；D4 白名单纳三键 + 下传前剥离；D5 给统一文案（契约只断言域可区分）；D6 本票不动窗口面 | **是**（D1/D3 落地后按 RA-8 复核） |
| SA8 RA-7 / OBL-DOC-1：作用域文档重录同变更集或紧随同迭代，义务关闭前不得宣告本票完成 | §7 DD-9；§11 Phase B | 采用 SA6 默认形态：实现变更集对 `SCOPE_DOCS` 三文件**零 diff**，重录紧随同迭代独立落地（Phase B，逐项对照 SA6 §3.3 台账） | 实现后核对 |
| SA8 RA-4 / OBL-WIN-1：窗口面三面义务独立票；message 措辞镜像本票 | §7 DD-7（文案冻结为镜像基准） | 本票不动窗口面；递延期守卫 = 现行 `WINDOW_OPTIONS_INVALID` | 否（独立票触发时复核） |
| SA8 RA-8：实现后按 implementation 复查模式核对 §5 冻结面 | `structured_output.requiresConflictRecheck = true` | 见 §15 | —（即本标志） |

## 7. 设计决策与主要备选方案

### DD-1 组合边界（runtime composition boundary）

校验与度量全部住 `packages/namespace-runtime/src/runtime.ts` 的 `readData` 组合体（+ 包内 helper）——唯一同时见到值通道与 schema 通道的层（ADR 0031 决策 4；SA6 §9 E3 参考闸门实验证明校验必须在此层而非消费侧事后闸）。`doc-runtime`、`vfsl`、`read-schema-projection.ts`、窗口面**零改动**（§11 DENY LIST）。

### DD-2 拆分读 + 忠实中继（split + faithful relay）——本设计的核心机制

**问题**：T1（doc-runtime `validateReadOptions`）冻结为两键键空间，任何含 `maxBytes` 的 raw options 直传 T1 即未知键拒绝（HEAD 红点）；但 B7 证明既有 F-x5/F-x6 钉死了「T1 是 raw 的第一读者、每键恰 2 次 descriptor 读、canonical 是第二读者」的读次序——任何**在 T1 之前对 raw 的额外探测**（`in`、直读 `options.maxBytes`、预扫键空间）都会平移陷阱计数、击穿既有断言，且 `in`/直读违反零 `[[Get]]` 纪律（SA6 §12.5 R7）。

**方案**：新增包内 helper `splitReadDataOptions(raw)`，以**与 T1 逐字相同的读纪律**（`Object.keys` 键空间 + 逐键 `getOwnPropertyDescriptor` data-property 取值、零 `[[Get]]`、整体 try 收编）读取 raw 一次，产出**忠实中继对象 relay**：

```
splitReadDataOptions(raw) →
  { ok: true, relay: ReadLogicalValueAtPathOptions }   // relay = 两键空间视图
  | { ok: false, msg: string }                          // maxBytes 域/accessor/探测期异常 → READ_OPTIONS_INVALID
```

- **宿主门**：非对象/数组/非 `Object.prototype|null` 原型 → **relay = raw 原样直传**（T1 宿主检查先行拒绝，message 单源保留；对 raw 零 descriptor 读——宿主检查只耗 `getPrototypeOf`，与 T1 现次序一致）。这保住 N3（继承键宿主拒绝）与「数组/number/null 宿主」的 T1 单源 message。
- **plain 宿主分支**：逐 own-enumerable 键分流：
  - `maxBytes` 键：accessor → 拒（`getter` 零执行）；`desc.value === undefined` → 剥离（**D1：≡ 缺席**）；非 `Number.isSafeInteger(v) && v >= 1` → 拒（**D2 域**，SA8 RA-1 钉死）；否则**不进 relay**（该键被消费）。
  - 其余键（`depth` / `maxChildrenPerNode` / **未知键** / accessor 键 / present-undefined / 非法值）：`Object.defineProperty(relay, key, desc)` **原样复制**（保留 accessor 性、保留 data 值、不判域）——T1 对 relay 继续做**两轴域校验与未知键拒绝的单一权威**，message 单源不漂移。
  - `Object.keys` 谎报键（`desc === undefined`）→ 跳过（镜像 T1/canonical 处置）。
- **探测期异常**（trap 抛出）→ 收编为 `{ok:false}`（镜像 T1 V3 策略 A）。
- split **不提取 maxBytes 的值供闸门使用**（见 DD-4：闸门消费 canonical 的复读值）；split 的 `maxBytes` 域判定只为**前置拒绝定序**服务（G5/G10：非法 `maxBytes` 在 doc 触碰前短路，且先于导航失败——与 HEAD「非法 options 在 N0 前短路」的 V2 纪律对齐）。

**为什么必须在中继里保留未知键与 accessor**：`{maxBytes:1, nope:1}` 必须仍被 T1 以「未知键：nope」拒绝（G5 第四键矩阵）；accessor `depth` 必须仍由 T1 拒绝且 getter 零执行（既有 F-x 族语义）。中继是「键空间视图」而非「净化产物」——净化（canonical）仍独占在 T1 之后。

**备选与否决理由**：

| 备选 | 否决理由 |
|---|---|
| raw 直传 T1（现状） | `maxBytes` ≡ 未知键——正是要修的缺口 |
| runtime 自持全部校验（含两轴域、未知键），T1 只收净化产物 | 复制 T1 全部判据 → 三份校验逻辑（T1/canonical/split）；两轴域与未知键的 message 从 T1 单源漂移为 runtime 复制文本；中继吞掉未知键/accessor 将击穿 G5 与既有 F-x 语义 |
| 在 T1 之前用 `in`/直读探测 `maxBytes` | 平移 F-x5/F-x6 钉死的 descriptor 读计数（4/5 → 提前失败）；`in` 看继承键（键空间错误）；直读触发 `[[Get]]`（违反 N5/R7 零执行纪律） |
| doc-runtime 增设内部（非公共）三键入口 | 违反 ADR 0031 决策 4「doc-runtime 零改动」冻结面 |
| T1 失败后从 message 反推「这是 maxBytes 未知键拒绝」再放行重试 | message 是非契约诊断字段（doc-runtime L60），以文案解析做控制流是契约违约 |

### DD-3 canonical 接缝扩展（D4 收口）

`canonicalReadOptions(raw)` 扩展（签名参数类型放宽为三键 `NamespaceRuntimeReadDataOptions`）：

- 键空间白名单两键 → **三键**（`depth` / `maxChildrenPerNode` / `maxBytes`）；越界键 → `{ok:false}`（视图不稳定，出口①/② 语义原样延伸到三键面——G10）。
- `maxBytes` 分支：accessor → fail；`undefined` → 剥离；域（`Number.isSafeInteger && ≥1`）非法 → fail；合法 → 记录值。
- ok 产物从 `{ options: ResolveSchemaBudgetOptions }` 扩为 `{ options: ResolveSchemaBudgetOptions; maxBytes: number | undefined }`——`options` 仍**恒两键**（`maxBytes` 在**下传 resolver 之前剥离**，D4 推荐解；头行因此结构上不可能记录 `maxBytes`——D7 由构造保证）。
- 出口①重派发从「再调一次 `readLogicalValueAtPath(doc, path, options)`」改为「**再 split + 再 T1(relay₂)**」：re-split 失败 → 返回其 `READ_OPTIONS_INVALID`；re-split 过而 re-T1 败 → 原样返回；两者皆过 → 出口② `seamReadOptionsInvalid` 接缝终态成员（不变）。
- **读次序保持**：raw 仍恰被读两次（split → canonical），每次每键恰 2 个 descriptor 读——B7 的 F-x5=4 / F-x6=5 计数**逐点保持**（推演见 §8 路线 3）。

### DD-4 度量与收/拒闸（gate）

- **位置**：在投影文本组装（`projectReadDataSchema`）**之后**、恒四键组装之前——度量对象是**塑形后的交付物**（R6：`{depth:1,maxBytes:414}` 必须按塑形后 415 拒，而非预塑形 358 放行）。
- **预算权威**：闸门消费 **canonical 复读产出的 `maxBytes`**（与投影通道消费 `canonical.options` 同源——组合层的接缝单源事实；对稳定对象与 split 值恒等，对敌意漂移对象沿「后读为组合层权威」的既有纪律，见 §13 残余 R-2）。
- **度量等式（构造性）**：

```
valueBytes  = result.value === undefined ? 0 : Buffer.byteLength(JSON.stringify(result.value), 'utf8')
schemaBytes = schemaText === null ? 0 : Buffer.byteLength(schemaText, 'utf8')
measuredBytes = valueBytes + schemaBytes        // ✂ 段与头行在 schemaText 内自然计入
```

  紧凑 JSON、键序 = 交付序由 `JSON.stringify` 定义性保证（ADR 0031 决策 2「整体序列化即度量」——组合式记账零镜像代码，等式可 property test）。值通道交付 plain JSON 值（doc-runtime 深拷贝普通值），`JSON.stringify` 对其全函数（non-finite → `'null'`、lone surrogate → well-formed 转义，均为规范度量的定义部分，非异常通道）。
- **判定**：`maxBytes !== undefined && measuredBytes > maxBytes` → 返回五键失败分支；`≤`（含恰好等于与零总量）→ 成功，交付物与同参无 `maxBytes` 读**逐字节相同**（闸门透明：成功路径不触碰已组装的四键内容）。
- **失败分支构造**：`{ ok:false, code:'READ_BUDGET_EXCEEDED', path: echoReadPath(path), measuredBytes, message }`——path 新鲜回显（`echoReadPath` 既有纪律：非数组 → []、敌意 Proxy 坍缩 []、不别名实参）；恰五键、无 `value`/`schema`/`truncated`。

### DD-5 类型面与 lease 传播（D3 收口）

1. `NamespaceRuntimeReadDataOptions` 从 doc-runtime 别名改为 **runtime 自持三键闭合 interface**：

```ts
export interface NamespaceRuntimeReadDataOptions {
  depth?: number;
  maxChildrenPerNode?: number;
  maxBytes?: number;   // ADR 0031 决策 1：有限整数 1..2^53−1；缺席 ≡ 不设预算
}
```

   EOPT 语义与两轴一致（显式 `undefined` 字面量编译红；运行时 present-undefined ≡ 缺席）。`ReadLogicalValueAtPathOptions` 的 import 保留（relay/canonical 参数类型仍用 doc-runtime 两键类型）。
2. 预算联合追加 runtime 自持失败成员（包内名，不新增公共导出名——公共面经 `Extract<…, {code:'READ_BUDGET_EXCEEDED'}>` 结构可达，导出键集零扰动，public-surface guard 零改动）：

```ts
interface ReadDataBudgetExceededResult {
  readonly ok: false;
  readonly code: 'READ_BUDGET_EXCEEDED';
  readonly path: readonly (string | number)[];
  readonly measuredBytes: number;
  readonly message: string;
}
export type NamespaceRuntimeReadDataBudgetResult =
  | ReadDataOkResult
  | ReadLogicalValueBudgetFailure
  | ReadDataBudgetExceededResult
  | RuntimeReadDisabledResult;
```

   命名沿 `RuntimeReadDisabledResult` 先例（runtime 自持失败成员）。legacy 联合 `NamespaceRuntimeReadDataResult` **零变化**（零泄漏：无 options 调用结构上不可达预算码——B2 注释纪律延伸）。
3. **registry 源码零改动**：`lease.ts` L322/326、`types.ts` L736 均按名引用 `NamespaceRuntimeReadDataOptions`；`NamespaceLeaseReadDataBudgetResult = NamespaceRuntimeReadDataBudgetResult | NamespaceLeaseReleasedIssue`（types.ts L476–478）单源别名 → 三键 options 与新失败分支**传递跟随**；`_readBudgetAlias` Equal 锁自动覆盖新分支；`_readAlias`（`ReturnType` 末签名 = legacy）不受影响；`_readOverloadOrder` 延续。lease 行为面零新增逻辑（raw 引用直传不变）。
4. **既有类型锁的原位修订（对 SA6 §12.2 文件清单的必要补充）**：`runtime-readdata-shape-budget.test-d.ts` L86–89 的两键 `Equal` 锁在三键化后必然编译红（B11）——**必须**原位修订为三键闭合形状锁（该锁的语义本来就是「options 闭合形状」锚，其期望随 ADR 0031 对 ADR 0024 决策 1 的再修订而演进，修订链在两 ADR 状态行在案）。SA6 §12.2 未列此文件；本设计把它加入 ALLOW LIST 并在此记录理由——这是实现门禁（root `pnpm typecheck` exit 0，AC⑩/G12）的结构性必要条件，不是范围扩张。registry 侧 `registry-readdata-budget-passthrough.test-d.ts` 的原位扩展（options 跟随锁等）按 SA6 §12.2 已列名执行。

### DD-6 SA6 §12.7 design pin 收口表

| # | Pin | 本设计收口 | 理由 |
|---|---|---|---|
| D1 | `{maxBytes: undefined}`（键在场、值 undefined） | **≡ 缺席**（split 剥离、canonical 剥离） | 沿既有轴 R1 纪律（doc-runtime L349、canonical L1055 同款）；EOPT 下 TS 调用者不可达，仅 JS 调用者可观测 |
| D2 | `maxBytes` 上界 | **非自由位**：1..2^53−1（`Number.isSafeInteger(v) && v >= 1`） | ADR 0031 决策 1 域句 + SA8 RA-1；「接受 `2^53`」分支已删（再引入须 ADR 修订计划 + SA8 复核） |
| D3 | options 类型宿主 | **runtime 自持三键闭合 interface**，doc-runtime 零改动，lease 同名别名跟随 | DD-5；观测面（三键接受、第四键编译红、doc-runtime 两键锁）全满足 |
| D4 | canonical 对 `maxBytes` 的处置 | **纳入三键白名单 + 下传 resolver 前剥离**；视图不稳定仍走出口①/② | DD-3；G10（零 `[[Get]]`、不抛、键空间纪律）全满足 |
| D5 | message 文案 | **给出统一文案**（DD-7），契约断言不变（仍只断言域可区分） | 文案三面共用（OBL-WIN-1 镜像基准）；不钉死在契约里 |
| D6 | 窗口面与本票关系 | **本票不动**；递延期守卫 = 窗口面携 `maxBytes` → `WINDOW_OPTIONS_INVALID`（现行行为，零改动自然保持） | ADR 0031 §1 三面义务独立票（OBL-WIN-1） |
| D7 | 头行 | **不记 `maxBytes`**（canonical 剥离 → 结构保证） | ADR 0031 决策 4 明文，非自由位 |

### DD-7 message 文案（建议值；契约只断言「maxBytes 域可区分 + 非空 + 与未知键 message 不同」）

- 预算超限（三面同文，面区分靠调用现场——ADR 0031 决策 3；窗口面票逐字镜像）：
  ``READ_BUDGET_EXCEEDED: 读交付总量 ${measuredBytes} 字节超出 maxBytes ${maxBytes}——零交付拒绝（不裁剪、不降深度；ADR 0031）``
- `maxBytes` 域非法（split 构造，runtime 复制成员——沿 `seamReadOptionsInvalid` 的 D1 豁免登记先例，形状由 `ReadLogicalValueBudgetFailure` 类型注解锁死）：
  ``READ_OPTIONS_INVALID: options.maxBytes 必须是 ≥1 的有限整数（≤ 2^53−1）``
- `maxBytes` accessor（getter 零执行）：
  ``READ_OPTIONS_INVALID: options.maxBytes 不得为 accessor（零 accessor 执行纪律）``
- split 探测期异常（镜像 T1 V3 措辞）：
  ``READ_OPTIONS_INVALID: options 探测期异常（敌意对象）——已收编为 READ_OPTIONS_INVALID``
- 宿主非法与两轴域/未知键：**T1 单源 message 原样透传**（relay/原样直传保证，不复制）。

### DD-8 失败优先级阶梯（G10/R8 的实现依据）

```
S1 lifecycle ≠ ready         → RUNTIME_READ_DISABLED  （零 options 读取、零 doc 触碰）
G0 path 非数组               → PATH_NOT_ALLOWED        （2 参直调 doc-runtime；零 options 读取——保 F6 定序）
split: maxBytes 域/accessor/探测异常 → READ_OPTIONS_INVALID（runtime 构造；零 doc 触碰）
T1(relay): 宿主/两轴域/未知键  → READ_OPTIONS_INVALID   （单源 message；零 doc 触碰）
T1(relay): 导航/载体失败       → PATH_NOT_ALLOWED       （值通道失败优先于预算判定——T8）
canonical 视图不稳定          → 出口①（re-split/re-T1 失败即返）/出口② seam 成员 → READ_OPTIONS_INVALID
投影（可信域）                → InternalError throw 逃逸（唯一逃逸通道，既有语义不变）
预算闸门                      → READ_BUDGET_EXCEEDED    （度量在全部成功通道之后）
                              → 恒四键成功
```

### DD-9 文档义务（OBL-DOC-1）形态与内容

- **形态**：采用 SA6 §12.6 默认——**实现变更集（Phase A）对 `SCOPE_DOCS` 三文件零 diff**；重录以**紧随同迭代**的独立变更集（Phase B）落地，逐项对照 SA6 §3.3 台账；两形态都不跨迭代悬空，义务关闭前不得宣告本票完成（SA8 RA-7）。
- **Phase B 重录内容（实名清单）**：
  1. `.agents/skills/nomicore/typed-access.md` L125：清退「the closed options shape accepts **only the two budget keys**」句（三键化即失真）；同段（Shape-budget reads）或紧邻新增小节收录：三键闭合形状；`maxBytes` 域（有限整数 1..2^53−1；0/负/非整数/非有限 → `READ_OPTIONS_INVALID`）；总量语义（值通道紧凑 JSON + 投影文本 UTF-8，✂/头行自然计入，`schema:null` 计 0、`value === undefined` 计 0）；超限零交付 `READ_BUDGET_EXCEEDED` + `measuredBytes` 合计；恰好等于成功（≤）；成功交付物与无预算读逐字节相同；缺席目标可超限；**分工指引**（ADR 0031 决策 6：控制形状与物化用形状预算/窗口读；`maxBytes` 只治理交付总量，不治理物化工作量）。
  2. `docs/integration/cordis-plugin-hosting.md` L360–365 预算读段：`封闭形状 { depth?, maxChildrenPerNode? }` → 三键；补一句 `maxBytes` 收/拒语义与 `READ_BUDGET_EXCEEDED` 词汇。
  3. `docs/integration/external-project-vfsl-codegen.md` L288 readData 结果段：补 `maxBytes` 词汇与预算失败分支（五键形）。
- **非对象**：`CONTEXT.md` 与 `docs/adr/**` 在 HEAD 已由 ADR 0031 修订自洽（0024/0027 状态行登记再修订链），本票零触碰。

## 8. 接口、状态机与数据流

### 8.1 组合体伪代码（`readData` 实现体；设计伪代码，非落地文本）

```
function readData(path, options?) {
  // S1 lifecycle gate（不变；零 options 读取）
  if (state.lifecycle !== 'ready') return readDisabled(lifecycle, path);

  // S2a 无 options（不变——逐字节现行为回归锚 G7/AC⑦）
  if (options === undefined) { …两参值读 + projectReadDataSchema(state, path) + truncated:false… }

  // S2b-0 G0 前置分支（新增；保 F6 定序：path 与 options 双非法 → PATH_NOT_ALLOWED）
  if (!Array.isArray(path)) return readLogicalValueAtPath(doc, path);  // doc-runtime G0 单源拒绝，零 options 读取

  // S2b-1 拆分读（新增）
  const split = splitReadDataOptions(options);
  if (!split.ok) return budgetAxisInvalid(path, split.msg);            // READ_OPTIONS_INVALID（maxBytes 域）

  // S2b-2 T1 权威（改为传 relay；两轴域/未知键/宿主单源 message + 值读）
  const result = readLogicalValueAtPath(doc, path, split.relay);
  if (!result.ok) return result;                                       // PATH_NOT_ALLOWED | READ_OPTIONS_INVALID

  // S2b-3 接缝净化（扩展三键；复读 raw）
  const canonical = canonicalReadOptions(options);
  if (!canonical.ok) {
    const reSplit = splitReadDataOptions(options);                     // 出口①：re-split
    if (!reSplit.ok) return budgetAxisInvalid(path, reSplit.msg);
    const reDispatch = readLogicalValueAtPath(doc, path, reSplit.relay);
    if (!reDispatch.ok) return reDispatch;
    return seamReadOptionsInvalid(path);                               // 出口②（不变）
  }

  // S2b-4 投影（canonical.options 恒两键 → 头行/✂ 零漂移）
  const schemaText = projectReadDataSchema(state, path, canonical.options, result.truncations);

  // S2b-5 预算闸门（新增；canonical.maxBytes 为组合层单源预算事实）
  if (canonical.maxBytes !== undefined) {
    const measured = deliveryBytes(result.value, schemaText);          // DD-4 度量等式
    if (measured > canonical.maxBytes) return readDataBudgetExceeded(path, measured, canonical.maxBytes);
  }

  // S2b-6 恒四键组装（不变）
  return { ok: true, value: result.value, schema: schemaText, truncated: result.truncated };
}
```

同步纯函数：不进 sequencer、零缓存、零订阅、零状态写入（ADR 0008 + runtime AGENTS；SA6 §7）。无状态机新增；生命周期面（S1）不变。

### 8.2 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 1. 无 options 读 | 调用方 `readData(path)` | —（零写入） | S2a 原路径 | — | 两参值读 + 两参投影 | 恒四键（逐字节 = HEAD） | 既有失败面 | G7/G8、F5 基线 |
| 2. 两键 options 读（既有面） | `readData(path, {depth/maxChildrenPerNode})` | relay（组合层临时对象） | split 复制（零 `[[Get]]`）→ T1(relay) → canonical 复读 raw | — | 同 HEAD | 恒四键，值/文与 HEAD 逐字节一致；敌意面读次序/计数不变 | 同 HEAD（F-x5=4/F-x6=5 计数保持） | G7、既有 shape-budget 红测全绿 |
| 3. 敌意 options（带 `maxBytes`） | `readData(path, Proxy{maxBytes…})` | — | split 读 #1/#2 → T1(relay) 零 trap → canonical 读 #3（可抛）→ 出口① re-split #4（+#5） | — | — | 全部收敛 `READ_OPTIONS_INVALID`/`RUNTIME_READ_DISABLED`，绝不外抛、getter 零执行、非 enumerable ≡ 无预算 | trap 异常由 split/canonical 各自 try 收编 | G10、N4/N5/N7 |
| 4. 预算读（新面） | `readData(path, {…, maxBytes})` | 五键失败分支（或四键成功） | split（域判定+剥离）→ T1(relay) → canonical（域复读）→ 投影 → `JSON.stringify(value)`/`Buffer.byteLength(schemaText)` → ≤/> 判定 | — | 交付后一次序列化遍历（O(交付字节)） | ≤：成功且与同参无 `maxBytes` 读逐字节相同；>：五键 `READ_BUDGET_EXCEEDED`（`measuredBytes` 合计） | 零交付即零清理（无部分交付） | G1–G6、§12.0 锚表 total/total−1 成对 |
| 5. lease 透传 | `lease.readData(path, options)` | — | released 短路 → raw 引用直传 runtime | — | 同路线 1–4 | 与 runtime 同参结果逐字段相等 | `NAMESPACE_LEASE_RELEASED`（三键）先行 | G9 |
| 6. 类型传播（编译期） | TS 消费方 | runtime.ts 类型声明 | registry 按名单源别名 | — | vitest `--typecheck`（`tsconfig.typecheck.json`） | 三键接受、第四键编译红、新失败分支 `Extract` 五键、doc-runtime 两键锁 | — | G9 类型面、`issue-405-maxbytes.test-d.ts` |

跨模块边界说明：relay/canonical 产物均为组合层新建 plain 对象（不对调用方对象做任何变异——零 options 变异纪律延伸）；`Buffer.byteLength` 是 Node 内建，无新依赖；无跨进程/持久化跳。

## 9. 错误、恢复、并发和幂等

- **错误面**：全部同步结果联合（非抛、非 Promise）；唯一 throw 逃逸通道仍是可信域 `InternalError`（投影面，不变）。新失败分支恰五键；`measuredBytes` 为两通道合计 number。
- **恢复/重试语义**：预算拒绝是**确定性可重试**的调用方动作——调用方换更小 `maxBytes`、或加形状预算/窗口读降总量后重读（ADR 0031 决策 6 指引进 Phase B 文档）；同参重复读逐字节相同（SA6 §7 确定性前提），无 flake 源。
- **并发/幂等**：读取不进 sequencer、零缓存、零订阅；`maxBytes` 判定只依赖 (doc 状态, path, options)——单调用内 raw 恰读两次（split/canonical），无跨调用共享状态。lifecycle gate 先于一切 options 读取（closing/closed 期敌意 trap 零执行——N7 延伸）。
- **资源所有权**：五键失败分支与成功四键均为新鲜对象；path 经 `echoReadPath` 新鲜回显（实参事后变异不影响已返回结果）；relay/canonical 为组合层私有，不逃逸。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `lease.readData` 双重载消费方 | raw 直传 | 同（零逻辑变化）；三键 options 与新失败分支经别名自动可达 | **零** | lease.ts L311–332；types.ts L476–478 |
| `apps/yjs-server` 等单参消费方 | legacy 联合 | 不变（`ReturnType` 末签名锁延续；legacy 联合零变化） | **零** | SA6 §10；`_readOverloadOrder` 锁 |
| 两键预算读消费方（既有测试/业务） | 两键闭合形状 | 结构性兼容（三键 interface 超集；`asOptions` 等 cast 仍编译） | **零** | B11 仅 Equal 锁期望需原位演进（DD-5.4） |
| 携 `maxBytes` 的新消费方（agent/L2 工具） | HEAD 上不可表达（TS2353/未知键拒绝） | 新能力：收/拒闸 + `measuredBytes` | 消费侧按 Phase B 文档采用 | SA6 §5 P1/P2；ADR 0031 背景 |
| 窗口面 `readArray`/`readMap` 消费方 | `WINDOW_OPTIONS_INVALID`（携 `maxBytes`） | 不变（递延期守卫） | **零** | N9/G11；D6 |
| doc-runtime 直调消费方 | 两键闭合形状 | 不变（N11 行为锚：`{maxBytes:1}` → `READ_OPTIONS_INVALID`） | **零** | doc-runtime 冻结 |

## 11. 文件范围

### ALLOW LIST — Phase A（实现变更集：生产代码 + 契约测试；`SCOPE_DOCS` 零 diff）

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/namespace-runtime/src/runtime.ts` | `NamespaceRuntimeReadDataOptions` 改自持三键 interface；预算联合追加 `ReadDataBudgetExceededResult`；`readData` 组合体（G0 前置分支 / split / T1-relay / canonical 扩展 / 闸门）；新增 `splitReadDataOptions`、`budgetAxisInvalid`、`readDataBudgetExceeded`、`deliveryBytes` 包内 helper；`canonicalReadOptions` 三键白名单 + `maxBytes` 剥离与回传；接口成员与实现体 JSDoc（第三轴、失败分支、优先级阶梯） | DD-1–DD-5、DD-8 全部生产面改动集中于此 |
| `packages/namespace-runtime/src/index.ts` | **仅注释**：`#336 增量` 段后补一行 #405 增量说明（options 三键、预算联合追加 `READ_BUDGET_EXCEEDED`）；导出键集零变化 | 导出面文档诚实；public-surface guard 零触碰 |
| `packages/namespace-runtime/test/issue-405-maxbytes-fixture.ts` | 新增：SA6 §12.0 冻结 fixture（CJK 种子 + raw 变体）+ 锚常量 R0–R12 + 参考闸门 oracle 辅助 | SA6 §12.2；非 `*.test.ts` 不被收集 |
| `packages/namespace-runtime/test/issue-405-maxbytes-red.test.ts` | 新增：G1–G6、G10 断言组 | SA6 §12.2 |
| `packages/namespace-runtime/test/issue-405-maxbytes-control.test.ts` | 新增：G7、G8、G9(部分)、G11 回归/负控 | SA6 §12.2 |
| `packages/namespace-runtime/test/issue-405-maxbytes.test-d.ts` | 新增：类型面（三键闭合、第四键编译红、doc-runtime 两键硬锁、`Extract` 五键、legacy 零泄漏延续） | SA6 §12.2 |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget.test-d.ts` | **原位修订** L86–89 `_optionsAlias` 两键 Equal 锁 → 三键闭合形状锁 | B11：三键化后必然编译红；锁语义随 ADR 0031 对 ADR 0024 决策 1 的再修订演进（DD-5.4，对 SA6 §12.2 清单的必要补充） |
| `packages/namespace-registry/test/issue-405-lease-maxbytes-passthrough-red.test.ts` | 新增：G9 行为（lease ≡ runtime、released 短路、lifecycle、legacy 单参通道） | SA6 §12.2 |
| `packages/namespace-registry/test/issue-405-lease-maxbytes-surface.test-d.ts` | 新增：G9 类型（`_readBudgetAlias` 延续 + options 跟随锁 + `measuredBytes` 载荷 + 末签名锁） | SA6 §12.2 |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test-d.ts` | 原位扩展：options 跟随锁等（SA6 §12.2 已列名） | 既有别名锁延伸点 |
| `wiki/raw/task_issue-405_design.md` | 本设计产物 | SA1 固定产物 |

### ALLOW LIST — Phase B（OBL-DOC-1 重录；紧随同迭代独立变更集，逐项对照 SA6 §3.3 台账）

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `.agents/skills/nomicore/typed-access.md` | L125「only the two budget keys」句清退；`maxBytes` 收/拒语义 + `READ_BUDGET_EXCEEDED` 词汇 + 决策 6 分工指引 | OBL-DOC-1（SA8 RA-3/RA-7） |
| `docs/integration/cordis-plugin-hosting.md` | L360–365 预算读段三键化 + `maxBytes` 语义句 | OBL-DOC-1 |
| `docs/integration/external-project-vfsl-codegen.md` | L288 readData 结果段补 `maxBytes`/预算失败分支词汇 | OBL-DOC-1 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/**` | 值通道/校验器下层 | ADR 0031 决策 4「零改动、下传两键」冻结面；N11/G11 负控锚 |
| `packages/vfsl/**` | 投影渲染器 | ADR 0027 决策 2 零选项纯函数；G8 逐字节快照 |
| `packages/namespace-runtime/src/read-schema-projection.ts` | 头行/✂ 组装 | D7 头行不记 `maxBytes`（canonical 剥离即结构保证，渲染面零触碰） |
| `packages/namespace-runtime/src/window-read.ts` 及窗口面一切源码 | `readArray`/`readMap` | D6：三面义务独立票（OBL-WIN-1）；递延期守卫由现行行为自然保持 |
| `packages/namespace-registry/src/**` | lease/registry 源码 | 别名跟随是类型级传播；lease raw 直传零解释（B9）；源码零改动是「透传」语义的证据 |
| `packages/namespace-runtime/src/index.ts` 的导出语句区 | 公共导出面 | 导出键集被 public-surface guard 锚定；新失败分支经 `Extract` 结构可达即可（DD-5.2） |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget-red.test.ts`、`runtime-readdata-shape-budget-fixture.ts`、`helpers/readdata-ok-shape.ts`、其余既有测试与快照常量 | 既有 readData 面回归锚 | F-x5/F-x6 计数、锚常量、敌意构造器是本设计必须保持的基线（DD-2 读次序 parity 即为此设计） |
| `CONTEXT.md`、`docs/adr/**` | 术语与决议面 | ADR 0031 在 HEAD 已完成对 0024/0027/CONTEXT 的修订（状态行在案），tracer 零触碰 |
| `vitest.config.ts`、`tsconfig*.json`、`apps/**`、`package.json` | 发现入口/消费方 | SA6 §14 已证实现有配置覆盖新契约文件；消费方零改动（§10） |

## 12. 验收与验证映射

验收权威 = SA6 §12.3 断言组 G1–G12 + §12.4 红/绿判定表 + §12.5 反伪绿 R1–R11 + §12.8 门禁清单；本节映射设计路线，不重复断言文本。

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC①② 总量 ≤ 成功、恰好等于成功、逐字节一致 | SA6 §9 E3 参考闸门 T1/T3/T7 绿 | `issue-405-maxbytes-red.test.ts` G1/G2（§12.0 锚 total 收 / total−1 拒**成对**） | 四键全等 `toStrictEqual`；schema 逐字节；R8 零总量 `maxBytes:1` 收 |
| AC③ 超限零交付五键分支 | SA6 P3 T2 | G3：own 键集恰五键、`measuredBytes === total` 且 ≠ 单通道（358≠120≠238）、path 新鲜回显 | 恰 `['ok','code','path','measuredBytes','message']`；实参变异不污染 |
| AC④ 度量等式 property | SA6 §9 E4（utf8 vs utf16 敏感） | G4：9+2 锚 ×（total−1 拒 / total 收），oracle = 同参无 `maxBytes` 读独立两通道测量 | `measuredBytes === utf8(JSON.stringify(o.value)) + utf8(o.schema ?? '')` |
| AC⑤ options 负控 + 域区分 + C-LIMIT | SA6 §5 P4（伪绿陷阱） | G5：非法矩阵 + `2^53`/`2^53+2` 拒绝锚 **∧** `1`/`2^53−1` 接受锚**同组**（组级判据） | 全 `READ_OPTIONS_INVALID` 恰四键；接受锚 `ok:true` 且与无预算读逐字相同 |
| AC⑥ 缺席目标 × 超限 | SA6 §12.0 R7 | G6：`(['nick'], {maxBytes:26})` 拒 measured 27；`{maxBytes:27}` 收 | 值侧 0、投影文本照常计量 |
| AC⑦ 无 options/空预算/两键回归 | 基线 412 files/5021 tests | G7 + 既有 shape-budget/projection 套件全绿 + F-x5=4/F-x6=5 计数 | 逐字节现行为；读次序零漂移 |
| AC⑧ 恒四键 + ✂/头行零漂移 | 既有投影快照 | G8：`{depth:1,maxBytes:415}.schema === {depth:1}.schema`；头行无 `maxBytes` | `expectReadDataOkKeys`；快照锚不变 |
| AC⑨ lease 跟随 + 别名锁 | B9 Equal 锁 | G9：行为（lease ≡ runtime、released 短路先行）+ 类型（`_readBudgetAlias` 延续、options 跟随、`Extract` 五键、doc-runtime 两键硬锁 `Equal<keyof ReadLogicalValueAtPathOptions,…>`） | 只改 runtime 不改别名即编译红（锁的结构作用） |
| AC⑩ 门禁 | SA6 §14 runner 实跑 | G12：包内 `tsc -p` ×2 + `vitest run`（含 `--typecheck`）+ root `pnpm typecheck` / `pnpm test`；`git diff --stat` 证 DENY 面零 diff（含 `SCOPE_DOCS` 三文件 Phase A 零 diff） | exit 0；文件/测试数 ≥ 基线 + 新契约文件；零 skip/only/todo |
| 敌意/定序（设计派生） | B7/B8 | G10：lifecycle > 校验 > 预算；`PATH_NOT_ALLOWED` 先于预算；Proxy trap 0 次；accessor getter 0 次；非 enumerable ≡ 无预算 | §8.1 阶梯逐行可观察 |
| 范围守卫 | N9/N11 | G11：窗口面/doc-runtime 面携 `maxBytes` 各走其码；无预算窗口行为指纹不变 | `WINDOW_OPTIONS_INVALID` / `READ_OPTIONS_INVALID` |

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 评级 | 缓解/处置 |
|---|---|---|---|
| R-1 | split 读形态与 T1 不完全同构 → F-x5/F-x6 计数漂移、既有红测翻红 | 高（实现期） | DD-2/§8.2 路线 3 逐跳推演（#1/#2 → #3 → #4/#5）；实现评审 Checklist 首项 = split 必须逐字镜像「`Object.keys` + 逐键显式 descriptor」模式 |
| R-2 | 敌意对象在 split 与 canonical 两读之间**合法值漂移**（如 `maxBytes` 100→50、depth 1→2，均域内）不可检测 | 低（继承性） | HEAD 既有纪律即「判据判定」而非「值比对」（canonical 注释 L1036–1039）；本设计不扩大该面：闸门消费 canonical 后读值、投影消费 canonical 后读值，两通道对**同一次后读**对齐；登记为与 HEAD 同款的接受残余，不新造值比对语义 |
| R-3 | `JSON.stringify` 对值通道的全函数性 | 极低 | 值通道交付 plain JSON 值（doc-runtime 深拷贝契约）；non-finite → `'null'`、lone surrogate → well-formed 转义均为规范度量定义；bigint/函数不可由载体产生 |
| R-4 | §12.0 字节锚与 fixture 文本强耦合 | 中 | 夹具常量与锚值同变更集更新（SA6 §12.0 纪律）；任何文本改动必须同步改锚否则断言即红（预期红，非伪绿） |
| R-5 | OBL-DOC-1 悬空（SA8 RA-7：义务关闭前不得宣告本票完成） | 中（流程） | Phase B 实名清单已给（DD-9）；实现迭代排票须把 Phase B 紧随 Phase A |
| R-6 | 公共面演进（options 三键 + 新失败分支）为破坏性 minor | 已授权 | ADR 0031 验收节明示「发布随 minor bump（0.x 破坏性 minor）」；消费方可枚举（§10 矩阵零改动列） |
| 回滚 | 单文件生产面（runtime.ts）+ 测试文件；无持久化/协议/状态迁移 | — | revert Phase A（+Phase B）即完整回滚；无 options/两键面在实现前后逐字节不变，回滚对既有消费方零感知 |

**任务内必要条件**（不得伪装成 follow-up）：R-1 的读次序 parity 是实现验收的一部分（G7 既有红测 + 计数断言）；B11 的 Equal 锁原位修订在 Phase A 内完成。

**明确 follow-up**（合法递延）：OBL-WIN-1 窗口面三面义务（独立票，message 措辞镜像 DD-7 文案）；载荷拆分值/口径分项（ADR 0031 登记的加法演进位）；可选裁剪模式（ADR 0031 开放问题，不因本票承诺）。

## 14. 评审修订映射

`wiki/raw/task_issue-405_sa2_review.md` 不存在（本派发 iteration 0，尚无 SA2 评审输入）——本节无适用 finding；后续评审到达时由下一设计迭代逐条落实并填充本表。

## 15. 是否需要设计后 ADR 冲突复查

**`requiresConflictRecheck = true`**。理由：

1. **公共 API 变化**：`readData` 预算重载 options 闭合形状两键 → 三键、结果联合追加新失败分支 `READ_BUDGET_EXCEEDED`（五键）——SA8 RA-8 明示实现 diff 就绪后须按 implementation 复查模式核对其 §5 冻结面。
2. **SA8 RA-5 已预告**：D1/D3 pin 的收口选择（D1 ≡ 缺席；D3 runtime 自持 interface）会改断言字面，落地后须复核——本设计已收口（§7 DD-6），复核条件即本次触发。
3. **B11 既有 Equal 锁原位修订**是对 SA6 §12.2 契约文件清单的补充（新增 `runtime-readdata-shape-budget.test-d.ts` 原位修订项）——契约断言面发生了设计层修正，SA6 §1「SA1 若对 §12.7 现存 pins 另有选择，须先原位修订本契约对应断言字面并触发复核」的同类义务。

无 hard conflict、无 override：本设计全部条款在 ADR 0031（母法）、ADR 0027/0024（修订链后）、ADR 0028/0029（递延期）、ADR 0008、CONTEXT.md 词条与模块/文档 AGENTS 纪律的授权或事实面之内（SA8 §3 裁决分布：no-conflict 12 / implements-existing-decision 6）。
