# SA6 诊断与验收契约 — issue #437：lease 端到端数组逐元素校验行为钉死（ADR 0033）

状态：**approve**（能力缺口/契约面已证实；最高 seam 契约 13 条 + 负控 7 条可执行；HEAD 全绿、
pre-#436 基线判别组 6 红/14 绿；探针 32/32；根 `pnpm typecheck` exit 0，根 `pnpm test` 见 §13）
HEAD：`02c7cfb`（worktree `mabf/issue-437`；含 #435 `006e416`、#436 `f61e583`）
基线（旧实现）：`7407ce0`（#435 已合、#436 未合；detached worktree `.worktrees/issue-437-baseline`，
证据采集后已移除）
写面：只新增测试/fixture/探针/本报告——**生产实现零改动**（`git diff` 空，见 §16）

---

## 1. Task type and inputs

- **任务类型**：feature（能力缺口 = 验证覆盖面缺口；**不虚构 Bug 根因**）。
  任务简报明示：「本 ticket 不改实现，只把新语义在最高 seam 上立法成回归测试」。
- 输入（固定位置读取）：
  - `wiki/raw/task_issue-437.md`（issue 正文 + AC1–AC6 + Parent PR #434 + Blocked by #436）；
  - **无 SA8 工件**（`task_issue-437_design.md` / `_relevant_decisions.md` / `_conflict_report.md`
    均不存在——iteration 0；替代规范约束面见 §3）；
  - 无既有 SA6 报告、无既有 #437 测试（固定报告 `wiki/raw/task_issue-437_sa6_contract.md`
    本文件为首次落位）；
  - 规范/证据面：`docs/adr/0033-elementwise-yarray-mutation-validation.md`、
    `wiki/raw/task_issue-436_sa6_contract.md`、`wiki/raw/task_issue-435_sa6_contract.md`、
    #436 设计/实现评审件、HEAD 源码与既有测试；
  - ADR 0033 状态行明示：影响包 `@nomicore/vfsl`、`@nomicore/doc-runtime`；
    复制协议、诊断捕获、`@nomicore/namespace-runtime` 写槽**零改动** —— 本票的最高 seam
    （lease）因此是「行为可见性的最终立法面」，而非再次改实现。

## 2. Owner comment mapping

- 维护者 REST issue-comment read 返回 `[]` —— **无 owner comment 需求面**。
- 唯一需求面 = issue 正文的 AC1–AC6 + ADR 0033 决策 1–5。逐条映射见 §12.3。
- AC 措辞歧义一处（已在契约中显式定案，非 owner 需求）：AC2「空批量 noop 不变」。
  在 lease seam，空载荷（`values: []` / `count: 0` / `{ops: []}`）**先被信封形状门拒绝**
  （旧新同码同 path，§5.3/§13）；「恒等 accept 的 noop」是 vfsl 接缝性质，已由
  #435 B6（`packages/vfsl/test/issue-435-elementwise-array-contract.test.ts:167`）钉死。
  本契约按**lease seam 可观察事实**立法：空载荷判决不变（形状拒绝 + 零写入零 update）。

## 3. SA8 constraints

#437 无 SA8 工件（iteration 0 确认）。替代规范约束面（逐条落实位置）：

| 约束源 | 内容 | 落实位置 |
|---|---|---|
| 任务简报 | 不改实现；最高 seam（lease `mutateData`）端到端立法 | 本报告 §10/§16（生产零改动）+ 契约文件（lease seam） |
| ADR 0033 决策 1 | 闸门/双轨：非 union `T[]` fast；union 数组目标永久 legacy 全量边界 | 契约 AC1-a..e（快轨）+ 负控 C1–C3（legacy 轨） |
| ADR 0033 决策 2 | O(k)/零写入/issue 路径 `[...arrayPath, index+j]`/域规则逐字/commit 形态不变 | 契约 AC2-a..d、AC5-b；负控 C4–C6 |
| ADR 0033 决策 3 | S9 收窄（fast 仅安装事实核；legacy 双核） | 由 #436 doc-runtime 侧 `FC/NA/NB` 组承担（本票不重复改造面立法） |
| ADR 0033 决策 4 | 触达面收窄：污染数组 delete 转成功；触达面外不发现 | 契约 AC1-a..e（判别组） |
| ADR 0033 决策 5 | 「数组合法性 ⟺ 逐元素合法」一致性 fixture | #435 vfsl 侧已交付；本票不改该面 |
| ADR 0033 决策 6 | 性能软验收（结构性证据，不钉毫秒） | #436 doc-runtime 读计数契约承担；本票补 lease seam 结构性代理 AC2-d/C7（元素读计数，机器无关） |
| 复制协议/诊断捕获/写槽 | 零改动 | 契约 AC4（记录形态）、AC5（owned update/diff 面）；负控 C5/C6 |
| 仓库测试纪律 | 零 skip/only/todo、零 env override、零源码字符串断言、真实入口发现 | §12.4/§14 |
| AGENTS.md（root/registry/namespace-runtime/doc-runtime） | 模块契约边界；registry 测试面用真实 Registry testing seam | 夹具只经公共入口（registry/lease/session）+ 诊断包公共导出 |

