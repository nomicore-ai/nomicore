# SA1 实现设计 — issue #441：doc-runtime Record/parent fast path 接线与 S9 收窄（ADR 0034）

- 任务类型：**Feature（能力接线）**——把 ADR 0034 决策 1–4 已立法、#440 已交付 vfsl 接缝
  （`applyElementwiseEntryMutation`）的消费侧接线到 doc-runtime mutation 管线，并对 fast-path
  提交收窄 S9 验证计划。
- 设计依据：`wiki/raw/task_issue-441.md`（任务简报，issue #441 正文）、
  `wiki/raw/task_issue-441_sa6_contract.md`（approved 验收契约 + 负控 + 探针）、
  `wiki/raw/task_issue-441_sa2_review.md`（**reject，2 MAJOR：F-SA2-1 / F-SA2-2**——iteration 1
  修订输入）、`wiki/raw/task_issue-441_design_conflict_report.md`（**SA8 设计后复审 reject，1 项
  evolution-required：ADR-0007 #237 修订节注记计划缺失**——iteration 1 修订输入）、
  `docs/adr/0034-record-and-parent-elementwise-validation.md`（母法）、
  `docs/adr/0033-elementwise-yarray-mutation-validation.md`（#436 数组先例）、
  `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` issue #237 修订节 + ADR 0033 修订
  注记（L62–140）、`docs/adr/0010-hub-peer-websocket-ydoc-replication.md` issue #237 修订节
  （L333–361）、`CONTEXT.md`「重建校验」「复制未校验」词条（L144/L202）、
  `wiki/raw/task_issue-436_design.md` §7.6/§7.7（#436 注记 + 重锚先例）。
- HEAD：`3fd6aa8b659420fd63d07b051139fe5f279556b8`（= SA6 契约 HEAD = SA2/SA8 评审 HEAD；
  分支 `mabf/issue-441`）。
- 上游产物核对（iteration 1）：`_sa2_review.md` 与 `_design_conflict_report.md` **已存在并作为
  本轮修订输入逐条落实（§14）**；`_relevant_decisions.md` / 前置 `_conflict_report.md` 仍不存在
  （`ls wiki/raw` 核对）——本轮起 SA8 约束面由**设计后冲突报告**承担（§6），其标记的
  requiresConflictRecheck 事项见 §15。
- **iteration 1 修订摘要**（相对 iteration 0；核心双轨设计经 SA2 逐点核验为健全，本轮不动其
  本体）：① 探针重新定性为**实现前（HEAD 时点）遗产证据**并给出逐 check 翻转分类（§12.1），
  删除「实现后探针 exit 0 不变 / 按目标行为断言仍全命中」的不实判据（F-SA2-1）；② 新增
  §7.6 **ADR-0007 issue #237 修订节修订注记计划**（授权链 / 范围 / 不变面 / 同变更集纪律 /
  正确引用）并把 `docs/adr/0007-*.md` 以**有界追加式**纳入 ALLOW LIST（F-SA2-2 + SA8
  evolution-required）；③ §15 更正 ADR 0026 引文错误（SA8 Required action 3）；④ §13 登记
  SA2 O-1/O-2/O-3 残余观察。

---

## 1. 任务类型、目标与非目标

### 目标

1. **闸门分流（AC1）**：`prepareLocalMutation` 的 `case 'parent' | 'record'` 分支改造为按闸门
   分流的双轨——map 位声明类型（ref 解析后）为非 union Record 形态、或封闭对象 delete 时走
   fast path；union map 位 / union 穿越保持 legacy 全量路径（永久双轨）；Record 值位为 union
   不影响 fast path（entry 整值替换，不读旧值判别）。
2. **O(n)→O(k)/O(1)（AC2）**：fast path 跳过 S5 整 map/父值提取、S6 全量重建 + `validateSubtree`
   整体判定、S9 边界重投影；Record set/delete 与封闭对象 delete 的结算只触达「载体 + 目标键位」。
3. **commit 形态不变（AC3）**：S8 提交仍是单键最小 edit（`commitPrepared` 的 `set`/`delete`
   两支零改动），update 事件数/字节、终态、复制收敛面零回归。
4. **零写入（AC4）**：fast path 一切失败分支（载体错位、no-op、键 Pattern、值 schema、静态
   必填、构造失败、批量聚合失败）先于任何 live Y.Doc 写，零 update 事件。
5. **S9 收窄（AC5）**：fast-path 提交的验证计划为 `install-facts`（仅安装事实核——`get`/`has`
   同一性，O(1)）；legacy 轨双核（事实核 + 边界重投影核）逐字不变；E201 变体语义
   （`DocRuntimeFatalError` / `post-commit-verification` / `committed:true`）不变。
6. **门禁（AC6）**：包测试 + 根 `pnpm typecheck` + `pnpm test` 绿（SA6 契约 18 条转绿、负控
   27 条与既有 469 files 保持绿——判据枚举见 §12）。
7. **（iteration 1 新增）规范文档一致性（F-SA2-2 / SA8 Required action 1）**：ADR-0007 issue
   #237 修订节的陈旧句面随实现以**同变更集修订注记**显式修订（§7.6）——`docs/AGENTS.md` 义务句
   的兑现，非可选项。

### 非目标

- 不改 vfsl 侧任何代码（`applyElementwiseEntryMutation` / `planMutationBoundary` /
  `applyMutationAtBoundary` 已由 #440/#237 交付并冻结——ADR 0034 决策 6「复用而非另起平行机制」）。
- 不改 `install-verify.ts`（`VerifyPlan` 判别联合 + `verifyBoundaryInstallFacts` 共享单实现 +
  `verifyPrepared` 分派器已由 #436 建立，本票纯消费）。
- 不动 union map 位 / union 穿越（kind=`union`）、kind=`target`（封闭对象 set）、kind=`array`
  （#436 已收窄）、`set([])` 全量重装、批量原子语义与路径嵌套规则。
- 不引入新的公共导出（fast path 是包内管线改造；契约只锚公共 `applyValidatedMutation` 的
  运行时行为——SA6 §12.1 绑定点 B-1）。
- 不建 raw-replication 污染的异步/抽样审计（ADR 0034「不做什么」）。
- 不做历史/回滚前像捕获（被删 entry 旧值需主动读——ADR 0034「不做什么」仅记录）。
- **不修改 SA6 固定验收面**：契约三件套（`issue-441-record-fastpath-{contract,control,fixture}`
  与探针 `task_issue-441_sa6_capability_probe.mts`）是固定证据，实现只使其中的红灯契约**经
  实现自然转绿**；探针是实现前遗产证据（§12.1），其实现后翻转是**预期确认信号**，不是回归，
  也不是「修改探针以保绿」的授权（修改即伪化 SA6 固定证据）。
- **文档修订面有界**（§7.6/§11）：规范文档仅追加 ADR-0007 修订注记一处；ADR 0033/0034、
  CONTEXT.md、ADR-0010、协议文档零改动（SA8 已确认其自洽）。

---

## 2. 当前行为与证据锚点

### 入口与调用链（HEAD）

| 环节 | 符号锚点 | 现状 |
|---|---|---|
| 公共入口 | `packages/doc-runtime/src/mutation.ts` `applyValidatedMutation`（L141–170） | 信封解析 → `prepareMutation` → 单/批量分派 → `transactGuarded` 单事务提交 → `verifyPrepared` |
| 单操作 prepare | `mutation.ts` `prepareMutation`（L172–225）→ `prepareLocalMutation` | guard 评估 → `set([])` 分流 legacy 全量 ROOT 管线 → 其余走局部管线 |
| 局部管线 | `packages/doc-runtime/src/mutation-local.ts` `prepareLocalMutation`（L221–499） | S3 `planMutationBoundary` → switch(plan.kind)：`target`（L229）/ `parent|record`（L266–310）/ `array`（L312–421，#436 双轨）/ `union`（L423–498） |
| **本票改造面** | `mutation-local.ts` L266–310 `case 'parent': case 'record'` | 无条件 legacy：S4 `navigateHops` → S5 `walk(boundaryNode, boundaryLive, [], resolve)` 整 map/父值提取 → S6 `applyMutationAtBoundary` 拷贝式重建 + 整体校验 → S7 `buildDetachedValue` → verify=`boundary`（双核） |
| S9 分派 | `packages/doc-runtime/src/install-verify.ts` `VerifyPlan`（L439–441）+ `verifyPrepared`（L444–453）+ `verifyBoundaryInstallFacts`（L399–431，两轨共享单实现）+ `verifyBoundaryIntact`（L465–500，事实核+重投影核） | `install-facts` 变体已存在，目前仅被数组 fast path 消费 |
| 批量面 | `mutation.ts` `prepareBatchMutation`（L235–319）逐元素复用 `prepareLocalMutation`；`composeBatchVerify`（L335–387）对 `verify.kind !== 'boundary'` 项跳过折迭（L362，#436 建立，判别泛化） | record/parent 批量元素当前恒为 `boundary` 计划 |
| vfsl 接缝（已交付） | `packages/vfsl/src/validate-patch.ts` `applyElementwiseEntryMutation`（L1219–1289）+ `judgeClosedObjectDelete`（L1178–1195）+ `EntryCarrierFacts`/`ElementwiseEntryMutationPayload`（L1161–1169）；`packages/vfsl/src/index.ts` L145 公共导出 | schema 静态事实 + `{has}` O(1) 在场性 + 载荷上结算；对违约计划 fail closed；SA6 §5.5 S1 实测达标 |
| 规划层闸门形状 | `validate-patch.ts` `planMutationBoundary`（L742–825）：union 首次穿越即冻结 kind=`union`（L798–801）；set 经 Record 槽升边界 kind=`record`（L815–820）；delete 终段 `finalViaRecord ? 'record' : 'parent'`（L806–809）；`node = descendValues(values, prefix)` 已归一化非 ref/非 optional（L722） | union map 位结构上进不了 record/parent 分支（探针 P1d/P1i） |

### 关键运行时事实（SA6 契约与探针在 HEAD 实测——**实现前时点证据**，探针逐 check 实现后分类见 §12.1）

