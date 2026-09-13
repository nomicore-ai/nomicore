# SA8 冲突报告 — issue #363（SA6 验收契约前置门禁）

- Reviewed subject: **task**（被审对象 = 已批准的 SA6 验收契约
  `wiki/raw/task_issue-363_sa6_contract.md`，连同其输入票面
  `wiki/raw/task_issue-363.md`；本报告在实现派发前作前置门禁，并回填 SA6 §1
  登记缺席的 SA8 产物）
- 审查基准：ADR 全集（27 篇，全部 accepted，无 superseded）+ `CONTEXT.md` +
  `docs/vfsl/v1-spec.md`（规范语言规格）+ `packages/vfsl/AGENTS.md`（模块收录决策）
- 诊断 HEAD：`12674544d2f24eb7d47c47ca4613b894043711d4`（与 SA6 契约登记一致；
  `origin/adr0027-projection-text` 同 SHA——父分支只含 ADR 0027 设计基线，无实现）
- Issue REST comments snapshot：**空**——无 owner 补充要求、无 comment ID、
  **无任何合法 override 来源**

## 1. Inputs and decision set

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-363.md`（Host-owned brief） | 在场（untracked），票面 What-to-build + AC 6 条 |
| `wiki/raw/task_issue-363_sa6_contract.md`（被审对象） | 在场（untracked），16 节验收契约 |
| `docs/adr/0027-readdata-projection-text.md` | 在场，HEAD 顶提交即设计基线（accepted） |
| ADR 0016 / 0024（含 #359 amendment）/ 0003 / 0019 / 0020 / 0021 | 在场（accepted；0016 交付条款、0024 决策 3/4 通道已被 0027 显式修订） |
| `CONTEXT.md` 词汇（语义 schema 投影 / 投影文本 / ✂ 段 / 标记类型 / 挂载锚位） | 在场，已含 ADR-0027 词汇 |
| `docs/vfsl/v1-spec.md` §2 文法 | 在场（scalar domain 源文法权威） |
| `packages/vfsl/AGENTS.md` + 根 `AGENTS.md` | 在场（包边界 + 模块指引） |
| Issue comments / owner 裁决 | **空**——无 override 输入 |

SA6 契约引用的关键事实经 SA8 独立复核（源码只用于确认事实，不替代决策文本）：
HEAD `1267454` ✓；`git status` 仅余 brief + 契约两 untracked 文件 ✓；
`packages/vfsl/src/index.ts` 恰 20 个值导出、无 `renderProjectionText` ✓（E1/E2）；
`renderProjectionText` 全仓仅 `docs/adr/0027` 提及 ✓；doc-runtime
`ReadLogicalValueTruncationEntry`（`packages/doc-runtime/src/read.ts` L88–92）
= `{ path: readonly (string|number)[]; kind: 'depth'|'width'; omitted: number }` ✓
（契约 §10 结构兼容锚）；`BUDGET_MARKER_MATRIX` 12 path × byDepth = **37 格** ✓；
`M4_CONTRACT_PATHS` = **16 路径** ✓；金标单元 37+16+12+3+9+9 = **86** ✓；
`BUDGET_NO_BUDGET_DIGESTS['[]']` = `e600851a…` ✓（E5 摘要锚）；
`vitest.config.ts` include / typecheck.include 覆盖拟定测试路径 ✓（§14）；
`pnpm typecheck` 串行含 `tsc -p packages/vfsl/tsconfig.json` ✓。
SA6 §4 基线门禁数字（378 files / 4384 tests / typecheck 0）为 SA6 实测记录，
SA8 按角色不重跑测试，未发现与其矛盾的仓内事实（工作树零生产改动）。

## 2. Decision analysis

| # | Decision | Clause | Subject behavior（SA6 契约条款） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | ADR 0027 决策 2 + 验收缝 1；`packages/vfsl/AGENTS.md`「公共 API 只经 src/index.ts」 | 渲染器经 `@nomicore/vfsl` 公共入口导出 | §10 影响面（index.ts 新增 1 值导出 + 入参类型 export type）+ §12.2 G1 动态接缝取导出、不读实现源码 | **implements-existing-decision** | `docs/adr/0027-readdata-projection-text.md` L27–32、L78；index.ts 现无该导出（E1 实测） | 按 §10 落地；仅经 index.ts |
| D2 | ADR 0027 决策 2；备选否决「`RenderProjectionOptions`」 | 零选项签名、同步纯函数、逐字节确定 | §12.2 G1.2–G1.4（一参/二参 undefined 等价、返回 string）+ G1.5–G1.9 类型面 `@ts-expect-error` 封第三参与选项对象；§12.7 CT-6 确定性/零变异/无跨调用状态 | **implements-existing-decision** | ADR 0027 L29（零选项纯函数）、L71（选项对象否决）、L78（零选项签名） | 无 |
| D3 | ADR 0027 决策 2 | 输入类型 = `ReadDataSchemaProjection` 系（保留为公共类型，包面零破坏） | §12.2 G1.6/G1.7 双入参（`ReadDataSchemaProjection` 与 `BudgetedReadDataSchemaProjection`）编译断言 | **implements-existing-decision** | ADR 0027 L30；`packages/vfsl/src/index.ts` L140–149 两类型已在场 | 无 |
| D4 | ADR 0027 决策 2（文本组装序：头行由 readData 组合层前贴） | 渲染器不产出头行 | §12.2 G1.4 反断言 `text.includes('# readData [') === false`；§11 排除项「渲染器不知道实参 path，产出头行 = 伪造事实」 | **no-conflict** | ADR 0027 L31；CONTEXT「投影文本」L46 的头行描述是含组合层前贴的**交付形态**，非渲染器输出——权威分工无歧义 | 无（头行归缝 2 票） |
| D5 | ADR 0027 决策 3 | 字段行 / 标量域 / Record / union 文法（`名?: 类型 // 口径首行…`、`Int<1, 9999999999>`、`Range<0, 100>`、`Pattern<"…">`、enum ` \| ` 分隔 + 超 100 列折行、`Record<string, T>` + 行尾 keyPattern 注释、union 不特判判别式、`T[]`、ref 直写别名名、optional 透明解包为 `?`） | §12.3 F6 文法形态 9 格 + 源文法拼写清单 | **implements-existing-decision** | ADR 0027 L36–39；v1-spec §2（`number & Int<min,max>` 等交集白名单——源文法含基类型，渲染拼写只留约束侧，两权威辖域不同）；`packages/vfsl/src/derived.ts` L44–58（int min?/max?、range、pattern、enum string\|number、object.keyPattern、optional 包装均在——可忠实再呈现，无表示性缺口） | 无 |
| D6 | ADR 0027 决策 3 | 别名块 = 闭包发现序（与 resolver aliases 键序同源） | §12.3 金标录制纪律（块序 = 闭包发现序）+ §12.5「手造投影多带未引用别名照样按 aliases 键序渲染」 | **implements-existing-decision** | ADR 0027 L40；ADR 0016「投影体」（aliases 传递闭包、ref 按名保留） | 无 |
| D7 | ADR 0027 决策 2（口径恒 first-line，无 full/skip-members） | first-line 口径 + 敌意 docs 防御 | §12.5 CT-4：多行取首行 + `…`、换行折叠不产生新行、敌意文本结构不变性（行数 + 首 ` // ` 前缀逐行相同）、注释不越行 | **implements-existing-decision** | ADR 0027 L32、L41 | 无 |
| D8 | ADR 0027 决策 3 + 已知限制 3；ADR 0024 决策 5 冻结面（marker 线索不带元素类型名） | `‡` 位标 + 页脚一行；`via:'ref'` → `<name>‡`、`via:'container'` → 字面 `[...]‡` 不编造 | §12.4 CT-3 全组（计数 m+1、页脚位置、敏感性反例） | **implements-existing-decision** | ADR 0027 L37、L64；CONTEXT「投影文本」L46 | 无 |
| D9 | ADR 0027 决策 3 首条 + ADR 0024 #359 amendment 第 3/4 条 | 可见性切片延续：渲染不增删投影内容；已渲染宿主槽位 docs 在场、被截闭包内部省略 | §12.5 CT-4 双向敏感性（删 docs 条目 → 文本消失；加无宿主脊柱键 → 结构行不变；清空 docs/aliasDocs → 结构行逐行相同）+ §12.3 F4/F5 槽位注释随宿主 | **implements-existing-decision** | ADR 0027 L37；ADR 0024 amendment L178–196；CONTEXT「语义 schema 投影」L42 | 无 |
| D10 | ADR 0027 决策 1/3；CONTEXT「截断事实段」 | ✂ 段：truncations 在场才出现；逐条 path（含数字段）/ 裁因 token / omitted 计数；缺席 / undefined / `[]` 三者逐字节相同且无 `✂`；段为文末块 | §12.6 CT-5 全组 | **implements-existing-decision** | ADR 0027 L22、L42；CONTEXT L57–59 | 无 |
| D11 | ADR 0027 决策 2/缝 2 + ADR 0024 决策 3 条目字段 | truncations 第二参与 doc-runtime `ReadLogicalValueTruncationEntry` 结构兼容（组合层原样透传、不得要求转换） | §10 下游一致性锚 + §12.2 结构类型断言（`path: readonly (string\|number)[]`、`kind: 'depth'\|'width'`、`omitted: number` + 封闭判别反例） | **no-conflict** | ADR 0027 L31、L79；ADR 0024 L53–59；`packages/doc-runtime/src/read.ts` L88–92（形状逐字段核对一致）；vfsl 零运行时依赖（真叶包）——结构类型是唯一边界一致取型法 | 无 |
| D12 | ADR 0027 决策 1/4/5（范围与生效点） | T1 纯加法、不触碰 readData / namespace-runtime / doc-runtime；缝 2（恒四键、detach 退役、头行拼接）与缝 3（文档负控）属后续票 | §10 红线清单 + §2 范围切割 | **no-conflict** | ADR 0027 L18–25、L44–53、L79–80；ADR 0016/0024 的 0027 修订条款生效点均在组合层票 | 无 |
| D13 | ADR 0027 决策 5（破坏性 minor bump） | 契约声明「本票加法，不构成破坏性 minor bump；发布动作不在 worktree 内」 | §10 | **no-conflict** | 破坏面 = readData 交付形态变化（缝 2 落地时）；T1 只新增导出，无既有行为变化——bump 义务挂后续票，非本票冲突 | 后续票（缝 2）兑现 ADR 0027 决策 5 时须同 minor 发布 |
| D14 | `packages/vfsl/AGENTS.md`（同步、确定、环境中立、无 Yjs 关注、JSON 可序列化） | 渲染器 = 同步纯函数、零选项、无 I/O/时钟/缓存；不引入 Yjs 运行时关注 | §7（无竞态/并发/网络/I/O）+ §12.7（零变异、无 memo） | **implements-existing-decision** | `packages/vfsl/AGENTS.md` L9–13 | 无 |
| D15 | ADR 0027 决策 3（xml 形态拼写未给）+ CONTEXT「标记类型」（`YXmlFragment` 大小写是契约） | `xml` 形态拼写、无宿主 docs 键呈现、后缀歧义 tie-break、排版逐字、truncations 类型名——五项**显式延期至设计门**（P1–P5），且钉死「不得为归位伪造位置或路径」 | §12.9 P1–P5 + §15 待钉清单 | **no-conflict** | ADR 0027 决策 3 只给规范性要素（SA6 §8 Step 8 已登记措辞粒度）；延期不违反任何决策文本；防伪造约束与 CONTEXT「语义 schema 投影」（路径键控、不伪造）一致 | SA1 设计门先钉 P1–P5，SA3 方可冻结对应逐字快照（见 Required actions） |
| D16 | ADR 0016 解析语义 + ADR 0024 决策 5（resolver 冻结面） | 既有 resolver 面（`resolveSchemaAtPath` 四键形状、预算摘要、失败码）为恒绿控制组 | §12.8 控制文件（20 导出超集断言、`BUDGET_NO_BUDGET_DIGESTS` 摘要、`SCHEMA_OPTIONS_INVALID` 抽格） | **implements-existing-decision** | ADR 0016 L52–73；ADR 0024 L91–95；digest `e600851a…` 与夹具逐字一致 | 无 |
| D17 | 根 `AGENTS.md`（typed Namespace 写纪律） | 本票不碰写路径、不碰生成物——纪律不适用 | §3 明示「与本票无关」 | **no-conflict** | 根 `AGENTS.md`「Typed Namespace writes — mandatory」辖域为 mutateData 写路径 | 无 |
| D18 | ADR 0027 决策 2（渲染器失败语义未规定） | 契约对**畸形投影输入**的渲染器行为未设断言（断言全集限于 resolver ok 产物与手造合法派生物） | §12.1–§12.7（无畸形输入用例） | **no-conflict** | ADR 0027 未规定该面；vfsl AGENTS 判别联合纪律的既有例外（trusted-domain throw `InternalError`，ADR 0016）表明同类先例存在但本 ADR 未延伸到渲染器——非决策冲突，属未钉设计面 | 建议设计门一并钉畸形投影的失败语义（loud、可归因），非阻塞 |

