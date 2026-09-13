# SA1 实现设计 — issue #369 W2：lease 公共面 `readArray` / `readMap`（ADR 0028）

- 任务类型：**feature**（新增公共读能力；无 Bug 根因修复）。
- 上游输入：`wiki/raw/task_issue-369.md`（Host brief）；`wiki/raw/task_issue-369_sa6_contract.md`
  （SA6 诊断与验收契约，verdict `approve` 附 SA1 冻结条件）；
  `wiki/raw/task_issue-369_sa2_review.md`（SA2 设计攻击评审 iteration 0——verdict `reject`，
  唯一 MAJOR **F-1**，本轮修订输入；其余维度经独立源码对照全部成立）。
- 基线：worktree `/home/wangjian/nomicore-fix-issue-369`，branch `mabf/issue-369`，HEAD
  `ab6e3908b022292d5af7e800a6452bc392023a9e`（#368 W1 已合并；#363 T1 渲染器、#364 T2 readData
  文本形态均在产——SA6 §5-4 探针实证）。SA8 设计后冲突复查已在场：
  `wiki/raw/task_issue-369_design_conflict_report.md`（iteration 0，verdict **clear**——
  19 项对照 12 no-conflict + 7 implements，0 hard-conflict / 0 evolution-required）。
- 本设计的核心交付：**§7 契约绑定表（B-1…B-11 全量冻结）**，其中 **B-6 元素口径锚策略
  （封闭对象 map）给出可满足性裁决**（§7.2），以及 `total` 计数实现路径（§7.4）。
  本轮为 **SA2 F-1 修订轮**：B-8 基槽（`field:<单段名>`）折叠纪律 + W2-T 敌意 field 名
  边界用例义务（§14 评审修订映射）；其余冻结面经评审确认**原样保持**。
  本轮零代码、零测试落盘（dispatch 约束）。

---

## 1. 任务类型、目标与非目标

**目标**：交付 `NamespaceLease.readArray` / `readMap` 公共面（ADR 0028 决策 1/3/6/7/9 的
lease 口径）：消费方一次调用拿到「条目列表值 + 元素口径投影文本 + 窗口截断事实」——
成功恒四键 `{ ok, value, schema, truncated }`；组合 doc-runtime W1 载体原语
（`readArrayWindowAtPath` / `readMapWindowAtPath`）与 ADR 0027 投影文本渲染器
（`renderProjectionText`）；registry lease 类型别名与透传跟随；作用域文档同步。

**非目标**（沿 SA6 §12.5）：

- `packages/doc-runtime/**` 任何改动（W1 成功面恰两键、三码词表、D3/D6 语义冻结；
  `read.ts` 零 diff 纪律延续）——含**不为计数新增 doc-runtime 导出**（§7.4 论证）。
- `readData` 与 ADR-0024 options 的形状/语义零改动；ValueSchema 联合；wire / 持久化 /
  诊断日志面。
- ADR 0028 开放问题不裁决：多字段排序、嵌套 `field` 段数组、readArray 属性排序、
  n=0 计数探针。
- message 文案、`n` 上界（除 ≥1 有限整数）、`orderBy.dir` 缺省实现细节——不写成断言。

## 2. 当前行为与证据锚点

| 事实 | 锚点 |
|---|---|
| lease 恰 13 键、runtime 恰 12 键，均无 `readArray`/`readMap`；调用 `TypeError`；类型面 TS2339 ×4 | SA6 §5-1/§5-2 探针（`artifacts/sa6-issue369-{probe,type-probe}.log`，3/3 与 2/2 轮逐字节复现） |
| W1 原语在场可用：`readArrayWindowAtPath`/`readMapWindowAtPath`，成功面恰两键 `{ok,value}`，三码 + `PATH_NOT_ALLOWED` | `packages/doc-runtime/src/window.ts` L109–131（公共入口）、L98–100（两键联合）；`packages/doc-runtime/src/index.ts` 尾段导出 |
| W1 options 类型：`ReadArrayWindowOptions`/`ReadMapWindowOptions`（`n` 必填 ≥1；`orderBy` 闭合联合；预算两轴） | `window.ts` L54–68 |
| W1 OPT 对 `orderBy.field` 仅校验 `typeof === 'string'`（仅 map 面收 `field`）——含换行/`✂`/行首 `- ` 的任意字符串通过校验，归一化项原样携带该名（F-1 敌意面事实源） | `window.ts` L306–367（`validateOrderBy`；L363–367 typeof 检查、L367 原样入 `NormalizedTerm`）、L141–145 |
| 仓内行注入防御纪律：一切消费方可控、要进投影文本行的字符串先折叠（`replace(/\r\n|\n|\r/g, ' ').trim()`）——头行 pathText 的 `foldSegment`、渲染器 ✂ 行 path 记法与口径 first-line 的 `foldText` 同款 | `read-schema-projection.ts` L127–128、L174–177（`// 行注入防御`）；`render-projection-text.ts` L975–986（`foldText`）、L994–1002（✂ 行） |
| W1 候选空间语义：数组 = 全下标（稀疏空洞计入）；Y.Map = `get(k)!==undefined` 键；plain object = own-enumerable data 键且值非 undefined | `window.ts` L503–540（`enumerateArrayCandidates`/`enumerateMapCandidates`，D6 注释） |
| #368 设计明示拒绝 W1 附带 `kept/total`（「为 W2 省一次 O(N) 枚举」被否决）| `wiki/raw/task_issue-368_design.md` L358–360 |
| readData 组合先例：lifecycle gate 先行 → 无/预算分支 → canonical 接缝净化 → 投影文本四键组装 | `packages/namespace-runtime/src/runtime.ts` L558–611（`readData`）、L838–865（`canonicalReadOptions`）、L885–893（`seamReadOptionsInvalid`） |
| 投影文本组装：头行 + `\n\n` + 渲染器正文（含 `‡` 页脚与 ✂ 段）；`schema:null` 单义 | `packages/namespace-runtime/src/read-schema-projection.ts` L67–119 |
| 渲染器 ✂ 段文法：`✂ 截断事实：` + 行 `- <path> · <kind> · 省略 <N> 项`；`kind` 闭合于 `depth|width`；块间 `\n\n`、输出以恰一个 `\n` 结尾 | `packages/vfsl/src/render-projection-text.ts` L60–63、L166–168、L317–340（`validateTruncations` 拒绝其它 kind）、L994–1002 |
| resolver 值侧匹配：对象先**精确字段名**命中、再 `<key>` 槽（keyPattern 实测）；数组收非负整数段（`<item>` 槽，读侧无越界概念）；封闭对象无 `<key>` 槽 → 未知段零候选 | `packages/vfsl/src/resolve-schema-at-path.ts` L629–670（`matchValueNode`） |
| 元素口径锚实测：数组 `[...path,0]` ✓、Record `[...path,'<key>']` ✓（含 keyPattern 与空容器——字面 `'<key>'` 命中精确字段分支，绕过 keyPattern）；封闭对象 `meta.<key>` → `schema:null` | SA6 §9-4（探针 `readData(...).schema` oracle）；机制与上条源码互证 |
| lease readData 透传先例：released 短路先于一切透传；active 期 raw 引用直传；Equal 锁 | `packages/namespace-registry/src/lease.ts` L284–297、L406–461 |
| 键集守卫在位：runtime 三处 12 键、registry 13 键 | `runtime-close-lifecycle.test.ts` L159、`runtime-phase5-reset-fence-r2.test.ts` L127、`runtime-registry-internal-seam.test.ts` L276、`registry-open.test.ts` L917 |
| 形状断言收敛门（family A/B AST 扫描）在场且绿 | `packages/namespace-runtime/test/readdata-shape-assertion-consolidation-gate.test.ts` |
| CONTEXT「窗口读」/「形状预算」词条已含护栏 vs 选择器分工句 | `CONTEXT.md` L49–50、L61–63 |
| namespace-runtime 已直依赖 `yjs`（^13.6.30） | `packages/namespace-runtime/package.json` dependencies |

