# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #440
Title: vfsl：逐 entry 校验扩展（Record + 封闭对象 delete）与一致性 fixture 扩展（ADR 0034）
State: open
Issue updated at: 2026-09-22T08:31:18Z

## Issue body

## Parent

PR #438（spec/adr-0034-record-elementwise-validation）

## Task Type

feature

## What to build

把 vfsl 的逐 entry 判定 seam 扩展到 Record 与封闭对象 delete 两形态：Record set 做键 Pattern 校验 + 新值过值 schema（不读旧值）；Record delete 只做域规则判定（在场/no-op）；封闭对象 delete 做静态必填判定——目标字段必填且非 `unknown` 标量则拒绝，optional 或 `unknown` 则允许，不读父值。域规则与现行逐字一致；issue 路径 `[...mapPath, key]` 与现行全量路径逐字节兼容。

同时扩展 ADR 0033 的一致性 fixture：逐 entry 判定与全量 `validateSubtree` 在随机/参数化用例下的接受/拒绝及 issue 逐字节一致，覆盖 Record 与 parent 两形态——未来引入 map 级约束（键数/跨键）时红灯。

## Acceptance criteria

- [ ] Record set：键 Pattern 违规、新值非法均写入前拒绝，issue 路径 `[...mapPath, key]` 与全量路径逐字节一致
- [ ] Record delete：仅在场/no-op 域规则判定，不触碰其他 entry
- [ ] 封闭对象 delete 静态规则全矩阵：必填（拒绝）/ optional（允许）/ `unknown` 标量必填（允许，缺席视同接受的现行语义保留）/ no-op（拒绝）
- [ ] 一致性 fixture 覆盖 Record 与 parent 两形态，与全量整体验证逐字节一致
- [ ] 公开面只经包公共入口导出，public-surface guard 覆盖新导出
- [ ] 包测试 + 根 `pnpm typecheck` 与 `pnpm test` 绿

## Blocked by

- #437

## Comments

