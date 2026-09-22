# SA8 Conflict Report — issue #420 CI 修复轮（已提交修复 + CI 修复诊断）实施复查

派工 `sa-92d0a6f4-89c7-4816-8c5d-47ceb2a53f08`（role `mabf-sa8`，phase conflict-gate，iteration 1）。派工明文：Owner comment requirements = none（REST comments returned `[]`）；**Do not modify files**。被审对象 = **Issue #420 的 CI 修复诊断与已提交修复**：(i) 修复 commit `2c87b3b`（`test(ws-replication): update internal splice imports`——两个 #423 消费方测试文件的 D9 机械符号名跟随，+18/−8）及其后继纯文档归档 commit（`3f470fb`/`5a4049d`）；(ii) CI 修复诊断语料 = SA3 iteration 4 报告（已提交）+ SA4 Part C（已提交）+ **SA6 CI 修复轮契约**（`wiki/raw/task_issue-420_sa6_contract.md` 工作树未提交态，派工 `sa-1073bc5f`）；(iii) 修复后执行态（push → 新 head CI → PR merge → issue close）。

本轮全部关键事实独立重取（不采信 SA3/SA4/SA6 自述）：diff 逐行、冻结锚逐项、blob/sha256、CI run 与 PR merge 经 `gh` 亲验、ADR/协议/CONTEXT 决策文本逐条。本轮零测试运行、零 commit/push/finalize、零被审对象改动（`packages/` 工作树零 diff 亲验）。

> **产物路径说明**：本技能对实施复查的固定路径 `wiki/raw/task_issue-420_implementation_conflict_report.md` 已由前一轮（派工 `sa-3f300a00`，随 `2c87b3b` 提交）承载且本轮派工明文 **Do not modify files** ⇒ 本报告落为新文件，不原位改写既有报告；是否并入固定路径由 Controller 裁定。前轮裁决（clear / RA1''–RA5''）在其被审字节（与本轮已提交字节 sha256 逐位相同，见 §1）上继续有效，本轮不推翻、只做增量终核。

## 1. Reviewed subject: implementation（CI 修复的已提交形态 + 修复诊断 + 修复后执行态）

| 面 | 事实（本轮亲验） |
| --- | --- |
| 修复 commit 代码面 | `git diff 3f470fb..2c87b3b -- packages/` = **恰 2 文件**：`ws-replication-issue423-{observer-emission-split,sa7-dynamic}.test.ts`；每文件 +5 头注行、2 导入行（`createHubSessionHost, type HubSessionHost`←`hub-session.js` → `createHubSessionSink`←`hub-session.js` + `HubSessionEdgePort, HubSessionSink`←`hub-split.js`）、1 类型标注（`HubSessionHost`→`HubSessionSink`）、1 工厂调用（`createHubSessionHost({`→`createHubSessionSink({`） |
| 已提交字节 = 前轮被审字节 | 两文件现 sha256 = `160565873bf980c0ee1042d699fc9da890ee74743222139097e095a60395681e` / `778d2461f042102725c17bd817327dcccf14b3a53b4f92efa2e728852e0183c` = 前轮 SA8 §1 冻结态锚 = SA6 §5.4 登记值，**逐位相同** ⇒ 前轮对该 diff 的全部裁决直接覆盖已提交形态 |
| 全谱系包面 | `git diff --name-only 3f470fb..HEAD -- packages/` = 恰上述 2 文件；`git diff 3f470fb..HEAD -- packages/ws-replication/src/` 字节数 **0** |
| 修复 commit 其余面 | 仅 `wiki/raw/` 三报告（SA3/SA4/SA8 原位更新）+ `artifacts/sa3-issue420-ci-*.log` ×7——证据/报告，非规范文本；`3f470fb`/`5a4049d` 仅动 `wiki/raw/task_issue-420_{sa9_standards,sa10_spec}.md` |
| 规范文本零触碰 | `git diff 3f470fb..HEAD --stat -- docs/ CONTEXT.md` = **空** |
| 断言纪律 | 两文件 grep `.(skip|only|todo)(`/`xit(` = **0 命中**（exit 1）；census 内无 `describe/it` 名、断言、选择器、阈值、金标常量行 |
| 谱系根因事实 | `4e5ff0a^` = `25c51cd`（PR #428/#423 merge）亲验；两文件 `git log 25c51cd..3f470fb -- <两文件>` = **0 commit** ⇒ 自交付起即为同树 stale 消费方（SA6 根因链 S4 独立复核成立） |
| 修复后执行态 | `2c87b3b` → `5a4049d` push 后 CI run `35665953800`（head `5a4049d`）conclusion = **success**；`gh pr view 429`：state **MERGED**（`4ad13a35`，2026-09-21T23:08:48Z，base `spec/415-replication-transport-decoupling`）；issue #420 state **CLOSED**、comments `[]` |
| 当前工作树 | `packages/` 零 diff；未提交面 = SA6 CI 修复契约（原位重写）+ `artifacts/sa6-issue420-ci-repair/**`（SA6 本轮产物，非本报告改动） |