## 3. 能力缺口（承接 SA6 §8）

消费方无法经 lease 公共面一次拿到「条目列表 + 元素口径投影文本 + 截断事实」：只能
`readData` 全量物化后自行裁剪（失去 ADR 0028 决策 8 的零物化纪律），或绕开 registry
lease 直依 doc-runtime 原语（失去 lease 生命周期/released 通道与类型契约）。最深根因：
ADR 0028 决策 9 的第三层（namespace-runtime 组合）与第四层（registry lease 公共面）从未
交付。缺口稳定可证（SA6 §5/§13：负控 PASS 后目标断言 FAIL 于能力存在性，3/3 + 2/2 轮
逐字节相同）。

## 4. Owner 要求落实

issue #369 评论数 = 0（Host REST 实读为空；dispatch 原文明示「no owner requirements to
incorporate」）。**无 owner 条款需映射**；需求源 = issue body What-to-build + AC1–AC6 +
ADR 0028 决策 1/3/6/7/9（+ 决策 2/4/5/8 作为组合输入语义）。SA6 §2 同结论。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无评论） | — | — | — |

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 能力缺口稳定复现（lease 13 键 / runtime 12 键无窗口面；`typeof` 双 `undefined`；TS2339 ×4；导出零窗口名目） | SA6 §5-1/§5-2、§13 | §8 组合设计新增 runtime 两键（12→14）与 lease 两键（13→15） |
| 依赖边全部落地：#368（W1 原语 + 三码）、#363（`renderProjectionText` 公共导出）、#364（readData 恒四键文本形态） | SA6 §5-4 探针；`doc-runtime/src/index.ts`；`vfsl` 导出 | 组合直接消费三者，零改动 |
| AC4 等价锚现状成立：W1 入选项物化 ≡ 同预算 `readData(项路径).value`（JSON 逐字节） | SA6 §9-3 | W2 只组合/包装，不改 W1（§7.3 编排 S2 直通） |
| 元素口径 oracle 现状成立：`readData([...path, 锚段], 同预算).schema` 即渲染器对元素口径的输出；封闭对象 `<key>` 锚反证为 `schema:null` | SA6 §9-4 | §7.2 B-6 锚链冻结（含封闭对象容器口径回退） |
| 计数判别实验：全量 `readData` 计数实现必红于 N=2000 毒值哨兵；O(N) 标识枚举 `ok:true` | SA6 §9-6、§7 | §7.4 计数路径冻结为组合层 O(N) 标识枚举 |
| 窗口「响亮」与 readData「缺席吸收」方向相反、互不污染 | SA6 §9-5（NC4） | §7.3 编排 S2：W1 失败成员原样透传，绝不吸收 |
| W1 D3 解释性钉死（数组面 `by:'index'` = 值键总序）已经 #368 SA8 iteration 3 裁 no-conflict + SA2 独立重算 | SA6 §11-5、§15-8 | W2 继承冻结语义，不重新裁决；残余风险登记 §13 R6 |
| W1 成功面恰两键（`total` 不在 W1 面） | `task_issue-368_sa10_spec.md` L32；`task_issue-368_design.md` L358–360 | `total` 由组合层自算（§7.4） |

## 6. SA8 约束落实

SA8 前置产物缺席（本轮实查：`wiki/raw/task_issue-369_relevant_decisions.md`、
`_conflict_report.md`、`artifacts/sa8-conflict-gate-issue-369*.md` 均不存在；SA6 §1/§15-5
同查）；**设计后冲突复查已在场**：`wiki/raw/task_issue-369_design_conflict_report.md`
（iteration 0，verdict `clear`；对本设计四个委派焦点——新公共 API、B-6 封闭对象回退、
组合层 ✂ 窗口文本、分层与计数镜像——逐一裁 no-conflict / implements；实现期义务
RA-1–RA-5 见其 §8）。表中「是否需要设计后冲突复查」列系各义务在该**已执行**复查中的
覆盖标记（复查结论 clear；本轮 F-1 修订后的复查处置见 §15）。按 skill 规则以 ADR 原文 +
源码 + SA6 探针 + W1 既有测试自建约束面
（该自建面经 SA8 报告与 SA2 评审独立源码对照逐项确认）：

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| ADR 0028 决策 1：公共面 = lease 层两方法，`n` 必填 ≥1 | §7.1 B-1/B-3 | 冻结名与参数形 | 是（新公共 API） |
| ADR 0028 决策 3：条目列表身份随行、包装不进口径、空容器 `[]` | §7.1 B-4；§12 W2-A | W1 值直通 + 四键包装 | 是（schema 通道新口径） |
| ADR 0028 决策 4：组合式 depth（项 ≡ 同预算 readData；终点宽度由 n 治理） | §7.3 编排 S2/S5；§12 W2-E | 预算两轴原样贯通值通道（W1 M 段）与投影通道（锚解析） | 否（语义既有） |
| ADR 0028 决策 6：schema = 元素口径投影文本；路径键控、与数据无关；空容器照常返回 | §7.2 B-6/B-7 | 锚链 + D1 文本组装 | 是（封闭对象容器口径为本设计的冻结解释，见 §7.2） |
| ADR 0028 决策 7：恒四键；`truncated === kept < total`；窗口事实进 ✂ 段；total=0 无 ✂；三稳定码响亮不抛 | §7.1 B-4、§7.3 S6、B-8/B-9 | 逐条落实 | 是（新失败面经 lease 透传） |
| ADR 0028 决策 8：O(N) 枚举 + 只物化入选项 + 未入选零物化 | §7.4；§12 W2-E3 | 计数 = O(N) 标识枚举（零值域读）；物化仍由 W1 独占 | 否 |
| ADR 0028 决策 9：分层——doc-runtime 载体原语（已交付）；namespace-runtime 组合；registry lease 面与别名；readData 与 ADR-0024 options 零改动 | §7.3、§8；§11 文件范围 | 组合层新增 `window-read.ts`；lease 透传；readData 零触碰 | 是（分层张力登记 §13 R2） |
| ADR 0027 决策 1/2/3：投影文本形态、渲染器零选项、✂ 段规范文法 | §7.2 B-7/B-8 | 复用渲染器输出为正文；✂ 窗口事实行由组合层按同款文法追加（渲染器 kind 词表闭合于 depth/width，窗口行不经渲染器第二参） | 否（不改渲染器） |
| ADR 0027 已知限制 2（`schema:null` × 截断只剩布尔） | §13 R4 | 窗口事实仅经 schema 文本承载——同款已知限制登记 | 否 |
| #368 移交 R3/P4：显式 undefined 值键出条目空间 | §7.4 计数纪律；§12 W2-T 边界用例 | 计数镜像同款键空间 | 否 |
| 模块 AGENTS：公共 API 仅经 `src/index.ts`；读不进 sequencer；公共面守卫逐键记账 | §8、§11 | 新面经各包 index type-only 导出；读同步、零 sequencer | 否 |

