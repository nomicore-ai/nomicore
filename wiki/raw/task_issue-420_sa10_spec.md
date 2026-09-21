# SA10 Spec 审查报告 — Issue #420（SessionHost 公共工厂 + 内存管道完整协议回合，spec #415 T3）

> SA10（独立 Spec 审查者）spec-review 轮产物。dispatch `sa-cfe60fd6-b858-4c88-90c6-fa1952bf7a30`，
> role `mabf-sa10`，phase spec-review，**iteration 3**。
> **被审对象**：**Issue #420 CI 修复交付的最终当前形态** —— HEAD `5a4049d87bb3d244abed910e1bd372949501515c`
> （`docs: archive CI repair final reviews`），谱系：`5a4049d`（归档）→ `2c87b3b`（CI 修复，
> `test(ws-replication): update internal splice imports`）→ `3f470fb`/`aff4bc0`/`eb5ec09`（归档）→
> `4e5ff0a`（交付，父 = 授权权威父基 `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df` = Parent PR #416
> stable head / PR #428 merge）。本轮 `git rev-parse HEAD` + `git log` 亲证父链；branch
> `mabf/issue-420`。
> **执行态（本轮全部 gh/REST 亲验）**：修复后 CI run `35665953800`（head `5a4049d`）conclusion =
> **success，16/16 作业全绿**（typecheck + 12 test 分片 + contract-gates + codegen-freshness +
> packaging）；PR #429 **MERGED**（merge commit `4ad13a35f782411d3c48096c31afa724f6eae067`，
> 2026-09-21T23:08:48Z，base `spec/415-replication-transport-decoupling`）；issue #420 **CLOSED**
> （2026-09-21T23:08:50Z）；远端分支 `mabf/issue-420` 已随 merge 删除（`git ls-remote` 空）。
> **Issue 评论输入**：派工明示 Owner comment requirements = none；本轮 `gh issue view 420
> --json comments` 亲取 = 0 条 ⇒ 无逐条 Owner 评论映射面。
> **前轮账（不堆叠为当前结论）**：SA10 iteration 2（dispatch `sa-56f2e258…`）对**已提交未 push** 的
> 修复 `2c87b3b` 判 approve，唯一合并前阻断性流程门 = §7-1（push + 新 head CI 绿，Controller 持有）。
> 本轮对象 = 同一被审字节谱系 + **该流程门的兑现结果**（push → 16/16 绿 → merge → close）。
> **输入产物（全部亲读）**：Issue #420 正文（AC1–AC5）、`task_issue-420_sa6_contract.md`（CI 修复轮
> 工作树版：K1–K8、§12.4 禁止方向、§12.6 归因收口、附 B 前轮索引）、`task_issue-420_design.md`
> （§7 D9、§11 ALLOW/DENY）、`task_issue-420_sa3_impl.md`（iteration 4）、
> `task_issue-420_sa4_review.md`（Part D 复审 approve，O17–O18）、
> `task_issue-420_ci_repair_conflict_report.md`（SA8 CI 修复轮实施复查 **clear**，8 no-conflict +
> 3 implements-existing-decision，0 evolution/hard-conflict/override，`requiresConflictRecheck:
> false`）、`task_issue-420_sa9_standards.md`。
> **独立核验方式（本轮全部亲读/亲跑只读命令，非转述）**：HEAD 谱系与 `2c87b3b..5a4049d` 差分面；
> CI run `35665953800` 逐作业 conclusion 枚举；merge commit `4ad13a35` tree 与 `5a4049d` tree
> 同一性比对；合并谱系第二绿 run `35666189272`；修复 diff census 与 sha256 冻结锚复算；
> AC1/AC4/AC5 结构门在 HEAD 树重跑；#418 双冻结锚与 13 名 FROZEN_PRODUCTION_EXPORTS 亲读；
> stale 符号全仓 grep；skip/only 纪律 grep；`git diff --check`。
> **边界**：零代码/设计/测试/文档改动；未运行测试、未启动服务；零 commit/push/PR/finalize；
> 唯一写入 = 本文件（原位替换前轮回产物，前轮文本已随 `3f470fb`/`5a4049d` 入档于 git 历史）。

---

## Verdict

**approve**（`requiresConflictRecheck: false` —— 承接 SA8 CI 修复轮实施复查闭合：其 §10 明文
「实施复查闭合 ⇒ false」，本轮对被审字节与执行态独立复核后未发现新的决策冲突面）。

