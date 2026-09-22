# SA9 Standards Review（仓库与工程标准轴）— Issue #437：lease 端到端数组逐元素校验行为钉死（ADR 0033 · lease/registry 侧）

- 派发：`sa-d88866ad-d250-4189-ae86-094582a5da0d`（role `mabf-sa9`，phase `standards-review`，iteration 0）
- **Verdict：`approve`**（无 BLOCKER、无 MAJOR；MINOR 5 项不阻断，见 §7）
- 审查对象：已提交最终交付 diff `02c7cfb` → `b262854`（`test(registry): cover lease array element
  validation`，branch `mabf/issue-437` HEAD）。权威基线 = Parent PR #434 head
  `02c7cfb1abf88f764690aaabf8c31a20074e7179`，经 `git merge-base --is-ancestor` 独立确认为 HEAD 祖先
  （exit 0），与 Host 简报及 SA1/SA2/SA3/SA4/SA6 各报告基线一致
- 交付面 = 已提交 diff（3 个测试新文件 + 探针 + 6 件 wiki 工件 + 12 份证据日志）+ worktree 内
  未入库证据（`artifacts/sa6-issue437-{baseline-focused,baseline-stability-1..3,head-focused,
  head-stability-1..5}.log`、`wiki/raw/task_issue-437.md`）——本审查对两者一并核对
- Issue-comments REST：空快照（Host 明示「no owner-comment requirements」）——无 Owner 追加义务，
  与简报 `## Comments` 空节、SA6 §2、SA2 §4、SA3/SA4 输入表多方一致
- 审查方式：静态实读 + 只读命令独立复核（`git diff`/`git status`/`git ls-tree`/全仓 grep/md5 复算/
  日志抽验/行号锚点实读）。**未运行测试、未启动服务、未修改任何代码/设计/测试/证据件**——绿证据
  采信已留档 SA3/SA6 日志，本审查只对证据链真实性、范围纪律与标准符合性做独立核验
