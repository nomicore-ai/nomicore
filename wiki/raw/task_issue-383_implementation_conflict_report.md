# 冲突门禁报告（implementation 复查）

- 被审对象：issue #383 缝 2 **实现 diff**（worktree `mabf/issue-383`，基线 HEAD `de2ff55` 之上的未提交改动：`packages/namespace-runtime/src/{window-read.ts,runtime.ts}` + 四文档 + 五个 `issue-383-*` 测试/fixture 新文件）
- 复查触发：设计 §13 与前置门禁 §10 均登记 `requiresConflictRecheck: true`（公共类型面 / 失败语义 / 生命周期 / F2–F11 冻结面实现后核对 + R16 中间态清账复核）；实际 diff 触碰 ADR 0029 决策面（窗口读组合层）。SA4/SA9 无产物在场（`wiki/raw/` 仅有 SA8/SA6/SA1/SA2/SA3 五件 + 简报/派发单），无其发现的新决策面需纳入。
- 冲突基准：`docs/adr/` 全集 28 份（0029 accepted 为本票规范权威；无本票相关 superseded）+ `CONTEXT.md`「窗口读」（L61–63）/「过滤窗口」（L65–67）词条 + 模块 AGENTS（namespace-runtime / namespace-registry / doc-runtime）+ `docs/AGENTS.md` 文档验证门（本 workspace 指令收录）。Owner Issue 评论：REST 快照 `[]`——无 Owner 评论，无任何 override 权威在场。
- 产出日期：2026-09-16（SA8，dispatch `sa-e6840eab-d924-480e-a45c-fff1d6290d7c`，iteration 1）
- 输入：`wiki/raw/task_issue-383.md`、`task_issue-383_conflict_report.md`（前置门禁 clear；R1–R16/F1–F11/A1–A6）、`task_issue-383_sa6_contract.md`（approve）、`task_issue-383_design.md`（iteration 1，SA2 approve）、`task_issue-383_sa2_review.md`、`task_issue-383_sa3_impl.md`、当前 `git diff`（逐文件全文核读）与 W1 权威源码逐行比对。

## 1. Reviewed subject

**implementation**：issue #383 缝 2 实现 diff vs ADR 全集 + CONTEXT.md。核对目标（dispatch 指令）：ADR 0029 冲突、规范冲突、架构冲突；冻结面逐项核对；实现是否仍在获批架构内。

## 2. Inputs and decision set