- 触达面外污染照旧阻断写：G1a（兄弟 entry 载体错位，issue path `["t2"]` 边界相对）、G1d（兄弟
  值非法，S6 面）、G1e（兄弟键 Pattern 违约，S6 面）、G1g/G1h（封闭对象兄弟字段污染使 delete
  被父值载体错位转判，而非静态必填判定）。
- 读计数 ∝ n：Record set n=512→2049 / n=4096→16385；delete 2046/16382；封闭对象 delete 4 字段→8、
  14 字段→28（§5.3）。
- S9 双核覆盖全部 record/parent 提交：G4a/G4b/G4c 触达面外篡改 → E201-C（重投影核）；G4e/G4f/G4g
  目标键篡改 → E201-C（安装事实核，两轨共享单实现本就生效）。
- 载体位（map/父载体本身非 Y.Map）响亮拒绝：G1k/G1l，`Yjs 载体错位（ROOT）：期望 Y.Map，实际
  plain value`、path `[]`——legacy S5 首错（`extract.ts` `walk` map 分支 L101 `mismatch(path,'Y.Map',live)`
  起步 path `[]`；`carrierMismatchIssue` L364）。
- union 穿越成员内 Record 新键写 + 污染兄弟 → 既有 `DOCRT-E204`（E8）：plan.kind=`union` 不入
  record 分支，与本票无关，登记不改。

---

## 3. 根因 / 能力缺口（承接 SA6，不虚构 Bug）

HEAD 在 phase-1 契约下自洽（负控 27/27 恒绿）：「整 map/父值提取 → 全量重建 → 边界重投影」
是 #237 立法的正确行为。缺口是 **ADR 0034 决策 1–4 的 doc-runtime 落点不存在**：

1. 执行层只有「legacy 全量边界路径」单轨——`case 'parent'|'record'` 无闸门（对照：数组分支
   已有 #436 双轨）；
2. vfsl 逐 entry 接缝已就绪但零消费（`applyElementwiseEntryMutation` 仅测试引用）；
3. S9 的 `install-facts` 变体仅被数组 fast path 消费，record/parent 恒走 `boundary` 双核。

放大因素：索引型大 map（`tasks`/`users`）每写付出 S5+S9 两次全 map walk（10⁵ entry 单键写
1115 ms vs 10³ 12 ms，探针 G3c 软证据）；父值提取把「schema 静态必填判定」变成数据依赖拒绝
（G1h issue 归因错位）。

---

## 4. Owner 要求落实

**无 owner 评论要求**：Host 简报明文「Current REST comment read returned no comments, so there
are no owner-comment requirements」；issue 正文 Comments 段为空（`wiki/raw/task_issue-441.md`
L38–39）。SA6 契约 §2、SA2 §4、SA8 报告（「Issue REST comments：空」）同结论。全部要求源自
简报 AC1–AC6 + ADR 0034：

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无评论） | — | 简报 AC1–AC6（= 下表） | §7/§8/§12 |

| 简报条目 | 要求 | 设计落点 |
|---|---|---|
| AC1 | 闸门正确：非 union Record 位与封闭对象 delete 走 fast；union map 位回退 legacy；Record 值位 union 仍 fast | §7.2 闸门（值侧 `plan.node.kind==='object'` ∧ 结构侧 resolved map；union 位由规划层冻结为 kind=`union` 天然隔离；值位 union 不入闸门条件） |
| AC2 | 不再提取/重建整个 map（10⁵ 单键写与 n 解耦） | §7.3 F1–F5 步骤；FB1–FB3 读计数锚 |
| AC3 | commit 的 update 事件形态不变 | §7.4（`commitPrepared` 零改动；ND1–ND6 字节 oracle） |
| AC4 | fast path 一切失败分支零写入、零 update | §9.1（一切拒绝先于事务；NC 组锚） |
| AC5 | S9：fast-path 仅安装事实核；legacy 双核不变；E201 变体语义保持 | §7.5（复用既有 `install-facts`；install-verify.ts 零改动） |
| AC6 | 包测试 + 根 typecheck/test 绿 | §12（判据枚举；探针行已按 §12.1 重写） |

---

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| 规划闸门形状可得：P1a/P1b（record 计划、object 节点含 `<key>` 槽）、P1c（parent 计划、无 `<key>` 槽）、P1d（union map 位 → kind=`union`）、P1e（值位 union 不改变闸门 kind）、P1f（深路径同型）、P1h（封闭对象未知字段规划层即拒） | SA6 §5.1；探针 `wiki/raw/task_issue-441_sa6_capability_probe.mts`（49 项，HEAD 时点 exit 0——实现后翻转分类见 §12.1） | 闸门只消费 `plan`（kind/node）+ 结构侧 resolved 节点——规划层零改动（SA6 §11「规划层需要改动」已排除） |
| HEAD 能力缺口：G1a–G1i（一律 legacy 连带拒绝/父值转判）、G3（读计数 ∝ n/字段数）、G4（双核覆盖全部提交） | SA6 §5.2–§5.4 | §7 双轨设计精确消除这三面；G1k/G1l（载体位拒绝）逐字保留（F1） |
| 接缝已就绪：record/parent 计划 set/delete 判定达标、union 计划 fail closed、issue 路径 rebase 逐字节兼容 | SA6 §5.5 S1；`validate-patch.ts` L1219–1289 | F3 直接消费接缝；接线侧闸门先行（union 计划不得喂入接缝） |
| 红契约 18 条 + 负控 27 条 + 探针 HEAD exit 0；聚焦 5 轮红灯集合 md5 稳定 | SA6 §13；`artifacts/sa6-issue441-*` | §12 验收映射逐组对应；**实现后判据 = 契约 18/18 + 负控 27/27 + 包 tsc + 根 gates（§12 枚举）；探针 exit 0 仅是实现前基线的复现条件，不是实现后判据（§12.1，F-SA2-1）** |
| yjs `afterTransaction` cleanup 先于 S9 验证派发 ⇒ 篡改对两轨验证可见 | SA6 §7 时序前提 | §9.3 并发/时序不变量沿用（NB 组锚定目标位检出） |
| union 穿越 E204 既有观察（E8） | SA6 §9 E8/§15 | 范围外登记，不改（plan.kind=`union` 不入 record 分支） |

源码与上游事实无矛盾（`mutation-local.ts` L266–310 与 SA6 对现状的描述逐条吻合；SA2 §6
「行号锚点全部对齐」独立核验）。

---

## 6. SA8 约束落实

前置门禁工件（`_relevant_decisions.md` / 前置 `_conflict_report.md`）不存在；**iteration 1 起
SA8 约束面由设计后冲突报告 `wiki/raw/task_issue-441_design_conflict_report.md` 承担**（其对
iteration 0 的 reject 见 §14/§15 落实）。合并约束表（ADR 0034 决策 + SA8 报告 §3 裁决）：

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| ADR 0034 决策 1（Record set/delete 逐 entry fast path + 闸门 + 永久双轨 + 值位 union 不阻断；规划层不动） | §7.2/§7.3 | 闸门双条件合取 + F1–F5；`planMutationBoundary` 零改动 | 否（照抄决议；SA8 裁决 implements-existing-decision） |
| ADR 0034 决策 1 管线（set：导航+验载体→键 Pattern→新值 schema+detached 构造→单键 commit 旧值不读；delete：`has` 拒 no-op；issue 路径 `[...mapPath, key]` 逐字节兼容） | §7.3 F1–F5 | 步骤序与决议逐条对应；路径兼容由 #440 接缝保证（SA6 S1 实测） | 否 |
| ADR 0034 决策 2（封闭对象 delete 静态必填判定；optional ∨ `unknown` 标量允许；`has` 拒 no-op；同胞不重验；不读父值） | §7.3 F3（接缝 `judgeClosedObjectDelete`） | 零新增判定逻辑，纯消费 | 否 |
| ADR 0034 决策 3（S9 收窄：事实核保留 / 重投影核省略 / legacy 双核不变 / E201 变体语义不变） | §7.5 | 复用 #436 `install-facts` 变体；`install-verify.ts` 零改动 | 否（行为面；检测面语义移动纳入 §15 ①③） |
| ADR 0034 决策 4（触达面 = map/父载体 + 目标键位；污染容器写由连带拒绝变为目标位合法即成功；载体位仍响亮拒绝 ADR-0007 #237 条款 4(i)；**标题点名「扩展 ADR-0010 issue #237 修订节」**） | §7.3 F1、§9.1、§7.6 | F1 载体检查逐字复刻 legacy S5 首错；触达面外不读不修；规范落点见下两行 | 见下两行 |
| **ADR-0007 issue #237 修订节条款 1 / 4(ii) / 7 的 Record 位 / delete 父 map 位字面**（边界投影重建句 L72–78；边界内既存非法响亮拒绝句 L102–103；成本句 L121–122）——SA8 裁决 **evolution-required** | **§7.6（新增注记计划）**、§11 ALLOW（有界追加） | 按 #436 §7.6 / ADR 0033 注记先例（`ca0ab53`）以**带日期 + 授权链的追加式修订注记**随实现同变更集显式修订（建议文案 §7.6）；union 位与其余边界种类逐字保持 | **是**（§15 ①②：注记文本与条款原句/ADR 0034/ADR-0010 引句一致性 + 同变更集 git diff 核对） |
| ADR-0007 条款 4(i)/5/6/2/3 与其余边界种类句面（L83–119/L137–139 注记作用域句） | §7.6 不变面清单、§9 | 注记文案明示「按本节原文逐字保持」「不受影响」；E201 C/D、零写入、fatal 分类保持（SA8 裁决 no-conflict） | 否（注记落地后随 §15 ①核对作用域句） |
| **ADR-0010 issue #237 修订节后备句**（L345–347；授权链引 ADR-0007 损坏条款为单一真相源） | §7.6 末句 + §15 ① | Record/父位含义**已被 ADR 0034 决策 4 标题显式点名扩展**——沿 0033 注记先例句式「该节已被其标题点名，无需另行注记」；ADR-0007 注记落地后单一真相源引用链自洽（SA8 裁决 no-conflict） | 是（§15 ①：实现后复查 ADR-0010 句面与注记后语义无漂移） |
| `docs/AGENTS.md` 义务句（「Amend or supersede prior decisions explicitly…」「When code behavior changes, update every normative document whose stated contract changed」） | §7.6、§11 | 注记为本票**默认交付物**（ALLOW 无条件项）；豁免仅 Controller 明示裁决（SA8 Required action 1/2 兑现） | 否（义务在票内兑现；落地核对随 §15 ①②） |
| ADR 0025 / ADR 0026（guard 先于逐操作 prepare；**批内路径互不嵌套 L30；最小 edit L36；操作失败聚合零写入 L41**） | §7.5 批量面 | guard/信封区零改动；批内 record 兄弟异键由非嵌套结构性保证；commit 单键最小 edit；批量失败聚合零写入（NC9） | 否 |
| ADR 0034 决策 5（容器约束逐 entry 可组合立法；禁止 map 级约束特判） | §7.3 | 接缝单 entry 合成视图过共享解释器，无容器级特判 | 否 |
| ADR 0034 决策 6（复用 0033 seam 语义，不另起平行机制） | §7 整体 | 镜像 #436 数组接线结构（闸门+F1–F5+install-facts） | 否 |
| ADR 0034 后果节（验证面：双轨/零写入/S9 收窄/public-surface guard/基准/根 gates） | §12 | SA6 契约 + 负控已固化；本设计零新公共导出 | 否 |
| `packages/doc-runtime/AGENTS.md`（校验失败零写入；公共面只经 `src/index.ts`；写后不变量失败 fatal） | §7.4/§9 | 全部拒绝先于事务；零公共面变化；E201 语义不变 | 否 |
| CONTEXT.md L144/L202（逐 entry 例外与触达面收窄**已按 ADR 0034 目标状态立法**——`0a91f14` 同批） | §1/§7 | 零词汇改动声明成立（SA8 §3 核对 `git show 0a91f14 -- CONTEXT.md`）；L144 转引短语随 ADR-0007 注记自洽 | 否 |
| SA6 契约 §3/§12.1/§12.2（替代约束面 + 绑定点 B-1..B-6 + 目标行为 1–8） | §5/§12 | 逐条消费；契约三件套 + 探针 DENY（修改即伪绿）；**其中 §12.2-8 的「探针 exit 0 不变」半句与探针自身断言不相容（§12.1），实现后判据以 §12 枚举为准——固定工件不改，登记处置** | 否（判据歧义已在 §12.1 消除） |
| 根 `AGENTS.md`（typed writes/schema authoring/协议族） | §8/§10 | 零 schema/零 Namespace 数据面/零 wire 变更（update bytes 冻结 ND1–ND6） | 否 |

