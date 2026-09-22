# SA6 诊断与验收契约 — issue #435：vfsl 数组逐元素校验 seam + 一致性 fixture（ADR 0033）

- HEAD：`f6b27da8eadc5cad3bf65c728094767ecb8c601b`（`origin/spec/433-yarray-elementwise-validation` = PR #434 head = 本 worktree；ADR 0033 合入后、#435 未开工）
- 任务类型：**Feature（能力缺口 + 验收契约）**，内含立法执行面（ADR 0033 决策 5 一致性 fixture）。
  本报告**不虚构 Bug 根因**：现行整数组重建 + 整体验证在 phase-1 契约下是正确的；缺口 = ADR 0033
  要求的逐元素公共接缝与触达面收窄**尚不存在**。
- 固定产物：本报告 + `packages/vfsl/test/issue-435-elementwise-array-contract.test.ts`（红灯验收契约）+
  `packages/vfsl/test/issue-435-elementwise-array-control.test.ts`（恒绿负控/回归锚）+
  `packages/vfsl/test/issue-435-elementwise-array-fixture.ts`（参数化 + 确定性随机一致性夹具）+
  `packages/vfsl/test/issue-435-elementwise-array.test-d.ts`（类型面契约）+ 探针
  `wiki/raw/task_issue-435_sa6_capability_probe.mts`；生产实现**零改动**。
- 聚焦执行（runner 真实入口）：
  `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/vfsl/test/issue-435-elementwise-array-contract.test.ts packages/vfsl/test/issue-435-elementwise-array-control.test.ts`
  ⇒ **21 failed（契约，全部 = 能力缺口）/ 17 passed（负控）**（5 轮复跑红灯集合逐轮同 md5）。
- 结论：**approve** —— 能力缺口 5 组可运行证据化；目标行为可达性由夹具侧见证实现（纯公共导出构造）
  132/132 逐字节命中；判据敏感性 6/6；类型契约经干跑验证；验收契约可执行、runner 入口真实。

---

## 1. Task type and inputs

