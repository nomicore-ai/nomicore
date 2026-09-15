# SA9 标准符合性审查 — issue #390：溢出降级与父路径删除（变更订阅 T4）

- 被审对象：**committed final delivery** = HEAD `5fdb573df2f7ddb49c6e670ef520cb14b9365cea`
  （`fix: degrade overflowing change subscriptions`，单笔交付，16 文件，2817+/19−）；
  基准 = PR #386 base `28faeae7a0c619e1352f05d19a83ba46e562879c`（T1 #387 已合入，dispatch
  确认 freshly queried）。工作树仅余未跟踪证据日志与任务简报（`artifacts/sa{3,6}-issue390-*`、
  `wiki/raw/task_issue-390.md`）；`git diff --check` exit 0。
- 审查轮：iteration 0（dispatch `sa-4f07f3f3-99a9-4500-939b-c134ceb71f6b`，role `mabf-sa9`，
  phase standards-review）。
- 职责边界：只判**当前实现**是否符合仓库 AGENTS / ADR / 模块责任 / 既有架构惯例 /
  单一事实源 / 生命周期对称性 / 文件范围 / 测试质量标准；不审查需求完整性（SA10），
  不修改代码/设计/测试、不运行测试、不调度其他 SA。
- 方法：对最终交付全量 diff（16 文件）逐文件实读/对账；5 个实现文件的 sha256 前 16 位
  与 SA8 实现后复查登记锚点**逐字一致**（watch-map `fcd2a1a8f68788b7` / runtime
  `d33f404fcf08e7c6` / registry `64753410c1206995` / testing `d76f8b76faae1cf4` / types
  `ef9840a12d496293`）——committed head 与 SA4/SA8 已审 worktree 实现逐字节同一；关键惯例点
  （容量常量单点、字段收容边界、值导出面、错误码族、测试弱化词、import 面、采集通配）
  独立 grep + 实读复核，不转引上游结论。

---

## 1. Verdict

**approve（0 × BLOCKER，0 × MAJOR；3 × MINOR 不阻断）。**

交付是 ADR 0030 决策 3/4/5/6/7 + 验收缝 L94 的忠实、守纪实现：容量注入 7 跳全链为加法式
可选字段（testing surface → internal 装配缝 → 第三参对象 → seam 捕获 → `createWatchHub`
既有第三参位），arity/签名/导出面零变化；父删/祖删/整替结构性失效编排落 runtime 模块内
（零导出），降级入队单点化为逐字节等价重构；九项冻结面（三 kind 形状 / 数值治理 / lease
16 键 / `WATCH_MAP_*` / 复制面 / sequencer 槽序 / internal arity / 谓词与 watch-end 词表 /
文档缝）经本轮独立复核**零触碰**。SA2（approve）/ SA3（红绿证据闭环）/ SA4（approve）/
SA8 前置门禁与实现后复查（clear，`requiresConflictRecheck=false`）的结论与盘面一致。

## 2. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| 交付 diff `28faeae..5fdb573`（16 文件；本轮 `git show --stat` + 逐文件实读） | 本轮实读 | 被审对象 |
| `docs/adr/0030-change-subscription.md`（零 diff，本轮实证） | 在场 | 规范权威 决策 3/4/5/6/7 + 验收缝逐条对照 |
| 根 `AGENTS.md` + `packages/namespace-{runtime,registry}/AGENTS.md` + `docs/AGENTS.md` | 在场 | 模块契约与文件纪律 |
| `CONTEXT.md`「变更订阅」词条（L65–67，零 diff） | 在场 | 词汇收口与 _Avoid_ 清单 |
| `wiki/raw/task_issue-390_design.md`（SA1，449 行） | 在场 | §7-D1–D8、§8-A、§11 ALLOW/DENY 逐行核对基准 |
| `wiki/raw/task_issue-390_sa6_contract.md`（approve）/ `_sa2_review.md`（approve）/ `_sa3_impl.md` / `_sa4_review.md`（approve）/ `_conflict_report.md`（clear）/ `_implementation_conflict_report.md`（clear，recheck=false）/ `_relevant_decisions.md` | 在场 | 上游审查结论与证据索引（本轮只做一致性复核，不复跑） |
| issue #390 正文（6 条 AC）+ 评论 REST `[]`（dispatch 现场，与简报/SA6/SA1/SA2/SA3/SA8 六方记录一致） | 在场 | Owner 要求 = 无、无 override 载体 |
| ADR 0008/0009/0011 交叉纪律面 | 在场 | 槽序 / lease 生命周期 / 槽外调用点 |
| ADR 0010 L267（复制 fanout 冻结常量，相反纪律对照） | 在场 | 数值治理纪律辨析 |

