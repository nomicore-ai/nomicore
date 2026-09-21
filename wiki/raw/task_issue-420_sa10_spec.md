# SA10 Spec 审查报告 — Issue #420（SessionHost 公共工厂 + 内存管道完整协议回合，spec #415 T3）

> SA10（独立 Spec 审查者）spec-review 轮产物。dispatch `sa-56f2e258-7a97-4568-93c8-88556ec81f78`，
> role `mabf-sa10`，phase spec-review，iteration 2。
> **被审对象**：**最终已提交 CI 修复** —— commit `2c87b3b7a69bbc1a727ed6497e7b260181ce6283`
> （`test(ws-replication): update internal splice imports`，父 = `3f470fbcb6f10b0b26dced0fc05fceaec353494a`，
> 本轮 `git rev-parse HEAD` + `git cat-file commit` 亲证父链；branch `mabf/issue-420`，工作树
> `git status --porcelain -uall` = 0 条亲证）。谱系：`2c87b3b`（CI 修复）→ `3f470fb`（归档）→
> `aff4bc0`（归档）→ `eb5ec09`（归档）→ `4e5ff0a`（交付，父 = 授权权威父基
> `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df` = Parent PR #416 stable head / PR #428 merge）。
> **修复缘起**：PR #429（head `3f470fb`）CI run `35663498235` 5 fail / 11 pass（`typecheck` +
> `test (20,1)/(20,6)/(24,1)/(24,6)`），根因 = 父增量 #423 的两个测试文件按 D9 重命名前符号名
> 深路径构造内部 splice；修复 = 该两文件的机械符号名跟随（零生产代码）。
> **Issue 评论输入**：派工明示 Owner comment requirements = none；REST comment snapshot = `[]`
> ⇒ 无逐条 Owner 评论映射面。
> **前轮账（不堆叠为当前结论）**：SA10 iteration 1（dispatch `sa-102d5af8…`）对第二段 rebase 后
> 交付谱系（`4e5ff0a`+两归档，HEAD `aff4bc0`）判 approve + 窄域 recheck；本轮对象 = 该已批准
> 谱系之上的**最终 CI 修复 commit**。
> **输入产物（全部亲读）**：Issue #420 正文（AC1–AC5）、`task_issue-420_sa6_contract.md`
> （§12.1/§12.6/U1）、`task_issue-420_design.md`（§7 D9、§11 ALLOW/DENY）、
> `task_issue-420_sa3_impl.md`（iteration 4：CI 修复轮 V29–V35 + 冻结锚）、
> `task_issue-420_sa4_review.md`（Part C：CI 修复轮 approve，O14–O16）、
> `task_issue-420_implementation_conflict_report.md`（SA8 CI 修复轮 **clear**，
> 6 no-conflict + 4 implements-existing-decision，`requiresConflictRecheck: false`）、
> 本轮 commit 内 7 条新证据日志（ci-fail-evidence / ci-typecheck-fail / local-typecheck-pre-fix /
> local-prefix-wsrep-excerpt / ci-fix-{typecheck,tests,contract-anchors}）。
> **独立核验方式（本轮全部亲读/亲跑只读命令，非转述）**：commit 父链与全谱系；修复 diff 逐行
> census；13 条 ALLOW 路径交付 commit ↔ HEAD blob 逐条比对；两被修文件 sha256 对 SA3/SA8
> 冻结锚逐位比对；AC1/AC4/AC5 结构门在 HEAD 树重跑；stale 符号全仓 grep；`git diff --check`；
> 远端分支与 CI 状态三通道（`gh run list --commit`、`gh pr view 429`、`git ls-remote`）亲验。
> **边界**：零代码/设计/测试/文档改动；未运行测试、未启动服务；零 commit/push/PR/finalize；
> 唯一写入 = 本文件（原位替换前轮回产物，前轮文本已随 `3f470fb` 入档于 git 历史）。

---

## Verdict

