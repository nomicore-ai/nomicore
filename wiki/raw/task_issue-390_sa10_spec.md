# SA10 Spec Review — issue #390：溢出降级与父路径删除（变更订阅 T4）

- 被审对象：**已提交最终交付** —— delivery commit `5fdb573df2f7ddb49c6e670ef520cb14b9365cea`
  （`fix: degrade overflowing change subscriptions`），其父 = Parent PR #386 基座分支头
  `28faeae7a0c619e1352f05d19a83ba46e562879c`（T1 #387 已合入，ADR 0030 在库 `6df1c61`）——
  `git log` / `git diff 28faeae..5fdb573` 本轮实证：diff = 5 个源文件（+177/−19）+ 3 个新增
  契约测试文件（+1007）+ 8 份 wiki/raw 流程产物；工作树对 HEAD 零 tracked 漂移（仅未跟踪
  证据日志与 Host 简报）。
- 审查基准：issue #390 正文（REST 实读：What-to-build + AC1–AC6，state open，`in-progress` 标签）
  + SA6 验收契约（`task_issue-390_sa6_contract.md`，approve；§12.1 绑定 B-1–B-7、§12.2 用例
  A1–A9/NC1–NC6、§12.5 断言纪律）+ ADR 0030（规范权威 = 决策 3/4/5/6/7 + 验收缝 L88–97，
  本轮实读原文对账）+ CONTEXT.md L65–67「变更订阅」词条（零 diff）。
- Owner 要求：**无**（REST `issues/390/comments` = `[]`，dispatch 与 SA6/SA1/SA2/SA3/SA4/SA8
  七方记录一致）→ 无 owner override 需映射。
- 方法：SA10 独立实读交付全量 diff（`watch-map.ts` 552 行全文、runtime/registry/testing/types
  全部 diff、契约三件套全文）与上游八份产物；**不运行测试**。红→绿门禁数值本轮**做了日志
  tail 复核**（与 #387 不同，本任务 SA3/SA6 日志在 worktree 未跟踪区在场可核——见 §5）。
- 结论：**approve** —— AC1–AC6 全部满足且有行为/类型断言锚定；SA6 绑定表 B-1–B-7 逐项兑现；
  ADR 0030 决策 3/4/5/6/7 与验收缝 L91/L94 忠实；非目标（T2/T3/T5、复制面、sequencer 槽序）
  零越界；九项冻结面零 diff（本轮 git 实证）；红→绿证据链日志级互洽。关键 AC 无
  partial/unmet/unachievable；仅 6 条 MINOR 观察（不阻断）与已裁决分期/边界披露项须在 PR 披露。

---

## 1. Issue AC ↔ 交付映射（逐条裁决）