## 2. Inputs and decision set

- **决策集**（全量 census，本轮复核）：`docs/adr/` 31 文件 = 0001–0030 + 0032。状态：除 0015（`状态：提议`，从未接受，不构成约束）外全部 accepted；无整文件级 superseded（条款级取代——0007 部分（0008）、0016/0024（0027）、0020 §9（0021）——均与本主题面无关）。本主题裁决面：**ADR 0032**（已接受；:32–53 澄清附录（内部缝 × 公共 byte-seam 双载体）、:66 公开面 append-only、:68 #423 决策 5 注记）；ADR 0010/0012/0013/0022/0023（ws-replication 域背景：wire 权威、身份/插件所有权、chunked 键集、冻结服务面构造纪律——修复零触碰）。
- **规范协议**：`docs/protocols/instance-replication-v1.md` §17/§23.1–23.4（事件面/发射归属/字段集冻结）——本轮谱系零字节变化亲验。
- **CONTEXT.md** :225（复制 Edge）/ :229（SessionHost——明文「内部进程内 splice（`createHubSessionSink`）仍以 `openAdmission` 拉取结局」= 双名双轨词汇的在册事实）/ :233（路由键契约）。
- **模块决策**：`packages/ws-replication/AGENTS.md`（"Export production APIs through `src/index.ts`；programmable adapters/test controls 留显式 testing 面"）；根/`docs/AGENTS.md`（wiki/raw = 证据非规范契约）。
- **任务语料**：`wiki/raw/task_issue-420.md`（简报）；`task_issue-420_design.md` §7 D9（:341 重命名表「纯机械」；:413 「#418 两测试文件 = §12.6 授权的两处编辑；其余 75 测试文件零改动」——基线树口径）、§11 DENY LIST（:441）；前轮 SA8 实施复查（committed @`2c87b3b`：clear，RA1''–RA5''）；SA4 Part C（approve，O14–O16）；SA9 终审（approve；§8-N3 = 新 head CI 复跑待 Controller）；SA10 终审（approve，recheck false）；**#423 父侧契约 U4**（`task_issue-423_sa6_contract.md` :248：「本契约以内部缝……建立等价面……待 T3(#420)/T5 落地补运行时锚」）。
- **诊断语料（本轮被审）**：SA3 iteration 4（committed）；SA6 CI 修复轮契约（工作树未提交：K1–K8 门集、§12.4 禁止方向、§12.6 O14 归因收口、附 B 前轮索引）+ `artifacts/sa6-issue420-ci-repair/**`。
- **REST/远端事实**：issue #420 CLOSED、comments `[]`；PR #429 MERGED、comments/reviews `[]`（SA6 `10-rest-comments-snapshot.log` + 本轮 `gh pr view`/`gh run view` 亲验）。
- 缺失输入：无。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（已提交修复 + 诊断 + 执行态） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ADR 0032 公开面 append-only + 双轨边界（内部 splice 缝 × 公共 byte-seam 工厂） | `docs/adr/0032-*.md` :32–53、:66 | 修复零新增/改名/删除导出：`src/index.ts` blob = `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`（HEAD = 交付 `4e5ff0a` 亲验相等；13 值公共导出含公共 `createHubSessionHost`←`hub-session-host.js`）；#423 测试跟随到**内部缝改名后的同一工厂**（非改道公共工厂，config 不同形）——被测面与双轨边界均不变 | **no-conflict** | §1 blob/diff；`src/index.ts:6` | 无 |
| 2 | ADR 0032 :68 #423 注记 + 协议 §17/§23.1–23.4 冻结面 | ADR 0032 :68；`instance-replication-v1.md` | 修复谱系（`3f470fb..HEAD`）对 docs/协议/CONTEXT **零字节**；#423 两文件断言/金标字节零变化（census）⇒ 事件字段集、稳定码、chunked 键集全不动 | **no-conflict** | §1 规范文本零触碰 | 无 |
| 3 | #420 设计 §7 D9 / SA6 U1：内部 splice 重命名冻结（`createHubSessionHost`→`createHubSessionSink`、别名删除、零行为）与消费方跟随义务 | `task_issue-420_design.md` :341/:413；SA6 U1（附 B :394 索引） | 重命名交付时清点面未含随父基前移（`4e5ff0a^`=`25c51cd`）进入本树的两 #423 文件 ⇒ 同树 stale 消费方（0 commit 触碰亲验）；修复 = D9 义务在新浮现消费方上的机械兑现（映射经前轮纯度核验：旧别名→底层接口 `hub-split.ts` `HubSessionSink`，同一类型/同一工厂/同一配置七字段） | **implements-existing-decision** | §1 谱系；前轮 §2-3 纯度核验 | 无 |
| 4 | #423 父侧契约 U4：等价面建在内部缝、「待 T3(#420)/T5 落地补运行时锚」 | `task_issue-423_sa6_contract.md` :248 | 父侧已显式把其内部缝锚从属于 T3 落地；T3 的 D9 落地后父侧测试跟随改名符号 = 该从属登记的机械兑现；父侧冻结面（§23.1 36 型字段表、EM-C7 金标、ADR 0013 键集）字节零触碰 | **implements-existing-decision** | §2 父侧契约引文；§1 census | 无 |
| 5 | #418 结构测试 C0c 冻结锚：`hub-session.ts` 运行时导出面 exact-equality | `…issue418-edge-session-split-structure.test.ts:618`（`toEqual(['createHubSessionSink'])`） | 锚在场且被保持；生产侧别名恢复被该锚决定性封死（恢复即红）——修复正确落在消费方；`hub-session.ts` 现导出面 = `HubSessionSinkConfig`(:32 接口) + `createHubSessionSink`(:299) 亲验 | **no-conflict**（保持冻结面） | §1；structure test :618 亲读 | 无 |
| 6 | 模块 AGENTS 公共面纪律（生产 API 只经 `src/index.ts`；测试控制留显式 testing 面） | `packages/ws-replication/AGENTS.md` Boundaries | 修复零导出面变化；内部深路径消费内部缝 = 与 #418 结构测试、#423 父侧原形态一致的既有实践，未把内部缝测试改道公共面 | **no-conflict** | §1；§2 模块决策 | 无 |
| 7 | 前轮 SA8 RA1''/RA2''（执行形式门：commit/push + 新 head CI 绿 = 形式闭合凭证） | `task_issue-420_implementation_conflict_report.md` §8（committed @`2c87b3b`） | **已兑现并亲验闭合**：`2c87b3b` 已提交 push；新 head `5a4049d` CI run `35665953800` = success（原 5 红作业转绿）；PR #429 MERGED（`4ad13a35`）；issue #420 CLOSED。RA4''① 触发条件（不能归因于两文件 stale 导入的新失败）未发生 | **implements-existing-decision**（义务兑现闭合） | §1 执行态（gh 亲验） | 无（状态登记：RA1''/RA2'' 闭合） |
| 8 | SA6 CI 修复诊断契约（K1–K8 门集、§12.4 禁止方向、§12.6 O14 归因收口） | `wiki/raw/task_issue-420_sa6_contract.md`（工作树版） | 诊断与决策集**同向**：§12.4 禁止方向（恢复生产别名 / #423 测试改道公共工厂 / 断言软化）与前轮 RA4''④ 及本表行 1/5 裁决逐条一致；§12.6 把「重命名授权（D9/U1）」与「跟随先例（§12.6 编辑 2）」分列收口 O14，且**不改已合并字节**（sha256 保持 §5.4 登记值亲验）；契约本体为 wiki/raw 证据（`docs/AGENTS.md`：非规范契约），不创设/修改任何决策 | **no-conflict** | §2 诊断语料；§1 sha256 | 无 |
| 9 | 修复轮改动纪律（零生产 / 零断言软化 / 零 skip-only-env / CI 配置零改动） | 设计 §11 DENY LIST（:441，基线树口径）；SA6 §12.0 | 已提交形态逐项复核成立：`packages/` 谱系 diff = 恰 2 测试文件；src 零字节；skip/only/todo grep 0；`.github`/`scripts`/`vitest.config.ts`/`package.json` 不在任何被审 diff | **no-conflict** | §1 | 无 |
| 10 | 流程面发现（SA6 U5/S5–S6：重命名消费方清点用过期快照、基座前移后未重取门） | 前轮 RA2'（树绑定规则）/ RA4''③；SA6 §15-U5 | 该发现是对**交付流程**的登记（CI 红即树绑定规则的发现机制奏效——重取面 typecheck 必红并在 CI 暴露），不构成修复对任何决策面的违反；SA6 K1–K8 把「未来同类跟随」的回归门制度化（当前树全消费方清点 + 门集验证），与本轮 RA5'' 账本同向。是否升格为常设流程门属 Controller 裁量，非 SA8 决策冲突面 | **no-conflict**（流程登记，无决策违反） | SA6 §8 S5/S6、§12.0；§1 执行态 | RA2（账本承接） |

