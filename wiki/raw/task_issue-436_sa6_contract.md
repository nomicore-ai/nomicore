# SA6 诊断与验收契约 — issue #436：doc-runtime 数组 fast path 接线与 S9 收窄（ADR 0033）

- HEAD：`7407ce01367b6d7a3fe497cd78c4bcf085f3ddbb`（worktree 分支 `mabf/issue-436`；HEAD 已含
  PR #444 = issue #435 的 vfsl 逐元素接缝 + ADR 0033 立法，doc-runtime 消费侧**未接线**）。
- 任务类型：**Feature（能力缺口 + 验收契约）**，含 S9 收窄的已确认取舍面（ADR 0033 决策 3/4）。
  本报告**不虚构 Bug 根因**：HEAD 的「整数组提取 → 全量重建 → 边界重投影」在 phase-1 契约下
  是正确的（负控/基线全绿）；缺口 = ADR 0033 决策 1–4 要求的 doc-runtime 双轨分流、
  O(k) 结算与 S9 收窄**尚不存在**。
- 固定产物：本报告 + `packages/doc-runtime/test/issue-436-array-fastpath-contract.test.ts`
  （**红灯验收契约，8 tests**）+ `...-control.test.ts`（**恒绿负控/回归锚，17 tests**）+
  `...-fixture.ts`（共享夹具/读计数/字节 oracle）+ 探针
  `wiki/raw/task_issue-436_sa6_capability_probe.mts`（38 项，exit 0）；生产实现**零改动**。
- 聚焦执行（runner 真实入口）：
  `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime/test/issue-436-array-fastpath-contract.test.ts packages/doc-runtime/test/issue-436-array-fastpath-control.test.ts`
  ⇒ **8 failed（契约，全部 = 能力缺口）/ 17 passed（负控）**，exit 1；连续 5 轮红灯集合逐轮同
  md5 `719cbdb4d89a9e9001375b4ab487e161`。
- 结论：**approve** —— 能力缺口 5 组可运行证据化（闸门/成本/越界/S9/接线面）；目标行为由
  ADR 0033 + CONTEXT 词汇 + #435 已交付接缝共同确定；契约以**运行时行为**（判别联合结果、
  live 元素读计数、update 字节、E201 branded fatal）锚定，负控 17/17 恒绿，判据反证完备；
  验收契约可执行、runner 入口真实。

---

## 1. Task type and inputs

