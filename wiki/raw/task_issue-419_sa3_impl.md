# SA3 Implementation Report

- Issue：#419「路由键契约 codec 守卫测试（spec #415 T1）」
- Dispatch：`sa-c6ed4ec2-4463-4843-aed9-22775471dd9a`（mabf-sa3，phase implementation，iteration 0）
  → 返工 dispatch `sa-60ce26d9-f96f-4d6a-809c-c583713c7d93`（iteration 1，F1 恢复）
  → dispatch `sa-1a8e7872-d37e-4c7b-b4f1-d570d580172a`（iteration 2：应用 SA6 已批准的 C1 证据契约修复）
  → **本轮 dispatch `sa-13381561-06c2-4e24-9307-44e9f0a92d0a`（iteration 3：把已批准的 C1 工作树形落到真实索引，消除残留的 pre-C1 raw runner 资产，使强制门禁转绿）**
- worktree：`/home/wangjian/nomicore-fix-issue-419`，基线 HEAD `27e012b`，交付 commit `02abf66`，本轮 HEAD 仍 `02abf66`
- 结论：实现完成，规定验证全过——守卫文件 19 用例全绿、包全量 14 文件/233 测试全绿 + 0 类型错误、
  包 tsc exit 0、RK-C6 变异矩阵两轮 6/6 expected、`git diff -- packages/replication-protocol/src` 为空。
  无阻塞；已登记偏差 5 条（前 3 条为 SA2 非阻断观察的采纳 / 加固，第 4 条为 iteration 1 的 F1 恢复，
  第 5 条为本轮 C1 归一化取代该恢复，见「Deviations or blockers」）。
- **iteration 1**：处置 SA9 `reject` 的唯一阻断项 F1（证据完整性 / 文件范围 MAJOR）——
  用 SA6 产出时留在对象库中的原始 blob **逐字节恢复** `artifacts/sa6-issue419-runner-trigger.log`
  至 SA6 §17 旧登记哈希 `96abbb72ecefdc3a…`，哈希链复原；改动内容（恰好 1 字节 = 文件尾空行的 LF）已书面说明，
  交付本体与全部语义验证保持不变（见「§F1 返工」）。
- **本轮（iteration 2）**：应用 SA6 iteration-1 已批准的 **C1 规范形证据契约修复**。iteration 1 的「恢复原始字节」
  被 Controller 强制门禁 `git diff --cached --check` 以 `new blank line at EOF`（`blank-at-eof`）拒绝——
  原始字节**结构性不可提交**，旧登记把工具原始输出定为权威正是根因（SA6 §18.7）。故按 SA6 §17（登记基准改为
  C1 规范形；旧 raw 哈希与理由保留为 legacy/superseded）+ §18.11（R1/R2 修复动作与 R3–R5 落盘动作）执行：
  `runner-trigger.log` 归一到 C1（= HEAD 已提交字节 `23787bf1…`，blob `46ff267d…`，69 行/4321B，
  **退出提交变更集**）、f1 证据日志第 20 行行尾空格归零（`2932f2a7…` → `3b861d2d…`，blob `0996a324…`，
  221 行/15420B）；§17 登记表 **10/10 MATCH**；门禁在私有索引副本上由红（2 处）转绿（**rc=0，零输出**）；
  业务测试语义零改动（包全量 14/233 + 0 类型错误、tsc exit 0、探针 7/7、RK-C6 6/6 expected）。
  真实索引未由 SA3 写入——剩余 stage 动作与提交后哈希复核见「Deferred verification」与证据日志 §6。
- **本轮（iteration 3）**：**真实索引落盘修复**。iteration 2 结束时真实索引仍持 iteration 1 的 pre-C1 raw runner 字节
  （index blob `c183ba29…`，70 行/4322B），强制门禁 `git diff --cached --check` 因此报
  `artifacts/sa6-issue419-runner-trigger.log:70: new blank line at EOF.`（rc=2，恰 1 处；f1 已被 Controller
  按 R2 落盘为 C1 形）。本轮按 dispatch 明示指令把**已批准的 C1 工作树形**只落在该单一路径的索引条目上
  （`git add -- artifacts/sa6-issue419-runner-trigger.log`；工作树字节本就是 HEAD blob `46ff267d…`，零工作树资产改写）：
  索引条目 → `46ff267d…`（= HEAD = 工作树，sha256 `23787bf1…`，69 行/4321B），**该路径退出提交变更集**
  （无内容损失），索引中不再存在任何等于 raw blob `c183ba29…` 的条目。随后 **`git diff --cached --check` rc=0、零输出**
  （11 路径完整候选变更集）；10→11 条 staged 路径逐条独立复算 C1（行尾空白 0 / 无 EOF 空行 / 末字节 LF / CR 0 /
  规范化净变换 0 / 工作树 ≡ 索引）；§17 登记表 **10/10 MATCH**；业务面零 diff（守卫 sha256 `32aa83a5…` 不变、
  守卫 19/19 绿 + 0 类型错误）。新增证据日志 `artifacts/sa3-issue419-index-reconcile.log`
  （181 行/13563B/sha256 `34aa27a4…`，自证 C1）。剩余仅 R5 提交后哈希终态复核（属 Controller）。

## Inputs consumed

| 输入 | 状态 | 本轮用途 |
|---|---|---|
| `wiki/raw/task_issue-419.md`（Host 简报） | 存在，亲读 | Issue 正文 AC1–AC5、「纯增量测试，零行为变化」 |
| `wiki/raw/task_issue-419_sa6_contract.md`（已批准契约） | 存在，亲读 | RK-C1–C7 / 计数契约 / §12.0 门禁五条 / SD-1 两案 |
| `wiki/raw/task_issue-419_design.md`（SA1 设计） | 存在，亲读 | §8 守卫详案（G1–G6）、§8.0 登记块、§7.2 SD-1B、§11 ALLOW/DENY、§12 门禁 |
| `wiki/raw/task_issue-419_sa2_review.md` | 存在，亲读 | verdict approve；无 BLOCKER/MAJOR；非阻断观察 O1–O4 |
| `wiki/raw/task_issue-419_design_conflict_report.md`（SA8） | 存在，亲读 | verdict **clear**、`requiresConflictRecheck=false`、Required actions 1–4（R1 实现票范围、R2 R3 头注） |
| `wiki/raw/task_issue-419_sa6_route_key_probe.mts` | 存在，亲读 | P1–P4/NC1–NC3 断言面种子（设计 §8.8 映射基准） |
| `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts` | 存在，亲读 | RK-C6 门禁命令与 6 变异锚点 |
| `artifacts/sa6-issue419-*.log` ×5 | 存在，亲读 | 基线：13 文件/214 测试、tsc exit 0、探针 7/7、变异两轮 6/6 |
| Issue 评论 REST 快照 | **空（`[]`）**（dispatch 明示；SA6 §2 同证） | 无 Owner 评论要求、无评论 ID/时间戳可落实 |
| 规范文本 | 亲读 | `docs/adr/0032-transport-decoupling-edge-session-split.md` §4；`docs/protocols/instance-replication-v1.md` §1/§3/§4/§5/§10.3/§13/§22 |
| 源码与测试 | 亲读 | `packages/replication-protocol/{src/index.ts,src/constants.ts,src/messages.ts,src/errors.ts,src/payloads.ts,src/limits.ts}`、`test/fixtures.ts`、`test/codec-envelope.test.ts`、`test/codec-messages-golden.test.ts`、`test/codec-package-contract.test.ts`、`test/codec-issue299-ac-red.test.ts`、`packages/replication-protocol/{AGENTS.md,tsconfig.json}`、`vitest.config.ts`、`tsconfig.base.json` |
| `wiki/raw/task_issue-419_sa9_standards.md`（SA9 标准审查，iteration 0） | 存在，亲读（**iteration 1 输入**） | verdict `reject`，唯一阻断项 §3-F1（MAJOR）：DENY 只读资产 `artifacts/sa6-issue419-runner-trigger.log` 在 SA3 22:55:44 完整性核对之后、提交（23:05:33）之前被静默修改，已提交字节 sha256 `23787bf1…` ≠ SA6 §17 登记 `96abbb72…`；修复路径 = 「恢复原字节」或「SA6/Controller 重登记 + 书面说明」 |
| `wiki/raw/task_issue-419_sa4_review.md` | 存在，亲读（iteration 1 输入） | verdict approve；§1 明示「本轮未重算哈希、采信哈希链」——F1 的暴露面即此采信点（SA9 §4-O3） |
| 本轮 dispatch 指令 | 亲读 | 「Restore or otherwise resolve the evidence-integrity issue within authorized scope, update the relevant evidence/report coherently, and provide verification；Preserve the approved semantic test delivery unless a change is necessary；Do not broaden scope」；Issue 评论 REST 快照仍为空（`[]`） |
| （**iteration 2 输入**）`wiki/raw/task_issue-419_sa6_contract.md` §15-6 / §17（C1 修订版）/ §18 | 存在，亲读 | SA6 已批准的合规修复契约：C1 规范形定义、C1 登记值（runner `23787bf1…` / f1 `3b861d2d…`）与 legacy raw 保留行、§18.7 根因、§18.11 R1–R6 授权与责任划分 |
| （iteration 2 输入）`artifacts/sa6-issue419-eof-gate-conflict.log`（173 行/`d152aeff…`） | 存在，全文亲读 | 冲突复现（2 findings/2 rules）、C1 最小性证明、私有索引全变更集绿证明、被否路径 B1–B6 |
| （iteration 2 输入）`wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh`（324 行/`b7e20113…`） | 存在，亲读 + 亲跑 | `--registry` 登记值交叉核对、`report`/`--log` 复现入口；本轮的验证工具来源 |
| （iteration 2 输入）`wiki/raw/task_issue-419_implementation_conflict_report.md` §7-2/§8 | 存在，亲读 | SA8 已裁定 fallback 表述与 R1 终态复核属 Controller；与 SA6 §18 一致，无 override |
| （iteration 2 输入）本轮 dispatch 指令 | 亲读 | 「Apply the SA6 iteration-1 approved canonical evidence-contract repair…update the §17 registry to the canonical whitespace-clean form, retain the superseded raw hash and rationale, normalize the F1 evidence-log trailing-space defect, and produce the documented verification necessary for compliant staging；Preserve business test semantics and do not broaden scope」；Issue 评论 REST 快照 = 空（`[]`），无 Owner 评论要求/ID/时间戳 |
| （**iteration 3 输入**）`wiki/raw/task_issue-419_implementation_conflict_report.md`（SA8 iteration 2，verdict clear / requiresConflictRecheck false）§4 冻结面「真实 git 索引」行 + §7-1（R3–R5 落盘与提交后复核） | 存在，亲读 | 被审对象与待办状态：真实索引仍红系 §18.14-2 已登记的 Controller 落盘待办；§7-1 明确落盘清单与 R5 期望值 |
| （iteration 3 输入）`wiki/raw/task_issue-419_sa6_contract.md` §17（C1 登记值表）+ §18.11 R1/R4/R5 + §18.14-2 | 存在，亲读 | 授权链与目标态：R1 的 staged 半边（索引 = C1 = HEAD blob `46ff267d…`）、R4 = `git diff --cached --check` rc 0 零输出、R5 提交后期望 `23787bf1…`/`3b861d2d…` |
| （iteration 3 输入）`artifacts/sa3-issue419-c1-staging-verification.log`（294 行 / `676ac387…`） | 存在，亲读 | iteration 2 的私有索引证明与变异反证（本轮只读复核，未改写） |
| （iteration 3 输入）`artifacts/sa6-issue419-eof-gate-conflict.log`（173 行）+ `wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh`（324 行） | 存在，亲读 + 亲跑 `--registry` | 冲突复现与 C1 最小性证明；本轮登记值交叉核对工具 |
| （iteration 3 输入）本轮 dispatch 指令 | 亲读 | 「Reconcile the exact staging discrepancy…the real Git index still contains the pre-C1 raw runner-trigger asset…Apply the approved C1 worktree form to the real index only as necessary, ensure no raw runner-trigger asset remains staged, and verify the complete candidate changeset passes the whitespace gate. Preserve all approved evidence and business semantics」；Issue 评论 REST 快照 = 空（`[]`），无 Owner 评论要求/ID/时间戳 |