## 4. Environment and baseline

| 项 | 值/命令 | 证据 |
|---|---|---|
| 运行时 | node v24.13.0、pnpm 10.28.2 | 本会话 `node -v` |
| 依赖 | `pnpm install --offline`（reused 65，exit 0） | 与 `artifacts/sa6-issue435-install.log` 同款 |
| 测试器 | vitest 3.2.7（`NODE_OPTIONS=--conditions=nomicore-source`）、typescript 5.9.3、yjs 13.6.32 | 聚焦日志头部 |
| pre-contract 根 typecheck | `pnpm typecheck` → **exit 0**（15 包） | `artifacts/sa6-issue437-head-typecheck.log`（`TYPECHECK_EXIT:0`） |
| pre-contract 语义面 | #436 doc-runtime 契约 **25/25 绿**（ADR 0033 已实现） | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/doc-runtime/test/issue-436-array-fastpath-{contract,control}.test.ts` → 2 passed / 25 tests |
| 旧实现基线 | detached worktree `.worktrees/issue-437-baseline` @ `7407ce0`（pre-#436） | `git worktree add --detach .worktrees/issue-437-baseline 7407ce0` + `pnpm install --offline` |
| 服务/网络 | 零（纯内存 persistence/无网络/无长驻进程） | — |

**基线选择依据**：`7407ce0` = #435（vfsl 逐元素接缝）已合、#436（doc-runtime fast path 接线）
未合 → 恰是「ADR 0033 行为变化在 lease seam 尚未生效」的旧实现面（issue #437 Blocked by #436）。
更早的提交会把 vfsl 接缝也移除，红因将混入「接缝缺失」而非本票目标行为差异，故不选。

## 5. Positive reproduction（能力缺口，逐条可运行）

### 5.1 G1 — 能力缺口：lease seam 零 array-* 行为立法

`artifacts/sa6-issue437-coverage-census.log`（`git grep` tracked 面）：

| 面 | ticket 起点 HEAD（02c7cfb） | 本票新增（untracked） |
|---|---|---|
| lease(registry) | **0 件** | 契约 1 + 负控 1 + fixture 1 |
| runtime.mutateData | 4 件（`issue-347/349/350*`：`array-insert` 仅作 guard/批量信封载荷，**无 ADR 0033 语义断言**） | — |
| doc-runtime | #436 契约/负控（ADR 0033 改造面立法） | — |
| vfsl | #435 契约/负控/夹具（逐元素接缝立法） | — |

⇒ 用户可见行为（污染写、issue 路径、诊断/复制烟测）在**最高 seam 无任何回归锚**；
语义漂移（后续演进）不会在任何现有红灯上显形。探针 `G1` 复核同一清单（32/32 命中）。

### 5.2 G2 — 目标行为在 lease seam 可达（HEAD）

探针 `P1c/P1d`：raw-replication 污染（`items[0]='oops'`）后 `lease.mutateData({op:'array-delete',…})`
→ `{ok:true}`，污染保留 `["oops",1,3,4,5]`；`P1g` 恰一 owned update。
探针 `P2a–P2h`：issue 路径 `[["items",2],["items",3]]`（index+j）、嵌套 `["rows",1,"qty"]`、
越界逐字 message/path、空载荷形状拒绝、一切拒绝零写入零 update。
探针 `P3*`：`root-mutation/transaction/committed` + inline carrier 键集 + 同基态重放收敛 +
空 doc 不物化。探针 `P4*`：hub 写 → owned update → peer apply 收敛 + diff 定点 + session 面不变。
探针 `P5*`（结构性）：n=64 单元素 delete 的 live 元素读计数 **fast=0** vs
**union legacy=191**（全量边界校验仍在）——AC2-d/C7 的机器无关证据。

