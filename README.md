# Nomicore

English | [中文](README_zh.md)

[![CI](https://github.com/nomicore-ai/nomicore/actions/workflows/ci.yml/badge.svg)](https://github.com/nomicore-ai/nomicore/actions/workflows/ci.yml)

> **The database built for agents.**
>
> **面向 Agent 的数据库**

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

## Why Nomicore

### Why traditional databases fall short in the Agent era

Traditional databases were primarily designed for applications written by humans. An application can encode data structures, business rules, and error handling in advance, but an Agent works on dynamic tasks and must understand data and its boundaries while reading, changing, sharing, and monitoring it. Traditional databases leave important gaps at every step:

1. **The data arrives without a complete explanation.** A database query usually gives an Agent the data but not its schema. Even if the schema is obtained separately, it rarely includes the business semantics of each field. The Agent may know that a value is numeric without knowing its unit, scope, calculation method, or applicable version, forcing it to guess or search elsewhere for documentation.
2. **Writes lack enforceable constraints.** When constraints live only in application code or human convention, an Agent modifying the database cannot reliably determine whether its write is valid. A misspelled field, wrong type, or violated business rule may enter the database without a clear warning and then propagate further.
3. **There is no inexpensive undo for a bad change.** Traditional databases either lack rollback at the level of an individual semantic change or require transactions, backups, or whole-database restoration. Rollbacks are coarse, operationally complex, and costly, so one mistaken edit can affect large amounts of unrelated data.
4. **Data cannot be shared safely on its own.** When one Agent sends a query result to another, it typically sends only the values—not the schema and business semantics. The recipient interprets the data using its own assumptions. As the number of participants and versions grows, the result quickly becomes inconsistent and confusing.
5. **Schema evolution slows iteration.** Once a schema changes, all historical data usually has to be migrated so old and new records can continue to work with the same application logic. The larger and older the dataset, the greater the cost and risk, making schema evolution cautious and slow.
6. **Agents cannot naturally sense data changes.** When data changes, an Agent is usually not notified. To avoid acting on stale information, it must read the data again before every use. Repeatedly loading large datasets into the prompt is slow and consumes substantial context.

### Data that explains itself

Nomicore binds every piece of data to its schema and semantics. When an Agent retrieves data, it also receives the information needed to understand its structure and interpret its meaning. The data is therefore self-describing and self-explanatory rather than dependent on context hidden elsewhere.

Each piece of data carries its own schema and semantic definition. Different shapes and definitions can coexist without first forcing every producer and consumer to align on one global version or migrate all historical data at once.

This also makes Nomicore naturally suited to Agent collaboration. When an Agent sends data to another Agent, the associated schema and semantics travel with it. The receiving Agent can determine how to read the data from the data itself, substantially reducing ambiguity and misinterpretation.

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
