# SA4 实现静态审查 — issue #390：溢出降级与父路径删除（变更订阅 T4）

- 审查对象：**implementation**（当前 worktree 未提交改动：5 个 tracked 源文件 diff = 177 insertions / 19 deletions + 3 个新增契约测试文件；分支 `mabf/issue-390`，基线 HEAD `28faeae`）
- 审查轮：iteration 0（dispatch `sa-d1d96a68-3145-4318-989b-8dac0b1061fc`，role `mabf-sa4`，phase implementation-review）
- 审查方法：静态实读全部 diff、三件套测试全文、上下游产物与冻结面源码；**未运行任何测试**（绿/红证据取 SA3 落盘原始日志逐条核对）；未修改实现、设计或测试
- 结论速览：**verdict = approve**。零 BLOCKER、零 MAJOR、零 Required revision；5 条非阻断观察（§12）+ 3 项后续动态验证（§11）

## 1. Reviewed inputs

| 输入 | 状态 | 核对结果 |
|---|---|---|
| `wiki/raw/task_issue-390.md`（简报，6 条 AC） | 已读 | AC1–AC6 逐条映射（§3） |
| `wiki/raw/task_issue-390_design.md`（SA1 设计，449 行） | 已读 | D1–D8 / §8-A / §11 ALLOW·DENY / §12 逐项落实（§4） |
| `wiki/raw/task_issue-390_sa6_contract.md`（SA6 契约，approve） | 已读 | B-1–B-7、A1–A9/NC1–NC6、§12.5 断言纪律逐条核对（§4/§9） |
| `wiki/raw/task_issue-390_sa2_review.md`（SA2 评审，approve，零 BLOCKER/MAJOR） | 已读 | §13 无 Required revision；M1–M4 落实核对（§3） |
| `wiki/raw/task_issue-390_sa3_impl.md`（SA3 实现报告） | 已读 | 声明与现场逐条互证（§9） |
| `wiki/raw/task_issue-390_conflict_report.md`（SA8 前置门禁，clear / recheck=true） | 已读 | §8-1..8-4 义务落实（§3） |
| `wiki/raw/task_issue-390_implementation_conflict_report.md`（SA8 实现后复查，clear / recheck=false） | 已读 | §8-4 ①–⑦ 独立复核闭合（§3）；行号锚与现场代码一致 |
| `wiki/raw/task_issue-390_relevant_decisions.md`（SA8 决策摘录） | 已读 | ADR 0030 决策 3/4/6 条款对照 |
| 实现源码现场核对：`watch-map.ts`（552 行全文）、`runtime.ts`（seam/capture/构造栈/`RuntimeForRegistryDiagnostic` 段）、`registry.ts`（`resolveIdleTimeoutMs`/`resolveWatchQueueCapacity`/`createRegistryInternal` 门序/`runtimeOptionsFor` 全函数/三处 factory 调用点）、`testing.ts`、`types.ts`、`internal.ts`、两包 `index.ts`、`plugin.ts`、`vitest.config.ts`、`tsconfig.typecheck.json` | 已读 | 见 §4–§8 各表 |
| 测试三件套全文：`issue-390-watch-invalidation-{fixture,red.test,surface.test-d}.ts` | 已读 | §9 测试质量审查 |
| `artifacts/sa3-issue390-*-recheck.log`（8 份）+ `sa6-issue390-*.log`（8 份） | 在场 | 红绿证据逐条核对（§9）；红灯失败集合 = A1/A2、A7、A3、A3b、A4、A5、A6、A9 恰 8 例（日志实读） |
| Owner 评论：REST `issues/390/comments` = []（0 条） | 无适用评论 | 与简报/SA6/SA1/SA2/SA3/SA8 六方记录一致 |

## 2. Verdict

**approve**。