| AC | 要求 | 交付落点（本轮实读） | 契约锚 | 裁决 |
|---|---|---|---|---|
| AC1 | 每订阅通知队列**有界**：上限 = 构造参数 + 实现默认值，**数值不进公共契约**（语义进：有界、溢出行为） | `createWatchHub(doc, state, queueCapacity = WATCH_QUEUE_CAPACITY_DEFAULT)` 构造参数位（`watch-map.ts` L405–409，签名零变化）；默认常量 16 单点 L99（全仓唯一，本轮 grep 实证 `watchQueueCapacity` 仅现于 runtime/registry/testing/types 四内部文件 + 三测试文件）；lease 面/主入口/plugin config 零字段 | A1/A2（注入生效且被消费）、A8（lease 恒 16 键 + `'watchQueueCapacity' in lease === false` + runtime status 投影无该键）、surface `_productionEntryNoCapacity`/`_leaseNoCapacity`/`_testingOverridesNotOnMainEntry` 类型负锚、NC1（缺省不溢出） | **met** |
| AC2 | 溢出 → 订阅收到 `{kind:'invalidate-all', origin}`，**订阅存活**——溢出后新变更恢复正常通知（全量重拉即自愈） | `enqueueData` 溢出分支 → `enqueueInvalidateAll`（清在队未投递 → 入队单条 `Object.freeze({kind:'invalidate-all', origin})` → 泵调度，L452–477）；订阅簿记（`subscriptions`/`unsubscribed` 写入点）零 diff | A1/A2：capacity=1 + 同同步段两写 → `syncCallbacks===0`、两写 `ok:true`、恰一条两键 `toStrictEqual({kind:'invalidate-all',origin:'local'})`、零 data 越过、x3 写 `data` 自愈、失效不叠加、零 watch-end；NC1 反伪绿（不注入 → 两条 data + 屏障后零失效信号） | **met** |
| AC3 | 订阅容器 path 的父级删除（容器被删）→ `invalidate-all`、订阅存活 | `detectStructuralInvalidation`（L278–296：严格祖先 `eventPath.length < depth` + 链上前缀 + 链上键 delete/update 真变；`add` 旁路；序列段保守失效）+ handler 先于 `collectChanges` 短路（L425–430）；真变复用 `isRealChange`（零第二套判定） | A3（父删恰一条两键 + 此前恰一条 data 正控 + 重建后 e5 `data`）、A3b（同事务删+无关写 → 恰一条、零 meta 通知 = 事务级原子）、A4（两级嵌套祖删）、A5（整替，readMap 正控证旧子树消失）；NC2（条目级删除仍 `data` 不噪声化） | **met** |
| AC4 | **订阅横跨缺席期**：容器删除后重建，重建后条目变更照常以 `data` 到达——数据在场性从不终结订阅 | 簿记 = 冻结 path 快照（L520）、建立判定纯 active schema 侧零 live 探测（L499–518 未动）；`add` 旁路使创建事务与 T1 逐字节一致；降级仅为队列事件非生命周期事件 | A6：删 → invalidate-all → 重建 → 条目写以 `{path:['optionalTasks'],key:'r1']}` 形 `data` 到达、失效恰一条、零重新订阅、零 watch-end | **met** |
| AC5 | 溢出路径可测：经**既有** testing 工厂 overrides 注入小队列上限触发（**零新接缝**） | `NamespaceRegistryTestingOverrides.watchQueueCapacity?` 加法式可选字段（`testing.ts` L66–71）→ internal 透传（L177–181）→ `resolveWatchQueueCapacity` → `runtimeOptionsFor` 第三参两路 → seam input/`captureSeamInput` → `createWatchHub` 第三参（`runtime.ts` L581）；fixture 走**缺省生产 runtimeFactory 通路**（显式不提供 `runtimeFactory` 覆盖）；三件套仅 import 公共入口 + `/testing` 子路径（实读 import 块） | A1/A2 运行面 + surface 正/负例（`@ts-expect-error` 非 number 注入 fail closed）；红侧类型面恰 TS2339+TS2353 两错（注入位缺席同构 SA6 探针） | **met** |
| AC6 | 溢出不阻塞写路径：降级信号的分发同样在写序列器槽之外 | 降级三步（清队 + push + `schedulePump`）全为观察器内有界同步操作（零 await/零 throw 面）；泵 = 既有单飞微任务泵（L357–380 零 diff，每项前让步 20 微任务）；handler 整体 try/catch 零 throw 红线不变（L435–437）；`sequencer.ts`/`write.ts` 零 diff（git 实证） | A7：触发写全 `ok:true`、同步段零回调、降级后写照常完成、kind 闭集、零 watch-end | **met** |

**What-to-build 总句**（有界溢出显式降级 + 父删全失效 + 订阅横跨缺席期；无需 needs-resync
重协商）——由 §1 六行合并覆盖；复制面零 diff（git 实证，`replication-*.ts`/协议文档均未触）。**met**。

## 2. SA6 验收契约绑定表兑现（B-1–B-7）

