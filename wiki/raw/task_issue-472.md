# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #472
Title: Ticket(release)：Cordis rc.12 三基线回归与 Nomicore 0.5.0 收官
State: open
Issue updated at: 2026-11-14T22:07:15Z

## Issue body

## Parent

PR #469（spec/468-cordis-rc12-root）

## What to build

对 ADR 0035 的三个目标基线完成全仓回归和 Nomicore `0.5.0` 发布收官。证明双形态 Root 实现在精确工件上通过现有公共包构建、发布与可复现性门禁，并留存可复核的工件身份和 Root 通道证据；本阶段不承担真实 MABF/DSH Host 部署或本地 patch 移除。

## Acceptance criteria

- [ ] Cordis `4.0.1` + Timer `1.1.3`、npm Cordis `4.1.0` + Timer `1.2.0`、DSH commit `1511a6ed442c207919142a4b0e6c4916f96d2c3b` 的 rc.12 工件分别通过全仓 typecheck 和完整相关运行时矩阵。
- [ ] 每个基线都有独立的模块解析路径与 Root 通道证据；任何工件回退、同名替换或通道错配均阻止收官。
- [ ] 现有包构建、发布验证和可复现性检查全部通过；源码 worktree 结果不替代真实打包产物门禁。
- [ ] 按既有流程完成 Nomicore `0.5.0` 的版本与变更记录，确认公共 Namespace/Registry/Replication API、schema、wire protocol、服务名和持久化布局无非预期变化。
- [ ] 不改变 Cordis/Timer 的依赖范围或 dependency/peerDependency 归属；若发现必须改变安装契约的问题，停止收官并另立 ADR。
- [ ] 将三基线回归、构建和发布验证结果回填到本 ticket 与集成 PR；不得关闭或改写 tracking issue #468 的 Parent。
- [ ] 明确记录真实 MABF/DSH 部署与本地 patch 移除不属于本阶段，不作相关完成性声明。
- [ ] 旧 #464–#466 保持撤回，不复用其错误或不可核验的证据。

## Blocked by

- #470
- #471


## Comments