- 设计 D1–D8 全部忠实落实：注入链 7 跳逐跳实读贯通（全部加法可选字段、arity/签名零变化）；`detectStructuralInvalidation` 与设计 §7-D3 伪代码逐分支等价（严格祖先/链上键/`add` 旁路/真变复用/序列段保守失效五要点齐全）；`enqueueInvalidateAll` 与 D4 伪代码逐行等价且溢出分支为逐字节等价重构。
- SA6 契约 B-1–B-7 全落实；A1–A9 + NC1–NC6 全部在 14 个行为用例 + 类型契约中在场，红灯集合恰为两条独立缺口（通知面 + 注入面），未伪称红灯（AC4 基线绿段落诚实标注）。
- SA8 §8-4 清单①–⑦ 独立复核全部闭合；9 项冻结面（三 kind 形状 / 数值不进公共契约 / lease 16 键 / `WATCH_MAP_*` / 复制面 / sequencer 槽序 / internal arity / 谓词与 watch-end 词表 / 文档缝）零触碰。
- 文件范围严格落 ALLOW：`git status --porcelain` 实读 = 5 个 ALLOW 源文件 + 3 个 SA6 §12.4 冻结路径测试 + 证据/报告产物；DENY 面零命中；无残留临时文件（`.sa6-390`、`impl.patch` 均不在场）。

## 3. 上游要求落实

### Issue AC 与 Owner 要求

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 有界：构造参数 + 实现默认，数值不进公共契约 | `createWatchHub(doc, state, queueCapacity = WATCH_QUEUE_CAPACITY_DEFAULT)` 签名零变化（`watch-map.ts` L405–409）；默认常量单点 L99（全仓唯一，`replication-session.ts` L188 的 16 为另一既有常量、不同纪律面）；注入链只经 testing surface；生产入口 `createNamespaceRegistry` 不含新字段（结构性不可达） | 落实。grep 实证 `watchQueueCapacity` 仅现于 4 个内部文件 + 3 个测试文件；index/lease/plugin 零改动 |
| AC2 溢出 → 恰一条 `{kind:'invalidate-all', origin}` + 存活 + 自愈 | `enqueueData` 溢出分支 → `enqueueInvalidateAll`（清队 + 恰两键 freeze + 泵调度，`watch-map.ts` L452–477）；A1/A2 用例断言恰一条两键 `toStrictEqual`、零 data 越过、后续 x3 `data` 自愈 | 落实（红→绿证据一致：红侧 A1/A2 超时，绿侧 14/14） |
| AC3 父级删除 → invalidate-all、订阅存活 | `detectStructuralInvalidation`（L278–296）+ handler 前置短路（L425–430）；A3/A3b/A4/A5 四变体齐绿；NC2 条目级删除仍 `data` | 落实。含整替（update 真变复用 `isRealChange`——live 载体保守失效方向正确）与同事务原子（短路条目聚合） |
| AC4 订阅横跨缺席期（删→重建→条目 `data`，零重新订阅） | 簿记零摘除（`watchMap`/`unsubscribe`/`shutdown` 路径零改动）；`add` 旁路使创建事务与 T1 逐字节一致；A6 断言 `{path:['optionalTasks'],key:'r1'}` 形 `data` 到达 | 落实。A6 红侧红因 = 删除信号缺口（本任务目标），「重建后 data」段落为基线绿——SA3 报告诚实区分 |
| AC5 溢出可测：经既有 testing 工厂 overrides 注入（零新接缝） | `NamespaceRegistryTestingOverrides.watchQueueCapacity?`（`testing.ts` L66–71）为唯一注入面；三件套仅 import `@nomicore/namespace-registry` + `/testing`（实读 import 块）；fixture 显式**不提供** `runtimeFactory` 覆盖（缺省生产 factory 通路，对照 #387 fixture 的 seam 直连形态） | 落实。无第二 seam / 公共 API / 新子路径 |
| AC6 溢出不阻塞写；降级分发在写序列器槽之外 | 降级三步（清队 + push + `schedulePump`）全为观察器内同步有界操作；泵复用既有单飞微任务（L357–380 零改动）；A7 断言 `syncCallbacks===0`、写全 `ok:true`、后续写完成 | 落实。diff 无 sequencer/write 族文件 |
| Owner 评论 | REST = []（0 条，本 dispatch 现场一致） | 无适用要求；无 override 载体 |