**核心理由**：

1. **前轮唯一阻断性流程门已兑现在册（§0）**：iteration 2 §7-1 要求的「push + 新 head CI 全绿」
   已由可复核事实闭合——修复后 head `5a4049d` 的 CI run `35665953800` **16/16 success**（本轮
   逐作业枚举亲取，原 5 红作业 typecheck + test(20,1)/(20,6)/(24,1)/(24,6) 全部转绿）；merge
   commit `4ad13a35` 的 tree 与 `5a4049d` tree **逐位同一**（`187cc70f…` 双取相同）且合并谱系另有
   绿 run `35666189272` ⇒ PR head 绿完全覆盖合并态；SA8 RA4''① 触发条件（不可归因于两文件
   stale 导入的新失败）**未发生**。
2. **被审字节零漂移（§0/§6）**：`2c87b3b..5a4049d` 差分 = 恰 2 个 wiki/raw 报告（SA9/SA10 归档），
   `packages/`、`docs/`、`CONTEXT.md` 零字节；两被修测试文件 sha256 复算 = SA3 §4.4 / SA8 §1 /
   iteration 2 F4 登记值（`16056587…`/`778d2461…`）⇒ 前轮对修复 diff 的全部裁决直接覆盖最终态。
3. **五条 AC 在最终 HEAD 树逐项复核仍满足（§1–§5）**：AC1 公共入口 13 值导出含
   `createHubSessionHost`（`src/index.ts:6`）+ 13 名 FROZEN_PRODUCTION_EXPORTS 冻结表在场 +
   双 test-d 锁定未被任何 diff 触碰；AC2 回合锚与 shim 夹具在场且不在修复面；AC3 矩阵文件零触碰
   且 CI 全分片绿；AC4 缝纯度 grep 0 命中；AC5 `expectedSequence` 0 计数；#418 C0c exact-equality
   锚（:618 `toEqual(['createHubSessionSink'])`）在场被保持。
4. **修复正确性与最小性终认（§4/§6）**：修复 = 恰 2 个 #423 测试文件 +18/−8 机械符号名跟随
   （头注+导入+类型标注+工厂调用），断言/用例体/金标零字节变化，skip/only/todo 0 命中，
   `git diff --check` RC=0；符号映射与仓内权威消费方（`src/hub-connection.ts:18`、#418
   structure :39）逐形相同；生产侧别名恢复被 #418 冻结锚决定性封死 ⇒ 消费方跟随为唯一自洽
   最小路线（SA8 裁决 implements-existing-decision 成立）。
5. **无 scope creep、无 Owner 要求遗漏（§6/§7）**：范围扩展（两 #423 父增量文件跟随）经 SA3
   Deviation #6 登记、SA8 两轮裁决收编；REST 评论三端点（issue/PR/review）均 `[]`（SA6 §2
   快照 + 本轮亲取一致）⇒ 无未映射 Owner 要求；残余项全部为非阻断登记/归档项（§7）。

---

## 0. 谱系、修复面与执行态独立核验