| 输入 | 路径 / 来源 | 说明 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-435.md`（Host 提供，untracked） | issue #435 正文：Parent PR #434、Task Type = feature、What to build + AC1–AC6 |
| issue 原文 | GitHub issue #435（Host 快照） | comments = 空（REST 读回 `[]`）；无 owner 要求 |
| 母法（规范） | `docs/adr/0033-elementwise-yarray-mutation-validation.md`（HEAD `f6b27da` 合入） | 决策 1 fast path 闸门 + 永久双轨；决策 2 O(k) 管线与逐字域规则；决策 3 S9 收窄；决策 4 触达面重定义；决策 5 立法 + 一致性 fixture；决策 6 性能验收（软） |
| 词汇/纪律 | `CONTEXT.md`「重建校验」条目（L144）、trusted-raw-replication 条目（L202） | 数组位例外（ADR-0033）：非 union `T[]` 走逐元素校验；union 数组目标仍整体验证；触达面 = 载体 + 变更区间 |
| 既有接缝 | `packages/vfsl/src/validate-patch.ts`（`planMutationBoundary` L736、`applyMutationAtBoundary` L923、数组支 L980–1008、`validateBoundary` L1012）；`src/index.ts` L122–137 导出块 | 现行「边界尺度重建 + validateSubtree 整体判定」；数组支消费**整数组提取值** |
| 消费方 | `packages/doc-runtime/src/mutation-local.ts` L296–310（S5 整数组 walk → S6 apply） | fast path 的目标消费方（本票只做 vfsl 接缝；doc-runtime 接线不属 #435） |
| 既有测试 | `packages/vfsl/test/validate-patch-mutation-boundary.test.ts` | 现行边界接缝语义锚（本报告 §6/§12 的兼容面基线） |
| 包纪律 | `packages/vfsl/AGENTS.md` | 公共 API 只经 `src/index.ts`；稳定 message/issue 顺序/path 是兼容行为；vfsl 不引入 Yjs 运行时关切 |
| **缺失输入** | `task_issue-435_relevant_decisions.md` / `_conflict_report.md` / `_design.md` / SA8 门 | **不存在**（iteration 0；`ls wiki/raw` 核对）。不影响复现与契约建立：§3 以 ADR 0033 + CONTEXT + 简报 AC 替代 SA8 约束面 |

## 2. Owner comment mapping

**无 owner 要求**：Host 简报明文「Issue comments REST snapshot is empty; no owner requirements apply」；
本次契约全部条目源自简报 AC1–AC6 + ADR 0033 决策 1–5 + CONTEXT 词汇，无外部 owner 追加面。

## 3. SA8 constraints

#435 无 SA8 工件（iteration 0）。可用的规范约束面：

| 来源 | 约束（逐条） |
|---|---|
| ADR 0033 决策 1 | fast path 闸门 = `planMutationBoundary` 产出 kind=`array` **且**边界值节点 kind=`array`；union 数组目标（`A[] \| B[]`）**永久回退** legacy 全量路径（双轨有意保留）；规划层完全不动 |
| ADR 0033 决策 2 | insert：逐新值过 element 子 schema + issue 路径 `[...arrayPath, index+j]`（插入后位置，与现状逐字节一致）；delete：仅越界检查 O(1)；域规则逐字一致（不 clamp、拒越界 no-op、批量 values[]/count 一次判定、空批量 = noop）；零写入纪律不变 |
| ADR 0033 决策 3 | S9 安装事实核保留、fast-path 提交**省略**边界重投影 ⇒ 快路径产物不需要 `proposedBoundary` |
| ADR 0033 决策 4 | 触达面 = 数组载体 + 变更区间；**污染数组的 delete 从响亮拒绝变为照常成功**（与 set 修复哲学对齐） |
| ADR 0033 决策 5 | 「数组合法 ⟺ 逐元素合法」立法：一致性 fixture 在参数化/随机用例下断言逐元素判定与全量 `validateSubtree` 的接受/拒绝及 issue 逐字节一致；未来引入数组级约束必须使该 fixture 红灯 |
| ADR 0033 决策 6 | 性能验收（软）：复杂度 O(n)→O(k)，以基准为证据，不钉绝对毫秒数 |
| 简报 AC1–AC6 | 见 §12.3 映射表；AC5 明文「公开面只经包公共入口导出，public-surface guard 测试覆盖**新导出**」⇒ 新导出是契约面（非改既有签名） |
| `packages/vfsl/AGENTS.md` | 公共面只经 `src/index.ts`；同步/纯函数/不抛错（畸形输入走判别联合）；稳定 message/顺序/path 是兼容行为；vfsl 不引入 Yjs 运行时关切（⇒ 接缝只收载体事实，不收 live 载体） |

## 4. Environment and baseline

- 环境：node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、typescript `5.9.3`、tsx `4.23.12`；
  `pnpm install --offline --frozen-lockfile`（store 命中，520ms，零网络）。
- **pre-contract 基线**（#435 四个新文件移出 include 面后）：`pnpm typecheck` **exit 0**（15 个包 tsconfig）；
  `pnpm test`（vitest run --typecheck）**459 files / 5584 tests 全绿，Type Errors: no errors**（日志
  `artifacts/sa6-issue435-baseline2-{typecheck,test}.log`；另有一份同值首轮基线
  `artifacts/sa6-issue435-baseline-root-*.log`）。
- **post-contract**（文件在位）：`pnpm typecheck` **exit 2**（`&&` 链在 vfsl 包停住；7 条报错全在
  `issue-435-elementwise-array.test-d.ts` = 3× TS2305 缺导出 + 1× TS2349 下游 + 3× TS2578 下游）；
  `pnpm test` **462 files（460 passed / 2 failed = 契约文件 + test-d）、5622 tests（5601 passed / 21 failed）**，
  exit 1；**5601 = pre-contract 5584 + 负控 17**，21 failed = 契约 21，无第 4 方回归。
  日志 `artifacts/sa6-issue435-post-{typecheck,test}.log`。
- 复现率：聚焦对（契约+负控）连续 5 轮结果完全一致（21 red / 17 green；红灯集合 md5
  `bbe91c8b20d1d4a80db4c2edf14761c0` 逐轮相同，日志 `artifacts/sa6-issue435-stability-{1..5}.log`）。
- 时序/规模：夹具零真实时钟、零网络、零并发；用例生成确定性（mulberry32，种子 435），
  132 例/轮；探针 G3 的规模测量只作诊断证据，不进契约断言（无绝对毫秒阈值）。

## 5. Positive reproduction（能力缺口，逐条可运行）

探针：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-435_sa6_capability_probe.mts`
⇒ exit 0（全部 GAP/ORACLE/NC/DRY 命中；完整输出 `artifacts/sa6-issue435-probe.log`）。

### 5.1 G1 公共面无数组逐元素接缝（导出普查，运行时反射）

