# SA10 Spec 审查 — issue #369 W2：lease 公共面 `readArray` / `readMap`（ADR 0028）

- 被审对象：issue #369 最终交付 W2 diff——worktree `/home/wangjian/nomicore-fix-issue-369`，
  branch `mabf/issue-369`，对 HEAD `ab6e3908b022292d5af7e800a6452bc392023a9e` 的**未提交工作区
  全量**（22 个 tracked 修改 + 5 个新代码/测试文件 + 证据日志与 wiki 产物）。dispatch 确认
  Parent PR #367 authoritative head = `ab6e390`，无需 base rebase。
- 审查方式：只读对照——Issue 正文（What-to-build + AC1–AC6）× SA6 验收契约（§12 冻结规格）
  × SA1 设计（B-1–B-11 冻结绑定 + §7.2 B-6 裁决 + §7.3 S1–S6）× 规范（ADR 0028/0027/0024/0016、
  CONTEXT 词条）× 交付实现与测试全文 × SA2/SA4/SA7/SA8 结论与证据日志。SA10 纪律：零代码/测试
  改动、零测试运行、零服务；动态证据采信 SA7/SA3 留档日志并实读核对。
- Owner 评论：0 条（dispatch 复述 REST 实读为空）——无 owner 条款需映射。

## 1. 结论

**approve** —— 交付 diff 忠实满足 Issue 正文全部行为要点与 AC1–AC6、SA6 验收契约 §12 全量
用例组（W2-A/S/T/E/F/Y1/NC）、SA1 设计全部冻结绑定（B-1–B-11 含 B-6 锚链裁决、B-8 ✂ 文法、
§7.3 编排、§7.4 计数路径）与 ADR 0028 决策 1/3/4/6/7/8/9；无遗漏、无部分实现、无错误实现、
无 scope creep；冻结面（doc-runtime / vfsl / readData / CONTEXT / ADR / vitest.config）零 diff。
仅 2 项 MINOR 观察（不阻断）。无 PR 必须披露的未达成项（设计登记的已知限制 R1/R4/R5 均已在
作用域文档与测试 oracle 中如实披露，属已批准的冻结解释而非未达成项）。

## 2. Issue 正文行为要点逐项对账

| 行为要点（Issue body） | 交付落点 | 判定 |
|---|---|---|
| 恒四键 `{ok,value,schema,truncated}`；value = 条目列表（身份随行）；`truncated === kept < total` | `window-read.ts` L177–183 S6 恰四键字面量结算；条目 = W1 直通（`{index\|key, value}` own 两键）；契约 A1/A2/A4 + 类型锁 Y1（keyof 恰四键） | ✅ 全达成 |
| schema = 元素口径投影文本（类型块 + docs；depth 截断标记落元素子树内） | `anchorSchemaBody` + `projectSchemaTextBody` = `renderProjectionText(resolved)` 正文（无头行）；S1 断言 `Task‡`（depth:0 标记在元素子树内）、S2 断言字段 docs 在场 | ✅ 全达成 |
| `{index\|key,value}` 包装是传输形态不进口径 | 锚为元素位（`[...path,0]` / `'...<key>'`），schema 无包装键；契约 A6 断言不含 `index:`/`key:` | ✅ 全达成 |
| schema 路径键控与数据无关（空容器照常返回元素口径） | 锚链只消费 schema（resolver）；契约 A3（四类空容器元素口径 + 无 ✂ + truncated:false）、S3（空 vs 满逐字节相等、n 不改变正文） | ✅ 全达成 |
| 组装沿用投影文本渲染器（ADR 0027 T1） | `projectSchemaTextBody` 调公共 `renderProjectionText`（vfsl 零 diff）；AC2 oracle = 同次运行 `readData(锚,同预算)` 双侧剥离逐字节对账（渲染器与组合层任一侧漂移即红） | ✅ 全达成 |
| ✂ 窗口事实段：kept n/total N + 基与方向；total=0 无 ✂、truncated:false | `windowFactsBlock`（B-8：`- <path> · 窗口 · 基 <basis> <dir> · kept <n>/total <N>`）；契约 T1–T7（含 kept===total / total=0 / n=1 / 边界矩阵 / ROOT 面 `[]` 字面） | ✅ 全达成 |
| 组合式 depth 等价锚（实现与测试共用） | S2 预算原样贯通 W1 物化；契约 E1（depth 0/1/2 两面逐项 `toStrictEqual` 同预算 readData）/E2（maxChildrenPerNode 只治项内） | ✅ 全达成 |
| 失败面直通 W1 三码（经 lease 透传形状语义不变） | runtime S2 原样返回 W1 失败成员；契约 F1（三码与直调 W1 `toStrictEqual`）/F2+E4（`PATH_NOT_ALLOWED` fail-fast 无半窗） | ✅ 全达成 |
| 作用域文档同步（typed-access / cordis-plugin-hosting 补窗口读消费段 + 分工句） | `typed-access.md`「Window reads」节 + `cordis-plugin-hosting.md`「窗口读（readArray/readMap，ADR 0028）」节——均含四键面、条目身份回溯、元素口径（含封闭对象容器口径与 depth 计量披露）、✂ 样张、三失败码、护栏 vs 选择器分工句 | ✅ 全达成 |

