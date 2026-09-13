# SA8 设计后冲突复查 — issue #369 W2：lease 公共面 `readArray` / `readMap`（ADR 0028）

- 复查对象：**design**（`wiki/raw/task_issue-369_design.md`，SA1 实现设计，HEAD `ab6e390`）。
- 复查轮次：iteration 0（前置门禁产物缺席——`wiki/raw/task_issue-369_relevant_decisions.md` 与
  `_conflict_report.md` 均不存在，`artifacts/` 无 sa8-issue-369 产物；本报告按 skill 规则以 ADR 全集 +
  CONTEXT.md + 模块 AGENTS + 源码事实自建决策集合，兼具前置门禁与设计后复查职责）。
- SA2 review：不存在（`wiki/raw/task_issue-369_sa2_review.md` 实查缺席，与设计 §14 自述一致）——
  全维度攻击评审不属本次复查范围。
- 上游输入：`wiki/raw/task_issue-369.md`（Host brief）、`wiki/raw/task_issue-369_sa6_contract.md`
  （诊断与验收契约）、`wiki/raw/task_issue-368_{design,sa10_spec}.md`（W1 冻结面移交）。
- 本报告只读裁决，不改任何被审对象或决策文档。

---

## 1. Reviewed subject

design——SA1 对 issue #369 的实现设计。四个委派焦点：

1. **新公共 API**：runtime `readArray`/`readMap`（12→14 键）、lease 同名两方法（13→15 键）、
   type-only 别名、Equal 锁（设计 §7.1 B-1–B-5/B-11、§8.1）；
2. **封闭对象 map 元素口径回退**：B-6 锚链 `[...path,'<key>']` → `[...path]` 容器口径（§7.2）；
3. **组合层 ✂ 窗口截断文本**：B-7 无头线 + B-8 组合层追加窗口事实块（kind 槽 `窗口`，不经渲染器第二参）；
4. **所述分层约束**：§7.4 组合层计数镜像（namespace-runtime 内 O(N) 载体枚举）、
   doc-runtime/vfsl/readData 零改动红线（§11 DENY LIST）。

## 2. Inputs and decision set

