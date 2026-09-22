# SA4 实现评审 — issue #441：doc-runtime Record/parent fast path 接线与 S9 收窄（ADR 0034）

- 评审对象：SA3 实现（worktree `mabf/issue-441` @ `3fd6aa8` + 未提交变更集：`mutation-local.ts` / `mutation.ts` / `docs/adr/0007-*.md`）
- Verdict：**approve**（无 BLOCKER / MAJOR；3 项非阻塞观察 + 上游登记残余 O-1/O-2/O-3 复核）
- requiresConflictRecheck：**false**（本轮未发现**新增** ADR 冲突风险——注记落地文本与设计 §7.6 建议文案经机械比对逐字一致、ADR-0010/0033/0034/CONTEXT 零触碰、同变更集 git 状态可核；已登记的实现后复查项仍归 SA8 §8 action 2 ①② 承担，见 §10/§12）
- 评审方法：静态审查 + 只读 git/哈希/mtime 取证 + 既有证据日志核对（未运行测试、未启动服务、未创建进程；SA4 技能边界）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-441.md`（简报；AC1–AC6；Comments 段空 L38–39） | 已读 |
| `wiki/raw/task_issue-441_design.md`（SA1 iteration 1，683 行；§7.2 闸门 / §7.3 F1–F5 / §7.5 S9 / §7.6 注记计划 / §11 ALLOW-DENY / §12 判据 1–6 / §12.1 探针 12+37 分类） | 已读（全文） |
| `wiki/raw/task_issue-441_sa6_contract.md`（approved：18 红 + 27 负控 + 49 项探针；B-1..B-6 绑定） | 已读（全文） |
| `wiki/raw/task_issue-441_sa2_review.md`（approve；F-SA2-1/F-SA2-2 关闭；N1–N4/O-1..O-3） | 已读（全文） |
| `wiki/raw/task_issue-441_design_conflict_report.md`（SA8 clear；唯一 evolution-required = ADR-0007 注记；§8 actions 1–3） | 已读（全文） |
| `wiki/raw/task_issue-441_sa3_impl.md`（SA3 实现报告） | 已读（全文） |
| 实现 diff：`git diff` 三 tracked 文件（mutation-local +74/−2、mutation +12/−9、ADR-0007 +19/−0） | 逐行审查 |
| 源码锚点：`mutation-local.ts`（record/parent 分支 L285–383 + #436 数组闸门 L394–444）、`mutation.ts`（prepareMutation 顶层 catch L215–225 / prepareBatchMutation / composeBatchVerify L336–390）、`install-verify.ts`（verifyBoundaryInstallFacts L399–431 / VerifyPlan L439–441 / verifyPrepared L444–453 / verifyBoundaryIntact L465–500）、`extract.ts`（walk L91–152 map 分支载体首检 + carrierMismatchIssue L364–372）、`validate-patch.ts`（planMutationBoundary L742–825 + 接缝 L1219–1289 + judgeClosedObjectDelete L1178–1195）、`resolve.ts`、`detached-build.ts` 消费面 | 已读（逐锚点对齐） |
| 冻结验收面：契约/负控/夹具三文件 + 探针（sha256 `6030e0b8…97c1f9` 复算一致；mtime 18:04–18:10 早于 src 改动 19:08–19:09） | 已读 + 取证 |
| 规范面：ADR-0007（140→159 行）、ADR 0034（决策 1–6 + 决策 4 标题 L37「扩展 ADR-0010 issue #237 修订节」核对）、ADR-0010 L345–347 后备句、ADR 0033 注记、CONTEXT.md、`docs/AGENTS.md` 义务句、`packages/doc-runtime/AGENTS.md`、`packages/vfsl/AGENTS.md` | 已读/核对 |
| 证据工件：`artifacts/sa3-issue441-{focused,root-test,root-typecheck,probe-post-impl,probe-flipset-check,adr0007-diff,mutation-local-diff,changed-paths}*`、`artifacts/sa6-issue441-*`（含 contract-red.json 18 红名单） | 已核对 |
| `_relevant_decisions.md` / 前置 `_conflict_report.md` | 不存在（与设计 §6 声明一致） |

## 2. Verdict

**approve**。实现把批准设计的闸门双条件合取、F1–F5 管线、S9 `install-facts` 收窄、批量零代码继承与注释刷新、ADR-0007 有界追加注记全部落地，且：

- **legacy 轨逐字保留**：闸门之后的 legacy 代码块与 HEAD 逐字节一致（awk 提取比对）；
- **冻结证据零触碰**：探针 sha256 与 SA3 记录一致、mtime 先于源码改动、契约 18 测试名集合与 SA6 红基线 JSON 逐一相符（无弱化）；
- **门禁证据齐备**：聚焦 45/45、根 test 471 files/5757 tests、根 typecheck exit 0（日志核对）、探针 exit 1 且失败集**恰为**设计 §12.1 的 12 项命名子集（`EXACT_MATCH`，G1h 不在其中——与 §12.1 更正口径一致）；
- **文件范围合规**：3 个 tracked 改动全部命中设计 §11 ALLOW；DENY 面（vfsl / install-verify / index / 契约三件套 / 探针 / 其余测试 / 0033 / 0034 / 0010 / CONTEXT / 其余 docs）零改动。

## 3. 上游要求落实

**Owner 评论：无**（Host 明文 REST comment read 为空；简报 L38–39 Comments 段空；SA6 §2 / SA2 §4 / SA8 报告 / SA3 报告四源一致）。全部要求源自简报 AC1–AC6 + ADR 0034 决策 1–4。

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 闸门分流 | `mutation-local.ts` L292–305 闸门 `plan.node.kind === 'object' ∧ resolve(boundaryNode).kind === 'map'`；union 位由规划层 L798–801 首穿越冻结 kind=`union` 结构性隔离（源码复核）；值位 union 不入条件（P1e/FA6） | 落实 |
| AC2 O(n)→O(k) | F1 `carrierOf` O(1)、F2 `Y.Map.has` O(1)、F3 接缝 O(正则)/O(新值)、F4 `buildDetachedValue` O(新值)；FB1–FB3 契约绿（探针报告值 n=512/4096 → 1/1、0/2、0/2；G3c 软时序 10⁵→1ms） | 落实 |
| AC3 commit 形态不变 | `commitPrepared` set/delete 两支零改动（mutation.ts 未改语句）；ND1–ND6 字节 oracle/复制面绿 | 落实 |
| AC4 零写入 | F1/F3/F4 一切失败 `return {kind:'fail'}` 先于 `transactGuarded`（代码序核对）；NC1–NC5/NC10/NC11 绿 | 落实 |
| AC5 S9 收窄 | F5 返回 `verify:{kind:'install-facts',facts}`；`install-verify.ts` 零改动（复用 #436 共享核）；FC1–FC4 绿 + NB1–NB5 绿 | 落实 |
| AC6 门禁 | `artifacts/sa3-issue441-{focused,root-test,root-typecheck}.log`：45/45、471 files/5757 tests、exit 0；Type Errors: no errors | 落实 |
| F-SA2-1（探针判据） | 探针移出绿判据；复跑仅作确认信号：exit 1 + 失败集恰 12 项（flipset 比对 `EXACT_MATCH`）+ 文件字节不变（sha256 复算） | 落实 |
| F-SA2-2 / SA8 evolution-required（ADR-0007 注记） | +19 行追加式注记，与设计 §7.6 建议文案经归一化机械比对**逐字一致**；既有 140 行零改写（0 删除行）；与实现同变更集（git status 同批） | 落实 |
| SA2 §14 N1–N4 | N1（注记文本=设计逐字）本轮机械复核成立；N2（0033 注记 L137–139 未改写）成立；N3（G1h 不入失败集）成立；N4（符号名定位）无行号依赖问题 | 落实 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §7.2 闸门双条件合取（kinds only，O(1)） | `mutation-local.ts` L304–305 | 与 #436 数组闸门（L403–404）同构；`resolve(boundaryNode)` 抛错经 `prepareLocalMutation`→`prepareMutation` 顶层 catch → E204（mutation.ts L215–222 核对），与 legacy walk 内 resolve 同分类 | — |
| §7.3 F1 载体检查逐字复刻 legacy S5 首错 | L310–312 `walkResultIssues(carrierMismatchIssue([], 'Y.Map', boundaryLive))` | `walk` map 分支 L101 载体首检 path `[]` + `carrierMismatchIssue` 共享构造（extract.ts L364，#436 已注记该复用）——同文案同 path；NC10/NC11 逐字断言绿 | — |
| §7.3 F2 在场性 O(1)、planner 保证单段 string key | L314–317 | 数字终段在 S3 即拒（validate-patch L756–769 核对）；`as string` 防御性转换与 legacy 同款 | — |
| §7.3 F3 接缝消费（set/delete 载荷、fail 即零写入返回） | L321–326 | 接缝第三锁四条件（kind/relPath/node.object/kind↔`<key>` 槽）fail closed 核对（validate-patch L1226–1248）；parent+set 防御性响亮拒绝（L1266–1270）；issue rebase `[...plan.prefix, ...issue.path]`（L1286）与 NC2/NC3/NC8 逐字一致 | — |
| §7.3 F4 detached 构造（仅 set、同符号同路径） | L334–340 | `descendStructureNode` + `buildDetachedValue` 与 legacy L362–363 同款调用（值位 union 由 buildUnion 试验构造） | — |
| §7.3 F5 收窄验证计划 | L341–342 | `install-facts` 变体复用；无 `proposedBoundary`（ADR 0034 决策 3） | — |
| §7.4 S8 零改动 | `commitPrepared` 未触碰（mutation.ts 注释-only，程序化验证全部改动行为注释） | — | — |
| §7.5 批量零代码继承 + 注释刷新 | `composeBatchVerify` L365 `verify.kind !== 'boundary'` 跳折迭（零语句变化）；注释补 record/parent fast 项 prefix 可为 map 位的正确性依据 | 折迭吸收面（parsed 驱动重放）不变：legacy 边界项前缀（union 位）不可能是 fast record 项路径的严格前缀（否则该 op 自身已被冻结为 union 计划）——结构论证成立；FA8/NC9/ND6 绿 | — |
| §7.6 ADR-0007 注记（追加式/授权链/不变面/同变更集） | ADR-0007 L141–159 | 见 §3 F-SA2-2 行；ADR-0010 处置沿 0033 标题点名先例（ADR 0034 决策 4 标题 L37 核对），L345–347 后备句零漂移 | — |
| §8 零公共接口变化 | `src/index.ts` 零改动；新 import 全部为 `@nomicore/vfsl` 既有公共导出（index.ts L145/153/154 核对） | — | — |

## 5. 架构一致性与惯例

### 责任归属
| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 域规则/逐 entry 判定 | vfsl（#440 接缝单源） | F3 纯消费 | ✓ |
| 载体事实/导航/构造/提交 | doc-runtime mutation 管线 | F1/F2/F4 + `commitPrepared` | ✓ |
| S9 两轨分派 | `install-verify.ts`（#436 已建） | 纯消费（零改动） | ✓ |
| 规范文档修订 | 被修文件内显式修订注记 | ADR-0007 #237 节末追加 | ✓ |

### 相似能力对照
| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 数组逐元素 fast path（#436/ADR 0033） | `mutation-local.ts` L394–444 | 闸门+F1–F5 镜像同构（含 `resolvedBoundary` 先算、载体检查、install-facts） | 一致 | 逐点比对 |
| 逐 entry 接缝（#440） | `applyElementwiseEntryMutation` | 唯一消费方落地，无第二实现源 | 一致 | ADR 0034 决策 6 |
| ADR 修订注记形态 | 0033 注记（`ca0ab53` 同 PR 先例） | 带日期+授权链+作用域句+ADR-0010 同步句 | 一致 | 句式对齐 |

### 单一事实源 / 生命周期 / 平行机制
- 无重复状态/第二缓存：闸门只消费既有 `plan` + `resolve`；facts 为 prepare 期一次性捕获。✓
- 无新生命周期面（同步单线程入口、单 guarded transaction 不变）。✓
- 无平行机制：无第二校验源、无新 S9 核、无第二折迭通道、无新修订登记面。✓

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/doc-runtime/src/mutation-local.ts`（+74/−2） | §11 第 1 行 | 闸门 + F1–F5 + 模块头 ADR 0034 段 + 接缝 import | ✓（−2 为 import 行改多行格式） |
| `packages/doc-runtime/src/mutation.ts`（+12/−9） | §11 第 2 行（注释-only） | 模块头 S9 句 + 折迭跳过注释泛化 | ✓（程序化验证：全部改动行均为注释） |
| `docs/adr/0007-…md`（+19/−0） | §11 第 3 行（有界追加式） | ADR 0034 修订注记 | ✓（0 删除行；文本=设计 §7.6 逐字） |
| `wiki/raw/task_issue-441_sa3_impl.md`、`artifacts/sa3-issue441-*` | SA3 固定产物 / 证据工件（同 SA6 `artifacts/sa6-*` 类） | 报告与命令原始输出 | ✓（非源码/非规范面，沿仓既有惯例） |
| DENY 全清单 | — | — | ✓ 零改动（`git status` 核对：vfsl/install-verify/index/契约三件套/探针/其余测试/0033/0034/0010/CONTEXT/其余 docs/packages/apps/domains、tsconfig/vitest.config/pnpm-lock 均无变化；`git diff --check` 干净） |