## 7. 设计决策与主要备选方案

### 7.1 契约绑定表（SA6 §12.1 全量冻结）

| # | 绑定 | **冻结值** | 依据 / 说明 |
|---|---|---|---|
| B-1 | lease 方法名 | `readArray` / `readMap`，参数 `(path, options)` | ADR 0028 决策 1 冻结名 |
| B-2 | runtime（组合层）方法名 | 同名 `readArray` / `readMap` | 决策 9 分层；registry「除 close 外代理全部 Runtime 能力」 |
| B-3 | options 类型 | `NamespaceRuntimeReadArrayOptions = ReadArrayWindowOptions`、`NamespaceRuntimeReadMapOptions = ReadMapWindowOptions`（doc-runtime 单源 type-only 别名）；**第二参必填、无重载** | 决策 1/2；`n` 必填 ≥1 由 W1 OPT 单权威校验 |
| B-4 | 结局面 | 成功恰四键 `{ok, value, schema, truncated}`（`value` = 条目列表）；失败 = W1 `WindowReadFailure` 原样（`{ok:false, code, path, message}`，code ∈ 三窗口码 + `PATH_NOT_ALLOWED`）\| runtime `RuntimeReadDisabledResult` \| lease `NamespaceLeaseReleasedIssue` | 决策 7；`WindowReadFailure` 类型单源于 doc-runtime（组合层自产的接缝/防御失败成员同型复用该类型，见 §7.3 S3/S4） |
| B-5 | 公共别名名 | runtime：`NamespaceRuntimeReadArray{Options,Result}` / `NamespaceRuntimeReadMap{Options,Result}`；lease：`NamespaceLeaseReadArray{Options,Result}` / `NamespaceLeaseReadMap{Options,Result}`，lease 结果 = runtime 结果 \| `NamespaceLeaseReleasedIssue`；lease.ts 增两对 Equal 锁 + 重载序不适用（单签名） | registry「别名跟随 + Equal 锁」先例（`_readAlias`/`_readBudgetAlias`） |
| **B-6** | **元素口径锚策略** | **§7.2 专项裁决**（锚链：数组面 `[...path, 0]`；键面 `[...path, '<key>']` → 不可解析时回退 `[...path]` 容器口径） | 决策 6 + 实测反证 |
| B-7 | schema 文本组成 | **D1：无头行**。`schema = renderProjectionText(锚解析, canonical 预算)` 正文（含 `‡` 页脚）+（kept<total 时）✂ 窗口事实块；**不携带项级值通道 truncations**（W1 成功面恰两键，组合层结构上不可得——已知限制，§13 R5）；组装块间 `\n\n`、结尾恰一个 `\n`（与渲染器拼装规则逐字同款） | AC2 字面可成立（「≡ 渲染器对元素口径的输出」）；备选 D2（镜像 `# readData [...]` 头行）否决：头行文法是 ADR-0027 为 readData 冻结的规范文法，窗口面引入它要么伪称 readData 调用、要么发明新头行文法（扩规范面） |
| B-8 | ✂ 窗口事实格式 | 与渲染器同款段落文法，由组合层追加为最后一个块：`✂ 截断事实：` + 一行 `- <pathText> · 窗口 · 基 <basis> <dir> · kept <n>/total <N>`；**四个插值槽均有确定性渲染规则（F-1 冻结）**：① `<pathText>` = 实参 path 逐段 `foldSegment`（换行折叠 + trim）`.` 连接，空路径取渲染器 ✂ 行约定字面 `[]`（`render-projection-text.ts` L998）；② `<basis>` = 字面 `index` / `key`，或 `field:` + **`foldSegment(field 名)`**——field 名是消费方可控任意字符串（W1 `validateOrderBy` 仅校验 `typeof === 'string'`，`window.ts` L363–367，含换行/`✂`/行首 `- ` 者均通过且原样入归一化项 L367），故必须先经与 pathText 同款折叠（`replace(/\r\n|\n|\r/g, ' ').trim()`——`read-schema-projection.ts` L127–128/L175–177 行注入防御、渲染器 `foldText` L984–986 同款）再拼入 `field:` 前缀，**折叠施加于基槽字符串全程**（`index`/`key` 系 W1 校验闭合字面、前缀系常量，对 field 名全程折叠即等价于对全槽折叠）；③ `<dir>` ∈ `asc` \| `desc`（W1 校验闭合词表，归一化缺省 asc）；④ `kept <n>/total <N>` = 非负整数 `String()` 呈现。**不变式：✂ 窗口事实块恒为「头行 + 恰一行事实行」，不可经任何插值槽注入换行**——敌意 field 名不可伪造第二个 `✂ 截断事实：` 头或伪造事实行（ADR-0027 决策 1：✂ 段是截断事实唯一载体）；**kept<total 才有 ✂ 块；total=0 恒无** | 决策 7；渲染器行文法对齐（`- <path> · <kind> · …`，kind 槽 = `窗口`）；②的折叠是**纯呈现规则**——施加点在 S6 ✂ 装配，canonical 归一化项与 S2 值通道保持 raw field 名（排序下钻语义不受折叠影响）。冻结后测试可升 Byte 级断言（SA6 §12.6-2）；敌意 field 洞 = SA2 F-1，修订映射见 §14 |
| B-9 | `truncated` / `total` | `truncated === (value.length < total)`；`total` = W1 条目空间候选数，由**组合层 O(N) 标识枚举**自算（§7.4）：数组 = `length`（Y.Array 与 plain array 同；稀疏空洞计入）；Y.Map = `keys()` 中 `get(k) !== undefined` 者计数；plain object = `Object.keys` 过 `readableOwnDataValue` 纪律命中计数 | issue body 逐字 + 决策 7 + #368 R3/P4；测试以独立预言机计数对账（§12 W2-T） |
| B-10 | released / lifecycle 通道 | lease released → 冻结 `NAMESPACE_LEASE_RELEASED` issue（先于一切透传、零 doc 触碰、同步返回）；runtime lifecycle≠ready → `RuntimeReadDisabledResult`（`RUNTIME_READ_DISABLED`，零 options 读取、零 doc 触碰）；active 期 path/options **raw 引用透传** | readData 同款先例（`lease.ts` L284–297、`runtime.ts` readData S1） |
| B-11 | 既有守卫更新义务 | runtime 键集 12→14、lease 13→15；既有键全数保留；两包值导出面不变（runtime 仍恰 `RuntimeWriteFatalError` 一键） | §10 影响面；实现义务非自由项 |

### 7.2 B-6 元素口径锚策略——可满足性裁决（承重开放项）

**问题**：键面（readMap）目标容器的 schema 形状分两族——Record 形（值树对象含 `'<key>'`
槽，`Record<string, T>` / `Record<AssetId, T>` 降产物）与封闭对象形（`YMap<{…}>` /
静态键 plain object 降产物，值树只有静态字段、无 `'<key>'` 槽）。实测（SA6 §9-4，与
`resolve-schema-at-path.ts` `matchValueNode` L634–653 机制互证）：

