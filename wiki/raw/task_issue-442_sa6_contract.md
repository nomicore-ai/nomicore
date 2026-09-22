# SA6 诊断与验收契约 — issue #442：lease 端到端 Record/parent 行为钉死（ADR 0034）

状态：**approve**（能力缺口 = lease 最高 seam 的回归覆盖面缺口，已可运行证据化；验收契约 34 条
（契约 30 + 负控 4）可执行、判据可观察、红灯/绿面由 pre-#441 基线实测判别）
HEAD：`c42fb470fb3e5f67bc3ea2abc3720e03dfdb3963`（worktree 分支 `mabf/issue-442`；含 #441
实现提交 `61778bca5ce18ea68147b30cefa15e9f59961466` `feat(doc-runtime): add record mutation fast path`
与其合入 `c42fb47` Merge PR #458）
基线（旧实现）：`3fd6aa8b659420fd63d07b051139fe5f279556b8`（detached worktree
`.worktrees/issue-442-baseline`，证据采集后已移除）
写面：**生产实现与交付测试零改动**（dispatch 明示「Do not implement code or tests」）——本轮只新增
探针 `wiki/raw/task_issue-442_sa6_capability_probe.mts`、本报告与 `artifacts/sa6-issue442-*.log`；
`git status` 中 `packages/**` 无任何变更（§16）

---

## 1. Task type and inputs

- **任务类型**：**feature**（能力缺口 = **验证覆盖面缺口**；本票「不改实现，只把新语义在最高 seam 上
  立法成回归测试」——brief「What to build」原文）。**不虚构 Bug 根因**：HEAD 上 ADR 0034 行为已由
  #441 交付且逐条正确（§5 探针 target 31/31），缺口是这些用户可见行为在 **lease `mutateData`
  seam** 没有任何回归锚。
- **读了什么**（固定位置 / 前序证据）：

| 输入 | 位置 | 用途 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-442.md`（untracked） | issue 正文：Parent=PR #438、Task Type=feature、What to build、AC1–AC7、Blocked by #441、Comments 空 |
| 母法 | `docs/adr/0034-record-and-parent-elementwise-validation.md` | 决策 1（Record set/delete 逐 entry fast path + 闸门 + 永久双轨 + 值位 union 不阻断）、2（封闭对象 delete 静态判定）、3（S9 收窄）、4（触达面收窄）、5（立法）、6（与 0033 排序） |
| 前置母法（同构先例） | `docs/adr/0033-elementwise-yarray-mutation-validation.md`、`packages/namespace-registry/test/issue-437-lease-array-e2e-*.ts`（含 fixture 524 行） | 本票的**结构模板**：lease 最高 seam、raw replication 污染注入、结构性读计数代理、诊断/复制烟测 |
| #441 契约（前序红面） | `wiki/raw/task_issue-441_sa6_contract.md`、`packages/doc-runtime/test/issue-441-record-fastpath-{contract,control}.test.ts`、`...-fixture.ts`、探针 `wiki/raw/task_issue-441_sa6_capability_probe.mts` | 目标行为期望与逐字 message/path 的事实源；#441 面（doc-runtime 接线 + S9）本票**不重复立法** |
| #441 设计/实现 | `wiki/raw/task_issue-441_design.md`、`61778bc` diff（`mutation-local.ts` +76/−11、`mutation.ts` +21/−11） | HEAD 上 fast path 的落点与 S9 收窄（`VerifyPlan.install-facts`） |
| 词汇/纪律 | `CONTEXT.md`（逐 entry 例外 / 触达面收窄）、`packages/namespace-registry/AGENTS.md`、`packages/doc-runtime/AGENTS.md` | lease 是公共最高 seam；registry 测试经真实 Registry testing seam；零写入纪律 |
| Runner | `vitest.config.ts`、根 `package.json` | 发现规则与根 gate 命令（§14） |
| **缺失输入** | `task_issue-442_design.md` / `_relevant_decisions.md` / `_conflict_report.md` / SA8 门 / 既有 SA6 报告 / 既有 #442 测试 | **均不存在**（iteration 0；`ls wiki/raw` 核对）。替代约束面见 §3；不影响契约可执行性 |

## 2. Owner comment mapping

- 维护者 REST issue-comment read 返回 `[]`（Host 明文：`Current owner-comment requirements: none`）；
  issue 正文 Comments 段为空。**无 owner 附加要求**。
- 唯一需求面 = 简报 AC1–AC7 + ADR 0034 决策 1–6；逐条映射见 §12.4（AC → 契约组 → 探针 ID）。

## 3. SA8 constraints

#442 无 SA8 工件（iteration 0，§15-1）。可用的规范约束面（逐条落实位置）：

| 约束源 | 内容 | 落实位置 |
|---|---|---|
| 简报 What to build | 经 lease `mutateData` 的**端到端**测试；**不改实现**；把新语义在最高 seam 立法成回归测试 | §12 契约文件路径与绑定点；§16 生产零改动 |
| ADR 0034 决策 1 | 闸门：非 union Record 位走 fast path；union map 位永久 legacy；**Record 值位 union 不阻断**（entry 整值替换） | 契约 A1–A11、U3/U4、V1–V3；负控 C1–C3 |
| ADR 0034 决策 2 | 封闭对象 delete 静态判定：必填且非 unknown → 拒；optional ∨ unknown 标量 → 允许；`has` 拒 no-op 不变 | 契约 A6–A8、B4–B6；负控 C4 |
| ADR 0034 决策 4 | 触达面 = map/父载体 + 目标键位；触达面外污染不阻断、不修复；触达面内载体位仍响亮拒绝 | 契约 A1–A11；负控 C1/C4 |
| ADR 0034 决策 5 | Record 合法 ⟺ 逐键值合法；禁止 map 级约束特判 | 契约 B1–B8（逐字域规则） |
| ADR 0034 后果节 | 验证面含 **doc-runtime fast/legacy 双轨、零写入、S9 收窄、public-surface guard**（#441 面）+ 根 gates | 本票不重复 doc-runtime/S9 面；补 lease 可见面（含诊断与复制烟测） |
| 简报 AC4/AC5/AC6 | 值位 union fast path、诊断 committed update bytes 记录形态、复制收敛/协议面不变 | 契约 V3、E1–E2、R1–R3 |
| #437 lease 契约纪律 | 真实 Registry testing seam → 生产 Runtime 装配 → `lease.mutateData`；污染只经 `session.applyRemoteUpdate`；断言只经 lease 面；读计数为机器无关结构性代理 | §12.4 纪律 + fixture 规格 |
| `packages/namespace-registry/AGENTS.md` | 测试面经公共入口 + explicit testing surface；lease 是独立 caller capability | fixture 只消费 `@nomicore/namespace-registry`（+`/testing`）、复制 session 公共面、诊断包公共面 |
| 测试纪律（SA6） | 零 skip/only/todo、零 env override、零 fallback、零吞错、零源码字符串断言；断言只观察运行时行为 | §12.4 |

## 4. Environment and baseline

| 项 | 值 / 命令 | 证据 |
|---|---|---|
| 运行时 | node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、typescript `5.9.3`、tsx `4.23.12`、yjs `13.6.32` | 本会话实测 |
| 依赖 | `pnpm install --offline --frozen-lockfile`（store 命中 65 reused，458ms，零网络，exit 0） | 本会话 |
| 服务/网络 | 零（内存 persistence、无端口、无长驻进程） | — |
| pre-contract 语义面 | #441 doc-runtime 契约 18/18 绿 + 负控 27/27 绿；#437 lease 契约 13/13 绿 + 负控 7/7 绿 ⇒ **4 files / 65 tests passed**，Type Errors: no errors，exit 0 | `artifacts/sa6-issue442-head-focused-441-437.log` |
| pre-contract 根 typecheck | `pnpm typecheck` → **exit 0**（15 包 tsconfig 全过） | `artifacts/sa6-issue442-pre-typecheck.log`（`TYPECHECK_EXIT=0`） |
| pre-contract 根 test | `pnpm test`（`vitest run --typecheck`） | **471 files / 5757 tests passed**，`Type Errors: no errors`，exit 0（`artifacts/sa6-issue442-pre-test.log`，`TEST_EXIT=0`） |
| 旧实现基线 | detached worktree `.worktrees/issue-442-baseline` @ `3fd6aa8`（#440 已合、#441 **未**合；pnpm install offline 463ms）；采集后已移除 | §16 |

**基线选择依据**：`git diff 3fd6aa8 HEAD -- packages/` 恰 = `doc-runtime/src/mutation-local.ts` +
`mutation.ts`（#441 fast path 接线）+ #441 测试 ⇒ `3fd6aa8` 是「ADR 0034 行为变化在**任何 seam**
尚未生效」的最近旧实现面（简报 Blocked by #441 的语义）。更早提交会移除 #440 vfsl 接缝，红因将混入
「接缝缺失」而非本票目标行为差异，故不选。`pnpm-lock.yaml` / `package.json` / `vitest.config.ts`
在两修订间**逐字节相同**（`git diff --stat` 空）⇒ 基线复跑无环境变量。

## 5. Positive reproduction（能力缺口，逐条可运行）

探针（可执行证据，非测试入口）：

```
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
  wiki/raw/task_issue-442_sa6_capability_probe.mts            # target 面
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
  wiki/raw/task_issue-442_sa6_capability_probe.mts --baseline # 旧实现面