## 3. AGENTS.md 符合性

| 模块条款 | 实现落点 | 裁决 |
|---|---|---|
| runtime AGENTS：严格 FIFO 唯一、reads 不进 sequencer；槽序不被通知面改变 | 降级三步（清队 + push + `schedulePump`）全为观察器内同步有界操作；分发复用既有槽外单飞微任务泵（L357–380 零 diff）；`sequencer.ts`/`write.ts`/`schema-write.ts`/`replication-*.ts`/`window-read.ts`/诊断族 **零 diff**（本轮 `git diff --name-only` 实证） | 符合 |
| runtime AGENTS：公共 API 只暴露 detached 投影；queues/production constructor/test seams 保持 internal | `detectStructuralInvalidation`（L278–296）与 `enqueueInvalidateAll`（L452–460）均为模块内函数、**零导出**（本轮 grep 实证）；失效信号 `Object.freeze({kind,origin})` 纯数据；容量经 `NamespaceRuntimeSeamInput`/`RuntimeForRegistryDiagnostic` 包内类型加法字段走既有 internal seam——两包 `index.ts` 零 diff | 符合 |
| runtime AGENTS：`close()` 同步停接纳、幂等；`getStatus()` 全程可观测 | 关停/退订路径零 diff（diff 六 hunk 均不触 L480+ 生命周期区）；降级仅为队列事件，不产生新生命周期态 | 符合 |
| registry AGENTS：公共 API 仅经 `src/index.ts` 增长；hostile/test 控件留显式 testing surface | 容量注入唯一位 = `NamespaceRegistryTestingOverrides.watchQueueCapacity?`（testing.ts L66–71 加法字段 + L144 内部对象类型 + L177–181 条件拷贝）；`index.ts`/`lease.ts`/`plugin.ts` 零 diff；`resolveWatchQueueCapacity` 为 registry 模块私有（零值导出扩张，本轮 grep 实证） | 符合 |
| registry AGENTS：生产装配经 internal seam；config 键集冻结 | 生产入口 `createNamespaceRegistry` 逐字段显式转发不含新字段（结构性不可达，SA4 实核 L2306–2321，本轮对 diff 零触碰复核）；plugin config 键门仍 `{idleTimeoutMs?}`（L154，零 diff） | 符合 |
| 根 AGENTS：typed Namespace writes / 模块指导 / 领域文档布局 | 契约三件套全部经 lease 公共面 `mutateData`/`readMap`/`watchMap`（生成投影与 typecheck 证据链 SA3 落盘：根 `pnpm typecheck` exit 0、测试树 tsc exit 0）；无 live Y.Doc 访问、无快照编辑 | 符合 |
| docs AGENTS：代码行为变更须同步规范文档；ADR 为规范、wiki/raw 为 evidence | 本交付是**兑现型**实现——ADR 0030 L50/L66 与 CONTEXT.md L66 已明文承诺「父路径删除 → `invalidate-all`、订阅存活、数值不进契约」，规范先行的正确形态 ⇒ 零 docs diff 合规（文档缝细化属 T5 #391 既有分期，非缺口）；wiki/raw 产物落惯例位置 | 符合 |