- 轴界说明：需求覆盖完整性属 SA10 轴；本审查只判「当前实现是否符合仓库/工程标准」

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-437.md`（Issue #437 正文 + AC1–AC6；Comments 空；untracked 待入库） | 已读 |
| 母法 `docs/adr/0033-elementwise-yarray-mutation-validation.md`（已接受；决策 1–6；状态行：协议/诊断/写槽零改动） | 已读全文 |
| 设计 `task_issue-437_design.md`（354 行；§7.1–§7.7/§9 门禁/§10 ALLOW-DENY/§12 风险） | 已读全文 |
| SA2 设计攻击评审 `approve`（0 BLOCKER/0 MAJOR；§14 O-1..O-4） | 已读 |
| SA3 实现报告（原样采纳声明、5 门禁证据、SA2 finding 落实表） | 已读 |
| SA4 实现静态审查 `approve`（0 BLOCKER/0 MAJOR；§12 O-A..O-D） | 已读 |
| SA6 验收契约 `approve`（B-1..B-7、§12.2 目标行为、§13 判据、§14 runner 证据、§16 冻结指纹） | 已读 |
| SA6 探针 `task_issue-437_sa6_capability_probe.mts`（G0/G1 + P1–P5，32 项） | 已读头部/导入面/计数器 |
| SA8 工件 `_relevant_decisions.md`/`_conflict_report.md` | 不存在（iteration 0 确认；设计 §6 以替代规范约束面补位，与本票 test-only 零决策修订的性质相符） |
| 模块纪律：根 `AGENTS.md`、`packages/namespace-registry/AGENTS.md`、`docs/AGENTS.md` | 已读（注入 + 实读核对） |
| 交付三件套（契约 398 行 / 负控 173 行 / 夹具 524 行） | 逐行实读 |
| 证据日志 `artifacts/sa3-issue437-*`（5 件）+ `artifacts/sa6-issue437-*`（已入库 7 件 + 未入库 10 件） | 只读抽验（计数/exit 码/行号锚点/md5） |

缺席输入（不构成判断缺口）：SA7 动态验证报告（后续阶段，非本审范围）；SA8 冲突复查工件（设计 §13
「否」结论经本审独立确认成立——零生产语义变化、零决策修订、零规范面触碰）。

## 2. 独立复核（非转述 SA 声明）

| 复核项 | 命令/方法 | 实测结果 |
|---|---|---|
| 祖先关系 | `git merge-base --is-ancestor 02c7cfb… b262854` | 成立（exit 0） |
| 已提交 diff 范围 | `git diff 02c7cfb..b262854 --name-only` | 恰 21 件 = 3 测试文件（registry/test/）+ 探针（wiki/raw/）+ 6 wiki 工件 + 12 证据日志（sa3×5 + sa6×7）；与设计 §10 ALLOW 七项一一对应，无越界路径 |
| 生产零改动（test-only 约束） | 上述 diff 中 `packages/*/src/**`、`apps/**`、`domains/**`、构建/测试配置 | **零命中**——issue 正文「本 ticket 不改实现」与 ADR 0033 状态行（协议/诊断/写槽零改动）在交付面成立 |
| DENY 面零触碰 | diff 全清单 vs 设计 §10 DENY（doc-runtime/vfsl/namespace-runtime/registry/diagnostic-log 的 src、issue-435/436 既有测试、ws-replication/apps/replication-protocol、docs/adr、CONTEXT.md、vitest.config.ts、tsconfig*、package.json/pnpm-lock、registry 既有测试） | **全部零触碰**（diff 中无任何 DENY 路径） |
| diff 卫生 | `git diff --check 02c7cfb..b262854` | 干净（exit 0，无空白错误） |
| SA6 冻结指纹 | md5 复算四件 vs SA6 §16/SA3 报告 | 逐字一致：契约 `62de8c3109d5bce2dffe328034e2129c`、负控 `34f5003938b3db5a3b1c8f97a9c4f034`、夹具 `9fa5995f24833b96ec848ca654ccb1dc`、探针 `3b647b42dda08554d679efacbbb42674` ⇒ SA3「原样采纳、未改写/重排/软化」声明属实 |
| 测试矩阵实物 | grep `  it('` 计数 | 契约 **13**、负控 **7**，与设计 §7.2 冻结矩阵及 SA6 §12.3 一致（AC1-a..e、AC2-a/b/d/c、AC4-a/b、AC5-a/b；C1–C7） |
| 判据纪律 sweep | grep `\.skip\|\.only\|\.todo\|it.each\|process.env\|setTimeout\|readFileSync`（两测试文件）+ `catch`（夹具） | 两测试文件**零命中**；夹具仅注释提及「零 setTimeout 竞猜」，零 `catch`（唯一 `try` 为读计数包装的 try/finally 复位，`finally` 内 `delete` 实例包装——非吞错） |
| 断言期望逐字对源 | 实读 `mutation.ts` 信封门/域规则、`validate.ts` 仲裁文案 | AC2-c 三形态（`ops 必须是非空数组（空数组）`/`array-insert values 必须是非空数组`/`array-delete count 必须是严格正整数`）= `mutation.ts:256/649/654` 源文；AC2-b 越界两条 = `mutation.ts:820/829`；C1 `联合成员 1/2：类型不匹配：期望 number，实际 boolean` = `validate.ts:529` label（`联合成员 ${winner+1}/${N}：`）+ `:203` 模板（`jsonTypeOf(true)='boolean'`，`:153-163` 实读）逐字闭合 |
| lease seam 锚点 | 实读 `lease.ts:330-331/392-394` | `readData`/`mutateData` 原样透传 `entry.runtime.*` 属实——lease 确为用户可见判别联合的最终形状面，最高 seam 选择成立 |
| registry 模块纪律 | 实读 `packages/namespace-registry/AGENTS.md` + 夹具装配面 | 夹具只经公共入口：`createNamespaceRegistryForTesting`/`createRegistryTestScheduler`（`testing.ts:86/126` 实锚，`./testing` export 在 `package.json:11`）；诊断经 `createBoundedMemoryDiagnosticLog` 公共 index（相对源路径 `../../namespace-diagnostic-log/src/index.js`，与既有惯例 `registry-create-diagnostic-red.test.ts:95` 等实锚一致——本审复核 `:90-95` 命中）；零 `src/index.ts` 外新公共 API（src 零 diff）；registry 为 runtime/lease/session/诊断的 host 级 owner，AC4/AC5 装配面归属正确 |
| 发现面真实 | 实读 `vitest.config.ts:15` + 根 `package.json:11` + `tsconfig.typecheck.json` | include `packages/*/test/**/*.test.ts` 匹配两新 `.test.ts`；fixture 命名 `-fixture.ts` 不匹配 include（共享装置定位正确，非测试入口）；根 `pnpm test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；宽 tsc 含 `packages/*/test/**/*.ts`（三新文件入类型检查） |
| 证据日志链真实性 | 只读抽验尾部计数/exit 码/行号 | `sa3-issue437-focused.log`：2 files / **20 passed (20)**、`Type Errors no errors`、`FOCUSED_EXIT:0`；`sa3-issue437-probe.log` 与 `sa6-issue437-probe.log` 双份：**32/32、failures=0、PROBE_EXIT:0**（P5a fast=0 / P5b legacy=191）；`sa3-issue437-root-typecheck.log` / `sa6-issue437-{head,post}-typecheck.log`：`TYPECHECK_EXIT:0`；`sa3-issue437-wide-typecheck.log` / `sa6-issue437-typecheck-tests.log`：`WIDE_TSC_EXIT:0`；`sa3-issue437-root-test.log`：**466 files / 5667 tests 全绿**、`ROOT_TEST_EXIT:0`，两新文件收集行 L378/L584 实测命中；`sa6-issue437-post-root-test.log`：466/5667 全绿、`TEST_EXIT:0`，收集行 L377/L646 命中（SA6/SA3 报告的行号引用分属两日志，均精确命中） |
| 判别敏感性证据 | 抽验未入库基线/稳定日志 | `sa6-issue437-baseline-focused.log`：**6 failed / 14 passed**（契约文件 13 tests 中 6 failed——判别组 AC1-a..e + AC2-d）；baseline-stability-1..3 逐轮同 6/14；head-focused + head-stability-1..5 逐轮 **20/20**——红/绿分裂与归因（pre-#436 实现）证据在位且数值一致 |
| 能力缺口事实 | 独立 `git grep -l "array-insert\|array-delete" -- packages/namespace-registry/{test,src}`（排除 issue-437 新件） | **零命中**（exit 1）——SA6 §5.1 census「lease(registry) 面 array-* 覆盖 0 件」独立复证属实 |
| 依赖面零新增 | diff 无 `package.json`/`pnpm-lock.yaml`；夹具 imports 对 `packages/namespace-registry/package.json` | `@nomicore/persistence`（`:29`）、`yjs`（`:31`）、`@nomicore/namespace-runtime`（`:28`）、`@nomicore/namespace-diagnostic-log`（`:27`）均为既有 workspace 依赖；零新依赖属实 |
| 工作区卫生 | `git status --short` + `ls .worktrees/` + `sa6-issue437-cleanup-check.log` | untracked 面 = 10 份 SA6 基线/稳定日志 + 任务简报（入库时机见 §7 M-4）；`.worktrees/` 空；cleanup-check 记录基线 worktree 已移除、`git worktree list` 仅主仓 + 任务 worktree；无临时 debug 文件残留（`zz-issue437-debug.test.ts` 不存在） |
| 先例对照（入库形态） | `git show --stat f61e583/bc66e98/d7ad19b`（#436 三提交） | #436 交付提交同样只含 sa3 日志 + 部分 sa6 日志 + wiki 工件；任务简报与 stability 日志在后续 `docs: normalize issue 436 evidence`（bc66e98）入库——#437 当前形态与既定先例一致 |