| # | 核验点 | 本轮独立取证（命令与观察） | 判定 |
| --- | --- | --- | --- |
| F1 | 最终 HEAD 与父链 | HEAD = `5a4049d…`；链 `5a4049d→2c87b3b→3f470fb→aff4bc0→eb5ec09→4e5ff0a→25c51cd`（授权父基，与派工/前轮值逐位相同） | ✅ |
| F2 | 修复+归档业务面 | `git diff --name-only 3f470fb..HEAD -- packages/` = 恰 2 个 #423 测试文件；`-- packages/ws-replication/src/` 字节数 0；`-- docs/ CONTEXT.md` 空 | ✅ |
| F3 | 归档 commit 面 | `git diff --name-only 2c87b3b..5a4049d` = 恰 `task_issue-420_{sa9_standards,sa10_spec}.md` 两 wiki 报告 | ✅ |
| F4 | 被修字节 = 验证字节 | sha256 两文件 = `160565873bf980c0ee1042d699fc9da890ee74743222139097e095a60395681e` / `778d2461f0421027c25c17bd817327dcccf14b3a53b4f92efa2e728852e0183c`，与 SA3 §4.4 / SA8 §1 / SA10-iter2 F4 登记值逐位相同 | ✅ |
| F5 | 修复后 CI | `gh run view 35665953800`：head `5a4049d`、status completed、conclusion **success**；逐作业枚举 = packaging / codegen-freshness / contract-gates / typecheck / test(20,1–6) / test(24,1–6) **16/16 全 success** | ✅ |
| F6 | PR/issue 终态 | PR #429 MERGED（`4ad13a35`，2026-09-21T23:08:48Z，base `spec/415-replication-transport-decoupling`，headRefOid = `5a4049d`）；issue #420 CLOSED（23:08:50Z）、comments = 0；`git ls-remote origin mabf/issue-420` 空（随 merge 删除） | ✅ |
| F7 | 合并态 = 被审态 | `git rev-parse 4ad13a35^{tree} 5a4049d^{tree}` = 同为 `187cc70f141bdcef0d173229a9fc29b0611fe4c4`；merge commit 另有绿 run `35666189272`（conclusion success）⇒ 合并后字节无任何未验证面 | ✅ |
| F8 | 前轮阻断门闭合 | iter2 §7-1（SA8 RA1''/RA2''）= push ✅ + 新 head CI 16/16 绿 ✅ + merge ✅ + close ✅；RA4''① 触发条件未发生；SA9 §8-N3「新 head CI 复跑」随之销账 | ✅ 闭合 |
| F9 | 卫生门 | `git diff --check 3f470fb 2c87b3b` RC=0；两被修文件 `.(skip|only|todo)(`/`xit(` grep = 0 命中 | ✅ |
| F10 | 工作树未提交面 | `git status --porcelain -uall`：M = `sa4_review.md`（Part D 复审 approve）+ `sa6_contract.md`（CI 修复轮契约原位重写）；?? = `artifacts/sa6-issue420-ci-repair/**`（37 条证据/脚本）+ `task_issue-420_ci_repair_conflict_report.md`（SA8 本轮报告）——**全部 wiki/raw 或 artifacts 证据/报告，零 packages/docs/CONTEXT**；归档属 SA8 RA1（Controller 持有，§7-7） | 登记 |

## 1. AC1 — 公共入口导出 + test-d 锁定：**满足（最终 HEAD 树本轮重跑）**

| 核验点 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| 公共入口导出 | `src/index.ts:6` `createHubSessionHost` 自 `./hub-session-host.js`；13 值导出（基线 11 + `createHubSessionHost` + `createHubReplicationEdge`） | ✅ |
| 冻结签名/导出表 | #418 契约 `FROZEN_PRODUCTION_EXPORTS`（contract test :144–158）13 名含 `createHubSessionHost`（:153）亲读在场；`src/index.ts`、`src/hub-session-host.ts` 不在 `3f470fb..HEAD` 任何 diff（F2/F3） | ✅ |
| test-d 双锁 | `…issue420-session-host-api.test-d.ts`（4 个 issue420 测试文件之一本轮清点在场）不在修复面，与已批准交付逐字节相同（F3/F4 谱系） | ✅ |
| append-only | 修复+归档谱系零导出增删（F2）；ADR 0032 :66 保持 | ✅ |

## 2. AC2 — 内存管道完整协议回合：**满足（修复零触碰）**

回合测试锚（A1–A12 + C4a–d + C5a–c，本轮 grep 计数在场）与夹具 `issue420-shim-hub.ts`（在场亲验）
均不在 `3f470fb..HEAD` 业务面（F2/F3）；内存双端装配、零 socket 零 worker 形态不变。动态证据链
（SA3 V3/V17/V32、SA7 聚焦 63/63）绑定已批准交付字节；修复后 CI 12 分片全绿（F5）为同字节远端
终证。

## 3. AC3 — 现有矩阵在 shim 上重跑绿灯：**满足（修复零触碰 + CI 终证）**

7 矩阵文件与 shim-matrix 机制文件不在任何修复/归档 diff（F2/F3）；`vitest.config.ts`、
`.github/`、`scripts/` 零触碰；通道 `hub-namespace.ts`/`hub-edge.ts` 零交付侧改动（src 谱系字节 0）。
修复后 CI run `35665953800` 的 12 个 test 分片（Node 20/24 × 1–6）全绿（F5 逐作业枚举）⇒ 全量
测试面（含 shim 矩阵与 listen 矩阵）在被审字节上远端绿灯终证；iter2 §7-2「根 pnpm test 全仓
修复轮未跑」由 CI 全分片矩阵绿**销账**（分片矩阵即全仓测试面的 CI 执行形态）。

