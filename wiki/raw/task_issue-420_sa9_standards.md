# SA9 Standards Review — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（**rebase 后终态·归档证据轮**）

- Dispatch：`sa-cd1e2a31-058f-4874-b91f-0d270b64baee`（mabf-sa9 / standards-review / **iteration 4**）
- 审查对象：worktree `/home/wangjian/nomicore-fix-issue-420`（branch `mabf/issue-420`）的 **post-rebase 最终交付**——HEAD `5ed3dc0d0069f4b359794a9d7527315b441663e6`（`chore: archive issue 420 CI repair evidence`），**rebase 到 Parent PR #416 当前 head `4ad13a35f782411d3c48096c31afa724f6eae067` 之上**（派工断言，本轮 git 亲验成立，§2.1）
- Owner requirements：派工明文 none；本轮 `gh issue view 420 --json comments,state` **亲取** = `{"comments":[],"state":"CLOSED"}` ⇒ 无 owner 追加要求
- **Verdict：`approve`**（0 BLOCKER / 0 MAJOR；前轮 §8-N3'「CI 修复轮证据未归档」由本 commit **闭合销账**；存续非阻断 MINOR 见 §7；`requiresConflictRecheck: false`，理由见 §8）
- 审查范围声明：本报告只判断仓库与工程标准（AGENTS/ADR/模块责任/既有架构惯例/单一事实源/生命周期对称性/文件范围/测试质量标准）；Issue 需求完整实现属 SA10。本报告原位覆盖前轮（iteration 3，CI 修复终审·终态确认轮）报告；前轮判定所依附的交付/修复字节在本轮 **逐位相同**（§2.2 树同一性亲验），实质判定全部存续。

---

