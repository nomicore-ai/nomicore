# SA8 Conflict Report — issue #420（implementation 复查：SA3 最小 CI 修复 = #423 两测试文件的机械导入迁移）

派工 `sa-3f300a00-a072-4670-b97c-78945ff866ff`（role `mabf-sa8`，phase conflict-gate，iteration 0）。派工明文：Owner comment requirements = none；Issue comments REST snapshot = `[]`（本轮 `gh api …/issues/420` 亲验 `{"state":"open","comments":0}`、`issues/420/comments` length `0`）。被审对象 = **SA3 iteration 4 的最小 CI 修复**：PR #429 head `3f470fbcb6f10b0b26dced0fc05fceaec353494a`（谱系 = 二段 rebase 已按前轮 RA1' 落地：`4e5ff0a` 交付重放 + 3 个归档 commit，父 = `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df`）上 typecheck + Node 20/24 分片 1/6 红灯（run `35663498235`，5 fail / 11 pass）的修复 diff——**两个 #423 测试文件的机械符号名跟随**（`ws-replication-issue423-sa7-dynamic.test.ts`、`ws-replication-issue423-observer-emission-split.test.ts`；`2 files changed, +18/−8`，工作树未提交态）。裁决问题（派工原文）：(a) 该机械 #423 导入迁移是否为契约、ADR 与规范所允许；(b) 是否改动任何冻结公共导出或语义边界。本轮全部事实独立重取（不采信 SA3/SA4 自述）：diff 逐行、冻结面逐项、决策文本逐条、REST 双端点亲验。本轮零测试运行、零 commit/push/finalize；除本报告（SA8 唯一产物、原位更新职责）外不改任何被审对象、代码、证据或决策文档（工作树对 `packages/ws-replication/src/**`、`docs/**`、`CONTEXT.md` 零 diff 亲验）。

## 1. Reviewed subject: implementation（SA3 最小 CI 修复：#423 两测试文件机械导入迁移，未提交工作树 diff）

- 实际改动面（`git status` + 逐行 diff 亲验）：恰 2 个 `packages/ws-replication/test/` 下 #423 测试文件 + SA3 报告编辑 + 7 条新增证据日志（untracked）；**零生产代码、零配置、零 docs/CONTEXT**。
- 逐文件改动 census（`git diff -U0` 全集 = 每文件 −4/+9）：头注 5 行（登记「#420 D9 机械跟随」）+ 导入 2 行（`import { createHubSessionHost, type HubSessionHost } from '../src/hub-session.js'` → `import { createHubSessionSink } from '../src/hub-session.js'`；`HubSessionEdgePort` 类型行并入 `import type { HubSessionEdgePort, HubSessionSink } from '../src/hub-split.js'`）+ 类型标注 1 行（`readonly host: HubSessionHost` → `HubSessionSink`）+ 工厂调用 1 行（`createHubSessionHost({` → `createHubSessionSink({`）。**断言、用例体、`describe/it` 名、选择器、阈值、EM 系列金标常量零字节变化**（census 无任何其他行组）。
- 第三份 #423 文件（`ws-replication-issue423-update-offset-guard.test.ts`）grep 亲验**不含**被改名符号（`hub-session`/`HubSessionHost`/`createHubSessionHost` 零命中）⇒ 未触碰，与「根因唯一 = 两文件 stale 深路径导入」自洽。
- 冻结态锚：两文件现 sha256 = `778d2461f0421027c25c17bd817327dcccf14b3a53b4f92efa2e728852e0183c` / `160565873bf980c0ee1042d699fc9da890ee74743222139097e095a60395681e`，与 SA3 §4.4 登记值**逐位相同** ⇒ 本轮被审字节 = V29–V35 验证所跑字节。
- 谱系事实（亲验）：两文件自父基 `25c51cd` 至 HEAD `3f470fb` **零 commit 触碰**（`git log 25c51cd..HEAD -- <两文件>` 空）⇒ HEAD 版本 = 父侧原版，工作树 diff 即修复全量；`HEAD:packages/ws-replication/src/index.ts` blob = `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1` = 前轮 RA1' 钉死的登记并集 blob（父侧该路径 blob `7e2f746` 未动）⇒ 二段 rebase 按裁决落地、公共面原样过继。

