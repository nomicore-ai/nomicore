# SA6 诊断与验收契约 — issue #441：doc-runtime Record/parent fast path 接线与 S9 收窄（ADR 0034）

- HEAD：`3fd6aa8b659420fd63d07b051139fe5f279556b8`（worktree 分支 `mabf/issue-441`；HEAD = PR #457
  合入 #440 = vfsl 逐 entry 接缝 `applyElementwiseEntryMutation` + ADR 0034 立法，doc-runtime
  消费侧**未接线**）。
- 任务类型：**Feature（能力缺口 + 验收契约）**，含 S9 收窄的已确认取舍面（ADR 0034 决策 3/4）。
  本报告**不虚构 Bug 根因**：HEAD 的「整 map / 父值提取 → 全量重建 → 边界重投影」在 phase-1
  契约下是正确的（负控/基线全绿）；缺口 = ADR 0034 决策 1–4 要求的 doc-runtime 双轨分流、
  O(k)/O(1) 结算与 S9 收窄**尚不存在**。
- 固定产物：本报告 + `packages/doc-runtime/test/issue-441-record-fastpath-contract.test.ts`
  （**红灯验收契约，18 tests**）+ `...-control.test.ts`（**恒绿负控/回归锚，27 tests**）+
  `...-fixture.ts`（共享夹具/读计数/篡改窗口/字节 oracle）+ 探针
  `wiki/raw/task_issue-441_sa6_capability_probe.mts`（49 项，exit 0）；生产实现**零改动**
  （`git status` 仅新增测试/夹具/探针/报告/证据日志）。
- 聚焦执行（runner 真实入口）：
  `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime/test/issue-441-record-fastpath-contract.test.ts packages/doc-runtime/test/issue-441-record-fastpath-control.test.ts`
  ⇒ **18 failed（契约，全部 = 能力缺口）/ 27 passed（负控）**，Type Errors: no errors，exit 1；
  连续 5 轮红灯集合逐轮同 md5 `f5ca9f2bde1bd79ab98618dd96992e08`。
- 结论：**approve** —— 能力缺口 3 组可运行证据化（闸门/成本/S9）；目标行为由 ADR 0034 +
  CONTEXT 词汇 + #440 已交付接缝共同确定；契约以**运行时行为**（判别联合结果、live Y.Map entry
  读计数、update 事件/字节、branded fatal 事实）锚定；负控 27/27 恒绿，判据反证完备；
  验收契约可执行、runner 入口真实。

---

## 1. Task type and inputs