## 1. Reviewed inputs（本轮读取/核验）

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-420.md`（简报；AC1–AC5；Comments 空） | 历轮已审，本轮复核 |
| `wiki/raw/task_issue-420_design.md`（SA1：§7 D9 重命名、§11 ALLOW/DENY LIST、§12 验收映射） | 历轮已全文审；本轮按需复核 |
| `wiki/raw/task_issue-420_sa3_impl.md`（committed @`5ed3dc0`：iteration 4 CI 修复 + V29–V35 + Deviation #6） | 历轮已全文审；committed 态要点复核 |
| `wiki/raw/task_issue-420_sa4_review.md`（committed @`5ed3dc0`：Part C approve + **Part D approve**，O17–O18） | 历轮已全文审；committed 态 verdict 复核 |
| `wiki/raw/task_issue-420_sa6_contract.md`（committed @`5ed3dc0`：CI 修复轮契约，verdict `approve`，K1–K8 门集） | verdict 与关键节复核 |
| `wiki/raw/task_issue-420_ci_repair_conflict_report.md`（committed @`5ed3dc0`：SA8 CI 修复轮 —— **clear**，8 no-conflict + 3 implements-existing-decision / 0 hard-conflict / 0 override；RA1 归档 / RA2 账本 / RA3 触发条件；`requiresConflictRecheck: false`） | 全文读取 |
| `wiki/raw/task_issue-420_sa10_spec.md`（committed @`5ed3dc0`：approve，recheck false；F10 登记未提交面 = SA8 RA1 归档门） | verdict 与 F10 复核 |
| 规范面 | 根 `AGENTS.md`、`packages/ws-replication/AGENTS.md`、`docs/AGENTS.md`、ADR 0032——历轮已逐条对照；本轮谱系对其**零字节**亲验（§2.2） |
| 本轮独立 git/gh/源码核验 | 见 §2 全部命令级事实（谱系、census、树同一性、冻结锚、whitespace 门、`gh` 亲取、远端 ref） |

SA9 未修改任何生产代码、设计或测试；未运行测试/服务；唯一产物为本文件（原位覆盖前轮报告，按历轮同例由 Controller 后续归档）。

## 2. Rebase 后终态独立核验（全部亲取，不采信自述）

### 2.1 谱系与 rebase 断言（派工「rebased onto Parent PR #416 head `4ad13a35`」亲验）

- `git merge-base --is-ancestor 4ad13a35 HEAD` = **真**；`git rev-list --count 4ad13a35..HEAD` = **恰 1**（`5ed3dc0`）。
- 远端亲取：`git ls-remote origin` → `refs/heads/spec/415-replication-transport-decoupling` = **`4ad13a35f782411d3c48096c31afa724f6eae067`**（本地 `origin/spec/415-…` 同值）——Parent PR #416 分支当前 head 与派工给定 sha **逐位一致**，交付确在其上。
- `git log 25c51cd..HEAD` 全序 = `4e5ff0a`（交付）→ `eb5ec09`/`aff4bc0`/`3f470fb`（归档）→ `2c87b3b`（CI 修复）→ `5a4049d`（终审归档）→ `4ad13a3`（PR #429 merge）→ `5ed3dc0`（本轮归档）——**无夹带、无外来 commit**；父 head 自 `25c51cd` 至 `4ad13a35` 的前移内容 = 恰本交付自身的合并（merge parents `25c51cd` + `5a4049d`，归档 `12-merge-state.log` 在册），SA8 RA3③「父 head 再前移未复认即解」的复认由 §2.2 树同一性以最强形式兑现。
- 当前 branch `mabf/issue-420` 对 `origin/spec/415-…` **ahead 1**；`5ed3dc0` 不在任何远端 ref（`git branch -r --contains` 空）——post-merge 的 Controller 本地归档簿记，与历轮「归档 commit 随定稿推送」先例同例，非交付阻断面（§7-N3''）。

### 2.2 代码面树同一性（全部实质判定的承载链）

- merge 树同一性（前轮已证，本轮复算）：`4ad13a35^{tree}` = `187cc70f141bdcef0d173229a9fc29b0611fe4c4` = CI 已验证 head `5a4049d` 的 tree。
- 本轮增量：`git diff --name-only 4ad13a35 HEAD -- packages docs apps domains tests scripts .github CONTEXT.md AGENTS.md package.json pnpm-lock.yaml pnpm-workspace.yaml vitest.config.ts tsconfig.base.json tsconfig.typecheck.json` = **空**（RC=0）。
- ⇒ **当前 HEAD 的全部生产/测试/docs/CONTEXT/CI 配置字节与 16/16 绿已验证态逐位相同**；前轮（iteration 3）对 CI 修复交付的全部实质标准判定（正确性、冻结面保持、测试质量、文件范围）经字节同一性直接覆盖本轮终态，无需重裁。
- `git diff --check 4ad13a35 HEAD` RC=0（whitespace 门）。

### 2.3 归档 commit `5ed3dc0` 文件集 census（派工「only archival CI-repair evidence」亲验）

`git diff --name-only 4ad13a35 HEAD | sort` = **恰 42 路径，全部落在 `artifacts/` 或 `wiki/raw/`**：

- `artifacts/sa6-issue420-ci-repair/` × **36**：32 日志（00-green-gates … 12-merge-state）+ 探针 `probe-stale-internal-import.mts` + 3 harness（`run-{green-gates,red-prefix,mutation-sensitivity}.sh`）——与前轮 §7.1 登记的未提交面（36 文件）**逐一对应**。
- `wiki/raw/` × **6**：`task_issue-420_ci_repair_conflict_report.md`（新增 107 行 = SA8 CI 修复轮报告）+ `sa6_contract.md`（CI 修复轮契约原位改写）+ `sa4_review.md`（+137 = Part D）+ `sa3_impl.md`（+46 = iteration 4 修复段）+ `sa10_spec.md`（终态化）+ `sa9_standards.md`（前轮 iteration 3 报告归档）。
- 生产/测试/docs/CONTEXT/CI 配置/锁文件 **零路径命中**（§2.2 空 diff 即证）。「includes only archival CI-repair evidence」**属实**。
- commit 元数据：message `chore: archive issue 420 CI repair evidence`——与 `eb5ec09`/`aff4bc0`/`3f470fb`/`5a4049d` 归档先例同款（type/scope 惯例）。

### 2.4 归档内容与前轮已裁字节的一致性

- SA8 CI 修复轮报告（committed）：verdict **clear**，8 no-conflict + 3 implements-existing-decision / 0 evolution-required / 0 hard-conflict / 0 override；`requiresConflictRecheck: false`；§8-RA1 = 「Controller 以追加归档 commit 落账 SA6 契约 + artifacts + 本报告」——**本 commit 即 RA1 的逐字兑现**（42 路径与其枚举面一一对应）。
- SA4 Part D（committed）：verdict **approve**（0 BLOCKER / 0 MAJOR）；其 O17「SA6 CI 修复轮产物 + SA8 CI 修复报告未提交，Controller 按先例补 archive commit」——**由本 commit 闭合**。
- SA10 终审（committed）：approve、recheck false；其 F10 登记同一未提交面「归档属 SA8 RA1（Controller 持有）」——**同闭合**。
- SA6 CI 修复轮契约（committed）：verdict **approve**，K1–K8 门集 / 单变量红实验 / 变异敏感负控在册。
- 归档证据内含远端事实快照：`10-rest-comments-snapshot.log`（issue #420 comments `[]`、state closed；PR #429 comments/reviews 全 `[]`，2026-09-21T23:12:04Z）与 `12-merge-state.log`（merge `4ad13a35`、16 作业全 pass 逐条列出）——与前轮 `gh` 亲取事实一致。

### 2.5 冻结锚与执行态（本轮亲验/亲取）

- `HEAD:packages/ws-replication/src/index.ts` blob = **`08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`**——与历轮冻结锚逐位相同（公共面 13 值导出、双工厂同列、append-only 保持）。
- #418 结构锚 `…structure.test.ts:618` `toEqual(['createHubSessionSink'])` 在场（:614–619 亲读）；`FROZEN_PRODUCTION_EXPORTS`（contract 测试 :144 起，含 `'createHubSessionHost'` 字母序插入位）在场。
- 执行态存续（前轮 `gh` 亲取 + 归档快照双证）：修复后 CI run `35665953800`（head `5a4049d`）**16/16 success**；merge-commit run `35666189272`（head `4ad13a35`）success；PR #429 **MERGED**；issue #420 **CLOSED**。本轮增量零代码字节 ⇒ 该绿态完全覆盖当前终态。
- Owner 评论本轮**亲取**：`gh issue view 420 --json comments,state` = `{"comments":[],"state":"CLOSED"}` ⇒ 派工「none（REST `[]`）」属实。
- 工作树：`git status --porcelain` 干净（仅分支行）——历轮全部未提交面已由 `5ed3dc0` 收编；`packages/` 零 diff 存续。

## 3. 标准符合性总账（rebase 后终态）

| 标准轴 | 结论 | 依据 |
| --- | --- | --- |
| 根 AGENTS + `packages/ws-replication/AGENTS.md` | ✅ 符合（零生产/零测试代码字节；公共面 blob 逐位过继；module guidance 全程遵守） | §2.2/§2.5 |
| `docs/AGENTS.md`（显式修订/diff-check；wiki/raw = 证据非规范契约） | ✅ 符合（docs/CONTEXT 零字节；`git diff --check` RC=0；归档面全在 wiki/raw + artifacts 证据面） | §2.2/§2.3 |
| ADR 0032（决策 1–5 + 双注册附录）与关联协议冻结面 | ✅ 符合（零决策文本/协议字节；内部缝 × 公共缝双轨边界保持——本轮增量不触任何决策面） | §2.2/§2.5 |
| 模块责任 | ✅ 符合（纯归档增量；无责任边界变化） | §2.3 |
| 既有架构惯例（commit 风格/归档先例/证据簿记节奏） | ✅ 符合（`chore: archive …` 与 4 个归档先例同款；「评审产物随定稿归档」惯例延续） | §2.3 |
| 单一事实源 | ✅ 符合（零代码增量 ⇒ 前轮结论原样存续：内部 splice 单名单点、公共工厂单点、无双名同物） | §2.2 |
| 生命周期对称性 | ✅ 不适用面零触碰（零生产/零资源生命周期字节） | §2.2 |
| 文件范围（ALLOW/DENY/授权编辑/范围扩展纪律） | ✅ 符合（本轮增量全在 wiki/raw + artifacts 证据面；ALLOW/DENY 面零触碰；前轮范围扩展已经 SA8 两轮 `implements-existing-decision` 终认收编） | §2.2/§2.3 |
| 测试质量标准 | ✅ 符合（零测试字节变化 ⇒ 前轮「断言/用例体/选择器零变化、零 skip、计数守恒、红绿链 sha256 绑定、变异负控咬合」全部存续；归档日志为该证据链的载体） | §2.2/§2.4 |
| 执行态与 Owner 面 | ✅ 闭合（CI 16/16 绿 + merge 树同一 + PR MERGED + issue CLOSED 存续；comments `[]` 本轮亲取复证） | §2.5 |

## 4. 本轮闭合销账（前轮登记项 → 本 commit 兑现）

| 来源登记项 | 内容 | 本轮状态 |
| --- | --- | --- |
| 前轮 SA9 §8-N3' | SA6 CI 修复轮产物（契约改写 + `artifacts/sa6-issue420-ci-repair/**`）+ SA8 CI 修复报告（新文件）+ SA4 Part D + 前轮 SA9 报告 = 未提交/未跟踪态，Controller 归档簿记门 | **CLOSED**——`5ed3dc0` 恰收编该全集（§2.3 census 一一对应） |
| SA8 CI 修复轮 RA1 | 证据归档（Controller 执行，阻断 CI 修复账本 finalize） | **CLOSED**——本 commit 即其逐字兑现 |
| SA4-O17 | 同一未提交面的归档提请 | **CLOSED**（同上） |
| SA10-F10 | 同一未提交面的登记（「归档属 SA8 RA1」） | **CLOSED**（同上） |

## 5. SA8 RA3 触发条件核对（存续武装，本轮逐项核对未触发）

| RA3 条件 | 本轮事实 | 状态 |
| --- | --- | --- |
| ① 新 head/合并谱系上出现不能归因于两文件 stale 导入的失败 | merge-commit run `35666189272` 绿；本轮增量零代码字节 | 未触发 |
| ② 任何 diff 超出 26 行机械集 census | 本轮增量（42 路径）**零代码行**，不触该 census 面 | 未触发 |
| ③ 父 head 再前移未复认即解 | 父 head `25c51cd`→`4ad13a35` 的前移内容 = 恰本交付自身合并（无外来 commit，§2.1）；本报告 §2.2 以树同一性完成复认 | 未触发（已复认） |
| ④ 「恢复生产别名」/「#423 测试改道公共工厂」提案 | 无（冻结锚在位，§2.5） | 未触发 |

## 6. AGENTS / ADR 规约核验（本轮增量面）

- **根 AGENTS.md**：Git worktrees 条款——零新 worktree；Instance replication 条款——协议文本零字节。✅
- **`packages/ws-replication/AGENTS.md`**：生产 API 只经 `src/index.ts`——blob 逐位过继；protocol ordering/FSM 不变量——`hub-namespace.ts`/`hub-edge.ts` 对父零 diff 存续；admission bounded——不适用面零触碰；Verification——前轮超条款执行的证据链（V29–V35 + head 五门 + 单变量红实验 + 变异负控 + 远端 16/16）全部归档在册。✅
- **ADR 0032**：决策 1（FSM 单份）/决策 2/3（缝形态与授权传递）/后果节 append-only（:66）/#423 注记（:68）——本轮增量对其零触碰；双轨边界保持。✅
- **`docs/AGENTS.md`**：wiki/raw 报告与 artifacts 证据非规范契约——归档面性质相符；`git diff --check` RC=0。✅

## 7. 非阻断 MINOR 观察（不阻断 approve）

| # | 观察 | 现状/处置 | 来源 |
| --- | --- | --- | --- |
| N1 | 两 #423 修复文件头注重命名授权出处括注「SA6 §12.6 授权编辑 2」——严格说编辑 2 授权对象是对 #418 structure 测试的跟随；重命名授权本体 = 设计 §7 D9 / SA6 U1 | 散文级精度问题，非规范违例；SA8 两轮已以正确口径终认；SA6 §12.6 已分列收口 | SA4-O14（存续） |
| N2 | `src/hub-session.ts:49` 构造函数花括号与首语句同行（合法 TS，非仓内格式惯例）——既有态，非本交付面 | 后续触该文件的票顺手归一 | SA4-O15（存续） |
| N3' | ~~SA6/SA8/SA4 修复轮产物未提交~~ | **本轮闭合销账**（§4） | 前轮 N3' → **CLOSED** |
| N3'' | 归档 commit `5ed3dc0` 为本地态（branch ahead 1，不在任何远端 ref）；本报告（iteration 4）落盘后同为未提交工作树态 | Controller 推送/归档簿记门——post-merge 证据簿记，内容与规范文本无涉；**不阻断交付**（交付已合并关闭、树同一性已证） | 本轮核验（历轮同例的循环登记项） |
| N4 | 首次类型导入中间态（TS2459 被拒）未归档为证据——SA3 已如实披露 | 终态正确性由 tsc 绿 + 权威形态比对 + 机制探针闭合，无需补证 | SA4-O16（存续） |
| N5 | `artifacts/sa6-issue420-*-probe.mts` 旧探针仍 import 重命名前旧名 | 不在任何编译/运行 include 面（前轮 grep 0 复证）；SA8 RA3 维持非门禁登记；重跑探针时改名（新探针已在册） | 前轮 M4（存续） |
| N6 | 夹具头注 `MAX_EARLY_FRAMES` 先例指针仍指 `hub-connection.ts`（符号本体在 `hub-upgrade-admission.ts:26`，值 16 未动） | SA8 RA3 明文非门禁；夹具字节 = 授权交付字节 | 前轮 M8（存续） |
| N7 | `2c87b3b` 实携 12 路径，超 SA3 10 条 staging 清单 2 条（SA4/SA8 两报告）——Controller 定稿补入的固定产物归档，git 历史透明，纯文档 | 无需处置（登记口径） | SA4-O18（存续） |

（更早轮次 M1/M2/M5/M6/M7、M9/M10 的对象为交付字节 `4e5ff0a` 或历轮证据形态，本轮谱系对其零 diff，原登记状态存续，不再重复列示。）

## 8. 结论

**`approve`**。Issue #420 的 **post-rebase 最终交付**（HEAD `5ed3dc0`，rebased onto Parent PR #416 head `4ad13a35`）在全部标准轴上符合仓库与工程标准：

1. **Rebase 断言亲验属实**：`4ad13a35` 是 HEAD 直系祖先、其间恰 1 commit；远端 `spec/415-…` head 与派工 sha 逐位一致；父 head 前移内容 = 恰本交付自身合并（无外来 commit），SA8 RA3③ 复认由树同一性兑现。
2. **「Only archival CI-repair evidence」亲验属实**：增量恰 42 路径，全部 `artifacts/` + `wiki/raw/`；生产/测试/docs/CONTEXT/CI 配置/锁文件零路径；`git diff --check` RC=0。
3. **实质判定经字节同一性存续**：当前 HEAD 代码面与 16/16 绿已验证态（`5a4049d` tree `187cc70f…` = merge `4ad13a35` tree）逐位相同；冻结锚（公共面 blob `08fa49a1…`、structure :618 exact-equality、`FROZEN_PRODUCTION_EXPORTS`）本轮亲验在位；前轮 approve 的全部依据直接覆盖本轮终态。
4. **流程账闭合**：前轮唯一存续簿记项 N3'（= SA8 RA1 = SA4-O17 = SA10-F10）由本 commit 闭合；SA8 RA3 四条触发条件逐项核对未触发；Owner comments 本轮 `gh` 亲取 = `[]`（none 成立）、issue CLOSED。
5. **残余**：仅 §7-N3''（本归档 commit 与本报告的推送/归档簿记，Controller 持有）——post-merge 证据簿记，非交付阻断项。

**requiresConflictRecheck: false**——依据：本轮增量为零代码字节的证据/报告归档，不创设、不修改任何决策面（公共 API、wire、schema、持久化、状态机、生命周期、失败语义、override 全部零触碰）；被审终态的代码面与 SA8 CI 修复轮已裁决闭合（clear / recheck false）的字节逐位相同；rebase 引入的父 head 前移已经本轮复认（§5 行③）。若 SA8 RA3（= RA4'' 存续武装）任一条件未来触发（新根因 / diff 超集 / 父 head 再前移未复认 / 决策面提案），按该触发条件进入新一轮 SA8，不由本报告预裁。
