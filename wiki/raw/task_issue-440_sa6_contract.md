# SA6 诊断与验收契约 — issue #440：vfsl 逐 entry 校验扩展（Record + 封闭对象 delete）与一致性 fixture 扩展（ADR 0034）

状态：**approve**（能力缺口可运行证据化；契约 26 条红/负控 19 条绿、红灯集合 5 轮 md5 恒同；
见证实现注入公共面后契约 **26/26 全绿**（干跑），4 个错误实现变异 → 4/5/10/4 红（断言敏感）；
一致性夹具 107 等价例 + 10 触达面例；探针 27/27 命中、exit 0；
基线 466 files / 5667 tests 全绿 + 根 typecheck exit 0，post-contract 唯一红面 = 本票契约 + test-d；
生产实现零改动）
HEAD：`0a91f1429c3818320eaacdf2a33d2a267d79620e`（worktree `mabf/issue-440`；含 ADR 0034 文档提交）
基线（旧实现 = HEAD 清理产物后）：detached worktree `.worktrees/issue-440-baseline` @ `0a91f14`
写面：只新增测试/fixture/探针/本报告——**生产实现零改动**（`git diff` 空，见 §16）

---

## 1. Task type and inputs

- **任务类型**：feature（能力缺口 = 逐 entry 判定接缝缺 Record / 封闭对象 delete 两形态；
  **不虚构 Bug 根因**）。现行「边界尺度全量重建 + `validateSubtree` 整体判定」在 phase-1 契约下
  是正确的；缺口 = ADR 0034 决策 1/2/4/5 要求的公共接缝、立法 fixture 与公开导出**尚不存在**。
- 输入（固定位置读取）：
  - `wiki/raw/task_issue-440.md`（Host 简报：Parent PR #438、Task Type = feature、
    What to build + AC1–AC6 + Blocked by #437）；
  - **无 SA8 工件**（`task_issue-440_design.md` / `_relevant_decisions.md` / `_conflict_report.md`
    均不存在——iteration 0；`ls wiki/raw | grep 440` 仅命中 `task_issue-440.md`）；
  - 无既有 SA6 报告、无既有 #440 测试（固定报告 `wiki/raw/task_issue-440_sa6_contract.md`
    本文件为首次落位）；
  - 母法（规范）：`docs/adr/0034-record-and-parent-elementwise-validation.md`（HEAD 合入）、
    `docs/adr/0033-elementwise-yarray-mutation-validation.md`（同族先例）、
    `CONTEXT.md`「重建校验」L144 /「复制未校验」L202（两阶段触达面收窄条款）；
  - 兄弟 ticket（GitHub REST 实读）：#439（本阶段 spec，含 Implementation/Testing Decisions）、
    #441（doc-runtime 接线，Blocked by #440）、#442（lease 端到端，Blocked by #441）；
  - 既有接缝与先例：#435 vfsl 数组逐元素接缝（`applyElementwiseArrayMutation`）、
    `packages/vfsl/src/validate-patch.ts`（`planMutationBoundary` / `applyMutationAtBoundary`）、
    `wiki/raw/task_issue-435_sa6_contract.md`、`wiki/raw/task_issue-437_sa6_contract.md`；
  - 包纪律：`packages/vfsl/AGENTS.md`（公共 API 只经 `src/index.ts`；稳定 message/issue 顺序/path
    是兼容行为；不引入 Yjs 运行时关切）、根 `AGENTS.md`（测试纪律）。

## 2. Owner comment mapping

- `gh issue view 440 --repo nomicore-ai/nomicore --json comments` → **`[]`**（REST 实读，与简报
  「Current REST Issue comments are empty; no owner feedback applies」一致）——**无 owner 需求面**。
- 需求面 = 简报 AC1–AC6 + ADR 0034 决策 1–5。逐条映射见 §12.4。
- 兄弟 ticket 语义澄清（非 owner 追加需求，用于消歧，均已在本契约显式定案）：
  1. #439 Testing Decisions 的「测试 seam（全部既有，不新增）」指**测试观察面**（lease /
     doc-runtime / vfsl validate-patch 层），非「不得新增 vfsl 公共导出」；AC5
     「public-surface guard 覆盖新导出」明文要求新增导出，两处不矛盾（§12.1 B-1）。
  2. 「封闭对象 delete 静态规则」的未声明键分支：`planMutationBoundary` 在**结构面**即拒
     （`路径不存在：未知字段 "..."（封闭对象不接受未声明键）`，探针 G3.4）⇒ 该分支**不可能到达
     接缝**，不进契约用例面（§15 残差 4）。
  3. 「触达面收窄」的端到端用户可见行为钉正归 #442（lease 端到端）；#441 归 doc-runtime 接线；
     本票在 vfsl 接缝以**输入面**（只收 `{has}` 事实）+ 一致性 fixture 表达（§10/§12）。

## 3. SA8 constraints

#440 无 SA8 工件（iteration 0 确认）。替代规范约束面（逐条落实位置）：