### 5.3 G3 — 旧实现（7407ce0）在目标断言处响亮拒绝

`artifacts/sa6-issue437-baseline-focused.log`（同一测试文件在基线 worktree 实跑）：

```
AC1-a … expected { ok: false, issues: [ { …(2) } ] } to deeply equal { ok: true }
        issues = [{ message: "类型不匹配：期望 number，实际 string", path: ["items", 0] }]
AC2-d … fast 轨读计数应 O(k)（≤8），实际 127   （n=64；旧实现整数组 walk ⇒ 与 n 耦合）
Test Files  1 failed | 1 passed (2)
     Tests  6 failed | 14 passed (20)
```

即判别组 = AC1-a..e（行为变化，legacy 响亮拒绝）+ AC2-d（O(n) 未解耦，基线读计数 127 ≫ 8；
HEAD 快轨为 0，见 P5）；其余 14 条（不变量 + 负控）旧新同绿。

## 6. Negative control

| 组 | 锚定内容 | 位置 |
|---|---|---|
| C1–C3 | union 数组目标永久 legacy：污染照旧响亮拒绝（逐字 `联合成员 1/2：类型不匹配：期望 number，实际 boolean` + path `['uarr',0]` + 零写入零 update）、干净写 ok、非法新值 issue path `['uarr',1]` | `issue-437-lease-array-e2e-control.test.ts` |
| C4–C6 | 域规则（`index===length` append / `index+count===length` delete 不 clamp，两轨）、干净写恰一提交、批量信封内数组 op ok + 单事务单事件 | 同上 |
| C7 | union legacy 轨元素读计数 ∝ n（≥n；AC3「仍走全量边界校验」的结构性锚，旧新同绿） | 同上 |
| A/B 判别 | **同一污染、同一 op**：非 union（快轨）`ok:true` vs union（legacy 轨）`ok:false`；**同一规模**：fast 轨读计数 0 vs union legacy 轨 191（n=64） ⇒ 契约 AC1/AC2-d 对闸门敏感（非恒真、非夹具恒绿） | 契约 AC1-a..e/AC2-d × 负控 C1/C7 |
| 环境排除 | 基线同一 command 下 14/20 绿（含全部负控与 AC2-a..c/AC4/AC5）；探针 exit 0；HEAD 20/20 绿 | §7/§13 |

探针 `P1e/P1f/P5a/P5b` 是同一 A/B 的独立通道（tsx，非 vitest），排除 vitest 夹具自证。

## 7. Stability, scale and timing

- HEAD 聚焦（契约 13 + 负控 7）：**连跑 5 轮全部 20/20 绿**（`artifacts/sa6-issue437-head-stability-{1..5}.log`）。
- 基线（7407ce0）聚焦：**连跑 3 轮全部 6 failed / 14 passed**，红灯集合（去时长）md5
  `762f1f30eeb591cfb4ff033ff30eac95` 逐轮相同（`artifacts/sa6-issue437-baseline-stability-{1..3}.log`）；红灯逐条 = AC1-a..e + AC2-d（判别组），无环境/夹具/入口类错误。
- 规模：行为用例 n=5（最小可判定）；结构代理用例 n=64（fast=0 / legacy=191，机器无关计数）。
  #436 已用 n∈{512,4096} 提供 doc-runtime O(k) 结构性证据，本票在 lease seam 以 n=64 对照复证。
- 时序：全部沉降为有界 `setImmediate` 轮 / 微任务展开，零 `setTimeout` 竞猜、零真实时钟断言；
  registry scheduler 为受控 fake（`createRegistryTestScheduler`）。
- 单轮聚焦 < 2s（含 2 文件 / 20 tests 与 registry 真实装配）；无并发、无网络、无服务。

