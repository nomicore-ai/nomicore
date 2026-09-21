# SA3 Implementation Report — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）

- 派工（iteration 0，实现）：`sa-21b8addd-f3ef-41b2-a768-c5530fc7c893`（role `mabf-sa3`，phase implementation，iteration 0）
- 派工（iteration 1，finalization repair）：`sa-ef1c290c-a552-4c83-a1ac-73ad3f806405`（role `mabf-sa3`，phase implementation，iteration 1）——本报告在该轮原位更新
- 派工（iteration 2，finalization-repair 证据集 × 权威基 rebase 准备）：`sa-3974e1e9-834e-43ad-9cca-08acb5605efe`（role `mabf-sa3`，phase implementation，iteration 2）——本报告在本轮原位更新
- worktree / branch：`/home/wangjian/nomicore-fix-issue-420`，`mabf/issue-420`
- iteration 0 基线 HEAD：`7039f6dae8e7d29f0c929492f0ca2119bc63afaa`（= PR #426 merge）；iteration 0 实施期间零 commit / 零 push
- 交付承载（iteration 1 亲验）：`a315e7077576951cf0330596cdc588afbeca51be`（`feat(ws-replication): expose session host factory`，父 = `7039f6d`）——iteration 0 的 13 个 ALLOW 路径改动已由 Controller 提交；iteration 1 起点 `git diff HEAD -- packages docs CONTEXT.md` 为空
- 权威基（iteration 2 复认）：`1f5809b001c984e63fac3bafd4c1f3febc76e8a8`（= PR #427 merge，issue #421）；iteration 2 仍未执行 rebase/commit/push（交付分支零触碰）
- iteration 2 证据日志（新增）：`artifacts/sa3-issue420-finalize-rebase-evidence.log`，sha256 `bd4b5bfd0385916823c26fd6fdf54dbaa7e3ca0d66cd2663875312b6739d64a3`
- Owner 评论：无（三轮派工均明文 none；REST comments = `[]`）⇒ 无逐条评论映射可建

---

## Iteration 2 — 证据集备妥：精确提交清单 × 权威基 rebase 机械解

- 派工：`sa-3974e1e9-834e-43ad-9cca-08acb5605efe`（role `mabf-sa3`，phase implementation，iteration 2）；Owner feedback requirements = none、REST comments = `[]`。
- 目标：把 iteration 1 已批准的 finalization-repair 证据集**备妥为可精确暂存/提交的集合**（SA8 RA6），并对**权威基 `1f5809b`**（PR #427 = issue #421）的 rebase（SA8 RA1）给出机械可复现的准备证据。**零业务语义改动**：本迭代不触任何 `packages/`、`docs/`、`CONTEXT.md`、测试基础设施、config 或生成物字节。
- 证据日志（新增，冻结）：`artifacts/sa3-issue420-finalize-rebase-evidence.log`，**469 行 / 33524 B / sha256 `bd4b5bfd0385916823c26fd6fdf54dbaa7e3ca0d66cd2663875312b6739d64a3`**（日志不能自载摘要 ⇒ 自登记于本报告；与 iteration 1 同惯例；该 digest 不含本报告自身任何字节）。

### Iteration 2 事实与动作

| 面 | 事实（命令/值） | 结果 |
| --- | --- | --- |
| 候选集 | `git status --porcelain` = 3 tracked-modified + 16 untracked；本迭代新增 1 条日志 ⇒ 20 条 | iteration 1 的 18 条 → **20 条**：新增 `wiki/raw/task_issue-420_sa4_review.md`（SA4 iteration-1 原位评审；SA4 O13 明文要求随交付归档）与本迭代日志；无路径移除/改名/删除 |
| C1 形态 | 全 20 路径扫描（行尾空白 / CR / 末字节 / EOF 空行） | `C1_FAIL_COUNT=0`（19 条于本日志写入前全过；本日志自身亦过） |
| 暂存门 | scratch index：`read-tree HEAD` + `add -A -- <20 路径>` + `diff --cached --check` | `GATE_RC=0`；每条 staged blob == worktree 字节；真实 index 零暂存条目（SA3 不写 index） |
| 业务面身份 | `git diff HEAD -- packages docs CONTEXT.md .editorconfig vitest.config.ts package.json tsconfig*` 空；13/13 ALLOW 路径 blob == HEAD | `ALLOW_PATH_IDENTITY_FAIL_COUNT=0` |
| 冻结哈希完整性 | `evidence-reconcile.log` = `4f893393…`（与 SA8 报告 §2-4 登记值逐位相同）；`sa9_standards` `434fd836…`、`sa10_spec` `fba2b74a…` 不变；SA8 报告现值 `f3e2b357…`（iteration-7 原位更新字节，落在 RA6 hash 口径注记面内）、SA4 报告现值 `c70309a3…` | 无在册哈希承诺被破坏；两条现值首次落表（iteration-1 未登记） |
| rebase 事实 | merge-base `7039f6d`；分叉 4 vs 1；父增量 31 路径 ∩ 20 staging 路径 = **0**；全 OID `git merge-tree` → 树 `a24156e2…`、唯一冲突 `packages/ws-replication/src/index.ts`、stage blob `977bd3d`/`7e2f746`/`71fc417` | 与 SA8 历轮配方逐位复现；证据归档 commit 在 rebase 前后任意顺序重放均零冲突 |
| 并集解 | union blob `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`（2872 B / 95 行）：base→union 为纯增量（26 插 0 删）；值导出 11→13（+`createHubReplicationEdge`、+`createHubSessionHost`）、类型 44→59（+15，零删除） | 「纯并集唯一机械解」逐字成立；与 #418 冻结导出表 13 名全等断言相容 |
| 干跑 rebase | gitignored 临时 worktree `.worktrees/sa3-420-rebase-dryrun`（交付分支零触碰）：`git rebase 1f5809b` → 唯一冲突 → 写入 union → `--continue` ⇒ commit `c9653f0d…`（父 `1f5809b`）、tree `e777f961…` | 唯一冲突面与 merge-tree 完全一致 |
| 机械性证明 | `read-tree a24156e2` + `update-index --cacheinfo 100644,08fa49a1…,src/index.ts` + `write-tree` == `e777f961…` | `IDENTITY=YES`：干跑树 = merge-tree 自动合并结果 + 唯一冲突路径并集 blob ⇒ **冲突路径之外零手写内容** |
| 证据归档重放 | 在干跑树上把 20 条证据路径 `add -A --`（`diff --cached --check` RC=0）后 commit：run #1 = `49ed8bda…`（tree `9d7d4de3…`，父 = 干跑 rebase commit `c9653f0d…`）；`git diff c9653f0 49ed8bd -- packages docs CONTEXT.md …` 空；逐路径 `git show HEAD:<p>` 与工作树字节比对 **20/20 相同**（18 条冻结行 = 日志 §2 表值，含 reconcile log `4f893393…`） | 归档 commit 仅含证据、逐字节等于扫描集；「先归档后 rebase」与「先 rebase 后归档」两序皆零冲突（§5 交集 0） |
| 双侧保真 | 3 条 auto-merge 路径（`CONTEXT.md`/`hub-connection.ts`/#418 contract 测试）交付侧与父侧新增行缺失数均 = 0；13 条 ALLOW 路径中 9 条与交付树 blob 逐字节相同、4 条 = 双方并集（恰为 both-modified 集） | 交付内容零丢失、零改写 |
| 干跑门禁（**不闭合 RA2**） | 真装（`pnpm install --frozen-lockfile --offline`）后：V17 3 files/63 tests 绿 exit 0；V18 包 tsc exit 0；V19 包全量 **87 files / 749 tests** 绿 exit 0（= RA2 预期 87 文件）；V20 根 typecheck exit 0；AC3 listen 矩阵 7 files/52 tests 绿 | rebase 配方在干跑新树落地即绿（树绑定仍归真实 rebase 后的重取） |
| 交付树重取 | 当前交付树（a315e70 业务字节 + 20 条证据）：V17 3 files/63 tests 绿 exit 0；V18 包 tsc exit 0 | 与 iteration 1 同口径，零回归 |
| 环境陷阱（登记） | 以 symlink 共享 node_modules 的干跑首跑产生 4 条**伪红**（#421 test-d `TS2554: Expected 1 arguments, but got 0`，exit 1）；同命令在**真装**的父树 `1f5809b` 上 8/8 绿 exit 0 | 伪红已排除；证据一律取真装，日志 §8 明文禁止以 symlink 复现 |

