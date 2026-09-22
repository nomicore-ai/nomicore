# SA8 冲突门禁报告 — issue #436 实现后冲突复查（SA3 完成后）

## 1. Reviewed subject: implementation

被审对象 = 当前工作区变更集（未提交 diff，基线 HEAD `7407ce01367b6d7a3fe497cd78c4bcf085f3ddbb`，
分支 `mabf/issue-436`）——`git status` tracked 改动恰 7 文件：`docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md`、
`packages/doc-runtime/src/{extract,install-verify,mutation-local,mutation}.ts`、
`packages/doc-runtime/test/{apply-validated-mutation-fatal-contract,issue-237-path-localized-validation-red}.test.ts`
（+ SA6 三件套/工件与证据日志 untracked）。本轮为设计后门禁报告（`task_issue-436_design_conflict_report.md`，
verdict clear + `requiresConflictRecheck=true`）指定的实现后复查；另满足技能复查触发条件「实际 diff 触碰 ADR 面」。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-436.md`（Host 简报；Issue REST comments = **空**——无 Owner 评论 override 来源） | 已读；AC1–AC7 对照 |
| `wiki/raw/task_issue-436_design.md`（iteration 1） | 已读（全文；§7.1–§7.7/§11/§12/§15 复查清单） |
| `wiki/raw/task_issue-436_sa2_review.md`（approve；F-1/O-1..O-4 已由设计 iteration 1 修订） | 已读（verdict 与落实面） |
| `wiki/raw/task_issue-436_sa3_impl.md`（被复审的实现报告） | 已读（全文；其 §Deferred verification 指定本复查①②） |
| `wiki/raw/task_issue-436_design_conflict_report.md`（前轮 SA8：clear + requiresConflictRecheck=true，§8 清单①②） | 已读（复查范围来源） |
| SA4/SA9 报告 | **不存在**（`ls wiki/raw` 核对）——本复查按设计要求 + diff 触碰 ADR 面运行，非因 SA4/SA9 新决策面 |
| `wiki/raw/task_issue-436_sa6_contract.md` + 三件套 + 探针 | 已读（契约纪律/冻结面） |
| `docs/adr/0033-elementwise-yarray-mutation-validation.md`（已接受，2026-09-22） | 全文（决策 1–6） |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md`（含本次新增 ADR 0033 修订注记 L126–140） | 全文 #237 修订节 L62–124 + 注记 |
| `docs/adr/0010-…md` issue #237 修订节（L333 起；后备句 L345–347） | 相关节全文（零改动核对） |
| `CONTEXT.md` L144（重建校验/数组位例外）/ L202（复制未校验） | 核对（零改动；已按 ADR 0033 目标态立法） |
| `docs/AGENTS.md`（义务句）+ `packages/doc-runtime/AGENTS.md` + ADR 0008 #237 镜像节（L145–166） | 核对 |
| 当前 diff（`git diff` 全量 + `git show HEAD:` 逐段对照） | 逐 hunk 审阅（见 §3/§5 逐项） |
| 独立扫描：`grep -rn "不逐元素\|一次整体判定\|数组位" docs/ CONTEXT.md`（排除 ADR 0033 自身） | 自行执行（不复用 SA3 自报）——结论见决策 14 行 |
| 冻结面核对：SA6 三件套 md5 vs `artifacts/sa3-issue436-sa6-trio-md5.txt`；`vitest.config.ts` include 面 | 已核 |

决策集：33 份 ADR 无 superseded 状态影响本审；ADR 0033 为最新立法；wiki/raw 工件按 `docs/AGENTS.md`
Authority 属 evidence 而非 normative contract（探针/SA6 报告不构成自动阻塞依据）。

## 3. Decision analysis

| Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0033 决策 1（`0033` L19–23） | 闸门 = plan kind=`array` ∧ 边界值节点 kind=`array`；union 数组目标永久回退；规划层完全不动 | `mutation-local.ts` L331–332 双条件合取（`plan.node.kind === 'array'`〔值侧，descendValues 已归一〕∧ `resolve(boundaryNode).kind === 'array'`〔结构侧〕），置于 S4 `navigateHops` 之后、S5 `walk` 之前；union 数组目标值侧即 false → 回退。legacy 分支（L375–411）经与 `git show HEAD:` 逐行对照**逐字一致**（除设计 §8.1 规定的 verify 包装 `{kind:'boundary',input:{…}}` 与注释外零差异——本审独立 diff 复核）；`planMutationBoundary`/`packages/vfsl/**` 零改动（git status 无 vfsl 文件） | implements-existing-decision | 0033 L19–23；mutation-local.ts L312–411；本审 HEAD 对照 diff；探针 U 组 26 PASS（`artifacts/sa3-issue436-probe-flip.txt`） | 无 |
| ADR 0033 决策 2（L25–31） | live `Y.Array.length` O(1) 越界；域规则逐字一致；issue 路径逐字节一致；delete O(1)；最小 edit 不变；一切拒绝先于 live 写 | F1（L337–339）`carrierOf` O(1) + `carrierMismatchIssue([], 'Y.Array', boundaryLive)`——与 legacy S5 首错（walk 以 path `[]` 起步）**同一构造助手、同参数**（extract.ts L364 单一实现，`@internal` 导出，两处既有内部调用点同步更名，零手拼字面量）；F2（L343）`target.length`；F3（L345–349）接缝 `applyElementwiseArrayMutation(derived, plan, {length}, payload)`，失败经既有 `issuesOf` 转换（与 legacy `applied.result` 同一转换器，L76）；F4（L353–365）复用 `buildDetachedValue`，路径构造 `[...mutation.path, mutation.index! + i]` 与 legacy L397 同式；`commitPrepared` 零改动（mutation.ts diff 无该区 hunk） | implements-existing-decision | 0033 L25–31；mutation-local.ts L333–373 vs L376–406；extract.ts diff；`artifacts/sa3-issue436-probe-flip.txt` L10/13（越界 message/path 逐字：`array-delete 范围越界（不 clamp、不接受越界 no-op）` path `["items",512]`） | 无 |
| ADR 0033 决策 3（L33–37） | 事实核原样保留；fast-path 省略重投影核；legacy 双核不变 | `install-verify.ts`：步骤①逐字抽取为 `verifyBoundaryInstallFacts`（L399–431，try/catch → `boundaryE201D('安装事实核异常（触发类④）')` 文案逐字保留，E201-C 四分支文本零变化——diff 中均为 context 行）；`VerifyPlan` 判别联合（L439–441）+ `verifyPrepared` 分派器（L444–453）；`verifyBoundaryIntact`（L465–499）= 抽取核调用 + 步骤②**原样**（其 try/catch → E201-D 逐字保留）；`VerifyBoundaryIntactInput` 零改动（`proposedBoundary: unknown` 必填，L360——「字段缺席静默跳核」形态未引入）；`mutation.ts` 两处调用改 `verifyPrepared`（L155/L167），`composeBatchVerify` 按 `verify.kind !== 'boundary'` 跳折迭且折迭输入侧（`parsed[j]` 驱动）不变（L353–380） | implements-existing-decision | 0033 L33–37；install-verify.ts L385–499；mutation.ts L152–168/L353–380；SA3 证据：契约 8/8 绿 + 负控 17/17 绿（`artifacts/sa3-issue436-focused-final.log`） | 无 |
| ADR 0033 决策 4（L39–43） | 触达面 = 数组载体 + 变更区间；污染数组 delete 转成功；不补异步审计 | F1 载体检查保留（载体位仍响亮拒绝——ADR-0007 条款 4(i) 面）；无任何异步/抽样审计代码新增；污染数组写 `ok:true` 由 SA6 契约 FA 组锚定（SA3 证据 8/8 转绿）；probe-flip G1a/G1b/G1c 观测值恰 = 契约目标行为 | implements-existing-decision | 0033 L39–43；mutation-local.ts L335–339；`artifacts/sa3-issue436-probe-flip.txt` L5–7；`artifacts/sa3-issue436-focused-final.log` | 无 |
| ADR 0033 决策 5（L45–50） | 逐元素可组成立法 + 一致性 fixture enforcement（#435 已交付） | `packages/vfsl/**` 零改动（git status 核对；接缝 `applyElementwiseArrayMutation`/导出面冻结） | implements-existing-decision | 0033 L45–50；git status | 无 |
| ADR 0033 决策 6（L52–54） | 性能验收软（O(n)→O(k) 等价证据，不钉毫秒） | FB 组结构性读计数为证据面（SA3 报告 reads=1/0，n 无关）；毫秒仅软证据（probe G5 ×1.4）——与「不钉毫秒」一致，不入门禁 | no-conflict | 0033 L52–54；`artifacts/sa3-issue436-probe-flip.txt` L8–14 | 无（验收充分性归 SA4/SA7） |
| ADR-0007 #237 条款 1/4(ii)/7（L76–77/L102/L121–122）+ 新增 ADR 0033 修订注记（L126–140） | 旧句面（一次整体判定/数组位边界内响亮拒绝/按边界规模）对非 union `T[]` 修订为逐元素/载体+变更区间/O(变更量) | 注记已随实现**同变更集**落地（git diff：纯追加 16 行、0 删改——既有条款逐字保持）。注记引文与条款原文逐字一致：条款 1「批量 values[] / count 一次整体判定，不逐元素」（=L76–77）、条款 4(ii)「数组位」（=L102 边界清单）、条款 7「array……按边界规模」（=L121–122）；新语义（逐元素、触达面=数组载体+变更区间、区间外既存损坏不再被普通数组写发现、O(变更量)）与 0033 决策 2/4 逐点对应；作用域显式限定非 union `T[]`，union 数组目标与其余边界种类/条款 4(i)「不受影响」= 0033 决策 1/4 的准确转写；授权链段（ADR 0033 已接受 + docs/AGENTS.md 义务句 + ADR-0006 #64/#79、ADR-0008 #93/#132 先例）经核属实；`###` 同级修订节形态沿仓库惯例（ADR-0008 L145/L167/L181/L207/L223 同款 sibling 修订节先例），「本节条款」指称经逐字引文无歧义 | implements-existing-decision（设计门禁报告唯一 evolution-required 项的兑现闭合） | ADR-0007 L76–77/L102/L121–122/L126–140；ADR 0033 L19–43；`git diff docs/adr/0007-…` | 无（已闭合，见 §6） |
| ADR-0007 #237 条款 4(i)（L100–101） | 载体形态违规（含 array-* 目标非 Y.Array）仍响亮拒绝 | fast path F1 以与 walk 首错同文案同 path（path `[]`）响亮拒绝、零写入（单一构造助手反漂移） | no-conflict | 0007 L100–101；mutation-local.ts L337–339；extract.ts L364–378；SA3 证据（A-4 载体冒充保绿） | 无 |
| ADR-0007 #237 条款 5（L109–114） | 零写入/observer no-rollback/禁 write-then-undo；E201 C/D、E203/204/205 分类不削弱 | fast path 一切失败（F1/F3/F4）在 `prepareLocalMutation` 内 return `{kind:'fail'}`，先于 `transactGuarded`；无 write-then-undo 代码；E201-C/D 文案逐字保留；闸门 `resolve(boundaryNode)` 抛错与 legacy walk 内 resolve 同一调用帧 → 同一调用方 catch（mutation.ts L215 `DerivedInvariantError` → E204 面，零改动）——O-4 设计承诺在 diff 中兑现 | no-conflict | 0007 L109–114；mutation-local.ts L337–373；mutation.ts L215；SA3 证据（NC/NA 组零写入零 update） | 无 |
| ADR-0007 #237 条款 6（L116–119） | A-6 行为等价 28 场景 = 成本优化硬前置 | A-6 所在文件 `issue-237-path-localized-validation-red.test.ts` 仅对称面一用例定向重锚（共享 `TEXT_LIB_ITEM` 与 A-6 零触碰——diff 核对）；等价面由组合性（0033 决策 5 + #435 E 组）维持；SA3 报告根 test 464 files/5647 全绿 | no-conflict | 0007 L116–119；测试 diff（单 hunk 局部常量区 + 单 hunk 对称面用例）；`artifacts/sa3-issue436-root-test.log` | 无 |
| ADR-0007 #237 条款 2/3（L83–96） | phase-1 前置假设；`set([])` 唯一全量形态 | 不触碰（mutation.ts legacy 分支/`verifySnapshotIntact` 零改动） | no-conflict | 0007 L83–96；mutation.ts diff | 无 |
| ADR-0010 #237 修订节（L333–361；后备句 L345–347） | 后备句「语义边界内的非法数据仍会被响亮拒绝」数组含义 | 文件**零改动**（git status 核对）。其数组含义由 ADR 0033 决策 4 标题显式点名修订（0033 L39「修订 ADR-0010 issue #237 修订节的数组含义」），ADR-0007 注记 L139–140 如实登记该链；后备句自身授权链即声明「ADR-0007 修订节（损坏条款定稿为单一真相源）」→ 单一真相源已携注记，引用链自洽无漂移 | no-conflict（已被母法点名修订——设计门禁既定裁决，实现未扩大） | 0010 L333–361；0033 L39；ADR-0007 L139–140；git status | 无 |
| ADR 0008 #237 镜像节（L145–166） | 镜像句括注「（O(1) 安装事实核 + O(boundary) 重投影核）」为 #237 期 S9 组成描述 | 文件零改动。fast path 后非 union 数组提交为 install-facts 单核——与该括注粒度不符；但该节授权链明文「ADR-0007 修订节为**单一真相源**」（L148–149），ADR-0008 自身契约（槽序 S1–S7/公共 interface/fatal 通道/封装边界）**未变**（写槽可观察行为不变），docs/AGENTS.md「Link to the authoritative source instead of copying its rules」的依赖结构使其不构成矛盾句面 | no-conflict（带观察项：编辑性残留，见 §8 行 3） | ADR-0008 L145–166；docs/AGENTS.md Editing 条款；mutation.ts 写槽面 diff | 可选编辑跟进（非义务触发、不阻塞） |
| CONTEXT.md L144/L202 | 数组位例外/触达面收窄词条 | 零改动；两词条已由 `f6b27da` 随 ADR 0033 立法为目标态（L144「数组位例外（ADR-0033）…union 数组目标仍走整体验证」/L202「数组写自 ADR-0033 起触达面收窄…对污染数组的 delete 由响亮拒绝变为照常成功」）；L144 首句「批量数组整体判定…不逐元素」为指向 ADR-0007 #237 节的**转引短语**、紧随例外主断言——注记落地后转引自洽 | no-conflict | CONTEXT.md L144/L202；git status；设计门禁报告同项裁决复核 | 无 |
| `docs/AGENTS.md` 义务句 | 「When code behavior changes, update every normative document whose stated contract changed」+「Amend or supersede prior decisions explicitly…」 | 陈述契约变化的规范文档 = ADR-0007 #237 节，注记同变更集交付 ✓。**本轮独立扫描**（不复用 SA3 自报）：`不逐元素|一次整体判定|数组位` 全域命中 = 被修订条款自身（L74/L77/L102，注记作用域内）+ 注记引文（L133/L135）+ CONTEXT L144 转引（自洽）+ `docs/integration/external-project-vfsl-codegen.md` L297（合并冲突措辞，无关）+ ADR-0010（母法点名）——**无遗漏义务面** | implements-existing-decision | docs/AGENTS.md；本报告 §2 扫描行；`git diff` | 无 |
| `packages/doc-runtime/AGENTS.md` | 校验失败零写入；detached + 单 guarded transaction；公共面只经 `src/index.ts`；写后不变量失败 = fatal | 新增导出（`carrierMismatchIssue`/`verifyBoundaryInstallFacts`/`VerifyPlan`/`verifyPrepared`）全 `@internal`，`src/index.ts` **零改动**（git status）；detached 构造复用既有 `buildDetachedValue`；事实核偏离仍 E201 fatal | no-conflict | packages/doc-runtime/AGENTS.md；git status（无 index.ts）；extract.ts/install-verify.ts `@internal` 注释 | 无 |
| ADR 0025/0026（guard/信封） | guard 评估先于 prepare；E1–E6 信封语义 | mutation.ts diff 不含 `parseMutationCore`/`parseGuard`/`evaluateGuard`/信封校验区（hunk 仅 L43–50 imports/L119–127 类型/L152–168 验证调用/L326–380 compose） | no-conflict | ADR 0025/0026；mutation.ts diff hunk 清单 | 无 |
| 简报 AC1–AC7 | 验收判据 | AC1–AC6 与决策面同构（上行已裁）；AC7 门禁绿为 SA3 报告证据（包 tsc/根 typecheck/根 test exit 0）——完成度判定归 SA4/SA7，非冲突面 | no-conflict | task_issue-436.md；`artifacts/sa3-issue436-*.log` | 无 |

