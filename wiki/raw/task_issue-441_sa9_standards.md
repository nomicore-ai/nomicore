# SA9 Standards 评审 — issue #441：doc-runtime Record/parent fast path 接线与 S9 收窄（ADR 0034）

- Reviewed subject：**最终已提交交付** commit `61778bca5ce18ea68147b30cefa15e9f59961466`
  （`feat(doc-runtime): add record mutation fast path`，分支 `mabf/issue-441`，父 = `3fd6aa8`
  = 设计/SA6/SA2/SA8/SA3/SA4 共同声明基线；工作树 tracked 面与 commit 一致，`git status` 仅
  未跟踪证据/简报/划痕文件）。
- Verdict：**approve**（无 BLOCKER / MAJOR；3 项非阻塞 MINOR 观察，见 §8）。
- requiresConflictRecheck：**false**（本审对规范面做独立陈旧扫描与逐字核对，未发现新增
  ADR 冲突风险；设计→SA2→SA8→SA4 链登记的复查项均已在 SA8 实现后复查闭合）。
- Owner 评论要求：**无**（Host 简报明文 REST comment read 为空；简报 Comments 段空；
  SA6 §2 / SA2 §4 / SA8 / SA3 / SA4 五源一致）。
- 评审方法：静态审查 + 只读 git/哈希/awk 提取比对 + 证据日志核对。**未运行测试、未启动
  服务、未修改任何代码/设计/测试**（SA9 技能边界）。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-441.md`（简报，AC1–AC6，Comments 空） | 已读 |
| `wiki/raw/task_issue-441_design.md`（SA1 iteration 1，683 行） | 已读（全文） |
| `wiki/raw/task_issue-441_sa6_contract.md`（approved：18 红 + 27 负控 + 49 项探针） | 已读（关键节） |
| `wiki/raw/task_issue-441_sa2_review.md`（approve） | 已读（全文） |
| `wiki/raw/task_issue-441_design_conflict_report.md`（SA8 设计后 clear） | 已读（全文） |
| `wiki/raw/task_issue-441_sa3_impl.md` / `_sa4_review.md`（approve） | 已读（全文） |
| `wiki/raw/task_issue-441_implementation_conflict_report.md`（SA8 实现后 clear） | 已读（全文） |
| commit `61778bc` 全量 diff（3 tracked 源/文档文件 + 3 新测试文件 + 8 wiki 工件） | 逐 hunk 审查 |
| 规范面：根 `AGENTS.md`、`docs/AGENTS.md`、`packages/doc-runtime/AGENTS.md`、`packages/vfsl/AGENTS.md`、ADR 0034/0033/0007/0010、CONTEXT.md L144/L202、ADR 0025/0026 | 已读/核对 |
| 源码锚点：`mutation-local.ts`（闸门 + F1–F5 + legacy + #436 数组先例）、`mutation.ts`（`commitPrepared`/`composeBatchVerify`）、`install-verify.ts`（`VerifyPlan`/`verifyBoundaryInstallFacts`/`verifyPrepared`/`verifyBoundaryIntact`）、`extract.ts`（`carrierMismatchIssue`/`walk`）、`validate-patch.ts`（接缝 L1219–1289 + `judgeClosedObjectDelete` L1178–1195 + 规划层 union 冻结）、`packages/vfsl/src/index.ts`（导出面） | 逐锚点对齐 |
| 测试面：契约 18 / 负控 27 / 夹具 310 行 | 全文/关键面 |
| 证据工件：`artifacts/sa3-issue441-*`、`artifacts/sa6-issue441-*` | 已核对 |

## 2. 仓库工程标准符合性（逐维度独立核验）

### 2.1 AGENTS.md 义务链

| 义务来源 | 条款 | 核验结果 |
|---|---|---|
| `packages/doc-runtime/AGENTS.md` | 校验失败零写入 | ✓ F1/F3/F4 一切失败在 `transactGuarded` 之前 `return {kind:'fail'}`（代码序核对）；NC1–NC11 字节不变断言锚定 |
| 同上 | detached 构造 + 单 guarded transaction 安装；写后不变量失败 = fatal | ✓ F4 复用 legacy 同款 `descendStructureNode`+`buildDetachedValue`；`commitPrepared`/`install-verify.ts` 零改动（空 diff），E201-C/D 语义不变 |
| 同上 | 公共 API 只经 `src/index.ts`；public-surface guard 覆盖全部导出 | ✓ `index.ts` 空 diff；新 import 全部为 `@nomicore/vfsl` **既有**公共导出（`index.ts` L137–154 核对）；guard 在根 test 471 files 内绿 |
| 同上 | carrier mechanics 在本包，lifecycle 归 namespace-runtime | ✓ 零生命周期面变化 |
| `packages/vfsl/AGENTS.md` | 包契约/边界 | ✓ `packages/vfsl/**` 空 diff（DENY 兑现；接缝为 #440 冻结面，本票纯消费） |
| `docs/AGENTS.md` | 「Amend or supersede prior decisions explicitly…」+「…update every normative document whose stated contract changed」 | ✓ ADR-0007 追加「ADR 0034 修订注记（2026-09-22）」（+19/−0，追加式）与实现**同一 commit**（同变更集纪律的最终载体）；本审独立陈旧扫描（`grep "按边界规模\|delete 的父 map 位\|delete 父位" docs/ CONTEXT.md`，排除 0033/0034）：规范命中恰 ADR-0007 条款原文 + 两处注记（0033/0034）+ CONTEXT L144（同句已含「自 ADR-0034 起」限定，`0a91f14` 立法）——无未处置陈旧面 |
| 同上 | 「Link to the authoritative source instead of copying」 | ✓ 注记以路径引 ADR 0034/0033、以「标题点名」引 ADR-0010，未复制规则文本 |
| 同上 | `git diff --check` | ✓ `git diff --check HEAD~1 HEAD` 无输出 |
| 根 `AGENTS.md` | typed writes / schema authoring / 协议族 / worktree 纪律 | ✓ 零 schema、零 Namespace 数据面、零 wire/协议变更；分支在仓内 worktree 惯例下 |

### 2.2 ADR 符合性

| 决策 | 落地核验 |
|---|---|
| ADR 0034 决策 1（闸门 + fast path 管线 + 永久双轨 + 值位 union 不阻断 + issue 路径逐字兼容） | ✓ 闸门双条件合取 `plan.node.kind==='object' ∧ resolve(boundaryNode).kind==='map'`（mutation-local.ts L304–305）；union map 位由规划层首穿越冻结 kind=`union` 结构性隔离（validate-patch.ts L798–801 复核）；F1 载体检查经共享构造 `carrierMismatchIssue([], 'Y.Map', live)` 与 legacy S5 首错同文案同 path；F3 旧值不读；issue rebase `[...plan.prefix, ...issue.path]`（接缝 L1286） |
| ADR 0034 决策 2（封闭对象 delete 静态必填判定） | ✓ 纯消费 `judgeClosedObjectDelete`（L1178–1195：optional 先查 → `unknown` 标量跳过 → 必填 `缺少必填字段 "<key>"`），doc-runtime 零新增判定逻辑 |
| ADR 0034 决策 3（S9 收窄；E201 语义不变） | ✓ F5 返回 `verify:{kind:'install-facts',facts}`；`install-verify.ts` 空 diff（`VerifyPlan`/`verifyBoundaryInstallFacts` 共享单实现，`verifyPrepared` 穷尽分派复核）；legacy 轨 `boundary` 双核逐字不变 |
| ADR 0034 决策 4（触达面 = 载体 + 目标键位；载体位仍响亮拒绝） | ✓ fast path 无整 map walk/父值提取/兄弟读；F1 逐字复刻（NC10/NC11 锚定）；**legacy 块与 HEAD 逐字节一致——本审独立 awk 提取 `3fd6aa8` vs `61778bc` 比对 `diff` 为空（LEGACY_VERBATIM_OK）** |
| ADR 0034 决策 5/6（禁容器级特判；复用 seam 不另起平行机制） | ✓ 接缝以单 entry 合成视图过共享 `validateSubtree`；doc-runtime 无第二校验源；闸门/F1–F5 镜像 #436 数组结构（L394–446 逐点同构） |
| ADR-0007 #237 条款 1/4(ii)/7（SA8 evolution-required） | ✓ 注记 L142–159 与设计 §7.6 建议文案逐字一致（本审对 diff 全文复核：带日期标题 + 授权链段 + 引用块内容段，三处条款字面显式修订，union/4(i)/其余边界种类明示逐字保持/不受影响；ADR-0010 处置沿 0033 注记「标题点名」先例，ADR 0034 决策 4 标题 L37 核对成立）；**与实现同 commit = 同变更集纪律兑现** |
| ADR 0025/0026（guard 先行；批内非嵌套；最小 edit；失败聚合零写入） | ✓ guard/信封区零改动；批量经同一 `prepareLocalMutation` 继承双轨；`composeBatchVerify` 折迭跳过零语句变化（mutation.ts 全 hunk 位于注释块，本审逐 hunk 确认）；注释补记 record/parent fast 项的正确性论证（E5 非嵌套 ⇒ 兄弟异键） |

### 2.3 模块责任 / 单一事实源 / 生命周期对称性

- **责任归属**：域规则单源 = vfsl 接缝（键 Pattern/值 schema/静态必填/no-op 文案）；载体事实/导航/构造/提交 = doc-runtime；S9 分派 = install-verify（未动）。`EntryCarrierFacts` 为 env-neutral `{has:boolean}`，无 Yjs 关切泄入 vfsl。✓
- **单一事实源**：无第二校验实现、无第二 S9 核、无第二折迭通道、无第二修订登记面；载体错位文案经 `extract.ts` `carrierMismatchIssue` 共享构造。✓
- **生命周期对称性**：无新 acquire/release/subscribe/close；同步单线程入口与单 guarded transaction 不变；facts 为 prepare 期一次性捕获（与 #436 数组轨同形）。✓

### 2.4 文件范围（ALLOW/DENY）

- ALLOW 三面全部命中且**无越界**：`mutation-local.ts`（+76/−3，闸门 + F1–F5 纯插入 + 模块头 ADR 0034 段 + import 面；−3 为 import 格式化）、`mutation.ts`（注释-only，逐 hunk 核实全部位于注释块）、`docs/adr/0007-*.md`（+19/−0 尾部纯追加，L1–140 零改写）。
- DENY 面**空 diff 逐项核实**：`packages/vfsl/**`、`install-verify.ts`、`index.ts`、ADR 0033/0034/0010、CONTEXT.md、既有测试目录（`git diff` 测试面仅 3 个 `/dev/null` 新增）、协议/持久化/apps/domains。
- SA6 冻结验收面：契约 18 `it()` + 负控 27 `it()` 计数复核 = 45；探针 sha256 `6030e0b8…97c1f9` 本审复算 = SA3/SA8 记录；契约/负控/探针随 commit 首次入 tracked（与 #440 feat commit `08497d9` 同批入测试 + wiki 工件的先例一致）。
- commit 形态：`feat(doc-runtime): …` 单行 conventional subject，与 `08497d9 feat(vfsl): validate record entry mutations` 同款；同变更集纪律（注记 + 实现）兑现。

### 2.5 测试质量标准

- 无 `skip/only/todo/xit/xdescribe`（grep 复核，零命中）；无 env override、无 fallback、无源码字符串断言；全部经公共入口 `applyValidatedMutation` 观察运行时行为。
- 确定性：零真实时钟/网络/随机源；`clientID` 仅在字节 oracle 用例显式固定；读计数代理覆盖六种整 map 出口（get/has/keys/values/entries/forEach/toJSON/iterator）且 `finally` 恢复原型——换批量出口逃逸计数不成立。
- 断言面：判别联合结果、逐字 issue message+path、update 事件计数、终态/增量字节 ≡ 同 clientID 手写最小 edit、复制收敛、branded fatal 事实（fatal/phase/committed/码字）、读计数与 n/字段数解耦（结构性证据，非毫秒阈值——符合 ADR 决策 6 纪律）。
- 红→绿由实现驱动（契约名集合 = SA6 冻结红名单，SA4 已对 `artifacts/sa6-issue441-contract-red.json` 逐一相符核对，本审复数 `it()` 计数一致）。

### 2.6 门禁证据（记录值，SA9 不复跑）

| 判据（设计 §12） | 证据 | 结果 |
|---|---|---|
| 1 聚焦对 45/45 | `artifacts/sa3-issue441-focused.log` | `FOCUSED_EXIT=0`，Type Errors: no errors ✓ |
| 2 包 tsc | SA3 报告 `PKG_TSC_EXIT=0` | ✓ |
| 3 根 `pnpm typecheck` | `artifacts/sa3-issue441-root-typecheck.log` | `ROOT_TYPECHECK_EXIT=0`（15 tsconfig） ✓ |
| 4 根 `pnpm test` | `artifacts/sa3-issue441-root-test.log` | 471 files / 5757 tests passed，`ROOT_TEST_EXIT=0` ✓ |
| 5 注记同变更集 | commit `61778bc` 单提交含注记 + 实现 | ✓（git 可核） |
| 6 探针确认信号（非绿判据） | `artifacts/sa3-issue441-probe-flipset-check.txt` | exit 1、失败集恰 12 项命名子集 `EXACT_MATCH`；探针字节不变 ✓ |

## 3. Standards findings

**BLOCKER：无。MAJOR：无。**

## 4. MINOR 观察（非阻塞，不阻断 approve）

- **M-1（冻结文件内 @internal 注释漂移；承接 SA4 N-A，本审复核成立）**：`install-verify.ts`
  JSDoc（L394–396/L437）仍称 `install-facts` 服务「fast-path **数组**提交」——record/parent
  fast 项本票起也消费该变体。该文件为 DENY/#436 冻结面，本票不触碰是正确取舍；规范源
  （ADR 0034 决策 3、ADR-0007 注记、两模块头注释）均准确，漂移仅限 @internal 注释。建议
  后续顺路票（触碰该文件时）刷新，不构成本票义务。
- **M-2（归档卫生，交付外事项）**：简报 `wiki/raw/task_issue-441.md` 与
  `artifacts/sa3-issue441-*` / `sa6-issue441-*` 证据日志仍为未跟踪；#440 先例中简报与
  sa6 证据在后续 `chore: archive`（`a596670`）、sa9/sa10 在 `docs: add delivery reviews`
  （`8be5d27`）入档。属 finalize 阶段归档步骤（本评审 artifact 亦同期待归档），不影响
  已提交交付本身的合规性。
- **M-3（worktree 划痕文件）**：根目录残留未跟踪 `cur-legacy.txt`（41 行）与
  `head-legacy.txt`（0 字节，一次空提取的遗留）——均不在 commit 内；legacy 逐字结论已由
  本审独立提取比对证实（§2.2 决策 4 行），残留物仅建议清理，无交付影响。

## 5. Verdict

**approve** —— 最终提交 `61778bc` 在全部标准维度合规：模块契约（零写入 / detached 构造 +
单事务 / fatal 分类 / 公共面冻结）、ADR 0034 决策 1–6 逐条兑现、ADR-0007 修订注记以有界
追加式与实现同变更集落地（docs/AGENTS.md 义务句兑现）、责任归属与单一事实源保持（vfsl
接缝纯消费、无平行机制）、生命周期零新增面、文件范围精确命中 ALLOW 且 DENY 全清单空
diff、测试质量（运行时行为断言 / 结构性读计数 / 字节 oracle / 无弱化）达标、门禁证据齐
备且与判据枚举一致。3 项 MINOR 均为非阻塞观察。
