# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #470
Title: Ticket(persistence)：Cordis rc.12 双形态 Root tracer bullet 与工件验真
State: open
Issue updated at: 2026-11-14T13:15:09Z

## Issue body

## Parent

PR #469（spec/468-cordis-rc12-root）

## What to build

让 Memory/File Persistence 在旧 npm Cordis 与精确 Cordis rc.12 目标工件上，通过同一个公开发布插件完成真实 Timer 的 flush/retry、drain 和 dispose。实现 ADR 0035 的 Persistence 双形态 Root tracer bullet，并建立后续 Replication 与发布收官可复用的工件身份和 Root 通道验真能力；Host 不需要新增配置或条件装配。

## Acceptance criteria

- [ ] Persistence 的 Host scheduler 优先使用公开 global symbol Root，仅在该通道缺席时使用 legacy Root；所需 timer 能力缺席或形状不符时响亮失败，不使用 ambient timer。
- [ ] Memory 与 File Persistence 在 Cordis `4.0.1` + Timer `1.1.3`、npm Cordis `4.1.0` + Timer `1.2.0`、DSH commit `1511a6ed442c207919142a4b0e6c4916f96d2c3b` 的 vendored Cordis `4.1.0`（rc.12 行为）+ Timer `1.2.0` + Cosmokit `1.9.0` 上分别通过真实 Timer 的 flush/retry、drain、dispose 和服务撤销验收。
- [ ] Persistence 已接纳写在 dependent 卸载期间仍能完成 dirty notification；adapter 只在既有排空边界后释放，不改变 ADR 0006/0009 的生命周期语义。
- [ ] rc.12 夹具固定到上述精确 commit，使用 source-built 或 provenance-verified vendored 工件，并在测试开始时断言实际模块解析路径。
- [ ] 运行时探针证明两个 npm 基线命中 legacy Root 通道、精确 rc.12 基线命中 symbol Root 通道；依赖解析回退、同名工件替换或通道错配会使测试失败。
- [ ] 每个基线分别通过全仓 typecheck 与现有 Persistence contract、真实 Timer、Nomicore DSH profile 相关测试；一个基线的绿色结果不得抵销另一基线失败。
- [ ] 夹具和 Root 探针不新增公共生产 API，不把兼容逻辑扩散到 Persistence 核心或 Registry。
- [ ] 不改变 Cordis/Timer 依赖范围或 dependency/peerDependency 归属，不修改历史 artifacts，不执行真实 MABF/DSH 部署或 patch 移除。

## Blocked by

None (can start immediately).


## Comments