## 4. ADR 符合性

| ADR 条款 | 实现 | 裁决 |
|---|---|---|
| ADR 0030 决策 4（L50）：`invalidate-all` 触发源 = 通知队列溢出、**父路径删除**；恰两键 `{kind, origin}` | `detectStructuralInvalidation`：严格祖先（`eventPath.length < depth`）+ 链上前缀（`isPathPrefix(eventPath, containerPath)`，与 `collectChanges` 方向相反、互不干扰）+ 链上键 delete/update 真变 → handler 内先于 `collectChanges` 短路（L425–430）；信号单点构造恰两键 freeze（L458） | 符合 |
| ADR 0030 决策 4（L51）：订阅终结三因；数据缺席与删除从不终结订阅 | 簿记零摘除：`subscriptions` 集与 `unsubscribed` 标志写入点零 diff；降级不发 `watch-end`（diff 中 `watch-end` 仅现于既有类型联合与头注边界行，本轮 grep 实证） | 符合 |
| ADR 0030 决策 3（L38）：数据缺席合法、宽容等待；横跨重建 | 建立判定纯 active schema 侧零 live 探测（L499–520 未动）；`add` 旁路使创建事务与 T1 逐字节一致；A6 验收「删 → 失效 → 重建 → 条目 `data`」在契约内 | 符合 |
| ADR 0030 决策 5（L55–60）：宁多勿漏唯一不变量；真变过滤 | 零第二套判定：祖先级 update 复用 `isRealChange`（delete 恒真变；plain→plain 深比较相等过滤；live 载体保守失效）；链途径序列段保守失效（宁多方向）；条目级语义零漂移（NC2） | 符合 |
| ADR 0030 决策 6（L64–67）+ 验收缝 L94：槽外分发、回调 throw 隔离、有界队列、**数值不进公共契约**、testing 工厂注入小上限 | `WATCH_QUEUE_CAPACITY_DEFAULT = 16` 单点未动（本轮 grep 实证 L99 唯一出现 + L408 缺省参数引用）；注入链 7 跳全加法可选字段；undefined 触发缺省参数（生产逐字节不变）；handler 整体 try/catch 零 throw 红线不变；listener throw 静默隔离 | 符合 |
| ADR 0030 决策 6（L67）：事务级原子 + FIFO | 结构性失效短路条目聚合（一事务一订阅至多一条）；清队只清在队未投递（B-7 授权：invalidate-all 包摄一切条目定位符）；泵 shift FIFO 不变 | 符合 |
| ADR 0030 决策 7（L71–73）：runtime 簿记/判定/分发；registry lease 公共面与透传；复制协议零改动 | 检测/降级全落 runtime watch-map.ts 模块内；registry 仅 testing surface 加法字段 + internal 装配缝；lease.ts 纯透传零 diff；`replication-*.ts`、协议文档零 diff、无 needs-resync 挂接 | 符合 |
| ADR 0008（L38–57）：唯一 FIFO write sequencer；槽序 | 通知面零槽位占用；A7 断言同步段零回调、写全 `ok:true`（契约内） | 符合 |
| ADR 0011（L20/L159）：emit 调用点在 sequencer slot 之外、失败不改写结果 | 降级与分发沿诊断日志同款槽外纪律（ADR 0030 §6 明文援引）；通知异常零外泄 | 符合 |
| ADR 0008 稳定码注册表 append-only | `errors.ts` 零 diff（`WATCH_MAP_*` 码族仍恰两码，本轮实证零新增错误条件） | 符合 |
| ADR 0010 L267 对照（复制 fanout 冻结常量 = 相反纪律） | 容量保持可注入构造参数 + 实现默认，未套用 fanout「冻结不可配置」纪律——SA8 §8-4② 要求的两纪律互不套用成立 | 符合 |

## 5. 模块责任与既有架构惯例