**approve**（`requiresConflictRecheck: false` —— 承接 SA8 CI 修复轮窄域闭合：本轮被审修复的
全部决策面已被 SA8 对实际 diff 逐项核对闭合；本轮未发现新的决策冲突面。残余事项全部为执行
形式门/在册登记项，见 §7）。

**核心理由**：

1. **修复面精确命中 CI 红灯根因，零超额（§0/§4）**：业务 diff = 恰 2 个 #423 测试文件
   （+18/−8，每文件 +5 行头注 + 2 导入行 + 1 类型标注 + 1 工厂调用）；断言、用例体、
   `describe/it` 名、选择器、阈值、EM 金标常量**零字节变化**（diff census 亲证）；
   `packages/ws-replication/src/**`、`docs/**`、`CONTEXT.md`、协议文本零 diff。
2. **符号映射正确且为唯一自洽最小路线（§4）**：`hub-session.ts` 现运行时导出面恰为
   `createHubSessionSink`（#418 冻结锚 `…structure.test.ts:618` exact-equality 在场亲证）；
   `HubSessionSink` 接口在 `hub-split.ts:126`（亲读）；修复的导入切分与仓内权威消费方
   （`src/hub-connection.ts:18`、#418 structure `:39`）逐形相同；生产侧替代（恢复别名）被
   #418 冻结锚决定性封死——SA8 裁决 implements-existing-decision 成立。
3. **五条 AC 在 HEAD 树逐项复核仍满足（§1–§5）**：13 条 ALLOW 路径在交付 commit `4e5ff0a`
   与 HEAD 之间 **13/13 blob 逐字节相同**（本轮逐条 `git rev-parse` 比对）⇒ 修复对任何验收
   载体零漂移；AC1 导出面/冻结表、AC4/AC5 结构门本轮在 HEAD 树重跑结果不变
   （13 名 / 0 命中 / 0 计数）；AC2 回合锚（A1–A12 + C4a–d + C5a–c）与 AC3 七矩阵文件
   不在修复 diff 内。
4. **验证证据绑定被审字节（§6）**：两被修文件 sha256 = `778d2461…`/`16056587…`，与 SA3
   §4.4、SA8 §1 冻结锚**逐位相同**（本轮亲算）⇒ 已归档 V29–V35 绿证据（两文件 26/26、
   包全量 90 文件/785 用例、`--typecheck.only` 49/270、CI 分片 1/6=63/820 与 6/6=67/831
   逐字重跑、契约锚 5 文件/89 用例 + contract-gates 四步）跑的就是本 commit 的字节；
   `git diff --check 3f470fb 2c87b3b` RC=0。
5. **无 scope creep 失控（§6）**：两 #423 文件不在原 13 条 ALLOW（基线树快照口径），属
   SA3 Deviation #6 显式登记的范围扩展，SA8 CI 修复轮已裁决收编（许可性成立、无需扩枚举、
   无需 override）；修复轮全量改动面 = 2 测试文件 + 7 证据日志 + 3 报告，无其它残留。

---

## 0. 谱系与修复面独立核验