### File scope check（iteration 2，实际写入面）

| Changed path | 授权 | 用途 |
| --- | --- | --- |
| `artifacts/sa3-issue420-finalize-rebase-evidence.log` | 本轮派工明文（证据集准备） | 新增证据日志：候选集/哈希/C1/暂存门/rebase 事实/并集解/干跑/后续重取义务原文 |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3 固定产物（skill：原位更新实现报告） | 登记 iteration 2（本报告为活文档，其提交字节以 Controller 暂存时为准） |
| （零其它路径） | — | 其余 18 条 staging 路径在本迭代**零字节改动**（含 iteration-1 的 13 条归一化路径、SA4/SA8/SA9/SA10 产物） |

- 收尾复跑：本报告与日志定稿后，对**冻结 20 条集合**再执行一次归档重放与全量门（C1 扫描 `C1_FAIL_COUNT=0`、scratch-index `GATE_RC=0`、staged==worktree `IDENTITY_FAIL=0`、真实 index 零暂存）。该次重放的 commit OID **不写入任何被暂存文件**（自指会改字节），随 SA3 iteration-2 结构化结果报出；被暂存文件自身的字节由「staged blob == worktree blob」门覆盖（活报告口径 = SA8 RA6 hash 注记）。
- 边界：本迭代**未**对交付分支执行 `git add/commit/rebase/push`；两个临时 worktree（`.worktrees/sa3-420-{parent-probe,rebase-dryrun}`）在收尾前删除，无新分支、无新 tag。
- 树绑定：干跑与交付树证据**均不闭合 SA8 RA2**；rebase 后须在真实新树重取五门（分工与命令见日志 §11）。
- 触发条件：若权威基 head 前移离开 `1f5809b`，停止并按 `git merge-tree` 复认冲突面后再解（SA8 RA1）。

---

## Iteration 1 — finalization repair：未提交证据集的 C1 归并

- 派工：`sa-ef1c290c-a552-4c83-a1ac-73ad3f806405`（role `mabf-sa3`，phase implementation，iteration 1）；Owner feedback requirements = none、REST comments = `[]`。
- 触发：finalization repair 诊断（`MABF_FINALIZE_REPAIR_REQUIRED` / `whitespaceViolations`）——把交付提交 `a315e70` 之后仍留在工作区的 16 条 #420 证据路径作为候选集暂存后，强制门 `git diff --cached --check` 报 **39 条 whitespace findings（27 trailing-whitespace + 12 blank-at-eof），分布于 13 条路径**。同一缺口已由 SA9 §10-M3 独立登记（「commit 证据集不完整……建议 finalize/提交方在同一交付归档中补齐」）。本轮目标 = 把这套证据集归并进既有交付使其**可提交（gate-clean）**，且**不改动任何已批准实现语义**。
- C1 规范形（沿用 #419 先例 `bd75a2c`）= `.editorconfig [*]`（`end_of_line=lf`、`insert_final_newline=true`、`trim_trailing_whitespace=true`）+ 门规则（`blank-at-eol`、`blank-at-eof`）：(1) LF 前无 `[ \t]`；(2) EOF 无 `[ \t]`；(3) 恰一个末尾 LF。
- 动作：对 13 条非 C1 路径执行 `perl -0777 -i -pe 's/[ \t]+(?=\n)//g; s/\n+\z/\n/' <path>`（**仅空白**）；3 条本已 C1 干净（`…_implementation_conflict_report.md`、`…_sa9_standards.md`、`…_sa10_spec.md`）零字节改动。SA3 不写真实 index（无 `git add`/`commit`/`push`）；全部暂存验证经 `GIT_INDEX_FILE` scratch index。
- 证据日志（冻结）：`artifacts/sa3-issue420-evidence-reconcile.log`，**656 行 / 53056 B / sha256 `4f893393b9fba731b8d843666472abb9d0eda554d17114d811abf884b2b0d2fe`**——含诊断复现、逐路径字节事实、无空白字节/内容行保持证明、scratch-index 逐条 C1 扫描、业务面零 diff 与重跑验证原文、精确 staging 清单与 post-commit 期望。

### Iteration 1 changed paths（证据面；零 code/test/doc 字节变化）