| 输入 | 路径 / 来源 | 说明 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-436.md`（Host 提供，untracked） | issue #436 正文：Parent PR #434、Task Type = feature、What to build + AC1–AC7；Blocked by #435（HEAD 已解除） |
| issue 原文 | GitHub issue #436（Host 快照） | comments = 空；**无 owner 要求** |
| 母法（规范） | `docs/adr/0033-elementwise-yarray-mutation-validation.md`（HEAD 合入） | 决策 1 闸门 + 永久双轨；决策 2 fast path O(k) 管线与逐字域规则；决策 3 S9 收窄；决策 4 触达面重定义；决策 5 立法；决策 6 性能验收（软） |
| 词汇/纪律 | `CONTEXT.md` L144（重建校验/数组位例外）、L202（trusted-raw-replication 触达面） | 数组位例外（ADR-0033）：非 union `T[]` 逐元素；union 数组目标仍整体验证；「对污染数组的 delete 由响亮拒绝变为照常成功」 |
| 前置能力（已交付） | PR #444（`feat(vfsl): validate array mutations elementwise` / #435） | `applyElementwiseArrayMutation(derived, plan, facts, payload)`：O(1) 载体事实 + 新值逐元素；对 `plan.node.kind !== 'array'` fail closed（union 数组永久 legacy 的接缝侧保证） |
| 现状消费方 | `packages/doc-runtime/src/mutation-local.ts` case `'array'`（L296–347：S5 `walk` 整数组 → S6 `applyMutationAtBoundary` → S9 verify 输入含 `proposedBoundary`） | fast path 的目标改造面 |
| S9 实现 | `packages/doc-runtime/src/install-verify.ts` `verifyBoundaryIntact`（L395–459：① 安装事实核 O(1) ② 边界重投影核 O(boundary)） | 决策 3 收窄 = fast-path 提交省略 ②、保留 ① |
| 批量面 | `packages/doc-runtime/src/mutation.ts` `prepareBatchMutation`/`composeBatchVerify`（L232–374） | 批量元素复用同一 `prepareLocalMutation` ⇒ 数组分支自动继承双轨；数组 plan 的 prefix = 操作路径（引理 3 零折迭） |
| 包纪律 | `packages/doc-runtime/AGENTS.md` | 校验失败零写入；detached 构造 + 单 guarded transaction；公共面只经 `src/index.ts`；写后不变量失败 = fatal 非可恢复 |
| **缺失输入** | `task_issue-436_relevant_decisions.md` / `_conflict_report.md` / `_design.md` / SA8 门 | **不存在**（iteration 0；`ls wiki/raw` 核对）。不影响诊断与契约：§3 以 ADR 0033 + CONTEXT + 简报 AC 替代 SA8 约束面 |

## 2. Owner comment mapping

**无 owner 要求**：Host 简报明文「Current Issue REST comments: none (no owner requirements)」；
本次契约全部条目源自简报 AC1–AC7 + ADR 0033 决策 1–4 + `CONTEXT.md` 数组位例外词条，无外部
owner 追加面。

## 3. SA8 constraints

#436 无 SA8 工件（iteration 0）。可用的规范约束面（替代 SA8 约束表）：

| 来源 | 约束（逐条） |
|---|---|
| ADR 0033 决策 1 | 闸门 = `planMutationBoundary` 产出 kind=`array` **且**边界值节点 kind=`array`；union 数组目标（`A[] \| B[]`）**永久回退** legacy；规划层不动，只动执行层 |
| ADR 0033 决策 2 | 越界检查读 live `Y.Array.length`（O(1)，不 clamp、拒越界 no-op、批量一次判定）；insert 逐新值过 element 子 schema + `buildDetachedValue` 逐值 O(k)，issue 路径 `[...arrayPath, index+j]` 与现状逐字节一致；delete 仅域规则 O(1)；commit = Y.Array 区间最小 edit（update bytes 形态不变）；**一切拒绝先于 live 写** |
| ADR 0033 决策 3 | S9：安装事实核（长度算术 + 插入项同一性）原样保留；fast-path 提交**省略**边界重投影核（无 `proposedBoundary`）；legacy 双核不变；后果 = 区间外同事务篡改由 E201 检出变为静默通过（已确认取舍） |
| ADR 0033 决策 4 | 触达面 = 数组载体 + 变更区间；**污染数组的 delete 从响亮拒绝变为照常成功**；未触达元素不再承担污染检测 |
| ADR 0033 决策 6 | 性能验收（软）：O(n)→O(k)，以基准或等价证据，**不钉绝对毫秒阈值** |
| 简报 AC1–AC7 | 见 §12.3 映射表 |
| `CONTEXT.md` L144/L202 | 数组位例外与触达面收窄已是规范性词汇（非本票新立） |
| `packages/doc-runtime/AGENTS.md` | 验证失败零写入；公共面只经 `index.ts`（本票无需新公共导出——fast path 是内部管线改造，契约只锚公共 `applyValidatedMutation` 的运行时行为） |

## 4. Environment and baseline

- 环境：node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、typescript `5.9.3`、tsx `4.23.12`、
  yjs `13.6.32`；`pnpm install --offline --frozen-lockfile`（store 命中，521ms，零网络）。
- **pre-contract 基线**（契约文件未落位时）：
  - `pnpm typecheck` **exit 0**（15 个包 tsconfig 全过；`artifacts/sa6-issue436-baseline-typecheck.log`）；
  - `pnpm test`（`vitest run --typecheck`）**462 files / 5622 tests 全绿，Type Errors: no errors**，
    exit 0，Duration 444.35s（`artifacts/sa6-issue436-baseline-test.log`）。
- **post-contract**（契约 3 文件在位）：
  - `pnpm typecheck` **exit 0**（15 个包 tsconfig 全过；契约/夹具仅测试面，运行时不参与 tsc
    判决；`artifacts/sa6-issue436-post-typecheck.log`）；
  - `pnpm test` **464 files（463 passed / 1 failed = 契约文件）、5647 tests（5639 passed /
    8 failed）**，Type Errors: no errors，exit 1，Duration 412.14s
    （`artifacts/sa6-issue436-post-test.log`）；**5639 = pre-contract 5622 + 负控 17**，
    8 failed 恰 = 契约 8 条，**零第 4 方回归**；包级 `tsc -p packages/doc-runtime/tsconfig.json`
    **exit 0**（`artifacts/sa6-issue436-package-tsc.log`）。
- 复现率：聚焦对（契约 + 负控）连续 5 轮 = **8 red / 17 green**，红灯集合（全名排序）md5
  `719cbdb4d89a9e9001375b4ab487e161` 逐轮相同（`artifacts/sa6-issue436-stability-{1..5}.log`）。
- 时序/规模：全部断言为同步纯调用，零真实时钟阈值（读计数为结构性成本代理）、零网络、零并发；
  契约内最大规模 n = 4096（读计数举证）；探针另含 n = 10^5 软证据。

## 5. Positive reproduction（能力缺口，逐条可运行）

探针：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-436_sa6_capability_probe.mts`
⇒ **exit 0（38/38 命中）**，完整输出 `artifacts/sa6-issue436-probe.log`。

### 5.1 G1 非 union `T[]` 写仍走 legacy 全量路径（污染照旧阻断 = fast path 未接线）