| 维度 | 复核 | 裁决 |
|---|---|---|
| 责任归属 | 检测/降级/有界队列归 runtime（模块内函数、零导出）；testing 注入面与校验单点归 registry（显式 testing surface + 模块私有 resolver）；lease 透传零变化 | 正确（与两模块 AGENTS 及 ADR 0030 §7 对齐） |
| 数值可选注入校验先例 | `resolveWatchQueueCapacity`（registry.ts L205–218）与 `resolveIdleTimeoutMs` 同款二分（undefined→undefined / 非 number→TypeError / 域违例→RangeError），`Number.isInteger` 覆盖 Infinity/NaN；稳定 message 落 types.ts L89–95（零插值、零值回显，#112 冻结文本先例）；调用位紧随 idleTimeoutMs 之后、randomBytes 门之前（L826）——字段在全部既有调用方缺席 ⇒ 门禁文案/顺序零漂移 | 符合 |
| 第三参通道加法先例 | `RuntimeForRegistryDiagnostic` 加法字段 + `createNamespaceRuntime` 条件展开（L936–939）——clock / replicationObservability 既有模式复用；`runtimeOptionsFor` 两条返回路径单点注入（L878–881/L900），三处 factory 调用点共享 | 符合 |
| internal seam arity 冻结 | `internal.ts` 零 diff；type-guard 断言 `Parameters extends [DocHandle, () => Promise<void>, unknown?]` 由「两参重载居末」保持——第三参对象加字段不触断言（否决备选 A 的第四位置参路线正确） | 符合 |
| 溢出降级收敛 | T1 内联溢出分支（清队+push+schedulePump）提取为 `enqueueInvalidateAll` 单点并与结构性失效共用——逐字节等价重构（本轮逐行比对确认），消除潜在双实现，收敛而非平行 | 符合 |
| 契约三件套先例 | fixture + red.test + surface.test-d 同目录同后缀同结构（#369/#387 家族）；新 fixture 自包含（不 import #387 冻结支撑文件——本轮 grep 实证 import 块），走缺省生产 factory 通路（SA8 §8-1 点名装配点） | 符合 |
| 注释与文档面 | 头注 E 分发段/边界注/C-3 注释随实现同步更新（源文件注释属实现面）；「降级、结构性失效、订阅存活、宁多勿漏」用词与 CONTEXT 词条一致，无 observer/推送/含值/version 撞词 | 符合 |

## 6. 单一事实源

| 事实 | 权威源 | 复核 |
|---|---|---|
| 容量默认值 | `WATCH_QUEUE_CAPACITY_DEFAULT`（watch-map.ts L99 唯一出现处；L408 缺省参数引用同一常量） | 无双常量副本——resolver 返回 `undefined` 而非默认值，缺省经构造缺省参数单点生效 |
| 失效信号形状 | `enqueueInvalidateAll` 单点 `Object.freeze({kind:'invalidate-all', origin})` | 两触发源共用同一构造点；无第二处 freeze |
| 校验 message | types.ts 两条稳定常量（`…_TYPE_MESSAGE`/`…_RANGE_MESSAGE`） | 单一真相源；registry `index.ts` 对 types.js 仅 type-only 白名单转出（L39–90）——常量值结构性不进公共面 |
| 注入字段名/绑定 | fixture 单点 `watchQueueCapacityOverride()` + `WATCH_QUEUE_CAPACITY_INJECTED` | B-1「另择只改单点」可维护性保持（命名与设计速写不同，功能等价——见 §10 观察） |
| 订阅生命周期 | `subscriptions` 集 + `unsubscribed` 标志（写入点零 diff） | 降级仅为队列事件，零第二状态字段 |
| `watchQueueCapacity` 收容边界 | 仅现于 registry.ts / testing.ts / types.ts / runtime.ts 四内部文件（本轮 grep 实证）；两包 index.ts / lease.ts / plugin.ts 零命中 | 公共契约零泄漏 |

## 7. 生命周期对称性

