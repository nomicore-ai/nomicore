# SA8 冲突门禁报告 — Issue #405 实现与文档交付前复审（implementation 复查）

- 派发：`sa-312ef64e-e081-4b94-8def-0902d1d1a13e`（role `mabf-sa8`，phase `conflict-gate`，iteration 3）
- Worktree：`/home/wangjian/nomicore-fix-issue-405`（branch `mabf/issue-405`，HEAD `fc6c1d3a4d…` = ADR 0031 入仓提交，与决策集快照一致）
- 本报告为该票**实现后复审**（SA8 设计门禁 iteration 2 的 RA-D4 落点）：被审对象 = 当前工作区变更集（生产代码 + 契约测试 + Phase B 文档）与定稿上游产物（SA3 报告 iteration 2、SA4 审查 `approve`、SA2 审查 `approve`、SA6 契约 rev2）。前三次门禁（iteration 0 前置门禁 → `reject`；iteration 1 设计复查 → `clear`；iteration 2 设计复查 → `clear`）的结论已折入处置核对，不堆叠为当前裁决。
- Issue-comment REST 快照为空（简报 Comments 段空、派发说明一致、SA6 §2/SA8 前次报告三方一致）——无 owner 评论，无 override 来源。

## 1. Reviewed subject

**implementation** —— 当前 diff（7 modified + 5 新契约/夹具文件 + Phase B 三文档）+ 上游定稿产物。复审焦点（设计门禁 RA-D4 指定 + 本次实读核对）：

1. **readData 公共 API 扩张**：options 三键闭合形状 + 预算联合追加 `READ_BUDGET_EXCEEDED` 五键分支（§3 行 1/2/4）。
2. **失败语义优先序**（DD-8 阶梯）：lifecycle > G0 路径拒 > options 校验（`maxBytes` 域/两轴/未知键）> 值通道失败 > 预算判定（§3 行 4、§5 表 7）。
3. **D1/D3/D4 落地选择**与 DENY 面/§12.6 零 diff（git diff 证据，§5 全表）。
4. **OBL-DOC-1 兑现形态**（Phase B 三文档重录，同迭代落地，§3 行 7）。
5. **RA-D1（split 读次序 parity）/ RA-D2（B11 锁同变更集）** 的实现期结构条件闭合（§3 行 15、§8 处置表）。
6. **实现自引入的微偏离**（S2b-0 fail-loud 不变式守卫 throw）是否触碰「同步结果联合、不抛」冻结面（§3 行 16）。

本报告不评价实现质量、测试充分性或性能（SA4/SA2/SA6 维度，均已 `approve`）；只裁决与既有决策集的冲突。

## 2. Inputs and decision set