## 8. Capability gap chain（Feature：能力缺失，不虚构 Bug 根因）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 症状（能力面） | AC1–AC5 要求的 lease seam 用户可见行为回归锚在 HEAD 零落点 | §5.1 census（lease 面 0 件）；probe G0/G1 | 高（静态清单 + 运行时探针） |
| 2 直接缺口点 | ADR 0033 立法只到 doc-runtime（`applyValidatedMutation`，`issue-436-array-fastpath-*`）与 vfsl 接缝（#435）；**lease/registry seam 没有 array-* 覆盖** | §5.1 A1/A3/A4；#436 SA6 §12.1 绑定点 = `applyValidatedMutation` | 高 |
| 3 触发条件 | 任一经 lease 的数组写/读 + 诊断/复制装配面（AC1–AC5） | 契约/负控/探针全部用例 | 高 |
| 4 目标行为已实现 | #435+#436 合并后，lease seam 已可观测到 AC1 行为变化（`ok:true`）、AC2-d O(k) 与 AC2/AC4/AC5 不变量 | probe P1–P5（32/32）；HEAD 20/20 绿 | 高（运行时实测） |
| 5 最深原因（非 Bug） | 交付切片顺序：ADR 0033 的**语义**随 #435/#436 落地，**最高 seam 回归立法**被显式拆给 #437（Blocked by #436） | issue #437 正文「本 ticket 不改实现，只把新语义在最高 seam 上立法」；#436 SA6 §12.1 绑定面 | 高 |
| 6 旧实现行为差异 | pre-#436 基线同一用例在目标断言处响亮拒绝（legacy 全量边界校验）且读计数 ∝ n | baseline 6 红；红因逐字 `类型不匹配：期望 number，实际 string` + `fast 读计数 127 > 8` | 高 |
| 7 未证实假设 | 无。**明确不主张**：现行实现有缺陷、fast path 判定次序有误、union 轨行为偏差、诊断/复制面存在回归 | 负控 20/20（含 union 逐字 + 读计数 + 单事件）、探针 32/32、HEAD 根 gates | 高 |
| 8 排除项 | 非环境（基线同 command 14 绿 + 根 typecheck exit 0）、非 runner 发现面（§14）、非夹具自证（探针独立通道）、非方向误判（污染经 `session.applyRemoteUpdate` 注入，非直写 doc） | §9/§11/§13 | 高 |

## 9. Causal experiments（最小因果实验 / 反证）

| # | 实验 | 控制变量 | 结果 | 结论 |
|---|---|---|---|---|
| E1 | **闸门 A/B**：同一 fixture、同一污染（raw insert `'oops'`/`true`）、同一 op（delete） | 仅目标数组声明类型不同（非 union vs union） | 非 union `ok:true` + 污染保留；union `ok:false`（逐字成员仲裁 message）+ 零写入 | AC1 断言对快/legacy 分流敏感；union 轨仍全量边界校验（AC3） |
| E2 | **旧实现对照**：同一 3 个测试文件在 `7407ce0` 实跑 | 仅实现版本不同（pre/post #436） | 基线 6 red / 14 green；红集合 = AC1-a..e + AC2-d | 红因 = ADR 0033 行为变化（#436 接线），非环境/夹具/入口 |
| E3 | **诊断载体重放**：carrier bytes → 同基态重放 vs 空 doc 重放 | 仅基态在场性不同 | 同基态 → `items=[1,2,3,4,5,42]`；空 doc → `ROOT.size=0` | carrier 是**真事务增量**（整文档编码会被空 doc 反向鉴别红灯） |
| E4 | **复制收敛三通道**：owned update → ①同基态纯 Y.Doc 重放 ②peer `applyRemoteUpdate` ③diff 定点 apply | 通道独立 | ①`[2,3,4,5]` ②`ok:true`+`[2,3,4,5]` ③`ok:true` 值不变 | 收敛不是租约读路径自证；协议承载物 = 合法 Yjs update |
| E5 | **形态同构**：数组写的记录/carrier 键集 vs 标量 set 写 | 仅 op 类别不同 | `Object.keys` 逐键相同（record + carrier 两层） | fast path 不改变诊断记录形态（AC4） |
| E6 | **空载荷判决对照**：`values:[]`/`count:0`/`{ops:[]}` 在 HEAD 与基线 | 仅实现版本不同 | 两侧同码同 path 拒绝、零写入（AC2-c 基线绿） | AC2「空批量」在 lease seam = 形状拒绝不变；noop 恒等 accept 属 vfsl 面（#435 B6） |
| E7 | **双轨读计数**：同规模 n=64 单元素 delete 的 live 元素读计数 | 仅目标数组声明类型不同 | fast = **0**；union legacy = **191**（≈3n） | O(n)→O(k) 解耦有机器无关结构证据（AC2-d）；union 轨「性能路径不变」= 全量 walk（C7/AC3） |

## 10. Impact surface

- **本票改动面（全部新增、生产零改动）**：
  - `packages/namespace-registry/test/issue-437-lease-array-e2e-contract.test.ts`（13 tests）；
  - `packages/namespace-registry/test/issue-437-lease-array-e2e-control.test.ts`（7 tests）；
  - `packages/namespace-registry/test/issue-437-lease-array-e2e-fixture.ts`（共享夹具，非测试入口）；
  - `wiki/raw/task_issue-437_sa6_capability_probe.mts`（探针，exit 0）；
  - 本报告；证据日志 `artifacts/sa6-issue437-*.log`。