```

### 5.1 G0 — 能力缺口：lease seam 零 Record/parent 语义立法

`artifacts/sa6-issue442-coverage-census.log`（`git grep` tracked 面）+ 探针复核：

| 面 | ADR 0034 语义断言（逐字 message/path/触达面/行为变化） | 说明 |
|---|---|---|
| vfsl（#440） | `issue-440-elementwise-entry-{contract,control,fixture}` | 逐 entry 接缝面 |
| doc-runtime（#441） | `issue-441-record-fastpath-{contract,control,fixture}`（45 tests） | 接线/S9/成本面 |
| **lease（namespace-registry）** | **0 件** | 既有 `mutateData` 载荷分布：`set` 156 / `delete` 9 / `array-insert` 13 / `array-delete` 17，**无 Record/parent 的 raw 污染判别用例**；`触达面` 标记仅 #437（数组）与 `registry-phase5-replication-session-red`（会话面），非 ADR 0034 |

⇒ 用户可见行为（污染写、触达面收窄、issue 路径、值位 union 快轨、诊断记录形态、复制收敛）在
**最高 seam 无任何回归锚**：后续任一演进（Runtime 装配、plain-data 快照、诊断/复制接线）造成
语义漂移时，根 gate 不会显形。

### 5.2 P — 目标行为在 lease seam 可达且逐条正确（HEAD）

`artifacts/sa6-issue442-probe-head.log`：**exit 0，31/31 命中，failures=0**（A1–A11、B1–B8、
U1–U4、V1–V3、E1–E2、R1–R3）。关键实测（逐字，供契约冻结）：

| ID | 场景（HEAD 实测） | 结果 |
|---|---|---|
| A1 | `tasks` 兄弟 entry raw 污染 `'oops'` → `set ['tasks','t3']` | `ok:true`；污染保留 `'oops'`；恰 1 个 update 事件；`tasks/t3={title:'t3',qty:3}` |
| A2/A3 | 同污染 → `delete ['tasks','t0']` / `delete ['tasks','t9']`（污染键自身） | 均 `ok:true`，恰 1 update |
| A4/A5 | 兄弟 entry 值非法（`qty:'x'`）/ 兄弟键违约（`codes['nope']`）→ 目标键写 | 均 `ok:true`，污染未修复 |
| A6/A7 | `obj.deep` raw 污染 → `delete ['obj','opt']` / `delete ['obj','unk']` | 均 `ok:true`，恰 1 update |
| A8 | 同污染 → `delete ['obj','req']` | `ok:false`，**`缺少必填字段 "req"`，path `['obj','req']`**（静态判定，非父值读取） |
| A9/A10/A11 | 值位 union（`blobs`）/ 深层 Record（`outer.inner`）/ 批量信封 | 均 `ok:true`；批量 = 单事务单 update |
| B1 | `set ['tasks','t9'] = {title:'x',qty:'y'}` | `类型不匹配：期望 number，实际 string`，path `['tasks','t9','qty']`，零写入零 update |
| B2 | `set ['codes','nope']` | `Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/`，path `['codes','nope']`，零写入零 update |
| B3/B6 | `delete ['tasks','zz']` / 重复 delete `obj.opt` | `delete 目标键不存在（拒绝 no-op）`，path `['tasks','zz']` / `['obj','opt']` |
| B4/B5 | `delete ['obj','req']` / `['obj','unk']` | 静态拒绝 `缺少必填字段 "req"` / 允许（`unk` 消失） |
| B7 | `ROOT.tasks` 本身 raw 置为 plain → `set ['tasks','t3']` | `Yjs 载体错位（ROOT）：期望 Y.Map，实际 plain value`，**path `[]`**，零写入零 update |
| B8 | 深层非法新值 | path `['outer','inner','n2','qty']`（跨深度 rebase 正确） |
| U1 | union map 位（`maybe`）污染 → `set ['maybe','m2']` | `ok:false`（`Yjs 载体错位（ROOT.mz）`，path `['mz']`），零写入零 update |
| U2 | union map 位干净 set/delete | 均 `ok:true` |
| U3 | 成本（n=64）：`tasks` set vs `maybe` set | `tasks`：**valueReads=1 / presenceReads=1**；`maybe`：**valueReads=514**（∝ n） |
| U4 | `tasks` set（n=64 vs n=256） | **1/1 与 1/1**（与 n 解耦） |
| V1/V2 | 值位 union（`blobs`）两支成员接受 / 非法值拒绝 | `ok:true`；非法值：`联合成员 1/2：缺少必填字段 "qty"` path `['blobs','b2','qty']` 等两 issue，零写入 |
| V3 | `blobs` set（n=64 vs n=256） | 1/1 与 1/1（值位 union 不阻断 fast path） |
| E1 | 诊断：`set ['tasks','t3']` | 恰 1 条 `root-mutation` attempt；`stage='transaction'`、`source={kind:'local'}`、`committed effect:update`、inline carrier（`yjs-update-v1`，`payloadLength=43`，`crc32c=be9fa1fe`）；carrier 重放 = 真事务增量；空 doc 不物化 ROOT |
| E2 | Record 与标量写的记录/carrier 键集 | 逐键同构：record `[…]×10`、carrier `[base64,crc32c,format,payloadLength,storage]` |
| R1 | hub Record 写 → owned update → peer apply | 收敛（peer 读到同值）；diff 定点稳定；session `open`/`hub-to-peer`/`localRole=peer`/`remoteInstanceId=hub-442` |
| R2 | owned update 形态 | 最小增量（空 doc 不物化 ROOT）；一次提交恰一 owned update；第二笔 → 2 |
| R3 | 污染在场时写 + 复制 | 对端既得新值又**保留污染**（非整 map 重写） |

### 5.3 S — 旧实现（`3fd6aa8`）在判别断言处失败

`artifacts/sa6-issue442-probe-baseline.log`（`--baseline`）：**exit 0，31/31 命中旧语义期望**。
判别组实测（旧语义，逐字）：

| ID | 旧实现实测（`3fd6aa8`） | 目标（HEAD） |
|---|---|---|
| A1/A2/A3/A11 | `ok:false`；`Yjs 载体错位（ROOT.t9）：期望 Y.Map，实际 plain value`，path `['t9']`（map 相对）；零写入零 update | `ok:true` + 污染保留 + 恰 1 update |
| A4 | `ok:false`；`类型不匹配：期望 number，实际 string`，path `['tasks','t9','qty']` | `ok:true` |
| A5 | `ok:false`；`Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/`，path `['codes','nope']` | `ok:true` |
| A6/A7 | `ok:false`；`Yjs 载体错位（ROOT.deep）`，path `['deep']` | `ok:true` |
| A8 | `ok:false`，但理由 = **父值载体错位**（`ROOT.deep`，path `['deep']`） | `ok:false`，理由 = **静态** `缺少必填字段 "req"`，path `['obj','req']`（**message 级判别**） |
| A9 | `ok:false`；`Yjs 载体错位（ROOT.b9）`，path `['b9']` | `ok:true`（值位 union 不阻断） |
| A10 | `ok:false`；`Yjs 载体错位（ROOT.n9）`，path `['n9']` | `ok:true` |
| U3 | `tasks` n=64：**259**（∝ n） | **1/1**（与 n 解耦） |
| U4 | **259（n=64）/ 1027（n=256）**（∝ n） | 1/1 与 1/1 |
| V3 | **259 / 1027**（∝ n；值位 union 亦整 map 提取） | 1/1 与 1/1 |
| R3 | `ok:false`（连带拒绝），零 owned update | `ok:true` + 对端收敛且保留污染 |

**不变量组在旧实现逐字相同**（B1–B8、U1/U2、V1/V2、E1/E2、R1/R2 —— 全部 31/31 命中各自期望）
⇒ 判别组的红/绿差异**只能**由「ADR 0034 闸门分流与触达面收窄是否接线」这一单一变量解释。

## 6. Negative control（恒绿；排除环境/夹具/oracle/入口伪红）

| 对照 | 事实 | 作用 |
|---|---|---|
| C1 union map 位（`maybe`）同污染同 op | 旧新两面均 `ok:false` + 逐字 `载体错位` + 零写入零 update（§5.2 U1 / §5.3） | **A 组 `ok:true` 非恒真**：同一污染在永久 legacy 轨照旧拒绝 ⇒ 判别断言对闸门敏感 |
| C2 touched-surface 载体位（`ROOT.tasks` 本身 plain） | 旧新两面均 `ok:false`，逐字 `Yjs 载体错位（ROOT）…`，path `[]`，零写入 | fast path 未放松载体检查；「触达面收窄」边界精确可判 |
| C3 域规则逐字（B1/B2/B3/B4/B6） | 旧新两面逐字同 message/path + 零写入 | 断言非「放行一切写」伪绿 |
| C4 值位 union 非法值（V2） | 旧新两面同两 issue + 零写入 | union 仲裁仍在 |
| C5 成本代理逃逸 | `maybe`（n=64）valueReads=**514** 旧新相同；`keys/values/entries/forEach/toJSON/Symbol.iterator` 均按 `size` 计入 | 计数代理不因换批量出口失明；fast 轨 1/1 不是「计数盲区」 |
| C6 字节 oracle 敏感性 | E1 carrier payloadLength=43、crc32c=`be9fa1fe` 在旧新两面**逐字节相同**；重放 = 真事务增量；空 doc 不物化 ROOT | 记录/增量形态不被接线改变（AC5 不变量成立） |
| C7 入口自证 | 干净写全部 `ok:true`（A2/A6/A7/U2/V1/E1/E2/R1/R2）、非法输入全部逐字拒绝（B1–B4/V2） | 契约场景非夹具错误、入口错误或「一切拒绝」 |

**为何判别组不可能是伪红**：旧实现的失败理由**恰好**是触达面外污染造成的父值/整 map 提取
（`载体错位`/兄弟 `类型不匹配`/兄弟键 Pattern），而非环境、超时、类型或入口问题（探针纯同步、
零网络；两侧均 exit 0 且不变量组全绿）。

## 7. Stability, scale and timing

- 复现率：HEAD 侧 **7 轮 × 31/31**（`sa6-issue442-probe-head.log` + `-head-run{1..3}` +
  `-head-stab{1..3}`）；基线侧 **4 轮 × 31/31**（`-probe-baseline.log` + `-baseline-stab{1..3}`），
  逐轮同计数、同期望集合（exit 0）。
- 规模面（机器无关、结构性）：Record/值位 union `n=64` 与 `n=256` 两档读计数；union legacy
  `n=64`（514；任务侧 259/1027）。**不钉毫秒阈值**（ADR 0034 决策 6 为软验收）。
- 时序/并发条件：全部断言同步纯调用（唯一沉降 = 有界 `setImmediate` 轮，零 `setTimeout` 竞猜）；
  零真实时钟（固定 `now`）、零随机源（128-bit 计数序列）、零网络、零并发；污染注入经
  `session.applyRemoteUpdate`（trusted raw 面）+ 固定 clientID（hub 4242 / remote 999999）⇒
  合并结果确定（污染一律写**新键**，除 `obj.deep`/`blobs.b1` 同键覆盖——clientID 决胜确定）。
- 诊断/复制烟测的异步扇出用有界 `setImmediate` 沉降（400 轮上限，实测 < 10 轮）。

## 8. Capability gap chain（Feature：证明能力缺失，不虚构 Bug 根因）

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1 症状 | ADR 0034 的用户可见行为变化（污染 map 写转成功、触达面外污染不连坐、静态 delete 判定）与不变量（issue 路径/零写入/值位 union 快轨/诊断记录/复制收敛）在 **lease `mutateData`** 无任何回归锚 | §5.1 覆盖普查（lease 面 0 件）；§5.2/§5.3 目标/旧实现两面行为差异 | 高 |
| 2 直接机制 | 现有 ADR 0034 立法面止于 `packages/vfsl/test`（接缝）与 `packages/doc-runtime/test`（接线），二者都不经过 `namespace-registry` lease 装配、`plain-data` 快照、诊断发射与复制 session 扇出 | §5.1 清单 + 既有 `issue-437`（数组）在 lease 面立法的先例 | 高 |
| 3 触发条件 | 任何后续演进（runtime 快照/装配、lease 代理、诊断 emitter、replication 写槽）造成 Record/parent 语义漂移 | 本票不实现修复；缺口的后果面 = 「漂移无红灯」 | 中高（推断，非实测漂移） |
| 4 最深根因（=能力缺口） | `packages/namespace-registry/test`（最高 seam）缺 3 件套：共享 fixture + 契约测试 + 负控测试 | 目录核对（无 `issue-442-*` 文件）；§5.1 | 高 |
| 5 放大因素 | lease seam 是用户/宿主实际消费面（宿主只经 lease 写）；`mutateData` 还叠加 envelope 形状门、批量折迭、诊断 pump、复制 owned update 扇出等**上层行为**，doc-runtime 面断言覆盖不到 | §5.2 R/E 组：这些面在 lease seam 才可观察 | 高 |
| 6 未证实假设 | 「语义漂移一定会发生」——本报告不主张；只主张「发生则无红灯」 | §5.1 | 高（不夸张） |
| 7 排除项 | 「HEAD 行为未实现/不正确」；「测试已存在」；「环境/夹具/入口伪红」；「旧语义是 Bug」 | §5.2 31/31；§5.1；§6；§5.3（旧语义 = ADR 0034 决策 4 明文取代的 phase-1 行为，非缺陷） | 高 |

## 9. Causal experiments（最小因果实验 / 反证）

| id | 实验 | 结论 |
|---|---|---|
| E1 | 控制变量（修订）：同一探针、同一夹具、同一断言集合，仅 `--baseline` 切换修订（`3fd6aa8` vs HEAD；包与配置逐字节相同） | 判别组 11 项 + 成本 3 项 + R3 翻面，其余 17 项逐字不变 ⇒ 差异由 #441 单变量（闸门分流）解释 |
| E2 | A/B 对照（轨）：同一污染 + 同一 op 在 union map 位（C1）照旧拒绝，在非 union Record 位（A1）成功 | AC1 的 `ok:true` 断言对闸门敏感，非恒真 |
| E3 | 反证（成本代理逃逸）：`maybe` n=64 的 514 次 entry 读覆盖 `get`/`keys`/`values`/`entries`/`forEach`/`toJSON`/`Symbol.iterator` 全出口；fast 轨 1/1 | 读计数不是「漏计」造成的假 O(k) |
| E4 | 反证（字节 oracle）：E1 carrier 在旧新两面 payloadLength/crc32c **相同**；重放同基态收敛、空 doc 不物化 | AC5 记录形态不变量成立，且断言不是空转 |
| E5 | 判据差异（A8）：污染在场时必填 delete 的**理由**从「父值载体错位」变为「静态必填」 | 触达面收窄在 message 层也可判（不止 ok 位） |
| E6 | 入口/夹具自证：干净写全绿 + 非法输入逐字拒绝（§6 C7） | 判别组红/绿不是「一切拒绝」或夹具缺陷 |
| E7 | 零写入纪律：A/B/U/R 组一切拒绝分支 `Y.encodeStateAsUpdate` 逐字节不变 ∧ update 事件/Owned update 为 0 | 「失败零写入」在 lease seam 独立成立 |

## 10. Impact surface

- **本票交付面（测试，非实现）**：`packages/namespace-registry/test/issue-442-lease-record-e2e-*.ts`
  3 文件（§12.2/12.3）；生产实现与既有测试**零改动**。
- **立法行为面**：非 union Record set/delete 与封闭对象 delete 的触达面行为、issue message/path、
  零写入、update 事件数、终态与复制收敛、诊断 attempt record/carrier 形态、值位 union fast path、
  union map 位永久 legacy（含成本 ∝ n）。
- **不变面（负控）**：union map 位/union 穿越行为、触达面内载体位拒绝文案与 path、域规则逐字
  （no-op/键 Pattern/值 schema/必填）、批量原子语义、`set([])` 与数组轨（#436/#437 面）、公共导出面。
- **不重复立法面**：#441 doc-runtime 面（FA/FB/FC、S9 收窄、安装事实核、commit 字节）与 #440 vfsl
  接缝面由既有测试承担；本票只在其上加最高 seam 的用户可见回归锚。
- **风险面**：读计数是**结构性代理**（若未来实现经第三种整 map 出口逃逸计数，契约会失明）——
  已用 6 种出口全覆盖 + union 514 反证；契约同时以行为断言（A/B/U/V）成对，不单独承担判定。

## 11. Ruled-out hypotheses

| 假设 | 判定 | 依据 |
|---|---|---|
| 「HEAD 未实现 ADR 0034，需要本票修实现」 | **排除** | §5.2 target 31/31；#441 已合入（`61778bc` + `c42fb47`） |
| 「lease seam 已有等价回归测试，缺口语义」 | 排除 | §5.1 覆盖普查：`packages/namespace-registry/test` 0 件 ADR 0034 语义断言；`mutateData` 载荷分布无 Record/parent 判别用例 |
| 「旧实现（pre-#441）的红来自环境/夹具/入口」 | 排除 | 两面均 exit 0、同一夹具、不变量组逐字相同（§5.3/§6/§9 E1） |
| 「旧语义是 Bug，应修」 | 排除（非 Bug） | `3fd6aa8` 在 phase-1 契约下自洽（不变量组全绿）；ADR 0034 决策 4 明文取代「连带拒绝」 |
| 「union map 位也应走 fast path（AC3 可省）」 | 排除（反向） | ADR 0034 决策 1 明文永久 legacy；探针 U1 旧新两面均拒绝、U3 union ∝ n ⇒ 负控必须保持 |
| 「值位 union 的 Record 走 legacy」 | 排除 | §5.2 U3/U4 vs V3：值位 union 读计数 1/1 与 n 解耦（决策 1 明文） |
| 「S9 收窄需在 lease seam 重复立法」 | 排除（范围） | S9 是 doc-runtime 内部验证面（#441 FC/NB/NA 组已锚）；lease seam 无法区分重投影核，属 #441 面 |
| 「诊断记录形态会因 fast path 改变」 | 排除 | §5.2 E1/E2 + §6 C6：旧新 byte 级相同、键集同构 |
| 「复制协议面变了」 | 排除 | §5.2 R1/R2：owned update 最小增量、恰一事件、session 状态与方向不变 |

## 12. Acceptance contract and test paths

### 12.1 绑定点（观察面）

| ID | 绑定 | 冻结值 |
|---|---|---|
| B-1 | 唯一写入口 | `NamespaceLease.mutateData(envelope)`（单操作 + `{ops:[…]}` 批量信封），经 `createNamespaceRegistryForTesting` → `registry.open` 的真实生产 Runtime 装配 |
| B-2 | 读入口 | `lease.readData(path)` 的 `{ok,value,…}`；断言只经 lease 面取值（fixture doc 引用仅用于基态快照/字节 oracle） |
| B-3 | 污染注入 | `lease.openReplicationSession` → `session.applyRemoteUpdate(diff)`（trusted raw 面；对端固定 clientID 999999，新键插入） |
| B-4 | 行为锚 | A1–A11（触达面收窄：`ok` 位 + 污染保留 + 恰 1 update）；A8（message 级判别）；B1–B8（域规则逐字 + path rebase + 零写入） |
| B-5 | 成本锚 | live `Y.Map` entry 读计数（`get`/`has` 逐次，批量出口按 `size`）；fast 轨 ≤8 且 n 解耦；union legacy ≥ n |
| B-6 | 诊断锚 | `createBoundedMemoryDiagnosticLog`（`updateCapture:true`）→ `root-mutation` attempt record：`stage='transaction'`、`source={kind:'local'}`、`committed`、`effect='update'`、inline carrier（`yjs-update-v1`）；carrier 重放 = 真事务增量；与标量写键集同构 |
| B-7 | 复制锚 | `subscribeOwnedUpdates` / `applyRemoteUpdate` / `encodeDiff` / `encodeStateVector` / `getStatus`：对端 `readData` 收敛、diff 定点、session `open`/`hub-to-peer`/`localRole=peer`/`remoteInstanceId=hub-442`；owned update 最小增量 |
| B-8 | 零写入锚 | 拒绝分支：`Y.encodeStateAsUpdate(doc)` 逐字节不变 ∧ doc update 事件 0 ∧ owned update 0 |

### 12.2 交付测试文件（本票产品；本轮按 dispatch 未落盘，由实现期 SA 按此规格落地）

| 产物 | 路径 | 角色 |
|---|---|---|
| 共享 fixture（非测试入口） | `packages/namespace-registry/test/issue-442-lease-record-e2e-fixture.ts` | schema/seed/Registry testing seam 装配/`applyRawRemote`/`readAt`/`countMapReadsAsync`/诊断与复制助手；零 vitest 依赖（同 #437 先例） |
| 契约（30 tests） | `packages/namespace-registry/test/issue-442-lease-record-e2e-contract.test.ts` | A1–A11（AC1）、B1–B8（AC2）、U3–U4（AC3）、V1–V3（AC4）、E1–E2（AC5）、R1–R3（AC6） |
| 负控（4 tests，恒绿） | `packages/namespace-registry/test/issue-442-lease-record-e2e-control.test.ts` | C1 union map 污染照旧逐字拒绝（A/B 对照）、C2 union map 干净写可用、C3 union 成本 ∝ n、C4 触达面内载体位逐字拒绝 |

**Schema（fixture 冻结）**：

```
type Item = { title: string; qty: number & Int<0, 100> };
type Alt = { label: string; n: number & Int<0, 10> };
type ROOT = {
  n: number;                                        // 标量对照（诊断记录键集同构）
  tasks: Record<string, Item>;                      // 非 union Record（fast path 主面）
  codes: Record<string & Pattern<"^(id-[0-9]+)$">, Item>;  // 键 Pattern 面
  blobs: Record<string, Item | Alt>;                // 值位 union（仍 fast path）
  maybe: Record<string, Item> | { fixed: string };  // union map 位（永久 legacy）
  outer: { inner: Record<string, Item> };           // 深层 Record（path rebase）
  obj: { req: string; opt?: number; unk: unknown; deep: { d: string } };  // 封闭对象 delete 面
};
```

### 12.3 用例规格（ID → 断言 → 目标/旧实现期望）

| ID | 场景 | 断言（运行时行为） | HEAD 期望 | `3fd6aa8` 期望（判别） |
|---|---|---|---|---|
| A1 | sibling `tasks.t9='oops'` → set `tasks.t3` | `ok`；污染保留；update 事件数 +1；`tasks.t3` 逻辑值 | `ok:true` | `ok:false`（`载体错位`） |
| A2 | 同污染 → delete `tasks.t0` | `ok`；恰 1 update；键消失 | `ok:true` | `ok:false` |
| A3 | 同污染 → delete 污染键 `tasks.t9` | `ok`；恰 1 update；键消失 | `ok:true` | `ok:false` |
| A4 | sibling 值非法（`qty:'x'`）→ set `tasks.t3` | `ok`；污染未修复 | `ok:true` | `ok:false`（`类型不匹配`） |
| A5 | sibling 键违约 `codes.nope` → set `codes.id-2` | `ok`；违约键保留 | `ok:true` | `ok:false`（`不满足 Pattern`） |
| A6 | `obj.deep` 污染 → delete `obj.opt` | `ok`；`opt` 消失；`deep` 污染保留 | `ok:true` | `ok:false` |
| A7 | 同上 → delete `obj.unk` | `ok`；`unk` 消失 | `ok:true` | `ok:false` |
| A8 | 同上 → delete `obj.req` | `ok:false`；**逐字 `缺少必填字段 "req"`、path `['obj','req']`**；零写入 | 静态理由 | `载体错位` @ `['deep']` |
| A9 | `blobs.b9` 污染 → set `blobs.b2`（Item） | `ok`；恰 1 update | `ok:true` | `ok:false` |
| A10 | `outer.inner.n9` 污染 → set `outer.inner.n2` | `ok`；深层写入正确 | `ok:true` | `ok:false` |
| A11 | 同污染 → 批量 `{ops:[set t7, set t8]}` | `ok`；批内两键写入；单事务单 update | `ok:true` | `ok:false` |
| B1 | set `tasks.t9={title:'x',qty:'y'}` | 逐字 `类型不匹配：期望 number，实际 string`，path `['tasks','t9','qty']`；零写入零 update | 旧新同 | 同 |
| B2 | set `codes.nope` | 逐字 `Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/`，path `['codes','nope']`；零写入 | 旧新同 | 同 |
| B3 | delete `tasks.zz` | 逐字 `delete 目标键不存在（拒绝 no-op）`，path `['tasks','zz']`；零写入 | 旧新同 | 同 |
| B4 | delete `obj.req` | 逐字 `缺少必填字段 "req"`，path `['obj','req']`；零写入 | 旧新同 | 同 |
| B5 | delete `obj.unk`（unknown 标量） | `ok:true`；`unk` 消失 | 旧新同 | 同 |
| B6 | delete `obj.opt`，再 delete | 首删 `ok:true`；重复 → 逐字 no-op、path `['obj','opt']` | 旧新同 | 同 |
| B7 | `ROOT.tasks` 本身 raw plain → set `tasks.t3` | 逐字 `Yjs 载体错位（ROOT）：期望 Y.Map，实际 plain value`，**path `[]`**；零写入零 update | 旧新同 | 同 |
| B8 | 深层非法新值 | path `['outer','inner','n2','qty']`；零写入 | 旧新同 | 同 |
| U3 | n=64：`tasks` set 读计数；`maybe` set 读计数 | fast ≤8；union legacy ≥ n（valueReads=514） | 1/1；514 | 259；514 |
| U4 | `tasks` set：n=64 vs n=256 | 两侧 ≤8 且**相等** | 1/1 与 1/1 | 259 与 1027 |
| V1 | `blobs.b2`=Item / `blobs.b3`=Alt | 两支成员均 `ok:true` | 旧新同 | 同 |
| V2 | `blobs.b2={title:'x',n:5}` | 拒绝（联合成员 1/2 两 issue）；零写入 | 旧新同 | 同 |
| V3 | `blobs` set：n=64 vs n=256 | ≤8 且相等（值位 union 不阻断） | 1/1 与 1/1 | 259 与 1027 |
| E1 | 诊断：set `tasks.t3` | 恰 1 root-mutation attempt；stage/source/committed/effect/inline carrier/crc32c 形态；carrier 重放收敛；空 doc 不物化 | 旧新同（byte 相同） | 同 |
| E2 | set `tasks.t3` + set `n` | 两 record 键集与 carrier 键集逐键同构 | 旧新同 | 同 |
| R1 | hub set `tasks.t3` → owned update → peer | peer 值收敛；diff 定点；session 状态/方向/角色/远端 id | 旧新同 | 同 |
| R2 | 同上 + 第二笔 delete | owned update 最小增量（空 doc 不物化 ROOT）；1 笔=1 事件，2 笔=2 | 旧新同 | 同 |
| R3 | 污染在场 → set → 复制 | peer 收敛且保留污染；零整 map 重写 | `ok:true` + 收敛 | `ok:false`（连带拒绝） |
| C1 | `maybe.mz='oops'` → set `maybe.m2` | 逐字 `Yjs 载体错位（ROOT.mz）…`，path `['mz']`；零写入零 update | 旧新同 | 同 |
| C2 | `maybe` 干净 set/delete | `ok:true` | 旧新同 | 同 |
| C3 | `maybe`（n=64）set 读计数 | ≥ n（全量边界校验仍在） | 514 | 514 |
| C4 | `ROOT.tasks` 载体位（同 B7）独立 A/B 对照 | 逐字拒绝、path `[]`、零写入 | 旧新同 | 同 |

**冻结值来源**：全部为 HEAD 运行时实测（§5.2）+ 旧实现实测（§5.3），非源码抄写。SA8/SA3 可自由
选择内部接线形态与文件名后缀，但 **ID 语义、断言集合、判别/不变量分组与冻结值不得改变**。

### 12.4 契约纪律与 AC 映射

- 零 skip/only/todo、零 env override、零 fallback、零吞错、零软化断言；断言只观察运行时行为
  （判别联合结果、issue message/path、`readData` 逻辑值、live `Y.Map` entry 读计数、update 事件与
  状态字节、诊断 record/carrier、复制 owned update），**不得 grep 源码/正则断言源码**。
- 污染注入统一走 `session.applyRemoteUpdate`（等价 trusted raw replication），不得在 lease 层直写
  live Y.Doc；篡改/污染后断言只经 lease 面读值。
- 负控文件必须独立于契约文件存在（A/B 对照），其失败即表示判别断言失去敏感性。

| 简报 AC | 契约组 | 探针证据 |
|---|---|---|
| AC1 行为变化：污染 map 写/删目标键转成功；封闭对象 delete 同理 | A1–A11 | §5.2 / §5.3 判别表 |
| AC2 不变量：键 Pattern/非法新值零写入 + issue 路径不变；delete 不存在键 no-op；必填 delete 拒、unknown delete 允许 | B1–B8 | §5.2 逐字证据 |
| AC3 union map 位端到端行为与性能路径不变（全量边界校验） | C1–C3（+U3 union 半） | U1/U3 两面相同 |
| AC4 Record 值位 union 仍走 fast path（正确且不经全量提取） | V1–V3 | U3/V3 读计数对比 |
| AC5 诊断烟测：committed update bytes 记录形态不变 | E1–E2 | 旧新 byte 级相同 + 键集同构 |
| AC6 复制烟测：fast path 提交经 replication apply 收敛、无协议面变化 | R1–R3 | owned update/diff 定点/session 状态 |
| AC7 根 `pnpm typecheck` 与 `pnpm test` 绿 | §13 | pre-contract 已测；实现期复跑 |

## 13. Red/green or baseline evidence

| 证据 | 命令 / 文件 | 结果 |
|---|---|---|
| 探针（HEAD 目标面） | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-442_sa6_capability_probe.mts`（`artifacts/sa6-issue442-probe-head.log`） | **exit 0；31/31 命中，failures=0** |
| 探针（旧实现面） | 同命令 + `--baseline`（baseline worktree @ `3fd6aa8`；`artifacts/sa6-issue442-probe-baseline.log`） | **exit 0；31/31 命中旧语义期望** |
| 稳定性 | `artifacts/sa6-issue442-probe-head-{run,stab}{1..3}.log`、`-probe-baseline-stab{1..3}.log` | 7+4 轮逐轮同计数（31/31） |
| 覆盖普查 | `artifacts/sa6-issue442-coverage-census.log` | lease 面无 ADR 0034 语义断言（0 件） |
| pre-contract 聚焦面 | `npx vitest run packages/doc-runtime/test/issue-441-*.test.ts packages/namespace-registry/test/issue-437-lease-array-e2e-*.test.ts`（`artifacts/sa6-issue442-head-focused-441-437.log`） | **4 files / 65 tests passed**，Type Errors: no errors，exit 0 |
| pre-contract 根 typecheck | `pnpm typecheck`（`artifacts/sa6-issue442-pre-typecheck.log`） | **exit 0**（15 包） |
| pre-contract 根 test | `pnpm test`（`artifacts/sa6-issue442-pre-test.log`） | **471 files / 5757 tests passed**，`Type Errors: no errors`，exit 0（零失败面） |
| 实现期绿色判据（AC7） | 新增 3 文件后复跑 `pnpm typecheck` / `pnpm test` | 契约 30 条 + 负控 4 条全绿；根 gates exit 0 |

