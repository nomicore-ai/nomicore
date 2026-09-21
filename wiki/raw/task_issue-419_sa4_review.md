# task_issue-419 SA4 实现静态审查 — 路由键契约 codec 守卫测试（spec #415 T1）

- Reviewed subject：SA3 交付 = 新文件 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（743 行，
  6 describe 组 / 19 用例）+ `artifacts/sa3-issue419-*.log` 证据 + 报告 `wiki/raw/task_issue-419_sa3_impl.md`。
  **本轮（iteration 3）被审焦点 = 真实索引窄幅收口**：iteration 2 的 C1 修复此前只在工作树生效，真实索引的
  runner 条目仍持 pre-C1 raw blob `c183ba29…`（70 行/4322B），强制门禁 `git diff --cached --check` 报
  `artifacts/sa6-issue419-runner-trigger.log:70: new blank line at EOF.`（rc=2，恰 1 处）；SA3 按本轮 dispatch
  明示指令执行 `git add -- artifacts/sa6-issue419-runner-trigger.log`（唯一索引写；零工作树资产字节改写），
  并产出证据日志 `artifacts/sa3-issue419-index-reconcile.log` + 报告原位更新。
- Dispatch：`sa-5416f75e-36f7-4d90-b398-c16efddae1cb`（iteration 0）→ `sa-8aa10f21-58d9-4a04-81e2-27a93028ab0e`
  （iteration 1）→ 本轮 `sa-8291a550-3b73-44bc-916c-497f824bd5f6`（mabf-sa4，phase implementation-review，
  **iteration 3**；iteration 2 无 SA4 复审——Controller 排程，SA8 §1 已注记，非阻断）。
- Verdict：**approve**（无 BLOCKER / 无 MAJOR；非阻断观察见 §12）。
- 本轮为零修改静态审查（dispatch 明示 Do not modify artifacts）：未修改任何被审对象、证据、实现、设计或测试；
  未运行测试/服务；唯一写入 = 本文件原位更新。Issue 评论 REST 快照 = **空（`[]`）**（dispatch 明示）——
  无 Owner 评论要求、无评论 ID/时间戳可映射（Host 简报 `## Comments` 节空，同证）。
- 方法（延续 iteration 1 起采纳的 SA9 §4-O3 纪律）：全部断言**现场重算**，不采信链上值——索引全条目哈希扫描、
  HEAD/工作树/索引三方 blob 等式、11 条 staged blob 逐条 C1 复算（非 diff 输出）、SA6 §17 登记表 10 行逐行
  sha256 重算、门禁退出码亲测并附「非静默」证明、mtime 取证、对象库 raw blob 身份复核。

## 1. Reviewed inputs

