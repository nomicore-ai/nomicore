# SA9 Standards Review — issue #364（T2 readData 投影文本化原子切换）

- 角色：SA9（独立 Standards 审查者）· dispatch `sa-a9f9971a-7826-4639-b4dd-739420563d1b` · iteration 0
- 审查对象：**已提交最终 diff** HEAD `1a72b98caf9cb6683866d3c9740c5cb3224860a4`（"feat(namespace): render readData schema projections as text"，28 业务文件 +1417/−1085 + 5 新测试文件 + wiki/raw 流水线产物），基线 = 权威父 PR #362 head `f8a06fea4285a61bf0f48570b0269d47dfa03fb0`（T1 #363 已合入）
- 审查方式：只读静态审查——逐 hunk 实读生产/文档 diff、grep 符号级独立复核、模块 AGENTS 与 ADR 状态行实读、SA2/SA3/SA4/SA7 产物与证据 log 复读；未运行测试、未修改任何文件（唯一写入 = 本文件）
- Issue #364 REST comments：空（dispatch 明示 none）——无 owner 逐字判据需落实
- 审查范围声明：不审查 issue 需求是否完整实现（归 SA10）；只判仓库/工程标准符合性

## Verdict

**approve** —— 无 BLOCKER、无 MAJOR。实现符合根 AGENTS、runtime/registry/docs 模块 AGENTS、ADR 0027（及被其修订的 0016/0024 延续条款）、单一事实源与生命周期对称性、文件范围纪律与测试质量标准。3 条 MINOR 观察见 §8，均不阻断。

## 1. 代码质量（生产 diff 逐 hunk 复核）

| 检查点 | 独立复核证据 | 结论 |
| --- | --- | --- |
| 组合单点与守卫序保持 | `read-schema-projection.ts`：状态守卫 → `normalizeReadPath` → resolver 两/三参显式分流 → 文本组装，与 HEAD~1 逐位同序；内层 try 仍只包敌意扫描（resolver/renderer 零 catch，`InternalError` 唯一逃逸通道保持并扩盖渲染器，模块头注明文） | 符合 |
| detach 深拷贝层退役 | `detachReadSchemaProjection\|cloneValueSchema\|cloneDiscriminator\|cloneNumberRecord\|cloneDocsRecord\|CloneMemo` 全仓 grep **0 命中**（本审查独立执行）；原 L134–303 整段删除 | 符合（ADR 0027 决策 4） |
| 组合层零 cast（根 AGENTS typed 写纪律 / SA8 约束） | 生产 src diff `^\+.*\bas\b` grep **0 命中**；`ReadLogicalValueTruncationEntry → ProjectionTruncation` 结构同构直传（test-d H6 双向锚） | 符合 |
| 结果类型坍缩（CT-8 解释 / SA8 必行动作 2） | 单一内部 `ReadDataOkResult` 四键形被两联合共用；**两联合名未合并**、重载序 legacy 最后、零泄漏注释（「该联合**不含** READ_OPTIONS_INVALID」）原文在场；`ReadDataOkResult` 未公共导出（无公共面扩张） | 符合（ADR 0024 决策 6 零泄漏保持） |
| 头行规格（设计 §7-D2 冻结；W1 对齐） | `headLine`/`foldSegment`/`ownAxis` 实现与冻结公式逐字一致：空路径 `# readData []`、键序 depth→maxChildrenPerNode、逗号无空格、行注入折叠、`String(n)`；段值取自 `normalizeReadPath` 快照（敌意单读）；`ownAxis` own 属性读取防原型链污染（SA3 Deviation 3 登记的实现级加固，canonical 产物语义不变） | 符合 |
| `truncated` 口径 | 预算分支 `result.truncated` 逐字段透传、legacy 硬编码 `false`；**无 OR 合成**（U2 残差按 SA8 W2 程序登记于设计 §13 R2，未静默改语义） | 符合 |
| U3 公共转出退役 | `index.ts` 删 `ReadLogicalValueTruncationEntry` 转出 + 头注记录理由与替代路径（直依 `@nomicore/doc-runtime`）；SA7 负向类型探针实证 TS2305 闭锁 | 符合（SA8 W3 显式决断程序） |
| registry 透传零语义变化 | `lease.ts`/`types.ts` diff **仅 JSDoc 词汇重录**；`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` Equal 组合锁未出现在 diff（两侧同变仍相等）；released 短路先于透传未动 | 符合（ADR 0009 / registry AGENTS） |
| 失败面/options 闭合形状零变化 | 生产 diff 中 `canonicalReadOptions`/`seamReadOptionsInvalid`/`readDisabled`/lifecycle gate **零出现**；唯一接触点 = 预算成功点多传 `canonical.options` + `result.truncations` 两跳 | 符合（ADR 0024 决策 1/6、ADR 0008 lifecycle 定序） |

