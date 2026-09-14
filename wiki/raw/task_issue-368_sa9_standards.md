# SA9 Standards Review（仓库与工程标准轴）— Issue #368 W1：`@nomicore/doc-runtime` 载体级窗口原语（ADR 0028 缝 1）

- 派发：`sa-fc1ba9da-3cef-4bb0-8c03-80a37eebebe1`（role `mabf-sa9`，phase `standards-review`，iteration 0）
- **Verdict：`approve`**（无 BLOCKER、无 MAJOR；MINOR 5 项不阻断，见 §7）
- 审查对象：最终已提交 diff `36a73bb` → `1b13e7c`（`feat(doc-runtime): add deterministic carrier windows`，branch `mabf/issue-368` HEAD，13 文件纯新增 3786 行）
- Worktree：`/home/wangjian/nomicore-fix-issue-368`；跟踪面 == HEAD；未跟踪 = 任务简报、SA8 iteration-1 冲突报告、决策摘录、SA7 三枚 artifacts 日志（见 §7-M1）
- Owner 授权：`gh api …/issues/368/comments` 实证评论 **5652697060**（`welltop-jim-wang`，updated `2026-09-13T10:24:57Z`，issue 唯一评论）——**仅授权 schema 无关 W1 seam-1 在 ADR-0027 T1（#363）/T2（#364）之前开工与合入，显式排除 W2（#369）/W3（#370）**。本审查取证范围据此锁定
- 审查方式：静态实读 + 只读命令独立复核（`git diff` 范围核对 / `git diff --check` / 全仓 grep / 复制件逐函数对账 / vitest 与 tsconfig 入口实读 / GitHub REST 取证）。**未运行测试、未启动服务、未修改任何代码/设计/测试**——绿证据采信已入库 SA3/SA7 报告并抽验其自洽性

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-368.md`（Issue #368 正文 + AC1–AC6；Comments 空于简报快照） | 已读（未跟踪，见 §7-M1） |
| 母法 `docs/adr/0028-window-read.md`（状态行、决策 2/3/5/6/7/8/9、验收三缝） | 已读（基线 `36a73bb` 在库，HEAD 零 diff） |
| Owner 评论 5652697060（REST 全文） | 已取证实读 |
| 设计 `task_issue-368_design.md`（iteration 1，680 行；D1–D12、§8/§9/§11 ALLOW-DENY/§12/§15） | 已读全文 |
| SA2 评审 `approve`（0 BLOCKER / 0 MAJOR；iteration 0 的 1 MAJOR=SA2-F1 + 3 MINOR 全部销项；2 新非阻断观察） | 已读 |
| SA3 实现报告（45/45 契约绿、11/11 pins 绿、root typecheck exit 0、root 380 文件/4445 用例绿、4 突变探针全捕获、两处 pins 观察面完成声明） | 已读 |
| SA6 验收契约 `approve`（绑定 B-1…B-5、39 红 + 6 绿负控、§12.7 红线） | 已读 |
| SA7 动态验证报告 `approve`（三焦点运行时证实、2 突变有牙、pins 观察面交叉验证、§13 偏差声明） | 已读 |
| SA8 三轮：iteration 1 reject（时序）/ iteration 2 clear（override 实证）/ iteration 3 设计层 clear（D3/D4/D8 裁解释/空白填充） | 已读（iter2/iter3 已入库；iter1 未跟踪，见 §7-M1） |
| 决策摘录 `task_issue-368_relevant_decisions.md` | 已读（未跟踪，见 §7-M1） |
| SA4 产物 | **缺席**（`wiki/raw/task_issue-368_sa4_review.md` 不存在；SA7 §13-1 已声明；见 §7-M2） |
| 模块 `AGENTS.md`（root / packages/doc-runtime） | 已读（注入 + 实读） |
| 最终 diff 全部 13 文件（`src/window.ts` 747 行新、`src/index.ts` +19、契约 816 行新、pins 357 行新、两守卫加法、7 份 wiki 报告） | 已读/独立复核 |

## 2. 独立复核（非转述 SA 声明）

| 复核项 | 命令/方法 | 实测结果 |
|---|---|---|
| Owner 授权真实性与范围 | `gh api repos/:owner/:repo/issues/368/comments` | 恰一枚评论 5652697060，updated_at = `2026-09-13T10:24:57Z`（零编辑）；正向覆盖 #368 全部验收面（纯加法、schema 无关），负向排除 #369/#370；依据引 ADR 0028 决策 9 分层句与决策 6/状态行时序条款——与 ADR 原文抽读一致 |
| diff 范围 == 设计 ALLOW + 技能产物 | `git show --stat HEAD` | 恰 13 文件：`doc-runtime/src/{window.ts(新), index.ts(+19)}` + `test/{契约(新), pins(新), public-surface-guard(+16), public-surface-type-guard(+68)}` + 7 份 wiki 报告——与设计 §11 ALLOW 五行一一对应，无越界 |
| W2/W3 负向清单零触碰 | `git diff HEAD~1 HEAD --name-only -- packages/namespace-runtime packages/namespace-registry packages/vfsl docs CONTEXT.md` | **0 行输出**——lease 公共面 / registry 透传 / schema 通道 / vfsl 渲染器 / ADR 与词汇文档全部零 diff；override 负向清单兑现 |
| 冻结面零扰动 | `git diff HEAD~1 HEAD -- packages/doc-runtime/src/read.ts packages/doc-runtime/src/carrier.ts` | **0 行**——`read.ts` 零 diff 红线（D2）与 `carrier.ts` 复用不改性成立 |
| diff 卫生 | `git diff HEAD~1 HEAD --check` | 零输出（干净） |
| 测试削弱扫描 | grep `.(skip\|only\|todo)(` 于契约 + pins | 零命中 |
| 源码杂质扫描 | grep `console.`/`debugger` 于 window.ts | 零命中 |
| 测试确定性扫描 | grep `Date.now`/`Math.random`/`setTimeout` 于契约 + pins | 零命中 |
| 测试入口真实 | 实读 `vitest.config.ts`（runtime include `packages/*/test/**/*.test.ts`；typecheck include `*.test-d.ts`）、`packages/doc-runtime/tsconfig.json`（include 含 `test/**/*.ts`） | 契约/pins 两新文件被 root vitest 采集、被包级 tsc 检查；type-guard 走 typecheck 块——入口全部真实 |
| 契约文件未改性入库 | 实读契约头注/§绑定/fixture 段 + `grep -c "  it("` | 45 用例（与 SA6 §13「39 红 + 6 绿」计数一致）；§绑定常量 `readArrayWindowAtPath`/`readMapWindowAtPath` 与设计 D1 冻结逐字一致；头注红灯纪律与 SA6 §12.7 一致——从 untracked 原样转为 committed，内容零改动 |
| pins 计数与规格 | `grep -c "  it("` + 逐条对 D12 | 11 用例 = P1/P2/P2b/P3a/P3b/P4/P5/P6a/P6b/P7/P8，与 D12 锚点集一一对应；入口存在性断言在 `not.toThrow` 包装外（红灯纪律）；fixture 内联、不 import 契约文件 |
| 复制件逐函数对账（SA2-F4） | 从 read.ts 提取 9 原件逐一比对 window.ts 复制件 | `isNonNegInt`/`segMsg`/`yjsWord`/`isPlainRecord`/`readableOwnDataValue`/`readableArrayElement`/`navClassify`/`safeDetail`/`safeSpreadPath` 全部语义逐字一致（仅注释修剪/联合类型折行）；每件头注带 `copied from read.ts@36a73bb (<原名>)` 出处标记 |
| 公共面记账 | 实读两守卫 diff | 值面 P-W1（两导出存在 + typeof function）+ P-W2（命名空间 `/Window/` 键审计恰两枚，防别名）；类型面 13 名目正例 import/declare + 4 条 `@ts-expect-error` 编译期负例（语境外排序项 fail-closed）——AGENTS「守卫逐导出记账」兑现 |
| 结算形状与失败词表 | 实读 window.ts L166–239/L217–219 + pins P7 | 成功恰两键 `{ok,value}`（字面量构造）；失败恰四键 `{code,ok,path,message}`（键序与 P7 `Object.keys` 断言一致）；三窗口码名逐字 + `PATH_NOT_ALLOWED` 透传（D8）；path 新鲜副本（`safeSpreadPath`）；message 恒非空（`failureMessage` 回退） |
| 总序实现 vs 决策 5 + D3/D4/D10 | 实读 `classifySortKey`/`compareSortKeys`/`compareCandidates`/`compareCodePoints` | `Number.isFinite` 门（D4）；组间序恒定、dir 仅乘组内值序（决策 5）；平局/尾组锚 = 下标差值或码点比较器 asc 恒定（D3/D10/SA2-F2）；身份唯一 → 比较器全序，不依赖 sort 稳定性 |
| 零物化成本纪律 vs 决策 8 | 实读 `enumerate*Candidates`/`drillField`/M 段循环 | 候选枚举 = 原始读（typeof/carrierOf/isFinite 级 + descriptor 纪律）；field 基每 child 恰一次单段下钻；只物化前 `min(n,候选数)` 项；逐项物化字面调用公共姊妹 `readLogicalValueAtPath`（预算轴原样透传 / 两轴缺席 → 两参 legacy 调用） |
| 敌意 options 纪律 | 实读 `validateWindowOptions`/`validateOrderBy` | 宿主 plain 判定、封闭键空间、descriptor 读（accessor 拒且零执行、ownKeys 谎报忽略、值 undefined ≡ 缺席）、内层 try 收编 trap、零外抛；非法 options 在 N0 前短路（零 doc 触碰）；n ≥1 有限整数（G3 词表）；face 词表（readArray 拒 field/'key'、readMap 拒 'index'、判别键恰现其一） |
| 缺席不吸收 / 姊妹不回渗 | 实读 `navigate` | 缺键/越界 → `WINDOW_TARGET_ABSENT`（响亮）；纪律位（段型/终态/值域/detached/空洞）→ `PATH_NOT_ALLOWED`——与姊妹 D4 吸收位的唯一分歧逐字按 D7；姊妹侧零 diff（NC1 成对锁定） |
| 计数自洽抽验 | SA3/SA7 报告交叉核算 | SA3：4390 + 39 + 11 + 2 + 3 = 4445（root）、34 文件/729 包级（674 基线 + 45 契约 + 11 pins + 守卫增量自洽）；SA7 post-removal 复跑 56/56、34/729、`tsc` exit 0 与探针在场时一致；两报告命令与输出逐字在案、互不矛盾 |
| 临时诊断清理 | `git status --porcelain` + grep `SA7-DATAFLOW\|SA7 MUTATION` 于 packages/ | packages/ 零命中；SA7 探针文件已删除（不在 commit 内）；三枚 artifacts 日志为 untracked 观察记录（SA7 §10 声明不入 artifactPaths） |

## 3. 标准符合性逐项

### 3.1 Owner 授权范围（评论 5652697060）—— ✅ 逐条符合

| 授权条款 | 符合性 | 证据 |
|---|---|---|
| 覆盖 #368 全部验收面（选窗原语/条目列表/排序总序/零物化哨兵/三失败码/敌意 options 校验） | ✅ | window.ts 两入口 + D1–D11 全实现；契约 45 + pins 11 行为锚；SA7 三焦点运行时证实 |
| 纯加法、schema 无关 | ✅ | 仅 ALLOW 五路径新增/加法；read.ts/carrier.ts/既有测试零 diff；window.ts 比较实际数据值，零 schema 参与（无 vfsl/ValueSchema import） |
| 排 ADR-0027 T1/T2 之前开工与合入的豁免 | ✅ 按授权执行 | T1/T2 交付物在本 worktree 缺失（决策摘录 §8 实证），W1 对其零依赖；ADR 0028 时序条款约束对象（决策 6 投影文本）未被本 diff 触碰 |
| 不覆盖 W2（#369 lease 公共面） | ✅ | namespace-runtime/namespace-registry 零 diff；成功结算恰两键、不携带 `kept/total/truncated/schema` 投机字段（D9 不预占 W2 冻结面，pins P7 锚定） |
| 不覆盖 W3（#370） | ✅ | 零 schema 通道、零 lease 生命周期面接触 |

### 3.2 ADR 0028（母法）—— ✅ 逐项符合

| 条款 | 符合性 | 证据 |
|---|---|---|
| 决策 2 WindowTerm v1 词表（index/key/单段 field；dir 缺省 asc；语境外组合响亮拒绝） | ✅ | `validateOrderBy` face 词表 + 判别键互斥 + dir 枚举；契约 G4/G5；type-guard 编译期负例把词表编码进面专属 options 类型 |
| 决策 3 统一条目列表（`{index,value}`/`{key,value}`、身份随行、呈现序 = 有序基之序、空容器 → `[]`） | ✅ | M 段字面量构造（敌意键是属性值非属性名）；契约 D 组 + A6/B3 同构；pins P5（fresh → `[]`） |
| 决策 5 排序总序（组序恒定、dir 只翻转组内、平局锚 asc 恒定） | ✅ | §2 对账行；契约 A/B/C/H 组 + pins P2/P2b/P8 |
| 决策 7 三稳定码响亮不抛 + 敌意通道零外抛零 accessor | ✅ | 码名逐字；全部失败同步返回（pins P1 `not.toThrow`）；G6/G7 + SA7-A5 accessorRuns=0 |
| 决策 8 成本纪律（O(N) 枚举 + 每 child 一次下钻 + 只物化入选项；零物化哨兵） | ✅ | §2 成本对账行；契约 F1–F5（N=2000 哨兵）+ NC5 有牙；排序 O(N log N) 已经 SA8 iteration 3 #8 裁可 |
| 决策 9-子弹 1 分层（doc-runtime 载体级原语、schema 无关）+ readData/ADR-0024 options 零改动 | ✅ | 归属正确；read.ts 零 diff；窗口 options 是新独立形状（不复用不改姊妹校验，NC2 锚定） |
| 两处决策文本空白/张力（数组面「自 [0] 取」 vs 值键总序；投影失败第四码；non-finite 归组） | ✅ 按已裁路径钉死 | D3/D8/D4 经 SA8 iteration 3 #2/#7/#8 裁 no-conflict（解释/空白填充）；设计记录 + 必选 pins（P1/P2/P2b/P8）双锚定——SA8 注记 3 允许的双路径之一；未私改 ADR/CONTEXT（override 路径零文档改动，docs 零 diff 实证） |

### 3.3 ADR 0024 / 0016 / 0008 / 0003 —— ✅ 无违规

- 0024：readData options 闭合形状与 `READ_OPTIONS_INVALID` 家族零触碰（read.ts 零 diff）；预算两轴语义原样透传（≥0 有限整数、-0 归一 0）；零物化哨兵先例（埋毒必须 `ok:true`）由契约 F 组承接。
- 0016/0008：`readLogicalValueAtPath` 三参签名与无 options 语义逐字不变（零 diff + NC1/NC2/NC3 保持绿）；窗口逐项物化经同一公共入口，不新增第二条投影路径。
- 0003：ValueSchema 9-kind 冻结面零接触；条目列表是传输形态，不进 schema 口径。

### 3.4 模块 AGENTS 与根 AGENTS —— ✅ 无违规

- 「Add public APIs only through `src/index.ts`; public-surface guard tests must account for every export」：两值导出 + 13 类型名目仅经 index.ts（带 ADR 0028 缝 1 注释）；守卫 P-W1/P-W2 + 类型守卫逐名目记账，无别名绕过面。
- 「Keep reads schema-independent」：窗口读投影实际载体、比较实际数据值；零 schema 编译/校验参与。
- 「Never expose live writable ROOT/SCHEMA/META/prepared internal state」：无新内部态导出；`windowCore`/`navigate`/复制件全部模块私有。
- 「Run root `pnpm typecheck` / `pnpm test` when public types or read contracts change」：SA3 命令表（root typecheck exit 0；root 380 文件/4445 用例/no type errors）+ SA7 post-removal 复证在案；本角色不运行测试，计数自洽性已抽验（§2）。
- 根 AGENTS typed-writes 强制：不适用（本票零 mutation 面）；Instance replication/诊断日志/wire 技能条款：零接触面，不适用。

### 3.5 架构一致性（责任归属 / 相似能力 / 单一事实源 / 生命周期对称 / 平行机制）

| 检查 | 结论 |
|---|---|
| 责任归属 | 载体机械留在 doc-runtime（window.ts）；lease 结算/registry/vfsl 零触碰——分层边界与 ADR 0028 决策 9 一致 |
| 相似能力对照 | 窗口 = 姊妹读的编排镜像（G0→OPT→N0→N1→C→E/S→M→A），逐项物化字面复用公共姊妹——非平行机制；语境外排序项/缺席响亮的分歧点全部钉死并有可执行锚 |
| 单一事实源 | 载体判定单一（`carrierOf`/`probeRoot` 复用）；投影单一（`readLogicalValueAtPath` 字面调用）；9 件模块私有助手复制是 read.ts 零 diff 红线下的**已裁设计折衷**（D2），出处标记 + follow-up 登记（冻结解除时抽共享模块）使漂移可检——本审查逐函数对账确认当前零漂移 |
| 生命周期对称 | 纯读原语：零新增资源/句柄/订阅/后台任务/模块级可变态；`probeRoot` 惰性建 ROOT 属姊妹既有行为（SA7-A4 update 计数 0 实证） |
| 平行机制 | 备选（单入口+模式参数、orderBy 列表、抽取 read-shared、partial-selection 堆）均否决且未出现；无第二排序器/第二导航器 |

### 3.6 兼容性纪律 —— ✅

- 既有 674 用例基线与公共面零扰动（纯加法）；稳定码词表 append-only（三枚新窗口码 + 透传既有码，无改名无回收）。
- 无 wire/持久化/诊断记录/schema 形态变化；零强制迁移。

### 3.7 证据工件 —— ✅（缺角见 §7-M1/M2）

- 链：简报 → SA8×3（reject→clear→设计层 clear）→ SA6 契约（39 红 + 6 绿，红因 100% 能力缺失）→ 设计 iteration 1 → SA2 approve（F1–F4 销项）→ SA3（45/45 + 11/11 + root 全绿 + 4 突变捕获）→ SA7 approve（三焦点 + 2 突变 + post-removal 复跑）。
- 红→绿证据逐字在案；pins 实现前 11 红红因统一 = 入口存在性（SA3 验证表）。
- SA3 两处 pins 观察面完成（P2 以 `depth:0`、P2b 以前缀 + fail-fast 身份）三方留证（SA3 Deviations / SA7 §6 交叉验证为忠实等价观察 / 非阻塞 SA1 回写路由）——无静默分歧。

### 3.8 可维护性 —— ✅

- window.ts 文件头注完整（规范权威/编排/复制纪律/失败词表）；复制件逐件出处标记；公共类型逐件 doc 注释（含 D3 钉死语义）。
- commit message 符合 conventional 形态（`feat(doc-runtime): …`，与仓例一致）。
- 契约语义断言零改动由红转绿（diff 中两测试文件为纯新增，既有测试文件无一行改动——守卫两文件为纯追加块）。

## 4. 测试质量专项

| 维度 | 评估 |
|---|---|
| 行为断言纯度 | 全部断言运行时观察（结果联合/条目列表/own 键集/异常观测/Y.Doc 值）；无源码字符串断言、无 skip/only/todo、无 env override/fallback |
| 防同义反复 | P1 内建 NC5 同款负控（毒项经姊妹全量读必 `ok:false`——断言有牙非 fixture 坏）；P2 无预算 fail-fast 交叉锚（证明 depth:0 观察的必要性与等价性）；P4 fixture 健全性断言（'u' 确在原始键空间，排除侥幸通过） |
| 判别力证据 | SA3 四突变全捕获（静默跳项/non-finite 进 number 组/锚随 dir 翻转/UTF-16 码元序）+ SA7 两突变复证（契约仍绿而 pins/探针红——SA2-F1 伪绿通道封堵实证）；探针与突变均已还原/删除（sha256 复测一致） |
| 入口真实性 | 契约与 pins 的入口存在性断言在 `not.toThrow` 包装外，红灯红因统一为能力缺口——不混入包装断言 |
| 覆盖矩阵 | 契约 A–H 组（基×dir×组序×尾组×锚/条目形态/depth 等价/零物化/失败码/敌意 options/同构/确定性）45 用例 + pins P1–P8（钉死项）11 用例 + 守卫值/型两面——与 ADR 0028 缝 1 验收矩阵对齐 |

## 5. 需求覆盖声明（标准轴视角）

本审查不裁 Issue AC 是否完整实现（属 SA10）；仅记录：AC1–AC6 每条在设计 §12 有映射、在契约/pins 有行为锚、在 SA3/SA7 有绿证据；未发现验收断言被弱化（契约文件零改动入库、既有测试零改动）、未发现锚点与源码现状矛盾（复制件对账与守卫记账经本审查独立复核一致）。

## 6. 不需要冲突复查声明

标准轴 verdict 不改变公共 API/wire/schema/持久化/状态机/生命周期/失败语义/override 范围；SA8 三级门禁（iteration 2 override 实证 clear + iteration 3 设计层 clear；实现轮复查义务由 SA3/SA7 轮按 §15 清单承接并在两报告内闭环）在位，本审查无新增冲突面。

## 7. Findings（MINOR，均不阻断）

| ID | 严重度 | 内容 | 证据 | 建议路由 |
|---|---|---|---|---|
| M1 | MINOR | 任务简报 `wiki/raw/task_issue-368.md`、SA8 iteration-1 冲突报告 `task_issue-368_conflict_report.md`、决策摘录 `task_issue-368_relevant_decisions.md` 未跟踪，而全部下游产物已提交并以其为输入锚——commit 内证据链缺三件上游本体（issue 正文与 SA8 裁定可经 GitHub/流程记录恢复；SA7 三枚 artifacts 日志未跟踪属 SA7 §10 明示的「不入 artifactPaths」观察记录） | `git status --porcelain`：`??` 恰此六件 | Controller 入库卫生，随终审产物一并处理（issue-350 M2 同例） |
| M2 | MINOR | SA4 静态实现审查产物缺席（`wiki/raw/task_issue-368_sa4_review.md` 不存在）——证据链缺一环；SA7 §13-1 已声明并独立完成动态验证。本审查已对实现做静态实读复核（复制件逐函数对账、守卫记账、失败词表、成本纪律、测试卫生），未发现因缺 SA4 而漏检的标准违规；SA3 移交 SA4 的复核清单项（复制集对账/P1/P2 期望核对/message 非空/noUncheckedIndexedAccess 收窄）均已在本审查 §2 覆盖 | `ls wiki/raw/task_issue-368_sa4*` 无命中；SA7 §13-1 | Controller 确认 SA4 环节是有意跳过还是漏派；若补派，以 SA4 verdict 为准（本审查静态面已预核） |
| M3 | MINOR | pins P2 测试内联注释「两方向都恰装满 3 number + 2 string，尾组零入选」与实际窗口 `[n1,n2,s1,q1,q2]`（2 number + 1 string + 2 尾组——q1/q2 恰是 D12 指定的第 4/5 位尾组成员）不符；**断言本身与 D12 逐字一致且正确**，仅注释措辞错误 | pins 测试 L194–198 | 清理票改注释 |
| M4 | MINOR | window.ts L120 `readMapWindowAtPath` doc 注释首句「键面容窗口读」衍字（应为「键面窗口读」） | window.ts L120 | 清理票改注释 |
| M5 | MINOR | SA3 两处 pins 观察面完成（P2 以 `depth:0` 观察键序、P2b 以前缀 + fail-fast 身份观察）偏离 D12 字面期望——虽经 SA7 §6 独立交叉验证为忠实等价观察（null 孪生 doc 逐键相等）、杀伤面保持（突变 B 使 P2/P2b 红），但 D12 设计文本未回写，设计记录与可执行锚间留有文书落差 | SA3 Deviations §1/§2；SA7 §6/§13-3 | 已登记非阻塞 SA1 路由（回写 D12 观察纪律文本，勿动 ADR/CONTEXT）；随下次设计修订收口 |

## 8. Non-blocking observations

1. D3（数组面值键总序 vs ADR 注释「自 [0] 取」）与 D8（`PATH_NOT_ALLOWED` 成窗口可观察第四码）两处解释性钉死已经 SA8 iteration 3 #2/#7 裁 no-conflict，且各有可执行锚（契约 A 组、pins P1）；残余 = Owner/SA2 后续改采他读时按 §15 条件路径重开——在案（设计 §13-R1/R2），非本审查新增风险。
2. pins 文件从「可选」升格「必选」属 SA2-F1 验收充分性修复，SA2 §14-5 与 SA8 iteration 3 §8-6 双重背书为授权面内纯测试加法；不扩 Owner 授权面（设计 §1 注、SA2 §3 复核一致）。
3. wiki 产物随 feat commit 同提交（issue-330/350 同例）；commit message 较 SA3 建议稿简短，但符合 conventional 形态与仓内先例，无规范冲突。
4. SA7 root 全量（380/4445）在探针加入前采集、post-removal 以包级 + 定向复跑闭环（SA7 §13-4 已声明等价合取）；探针为临时文件未入库，最终 commit 态与已验证态一致（git status 跟踪面零改动）——严格字面下「最终 commit 态单进程全仓」缺一次复跑，但纯测试新增不触他包，风险近零（issue-350 M4 同类）。

## 9. 结论

最终 diff 忠实落地已批准设计（iteration 1）与 ADR 0028 缝 1 全部条款；Owner 评论 5652697060 的授权边界（仅 schema 无关 W1 seam-1、排除 W2/W3）经独立 diff 核对逐条兑现——namespace-runtime/namespace-registry/vfsl/docs/CONTEXT 零 diff，无 lease 四键结算、无 schema 通道、无投机字段；时序豁免按授权执行且 W1 对 ADR-0027 T1/T2 零依赖。冻结面（`read.ts` 零 diff、`carrier.ts` 复用不改、readData/ADR-0024 options、ValueSchema、wire、SA6 契约语义断言）全部零扰动；公共面纯加法且守卫逐导出记账齐备；复制件 9 件逐函数对账零漂移、出处标记在位；56 个新用例（契约 45 + pins 11）全部行为断言、入口真实、判别力有突变探针证据。证据链完整可溯（缺角见 §7-M1/M2）。无 BLOCKER、无 MAJOR；5 项 MINOR 均为文书/卫生/流程类，不阻断。按裁决规则：**approve**。
