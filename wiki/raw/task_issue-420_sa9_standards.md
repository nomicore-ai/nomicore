# SA9 Standards Review — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（**CI 修复终审**轮）

- Dispatch：`sa-a1108e19-53b2-4891-943a-3602b29e3267`（mabf-sa9 / standards-review / iteration 2）
- 审查对象：worktree `/home/wangjian/nomicore-fix-issue-420` 的**最终已提交 CI 修复** commit `2c87b3b7a69bbc1a727ed6497e7b260181ce6283`（`test(ws-replication): update internal splice imports`，父 = PR #429 前 head `3f470fb`，谱系 = 二段 rebase 交付 `4e5ff0a` + 双归档 `eb5ec09`/`aff4bc0` + 终审归档 `3f470fb`；权威父基 = Parent PR #416 stable head `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df`，派工明文逐位一致）
- Owner requirements：派工明文 none；REST comment snapshot = `[]`（本轮简报 `## Comments` 空存续）⇒ 无 owner 追加要求
- **Verdict：`approve`**（0 BLOCKER / 0 MAJOR；6 条非阻断 MINOR 见 §8；`requiresConflictRecheck: false`，理由见 §9）
- 审查范围声明：本报告只判断仓库与工程标准（AGENTS/ADR/模块责任/既有架构惯例/单一事实源/生命周期对称性/文件范围/测试质量标准）；Issue 需求完整实现属 SA10；新 head 上 CI 复跑绿 = Controller 执行形式（SA8 RA1''/RA2''），本报告只做状态登记与事实核验，不越权裁决。本报告原位覆盖前轮（iteration 1，rebase 轮）报告。

---