- `Object.keys(@nomicore/vfsl)` = **22 个运行时导出**：`FileSchemaSource, SchemaSourceError,
  applyMutationAtBoundary, assertVfslDialect, compilePattern, compileSchemaEnvelope,
  deriveSchemaIdentity, evaluate, getCompiled, getCompiledWith, isSchemaTruncationMarker,
  matchPattern, parseSchemaEnvelope, parseVfsl, planMutationBoundary, renderProjectionText,
  resolveSchemaAtPath, validateAppendToArray, validateDeleteFromArray, validateInsertIntoArray,
  validateLogicalSnapshot, validatePatch`；
- `/elementwise|element_wise/i` 零命中；`applyElementwiseArrayMutation` `typeof === 'undefined'`。

### 5.2 G2 现行边界接缝必须消费「整数组提取值」

以载体事实 `{length: 3}` 代替 `boundaryBase` 调用现行 `applyMutationAtBoundary`：

| 调用 | 实测结果 |
|---|---|
| `applyMutationAtBoundary(derived, plan(items), {length:3}, {op:'array-insert', index:0, values:[1]})` | `ok:false`，issue = `array-insert 目标必须是数组`，path `["items"]` |
| 同上 `array-delete` | `ok:false`，issue = `array-delete 目标必须是数组` |
| `tags` / `nums` | 逐字同型（3/3 路径实测） |

⟹ 现行接缝无法从「元素子 schema + 载体长度 + 新值」工作；调用方必须先做整数组提取（doc-runtime S5 walk）。

### 5.3 G3 成本与数组长度耦合（软证据，ADR 0033 决策 6 面）

`nums: YArray<number>` 单元素 append：n=10³ **1.365 ms**；n=10⁵ **116.675 ms**（100× 规模 → **×85.5**；
多轮区间 1.4–1.8 ms / 114–178 ms、×83–97）。（仅诊断证据；本票契约不含基准断言。）

### 5.4 G4 现状语义快照（逐字节，作为兼容面与 oracle）

| 场景 | 实测（legacy `applyMutationAtBoundary`） |
|---|---|
| insert 非法新值（index=1，j=1） | `{"ok":false,"issues":[{"message":"类型不匹配：期望 number，实际 string","path":["items",1,"qty"]}]}` |
| insert index>len | `{"ok":false,"issues":[{"message":"array-insert index 越界（不 clamp）","path":["items",3]}]}` |
| 批量两处非法 | issue 两条，序 = 插入后位置升序：`[["items",1,"qty"],["items",3,"qty"]]` |
| delete 范围越界 | `{"ok":false,"issues":[{"message":"array-delete 范围越界（不 clamp、不接受越界 no-op）","path":["items",1]}]}` |
| 污染数组 delete（变更区间外非法） | `ok:false`（issue 指向残留数组中非法元素 `["items",0,"qty"]`）——ADR 0033 决策 4 将改写的现状 |

### 5.5 G5 规划闸门实测（决策 1 两条件）

| 目标 | plan.kind | plan.node.kind | 结论 |
|---|---|---|---|
| `items/tags/nums/variants/scalars/nested.inner`（6 条非 union 数组路径） | `array` | `array`（`node.element` 在场；`relPath=[]`） | fast path 候选 |
| `uarr: YArray<Item> \| YArray<string>`（union 数组目标） | `array`（**非** `union`！） | **`union`** | 闸门**第二条件**排除 → 永久 legacy；legacy 轨对该 plan 照常 `ok:true` |
| `xs: YPlainArray<string>` | — | — | array-* 规划拒绝（message 含 `YPlainArray`，纯值终态只能整体替换） |
| `items` 的 `set` 目标位计划 | `target` | `array` | 非闸门计划（§12 F3 负例） |

**关键发现（设计约束）**：union 数组目标的判别**不在 `plan.kind`**（其值仍为 `array`），而在
`plan.node.kind === 'union'`。只按 `plan.kind` 接管的实现会在 `plan.node.element` 处失守——
契约 F2 因此把「节点 kind=union ⇒ 新接缝不得静默接受」钉成红灯断言。

### 5.6 缺口 × AC × 红灯落点

| AC | 现状（HEAD） | 红灯落点 |
|---|---|---|
| AC1 insert 逐元素 + `[...arrayPath, index+j]` + 与全量逐字节一致 | 无接缝；全量路径需整数组 | 契约 B2/B3/B5/B7/E1 |
| AC2 delete 仅域规则、不触碰元素值 | 无接缝；legacy delete 整数组校验 | 契约 D1–D5 |
| AC3 域规则逐字对齐（不 clamp / 批量一次判定 / 中间态不参与） | legacy 域规则正确但被绑在整数组路径 | 契约 C1/C2 + D2/D3 + 负控 NC1/NC2 |
| AC4 一致性 fixture（随机/参数化，逐元素 vs 全量逐字节） | 无逐元素侧可比 | 契约 E1/E2（夹具 132 例） |
| AC5 公共面导出 + public-surface guard | 无新导出 | 契约 A1/A2 + 类型契约 test-d |
| AC6 包测试 + 根 typecheck/test 绿 | pre-contract 绿（§4）；实现后须复绿 | §13 记录当前红面 |