决策集：ADR 0029（accepted，规范权威）、ADR 0028（基契约）、ADR 0027（恒四键 + ✂ 载体）、ADR 0024（预算闭合形状 + registry 透传纪律）、ADR 0008（读边界与 `RUNTIME_READ_DISABLED`）、ADR 0009（lease 代理面）、ADR 0023（冻结服务面）、ADR 0002（authority 出范围）；CONTEXT.md 两词条；`docs/AGENTS.md` 文档验证门（「代码行为变化时更新每份陈述该契约的规范文档；纯措辞变化不得发明实现行为」）。源码（含 W1 `window.ts`）仅作当前事实确认。实现 diff 全集：6 个修改文件（`window-read.ts` 223 行级改写、`runtime.ts` 8 行注释、根 `AGENTS.md`、`.agents/skills/nomicore/typed-access.md`、`.agents/skills/nomicore/SKILL.md`、`docs/integration/cordis-plugin-hosting.md`）+ 5 个新增测试/fixture（与设计 §7 ALLOW LIST 路径逐一对应）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实现 diff 实测） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| I1 | ADR 0029 §1 + 验收缝 2 | 「options 增可选 `where`……不新增第四个读方法、不改 readData；恒四键结算与十四键 runtime 面不动」 | `where` 仅作 S3 五键白名单成员与 options 传递；无新读方法（`window-read.ts` 仍只服务 `composeArrayWindowRead`/`composeMapWindowRead`）；成功结算 `return { ok: true, value: entries, schema, truncated }` 原样；`runtime.ts` diff 仅注释（readArray doc 注释 8 行，行为零改动） | implements-existing-decision | `git diff window-read.ts`（S3 白名单五键 L260–268；结算 L204–210）；`git diff runtime.ts`（纯注释）；`NamespaceRuntimeWindowReadOk.truncated` 仅注释扩写 | 无 |
| I2 | ADR 0029 §5 | truncated 双语义：无 where 精确 `kept < total`、有 where 装满判定 `kept === n`；匹配总数恒不承诺；✂ 有 where 永不装配、无 where 逐字节不变 | S6：`truncated = total === undefined ? kept === canonical.n : kept < total`；在场判据**键于 W1 结算单源**（不重读 options、不重看 S3 视图是否有 where 键）；✂ 装配（`appendWindowFacts`）只在 `total !== undefined` 分支出现（结构性排除）；无 where 分支与旧代码逐表达式等价（`kept < total` + `truncated ∧ anchor ≠ null ∧ segments ≠ null` 才装配）；无 `total ?? 0`、无 `as number` 兜底、无 `kept < undefined` 路径（唯一 `as number` 是 `isScalarEquals` 的 `Number.isFinite` 收窄 L389） | implements-existing-decision | `window-read.ts` L195–210（S6 双语义 + 分支结构）；L521 `appendWindowFacts` 定义未动；grep `total ??\|kept < undefined` 零命中 | 无（SA4/SA7 承担行为级验证，T4/S1/S2 用例已在场） |
| I3 | ADR 0029 §6（+ §2） | 「doc-runtime W1 权威校验与 runtime S3 镜像**两层同步扩**」：键集白名单恰 `field`/`equals`、plain 原型链、零 `[[Get]]`、零 accessor、trap 收编 | `canonicalWhere`/`canonicalWhereTerm`/`isScalarEquals` 三函数与 W1 `validateWhere`/`validateWhereTerm`/`validateWhereEquals` **逐判据比对一致**（本次逐行核读两侧源码）：W-4 `Array.isArray`、W-5 `length` 经 own data descriptor 非负整数门、非空、≤16（`WHERE_TERM_LIMIT = 16` 具名模块私有常量，值与 doc-runtime L74 一致 + 出处注释）、W-6 逐下标 descriptor（空洞/accessor 拒）、W-7 元素非 undefined/null/非 object/数组拒、W-8 原型链恰 `Object.prototype`/null、W-9 键白名单恰两键、W-12 两键皆必填、W-10 field 恰 string（空串合法）、W-11 equals 标量闭集 + `Number.isFinite`（null 收、禁 truthiness）；顶层 options 白名单四→五键、定序（键循环 → n → orderBy → where）、present-undefined 顶层剥离均与 W1 `validateWindowOptions` 同款；S3 只返回稳定布尔、不产出归一化数组（非第三套权威）；两出口机制复用、零新出口零新码 | implements-existing-decision | `window-read.ts` L302–392（镜像三函数）；`packages/doc-runtime/src/window.ts` L290–355（OPT）、L362–474（W-4–W-13）、L74（哨兵 16） | 无 |
| I4 | ADR 0029 §2 + CONTEXT.md「过滤窗口」_Avoid | v1 词表封闭：in/范围/OR/NOT/多段 field/深相等一律词表外响亮拒绝；形状永不再变 | 镜像判据恰好收 v1 闭集，无任何扩词表通道（无新操作符键、无 `mode`、无段数组）；`where` 上限以常量 16 钉死（17 项拒绝） | implements-existing-decision（义务性保持） | `canonicalWhereTerm` W-9 白名单恰两键；CONTEXT.md L67 | 无 |
| I5 | ADR 0029 §4 + ADR 0028 §3/§4 | 管线 where → orderBy → n；排序/平局锚/组合式 depth/条目身份照搬 ADR 0028；过滤权威只在 W1 | 组合层零筛选、零排序、零重物化、零计数（`entries`/`total` 均为 W1 产物直通；`canonicalWhere` 无谓词求值）；`canonicalOrderBy`、锚链（S5）、`windowFactsBlock`、条目身份构造全部零改动 | implements-existing-decision（义务性保持） | `window-read.ts` diff 中 `canonicalOrderBy`/`anchorSchemaBody`/`windowFactsBlock` 不在改动区间；E-10 调用链封闭维持 | 无 |
| I6 | ADR 0029 §7 + ADR 0002 | 谓词比较实际数据值、schema 通道不受 where 影响；不得生长领域规则 | `schema` 两分支同源（`anchor`，元素口径锚链正文）；where 在场时 schema === anchor 原样；无任何规则语义进入 where | no-conflict | `window-read.ts` L206–210 | 无 |
| I7 | ADR 0028 §7/§9 + CONTEXT.md「窗口读」 | 恒四键 own 键集、三稳定码、W1 失败原样透传、registry 类型别名 | 结算四键构造不变；`WindowFailureCode` 恰四枚未动（doc-runtime `window.ts` L107–112 零 diff）；`seamWindowOptionsInvalid`/`windowFailure` 未动；W1 失败透传路径（runtime.ts）零行为改动 | no-conflict（义务性保持） | `git diff`（失败面构造区间无改动）；`doc-runtime/src/window.ts` 零 diff 实测 | 无 |
| I8 | ADR 0027 §1（经 ADR 0029 §5 条款级细化） | 恒四键；✂ 段为截断事实唯一载体 | 四键保持；where 在场 ✂ 永不装配 ⟹ 截断信号仅剩 `truncated` 布尔——该例外已由 ADR 0029 §5 明文决定（前置门禁 R9 裁定沿用） | no-conflict | ADR 0029 §5；`window-read.ts` L206–207 | 无 |
| I9 | ADR 0008 修订 L123/L178–179 | 停接纳 `RUNTIME_READ_DISABLED` 四键失败形、lifecycle gate 先于 options | `runtime.ts` S1 gate 区间零改动（diff 仅 readArray 注释）；零 options 读取纪律保持 | no-conflict | `git diff runtime.ts`（仅注释） | 无 |
| I10 | ADR 0009 §NamespaceLease + ADR 0024 决策 6 | lease 代理面：raw 引用直传、零解释零校验、released 短路先于透传 | `packages/namespace-registry/src/**` 零 diff（`git diff -- packages/namespace-registry/src/` 为空）；`where` 经既有通道到达 lease 面 | no-conflict | DENY 面 diff 空实测 | 无 |
| I11 | ADR 0024 + ADR 0027 §1 | readData options 闭合形状 `{depth?, maxChildrenPerNode?}` 零变化 | `packages/doc-runtime/src/**` 零 diff（`git diff -- packages/doc-runtime/src/ \| wc -l` = 0），readData 路径无任何触碰 | no-conflict | F9 实测 | 无 |
| I12 | ADR 0023 | 冻结服务对象构造纪律 | 本票不触碰任何服务对象构造（diff 文件集内无 ws-replication/clock/registry 服务面） | no-conflict（无关面） | `git status --porcelain` 全集 | 无 |
| I13 | CONTEXT.md「窗口读」/「过滤窗口」词条（缝 3 已闭合） | 词汇表为语义权威 | `CONTEXT.md` 零 diff；实现语义与词条逐点一致（装满判定、✂ 永不装配、安静不匹配、响亮拒绝、合取、管线序） | no-conflict | `git status`；词条 L61–67 实读 | 无 |
| I14 | 模块 AGENTS（namespace-runtime / namespace-registry / doc-runtime） | 读取留 sequencer 外；公共 API 只经 `src/index.ts`；runtime 契约变更跑根 typecheck + test | 组合层纯读（零 sequencer、零状态写）；三包 `src/index.ts` 全部零 diff（无新导出、`CanonicalWindowBudget.n` 为模块私有类型扩展不上公共面）；SA3 报告 `pnpm typecheck`/`pnpm test` exit 0（400 files / 4903 tests） | no-conflict | `git diff`（index.ts 均不在改动集）；SA3 §Verification | 无 |
| I15 | `docs/AGENTS.md` 文档验证门（workspace 收录指令） | 「代码行为变化时更新每份陈述该契约的规范文档；纯措辞不得发明实现行为；search for stale terminology」 | 四文档（根 `AGENTS.md` L31 签名 `where?` + ADR 0029 援引 + 双语义限定句；`typed-access.md` 词表段/✂ 段/失败码段/L170 完备性从句；`cordis-plugin-hosting.md` options 注释/双语义注释/样张「where 缺席形态」标注/失败码注释；`SKILL.md` L15 短语级 `optional where equality filter` 且不陈述截断语义）措辞逐点可溯源至 CONTEXT.md「过滤窗口」与 ADR 0029 §5，零行为发明；全仓 `kept < total` 文档面（排除 wiki//adr//CONTEXT）恰 4 处命中且全部带 where 限定；`docs/integration/app-data-access-skill.md` 零 diff（与设计 §5.6 显式登记一致） | implements-existing-decision（文档门义务兑现） | 四文档 `git diff` 全文核读；grep 门实测；`git status`（app-data-access-skill.md 不在改动集） | 无 |
| I16 | 前置门禁 R16 / 设计 §5.1（缝 1 中间态取代义务） | `seamWhereNotImplemented` 分支被「truncated 双语义 + ✂ 永不装配 + S3 镜像扩展」整体取代；#382 条件不变式耐久测试继续绿 | 函数与入口分支整体删除；全仓 `grep seamWhereNotImplemented`（packages/）零命中；`issue-382-lease-where-no-silent-pass.test.ts` 零改动且 SA6 §14 家族 6 文件 199 用例绿（SA3 实测） | implements-existing-decision（已闭合） | grep 零命中实测；SA3 §Verification | 无 |