## Existing worktree reconciliation

- 本票此前**无** `wiki/raw/task_issue-419_sa3_impl.md`、**无**未提交实现（`git status --porcelain` 起始仅
  Host 简报 + SA6 只读资产，与 SA6 §16 收尾一致）——本轮为首次产出，无待修订的旧实现需要保留/删除。
- 交付文件 `packages/replication-protocol/test/codec-route-key-guard.test.ts` 由 SA6 发现性占位后删除，
  SA6 §16 明示「该路径留给实现票」——本轮首次落地为正式守卫，非覆盖既有半成品。
- 一次性 scratch 诊断（`.scratch/sa3-419/`，补充变异证据用）运行后已整目录删除；
  `.scratch/` 现仅剩仓内既有 `vfsl-v1-parser`（`ls` 亲证）。
- **iteration 1 初始状态**：`git status --porcelain` 仅 `?? wiki/raw/task_issue-419_sa10_spec.md`、
  `?? wiki/raw/task_issue-419_sa9_standards.md`（两个下游评审产物，SA3 未触碰）；交付本体
  `packages/replication-protocol/test/codec-route-key-guard.test.ts` sha256 `32aa83a5…` 与 SA3 iteration 0 /
  SA4 登记一致 → **无需修订实现**。唯一待修对象 = SA9 §3-F1 的证据字节漂移。
- **iteration 2 初始状态**：iteration 1 的变更集（f1 日志 `A`、runner 日志 `M`=raw 形、5 份 wiki 评审产物
  已 staged）+ SA6 iteration-2 产物（契约 §17/§18 修订 ` M`、脚本与冲突日志 `??`，SA3 未触碰）。
  交付本体 sha256 仍 `32aa83a5…`/743 行（重算一致）→ **仍无需修订实现**；待修对象 = 强制门禁点名的两处
  非 C1 字节（runner `:70 new blank line at EOF`、f1 `:20 trailing whitespace`）与 §17 登记基准的落实。
  本轮 scratch（`.scratch/sa3-419-iter2/`，临时驱动与中间产物）在收尾时整目录删除，`.scratch/` 恢复为
  仅剩仓内既有 `vfsl-v1-parser`。
- **iteration 3 初始状态**（`git status --porcelain -uall` 亲证）：真实索引已由 Controller 落盘大部分修复
  （f1 日志 `A`=C1 blob `0996a324…`、契约/脚本/冲突日志/c1 日志/下游评审产物均 `A`/`M` 且工作树 ≡ 索引），
  **唯一残留 = `MM artifacts/sa6-issue419-runner-trigger.log`**：索引条目 `c183ba29…`（raw 形，4322B）、
  工作树 = HEAD blob `46ff267d…`（C1 形，4321B）。真实索引 sha256 = `b66c9ebb…`（与 iteration 2/SA8 记录的
  `e9fcd771…` 不同 ⟹ Controller 已在本轮前写入索引，非 SA3 行为）。`git diff --cached --check` 恰 1 处红灯
  （runner `:70 new blank line at EOF`；f1 的 `:20 trailing whitespace` 已随 R2 落盘消失）。交付本体
  sha256 仍 `32aa83a5…`/743 行 → **无需修订实现**；待修对象 = 该索引条目的 C1 落盘。本轮 scratch
  （`.scratch/sa3-419-iter3/`，原始输出）在收尾时整目录删除。

## §F1 返工（SA9 reject 处置）——证据完整性恢复

**问题（SA9 §3-F1，MAJOR）**：`artifacts/sa6-issue419-runner-trigger.log` 在设计 §11 DENY LIST 中被钉为
「只读输入」，SA3 iteration 0 于 22:55:44 复核其 sha256 = `96abbb72…`（`artifacts/sa3-issue419-targeted-repeat.log` 尾段），
但提交入库的字节为 `23787bf1…`——注册哈希链断裂，且 SA9 判定「原始字节已不可恢复」。

**处置（恢复原字节，SA9 列出的首选修复路径）**：

1. **取证恢复**：扫描对象库全部 blob（尺寸窗口 3800–5000B），以 SA6 §17 登记哈希为判据命中
   **悬挂 blob `c183ba296bbb886931b1b2adc2e24d4f930f0d7a`（4322B）**，其 sha256 恰为
   `96abbb72ecefdc3ad2b37bc8cfcdbb011e7c43b409c0b5f130c7a3e7a1b2e06c` → **原字节可恢复**
   （SA9「不可恢复」的判断由此被证据推翻；恢复源唯一性核查——该时刻其余 worktree / scratch / tmp 均无该资产的
   独立副本，恢复源仅为对象库，见日志 §10/§10a）。
2. **漂移内容定量**（`diff`/`cmp` 亲证）：已提交字节与登记原字节**仅差 1 字节**——文件尾空行的那个 LF
   （70 行/4322B → 69 行/4321B，`cmp` 报 0 个字节值差异 + 短文件在 4321B 处 EOF）。三段证据
   （发现性 1 用例、14 文件/215 测试、洁净基线 13 文件/214 测试、2.72s）在两版中**逐字节相同**，
   无任何结果、计数或结论被改动。
3. **恢复动作**：`git cat-file blob c183ba29… > artifacts/sa6-issue419-runner-trigger.log`（逐字节写回，
   不经任何编辑器/格式化器）。
4. **哈希链复原**：恢复后 `sha256sum` = `96abbb72…`（= SA6 §17 登记）、`git hash-object` = `c183ba29…`
   （= SA6 产出时的原 blob）；SA6 §17 全部 **7 份**资产哈希逐项复核，**7/7 与登记一致**。
5. **交付本体零变更**：守卫文件 sha256 仍 `32aa83a5…`；`git status` 变更集 = 该资产 1 项 ` M` + 本轮新证据日志
   （交付文件、`src/`、既有测试、文档、配置零改动）。
6. **书面说明（SA9 fix path 的「书面说明改动内容」要件）与 O1 闭合**：改动内容 = 尾部空行的 1 个 LF；
   mtime 取证显示提交时刻 23:05:33 只有两个路径同批被重写（本资产 + Host 简报 `wiki/raw/task_issue-419.md`），
   形状同为「EOF 末尾换行归一化」→ 记为**推断**（无任何 SA 报告承认该次编辑，工具不可从工作树辨识）；
   SA9 §4-O1 的「8.12s」文案只存在于 SA6 契约 L60，**两版日志中均不存在**（§2 时长段两版逐字节相同），
   故 O1 与该漂移无因果、属契约散文与首跑描述不一致；契约文本为 DENY（SA6 所有）→ SA3 不改，
   以上述书面说明满足 SA9「书面说明改动内容，本项即闭合」的条件。
