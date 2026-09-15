# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #383
Title: [ADR 0029] P3 — 组合面与 lease 类型（缝 2：runtime + registry）
State: open
Issue updated at: 2026-09-15T02:50:41Z

## Issue body

## Parent

PR #380（adr-0029-filtered-window）

## What to build

runtime 十四键面 `readArray` / `readMap` 组合 where 并透传到 registry lease：S3 canonical 键集白名单同步扩 where（与 doc-runtime 权威校验判据一致，接缝出口覆盖新键）；S6 结算采用 truncated 双语义与 ✂ 装配规则；lease options 类型面 fail-closed。调用方在 lease 公共面上完成「找到所有 state == 'claimed' 的 task」并正确读出截断信号。

## Acceptance criteria

- [ ] 无 where 时 lease 面结算与 ADR 0028 快照逐字节一致：total = 标识计数、truncated = kept < total、✂ 窗口事实块按 truncated 装配（既有快照零漂移）
- [ ] 有 where 时：`truncated === (kept === n)`（装满判定；kept < n ⟹ false——扫完了确定没有更多）；✂ 段永不装配、不呈现过滤槽；schema 通道仍为元素口径投影文本（where 不影响）
- [ ] 恒四键 own 键集 `{ok, value, schema, truncated}` 不变；条目身份随行（key/index）可拼下一轮路径
- [ ] 组合式 depth 等价锚：过滤入选项 ≡ 同预算 readData(项路径)
- [ ] S3 接缝两出口（视图不稳定重派发 / 交替视图终态）对 where 判据同步：敌意 where 在组合层同样零外抛
- [ ] registry lease 类型 fail-closed（test-d）：where 非数组、元素未知键、equals 非标量闭集、by/dir 词表混用等编译期拒绝；registry 透传组合面
- [ ] close 后带 where 读 → `RUNTIME_READ_DISABLED`（停接纳不豁免，四键失败形）
- [ ] 缝 2 测试先例：issue #369 组合面家族 + runtime-data-interface.test-d + registry 内部缝；全仓 typecheck + 测试绿

## Blocked by

- #382

## Comments
