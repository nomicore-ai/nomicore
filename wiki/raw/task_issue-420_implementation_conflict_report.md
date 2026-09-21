# SA8 Conflict Report — issue #420（implementation 复查第八轮：权威父基 #416 + #420 修复交付机械 rebase 路线终认）

派工 `sa-5a3428ed-5484-4320-91db-29394ae8b83a`（role `mabf-sa8`，phase conflict-gate，iteration 2）。派工明文：Owner feedback requirements = none；REST comments = `[]`（本轮 `gh api …/issues/420` 亲验 `{"state":"open","comments":0}`）。被审对象 = **已批准 #420 修复交付（repair delivery）的权威父基确认与精确机械 rebase/冲突消解路线**：父 PR #416 当前 head、分叉/冲突面、`packages/ws-replication/src/index.ts` 纯并集解 blob、20 路径证据集 × 父增量重放顺序、RA2 五门的树绑定地位。交付本体 `a315e7077576951cf0330596cdc588afbeca51be`（父 `7039f6d`）零改动（本轮 `git diff HEAD --stat -- packages apps domains docs tests scripts CONTEXT.md .editorconfig vitest.config.ts package.json tsconfig*` 全空亲验；reflog HEAD@{0} = `a315e70`，交付后零 commit 零 rebase 零 push）。前轮账（不堆叠为当前结论）：iteration 0 = 7039f6d 工作树实现复查（clear，E1/E2 修订线由交付闭合）；rebase 就绪终认 iteration 1–6 + 证据归并第七轮（均 clear，RA1–RA6 配方已落账）。本轮职责：对全部 rebase 事实**独立重取**（不采信 SA3/SA4 自述）并裁决路线与决策集的相容性；本轮不执行 rebase、不修改任何被审对象与决策文档、不运行测试、不 commit/push/finalize。

## 1. Reviewed subject: implementation（权威父基 + 机械 rebase 路线，approved repair delivery）

裁决问题：(a) 当前权威父基是否仍为 `1f5809b001…`（REST/fetch 双通道复核）；(b) 唯一冲突 `src/index.ts` 的纯并集解 blob `08fa49a1…` 是否为本轮独立重算所复现、是否唯一机械解；(c) 20 路径证据集与父 31 路径增量的重放顺序是否零冲突面；(d) RA2 五门在 pre-rebase 证据上的树绑定失效规则是否被路线如实承接；(e) 路线是否触碰任何冻结面或产生新决策面。

## 2. Inputs and decision set

