# SA3 Implementation Report — issue #421（spec #415 T4）：Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章

- 迭代：**2**（SA4 迭代 1 `reject` 返工：修复 F1「no-sink 重解析绕过两道上界」与 F2「no-sink 结算帧预算泄漏」+ 新增 OAP-C11 回归测试；迭代 1 的设计落实面全部保留）
- 基线：HEAD `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（`mabf/issue-421` worktree `/home/wangjian/nomicore-fix-issue-421`）；迭代 1 未提交实现（公共工厂/搬迁/C5a 单行/7 个契约测试/CONTEXT.md）**原样保留**，本轮为最小修复
- 输入：`task_issue-421.md`（Issue 正文；Comments 快照空 = 无评论级要求）、`task_issue-421_design.md`（迭代 1，732 行，SA2 approve）、`task_issue-421_sa2_review.md`（approve）、`task_issue-421_sa6_contract.md`（approve）、`task_issue-421_design_conflict_report.md`（clear）、`task_issue-421_relevant_decisions.md`、**`task_issue-421_sa4_review.md`（reject：F1/F2 MAJOR + §11 动态验证项 + §12 M1–M5）**
- 实现范围：设计 §10 ALLOW LIST 内（本轮仅 `hub-edge-host.ts` + `issue421-open-admission-pipeline.test.ts`）；DENY LIST 零触碰，未创建任何新路径

---

## 1. Inputs consumed

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-421.md` | Owner 要求 = Issue 正文（AC1–AC6）；Comments 空 |
| `wiki/raw/task_issue-421_design.md` §7-D3（SD-2/3/5/6）/§8.1/§8.2/§9.3/§10/§12/§13 | 全部实现决策与伪码；本轮 F1 依据 = §7-D3 SD-5「并发重解析受阶段 5 上界约束」+ §9.3「两者溢出均响亮收口」；F2 依据 = §8.2 `discardBuffer`（守卫 = 缓冲在场）+ §9.3 内存账 |
| `wiki/raw/task_issue-421_sa4_review.md` §10 F1/F2 + §11 + §12 | 本轮返工契约：F1 两道上界检查、F2 释放次序、验收断言（含负控）、M1–M5 非阻断观察 |
| `wiki/raw/task_issue-421_sa6_contract.md` §12.2/§12.3（OAP-C4/C4b/C5/C8） | pending 上界、合流、no-sink 重解析的既有语义基线（回归不得弱化） |
| `wiki/raw/task_issue-421_design_conflict_report.md` §8-A1' | 四类授权 diff 核对义务（本轮零新授权 diff） |
| 生产源码：`hub-edge-host.ts`（本轮修复面）、`hub-edge.ts`/`hub-split.ts`/`hub-upgrade-admission.ts`（零改动对照面） | 修复点定位与语义对照 |
| 既有测试：`ws-replication-issue421-open-admission-pipeline.test.ts`（fixture 复用）、#418 contract/structure、`test/harness.ts`（`settle`/`settleUntil`）、`test/driver.ts`（`collectUnhandledRejections`） | 回归测试落点与确定性测试基建 |

## 2. Existing worktree reconciliation

- 迭代 1 的未提交实现（`packages/**` 4 修改 + 2 新增源码 + 7 新增测试 + `CONTEXT.md` 2 行）经 SA4 静态评审：架构主线、门序 parity、冻结面、文件范围、测试质量全部合格，**仅 F1/F2 两处 MAJOR 需返工**。本轮核对最新设计后保留全部符合设计的改动，仅在两处报错点做最小修复（`HostSessionAdapter` 单点）。
- 新增回归测试**先红后绿**（TDD 第一手证据，§6）：修复前 `-t 'OAP-C11'` → `Tests 3 failed | 1 passed | 36 skipped (40)`，失败原因分别为「no-sink 重 OPEN 在并发上界满时零收口」（F1）与「预算泄漏导致新 ns 窗口虚假 `CONNECTION_POLICY_VIOLATION`/1008」（F2）；修复后同命令 4/4 绿。
- 无历史实现删除、无过时实现残留、无冲突实现。