| 约束源 | 内容 | 落实位置 |
|---|---|---|
| 任务简报 / AC1 | Record set：键 Pattern 违规、新值非法写入前拒绝；issue 路径 `[...mapPath, key]` 与全量路径逐字节一致 | 契约 B1–B5、B7 + 夹具等价集（26 参数例 + 随机例） |
| 任务简报 / AC2 | Record delete：仅在场/no-op 域规则，不触碰其他 entry | 契约 C1–C5；D5 的 record 对偶（同事实不同基线同判决） |
| 任务简报 / AC3 | 封闭对象 delete 静态规则全矩阵：必填（拒）/ optional（允）/ `unknown` 标量必填（允，缺席视同接受语义保留）/ no-op（拒） | 契约 D1–D6 + 夹具 PARENT_PATH_SPECS 矩阵（obj / panel.node 双路径） |
| 任务简报 / AC4 | 一致性 fixture 覆盖 Record + parent 两形态，与全量整体验证逐字节一致 | 夹具 `buildEquivalenceCases()`（107 例）+ 契约 E1/E2/E3 |
| 任务简报 / AC5 | 公开面只经包公共入口导出；public-surface guard 覆盖新导出 | 契约 A1/A2 + 类型契约 `.test-d.ts` + 负控 NC5（23 既有导出超集锚） |
| 任务简报 / AC6 | 包测试 + 根 `pnpm typecheck` 与 `pnpm test` 绿 | §13（实现后判据；当前红面与环境基线逐条记录） |
| ADR 0034 决策 1 | 闸门：map 位非 union Record 形态；union map 位永久 legacy；Record 值位 union 不影响 fast path；旧值不读 | 契约 F1/F2/F3（闸门与 fail closed）+ B5/B6（值位 union、旧值不读） |
| ADR 0034 决策 2 | 封闭对象 delete 静态必填判定：必填 ∧ 非 `unknown` 标量 → 拒；optional ∨ `unknown` → 允；`has(key)` 拒 no-op；不读父值 | 契约 D1–D6 |
| ADR 0034 决策 3 | S9：fast-path 提交省略边界重投影（接缝返回 `ValidateResult` 直出，无 `proposedBoundary`） | 类型契约 B-4 面 + 契约 A2（无 `result` 包装）；S9 安装/重投影核归 #441 |
| ADR 0034 决策 4 | 触达面 = map/父载体 + 目标键位；污染容器写由连带拒绝变目标键合法即成功 | 夹具触达面组（10 例）+ 契约 E2/E3 + 探针 O3/NC1（#442 承担端到端钉正） |
| ADR 0034 决策 5 | 「容器合法性 ⟺ 逐 entry 合法」立法；禁止 map 级约束特判；enforcement = 一致性 fixture | 夹具等价集（107 例，逐字节比较）+ 负控 NC4/NC6 |
| ADR 0034 决策 6 / 后果 | 基准（10⁵ entry 单键写与 n 解耦）与 S9/E201/charge 面 | 归 #441/#442（本票只钉语义面 + 结构面：接缝输入仅 `{has}`，不携带其他 entry/父值） |
| `packages/vfsl/AGENTS.md` | 公共面只经 `src/index.ts`；同步/纯函数/不抛错（畸形输入走判别联合）；稳定 message/顺序/path 是兼容行为；不引入 Yjs 关切 | 契约 A2（纯函数、无包装）+ F3（载荷/计划违约 fail closed 不抛）+ 全组 oracle 逐字节比较 |
| 根 `AGENTS.md` / 测试纪律 | 零 skip/only/todo、零 env override、零 fallback、零源码字符串断言、真实入口发现 | §12.5 + §14 |

## 4. Environment and baseline

| 项 | 值/命令 | 证据 |
|---|---|---|
| 运行时 | node `v24.13.0`、pnpm `10.28.2` | 本会话 `node -v` / `pnpm -v` |
| 测试器 | vitest `3.2.7`、typescript `5.9.3`、tsx `4.23.12` | `pnpm exec vitest --version` / `tsc --version` / `tsx --version` |
| 依赖 | `pnpm install --offline --frozen-lockfile` → exit 0（store 命中，零网络） | `artifacts/sa6-issue440-install.log`（`INSTALL_EXIT:0`） |
| pre-contract 根 typecheck | `pnpm typecheck`（15 包 `&&` 链）→ **exit 0** | `artifacts/sa6-issue440-baseline-typecheck.log`（`BASELINE_TYPECHECK_EXIT:0`） |
| pre-contract 根 test | `pnpm test` → ****466 files / 5667 tests 全绿**** | `artifacts/sa6-issue440-baseline-root-test.log`（`BASELINE_TEST_EXIT:0`） |
| 基线选择依据 | 本票为**纯加法**（新增测试 + 文档），基线 = **同一 HEAD 去掉本票新增文件**；detached worktree `.worktrees/issue-440-baseline` @ `0a91f14`（`git worktree add --detach`；证据采集后移除） | `artifacts/sa6-issue440-baseline-setup.log` |
| 服务/网络 | 零（纯函数调用；无网络、无长驻进程、无真实时钟） | §7 |

> 说明：ADR 0034 是**文档提交**（HEAD `0a91f14`），不改变任何运行时行为；因此「旧实现」=
> 同一 HEAD 的实现代码，能力缺口是**接缝缺席**而非行为回归（§8）。

## 5. Positive reproduction（能力缺口，逐条可运行）