冻结面专项取证：探针 sha256 `6030e0b8a31a45cdea781fb108218cb613c69e3fd9f7002d3153d6f8e597c1f9`（= SA3 报告记录）；契约/负控/夹具 mtime 18:04–18:10 < 源码 19:08–19:09；契约文件 18 个 `it()` 名集合与 `artifacts/sa6-issue441-contract-red.json` 18 条失败名单**逐一相符**——验收面未被实现期弱化。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `applyValidatedMutation` 签名/判别联合 | 全部公共消费方（namespace-runtime 等） | 零变化；行为变化即 AC1–AC5 目标（触达面外污染不再阻断 = 预期收窄） | 无 | — |
| `prepareLocalMutation`（@internal） | `mutation.ts` 单操作 + 批量两处（唯一消费文件，grep 核对） | 双轨自动继承；批量折迭/吸收面零代码 | 无 | — |
| `verifyPrepared` 判别联合 | `applyValidatedMutation` 单/批量 | 穷尽分派已覆盖 `install-facts`（#436 建立） | 无 | — |
| update 事件流 | 复制/诊断捕获上游 | 单键最小 edit 不变（ND1–ND6 + 探针 G5 系绿） | 无 | — |
| 既有测试锚定待废止行为 | `issue-350-*`/`operations`/`fatal-contract`/`issue-237-*` 等 | 根 test 471 files 全绿——无任何既有用例锚定被废止行为（设计 §10 核查的运行时反证） | 无 | — |