| 场景（HEAD） | 实测 |
|---|---|
| `items: YArray<number>` raw 污染 index 0 后 `array-delete index 2` | `ok:false`，issue `类型不匹配：期望 number，实际 string` path `["items",0]` |
| `rows: YArray<{qty;tag}>` raw 污染 `rows[0].qty='x'` 后 `array-insert index 1`（新值合法） | `ok:false`，path `["rows",0,"qty"]` |
| 批量信封内同款 delete | `ok:false`，path `["items",0]`（聚合失败、零写入） |

⟹ 现行数组分支必须先整数组提取（S5 `walk`）才能结算；ADR 0033 决策 4 的触达面收窄无载体。

### 5.2 G2 成本 ∝ n（live 元素读计数；结构性证据）

读计数 = 目标 `Y.Array` 实例在 mutation 调用窗口内的元素读（`get` 逐元素、`toArray`/`forEach`
按元素数计入；见 §9 E8 反证）。

| op（HEAD） | n=512 | n=4096 | 说明 |
|---|---|---|---|
| `array-insert` append（k=1） | **1026** | **8194** | S5 walk n + S6 重建 + S9 重投影 walk (n+1) + 安装同一性 1 |
| `array-delete index 0 count 1` | **1023** | **8191** | S5 walk n + S9 重投影 walk (n−1) |
| `array-delete index = n`（越界拒绝） | **512** | **4096** | 域规则判定前已整数组提取（越界检查非 O(1)） |
| G2d 反证：`toArray()` 整数组出口 | 64（n=64） | — | 换批量出口逃逸逐元素计数也被计入 ⇒ 计数代理无逃逸口 |

### 5.3 G5 成本与规模耦合（软证据，ADR 0033 决策 6 面）

`items` 单元素 append：n=10³ **1.7 ms**；n=10⁵ **150.7 ms**（100× 规模 → **×89.2**）。
（仅诊断证据；契约不含毫秒阈值。）

### 5.4 G4 S9 现状：区间外同事务篡改 → E201-C（重投影核覆盖全部数组提交）

| 场景（HEAD） | 实测 |
|---|---|
| `array-insert index 3` + observer 在 `afterTransaction` 覆写 index 0（长度不变） | throw `DOCRT-E201`（`键 "0" 读回 99 与对照安装读回 1 不等价`），`committed:true` |
| `array-delete index 3 count 1` + 同款篡改 | throw `DOCRT-E201`（同上） |

⟹ 决策 3「fast-path 省略重投影核」在 HEAD 无载体；收窄后上两例将静默通过（§12.2 目标行为 6）。

### 5.5 S/U 闸门与双轨事实

| 事实 | 实测 |
|---|---|
| S1–S3 #435 接缝已存在 | `applyElementwiseArrayMutation` 是函数；非 union 计划 `{ok:true}`；union 计划（`node.kind='union'`）**fail closed** `ok:false` |
| U1 union 数组目标计划形状 | `plan.kind='array'`、`plan.node.kind='union'`（⇒ 闸门第二条件必须看**节点** kind） |
| U2 union 穿越（成员内数组） | `plan.kind='union'`（⇒ 永久 legacy，不入 array 分支） |
| U3/U5 union 数组/穿越 + 污染 delete | `ok:false`（path `["uarr",0]` / `["umem","items",0]`），零写入 |
| U4 union 数组 + 区间外篡改 | throw `DOCRT-E201`（双核） |
| U6/U7 union 数组干净 insert/delete | `ok:true` + 终态正确（legacy 轨行为正确） |

### 5.6 O/N commit 形态与现状语义快照

| 场景 | 实测 |
|---|---|
| O1/O3 API `insert/delete` 终态字节 ≡ 手写 `Y.Array` 最小 edit（同 clientID） | 逐字节相同（229B / 229B）；单 update 事件字节亦相同（O2） |
| O4/O5 反证：clear+rebuild（逻辑值等价） | 终态字节 228B ≠ 229B、update 增量 ≠ API ⇒ 字节 oracle **对提交形态敏感** |
| N1/N2 越界 insert/delete | 逐字消息 + path 精确 + 零写入 + 零 update |
| N3 insert 非法新值 | issue path = 插入后位置（`["items",2]`） |
| N4/N9 `index === length` append、`index+count === length` delete | `ok:true`（不 clamp） |
| N5/N6/N7 安装事实核（长度算术 / 插入项同一性 / delete 长度） | 同事务干扰 → E201-C `committed:true` |
| N8 批量干净数组 op | `ok:true` + 终态正确 |
| N10 复制面 | 增量 update 应用同基态对端后逻辑值一致（单事件） |

### 5.7 缺口 × AC × 红灯落点