| 输入 | 状态 | 本轮核验方式 |
|---|---|---|
| `wiki/raw/task_issue-419.md`（Host 简报） | 存在（已入库，工作树 == HEAD） | 全文亲读；AC1–AC5 +「纯增量测试，零行为变化」+ 空 Comments |
| `wiki/raw/task_issue-419_sa6_contract.md`（已批准契约，iteration 2 原位修订版，staged ≡ 工作树） | 存在；479 行 | §17（C1 登记基准 + legacy/superseded 行）、§18.5–§18.16 亲读；登记值 10 行本轮全部现场重算比对（见 §3） |
| `wiki/raw/task_issue-419_design.md`（SA1 设计） | 存在 | §11 ALLOW/DENY 原文复核（L374–L392 本轮亲读）；§7.2 SD-1B / §8 详案 iteration 0 已逐项核 |
| `wiki/raw/task_issue-419_sa2_review.md` | 存在 | approve；无阻断项；交付未变 → 结论延续 |
| `wiki/raw/task_issue-419_design_conflict_report.md` / `…_implementation_conflict_report.md`（SA8 两道门） | 存在（实现门为 iteration 2 版，staged ≡ 工作树，95 行） | clear / requiresConflictRecheck=false；§4 冻结面「真实 git 索引」行 + §7-1（Controller 落盘清单与 R5 期望）亲读 |
| `wiki/raw/task_issue-419_sa9_standards.md`（SA9，staged，71 行） | 存在 | iteration 0 verdict reject（唯一阻断 §3-F1 MAJOR）；其修复路径 2（§17 重登记 + 书面说明）已由 SA6 §18 兑现、SA8 §7-2 确认闭合判定属 SA9 |
| `wiki/raw/task_issue-419_sa10_spec.md`（SA10，staged，89 行） | 存在 | iteration 0 终审 approve（0 BLOCKER/MAJOR）；守卫 sha256 独立重算与四方登记一致 |
| `wiki/raw/task_issue-419_sa3_impl.md`（SA3 报告，iteration 3 原位更新版，staged ≡ 工作树，500 行） | 存在 | 全文亲读：§F1 落盘收口（iteration 3）、Inputs/初始状态/变更面/验证表/偏差 6/Deferred；历史 iteration 记录未被改写，只追加与显式取代 |
| `artifacts/sa3-issue419-index-reconcile.log`（**iteration 3 新证据**） | 存在（staged ≡ 工作树） | 全文亲读（181 行）；自哈希现场重算 = `34aa27a48fd58668aca601985cb565b6854fb419f71362a95c85bf73a716f80f`、181 行/13563B，与报告登记一致；pre/post 原始输出、§17 10/10、范围不变量逐项复核 |
| `artifacts/sa3-issue419-c1-staging-verification.log`（iteration 2 证据） | 存在（staged ≡ 工作树） | sha256 现场重算 = `676ac3871d2ed8926747f208d515ed1a5aafc6fe48b4b801de610bd1f377f96e`（294 行/24955B，= 报告登记） |
| `artifacts/sa3-issue419-f1-evidence-restore.log`（iteration 1 取证，C1 形） | 存在（staged，blob `0996a324…`） | sha256 现场重算 = `3b861d2dc34eff92686d52d29e746acade673831769ca9226fd5835304b45c15`（221 行/15420B）= §17 C1 登记值；正文未被改写（legacy 观测保留，取代关系由 §17/报告承接） |
| `artifacts/sa3-issue419-{package-suite,scope-and-tsc,mutation-rerun,guard-mutation-evidence,targeted-repeat}.log` | 存在（tracked、工作树 == HEAD） | iteration 0 已全文亲读；交付本体与业务面零变化 → 结论延续 |
| `artifacts/sa6-issue419-*.log` ×6 + 探针/驱动 `.mts` ×2 + `wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh` | 存在 | **§17 登记表 10/10 现场重算 MATCH**（见 §3 表）；全部 staged/工作树状态亲证 |
| 源码与测试 / Runner 与门禁基础设施 / 规范文本 | — | `git diff HEAD --stat -- packages docs CONTEXT.md .editorconfig vitest.config.ts` 空输出；`git diff --cached HEAD --name-only -- packages docs CONTEXT.md .editorconfig` 空输出；守卫 sha256 复算一致 → iteration 0 结论延续 |
| Git 状态与对象库 | — | 本轮亲证：HEAD `02abf662…`；staged 变更集恰 11 路径、无 unstaged 漂移、untracked 计数 0；`.scratch/` 仅剩 tracked `vfsl-v1-parser`；raw blob `c183ba29…` 仍在对象库（fsck unreachable、4322B、内容 sha256 = `96abbb72ecefdc3ad2b37bc8cfcdbb011e7c43b409c0b5f130c7a3e7a1b2e06c` = §17 legacy 值，身份复核成立）但**不在索引** |

## 2. Verdict

**approve**。本轮 dispatch 的四项核验全部以独立重算成立（详见 §3–§6）：

1. **raw 证据 blob 不再被 stage**：`git ls-files -s` 全条目扫描——等于 `c183ba296bbb886931b1b2adc2e24d4f930f0d7a`
   的条目 **0 个**；runner 路径不在 `git diff --cached --name-only`（索引 == HEAD ⟹ 退出提交变更集，无内容损失）。
2. **C1 形与 HEAD/工作树对齐**：三方等式 `git rev-parse HEAD:<runner>` == `git hash-object <runner>` == 索引条目
   == `46ff267d3451c22147b759002aee3345d09871a9`；sha256 = `23787bf1a40c183b69c9903a4c26cedb0737b391f490fb5eb9156f361bfed372`
   == §17 C1 登记全值；69 行/4321B。f1 日志索引条目同为 C1 blob `0996a324…`。