| 类别 | 内容 | 状态 |
|---|---|---|
| ADR（accepted，约束有效） | 0028（窗口读，主契约：决策 1–9 + 开放问题）、0027（投影文本：决策 1–3、已知限制、对 0016/0024 的修订）、0024（形状预算 + #359 amendment）、0016（语义投影，交付条款已被 0027 修订、语义面延续）、0008（runtime 读写能力与 sequencer）、0009（registry/lease，含后续 amendment 的 lease 成员追加先例）、0023（Cordis 冻结服务面——经查不涉 lease） | 已读 |
| ADR（判定无关面） | 0001–0007、0010–0015、0017–0022、0025、0026：写侧/wire/持久化/诊断/schema 生命周期/chunked 面——设计 §11 DENY LIST 明示零触碰，与本次四个焦点无决策交集 | 标题级排除 |
| superseded 检查 | 0007 的 open/read 部分被 0008 取代（逻辑校验/写管线条款仍有效）；无其它被审面相关 superseded 链 | 无约束失效 |
| CONTEXT.md | 「投影文本」「形状预算」「截断省略」「截断事实段」「窗口读」词条（L44–66 区段实读） | 已读 |
| 模块 AGENTS（skill 认定的决策集合组成） | `packages/{namespace-runtime,namespace-registry,doc-runtime}/AGENTS.md`、`docs/AGENTS.md` | 已读 |
| 规范协议文档 | `docs/protocols/instance-replication-v1.md` 等——窗口读不触 wire，无适用条款 | 排除 |
| Owner 评论 | issue #369 评论数 = 0（REST 实读为空；dispatch 原文明示无 owner 要求） | 无条款 |
| 源码事实核验（替代 SA8 探针） | `doc-runtime/src/window.ts`（options/入口/两键成功面/D6 候选空间枚举 L495–540）、`vfsl/src/render-projection-text.ts`（签名 L135、`validateTruncations` kind 闭合于 depth\|width L317–340、行文法 L988–1002、块间 `\n\n` + 尾恰一 `\n` L160–170）、`vfsl/src/resolve-schema-at-path.ts`（`matchValueNode` L629–670：精确字段先于 `<key>` 槽、封闭对象未中零候选、数组非负整数无越界概念）、`namespace-runtime/src/read-schema-projection.ts`（头行 + `\n\n` + 渲染器正文、`foldSegment` 同款折叠）、`namespace-runtime/src/runtime.ts`（readData L558–611、canonicalReadOptions L838–865、seamReadOptionsInvalid L876–893）、`namespace-registry/src/lease.ts`（released 短路 L292–297、raw 透传、Equal 锁先例 L406–465）、键集守卫（runtime-close-lifecycle L159、registry-open L917）、runtime 值导出面（index.ts 恰 `RuntimeWriteFatalError` 一键）、namespace-runtime 直依赖 yjs 且 `projection.ts` 已有载体级值读先例、vitest include 覆盖拟议测试路径 | 逐项核实 |

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0028 决策 1 | 公共面 = lease 层两方法 `readArray(path,{n,orderBy?,depth?,maxChildrenPerNode?})`/`readMap`；`n` 必填 ≥1 | B-1 冻结名与 `(path, options)` 形；B-3 options = doc-runtime `ReadArrayWindowOptions`/`ReadMapWindowOptions` 单源 type-only 别名、第二参必填无重载；`n` 校验由 W1 OPT 单权威 | implements-existing-decision | ADR 0028 L18–22；`window.ts` L54–68（options 型，`n: number` 必填）；设计 §7.1 B-1/B-3 | 实现后核对 lease/runtime 签名与别名 Equal 锁 |
| ADR 0028 决策 3 | 条目列表 `[{index\|key,value}]`、身份随行、包装不进 schema 口径、空容器 `[]` | value 通道 = W1 原样直通（§7.3 S2）；包装不进口径由 B-7 承接（schema 描述锚位类型，不含 `{index\|key,value}` 形） | implements-existing-decision | ADR 0028 L37–42；`window.ts` L83–89（ArrayWindowEntry/MapWindowEntry）；设计 §7.1 B-4 | 无（W1 已交付；组合不改制） |
| ADR 0028 决策 4 | 每入选项 ≡ 同预算 `readData(项路径)`；终点宽度由 n 治理；maxChildrenPerNode 只治项内 | 值通道经 W1 物化（AC4 等价锚现状成立，SA6 §9-3）；预算两轴原样贯通值通道与锚解析；终点宽度零干预 | implements-existing-decision | ADR 0028 L44–48；设计 §7.3 S2/S5、§12 W2-E；`window.ts` 公共入口 JSDoc「每项物化 ≡ readLogicalValueAtPath(同预算)」 | 实现后以 W2-E 逐字节对账 |
| **ADR 0028 决策 6 + 开放问题 5（焦点 2）** | schema = 元素口径投影文本：描述入选项类型块 + docs（depth 标记落元素子树内）；**路径键控、与数据无关**；空容器照常返回元素口径；形态 = ADR-0027 投影文本 | B-6 锚链：数组面 `[...path,0]` 单锚；键面 `'<key>'` 锚 → 封闭对象形回退容器锚 `[...path]`；两锚皆败 → `schema:null`（null 单义直通）；R1 登记 depth 自容器起算的计量错位，拒绝 `depth+1` 注入 | **no-conflict**（裁独立论证见下） | ADR 0028 L56–59、L105；`resolve-schema-at-path.ts` L629–670（机制互证：Record 形 `<key>` 字面命中精确字段分支；封闭对象零候选；数组无越界概念）；SA6 §9-4 探针（`meta.<key>` → null、`meta` → 整块、空容器照常）；设计 §7.2 | 见 §8 RA-1/RA-2：作用域文档披露 + 实现后核对封闭对象族行为与文档一致 |
| ADR 0028 决策 7（焦点 1/3） | 恒四键；`truncated === kept < total`；窗口事实（kept n/total N + 基与方向）进 ✂ 段；total=0 无 ✂、truncated:false；三稳定码响亮不抛 | B-4 成功恰四键、失败 = W1 失败成员原样 \| `RuntimeReadDisabledResult` \| `NamespaceLeaseReleasedIssue`；B-8 ✂ 窗口事实块（kept<total 才在场 → total=0 结构性无块）；B-9 total 组合层自算；三码 + `PATH_NOT_ALLOWED` 透传 | implements-existing-decision | ADR 0028 L61–68；设计 §7.1 B-4/B-8/B-9、§7.3 S6；issue body AC3 同义 | 实现后核对四键 own 键集与 ✂/truncated 一致性 |
| ADR 0028 决策 8 | O(N) 子项枚举 + 只物化入选项 + 未入选零物化 | §7.4 计数 = 组合层 O(N) **标识枚举**（数组 `length`；Y.Map `keys()` 过 `get(k)!==undefined`；plain object descriptor 纪律键计数）——零值域读、零子项物化；物化仍由 W1 独占；E3 毒值哨兵锚定 | no-conflict | ADR 0028 L70–73；`window.ts` `enumerateMapCandidates`（D6 同款键空间）；设计 §7.4、§12 W2-E3；#368 设计 L358–360（W1 明示不带 kept/total，预知 W2 自做一次 O(N) 枚举） | 实现后以独立预言机对账计数-空间零漂移 |
| ADR 0028 决策 9（焦点 4） | 分层：doc-runtime 载体原语；namespace-runtime 组合 + 元素口径投影文本；registry lease 面与类型别名；readData 与 ADR-0024 options 零改动 | 新 `window-read.ts` 承载组合；lease 透传 + 别名；readData/options 零触碰（§11 DENY LIST 三处明示）；「形状预算」词条分工句已在 ADR-0028 基线落成（CONTEXT L49–50 实读），设计仅补作用域文档 | implements-existing-decision | ADR 0028 L75–80；设计 §7.3、§8、§11；CONTEXT.md「形状预算」词条护栏 vs 选择器句在场 | 实现后核对 DENY LIST 零 diff |
| ADR 0027 决策 1（焦点 3） | ✂ 段是截断事实唯一载体；结构化 truncations 键已退役；`schema:null` 单义；options 闭合形状 | 窗口事实仅经 schema 文本 ✂ 块承载；无第二载体、无结构化键复活；锚败 → null 照常四键返回（非读失败）；R4 如实登记 null × truncated 只剩布尔（= ADR-0027 已知限制 2 的窗口对偶） | no-conflict | ADR 0027 L20–25、L62–63；设计 §7.2-4、§13 R4 | 无（不增设机制即合规） |
| ADR 0027 决策 2/3（焦点 3） | 渲染器零选项纯函数；头行由 readData 组合层前贴且属规范文法；✂ 段行文法 `- <path> · <kind> · 省略 <N> 项`、kind 闭合 depth\|width | B-7 D1 无头线（备选 D2 否决理由成立：头行文法是 readData 冻结规范面）；正文 = 渲染器输出原样（含 `‡` 页脚）；B-8 窗口行由组合层追加、不经渲染器第二参——`validateTruncations` 结构上拒收窗口 kind（L317–340 实证），组合层追加是**既保 vfsl 冻结又兑现 ADR-0028 决策 7 的唯一路径**；组合层作者身份有头行先例（ADR 0027 决策 2 明文「readData 组合层前贴头行」） | no-conflict | ADR 0027 L29–33、L41–42；`render-projection-text.ts` L135/L317–340/L988–1002；设计 §7.1 B-7/B-8 | 实现后 Byte 级冻结（B-8 冻结后）；核对 readData schema 逐字节不变 |
| ADR 0024（+#359 amendment） | 预算两轴语义；width 是护栏非选择器；两通道截断位置对齐（计层规则） | 预算轴经 W1/锚解析原样消费、语义零重定义；窗口 schema 正文预算 = 锚位同预算（AC2 同预算 oracle）；两通道对齐条款系 readData 公共面承诺（决策 6「runtime readData 组合」），窗口面不属其字面管辖——封闭对象族 schema/值通道的层深错位并入 B-6 R1 已知限制登记 | no-conflict | ADR 0024 决策 1/5/6、amendment；CONTEXT「形状预算」；设计 §7.2-3、§13 R1 | 实现后核对 readData options 通道零改动 |
| ADR 0016（经 0027 修订后的延续面） | 解析与实际值无关、路径键控；null 单义三情形不细分；resolver 公共契约 | 锚链只消费 schema（resolver 路径键控）；锚败收敛 null 不作失败分类；`resolveSchemaAtPath`/`renderProjectionText` 仅公共消费零改动 | no-conflict | ADR 0016 L26–29、L68–73（修订后延续面）；设计 §7.2-4、§7.3 S5 | 无 |
| ADR 0008 | 读取不进 sequencer；读取观察已提交瞬时态；公共面 detached 投影；敌意输入零外抛；lifecycle 失败通道 | S1–S6 全同步、零 sequencer、零状态写入；结果全新字面量 + W1 新鲜条目（detached）；S3 canonical 镜像 + W1 重派发收编敌意 options；`RUNTIME_READ_DISABLED` 复用 readDisabled（零 options 读取、零 doc 触碰） | no-conflict | ADR 0008「读取能力」「单一 write sequencer」节；`runtime.ts` readData L558–611 先例；设计 §7.3、§9 | 实现后核对读同步性与 sequencer 零接触 |
| ADR 0009 | lease 代理 Runtime 除 close 外全部能力；released 冻结 issue 先于一切透传 | lease +2 方法（13→15）镜像 readData 透传先例（released 短路 L292–297 + active raw 引用直传）；Equal 锁两对沿 `_readAlias`/`_readBudgetAlias` 先例；追加模式有 amendment 先例（`openReplicationSession` 第十四成员） | no-conflict | ADR 0009 L38、L149；`lease.ts` L280–297/L406–465；设计 §7.1 B-5/B-10 | 实现后核对键集守卫 13→15 与引用同一性断言 |
| ADR 0023 | Cordis 冻结服务面 getter 化（nomicoreRegistry/hub/peer/clock） | 设计不触 registry **服务对象**；lease 是逐调用方能力非 Cordis 注入服务，不在 ADR 0023 冻结面表内；lease 构造模式（冻结字面量数据属性方法）与既有成员同款 | no-conflict | ADR 0023 影响面表（无 lease）；设计 §8.1 | 无 |
| 模块 AGENTS：namespace-runtime | 读不进 sequencer；公共 API 仅经 index；detached 投影 | 新方法同步纯读；type-only 经 index；`window-read.ts`/`projectSchemaTextBody` 为包内模块级导出（非公共面），与「公共 API 仅经 index」不冲突 | no-conflict | `packages/namespace-runtime/AGENTS.md` Boundaries；设计 §8.1、§11 | 实现后核对 index 导出面 |
| 模块 AGENTS：namespace-registry | 公共 API 仅经 `src/index.ts`；lease 能力面 | type-only 追加经 index；测试面走既有 testing 纪律 | no-conflict | `packages/namespace-registry/AGENTS.md`；设计 §11 | 同上 |
| 模块 AGENTS：doc-runtime + #368 冻结面 | "Keep carrier mechanics here"；W1 成功面恰两键/三码/D3/D6 冻结；read.ts 零 diff | DENY LIST 全包零改动；计数以「出处标记镜像」落组合层——与「载体机制归属 doc-runtime」存在**模块归属张力**，但：① 无 ADR 把计数指派给任何层（决策 7 只定 lease 面义务、决策 8 只定 O(N) 纪律）；② #368 设计 L358–360 明示否决 W1 附带计数并预知 W2 自做 O(N) 枚举——镜像是被上游冻结面**结构性逼出**的既定路径；③ namespace-runtime 已有载体级值读先例（`projection.ts` SCHEMA/META 直读、直依赖 yjs）；④ 设计以出处标记 + 独立预言机矩阵 + R2 follow-up（W1 冻结解除时下沉合并）控制漂移 | no-conflict（张力如实登记，非违规） | `packages/doc-runtime/AGENTS.md`；`wiki/raw/task_issue-368_design.md` L358–360；`task_issue-368_sa10_spec.md` L32；设计 §7.4、§13 R2 | 见 §8 RA-3：镜像纪律随契约测试落地 |
| CONTEXT.md 词条 | 「窗口读」「形状预算」「投影文本」「截断事实段」既有措辞 | 设计零触碰 CONTEXT（DENY LIST）；消费段补在作用域文档（typed-access / cordis-plugin-hosting），词汇对齐既有词条；封闭对象容器口径属「窗口读」词条未枚举的实现细节，词条 blanket 句（「schema 通道为元素口径投影文本」）与该族行为的相容性并入 B-6 裁决（见 §3 专项论证） | no-conflict | CONTEXT.md L44–66；设计 §11 文件面 | 见 §8 RA-2 |
| Issue brief AC1–AC6 | 恒四键/条目列表/元素口径 schema/✂ 事实/等价锚/三码透传/文档与全绿 | §12 逐条映射；AC2 oracle 双侧剥离对账；AC6 文档两处 + CONTEXT 零漂移 | implements-existing-decision | `wiki/raw/task_issue-369.md`；设计 §12 | 实现后按 SA6 §12 契约执行 |

