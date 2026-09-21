# task_issue-419 SA9 标准审查 — 路由键契约 codec 守卫测试（spec #415 T1）

- Reviewed subject：**当前已提交最终交付** = HEAD `bd75a2c8e0f729aecb2fc4b792e50d0a04f5f2b8`
  「test(replication-protocol): canonicalize evidence contract」（**C1 规范形证据契约修复**），叠加于
  `02abf66`「test(replication-protocol): guard route-key codec layout」；父 PR #416 head
  `spec/415-replication-transport-decoupling` @ `27e012b6606e48797842a79e11e3505819c34cc6`，本轮
  `git merge-base` 亲证 = 该值且为交付直系祖先（HEAD 领先恰 2 个提交）。
  全量 diff（`27e012b..bd75a2c`）= **28 个纯新增文件**：1 个新测试文件（743 行）+ 13 份
  `artifacts/*issue419*.log` + 14 份 `wiki/raw/task_issue-419*` 文档/脚本——**零 `src/`、零 fixtures、
  零既有测试、零 `docs/`、零 `CONTEXT.md`、零配置改动**（name-status 全 `A`，本轮亲证）。
- Dispatch：`sa-89f28be3-a874-424a-a44e-4ac7738350fd`（mabf-sa9，phase standards-review，**iteration 1**；
  iteration 0 = `sa-00aec554…`，verdict reject、唯一阻断 §3-F1，其报告已随 `bd75a2c` 入库即本文件前版）。
- Verdict：**approve**（0 × BLOCKER / 0 × MAJOR；iteration 0 的 F1 经 C1 修复**闭合**，本轮独立重算全绿；
  非阻断观察见 §4）。
- Issue 评论 REST 快照 = **空（`[]`）**（dispatch 明示）——无 Owner 评论要求、无评论 ID/时间戳可映射。
- 本轮为零修改静态审查：未修改任何被审对象、设计、代码、测试或证据；未运行测试、未启动服务；
  唯一写入 = 本文件（iteration 0 报告的原位更新，SA9 固定产物路径）。

## 1. Reviewed inputs

