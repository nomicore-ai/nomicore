# SA3 Implementation Report — issue #364（T2 readData 投影文本化原子切换）

- 角色：SA3（TDD Executor）· **iteration 1 · retry dispatch `sa-4471839e-867c-4f0c-9b3b-31556edf61de`**
- 前序：iteration 0（dispatch `sa-8e583b6c-6755-490a-81b1-a2893edf3f7f`）已完成实现，但该 dispatch
  在 Host observer 失败中结束、**无业务裁决**；iteration 1 据此独立复核工作树，保留全部符合设计的
  改动（**零修正**），并以本迭代自跑的验证替换/补齐证据。本报告已原位更新为**当前实现 + 当前验证
  结果**；iteration 0 原始证据（red/green/typecheck/root-test log）保留并逐项标注来源。
- 基线 HEAD：`f8a06fe`（分支 `mabf/issue-364` = `origin/adr0027-projection-text` tip；T1 #363 已合入）
- 任务类型：Feature（交付形态换代）+ Refactor 面（detach 深拷贝退役、消费测试翻新）

## Inputs consumed

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-364.md`（Host brief） | 在场 | What-to-build 5 条 + AC 10 条 |
| `wiki/raw/task_issue-364_sa6_contract.md`（approve） | 在场 | CT-1..CT-10 断言组、附录 A/B/C、U1–U7、M1–M8 |
| `wiki/raw/task_issue-364_design.md`（SA1） | 在场 | §7-D1..D9 决策、§8 接口/数据流、§11 ALLOW/DENY、§12 验证映射 |
| `wiki/raw/task_issue-364_sa2_review.md`（approve，无 BLOCKER/MAJOR，O1–O6） | 在场 | 设计已审；O1/O2/O3/O5/O6 处置见下 |
| `wiki/raw/task_issue-364_relevant_decisions.md` + `_conflict_report.md`（clear；`requiresConflictRecheck: true`） | 在场 | 冻结面清单、W1–W4、实现后复查义务 |
| `docs/adr/0027` / `0016` / `0024`（含 #359 amendment）、`CONTEXT.md` L36–60、根/包 AGENTS | 实读 | 权威契约、词表零漂移核对、包边界 |
| T1 产物 `packages/vfsl/src/render-projection-text.ts`（144 tests） | 实读 + 运行 | 渲染器冻结面（零改动） |
| Issue #364 REST comments | 空（dispatch 明示 none） | 无 owner 逐字判据 |

## Existing worktree reconciliation

### iteration 1（本次 dispatch）：独立复核 → 保留、零修正

进入时工作树 = iteration 0 的完整未提交实现（28 modified + 5 untracked 测试文件 + 4 份 iteration 0
证据 log + 本报告）。复核程序与结论：

| # | 复核项 | 方法 | 结论 |
| --- | --- | --- | --- |
| R1 | 改动清单 ↔ SA1 §11 ALLOW/DENY | 机器比对（`git status --porcelain` 逐路径对照 ALLOW 清单；DENY 路径定向 `git status`） | 33 个实现/测试/文档改动**全部在 ALLOW**，无 ALLOW 外路径；DENY 零改动；无版本号改动（见 §File scope check） |
| R2 | 生产实现 ↔ 设计 D1–D9 | 实读 `read-schema-projection.ts`（全文）、`runtime.ts`/`index.ts`/registry 两文件 diff | 一致：文本组装单点 + 头行 + renderer 接线；clone 家族 0 命中；单一 `ReadDataOkResult`；两联合名/重载序/零泄漏注释在位；U3 转出退役；组合层零 `as` |
| R3 | 消费面翻新完整性 | `git status` + 残留 `truncations`/五键 grep + 收敛门扫描器实读 | 残留 `.truncations` 仅存在于值通道（doc-runtime 冻结面）与**新契约的 oracle 读取**；旧五键成功形状在 runtime/registry 测试树归零（收敛门 family A/B = 0） |
| R4 | 红→绿时间序（red-first 真实性） | `stat` 逐文件 mtime 对照 | red log（21:44:48）**早于**生产源码改动（runtime.ts 21:45:51 / read-schema-projection.ts 21:47:03）；green log（21:55:42）、root-test log（22:05:53）晚于全部测试/文档终稿（≤21:55:11）——证据与工作树状态自洽 |
| R5 | 契约敏感性（独立 sanity probe，非 SA7 替代） | 受控 M1 突变：临时在预算成功分支复挂 `truncations` 键 → 跑主契约文件 → **`trap` 还原** → sha256 比对（事后补跑 clean 根门禁消除窗口重叠） | 突变即红：`A2` 与 `B1/B3` 击穿（2 failed / 30 passed，`wiki/raw/task_issue-364_sa3_iter1_m1_probe.log`）；还原后 sha256 与突变前逐字节相同（`8452c7d8…`），复跑该文件 **32 passed**。证明绿色非空转。突变窗口（22:09:24–25）与预备轮根测试采集窗口有约 1s 重叠；因该轮 **0 failures**（若采到突变版本则主契约 A2/B1 必红）且已补跑零并发 clean 轮同结果，无残留疑义 |
| R6 | 装置残留 | `ls packages/*/test` 探针名扫描 | 无 `zz-*`/临时探针；既有 `*-probe.test.ts` 为本仓常驻测试（未改动，非本票产物） |
| R7 | 权威源与凭证 | 实读 `docs/adr/0016/0024` 门、`CONTEXT.md` L38–59 | ADR 正文零改动（历史记录）；CONTEXT 词汇与实现零漂移（J7）；O1 caveat 在场（见 §SA2 Finding落实） |

**修正项：无**。iteration 0 的实现经上述复核未发现设计偏离、契约缺口或残留伪形，故 iteration 1 不
改写任何实现/测试/文档内容（唯一写入 = 本报告的迭代更新 + 3 份 iteration 1 证据 log）。

### iteration 0（历史）

iteration 0，无既有 SA3 实现或报告（`wiki/raw/task_issue-364_sa3_impl.md` 不存在于起始状态）。工作树起始仅
Host/SA6/SA8 的 untracked 证据文件；本次全部实现为本轮新建。本轮另有一名 runtime-测试工作流临时建立的诊断探针
`packages/namespace-runtime/test/zz-sa3-probe.test.ts`，完成前已删除（`ls packages/namespace-runtime/test | grep zz-sa3` 为空）。

## Changed paths

生产实现（5，SA1 §11 ALLOW LIST 生产 #1–#5）：

| Path | Design section | Change |
| --- | --- | --- |
| `packages/namespace-runtime/src/read-schema-projection.ts` | D1/D2/D4 | 组合层升格为投影文本单点：删 clone 家族（原 L134–303 整段）；`projectReadDataSchema` 返回 `string \| null`（预算重载追加第 4 参 `truncations`）；新增 `headLine` + `foldSegment` + `ownAxis`；组装序 = 头行 + `'\n\n'` + `renderProjectionText`；模块头注/JSDoc 重录 |
| `packages/namespace-runtime/src/runtime.ts` | D3/D5/D7 | 新增包内成功类型 `ReadDataOkResult`（单一四键形），两联合成功面共用、联合名/零泄漏注释/重载序保留；两处组装四键化（删 `truncations` 键位）；readData 函数/接口 JSDoc 重录（恒四键/投影文本/头行/✂/null×预算诚实限制）；移除 `ReadDataSchemaProjection`/`BudgetedReadDataSchemaProjection`/`ReadLogicalValueTruncationEntry` 导入 |
| `packages/namespace-runtime/src/index.ts` | D6/U3 | 退役 `ReadLogicalValueTruncationEntry` 公共转出（原 L46）；#364 增量头注 |
| `packages/namespace-registry/src/types.ts` | CT-1/9 | lease 两别名 JSDoc 词汇重录（代码零变化，自动跟随） |
| `packages/namespace-registry/src/lease.ts` | CT-1/9 | `leaseReadData` JSDoc 词汇重录（透传代码/Equal 组合锁零变化） |

新契约测试（5，SA6 附录 C / 设计 ALLOW 新契约 #1–#5）：

| Path | 覆盖 |
| --- | --- |
| `packages/namespace-runtime/test/runtime-readdata-projection-text-red.test.ts`（新） | CT-1 A / CT-2 B（10+14 路径 × 9 预算双夹具矩阵、oracle 逐字节）/ CT-3 C1–C7 / CT-4 D1–D7 / CT-5 E1–E6 / CT-6 F1–F3 / CT-7 G1–G2 |
| `packages/namespace-runtime/test/runtime-readdata-projection-text-control.test.ts`（新） | 三层负控：值通道恰两键 + 折叠/省略/缺席吸收；失败面与能力面；T1 头行归属对照 |
| `packages/namespace-runtime/test/runtime-readdata-projection-text.test-d.ts`（新） | CT-8 H1/H2/H3/H5/H6（H4 由 registry 镜像承担） |
| `packages/namespace-registry/test/registry-readdata-projection-text-red.test.ts`（新） | CT-1 A5/A6、CT-4、CT-6 F4（真实 Registry 装配 lease 四键/文本 ✂/width 对偶/null；released 短路；raw options 同一引用） |
| `packages/namespace-registry/test/registry-readdata-projection-text.test-d.ts`（新） | CT-8 H4 lease 别名组合锁/重载序/零泄漏/released issue 形状 |

存量消费面翻新（20，SA6 §10.2「必改 16 + 建议同步 3 + helper 随动」+ 仪器）：

| Path | Change |
| --- | --- |
| `runtime/test/helpers/readdata-ok-shape.ts` | 四键化：`READDATA_OK_KEYS`/`ReadDataOkShape`（schema `string\|null`）/`readDataOk(value, schema, truncated=false)`/`expectReadDataOk`（删 truncations 参）；反伪绿不变量原文保持 |
| `runtime/test/helpers/readdata-shape-assertion-scan.ts` | `SUCCESS_SHAPE_KEYS` 四键 + 新增 `RETIRED_SUCCESS_SHAPE_KEYS` 五键；family B 同时识别当前四键与退役五键字面量（陈旧形状写死即违规）；头注/样本重录 |
| `runtime/test/readdata-shape-assertion-consolidation-gate.test.ts` | 四键正样本 + 五键陈旧正样本；schema 投影四元素键集为负样本；family A/B 归零门保持 |
| `runtime/test/runtime-readdata-shape-budget-red.test.ts` | 五键/`r.truncations` → 四键 + 值通道 oracle + 文本 ✂/`‡`/头行锚；`projectionMarkers` 结构游走整组退役；F-x trap 计数（4/5、0）与失败面保持 |
| `runtime/test/runtime-readdata-shape-budget-control.test.ts` | JSON 投影深等 → 文本 oracle 逐字节；detach 冻结/引用互异组 → 文本隔离锚（连续/交错读逐字节、改写 `r.value` 后文本不变）；失败面保持 |
| `runtime/test/runtime-readdata-schema-projection-red.test.ts` | 15 条四件套深等 + 引用隔离组 → 文本一致性锚（独立编译 ENV_273 + resolver + renderer）+ null 三情形 + 文本隔离 |
| `runtime/test/runtime-readdata-schema-projection-control.test.ts` | 失败面/值语义负控保持；成功分支措辞与采样随动 |
| `runtime/test/runtime-readdata-hostile-path-guard.test.ts` | 恰四键（helper）；合法路径文本锚 `# readData [count]\n\nnumber\n`；`Object.isFrozen(valueSchema)` 退役；敌意零调用锚保持 |
| `runtime/test/runtime-readdata-int-range.test.ts` | `schema.valueSchema` 深等 → 文本文法锚（`Int<1, 100>`/裸 `Int`/`Range<0.5, 1.5>`/`Int<0, 9>[]`/`Record<…>`/union/`Pattern<…>`）+ ROOT 宿主字段行 docs 锚 |
| `runtime/test/runtime-readdata-shape-budget.test-d.ts` | 四键 Equal（两联合同型）/`string\|null`/`boolean`/`Extract<…,{truncations:unknown}>===never`/`@ts-expect-error`；删 `ReadLogicalValueTruncationEntry` 导入；零泄漏与失败面无新键锁保持 |
| `runtime/test/runtime-readdata-schema-red.test-d.ts` | `HasSchemaOnOk` → `string\|null` + 四键；doc-runtime 保持性守卫不动 |
| `runtime/test/runtime-data-interface.test-d.ts` | 可赋值样例保持 + `@ts-expect-error`（`r.truncations`/`r.schema.valueSchema`） |
| `registry/test/registry-readdata-budget-passthrough.test.ts` | 五键 → 四键 + 文本 ✂ 锚；透传引用/ released 三键/装配 `toStrictEqual(direct)` 锚保持 |
| `registry/test/registry-readdata-budget-passthrough.test-d.ts` | 四键 Equal + `string\|null` + 同型锁 + 零泄漏负例；失败面无新键锁保持 |
| `registry/test/registry-readdata-schema-red.test-d.ts` | lease 别名 `string\|null` + 四键 + 别名组合锁/重载序 |
| `registry/test/registry-data-interface.test-d.ts` | 可赋值样例 + 四键探针 + `@ts-expect-error` |
| `registry/test/registry-phase5-bootstrap-reset-r2-internal.test.ts` | L271 陈旧两键替身 → 四键 shape（扫描/编译双盲区，按清单人工同步） |
| `registry/test/readdata-docs-adr0016-contract-fixture.ts` | 匹配器词汇重录：`hasFourKeyParagraph`→R3′（投影文本 + 头行/✂ 载体）、`hasKeyConventionParagraph`→R4′（✂ 段 + 头行 + 预算段文法）、`staleAnnotationViolations` 双向修复、`adr0016Refs` 放宽（0027 ∧ 0016/0024）、新增 J4 `retiredVocabularyViolations`；`readDataOptionUsages`/`hasBudgetDisciplineParagraph`/语义面谓词保持 |
| `registry/test/readdata-docs-adr0016-sync-control.test.ts` | 行为锚五键+四件套 → 四键 + 文本头行；正负样本双向重录 + 敏感自控；ADR-0016/0024 权威源健全性门**保持在场且绿**，追加 ADR-0027 门 |
| `registry/test/readdata-docs-adr0016-sync-red.test.ts` | R3′/R4′ + R1/R2/R5/R6/R7 重录 ADR 0027 词汇 |

文档（3，SA6 §10.3 / 设计 ALLOW 文档）：

| Path | Change |
| --- | --- |
| `.agents/skills/nomicore/typed-access.md` | 五键/truncations/四件套/detached 深拷贝词汇 → 恒四键 + 投影文本（头行/正文/✂ 段）+ `truncated` 机器信号；**L127 预算纪律整句原文保留（sha256 前后一致）**；O1 null×预算诚实 caveat 就位；权威源挂 0027 + 0016/0024 |
| `docs/integration/cordis-plugin-hosting.md` | L340 示例注释恒四键 + 投影文本样张（头行→正文→✂）；跨 realm 节语义零变化 |
| `docs/integration/external-project-vfsl-codegen.md` | L288 恒五键陈述 → 恒四键 + 投影文本；`.value` 适配器零代码变化明示 |

固定证据/报告（9，worktree-relative；前 4 份 = iteration 0，后 5 份 = iteration 1 独立复跑）：

| Path | 内容 |
| --- | --- |
| `wiki/raw/task_issue-364_sa3_red.log` | iteration 0：未改生产代码的 HEAD 上两条新红灯契约全量输出（22 failed / 16 passed；签名 = 成功面多 `truncations` 键、`schema` 为 object） |
| `wiki/raw/task_issue-364_sa3_green.log` | iteration 0：聚焦契约家族 `--typecheck` 全绿（22 files / 346 tests / no type errors / exit 0） |
| `wiki/raw/task_issue-364_sa3_typecheck.log` | iteration 0：根 `pnpm typecheck`（14 tsconfig）exit 0 |
| `wiki/raw/task_issue-364_sa3_root_test.log` | iteration 0：根 `pnpm test`（`--typecheck`）386 files / 4607 tests passed / Type Errors no errors / exit 0（605.63s） |
| `wiki/raw/task_issue-364_sa3_iter1_green.log` | **iteration 1**：同一 22 文件聚焦家族复跑 `--typecheck` → 22 files / 346 tests passed / Type Errors no errors / `FOCUSED_EXIT=0`（5.28s） |
| `wiki/raw/task_issue-364_sa3_iter1_typecheck.log` | **iteration 1**：根 `pnpm typecheck`（14 tsconfig 串行）`TYPECHECK_EXIT=0` |
| `wiki/raw/task_issue-364_sa3_iter1_root_test.log` | **iteration 1（预备轮）**：根 `pnpm test`（`--typecheck`）386 files / 4607 tests passed / Type Errors no errors / `ROOT_TEST_EXIT=0`（589.39s）——该轮与 M1 probe 有约 1s 采集窗口重叠（见 R5），故补跑 clean 轮 |
| `wiki/raw/task_issue-364_sa3_iter1b_root_test_clean.log` | **iteration 1（clean 轮，定稿证据）**：全顺序根 `pnpm test`（`--typecheck`）**386 files / 4607 tests passed / Type Errors: no errors / 0 failures / `ROOT_TEST_EXIT=0`**（606.78s，start 22:19:19，与任何突变无重叠） |
| `wiki/raw/task_issue-364_sa3_iter1_m1_probe.log` | **iteration 1**：受控 M1 sanity probe 的突变期输出（2 failed / 30 passed；击穿面 = A2 + B1/B3）；同轮 `trap` 还原后 `runtime.ts` sha256 逐字节复原并复跑 32 passed |

汇总：28 个文件修改（+1417 / −1085）+ 5 个新测试文件；DENY LIST 零改动、零版本号改动。

## SA2 Finding落实

SA2 §13 Required revisions：无 BLOCKER、无 MAJOR（无需落实项）。§14 非阻断观察逐条处置：

| Finding ID | Implementation | Result |
| --- | --- | --- |
| O1（typed-access L130 重录须含 null×预算诚实 caveat） | `typed-access.md` 消歧句后紧接 caveat：schema 为 null（无 active schema / 路径偏离 / 敌意 path）而预算读发生截断时，键级消歧不可用、只剩 `truncated === true`；并挂 ADR-0027 已知限制 + CONTEXT 截断省略词条 | 已落实。iteration 1 复核锚点：`typed-access.md` L129（消歧句后紧接 caveat，挂 ADR-0027 known limitation + CONTEXT 截断省略词条）；`runtime.ts` readData JSDoc「已知限制（ADR-0027 已知限制 2，诚实形态）」段；`CONTEXT.md` L47 `_Avoid_` 与 L54 截断省略词条同款诚实句；行为锚 = 新契约 D6（`schema:null` × raw 键 + `depth:0` → `schema === null` 且 `truncated === true`），RED/GREEN 双阶段在场 |
| O2（纯空白段折叠后不可区分：C6 不得断言可区分性） | C6 仅断言换行折叠/行数不增（`rec.a b`、`rec.c d`），不断言空白段可区分性 | 已遵守 |
| O3（fixture 谓词名不再自描述，可选改名） | 未改名（保留 `hasFourKeyParagraph`/`hasKeyConventionParagraph`），仅重录 JSDoc 语义为 R3′/R4′——改名会扩大 diff 且无验收收益 | 未采纳（记录理由，非阻断） |
| O4（SA7 以段落内容锚而非 SA6 行号复核 L128 纪律句） | 本报告记录：`hasBudgetDisciplineParagraph` 四正则锚定 L127 段（sha256 前后一致）；SA6 原引用 L126/L130/L132 为邻域段 | 已按内容锚处置 |
| O5（helper 双参 vs 三参措辞） | 以设计 §7-D9 规格为准：`readDataOk(value, schema, truncated = false)`；registry 既有 ≤2 参调用点零编译破坏（7 文件 125 tests 零改动通过） | 已落实 |
| O6（A1 `JSON.stringify` 包含性检查对业务键名 `truncations` 会假红） | 夹具键域为 title/count/meta/tags/nick（无 `truncations` 业务键）；A1/A2 双重断言（`'truncations' in r === false` + JSON 不含该词汇） | 已规避 |

## File scope check

每个实际 changed path 均落在 SA1 设计 §11 ALLOW LIST（编号为设计清单条目）：

| Changed path | ALLOW entry | Purpose |
| --- | --- | --- |
| `packages/namespace-runtime/src/read-schema-projection.ts` | 生产 #1 | D1/D2/D4 文本组装单点 + clone 家族退役 |
| `packages/namespace-runtime/src/runtime.ts` | 生产 #2 | D3/D5 类型坍缩 + 四键组装 + JSDoc |
| `packages/namespace-runtime/src/index.ts` | 生产 #3 | D6/U3 转出退役 + 头注 |
| `packages/namespace-registry/src/types.ts` | 生产 #4 | 别名 JSDoc 词汇（代码零变化） |
| `packages/namespace-registry/src/lease.ts` | 生产 #5 | 透传 JSDoc 词汇（代码零变化） |
| `packages/namespace-runtime/test/runtime-readdata-projection-text-red.test.ts` | 新契约 #1 | 主缝红灯契约 |
| `packages/namespace-runtime/test/runtime-readdata-projection-text-control.test.ts` | 新契约 #2 | 负控/回归锚 |
| `packages/namespace-runtime/test/runtime-readdata-projection-text.test-d.ts` | 新契约 #3 | CT-8 类型锚 |
| `packages/namespace-registry/test/registry-readdata-projection-text-red.test.ts` | 新契约 #4 | lease/装配红灯契约 |
| `packages/namespace-registry/test/registry-readdata-projection-text.test-d.ts` | 新契约 #5 | lease 类型锚 |
| `packages/namespace-runtime/test/helpers/readdata-ok-shape.ts` | 存量 #1 | 四键 helper 单点 |
| `packages/namespace-runtime/test/helpers/readdata-shape-assertion-scan.ts` | 存量 #2 | 扫描器四键化 + 退役形状识别 |
| `packages/namespace-runtime/test/readdata-shape-assertion-consolidation-gate.test.ts` | 存量 #3 | 收敛门正负样本重录 |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget-red.test.ts` | 存量 #4 | 预算契约翻新 |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget-control.test.ts` | 存量 #5 | 预算负控翻新 |
| `packages/namespace-runtime/test/runtime-readdata-schema-projection-red.test.ts` | 存量 #6 | 投影契约翻新 |
| `packages/namespace-runtime/test/runtime-readdata-schema-projection-control.test.ts` | 存量 #7 | 投影负控随动 |
| `packages/namespace-runtime/test/runtime-readdata-hostile-path-guard.test.ts` | 存量 #8 | 敌意 path 四键化 |
| `packages/namespace-runtime/test/runtime-readdata-int-range.test.ts` | 存量 #9 | 文法文本锚 |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget.test-d.ts` | 存量 #10 | 类型锁四键化 |
| `packages/namespace-runtime/test/runtime-readdata-schema-red.test-d.ts` | 存量 #11 | schema 类型锚 |
| `packages/namespace-runtime/test/runtime-data-interface.test-d.ts` | 存量 #12（建议同步） | 接口可赋值 + 负例 |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test.ts` | 存量 #13 | 透传测试翻新 |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test-d.ts` | 存量 #14 | 透传类型锚 |
| `packages/namespace-registry/test/registry-readdata-schema-red.test-d.ts` | 存量 #15 | lease 类型锚 |
| `packages/namespace-registry/test/registry-data-interface.test-d.ts` | 存量 #16（建议同步） | 接口探针 + 负例 |
| `packages/namespace-registry/test/registry-phase5-bootstrap-reset-r2-internal.test.ts` | 存量 #17（建议同步） | L271 两键伪形 → 四键 |
| `packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` | 存量 #18 | 文档匹配器词汇重录 |
| `packages/namespace-registry/test/readdata-docs-adr0016-sync-control.test.ts` | 存量 #19 | 行为锚 + 双向敏感自控 + ADR 门保持 |
| `packages/namespace-registry/test/readdata-docs-adr0016-sync-red.test.ts` | 存量 #20 | R3′/R4′ 重录 |
| `.agents/skills/nomicore/typed-access.md` | 文档 #1 | CT-10 J1/J4/J5 + O1 |
| `docs/integration/cordis-plugin-hosting.md` | 文档 #2 | CT-10 J2 |
| `docs/integration/external-project-vfsl-codegen.md` | 文档 #3 | CT-10 J3 |

helper 随动组（`registry-idle/open/create/sa7-rev1/sa7-hostile/sa7-concurrency/shutdown` 7 文件）经 helper 四键化**零编辑**通过（125 tests），故不在 changed paths；`CONTEXT.md` 只读核对未改（J7）；`docs/adr/**`、`packages/vfsl/**`、`packages/doc-runtime/**`、`apps/yjs-server/src/**`、`packages/ws-replication/src/**`、版本/发布链、runner 配置均零改动（`git status` 核验）。

## Verification

### iteration 1（本次 dispatch 自跑，全部为当前工作树状态）

| Command | Result | Evidence |
| --- | --- | --- |
| GREEN 聚焦契约家族（22 文件 = SA6 §4 15 文件 + 7 新/翻新类型文件）`NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck …` | **22 files / 346 tests passed，Type Errors: no errors，`FOCUSED_EXIT=0`**（5.28s） | `wiki/raw/task_issue-364_sa3_iter1_green.log` |
| 根 typecheck `pnpm typecheck`（14 tsconfig 串行） | **`TYPECHECK_EXIT=0`** | `wiki/raw/task_issue-364_sa3_iter1_typecheck.log` |
| 根测试 `pnpm test`（`NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`，包 AGENTS「runtime 契约变更前必跑根门禁」） | **386 files / 4607 tests passed，Type Errors: no errors，0 failures，`ROOT_TEST_EXIT=0`**（606.78s；与 iteration 0 基线 381/4540 → +5 文件 +67 tests 逐项一致） | `wiki/raw/task_issue-364_sa3_iter1b_root_test_clean.log`（定稿轮）；预备轮 `…_iter1_root_test.log` 同结果 |
| 契约敏感性 sanity probe（受控 M1：临时复挂 `truncations` 键 → 跑主契约 → `trap` 还原 → sha256） | 突变即红（`A2` + `B1/B3` 击穿：2 failed / 30 passed）；还原后 `runtime.ts` sha256 = `8452c7d8…`（与突变前逐字节同），复跑该文件 **32 passed** | `wiki/raw/task_issue-364_sa3_iter1_m1_probe.log`；结论记录于 §Existing worktree reconciliation R5 |
| clean 门禁补跑（消除 M1 probe 与预备轮的采集窗口重叠） | 顺序执行、零并发：聚焦 22 文件绿（22:07）→ 根 typecheck 绿 → M1 probe（22:09，1s 内还原）→ clean 根测试绿（22:19–22:29，`ROOT_TEST_EXIT=0`，0 failures） | 三份 log 时间序自洽；预备轮与 clean 轮同结果 |
| 文件范围机器核对（ALLOW/DENY/版本） | 33 个改动路径 **全部命中 ALLOW**；`OUTSIDE ALLOW LIST: NONE`；`ALLOW entries with no change: NONE`；DENY 集合 `git status` 空、`git diff -- **/package.json` 空 | 本报告 §File scope check（`git status --porcelain` 逐路径机器比对） |
| 红→绿时间序核对（red-first 真实性） | red log 21:44:48 < 生产源码 21:45:51/21:47:03；green 21:55:42 / root-test 22:05:53 ≥ 测试/文档终稿（≤21:55:11）；此后无任何 `packages/`/`docs/`/`.agents/` 源文件改动（`find -newermt` 空） | 见 R4 |

### iteration 0（历史证据，同一工作树状态；标注来源）

| Command | Result | Evidence |
| --- | --- | --- |
| RED：`npx vitest run --typecheck <新 runtime red + 新 registry red>`（未改生产代码的 HEAD） | **红**：2 files / 22 failed / 16 passed；失败签名 = 恰四键断言处 received 多 `truncations`、`typeof schema === 'object'`、`r.schema.startsWith/includes is not a function`；红点全部可归因到目标形状/文本面（非装置/入口/oracle 前置） | `wiki/raw/task_issue-364_sa3_red.log`（exit 1） |
| GREEN 聚焦契约家族（22 文件 = SA6 §4 15 文件 + 7 新/翻新类型文件）`NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck …` | **22 files / 346 tests passed，Type Errors: no errors，exit 0**（5.32s） | `wiki/raw/task_issue-364_sa3_green.log` |
| 根 typecheck `pnpm typecheck`（14 tsconfig 串行） | **exit 0** | `wiki/raw/task_issue-364_sa3_typecheck.log` |
| 根测试 `pnpm test`（`NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`） | **386 files / 4607 tests passed，Type Errors: no errors，exit 0**（605.63s；基线 381/4540 → +5 文件 +67 tests） | `wiki/raw/task_issue-364_sa3_root_test.log` |
| 全测试树程序级类型检查 `tsc --noEmit -p tsconfig.typecheck.json` | **0 errors** | 最终状态由根 `pnpm test` 的 typecheck 相位复核一致 |
| T1 冻结基线 `npx vitest run packages/vfsl/test/render-projection-text.test.ts` | **144 tests passed**（渲染器零改动） | GREEN 日志含该文件 |
| 收敛门（CT-9 I2）：`readdata-shape-assertion-consolidation-gate.test.ts` | family A/B 归零；四键/五键陈旧正样本命中、schema 投影四元素键集负样本不误伤（24 tests 绿） | GREEN 日志 |
| 文档门（CT-10）：sync-control/sync-red + fixture 双向自控 | 新词汇正样本命中、旧词汇负样本被检出；ADR-0016/0024/0027 权威源门全绿；作用域文档旧词汇扫描归零 | GREEN 日志 |
| 结构面（CT-7 G4 补充，非替代行为锚） | `grep renderProjectionText packages/*/src \| grep -v vfsl/src` → `read-schema-projection.ts`（生产接线）；`grep "# readData" packages/*/src` → 头行在场；`grep detachReadSchemaProjection\|cloneValueSchema\|cloneDocsRecord\|cloneDiscriminator\|cloneNumberRecord\|CloneMemo packages/*/src` → 0 命中 | 本报告（结构面证据行） |
| DENY/版本审计 | `git status --short -- packages/vfsl docs/adr CONTEXT.md packages/doc-runtime apps packages/ws-replication package.json pnpm-lock.yaml vitest.config.ts tsconfig*.json` → 空；无版本号改动 | 本报告 |
| 反向探针（实现期发现并修复）：prototype 污染下的 canonical 等价 | 头行轴值改为 **own 属性读取**（`ownAxis`），修复前 `Object.prototype.maxChildrenPerNode` 会泄露进头行（F3/C5 假红）；修复后 F3/C5 全绿 | G 组/F 组矩阵 |

## Deferred verification

- **SA6 §12.11 M1–M8 突变敏感性全表**：归 SA7（临时改实现→逐突变跑契约→还原并记录击穿面）。iteration 1
  只做了 **1 次受控 M1 sanity probe**（见 §Verification），用于证明绿色非空转；**不替代** SA7 的 M1–M8
  逐条证据，本报告不代跑、不伪造其余 7 项。
- **SA4 审查证据**：clone 符号真实删除的 AST/符号级证据、组合层零 `as` 核对（行为锚已由 CT-7 G1/G2
  承担，G4 结构面为补充）。iteration 1 已有的结构面事实：`grep -rnE 'detachReadSchemaProjection|cloneValueSchema|cloneDiscriminator|cloneNumberRecord|cloneDocsRecord|CloneMemo' packages/` → 0 命中；`read-schema-projection.ts` 内 `as` 0 命中。
- **SA8 实现后冲突复查**（`requiresConflictRecheck: true`）：冻结面 11 项 + CT-8 联合解释落实（联合未合并、零泄漏注释在位）+ §10.4 红线零改动 + 无版本号改动——本报告已列 diff/命令证据供 SA8 逐项复核。
- **SA7 最终动态验证**：含 released lease 的完整生命周期、DSH 探针（仓外，零代码改动）、跨包消费面（`apps/yjs-server` L609、`packages/ws-replication/src/testing.ts` L47 仅 `.ok`/`.value`，根 typecheck + 根测试已证明零改动可编译/可运行）。
- **发布**：破坏性 minor bump 归发布流程（AC10；本票零版本改动）。
- 未在本票处理的 follow-up（设计 §13 R9）：schema 文本缓存、marker 紧凑表示、`ReadDataOkResult` 是否升公共具名导出。

## Deviations or blockers

无阻塞。实施期与契约文本的偏差/精化（均不改验收语义，逐条留证）：

1. **SA6 §14 的 tsconfig 事实不精确**：`packages/namespace-runtime/tsconfig.json`（与 registry 同）只 `include: ["src/**/*.ts"]`，不含 `test/**/*.ts`——测试类型检查实际由根 `pnpm test` 的 `--typecheck`（`tsconfig.typecheck.json`，含 `packages/*/test/**/*.ts`）承担。影响：`.test.ts` 内类型错误不会被 `pnpm typecheck` 捕获；本轮据此在提交前用 `tsc -p tsconfig.typecheck.json` 复检出 3 处新红灯文件类型错误并修复（`oracle` 联合窄化、`expectFailureKeys` 缺 label），最终根测试 typecheck 相位 0 errors。非契约冲突，仅文档精度。
2. **SA6 CT-9 I2 内部措辞张力**：行文同时要求「五键字面量样本必须命中（正样本）」「四键字面量…不得命中（负样本）」与「family A 检测器对四键字面量天然继续命中」。本轮采用唯一自洽读法并写入扫描器头注：`SUCCESS_SHAPE_KEYS` = 当前四键；family B 额外识别**退役五键**（陈旧形状写死即违规，满足「五键样本必须命中」）；family A 对四键/五键字面量天然命中；「四键字面量不得命中」的负样本取 **schema 投影体四元素键集**（`aliasDocs/aliases/docs/valueSchema`，键名不同故不命中）。门语义（未集中化形状断言归零）完整保留。
3. **头行 own 轴读取（实现级加固，设计内）**：设计 §7-D2 指定预算段事实源 = canonical 净化产物（「仅 own-enumerable」）；实现发现直接 `options.depth` 会经原型链读入 `Object.prototype` 污染（C5/F3 canonical 等价假红），故 `headLine` 以 `ownAxis`（own 属性 + present-undefined ≡ 缺席）读取。不新增机制、不改契约。
4. **W1 对齐落地**：空路径头行按 SA6 C1/附录 B 操作性口径 = `# readData []`（设计 §7-D2 冻结）；附录 A 伪公式字面代入 `[[]]` 未采用（SA8 W1 已登记该对齐程序）。
5. **O3 未采纳**（fixture 谓词不改名），理由见 SA2 Finding 表。
6. **文档 caveat（O1）以英文段落加入 `typed-access.md`**（该文档主体为英文），措辞镜像 `CONTEXT.md` 截断省略词条；J4 扫描与 J5 正向门均通过。
7. **iteration 1 复核观察（非缺陷、未修改）**：`runtime-readdata-projection-text-control.test.ts` 头注声明
   「三层负控（旧实现与目标实现下都必须绿）」，但其中负控层 2 首条用例含 `expectReadDataOkKeys(success)`
   与 `code`/`truncations` 缺席断言——它们在旧实现下会红（属目标形状断言）。断言本身正确且必要（与 SA6
   附录 C 的「负控/回归锚」定位及设计 Step-1c「全测试面翻转」一致），故 iteration 1 不做修改；仅头注措辞
   略宽，记录供 SA4/SA7 知晓。