- 决策集（本轮全量复核）：`docs/adr/` 31 文件（0001–0030 + 0032；0031 编号由 PR #403 占用后改号 0032，commit `27e012b` 在册）全 **accepted、零 superseded**（grep 0 命中）；父增量 `7039f6d..1f5809b` 对 `docs/adr/`+`docs/protocols/` **零变化**（本轮 `git diff --stat` 亲验 0 行）；本轮工作树对 `docs/`+`CONTEXT.md` 零 diff。本轮相关条款：**ADR 0032**（后果节 :41–43 双工厂轨道与公共面 append-only 冻结纪律——并集解的唯一裁决源；交付携带的澄清附录 HEAD :32 在册）、`packages/ws-replication/AGENTS.md:18`（公共 API 只经 `src/index.ts`）、#418 冻结导出表（契约测试 :144–157/:552 exact-equality 断言）、协议 `docs/protocols/instance-replication-v1.md`（wire/错误码/事件词汇冻结面——本轮零触碰，仅作边界）。
- 事实核验（全部本轮亲验，非采信自述）：
  1. **父基 REST**：`pulls/416` = state OPEN / merged false / mergedAt null / headRef `spec/415-replication-transport-decoupling` / **headRefOid `1f5809b001c984e63fac3bafd4c1f3febc76e8a8`** / mergeable true——与历轮登记值逐位相同，父基未移动。
  2. **本地 ref**：fetch 后 `origin/spec/415-replication-transport-decoupling` = `1f5809b001…`（与 REST 一致）。
  3. **分叉与冲突面**：merge-base = `7039f6dae8e7d29f0c929492f0ca2119bc63afaa`；分叉 1（交付 `a315e70`）vs 4（父侧 `f40d016`/`ed54f56`/`6c9d240`/`1f5809b`）；全 OID 形 `git merge-tree --write-tree 1f5809b001… a315e7077…` ⇒ 树 `a24156e2d84d4f7a94bbe03e0db20f07ed2c4562`，**恰 1 文本冲突** `packages/ws-replication/src/index.ts`（stage 1/2/3 = `977bd3d`/`7e2f746`/`71fc417`）；`CONTEXT.md`/`hub-connection.ts`/#418 契约测试 auto-merge 干净——与历轮逐位相同。
  4. **纯并集解独立重算**：以 stage blob 亲跑 `git merge-file --union`（ours = 父 `7e2f746`、theirs = 交付 `71fc417`，即 rebase 方位：上游在前、被重放提交在后）⇒ blob **`08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`**（2872 B / 95 行），与 SA3 `finalize-rebase-evidence.log` §6 登记值**逐位相同**；反方位交错（交付块在前）= `2e23e39e…` ≠ 登记值 ⇒ 登记blob = rebase 方位的确定性并集，非任意选择。base→union diff = 恰 4 个纯增 hunk（交付头 +1 行工厂导出、父头 +3 行注释+工厂导出、尾部父类型块 +13 行、尾部交付类型块 +10 行——其中两块相邻的重复空行并一，**零内容行丢失、零基线行改写/重排/删除**）。
  5. **并集面 census**：值导出 13 = 基线 11 + `createHubSessionHost` + `createHubReplicationEdge`；类型面 = 基线 types.js 全集 + 8 edge 名 + 7 session 名。auto-merge 后契约测试（树 `a24156e…` 内）的 `FROZEN_PRODUCTION_EXPORTS` = **13 项且双工厂同列**（:151 `createHubReplicationEdge`、:153 `createHubSessionHost`）⇒ 并集 `index.ts` 面与 exact-equality 断言逐名一致。
  6. **并集 blob C1 卫生**：trailing-ws = 0、CR = 0、末字节 = `;` + 恰一 `\n`——满足 `.editorconfig [*]` 规范形。
  7. **证据集 × 父增量**：20 路径 staging 集（= 本轮 `git status --porcelain -uall` 全集，逐一比对 IDENTICAL：3 tracked-modified（本报告/sa3_impl/sa4_review）+ 17 untracked）vs 父 31 变更路径 ⇒ **零交集**（comm 亲验）⇒ 证据归档 commit 在 rebase 前或后重放均零冲突，`src/index.ts` 冲突仅来自交付 commit 重放。
  8. **执行边界**：真实 index 零 staged（`git diff --cached --stat` 0 行）；reflog HEAD@{0} = `a315e70`（交付后无 commit）；`git stash list` 空——SA3 只记录配方（`finalize-rebase-evidence.log` §6/§10/§11），rebase/commit 执行权在 Controller。
  9. **override 通道**：Issue #420 open、comments = 0（REST 亲验，与派工明文 `[]` 同口径）；无新 ADR、无协议版本升级 ⇒ 无合法 override 被援引（§4）。