## 2. Inputs and decision set

- 决策集（本轮全量复核）：`docs/adr/` 31 文件（0001–0030 + 0032）。本主题裁决面：**ADR 0032**（已接受；:30 决策 5、:32 #420 澄清附录、:66 公开面 append-only、:68 #423 决策 5 注记——合并树内并存亲验）、ADR 0010/0012/0013（已接受，ws-replication 域背景）、`docs/protocols/instance-replication-v1.md`（§17/§23.1–23.4 冻结面，本轮零触碰）。census 精确口径：0001 `status: accepted`（英文字段）、0015 `状态：提议`（从未接受、与本主题无关、不构成约束）；无整文件级 superseded（ADR 0020 §9 为文内条款级被 0021 取代的自登记，与本主题无关）。
- 契约/规范输入：
  - **#420 SA6 契约** `wiki/raw/task_issue-420_sa6_contract.md`：§12.6 :352–355「授权的一次性编辑（除此外既有测试文件不得改动）」两枚（#418 契约表追加 + #418 结构测试机械跟随）、:357 重命名理由与「零行为机械改动」定性、U1 :397（重命名冻结）、§12.1 公共签名冻结。
  - **#420 设计** `wiki/raw/task_issue-420_design.md`：§11 ALLOW LIST（13 条，基线树快照）+ DENY LIST（含「其余既有测试文件……§12.6 授权编辑之外零改动」、`hub-namespace.ts`/`hub-edge.ts`/`testing.ts`/协议文本零 diff、AC 矩阵断言逐字不变）；§7 D9（重命名决策）。
  - **#423 父侧契约/裁决**（父分支自有权威链，经其 SA8 闭合在册）：`wiki/raw/task_issue-423_sa6_contract.md` U4 :248（明文「本契约以内部缝（`createHubSessionHost` + seam port / 内部 edge 端口）建立等价面……**待 T3(#420)/T5 落地补运行时锚**」——父侧把其内部缝锚显式从属于 T3 落地）；:41 §23.1 36 型字段表冻结；:138 EM-C7 金标冻结。`wiki/raw/task_issue-423_implementation_conflict_report.md`（verdict clear、0 hard-conflict/0 evolution-required/0 override；冻结面 = 协议 §23.x、ADR 0013 chunked 键集，均非测试文件字节）。
  - `packages/ws-replication/AGENTS.md`（"Export production APIs through `src/index.ts`"；测试面/公共面边界）。