### SA6 契约 / SA8 义务 / SA2 观察

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| SA6 B-1 注入位（承重） | 链路 7 跳：testing.ts L66–71 → registry.ts L461–466 → `resolveWatchQueueCapacity` L205–218 → `runtimeOptionsFor` L878–881/L900（两条返回路径）→ `RuntimeForRegistryDiagnostic` L910–912 → 条件展开 L937–939 → seam input L128–130 + `captureSeamInput` L1161–1179/L1191 → `createWatchHub` 第三参 `runtime.ts` L581；三处 factory 调用点（L1352/L1605/L1749）共享 `runtimeOptionsFor` | 逐跳实读贯通；全部加法可选字段；undefined 触发缺省参数（生产行为逐字节不变——条件展开缺席即对象形状与既有逐字节一致） |
| SA6 B-2 触发确定性 | A1/A2/A7：capacity=1 + 同步段两次 un-awaited 写 + `syncCallbacks===0` 断言；`WATCH_QUEUE_CAPACITY_INJECTED = 1` | 落实；绿侧复跑 ×3（`green-repeat-recheck.log` `REPEAT_3_EXIT=0`） |
| SA6 B-3 形状恰两键 | `Object.freeze({ kind:'invalidate-all', origin })` 单点构造（L458）；A9 `toStrictEqual` + 类型面 8 断言 | 落实 |
| SA6 B-4 父删/整替/add 不钉 | `detectStructuralInvalidation` 分支矩阵与契约逐条对应；A6/A3b 不断言重建事务 kind | 落实 |
| SA6 B-5 订阅存活 | 簿记写入点零改动；A2/A3/A3b/A4/A5/A6 均含存活断言 + `not.toContain('watch-end')` | 落实 |
| SA6 B-6 默认数值不断言 | NC1 只断「不注入 → 零失效信号 + 三条 data」 | 落实 |
| SA6 B-7 事务级原子 + FIFO | 结构性失效短路条目聚合（L427–430）；清队只清未投递（B-7 授权）；泵 shift FIFO 不变 | 落实 |
| SA8 §8-1 注入只经 testing overrides + internal 装配缝 | 同 B-1；`internal.ts` 零改动（type re-export L77 使 `RuntimeForRegistryDiagnostic` 新字段随行，arity type-guard 不触——断言 `Parameters extends [DocHandle, () => Promise<void>, unknown?]` 由重载两参居末保持） | 落实 |
| SA8 §8-2 形状/FIFO/不要求重建/宁多勿漏不削弱真变过滤 | 真变复用 `isRealChange`（零第二套判定）；条目级 `>= depth` 事件照旧走 C-1/C-2（`collectChanges` L307–322 零语义漂移，仅注释更新）；NC2/NC3 绿 | 落实 |
| SA8 §8-3 槽外红线 | 同 AC6；handler 整体 try/catch 零 throw 红线不变（L435–437） | 落实 |
| SA8 §8-4 ①–⑦ 实现后复查 | ① grep 4 内部文件 + A8 + surface 负锚；② 常量单点 + NC1；③ A9/NC6；④ 簿记零改动 + 六用例存活断言；⑤ diff 无 sequencer 族；⑥ diff 无复制族；⑦ `watchMap(path, listener)` 两参签名无 `where`、`watch-end` 仅在类型联合与注释、`errors.ts` 零改动 | **SA4 独立复核七项全部闭合**（与 SA8 实现复查报告一致，无分歧） |
| SA2 §13（零 Required revision）/ §14 M1–M4 | M1 设计文本项（SA3 记录无代码动作）；M2 零 runtime 测试改动（`packages/namespace-runtime/test/**` 无新文件）；M3 `add` 旁路 + A6/A3b 不钉 kind；M4 seam 门统一 TypeError（`runtime.ts` L1174）+ registry 二分（L212/L215） | 全部按 SA2 建议处置；无遗漏 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1 字段名/形态 `watchQueueCapacity?: number`（正整数） | `testing.ts` L66–71；语义注释齐备 | 一致（fixture 绑定单点命名与设计速写不同，见 §12-O2，功能等价） | 无 |
| D2 容量注入通路（7 跳全加法） | 见 §3 B-1 行 | 逐跳一致；备选 A/B 均未采用（`internal.ts` 零改动、testing.ts 无 internal 值导入——实读 import 块仅 `@nomicore/*` 公共/testing 面） | 无 |
| D3 `detectStructuralInvalidation` | `watch-map.ts` L278–296 | 与设计伪代码逐分支等价：depth 0 早退 / `>= depth` continue / `isPathPrefix(eventPath, containerPath)`（实参交换方向与 `collectChanges` L307 相反、互不干扰）/ `nextSeg` 非 string 保守失效 / `info === undefined` continue / `add` 旁路 / `isRealChange` 复用。handler 内先于 `collectChanges` 短路（L425–430） | 无 |
| D4 降级入队单点 | `watch-map.ts` L452–460；`enqueueData` 溢出分支 L468–472 改调单点 | 与设计逐行等价；旧内联溢出分支（清队+push+schedulePump）语义逐字节保留（原 else-branch 的 `schedulePump` 调用位置等价迁移） | 无 |
| D5 容量合法性门 | registry 单点 `resolveWatchQueueCapacity`（L205–218，`resolveIdleTimeoutMs` 同款二分：undefined→undefined / 非 number→TypeError / 域违例→RangeError，`Number.isInteger` 覆盖 Infinity/NaN）；调用位 L826（idleTimeoutMs 之后、randomBytes 门之前——门序实读零漂移）；seam 形状门 `captureSeamInput` L1161–1179（统一 TypeError，INV-N4 前置于 enqueue）；message 常量 `types.ts` L89–95（零插值零值回显） | 一致（含 SA1 裁决④的加门；契约断言面外——动态锚定延项见 §11） | 无 |
| D6 新三件套（不扩展 #387 fixture） | 三新文件；fixture 自包含（实读无 `issue-387-*` import）；schema 按 SA6 §12.3（tasks 必填/optionalTasks? 已物化 e1 e2/optionalGroups? 两级/meta 封闭）；`openWatchLease({watchQueueCapacity})` 缺省 factory 通路 | 一致 | 无 |
| D7 订阅存活（簿记零摘除） | diff 中 `watchMap` 建立/`unsubscribe`/`shutdown` 路径零改动（L480–550 原样） | 一致 | 无 |
| D8 注释与文档面 | 头注 L26–33（降级单点 + 两触发源）、边界注 L37–38（移除 T4 项）、C-3 注释 L323–326、容量注释 L97–98/L401–403 同步更新；`CONTEXT.md`/ADR 0030 零改动（git status 实读） | 一致（文档面零越界——T5 #391 边界保持） | 无 |
| §8-A 接口变化总表 | 8 行逐行核对：全部为加法可选字段；`createWatchHub` 签名零变化；lease/watchMap/三 kind/`WATCH_MAP_*` 零变化；types.ts +2 常量 | 一致 | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 结构性失效检测/降级单点/有界队列 | runtime（ADR 0030 决策 7） | `watch-map.ts` 模块内函数（零导出变化） | 正确 |
| 容量注入面/校验单点/lease 透传零变化 | registry | `testing.ts` overrides + `registry.ts` 模块私有 `resolveWatchQueueCapacity`（零值导出扩张）+ `lease.ts` 零改动 | 正确（registry AGENTS「test 控件留在显式 testing surface」对齐） |
| 装配缝 | runtime `internal.ts` 既有通道 | `RuntimeForRegistryDiagnostic` 加法字段经 internal.ts type re-export 随行（internal.ts 零改动） | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 数值可选注入校验 | `resolveIdleTimeoutMs`（TypeError/RangeError 二分 + types.ts 稳定文案） | `resolveWatchQueueCapacity` 同款 | 一致 | 显式援引先例；返回 `undefined` 而非默认值（无双常量副本） |
| 第三参通道加法 | clock / replicationObservability 条件展开进 seam | `watchQueueCapacity` 同通道 | 一致 | L930–941 既有模式复用 |
| 溢出降级 | T1 内联（L397–413 旧形态） | 提取单点 + 结构性失效复用 | 一致（收敛而非平行） | 消除潜在双实现 |
| 前缀判定 | `isPathPrefix`（L239–248） | 交换实参复用 | 一致 | 零新 helper |
| lease 契约三件套 | #369/#387 fixture/red/surface 模式 | 新三件套同目录同后缀同结构 | 一致 | 采集面同一 include |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 容量默认值 | `WATCH_QUEUE_CAPACITY_DEFAULT`（watch-map.ts L99 单点） | 注入路由 undefined → 缺省参数 | 无——resolver 返回 undefined 不复制数值 |
| 订阅生命周期 | subscriptions 集 + unsubscribed 标志 | 降级仅为队列事件 | 无——零第二状态字段 |
| 失效信号形状 | `enqueueInvalidateAll` 单点 freeze 构造 | — | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| watchMap 建立（六门全前置） | unsubscribe 幂等清队 / shutdown 防御收口（均零改动） | 注入门失败 = 构造期同步拒绝零副作用 | 对称；本实现零新增 acquire/release 面 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二 testing seam | testing.ts overrides | 复用唯一字段 | 无平行 |
| 第二真变判定 | isRealChange/isPathPrefix | 全复用 | 无平行 |
| 第二泵/清理 worker | schedulePump 单飞微任务泵 | 复用（零改动） | 无平行 |
| fixture 助手（sink/屏障） | #387 fixture | #390 自包含小拷贝 | 设计 D6 显式裁决（避免触碰冻结契约支撑文件）；可接受 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-runtime/src/watch-map.ts` | ALLOW 1 | D3/D4 父删编排与降级单点 | 在范围（+42/−8 净增，全部为检测函数/单点/短路/注释） |
| `packages/namespace-runtime/src/runtime.ts` | ALLOW 2 | D2 装配缝 runtime 侧 | 在范围 |
| `packages/namespace-registry/src/testing.ts` | ALLOW 3 | D1/D2 唯一注入面 | 在范围 |
| `packages/namespace-registry/src/registry.ts` | ALLOW 4 | D2/D5 internal 装配缝 + 校验单点 | 在范围 |
| `packages/namespace-registry/src/types.ts` | ALLOW 5 | D5 两条稳定 message | 在范围 |
| `packages/namespace-registry/test/issue-390-watch-invalidation-fixture.ts` | ALLOW 6 | D6 fixture | 在范围（SA6 §12.4 冻结路径） |
| `packages/namespace-registry/test/issue-390-watch-invalidation-red.test.ts` | ALLOW 7 | 行为契约 | 在范围 |
| `packages/namespace-registry/test/issue-390-watch-invalidation-surface.test-d.ts` | ALLOW 8 | 类型契约 | 在范围 |
| `artifacts/sa3-issue390-*.log|.sh`、`artifacts/sa6-issue390-*.log`、`wiki/raw/task_issue-390_*.md` | 证据/报告面（非源码非测试） | 原始输出与可复跑脚本 | 与 SA6/前序任务 artifacts 惯例一致 |