探针：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-440_sa6_capability_probe.mts`
⇒ **exit 0**（27/27 命中；完整输出 `artifacts/sa6-issue440-probe.log`）。

### 5.1 G1 公共面无 Record/parent 逐 entry 接缝（导出普查，运行时反射）

- `Object.keys(@nomicore/vfsl)` = **23 个运行时导出**：`FileSchemaSource, SchemaSourceError,
  applyElementwiseArrayMutation, applyMutationAtBoundary, assertVfslDialect, compilePattern,
  compileSchemaEnvelope, deriveSchemaIdentity, evaluate, getCompiled, getCompiledWith,
  isSchemaTruncationMarker, matchPattern, parseSchemaEnvelope, parseVfsl, planMutationBoundary,
  renderProjectionText, resolveSchemaAtPath, validateAppendToArray, validateDeleteFromArray,
  validateInsertIntoArray, validateLogicalSnapshot, validatePatch`；
- `/elementwise/i` 命中 **恰 1 个**：`applyElementwiseArrayMutation`（#435/ADR 0033 数组位）；
- `typeof surface['applyElementwiseEntryMutation'] === 'undefined'` ⇒ 新接缝缺席。

### 5.2 G2 现行边界接缝必须消费「整 map / 父对象提取值」（GAP 机制）

以在场事实 `{has: true}` 代替 `boundaryBase` 调现行 `applyMutationAtBoundary`：

| 调用（plan / payload） | 实测结果（逐字节） |
|---|---|
| record set（`tasks/t3`）+ `{op:'set', value:{name:'a',qty:1}}` | `{"ok":false,"issues":[{"message":"类型不匹配：期望对象，实际 boolean","path":["tasks","has"]}]}` |
| record delete（`tasks/t1`）+ `{op:'delete'}` | `{"ok":false,"issues":[{"message":"delete 目标键不存在（拒绝 no-op）","path":["tasks","t1"]}]}` |
| parent delete（`obj/req`）+ `{op:'delete'}` | `{"ok":false,"issues":[{"message":"delete 目标键不存在（拒绝 no-op）","path":["obj","req"]}]}` |

⟹ 现行接缝无法从「schema 静态事实 + 键位在场性 + 新值」工作；调用方必须先做整 map/父值提取
（doc-runtime 现状：`case 'record'/'parent'` 走 S5 walk → S6 全量重建 → S9 重投影）。

### 5.3 G3 规划闸门前提（plan 形状，全部实测）

| 目标 | kind | prefix / relPath | node 形态 |
|---|---|---|---|
| `tasks/t1` set 或 delete | `record` | `["tasks"]` / `["t1"]` | `object` + `<key>` 槽（ref 值位） |
| `codes/id-1` set（Pattern Record） | `record` | `["codes"]` / `["id-1"]` | `object` + `<key>` 槽 + `keyPattern=^(id-[0-9]+)$` |
| `blobs/b1` set（值位 union） | `record` | `["blobs"]` / `["b1"]` | `object` + `<key>` 槽（union 值位）→ **闸门不排除** |
| `outer/inner/k1` set/delete | `record` | `["outer","inner"]` / `["k1"]` | `object` + `<key>` 槽 |
| `obj/opt` delete（封闭对象） | `parent` | `["obj"]` / `["opt"]` | `object`（无 `<key>` 槽；字段 req/opt/unk/child/u） |
| `obj/req` set（封闭对象字段 set） | `target` | `["obj","req"]` / `[]` | `scalar`（非闸门计划） |
| `maybe/m1` set 或 delete（`Record<string,Item> \| {fixed:string}`） | **`union`** | `["maybe"]` / `["m1"]` | `union` ⇒ 永久 legacy 轨 |
| `obj/ghost` delete（未声明键） | — | — | **规划层拒绝**：`路径不存在：未知字段 "ghost"（封闭对象不接受未声明键）` |

### 5.4 G4 现状语义快照（目标接缝必须逐字复现的兼容面）

| 场景 | 实测（legacy `applyMutationAtBoundary`） |
|---|---|
| 键 Pattern 违规（合法值，`codes/nope`） | `{"ok":false,"issues":[{"message":"Record 键 \"nope\" 不满足 Pattern 正则 /^(id-[0-9]+)$/","path":["codes","nope"]}]}` |
| 键 Pattern 违规 + 非法值 | 两 issue，序 = 键先值后：`["codes","nope"]` → `["codes","nope","qty"]`（键违规不阻断值校验） |
| 非法新值（`tasks/t9`） | `{"ok":false,"issues":[{"message":"期望整数区间 [0, 100]，实际 101","path":["tasks","t9","qty"]}]}` |
| 必填 delete（`obj/req`） | `{"ok":false,"issues":[{"message":"缺少必填字段 \"req\"","path":["obj","req"]}]}` |
| no-op delete（`obj/opt` 缺席） | `{"ok":false,"issues":[{"message":"delete 目标键不存在（拒绝 no-op）","path":["obj","opt"]}]}` |
| optional delete（`obj/opt`） | `{"ok":true,"issues":[]}` |
| `unknown` 标量必填 delete（`obj/unk`） | `{"ok":true,"issues":[]}`（缺席视同接受的现行语义保留） |
| 值位 union（`blobs/b1`，`{label:'l',n:99}`） | `{"ok":false,"issues":[{"message":"联合成员 2/2：期望整数区间 [0, 10]，实际 99","path":["blobs","b1","n"]}]}` |
| delete 目标键本身违反 Pattern（在场） | `{"ok":true,"issues":[]}`（delete 不查键 Pattern） |
| delete 缺席键且键违反 Pattern | no-op 拒绝（域规则先于 schema 判定） |

### 5.5 G5 立法前提（ADR 0034 决策 5 绿侧）

`validateLogicalSnapshot` 对 200 entry 干净 `tasks: Record<string, Item>`（ROOT 全量快照）→
`{ok:true}`；其中一条 entry 非法 → 响亮拒绝且 issue 落在 `["tasks","t7","qty"]`（无 map 级约束、
entry 级非法仍被发现）。⇒「Record 合法 ⟺ 逐键值合法」前提为真。

### 5.6 缺口 × AC × 红灯落点

| AC | 现状（HEAD） | 红灯落点 |
|---|---|---|
| AC1 Record set（键 Pattern + 新值 + 逐字路径） | 无接缝；legacy 需整 map | 契约 B1–B5/B7 |
| AC2 Record delete（仅域规则） | 无接缝；legacy delete 整 map 校验 | 契约 C1–C5 |
| AC3 封闭对象 delete 静态矩阵 | 无接缝；legacy 需父值重建 + 整体校验 | 契约 D1–D6 |
| AC4 一致性 fixture（Record + parent） | 无逐 entry 侧可比（仅 #435 数组位 fixture） | 契约 E1–E3 + 夹具 117 例 |
| AC5 公开面新导出 + guard | 无新导出（`/elementwise/i` 仅数组位） | 契约 A1/A2 + 类型契约 `.test-d.ts` |
| AC6 包测试 + 根 gates | pre-contract 绿（§4）；实现后须复绿 | §13 记录当前红面 |

## 6. Negative control

`packages/vfsl/test/issue-440-elementwise-entry-control.test.ts` —— **19/19 passed**（HEAD 实测，
`artifacts/sa6-issue440-focused-{1..5}.log`），实现落地后须保持绿：

| 组 | 锚定内容 |
|---|---|
| NC1 | legacy record/parent 语义冻结：键 Pattern message+path（逐字）、键违规不阻断值（issue 序）、非法新值 rebase（`tasks/t9/qty`、嵌套 `outer/inner/n9/qty`）、no-op message（Record / parent / Pattern 键三支逐字）、必填 delete message（req/child/u 与嵌套 req）、optional/unknown 允许、值位 union 仲裁 message |
| NC2 | 规划闸门冻结：Record set/delete `kind=record ∧ prefix=map ∧ relPath=[key] ∧ <key> 槽（+keyPattern）`；封闭对象 delete `kind=parent ∧ 无 <key> 槽`；union map 位 `kind=union ∧ node.kind=union`；未声明键 delete 规划层结构面拒绝（逐字） |
| NC3 | legacy 输入契约 = 整 map / 父对象提取值：`{has:true}` 代 `boundaryBase` 三支（record set 事实对象被当作 map 内容校验 / record delete no-op / parent delete no-op） |
| NC4 | 夹具 oracle 自洽 + census：等价集 107 例 oracle 判决 = 登记期望、issue 只落目标键位前缀、计划 ∈ {record,parent}；accept/reject、set/delete、record/parent 六支均非空；触达面组 legacy 一律连带拒绝 |
| NC5 | 既有公共导出超集锚：23 个运行时导出在场（本票只允许加法）；`applyElementwiseArrayMutation` 签名面不得动 |
| NC6 | 立法前提：200 entry 干净 Record 整体接受；entry 级非法响亮拒绝 |
| NC7 | 现状触达面（决策 4 对照基线）：污染在目标键位之外的 record set/delete 与 parent delete 在 legacy 轨连带拒绝，且拒绝原因不含目标键位前缀 |

**A/B 判别（同一输入、两轨道）**：同一污染、同一 op —— legacy 轨 `ok:false`（连带拒绝）vs
目标接缝（见证）`ok:true`；同一 plan、同一 payload —— 目标键合法 vs 目标键非法（Pattern/值/必填）
判决字节可分；`{has}` 真/假 × set 判决恒同（旧值不读），`{has}` 真/假 × delete 判决可分
（在场性正是 delete 的唯一数据输入）。⇒ 契约断言对语义面敏感（非恒真、夹具非自证）。

## 7. Stability, scale and timing

- **聚焦稳定性**：契约 + 负控 5 轮（`artifacts/sa6-issue440-focused-{1..5}.log`；末轮在临时诊断清理后复跑）——
  每轮 **26 failed / 19 passed**；红集合（测试全名排序，去时长）md5
  `cb8aa47895ea0b1958c266e133d71406` 逐轮相同；**26 条失败全部为同一能力缺口错误**
  （红因普查：`Error: 能力缺口：@` × 26，零其它 AssertionError/TypeError）。
- **干跑稳定性（绿侧）**：见证接缝注入公共面（vitest alias，仅诊断用）后同一契约文件
  **26/26 green**、exit 0（`artifacts/sa6-issue440-witness-dryrun-full.log`）。
- **夹具确定性**：`mulberry32(440)` 冻结；117 例 = 107 等价例（26 参数 + 60 随机 + 21 矩阵/污染
  目标键位例）+ 10 触达面例；接受 46 / 拒绝 61、set 46 / delete 61、record 69 / parent 38；
  同输入恒同用例集（探针与测试共用夹具模块）。
- **规模/时序条件**：全部断言为纯函数调用，零真实时钟、零网络、零并发；单轮聚焦 < 0.5s。
- **结构面（机器无关）**：接缝输入只有「plan + `{has}` + 载荷」，**不携带其他 entry / 父值**；
  legacy 对照的「全量提取」是 O(n) 的形态证据（G2/G3），绝对耗时基准归 #441（ADR 决策 6 软验收）。

## 8. Capability gap chain（Feature：能力缺口，不虚构 Bug 根因）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 症状（能力面） | AC1–AC5 要求的「Record / 封闭对象 delete 逐 entry 公共接缝 + 一致性 fixture + 公开导出」在包内零落点 | 导出普查 23/23（G1）；`/elementwise/i` 恰 1 命中（数组位） | 高（运行时反射） |
| 2 直接缺口点 | 唯一可用的 record/parent 写判定入口 `applyMutationAtBoundary` 是**边界值驱动**：record 支 `relNavigate` + `{...map, [key]: value}` 全量拷贝重建；parent 支同构重建后 `validateSubtree(plan.node, proposed)` 整体判定 | `validate-patch.ts` record/parent 支（`applyMutationAtBoundary` L926–1012、`validateBoundary` L1015）；G2 三支实测 | 高（源码 + 运行实测） |
| 3 调用方义务 | doc-runtime `case 'record'/'parent'` 必须先 `walk` 整 map/父值提取（S5），再 S6 apply + S9 重投影 | `packages/doc-runtime/src/mutation-local.ts`（record/parent 分支；数组位对照 L296–340） | 高（源码） |
| 4 触发条件 | 任一非 union Record 位的 set/delete、任一封闭对象字段 delete（含大索引 map 单键写） | ADR 0034 背景（4 次全 map 遍历）；G5 大 map | 高 |
| 5 最深根因（能力） | vfsl 公共面缺少「schema 静态事实（Record `<key>` 槽 + keyPattern / 字段必填性）+ 键位在场性 O(1) 事实 + 新值」结算判定的接缝；**判定语义本身正确**，缺的是把整容器验证替换为逐 entry 验证的公共表达 | §5 全组 + ADR 0034 决策 1/2 | 高 |
| 6 放大因素 | 成本与 map 规模解耦失败（S5 walk + S6 `{...base}` 展开 + `validateSubtree` 全量 + S9 重投影）；10⁵ entry 索引 map 改一条 = 4×10⁵ entry 处理量 | ADR 0034 背景；G2/G3 形态证据（绝对耗时归 #441） | 中（软证据，未做本票基准） |
| 7 行为面缺口 | 决策 4 的触达面收窄（污染容器写目标键合法即成功）与决策 5 的立法执行（一致性 fixture）都无载体 | 夹具触达面组 10 例全数 oracle 连带拒绝（NC4.3/NC7）；无 Record/parent 一致性 fixture | 高 |
| 8 目标语义可达 | 见证实现（纯公共导出：单 entry map 视图过 legacy 判定 / 静态必填判定 + no-op 域规则）与全量 oracle 在等价集 **107/107 逐字节一致**，且在触达面组全数可分 | 探针 REF/O1/O2/O3；干跑 26/26 | 高（独立通道） |
| 9 未证实假设 | 无。**明确不主张**：现行 record/parent 全量路径有缺陷、issue 路径有误、域规则有偏差、诊断/复制面存在回归——负控 NC1–NC7 证明这些在现行契约下正确且必须保持 | 负控 19/19 绿 | 高 |
| 10 排除项 | 非环境（pre-contract 根 typecheck exit 0 + 根 test 全绿，§4）、非 runner 发现面（§14）、非夹具自证（探针独立通道 + 干跑注入）、非「已在别处落地」（#441/#442 未开工，均 Blocked by #440） | §4/§11/§13/§14 | 高 |

## 9. Causal experiments（最小因果实验 / 反证）

| # | 实验 | 控制变量 | 结果 | 结论 |
|---|---|---|---|---|
| E1 | **见证 vs 全量 oracle**（等价集 107 例） | 同一 plan / 同一 base / 同一 payload；见证只收 `{has}` | 107/107 逐字节一致（accept 46 / reject 61） | 目标语义**可表达、可满足**，SPEC 无自相矛盾 |
| E2 | **判据敏感性**（触达面组 10 例） | 只换 base 的污染位置（目标键位之外） | 见证 vs oracle **10/10 逐字节可分**（oracle 全数连带拒绝） | E1 的比较面能看见真实差异（非恒真） |
| E3 | **legacy 输入契约**（三支） | 只换 boundaryBase 形态（整值 vs `{has}` 事实） | record set 报 `类型不匹配：期望对象，实际 boolean`；record/parent delete 报 no-op | 缺口机制确认：现行接缝无法从静态事实 + 在场性工作 |
| E4 | **旧值不读 / 在场性是 delete 唯一输入** | 只翻转 `{has}` | set：`has` 真/假判决字节恒同（B6）；delete：真 → `ok:true`、假 → no-op（C1/C2） | 接缝对「整值替换」与「在场判定」两类语义敏感且不越界 |
| E5 | **失败注入对照**（同契约文件、两实现面） | HEAD 公共面 vs 见证注入公共面（vitest alias） | HEAD：26 failed（全为能力缺口）；注入后：**26/26 green** | 红因 = 能力缺口；契约可被正确实现翻绿（含 A1 公共面断言） |
| E6 | **立法前提**（决策 5 绿侧） | Record entry 数 0→200，单 entry 值合法性 | 200 entry 干净 → `ok:true`；一条非法 → issue 落 `tasks/t7/qty` | VFSL v1 Record 层确无 map 级约束；立法非空转 |
| E7 | **闸门 fail closed**（干跑 F 组） | 同一接缝、六类违约计划 + 一类违约载荷 | 见证实现下 F 组全绿：union map / target / 手造 kind / parent+set / relPath≠[key] / array 载荷 全部 `ok:false` 且带 issue，从不静默 ok | 闸门纪律可执行；legacy 轨照常可用（F2 对照腿） |
| E8 | **类型面干跑** | 冻结签名（`interface` 与 `type` 两形态各验） | 正面断言零报错、3 条 `@ts-expect-error` 全部命中（`artifacts/sa6-issue440-type-dryrun.log`，exit 0） | test-d 的期望/负面形状正确；HEAD 的 TS 红全部由缺导出派生 |
| E9 | **变异敏感性**（4 个错误实现注入公共面，同一契约文件） | 只改见证实现的一处语义 | M1b 丢弃键 Pattern issue → **4 红**（B3/B4/E1/E3）；M2 optional 误拒 → **5 红**（D2/D4/D5/E1/E3）；M3 set 误要求在场 → **10 红**（A2/B1–B7/E1/E3）；M4 漏 no-op 域规则 → **4 红**（C1/C5/D3/E1）（`artifacts/sa6-issue440-mutation-*.log`） | 契约断言对四处关键语义**敏感可分**（非恒真、非「只查导出在场性」） |

## 10. Impact surface

- **本票改动面（全部新增，生产零改动；`git status` 清单见 §16）**：
  - `packages/vfsl/test/issue-440-elementwise-entry-contract.test.ts`（26 tests，红灯契约）；
  - `packages/vfsl/test/issue-440-elementwise-entry-control.test.ts`（19 tests，恒绿负控）；
  - `packages/vfsl/test/issue-440-elementwise-entry-fixture.ts`（共享夹具；117 例；非测试入口）；
  - `packages/vfsl/test/issue-440-elementwise-entry.test-d.ts`（类型面契约：导出名/签名/词表/负面夹具）；
  - `wiki/raw/task_issue-440_sa6_capability_probe.mts`（探针，exit 0）；
  - 本报告；证据日志 `artifacts/sa6-issue440-*.log`。
- **公共面（实现后，additive）**：1 个运行时导出 `applyElementwiseEntryMutation` + 2 个类型导出
  （`EntryCarrierFacts` / `ElementwiseEntryMutationPayload`）；既有 23 个运行时导出逐字节不变
  （负控 NC5）；数组位接缝 `applyElementwiseArrayMutation` 签名面不动（#435 契约 + 本票 NC5.2）。
- **语义面**：record/parent 判定从「全容器重建 + 整体验证」变为「键位 Pattern/值 schema/静态必填 +
  在场性」；接受/拒绝结论与 issue 内容在**合法基线**上逐字节不变（E1）；刻意例外 = 决策 4 的
  触达面收窄（目标键位之外的污染不再连带拒绝，E2/E3）。
- **消费方（不在本票实现）**：#441 doc-runtime 按闸门分流 + S9 收窄；#442 lease 端到端行为钉正。
  本票契约不约束其接线，但接缝形状按该消费面最小化（只收 `{has}`、返回 `ValidateResult`）。
- **兼容风险**：issue 路径/顺序/域 message 是兼容行为（`packages/vfsl/AGENTS.md`）；契约以 legacy
  oracle 逐字节比较 + 显式常量双重锚定；未来若有人以校验器特判引入 map 级约束，E1/E2 与
  NC4/NC6 共同红灯（决策 5 enforcement）。
- **不受影响**：union map 位 / union 穿越（永久 legacy）、`kind=target` 整值替换、数组位
  （#435 面）、`validatePatch` / `validateAppendToArray` 等路径级旧接缝、诊断与复制协议。

## 11. Ruled-out hypotheses

| 假设 | 排除证据 |
|---|---|
| 「红/绿是环境、依赖或夹具问题」 | pre-contract 根 typecheck exit 0、根 test 全绿（§4）；负控 19/19 绿；干跑注入后 26/26 绿；探针独立通道 exit 0 |
| 「契约红在错误原因」 | 26 条失败**全部**为同一能力缺口错误（`Error: 能力缺口：@` × 26，零其它错误类型）；红集合 5 轮 md5 恒同 |
| 「AC1 断言恒真（夹具自证）」 | 等价集以 legacy oracle 逐字节比较；探针 REF 与夹具 oracle 独立复算 107/107；触达面组 10/10 可分；4 个错误实现变异分别 4/5/10/4 红（E9）——断言对键 Pattern / optional 规则 / set 在场性 / no-op 域规则逐一敏感 |
| 「目标语义不可满足 / SPEC 自相矛盾」 | E1 见证 107/107 命中；E5 注入后契约 26/26 绿；E8 类型干跑零报错 |
| 「缺的是实现 bug，不是能力缺口」 | HEAD 与基线同为 `0a91f14`（ADR 0034 是纯文档提交）；HEAD 公共面无该导出（G1）；legacy 行为全部正确（NC1–NC7） |
| 「legacy 也能从静态事实工作（不必新增接缝）」 | G2 三支实测：`{has}` 代 boundaryBase 一律拒绝（set 甚至把事实对象当 map 内容校验） |
| 「union map 位会被 fast path 误接管」 | G3：union map 位 `kind=union ∧ node.kind=union`；契约 F2 钉「接缝不静默接受」+ legacy 轨照常 ok |
| 「Record 值位 union 会被闸门误伤」 | G3 `blobs` 计划 `kind=record ∧ node 含 <key> 槽`（值位 union 不排除）；契约 B5 要求逐字复现 union 仲裁 |
| 「封闭对象 delete 需要读父值」 | 契约 D4/D5：同 `{has}` 事实下干净基线与「目标字段值非法」「同胞污染」判决逐字节相同（拒绝/允许均不变） |
| 「未声明键 delete 需要特判」 | G3：规划层结构面即拒（`路径不存在：未知字段`），不可能到达接缝 |
| 「触达面收窄是本票新增的行为风险」 | ADR 0034 决策 4 立法 + #442 承担端到端钉正；本票只把接缝输入面收窄到 `{has}` 并以 E2/NC7 记录对照基线 |
| 「测试入口不可发现 / 需要 env override」 | §14：两个 `.test.ts` 命中根 vitest include，实际被收集执行；零 skip/only/todo/env 分支 |

## 12. Acceptance contract and test paths

### 12.1 绑定点（冻结；SA8 设计须采用，改动即触发契约原位修订与重跑）

| ID | 绑定项 | 冻结值 |
|---|---|---|
| B-1 | 观察入口（1 个新增运行时导出） | `applyElementwiseEntryMutation(derived, plan, facts, payload)` —— `@nomicore/vfsl` 公共入口（`src/index.ts`）唯一新增运行时导出；改名只动契约测试 `SEAM_EXPORT` 常量与 test-d 静态 import 两处 |
| B-2 | 载体域事实（新增类型导出） | `EntryCarrierFacts = { readonly has: boolean }` —— 目标键位在场性（O(1)，`Y.Map.has(key)` / 父对象 `hasOwn` 同义）；**不含其他 entry / 父值** |
| B-3 | 载荷词表（新增类型导出） | `ElementwiseEntryMutationPayload = { op: 'set'; value: unknown } \| { op: 'delete' }`（字段与 `BoundaryMutationPayload` 同名支逐字一致；array-* 仍走 `applyElementwiseArrayMutation`） |
| B-4 | 闸门与返回 | plan.kind ∈ {`record`,`parent`} ∧ `relPath` 长度 1（目标键位）∧ `node.kind='object'`；违约计划/载荷 **fail closed**（响亮 issue，不抛、不静默 ok）；返回 `ValidateResult` 直出（无 `proposedBoundary`） |
| B-5 | 全量 oracle | `applyMutationAtBoundary`（既有公共导出：边界值全量重建 + `validateSubtree` 整体判定 + issue rebase）；等价集逐字节比较面 |
| B-6 | 夹具 | `issue-440-elementwise-entry-fixture.ts`：107 等价例（Record set/delete + parent delete 矩阵 + 目标键位内污染）+ 10 触达面例（目标键位外污染）；`mulberry32(440)` 确定性 |

> 命名冻结说明：iteration 0 无 SA8 设计件，B-1…B-3 的名目由本契约冻结（与 #435 的
> `applyElementwiseArrayMutation` / `ArrayCarrierFacts` / `ElementwiseArrayMutationPayload`
> 命名族同构；ADR 0034 §6 要求「复用而非另起平行机制」，且 #435 类型契约禁止扩展数组接缝签名）。
> 若 SA8 设计采用两名制或其他名目，属**契约重绑**（改 B-1 绑定点后重跑 SA6），语义面 B-2…B-6 不变。

### 12.2 用例组与断言（HEAD 红/绿）

| 组 | 断言要点 | HEAD |
|---|---|---|
| A 公共接缝 | A1 新导出在场且为函数（公共面唯一入口）；A2 合法 set 返回 `{ok:true}` 直出（无 `result` 包装）、plan 不被突变 | 红（2） |
| B Record set | B1 四条 Record 路径新键/既有键合法通过；B2 非法新值零写入 + 路径 `[...mapPath,key,...值内]`（常量锚 + oracle 逐字节）；B3 键 Pattern 违规 message/path 逐字；B4 键违规 + 非法值两 issue 键先值后；B5 值位 union 逐字复现仲裁；B6 旧值不读（`has` 恒同判决 + 目标键位旧污染不阻断）；B7 嵌套 Record rebase | 红（7） |
| C Record delete | C1 缺席键 no-op 逐字；C2 在场键全数通过；C3 同 `has` 下干净 vs 邻位污染判决逐字节相同（oracle 前置拒绝）；C4 目标键自身违规但存在 → 照常成功；C5 缺席键即使违规 Pattern 也只报 no-op | 红（5） |
| D 封闭对象 delete | D1 必填（req/child/u 与嵌套 req）拒绝逐字；D2 optional/unknown 允许且与 oracle 一致；D3 缺席 no-op 逐字（含必填缺席）；D4 静态性（同 `has` 下目标字段值合法/污染判决恒同）；D5 同胞不重验（五字段 × 干净/污染基线恒同）；D6 嵌套 parent rebase（`panel.node.req`） | 红（6） |
| E 一致性 fixture | E1 107 等价例逐字节一致（checked == length，规模 ≥100）；E2 10 触达面例全数可分（oracle 前置全拒）；E3 触达面目标行为（accept/reject 与登记一致、issue 只落目标键位前缀；拒绝支 issue 数 < oracle） | 红（3） |
| F 闸门 fail closed | F1 全部等价例计划形状前提 + 接缝接管（返判别联合）；F2 union map 位不静默接受 + legacy 轨可用；F3 六类违约计划 + 违约载荷 fail closed（`ok:false` 且带 issue，不抛） | 红（3） |

### 12.3 测试路径

| 产物 | 路径 | 角色 | HEAD 红/绿 |
|---|---|---|---|
| 红灯契约 | `packages/vfsl/test/issue-440-elementwise-entry-contract.test.ts` | A–F（26 tests） | **26 red**（全为能力缺口） |
| 恒绿负控 | `packages/vfsl/test/issue-440-elementwise-entry-control.test.ts` | NC1–NC7（19 tests） | **19 green** |
| 共享夹具 | `packages/vfsl/test/issue-440-elementwise-entry-fixture.ts` | 117 例 + oracle/目标判决/字节判据助手（非测试入口，零 vitest 依赖） | 供两侧与探针消费 |
| 类型契约 | `packages/vfsl/test/issue-440-elementwise-entry.test-d.ts` | 导出名/签名/事实/词表/返回 + 3 条负面夹具 | **red（TS2724×3）** |
| 探针 | `wiki/raw/task_issue-440_sa6_capability_probe.mts` | G1–G5 + REF/O1–O3 + NC1/NC2（27 项） | exit 0（27/27） |

### 12.4 AC 映射

| AC | 契约组 |
|---|---|
| AC1 Record set（键 Pattern + 新值 + 逐字路径） | B1–B5、B7 |
| AC2 Record delete（仅域规则、不触碰其他 entry） | C1–C5 + D5 对照 |
| AC3 封闭对象 delete 静态规则全矩阵 | D1–D6 |
| AC4 一致性 fixture（Record + parent） | E1–E3 + 夹具 + 负控 NC4 |
| AC5 公开面导出 + public-surface guard | A1/A2 + test-d + NC5 |
| AC6 包测试 + 根 gates 绿 | §13（实现后判据） |

### 12.5 契约纪律

- 零 skip/only/todo、零 env override、零 fallback、零吞错、零软化断言；
- 断言只观察运行时行为（判别联合、issue message/path、逐字节 oracle 比较、计划形状、导出在场性），
  **零源码字符串断言**（不 grep 生产源码、不 import 内部件）；
- 期望值来源：现行实现冻结常量（域 message/path、Pattern message）或机制性 oracle
  （legacy 全量判定同输入比较、`has` 翻转对照、`{has}` 代 base 的契约对照）；
- 新接缝经 `import * as vfsl` 动态属性读取（顶层不静态 import 新名目）——缺导出时红因单一；
- 测试文件位于仓库真实发现面（根 `vitest.config.ts` `packages/*/test/**/*.test.ts`；
  类型面 `*.test-d.ts` 经 `--typecheck` + `tsconfig.typecheck.json` 收集）。

## 13. Red/green or baseline evidence

| 证据 | 命令 / 文件 | 结果 |
|---|---|---|
| pre-contract 根 typecheck（基线 worktree） | `pnpm typecheck`（`artifacts/sa6-issue440-baseline-typecheck.log`） | **exit 0**（`BASELINE_TYPECHECK_EXIT:0`，15 包） |
| pre-contract 根 test（基线 worktree） | `pnpm test`（`artifacts/sa6-issue440-baseline-root-test.log`） | **466 files / 5667 tests 全绿**（`BASELINE_TEST_EXIT:0`） |
| 聚焦（契约 + 负控） | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run <两文件>`（`artifacts/sa6-issue440-focused-{1..5}.log`） | **26 failed / 19 passed** ×5 轮；红集合 md5 `cb8aa47895ea0b1958c266e133d71406`；红因 = `Error: 能力缺口：@` × 26 |
| 单契约文件（HEAD） | 同上（`...contract.test.ts`） | **26 failed**，Type Errors: no errors |
| 单负控文件（HEAD） | 同上（`...control.test.ts`） | **19 passed**，Type Errors: no errors |
| **干跑绿侧（见证注入公共面）** | `pnpm exec vitest run --config .scratch/dryrun/vitest.witness.config.ts`（`artifacts/sa6-issue440-witness-dryrun-full.log`） | **26/26 passed**、exit 0（同文件、仅换实现面） |
| **变异敏感性（4 个错误实现）** | 同干跑入口，替换见证实现（`artifacts/sa6-issue440-mutation-{m1b-keypattern-dropped,m2-optional-reject,m3-set-requires-presence,m4-delete-no-noop}.log`） | 4 / 5 / 10 / 4 红（红灯落点逐条见 §9 E9）——断言对键 Pattern、optional 静态规则、set 不读在场性、no-op 域规则四处关键语义敏感 |
| 干跑（逐测试替换见证，无 alias） | `artifacts/sa6-issue440-witness-dryrun.log` | 25 passed / 1 failed（唯一失败 = A1 公共面导出缺席本身） |
| 探针 | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-440_sa6_capability_probe.mts`（`artifacts/sa6-issue440-probe.log`；清理后复跑 `artifacts/sa6-issue440-probe-post-cleanup.log`） | **exit 0**；27/27 命中；等价集 107/107、触达面 10/10 可分 |
| post-contract 包 typecheck | `tsc -p packages/vfsl/tsconfig.json --noEmit`（`artifacts/sa6-issue440-post-vfsl-typecheck.log`） | **exit 2**；7 条报错**全部**在 `issue-440-elementwise-entry.test-d.ts`（TS2724×3 缺导出 + TS2349 下游 + TS2578×3 负面夹具未命中），contract/control/fixture 零 TS 噪声 |
| post-contract 根 typecheck | `pnpm typecheck`（`artifacts/sa6-issue440-post-typecheck.log`） | **exit 2**（`POST_TYPECHECK_EXIT:2`；`&&` 链在 vfsl 包停住——7 条报错全部在 test-d，契约文件/负控/夹具零 TS 噪声） |
| post-contract 根 test | `pnpm test`（`artifacts/sa6-issue440-post-root-test.log`） | **469 files / 5712 tests：26 failed（契约）+ 1 失败 suite（test-d TypeCheckError）；2 failed | 467 passed files、26 failed | 5686 passed tests、`POST_TEST_EXIT:1`** —— 5667 + 45 = 5712（本票新增 26 + 19），467 passed = 基线 466 + 负控 1 文件，**零第 4 方回归** |

**绿色判据（实现落地后须全部命中）**：契约 26/26、负控 19/19、探针 exit 0、
test-d 类型红转绿、根 `pnpm typecheck` exit 0、根 `pnpm test` 全绿（本票新增 2 文件被真实收集）。

## 14. Runner trigger evidence

- 真实入口：根 `vitest.config.ts` `include: ['packages/*/test/**/*.test.ts', …]`；
  两测试文件路径匹配该 glob；根 `pnpm test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；
  类型面 include `packages/*/test/**/*.test-d.ts`（tsconfig `./tsconfig.typecheck.json`）。