- 源码事实核验（全部本轮亲验）：
  1. 父基 `25c51cd` 的 `hub-session.ts` 导出面 = `HubSessionHostConfig`（:30）+ `export type HubSessionHost = HubSessionSink`（:42）+ `createHubSessionHost`（:300）⇒ #423 两文件的深路径导入在父树合法、在 D9 后树必然破（工厂名消失 ⇒ TS2724/TS2305 + ESM 具名导入 `undefined` ⇒ `TypeError`）——根因归因独立复核成立。
  2. 当前树 `hub-session.ts` 运行时导出面 = 恰 `createHubSessionSink`（:299；`HubSessionSinkConfig` 为接口）⇒ #418 结构测试 :618 `expect(Object.keys(sessionModule).sort()).toEqual(['createHubSessionSink'])` exact-equality 在场且由本修复**保持**。
  3. 重命名纯度：父 `HubSessionHostConfig` 接口体与现 `HubSessionSinkConfig` 接口体**成员逐行相同**（port/registry/instanceId/peerInstanceId/timer/limits/timeouts；diff 亲验仅声明名与窗口越界行）；父 `HubSessionHost` = `HubSessionSink` 的**别名**（D9 删除的是别名非类型）⇒ 修复的类型映射（旧别名 → 底层接口 `hub-split.ts:126 HubSessionSink`）是同一类型，非语义改写。
  4. 权威导入形态：`src/hub-connection.ts:18`（值 `createHubSessionSink` 自 `hub-session.js`）与 `test/ws-replication-issue418-edge-session-split-structure.test.ts:39-46`（类型 `HubSessionSink` 自 `hub-split.js`）——修复的导入切分与仓内两处权威形态同源。
  5. 公共导出面：`src/index.ts` 13 值导出（含公共 `createHubSessionHost` ← `hub-session-host.js`）= #418 契约测试 `FROZEN_PRODUCTION_EXPORTS`（:144-158，13 名）逐名一致；两文件（index.ts/契约测试）均不在 diff 内。
  6. 残留 stale 面：编译/运行 include 面（src/test/apps/tests + tsconfig*/vitest.config/package.json）对旧符号深路径导入 **0 命中**；`artifacts/**` 中旧名（SA6 探针 .mts 等）不在任何 include 模式（grep 0）⇒ 仍按 Deviations #2 登记，非本修复面。
  7. 语义边界保持的关键事实：公共 `createHubSessionHost`（`hub-session-host.ts:261`）吃 **`HubSessionHostConfig`**（授权投影等公共描述子形态），与内部 splice 工厂吃 `HubSessionSinkConfig`（`HubSessionEdgePort` 17 成员缝）**不同形**；修复把 #423 测试跟随到**内部缝改名后的同一工厂**，而非迁移到公共工厂——被测面（内部 splice session）未换。
