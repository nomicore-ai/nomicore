# SA3 Implementation Report — issue #451（γ-T5）：观测面锚定与全量回归收官

- Dispatch：`sa-12455bc0-230e-46c5-b908-d9e62ff8912b`（mabf-sa3 / implementation / **iteration 1**）
- Worktree：`/home/wangjian/nomicore-fix-issue-451`（分支 `mabf/issue-451`，HEAD `68ab9f5`，全程未前移）
- 结论：**实现面已与批准设计（SA1 iteration 1）及 SA6 rev2 验收契约同变更集一致，本轮无需新增代码改动**——
  `ANCHOR-ORDER-C1` 非确定性已按批准的 rev2 判据边界消解（契约本体 = SA6 rev2，sha 钉死，SA3 零触碰）；
  D2 文档登记（`packages/ws-replication/AGENTS.md:18`，+1 行）在案件并未被破坏。
  本轮 SA3 动作 = 核对该边界**在位**并按设计 §12（EV-1..EV-8）**复跑门禁留证**：
  EV-1 聚焦契约独立进程 **40/40 绿**（修订前 4/30 红）、EV-2 包套件 **3× 105 files / 945 tests 全绿**、
  AC3 矩阵 **20 files / 273 tests 全绿**、包 tsc exit 0、根 typecheck exit 0、根 `pnpm test` **2 次独立样本 468 files / 5675 tests 全绿**。
  无 blocker、无偏离、无 ALLOW 外写入。
- 本报告**原位取代** iteration 0 的 `reject` 报告（其 §7 契约非确定性阻塞已由 SA6 rev2 边界闭合，见 §2/§6）。

---