3. **完整候选变更集空白门禁通过**：`git diff --cached --check`（11 路径完整候选集）**rc=0、零输出**（本轮亲测）；
   非静默证明：`core.whitespace` 未设置（`git config` rc=1）、无 tracked `.gitattributes`、11 路径
   `check-attr whitespace` 全 unspecified、git 2.43.0（与 SA6/SA3 取证同版）；以默认有效规则集
   `blank-at-eol,blank-at-eof,space-before-tab` 显式重跑仍 rc=0。11 条 staged blob 逐条独立 C1 复算 11/11 PASS。
4. **批准证据与业务语义零变化**：§17 登记表 10/10 重算一致（legacy raw 行按登记保留为 superseded，工作树不再持
   raw 形属预期）；守卫 sha256 `32aa83a5ffaa6a3c…`/743 行不变；业务面（packages/docs/CONTEXT.md/.editorconfig/
   vitest.config.ts）工作树与 staged 双侧零 diff；mtime 取证与 SA3 申报的写入面吻合（见 §8）。

无 BLOCKER / MAJOR finding。iteration 1 的 approve 曾以「恢复 raw 字节」为终态预期——该预期已被 SA6 §17（C1
登记基准）+ §18.11 R5 显式取代（见 §11 动态验证项），本文件相应更新，不改写历史结论的形成时点。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| 本轮 dispatch：「Reconcile the exact staging discrepancy…ensure no raw runner-trigger asset remains staged / verify the complete candidate changeset passes the whitespace gate / Preserve all approved evidence and business semantics」 | 索引全扫描 0 个 raw 条目；`git diff --cached --check` rc=0 零输出（11 路径）；§17 10/10 重算一致；业务面双侧零 diff；证据日志 §0–§6 与本轮独立重算逐项吻合 | **全部落实**（本轮亲证） |
| SA6 §18.11 **R1 staged 半边**（索引 = C1 形 = blob `46ff267d…`/sha256 `23787bf1…`，69 行/4321B） | 索引条目 = `46ff267d3451c22147b759002aee3345d09871a9`（本轮 `git ls-files -s` 亲证） | 落实 |
| SA6 §18.11 **R4**（`git diff --cached --check` 期望 rc=0） | 真实索引完整候选集 rc=0、零输出（本轮亲测；pre-state rc=2 见证据日志 §0） | 落实 |
| SA6 §18.14-2（R1–R3 未执行是唯一未闭合动作） | 唯一残留（runner 索引条目）已落盘；其余路径 Controller 已先行落盘（iteration 3 初始状态亲读于报告） | 已闭合 |
| SA8 §7-1（Controller 落盘清单 + commit 前门禁期望 rc=0 + R5 期望值） | 终态与清单完全一致：runner 退出变更集、f1/契约/脚本/冲突日志/c1 日志/报告均已 staged 且 C1-clean、门禁 rc=0 | 落实（SA3 代执行的单条目落盘有 dispatch 明示授权，见 §4） |
| SA9 §3-F1（MAJOR）修复路径 2：§17 重登记 + 书面说明 | SA6 §17 已改 C1 基准并保留 legacy 行与理由；SA3 报告偏差 4/5/6 + 三轮提交消息书面说明改动内容；iteration 1 raw 形不再是被恢复目标 | 落实（闭合判定属 SA9 职权，SA8 §7-2 同判） |
| AC1–AC5 +「纯增量测试，零行为变化」（Issue 正文） | iteration 0 逐项核 + 本轮 sha256 复算锁死（守卫字节不变、业务面零 diff、门禁证据日志结论行未变） | 落实（不变） |
| Issue 评论 REST 快照 = 空 | 全部材料零评论引用；无评论 ID/时间戳可核对 | 约束遵守 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §8.0–§8.8 守卫全案（G1–G6/NC1–NC3/走查器/登记块） | 交付文件（iteration 0 逐项核） | 一致（守卫 sha256 `32aa83a5…` 本轮复算锁死，字节零变化） | 无 |
| §11 ALLOW（单文件交付） | `packages/replication-protocol/test/codec-route-key-guard.test.ts` 唯一交付文件，无 modification 条目 | 一致 | 无 |
| §11 DENY「`artifacts/sa6-issue419-*.log` 只读」 | 三轮写史：iteration 1 恢复 raw（SA9 路径 1 + dispatch 授权）→ iteration 2 归一 C1 = HEAD 字节（SA6 §18.11 R1 worktree 半边）→ **iteration 3 仅索引条目**（dispatch 明示 × R1 staged 半边）；终态索引 = HEAD = 工作树，DENY 偏离**归零**（路径退出变更集） | 受权例外链完整、终态合规；其余 DENY 项零触碰（live 复核：业务面双侧 diff 空 + §17 8 份未动资产哈希一致） | 无 |
| §7.2 SD-1B（src 零改动） | `git diff --stat -- packages/replication-protocol/src` 空输出（本轮亲证，含 `--cached`） | 一致 | 无 |
| SA3 技能边界「不执行 `git add`」 × 本轮 dispatch 明示指令 | 报告偏差 6 如实登记：`git add -- artifacts/sa6-issue419-runner-trigger.log` 为**唯一**索引写动作 | 更具体的 dispatch 指令显式覆盖一般边界（SA8 报告 iteration 2 §3-b 同类先例：Controller 下放 + 保留复核）；SA8 §4「真实 git 索引」冻结行针对无授权写入，本轮写入恰为 SA8 §7-1 预期的终态，无新决策面 | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 索引落盘（原 R3/R4） | Controller（SA6 §18.11 责任列）；本轮由 Controller dispatch 明示下放单路径给 SA3 | SA3 iteration 3（单条目 `git add`），Controller 已先行落盘其余路径 | 正确（授权链书面完整；SA3 未代办 SA6 契约/登记表职权） |
| §17 登记基准与登记值 | SA6（契约 owner） | SA6 iteration 2 自修订；iteration 3 零触碰（哈希重算一致） | 正确 |
| R5 提交后终态复核 | Controller（SA3/SA4 无 commit 职权） | 报告 Deferred 表 + 证据日志 §6 登记期望值 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 索引收口取证 | git 原生命令（`ls-files -s`/`diff --cached --check`/`hash-object`） | 同款只读取证 + 单条目写；证据日志延续 `sa3-issue*.log` 惯例（§ 编号 + 命令 + 原始输出 + 结论行） | 一致 | 一次性流程动作，无平行机制、无常驻脚本、无第二注册表 |

