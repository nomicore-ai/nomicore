# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #421
Title: Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章（spec #415 T4）
State: open
Issue updated at: 2026-09-21T18:08:39Z

## Issue body

## Parent

PR #416（spec/415-replication-transport-decoupling）

## What to build

ADR 0032 决策 1/2/3/4 的连接级半边出面：导出 `createHubReplicationEdge` 普通工厂（非 Cordis 插件——无 Registry 依赖）。入口复刻现有双形态：`accept(transport, { token })`（内部跑注入的 verifyToken）与 `acceptTrusted(transport, identity)`。职责全量落地：出站 sequence 盖章对外可见（多会话并发帧经 mux 后 per-connection 严格递增）、OPEN 准入管线全分支、路由键提取与无 sink 帧两分支、ERROR mini-decode（消费 T1 守卫的布局契约）。宿主回调 `resolveSessionSink(connectionKey, namespaceId, authorization)` 在 OPEN 授权通过后调用。

## Acceptance criteria

- [ ] edge 工厂从包公共入口导出，签名经 test-d 锁定
- [ ] OPEN 准入管线按序执行并有独立测试：HELLO/drain 门 → 全解码（畸形 ingress 收口）→ authorize（拒绝 = NAMESPACE_UNAUTHORIZED + 拒绝闩锁，重 OPEN 拒答 NAMESPACE_REOPEN_REQUIRES_RECONNECT；未授权 OPEN 不过缝）→ pending 有界缓冲（序保冲刷）→ 并发 OPEN 上界收口 → sink 解析失败响亮连接收口（INTERNAL_ERROR + 1011，零新错误码）→ 已建立会话转发
- [ ] 路由键文法校验两分支逐字节复现单体语义：违例 → MALFORMED_FRAME fatal 1002；合法无 sink → 合成 NAMESPACE_STATE_VIOLATION，连接存活
- [ ] ERROR 帧 mini-decode 有界扫描路由正确（连接级 ERROR 不路由）
- [ ] 出站盖章后 wire 帧与单体输出逐字节一致（同输入序列对比测试）
- [ ] liveness/GOAWAY/reauth/drain 提前完成观测在 edge 单测覆盖（settled 信号驱动）

## Blocked by

- #418（T2 Edge/SessionHost 拆分重构）

## Comments
