# SA10 Spec 审查 — issue #383：[ADR 0029] P3 组合面与 lease 类型（缝 2：runtime + registry）

- 被审对象：**最终已提交 diff** `de2ff55571e3d91a3b1bde3a761154c2fade6242`（父基，PR #380 head `adr-0029-filtered-window`）→ `3466571ae3ad7c4a00a59413e5d36268fb3d3da9`（final candidate HEAD，`feat(runtime): support filtered window reads`）。工作树洁净（`git status --porcelain` 空），HEAD 与 dispatch 给定值逐一核对一致。
- 审查人：SA10（mabf-sa10，dispatch `sa-302676f6-af91-41e7-bcfc-d6f95b4c8dcb`，iteration 0）。
- 审查方式：纯静态（最终提交 diff 全文核读 + W1 权威源码逐判据比对 + 文档 grep 门复跑 + 只读 git 核验）；未运行测试、未启动服务、未修改任何代码/设计/测试（本报告为唯一产物）。动态绿门证据采用 SA3（自报）+ SA7（独立复跑）既有产物，并静态核对「被验证 diff ≡ 已提交内容」。
- Owner Issue 评论：**无**（dispatch 明示 REST 返回 `[]`）——无 override 权威在场；验收唯一权威 = Issue 正文 AC1–AC8 + ADR 0029 + 已批准 SA6 契约。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-383.md`（简报：What to build + AC1–AC8；Blocked by #382） | 已读 |
| `wiki/raw/task_issue-383_sa6_contract.md`（approve；B-1–B-15、§12.3 用例组、§12.4 M1–M7、§12.5 P1–P6、§12.6 S1–S6、§12.7 反伪绿、§15-O1–O7） | 已读（全文 511 行） |
| `wiki/raw/task_issue-383_conflict_report.md`（SA8 前置门禁 clear；R1–R16 / F1–F11 / A1–A6；`requiresConflictRecheck: true`） | 已读 |
| `wiki/raw/task_issue-383_implementation_conflict_report.md`（SA8 实现复查 clear；I1–I16、F1–F11 逐项；`requiresConflictRecheck: false`） | 已读 |
| `wiki/raw/task_issue-383_relevant_decisions.md` | 已读 |
| `wiki/raw/task_issue-383_design.md`（SA1 iteration 1，SA2 approve）+ `task_issue-383_sa2_review.md` | 已读 |
| `wiki/raw/task_issue-383_sa3_impl.md`（实现报告）、`task_issue-383_sa4_review.md`（approve，3 MINOR）、`task_issue-383_sa7_report.md`（approve，38/38 探针 + 全仓门复跑） | 已读 |
| 规范权威：`docs/adr/0029-filtered-window-read.md` §1–§8 + 验收缝 2；`docs/adr/0028-window-read.md`；`CONTEXT.md` L61–67 | 已读 |
| 最终 diff 全文：`packages/namespace-runtime/src/window-read.ts`（223 行级改写，现文 570 行关键区间全文核读）、`packages/namespace-runtime/src/runtime.ts`（8 行注释 diff 全文）、四文档 diff 全文、5 个 `issue-383-*` 新测试/fixture 全文（382+376+130+1118+144 行） | 已逐文件核读 |
| W1 权威 `packages/doc-runtime/src/window.ts`（`validateWhere` L362–404 / `validateWhereTerm` L407–460 / `validateWhereEquals` L463–474 / `WHERE_TERM_LIMIT` L74） | 已与 S3 镜像逐判据比对 |

## 2. Verdict

**`approve`** —— Issue 正文 AC1–AC8、What-to-build 能力声明、ADR 0029 验收缝 2 全部达成；无遗漏、无部分实现、无错误实现、无 scope creep；无必须披露的未达成项。SA4/SA7 登记的 3+0 条 MINOR 观察经复核维持不阻断（§6）。

## 3. Issue AC 逐条对账（最终交付内容）

| AC（简报 L21–28） | 最终交付证据 | 判定 |
|---|---|---|
| **AC1** 无 where 时 lease 面结算与 ADR 0028 快照逐字节一致（total = 标识计数、`truncated = kept < total`、✂ 按 truncated 装配；既有快照零漂移） | `window-read.ts` L203–209：`total !== undefined` 半支与旧代码**逐表达式等价**（`kept < total` + `truncated ∧ anchor ≠ null ∧ segments ≠ null` 才 `appendWindowFacts`）；`windowFactsBlock`/`appendWindowFacts`/`canonicalOrderBy`/锚链均不在 diff 区间；A 组测试（A1–A4/A6）以独立预言机（Yjs 原生直数 total、同运行全量窗读正文派生字节奏）断言 ✂ 事实行逐字节；lease 面 AC1 负控（`tasks {n:2}` 事实行 `基 key asc · kept 2/total 5` 字节锚）；既有 #369/#382 家族 129 用例**零改动**（diff 实测：packages 下仅 2 源文件 + 5 个新 issue-383 文件） | **达成** |
| **AC2** 有 where 时 `truncated === (kept === n)`；✂ 段永不装配、不呈现过滤槽；schema 通道仍为元素口径投影文本（where 不影响） | L204 `total === undefined ? kept === canonical.n : kept < total`（在场判据键于 W1 结算单源 B-8 不变量，不重读 options；`kept = entries.length`、n = S3 canonical `n`，与契约 B-5 一致）；L205–209 `appendWindowFacts` 只出现在 `total !== undefined` 分支——有 where 时 ✂ **结构性**不装配（非布尔开关）；两分支 schema 同源 `anchor`。T 组（T1–T14 装满/扫完/恰 n/present-undefined/管线序/脏值/双语义对照）+ X 组（X1–X7 schema 与无 where 对照**字节相等**、无 ✂、无过滤槽、X5 off-schema → null）全组在场 | **达成** |
| **AC3** 恒四键 own 键集 `{ok, value, schema, truncated}` 不变；条目身份随行（key/index）可拼下一轮路径 | L210 `return { ok: true, value: entries, schema, truncated }` 原样；`CanonicalWindowBudget` ok 分支加 `n` 为**模块私有**类型（未导出，三包 `src/index.ts` 零 diff 实测）；K1 断言 `'total' in result === false`；K3/K4/K5 身份回环（`[...path, entry.index\|entry.key]` 深读 ≡ `entry.value`）、K4 数组 index = 原容器位置 `[0,2]` 不重编号 | **达成** |
| **AC4** 组合式 depth 等价锚：过滤入选项 ≡ 同预算 readData（项路径） | 组合层零新逻辑（条目值 = W1 物化产物直通）；D1–D5 以**同一次运行公共面** `readData(项路径, 同预算)` 为 oracle 逐条目 `toStrictEqual`；D4 `depth:0 + maxChildrenPerNode:0` 折叠壳；D5/S3 `poisonScored`（2000 条、未匹配项埋 `payload:NaN`）`ok:true` 且命中恰 2——组合层重物化未匹配项必得 `PATH_NOT_ALLOWED`，变异必红 | **达成** |
| **AC5** S3 接缝两出口（视图不稳定重派发 / 交替视图终态）对 where 判据同步；敌意 where 在组合层同样零外抛 | S3 白名单恰五键（L263–271）；`canonicalWhere`/`canonicalWhereTerm`/`isScalarEquals` 与 W1 `validateWhere`/`validateWhereTerm`/`validateWhereEquals` **逐判据比对一致**（本审查独立比对：W-4 `Array.isArray`、W-5 length 经 own data descriptor 非负整数、非空、≤16（`WHERE_TERM_LIMIT = 16` 具名模块私有常量 + 出处注释，与 doc-runtime L74 同值）、W-6 逐下标 descriptor 无空洞零 accessor、W-7 元素值、W-8 plain 原型链、W-9 恰 `field`/`equals` 两键、W-12 必填闭环、W-10 field 恰 string、W-11 equals 标量闭集 finite、双层 try 收编 trap——零 `[[Get]]`、零 accessor 执行）；镜像只返回布尔、不产出归一化值（非第三套权威）；两出口复用（出口①重派发 W1 失败成员原样透传 L181–182 / 出口② `seamWindowOptionsInvalid` L183，零新码）。Z1–Z11 + S1b 全组在场（descriptor 诚实 trap 成功且 getCalls===0；非法形状全 `WINDOW_OPTIONS_INVALID` 零外抛；交替视图绝不 `ok:true` 静默通过；16 项合法/17 项非法；同 field 重复；falsy 闭集） | **达成** |
| **AC6** registry lease 类型 fail-closed（test-d）；registry 透传组合面 | `packages/namespace-registry/src/**` **零 diff**（实测）——`where` 经既有 raw 引用直传 + 单源别名链到达 lease 面；两个新 test-d：runtime 面 14 条 `@ts-expect-error`（where 非数组/项未知键/equals 非标量闭集对象·数组·undefined/equals 缺失/field 缺失/field 非 string/跨面 orderBy ×3/dir 词表外/readData 带 where/第二参必填）+ Y3 三项明令不写成编译期负例（Z6b 运行时承载）+ Equal 锁；lease 面别名 Equal 锁 + 签名形状锁 + Y5 `WhereTerm` 两侧 TS2694 锁定（具名再导出按批准设计 §5.3 不采，SA6 L6「未加不构成违约」）；L1 lease ≡ 同 doc 直调 runtime `toStrictEqual`（含同一 options 引用语义） | **达成** |
| **AC7** close 后带 where 读 → `RUNTIME_READ_DISABLED`（停接纳不豁免，四键失败形） | `runtime.ts` diff **仅 8 行 doc 注释**（行为零改动，逐行核对）；S1 gate 先行不动。C1/C3 closed 期：码 + own 键集恰 `{code,message,ok,path}` + path 回显 + trapCounting options **触达 === 0**；C2 closing 期（close 返回前）同步拒绝且与无 where 同款 `toStrictEqual`；C4 released 短路（`NAMESPACE_LEASE_RELEASED` 三键、零 options 触达）在 lease 文件 L2 承载 | **达成** |
| **AC8** 缝 2 测试先例（#369 组合面家族 + runtime-data-interface.test-d + registry 内部缝）；全仓 typecheck + 测试绿 | SA6 §12.5 P1–P5 路径**逐一在场**：`issue-383-window-where-composition-red.test.ts`（54 用例，A/T/X/K/D/Z/S/F/C + N 负控）、`issue-383-lease-where-contract-red.test.ts`（16 用例，L1–L6 + T11/X8/D3/C4/M1/AC1 负控）、`issue-383-filtered-window-fixture.ts`（FIX-383-A 逐项：tasks/taskList/exactTasks/bigTasks/emptyTasks/scalarList/edge/nullState/dirty/poisonScored/badHit/rawHidden；构造纪律镜像 #369 fixture——同 doc StubPersistence + manualClock + deterministicRandomBytes + schema ready 轮询 + 跨包 import 先例一致）、两个 type-guard test-d；命名匹配 `vitest.config.ts` include 与 `tsconfig.typecheck.json` typecheck.include（自动采集、零配置改动）。绿门证据：SA3 `pnpm typecheck` exit 0（14 工程）+ `pnpm test` **400 files / 4903 tests exit 0**；SA7 独立复跑逐位一致（聚焦 6 文件 199 + 2 test-d = 8 文件 205 绿；`pnpm test` 400/4903、597s） | **达成**（证据链见 §5 注 1） |

**What to build 能力声明**（简报 L17）：「调用方在 lease 公共面上完成『找到所有 state == 'claimed' 的 task』并正确读出截断信号」——lease L1/T11 五组键面 + 三组数组面用例 + SA7 探针 P01a–P01e（`ok:true`、恒四键、`[t1,t3,t5]`、`truncated=false`（3<5 扫完））实测兑现；S3 canonical 键集白名单扩 where 且判据与 doc-runtime 权威校验一致（本审查逐判据比对）；S6 truncated 双语义与 ✂ 装配规则按 ADR 0029 §5 落地；lease options 类型面 fail-closed（Y 组）。

## 4. 范围与冻结面核对（scope creep 排查）

| 面 | 实测 | 判定 |
|---|---|---|
| `packages/doc-runtime/src/**`（F9） | `git diff --stat` **空** | 保持 |
| `packages/namespace-registry/src/**`（F10/S6：released 短路 + raw 直传 + 单源别名 + Equal 锁） | 空 | 保持 |
| 三包 `src/index.ts` 公共导出面 | 空 | 保持（无 `WhereTerm` 具名再导出——批准设计明选不采，非违约） |
| `CONTEXT.md` / `docs/adr/**` / `docs/integration/app-data-access-skill.md` | 空 | 保持（app-data-access-skill.md 系设计 §5.6 显式登记不改，经 SA2 批准） |
| 既有测试/fixture/守卫（#369 ×3 文件、#382 ×2、`runtime-data-interface.test-d.ts`、公共面守卫 ×3） | 零改动 | M1/M6/M7 保持 |
| 配置文件（`vitest.config.ts`/`tsconfig*`/包 `package.json`） | 零改动 | 新测试命名自动采集 |
| 缝 1 中间态清账（R16/M2） | `grep -rn seamWhereNotImplemented`（packages/docs/CONTEXT）**零命中**；无严格缝 1 断言遗留为持久测试 | 清账完成 |
| 结构审计禁项（§12.6 S2/S3） | 无 `total ??`、无 `kept < undefined`、唯一 `as number` 为 `isScalarEquals` 的 `Number.isFinite` 收窄（L389，非 total 路径）；组合层零计数函数、零谓词求值镜像（`canonicalWhere` 只做形状判据） | 通过 |
| 文档 grep 门（A6 + SA2 `F-383-S2-1` ④；本审查复跑） | `kept < total` 全仓 `.md`（排除 wiki//adr//CONTEXT.md）**恰 4 处**：根 `AGENTS.md` L31（`without where` 限定 + 双语义句）、`typed-access.md` L172（`Without where` 限定）、`cordis-plugin-hosting.md` L413/L418（「无 where =」/「where 缺席形态」）——全部带 where 限定；`SKILL.md` L15 gloss 含 `optional where equality filter` 能力提及且不陈述截断语义 | 通过 |
| diff 新增文件面 | 仅 ALLOW LIST 内 11 个非 wiki 文件（2 源 + 4 文档 + 5 测试/fixture）+ wiki 产物（本仓既有约定：前置票 de2ff55 同款携带 wiki/raw 产物） | 无 scope creep |

## 5. 偏差登记与 PR 披露项

**无未达成项、无部分实现、无错误实现。** 以下系实现链已登记并经上游批准的事实性处置，供 PR 描述完整性参考（均非违约）：

1. **绿门证据链形态**：SA3/SA7 的全仓 `pnpm test`/`pnpm typecheck`（exit 0）在未提交 diff 上执行；本审查静态核对「被验证 diff ≡ 已提交内容」成立——提交 stat 与 SA3 Changed paths 逐位吻合（6 修改 + 5 新增非 wiki 文件），SA7 收尾时 `git status` 恰为该 11 文件 + wiki 产物，提交后工作树洁净。SA10 按职责未重跑测试。
2. **SA6 契约两处内部不一致的实现处置**（SA3 §Deviations 登记、SA8 A-I1 ② 交接、SA7 实测确认）：① §12.3.1 A3 的 total 锚按 FIX-383-A fixture 事实（`taskList` 3 元素）与独立预言机断言 `kept 1/total 3`（契约文本误写 2）；② §12.3.1 A4 的 `scalarList` 非空，拆为 `emptyTasks` 空容器断言 + `scalarList` 全量窗断言（where 在场安静不匹配由 T7 承载）。语义面与 ADR/CONTEXT 一致，无断言弱化。
3. **SA6 §12.3.9 F1/F2/F4 的 HEAD 颜色回填**：实测 HEAD 即绿（W1 失败透传先于组合层），按预绿守卫登记——与设计 §12 预测、SA2 观察 4 一致；目标契约（失败透传、不被 options 面吸收）不变。
4. **已接受暴露类文档化**（SA2 观察 3）：双合法视图值漂移时装满判定取 S3 canonical `n`——#369 已接受暴露类（`canonical.term`/`canonical.budget` 同族），Z 组头注文档化，无新用例、无新出口。
5. **`WhereTerm` 未具名再导出**：批准设计 §5.3 明选不采（SA6 L6「未加不构成 AC 违约」；消费方直依 `@nomicore/doc-runtime` type-only 导出），Y5 以 TS2694 双向锁定该事实。

## 6. 上游 MINOR 观察复核（维持不阻断）

| 来源 | 观察 | SA10 复核 |
|---|---|---|
| SA4 §11-1 | T4 以排序后集合等价对账（未断言键面码点序精确呈现序） | 承重断言（kept 5 === n 5 → `truncated === true`，AC2 核心）精确；序语义由 A1/A2/K5/T12 精确承载。不阻断 |
| SA4 §11-2 | lease 用例多数 release-only 未 `registry.shutdown()` | 与 #369 lease 先例同款；test scheduler + manual clock 无真实定时器。不阻断 |
| SA4 §11-3 | Z8/S1b 以 message 子串（`视图不稳定`）辅助判别出口② | message 非契约字段（SA6 §15-O2）；出口归属的结构判别（视图③合法 ⟹ 唯一失败来源）不依赖 message；SA7 探针以 passes=3/accessorCalls=0 行为复核。方向安全（假红优于假绿）。不阻断 |

## 7. Owner 评论映射

Issue 评论 REST 快照为空（`[]`）——无 Owner 评论、无 override 权威在场（沿 SA8 §4 / SA6 §2）。验收唯一权威 = Issue 正文 AC1–AC8 + ADR 0029 验收缝 2 + SA6 已批准契约，已按 §3 逐条对账闭合。

## 8. 结论

最终提交 diff 忠实满足 Issue #383 正文（What to build + AC1–AC8）、ADR 0029 验收缝 2 与 SA6 已批准契约：缝 1 中间态（`seamWhereNotImplemented`）整体清账，S3 五键白名单 + `where` 判据镜像与 W1 逐判据一致且两出口同步，S6 `truncated` 双语义单源结算 + ✂ 结构性永不装配，恒四键与条目身份不变，registry/doc-runtime/公共导出/既有测试全冻结面零 diff，测试先例 P1–P5 落地且全仓绿门证据（SA3 自报 + SA7 独立复跑）与被提交内容一致。无遗漏、无部分实现、无错误实现、无 scope creep、无未披露未达成项。

**Verdict：`approve`**