| Path | 生产者 | iteration 1 变更 | before sha256[:16] → after sha256[:16] | Δbytes |
| --- | --- | --- | --- | --- |
| `artifacts/sa3-issue420-design-letter-divergence.log` | SA3 | C1（去 EOF 空行） | `6022accc5312a3ac` → `b4c7f8540df30af2` | −1 |
| `artifacts/sa3-issue420-mutation-M1-a12-red-arm.log` | SA3 | C1（去 EOF 空行） | `7d4676dc92ee01a3` → `03237793be1e2fc5` | −1 |
| `artifacts/sa3-issue420-mutation-M2-drop-open.log` | SA3 | C1（8 行行尾空白 + EOF 空行） | `6361560ba4d7992e` → `d473d0bfc7205c92` | −9 |
| `artifacts/sa3-issue420-mutation-M3-restamp-sequence.log` | SA3 | C1（7 行行尾空白 + EOF 空行） | `4475bc3a025996a1` → `d53d4aa081e84e43` | −8 |
| `artifacts/sa3-issue420-mutation-M4-disable-shim.log` | SA3 | C1（去 EOF 空行） | `d0e080a70e35d6f9` → `a6025d4848875090` | −1 |
| `artifacts/sa3-issue420-mutation-M5-session-resequence-check.log` | SA3 | C1（8 行行尾空白 + EOF 空行） | `1050e2c52dd30697` → `36d7512090d04ee6` | −9 |
| `artifacts/sa3-issue420-mutation-M7-reopen-reentry.log` | SA3 | C1（去 EOF 空行） | `25d8b33ecd88fe93` → `1689afe6dc61d793` | −1 |
| `artifacts/sa3-issue420-mutation-M7b-drop-inflight-open.log` | SA3 | C1（去 EOF 空行） | `5fba2315da1fe3a3` → `b635a9474b43892d` | −1 |
| `artifacts/sa3-issue420-red-contract.log` | SA3 | C1（去 EOF 空行） | `6401bbc17ad66c43` → `75109f57b153a9e7` | −1 |
| `artifacts/sa6-issue420-runner-trigger-red.log` | SA6 | C1（4 行行尾空白） | `5202a6c9b0c7e573` → `b26a55ab841554b7` | −4 |
| `artifacts/sa7-issue420-focused-420-tests.log` | SA7 | C1（去 EOF 空行） | `45d4e82b64d00fa4` → `37565aeee394eacd` | −1 |
| `artifacts/sa7-issue420-listen-matrix-baseline.log` | SA7 | C1（去 EOF 空行） | `de80fcf5835ff9f9` → `9882feec7943e6ac` | −1 |
| `wiki/raw/task_issue-420.md` | Host 简报 | C1（去 EOF 空行） | `18f95b5d0011cf2d` → `2eb0d8cb0bae20ac` | −1 |
| `artifacts/sa3-issue420-evidence-reconcile.log` | SA3（本轮新增） | 新增证据日志（记录载体，candidate 集外） | — → `4f893393b9fba731` | +53056 |
| `wiki/raw/task_issue-420_sa9_standards.md` | SA9 | 无字节变化（本已 C1；未跟踪 → 纳入交付） | `434fd8364db0d855` | 0 |
| `wiki/raw/task_issue-420_sa10_spec.md` | SA10 | 无字节变化（本已 C1；未跟踪 → 纳入交付） | `fba2b74af08caffe` | 0 |
| `wiki/raw/task_issue-420_implementation_conflict_report.md` | SA8（iteration 6） | 无字节变化（本已 C1；tracked-modified → 纳入交付） | `590ef35da0e9dc4c` | 0 |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3（本文件） | 新增本 iteration 1 章节（记录载体，candidate 集外） | — | — |

### File scope check（iteration 1）

| Changed path | 授权 | 用途 |
| --- | --- | --- |
| 13 条既有证据日志 + `wiki/raw/task_issue-420.md` | 本轮派工明文（归并证据集使其可提交） | 仅 C1 空白归一化；非空白字节与 rstrip 内容行序完全一致（证据日志 §2 `CONTENT_PRESERVATION_FAIL_COUNT=0`） |
| `artifacts/sa3-issue420-evidence-reconcile.log` | 本轮派工明文（证据） | 归并与验证原文 |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3 固定产物（skill：原位更新实现报告） | 登记 iteration 1 |
| `wiki/raw/task_issue-420_{sa9_standards,sa10_spec}.md`、`…_implementation_conflict_report.md` | 非 SA3 写入（SA9/SA10/SA8 产物）；本轮仅纳入 staging 清单 | 交付归档补齐（SA9 §10-M3） |

- **零 ALLOW 代码/测试/文档路径改动**：13 条 ALLOW 路径（设计 §11）逐字节等于 HEAD blob（证据日志 §5 `ALLOW_PATH_IDENTITY_FAIL_COUNT=0`）；`packages/**`、`docs/**`、`CONTEXT.md`、`.editorconfig`、`vitest.config.ts`、`package.json`、`tsconfig*` 工作区与暂存 diff 全空。
- 真实 git index 零写入；无 hash registry 被破坏（#420 各报告未注册这些 artifact 的 sha256；40/64-hex 扫描仅命中 commit OID 与 HEAD ref）。
- **引用完备性（SA9 §10-M3 闭合判据）**：交付报告（HEAD 上的 `task_issue-420_{design,sa2_review,sa3_impl,sa4_review,sa6_contract,sa7_report}.md`）引用的全部 `issue420` artifact 路径现均为「`committed_at_HEAD`」或「本轮 staging set」，`UNRESOLVED_CITED_PATHS=0`；唯一不在场的 `artifacts/sa6-issue420-smoke.mts` 是 SA6 §16 明文登记为已删除的临时 smoke 脚本（非证据缺口）。
- 一致性：`artifacts/sa3-issue420-evidence-reconcile.log` 自身满足 C1（trailing-ws=0、blank-at-eof=0、恰一末尾 LF），嵌入的 gate 命中行以 `{WS}` 占位呈现（日志首节声明该约定）。

### Verification（iteration 1，归并后重跑；与 iteration 0 的 V1–V16 并列）

