# MABF Task Brief

Repository: nomicore-ai/nomicore
Issue: #422
Title: hub 插件免 listen 模式（listen: false）与 nomicoreHubSessionHost 服务（spec #415 T5）
State: open
Issue updated at: 2026-09-21T23:09:09Z

## Issue body

## Parent

PR #416（spec/415-replication-transport-decoupling）

## What to build

ADR 0032 决策 5 的插件形态：hub 插件 `listen` 配置接受显式 `false` = 免 listen 模式——零 listener 合法装配，插件提供 `nomicoreHubSessionHost` Cordis 服务（注入 worker 本地 Registry/timer/clock/observer，不再要求 tokens/authorization/verifyToken/authorize 配置——认证授权是 edge 侧职责），该模式不提供 `nomicoreHubReplication` 服务。listen 模式行为与服务面逐字节不变。SessionHost 服务仅免 listen 模式提供（两入口并存属非法形态）。配置校验沿用构造期响亮 TypeError 纪律，拼写错误不得静默降级为免 listen。

## Acceptance criteria

- [ ] `listen: false` 装配成功并提供 `nomicoreHubSessionHost` 服务；服务签名经 test-d 锁定
- [ ] 免 listen 模式不创建任何 socket listener；零网络面
- [ ] 免 listen 模式不提供 `nomicoreHubReplication`（消费方得到服务不可用错误）
- [ ] listen 模式既有插件测试全绿（服务面、校验、装配行为逐字节不变）
- [ ] 非法配置（含 listen 字段拼写变体）构造期响亮 TypeError，无静默降级
- [ ] 服务 teardown 纪律：stop 后会话全部收口、timer 清零（沿用插件既有 effect/反向 yield 模式）

## Blocked by

- #420（T3 SessionHost 公共工厂）

## Comments