- 输入：`wiki/raw/task_issue-405.md`（简报，Comments 段空）、`task_issue-405_design.md`（SA1）、`task_issue-405_sa6_contract.md`（rev2，验收权威——wiki/raw 属证据非规范契约，但其 pins 编码 ADR 派生义务）、`task_issue-405_sa2_review.md`（`approve`，MINOR-1–4）、`task_issue-405_sa3_impl.md`（iteration 2）、`task_issue-405_sa4_review.md`（`approve`，MINOR-1–6）、`task_issue-405_relevant_decisions.md`（决策集快照 = HEAD `fc6c1d3`，本次逐条复核仍准确）。
- 决策集：`docs/adr/**` 全集（31 篇全部「已接受」，无整篇 superseded；**ADR 0024/0027 状态行的 0031 再修订链本次实读复核在案**——0024 状态行「决策 1 的 options 形状与『终态目标的预算是 no-op』条款由 ADR-0031 再修订…开放问题『字节级预算』由 ADR-0031 收口」、0027 状态行「决策 1 的『options 闭合形状零变化』句由 ADR-0031 再修订（+`maxBytes` 预算轴，三键闭合）——头行、✂ 段与渲染器条款不动」）；`CONTEXT.md`「字节预算」词条（含 `_Avoid_` 全家）；`docs/AGENTS.md` + `packages/{namespace-runtime,namespace-registry,doc-runtime}/AGENTS.md` 收录纪律；`docs/adr/0031` 为母法。
- 实读核对对象（当前 diff 全量）：`packages/namespace-runtime/src/runtime.ts`（+307/−39）、`src/index.ts`（+9 纯注释）、`packages/namespace-runtime/test/{issue-405-maxbytes-fixture.ts, issue-405-maxbytes-red.test.ts, issue-405-maxbytes-control.test.ts, issue-405-maxbytes.test-d.ts, runtime-readdata-shape-budget.test-d.ts}`、`packages/namespace-registry/test/{issue-405-lease-maxbytes-passthrough-red.test.ts, issue-405-lease-maxbytes-surface.test-d.ts, registry-readdata-budget-passthrough.test-d.ts}`、Phase B 三文档 diff。
- DENY 面零 diff 实测（本次 `git diff --stat HEAD -- <DENY 路径>` 全空，exit 0）：`packages/doc-runtime`、`packages/vfsl*`、`packages/namespace-runtime/src/read-schema-projection.ts`、`src/window-read.ts`、`packages/namespace-registry/src`、`CONTEXT.md`、`docs/adr`、`vitest.config.ts`、`tsconfig*.json`、`apps`、根 `package.json`。
- 环境事实：`git status --porcelain --untracked-files=all` 去掉 `wiki/**`、`artifacts/**` 后恰为 13 条实现路径（与 SA1 §11 ALLOW 清单逐条对齐，无越界）；`git diff --check` exit 0；`window-read.ts` options 键空间实读仍为五键（`n/orderBy/depth/maxChildrenPerNode/where`，L262–272 区）——`maxBytes` 落未知键 → `WINDOW_OPTIONS_INVALID`（D6 递延期守卫零改动自然保持）。
- 运行证据：`artifacts/sa3-issue405-verification.log`（SA3 独立复跑：红灯基线 14 failed/14 passed 红因单一；契约族 9 files/70 tests 绿；包内 130 files/1258 tests；root `pnpm typecheck` exit 0；root `pnpm test` 417 files/5055 tests exit 0；doc-sync 门禁 43/43；变异探针 M1/M2/M3 各自被捕获）——本门禁不运行测试，该日志作为「实现后事实」的证据采纳，冲突裁决仍以决策文本与源码实读为准。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（当前 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0031 决策 1（域句） | 「`maxBytes?: number`：≥1 的有限整数（≤ 2^53−1）；`0`、负数、非整数、非有限数、未知键 → 既有 options 校验码响亮拒绝…缺席 ≡ 不设预算…不内建任何魔法默认」 | `NamespaceRuntimeReadDataOptions` 三键闭合 interface（runtime.ts L167–171）；split（L1237–1262）与 canonical（L1127–1175）双处同判据 `typeof v === 'number' && Number.isSafeInteger(v) && v >= 1`；域外（0/负/1.5/NaN/Infinity/string/`2^53`/`2^53+2`）→ `READ_OPTIONS_INVALID`、域顶 `2^53−1` 接受、`{maxBytes:1}` 报预算码而非校验码（G5 组级判据：拒绝锚 ∧ 接受锚同组，red 测试 L317–367 实读）；缺席/present-undefined/非 enumerable ≡ 无预算（split `value === undefined → continue`、canonical 同；G10 断言） | **implements-existing-decision**（设计门禁挂的「实现后核对」本次闭合） | ADR 0031 L16–17；runtime.ts L167–171/L1237–1262/L1127–1175；red 测试 G5 | 无 |
| 2 | ADR 0031 决策 1（校验码词表） | 「各面**既有** options 校验码响亮拒绝…**不新增校验码**」 | `budgetAxisInvalid` 返回成员类型注解 = `ReadLogicalValueBudgetFailure`（`Extract<doc-runtime 预算联合, {ok:false}>`——形状单源）；唯一新码 `READ_BUDGET_EXCEEDED`（决策 3 明文授权）；不借 `PATH_NOT_ALLOWED`/`RUNTIME_READ_DISABLED`（G10「校验先于度量：`{maxBytes:0}` → READ_OPTIONS_INVALID 不得报预算码」锚） | **implements-existing-decision** | ADR 0031 L16；runtime.ts L1281–1287；red 测试 G10 L414 | 无 |
| 3 | ADR 0031 决策 2（规范度量） | 值通道 `utf8(JSON.stringify(value))`（紧凑、键序 = 交付序、`undefined` 计 0）+ schema 通道投影文本 UTF-8（✂/头行自然计入、`null` 计 0）；「整体序列化即度量」；「账本不进公共面（成功面恒四键不变，不新增 bytes 键）」 | `deliveryBytes`（L1298–1303）= `(value===undefined?0:Buffer.byteLength(JSON.stringify(value))) + (schemaText===null?0:Buffer.byteLength(schemaText))`——构造性等式、零镜像代码；闸门在 `projectReadDataSchema` **之后**（L829–840：先 `schemaText` 组装再度量——度量对象 = 塑形后交付物）；成功面恒四键（组装体 L842–846 不加 bytes 键；类型锁 `_budgetOkKeys` 恰 `ok/value/schema/truncated`）；G4 度量等式 property 以同参无预算读**独立两通道 oracle** 锚定 | **implements-existing-decision** | ADR 0031 L21–25；runtime.ts L829–846/L1298–1303；red 测试 G4；test-d L71–73 | 无 |
| 4 | ADR 0031 决策 3（超限零交付） | 五键失败分支、`measuredBytes` 只报合计、`≤` 判定（恰好等于成功）、不裁剪不降深不拟合、成功交付物与无预算读逐字节相同 | `readDataBudgetExceeded`（L1311–1327）恰五键 `{ok:false, code, path, measuredBytes, message}`、`echoReadPath` 新鲜回显、message 不含面标识（三面同文靠调用现场）；闸门 `measuredBytes > canonical.maxBytes` 才拒（`≤` 含恰好等于与零总量收——G2 五锚 total 收/total−1 拒成对、R8 零总量 `maxBytes:1` 收）；逐字节一致（G1 `toStrictEqual` 四键全等 + G8 schema 逐字节）；类型面零成功键锁（`_exceededNoSuccessKeys`/`_exceededNoSchemaKey`/`_exceededNoTruncatedKey`） | **implements-existing-decision** | ADR 0031 L29–38；runtime.ts L834–840/L1311–1327；red 测试 G1/G2/G3/G8；test-d L41–60 | 无 |
| 5 | ADR 0031 决策 4（分层落点 + 零变化清单） | 「校验与度量住 `@nomicore/namespace-runtime` 组合层…doc-runtime **零改动**（下传 options 仍为两键）；registry lease 结果类型与 options 类型别名跟随透传」；「恒四键成功面、✂ 文法、投影文本渲染器、头行文法（**不记 maxBytes**）、`DeepOptional` 类型面、无 options 逐字节行为：全部零变化」 | 全部生产改动集中 `runtime.ts`（+307/−39）+ `index.ts` 注释；doc-runtime/vfsl/渲染器/窗口面/registry `src/**` git diff 全空（本次实测）；canonical 产物 `options` 恒两键（`maxBytes` 下传前剥离——`ResolveSchemaBudgetOptions` 类型 + L1158 `continue` 分离，头行结构上不可能记录 `maxBytes`，G8 断言 `schema.includes('maxBytes') === false`）；registry 源码零改动、`_readBudgetAlias`/options 跟随锁原位扩展（`registry-readdata-budget-passthrough.test-d.ts` +45：`_runtimeOptionsClosedShape`/`_budgetExceededAliasFollow`/`_budgetExceededShape`/`_budgetExceededNoSuccessKeys` + `lease.readData([], {maxBytes})` 调用点 + 第四键 `@ts-expect-error`） | **implements-existing-decision** | ADR 0031 L42–43；git diff --stat 全空实测；runtime.ts L1127–1175；registry test-d diff L93–165 | 无 |
| 6 | ADR 0031 决策 5（边界） | 「缺席目标的读同样可能超限报错…投影文本照常在场…照常计量」；「终态目标不是预算 no-op」；「where 过滤窗口无语义对撞」 | 闸在投影之后、`value === undefined` 计 0 由构造保证（G6：`['nick']` × `maxBytes:26` 拒 measured 27 / 27 收，value 键恒在场为显式 undefined、schema 非 null）；`schema:null` 计 0（G3 单通道锚 R9）；窗口面零触碰（G11 递延期守卫） | **implements-existing-decision** | ADR 0031 L47–49；runtime.ts L1298–1303；red 测试 G6/G3 | 无 |
| 7 | ADR 0031 决策 6 + 「验收」文档负控行 + `docs/AGENTS.md` Editing 规则（OBL-DOC-1） | 「指引进 typed-access 纪律与作用域文档」；「作用域文档词汇重录——`maxBytes` 语义在场、『归调用方字节闸』措辞清退」；「When code behavior changes, update every normative document whose stated contract changed」 | Phase B 三文件重录**已落地且与本变更集同迭代**：① `typed-access.md`——L125「only the two budget keys」句清退为三键（本次 diff 实读）+ 新增「Byte-budget reads: `maxBytes`」小节（域/总量等式/≤ 逐字节相同/五键零交付/塑形后计量/缺席目标/决策 6 分工/确定性重试/「✂ 段不是找字节事实的地方」）；② `cordis-plugin-hosting.md`——预算读注释段三键化 + maxBytes 收/拒语义 + 五键词汇 + 分工句；③ `external-project-vfsl-codegen.md`——readData 结果段补三键 options 与预算失败分支词汇；「归调用方字节闸」措辞三文件 grep 全空（本次实测 exit 1——与前次「真空」结论一致）；doc-sync 门禁 43/43 绿（SA3 日志 §[3]）；ADR/CONTEXT 零触碰正确（HEAD 已自洽） | **implements-existing-decision** | ADR 0031 L53/L76；`docs/AGENTS.md` Editing；三文档 diff 实读；grep 实测 | 无（scanner 滞后见行 18 / RA-I3） |
| 8 | ADR 0031「验收」节（主接缝/度量 property/lease 透传断言/门禁） | 「全套门禁 + root `pnpm typecheck` / `pnpm test`；发布随 minor bump」 | 契约族 9 files/70 tests、包内 `tsc`×2 + vitest `--typecheck` 130 files/1258、root typecheck exit 0、root test 417 files/5055（= 基线 412/5021 + 5 files/+34 tests）、零 skip/only/todo、`git diff --check` exit 0（SA3 日志 §[2]–[5]，本次以日志为证据采纳）；红灯基线复现红因单一（12 条均 `READ_OPTIONS_INVALID`「未知键：maxBytes」）；**minor bump 为发布时动作，未随 diff 落地**（`namespace-runtime` 版本未动）——登记 RA-I2，不构成本变更集冲突 | **implements-existing-decision**（门禁面；发布 bump 见 RA-I2） | ADR 0031 L73–77；`artifacts/sa3-issue405-verification.log` | RA-I2（发布门） |
| 9 | ADR 0031 决策 1/3 窗口面三面义务 + ADR 0028（`WINDOW_OPTIONS_INVALID`）+ ADR 0029（where ✂ 永不装配）——OBL-WIN-1 | 三读面 options 追加 `maxBytes`、三面同码同文同载荷 | 本票（issue 标题与正文均限定「readData 面」）不动窗口面：`window-read.ts` 零 diff、键空间仍五键 → 携 `maxBytes` 维持 `WINDOW_OPTIONS_INVALID`（G11 锚定，control 测试 L197–212）；message 常量 `READ_BUDGET_EXCEEDED` 文案已冻结为窗口面票逐字镜像基准（L1311–1327 JSDoc 明记）；SA6 §3.3 台账 OBL-WIN-1 保持 open 可追溯 | **no-conflict**（递延登记在案，非本变更集义务；兑现时独立票自带门禁） | ADR 0028 L67；ADR 0031 L16/L24/L36；`window-read.ts` 实读；G11 | RA-I1（独立票） |
| 10 | ADR 0027（修订链后） | 决策 1 options 句已修订三键；恒四键、✂ 唯一载体、`schema:null` 单义；决策 2 渲染器零选项纯函数；决策 3 头行/✂ 文法 | 成功面恒四键零漂移（G8 双侧：带 `maxBytes` 侧 schema 逐字节 === 无预算侧 + 头行不含 `maxBytes` 字样 + `# readData [] {depth:1}` 文法冻结）；`read-schema-projection.ts`/`packages/vfsl/**` 零 diff；legacy 联合 `NamespaceRuntimeReadDataResult` 零变化（diff 中仅 BudgetResult 联合追加成员；`_legacyNoBudgetCode`/`_legacyNoMeasuredBytes` 零泄漏锁 + `_legacyReturnType` 末签名锁延续） | **no-conflict** | ADR 0027 状态行 + L20–31；git diff 全空实测；test-d L63–78；red 测试 G8 | 无 |
| 11 | ADR 0024（修订链后） | 决策 1 options 三键 + 终态 no-op 例外注记；决策 2（amendment）E1 输出端 undefined 吸收纪律；决策 6/7 三参公共面/lease 透传/`DeepOptional` | 实现按三键口径工作（行 1）；终态锚参与计量断言（G4 锚表含终态/raw 变体）；值面零触碰（E1 不动——失败分支不含 value、成功面 value 纪律不变）；doc-runtime 三参公共面零改动（`keyof ReadLogicalValueAtPathOptions` 恰两键硬锁 + G11 doc-runtime 直调 `{maxBytes:1}` → `READ_OPTIONS_INVALID`） | **no-conflict** | ADR 0024 状态行、L26–45；test-d L81–86；control 测试 G11 | 无 |
| 12 | ADR 0008 + runtime/registry/doc-runtime AGENTS | 「Reads stay outside that sequencer」；同步结果联合；lifecycle 停接纳稳定码先于一切 options 触达；公共面只暴露 detached 投影；lease 独立调用方能力、公共 API 仅经 `src/index.ts` | `readData` 仍为同步纯函数、零缓存零订阅零状态写入、不进 sequencer（组合体实读）；S1 lifecycle gate 在 options 首次触达之前（代码序静态核实 + G10「closed/closing 期 Proxy → `RUNTIME_READ_DISABLED`、get trap 0 次」）；registry 公共面零改动（src 零 diff、`index.ts` 未触碰） | **no-conflict** | ADR 0008 L16–18/L123；三个包 AGENTS；runtime.ts L769–790；red 测试 G10 | 无 |
| 13 | ADR 0023 + 公共导出面纪律（issue #93 值导出审计） | 公共面演进可控、值导出键集审计锚定 | `index.ts` **仅注释增量**（+9 行 `#405 增量` 说明；导出语句区零改动——diff 实读）；新失败成员 `ReadDataBudgetExceededResult` 为导出类型（interface，非值导出）且经既有按名导出的联合结构可达；值导出面仍恰 `RuntimeWriteFatalError` | **no-conflict** | ADR 0023；index.ts diff 实读；`runtime-acceptance-exports-audit.test.ts`（未触碰，DENY 外既有锚） | 无 |
| 14 | CONTEXT.md 词条（字节预算/形状预算/截断省略/✂/投影文本/窗口读） | 零交付、稳定码、合计载荷、不裁剪、逐字节相同、缺席可超限、三面同码同文；`_Avoid_`：字节截断/部分交付/maxBytes 当第三轴替身/✂ 找字节事实/载荷拆分分项 | 实现语义与词条逐点一致（行 1–6）；`_Avoid_` 全家排除：无裁剪路径（超限即整体拒绝）、无部分交付（零成功键锁）、`maxBytes` 不进头行/不塑形（canonical 剥离）、失败分支无 ✂ 装配、`measuredBytes` 只报合计；Phase B 文档措辞与词条一致（「the `✂ 段` is never the place to look for byte facts」） | **no-conflict** | CONTEXT.md L48–58（字节预算/形状预算词条，fc6c1d3 实读）；runtime.ts L834–840；typed-access.md 新小节 | 无 |
| 15 | ADR 0024→0031 修订链 × B11 既有类型锁（RA-D2） | 「修订链在两 ADR 状态行在案；锁期望随修订链演进；同变更集 + 相邻注释同步」 | `runtime-readdata-shape-budget.test-d.ts` L86–96：两键 `_optionsAlias` 锁**原位**改 `_optionsClosedShape` 三键闭合锁，**相邻注释同步重写**（新注释如实陈述「#364 时曾是 doc-runtime 两键单源别名——三键化后该别名形态不再成立…doc-runtime 两键面由 `keyof` 硬锁独立锚定」）；与类型变更同变更集（同一 diff，无中间红态）；`runtime.ts` L153 同款失真注释一并清退（diff 实读） | **implements-existing-decision**（锁期望跟随已登记修订链——设计门禁行 15 裁决的实现闭合） | ADR 0024/0027 状态行；ADR 0031 L57–58；两文件 diff 实读 | 无（RA-D2 闭合） |
| 16 | 失败语义冻结面 × 实现自引入微偏离（S2b-0 fail-loud 不变式守卫 throw；SA3 Deviation 6、SA4 §4 已裁「一致」） | ADR 0024 决策 1「响亮拒绝…（同步、不抛）」；ADR 0027/接口 JSDoc「敌意 options…绝不外抛」；runtime AGENTS「同步结果联合」 | S2b-0 分支（runtime.ts L791–798）：非数组 path → 2 参直调 doc-runtime G0 单源拒绝、零 options 读取（F6 定序保持）；其后的 `throw new Error('readData: 非数组 path 未被 doc-runtime G0 守卫拒绝（不变式破坏）')` 仅在 **G0 竟接受非数组 path** 时可达——doc-runtime `read.ts` L133–136 `if (!Array.isArray(path)) return notAllowed(...)` 对一切输入恒拒 ⟹ 该 throw **结构不可达**，属可信域不变量守卫（与投影面 `InternalError` 逃逸同族），非输入面失败分类通道；对一切调用方可观测输入（含敌意 options/path），失败仍全数同步结果联合 | **no-conflict**（如实登记的微偏离；不改变任何决策文本约束的输入面语义） | doc-runtime read.ts L133–136（G0 恒拒实读）；runtime.ts L791–798；F6 锚复跑绿（SA3 日志） | 无 |
| 17 | SA6 契约 G5 第四键行字面 vs DD-2 中继机制（SA3 Deviation 3、SA4 MINOR-2） | SA6 §12.3 G5 该行 message 字面「含 maxBytes 域标识」；DD-2/ADR 无「message 必须命名 maxBytes」条款（message 为非契约诊断字段——doc-runtime L60 先例） | 实现按 DD-2：`{maxBytes:1, nope:1}` 由 T1 以「未知键：nope」单源拒绝（中继保留未知键），red 测试断言「与 `{nope:1}` 同源」；域区分断言施加在域外值矩阵（8 例 message 含 `maxBytes` 且与未知键 message 不同）——SA4 裁决实现侧正确、组级判据（HEAD 红/实现后绿）不受影响。SA6 为 wiki/raw 证据非规范契约，且其字面若施加将迫使复制 T1 message 或回退 HEAD 未知键路径（均被 DD-2/ADR 纪律否决） | **no-conflict**（契约字面张力已在 SA4 裁决收口；无决策文本被违反） | red 测试 G5 (2) 段实读；SA4 §12 MINOR-2；doc-runtime message 非契约字段先例 | 无（SA6 契约下次触碰时改写该行——SA4 建议在案） |
| 18 | readdata-docs 夹具扫描器 `BUDGET_OPTION_KEYS` 两键白名单（SA3 Deferred #4 / SA4 MINOR-4 递延项） | 无决策文本约束该测试夹具词表（ADR/CONTEXT/协议均不收录 scanner 白名单；`docs/AGENTS.md` 只约束规范文档同步——三文档已同步） | `readdata-docs-adr0016-contract-fixture.ts` L182 白名单仍两键、文件零触碰（不在本票 ALLOW/DENY 任一清单授权面）；Phase B 文档措辞使全部 `readData(...)` 调用字面保持两键形态 → 门禁 43/43 绿（SA4 静态求值 0 违规）；后果：`maxBytes` 语义在场性暂不由该门禁机器强制（人工内容核验兜底，本次已核），且 scanner 三键化前 SCOPE_DOCS 不能出现 `readData(x, {maxBytes})` 调用字面而不触闸 | **no-conflict**（测试基建递延，非规范文档失真；已登记 follow-up） | fixture L182/L190–207 实读；SA3 Deferred #4；SA4 MINOR-4 | RA-I3（后续票） |