| # | Command | Result | Evidence |
| --- | --- | --- | --- |
| V17 | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck <三契约路径>` | **绿**：`Test Files 3 passed (3)` / `Tests 63 passed (63)` / `Type Errors no errors` / exit 0 | 证据日志 §6 |
| V18 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json` | **绿**：exit 0 | 证据日志 §6 |
| V19 | `… vitest run --typecheck packages/ws-replication/test` | **绿**：`Test Files 80 passed (80)` / `Tests 651 passed (651)` / `Type Errors no errors` / exit 0（与 iteration 0 V4 同口径，零回归） | 证据日志 §6 |
| V20 | `pnpm typecheck`（根 15 tsconfig 串行） | **绿**：exit 0 | 证据日志 §6 |
| V21a | `GIT_INDEX_FILE=<scratch> git diff --cached --check`（16 条证据 + 本日志 = 17 条候选）；逐条 staged-blob C1 扫描 | **CLEAN**：`GATE_RC=0`；C1 扫描 PASS 17/17（trailing_ws=0、blank_at_eof=0、末字节 LF、CR=0、canon-net=0、worktree==index） | 证据日志 §4（16 条 RC=0 / 16 PASS）；iteration 1 实测 17/17 |
| V21b | 同上，本报告更新后的 18 条全量候选（16 证据 + 日志 + 本报告） | **CLEAN**：`GATE_RC=0`；C1 扫描 PASS 18/18 | iteration 1 终态实测（命令见本节末） |

- iteration 0 的 V1–V16 取证于基线 `7039f6d` 上的工作区实现；该实现的 13 个 ALLOW 路径字节与交付提交 `a315e70` 逐字节相同（本轮 `git diff HEAD -- packages docs CONTEXT.md` 空 + 13 条 blob 身份核对），故其结论对当前交付树继续成立；V17–V21 为归并后在交付提交树上的独立重跑。
- V21a/V21b 实测命令（含本报告最终修订后的复跑；真实 index 零写入）：

```text
$ GIT_INDEX_FILE=/tmp/sa3-420-scratch-index-final git read-tree HEAD
$ GIT_INDEX_FILE=/tmp/sa3-420-scratch-index-final git add -A -- <18 candidate paths>
$ GIT_INDEX_FILE=/tmp/sa3-420-scratch-index-final git diff --cached --check
FINAL_GATE_RC=0
$ # per-path staged-blob C1 scan (trailing_ws / blank_at_eof / last byte / CR / canon-net / worktree==index)
FINAL_C1_SCAN_FAIL=0        # 18/18 PASS
```

---

## Inputs consumed

| 输入 | 用途 |
| --- | --- |
| `wiki/raw/task_issue-420.md` | Issue 正文 AC1–AC5、非目标 |
| `wiki/raw/task_issue-420_sa6_contract.md` | **冻结契约**：§12.1 公共签名逐字、§12.2 A1–A12、§12.3 AC3 机制 (a)、§12.4 C4a–C4d、§12.5 C5a–C5d、§12.6 两处授权编辑、§12.7 M1–M7、§12.0 运行命令 |
| `wiki/raw/task_issue-420_design.md`（iteration 1） | ALLOW/DENY LIST、§7 D1–D10、§12 验收映射、§14 SA2-F1 修订映射 |
| `wiki/raw/task_issue-420_sa2_review.md` | verdict **approve**（SA2-F1 已解决；N1'–N3' 非阻断观察） |
| `wiki/raw/task_issue-420_conflict_report.md` | SA8 前置门禁 **clear**（RA1–RA5、S1–S6） |
| `wiki/raw/task_issue-420_relevant_decisions.md` | ADR 0032 决策 1–5、CONTEXT.md:225-235、协议 §4/§7.1/§8-11/§13/§14/§17/§19/§23.1 |
| `wiki/raw/task_issue-420_design_conflict_report.md` | SA8 design 复查 **clear**（RA1'–RA6'，35 项对照） |
| `artifacts/sa6-issue420-*`（16 项） | 能力缺口/因果/序列纪律/纯度/中继保真探针与基线日志 |
| 源码开卷核对 | `src/{index,hub-session,hub-split,hub-edge,hub-connection,hub-namespace,frame-io,observer,defaults,validate,types}.ts`；`test/{harness,driver}.ts`、7 矩阵文件、#418 两冻结锚文件、`vitest.config.ts`、`packages/*/tsconfig*`、`package.json` |

---

## Existing worktree reconciliation