7. **残留风险已登记**：若同一归一化器再次在 finalization 阶段运行，恢复的字节可能被再次剥离 →
   Controller/SA9 提交后应核对 `git show HEAD:artifacts/sa6-issue419-runner-trigger.log | sha256sum`
   == `96abbb72…`；若复发，则仅剩 SA9 另一条路径（SA6/Controller 在 §17 重登记归一化后哈希，DENY 路径、SA6 职权），
   **不在 SA3 范围**。

**范围正当性（为何 SA3 可写这个 DENY 路径）**：F1 的既成事实本身就是对 DENY LIST 的违反；本轮写回的是
**与 SA6 产出逐字节相同**的字节（`git hash-object` == SA6 原 blob），即**消除**该违反而非扩大它；
执行依据 = 本轮 dispatch 明示「Restore or otherwise resolve the evidence-integrity issue within authorized scope」
+ SA9 §3-F1 修复路径第 1 项「在能恢复原字节时恢复原状」。未触碰任何其他 DENY 路径（含 SA6 契约、设计、简报、
探针/驱动、其余 6 份 SA6 资产：哈希逐项一致）。

## §F1 收口（iteration 2）——C1 规范形证据契约修复（SA6 §17 / §18）

**为何 iteration 1 的「恢复原始字节」不能作为终态**：强制门禁 `git diff --cached --check` 对 iteration 1 的
staged 变更集报**恰 2 处**——`artifacts/sa6-issue419-runner-trigger.log:70: new blank line at EOF`（原始字节
末尾的 `\n\n` 触发 `blank-at-eof`）与 `artifacts/sa3-issue419-f1-evidence-restore.log:20: trailing whitespace`
（f1 日志第 20 行 `<`+SP，触发 `blank-at-eol`，并违反已提交 `.editorconfig` 的 trim 规则）。旧 §17 登记把
工具原始输出字节定为权威，与「必过空白门禁」**互不可满足**——这是根因（SA6 §18.7），不是恢复动作错误。

**SA6 iteration-1 批准的修复（本轮据以执行）**：`wiki/raw/task_issue-419_sa6_contract.md` §17 原位修订为
**登记基准 = C1 规范形**（= `.editorconfig [*]` 三条 ∩ 门禁 `blank-at-eol` + `blank-at-eof`：任何 LF 前不得有
`[ \t]`、EOF 不得有 `[ \t]`、文件末尾恰一个 LF），并新增 §18 记录复现、根因、被否路径 B1–B6 与私有索引门禁证明；
**旧 raw 哈希以 legacy/superseded 行保留并附理由**（runner `96abbb72…`：尾随空行违反 `blank-at-eof`；
f1 `2932f2a7…`：第 20 行行尾空格违反 `blank-at-eol` 与 `.editorconfig` trim 规则），不再具有权威性、
不再作为恢复目标。SA3 对本契约**零写入**（DENY + SA6 职权），只做只读核对。

**SA3 本轮动作（授权 = 本轮 dispatch + SA6 §18.11 R1/R2）**：

1. **R1** `git restore --worktree --source=HEAD -- artifacts/sa6-issue419-runner-trigger.log` →
   sha256 `23787bf1a40c183b…`、blob `46ff267d…`、69 行/4321B，`cmp` 与 HEAD blob 逐字节相同
   （`CMP_HEAD_BYTES=0`）；该路径由此与 HEAD 无差异，**退出提交变更集**（无内容损失：C1 形本就是已提交字节）。
2. **R2** 对 f1 日志施加 C1 规则（与 SA6 脚本同一 `perl` 规范化式）→ sha256 `3b861d2dc34eff92…`、
   blob `0996a324…`、221 行/15420B；`diff` 显示**恰 1 行变更**（第 20 行 `< ` → `<`）、0-based 偏移 1330
   的 `0x20` 移除、其后字节逐字节相同。
3. **未执行的越界动作**：SA3 未写真实索引（无 `git add`、无 `git restore --staged`）——R1 的 `--staged` 半边、
   R3（stage 契约/脚本/日志）与 R4（真实索引门禁 rc=0）留给 Controller；SA6 契约、探针/驱动、其余 SA6 资产
   零改动（哈希逐项一致）。
4. **验证**（详见 `artifacts/sa3-issue419-c1-staging-verification.log`，294 行 / `676ac387…`）：§17 登记表
   **10/10 MATCH**；私有索引副本：忠实对照副本 rc=2（2 处）→ 换入两件 C1 blob 后 **rc=0、零输出**
   （变更集 6 路径，runner 退出）→ 全候选变更集（9 路径；本日志与更新后的本报告由 post-freeze 证明覆盖）
   **rc=0、零输出**；真实索引 sha256 全流程不变（`e9fcd771…`，非侵入）；变异反证：C1(runner) 追加 1 个末尾 LF
   即重现 `blank-at-eof` 且哈希回到 `96abbb72…`，C1(f1) 在 1330 重插空格即重现 `blank-at-eol` 且哈希回到
   `2932f2a7…`——门禁恰对这两个字节敏感，修复不多不少。
5. **终态期望取代**：iteration 1 §8/R1 与 SA8 §7-2 的提交后期望 `96abbb72…` 被 SA6 §17/R5 取代为
   `23787bf1a40c183b…`（runner）；f1 证据日志提交后应等于 `3b861d2d…`。

## §F1 落盘收口（iteration 3）——真实索引应用 C1 工作树形，强制门禁转绿

**问题（本轮 dispatch 具名）**：iteration 2 只在**工作树**落 C1 形，真实索引的 runner 条目仍持 iteration 1 的
pre-C1 raw blob `c183ba29…`（70 行/4322B），故 Controller 强制门禁 `git diff --cached --check` 在完整候选
变更集上报 `artifacts/sa6-issue419-runner-trigger.log:70: new blank line at EOF.`（`blank-at-eof`，rc=2，恰 1 处）
——即「已批准 C1 修复未真正 stage」的精确差异。

**授权链**：本轮 dispatch 明示指令（「Apply the approved C1 worktree form to the real index only as necessary」）
× SA6 §18.11 **R1**（`git restore --source=HEAD --staged --worktree -- <path>`，期望「工作树+索引 = C1 形 =
blob `46ff267d…`/sha256 `23787bf1…`，69 行/4321B」）× §18.14-2（R1–R3 未执行是唯一未闭合动作）
× SA8 §7-1（Controller 落盘清单，含 commit 前 `git diff --cached --check` 期望 rc=0）。SA3 技能的一般边界
（不执行 stage）在此被**更具体的 dispatch 指令**显式覆盖，且动作被限定为**单一路径的索引条目**。

**本轮动作（最小、可复核）**：

1. **行动作**：`git add -- artifacts/sa6-issue419-runner-trigger.log`（`GIT_ADD_RC=0`）。因工作树字节本就
   = HEAD blob `46ff267d…`，该命令等价于 R1 的 staged 半边，且**不重写任何工作树资产字节**
   （runner 工作树 mtime/字节零变化；无 `git restore --worktree`）。
2. **索引终态**：`git ls-files -s` → `100644 46ff267d3451c22147b759002aee3345d09871a9 0 artifacts/sa6-issue419-runner-trigger.log`
   = HEAD blob = C1 形（sha256 `23787bf1…`，69 行/4321B）。该路径**退出提交变更集**（`git diff --cached --name-only`
   不含它；无内容损失，C1 形本就是已提交字节）；索引中**不再存在任何等于 raw blob `c183ba29…` 的条目**
   （全索引条目哈希扫描：`NONE_RAW_RUNNER_BLOB_STAGED`）。
3. **强制门禁转绿**：`git diff --cached --check` → **rc=0、零输出**（真实索引，完整候选变更集；pre-state rc=2）。
4. **完整候选变更集独立复算**：11 条 staged 路径逐条取**暂存 blob**（非 diff）复算 C1 —— 行尾空白 0、
   无 EOF 空行、末字节 LF、CR 0、C1 规范化净变换 0 字节、`git diff --no-index --check` 静默（rc=1）、
   工作树 ≡ 索引（无 unstaged 漂移）→ **全部 PASS（11/11）**。
5. **证据保全**：SA6 §17 登记表本轮 `--registry` 复跑 **10/10 MATCH**（探针/驱动/5 份 SA6 日志/脚本/冲突日志
   逐项一致；两条 legacy raw 行显示 MISMATCH 属预期，因为工作树已不再持 raw 形）；`artifacts/sa3-issue419-c1-staging-verification.log`
   （`676ac387…`）与 SA6 资产字节零改写。
6. **业务语义保全**：`git diff/--cached/HEAD --stat -- packages docs CONTEXT.md .editorconfig vitest.config.ts` 全部空输出；
   守卫 sha256 `32aa83a5…`/743 行不变；守卫重跑 **19 passed (19)**、`Type Errors no errors`、exit 0。
7. **新增证据日志**：`artifacts/sa3-issue419-index-reconcile.log`（**181 行/13563B/sha256 `34aa27a4…`**，
   自证 C1：行尾空白 0、无 EOF 空行、`--no-index --check` rc=1 静默、规范化净变换 0）——含 pre/post 原始输出、
   11 路径 C1 扫描、§17 登记核对、业务不变量与 R5 提交后期望。