DENY 核对（`git status --porcelain` 实读）：`internal.ts`、两包 `index.ts`、`lease.ts`、`plugin.ts`、`errors.ts`、sequencer/write/schema-write/复制族/window-read/诊断族、全部既有测试（含 `issue-387-*`、`packages/namespace-runtime/test/**` 无新文件）、ADR 0030、`CONTEXT.md`、`instance-replication-v1.md`、`vitest.config.ts`、两包 `package.json`、`tsconfig*.json` —— **零改动**。无 ALLOW 外 tracked 改动；无残留临时物（`.sa6-390` 已清理、`impl.patch`/备份不在 worktree）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `createWatchHub` 第三参 | 全仓唯一调用方 `runtime.ts` L581（grep 实证） | `captured.watchQueueCapacity`；undefined → 缺省参数，生产行为逐字节不变 | 无 | 无 |
| `RegistryRuntimeOptions` 第三参对象 | registry 三处 factory 调用点（L1352/L1605/L1749） | 同签名对象加字段；`runtimeOptionsFor` 单点注入、两条返回路径全覆盖 | 无（含 import/reset 路径的 Runtime 均获得注入容量） | 无 |
| `NamespaceRegistryTestingOverrides` | 既有测试消费者 | 加法可选字段；testing.ts 逐字段拷贝增一分支（L177–181） | 无 | 无 |
| `RuntimeForRegistryDiagnostic` | registry 经 `@nomicore/namespace-runtime/internal` | internal.ts L77 type re-export 随行；type-guard 断言不触（两参重载居末） | 无（两包全量 95 files/1020 tests 绿佐证） | 无 |
| `captureSeamInput` 返回形状 | `createNamespaceRuntimeWithSeam` 构造栈 | 新增捕获字段 + 形状门（throw 前置于 enqueue，INV-N4）；既有字段门序零漂移（新门位于 replicationObservability 之后、return 之前） | 无 | 无 |
| 既有 `runtimeFactory` 覆盖式测试（#387 fixture） | 两参工厂形 | 第三参可选可忽略；容量对其无效果（自定义工厂自辖——设计 D2 组合语义） | 无（#387 契约 21/21 绿佐证） | 无 |
| `NamespaceRuntimeWatchMapNotification` 三 kind 消费者 | lease `watchMap` listener | 形状零变化；消费协议 v1 全量重拉已覆盖 invalidate-all 语义 | 无 | 无 |
| 生产入口/plugin | `createNamespaceRegistry` / `provideNomicoreRegistry` | 显式逐字段转发不含新字段；plugin config 键门仍 `{idleTimeoutMs?}`（L154 实读） | 结构性不可达 | 无 |
| types.ts 值导出 | 主入口 `index.ts` | L39–90 仅 type-only 白名单转出；两条新 message 常量值不进公共面 | 无 | 无 |