| Start / acquire | Stop / release | 复核 |
|---|---|---|
| `watchMap` 建立（六门全前置，零改动） | `unsubscribe` 幂等清队 / lease release / runtime close 收口（三路径零 diff） | 对称；降级不新增任何 acquire/release 面 |
| Registry 构造期容量解析 | 门失败 = 构造期同步 TypeError/RangeError（零副作用、零半构造态） | 对称；seam 形状门 throw 前置于 enqueue（INV-N4） |
| 泵启动（单飞守卫，零改动） | 让步点重检空队退出 + `finally` 复位守卫（零改动） | 观察器清队这一新写入形态纳入既有交错安全论证（泵在让步点重检，无丢失唤醒） |

## 8. 文件范围

- **交付完整性**：最终 diff = 16 文件（5 实现 + 3 新契约测试 + 8 wiki/raw 产物），与 SA3
  File scope 表 / SA4 §6 / SA8 §1 清单逐行对账吻合；5 个实现文件 sha256 与 SA8 登记锚点
  逐字一致（committed head = 已审实现，零漂移）。
- **ALLOW 落位（8/8）**：watch-map.ts（D3/D4 检测/单点/短路/注释）/ runtime.ts（seam
  input、`RuntimeForRegistryDiagnostic`、条件展开、捕获+形状门、L581 第三参接线）/
  testing.ts（唯一注入面）/ registry.ts（internal options、resolver 单点、`runtimeOptionsFor`）/
  types.ts（两条 message）/ 新三件套（SA6 §12.4 冻结路径）——逐一命中设计 §11 ALLOW 行。
- **DENY 零 diff**（本轮 `git diff --name-only` 对 DENY 全清单实证）：`internal.ts`、两包
  `index.ts`、`lease.ts`、`plugin.ts`、`errors.ts`、sequencer/write/schema-write/复制族/
  `window-read.ts`/`read-schema-projection.ts`/诊断族、全部既有测试（含 `issue-387-*`、
  `packages/namespace-runtime/test/**` 无新文件）、`docs/adr/0030-*.md`、`CONTEXT.md`、
  `docs/protocols/instance-replication-v1.md`、`vitest.config.ts`、两包 `package.json`、
  `tsconfig*.json`——**零命中**。
- **值导出面不变**：两包 `index.ts` 零 diff；registry 对 types.js 仅 type-only 转出；
  `createWatchHub` 第三参签名零变化（唯一变化 = runtime.ts L581 调用点开始传值）。
- wiki/raw 八产物（简报类除外：SA1 设计 / SA2 / SA3 / SA4 / SA6 契约 / SA8 双报告 /
  决策摘录）随交付入库——与 T1 #387 交付（同样捆绑 wiki 产物）同一惯例落位。
- 未跟踪项：`artifacts/sa{3,6}-issue390-*` 证据日志与 `wiki/raw/task_issue-390.md`（Host
  简报）——仓内票对证据日志跟踪与否两态并存，无强制惯例（见 §10 观察）。
- `git diff --check` exit 0。

## 9. 测试质量标准