## 6. Negative control（恒绿；排除环境/夹具/oracle/入口伪红）

`packages/vfsl/test/issue-435-elementwise-array-control.test.ts` — **17/17 passed**（HEAD 实测，
`artifacts/sa6-issue435-control-green.log`），实现落地后须保持绿：

| 组 | 锚定内容 |
|---|---|
| NC1 | legacy 数组写语义冻结：insert 非法元素 rebase 路径、`index === length` 接受 / `> length` 拒绝（message 逐字）、批量两处非法 issue 序、delete 段合法/`index>=length`/`index+count>length` 拒绝（message 逐字）；界内 `count=0` 现状快照（明确不进目标契约——doc-runtime E3 只发严格正整数 count） |
| NC2 | 现状触达面：污染数组 delete 被 legacy 响亮拒绝（决策 4 对照基线）；污染组 6/6 用例 legacy 恒拒绝 |
| NC3 | 规划闸门冻结：6 条路径 `kind=array ∧ node.kind=array ∧ node.element`；union 数组目标 `node.kind=union`；YPlainArray 拒绝；set 目标位 `kind=target, node.kind=array` |
| NC4 | 立法前提（决策 5 绿侧）：长数组（300 元素）/重复/无序照常 `{ok:true}`；元素级非法仍响亮拒绝（路径 `["nums",2]`）——锚非空转；若有人向解释器引入数组级约束，NC4 与契约 E1 同时红灯 |
| NC5 | 夹具 oracle 自洽：等价集 132 例 legacy 判决与登记期望全数一致；两支/两操作/6 路径 census；基线数组整体合法（空批量恒等判定） |
| NC6 | 既有公共导出超集锚（7 个本票触及导出不得改名/删除） |

## 7. Stability, scale and timing

- 复跑稳定性：契约+负控 5 轮（`artifacts/sa6-issue435-stability-{1..5}.log`）——每轮 **21 red / 17 green**，
  红灯集合（测试全名排序）md5 逐轮相同；红因逐条 = 能力缺口（21 条失败中 1 条 A1 断言文案 + 20 条
  `seam()` loud 抛「能力缺口」，无任何其它 AssertionError/TypeError）。
- 夹具确定性：mulberry32(435) 冻结；132 例 = 72 参数化边界例（6 路径 × 12）+ 60 随机例；
  op 覆盖 `array-insert`/`array-delete`，接受 54 / 拒绝 78；同输入恒同用例集（探针与契约共用夹具模块）。
- 规模/时序条件：全部断言为纯函数调用，零真实时钟/零网络/零并发；单轮聚焦 < 1s。
- 规模证据（软，非断言）：探针 G3 见 §5.3。

## 8. Capability gap chain（Feature：证明能力缺失，不虚构 Bug 根因）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 症状（能力面） | AC1–AC5 要求的「数组逐元素校验公共接缝 + 一致性 fixture + 公开导出」在包内零落点 | 导出普查 22/22（G1）；`/elementwise/i` 零命中 | 高（运行时反射） |
| 2 直接缺口点 | 唯一可用的数组写判定入口 `applyMutationAtBoundary` 是**边界值驱动**：数组支先 `relNavigate(boundaryBase,…)`、要求 `Array.isArray(target.value)`，随后整数组 splice 重建 + `validateSubtree(plan.node, proposed)` | `validate-patch.ts` L980–1008、L1012；G2 实测（载体事实代 boundaryBase → 目标必须是数组） | 高（源码 + 运行实测） |
| 3 调用方义务 | doc-runtime `prepareLocalMutation` kind=`array` 分支必须先 `walk(boundaryNode, boundaryLive)` 整数组提取（S5），再 S6 apply | `mutation-local.ts` L296–310 | 高（源码） |
| 4 触发条件 | 任一非 union `YArray` 目标的 `array-insert`/`array-delete` 写（含大数组 append/delete） | G3 规模曲线；ADR 0033 背景（4 次全数组遍历） | 高 |
| 5 最深根因（能力） | vfsl 公共面缺少「以 element 子 schema + 载体长度 O(1) 事实 + 新值/区间」结算判定的接缝；**判定语义本身正确**，缺的是把整数组验证替换为逐元素验证的公共表达 | §5 全组 + ADR 0033 决策 2/3 | 高 |
| 6 放大因素 | 成本与 n 解耦失败（重建 + 遍历 + 重投影），往 10⁵ 元素数组 append 单元素付出全数组代价 | G3（×83–97 / 100× 规模） | 中（软证据，机器相关） |
| 7 行为面缺口 | 决策 4 的触达面收窄（污染数组 delete 照常成功）与决策 5 的立法执行（一致性 fixture）都无载体 | G4 污染 delete 拒绝；G1 无 fixture 面 | 高 |
| 8 未证实假设 | 无。**明确不主张**：现行整数组验证有缺陷、issue 路径有误、域规则有偏差——负控 NC1/NC2 证明这些在现行契约下正确且必须保持 | 负控 17/17 绿 | 高 |
| 9 排除项 | 非环境问题（pre-contract 全绿）、非 runner 发现面问题（§14）、非 union 数组目标误判（G5.2）、非 plain 数组（G5.3）、非数组级约束语义（ADR 禁） | §4/§6/§11 | 高 |