**SA3 偏差 D-1（探针 exit 1）专项裁决**：SA6 探针 G 组 12 项断言「HEAD 现状 / fast path 未接线」的
能力缺口本身（探针头部 L5–10 自标注），实现关闭缺口后必翻——probe-flip 逐项观测值（reads 1/0、
`ok:true`、`thrown=undefined`、×1.4）恰 = 契约目标行为。探针位于 `wiki/raw/`，不在 vitest include 面
（`vitest.config.ts` include = `packages/*/test/**/*.test.ts` 等），且 wiki/raw 按 `docs/AGENTS.md`
Authority 属 evidence 而非 normative contract——**不构成决策冲突**；「探针 exit 0 不变」判据的口径
裁决属验收证据面，归 SA4/SA7（SA3 已如实记录并移交，未篡改探针）。SA6 三件套冻结面另见 §5。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ADR-0007 #237 条款 1/4(ii)/7 数组整体语义（非 union `T[]` 数组位：一次整体判定、边界内损坏响亮拒绝、按边界规模） | ADR 0033（已接受，决策 1–4）+ `docs/AGENTS.md`「Amend or supersede prior decisions explicitly」义务句 | 仅非 union `T[]` 数组位：逐元素校验、触达面 = 载体 + 变更区间、成本 O(变更量)。union 数组目标、union 穿越/Record/delete 父位边界、set 目标位、条款 4(i)/5/6/2/3、`set([])` 管线逐字保持 | 前轮裁定三项同变更集义务（注记 + P-1/P-2 重锚 + fast path 实现）——**本复查逐项核实已全部落地**（§3 决策 7 行、§5 冻结面表、`git diff` 7 文件同批在位）；override 未扩大（注记纯追加、union 句面逐字保持、无第二处决策文本被改） |

