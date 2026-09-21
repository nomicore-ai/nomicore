# SA10 Spec 审查报告 — Issue #420（SessionHost 公共工厂 + 内存管道完整协议回合，spec #415 T3）

> SA10（独立 Spec 审查者）spec-review 轮产物。dispatch `sa-d49ec57a-1e1f-4105-8b5b-09e09a0b5c34`，
> role `mabf-sa10`，phase spec-review，**iteration 4**。
> **被审对象**：**Issue #420 交付的最终 post-rebase 形态** —— HEAD
> `5ed3dc0d0069f4b359794a9d7527315b441663e6`（`chore: archive issue 420 CI repair evidence`），
> **唯一增量 = CI 修复证据归档**，父 = `4ad13a35f782411d3c48096c31afa724f6eae067`（PR #429
> merge commit = 派工明文的当前 Parent PR #416 head；本轮 `git rev-parse HEAD^` 与
> `git ls-remote origin spec/415-replication-transport-decoupling` 双证逐位相同）。branch
> `mabf/issue-420`；谱系：`5ed3dc0`（本归档）→ `4ad13a3`（merge：`25c51cd` 基 + `5a4049d`
> PR head）→ `2c87b3b`（CI 修复）→ `3f470fb`/`aff4bc0`/`eb5ec09`（归档）→ `4e5ff0a`（交付，
> 父 = 授权父基 `25c51cd` = PR #428/#423 merge）。
> **执行态（本轮全部 gh/REST 亲取，非转述）**：issue #420 **CLOSED**、`comments: 0`（
> `gh issue view 420 --json state,comments` + `gh api …/issues/420/comments --jq length` =
> `0` 双通道）；PR #429 **MERGED**（mergeCommit `4ad13a35…`，`comments: 0`、`reviews: 0`）；
> 修复后 CI run `35665953800`（head `5a4049d`）`status=completed / conclusion=success`；
> 父分支 head `4ad13a3` 的 merge-commit run `35666189272` = **success**（`gh run list
> --branch spec/415-…` 亲取，连同 `25c51cd`/`1f5809b` 两祖先 run 均 success）。
> **Owner 评论输入**：派工明示 none（REST comments returned `[]`）；本轮三端点亲取全部
> 为 0 ⇒ **无逐条 Owner 评论映射面**，与派工一致。
> **前轮账（不堆叠为当前结论）**：SA10 iteration 3（dispatch `sa-cfe60fd6…`）对 HEAD
> `5a4049d` 判 **approve**，唯一存续形式项 = §7-7（SA6 CI 修复契约 + `artifacts/sa6-
> issue420-ci-repair/**` + SA8 CI 修复报告 + SA4 Part D 等工作树未提交证据面的归档，
> Controller 持有）。**本轮对象 = 同一交付字节谱系 + 该归档形式项的兑现结果**
> （`5ed3dc0` 恰为该归档 commit），并按派工要求对「post-rebase 到 Parent PR #416 当前
> head `4ad13a35`」的终态重取全部独立核验。
> **输入产物（全部亲读）**：Issue #420 正文（AC1–AC5，复选框原文亲取）、
> `task_issue-420_sa6_contract.md`（CI 修复轮：K1–K8、§12.4 禁止方向、§12.6 归因收口、
> 附 B 前轮索引）、`task_issue-420_design.md`（§7 D9、§11 ALLOW/DENY）、
> `task_issue-420_sa3_impl.md`（iteration 4 + Iteration 5 仅空白终态修复）、
> `task_issue-420_sa4_review.md`（Part C approve O14–O16 / Part D approve O17–O18）、
> `task_issue-420_ci_repair_conflict_report.md`（SA8 CI 修复轮实施复查 **clear**，8
> no-conflict + 3 implements-existing-decision，0 evolution/hard-conflict/override，
> `requiresConflictRecheck: false`）、`task_issue-420_implementation_conflict_report.md`
> （前轮 RA1''–RA5''）、`task_issue-420_sa9_standards.md`（iteration 3 approve）。
> **独立核验方式（本轮全部亲读/亲跑只读命令，非转述）**：HEAD 父链与远端 ref 双证；
> `git diff 4ad13a3..HEAD` 全量路径枚举与业务面零 diff；merge tree / PR head tree 同一性
> 复算；两被修 #423 测试文件 sha256 冻结锚复算；`src/index.ts` blob 与 tsx 运行时导出面
> 探针（13 名，与 FROZEN_PRODUCTION_EXPORTS 排序全等）；AC1/AC4/AC5 结构门在 HEAD 树
> 重跑；#418 双冻结锚亲读；DENY 面（`hub-namespace.ts`/`hub-edge.ts`/`testing.ts`/协议/
> CI 配置）对授权父基 `25c51cd` 的全交付零 diff；stale 符号全仓 grep；skip/only 纪律
> grep；`git diff --check`；4 个 EOF 空行修复日志的末两字节（`290a`）亲验。
> **边界**：零代码/设计/测试/文档改动；未运行测试、未启动服务；零 commit/push/PR/
> finalize；唯一写入 = 本文件（原位替换前轮 iteration 3 回产物，前轮文本已随 `5ed3dc0`
> 入档于 git 历史）。

