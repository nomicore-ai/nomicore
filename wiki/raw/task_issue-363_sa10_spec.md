# SA10 Spec 审查报告 — issue #363（T1：投影文本渲染器——`@nomicore/vfsl` 公共导出）

- Dispatch：`sa-7018db42-248a-40ba-9b4f-627c6bcfc696`（mabf-sa10 / spec-review / iteration 0）
- 审查对象：**已提交 diff** `d956b42c39946386ad9377c45da3cd9d5ae67285`（`feat(vfsl): render schema
  projections as text`），分支 `mabf/issue-363`，工作树干净
- 基准核实：父 PR #362 head `12674544d2f24eb7d47c47ca4613b894043711d4`（adr0027-projection-text）
  经 `git merge-base --is-ancestor` 确认为 HEAD 祖先 ✓；HEAD 相对其父仅 +1 提交
- Issue REST comments snapshot：**空**——无 owner 补充要求、无 comment ID、无逐字判据需转写；
  判据全集 = issue 正文 What-to-build + AC 6 条 + ADR 0027 决策 2/3 + SA6 approved 契约 §12
- 审查方式：**静态**（不运行测试/不启动服务/不改代码）；运行期门禁证据采 SA3 §7 / SA7 §9
  对同一内容（提交前工作树 ≡ 提交内容，当前工作树干净）的实测记录

## 1. 输入清单

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-363.md`（Host brief）+ `gh issue view 363` | 在场，一致 | 票面 What-to-build + AC 6 条 |
| `docs/adr/0027-readdata-projection-text.md`（accepted） | 在场 | 决策 2（渲染器 API）/决策 3（规范文法）/验收缝 1 |
| `wiki/raw/task_issue-363_sa6_contract.md` | 在场（**approve**） | CT-1…CT-7、86 金标格、红因机制、§12.9 P1–P5、控制组规格 |
| `wiki/raw/task_issue-363_design.md`（iteration 2）+ `_sa2_review.md` | 在场（SA2 **approve**，Required revisions 无） | §7 文法钉死、§11 ALLOW/DENY、§12/§12.1 CT-8/CT-9、附录 A 样张 |
| `wiki/raw/task_issue-363_sa3_impl.md`（iteration 1 返工版） | 在场 | I7 修复、红先记录、门禁结果（381/4540） |
| `wiki/raw/task_issue-363_sa4_review.md` | 在场（**approve**，无 BLOCKER/MAJOR） | 静态审查基线 |
| `wiki/raw/task_issue-363_sa7_report.md` | 在场（**approve**） | 动态证据：聚焦 156 全绿、根 typecheck/test 双 exit 0、86 金标 drift=0 |
| `wiki/raw/task_issue-363_conflict_report.md` / `_relevant_decisions.md` | 在场（**clear**，D1–D18） | frozen surfaces、前置门禁 |
| `wiki/raw/task_issue-363_implementation_conflict_report.md`（iteration 2） | 在场（**clear**，I7 闭合，requiresConflictRecheck false） | 实现门基线 |
| 实读：`render-projection-text.ts` 全文 1002 行、`index.ts` diff、测试四件全文 | 本次 | 独立 spec 对照 |

## 2. 票面 Acceptance Criteria 逐条核对

| # | AC（issue 正文） | 实现与测试证据 | 判定 |
| --- | --- | --- | --- |
| 1 | `renderProjectionText(projection, truncations?)` 经 `@nomicore/vfsl` 公共入口导出，零选项签名（测试经 index 动态接缝取导出，不读实现源码） | `index.ts` 纯 +6 行（4 注释锚 + `export { renderProjectionText }` + `export type { ProjectionTruncation }`，置于 resolver 导出块后）；实现 L135–138 两参签名返回 `string`；红文件 L15 `import * as vfsl` + L66–72 `seamRenderer()` 动态属性读、非 function 时 loud 抛「能力缺口：…（ADR 0027 决策 2）」，**每个测试第一条语句**先取接缝（含 86/9/8 三处循环体——G2/G8/G9 循环内首句均为 `seamRenderer()`）；test-d G1.8 以 `@ts-expect-error` 锁死第三参与选项对象第二参 | ✓ met |
| 2 | 文法各形态快照冻结：预算夹具家族（evaluate 产物 × path × depth 矩阵）、m4 成员注释夹具、手造派生物（槽位/截断边界）、无预算整读 | fixture `RENDER_GOLDENS` 恰 **86 键**（本次 grep 计数），录制区隔离注释含录制 HEAD/日期/命令 + 5 条人工核对清单（L211–221/310）；`EXPECTED_CELL_KEYS`（L197–209）由 F1 12 路径 + `BUDGET_MARKER_MATRIX` 37 格 + `M4_CONTRACT_PATHS` 16 + F4 9 + F5 3 + F6 9 **独立推导**；G2.0 键集 ≡ 断言反空转 + 86 个逐字节金标 it；F6 覆盖 `Pattern<"…">`/裸 `Int`/`Int<1, 9999999999>`/`Range<0, 100>`/数字 enum `1 \| 2`/`YXmlFragment`/`T[]`/超 100 列折行（G2.F6 逐字断言） | ✓ met |
| 3 | 确定性：同输入重复调用、与无预算读交错调用，输出逐字节相同 | G6.1（无预算/预算/带 truncations 三态重复）、G6.2（render A → resolver 重读 → render A → render B → render A 三次逐字节同）、G5.6（乱序清单亦逐字节确定）、G8②③（环输入同口径）；实现零模块级可变状态、零 memo/时钟/随机（grep `Date.now`/`Math.random` 0 命中），字典序 tie-break 与 docs 表键序解耦（L946–948） | ✓ met |
| 4 | first-line 口径与 docs 文本防御（含换行、`//`、`}` 等敌意内容的注释不破坏结构） | `firstLineText`/`foldText` L976–986（首条目 → `\r\n\|\n\|\r` 折叠空格 → strip → ≥2 条追 `…`，后续条目文本不出现）；G4.1（多条目）、G4.2/G4.3（敌意 vs 良性孪生：行数相同 + 首个 ` // ` 前结构前缀逐行相同 + 注释段无裸换行）、G4.4–G4.6（删/增/清 docs 敏感性）、G4.8（有宿主键落行 + `ROOT.beta.leaf` 无宿主键不出现特判） | ✓ met |
| 5 | `‡` / `[...]‡` / ✂ 段呈现符合 ADR 0027；truncations 缺席或空时无 ✂ 段 | G3.1–G3.7d（ref 线索 `<名>‡`、container 线索字面 `[...]‡`、`countOccurrences('‡') === m+1` 86 格不变量、删标记敏感性、页脚恰 1 行居 ✂ 前、I7 optional 包装计数回归 + m=0 负控）；G5.1（缺席/`undefined`/`[]` 三态逐字节相同且无 `✂`）、G5.2–G5.5（条目 path/kind/omitted、数字段 `items.0`、空路径 `[]`、文末块、与 ‡ 共存序） | ✓ met |
| 6 | `@nomicore/vfsl` typecheck + 既有测试全绿（纯加法回归锚）；root `pnpm typecheck` / `pnpm test` 绿 | SA3 §7 与 SA7 §9 对**同一内容**双测记录：`tsc -p packages/vfsl/tsconfig.json` exit 0；根 `pnpm typecheck` exit 0；根 `pnpm test` exit 0 = **381 files / 4540 tests passed、0 failed、0 type errors**（较基线 378/4384 纯上浮 +3 files/+156 tests）；聚焦 156（144 契约 + 7 控制 + 5 类型）全绿；控制组 C1–C3 恒绿设计（不引用新名目） | ✓ met（运行证据采 SA3/SA7 记录；本角色不复跑） |