| # | 核验点 | 本轮独立取证（命令与观察） | 判定 |
| --- | --- | --- | --- |
| F1 | 被审 commit 与父链 | HEAD = `2c87b3b…`；父 = `3f470fb`；链 `3f470fb→aff4bc0→eb5ec09→4e5ff0a→25c51cd`（授权父基，派工值逐位相同）；工作树零脏 | ✅ |
| F2 | 业务改动面 | `git diff 3f470fb 2c87b3b -- packages/ docs/ CONTEXT.md apps domains tests scripts *.json` = 恰 2 个 #423 测试文件；commit 全量 = 2 测试文件 + 7 `artifacts/` 日志 + 3 `wiki/` 报告 | ✅ |
| F3 | diff census | 每文件：头注 +5（登记 D9 机械跟随）+ 导入 2 行（`createHubSessionSink` 自 `hub-session.js`；`HubSessionEdgePort, HubSessionSink` 类型自 `hub-split.js`）+ 类型标注 1 行 + 工厂调用 1 行；**无其它行组** | ✅ |
| F4 | 被修字节 = 验证字节 | sha256 两文件 = `778d2461f0421027c25c17bd817327dcccf14b3a53b4f92efa2e728852e0183c` / `160565873bf980c0ee1042d699fc9da890ee74743222139097e095a60395681e`，与 SA3 §4.4 / SA8 §1 登记值逐位相同 | ✅ |
| F5 | 交付面零漂移 | 13 条 ALLOW 路径 `4e5ff0a` blob == HEAD blob，13/13 IDENTICAL（含 `src/index.ts` 并集 blob、双 test-d、#418 双冻结锚、ADR 0032、CONTEXT.md） | ✅ |
| F6 | stale 面清零 | 全仓 grep（`packages/ws-replication/{src,test}`）：旧内部名残留 = 仅两文件头注散文 + #418 契约表公共条目 `'createHubSessionHost'`（合法）+ `src/index.ts:91` 公共类型 `HubSessionHost`（自 `hub-session-host.js`，合法）；第三 #423 文件（update-offset-guard）`hub-session` 0 命中 | ✅ |
| F7 | 卫生门 | `git diff --check 3f470fb 2c87b3b` RC=0；`git status --porcelain -uall` = 0 条 | ✅ |
| F8 | 远端/CI 现状 | `git ls-remote origin mabf/issue-420` = `3f470fb`（PR #429 head，CI 5 红）；`gh run list --commit 2c87b3b` 空 ⇒ **修复 commit 已提交未 push，新 head CI 未跑**（SA8 RA1''/RA2'' 执行形式门，Controller 持有，§7-1） | 登记 |

## 1. AC1 — 公共入口导出 + test-d 锁定：**满足（HEAD 树本轮重跑）**

| 核验点 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| 公共入口导出 | `src/index.ts:6` `createHubSessionHost` 自 `./hub-session-host.js`；13 值导出（基线 11 + `createHubSessionHost` + `createHubReplicationEdge`）；`index.ts` blob 与已批准交付逐字节相同（F5） | ✅ |
| 冻结签名逐字 | `src/hub-session-host.ts` 与已批准交付逐字节相同（F5）⇒ SA6 §12.1 冻结声明保持 | ✅ |
| test-d 锁定 | `…issue420-session-host-api.test-d.ts` 不在修复 diff（F2）且与交付逐字节相同（F5） | ✅ |
| 运行时导出面恰增 | #418 契约 `FROZEN_PRODUCTION_EXPORTS`（:144-158）= 13 名含 `createHubSessionHost`，本轮亲读在场；修复未触碰 | ✅ |

## 2. AC2 — 内存管道完整协议回合：**满足（修复零触碰）**

回合测试（A1–A12 + C4a–d + C5a–c 锚本轮 grep 在场，:118/:324/:361/:387/:403/:445/:459）与
夹具 `issue420-shim-hub.ts` 均不在修复 diff（F2）且与已批准交付逐字节相同（F5）；内存双端
装配、零 socket 零 worker 形态不变。动态证据链（SA3 V3/V17、SA7 聚焦 63/63 + 探针）绑定
已批准交付内容，修复不使其失效。

## 3. AC3 — 现有矩阵在 shim 上重跑绿灯：**满足（修复零触碰）**

7 矩阵文件与 shim-matrix 机制文件均不在修复 diff 及 `25c51cd..HEAD` 业务面之外（F2/本轮
`git diff --name-only 25c51cd HEAD` 亲证 = 13 ALLOW + 2 修复文件）；`vitest.config.ts` 零
diff；通道 `hub-namespace.ts`/`hub-edge.ts` 零交付侧改动。修复后轮证：V32 包全量 90 文件
绿（含 shim 矩阵与 listen 矩阵），跑于被审字节之上（F4）。

