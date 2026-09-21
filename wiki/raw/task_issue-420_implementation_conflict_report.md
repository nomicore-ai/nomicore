# SA8 Conflict Report — issue #420（implementation 复查：父基前移后二段 rebase 路线终认，新权威基 25c51cd）

派工 `sa-6c98f063-d999-4099-be3a-03aa36ca082d`（role `mabf-sa8`，phase conflict-gate，iteration 5）。派工明文：Owner requirements = none；Issue comments REST snapshot = `[]`（本轮 `gh api …/issues/420` 亲验 `{"state":"open","comments":0}`）。被审对象 = **父基前移后的二段机械 rebase 路线**：前轮终认的路线已被 Controller 执行落地（交付 `a315e70` 已重放为 `9d2500d`（父 `1f5809b`，携登记并集 blob `08fa49a1`）+ 证据归档 commit `52a9e56`），其后权威父 PR #416 head 前移至 **`25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df`**（父侧时间 2026-09-22 05:49:26+0800，晚于本侧归档 05:42:26+0800 约 7 分钟——「prior final review 后前移」成立）。本轮职责：对前移父基与二段路线的全部事实**独立重取**（不采信 SA3/SA4 自述），裁决路线与新决策集基线的相容性并枚举重验面。本轮零 rebase 执行、零测试运行、零 commit/push/finalize；除本报告（SA8 唯一产物、原位更新职责）外不改任何被审对象、代码、证据或决策文档（工作树对 `docs/`+`CONTEXT.md` 零 diff 亲验）。

## 1. Reviewed subject: implementation（父基前移 → 25c51cd 的二段 rebase 路线，approved delivery 谱系）

裁决问题：(a) 新父基权威性与拓扑（merge-base 是否仍 `1f5809b`）；(b) 新冲突面是什么、旧「手工写并集 blob」配方是否仍适用；(c) 交付 × 父增量的重叠文件 auto-merge 是否双侧语义俱在；(d) 父增量自带的决策/协议演进（#423）是否改变本交付的冲突面或留下未偿修订；(e) 已归档五门证据的树绑定地位与重取增量；(f) 路线是否触碰冻结面或产生新决策面。

## 2. Inputs and decision set