| 输入 | 路径 / 来源 | 说明 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-441.md`（Host 提供，untracked） | issue #441 正文：Parent = PR #438（spec/adr-0034-record-elementwise-validation）、Task Type = feature、What to build + AC1–AC6；Blocked by #440（HEAD 已解除） |
| issue 原文 | GitHub issue #441（Host 快照） | comments = 空；**无 owner 要求**（Host 明文：REST 评论读取为空） |
| 母法（规范） | `docs/adr/0034-record-and-parent-elementwise-validation.md`（HEAD 合入，`0a91f14`） | 决策 1 Record set/delete 逐 entry fast path + 闸门 + 永久双轨 + 值位 union 不阻断；决策 2 封闭对象 delete 静态必填判定；决策 3 S9 收窄（安装事实核保留 / 重投影核省略）；决策 4 触达面收窄；决策 5 立法（容器约束逐 entry 可组合）；决策 6 与 0033 排序 |
| 前置母法 | `docs/adr/0033-elementwise-yarray-mutation-validation.md` | 同款双轨/收窄纪律的数组先例（#435–437 已交付；本票沿其结构） |
| 词汇/纪律 | `CONTEXT.md` L144（逐 entry 例外两阶段立法）、L202（trusted-raw-replication 触达面收窄两阶段） | 已是规范性词汇：Record 写/封闭对象 delete 触达面 =「map/父载体本身 + 目标键位」；「对污染容器的写由连带拒绝变为目标位合法即成功」 |
| 前置能力（已交付） | PR #457 / `08497d9 feat(vfsl): validate record entry mutations`（#440） | `applyElementwiseEntryMutation(derived, plan, {has}, payload)`：schema 静态事实 + 目标键位 O(1) 在场性 + 新值；对 union map 位等违约计划 **fail closed** |
| 现状消费方 | `packages/doc-runtime/src/mutation-local.ts` case `'parent' \| 'record'`（L266–310：S5 `walk` 整 map/父值 → S6 `applyMutationAtBoundary` 全量重建 + `validateSubtree` → S9 verify 输入含 `proposedBoundary`） | fast path 的目标改造面（闸门分流 + 单键 commit + 收窄验证计划） |
| S9 实现 | `packages/doc-runtime/src/install-verify.ts`：`VerifyPlan` 判别联合（`boundary` / `install-facts`，L434–453）+ `verifyBoundaryInstallFacts`（O(1) 同一性/在场性，L399–431）+ `verifyBoundaryIntact`（事实核 + 重投影核，L465–500） | 决策 3 收窄 = fast-path 提交只消费 `install-facts`；legacy 轨双核逐字不变 |
| 批量面 | `packages/doc-runtime/src/mutation.ts` `prepareBatchMutation` / `composeBatchVerify`（L235–387） | 批量元素复用同一 `prepareLocalMutation` ⇒ record/parent 分支自动继承双轨；`verify.kind !== 'boundary'` 项跳过折迭（#436 已为数组建立） |
| 包纪律 | `packages/doc-runtime/AGENTS.md` | 校验失败零写入；detached 构造 + 单 guarded transaction；公共面只经 `src/index.ts`；写后不变量失败 = fatal 非可恢复 |
| **缺失输入** | `task_issue-441_relevant_decisions.md` / `_conflict_report.md` / `_design.md` / SA8 门 / 既有 SA6 报告 | **不存在**（iteration 0；`ls wiki/raw` 核对）。不影响诊断与契约：§3 以 ADR 0034 + CONTEXT + 简报 AC 替代 SA8 约束面 |

## 2. Owner comment mapping

**无 owner 要求**：Host 简报明文「Current REST comment read returned no comments, so there are no
owner-comment requirements」；issue 正文 comments 段为空。本次契约全部条目源自简报 AC1–AC6 +
ADR 0034 决策 1–4 + `CONTEXT.md` 逐 entry 例外词条，无外部 owner 追加面。

## 3. SA8 constraints

#441 无 SA8 工件（iteration 0）。可用的规范约束面（替代 SA8 约束表）：

| 来源 | 约束（逐条） |
|---|---|
| ADR 0034 决策 1 | 闸门 = map 位声明类型（ref 解析后）为**非 union 的 Record 形态**（object 节点含 `<key>` 槽）走 fast path；map 位为 union（`Record<K,V> \| 封闭对象`）时**永久回退** legacy；**Record 值位为 union 不影响 fast path**（entry 整值替换，不读旧值判别）；规划层（`planMutationBoundary`）不动，只动执行层 |
| ADR 0034 决策 1（管线） | set：导航 + 验 Y.Map 载体（O(路径深度)）→ keyPattern 校验新键（O(正则)）→ 新值过值 schema + detached 构造（O(新值)）→ 单键 commit，**旧值不读**；delete：`has(key)` 拒 no-op（O(1)），空对象合法 ⇒ 删除永不使 Record 变非法；issue 路径 `[...mapPath, key]` 与现行逐字节兼容 |
| ADR 0034 决策 2 | 封闭对象 delete 静态判定：目标字段**必填且非 `unknown` 标量** → 拒 `缺少必填字段 "<key>"`；optional ∨ `unknown` 标量 → 允许；`has(key)` 拒 no-op 不变；同胞字段值不重验；不读父值 |
| ADR 0034 决策 3 | S9：安装事实核（`get`/`has` 同一性，本就 O(1)）**原样保留**；fast-path 提交**省略**边界重投影核（无 `proposedBoundary`）；legacy 双核不变；E201 变体语义不变（`DocRuntimeFatalError`/`post-commit-verification`/`committed:true`）；后果 = 触达面外同事务篡改由 E201 检出变为静默通过（已确认取舍） |
| ADR 0034 决策 4 | 触达面 = 「map/父载体本身 + 目标键位」；**对污染容器的写由连带拒绝变为目标位合法即成功**；未触达 entry/字段不再承担 trusted raw replication 非法数据的检测职责；触达面内载体位仍响亮拒绝（ADR-0007 #237 条款 4(i)） |
| ADR 0034 决策 5 | 立法：Record 合法 ⟺ 逐键值合法、封闭对象 delete 合法性 = 目标字段必填性（静态）；禁止未来引入 map 级约束以校验器特判；enforcement = #440 已交付一致性 fixture + 本票 doc-runtime 运行时契约 |
| ADR 0034 决策 6 | 排序：ADR 0033 ticket 完成后本 ADR 才开工；0034 实现复用 0033 的逐 entry seam 语义（不得另起平行机制） |
| ADR 0034 后果节 | 验证面：vfsl 域规则/兼容/一致性 fixture（#440 已交付）；doc-runtime **fast/legacy 双轨、零写入、S9 收窄、public-surface guard** 测试；基准测试（如 10⁵ entry map 单键写耗时与 n 解耦）；根 `pnpm typecheck` 与 `pnpm test` |
| 简报 AC1–AC6 | 见 §12.3 映射表 |
| `packages/doc-runtime/AGENTS.md` | 验证失败零写入；公共面只经 `index.ts`（本票无需新公共导出——fast path 是内部管线改造，契约只锚公共 `applyValidatedMutation` 的运行时行为）；公共面 guard 测试须覆盖一切导出 |
| `CONTEXT.md` L144/L202 | 逐 entry 例外与触达面收窄已是规范性词汇（非本票新立） |

## 4. Environment and baseline

- 环境：node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、typescript `5.9.3`、tsx `4.23.12`、
  yjs `13.6.32`；`pnpm install --offline --frozen-lockfile`（store 命中，463ms，零网络；
  `artifacts/` 无网络依赖）。
- **pre-contract 基线**（既有套件，HEAD；由 post-contract 根 test 直接反推）：根 `pnpm test`
  在契约/负控落位后为 **471 files / 5757 tests**，其中失败面恰 = 新契约文件 18 条、负控 27 条
  全绿 ⇒ **既有 469 files / 5712 tests 在 HEAD 全绿**（零第 4 方回归）；本票未改生产码，
  基线语义与 #440 交付时一致（其根 test 留档：`artifacts/sa3-issue440-root-test.log`）。
- **post-contract**（契约 3 文件在位）：
  - 聚焦对（契约 + 负控）**18 failed / 27 passed（45 tests）**，Type Errors: no errors，exit 1
    （`artifacts/sa6-issue441-focused.log`；JSON 逐条红因
    `artifacts/sa6-issue441-contract-red.json`）；
  - 包 `tsc -p packages/doc-runtime/tsconfig.json` **exit 0**（契约/夹具/负控全部类型净，
    `artifacts/sa6-issue441-package-tsc.log`）；
  - 根 `pnpm typecheck` **exit 0**（15 个包 tsconfig 全过，`artifacts/sa6-issue441-post-typecheck.log`）；
  - 根 `pnpm test`（`vitest run --typecheck`）：**471 files（470 passed / 1 failed）/
    5757 tests（5739 passed / 18 failed）**，失败面**恰 = 契约 18 条**（逐条 FAIL 全在该文件），
    负控 27 条全绿，Type Errors: no errors，exit 1
    （`artifacts/sa6-issue441-post-test.log`；§13 复述）。
- 复现率：聚焦对连续 5 轮 = **18 red / 27 green**，红灯集合（全名排序）md5
  `f5ca9f2bde1bd79ab98618dd96992e08` 逐轮相同（`artifacts/sa6-issue441-stability-{1..5}.json|log|hash`）。
- 时序/规模：断言全部同步纯调用、零真实时钟阈值（读计数为结构性成本代理）、零网络、零并发；
  契约内最大规模 n = 4096（读计数举证）；探针另含 n = 10⁵ 软证据（§7）。

## 5. Positive reproduction（能力缺口，逐条可运行）

探针：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-441_sa6_capability_probe.mts`
⇒ **exit 0（49/49 命中，failures=0，~3–4s，含 n=10⁵ 软证据）**，完整输出 `artifacts/sa6-issue441-probe.log`。

