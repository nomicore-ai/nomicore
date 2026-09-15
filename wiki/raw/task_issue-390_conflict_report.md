# SA8 前置门禁冲突报告 — issue #390：溢出降级与父路径删除（变更订阅 T4）

- 复审对象：**task**（issue #390 任务简报 vs 决策全集；任何 SA 派发之前）
- 复审轮：iteration 0（dispatch `sa-98041de3-d7c4-4320-a5d8-bfccc38502ff`；分支 `mabf/issue-390`，HEAD `28faeae`）
- 结论速览：**verdict = clear**；11 项对照 = 5 × implements-existing-decision + 6 × no-conflict；**0 hard-conflict；0 override；0 evolution-required**；**requiresConflictRecheck = true**（通知面失败语义与 testing 面增量尚待实现核对）。

## 1. Reviewed subject

**task**。被审对象 = issue #390 全文（What to build + 6 条 Acceptance criteria + Blocked by），基准 = 任务简报快照 `wiki/raw/task_issue-390.md`。T4 范围 = 在 T1（#387，已合入）之上补齐：溢出的 testing 注入与验收、父路径删除编排、订阅横跨缺席期验收。不审设计（SA1 未产出）、不评优劣与测试充分性。

## 2. Inputs and decision set

- 输入：`wiki/raw/task_issue-390.md`、`CONTEXT.md`、`docs/adr/` 全集（28 篇全部「已接受」；无被 supersede 的在约束 ADR——0016/0024 修订谱系属 readData 投影面，与本任务无关）、协议文档边界（instance-replication-v1 经 ADR 0030 §7 声明零改动）、模块 AGENTS 契约（runtime/registry）。
- 规范权威：`docs/adr/0030-change-subscription.md`（已接受）决策 4 / 6（issue 自称，经查证条款在库）。
- Owner 评论：REST `issues/390/comments` = **0 条**（无任何 override 载体）。
- 相关决策摘录：`wiki/raw/task_issue-390_relevant_decisions.md`（同轮产出）。

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0030 决策 6 | 「有界队列……**数值不进公共契约**——语义进契约，数值是构造参数 + 实现默认」（L66） | AC1：上限 = 构造参数 + 实现默认，数值不进公共契约 | implements-existing-decision | 机制已在 T1 落地：`watch-map.ts` L98（默认常量 16）+ L365–369（构造参数位）；注入与「数值不进契约」的验收兑现属 #390（ADR 0030 验收 L94 明文要求） | 设计须把容量保持为 runtime 构造参数 + 实现常量；不得进入 lease 公共面 / 公共类型 / 文档契约 |
| ADR 0030 决策 4 | 「`invalidate-all`（订阅存活）：触发源 = 通知队列溢出、**父路径删除**」（L50） | AC2/AC3：溢出 → `{kind:'invalidate-all', origin}` 且订阅存活；父级删除 → `invalidate-all`、订阅存活 | implements-existing-decision | 溢出半边 T1 已实现（`watch-map.ts` L397–413：清队 + 单条 invalidate-all，origin = 触发事务 origin）；父路径删除半边**未实现**——C-3 分支明文「父路径删除编排属 T4 #390——落入『无命中』分支」（L286–287），当前父删产出零通知 | 设计须补容器级（父路径）事件的失效编排；形状只准 `{kind:'invalidate-all', origin}` 两键 |
| ADR 0030 决策 3 + 决策 4 | 「数据缺席合法……订阅对缺席宽容等待」（L38）；「数据缺席与删除**从不**终结订阅」（L51）；备选已否决「缺席响亮拒绝」（L84） | AC4：订阅横跨缺席期——容器删除后重建，条目变更照常以 `data` 到达 | implements-existing-decision | 建立判定纯 active schema 侧、零 live 载体探测（`watch-map.ts` L440 注）；簿记为冻结 path 快照，结构上已横跨缺席；跨重建验收（ADR 0030 验收 L91「含容器删除后订阅横跨重建」）待 #390 兑现 | 实现不得引入任何数据在场性假设（建立/通知两处）；重建后 `data` 恢复不得要求消费方重建订阅 |
| ADR 0030 验收（缝） | 「队列溢出（**testing 工厂注入小上限**）→ `invalidate-all` 且订阅存活」（L94） | AC5：经既有 testing 工厂 overrides 注入小上限触发（零新接缝） | implements-existing-decision | 工厂在场：`registry/src/testing.ts` `createNamespaceRegistryForTesting` + `NamespaceRegistryTestingOverrides`（L36–64，现无 watch 容量位）；`runtime.ts` L576 尚未传容量；T1 冻结注「单参数位使 T4 #390 的 testing 工厂注入为纯加法」（`watch-map.ts` L96–97） | 加法式新增 override 字段并经 internal 装配缝（`registry.ts` L800–802 缺省 runtimeFactory）接线；**不得**新开第二 testing seam 或公共 API |
| ADR 0030 决策 6 | 「挂点 = 写序列器事务提交后**异步分发**……回调 throw 静默隔离」（L64–65）；「沿诊断日志『sequencer slot 之外』纪律」 | AC6：溢出不阻塞写路径；降级信号分发同样在写序列器槽之外 | implements-existing-decision | T1 泵已槽外（单飞微任务 + 每项 20 让步，listener 全部移出事务栈，`watch-map.ts` L318–341）；溢出处理为观察器内有界同步操作（清队 + 入队，零 await、零 throw 外泄 L374–392）；#390 兑现降级路径同纪律的验收 | 降级信号入队/分发复用既有泵；不得引入 sequencer 内 await、不得让通知异常改变写结果 |
| ADR 0030 决策 6 + 决策 7 | 「无需 ReplicationSession 的 needs-resync 重协商」（L66）；「通知不出进程：复制协议零改动」（L73） | 简报措辞：溢出自愈不触发 needs-resync 重协商 | no-conflict | issue 仅作对照陈述，未提议触碰 ReplicationSession / instance-replication-v1；ADR 0010 L113/L151 的 needs-resync 属复制 raw-bytes 面（独立决策线），#390 零涉 | 保持零涉：不得在 watch 溢出路径挂任何复制状态标记 |
| ADR 0030 决策 7 | 「runtime：……异步分发与有界队列；registry：lease 公共面、类型别名与透传」（L71–72） | AC1/AC5 的注入归属：容量参数落 runtime 构造、注入经 registry testing 面 | no-conflict | registry AGENTS「hostile/test 控件留在显式 testing surface」；生产装配经 internal seam（ sanctioned）；注入是 testing-only 控件，不扩 lease 透传面 | 设计须声明注入只经 testing surface + internal 装配缝，主入口不 re-export |
| ADR 0008 | 「唯一严格 FIFO write sequencer……读取不进 sequencer」（L38–57）；槽序 gate→snapshot→transaction→notifyDirty | AC6 的槽序不变量：通知分发不得成为 sequencer 任务或改变槽序 | no-conflict | T1 挂点为 ROOT.observeDeep（事务提交后回调）+ 槽外泵；#390 不新增 sequencer 内步骤；ADR 0030 §6 明文沿此纪律 | 无额外动作（实现后复查核对 diff 未触碰 sequencer/槽序） |
| ADR 0011（+ ADR-0014-LOG amendment 调用点纪律） | 「emit……不被 await」「调用点必须位于 write sequencer slot 之外或之后」（L123–128、L159）；日志失败不改变写结果（L20） | AC6「降级信号的分发同样在写序列器槽之外」= 同款调用点纪律在通知面的援引 | no-conflict | ADR 0030 §6 明文「沿诊断日志纪律」；既有 fanout 泵先例（replication-session `FANOUT_DELIVERY_DEFERRAL_MICROTASKS`）同构复用 | 无额外动作 |
| ADR 0030 决策 2 / 决策 4 | 谓词词表封闭（L20–31）；`watch-end` 终止编排（L51）——分属 T2 #388 / T3 #389 | #390 未触碰谓词与 watch-end（范围切分边界） | no-conflict | issue AC 六条无谓词/watch-end/schema-changed/doc-replaced 项；T1 边界注同样把 T2/T3/T4/T5 分开（`watch-map.ts` L36–38） | 设计不得顺手实现 T2/T3 面；若实现中发现不可回避的耦合，回报总控而非扩张范围 |
| CONTEXT.md「变更订阅」词条（L65–67） | 术语与 _Avoid_ 清单 | 简报用词：有界、溢出降级、`invalidate-all`、订阅存活、宁多勿漏、全量重拉自愈 | no-conflict | 全部与词条一致；未使用 observer/推送/含值/effect 分型/version 等撞词或已否决概念；「消费方全量重拉一次即自愈」= 消费协议 v1（ADR 0030 L60）原义 | 无额外动作 |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无合法 override 在场：issue 评论 0 条（REST 复核 = 0）；无新 ADR 修订/废弃 ADR 0030；无协议版本升级；ADR 0030 决策 4/6 亦无自携演进条款被援引。任务本身也不请求任何 override——它兑现 ADR 0030 而非修改它。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| 通知三 kind 冻结形状 | `{kind:'data',origin,changes}` / `{kind:'invalidate-all',origin}` / `{kind:'watch-end',reason}`；不得加 kind/字段（无 reason、无 version/rev） | ADR 0030 L44–53、L79（version/rev 已否决）；CONTEXT L66 | #390 只引用既有形状（AC2 原文即 `{kind:'invalidate-all', origin}`）——未变 |
| 队列数值不进公共契约 | 容量数值不出现在 lease 公共面/公共类型/契约文档；testing override 属测试控件面非公共契约 | ADR 0030 L66；`watch-map.ts` L94–98；registry AGENTS（testing surface） | AC1 明文「数值不进公共契约」——一致；实现后须核对未泄漏 |
| `watchMap` lease 公共面 | `watchMap(path, { where? }) → { unsubscribe }`；registry 只透传 | ADR 0030 L14–18、L72 | #390 AC 无一触碰签名——未变 |
| `WATCH_MAP_*` 错误码族 | append-only 注册；不删不改既有码；#390 无新错误条件则零新码 | `errors.ts` L241–255 | #390 未提出新错误码——未变 |
| 复制 wire 与 needs-resync 语义 | instance-replication-v1 / ReplicationSession `needs-resync` 全不变（通知不出进程） | ADR 0030 L73、L66；ADR 0010 L113/L151 | #390 明文不触发重协商、零复制面改动——未变 |
| 写序列器单 FIFO 与槽序 | 通知分发恒在 sequencer slot 之外；槽序与写结果不被通知面改变 | ADR 0008 L38–57；ADR 0011 L20/L159；ADR 0030 L64–65 | AC6 即该纪律的复述——一致 |
| 谓词词表与 watch-end 词表 | `equals`/`in` 恒标量；watch-end 两 reason——T2/T3 范围，#390 零涉 | ADR 0030 L20–31、L51 | 未触碰——未变 |