**合计 19 项对照：implements-existing-decision 7 项、no-conflict 12 项、evolution-required 0 项、hard-conflict 0 项。**

### 3.1 专项裁决：B-6 封闭对象容器口径回退（焦点 2）

设计给出的理由是「最诚实口径 + OQ5 授权」。SA8 独立重算后**维持 no-conflict，但裁决基础比设计的
论证更硬**——回退不是偏好选择，而是被决策 6 自身条款**唯一确定**的缺口填补：

1. **决策 6 同时要求「路径键控」与「与数据无关」**。封闭对象形的逐项口径（按 `orderBy.field`/被选键
   解析再合成 union，设计候选 b）依赖「选哪个键」——数据依赖；且合成 union 不是任何 keyed path 的
   resolver 输出，破坏路径键控纪律。封闭对象值树上唯一**与数据无关**的可解析锚就是容器路径
   `[...path]`。⟹ 在「不动 vfsl、不造合成语义」的既定约束下，候选 (a) 是决策 6 条款联立的唯一解。
2. **候选 (c)（收窄载体词表）与决策 7 明文冲突**（readMap 收 Y.Map + plain object，封闭对象是合法
   载体）——设计的否决正确；收窄即 ADR 修订，超出本票。
3. **候选 (d)（封闭对象恒 `schema:null`）违反 issue AC1**（空容器必须返回非 null 元素口径 schema）——
   空封闭对象 map 会得 null，AC1 必红。