| AC | 现状（HEAD） | 红灯落点 |
|---|---|---|
| AC1 闸门分流：非 union fast / union legacy | 一律 legacy（污染照旧阻断） | 契约 FA1/FA2/FA3；负控 NA1–NA4 |
| AC2 O(n)→O(k)（基准或等价证据） | 读计数 ∝ n（1026/8194；越界 512/4096） | 契约 FB1/FB2/FB3；探针 G2/G2d/G5 |
| AC3 越界基于 live 长度、域规则一致 | 域规则正确但判定前先整数组提取 | 契约 FB3（O(1) 读）；负控 NC1/NC2/NC4 |
| AC4 update 事件形态不变 | 最小 edit（正确）；无 fast path 可比 | 负控 ND1–ND4；探针 O1–O5 |
| AC5 零写入：fast path 一切失败分支 | 现行拒绝已零写入（绑在整数组路径上） | 负控 NC1–NC3/NA1/NA3；契约 FA 组为「目标分支」 |
| AC6 S9：fast-path 仅安装事实核 / legacy 双核不变 / E201 语义保持 | 全部提交双核（区间外篡改 E201） | 契约 FC1/FC2（省略）；负控 NB1–NB4（事实核保留）、NA2/NA4（legacy 双核） |
| AC7 包测试 + 根 typecheck/test 绿 | pre-contract 全绿（§4）；实现后须复绿 | §13（当前红面 = 契约 8 条） |

## 6. Negative control（恒绿；排除环境/夹具/oracle/入口伪红）

`packages/doc-runtime/test/issue-436-array-fastpath-control.test.ts` — **17/17 passed**（HEAD 实测，
`artifacts/sa6-issue436-stability-1.log`），实现落地后必须保持全绿：

| 组 | 锚定内容 |
|---|---|
| NA1–NA4 | union 数组目标 / union 穿越**永久 legacy**：污染照旧拒绝（path 精确 + 零写入零 update）、区间外篡改照旧 E201-C、干净写正常 ok:true（⇒ 闸门不得过度接管，且 union 不得被误判为可 fast-path） |
| NB1–NB4 | S9 **安装事实核**保留：append 额外插入（长度算术）、插入项被覆写（同一性）、delete 被补回（长度算术）、union 数组同款 —— 两条轨上都须 E201-C（`post-commit-verification`/`committed:true`） |
| NC1–NC5 | 域规则逐字（越界 message/path、`index === length`/`index+count === length` 接受、批量值逐位 issue 升序）+ 一切拒绝零写入零 update + 批量干净数组 op ok:true |
| ND1–ND4 | commit = Y.Array 区间最小 edit：终态字节与 update 增量字节 ≡ 手写最小 edit（同 clientID）；复制面增量 update 收敛 |

## 7. Stability, scale and timing

- 复跑稳定性：契约 + 负控连续 **5 轮**（`artifacts/sa6-issue436-stability-{1..5}.log`）——
  每轮 **8 red / 17 green**，红灯集合 md5 逐轮相同；红因逐条 = 能力缺口（1 条 `ok:false` 断言
  差异 + 读计数断言 + 2 条 E201 未收窄），无任何环境/夹具/入口类错误。
- 夹具确定性：零随机源（无 mulberry32）、零时钟断言；schema/初始值/篡改序列全为常量；
  字节 oracle 用例显式固定 `clientID`（4242/777），逐轮字节相同。
- 规模条件：契约 n ∈ {512, 4096}（读计数举证）；探针另含 n ∈ {10³, 10⁵} 软证据；
  单轮聚焦 < 1s（25 tests，含 4096 元素夹具）。
- 无并发、无网络、无服务、无长驻进程。

## 8. Capability gap chain（Feature：证明能力缺失，不虚构 Bug 根因）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 症状（能力面） | AC1–AC6 要求的 doc-runtime 双轨分流、O(k) 结算、S9 收窄在 HEAD 零落点 | 探针 G1/G2/G4（§5.1/5.2/5.4）+ 契约 8 红 | 高（运行时实测） |
| 2 直接缺口点 | 数组分支是**边界值驱动**：先 `walk(boundaryNode, boundaryLive)` 整数组提取（S5），再 `applyMutationAtBoundary(..., walked.snapshot, payload)`（S6 重建 + 整体 `validateSubtree`），并把 `proposedBoundary` 交给 S9 | `mutation-local.ts` L296–347；探针 G1（污染阻断）/G2（读计数）/G4（重投影检出） | 高（源码 + 实测） |
| 3 触发条件 | 任一非 union `YArray` 目标的 `array-insert`/`array-delete`（含批量元素） | 探针 G1c/N8；契约 FA1–FA3 | 高 |
| 4 放大因素 | 成本与 n 解耦失败：单元素 append/delete 付 2 次全数组 walk + 全量重建 + 重投影；越界拒绝亦先付 n 次提取 | 探针 G2a/G2b/G2c + G5（×89.2 / 100× 规模） | 中（成本类；结构性计数为高，毫秒为软证据） |
| 5 最深根因（能力） | vfsl 侧接缝 **已具备**（#435 `applyElementwiseArrayMutation`，O(1) facts + 逐元素）；缺的是 doc-runtime 执行层按闸门分流、把 S5/S6/S9-② 换成 O(1)/O(k) 形态 | 探针 S1–S3；§5.5 | 高 |
| 6 行为面缺口 | 决策 4 触达面收窄（污染数组 delete 转成功）与决策 3 S9 收窄（区间外篡改静默通过）均无载体 | 探针 G1a/G4 对目标行为（契约 FA1/FC1/FC2） | 高 |
| 7 未证实假设 | 无。**明确不主张**：现行整数组路径有缺陷、域规则有偏差、issue 路径/顺序有误、字节形态异常——负控 NC/ND 与基线证明这些在现行契约下正确且必须保持 | 负控 17/17 绿；探针 N/O 组 | 高 |
| 8 排除项 | 非环境（基线全绿）、非 runner 发现面（§14）、非接缝缺失（S1–S3）、非 union 目标误判（U1/U2 与 NA2）、非 plain 数组（无 array-* 入口） | §4/§11 | 高 |