### 单一事实源 / 生命周期对称性 / 平行机制

无新事实源：索引/HEAD/工作树三方同值（C1），权威 = §17 C1 登记值；raw blob 仅存对象库（unreachable），不再被
任何登记行或索引条目引用。无运行时生命周期与平行机制；`.scratch/sa3-419-iter3/` 已删除（`ls` 亲证，
`.scratch/` 仅剩仓内既有 `vfsl-v1-parser`）。

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `artifacts/sa6-issue419-runner-trigger.log`（**iteration 3：仅索引条目**） | 设计 §11 DENY（只读）；写入授权 = 本轮 dispatch 明示 × SA6 §18.11 R1 staged 半边 × §18.14-2 × SA8 §7-1 | 索引条目 raw → C1 | 合规：写入值 = HEAD 已提交 blob `46ff267d…` ⟹ 路径退出提交变更集、DENY 偏离归零；工作树 mtime 23:43:27（iteration 2 值）本轮亲证未被改写 |
| `artifacts/sa3-issue419-index-reconcile.log`（新增） | DENY 未覆盖（glob 仅钉 `sa6-issue419-*`；`sa3-*` 证据日志自 iteration 0 起为既定惯例） | iteration 3 原始验证证据 | 合规；自哈希/行数/字节数本轮复算与报告登记一致，C1-clean |
| `wiki/raw/task_issue-419_sa3_impl.md`（原位更新并 re-stage） | 技能固定产物路径（非 DENY 既有输入） | 实现报告 | 合规；staged ≡ 工作树，C1-clean；历史 iteration 记录只追加不改写 |
| `artifacts/sa3-issue419-f1-evidence-restore.log` / `…-c1-staging-verification.log` | DENY 未覆盖（同上） | iteration 1/2 证据（C1 形） | 合规；哈希本轮复算 = 登记值/报告登记值 |
| `wiki/raw/task_issue-419_sa6_contract.md` / `…_sa6_whitespace_gate_check.sh` / `artifacts/sa6-issue419-eof-gate-conflict.log` | SA6 自有产物（iteration 2 落盘，Controller stage） | 契约修订/复现脚本/冲突日志 | 合规；哈希本轮复算 = §17 登记值（`a93fccdba5` 索引 blob 479 行 / `b7e20113…` / `d152aeff…`）；SA3 零写入（mtime 23:38–23:41 均早于 iteration 3 写入面） |
| `wiki/raw/task_issue-419_implementation_conflict_report.md`（iteration 2 版） | SA8 固定产物 | 实现冲突门报告 | 不计入 SA3 范围（SA8 自述原位更新） |
| `wiki/raw/task_issue-419_sa9_standards.md` / `…_sa10_spec.md` | 下游评审自有产物（SA9/SA10 dispatch 自述在案） | 标准/spec 审查 | 不计入 SA3 范围 |
| `wiki/raw/task_issue-419_sa4_review.md` | SA4 固定产物（本文件） | 本审查 | 本轮原位更新（staged 副本仍为 iteration 1 版，待 Controller re-stage；见 §12-O10） |