## 3. 标准符合性逐项

### 3.1 ADR 0033（母法）—— ✅ 逐项符合

| 条款 | 符合性 | 证据 |
|---|---|---|
| 状态行（复制协议、诊断捕获、namespace-runtime 写槽零改动） | ✅ | 交付 diff 生产面为零（§2）；测试只经公共入口观察 |
| 决策 1（闸门/union 永久 legacy 双轨） | ✅ | 契约 AC1 组（非 union 快轨 `ok:true`）× 负控 C1–C3（union 同污染响亮拒绝逐字判决）构成 A/B 闸门对照；不改闸门本身 |
| 决策 2（O(k)/零写入/issue 路径逐字节/commit 形态不变——「钉回归测试」的自我要求） | ✅ | AC2-a（`[items,2]/[items,3]` index+j + 嵌套 `[rows,1,'qty']`）/AC2-b（越界逐字）/AC2-c（空载荷形状拒绝）/AC2-d（fast ≤8 vs legacy ≥n=64 结构性读计数）；域 message 逐字对源核验一致——本票正是该自我要求在 lease seam 的执行 |
| 决策 3（S9 收窄/E201 面） | ✅ | 不触碰——归 #436 doc-runtime 面立法（`issue-436-array-fastpath-*` 在位，本票零重复） |
| 决策 4（触达面收窄：污染 delete 转成功；触达面外不发现） | ✅ | AC1-a..e 五形态（值污染 delete/insert、载体非法、字段值非法、批量信封）+ 写前 `readData` 可见性前置 + 写后污染保留断言 |
| 决策 5（逐元素一致性 fixture 立法面） | ✅ | 不重复——归 #435 vfsl 面（`issue-435-elementwise-array-*` 在位） |
| 决策 6（性能软验收，不钉毫秒） | ✅ | 结构性代理（live 元素读计数，机器无关计数阈值 ≤8/≥n），零计时阈值；与 #436 `countElementReads` 先例一致且有时序论证（`write.ts:187` 判定在 sequencer 槽内 await 之后 ⇒ 计数窗口覆盖整个 `mutateData` promise 窗口） |