裁决分布：**implements-existing-decision ×7（I1、I2、I3、I4、I5、I15、I16）、no-conflict ×9（I6、I7、I8、I9、I10、I11、I12、I13、I14）、evolution-required ×0、hard-conflict ×0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ——（无需任何 override） | ——（评论快照为空；无新 ADR/协议版本援引；实现完全落在已接受 ADR 0029 授权面内） | —— | —— |

## 5. Frozen surfaces（前置门禁 F1–F11 逐项对实际 diff 核对）

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| F1 readData options 闭合形状与 readData 行为 | 三层零变化 | ADR 0027 §1；ADR 0024 | **保持**：doc-runtime `src/**` 零 diff 实测 |
| F2 恒四键 own 键集 `{ok, value, schema, truncated}`（无第五键） | 成功成员构造与类型键集不动 | ADR 0028 §7；ADR 0029 备选 | **保持**：结算 return 原样；`CanonicalWindowBudget` ok 分支加 `n` 为**模块私有**类型（未导出，不上任何公共面） |
| F3 runtime 十四键 / lease 十五键公共面 | 无新方法/新键 | ADR 0029 §1 | **保持**：`runtime.ts` 仅注释 diff；registry `src` 零 diff |
| F4 失败码族四枚 + 收编关系 | 不新增码、语义不漂移 | ADR 0028 §7；ADR 0029 §6 | **保持**：`WindowFailureCode`（doc-runtime L107–112）零 diff；唯一删除的构造器 `seamWhereNotImplemented` 复用既有码 |
| F5 `where` v1 形状 | 恰 `{field, equals}` 标量闭集；≤16；形状不再变 | ADR 0029 §2 | **保持**：镜像判据与 W1 逐行一致；`WHERE_TERM_LIMIT = 16` 与 W1 同值 |
| F6 orderBy v1 词表 | where 不触碰排序词表 | ADR 0028 §2 | **保持**：`canonicalOrderBy` 不在 diff 区间 |
| F7 无 where 路径零回归 | total 计数、`kept < total`、✂ 逐字节 | ADR 0029 §5 | **保持（结构等价）**：`total !== undefined` 分支与旧表达式逐项等价；既有 #369/#382 家族零改动零改红（SA3：6 文件 199 用例绿） |
| F8 ✂ B-8 冻结文法 | 头行 + 恰一行事实行、四插值槽、注入防御 | ADR 0029 §5；`windowFactsBlock` | **保持**：`windowFactsBlock`/`appendWindowFacts` 未动；where 在场结构性不装配（调用点唯一，在 `total !== undefined` 分支内） |
| F9 doc-runtime W1 面零 diff | 缝 2 落点 = runtime + registry | ADR 0029 §6/§8 | **保持**：`git diff -- packages/doc-runtime/src` 为空（实测 0 行） |
| F10 lease released 短路 + raw 直传 + 单源别名链 | registry `src` 零改动 | ADR 0009；ADR 0024 决策 6 | **保持**：registry `src/**` 零 diff 实测 |
| F11 失败形 own 键集 | 窗口失败 `{code,ok,path,message}`；停接纳四键 | ADR 0008 L123 | **保持**：`windowFailure`/`readDisabled` 构造未动 |