- **生产实现**：零改动（`git diff` 空；`git status` 仅新文件，§16）。
- **契约绑定点（只经公共入口）**：`NamespaceRegistry.open/importReplica`、
  `NamespaceLease.mutateData/readData/enableReplication/openReplicationSession/getStatus`、
  `ReplicationSession.applyRemoteUpdate/encodeStateVector/encodeDiff/subscribeOwnedUpdates/getStatus`、
  `@nomicore/namespace-diagnostic-log` 公共面（`createBoundedMemoryDiagnosticLog` + record 类型）；
  零内部 subpath import、零 live Y.Doc 断言（lease 面取值）。
- **对后续演进的作用**：任何把非 union 数组写退回全量边界路径、改变 issue 路径/域规则、
  改变 union 轨分流、改变诊断 carrier 形态或破坏复制增量的演进，都会在 lease seam 显形红灯。
- **不受影响**：vfsl/doc-runtime 既有契约（#435/#436）保持不动；写槽/复制协议/诊断捕获零改动
  （ADR 0033 明文），本票只新增观察面。

## 11. Ruled-out hypotheses

| 假设 | 排除证据 |
|---|---|
| 「红/绿是环境、依赖或夹具问题」 | 基线同 command 14/20 绿（含全部负控）；HEAD 20/20 连跑 5 轮；探针独立通道 exit 0；根 typecheck exit 0 |
| 「契约红在错误原因」 | 基线红因逐字 = legacy 全量边界校验（`类型不匹配：期望 number，实际 string`，path `['items',0]`）与 O(n) 读计数（127>8）——恰是本票声明必须变化的行为/成本面 |
| 「AC1 断言恒真（污染没真正进 live doc）」 | `readData` 在写前可见污染（P1a/P1b/AC1-a..d 前置断言）；union 轨同污染被拒绝 ⇒ 污染确实在场 |
| 「污染注入绕过了 replication seam（＝直写 doc 假证据）」 | 污染只经 `session.applyRemoteUpdate(raw diff)`（`applyRawRemote`），应用结果 `ok:true` 被断言；fixture 持有的 doc 只用于构造对端基态/字节 oracle |
| 「AC2/AC4/AC5 是行为变化，应在基线红」 | 基线实跑：AC2-a..c、AC4-a..b、AC5-a..b、C1–C7 全绿（不变量组）；仅 AC1-a..e + AC2-d 红 |
| 「读计数代理不可执行/机器相关」 | 只计元素读次数（`get`/`toArray`/`forEach`），零计时阈值；fast=0 vs legacy=191 逐轮稳定（§7） |
| 「诊断断言只证明值相等、对形态不敏感」 | carrier 键集同构 + 同基态重放 + **空 doc 不物化**（整文档编码反证）三面 |
| 「复制收敛为租约读路径自证」 | 同一 update 在纯 Y.Doc 上重放 + peer apply + diff 定点三通道独立一致 |
| 「AC2『空批量 noop』= 空载荷 accept」 | lease seam 信封形状门先拒（旧新同码）；恒等 accept 是 vfsl 接缝性质（#435 B6）——措辞歧义已显式定案（§2） |
| 「union 数组目标被 fast path 误接管」 | 负控 C1 逐字 union 仲裁 message + 零写入；C2/C3 干净写与 issue path 不变；C7 读计数 ∝ n |
| 「写入形态漂移（write-then-undo / 非最小 edit）」 | 每次提交恰一 owned update（C5/C6/AC5-b）；update 对空 doc 不物化（增量形态） |

## 12. Acceptance contract and test paths

### 12.1 绑定点（冻结）