- 缺失输入：无。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（两文件机械导入迁移） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | #420 SA6 §12.6 授权编辑边界「除此外既有测试文件不得改动」 | `task_issue-420_sa6_contract.md` :352–355 | 被编文件为 **#423 父增量文件**（非契约基线 `7039f6d` 的「既有测试文件」——该枚举针对 #420 自身红绿门与回归面，文件范围表按其裁决基线树快照绑定）；编辑类 = §12.6 编辑 2 授权的同一类（机械符号名跟随，断言逐字不变），断言/用例体/金标字节零变化亲验 ⇒ 冻结条款的实质（验收语义与回归面不动）完整保持 | **implements-existing-decision**（D9 重命名义务在新浮现 stale 消费方的兑现） | §1 diff census；§2-2 | 无（本报告 + 两文件头注即为登记；SA4 CI 修复轮对其 Deviation #6「范围扩展」的显式待复认登记由本行裁决收编：许可性成立，无需扩枚举、无需 override） |
| 2 | SA6 U1 / 设计 §7 D9：内部 splice 重命名冻结（`createHubSessionHost`→`createHubSessionSink`、别名删除，零行为） | `task_issue-420_sa6_contract.md` :397/:355/:357 | 重命名使父侧测试的深路径消费必然破；修复在**消费方**跟随（唯一不触其他冻结面的路线）；映射 = 旧工厂→改名后同一工厂、旧别名→其底层接口（重命名纯度 §2-3 亲验） | **implements-existing-decision** | §2-1/§2-3 | 无 |
| 3 | #418 结构测试冻结锚：`hub-session.ts` 运行时导出面 exact-equality `['createHubSessionSink']` | `ws-replication-issue418-edge-session-split-structure.test.ts` :618 | 修复**否决**生产侧替代（恢复运行时/再导出别名会令该 exact-equality 转红；仅恢复类型别名不修运行期 `TypeError` 且 D9 明文删除）⇒ 跟随落在 stale 消费方；生产零 diff 亲验 | **no-conflict**（修复保持该冻结面） | §1；§2-2 | 无 |
| 4 | ADR 0032 :66 公开面 append-only（一经发布按 SA6 纪律冻结） | `docs/adr/0032-*.md` :66 + :32 附录 | `src/index.ts` 不在 diff；HEAD blob = 登记并集 `08fa49a1`（13 值导出双工厂）逐位过继亲验 | **no-conflict** | §1；§2-5 | 无 |
| 5 | ADR 0032 :68 #423 注记 + 协议 §17/§23.1–23.4 冻结面 | ADR 0032 :68；`instance-replication-v1.md` | 本修复零协议/ADR/CONTEXT 字节；事件字段集、稳定码、chunked 键集全不动 | **no-conflict** | §1（docs/CONTEXT 零 diff） | 无 |
| 6 | `packages/ws-replication/AGENTS.md` 公共 API 只经 `src/index.ts` | AGENTS.md Boundaries 末条 | 修复零新增导出；#423 测试维持**内部深路径消费内部缝**（与 #418 结构测试、#423 父侧原形态一致的既有实践），不把内部缝测试改道公共面 | **no-conflict** | §2-4/§2-7 | 无 |
| 7 | #423 父侧契约 U4：等价面建在内部缝上、「待 T3(#420)/T5 落地补运行时锚」 | `task_issue-423_sa6_contract.md` :248 | 父侧契约已显式把其内部缝锚从属于 T3(#420) 落地；T3 的 D9 重命名落地后，父侧测试跟随改名符号 = 该从属关系的机械兑现；父侧冻结面（§23.1 36 型字段表 :41、EM-C7 金标 :138、ADR 0013 键集）字节零触碰 | **implements-existing-decision** | §2 父侧契约引文；§1 census | 无 |
| 8 | 语义边界：内部 splice 缝 × 公共 byte-seam 工厂双轨（ADR 0032 :32 附录 / SA6 §12.1） | ADR 0032 :43–53；SA6 §12.1 | 修复未把 #423 测试迁移到公共 `createHubSessionHost`（不同形 config：授权投影 vs `HubSessionEdgePort` 缝）——被测对象仍是内部 splice session（仅符号改名），双轨边界与被测语义均不变 | **no-conflict** | §2-3/§2-7 | 无 |
| 9 | 五门树绑定规则（iteration-5 RA2'：新基树重取，typecheck 须覆盖缝签名） | `task_issue-420_implementation_conflict_report.md`（前轮）RA2' | RA1' 已按裁决落地（rebase 零冲突、index.ts blob 逐位过继亲验）；重取暴露的语义碰撞（typecheck 4 错 + 8 红）恰为 RA2' 预言面的实例；V29–V35 在本轮被审冻结字节（sha 逐位相同）上全绿 ⇒ RA2' 决策面兑现；正式 CI 绿待 Controller push 后新 head 复跑（执行面） | **implements-existing-decision**（兑现中；残余为执行形式） | §1 冻结态锚；SA3 §4.4 | RA2''（形式闭合） |
| 10 | 修复轮改动纪律（零生产/零断言软化/零 skip-only-env） | SA6 §12.0 运行纪律；设计 §12 纪律行 | diff = 恰 2 测试文件 +18/−8，无 skip/only/todo、无阈值/选择器变化、`packages/ws-replication/src/**` 零 diff 亲验 | **no-conflict** | §1 | 无 |

裁决分布：**no-conflict ×6（行 3–6、8、10）、implements-existing-decision ×4（行 1、2、7、9）、evolution-required ×0、hard-conflict ×0**。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |
| — | — | — | — |