4. **depth 计量错位（R1）是容器锚的结构性后果**：以 `depth+1` 注入对齐会破坏 AC2 同预算 oracle 与
   ADR-0024 预算单一权威——设计的拒绝是决策相容选择，错位以已知限制登记 + 作用域文档披露处置。
5. **授权链的诚实校正**：OQ5 字面只覆盖「空容器」的呈现细节（元素类型块 vs 空窗提示行），设计的
   引用属**类推**而非字面授权。本裁决不依赖 OQ5 字面，而依赖：决策 6 两 clauses 对封闭对象族的
   联立唯一解 + 无任何冻结面被触碰（渲染器/resolver/readData/wire 零改动）+ AC 可满足性 + 设计
   对已知限制与 ADR 修订出路的如实登记（§11 DENY LIST docs/adr 注记、§13 R1）。若 Owner/SA2 后续
   要求封闭对象逐项对齐，走 ADR 0028 修订（设计已预留该路径）——该日之前不构成冲突。

**边界确认**：回退只影响 schema 通道的锚选择；值通道（决策 4 逐项等价）与失败面不受影响。数组面
`[...path,0]` 与 Record 面 `'<key>'` 锚逐字满足决策 6（含「标记落元素子树内」，SA6 §9-4 实证
`Task‡`）。