- 缺失输入：无。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（rebase 路线） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ADR 0032 后果节：公共导出面发布即冻结、演进只能 append-only | :41–43 | 冲突消解 = 纯并集：两侧各自的 append-only 追加（#421 的 `createHubReplicationEdge`+8 类型、#420 的 `createHubSessionHost`+7 类型）全保留，基线 11 值导出与 types.js 面零改零删零重排 | **implements-existing-decision**（路线 = append-only 纪律跨两次交付的字面机械应用） | ADR 0032:43；本轮 §2-4 base→union 4 增 hunk | RA1 |
| 2 | #418 冻结导出表 exact-equality 断言 | 契约测试 :144–157、:552 | 并集面 13 值导出 = auto-merge 后表 13 项逐名一致（双工厂同列）；两侧单侧表（父 12 含 edge、交付 12 含 session）各为并集子集 | **no-conflict** | 本轮 §2-5；`a24156e…` 树内表 :144–158 | 无 |
| 3 | `packages/ws-replication/AGENTS.md`：生产 API 只经 `src/index.ts` | :18 | 路线唯一手工触碰文件即 `src/index.ts`（公共入口本体）；auto-merge 区零手工改写 | **no-conflict** | AGENTS.md:18；本轮 §2-3 冲突面恰 1 文件 | RA1（零手工改写纪律） |
| 4 | 父基权威性：Issue #420 Parent = PR #416（spec #415 ADR 0032 承载） | `task_issue-420.md` :11–13 | 权威基 = 父 head `1f5809b001…`（OPEN 未合并）；交付谱系 `a315e70 ← 7039f6d`（merge-base）⇒ rebase 到 `1f5809b` 是把修复交付置于权威基的唯一路线 | **no-conflict**（机械谱系事实，无决策面变化） | 本轮 §2-1/§2-3；REST 亲验 | 父 head 前移即停（RA1） |
| 5 | 决策/规范文本完整性（`docs/adr/**`、`docs/protocols/**`、`CONTEXT.md`） | `docs/AGENTS.md` 修订纪律 | 父增量对 adr/protocols 零变化；路线只落 `src/index.ts` 并集 + 证据归档 ⇒ 决策文本零触碰 | **no-conflict** | 本轮 §2-1/§2-3 | 无 |
| 6 | `.editorconfig [*]` + git whitespace 强制门 | 三规则；`git diff --check` | 并集 blob C1 全清（trailing-ws 0 / CR 0 / 末恰一 LF）；相邻空行并一为空白级合并，无内容行丢失；冻结表断言按名不按字节 | **no-conflict** | 本轮 §2-6；`.editorconfig` | 无 |
| 7 | 证据归档义务（SA9 §10-M3）× rebase 执行顺序交互 | SA9 standards :183；第七轮 RA6 | 20 路径 = 全 git status；与父 31 路径零交集 ⇒ 任意顺序重放零冲突；staging/commit 仍归 Controller | **implements-existing-decision**（M3 归档集就绪 + 顺序无关性经本轮独立比对成立） | 本轮 §2-7 | RA6 |
| 8 | 动态证据树绑定规则（pre-rebase 证据对 rebase 后树不构成验证事实） | SA6 §12 冻结纪律的树绑定推论（第七轮 §3-9 已裁） | `finalize-rebase-evidence.log` §8/§9 dry-run 与 V17–V21 均明文登记为 pre-rebase 证据，不闭合 RA2；§11 五门重取清单在册 | **implements-existing-decision**（既有门禁的树绑定纪律被路线如实承接） | log §11；第七轮 §3-9 | RA2 |
| 9 | 冻结面全集（wire 格式/错误码/事件词汇/路由键/`hub-namespace.ts`/`hub-edge.ts`/`hub-split.ts`/`src/testing.ts`/7 矩阵断言体/listen 行为/SA6 §12.1 签名） | 协议 §4–§6/§13/§14/§23.1；#418 R8''；ADR 0032:4 | 路线改动面 = `src/index.ts` 并集（公共导出面 append-only 之内）+ 证据归档路径；一切业务面字节 = HEAD，wire 零触碰 | **no-conflict** | 本轮 §2-3/§2-7；交付本体零改动亲验 | RA2 落地核对 |
| 10 | 机械解唯一性纪律（偏离纯并集 = RA4 专家路由触发②） | 第七轮 RA4 四触发条件 | rebase 方位并集 = `08fa49a1…`（确定性）；反方位交错 `2e23e39e…` ≠ 登记值 ⇒ 登记blob 方位正确且唯一；改名/重排/顺手清理均越界 | **no-conflict**（登记防误读：唯一合法解已由本轮独立重算钉死） | 本轮 §2-4 | RA4（触发条件不变） |

裁决分布：**no-conflict ×7（行 2/3/4/5/6/9/10）、implements-existing-decision ×3（行 1/7/8）、evolution-required ×0、hard-conflict ×0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |
| — | — | — | — |

