# SA9 Standards Review（仓库与工程标准轴）— Issue #436：doc-runtime 数组 fast path 接线与 S9 收窄（ADR 0033 · doc-runtime 侧）

- 派发：`sa-d6db25a6-021e-4ed5-aafb-54974396785c`（role `mabf-sa9`，phase `standards-review`，iteration 0）
- **Verdict：`approve`**（无 BLOCKER、无 MAJOR；MINOR 3 项不阻断，见 §7）
- 审查对象：已提交最终交付 diff `7407ce0` → `f61e583`（`feat(doc-runtime): add array mutation fast
  path`，branch `mabf/issue-436` HEAD）；权威基线 = Parent PR #434 head
  `7407ce01367b6d7a3fe497cd78c4bcf085f3ddbb`，经 `git merge-base --is-ancestor` 独立确认为 HEAD 祖先，
  与 Host 简报及 SA1/SA2/SA6/SA8 各报告基线一致
- 交付面 = 已提交 diff（4 个 src 文件 + 2 个定向测试文件 + ADR-0007 注记 + SA6 三件套新文件 +
  证据日志与 wiki 工件）+ Host 明示的**预期证据产物**（staged：`artifacts/sa3-issue436-reanchor-
  neutrality.log`、`sa3-issue436-recheck-diff.patch`、`sa6-issue436-{focused-final,post-test,
  stability-1..5}.log`、`wiki/raw/task_issue-436.md`）——本审查对两者一并核对
- Issue-comments REST：空快照（Host 明示「no owner requirements」）——无 Owner 追加义务，与简报
  `## Comments` 空节、SA6 §2、SA2 §4、SA8 两报告多方一致