无 Owner 评论 override（comments = 空）；无协议版本升级；无新 override 产生；无决策文本自含演进条款被援引。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（对实际 diff 逐项） |
|---|---|---|---|
| update bytes / 事件形态（Y.Array 区间最小 edit、单事件） | 复制协议与诊断捕获零改动 | 0033 决策 2 L30 | `commitPrepared`/`transactGuarded` 区零 diff（mutation.ts hunk 清单核对）；ND 组绿（SA3 证据） ✓ |
| 错误分类 E201-C/D、E203/E204/E205 + issue path/message 逐字 | fatal 分类不削弱；兼容面 | 0007 条款 5 L109–114；0033 决策 2 L28 | 事实核四分支 E201-C 文案与 E201-D 包裹逐字移动（diff context 行）；步骤② try/catch 原样；E204 catch（mutation.ts L215）零改动；域文案经接缝/共享构造助手零手拼 ✓ |
| 零写入纪律（拒绝先于 live 写、禁 write-then-undo） | 一切失败零写入零 update | packages/doc-runtime/AGENTS.md；0033 决策 2 L31 | fast path 失败分支均 prepare 期 return；无 undo 代码 ✓ |
| 公共 API 面（`src/index.ts`） | 无新公共导出 | packages/doc-runtime/AGENTS.md；设计 §8.1 | `src/index.ts` 零 diff；新导出全 `@internal` ✓ |
| `planMutationBoundary`（规划层） | 完全不动 | 0033 决策 1 L23 | `packages/vfsl/**` 零改动 ✓ |
| union 数组 legacy 轨（永久双轨） | 既有全量边界路径逐字保留 | 0033 决策 1 L22 | `git show HEAD:` 逐行对照：legacy 分支仅 verify 包装形变（设计 §8.1 规定）+ 注释，逻辑零差异（本审独立执行） ✓ |
| vfsl 接缝与导出面 | #435 冻结交付 | PR #444；设计 §11 DENY | `packages/vfsl/**` 零改动 ✓ |
| guard/信封面（E1–E6、parse/evaluate 区） | 解析与 guard 语义冻结 | ADR 0025/0026 | mutation.ts diff 无该区 hunk ✓ |
| SA6 三件套（contract/control/fixture） | 红灯必须经实现自然转绿 | SA6 契约纪律；设计 §11 DENY | md5 与 SA3 记录值一致（contract `2dd066f4…`/control `c9e0e6c1…`/fixture `8358d454…`）；注：SA6 契约未记录三件套自身哈希，SA6 期基线由 `artifacts/sa6-issue436-stability-{1..5}.log`（红灯集 md5 `719cbdb4…` ×5）+ `sa3-issue436-reanchor-neutrality.log`（实现前态 8 failed 复现）旁证——证据强度以 SA3 自记录 + 旁证日志为限，如实登记 ✓（带证据来源限定） |
| ADR 0033 / ADR-0010 / CONTEXT.md 文本 | 母法与词汇零改动 | 设计 §11 DENY | 三文件零 diff ✓ |
| ADR-0007 #237 节既有条款（注记作用域外） | 条款 2/3/4(i)/4(iii)/4(iv)/5/6 及其余边界种类句面逐字保持 | 设计 §7.6 注记文案承诺 | `git diff` = 纯追加 16 行（L126–140），0 删 0 改 ✓ |
| 两定向测试文件的其余用例 + 共享 `TEXT_LIB_ITEM` | 定向范围纪律 | 设计 §11 ALLOW/DENY | fatal-contract 仅 W5 hunk（schema 行 + 注释）；issue-237 仅局部常量 hunk + 对称面用例 hunk；`TEXT_LIB_ITEM`（L91–93）与 A-1..A-7 其余用例零触碰 ✓ |