- 无 Owner 评论（派工明文 none；本轮 REST 亲验 comments=0、issue open）⇒ 无覆盖通道被援引。
- 无新 ADR、无协议版本升级、无决策自含演进条款被触发。
- 纯并集解 = ADR 0032 append-only 的字面应用；父基确认 = 谱系事实；五门重取 = 树绑定纪律——均非 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（本轮亲验） |
| --- | --- | --- | --- |
| wire 格式/帧头/消息码/错误码/事件词汇/路由键布局 | 协议 §4–§6/§13/§14/§23.1；ADR 0032 决策 4 | 本轮路线改动面枚举 | 符合（路线零触碰；业务面 = HEAD） |
| `hub-namespace.ts`/`hub-edge.ts`/`hub-split.ts`/`src/testing.ts`/7 矩阵断言体 | #418 R8'' DENY 面 | 同上；auto-merge 区零手工改写纪律 | 符合（唯一冲突文件 = `src/index.ts`） |
| 公共导出面 append-only | #418 冻结表 + ADR 0032:41–43 | 并集 13 值导出 vs auto-merge 表 13 项 | 符合（逐名一致；rebase 后落树核对归 RA2） |
| SA6 §12.1 冻结公共签名（工厂/句柄/信号） | test-d 双锁 | 路线不改签名面 | 符合（= HEAD） |
| listen 模式行为 + admission 语义 | ADR 0032:4 | 路线零触碰 | 符合（= HEAD） |
| 决策/规范文本 | `docs/AGENTS.md` 修订纪律 | 父增量 + 本轮工作树零 diff | 符合（附录/词条仅由交付 commit 携带） |

## 6. Evolution requirements

**无新增。** 本轮被审对象（父基确认 + 机械路线）不改变任何契约：唯一消解文件 `src/index.ts` 的并集落在 ADR 0032 后果节已授权的 append-only 面之内；无 wire/schema/持久化/状态机/生命周期/失败语义/版本涉及。iteration 0 的 E1/E2 修订线（ADR 0032 澄清附录 + CONTEXT 词条）已由交付 commit 携带闭合（HEAD 在册），本轮零 diff 复认，无未偿 evolution 义务。

## 7. Hard conflicts

**无。** 特别核对并排除：(a) 并集解 ≠ 改写 #418 冻结面——两侧 append-only 追加全保留、断言按名成立（§3-2）；(b) 相邻空行并一 ≠ 内容丢失——纯空白级合并，4 增 hunk 之外零 diff（§2-4）；(c) 证据归档顺序 ≠ 新冲突面——20×31 零路径交集（§2-7）；(d) pre-rebase 五门 dry-run ≠ RA2 闭合——树绑定规则覆盖、log §11 如实登记（§3-8）；(e) 父基确认 ≠ 父已合并/前移——REST OPEN/merged false/headRefOid 逐位未动（§2-1）。

## 8. Required actions