## 3. What-to-build / ADR 0027 决策 3 文法逐条核对

| 规范要点 | 实现位置与证据 | 判定 |
| --- | --- | --- |
| 字段行 `名?: 类型 // 口径首行…`；`?` 可选、`T[]`、ref 直写别名名 | `inlinePrefix` 字段位吸收 `?`（L381）；`inlineLeafText` ref 名逐字（L785）；金标 `notes?: string`、`config?: {`、`string[]`、`u: U` 在场 | ✓ |
| 标量域照源文法：`Int<1, 9999999999>` / `Range<0, 100>` / `Pattern<"…">` / enum `"a" \| "b"`（` \| ` 分隔，超 100 列折行缩进续行） | L772–791（`Pattern<JSON.stringify>`、`Int`/`Int<min, max>`、`Range<min, max>`）；`emitEnum` L690–708（`prefix.length + inline.length > 100` UTF-16 折行、首值留宿主行、续行 `<缩进+1>\| "值"`）；F6 金标逐字（含 `long` 5 值折行格） | ✓ |
| Record / union 照源文法（`Record<string, T>` + 行尾 keyPattern 注释；union `\| { … }` 不特判判别式） | `isRecordShape`（恰一 `<key>`）+ `emitRecord`（keyPattern 仅挂对象开行，L567/L588/L743，金标 `assets: Record<string, AssetEntity> // keyPattern: "…"`）；`emitUnion` 恒展开、全文 `discriminator` 0 命中（grep 证实） | ✓ |
| 别名块 = 闭包发现序（与 resolver aliases 键序同源） | L144–150 `Object.keys(aliases)` 键序直渲；未引用别名照样渲染（G4.7） | ✓ |
| 口径恒 first-line；docs 文本防御（换行折叠、文本永不破坏文法结构） | 同 AC4；注释只在完整结构前缀之后（§7.1.5 防御不变量由构造保证 + G4.2/G4.3 孪生断言） | ✓ |
| 被截位 `‡` 标记 + 页脚一行解释；容器线索无名时如实 `[...]‡`，不编造类型名 | `markerText` L799–801；页脚文案 L60 与设计 §7.4 逐字一致；计数点 3 处（L443/L506/L715）全量无旁路无双重计数（SA8 I7 逐一枚举闭合 + G3.7a–d 红先回归） | ✓ |
| 可见性切片延续 ADR 0024 #359 amendment——渲染不增删投影内容 | docs 归位四规则（§7.2：aliasDocs→别名头含裸宿主行、别名首段专属锚定不回流、正文尾缀匹配字典序最小胜出、无宿主键静默丢弃 P1）；标记替换类型不替换位置（G2.F2/F4/F5 槽位注释随宿主在场）；`?` 恰呈现一次（R2 不变量） | ✓ |
| ✂ 截断事实段：在场逐条 路径/裁因/省略计数；缺席或空清单时段整体不出现 | `renderTruncations` L994–1002（头行 `✂ 截断事实：`、`- <path> · <kind> · 省略 <omitted> 项`、空路径 `[]` N5、段内折叠、输入序）；G5.1 三态等价 | ✓ |
| 零选项纯函数、同步、逐字节确定；不产出头行（组合层职责） | 两参签名；全文 `# readData [` 0 命中 + G1.3 反断言；纯度见 AC3 | ✓ |
| 本票纯加法：不触碰 readData，零既有行为变化 | diff 文件全集 = ALLOW 六行（1 modified `index.ts` + 5 新包文件）+ Host/SA wiki 产物；DENY 面（resolver/`resolve.ts`/`derived.ts`/`evaluate.ts`/`validate*.ts`/既有测试/namespace-runtime/doc-runtime/docs/CONTEXT/v1-spec/tsconfig/vitest.config/版本链）**零触碰**；`InternalError` 唯一定义 `resolve.ts` L26（grep 复核），渲染器仅 import 只读消费（R5） | ✓ |