| ID | 绑定项 | 冻结值 |
|---|---|---|
| B-1 | 观察入口 | `lease.mutateData(envelope)` / `lease.readData(path)`（真实 Registry testing seam + 生产 Runtime 装配） |
| B-2 | 污染注入面 | `lease.openReplicationSession(...)` + `session.applyRemoteUpdate(raw Yjs update)`（trusted raw，零 VFSL 预校验） |
| B-3 | AC1 行为锚 | 非 union `T[]`：区间外污染（值非法/载体非法/字段非法）不阻断 delete/insert（`ok:true`，污染保留） |
| B-4 | AC2 不变量锚 | 非法新元素整笔零写入 + issue path `[...arrayPath, index+j]`（含嵌套子路径）；越界 message/path 逐字；空载荷形状拒绝；fast 轨元素读计数与 n 解耦（O(k)） |
| B-5 | AC3 双轨锚 | union 数组目标永久 legacy：污染响亮拒绝 + 逐字联合仲裁 message + 零写入零 update + 元素读计数 ∝ n（仍全量边界校验） |
| B-6 | AC4 诊断锚 | `root-mutation`/`transaction`/`committed effect:update` + inline carrier 键集 + 真事务增量重放 |
| B-7 | AC5 复制锚 | 一次提交恰一 owned update；同基态重放/peer apply/diff 定点三通道收敛；session 状态面不变 |

### 12.2 目标行为期望（HEAD 绿；判别组在旧实现红）

| ID | 断言 | 旧实现 `7407ce0` | HEAD `02c7cfb` |
|---|---|---|---|
| AC1-a | 值污染 + delete → `{ok:true}` + 污染保留 | **红**（`ok:false` + `['items',0]`） | 绿 |
| AC1-b | 值污染 + insert → `{ok:true}` + 污染零修复 | **红** | 绿 |
| AC1-c | 载体非法（裸值元素）+ delete → `{ok:true}` | **红** | 绿 |
| AC1-d | 字段值非法（`qty:'x'` 元素）+ delete → `{ok:true}` | **红** | 绿 |
| AC1-e | 批量信封内污染 delete → `{ok:true}` | **红** | 绿 |
| AC2-a | 非法新元素：零写入 + path `[items,2]/[items,3]` + 嵌套 `[rows,1,qty]` | 绿 | 绿 |
| AC2-b | 越界 delete/insert 逐字 message + path + 零写入零 update | 绿 | 绿 |
| AC2-c | 空载荷/空批量形状拒绝 + 零写入零 update | 绿 | 绿 |
| AC2-d | fast 轨读计数 ≤8（n=64）且 union legacy 轨 ≥n（**判别组**：旧实现 127>8） | **红** | 绿 |
| AC4-a | committed update carrier 形态 + 真增量重放（空 doc 不物化） | 绿 | 绿 |
| AC4-b | 数组写 vs 标量写记录/carrier 键集同构 | 绿 | 绿 |
| AC5-a | hub 写 → owned update → peer apply 收敛 + diff 定点 + session 面 | 绿 | 绿 |
| AC5-b | 单事件 + 增量形态（空 doc 不物化）+ 二次写再恰一事件 | 绿 | 绿 |
| C1–C3 | union 轨 legacy 行为逐字不变 | 绿 | 绿 |
| C4–C6 | 域规则/单事件提交/批量面基线 | 绿 | 绿 |
| C7 | union legacy 轨元素读计数 ∝ n（结构性锚） | 绿 | 绿 |

### 12.3 测试路径与 AC 映射

| 产物 | 路径 | 角色 | HEAD 红/绿 |
|---|---|---|---|
| 契约（lease seam） | `packages/namespace-registry/test/issue-437-lease-array-e2e-contract.test.ts` | AC1-a..e / AC2-a..d / AC4-a..b / AC5-a..b（13 tests） | **13 green**（旧实现：AC1-a..e + AC2-d 共 6 红） |
| 负控/回归锚 | `packages/namespace-registry/test/issue-437-lease-array-e2e-control.test.ts` | C1–C7（7 tests） | **7 green**（旧实现亦绿） |
| 共享夹具 | `packages/namespace-registry/test/issue-437-lease-array-e2e-fixture.ts` | seed/registry 装配/污染注入/读计数/诊断与读取助手（非测试入口，零 vitest 依赖） | 供两侧与探针消费 |
| 探针（证据） | `wiki/raw/task_issue-437_sa6_capability_probe.mts` | G0/G1 + P1..P5（32 项） | exit 0（32/32） |

| AC | 契约组 |
|---|---|
| AC1 行为变化（污染数组写照常成功；触达面外不发现） | AC1-a..e（判别组，旧实现红） |
| AC2 不变量（零写入/issue 路径/越界/空载荷/O(k)） | AC2-a..d + C4/C5 |
| AC3 union 数组目标端到端行为与性能路径不变（仍全量边界校验） | C1–C3 + C7 + AC2-d 的 legacy 对照腿 |
| AC4 诊断烟测（committed update bytes 形态不变） | AC4-a/b |
| AC5 复制烟测（fast path 提交经 replication apply 对端收敛，无协议面变化） | AC5-a/b + C6 |
| AC6 根 `pnpm typecheck` / `pnpm test` 绿 | §13 |