无遗漏 caller；零公共签名变化 ⇒ 无「调用方自行适配」义务。

## 8. 错误、恢复与并发

| 检查项 | 静态结论 | 证据 |
|---|---|---|
| 错误吞没/伪装成功 | 检测与降级全同步（Map.get/数组读/freeze/push 无非抛点）；handler 整体 try/catch 零 throw 红线不变；与 T1 同一既有权衡，非新风险 | `watch-map.ts` L435–437、L278–296、L452–477 |
| 注入垃圾容量 | 构造期同步 TypeError/RangeError（registry 单点）+ seam TypeError 防御门；throw 前置 enqueue、零副作用；无「恒溢出」静默 fallback | `registry.ts` L205–218/L826、`runtime.ts` L1161–1179 |
| 观察器清队 × 泵交错 | 单线程 run-to-completion：清队发生在观察器同步段；泵在让步点重检 `queue.length===0 → return` / `finally` 同步段复位 `pumpScheduled`（无丢失唤醒）；schedulePump 单飞守卫防二飞 | `watch-map.ts` L357–380（零改动）、L457 |
| 连续降级折叠 | `enqueueInvalidateAll` 清队含上一条未投递 invalidate-all → 恒恰一条待投递（语义幂等） | SC-3/SC-4 攻击线（SA2 已推演）与实现形态一致 |
| 退订竞态 | handler `unsubscribed` 跳过 + 单点首行守卫 + unsubscribe 清队（三层一致，冗余无害） | L424、L456、L530–537 |
| Runtime close 竞态 | shutdown 摘 observer + 清队（既有路径零改动）；在队降级信号被丢弃为既有语义 | L541–550 |
| 写路径阻塞 | 降级零 await、零 sequencer 接触；A7 断言写全 ok + 同步段零回调 | §3 AC6 行 |
| 进程重启/事务中断 | 通知不出进程、零持久化——无恢复义务 | ADR 0030 决策 7 |

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| A1/A2（red.test L98–139） | 注入 capacity=1 + 同步段两写 → `syncCallbacks===0`、两写 ok、恰一条两键 invalidate-all `toStrictEqual`、零 data 越过、x3 自愈 data、零 watch-end、kind 闭集 | `vitest run packages/namespace-registry/test/issue-390-watch-invalidation-red.test.ts`（include `packages/*/test/**/*.test.ts`）；红侧 8 failed 集合含本例（日志实读） | 无——B-2 触发模式 + 断言纪律逐条落地 | 无 |
| A7（L141–171） | 降级不阻塞写：写均 ok、后续写完成、闭集 | 同上（红侧红） | 无 | 无 |
| NC1（L173–201） | 不注入 → 两条 data + 屏障写 x3 → keys `[x1,x2,x3]`、零失效信号 | 同上（红侧绿——反伪绿对照） | 无——证明 A2 断言对注入敏感（实现若恒发失效信号本例必红） | 无 |
| A3（L207–247） | 父删 → 恰一条 invalidate-all、此前恰一条 data（e3 正控）、零 watch-end、重建后 e5 data、失效不叠加 | 同上（红侧红） | 无 | 无 |
| A3b（L249–295） | 同事务删+无关写 → 恰一条、零 meta 通知（事务级原子） | 同上（红侧红） | 无 | 无 |
| A4（L297–335） | 两级嵌套祖删 → 恰一条；重建后 g4 定位符 `{path:['optionalGroups','og1'],key:'g4'}` 到达 | 同上（红侧红） | 无 | 无 |
| A5（L337–377） | 整替 → 先以 readMap 证内容已替换（`['z1']`）→ 恰一条；z2 存活 | 同上（红侧红） | 无——整替的「旧子树消失」有读面正控佐证 | 无 |
| NC2（L379–400） | 条目级删除仍 `data`（定位符 `{path:['optionalTasks'],key:'e2'}`）、零失效 | 同上（红侧绿） | 无——宁多勿漏不退化为噪声的守卫 | 无 |
| A6（L406–445） | 删 → 失效 → 重建（add 旁路不钉）→ r1 data、失效恰一条、零重订阅 | 同上（红侧红——红因 = 删除信号缺口，AC4「重建后 data」段落基线绿，SA3 诚实区分） | 无 | 无 |
| A8（L451–466） | lease 恒 16 键（硬编码清单）、`'watchQueueCapacity' in lease === false`、runtime status 投影无该键 | 同上（红侧绿——注入不影响公共面） | 无 | 无 |
| A9/NC6（L468–497） | invalidate-all 恰两键、data 恰三键 + 定位符恰两键、kind 闭集、零 watch-end/version/rev | 同上（红侧红——经 A2 触发路径） | 无 | 无 |
| NC3/NC4/NC5（L499–576） | 无关写零通知 / 必填整删写面拒绝（issues 非空）零通知 / 非法批量拒绝零通知——三者均带同订阅后续写屏障（`writeAndAwaitData`）后断言 `received.length === 1` | 同上（红侧绿） | 无 | 无 |
| surface.test-d（B-1/B-3/A8 负锚 + 正负例） | 字段在场 `Equal<number|undefined>`、`@ts-expect-error` 负例（string）、生产入口/lease 零容量、invalidate-all `keyof` 恰 `'kind'|'origin'` + 四负锚、三 kind 窄化正例 | `vitest --typecheck`（include `*.test-d.ts`；绿证据 3 passed + no errors）+ `tsc -p tsconfig.typecheck.json`（include `packages/*/test/**/*.ts` 含本文件；红侧恰 2 错：TS2339/TS2353，与 SA6 类型探针同构） | 负锚 `_testingOverridesNotOnMainEntry` 仅锚值域 re-export（类型名不可能出现在 `keyof typeof`）——弱锚但有 A8 行为锚 + index.ts 零改动互补（§12-O4） | 无 |
| fixture（非测试文件） | 绑定单点 `watchQueueCapacityOverride`、缺省 factory 通路、`expect.poll` + 屏障助手 | `*.ts` 不被 `*.test.ts` 通配命中（SA6 §12.4 同 #387 先例）；tsconfig include 覆盖类型检查 | 无 skip/only/todo（grep 实证零命中）；无 fs/源码字符串断言（grep 实证） | 无 |