## 2. 架构与 ADR 一致性

| 标准 | 复核 | 结论 |
| --- | --- | --- |
| ADR 0027 决策 1/2/3/4 直接兑现 | 恒四键 + `schema: string\|null` + ✂ 单一截断载体 + 头行文法 + detach 退役 + 类型坍缩，逐条在 diff 落地；决策 5（bump 归发布流程）遵守——`git diff -- '**/package.json'` 0 行 | 符合 |
| ADR 0016/0024 历史记录纪律（docs/AGENTS：ADR 不改写，修订须显式登记） | `docs/adr/**` 零改动；0016/0024 状态行的 0027 修订指针系 0027 提交既有；sync-control 的 ADR-0016/0024 权威源健全性门（含旧词汇样本）**保持在场且绿**，并追加 ADR-0027 门（L369/L376/L386 区域实读） | 符合 |
| 模块责任归属 | 头行组装 + renderer 接线 + 清单喂入 = namespace-runtime 组合层单点（ADR 0027 决策 2「组合层前贴头行」）；vfsl 渲染器/doc-runtime 值通道/registry 透传全部零触碰 | 符合 |
| runtime AGENTS 边界 | 读在 FIFO sequencer 外（未动）；公共面只暴露 detached 投影——文本 string 原始值天然 detached，隔离不变量由形态保证（G1/G2 行为锚替代旧冻结/引用断言，G3 退役程序合规）；handle/Y.Doc/sequencer 仍包内 | 符合 |
| registry AGENTS 边界 | 公共 API 只经 `src/index.ts`（registry index 零改动）；lease 独立 capability、release 幂等、released 短路语义未动 | 符合 |
| 单一事实源 | 截断事实：值通道 `result.truncations` 单点喂入渲染器 → ✂ 段交付（无第二清单/合成）；有效预算：`canonicalReadOptions` 产物单源进头行；活 schema：live derived 每次读重新 resolve+render（零缓存零 memo，B4/G2 锚） | 符合 |
| 生命周期对称性 | 无新增资源获取/释放面；无缓存、无订阅、无句柄；lease release 幂等与短路保持；`InternalError` 逃逸不留部分状态（渲染器无部分输出） | 符合 |
| 平行机制检查 | 无第二渲染通道/第二截断清单/第二 options 解析/新公共 API 面（`ReadDataOkResult` 具名导出列为 follow-up 而非本票扩张） | 符合 |

## 3. 测试质量