裁决分布：**no-conflict 10 项、implements-existing-decision 8 项、evolution-required 0 项、hard-conflict 0 项、override 0 项**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

- Owner 评论为空（简报 Comments 段空 + REST 快照为空 + 派发说明一致）→ 无评论来源 override。
- 无新 ADR 修订/废弃、无协议版本升级；ADR 0031 域句无允许域外值的演进条款（实现未重开 D2——`2^53` 拒绝锚在 G5）。
- 实现未造任何 override：DENY 面零 diff（无越界触碰即无「既成事实型」违规）；B11 锁修订走已登记修订链；S2b-0 守卫 throw 与 G5 第四键行字面为**已披露微偏离**（SA3 Deviations 3/6 + SA4 裁决在案），其处置路径均不依赖 override。

## 5. Frozen surfaces

设计门禁 §5 冻结面逐项对实际 diff 核对（实施复查模式核心）：

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 核对） |
|---|---|---|---|
| 成功面恒四键 `{ok,value,schema,truncated}`，不加 bytes 键 | ADR 0031 决策 2 + ADR 0027 决策 1 | ADR 0031 L25 | **保持**：组装体 L842–846 原样；`_budgetOkKeys` 恰四键锁；G8 双侧绿 |
| ✂ 段与头行文法；头行**不记** `maxBytes` | ADR 0031 决策 4 + ADR 0027 决策 3 | ADR 0031 L43 | **保持**：`read-schema-projection.ts` 零 diff；canonical 剥离 → `ResolveSchemaBudgetOptions` 两键类型 + G8 `includes('maxBytes')===false` 断言 |
| 投影渲染器零选项纯函数（vfsl 零改动） | ADR 0027 决策 2 + ADR 0031 决策 4 | ADR 0027 L29 | **保持**：`packages/vfsl*` git diff 全空（实测） |
| `DeepOptional` 类型面 | ADR 0031 决策 4 零变化清单 | ADR 0031 L43 | **保持**：`vfsl-protocol` 零 diff（实测） |
| 无 options / 两键 options 逐字节现行为（含敌意面读次序与计数 F-x5=4/F-x6=5） | ADR 0031 决策 1/4 | ADR 0031 L17/L43 | **保持**：split 逐字镜像 T1 读纪律（`Object.keys` + 逐键显式 gOPD、零 `[[Get]]`、宿主门 raw 直传——L1237–1262 与 doc-runtime read.ts L326–361 逐行对照）；既有 27 条 shape-budget 红测零编辑（DENY）；F-x5=4/F-x6=5 与三键面 4/5 parity 锚复跑绿（SA3 日志 §[2]） |
| doc-runtime options 两键闭合形状 + 校验器 + 直调行为 | ADR 0031 决策 4「零改动、下传两键」 | ADR 0031 L42 | **保持**：doc-runtime 零 diff；`keyof ReadLogicalValueAtPathOptions` 硬锁 + G11 直调负控 |
| 既有失败码形状与定序（`PATH_NOT_ALLOWED`/`RUNTIME_READ_DISABLED`/`NAMESPACE_LEASE_RELEASED` 三键/`WINDOW_OPTIONS_INVALID` 递延期） | ADR 0008 修订节 / lease 冻结 issue / ADR 0028 | ADR 0008 L123；ADR 0028 L67 | **保持**：F6（G0 前置零 options 读取）/F7（lifecycle 先行）/T8（值通道失败先于预算）/N8（released 三键短路）锚全绿；阶梯实现与 DD-8 逐行对应（L769–840 实读） |
| 校验码词表：不新增校验码；唯一新码 `READ_BUDGET_EXCEEDED`（恰五键） | ADR 0031 决策 1/3 | ADR 0031 L16/L31–33 | **保持**：split/canonical 域违约全复用 `READ_OPTIONS_INVALID`；`_exceededKeys` 恰五键锁 |
| lease 原样透传（raw 引用直传）+ 重载序 legacy 末位 + legacy 联合零泄漏 | ADR 0031 决策 4 + ADR 0024 决策 6 | ADR 0031 L42 | **保持**：registry `src/**` 零 diff（实测）；G9「同一引用」断言；`_readAlias`/`_readOverloadOrder`/`_legacyReturnType` 延续 + `_legacyNoBudgetCode` 新增零泄漏锁 |
| 公共导出键集（值导出面） | ADR 0023 + issue #93 审计 | 导出审计测试（未触碰） | **保持**：`index.ts` 仅注释（diff 实读，导出语句区零改动） |
| E1 输出端 undefined 吸收纪律（值面第三态禁止） | ADR 0024 决策 2（amendment） | ADR 0024 L45 | **保持**：值面零触碰 |
| readData 同步、不进 sequencer、零缓存 | ADR 0008 + runtime AGENTS | ADR 0008 L16–18 | **保持**：组合体同步纯函数实读；无 sequencer/缓存/订阅引入 |
| maxBytes 规范域（1..2^53−1） | ADR 0031 决策 1 域句 | ADR 0031 L16 | **保持**：split/canonical 双处 `Number.isSafeInteger && ≥1`；G5 组级判据（`2^53`/`2^53+2` 拒 ∧ `2^53−1` 收） |