## 6. Evolution requirements

前轮唯一 evolution-required 项（ADR-0007 #237 数组语义，条款 1/4(ii)/7）的修订计划七要素落地核对：

| 要素 | 计划承诺（设计 §7.6/§7.7） | 实现落地（本复查对 diff 核实） | 判定 |
|---|---|---|---|
| 修订文件 | ADR-0007 #237 节末尾追加注记，不重写条款 | L126–140 纯追加；既有条款 0 删改 | ✓ |
| 新旧语义 | 旧→新逐句、作用域限定非 union `T[]` | 注记正文 = 设计建议文案逐字（blockquote 主体），引文与 L76–77/L102/L121–122 逐字一致 | ✓ |
| 兼容与迁移 | 无 wire/schema/持久化/状态机迁移；union 与其余边界逐字保持 | 全部冻结面 §5 逐项 ✓；Δ1/Δ2/Δ3 行为面各有 ADR 依据（0033 决策 3/4） | ✓ |
| 失败语义 | 条款 4(i)/E201 C/D/零写入/fatal 分类不削弱 | §3 决策 8/9 行 ✓ | ✓ |
| 版本/授权 | 带日期注记 + 授权链 + 仓库惯例；豁免仅 Controller 明示 | 注记含日期/授权链/先例引（核实 ADR-0006 #64/#79、ADR-0008 #93/#132 存在）；未走豁免路径 | ✓ |
| 验证 | SA6 契约 + P-1/P-2 两态绿 + 根门 | SA3 证据：契约 8/8、负控 17/17、重锚两态 47 passed ×2、根 typecheck/test exit 0（SA8 不复跑测试，采信证据工件并核对其在位） | ✓（证据面） |
| 保持不变的冻结面 | 注记文案 + §5 表 | §5 逐项 ✓ | ✓ |