---

## 7. 设计决策与主要备选方案

### 7.1 改造位置与总体形态

唯一行为改造点：`packages/doc-runtime/src/mutation-local.ts` 的 `case 'parent': case 'record':`
分支（L266–310）——在 S4 `navigateHops` 之后、S5 `walk` 之前插入闸门；闸门命中走 fast path
（新代码），未命中落入既有 legacy 代码（**逐字保留**，与 #436 数组分支同款永久双轨）。
`mutation.ts` 仅做注释刷新（模块头 + `composeBatchVerify` 折迭跳过注释提及 record/parent——
行为零变化）。`install-verify.ts` / vfsl / `index.ts` 零改动。**文档面：`docs/adr/0007-*.md`
追加一处修订注记（§7.6），与实现同变更集。**

### 7.2 闸门（ADR 0034 决策 1/2；双条件合取，均 O(1)、与数据规模无关）

```ts
const resolvedBoundary = resolve(boundaryNode);
if (plan.node.kind === 'object' && resolvedBoundary.kind === 'map') {
  // ── fast path（F1–F5）──
}
// ── legacy 全量边界路径（代码与 HEAD 逐字一致，永久回退）──
```

- **条件一（值侧）**：`plan.node.kind === 'object'`——`plan.node` 已由 `descendValues` 归一化
  （非 ref/非 optional，`MutationBoundaryPlan.node` JSDoc）。union map 位在规划层即冻结为
  kind=`union`（`planMutationBoundary` L798–801：union 首次穿越即冻结），**结构上进不了本
  分支**（探针 P1d/P1i）——闸门无需再判 union。Record 值位为 union（`blobs`，`<key>` 槽值节点
  kind=`union`）**不参与闸门条件**（P1e：容器形态是 object 即 fast；值位 union 由 F3 的
  `validateSubtree` any-of 判别新值，与数组案「元素 union 不阻断、目标 union 阻断」同构）。
- **条件二（结构侧）**：`resolve(boundaryNode).kind === 'map'`——fast path 的 F1 载体检查、
  F4 detached 构造依赖结构树 map 节点（`descendStructureNode`/`mapChildNode` 查 `<key>` 槽）。
  两树由同一 schema 求值产出，kinds 恒一致；不一致（仅手造派生物可达）时合取为假 → 回退
  legacy（失败方向是「多验证」而非「漏验证」，绝不误接管——镜像 #436 数组闸门注释）。
- **第三重锁**：接缝 `applyElementwiseEntryMutation` 自身对违约计划 fail closed（kind∈{record,
  parent} ∧ relPath 单段 string ∧ 边界值节点 object ∧ kind↔`<key>` 槽形态一致，四条件违者响亮
  issue，`validate-patch.ts` L1226–1248）。若两树仅在槽形态上分歧（值侧 object ∧ 结构侧 map 但
  `<key>` 槽不一致，仅手造可达），闸门合取仍真、接缝第三锁响亮拒绝（ok:false 零写入）——
  fail-closed 方向，不静默接受。
- **resolve 抛错分类**：闸门处 `resolve` 抛 `DerivedInvariantError`（ref 环/缺名，仅手造派生物
  可达，`resolve.ts` L25/L33）与 legacy walk 内 resolve 抛错同 try/同 catch/同分类（经
  `prepareMutation` 顶层 catch → E204）——镜像 #436 数组闸门 O-4 纪律。

### 7.3 fast path 管线（F1–F5；镜像 #436 数组分支 F1–F5 结构）

前置：`boundaryNav = navigateHops(derived, doc, mutation.path.slice(0, -1), resolve)`（既有
S4，逐 hop 载体/在场检查，零改动）；`boundaryLive`/`boundaryNode` 即 map 位 live 与结构节点。

- **F1 载体检查（O(1)）**：`carrierOf(boundaryLive) !== 'Y.Map'` →
  `return walkResultIssues(carrierMismatchIssue([], 'Y.Map', boundaryLive))`——与 legacy S5 首错
  （walk 以 path `[]` 起步）同文案同 path（`Yjs 载体错位（ROOT）：期望 Y.Map，实际 <实际载体>`，
  path `[]`）。触达面内的载体位仍响亮拒绝（ADR-0007 #237 条款 4(i)；NC10/NC11/G1k/G1l 冻结）。
- **F2 在场性事实（O(1)）**：`const parentMap = boundaryLive as Y.Map<unknown>;`（F1 已证载体）；
  `const key = mutation.path[mutation.path.length - 1]!`（planner 保证 string：set/delete 终段
  数字下标在 S3 即拒——`planMutationBoundary` L756–769；record/parent 计划 relPath 恒单段
  string；防御性 `as string` 与 legacy 分支同款）；`const has = parentMap.has(key)`。
- **F3 域规则 + 逐 entry 校验（接缝；O(正则)/O(新值)）**：
  `applyElementwiseEntryMutation(derived, plan, { has }, payload)`，`payload = mutation.op === 'delete'
  ? { op: 'delete' } : { op: 'set', value: mutation.value }`。`!verdict.ok` →
  `{ kind: 'fail', issues: issuesOf(verdict) }`（零写入）。接缝覆盖并逐字冻结：
  - Record set：键 Pattern + 新值过值 schema（单 entry 合成视图 `{[key]: value}` 过共享解释器
    `validateSubtree`，旧值不读；`'__proto__'` 计算键展开落自有属性）；issue 路径 rebase
    `[...plan.prefix, ...issue.path]` = `[...mapPath, key, ...值内路径]`（NC2/NC3/NC8 逐字）。
  - Record delete：仅在场/no-op 域规则（`has=false` → `delete 目标键不存在（拒绝 no-op）`
    path `[...mapPath, key]`；`has=true` → 成功——空对象合法 ⇒ 删除永不使 Record 非法）；不查
    键 Pattern、不触碰其他 entry（NC1/NC6）。
  - 封闭对象 delete：`has=false` → no-op 拒绝；否则静态必填判定（optional ∨ ref 解析后
    `scalar ∧ type='unknown'` → 允许；否则 `缺少必填字段 "<key>"` path `[...父路径, key]`）——
    不读父值、同胞字段不重验（FA10/NC4/NC5）。
- **F4 detached 构造（仅 set；O(新值)）**：`const childNode = descendStructureNode(derived,
  mutation.path)`（结构树静态下钻，`<key>` 槽取值节点——值位 union 时为 union 节点，
  `buildUnion` 试验构造，`detached-build.ts` L140–148；纯值+schema 构造，零 live 读）→
  `buildDetachedValue(derived, childNode, mutation.value, mutation.path)`——与 legacy 分支同一
  符号、同一 issue 路径构造（`built.kind === 'issue'` → `failIssue`，零写入）。
- **F5 收窄验证计划**：返回
  `{ kind: 'ok', commit, verify: { kind: 'install-facts', facts } }`，其中
  - delete：`commit = { kind: 'delete', parent: parentMap, key }`、
    `facts = { kind: 'delete', parent: parentMap, key }`；
  - set：`commit = { kind: 'set', parent: parentMap, key, value: built.value }`、
    `facts = { kind: 'set', parent: parentMap, key, installed: built.value }`。

步骤序（F1→F2→F3→F4）与 legacy「S5 载体 → S6 域规则/校验 → S7 构造」同序：载体错位先于
域规则、域规则先于构造；一切失败先于 `transactGuarded`（零写入纪律）。

