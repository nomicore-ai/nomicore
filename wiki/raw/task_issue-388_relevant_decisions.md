# SA8 前置门禁 · 相关决策摘录 — issue #388：谓词订阅与宁多勿漏判定（变更订阅 T2）

- 任务简报：`wiki/raw/task_issue-388.md`（issue #388，state OPEN，评论 0——本轮 `gh` 复读确认）
- 本文件性质：**只摘录相关决策、条款与关联点**，不改写原义、不作业务设计。冲突裁决见
  `wiki/raw/task_issue-388_conflict_report.md`。
- 决策集状态：`docs/adr/` 全 28 篇均「已接受」；0007 / 0016 / 0024 为**部分**被修订
  （0008 / 0027），被取代条款与本任务无接触面；无整篇 superseded 的 ADR。
- 现状事实（源码核验，非决策文本）：T1（#387）已合入 HEAD `28faeae`；
  `watchMap(path, listener)` 无 options 参数、`WATCH_MAP_OPTIONS_INVALID` 未注册
  （`watch-map.ts` L36–38 / `errors.ts` L241–255 / `types.ts` L490–493 明文预留 T2 加法位）。

---

## 1. ADR 0030（变更订阅）——本任务规范权威（简报自锚「决策 2 / 5」）

`docs/adr/0030-change-subscription.md`，已接受 2026-09-14，影响包
`@nomicore/namespace-runtime`、`@nomicore/namespace-registry`；**既有 readData / 窗口读 /
复制面零改动**（状态行）。

### §1 公共面（L14–18）

- `watchMap(path, { where? }) → { unsubscribe }`——键容器变更订阅；`unsubscribe` 幂等，
  主动退订零通知；
- 载体面 = 键容器（`Y.Map` 载体 + plain object 容器，对齐 `readMap` 定义）；无谓词形态在场；
- 订阅是 lease 的调用方 capability：lease 释放即全部清理。
- 关联点：ADR/CONTEXT/issue 四处 `watchMap(path, { where? })` 均为**省略回调位的简写**；
  T1 设计 §7-B2 已冻结具体绑定 `watchMap(path, listener, options?)`（options 槽位为 T2
  预留加宽位）。

### §2 谓词词表（L20–31）——本任务主条款之一

- L23–25 词形（封闭小集，机制而非策略）：
  `where?: { field: string; equals: ScalarValue } | { field: string; in: ScalarValue[] }`；
- L27：`field` 限定**单段属性名**（对齐窗口读 `field` 约束与 guard `equals` 词形）；值域恒
  **标量**（string / number / boolean / 字面量）；
- L28：缺失 / null **恒不匹配**，所有算子一视同仁——`notEquals` 不在词表，NULL 三值逻辑
  不存在；「缺失也算」须在 schema 显式建模（如 `'none'` 字面量）；
- L29：`in` 为**集合语义**（顺序无关、去重）；**空数组响亮拒绝**（恒不匹配的订阅是配置
  错误，对齐 `WINDOW_OPTIONS_INVALID` 的规则非法拒绝风格）；
- L30：不做 `and` 组合；key 级过滤不进词表（通知 key 随行，消费方一行 filter）；
- L31：**新增算子属词表演进，须过设计评审**（guard / 窗口读同款治理）。

### §3 建立时判定（L33–39）

- L35：无 active schema 的 namespace **整体不可用 watchMap**（含无谓词形态）；
- L36：path 非键容器（偏离 schema / 数组载体）→ `WATCH_MAP_CARRIER_MISMATCH`（message
  区分原因）；
- L37：谓词非法（**field 不存在 / 非标量域 / `in` 空数组**）→ `WATCH_MAP_OPTIONS_INVALID`；
- L38：**数据缺席合法**——schema 已声明的容器未物化/已删除均可订阅（订阅是机制不是数据
  快照；读对缺席报错 `WINDOW_TARGET_ABSENT`，订阅宽容等待）；
- L39：**全部参数校验在建立时刻完成——建立后通知流零参数错误**。

### §4 通知流（L41–53）

- 三 kind 闭集：`data`（`changes: [{path, key}]` 定位符列表 + origin，同事务同 key 合并）/
  `invalidate-all` / `watch-end`（`reason: 'schema-changed' | 'doc-replaced'`）；
- `origin: 'local' | 'replication'`；无 `version` / `rev` 字段。
- 关联点：T2 只交付谓词判定，**通知形态零触碰**；`watch-end` 编排属 T3（#389）。

### §5 判定纪律：宁多勿漏（唯一不变量，L55–60）——本任务主条款之二

- L57 通知条件：条目**投影值**真变（同值 set 的载体 delta 被语义投影比较过滤——实测同值
  set 仍产生 Yjs update delta）∧（**无谓词 ∨ 新旧匹配态任一成立 ∨ 旧态不可判时保守通知**）；