### 3.2 专项裁决：✂ 窗口事实行（焦点 3）

- **规范文法归属面**：ADR 0027 冻结的 ✂ 行文法与 kind 词表（depth|width）约束的是**渲染器输出**与
  **readData 表面**；窗口面是新表面，其 ✂ 内容义务由 ADR 0028 决策 7 直接课予（「窗口事实……进 ✂ 段」，
  issue body 同义）——即新条目形态的**授权源是 ADR 0028 本身**，精确行格式属实现票自由度（SA1 B-8
  冻结）。
- **结构必然性**：`validateTruncations` 拒收 depth|width 外 kind（源码实证）——窗口行**不可能**经
  渲染器第二参产生；在「vfsl 零改动」红线（ADR-0027/0016 冻结面 + 设计 DENY LIST）下，组合层追加是
  唯一实现路径。组合层作者身份不违反「文法权威单源在 vfsl」：该否决理由针对渲染器的**包归属**，
  且 ADR 0027 决策 2 已确立组合层前贴头行（规范文法文本的组合层作者）先例。
- **无混合歧义**：窗口 schema 正文渲染器第二参缺席（W1 成功面恰两键 → 值通道截断清单结构性不可得，
  B-7/R5 登记）——窗口面 ✂ 段内**只可能出现**窗口事实块，与 depth/width 行不同场，无解析歧义。