裁决分布：**no-conflict × 8**（D4、D11、D12、D13、D15、D17、D18 及 D5 内的辖域注记），
**implements-existing-decision × 10**（D1–D3、D5–D10、D14、D16）；
**evolution-required × 0，hard-conflict × 0**。

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |
| —（无） | —（Issue comments 空；无新 ADR；无协议版本升级；无决策文本自允演进条款被援引） | — | — |

本票不需要、也不存在任何 override：全部行为要么兑现 ADR 0027 明确义务（缝 1），
要么在既有决策（0016 语义面 / 0024 #359 / vfsl 包边界）框架内。实现便利、测试
通过、父 PR 存在均不构成 override，也未被发现被援引。

## 4. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（HEAD + 契约影响面） |
| --- | --- | --- | --- |
| `resolveSchemaAtPath` 签名/语义/投影包装联合 | 三参 `options?`、无 options 逐字节不变、`SchemaTruncationMarker` 形态 | ADR 0016 L52–73；ADR 0024 L91–95；`packages/vfsl/src/resolve-schema-at-path.ts` | 契约 §10 红线列为不触碰 ✓；HEAD 零生产改动 ✓ |
| vfsl 既有公共导出面 | 20 个值导出在场（超集断言，不锁新增名） | `packages/vfsl/src/index.ts`（SA8 复核 20 名逐一在场） | 契约 §12.8 控制组断言 ✓；新增仅 `renderProjectionText` + 类型 ✓ |
| doc-runtime 值通道 truncations 条目形状 | `{ path; kind: 'depth'\|'width'; omitted }` | ADR 0024 决策 3；`packages/doc-runtime/src/read.ts` L88–92 | 契约只做结构兼容断言，不改该文件 ✓ |
| readData 公共面（恒五键现状 → 缝 2 票再变恒四键） | 本票不触碰 `packages/namespace-runtime/*` | ADR 0027 决策 1/4（生效点在缝 2） | 契约 §10 红线 ✓ |
| ValueSchema 冻结 kind 集 | 渲染器只读消费，不扩展语义联合 | ADR 0003；ADR 0024 决策 5（截断标记留投影包装层） | 契约无扩展动作 ✓ |
| CONTEXT 词汇 | 不新增/不改词条（ADR 0027 词汇已写完） | CONTEXT L41–59 已含投影文本/✂ 段 | 契约 §3 明示不触碰 docs/CONTEXT ✓ |
| wire / 持久化 / 诊断日志 / 复制面 | 全部不变 | ADR 0010/0013/0022/0011/0014 等 | 契约影响面不含任何上述文件 ✓ |