## 8. 错误、恢复与并发

- 错误分类（§9.1 设计表）逐行核对落地：F1 载体（领域 issue，逐字）、F3 域规则（接缝单源，逐字）、F3 接缝崩溃（`wrapElementwise` → VFSL-E100）、F4 构造失败（领域 issue）、闸门 resolve（E204 同 try/同 catch——`prepareMutation` L215–225 核对）、S9 偏离（E201-C，共享构造器）、核异常（E201-D）。无吞错、无伪成功、无 fallback。
- 零写入纪律：一切失败先于 `transactGuarded`；拒绝后状态字节逐字节不变（NC 组 `sameBytes` 断言）。
- 并发/时序：afterTransaction 篡改窗口先于 S9 派发——目标键篡改 NB1–NB5 仍 E201-C；触达面外篡改静默（FC1–FC4，ADR 0034 决策 3 已确认取舍）。批量：E5 非嵌套 ⇒ 同 map 兄弟异键 ⇒ install-facts 互不破坏；legacy 边界项对 fast 足迹的 parsed 驱动吸收照旧（结构性论证见 §4）。
- 回滚面：闸门合取移除即回 legacy + revert 注记，单变更集可逆。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| 契约 18（FA1–FA11/FB1–FB3/FC1–FC4） | 判别联合结果、update 计数、污染保留、读计数 ≤2 且与 n/字段数解耦、不抛 fatal + doc 保持篡改态 | vitest include `packages/*/test/**/*.test.ts`（vitest.config L15）；根 `pnpm test` 日志含两文件绿行 | 无 skip/only/todo；无源码字符串断言；红→绿由实现驱动（名集合 = SA6 冻结红名单） | — |
| 负控 27（NA/NB/NC/ND） | union 永久 legacy（含 E201-C 双核）、安装事实核 E201-C 三件套（fatal/phase/committed/码字）、域规则逐字 message+path、零写入零 update、字节 oracle（同 clientID 手写最小 edit）、复制收敛、批量单 update | 同上 | 断言面全部运行时行为；`expectE201` 断言 branded fatal 事实 | — |
| 夹具（非测试入口） | 实例级读计数覆盖（get/has/keys/values/entries/forEach/toJSON/Symbol.iterator，finally 恢复）、afterTransaction 定界篡改、update 捕获 | 文件名不匹配 include（`-fixture.ts`），仅共享模块 | 计数代理六出口覆盖 + G3b 逃逸反证（SA6） | — |
| 探针（49 项，证据非判据） | HEAD 行为快照 | `wiki/raw/**` 不在 include；tsx 手动入口 | 实现后 exit 1 + 失败集恰 12 项（`EXACT_MATCH`）；文件字节不变 | — |

