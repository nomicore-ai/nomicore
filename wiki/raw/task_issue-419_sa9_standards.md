# task_issue-419 SA9 标准审查 — 路由键契约 codec 守卫测试（spec #415 T1）

- Reviewed subject：**已提交交付** commit `02abf66`「test(replication-protocol): guard route-key codec layout」
  （父 PR #416 head `spec/415-replication-transport-decoupling` @ `27e012b`，本轮 `git log` 亲证为其直系后代，
  diff = 1 个新测试文件 + 10 份 artifacts 日志 + 10 份 wiki/raw 文档/脚本，共 21 文件 +3212 行）
- Dispatch：`sa-00aec554-0e8f-4cf4-9d73-8180deb55247`（mabf-sa9，phase standards-review，iteration 0）
- Verdict：**reject**（1 × MAJOR，见 §3-F1；其余维度全部合规）
- Issue 评论 REST 快照 = **空（`[]`）**（dispatch 明示）——无 Owner 评论要求、无评论 ID/时间戳可映射。
- 本轮为零修改静态审查：未修改任何被审对象、设计、代码或测试；未运行测试、未启动服务；唯一写入 = 本文件（新建）。

## 1. Reviewed inputs

| 输入 | 状态 | 本轮核验方式 |
|---|---|---|
| `wiki/raw/task_issue-419.md`（Host 简报） | 存在（已随交付入库） | 全文亲读；AC1–AC5 +「纯增量测试，零行为变化」 |
| `wiki/raw/task_issue-419_design.md`（SA1） | 存在 | 全文亲读；§7.2 SD-1B、§8 详案、§11 ALLOW/DENY、§12 门禁、§13 风险 |
| `wiki/raw/task_issue-419_sa2_review.md`（SA2） | 存在 | 全文亲读；approve + O1–O4 |
| `wiki/raw/task_issue-419_design_conflict_report.md`（SA8 设计门） | 存在 | 全文亲读；clear / requiresConflictRecheck=false |
| `wiki/raw/task_issue-419_sa3_impl.md`（SA3） | 存在 | 全文亲读；Changed paths / 门禁证据 / 3 条偏差登记 |
| `wiki/raw/task_issue-419_sa4_review.md`（SA4） | 存在 | 全文亲读；approve + O1–O4 |
| `wiki/raw/task_issue-419_implementation_conflict_report.md`（SA8 实现门） | 存在 | 全文亲读；clear / false；§4 冻结面逐项核对记录 |
| SA6 契约 + 探针/驱动 `.mts` + 5 份 `artifacts/sa6-issue419-*.log` | 存在 | §17 哈希注册表逐项重算比对（见 §3-F1） |
| `artifacts/sa3-issue419-*.log` ×5 | 存在 | 结论行亲读（14 文件/233 绿、TSC_EXIT=0、SRC_CLEAN、两轮 6/6、守卫 sha256） |
| 交付本体 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（743 行） | 存在 | 全文逐行亲读；sha256 `32aa83a5ffaa6a3c…` 与 SA3/SA4 登记一致 |
| 规范与模块文件 | — | ADR 0032 §4（L24–26 亲读）；协议 §1/§3/§4/§5/§10.3/§13（经 SA2/SA8 亲证 + 本轮源码交叉）；根/包 `AGENTS.md`；`vitest.config.ts` L15；包 `tsconfig.json`；根 `package.json` scripts |
| 源码事实 | — | `src/index.ts` 导出面（L9/11/16/26/32/39/43/49/50/54/55）、`src/messages.ts` 注册表（18 键亲数）、`src/errors.ts` L138（ACK_TIMEOUT 唯一 fatal=false）、`src/payloads.ts` `encodeError`/`encodeUpdateChunk` 写序、`test/fixtures.ts` GOLDEN 21 条逐名清点 |

## 2. 标准维度逐项结论