红→绿同版本论证：红灯在回退 5 个实现文件、**测试三件套保持当前修订**时采集（`sa3-issue390-red-recheck.sh`，trap 无条件还原 + sha256 校验）；红灯失败集合恰 = 两条独立缺口用例（A1/A2、A7 ← 注入面；A3/A3b/A4/A5/A6、A9 ← 通知面），6 绿恰 = 基线回归边界（NC1、NC2、A8、NC3、NC4、NC5）——与 SA6 §13 两条独立红因机械吻合，**无伪红灯**（AC4/A8/NC* 基线绿未被伪称红）。绿证据四件套（14/14、#387 21/21、两包 95 files/1020、双 typecheck exit 0）+ 复跑 ×3 互洽。

## 10. Required revisions

无 BLOCKER / MAJOR finding。全部攻击线——注入链 7 跳类型与运行贯通、D3 边界矩阵（严格祖先/链上键/条目级/ROOT/序列段/同事务混合/add 旁路）独立推演、D4 与 T1 逐字节等价性、门序漂移、冻结面结构不可破、文件范围、caller 连锁、测试纪律与红绿真实性——均未产生实施后必须修订的缺口。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| D5 容量门无动态锚定（契约断言面外，SA6 §15-4 / SA8 观察已记录延项） | SA7 动态验收（自选） | `createNamespaceRegistryForTesting(p, {…, watchQueueCapacity: 0})` → 构造期 RangeError；`'1'` → TypeError；直连 seam `createNamespaceRuntimeWithSeam({…, watchQueueCapacity: 1.5})` → TypeError；合法 `1` 照常构造 | 任何垃圾值被静默接受（恒溢出运行）或 throw 携带副作用 |
| A2 溢出触发的时序确定性依赖 SA6 §7-1（10/10 先提交后投递）——泵让步参数或 sequencer 异步度未来变化可能使其翻红 | SA7 / 后续 CI 多轮 | 同步段两写在泵首投递前双提交；A1/A2 稳定绿（已 ×3 复跑） | 间歇性 `waitForInvalidateAll` 超时（fail-loud 方向：翻红而非伪绿，可接受但须归因） |
| `origin:'replication'` 的结构性失效/溢出降级保真（本任务契约仅断 local——T3 #389 范围） | T3 #389 | 复制 apply 删父路径 → `{kind:'invalidate-all', origin:'replication'}` | origin 误分类为 local |