| 项 | 事实 |
| --- | --- |
| 既有 `wiki/raw/task_issue-420_sa3_impl.md` | **不存在**（本轮首次实现；`ls` 核对） |
| 未提交实现残留 | **无**：初始 `git status --short` 仅显示 SA6 诊断产物（`artifacts/sa6-issue420-*`）与 wiki 输入（`??`）；`packages/**`/`docs/**` 零 diff |
| SA6 诊断资产 | 原样保留（未修改）；其中 3 个 `.mts` 引用被本轮授权重命名替换的内部名——登记见「Deviations」第 2 条 |
| 授权编辑核对 | #418 contract 测试 `FROZEN_PRODUCTION_EXPORTS` 由 11 → 12 名（仅插入 `'createHubSessionHost'`，字母序零重排）；structure 测试仅机械跟随重命名 |
| 决策面核对 | 公共冻结签名逐字采用 SA6 §12.1；`hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/协议文本/上游包 **零 diff**（见 Verification V8） |
| iteration 1 起点（交付提交 `a315e70` 之后） | `git diff HEAD -- packages docs CONTEXT.md` 空（13 条 ALLOW 路径零 diff）；工作区仅 16 条未提交证据路径 —— 处置见「Iteration 1」节 |

---

## Changed paths

| Path | Design section | Change |
| --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts` | §7 D1–D5 | **新增**（280 行）：公共冻结面（1 工厂 + 7 类型，逐字 SA6 §12.1）+ 句柄实现 + adapterPort（17 成员：闭包回放 ok-投影、字节出入、占位/回传序、dormant 面、observer 单点复用、信号面） |
| `packages/ws-replication/src/index.ts` | §7 D9 / AC1 / S5 | 追加 1 值导出 `createHubSessionHost` + 7 类型导出（append-only，11 → 12 值） |
| `packages/ws-replication/src/hub-session.ts` | §7 D9（U1） | 机械重命名：`createHubSessionHost`→`createHubSessionSink`、`HubSessionHostConfig`→`HubSessionSinkConfig`、删 `HubSessionHost = HubSessionSink` 别名、`HubSessionSinkImpl`；头注补公共工厂指引（零行为） |
| `packages/ws-replication/src/hub-connection.ts` | §7 D9 | import/调用点/头注机械跟随（3 行） |
| `packages/ws-replication/src/hub-split.ts` | §7 D9（仅头注） | 头注「绝不进 src/index.ts」→ 三工厂现状（成员/类型零变化） |
| `packages/ws-replication/test/issue420-shim-hub.ts` | §7 D6/D7 | **新增**（夹具）：宿主桥（三分支路由 + 有界 pending + 载体提交 + E10 兜底 + closed 守卫 + terminate 相位挂起）+ shim hub（accept/acceptTrusted 门链镜像 + 早到帧有界缓冲 + 真 edge 装配）+ 探针 |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts` | §12.1 / AC1 | **新增**：冻结签名正控全集 + 负控 `@ts-expect-error` ×6（denied 投影 / authorize / transport / port / `namespaceFrame` / `onFrame` 无 number） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts` | §12.2 / §12.4 / §12.5 | **新增**：A1–A12 + C4a–C4d + C5a–C5c（内存管道对完整回合，无 socket 无 worker） |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts` | §12.3（机制 (a)） | **新增**：`vi.mock` 仅替换 `createHubReplication` + 动态 import 7 矩阵文件（断言体零编辑）+ 末位反空跑 describe + 同 run unhandled rejection 哨兵 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | §12.6 授权编辑 1 | `FROZEN_PRODUCTION_EXPORTS` 插入 1 行（零删除零重排） |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | §12.6 授权编辑 2 | 7 行机械跟随（:13 注释、:39 导入、:421/:528/:571/:594 调用、:618 期望列表） |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | §7 D10 / RA1（E1+E2） | 澄清附录 +23 行：A1 信号词汇公共面映射（含 `connection-fatal` 公共化登记、同步 pipe 边界）、A2 决策 3 三载体调和（α/β/γ + 重 OPEN 语义）、A3 决策 5 dormant 降级 + U8 登记 |
| `CONTEXT.md`（:229-231） | §7 D10 / RA1（E2） | 「SessionHost」词条补公共工厂轨形态（描述子字段、句柄成员、denied/throw 不过公共缝、内部 splice 拉取式）与 _Avoid_ 一项 |

---

## SA2 Finding落实

| Finding ID | Implementation | Result |
| --- | --- | --- |
| **SA2-F1（MAJOR，设计 iter 1 已解决）** 桥 `openNamespace` 缺「同连接再 OPEN / authorized 在途 OPEN」分支 | 夹具 `HostBridge.openNamespace` 落**三分支路由**：① 相位 `authorized` → 不再调 `open()`，OPEN 帧字节经既有句柄 `handleFrame` 转发（`reopenForwarded` 探针）；② 相位 `routing` → 入与 `namespaceFrame` 同一有界 pending 窗口（≤16 帧/ns + 单帧 ≤ `maxFrameBytes`，溢出 `CONNECTION_POLICY_VIOLATION`(1008) 响亮收口），authorized 续体**同步段内**冲刷（`pendingFlushed` 探针）；③ 相位 `denied` → `denialSink.openNamespace`（生产 `onOpen` 承接重开矩阵）。路由相位互斥、单调、不可逆；closed 守卫放弃在途路由 | **已落实**。证据：矩阵 `ac1-ac2-open.test.ts:212`（opening 中重复 OPEN → `OPEN_OK`×2 + authorize 恰一次）与 `:240`（conflicted 后再 OPEN → `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）在 shim 臂**断言逐字不变**全绿（V3/V4）；变异 M7（再 OPEN 重入 `open()` → 重复前置 throw）与 M7b（丢弃在途 OPEN）分别使两用例转红（V9/V10） |
| N1'（非阻断）closed 守卫放弃在途路由时挂起的 `terminateNamespace` promise 归宿未明示 | `terminateNamespace` 相位 `routing` → 挂起至路由完成（`settleTerminateWaiters` 按结局委托句柄/denialSink）；桥 closed 或续体异常 → **no-op resolve**（镜像 listen quiet 语义） | 已落实（A10 live 直调绿；该角落无验收路径触达，登记为 R11 同族） |
| N2'（非阻断）「pending 冲刷必须在续体同一同步段内完成」为隐式不变量 | `flushAuthorized`/`flushDenied` 在续体同步段内调用（相位置位后、无 await 间隔）；头注登记该不变量 | 已落实（矩阵 `:212` 用例即其载荷路径；M7b 反证） |
| N3'（非阻断）设计 :188 Map 键模板排版笔误 | 实现按语义落 `${connectionKey}\u0000${namespaceId}` | 已落实 |
| N1/N2/N3/N5/N6（iteration 0 遗留） | N1 → 夹具头注登记 accept 门链保真度差异清单；N2 → 本报告「Changed paths」单列 `hub-split.ts` 头注；N3 → 句柄连接投影头注登记 {ready, closed} 两态；N5/N6 → 维持登记 | 已按设计 §14 处置 |

---

## File scope check

| Changed path | ALLOW entry | Purpose |
| --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts` | ALLOW 第 1 条（新增） | D1/D2/D3/D4/D5 唯一新生产代码 |
| `packages/ws-replication/src/index.ts` | ALLOW 第 2 条（追加导出） | AC1/S5 append-only |
| `packages/ws-replication/src/hub-session.ts` | ALLOW 第 3 条（重命名 + 别名删除 + 头注） | D9/U1 |
| `packages/ws-replication/src/hub-connection.ts` | ALLOW 第 4 条（机械跟随） | D9 |
| `packages/ws-replication/src/hub-split.ts` | ALLOW 第 5 条（**仅头注**） | D9（注释真实性；SA2 N2 单列登记） |
| `packages/ws-replication/test/issue420-shim-hub.ts` | ALLOW 第 6 条（新增夹具） | D6/D7；仅深路径 import（D8 mock 安全） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts` | ALLOW 第 7 条（新增） | AC1 类型冻结 |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts` | ALLOW 第 8 条（新增） | AC2 A1–A12 + AC5 C5a–C5c + AC4 C4a–C4d |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts` | ALLOW 第 9 条（新增） | AC3 机制 (a) + 反空跑 + 零 unhandled rejection |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | ALLOW 第 10 条（§12.6 授权编辑 1） | 冻结导出表插 1 行 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-structure.test.ts` | ALLOW 第 11 条（§12.6 授权编辑 2） | 机械跟随内部重命名 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | ALLOW 第 12 条（澄清附录 E1/E2） | RA1 |
| `CONTEXT.md`（:229-231） | ALLOW 第 13 条（词条更新） | RA1/E2 |

- 每个实际 changed path 均有 ALLOW 条目；**无 ALLOW 外改动**（V8 全量审计）。
- DENY LIST 逐项零 diff：`hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/其余 src 单点/协议文本/上游包/`apps`/`domains`/`package.json`/7 矩阵文件（后者仅经 `vi.mock` 二次执行，零编辑）。

---

## Verification

> 全部命令在 worktree 根执行；日志 `artifacts/sa3-issue420-*.log`（worktree-relative）。最终冻结态顺序重跑（无并发变异探针）。

