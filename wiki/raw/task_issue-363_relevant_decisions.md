# Relevant decisions — issue #363（T1：投影文本渲染器）

SA8 前置门禁摘录。基准 = ADR 全集 + `CONTEXT.md` + 模块 AGENTS 明确收录的决策 +
规范协议/语言规格文档。只摘录与被审对象（`wiki/raw/task_issue-363.md` 票面 +
`wiki/raw/task_issue-363_sa6_contract.md` SA6 验收契约）相关的条款与关联点；
不重写原义、不作业务设计。源码/类型仅用于确认当前事实（HEAD
`12674544d2f24eb7d47c47ca4613b894043711d4`，2026-09-13 16:58:14 +0800）。

## ADR 状态总览（全 27 篇均为 accepted，无 superseded）

与本票相关：0027（设计基线，HEAD 顶提交）、0016、0024（含 #359 amendment）、
0003、0019、0020、0021。其余 ADR（复制/传输/诊断日志/写路径/实例身份等）与
本票无决策面交集——本票红线不触碰 `packages/namespace-runtime`、
`packages/doc-runtime`、wire 与持久化面。

## 1. ADR 0027 `docs/adr/0027-readdata-projection-text.md`（已接受；本票直接依据）

- **决策 2（渲染器 API）**：`renderProjectionText(projection, truncations?)`——
  零选项纯函数、同步、逐字节确定；`truncations` 在场则渲染 ✂ 段。输入类型 =
  `ReadDataSchemaProjection` 系（保留为公共类型——resolver 输出契约与渲染器
  入参契约；vfsl 包面零破坏）。文本组装序：**readData 组合层前贴头行**（实参
  path + 预算）→ 渲染器正文 → ✂ 段；头行格式属规范文法。口径策略恒 first-line
  （无 `full` / `skip-members` 选项）。
- **决策 3（文法规格，规范性，快照锚定）**：字段行 `名?: 类型 // 口径首行…`
  （`?` 可选、`T[]` 数组、ref 直写别名名）；可见性切片延续 ADR 0024 #359
  amendment（已渲染宿主槽位 docs 全在场；被截位 `‡` 标记 + 页脚一行解释；容器
  线索无名时如实 `[...]‡`，不编造）；标量域照抄 VFSL 源文法（`Int<1, 9999999999>`、
  `Range<0, 100>`、`Pattern<"…">`、enum `"a" | "b"`，` | ` 分隔、超 100 列折行
  缩进续行）；Record/union 照源文法（`Record<string, T>` + 行尾 keyPattern 注释；
  union `| { … }` 不特判判别式）；别名块 = 闭包发现序（与 resolver aliases
  键序同源）；docs 文本防御（注释内换行折叠为空格、永不破坏文法结构）；头行与
  ✂ 段（路径 / 裁因 / omitted 计数）为规范文法。
- **决策 1/4（范围切割关联）**：恒四键、`truncations` 键删除、组合层 detach 深拷贝
  退役——均属 namespace-runtime 组合层（验收缝 2/缝 3，后续票），非本票范围。
- **决策 5（契约与发布）**：破坏性 minor bump 属投影通道交付换代整体（缝 2 落地
  时）；DSH 探针工具零代码改动。
- **验收缝 1（vfsl 公共入口，本票验收面）**：`renderProjectionText` 经 index 导出
  ——文法快照冻结（逐字节）、确定性、first-line 口径、`‡`/`✂` 呈现、敌意 docs
  文本防御、零选项签名；夹具沿用预算夹具家族（evaluate 产物 + 手造派生物）。
- **备选（已否决，构成负面边界）**：`RenderProjectionOptions` 选项对象被否决
  （first-line 升格唯一行为、头行改由组合层前贴）；渲染器住独立叶包 /
  namespace-runtime 被否决（文法权威单源在 vfsl）。
- **已知限制 3**：marker container 线索不带元素类型名（ADR 0024 决策 5 冻结面）
  ——紧凑文法如实呈现 `[...]‡`，不编造名字。

## 2. ADR 0016 `docs/adr/0016-readdata-semantic-schema-projection.md`（已接受；交付条款被 0027 修订，语义面延续）