基线复现步骤（证据采集后 worktree 已移除）：

```bash
git worktree add --detach .worktrees/issue-442-baseline 3fd6aa8
(cd .worktrees/issue-442-baseline && pnpm install --offline --frozen-lockfile)
cp wiki/raw/task_issue-442_sa6_capability_probe.mts .worktrees/issue-442-baseline/wiki/raw/
(cd .worktrees/issue-442-baseline && NODE_OPTIONS=--conditions=nomicore-source \
  pnpm exec tsx wiki/raw/task_issue-442_sa6_capability_probe.mts --baseline)
git worktree remove --force .worktrees/issue-442-baseline
```

**实现期红/绿口径**（本票 = 回归立法票）：
1. **落盘后（HEAD）全绿**：34 条测试在 HEAD 必须 34/34 通过（本报告 §5.2 已逐条实测可达）；
2. **判别性（旧实现必红）**：A1–A11（A8 为 message 级）、U3（fast 半）、U4、V3、R3 —— 在
   `3fd6aa8` 复跑时**必须失败**，且失败原因恰为「legacy 全量边界路径的连带拒绝 / 读计数 ∝ n」；
   证据 = §5.3（本报告探针 `--baseline` 实测）；
3. **不变量面（旧新同绿）**：B1–B8、V1–V2、E1–E2、R1–R2、C1–C4 在两面均通过。