| 标准 | 证据（独立复核） | 结论 |
| --- | --- | --- |
| 先红后绿真实性 | `task_issue-364_sa3_red.log`（未改生产的 HEAD：22 failed / 16 passed，失败签名 = 多 `truncations` 键 / `schema` 为 object / `startsWith` 非函数——红点可归因目标面）；green/typecheck/root-test log 时间序自洽（SA3 R4 stat 复核）；SA6 E2 HEAD 探针 + SA3 受控 M1（复挂 `truncations` 即击穿 A2/B1/B3，sha256 还原）+ SA7 M1–M8 全表（8/8 击穿对应 CT 组 + sha256 全 OK）三重闭环 | 符合 |
| 断言纪律（只观察公共接缝；oracle 独立构造；不 skip/only/todo/env/fallback/吞错） | 新契约 5 文件 grep 无 skip/only/todo 实调用；oracle 全公共 API 独立编译 derived（`compileSchemaEnvelope → resolveSchemaAtPath → renderProjectionText`），B5 反向锚（改 derived 注释 → 期望串必变）防伪绿；装置前提 fail loud（模块级 throw / `okOrThrow`） | 符合 |
| 负控保持与强化 | 失败分支字面断言保持（A4/E 组）；`@ts-expect-error` **删 0 / 增 41**（本审查对全 diff 计数）；收敛门四键正样本 + 退役五键正样本（陈旧形状写死即违规）+ schema 投影体四元素键集负样本不误伤；`filesScanned ≥ 80` 防仪器空转 | 符合 |
| 类型面锁（CT-8） | test-d H1 四键 keyof Equal ×2 + 两联合成功成员同型 / H2 `string\|null` 精确 / H3 `Extract<…,{truncations:unknown}>===never` / H4 lease 组合锁镜像（registry test-d）/ H5 doc-runtime 保持性守卫 / H6 零 cast 可赋值——`--typecheck` 全绿 | 符合 |
| 生产装配覆盖 | registry 红文件用 `createNamespaceRegistryForTesting` 真实装配（非内部 seam 替身）；透传引用同一性/released 恰三键/装配 `toStrictEqual(direct)` 锚保持 | 符合 |
| 消费面零遗留 | 存量 20 文件翻新 + helper 随动组 7 文件零编辑通过（125 tests）；phase5 L271 两键伪形 → 四键（建议同步项已做）；残留 `.truncations` 仅值通道 oracle 与 `@ts-expect-error` 负例 | 符合 |
| 门禁 | 根 `pnpm typecheck` exit 0（14 tsconfig，`…_iter1_typecheck.log`）；根 `pnpm test`（`--typecheck`）**386 files / 4607 tests / Type Errors: no errors / ROOT_TEST_EXIT=0**（clean 轮 `…_iter1b_root_test_clean.log`，基线 381/4540 → +5/+67 逐项一致）；聚焦 22 files / 346 tests 绿；T1 渲染器 144 tests 冻结基线两轮绿 | 符合（runtime/registry AGENTS「契约变更前必跑根门禁」） |

## 4. 文档质量

| 标准（docs/AGENTS） | 证据 | 结论 |
| --- | --- | --- |
| 行为改变时同步全部契约文档；不发明实现行为 | 三作用域文档（typed-access / cordis-plugin-hosting / external-project-vfsl-codegen）重录为投影文本词汇；cordis 样张的 `‡` 页脚与 `✂ 截断事实：` 条目格式（`- meta · depth · 省略 2 项`）经本审查与渲染器常量（`TRUNCATION_FOOTER`/`TRUNCATION_HEADER`/`renderTruncations` L994–1002）**逐字比对一致**——样张真实可复现 | 符合 |
| 链接权威源而非复制规则 | 三文档均挂 ADR 0027（交付形态）+ 0016/0024（语义/预算）双引用；相对链接路径实核存在（`.agents/skills/nomicore/../../../docs/adr/0027-…`、`docs/integration/../adr/0027-…`） | 符合 |
| CONTEXT.md 词表权威 | CONTEXT.md 零改动（0027 提交已写完投影文本/✂ 段/截断省略/形状预算词条，L42–58 实读在场）；typed-access 的 null×预算 caveat 明示镜像 CONTEXT 截断省略词条——引用属实 | 符合 |
| 锚定句保留 | typed-access 预算纪律句 `Typed budget discipline (ADR 0024 decision 7): …` HEAD~1 L128 与 HEAD L127 **逐字节一致**（本审查双版本 grep 比对）；fixture `hasBudgetDisciplineParagraph` 四正则锚定该段 | 符合 |
| 文档负控双向敏感 | fixture 六谓词重录（R3′/R4′、`staleAnnotationViolations` 双向修复、`adr0016Refs` 放宽为 0027 ∧ 0016/0024、新增 J4 `retiredVocabularyViolations`）；sync-control/red 正负样本双向重录（新词正样本命中、旧词负样本被检出）防关键词空转 | 符合 |
| 旧词汇清退 | 三作用域文档 grep `truncations\|恒五键\|valueSchema\|aliasDocs\|detached deep`（排除 ✂ 行）**0 命中** | 符合 |

## 5. 范围纪律（ALLOW/DENY 机器核对）

