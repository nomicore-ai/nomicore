# Nomicore

English | [中文](README_zh.md)

[![CI](https://github.com/welltop-jim-wang/nomicore/actions/workflows/ci.yml/badge.svg)](https://github.com/welltop-jim-wang/nomicore/actions/workflows/ci.yml)

> **The database built for agents.**
>
> **面向 Agent 的数据库**

## Why Nomicore

### Data alone is not enough

Traditional databases are designed to return data, but data by itself is often ambiguous. A query can retrieve values, yet it usually cannot retrieve the specification that defines their structure—the schema—or the business semantics that explain what those values mean and how they should be interpreted.

This becomes especially dangerous as schemas and semantics evolve. Relational databases, for example, are poorly suited to keeping multiple data shapes side by side. Even when this is forced into one database, consumers can easily apply the wrong structure. If multiple versions of the same metric or business definition coexist, the risk of silently misreading otherwise valid data is even greater.

The same limitation makes data-layer collaboration difficult for Agents. When one Agent sends data to another, the data's schema and interpretation rules do not naturally travel with it. The receiving Agent must rely on external documentation, shared assumptions, or prior coordination—and may confidently interpret the data incorrectly.

### Data that explains itself

Nomicore binds every piece of data to its schema and semantics. When an Agent retrieves data, it also receives the information needed to understand its structure and interpret its meaning. The data is therefore self-describing and self-explanatory rather than dependent on context hidden elsewhere.

Each piece of data carries its own schema and semantic definition. Different shapes and definitions can coexist without first forcing every producer and consumer to align on one global version or migrate all historical data at once.

This also makes Nomicore naturally suited to Agent collaboration. When an Agent sends data to another Agent, the associated schema and semantics travel with it. The receiving Agent can determine how to read the data from the data itself, substantially reducing ambiguity and misinterpretation.

## Example: when `revenue: 120` is not enough

Suppose an Agent receives this result from a conventional database:

```json
{
  "month": "2025-01",
  "revenue": 120
}
```

The value looks simple, but the Agent cannot safely use it without asking more questions:

- Is `revenue` measured in dollars, thousands of dollars, or another currency?
- Is it recognized revenue, invoiced revenue, or cash collected?
- Does it include tax, refunds, and intercompany transactions?
- Which schema version produced this record?
- Did the definition change between this month and historical records?

With Nomicore, the result includes both the data and the information needed to interpret it:

```js
{
  ok: true,
  value: {
    month: '2025-01',
    revenue: 120
  },
  schema: `# readData []

{
  month: Pattern<"^[0-9]{4}-(0[1-9]|1[0-2])$"> // Reporting month in YYYY-MM format
  revenue: Range<0, 999999999> // Recognized revenue in USD thousands, excluding tax and refunds; accounting policy 2025-v2
}
`,
  truncated: false
}
```

`Pattern<"…">` means the value must match the specified format. `Range<0, 999999999>` means the value must be a number within that range. The comments explain what each field means and how it should be interpreted.

The Agent now knows that `120` means USD 120,000 of recognized revenue under accounting policy `2025-v2`. If an older record uses a different shape or definition, that record can retain its own schema and semantics rather than being silently interpreted under the latest rules.

When this result is sent to another Agent, its schema and semantics travel with it. The receiving Agent does not need access to a separate data dictionary or undocumented organizational context before it can interpret the value correctly.

## Capabilities

- **VFSL v1**: parsing, evaluation, schema envelopes, logical ROOT validation, and path/carrier projections.
- **TypeScript code generation**: generates a `VfslPathMap` augmentation from the host-owned `schema.vfsl`, providing typed mutation paths and values.
- **Namespace Runtime**: synchronous reads, VFSL-validated writes, a strict FIFO write sequencer, and SCHEMA replacement.
- **Namespace Registry**: namespace creation/opening, leases, idle retention, lifecycle management, and ordered shutdown.
- **Persistence**: Memory and File adapters, dirty tracking and flush scheduling, recovery, archival, and replica reset. A File root is exclusively owned by one active process.
- **Instance identity**: an immutable `instanceId + role` Cordis service.
- **WebSocket replication**: role-specific Hub/Peer Cordis plugins with authentication, authorization, bootstrap/reconcile, backpressure, liveness, GOAWAY drain, and controlled recovery.
- **Standalone server**: the `@nomicore/yjs-server` CLI plus embeddable Node Hub-listen and Peer-dial adapters.

## Learn more

- [Installation, integration, deployment, and development](INSTALL.md)
- [Authoritative domain terminology](CONTEXT.md)
- [Architecture decisions](docs/adr/)
- [Instance replication wire contract](docs/protocols/instance-replication-v1.md)
