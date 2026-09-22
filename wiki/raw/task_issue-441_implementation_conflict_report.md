# SA8 冲突门禁报告 — issue #441 实现后冲突复查（implementation recheck）

- Reviewed subject: **implementation**（issue #441 fast path 实现 + ADR-0007 修订注记落地）。
- 复查触发：设计后冲突报告（`wiki/raw/task_issue-441_design_conflict_report.md` iteration 1）
  verdict **clear** 且 `requiresConflictRecheck: true`，其 §8 Required action 2 登记的实现后
  复查清单（①注记文本一致性 + ②同变更集 git diff + ③测试重锚零放宽 + ④fast path 管线不重开）
  ——本报告逐项执行并闭合。
- 复查基线：HEAD `3fd6aa8b659420fd63d07b051139fe5f279556b8`（分支 `mabf/issue-441`，`git rev-parse`
  核对——与设计/SA6/SA2/SA8/SA3 声明 HEAD 一致，无中途提交）；工作树恰 3 个 tracked 修改文件
  （`git status`）：`docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md`（+19）、
  `packages/doc-runtime/src/mutation-local.ts`（+76/-3）、`packages/doc-runtime/src/mutation.ts`
  （+21/-11，注释-only）；SA6 冻结面（契约三件套/夹具/探针）保持 untracked 原始态。
- Issue REST comments：**空**（Host dispatch 明文 none——无 Owner 评论 override 来源；与设计
  §4/SA6 §2/SA2 §4/SA3 报告一致）。无 owner-comment 要求。

## 2. Inputs and decision set

| 输入 | 状态 |
|---|---|
| 当前 diff（`git diff`） | 逐 hunk 读取：`mutation-local.ts`（闸门 + F1–F5 纯插入 + 模块头注释 + import 面）、`mutation.ts`（3 hunk 全部位于注释块——模块头 S9 句 / `composeBatchVerify` JSDoc / 折迭跳过行内注释，零语句变化）、`docs/adr/0007-*.md`（纯 +19 追加，见下） |
| `wiki/raw/task_issue-441_sa3_impl.md`（SA3 实现报告） | 全文；其 Verification 表与 Deferred（注记文本一致性/同变更集/git diff 移交 SA8）即本报告对象 |
| `wiki/raw/task_issue-441_design.md`（SA1 iteration 1） | §7.2–§7.6/§11/§12/§15 作为实现对照面；§7.6 建议文案与落地注记做**机械逐字比对**（见 §6） |
| `wiki/raw/task_issue-441_sa2_review.md`（SA2 **approve**） | §14 N1（注记落地文本核对→SA8）/N2（0033/0034 注记层叠→SA8）/N3（G1h 证据语义）/N4（行号漂移）逐项承接 |
| `wiki/raw/task_issue-441_design_conflict_report.md`（SA8 设计后 clear） | §8 复查清单 = 本报告执行框架；行为面裁决（implements-existing-decision × 8 + no-conflict × 10，无 hard-conflict）作为对照基线 |
| `docs/adr/0034-record-and-parent-elementwise-validation.md`（已接受 2026-09-22） | 全文复核：决策 1（set 管线序/旧值不读/delete `has` 拒 no-op/闸门/union 回退/值位 union 不阻断/issue 路径兼容）、2（封闭对象 delete 静态判定）、3（S9 收窄）、4（触达面收窄 + 标题「扩展 ADR-0010 issue #237 修订节」L37）、6（复用 seam 不另起机制）；后果节成本 O(新值)/O(1) |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` | issue #237 修订节（L62–124：条款 1 投影/重建句 L72–78、条款 4(ii) 边界内响亮拒绝句 L100–107、条款 7 成本句 L121–124）+ 0033 修订注记（L126–140，作用域句 L137–139）+ **新增 0034 修订注记（L142–159，追加式，既有 140 行零改写——`git diff` 纯 +19 核对）** |
| `docs/adr/0010-hub-peer-websocket-ydoc-replication.md` | issue #237 修订节后备句 L345–347 逐字复核 + `git status` 零改动（零漂移）；其授权链 L337–338 以 ADR-0007 损坏条款为单一真相源 |
| `CONTEXT.md` L144（重建校验）/L202（复制未校验） | 两词条均已含「自 ADR-0034 起」逐 entry/触达面收窄句（`0a91f14` 同批立法）；L144 转引短语（「见 ADR-0007 issue #237 修订节」）紧随其后被例外句限定——自洽 |
| `packages/vfsl/src/validate-patch.ts`（只读确认，非被审改动） | `planMutationBoundary` union 冻结（`boundaryAt !== undefined → kind='union'`，结构上进不了 record/parent 分支）；接缝 `applyElementwiseEntryMutation` 三重守卫（kind∈{record,parent} ∧ relPath 单段 string ∧ node.kind='object' ∧ `<key>` 槽形态一致，违者响亮 issue fail-closed） |
| 陈旧面独立扫描 | `grep -rn "Record 位\|delete 父位\|delete 的父 map 位\|父 map 位\|按边界规模" docs/ CONTEXT.md`（排除 0033/0034 自身）：命中仍恰 `docs/adr/0007-*.md`（条款正文 L74/L102/L122——已被新注记显式修订 + 注记自身 L137–138/L150–155）+ CONTEXT.md L144（转引短语 + 例外句限定）——与设计后报告 §2 扫描一致，**无新陈旧面** |
| SA3 证据工件（`artifacts/sa3-issue441-*`） | 聚焦 45/45（`FOCUSED_EXIT=0`）、根 typecheck `ROOT_TYPECHECK_EXIT=0`、根 test 471 files/5757 tests passed、探针 `checks=49 failures=12` 且失败集 diff 空（`EXACT_MATCH` = §12.1 命名 12 项：G1a/G1a2/G1b/G1c/G1d/G1e/G1f/G1g/G1i/G4a/G4b/G4c）；探针 sha256 本审独立复算 = `6030e0b8…97c1f9`（与 SA3 报告一致） |
| SA4 / SA9 报告 | 不存在（本复查触发源为设计要求的设计后→实现期复查，非 SA4/SA9 新决策面；实际 diff 触碰面 = 设计 ALLOW 面内） |