- 决策集（本轮全量复核）：`docs/adr/` 31 文件（0001–0030 + 0032）全 **accepted、零 superseded**（grep 0 命中亲验）；父增量 `1f5809b..25c51cd` 对决策集的触碰 = 仅 `docs/adr/0032-*.md` 追加 1 行「决策 5 观测面落地注记（issue #423）」（明文「决策 1–5 与否决备选原文零改动」）+ `docs/protocols/instance-replication-v1.md` 19 行 append-only 注册（§17 分片计数口径、§23.1 `update-sent` 发射点注记（字段集零变化）、§23.1 发射侧归属表 + 形态差异登记、验收资产锚）——父侧演进自带完整修订且经其自有 SA8 链闭合（`wiki/raw/task_issue-423_implementation_conflict_report.md` 在父树在册，三项触发面全闭合、recheck false）。本轮相关条款：**ADR 0032**（后果节 :41–43 公共面 append-only；#420 澄清附录 :32；#423 决策 5 注记 :68——合并树内并存）、`packages/ws-replication/AGENTS.md:18`（公共 API 只经 `src/index.ts`）、#418 冻结导出表 exact-equality、协议 `instance-replication-v1.md` 冻结面（本轮零触碰，仅作边界与基线）。
- 事实核验（全部本轮亲验，非采信自述）：
  1. **父基权威性（三通道）**：REST `pulls/416` = OPEN / merged false / headRef `spec/415-replication-transport-decoupling`（首次调用 headRefOid 瞬态 null，已以同资源 `head.sha` 字段复核）；GraphQL `headRefOid` = `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df`；本地 fetch 后 `origin/spec/415-replication-transport-decoupling` 同值——三通道一致，与派工明文逐位相同。
  2. **父增量**：`1f5809b..25c51cd` = 2 commit（`7333f35` #423 observer emission split；`25c51cd` merge PR #428），23 路径、+4244/−45：决策文本 2 文件（上述）；代码 6 文件（`hub-edge-host.ts` 9 / `hub-edge.ts` 118 / `hub-namespace.ts` 63 / `hub-session.ts` 15 / `hub-split.ts` 25 / `update-channel.ts` 39）；新测试 3 文件（issue423 三件，合计 1961 行）；#423 wiki 全套 + 1 证据 log。`src/index.ts` **不在增量内**。
  3. **本侧谱系**：HEAD = `52a9e56`（chore: archive issue 420 verification evidence，父 `9d2500d`）；`9d2500d` = 已重放交付（父 `1f5809b`），其 `packages/ws-replication/src/index.ts` = **登记并集 blob `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`**（ls-tree 亲验）；`merge-base(52a9e56, 25c51cd)` = `1f5809b` ⇒ 二段 rebase 拓扑干净（`git rebase --onto 25c51cd 1f5809b <branch>` 重放恰 2 commit）。
  4. **新冲突面（双层 merge-tree 亲验）**：交付级（base `1f5809b`、ours `25c51cd`、theirs `9d2500d`）⇒ 树 `7b5c1cbc…`，RC=0，**零冲突**；全 tip 级（theirs `52a9e56`）⇒ 树 `2cee6d03…`，RC=0，**零冲突**。旧唯一冲突文件 `src/index.ts` 因父侧未触碰而**原样过继**（合并树内 blob rev-parse = `08fa49a1…` = `9d2500d` 值，逐位相同）⇒ 旧「merge-file 手工写并集」配方**作废**（无冲突可解）。
  5. **重叠文件 = 恰 3**（`docs/adr/0032-*.md`、`hub-session.ts`、`hub-split.ts`），hunk 互不交叠，auto-merge 双侧保留（合并树内容亲验）：ADR 0032 = #420 附录（:32）+ #423 注记（:68）并存；`hub-session.ts` = #420 Sink 改名（`HubSessionSinkConfig`/`HubSessionSinkImpl`/`createHubSessionSink`）+ #423 记账透传（:61–63 三参箭头、:211–222 `sendData` 可选参与 `port.sendDataFrame` 传递）俱在；`hub-split.ts` = #420 三工厂头注 + #423 `HubSendAccounting`（:70）与 `sendDataFrame(frame, accounting?)`（:95）俱在。
  6. **缝签名交互**：#423 对内部缝 append 可选参（`HubSessionEdgePort.sendDataFrame` + `HubSendAccounting` 纯 JSON 投影；明文不进 `src/index.ts`/`src/testing.ts`，少参实现恒可赋值，其 SA8 以 typecheck exit 0 闭合）；#420 侧 port 实现为单参（`hub-session-host.ts:184`、`test/issue420-shim-hub.ts:440`）⇒ 结构化合法；垫片 import 面 = `hub-edge`/`hub-namespace`/`hub-session-host`/`hub-session`/`hub-split`/`defaults`/`validate`/`types`——对 #423 改动后模块的编译/运行由 RA2' 重取证明（本轮不运行测试）。
  7. **证据 × 增量路径**：`52a9e56` 的 20 归档路径 × 父增量 23 路径 = **零交集**（comm 亲验）⇒ 归档 commit 重放零冲突、顺序无关；M3 闭合随谱系原样过继。
  8. **工作树现状**：2 份未入档报告编辑（`wiki/raw/task_issue-420_sa10_spec.md`、`task_issue-420_sa9_standards.md`，+261/−274）——归档后的活性编辑，与父增量零路径交集；rebase 前须 commit 或 stash（操作前置，非冲突面）。
  9. **环境注记**：本地 commit-graph 存在陈旧条目（fetch 对 `860729c` 报 commit-graph 缺对象）——分析所需对象全部在库（双层 merge-tree 全树运算成功），不影响本轮结论；建议 Controller 侧 `git commit-graph write` 重建后作业。
  10. **override 通道**：Issue #420 open、comments = 0（REST 亲验，与派工明文 `[]` 同口径）；本路线无新 ADR、无协议升级 ⇒ 无 override 被援引（§4）。