- Record 形：`[...path, '<key>']` 命中**精确字段名分支**（值树降产物的动态键槽本身是名为
  `'<key>'` 的字段），解析到元素类型——keyPattern 在场也不经实测（精确分支先于
  `acceptRecordSlot`）；空容器照常（解析 schema-only、路径键控）。
- 封闭对象形：`[...path, '<key>']` 无字段可中 → 结构侧闭集拒绝 → `SCHEMA_PATH_NOT_FOUND`
  → `schema: null`。容器路径 `[...path]` 可解析为封闭对象整块（depth 自容器起算）。

**候选与裁决**：

| 候选 | 裁决 | 理由 |
|---|---|---|
| (a) 封闭对象走容器路径 | **采纳（作为锚链第二锚）** | 容器类型块静态枚举**全部条目键与值类型**——封闭对象的条目总体（= 字段集）的最诚实口径；oracle 干净（`readData([...path], 同预算).schema` 去头行逐字节对账）；零 vfsl 改动；不误导（字段名即键、字段类型即条目值类型） |
| (b) 按 `orderBy.field`/被选键逐项解析再合成 union | 否决 | 需在组合层新造 union/docs 合成语义（重复 resolver 内部合成逻辑），且合成结果不是任何单次 resolver 输出——AC2 的「渲染器与组合层不漂移」oracle 失效；对封闭对象丢失键→类型对应（信息量反而低于容器块）；或需 vfsl 新通配能力（扩 W2 范围进冻结包） |
| (c) 收窄载体词表（封闭对象出 readMap 域） | 否决 | ADR 0028 决策 7 明文 readMap 收 Y.Map + plain object——封闭对象是合法 Y.Map/plain object；W1（冻结、已测）在封闭对象上成功选窗，lease 层拒绝会造成层间语义分叉，且需发明新的 mismatch 分类（违反三码词表冻结）；收窄即修订 ADR，超出本票 |

**冻结规则（B-6）**：

1. 锚链按 **face** 确定：数组面锚 = `[...path, 0]`（单锚，无回退）；键面锚链 =
   `[...path, '<key>']` →（该锚解析失败时）`[...path]`（容器口径）。
2. 语义：`<key>` 槽在场（Record 形）→ 元素口径；封闭对象形（无 `<key>` 槽）→ 回退
   容器口径 = 条目总体的静态全枚举口径；两锚皆不可解析（含无 active schema / 路径偏离
   schema / 敌意 path / 键面下 schema 为数组、数组面下 schema 为封闭对象或 Record 形等
   异形——均仅 raw 写入偏离 schema 的数据可达）→ `schema: null`（ADR-0027 null 单义
   直通，与 readData 路径键控纪律一致）。对称从句（SA2 O-2）：数组面为**单锚无回退**，
   锚失败即 null——有意不对称：off-schema 数据下容器口径会描述与值通道不符的形状，
   故不为数组面设容器回退。
3. **depth 计量（已知限制，随 D1 冻结如实登记）**：封闭对象容器口径下 `depth` 自容器
   起算——`depth:0` 呈现为容器级 `[...]‡` 标记（不满足「标记落元素子树内」的字面），
   容器值字段的层深计量与逐项物化（决策 4 自条目起算）错位一层。数组/Record 形锚不受
   影响（标记在元素描述内，SA6 §9-4 实证 `Task‡`）。**不为对齐而注入 `depth+1`**——
   那会破坏 AC2「同预算」oracle 与预算单一权威。消费指引：封闭对象窗口读传
   `depth ≥ 1` 可得完整字段口径。ADR 0028 开放问题 5 已把「元素口径呈现细节」留给
   实现票——本裁决即该实现票决定，经作用域文档披露（§11 文档面）。
4. 锚链解析**只消费 schema**（resolver 路径键控、与数据无关）；锚失败不构成读失败
   （值通道已成功，`schema: null` 照常 four-key 返回）。

### 7.3 组合编排（namespace-runtime 公共方法体）

新模块 `packages/namespace-runtime/src/window-read.ts` 承载编排助手；runtime.ts 增两个
闭包方法。两方法同构，以 `readArray(path, options)` 为例（map 面同款，face 换
`readMapWindowAtPath` 与键面锚链）：

```
S1 lifecycle gate     lifecycle ≠ 'ready' → RuntimeReadDisabledResult（复用 readDisabled；
                      零 options 读取、零 doc 触碰——镜像 readData D4/#336 B-1）
S2 W1 原语直通        w = readArrayWindowAtPath(doc, path, options)   // raw 引用
                      !w.ok → 原样返回（三码 + PATH_NOT_ALLOWED；绝不吸收）
S3 canonical 接缝净化  canonicalWindowBudget(options)：以 descriptor 纪律重读四键空间
                      {n, orderBy, depth, maxChildrenPerNode}，产新鲜 plain 预算对象
                      {depth?, maxChildrenPerNode?} + 归一化排序项（basis/dir）；
                      视图不稳定（键集漂移/accessor 显形/轴值非法化/trap 抛出）→
                      重派发 W1 一次：!ok → 返回其失败；ok → 接缝终态失败
                      （code WINDOW_OPTIONS_INVALID，WindowReadFailure 型，message 带
                      「视图不稳定」语义——镜像 readData A-2b/A-2c 两出口）
S4 total 计数         countWindowCandidatesAtPath(doc, path, face)（§7.4）：
                      {ok:true, total} | {ok:false}；失败（W1 成功后结构性不可达的
                      防御位）→ WindowReadFailure 型 PATH_NOT_ALLOWED + 内部不一致 message
S5 schema 正文        锚链逐锚调用 projectSchemaTextBody(state, 锚, canonical 预算)：
                      状态守卫（schemaState/activeTools）→ normalizeReadPath →
                      resolveSchemaAtPath(tools.derived, 规范锚, 预算) →
                      renderProjectionText(resolved)（第二参缺席）→ string | null；
                      数组面单锚；键面 '<key>' 锚 null → 容器锚；皆 null → null
S6 结算               kept = w.value.length；truncated = kept < total；
                      schema = truncated && 正文 ≠ null
                        ? 追加 ✂ 窗口事实块（B-8；pathText/基/方向取自 canonical 归一化项
                          与 normalizeReadPath 快照；field 基名在装配点经 foldSegment
                          折叠后渲染——纯呈现规则，canonical 项与 S2 值通道保持 raw；
                          块间 \n\n、结尾恰一个 \n，块恒头行 + 恰一行事实行）
                        : 正文（null 保持 null——窗口事实仅经 schema 文本承载，
                          schema:null × truncated 只剩布尔，§13 R4）；
                      返回字面量 { ok:true, value: w.value, schema, truncated }（恰四 own 键）
```

要点：

- **顺序不可换**：S2 先于 S4/S5——options 合法性由 W1 OPT 单权威裁定（非法 options
  零 doc 触碰，D9 纪律）；计数与锚解析只在其后运行。全方法同步、零 sequencer、零状态
  写入（读不进 write sequencer——包 AGENTS 边界）。
- **同快照一致性**：S2/S4/S5 同步连续执行，JS 单线程下无复制 apply/mutation 交错——
  条目、计数、schema 描述同一 doc 瞬时状态（写与复制 apply 均经 sequencer 异步槽）。