### 3.2 仓库 AGENTS / 模块纪律 —— ✅

- 根 `AGENTS.md` 模块指引（编辑前读最近 `AGENTS.md`）：各报告均有记录；本审实读
  `packages/namespace-registry/AGENTS.md` 核对——registry 为 host 级 owner，AC4/AC5 的
  诊断绑定/复制会话装配只在该包测试面可达，seam 选择正确。
- registry 边界条款：「Add public APIs only through `src/index.ts`; keep hostile/test controls in
  the explicit testing surface」——src 零 diff；测试控制全经 `/testing` 显式面（testing.ts 实锚）。
- 验证门：registry AGENTS「Run root `pnpm typecheck` and `pnpm test`」——双门证据在案
  （`TYPECHECK_EXIT:0` / `ROOT_TEST_EXIT:0`，466/5667 全绿）；本审不运行，采信日志并抽验真实性。
- `docs/AGENTS.md`：「Historical `wiki/raw/` artifacts are evidence」——六件工件落位固定路径，
  惯例一致；本票零规范面改动（无新域词、无决策修订），不触发「code behavior changes ⇒ update
  normative documents」义务（生产行为本就零改动）。

### 3.3 架构惯例 —— ✅

- 观察面单一入口：全部用例只经 `lease.mutateData/readData` + `session.applyRemoteUpdate`；
  无平行通道、无 internal import、无 live Y.Doc 断言（`rootArray` 仅为装置面 oracle/污染构造导航，
  夹具头注释明示 ROOT 内数组必须经 `doc.getMap('ROOT').get(key)`，与生产读路径分离）。
- 污染注入纪律：统一经 replication trusted raw 面（ADR 0010 哲学），`applyRawRemote` 全部
  mutate 回调仅 `.insert(0,[…])`（不写既有键/元素——回避并发项 clientID 决胜的不确定合并）；
  clientID 三方固定（4242/4243/999999）。
- 共享装置惯例：`./issue-437-lease-array-e2e-fixture.js`（`.js` 后缀 import）与
  `issue-389-change-subscription-t3-fixture.ts` 先例一致；fixture 零 vitest 依赖（本地 `assert`
  + 有界 `setImmediate` 沉降），供契约/负控/探针三通道消费——单一装置多通道，非平行机制。
- 探针（wiki/raw 证据件）经 `packages/namespace-registry/node_modules/yjs/dist/yjs.mjs` 直取
  yjs 模块实例（symlink 归一保 Yjs 结构类型实例同一），文件内注释说明动机——SA2 O-4 已登记，
  双份 probe 日志 exit 0 背书现行布局可用。

### 3.4 单一事实源 —— ✅

- 行为期望值 = 现行实现冻结常量（域 message/path、union 仲裁 message、carrier 键集）——本审逐字
  对源核验一致（§2 表）；红灯即契约变化信号、走 ADR 修订的设计立场（设计 §12）杜绝静默同步机制。
- 收敛/增量形态 = 机制性 oracle（同基态重放、空 doc 不物化、diff 定点、A/B 对照）——构造性判定，
  无镜像状态、无第二份推导。