决策集状态：34 份 ADR 无 superseded 影响本审；ADR 0034 已接受为最新立法；`wiki/raw/` 为证据
非规范契约（docs/AGENTS.md Authority 节）。

## 3. Decision analysis

| Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0034 决策 1（Record set/delete fast path：导航验载体→键 Pattern→新值 schema+构造→单键 commit 旧值不读；delete `has` 拒 no-op；闸门非 union Record 形态；union map 位回退 legacy 永久双轨；值位 union 不阻断；issue 路径兼容） | 决策 1 全条 | `mutation-local.ts` `case 'parent': case 'record':` 内 `navigateHops` 后插入闸门 `plan.node.kind === 'object' ∧ resolve(boundaryNode).kind === 'map'`；F1 `carrierMismatchIssue([], 'Y.Map', boundaryLive)` → F2 `parentMap.has(key)`（presence，非值读）→ F3 `applyElementwiseEntryMutation(derived, plan, {has}, payload)` → F4 仅 set 做 `descendStructureNode`+`buildDetachedValue` → F5 commit 单键；legacy 代码纯插入后逐字保留（diff hunk `@@ -270,6 +289,59 @@` 为纯插入，上下文行零变化）；union 位由规划层冻结 kind=`union` 结构性隔离（本审在 `validate-patch.ts` 复核）；值位 union 不入闸门条件（plan.node 是容器节点） | **implements-existing-decision**（已立法决策的兑现落地） | diff `mutation-local.ts`；0034 L16–22；`validate-patch.ts` union 冻结 + 接缝守卫；探针失败集恰 12 项（G1 系连带拒绝→目标位成功翻转）+ G1k/G1l 载体位 PASS（F1 复刻成立） | 无 |
| ADR 0034 决策 2（封闭对象 delete 静态必填判定：optional ∨ `unknown` 标量允许；必填且非 unknown 拒；`has` 拒 no-op；同胞不重验；不读父值） | 决策 2 全条 | F3 经接缝 `judgeClosedObjectDelete`（#440 交付，零改动）——实现零新增判定逻辑，纯消费 | **implements-existing-decision** | diff（F3 单调用点）；0034 L24–31；探针 G1g 翻转（删除成功）+ G1h PASS（必填 delete 仍拒，`缺少必填字段`——SA2 N3 口径成立，G1h 不在失败集） | 无 |
| ADR 0034 决策 3（S9 收窄：安装事实核保留 / 重投影核省略 / legacy 双核不变 / E201 语义不变） | 决策 3 全条 | F5 返回 `verify: { kind: 'install-facts', facts }`（set → installed 同一性；delete → `!has`）；`install-verify.ts` **零改动**（git status）——`VerifyPlan`/`verifyBoundaryInstallFacts` 纯复用；`composeBatchVerify` 既有判别 `verify.kind !== 'boundary'` 零语句变化（mutation.ts 注释-only） | **implements-existing-decision** | diff（F5 + mutation.ts 注释）；0034 L33–35；探针 G4a/G4b/G4c 翻转（重投影核省略）+ G4d PASS（union legacy 双核）+ G4e/G4f/G4g PASS（事实核保留，NB 组） | 无 |
| ADR 0034 决策 4（触达面 = map/父载体 + 目标键位；污染容器写目标键合法即成功；载体位仍响亮拒绝） | 决策 4 全条 | fast path 无整 map walk / 无父值提取 / 无 sibling 读（diff 内仅 carrier + `has(key)` + 接缝 + 构造）；F1 载体错位同文案同 path `[]` 响亮拒绝（G1k/G1l PASS 逐字冻结） | **implements-existing-decision** | diff；0034 L37–41；ADR-0007 条款 4(i)（保持面，见下行） | 无 |
| **ADR-0007 issue #237 修订节条款 1/4(ii)/7 的 Record 位/delete 父位字面**（设计后复审唯一 evolution-required 项） | 条款 1（L72–78）/4(ii)（L100–107）/7（L121–124） | **修订义务已兑现**：文件末追加「ADR 0034 修订注记（2026-09-22）」（L142–159，+19 行，追加式零改写），三处条款字面显式修订（逐 entry/静态校验、触达面「map/父载体本身 + 目标键位」、O(新值)/O(1)），union/4(i)/其余边界种类明示逐字保持 | **implements-existing-decision**（evolution 计划落地闭合，见 §6 七要素实现后核对） | `git diff docs/adr/0007-*.md`（纯 +19）；本报告 §6 机械比对（HEAD/AUTH/CONTENT 三段逐字 = 设计 §7.6 建议文案）；0034 决策 1–4 | 无 |
| `docs/AGENTS.md` 两条义务句（显式修订而非静默矛盾；行为变化时更新每个契约陈述变化的规范文档） | Authority/Editing 节 | 唯一陈述契约变化的规范文档 = ADR-0007（陈旧面扫描恰一处 + CONTEXT 转引短语自洽）已同变更集修订；`git diff --check` 干净 | no-conflict（义务已兑现） | docs/AGENTS.md；§2 扫描行；`git diff --check` 无输出 | 无 |
| ADR-0010 issue #237 修订节后备句（L345–347） | 后备句 | 零改动（零漂移）；其 Record/父位含义由 ADR 0034 决策 4 标题显式点名扩展（0034 L37），ADR-0007 新注记末句同步登记（「该节已被其标题点名，无需另行注记」——沿 0033 注记 L139–140 先例句式） | no-conflict | `git status`（0010 不在修改面）；ADR-0007 L157–159；0034 L37；CONTEXT L202 同款后备句 + 0034 收窄句并存自洽 | 无 |
| ADR-0007 条款 4(i)/5/6/2/3 与其余边界种类句面（L83–119） | 注记作用域外 | 注记明示「按本节原文逐字保持」「不受影响」；diff 追加式未触碰 L1–140 任何行（`git diff` 无删除/修改行，仅尾部 +19） | no-conflict | `git diff`（纯追加）；ADR-0007 L83–119 原文在位 | 无 |
| ADR 0033 修订注记作用域句（L137–139「其余边界种类（union 穿越位、Record 位、delete 父 map 位）按本节原文逐字保持」） | 作用域句 | 零改写（追加式纪律）；新注记为时序在后的显式修订，作用域以新注记为准——新注记保持面（union 容器目标 + union 穿越 + 其余边界种类）与 0033 枚举的差额**恰为本次修订的两类边界**（Record 位、delete 父 map 位），层叠自洽（SA2 N2 承接） | no-conflict | ADR-0007 L137–139（原文在位）/L149–157（新注记保持面）；本报告 §6 补集核对 | 无 |
| ADR 0025/0026（guard 先于逐操作 prepare；批内路径互不嵌套；最小 edit；操作失败聚合零写入） | 实条款面 | guard/信封区零改动（mutation.ts 注释-only）；批量元素经同一 `prepareLocalMutation` 继承双轨；折迭跳过零代码变化；FA8/NC9/ND6 绿（根 test 5757 含之） | no-conflict | diff（无语句变化）；ADR 0026 L30/L36/L41；root-test.log | 无 |
| CONTEXT.md L144/L202（逐 entry 例外与触达面收窄已按 ADR 0034 目标状态立法，`0a91f14`） | 两词条 | 实现行为与词条目标态一致（逐 entry/静态、触达面、污染写目标键成功、载体位拒绝）；零改动需求成立——实现落地后无残留矛盾（L144 转引短语被例外句限定；L202 后备句为边界相对语义，随 ADR-0007 注记与 0034 标题扩展自洽） | no-conflict | CONTEXT.md L144/L202；`git status`（CONTEXT 不在修改面）；探针翻转集与词条语义一致 | 无 |
| packages/doc-runtime/AGENTS.md（校验失败零写入；公共面只经 src/index.ts；写后不变量失败 fatal） | 模块契约 | fast path 一切失败（F1/F3/F4）在 prepare 期 return，先于 `transactGuarded`；`src/index.ts` 零改动（零新公共导出；mutation-local 新 import 取自 `@nomicore/vfsl` 既有公共导出）；E201 变体 C/D 经未改动的 install-verify 分派 | no-conflict | diff；git status；public-surface-guard 绿（root test 471 files 含） | 无 |