**结论：该 evolution-required 项已完整兑现并闭合**——文档与代码同变更集、语义一致、override 未扩大、
旧引用链（ADR-0010 后备句 → ADR-0007 单一真相源 → 注记）自洽更新。无新开 evolution-required 项。

## 7. Hard conflicts

**无。** 无任何对照项与在役决策（ADR 全集 + CONTEXT.md + 模块 AGENTS 收录决策）不相容；
无未带显式修订的行为变更（唯一行为面变更 Δ1/Δ2/Δ3 均有 ADR 0033 决策 3/4 立法 + 注记显式登记）；
无 Owner 评论被违反（comments = 空）；SA6 探针 exit 1（D-1）非决策冲突（§3 专项裁决）。

## 8. Required actions

1. **无阻塧行动**。前轮 §8 清单①（注记文本一致性）/②（重锚 diff 面与断言零放宽）均已闭合：
   ① 注记引文与 ADR-0007 条款 1/4(ii)/7、ADR 0033 决策 1–4、ADR-0010 L345–347 引句逐点一致（§3 决策 7/12 行）；
   ② 重锚 diff 恰 = schema 文本（W5_TEXT L226）/局部常量（TEXT_LIB_ITEM_UNION L101）/注释授权链/锚定载体（fixtureOf L564），
   断言面（`ok:false`+`issues>0`+`stateBytes` 不变；`ok:false`+`stateBytes`+`ev.count===0`+`length===3`）逐字保留零放宽（本审对 diff 逐行核实）。