### 5.1 P1 规划闸门形状（纯 vfsl `planMutationBoundary`；零 base 读）

| id | 路径 × op | 实测 plan（HEAD） |
|---|---|---|
| P1a/P1b | `['tasks','t1']` set/delete | `kind='record'`、`prefix=['tasks']`、`relPath=['t1']`、`node.kind='object'`（含 `<key>` 槽，值 ref `Item`） |
| P1c | `['obj','opt']` delete | `kind='parent'`、`node.kind='object'`（**无** `<key>` 槽：字段 `req/opt/unk/deep`） |
| P1d | `['maybe','m1']` set | `kind='union'`（`node.kind='union'`，成员 = Record 形 + `{fixed}`） |
| P1e | `['blobs','b1']` set | `kind='record'`、`<key>` 槽值节点 `kind='union'`（`Item \| Alt`）⇒ **值位 union 不改变闸门 kind** |
| P1f | `['outer','inner','n1']` set | `kind='record'`、`prefix=['outer','inner']`（深路径同型） |
| P1g | `['tasks','t9']` delete（动态键） | `kind='record'`（规划层不要求键先存） |
| P1h | `['obj','zzz']` delete（封闭对象未知字段） | 规划层即拒：`路径不存在：未知字段 "zzz"（封闭对象不接受未声明键）` |
| P1i | `['umem','inner','u2']` set（union 穿越） | `kind='union'`（⇒ 结构上不入 record 分支） |

### 5.2 G1 HEAD 能力缺口：非 union Record 位与封闭对象 delete 一律 legacy 全量路径

| id | 场景（HEAD） | 实测（探针） |
|---|---|---|
| G1a/G1a2 | `tasks` 兄弟 entry `t2` raw 污染为 `'oops'` → set `['tasks','t1']` | `ok:false`，`Yjs 载体错位（ROOT.t2）：期望 Y.Map，实际 plain value` path `["t2"]`（**边界相对**）；**零 update、状态字节不变** |
| G1b/G1c | 同污染 → delete `['tasks','t1']` / delete 污染键 `['tasks','t2']` | 均 `ok:false`（同 issue、零写入）⇒ delete 亦需先整 map 提取 |
| G1d | 兄弟 entry 载体正确、值非法（`qty:'x'`）→ set `['tasks','t1']` | `ok:false`，`类型不匹配：期望 number，实际 string` path `["tasks","t2","qty"]` ⇒ S6 全量重建 + `validateSubtree` 面 |
| G1e | `codes` 兄弟键 `'nope'` 违约 → set `['codes','id-2']` | `ok:false`，`Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/` path `["codes","nope"]` ⇒ S6 键 Pattern 面 |
| G1f | Record 值位 union（`blobs`）兄弟污染 → set `['blobs','b2']` | `ok:false`（载体错位 path `["b1"]`）⇒ 值位 union 位点现状同样整 map 提取 |
| G1g | 封闭对象 `obj.deep` raw 污染 → delete `['obj','opt']`（optional） | `ok:false`（载体错位 path `["deep"]`） |
| G1h | 同污染 → delete `['obj','req']`（**必填**） | `ok:false`，但 issue = 载体错位（`["deep"]`）**而非**静态判定 `缺少必填字段 "req"` ⇒ 父值被读取 |
| G1i | 批量信封 `{ops:[set ['tasks','t1']]}` + 同污染 | `ok:false`（聚合失败、整体零写入、零 update） |
| G1j | 干净写照常成功（set/delete/封闭对象 delete） | 均 `ok:true` + 终态正确（缺口仅在触达面/成本，非正确性） |
| G1k/G1l | **触达面内载体位**：`tasks`/`obj` 本身被替换为非 Y.Map | `ok:false`，`Yjs 载体错位（ROOT）：期望 Y.Map，实际 plain value` path `[]`（legacy S5 首错文案/路径——fast path 必须逐字复现） |

⟹ 现行 record/parent 分支必须先整 map / 父值提取（S5）才能结算；ADR 0034 决策 4 的触达面
收窄在 HEAD **无载体**。

### 5.3 G3 成本 ∝ n / ∝ 父字段数（live Y.Map entry 读计数；结构性证据）

读计数 = 目标 `Y.Map` 实例在 mutation 调用窗口内的 entry 读：`get`/`has` 逐次计真；整 map
批量出口 `keys`/`values`/`entries`/`forEach`/`toJSON`/`Symbol.iterator` 按其 `size` 计入
（换批量出口逃逸计数不成立；见 §9 E2）。

| op（HEAD） | 规模 | 值读 / 在场性读 | 说明 |
|---|---|---|---|
| Record set（新键 `t9`，k=1） | n=512 | **2049** / 0 | S5 walk（512 keys + 512 get）+ S9 重投影 walk（同）+ 安装同一性 1 |
| 同上 | n=4096 | **16385** / 0 | ∝ n（×4 规模 → ×8） |
| Record delete（`t0`） | n=512 | **2046** / 1 | S5 walk + S9 重投影 walk（少 1 键） |
| 同上 | n=4096 | **16382** / 1 | ∝ n |
| 封闭对象 delete（`narrow.target`，4 字段） | — | **8** / 1 | S5 父值 walk + S9 重投影 walk（各 4 get） |
| 封闭对象 delete（`wide.target`，14 字段） | — | **28** / 1 | ∝ 父字段数 |
| 反证 G3b：整 map 批量出口 | n=64 | **256** / 0 | `toJSON` + `keys` + `values` + `entries` = 4×64 ⇒ 计数代理无逃逸口 |

### 5.4 G4 S9 现状：边界重投影核覆盖全部 record/parent 提交

| 场景（HEAD） | 实测 |
|---|---|
| G4a Record set + 兄弟键同事务删除 | throw `DOCRT-E201`（键集 `["t0","t1"]` vs `["t0","t1","t2"]`），`phase='post-commit-verification'`、`committed:true` |
| G4b Record delete + 兄弟键同事务删除 | throw `DOCRT-E201`（同上） |
| G4c 封闭对象 delete + 兄弟字段同事务篡改（载体错位） | throw `DOCRT-E201`（边界重提取失败支） |
| G4g Record set + 目标键被**同逻辑值不同实例**同事务替换 | throw `DOCRT-E201`（**安装事实核**同一性支——两轨共享单实现，本就 O(1)） |
| G4e/G4f 目标键覆写/重插 | throw `DOCRT-E201`（事实核同一性/在场性支） |
| G4d 负控：union map 位（`maybe`）set + 兄弟键篡改 | throw `DOCRT-E201`（legacy 双核不变） |

