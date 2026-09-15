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

- **Define data with familiar syntax**: describe data structures with TypeScript-like syntax, and write field meanings, business rules, and interpretation guidance directly alongside those definitions so they are readable by both humans and Agents.
- **Enforce Schema constraints in the database kernel**: every write is validated against its Schema. Invalid data is rejected at the storage boundary, preventing structures and business constraints from drifting over time.
- **React to data changes in real time**: Agents can receive change signals as soon as data is updated and respond immediately, without periodically polling or repeatedly reading the entire dataset.
- **Access and search data in multiple ways**: read a precise field, object, or collection by path; bound the depth and width of a read to retrieve only part of a large structure; or use window reads over arrays and keyed collections, ordered by index, key, or field, to select recent entries, stable ranges, or Top-K results. Every read also returns the applicable data specification and business semantics.
- **Collaborate natively across participants**: multiple participants can continuously modify the same data through fine-grained, mergeable changes. This supports both Agent-to-Agent collaboration and Agent-to-Human collaboration over a shared source of truth.
- **Embed anywhere and scale out**: use Nomicore as a module inside any application or run it as a standalone service. As demand grows, deploy multiple instances as a Hub/Peer replicated cluster with complete replicas across nodes.
- **Native DeepSeek Harness support**: Nomicore can directly provide DeepSeek Harness with persistence, Schema- and semantics-aware data access, and a shared data foundation for collaboration across Sessions and Agents.

## Learn more

- [Installation, integration, deployment, and development](INSTALL.md)
- [Authoritative domain terminology](CONTEXT.md)
- [Architecture decisions](docs/adr/)
- [Instance replication wire contract](docs/protocols/instance-replication-v1.md)
