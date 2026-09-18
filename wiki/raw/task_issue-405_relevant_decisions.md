# SA8 相关决议摘录 — Issue #405 `readData 面：maxBytes 交付总量收/拒闸（tracer）`

- 派发：`sa-da0c37ad-80f0-4d8e-b13c-13dca8163ed5`（role `mabf-sa8`，phase `conflict-gate`，iteration 0）
- 被审对象：`wiki/raw/task_issue-405_sa6_contract.md`（SA6 验收契约，design 层产物替代缺席的 `task_issue-405_design.md`）
- 本文件职责：只摘录相关决策、条款与关联点，不重写原义、不作业务设计。裁决见 `task_issue-405_design_conflict_report.md`。
- 决策集快照：HEAD `fc6c1d3`（ADR 0031 入仓提交）；全部 ADR 状态 = 已接受，无整篇 superseded；部分条款的再修订链已在各 ADR 状态行显式登记。

## 1. ADR 0031（母法，直接授权）`docs/adr/0031-readdata-byte-budget.md`

| 条款 | 原义摘录 | 与本票关联点 |
|---|---|---|
| 决策 1（三读面 options） | 「`readData` / `readArray` / `readMap` 的 options 闭合形状追加 `maxBytes?: number`：**≥1 的有限整数（≤ 2^53−1）**；`0`、负数、非整数、非有限数、未知键 → 各面**既有** options 校验码响亮拒绝（readData 面 `READ_OPTIONS_INVALID`，窗口面 `WINDOW_OPTIONS_INVALID`），不新增校验码。缺席 ≡ 不设预算（现行为逐字节不变）；不内建任何魔法默认」 | 域句含上界括注（既有轴 ADR 0024 无此括注——对照「≥ 0，整数」）；三面义务同条款；未定义「键在场、值 undefined」 |
| 决策 2（总量语义与规范度量） | 值通道 = `utf8(JSON.stringify(value))`（紧凑、键序 = 交付序；`value === undefined` 计 0）；schema 通道 = 投影文本 UTF-8，「头行与 ✂ 段在文本内，自然计入、不豁免」；`schema: null` 计 0；「整体序列化即度量」、等式可 property test；「账本不进公共面（成功面恒四键不变，不新增 bytes 键）」 | 契约 G3/G4/G7/G8 与 §12.0 锚表的直接依据 |
| 决策 3（超限零交付） | 五键失败分支 `{ ok:false; code:'READ_BUDGET_EXCEEDED'; path; measuredBytes; message }`；「`measuredBytes` 只报合计，不拆分」；「**三面同码同文同载荷形**…面区分靠调用现场，不靠 message」；「不裁剪、不降深度、不拟合…成功交付物与无预算读逐字节相同」；「恰好等于 `maxBytes` → 成功（≤ 判定）」 | G1/G2/G3；「同文」义务延伸至窗口面票的消息措辞 |
| 决策 4（分层落点 + 零变化清单） | 「校验与度量住 `@nomicore/namespace-runtime` 组合层…`@nomicore/doc-runtime` **零改动**（下传 options 仍为 `depth`/`maxChildrenPerNode` 两键）；registry lease 结果类型与 options 类型别名跟随透传（既有别名锁断言延伸）」；「恒四键成功面、✂ 文法、投影文本渲染器、头行文法（**不记 maxBytes**…）、`DeepOptional` 类型面、无 options 逐字节行为：全部零变化」 | G9/G11/N11、§12.6 不可触碰面、D3/D4 自由位的边界 |
| 决策 5（边界） | 「缺席目标的读同样可能超限报错…投影文本照常在场…照常计量」；「终态目标不是预算 no-op（对 ADR 0024 决策 1 的例外注记）」；「where 过滤窗口无语义对撞…本 ADR 不装配任何 ✂ 条目」 | G6、G4 终态锚（R4）、H8 |
| 决策 6（使用指引） | 「`maxBytes` 只治理**交付总量**，不治理物化工作量——无结构预算的宽路径读可能全量物化后被拒…不劣化。指引进 typed-access 纪律与作用域文档」 | §7 无性能阈值断言的依据；文档义务落点（见 §5） |
| 「对既有 ADR 的修订」节 | ADR 0024 决策 1 options 形状修订三键 + 终态 no-op 例外注记 + 开放问题「字节级预算」收口；ADR 0027 决策 1「options 闭合形状零变化」句修订三键（头行、✂、渲染器零选项纯函数条款不动）；CONTEXT.md 新增「字节预算」词条 + 「形状预算」`_Avoid_` 改写 | 决策集在 HEAD 已自洽（0024/0027 状态行均回指 0031） |
| 「验收」节 | 主接缝（runtime **三读面**：分支形状与三面同码同文、≤ 边界、options 负控「readData 面与窗口面各走其码」、缺席 × 超限、`schema:null` × maxBytes、无 options 回归锚）；度量等式 property；lease 透传断言；**文档负控**（「作用域文档词汇重录——`maxBytes` 语义在场、『归调用方字节闸』措辞清退（readdata-docs 契约夹具族锚定）」）；全套门禁 + root `pnpm typecheck` / `pnpm test`；发布随 minor bump | 契约 §3 的义务映射来源；窗口面行与文档负控行的递延对象 |
| 开放问题 | 可选裁剪模式（`over:'trim'` 类）登记为演进位，不因本 ADR 预先承诺 | 排除「裁剪交付」类实现（G1 逐字节断言已锚死） |