## 3. Issue AC ↔ 交付证据映射

| AC | 交付证据 | 判定 |
|---|---|---|
| AC1 恒四键 own 键集；条目列表；空容器 `value:[]`+元素口径+无 ✂ | 契约 A1–A6（`expectReadDataOkKeys`/`expectReadDataOk` 集中化形状面）；类型锁 Y1 恰四键 | ✅ FULL |
| AC2 schema ≡ 渲染器对元素口径的输出（oracle 一致性锚） | 契约 S1–S4 + 组合层 S5 五用例：oracle 由同次运行公共 `readData(锚,同预算)` 产出，双侧剥离（去头行/去 ✂ 块）后正文 + `‡` 页脚逐字节相等；封闭对象 B-6 回退容器口径亦按 oracle 对账 | ✅ FULL |
| AC3 ✂ 段 kept/total + 基与方向；`truncated` 一致 | 契约 T1–T9：独立预言机计数对账（Yjs/native 直数）、Byte 级单点常量、单行不变式、敌意 field（T5/T6）与敌意 path（T8/T9）收编 | ✅ FULL |
| AC4 组合式 depth 等价逐字节 | 契约 E1/E2 逐项 `toStrictEqual`；E3 N=2000 毒值零物化哨兵（`ok:true` kept 2/total 2000——全量物化实现必红）；E4 入选毒项 fail-fast | ✅ FULL |
| AC5 三失败码 lease 透传；registry 别名与透传断言 | 契约 F1–F6（含 spy 引用同一性 `path/options` 原样直传、argc===2、lease≡runtime 逐字段、released/lifecycle 先行）+ `.test-d.ts` Y1（签名第二参必填、options 单源 Equal ×4、结果别名 Equal ×2、负例 ×5）+ lease.ts 两对 Equal 锁 | ✅ FULL |
| AC6 文档段 + 负控绿 + root typecheck/test 全绿 | 两文档段在场含分工句；NC1/NC3/NC4 契约用例；收敛门 + docs 门 59 绿（`sa3-issue369-f369-1-docs-shape-gates.log`）；SA7 全量：**391 文件 / 4722 用例全绿、Type Errors: no errors、`pnpm typecheck` exit 0**（`sa7-issue369-full-suite.log`，PIPELINE_EXIT=0） | ✅ FULL |

## 4. SA6 契约 §12 规格符合性

- **绑定表 B-1–B-11 全量兑现**：方法名/参数形（B-1/B-2）、options doc-runtime 单源别名 +
  第二参必填（B-3）、结果联合四段（成功四键 \| W1 失败原样 \| `RuntimeReadDisabledResult` \|
  released issue，B-4）、公共别名名 + Equal 锁（B-5）、锚链 B-6（数组单锚 `[...path,0]`；
  键面 `'<key>'` → 容器口径回退；皆败 null——含敌意 path 经 `normalizeReadPath` 快照缺席收敛）、
  D1 无头行正文（B-7）、✂ 四插值槽确定性渲染 + 单行不变式（B-8，含 SA2 F-1 field 折叠与
  O-1 空路径 `[]` 字面）、`truncated === kept < total` + 组合层 O(N) 标识枚举计数（B-9，
  数组 length / Y.Map `get(k)!==undefined` / plain object descriptor 纪律，稀疏空洞计入、
  显式 undefined 值键出空间）、released/lifecycle/raw 透传通道（B-10）、键集 12→14 / 13→15
  纯加法 + 值导出面不变（B-11）。