- L58：漏 = 消费方永久持有过时数据（不可接受）；多 = 多拉一次（可接受）。通知语义收窄为
  一句话承诺「这个位置的条目状态可能与你所知不同」——不承诺方向、不承诺真变了；
- L59 旧态不可判来源：嵌套 `Y.Map` 部分更新时容器浅 delta 无条目级 oldValue；**plain object
  条目恒整值 set、oldValue 恒在场、判定恒精确**；
- L60 消费协议（v1，无对账）：建立后先全量拉一次，之后按 key 幂等拉终态自辨——在场则更新
  视图、不在场则删。

### §6 分发（L62–67）

挂点 = 写序列器事务提交后异步分发（沿诊断日志「sequencer slot 之外」纪律）；回调 throw
静默隔离；有界队列溢出 → `invalidate-all`；**数值不进公共契约**。
关联点：T2 谓词求值进通知推导路径，须维持槽外与零 throw 纪律。

### §7 分层与契约归属（L69–73）

runtime：订阅簿记、**谓词求值**、宁多勿漏判定、异步分发与有界队列；registry：lease 公共面、
类型别名与透传；**通知不出进程：复制协议（instance-replication-v1）零改动**。

### 备选（已否决，与本任务直接相关）

- L78 **effect 三态分型（entered / left / changed）已否决**——布尔判定 + 消费方拉终态自辨；
- L82 `notEquals` / `and` / key 过滤进词表已否决；
- L83 数组载体 v1 已否决（`watchArray` 属 v2）；
- L84 订阅目标缺席响亮拒绝已否决（读报错、订阅宽容等待）；
- L85 **schema 变更作为通知 kind 已否决**——谓词在 schema 变更下静默存活的最坏结局是
  field 缺失恒不匹配的静默死亡；正解 = `watch-end` 终止 + 消费方重建（T3 #389 交付）。

### 验收（缝，L88–97）

- L90 主缝 = **lease 公共面**（`@nomicore/namespace-registry` 契约测试家族）；
- L91 建立判定矩阵（含谓词非法三情形 → `WATCH_MAP_OPTIONS_INVALID`、数据缺席可订阅）；
- L93 判定纪律矩阵：同值写不通知、嵌套变更保守通知（宁多勿漏矩阵）、**退出匹配集通知**、
  无谓词全通知；
- L96 先例 = 窗口读（issue #369）lease 契约三件套（fixture / red / surface）；
- L97 文档缝：「变更订阅」词条锚定，无与 subscribeOwnedUpdates / 诊断日志 / RegistryObserver
  混用措辞（T5 #391 交付）。

## 2. ADR 0028（窗口读）——词形 / 错误风格 / 测试先例

`docs/adr/0028-window-read.md`，已接受。

- L21：`readMap(path, { n, orderBy?, depth?, maxChildrenPerNode? })`——键容器窗口（**Y.Map
  与 plain object**，即 watchMap 载体面定义来源）；
- L31：orderBy 值属性基 `field: string`——**v1 恰单段**；
- L66–67：`WINDOW_CARRIER_MISMATCH`（载体不符）/ `WINDOW_OPTIONS_INVALID`（**规则非法**
  ——n=0、非法枚举、readArray 传 field、readMap 传 `by:'index'` 等）错误风格；
- 关联点：ADR 0030 §2 明文「对齐窗口读 `field` 约束」「对齐 `WINDOW_OPTIONS_INVALID` 的
  规则非法拒绝风格」；lease 契约测试三件套先例（ADR 0030 验收 L96 复引）。

## 3. ADR 0025（条件写 guard）——`equals` 词形先例

`docs/adr/0025-guarded-mutation-conditional-write.md`，已接受。

- L25：guard 单条件对象 `{ path, equals }` / `{ path, absent }`——**封闭词表、机制而非策略**；
- L42：guard `equals` 与投影逻辑值结构深相等（undefined 键过滤）。
- 关联点：ADR 0030 §2 L27 明文「对齐 guard `equals` 词形」——`where.equals` 词形对齐、
  语义域收窄为恒标量（ADR 0030 自有冻结，非沿用 guard 的结构深相等全域）。

## 4. ADR 0008（Runtime 能力与 sequencer）——订阅授权语境与稳定码注册

`docs/adr/0008-namespace-runtime-read-write-capabilities-and-sequencer.md`，已接受。

- L101：「v1 不提供公共事件订阅；队列进度和内部事件属于日志、metrics 与 trace」——语境为
  **status 可观测性段**；T1 SA8 设计后复审已裁窄读：ADR 0030 为**后法特定授权**的业务数据
  信号面（三 kind 闭集、无队列进度/内部事件夹带），谓词形态在同一 §1 公共面内；
