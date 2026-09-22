# SA3 Implementation Report — issue #442（lease 端到端：Record/parent 逐 entry 校验行为钉死，ADR 0034）

- 任务 slug：`issue-442`；iteration 0（无既有实现报告、无未提交实现需原位修订——见 §2）
- dispatch：`sa-ea4ea5f5-bc02-43a2-8a3c-204d243f1a78`（role `mabf-sa3`，phase implementation）
- HEAD：`c42fb47`（含 #441 `61778bc` `feat(doc-runtime): add record mutation fast path`）
- 结论：**实现完成，红灯契约转绿（33/33）**；零生产实现改动；根 gate 结果见 §6。

---

## 1. Inputs consumed

| 输入 | 位置 | 用途 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-442.md` | Issue 正文 / AC1–AC7 / Blocked by #441 / Comments 空 |
| 批准设计 | `wiki/raw/task_issue-442_design.md`（449 行） | ALLOW/DENY、§7.1–§7.5 落盘规格、§12 验证命令 |
| SA2 设计评审 | `wiki/raw/task_issue-442_sa2_review.md` | verdict **approve**、Required revisions 空、O-1..O-5 |
| SA8 设计冲突报告 | `wiki/raw/task_issue-442_design_conflict_report.md` | verdict **clear**、RA-1/RA-2/RA-3 |
| SA6 契约（approve） | `wiki/raw/task_issue-442_sa6_contract.md` | §12.1 绑定点、§12.2 schema、§12.3 逐 ID 冻结值、§12.4 纪律 |
| SA6 探针（可执行证据） | `wiki/raw/task_issue-442_sa6_capability_probe.mts`（1085 行） | fixture 装置/场景实测值的单源；本实现的结构模板 |
| SA6 证据日志 | `artifacts/sa6-issue442-*.log`（14 件） | HEAD 7 轮 31/31、baseline 4 轮 31/31、计数冲突核验 |
| 前置立法面 | `packages/namespace-registry/test/issue-437-lease-array-e2e-{fixture,contract,control}.ts` | 同目录结构先例（零 vitest fixture、testing seam、读计数、诊断/复制助手） |
| 母法 | `docs/adr/0034-…md`（+ 0033/0010/0011/0014/0026/0007 经设计与 SA8 承接） | 行为立法语义 |

**缺失输入（iteration 0，`ls wiki/raw` 核对）**：`task_issue-442_relevant_decisions.md`、
`task_issue-442_conflict_report.md`、`task_issue-442_sa4_review.md`、`task_issue-442_sa7_report.md`、
既有 `task_issue-442_sa3_impl.md`——均不存在；不影响实施（设计 §6 已以直读 ADR + SA8 设计后复查替代）。

## 2. Existing worktree reconciliation

- 本票 iteration 0：无既有实现报告、无未提交测试/实现。实施前 `packages/**` 无改动，
  `git diff --stat` 空；untracked 面仅 Host/SA6 上游产物（`wiki/raw/task_issue-442*`、
  `artifacts/sa6-issue442-*.log`）。
- 设计对 ALLOW LIST 与验收语义无修订需求（SA2 approve 无 Required revisions；SA8 clear + 三条
  Required actions 均为「非阻断勘误 / 验收口径 / 既定门」，见 §4）。
- 结论：按设计 §7.2–§7.4 一次性落盘，无需保留或删除历史实现。

## 3. Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/namespace-registry/test/issue-442-lease-record-e2e-fixture.ts` | §7.2（§7.2.1–§7.2.5） | **新建** 640 行共享 fixture（非测试入口，零 vitest 依赖）：冻结 schema/seed、`LeaseRecordPersistence`、`openLeaseFixture`/`openPeerFixture`、`applyRawRemote`、`readValue`/`readRecord`/`rawMapAt`、`countMapReadsAsync`（8 出口）、`settleUntil`/`flushAsyncFanout`、诊断与复制助手 |
| `packages/namespace-registry/test/issue-442-lease-record-e2e-contract.test.ts` | §7.3（29 its） | **新建** 603 行契约测试：A1–A11（AC1）、B1–B8（AC2）、U3–U4（AC3）、V1–V3（AC4）、E1–E2（AC5）、R1–R3（AC6） |
| `packages/namespace-registry/test/issue-442-lease-record-e2e-control.test.ts` | §7.4（4 its） | **新建** 154 行负控测试：C1–C4（恒绿 + A/B 对照） |
| `artifacts/sa3-issue442-focused-stability.log` | §12 验证命令 1/5（Host 证据目录） | 聚焦面 3 轮证据 |
| `artifacts/sa3-issue442-root-typecheck.log` | §12 验证命令 2 | 根 typecheck 证据（`ROOT_TYPECHECK_EXIT=0`） |
| `artifacts/sa3-issue442-root-test.log` | §12 验证命令 3 | 根 test 证据 |
| `artifacts/sa3-issue442-baseline-discrimination.log` | §12 验证命令 4（可选） | 交付测试在 `3fd6aa8` 的判别性证据（15 红 / 18 绿） |
| `wiki/raw/task_issue-442_sa3_impl.md` | skill 固定产物 | 本报告 |

**生产实现零改动**：`packages/**/src/**`、`vitest.config.ts`、根 `package.json`、`pnpm-lock.yaml`、
`docs/**`、`CONTEXT.md`、上游 `wiki/raw/task_issue-442_{md,design.md,sa6_*}` 全部未触碰
（`git diff --stat` 空，见 §5）。

## 4. SA2 / SA8 Finding 落实

| Finding | 级别 | 实现 | 结果 |
|---|---|---|---|
| SA2 §13 Required revisions | — | 表为空（无 BLOCKER/MAJOR） | 无需动作 |
| SA2 O-1（§10 调用方矩阵对比措辞不精确：doc-runtime tsconfig 含 `test/**`，registry 仅 `src/**`） | MINOR（无需动作） | 实测复核：`packages/namespace-registry/tsconfig.json` include 仅 `src/**/*.ts` ⇒ 新测试不在包 tsc 面；本报告 §6 记录根 typecheck exit 0 | 不阻断，已如实记录 |
| SA2 O-2（「ADR 0034 决策 6 软验收」条款指针滑差） | MINOR（同上） | 与 SA8 RA-1 同源；本实现的成本断言只用机器无关读计数（≤8 / ≥n / 跨 n 相等），未钉毫秒 | 行为合规 |
| SA2 O-3（settle 轮数 200 vs 400 的「同款」措辞） | MINOR | fixture `settleUntil` 默认 400（与直接证据源探针一致），`flushAsyncFanout` 24 轮 setImmediate | 不阻断 |
| SA2 O-4（A8/B2 加「零 update」与「不擅自加严」声明微冲突） | MINOR（无需动作） | 照设计表落盘，并把 SA6 §12.1 B-8 三面锚补齐（见 §8 偏离 1）：`stateBytes` 逐字节 ∧ `updateEvents` 差值 ∧ `ownedUpdates` 差值（拒绝在事务前 fail ⇒ 三面被零写入语义蕴含，不可伪红；实测旧新两面该 18 条不变量组同绿） | 不阻断 |
| SA2 O-5（registry 测试文件不在任何静态 tsc 面） | MINOR（无需动作） | 实测确认（同 O-1）；vitest 运行时转换零类型错误（`Type Errors: no errors`） | 不阻断 |
| SA8 RA-1（设计 §1/§7.7 误引「ADR 0034 决策 6」为软验收出处） | 非阻断勘误 | 实现期备注（本报告即 RA-1 指定的备注位）：性能软验收的规范出处是 **ADR 0034 后果-验证基准条款**（「基准测试…耗时与 n 解耦」）+ **ADR 0033 决策 6**（不钉绝对毫秒）；本票不触碰设计文件，断言面完全符合真实条款 | 已登记 |
| SA8 RA-2（按枚举 33 落盘，验收准绳 = 零 skip + 逐 ID 覆盖 §12.3 全表） | 实现期验收口径 | 落盘 **契约 29 + 负控 4 = 33**；零 skip/only/todo；SA6 §12.3 全表 33 个 ID 逐一在位（§5 清单） | 达成 |
| SA8 RA-3（既定门：根 typecheck/test + 聚焦面 33 全绿） | 既定门 | §6 逐条复跑 | 达成（root test 见 §6 行 3） |

## 5. File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-registry/test/issue-442-lease-record-e2e-fixture.ts` | ALLOW §11 行 2 | §7.2 全部装置（契约/负控共用） |
| `packages/namespace-registry/test/issue-442-lease-record-e2e-contract.test.ts` | ALLOW §11 行 3 | §7.3 AC1–AC6 立法（29 its） |
| `packages/namespace-registry/test/issue-442-lease-record-e2e-control.test.ts` | ALLOW §11 行 4 | §7.4 负控 A/B 对照（4 its） |
| `wiki/raw/task_issue-442_sa3_impl.md` | skill 固定产物（设计 ALLOW 未列，属 SA3 报告固定位置） | 本报告 |
| `artifacts/sa3-issue442-*.log` | 设计 §11 括注（Host 侧证据目录惯例，不算范围扩大） | 验证证据 |