- **readData 零触碰**：不改 `readData`/`canonicalReadOptions`/`projectReadDataSchema`
  的行为与字节。`read-schema-projection.ts` 仅**抽取并导出**正文变体
  `projectSchemaTextBody(state, path, options?) -> string | null`（状态守卫 + 规范化 +
  resolver + 渲染器正文，无头行、无 truncations 入参）；`projectReadDataSchema` 的输出
  逐字节不变（内部改走共享件，既有 readData 快照测试为锚）。
- **S3 的残余敌意面**：canonical 重读与 W1 OPT 读之间仍可整体自洽地漂移（如 field 名
  'a'→'b' 双读皆合法）——此时值通道正确、仅 ✂ 描述行的基可能失真；与 readData 的
  canonical 残余同类（readData 头行同样取 canonical 视图），登记 §13 R3，不增设机制。

### 7.4 `total` 计数实现路径（B-9 冻结）

**决策：组合层自算（namespace-runtime 新模块内 O(N) 标识枚举），零 doc-runtime 改动。**

- 依据：① #368 设计明示否决「W1 附带 kept/total」且预知 W2 需「一次 O(N) 枚举」
  （`task_issue-368_design.md` L358–360）；② SA6 §12.7-1 红线与 §15-3 均要求
  doc-runtime 零改动、组合层自算；③ SA6 影响面不含 doc-runtime；④ 借 `readData`
  截断清单计数不可行——预算读遇稀疏空洞/值域违规响亮失败而 W1 接受（语义分叉），
  且深度展开会物化子项（E3 哨兵必红）；⑤ namespace-runtime 已直依赖 `yjs`
  （package.json），不新增包图边。
- 实现：`countWindowCandidatesAtPath(doc, path, face)` 以**出处标记镜像**（W1 对
  read.ts 的同款纪律：每个复制件头注释带 `copied from window.ts@ab6e390 (<原名>)`）
  复用 W1 的导航循环（`navigate` + `navClassify` 族）与面符目标分类，随后做零值域读的
  身份计数：数组面 = `target.length`（Y.Array 与 plain array 同式，稀疏空洞计入）；
  键面 = Y.Map `keys()` 中 `get(k) !== undefined` 计数 / plain object `Object.keys` 过
  `readableOwnDataValue`（descriptor 纪律，零 accessor 执行）命中计数。计数**不读排序
  键、不物化任何子项**（决策 8；E3 毒值哨兵锚定）。
- 计数在 S2（W1 成功）之后运行：目标在场、载体面符、options 已过权威校验——镜像里的
  absent/mismatch 分支成为结构性不可达的防御位，任何意外（含顶层 catch）坍缩为
  `WindowReadFailure` 型 `PATH_NOT_ALLOWED` + 内部不一致 message（沿 doc-runtime E100
  收编姿势）。
- **漂移防线**：计数语义必须与 W1 候选空间逐位一致（否则 `kept=n` 时误报 truncated）。
  锚定 = W2 契约测试的**独立预言机**（测试内直接以 Yjs/native API 数键）对账全边界矩阵：
  显式 undefined 值键（Y.Map 与 plain object）、accessor/non-enumerable 键、稀疏 plain
  数组、空容器、`readMap([])`（ROOT 面）。出处标记 + 防线测试共同约束；W1 冻结解除时
  的合并选项登记 §13 R2 follow-up。

## 8. 接口、状态机与数据流

### 8.1 类型面（新增，全部 type-only 经各包 `src/index.ts`）

```ts
// packages/namespace-runtime/src/window-read.ts（新）
export type NamespaceRuntimeReadArrayOptions = ReadArrayWindowOptions;   // doc-runtime 单源
export type NamespaceRuntimeReadMapOptions = ReadMapWindowOptions;
export type NamespaceRuntimeReadArrayResult =
  | { ok: true; value: ArrayWindowEntry[]; schema: string | null; truncated: boolean }
  | WindowReadFailure            // W1 原样 + 组合层接缝/防御成员（同型单源）
  | RuntimeReadDisabledResult;
export type NamespaceRuntimeReadMapResult = /* 同款，MapWindowEntry[] */;

// NamespaceRuntime 接口 +2 成员（12→14 键）；JSDoc 契约沿 readData 深度（四键/锚口径/
// ✂ 事实/失败面/lifecycle 顺序）
readonly readArray: (path: readonly (string|number)[], options: NamespaceRuntimeReadArrayOptions) => NamespaceRuntimeReadArrayResult;
readonly readMap:  (path: readonly (string|number)[], options: NamespaceRuntimeReadMapOptions)  => NamespaceRuntimeReadMapResult;

// packages/namespace-registry/src/types.ts（+2 方法于 NamespaceLease，13→15 键）
export type NamespaceLeaseReadArrayOptions = NamespaceRuntimeReadArrayOptions;
export type NamespaceLeaseReadArrayResult = NamespaceRuntimeReadArrayResult | NamespaceLeaseReleasedIssue;
/* ReadMap 同款 */
// lease.ts 新增 Equal 锁（镜像 _readAlias 先例）：
//   _readArrayAlias / _readMapAlias（lease 结果 ≡ runtime 结果 | released issue）

```

### 8.2 数据流路线（新读路径；无写入/持久化/wire 变化）

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 窗口值通道 | 消费方经 lease.readArray/readMap(path, options) | 无写入（纯读） | lease（released 短路/raw 透传）→ runtime S1 gate → W1 原语（G0→OPT→N0→N1→C/E→S→M，doc-runtime 进程内） | 无（Y.Doc 活内存，零拷贝出 doc） | W1 M 段逐入选项 `readLogicalValueAtPath` | `value` = 条目列表（身份随行，有序基之序） | W1 失败成员原样透传（三码 + PATH_NOT_ALLOWED），无半窗 | W2-A/W2-F；NC2/NC4 |
| total 计数 | runtime S4（W1 成功后） | 无 | 组合层镜像导航 + 面符分类 + O(N) 身份枚举（零值域读） | 无 | 同一 doc 瞬时状态 | `total`（✂ 事实行 + truncated 布尔） | 防御位坍缩 PATH_NOT_ALLOWED（结构性不可达） | W2-T 独立预言机对账；W2-E3 哨兵 |
| 元素口径 schema | runtime S5（canonical 预算） | 无 | 锚链 → `resolveSchemaAtPath(tools.derived, 锚, 预算)` → `renderProjectionText`（无 truncations 入参） | 无 | live derived（P0/SCHEMA 写槽安装的 compile ok 产物） | `schema` = 正文（含 `‡` 页脚）+ ✂ 窗口事实块，或 null | 锚失败 → null（非读失败）；InternalError 逃逸通道纯度与 readData 相同（可信域唯一 throw，敌意输入零 throw） | W2-S oracle（readData(锚, 同预算) 双侧剥离对账）；W2-S3 数据无关性 |
| ✂ 窗口事实 | runtime S6 | 无 | pathText（foldSegment）+ canonical 归一化基（field 名同款折叠——F-1 呈现规则）/方向 + kept/total → B-8 行文法（块恒头行 + 恰一行事实行，零换行注入） | 无 | schema 文本尾块 | kept<total 才在场 | schema:null 时不可达（R4） | W2-T Byte 断言（冻结后）+ 敌意 field 名单行断言 |