## 1. Reviewed inputs（本轮读取/核验）

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-420.md`（简报；AC1–AC5；Comments 空） | 读取 |
| `wiki/raw/task_issue-420_design.md`（SA1 iteration 1：D1–D10、§11 ALLOW/DENY、§12 验收映射） | 全文读取 |
| `wiki/raw/task_issue-420_sa3_impl.md`（iteration 4：定证 §4.1 / 根因 §4.2 / 修复 §4.3 / V29–V35 §4.4 / 冻结态锚 / Deviations #6（范围扩展 + recheck 请求）/#7 / 建议提交信息 / 10 条 staging 清单） | 全文读取 |
| `wiki/raw/task_issue-420_sa4_review.md`（Part C：CI 修复轮 **approve**，O14–O16） | 全文读取 |
| `wiki/raw/task_issue-420_implementation_conflict_report.md`（HEAD 版 = SA8 CI 修复轮复查：**clear**，6 no-conflict + 4 implements-existing-decision / 0 hard-conflict / 0 override；§3-1 收编 SA4 Deviation #6 复认请求；`requiresConflictRecheck: false` 窄域闭合；RA1''–RA5''） | 全文读取 |
| 前轮 SA9 报告（iteration 1，rebase 轮 approve，9 MINOR） | 已被本报告原位覆盖；其结论所依附的交付字节（`4e5ff0a`）在本轮修复 commit 中**零 diff**（§2.2 亲验），实质判定存续 |
| SA6 契约 §12.6/U1、SA2 评审、SA8 历轮报告、relevant_decisions | 历轮已全文审；本轮按需复核引用面（§12.6 授权编辑边界、D9 重命名冻结、#423 父侧 U4 从属条款） |
| 规范面 | 根 `AGENTS.md`、`packages/ws-replication/AGENTS.md`（本轮 Host 提示重读并逐条对照 §4）、`docs/AGENTS.md`、ADR 0032（#420 澄清附录 × #423 决策 5 注记并存） |
| 本轮独立 git/源码核验 | 见 §2/§3/§5 全部命令级事实（commit 文件集、逐行 diff census、blob/sha256 锚、stale 消费方 grep、冻结锚、whitespace 门、证据日志内容抽查） |

SA9 未修改任何生产代码、设计或测试；未运行测试/服务；唯一产物为本文件（原位覆盖前轮报告）。

## 2. CI 修复 commit（`2c87b3b`）独立核验（全部亲取，不采信自述）

### 2.1 文件集与改动 census

`git show --name-only` 全集 = **恰 12 路径**：

| 类别 | 路径 | 授权/惯例核对 |
| --- | --- | --- |
| 测试修复（2） | `packages/ws-replication/test/ws-replication-issue423-{sa7-dynamic,observer-emission-split}.test.ts` | SA3 Deviation #6 显式登记的范围扩展；SA8 §3-1 裁 **implements-existing-decision**（D9/U1 重命名义务在新基树浮现的 stale 消费方上的兑现；父侧 #423 U4 明文从属 T3）——许可性已由冲突门禁终认，非静默越界 |
| 证据日志（7） | `artifacts/sa3-issue420-{ci-fail-evidence,ci-typecheck-fail,local-typecheck-pre-fix,local-prefix-wsrep-excerpt,ci-fix-typecheck,ci-fix-tests,ci-fix-contract-anchors}.log` | SA8 RA1'' 逐名枚举同一集合；SA3 证据归档惯例（iteration 1–3 同款） |
| 评审报告（3） | `wiki/raw/task_issue-420_{sa3_impl,sa4_review,implementation_conflict_report}.md` | SA3 报告 = SA8 RA1'' 明文项；SA8 报告 = RA1'' 明文项（原位更新职责）；SA4 报告 = SA4-O13 归档先例（#418/#419/#421 同款「评审产物随交付归档」） |

与 SA3 staging 清单（10 条）的关系：实际 commit = 清单 10 条 + SA8/SA4 两报告——后者均为各自 SA 明示的归档义务，**零越界路径**。`git diff --stat 3f470fb 2c87b3b -- packages/ws-replication/src docs CONTEXT.md .github scripts package.json vitest.config.ts` **空**（生产/docs/CONTEXT/CI 配置零字节）。`git diff --check 3f470fb 2c87b3b` RC=0。

### 2.2 逐行 diff census（两测试文件，`git show` 亲验）

每文件改动 = **+5 行头注 + 2 行导入 + 1 行类型标注 + 1 行工厂调用**（合计 +18/−8）：

- 头注：登记「#420 D9 机械跟随（父基前移后的符号名跟随）…用例体、断言与选择器逐字不变」——与 diff 事实一致。
- 导入：`import { createHubSessionHost, type HubSessionHost } from '../src/hub-session.js'` → `import { createHubSessionSink } from '../src/hub-session.js'`；`HubSessionEdgePort` 行并入 `import type { HubSessionEdgePort, HubSessionSink } from '../src/hub-split.js'`。
- 类型标注 `readonly host: HubSessionHost` → `HubSessionSink`；工厂调用 `createHubSessionHost({` → `createHubSessionSink({`。
- **断言/`it`/`describe` 名/选择器/阈值/EM 金标零字节变化**：对 commit 测试 diff 以 `expect|assert|it(|describe(|toBe|toEqual|threshold` 过滤 changed lines = **0 命中**（rc=1）。
- 第三份 #423 文件 `…issue423-update-offset-guard.test.ts` 对 `hub-session` **0 命中**（亲验）⇒ 未被触碰，与「根因唯一 = 两文件 stale 深路径导入」自洽。

### 2.3 符号映射正确性（本轮亲验）

- 父基 `25c51cd` 的 `hub-session.ts` 导出面 = `HubSessionHostConfig`(:30) + `export type HubSessionHost = HubSessionSink`(:42) + `createHubSessionHost`(:300)（`git show` 亲取）⇒ 两文件旧导入在父树合法、在 D9 后树必破——根因归因成立。
- 当前树 `hub-session.ts` 运行时导出 = 恰 `createHubSessionSink`（:299；`HubSessionSinkConfig` 接口 :32）；`HubSessionSink` 接口在 `hub-split.ts:126`——与修复后导入切分逐形一致。
- 导入形态与仓内权威消费方同源：`src/hub-connection.ts:18`（值自 `hub-session.js`）、`test/…issue418-…-structure.test.ts`（类型 `HubSessionSink` 自 `hub-split.js`）、`test/issue420-shim-hub.ts:66/:69` 同款。
- fixture 传参形态不变（`port: stub.port` 等七字段，:195/:466 亲验）⇒ **仍直驱内部 splice**，未被改道公共工厂（其 config 不同形）——被测面与测试意图存续。
- 残留 stale 消费方 grep（`createHubSessionHost|HubSessionHostConfig` 于 src/test/apps/tests，排除 `hub-session-host` 与 test-d）：命中项全部合法——`src/index.ts:92`（公共面类型自 `./hub-session-host.js` 导出，正确）、`issue420-shim-hub.ts`/round 测试（公共工厂正确用法）、#418 契约测试 :153（`FROZEN_PRODUCTION_EXPORTS` 冻结条目）、两文件头注散文。**编译/运行 include 面零 stale 深路径引用**。

### 2.4 冻结面与卫生门（本轮亲验）

- `HEAD:packages/ws-replication/src/index.ts` blob = `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1` = SA8 iteration 5 钉死的并集 blob——公共面（13 值导出、双工厂同列）逐位过继，本修复零触碰。
- #418 结构锚 `…structure.test.ts:618` `toEqual(['createHubSessionSink'])` 在场；`FROZEN_PRODUCTION_EXPORTS` 13 名（含公共 `'createHubSessionHost'`）字母序零删除零重排。两锚文件均不在 diff。
- 生产侧替代（恢复别名/再导出）被该 exact-equality 锚决定性封死——消费方跟随是唯一自洽最小修复（SA3 §4.3 / SA4 §C-4 / SA8 §3-3 三方同结论，本轮独立复核成立）。
- sha256 冻结锚逐位相符（本轮亲算）：`…sa7-dynamic.test.ts` = `778d2461f0421027c25c17bd817327dcccf14b3a53b4f92efa2e728852e0183c`；`…observer-emission-split.test.ts` = `160565873bf980c0ee1042d699fc9da890ee74743222139097e095a60395681e`；7 条证据日志 sha256 与 SA3 §4.4 登记值**逐一相同** ⇒ 提交字节 = V29–V35 验证所跑字节（树绑定闭合）。
- 两修复文件 `it/describe/test.(skip|only|todo)|xit|xdescribe` = **0 命中**。

### 2.5 红→绿证据链（日志内容抽查）

- 红（定证）：`sa3-issue420-ci-fail-evidence.log` §A = CI run `35663498235` 失败作业 5（typecheck + test (20|24, 1|6)）与其余 11 作业全绿对照，job URL 齐全；§B = 4 条 TS2724/TS2305 逐字指向两文件旧导入；§C = 3+5 用例同 `TypeError: (0 , createHubSessionHost) is not a function`。本地独立复现日志（pre-fix typecheck EXIT=2 + 8 红）在册。
- 绿（V29–V35）：`ci-fix-typecheck.log`（`PACKAGE_TSC_EXIT=0` / `ROOT_TYPECHECK_EXIT=0`）；`ci-fix-tests.log`（两文件 2/2・26/26；包全量 90 文件/785 用例；`--typecheck.only` 49/270；CI 分片 1/6 = 63 文件/820、6/6 = 67 文件/831，全部 EXIT=0）；`ci-fix-contract-anchors.log`（契约锚 5 文件/89 用例 + contract-gates 四步 EXIT=0）。
- 内部一致性：26 = 修复前 8 红 + 18 绿（用例数守恒）；分片文件数 63/67 与 CI 失败态逐位吻合；包文件数 90 = SA8 RA2' 预期 87 + #423 三文件。SA4 已亲验 V30/V33/V34 与 `.github/workflows/ci.yml` 命令逐字相同，本轮抽查日志形态一致。

## 3. 标准符合性总账（`2c87b3b`）

| 标准轴 | 结论 | 依据 |
| --- | --- | --- |
| 根 AGENTS + `packages/ws-replication/AGENTS.md` | ✅ 符合 | §4 |
| `docs/AGENTS.md`（显式修订/diff-check） | ✅ 符合（本轮 docs 零触碰；`git diff --check` RC=0） | §2.1 |
| ADR 0032（决策 1–5 + 双注册附录）与关联协议冻结面 | ✅ 符合（零决策文本/协议字节；公共面 blob 逐位过继） | §2.4/§5 |
| 模块责任 | ✅ 符合（测试-only 修复；无生产面改动） | §6.1 |
| 既有架构惯例（导入形态/头注登记/commit 风格/归档先例） | ✅ 符合 | §6.2 |
| 单一事实源 | ✅ 符合（未恢复别名 ⇒ 包内无双名同物；内部/公共双轨边界保持） | §6.3 |
| 生命周期对称性 | ✅ 不适用面零触碰（零生产/零资源生命周期字节） | §6.4 |
| 文件范围（ALLOW/DENY/授权编辑/范围扩展纪律） | ✅ 符合（扩展经 Deviation #6 登记 + SA8 §3-1 终认收编） | §2.1/§7.1 |
| 测试质量标准 | ✅ 符合（零断言变化/零 skip/用例数守恒/红绿链 sha256 绑定） | §2.2/§2.5/§7.2 |

## 4. AGENTS 规约核验（本轮修复面）

### 4.1 根 AGENTS.md

| 条款 | 核验 | 结论 |
| --- | --- | --- |
| Module guidance（改 `packages/` 前读嵌套 AGENTS） | 修复面在 `packages/ws-replication/test/`；全流水线（SA3/SA4/SA8）均援引包级 AGENTS；本轮 Host 提示重读并逐条对照 §4.2 | ✅ |
| Instance replication（ADR 0010 + 协议 v1 为规范） | 本轮零 wire/认证/生命周期/背压/对账字节；协议文本零 diff | ✅ |
| Git worktrees（`.worktrees/`） | 本轮零新 worktree；工作树 clean（`git status --porcelain -uall` 空） | ✅ |

### 4.2 `packages/ws-replication/AGENTS.md`

| 条款 | 核验 | 结论 |
| --- | --- | --- |
| 「Export production APIs through `src/index.ts`…」 | 零新增导出；`index.ts` blob 逐位 = 登记并集；两文件维持**内部深路径消费内部缝**的既有测试实践（#418 结构测试同款），未改道公共面 | ✅ |
| 「Preserve protocol ordering and FSM invariants」 | 零状态机路径改动；`hub-namespace.ts`/`hub-edge.ts` 对父零 diff 存续 | ✅ |
| 「Keep admission bounded…」 | 无并发/簿记面改动 | ✅（不适用面零触碰） |
| 「Verification」：聚焦 + 包 typecheck + 根 typecheck/test | 修复虽为测试-only（非 wire/lifecycle 变化），实际执行**超出**条款要求：包 tsc + 根 typecheck（15 tsconfig）+ 聚焦两文件 + 包全量 90/785 + `--typecheck.only` + 两失败分片逐字 + contract-gates 四步（V29–V35 全绿） | ✅（根 `pnpm test` 全仓与线上 CI 复跑 = Controller 执行面，见 §8-N3） |

## 5. ADR / 协议符合性（本轮修复面）

- **ADR 0032 决策 1（FSM 单份）**：零生产 diff ⇒ 通道/edge 字节不动。✅
- **决策 2/3（缝形态/授权传递）**：修复不触缝面；#423 测试被测对象仍为内部 splice session（符号改名后同一工厂），未迁移至公共 byte-seam 工厂——**内部缝 × 公共缝双轨边界保持**（SA8 §3-8 同结论）。✅
- **后果节（公开面 append-only）**：`index.ts` 不在 diff；blob 逐位过继。✅
- **#423 父侧演进（ADR 0032 :68 注记 / 协议 §17/§23.1–23.4）**：零触碰；父侧冻结面（§23.1 36 型字段表、EM-C7 金标）字节不变。✅
- **SA6 §12.6 授权编辑边界**：被编文件属父增量（契约基线树 `7039f6d` 快照时不存在），非「既有测试文件」枚举对象；编辑类 = §12.6 编辑 2 授权的同一类（机械符号名跟随、断言逐字不变）——SA8 §3-1 裁 implements-existing-decision 并收编 SA4 的复认请求，许可性终认。✅

## 6. 模块责任 / 架构惯例 / 单一事实源 / 生命周期

### 6.1 模块责任
本轮新增改动面 = 两测试文件 + 证据/报告；协议判定、wire 行为、状态机全部零触碰；测试继续以 stub port 直驱内部 splice（缝另一侧打桩的既有测试责任划分不变）。✅

### 6.2 既有架构惯例
- 导入切分形态与 `hub-connection.ts:18`、#418 structure 测试、shim-hub 逐形一致——未引入第二种写法。✅
- 头注登记惯例（改动理由 + 授权出处 + 「断言逐字不变」声明）与 #418 §12.6 编辑 2 同款。✅（括注精确度见 §8-N1）
- commit 信息 `test(ws-replication): update internal splice imports`：type/scope 形态与仓内先例（`test(replication-protocol): …`、`chore: archive …`、`feat(ws-replication): …`）同轨；Controller 对建议文案的压缩定稿属其职责面。✅
- 归档口径：7 证据日志 + 三报告随修复同 commit 入档，与 RA1'' 枚举及 #418/#419/#421 先例一致；commit 后工作树 clean。✅

### 6.3 单一事实源
未恢复别名/再导出 ⇒ 内部 splice 单名 `createHubSessionSink` 单点；公共 `createHubSessionHost` 只在 `hub-session-host.ts`/`index.ts`；类型 `HubSessionSink` 单点在 `hub-split.ts`。无第二事实源引入。✅

### 6.4 生命周期对称性
零生产/零资源生命周期字节；fixture 构造点替换不改变 acquire/release 配对（stub port/节点 fixture 面不变）。✅

## 7. 文件范围与测试质量

### 7.1 文件范围
- ALLOW/DENY 基树口径：13 条 ALLOW 路径在本 commit **零触碰**（交付字节 `4e5ff0a` 原样存续）；DENY 面（`hub-namespace.ts`/`hub-edge.ts`/`testing.ts`/协议文本/7 listen 矩阵/上游包/`package.json`/其余测试）全空。
- 范围扩展（两 #423 文件）：基树前移引入的 stale 消费方；SA3 Deviation #6 显式登记 + `requiresConflictRecheck: true` 提请复认；SA8 §3-1 终认许可并收编（无需扩枚举、无需 override）；SA8 RA4''② 设「实际 diff 超出 26 行机械集即回 SA8」守卫——本轮 census 确认实际 diff = 恰该 26 行机械集（每文件 +9/−4）。**记录义务闭合**：SA9 前轮 §2.4 的「`test/*issue423*` 零 diff」卫生记录按新树口径更新为——交付 commit `4e5ff0a` 对其零 diff；CI 修复 commit `2c87b3b` 仅含该两文件的 D9 符号名跟随（本行即更新落账，SA3/SA8 建议的精确口径逐字兑现）。

### 7.2 测试质量标准
- 零 skip/only/todo/xit；零断言/用例体/选择器/阈值/金标字节变化（changed-lines 过滤 0 命中）；用例数守恒（26 = 8 红 + 18 绿）；fixture 未改指向公共工厂（测试意图存续）。
- 红→绿链：CI 定证（run `35663498235`）+ 本地独立复现（红）→ V29–V35（绿），全部绑定 sha256 冻结字节（§2.4）；CI 失败命令逐字重跑（分片脚本 `scripts/ci-test-shard.mjs` 同源枚举）。
- 失败响亮（编译错 + ESM 链接期 `TypeError`），无吞错/降级/try-catch 包裹/env override/fallback 引入。
- 反软化旁证：修复使既有 #423 断言**恢复执行**（8 红转绿），非删除/弱化断言。

## 8. 非阻断 MINOR 观察（不阻断 approve）

| # | 观察 | 现状/处置 | 来源 |
| --- | --- | --- | --- |
| N1 | 两文件头注把重命名授权出处括注为「SA6 §12.6 授权编辑 2」——严格说 §12.6 编辑 2 授权的是对 **#418 structure 测试**的跟随；重命名本身授权 = 设计 §7 D9 / SA6 U1，括注易被误读 | 散文级精度问题，非规范违例；SA8 §3-1 已以正确口径终认 | SA4-O14（本轮复核存续） |
| N2 | `src/hub-session.ts:49` 构造函数花括号与首语句同行（合法 TS，非仓内格式惯例）——已提交交付的既有态，非本修复面（本轮生产零 diff） | 后续触该文件的票顺手归一 | SA4-O15（既有态登记） |
| N3 | **新 head CI 复跑未落（流程登记）**：SA8 RA1''/RA2'' 的形式闭合凭证 = `2c87b3b` push 后 CI 5 作业转绿 + 根 `pnpm test` 全仓重跑；属 Controller 执行形式（SA3/SA4 禁 commit/push），**阻断交付合并而非本交付标准违例**。本地等价门已全绿且字节绑定（§2.4/§2.5） | Controller 待办；RA4''① 触发条件（新根因）在册 | 本轮核验 |
| N4 | 首次类型导入尝试（`HubSessionSink` 自 `hub-session.js`，被 tsc TS2459 拒绝）的中间态未归档为证据——SA3 已如实披露 | 终态正确性已由 tsc 绿 + 权威形态比对闭合，无需补证 | SA4-O16 |
| N5 | `artifacts/sa6-issue420-*-probe.mts` 三探针仍 import 重命名前旧名 | 不在任何编译/运行 include 面（本轮 grep 0 复证）；SA8 RA3 维持非门禁登记；SA6/Controller 重跑探针时改名 | 前轮 M4 存续 |
| N6 | 夹具头注 `MAX_EARLY_FRAMES` 先例指针仍指 `hub-connection.ts`（符号本体在 `hub-upgrade-admission.ts:26`，值 16 未动） | SA8 RA3 明文非门禁；夹具字节 = 授权交付字节，修复轮正确地未顺手改 | 前轮 M8 存续 |

（前轮 M1/M2/M5/M6/M7 与 M9/M10 的对象均为 `4e5ff0a` 交付字节或历轮证据形态，本修复 commit 对其零 diff，原登记状态存续，不再重复列示；前轮 M3 归档闭合态存续——本轮修复证据已随 `2c87b3b` 全量入档。）

## 9. 结论

**`approve`**。最终已提交 CI 修复（`2c87b3b`）在全部标准轴上符合仓库与工程标准：

1. **正确性（亲证）**：根因归因唯一（两 #423 文件 stale 深路径导入）；符号映射与仓内权威形态逐形一致；类型映射 = 旧别名到底层接口（同一类型，非语义改写）；生产侧替代被 #418 exact-equality 冻结锚决定性封死，消费方跟随是唯一自洽最小路线。
2. **冻结面全部保持（亲证）**：公共导出 blob `08fa49a1…` 逐位过继；`hub-session.ts` 运行时面 exact-equality 锚、SA6 §12.1 签名、#418 双锚、协议/ADR/CONTEXT 文本、DENY 面——全部零 diff；内部缝 × 公共缝双轨边界保持（未改道公共工厂）。
3. **测试质量标准（亲证）**：断言/用例体/选择器/金标零字节变化；零 skip/only/todo；用例数守恒；fixture 测试意图存续；红（CI 定证 + 本地复现）→ 绿（V29–V35 含 CI 逐字命令）链完整且 sha256 绑定到提交字节。
4. **文件范围纪律（亲证）**：commit 文件集 = SA3 清单 10 条 + SA8/SA4 两报告（各自明示归档义务）；范围扩展经 Deviation #6 显式登记并由 SA8 §3-1 终认收编——无静默越界；`git diff --check` RC=0；commit 后工作树 clean。
5. **流程面**：SA9 前轮 §2.4 卫生记录已按 SA8/SA3 建议口径在本报告 §7.1 落账更新；残余项（新 head CI 复跑 = RA2'' 形式闭合、根全仓重跑）为 Controller 执行门，登记为 §8-N3。

**requiresConflictRecheck: false**——依据：本轮被审 diff 的全部决策面（公共 API、wire、schema、持久化、状态机、生命周期、失败语义、override）已经 SA8 CI 修复轮复查逐项裁决闭合（6 no-conflict + 4 implements-existing-decision / 0 hard-conflict / 0 evolution-required），本轮标准复核未发现任何新决策面；前轮 SA9 的 recheck 触发条件（RA2' 五门在 `25c51cd` 基树重取）已实质兑现（V29–V35 在 sha256 绑定字节上全绿，SA8 §3-9 裁 implements-existing-decision），其残余（新 head CI 绿）经 SA8 §10 定性为**执行形式**而非决策重查。若 SA8 RA4'' 任一条件触发（新根因 / diff 超集 / 父 head 再前移未复认 / 决策面提案），按该触发条件进入新一轮 SA8，不由本报告预裁。