裁决分布：**no-conflict ×8（行 1、2、5、6、8、9、10）、implements-existing-decision ×2（行 3、4）**；行 7 为前轮既有义务的兑现闭合登记（implements-existing-decision 性质，计入后分布为 **×7 / ×3**——以行标注为准：8 no-conflict + 3 implements-existing-decision 按含行 7 计）。**evolution-required ×0、hard-conflict ×0、override ×0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |
| — | — | — | — |

- 无 Owner 评论（派工明文 none；issue #420 与 PR #429 REST comments/reviews 均 `[]`）⇒ 无覆盖通道被援引。
- 无新 ADR、无协议版本升级、无决策自含演进条款被触发。
- 修复**不需要** override：它不改变任何契约面（零生产/零断言/零导出/零协议字节），是既有冻结决策（D9/U1、父侧 U4 从属、#418 exact-equality）的机械兑现；实现方便、测试通过、CI 绿、PR 已合并均未被用作 override 依据。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（本轮对已提交态亲验） |
| --- | --- | --- | --- |
| 公共导出面（`src/index.ts` 13 值，含公共 `createHubSessionHost`；append-only） | #418 契约 `FROZEN_PRODUCTION_EXPORTS`；ADR 0032:66 | blob `08fa49a1…`（HEAD = `4e5ff0a` 相等） | **保持** |
| `hub-session.ts` 运行时导出面 | #418 structure :618 exact-equality `['createHubSessionSink']` | `grep ^export` = :32 接口 + :299 工厂 | **保持** |
| SA6 §12.1 公共签名（工厂/句柄/信号，test-d 双锁） | `…issue420-session-host-api.test-d.ts` | 不在任何被审 diff | **保持** |
| #423 两文件断言/用例体/金标（EM-C7 常量、§23.1 判据） | #423 SA6 :41/:138；父侧 SA8 冻结面 | census 全集 = 头注+导入+类型+工厂调用；skip/only/todo 0 | **逐字不变** |
| wire 格式/消息码/错误码/事件词汇/字段集 | 协议 §4–§6/§13/§14/§23.1–23.4；ADR 0032 决策 4 | `3f470fb..HEAD` docs/CONTEXT 零 diff | **保持** |
| DENY 面（`hub-namespace.ts`/`hub-edge.ts`/`testing.ts`/AC 矩阵 7 文件/CI 配置/上游包） | 设计 §11 DENY LIST | `packages/` 谱系 diff = 恰 2 测试文件 | **零触碰** |
| 内部缝 × 公共缝双轨边界 | ADR 0032 :32–53 附录；CONTEXT.md :229 词汇 | 修复后导入仍指 `src/hub-session.js` 内部工厂 + `src/hub-split.js` 类型（与 `src/hub-connection.ts:18` 权威形态同源） | **保持** |
| 决策/规范文本完整性 | `docs/AGENTS.md` 修订纪律 | docs/+CONTEXT.md 零 diff；wiki/raw 改动均为报告/证据 | **保持** |