### 7.4 S8 提交（零改动）

`commitPrepared` 的 `set`/`delete` 两支（`mutation.ts` L485–490）零改动——commit 本就是
O(1) 单键最小 edit（`Y.Map.set`/`Y.Map.delete`）。AC3 由构造保证：终态与增量字节 ≡ 同
clientID 手写最小 edit（ND1–ND4 字节 oracle；yjs 单键 edit 的确定性产出与上层校验路径无关）、
恰 1 个 update 事件、批量单事务单 update（ND6）、同基态对端应用增量后逻辑值一致（ND5）。

### 7.5 S9 验证（复用既有机制，零新增核）

- fast path：`verify.kind = 'install-facts'` → `verifyPrepared` → `verifyBoundaryInstallFacts`
  （O(1)：set → `parent.get(key) === installed` 同一性；delete → `!parent.has(key)`）。
  **无 `proposedBoundary` 可比对——边界重投影核省略**（ADR 0034 决策 3；FC1–FC4 的目标行为）。
  目标键覆写/重插/同值异实例仍 E201-C（NB1–NB4；`yjs` 按引用存储，同值重插不误报、异实例必
  偏离）；核自身异常 → E201 变体 D（防线未能运行，绝不假成功）。
- legacy 轨（union map 位 / union 穿越 / 手造两树分歧回退）：`verify.kind = 'boundary'` 双核
  逐字不变（NA3/NA4/NB5）。
- **批量面**：批量元素复用同一 `prepareLocalMutation` ⇒ record/parent 元素自动继承双轨。
  `composeBatchVerify` 既有判别 `if (verify.kind !== 'boundary') continue;`（L362，#436 建立，
  对判别联合泛化）自动使 record fast-path 项跳过折迭——正确性依据：install-facts 只断言该
  item 自身目标键；批内路径互不嵌套（ADR 0026 L30）⇒ 同 map 兄弟操作写不同键（同键即同路径，
  被禁），不可能破坏彼此的安装事实；legacy 边界项对批内 record/array 足迹的吸收（parsed 驱动
  重放）照旧不变。折迭跳过与吸收两侧均零代码改动，仅刷新注释（L329/L357–361 现称 install-facts
  「仅产生于 kind=`array` 计划」，实现后即为失实的规范性陈述——docs 纪律要求同 PR 刷新；
  SA2 §6 正向确认其为必要项）。

### 7.6 ADR-0007 issue #237 修订节一致性修订注记计划（F-SA2-2 / SA8 evolution-required 落实）

**残留陈旧面识别（SA8 §2 独立扫描 + 本轮复核）**：实现落地后，`docs/adr/0007-logical-
validation-and-yjs-runtime-bridge.md` issue #237 修订节（L62–124）中有三处现行文本与非 union
Record 位 / 封闭对象 delete 的实现行为直接矛盾：

| # | 陈旧句面 | 行号 | 与实现行为的矛盾 |
|---|---|---|---|
| 1 | 条款 1「定位最近必要语义边界（…Record 位…delete 的父 map 位…）→ 只把该边界投影为局部 logical 值 → 在 detached 局部值上按 mutation 域规则重建」 | L72–78 | fast path 对该两类边界**不再整边界投影/重建**，改为逐 entry / 静态判定 |
| 2 | 条款 4(ii)「被提取/重建/校验的边界（union 穿越位、Record 位、数组位、delete 的父 map 位）内部既存载体/值域非法仍响亮拒绝」 | L100–107 | 触达面收窄后，未触达兄弟 entry/字段污染由响亮拒绝变为「目标键合法即成功」（FA1–FA11 目标行为）；「数组位」字面已由 ADR 0033 注记修订，Record/父位未修 |
| 3 | 条款 7 成本句「array/Record/union 边界与 delete 父位按边界规模」 | L121–124 | Record set 变 O(新值)、Record/封闭对象 delete 变 O(1) |

且 ADR 0033 修订注记（L137–139）明文「本节其余边界种类（union 穿越位、Record 位、delete 父
map 位）按本节原文逐字保持」——当前规范态被显式 reaffirm，无注记时矛盾无处落地。ADR 0034
决策 4 的标题只点名修订 **ADR-0010** issue #237 修订节（该节后备句 L345–347 以 ADR-0007 损坏
条款为单一真相源），未点名 ADR-0007 该节 ⇒ ADR-0007 需要显式注记，ADR-0010 不需要（见下）。

**落点与形态**：在 `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` 的 issue #237
修订节末尾、紧随既有「ADR 0033 修订注记（2026-09-22）」（L126–140，文件末尾）之后，追加同级
`###` 注记小节。**追加式、不重写任何既有条款**（沿仓库「显式修订节 + 授权链」惯例：ADR-0006
#64/#79、ADR-0008 #93/#132、ADR-0007/0010 #237 节、ADR 0033 注记先例）。

**授权链（写进注记首段）**：ADR 0034（`docs/adr/0034-record-and-parent-elementwise-
validation.md`，状态已接受 2026-09-22，决策 1–4）+ `docs/AGENTS.md` 两条义务句（「Amend or
supersede prior decisions explicitly instead of silently contradicting them」「When code
behavior changes, update every normative document whose stated contract changed」）+ 上述先例。
无需新增 Owner 裁决（comments = 空，无 override 来源；SA8 §4 已裁定 override 权威 = 已接受的
ADR 0034 实质内容 + 义务句，注记是把该修订显式登记到被修文件的机制）。

**建议文案**（实现期按此落地；措辞镜像 ADR 0033 注记句式，作用域句反向收窄——本次修订的
恰是 0033 注记中被保持的两类边界）：

> ### ADR 0034 修订注记（2026-09-22）
>
> 授权链：ADR 0034（`docs/adr/0034-record-and-parent-elementwise-validation.md`，状态已接受，
> 决策 1–4）+ `docs/AGENTS.md`「Amend or supersede prior decisions explicitly instead of
> silently contradicting them」义务句；沿本仓「显式修订节」惯例（ADR-0006 #64/#79、
> ADR-0008 #93/#132、本节先例）。除下列明示句外，本节其余条款维持原文效力。
>
> 本节条款 1 的「只把该边界投影为局部 logical 值 → 在 detached 局部值上按 mutation 域规则
> 重建」与条款 4(ii) 中的「Record 位」「delete 的父 map 位」字面，自 ADR 0034
> （`docs/adr/0034-record-and-parent-elementwise-validation.md` 决策 1–4）起就**非 union
> Record 位与封闭对象 delete**修订为：逐 entry / 静态校验（Record set 单键 Pattern + 新值
> schema、旧值不读；Record delete `has` 拒 no-op；封闭对象 delete 必填性静态判定、不读父值）、
> 触达面收窄为「map/父载体本身 + 目标键位」——未触达 entry/字段的既存损坏不再被普通写发现
> （对污染 map 的写目标键合法即成功）；条款 7 的「Record……delete 父位按边界规模」成本句对该
> 类目标相应为 O(新值)/O(1)。union 容器目标（如 `Record<K,V> | 封闭对象`）与 union 穿越、
> 本节其余边界种类按本节原文逐字保持；载体形态违规（条款 4(i)）不受影响。ADR-0010 issue
> #237 修订节后备句的 Record/父位含义同步随 ADR 0034 决策 4 修订（该节已被其标题点名，
> 无需另行注记）。

**不变面（注记文案必须明示「逐字保持 / 不受影响」）**：union map 位与 union 穿越（kind=
`union` 永久 legacy）；条款 4(i) 载体形态违规（含触达面内载体位响亮拒绝）；条款 5 失败边界
与提交后验证范围声明（E201 C/D、零写入、fatal 分类）；条款 6 行为等价硬前置（A-6 全部为合法
基线场景，fast ≡ oracle 由组合性保证，保绿）；条款 2/3（phase-1 前置、`set([])` 唯一全量
形态）；条款 7 的 union 容器/union 穿越成本句。

**同变更集纪律**：注记与 fast path 实现**同一变更集交付**（同 PR；对照先例 `ca0ab53`——
#434 spec PR 同 PR 落 ADR 0033 注记 +16 行 + 实现 + 测试重锚；#438（ADR 0034 spec PR）未落
对等注记即本轮 SA8 reject 的直接诱因）。禁止「实现先行、注记欠账」的红窗（行为与规范文本
矛盾的中间态）。豁免路径唯一：Controller 明示裁决「不做注记」方可省略，且实现报告必须记录
该裁决引用，不得静默留白（#436 §7.6 同款；本轮无任何在案豁免）。

**ADR-0010 处置**：不追加注记——ADR 0034 决策 4 标题已显式点名「扩展 ADR-0010 issue #237
修订节」，沿 ADR 0033 注记末句先例（「该节已被其标题点名，无需另行注记」，L139–140）；其后
备句（L345–347）以 ADR-0007 损坏条款为单一真相源，ADR-0007 注记落地后引用链自洽。实现后
按 §15 ① 复查其句面无漂移。

**修订计划七要素自检**（SA8 §6 标尺，逐项对照 #436 获 clear 的同款结构）：

| 要素 | 本设计计划内容 | 判定 |
|---|---|---|
| 修订文件 | `docs/adr/0007-…md`（ALLOW，有界追加式注记，§11） | ✓ |
| 新旧语义 | §7.6 陈旧面表 + 建议文案（旧：整边界投影重建/边界内响亮拒绝/按边界规模；新：逐 entry/静态、触达面 = 载体 + 目标键位、O(新值)/O(1)） | ✓ |
| 兼容与迁移 | 行为面 ↔ 条款字面映射（FA/FC ↔ 条款 4(ii)；FB ↔ 条款 7；§8 数据流 ↔ 条款 1）；既有测试零迁移需求（§10 核查） | ✓ |
| 失败语义 | 条款 4(i)/5/E201 C/D/零写入/fatal 分类保持（§9；注记明示不受影响） | ✓ |
| 版本/授权 | 带日期（2026-09-22）修订注记 + 授权链（上文）；豁免仅 Controller 明示 | ✓ |
| 验证 | §12 验收映射（契约 + 负控 + 根 gates）+ §15 ①② 注记文本/同变更集核对 | ✓ |
| 保持不变的冻结面 | 注记不变面清单（上文）+ §11 DENY（0033/0034/CONTEXT/ADR-0010/协议文档） | ✓ |