### 12.4 契约纪律

- 零 skip/only/todo、零 env override、零 fallback、零吞错、零软化断言；
- 断言只观察运行时行为（lease 判别联合、issue message/path、`readData` 逻辑值、owned update
  字节与收敛、诊断 record/carrier、session 状态面），**零源码字符串断言**；
- 污染注入统一经 replication apply（trusted raw seam），fixture doc 引用只用于基态快照/oracle；
- 期望值来源：现行实现冻结常量（域 message/path、union 仲裁 message、记录键集）或机制性
  oracle（同基态重放、空 doc 不物化、peer apply/diff 定点、A/B 闸门对照）；
- 测试文件位于仓库真实发现面（`vitest.config.ts` include `packages/*/test/**/*.test.ts`），
  经根 `pnpm test` 收集（§14）。

## 13. Red/green or baseline evidence

| 证据 | 命令 / 文件 | 结果 |
|---|---|---|
| pre-contract 根 typecheck | `pnpm typecheck`（`artifacts/sa6-issue437-head-typecheck.log`） | **exit 0**（15 包，`TYPECHECK_EXIT:0`） |
| pre-contract #436 契约（语义已实现） | `vitest run packages/doc-runtime/test/issue-436-array-fastpath-{contract,control}.test.ts` | **2 files / 25 tests passed** |
| HEAD 聚焦（契约 + 负控） | `vitest run packages/namespace-registry/test/issue-437-lease-array-e2e-{contract,control}.test.ts`（`artifacts/sa6-issue437-head-focused.log`） | **20/20 passed**（13 contract + 7 control），Type Errors: no errors |
| HEAD 复跑稳定性 | 5 轮（`artifacts/sa6-issue437-head-stability-{1..5}.log`） | 每轮 **20/20 green** |
| 旧实现（7407ce0）聚焦 | 基线 worktree 同一命令（`artifacts/sa6-issue437-baseline-focused.log`） | **6 failed / 14 passed**；红集合 = AC1-a..e + AC2-d |
| 旧实现稳定性 | 3 轮（`artifacts/sa6-issue437-baseline-stability-{1..3}.log`） | 每轮 6 red / 14 green；红集合（去时长）md5 `762f1f30eeb591cfb4ff033ff30eac95` 逐轮相同 |
| 探针（缺口 + 目标可达 + 反证） | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-437_sa6_capability_probe.mts`（`artifacts/sa6-issue437-probe.log`） | **exit 0**；32/32 命中，`failures=0` |
| 覆盖清单（能力缺口） | `artifacts/sa6-issue437-coverage-census.log` | 起点 HEAD：lease 面 array-* **0 件**；本票新增 3 件 |
| post-contract 根 typecheck | `pnpm typecheck`（`artifacts/sa6-issue437-post-typecheck.log`；契约/夹具/负控在位） | **exit 0**（`TYPECHECK_EXIT:0`；registry 包 tsconfig 只含 `src/**`，测试面由 vitest 收集/类型检查） |
| 测试源全程序 typecheck | `tsc -p tsconfig.typecheck.json --noEmit`（含 `packages/*/test/**`；`artifacts/sa6-issue437-typecheck-tests.log`） | **exit 0**（`WIDE_TSC_EXIT:0`；契约/夹具零 TS 噪声） |
| post-contract 根 test | `pnpm test`（`artifacts/sa6-issue437-post-root-test.log`） | **466 files / 5667 tests 全绿**，Type Errors: no errors，`TEST_EXIT:0`；两新文件被真实发现（日志 L377 / L646：13 + 7 tests） |

**绿色判据（全部命中）**：契约 13/13、负控 7/7、探针 exit 0（32/32）、根 `pnpm typecheck` exit 0、
测试源全程序 typecheck exit 0、根 `pnpm test` 466 files / 5667 tests 全绿。

**旧实现红因逐条（稳定 3 轮）**：AC1-a..e 五条（行为变化尚未接线）+ AC2-d 一条（O(k) 未解耦）：
- AC1-a `{message:"类型不匹配：期望 number，实际 string", path:["items",0]}`（例）；
- AC2-d `fast 轨读计数应 O(k)（≤8），实际 127`（n=64；旧实现整数组 walk）。

**根 `pnpm test`（AC6）**：`artifacts/sa6-issue437-post-root-test.log` —— **466 files / 5667 tests
全绿**、Type Errors: no errors、exit 0；本票新增两文件在真实发现面（`packages/*/test/**/*.test.ts`）
被收集执行（`issue-437-lease-array-e2e-contract.test.ts` 13 tests、`…-control.test.ts` 7 tests），
无第 4 方回归。

## 14. Runner trigger evidence

- 真实入口：根 `vitest.config.ts` `include: ['packages/*/test/**/*.test.ts', …]`；
  两个测试文件路径匹配该 glob；根 `pnpm test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`。
- 显式入口实跑（聚焦）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run <两个路径>`
  → `2 passed (2)`，`20 passed (20)`；基线 worktree 同一入口 → `6 failed | 14 passed`。