| 输入 | 状态 | 本轮核验方式 |
|---|---|---|
| `wiki/raw/task_issue-419.md`（Host 简报） | 存在（已入库） | 全文亲读；AC1–AC5 +「纯增量测试，零行为变化」+ 空 Comments |
| `wiki/raw/task_issue-419_design.md`（SA1） | 存在 | 全文亲读；§7.2 SD-1B、§8 详案、§11 ALLOW/DENY（L374–392）、§12 门禁、§13 风险 |
| `wiki/raw/task_issue-419_sa2_review.md`（SA2） | 存在 | 头部 + verdict 亲读：approve（无 BLOCKER/MAJOR，O1–O4 非阻断） |
| `wiki/raw/task_issue-419_design_conflict_report.md`（SA8 设计门） | 存在 | 头部亲读：clear / requiresConflictRecheck=false |
| `wiki/raw/task_issue-419_sa3_impl.md`（SA3，iteration 3 版，500 行） | 存在（工作树 == HEAD） | 全文亲读；Changed paths / 三轮验证表 / 偏差 1–6 / Deferred / 提交消息史 |
| `wiki/raw/task_issue-419_sa4_review.md`（SA4，**iteration 1 版**，197 行） | 存在（HEAD 版经 `git show` 提取亲读；工作树另有未提交 iteration-3 WIP，见 §4-O1） | 全文亲读；approve；§12-R1 旧期望的取代链核对 |
| `wiki/raw/task_issue-419_implementation_conflict_report.md`（SA8 实现门，iteration 2，95 行） | 存在 | 全文亲读；clear / false；§4 冻结面、§7 Required actions、§9 理由 |
| `wiki/raw/task_issue-419_sa10_spec.md`（SA10，89 行） | 存在 | 全文亲读；approve（0 BLOCKER/MAJOR）；AC1–AC5/RK-C1–C7 映射 |
| `wiki/raw/task_issue-419_sa6_contract.md`（SA6，iteration 2 原位修订版，479 行） | 存在 | 全文亲读；§17 C1 登记基准 + 10 行注册表 + §18 冲突裁决（根因/被否路径/R1–R6/§18.16 自证） |
| SA6 可执行资产 ×3（探针/驱动 `.mts`、`whitespace_gate_check.sh`） | 存在 | sha256 现场重算与 §17 一致；脚本头注亲读（默认只读、`--apply` 属 Controller 且哈希不符即 ABORT） |
| `artifacts/sa6-issue419-*.log` ×6 + `artifacts/sa3-issue419-*.log` ×8 | 存在 | 结论行/关键行亲读：14 文件/233 绿 + 0 类型错误、TSC_EXIT=0、两轮 `MUTATION_RESULT 6/6 expected`、守卫 19×2、门禁 rc=2→rc=0、§17 10/10 MATCH、11 路径 C1 扫描全 PASS |
| 交付本体 `packages/replication-protocol/test/codec-route-key-guard.test.ts` | 存在 | **全文 743 行逐行亲读**；sha256 `32aa83a5ffaa6a3c…` 本轮重算 = SA3/SA4/SA9(iter0)/SA10 四方登记 |
| 规范与模块文件 | — | ADR 0032 §4（L24–26 亲读，状态行「已接受…wire 零变化」）；协议 §1/§3/§4/§5/§10.3/§13（经 SA2/SA8/SA10 亲证 + 本轮源码交叉）；根/包 `AGENTS.md`；`.editorconfig`（C1 政策依据）；`vitest.config.ts` include；包 `tsconfig.json`；根 `package.json` scripts |
| 源码事实 | — | `src/index.ts` 导出面（L9/11/16/26/54 逐符号命中守卫 import）、`src/messages.ts` 注册表（18 键亲数：3 connection + 1 either + 14 namespace）、`src/errors.ts`（`ACK_TIMEOUT` L138 唯一 fatal=false；最长码 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`=35B 亲算）、`test/fixtures.ts` GOLDEN 21 条逐名清点（13 域 + 3 chunk + 2 ERROR + 3 连接级） |
| Git 状态 | — | `git status --porcelain -uall` 仅 ` M` SA4 文件（下游未提交 WIP，非本轮被审交付）；`git diff --cached` 空；`.scratch/` 仅剩 tracked `vfsl-v1-parser`；根 `.scratch-*.md` 两件均 tracked 既有物 |

## 2. 标准维度逐项结论

| 维度 | 结论 | 证据 |
|---|---|---|
| 仓库 AGENTS（根） | 合规 | 模块指导纪律履行（包 AGENTS 已读并作为边界基准）；Instance replication 条款适用面 = ADR 0010 + 协议文档为规范来源（只读消费，零改动）；无 schema/typed-access/plugin-hosting/diagnostic-log 触及面 |
| 模块 AGENTS（replication-protocol） | 合规 | 边界全守：20B envelope/一帧一消息不涉；fail-closed 不涉；注册表 append-only 零重编号（`src/` 对 `27e012b` 零 diff，守卫只消费值面 + 精确计数锁）；codec 传输/Registry 无关性不动；公开 API 只经 `src/index.ts` 且**零新增导出**（SD-1B）。验证门：包全量 14 文件/233 绿——envelope(13)/messages-golden(27)/malformed(37)/roundtrip-truncation(8)/version-interop(25)/registries(13)/fuzz-property(5)/package-contract(5)/issue242(29)/issue246(22)/issue299(17+5)/route-key-guard(19) + `--typecheck` 0 类型错误（suite 家族全齐，日志逐项亲证）+ 包 tsc exit 0；非 wire 变更，根级两入口静态覆盖新文件（vitest include `packages/*/test/**/*.test.ts`、根 typecheck script 显式含本包 tsc、包 tsconfig include `test/**/*.ts`），根级实跑延后 SA7/CI 已三方登记（SA3 Deferred / SA4 O2 / SA10 §5-2） |
| ADR 0032 §4 | 合规 | 「codec 侧加结构性守卫测试」义务落地于行为 Owner 包；布局事实（[21..56) / [22..57) / 前缀恒 1 字节 / ERROR 有界 mini-decode）逐字钉死且与 ADR 散文语义一致（守卫头注 L5–7、G1-a L313–323）；SD-1B 与「登记为同步维护契约」的相容性已经 SA8 两道门裁定（设计门行 3、实现门 §2）；`ERROR_NS_PREFIX_BUDGET=64` 为测试局部上界（实测最坏 46，公式 1+1+35+1+1+1+5+1 本轮重算成立）而非新规范预算 |
| 模块责任 | 合规 | 守卫在拥有 codec 字段序的包内；未越界至 `ws-replication`（edge demux 属 #420+）；无跨包新抽象；C1 修复的登记权归 SA6（契约 owner）、执行经 dispatch 授权链（§3-F1 闭合详述） |
| 既有架构惯例 | 合规 | import 面 = 包公开 API（8 值 + 8 类型，逐符号命中 `src/index.ts` 导出面）+ `./fixtures`（与 `codec-envelope.test.ts` 同款约定；零 `../src` 深导入，grep 亲证）；交付入库 artifacts/wiki 证据符合仓库惯例（237 份 tracked `artifacts/`、1648 份 tracked `wiki/raw/`，本交付 28 件全部新增无改写）；commit message 符合 conventional 前缀风格（`test(replication-protocol): …` ×2，与仓史一致）；`.scratch/` 零残留 |
| 单一事实源 | 合规 | SD-1B 形态严格落地：35/1/64 字面量全文件唯一登记点（L60–67），21/22/56/57 仅经派生式 + G1-a 钉死断言 + 注释散文出现（grep 逐命中核对）；20 同源消费 `ENVELOPE_HEADER_BYTES`；值面消费 `encodeMessage`/`decodeMessage`/`MESSAGE_REGISTRY`/`lookupError`（fatal/retryable 注册表同源而非手抄 bool）；`walkError` 独立最小读取器是 RK-C3 明令的断言侧 oracle 且全值面经 `decodeMessage` 交叉（防编码/解码同源缺陷互抵），不构成第二份可漂移字段序；golden 语料只读复用零字面量复制。**证据面**：SA6 §17（C1 修订版）是注册哈希唯一权威；legacy raw 值以 superseded 行保留并附理由，下游报告的旧期望（SA4 iter-1 §12-R1、f1 日志 §8/R1、SA8 iter-1 §7-2）均被 §17/R5 书面取代——无第二权威、无静默漂移 |
| 生命周期对称性 | 合规 | 纯断言资产，无运行时生命周期/共享状态/IO；回滚 = 删单文件；`whitespace_gate_check.sh` 默认只读（私有索引副本证明），`--apply` 为 Controller 专用且落盘哈希不符即 ABORT，scratch 收尾自删并断言不存在；SA6 变异驱动副本 create/remove 对称（资产未改动，哈希匹配） |
| 文件范围 | 合规 | 产品面 = ALLOW 单文件精确；DENY 全项零触碰（`src/**`、fixtures、既有 13 测试、协议/ADR/CONTEXT、`ws-replication/**`、配置——`27e012b..bd75a2c` name-status 全 `A` 亲证，对 HEAD 的 packages/docs/CONTEXT/.editorconfig diff 为空）。**iteration 0 的 F1 越界（DENY 只读资产被静默修改）已经 C1 修复闭合**，闭合链见 §3-F1 |
| 测试质量 | 合规 | 19 用例/6 组（G1×4、G2×2、G3×4、G4×5、G5×1、G6×3）；断言只观察运行时帧字节（encode 产出 + golden hex 解码双面互锁）与公开 API 值面；失败消息一律点名消息型 + 偏移 + 实测值；零 skip/only/todo、零 `process.env`、零 `readFileSync`、零 `toMatch`/RegExp、零吞错（`must`/`mustByte`/`expectMalformed` 均响亮失败）——本轮独立 grep 四组 pattern 全零命中；计数自锁（14 构造/13 型/6 chunk 组合/21 语料/8 元素例外集合/2 ERROR golden/scope 两态）与 fixtures/注册表源码事实逐名吻合（本轮亲数）；走查序与 `encodeError` 写序、chunk 断言与 `encodeUpdateChunk` 写序逐字段吻合（SA2/SA4 亲证 + 本轮协议 §13 交叉）；变异敏感性双证据在库（SA6 矩阵两轮 6/6 + 守卫跑变异副本 6/6）；确定性（无计时器/网络/文件 IO，`maxWorkers:1`，目标文件 ×2 复跑一致） |

## 3. Findings

无 BLOCKER / 无 MAJOR。

### F1（iteration 0 MAJOR）闭合核验 —— C1 规范形证据契约修复

**iteration 0 判定回顾**：DENY 钉为只读的 `artifacts/sa6-issue419-runner-trigger.log` 在哈希注册（`96abbb72…`）
与 SA3 复核（22:55:44）之后、提交（23:05:33）之前被静默修改（已提交 `23787bf1…`），注册哈希链断裂。
修复路径 2 = 「由 SA6/Controller 对现版内容重新登记哈希并书面说明改动内容与原因」。

**本轮对闭合要件的独立核验（全部现场重算，不采信链上值）**：

1. **重登记由适格主体完成**：SA6（注册表 owner）将 §17 登记基准原位修订为 **C1 规范形**
   （= 已提交 `.editorconfig [*]` 三条 ∩ 强制门禁 `blank-at-eol`+`blank-at-eof`——仓库自身策略的交集，
   非新造规范）；runner C1 = `23787bf1a40c183b…`（69 行/4321B，blob `46ff267d…`），f1 日志 C1 =
   `3b861d2dc34eff92…`（221 行/15420B，blob `0996a324…`）；旧 raw 值（`96abbb72…`/`2932f2a7…`）以
   legacy/superseded 行保留并附违规理由，历史取证不丢失。
2. **登记值 == 已提交字节（10/10 MATCH，本轮 sha256 全量重算）**：探针 `b340dcd3…`、驱动 `3631b43f…`、
   probe-green `1960c24a…`、mutation-sensitivity `c8f67f9b…`、capability-gap `b054b3c0…`、
   tsc-baseline `1f23a7a0…`、runner `23787bf1…`、f1 `3b861d2d…`、脚本 `b7e20113…`、冲突日志
   `d152aeff…`——逐项与 §17 登记一致。
3. **R5 提交后终态期望成立**：`git show HEAD:…runner-trigger.log | sha256sum` = `23787bf1a40c183b…`、
   `…f1-evidence-restore.log` = `3b861d2dc34eff92…`（本轮亲算）；HEAD 树与索引均不含 raw blob
   `c183ba29…`；索引无 staged 残留。
4. **书面说明要件**：SA6 §18 全量裁决（症状/根因「旧登记把不可提交字节流定为权威」/被否路径 B1–B6/
   R1–R6 责任表/变异反证/私有索引红→绿证明）+ SA3 报告偏差 4–6 与三轮验证表 + SA8 实现门 iteration 2
   （clear / requiresConflictRecheck=false；override 表为空——既定合规路径的执行而非决策演进）。
   改动内容定量到字节（runner = 末尾空行 1 个 LF；f1 = 第 20 行行尾空格 1 字节 @0-based 1330），
   未证事项（提交期归一化器身份）保持「推断」标注，未升格为事实。
5. **可提交性终态**：全量交付 diff `git diff --check 27e012b..bd75a2c` **rc=0 零输出**（本轮亲跑）；
   runner 尾字节 `…2.18s)\n` 单 LF、f1 第 20 行 `<\n`（od 亲证）；C1 形对末尾归一化幂等，复发面消除。
6. **业务语义零污染**：守卫文件 sha256 `32aa83a5ffaa6a3c…`（743 行）两轮交付零变化；
   `packages/**`、`docs/**`、`CONTEXT.md`、`.editorconfig` 对 `27e012b` 零 diff。

**结论**：F1 的两项修复要件（重登记 + 书面说明）均由适格主体足额兑现，证据完整性链在 C1 基准上复原且
本轮独立重算全绿——**F1 闭合**。iteration 0 §4-O1（「8.12s」散文）依其自设闭合条件（书面说明改动内容）
随 SA3 §F1-6 说明闭合；§4-O3（注册资产现场重算）已被 SA4 iteration 1 起采纳为本管线纪律，本轮继续执行。

## 4. Non-blocking observations（不阻断 approve）

- **O1（已提交 SA4 报告为 iteration 1 版，其 §12-R1 旧期望已被同 commit 取代）**：HEAD 入库的 SA4 评审
  成文于 C1 裁决之前（基于「恢复 raw 字节」路径），其 §12-R1 期望 `96abbb72…` 已被同 commit 的
  SA6 §17/R5 与 SA8 §7-1 书面取代、且该表自带「复发 → 转 SA6/Controller 重登记」的正确路由——取代链完整，
  非静默不一致。工作树另有未 stage 的 SA4 iteration-3 WIP（`git status` 唯一脏条目），已覆盖 C1 终态，
  属下游在制产物、非本轮被审交付的一部分；本评审不修改之。
- **O2（根级门禁 3 延后）**：根 `pnpm test`/`pnpm typecheck` 全仓实跑按技能分工延后 SA7/CI（SA3 Deferred /
  SA4 O2 / SA10 §5-2 三方登记）；本票 diff 为纯增量测试文件 + 证据/wiki 产物，包级等价物已绿，两条根入口
  对新文件的静态覆盖本轮亲证（vitest include、根 typecheck script 含本包 tsc、包 tsconfig include test/**），
  残余风险极小，收口时补跑即可。
- **O3（commit subject 未带 `(#419)`）**：两个交付提交用 `test(replication-protocol): …` 前缀，符合仓内
  conventional 风格且与内容相符；SA3 建议稿中的 `fix(#419)` 版本在报告内被明示取代，Controller 选用
  现题铭不构成规范违反，仅记录。
- **O4（SA6 契约 L60「8.12s 首次」散文保留）**：契约 owner（SA6）未编辑该散文，SA8 §3 已裁定此为正确的
  非 override 处置；O1 闭合不依该文本。提示性记录，无行动项。

## 5. Verdict

**approve**。当前已提交最终交付（`02abf66` + `bd75a2c`）在仓库 AGENTS、模块 AGENTS、ADR 0032 §4、
模块责任、既有架构惯例、单一事实源、生命周期对称性、文件范围与测试质量九个维度全部合规；iteration 0
唯一阻断项 F1（MAJOR）经 C1 规范形证据契约修复足额闭合（§17 重登记 10/10 本轮独立重算 MATCH、
R5 提交后终态成立、书面说明与裁决链完整、全量交付门禁 rc=0）。4 条非阻断观察不阻断。

---

审查方法与限制：本轮为零修改静态审查（亲读源码/规范/全部 SA 产物/证据日志 + git 状态/对象库只读取证
+ sha256 现场重算 + 只读 grep + `git diff --check`），未运行任何测试、未启动服务；运行性结论
（14 文件/233 绿、tsc exit 0、两轮变异 6/6、守卫 19×2）采信入库证据日志并核对其结论行、计数自洽性
（13/214 基线 + 19 守卫 = 14/233）与哈希链（守卫文件与 §17 全 10 行注册资产本轮重算一致）。
`approve` 不替代 SA7 对根级全仓门禁的收口验证，亦不预支 SA10 对 Issue 需求完整性的终审
（SA10 iteration 0 已 approve 于 `02abf66`，C1 修复不触碰其验收面）。