### 7.7 主要备选方案与不选原因

| 备选 | 不选原因 |
|---|---|
| 在 `walk`/`applyMutationAtBoundary` 内做短路参数（复用 legacy 函数加开关） | 混流双语义于一个函数——违 #436 已确立的「双轨代码物理分离」纪律；legacy 逐字保留是负控（NA 组）与回滚面的前提 |
| 闸门加 `<key>` 槽形态预检（值侧 object ∧ 槽形态 ↔ kind 一致才 fast） | 冗余：接缝第三锁已对违约计划 fail closed；闸门保持与数组先例同构的最小双条件（kinds only），槽形态分歧（仅手造可达）由接缝响亮拒绝——失败方向同为 fail-closed |
| fast path 也做边界重投影（不收窄 S9） | 直接违反 ADR 0034 决策 3（已确认取舍：触达面外篡改静默通过）；FC1–FC4 契约将恒红 |
| 读计数阈值/计时断言进测试 | ADR 决策 6 禁绝对毫秒阈值；SA6 已用结构性读计数（机器无关）+ 反证（G3b）锚定 |
| doc-runtime 侧自写单键校验（不消费 vfsl 接缝） | 违 ADR 0034 决策 6「复用而非另起平行机制」；域 message/path 逐字面将出现第二实现源 |
| **ADR-0007 注记处置（F-SA2-2 二选一）：(a) 票内有界注记 vs (b) 具名 follow-up + DENY 理由改写** | **采纳 (a)**：`docs/AGENTS.md` 义务句是义务而非许可；SA8 §8 Required action 1/2 明确要求注记 + 实现**同变更集**（#434/`ca0ab53` 先例；#438 缺位即 reject 诱因）；(b) 会重新制造「行为与规范文本矛盾」的窗口且无 Owner 授权（comments = 空）——按 SA8 门禁规则（evolution-required 计划缺失 → reject）不可再选 |

---

## 8. 接口、状态机和数据流

### 接口与数据结构变化

- **零公共接口变化**：`applyValidatedMutation`/`MutationEnvelope`/`ApplyValidatedMutationResult`
  签名与判别联合不变；`src/index.ts` 零改动（`public-surface-guard.test.ts` 既有断言不受影响）。
- **包内 @internal 变化**：`LocalPreparedResult` 的 `verify` 判别值域扩用既有 `install-facts`
  变体（类型零变化——`VerifyPlan` 已含该成员）；`mutation-local.ts` 新增 import
  `applyElementwiseEntryMutation` + 类型 `EntryCarrierFacts`/`ElementwiseEntryMutationPayload`
  （`@nomicore/vfsl` 已公共导出，`packages/vfsl/src/index.ts` L133–145）。

### 状态机

无新状态机。mutation 管线阶段序（S3→S4→[fast: F1–F5 | legacy: S5–S7]→S8→S9）与判别结果
（`ok:true` / `ok:false`+issues / fatal E201/E204/E205）结构不变；仅 record/parent 分支内部
轨道选择变化。Y.Doc 侧仍是「单 guarded transaction 提交最小 edit → afterTransaction 事件 →
S9 验证派发」既有时序。

### 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| R1 fast Record set | `applyValidatedMutation` set `[...mapPath, key]`（plan.kind=record，非 union 位） | `transactGuarded` 内 `parentMap.set(key, built.value)` 单键 | payload（调用方 JSON 域）→ vfsl `validateSubtree`（纯）→ `buildDetachedValue`（detached Y.Map，未集成任何 doc，失败即 GC） | live Y.Doc ROOT 子树（单事务）；恰 1 个 owned update 事件 | S9 `parent.get(key)` 同一性；读取面 `readLogicalValueAtPath` 不变 | `ok:true`；终态/增量字节 ≡ 手写最小 edit；触达面外污染保留不修 | F1/F3/F4 任一失败 → `ok:false` 零写入零 update；S9 偏离 → E201-C（committed:true 不回滚） | FA1/FA4–FA7、FB1、ND2/ND4/ND5、NB1/NB2 |
| R2 fast Record delete | 同上 delete | `parentMap.delete(key)` 单键 | 无值转换（`has` O(1) 域规则） | 同上 | S9 `!parent.has(key)` | 同上 | 同上（no-op → `ok:false` 逐字消息） | FA2/FA3、FB2、ND1/ND5、NB3、NC1/NC6 |
| R3 fast 封闭对象 delete | delete `[...父路径, key]`（plan.kind=parent） | 同 R2 | 静态必填判定（纯 schema 事实，不读父值） | 同上 | 同 R2 | 同上（污染兄弟字段保留） | no-op/必填拒绝 → `ok:false` 逐字零写入 | FA9–FA11、FB3、ND3/ND5、NB4、NC4/NC5 |
| R4 fast 批量 | `{ops:[...]}`（元素经同一 prepare） | 单事务按序提交各单键 edit | 各元素独立 F1–F4；`composeBatchVerify` 对 install-facts 项跳过折迭（零 live 读） | 单事务单 update | 逐元素 `verifyPrepared` | `ok:true`；批内兄弟键互不影响 | 任一元素失败 → 聚合 issues 整体零写入 | FA8、NC9、ND6 |
| R5 legacy（不变） | union map 位/union 穿越写；手造两树分歧回退 | 既有 S5 walk → S6 重建 → S7 → S8 → 双核 S9 | 与 HEAD 逐字一致 | 同上 | 重投影核 | 污染阻断、触达面外篡改 E201-C | 既有分类 | NA1–NA5、NB5、G1 系 |
| R6 不变轨道 | kind=target/array/`set([])`/读取面/物化面 | — | — | — | — | 零变化 | — | #436/#350/#237 既有测试 |

跨边界说明：R1–R4 跨「调用方 JSON 域 → vfsl 纯函数域 → detached Yjs 实例域 → live Y.Doc 事务域」
四跳，各跳数据形态与事实源如上；无新缓存/最终一致性面；失败后可见性 = 文档字节逐字节不变
（拒绝）或 E201 message 明示已提交不回滚（fatal）。

---

## 9. 错误、恢复、并发和幂等

### 9.1 错误分类（fail-loud；无静默 fallback）

| 阶段 | 失败形态 | 分类 | 可观察结果 |
|---|---|---|---|
| F1 载体 | map/父载体非 Y.Map | 领域 issue（零写入） | `Yjs 载体错位（ROOT）：期望 Y.Map，实际 <载体>` path `[]`——与 legacy 逐字（NC10/NC11） |
| F3 域规则 | no-op / 键 Pattern / 值 schema / 静态必填 | 领域 issue（零写入） | 逐字消息与 path（NC1–NC5、NC8；FA10） |
| F3 接缝崩溃 | 接缝内部异常 | `VFSL-E100` issue（`wrapElementwise` 收编，零写入） | 单 issue path `[]` |
| F4 构造 | detached 构造失败 | 领域 issue（零写入） | build issue path（与 legacy 同款构造） |
| 闸门 resolve | ref 环/缺名（仅手造派生物） | `DerivedInvariantError` → E204 | fatal `pre-commit-internal` committed:false 零写入 |
| S9 事实核 | 目标键偏离 | E201 变体 C | fatal `post-commit-verification` committed:true，不回滚不补偿（NB1–NB4） |
| S9 核异常 | 事实核无法运行 | E201 变体 D | fatal，明示防线未运行（绝不假成功） |
| 触达面外异常数据 | 兄弟 entry/字段污染、observer 触达面外篡改 | **不再是错误**（ADR 0034 决策 4 已确认取舍） | 写成功、污染保留（FA 组/FC 组） |

正常路径不变量缺失一律 fail loud：无「跳过验证继续提交」分支；legacy 回退是「多验证」方向。

### 9.2 恢复 / 回滚

- 领域拒绝（ok:false）：先于任何 live 写，无需回滚（状态字节逐字节不变——B-4 锚）。
- E201 fatal：写入已提交，不回滚、不补偿（包纪律；message 明示 doc 保持 observer 实际状态）。
- 实现期回滚策略：本票改动集中于单一分支内的新增代码路径 + 一处文档追加，回滚 = 移除闸门
  合取（恒走 legacy）+ revert 注记，fast path 契约随之处红——git revert 单提交可回退，无数据
  迁移面。

### 9.3 并发 / 幂等 / 生命周期

- 同步单线程入口（`assertOutermostTransactionContext` 不变）；单 guarded transaction；无新异步面。
- afterTransaction 篡改窗口先于 S9 派发（SA7 #350/#436 同款机制，SA6 §7 实证）：目标键篡改对
  事实核可见（NB 组）；触达面外篡改对 fast path 不可见（FC 组，预期）。
- 幂等性面不变：同键重写 = 覆写（事实核对同值重插不误报、异实例必偏离）；所有权不变
  （调用方拥有 doc；无新资源）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `applyValidatedMutation` 单操作路径（`mutation.ts` `prepareMutation`） | record/parent 恒走 legacy 全量 | 经 `prepareLocalMutation` 闸门分流；fast 轨触达面/成本/S9 按目标行为 | 无（签名/判别联合不变；行为变化即 AC1–AC5 目标） | `mutation.ts` L141–170、L194–199 |