## 9. Causal experiments（最小因果实验）

| # | 实验 | 控制变量 | 结果 | 结论 |
|---|---|---|---|---|
| E1 | 以载体事实 `{length}` 代 `boundaryBase` 调 legacy | 同 plan、同 payload，只换 base 形态 | 3/3 路径 `ok:false` + 「目标必须是数组」 | legacy 的输入契约 = 整数组值（缺口机制确认） |
| E2 | union 数组目标的 plan 形状 | 与 6 条普通数组路径对比 | `plan.kind='array'` 但 `node.kind='union'`；legacy 照常 `ok:true` | 闸门判别必须用 `node.kind`（设计约束，F2 红灯钉死） |
| E3 | 见证实现（纯公共导出：逐元素合成 `kind:'target'` 计划 + `applyMutationAtBoundary` 单值校验 + 域规则镜像） vs 全量 oracle | 同一 132 例等价集 | **132/132 逐字节一致**（54 接受 / 78 拒绝） | 目标语义可达（等价 fixture 可满足），SPEC 无自相矛盾 |
| E4 | 夹具期望自洽 | 132 例登记 `expectTarget` vs 真实语义 | 132/132 命中 | 夹具不空转/不自欺 |
| E5 | 判据敏感性 | 污染基线（区间外非法）同 op 同 length | oracle 拒绝 vs 逐元素成功，**6/6 逐字节可分**；合法/非法 insert 判据字节可分 | E3 的比较面能看见真实差异（非恒真） |
| E6 | 立法前提 | 300 元素/重复/无序数组 | `{ok:true}`；元素级非法仍 `["nums",2]` | VFSL v1 数组层确无数组级约束（决策 5 前提成立） |
| E7 | 类型契约干跑 | 临时 scratch 声明绑定签名并复算 test-d 全部断言 | scratch **零 TS 报错**（含 3 条 `@ts-expect-error` 命中） | test-d 的期望/负面夹具形状正确；当前 TS 红全部由缺导出派生（`artifacts/sa6-issue435-type-dryrun.log`） |

## 10. Impact surface

- **公共面（新增，additive）**：1 个运行时导出 + 2 个类型导出（§12.1 绑定表）；既有 22 个导出逐字节不变
  （负控 NC1–NC4、NC6）。
- **语义面**：数组 insert 判定从「整数组重建 + 整体验证」变为「逐新值过 element 子 schema」；
  delete 从「整数组重建 + 整体验证」变为「仅域规则」。接受/拒绝结论与 issue 内容在**合法基线**上
  逐字节不变（E3）；例外 = 决策 4 有意变更（污染数组 delete 转成功）。
- **消费方（不在本票实现）**：doc-runtime kind=`array` 分支的 S5 省略 / S6 换接缝 / S9 省略重投影；
  本票契约不约束其接线，但接缝形状按该消费面最小化（只收 `{length}`、返回 `ValidateResult`）。
- **兼容风险**：issue 路径/顺序/域 message 是兼容行为（AGENTS.md），契约以 legacy oracle 逐字节比较 +
  显式常量双重锚定；未来若有人引入数组级约束，E1/E2/NC4 共同红灯（决策 5 enforcement）。
- **不受影响**：union 数组目标（永久 legacy）、YPlainArray 整体替换、set/delete/Record/union 边界路径、
  `validateAppendToArray`/`validateInsertIntoArray`/`validateDeleteFromArray` 路径级旧接缝。

## 11. Ruled-out hypotheses