范围核对（命令实测）：`git diff --stat` 空（零 tracked 改动）；`git status --short packages/` 恰为上述
3 个新测试文件；`packages/**/src/**`、适配器/配置/规范文档/DENY LIST 路径零改动。测试文件 ID 清单
（逐 ID 覆盖 SA6 §12.3 全表）：
`A1 A2 A3 A4 A5 A6 A7 A8 A9 A10 A11 B1 B2 B3 B4 B5 B6 B7 B8 U3 U4 V1 V2 V3 E1 E2 R1 R2 R3`（29）+
`C1 C2 C3 C4`（4）= **33**。零 `skip`/`only`/`todo`（`grep` 实证）。

## 6. Verification

| # | Command | Result | Evidence |
|---|---|---|---|
| 1 | `npx vitest run packages/namespace-registry/test/issue-442-lease-record-e2e-{contract,control}.test.ts` | **2 files / 33 tests passed**，`Type Errors: no errors`，exit 0 | `artifacts/sa3-issue442-focused-stability.log`（3 轮逐轮同计数） |
| 2 | `pnpm typecheck` | **exit 0**（15 包 tsconfig 全过；`ROOT_TYPECHECK_EXIT=0`） | `artifacts/sa3-issue442-root-typecheck.log` |
| 3 | `pnpm test`（= `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`） | **473 files / 5790 tests passed**，`Type Errors: no errors`，exit 0（起点 471/5757 ⇒ 文件 +2、用例 +33） | `artifacts/sa3-issue442-root-test.log` |
| 4 | 可选判别性复核：detached worktree @ `3fd6aa8`（pre-#441）+ 复制三文件后跑同聚焦面 | **15 failed \| 18 passed (33)**，失败 ID 恰为设计 §12 命令 4 的判别组 **A1–A11、U3、U4、V3、R3**；失败原因恰为旧语义（`ok:false` 连带拒绝 / A8 `载体错位（ROOT.deep）` vs 静态必填 / fast 轨读计数 `259` ∝ n） | `artifacts/sa3-issue442-baseline-discrimination.log`；worktree 已 `git worktree remove --force` 清理 |
| 5 | 聚焦面复跑 3 轮（稳定性） | 3 × 33/33，零 flakes | `artifacts/sa3-issue442-focused-stability.log` |