| 标准 | 复核 | 裁决 |
|---|---|---|
| 契约三件套与采集面 | fixture 文件名不命中 `*.test.ts` 通配（不被收集）、red.test 命中 vitest L15 include、surface.test-d 命中 L20 typecheck include + `tsconfig.typecheck.json` 覆盖（config 零 diff 即已覆盖） | 符合 |
| 无弱化 | 本轮 grep：三件套零 `.skip`/`.only`/`.todo`（唯一命中为头注自证纪律的注释）；零 env override；零源码字符串断言；红→绿同一测试修订（SA3 红灯回退-还原脚本 + sha256 校验链） | 符合 |
| 异步纪律 | `expect.poll` + 同订阅后续写屏障（`writeAndAwaitData`）证明「零通知」；B-2 触发模式断言 `syncCallbacks === 0`（禁 sleep 竞猜）；复跑 ×3 稳定（SA3 落盘日志） | 符合 |
| 断言强度 | 失效信号恰两键 `toStrictEqual`；data 恰三键 + 定位符恰两键集中 helper（`expectDataShape`）；kind 闭集；零 version/rev/watch-end；lease 恒 16 键硬编码清单 + 注入后 `'watchQueueCapacity' in lease === false`；surface 13 条类型断言含 `@ts-expect-error` 负例与公共面负锚 | 符合 |
| 负控与回归边界 | NC1 反伪绿（不注入 → 零失效信号，证明断言对注入敏感）/ NC2 条目级仍 `data` / NC3 无关路径零通知 / NC4-NC5 写面拒绝零通知 / NC6 形状冻结；AC4/A8 基线绿诚实标注（未伪称红灯）；#387 21/21、两包 95 files/1020、双 typecheck exit 0 回归链落盘 | 符合 |
| 公共面 import 纪律 | 三件套仅 import `@nomicore/namespace-registry`（公共入口）+ `/testing`（既有子路径）+ `@nomicore/persistence` 类型 + yjs/vitest + 本地 fixture（本轮 grep 实证）；零 internal seam / `createWatchHub` 直连 | 符合 |

## 10. Findings（MINOR，不阻断 approve）

- **M-1（MINOR·commit 规整度）**：commit header `fix: degrade overflowing change
  subscriptions` 未带 `(#390)` issue 引用——仓内主导惯例为 `type(#issue): …`（如
  `fix(#387)`/`fix(#376)`），但无文档化 commit 规范且裸 header/英文 header 先例并存
  （`2fdac1b`/`2fbbe5e`）。不改任何代码事实。
- **M-2（MINOR·注释残句，沿 SA4 O3）**：`registry.ts` L199 头注「testing 控件注入值经
  内部**组成**。」语序不完整（疑漏「装配缝」）；纯注释锚点，零行为/契约影响。建议下一触
  该文件的票顺手修正。
- **M-3（MINOR·防御门动态锚定延项）**：D5 两道 fail-loud 门（registry 二分 + seam 形状门）
  无动态测试锚定——超出契约断言面（SA6 §15-4 明示契约只需 `1` 被兑现），SA2 ER-1 /
  SA4 O1/§11 均记录为授权延项，动态锚定属 SA7 自由裁量。非缺口。

**观察（非 finding）**：① fixture 绑定单点命名与设计 D1 速写不同（
`WATCH_TEST_INJECTION_BINDING` → 实现为 `watchQueueCapacityOverride()` +
`WATCH_QUEUE_CAPACITY_INJECTED`）——功能等价、字段名仍单点收敛（SA4 O2）；② surface 负锚
`_testingOverridesNotOnMainEntry` 仅能拦截值域 re-export，语义偏弱——已由 A8 行为锚 +
index.ts 零 diff 互补（SA4 O4）；③ 证据日志未随交付入库——仓内两态并存，无强制惯例。

## 11. 结论与 requiresConflictRecheck 判定

实现（committed HEAD `5fdb573`）对仓库 AGENTS 模块契约、ADR 0030 及全部交叉 ADR 条款、
分层责任、既有先例（`resolveIdleTimeoutMs` 校验二分 / 第三参条件展开 / #112 冻结文本 /
契约三件套 / 槽外泵）、单一事实源、生命周期对称性、ALLOW/DENY 文件范围与测试质量标准
**全部符合**；三项 MINOR 均为 commit 规整度/注释/授权延项级别，不触碰任何承重面。按
SA9 规则（无 BLOCKER/MAJOR ⇒ approve；MINOR 不阻断），**verdict = approve**。

**requiresConflictRecheck = false**：SA8 实现后复查已按 §8-4 清单①–⑦对实际 diff 逐项
闭合并落 false；本轮 SA9 独立复核（sha256 锚点同一性、冻结面零 diff、收容边界 grep、
docs 兑现型零演进）未发现新的 ADR 冲突风险，不重开。