- 发现性（实测）：`artifacts/sa6-issue437-post-root-test.log` L377 / L646 分别出现两文件 run 行（13 / 7 tests），
  根跑批 466 files / 5667 tests 全绿、exit 0。
- 无 `describe.skip`/`it.only`/`it.todo`；无环境变量分支；无测试侧 try/catch 吞错。

## 15. Unknowns and blockers

- **无阻断项**：能力缺口可证、契约可执行、入口真实、旧实现红灯在正确原因上。
- 残余边界（明示不主张已覆盖，属 smoke 范围外的扩展）：
  1. **线级（ws transport）复制烟测**：AC5 在 `ReplicationSession.applyRemoteUpdate` 面立法
     （ADR 0033 明文「复制协议零改动」；owns-update/diff/apply 即协议承载物）。若 owner 要求
     wire-frame 级烟测，可在 `packages/ws-replication`/`apps/yjs-server` 面另开用例；
  2. **并发/多写者**：本票为单写者 smoke，不含并发数组写竞争（既有 #436 面亦未覆盖）；
  3. **大 n 性能**：lease seam 以 n=64 的元素读计数作结构性代理（AC2-d/C7）；
     更大规模（n∈{512,4096,10⁵}）的软证据由 #436 doc-runtime 面承担（ADR 决策 6）；
  4. **AC2「空批量 noop」语义**：按 lease seam 可观察事实定案为「空载荷形状拒绝不变」，
     恒等 accept 面引 #435 B6（§2/§11）。
- Owner comment 面：REST issue-comment read `[]` —— 无未决 owner 需求待澄清。

## 16. Temporary diagnostics cleanup

| 临时物 | 处置 | 证据 |
|---|---|---|
| `.worktrees/issue-437-baseline`（旧实现对照 worktree，含测试副本） | 证据采集后删除副本 + `git worktree remove --force` | 收尾 `git worktree list` 仅剩主仓与任务 worktree；`.worktrees/` 空 |
| 临时 debug 测试 `packages/namespace-registry/test/zz-issue437-debug.test.ts` | 已删除（ROOT 导航调试用） | `git status` 无该文件 |
| 生产实现改动 | **零**（无任何 `packages/*/src/**` 改动；无 git stash/patch/临时改语义） | `git diff` 空；`git status --short` 只含新增测试/fixture/探针/证据/报告 |
| 后台命令 | 全部受控前台/后台 job 已收敛（无 nohup/setsid/PID 文件；无残留服务） | 会话 job 状态；`git worktree list` |
| 证据日志 | 保留 `artifacts/sa6-issue437-*.log`（仓库既有 SA6 证据惯例） | 见 §13 清单 |
| 冻结产物指纹（证据对文件内容可追溯） | 契约 `62de8c3109d5bce2dffe328034e2129c`；负控 `34f5003938b3db5a3b1c8f97a9c4f034`；夹具 `9fa5995f24833b96ec848ca654ccb1dc`；探针 `3b647b42dda08554d679efacbbb42674`（md5） | `artifacts/sa6-issue437-cleanup-check.log` |

**结论一句话**：#437 的能力缺口 = ADR 0033 语义已在 #435/#436 落地但**最高 seam（lease）零回归
立法**；本报告以 lease seam 13 条契约 + 7 条负控把行为变化（污染写照常成功、O(k) 解耦）与不变量
（零写入/issue 路径/越界/空载荷/union 双轨/诊断形态/复制收敛）钉死，旧实现基线在判别组
6 红（legacy 响亮拒绝 + 读计数 ∝ n，稳定 3 轮），HEAD 全绿（20/20，稳定 5 轮），探针 32/32，
生产零改动。