**红灯 → 绿灯**：本票为**回归立法票**（Issue 正文「不改实现」）。指定红灯契约 = 设计 §7.3/§7.4 的
33 条用例规格；其判别面在 pre-#441 `3fd6aa8` 实测 15 条红（第 4 行），在 HEAD `c42fb47` 全绿
（第 1 行）——无需任何生产改动，与 SA6 §5.2/§5.3 逐条一致。

## 7. Deferred verification

| 项 | 原因 | 建议归属 |
|---|---|---|
| S9 安装事实核 / E201-C 触达面内同事务 observer 篡改 / `DocRuntimeFatalError` 面 / commit 字节 vs 手写 edit 等价 | 设计 §1 非目标 + §7.6：lease seam 不可观察重投影核，#441 FC/NB/NA/ND 组已锚 | #441 面（已合） |
| raw 污染的异步/抽样审计 | ADR 0034 决策 4 明文「需要时另行设计」 | 独立 follow-up（非本票 AC） |
| 合法性重建与 carrier 覆盖面审计 | `CONTEXT.md` 已登记 follow-up | 独立 follow-up |
| 长时/大规模基准（毫秒级） | ADR 0034 后果-验证基准条款 + ADR 0033 决策 6 软验收；本票只用机器无关读计数 | 不适用本票 |
| 真实网络复制（ws-replication）+ 跨进程持久化 | 设计 §8「同一进程内两个 Registry 实例，传输面为 Yjs update bytes」 | 非本票 AC（AC6 为进程内 session 面烟测） |