防伪绿反证链在位：NC/NA 反「放行一切写」、NB 反「删一切写后验证」、G5k 字节 oracle 敏感性、红名单 md5 5 轮稳定（SA6 §13）。

## 10. Required revisions

无 BLOCKER / MAJOR。已登记的实现后复查项（非 SA4 finding，归 SA8 §8 action 2 ①② / 设计 §15）：

| Item | Owner channel | SA4 本轮核对结果 |
|---|---|---|
| 注记最终文本与条款 1/4(ii)/7、ADR 0034、ADR-0010 L345–347 引句一致性 | SA8（requiresConflictRecheck 已由设计/SA2/SA8 三处登记） | 本轮机械比对：注记=设计 §7.6 逐字；ADR-0010/0033/0034/CONTEXT 零改动；0033 注记 L137–139 未改写（时序层叠读法成立）；未发现新增冲突风险 |
| 同变更集 git diff | 同上 | `git status` 三 tracked 文件同批、无次序分离 |

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 10⁵ 级规模软时序复现（AC2 例示形态） | 探针 G3c 复跑 | 单键写耗时与 n 解耦（本轮 10³→0ms / 10⁵→1ms） | 耗时随 n 增长（读计数契约 FB1–FB3 已机器无关地钉死，此项仅软确认） |
| SA7 独立动态验证 | 后续验收轮 | NB/FC 双组在真实时序下复现 | — |