数据流边界说明：全部三跳在同一同步调用栈内、同一 Y.Doc 瞬时状态上完成；跨模块边界仅
lease→runtime（能力代理）与 runtime→doc-runtime/vfsl（既有公共导出）；无缓存、无 memo、
每次调用全新字面量（隔离不变量由 string/字面量形态保证，ADR-0027 决策 4 同款）。

### 8.3 状态机

无新状态机。消费的既有状态：`state.lifecycle`（S1 只读门）、`state.schemaState`/
`state.activeTools`（S5 只读守卫，镜像 `projectReadDataSchema` D3a）；两者写入点均不在
本设计范围（close/close barrier 与 P0/SCHEMA 写槽既有单点）。

## 9. 错误、恢复、并发和幂等

- **失败面**（全部同步、响亮不抛、结果联合结算）：W1 三码 + `PATH_NOT_ALLOWED` 原样
  （含入选项物化 fail-fast——无半窗）；`RUNTIME_READ_DISABLED`（lifecycle≠ready，先于
  一切 options 读取与 doc 触碰）；`NAMESPACE_LEASE_RELEASED`（lease 层冻结 issue）；组合
  层接缝终态 `WINDOW_OPTIONS_INVALID`（敌意 options 视图不稳定——W1 重派发后仍接受才
  触达，敌意专属）；组合层防御 `PATH_NOT_ALLOWED`（计数镜像意外，结构性不可达）。
- **恢复/重试**：读操作零副作用 → 任意失败可直接重试；`truncated:true` + ✂ 事实即
  「增 n 或翻方向重读」的完整依据（基与方向随行）。
- **并发/幂等**：同步纯读、零 sequencer、零共享可变状态——幂等（同 doc 状态同结果，
  渲染器/resolver/W1 均逐字节确定，SA6 §7 实测佐证）；与写/复制 apply 经 sequencer 的
  异步槽互不交错（§7.3 同快照一致性）。
- **资源所有权**：无新增所有权；lease 生命周期语义（released 通道、release 不追踪已
  接纳操作）不变。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| registry lease 消费方（Host/DSH 工具、测试） | 13 键 lease，`readData` 四键面 | 15 键；新增两同步读方法（纯加法，既有 13 键行为逐字节不变） | 零强制；需要窗口语义时新调用 | `lease.ts` L299–401（键面）；ADR 0027 §5（消费方可枚举） |
| `NamespaceRuntime` 消费方（registry 装配、internal seam、测试） | 12 键 | 14 键（纯加法） | 键集守卫三处 + 类型面守卫同步 +2 | §2 守卫锚点行 |
| 键集/导出守卫测试 | 12/13 键断言、值导出恰一键 | 14/15 键断言（既有键全数保留） | §11 ALLOW LIST 所列 6 个守卫文件 | SA6 §10 |
| readData 全部既有调用方 | 恒四键 + 头行 + ✂ | 逐字节不变（`projectReadDataSchema` 输出冻结，仅内部共享件抽取） | 零 | §12 NC1/NC5 |
| W1 既有测试（#368 契约） | 冻结面 | 逐字节不变（doc-runtime 零 diff） | 零 | §12 NC2；DENY LIST |
| 形状断言收敛门 | family A/B 扫描两测试树 | 新窗口用例必须经 `expectReadDataOk`/`expectReadDataOkKeys`（成功面恰同四键）表达形状，否则门红 | 新测试遵守 | `readdata-shape-assertion-consolidation-gate.test.ts`；`helpers/readdata-ok-shape.ts` |
| 作用域文档读者 | 无窗口读消费段 | typed-access / cordis-plugin-hosting 补消费段 + 分工句 | §11 文档两文件 | issue AC6 |

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/namespace-runtime/src/window-read.ts`（新） | 编排助手 + 结果/options 类型 + `canonicalWindowBudget` + `countWindowCandidatesAtPath`（出处标记镜像）+ 锚链 schema 正文 + ✂ 事实装配 + 接缝/防御失败构造 | §7.3/§7.4 组合层主体 |
| `packages/namespace-runtime/src/runtime.ts` | `NamespaceRuntime` 接口 +2 成员与 JSDoc；闭包方法 `readArray`/`readMap`（S1–S6 编排；复用 `readDisabled`/`echoReadPath`） | 公共面 12→14 键 |
| `packages/namespace-runtime/src/read-schema-projection.ts` | 抽取并导出 `projectSchemaTextBody`（无头行正文变体）；`projectReadDataSchema` 输出逐字节不变 | §7.3 S5 复用既有守卫/规范化，避免双份 |
| `packages/namespace-runtime/src/index.ts` | type-only 追加四个窗口别名 | 公共 API 仅经 index |
| `packages/namespace-registry/src/types.ts` | `NamespaceLease` +2 方法；lease 窗口别名（= runtime 别名 \| released issue） | §8.1 类型面 |
| `packages/namespace-registry/src/lease.ts` | 两方法（released 短路 + raw 透传）+ 两对 Equal 锁 | B-5/B-10 |
| `packages/namespace-registry/src/index.ts` | type-only 追加 lease 窗口别名 | 同上 |
| `packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts`（新） | 组合层本地面：lifecycle gate、canonical 接缝、计数预言机、锚链 oracle、E3 哨兵、E4 入选毒项 | SA6 §12.8 第三路径——**SA1 裁定纳入**（组合不变量最好不经 registry 间接层锚定） |
| `packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`（新） | 主契约 W2-A/S/T/E/F/NC（真实 Registry 装配 + lease 公共面；fixture 内联或同目录 `issue-369-window-read-fixture.ts`） | SA6 §12.2/§12.8 |
| `packages/namespace-registry/test/issue-369-window-read-lease-surface.test-d.ts`（新） | 类型层 Y1：签名/别名 Equal 锁/负例（缺 options、词表外 orderBy） | SA6 §12.2 Y1 |
| `packages/namespace-runtime/test/runtime-close-lifecycle.test.ts` | 键集 12→14 | B-11 |
| `packages/namespace-runtime/test/runtime-phase5-reset-fence-r2.test.ts` | 键集 12→14 | B-11 |
| `packages/namespace-runtime/test/runtime-registry-internal-seam.test.ts` | 键集 12→14 | B-11 |
| `packages/namespace-runtime/test/runtime-acceptance-exports-audit.test.ts` | 值导出面仍恰一键的断言随键集扩张同步（type-only 追加不改值面） | B-11 |
| `packages/namespace-registry/test/registry-open.test.ts` | lease 键集 13→15 | B-11 |
| `packages/namespace-registry/test/registry-data-interface.test-d.ts`、`packages/namespace-runtime/test/runtime-data-interface.test-d.ts`、`packages/namespace-runtime/test/runtime-registry-internal-type-guard.test-d.ts` | 接口类型面锁同步 +2 方法 | SA6 §10 类型面 |
| `.agents/skills/nomicore/typed-access.md` | 「Read result」节后补窗口读消费段：四键面、条目列表身份回溯、元素口径 schema（含封闭对象容器口径与 depth 计量说明）、✂ 窗口事实、三失败码、与 readData 预算分工句（护栏 vs 选择器） | issue AC6；docs/AGENTS（链接 ADR 0028/0027、词汇对齐 CONTEXT） |
| `docs/integration/cordis-plugin-hosting.md` | 「创建、读取、修改和重新打开」区补同款消费段（示例 + 分工句） | issue AC6 |

F-1 修订**不改变文件范围**：基槽折叠逻辑落已列 `packages/namespace-runtime/src/window-read.ts`
的 ✂ 事实装配；敌意 field 名用例落已列 W2-T 宿主
`packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`。
ALLOW/DENY 列表原样保持。

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/**`（含 `src/window.ts`、`src/read.ts`、全部测试） | W1 载体原语与 readData 值通道 | W1 成功面恰两键/三码词表/D3/D6 冻结；read.ts 零 diff 纪律；计数经组合层（§7.4）——SA6 §12.7-1 红线 |
| `packages/vfsl/**` | T1 渲染器 / resolver / 派生面 | ADR-0027/0016 冻结；锚链只消费既有公共 `resolveSchemaAtPath`/`renderProjectionText`；B-6 裁决明确不引入 vfsl 通配/合成能力 |
| `packages/namespace-runtime/src/runtime.ts` 的 `readData`/`canonicalReadOptions`/`seamReadOptionsInvalid` 既有行为 | readData 冻结面 | ADR-0024/0027 语义 + 既有快照测试；仅允许 §7.3 声明的共享件抽取且字节不变 |
| `CONTEXT.md` | 「窗口读」「形状预算」词条 | 两词条已在场且含分工句（L49–63）——零漂移 |
| `docs/adr/**`（含 0028） | ADR 文本 | 本设计不修订 ADR：B-6 属 ADR 0028 开放问题 5 预留给实现票的呈现细节；ADR 语义未被 contradicted；如后续 Owner/SA8 另裁，走 ADR 修订流程 |
| `packages/replication-protocol/**`、wire/持久化/诊断日志相关包 | 无关面 | 窗口读不触 wire/持久化/诊断；SA6 §12.5 非目标 |
| `vitest.config.ts` | 测试入口 | 拟议测试路径已被既有 include 采集（SA6 §14 实证 107 文件） |

