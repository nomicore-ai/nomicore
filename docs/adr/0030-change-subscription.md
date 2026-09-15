# ADR 0030：变更订阅——watchMap 的键容器变更信号

日期：2026-09-14（设计敲定：本仓 grill 会话；spec 见 issue #385）
状态：已接受（影响包 `@nomicore/namespace-runtime`、`@nomicore/namespace-registry`；既有 readData / 窗口读 / 复制面零改动）

## 背景

消费方（DSH 会话中的 agent、宿主应用 UI）至今只有纯拉模式：`readData` / 窗口读没有变更信号面。agent 要么每次访问全量重拉（浪费对话上下文）、要么使用上下文里的过时数据（正确性风险）；UI 没有失效信号只能轮询。既有三条"变更流"各有其主，不能复用：`ReplicationSession.subscribeOwnedUpdates` 交付 raw Yjs bytes 且仅给可信 transport；诊断变更日志（ADR-0011/0014）是离线 best-effort 观测；Registry 内部 observer seam 是 lifecycle 故障诊断（明确"v1 无 public subscription"）。缺的是**语义定位的、面向业务消费方的实时变更信号面**。

两个消费场景经会话收敛为同一条原则：**通知 = 信号，不含值**——agent 与 UI 都由自己的刷新逻辑决定刷新范围；通知的全部价值浓缩为定位地图的质量（消费方拿定位符可直接拼路径精准补拉，而不是退化为全量重拉）。

## 决策

### 1. 公共面：lease 层订阅方法

- `watchMap(path, { where? }) → { unsubscribe }`——键容器变更订阅；`unsubscribe` 幂等，主动退订不产生任何通知；
- 载体面 = **键容器**（`Y.Map` 载体 + plain object 容器，对齐 `readMap` 定义）；无谓词形态在场（UI 基础用法）；
- 订阅是 lease 的调用方 capability：lease 释放即全部清理。

### 2. 谓词词表（封闭小集，机制而非策略）

```ts
where?: { field: string; equals: ScalarValue }
      | { field: string; in: ScalarValue[] }
```

- `field` 限定单段属性名（对齐窗口读 `field` 约束与 guard `equals` 词形）；值域恒**标量**（string / number / boolean / 字面量）；
- 缺失 / null **恒不匹配**，所有算子一视同仁——`notEquals` 不在词表，NULL 三值逻辑不存在；需要"缺失也算"的建模在 schema 里显式建模（如 `'none'` 字面量）；
- `in` 为集合语义（顺序无关、去重）；**空数组响亮拒绝**（恒不匹配的订阅是配置错误，对齐 `WINDOW_OPTIONS_INVALID` 的规则非法拒绝风格）；
- 不做 `and` 组合（组合需求 = 多个单谓词订阅，消费方按 key 求交集——交集状态本就是消费方视图的一部分）；key 级过滤不进词表（通知 key 随行，消费方一行 filter）；
- 新增算子属词表演进，须过设计评审（guard / 窗口读同款治理）。

### 3. 建立时判定：全部由 active schema 完成

- **无 active schema 的 namespace 整体不可用 watchMap**（含无谓词形态）——机制由 schema 定义，避免"谓词要 schema、无谓词不要"的分裂行为；
- path 在 schema 中非键容器（偏离 schema / 数组载体）→ `WATCH_MAP_CARRIER_MISMATCH`（message 区分原因）；
- 谓词非法（field 不存在 / 非标量域 / `in` 空数组）→ `WATCH_MAP_OPTIONS_INVALID`；
- **数据缺席合法**：schema 已声明的容器未物化/已删除均可订阅——订阅是机制不是数据快照，等待未来创建。读对缺席诚实报错（`WINDOW_TARGET_ABSENT`），订阅对缺席宽容等待；
- 全部参数校验在建立时刻完成——建立后通知流零参数错误。

### 4. 通知流（FIFO、流内有序、三种 kind）

```
{ kind: 'data',           origin, changes: [{ path, key }] }
{ kind: 'invalidate-all', origin }
{ kind: 'watch-end',      reason }
```

- `data`：`changes` 为变更条目**定位符**列表——`{path, key}` 与窗口读条目身份同构，`[...path, key]` 直接拼下一轮 readData / 窗口读路径；同事务同 key 合并为一条；
- `invalidate-all`（订阅存活）：触发源 = 通知队列溢出、父路径删除（容器删除/重建期间订阅横跨缺席期，重建后条目照常到达）；
- `watch-end`（流末条，此后静默）：`reason: 'schema-changed'`（本地 `replaceSchema` 或 Peer re-arm）| `'doc-replaced'`（reset / bootstrap import / genesis 一族）。统一进通知流（不走独立回调）保证与滞留 data 通知的 FIFO——订阅终结只有三因：lease 释放、schema 变更、doc 替换；数据缺席与删除**从不**终结订阅；
- `origin: 'local' | 'replication'`——self-echo 抑制刚需（消费方过滤自己触发的写）；实现上 Yjs transaction origin 天然可区分，零额外成本；
- 无 `version` / `rev` 字段（见备选）。

### 5. 判定纪律：宁多勿漏（唯一不变量）

- **通知条件**：条目**投影值**真变（同值 set 的载体 delta 被语义投影比较过滤——实测同值 set 仍产生 Yjs update delta）∧（无谓词 ∨ 新旧匹配态任一成立 ∨ 旧态不可判时保守通知）；
- 漏 = 消费方永久持有过时数据（不可接受）；多 = 多拉一次（可接受）。通知语义收窄为一句话承诺：**"这个位置的条目状态可能与你所知不同"**——不承诺方向（effect 分型已否决）、不承诺真变了（假通知容忍）；
- 旧态不可判来源：嵌套 `Y.Map` 部分更新时容器浅 delta 无条目级 oldValue（observeDeep 事件落在嵌套处）；plain object 条目恒整值 set、oldValue 恒在场、判定恒精确；
- 消费协议（v1，无对账）：**建立后先全量拉一次，之后按 key 幂等拉终态自辨**——在场则更新视图、不在场则删。