**根 test 结果**（AC7 gate 面，pre-contract 实测）：`pnpm test`
（= `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`）→ **471 files 全过 /
5757 tests 全过**，`Type Errors: no errors`，exit 0（`TEST_EXIT=0`）。即本票起点全绿；实现期新增
3 个测试文件（30 + 4 条，其中 fixture 非测试入口）后必须保持 471 → 473 files、5757 → 5791 tests 全过。

## 14. Runner trigger evidence

- Runner：`vitest.config.ts` → `test.include: ['packages/*/test/**/*.test.ts', 'domains/*/test/**/*.test.ts',
  'apps/*/test/**/*.test.ts']`；`test.typecheck.include: ['packages/*/test/**/*.test-d.ts', …]`；
  根脚本 `pnpm test = NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`。
- 发现性实测：`npx vitest run packages/doc-runtime/test/issue-441-*.test.ts packages/namespace-registry/test/issue-437-lease-array-e2e-*.test.ts`
  实跑 **4 files / 65 tests**（含 lease 面 2 files / 20 tests）⇒ `packages/namespace-registry/test/issue-442-*.test.ts`
  路径命中同一 include 面；fixture 文件名不带 `.test.ts`（仅共享模块，不收集）。
- 探针在 `wiki/raw/**`，**不在** include 面：仅作可执行证据，不参与门禁；无自定义 runner、无
  `describe.skip`/`it.only`、无环境变量开关（`--baseline` 只是探针 CLI 参数，交付测试不使用）。

