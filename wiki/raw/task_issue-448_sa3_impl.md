# SA3 实现报告 — issue #448（γ-T2）：γ 异步缝 live update 数据面（verification-only 契约落盘与守门）

- 实施者：SA3（TDD Executor）；Dispatch `sa-9de31283-a5dc-414e-b74a-120e2798db03`（mabf-sa3 / implementation / iteration 0）
- iteration 1 追补：Dispatch `sa-8d832d55-1660-4da8-ab7b-9891266b4a47`（mabf-sa3 / implementation / iteration 1）——只修复 `git diff --cached --check` 报出的 3 处 `new blank line at EOF`（见文末「iteration 1 追补」段；零语义/零判据改动）
- 基线：worktree `/home/wangjian/nomicore-fix-issue-448`，branch `mabf/issue-448`，HEAD `321d951`（`Merge pull request #453`；T1 实现 commit `52e634b`）——`git log`/`git status` 实查一致
- 裁定承接：`wiki/raw/task_issue-448_design.md` §0/§7-D1 **#448 = verification-only（零生产实现面）**；SA2 `approve`（0 BLOCKER / 0 MAJOR）；SA8 `design_conflict_report` verdict `clear`、`requiresConflictRecheck: false`
- 实施范围：严格按设计 §11 ALLOW LIST；DENY LIST 零触碰（生产 `src/**`、规范文本、模块 `AGENTS.md`、`replication-protocol/**`、根配置全部零 diff）

---

## Inputs consumed

| 输入 | 状态 | 关键内容 |
|---|---|---|
| `wiki/raw/task_issue-448.md` | 在场，已读 | Issue #448 正文 6 条 AC + `Blocked by #447` + Parent PR #446；`## Comments` 空 |
| `wiki/raw/task_issue-448_design.md` | 在场，已读（318 行） | verification-only 裁定（§7-D1）；交付物 = SA6 契约原样落盘（§7-D2）；夹具 append-only（§7-D3）；验证门（§7-D5/§12）；ALLOW/DENY（§11） |
| `wiki/raw/task_issue-448_sa2_review.md` | 在场，已读（204 行） | verdict `approve`；无 BLOCKER/MAJOR；非阻塞 O1（类型门 exit code 证据）/ O2（设计措辞）/ O3（两份新工件 0600 权限）/ O4（登记，非缺口） |
| `wiki/raw/task_issue-448_sa6_contract.md` | 在场，已读（261 行） | verdict `approve`；**反向诊断**：AC1–AC6 行为在 HEAD 已由 #447 交付 ⇒ 契约是**绿色验收/回归契约**（§13「不伪称红灯」），13 条锚 + NC-1…NC-7 |
| `wiki/raw/task_issue-448_design_conflict_report.md` | 在场，已读（130 行） | SA8 `clear`；§8-R1 落盘期复核义务（判据口径/负控不削弱、夹具 append-only 缺省零传、基线证据保留不替换）；`requiresConflictRecheck: false` |
| `wiki/raw/task_issue-447_design.md`（D4/D6/D9/D10） | 在场（设计引用链） | T1 变更集已含数据面机械（pending 两相记账 / selfDrain / t0 推送时刻 / 合并占用判据）——本票无生产面的上游依据 |
| 契约工件本体 | 在场，逐行读回 | `ws-replication-issue448-live-data-plane.test.ts`（iteration 0 落盘时 686 行，实数 13 `it(`；iteration 1 尾随空行修复后 684 行——见文末）、`issue448-live-seam.ts`（133 行）、`issue447-async-seam.ts` diff（+10/-0）、`artifacts/sa6-issue448-*.log` ×5 |
| Issue comments | **空数组**（派工 REST 读取 + 简报双确认） | 无 owner 追加要求可映射；需求全集 = 正文 6 条 AC |

---

## Existing worktree reconciliation

进入本阶段时 worktree 已含 SA6 落盘的契约工件（与设计 §1/§7-D2 声明一致）。SA3 逐项核对并保留：