计数：implements-existing-decision × 6（ADR 0034 决策 1/2/3/4 兑现 + ADR-0007 修订义务兑现）+
no-conflict × 7（docs/AGENTS.md 义务、ADR-0010、ADR-0007 作用域外面、0033 注记层叠、ADR
0025/0026、CONTEXT 两词条、模块 AGENTS）。**evolution-required × 0、hard-conflict × 0。**

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| ADR-0007 issue #237 修订节条款 1/4(ii)/7 的 Record 位/delete 父位整体语义 | ADR 0034（已接受 2026-09-22，决策 1–4）+ `docs/AGENTS.md` 义务句（设计后报告 §4 裁定，承继） | **该权威已在本变更集内被显式行使**：ADR-0007 追加「ADR 0034 修订注记（2026-09-22）」（授权链首段 + 作用域句 + 不变面），仅非 union Record 位与封闭对象 delete（逐 entry/静态校验、触达面 = map/父载体 + 目标键位、O(新值)/O(1)）；union map 位/union 穿越/其余边界种类/条款 4(i)/5/6/2/3 逐字保持 | ①注记与实现同变更集（已核，§6）；②实现后文本一致性复查（本报告，已闭合）；③无豁免需求（无在案 Controller 豁免） |

无 Owner 评论 override（comments = 空）；无协议版本升级主张；无决策文本自含演进条款被援引。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| update bytes / 事件形态（单键最小 edit、单事件、批量单事务单 update） | 复制协议与诊断捕获零回归 | ADR 0034 状态行；设计 §7.4 | `commitPrepared` set/delete 两支零改动（mutation.ts 注释-only）；ND1–ND6 + G5f/G5g/G5g2/G5j/G5k 绿（root test） |
| 错误分类：E201 变体 C/D、E203/E204/E205；issue path/message 逐字兼容 | fatal 分类不削弱；域规则兼容面 | ADR-0007 条款 5；0034 决策 1 | `install-verify.ts` 零改动；G1k/G1l 载体文案 path `[]` PASS；G4e/G4f/G4g E201-C PASS；G4d union E201-C PASS |
| 零写入纪律 | 一切失败零写入零 update | packages/doc-runtime/AGENTS.md；条款 5 | fast path 失败分支全部 prepare 期 return；NC 组 + G5 系绿 |
| 公共 API 面（`src/index.ts`） | 零新公共导出 | SA6 B-1；模块 AGENTS | git status 零改动；public-surface-guard 绿 |
| `planMutationBoundary`（规划层）/ vfsl 全包 | 完全不动 | 0034 决策 1/6 | `packages/vfsl/**` 零改动（git status；探针 P1a–P1i 全 PASS） |
| union map 位 / union 穿越 legacy 轨 | 永久双轨、行为逐字节一致 | 0034 决策 1 | legacy 分支纯插入后逐字保留；G4d/NC1–NC3/G5 系 PASS |
| vfsl 接缝与导出面（`applyElementwiseEntryMutation` 等） | #440 交付冻结 | 0034 决策 6 | 零改动；实现纯消费（F3 单调用点） |
| `install-verify.ts`（VerifyPlan/install-facts/共享事实核） | #436 建立，纯消费 | 0034 决策 3 | 零改动（git status） |
| guard/信封面（E1–E6） | 冻结 | ADR 0025/0026 | 零改动 |
| SA6 三件套测试 + 探针文件字节不变 | 红灯经实现自然转绿；探针 = 实现前遗产证据 | SA6 契约纪律；设计 §12.1 | 三件套 + 探针保持 untracked 原始态（探针 sha256 本审复算 `6030e0b8…97c1f9` = SA3 记录；失败集恰 12 项命名子集 `EXACT_MATCH`） |
| ADR 0033/0034、ADR-0010、CONTEXT.md、协议文档文本 | 零改动 | 设计 §11 DENY | git status：修改面恰 3 文件，上述全部不在内 |
| ADR-0007 L1–140 既有条款（含 0033 注记） | 追加式、零改写 | 设计 §7.6/§11 | `git diff` 纯 +19 尾部追加，无删除/修改行 |