## 8. Deviations or blockers

无阻塞。两处**非软化**的实现决策，均落在设计/契约既有语义的蕴含面：

1. **拒绝分支零写入锚按 SA6 §12.1 B-8 三面补齐**（状态字节逐位不变 ∧ `updateEvents` 差值 0 ∧
   `ownedUpdates` 差值 0，后者在有界 `flushAsyncFanout`（24 轮 setImmediate）排空后断言）。
   设计 §7.2.3 对复制 fixture 的零写入锚本就描述为三面，SA6 B-8 亦以三面定义「拒绝分支零写入」；
   设计 §7.3 前言把 `update` 面标注收窄到部分行，SA2 O-4 已裁定该维度「被零写入语义蕴含、
   不可能伪红」。本实现把三面对**全部**拒绝分支（A8、B1–B4、B6 重复删、B7、B8、V2、C1、C4）统一
   落盘：无新增验收语义、零断言弱化、旧新两面实证同绿（18 条不变量组在 `3fd6aa8` 与 HEAD 均绿）。
2. **B6 重复 delete 前先 `waitForOwnedUpdates(fx, 1)` 结算首删扇出**，再取重复 delete 的前后差值。
   理由：owned update 为异步扇出，若在首删扇出到达前取差值，排空会把首删的 owned update 计入，
   造成伪红。此为差值断言的装置前提，不是验收面变化。

另：SA6 §1/§13 的「契约 30 + 负控 4 = 34 → 5791」与其 §12.3 逐 ID 枚举（29 + 4 = 33）不符；
SA1 设计 §5/R-6 与 SA8 报告 §2 行 15 均已裁定**以枚举 33 为准**（算术笔误）。落地实测
**用例 +33、根 test 5757 → 5790**，与该仲裁一致（`artifacts/sa3-issue442-root-test.log`）。

## 9. Suggested commit message

```
test(namespace-registry): pin lease Record/parent elementwise validation e2e (ADR 0034)

Add the highest-seam regression trio for issue #442 — the lease mutateData
end-to-end behavior and invariants delivered by ADR 0034 (via #441):

- issue-442-lease-record-e2e-fixture.ts: shared, vitest-free fixture (frozen
  VFSL schema/seed, Registry testing seam, raw-replication pollution via
  session.applyRemoteUpdate, Y.Map read counters, diagnostic/replication helpers)
- issue-442-lease-record-e2e-contract.test.ts (29 its): AC1 polluted
  Record/parent writes no longer collateral-reject (A1-A11), AC2 verbatim
  domain rules and zero-write rejection (B1-B8), AC3 union map stays legacy
  (U3/U4), AC4 value-position union stays on the fast path (V1-V3), AC5
  diagnostic record/carrier shape (E1/E2), AC6 replication convergence (R1-R3)
- issue-442-lease-record-e2e-control.test.ts (4 its): union-map rejection,
  clean legacy path, cost proportional to n, in-surface carrier rejection

Zero production changes. Discrimination: 15 its (A1-A11, U3, U4, V3, R3) fail
under pre-#441 3fd6aa8 with old collateral-rejection semantics; 18 invariants
stay green on both revisions. Root gates: pnpm typecheck exit 0; pnpm test
473 files / 5790 tests passed.
```