## 4. SA6 契约 CT-1…CT-7 + 设计 CT-8/CT-9 核对

| 契约组 | 要求 | 实现/测试 | 判定 |
| --- | --- | --- | --- |
| CT-1（G1.1–G1.9） | 接缝 loud 缺口文案、每测试首句取缝；string 返回；一参 ≡ 二参 `undefined`；无头行；类型面导出/双入参/零选项 2 反例/`TruncationEntryLike` 结构同构 + 封闭判别 3 反例 | 红文件 G1.1–G1.4 + test-d G1.5–G1.9（5 个 `@ts-expect-error`、双向 `toMatchTypeOf`）逐字在场 | ✓ |
| CT-2（86 金标） | F1 12 + F2 37 + F3 16 + F4 9 + F5 3 + F6 9；键集独立推导；录制纪律头注 | 全格在场（86 键 grep 计数）；G2.0 反空转；录制区注释含 HEAD/日期/命令/核对清单 | ✓ |
| CT-3（‡/页脚） | `‡` 计 = m+1；线索敏感性；页脚恰 1 行居 ✂ 前；m=0 负断言 | G3.1–G3.6 + I7 回归 G3.7a–d（红先证据 SA3 §7：修复前 expected 2 / received 1，红因即缺陷签名） | ✓ |
| CT-4（first-line/敌意防御/不增删） | 多条目 `…`、折叠、孪生行数+前缀逐行同、增删清敏感性、未引用别名照渲染 | G4.1–G4.8 全覆盖（含 `ROOT.beta.leaf` 无宿主键不出现特判） | ✓ |
| CT-5（✂ 段） | 三态等价、条目逐字段呈现、文末块、敏感性、共存序、确定性 | G5.1–G5.6 全覆盖（含空路径 `[]`、乱序确定） | ✓ |
| CT-6（确定性/纯函数） | 重复、交错、零变异（stringify 辖域 = 无环金标输入） | G6.1–G6.3 | ✓ |
| CT-7（控制组恒绿） | 20 导出超集、无预算摘要/失败码、预算抽格；不引用新名目 | 控制文件 C1–C3（FROZEN_EXPORTS 20 名逐一 + `toHaveLength(20)`、BUDGET_NO_BUDGET_DIGESTS 全路径、SCHEMA_OPTIONS_INVALID）；范围反断言（头行）按 §12.8 放红文件 G1.3 | ✓ |
| CT-8（环，设计新增强制） | 3 构造器 × 3 预算 9 格：终止、确定、`…` 在透传格、⑤零变异 = §12.1 环安全审计（禁 stringify） | G8 9 格；`auditProjection`（L137–160）与设计 §12.1 算法逐字一致（节点身份保全 + 环安全摘要、回引终止）；O4 半句（optionalRing d1 合法含 `…`）落实 | ✓ |
| CT-9（畸形，设计新增强制） | 抽样 loud `InternalError`、可归因消息、无部分输出、单一类身份 | G9 八抽样（缺四键/坏 kind/坏 truncations kind/坏 docs 值/int 半参/节点非对象/别名体坏 kind/truncations 非数组）`toBeInstanceOf(InternalError)` + `name` + G9.1 消息实值；守卫清单 L173–340 与 §7.5 逐项对应（含 int both-or-neither L272–283） | ✓ |