## 6. Evolution requirements

设计后复审唯一 evolution-required 项（ADR-0007 条款 1/4(ii)/7 Record/父位字面）——**修订计划
已全部落地，实现后逐要素核对**：

| 要素 | 落地核对 | 判定 |
|---|---|---|
| 修订文件 | `docs/adr/0007-*.md` 末尾追加 `### ADR 0034 修订注记（2026-09-22）`（L142–159），紧随 0033 注记（L126–140）之后；`git diff` 纯 +19、既有 140 行零改写（追加式与 `ca0ab53` 先例 diff 形态一致） | ✓ |
| 新旧语义 | 注记逐句给出三处条款的旧→新：条款 1「投影→重建」→ 逐 entry/静态校验（set 键 Pattern+新值 schema 旧值不读 / delete `has` 拒 no-op / 封闭对象 delete 静态必填判定不读父值）；条款 4(ii)「Record 位」「delete 的父 map 位」→ 触达面「map/父载体本身 + 目标键位」、未触达损坏不再被发现（目标键合法即成功）；条款 7 成本句 → O(新值)/O(1)。三处条款原文（L74/L102/L122）与注记引句逐字吻合（本独立比对） | ✓ |
| 兼容与迁移 | 行为 ↔ 字面映射成立：实现 diff 的 F1–F5 与注记新语义逐条对应；探针 12 项翻转集 = 注记新语义的运行时确认；既有测试零迁移（无 tracked 测试文件改动） | ✓ |
| 失败语义 | 注记明示「载体形态违规（条款 4(i)）不受影响」；条款 5/E201 C/D/零写入经未改动机制保持（G4e–G4g/G1k/G1l PASS） | ✓ |
| 版本/授权 | 带日期（2026-09-22 = ADR 0034 受理日）+ 授权链首段（ADR 0034 决策 1–4 已接受 + docs/AGENTS.md 义务句 + ADR-0006 #64/#79、ADR-0008 #93/#132、本节先例）——与 0033 注记 L128–131 结构逐句同构；无 Owner 裕量需求（comments = 空） | ✓ |
| 验证 | §12 判据 1–4 全绿（聚焦 45/45、包 tsc、根 typecheck、根 test 471/5757——SA3 工件本审抽查一致）；判据 5（同变更集）见下行；探针确认信号 `EXACT_MATCH` | ✓ |
| 保持不变的冻结面 | 注记明示 union 容器目标/union 穿越/其余边界种类「按本节原文逐字保持」+ 4(i)「不受影响」；§5 冻结面表逐项 git status/diff 核对无违 | ✓ |
| **同变更集纪律**（设计后报告 §8 action 1） | 3 个 tracked 修改文件（源码 ×2 + ADR-0007）同处**同一未提交变更集**，HEAD 仍为基线 `3fd6aa8`（无中途提交、无次序分离）；`git diff --check` 无输出 | ✓ |
| **注记文本 = 设计 §7.6 建议文案**（SA2 N1） | 机械逐字比对（剥离引用定界符后）：标题/授权链段/修订内容段三段 **全部逐字相等**（HEAD=True、AUTH=True、CONTENT=True）；外层格式按文件既有惯例（标题+授权段平级、仅修订内容入引用块）与 0033 注记形态一致 | ✓ |
| **0033/0034 注记层叠自洽**（SA2 N2） | 0033 作用域句 L137–139 零改写；新注记（时序在后）保持面 = union 容器目标 + union 穿越 + 其余边界种类，与 0033 枚举（union 穿越位、Record 位、delete 父 map 位）差额恰为本次修订两类边界——层叠读法自洽 | ✓ |
| **测试重锚应急模板**（清单 ③） | **未触发**：无任何 tracked 测试文件被修改（`git status` 修改面恰 3 文件）——零放宽核对 vacuously 成立 | ✓（N/A） |