| `prepareBatchMutation` 批量路径 | 同上 + `composeBatchVerify` 对一切 record/parent 项折迭 | 元素继承双轨；record fast 项 `install-facts` 跳过折迭（既有判别，零代码改动）；legacy 项吸收足迹不变 | 仅注释刷新（L7/L329/L357–361） | `mutation.ts` L305–318、L353–384 |
| `verifyPrepared` / S9 消费 | `install-facts` 仅数组 fast 消费 | 扩用至 record/parent fast 项 | 无（判别联合已穷尽分派） | `install-verify.ts` L444–453 |
| 读取面（`readLogicalValueAtPath`/`extractYjsSnapshot`/window） | 与写路径无关 | 零变化 | 无 | `read.ts`/`extract.ts`/`window.ts` 不在范围 |
| 物化/替换/建档（`materializeRoot`/`replaceRootContent`/`createInitialDocument`/`replaceSchemaAndRoot`） | 不经 mutation 管线 | 零变化 | 无 | 各自模块零改动 |
| `@nomicore/namespace-runtime`（公共 API 消费方） | 经 `applyValidatedMutation` 写 | 仅承受预期行为收窄（触达面外污染不再阻断）；fatal 面/信封面不变 | 无（其测试 `runtime-*` 不锚 record 污染行为，SA2 §9 独立 grep 复核） | namespace-runtime 测试面 |
| 既有 doc-runtime 测试 | 见下「既有测试兼容性核查」 | 全部保持绿（含 #436/#350/#237 系） | 无 | §12 |
| 复制/诊断捕获上游 | 消费 update 事件流 | 事件形态不变（单键最小 edit） | 无 | ND1–ND6 |

**既有测试兼容性核查**（实现必须保持绿的既有面；本设计已逐文件核对，SA2 §9 独立复核成立、
SA8 §3 专项裁决复核成立）：

- `issue-350-sa7-batch-divergence.test.ts` TD-1/2/3：篡改均落目标键（status 覆写 → op2
  kind=target 事实核；reviewer 重插 → op1 parent fast 事实核「疑似 observer 重插」）或数组
  长度（notes push → op2 #436 数组事实核）——全部仍 E201-C，保持绿。
- `issue-350-batch-shared-boundary.test.ts` S1–S8：干净批量断言 ok:true + 无 fatal + 终态——
  fast 轨只减少验证面不改变结果；S8 union 组合失败负向守卫走 legacy 轨不变。
- `apply-validated-mutation-operations.test.ts` L134–135：顶层必填字段 delete 拒绝——静态判定
  同消息同 path（`缺少必填字段`），保持绿。
- `apply-validated-mutation-fatal-contract.test.ts` W5：#436 已把该用例锚到 union 数组目标
  （永久 legacy 轨）——record fast path 不触碰；**未发现任何既有测试锚定「record 兄弟污染
  阻断写」或「record 路径重投影 E201」的待废止行为**（若实现期发现遗漏者，按 #436 W5 同款
  授权链注释迁移到 union 轨，禁止放宽断言语义——应急模板，触发时按 §15 ③ 复核）。
- `issue-237-*`/`issue-436-*`/`sa7-fatal-dynamic-verify`/`public-surface-guard`：target/array/
  fatal/public 面零触碰。

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/doc-runtime/src/mutation-local.ts` | `case 'parent': case 'record'` 内插入闸门 + fast path（F1–F5，约 40 行）；模块头注释追加 ADR 0034 双轨段（镜像既有 #436 段）；case 注释更新；新增 vfsl 接缝 import | 本票唯一行为改造点（§7.1–7.3） |
| `packages/doc-runtime/src/mutation.ts` | **注释-only**：模块头 S9 描述句 + `composeBatchVerify` 折迭跳过注释补 record/parent fast 项（行为零变化） | L7/L329/L357–361 现行注释断言 install-facts「仅数组项/仅产生于 kind=array 计划」，实现后即为失实的规范性陈述（docs 纪律要求同 PR 更新；SA2 正向确认为必要项）；不改任何语句 |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` | **（有界、追加式，F-SA2-2/SA8 Required action 1）**在 issue #237 修订节末尾（紧随 L126–140 的 ADR 0033 修订注记之后）追加「ADR 0034 修订注记（2026-09-22）」小节（建议文案 §7.6）；**不重写、不删除任何既有条款**；与实现同变更集交付 | 陈述契约变化的规范文档恰此一处（SA8 §2 独立扫描）；`docs/AGENTS.md` 义务句兑现；豁免仅 Controller 明示裁决且实现报告记录 |
| `wiki/raw/task_issue-441_design.md` | 本设计产物（iteration 1 原位修订） | SA1 固定产物 |