**12/12 全部保持，无一漂移。**

## 6. Evolution requirements

**无待计划的 evolution-required 项。** 本次实现不改变任何既有契约：全部行为在 ADR 0031 授权面内兑现，或为已登记修订链（0024/0027 状态行）的落地。实现也未触碰任何需要演进文档的灰色区（DENY 面零 diff）。ADR 0031 登记的合法演进位在当前 diff 中的处置：可选裁剪模式（未实现，正确——开放问题）；载荷拆分分项（未实现，正确——加法演进位）；窗口面 `maxBytes`（递延 OBL-WIN-1，独立票，见 RA-I1）。若未来任一演进位被启动，须携修订计划先送本门禁（沿设计门禁 §6 要件）。

## 7. Hard conflicts

**无。** 逐项核对未发现任何与既有决策不兼容且无合法 override 的实现条款。六个复审焦点结论：

1. **公共 API 扩张** = ADR 0031 决策 1/3/4 的忠实落地：三键 interface（L167–171）、五键 `ReadDataBudgetExceededResult`（L204–212）、联合追加（L217–221）、registry 按名别名自动跟随（src 零 diff + 跟随锁）、导出键集零扰动。
2. **失败语义优先序** = DD-8 阶梯逐行落地（S1 → S2b-0 G0 → split 域拒 → T1(relay) → canonical 出口①/② → 投影 → 闸门 → 四键），F6/F7/T8/N8 既有锚全数保持。
3. **D1/D3/D4 落地** = 设计收口值的兑现（D1 ≡ 缺席双剥离；D3 runtime 自持三键；D4 白名单三键 + 下传前剥离）；DENY 面/§12.6 零 diff 有 git 证据。
4. **OBL-DOC-1** = 三文档重录同迭代落地、清退/新增对象逐项对上 SA6 §3.3 台账、真空子项核实、doc-sync 门禁绿——义务关闭，无悬空。
5. **RA-D1/RA-D2** = split 读纪律与 T1 逐字同构（本次逐行对照）、F-x5=4/F-x6=5 parity 锚在契约内且复跑绿；B11 锁三键化与相邻注释在**同一变更集**完成。
6. **实现自引入微偏离**（S2b-0 守卫 throw、G5 第四键行 message 字面、scanner 两键滞后）= 三者均已披露、均有结构性理由、均不触碰决策文本约束面（§3 行 16/17/18）。