⟹ 决策 3「fast-path 省略重投影核」在 HEAD 无载体；收窄后 G4a/G4b/G4c 将静默通过
（§12.2 目标行为 6），G4e/G4f/G4g 仍必须 E201-C（安装事实核保留）。

### 5.5 S1 目标接缝已存在且行为达标（#440 交付）

| 事实 | 实测 |
|---|---|
| `applyElementwiseEntryMutation` 为 vfsl 公共导出且 record 计划 set/delete 正常 | `{has:true}` + set → `ok:true`；delete → `ok:true`；`{has:false}` + delete → `ok:false`（`delete 目标键不存在（拒绝 no-op）`，path `["tasks","t1"]`） |
| parent 计划静态判定 | `['obj','req']`（必填非 unknown）→ `ok:false` `缺少必填字段 "req"` path `["obj","req"]`；`['obj','opt']`（optional）→ `ok:true` |
| union map 位违约计划 fail closed | union 计划 → `ok:false`（"逐 entry 校验仅服务 planMutationBoundary 的 record/parent 计划…"）⇒ 接线侧闸门必须先行 |

### 5.6 缺口 × AC × 红灯落点

| AC | 现状（HEAD） | 红灯落点 |
|---|---|---|
| AC1 闸门分流：非 union Record / 封闭对象 delete fast；union map 位 legacy；Record 值位 union 仍 fast | 一律 legacy（触达面外污染照旧阻断；required delete 被父值载体错位转判） | 契约 FA1–FA11；负控 NA1–NA5、NC10/NC11 |
| AC2 O(n)→O(k)（基准或等价证据） | 读计数 ∝ n（2049/16385；2046/16382）或 ∝ 父字段数（8/28） | 契约 FB1–FB3；探针 G3/G3b/G3c |
| AC3 commit 的 update 事件形态不变（复制与诊断捕获零回归） | 单键最小 edit（已正确）；无 fast path 可比 | 负控 ND1–ND6；探针 G5f/G5g/G5g2/G5j/G5k |
| AC4 零写入：fast path 一切失败分支零写入、零 update | 现行拒绝已零写入（绑在 legacy 路径上） | 负控 NC1–NC4/NC10/NC11；FA 组为「目标分支」 |
| AC5 S9：fast-path 仅安装事实核；legacy 重投影核不变；E201 变体语义保持 | 全部提交双核（触达面外篡改 E201-C） | 契约 FC1–FC4（省略）；负控 NB1–NB5、NA3/NA4（保留） |
| AC6 包测试 + 根 gates 绿 | post-contract：包 tsc 0、根 typecheck 0、根 test 失败面恰 = 契约 18 条 | §13 |

## 6. Negative control（恒绿；排除环境/夹具/oracle/入口伪红）

`packages/doc-runtime/test/issue-441-record-fastpath-control.test.ts` — **27/27 passed**（HEAD 实测，
`artifacts/sa6-issue441-focused.log`），分组与作用：

| 组 | 用例 | 作用 |
|---|---|---|
| NA1–NA5 | union map 位（`maybe`）污染照旧拒绝、零写入；union map 位 delete 污染键照旧拒绝；union map 位触达面外篡改照旧 E201-C；union 穿越（`umem.inner`，plan.kind=union）触达面外篡改照旧 E201-C；两形态干净写照常 ok:true | **闸门不得过度接管**：ADR 0034 决策 1 的永久 legacy 轨逐字保留（相对路径 issue 亦冻结） |
| NB1–NB5 | 目标键被同事务覆写（异值/同逻辑值不同实例）、delete 目标被重插、封闭对象目标字段被重插、union map 位目标被覆写 → 一律 E201-C | **S9 安装事实核保留**：fast path 落地后 target-key 篡改仍必须命中（`get`/`has` 同一性） |
| NC1–NC9 | Record delete no-op 逐字消息/path；键 Pattern 违例逐字；新值违例逐字 rebase；封闭对象必填逐字；optional/unknown 允许 + 缺席 no-op；delete 不查键 Pattern；新键/现键覆写接受面；值位 union 两支成员接受 + 非法值拒绝；批量干净写 ok | **域规则逐字 + 零写入零 update**：一切拒绝与 `Y.encodeStateAsUpdate` 逐字节不变 ∧ 0 update |
| NC10–NC11 | 触达面内载体位（Record map / 封闭对象父载体本身非 Y.Map）→ 响亮拒绝、同文案同 path（`[]`）、零写入 | **触达面内仍拒绝**（ADR-0007 #237 条款 4(i)）：fast path 的 F1 载体检查必须逐字复现 |
| ND1–ND6 | Record delete / 封闭对象 delete 终态与增量字节 ≡ 手写 `Y.Map.delete`（同 clientID）；Record set 终态与增量字节 ≡ 手写 raw Y.Map 最小 edit；增量长度与 n 解耦（时钟 varint 余量内）；复制面增量应用到同基态对端后逻辑值一致；批量双键 = 单事务单 update | **commit 形态 = 单键最小 edit**（复制/诊断捕获上游事件形态不变，ADR 0034 决策 1） |

**负控为何能防伪绿**：契约 FA 组的「ok:true」若被实现为「放行一切写」，则 NC2/NC3/NC4
（键/值/必填拒绝）、NA1/NA2（union 污染拒绝）、NC10/NC11（载体位拒绝）立即红灯；FC 组的
「不抛 fatal」若被实现为「删掉一切写后验证」，则 NB1–NB5 立即红灯。

## 7. Stability, scale and timing

- 稳定性：聚焦对 5 轮全部 **18 red / 27 green**，红灯集合 md5 `f5ca9f2bde1bd79ab98618dd96992e08`
  逐轮相同（`artifacts/sa6-issue441-stability-{1..5}.{json,log,hash}`）。
- 规模面（读计数，机器无关）：n=512/4096 与父字段数 4/14 两档（§5.3）；反证出口计数
  4×size（§9 E2）。