## 2. ADR 0027 `docs/adr/0027-readdata-projection-text.md`（修订链在案）

- 决策 1：成功分支**恒四键** `{ok,value,schema,truncated}`；截断事实唯一载体 = ✂ 段；「`options` 闭合形状 `{depth?,maxChildrenPerNode?}` 零变化」句**由 ADR 0031 再修订为三键**（状态行在案）。
- 决策 2：`renderProjectionText` **零选项纯函数**、逐字节确定（vfsl 公共导出）。
- 决策 3：头行 `# readData [<path>] {depth:N}` 与 ✂ 段为规范文法（快照锚定）——0031 修订不动此两条。
- 决策 4：runtime 组合层单四键形、lease 别名跟随零语义变化。

## 3. ADR 0024（+2026-09-14 #359 amendment）`docs/adr/0024-readdata-shape-budget.md`

- 决策 1：既有两轴域 = 「`depth`（≥ 0，整数）/ `maxChildrenPerNode`（≥ 0，整数）」——**无上界括注**；非法 options（负数、非整数、非有限数、非对象、未知键）→ `READ_OPTIONS_INVALID`；「不传 options = 完整投影」。决策 1 的 options 形状与「终态 no-op」条款由 ADR 0031 再修订（状态行在案）；开放问题「字节级预算」由 0031 收口。
- 决策 2（amendment 后）：输出端 undefined 键省略吸收纪律（E1）不引入「键在、值 undefined」第三态——值面纪律，本票不触碰。
- 决策 6/7：doc-runtime 三参公共面 `readLogicalValueAtPath(doc,path,options?)`、runtime 组合、lease 原样透传；`DeepOptional` 类型面。

## 4. ADR 0028 / 0029（窗口面，递延义务的关联决议）

- ADR 0028：`WINDOW_OPTIONS_INVALID` = 「规则非法（n=0 / 非整数、非法枚举、readArray 传 field、readMap 传 `by:'index'`、orderBy 非法形状）」；窗口 options 闭合形状现状**不含** `maxBytes`（HEAD 事实）。
- ADR 0029：where 在场 ✂ 永不装配；ADR 0031 决策 5 裁定与 where 无语义对撞。
- ADR 0031 决策 1/3 对窗口面的 `maxBytes` 义务（含决策 2 的窗口同构度量：「总量 = 条目列表（含 key/index 包装）的紧凑 JSON + 元素口径投影文本」）在窗口面票落地前为**未兑现义务**。