## 3. Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/ws-replication/src/hub-edge-host.ts`（迭代 1 新增；**本轮修改**） | §7-D3 SD-5 / §8.2 / §9.3 | ① `openNamespace` 的 `no-sink` 分支：镜像首开分支/`pushPending` 的**两道**上界检查（`pendingOpenCount >= MAX_CONCURRENT_OPEN_ADMISSIONS` 与 `pendingFrameCount >= MAX_PENDING_FRAMES_PER_CONNECTION`，超界均 `port.connectionFatal('CONNECTION_POLICY_VIOLATION', 1008)` 并 `return`，**先于**记录建立 → 被拒重 OPEN 不建会话、零新解析调用）；② `runResolveInner` 的 no-sink 结算：`discardBuffer` **先于** `table.set(no-sink)`（释放次序修正）；③ `discardBuffer` 守卫由 phase 判定改为**缓冲在场**判定（对齐设计 §8.2 `rec.buffer.length === 0`，phase 迁移不得使预算归还失效；联合类型下与 phase 判定等价，零行为差） |
| `packages/ws-replication/test/ws-replication-issue421-open-admission-pipeline.test.ts`（迭代 1 新增；**本轮追加**） | §10 行 8、SA4 §10 验收 | 文件头覆盖清单追加 OAP-C11 一行；文件尾新增 `describe('issue #421 OAP-C11（SA4 F1/F2 回归）…')` 四用例（OAP-C11a/b/c/d，见 §5） |
| `packages/ws-replication/src/hub-upgrade-admission.ts`、`packages/ws-replication/src/index.ts`、`packages/ws-replication/src/hub-connection.ts`、`packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts`、`CONTEXT.md`、其余 6 个 `ws-replication-issue421-*` 测试 | §10 各行（迭代 1 落实） | **本轮零改动**（`git status` 与迭代 1 一致；就地核对仍符合设计） |

`git diff`/`git status` 证据：本轮 changed path 仅上述两文件；`packages/replication-protocol/**` 零 diff；`hub-edge.ts`/`hub-split.ts`/`hub-session.ts`/`hub-namespace.ts`/`frame-io.ts`/`backpressure.ts`/`defaults.ts`/`observer.ts`/`validate.ts`/`types.ts`/`testing.ts`/`docs/**`/`apps/**` 零改动；未新增 ALLOW 之外路径（无临时脚本/marker/日志）。

## 4. SA2 Finding 落实（迭代 1 落实面，本轮保持）

| Finding ID | Implementation | Result |
|---|---|---|
| **R1（BLOCKER）** C5a 冻结清单 append-only | `FROZEN_PRODUCTION_EXPORTS` 恰一行追加；本轮零改动 | 保持绿（§6 复跑 `issue418-…-contract.test.ts`） |
| **R2（BLOCKER）** 早到帧符号族搬迁（选项 α） | `hub-upgrade-admission.ts` 逐字搬迁 + `hub-connection.ts` 仅导入迁移；本轮零改动 | 保持绿（structure.test L616–619 零改动） |
| **R3（MAJOR）** pending 按 kind 分派 + 逐 OPEN 应答 + no-sink 登记 | `flushPending`/`deliverOpen`/`deliverFrame`/`finishTerminal`；本轮修复 no-sink 分支上界与结算账目（F1/F2），分派语义零改动 | OAP-C4/C4b 全绿（40/40） |
| **R4（MAJOR）** `openAdmission` reject 分类 + 收口守卫 + 入口兜底 | 保持；被拒重 OPEN 在 fatal 后零新解析调用（OAP-C11a 追加见证） | OAP-C9 全绿 |
| **R5（MAJOR）** sink 四成员异常纪律 | 保持 | OAP-C10 全绿 |
| **R6（MINOR）** 门 6/7 次序 | 保持 | EF-C3d 全绿 |
| N1–N6 / M1–M5 | 保持迭代 1 处置（N4 单点账目在本轮被 F2 修复强化：释放点不再与 phase 耦合） | 保持 |

## 5. SA4 Finding 落实

