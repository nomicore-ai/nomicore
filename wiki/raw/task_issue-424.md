# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #424
Title: 分片形态端到端等价性验收（spec #415 T7）
State: open
Issue updated at: 2026-09-22T00:33:11Z

## Issue body

## Parent

PR #416（spec/415-replication-transport-decoupling）

## What to build

阶段收官验收：用内存管道把 edge 与多个 session host 实例按「一条连接、多 namespace、多会话宿主」拓扑接线（模拟 nomic-server 的 ingress/worker 分片），证明 ADR 0032 的语义等价承诺。核心证据 = 授权等价性：同一授权表下，单体 listen 模式与 edge+session 分片形态对同一 OPEN 序列的 wire 输出逐帧一致（拒绝/通过/重 OPEN 全矩阵）。叠加完整协议回合跨缝集成（bootstrap/live update/reconcile/CLOSE/revoke/reauth drain），以及多 worker 并发场景下出站 sequence 经 edge 盖章后 per-connection 严格递增的断言。

## Acceptance criteria

- [ ] 授权等价性矩阵逐帧一致：通过 / NAMESPACE_UNAUTHORIZED 拒绝 / authorizer 抛错 INTERNAL_ERROR / 闩锁期重 OPEN 拒答，四种形态单体 vs 分片 wire 输出逐字节相同
- [ ] 跨缝完整协议回合绿灯：OPEN→bootstrap→live→reconcile→CLOSE，含 UPDATE_CHUNK 协商与非协商两形态
- [ ] 一条连接复用多 namespace 分属不同 session host 实例：帧 demux/mux 正确，出站 sequence 严格递增
- [ ] 连接终结传播：edge 关闭 → 全部 session close 信号到达且资源释放（无泄漏断言）
- [ ] revoke/reauth 经 edge 入口路由到正确 session（terminateUnauthorized 信号）且 wire 行为与单体一致
- [ ] 既有 listen 模式全量套件 + 根 pnpm typecheck/test 绿灯（阶段收官门禁）

## Blocked by

- #420（T3 SessionHost 公共工厂）
- #421（T4 Edge 公共工厂）
- #422（T5 hub 插件免 listen 模式）

## Comments
