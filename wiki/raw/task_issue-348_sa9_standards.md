# task_issue-348 SA9 Standards 审查（guard II 语义矩阵落地）

- 被审对象：最终提交 diff `1bb6f3258da9fb56bc4fdd155caea242e3d2216f`（branch `mabf/issue-348`，基于权威父 PR #346 head `61e2daa37e21b467e7ce130d5c4db7be38bde982` = adr0025-guarded-mutation）
- 审查角色：SA9（独立 Standards 审查；不修改代码/设计/测试，不运行测试，不启动服务，不调度其他 SA）
- 上游产物（均已读）：`task_issue-348.md`（issue 简报，评论 REST 读取为空、无 Owner 要求）、`_sa6_contract.md`、`_conflict_report.md`（SA8 clear）、`_relevant_decisions.md`、`_design.md`、`_sa2_review.md`（approve + R1/R2 MINOR）、`_sa3_impl.md`、`_sa4_review.md`（approve、零修订）
- 审查方法：对 diff 全量与仓库规范逐维独立重核（ADR 行号逐行 sed 验证、助手调用点计数复核、禁用模式 grep、生产面 sha1 比对、惯例先例比对），不转述上游结论代替核对

## 1. Verdict

**approve** —— 无 BLOCKER、无 MAJOR、无 MINOR 违规。交付 diff 是单文件纯测试锚定（1086 行新测试 + 7 个 SA 流程 wiki 产物），生产面与父提交逐字节一致，全部适用标准逐维通过。两条非阻断观察见 §10。

## 2. Diff 范围核对（文件范围标准）

`git diff 61e2daa..HEAD --stat`（tracked，生产/配置面）= 仅 `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts`（+1086）。提交另含 7 个 `wiki/raw/task_issue-348_*.md`（conflict_report/design/relevant_decisions/sa2/sa3/sa4/sa6），均为各 SA 角色固定产物位；仓内先例 `task_191_*`、`task_228_*` 同样入库，一致。

| 核对项 | 结果 |
|---|---|
| 设计 §11 ALLOW 第 1 行（SA6 §12.1 冻结落点） | 落点逐字一致，唯一源码交付物 |
| DENY 面：`mutation.ts`/`read.ts`/`index.ts` | 三文件 sha1 与 `61e2daa` 逐字节一致（实测 `git show <sha>:… \| sha1sum` 双向比对） |
| DENY 面：既有测试（issue-347/350、public-surface、read 系列） | tracked 全干净；N-A/N-E 负控基线原样保持 |
| DENY 面：namespace-runtime/vfsl/persistence/apps/domains、docs/adr、CONTEXT.md、vitest.config、package.json、tsconfig | 零改动（diff stat 为空） |
| 临时产物残留（.sa3-probe/.sa6-probe） | 无（`git status` 仅 Host 输入简报 `task_issue-348.md` 未跟踪） |

## 3. AGENTS 与模块责任

| 标准（`packages/doc-runtime/AGENTS.md`） | 核对结果 |
|---|---|
| 公共 API 只经 `src/index.ts` | 测试导入 `../src/index.js`（L53–55），无内部路径深导入；`.js` 后缀与 `@nomicore/vfsl` 别名用法与 #347 逐字同款 |
| public-surface guard 测试覆盖每一导出 | 导出集零变化（index.ts sha1 一致），`public-surface-guard.test.ts` 无需同步；本文件仅保留一行同源断言（L58–59/L208，#347 P2 同款），职责归属正确 |
| 验证失败零写入 / 读保持 schema-independent | 矩阵全部经 `applyValidatedMutation` 公共入口（`run` 助手 L114–116），不直调内部 `evaluateGuard`；直造载体 fixture（B22–B30）有 read 测试同款先例（`read-logical-value-at-path-schema-independent.test.ts` L178+），锚定的是 read.ts 显式契约分支 |
| Verification：契约变化时跑根 typecheck+test | 生产契约零变化 → AC8 门（doc-runtime 套件 + 根 typecheck）范围正确；SA8 §8#3 条件门（根 `pnpm test`）按规则未触发，非逃逸 |
| 根 AGENTS「先读最近嵌套 AGENTS」、carrier 归 doc-runtime | 落实；不触碰 namespace-runtime 写槽/诊断透传面（ADR 0025 L60） |