## 4. AC4/AC5 — 缝纯度与零入站序重检：**满足（最终 HEAD 树本轮重跑）+ 修复正确性终认**

| 判据 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| C4a 结构门 | 本轮重跑 `grep -rnE 'worker_threads\|MessageChannel\|MessagePort' src package.json` = **0 命中** | ✅ |
| C5c 结构门 | 本轮重跑 `grep -c expectedSequence src/hub-session-host.ts` = **0** | ✅ |
| 修复符号映射 | `hub-session.ts:299` `createHubSessionSink`（唯一运行时导出，:32 `HubSessionSinkConfig`）；`hub-split.ts:126` `HubSessionSink` 接口权威面；修复导入切分（工厂自 `hub-session.js`、类型自 `hub-split.js`）与 `src/hub-connection.ts:18`、#418 structure :39 逐形相同；`src/hub-split.ts:7` 对 `createHubSessionHost` 的唯一提及 = 指向公共工厂的散文注释（合法） | ✅ |
| 唯一最小路线 | #418 structure :615–619 C0c `toEqual(['createHubSessionSink'])` exact-equality 在场亲证 ⇒ 生产侧别名恢复必转红；消费方跟随是唯一不触冻结面的路线（SA8 §3-3/§7-(b) 同口径） | ✅ |
| stale 面 | 旧内部名残留 = 仅两被修文件头注散文（D9 跟随登记，合法）+ 公共面合法条目；`createHubSessionHost` 命中文件全部为公共工厂合法消费方/导出 | ✅ |

## 5. 规范一致性（ADR 0032 / 协议 v1 / 决策面）

| 面 | 核验（本轮） | 判定 |
| --- | --- | --- |
| ADR 0032 / 协议 v1 / CONTEXT.md | `git diff 3f470fb..HEAD -- docs/ CONTEXT.md` 空（F2）；决策文本零触碰 | ✅ |
| 公共面 append-only + 双轨边界 | `src/index.ts` 零 diff；#423 测试仍深路径消费内部 splice（未改道公共 `createHubSessionHost`，config 不同形）——被测面与 ADR 0032 :32–53 双轨边界不变 | ✅ |
| wire/事件/字段集冻结面 | 协议 §17/§23.1–23.4 谱系零字节；EM-C7 金标/断言零变化（diff census + skip/only 0 命中） | ✅ |
| 决策冲突面 | SA8 CI 修复轮实施复查 11 行对照（8 no-conflict + 3 implements-existing-decision、0 evolution-required、0 hard-conflict、0 override）**clear**、`requiresConflictRecheck: false`（§10：实施复查闭合）；本轮未发现新增面 | ✅ |

## 6. 验证证据与 scope 终核

- **红→绿→合并链全环闭合且每环可复核**：红 = CI run `35663498235`（5 fail/11 pass，归因面唯一）
  + SA6 单变量对照实验逐字复现（4×TS2724/TS2305 + 8×TypeError）；绿 = V29–V35 本地逐字重跑
  （跑于 sha256 锚定字节，F4）+ CI run `35665953800` 16/16（F5）；合并 = PR #429 MERGED 且
  merge tree == 被审 head tree（F7），合并谱系另有绿 run `35666189272`。**本地绿未被用作
  CI 绿的替代**——iter2 §7-1 流程门要求的正是远端绿，已兑现。
- **失败性质**：8 红全部 `TypeError: createHubSessionHost is not a function`（ESM 具名导入缺席的
  链接期失败，非行为断言失败）⇒ 修复不涉及任何验收语义改写；SA4 Part D 变异敏感负控
  （`accounting` 直通置 undefined ⇒ 5 用例转红）证明修复后测试仍绑定真实运行时行为，无遮蔽。
- **scope**：修复轮全量改动面 = 2 测试文件 + 7 证据日志 + 3 报告（已提交）+ SA6 契约/证据与
  SA4 Part D、SA8 报告（未提交证据面，F10）；两 #423 文件为基线树口径 ALLOW 之外的父增量文件，
  SA3 Deviation #6 登记 + SA8 两轮裁决收编（implements-existing-decision，许可性成立、无需扩
  枚举/override）；零静默越界。
- **Owner 要求面**：REST 三端点（issue comments / PR comments / PR reviews）均 `[]`（SA6 §2 快照
  2026-09-21T23:12:04Z + 本轮 `gh` 亲取一致）⇒ 「Owner comment requirements: none」成立，
  无遗漏映射面。