8. **iteration 1 无实现级修正**：独立复核（R1–R7）未发现设计偏离、契约缺口或残留伪形，因此本轮不改写
   任何实现/测试/文档内容；新增写入仅本报告的迭代更新 + 3 份 iteration 1 证据 log。

## Suggested commit message

```
fix(#364): T2: readData 投影文本化原子切换——恒四键、✂ 单一截断载体、组合层退役（ADR 0027 决策 1/4）

- readData 成功分支坍缩为单一四键形 { ok, value, schema: 投影文本 string|null, truncated }；
  结构化 truncations 键退役（截断事实唯一载体 = 文本内 ✂ 段）
- 组合层前贴头行（实参 path + canonical 有效预算）+ renderProjectionText 正文 + ✂ 段；
  头行轴值 own 属性读取（防原型链污染）
- 投影 detach 深拷贝层退役（clone 家族删除；文本原始值天然 detached，每次读重新渲染）
- 两联合成功成员同型（联合名/双重载/零泄漏锁保留）；lease 透传零语义变化
- 退役 ReadLogicalValueTruncationEntry 公共转出（U3 决断）
- 仓内 readData 消费测试/fixture 全家族翻新 + 文档词汇重录（typed-access / cordis / codegen）

验证：新红灯契约 HEAD 红→实现后绿；聚焦 22 files/346 tests、根 typecheck、
根 pnpm test 386 files/4607 tests（Type Errors: no errors）全绿；iteration 1 独立复跑同结果
（含受控 M1 sanity probe 击穿 A2/B1）；无版本号改动、DENY 面零改动
```