§12.9 契约边界 P1–P5：全部由 approved 设计钉死并落地——P1 静默丢弃（G4.5/G4.8）、P2 字典序
最小 tie-break（L919–921，歧义用例不进断言）、P3 `YXmlFragment`（L782–783 + 金标）、P4 排版
经 86 金标冻结、P5 `ProjectionTruncation` 加法类型导出 + 结构同构断言。SA6 红灯纪律（顶层不
静态 import 新名目、无 skip/only/todo/env override/fallback/吞错、不 grep 生产源码）经本次
grep 复核 0 违规。

## 5. 范围与 scope creep 审查

- diff 文件全集与设计 §11 ALLOW LIST 六行**逐一命中**，DENY LIST 零触碰；无计划外生产改动。
- `ProjectionTruncation` 类型导出系 SA6 §12.9 P5 建议、approved 设计 §7.0 采纳——授权内，非 creep。
- CT-8/CT-9 为 approved 设计在 SA6 floor 之上新增的强制验收（R3 裁定）——授权内。
- 未做且不应做：readData/组合层/头行（缝 2）、文档词汇重录（缝 3）、版本号 bump——均零触碰 ✓。
- index.ts 实际 +6 行 vs ALLOW 措辞「2 行」：注释锚系同一单元格明示要求，SA8 I1/SA4 O-E 已裁定接受。

## 6. 未达成项与 PR 披露义务

**本票范围内无未达成项、无 partial、无错误实现。** PR 必须披露（均非本票缺口，系跨票台账与
设计已登记的既定限制，wiki 产物已记录）：

1. **跨票台账（后续票生效点，本票按 ADR 0027 分期不实现）**：缝 2（readData 恒四键 + 头行前贴 +
   一致性锚 + 破坏性 minor bump）、缝 3（文档词汇重录）、敌意 getter 边界（设计 §13 F1）。
2. **设计已登记已知限制（产品性，非正确性）**：L1 P1 信息损失（根位/无宿主 docs 键不呈现）、
   L2 inline 枚举成员注释合并、L6/L7 罕见 optional/union/enum 组合读感代价；均为 approved
   设计 §13 明文登记项。
3. **金标录制口径**：86 金标为实现期录制（HEAD 无实现可预录），防漂移由「键集独立推导 +
   计数不变量 + 敏感性反例 + 附录 A 独立样张逐字节对照」三重锚定；SA7 独立重渲染 drift=0。

## 7. 非阻断观察（MINOR，不阻断 approve）

| # | 观察 | 说明 |
| --- | --- | --- |
| M1 | 手造「0 字段 + keyPattern」对象渲染为 `{}` inline 时 keyPattern 不呈现 | 求值器不可产出（Record 形恒恰一 `<key>` 字段，`evaluate.ts` 决策 F2）；契约矩阵无此格；行为确定；属 §7.1.5「开行承载」在 0 字段退化格的未钉死角，如需覆盖属后续文法粒度事项 |
| M2 | SA4 O-A–O-E 五项非阻塞观察维持登记（optional+union 首成员 inline enum 读感、enum 折行宽核算不含闭行定界符、尾缀匹配实现取规范文本侧、optional 链畸形消息 where 粒度、index +6 行措辞差） | 全部已经 SA4 §12 / SA8 iteration 2 §7 裁定登记，无契约影响 |
| M3 | 提交信息为单行 `feat(vfsl): render schema projections as text`，未含 SA3 §10 建议的详细体 | 披露内容在 wiki 产物齐全；PR 汇总时应携带 §6 台账（建议，非阻断） |

## 8. Verdict

**approve** —— 已提交 diff 忠实满足 issue #363 正文 What-to-build 与全部 6 条 AC、SA6 approved
契约 CT-1…CT-7（含 86 金标矩阵、红因机制、控制组）、ADR 0027 决策 2/3 规范文法逐字要点，
以及 approved 设计新增的 CT-8/CT-9 强制验收与 §12.1 观测口径；SA8 I7 缺陷已修复并有红先回归；
冻结面零触碰、纯加法成立、无 scope creep；上游门禁（SA6 approve / SA8 前置 clear / SA2
approve / SA4 approve / SA8 实现门 clear / SA7 approve）一致闭合。仅余 3 项非阻断观察（§7）
与 §6 的跨票披露义务。