| 核对项 | 设计声明 | 实查结果 | 处置 |
|---|---|---|---|
| 契约用例数/判据 | 13 条 LIVE-* 用例（§7-D2） | 恰 13 个 `it(`；无 `skip`/`only`/`todo`；无 `process.env` | 原样保留，零内容改动 |
| 变异负控恢复纪律 | `finally` 恢复生产原型（§7-D2 / SA8 §8-R1） | NC-4 `effectiveInFlightCount`（:139-171）、NC-5 `onReceipt`（:307-362）均 `try/finally` 恢复 | 原样保留 |
| 夹具 | `issue448-live-seam.ts`（133 行，test-only） | 在场；`bootLiveRound` 装配前提断言（registry 同一性 / 连接数恰 1）；复用 #447 装配面 | 原样保留 |
| 夹具 append | 仅 `issue447-async-seam.ts` +10 行、append-only、缺省零传 | `git diff --numstat` = `10 0`（纯新增，既有行零改写）；条件展开 `...(options.edgeObserver === undefined ? {} : { observer: options.edgeObserver })` | 原样保留（SA3 零改写） |
| 证据日志 | 5 份 `artifacts/sa6-issue448-*.log` 保留，可追加新运行证据 | 5 份在场；SA3 复跑证据**追加**（不替换/不删除基线） | 追加见「Changed paths」 |
| 生产面 | 零改动（§7-D1/§11 DENY） | `git status --porcelain -- packages/ws-replication/src domains apps docs CONTEXT.md packages/ws-replication/AGENTS.md` = **空**；根配置与 `pnpm-lock.yaml` 零 diff | 维持零改动 |
| 权限（SA2 O3） | 两份新工件 0600 → 随仓库惯例归一 | 两份新测试文件原为 `600`（同目录既有测试文件 `664`） | `chmod 664`（两类工件文件） |

**TDD 形态说明（诚实登记）**：本票为 verification-only，契约在 baseline HEAD 即为**目标绿**（设计 §7-D1 三路证据 + SA6 §13）。因此本阶段**不存在红灯转绿**：SA6 明确「不伪称红灯」，历史红依据 = pre-T1 `c86ccbc` 零 γ 公共面/夹具（SA6 S2）。SA3 的 TDD 义务形态 = **执行并守门**该可执行验收契约（13 条目标锚 + 6 条负控/变异在同一次运行内），而非改写断言以迎合实现。

---

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts` | §7-D2 / §11 ALLOW 第 1 项 | SA6 制品**原样落盘**（686 行 / 13 用例；SA3 零内容改动）；文件模式 `600 → 664`（SA2 O3 归一）；iteration 1 仅删尾部空行 ⇒ 684 行（见文末） |
| `packages/ws-replication/test/issue448-live-seam.ts` | §7-D2 / §11 ALLOW 第 2 项 | SA6 制品**原样落盘**（133 行 test-only 夹具；SA3 零内容改动）；文件模式 `600 → 664` |
| `packages/ws-replication/test/issue447-async-seam.ts` | §7-D3 / §11 ALLOW 第 3 项 | append-only +10 行（SA6 落地；SA3 零改写、零增删——`git diff --numstat` 复核 `10 0`） |
| `artifacts/sa6-issue448-contract-run.log` | §11 ALLOW 第 4 项（「可追加新运行证据」） | 追加 SA3 段：`[1]` 契约单文件 13/13 exit 0；`[2]` γ 族四文件 43/43 exit 0（SA6 基线段保留） |
| `artifacts/sa6-issue448-package-suite.log` | 同上 | 追加 SA3 段：包全量 101 文件 / 897 用例 passed、`Type Errors no errors`、exit 0 |
| `artifacts/sa6-issue448-package-tsc.log` | 同上 | 追加 SA3 段：`npx tsc -p packages/ws-replication/tsconfig.json` 零诊断 + **显式 `exit=0`**（此前为 0 字节空文件，落实 SA2 O1） |
| `wiki/raw/task_issue-448_sa3_impl.md` | 本报告（dispatch 授权；设计 §11 注记「下游流水线产物由各自 dispatch 授权」） | 新建实现报告 |

未改动：`packages/ws-replication/src/**`（生产零 diff）、`docs/**`、`CONTEXT.md`、`packages/ws-replication/AGENTS.md`、`packages/replication-protocol/**`、根 `vitest.config.ts`/`tsconfig*.json`/`package.json`、`pnpm-lock.yaml`；#447 三个 `.test.ts` 本体零触碰。

---

## SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| BLOCKER / MAJOR | 无（SA2 §13：无 BLOCKER / 无 MAJOR） | 无需修订；设计 §0/§7-D1 裁定与范围原样承接 |
| O1（MINOR，证据卫生：`-package-tsc.log` 0 字节、无 exit code；vitest 的 `Type Errors` 不覆盖两个新文件） | 复跑 `npx tsc -p packages/ws-replication/tsconfig.json`（包 `include = src/**/*.ts + test/**/*.ts`，覆盖两个新文件），零诊断，并把 **`exit=0` 显式追加**进 `artifacts/sa6-issue448-package-tsc.log` | **已落实**（见 Verification V4） |
| O2（MINOR，措辞：设计 §11 DENY 行字面可误读） | 未处理——该 finding 落在**设计文档**（`task_issue-448_design.md`），不在 SA3 ALLOW LIST；SA3 不修改设计文件、不自行扩大范围 | **按范围不处理**（非阻塞；语义无歧义，DENY 意图 = 既有 #447 三个 `.test.ts` 本体不得修改） |
| O3（TRIVIAL，两份新工件 0600 vs 同目录 0664） | `chmod 664` 两份新测试工件（`stat` 复核 `664`） | **已落实** |
| O4（登记，非缺口：重复 tag / 伪造序回执未新增注入旋钮） | 无需动作（非本票 AC；同族响亮语义已由 NC-1/NC-2 锚定） | **登记维持** |

---

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts` | §11 ALLOW 第 1 项 | 本票交付物本体：AC1–AC6 可执行验收锚（13 用例） |
| `packages/ws-replication/test/issue448-live-seam.ts` | §11 ALLOW 第 2 项 | 契约装配面（boot adopt + 观测投影 + 双侧 observer） |
| `packages/ws-replication/test/issue447-async-seam.ts` | §11 ALLOW 第 3 项（append-only +10） | `update-sent`（edge 盖章点）可观察性的最小注入面；缺省零传 |
| `artifacts/sa6-issue448-contract-run.log` | §11 ALLOW 第 4 项 | SA3 复跑证据（契约 13/13、γ 族 43/43）追加 |
| `artifacts/sa6-issue448-package-suite.log` | §11 ALLOW 第 4 项 | SA3 复跑证据（包全量 101/897）追加 |
| `artifacts/sa6-issue448-package-tsc.log` | §11 ALLOW 第 4 项 | 类型门 exit code 证据追加（SA2 O1） |
| `wiki/raw/task_issue-448_sa3_impl.md` | 下游流水线产物（dispatch 授权；设计 §11 注记） | 本实现报告 |