- 状态行：交付条款（四件套经 readData 交付、每次读深拷贝）由 ADR-0027 修订退役；
  **语义面条款原文延续**——三元组动机、always-on、`schema:null` 单义、解析语义、
  docs 锚定文法、#359 可见性切片。它们描述的语义面 = 渲染器的**输入契约**。
- 「投影体」：`ReadDataSchemaProjection` 四件套（valueSchema / aliases / docs /
  aliasDocs）；docs/aliasDocs 键规约与派生 schema 文档表同构（§3 绝对语法路径 +
  `'<item>'/'<key>'/'member N'` 合成段文法，别名以别名名锚定）；ref 按名保留 +
  传递闭包别名表（递归安全、JSON 可序列化）。
- 「解析语义」：`resolveSchemaAtPath(derived, path, options?)`——optional 游走
  透明展开、返回子树中原样保留；纯函数、同步、零 memo。
- ADR 0019 修订节：投影体 docs = fieldDocs/markerDocs/**memberDocs** 三来源切片
  （member 末位合并）；文档「四表」。
- ADR 0024 修订节：三参化 `options?`（无 options 逐字节不变）；恒五键形（该形状
  又被 0027 再修订为恒四键——生效点在缝 2 票，非本票）。

## 3. ADR 0024 `docs/adr/0024-readdata-shape-budget.md`（已接受；#359 amendment；决策 3/4 通道被 0027 再修订）

- 决策 5（投影同 depth 裁剪）：截断节点选型 = **投影层包装联合**
  （`SchemaTruncationMarker`，`kind:'truncated'` + 成员级线索：ref 名优先、无
  ref 名时容器 kind），不扩展 ValueSchema 语义联合；别名闭包随展开层收缩；
  width 对投影无操作；两通道截断位置对齐（ref 为终态边界）。
- 决策 3（截断清单条目形状，被 0027 取代交付通道但**条目字段仍是 ✂ 段内容来源**）：
  `path`（与 readData 实参同基）/ `kind: 'depth' | 'width'` / `omitted`（depth =
  直接子项数、width = 超限子项数，非后代总数）。
- #359 amendment 第 3 条（切片可见性规则）：**docs 在场 ⟺ 语法位置在返回的预算
  类型树可见**（节点自身被渲染，或是已渲染宿主的槽位：字段 / `<item>` /
  `<member N>` / Record `<key>`）∪ 脊柱键；被截子树闭包内部省略。第 4 条：
  槽位 emit 随宿主渲染无条件进行。
- 开放问题（#359 登记）：截断标记 wire 形态冗余——「未来若需紧凑表示属决策 5
  冻结面修订，须单独评估」（本票不动 marker 形态，只在文本面呈现）。

## 4. ADR 0003 `docs/adr/0003-evaluator-derived-schema.md`（已接受）

- ValueSchema 冻结形状（渲染器只读消费，本票不改）：`object`（含 `keyPattern?`）、
  `array`、`xml`、`union`、`enum`（`Array<string | number>`）、`pattern`、`int`
  （`min?/max?`）、`range`、`scalar`、`optional`（仅对象字段 `?:` 包装）、`ref`。
- 当前事实（`packages/vfsl/src/derived.ts` L44–58）：上列 kind 全部在场——
  `Int<min,max>` / 裸 `Int`（min/max 缺席）/ `Range` / `Pattern` / 数字 enum /
  Record keyPattern / optional 包装均可从派生物忠实再呈现，无表示性缺口。

## 5. ADR 0019 `docs/adr/0019-vfsl-union-member-docs.md`（已接受）

- 决策 4/5：`union.memberDocs` 条件稀疏表进 IR/derived——渲染器输入侧的
  `<member N>` docs 来源（经 ADR 0016 投影切片三来源合并进 `docs`）。
- 决策 6（codegen 四发射位）与决策 8（纯文档性质）不约束文本渲染器；`YPlainArray`
  纯值子树与 `YXmlFragment` 不透明实参内**无发射位**（CONTEXT「挂载锚位」同款
  ——渲染器不应为这些位置期待 docs）。

## 6. ADR 0020 / 0021（已接受）

- 0020：数值约束文法（`number & Int` / `Int<min, max>` / `Range<min, max>` 交集
  形）为 v1-spec §2 白名单——渲染拼写 `Int<1, 9999999999>` 的源文法依据。
- 0021 决策 6：收窄为纯运行时判定——**IR 形状、derived 两树、codegen 生成物、
  语义指纹零影响**。对渲染器无约束。

## 7. CONTEXT.md 词汇（根权威，已含 ADR-0027 词汇）

- 「语义 schema 投影」（L41–43）：投影文本渲染器的**输入契约**；投影层截断标记、
  可见性切片（#359 amendment）；_Avoid_ 含「把 JSON 四件套当 readData 交付物」。
- 「投影文本」（L45–47）：确定性文本渲染——VFSL 风格文法、别名块闭包发现序、
  口径恒首行制、`‡` 标记、容器线索如实、**头行标注读路径与预算**（头行由组合层
  前贴——交付形态描述）、✂ 段唯一截断事实载体、`truncated` 布尔机器信号、
  渲染器零选项纯函数逐字节确定（快照锚定）。_Avoid_：把投影文本当可解析结构化
  契约、期望全文注释、在 ✂ 段之外找截断事实。
- 「截断事实段 ✂」（L57–59）：文末规范性段落；逐条 path（与 readData 实参同基）/
  裁因 / 省略计数；无截断时段整体不出现。
- 「标记类型」（L65–67）：`YMap` / `YArray` / `YPlainArray` / `YLeaf` /
  `YXmlFragment` / `Pattern`（大小写是契约）——xml 形态渲染拼写的词表对齐基点。
- 「挂载锚位」（L69–71）：四类锚位；`YPlainArray` 纯值子树与 `YXmlFragment`
  实参内无发射位。

## 8. 规范语言规格 `docs/vfsl/v1-spec.md`（normative）

- §2 文法：`string & Pattern<"正则">`、`number & Int`、`number & Int<min, max>`、
  `number & Range<min, max>` 交集白名单；enum 字面量联合；`Record<K, V>`；`T[]`。
- 数值约束 arity 严格（`Int` 恰零实参；`Int<min, max>` / `Range<min, max>` 恰两
  实参）。注意：源文法写 `number & Int<…>`（含基类型交集）；ADR 0027 决策 3 的
  **渲染**拼写只保留约束侧（`Int<1, 9999999999>`）——渲染文法权威 = ADR 0027，
  v1-spec 权威 = schema 源文本；两者辖域不同，不冲突。

## 9. 模块 AGENTS（明确收录的边界决策）

- `packages/vfsl/AGENTS.md`：parser/evaluator/validators 同步、确定；公共
  malformed-input 路径走判别联合（`resolveSchemaAtPath` 对 trusted-domain
  畸形 throw `InternalError` 是 ADR 0016 显式例外）；IR/派生物环境中立、JSON
  可序列化；不引入 Yjs 运行时关注；**公共 API 只经 `src/index.ts`**；错误码、
  issue 排序、路径报告、信封严格性、指纹输入 = 兼容行为。
- 根 `AGENTS.md`：typed Namespace 写纪律与本票无关（不碰写路径/生成物）；模块
  指引（改 `packages/` 前读最近 AGENTS）。
- 当前事实：`packages/vfsl` 零运行时依赖（真叶包）——`packages/vfsl/src/` 无
  `@nomicore/doc-runtime` 引用；`packages/doc-runtime/src/read.ts` L88–92 定义
  `ReadLogicalValueTruncationEntry = { path: readonly (string|number)[];
  kind: 'depth'|'width'; omitted: number }`。

## 10. 与本票无关的冻结面（红线对照用）

- `packages/vfsl/src/resolve-schema-at-path.ts`（resolver 语义 + 投影包装联合）；
- `packages/namespace-runtime/*`（readData 形状、detach——缝 2/3 票）；
- `packages/doc-runtime/*`（值通道 truncations 条目形状）；
- 20 个既有 vfsl 值导出（`packages/vfsl/src/index.ts`，HEAD 实测在场）；
- wire / 持久化 / 诊断日志 / 复制面全部不变。