- 无 Owner 评论（派工明文 none；本轮 REST 双端点亲验 issue open、comments=0、comments 列表 length 0）⇒ 无覆盖通道被援引。
- 无新 ADR、无协议版本升级、无决策自含演进条款被触发。
- 本修复**不需要** override：它不改变任何契约（零断言/零生产/零导出/零协议字节），是既有冻结决策（D9/U1、父侧 U4 从属、#418 exact-equality）的机械兑现；实现方便、测试通过、PR 存在等均未被用作依据。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（本轮亲验） |
| --- | --- | --- | --- |
| 公共导出面（`src/index.ts` 13 值导出，含公共 `createHubSessionHost`；append-only） | #418 契约 `FROZEN_PRODUCTION_EXPORTS` :144-158/:553；ADR 0032:66 | 不在 diff；blob = `08fa49a1…` | **保持**（逐名一致亲验） |
| `hub-session.ts` 运行时导出面 exact-equality | #418 结构测试 :618 | 不在 diff；现导出恰 `createHubSessionSink` | **保持** |
| SA6 §12.1 公共签名（工厂/句柄/信号，test-d 双锁） | `…issue420-session-host-api.test-d.ts` | 不在 diff | **保持** |
| 两 #423 文件断言/用例体/金标（含 EM-C7 常量、§23.1 判据） | #423 SA6 :41/:138；#423 SA8 冻结面 | `git diff -U0` census 全集 = 头注+导入+类型+工厂调用 | **逐字不变**（无任何其他行组） |
| wire 格式/消息码/错误码/事件词汇/字段集 | 协议 §4–§6/§13/§14/§23.1–23.4；ADR 0032 决策 4 | docs/协议零 diff | **保持** |
| DENY 面（`hub-namespace.ts`/`hub-edge.ts`/`testing.ts`/AC 矩阵 7 文件/periodic-reconcile/上游包） | 设计 §11 DENY LIST | `git status` 全集 = 2 测试文件 + 报告 + 证据日志 | **零触碰** |
| 内部缝 × 公共缝双轨边界 | ADR 0032 :32 附录；AGENTS.md 公共面条款 | 修复后导入仍指 `src/hub-session.js` 内部工厂 | **保持**（未改道公共工厂） |
| 决策/规范文本完整性 | `docs/AGENTS.md` 修订纪律 | 工作树 docs/+CONTEXT.md 零 diff | **保持** |

## 6. Evolution requirements

**无。** 被审对象不改变任何契约面：不新增/改名/删除任何导出，不动 wire/schema/持久化/状态机/生命周期/失败语义/版本，不触碰任何决策文本。机械跟随落在 #420 已冻结重命名决策（D9/U1）与父侧 U4 从属条款的既有授权语义之内，无修订计划需求。SA6 §12.6 的授权编辑枚举不需扩张：其约束对象（契约基线树的既有测试文件）未被触碰；新基树引入的 stale 消费方按重命名决策的固有义务处理，且断言完整性由本报告字节级核验背书。

## 7. Hard conflicts

**无。** 特别核对并排除：(a) 编辑 #423 测试文件 ≠ 越权改冻结测试——文件属父增量、父侧契约 U4 显式从属于 T3，断言/用例体逐字不变（§3-1/§3-7）；(b) 生产侧替代（恢复别名）≠ 可行解——被 #418 exact-equality 结构锚与 D9 别名删除决定性封死，未采用（§3-3）；(c) 符号跟随 ≠ 语义迁移——映射到改名后的同一工厂/同一底层类型，未换被测面（公共工厂不同形，§3-8）；(d) 修复 ≠ 公共导出变化——`src/index.ts` blob 逐位过继、零 diff（§3-4）；(e) 残留 stale ≠ 冲突面——编译/运行 include 面 0 命中，`artifacts/**` 维持 Deviations #2 登记（§2-6）。

## 8. Required actions