## 5. Evolution requirements

无 `evolution-required` 项。T1 是 ADR 0027 决策 2/3 的**直接兑现**（缝 1），
不改任何既有契约面；P1–P5 是 ADR 0027 文法粒度内的设计钉死项，不构成 ADR /
CONTEXT / 协议修订，无需修订计划。ADR 0027 决策 5 的破坏性 minor bump 义务
挂缝 2 票（跨票台账事项，非本票缺口）。

## 6. Hard conflicts

无。未发现任何与 accepted 决策不兼容且无 override 的条款；SA6 契约的关键事实
主张（导出面、符号面、类型面红、夹具矩阵计数、digest、runner 入口、父分支
SHA）经 SA8 独立复核全部属实。

## 7. Required actions

1. **放行实现**（SA3）：按契约 §10 影响面落地——`packages/vfsl/src/index.ts`
   新增导出 + `packages/vfsl/src/render-projection-text.ts` 新文件 + §12.1 四个
   测试/fixture 文件；红线清单（resolver / namespace-runtime / doc-runtime /
   版本链）逐项保持零触碰。
2. **设计门先钉 P1–P5**（SA1，先于快照冻结）：P1 无渲染宿主 docs 键的呈现
   （契约已钉「不得伪造位置或路径」）；P2 根内联树后缀歧义确定性 tie-break；
   P3 `xml` 形态拼写（建议与 CONTEXT「标记类型」词表对齐：`YXmlFragment`）；
   P4 排版逐字行格；P5 truncations 类型名/导出（建议加法 `ProjectionTruncation`，
   非硬判据）。