### 6. 分发

- 挂点 = **写序列器事务提交后异步分发**（沿诊断日志"sequencer slot 之外"纪律）——全覆盖本地受控写、复制 apply、schema 安装三种来源；
- 回调 throw 静默隔离（对齐 Registry observer seam 纪律：通知失败不是业务失败，不改变写结果与 sequencer 行为）；
- **有界队列**，溢出 → `invalidate-all`（消费面是读，全量重拉即自愈，无需 ReplicationSession 的 needs-resync 重协商）；**数值不进公共契约**——语义进契约，数值是构造参数 + 实现默认；
- 合并 / 节流归桥接层（UI 按帧、agent 按决策点）：引擎只保证事务级原子通知 + FIFO。

### 7. 分层与契约归属

- `@nomicore/namespace-runtime`：订阅簿记、谓词求值、宁多勿漏判定、异步分发与有界队列（写序列器挂点、schema 安装 / doc 替换的终止编排）；
- `@nomicore/namespace-registry`：lease 公共面、类型别名与透传；
- 通知不出进程：复制协议（instance-replication-v1）零改动；桥接层（DSH steering 注入、宿主 UI 的 Host→Client 通道）是宿主侧职责，nomicore 只交付进程内订阅面。

## 备选（已否决）

- **通知含值 / 值级 diff（增量注入）**：通知风暴带大 payload；diff 语义与投影文本口径绑定复杂；"信号 + 消费方按需拉"与预算/窗口读的护栏-选择器分工更一致。
- **effect 三态分型（entered / left / changed）**：left 判定需旧匹配态（嵌套变更不可得 → 保守二分档），实现两档分叉；布尔判定 + 消费方拉终态自辨，一个动作覆盖所有情况。
- **version / rev 序号 + 基线协议**：全局序号跳跃≠丢通知（正常现象，中间事务不触碰本订阅），丢失检测唯一信号本就是 `invalidate-all`；per-subscription 连续序号与"事务是变更原子单位"错位。v1 无对账协议，字段是死重；v2 有对账需求时纯增量加回。
- **onEnd 独立终止回调**：与通知队列的相对顺序无保证（先终止、后到滞留 data 通知的乱序）；统一进流为 `watch-end` 流末条，天然 FIFO。
- **path 前缀订阅 / 任意查询**：path 前缀表达不了"未 close 的 task"这类条目谓词；任意查询不可收口。
- **notEquals / and / key 过滤进词表**：notEquals 使 NULL 语义复杂化且开放状态集有漏通知坑；and 的交集状态本就是消费方视图；key 过滤消费方一行 filter。
- **数组载体 v1 支持**：Array delta 无 oldValue、index 漂移、insert/delete/retain 结构——移出词表（`watchArray` 为 v2 正位，载体不符响亮拒绝）。
- **订阅目标缺席响亮拒绝**（对齐 `WINDOW_TARGET_ABSENT` 案）：迫使消费方编排"先创建、再挂载"时序；读对缺席报错、订阅宽容等待，订阅生命周期与数据在场性解耦。
- **schema 变更作为通知 kind**：schema 变更下谓词语义可能失效，静默存活最坏结局是 field 缺失恒不匹配的静默死亡；终止信号（`watch-end`）+ 消费方重建才是机制正确形态。
- **origin 含 'admin'**：其全部承载场景（reset / import / schema 安装）都走 `watch-end`，作为 origin 失去存在理由；收敛两态。

## 验收（缝）

- **主缝 = lease 公共面**（零新接缝，`@nomicore/namespace-registry` 契约测试家族）：
  - 建立判定矩阵：无 active schema 拒绝、path 偏离 schema / 数组载体（`WATCH_MAP_CARRIER_MISMATCH`）、谓词非法三情形（`WATCH_MAP_OPTIONS_INVALID`）、数据缺席可订阅（含容器删除后订阅横跨重建）；
  - 通知流：三 kind 形状、`changes` 定位符与同 key 合并、一事务一通知（批量信封原子可见）、origin 两态（本地写 / 复制 apply 经 `openReplicationSession` 驱动）、`watch-end` 两 reason（含 Peer re-arm 路径）与流末条静默；
  - 判定纪律：同值写不通知、嵌套变更保守通知（宁多勿漏矩阵）、退出匹配集通知、无谓词全通知；
  - 生命周期：lease 释放清理、主动退订幂等无回声、队列溢出（testing 工厂注入小上限）→ `invalidate-all` 且订阅存活、回调 throw 隔离（不影响写结果）；
  - 类型面：lease surface 别名断言（`*.test-d.ts` 先例）；
- **先例** = 窗口读（issue #369）lease 契约三件套（fixture / red / surface）、replication-session lease 面家族；
- **文档缝**：「变更订阅」词条锚定，无与 subscribeOwnedUpdates / 诊断日志 / RegistryObserver 混用的措辞。

## 开放问题（v2 正位）

- `watchArray`（数组载体：delta oldValue 缺失、index 漂移的定位语义）；
- `notEquals`（头号候选；开放状态集的漏通知坑须随文档写明）；
- `and` 谓词组合、key 级过滤；
- 含值通知 / 值级 diff（增量注入、小 diff 内联阈值）；
- versioned read（ETag 式条件读，拉模式对称）；
- 跨 namespace 清单变更事件（namespace 创建/删除，Registry 层独立设计）；
- 桥接层（DSH steering 注入格式与节流、宿主 UI Host→Client 推送通道）——宿主侧。