**七要素 + 三项复查清单全部闭合。** 设计后报告 §8 Required actions 1–3（同变更集/复查清单/
无新增阻塞）全部兑现；SA2 N1/N2 承接闭合（N3 由探针失败集不含 G1h 证实、N4 为行号定位事项
不涉规范面）。

## 7. Hard conflicts

**无。** 设计后复审裁定的唯一潜在硬冲突形态（「实现改变 ADR-0007 条款 1/4(ii) 所陈述契约而
不带显式修订」）已被同变更集注记封死并经本审逐字核对；行为面与 ADR 0034 决策 1–6 逐条相容
（承继设计后报告 §3 + 本审对实际 diff 的复检）；陈旧面扫描无新命中；ADR-0010/CONTEXT 零漂移
零残留矛盾。

## 8. Required actions

1. 无阻塞项。实现后复查清单（设计后报告 §8 action 2 ①②③ + 设计 §15 ①②③）已全部执行并
   闭合（本报告 §6）；④（fast path 管线不重开）按设计后报告既定边界跳过。
2. 提交时序提示（非 SA8 裁决面，转交 Controller）：3 文件须按 SA3 suggested commit message
   **同一提交**交付（同变更集纪律的最终载体）；SA8 不 commit/push（技能边界）。
3. 登记项（非本票义务，无行动）：设计 §13 O-1/O-2/O-3 残余观察与 ADR 0034 后果节 follow-up
   维持原登记；SA4/SA9 动态验证裁决不在 SA8 职责内。