| 假设 | 排除证据 |
|---|---|
| 「现行数组校验有 Bug」 | 负控 NC1/NC2 + pre-contract 全绿：现行语义按 phase-1 契约正确；本票是能力缺口非缺陷 |
| 「红是环境/依赖/夹具问题」 | pre-contract `pnpm typecheck` exit 0、`pnpm test` 459 files/5584 tests 全绿；探针 GAP 与契约红逐条归因缺导出 |
| 「红是 runner 入口/发现面问题」 | §14：`vitest.config.ts` include 面实测发现 2 个新测试文件（21+17 tests） |
| 「union 数组目标由 `plan.kind` 区分」 | G5.2 实测 `plan.kind='array'`、`node.kind='union'`；判别在第二条件 |
| 「delete 仍需元素值即可发现污染」 | 决策 4 明文收窄触达面；契约 D4/D5 把「不消费元素值」钉成目标行为（与 legacy 现状分道） |
| 「本票实现 doc-runtime 改道」 | 简报 What to build 只要求 vfsl 接缝 + fixture + 导出；消费方接线属后续票 |
| 「一致性 fixture 可用源码字符串/快照取证」 | 契约纪律：只经公共入口运行时行为比较（JSON 逐字节），无源码 grep |
| 「性能必须钉毫秒阈值」 | ADR 决策 6 为软验收；本契约不含基准断言（避免机器相关伪红）；规模证据留诊断面 |

## 12. Acceptance contract and test paths

### 12.1 绑定点（B-1…B-5；冻结后若 SA8 裁决改名/换形，只动契约测试 `SEAM_EXPORT`/`SeamFn` 绑定块
与 test-d 的 import + 类型断言，**语义与用例不变**）

| ID | 绑定项 | 冻结值 |
|---|---|---|
| B-1 | 运行时导出名（包公共入口 `src/index.ts`，`packages/vfsl` exports `.`） | `applyElementwiseArrayMutation` |
| B-2 | 调用形状 | `(derived: DerivedSchema, plan: MutationBoundaryPlan, facts: ArrayCarrierFacts, payload: ElementwiseArrayMutationPayload)` |
| B-3 | 载体域事实类型 | `ArrayCarrierFacts = { readonly length: number }`（O(1)；不含元素值） |
| B-4 | 载荷词表 | `ElementwiseArrayMutationPayload = { op:'array-insert'; index:number; values: readonly unknown[] } \| { op:'array-delete'; index:number; count:number }`（字段与 `BoundaryMutationPayload` 同名支逐字一致） |
| B-5 | 返回类型 | `ValidateResult`（`{ok:true} \| {ok:false; issues: ValidateIssue[]}`；**无** `proposedBoundary`——决策 3） |
| B-6 | 闸门前置（调用方职责，接缝 fail closed） | `plan.kind === 'array'` ∧ `plan.node.kind === 'array'`；否则返回 `ok:false`（不得静默接受） |

### 12.2 目标行为期望（实现后必须绿）

1. insert 逐新值过 `plan.node.element`；非法值整批 `ok:false`，issue 路径 `[...plan.prefix, index+j, ...elementIssuePath]`，
   顺序 = 插入后位置升序；与 legacy 全量路径逐字节一致（合法基线）。
2. insert 域规则：`index ∈ [0, length]` 接受（含 `index === length` append）；`index > length` 拒绝，
   message 逐字 `array-insert index 越界（不 clamp）`、path `[...arrayPath, index]`；空批量 = 恒等 accept。
3. delete 域规则：`index < length ∧ index + count ≤ length` 接受；否则拒绝，message 逐字
   `array-delete 范围越界（不 clamp、不接受越界 no-op）`、path `[...arrayPath, index]`；不消费任何元素值。
4. 决策 4：污染数组（变更区间外非法元素）delete → `ok:true`（与 legacy 现状分道，D4/D5/E2 锚定）。
5. 决策 5：132 例等价 fixture 逐字节一致（E1）；比较判据在污染 delete 上可分（E2）。
6. fail closed：`node.kind='union'`（union 数组目标）或非 `array` 计划 ⇒ `ok:false`，legacy 轨不受影响（F1–F3）。

### 12.3 测试路径与 AC 映射

