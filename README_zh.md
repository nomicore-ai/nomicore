# Nomicore

[English](README.md) | 中文

[![CI](https://github.com/welltop-jim-wang/nomicore/actions/workflows/ci.yml/badge.svg)](https://github.com/welltop-jim-wang/nomicore/actions/workflows/ci.yml)

> **面向 Agent 的数据库**

## 为什么需要 Nomicore

### 仅有数据是不够的

传统数据库擅长返回数据，但只有数据往往不足以确定其含义。一次查询可以拿到数值，却通常拿不到定义数据结构的规范——schema，也拿不到解释这些数值代表什么、应当如何理解的业务口径。

当 schema 和业务口径发生变化时，这个问题会变得更加危险。以关系型数据库为例，它很难让多种数据形状自然共存；即使勉强存入同一个数据库，消费方也很容易套用错误的结构。如果同一指标或业务概念还存在多种口径，那么即使数据本身完全合法，也可能在不报错的情况下被错误解读。

这一限制同样不利于 Agent 在数据层面的协作。当一个 Agent 把数据发送给另一个 Agent 时，数据对应的 schema 和解读规则不会自然地随之传递。接收方只能依赖外部文档、双方的默认共识或预先协调，并可能在缺少上下文时自信地得出错误结论。

### 让数据解释自己

Nomicore 将每一份数据与其 schema 和业务口径绑定在一起。Agent 读取数据时，也会同时获得理解其结构和含义所需的信息。数据不再依赖散落在其他位置的隐含上下文，而是可以自描述、自解释。

每一份数据都可以拥有自己的 schema 和业务口径。因此，不同的数据形状和定义可以共存，不必先要求所有生产者和消费者对齐到同一个全局版本，也不必一次性迁移全部历史数据。

这也使 Nomicore 天然适合 Agent 协作。当一个 Agent 将数据发送给另一个 Agent 时，与之关联的 schema 和业务口径也会一起传递。接收方能够根据数据自身携带的信息判断应当如何读取它，从而显著减少歧义和误读。

## 示例：只有 `revenue: 120` 为什么不够

假设一个 Agent 从传统数据库中收到如下结果：

```json
{
  "month": "2025-01",
  "revenue": 120
}
```

这个值看起来很简单，但 Agent 无法在不询问更多信息的情况下安全地使用它：

- `revenue` 的单位是美元、千美元，还是其他货币？
- 它表示已确认收入、已开票收入，还是实际回款？
- 它是否包含税费、退款和关联方交易？
- 这条记录由哪个 schema 版本生成？
- 这个指标的定义是否在当前月份与历史记录之间发生过变化？

在 Nomicore 中，读取结果会同时包含数据及解读数据所需的信息：

```js
{
  ok: true,
  value: {
    month: '2025-01',
    revenue: 120
  },
  schema: `# readData []

{
  month: Pattern<"^[0-9]{4}-(0[1-9]|1[0-2])$"> // 报告月份，格式为 YYYY-MM
  revenue: Range<0, 999999999> // 已确认收入，单位为千美元，不含税费和退款；会计政策 2025-v2
}
`,
  truncated: false
}
```

`Pattern<"…">` 表示这个值必须符合指定格式；`Range<0, 999999999>` 表示这个值必须是该范围内的数字。字段后的注释则说明数据的含义和解读口径。

现在，Agent 可以确定 `120` 表示按 `2025-v2` 会计政策计算的 12 万美元已确认收入。如果较早的记录使用不同的数据形状或业务口径，它可以继续保留自己的 schema 和口径，而不会被默认套用当前规则。

当这份结果被发送给另一个 Agent 时，它的 schema 和业务口径也会随之传递。接收方无需先找到独立的数据字典，也无需依赖未写明的组织背景，就能正确理解这个值。

## 当前能力

- **VFSL v1**：解析、求值、schema envelope、逻辑 ROOT 校验、路径与载体投影。
- **TypeScript codegen**：从宿主拥有的 `schema.vfsl` 生成 `VfslPathMap` augmentation，用于强类型写路径和值。
- **Namespace Runtime**：同步读取、VFSL 校验写、严格 FIFO write sequencer、SCHEMA replacement。
- **Namespace Registry**：namespace create/open、lease、idle retention、生命周期与有序 shutdown。
- **Persistence**：Memory/File adapters、dirty/flush、恢复、归档与 replica reset；File root 由单一 active process 独占。
- **Instance identity**：不可变的 `instanceId + role` Cordis service。
- **WebSocket replication**：角色专用 Hub/Peer Cordis plugins、认证授权、bootstrap/reconcile、backpressure、liveness、GOAWAY drain 与受控恢复。
- **Standalone server**：`@nomicore/yjs-server` CLI，以及可供嵌入式 Node Host 使用的 Hub listener 和 Peer dial adapters。

## 进一步了解

- [安装、集成、部署与开发](INSTALL_zh.md)
- [权威领域术语](CONTEXT.md)
- [架构决策](docs/adr/)
- [Instance replication wire contract](docs/protocols/instance-replication-v1.md)
