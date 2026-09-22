# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #419
Title: 路由键契约 codec 守卫测试（spec #415 T1）
State: open
Issue updated at: 2026-09-21T14:21:34Z

## Issue body

## Parent

PR #416（spec/415-replication-transport-decoupling）

## What to build

为 ADR 0032 的路由键契约在 `@nomicore/replication-protocol` 落地结构性守卫测试：锁死 namespace 域帧的 namespaceId 定偏移布局（varString 长度前缀恒 1 字节、帧字节 [21..56]）、UPDATE_CHUNK 的 kind 首字段偏移（namespaceId 在 [22..57]）、ERROR payload 字段序（code → fatal → retryable → relatedSequence? → namespaceId? → safeMessage）。codec 字段序一旦漂移，测试响亮失败——edge 的 O(帧头) demux 依赖这些布局事实。纯增量测试，零行为变化。

## Acceptance criteria

- [ ] 每种 namespace 域消息型各有 golden 帧断言 namespaceId 的精确字节偏移与长度前缀
- [ ] UPDATE_CHUNK 三种 kind（含首 chunk 绑定块形态）的偏移断言
- [ ] ERROR 帧（连接级/namespace 级、relatedSequence 有无）的字段序守卫
- [ ] 守卫测试与 codec 同源消费布局常量/解码器（不手抄第二份字段序，防双向漂移）
- [ ] replication-protocol 全量既有套件（envelope/golden/malformed/fuzz/test-d）绿灯

## Blocked by

None (can start immediately).

（重发：前票 #417 已关闭。）

## Comments