| # | Command | Result | Evidence |
| --- | --- | --- | --- |
| V1 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json`（**红阶段**，实现前） | **红**：8 × `TS2305`（7 类型 + 工厂缺）+ `TS2307`（模块缺）+ 级联；`[tsc exit: 2]` | `artifacts/sa3-issue420-red-package-tsc.log` |
| V2 | `vitest run --typecheck <三契约路径>`（**红阶段**） | **红**：`Test Files 3 failed`、`Errors 7 errors`、`vitest exit: 1`（红因 = 能力缺口/模块缺席，与 SA6 `type-lock-red` 同形） | `artifacts/sa3-issue420-red-contract.log` |
| V3 | `vitest run --typecheck <三契约路径>`（**绿**） | **绿**：`Test Files 3 passed (3)` / `Tests 63 passed (63)` / `Type Errors no errors` / `[vitest exit: 0]` | `artifacts/sa3-issue420-green-contract.log` |
| V4 | `vitest run --typecheck packages/ws-replication/test`（包全量；listen 臂 + 新三文件） | **绿**：`Test Files 80 passed (80)` / `Tests 651 passed (651)` / `Type Errors no errors` / exit 0（SA6 基线 77/588 ⇒ +3 文件/+63 用例，零回归） | `artifacts/sa3-issue420-package-suite.log` |
| V5 | `pnpm exec tsc -p packages/ws-replication/tsconfig.json`（绿） | **绿**：`[tsc exit: 0]`（含 test-d 负控 `@ts-expect-error` 全部被触发，无 TS2578） | `artifacts/sa3-issue420-package-tsc.log` |
| V6 | `pnpm typecheck`（根，15 tsconfig 串行） | **绿**：`[typecheck exit: 0]` | `artifacts/sa3-issue420-root-typecheck.log` |
| V7 | `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（根全量） | **绿**：`Test Files 443 passed (443)` / `Tests 5381 passed (5381)` / `Type Errors no errors` / `[root test exit: 0]` | `artifacts/sa3-issue420-root-test.log` |
| V8 | 结构/范围独立复核：`git diff --stat <DENY 全表>`（空）；`git diff --check`（clean）；`grep -rlE 'worker_threads\|MessageChannel\|MessagePort' packages/ws-replication/src packages/ws-replication/package.json \| wc -l` → `0`；node 侧 `Object.keys(@nomicore/ws-replication).sort()` → 12 名（11 冻结名 + `createHubSessionHost`，字母序位于 `createHubReplicationPlugin` 与 `createPeerReplication` 之间） | **符合**：DENY 零 diff、AC4 结构门 0 命中、导出恰增一名 | 本报告 §File scope check + V7/V3（C4a 结构门在测试内亦绿） |
| V9 | 变异 **M7**（再 OPEN 重入 `open()` → 重复前置 throw；临时改动，已复原）：`vitest run <shim 矩阵>` | **红**：`Tests 2 failed \| 51 passed`；`:240` 用例失败（`REPLICATION_ID_MISMATCH` ≠ `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）+ 反空跑（`INTERNAL_ERROR` 签名）+ 日志含 `hub-session-host: (connectionKey, namespaceId) 重复开启` | `artifacts/sa3-issue420-mutation-M7-reopen-reentry.log` |
| V10 | 变异 **M7b**（丢弃在途 OPEN，取消分支 ②；已复原） | **红**：`:212` 用例失败（`opening 中重复 OPEN` 无第二 `OPEN_OK`）+ 反空跑 | `artifacts/sa3-issue420-mutation-M7b-drop-inflight-open.log` |
| V11 | 变异 **M4**（关闭 shim 替换，矩阵臂跑回 listen；已复原） | **红**：`Tests 1 failed \| 52 passed`——恰好末位反空跑 describe 红（52 listen 用例仍绿 ⇒ 反空跑判据非恒真） | `artifacts/sa3-issue420-mutation-M4-disable-shim.log` |
| V12 | 变异 **M5**（session 解码自行重检入站序；已复原） | **红**：`Tests 9 failed`，含 C5a 正锚与 C5c 结构门（`expectedSequence` 出现在 `src/hub-session-host.ts`） | `artifacts/sa3-issue420-mutation-M5-session-resequence-check.log` |
| V13 | 变异 **M2**（桥丢弃首 OPEN 转发；已复原） | **红**：`Tests 9 failed \| 1 passed`（A4 无 `OPEN_OK` 起全回合断言链断） | `artifacts/sa3-issue420-mutation-M2-drop-open.log` |
| V14 | 变异 **M3**（桥二次盖章序列；已复原） | **红**：`Tests 7 failed \| 3 passed`（含 A4–A8 缝序/wire 序纪律） | `artifacts/sa3-issue420-mutation-M3-restamp-sequence.log` |
| V15 | **M1**（内建红臂 A12：宿主不回传被分配序） | **绿/红按设计**：断言绿（观察到 `ACK_STATE_VIOLATION` 连接级 ERROR + `close(1002,'protocol-error')` + onSignal 命中），被断言对象红（回合不可达 `live`） | `artifacts/sa3-issue420-green-contract.log`（A12 用例）+ `artifacts/sa3-issue420-mutation-M1-a12-red-arm.log` |
| V16 | **M6**（公共入口去掉导出 = HEAD 态） | 已由 V1/V2 承载（红因 = 缺导出/缺模块） | `artifacts/sa3-issue420-red-*.log` |

**验收契约覆盖**：AC1（V3 类型冻结 + V8 导出面）、AC2 A1–A12（V3/V15：A2 纯 JSON+`DataCloneError` 负控、A3 kind ⊆ namespace 域、A4 `OPEN_OK`×1 + authorize×1 + W2 `NAMESPACE_NOT_FOUND` 负控、A5 快照序回指 + reconciling、A6 双向收敛、A7 双向 UPDATE/ACK + `update-acked` 零 resync、A8 wire 严格 +1 无 0 泄漏 + 出站占位 0/入站 wire 序、A9 `CLOSE_OK` 回指 + settled 恰一次、A10 revoke 收口零 fatal、A11 `close()` 幂等 drain + 零 unhandled、A12 红臂）、AC3（V4 60 用例 shim 臂 + 反空跑 + 零 unhandled；V11 负控）、AC4（C4a 结构门 + C4b/c/d）、AC5（C5a 回退序仍被消费 + `CLOSE_OK{ackedSequence:2}`、C5b edge 单点、C5c 结构门；V12 变异）。

---

## Deferred verification

| 项 | 归属 |
| --- | --- |
| 回归面扩大（真实 transport 动态、registry/scheduler 家族、backpressure/shed 族、跨包集成） | SA4/SA7（本报告只跑 SA6 指定面 + 全量套件，不承担最终动态验证） |
| **rebase 后五门重取（SA8 RA2，iteration 2 追加）** | 交付执行者 + SA4/SA7 证据链：rebase 落地后在真实新树重取（#418 契约 exact-equal + #420 三契约；双 test-d；包全量预期 87 文件；根 typecheck；AC3 矩阵逐字）。SA3 的 delivery 重取与 dry-run 树结果均为 **pre-rebase / scratch-tree 证据，不闭合该门**（日志 §11 已列命令与判据） |
| SA8 implementation 段冲突复查（R8''/RA3'/RA6'：零 diff 核对、导出恰增、S2 有界事实、observer 隔离单点、反空跑与 M1–M7 实跑登记、重命名纯机械） | SA8（触发条件三合一已在实现 diff 后成立） |
| 真 worker / 异步序回传形态、跨线程 pending 义务重入 | 后续票（U2/RA5'；本票只冻结同步宿主 pipe） |
| `listen:false` 插件 + `nomicoreHubSessionHost` 服务轨、peer 侧拆分、nomic-server 宿主接线、跨进程 revoke 全链路 | 后续票（设计 §1 非目标） |
| R6（`selectedCapabilities` 单 bit 反推）、R7（authorized 通道不投影 edge `.channels`）、R11（在途 revoke 时序观测边界）、R12（accept 门链保真度差异） | 已在夹具/设计登记；未来矩阵扩场景前须先扩设计 |

---

## Deviations or blockers

### 1（落实偏差，已登记，需 SA8 impl 复查裁决）：夹具「载体提交」替换设计 §7 D7 中「routing 相位非 OPEN 帧入 pending 窗口」的字面机制

- **事实**：设计 §7 D7 的 `namespaceFrame` 行规定相位 `routing` 的非 OPEN 帧入有界 pending 窗口（并自注「实践不可达：守规 peer 在 OPEN_OK 前零后续帧」）。但**冻结契约 AC3 的七文件矩阵中 `ws-replication-ac7-faults.test.ts:32-56` 故意注入该形态**：授权门闩悬挂时注入 UPDATE 并**在门闩释放之前**断言 wire 上出现 `NAMESPACE_STATE_VIOLATION`。字面实现下该帧留在窗口、ERROR 被推迟到结算之后 ⇒ 该用例红。
- **实测证据**：按设计字面实现的变体跑 shim 矩阵 → `Tests 2 failed | 51 passed`，失败项正是 `AC7 …错序：OPEN_OK 之前的 UPDATE → NAMESPACE_STATE_VIOLATION`（`artifacts/sa3-issue420-design-letter-divergence.log`）。
- **落地机制**（`test/issue420-shim-hub.ts`，夹具内装配路由）：相位 `routing` 下的**非 OPEN** ns 域帧改为**立即把该 ns 提交给 `denialSink`**（= 生产内部 splice + 真 port，与 listen 在首 OPEN 到达点建成的通道**同一生产机械**）：`denialSink.openNamespace(firstOpen)` → `denialSink.namespaceFrame(frame, sequence)`；相位置吸收态（不再创建公共句柄），入窗 OPEN 条目随提交放弃（listen：abort 时 `openWaiters` 静默丢弃）。OPEN 帧仍走上文分支 ② 的有界 pending 窗口（SA2-F1 要求原样）。
- **为何不是新架构/新协议决策**：① 承载机械仍是 nomicore 生产代码（决策 1「分布式实例化」许可），夹具零应答合成、零错误码选择、零 FSM；② 结果与 listen **逐点同构**（违例 ERROR 由通道自身状态机在同一到达点产出；后续帧由生产通道 quiet/terminal 守卫吸收；重 OPEN 落 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`）；③ 不触公共冻结签名、DENY 面、port 17 成员集、U3 裁决方向、验收语义与任何断言；④ 改动面限于 ALLOW LIST 内夹具文件。
- **影响与请求**：请求 SA8 implementation 复查把本条与设计 §7 D7 文本差异一并裁决（建议方向：把 D7 的 `namespaceFrame` 行补成「非 OPEN 帧在 routing 相位即时提交生产承载；在途 OPEN 入有界 pending 窗口」）。SA3 不改设计文件（按 skill 边界）。