（SA6 契约三文件 + 探针已存在且为验收面，实现只需使其中的红灯契约转绿，不需要也不应修改——
见 DENY LIST。）

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/vfsl/src/**`（含 `validate-patch.ts`） | 逐 entry 接缝与规划层 | #440 已交付冻结；ADR 0034 决策 6 复用不另起机制；SA6 S1 实测达标 |
| `packages/doc-runtime/src/install-verify.ts` | S9 机制 | `VerifyPlan`/`install-facts`/共享事实核已由 #436 建立，本票纯消费；改动会波及数组轨冻结面 |
| `packages/doc-runtime/src/index.ts` | 公共面 | 零新公共导出（SA6 §12.1 绑定纪律；public-surface guard） |
| `packages/doc-runtime/test/issue-441-record-fastpath-contract.test.ts` / `-control.test.ts` / `-fixture.ts` | 验收契约/负控/夹具 | SA6 固定验收产物——修改即伪绿 |
| `wiki/raw/task_issue-441_sa6_capability_probe.mts` | 探针证据（**实现前遗产证据**，§12.1） | SA6 固定证据；其 G1/G4 系 12 项 check 锚定 HEAD legacy 行为，实现后**预期翻转 FAIL（exit 1）**——这是「接线已落地」的确认信号，不是修改探针或保绿的理由；修改探针 = 伪化 SA6 固定证据（F-SA2-1）。实现后如需可执行探针证据，向 Controller/SA6 申请**另行命名**的目标行为探针（新文件），禁止原位改旧探针 |
| `packages/doc-runtime/test/` 其余既有测试 | 回归锚 | 仅当发现锚定待废止 legacy 行为的遗漏用例时按 §10 授权链迁移——默认禁改 |
| `docs/adr/0033-*.md`、`docs/adr/0034-*.md`、`docs/adr/0010-*.md`、`CONTEXT.md`、`docs/**`（除上述 ALLOW 的 `0007-*.md` 有界追加外） | 母法/词汇/被点名节/协议文档 | ADR 0033/0034 已接受、CONTEXT L144/L202 已按目标状态立法（`0a91f14`）、ADR-0010 已被 ADR 0034 决策 4 标题点名扩展（无需另行注记，§7.6）——SA8 §3 逐项核对均自洽，零改动声明成立；规范修订面**仅限** ALLOW 中的 ADR-0007 追加注记一处 |
| `packages/namespace-runtime/**`、`packages/**` 其余、`apps/**`、`domains/**`、协议/wire/持久化面 | 消费方与无关面 | 无消费方改动需求；复制协议/诊断捕获零改动（ADR 0034 状态行） |

---

## 12. 验收与验证映射

**实现后可执行验收判据（无歧义枚举——F-SA2-1 落实；探针不在其中，其实现后语义见 §12.1）**：

1. 聚焦对全绿：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime/test/issue-441-record-fastpath-contract.test.ts packages/doc-runtime/test/issue-441-record-fastpath-control.test.ts` ⇒ **45/45 passed**（契约 18 + 负控 27），Type Errors: no errors，exit 0。
2. 包类型门：`npx tsc -p packages/doc-runtime/tsconfig.json` ⇒ exit 0。
3. 根类型门：`pnpm typecheck` ⇒ exit 0。
4. 根测试门：`pnpm test` ⇒ **471 files / 5757 tests 全绿**（契约 18 红转绿；负控 27 与既有 469 files 保持绿），Type Errors: no errors，exit 0。
5. 文档同变更集：ADR-0007 修订注记与实现在**同一变更集**落地（§7.6；git diff 可核）。
6. 探针一次性确认信号（非绿判据，见 §12.1）：复跑探针 ⇒ exit 1 且失败集合**恰为** §12.1 的 12 项翻转子集；探针文件字节不变。

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 闸门分流 | SA6 §5.1 P1a–P1i（探针 HEAD exit 0） | `issue-441-record-fastpath-contract.test.ts` FA1–FA11；`-control.test.ts` NA1–NA5、NC10/NC11 | FA 组转绿（触达面外污染不阻断/静态判定）；NA/NC10/NC11 保持绿（union 永久 legacy、载体位响亮拒绝、相对路径 issue 冻结） |
| AC2 O(n)→O(k) | SA6 §5.3 G3/G3b（读计数 2049/16385、8/28；批量出口反证 4×size）；G3c 软时序 | 同契约 FB1–FB3 | 值读 ≤2 且 n=512 与 n=4096 相等；封闭对象父值读 ≤2 且 4/14 字段相等；presence ≤2。探针 G3/G3b/G3c 保持绿：G3 为恒真观察项（`check('G3', true, …)`），实现后**报告值**变为 ≤2/解耦（观察确认，非判据，§12.1） |
| AC3 commit 形态 | SA6 探针 G5f/G5g/G5g2/G5j/G5k（字节 oracle 敏感性反证 E3） | 同负控 ND1–ND6 | 全绿保持：终态/增量字节 ≡ 手写最小 edit（同 clientID）、单 update、长度与 n 解耦（±8B varint 余量）、对端复制收敛、批量单事务单 update |
| AC4 零写入 | SA6 §5.2（HEAD 拒绝已零写入） | 同负控 NC1–NC4/NC10/NC11、NA1/NA2 + 契约 FA 组目标分支 | 一切 fast 拒绝：`Y.encodeStateAsUpdate` 逐字节不变 ∧ 0 update |
| AC5 S9 收窄 | SA6 §5.4 G4a–G4g（两核可独立观测，E4 反证） | 同契约 FC1–FC4（转绿）+ 负控 NB1–NB5、NA3/NA4（保持绿） | 触达面外篡改静默通过（doc 保持篡改态）；目标键覆写/重插/同值异实例仍 E201-C（phase/committed/码字不变）；legacy 双核不变 |
| AC6 门禁 | SA6 §13 post-contract 基线（469 files/5712 绿 + 18 红） | §12 判据 1–4（命令面） | 契约 18/18 绿、负控 27/27 绿、既有 469 files 保持绿、Type Errors: no errors、exit 0 |
| 批量面继承 | SA6 §12.2 目标行为 7 | FA8、NC9、ND6 + 既有 `issue-350-*` 三文件 | 全绿（§10 核查表） |
| public surface | `public-surface-guard.test.ts` 既有 | 根 test 含该文件 | 绿（零新导出） |
| 规范文档一致性 | SA8 §2 扫描（陈旧面恰 ADR-0007 一处） | §12 判据 5（同变更集）+ §15 ①② | 注记落地、条款 1/4(ii)/7/ADR-0010 引句一致、无静默矛盾 |
| 探针（**实现前遗产证据**） | `artifacts/sa6-issue441-probe.log`（HEAD 49/49，exit 0） | 复跑命令：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-441_sa6_capability_probe.mts` | **实现前基线**：exit 0 复现 SA6 固定证据。**实现后**：exit 1 且失败集合恰 = §12.1 的 12 项翻转子集（G1a/G1a2/G1b/G1c/G1d/G1e/G1f/G1g/G1i/G4a/G4b/G4c）——「接线已落地」的一次性确认信号；失败集合偏离该子集（多/少/其它）= 回归或不完整接线，需排查；**不作为 AC 判据，不得为保绿而修改探针** |

命令面（runner 真实入口，SA6 §13/§14）：聚焦
`NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime/test/issue-441-record-fastpath-contract.test.ts packages/doc-runtime/test/issue-441-record-fastpath-control.test.ts`；
根 `pnpm typecheck` / `pnpm test`。

### 12.1 探针证据定性：实现前（HEAD 时点）遗产证据 + 逐 check 实现后分类（F-SA2-1 落实）

**定性**：`wiki/raw/task_issue-441_sa6_capability_probe.mts`（49 项 check，SA6 §13 HEAD 实测
49/49、exit 0）是**实现前时点的能力缺口与现状快照证据**——其 G1/G4 系断言的是 HEAD legacy
行为（整边界连带拒绝、双核覆盖），fast path 落地后其中一部分**必然翻转 FAIL**（探针尾部
`failures.length > 0 → process.exit(1)`，L620–623）。因此：

- 「探针 exit 0」只是**实现前基线**的复现条件；iteration 0 设计 §12「实现后 G1/G3/G4 目标
  断言命中、exit 0（探针按目标行为断言，实现后仍全命中）」与 §11「实现后 exit 0 不变是判据」
  **均不成立，本轮删除**（探针按 HEAD 行为断言，非目标行为）。
- SA6 契约 §12.2-8 的「探针 exit 0 不变」半句同样与探针自身断言不相容（固定工件，SA1 不改）；
  **绑定判据以本节枚举为准**，该半句登记为固定工件内的失实预期，随本设计的评审批注消歧。
- 探针实现后的角色 = 冻结的实现前记录 + **一次性确认信号**：exit 1 且失败集合恰为下表翻转子
  集 ⇒ 接线已落地；如需实现后可执行探针证据（目标行为断言），须向 Controller/SA6 申请
  **另行命名**的新探针文件——禁止原位修改旧探针（DENY，修改即伪化 SA6 固定证据）。

**逐 check 分类（49 项 = 12 翻转 + 37 保持）**：

翻转为 FAIL 的 12 项（断言 HEAD legacy 阻断/重投影行为，实现后目标行为与之相反）：

| check | 探针行 | HEAD 断言（现绿） | 实现后行为（目标） | 结果 |
|---|---|---|---|---|
| G1a | L128 | 污染目标键 `tasks.t2`（raw 'oops'）上 set ⇒ `ok:false` ∧ 0 update ∧ 字节不变 | set 整值替换旧值不读：键无 Pattern 约束、新值合法 ⇒ 写成功 `ok:true`、1 update | **FAIL** |
| G1a2 | L134 | 兄弟 `t2` 污染 ⇒ set 干净键 `t1` `ok:false` | 兄弟不读 ⇒ `ok:true` | **FAIL** |
| G1b | L143 | 兄弟污染 ⇒ delete `t1` `ok:false` ∧ 0 update | `has(t1)=true` ⇒ 删除成功 | **FAIL** |
| G1c | L153 | 目标键自身污染（plain 值）⇒ delete `t2` `ok:false` | `has(t2)=true`（raw 写入在场）⇒ 照常删除 | **FAIL** |
| G1d | L161 | 兄弟 entry 值非法 ⇒ set `t1` `ok:false`（S6 面） | 兄弟不读 ⇒ `ok:true` | **FAIL** |
| G1e | L169 | `codes` 兄弟键 Pattern 违约 ⇒ set `id-2` `ok:false` | 仅目标键过 Pattern ⇒ `ok:true` | **FAIL** |
| G1f | L177 | 值位 union 位点（`blobs`）兄弟污染 ⇒ set `b2` `ok:false` | 值位 union 仍 fast、兄弟不读 ⇒ `ok:true` | **FAIL** |
| G1g | L185 | 封闭对象兄弟字段污染 ⇒ delete optional `opt` `ok:false`（S5 父值面） | 静态判定 optional 允许、不读父值 ⇒ 删除成功 | **FAIL** |
| G1i | L202 | 批量 + 兄弟污染 ⇒ `ok:false` ∧ 字节不变 | 批内 fast 项成功 ⇒ `ok:true`、1 update | **FAIL** |
| G4a | L321 | Record set + 触达面外兄弟键同事务篡改 ⇒ E201-C（`fatal:true`） | 重投影核省略 ⇒ 不抛；`capture` 得 `undefined` ⇒ `summarizeThrown` → `fatal:false` | **FAIL** |
| G4b | L331 | Record delete + 同上 ⇒ E201-C | 同上 | **FAIL** |
| G4c | L341 | 封闭对象 delete + 同上 ⇒ E201-C | 同上 | **FAIL** |

保持绿（PASS）的 37 项：

| 组 | check（行） | 保持原因 |
|---|---|---|
| P1a–P1i（L88–116，9 项） | 纯 vfsl `planMutationBoundary` 形状 | 规划层零改动（union 冻结、值位 union 不改 kind、封闭对象未知字段规划层拒绝——全部结构性事实） |
| **G1h（L193）** | 断言**仅** `r.ok === false` | 实现后封闭对象必填 delete 经 F3 静态判定仍拒绝（`缺少必填字段 "req"`，= 契约 FA10 目标行为）⇒ 断言成立。注意其**证据语义变化**：拒绝理由由 S5 父值载体错位（issue `["deep"]`）变为静态必填判定（issue `["obj","req"]`），detail 载荷变化不计入断言——SA4/SA7 不应把 G1h 计入预期失败集 |
| G1j（L211） | 干净写 set/delete/封闭对象 delete 成功 | fast 轨照常成功 |
| G1k/G1l（L225/L235） | 载体位（map/父载体本身非 Y.Map）响亮拒绝，断言含逐字 issue JSON | F1 逐字复刻 legacy S5 首错（同文案同 path `[]`） |
| G3（L273） | 恒真观察项 `check('G3', true, …)` | 永不失败；**报告值变化**：读计数 2049/16385→值读 ≤2 等（AC2 的观察确认） |
| G3b（L286） | 读计数器批量出口反证（直接操作 map，不经 mutation） | 与实现无关 |
| G3c（L303） | 断言干净写 `ok:true`（毫秒软证据不设阈值） | fast 轨照常成功；耗时报告值大幅下降（观察） |
| G4d（L351） | union map 位提交 + 触达面外篡改 ⇒ E201-C | union 永久 legacy 双核不变 |
| G4e/G4f/G4g（L361/L371/L382） | 目标键覆写/重插/同值异实例 ⇒ E201-C | 安装事实核保留（两轨共享单实现） |
| G5a–G5k（12 项，L394–560） | 域规则逐字（no-op/Pattern/值 schema/静态判定/不查 Pattern）+ 零写入 + commit 字节 oracle/复制面/批量单 update + oracle 敏感性反证 | 全部为目标不变面（ND/NC 组契约锚同款行为） |
| S1a/S1b（L590/L591） | vfsl 接缝纯函数行为 | vfsl 零改动 |
| NC1–NC3（L602/L609/L615） | union map 位污染拒绝/污染键 delete 拒绝/干净写成功 | union 永久 legacy |

> 计数：12（翻转）+ 37（保持）= 49。SA2 F-SA2-1 枚举「13 项必然 FAIL」含 G1h（引其 L193）；
> 经源码逐项复核，G1h 的断言面只有 `r.ok === false`（探针 L188–194），实现后经静态必填判定
> 仍成立（夹具 `obj.req: string` 必填，`judgeClosedObjectDelete` L1178–1195；FA10 即其目标行为
> 契约）——预期翻转集**恰为 12 项**。该更正只收窄、不放宽 SA2 finding 的实质（探针实现后
> exit 1、「exit 0 不变」不可满足——成立）；把精确失败集写给 SA4/SA7 正是为避免「预期 13 见
> 12」被误读为异常。

---

## 13. 风险、回滚和残余问题

| 风险 | 等级 | 缓解 | 残余 |
|---|---|---|---|
| 闸门过度接管（union 位误入 fast） | 高 | 规划层冻结（union 首穿越即 kind=`union`，结构不可达本分支）+ 接缝第三锁 fail closed + NA1–NA5 负控 | 无 |
| 两树分歧（手造派生物）误 fast | 低（理论） | 闸门双条件合取假 → legacy（多验证方向）；槽形态分歧 → 接缝响亮拒绝 | 手造面本就 E204/E205 域，非本票义务 |
| E201 检出面收窄被误判为回归 | 中（语义面） | ADR 0034 决策 3 已确认取舍；FC（省略）与 NB（保留）双组钉死边界；E4 证明两核可独立观测 | 触达面外同事务篡改静默——**规范性行为**，非缺陷 |
| **探针实现后 exit 1 被误判为回归，或诱使改探针保绿** | 中（验收面） | §12.1 逐 check 翻转分类（12 项命名失败集 = 确认信号）；探针 DENY + 「新探针须另行命名」路径；§12 判据不含探针 | 无（歧义已消除） |
| **ADR-0007 注记欠账（实现落地而注记缺失）** | 中（规范面） | §7.6 同变更集纪律 + §11 ALLOW 有界项 + §12 判据 5 + §15 ①② 复查；豁免仅 Controller 明示 | 无 |
| 既有测试锚定待废止 legacy 行为 | 低 | §10 逐文件核查未发现（SA2/SA8 独立复核一致）；#436 W5 先例提供迁移模板（授权链注释，语义不放宽） | 实现期若发现遗漏用例，按模板迁移并在实现说明记录 + §15 ③ 复核 |
| 读计数代理失明（未来第三种整 map 出口） | 低 | 计数器已覆盖六种出口 + G3b 反证；FA 行为断言与之成对 | 记录于 SA6 §15，非本票范围 |
| charge 计数变化（未触达 entry 不再计入） | 低 | ADR 0034 后果节已声明；doc-runtime 无运行时计量器需改 | 若上层有工作量统计消费方，属独立 follow-up（未发现） |
| 批量折迭跳过的正确性 | 低 | 批内非嵌套（ADR 0026 L30）⇒ 兄弟异键；同键即同路径被禁；#436 引理 3 同构论证 + FA8/ND6 锚 | 无 |
| 回滚 | — | 单分支新增代码 + 一处文档追加，git revert 即回 legacy；契约随之处红作为回滚信号 | 无数据迁移面 |

**登记的残余观察（SA2 §14 非阻塞 O-1/O-2/O-3，供 SA4/SA7 知悉，非本票义务）**：

- **O-1 在场性谓词微观分歧**：legacy delete 的 no-op 判定基于 walk 快照 + `Object.hasOwn`（walk
  D4 把 `undefined` 值键视同缺席）；fast 轨 F2 用 `Y.Map.has`（`undefined` 值键为在场）。仅 raw
  复制/直接 Yjs 写可造该形态（validated 写值域无 `undefined`）；行为差 = 该形态目标键的 delete
  由 no-op 拒绝变为照常删除。ADR 决策 1/2 的字面谓词即 `has(key)`（接缝 `EntryCarrierFacts`
  JSDoc 同），设计忠实于母法；两轨契约均未覆盖该形态。
- **O-2 提交后整载体替换的静默残余**：install-facts 持有 prepare 期捕获的 `Y.Map` 实例；
  observer 在 afterTransaction 窗口整体替换/移挂 map 载体时，事实核在旧实例上通过 → fast 轨
  静默（legacy 重投影核会以边界重提取失败 E201-C 检出）。与 #436 数组轨同形，属 ADR 0033/0034
  决策 3 已确认收窄面的同构延伸，非本设计缺陷。
- **O-3 手造槽形态分歧的故障分类**：接缝第三锁把（仅手造可达的）两树 `<key>` 槽形态分歧呈现
  为领域 ok:false 单 issue 而非 E204——与模块「两树分歧 → E204」字面分类有差；方向 fail-closed、
  零写入，接缝为 #440 冻结面。

**任务内必要条件**：无未解决项。**明确 follow-up（非本票）**：触达面外污染的异步/抽样审计
（ADR 0034「不做什么」，需要时另行设计）；被删 entry 旧值主动读的前像捕获（独立议题）；union
穿越 E204 既有观察（E8，登记不改）；实现后目标行为探针（如需，另行命名的新文件，经
Controller/SA6 路由——§12.1）。

---

## 14. 评审修订映射

| Finding | 来源 | 修订位置 | 处理结果 |
|---|---|---|---|
| **F-SA2-1（MAJOR）**：验收判据不可满足——iteration 0 §12「探针按目标行为断言，实现后仍全命中 / exit 0」与 §11「实现后 exit 0 不变是判据」不成立；SA4/SA7 照表会误判回归或改探针伪绿 | SA2 §13 | §12 判据枚举（探针移出判据）+ §12.1（探针定性为实现前遗产证据 + 49 项逐 check 分类 + SA6 §12.2-8 失实半句消歧 + 新探针另行命名路径）+ §11 DENY 探针行重写 + §13 风险行 | **已落实**。设计不再含「探针按目标行为断言」「实现后 exit 0 不变」表述；实现后判据 = §12 枚举 1–5；探针实现后语义 = exit 1 且失败集恰为 12 项命名子集（一次性确认信号）。**精度更正**：SA2 枚举的 13 项含 G1h；源码复核 G1h 断言仅 `ok===false`，实现后经静态必填判定仍成立（FA10 目标），预期翻转集恰 12 项——更正只收窄不放宽 finding 实质，且为 SA4/SA7 消除「预期 13 见 12」的歧义（§12.1 末注） |
| **F-SA2-2（MAJOR）**：规范文档矛盾无处置落点——iteration 0 §11 以「本票无新决策/新术语」整体 DENY `docs/**`，与 ADR-0007 条款 1/4(ii)/7 + ADR-0010 后备句现行文本的已确认矛盾不符；#434 先例的修订注记在 #438 缺位 | SA2 §13 | §7.6（注记计划：陈旧面表 / 落点与形态 / 授权链 / 建议文案 / 不变面 / 同变更集纪律 / ADR-0010 处置 / 七要素自检）+ §11 ALLOW 有界纳入 `docs/adr/0007-*.md` + §6 ADR-0007 三行 + §13 follow-up 更新 + §15 | **已落实（采 SA2 选项 (a)）**：有界「ADR 0034 修订注记」纳入 ALLOW（追加式、不重写条款、同变更集、豁免仅 Controller 明示）；`docs/**` 一揽子 DENY 解除，DENY 理由改为如实陈述（0033/0034/CONTEXT/ADR-0010 经 SA8 核对自洽，零改动成立）；ADR 0034 决策 4 点名的 ADR-0010 扩展有明确落点（标题点名 + §7.6 末句 + §15 ① 复查）；SA8 七要素四缺口（修订文件/新旧语义/版本授权/冻结面）全部补齐（§7.6 表） |
| **SA8 evolution-required（reject 诱因）**：ADR-0007 #237 修订节条款 1/4(ii)/7 的 Record 位/父位字面 evolution-required 而修订计划缺失（iteration 0 把唯一合法修订路径封死） | SA8 §3/§4/§6 | 同 F-SA2-2 行（§7.6/§11/§6/§15） | **已落实**：§7.6 七要素自检表逐项 ✓（对照 #436 获 clear 的同款标尺）；同变更集纪律 + 实现后复查清单（§15 ①②）承接 SA8 §8 Required actions 1/2/4/5 |
| **SA8 Required action 3（非阻塞）**：iteration 0 §15 引文「ADR 0026 §7.5.2 组合期望边界义务」有误——ADR 0026 无该节；「组合期望边界」源自 issue #350 设计 §7.5.2 与 `mutation.ts` 折迭机制；义务面应引 ADR 0026 实条款（L30/L36/L41） | SA8 §3 末行 / §8.3 | §6 ADR 0025/0026 行（引 L30/L36/L41）+ §7.5 批量面（引 ADR 0026 L30）+ §15（引文更正说明） | **已落实**（证据修正） |
| SA2 §14 O-1/O-2/O-3（非阻塞观察） | SA2 §14 | §13 残余观察登记 | 已登记供 SA4/SA7 知悉（非本票义务，无设计变更需求——两轨边界已由契约钉死） |
| SA2 §6 正向确认：`mutation.ts` 注释-only 刷新为必要项 | SA2 §6/§11 | §7.5/§10/§11（保留并强化理由：L7/L329/L357–361 现行注释将失实） | 保留（无变更） |

---

## 15. 是否需要设计后 ADR 冲突复查及理由

**结论：需要（`requiresConflictRecheck: true`）。** 理由（对齐 SA8 §10 与本次修订面）：

1. **规范性文档修订**：本票现修改 ADR 文件本身（ADR-0007 #237 修订节追加「ADR 0034 修订
   注记」，§7.6）——对既有决策文档的陈述契约做显式修订记录。授权链完整（ADR 0034 决策 1–4
   已接受 + `docs/AGENTS.md` 义务句 + 0033 注记先例 `ca0ab53`），但实现后须核对：① 注记最终
   文本与 ADR-0007 条款 1（L72–78）/4(ii)（L100–107）/7（L121–124）原句、ADR 0034 决策 1–4、
   ADR-0010 L345–347 引句的一致性（含 ADR-0010 句面无漂移、L137–139 作用域句与新注记自洽）；
   ② `git diff` 核对注记与实现在同一变更集。
2. **失败语义边界移动**：E201 检出面收窄到目标键位（触达面外同事务篡改由检出变静默）——虽是
   ADR 0034 决策 3/4 已接受取舍，仍属「写后验证防线覆盖面」语义变化；实现后按 §12 判据 1–4 +
   §12.1 探针失败集核对，并确认 ADR-0007 注记 / ADR-0010 后备句 / CONTEXT L144/L202 与实现
   行为无残留矛盾。
3. **测试重锚应急模板**：若实现期发现锚定待废止行为的遗漏用例并按 §10 模板迁移，断言面零
   放宽须实现后复核（重锚 diff 恰为授权链注释/锚定载体迁移）。
4. **不为**：公共 API/协议/wire/schema/持久化/状态机所有权均零变化；不引入新生命周期所有权。
   fast path 管线本身不要求重查（SA8 §3 前八行已核毕：implements-existing-decision × 8 +
   no-conflict × 10，无 hard-conflict）。
5. **引文更正（SA8 Required action 3）**：iteration 0 本节曾引「ADR 0026 §7.5.2 组合期望边界
   义务」——该节不存在；义务面应引 ADR 0026 实条款：批内路径互不嵌套（L30）、各操作最小 edit
   不以载体降级换取（L36）、操作失败聚合零写入（L41）。「组合期望边界」是 issue #350 设计
   （`wiki/raw/task_issue-350_design.md` §7.5.2）与 `mutation.ts` 折迭机制的产物，非 ADR 义务
   条款——本轮已更正（§6/§7.5）。