## 7. PR 必须披露的未达成/登记项（均不阻断 approve）

1. ~~修复 commit 未 push、新 head CI 未跑~~ **已闭合（iter2 §7-1 → 本轮 F8）**：push ✅、新 head
   `5a4049d` CI 16/16 绿 ✅、PR #429 MERGED ✅、issue #420 CLOSED ✅；RA4''① 未触发。
2. ~~根 `pnpm test` 全仓修复轮未跑~~ **已销账（本轮 §3）**：修复后 CI 12 分片矩阵（全仓测试面的
   CI 执行形态）在被审字节上全绿。
3. **设计文本滞后一行（SA8 RA1''，wiki 内务，Controller/SA1 持有，状态不变）**：设计 §7 D7
   `namespaceFrame` 行字面补正 + 附录 A2 β 措辞对齐；不影响任何验收载体字节。
4. **SA4 MINOR ×5（非阻断，全在册）**：O14–O16（Part C：头注授权出处括注精度 / `hub-session.ts:49`
   既有格式非惯例 / 被拒中间态未归档）；O17–O18（Part D 新增，非阻断）。O14 归因口径已由 SA6
   §12.6 分列收口（SA8 §3-8 同向认定）。
5. **承接前轮在册登记项（状态不变，均非本票验收面）**：反空跑锚替换登记（SA3 Deviation 3）；
   U2 真 worker 形态未解（明示非目标，PR 不得声称已解决）；服务轨/宿主接线/peer 侧拆分/跨进程
   revoke = 后续票；观测边界 R6/R7/R11/R12 与夹具头注保真度清单；公共 host `sessions` 表无删除
   路径（SA4 O4）；`artifacts/sa6-issue420-*-probe.mts` 陈旧旧名（不在任何 include 面）；夹具头注
   `MAX_EARLY_FRAMES` 指针陈旧（SA8 RA3，非门禁）；SA8 RA5'/RA5''/RA2/RA3 跨票账（`sendQueueMs`
   穿透公共缝须重过 SA8；内部缝测试迁移公共工厂 = 决策变化；父 head 再前移须复认）。
6. **范围扩展收编登记（闭环）**：两 #423 文件跟随账（#418 两文件 + #423 两文件）已按 SA8 RA5''
   口径在册；SA8 CI 修复轮 §3-3/§3-4 终认。
7. **未提交证据面归档（SA8 CI 修复轮 RA1，Controller 持有，纯归档形式门）**：工作树未提交面 =
   SA6 CI 修复契约（原位重写）+ SA4 Part D + `artifacts/sa6-issue420-ci-repair/**` + SA8 本轮
   报告（F10 亲验枚举，零 packages/docs/CONTEXT）。PR #429 已 merge、issue #420 已 close ⇒ 本项
   是 CI 修复账本的**归档门**而非交付阻断门；本报告（本文件）亦属下一轮归档面。
8. **issue 正文 AC 复选框未勾选（观察项）**：issue #420 以复选框未勾态关闭；五项 AC 的实质满足
   由本报告 §1–§5 与 CI 16/16 终证，勾选态为 issue 跟踪面形式，不构成验收缺口。

## 8. 结论

Issue #420 CI 修复交付的**最终当前形态**（HEAD `5a4049d`，PR #429 MERGED `4ad13a35`，issue
CLOSED）对五条 AC **全部满足且无部分实现**：修复面精确命中 CI 红灯唯一根因（两 #423 测试文件
stale 深路径导入的 D9 机械符号名跟随），零生产代码、零断言/用例体改动、零冻结面触碰、零规范
文本触碰；被审字节经 sha256 锚与 merge-tree 同一性双重绑定，验证证据（V29–V35 本地 + CI
`35665953800` 16/16 远端 + merge run `35666189272`）全环闭合；前轮唯一阻断性流程门（push +
新 head CI 绿）已兑现，无新增未达成项；范围扩展经 SA8 收编，无 scope creep；Owner 评论面为空
且已核。残余项全部为非阻断登记/归档项（§7），其中 §7-7 为 Controller 持有的证据归档形式门。
无任何关键 AC partial/unmet/unachievable。**最终就绪确认：approve**。
`requiresConflictRecheck: false`（承接 SA8 CI 修复轮实施复查闭合；本轮未发现新的决策冲突面）。

## 附：artifactPaths（worktree-relative）

```text
wiki/raw/task_issue-420_sa10_spec.md
```