## 6. Evolution requirements

**无。** 被审对象（已提交修复 + 诊断 + 执行态）不改变任何契约面：不新增/改名/删除导出，不动 wire/schema/持久化/状态机/生命周期/失败语义/版本，不触碰任何决策文本。机械跟随落在 #420 已冻结重命名决策（D9/U1）与父侧 U4 从属条款的既有授权语义之内。SA6 §12.6 的归因口径注记只改证据文档散文，已合并字节保持冻结（sha256 亲验）。

## 7. Hard conflicts

**无。** 特别核对并排除的读法：
- (a) 编辑父分支带入的 #423 测试文件 ≠ 越权改冻结测试：两文件不在设计 §11 的基线树枚举面（彼时不存在，`25c51cd..3f470fb` 零触碰亲验），父侧 U4 明文从属于 T3 落地，且修复对象为 Controller CI 修复派工直接授权；断言/用例体逐字不变（§1）。
- (b) 生产侧替代（恢复运行时/类型别名）≠ 可行解：被 #418 exact-equality 锚（:618）与 D9 别名删除决定性封死，未被采用。
- (c) 符号跟随 ≠ 语义迁移：映射到改名后的同一工厂/同一底层类型，未换被测面（公共工厂不同形，行 1）。
- (d) CI 绿 + PR merge ≠ override：仅作为 RA1''/RA2'' 执行闭合凭证使用（行 7），未作为任何决策面的合法性依据。
- (e) SA6 契约原位重写（前轮 feature 契约 → CI 修复契约）≠ 决策文本变更：wiki/raw 按 `docs/AGENTS.md` 为证据非规范契约；前轮仍生效条目经附 B 索引 + git 历史（`git show 4e5ff0a:…`）双通道可查。

