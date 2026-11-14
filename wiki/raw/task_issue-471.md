# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #471
Title: Ticket(ws-replication)：Cordis rc.12 Hub/Peer/SessionHost 全链兼容
State: open
Issue updated at: 2026-11-14T17:03:12Z

## Issue body

## Parent

PR #469（spec/468-cordis-rc12-root）

## What to build

让 Hub、Peer 与免 listen SessionHost 在旧 npm Cordis 和精确 rc.12 目标工件上，通过现有公开 plugins/services 完成启动、连接 timer 调度与取消、drain/stop、服务撤销和重新挂载。复用 Persistence tracer bullet 的验真夹具，把 ADR 0035 的双形态 Root 兼容扩展到 WebSocket Replication，而 Host 装配、公共 API 与生命周期所有权保持不变。

## Acceptance criteria

- [ ] Replication 的 Host timer adapter 按 ADR 0035 优先解析 symbol Root、缺席时回退 legacy Root；所需 timer 能力缺席时响亮失败，不使用 ambient timer。
- [ ] Hub、Peer、SessionHost 免 listen 模式在三个目标基线上分别通过启动、timer 触发/取消、显式 stop、Fiber dispose、服务撤销与重新挂载验收。
- [ ] Registry → Persistence 与 Replication → Registry 的拆卸顺序保持单向；provider/dependent 等待、有序 effect、显式 drain 不构成等待环，watchdog 和有界 drain 不被移除。
- [ ] Timer 仍由 Host 最后释放；不得把 dependent tracking 当成 Persistence/Timer 自动依赖边，也不得改变直接 apply profile 的显式 dispose 顺序。
- [ ] 现行 Host fixtures 的 legacy Root 直读全部迁移到同一双形态解析纪律，npm 与 rc.12 通道都有行为证据。
- [ ] Registry、Hub/Peer、Clock 的冻结服务 getter 形态继续通过 guard-Proxy 消费测试；公共类型、服务名、wire protocol 与持久化布局不变。
- [ ] 复用 Ticket 1 的工件验真夹具、模块解析断言和 Root 通道探针，不建立第二套验真机制。
- [ ] 每个基线分别通过全仓 typecheck，以及 Registry Cordis、Hub/Peer plugin、SessionHost、guard-Proxy、Nomicore DSH profile 和第三方组合根相关测试。
- [ ] 不采用 volatile config 或 Cordis internal config/update/commit 事件，不修改历史 artifacts，不执行真实 MABF/DSH 部署或 patch 移除。

## Blocked by

- #470


## Comments