| Finding ID | Required change（SA4 §10） | Implementation | Regression test | Result |
|---|---|---|---|---|
| **F1（MAJOR）** no-sink 重 OPEN 绕过并发 OPEN 上界（4）与 pending 帧上界（16） | no-sink 分支镜像首开分支的两道检查：`pendingOpenCount >= MAX_CONCURRENT_OPEN_ADMISSIONS` → `connectionFatal('CONNECTION_POLICY_VIOLATION', 1008)`；重 OPEN 占位项同样过帧预算（超界同码收口） | `hub-edge-host.ts` `openNamespace` `case 'no-sink'`：两检查置于记录建立/计数/`runResolve` **之前**；超界即响亮连接收口并 `return`（记录保持 no-sink、`pendingOpenCount`/`pendingFrameCount` 零变化、`resolveSessionSink` 零调用） | **OAP-C11a**（4 in-flight 首开 + no-sink ns 重 OPEN → 恰一帧连接级 `CONNECTION_POLICY_VIOLATION` + `close(1008)` + 零新解析调用 + 已建会话 quiesce；负控：恰满 4 个 in-flight 零收口）<br>**OAP-C11b**（pending 满 16 项 + no-sink ns 重 OPEN 占位项 → 第 17 项同码收口）<br>**OAP-C11c**（负控：3 in-flight + no-sink 重 OPEN = 第 4 个 → 重解析照常建会话；authorize 仍恰一次 = grant 复用） | **已修复**（修复前 C11a `expected 'ready' to be 'closed'`、C11b 负控窗被虚假收口；修复后 3 用例绿） |
| **F2（MAJOR）** no-sink 结算缓冲释放次序错误 → `pendingFrameCount` 永久泄漏 | 修正释放次序/守卫之一：先释放后迁移 phase（对旧记录 buffer 直接释放），或 `discardBuffer` 守卫改回设计 buffer-长度判定；确保 no-sink 终局与 established/terminal 终局同样归还预算 | ① `runResolveInner` no-sink 分支：`this.discardBuffer(namespaceId)` 先于 `this.table.set(namespaceId, { phase: 'no-sink', grant })`（迁移前记录仍携带 buffer → 唯一递减点 `releaseBuffer` 正常执行）；② `discardBuffer` 守卫 `record.phase !== 'pending'` → `!('buffer' in record)`（设计 §8.2 语义：按缓冲在场判定，与 phase 解耦；当前联合类型下二者等价 = 零行为差，仅消除「phase 迁移使归还失效」隐患） | **OAP-C11d**（单 ns 循环「重 OPEN → resolver undefined」×17，每轮 1 项占位 → 零收口、零虚假 1008；随后新 ns 窗口满额可用 = 1 占位 + 15 帧不收口；第 17 项仍响亮收口 = 上界未被修复禁用；authorize 恰一次） | **已修复**（修复前 17 轮后新 ns 首帧即虚假 `CONNECTION_POLICY_VIOLATION`/1008；修复后绿） |

修复面集中在 `HostSessionAdapter` 单点（一个分支 + 一处次序 + 一行守卫），不触碰架构主线（内部 edge 零 diff）、冻结面、门序与既有测试断言。

## 6. File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/ws-replication/src/hub-edge-host.ts`（**本轮修改**） | §10 ALLOW 行 1 | F1 两道上界检查 + F2 释放次序/守卫（`HostSessionAdapter` 单点） |
| `packages/ws-replication/test/ws-replication-issue421-open-admission-pipeline.test.ts`（**本轮追加**） | §10 ALLOW 行 8（OAP 契约文件；SA4 §10 要求「新增回归测试」） | OAP-C11a..C11d 四用例（F1/F2 回归 + 两组负控） |
| `packages/ws-replication/src/hub-upgrade-admission.ts`、`packages/ws-replication/src/index.ts`、`packages/ws-replication/src/hub-connection.ts`、`packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts`、`CONTEXT.md`、6 个 `ws-replication-issue421-*` 测试 | §10 ALLOW 行 2–7、9–12 及末行（迭代 1 落实） | 本轮零改动，就地复核仍符合设计 |
| `wiki/raw/task_issue-421_sa3_impl.md`（本报告） | 技能固定产物 | 原位更新（仅描述当前实现与当前验证） |