## 9. Verdict

**clear** —— 实际 diff 触碰面恰为设计 §11 ALLOW 面（`mutation-local.ts` 闸门+F1–F5 纯插入、
`mutation.ts` 注释-only、`docs/adr/0007-*.md` 有界追加 +19）；全部对照项为
implements-existing-decision × 6 或 no-conflict × 7，无 evolution-required 残留、无
hard-conflict；设计后复审标记的唯一 evolution-required 项（ADR-0007 修订注记）已按完整计划
落地——文本与设计 §7.6 建议文案逐字相等、三处条款引句与原文吻合、授权链/不变面/同变更集
纪律全部兑现；全部冻结面（update 形态、错误分类、零写入、公共 API、规划层、union legacy 轨、
vfsl 接缝、install-verify、SA6 固定验收面、ADR 0033/0034/0010、CONTEXT、协议文档）逐项核对
无违反。`approve` 不是 SA8 verdict。

## 10. requiresConflictRecheck

**false** —— 设计后标记的三项复查理由已全部闭合：① 规范性文档修订已落地并经本审逐字/同
变更集核对（§6）；② 失败语义边界移动（E201 检出面收窄到目标键位）是 ADR 0034 决策 3/4 已
接受取舍，且 ADR-0007 注记 / ADR-0010 后备句（标题点名扩展，零漂移）/ CONTEXT L144/L202
与实现行为经本审确认无残留矛盾；③ 测试重锚未触发（零放宽 vacuously 成立）。diff 未引入
公共 API/wire/schema/持久化/状态机/生命周期/新 override 等待核面；实现后复查已闭合。