范围结论：全部 changed path 均在设计 ALLOW LIST（或下游授权的报告位）内；无未列改动；`artifacts/sa6-issue448-repeat5.log` / `-package-suite-precontract.log` 未触碰（基线证据原样）。

---

## Verification

环境：`node v24.13.0` / `pnpm 10.28.2` / `vitest 3.2.7` / `typescript 5.9.3`；条件导出选择 `NODE_OPTIONS=--conditions=nomicore-source`（仓库测试脚本同款，非伪造开关）。

| # | Command | Result | Evidence |
|---|---|---|---|
| V0 | `pnpm install --frozen-lockfile` | exit 0（`Done in 378ms`）；`pnpm-lock.yaml` 零 diff | 前置条件兑现（设计 §12 命令 1） |
| V1 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts` | **exit 0**；`Test Files 1 passed (1)`、**`Tests 13 passed (13)`**、`Type Errors no errors` | `artifacts/sa6-issue448-contract-run.log`「SA3 实施阶段复跑证据」段 `[1]`（追加时间 2026-09-22T16:25:25+08:00） |
| V2 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run <契约> <issue447-async-session-round> <issue447-async-seam-fixture> <issue447-async-session-api>` | **exit 0**；`Test Files 4 passed (4)`、**`Tests 43 passed (43)`**（13 + 15 + 7 + 8）、`Type Errors no errors` | 同上日志 SA3 段 `[2]`（γ 族回归面：夹具 append 不伤 #447） |
| V3 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test` | **exit 0**；`Test Files 101 passed (101)`、**`Tests 897 passed (897)`**、`Type Errors no errors`；采集面含本契约文件（log :39 `(13 tests)`） | `artifacts/sa6-issue448-package-suite.log`「SA3 实施阶段复跑证据」段 |
| V4 | `npx tsc -p packages/ws-replication/tsconfig.json` | **exit 0**，零诊断（含两个新增测试文件；包 `include` 覆盖 `test/**/*.ts`） | `artifacts/sa6-issue448-package-tsc.log`（显式 `exit=0` 行；落实 SA2 O1） |
| V5 | 静态生成/check（设计明确指定的 generate/check 命令） | **不适用**：本票零 schema/VFSL/codegen 面，设计 §7-D5/§12 未指定任何生成或 check 命令；无跳过项 | 设计 §7-D5（验证门 = V1–V4 四项） |

**契约内负控/变异敏感性（同一次 V1 运行内，属 13 用例）**：LIVE-WINDOW-C3（NC-4：占用判据去 `pendingSends` ⇒ 上界击穿）、LIVE-ACK-C1 变异（NC-5：rekey 重采样 `sentAt` ⇒ `ackLatencyMs` 退化为 `m`）、LIVE-ORD-C2（NC-1：乱序投递 ⇒ 响亮 `ACK_STATE_VIOLATION`）、LIVE-ACK-C2（NC-2：丢回执直投 ACK ⇒ 响亮）、LIVE-PARITY-NC1（NC-6：内容变异 ⇒ 语义比对报差异）、LIVE-DRAIN-C2（NC-7：时间推进/重复泵零新帧、计时器面不增）——全部在上述 13/13 绿内通过，证明判据非恒真。

**验证产物**：全部为运行时行为断言；零源码 grep 断言；零 `skip/only/todo`；零 env override；零真实 timer/网络/长驻服务。

---

## Deferred verification

| 项 | 归属/理由 |
|---|---|
| 根 `pnpm typecheck` / `pnpm test` 全仓门禁 | 设计 §7-D5/§12 边界：零生产改动下模块 AGENTS 触发条件不满足，根门禁归 CI 收尾与 #451（T5）登记范围（SA8 §8-R3 同判） |
| SA4/SA7 独立动态复验与判据口径复核 | 下游流水线职责（本阶段只跑 SA6 指定契约 + γ 族 + 包全量 + 包 tsc） |
| #449（kind=1/2 全回合、drain 第三触发点全回合）、#450（1011/close 冲刷/OPEN 水位）、#451（`update-sent` 总归属、根门禁） | 相邻票范围（设计 §1 非目标 + §11 DENY；SA6 §12.2） |
| γ `sendQueueMs` 携带 | 登记缺面（设计 §7-D4）：欲增补须先做协议 §24.3 / ADR A4 显式 amendment，另票 |
| 其余回归测试 / 真实环境验收 / CI 裁决 | 不在 SA3 职责（skill 纪律） |

---

## Deviations or blockers

- **无 BLOCKER、无设计偏离**：设计内部一致、ALLOW/DENY 明确、SA2 BLOCKER/MAJOR 为空、SA8 约束（§8-R1：判据口径与负控不削弱、夹具 append-only 缺省零传、基线证据保留不替换）全部满足（实查 V1–V4 + diff/`git status`）。
- **SA2 O2 未处理**（设计文档措辞，属设计文件，SA3 不越 ALLOW 修改设计）：登记为按范围不处理，语义无歧义。
- **诚实登记**：本票不存在红灯转绿过程（verification-only；契约在 baseline 即目标绿）。SA3 **未**通过任何 fallback、env override、skip、断言弱化或造假手段制造"通过"；未改动 SA6 的 13 条判据与 6 条负控/变异；未触碰生产实现。
- 无环境阻塞；`pnpm install --frozen-lockfile` 未改 lockfile；无临时探针/长驻进程残留（诊断均在本契约文件内；SA3 仅复跑测试）。

---

## Suggested commit message

```
test(ws-replication): anchor gamma live update data plane (#448)

落盘 issue #448 的绿色验收/回归契约（verification-only，零生产改动）：
- 新增 test-only 夹具 issue448-live-seam.ts（复用 #447 装配面，boot adopt + 双侧 observer）
- issue447-async-seam.ts append-only +10：可选 edgeObserver 注入面（缺省零传，#447 行为逐字不变）
- 契约 13 用例：LIVE-WINDOW/ORD/ACK/OBS/DRAIN/PARITY + 6 条负控/变异敏感性与违契响亮收口
- 证据：契约 13/13、γ 族 43/43、包全量 101 文件/897 用例、包 tsc exit 0（artifacts/sa6-issue448-*.log）
- 范围：packages/ws-replication/src/** 与规范文本零改动（§24/A4 冻结面保持）
```

---

## iteration 1 追补 — 交付前白空格门禁修复（`git diff --cached --check`）

**触发**：交付前白空格门禁 `git diff --cached --check` 报 3 处 `new blank line at EOF`（exit 2）。修复范围严格限定为这 3 处文件尾多余空行：零语义、零判据、零夹具、零生产改动（对应裁决与 `wiki/raw/task_issue-448_sa4_review.md`（`approve`）/ `task_issue-448_implementation_conflict_report.md`（`clear`，`requiresConflictRecheck: false`）的交付态完全一致）。

| 报告位置 | 路径 | 修复前 EOF 字节 | 修复后 EOF 字节 | 删除量 | 内容等价性 |
|---|---|---|---|---|---|
| `:249` | `artifacts/sa6-issue448-package-suite-precontract.log` | `…typecheck 2.10s)\n\n` | `…typecheck 2.10s)\n` | −1 空行（249 → 248 行） | 去尾随换行后与索引副本逐字节相等 |
| `:685` | `packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts` | `…}, 30_000);\n});\n\n\n` | `…}, 30_000);\n});\n` | −2 空行（686 → 684 行） | 同上；13 个 `it(`、13 条锚、6 条负控/变异、`try/finally` 恢复纪律全部原样 |
| `:33` | `wiki/raw/task_issue-448.md` | `…## Comments\n\n` | `…## Comments\n` | −1 空行（33 → 32 行） | 同上；正文 6 条 AC、`Blocked by #447`、Parent PR #446 原样 |

**「仅删尾部空行」判据**：`git diff --numstat`（worktree vs index）= `0 1` / `0 2` / `0 1`（**零新增行**，纯删除）；逐文件字节比对 `worktree.rstrip(b'\n') == index.rstrip(b'\n')` = `True` ×3；`trailing blank lines at EOF` = `0` ×3。

### Verification（iteration 1）

| # | Command | Result | Evidence |
|---|---|---|---|
| W1 | `git diff HEAD --check` | **exit 0**（零白空格诊断）。三个待交付文件相对 HEAD 均为新增文件，故此即「重新入索引后 `git diff --cached --check`」的同一内容级检查 | 本段命令实跑输出；修复前同一命令 exit 2 / 同样 3 条诊断 |
| W2 | `git diff --numstat` + 逐文件字节比对 + `trailing blank lines at EOF` | `0 1` / `0 2` / `0 1`；`identical modulo trailing newlines: True` ×3；`0` ×3 | 本段命令实跑输出 |
| W3 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run <契约> <issue447-async-session-round> <issue447-async-seam-fixture> <issue447-async-session-api>` | **exit 0**；`Test Files 4 passed (4)`、**`Tests 43 passed (43)`**（契约 13 + T1 三套件 30）、`Type Errors no errors`；契约文件 `(13 tests)` 绿 | 实跑（16:38:00，Duration 3.22s）——证明被修文件仍可解析且 13 条判据全绿 |
| W4 | `npx tsc -p packages/ws-replication/tsconfig.json` | **exit 0**，零诊断、零输出字节（`include` 覆盖被修测试文件） | 实跑输出 `[tsc exit: 0]` + `wc -c` = 0 |
| W5 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/ws-replication/test` | **exit 0**；`Test Files 101 passed (101)`、**`Tests 897 passed (897)`**、`Type Errors no errors`（与被修基线日志 `-package-suite-precontract.log` 的 100/884 基线 + 本契约 13 用例自洽：100+1=101、884+13=897） | 实跑（16:38:13，Duration 49.85s） |

**索引态说明（SA3 纪律，非缺陷）**：SA3 按 skill 纪律**不执行 `git add`/`git commit`/`git push`，未改动索引**；修复只落在 worktree。因此在本 3 条路径重新入索引之前，`git diff --cached --check` 仍会读到索引中的旧 blob 并复现原诊断。控制方在 commit 前对本 3 条路径重新 `git add`（或 `git add -A`）即可，其后 `git diff --cached --check` 即等于 W1 所证的 exit 0（内容级等价，无需任何再修复）。

### 范围核对（iteration 1）

| Changed path | 归属 | 目的 |
|---|---|---|
| `artifacts/sa6-issue448-package-suite-precontract.log` | 设计 §11 ALLOW 第 4 项（证据日志） | 删文件尾空行（`new blank line at EOF`） |
| `packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts` | 设计 §11 ALLOW 第 1 项 | 同上（内容/判据零改动） |
| `wiki/raw/task_issue-448.md` | 任务简报（total-control dispatch 显式授权修复） | 同上 |
| `wiki/raw/task_issue-448_sa3_impl.md` | 本报告（dispatch 授权；设计 §11 注记「下游流水线产物由各自 dispatch 授权」） | 原位追补本段 |

**DENY 面零触碰复核（iteration 1 实查）**：`packages/ws-replication/src/**`、`docs/**`、`CONTEXT.md`、`packages/ws-replication/AGENTS.md`、`packages/replication-protocol/**`、根 `vitest.config.ts`/`tsconfig*.json`/`package.json`、`pnpm-lock.yaml` 全部零 diff（相对迭代前交付态不变）；`packages/ws-replication/test/issue448-live-seam.ts`、`issue447-async-seam.ts`（append-only +10）零改动；其余 4 份证据日志（`-contract-run` / `-repeat5` / `-package-suite` / `-package-tsc`）零改动。

**无新增偏离/阻塞**；iteration 1 未改变任何验收语义、判据口径、负控敏感性或夹具行为——只删除了 3 个文件末尾的多余空行。