## 15. Unknowns and blockers

| 项 | 说明 | 处置 |
|---|---|---|
| 无 SA8 工件 | iteration 0；契约不绑定新公共导出/内部名形，只锚 lease 公共运行时行为 | SA8/SA3 可自由选择 fixture 文件名/内部助手形态；ID 语义与冻结值不变 |
| 交付测试本轮未落盘 | dispatch 明示「Do not implement code or tests」，SA6 权限面 = 探针/报告/证据 | 契约已精确到可执行规格（§12）；实现期按 §12.2/12.3 落盘即达成 AC7 |
| S9 收窄在 lease seam 不可观察 | 触达面外同事务篡改的重投影核属 doc-runtime 内部面（#441 FC/NB/NA 组已锚） | 不重复立法；如需 lease 面烟测，由 SA8 裁决（非本票 AC） |
| 读计数为结构性代理 | 若未来实现经未覆盖的整 map 出口逃逸，成本断言可能失明 | 已覆盖 6 种出口 + union 514 反证；且与 A/B/U/V 行为断言成对使用 |
| 软性能（毫秒） | ADR 0034 决策 6 明文不钉绝对时延 | 契约只用机器无关读计数；毫秒证据不纳入 |
| `obj.deep` / `blobs.b1` 同键覆盖污染 | 依赖固定 clientID（4242 vs 999999）的确定性决胜 | 夹具显式固定 clientID；其余污染一律新键插入（同 #437 纪律） |

