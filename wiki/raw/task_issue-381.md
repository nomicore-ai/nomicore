# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #381
Title: [ADR 0029] P1 — W1 冻结解除与 total 下沉（prefactor）
State: open
Issue updated at: 2026-09-14T11:05:55Z

## Issue body

## Parent

PR #380（adr-0029-filtered-window）

## What to build

解冻 doc-runtime 窗口原语并把候选计数下沉：窗口原语两个公共入口的成功结算新增 `total` 键（无 where 时恒为候选标识计数），namespace-runtime 组合层删除自算计数与全部出处标记镜像复制件，收缩为纯组合层（S3 净化 / S5 锚链 / S6 ✂ 装配）。这是 ADR 0029 的前置重构票——行为除「doc-runtime 原语结算多一个 total 键」外零变化，lease 公共面逐字节不变；让 where 的加入面对干净的三键结算而非冻结面 + 双份镜像。

## Acceptance criteria

- [ ] doc-runtime 窗口原语两面（readArrayWindowAtPath / readMapWindowAtPath）成功结算恰三键 `{ok, value, total}`：total = 候选标识计数（数组面 = length；键面 = 非 undefined 键计数）；失败结算形状不变
- [ ] namespace-runtime 组合层不再持有候选计数逻辑与镜像复制件（navigate / navClassify / probeRoot / carrierOf / readableOwnDataValue 等出处标记复制函数），total 消费自 doc-runtime 单源；W1 冻结注释与「copied from」镜像纪律备注同步清理（ADR 0028 §13 R2 执行）
- [ ] registry lease 公共面行为逐字节不变（既有组合面测试零语义改动；断言如涉 W1 形状仅机械迁移）
- [ ] doc-runtime 窗口测试家族完成两键 → 三键断言迁移
- [ ] 全仓 `pnpm typecheck` + `pnpm test` 绿

## Blocked by

None (can start immediately).

## Comments