8. **本报告原位更新**并与其证据日志一并 stage（两者均实测 C1-clean），随后在真实索引上复跑门禁。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/replication-protocol/test/codec-route-key-guard.test.ts` | §8.0–§8.7（+§7.3 六组结构、§7.4 失败语义、§7.5 证据笔误修正、§13-R3 头注） | **新建**，743 行：模块级布局事实登记块 + 独立最小读取器（`readVarUint`/`readVarString`/`walkError`）+ 6 个 describe 组 / 19 用例（G1 4、G2 2、G3 4、G4 5、G5 1、G6 3） |
| `artifacts/sa3-issue419-package-suite.log` | §12 门禁 1（AC5） | 新增证据日志：包全量 `--typecheck` 输出 |
| `artifacts/sa3-issue419-scope-and-tsc.log` | §12 门禁 2 + 门禁 4 | 新增证据日志：包 tsc exit 0、`git diff --stat -- src` 为空、`git status` |
| `artifacts/sa3-issue419-mutation-rerun.log` | §12 门禁 5（RK-C6） | 新增证据日志：SA6 变异驱动两轮 6/6 expected |
| `artifacts/sa3-issue419-guard-mutation-evidence.log` | §8.8 映射表加固（补充） | 新增证据日志：守卫文件自身跑在 6 个变异 codec 副本上的结果（含首轮原始输出） |
| `artifacts/sa3-issue419-targeted-repeat.log` | §12 门禁 1 前置 + §9 确定性 | 新增证据日志：目标文件 ×2 运行 + SA6 只读资产 sha256 完整性核对 |
| `artifacts/sa6-issue419-runner-trigger.log`（**iteration 1**） | 设计 §11 DENY（只读输入）+ SA9 §3-F1 修复路径 1 | **逐字节恢复**至 SA6 产出原字节：`git cat-file blob c183ba29…` 写回，sha256 `23787bf1…`（已提交漂移版）→ `96abbb72…`（SA6 §17 旧登记）；`git diff --stat` = `1 file changed, 1 insertion(+)`（唯一改动 = 文件尾空行的 LF）；内容语义零变化。**iteration 2 已取代**：该 raw 形被强制门禁拒绝（`blank-at-eof`），按 SA6 §17 C1 登记归一 |
| `artifacts/sa3-issue419-f1-evidence-restore.log`（**iteration 1**） | 技能固定产物（证据日志）+ §12 证据惯例 | 新增证据日志（**221 行 / 15421B / sha256 `2932f2a7…`**，§1–§11c）：对象库取证恢复、1 字节 delta 定量、恢复动作、SA6 §17 7/7 哈希复核、恢复后门禁重跑、根因取证、残留风险、恢复源唯一性核查、日志自哈希（含 tee 缓冲说明）。**iteration 2 已取代**：该 raw 形第 20 行行尾空格被门禁点名（`blank-at-eol`），已归一到 C1 `3b861d2d…` |
| `artifacts/sa6-issue419-runner-trigger.log`（**iteration 2**） | SA6 §17（C1 登记基准）+ §18.11 R1（本轮 dispatch 授权） | **归一到 C1**：`git restore --worktree --source=HEAD` → `23787bf1a40c183b…` / blob `46ff267d…` / 69 行/4321B = **HEAD 已提交字节**（`cmp` 逐字节相同）；路径退出提交变更集。旧 raw `96abbb72…` 作为 legacy/superseded 保留于 §17 与本报告 |
| `artifacts/sa3-issue419-f1-evidence-restore.log`（**iteration 2**） | SA6 §17（C1 登记）+ §18.11 R2 + 本轮 dispatch「normalize the F1 evidence-log trailing-space defect」 | **归一到 C1**：第 20 行 `<`+SP → `<`（−1 字节 @0-based 1330），`2932f2a7…`/15421B → **`3b861d2d…`/221 行/15420B**（blob `0996a324…`）；除该字节外逐字节不变。旧 raw 作为 legacy/superseded 保留于 §17 与本报告；日志正文（含其 §8/R1 旧期望与 §11b 陈旧自哈希）保持原样不改写——取代关系由 §17 行与本报告承接 |
| `artifacts/sa3-issue419-c1-staging-verification.log`（**iteration 2**） | 本轮 dispatch「produce the documented verification necessary for compliant staging」 | 新增证据日志（**294 行 / 24955B / sha256 `676ac387…`**，C1 自证：行尾空白 0、无 EOF 空行、`--no-index --check` 静默、规范化净变换 0 字节）：pre-state 红门禁、R1/R2 字节增量、§17 登记 10/10、私有索引三连证明（对照红 / 两件 C1 绿 / 全候选绿）、变异反证、范围与业务不变量、Controller 落盘动作 |
| `wiki/raw/task_issue-419_sa3_impl.md` | 技能固定产物 | 本报告（原位新建 → iteration 1 更新 §F1 返工 → iteration 2 更新 §F1 收口 → **iteration 3 更新输入/初始状态/§F1 落盘收口/变更面/文件范围/验证/延后/偏差/提交消息，并重新 stage**） |
| `artifacts/sa6-issue419-runner-trigger.log`（**iteration 3：仅真实索引条目**） | 本轮 dispatch 明示指令 × SA6 §18.11 **R1**（staged 半边）× §18.14-2 × SA8 §7-1 | **只写索引条目**：`git add` 使索引 = 已批准 C1 工作树形 = HEAD blob `46ff267d…`（sha256 `23787bf1…`，69 行/4321B）→ 该路径**退出提交变更集**，raw blob `c183ba29…` 不再被 stage；工作树字节零改写（本行不新增提交内容） |
| `artifacts/sa3-issue419-index-reconcile.log`（**iteration 3**） | 本轮 dispatch「verify the complete candidate changeset passes the whitespace gate」+ §12 证据惯例 | 新增证据日志（**181 行 / 13563B / sha256 `34aa27a4…`**，自证 C1）：pre-state 红门禁与 raw 索引条目、行动作与 post-state、11 路径暂存 blob C1 扫描、§17 登记 10/10、业务不变量、R5 提交后期望 |

`src/`、`test/fixtures.ts`、既有 13 个 `*.test.ts`、`*.test-d.ts`、wire/协议文档、ADR、`CONTEXT.md`、
`packages/ws-replication/**`、`vitest.config.ts`、`package.json`、`tsconfig*.json`：**零改动**（见 §6 核对）。

## SA2 Finding 落实

SA2 verdict = **approve**，§13「Required revisions：无（无 BLOCKER / 无 MAJOR finding）」——无阻断项待落实。
§14 的 4 条非阻断观察逐条处置：

| Finding ID | Implementation | Result |
|---|---|---|
| O1（import 面精确性：`NAMESPACE_ID_RE` 不在公共 API 面，不得深导入 `../src`） | 守卫 import 面仅 `@nomicore/replication-protocol`（`CAP_CHUNKED_UPDATE`/`ENVELOPE_HEADER_BYTES`/`MESSAGE_REGISTRY`/`NAMESPACE_ERRORS`/`ProtocolError`/`decodeMessage`/`encodeMessage`/`lookupError` + 5 个类型）与 `./fixtures`（`GOLDEN`/`NS`/`RID`/`bytesToHex`/`hexToBytes`/`type GoldenFixture`）；零 `../src` 深导入、零 `NAMESPACE_ID_RE` 引用 | 符合（接受条件满足；tsc exit 0 亲证） |
| O2（最坏 ERROR 用例的 code 建议动态推导） | G4-d 用 `Object.keys(NAMESPACE_ERRORS).reduce((a,b) => b.length > a.length ? b : a)` 动态取当前最长码（现解析为 35B 的 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`），公式 `1 + NS_PREFIX_BYTES + longestCode.length + 1 + 1 + 1 + 5 + 1` 逐项核对 | **采纳**（R4 预算红仍由 `≤ ERROR_NS_PREFIX_BUDGET` 承载） |
| O3（fatal=false 的 wire 位形态样本，可选） | G4-a 增加 `ns/fatal-false` 样本（`ACK_TIMEOUT`，唯一 `fatal=false` 码 → wire `fatal=0`）；G4-b 计数随之 = 3 | **采纳**（四象限判别集合仍以 4 元素断言锁定，样本不计入象限集合） |
| O4（grammar 拒绝方向，可选） | G1-d：34 / 36 字符 namespaceId 经 `encodeMessage` → `ProtocolError('MALFORMED_FRAME')`（`expectMalformed`） | **采纳**（把「恒 35」前提由单向接受扩展为双向锁定） |
| SA8 Required action 1（实现票范围/R1） | 单一新文件；`src/`、`fixtures.ts`、文档零改动；门禁 1–5 全过 | 满足 |
| SA8 Required action 2（R3 头注维护契约） | 守卫文件头注含：「消息注册表与错误注册表 append-only。新增 namespace-scope 消息型 = 必须显式裁决『落 [21..56) 固定偏移』还是『登记为例外』；新增错误码 = 必须复核 ERROR mini-decode 预算（≤ 64 字节）……这是**有意识的契约修订信号**，不是测试脆弱」 | 满足 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/replication-protocol/test/codec-route-key-guard.test.ts` | 设计 §11 ALLOW LIST 唯一一行（新建，唯一交付文件） | AC1–AC4 守卫本体；§8 全案 |
| `artifacts/sa3-issue419-package-suite.log` | DENY 未覆盖（DENY 仅列 `artifacts/sa6-issue419-*.log` 为只读输入） | AC5/门禁 1 原始证据 |
| `artifacts/sa3-issue419-scope-and-tsc.log` | 同上 | 门禁 2（tsc）与门禁 4（零行为面）原始证据 |
| `artifacts/sa3-issue419-mutation-rerun.log` | 同上 | 门禁 5（RK-C6）两轮原始证据 |
| `artifacts/sa3-issue419-guard-mutation-evidence.log` | 同上 | §8.8「守卫 ⊇ 探针」映射的可执行加固证据（补充，非门禁替代） |
| `artifacts/sa3-issue419-targeted-repeat.log` | 同上 | 发现性/确定性 + SA6 只读资产完整性证据 |
| `artifacts/sa6-issue419-runner-trigger.log`（**iteration 1**） | 设计 §11 DENY 钉为「只读输入」；本轮为**恢复至 SA6 登记字节**（SA9 §3-F1 修复路径 1 + 本轮 dispatch 授权），写回后 `git hash-object` == SA6 原 blob `c183ba29…`，即消除既有 DENY 违反而非扩大范围 | 复原注册哈希链 |
| `artifacts/sa3-issue419-f1-evidence-restore.log`（**iteration 1**） | DENY 未覆盖（DENY 仅列 `artifacts/sa6-issue419-*.log` 为只读输入） | F1 修复的取证与验证原始证据 |
| `wiki/raw/task_issue-419_sa3_impl.md` | 技能固定产物路径（非 DENY 项；DENY 仅钉 `wiki/raw/task_issue-419*.md|.mts` 的**既有 Host/SA6 输入**为只读） | 本报告 |
| `artifacts/sa6-issue419-runner-trigger.log`（**iteration 2**） | 设计 §11 DENY 钉为「只读输入」；本轮写入 = SA6 §18.11 **R1**（SA6 iteration-1 已批准的规范形修复）+ 本轮 dispatch 明示授权，且写入字节 = **HEAD 已提交 blob**（`46ff267d…`）→ 该路径与 HEAD 无差异，**消除** iteration 1 遗留的 DENY 偏离而非扩大范围 | 归一至 §17 C1 登记值，退出提交变更集 |
| `artifacts/sa3-issue419-f1-evidence-restore.log`（**iteration 2**） | DENY 未覆盖（DENY 仅列 `artifacts/sa6-issue419-*.log` 与 `wiki/raw/task_issue-419*.md|.mts`） | 归一至 §17 C1 登记值（唯一 1 字节行尾空格） |
| `artifacts/sa3-issue419-c1-staging-verification.log`（**iteration 2**） | DENY 未覆盖（同上） | 本轮 C1 修复与合规 staging 的原始验证证据 |
| `wiki/raw/task_issue-419_sa3_impl.md`（**iteration 2**） | 技能固定产物路径（同 iteration 1 判定） | 本报告原位更新 |
| `artifacts/sa6-issue419-runner-trigger.log`（**iteration 3**：索引条目） | 设计 §11 DENY 钉为「只读输入」；本轮写入面 = **仅索引条目**（工作树字节零改写），授权 = 本轮 dispatch 明示指令 × SA6 §18.11 **R1** staged 半边（SA6 iteration-1 已批准的规范形修复）× §18.14-2/SA8 §7-1 的 Controller 落盘待办；写入值 = **HEAD 已提交 blob**（`46ff267d…`）→ 索引与 HEAD 零差异、路径退出变更集，DENY 偏离**归零** | 落盘 §17 C1 登记值，消除残留 raw 索引条目并使强制门禁转绿 |
| `artifacts/sa3-issue419-index-reconcile.log`（**iteration 3**） | DENY 未覆盖（DENY 仅列 `artifacts/sa6-issue419-*.log` 与 `wiki/raw/task_issue-419*.md\|.mts`；同 iteration 1/2 的 `artifacts/sa3-issue419-*.log` 先例判定） | 本轮索引落盘与门禁转绿的原始验证证据 |
| `wiki/raw/task_issue-419_sa3_impl.md`（**iteration 3**） | 技能固定产物路径（同 iteration 1/2 判定） | 本报告原位更新并重新 stage |

DENY LIST 逐项复核（全部未触碰）：

- `packages/replication-protocol/src/**`：`git diff --stat` 空输出（门禁 4；iteration 2 复跑同为空）。
- `test/fixtures.ts` 与既有 13 个测试文件：未出现在 `git status` 变更集中（均为已跟踪文件、无 modification 条目）。
- `docs/protocols/instance-replication-v1.md`、`docs/adr/0032-*.md`、`CONTEXT.md`、`packages/ws-replication/**`、
  `vitest.config.ts`、根/包 `package.json`、`tsconfig*.json`、`.editorconfig`、`.gitattributes`：零改动
  （`git diff --stat HEAD -- packages docs CONTEXT.md .editorconfig` 空输出，证据日志 §5）。
- `wiki/raw/task_issue-419*.md|.mts` 与 `artifacts/sa6-issue419-*.log`：只读；sha256 与 SA6 §17 登记前缀
  逐项一致（`b340dcd3…`/`3631b43f…`/`b054b3c0…`/`c8f67f9b…`/`1f23a7a0…`/`1960c24a…`/`96abbb72…`，
  见 `artifacts/sa3-issue419-targeted-repeat.log` 尾段）。
  **iteration 1 更正**：iteration 0 核对（22:55:44）时 7/7 一致；此后提交前该 7 份中的
  `artifacts/sa6-issue419-runner-trigger.log` 被外部静默归一化（SA9 §3-F1），已提交字节一度为 `23787bf1…`。
  iteration 1 逐字节恢复，**当时工作树 7/7 再次与旧登记一致**。
  **iteration 2 更正（终态）**：SA6 §17 登记基准已修订为 C1 规范形——`runner-trigger.log` 的权威值 =
  `23787bf1…`（= HEAD 字节，旧 raw `96abbb72…` 为 legacy/superseded）；本轮后 **§17 全表 10/10 MATCH**
  （含 C1 行与脚本/SA6 冲突日志两行，证据日志 §2），且 `--registry` 输出中两条「superseded raw」行显示
  `MISMATCH` 系**预期**（工作树已不再持有 raw 形）。SA6 契约 §17/§18 为 SA6 职权、本轮**零写入**（只读核对）。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/replication-protocol/test/codec-route-key-guard.test.ts`（×2） | **19 passed (19)**、`Type Errors no errors`、EXIT=0（两次一致） | `artifacts/sa3-issue419-targeted-repeat.log` §run 1/2 |
| 门禁 1（AC5）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/replication-protocol` | **14 文件 / 233 测试全绿 / Type Errors: no errors / EXIT=0**（基线 13/214 + 守卫 19；≥215 期望满足） | `artifacts/sa3-issue419-package-suite.log` |
| 门禁 2：`pnpm exec tsc -p packages/replication-protocol/tsconfig.json` | `TSC_EXIT=0`（无诊断） | `artifacts/sa3-issue419-scope-and-tsc.log` |
| 门禁 4（零行为面）：`git diff --stat -- packages/replication-protocol/src` | **空输出**；`git diff --quiet` → `SRC_CLEAN=yes` | `artifacts/sa3-issue419-scope-and-tsc.log` |
| 门禁 5（RK-C6）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts`（两轮） | 两轮均 **`MUTATION_RESULT 6/6 expected`**、EXIT=0；M1→P1/P4 红、M2→P2/P4/NC2 红、M3→P3 红、M4→P1/P4 红、NM1/NM2 全绿（失败详情与 SA6 基线逐字一致） | `artifacts/sa3-issue419-mutation-rerun.log` |
| 补充（§8.8 加固）：守卫文件跑在 6 个变异 codec 副本上 | 最终一轮 **`GUARD_MUTATION_RESULT 6/6 expected`**、EXIT=0：M1→`[G2-a,G2-b,G5-a]`、M2→`[G3-a,G3-b,G3-d,G5-a,NC2]`、M3→`[G4-a..G4-e]`、M4→`[G1-b,G2-a,G2-b,G5-a]`、NM1/NM2 全绿（EXIT=0）。真实 `src/` 零写入（副本机制 + 收尾 scratch 删除） | `artifacts/sa3-issue419-guard-mutation-evidence.log`（含首轮原始输出） |
| SA6 只读资产完整性：`sha256sum` | 7 份资产哈希前缀与 SA6 §17 登记逐项一致 | `artifacts/sa3-issue419-targeted-repeat.log` 尾段 |
| scratch 清理 | `.scratch/sa3-419` 不存在；`.scratch/` 仅剩既有 `vfsl-v1-parser` | 终端输出（`ls` 亲证） |

**iteration 1（F1 修复）验证**

| Command | Result | Evidence |
|---|---|---|
| 取证恢复：对象库 blob 扫描（尺寸窗 3800–5000B，判据 = SA6 §17 登记哈希） | 命中悬挂 blob **`c183ba296bbb886931b1b2adc2e24d4f930f0d7a`（4322B）**，sha256 = `96abbb72…` = 登记值 | `artifacts/sa3-issue419-f1-evidence-restore.log` §1 |
| 漂移定量：`diff` / `cmp -l /tmp/orig-runner-trigger.log /tmp/committed-runner-trigger.log` | 差异 = **1 行（第 70 行空行）/ 1 字节（尾部 LF）**；`cmp` 0 个字节值差异 + 短文件 4321B 处 EOF；4322B/70 行 vs 4321B/69 行 | 同上 §2 |
| 恢复：`git cat-file blob c183ba29… > artifacts/sa6-issue419-runner-trigger.log` | `sha256sum` = **`96abbb72ecefdc3ad2b37bc8cfcdbb011e7c43b409c0b5f130c7a3e7a1b2e06c`**（= 登记值）；`git hash-object` = `c183ba29…`（= SA6 原 blob）；`wc` = 70 行/4322B | 同上 §3/§9 |
| SA6 §17 全表复核：`sha256sum` 7 份资产（探针 + 驱动 + 5 日志） | **7/7 与登记一致**（`b340dcd3…`/`3631b43f…`/`1960c24a…`/`c8f67f9b…`/`b054b3c0…`/`96abbb72…`/`1f23a7a0…`） | 同上 §4 |
| 变更面：`git status --porcelain` / `git diff --stat` / `git diff -- packages/replication-protocol/src` | 变更集 = ` M artifacts/sa6-issue419-runner-trigger.log`（`1 insertion(+)`）+ 本轮新证据日志（`??`）；`src/` diff 空、`SRC_DIFF_EXIT=0`；交付本体 sha256 仍 `32aa83a5…` | 同上 §5/§9 |
| 恢复后门禁 1 前置：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/replication-protocol/test/codec-route-key-guard.test.ts` | **19 passed (19)**、`Type Errors no errors`、`GUARD_EXIT=0` | 同上 §6 |
| 恢复后门禁 1（AC5）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/replication-protocol` | **14 文件 / 233 测试全绿 / 0 类型错误 / `PACKAGE_SUITE_EXIT=0`** | 同上 §6 |
| 恢复后门禁 2：`pnpm exec tsc -p packages/replication-protocol/tsconfig.json` | `TSC_EXIT=0` | 同上 §6 |
| 根因取证：交付 commit `02abf66` 全部 21 路径 mtime 清点 | 提交时刻 `23:05:33` 仅 2 路径同批重写（本资产 `.002385845` + 简报 `.003385853`），其余 19 路径保持各自创作 mtime（22:27–23:05:12）→ 「EOF 换行归一化」推断（非证明） | 同上 §7.2/§7.2a |
| O1 独立性：`grep -c "8.12"`（原版 / 漂移版 / SA6 契约） | `0 / 0 / 2` → 8.12s 文案不在任何一版日志中；O1 与漂移无因果 | 同上 §7.3 |
| 恢复源唯一性：`git worktree list` + `ls .scratch/` + `grep -rl "runner trigger evidence"`（/tmp、.scratch、artifacts） | 仅命中本日志自身、被恢复资产与本次修复派生的 2 个 `/tmp` 副本；其余 5 个 worktree / scratch / tmp 均无独立副本 → 对象库 blob 是唯一恢复源 | 同上 §10/§10a |
| 本轮证据日志自哈希：`sha256sum artifacts/sa3-issue419-f1-evidence-restore.log` | **`2932f2a773a4c0a6a30432983685b613bb51a16504fd61f9e376167002d974a3`**（221 行 / 15421B，冻结后复算稳定）；§11b 内嵌自哈希因 `tee` 流缓冲为**陈旧值**，已在 §11c 说明并以本行为权威值 | 同上 §11b/§11c；`sha256sum` 终态复算 |

**iteration 2（C1 证据契约修复）验证**

| Command | Result | Evidence |
|---|---|---|
| 门禁红（真实索引，pre-state）：`git diff --cached --check` | **rc=2，恰 2 处**：f1 日志 `:20 trailing whitespace`、runner 日志 `:70 new blank line at EOF` | `artifacts/sa3-issue419-c1-staging-verification.log` §0 |
| R1：`git restore --worktree --source=HEAD -- artifacts/sa6-issue419-runner-trigger.log` | sha256 **`23787bf1a40c183b…`** = §17 C1 登记；blob `46ff267d…`；69 行/4321B；`cmp` 与 HEAD blob 逐字节相同（`CMP_HEAD_BYTES=0`） | 同上 §1 |
| R2：f1 日志 C1 规范化（去第 20 行行尾空格） | sha256 **`3b861d2dc34eff92…`** = §17 C1 登记；blob `0996a324…`；221 行/15420B；`diff` 恰 1 行（`20c20`），0-based 偏移 1330 的 `0x20` 移除、后缀逐字节相同 | 同上 §1 |
| §17 登记交叉核对：`bash wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh --registry` | **rc=0，10/10 MATCH**（6 份 SA6 资产 + 两件 C1 行 + 脚本 + SA6 冲突日志）；两条 superseded raw 行显示 `MISMATCH` 属**预期**（工作树已不持 raw 形） | 同上 §2 |
| 私有索引证明（真实索引只读）：忠实对照副本 `git diff --cached --check` → **rc=2**；换入两件 C1 blob → **rc=0、零输出**（变更集 6 路径，runner 退出）；`ls-files -s` = `0996a324…`/`46ff267d…`；全候选变更集（9 路径）→ **rc=0、零输出**；真实索引 sha256 全流程不变 `e9fcd771…` | 门禁修复因果充分、窄幅且非侵入 | 同上 §3a/§3b/§3c |
| 变异反证：C1(runner) 追加 1 个末尾 LF → 重现 `blank-at-eof` 且 sha256 回到 `96abbb72…`；C1(f1) 在偏移 1330 重插空格 → 重现 `blank-at-eol` 且 sha256 回到 `2932f2a7…` | 门禁恰对被修的两个字节敏感，修复不多不少 | 同上 §4 |
| 业务语义复跑（AC5）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/replication-protocol` | **14 文件 / 233 测试全绿 / `Type Errors  no errors` / `EXIT=0`** | 同上 §5（原始输出） |
| 业务语义复跑：`pnpm exec tsc -p packages/replication-protocol/tsconfig.json` | `TSC_EXIT=0` | 同上 §5 |
| 业务语义复跑：SA6 探针 `.mts` | `RESULT 7/7 passed`、`PROBE_EXIT=0` | 同上 §5 |
| 业务语义复跑：SA6 变异驱动 `.mts`（RK-C6） | `MUTATION_RESULT 6/6 expected`、`MUTATION_EXIT=0` | 同上 §5 |
| 零行为面 / 零文档面：`git diff --stat -- packages/replication-protocol/src`（空）、`git diff --stat HEAD -- packages docs CONTEXT.md .editorconfig`（空）、守卫文件 sha256 | `SRC_DIFF_RC=0`、`SCOPE_DIFF_RC=0`、守卫 **`32aa83a5ffaa6a3c…`**（743 行）不变 | 同上 §5 |
| 本轮证据日志自证 C1（emit 时断言）：`canon(log)==log`、行尾空白 0、无 EOF 空行、`git diff --no-index --check` rc=1 静默、规范化净变换 0 字节 | **`artifacts/sa3-issue419-c1-staging-verification.log` sha256 `676ac387…`，294 行 / 24955B** | emit 驱动 stderr 的 `LOG_*` 行 |
| **post-freeze 终局门禁证明**（本报告 + 本日志 + 全部变更路径冻结字节，私有索引副本；真实索引只读） | `GATE_RC=0`、**零输出**（最终复跑，命令：`cp <real index> <copy>` → 对每条变更路径 `git hash-object -w` + `GIT_INDEX_FILE=<copy> git update-index --add --cacheinfo` → `GIT_INDEX_FILE=<copy> git diff --cached --check`） | 本轮终局复跑（同 §3c 方法，含冻结后的本日志与本报告） |
| 证据日志自身终态：`sha256sum artifacts/sa3-issue419-f1-evidence-restore.log` | **`3b861d2dc34eff92686d52d29e746acade673831769ca9226fd5835304b45c15`**（221 行 / 15420B）= §17 C1 登记值；iteration 1 的 `2932f2a7…`/15421B 自此为 legacy/superseded（历史观测，从未提交） | 同上 §1/§2/§7 |

**iteration 3（真实索引落盘 / 强制门禁转绿）验证**

| Command | Result | Evidence |
|---|---|---|
| 门禁红（真实索引，pre-state）：`git diff --cached --check` | **rc=2，恰 1 处**：`artifacts/sa6-issue419-runner-trigger.log:70: new blank line at EOF.`——索引条目 = pre-C1 raw blob `c183ba29…`（70 行/4322B），工作树 = `46ff267d…`（69 行/4321B） | `artifacts/sa3-issue419-index-reconcile.log` §0 |
| 行动作：`git add -- artifacts/sa6-issue419-runner-trigger.log` | `GIT_ADD_RC=0`；索引条目 `c183ba29…` → **`46ff267d3451c22147b759002aee3345d09871a9`** = HEAD blob = 工作树字节（sha256 `23787bf1…`，69 行/4321B）；工作树资产字节零改写 | 同上 §1 |
| 残留 raw 检查：全索引条目哈希扫描 + staged 变更集 | `NONE_RAW_RUNNER_BLOB_STAGED`；runner 不在 `git diff --cached --name-only`（索引 == HEAD ⟹ **退出提交变更集**） | 同上 §1 |
| 门禁绿（真实索引，完整候选变更集）：`git diff --cached --check` | **rc=0、零输出**（pre-state rc=2 → post 转绿） | 同上 §1；新增日志 stage 后复跑仍 rc=0 |
| 完整候选变更集独立复算：每条 staged 路径的**暂存 blob**（非 diff 输出） | **11/11 PASS**：行尾空白 0、无 EOF 空行、末字节 LF、CR 0、C1 规范化净变换 0 字节、`git diff --no-index --check` 静默（rc=1）、工作树 ≡ 索引（无 unstaged 漂移） | 同上 §2 |
| §17 登记交叉核对：`bash wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh --registry` | **rc=0，10/10 MATCH**（6 份 SA6 资产 + runner C1 + f1 C1 + 脚本 + 冲突日志）；两条 legacy raw 行 MISMATCH 属**预期** | 同上 §3 |
| 业务面零 diff：`git diff --stat -- packages/replication-protocol/src`（含 `--cached`）、`git diff HEAD --stat -- packages docs CONTEXT.md .editorconfig vitest.config.ts`、`git diff --cached HEAD --name-only -- packages docs CONTEXT.md .editorconfig` | 全部**空输出**（无业务路径被改写或被 stage） | 同上 §4 |
| 守卫本体不变：`sha256sum packages/replication-protocol/test/codec-route-key-guard.test.ts` | **`32aa83a5ffaa6a3c…`**（743 行）= SA3/SA4/SA9/SA10 四方登记值 | 同上 §4 |
| 红灯契约（守卫）复跑：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/replication-protocol/test/codec-route-key-guard.test.ts` | **19 passed (19)**、`Type Errors no errors`、`GUARD_EXIT=0` | 同上 §4（原始输出） |
| 新增证据日志自证 C1（emit 时断言） | `artifacts/sa3-issue419-index-reconcile.log`：**181 行/13563B/sha256 `34aa27a48fd58668aca601985cb565b6854fb419f71362a95c85bf73a716f80f`**；行尾空白 0、无 EOF 空行、`--no-index --check` rc=1 静默、规范化净变换 0 字节 | 终端实测（`LOG_*` 四断言） |
| 真实索引 sha256 轨迹 | pre `b66c9ebbf7423945…` → post(`git add` runner) `257d6c10c66dc592…` → post(stage 本日志) `f94411e668b4b7b6…`：每次写入均为本轮授权动作，无其他索引变更。**本报告 stage 之后的索引文件哈希不再登记**——它是本报告自身字节的函数（自指）；权威判据 = `git diff --cached --check` rc=0 + §17 登记值 + 资产 blob（下方收尾状态与门禁复跑） | 同上 §0/§1；`stage` 输出 |
| 收尾状态：`git status --porcelain -uall`（scratch 删除后）+ 冻结字节门禁复跑 | 仅 **11 条 staged 变更路径**；**无 unstaged 漂移、无 untracked 残留**（`.scratch/sa3-419-iter3` 已删除，`.scratch/` 仅剩仓内既有 `vfsl-v1-parser`）；`git diff --cached --check` **rc=0、零输出** | 终端实测（方法见 §F1 落盘收口-8） |

**断言面 ⊇ 探针（设计 §8.8 映射，逐组亲核）**

| 守卫组 | ⊇ 探针 id | 承载断言 |
|---|---|---|
| G1-a/b/c + G2-a/b | P1 | 头长 20 同源钉死、35 文法接受面 + UTF-8 字节数、运行时前缀观察、14 构造（13 型逐型 = 注册表 scope 推导集合）逐帧 `prefix@20`/`[21..56)`/decode 回读/scope、13 条 golden 双面 |
| G3-a…d | P2 | `kind@20`、`prefix@21`、`[22..57)`、`selectedCapabilities` 解码回读、`kind ≠ 0x23` 可判别、绑定块不位移（`indexOfBytes` 实测起点 = 22）、kind 三态枚举、3 条 chunk golden 双面 |
| G4-a…e | P3 | 独立走查器按 §13 序全消费（scope→code→fatal→retryable→relatedSequence?→namespaceId?→safeMessage，零尾随）、注册表同源 fatal/retryable、marker ∈ {0,1} 与 scope 等价、namespaceId 前缀 1B/值 35B、`[21..56)` 是 code 不得误纳、距离 ≤ 64、连接级字节级无 key、值面经 `decodeMessage` 交叉、最坏公式 |
| G5-a | P4 | 5 代表构造差分：等长、值域差窗 = 字段窗去 3 字节不变成分、窗前 1 字节 = 0x23、登记窗 = namespaceId 全量 |
| G6 NC1/NC2/NC3 | NC1/NC2/NC3 | 连接级无路由键且仍可解码；namespace-scope 恰 14 / ERROR=either / 固定规则适用 13 / chunk 不得被误纳；21 条语料 fixed=13 / chunk=3 / error=2 + 例外集合恰 8 元素 |

**计数契约自检（SA6 §12.6）**：≥13 型固定偏移（13 型 / 14 构造 + 13 golden）✓；≥6 chunk 组合（6）+ 3 golden ✓；
≥5 ERROR 用例（四象限 4 + fatal=false 1 + 最坏 1 + 2 golden）✓；3 负控 ✓；5 变异类（M1–M4 + NM1/NM2，两轮）✓。

**纪律自检（SA6 §3-4 / 设计 §8.7）**：`grep` 亲证零 `skip/only/todo`、零 `process.env`、零 `readFileSync`
（无源码文本消费）、零 `toMatch/RegExp`（无源码字符串断言）；断言只观察帧字节与公开 API 值面；裸偏移字面量
`21/22/56/57` 仅出现在注释散文与 G1-a 钉死用例（`grep -nE "[^0-9_](21|22|56|57)[^0-9_]"` 逐个核对）。

## Deferred verification

| 项 | 为什么不在 SA3 范围 | 建议承接方 |
|---|---|---|
| 门禁 3（CI 级）：根 `pnpm test` / `pnpm typecheck` | 技能明示 SA3 不承担全仓测试/更广回归；本票 diff = 单一测试文件 + 证据日志，包内全量（门禁 1/2）已覆盖受影响面 | SA7 / CI |
| 守卫文件在**真实** `src/` 之外的长期敏感性 | 已用「SA6 探针矩阵两轮（正式门禁）+ 守卫自身跑变异副本 6/6（补充）」双证据覆盖；无新增运行期面 | SA4/SA7 按其判断复核 |
| F1（布局事实升格为 `src/constants.ts` 导出，随 #420+ edge demux）、F2（§22 资产登记，Controller 可选） | SA8 §5/§7 明示属未来票决策面，本轮不预支 | Controller / #420+ 票 |
| 协议 §22 资产清单回退检查（D6-1 引用存在性） | 本票不改协议文档、不新增被引用资产 → D6-1 不受影响；包全量套件已含该检查并绿 | 已由门禁 1 覆盖 |
| **R1（iteration 1 新增；iteration 2 期望值更新）**：修复入库后的注册哈希终态复核 —— `git show HEAD:artifacts/sa6-issue419-runner-trigger.log \| sha256sum` 期望 **`23787bf1…`**（SA6 §17 C1 登记；iteration 1 的 `96abbb72…` 期望已被 §17/R5 取代）；另核 `git show HEAD:artifacts/sa3-issue419-f1-evidence-restore.log \| sha256sum` 期望 **`3b861d2d…`** | SA3 不执行 commit；且若 finalization 归一化器再次运行，C1 形对「末尾归一化」**幂等**（C1 恰一个末尾 LF），复发面已消除 | Controller（提交后终态复核） |
| **R3/R4（iteration 2 登记；iteration 3 已闭合）**：真实索引落盘 —— Controller 已按 R2/R3 落盘 f1 日志（C1）、契约、脚本、冲突日志、c1 日志与下游评审产物；唯一残留（runner 索引条目 = pre-C1 raw `c183ba29…`）由 **SA3 在本轮 dispatch 明示指令下**落盘为 C1 形（`git add` 单一路径），随后 `git diff --cached --check` 在**真实索引**上 **rc=0、零输出**（11 路径完整候选变更集）→ **本项已闭合** | 原技能边界（不执行 `git add`）被本轮更具体的 dispatch 指令 + SA6 §18.11 R1 staged 半边显式覆盖，且动作限定为单一路径索引条目（工作树零改写）；责任划分更新见 SA6 §18.11 与本报告「Deviations」第 6 条 | Controller（仅需复核，无需再落盘） |
| **R6（iteration 2，可选一键）**：`bash wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh --apply`（幂等；落盘哈希不符即 ABORT） | 同为索引写动作，属 Controller | Controller |
| **O3（iteration 1 观察，流程）**：对哈希注册资产一律现场重算 | 属评审方法面，非本票交付缺陷 | SA4/SA9 流程改进 |

## Deviations or blockers

无阻塞。以下 5 条为已登记的**增强性 / 授权性偏差**（均不改变验收语义、不弱化任何 SA6 红灯断言）：
1. **G1-b 多一条运行时窗口断言**：除设计 §8.1 字面要求的「encode 接受面 + `TextEncoder` 字节数 = 35」外，
   G1-b 还断言 codec **实际写出**的 `[21..56)` 窗口 = `NS`（把「钉死值与 codec 行为互证」落实到偏移面）。
   后果：守卫级补充证据首轮显示 M4（前导字段位移）额外点亮 G1-b（原始输出保留在证据日志中，未回改任何断言）；
   这是有意敏感面，非过紧——G1-b 仍以 codec 公开行为为唯一观察对象。
2. **采纳 SA2 O2/O3/O4**：最坏用例动态取最长 namespace 码（R4 预算红仍在位）、新增 `fatal=false` wire 样本、
   新增 grammar 拒绝方向用例（G1-d）。三者均在 ALLOW 文件内、均为加强而非放宽。
3. **补充性 scratch 诊断已删除**：守卫级变异驱动是临时诊断（`vitest.mutant.config.ts` 需临时别名配置，
   属工具范畴而非仓内资产），已在报告中登记其变异锚点/期望集合与全部原始输出；正式门禁仍由仓内长期资产
   `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts` 承载，可随时复现。
4. **（iteration 1）对 DENY 只读资产的「写」= F1 恢复**：`artifacts/sa6-issue419-runner-trigger.log` 的唯一改动
   是写回 SA6 产出原字节（`git hash-object` == `c183ba29…`；sha256 `23787bf1…` → `96abbb72…`），
   属 SA9 §3-F1 修复路径 1 与本轮 dispatch 明示授权，**消除**既有 DENY 违反而非扩大范围；除此之外
   无任何 DENY 路径被写（7 份 SA6 资产其余 6 份哈希逐项不变；SA6 契约/设计/简报/探针/驱动零改动）。
   该资产的**内容语义零变化**（仅尾部空行 1 个 LF），故 SA4/SA9 已确立的语义结论不受影响；交付本体与
   全部门禁结果不变（恢复后重跑：守卫 19/19、包全量 14 文件/233 测试、tsc exit 0）。
5. **（iteration 2）对同一 DENY 资产的「写」= C1 归一化（取代第 4 条的 raw 形）**：该资产的权威形由 SA6 §17
   修订为 C1 规范形后，iteration 1 的 raw 形（末尾 `\n\n`）被强制门禁判为 `new blank line at EOF`，
   **结构性不可提交**。本轮按 SA6 §18.11 **R1** 写入的字节 = HEAD 已提交 blob `46ff267d…`
   （sha256 `23787bf1…`）→ 该路径与 HEAD 无差异、**退出提交变更集**，DENY 偏离归零；f1 日志（非 DENY）
   按 R2 去掉第 20 行行尾空格（唯一 1 字节），raw `2932f2a7…` → C1 `3b861d2d…`。SA6 契约 §17/§18 与
   其脚本、冲突日志零改动（只读核对，10/10 MATCH）。业务测试语义零改动（包全量 14/233 + 0 类型错误、
   tsc exit 0、探针 7/7、RK-C6 6/6 expected）；真实索引未写（无 `git add`/索引命令），落盘 stage 属 Controller。
6. **（iteration 3）对真实索引的单路径写入 = 本轮 dispatch 明示授权的落盘动作**：dispatch 明确要求
   「Apply the approved C1 worktree form to the real index only as necessary」「ensure no raw runner-trigger asset
   remains staged」，与 SA6 §18.11 **R1** 的索引终态期望（blob `46ff267d…` / sha256 `23787bf1…`）及 SA8 §7-1
   的 Controller 落盘清单一致，故 SA3 执行了 `git add -- artifacts/sa6-issue419-runner-trigger.log`
   （**唯一索引写动作**；工作树资产字节零改写 —— 与 iteration 2 deviation 5 的 worktree-only 写互补）。
   该动作使 runner 路径与 HEAD 无差异、退出提交变更集（raw blob `c183ba29…` 不再被 stage），强制门禁
   `git diff --cached --check` 由 **rc=2（1 处）转 rc=0、零输出**（11 路径完整候选变更集）。新增证据日志与
   本报告的 stage 同属「使完整候选变更集自洽可提交」的必要动作；除此之外**无任何索引或工作树写入**。
   业务语义零改动（守卫 sha256 `32aa83a5…`/743 行、19/19 绿 + 0 类型错误、src/docs/CONTEXT.md/.editorconfig 零 diff）。

设计 §7.5 的两处 SA6 证据笔误已在实现中按设计采信：`UPDATE_CHUNK_U32_MAX` 按 fixtures 事实处理为
kind2 **非首**（无绑定块），kind1/kind2 首 chunk 绑定块形态由守卫内合成用例承担（G3-a/G3-b 断言首 chunk
必须携带绑定块形态）；NC3 语料计数以 21 为准（G6 断言 `GOLDEN.length === 21`）。

## Suggested commit message

```
test(#419): replication-protocol 路由键契约 codec 守卫测试（ADR 0032 §4 / spec #415 T1）

新增 packages/replication-protocol/test/codec-route-key-guard.test.ts（19 用例 / 6 组）：
namespace 域固定偏移 [21..56)（13 型 + OPEN identity 两态 + 13 条 golden 双面）、
UPDATE_CHUNK kind-first [22..57)（3 kind × 首/非首 + 绑定块不位移）、ERROR §13 字段序
（四象限 + fatal=false + 最坏 + 2 条 golden，独立最小读取器）、差分推导（零新增 codec 常量）、
布局事实单点登记 + 39 行头注维护契约、NC1–NC3 负控。

纯增量测试：src/、test/fixtures.ts、既有 13 个测试文件、wire/协议文档零改动；
门禁：包全量 14 文件/233 测试全绿 + 0 类型错误、包 tsc exit 0、src diff 为空、
SA6 变异矩阵两轮 6/6 expected（守卫自身跑变异副本 6/6，补充证据）。
```

**iteration 1（F1 返工）追加提交消息（历史记录；其终态期望已被 iteration 2 取代，勿直接采用）**

```
fix(#419): 恢复 SA6 只读证据资产 runner-trigger.log 的注册字节（SA9 F1）

SA9 §3-F1：artifacts/sa6-issue419-runner-trigger.log 在 SA3 完整性核对（22:55:44）
之后、提交（23:05:33）之前被静默归一化，已提交字节 sha256 23787bf1… ≠ SA6 §17
登记 96abbb72…，证据哈希链断裂。

处置：从对象库悬挂 blob c183ba296bbb886931b1b2adc2e24d4f930f0d7a（SA6 产出原 blob）
逐字节写回，sha256 复原为 96abbb72ecefdc3ad2b37bc8cfcdbb011e7c43b409c0b5f130c7a3e7a1b2e06c；
SA6 §17 全 7 份资产哈希 7/7 复核一致。漂移内容 = 文件尾空行的 1 个 LF（70 行/4322B
vs 69 行/4321B），全部内容行逐字节相同，语义零变化；守卫交付与 src 零改动
（守卫 sha256 32aa83a5… 不变；恢复后守卫 19/19、包全量 14 文件/233 测试、tsc exit 0）。

证据：artifacts/sa3-issue419-f1-evidence-restore.log（取证/恢复/复核/根因全记录）。
提交后请复核：git show HEAD:artifacts/sa6-issue419-runner-trigger.log | sha256sum
期望 96abbb72ecefdc3ad2b37bc8cfcdbb011e7c43b409c0b5f130c7a3e7a1b2e06c。
```

**iteration 2（C1 证据契约修复）追加提交消息（本轮的权威版本；取代上一条的终态期望）**

```
fix(#419): 证据契约归一 C1 规范形 + §17 重登记（SA6 §18 冲突裁决落实）

背景：iteration 1 按旧 §17 恢复的 runner-trigger.log 原始字节（96abbb72…，末尾 \n\n）
被 Controller 强制门禁 git diff --cached --check 判为 "new blank line at EOF"
（blank-at-eof）；f1 证据日志第 20 行行尾空格被同一门禁判为 trailing whitespace
（blank-at-eol）——旧登记把工具原始输出定为权威，与提交策略互不可满足。

落实（SA6 §17 C1 登记 + §18.11 R1/R2）：
- runner-trigger.log 归一为 C1 = HEAD 已提交字节 23787bf1a40c183b…（blob 46ff267d…，
  69 行/4321B）→ 该路径退出提交变更集；旧 raw 96abbb72… 保留为 legacy/superseded。
- f1 日志去掉第 20 行行尾空格（−1 字节 @0-based 1330）→ 3b861d2d…（blob 0996a324…，
  221 行/15420B）；旧 raw 2932f2a7… 保留为 legacy/superseded。
- §17 登记表 10/10 MATCH；门禁在私有索引副本上由红（2 处）转绿（rc=0，零输出）；
  真实索引未被 SA3 写入。

业务语义零改动：包全量 14 文件/233 测试全绿 + 0 类型错误、包 tsc exit 0、探针 7/7、
RK-C6 变异矩阵 6/6 expected；src/docs/CONTEXT.md/.editorconfig 零 diff。

证据：artifacts/sa3-issue419-c1-staging-verification.log（红→绿、私有索引证明、
变异反证、范围不变量全记录）。
提交后请复核：git show HEAD:artifacts/sa6-issue419-runner-trigger.log | sha256sum 期望 23787bf1…；
                git show HEAD:artifacts/sa3-issue419-f1-evidence-restore.log | sha256sum 期望 3b861d2d…。
```

**iteration 3（真实索引落盘）追加提交消息（落盘口径说明；取代 iteration 2 消息末段「真实索引未被 SA3 写入」）**

```
fix(#419): 真实索引落盘 C1 形 —— 消除残留 pre-C1 runner 资产，强制门禁转绿（SA6 §18.11 R1/R4）

背景：iteration 2 的 C1 修复只在工作树生效，真实索引的
artifacts/sa6-issue419-runner-trigger.log 条目仍为 pre-C1 raw blob c183ba29…（70 行/4322B），
Controller 强制门禁 git diff --cached --check 报
"artifacts/sa6-issue419-runner-trigger.log:70: new blank line at EOF."（rc=2，恰 1 处）。

落实（本轮 dispatch 明示授权 × SA6 §18.11 R1 staged 半边）：
- git add -- artifacts/sa6-issue419-runner-trigger.log：索引条目 → 46ff267d…（= HEAD 已提交
  字节 = 已批准 C1 工作树形，sha256 23787bf1…，69 行/4321B）→ 该路径退出提交变更集，
  索引中不再存在 raw blob c183ba29…；工作树资产字节零改写。
- git diff --cached --check：rc=2（1 处）→ rc=0、零输出（11 路径完整候选变更集）；
  11 条 staged 路径逐条暂存 blob 复算 C1 全 PASS；§17 登记 10/10 MATCH。

业务语义零改动：守卫 sha256 32aa83a5…（743 行）不变、19/19 绿 + 0 类型错误；
src/docs/CONTEXT.md/.editorconfig 与 staged 面均零 diff。

证据：artifacts/sa3-issue419-index-reconcile.log（pre/post 原始输出、C1 扫描、登记核对、
范围不变量、R5 期望）。提交后请复核 R5：runner 期望 23787bf1…、f1 期望 3b861d2d…。
```