- 软时序证据（ADR 0034 决策 6 面；**不进契约、不钉毫秒阈值**）：探针 G3c —— 单键 Record set
  n=10³ **12 ms** vs n=10⁵ **1115 ms**（100× 规模 → ×92.9；物化 18 ms vs 1883 ms）。
- 时序/并发条件：全部断言同步、单线程、零真实时钟（`Date.now` 仅探针软证据）、零网络、
  零并发；篡改窗口用 `afterTransaction` cleanup（确定性，非竞态）。
- 时序前提（实证）：yjs `afterTransaction` cleanup 先于 S9 验证派发 ⇒ 篡改对两轨验证可见
  （G4a/G4b/G4c 在 HEAD 稳定抛 E201）。

## 8. Capability gap chain（Feature：证明能力缺失，不虚构 Bug 根因）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 症状 | 非 union Record 单键写与封闭对象 delete 的代价随容器规模增长；触达面外污染连带拒绝 | §5.3 读计数 2049/16385、8/28；§5.2 G1a–G1i | 高（运行时计数 + 判别联合结果） |
| 2 直接机制 | 现行 `prepareLocalMutation` case `'parent'\|'record'` 先 `walk(boundaryNode, boundaryLive)` 整 map/父值提取，再 `applyMutationAtBoundary` 拷贝式重建 + `validateSubtree` 全量判定 | 源码符号（mutation-local L266–310）+ 行为面 G1d/G1e（S6 面）/G1a（S5 面） | 高 |
| 3 触发条件 | 只要 plan.kind ∈ {record,parent}（非 union 位）即无条件全量；污染可来自 trusted raw replication（不经校验路径） | P1a–P1c/G1a 的污染注入路径（raw `Y.Map.set`） | 高 |
| 4 最深根因（=能力缺口） | doc-runtime 未按 ADR 0034 决策 1/2 分流：vfsl 侧逐 entry 接缝已交付（#440），但执行层仍只有「legacy 全量边界路径」单轨，S9 亦只有双核 `boundary` 变体被 record/parent 消费 | §5.5 S1（接缝在且达标）；`install-verify.ts` `VerifyPlan`（`install-facts` 仅数组路径消费，探针 G4a–G4c） | 高 |
| 5 放大因素 | 索引型大 map（`tasks`/`users`）每写付出 S5 + S9 两次全 map walk；父值提取把「schema 静态必填判定」变成数据依赖拒绝（G1h） | §5.3/§7 软时序（10⁵ 单键写 1115 ms）；G1h issue 归因 | 高 |
| 6 未证实假设 | 无（本报告不主张任何 Bug 根因；HEAD 在 phase-1 契约下自洽） | 负控 27/27 全绿 | 高 |
| 7 排除项 | 闸门/规划层缺陷（P1 全命中）；vfsl 接缝缺失（S1 达标）；环境/夹具/入口伪红（§9 E1/E5/E6） | §5.1/§5.5/§9 | 高 |

## 9. Causal experiments（最小因果实验 / 反证）

| id | 实验 | 结论 |
|---|---|---|
| E1 | 控制变量：同一污染在 legacy 轨（union map 位）与目标轨（record 位）的差别 | union 轨行为必须不变（NA1–NA4 恒绿），record 轨目标是收窄——证明红/绿差异由「闸门分流」这一单一变量决定 |
| E2 | 反证：读计数代理的逃逸口（`toJSON`/`keys`/`values`/`entries` 全计入 = 4×size） | 计数代理对「换批量出口的整 map 提取」不失明（G3b） |
| E3 | 反证：commit 字节 oracle 的敏感性——逻辑等价（键序无关）但 entry 字段插入序不同的 raw 构造 → 同长 43B 而**字节不同** | 字节 oracle 观察的是构造形态而非逻辑值本身（G5k），故 ND1–ND4 具备判别力 |
| E4 | 判据差异：目标键被同事务替换为**同逻辑值不同实例** → 事实核同一性 E201-C（G4g） | 「安装事实核」在 HEAD 已生效且可被独立观测 ⇒ FC（触达面外静默）与 NB（目标位仍检出）是同一 tamper 机制下的可控对照，FC 的「不抛」断言非空洞 |
| E5 | 入口/夹具自证：干净写照常成功（G1j/NA5/NC7/NC9）与非法输入仍逐字拒绝（NC1–NC5） | 契约红不是夹具错误、入口错误或「一切拒绝」的伪红 |
| E6 | 环境自证：包 tsc/根 typecheck exit 0；聚焦对 Type Errors: no errors | 契约红不是类型/环境问题 |
| E7 | 触达面内 vs 触达面外的分界（G1k/G1l vs G1a） | 载体位仍拒绝（path `[]` 文案冻结），entry 位污染不连坐 ⇒ 收窄的边界精确可判 |
| E8 | union 穿越成员内 Record 的**新键写**在污染兄弟在场时 HEAD 抛 `DOCRT-E204`（`validated map child 缺少结构字段`）——union 成员仲裁被污染翻转导致的既有 legacy 行为 | 与 #441 范围无关（plan.kind='union' 不入 record 分支）；**不纳入契约**，仅登记为既有观察项（§11/§15） |

## 10. Impact surface

- **改动面（供 SA8/SA3 参考，非本票实现）**：`packages/doc-runtime/src/mutation-local.ts` 的
  `case 'parent' \| 'record'` 内部按闸门分流；S9 侧复用既有 `VerifyPlan.install-facts`
  （`install-verify.ts` 已具备，无需新增核）；批量折迭 `composeBatchVerify` 对 `install-facts`
  项的跳过逻辑已由 #436 建立。
- **行为面（契约锚点）**：非 union Record 位 set/delete 与封闭对象 delete 的成功/失败判定、
  issue message/path、零写入、update 事件数/字节、终态与复制收敛、S9 检出集合。
- **不变面（负控锚点）**：union map 位 / union 穿越（plan.kind='union'）、kind=target（封闭对象
  set）、kind=array（#436 已收窄）、`set([])` 全量重装、批量原子语义与路径嵌套规则、公共导出面
  （本票**零新公共导出**；`public-surface-guard.test.ts` 既有断言不受影响）。