- 本轮**未创建任何新文件/新路径**（`git status --porcelain` 与迭代 1 一致）；DENY LIST 零触碰（`packages/replication-protocol/**` `git diff` 空；四核心文件与全部叶子件/文档/应用零 diff）。
- 测试改动为**纯追加**：既有 36 个 OAP 用例的断言、条目与语义零变化（全文件复跑 40/40 绿）；未使用 skip/only/todo/env override/源码字符串断言；stub 仍只在宿主缝另一侧（OAP-C11 全部经公共入口 + 内存双工 transport + 记录型 resolver）。

## 7. Verification

| Command | Result | Evidence |
|---|---|---|
| **红灯基线（修复前）**：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/ws-replication/test/ws-replication-issue421-open-admission-pipeline.test.ts -t 'OAP-C11'` | `Tests 3 failed \| 1 passed \| 36 skipped (40)`；`Type Errors no errors` | OAP-C11a：`expected 'ready' to be 'closed'`（F1：no-sink 重 OPEN 在 4 个 in-flight 之上静默进入 pending，零收口）；OAP-C11b：`expected [ { code: 1008, …(1) } ] to deeply equal []`（F2 泄漏使预算提前耗尽 → 负控窗被虚假 `CONNECTION_POLICY_VIOLATION` 收口）；OAP-C11d：同型（17 轮结算后新 ns 窗口首帧虚假 1008）；OAP-C11c 负控通过（修复前后皆绿） |
| **修复后聚焦**：同命令 | **`Tests 4 passed \| 36 skipped (40)`** | F1/F2 转绿，含两组负控（恰满不收口、上界内重解析照常成立） |
| 契约文件全量：`… vitest run packages/ws-replication/test/ws-replication-issue421-open-admission-pipeline.test.ts` | **`40 passed (40)`** | 既有 36 用例零回归 + 新增 4 |
| 其余交付契约 + C5a：#418 contract、edge-accept、route-key-parity、error-routing、wire-parity、edge-lifecycle 六文件 | **`Test Files 6 passed (6)`；`Tests 67 passed (67)`**；`Type Errors no errors` | 无回归；C5a 冻结导出清单保持绿 |
| **GATE-C1**：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication` | **`Test Files 84 passed (84)`；`Tests 686 passed (686)`；`Type Errors no errors`**；47.85s | 迭代 1 基线 682 → 686（+4 = OAP-C11），条目数只增、零跳过、零红 |
| **GATE-C2**：`pnpm exec tsc -p packages/ws-replication/tsconfig.json` | **exit 0（零错误）** | tsconfig `include` 含 `test/**/*.ts` → 本轮新增测试代码亦被包 program 覆盖 |
| **GATE-C4**：`git diff --stat -- packages/replication-protocol` | **0 行** | 零新错误码、零 wire 变更（冻结面） |
| SA6 oracle/负控复跑：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-421_sa6_capability_probe.mts` | **`RESULT gaps=6/7 oracle+nc=15/15 failed_oracle=[] failed_gap=[G1]`** | 与迭代 1 同值：oracle O1–O8/O1b/O2b/O5b + NC1–NC4 全绿（单体/internal edge 语义零漂移）；G2–G7 报 `ABSENT` 属设计预期（探针把这些能力定义在内部半边/单体形态上，Architecture-C 保持其零 diff） |
| 文件范围（`git status --porcelain` + `git diff --stat`） | 仅 §6 所列路径（4 修改 + 25 未跟踪，与迭代 1 同一集合）；本轮新增 changed path = 0 | DENY 面零 diff；无 ALLOW 之外路径 |

## 8. Deferred verification

- 根级门禁 `pnpm typecheck` / `pnpm test` 与 `apps/yjs-server` 运行期复核（超出 SA3 职责；本票 append-only 导出面在迭代 1 已静态核对）。
- SA4/SA7 动态复算：SA4 §11 的 F1/F2 复现驱动（本轮已用同一形态的公共面用例覆盖：OAP-C11a = F1 驱动、OAP-C11d = F2 驱动）、非 memory transport 路径、端到端验收。
- SA4 §12 非阻断观察 M1–M5（observer 事件 `connectionId`、构造期 observer/clock 形状校验、ns ERROR 应答不带 limits 选项、宿主义务注释、收口后 egress 幽灵序）维持登记，本轮不改行为。
- **设计文本内部不一致（供 SA1/SA4 裁决，SA3 不改设计文件）**：SA4 §10 F1 备注「可选：SA1 在设计 §8.2 伪码 no-sink 行补上界检查注记」。实现已按设计**正文**（§7-D3 SD-5 + §9.3）落地两道上界；伪码 §8.2 第 390–391 行仍无该注记，属设计伪码遗漏，建议 SA1 以设计修订补齐（实现侧已对齐正文）。
- **首开分支占位项的帧预算观察（本轮按「保持批准设计」未改，登记待裁）**：`openNamespace` 首开分支与设计伪码 §8.2 第 383–384 行一致——只检查并发上界，`pendingFrameCount` 直接 `++`（无帧预算检查）。可达状态：`pendingFrameCount == 16` 且 `pendingOpenCount ≤ 3`（如 3 条 pending 记录 + 13 项缓冲帧）时再来一个新 ns 首开 → 占位成为第 17 项而不响亮收口。该状态不被任何既有/OAP-C11 断言覆盖，且 F1 的 required change 明确限定在 no-sink 重 OPEN 路径；SA3 未自行扩大改动面。建议 SA1/SA4 裁决：或将同一检查镜像到首开分支，或在设计伪码中显式登记该差异。

## 9. Deviations or blockers

1. **内部模块级导出扩大（非公共面）**：承迭代 1 deviation #1（`HostSessionAdapter`/两常数模块级导出供白盒守卫测试）；`src/index.ts` 公共面仍为 12 名（11 legacy + 工厂），本轮零变化。
2. **C5a diff 形态**：单行追加（迭代 1 落实），本轮零改动。
3. **收口后 `egress.sendControlFrame` 幽灵序**：承迭代 1 deviation #3（与单体/internal edge 逐点一致，DENY 面不可改；WS-C3 按可观察字节断言）。
4. **ER-C1d 预算读数口径 / 截断帧注册表码 / WS-C2 覆盖口径**：承迭代 1 deviation #4–#6，本轮零改动。
5. **本轮新增：`discardBuffer` 守卫由 phase 判定改为缓冲在场判定** —— 与设计 §8.2 一致（守卫 = `rec.buffer.length === 0`）；联合类型下仅 pending 记录携带 `buffer`，故与 phase 判定**等价**（零行为差），改动目的是消除「phase 迁移使预算归还失效」的隐患（F2 根因）。已随全量套件与 typecheck 复核。
6. **无阻塞**：ALLOW 范围充分、SA4 F1/F2 可实施且已落实、无环境缺失；未修改任何验收断言或跳过任何检查。

## 10. Suggested commit message

```
fix(ws-replication): bound no-sink reopen re-resolution and release pending frame budget

SA4 iteration-1 findings F1/F2 on the hub edge host factory (issue #421):

- F1: the SD-5 no-sink re-OPEN branch of `HostSessionAdapter.openNamespace`
  bypassed both stage-5 bounds. Mirror the first-open/pushPending checks:
  `pendingOpenCount >= MAX_CONCURRENT_OPEN_ADMISSIONS` and
  `pendingFrameCount >= MAX_PENDING_FRAMES_PER_CONNECTION` now close the
  connection loudly with `CONNECTION_POLICY_VIOLATION`/1008 before the
  pending record is created, so a rejected re-OPEN starts no session and
  issues no resolver call.
- F2: no-sink settlement migrated the record to `no-sink` before discarding
  its buffer, so `pendingFrameCount` was never decremented (leak >= 1 per
  settlement; after 16 the next healthy pending window was closed with a
  spurious 1008). Release the buffer before the phase transition and judge
  `discardBuffer` by buffer presence (design 8.2) instead of phase.
- add OAP-C11a..C11d regressions (concurrent cap, frame budget on the
  re-OPEN placeholder, at-cap negative control, 17-cycle budget-release
  check with the 17th-item overflow still loud).
```