- 显式入口实跑（聚焦）：`pnpm exec vitest run packages/vfsl/test/issue-440-elementwise-entry-contract.test.ts
  packages/vfsl/test/issue-440-elementwise-entry-control.test.ts` → `1 failed | 1 passed (2)`，
  `26 failed | 19 passed (45)`（5 轮一致；末轮 = 清理临时诊断后复跑）。
- 收集性（实测，`artifacts/sa6-issue440-post-root-test.log`）：L235 `❯ packages/vfsl/test/issue-440-elementwise-entry-contract.test.ts (26 tests | 26 failed) 15ms`；L446 `✓ packages/vfsl/test/issue-440-elementwise-entry-control.test.ts (19 tests) 24ms`；L62 `❯ TS packages/vfsl/test/issue-440-elementwise-entry.test-d.ts (0 test)`（类型面经 `--typecheck` 收集）。根跑批 469 files / 5712 tests、`POST_TEST_EXIT:1`（唯一失败面 = 本票红契约 + test-d）
- 无 `describe.skip`/`it.only`/`it.todo`；无环境变量分支；无测试侧 try/catch 吞错；夹具零 vitest 依赖。

## 15. Unknowns and blockers

- **无阻断项**：能力缺口可运行证据化、目标语义可达（见证 107/107 + 干跑 26/26）、
  契约可执行、入口真实、红因单一且稳定、负控恒绿。