## 1. Inputs consumed

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-451.md`（Host 简报；issue `open`；5 条 AC；Comments 空） | 存在 | 需求全集 |
| `wiki/raw/task_issue-451_design.md`（SA1 **iteration 1**，rev2 对齐修订，381 行） | 存在 | 实施依据：§7-D1（rev2 基线 + sha 钉死）、§11 ALLOW/DENY、§12 验收映射（EV-1..EV-8）、§13 风险 |
| `wiki/raw/task_issue-451_sa2_review_r2.md`（SA2 **iteration 2**：`approve`；无 BLOCKER/MAJOR；N-A..N-F MINOR） | 存在 | 设计评审核验面（本轮 SA3 无待办 finding） |
| `wiki/raw/task_issue-451_sa6_contract.md`（SA6 **rev2**：§12.5 边界裁定 + EV-1..EV-8 + §15 B-1） | 存在 | 验收契约与门禁命令集 |
| `wiki/raw/task_issue-451_design_conflict_report.md`（SA8 **iteration 2** = R-2 修订后复查：`clear`，`requiresConflictRecheck=false`） | 存在 | 冲突结论 + §8 移交登记（门禁复跑 / EV-7 收尾 / 人工合并） |
| `wiki/raw/task_issue-451_sa3_impl.md`（本文件，iteration 0 版为 `reject`） | 存在 | 原位更新对象（§7 根因链历史证据保留引用） |
| `task_issue-451_sa2_review.md`（iteration 1）/ `_relevant_decisions.md` / `_conflict_report.md` / `_sa4_review.md` / `_sa7_report.md` | iteration-1 评审在案（历史）；其余**不存在** | 无前置门禁产物、无 SA4/SA7 返工输入 |
| Owner 评论 | REST 快照 `[]`（派工时点 2026-09-22T14:09Z；此前 12:33–13:57Z 八个时点连续为空） | 无 owner 追加要求 |

## 2. Existing worktree reconciliation

| 面 | 事实（本会话复核） | 处置 |
|---|---|---|
| `test/ws-replication-issue451-gamma-observability-anchor.test.ts` | sha256 `4a8556bbecb775fd70a054051ee6599f9600ea01e9a26700a4818ad683bc3b4c`，**432 行 / 9 用例**，与设计 §7-D1/§11 DENY 钉死值与 SA6 §12.1/SA8 iter-2 三方一致 | **已是批准 rev2 边界 ⇒ 无需也无权改写**（DENY：再修改须 SA6 边界裁定 + 证据链 + 冲突复查）。「应用批准边界」的实现动作 = 核对其在位（§6 EV-1/边界审计） |
| — rev2 边界逐点核对 | `anchorProjection` `:118-133` 键集 = `type/side/namespaceId/sequence`（**无 `bytes`**）；跨调度 `toEqual` `:371`；逐轮自证 `:372-389`（`sent/acked.bytes === payloadBytesOfFrame(round, seq)` + `acked.sequence === sent.sequence`）；缺帧响亮 throw `:139-145`；ORDER-C2 因果门 `:398-431` 未动 | 与 SA6 §12.5 裁定、设计 §7-D1/§8 第三行逐字一致（`artifacts/sa6-issue451-sa3-r2-boundary-audit.log`） |
| — 全文件 `bytes` 断言形态审计 | 全文 15 行含 `bytes` 字样（含头注释与就地说明）；`.bytes` 字段引用 8 行，其中 **5 处为断言**（`:173` EDGE-C1、`:202` EDGE-C2、`:277` SESSION-C1、`:381`/`:385` ORDER-C1 逐轮），全部对**本轮** wire 载荷自证；另 1 处为占位探测帧字段读取（`:88`）、2 处为断言消息模板（`:382`/`:386`）。无任何跨 boot 字节相等断言 | rev1 形态（投影含 `bytes`）**零残留在位** |
| `test/ws-replication-issue451-gamma-surface-freeze.test-d.ts` | sha256 `ef897240096c78a0b45e04cb5cc77f777a351b744a720f86c72a892520c42184`，74 行（3 用例 + 2 处活体 `@ts-expect-error` `:66/:72`） | 零改动（DENY） |
| D2 文档登记（O-1/O-2） | `packages/ws-replication/AGENTS.md:18` 单 bullet 在位；`git diff --stat` = **1 insertion / 0 deletion**；`git diff --check` exit 0；引用符号 `handleReceipt`（`hub-session-async-host.ts:70`）、`ACK_STATE_VIOLATION` 1002（`hub-namespace.ts:693-700`）、夹具 `test/issue447-async-seam.ts:539` 全部可解析 | **维持态，未再编辑**（设计 §11 ALLOW 行 2：再编辑需新裁定） |
| 生产零改动不变量 | `git status --short packages/ws-replication/src/` 在本轮**全部门禁前后均为空**；`test/` 目录零 `zz-*` 残留 | 维持（M1/M2/M3 未重跑，见 §7） |
| HEAD / 基线 | `68ab9f5bfe4df66a54faddf759709a76914332d0`（与设计头部、SA8 iter-2 一致，未前移） | 设计 §13 R-4 的过期条件未触发 |
| 既有未提交实现 | 无待修正的过时/冲突实现：iteration 0 唯一的实现产物 = D2 文档 bullet（符合设计且已核），其阻塞项是契约 flake（非实现缺陷） | 无需删除或改写任何实现文件 |

## 3. Changed paths

| Path | Design section | Change |
|---|---|---|
| `artifacts/sa6-issue451-sa3-r2-contract-determinism.log` | §12 EV-1 | 新增：聚焦契约文件 **40 次独立进程** 采样（`totals: FAIL=0 PASS=40`） |
| `artifacts/sa6-issue451-sa3-r2-contracts-and-typecheck.log` | §12 AC1 / AC2 | 新增：anchor 契约单次详版（9 passed）+ surface 类型契约（3 passed TS） |
| `artifacts/sa6-issue451-sa3-r2-package-suite-3x.log` | §12 EV-2 / AC4-a₂ | 新增：包套件 3 次独立运行（3× 105 files / 945 tests 全绿） |
| `artifacts/sa6-issue451-sa3-r2-matrix-and-tsc.log` | §12 AC3 / AC4-a₁ | 新增：listen/β 矩阵 + parity guard（20 files / 273 tests）+ 包 tsc（exit 0） |
| `artifacts/sa6-issue451-sa3-r2-root-typecheck-test.log` | §12 AC4-b / AC4-c / EV-7 | 新增：根 `pnpm typecheck` + 根 `pnpm test` ×2 + 收尾不变量核对 |
| `artifacts/sa6-issue451-sa3-r2-clientid-probe.log` | §12 EV-6 | 新增：RNG 根因探针复跑（宽度类 1:1；抽签率复算） |
| `artifacts/sa6-issue451-sa3-r2-boundary-audit.log` | §7-D1 / SA6 §12.5 | 新增：契约边界静态审计（投影键集 / 逐轮自证 / 响亮 throw / `bytes` 断言全量枚举） |
| `artifacts/sa6-issue451-sa3-r2-doc-check.log` | §12 AC5-b | 新增：D2 单 bullet diff、`git diff --check`、引用符号核对、零 `zz-` 残留 |
| `artifacts/sa6-issue451-sa3-r2-file-set.log` | §12 AC3 | 新增：AC3 命名文件集枚举（恰 20 个 `.test.ts`/`.test-d.ts`；2 个夹具不计入） |
| `wiki/raw/task_issue-451_sa3_impl.md` | skill 固定产物 | 原位更新（本报告，取代 iteration 0 的 `reject` 版） |

**未改动**：`packages/ws-replication/src/**`（DENY）、两 #451 契约文件（DENY，sha 为证）、全部夹具与既有测试（DENY）、`packages/ws-replication/AGENTS.md`（D2 维持态）、`docs/protocols/**`、`docs/adr/**`、`CONTEXT.md`（DENY）、`.git`（无 add/commit/push/PR）。

## 4. Finding 落实（SA2 / SA8 / SA6 / SA3 自身）

| Finding ID | 来源 | 实现 | Result |
|---|---|---|---|
| F-1（BLOCKER，12 项）/ F-2（MAJOR）/ N-1（MINOR） | SA2 iteration 1 | 均为**设计侧**修订义务，SA1 iteration 1 已执行；SA2 iteration 2 复核判全部闭合（`sa2_review_r2.md` §13） | closed（非 SA3 面） |
| N-A / N-B / N-C / N-D / N-E / N-F | SA2 iteration 2（MINOR 观察项） | 全部指向 SA1/SA6 文本的引用归位、指针笔误、EV-6 措辞、ALLOW 行范围表述与锚点漂移；**均不改变任何可执行判据**，其中 N-F 明确维持「不修改冻结测试文件」的处置 | n/a（无实现动作；未改动契约文件） |
| SA8 iter-2 §8 移交登记①「终验阶段按设计 §12（EV-1..EV-8 口径）复跑门禁并留证」 | SA8 iteration 2（`clear`） | 本轮执行：EV-1/EV-2/EV-3（AC4-c）/EV-6/EV-7 全跑并落新日志（§6） | applied |
| SA8 iter-2 §8 移交登记②「EV-7 收尾核对（src 恒空 / 两契约 sha / HEAD 未前移）」 | 同上 | 门禁前后两次核对：src 空、sha 双值不变、HEAD 未前移（§6 EV-7 行） | applied |
| SA8 iter-2 §8 移交登记③「AC5 尾句转人工合并」 | 同上 | 非 SA 权限；本报告 §7 登记为移交项，SA3 零 git 生命周期操作 | deferred（人工） |
| SA2 iter-0 N-2/N-3（D2 文案润色）与 SA8 N1（引用符号核对门） | SA2/SA8 iteration 0 | D2 bullet 在案；本轮复核符号仍可解析（`-sa3-r2-doc-check.log`） | applied（维持） |
| SA6 §12.5 边界裁定（跨调度只比较调度不变量；`bytes` 单轮自证） | SA6 rev2 | 契约本体即为该形态；本轮以静态审计 + 40 次独立进程采样证实 0 假红（§6） | verified |
| SA3 iteration 0 §7（reject：契约非确定性） | 本文件前版 | 已由 SA6 rev2 边界修订闭合；本报告原位取代，§7 历史根因链保留为修订史证据 | superseded/closed |

## 5. File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `artifacts/sa6-issue451-sa3-r2-contract-determinism.log` | §11 ALLOW 行 3（`artifacts/sa6-issue451-*.log` 族） | EV-1 确定性证据 |
| `artifacts/sa6-issue451-sa3-r2-contracts-and-typecheck.log` | 同上 | AC1 + AC2 证据 |
| `artifacts/sa6-issue451-sa3-r2-package-suite-3x.log` | 同上 | EV-2 证据 |
| `artifacts/sa6-issue451-sa3-r2-matrix-and-tsc.log` | 同上 | AC3 + AC4-a₁ 证据 |
| `artifacts/sa6-issue451-sa3-r2-root-typecheck-test.log` | 同上 | AC4-b + AC4-c + EV-7 证据 |
| `artifacts/sa6-issue451-sa3-r2-clientid-probe.log` | 同上 | EV-6 证据 |
| `artifacts/sa6-issue451-sa3-r2-boundary-audit.log` | 同上 | §7-D1 边界在位证据 |
| `artifacts/sa6-issue451-sa3-r2-doc-check.log` | 同上 | AC5-b 证据 |
| `artifacts/sa6-issue451-sa3-r2-file-set.log` | 同上 | AC3 文件集核实 |
| `wiki/raw/task_issue-451_sa3_impl.md` | skill 固定产物（非设计面路径） | 实现报告（原位更新） |

无 ALLOW 外路径写入；无范围扩张；无 DENY 面写入（两契约文件 sha 不变、`src/**` status 恒空为客观证据）。

## 6. Verification

运行环境：Node v24.13.0 / vitest 3.2.7 / pnpm 10.28.2 / tsc 5.9.3；`NODE_OPTIONS=--conditions=nomicore-source`；全部为仓库真实入口，无 skip/only/todo、无 env override、无断言软化。

| # | 命令 / 入口 | 结果 | 证据 |
|---|---|---|---|
| **EV-1** 契约确定性 | `npx vitest run packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts` ×40（独立进程） | **FAIL=0 PASS=40**；每次 `Tests 9 passed (9)`、exit 0；日志内零 `AssertionError`、零非零 exit | `artifacts/sa6-issue451-sa3-r2-contract-determinism.log` |
| **AC1-a/b/c** 归属锚 + 无全序判据 | 同上（单次详版） | `1 passed (1)` / **9 passed (9)**、`Type Errors: no errors`、exit 0 | `-sa3-r2-contracts-and-typecheck.log` |
| **AC2** 公共面 append-only（类型面） | `npx vitest run --typecheck …/ws-replication-issue451-gamma-surface-freeze.test-d.ts` | `TS … (3 tests)` / **3 passed (3)**、`Type Errors: no errors`、exit 0（2 处 `@ts-expect-error` 均被触发：`no errors` ⇒ 无 TS2578） | 同上 |
| **EV-2 / AC4-a₂** 包套件 | `npx vitest run packages/ws-replication` ×3 | 3 次均 **105 files / 945 tests 全绿**、`Type Errors: no errors`、exit 0 | `-sa3-r2-package-suite-3x.log` |
| **AC3** 矩阵 + parity guard | `npx vitest run --typecheck '…issue418' '…issue420' '…issue421' '…issue423' '…issue424'` | **20 files / 273 tests passed**、`Type Errors: no errors`、exit 0；命名集枚举 = 恰 20（夹具 2 个不计入） | `-sa3-r2-matrix-and-tsc.log` + `-sa3-r2-file-set.log` |
| **AC4-a₁** 包 tsc | `npx tsc -p packages/ws-replication/tsconfig.json` | exit 0（零输出） | `-sa3-r2-matrix-and-tsc.log` |
| **AC4-b** 根 typecheck | `pnpm typecheck`（15 段 tsconfig 链） | exit 0 | `-sa3-r2-root-typecheck-test.log` |
| **AC4-c / EV-3** 根全量测试 | `pnpm test` ×2（独立样本） | run1：**468 files / 5675 tests 全绿**、`Type Errors: no errors`、exit 0（433.96s）；run2：**468 / 5675 全绿**、exit 0（416.76s）；两次均逐文件列出 #451 两契约（anchor `9 tests` / surface `TS 3 tests`） | 同上 |
| **EV-6** RNG 根因回归（复跑探针） | `node artifacts/sa6-issue451-clientid-probe.mjs` | 宽度 1..5 ⇒ 15/18/21/**24**/**27** 字节、`clientIDByteRuns=3`、宽度 4→5 步长 **+3**；200k 抽样 width4 p=0.062130 / width5 p=0.937415 ⇒ 预测跨轮不匹配率 **0.117393**（与 SA6 0.116521 相容） | `-sa3-r2-clientid-probe.log` |
| **EV-7** 不变量（sha 门） | `git status --short packages/ws-replication/src/`；`sha256sum` 两契约；`git rev-parse HEAD`；`git diff --stat AGENTS.md` | src **恒空**（门禁前 + 门禁后各一次）；anchor = `4a8556bb…bc3b4c`、surface = `ef897240…c42184`（前后一致）；HEAD = `68ab9f5`（未前移）；`AGENTS.md` = **1 insertion / 0 deletion** | `-sa3-r2-root-typecheck-test.log` + `-sa3-r2-doc-check.log` |
| **AC5-b** D2 登记收尾 | `git diff --check`；bullet 计数；引用符号解析；`zz-` 残留 | `git diff --check` exit 0；bullet 恰 1 处；`handleReceipt`/`ACK_STATE_VIOLATION` 1002/夹具路径全部解析成功；`test/` 零 `zz-` 残留 | `-sa3-r2-doc-check.log` |
| 边界在位（静态） | `anchorProjection` 键集 / 逐轮自证 / 响亮 throw / `bytes` 断言全量枚举 | 键集无 `bytes`；5 处 `bytes` 断言全为单轮自证（`:173`/`:202`/`:277`/`:381`/`:385`）；缺帧 `throw`（`:141-143`）在位；无 rev1 残留 | `-sa3-r2-boundary-audit.log` |