## 9. Causal experiments（最小因果实验 / 反证）

| # | 实验 | 控制变量 | 结果 | 结论 |
|---|---|---|---|---|
| E1 | 载体事实 `{length}` 路径对照（#435 G2 复现面） | 同 plan、同 payload | 现行接缝要求整数组值（污染阻断/读计数 ∝ n） | 现行输入契约 = 整数组提取值（缺口机制确认） |
| E2 | 读计数随 n 缩放 | 同 op（append k=1），n=512 vs 4096 | 1026 → 8194（delete 1023 → 8191） | 成本 ∝ n；O(k) 目标为「计数与 n 解耦且 ≈ k」 |
| E3 | 越界拒绝的提取顺序 | 同 op（越界 delete），n=512 vs 4096 | 读计数 = n（512/4096） | 域规则判定前已整数组提取 ⇒ live 长度 O(1) 检查未接线 |
| E4 | S9 覆盖率对照 | 区间外篡改 vs 无篡改，同 op | 无篡改 `ok:true`；篡改 → E201-C | E201 是重投影核行为；收窄后该例静默通过（目标行为，非回归） |
| E5 | 字节 oracle 双向 | ① API vs 手写最小 edit；② API vs clear+rebuild | ① 逐字节相同；② 终态 228B ≠ 229B 且增量字节不同 | 断言对「commit 形态=最小 edit」敏感（非恒真） |
| E6 | 接缝存在性 | vfsl 公共面 | 非 union 计划 `{ok:true}`；union 计划 fail closed | 缺的不是接缝而是接线；union 永久 legacy 有接缝侧保证 |
| E7 | 闸门判别位 | union 数组目标 plan 形状 | `plan.kind='array'` 但 `node.kind='union'` | 只按 `plan.kind` 接管会失守（负控 NA1/NA2 红灯钉死） |
| E8 | 读计数代理逃逸面 | 逐元素 `get` vs 批量出口 `toArray` | 批量出口按 n 计入（64/64） | 计数代理覆盖两种整数组提取风格（无逃逸口） |
| E9 | 环境因果排除 | 同一 command 下负控文件 | 17/17 绿（写入、篡改 E201、字节 oracle 全部工作） | 契约红不可能由环境/夹具/入口造成 |

## 10. Impact surface

- **改造面（SA3 实现面，本报告不改）**：`mutation-local.ts` case `'array'`（S5 省略 / S6 换
  `applyElementwiseArrayMutation` / S9 verify 输入不带 `proposedBoundary`）；`install-verify.ts`
  `verifyBoundaryIntact`（fast-path 形态下跳过重投影核，事实核保留）；`mutation.ts` 批量
  `composeBatchVerify`（数组 plan 的 `proposedBoundary` 来源收敛）。
- **语义面**：非 union `T[]` 的 insert/delete 触达面收窄为「载体 + 变更区间」（污染不再阻断、
  区间外篡改不再 E201 —— ADR 0033 决策 3/4 的已确认取舍）；合法基线上的接受/拒绝结论、issue
  message/path/顺序逐字节不变（负控 NC 组）。
- **不变量面**：提交形态（Y.Array 区间最小 edit）与 update bytes 形态不变 ⇒ 复制协议与诊断捕获
  窗口零改动（负控 ND 组 + 探针 O 组）。
- **不受影响**：union 数组目标与 union 穿越（永久 legacy）、`YPlainArray`（无 array-* 入口）、
  set/delete/Record/union 边界路径、`set([])` legacy 全量管线、公共导出面（本票无新公共 API）、
  namespace-runtime 写槽与 diagnostic-log 适配器。
- **兼容风险**：闸门第二条件（节点 kind）若漏判，union 目标会被误接管（负控 NA1/NA2 红灯）；
  S9 若连事实核一起省略，NB1–NB4 红灯；若 fast path 采用 write-then-undo 或非最小 edit，
  NC 零写入 / ND 字节断言红灯。

## 11. Ruled-out hypotheses