- **兼容面**：issue 路径 rebase（`[...mapPath, key, ...值内路径]`）与现行逐字节一致由 #440 vfsl
  接缝保证（S1 实测）；no-op/键 Pattern/值 schema/必填消息逐字由 NC1–NC4 锚定。
- **复制与诊断**：commit 仍为单键最小 edit（ND1–ND4）⇒ update 事件形态不变；无协议/日志面改动。
- **风险面**：触达面外污染不再被 record/parent 普通写发现（ADR 0034 决策 4 已确认取舍）；
  E201 检出面收窄到目标键位（决策 3）。

## 11. Ruled-out hypotheses

| 假设 | 判定 | 依据 |
|---|---|---|
| 「HEAD 行为在既有契约下是 Bug」 | **排除**（不是 Bug，是未实现的目标能力） | 负控 27/27 恒绿：legacy 轨在 phase-1 契约下正确；缺口 = ADR 0034 决策 1–4 无落点 |
| 「是环境/依赖/入口问题」 | 排除 | 包 tsc 0、根 typecheck 0、聚焦对无类型错误；探针与契约走真实 vitest/tsx 入口 |
| 「是夹具/oracle 自欺」 | 排除 | E5/E6；干净写全绿 + 非法输入逐字拒绝 + 读计数/字节 oracle 均有反证（E2/E3） |
| 「vfsl 侧接缝缺失或不达标」 | 排除 | §5.5 S1：`applyElementwiseEntryMutation` 公共导出、record/parent 判定达标、union 计划 fail closed |
| 「规划层需要改动」 | 排除 | P1a–P1i：闸门所需 kind/relPath/node 形状已全部可得（连值位 union 的 `<key>` 槽 union 节点亦可得） |
| 「union map 位/union 穿越也应走 fast path」 | 排除（反向） | ADR 0034 决策 1 明文永久回退；且 member 归属判别需完整 map 值（P1d/P1i + NA1–NA4 必须保持绿） |
| 「S9 收窄后目标键篡改也会静默」 | 排除 | G4e/G4f/G4g：安装事实核（同一性/在场性）在 HEAD 已生效，决策 3 明文保留 ⇒ NB1–NB5 恒绿 |
| 「union 穿越 + 新键 + 污染兄弟的 `DOCRT-E204` 是本票缺陷」 | 排除（范围外） | E8：plan.kind='union' 不入 record 分支；既有 legacy 行为，与本票无关（已从负控移除该场景，改以 NA4 的 tamper 面锚定 legacy 双核） |

## 12. Acceptance contract and test paths

### 12.1 绑定点

本票**不引入新的公共导出**：契约只经公共入口观察运行时行为——`@nomicore/doc-runtime` 的
`applyValidatedMutation` / `materializeRoot` / `readLogicalValueAtPath` / `DocRuntimeFatalError`
与 `yjs` 公共载体 API。内部接线名/形（是否新增 @internal 形态、facts 变体、闸门放置点）由
SA8/SA3 自由决定，契约语义与用例不变。

| ID | 绑定项 | 冻结值 |
|---|---|---|
| B-1 | 观察入口 | `applyValidatedMutation(derived, doc, envelope)`（单操作 + 批量信封） |
| B-2 | 闸门行为锚 | 非 union Record 位（`tasks`/`codes`/`blobs`（值位 union）/`outer.inner`）与封闭对象 delete：触达面外污染不阻断写；union map 位 / union 穿越：legacy 全量路径（污染阻断、触达面外篡改 E201-C） |
| B-3 | 成本锚 | 目标 `Y.Map` 实例 entry 读计数（`get`/`has` 逐次，批量出口按 size）；Record set/delete 值读 ≤ 2 且与 n 解耦；封闭对象 delete 父值读 ≤ 2 且与字段数解耦 |
| B-4 | 零写入锚 | 拒绝分支：`Y.encodeStateAsUpdate(doc)` 逐字节不变 ∧ update 事件数 0 |
| B-5 | commit 形态锚 | 终态字节与 update 增量字节 ≡ 同 clientID 手写最小 edit（Record delete / 封闭对象 delete ≡ `Y.Map.delete`；Record set ≡ raw Y.Map 逐字段构造） |
| B-6 | S9 锚 | fast-path 目标：事实核保留（NB）、重投影核省略（FC）；legacy：双核不变（NA3/NA4/NB5） |

### 12.2 目标行为期望（实现后必须绿）

1. **闸门（AC1）**：`plan.kind='record'` ∧ 边界值节点为含 `<key>` 槽的 object ⇒ record fast
   path（`tasks`/`codes`/`blobs`/`outer.inner`）；`plan.kind='parent'` ∧ object（无 `<key>` 槽）∧
   op=delete ⇒ 静态判定 fast path；`plan.kind='union'`（union map 位、union 穿越）⇒ legacy
   全量路径，行为与现状逐字节一致（FA1–FA11 转绿；NA1–NA5 保持绿）。
2. **成本（AC2）**：Record set/delete 不再整 map 提取/重建/重投影；k=1 时值读 ≤ 2 且
   n=512 与 n=4096 相等（FB1/FB2）；封闭对象 delete 父值读 ≤ 2 且 4 字段与 14 字段相等（FB3）；
   规模毫秒证据留探针（软）。
3. **commit 形态（AC3）**：一次成功 record set/delete 或封闭对象 delete = 恰 1 个 update 事件，
   终态与增量字节 ≡ 手写最小 edit；同基态对端应用增量后逻辑值一致；批量双键写 = 单事务
   单 update（ND1–ND6）；`set([])`/数组/union 轨 commit 形态不变。
4. **零写入（AC4）**：fast path 一切拒绝（no-op、键 Pattern、值 schema、必填、载体位、
   批量任一步失败）零写入零 update；issue message/path 与现行逐字一致（NC1–NC5/NC10/NC11）。
5. **触达面收窄（AC1/AC4）**：触达面外污染（含载体错位与值非法）不阻断目标键位写、
   不被修复/删除；触达面内载体位仍响亮拒绝（G1k/G1l 文案）。