**红→绿判读（本票核心）**：同一契约在 rev1 边界下间歇红（SA3 iteration 0：包套件 **3/7 红**，红灯恒为 `ANCHOR-ORDER-C1`，`bytes` 24 vs 27；SA6 聚焦采样 **4/30 红**；理论不匹配率 11.65%/对）。按批准的 rev2 边界（跨调度投影剔除 RNG 派生量 `bytes`、改逐轮对本轮 wire 载荷自证）后，本轮 **40/40 聚焦 + 3×包套件 + 2×根全量 = 0 红**；若旧机制仍在，40 连绿概率仅 ≈ 0.7%（0.883479^40），故为因果修复而非抽样运气。SA3 未改任何断言：确定性来自契约 owner（SA6）依 SA8 §10 条件 2 授权的一次性边界修订，设计 §7-D1 已将其钉死（sha）并禁止回退。

## 7. Deferred verification

| 项 | 说明 |
|---|---|
| EV-4 / EV-5（M1/M2/M3 mutation 敏感性） | 设计 §1 非目标第 8 条与 §12 EV-4/EV-5 明示**不重跑**（证据闭合于 `rev-mutations-M1-M2-M3.log` + `rev-M3-boundary-compare.log`；重跑需临时改生产源码，违反零生产改动纪律）。本轮全门禁绿、无退化疑点 ⇒ 触发条件未成立 |
| AC5-a（ADR A4 / §24 一致性核对） | 采信 SA6 §12.4（18 条款全「一致」）+ SA8 iteration 2 `clear`；HEAD 未前移 ⇒ 设计 §13 R-4 的重核条件未触发 |
| AC5-c（PR #446 转人工合并） | 人工动作，非 SA 权限（SA8 iter-2 §8 同判）；本会话零 `git add/commit/push/PR` |
| SA4/SA7 终验 | 非 SA3 职责；材料 = rev2 契约（钉 sha）+ rev2/本轮证据族 + 设计 iteration 1 + D2 落地态 |
| SA2 iter-2 N-A..N-F | 文本级建议（引用归位/指针/措辞）；如需落笔属 SA1/SA6 面，且 N-F 明确维持不改冻结文件 |