- **单载体纪律**：窗口事实无第二载体、无结构化键复活；`schema:null` × truncated 只剩布尔 = ADR-0027
  已知限制 2 的窗口对偶（R4）——与 0027 立场同构，非新冲突。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

设计未主张任何 override（其主张的是实现自由度与缺口填补，非决策覆盖）；Owner 评论为零，无 Owner
override；无新 ADR 修订旧 ADR；无协议版本升级。SA8 不创设 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| W1 载体原语（`packages/doc-runtime/**`） | 成功面恰两键、三码 + `PATH_NOT_ALLOWED` 词表、D3/D6 语义、read.ts 零 diff | `window.ts` L98–131；#368 设计 D9；设计 §11 DENY LIST | 设计零触碰（S2 只消费）——待实现 diff 核对 |
| `readData` 行为与 `projectReadDataSchema` 输出 | 逐字节不变（含头行与 ✂ 段）；`canonicalReadOptions`/`seamReadOptionsInvalid` 既有行为 | ADR 0027 缝 2 oracle；设计 §7.3 要点、§11 DENY LIST | 设计承诺字节冻结，仅内部共享件抽取（`projectSchemaTextBody`）——待实现核对 |
| vfsl 渲染器与 resolver 公共契约 | `renderProjectionText` 零选项签名、kind 词表闭合 depth\|width、快照锚定输出；`resolveSchemaAtPath` 签名与语义 | ADR 0027 决策 2/3；源码 L135/L317–340 | 设计仅公共消费（DENY LIST `packages/vfsl/**`） |
| ADR-0024 options 闭合形状 | `{depth?, maxChildrenPerNode?}` 三层零改动；预算单一权威 | ADR 0028 决策 9；ADR 0027 决策 1 | 设计零触碰 |
| 窗口失败码词表 | 三窗口码 + `PATH_NOT_ALLOWED`，不扩词表（组合层接缝/防御成员**复用同型**，构造点新增镜像 #336 A-2c 豁免先例） | `window.ts` L77–81；`runtime.ts` seamReadOptionsInvalid 先例 | 词表不变；message 不冻结 |
| lease/runtime 既有键与值导出面 | 既有 12/13 键全数保留；runtime 值导出仍恰 `RuntimeWriteFatalError` 一键 | registry-open.test L917、runtime-close-lifecycle L159、index.ts L45 | B-11 义务列明（12→14 / 13→15）——待实现核对 |
| `schema:null` 单义 | 无 active schema / 路径偏离 / 敌意 path 三情形不分；null 不是读失败 | ADR 0016/0027；设计 §7.2-4 | 锚链败 → null 直通，合规 |
| wire / 持久化 / 诊断日志面 | 零触碰 | SA6 §12.5；设计 §11 DENY LIST | 设计零触碰 |
| CONTEXT「窗口读」「形状预算」词条 | 零漂移 | CONTEXT L44–66；设计 DENY LIST | 计划零触碰——待实现 diff 核对 |
| lease 构造模式（冻结字面量 + 数据属性方法） | 同款追加，不改 Cordis 服务面 | ADR 0023 影响面表（无 lease） | 新方法沿同款构造 |

## 6. Evolution requirements

无 `evolution-required` 项。两点边界说明：