## 12. 验收与验证映射

（用例组沿用 SA6 §12.2 规格；下表为冻结绑定后的执行口径。SA1 不编写/运行测试。）

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 恒四键 own 键集；条目列表身份随行、有序基之序；空容器 `value:[]` + 元素口径 schema + 无 ✂ | 缺口（方法不存在） | W2-A A1–A6（经真实 Registry 装配）；形状经 `expectReadDataOkKeys`/`expectReadDataOk` | 恰四键；条目 own 键恰 `['index','value']`/`['key','value']`；`toStrictEqual` 列表；空容器 schema 非 null、无 `✂`、`truncated:false` |
| AC2 schema ≡ 渲染器元素口径输出 | oracle 可行性已实证（SA6 §9-4） | W2-S S1–S5：oracle = 同一次运行 `readData(锚, 同预算).schema`——**双侧剥离对账**：readData 侧去头行（首行 + 首个空行）与其自身 ✂ 块（值通道截断条目），窗口侧去 ✂ 窗口事实块，比较正文 + `‡` 页脚逐字节；S4 封闭对象按 B-6：oracle 锚 = 容器路径 | 双侧逐字节相等；空 vs 满容器 schema 逐字节相等；`Task‡`（depth:0）与字段 docs/别名块在场；封闭对象 `depth:1` 呈完整字段块 |
| AC3 ✂ 段 kept/total + 基与方向；`truncated` 一致 | — | W2-T T1–T4 + 边界：显式 undefined 值键出空间（Y.Map 与 plain object）、稀疏 plain 数组、`readMap([])`、**敌意 field 名**（F-1：`readMap` 面携 `orderBy:{field:'x\n✂ 截断事实：\n- p.0 · depth · 省略 999 项'}` 式载荷——覆盖 `\n`、`✂`、行首 `- ` 三类结构字符，kept<total 使 ✂ 块在场）；total 以**独立预言机**计数（Yjs/native 直数）对账；B-8 冻结后升 Byte 级（测试内单点常量） | `truncated === (value.length < 预言机 total)`；✂ 行含 `窗口`、基/方向 token、`kept n/total N`；T2/T3 无 ✂；**敌意 field 名下 ✂ 窗口事实块仍为头行 + 恰一行事实行**（schema 文本中无第二个 `✂ 截断事实：` 行、无换行拆行的伪造事实行；field 名折叠为空格连接形态进基槽），值通道按 raw 名正常选窗/排序（不受折叠影响） |
| AC4 组合式 depth 等价 | 现状已逐项相等（SA6 §9-3） | W2-E E1–E4：每条目 `toStrictEqual(entry.value, readData([...path, 身份], opts).value)`；E3 N=2000 毒值 + n=2；E4 入选毒项 | E3 `ok:true`、kept 2/total 2000（任何全量物化实现必红）；E4 `PATH_NOT_ALLOWED`、无半窗 |
| AC5 三失败码 lease 透传形状语义不变；类型别名与透传断言 | W1 三码在场（NC2） | W2-F F1–F6：与直调 W1 `toStrictEqual`；released/lifecycle 通道；spy 断言 active 期 `options`/path 引用同一性；lease≡runtime 逐字段；`.test-d.ts` Y1（签名第二参必填、Equal 锁、成功成员 `keyof` 恰四键、负例 `@ts-expect-error`） | 形状语义逐字不变；`NAMESPACE_LEASE_RELEASED`/`RUNTIME_READ_DISABLED` 先于一切透传 |
| AC6 文档 + 负控 + 全绿 | 基线全绿（SA6 §4：388 文件/4668 用例/typecheck exit 0） | W2-Y + NC1–NC6 保持绿；文档段落含分工句且不与 ADR/CONTEXT 措辞冲突；root `pnpm typecheck`/`pnpm test` | 全绿；收敛门 family A/B 归零（新用例经集中化 helper） |
| 计数-空间漂移（§7.4 防线） | — | W2-T 边界矩阵（undefined 键/accessor/non-enumerable/稀疏/空/ROOT） | `total` ≡ 独立预言机 ≡ W1 空间（kept=n 时 `truncated:false`） |
| canonical 接缝（§7.3 S3） | readData 先例 | 组合层测试：敌意 options（Proxy/accessor 漂移）→ 重派发失败透传或接缝终态 `WINDOW_OPTIONS_INVALID`；正常调用零行为差异 | 敌意零外抛、零静默 null；语义面不随 canonical 变化 |

## 13. 风险、回滚和残余问题

- **R1（中）封闭对象 depth 计量错位**：容器口径下 `depth:0` 呈容器级标记、层深自容器
  起算（§7.2-3 已知限制）。缓解：冻结规则 + 文档披露 + W2-S4 oracle 锚定；不做
  `depth+1` 注入（保 oracle 与预算单一权威）。若 Owner/SA2 后续要求逐项对齐，需 ADR
  级修订（引入元素 union 合成或 vfsl 通配），非本票。
- **R2（中）计数镜像的层间张力**：载体枚举纪律以出处标记镜像进 namespace-runtime
  （doc-runtime 是载体机制的规范归属，但 W1 面/包范围冻结使组合层自算成为唯一既守
  红线又守零物化的路径——#368 设计 L358–360 预知并接受该成本）。缓解：独立预言机
  边界矩阵；follow-up（任务外）：W1 冻结解除时评估把候选计数下沉为 doc-runtime 原语
  并合并镜像。