| 假设 | 排除证据 |
|---|---|
| 「现行整数组提取/重投影有 Bug」 | 负控 NA/NB/NC/ND 与 baseline 全绿：现行语义按 phase-1 契约正确；本票是能力缺口 |
| 「红是环境/依赖/夹具问题」 | pre-contract `pnpm typecheck` exit 0、`pnpm test` 462 files/5622 tests 全绿；同 command 下负控 17/17 绿 |
| 「红是 runner 入口/发现面问题」 | §14：聚焦命令实跑 2 files / 25 tests；根套件发现性在 §13 记录 |
| 「#435 接缝尚未交付、本票无可用构件」 | 探针 S1–S3：接缝存在且对 union 计划 fail closed（HEAD 已含 PR #444） |
| 「union 数组目标由 `plan.kind` 区分」 | 探针 U1：`plan.kind='array'`、`node.kind='union'`；负控 NA1/NA2 以 behavior 钉死 |
| 「性能必须以毫秒阈值断言」 | ADR 决策 6 为软验收；契约改用**结构性读计数**（机器无关），毫秒仅探针软证据 |
| 「读计数代理可被批量出口绕过」 | 探针 G2d：`toArray` 按元素数计入 |
| 「字节 oracle 只证明值相等、对形态不敏感」 | 探针 O4/O5：逻辑等价的 clear+rebuild 提交字节可分 |
| 「S9 收窄是测试软化/伪绿」 | FC 断言的是 ADR 决策 3 明文取舍，且与 NB（事实核保留）、NA（legacy 双核不变）成对，任一方向偏移都有红灯 |

## 12. Acceptance contract and test paths

### 12.1 绑定点

本票**不引入新的公共导出**：契约只经公共入口观察运行时行为——`@nomicore/doc-runtime` 的
`applyValidatedMutation` / `materializeRoot` / `readLogicalValueAtPath` / `DocRuntimeFatalError`
与 `yjs` 公共载体 API。内部接线名/形（是否新增 @internal 形态、facts 变体等）由 SA8/SA3 自由决定，
契约语义与用例不变。

| ID | 绑定项 | 冻结值 |
|---|---|---|
| B-1 | 观察入口 | `applyValidatedMutation(derived, doc, envelope)`（单操作 + 批量信封） |
| B-2 | 闸门行为锚 | 非 union `T[]`：区间外污染不阻断写；union 数组目标 / union 穿越：legacy 全量路径（污染阻断、区间外篡改 E201-C） |
| B-3 | 成本锚 | 目标 `Y.Array` 实例元素读计数（`get`/`toArray`/`forEach` 计真）；k=1 时 ≤ 8 且与 n 解耦 |
| B-4 | 零写入锚 | 拒绝分支：`Y.encodeStateAsUpdate(doc)` 逐字节不变 ∧ update 事件数 0 |
| B-5 | commit 形态锚 | 终态字节与 update 增量字节 ≡ 同 clientID 手写 `Y.Array.insert/delete` |
| B-6 | S9 锚 | fast-path 目标：fact 核保留（NB）、重投影核省略（FC）；legacy：双核不变（NA2/NA4/NB4） |

### 12.2 目标行为期望（实现后必须绿）

1. **闸门（AC1）**：`plan.kind='array'` ∧ 边界节点 kind=`array` ⇒ fast path；边界节点
   kind=`union`（union 数组目标）或 `plan.kind='union'`（union 穿越）⇒ legacy 全量路径，
   行为与现状逐字节一致（FA1–FA3 转绿；NA1–NA4 保持绿）。
2. **成本（AC2）**：单元素 insert/delete 不再整数组提取/重建/重投影；k=1 时 live 元素读计数
   ≤ 8 且 n=512 与 n=4096 相等（FB1/FB2）；规模毫秒证据留探针（软）。
3. **越界与域规则（AC3）**：越界 insert/delete 读计数 ≤ 4（live 长度 O(1) 判定）且 message/path
   逐字不变、零写入（FB3 + NC1/NC2）；`index === length`、`index+count === length` 照常接受（NC4）。
4. **零写入（AC5）**：fast path 一切拒绝（越界、非法新值、批内非法）零写入零 update；批量
   失败整体零写入（NC1–NC3）。
5. **update 形态（AC4）**：一次成功数组写 = 恰 1 个 update 事件，终态与增量字节 ≡ 手写最小 edit；
   同基态对端应用增量后逻辑值一致（ND1–ND4）。
6. **S9（AC6）**：fast-path 提交保留安装事实核（长度算术 + 插入项同一性：NB1/NB2/NB3 转绿于
   fast path），省略边界重投影核（区间外篡改不再 E201：FC1/FC2 转绿）；legacy 路径双核不变
   （NA2/NA4/NB4）；E201 变体语义（`DocRuntimeFatalError`/`post-commit-verification`/
   `committed:true`）不变（NB 组断言）。
7. **批量面**：批量元素复用同一分支 ⇒ 污染数组 delete 在批内 ok:true（FA3），干净数组 op
   与现状一致（NC5）。
8. **绿色判据（AC7）**：契约 8/8 绿、负控 17/17 保持绿、探针 exit 0 不变、
   包 `tsc -p packages/doc-runtime/tsconfig.json` exit 0、根 `pnpm typecheck` exit 0、
   根 `pnpm test` 全绿（实现后）。

### 12.3 测试路径与 AC 映射