## 12. Non-blocking observations

| ID | Observation | Suggestion（非阻断） |
|---|---|---|
| O1 | D5 两道 fail-loud 门（registry 二分 + seam TypeError）无任何测试锚定——超出契约断言面（SA6 §15-4）且 SA2 ER-1/SA8 观察已记录，属授权延项而非缺口 | SA7 如锚定可按 §11 第 1 行；零实现改动 |
| O2 | fixture 绑定单点命名与设计 D1 速写不同：`WATCH_TEST_INJECTION_BINDING` → 实现为 `watchQueueCapacityOverride()` + `WATCH_QUEUE_CAPACITY_INJECTED`（功能等价——字段名仍单点收敛于绑定函数，SA6 B-1「另择只改单点」的可维护性保持） | 无需动作；后续任务沿用实现命名即可 |
| O3 | `registry.ts` L199 注释残句「testing 控件注入值经内部分组成。」语序不完整（疑漏「装配缝」） | 后续触碰该文件时顺手修正；纯注释锚点 |
| O4 | surface 负锚 `_testingOverridesNotOnMainEntry` 只能拦截**值域** re-export（类型名结构性不可能出现在 `keyof typeof`），语义偏弱 | 已由 A8 行为锚 + index.ts 零改动互补；如需强锚可改为断言 `typeof MainEntry` 无 testing 工厂值成员 |
| O5 | 测试不 release lease / 不 shutdown registry（与 #387 fixture 惯例一致；每用例独立 registry + test scheduler，`maxWorkers: 1` 下无跨用例干扰，进程退出即回收） | 维持现状（与契约家族惯例一致）；若未来出现句柄泄漏类断言再统一加 afterEach |

## 13. requiresConflictRecheck 判定

**false**。本轮未发现新的 ADR 冲突风险：实现为 ADR 0030 决策 3/4/6 + 验收缝的纯兑现（SA4 对 §8-4 ①–⑦ 的独立复核与 SA8 实现后复查报告结论一致、零分歧）；无决策修订、无 override、无冻结面触碰。SA8 实现后复查已闭合 `requiresConflictRecheck = false`，本轮无需重开。