## 12. Non-blocking observations

- **N-A（冻结文件内陈旧 @internal 注释）**：`install-verify.ts` L394–396/L437 JSDoc 仍称 install-facts「fast-path **数组**提交」——本票后 record/parent fast 项也消费该变体。该文件在 DENY（#436 冻结面），SA3 不触碰是正确取舍；属 @internal 注释漂移，非规范文档矛盾（ADR 0034 决策 3 为规范源）。建议后续顺路票（触碰该文件时）刷新，不构成本票义务。
- **N-B（授权链单句引用）**：落地注记授权链引 `docs/AGENTS.md`「Amend or supersede…」单句（设计 §7.6 建议文案本身即如此；「两条义务句」表述在 §6 表）。落地=设计逐字，无实现偏离；SA8 复查如需补第二句属设计层修订。
- **N-C（探针 G1h 证据语义变化）**：G1h 保持 PASS 但拒绝理由由 S5 父值载体错位（path `["deep"]`）变为 F3 静态必填判定（path `["obj","req"]`）——设计 §12.1/SA2 N3 已明示不计入失败集；本轮失败集确认不含 G1h，口径一致。
- **O-1/O-2/O-3（上游登记残余，维持非阻塞）**：`undefined` 值键在场性微观分歧（`Y.Map.has` 在场 vs legacy walk D4 视同缺席——ADR 决策 1/2 字面谓词即 `has`，忠实母法）；提交后整载体替换的静默残余（install-facts 持 prepare 期实例，与 #436 数组轨同形的已确认收窄面）；手造槽形态分歧呈现为领域 issue 而非 E204（#440 冻结面，fail-closed 方向）。实现均按设计登记处理，无新增义务。
