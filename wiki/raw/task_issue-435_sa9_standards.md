# SA9 Standards Review（仓库与工程标准轴）— Issue #435：vfsl 数组逐元素校验 seam + 一致性 fixture（ADR 0033 · vfsl 侧）

- 派发：`sa-43cb1972-2e60-47bd-8612-08541add1845`（role `mabf-sa9`，phase `standards-review`，iteration 0）
- **Verdict：`approve`**（无 BLOCKER、无 MAJOR；MINOR 5 项不阻断，见 §7）
- 审查对象：最终已提交 diff `f6b27da` → `ae1024f`（`feat(vfsl): validate array mutations elementwise`，
  branch `mabf/issue-435` HEAD；Parent PR #434 head = `f6b27da8eadc5cad3bf65c728094767ecb8c601b`，与
  Host 简报及 SA1/SA2/SA6/SA8 基线一致，`git log` 核对）
- Worktree：`/home/wangjian/nomicore-fix-issue-435`；跟踪面零改动（工作树 == HEAD）；未跟踪面 =
  `artifacts/sa3-issue435-*`/`sa6-issue435-*` 证据日志 + 任务简报 `wiki/raw/task_issue-435.md` +
  探针 `wiki/raw/task_issue-435_sa6_capability_probe.mts`（见 §7-M5）
- Issue-comments REST：空快照（Host 明示「no owner requirements apply」）——无 Owner 追加义务，与简报
  `## Comments` 空节、SA6 §2、SA8 两报告三方一致