| 产物 | 路径 | 角色 | HEAD 红/绿 |
|---|---|---|---|
| 红契约（运行时） | `packages/vfsl/test/issue-435-elementwise-array-contract.test.ts` | AC1–AC5 目标行为 + 闸门 fail closed（21 tests） | **21 red**（能力缺口） |
| 类型契约 | `packages/vfsl/test/issue-435-elementwise-array.test-d.ts` | B-1…B-5 签名 + 3 条负面夹具（fail closed） | **TS 红**（TS2305 + 下游） |
| 负控/回归锚 | `packages/vfsl/test/issue-435-elementwise-array-control.test.ts` | NC1–NC6（17 tests） | **17 green**（恒绿） |
| 一致性夹具 | `packages/vfsl/test/issue-435-elementwise-array-fixture.ts` | 132 例（参数化 72 + 随机 60）+ 全量 oracle + 判决规整 + 污染组 | 供两侧消费 |
| 探针（证据） | `wiki/raw/task_issue-435_sa6_capability_probe.mts` | GAP G1–G5 / ORACLE O1–O3 / NC / DRY 13 项 | exit 0（全命中） |

| AC | 契约组 |
|---|---|
| AC1 insert 逐元素 + 路径 + 逐字节一致 | A2, B1–B7, C1–C2, E1 |
| AC2 delete 仅域规则、不触碰元素值 | D1–D5 |
| AC3 域规则逐字对齐（不 clamp / 批量一次 / 中间态不参与） | C1–C2, D2–D3, B3–B4, NC1 |
| AC4 一致性 fixture（随机/参数化逐字节） | E1–E2, NC5 |
| AC5 公开面导出 + public-surface guard | A1–A2, test-d, NC6 |
| AC6 包测试 + 根 typecheck/test 绿 | §13（实现后期望值） |

### 12.4 契约纪律

- 零 skip/only/todo、零 env override、零 fallback、零吞错、零软化断言；
- 运行时契约顶层**不静态 import 新名目**（动态命名空间读取 + 单点绑定），每条测试首语句取接缝，
  红因恒为能力缺口（loud throw，非裸 TypeError）；
- 期望值来源二选一：legacy oracle 逐字节比较，或 ADR/现行实现冻结常量（域 message、rebase 路径）；
- 断言只观察运行时行为（结果联合、issue message/path/顺序、公共命名空间键），不 grep 生产源码；
- union 数组目标与 plain 数组为**非目标**（永久 legacy / 不可下钻），契约不主张其改道。

## 13. Red/green or baseline evidence

