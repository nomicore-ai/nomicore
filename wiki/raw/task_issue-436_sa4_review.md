# SA4 实现静态审查 — issue #436：doc-runtime 数组 fast path 接线与 S9 收窄（ADR 0033）

- 审查对象：SA3 实现（iteration 0，首次实现；`wiki/raw/task_issue-436_sa3_impl.md`）。
- 实现基线：HEAD `7407ce01367b6d7a3fe497cd78c4bcf085f3ddbb` + 工作区 7 个 M 文件（`git status`
  本轮复核恰为报告所列 7 文件 + SA6/SA3 untracked 证据面；`git stash list` 空——临时暂存已清）。
- 审查方法：逐 diff 静态攻击 + 锚点核对（不运行测试、不启动服务、不建临时进程）；对 SA3 报告的
  全部验证证据做日志内容与静态推演的双向核对。
- 结论：**approve**（无 BLOCKER/MAJOR；2 条 MINOR 观察项不阻断）。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-436.md`（Host 简报；comments = 空） | 已读；AC1–AC7 |
| `wiki/raw/task_issue-436_design.md`（iteration 1 修订版设计） | 已读（全文，含 §7.1–§7.7/§11 ALLOW-DENY/§12/§14） |
| `wiki/raw/task_issue-436_sa6_contract.md`（已批准验收契约） | 已读（全文；B-1..B-6 锚 + §12.2 目标行为） |
| `wiki/raw/task_issue-436_sa2_review.md`（approve；F-1 + O-1..O-4 已裁决） | 已读 |
| `wiki/raw/task_issue-436_design_conflict_report.md`（SA8：clear + requiresConflictRecheck=true） | 已读（§8 清单①②③） |
| `wiki/raw/task_issue-436_sa3_impl.md`（被审实现报告） | 已读（全文） |
| 生产 diff：`mutation-local.ts` / `install-verify.ts` / `mutation.ts` / `extract.ts` | 逐 hunk 攻击（含与 HEAD 原文逐字对照） |
| 测试 diff：`apply-validated-mutation-fatal-contract.test.ts` / `issue-237-path-localized-validation-red.test.ts` | 逐 hunk + 断言面全量核对 |
| `docs/adr/0007-*.md` 注记 diff | 与正文条款 1/4(ii)/7、ADR 0033、ADR-0010 引句逐句对照 |
| SA6 三件套 + 探针 | md5 复算 = SA3 记录（三件合一未改）；探针头部纪律与 G/U/S/O/N 自标注复核 |
| 证据日志 `artifacts/sa3-issue436-*.log/.txt/.patch` + `artifacts/sa6-issue436-*.log` | 逐件抽验（focused/root-test/root-typecheck/package-tsc/reanchor-neutrality/probe/probe-flip/md5/recheck-diff） |
| `packages/doc-runtime/AGENTS.md`、`packages/vfsl` 接缝源（`validate-patch.ts`） | 纪律与接缝 fail-closed 面复核 |
| `task_issue-436_relevant_decisions.md` / `_conflict_report.md` | 不存在（与 SA6/SA1/SA3 声明一致；SA8 设计后冲突报告为替代规范面） |

## 2. Verdict

**approve** —— 实现忠实落实批准设计（iteration 1）与 SA6 验收契约：双条件闸门 + 接缝第三重
fail-closed 锁、O(1)/O(k) fast path（结构性读计数与 n 解耦）、`VerifyPlan` 判别联合的 S9 收窄
（事实核共享单实现、legacy 双核逐字不变）、零写入纪律、commit 最小 edit 零改动；两条钉死旧义的
既有测试按 F-1 授权定向重锚（断言面零放宽、两态中性实测）；ADR-0007 注记按 O-1 义务同批落地。
文件范围严格落在 ALLOW LIST 内（DENY 面 md5/状态双核对零触碰）。SA3 报告的唯一偏差 D-1
（探针「exit 0」判据）经本轮裁决为**准则句面陈旧而非实现缺陷**（见 §12 O-1 观察项）。

## 3. 上游要求落实

Issue comments = 空（无 Owner 要求需要映射）；替代规范面逐条：

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 闸门分流（ADR 0033 决策 1） | `mutation-local.ts` L322–332：`resolve(boundaryNode)` + `plan.node.kind === 'array' && resolvedBoundary.kind === 'array'` 双条件合取；union 数组目标（`plan.node.kind='union'`，探针 U1）与两树分歧均落 legacy 分支（L375 起代码与 HEAD 逐字一致）；`planMutationBoundary` 零改动 | 落实（NA1–NA4 保绿实证） |
| AC2 O(n)→O(k)（决策 2/6） | fast path F1–F5（L333–373）无任何 `walk`/`applyMutationAtBoundary`/重投影调用；唯一元素读 = 事实核 `get(index+i)`×k；`target.length` O(1)；FB1/FB2 实测 1/0（n=512 ≡ n=4096） | 落实（结构性 + 实证双确认） |
| AC3 live 长度越界 + 域规则一致（决策 2） | F2 先读长度、F3 经 `applyElementwiseArrayMutation`（`validate-patch.ts` L1079–1136）——越界文案/路径与 legacy `issueAt` rebase（`[...plan.prefix, index]`）逐字一致；FB3 实测读计数 0 | 落实 |
| AC4 update 事件形态（决策 2） | `commitPrepared` 零改动；commit 对象形态与 legacy 分支同款；ND1–ND4（字节 oracle + 复制收敛）保绿 | 落实 |
| AC5 零写入（决策 2） | F1–F4 一切失败 `return {kind:'fail'}` 先于任何 `transactGuarded`；无 write-then-undo；NC1–NC3/NA1/NA3 零写入锚保绿 | 落实 |
| AC6 S9 收窄（决策 3） | `install-verify.ts`：事实核逐字抽取为 `verifyBoundaryInstallFacts`（与 HEAD L397–428 原文逐字符一致——本轮 diff 对照）；`VerifyPlan` 判别联合 + `verifyPrepared`；`VerifyBoundaryIntactInput.proposedBoundary` 保持必填（L360 无 `?`）；四处 legacy verify 构造点改 `{kind:'boundary',input:{…}}` 全数核对 | 落实（FC1/FC2 转绿 + NB1–NB4 保绿） |
| AC7 门禁复绿 | `artifacts/sa3-issue436-{focused-final,root-test,root-typecheck,package-tsc}.log`：25/25、464 files/5647 tests、双 typecheck exit 0；两态判据（reanchor-neutrality：src 回 HEAD 态 = 两重锚文件 47 passed + 契约 8 failed） | 落实（日志内部一致，见 §9/§11） |
| SA2 F-1（MAJOR） | P-1 仅 `W5_TEXT` schema 文本 + 注释授权链（diff 唯一 hunk）；P-2 新增模块级 `TEXT_LIB_ITEM_UNION`（紧邻共享常量，SA2 N-1 建议位）+ `fixtureOf` 切换 + 注释；两用例断言/seed/污染/操作逐字未改（diff 零触及断言行）；共享 `TEXT_LIB_ITEM` 及其余用例零触碰 | 落实 |
| SA2 O-1/O-2/O-3/O-4 | O-1：注记默认执行（无豁免，无需 Controller 裁决记录）；O-2：消费 §12.1 结论 + 根 test 全绿反证「恰两条」；O-3：`const values = mutation.values!` + 局部 `let commit/facts` + 既有 `failIssue`/`walkResultIssues`/`issuesOf`（L67/L213/L76 均在案）；O-4：闸门 `resolve` 在 `prepareMutation` 同一 try 内（mutation.ts L172–224 catch → E204），批面同 try | 落实 |
| SA8 §8 同变更集纪律 | 7 个 M 文件同一工作区变更集（git status 可核）；`sa3-issue436-recheck-diff.patch` = ADR + 两测试恰 3 个 diff（清单①②材料） | 落实 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §7.1 D1 闸门与永久双轨 | `mutation-local.ts` L322–374（fast）/L375–420（legacy 原样）；接缝第三锁在 vfsl L1086–1099（`plan.kind`/`relPath`/`node.kind` 三条件 fail closed，本轮复核在案） | 忠实；被拒形态（仅 `plan.kind` 接管/规划层分流）均未出现 | — |
| §7.2 D2 F1–F5 管线 | L333–373 与设计伪代码逐行对应：F1 `carrierOf` + `carrierMismatchIssue([], 'Y.Array', …)`（复用 extract.ts 单一构造助手，反文案漂移——R3 缓解落实）；F2 `target.length`；F3 接缝 + `issuesOf`；F4 `buildDetachedValue(derived, resolvedBoundary.element, v, [...mutation.path, index+i])`（issue 路径构造与 legacy L397 逐字同款）；F5 `{kind:'install-facts', facts}` | 忠实（O-3 三处修正全部落地） | — |
| §7.3 D3 判定次序与 Δ 面 | 检查次序载体→域→构造对齐 legacy；Δ1/Δ2 为 ADR 立法取舍且有 FA/FC 锚；Δ3（污染∧越界报越界）为触达面收窄推论，无既有用例钉旧次序（SA2 双轮扫描 + 本轮根 test 全绿反证） | 忠实 | — |
| §7.4 D4 S9 判别联合 | `VerifyPlan`/`verifyPrepared`/`verifyBoundaryInstallFacts`；被拒形态（`proposedBoundary` 可选化静默跳核）未出现——判别联合 exhaustive | 忠实 | — |
| §7.5 D5 批量接线 | `mutation.ts` L353–384：`verify.kind !== 'boundary'` 跳折迭（类型封闭判别，≡ `install-facts`）；折迭输入侧 `parsed[j]` 驱动不变；引理 3 注释在案；legacy 边界项吸收照旧 | 忠实；E5 禁同/嵌套路径 ⇒ `beforeLength` 批内有效性同构 legacy | — |
| §7.6 D6 ADR-0007 注记 | 注记追加于 #237 修订节末（不重写条款）；建议文案逐字采用（仅标题升级）；所引「不逐元素」（L77）/「数组位」（L102/134）/「按边界规模」（L122）均与正文实句对应；ADR-0010/CONTEXT 未触碰（git status 零改） | 忠实 | — |
| §7.7 D7 定向重锚 | 见 §3 F-1 行；「仅两用例、断言零放宽、共享常量不动、授权链注释」四项禁区全数满足 | 忠实 | — |
| §8.1 类型面（全 @internal） | `VerifyPlan`/`verifyPrepared`/`verifyBoundaryInstallFacts`/`carrierMismatchIssue` 均不经 `src/index.ts`（grep 零命中；public-surface-guard 用例绿）；`LocalPreparedResult.verify`/`MutationPrepared.local`/`BatchItem.verify` → `VerifyPlan` | 忠实 | — |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 域规则/逐元素校验 | vfsl 接缝（#435 冻结交付） | `applyElementwiseArrayMutation` 单实现，doc-runtime 零复制 | 正确（无第二实现） |
| S9 事实核 | install-verify | 抽取为共享单实现，两轨同源 | 正确 |
| 载体错位 issue 构造 | extract.ts | `carrierMismatchIssue` 导出复用（条件 ALLOW 项取「导出助手」一侧，未两端都改） | 正确（R3 反漂移） |
| 闸门分流 | doc-runtime 执行层（决策 1：规划层不动） | `mutation-local.ts` case 'array' | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 判别联合结果面 | `LocalPreparedResult`/`ApplyValidatedMutationResult`/plan kinds | `VerifyPlan` 同款 `{kind}` 判别 | 一致 | 仓内惯例 |
| 测试锚迁移（意图不变、载体演进） | W5 自身 #237 修订史（L211–217 注释载沿革） | P-1/P-2 重锚同款 + 授权链注释 | 一致 | 先例沿用 |
| 接缝消费 vs 内联复制 | #435 接缝即为此交付 | 直接消费，零内联域规则 | 一致 | 单一事实源 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 数组域规则文案/路径 | vfsl 接缝 | 无 | 无（F3 直出） |
| 事实核 | `verifyBoundaryInstallFacts` | 无 | 无（抽取逐字） |
| 载体错位文案 | `carrierMismatchIssue` | 无 | 无（共享助手） |

### 生命周期对称性

不适用（纯同步函数管线；无资源/订阅/后台任务面；本次改动未引入任何）。

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套域规则/验证分派/载体判定 | 接缝/verifyPrepared/extract 助手 | 无第二实现 | 无平行 |
| fast path 内联裸事实检查（设计 §7.4 明拒） | 共享事实核 | 未出现（走 `install-facts` 变体） | 无平行 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/doc-runtime/src/mutation-local.ts` | ALLOW 1 | 闸门 + fast path + 类型面 + 注释 | 在范围（diff 4 类改动均对应设计条目） |
| `packages/doc-runtime/src/install-verify.ts` | ALLOW 2 | 事实核抽取 + VerifyPlan/verifyPrepared | 在范围 |
| `packages/doc-runtime/src/mutation.ts` | ALLOW 3 | 类型面 + 两处调用 + 阶段 C 判别 | 在范围（信封解析/guard/E1–E6 区零触碰——diff hunk 核对） |
| `packages/doc-runtime/src/extract.ts` | ALLOW 4（条件项） | `mismatchIssue` → `@internal carrierMismatchIssue`（改名导出 + 两处内部调用点同改） | 在范围（仅取一侧，未两端都改） |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` | ALLOW 5（无条件，O-1） | ADR 0033 修订注记 | 在范围（追加式，未重写条款） |
| `packages/doc-runtime/test/apply-validated-mutation-fatal-contract.test.ts` | ALLOW 6（定向） | 仅 W5 用例 | 在范围（diff 唯一 hunk；文件内其余用例零触碰） |
| `packages/doc-runtime/test/issue-237-path-localized-validation-red.test.ts` | ALLOW 7（定向） | 仅 A-7 对称面用例 + 局部常量 | 在范围（两个 hunk；共享常量/其余用例零触碰） |
| `artifacts/sa3-issue436-*`（untracked） | SA6 证据目录惯例 | 验证证据 | 非交付代码，符合惯例 |

DENY 面实测：SA6 三件套 md5 复算与 SA3 记录一致（`2dd066f4…`/`c9e0e6c1…`/`8358d454…`）；
`packages/vfsl/**`、`src/index.ts`、`namespace-runtime/**`、`namespace-diagnostic-log/**`、
`apps/**`、ADR-0010/0033、CONTEXT.md、`docs/vfsl/**`、`docs/protocols/**`、配置面——git status
零触碰。**无越界。**

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `LocalPreparedResult.verify`（`VerifyBoundaryIntactInput` → `VerifyPlan`） | `mutation.ts` `prepareMutation`/`prepareBatchMutation` | 两消费点同步切换；grep 全仓无第三消费方 | 无 | — |
| `verifyBoundaryIntact` 直调点（HEAD L153/L164） | `applyValidatedMutation` | 改经 `verifyPrepared`；legacy 分支（set([])）`verifyInstall`+`verifySnapshotIntact` 不动 | 无 | — |
| `composeBatchVerify` 无条件读 `verify.proposedBoundary` | 批量阶段 C | 判别化跳过 `install-facts` 项；折迭输入 `parsed[j]` 驱动不变（TD-3/S6/S7 保绿机理不变） | 无 | — |
| 公共面 `applyValidatedMutation` | namespace-runtime typed adapter/宿主/测试 | 签名/结果面零变化；可观察差异仅 Δ1/Δ2/Δ3（ADR 立法取舍）；update 字节/事件形态零变化（ND 组） | 无 | — |
| 复制协议/诊断捕获 | yjs update 订阅面 | 单事件最小 edit 不变（ND2/ND4 + 探针 O 组 26/26 保持） | 无 | — |
| 既有测试 P-1/P-2 | — | 定向重锚（§3）；其余既有面根 test 5647 全绿反证零意外翻红 | 无 | — |

## 8. 错误、恢复与并发

- **零写入**：fast path F1（载体）/F3（域/载荷/新值）/F4（构造）失败均先于任何
  `transactGuarded` 返回 `{kind:'fail'}`；批内聚合失败整体零写入（阶段 P/C 均在事务前）。
  代码路径逐行核对无隐藏写点。NC1–NC3/NA1/NA3/FA 组实证。
- **fatal 分类不削弱**：事实核抽取为逐字移动（try/catch、E201-C 文案、`committed:true`、
  `post-commit-verification`、E201-D「绝不假成功」全部原样）；闸门 `resolve` 抛
  `DerivedInvariantError` 与 legacy walk 内 resolve 抛错同处 `prepareMutation` try（L172–224）
  → 同 E204 分类（O-4）；E205 兜底不动。空 `values` insert（k=0）两轨同为合法 no-op（事实核
  长度算术 `before+0` ✓）。
- **并发/TOCTOU**：同步单线程面不变（`assertOutermostTransactionContext`）；唯一干扰窗口
  （afterTransaction cleanup）检出面 = 事实核（NB1–NB3 绿；FC1/FC2 静默通过 = 决策 3 立法
  取舍）。批量 `beforeLength` 在 prepare 期读取、E5 禁同/嵌套路径 ⇒ 批内无第二操作改本数组
  长度（与 legacy 同构）。
- **幂等/回滚**：无 write-then-undo；领域拒绝可重试、fatal 不可恢复语义不变。
- 静态无法确认项 → §10（无：本轮未发现需要动态判定的悬置风险；探针面见 §12）。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| 契约 FA1–FA3 | 非 union 污染数组 insert/delete（含批内）`ok:true` + 恰 1 update + 污染保留 | vitest include（`packages/*/test/**/*.test.ts`）；聚焦命令 2 files/25 tests 实测记录 | 无 skip/only/todo、无源码字符串断言；红灯经实现自然转绿（SA6 侧 5 轮红 + SA3 转绿日志链） | — |
| 契约 FB1–FB3 | 元素读计数 ≤8/≤8/≤4 且 n=512 ≡ n=4096；越界逐字 message/path | 同上 | 计数代理覆盖 `get`/`toArray`/`forEach`（G2d 反证）；实测 1/0/0 与静态推演（唯一元素读 = 事实核 get×k）一致 | — |
| 契约 FC1/FC2 | 区间外篡改不抛 fatal、`ok:true`、doc 保持篡改态 | 同上 | 与 NB（事实核保留）成对，双向钉死 S9 收窄 | — |
| 负控 NA1–NA4 | union 数组/穿越永久 legacy：污染拒绝 + 零写入零 update、区间外篡改 E201-C、干净写照常 | 同上 | 闸门不过度接管的行为锚 | — |
| 负控 NB1–NB4 | 事实核两轨保留（长度算术/同一性；branded fatal 事实） | 同上 | `expectE201` 断言 phase/committed/DOCRT-E201 | — |
| 负控 NC1–NC5 | 域规则逐字 + 零写入零 update + 边界接受面 + 批量干净 op | 同上 | 冻结常量 + 机制 oracle | — |
| 负控 ND1–ND4 | 终态/增量字节 ≡ 同 clientID 手写最小 edit + 复制收敛 | 同上 | 字节 oracle 对形态敏感（O4/O5 反证在探针面保持） | — |
| P-1（W5 重锚后） | union 数组目标：污染 insert → `ok:false` + issues>0 + 零写入（+ seed.ok 前置） | 根套件（两态 47 passed 实测） | 断言面逐字未改；意图锚（领域失败留 ok:false 联合）在 union 永久拒绝面成立 | — |
| P-2（对称面重锚后） | union 数组目标：污染 insert → `ok:false` + 零写入 + 零 update + length 不变（+ baseline 前置） | 同上 | 四断言逐字未改；三分面互补语义保持 | — |
| 证据日志 | SA3 报告 §Verification 全表 | — | 日志内容与静态推演交叉一致（见 §3 AC7/§11）；reanchor-neutrality 呈现两态判据（8 failed 恰 = 契约 + 重锚 47 绿） | — |

SA6 三件套零修改（md5 三重复核）；探针零修改（D-1 处置正确——改探针 = 篡改变更前证据）。

## 10. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 变更后探针刷新（G 组改写为目标行为断言的 post-change 版本）缺席——现役探针 12 FAIL 仅作翻转记录，无机器判据钉新不变量（n≤4096 已由 vitest 契约覆盖；n=10⁵ 毫秒面仅 ×1.4 软读数） | Controller/SA6（SA3 无权改写 SA6 证据） | 新探针 U/S/O/N + G2d + 新 G 组全绿 exit 0 | 任一 post-change 不变量回退 |
| 全量门禁在干净检出下复跑（本轮为 SA3 工作区单次运行 + SA4 日志核对） | SA7 最终验证 | 根 `pnpm test` 464/5647 绿、`pnpm typecheck` exit 0 复现 | 任何复现失败或环境相关翻红 |
| 同事务窗口内「长度不变 + 变更区间内干扰」组合（NB 已覆写区间内插入项；区间内删除/移位形态无专用锚） | SA7 动态抽查（可选） | 事实核同一性/长度算术照常 E201-C | silent 通过 |

## 11. Reported evidence 复核（SA3 §Verification 逐条）

| 声明 | 复核结果 |
|---|---|
| 聚焦 2 files/25 tests exit 0 | `sa3-issue436-focused-final.log` 尾部一致（8+17 全绿、Type Errors: no errors） |
| 根 test 464 files/5647 tests exit 0 | `sa3-issue436-root-test.log` 尾部一致；计数 = SA6 post-contract 基线（5622+17+8），失败面 8→0 |
| 根 typecheck / 包 tsc exit 0 | 两日志 EXIT=0；15 包 tsconfig 链与 package.json script 一致 |
| 两态判据（重锚中性 + 实现前失败面恰 = 契约 8） | `sa3-issue436-reanchor-neutrality.log`：1 failed | 2 passed（8 failed | 47 passed）——与设计 §12 AC7 前半逐字吻合 |
| 探针 26 PASS / 12 FAIL（恰 = G 组） | `sa3-issue436-probe.log` + `-flip.txt`：12 FAIL 全为 G 组自标「HEAD 现状」断言，观测值逐条 = 契约目标行为（ok:true/reads=1/0/thrown=undefined）；U/S/O/N + G2d 26 PASS |
| SA6 三件套 md5 未改 | 本轮复算三 md5 与 `sa3-issue436-sa6-trio-md5.txt` 一致 |
| recheck-diff 材料 | patch 恰 3 个 diff（ADR + 两测试）= SA8 清单①②范围 |
| 日志间交叉一致性 | SA6 侧（focused 8/17、post-test 8/5639/5647）与 SA3 侧（25/25、0/5647）算术闭合；`git stash list` 空（暂存临时操作已清） |

**限制声明**：SA4 不运行测试；上述结论 = 日志内容核对 + 静态代码推演双向印证（读计数 1/0/0、
E201 行为、域文案逐字、字节形态均与代码结构一致）。最终运态复验归 SA7。

## 12. Non-blocking observations

- **O-1（MINOR，D-1 裁决）**：SA6 §12.2 第 8 条「探针 exit 0 不变」在实现后**结构性不可达**——
  探针自身头部（L4–L10）把 G 组定义为「HEAD 现状 / fast path 未接线」缺口断言，而 FC1/FC2、
  FB、FA 组目标行为恰要求这些观测翻转；该句与契约自身目标行为内部矛盾。SA3 的处置（不改探针、
  如实记录 12 FAIL、其观测值逐条等于契约目标行为、U/S/O/N+G2d 26/26 保持）是唯一正确读法，
  **SA4 采纳该口径**；探针不在 vitest include 面（SA6 §14），不构成 CI 门禁项。建议（非阻断）：
  由 SA6 出变更后探针（G 组改写为目标行为断言）收口机器判据——routing: acceptance-contract。
- **O-2（MINOR，风格）**：`composeBatchVerify` 的跳折迭判别用 `verify.kind !== 'boundary'`
  而非 `=== 'install-facts'`——在封闭判别联合下两者等价且前者对未知第三变体更防御，无行为
  差异；仅记录，无需改动。
- **O-3（记录）**：SA2 N-2 的覆盖面映射复核成立——非 union fast-path 的领域拒绝（越界/非法
  新值/载体错位 → `ok:false` 零写入）由 SA6 NC1/NC2/NC4 + 既有 A-4/A-5 锚定，重锚后 W5/对称
  面护栏存续于 union 面，覆盖无缺口。SA2 N-3 的 docs 义务核对项已履行（注记在位，`git diff`
  可核）。

## 13. Required revisions

无（无 BLOCKER/MAJOR；MINOR 观察项见 §12，不阻断 approve）。

---

## 附：一句话结论

**approve**：双条件闸门 + 接缝第三锁、O(1)/O(k) fast path、`VerifyPlan` 判别联合 S9 收窄、
零写入与最小 edit 纪律、两用例定向重锚与 ADR-0007 注记同批落地——全部与批准设计/SA6 契约
逐锚点一致；7 文件严格在 ALLOW 内、DENY 面 md5 级零触碰；报告的证据日志链内部自洽且与静态
推演互证。唯一偏差 D-1（探针 exit 0 判据）为准则句面陈旧，非实现缺陷，口径已裁决（§12 O-1）。
