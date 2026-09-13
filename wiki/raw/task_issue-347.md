# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #347
Title: 条件写核心：doc-runtime 信封解析、槽前评估与 MUTATION_GUARD_MISMATCH（guard I）
State: open
Issue updated at: 2026-09-13T00:09:40Z

## Issue body

## Parent

PR #346（adr0025-guarded-mutation）

## What to build

在 doc-runtime 受控写管线上落地条件写（guarded mutation，ADR 0025）的核心语义：四个 mutation 操作（set / delete / array-insert / array-delete）的信封可携带可选单条件 guard；信封解析完成全部形状校验；评估发生在写管线 prepare 阶段（信封解析后、局部/legacy 管线分叉前、schema 校验之前），对 guard 路径的 committed 当前载体投影逻辑值断言 `equals`（结构深相等）或 `absent`（无值）；不满足则零写入拒绝，返回携带稳定码 `MUTATION_GUARD_MISMATCH` 的单 issue（issue.path 指向 guard 条件路径，message 含期望/实际摘要且截断）。类型 `MutationGuard`（ADR 0025 定稿判别联合）与稳定码常量从 doc-runtime 公共入口导出，公共面审计测试同步。

实现基线分支为 Parent PR 的 `adr0025-guarded-mutation`；谓词语义以 ADR 0025「评估语义/错误域」为权威。

## Acceptance criteria

- [ ] 带合法 guard 且条件满足的 set/delete/array-insert/array-delete 正常提交（值落盘）
- [ ] equals 不满足（值不同 / 路径缺键吸收为 undefined）→ `ok:false` 单 issue、稳定码 `MUTATION_GUARD_MISMATCH`、issue.path 为 guard 条件路径、文档逐字节不变（零写入）
- [ ] absent 满足（缺键）→ 提交；absent 不满足（键有值）→ 零写入拒绝带稳定码
- [ ] 形状错误全家桶均零写入拒绝且**不带**稳定码（不可重试语义）：guard 非对象、equals/absent 非恰其一、缺 path、absent 非字面 true、path 段类型错误、path 为 `[]`、equals 含非有限数
- [ ] guard 评估先于 schema 校验：新值违反 schema 且 guard 不满足时，只报 guard 拒绝
- [ ] 不携带 guard 的既有调用行为逐字节不变；携带 guard 的信封在公共面结果联合中正确透传
- [ ] `MutationGuard` 类型与 `MUTATION_GUARD_MISMATCH` 稳定码从公共入口导出；公共面审计测试覆盖新导出
- [ ] guard 同样适用于批量形态顶层 `{ ops, guard }`：评估一次、先于逐操作 prepare；不满足整体零写入单 issue
- [ ] 批量元素携带 `guard` 键 = 形状错误（无码、不可重试）
- [ ] 根 `pnpm typecheck` 与 doc-runtime 相关测试通过

## Blocked by

- #350（批量信封先行落地后，guard 直接同时支持单操作与 ops 批量两种形态顶层）


## Comments