- **R3（低）canonical 残余敌意面**：options 在 W1 OPT 读与 canonical 重读间整体自洽漂移
  时，✂ 描述行的基可能与实际选窗基不符（值通道不受影响）。与 readData 头行同类残余；
  不增设机制（双读判据已是既有纪律的镜像）。B-8 基槽折叠规则（F-1）不改变该残余的
  真实性语义——折叠只保证事实行**结构不可伪造**（恒单行、无注入），不保证基描述与
  实际选窗基一致；后者属本残余既有范围，与 readData 头行同等处置。
- **R4（低）`schema:null` × `truncated:true`**：窗口事实仅经 schema 文本承载，null 时只
  剩布尔（ADR-0027 已知限制 2 的窗口对偶）。如实登记，不做第二载体。
- **R5（低）项级值通道截断事实不可达**：W1 成功面恰两键，组合层拿不到逐项 truncations
  （B-7 冻结不携带）；depth 截断经 `‡` 标记可观察，width（maxChildrenPerNode）截断在
  窗口 schema 文本中不可观察。已知限制；如需开放，须 W1 面修订（独立票）。
- **R6（低，继承）W1 D3 数组面值键总序**：#368 解释性钉死；若后续改采纯位置读法，W2
  数组面排序期望随 #368 契约 A 组同步修订（W2 不单独裁决）。
- **回滚**：纯加法（两包新方法/类型 + 新测试 + 文档段）；无持久化/wire/schema 格式/
  生成物变化——revert 即移除，零迁移。发布沿 ADR-0027 §5 先例评估 minor bump
  （新增公共面为加法，非破坏；由实现票的发布流程裁定，非本设计义务）。
- **任务内无未解决必要条件**；follow-up 仅 R2（计数下沉合并）与 R1/R5 的独立票选项。

## 14. 评审修订映射

`wiki/raw/task_issue-369_sa2_review.md` 在场（iteration 0，verdict `reject`，唯一 MAJOR =
F-1；需求覆盖、四键恒形、计数路径、分层、键集义务、文档范围、SA8 冲突门禁结论等其余
维度经 SA2 独立源码对照全部成立）。逐条处理：

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **F-1（MAJOR）**：B-8 冻结文法的 `<basis>` `field:<单段名>` 槽缺少行注入折叠纪律——W1 `validateOrderBy` 对 field 仅 `typeof === 'string'`（`window.ts` L363–367），`readMap(path,{n,orderBy:{field:'x\n✂ 截断事实：\n- …'}})` 类载荷在 truncated:true 时原样进 ✂ 窗口事实行，换行拆行可伪造完整 `✂ 截断事实：` 头与伪造事实行（✂ 段是截断事实唯一载体，ADR-0027 决策 1）；不修订即把该洞 Byte 级冻结进契约 | §7.1 B-8（基槽折叠规则 + 四插值槽确定性渲染 + 单行不变式）；§7.3 S6（折叠施加点 = ✂ 装配，纯呈现规则，canonical/值通道保持 raw）；§8.2 ✂ 窗口事实行；§12 AC3/W2-T（敌意 field 名边界用例）；§2（validateOrderBy 敌意面 + 折叠纪律先例两行锚点）；§13 R3（折叠不改残余真实性语义的边界澄清） | **已落实**：field 名经与 pathText 同款 `foldSegment`（`replace(/\r\n|\n|\r/g, ' ').trim()`——`read-schema-projection.ts` L127–128/L175–177 行注入防御、渲染器 `foldText` L984–986 同款）折叠后拼入 `field:` 前缀；**折叠施加于基槽字符串全程**（`index`/`key` 为 W1 校验闭合字面、前缀为常量，对 field 名全程折叠 ≡ 对全槽折叠）；不变式「块恒头行 + 恰一行事实行」随 B-8 一并冻结。W2-T 增敌意 field 名用例（`\n`/`✂`/行首 `- ` 载荷 → 单行输出、无注入结构、值通道不受影响）。评审验收标准逐项满足：**四插值槽（pathText/basis/dir/kept-total）均有确定性渲染规则；W2-T 含敌意 field 名用例且断言输出单行**。文件范围零变化（§11 注记） |
| O-1（非阻断）：空路径 `pathText` 两先例分叉（渲染器 ✂ 行字面 `[]` vs 头行空串） | §7.1 B-8 槽① | **顺带钉死**（F-1 复写 B-8 四槽规则时同句落位，消除 Byte 冻结双解）：空路径取渲染器 ✂ 行约定字面 `[]`（`render-projection-text.ts` L998）——B-8 与 ✂ 行文法同源 |
| O-2（非阻断）：B-6 语义点 2 两锚皆败枚举未对称点名「数组面下 schema 为封闭对象/Record 形」 | §7.2 冻结规则 2 | **对称从句补入**（零行为变更，通用规则本已覆盖）：数组面单锚失败即 null、无回退——有意不对称（off-schema 数据下容器口径会描述与值通道不符的形状） |
| O-3/O-4/O-5/O-6（非阻断观察） | 无需设计变更 | **维持原设计**：O-3 = RA-3 实现期义务（出处标记 + 独立预言机矩阵随契约测试同变更集落地，§7.4/§13 R2 已课）；O-4 = RA-2 文档披露属 AC6 验收属性（§11 文档面已列）；O-5 = SA8 报告论证措辞精度，结论经「路径键控」clause 独立成立，非本设计缺陷；O-6 = exports-audit 列 ALLOW 属预防性预留（无害） |

## 15. 是否需要设计后 ADR 冲突复查

**本轮 F-1 修订不触发新的设计后 ADR 冲突复查（`requiresConflictRecheck: false`）**，
理由：

1. 设计后冲突复查**已执行**：`wiki/raw/task_issue-369_design_conflict_report.md`
   （iteration 0，verdict **clear**——19 项对照全部 no-conflict / implements，0
   hard-conflict、0 evolution-required）覆盖本设计全部承重面（新公共 API、B-6 封闭对象
   回退、组合层 ✂ 窗口文本、分层与计数镜像），其中 ADR-0027 决策 1/2/3、ADR-0028
   决策 6/7/9、ADR-0024/0016/0008/0009 各行均裁 no-conflict / implements。其 §10 的
   `requiresConflictRecheck: true` 四条理由均系**实现期**核对义务（RA-1–RA-5），随
   实现票兑现，非设计轮重查。
2. F-1 修订是 SA8 §3.2 已裁定的「实现票文法自由度」范围内的卫生补丁：B-8 基槽折叠
   镜像仓内既有行注入防御纪律（`foldSegment`/`foldText`），不新增公共 API、不触碰
   ADR 冻结面、不修改任何承重裁决（锚链/计数路径/分层/键集/失败面零变化）；SA2
   iteration 0 评审同裁「不新增 ADR 张力 → requiresConflictRecheck: false」。
3. 原设计 §15 所列 true 理由中的「SA8 前置产物缺席 → 补偿性核验点」已被第 1 条的
   已执行复查消解；其余三条（新公共 API、B-6 schema 语义面、计数镜像层间张力）正是
   该已执行复查的覆盖对象且结论为 clear。

实现期义务保持不变：SA8 RA-1–RA-5（锚策略落地、文档披露、镜像纪律、冻结面 diff、
B-8 Byte 冻结）与 SA2 O-3/O-4 在实现票兑现（§11 文档面、§12 验收、§13 R2）。