## 8. Required actions

| # | 行动 | 责任面 | 门禁 |
| --- | --- | --- | --- |
| RA1 | **证据归档**：Controller 把工作树未提交的 SA6 CI 修复契约（`wiki/raw/task_issue-420_sa6_contract.md`）+ `artifacts/sa6-issue420-ci-repair/**`（含 3 支 harness、探针与 27 条日志）以追加归档 commit 落账（commit 前 `git diff --cached --check` RC=0）；本报告文件是否并入固定路径 `task_issue-420_implementation_conflict_report.md` 由 Controller 一并裁定（本轮派工禁改文件，SA8 不执行）。PR #429 已 merge、issue #420 已 close ⇒ 本行动是 CI 修复账本的归档门，非交付阻断门 | Controller | 阻断 CI 修复账本 finalize |
| RA2 | 账本存续（承接 RA5'' + SA6 U4/U5）：「未来同类跟随」以 SA6 K1–K8 为回归门（当前树全消费方清点 + 门集验证——行 10）；内部缝测试迁移至公共工厂、恢复生产别名、基座前移后不重取门致新红，均为决策/流程面变化，须新 SA8 轮 | 后续票/Controller | 跨票账 |
| RA3 | 触发条件存续（RA4'' 原样武装）：① 新 head/合并谱系上出现不能归因于两文件 stale 导入的失败；② 任何 diff 超出 §1 census 的 26 行机械集；③ 父 head（`spec/415` 谱系）再前移未复认即解；④ 「恢复生产别名」或「#423 测试改道公共工厂」提案 | Controller | 条件触发 |

## 9. Verdict

**`clear`**。

- 对照分布：**8 × no-conflict、3 × implements-existing-decision**（行 3/4/7）、0 evolution-required、0 hard-conflict、0 override（§3 表行标注为准）。
- **已提交修复终认**：commit `2c87b3b` 代码字节 = 前轮已裁决字节（sha256 逐位相同）⇒ 前轮 10 项裁决全部直接覆盖；本轮对已提交态独立复核全部冻结面（§5）逐项保持。
- **执行闭合终认**：前轮仅存的两条执行形式门（RA1''/RA2''）已由可复核事实闭合——`2c87b3b` 已 push、新 head `5a4049d` CI run `35665953800` = success、PR #429 MERGED（`4ad13a35`）、issue #420 CLOSED（gh 亲验）；RA4''① 触发条件未发生。SA9 §8-N3 的「新 head CI 复跑待 Controller」随之销账。
- **诊断终认**：SA3 iter 4 / SA4 Part C / SA6 CI 修复契约的根因链（单变量红复现 + 机制探针 + 谱系事实）与决策集同向；其禁止方向与 SA8 裁决一致；诊断不创设、不修改任何决策。
- 本轮不评价测试充分性与验收完成度（SA4/SA7/SA9/SA10 职责，均已在册 approve）。

## 10. requiresConflictRecheck

**false**（实施复查闭合）。依据：skill 判据「实现后复查已闭合时为 false」——本轮即对**已提交修复 + 诊断 + 执行态**的实施复查，全部决策面（公共 API、wire、schema、持久化、状态机、生命周期、失败语义、override）已在 §3/§5 对实际提交态逐项核对闭合；前轮挂起的实现核对项（新 head CI 绿）已兑现（行 7）。无新决策面、无待实现核对项。残余 RA1 为**证据归档形式**（Controller 执行），非决策重查；若触发 RA3 任一条件（新根因 / diff 超集 / 父 head 再前移未复认 / 决策面提案），按触发条件进入新一轮 SA8。