- 缺失输入：无。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（二段 rebase 路线） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 父基权威性：Issue #420 Parent = PR #416 | `task_issue-420.md` :11–13 | 新权威基 = `25c51cd…`（REST `head.sha` + GraphQL `headRefOid` + 本地 ref 三通道一致，OPEN 未合并）；merge-base 仍 `1f5809b` ⇒ 二段 rebase 是把已执行交付谱系置于新权威基的唯一机械路线 | **no-conflict**（谱系事实，无决策面变化） | §2-1/§2-3 | RA1'（父 head 再前移即停） |
| 2 | ADR 0032 后果节：公共导出面 append-only | :41–43 | `src/index.ts` 不在父增量 ⇒ 登记并集 blob `08fa49a1…`（13 值导出、双工厂同列）**零重算零手工原样过继**；rebase 后 blob 同一性可机核（rev-parse 相等） | **no-conflict** | §2-4 blob 逐位相等 | RA1' 落地核对 |
| 3 | ADR 0032 双注册并存（#420 澄清附录 × #423 决策 5 注记） | 合并树 :32 / :68 | 两侧均 append-only 登记、决策 1–5 原文双侧零改动；合并后并存（内容亲验）；#420 附录（denied/throw 不过公共缝、edge 处置；发射点 = 事实所有者）与 #423 归属表（连接域在 edge、namespace 域在 session）**同原则正交、无互斥** | **no-conflict** | §2-5 | 无 |
| 4 | 协议 §23.1 事件词汇/字段集冻结面 | `instance-replication-v1.md` §17/§23.1 | 父侧注册全部 append-only（字段集零变化、型/码/键零新增），经其自有 SA8 闭合；本路线对协议**零触碰**，冻结面按 `25c51cd` 形态原样承接——基线移动转化为重验义务而非冲突 | **no-conflict** | §2-2 | RA2' |
| 5 | #423 内部缝签名 append × #420 工厂/垫片 port 实现 | `hub-split.ts` :70/:95 | #420 单参实现（`hub-session-host.ts:184`、shim:440）经结构化兼容合法；记账投影为纯 JSON（AC4 缝纯度不变）；`sendQueueMs` 经 #420 公共缝整键缺席形态**已由 #423 注册为合法 dormant**——非冲突，属重验事实 | **no-conflict** | §2-6 | RA2'（行为证据）+ RA5 登记 |
| 6 | #418 冻结导出表 exact-equality | 契约测试 :144–157/:552 | `index.ts` 与契约测试均不在父增量 ⇒ 13 项表 / 13 值导出维持逐名一致（blob 同一性已核） | **no-conflict** | §2-4 | RA2' 落地核对 |
| 7 | `packages/ws-replication/AGENTS.md`：公共 API 只经 `src/index.ts` | :18 | 新路线零手工触碰任何文件；父侧 `HubSendAccounting` 明文不进公共面；#420 公共面载体 `hub-session-host.ts` 不受增量影响 | **no-conflict** | §2-2/§2-6 | 无 |
| 8 | 证据归档义务（SA9 §10-M3）× 路线顺序 | `52a9e56`（20 路径已入谱系） | M3 闭合由 `52a9e56` 承载并随 rebase 原样过继（20×23 零交集、顺序无关）；工作树 2 份未入档报告编辑由 Controller 先 commit/stash——账目延续，非门禁回退 | **implements-existing-decision** | §2-7/§2-8 | RA6' |
| 9 | 五门树绑定规则（pre-rebase 证据对新树不构成验证事实） | SA6 §12 冻结纪律的树绑定推论 | 已归档全部门证据绑定 `1f5809b` 基树 ⇒ 对 `25c51cd` 基树不闭合；重取增量枚举：包套件文件数预期 **87 → 90**（#423 三测试文件）、根 typecheck 须覆盖缝签名 × #420 编译面、契约 13/13 与双 test-d 断言面不变、AC3 矩阵于 #423 改动后的 src 之上重跑为**决定性证据** | **implements-existing-decision** | §2-2/§2-6 | RA2' |
| 10 | 机械解纪律（旧并集配方 vs 新零冲突面） | 历轮 RA1/RA4 配方 | 新 head 下双层 merge-tree 零冲突 ⇒ 「手工写并集 blob」配方**作废**；唯一合法路线 = 纯 rebase 零手工消解；实际出现任何冲突/手工编辑即与预演不符，回 SA8 | **no-conflict**（防陈旧配方误用而登记） | §2-4 | RA1'/RA4' |

裁决分布：**no-conflict ×8（行 1–7、10）、implements-existing-decision ×2（行 8–9）、evolution-required ×0、hard-conflict ×0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |
| — | — | — | — |