- 33 个业务/测试/文档改动路径**全部命中**设计 §11 ALLOW LIST（SA3/SA4 机器比对，本审查对 `git show --stat` 复核一致）；ALLOW 中仅 helper 随动组 7 文件零编辑通过（设计预判「调用点零改或小改」，属说明项）。
- DENY 零改动（本审查独立 grep HEAD stat）：`packages/vfsl/**`、`packages/doc-runtime/**`、`docs/adr/**`、`CONTEXT.md`、根/包 `package.json`、`pnpm-lock.yaml`、`vitest.config.ts`、`tsconfig*.json`、`apps/yjs-server/src/**`、`packages/ws-replication/src/**`、写路径/诊断包/registry index——全部不在 diff。
- 无版本号改动（AC10 / ADR 0027 决策 5：破坏性 minor bump 归发布流程）；`git diff --check HEAD~1 HEAD` exit 0（无空白错误）。

## 6. 生成物与类型工件

- 无 codegen 产物涉入（本票为运行时使用面切换，不动 `domains/*/schema.vfsl` 与 `generated.ts` 链）；类型面工件 = 7 个 `.test-d.ts`（2 新 + 5 翻新），由根 `pnpm test --typecheck` 与 `tsconfig.typecheck.json` 双通道锁死；SA3 Deviation 1 修正了 SA6 对 tsconfig 测试覆盖的不精确表述并以 `tsc -p tsconfig.typecheck.json` 复检 0 errors——程序合规、留证完整。

## 7. 交付卫生

- 原子提交：实现 + 测试 + 文档 + 流水线证据（wiki/raw 设计/评审/报告/log）同票落地，与「原子切换、不留中间态」的票旨及类型锁（半截不可编译）一致；commit message `feat(namespace): …` 符合仓内 `type(scope):` 风格。
- 工作树残留 = 4 份 untracked wiki 证据（task brief + iteration-0 red/green/M1-probe log），属流水线产物区，与既往任务证据管理惯例一致；无 `zz-*` 探针/临时文件残留（SA3 R6、SA7 §7 收尾核验 grep 0）。
- SA8 `requiresConflictRecheck` 程序闭环：设计期 true → 实现后复查 `task_issue-364_implementation_conflict_report.md` clear（冻结面 14 项零改动）→ SA4 独立复核一致；本审查未发现新的 ADR 冲突面。

## 8. Non-blocking observations（MINOR，不阻断）

| # | 观察 | 证据 | 处置建议 |
| --- | --- | --- | --- |
| M1 | 提交信息未带 `(#364)` issue 引用——同族提交（`fix(#363): T1: … (#371)`、`fix(vfsl): … (issue #359) (#360)`）多带引用；仓内无成文 commit 规约（无 commitlint），不构成违标 | `git log` 对照 | 信息性登记；finalize/PR 标题层补齐即可 |
| M2 | control 文件头注「三层负控（旧实现与目标实现下都必须绿）」措辞略宽：负控层 2 首条含目标形状断言（旧实现下会红）。SA3 Deviation 7 / SA4 MINOR-1 已登记，断言本身正确且必要（与 SA6 附录 C 定位及设计 Step-1c 一致） | `runtime-readdata-projection-text-control.test.ts` L5–13 vs L98–101 | 后续维护收窄头注措辞（非本票义务） |
| M3 | iteration-0 red log（21:44:48）早于部分测试终稿（≤21:55:11）——红灯证据对应中间测试态；红→绿性质已由 SA6 E2 HEAD 探针 + SA3 受控 M1 + SA7 M1–M8 全表 + clean 轮根测试（22:19–22:29，0 failures）独立闭环 | stat 时间戳 + 各 log | 信息性登记；不影响证据链有效性 |

## 收尾

- 本审查未修改代码、设计或测试；未运行测试、未启动服务；唯一写入 = 本文件（`wiki/raw/task_issue-364_sa9_standards.md`）。
- SA2（approve，O1–O6）/ SA4（approve，MINOR-1..4）/ SA7（approve，M1–M8 全表闭合）的上游裁决经本审查独立复核均成立；O1–O6 处置在实现 diff 中逐条可见（O1 caveat 在场、O2 C6 未断言可区分性、O4 内容锚、O5 helper 三参缺省、O6 夹具键域无 `truncations`）。
- 结论：当前实现符合仓库 AGENTS、ADR、模块责任、既有架构惯例、单一事实源、生命周期对称性、文件范围与测试质量标准——**approve**。
