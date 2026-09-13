# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #349
Title: 条件写端到端：mutateData 透传、诊断 rejected 与写序列器竞争证明（guard III）
State: open
Issue updated at: 2026-09-13T01:27:53Z

## Issue body

## Parent

PR #346（adr0025-guarded-mutation）

## What to build

在 #347 落地的条件写核心之上，验证 namespace-runtime 端到端链路（Seam 2）：从 `NamespaceRuntime.mutateData` 进入的带 guard 写，其竞争拒绝经 `MutateDataResult` issues 正确透传；guard 拒绝作为 rejected 变更尝试落入诊断变更日志（stage=validation、issue 携 `MUTATION_GUARD_MISMATCH`）；写序列器 FIFO 独占使「guard 评估 + 提交」之间不存在其他受控写插入——两个受控写串行，第二个基于已提交的新值判定并零写入失败（TOCTOU 消除的证明面，ADR 0025「评估位置与原子性」）。本票不改 doc-runtime 语义；namespace-runtime 实现预期零改动（透传与诊断走既有管线），若发现阻断性偏差以 ADR 0025 为准修正。

## Acceptance criteria

- [ ] mutateData 携带 guard：条件满足 → `ok:true`；条件不满足 → `ok:false`、issues 含 `MUTATION_GUARD_MISMATCH`、issue.path 为 guard 条件路径
- [ ] guard 拒绝零写入：同 namespace 后续读取值不变
- [ ] 装配诊断 emitter 时，guard 拒绝以 rejected 变更尝试落日志：stage=validation、result=rejected、issue 携稳定码；未装配 emitter 时行为等价（无诊断、拒绝照常）
- [ ] 序列器竞争：两个 mutateData 串行提交（同一 guard 期望同一旧值），第一个成功、第二个零写入拒绝——中间无第三写介入的间隙语义成立
- [ ] guard 拒绝不触发 fatal、不影响后续写能力（下一合法写照常成功）
- [ ] lifecycle 停接纳语义不变：closing/closed 期带 guard 的 mutateData 仍按 `RUNTIME_WRITE_DISABLED` 拒绝（guard 不改变接纳门次序）
- [ ] 批量 + guard 组合端到端：`{ ops, guard }` 竞争拒绝零写入、诊断 rejected 单条记录、成功路径单条 update bytes
- [ ] 用例按 namespace-runtime 既有 mutate/sequencer/fullchain 测试组织方式落位；根 `pnpm typecheck` + 相关测试通过

## Blocked by

- #347


## Comments