| 绑定 | SA6 默认 / 授权 | SA1 冻结 | 交付兑现（本轮实读） | 裁决 |
|---|---|---|---|---|
| B-1【承重】容量注入位 | `NamespaceRegistryTestingOverrides` 加法式可选字段 `watchQueueCapacity?: number`（正整数 ≥1），经 internal 装配缝真达 `createWatchHub` 第三参；缺省 = runtime 实现常量 | 采纳契约默认（D1）⇒ 无需回写 §12.1 | 链路 7 跳全为加法可选字段、arity/签名/导出零变化（§3 表逐跳实读）；fixture 绑定单点 `watchQueueCapacityOverride()`（功能等价设计速写 `WATCH_TEST_INJECTION_BINDING`，见 §6-M5）；A1 运行敏感 + NC1 对照 | 兑现 |
| B-2【承重】溢出触发模式 | 注入 capacity=1；同一同步段两次 un-awaited `mutateData`；断言 `syncCallbacks === 0` | 维持（D 验收映射） | A1/A2/A7 逐字落地（`WATCH_QUEUE_CAPACITY_INJECTED = 1`）；绿侧确定性复跑 ×3 全绿（日志复核） | 兑现 |
| B-3 `invalidate-all` 形状 | 恰两键 `{kind, origin}`；origin = 触发事务 origin；无 changes/reason/version/rev | 维持 | 单点 `Object.freeze` 构造（L458）；A9/NC6 `toStrictEqual` + surface `_invalidateAllKeys`/`_invalidateAllNo{Reason,Changes,Version,Rev}` 类型断言 | 兑现 |
| B-4 父路径删除语义 | 严格祖先 delete 或整替 update（旧子树消失）→ invalidate-all；容器创建不钉 kind（T1 N4） | 维持 + A5 整替纳入（裁决②） | `detectStructuralInvalidation` 分支矩阵与契约逐条对应（depth 0 早退 / ≥depth continue / 链上前缀 / 链上键 / `add` 旁路 / 真变复用 / 序列段保守失效）；A6/A3b 不断言重建事务 kind | 兑现 |
| B-5 订阅存活 | 溢出/父删/整替后不摘除：无 watch-end、无 unsubscribe 反作用；重建后条目照常 `data` | 维持（D7） | `watchMap`/`unsubscribe`/`shutdown` 路径零 diff（L480–551 原样）；六个用例均含存活断言 + `not.toContain('watch-end')` | 兑现 |
| B-6 容量默认值 | **不断言数值**；只断「默认容量下 2 次 un-awaited 写不溢出」（NC1）与「注入 1 必溢出」 | 维持 | NC1 只断零失效信号 + 三条 data；`WATCH_QUEUE_CAPACITY_DEFAULT = 16` 实现常量单点未动（未套用 ADR 0010 L267 复制 fanout 冻结常量纪律） | 兑现 |
| B-7 事务级原子 + FIFO | 一事务至多一条；含结构性删除的事务该条 = invalidate-all；已投递序不被越过（在队未投递 data 允许被清） | 维持（D3 短路 + D4 清队） | handler 短路（L427–430）；清队只清在队未投递；泵 shift FIFO 不变；A3b 恰一条 + 零无关通知、A3 `data` 先于失效信号 | 兑现 |

**用例映射 A1–A9 + NC1–NC6**：行为契约 14 个 `it(`（本轮实数：A1/A2、A7、NC1、A3、A3b、A4、A5、
NC2、A6、A8、A9/NC6、NC3、NC4、NC5）+ 类型契约 3 个 `it(` + 13 条 `AssertTrue`——与 SA6 §12.2
映射全量在场。**§12.5 断言纪律**：零 skip/only/todo/env override（本轮 grep 零命中）、零源码
字符串断言、零通知断言带同订阅后续写屏障（`writeAndAwaitData`）、`expect.poll` 无墙钟竞猜、
注入只经既有 testing seam——**全部遵守**。**§12.6 实现期红线**：① readData/窗口读/复制/诊断/
wire/持久化零 diff ② 注入只在 testing surface + internal 缝，主入口零 re-export ③ 三 kind 逐键
不变 ④ 分发槽外、异常零外泄 ⑤ T2/T3 未顺带实现 ⑥ 真变过滤零削弱（NC2 绿 + #387 21/21 绿）
⑦ B-1 采纳默认绑定无需回写——**全部遵守**。

## 3. ADR 0030 与注入链符合性