## 4. AC4/AC5 — 缝纯度与零入站序重检：**满足（HEAD 树本轮重跑）+ 修复正确性**

| 判据 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| C4a 结构门 | 本轮重跑 `grep -rnE 'worker_threads\|MessageChannel\|MessagePort' packages/ws-replication/src packages/ws-replication/package.json` = **0 命中**（test 树唯一命中 = round 测试 :448 的 C4a 断言模式本身，合法） | ✅ |
| C5c 结构门 | 本轮重跑 `grep -c expectedSequence src/hub-session-host.ts` = **0** | ✅ |
| 修复符号映射 | `hub-session.ts:299` `createHubSessionSink`（唯一运行时导出，:32 `HubSessionSinkConfig`）；`hub-split.ts:126` `HubSessionSink` 接口——修复导入与之一一对应；与 `src/hub-connection.ts:18`、#418 structure `:39` 权威形态同形 | ✅ |
| 唯一最小路线 | #418 structure `:618` `toEqual(['createHubSessionSink'])` exact-equality 在场亲证 ⇒ 生产侧别名必转红；消费方跟随是唯一不触冻结面的路线（SA8 §3-3 同口径） | ✅ |

## 5. 规范一致性（ADR 0032 / 协议 v1 / 决策面）

| 面 | 核验（本轮） | 判定 |
| --- | --- | --- |
| ADR 0032 决策 1–5 原文与附录 | `docs/adr/0032-*.md` 不在修复 diff；与已批准交付逐字节相同（F5）；:32 #420 附录、:66 公共面 append-only、:68 #423 注记并存 | ✅ |
| 公共面 append-only | `src/index.ts` blob 逐字节过继（F5）；修复零导出增删 | ✅ |
| 协议 v1 冻结面 | `docs/protocols/instance-replication-v1.md` 不在修复 diff 及交付 diff；本轮零触碰 | ✅ |
| 内部缝 × 公共缝双轨 | 修复后 #423 测试仍深路径消费内部 splice（`HubSessionSinkConfig` 缝形），未改道公共 `createHubSessionHost`（`HubSessionHostConfig` 授权投影形）——被测对象与双轨边界不变 | ✅ |
| 决策冲突面 | SA8 CI 修复轮 10 项对照（6 no-conflict + 4 implements-existing-decision、0 evolution-required、0 hard-conflict、0 override）clear、recheck false；本轮未发现新增面 | ✅ |

## 6. 验证证据与 scope 核验

- **红→绿链自洽**：红 = CI run `35663498235` 定证（5 fail 作业每处错误均指向两文件同一
  stale 导入；同 run 其余 11 作业含 contract-gates 全绿 ⇒ 归因面唯一）+ 本地独立复现
  （同 4 条 TS2724/TS2305、8 红同一 `TypeError`）；绿 = V29–V35 于被审字节（F4）。
- **失败性质**：8 红全部 `TypeError: createHubSessionHost is not a function`（ESM 具名导入
  缺席的链接期失败，**非**行为断言失败）⇒ 修复不涉及任何验收语义改写。
- **scope**：修复轮改动面 = 2 测试文件 + 7 证据日志 + 3 报告；两文件为基线树口径 ALLOW
  之外的父增量文件，SA3 Deviation #6 显式登记、SA8 裁决收编（§3-1）；零静默越界。
- **证据入档**：7 条 iteration-4 证据日志随本 commit 入库；SA4 Part C、SA8 CI 修复轮报告
  随本 commit 入库；前轮 SA10 文本随 `3f470fb` 在 git 历史在册。

## 7. PR 必须披露的未达成/登记项（均不阻断 approve）