| # | 行动（精确要求） | 责任面 | 门禁 |
| --- | --- | --- | --- |
| RA1 | **Rebase 配方（本轮全要素独立复认，方位与 blob 钉死）**：`a315e7077576951cf0330596cdc588afbeca51be` rebase 到 `1f5809b001c984e63fac3bafd4c1f3febc76e8a8`（全 OID 调用形）；唯一冲突 `packages/ws-replication/src/index.ts` 写入**并集 blob `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`**（本轮 `git merge-file --union`（ours=父）独立重算逐位复现；禁用反方位交错 `2e23e39e…`/改名/重排/顺手改动/`--abort`）；其余 auto-merge 区零手工改写。**顺序**：先按 20 路径 commit 证据集（与父 31 路径零交集，重放零冲突——本轮亲验）或 stash 后 rebase 再落；最终分支必须同时携带重放交付 + 证据归档。**父 head 若前移（≠ `1f5809b`）：停止，先 merge-tree 复认冲突面再解** | 交付执行者（Controller） | 阻断交付合并 |
| RA2 | **Rebase 后最终评审重取（承接，树绑定规则生效）**：五门在 rebase 后真实树全绿——#418 契约 exact-equal + #420 三契约、双 test-d（#420 session host API + #421 edge factory API）、包全量（预期 87 文件）、根 typecheck（15 tsconfig）、AC3 矩阵逐字重跑（shim 53 + 7 文件 listen 52）。**明文**：`finalize-rebase-evidence.log` §8/§9 dry-run 与 SA3 V17–V21 均为 pre-rebase 证据，不闭合本门 | 交付执行者（SA4/SA7 证据链落盘 `artifacts/`） | 阻断交付合并 |
| RA3 | 卫生项（承接，非阻断）：shim 夹具头注 `MAX_EARLY_FRAMES` 先例指向改 `hub-upgrade-admission.ts`；常数值 16 不得动 | 交付执行者 | 非门禁 |
| RA4 | 专家路由裁决（承接：不需要；四触发条件不变——偏离纯并集 blob/触碰缝类型或 wire/两工厂直接组合面立项/父 head 前移未复认即解） | Controller | 条件触发 |
| RA5 | 账本存续（承接）：#421 O5（T5 边界清单）、γ 真 worker 形态重门禁、公共面 append-only（现覆盖 `createHubReplicationEdge` + `createHubSessionHost` 两工厂） | 后续票 | 跨票账 |
| RA6 | **归档落账口径（本轮口径更新为 20 路径）**：按 `git add -A --` staging 20 路径（= 本轮 git status 全集：3 modified 报告 + 17 untracked，清单见 `sa3_impl` iteration-2 节）并 commit（建议信息见同处，Controller 定稿）；commit 前后各跑 `git diff --cached --check`（须 RC=0）。**hash 口径注记**：本报告与 `task_issue-420_sa3_impl.md`/`task_issue-420_sa4_review.md` 为活报告，以 commit 时暂存字节为准（SA8 原位更新职责）；`finalize-rebase-evidence.log` §2/§10 的 post-commit hash 期望对其余路径逐字成立。SA9 §10-M3 闭合判据 = 20 路径实际进入交付归档 | Controller | 阻断 finalize（M3 闭合门） |

## 9. Verdict

**`clear`**。

- 10 项对照：7 no-conflict、3 implements-existing-decision、0 evolution-required、0 hard-conflict、0 override。
- **权威父基终认**：PR #416 OPEN 未合并、headRefOid `1f5809b001…` 与历轮逐位相同（REST+fetch 双通道）；分叉 1 vs 4、merge-base `7039f6d`、冲突面恰 1 文件（`src/index.ts`，stage `977bd3d`/`7e2f746`/`71fc417`）——全部独立重取，无漂移。
- **机械路线终认**：纯并集解 blob `08fa49a1…` 由本轮 `git merge-file --union`（rebase 方位）独立重算逐位复现，为该方位确定性唯一解；并集面 13 值导出与 auto-merge 冻结表 13 项逐名一致；C1 卫生全清；20 路径证据集 × 父 31 路径零交集 ⇒ 归档/rebase 顺序无关。RA1–RA6 全要素存续，无新决策面。
- 本轮不评价测试充分性与验收完成度（SA4/SA7/SA10 职责）；五门树绑定地位按 §3-8 定界。

## 10. requiresConflictRecheck

**true**（窄域，与历轮同口径）。依据：skill 判据「公共 API……尚待实现核对」成立——`src/index.ts` 并集后的公共 API 面与 RA2 五门**尚未在 rebase 后的真实树上落地并核对**（RA1/RA2 待 Controller 执行）；本轮被审面（父基 + 路线）无独立 recheck 面，其核对并入 RA6（归档落账）与 RA2（树绑定重取）。解法按配方落地且五门绿、20 路径入档后即闭合（形式核对）；若偏离并集 blob、触碰 RA4 ②③ 面、父 head 前移后未复认即解、或归档 commit 后 `--check` 非零，则按触发条件进入新一轮 SA8。