- 审查方式：静态实读 + 只读命令独立复核（`git diff`/`git status`/全仓 grep/md5 复算/日志尾部抽验/
  行号锚点实读）。**未运行测试、未启动服务、未修改任何代码/设计/测试**——绿证据采信已留档 SA3/SA6
  日志，本审查只对证据链真实性、范围纪律与标准符合性做独立抽验

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-436.md`（Issue #436 正文 + AC1–AC7；Comments 空；staged 待入库） | 已读 |
| 母法 `docs/adr/0033-elementwise-yarray-mutation-validation.md`（已接受；决策 1–6） | 已读全文 |
| 关联 ADR：0007（#237 修订节条款 1/4/7 + 本次新增注记 L126–140）、0010（#237 节零改动核对）、0008（#237 镜像节）、0025/0026（信封/guard 面） | 已读相关节 |
| `CONTEXT.md` L144（重建校验/数组位例外）/L202（复制未校验） | 实读核对（已目标态立法，零改动成立） |
| 设计 `task_issue-436_design.md`（iteration 1 修订版；§7.1–§7.7/§11 ALLOW-DENY/§12/§15） | 已读全文 |
| SA2 设计攻击评审 `approve`（F-1 MAJOR + O-1..O-4 全部裁决已解决） | 已读 |
| SA3 实现报告（7 文件 ALLOW 映射、验证矩阵、D-1 偏差声明） | 已读 |
| SA4 实现静态审查 `approve`（0 BLOCKER/0 MAJOR；§12 O-1..O-3 观察项） | 已读 |
| SA6 验收契约 `approve`（B-1..B-6、8 红 + 17 负控、§12.2 目标行为、§13 判据、§14 runner 证据） | 已读 |
| SA8 设计后冲突复查 `clear`（`requiresConflictRecheck:true`，§8 清单①②）+ 实现后冲突复查 `clear`（`=false`，清单闭合） | 已读 |
| 模块纪律：根 `AGENTS.md`、`packages/doc-runtime/AGENTS.md`、`docs/AGENTS.md` | 已读（注入 + 实读核对） |
| 最终 diff 全部生产/测试/文档文件 | 逐 hunk 实读 |
| 证据日志 `artifacts/sa3-issue436-*`（9 件）+ `artifacts/sa6-issue436-*`（10 件） | 只读抽验（尾部计数/exit 码/交叉算术） |

缺席输入（不构成判断缺口）：`task_issue-436_relevant_decisions.md`/`_conflict_report.md`（iteration 0
起不存在）——SA8 已以两报告补位裁决，约束语义全部可从已合入 ADR 0033 + CONTEXT + SA6 冻结契约恢复；
SA7 动态验证报告尚未产生（后续阶段，非本审范围）。

## 2. 独立复核（非转述 SA 声明）

| 复核项 | 命令/方法 | 实测结果 |
|---|---|---|
| 祖先关系 | `git merge-base --is-ancestor 7407ce0… HEAD` | 成立（exit 0） |
| 已提交 diff 范围 | `git diff 7407ce0..HEAD --stat` | 恰 = 4 src（mutation-local/install-verify/mutation/extract）+ 2 定向测试 + ADR-0007（+16 行纯追加）+ SA6 三件套（新文件 150/256/204 行）+ 证据日志 + wiki 工件；与设计 §11 ALLOW 七项一一对应 |
| DENY 面零触碰 | `git diff … -- packages/vfsl packages/doc-runtime/src/index.ts packages/namespace-runtime packages/namespace-diagnostic-log apps docs/adr/0033-*.md docs/adr/0010-*.md CONTEXT.md vitest.config.ts tsconfig* pnpm-lock.yaml` | **空 diff**（exit 0，无任何输出） |
| SA6 三件套冻结 | md5 复算 vs `artifacts/sa3-issue436-sa6-trio-md5.txt` | 三件逐字节一致（`2dd066f4…`/`c9e0e6c1…`/`8358d454…`）；红灯经实现自然转绿，契约零修改纪律成立 |
| 公共面泄漏 | grep `carrierMismatchIssue\|verifyPrepared\|VerifyPlan\|verifyBoundaryInstallFacts` 于 `src/index.ts` | **零命中**（exit 1）；全部新符号 `@internal` 注释在案；`VerifyBoundaryIntactInput.proposedBoundary` 保持必填（install-verify.ts L360 无 `?`）——判别联合取代可选字段的防静默降级设计兑现 |
| 接缝第三锁 | 实读 `packages/vfsl/src/validate-patch.ts` L1079–1099 | `applyElementwiseArrayMutation` 对 `plan.kind≠array`/`relPath≠[]`/`node.kind≠array` 三条件 fail closed，在案且本轮零改动 |
| 契约消费链闭合 | grep `verifyBoundaryIntact\|LocalPreparedResult` 于全仓 src | `verifyBoundaryIntact` 仅存于 install-verify.ts（定义 + `verifyPrepared` 内部分派）；`LocalPreparedResult` 仅 mutation-local.ts——无第三消费方漏改 |
| 单一实现核对 | 实读 diff | 事实核为 `verifyBoundaryInstallFacts` 逐字抽取（E201-C 四分支文案/E201-D 包裹均 context 行零变化）；`carrierMismatchIssue` 单构造器被 walk 与 fast-path F1 共享（extract.ts 两处内部调用点同步更名，零手拼字面量） |
| 闸门与管线 | 实读 mutation-local.ts L312–374 vs 设计 §7.1/§7.2 伪代码 | 双条件合取（`plan.node.kind==='array' && resolvedBoundary.kind==='array'`）逐字对应；F1–F5 逐行对应（含 O-3 修订的 `const values = mutation.values!`、局部 `let commit/facts`）；legacy 分支（L375 起）经 diff 对照 = HEAD 原文 + verify 包装形变（设计 §8.1 规定） |
| 批量接线 | 实读 mutation.ts L353–380 | 阶段 C 按 `verify.kind !== 'boundary'` 跳折迭；折迭输入侧（`parsed[j]` 驱动）零改动；引理 3 依据注释在案；信封解析/guard/E1–E6 区无 hunk |
| ADR-0007 注记一致性 | 实读 0007 L74–78/L100–104/L118–124 + 注记 L126–140 | 注记引文与条款 1「批量 values[]/count 一次整体判定，不逐元素」（L76–77）、条款 4(ii)「数组位」（L102 边界清单）、条款 7「array……按边界规模」（L121–122）逐字对应；纯追加 16 行、0 删改；带日期 + 授权链（ADR 0033 决策 1–4 + docs/AGENTS.md 义务句 + 显式修订节先例） |
| CONTEXT/ADR-0010 | 实读 + git status | CONTEXT L144/L202 已由 `f6b27da` 立法为目标态（零改动自洽）；ADR-0010 零 diff（母法决策 4 标题点名修订，单一真相源引用链闭合） |
| 重锚定向纪律 | 实读两测试 diff | P-1：唯一 hunk = `W5_TEXT` schema 行改 union 数组 + 注释授权链；P-2：两 hunk = 新增模块级 `TEXT_LIB_ITEM_UNION`（紧邻共享常量，SA2 N-1 建议位）+ 对称面用例 `fixtureOf` 切换；断言/seed/污染/操作零触碰；共享 `TEXT_LIB_ITEM` 零触碰 |
| 测试削弱扫描 | grep `\.only\|\.skip\|\.todo` 于三件套；grep `console\.\|TODO\|FIXME\|debugger\|\.only\|\.skip` 于全 diff | 双零命中（exit 1）；fixture 头纪律声明（确定性/零真实时钟/零网络）在案 |
| 测试惯例一致 | grep `as MutationEnvelope` 于既有测试 | 7 个既有测试文件同款用法——fixture 单处 cast（运行时校验公共入口的既定测试惯例）符合仓规 |
| runner 入口真实 | 实读 `vitest.config.ts` L15/L20 | 三件套中两 `.test.ts` 匹配 `packages/*/test/**/*.test.ts`；fixture 命名 `-fixture.ts` 不匹配 include（共享模块定位正确）；探针在 `wiki/raw/`（不在 include 面，SA6 §14 声明属实） |
| 证据日志链 | 只读 tail 抽验 | SA6 基线 462 files/5622 tests 绿 → post-contract 464/5647（8 failed 恰 = 契约）→ SA3 实现后 **464/5647 全绿**；算术闭合（5622+17+8=5647；462+2=464）；聚焦 25/25、包 tsc/根 typecheck EXIT=0；reanchor-neutrality 两态判据（8 failed | 47 passed）与设计 §12 AC7 逐字吻合 |
| 探针翻转记录 | 实读 `sa3-issue436-probe.log` + `-flip.txt` | 38 checks = 26 PASS（U/S/O/N + G2d，探针自标「post-change 必须不变/保持」组）/ 12 FAIL 恰 = G 组（自标「HEAD 现状/未接线」缺口断言），观测值逐条 = 契约目标行为（reads=1/0、ok:true、thrown=undefined、×1.4）；SA6 期 `sa6-issue436-probe.log` exit 0（38/38）在案 |
| 工作区卫生 | `git status --porcelain` | staged 面恰 = Host 明示的 10 件预期证据产物（9 日志/patch + 任务简报）；无散落临时文件；`git stash list` 空（SA3/SA4 声明复核） |

## 3. 标准符合性逐项

### 3.1 ADR 0033（母法）—— ✅ 逐项符合

| 条款 | 符合性 | 证据 |
|---|---|---|
| 决策 1（闸门双条件；union 永久回退；规划层不动） | ✅ | mutation-local.ts L331–332 双条件合取；legacy 分支逐字保留；`planMutationBoundary` 零改动（vfsl 零 diff） |
| 决策 2（live 长度 O(1)；域规则逐字；issue 路径逐字节；delete O(1)；最小 edit；零写入先序） | ✅ | F2 `target.length`；F3 接缝消费（文案直出无复制）；F4 同路径构造式；`commitPrepared`/`transactGuarded` 区零 hunk；一切失败 prepare 期 return |
| 决策 3（事实核保留；fast-path 省略重投影；legacy 双核不变） | ✅ | `VerifyPlan` 判别联合 + `verifyPrepared` 分派；事实核逐字抽取两轨共享；legacy `verifyBoundaryIntact` = 事实核 + 重投影核原样 |
| 决策 4（触达面 = 载体 + 变更区间；不补异步审计） | ✅ | F1 载体检查保留（条款 4(i) 面）；零审计代码新增；Δ1/Δ2/Δ3 行为面各有契约锚 |
| 决策 5（vfsl 立法/enforcement 面） | ✅ | `packages/vfsl/**` 零 diff |
| 决策 6（性能软验收，不钉毫秒） | ✅ | 契约以结构性读计数（≤8/≤4、n 解耦）为硬锚；毫秒仅探针软证据 |

### 3.2 仓库 AGENTS / 模块纪律 —— ✅

- 根 `AGENTS.md` 模块指引：编辑前读最近 `AGENTS.md` 的纪律在各报告中均有记录；本审实读
  `packages/doc-runtime/AGENTS.md` 核对。
- doc-runtime 包契约：校验失败零写入（fast path 一切失败先于 `transactGuarded`）；detached 构造 +
  单 guarded transaction（复用 `buildDetachedValue`/`commitPrepared`，零改动）；写后不变量失败 =
  fatal（E201 C/D 文案逐字保留，fatal 分类不削弱）；公共 API 仅经 `src/index.ts`（零 diff，新符号
  全 `@internal`，public-surface guard 面不动）。
- 验证门：包测试 + 根 `pnpm typecheck` + 根 `pnpm test` 证据在案（本审不运行，采信日志并抽验真实性）。
- `docs/AGENTS.md` 义务句：「code behavior changes ⇒ update every normative document whose stated
  contract changed」——ADR-0007 注记同变更集交付（SA8 独立扫描证实陈旧面恰一处、无遗漏义务面）；
  「Amend or supersede explicitly」——显式修订注记 + 授权链，非静默矛盾。

### 3.3 架构惯例 —— ✅

- 判别联合结果面（`{kind:…}`）与 `LocalPreparedResult`/`ApplyValidatedMutationResult`/plan kinds
  仓内惯例一致；被拒绝的静默降级形态（`proposedBoundary` 可选化）未出现（L360 必填实测）。
- 既有测试锚迁移沿「意图不变、载体演进 + 授权链注释」先例（W5 自身 #237 修订史同款）。
- 接缝消费而非内联复制（#435 交付的既定消费方式）；载体错位 issue 单一构造器反文案漂移。

### 3.4 单一事实源 —— ✅

域规则文案/路径 = vfsl 接缝单实现（doc-runtime 零复制）；安装事实核 = `verifyBoundaryInstallFacts`
单实现两轨共享；载体错位 issue = `carrierMismatchIssue` 单构造器；规范链 = ADR 0033（母法）→
CONTEXT（已立法）→ ADR-0007 注记（本票补齐唯一残留陈旧面）→ 重锚测试（引成文授权链）——四层
同批闭合，无漂移源（SA8 实现后复查 `clear` + `requiresConflictRecheck:false` 独立确认）。

### 3.5 生命周期对称性 —— 不适用

纯同步函数管线改造；未引入资源句柄/订阅/后台任务/定时器；fixture 的监听挂卸
（`withUpdates`/`tamperOnNextLocalCommit`/`countElementReads`）均在测试内 try/finally 对称恢复。

### 3.6 文件范围 —— ✅

7 个生产/测试/文档文件严格落在设计 §11 ALLOW 七项内（条件项 extract.ts 仅取「导出助手」一侧，
未两端都改）；DENY 面经独立 `git diff` 实证零触碰（§2 表）；SA6 三件套 md5 级冻结；证据日志与
wiki 工件沿仓库既定惯例入库（基线树含 400 件 artifacts/、1733 件 wiki/raw/ 先例；`.gitignore`
不误伤）。

### 3.7 测试质量标准 —— ✅

- 契约/负控：零 skip/only/todo/env override/fallback（grep 实证）；断言只观察运行时行为（判别联合
  结果、issue message/path、读计数、update 事件/字节、branded fatal 事实、逻辑值），无源码字符串
  断言；期望值 = 冻结常量或机制 oracle（同 clientID 手写最小 edit 字节等价、对端复制收敛）；读计数
  代理覆盖 `get`/`toArray`/`forEach` 无逃逸口且与行为断言成对；篡改注入统一走 `afterTransaction`
  cleanup 窗口（#350 SA7 先例）；确定性（固定 clientID 仅限字节比较用例、零真实时钟、零网络）。
- 红→绿链完整：5 轮红灯集合 md5 稳定（`719cbdb4…`）→ 实现后 8/8 转绿；负控 17/17 双态保绿；
  重锚两用例两态 47 passed（实现中性实测）。
- 重锚断言语义面零放宽（diff 逐行核对：P-1 三断言、P-2 四断言逐字保留）。

## 4. D-1 偏差（探针 exit 0 判据）的标准轴裁决

SA6 §12.2 第 8 条/§13 的「探针 exit 0 不变」在实现后**结构性不可达**：探针头部自标 G 组 = 「HEAD
现状 / fast path 未接线」的缺口断言，本票的实现恰是关闭该缺口。SA3 处置（不改探针、如实记录
12 FAIL、观测值逐条等于契约目标行为、U/S/O/N+G2d 26/26 保持）为唯一正确读法——改探针 = 篡改
变更前证据；探针不在 vitest include 面（`vitest.config.ts` L15 实测），不构成门禁项。SA4（§12
O-1）与 SA8（§3 专项裁决：非决策冲突）已分别裁定为「准则句面陈旧」与「验收证据面」。标准轴结论：
**处置符合证据纪律，不构成本审阻断项**；变更后探针刷新（G 组改写为目标行为断言）已登记为 SA6/
SA7 后续项（见 §7-M1）。

## 5. 与既有审查链的一致性

- SA2 `approve` 的五项 finding（F-1 + O-1..O-4）落实面经本审对 diff 逐项复核成立（§2）。
- SA8 设计后门禁 `clear`+`requiresConflictRecheck:true` 的复查清单①（注记文案一致性）/②（重锚
  diff 面 + 断言零放宽）经实现后复查闭合（`clear`+`false`）；本审对同两面独立抽验结论一致。
- SA4 `approve` 的零 BLOCKER/MAJOR 结论与三 MINOR 观察项，本审无新增对立发现；其 §10 后续动态
  验证项（全量门禁干净检出复跑、探针刷新、区间内干扰动态抽查）归 SA7，不在本审范围。

## 6. 范围说明（非 SA9 职责）

Issue 需求完成度（AC1–AC7 是否全部实现）归 SA10 验收；本审仅就仓库/工程标准轴裁决。

## 7. Non-blocking observations（MINOR，不阻断 approve）

- **M1（文档级陈旧句）**：SA6 契约 §12.2 第 8 条/§13「探针 exit 0 不变」为变更前诊断探针的
  陈旧判据句，实现后结构性不可达；口径已经 SA4/SA8 裁决（§4），但契约文档本身仍载该句，且
  变更后探针（G 组改写为目标行为断言的机器判据）尚未产生。建议（非阻断）：由 SA6 出 post-change
  探针收口——routing: acceptance-contract；在探针刷新前，post-change 不变量的机器判据由 vitest
  契约面（25 tests）承担，覆盖无实质缺口。
- **M2（过程性）**：预期证据产物分两处落地——`f61e583` 已入库一批 SA3/SA6 日志，另 10 件
  （含 `sa3-issue436-reanchor-neutrality.log`、`sa3-issue436-recheck-diff.patch`、SA6
  focused/post-test/stability×5、任务简报）当前 staged 待入库。Host 已明示其为交付内容，且仓库
  惯例即入库 artifacts/wiki（基线树 400/1733 件先例），不构成分歧；记录以便 finalize 阶段
  一并落库，避免证据链半入库状态。
- **M3（可选编辑跟进，转录 SA8 §8 行 3）**：ADR-0008 #237 镜像节括注「（O(1) 安装事实核 +
  O(boundary) 重投影核）」为 #237 期 S9 组成摘要，fast-path 后非 union 数组提交为 install-facts
  单核——该节授权链明文 ADR-0007 为单一真相源、ADR-0008 自身契约未变，不构成矛盾句面；
  后续顺路修订该 ADR 时可加半句对齐粒度。SA8 已裁为可选、非义务触发。

## 8. Required revisions

**无**（无 BLOCKER/MAJOR）。

---

## 附：一句话结论

**approve**：已提交交付（`7407ce0..f61e583` + 预期证据产物）对 ADR 0033 决策 1–6 忠实落地、
ALLOW/DENY 范围纪律 md5 级兑现、单一事实源（接缝/事实核/载体构造器）零平行实现、公共面零变化、
测试质量（机制 oracle + 双态判据 + 红绿链）与证据链（算术闭合、内部一致）全部符合仓库与工程标准；
唯一偏差 D-1 为陈旧判据句而非实现缺陷，处置符合证据纪律。MINOR 3 项（§7）不阻断。