## 4. ADR 引用准确性（逐行重核）

测试文件头 L12–26 引注与 ADR 原文逐行 sed 验证全部命中：

| 引注 | 原文核对 |
|---|---|
| ADR 0025 L42–44（equals 结构深相等 / absent 两态满足 / 段纪律 + XML 两形态 + 禁 `[]`） | 命中（L42 `结构深相等（undefined 键过滤…）`、L43 `读失败…均满足`、L44 段纪律与 XML 条款） |
| ADR 0025 L48–51（prepare 阶段、分叉前、先于 schema、纯读不进事务、原子性归序列器） | 命中 |
| ADR 0025 L53–58（错误域两态表 + 稳定码 + issue.path + 截断摘要） | 命中 |
| ADR 0025 L72–74 / ADR 0026 L29、L53–55（双形态顶层、批内禁 guard、先于逐操作 prepare） | 命中（0026 L29 全文含 `元素不得携带 guard 键`） |
| ADR 0008 L23（缺键/越界吸收、中间缺失立即结束）、L26（XmlFragment 不可下钻终态） | 命中 |
| ADR 0007 L29（路径段纪律）、L93–96（`set([])` 唯一全量形态走完整清空重装） | 命中 |

反伪造纪律（设计 D8）：#347 文件头含「红灯现状」段，本文件正确地**未照抄**（HEAD 无红灯；目标绿回归矩阵定位声明于 L2–7），并引 SA6 §9.2 变异敏感度（M1 13 / M2 5 / M3 3 / M4 3 与契约逐字一致）作为非重言式证据。

## 5. 单一事实源

| Fact | Authoritative source | 实现核对 |
|---|---|---|
| 用例 ID / 输入 / 极性 | SA6 §12.2–§12.8 表 | 92 个 `it` 标题首 token 与表逐 ID 一致（实测清单：A1 A1b A1d A2–A14 / B1–B25 B25b B26–B30 / C1–C7 / D1–D15 / E1–E7 / F1–F4 / G1–G12）；抽查 A1/A1d（`n:0`）、A8（`values:[1,0,3]`）、G6（`n:0`）、E5（合法全量快照）按 SA2 R1 逐条落码，前置条件与表行首一致 |
| fixture 文本 | SA6 §12.0 冻结 TEXT | 逐字相同（L63–71）；为 #347 fixture 的文档化严格超集（既有字段同形、新增可选 `tags?`/t3/body/blob/free——设计 D2 明示、SA2 §10 核准的既知差异） |
| 稳定码 | `mutation.ts` 经 `index.ts` 导出 | 字面量与 `ns.MUTATION_GUARD_MISMATCH` 双向同源断言（L207–208），漂移两向均红 |
| 前置条件权威 | 文件头 L38–40 显式声明「非穷举枚举，以 SA6 表为准」 | SA2 R1/R2 澄清段落实（L38–42），无第二语义源 |

## 6. 架构惯例与生命周期对称性

- 组织惯例：每 issue 单测试文件（issue-237/347/350 先例）、7 个顶层 `describe` 标题与设计 D4 逐字同形（组序=AC 序、组内计数 16/31/7/15/7/4/12）、用例 ID 入 `it` 标题、自包含 fixture + 内联助手（test/ 目录无共享 helper，未引入第二 fixture 体系或平行机制）。
- 生命周期：每 `it` 自建 `Y.Doc` + `watchWrites`，无跨用例共享可变状态；直造载体改动全部发生在 `watchWrites` 挂接之前（S2 次序纪律，B22–B30 逐例核对）；无定时器/真实时钟/并发面；清理责任归 runner（`maxWorkers:1`），与 #347 同款对称性。
- 提交纪律：conventional commit（`test(doc-runtime): …`），与仓内 `test(namespace): …`、`test(server): …` 等无 issue 号先例相容（见 §10 O1）。