- 残余边界（明示不主张已覆盖，或归属后续 ticket）：
  1. **B-1…B-3 名目由本契约冻结**（iteration 0 无 SA8 设计件）：SA8 设计须采用本绑定表；
     若改用其他名目/两名制，按 §12.1 注释做契约重绑（1 个常量 + 1 个静态 import）后重跑 SA6；
     语义面 B-4…B-6 与 A–F 断言不变。
  2. **触达面收窄的端到端用户可见行为**（污染文档经 lease 写/删）归 #442；doc-runtime 分流接线、
     S9/E201/charge 与基准（10⁵ entry 单键写与 n 解耦）归 #441——本票只钉 vfsl 接缝语义 +
     以输入面（只收 `{has}`）与对照基线（NC7）表达决策 4。
  3. **F 组 fail closed 的 message 文案未冻结**（只钉 `ok:false` + 带 issue）：与 #435 F2/F3 同款，
     避免过度约束设计选择的闸门文案。
  4. **未声明键 delete 不进契约**：规划层结构面即拒（G3.4），接缝不可达；现行 legacy 行为由
     NC2.4 冻结。
  5. **性能软验收（ADR 决策 6）** 不在本票：绝对耗时基准归 #441；本票以结构面证据
     （接缝输入不含其他 entry/父值）+ legacy 全量形态（G2/G3）作机器无关锚。
  6. **owner 面**：REST comments `[]`——无未决 owner 需求待澄清。