| # | 行动（精确要求） | 责任面 | 门禁 |
| --- | --- | --- | --- |
| RA1'' | **修复随交付变更集落地**：Controller 把两文件修复（sha256 以 §1 冻结态锚为准）+ 7 条 `artifacts/sa3-issue420-{ci-fail-evidence,ci-typecheck-fail,local-typecheck-pre-fix,local-prefix-wsrep-excerpt,ci-fix-typecheck,ci-fix-tests,ci-fix-contract-anchors}.log` + SA3 报告更新 + 本报告 commit 到交付分支并 push；新 head 上 CI（`typecheck` + `test (20/24, 1–6)` + `contract-gates`）须绿。**触发条件**：新 head 上出现任何不能完全归因于该两文件 stale 导入的失败 ⇒ 停，回 SA8（RA4''①） | 交付执行者（Controller） | 阻断交付合并 |
| RA2'' | RA2' 形式闭合（状态登记）：V29–V35 已在本轮被审字节上全绿（sha 逐位相同）；正式闭合凭证 = RA1'' push 后新 head CI 绿。SA4/SA7 证据链以其自有职责归档 | 交付执行者 | 阻断 finalize（形式核对） |
| RA3 | （承接，非阻断）`artifacts/**` 中旧内部名探针维持编译/运行 include 面外登记（本轮 grep 0 复证）；Deviations #2 账目不变 | 后续票/Controller | 非门禁 |
| RA4'' | 专家路由触发条件（更新）：① 新 head CI 失败根因超出两文件 stale 导入；② 实际 diff 超出 §1 census 的 26 行机械集（任何断言/生产/配置字节）；③ 父 head 再前移（≠ `25c51cd` 谱系）未复认即解；④ 任何「恢复生产别名」或「#423 测试改道公共工厂」提案——两者均为决策面变化，须新 SA8 轮 | Controller | 条件触发 |
| RA5'' | 账本存续（追加）：D9 重命名跟随迄今覆盖 #418 两文件（SA6 §12.6 授权编辑 2）+ #423 两文件（本修复）；后续内部缝消费方同名跟随同类处理；**内部缝测试迁移至公共工厂 = 决策变化**，须过 SA8 | 后续票 | 跨票账 |

## 9. Verdict

**`clear`**。

- 10 项对照：6 no-conflict、4 implements-existing-decision、0 evolution-required、0 hard-conflict、0 override。
- **许可性终认**（派工问句 a）：机械 #423 导入迁移为契约与规范所允许——它是 #420 冻结重命名决策（SA6 U1/§12.6 编辑 2、设计 §7 D9）在新基树浮现的 stale 消费方上的兑现，父侧 #423 契约 U4 明文把其内部缝锚从属于 T3(#420) 落地；生产侧替代被 #418 exact-equality 锚封死，消费方跟随是唯一不触冻结面的最小路线；映射经重命名纯度核验为同一工厂/同一类型（非语义改写）。
- **冻结面终认**（派工问句 b）：公共导出（13 值、blob `08fa49a1` 逐位过继）、`hub-session.ts` 运行时面、SA6 §12.1 签名、#418 双冻结锚、协议 §23.x、DENY 面、两文件断言/金标——**全部零改动**（diff census 字节级亲验）；内部缝 × 公共缝双轨边界保持（未改道公共工厂）。
- 本轮不评价测试充分性与验收完成度（SA4/SA7/SA10 职责）；CI 失败归因的测试学复核采信 SA3 §4.1–§4.2 与门禁旁证（同 run 其余 11 作业含 contract-gates 全绿），决策面无涉。

## 10. requiresConflictRecheck

**false**（窄域闭合）。依据：skill 判据「实现后复查已闭合时为 false」——本轮即 implementation 复查，被审 diff 的全部决策面（公共 API、wire、schema、持久化、状态机、生命周期、失败语义、override）已在本轮对实际 diff 逐项核对闭合；无新决策面、无待实现核对项。残余事项均为**执行形式**而非决策重查：RA1''（commit/push + 新 head CI 绿——SA3 角色禁 commit/push，属交付执行者）与 RA2''（形式闭合凭证）。若触发 RA4'' 任一条件（新根因 / diff 超集 / 父 head 再前移 / 决策面提案），按触发条件进入新一轮 SA8。