- 词汇收口注册节（L121–131）：稳定码以 `errors.ts` append-only 注册表为准，区分域靠
  message；既有码零改动。
- 关联点：T2 新码 `WATCH_MAP_OPTIONS_INVALID` 按同一注册纪律 append-only 追加。

## 5. ADR 0009（Registry / lease 生命周期）

`docs/adr/0009-namespace-registry-leases-and-host-lifecycle.md`，已接受。
lease = 调用方 capability；释放幂等；ADR 0030 §1 L18 在其上加「lease 释放即全部订阅清理」。
关联点：谓词订阅同生命周期，无独立生命周期面。

## 6. ADR 0023（冻结服务表面）——构造纪律范围

`docs/adr/0023-proxy-consumable-frozen-service-surfaces.md`，已接受。

- L45：凡经 `ctx.provide` 发布的服务对象，函数成员一律以**访问器属性**构造（构造纪律冻结）；
- L41：**服务方法的返回值（`NamespaceLease`、`ReplicationSession` 等）……不受影响**。
- 关联点：T2 的 options 参数与谓词类型落在 lease 返回值面与 runtime 模块内，冻结服务字面量
  （registry.ts）零触碰。

## 7. readData 面（ADR 0016 / 0024 / 0027）——零改动义务

已接受（0016 / 0024 的交付形态条款由 0027 修订：恒四键 `{ok, value, schema, truncated}`、
截断事实唯一载体 = 投影文本 ✂ 段）。ADR 0030 状态行明文「既有 readData / 窗口读 / 复制面
零改动」。关联点：简报消费协议（消费方拉终态自辨）使用既有拉面，零读面改动。

## 8. 复制 wire（ADR 0010 / 0013 / 0022 + `docs/protocols/instance-replication-v1.md`）——零改动

已接受；wire 冻结值以协议文档为唯一权威。本轮 grep 复核：协议文档全树零 `watchMap` /
`where` 名目。ADR 0030 §7 L73：通知不出进程。关联点：简报零复制接触。

## 9. 诊断变更日志（ADR 0011 / 0014）——不混用纪律

已接受；best-effort 观测、emit 永不抛、生命周期调用点在 sequencer slot 之外。ADR 0030 背景
明文诊断日志不可复用为通知通道；验收 L97 禁混用措辞。关联点：T2 零诊断接触。

## 10. schema 生命周期（ADR 0017 / 0018）——邻接面

已接受。active schema 判定（T1 已落 `resolveSchemaAtPath` 纯 schema 侧路径）依赖 schema
生命周期；Peer re-arm 触发 `watch-end: 'schema-changed'` 属 T3（#389）。关联点：T2 建立判定
沿用 T1 既有 schema 门，不得引入 live 载体探测（否则违反「数据缺席合法」）。

## 11. CONTEXT.md 术语

- L65–67「**变更订阅（change subscription）**」：词条全文与 ADR 0030 同口径——谓词词表
  `equals`/`in` 恒标量、缺失/null 恒不匹配、建立判定全由 active schema、数据缺席合法、
  宁多勿漏（通知条件原式）、一事务一通知、origin 两态；`_Avoid_`：泛 watch / push / 事件流、
  把订阅当快照或增量日志、**effect 分型 entered/left/changed**、version/rev 序号、与
  subscribeOwnedUpdates / 诊断日志混用；
- L61–63「窗口读（window read）」：键容器定义（Y.Map 与 plain object）、`field` 单段、
  `WINDOW_*` 三错误码先例。

## 12. 模块 AGENTS 决策面

- `packages/namespace-runtime/AGENTS.md`：单一严格 FIFO 与槽序不变；**reads stay outside
  that sequencer**；公共 API 只暴露 detached projections（live Y.Doc / sequencer 内部件不外泄）；
- `packages/namespace-registry/AGENTS.md`：lease = 独立调用方 capability；公共 API 仅经
  `src/index.ts`；test controls 走显式 testing surface。
- 关联点：谓词求值 = 观察器内纯读（零槽位、零 throw 红线沿 T1）；registry 面新增
  options / 别名走 `src/index.ts` 导出面。

## 13. 分期边界（T 家族，evidence 非规范）

issue 家族：T1 = #387（已合入 HEAD `28faeae`）、**T2 = #388（本任务）**、T3 = #389
（`watch-end` 编排 + `'replication'` 验收断言）、T4 = #390（溢出注入 + 父路径删除编排）、
T5 = #391（文档缝）。T1 设计 §7-B2 冻结 options 加宽路径：`watchMap(path, listener,
options?: NamespaceRuntimeWatchMapOptions)` 纯加法；T1 SA8 设计后复审登记分期义务
「**T2/T5 签名简写对账**」。