| 产物 | 路径 | 角色 | HEAD 红/绿 |
|---|---|---|---|
| 红契约（运行时） | `packages/doc-runtime/test/issue-436-array-fastpath-contract.test.ts` | FA1–FA3 / FB1–FB3 / FC1–FC2（8 tests） | **8 red**（能力缺口） |
| 负控/回归锚 | `packages/doc-runtime/test/issue-436-array-fastpath-control.test.ts` | NA1–NA4 / NB1–NB4 / NC1–NC5 / ND1–ND4（17 tests） | **17 green**（恒绿） |
| 共享夹具 | `packages/doc-runtime/test/issue-436-array-fastpath-fixture.ts` | schema/物化/篡改窗口/读计数/字节比较（非测试入口） | 供两侧消费（tsc 净） |
| 探针（证据） | `wiki/raw/task_issue-436_sa6_capability_probe.mts` | G1–G5 / S1–S3 / U1–U7 / O1–O5 / N1–N10（38 项） | exit 0（全命中） |

| AC | 契约组 |
|---|---|
| AC1 闸门分流 | FA1–FA3（红）＋ NA1–NA4（绿）＋ 探针 U1/U2 |
| AC2 O(n)→O(k) | FB1/FB2（红）＋ 探针 G2/G2d/G5 |
| AC3 live 长度越界 + 域规则一致 | FB3（红）＋ NC1/NC2/NC3/NC4（绿） |
| AC4 update 事件形态不变 | ND1–ND4（绿）＋ 探针 O1–O5 |
| AC5 零写入 | NC1–NC3、NA1/NA3（绿）＋ FA（目标分支） |
| AC6 S9 收窄 | FC1/FC2（红）＋ NB1–NB4、NA2/NA4（绿） |
| AC7 包测试 + 根 gates | §4/§13 |

### 12.4 契约纪律

- 零 skip/only/todo、零 env override、零 fallback、零吞错、零软化断言；
- 断言只观察运行时行为（判别联合结果、issue message/path/顺序、live 元素读计数、update 事件与
  状态字节、branded fatal 事实、`readLogicalValueAtPath` 逻辑值），**不 grep 生产源码**；
- 期望值来源二选一：现行实现冻结常量（域 message/path、E201 事实）或机制性 oracle
  （手写最小 edit 字节、同基态对端复制）；
- 篡改注入统一走 `afterTransaction` cleanup 窗口（与 issue #350 SA7 同款、yjs 实证先于
  `verifyBoundaryIntact` 派发），每个篡改用例都不是唯一变量——无篡改对照在 FB/NC 组内恒绿；
- 读计数为**结构性成本代理**（逐元素与批量出口均计入），与行为断言成对使用，不单独承担
  「未接线」的判定。

## 13. Red/green or baseline evidence