1. **修复 commit 未 push、新 head CI 未跑（SA8 RA1''/RA2''，执行形式门，Controller 持有；
   本轮三通道亲验直陈）**：`origin/mabf/issue-420` 仍 = `3f470fb`（PR #429 head，CI 5 红）；
   commit `2c87b3b` 无任何 CI run 记录。全部失败 CI 命令的本地逐字重跑已在被审字节上全绿
   （V29–V35），但**不得以本地绿替代 CI 绿**（SA3/SA4 同口径）——合并前阻断性流程门：
   Controller push 后 `typecheck` + `test (20/24, 1–6)` + `contract-gates` 须绿；出现任何
   不能完全归因于该两文件 stale 导入的失败 ⇒ 停，回 SA8（RA4''①）。
2. **根 `pnpm test` 全仓（443 文件）修复轮未跑**（SA4 §C-11 登记，Controller/SA7 持有）：
   修复仅触 2 个测试文件导入符号；包全量（90 文件/785 用例）、两失败分片、typecheck 两步、
   契约门四步均已逐字实跑绿。
3. **设计文本滞后一行（SA8 RA1''，wiki 内务，Controller/SA1 持有）**：设计 §7 D7
   `namespaceFrame` 行字面补正 + 附录 A2 β 措辞对齐；本修复不改变其状态。
4. **SA4 CI 修复轮 MINOR ×3（非阻断）**：O14 两文件头注授权出处括注可更精确（重命名授权
   D9/U1 与跟随先例 §12.6 编辑 2 宜分列）；O15 `hub-session.ts:49` 既有格式非惯例（非本轮
   引入）；O16 被拒中间态未归档（终态已由 tsc 绿闭合）。
5. **承接前轮在册登记项（状态不变）**：反空跑锚替换登记（SA3 Deviation 3）；U2 真 worker
   形态未解（明示非目标，PR 不得声称已解决）；服务轨/宿主接线/peer 侧拆分/跨进程 revoke =
   后续票；观测边界 R6/R7/R11/R12 与夹具头注保真度清单；公共 host `sessions` 表无删除路径
   （SA4 O4）；`artifacts/sa6-issue420-*-probe.mts` 陈旧旧名（不在任何 include 面，本轮 grep
   复证 0 命中）；夹具头注 `MAX_EARLY_FRAMES` 指针陈旧（SA8 RA3，非门禁）；SA8 RA5'/RA5''
   跨票账（`sendQueueMs` 穿透公共缝须重过 SA8；内部缝测试迁移公共工厂 = 决策变化）。
6. **范围扩展已收编（登记闭环）**：两 #423 文件的编辑属父增量文件跟随，SA3 Deviation #6 +
   SA8 §3-1 裁决（implements-existing-decision，许可性成立、无需扩枚举/override）——PR 应
   按 SA8 RA5'' 口径披露该跟随账目（#418 两文件 + #423 两文件）。

## 8. 结论

最终已提交 CI 修复 `2c87b3b` 对 Issue #420 的五条 AC **全部满足且无部分实现**：修复面
精确命中 CI 红灯唯一根因（两 #423 测试文件 stale 深路径导入的机械符号名跟随），零生产
代码、零断言/用例体改动、零冻结面触碰；13 条 ALLOW 验收载体与已批准交付逐字节相同；
AC1/AC4/AC5 结构门在 HEAD 树本轮重跑全绿；验证证据（V29–V35）经 sha256 冻结锚绑定被审
字节；规范面（ADR 0032 / 协议 v1 / 公共面 append-only / 双轨边界）零违约保持；范围扩展
经 SA8 裁决收编，无 scope creep 失控。残余项全部为在册登记项与执行形式门（§7），其中
§7-1（push + 新 head CI 绿）为 Controller 持有的合并前阻断性流程门。无任何关键 AC
partial/unmet/unachievable。**approve**。
`requiresConflictRecheck: false`（承接 SA8 CI 修复轮窄域闭合；本轮未发现新的决策冲突面）。

## 附：artifactPaths（worktree-relative）

```text
wiki/raw/task_issue-420_sa10_spec.md
```