### 2（登记，非阻断）：SA6 三个诊断探针因授权重命名而陈旧

`artifacts/sa6-issue420-{capability-gap,causality,sequence-discipline}-probe.mts` 仍 import `../packages/ws-replication/src/hub-session.ts` 的旧名 `createHubSessionHost`（SA6 §16 保留的诊断资产）。该重命名由 SA6 §12.6/U1 明文授权；探针**不在任何 tsconfig/vitest/脚本 include 面**（`grep artifacts/ tsconfig*.json vitest.config.ts package.json` 零命中），不构成 gate 影响；`artifacts/**` 不在本票 ALLOW LIST ⇒ SA3 未修改，登记给 SA6/Controller（重跑探针需把 import/调用名换为 `createHubSessionSink`）。**（iteration 1 追加）**：归并派工下 SA3 对 13 条证据路径做了**仅空白**的 C1 归一化（见「Iteration 1」节与 `artifacts/sa3-issue420-evidence-reconcile.log`）；三个探针 `.mts` 的 import 名仍未改，本条登记继续有效。

### 3（测试锚替换，非契约软化）：AC3 反空跑中的 `ACK_STATE_VIOLATION` 锚点

SA6 §12.3 的反空跑举例含「生产信号面在场」。实测发现 `ac5-live` 的 `ACK_STATE_VIOLATION` 用例是 **peer 侧** fatal（`injectHub` 注入未知 `ackedSequence`），不经过本桥 `onSignal`；故末位 describe 改为锚 `settled`（≥1，经 `onSignal` 到达 edge）＋ 全 run 零 `INTERNAL_ERROR`（重复 `open()`/续体异常的红臂签名）＋ `carrierCommitted`/`reopenForwarded`/`pendingFlushed` 计数阈值。`connection-fatal` 通路的正控由回合测试 A12 红臂承担（断言绿/回合红）。矩阵断言体、验收语义与阈值强度未降低（V11 M4 反空跑负控仍红）。

### 4（无阻断项）：设计/ALLOW/契约均可实施，无 reject 事由