## 8. Required actions

| # | 动作 | 对象 | 阻塞性 | 状态 |
|---|---|---|---|---|
| RA-D1（split parity = 实现验收） | 读纪律镜像 + F-x5=4/F-x6=5 计数保持 | 实现 + 契约 | 前次阻塞实现验收 | **已闭合**（代码逐行对照 + parity 锚复跑绿；本次实读复核） |
| RA-D2（B11 锁同变更集 + 相邻注释） | `_optionsClosedShape` 三键锁 + 注释重写同变更集 | 实现变更集 | 前次阻塞 | **已闭合**（同一 diff 实读；root typecheck exit 0） |
| RA-D3（OBL-DOC-1 兑现监督） | 三文档重录同迭代、逐项对照台账 | Phase B | 前次阻塞收尾 | **已闭合**（本次逐项核对：清退对象消失、新增词汇在场、真空核实、门禁 43/43） |
| RA-D4（实现后复审） | 按 implementation 复查模式核对设计门禁 §5 冻结面 | 本门禁 | 流程 | **本次闭合**（§5 表 12/12 保持；§3 十八项裁决） |
| **RA-I1**（= RA-D5 延续） | OBL-WIN-1 窗口面三面义务独立票：`readArray`/`readMap` 的 `maxBytes`（同码同文、窗口同构度量、`WINDOW_OPTIONS_INVALID` 负控改写）；message 措辞**逐字镜像**本票冻结文案（runtime.ts L1311–1327）；G11 前两条断言届时原位改写并送门禁复核 | 独立票 | 非阻塞（挂账可追溯） | open |
| **RA-I2**（新，交付门） | 发布随 **minor bump** `@nomicore/namespace-runtime`（ADR 0031 验收节明文「0.x 破坏性 minor」；当前 0.1.12）——公共面变化（三键 options + 新失败分支）不得以 patch 位发布 | 发布流程 | 阻塞**发布**（不阻塞代码交付评审） | open |
| **RA-I3**（新，登记 SA3 Deferred #4 / SA4 MINOR-4） | doc-sync 扫描器 `BUDGET_OPTION_KEYS` 三键化（`packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` L182）后续票：使 `maxBytes` 语义在场性获得机器强制；三键化前 SCOPE_DOCS 不得出现 `readData(x, {maxBytes})` 调用字面（会误触闸） | 后续票 | 非阻塞（测试基建；内容义务已人工核验） | open |
| RA-I4（流程，非冲突项） | CI 终态复跑 root `pnpm typecheck`/`pnpm test`（现有全绿证据为 SA3 本地运行，md5 与工作区一致）+ SA4 §11 动态验证项 | CI | 阻塞合并/交付流水线 | open |

