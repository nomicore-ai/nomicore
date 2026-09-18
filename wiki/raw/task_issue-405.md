# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #405
Title: readData 面：maxBytes 交付总量收/拒闸（tracer）
State: open
Issue updated at: 2026-09-15T14:27:06Z

## Issue body

## Parent

PR #403（docs/adr-0031-readdata-byte-budget）

## What to build

调用方在 `readData` 的 options 携带 `maxBytes`（≥1 有限整数）时，引擎对**交付总量**做收/拒判定：总量 = 值通道（`utf8(JSON.stringify(value))`，紧凑 JSON、键序 = 交付序，`value === undefined` 计 0）+ schema 通道（投影文本 UTF-8，✂ 段与头行自然计入，`schema: null` 计 0）。≤ 预算 → 原样成功（成功交付物与同参无 `maxBytes` 读逐字节相同）；> 预算 → 零交付，同步结果联合返回稳定码分支：

```ts
{ ok: false; code: 'READ_BUDGET_EXCEEDED'; path: …; measuredBytes: number; message: string }
```

`measuredBytes` 只报合计。校验与度量住 namespace-runtime 组合层（doc-runtime / vfsl 零改动，下传 options 仍为 depth/maxChildrenPerNode 两键）；registry lease 的 options 与结果类型别名跟随透传。契约词汇以 ADR 0031 与 CONTEXT.md「字节预算」词条为权威。

## Acceptance criteria

- [ ] 总量 ≤ 预算成功，交付物与同参无 `maxBytes` 读逐字节一致（回归锚）
- [ ] 恰好等于 `maxBytes` 成功（≤ 判定）
- [ ] 超限零交付：失败分支形状如上，`measuredBytes` 为两通道合计
- [ ] 度量等式 property：`measuredBytes === utf8(JSON.stringify(value)) + utf8(schema)`，覆盖 `schema: null`（计 0）与 `value === undefined`（值侧 0、可因投影文本超限报错）
- [ ] options 负控：`0` / 负数 / 非整数 / 非有限数 / 未知键 → `READ_OPTIONS_INVALID`（message 文案区分 maxBytes 域）
- [ ] 缺席目标 × 超限：投影文本照常计量、可报错（路径键控、与值无关）
- [ ] 无 options（含 `maxBytes` 缺席 ≡ 不设预算）逐字节现行为回归
- [ ] 成功面恒四键、✂ 与头行文法零漂移（快照锚）
- [ ] registry lease：options 闭合形状与结果联合类型别名跟随，别名锁断言延伸
- [ ] 包内门禁 + root `pnpm typecheck` / `pnpm test`

## Blocked by

None（可立即开始）。

## Comments