3. **快照录制纪律**（SA3/SA7）：金标由实现实际输出录制，录制前人工核对契约
   §12.3 头部清单（别名块全覆盖、块序、有宿主 docs 键文本在场、`‡` 覆盖全部
   标记）；`EXPECTED_CELL_KEYS` 独立推导防空转。
4. **非阻塞观察**（建议设计门顺带处理）：渲染器对**畸形投影输入**的失败语义
   ADR 0027 未规定、契约未断言（D18）——建议钉 loud、可归因行为，与 vfsl 包
   trusted-domain 先例（ADR 0016 `InternalError`）同精神；不钉不构成冲突。
5. **跨票台账**：ADR 0027 决策 5 破坏性 minor bump 与缝 2（恒四键 + 头行拼接 +
   一致性锚 `schema ≡ renderProjectionText(resolveSchemaAtPath(…))`）、缝 3
   （文档负控：`wiki/raw` 外的作用域文档词汇重录）保持挂起，防跨票漂移。

## 8. Verdict

**clear** —— 全部对照项为 `no-conflict` 或 `implements-existing-decision`；
无 evolution-required、无 hard-conflict、无未兑现 override。SA6 验收契约与
ADR 0027 决策 2/3（缝 1）、ADR 0016 语义面（输入契约）、ADR 0024 #359
（可见性切片）、v1-spec 源文法、CONTEXT 词汇及 vfsl 包边界逐条一致；
其事实主张经独立复核无虚。门禁通过，实现可派发。

## 9. requiresConflictRecheck

**true** —— 理由：(a) 新公共 API（`renderProjectionText` 经 index 导出）与
规范文法快照尚待实现后核对（逐字节冻结、纯加法影响面、控制组恒绿）；
(b) P1–P5 设计钉死项在快照冻结前引入新的裁决面（尤其 P1 无宿主 docs 键呈现
方式与 P3 xml 拼写），设计定稿后应做设计面冲突复审；实现落地后按 frozen
surfaces 表逐项核对实际 diff。