- 无 Owner 评论（派工明文 none；本轮 REST 亲验 comments=0、issue open）⇒ 无覆盖通道被援引。
- 无新 ADR、无协议版本升级、无决策自含演进条款被本路线触发。
- 父侧 #423 的 ADR/协议演进 = 父分支自有权威链（PR #428 + 其 SA8 闭合），非本被审对象援引的 override；本路线对其只承接不修订。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（本轮亲验） |
| --- | --- | --- | --- |
| wire 格式/消息码/错误码/事件词汇/事件字段集 | 协议 §4–§6/§13/§14/§23.1；ADR 0032 决策 4 | 父侧注册明文 append-only（字段集零变化）；路线零触碰 | 符合（按 `25c51cd` 形态原样承接） |
| #418 R8'' DENY 面（`hub-namespace.ts`/`hub-edge.ts`/`hub-split.ts`/`src/testing.ts`/7 矩阵断言体） | #418 R8'' | 父侧改动经 #423 自有链；本路线对这些文件零手工改写（交付既有改动 auto-merge 过继） | 符合（路线侧零新增改写；#423 侧属父权威演进，非本对象裁决面） |
| 公共导出面 append-only（13 值导出双工厂） | #418 冻结表 + ADR 0032:41–43 | blob `08fa49a1…` 原样过继 | 符合（rev-parse 相等；rebase 后落树核对归 RA2'） |
| SA6 §12.1 冻结公共签名（工厂/句柄/信号） | test-d 双锁 | 路线不改签名面；父侧公共面零导出 | 符合（= HEAD） |
| listen 模式行为 + admission 语义 | ADR 0032:4；协议 §17 | 父侧 EM-C6a/b 回归锚明文 listen 零变化；路线零触碰 | 符合（= HEAD；重跑归 RA2'） |
| 决策/规范文本完整性 | `docs/AGENTS.md` 修订纪律 | 双侧 append-only 注册并存；本轮工作树对 docs/+CONTEXT.md 零 diff | 符合 |

## 6. Evolution requirements

**无新增。** 本轮被审对象（父基前移后的二段机械路线）不改变任何契约：零冲突面、零手工消解、`index.ts` 并集原样过继均落在 ADR 0032 已授权 append-only 面之内；无 wire/schema/持久化/状态机/生命周期/失败语义/版本涉及。父侧 #423 的协议/ADR 演进**已随父分支完整落地并闭合**（修订文本即父树在册注册本身），本交付无互斥文本、无未偿修订义务（iteration 0 的 E1/E2 线由 `9d2500d` 携带闭合，合并树 :32 附录与 CONTEXT 词条亲验在册）。

## 7. Hard conflicts

**无。** 特别核对并排除：(a) `index.ts` 零冲突 ≠ 并集丢失——blob 逐位过继（§2-4）；(b) 三重叠文件 auto-merge ≠ 语义丢失——双侧 hunk 内容合并树亲验俱在（§2-5）；(c) #423 缝签名扩展 ≠ 破坏 #420 冻结面——append-only 可选参、公共面零导出、少参恒可赋值（§2-6）；(d) 父基前移 ≠ 路线失效——新冲突面零、旧配方作废但机械性保持（§2-4）；(e) 决策集基线移动 ≠ 未偿修订——父侧演进自带闭合修订，#420 附录/词条与 #423 注册正交无互斥（§3-3/§3-4）。

## 8. Required actions