## 5. CONTEXT.md 术语（root，L49–71 区域）

- **字节预算（byte budget）**（L53–55）：「`readData`/`readArray`/`readMap` options 可选的交付总量上限…超限零交付响亮拒绝（稳定码 `READ_BUDGET_EXCEEDED`，载荷含实测合计 `measuredBytes`），不裁剪、不降深度，成功交付物与无预算读逐字节相同…缺席目标的读同样可能超限；跨三读面同码同文（ADR 0031）」。`_Avoid_`：字节截断/字节裁剪、部分交付、把 maxBytes 当 depth/width 替身、在 ✂ 段找字节事实、期望载荷拆分分项。
- **形状预算**（L49–51）：`_Avoid_`「把字节预算当形状预算的第三轴」——两轴分工的权威表述。
- **截断省略 / 截断事实段（✂）/ 投影文本 / 语义 schema 投影**（L41–63）：恒四键、✂ 唯一载体、`schema:null` 单义、头行预算段文法——G7/G8 零漂移锚的术语面。
- **窗口读 / 过滤窗口**（L65–71）：`WINDOW_OPTIONS_INVALID` 语义、窗口与预算分工——G11 递延期守卫的术语面。

## 6. 模块与文档 AGENTS 中明确收录的决策/纪律

- `packages/namespace-runtime/AGENTS.md`：「Reads stay outside that sequencer」「Public APIs expose detached projections only」——readData 同步、不进 sequencer、公共面只暴露 detached 投影。
- `packages/namespace-registry/AGENTS.md`：lease = 独立调用方能力；公共 API 仅经 `src/index.ts`。
- `packages/doc-runtime/AGENTS.md`：「Keep reads schema-independent」；公共面变更须过 public-surface guard 测试。
- `docs/AGENTS.md`（Authority/Editing/Verification）：「When code behavior changes, update every normative document whose stated contract changed」；「Historical `wiki/raw/` artifacts are evidence, not normative contracts」。
- 作用域文档族（readdata-docs 夹具 `SCOPE_DOCS`，`packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` L54–58）：`.agents/skills/nomicore/typed-access.md`、`docs/integration/cordis-plugin-hosting.md`、`docs/integration/external-project-vfsl-codegen.md`。注意：`.agents/skills/nomicore/typed-access.md` L125 现文「the closed options shape accepts **only the two budget keys**」——实现三键后该句失真，是 ADR 0031 验收「文档负控」行的直接对象。

## 7. 现状事实（源码确认，不构成冲突基准，仅锚定 SA6 契约的事实声明）

- `packages/doc-runtime/src/read.ts`：`ReadLogicalValueAtPathOptions` 两键；`validateReadOptions` 键空间白名单 depth/maxChildrenPerNode，「已知键值 undefined ≡ 缺席（R1）」、accessor 零执行、-0 归一、值域 `≥0`（无上界）。
- `packages/namespace-runtime/src/runtime.ts`：`NamespaceRuntimeReadDataOptions` = doc-runtime 两键单源别名；`NamespaceRuntimeReadDataBudgetResult` 失败面 = `PATH_NOT_ALLOWED | READ_OPTIONS_INVALID`（+ lifecycle `RUNTIME_READ_DISABLED`）；`canonicalReadOptions` 白名单两键、present-undefined 剥离（R1 同款）。
- `packages/namespace-registry/src/lease.ts`：双重载原样透传（released 短路优先）、`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` Equal 锁。
- `tsconfig.base.json` L10 `exactOptionalPropertyTypes: true`（显式 `maxBytes: undefined` 对 TS 调用者是编译错误）。
- vitest include（`vitest.config.ts`）覆盖 `packages/*/test/**/*.{test.ts,test-d.ts}`——SA6 §12.2 契约文件路径与发现入口声明属实。