---

## Verdict

**approve**（`requiresConflictRecheck: false` —— 承接 SA8 CI 修复轮实施复查闭合（其 §10
明文「实施复查闭合 ⇒ false」）；本轮被审增量为纯证据归档 commit，对决策文本、公共 API、
wire、schema、持久化、状态机、生命周期、失败语义零触碰，未发现新的决策冲突面）。

**核心理由**：

1. **派工形态逐字成立（§0-F1/F2）**：被审 HEAD `5ed3dc0` 的父 = 派工钉定的 Parent PR
   #416 当前 head `4ad13a35…`（本地 `HEAD^` 与远端 ref 双证）；`4ad13a3..HEAD` 差分 =
   **恰 42 路径、全部为 `artifacts/sa6-issue420-ci-repair/**`（36）+ `wiki/raw`（6）
   证据/报告**，`packages/`、`docs/`、`CONTEXT.md`、`.github/`、`scripts/`、配置与锁
   文件**零字节**——「includes only archival CI-repair evidence」**属实**。
2. **前轮唯一存续形式项已闭合（§0-F3）**：iteration 3 §7-7 的未提交证据面（SA6 CI
   修复契约原位重写 + SA6 CI 修复 artifacts + SA8 CI 修复冲突报告 + SA4 Part D + SA3
   iteration 5 + SA9/SA10 终审）现已**全部入档**于 `5ed3dc0`（37 A + 5 M 与 SA8 RA1
   口径逐项吻合）；SA4 O17、SA9 §8-N3'、SA8 CI 修复轮 RA1 同步销账。工作树
   `git status` 净（本轮亲验空）。
3. **五条 AC 在最终 HEAD 树逐项复核仍满足（§1–§5）**：AC1 公共入口 13 值导出含
   `createHubSessionHost`（`src/index.ts:6` + blob `08fa49a1…` + tsx 运行时 13 名与
   FROZEN_PRODUCTION_EXPORTS 排序全等）+ 双 test-d 锁定在场；AC2 回合锚（A1–A12 +
   C4/C5 族，10 个 `it(` 亲计）与 shim 夹具在场且不在归档面；AC3 矩阵文件零触碰且
   CI 12 分片绿（run `35665953800` success + merge run `35666189272` success）；
   AC4 缝纯度 grep 0 命中；AC5 `expectedSequence` 0 计数；#418 C0c exact-equality 锚
   （`toEqual(['createHubSessionSink'])`）与 13 名冻结表在场被保持。
4. **CI 修复正确性与验收契约终认（§4/§6）**：两被修 #423 测试文件 sha256 复算 =
   SA3 §4.4 / SA8 §1 / SA6 §5.4 / SA10-iter2·iter3 登记值（`16056587…`/`778d2461…`）
   **逐位相同**；merge tree `187cc70f…` = PR head tree（双取相同）⇒ 已验证绿字节与
   合并态字节同一，归档增量不改变任何被验证面；SA6 K1–K8 门集证据（单变量红实验、
   机制探针 9/9、变异敏感负控、绿门六跑、CI 复跑 16/16）全部随 `5ed3dc0` 入档可审。