- 探针共用 fixture 而非复制断言——独立通道与测试面同一装置，无事实源分叉。

### 3.5 生命周期对称性 —— ✅（测试装置面）

- 读计数包装：`try/finally` + 实例属性 `delete` 复位（prototype 方法回归），零残留；窗口覆盖
  整个 `mutateData` await（时序论证与 `write.ts:187` 一致）。
- 每 test 独立 fixture（独立 persistence/registry/scheduler/doc）；受控 fake scheduler
  （`createRegistryTestScheduler`）零真实 timer；零网络、零长驻进程、零随机源（计数 randomBytes
  只服务 128-bit 且越界 throw）、固定 clock；测试未显式 close registry——与包内主流惯例一致
  （SA2 S-6 实核 50 既有文件仅 5 显式 close），无泄漏面。
- 订阅面（`subscribeOwnedUpdates`）随 fixture 进程生命周期结束；恰一提交/零泄漏 update 由
  AC5-b/C5/C6 与拒绝路径 `ownedUpdates.length===0` 断言双向钉死。

### 3.6 文件范围 —— ✅

- 已提交 21 件全部落在设计 §10 ALLOW 内（三件套 + 探针 + wiki 工件 + `artifacts/sa3-issue437-*`
  新增 + `artifacts/sa6-issue437-*` 保留）；DENY 面经独立 diff 实证零触碰（§2 表）。
- `.gitignore` 不误伤（artifacts/wiki 均非忽略面；TASK.md/`.mabf*`/`.worktrees/` 正确排除）；
  `git diff --check` 干净。
- 未入库面（10 份 SA6 基线/稳定日志 + 任务简报）与 #436 既定先例的入库形态一致（§2 先例对照），
  登记为 M-4 观察而非违例。

### 3.7 测试质量标准 —— ✅

- 零 skip/only/todo/each、零 env override、零 setTimeout 竞猜、零吞错 catch、零 fallback
  （grep 实证，§2 表）；断言只观察运行时行为（lease 判别联合、issue message/path、`readData`
  逻辑值、owned update 字节与收敛、诊断 record/carrier、session 状态面），零源码字符串断言。
- 真实入口发现：两 `.test.ts` 匹配根 include glob，根 `pnpm test` 双日志（sa3 L378/L584、
  sa6 L377/L646）实测收集 13+7；fixture 非测试入口定位正确。
- 防伪绿/防恒真：判别组（AC1-a..e + AC2-d）在旧实现 `7407ce0` 实测 6 红（红因逐字 = legacy
  全量边界判决 + 读计数 127>8），3 轮稳定；HEAD 20/20 五轮稳定；探针（tsx 独立通道）32/32
  双日志在案；写前污染可见性前置断言 + union 腿反证排除夹具假证据。
- 主路径与错误分支双触发；拒绝路径零写入零 update 双锚（`readData` 复读 + ownedUpdates 计数）。
- SA4 已登记的精确计数断言（AC4-a `records.length===1`）为有意形态冻结，非脆性缺陷（O-C）。

## 4. 与上游审查结论的关系

SA2（设计）与 SA4（实现）均 `approve`、0 BLOCKER/0 MAJOR。本审对两报告的关键声明做了独立复核
而非转述：冻结 md5 四件、源码锚点（lease 透传/域 message/union 仲裁/信封门）、证据日志数值与
行号、判据纪律 sweep、文件范围、census 缺口、先例入库形态——全部复核命中（§2）。SA2 O-1..O-4
与 SA4 O-A..O-D 的处置（报告内更正/登记敏感性/列动态验证项）符合设计 §7.6 采纳政策（三件套
md5 不变即为证）。未发现两报告遗漏的标准违例面。

## 5. 冲突复查需要性 —— 否

本票为 test-only 立法：零生产语义变化、零公共 API/协议/wire/schema/持久化/状态机变化、零 ADR
冻结面触碰、零决策修订。设计 §13「否」结论成立；本审未发现需要重新执行 ADR 冲突检查的新风险。

## 6. 结论