## 6. Evolution requirements

无 `evolution-required` 项。#390 不请求修改任何 ADR、CONTEXT 词条或协议文档：全部行为均由已接受的 ADR 0030（决策 3/4/6、验收缝）+ 既有纪律（ADR 0008/0011）直接授权。文档面（词条锚定、「变更订阅」措辞）属 T5 #391 范围，#390 无文档演进义务。

## 7. Hard conflicts

无。11 项对照全部为 no-conflict 或 implements-existing-decision；未发现与任何已接受决策不兼容且无 override 的行为。

## 8. Required actions（对下游的非阻塞约束，均为既有决策的兑现要求）

1. **注入路径（AC5）**：容量注入只经 `NamespaceRegistryTestingOverrides` 加法式新字段 + internal 装配缝（`registry.ts` 缺省 `runtimeFactory` / `runtime.ts` L576 接线）——「纯加法」是 T1 冻结注的既定路线；不得新开公共 API 或第二 testing seam。
2. **父路径删除编排（AC3/AC4）**：失效信号形状恒 `{kind:'invalidate-all', origin}`；与在队/在途 `data` 通知的相对顺序须保 FIFO（ADR 0030 L51 watch-end 统一进流的同一理据）；容器删除→重建→`data` 恢复不得要求重建订阅；判定纪律维持宁多勿漏（C-3 现状「无命中」改判为失效信号属**加强**，不得同时削弱既有真变过滤）。
3. **槽外红线（AC6）**：溢出降级（清队 + 入队 invalidate-all + 泵调度）保持观察器内有界同步操作；零 sequencer 内 await；通知异常零外泄（`watch-map.ts` 零-throw 硬红线维持）。
4. **实现后复查清单（本轮布防）**：① testing override 字段未泄漏进公共契约/主入口导出；② 默认容量仍为实现常量（对照 ADR 0010 L267 复制 fanout 的冻结常量是**相反**纪律，不得互相套用）；③ 三 kind 形状逐键未变；④ 父删/溢出两触发源均「订阅存活」（簿记不摘除）；⑤ sequencer/槽序 diff 零触碰；⑥ 复制面零改动；⑦ T2/T3 范围未被顺带实现。

## 9. Verdict

**clear**。任务要求全部落在已接受决策（ADR 0030 决策 3/4/6 + 验收缝）授权范围内：5 项为既有决策尚未兑现义务的实现（implements-existing-decision），6 项完全遵守（no-conflict）；0 hard-conflict、0 需修订的决策面、0 缺失证据。前置门禁放行，SA 派发可进行。

## 10. requiresConflictRecheck

**true**。理由：#390 兑现的是通知面的**失败语义**（溢出降级、结构性失效）并新增 testing 面增量与父删编排状态——按纪律，失败语义/testing 面尚待实现核对时置 true；设计后复审与实现后复查应按 §8-4 清单逐项闭合后再落 false（先例：T1 #387 设计复审 true → 实现复查闭合 false）。