6. **S9（AC5）**：fast-path 提交保留安装事实核（目标键覆写/重插/同值异实例：NB1–NB5 保持绿），
   省略边界重投影核（触达面外篡改不再 E201：FC1–FC4 转绿）；legacy 路径双核不变
   （NA3/NA4/NB5）；E201 变体语义（`DocRuntimeFatalError`/`post-commit-verification`/
   `committed:true`）不变。
7. **批量面**：批量元素复用同一分支 ⇒ record fast path 在批内 ok:true + 单事务单 update
   （FA8/ND6），批量失败整体零写入（NC9 对照）。
8. **绿色判据（AC6）**：契约 18/18 绿、负控 27/27 保持绿、探针 exit 0 不变、
   包 `tsc -p packages/doc-runtime/tsconfig.json` exit 0、根 `pnpm typecheck` exit 0、
   根 `pnpm test` 全绿（实现后）。

### 12.3 测试路径与 AC 映射

| 产物 | 路径 | 角色 | HEAD 红/绿 |
|---|---|---|---|
| 红契约（运行时） | `packages/doc-runtime/test/issue-441-record-fastpath-contract.test.ts` | FA1–FA8（Record）、FA9–FA11（封闭对象）、FB1–FB3（读计数）、FC1–FC4（S9 收窄）（18 tests） | **18 red**（能力缺口） |
| 负控/回归锚 | `packages/doc-runtime/test/issue-441-record-fastpath-control.test.ts` | NA1–NA5 / NB1–NB5 / NC1–NC11 / ND1–ND6（27 tests） | **27 green**（恒绿） |
| 共享夹具 | `packages/doc-runtime/test/issue-441-record-fastpath-fixture.ts` | schema/物化/污染注入/篡改窗口/读计数/字节比较/逻辑值读取（非测试入口） | 供两侧消费（tsc 净） |
| 探针（证据） | `wiki/raw/task_issue-441_sa6_capability_probe.mts` | P1/G1/G3/G4/G5/S1/NC（49 项） | exit 0（全命中） |

| AC | 契约组 |
|---|---|
| AC1 闸门分流 | FA1–FA11（红）＋ NA1–NA5、NC10/NC11（绿）＋ 探针 P1/G1 |
| AC2 O(n)→O(k) | FB1–FB3（红）＋ 探针 G3/G3b/G3c |
| AC3 commit update 事件形态不变 | ND1–ND6（绿）＋ 探针 G5f/G5g/G5g2/G5j/G5k |
| AC4 零写入 | NC1–NC4/NC10/NC11、NA1/NA2（绿）＋ FA 组（目标分支） |
| AC5 S9 收窄 | FC1–FC4（红）＋ NB1–NB5、NA3/NA4（绿） |
| AC6 包测试 + 根 gates | §13 |

### 12.4 契约纪律

- 零 skip/only/todo、零 env override、零 fallback、零吞错、零软化断言；
- 断言只观察运行时行为（判别联合结果、issue message/path/顺序、live Y.Map entry 读计数、
  update 事件与状态字节、branded fatal 事实、`readLogicalValueAtPath` 逻辑值），**不 grep 生产源码**；
- 期望值来源二选一：现行实现冻结常量（域 message/path、legacy 相对路径、E201 事实）或机制性
  oracle（手写最小 edit 字节、同基态对端复制）；
- 污染注入统一走 raw Yjs（等价 trusted raw replication）；篡改注入统一走 `afterTransaction`
  cleanup 窗口（与 issue #350/#436 SA7 同款）；
- 读计数为**结构性成本代理**（逐 entry + 批量出口均计入，且有 G3b 逃逸反证），与行为断言
  成对使用，不单独承担「未接线」判定。

## 13. Red/green or baseline evidence