- **§12.6 伪绿防线**：精确等值（`toStrictEqual`、Byte 常量）、形状集中化 helper（收敛门
  family A/B 59 绿）、独立预言机计数矩阵（组合层 S4 九例 + T7 边界）、E3 零物化哨兵、
  AC2 运行期 oracle（非硬编码）。零 skip/only/todo（本审 grep 实查）。
- **§12.7 红线**：`packages/doc-runtime/**`、`packages/vfsl/**`、`CONTEXT.md`、`docs/adr/**`、
  `vitest.config.ts` 零 diff（git status 实查）；readData 行为与字节不变（共享前奏
  `resolveSchemaBody` 抽取经本审逐行核对为等价重构：无预算 → 两参渲染、预算 → 三参渲染 +
  头行，与 HEAD 逐分支对应；`normalizeReadPath` 仅加 `export` + JSDoc、函数体零改动——
  SA4 git diff 实读复核 + 全量字节锚绿）。
- **测试路径 §12.8**：三个新契约文件逐字落于规格路径（lease-contract-red、composition-red、
  lease-surface.test-d）+ 同目录 fixture（设计 §11 允许项）；runner 采集 = 既有 include glob。

## 5. SA1 设计符合性与规范符合性

- **§7.3 编排 S1–S6 顺序不可换**：runtime 闭包 S1 lifecycle gate（零 options 读取——组合层
  契约以 trap 计数 options 断言 0 触达）→ S2 W1 直通（raw 引用、失败原样）→ S3 canonical
  接缝（descriptor 纪律零 `[[Get]]`、双出口：重派发失败透传 / 接缝终态 `WINDOW_OPTIONS_INVALID`
  视图不稳定）→ S4 O(N) 计数（防御位坍缩 `PATH_NOT_ALLOWED`）→ S5 锚链 → S6 四键结算 +
  ✂ 装配。全同步、零 sequencer、零状态写入（包 AGENTS「读不进 sequencer」）。
- **SA4 F-369-1 修复在位**：S5/S6 共用单次 `normalizeReadPath` 已验证快照（锚链与 pathText
  同源、绝不二次 spread raw path）；快照缺席 → 诚实 `schema:null`（ADR-0027 null 单义），
  绝不以不可验证 path 造事实行。T8 修复前红（裸抛逃逸逐字复现于
  `sa3-issue369-f369-1-red.log`）→ 修复后绿（50/50 契约），红绿对证明判别力真实。
- **ADR 0028 决策逐项**：1（lease 两方法、`n` 必填 ≥1——W1 单权威校验 + 类型必填）✓；
  3（条目列表、身份随行、包装不进口径、空容器 `[]`）✓；4（组合式 depth、终点宽度 n 治理、
  width 只治项内）✓；6（元素口径、路径键控、空容器照常——封闭对象容器口径为开放问题 5
  预留的实现票裁决，SA8 裁 no-conflict、文档披露、R1 登记）✓；7（恒四键、✂ 窗口事实、
  total=0 无 ✂、三码响亮不抛）✓；8（O(N) 枚举 + 只物化入选项 + 未入选零物化——E3 哨兵）✓；
  9（分层：doc-runtime 零 diff / namespace-runtime 组合 / registry 面与别名 / readData 与
  ADR-0024 options 零改动）✓。
- **ADR 0027**：✂ 段为截断事实唯一载体（窗口事实仅经 schema 文本承载；`schema:null` ×
  `truncated:true` 只剩布尔 = 已知限制 2 的窗口对偶 R4，如实登记于契约 T7/T9 与设计 §13）；
  渲染器零选项消费、头行文法不被窗口面伪称（D1）；kind 词表不经渲染器第二参扩张（组合层
  追加块，SA8 裁为唯一合规路径）。
- **键集/导出守卫**：四处键集守卫 + 两个接口 test-d 纯加法同步（diff 实读：每文件恰 +2 行 /
  +2 成员）；runtime 值导出仍恰 `RuntimeWriteFatalError`（exports-audit 在全量套件内绿）。

## 6. Scope 审查