## 16. Temporary diagnostics cleanup

- **生产实现零改动**：`git status --short` 显示 `packages/**`、`vitest.config.ts`、`pnpm-lock.yaml`、
  `package.json` 均无变更；新增面仅 `wiki/raw/task_issue-442_sa6_capability_probe.mts`、本报告与
  `artifacts/sa6-issue442-*.log`（Host 提供的 `wiki/raw/task_issue-442.md` 为既有 untracked 输入）。
- 临时诊断：基线路由 worktree `.worktrees/issue-442-baseline`（@ `3fd6aa8`）与其中的探针副本已在
  证据采集后 **`git worktree remove --force` 移除**；临时夹具诊断脚本 `wiki/raw/.tmp-442-u2.mts`
  已删除（其发现仅为夹具自身问题：union map 位 U2 的目标键名与默认 seed 键 `m0` 不一致、U3 的
  `maybe` 初值仅 1 条 entry 导致读计数 12 —— 修正为 `maybeN=64` 后得 514，结论已并入 §7/§9 E3，
  不依赖临时文件）。
- 无长驻服务、无后台进程、无 PID 文件、无端口占用、无 nohup/setsid；依赖安装为 offline store 命中
  （零网络）。根 `pnpm test` 后台 Job 在收尾前收敛（见 §13）。
- 报告为固定产物原位写入（本票 iteration 0，无既有报告/未提交测试需原位修订）。

---

## 附：本报告结论一句话

**approve**：ADR 0034 在 HEAD（`c42fb47`，含 #441 `61778bc`）已端到端正确——非 union Record 位与
封闭对象 delete 的污染写/删转成功（A1–A11）、域规则与 issue 路径逐字不变（B1–B8）、union map 位
永久 legacy 且读计数 ∝ n（C1–C3）、值位 union 仍 fast path（1/1 与 n 解耦）、诊断记录形态 byte 级
不变（E1/E2）、复制收敛且 owned update 最小增量（R1–R3）；但在**最高 seam（lease `mutateData`）
零回归锚**（覆盖普查 0 件），旧实现 `3fd6aa8` 在 15 条判别断言处按旧语义实测失败。本报告以
**契约 30 条 + 负控 4 条**的可执行规格（fixture/断言/冻结值/判别与不变量分组）把 AC1–AC7 固化为
可触发、可判别、可复跑的验收契约，供 SA8/SA9 消费。