2. **归 SA4/SA7（非 SA8 面）**：D-1 探针判据口径裁决；全部验证结论的独立复跑；实现质量与验收完成度评审。
3. **可选编辑跟进（不阻塞、非义务触发）**：ADR-0008 #237 镜像节括注「（O(1) 安装事实核 + O(boundary) 重投影核）」
   为 #237 期 S9 组成摘要，fast-path 后对非 union 数组提交为 install-facts 单核——该节授权链明文 ADR-0007 为单一真相源、
   ADR-0008 自身契约未变，故不构成矛盾；如后续顺路修订该 ADR，可加半句「（数组 fast path 起为 install-facts 单核，ADR 0033 决策 3）」对齐粒度。

## 9. Verdict

**clear** —— 实现对 ADR 0033 决策 1–4 为忠实的 implements-existing-decision（闸门/双轨/O(k)/S9 收窄/触达面逐条落地）；
对 ADR-0007 #237 修订节的唯一 evolution-required 项已按完整计划在同变更集内兑现（注记 + 重锚 + 实现，
override 未扩大、冻结面全数保持）；独立扫描证实无遗漏义务面与陈旧句面残留；无 hard-conflict、无非法 override。
SA3 偏差 D-1（探针 exit 1）经裁为验收证据面而非决策冲突。

## 10. requiresConflictRecheck

**false** —— 前轮标记的复查清单①②已在本轮对实际 diff 逐项闭合（§8 行 1）；③（fast path 实现管线）本审亦已
顺带核对冻结面无违反。剩余工作（SA4/SA7 独立验证、D-1 口径裁决、可选编辑跟进）均不产生新决策面；
后续若 diff 变更（新增公共 API/wire/schema/持久化/状态机/失败语义改动或新的 override），按常规门禁另行触发。