| 证据 | 命令 / 文件 | 结果 |
|---|---|---|
| pre-contract 根 typecheck | `pnpm typecheck`（`artifacts/sa6-issue436-baseline-typecheck.log`） | **exit 0**（15 包 tsconfig） |
| pre-contract 根 test | `pnpm test`（`artifacts/sa6-issue436-baseline-test.log`） | **462 files / 5622 tests 全绿**，Type Errors: no errors，exit 0 |
| 探针（缺口 + 目标可达性 + 反证） | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-436_sa6_capability_probe.mts`（`artifacts/sa6-issue436-probe.log`） | **exit 0**；38/38 命中，`failures=0` |
| 红契约（聚焦） | `npx vitest run packages/doc-runtime/test/issue-436-array-fastpath-contract.test.ts` | **8 failed / 8**，红因逐条 = 能力缺口 |
| 负控（聚焦） | 同命令附 `...-control.test.ts`（`artifacts/sa6-issue436-focused-final.log`） | **8 failed（契约）/ 17 passed（负控）= 25**，exit 1 |
| 复跑稳定性 | 5 轮（`artifacts/sa6-issue436-stability-{1..5}.log`） | 每轮 8 red / 17 green；红灯集合 md5 `719cbdb4d89a9e9001375b4ab487e161` 逐轮相同 |
| 包 typecheck | `npx tsc -p packages/doc-runtime/tsconfig.json`（`artifacts/sa6-issue436-package-tsc.log`） | **exit 0**（契约/夹具/负控全部类型净） |
| post-contract 根 typecheck | `pnpm typecheck`（`artifacts/sa6-issue436-post-typecheck.log`） | **exit 0**（契约文件在位；运行时不参与 tsc 判决） |
| post-contract 根 test | `pnpm test`（`artifacts/sa6-issue436-post-test.log`） | **464 files / 5647 tests：463 files & 5639 tests passed、1 file & 8 tests failed**；失败面恰 = 契约 8 条（`FAIL` 逐条全在 `issue-436-array-fastpath-contract.test.ts`），Type Errors: no errors，exit 1；**5639 = 基线 5622 + 负控 17**，零第 4 方回归 |

**实现后的绿色判据**：契约 8/8、负控 17/17、探针 exit 0 不变、包 tsc 与根 `pnpm typecheck`/
`pnpm test` 复绿（AC7）。

**红因逐条（HEAD，稳定 5 轮）**：

| 用例 | 红因 |
|---|---|
| FA1/FA2/FA3 | `ok:false`（legacy 污染阻断）≠ 目标 `ok:true`（fast path 跳过整数组提取） |
| FB1/FB2 | 读计数 1026/1023（n=512）≫ 目标 ≤8 且与 n 解耦 |
| FB3 | 越界 delete 读计数 512（n=512）≫ 目标 ≤4（live 长度 O(1)） |
| FC1/FC2 | `DOCRT-E201`（重投影核检出区间外篡改）≠ 目标「省略重投影核、静默通过」 |

## 14. Runner trigger evidence

- Runner：`vitest.config.ts` → `test.include: ['packages/*/test/**/*.test.ts', 'domains/*/test/**/*.test.ts',
  'apps/*/test/**/*.test.ts']`；`test.typecheck.include: ['packages/*/test/**/*.test-d.ts', …]`；
  根脚本 `pnpm test = NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`。
- 发现性实测：聚焦命令只传两个新测试文件路径，vitest 实跑 **2 files / 25 tests**（契约 8 + 负控 17）；
  fixture 文件名为 `...-fixture.ts`（不匹配 `*.test.ts`），仅作共享模块与 tsc 面。
- 无自定义 runner、无环境变量开关、无 `describe.skip`/`it.only`；探针不在 include 面
  （`wiki/raw/**`），仅作可执行证据，不参与门禁。

## 15. Unknowns and blockers

| 项 | 说明 | 处置 |
|---|---|---|
| 无 SA8 工件 | iteration 0；契约**不绑定新公共导出/内部名形**，只锚公共运行时行为 | 设计可自由选择内部接线形态；语义/用例不变 |
| S9 收窄的取舍面 | FC1/FC2 断言的是 ADR 决策 3 明文行为（区间外篡改静默通过）；若设计裁决改为「fast path 也重投影」，FC 需按母法重新裁决 | 属规范边界，非契约缺陷；NB（事实核保留）与 NA（legacy 双核）两侧都已钉死 |
| AC2 的「基准」形态 | ADR 决策 6 为软验收，禁绝对毫秒阈值 | 契约用结构性读计数（机器无关）；毫秒仅探针软证据（G5） |
| 读计数为代理 | 以目标实例 `get`/`toArray`/`forEach` 计真；若未来实现改用第三种整数组出口，代理可能失明 | G2d 已覆盖两种现实出口；且 FA 组（行为）与之成对，接线未落地时不可伪绿 |
| 批量面折迭 | 数组 plan 的 prefix = 操作路径（引理 3：零折迭），但 `BatchItem.verify` 目前要求 `proposedBoundary` | 属 SA3 内部形态改造；FA3/NC5 只锚行为（ok:true + 终态） |
| 实现后根 test 全绿 | 本报告交付时根 test 的失败面 = 契约 8 条（预期） | AC7 为实现期判据 |

## 16. Temporary diagnostics cleanup

- 运行期 hold 目录 `artifacts/sa6-issue436-hold/`（契约文件的暂存副本）已在最终同步后删除；
  交付面只剩 `packages/doc-runtime/test/` 下 3 个文件与 `wiki/raw/` 报告/探针。
- 生产实现**零改动**：`git status` 仅新增测试/夹具/探针/报告/证据日志（无 `packages/*/src`
  变更）；无长驻服务、无后台进程、无 PID 文件、无端口占用、无 nohup/setsid。
- 探针为可复现证据脚本（非临时残留），按 SA6 契约保留；全部日志（baseline/probe/focused/
  stability×5/package-tsc/post gates）留档供实现与复核消费。
- 依赖安装为 offline store 命中（零网络）；未修改 `pnpm-lock.yaml`、tsconfig 或 vitest 配置。

---

## 附：本报告结论一句话

**approve**：HEAD（#435 已合入）的 doc-runtime 数组写**一律**走 legacy 全量边界路径——区间外
污染照旧阻断写、单元素代价 ∝ n（n=512 读计数 1026 vs n=4096 8194；n=10⁵ 单 append 150.7ms，
×89.2/100× 规模）、越界拒绝前先整数组提取、S9 重投影核对所有数组提交（区间外篡改 E201-C）；
ADR 0033 决策 1–4 要求的闸门分流、O(k) 结算与 S9 收窄**零落点**，而 vfsl 侧逐元素接缝已由
#435 交付并就绪。本报告以 8 条红灯运行时契约（闸门/读计数-O(k)/O(1) 越界/S9 收窄）+
17 条恒绿负控（union 永久 legacy、安装事实核、域规则逐字、零写入、commit 字节形态与复制面）+
38 项探针（含 clear+rebuild 反证与批量出口计数反证），把目标行为、兼容面与 fail-closed 闸门
固化为可执行验收契约，供 SA8/SA9 消费。