1. B-6 封闭对象回退**不改任何已决条款的可适用文本**（决策 6 的「入选项类型块/元素子树」对封闭对象族
   属条款不可适用域——该族无同质元素类型块；回退是「路径键控 + 数据无关」联立下的唯一缺口填补，
   见 §3.1）。不触发同变更集 ADR 修订义务；设计预留的 ADR 修订出路（Owner/SA2 另裁时）足够。
2. ✂ 窗口事实行是**新表面上的新条目形态**，授权源为 ADR 0028 决策 7（后立 ADR 对 ✂ 段内容义务的
   直接课予），非对 ADR 0027 冻结面的修订；readData 表面与渲染器零变化。

## 7. Hard conflicts

无。

## 8. Required actions

- **RA-1（实现期核对，约束非重构）**：B-6 裁决必须原样落进实现与契约测试——封闭对象族 readMap 的
  schema = 容器口径块、`depth:0` 呈容器级 `[...]‡`、`depth ≥ 1` 呈完整字段块（W2-S4 oracle 锚 =
  容器路径）；不得实现期临场改锚策略（改策略 = 回到 SA1/SA8 重裁）。
- **RA-2（文档一致性）**：作用域文档两处（`.agents/skills/nomicore/typed-access.md`、
  `docs/integration/cordis-plugin-hosting.md`）的窗口读消费段必须含封闭对象容器口径与 depth 计量
  说明 + 与 readData 预算分工句（设计 §11 已列）；CONTEXT 词条保持零漂移。若实现后消费段措辞需
  词汇级收录（Owner/SA2 判断），走 CONTEXT/ADR 修订流程，不得静默改词条。
- **RA-3（计数镜像纪律）**：出处标记（`copied from window.ts@ab6e390`）+ 独立预言机边界矩阵
  （显式 undefined 值键/accessor/non-enumerable/稀疏/空/ROOT）必须随契约测试同变更集落地；
  R2 follow-up（W1 冻结解除时下沉合并）保持在任务外登记。
- **RA-4（冻结面核对）**：实现后复查须逐项核对 §5 表——重点 `projectReadDataSchema` 输出字节
  （共享件抽取后）、doc-runtime/vfsl 零 diff、键集守卫 12→14 / 13→15 且既有键全数保留、
  值导出面不变。
- **RA-5（B-8 字节冻结）**：✂ 窗口事实行冻结后测试升 Byte 级断言（SA6 §12.6-2）；保持窗口 schema
  文本永不混入渲染器产 ✂ 条目（结构性由 W1 两键面保证——不得为混入开任何通道）。

## 9. Verdict

**clear**

- 19 项对照全部为 no-conflict（12）或 implements-existing-decision（7）；四个委派焦点逐一裁决：
  新公共 API（ADR 0028 决策 1/9 + ADR 0009 代理条款，加法兑现）、封闭对象回退（§3.1 唯一合规
  缺口填补，已知限制如实登记）、组合层 ✂ 窗口文本（§3.2 授权源与结构必然性成立、单载体纪律保持）、
  分层约束（决策 9 三/四层兑现；计数镜像张力 R2 如实登记且有纪律控制，非违规）。
- 无 hard-conflict、无 evolution-required、无待创设 override。
- 输入完备性：SA8 前置产物缺席已由本报告以 ADR 全集 + 源码核验补偿（§2）；SA6 探针证据与源码
  逐项互证，无证据不足项。

## 10. requiresConflictRecheck

**true**。理由（skill 判据：公共 API、schema、失败语义尚待实现核对）：

1. 新增公共 API（runtime 12→14、lease 13→15、四对公共别名 + Equal 锁）尚待实现核对；
2. 新 schema 文本形态（元素口径正文 + 组合层 ✂ 窗口事实块、B-8 字节冻结）与 B-6 封闭对象族行为
   尚待实现核对（含 RA-1/RA-5）；
3. `projectReadDataSchema` 内部共享件抽取后的逐字节冻结、doc-runtime/vfsl/readData/options/
   CONTEXT 零 diff（RA-4）尚待实现 diff 核对；
4. 组合层计数镜像（namespace-runtime 载体枚举值级使用）与 ADR-0008/模块 AGENTS 分层纪律的
   相容性以 RA-3 纪律落地为条件，实现后复核。