| # | 行动（精确要求） | 责任面 | 门禁 |
| --- | --- | --- | --- |
| RA1' | **二段 rebase 配方（零冲突预演钉死）**：前置——先 commit 或 stash 工作树 2 份未入档报告编辑（§2-8）；然后 `git rebase --onto 25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df 1f5809b001c984e63fac3bafd4c1f3febc76e8a8 <branch>`（重放恰 `9d2500d`+`52a9e56` 两 commit）。**预期零冲突零手工消解**（本轮双层 merge-tree RC=0：交付级树 `7b5c1cbc…`、全 tip 树 `2cee6d03…`）——实际出现任何冲突即停、与预演不符回 SA8；禁止按已作废旧配方手工写 blob、禁止顺手改动。落树后机核 `packages/ws-replication/src/index.ts` blob = `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`。**父 head 若再前移（≠ `25c51cd`）：停止，先 merge-tree 复认冲突面** | 交付执行者（Controller） | 阻断交付合并 |
| RA2' | **五门在新基树重取（树绑定规则承接）**：#418 契约 exact-equal + #420 三契约、双 test-d（#420 session host API + #421 edge factory API）、包全量（文件数预期按 `25c51cd` 基线重算 = 87 + #423 三测试文件）、根 typecheck（15 tsconfig，须覆盖 #423 缝签名 × `hub-session-host.ts`/`issue420-shim-hub.ts` 编译面）、AC3 矩阵逐字重跑（shim 53 + 7 文件 listen 52，于 #423 观测发射拆分后的 src 之上——#420×#423 行为交互的决定性证据；`sendQueueMs` 经 #420 公共缝整键缺席按 #423 注册 dormant 形态核销）。**明文**：`9d2500d`/`52a9e56` 已归档全部门证据绑定 `1f5809b` 基树，不闭合本门 | 交付执行者（SA4/SA7 证据链落盘 `artifacts/`） | 阻断交付合并 |
| RA3 | 卫生项（承接，非阻断）：shim 夹具头注 `MAX_EARLY_FRAMES` 先例指向改 `hub-upgrade-admission.ts`；常数值 16 不得动 | 交付执行者 | 非门禁 |
| RA4' | 专家路由裁决（条件触发，触发条件随新面更新）：① rebase 实际出现冲突或需任何手工消解（与零冲突预演不符）；② 触碰缝类型/wire/公共签名；③ #420×#423 需新组合语义立项（如记账投影纵贯公共 byte 缝的显式契约）；④ 父 head 再前移未复认即解。（旧「偏离并集 blob」触发条件随配方作废移除） | Controller | 条件触发 |
| RA5' | 账本存续（承接 + 新增登记）：#421 O5（T5 边界清单）、γ 真 worker 形态重门禁、公共面 append-only（双工厂）；**新增**：#423 记账投影已授权 append-only 纵贯内部缝（纯 JSON）；后续票若要把 `sendQueueMs` 穿透 #420 公共 byte 缝，属既有授权面的实现票，签名变化须重过 SA8 | 后续票 | 跨票账 |
| RA6' | **归档落账口径（M3 存续 + 追加）**：M3 闭合仍以 `52a9e56` 的 20 路径入谱系为准（随 rebase 原样过继，不回退）；本轮 2 份未入档报告编辑（sa10/sa9）+ 本报告更新由 Controller 以追加归档 commit 落账（commit 前后 `git diff --cached --check` 须 RC=0） | Controller | 阻断 finalize（归档口径门） |

## 9. Verdict

**`clear`**。

- 10 项对照：8 no-conflict、2 implements-existing-decision、0 evolution-required、0 hard-conflict、0 override。
- **新父基终认**：PR #416 OPEN 未合并、head `25c51cd…`（REST + GraphQL + 本地 ref 三通道）；父增量 = #423 observer emission split（决策/协议演进 append-only 且经其自有 SA8 闭合）；merge-base 仍 `1f5809b`，二段 rebase 拓扑干净。
- **零冲突面终认**：双层 merge-tree RC=0（交付级 `7b5c1cbc…` / 全 tip `2cee6d03…`）；`index.ts` 并集 blob `08fa49a1…` 原样过继；三重叠文件双侧语义俱在；20 归档路径 × 23 增量路径零交集。旧手工并集配方作废，RA1'–RA6' 全要素更新，无新决策面。
- 本轮不评价测试充分性与验收完成度（SA4/SA7/SA10 职责）；五门树绑定地位按 §3-9 定界。

## 10. requiresConflictRecheck

**true**（窄域，与历轮同口径）。依据：skill 判据「公共 API……尚待实现核对」成立——五门（含 `index.ts` 并集公共面、#420×#423 缝交互的行为证据）**尚未在 `25c51cd` 基树的重放谱系上落地并核对**（RA1'/RA2' 待 Controller 执行）；本轮被审面（父基前移事实 + 二段路线）无独立 recheck 面，其核对并入 RA6'（归档落账）与 RA2'（树绑定重取）。解法按 RA1' 零冲突落地且五门绿、归档落账后即闭合（形式核对）；若 rebase 实际出现冲突、触碰 RA4' ②③ 面、父 head 再前移未复认即解、或归档 commit `--check` 非零，则按触发条件进入新一轮 SA8。