| ADR 条款 | 交付行为 | 裁决 |
|---|---|---|
| 决策 3（L38 缺席合法、宽容等待） | 建立六门纯 active schema 侧（L481–518 未动）；簿记冻结 path 快照；A6 横跨缺席期验收落盘（验收缝 L91「含容器删除后订阅横跨重建」兑现） | 符合 |
| 决策 4（L44–53 三 kind 冻结形状；L50 触发源 = 溢出 + 父路径删除；L51 终结三因、数据缺席与删除从不终结订阅；L52 origin 两态；L53 无 version/rev） | 两触发源全部落地（溢出 T1 机制验收化 + 父删/整替新编排）；恰两键 freeze 单点；零 watch-end 编排（T3 范围外）；A9 明断零 version/rev | 符合 |
| 决策 5（宁多勿漏唯一不变量；真变过滤） | `isRealChange` 复用（祖先级 update 同值 plain→plain 过滤、live 载体保守失效）；条目级/无关路径负控 NC2/NC3 绿；判定「加强不削弱」（SA8 §8-2）成立 | 符合 |
| 决策 6（L64–65 槽外异步分发 + throw 隔离；L66 有界、数值不进公共契约、无需 needs-resync；L67 事务级原子 + FIFO） | 泵/挂点/隔离纪律零 diff；数值治理 = 构造参数 + 实现默认（公共面零泄漏，grep + A8 + surface 负锚三重实证）；B-7 清队语义经契约显式授权 | 符合 |
| 决策 7（分层归属；通知不出进程、复制协议零改动） | 检测/降级落 runtime `watch-map.ts` 模块内（零导出变化）；注入控件落 registry 显式 testing surface（registry AGENTS「hostile/test 控件留在显式 testing surface」对齐）；lease.ts 零 diff；复制族零 diff | 符合 |
| 验收缝 L94（队列溢出经 testing 工厂注入小上限 → invalidate-all 且订阅存活） | 见 AC5/AC2 行——注入缝落地 + A1/A2 行为验收 + NC1 反伪绿 | 符合 |

**注入链 7 跳逐跳实读贯通**（全部加法可选字段，无签名/arity/导出变化）：
`testing.ts` overrides（L66–71）→ internal 透传（L177–181）→ `RegistryRuntimeOptions`/
`NamespaceRegistryInternalOptions` 加法字段（registry.ts L241/L465）→ `resolveWatchQueueCapacity`
单点（L205–218，`resolveIdleTimeoutMs` 同款二分；调用位 L826 排 idleTimeoutMs 后、randomBytes
门前——既有门禁文案/顺序零漂移）→ `runtimeOptionsFor` 两条返回路径（L878–900，三处 factory
调用点共享）→ `RuntimeForRegistryDiagnostic`/seam input 加法字段（runtime.ts L130/L910–912）
→ 条件展开（L936–939）+ `captureSeamInput` 捕获与形状门（L1161–1191）→
`createWatchHub(doc, state, captured.watchQueueCapacity)`（L581；undefined 触发缺省参数 = 生产
行为逐字节不变）。`internal.ts` 零 diff（type-guard 冻结面 `Parameters extends [DocHandle,
() => Promise<void>, unknown?]` 不触）。

## 4. 冻结面与影响面核验（本轮 git 实证）

- **零 diff 面**（`git diff --name-only 28faeae..5fdb573` 实读）：`internal.ts`、两包 `index.ts`、
  `lease.ts`、`plugin.ts`、`errors.ts`、`sequencer.ts`/`write.ts`/`schema-write.ts`/复制族/
  `window-read.ts`/`read-schema-projection.ts`/诊断族、全部既有测试（含 `issue-387-*`、
  `packages/namespace-runtime/test/**`）、`docs/adr/0030-*.md`、`CONTEXT.md`、
  `docs/protocols/instance-replication-v1.md`、`vitest.config.ts`、两包 `package.json`、
  `tsconfig*.json` —— 交付 diff 恰 5 源文件 + 3 新测试 + wiki 产物，DENY 面零命中。