## 7. 测试质量标准

| 检查 | 实测 |
|---|---|
| 用例/分组计数 | `it(` = 92、`describe(` = 7（与设计 D3 计数锚 447+92=539 一致；test 目录实测 27 `.test.ts` + 2 `.test-d.ts` = 29 files） |
| 极性会计 | `expectCommitted` 59 调用 + `expectGuardMismatch` 31 + `expectShapeError` 1（A13）+ E4 显式零写入 1 = 92，闭合无遗漏 |
| 禁用模式 | `skip/only/todo`、`as any`、`console.`、`process.env`、fake timers/mock 0 命中（grep exit 1）；无源码字符串/正则断言；message 仅次级辅助（C2/E4/E7/G10 均注明），主断言恒为判决契约 |
| 零写入三件套 | 字节快照 + 0 本地事务 + 0 update 经助手逐例强制；满足态 59 例全部携带落盘值断言（SA2 N3 落实） |
| 负控 | N-A/N-E 引用保持（不重复断言既有文件）；N-B/N-C/N-D 内嵌成对（A1↔A1d、A3↔A4、A5/A2↔A7、A9↔A11、F1/F2↔F3/F4、B 组两极、E4↔E7、G3/G4/G10）；B25 正极性反例归属正确 |
| 真实入口 | 根 `vitest.config.ts` L15 include 覆盖；doc-runtime tsconfig `include: ["src/**/*.ts","test/**/*.ts"]` 纳入根 typecheck；CI 分片按磁盘枚举（ci.yml「新测试文件自动落入某片，不会漏跑」） |
| SA4 O1–O5 观察复核 | A13 未复制 #347 的「未知信封键 guard」负向正则属正确的语境适配（HEAD 能力在库，该断言恒真），主断言完整，非弱化 |

## 8. 不适用面（排除依据）

- 根 AGENTS typed-access 强制条款：本票为 doc-runtime 内部 Seam 1 测试，非应用/独立项目 Namespace 写，不适用。
- VFSL schema authoring 指南：内联测试 fixture 非 `domains/*/schema.vfsl`；`unknown`/`YPlainArray`/`YXmlFragment` 词法合法（SA2 已核 `derived.ts` L51）。
- ADR 0010/0013/0022 复制与 wire 面、ADR 0011/0014 诊断日志：本票零触碰。

## 9. SA4 结论交叉核对

SA4 approve（零修订）与本人独立重核一致：92/92 与 SA6 表 1:1、生产 sha1 三文件 = HEAD、计数会计闭合、冻结面 8 项零触碰、§13.3 条件修正路径未触发（无需回 SA8，requiresConflictRecheck=false 维持）。运行时证据（29 files/539 tests 全绿、根 typecheck exit 0）引自 SA3 记录；SA9 按职责不运行测试，其静态侧前提（入口覆盖、include、计数、断言与源码语义一致性）全部可静态证实且成立。

## 10. 非阻断观察（不影响 verdict）

| # | 观察 | 说明 |
|---|---|---|
| O1 | 提交信息未带 issue 号（`test(doc-runtime): cover guarded mutation semantics matrix`，SA3 建议稿为 `test(#348): …`） | 仓内 test 类提交两种风格均有先例（`test(namespace): consolidate…`、`test(server): align…` 亦无号）；AGENTS.md 无成文提交信息约定，不构成违规 |
| O2 | Host 输入简报 `wiki/raw/task_issue-348.md` 仍未跟踪，未随 7 个 SA 产物入库 | 属 Host/finalize 面取舍，不在被审 diff 内；先例中 dispatch/brief 有入库者（task_191/228），提示而非违规 |

## 11. 审查边界声明

SA9 未修改任何交付内容、未运行测试、未启动服务、未调度其他 SA；仅读取 diff、仓库源码与规范文本，并按上表独立完成标准核对。需求是否完整实现属 SA10 职责，本报告不就 AC 覆盖充分性作需求侧裁决（其可执行锚定质量已按测试质量标准在 §7 核）。