交付把「ADR 0033 已实现、lease seam 零回归锚」的能力缺口以 **test-only** 方式立法：3 个测试新
文件（13 契约 + 7 负控 + 共享装置）+ 独立探针 + 完整证据链，生产面零 diff。仓库标准逐项符合：
母法 ADR 0033 各决策边界未被触碰且其「钉回归测试」自我要求被正确执行；registry 模块纪律
（公共入口/testing seam/host 级装配归属）遵守；架构惯例（单一观察面、trusted raw 注入、共享
装置、`.js` 后缀、相对源诊断引用）一致；单一事实源（冻结常量 + 机制性 oracle）无漂移源；
生命周期对称（读计数包装复位、fake scheduler 零真实 timer、装置随进程收敛）；文件范围严格
落在 ALLOW 内、DENY 零触碰；测试质量（零削弱面、真实入口、判别敏感性有旧实现实测背书）
达标。**Verdict = approve**；5 项 MINOR 观察不阻断（§7）。

## 7. Non-blocking observations（MINOR，不阻断）

- **M-1（设计 §7.7 理由性表述失实，承接 SA2 O-1）**：已提交设计文件仍含「依赖层 registry 不依赖
  diagnostic-log 包名」——`packages/namespace-registry/package.json:27` 实含
  `"@nomicore/namespace-diagnostic-log": "workspace:*"`（本审复核）。夹具**实践**（相对源路径
  直引公共 index）与既有惯例多处实锚一致且双门绿，交付物安全不受影响；更正已按 SA2 指定位置
  落于 SA3 实现报告（设计文件未再冻结）。建议后续 normalize-evidence 提交顺手以注记形式澄清，
  或留待设计修订周期处理。
- **M-2（文档排序/措辞瑕疵，承接 SA2 O-2/O-3）**：设计 §7.2 矩阵 AC2 排序 a/b/c/d vs 冻结文件
  声明序 a/b/d/c（独立夹具、语义零差）；§8 L1「fixture 生命周期随 registry 关闭」与实况（随
  测试进程结束、受控 scheduler 零真实 timer）不符。均已记录于 SA3 报告，不动冻结件。
- **M-3（环境敏感性登记，承接 SA2 O-4 / SA4 O-B）**：探针经
  `packages/namespace-registry/node_modules/yjs/dist/yjs.mjs` 直取 yjs（依赖布局变化时先查布局
  再定性；本轮双日志 exit 0）；拒绝路径 `flushMicrotasks(24)` 与生产常量
  `FANOUT_DELIVERY_DEFERRAL_MICROTASKS=20`（`replication-session.ts:195`）隐式耦合——现行值
  闭环，未来票外抬高该常量时需复核零 update 断言窗口。
- **M-4（证据入库时机）**：10 份 SA6 证据日志（baseline-focused、baseline-stability-1..3、
  head-focused、head-stability-1..5）与任务简报 `wiki/raw/task_issue-437.md` 仍为 untracked；
  已提交的 SA6/SA4/设计工件按路径引用它们。与 #436 先例一致（简报与 stability 日志在后续
  `docs: normalize evidence` 提交入库），不构成违例；建议 finalization 阶段的 evidence
  normalization 提交将其一并入库，保证证据链自包含。
- **M-5（可选扩展面，承接 SA4 O-A）**：AC1 各例污染元素恒位于触达区间外；「删除污染元素本体」
  形态（按 ADR 0033 亦应 `ok:true`）未在 lease seam 单独立法——与 AC 措辞及冻结矩阵一致，
  属可选扩展而非验收缺口。

## 8. 后续动态验证项（静态无法闭环，交 Controller 路由；沿用 SA4 §11）

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 判别组红/绿归因复跑（SA3 未重建基线，依赖 SA6 在位证据） | `7407ce0` detached worktree 复跑聚焦套件 | 6 failed / 14 passed，红集 = AC1-a..e + AC2-d | 红集漂移或判别组变绿（恒真化信号） |
| 聚焦套件最终环境多轮稳定 | 连跑聚焦套件 ≥3 轮 | 每轮 20/20 | 任一轮红（时序敏感信号） |
| CI 首跑真实触发 | push 后 CI 主 job | 两文件被收集（13+7）且全量绿 | CI 红/未被收集 |
| 合并基线根门禁复证 | 最终 merge 基线复跑根 typecheck/test | 双 exit 0、两文件仍被收集（计数不钉绝对值） | 第 4 方回归干扰判读 |
