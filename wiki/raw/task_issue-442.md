# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #442
Title: lease 端到端：Record/parent 逐 entry 校验行为钉死（ADR 0034）
State: open
Issue updated at: 2026-09-22T11:43:25Z

## Issue body

## Parent

PR #438（spec/adr-0034-record-elementwise-validation）

## Task Type

feature

## What to build

经 lease `mutateData` 的端到端测试，钉死 ADR 0034 带来的用户可见行为变化与不变量。本 ticket 不改实现，只把新语义在最高 seam 上立法成回归测试。

## Acceptance criteria

- [ ] 行为变化钉正：对被 raw-replication 污染的 Record map 写/删未触达 entry 非法的键位，目标键合法即成功（旧语义为连带拒绝）；封闭对象 delete 同理
- [ ] 不变量钉死：键 Pattern 违规与非法新值零写入 + issue 路径 `[...mapPath, key]` 不变；delete 不存在键的 no-op 拒绝不变；必填字段 delete 拒绝、`unknown` 标量字段 delete 允许的静态规则不变
- [ ] union map 位的端到端行为与性能路径不变（仍走全量边界校验）
- [ ] Record 值位为 union 时端到端仍走 fast path（行为正确且不经全量提取）
- [ ] 诊断烟测：fast path 提交的 committed update bytes 记录形态不变
- [ ] 复制烟测：fast path 提交经 replication apply 在对端收敛，无协议面变化
- [ ] 根 `pnpm typecheck` 与 `pnpm test` 绿

## Blocked by

- #441

## Comments