5. **无 scope creep、无 Owner 要求遗漏、无规范文本漂移（§5/§6/§7）**：全交付对授权
   父基 `25c51cd` 的业务差分 = 恰 13 条 ALLOW 路径 + 2 条 #423 消费方跟随（SA8 两轮
   `implements-existing-decision` 收编）；DENY 面逐项零 diff；docs/CONTEXT/协议对
   merge head 零字节；REST 三端点评论/评审均 0（本轮亲取）⇒ 「Owner comment
   requirements: none」成立。

---

## 0. 谱系、归档面与执行态独立核验

| # | 核验点 | 本轮独立取证（命令与观察） | 判定 |
| --- | --- | --- | --- |
| F1 | post-rebase 父基 = 派工钉定值 | `git rev-parse HEAD^` = `4ad13a35f782411d3c48096c31afa724f6eae067`；`git ls-remote origin spec/415-replication-transport-decoupling` = 同 OID；merge commit parents = `25c51cd` + `5a4049d` | ✅ |
| F2 | 归档-only 增量 | `git diff --name-only 4ad13a3..HEAD` = 恰 42 路径（36 artifacts + 6 wiki/raw）；`git diff 4ad13a3..HEAD -- packages/ apps/ domains/ docs/ tests/ scripts/ CONTEXT.md .github package.json pnpm-lock.yaml vitest.config.ts tsconfig*` = **空** | ✅ |
| F3 | 前轮归档形式项闭合 | name-status = 37 A（36 artifacts + `task_issue-420_ci_repair_conflict_report.md`）+ 5 M（sa3_impl/sa4_review/sa6_contract/sa9_standards/sa10_spec）；SA6 契约原位重写 310+/355−、SA3 Iteration 5 节、SA4 Part D 节在场亲读；工作树 `git status --porcelain -uall` 空 | ✅ 闭合 |
| F4 | 被修字节 = 冻结锚字节 | sha256 两文件 = `778d2461f0421027c25c17bd817327dcccf14b3a53b4f92efa2e728852e0183c` / `160565873bf980c0ee1042d699fc9da890ee74743222139097e095a60395681e`，与历轮登记值逐位相同 | ✅ |
| F5 | 公共面字节与运行时面 | `git rev-parse HEAD:packages/ws-replication/src/index.ts` = `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`；tsx 探针（包目录，`--conditions=nomicore-source`）：`COUNT=13`，排序后名单与 `FROZEN_PRODUCTION_EXPORTS`（contract test :144–157 亲读 13 名含 `'createHubSessionHost'` :153）**全等**，`typeof createHubSessionHost === 'function'` | ✅ |
| F6 | 修复后执行态（本轮 gh 亲取） | run `35665953800`（head `5a4049d`）= completed/**success**；`gh run list --branch spec/415-…`：`4ad13a3`（run `35666189272`）、`25c51cd`、`1f5809b` 三个 run 全 success；PR #429 MERGED（mergeCommit `4ad13a35…`，2026-09-21T23:08:48Z）；issue #420 CLOSED | ✅ |
| F7 | 合并态 = 被验证态 | `git rev-parse 4ad13a3^{tree} 5a4049d^{tree}` = 同为 `187cc70f141bdcef0d173229a9fc29b0611fe4c4`；HEAD tree `ac3f585c…` 与 merge tree 的差 = 恰 F2 的 42 条证据路径 | ✅ |
| F8 | Owner 评论面（本轮 REST 亲取） | `gh issue view 420 --json comments` → `commentCount: 0`；`gh api repos/…/issues/420/comments --jq length` → `0`；`gh pr view 429 --json comments,reviews` → `0/0` | ✅ 无映射面 |
| F9 | 卫生门 | `git diff --check 4ad13a3..HEAD` RC=0；SA3 Iteration 5 修复的 4 个日志末两字节 = `290a`（`)\n` 单 LF 收尾，EOF 空行已除）×4；两被修测试文件 `.(skip\|only\|todo)(`/`xit(` grep = 0 命中；`artifacts` 不在任何 tsconfig/vitest/package.json include 面（grep 0） | ✅ |
| F10 | 归档证据内容锚 | `08-ci-rerun-green.log` 含 run JSON（`"conclusion":"success"`、`headSha:5a4049d…`）；`12-merge-state.log` 含 merge JSON（parents / mergeCommit `4ad13a35…` / MERGED）；`10-rest-comments-snapshot.log` 在册 | ✅ |

## 1. AC1 — 公共入口导出 + test-d 锁定：**满足（最终 HEAD 树本轮重跑）**

| 核验点 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| 公共入口导出 | `src/index.ts:6` `export { createHubSessionHost } from './hub-session-host.js'`；运行时 13 值导出（基线 11 + `createHubSessionHost` + `createHubReplicationEdge`）经 tsx 探针全等核对（F5） | ✅ |
| 冻结签名/导出表 | `FROZEN_PRODUCTION_EXPORTS` 13 名含 `'createHubSessionHost'`（:153）亲读在场；`src/index.ts`、`src/hub-session-host.ts` 不在归档面任何 diff（F2）；blob `08fa49a1…` 与交付 `4e5ff0a` 逐位过继 | ✅ |
| test-d 双锁 | `test/ws-replication-issue420-session-host-api.test-d.ts` 在场（本轮清点 4 个 issue420 测试文件全在）；`--typecheck.only` 49 文件/270 用例绿由归档证据 `05-head-typecheck-only.log` 承载 | ✅ |
| append-only | 归档增量零导出增删（F2/F5）；ADR 0032 :66 谱系零字节 | ✅ |

## 2. AC2 — 内存管道完整协议回合：**满足（归档零触碰）**

回合测试 `…issue420-session-host-round.test.ts`（A1–A12 + C4a–d + C5a–c，本轮 `it(`
计数 = 10 在场）与夹具 `test/issue420-shim-hub.ts`（在场亲验）均不在 `4ad13a3..HEAD`
业务面（F2）；内存双端装配、零 socket 零 worker 形态不变。动态证据链（SA3 V3/V17/
V32、SA7 聚焦 63/63）绑定已批准交付字节；修复后 CI 12 分片（Node 20/24 × 1–6）在
**与合并态逐位同一的字节**（F7）上全绿（F6）为远端终证。

## 3. AC3 — 现有矩阵在 shim 上重跑绿灯：**满足（归档零触碰 + CI 终证）**

7 矩阵文件与 shim-matrix 机制文件不在任何归档 diff（F2）；`vitest.config.ts`、
`.github/`、`scripts/ci-test-shard.mjs` 零触碰；通道 `hub-namespace.ts`/`hub-edge.ts`
对授权父基 `25c51cd` **零 diff**（§5 DENY 表亲验）。CI run `35665953800` 的 12 个
test 分片全 success（F6）⇒ 全量测试面（含 shim 矩阵与 listen 矩阵、ac1-ac2 `:212`/
`:240` 再 OPEN 两用例）在被审字节上远端绿灯终证。

## 4. AC4/AC5 — 缝纯度与零入站序重检：**满足（最终 HEAD 树本轮重跑）+ 修复正确性终认**

| 判据 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| C4a 结构门 | 本轮重跑 `grep -rnE 'worker_threads\|MessageChannel\|MessagePort' src package.json` = **0 命中** | ✅ |
| C5c 结构门 | 本轮重跑 `grep -c expectedSequence src/hub-session-host.ts` = **0** | ✅ |
| 修复符号映射 | `hub-session.ts:299` `createHubSessionSink`（:32 `HubSessionSinkConfig`，`grep ^export` 仅此两面）；修复导入切分（工厂自 `hub-session.js` :57/:59、类型自 `hub-split.js` :58/:60）与权威消费方 `src/hub-connection.ts:18`、#418 structure :39 逐形相同（亲读） | ✅ |
| 唯一最小路线 | #418 structure :615–619 C0c `toEqual(['createHubSessionSink'])` 在场亲证 ⇒ 生产侧别名恢复必转红；消费方跟随唯一自洽（SA8 两轮裁决同口径） | ✅ |
| stale 面 | `createHubSessionHost\|HubSessionHostConfig` 全仓扫描（排除公共工厂合法面）：仅 `src/index.ts:92`（公共类型再导出，合法）、两被修文件头注散文（D9 跟随登记，合法）、#418 契约 :153（冻结条目）——**编译/运行 include 面零 stale 深路径引用** | ✅ |

## 5. 规范一致性（ADR 0032 / 协议 v1 / 决策面 / DENY 全表）

| 面 | 核验（本轮） | 判定 |
| --- | --- | --- |
| ADR 0032 / 协议 v1 / CONTEXT.md | `git diff 4ad13a3..HEAD --stat -- docs/ CONTEXT.md` = 空（F2）；对授权父基 `25c51cd` 的全交付差分中 docs 仅 `docs/adr/0032-*.md` 与 `CONTEXT.md` 两条 ALLOW 授权修订（交付本体），归档轮零新增 | ✅ |
| DENY 面（全交付口径） | `git diff 25c51cd..HEAD --name-only -- hub-namespace.ts hub-edge.ts testing.ts docs/protocols/instance-replication-v1.md package.json .github scripts vitest.config.ts` = **空** | ✅ |
| 公共面 append-only + 双轨边界 | `index.ts` blob `08fa49a1…` 逐位过继（F5）；#423 测试仍深路径消费内部 splice（未改道公共 `createHubSessionHost`，config 不同形）——被测面与 ADR 0032 :32–53 双轨边界不变 | ✅ |
| wire/事件/字段集冻结面 | 协议 §17/§23.1–23.4 谱系零字节；#423 EM-C7 金标/断言零变化（census + skip/only 0 命中，F9） | ✅ |
| 决策冲突面 | SA8 CI 修复轮实施复查（随本轮归档入档）= **clear**（8 no-conflict + 3 implements-existing-decision、0 evolution-required、0 hard-conflict、0 override）、`requiresConflictRecheck: false`（其 §10：实施复查闭合）；本轮归档增量不创设/修改任何决策 | ✅ |

## 6. 验证证据与 scope 终核

- **红→绿→合并→归档全环闭合且每环可复核**：红 = CI run `35663498235`（5 fail/11
  pass，归因面唯一）+ SA6 单变量对照实验逐字复现（4×TS2724/TS2305 + 8×TypeError，
  `07-red-*` 已入档）；绿 = V29–V35 本地逐字重跑（跑于 sha256 锚定字节，F4）+ SA6
  绿门六跑（`01`–`05`/`11` 已入档）+ CI run `35665953800` success（F6 本轮亲取）+
  merge-commit run `35666189272` success；合并 = PR #429 MERGED 且 merge tree == 已
  验证 PR head tree（F7）；归档 = `5ed3dc0` 仅证据/报告（F2/F3）。**本地绿未被用作
  CI 绿的替代**——远端绿与 merge 树同一性双重在册。
- **失败性质**：8 红全部 `TypeError: createHubSessionHost is not a function`（ESM
  具名导入缺席的链接期失败，非行为断言失败）⇒ 修复不涉及任何验收语义改写；变异
  敏感负控（`09-mutation-*`：`accounting` 直通置 undefined ⇒ 5/26 转红）证明修复后
  测试仍绑定真实运行时行为，无遮蔽。
- **scope**：本轮归档增量 = 42 条证据/报告路径（F2），即 SA8 CI 修复轮 RA1 的执行；
  全交付业务差分对 `25c51cd` = 恰 13 条 ALLOW 路径 + 2 条 #423 消费方跟随（SA3
  Deviation #6 登记 → SA8 两轮 `implements-existing-decision` 收编）；DENY 面零
  diff（§5）；零静默越界。
- **Owner 要求面**：REST 三端点（issue comments / PR comments / PR reviews）本轮
  亲取均 0（F8）⇒ 「Owner comment requirements: none」成立，无遗漏映射面。

## 7. PR 必须披露的未达成/登记项（均不阻断 approve）

1. ~~未提交证据面归档（iter3 §7-7 / SA8 CI 修复轮 RA1 / SA4 O17 / SA9 §8-N3'）~~
   **已闭合（本轮 F3）**：SA6 CI 修复契约原位重写 + `artifacts/sa6-issue420-ci-
   repair/**`（36 文件）+ SA8 CI 修复冲突报告 + SA4 Part D + SA3 iteration 5 +
   SA9/SA10 终审全部随 `5ed3dc0` 入档；工作树净。
2. **归档 head `5ed3dc0` 无自身 CI run（观察项，非缺口）**：本 commit 为 merge 后
   的纯证据归档（业务面/CI 配置零字节，F2），被审业务字节与已绿 merge commit
   `4ad13a3`（run `35666189272` success）逐位同一（F7）；归档增量不可能影响任何
   CI 门。登记为口径说明，不要求补跑。
3. **设计文本滞后一行（SA8 RA1''，wiki 内务，Controller/SA1 持有，状态不变）**：
   设计 §7 D7 `namespaceFrame` 行字面补正 + 附录 A2 β 措辞对齐；不影响任何验收
   载体字节。
4. **SA4 MINOR ×5 / SA9 MINOR 存续项（非阻断，全在册）**：O14–O16（头注授权出处
   括注精度 / `hub-session.ts:49` 既有格式 / 被拒中间态未归档）——O14 归因口径已
   由 SA6 §12.6 分列收口；O17–O18（O17 本轮闭合，O18 登记口径）；SA9 §8-N1/N2/
   N4/N5/N6/N7 存续登记。
5. **承接前轮在册登记项（状态不变，均非本票验收面）**：反空跑锚替换登记（SA3
   Deviation 3）；夹具「载体提交」机制替换登记（SA3 Deviation 1，待设计 D7 文本
   补正，同 §7-3）；U2 真 worker 形态未解（明示非目标，PR 不得声称已解决）；服务
   轨/宿主接线/peer 侧拆分/跨进程 revoke = 后续票；观测边界 R6/R7/R11/R12 与夹具
   头注保真度清单；公共 host `sessions` 表无删除路径（SA4 O4）；
   `artifacts/sa6-issue420-*-probe.mts` 陈旧旧名（不在任何 include 面，F9 复证）；
   夹具头注 `MAX_EARLY_FRAMES` 指针陈旧（SA8 RA3，非门禁）；SA8 RA5'/RA5''/RA2/
   RA3 跨票账（`sendQueueMs` 穿透公共缝须重过 SA8；内部缝测试迁移公共工厂 = 决策
   变化；父 head 再前移须复认——本轮父 head 已复认至 `4ad13a35`，F1）。
6. **issue 正文 AC 复选框未勾选（观察项）**：issue #420 以复选框未勾态关闭（本轮
   亲取 body 原文）；五项 AC 的实质满足由本报告 §1–§5 与 CI 终证承载，勾选态为
   issue 跟踪面形式，不构成验收缺口。

## 8. 结论

Issue #420 交付的**最终 post-rebase 形态**（HEAD `5ed3dc0`，父 = Parent PR #416 当前
head `4ad13a35`，纯 CI 修复证据归档增量）对五条 AC **全部满足且无部分实现**：交付
本体（`4e5ff0a`）与 CI 修复（`2c87b3b`）字节经 sha256 冻结锚、blob 过继与 merge-tree
同一性三重绑定，全部验证证据（本地红绿实验 + CI 双 run 绿 + merge 树同一）随本轮
归档 commit 完整入档；归档增量对业务面、规范文本、CI 配置零字节；前轮唯一存续归档
形式项已闭合；无新增未达成项；范围扩展经 SA8 两轮收编，无 scope creep；Owner 评论
面为空且本轮三端点亲取复核。残余项全部为非阻断登记/归档/观察项（§7）。无任何关键
AC partial/unmet/unachievable。**最终就绪确认：approve**。
`requiresConflictRecheck: false`（承接 SA8 CI 修复轮实施复查闭合；本轮归档增量未触
及任何决策面，未发现新的决策冲突面）。

## 附：artifactPaths（worktree-relative）

```text
wiki/raw/task_issue-420_sa10_spec.md
```