DENY 逐项 live 复核：`src/**`（diff 空，含 `--cached`）、`fixtures.ts` 与既有 13 测试（无 modification 条目）、
协议文档/ADR 0032/CONTEXT/`ws-replication/**`/`vitest.config.ts`/`package.json`/`tsconfig*.json`/
`.editorconfig`（`git diff HEAD --stat` 空输出）、Host 简报与探针/驱动（工作树 == HEAD）——全部零触碰。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| §17 C1 登记哈希的消费者（SA9/SA10/Controller 终审） | 以登记表为验真基准 | 工作树与索引均持 C1 形；legacy raw 行显式标注 superseded（`--registry` 两行 MISMATCH 属预期设计） | 低 | 无 |
| R5 提交后终态（HEAD 现为 C1 字节 `23787bf1…`，提交应保持不变） | Controller | 期望值三处登记（报告 Deferred/证据日志 §6/提交消息模板）；C1 对「末尾换行归一化」幂等（恰一个末尾 LF）⟹ iteration 0 揭示的提交期归一化器复发面已结构性消除 | 低（终态复核仍待提交后执行） | 无 |
| vitest/tsc 发现面与 CI 入口 | 根 `pnpm test` / `pnpm typecheck` | 交付零变化；被修资产不在 vitest include glob 内；新证据日志不影响套件 | 无 | 无 |
| codec 公开 API 消费者 | 全仓 | 零 src 改动（双侧 diff 空） | 无 | 无 |

## 8. 错误、恢复与并发

- **动作确定性**：`git add -- <单一路径>`（无 `-u`/`-A`），等价于把工作树既有字节（= HEAD blob）记录进索引；
  本轮三方等式独立复算证实。pre/post 原始输出完整保全于证据日志 §0/§1。
- **无静默失败**：行动作后立即重验（索引条目 / raw 残留扫描 / 门禁 rc / §17 登记），失败会直接暴露为哈希不等
  或门禁非零；`NONE_RAW_RUNNER_BLOB_STAGED` 为显式判据而非叙事。
- **门禁非静默证明**（本轮新增）：`core.whitespace` 未设、无 tracked `.gitattributes`、whitespace attr 全
  unspecified、默认规则集显式重跑 rc=0——rc=0 是真实通过，不是规则被关闭（SA6 §18.10 被否路径 B1/B2 未被采用）。
- **写入面与申报一致（mtime 取证）**：iteration 3 时间窗内仅 `index-reconcile.log`（23:57:04）与
  `sa3_impl.md`（23:58:48）被写；runner（23:43:27）/f1（23:43:27）/契约（23:41:10）/脚本与冲突日志（23:38）
  均保持 iteration 2 值——「零工作树资产字节改写」申报获独立佐证。
- **并发/TOCTOU**：变更集恰为 11 条 staged、无 unstaged 漂移、untracked 0；索引写为单命令原子动作。
- 静态无法确认的项：R5 提交后终态（见 §11）；全仓门禁 3（SA7/CI）。

## 9. 测试质量审查

- **交付本体测试面零变化**：守卫 sha256 `32aa83a5ffaa6a3c…`/743 行本轮复算一致 ⟹ iteration 0 §9 全表
  （19 用例/6 组、断言纪律独立 grep、⊇ 探针映射、变异双证据、CI 触发性、零 skip/only/todo/源码字符串断言）
  延续成立；SA9 §2「测试质量：合规」、SA10 approve 同证。
- **iteration 3 补充验证（不运测，核日志与哈希）**：证据日志 §4 守卫重跑原始输出 = `19 passed (19)`、
  `Type Errors no errors`、`GUARD_EXIT=0`；与守卫字节不变的事实自洽。索引收口对象全部为 artifacts/wiki
  路径（不在 vitest include glob `packages/*/test/**/*.test.ts` 内），无测试图影响。