- 审查方式：静态实读 + 只读命令独立复核（`git show`/`git status`/全仓 grep/逐字节比对/解释器源码抽验/
  入口配置实读/证据日志抽验/mtime 时序重建）。**未运行测试、未启动服务、未修改任何代码/设计/测试**——
  绿证据采信已留档 SA3 日志，本审查只对证据链真实性、入口真实性与冻结面逐字性做独立抽验。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-435.md`（Issue #435 正文 What to build + AC1–AC6；Comments 空） | 已读（未跟踪，见 §7-M5） |
| 母法 `docs/adr/0033-elementwise-yarray-mutation-validation.md`（accepted；决策 1–6 + 不做什么 + 后果） | 已读全文 |
| 关联 ADR：0007（#237 修订节 L76–77「批量一次整体判定，不逐元素」）、0010（#237 修订节后后备句） | 已读相关节（经 SA8 两报告定位 + 原文抽读） |
| 设计 `task_issue-435_design.md`（D1–D8、§8.1–8.5 冻结面、§11 ALLOW/DENY、§12 验收映射、§13 风险） | 已读全文 |
| SA2 设计攻击评审 `approve`（0 BLOCKER/0 MAJOR；O-1…O-6） | 已读 |
| SA3 实现报告（Changed paths、验证矩阵、MUT-B/E/F/D 变异实验、零偏差声明） | 已读 |
| SA4 实现静态审查 `approve`（0 BLOCKER/0 MAJOR；§11 后续动态验证 2 项；O-1…O-5） | 已读 |
| SA6 验收契约 `approve`（B-1…B-6、21 红契约/17 负控/test-d/132 例 fixture、§13 红绿证据与期望值） | 已读 |
| SA8 设计后冲突复查 `clear`（`requiresConflictRecheck:true`，§8 义务 1/2/4）+ 实现后冲突复查 `clear`（`=false`） | 已读 |
| 模块纪律：根 `AGENTS.md`、`packages/vfsl/AGENTS.md`、`docs/AGENTS.md` | 已读（注入 + 实读核对） |
| 最终 diff 全部 13 文件（2 源文件 + 4 测试文件 + 7 wiki 报告） | 已读/独立复核 |
| 证据日志 `artifacts/sa3-issue435-{final-focused,root-test,root-typecheck,package-tsc,probe-post,guard-probe,mutation-*}.log` | 只读抽验 |

缺席输入（iteration 0，不构成判断缺口）：`_relevant_decisions.md`——SA8 已以
`task_issue-435_design_conflict_report.md` 补位裁决（`clear`，追认绑定 B-1…B-6 无需换名/换形），
约束语义全部可从已合入 ADR 0033 + SA6 冻结绑定恢复；SA7 动态验证报告尚未产生（单趟流，见 §8-O1）。

## 2. 独立复核（非转述 SA 声明）

| 复核项 | 命令/方法 | 实测结果 |
|---|---|---|
| diff 范围 | `git show --stat HEAD` | 恰 13 文件：`packages/vfsl/src/{validate-patch.ts, index.ts}` + 4 个 `issue-435-elementwise-array-*` 测试件 + 7 个 wiki 报告——生产面与设计 §11 ALLOW 两项一一对应，无越界；`docs/`、`CONTEXT.md`、其余包零改动 |
| DENY 面零触碰 | `git show HEAD --name-only` 全清单核对 | `validate.ts`、规划层、doc-runtime、namespace-runtime、diagnostic、apps、domains、docs、CONTEXT、既有测试全部不在 diff 中；SA6 四件以新文件入库（本票首提交，非修改） |
| legacy 符号逐字节不动 | `git show HEAD -- packages/vfsl/src/validate-patch.ts` 逐行读 | 仅有的 3 个删除行 = 文件头注释行（原 1 行扩为 4 行）+ import type 行（追加 `ValidateIssue`）；`planMutationBoundary`/`applyMutationAtBoundary`/`validateBoundary`/`wrapApply`/数组三操作/`validatePatch`/`BoundaryMutationPayload` 无任何删改行；新增 = 文件尾 +114 行纯追加 |
| 域 message 逐字节一致 | 实读 legacy L994/L1004 vs 新接缝 L1113/L1132 | `array-insert index 越界（不 clamp）`、`array-delete 范围越界（不 clamp、不接受越界 no-op）` 两条逐字符相同；判定式 `index > length`、`index >= length \|\| index + count > length` 与 legacy L993/L1003 同式 |
| 新词表逐字落地 | 设计 §8.3 冻结表 7 条 vs 实现 L1089/L1096/L1103/L1109/L1128 | G-A/G-B/F-1/P-1/P-2 逐字符一致（G-B 经局部量 `node.kind` 插值同一值；G-A/G-B path = `[...plan.prefix, ...plan.relPath]` 与冻结表一致）；E100 文案与 sibling `wrapApply` L1030 同款 |
| rebase 数学同构 | 实读 `validate.ts` 数组分发（L604–615：`validateValue(element, value[i], [...path, i])`）+ `validateBoundary` L1020（`[...plan.prefix, ...issue.path]`）+ `validateValue` 顶层 `resolveValues`（L557） | legacy 元素 issue = `[...prefix, index+j, ...rel]`；新接缝 = `[...arrayPath, index+j, ...rel]` 且闸门保证 relPath=[] ⇒ arrayPath=prefix——两式恒等；element 为 ref 节点时 `validateValue` 入口即解析，与解释器数组支 `resolveValues(t.element)` 等价，无「ref element 静默全过」失守面；`validateSubtree` 三参签名（L768）与调用形一致 |
| 公共面纯加法 | 实读 `index.ts` diff + `packages/vfsl/package.json` exports | 导出块追加 1 运行时（`applyElementwiseArrayMutation`）+ 2 类型（`ArrayCarrierFacts`、`ElementwiseArrayMutationPayload`）；既有 22 名/顺序不变；exports 仍仅 `.`——公共面唯一入口纪律保持 |
| 载荷词表一致 | 实读 `ElementwiseArrayMutationPayload`（L1050–1052）vs `BoundaryMutationPayload` 同名支 | `array-insert`/`array-delete` 两支字段名/类型逐字一致；词表恰两支（set/delete 走 legacy） |
| 测试削弱扫描 | grep `\.skip\|\.only\|todo\|process\.env` 于 4 个新测试件 | 仅注释文本命中（纪律声明句），零实际用法 |
| 测试入口真实 | 实读 `vitest.config.ts` L15/L18–22、根 `package.json` scripts | 两 `.test.ts` 匹配 `packages/*/test/**/*.test.ts`；`.test-d.ts` 匹配 typecheck include `packages/*/test/**/*.test-d.ts`；根 `test = vitest run --typecheck`——runner/CI 发现面真实 |
| 证据日志抽验 | 只读 tail 关键日志 | final-focused：2 files/38 passed（21 契约+17 负控）、Type Errors no errors；root-test：**462 files/5622 tests 全绿、Type Errors no errors、harness exit 0**；root-typecheck：15 tsconfig 全过 EXIT:0；probe-post：`exports(23)`、failures=2 恰 = G1.1/G1.2（断言导出缺席的预期翻转 = 缺口闭合，其余 51 项 PASS）——与设计 §5 矛盾记录/SA8 §8 行 4 的既定解读一致 |
| 时序重建（SA4 O-1 核证） | `stat` 各日志与源文件 mtime | 变异实验 12:38:59–12:39:14（`trap restore EXIT` 机制）→ final-focused 12:39:15.172 完成 → `validate-patch.ts` 最终写 12:39:15.275（103ms 后，与 cp 还原同内容刷新 mtime 的形态一致）→ guard-probe 12:39:52（21/21，最终字节）→ root-typecheck 12:40:52（EXIT:0，最终字节）→ commit 12:50:26。最终字节 = 入库字节；全量 vitest 窗口（12:31:37–12:38:47）确在最终写之前——缺口如实登记见 §7-M1 |
| commit 卫生 | `git log -1 --format` + `.gitignore` 核对 + `git status --porcelain` | message `feat(vfsl): …` 合仓库惯例；入库面无 artifacts 日志/node_modules/调度文件（TASK.md/.mabf* 均在 ignore）；简报与探针未入库（§7-M5） |

## 3. 标准符合性逐项

### 3.1 ADR 0033（母法）—— ✅ 逐项符合

| 条款 | 符合性 | 证据 |
|---|---|---|
| 决策 1：闸门 = `plan.kind='array'` ∧ 边界值节点 kind=`array`；union 数组目标永久 legacy；规划层完全不动 | ✅ | L1087/L1094 双条件 fail closed（union 目标 node.kind='union' 由第二条件排除，契约 F2 绿）；第三条件 relPath=[] 为 fail-closed 方向防御收紧——真实 array-* 计划恒满足（L796–799 结构前提、负控 NC3.1 锚），SA8 设计报告行 2 已裁 no-conflict（§7-M3 登记）；`planMutationBoundary` 零 diff |
| 决策 2：insert 逐新值过 element 子 schema + issue 路径 `[...arrayPath, index+j]` 与现状逐字节一致；delete 仅越界检查 O(1)；域规则逐字；零写入 | ✅ | L1116–1123 逐值 `validateSubtree(derived.values, node.element, values[j])` + rebase（同构性 §2 已独立验证）；delete 支 L1127–1134 域检查后直接 `{ok:true}`，`ArrayCarrierFacts` 结构性排除元素值；两条域 message/判定式逐字节同 legacy（§2）；纯函数无任何写面 |
| 决策 3：fast-path 产物不需要 `proposedBoundary` | ✅ | 返回 `ValidateResult` 直出（L1084）；test-d 第 3 条 `@ts-expect-error` 负面夹具钉死非包装形 |
| 决策 4：触达面 = 载体 + 变更区间；污染数组 delete 照常成功 | ✅ | delete 支域规则之外零判定；契约 D4/D5/E2 固化并绿。注意该 observable 变化本票只落在新接缝上（doc-runtime 接线归后续票）——分票执行经 SA8 两报告行 10/行 9 裁决，合 Issue What to build 范围 |
| 决策 5：立法「数组合法 ⟺ 逐元素合法」+ 一致性 fixture 执法；禁止校验器特判 | ✅ | 132 例 fixture（mulberry32(435) 冻种子）E1 逐字节比较转绿；`validate.ts` 零 diff；NC4 立法前提锚保持绿——未来引入数组级约束即双红 |
| 决策 6：性能软验收（不钉毫秒） | ✅ | 无阈值断言；实现结构性 O(k)（只读 `facts.length` + k 个新值，不随 length 增长）；规模证据留探针 G3 诊断面 |
| 范围句：复制协议、诊断捕获、namespace-runtime 写槽零改动 | ✅ | diff 不含上述任何路径（§2 行 1/2） |
| 「不做什么」：plain 数组不动、union 穿越不动、数组级约束语法不实现、异步审计不建、前像捕获不做 | ✅ | 无非目标面改动；YPlainArray 拒绝锚 NC3.3 保持绿 |

### 3.2 ADR 0007（#237 修订节）/ ADR 0010（#237 后备句）—— ✅ 无违规

0007 L76–77「批量 values[]/count 一次整体判定，不逐元素」是 phase-1 管线描述，已被更晚接受的
ADR 0033 就非 union `T[]` 显式改写，`CONTEXT.md` L144「数组位例外（ADR-0033）」句完成词汇层调和——
新 ADR 优先，无沉默矛盾；0010 后备句的数组含义经 0033 决策 4 明文修订。本票不改两 ADR 文本
（DENY），SA8 已裁 no-conflict 并登记「接线票顺带补 0033 回指」（docs 纪律，非阻塞）。✅

### 3.3 模块 AGENTS 与根 AGENTS —— ✅ 无违规

| 纪律（`packages/vfsl/AGENTS.md` Boundaries） | 符合性 |
|---|---|
| 同步/确定性/纯函数；公共畸形输入路径走判别联合而非抛错 | ✅ 一切失败 `ok:false + issues`（域规则/元素校验/守卫 F-1·P-1·P-2/闸门 G-A·G-B）；`wrapElementwise` 收编实现缺陷为 E100 单 issue，无抛出路径、无静默 `ok:true` |
| IR/派生物环境中性、JSON 可序列化 | ✅ 无新 IR；输入输出均为纯 JSON 值 |
| 保持载体结构与值语义分离；不引入 Yjs 运行时关切 | ✅ `ArrayCarrierFacts = { readonly length: number }` 为纯投影，无 Y 类型引用；live 读取明确划给调用方（doc-runtime 接线票） |
| 公共 API 只经 `src/index.ts` | ✅ 唯一入口追加；exports 仍仅 `.`；无新子路径 |
| 稳定 error code/issue 顺序/path 报告是兼容行为 | ✅ legacy 面逐字节不动；元素 issue 序 = 插入后位置升序（j 升序单循环收集）；新词表发布即冻结（§8.3 为唯一来源，实现逐字落地——§2 行 4/5 核证） |
| 验证门禁：包 typecheck + 聚焦测试；公共类型变化跑根 typecheck/test | ✅ 证据链齐备（§2 行 9；最终字节覆盖缺口见 §7-M1） |

根 `AGENTS.md` 适用面核对：本票无 `domains/*/schema.vfsl` 改动、无 Namespace 数据写入（typed-access
强制面不触发）、无 Cordis 插件装配、无 Hub/Peer 复制/分块传输/连接-命名空间拆分、无诊断变更日志
改动、无 `docs/` 改动——上述专项纪律均不触发；「改 packages/ 前读最近 AGENTS.md」义务已由
SA1/SA3/SA4 履行并经本审查复核。✅

### 3.4 docs/AGENTS（文档权威划分）—— ✅ 无违规

`CONTEXT.md`/ADR/v1-spec 零 diff。「code behavior changes ⇒ update normative docs」条款：本票新增的
正是 ADR 0033 与 CONTEXT 词汇已描述的目标态能力本身，无任何已陈述的规范性合同被改变；doc-runtime
现实的措辞-现实差由设计 R5 如实登记并路由接线票（母法先行是常规姿势），不构成本变更集的文档修订义务。

### 3.5 架构一致性（责任归属 / 相似能力 / 单一事实源 / 生命周期对称 / 平行机制）

| 维度 | 结论 |
|---|---|
| 责任归属 | 数组写判定语义归 `@nomicore/vfsl`（校验语义唯一 Owner）——就地扩展 `validate-patch.ts` 边界接缝家族正确；载体长度投影归调用方（vfsl 无 Yjs 关切保持）；触达面/双轨策略执行 ADR 0033 已裁决面，不自创策略 ✅ |
| 相似能力对照 | 与 `applyMutationAtBoundary` 同文件同族（同参数前缀 derived/plan、判别联合载荷、E100 同款边界）；唯一有意分歧 = 返回直出（决策 3，test-d 钉死）；与 #53 路径级数组三操作属不同尺度层，无重复 ✅ |
| 单一事实源 | 解释器语义单一来源 `validate.ts`（零改动，只消费 `validateSubtree`）；element 子 schema 取自 `plan.node.element` 无副本；数组合法判据唯一（决策 5 立法 + fixture）✅。例外：两条域 message 字面量在 legacy/新接缝各存一份——双轨 ADR 的固有代价，两侧被 NC1 与 C1/C2/D2/D3+E1 逐字节钉死，漂移即双红（§7-M2 登记） |
| 生命周期对称 | 无状态纯函数：零模块级可变态、零缓存、零注册/订阅、零后台任务——对称性平凡成立；E100 收编不持资源 ✅ |
| 平行机制 | 第二数组判定路径 = ADR 决策 1 裁决的**永久双轨**（非漂移性重复），两轨行为差异全部显式文档化（设计 §8.4）并由对照测试锚定；`wrapElementwise` 为 E100 同族惯例第三次实例化；新导出未接线任何生产调用方（grep 全仓：新名仅现于 src/SA6 四件/探针）——非目标边界保持正确 ✅ |

### 3.6 兼容性纪律 —— ✅

既有 22 运行时导出逐字节不变（探针 post `exports(23)` = 原名单 + 新 1，无一缺失/改名）；既有消费方
（namespace-runtime / diagnostic-log / 各测试）随根 462 files/5622 tests 全绿回归；域 message、
issue 路径/顺序、E100 文案全部锚定；新词表 7 条自本次交付起为兼容面（后续措辞变更视同破坏性变更，
SA8 实现后报告 §8 行 4 已登记）。

### 3.7 证据工件 —— ✅（两处缺角如实登记）

红→绿证据链完整且可复现：pre-fix 21 红（能力缺口 loud throw）→ post-fix 聚焦 38/38、包 tsc exit 0、
根 typecheck EXIT:0、根 test 462/5622 全绿、test-d Type Errors no errors；判据敏感性 MUT-B/MUT-E
各 6 红、MUT-F 2 红（MUT-D 诚实登记为 covered 域语义等价变异，实现仍逐字镜像 legacy 两子句式）；
探针 post 态恰为既定解读（仅 G1.1/G1.2 FAIL）。缺角：① 全量 vitest 未在最终字节上复跑（§7-M1）；
② SA7 动态验证报告尚未产生（单趟流，§8-O1）。两处均已由上游角色如实登记，非隐匿。

### 3.8 可维护性 —— ✅

实现与设计 §8.2 伪代码逐行同构；注释契约（闸门三条件、域规则逐字来源、O(k) 论证、调用方职责、
决策 3 直出理由）随码就位；`isSafeNonNegInt`/`singleIssue`/`wrapElementwise` 私有助手单一职责；
头注释两文件各补 issue #435 说明（略超设计「一句」字面——同一 ALLOW 条目内的注释面，SA4 O-4 已登记，
无行为效应）；建议 commit message 与入库 message 语义一致。

## 4. 测试质量专项

| 检查点 | 结论 |
|---|---|
| 真实 runner 入口 | 两 `.test.ts` 落 vitest include、`.test-d.ts` 落 typecheck include（§2 行 8）；根 `pnpm test` 实际执行（462 files 含两新文件；21+17 计数与 SA6 §13 期望算术吻合：5601=5584+17、5622=5601+21）✅ |
| 零削弱 | 无 skip/only/todo/env override/fallback/吞错/软化断言（grep 核证）；SA6 四件 mtime（11:49–11:51）早于实现（12:30+），红→绿由实现单独达成 ✅ |
| 红灯归因正确 | 契约顶层不静态 import 新名目，动态绑定 `seam()` loud throw——红因恒为能力缺口而非裸 TypeError/环境伪红；负控 17/17 HEAD 恒绿排除四类伪红 ✅ |
| 期望二源 | legacy oracle 逐字节比较（E1）或 ADR/现行实现冻结常量（域 message、rebase 路径）；不 grep 生产源码 ✅ |
| 防恒真/防空转 | E1 `checked === length` 计数断言；E2 污染组判据逐字节可分（6/6）；NC5 oracle 自洽 + 用例面 census（两支/两操作/全路径/规模）；MUT-B/E/F 变异实验证明判据敏感 ✅ |
| 类型契约 fail closed | 3 条 `@ts-expect-error` 负面夹具（缺 length/set 支/result 包装）——签名放宽为超集即红 ✅ |
| 确定性 | mulberry32(435) 冻种子、零真实时钟/网络/并发；132 例 = 72 参数化 + 60 随机，接受 54/拒绝 78 两支齐备 ✅ |
| 残余（非阻断） | 死导出 `unionArrayPlan`/`VerdictIssue`（DENY 冻结件，§7-M4）；delete 首子句在 count≥1 契约域不可测分（MUT-D 等价变异，SA4 O-2 已登记未来 count=0 进契约时补用例） |

## 5. 需求覆盖声明（标准轴视角）

Issue 需求是否完整实现属 SA10 职责，本审查不越界。标准轴确认：AC1–AC6 在设计与验收映射中均有
落点且各有测试锚（A1/A2、B1–B7、C1/C2、D1–D5、E1/E2、F1–F3、test-d、NC1–NC6）；无 owner 追加面
（REST 空快照三方同证）；非目标边界（doc-runtime 接线、union 数组、plain 数组、性能门禁、病态域
逐字节）与简报/ADR「不做什么」逐条对齐，未见静默扩面或缩面。

## 6. 不需要冲突复查声明

SA8 实现后冲突复查已裁 **`clear`（`requiresConflictRecheck: false`）**——设计报告 arm 的四项触发面
（公共 API 22→23 纯加法、五条新 message 逐字、observable 语义、绑定追认）逐项闭合。本 SA9 审查
独立复核 diff/冻结面/证据链后**未发现新的冲突触发项**：wire/持久化/状态机/生命周期零触碰，无正式
override，规划层与 legacy 轨逐字节不动，未创设设计裁决范围外的新决策面。`requiresConflictRecheck: false`。

## 7. Findings（MINOR，均不阻断）

| ID | 等级 |  finding | 处置建议 |
|---|---|---|---|
| M1 | MINOR | 根 `pnpm test`（462/5622 绿）证据窗口 12:31:37–12:38:47 早于 `validate-patch.ts` 最终写入 12:39:15.275（时序重建见 §2 行 10：形态与末次变异实验 `trap` 还原一致）；最终入库字节的行为证据 = 聚焦 38/38 + guard-probe 21/21 + 包/根 typecheck，全量 vitest 未在最终字节上复跑 | 已如实登记（SA4 §11 行 1/O-1）：由验证角色（SA7）补一次聚焦对 + 根 test 收尾复跑即闭环；不改代码 |
| M2 | MINOR | 两条域 message 字面量在 legacy 支（L994/L1004）与新接缝（L1113/L1132）各存一份——双轨 ADR 的固有副本 | 两侧已被 NC1 与 C1/C2/D2/D3+E1 逐字节钉死，漂移即双红；未来域措辞变更须同改两轨并过两组锚（SA2 O-3 同款登记；后续票可评估共享常量，本票按 DENY 不抽是正确的） |
| M3 | MINOR | 闸门第三条件 `relPath=[]` 超出 SA6 B-6 字面两条件 | SA8 两报告已裁 no-conflict（fail-closed 收紧、真实 array-* 计划恒满足、NC3.1 锚定）；建议接线票顺带把该条件并入 B-6 文字消除字面差（SA2 O-6） |
| M4 | MINOR | fixture 死导出 `unionArrayPlan`、`VerdictIssue`（无消费者） | DENY 冻结的 SA6 交付件，本票不清理是正确的；后续触碰该文件的票顺带收口（SA4 O-3） |
| M5 | MINOR | 任务简报 `wiki/raw/task_issue-435.md` 与探针 `.mts` 未入库（untracked），与 #412 先例（简报随 commit 入库）不一致 | 探针作为 DENY 时点证据不入库可辩；简报是否入库属 finalize 步卫生面，提请 Controller/finalize 按仓库惯例处置；不影响代码/测试/文档标准面 |

## 8. Non-blocking observations

| ID | observation |
|---|---|
| O1 | SA7 动态验证报告尚未产生（单趟流）——SA4 §11 两项后续动态验证（最终字节收尾复跑、CI 首跑 Node 20/24 × 6 分片 + typecheck 作业）均待验证角色闭合；本 approve 不替代该活链路验证 |
| O2 | 病态域（单元素 >100 issue/预算边界）与 legacy 的逐字节分歧为设计 D6/R2 显式接受、ADR 决策 6 后果同族；fixture 与真实载荷远离该界；未来如需对齐须另立契约，不得在接缝内静默聚合上限（SA8 §8 行 5 既定） |
| O3 | 域外载荷守卫（F-1/P-1/P-2）与 legacy 重建产物语义不同（设计 D5 论证：负 index 的 slice 截断/放置依赖整数组、不可复现）——接线票必须维持 doc-runtime E3 前置（严格非负整数 index、严格正整数 count），守卫 message 已自述修复方式 |
| O4 | 污染基线 insert 的 issue 列表分歧（legacy 报旧+新、接缝只报新元素）属决策 4 族、不进契约、当前无测试锚定——建议接线票引入 wired 行为测试时顺带锚定（SA4 O-5） |
| O5 | 两文件头注释各落 3–4 行（设计 ALLOW「补一句」字面略超）——注释面、同一 ALLOW 条目内，无行为效应（SA4 O-4 同款登记） |

## 9. 结论

**approve**。最终已提交 diff（`f6b27da` → `ae1024f`）把 ADR 0033 决策 1–6 的 vfsl 侧义务逐条落地为
两文件纯加法：闸门双条件（+relPath 结构前提）fail closed、域规则与 legacy 逐字节同式同文案、
insert 逐新值过 element 子 schema 且 rebase 与全量路径数学同构（132 例 fixture 逐字节一致）、
delete 仅域规则不触碰元素值、解释器/规划层/legacy 轨/既有 22 导出逐字节不动、公共面只经
`src/index.ts` 纯加法 22→23。模块纪律（同步/纯函数/不抛错/兼容行为/无 Yjs 关切）、单一事实源、
生命周期对称、文件范围 ALLOW/DENY、测试质量（真实入口/零削弱/红→绿/判据敏感/确定性）全部符合
仓库与工程标准；5 项 MINOR 与 5 项观察均不阻断，后续动态验证项已如实路由。SA9 不评判 Issue 需求
完整实现度（SA10 轴），不替代 SA7 活链路复跑。