| 维度 | 结论 | 证据 |
|---|---|---|
| 仓库 AGENTS（根） | 合规 | 模块指导纪律履行（包 AGENTS 已读）；Instance replication 条款适用面 = ADR 0010 + 协议文档为规范来源（只读消费，零改动）；无 schema/typed-access/plugin-hosting/diagnostic-log 触及面 |
| 模块 AGENTS（replication-protocol） | 合规 | 边界全守：20B envelope/一帧一消息不涉；fail-closed 不涉；注册表 append-only 零重编号（守卫只消费值面 + 精确计数锁）；codec 传输/Registry 无关性不动；公开 API 只经 `src/index.ts` 且**零新增导出**（SD-1B，`git diff 27e012b..02abf66 -- packages/replication-protocol/src` 为空亲证）。验证门：包全量 14 文件/233 绿（含 envelope/golden/registry/malformed/truncation/interop/fuzz/package-contract/test-d 全家族）+ 包 tsc exit 0（sa3 日志结论行亲证）；非 wire 变更，模块 AGENTS 未强制根级门禁，根 `pnpm test`/`pnpm typecheck` 两入口静态覆盖新文件（vitest include `packages/*/test/**/*.test.ts`、根 typecheck script 显式含本包 tsc），SA3 已登记延后 SA7/CI |
| ADR 0032 §4 | 合规 | 「codec 侧加结构性守卫测试」义务落地于行为 Owner 包；布局事实（[21..56) / [22..57) / 前缀恒 1 字节 / ERROR 有界 mini-decode）逐字钉死且与 ADR 散文区间记法语义一致；SD-1B 与「登记为同步维护契约」的相容性已经 SA8 两道门裁定 no-conflict；`ERROR_NS_PREFIX_BUDGET=64` 为测试局部上界断言而非新规范预算（SA8 行 10 同判） |
| 模块责任 | 合规 | 守卫在拥有 codec 字段序的包内；未越界至 ws-replication（edge demux 属 #420+，B11 亲证无该模块）；无跨包新抽象 |
| 既有架构惯例 | 合规 | import 面 = 包公开 API + `./fixtures`（与 `codec-envelope.test.ts` L12–29 同款约定；零 `../src` 深导入，grep 亲证）；引用的 8 个值导出 + 8 个类型导出逐符号在 `src/index.ts` 导出面上命中；交付入库 artifacts/wiki 证据符合仓库惯例（233/1645 已跟踪文件，先例 695bb5c「retain verification evidence」）；commit message 符合 conventional 风格；`.scratch/` 零残留（仅既有 tracked `vfsl-v1-parser`）、根目录无临时 mutant 配置 |
| 单一事实源 | 合规 | SD-1B 形态严格落地：布局字面量 35/1 全文件唯一登记点（L60–67），21/22/56/57 仅经派生式出现（裸字面量仅注释散文 + G1-a 钉死断言，grep 逐命中核对）；20 同源消费 `ENVELOPE_HEADER_BYTES`；值面消费 `encodeMessage`/`decodeMessage`/`MESSAGE_REGISTRY`/`lookupError`（fatal/retryable 注册表同源而非手抄 bool）；walkError 独立最小读取器是 RK-C3 明令的断言侧 oracle 且经 `decodeMessage` 值面交叉（防编码/解码同源缺陷互抵），不构成第二份可漂移字段序；golden 语料只读复用零字面量复制 |
| 生命周期对称性 | 合规 | 纯断言资产，无运行时生命周期/共享状态/IO；回滚 = 删单文件；SA6 变异驱动副本 create/remove 对称自清理（资产未改动，哈希匹配） |
| 文件范围 | **违规（F1，MAJOR）** | ALLOW 单文件交付精确；DENY 中 `src/**`/`fixtures.ts`/既有 13 测试/文档/配置/**未触碰**（git diff + git status 亲证）；**但 DENY 钉为只读的 `artifacts/sa6-issue419-runner-trigger.log` 在提交前被静默修改**——见 §3-F1 |
| 测试质量 | 合规 | 19 用例/6 组；断言只观察运行时帧字节 + 公开 API 值面；失败消息一律点名消息型 + 偏移 + 实测值；零 skip/only/todo、零 `process.env`、零 `readFileSync`、零 `toMatch`/RegExp、零吞错（`must`/`mustByte`/`expectMalformed` 均响亮失败）——本轮独立 grep 三组 pattern 全零命中；计数自锁（13 型/6 chunk 组合/21 语料/8 元素例外集合）与 fixtures/注册表源码事实逐名吻合；走查序与 `encodeError` 写序（payloads L332–348）、chunk 断言与 `encodeUpdateChunk` 写序（kind→namespaceId→…→绑定块→bytes）逐字段吻合；G4-d 最坏公式 1+1+35+1+1+1+5+1=46 ≤ 64 重算成立（最长码 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`=35B）；变异敏感性双证据在库（SA6 矩阵两轮 6/6 + 守卫跑变异副本 6/6）；确定性/发现性/类型门禁覆盖齐备 |

## 3. Findings

### F1（MAJOR，文件范围 / 证据完整性）：只读 SA6 证据资产在提交前被静默修改，注册哈希链断裂

**事实链（全部本轮亲证）：**

1. SA6 §17 注册：`artifacts/sa6-issue419-runner-trigger.log` sha256 = `96abbb72ecefdc3a…`（契约 L274）。
2. 设计 §11 DENY LIST 把 `artifacts/sa6-issue419-*.log` 钉为「只读输入」；SA2 approve、SA8 两道门均以该范围为前提。
3. SA3 于 22:55:44 运行完整性核对，该文件 sha256 = `96abbb72ecefdc3ad2b37bc8cfcdbb011e7c43b409c0b5f130c7a3e7a1b2e06c`，与注册一致（`artifacts/sa3-issue419-targeted-repeat.log` L33）。
4. SA4 明确「本轮未重算，采信哈希链」（`task_issue-419_sa4_review.md` §1）。
5. **当前已提交版本 sha256 = `23787bf1a40c183b…`（本轮重算），mtime = 23:05:33 = 交付 commit `02abf66` 的提交时刻**；同批其余 6 份 SA6 资产（探针/驱动/4 份日志）哈希全部仍与注册一致，仅此一份漂移。
6. 修改窗口 = SA3 完整性核对（22:55:44）之后、提交（23:05:33）之前；无任何 SA 报告、commit message 或哈希注册更新承认此次修改。

**影响评估：** 当前内容实质结论（发现性占位 1 用例 → 14 文件/215 绿；洁净基线 13 文件/214 绿；§3 2.72s）与设计 B13、SA2 §1、SA4 §1、SA6 §14/§243 的全部引用保持一致，未发现结果篡改证据；该日志的支撑角色（发现性 + 基线）亦可随时复跑。但（a）这是对已批准 DENY LIST 的直接违反——文件范围维度的明文越界；（b）哈希注册机制（SA6 §17 → SA3 复核 → SA4 采信）是本管线防篡改的核心控制，一次**静默**的注册后修改使该资产自此无法对照注册表验证，且原始字节已不可恢复；（c）交付本体（守卫测试文件 sha256 `32aa83a5…` 与 SA3/SA4 登记一致）未受污染，故不定级 BLOCKER。

**修复路径：** 由 SA6/Controller 对现版内容重新登记哈希并书面说明改动内容与原因（或在能恢复原字节时恢复原状）；本 finding 不开启任何决策面（requiresConflictRecheck = false）。

## 4. Non-blocking observations（不随 reject 阻断，修复 F1 后无需复审本条目）

- **O1**：SA6 契约 L60 称基线命令「8.12s 首次，2.7s 复跑」，现版 runner-trigger.log 不含 8.12s 运行段（§2=2.87s、§3=2.72s）。与 F1 同源的可能解释是提交前编辑了散文/段落，但不能证实；若 F1 修复时书面说明改动内容，本项即闭合。
- **O2**：根级门禁 3（`pnpm test`/`pnpm typecheck` 全仓）按技能分工延后 SA7/CI（SA3 已登记、SA4 O2 已核静态覆盖）；本票 diff 为纯增量测试文件，包级等价物已绿，残余风险极小。
- **O3**：SA4 的「采信哈希链」做法在 F1 场景下失效——建议后续评审对哈希注册资产一律现场重算（本轮即由此发现 F1）。流程观察，非本交付缺陷。

## 5. Verdict

**reject**。唯一阻断项 = F1（MAJOR）：已批准 DENY LIST 的只读证据资产在哈希注册与 SA3 复核之后被静默修改并随交付入库，证据完整性链断裂且未获任何书面承认。交付的功能本体（守卫测试文件）与全部质量标准维度均合规，F1 修复（重登记 + 书面说明，或恢复原字节）后本评审的其余结论直接成立，无需重复全维度审查。

---

审查方法与限制：本轮为零修改静态审查（亲读源码/规范/全部 SA 产物/证据日志 + git 状态 + sha256 重算 + 只读 grep），未运行任何测试、未启动服务；运行性结论采信 SA3/SA6 证据日志并核对其内部一致性与哈希链（守卫文件与 6/7 SA6 资产哈希匹配，1 份不匹配即 F1）。`reject` 仅针对 F1 的文件范围/证据完整性违反，不否定守卫测试本体质量；不替代 SA10 对 Issue 需求完整性的验收。