| 证据 | 命令 / 文件 | 结果 |
|---|---|---|
| pre-contract 基线（文件移出 include 面） | `pnpm typecheck`；`pnpm test`（`artifacts/sa6-issue435-baseline2-*.log`） | typecheck **exit 0**；test **459 files / 5584 passed / Type Errors: no errors** |
| 探针（缺口 + 目标可达 + 敏感性） | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-435_sa6_capability_probe.mts`（`artifacts/sa6-issue435-probe.log`） | **exit 0**；GAP 5 组、ORACLE O1–O3、NC、DRY 13 项全 PASS，`failures=0` |
| 红契约（聚焦） | `npx vitest run packages/vfsl/test/issue-435-elementwise-array-contract.test.ts`（`artifacts/sa6-issue435-contract-red.log`） | **21 failed / 21**，exit 1；逐条红因 = 能力缺口 |
| 负控（聚焦） | `npx vitest run packages/vfsl/test/issue-435-elementwise-array-control.test.ts`（`artifacts/sa6-issue435-control-green.log`） | **17 passed / 17**，exit 0 |
| 复跑稳定性 | 5 轮（`artifacts/sa6-issue435-stability-{1..5}.log`） | 每轮 21 red / 17 green；红灯集合 md5 逐轮相同 |
| 包 typecheck | `npx tsc -p packages/vfsl/tsconfig.json`（`artifacts/sa6-issue435-package-tsc.log`） | exit 2，7 条报错全在 test-d（3× TS2305 + 1× TS2349 下游 + 3× TS2578 下游） |
| 类型干跑（临时 scratch，已删除） | `artifacts/sa6-issue435-type-dryrun.log` | 同断言在正确签名下 **零报错** ⇒ test-d 期望正确 |
| post-contract 根 typecheck | `pnpm typecheck`（`artifacts/sa6-issue435-post-typecheck.log`） | **exit 2**；7 条报错全在 test-d（缺导出 + 下游），vfsl 包后续 14 个 tsconfig 因 `&&` 短路未执行（pre-contract 已各 exit 0，且生产零改动） |
| post-contract 根 test | `pnpm test`（`artifacts/sa6-issue435-post-test.log`） | **462 files / 5622 tests：460 files & 5601 tests passed、2 files & 21 tests failed**；失败面恰 = 契约 21 条 + test-d 7 条类型报错；**5601 = 基线 5584 + 负控 17**，其余零回归 |
| 最终聚焦复跑（收尾态） | `artifacts/sa6-issue435-focused.log` | 21 failed（契约）/ 17 passed（负控） |

**实现后的绿色判据**：契约 21/21 绿、类型契约 TS 干净、负控 17/17 保持绿、探针 exit 0 不变、
包测试与根 `pnpm typecheck`/`pnpm test` 复绿（AC6）。

## 14. Runner trigger evidence

- Runner：`vitest.config.ts` → `test.include: ['packages/*/test/**/*.test.ts', 'domains/*/test/**/*.test.ts',
  'apps/*/test/**/*.test.ts']`；`test.typecheck.include: ['packages/*/test/**/*.test-d.ts', …]`；
  根脚本 `pnpm test = NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`。
- 发现性实测：聚焦命令只传两个新文件路径，vitest 实际执行 **2 files / 38 tests**（契约 21 + 负控 17）；
  类型面经 `--typecheck` 阶段消费 `issue-435-elementwise-array.test-d.ts`（报错路径可证）。
- 无自定义 runner、无环境变量开关、无 `describe.skip`/`it.only`；探针不在 include 面（`wiki/raw/**`），
  仅作可执行证据，不参与门禁。

## 15. Unknowns and blockers

| 项 | 说明 | 处置 |
|---|---|---|
| 无 SA8 工件 | iteration 0；绑定名/形（B-1…B-5）由 SA6 冻结，语义取自 ADR 0033 | 若 SA8/SA9 裁决不同名或不同 facts 形状，只需同步绑定块 + test-d + 本表；**语义、断言、fixture 不变** |
| 单接缝 vs 双接缝 | 契约冻结单函数（两 op 载荷判别）；若设计拆成 insert/delete 两个导出 | 视为等价实现，需同步绑定块（用例可原样映射） |
| 成功支额外键 | 契约不约束 `ok:true` 支是否携带额外键（如 proposedBoundary）；决策 3 使 fast path 无需重投影 | 不构成破坏；契约只断言 `{ok:true}` 等值 |
| 畸形 index/count | doc-runtime E3 已保证严格非负整数 index、严格正整数 count；`count=0`/负下标不在目标契约（legacy 现状仅负控快照） | 等价 fixture 只覆盖真实调用域；如需扩展另立契约 |
| 性能断言 | ADR 决策 6 为软验收，本契约不含阈值 | 规模证据在探针 G3；若需基准，另票设计（避免机器相关伪红） |
| doc-runtime 接线 | #435 只交付 vfsl 接缝 + fixture + 导出 | 消费方 S5/S6/S9 改道由后续票承接（ADR 0033 决策 3） |

## 16. Temporary diagnostics cleanup

- 临时类型干跑文件 `packages/vfsl/test/__sa6-scratch-type-dryrun.ts` 已删除（`rm` 实测；
  `ls packages/vfsl/test | grep -c '^issue-435'` = 4，仅交付件）；证据保留在
  `artifacts/sa6-issue435-type-dryrun.log`。
- 门禁脚本 `artifacts/sa6-issue435-run-gates.sh` 以 `trap restore EXIT` 保证契约文件归位；
  运行期 hold 目录 `artifacts/sa6-issue435-hold/` 已确认清空并 `rmdir` 删除；契约文件归位后
  最终聚焦复跑仍为 21 red / 17 green（§13）。
- 生产实现零改动：`git status` 仅新增测试/fixture/探针/报告/证据日志（无 `packages/*/src` 变更）；
  无长驻服务、无后台进程、无 PID 文件、无端口占用。
- 探针为可复现证据脚本（非临时残留），按 SA6 契约保留；日志与干跑脚本一并留档供实现/复核消费。

---

## 附：本报告结论一句话

**approve**：vfsl 公共面**没有**「以 element 子 schema + 载体长度事实 + 新值/区间结算」的数组逐元素校验接缝
（22 导出普查零命中；现行唯一数组判定入口必须消费整数组提取值，n 成本 ×83–97/100× 规模），ADR 0033 要求的
fast-path 闸门（`plan.kind='array'` ∧ `node.kind='array'`，union 数组目标永久 legacy）、逐字域规则、
决策 4 触达面收窄与决策 5 一致性立法均无载体；本报告以 21 条红灯运行时契约 + 类型契约 + 132 例确定性
等价 fixture（见证实现 132/132 逐字节命中、污染对照 6/6 可分）+ 17 条恒绿负控，把目标行为、兼容面与
fail-closed 闸门固化为可执行验收契约，供 SA8/SA9 消费。