- ALLOW 内改动 = 设计 §11 全部 19 项逐字落地；ALLOW 外 9 个文件（`ws-replication/src/testing.ts`
  的 `decorateLease` +2 bind、7 个 registry 测试替身 +2 成员、1 个 runtime 替身字面量）均为
  接口 12→14 / 13→15 扩张的**编译强迫机械同步**（零断言语义变化、恒 `PATH_NOT_ALLOWED` 替身
  失败）——SA3 如实申报、SA4 §6 复核必要/最小/语义惰性，本审 diff 逐块复核确认无藏匿行为。
- 无 scope creep：未引入 ADR 0028 开放问题项（多字段/嵌套 field/readArray 属性排序/n=0 探针）；
  未触碰 wire/持久化/诊断日志/schema 生命周期面；新增失败构造（接缝终态、计数防御位）复用
  W1 码词表与 `WindowReadFailure` 单源类型，属设计既定组合层义务而非词表扩张。

## 7. PR 必须披露的未达成项

**无。** 全部 AC FULL 达成。以下为已批准的冻结解释/已知限制（非未达成项，且已在交付物内
如实披露，PR 描述可援引）：① R1 封闭对象容器口径下 depth 自容器起算（ADR 0028 开放问题 5
的实现票裁决；两文档消费段明示「`depth ≥ 1` 得完整字段口径」；S4 oracle 锚定）；② R4
`schema:null × truncated:true` 只剩布尔（ADR-0027 已知限制 2 对偶）；③ R5 项级 width 截断
在窗口 schema 文本不可观察（W1 两键面冻结的结构性结果）；④ R2 计数镜像层间张力（出处标记
+ 独立预言机矩阵防线，W1 冻结解除时的下沉合并登记为 follow-up）。

## 8. Non-blocking observations（MINOR，不阻断 approve）

| ID | 观察 | 性质 |
|---|---|---|
| M-1 | `runtime.ts` JSDoc 两处「键面容窗口读」为「键面窗口读」笔误（接口 readMap 注释与闭包注释）；无语义影响 | 文档措辞 |
| M-2 | SA4 O-1 沿存：键面容器回退锚未按 schema 形状收窄（off-schema 异形数据下容器锚可解析 → 呈现口径失真；值通道正确、零崩溃——SA7 §10-2 动态复核）。已登记为 SA1 follow-up 澄清项 | 既定开放观察 |
| M-3 | SA4 O-3 沿存：契约 fixture 的跨包测试树依赖（runtime 契约测试 import registry 测试树 fixture；fixture 相对路径 import runtime src）——卫生项，建议后续经 testing 面暴露 | 测试卫生 |

## 9. 证据清单（实读核对）

- 实现全文：`packages/namespace-runtime/src/window-read.ts`（742 行）、`runtime.ts` /
  `read-schema-projection.ts` / 两包 `index.ts` / `types.ts` / `lease.ts` diff（本审逐块读取）。
- 测试全文：lease-contract-red（890 行，33 用例：A1–A6/S1–S4/T1–T9/E1–E4/F1–F6/NC）、
  composition-red（452 行，17 用例：能力/S1/S3/S4 矩阵/S5 oracle/E3/E4/负控）、
  lease-surface.test-d.ts（150 行，类型锁 + 负例）、fixture（308 行）。
- 动态证据（SA7/SA3 留档，本审实读尾部与关键行）：`sa7-issue369-full-suite.log`
  （391 文件 / 4722 用例 / Type Errors: no errors / PIPELINE_EXIT=0）、
  `sa7-issue369-contract-focused.log`（2 文件 / 50 用例绿）、`sa7-issue369-typecheck-only.log`
  （38 文件 / 231 用例无类型错误）、`sa3-issue369-f369-1-red.log`（T8 修复前裸抛逐字复现）、
  `sa3-issue369-f369-1-contract-green.log`（50/50）、`sa3-issue369-f369-1-docs-shape-gates.log`
  （收敛门 + docs 门 59 绿）。`git diff --check` clean（本审实跑）。

## 10. Verdict

**approve** —— 实现忠实满足 Issue 正文、SA6 验收契约与 SA1 冻结设计；规范面无矛盾（SA8 clear
沿用，`requiresConflictRecheck: false`）；无未达成项需 PR 披露；MINOR 观察 3 项不阻断。