## 16. Temporary diagnostics cleanup

| 临时物 | 处置 | 证据 |
|---|---|---|
| `.worktrees/issue-440-baseline`（基线对照 worktree） | 证据采集后 `git worktree remove --force` | 收尾 `git worktree list` 仅剩主仓与任务 worktree |
| `.scratch/issue-440-explore.mts`（plan/legacy 探索脚本） | 已删除 | `git status` 无该文件 |
| `.scratch/issue-440-fixture-selfcheck.mts`（夹具自检脚本） | 已删除 | 同上 |
| `.scratch/issue-440-type-dryrun.ts`（类型干跑脚本） | 已删除 | 同上 |
| `.scratch/dryrun/`（见证投喂 config/seam/index，干跑用） | 已删除 | 同上 |
| `packages/vfsl/test/zz-issue440-witness-dryrun.test.ts`（临时干跑测试） | 已删除 | `git status` 无该文件；干跑证据保留在 `artifacts/sa6-issue440-witness-dryrun*.log` |
| 生产实现改动 | **零**（无任何 `packages/*/src/**` 改动；无临时改语义/stash/patch） | `git diff` 空；`git status --short` 仅新增测试/fixture/证据/报告 |
| 后台命令 | 全部受控后台 job 已收敛（无 nohup/setsid/PID 文件；无残留服务） | 会话 job 状态 |
| 证据日志 | 保留 `artifacts/sa6-issue440-*.log`（仓库既有 SA6 证据惯例） | §13 清单 |
| 冻结产物指纹（md5） | 夹具 `ce86199a85f7787dcca529a87ff72408`；契约 `a595c8ae4a2bd02cfcd1ed95375c514b`；负控 `46829054dc02ff6e9d1f2b760b84bea6`；类型契约 `0fe31a97f9207ef183b4e5a04305b9d9`；探针 `0b5980411662eab9b8964f0f1283ad33` | `md5sum` 本会话 |

**结论一句话**：#440 的能力缺口 = ADR 0034 要求的 Record / 封闭对象 delete **逐 entry 判定接缝与
一致性 fixture 尚未存在**（公共面 23 个导出零落点，legacy 边界接缝必须消费整 map/父值提取值）；
本报告以 vfsl 公共接缝 26 条契约（A–F 组）+ 19 条负控（NC1–NC7）把键 Pattern/新值校验、旧值不读、
delete 仅在场判定、封闭对象静态必填全矩阵、union map 双轨、一致性逐字节与触达面收窄钉死；
一致性夹具 107 等价例（mulberry32(440)）+ 10 触达面例；见证实现（纯公共导出）与全量 oracle
107/107 逐字节一致、触达面 10/10 可分，见证注入公共面后契约 **26/26 全绿**（4 个错误实现变异
4/5/10/4 红 = 断言敏感）；HEAD 契约 26 红（红因单一 = 能力缺口，4 轮 md5 恒同），负控 19 绿，
探针 27/27 exit 0，基线 466 files / 5667 tests 全绿 + 根 typecheck exit 0，生产实现零改动。
