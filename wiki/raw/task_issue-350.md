# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #350
Title: 原子变更信封：mutateData 批量 ops 多操作全有或全无（ADR 0026，guard 前置）
State: open
Issue updated at: 2026-09-12T18:04:05Z

## Issue body

## Parent

PR #346（adr0025-guarded-mutation）

## What to build

按 ADR 0026 落地批量原子变更信封：mutateData 的 mutation 信封新增与单操作形态互斥的批量形态 `{ ops: [...] }`。写序列器槽内逐操作 prepare（解析/导航/detached 构建/校验），任一操作失败则**整体零写入**并聚合全部失败操作的 issues；全部成功则单事务按序提交、逐操作边界验证——全有或全无，一个写槽对应一次变更尝试与一条诊断 update。各操作仍是最小 edit，原子性不以整父替换等载体降级换取。单操作信封（现役契约）行为逐字节不变。本票不含 guard（ADR 0025，票 #347–#349 后续叠加于两种形态顶层）。

## Acceptance criteria

- [ ] 批量信封全部操作合法 → 单事务按序提交，全部值落盘，观察者要么见全部要么不见
- [ ] 任一操作失败 → `ok:false`、**聚合**全部失败操作的 issues（非 fail-fast 单错）、文档逐字节不变（整体零写入）
- [ ] 形状错误零写入拒绝且无码：双形态同现、`ops` 空数组、元素超上限 16、元素非完整单操作信封、元素携带未知键（含 `guard`——批级前提属 ADR 0025 顶层）、批内路径嵌套（祖先-后代或相同）
- [ ] 跨实体路径批量同样原子（不同 Record 条目/不同集合的多个 set/delete/array-*）
- [ ] 单操作形态（无 ops）与既有调用行为逐字节不变
- [ ] 诊断：一次变更尝试一条记录、单事务单条 update bytes（对照多次顺序写的 N 条）
- [ ] mutateData 端到端：批量经公共面透传、lifecycle 停接纳次序不变
- [ ] 根 `pnpm typecheck` + doc-runtime / namespace-runtime 相关测试通过

## Blocked by

None (can start immediately).

## Comments