| 证据 | 命令 / 文件 | 结果 |
|---|---|---|
| 探针（缺口 + 目标可达性 + 反证） | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-441_sa6_capability_probe.mts`（`artifacts/sa6-issue441-probe.log`） | **exit 0**；49/49 命中，`failures=0` |
| 红契约（聚焦） | `npx vitest run packages/doc-runtime/test/issue-441-record-fastpath-contract.test.ts`（`artifacts/sa6-issue441-contract-red.json`） | **18 failed / 18**，红因逐条 = 能力缺口（见下表） |
| 负控（聚焦） | 同命令附 `...-control.test.ts`（`artifacts/sa6-issue441-focused.log`） | **18 failed（契约）/ 27 passed（负控）= 45**，Type Errors: no errors，exit 1 |
| 复跑稳定性 | 5 轮（`artifacts/sa6-issue441-stability-{1..5}.{json,log,hash}`） | 每轮 18 red / 27 green；红灯集合 md5 `f5ca9f2bde1bd79ab98618dd96992e08` 逐轮相同 |
| 包 typecheck | `npx tsc -p packages/doc-runtime/tsconfig.json`（`artifacts/sa6-issue441-package-tsc.log`） | **exit 0**（契约/夹具/负控全部类型净） |
| 根 typecheck | `pnpm typecheck`（`artifacts/sa6-issue441-post-typecheck.log`） | **exit 0**（15 包 tsconfig 全过；契约文件在位） |
| 根 test | `pnpm test`（`artifacts/sa6-issue441-post-test.log`） | **471 files（470 passed / 1 failed）/ 5757 tests（5739 passed / 18 failed）**，Type Errors: no errors，exit 1；失败面**恰 = 契约 18 条**（`FAIL` 逐条全在 `issue-441-record-fastpath-contract.test.ts`）⇒ 负控 27 条与既有 5700+ 条零回归 |

**根 test 结果（AC6 gate 面）**：`pnpm test`（= `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`）
在契约/夹具/负控/探针全部落位后实跑：**1 file & 18 tests failed（恒 = 契约文件）、470 files &
5739 tests passed**，`Type Errors: no errors`，exit 1（`ELIFECYCLE Test failed`）。即
**post-contract 失败面恰为 18 条预期红灯，零第 4 方回归**；实现落地后该文件转绿即 AC6 达成。

**红因逐条（HEAD，稳定 5 轮）**：

| 用例 | 红因（实测） |
|---|---|
| FA1–FA9、FA11 | `ok:false`（legacy 触达面外污染连带拒绝）≠ 目标 `ok:true`（fast path 跳过整 map/父值提取） |
| FA10 | 拒绝理由 = 兄弟字段载体错位（S5 父值提取）≠ 目标静态判定 `缺少必填字段 "req"` |
| FB1 | 值读计数 2049（n=512）≫ 目标 ≤2 且与 n 解耦 |
| FB2 | 值读计数 2046（n=512）≫ 目标 ≤2 且与 n 解耦 |
| FB3 | 父值读计数 8（4 字段）≫ 目标 ≤2 且与字段数解耦 |
| FC1–FC3 | `DOCRT-E201`（重投影核检出触达面外篡改）≠ 目标「省略重投影核、静默通过」 |
| FC4 | 同上（封闭对象边界重提取失败支） |

**实现后的绿色判据**：契约 18/18、负控 27/27、探针 exit 0 不变、包 tsc 与根 `pnpm typecheck`/
`pnpm test` 复绿（AC6）。

## 14. Runner trigger evidence

- Runner：`vitest.config.ts` → `test.include: ['packages/*/test/**/*.test.ts', 'domains/*/test/**/*.test.ts',
  'apps/*/test/**/*.test.ts']`；`test.typecheck.include: ['packages/*/test/**/*.test-d.ts', …]`；
  根脚本 `pnpm test = NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`。
- 发现性实测：聚焦命令只传两个新测试文件路径，vitest 实跑 **2 files / 45 tests**（契约 18 +
  负控 27）；夹具文件名 `...-fixture.ts`（不匹配 `*.test.ts`），仅作共享模块与 tsc 面。
- 无自定义 runner、无环境变量开关、无 `describe.skip`/`it.only`；探针不在 include 面
  （`wiki/raw/**`），仅作可执行证据，不参与门禁。

## 15. Unknowns and blockers

| 项 | 说明 | 处置 |
|---|---|---|
| 无 SA8 工件 | iteration 0；契约**不绑定新公共导出/内部名形**，只锚公共运行时行为 | 设计可自由选择内部接线形态；语义/用例不变 |
| S9 收窄的取舍面 | FC1–FC4 断言的是 ADR 决策 3 明文行为（触达面外篡改静默通过）；若设计裁决改为「fast path 也重投影」，FC 需按母法重新裁决 | 属规范边界，非契约缺陷；NB（事实核保留）与 NA（legacy 双核）两侧都已钉死 |
| AC2 的「基准」形态 | ADR 决策 6 为软验收，禁绝对毫秒阈值 | 契约用结构性读计数（机器无关）+ 反证；毫秒仅探针软证据（G3c） |
| 读计数为代理 | 以目标实例 `get`/`has` 计真、批量出口按 size 计入；若未来实现改用第三种整 map 出口，代理可能失明 | 计数器已覆盖六种整 map 出口（`keys`/`values`/`entries`/`forEach`/`toJSON`/`Symbol.iterator`），G3b 以其中四种举证 4×size；且 FA 组（行为）与之成对，接线未落地时不可伪绿 |
| 批量面折迭 | record fast-path 项的 `verify.kind='install-facts'` 跳过折迭（#436 已建立）；legacy 边界项对批内足迹的吸收不变 | 属 SA3 内部形态改造；FA8/NC9/ND6 只锚行为 |
| union 穿越成员内 Record 的既有 E204 | 污染兄弟使 union 成员仲裁翻转 + 新键写 → `DOCRT-E204: 写前 internal 不变量破坏（validated map child 缺少结构字段（u2））`（plan.kind='union'，既有 legacy 行为） | 与本票范围无关，**不纳入契约**；登记于此供设计/评审知悉（E8 内联引文；该场景已从负控移除，改以 NA4 的 tamper 面锚定 legacy 双核） |
| 实现后根 test 全绿 | 见 §13「根 test 结果」 | AC6 为实现期判据 |

## 16. Temporary diagnostics cleanup

- 生产实现**零改动**：`git status` 仅新增测试/夹具/探针/报告/证据日志（`packages/*/src` 无变更，
  `git diff` 为空）；无 `tsconfig`/`vitest.config.ts`/`pnpm-lock.yaml` 改动。
- 临时诊断日志（探针迭代 1–5 轮、聚焦首轮含 union 穿越 E204 观察）已在收尾前删除，不留在
  交付面；**最终证据面** = `sa6-issue441-probe.log`、`sa6-issue441-focused.log`、
  `sa6-issue441-contract-red.json` / `sa6-issue441-contract-json.log`、
  `sa6-issue441-stability-{1..5}.{json,log,hash}`、`sa6-issue441-package-tsc.log`、
  `sa6-issue441-post-typecheck.log`、`sa6-issue441-post-test.log`。
  union 穿越 E204 观察（§9 E8/§15）以报告内联引文留证（`DOCRT-E204: 写前 internal 不变量破坏
  （validated map child 缺少结构字段（u2））`），不依赖临时日志。
- 无长驻服务、无后台进程、无 PID 文件、无端口占用、无 nohup/setsid；依赖安装为 offline store
  命中（零网络）。探针为可复现证据脚本（非临时残留），按 SA6 契约保留。
- 报告为固定产物原位写入（本票 iteration 0 无既有报告/未提交测试需原位修订）。

---

## 附：本报告结论一句话

**approve**：HEAD（#440 已合入）的 doc-runtime record/parent 写**一律**走 legacy 全量边界
路径——触达面外污染照旧阻断写（载体错位/键 Pattern/值非法三面实测）、Record 单键写读计数
∝ n（n=512→2049、n=4096→16385）、封闭对象 delete ∝ 父字段数（4→8、14→28，10⁵ entry 单键写
1115 ms vs 10³ 12 ms）、S9 重投影核对所有 record/parent 提交（触达面外篡改 E201-C）；
ADR 0034 决策 1–4 要求的闸门分流、O(k)/O(1) 结算与 S9 收窄**零落点**，而 vfsl 侧逐 entry
接缝已由 #440 交付并就绪。本报告以 **18 条红灯运行时契约**（闸门/触达面收窄、读计数
O(k)、S9 收窄）+ **27 条恒绿负控**（union 永久 legacy、安装事实核、域规则逐字、零写入、
commit 字节形态与复制面）+ **49 项探针**（含读计数逃逸反证与字节 oracle 敏感性反证），把
目标行为、兼容面与 fail-closed 闸门固化为可执行验收契约，供 SA8/SA9 消费。