- **九项冻结面**：三 kind 形状（恰两键/三键 + 定位符两键，A9/NC6 + 类型面）／队列数值不进
  公共契约（grep 4 内部文件边界）／lease 16 键（A8 硬编码清单）／`WATCH_MAP_*` 码族（仍恰
  CARRIER_MISMATCH + SCHEMA_UNAVAILABLE 两码，append-only）／复制 wire 与 needs-resync（零触）
  ／写序列器单 FIFO 与槽序（泵原样、A7 同步段零回调）／internal seam arity（type-guard 不触）
  ／谓词与 watch-end 词表（`where` 缺席；`watch-end` 仅类型联合 + 边界注释各一处，本轮 grep
  实证 src diff 中唯一命中为 T3 非目标注释行）／文档缝（T5 #391，零 diff）——**全部未变**。
- **scope creep 核验**：无 T2 谓词/`WATCH_MAP_OPTIONS_INVALID`、无 T3 watch-end 编排/复制 origin
  验收、无 T5 文档、无新公共 API/新 testing 子路径/第二 seam；A5 整替纳入为 SA6 B-4/G-3 +
  SA8 §8-2 + SA1 裁决② 的**预授权扩展**（非静默扩张，见 §7 披露）。

## 5. 证据链核验（红 → 绿）——本轮日志 tail 复核

本任务 SA3/SA6 会话日志在 worktree **未跟踪区在场**（`artifacts/sa3-issue390-*.log` 22 份 +
`sa6-issue390-*.log` 8 份），SA10 不运行测试但对原始日志做了 tail/grep 级复核：

| 证据 | 记录值 | 本轮复核结果 |
|---|---|---|
| 红灯行为（回退 5 实现文件、测试三件套不动） | 8 failed / 6 passed (14) | 日志实证 `Tests 8 failed | 6 passed (14)`；红集合 = A1/A2、A7、A3、A3b、A4、A5、A6、A9（SA3/SA4 记录与 SA6 两条独立红因机械吻合：注入面 + 通知面） |
| 红灯类型 | 恰 2 错 | 日志实证恰 TS2339（surface L25 索引访问）+ TS2353（L84 对象字面量）两条，均为注入位缺席——与 SA6 类型探针同构 |
| 绿灯行为 | 14/14 | 日志实证 `Tests 14 passed (14)`、exit 0；确定性复跑 ×3 均 `14 passed`（grep 计数 = 3） |
| 绿灯类型契约 | 3 passed + no errors | 日志实证 `Tests 3 passed (3)`、`Type Errors no errors` |
| #387 T1 回归 | 21/21 | 日志实证 `Tests 21 passed (21)` |
| 受影响两包全量族 | 95 files / 1020 tests | 日志实证 `95 passed (95)` / `1020 passed (1020)` |
| 根 typecheck / 测试树 tsc | exit 0 | 根 typecheck 日志含全部 14 个 tsconfig 链式命令；测试树 tsc 日志零输出（exit 0 形态） |

红→绿因果链完整：红灯经「备份 → `git checkout -- <5 路径>` → 跑红 → trap 还原 → sha256/cmp
校验」路径采集（`sa3-issue390-red-recheck.sh` 在场可复跑），还原后实现产物与复核前逐字节一致；
红/绿两侧测试三件套同修订。红灯失败集合恰为两条独立缺口、六例基线绿（NC1/NC2/A8/NC3/NC4/NC5）
未被伪称红灯——AC4（A6 红因 = 删除信号缺口，其「重建后 data」段落为基线绿）诚实区分，
与 SA6 §11-H7/§13 一致。

## 6. MINOR 观察（不阻断 approve）

1. **M-1**：D5 两道 fail-loud 容量门（registry TypeError/RangeError 二分 + seam 统一 TypeError）
   无任何测试锚定——超出 SA6 契约断言面（§15-4 明示契约只要求 `1` 被兑现），SA1 裁决④授权的
   加门（方向 = 加门不缩面）；动态锚定属 SA7 自由裁量（SA3 延项 / SA4 O1 / SA8 观察 2 三方记录一致）。
2. **M-2**：容器**创建**事务（`add` 旁路）对持「缺席视图」的消费方零信号、重建事务内物化的种子
   条目不产生通知——T1 N4 未钉边界 + 设计最小噪声档裁决；A6/A3b 不钉重建事务 kind（设计 §13 残余、
   SA2 M3、SA8 观察 1 显式记录）。宁多勿漏允许多发，本交付取最小噪声档，如消费方有需求须新 AC。