## 8. Deviations or blockers

1. **无阻塞、无偏离。** 本轮结论为「实现面已达标 ⇒ 复核 + 留证」而非新增改动，原因是：批准的 rev2 契约边界已由契约 owner（SA6，经 SA8 §10 条件 2 授权的一次性例外）落地并经 SA8 iteration 2 复查 `clear`，设计 §7-D1/§11 DENY 明令终验阶段不得再改该文件。SA3 若改写契约即为越权与 DENY 违约；因此「应用批准的契约边界」在本 worktree 上的正确实现动作 = 确认边界在位（静态审计）+ 以真实入口复跑证明 0 假红（EV-1/EV-2/EV-3）。
2. **未修改任何生产/测试/夹具/文档文件**：`src/**` status 恒空、两契约文件 sha 与批准值逐字相同、`AGENTS.md` 维持 +1 行；无 fallback、无 env override、无 skip/only/todo、无断言改写。
3. **证据文件命名**：本轮新增 9 份 `artifacts/sa6-issue451-sa3-r2-*.log`（`-r2-` 中缀），不覆盖 iteration 0 的 `-sa3-*` 族与 SA6 的 `rev-*` 族（历史证据保留）。
4. 无缺失环境：全部命令离线可复现（store 命中，零网络）。

## 9. Suggested commit message

> 本轮相对 HEAD 的 tracked 变更仍只有 D2 一处（`packages/ws-replication/AGENTS.md` +1 行）；新增证据均为 untracked 日志 + 本报告，不产生新的 tracked diff。

```
docs(ws-replication): register γ bridge transport and observability obligations (#451)

Register the host-side γ seam duties (dedicated FIFO channel pair, synchronous
receipt at the edge stamp point, loud receipt-clause violations) and the
two-sided observability discipline (update-sent at the edge factory observer;
session-domain settlement events at the session host observer; no total order
across threads) in the module Boundaries section, per SA6 O-1/O-2.
Protocol §24.2/§24.8 and ADR 0032 A4.2/A4.7 remain the authoritative sources.

Verification (SA3 iteration 1, HEAD 68ab9f5, anchor sha 4a8556bb…, src untouched):
EV-1 focused contract 40/40 green; package suite 3x 105 files / 945 tests;
matrix 20 files / 273 tests; package tsc + root typecheck exit 0;
root pnpm test 2x 468 files / 5675 tests, Type Errors: no errors.
```