- **无验收弱化**：AC1–AC5 语义零改动；SA6 §12 契约条目原样生效（SA6 §18.9 自证 + 本轮业务面零 diff 复核）。

## 10. Required revisions

无（无 BLOCKER / 无 MAJOR finding）。iteration 3 的四项 dispatch 核验全部经本轮独立重算证实成立。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| **R5：提交后哈希终态**（取代 iteration 1 版期望 `96abbb72…`） | Controller（提交后） | `git show HEAD:artifacts/sa6-issue419-runner-trigger.log \| sha256sum` = `23787bf1a40c183b69c9903a4c26cedb0737b391f490fb5eb9156f361bfed372`；`git show HEAD:artifacts/sa3-issue419-f1-evidence-restore.log \| sha256sum` = `3b861d2dc34eff92686d52d29e746acade673831769ca9226fd5835304b45c15`；` M`/staged 条目全部消失 | 值不等（C1 理论上对推断的提交期归一化器幂等；若仍复发 → 查 finalization 工具链，SA6 §18.14-1） |
| 本审查文件 re-stage 后门禁仍绿 | Controller（stage 本文件后） | `git diff --cached --check` 仍 rc=0（本文件按 C1 撰写：行尾空白 0、恰一个末尾 LF） | 本文件路径出现任何空白 finding |
| 全仓回归（根级门禁 3） | SA7/CI 跑根 `pnpm test` / `pnpm typecheck` | 两命令 exit 0 | 任何包因交付引入失败（静态未发现路径） |
| 守卫长期变异敏感性复跑 | 复跑 SA6 变异驱动（两轮） | `MUTATION_RESULT 6/6 expected`，exit 0 | 任意变异不再点亮对应探针检查 |
| 注册表 append-only 演进 | 未来新增 namespace-scope 消息型/错误码 | NC2/NC3/G2 计数响亮红 = 有意识契约修订信号（守卫头注已写明处置） | 新型静默落入旧计数 |

## 12. Non-blocking observations

- **O1–O4（iteration 0 登记，交付级）**：不变，接受（G1-b 加强、根级门禁 3 延后 SA7/CI、守卫级变异驱动未持久化、
  G4-b 下界措辞——见前版表述；守卫字节零变化故结论延续）。
- **O5（iteration 1，f1 日志组织）**：不再列为当前事项（该日志已冻结为 C1 形历史取证，组织性注记保留于 iteration 1 版本）。
- **O6/O7/O8（iteration 1）**：**已失效/取代**——恢复源唯一性与 `/tmp` 副本残留随 raw 形退出权威与索引而无当前
  风险；悬挂 blob `c183ba29…` 仍存对象库（本轮 fsck 亲证）但已无任何登记行或索引条目引用它，仅历史取证价值。
- **O9（iteration 3，证据日志覆盖面注记）**：`index-reconcile.log` §2 的逐路径 C1 表覆盖扫描时刻的 10 路径集，
  其中 `sa3_impl.md` 行记录的是终稿前 blob（`b60c43036e`，384 行/48689B）；报告终稿（`f46e2cfc0d`，500 行/65237B）
  与该日志自身的最终字节由「stage 后门禁复跑 rc=0」+ 本轮 11/11 独立复算覆盖。证据组织顺序问题，不影响效力。
- **O10（iteration 3，本文件自身的 post-freeze 漂移）**：staged 副本仍为 iteration 1 版（blob `45e2aef823`），
  本轮原位更新产生工作树 ≠ 索引漂移（SA3 冻结态之后、SA4 职权内的唯一写入）；需 Controller re-stage，已在 §11
  登记配套门禁复核。本文件按 C1 撰写，re-stage 后门禁保持 rc=0。

---

审查方法与限制：本轮为零修改静态审查（亲读全部 SA 产物/证据日志/契约 + git 状态/索引/对象库只读取证 + sha256/
git-hash-object/ls-files/check-attr/fsck/mtime 现场重算 + 11 条 staged blob 逐条 C1 复算 + 门禁退出码亲测及
非静默证明），未运行任何测试、未启动服务、未创建临时进程或文件、未执行任何 git 写命令；未修改任何被审对象
（唯一写入 = 本文件原位更新）。`approve` 不替代 SA7 对活链路/全仓门禁的最终验证，亦不预支 Controller 的 R5
提交后终态复核（§11）。