3. **M-3**：`origin:'replication'` 的结构性失效/溢出降级保真无契约断言（本任务契约仅断 local）——
   T3 #389 范围（SA4 §11 后续动态验证项）；实现侧 `classifyOrigin` 无过滤两态在产（T1 既有）。
4. **M-4**：surface 负锚 `_testingOverridesNotOnMainEntry` 只能拦截值域 re-export（类型名结构性
   不可能出现在 `keyof typeof`），语义偏弱——已由 A8 行为锚 + index.ts 零 diff 互补（SA4 O4）。
5. **M-5**：fixture 绑定单点命名为 `watchQueueCapacityOverride()` + `WATCH_QUEUE_CAPACITY_INJECTED`，
   与设计 D1 速写 `WATCH_TEST_INJECTION_BINDING` 不同——功能等价、字段名仍单点收敛（SA4 O2）。
6. **M-6**：`registry.ts` L199 注释残句「testing 控件注入值经内部分组成。」语序不完整（SA4 O3）；
   测试不 release lease/不 shutdown registry 与 #387 fixture 惯例一致（SA4 O5）；证据日志未入
   交付 commit（未跟踪在场、本轮已复核——与 #387 M-6 同类但程度更轻：日志可核）。

## 7. PR 必须披露的未达成/边界项（均非本票 AC 缺口，为已裁决分期与已知边界）

- **分期义务（各有其票，本票按设计不交付）**：T2 #388 谓词 `where` 词表 +
  `WATCH_MAP_OPTIONS_INVALID`；T3 #389 `watch-end` 两 reason 编排 + `origin:'replication'`
  复制 apply 验收；T5 #391 文档词条面。
- **A5 整替触发为预授权扩展**：issue AC3 字面仅「父级删除」，交付将容器整替（祖先级 update、
  旧子树消失）纳入失效触发——依据 SA6 B-4/G-3 红证据 + SA8 §8-2 明文「容器创建/删除/整替」+
  SA1 裁决② + SA2 §3 核验，非静默扩张；同值 plain→plain 整替经 `isRealChange` 过滤不噪声化。
- **创建信号不钉（M-2）**：`add` 旁路 = T1 逐字节行为；重建后条目变更照常 `data` 到达为 AC4
  承重断言，已满足。
- **D5 容量门无契约断言锚（M-1）**：非法值（0 / '1' / 1.5）构造期 TypeError/RangeError 已实现
  但无动态测试锚定，SA7 可自选补锚。
- **验证范围边界**：全仓 `pnpm test`（domains/apps 等非受影响面）未运行——受影响两包全量族
  1020/1020 + 根/测试树 typecheck exit 0 已绿（SA3 延项，属 SA7 最终验收面）；证据日志未入
  交付 commit（worktree 未跟踪区在场，本轮已 tail 复核）。
- **流程事实披露**：前序 SA3 尝试以 Host observer/schema failure 结束且无业务 verdict；现行
  SA3 报告为同 worktree 实现的独立复核 + 完成记录（红/绿证据独立重推、sha256 还原校验），
  本轮日志复核与其记录一致。

## 8. Verdict

**approve** —— 交付忠实满足 issue #390 正文（What-to-build + AC1–AC6）、SA6 验收契约
（B-1–B-7 全兑现、A1–A9/NC1–NC6 全量在场、§12.5 断言纪律与 §12.6 红线全遵守）与 ADR 0030
决策 3/4/5/6/7 + 验收缝 L91/L94；无遗漏、无部分实现、无错误实现、无 scope creep；非目标
（T2/T3/T5、复制面、sequencer 槽序）零越界、九项冻结面零 diff（本轮 git 实证）；红→绿证据链
日志级互洽（红 8 failed/6 passed + 恰 2 类型错 ↔ 绿 14/14 + 3/3 + 复跑 ×3 + #387 21/21 +
两包 1020/1020 + 双 typecheck exit 0）。仅存 6 条 MINOR 观察与 §7 已裁决披露项，均不阻断。