除上条 1 的机制替换外，设计 ALLOW/DENY、SA2 三项 required change、SA8 RA1'–RA6' 的落地面无阻塞；未发现需修改设计、扩大范围或改变验收语义的事项。

---

## Suggested commit message

```
feat(ws-replication): 导出 SessionHost 公共 byte-seam 工厂 + 内存管道完整回合（issue #420）

- 新增 src/hub-session-host.ts：createHubSessionHost 工厂 + 7 冻结类型 + adapterPort
  （open() 描述子纯 JSON / handleFrame 字节入帧不重检序 / onFrame 同步回传被分配 wire 序 /
  onSignal{settled,connection-fatal} / terminateUnauthorized / close 幂等；决策 5 dormant 面）
- src/index.ts 追加 1 值 + 7 类型导出（append-only，11→12）；内部 splice 机械重命名
  createHubSessionHost→createHubSessionSink（hub-session/hub-connection/hub-split 头注）
- 新增测试：AC1 test-d 类型冻结（含 6 项 @ts-expect-error 负控）、AC2+AC4+AC5 内存管道
  完整回合（A1–A12 含红臂、C4a–C4d、C5a–C5c）、AC3 机制 (a) shim 矩阵重跑（7 文件断言
  逐字不变 + 反空跑 + 零 unhandled rejection）；夹具 test/issue420-shim-hub.ts（三分支路由 +
  有界 pending + 按准入结局路由 + E10 兜底）
- #418 两处授权编辑（冻结导出表 +1 行；结构测试机械跟随）
- RA1 文本：ADR 0032 澄清附录（信号词汇公共化 + 决策 3 三载体 + 决策 5 降级登记）与
  CONTEXT.md「SessionHost」词条更新
- 验证：契约三路径 63 tests 绿、包全量 80 files/651 tests 绿、根 typecheck 绿、
  根 pnpm test 443 files/5381 tests 绿；hub-namespace.ts/hub-edge.ts 零 diff；M1–M7 变异实跑登记
```

**iteration 0 实际承载**：Controller 已用英文提交 `a315e70`（`feat(ws-replication): expose session host factory`，父 `7039f6d`）；本块保留为原始建议文案。

**iteration 1 建议提交信息（证据归并，Controller 定稿）**：

```text
test(ws-replication): canonicalize issue 420 evidence contract

- C1-normalize the uncommitted issue #420 evidence set (12 artifact logs + Host brief):
  strip trailing whitespace before LF and the single trailing blank line at EOF
  (whitespace only; non-whitespace bytes and content lines byte-identical)
- add the round approvals (sa9_standards, sa10_spec), the Host brief and the current
  SA8 implementation conflict report to the delivery archive (closes SA9 section 10 M3)
- record artifacts/sa3-issue420-evidence-reconcile.log; zero implementation/test/doc byte change
```

**iteration 1 精确 staging 清单（18 条，worktree-relative）**：`wiki/raw/task_issue-420_implementation_conflict_report.md`、`artifacts/sa3-issue420-{design-letter-divergence,mutation-M1-a12-red-arm,mutation-M2-drop-open,mutation-M3-restamp-sequence,mutation-M4-disable-shim,mutation-M5-session-resequence-check,mutation-M7-reopen-reentry,mutation-M7b-drop-inflight-open,red-contract}.log`、`artifacts/sa6-issue420-runner-trigger-red.log`、`artifacts/sa7-issue420-{focused-420-tests,listen-matrix-baseline}.log`、`wiki/raw/task_issue-420.md`、`wiki/raw/task_issue-420_{sa9_standards,sa10_spec}.md`、`artifacts/sa3-issue420-evidence-reconcile.log`、`wiki/raw/task_issue-420_sa3_impl.md`（逐行 `git add -A --` 形式见证据日志 §7.4）。

**iteration 2 建议提交信息（证据归档，Controller 定稿）**：

```text
test(ws-replication): canonicalize issue 420 evidence contract

- archive the uncommitted issue #420 evidence set (13 artifact logs + Host brief +
  sa9/sa10 approvals + the current SA8/SA4 reports + the iteration-1 reconciliation log
  and the finalize/rebase evidence log); closes SA9 section 10 M3
- record the finalization-repair reconciliation and the authoritative-base rebase
  readiness (pure-union resolution for packages/ws-replication/src/index.ts)
- zero implementation/test/doc byte change
```

**iteration 2 精确 staging 清单（20 条，worktree-relative = `git status` 全集）**：

```text
git add -A -- \
  wiki/raw/task_issue-420_implementation_conflict_report.md \
  wiki/raw/task_issue-420_sa3_impl.md \
  wiki/raw/task_issue-420_sa4_review.md \
  artifacts/sa3-issue420-design-letter-divergence.log \
  artifacts/sa3-issue420-evidence-reconcile.log \
  artifacts/sa3-issue420-finalize-rebase-evidence.log \
  artifacts/sa3-issue420-mutation-M1-a12-red-arm.log \
  artifacts/sa3-issue420-mutation-M2-drop-open.log \
  artifacts/sa3-issue420-mutation-M3-restamp-sequence.log \
  artifacts/sa3-issue420-mutation-M4-disable-shim.log \
  artifacts/sa3-issue420-mutation-M5-session-resequence-check.log \
  artifacts/sa3-issue420-mutation-M7-reopen-reentry.log \
  artifacts/sa3-issue420-mutation-M7b-drop-inflight-open.log \
  artifacts/sa3-issue420-red-contract.log \
  artifacts/sa6-issue420-runner-trigger-red.log \
  artifacts/sa7-issue420-focused-420-tests.log \
  artifacts/sa7-issue420-listen-matrix-baseline.log \
  wiki/raw/task_issue-420.md \
  wiki/raw/task_issue-420_sa10_spec.md \
  wiki/raw/task_issue-420_sa9_standards.md
# commit 前/后各跑一次 git diff --cached --check（须 RC=0）；post-commit 逐路径哈希期望见
# artifacts/sa3-issue420-finalize-rebase-evidence.log §2 与 §10。
```

**iteration 2 rebase 配方（供 Controller 执行；SA3 不执行）**：`a315e7077…` rebase 到 `1f5809b001…`；唯一冲突 `packages/ws-replication/src/index.ts`，写入并集 blob `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`，其余文件零手工改写；20 条证据路径与父增量 31 路径零交集 ⇒ 证据归档 commit 可在 rebase 前或后重放且零冲突。rebase 落地后按日志 §11 重取五门（RA2），期间不得援引本报告与日志中的 pre-rebase / dry-run 结果作为新树证据。