## 9. Verdict

**`clear`** —— 十八项对照全部为 no-conflict（10）或 implements-existing-decision（8），无 hard conflict、无需 override、无待计划的 evolution-required。设计门禁（iteration 2）放行的全部实现期结构条件（RA-D1/RA-D2）与收尾条件（RA-D3）均已闭合；本次实现后复审（RA-D4）对设计门禁 §5 十二项冻结面逐项核对为**全部保持**。被删 D2 域外演进路径未被重开（G5 拒绝锚在案）。交付放行；剩余事项均为已登记的独立票/发布门/CI 流程项（RA-I1–I4），不含任何须先修订决策才能继续的阻塞。

## 10. requiresConflictRecheck

**false**。理由：本报告即设计门禁预留的「实现后复查」落点——readData 公共 API（options 三键闭合形状 + 结果联合新失败分支 `READ_BUDGET_EXCEEDED` 五键）与失败语义（DD-8 优先序）**已随本次 diff 逐项核对闭合**（§3 行 1–5、§5 全表），不存在「尚待实现核对」的公共 API/wire/schema/持久化/状态机/生命周期/失败语义面；本变更集内无正式 override、无新决策面。剩余义务全部住在**独立未来变更集**且各自自带门禁触发条件：OBL-WIN-1 窗口面票（SA6 §3.3 台账明记「G11 前两条断言届时原位改写并送复核」+ message 镜像义务）、scanner 三键化后续票、发布 minor bump（RA-I2）。纯 no-conflict 与既有决策兑现，且实现后复查已闭合——按裁决规则置 false。