补充冻结核对：三包 `src/index.ts` 值/类型导出键集零变化（不在改动集）；`CONTEXT.md`/`docs/adr/**` 零 diff；配置文件（`vitest.config.ts`/`tsconfig*`/`package.json`）零改动；既有测试/fixture/公共面守卫零改动（`git status` 全集核对，与 M1/M6/M7 一致）。

## 6. Evolution requirements

**无**（evolution-required ×0）。核对结论：

- 所需决策演进（ADR 0029 词表加法、ADR 0028 条款演进、ADR 0027 ✂ 例外、CONTEXT.md 词条）均在本任务之前正式完成（`8a4fa40` 及先前合入），本 diff 不要求任何新 ADR/CONTEXT/协议修订；
- 实现后复查清单（设计 §13 三项）逐项闭合：① 公共类型面与失败语义——`where` 经既有单源别名链（registry→runtime→doc-runtime）零新增类型面，S3 镜像判据与两出口、`WINDOW_OPTIONS_INVALID` 收编、truncated 双语义与 ✂ 永不装配均与 ADR 0029 §5/§6 一致（§3 I2/I3）；② R16 中间态清账——`seamWhereNotImplemented` 零残留（§3 I16）；③ F1/F2/F4 HEAD 颜色事项——SA3 已实测回填（HEAD 即绿，W1 失败透传先于组合层），与设计 §12 预测一致；
- 文档面四份补注属 `docs/AGENTS.md` 验证门义务兑现（措辞权威 = CONTEXT.md 词条 + ADR 0029 §5，零行为发明），非决策文本修订——决策文本（CONTEXT.md、docs/adr/**）零 diff。

## 7. Hard conflicts

无（hard-conflict ×0）。

## 8. Required actions

- **A-I1（后续门，非本门禁义务）**：行为级/活链路验证与测试充分性归 SA4/SA7（SA3 已给全仓 typecheck + 4903 tests 绿证据；SA8 不判断测试质量）。特别交接两项其报告已登记的事实，供 SA4/SA7 复核时不必重发现：① 装满判定消费 S3 canonical `n`（W1/S3 双合法视图值漂移时取 S3 视图值）——#369 已接受暴露类（`canonical.term`/`canonical.budget` 同族），Z 组头注已文档化，无新决策面；② SA3 对 SA6 契约 A3/A4 的两处 fixture 事实性偏差登记（`taskList` total 锚 3、`scalarList` 非空）——语义面与 ADR/CONTEXT 一致，属测试期望修正，非契约漂移。
- **A-I2（词表演进纪律，延续前置门禁 A1）**：后续任何 in/范围/OR/NOT/多段 field/深相等/count/keyset 需求一律走 ADR 备案位（ADR 0029 开放问题节），不得在本实现上就地扩词表。

## 9. Verdict

**`clear`**

实现 diff 与已接受决策集零冲突：16 项对照中 implements-existing-decision ×7（S6 双语义、S3 两层同步扩镜像、词表纪律、管线/单源纪律、文档门义务、中间态取代清账）、no-conflict ×9；F1–F11 冻结面对实际 diff 逐项核对全部保持；文件范围与设计 §7 ALLOW/DENY 完全一致（DENY 面——doc-runtime src、registry src、runtime index、CONTEXT.md、docs/adr、app-data-access-skill.md、既有测试/守卫/配置——全部零 diff）；无 override 在场亦无需 override；无 evolution-required、无 hard-conflict。实现仍在获批架构（SA1 设计 iteration 1 + SA2 approve）范围内，且把前置门禁与设计登记的实现后复查事由全部闭合。

## 10. requiresConflictRecheck

**false** —— 前置门禁/设计登记的 `requiresConflictRecheck: true` 所列核对项（公共类型面、失败语义、生命周期、F2–F11 冻结面、R16 清账、文档面 grep 门）已由本报告对实际 diff 逐项闭合；无待实现的正式 override、无未兑现的决策修订计划、无新决策面被本 diff 引入。后续验证（行为/活链路/测试充分性）属 SA4/SA7 职责，不构成冲突复查事由。
