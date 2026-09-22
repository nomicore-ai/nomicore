# SA1 架构与实现设计 — issue #422：hub 插件免 listen 模式（`listen: false`）与 `nomicoreHubSessionHost` 服务（spec #415 T5）

- 任务类型：**Feature（能力缺口）**——不是 Bug 根因修复。
- 版本：iteration 1——按 SA2 评审 `wiki/raw/task_issue-422_sa2_review.md`（verdict reject；1 × MAJOR F1）对 iteration 0 原位修订；全文只描述当前一致设计，无历史层积。
- HEAD：`4ad13a3`（与 SA6 契约基线一致；PR #429 merge，含 #418/#419/#420/#421/#423）。
- 上游输入：`wiki/raw/task_issue-422.md`（Host-owned 简报；Issue 评论经 REST 读取为空）；`wiki/raw/task_issue-422_sa6_contract.md`（approve 契约，下称「契约」）；`wiki/raw/task_issue-422_sa2_review.md`（评审修订输入；§14 映射）；`wiki/raw/task_issue-422_design_conflict_report.md`（设计后冲突门禁，verdict **clear**，R1–R4 义务为本设计规范性约束——dispatch 明示 preserve）。
- 缺失输入：`wiki/raw/task_issue-422_relevant_decisions.md`、`wiki/raw/task_issue-422_conflict_report.md`（dispatch 前 SA8 产物；契约 §1/§15-U1 已登记。设计后冲突门禁已由 `task_issue-422_design_conflict_report.md` 补位（clear）；合入前 SA8 clear 义务仍开放——§13-F1）。
- 本设计不实现代码、不编写测试；交付物为本文档。

---

## 1. 任务类型、目标与非目标

### 目标（What to build，简报 :17）

1. hub 插件 `listen` 配置联合追加**精确 `false`** = 免 listen 模式：零 listener 合法装配。
2. 免 listen 模式发布 Cordis 服务 `nomicoreHubSessionHost`（`NOMICORE_HUB_SESSION_HOST_SERVICE`），注入 worker 本地 Registry/timer/clock/observer；**不再要求** tokens/authorization/verifyToken/authorize 配置（认证授权是 edge 侧职责，ADR 0032:65）。
3. 免 listen 模式**不提供** `nomicoreHubReplication`（消费方得到服务不可用错误）；SessionHost 服务**仅**免 listen 模式提供（两入口并存属非法形态）。
4. listen 模式行为与服务面**逐字节不变**（回归由既有 15 项插件测试 + 包全量背书）。
5. 配置校验沿用**两层**响亮纪律，均与 listen 模式对齐：键表/形状层构造期 `TypeError`（`listen` 拼写/伪值变体不得静默降级为免 listen——仅精确 `false` 选择该模式）；limits/timeouts **值域层**装配期 `TypeError`（复用 `validate.ts` 校验器，与 listen 模式经 `createHubReplication` 同判同时机——D7，SA2 F1 修订）。
6. teardown 纪律：`service.stop()` 后会话全部收口（通道终态 `closed`）、插件 OwnedTimer 清零；沿用插件既有 effect/反向 yield 模式。

### 非目标（契约 §1.1 对齐）

- listen 模式任何行为变化（零容忍，AC4）。
- wire 格式、协议错误码、事件词汇变化（零触碰；协议 §17/:582、§23.1/:833 已登记分片形态，无需修订）。
- `createHubSessionHost` 工厂面变化（#420 已冻结：`hub-session-host.ts` 零 diff）。
- `nomicoreHubReplication` 形态变化；peer 侧任何变化。
- `worker_threads`/`MessageChannel`/真跨线程 pipe（ADR 0032 决策 2 禁依赖；决策 5 γ 留后续票，#418 R4''/R5''）。
- nomic-server 宿主接线（ingress=edge / namespace home worker=SessionHost 消费方）——本票只交付 nomicore 侧服务面。
- #421 设计 §13 登记的工厂级服务面聚合（connections/revoke 广播/close 全量）——不预留。
- 服务面聚合成员（`requestReauth` 等连接级成员）——契约 U4 冻结为不混入。

---

## 2. 当前行为与证据锚点（HEAD 事实）

| # | 事实 | 锚点 |
| --- | --- | --- |
| B1 | `createHubReplicationPlugin({listen:false},{})` 构造期 `TypeError: hub replication listen: invalid configuration`（`assertRecord` 拒绝布尔） | `src/plugin.ts:292`（→ `:160-165`）；契约 §5 复现 3/3 |
| B2 | `HubReplicationPluginConfig.listen` 类型仅为 listen 设置对象（无 `false` 成员） | `src/plugin.ts:86-92` |
| B3 | 校验链无条件要求 listen 形状 → adapter → 认证 → 授权，顺序固定 | `src/plugin.ts:289-316`（`:298` adapter 必需、`:301-302` 认证/授权必需） |
| B4 | `start()` 无条件 `createHubReplication(...)` + `await listen.listen(...)` + `provide(NOMICORE_HUB_REPLICATION_SERVICE)` | `src/plugin.ts:385-448`（`:392`、`:406`、`:445`） |
| B5 | 模块增强仅声明 `nomicoreHubReplication`/`nomicorePeerReplication`；公共入口 13 名导出零 SessionHost 服务面命中 | `src/plugin.ts:143-148`；`src/index.ts:11-18,25-41`；契约 §5 CAP-12 |
| B6 | #420 工厂在场且已冻结：`createHubSessionHost(config): HubSessionHost`；`open(input)` 返回 `HubSessionHandle`（5 成员）；`(connectionKey,namespaceId)` 唯一性响亮拒绝；句柄 `close()` 幂等（同一 promise） | `src/hub-session-host.ts:86-89,243-257,261`；`src/index.ts:6` |
| B7 | 会话收口语义：`handle.close()` → `sink.close()`（同步前缀全通道 quiesce：state→closing + clearAllTimers + 摘订阅；异步尾 `onConnectionClosed`：drain→settleClose→setState('closed')）；连接级 close **不发射 `settled`** | `src/hub-session.ts:277-283`；`src/hub-namespace.ts:1181-1189,1204-1212`；契约 E2a–E2e 实测 |
| B8 | `terminateUnauthorized()` = revoke 链：终局 `failed` + 清 timer + 幂等 | `src/hub-namespace.ts:1191-1198` |
| B9 | 工厂配置要求**已解析** `ResolvedLimits`/`ResolvedTimeouts`（组合根 resolve+validate 后注入——`hub-session-host.ts:47` 注释明文「组合根 resolve+validate 后注入（既有纪律）」）；仓内三处组合根统一为 resolve + `validateLimits`/`validateTimeouts` + 分块族显式激活链的**完整形态**（`hub-connection.ts:76-100`、`hub-edge-host.ts:761-777`、`peer-connection.ts:105-131`）；`hub-session.ts`/`hub-session-host.ts` **零 validate import**（grep 证实）——免 listen 形态下插件即组合根，validate 半边只能落在插件 | `src/hub-session-host.ts:44-52`；`src/defaults.ts:61-70`；`src/validate.ts:140-206,223-264,266-282`；grep 证据 |
| B10 | 插件服务构造纪律：`Object.freeze` 字面量 + 函数成员访问器属性（getter 返回稳定闭包）——冻结服务可被 DSH 沙箱 Proxy 合法消费 | `src/plugin.ts:431-441,509-550`；ADR 0023（`docs/adr/0023-proxy-consumable-frozen-service-surfaces.md`） |
| B11 | teardown 既有模式：`ctx.effect(function*(){ const revoke = ctx.provide(...); yield revoke; yield stop; })`——反向 yield 序 = 先 stop 后 revoke（drain 期间服务在场）；stop 幂等（`stopPromise ??=`）；OwnedTimer 兜底 `dispose()` | `src/plugin.ts:173-212,421-430,442-448`；既有测试 `test/ws-replication-plugin.test.ts:170-203` |
| B12 | `ReplicationTimer = { setTimeout, clearTimeout }`——插件 `OwnedTimer` 结构满足 | `src/types.ts:111-114`；`src/plugin.ts:173-212` |
| B13 | 冻结导出测试：`FROZEN_PRODUCTION_EXPORTS` 13 名 + `:553` 断言 `Object.keys(productionApi).sort()).toEqual(...)` | `test/ws-replication-issue418-edge-session-split-contract.test.ts:144-158,553` |
| B14 | 既有 listen 模式消费方：`apps/yjs-server/src/app.ts:419`（listen 对象配置）、包 README :9、第三方宿主指南 `docs/integration/cordis-plugin-hosting.md:18,195-200` | grep 证据（§10 矩阵） |
| B15 | 基线绿：包全量 90 files / 785 tests + `tsc` exit 0（clean tree） | 契约 §4/§13（`artifacts/sa6-issue422-baseline-package-suite.log`） |

---

## 3. 能力缺口（非缺陷根因）

五维缺口（契约 §5 四维 + SA2 F1 修订追加的值域维，全部由本设计闭合）：

| 面 | HEAD 事实 | 缺口性质 |
| --- | --- | --- |
| 配置联合 | `listen: false` 类型错（TS2322）+ 构造 TypeError | 无免 listen 表达 |
| 公共入口 | 无 `NOMICORE_HUB_SESSION_HOST_SERVICE`/`requireHubSessionHost`/`HubSessionHostService`/`HubSessionHostStatus` | 无服务签名面 |
| 服务面 | `ctx.get('nomicoreHubSessionHost')` 恒 `undefined` | 无发布点 |
| 装配副作用 | `start()` 无条件 adapter + `createHubReplication` + provide 复制服务 | 无免 listen 分支 |
| 配置值域校验 | listen 模式同配置经 `createHubReplication` 装配期响亮 `TypeError`（`hub-connection.ts:76-100`）；iteration 0 设计的免 listen 分支仅 resolve 不校验（SA2 F1 判 MAJOR「一响一静」） | 免 listen 值域校验半边缺席 → D7（iteration 1）补齐 |

在场基础（非缺口）：#420 工厂 + 真 Registry/Runtime 可驱动完整 OPEN 回合（契约 E1 13/13；registry.open 恰一次、`timeouts` 原值到达 session 定时器 arm 点、observer `side:'hub'` 事件可观察）——服务轨只是把工厂面接入 Cordis 生命周期。

排除项（契约 §11，本设计采纳）：环境/夹具/入口故障（同进程负控 40 项绿）；其他免 listen 开关（`HUB_CONFIG_KEYS` 无第二开关）；工厂轨可替代服务轨（ADR 0032:64 明示双轨）；`settled` 可作 stop 判据（E2e 实测反例：连接级 close 不经 `notifySettled`）；免 listen 仍要求 tokens/authorization（与 ADR 0032:65 直接矛盾）；两入口并存（简报 :17 非法形态）。

---

## 4. Owner 要求落实

Issue 评论经 REST 读取为**空**（dispatch 明示 none）；无 Owner 评论要求。契约义务仅由 Issue 正文 AC1–AC6 + ADR 0032 决策 5 构成：

| 来源 | 要求 | 设计承接 |
| --- | --- | --- |
| Issue 正文 :21（AC1） | `listen:false` 装配成功 + 服务签名 test-d 锁定 | §7 D1/D5/D8；§12 映射 C1a–C1f/T1–T4 |
| :22（AC2） | 零 listener、零网络面 | §7 D2/D4（adapter 零调用）；C2a–C2d |
| :23（AC3） | 不提供 `nomicoreHubReplication` | §7 D5（无 provide）；C3a–C3c |
| :24（AC4） | listen 模式逐字节不变 | §7 D1/D2（校验链零重排）+ 文件范围 DENY 既有测试；C4a–C4f |
| :25（AC5） | 非法配置构造期响亮 TypeError、无静默降级 | §7 D1（精确 `false` 严格相等——键表/形状层，构造期）+ §7.6 D7（值域层，装配期响亮——与 listen 模式既有两层纪律同构；「无静默降级」对值域同样成立）；C5a–C5g |
| :26（AC6） | stop 后会话收口、timer 清零 | §7 D6（通道终态 + timer 清零判据，非 `settled`）；C6a–C6d |
| ADR 0032:30 | 免 listen = 显式 `listen:false`；SessionHost 服务仅免 listen 提供 | §7 D1/D5 |

---

## 5. 复现和根因承接（SA6 契约事实 → 设计响应）

| 上游事实 | 证据位置 | 设计响应 |
| --- | --- | --- |
| S2 构造期 TypeError 单点在 `validateHubConfig` 的 listen 断言 | 契约 §8；`plugin.ts:292` | D1：断言前置精确 `false` 分派（§7.1） |
| S3 类型联合缺口 | `plugin.ts:86-92`；TS2322 | D8：`listen: … | false` append-only（§7.7） |
| S4 服务面/公共入口缺口 | `plugin.ts:143-148`；`index.ts` | D8：新常量/类型/`requireHubSessionHost`/模块增强一行（§7.7） |
| S5 装配无条件 listen + provide 复制服务 | `plugin.ts:392,406,445` | D3：`start()` 模式分支——免 listen 分支零 adapter 调用、零 `createHubReplication`、零复制服务 provide（§7.3） |
| S6 消费面缺口（worker 侧宿主无入口） | 契约 §8-S6 | D5：服务发布 + `requireHubSessionHost`（§7.4） |
| S7 工厂面在场（#420 冻结） | `hub-session-host.ts:261` | D5：插件服务 = 工厂面 + `status` + `stop` 包装（零工厂改动） |
| S8 `settled` 不可作 stop 判据（连接级 close 不发射） | 契约 E2e；`hub-namespace.ts:1204-1212` | D6：收口判据 = 句柄 `close()` promise resolve（内含通道终态 `closed` + 清 timer）+ `timer.active` 清零；**不以 `settled` 为判据**（C6d 事实登记） |
| E1 工厂面可达（OPEN_OK/BOOTSTRAP_SNAPSHOT、registry.open 恰一次、`timeouts` 原值 plumb、observer `side:'hub'`） | 契约 §9-E1 | D5/D7：注入面直通（registry/timer/observer/limits/timeouts 解析+校验后入工厂） |
| E3 `timeouts.bootstrapTimeoutMs=1234` 原值到达 arm 点 | 契约 §9-E3 | D7：`mergeNested` 后 `resolveTimeouts`（+ `validateTimeouts` 值域门——1234 合法放行）→ 工厂 config |
| M1 falsy 陷阱变异（`!config.listen` 会让 5 形态静默降级，NC-3b 承重） | 契约 §9.1-M1 | D1：仅 `=== false` 严格相等；无任何 falsy 判定 |
| M2/M3 删除 listen 模式校验会红 NC-4a/NC-4b | 契约 §9.1 | D2：listen 模式校验链逐字节保留（零删除/零重排） |
| NM1 `=== undefined` → `== null` 等价改写零漂移 | 契约 §9.1 | D1 不触碰该表达式（`overrides.listen === undefined` 保持） |

---

## 6. SA8 约束落实

dispatch 前 SA8 产物（`*_relevant_decisions.md`/`*_conflict_report.md`）**缺失**（契约 §15-U1）。设计后冲突门禁已补位：`wiki/raw/task_issue-422_design_conflict_report.md`（独立对照 ADR 全集 30 份 + CONTEXT.md + 协议全文 + 包 AGENTS；verdict **clear**——implements-existing-decision ×5、no-conflict ×13、零 evolution-required/hard-conflict/override）。其 R1–R4 义务（实现后复查清单、文档同变更集、宿主侧文档观察项、合入前 SA8 clear 未闭合声明）为本设计的规范性约束，iteration 1 修订全部保持。决策摘录仍由本设计直接从权威文本取证；合入前 SA8 clear 义务保持开放（§13-F1）。

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
| --- | --- | --- | --- |
| ADR 0032 决策 5（:30）：免 listen = 显式 `listen:false`；`nomicoreHubSessionHost` 仅免 listen 模式提供 | §7 D1/D5 | implements-existing-decision：分派语义与服务面逐条兑现 | 否（按已接受决策落地） |
| ADR 0032 后果（:64）：SessionHost 双轨（工厂 + 免 listen 插件服务） | §7 D5 | 服务轨 = 工厂面 + `status` + `stop`（复用 #420，零工厂 diff） | 否 |
| ADR 0032 后果（:65）：免 listen 不消费 tokens/authorization/verifyToken/authorize；不提供 `nomicoreHubReplication` | §7 D2/D3 | 不再要求 + 零消费（不构造 staticVerifier/staticAuthorizer、不 plumb）；复制服务零 provide | 否 |
| ADR 0032 后果（:66）：公开面发布即冻结、演进 append-only | §7 D8；§11 授权编辑 | 纯追加（2 值 + 2 类型 + 配置联合成员 + 模块增强一行）；#418 冻结测试一次性授权编辑（契约 §12.8 授权，先例 #420/#421） | **是**（触碰冻结面 + 公共 API 扩展，见 §13） |
| ADR 0032 决策 2（:18）：不引入 worker_threads/MessageChannel 依赖 | §11 DENY；D5 进程内 | 零新依赖、零跨线程面（NC-6 结构门保持） | 否 |
| ADR 0032 附录 A2-β（:48）：authorize 不在 session 侧调用；描述子纯 JSON | §7 D5 | 服务 `open` 原样转发 `HubSessionOpenInput`（工厂已冻结语义，零改动） | 否 |
| ADR 0032 附录 A3（:53）：dormant 降级面（dataGateOpen 恒 true 等） | §7 D5 | 工厂内已实现，服务轨不触碰 | 否 |
| ADR 0023：冻结服务函数成员访问器属性构造 | §7 D5 | `Object.freeze` + getter（`status`/`open`/`stop`） | 否 |
| 协议 §17（:582）/§23.1（:833）：分片形态计数口径与发射侧归属已登记 | §11 DENY 协议文档 | 零修订（#423 已登记） | 否 |
| 包 AGENTS：role-specific 插件只消费 Instance/Clock/Timer/Registry；teardown 归属插件自有资源；公共导出仅经 `src/index.ts` | §7 D3/D5；§11 | `inject` 四服务不变（契约 U8）；插件只拥有会话台账 + OwnedTimer + 服务；新导出经 `src/index.ts` | 否 |
| 契约 U1：无 SA8 门禁产物，合入前应补 SA8 clear | §13-F1；设计后冲突报告 R4 | 设计后冲突门禁已 clear（R4：R1 完成前不得视为已清）；合入前 SA8 clear 义务保持开放 | **是**（与 :66 冻结面项合并；**F1 修订新增的免 listen 装配期值域失败类并入复查范围**——SA2 §15-3） |

---

## 7. 设计决策与主要备选方案

### 7.1 D1 — 配置分派：精确 `false` 严格相等（AC5 承重）

`validateHubConfig` 在两条**通用** record 断言（config 键表 `:290`、overrides 键表 `:291`）之后插入分派：

```ts
if (config.listen === false) {
  validateHubSessionOnlyConfig(config, overrides);   // 新函数（§7.2 子集）
  return;
}
// ↓ 以下 listen 模式断言链与 HEAD :292-316 逐字节一致（零删除、零重排、零消息变化）
```

- 仅 `=== false`（严格相等）选择免 listen。`0`/`''`/`null`/`undefined`/`NaN`/`true`/`'false'`/`[]`/`{}`/缺 host/port/空 host/端口越界/path 非绝对/嵌套拼写键共 16 形态全部落入既有 listen 模式断言链并保持 `TypeError`（消息含 `hub replication`）——NC-3 ×16 与 NC-3b ×16（静默降级敏感性锚，M1 实证）由此承重。
- 顶层拼写键（如 `{lisen:false}`）由前置的 `assertRecord(config, 'hub replication config', HUB_CONFIG_KEYS)` 拒绝——分派位置在它之后，该路径不受影响。
- `{listen: undefined}`（缺省 ≠ 免 listen）经 `undefined !== false` 落入 listen 分支被 `assertRecord(undefined, …)` 拒绝——「缺省不得隐式免 listen」成立。
- **否决备选**：falsy 判定（`!config.listen`）——M1 变异证明 5 形态静默降级；宽松相等/类型 coercion——同类风险；`listen` 键可缺省——与简报「显式 `listen: false`」直接矛盾。

### 7.2 D2 — 校验矩阵：免 listen 子集镜像 listen 模式既有顺序

新函数 `validateHubSessionOnlyConfig`（plugin.ts 内私有）执行免 listen 模式校验子集，子序列顺序镜像 listen 模式既有顺序（tokens/authorization 形状 → limits/timeouts records → verifyToken/authorize/listen/observer 形状）：

| 校验项 | listen 模式（现状保持） | 免 listen 模式（新） |
| --- | --- | --- |
| `config` 顶层键表 / `overrides` 键表 | 共有（分派前，逐字节不变） | 同左 |
| listen 形状（host/port/path record + 值域） | 必须（`:292-297` 不变） | **跳过**（`false` 不是 record） |
| `overrides.listen` adapter **必需** | 必须（`:298` 不变） | **不要求**（C2c：无 adapter 不得抛 `listen adapter is required`） |
| `overrides.listen` adapter **形状**（提供时） | 必须（`:311-314` 不变） | 提供 `!== undefined` 时校验同款形状（见 D4：校验 ≠ 消费） |
| tokens/authorization **必需**（含 verifyToken/authorize 豁免链） | 必须（`:301-302` 不变） | **不要求**（ADR 0032:65） |
| tokens/authorization **形状**（合并选择 `overrides.x ?? config.x`，提供时） | 必须（`:303-304` 不变；整集合替换语义） | 同左（仅提供时；整集合替换语义镜像 `:99-102`） |
| limits/timeouts 四处 record 键表（**构造期**） | 必须（`:305-308` 不变） | 同左（**两模式共有**——timeouts 必须 plumb 到 session 定时器，C1d） |
| limits/timeouts **值域**：正有限安全整数 + 无条件跨字段链 + 分块族显式激活链（**装配期**，经 `validate.ts`） | 必须（经 `createHubReplication` 组合根，`hub-connection.ts:76-100`） | 同左（免 listen 分支在插件内执行同款 resolve+validate——D7；**两模式共有**；SA2 F1 修订） |
| verifyToken/authorize 函数形状（提供时） | 必须（`:309-310` 不变） | 同左（提供时；零消费） |
| observer 函数形状（提供时） | 必须（`:315` 不变） | 同左（observer 是免 listen 模式**被消费**的注入面，C1d） |

理由：(a) 键表/形状校验是插件统一的构造期响亮纪律，对「提供了但畸形」的配置静默放行正是 AC5 精神所禁；(b) 免 listen 模式**被消费**的面（limits/timeouts/observer）与 listen 模式完全一致，校验保持一致——**两层皆是**：键表/形状在构造期（本函数），值域在装配期（D7，复用 `validate.ts`；iteration 0 只做了前一层，SA2 F1 判「一响一静」MAJOR，iteration 1 补齐）；(c) listen 模式链零重排保证 AC4 的错误次序与消息逐字节不变。

### 7.3 D3 — 装配分派：单插件主体 + `listenMode` 绑定记录

`createHubReplicationPlugin` 保持**单一**工厂/单一 `apply` 前缀/单一插件返回形状；构造期在通用合并后做条件绑定：

```ts
validateHubConfig(config, overrides);
const limits = mergeNested(config.limits, overrides.limits);     // 不变
const timeouts = mergeNested(config.timeouts, overrides.timeouts); // 不变
const sessionOnly = config.listen === false;
// 免 listen 模式不构造 verifier/authorizer/adapter 绑定（ADR 0032:65「不再消费」——
// 连 staticVerifier/staticAuthorizer 闭包也不建，避免任何「消费配置」的解读空间）
const listenMode = sessionOnly ? undefined : {
  verifyToken: overrides.verifyToken ?? staticVerifier(overrides.tokens ?? config.tokens ?? []),
  authorize:   overrides.authorize   ?? staticAuthorizer(overrides.authorization ?? config.authorization ?? []),
  listen:      overrides.listen!,
  endpoint:    config.listen,        // TS 已窄化为 listen 设置对象
};

async function start(ctx, identity, clock, registry, timer) {
  if (listenMode === undefined) {
    startHubSessionHostService(ctx, identity, clock, registry, timer);
    return;
  }
  // ↓ listen 模式主体：表达式/调用次序/消息与 HEAD :392-448 一致，
  //    引用由裸名改为 listenMode.verifyToken / .authorize / .listen / .endpoint.{host,port,path}
}
```

- `apply` 前缀（`requireNomicoreInstance` → `assertRole('hub')` → `requireClock` → `requireNomicoreRegistry` → `timerFromContext`）两模式共享、零改动——C1e（peer 角色先于一切装配副作用同步拒绝、零 listener/零服务）由同一代码背书。
- 插件返回形状 `{inject, apply, get replication(), get listener()}` 两模式一致：免 listen 模式 `replication`/`listener` 恒 `undefined`（C2b 白盒面）。
- `inject` 保持 `['nomicoreInstance','clock','timer','nomicoreRegistry']`（契约 U8 冻结；免 listen 模式同样消费四者——instanceId/角色、时钟采样、session 定时器、Registry open）。
- 免 listen 分支对合并后的 `limits`/`timeouts`（`:362-363` 闭包变量，两分支共享同一 `mergeNested` 结果）的全部消费都经 D7 的 resolve+validate 半边（`startHubSessionHostService` 顶部）；listen 分支继续经 `createHubReplication` 组合根自带的同款校验——**同一份合并输入、同一套校验器**，两模式激活判据字节等价（D7）。
- **否决备选**：早期 return + 独立 `createSessionOnlyPlugin` 工厂（listen 主体零文本改动）——代价是 `apply` 前缀/角色纪律/插件外壳双份实现，C1e 纪律出现两处可漂移点，与仓内「单份实现」纪律相悖；新增公共工厂导出名也无 ADR 授权（§7.9-D9a）。

### 7.4 D5 — 服务构造：工厂面 + 会话台账 + 包装句柄 + ADR 0023 冻结面

`startHubSessionHostService`（plugin.ts 内私有，参考实现）：

```ts
function startHubSessionHostService(ctx, identity, clock, registry, timer): void {
  // ── 组合根 resolve + validate（B9 完整形态；SA2 F1 修订）──
  // 与 hub-connection.ts:76-100 / hub-edge-host.ts:761-777 / peer-connection.ts:105-131
  // 三处既有组合根同款：resolve 在前、值域校验在后、分块族链按「显式表达才激活」窄门接线。
  // 抛错时机 = apply 期（本函数在 start() 的免 listen 分支内同步执行，TypeError 经
  // async start() 成为 apply() promise 的 rejection）——与 listen 模式经 createHubReplication
  // 的时机逐点对齐，且早于 ctx.provide（零服务、零会话、零已注册定时器——见 D7 时机论证）。
  const resolvedLimits = resolveLimits(limits);        // defaults.ts:61-63
  const resolvedTimeouts = resolveTimeouts(timeouts);  // defaults.ts:65-70；C1d：1234 原值到达 arm 点
  validateLimits(resolvedLimits);                      // validate.ts:140-206（值域 + 无条件跨字段链）
  validateTimeouts(resolvedTimeouts);                  // validate.ts:266-282（含 pongTimeoutMs < pingIntervalMs）
  // 分块族显式激活链（hub-connection.ts:85-100 同款窄门）：门看「调用方显式表达」面 =
  // mergeNested 合并结果（listen 分支传给 createHubReplication 的正是同一对象，plugin.ts:399），
  // 两模式激活判据字节等价；仅显式表达链上键时激活（N5/N6 非追溯性，validate.ts:208-243 注释）。
  if (limits != null && (Object.prototype.hasOwnProperty.call(limits, 'maxChunkedUpdateBytes')
    || Object.prototype.hasOwnProperty.call(limits, 'maxChunksPerUpdate'))) {
    validateChunkedTransferChain(resolvedLimits);      // validate.ts:223-234
  }
  if (limits != null && Object.prototype.hasOwnProperty.call(limits, 'maxChunkedBootstrapBytes')) {
    validateChunkedBootstrapChain(resolvedLimits);     // validate.ts:245-251
  }
  if (limits != null && Object.prototype.hasOwnProperty.call(limits, 'maxChunkedSyncDiffBytes')) {
    validateChunkedSyncDiffChain(resolvedLimits);      // validate.ts:258-264
  }
  const host = createHubSessionHost({
    registry,                                  // ctx Registry（worker 本地事实）
    instanceId: identity.instanceId,
    limits: resolvedLimits,                    // B9：已解析且已校验（工厂零校验——组合根义务）
    timeouts: resolvedTimeouts,
    timer,                                     // OwnedTimer 结构满足 ReplicationTimer（B12）
    ...(overrides.observer === undefined ? {} : { observer: overrides.observer }),
    clock: { now: () => clock.now() },         // 采样仍由工厂按 observer 在场门控（hub-session-host.ts:207-208）
  });
  const sessions = new Map<string, HubSessionHandle>();   // 台账：已开启且未收口
  let stopPromise: Promise<void> | undefined;
  let stopped = false;

  const open = (input: HubSessionOpenInput): HubSessionHandle => {
    if (stopped) throw new Error('nomicore hub session host service is stopped');  // C6b：stop 后响亮拒绝
    const handle = host.open(input);           // 描述子/唯一性校验由 #420 冻结工厂响亮承担（B6）
    const key = `${input.connectionKey}\u0000${input.namespaceId}`;  // 与工厂台账同构键
    const release = (): void => { sessions.delete(key); };
    let closePromise: Promise<void> | undefined;
    let terminatePromise: Promise<void> | undefined;
    const wrapped: HubSessionHandle = {        // 5 成员全委托；close/terminate 记账
      handleFrame: (frame) => handle.handleFrame(frame),
      onFrame: (listener) => handle.onFrame(listener),
      onSignal: (listener) => handle.onSignal(listener),
      terminateUnauthorized: () =>
        terminatePromise ??= handle.terminateUnauthorized().then(release),
      close: () => closePromise ??= handle.close().then(release),
    };
    sessions.set(key, wrapped);
    return wrapped;
  };

  const stop = (): Promise<void> => stopPromise ??= (async () => {
    stopped = true;
    try {
      await Promise.all([...sessions.values()].map((entry) => entry.close()));
    } finally {
      timer.dispose();       // OwnedTimer 兜底清零（B11 既有纪律）
      sessions.clear();
    }
  })();

  // ADR 0023：函数成员访问器属性（getter 返回稳定闭包）——冻结服务可被 Proxy 包装消费
  const service: HubSessionHostService = Object.freeze({
    get status(): HubSessionHostStatus {
      return { state: stopped ? 'stopped' : 'ready', sessions: sessions.size };
    },
    get open() { return open; },
    get stop() { return stop; },
  });

  ctx.effect(function* () {
    // 反向 yield 序 = [stop, revoke]：drain 期间服务在场（与 hub/peer 既有模式同构，:442-448）
    const revoke = ctx.provide(NOMICORE_HUB_SESSION_HOST_SERVICE, service);
    yield revoke;
    yield stop;
  }, 'ws-replication: hub session host service');
}
```

关键语义：

- **`status.sessions` 定义**：已开启且 `close()`/`terminateUnauthorized()` 尚未 fulfill 的句柄数。`release` 仅在 fulfill 时摘账（reject 时保留——会话**未**收口，计数诚实；stop 会再次 await 同一 rejected promise 并响亮传播）。诚实计数原则适用于 `stop` 之前的个别 close/terminate 失败；`stop` 一经进入即按闩锁语义清空台账并以 rejection 承载失败信号——`status.sessions === 0` 与「stop 响亮 reject」并存是冻结类型注释「stop 后恒 0」钉死的既定形态（SA2 OBS-1 调和，行为零变化）。`wrapped.close` 记账级 memoize 保持句柄「重复调用返回同一 promise」的冻结幂等语义（B6/`hub-session.ts:277-283` 工厂侧另有 `closeTail` memoize，双层各自幂等）。
- **收口判据 = `handle.close()` promise resolve**（其内同步前缀 quiesce + 异步尾 `onConnectionClosed` 汇流——resolve 时通道已处终态、通道定时器已清，B7）+ `timer.active` 清零；**不以 `settled` 信号为判据**（契约 C6d/E2e：连接级 close 不发射 `settled`）。
- **包装必要性**：不包装则服务无收口事实源（工厂句柄的关闭对服务不可观察）；包装是唯一不触碰 #420 冻结面的计数途径。包装对象不冻结（与工厂句柄同姿态；ADR 0023 约束的是**发布服务**，句柄不经 `ctx.get` 分发）。
- **服务成员集**（契约 U4 冻结）：`open`（= #420 `HubSessionHost` 面）+ `status` + `stop`；连接级成员（`requestReauth` 等）不混入（C3c test-d 负控 + 运行时 `undefined`）。
- **服务发布时序**：免 listen 分支无异步门（无 listener 可等）——合法配置下 `apply` 返回的 promise 在 resolve+validate（D7）通过、同步发布后 resolve；`requireHubSessionHost` 立即可用（C1a/C1b）。值域违例时该 promise rejection（D7 时机论证——C5d–C5f）。
- **继承的工厂语义**（不改）：同 `(connectionKey,namespaceId)` 重复 `open` 响亮拒绝；工厂内部台账不随关闭拆除（「session 对象随连接存活」，CONTEXT.md:230）——重开同键在工厂侧本就拒绝，服务台账键与之同构、无双源分歧。

### 7.5 D6 — teardown：stop → 全会话并发收口 → timer 兜底 → 反向 yield 撤销

顺序与幂等（C6a–C6c）：

1. `stopped = true`（先行——此后 `open` 响亮拒绝；JS 单线程，无竞态窗口）。
2. `Promise.all(全部台账句柄 .close())`——每句柄走工厂幂等 close；resolve 即通道终态 `closed`（observer `channel-state-changed{side:'hub',namespaceId,to:'closed'}` 已发射）+ 通道定时器已清。
3. `finally { timer.dispose(); sessions.clear(); }`——OwnedTimer 兜底（无论 close 结果如何 timer 清零；`timer.active.size === 0` 判据达成）。
4. `ctx.fiber.dispose()` 触发 effect 反向 yield：先 `stop`（若消费者未显式调用）后 `revoke`——`requireHubSessionHost` 此后抛 `/unavailable/`，timer 保持 0，零 listener 残留。
5. `stop` 幂等：`stopPromise ??=` 模式（与 listen 模式 `:421` 同构），二次调用返回同一 promise（C6a）。

失败语义：会话 close reject 时 `stop` 的 promise reject（响亮传播，无吞错、无静默 fallback）；`finally` 保证 timer 仍清零。`Promise.all` 任一 reject 即短路——其余句柄的 close 已各自启动（幂等，可由后续 stop 重入完成），失败可重试（重复 `stop()` 返回同一 rejected promise；调用方可另行调用后重新 `ctx.fiber.dispose()` 走 effect 路径）。

### 7.6 D7 — limits/timeouts 解析 + 值域校验：复用 `defaults.ts` resolver 与 `validate.ts` 校验器（组合根纪律完整形态；SA2 F1 修订）

`createHubSessionHost` 要求 `ResolvedLimits`/`ResolvedTimeouts`，且**工厂本身零校验**（B9：`hub-session-host.ts:47` 配置注释明文「组合根 resolve+validate 后注入（既有纪律）」；`hub-session.ts`/`hub-session-host.ts` 零 validate import，grep 证实）。免 listen 形态下插件即组合根，因此 `startHubSessionHostService` 顶部执行**完整形态**（§7.4 参考实现前段）：

1. **resolve**：`resolveLimits`/`resolveTimeouts`（`defaults.ts:61-70`）把 `mergeNested` 结果合入 `DEFAULT_REPLICATION_*`——零新解析逻辑、零逐字段 clamp（§15.1 禁区）。
2. **validate（无条件）**：`validateLimits(resolvedLimits)` + `validateTimeouts(resolvedTimeouts)`（`validate.ts:140-206`/`:266-282`）——正有限安全整数值域 + 无条件跨字段链（`lowWater < highWater`、`maxBootstrapBytes ≤ maxFrameBytes − 协议开销`、`maxQueuedControlBytes ≥ maxBootstrapBytes + 开销`、`pongTimeoutMs < pingIntervalMs` 等）。
3. **validate（条件激活）**：分块族三链按 `hub-connection.ts:85-100` 同款**显式激活窄门**接线——仅当合并结果上显式存在链上键（`maxChunkedUpdateBytes` ∨ `maxChunksPerUpdate` → `validateChunkedTransferChain`；`maxChunkedBootstrapBytes` → `validateChunkedBootstrapChain`；`maxChunkedSyncDiffBytes` → `validateChunkedSyncDiffChain`）时对**合并结果**校验（N5/N6 非追溯性纪律，`validate.ts:208-243` 注释；协议 §17「显式配置…时对应链式校验响亮生效；未表达新键的存量配置不误判」）。门输入 = `mergeNested(config.limits, overrides.limits)` 合并结果——listen 分支传给 `createHubReplication` 的正是这同一对象（`plugin.ts:399`），两模式激活判据**字节等价**。
4. 全部通过后才注入 `createHubSessionHost`（校验失败即 `TypeError`，工厂零调用、零残留）。

**勿新写第二套校验**（SA2 §10 平行机制检查）：校验器一律从 `src/validate.ts` import 既有五函数——`validateLimits`/`validateTimeouts`/`validateChunkedTransferChain`/`validateChunkedBootstrapChain`/`validateChunkedSyncDiffChain`；DENY 的 `validate.ts` 指编辑，不禁止 import（SA2 §11 确认）。

**抛错时机 = apply 期（选定，论证）**：校验位于 `startHubSessionHostService`（`start()` 免 listen 分支内同步执行），`TypeError` 经 async `start()` 成为 `apply()` 返回 promise 的 rejection——与 listen 模式**逐点对齐**：listen 模式同配置的值域 `TypeError` 同样发生在 apply 期（`start()` → `createHubReplication` 构造器，`plugin.ts:392` + `hub-connection.ts:76-79`；同为 apply promise rejection）。同一份畸形配置在两模式下于**同一生命周期点、以同一错误家族**（`validate.ts` 的 `TypeError`，消息前缀 `limits:`/`timeouts:`，无 `hub replication` 前缀——两模式一致的现状）被拒绝——「同一畸形值在两模式下均被拒绝」的 parity 断言由此可承重（§12 C5f）。校验点先于 `ctx.provide`：拒绝时零服务发布、零会话、零已注册定时器（apply 前缀只做只读 require + OwnedTimer 包装，该点尚无句柄注册）——**零清理义务**。

**否决备选（构造期校验）**：把值域校验放进 `validateHubSessionOnlyConfig` 会在两模式间制造**新的时机不对称**——listen 模式 `{listen:{…}, limits:{lowWater:2,highWater:1}}` 构造成功、apply 期拒绝；免 listen 同配置构造期即拒。这正是 F1 谴责的「一响一静」分叉的时序翻版（一先一后），parity 断言也无法在生命周期点对齐的意义上成立。两层各与 listen 模式对齐的读法：AC5 的「构造期 TypeError」由键表/形状层承接（与 listen 模式 `:289-316` 同层同构，C5a–C5c 全构造期）；值域层遵循组合根装配期纪律（listen 模式现状）——无新语义源。该新增失败类（免 listen 装配期值域 `TypeError`）已登记进设计后冲突复查范围（§6/§13；SA2 §15-3）。

### 7.7 D8 — 公共面：契约 §12.1 冻结形态逐字落地

`src/plugin.ts`（既有成员零改名零删除，纯追加）：

```ts
import { createHubSessionHost } from './hub-session-host.js';                    // 值导入（装配）
import type { HubSessionHandle, HubSessionHost, HubSessionOpenInput } from './hub-session-host.js';
import { resolveLimits, resolveTimeouts } from './defaults.js';
import {
  validateLimits,
  validateTimeouts,
  validateChunkedTransferChain,
  validateChunkedBootstrapChain,
  validateChunkedSyncDiffChain,
} from './validate.js';                                                           // D7 值域校验半边（纯 import；validate.ts 零编辑）

export const NOMICORE_HUB_SESSION_HOST_SERVICE = 'nomicoreHubSessionHost' as const;

export interface HubReplicationPluginConfig {
  /** 唯一改动：联合追加精确 `false`（免 listen 模式）；listen 模式分支类型逐字节不变。 */
  readonly listen: Readonly<{ readonly host: string; readonly port: number; readonly path?: string }> | false;
  // …其余成员逐字不变（:88-91）
}

export interface HubSessionHostStatus {
  readonly state: 'ready' | 'stopped';
  /** 已开启且未收口的会话数（stop 后恒 0）。 */
  readonly sessions: number;
}

/** 免 listen 模式的 published service：即 #420 冻结会话工厂面 + 生命周期观测/显式 drain。 */
export interface HubSessionHostService extends HubSessionHost {
  readonly status: HubSessionHostStatus;
  /** 显式 drain 全部会话（不触碰上游服务）；幂等（重复调用返回同一 promise）。 */
  stop(): Promise<void>;
}

export function requireHubSessionHost(ctx: Context): HubSessionHostService {
  const service = ctx.get(NOMICORE_HUB_SESSION_HOST_SERVICE);
  if (service === undefined) throw new Error('required Cordis service "nomicoreHubSessionHost" is unavailable');
  return service;
}   // 镜像 requireHubReplication（:345-349）；C3b/AC3 的 /unavailable/ 面

declare module '@deepseek-ai/cordis' {
  interface Context {
    nomicoreHubReplication: HubReplicationService;
    nomicoreHubSessionHost: HubSessionHostService;   // ← 唯一新增行（契约 §12.1 冻结位置）
    nomicorePeerReplication: PeerReplicationService;
  }
}
```

`src/index.ts`（§12.1 冻结语句，紧邻既有 plugin.js 导出块追加；既有 13 名零改名零删除）：

```ts
export { NOMICORE_HUB_SESSION_HOST_SERVICE, requireHubSessionHost } from './plugin.js';
export type { HubSessionHostService, HubSessionHostStatus } from './plugin.js';
```

冻结导出测试授权编辑（契约 §12.8 唯一授权项，先例 #420 §12.6 / #421）：
`test/ws-replication-issue418-edge-session-split-contract.test.ts:144-158` 的 `FROZEN_PRODUCTION_EXPORTS` 追加 `'NOMICORE_HUB_SESSION_HOST_SERVICE'`（排在 `'NOMICORE_HUB_REPLICATION_SERVICE'` 之后——字典序 `…_HUB_R` < `…_HUB_S`）与 `'requireHubSessionHost'`（排在 `'requireHubReplication'` 之后——`requireHubRe…` < `requireHubSe…`）；零删除、零重排；`:553` 断言形态逐字不变（`Object.keys(productionApi).sort()).toEqual(FROZEN_PRODUCTION_EXPORTS)`，运行时导出面 13 → 15 名）。`FROZEN_TESTING_EXPORTS` 不受扰。

### 7.8 D4 — `overrides.listen` 在免 listen 模式的处置（承接契约 U3/D1）

契约冻结 D1：**不被消费、零调用**（宿主组合根可能统一传 overrides——存在性必须合法）。本设计落地为：不要求、不调用、不接入任何运行时对象；**提供时**做与 listen 模式同款的形状校验（D2 表）。校验 ≠ 消费：D1 禁的是「调用/依赖」，畸形 adapter 在任何模式都是宿主 bug，构造期响亮拒绝与 AC5 纪律一致，且与 C2a（合法 spy 零调用 + 装配成功）无冲突。**不采用**「响亮拒绝该组合」——那会使 C2a 红，且契约明示须走 conflict 流程，无决策依据。

### 7.9 D9 — 否决的主要备选汇总

| 备选 | 否决原因 |
| --- | --- |
| (a) 新增独立插件工厂（如 `createHubSessionHostPlugin`） | 扩大公共面（新导出名无 ADR 0032:30 授权——决策文本只授权 `listen:false` 表达 + 既有插件入口）；契约 §12.1 冻结面亦无此名；`apply` 前缀/角色纪律双份漂移风险 |
| (b) falsy/缺省表达免 listen | M1 变异实证 5 形态静默降级（NC-3b 承重红）；与「显式 `false`」矛盾 |
| (c) 服务直接暴露工厂 host（不包装、不台账） | `status.sessions` 无事实源（工厂句柄关闭对服务不可观察；`settled` 不可用——E2e）；C6b 的 stop-after 计数不可实现 |
| (d) 以 `settled` 信号作 stop 收口判据 | E2e 实测反例：连接级 close 不经 `notifySettled`（`hub-namespace.ts:1204-1212`）；契约 C6d 事实登记禁止 |
| (e) 免 listen 模式仍构造 staticVerifier/staticAuthorizer（绑定惰性化） | 与 ADR 0032:65「不再消费 tokens/authorization/verifyToken/authorize」表述冲突（构造闭包即消费配置）；零用途；D3 的 `listenMode` 条件绑定已消除该解读空间 |
| (f) 免 listen 模式响亮拒绝 tokens/authorization/verifyToken/authorize 的**提供** | 契约 U2 明示留给 design 且不设断言；宿主共享配置对象（edge/worker 同源）会被误伤；ADR 措辞是「不再消费」非「必须拒绝」；选择了「提供时形状校验 + 零消费」（D2） |
| (g) 服务再发布 `nomicoreHubReplication` 兼容壳 | 简报 :17 与 ADR 0032:30/:65 明示不提供（AC3）；两入口并存属非法形态 |
| (h) 免 listen 分支只做键表校验 + resolve（iteration 0 形态），或新写第二套值域校验 | 前者（SA2 F1 MAJOR）：非法值静默 plumb 进会话——0ms 超时运行期伪故障、负/零帧预算使 decode 恒失败 → `MALFORMED_FRAME` connection-fatal；与 listen 模式同配置行为分叉（一响一静），违反 D2-(b) 自家主张与 `createHubSessionHost` 的组合根契约（B9 注释明文 resolve+validate）。后者：违反「勿新写第二套校验」——`validate.ts` 校验器在场且为单一事实源。修订：复用五函数（D7） |

---

## 8. 接口、状态机和数据流

### 8.1 接口变化汇总

| 面 | 变化 | 性质 |
| --- | --- | --- |
| `HubReplicationPluginConfig.listen` | `… | false` | append-only 联合扩展（listen 分支类型不变） |
| `NOMICORE_HUB_SESSION_HOST_SERVICE` / `requireHubSessionHost` | 新值/新函数 | append-only |
| `HubSessionHostService` / `HubSessionHostStatus` | 新类型 | append-only |
| `Context` 模块增强 | `nomicoreHubSessionHost` 一行 | append-only |
| `src/index.ts` | +2 值 +2 类型 | append-only（排序插入） |
| 插件运行时形态 | 免 listen 分支（服务面）；listen 分支零变化 | 行为分支 |

状态机：**零新增协议/连接状态机**。服务生命周期两态 `ready → stopped`（`stopped` 单向闩锁；`open` 在 stopped 后响亮拒绝）；会话生命周期沿用 #420/`hub-namespace.ts` 既有 FSM（零 diff）。

### 8.2 数据流路线（免 listen 模式；listen 模式路线零变化）

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 配置→校验→绑定 | 宿主调 `createHubReplicationPlugin({listen:false,…}, overrides)` | 构造期（无副作用） | `validateHubConfig` 分派（D1）→ 通用键表 → 免 listen 子集（D2：键表/形状层）→ `mergeNested` limits/timeouts（`:362-363`，两分支共享）→ `listenMode = undefined`（D3） | 无 | — | 构造成功/响亮 `TypeError`（键表/形状层；含 `hub replication` 前缀，不回显凭据）。**值域不在本层**——构造成功 ≠ 值合法（与 listen 模式两层同构） | 构造期抛错即全部清理（未创建任何资源） | C1a/C5a/C5b/NC-5 |
| L2 装配→服务发布 | 宿主 `ctx.plugin(plugin)` / `plugin.apply(ctx)`；ctx 具备四注入服务 | `startHubSessionHostService`：resolve+validate（D7）→ 工厂实例 + 台账 + `ctx.provide(NOMICORE_HUB_SESSION_HOST_SERVICE)` + `ctx.effect` | role='hub' 断言 → 依赖 require → resolveLimits/Timeouts → `validateLimits`/`validateTimeouts` + 分块族显式激活链（D7）→ 工厂 config | Cordis 服务表（进程内） | `ctx.get` / `requireHubSessionHost` | 服务在场，`status={state:'ready',sessions:0}` | peer 角色：apply 同步抛 `/requires instance role "hub"/`，零副作用（C1e）；**值域违例：apply promise rejection `TypeError`（`limits:`/`timeouts:` 消息家族），先于 provide——零服务/零会话/零定时器，零清理**（C5d–C5f） | C1a/C1b/C1e/C5d–C5f |
| L3 会话开启 | 宿主（worker 侧 edge 桥）`service.open(HubSessionOpenInput)` | 服务台账 `sessions.set(key, wrapped)`；工厂台账 `sessions.set(key, handle)`（工厂侧） | 描述子纯 JSON；唯一性由工厂响亮拒绝（同键双台账同构） | 进程内 Map ×2 | 返回包装句柄（5 成员委托） | 句柄可用；`status.sessions` +1 | stopped 后 `open` 抛 `Error`；重复键抛工厂 `Error`（继承） | C1b/C1c/C6b |
| L4 入站帧→协议 FSM | 宿主 `wrapped.handleFrame(Uint8Array)`（sequence 已由 edge 校验） | —（纯分派） | 委托 `handle.handleFrame` → decode → `sink.openNamespace`/`namespaceFrame` → `HubNamespaceChannel` FSM | 进程内调用（零网络面） | channel → `registry.open(localOwner, nsId)`（跨包边界：ws-replication → namespace-registry lease） | OPEN_OK（占位 sequence=0）等出站帧；`registry.open` 恰一次；observer `side:'hub'` 事件 | 解码失败 → `connection-fatal`（工厂既有）；未知 ns → `NAMESPACE_STATE_VIOLATION` 合成（既有） | C1c/C1d |
| L5 出站帧→宿主 sink | channel 出站（`port.sendDataFrame/sendControlFrame`） | — | `sequence=0` 占位编码 → `wrapped.onFrame` 注册的宿主监听者，同步回传被分配 wire 序 | 进程内同步回调（宿主拥有真实传输） | 宿主 sink | 帧字节 + lane + wire 序；`timeouts.bootstrapTimeoutMs` 原值到达 session 定时器 arm（`timer.delays` 含 1234） | 无 sink → 0（既有「未发送」语义，`resync-required{send-failed}` 链） | C1c/C1d |
| L6 stop/teardown | 宿主 `service.stop()` 或 `ctx.fiber.dispose()`（effect 反向 yield） | `stopped=true` → 全台账 close → `timer.dispose()` → `sessions.clear()` → revoke | 句柄 close = 同步 quiesce（state→closing、clearAllTimers）+ 异步尾 `onConnectionClosed`（终态 `closed`） | 进程内 | observer `channel-state-changed{to:'closed'}`；`status={state:'stopped',sessions:0}`；`timer.active.size===0` | 会话全部收口、timer 清零、服务撤销后 `requireHubSessionHost` 抛 `/unavailable/` | close reject → stop reject（响亮传播）；`finally` 保证 timer 清零；幂等（同一 promise） | C6a/C6b/C6c |

listen 模式数据流（adapter → `createHubReplication` → provide 复制服务）：与 HEAD 零变化，不在此重复。

---

## 9. 错误、恢复、并发和幂等

| 维度 | 设计 |
| --- | --- |
| 构造期错误 | 免 listen：仅通用键表 + 子集形状校验可抛 `TypeError`（消息前缀 `hub replication …`，不回显凭据值——NC-5 纪律）；listen 模式错误次序/消息逐字节不变（D2）。值域错误**不在**构造期（与 listen 模式两层同构——见下行） |
| 装配期值域错误（免 listen；D7/F1） | `validate.ts` 五校验器在 `startHubSessionHostService` 顶部抛 `TypeError`（消息 `limits: …`/`timeouts: …` 家族，不回显凭据——NC-5 同纪律），经 `apply()` promise rejection 响亮传播；时机/错误家族与 listen 模式经 `createHubReplication` 完全对齐；拒绝点先于 provide——零服务/零会话/零定时器，零清理 |
| 角色错误 | `apply` 同步抛 `/requires instance role "hub"/`，先于一切装配副作用（共享前缀，C1e；与 listen 模式同构 `:373-375`） |
| 服务不可用 | `requireHubSessionHost(ctx)` 在服务未发布/已撤销时抛 `Error('required Cordis service "nomicoreHubSessionHost" is unavailable')`（AC3 消费方语义同款） |
| stop 后 open | 响亮 `Error`（`'nomicore hub session host service is stopped'`）；无静默降级/静默复用 |
| stop 幂等 | `stopPromise ??=` 同一 promise（C6a）；effect 反向 yield 复用同一闭包 |
| 句柄幂等 | `wrapped.close`/`wrapped.terminateUnauthorized` 记账级 memoize（同一 promise）；工厂侧 `closeTail`/终态早退双层幂等（B6/B8） |
| 并发 | 插件域单线程（Cordis fiber）；台账 Map 操作原子；`stopped` 闩锁先行消除 stop/open 竞态；多句柄并发 close 用 `Promise.all`（各自独立收口链） |
| 失败恢复 | 会话 close reject：stop 响亮 reject、timer 仍清零（`finally`）；可经重复 stop/`ctx.fiber.dispose()` 重入（幂等 promise 上的重试即重观察）；不设计静默 fallback |
| 资源所有权 | 插件仅拥有：会话台账 + 包装句柄 + OwnedTimer + 发布服务；Registry/Runtime/上游服务归宿主组合根（包 AGENTS 纪律）；工厂/通道资源随句柄 close 收口 |
| 凭据纪律 | 免 listen 模式不构造任何验证器/授权器（D3/e 项）；错误消息不含凭据值 |

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
| --- | --- | --- | --- | --- |
| listen 模式宿主 `apps/yjs-server/src/app.ts:419` | listen 对象配置 + verifyToken/authorize/listen overrides | 完全不变（listen 分支零扰动） | 零 | B14；C4a–C4f |
| worker 侧宿主（nomic-server，后续接线） | 无消费入口（服务轨缺席） | `requireHubSessionHost(ctx)` / `ctx.get(NOMICORE_HUB_SESSION_HOST_SERVICE)` 消费；`service.open` 驱动会话；`service.stop`/fiber dispose 收口 | 宿主侧后续票（本票交付面） | ADR 0032:64；契约 §10 |
| 免 listen 宿主提供畸形 limits/timeouts **值**（键合法） | 不可达（构造先抛 listen TypeError） | 构造成功；`apply()` rejection `TypeError`（`limits:`/`timeouts:` 家族）——宿主在装配点得到与 listen 模式一致的响亮失败，修正配置后重试 | 宿主侧零适配（新失败面 = listen 模式既有失败面的分支化，无新语义） | `validate.ts:140-282`；`hub-connection.ts:76-100`（listen 同款先例）；C5d–C5f |
| `requireHubReplication` 消费方（listen ctx） | 服务在场 | 不变 | 零 | `plugin.ts:345-349` |
| `requireHubReplication` 消费方（免 listen ctx） | 不可达（构造先抛 TypeError） | `ctx.get('nomicoreHubReplication')===undefined` + require 抛 `/unavailable/`（AC3 目标语义） | 零（消费方按既有不可用错误处理） | 契约 C3a/C3b |
| 第三方 Cordis 宿主（`docs/integration/cordis-plugin-hosting.md`） | listen 组合序文档 | 文档仍准确（组合序与 listen 表述不受免 listen 影响）；worker 组合文档属宿主侧后续 | 零（DENY，§11） | B14 |
| 既有测试（plugin 15 项 + 包全量 785） | 绿 | 逐字节不变且绿（AC4 背书） | 零（DENY，§11） | B15；契约 §4 |
| #418 冻结导出契约测试 | 13 名清单 | 授权编辑：追加 2 名（§7.7） | 唯一授权的一处既有测试编辑 | 契约 §12.8 |
| `HubReplicationPluginConfig` 类型消费方（含 `ws-replication-issue421-edge-factory-api.test-d.ts:93-95` 参数元组断言） | listen 对象联合 | 联合扩展不改参数元组形态，断言不受扰 | 零 | grep 证据；§11 |

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
| --- | --- | --- |
| `packages/ws-replication/src/plugin.ts` | D1–D8 全部实现：配置联合、校验分派与免 listen 子集（键表/形状层）、`listenMode` 条件绑定、`startHubSessionHostService`（含 D7 resolve+validate+分块族激活链）、新常量/类型/`requireHubSessionHost`/模块增强一行、新增内部 import（`createHubSessionHost`/类型/`resolveLimits`/`resolveTimeouts`/`validate.ts` 五校验器） | 唯一实现面（契约 §10 影响面 1–4 行全部落于此文件） |
| `packages/ws-replication/src/index.ts` | 追加 §7.7 冻结的两条 export 语句（+2 值 +2 类型） | 契约 §12.1 冻结的公共入口扩展 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | `FROZEN_PRODUCTION_EXPORTS`（:144-158）追加 2 名（排序插入、零删除/零重排；:553 断言形态逐字不变） | 契约 §12.8 授权的唯一既有测试编辑（先例 #420/#421） |
| `packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts` | 新增：以 `artifacts/sa6-issue422-contract-suite/ws-replication-issue422-listen-false.test.ts` 为基底按同路径落盘——**冻结断言逐字保留**（契约 §12.2–§12.7 逐条形态零改动、零删除、零改写），并**追加** SA2 F1 授权的值域负控块（C5d–C5g，§12）：免 listen timeouts 正整数违例、limits 跨字段违例、两模式 parity、分块族激活/不激活对（追加块为新增 `it`，复用同文件夹具；不触碰冻结断言本身）。**护栏**：若实施中发现需要改动契约冻结断言本身，按契约 §3/U1 走 conflict 流程而非静默改 | AC1–AC6 运行时验收 + F1 值域验收（契约 §12.0 交付路径 + SA2 §13-F1(4) 授权） |
| `packages/ws-replication/test/ws-replication-issue422-session-host-api.test-d.ts` | 新增：从 `artifacts/sa6-issue422-contract-suite/ws-replication-issue422-session-host-api.test-d.ts` 同上落盘 | AC1 类型冻结（test-d；`--typecheck` 收集） |
| `packages/ws-replication/README.md` | Cordis plugins 节 `createHubReplicationPlugin` 条目（:9）后追加一条免 listen 模式说明（listen:false → 零 listener + `ctx.nomicoreHubSessionHost`；不提供 `nomicoreHubReplication`；不再要求认证授权配置） | 包公共行为文档随行为扩展同步（docs/AGENTS「行为变化同步规范文档」） |
| `CONTEXT.md` | SessionHost 词条（:229-231）正文补一句插件轨登记（服务名/模式纪律/两入口互斥），`_Avoid_` 追加一条（免 listen 仅精确 `false`、不得 falsy/缺省表达；两入口并存非法） | 契约 U7 授权的 design 决策：服务消费词条登记（不与 ADR 冲突，纯 ADR 0032:30/:64-66 复述） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
| --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts` | #420 已冻结工厂面（服务轨复用对象） | 公开面冻结纪律（ADR 0032:66）；本设计经包装/委托消费，零工厂改动 |
| `packages/ws-replication/src/hub-session.ts` / `hub-namespace.ts` / `hub-split.ts` / `hub-edge.ts` / `hub-edge-host.ts` / `hub-connection.ts` | 协议 FSM/内部 splice/连接级半边 | 契约 §10「非影响」硬门：wire/FSM 零 diff；AC4 回归面 |
| `packages/ws-replication/src/peer-connection.ts` / `peer-namespace.ts` | peer 侧 | ADR 0032:67 peer 侧不拆分；零触碰 |
| `packages/ws-replication/src/testing.ts` / `defaults.ts` / `validate.ts` / `types.ts` / 其余 src | 测试面/常量/校验器/类型 | 零需求（resolver + **校验器均纯 import 复用、零编辑**——SA2 §11 确认 DENY 指修改不禁止 import；`validate.ts` 单一事实源防第二套校验）；类型面由 plugin.ts 追加承载；NC-6 结构门保持 |
| `packages/ws-replication/test/ws-replication-plugin.test.ts` 及其余全部既有测试（除授权编辑一处） | AC4「逐字节不变」的背书体 | 契约 §12.8-2：逐字不变；任何编辑都会侵蚀 AC4 判据 |
| `packages/ws-replication/package.json` | 依赖面 | 零新依赖（免 listen 分支仅内部 import）；NC-6 结构门（零网络 API）保持 |
| `docs/adr/0032-*.md`、`docs/protocols/instance-replication-v1.md` | 权威决策/协议文本 | ADR 决策 5 与后果节（:30,:64-66）已登记本形态；协议 §17/:582、§23.1/:833 已登记分片口径——零修订（契约 §10） |
| `docs/integration/cordis-plugin-hosting.md` | 第三方宿主组合序文档 | 现文档对 listen 模式仍逐字准确；worker 免 listen 组合序属 nomic-server 宿主侧后续票（U5 姿态） |
| `apps/yjs-server/**` | listen 模式消费方 | listen 分支零变化 ⇒ 零改动（§10 矩阵） |
| `docs/adr/0023-*.md` | 冻结服务构造纪律 | 仅引用（§7.4 已遵循），不修订 |

---

## 12. 验收与验证映射

验收件 = 契约 §12 冻结的两份测试（SA6 已实跑同一形态，红/绿证据在 `artifacts/sa6-issue422-*`）**加上** SA2 F1 授权追加的值域负控块（C5d–C5g：落盘时追加进 `ws-replication-issue422-listen-false.test.ts`，冻结断言逐字保留）；实现票按 §12.0 交付路径落盘后逐条执行并登记日志。

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
| --- | --- |---| --- |
| AC1 装配+服务（C1a/C1b/C1e） | 契约 §12.2；E1 可达性 13/13 | `ws-replication-issue422-listen-false.test.ts`（免 listen describe） | 构造不抛；`apply` resolve；`requireHubSessionHost` 服务在场；`status={state:'ready',sessions:0}`；peer 角色同步抛 `/requires instance role "hub"/` 且零服务/零 adapter 调用 |
| AC1 真会话+注入面（C1c/C1d） | E1/E3（registry.open 恰一次、1234 plumb） | 同上（真 Registry/Runtime 夹具回合） | `OPEN_OK`（占位 sequence=0）；`registry.open(HUB_OWNER, ns)` 恰一次；observer `side:'hub'` 事件；`timer.delays` 含 1234 |
| AC1 类型锁（C1f/T1–T4） | 契约 §12.1；`type-lock-red.log`（7 错） | `ws-replication-issue422-session-host-api.test-d.ts` | `tsc` 0 错；`@ts-expect-error` 全触发（伪值 5 形态、`requestReauth` 混入、`state='running'`） |
| AC2 零 listener/零网络面（C2a–C2d） | 契约 §12.3；D1 冻结 | 同上运行时件 + NC-6 结构门 | adapter spy 零调用；`plugin.listener/replication === undefined`；无 adapter 时不抛 `listen adapter is required`；`src/**`+`package.json` 网络 API 命中 0 |
| AC3 不提供复制服务（C3a–C3c） | 契约 §12.4 | 同上 | `ctx.get('nomicoreHubReplication')===undefined`；`requireHubReplication` 抛 `/unavailable/`；`service.requestReauth` 运行时 `undefined` |
| AC4 listen 回归（C4a–C4f） | 基线 785 绿（B15） | 既有 15 项插件测试逐字不变 + 包全量 + `FROZEN_PRODUCTION_EXPORTS` 追加后 15 名 | 全绿；listen 模式 adapter 恰一次/服务在场/`nomicoreHubSessionHost` 恒 `undefined`（C4d）；要求链与凭据不回显逐项不变 |
| AC5 非法形态（C5a–C5c） | NC-3/NC-3b ×16 + M1–M3 变异 | 同上运行时件（负控 describe） | 16 形态 ×2 组构造期 `TypeError`（含 `hub replication`）；listen 要求链不变 |
| **F1 值域负控——timeouts 正整数违例（C5d，追加块）** | 无（冻结套件零覆盖——SA2 判「伪绿盲区」）；形态模板 `ws-replication-ac7-faults.test.ts:192-216` | 追加 `it`（复用同文 C1 夹具）：`{listen:false, timeouts:{bootstrapTimeoutMs:0}}` 构造**不抛**（键表/形状层无此值域）→ `await expect(plugin.apply(ctx)).rejects.toThrow(TypeError)`；并断言零副作用（`ctx.get(NOMICORE_HUB_SESSION_HOST_SERVICE)===undefined`、`timer.active.size===0`） | 实现前红（HEAD 构造期即抛 listen `TypeError`——能力缺口红因，SA2 F1 验收口径）；**缺 F1 校验的实现红**（apply resolve、服务发布 → `rejects` 断言失败——变异敏感，闭合伪绿盲区）；实现后绿 |
| **F1 值域负控——limits 跨字段违例（C5e，追加块）** | 无；形态模板同上（`lowWater:1024,highWater:512`） | 追加 `it`：`{listen:false, limits:{lowWater:2,highWater:1}}`（lowWater ≥ highWater 违反无条件跨字段链）构造不抛 → apply rejection `TypeError`（消息含 `lowWater`/`highWater` 语义）+ 零副作用断言 | 同 C5d 三态（红/红/绿） |
| **F1 parity（C5f，追加块）** | listen 半侧 HEAD 已绿（经 `createHubReplication`，`hub-connection.ts:76-100` 既有行为）；免 listen 半侧红 | 追加 `it`：C5d/C5e 两组畸形值在 **listen 模式**同样构造成功 + apply rejection `TypeError`（`{listen:VALID_LISTEN,tokens:[],authorization:[],…同值}` + 合法 adapter）——两模式**同生命周期点、同错误家族**拒绝 | listen 半侧实现前后恒绿（锁定既有行为，防回归）；parity 组整体实现前红（免 listen 半侧）、实现后绿——「同一畸形值在两模式下均被拒绝」成立 |
| **F1 分块族激活门（C5g，追加块；授权附加项）** | 无；形态模板 `ws-replication-issue244-ac-red.test.ts:704-715`（R1c） | 追加两条 `it`：① 激活——`{listen:false, limits:{maxChunksPerUpdate:4}}`（单键部分配置）→ 合并结果链② 4MiB > 4×512KiB=2MiB → apply rejection `TypeError`；② 不激活——`{listen:false, limits:{maxQueuedUpdateBytes:1024*1024}}`（仅显式既有键、非链门键；1MiB ≥ 缺省 maxUpdateBytes 512KiB，无条件链自洽）→ apply resolve、服务 `{state:'ready',sessions:0}` | ①钉窄门**激活**语义（漏接链的实现会漏拒——红）；②钉 N5/N6 **非追溯性**（错误宽门实现会误拒存量合法配置——红）；正确窄门（`hub-connection.ts:85-100` 同款）双双绿 |
| AC6 teardown（C6a–C6d） | E2a–E2e（收口语义实测） | 同上 | stop 同一 promise；await 后每会话 observer `channel-state-changed{to:'closed'}`；`status={state:'stopped',sessions:0}`；stop 后 open 抛；`timer.active.size===0`；`ctx.fiber.dispose()` 后 `requireHubSessionHost` 抛 `/unavailable/`、timer 保持 0、零 listener 残留；**不使用 settled 判据** |

实现后运行命令（契约 §12.0；日志登记进交付说明）：

```bash
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication/test
pnpm exec tsc -p packages/ws-replication/tsconfig.json
pnpm test        # 根（--typecheck）
pnpm typecheck   # 15 tsconfig 串行
```

---

## 13. 风险、回滚和残余问题

### 风险与缓解

| # | 风险 | 缓解 |
| --- | --- | --- |
| R1 | listen 模式主体引用改名（`listenMode.*`）引入行为漂移 | 改动限于绑定引用（同值同序同消息）；C4a/C4b（既有测试逐字不变 + 包全量）承重；实现票须逐表达式核对 `:392-448` |
| R2 | 包装句柄破坏「同一 promise」幂等或遗漏成员委托 | §7.4 记账级 memoize + 5 成员全委托清单；C6a 与 #420 既有句柄测试背书 |
| R3 | 冻结清单编辑位置/断言形态漂移 | §7.7 给出字典序核验（`NOMICORE_HUB_R` < `NOMICORE_HUB_S`；`requireHubRe…` < `requireHubSe…`）；`:553` 断言形态逐字不变；C4f 断言 `Object.keys(...).sort()` 全等 |
| R4 | 免 listen 校验子集与 listen 链的语义分叉（漏校验被消费面） | §7.2 矩阵逐项列出共有/跳过；被消费面（limits/timeouts/observer）两模式同校验 |
| R5 | 台账 `release` 时序（reject 时不摘账）被误判为泄漏 | §7.4 显式定义：reject = 未收口 = 诚实计数；stop 重入路径已定义（§9） |
| R6 | 文档编辑与 ADR 冲突 | CONTEXT.md/README 编辑仅复述 ADR 0032:30/:64-66 已登记事实，零新决策（U7 授权范围） |
| R7 | F1 值域校验半边与 listen 模式组合根形态漂移（漏接分块族链 / 宽门误拒存量配置 / 新写第二套校验器） | D7 逐行镜像 `hub-connection.ts:76-100`（同门输入 = 同一 `mergeNested` 对象，激活判据字节等价）；校验器单一事实源 `validate.ts`（纯 import，零新写）；C5d–C5g 四组负控钉住值域/parity/激活/非激活四面 |

### 回滚

单票 revert：`plugin.ts` + `index.ts` + 两份新测试 + 冻结清单两行 + 两处文档，共 7 文件；无 schema/wire/持久化迁移、无生成物、无依赖变化——revert 后即回到 HEAD 基线（785 绿）。

### 残余问题与 follow-up（非本票必要条件）

| # | 项 | 处置 |
| --- | --- | --- |
| F1 | dispatch 前 SA8 门禁产物缺失（契约 U1） | **合入前义务**：实现票合入前补 SA8 clear（#418 R5''/R7'' 口径；设计后冲突报告 R4：R1 完成前不得视为已清）。设计后冲突门禁已 clear（`task_issue-422_design_conflict_report.md`），但其 R1 实现后复查清单须**追加** iteration 1 新增项：免 listen 装配期值域 `TypeError` 失败类、`validate.ts` 五函数 import 面、追加负控块不触碰冻结断言（SA2 §15-3）。`requiresConflictRecheck` 标记以评审/门禁各自提交为准（SA2 OBS-5 口径） |
| F2 | 真 worker/异步 pipe 形态（跨线程 pending 有界、异步序回传） | 后续票（ADR 0032 决策 5 γ；#418 R4''/R5''）；本票交付进程内服务面 |
| F3 | 服务面聚合（connections/revoke 广播/close 全量） | #421 设计 §13 follow-up (e)；本票不预留 |
| F4 | nomic-server 宿主接线（edge/worker 组合序）与 `docs/integration` worker 组合文档 | 宿主侧后续票；本票 DENY 相应文档 |
| F5 | 会话计数在 `connection-fatal` 路径的摘账语义（当前仅 close/terminateUnauthorized fulfill 摘账） | 设计内显式定义（fatal 后由宿主调 close 收口）；如需信号驱动摘账，属 append-only 演进，另票评估 |
| F6 | #420 工厂台账永不摘除（`hub-session-host.ts:239-257` 无 delete）——长驻 worker 宿主每开一个 `(connectionKey,namespaceId)` 永久保留 handle/sink/通道残余，存在单调内存增长面（SA2 OBS-2） | 登记供宿主与后续票知情；本票 DENY 禁触工厂（#420 冻结面），非本票义务 |

### 是否需要设计后 ADR 冲突复查：**是**

理由：(1) 公共 API 扩展（新服务常量/require 函数/2 类型 + 配置联合扩展——skill 复查条件「公共 API 变化」）；(2) 触碰 #418 冻结导出面（一次性授权编辑，ADR 0032:66 冻结纪律——「触碰 ADR 冻结面」条件）；(3) dispatch 前 SA8 门禁产物缺失（契约 U1 合入前义务；设计后冲突门禁已 clear 但其 R1 实现后复查开放）；(4) **F1 修订为免 listen 模式引入一类新的装配期失败语义（值域 `TypeError` → apply rejection）**——SA2 §15-3 明示应并入复查范围。设计主张：该失败类是 listen 模式既有失败类（`createHubReplication` 组合根，`hub-connection.ts:76-100`）在同一生命周期点、同一错误家族的分支化复用，校验器为 `validate.ts` 单一事实源、无第二语义源——该主张本身列入复查焦点。复查焦点清单：§7.7 公共面/冻结清单编辑与 ADR 0032:30/:64-66 的一致性、§7.2/§7.8 两处 design 决策（U2/U3 落地）、**D7 值域校验半边（新失败类 + `validate.ts` import 面）与追加负控块不触碰冻结断言的合规性**。

---

## 14. 评审修订映射

评审输入：`wiki/raw/task_issue-422_sa2_review.md`（iteration 1；verdict reject，1 × MAJOR F1 + OBS-1–OBS-5）。逐条处理：

| Finding | 修订位置 | 处理结果 |
| --- | --- | --- |
| **F1（MAJOR）**：免 listen 分支 limits/timeouts 值域校验缺失——四点修订要求（SA2 §13） | (1) §7.4 参考实现前段 + §7.6 D7 重写：resolve 之后、注入 `createHubSessionHost` 之前接 `validate.ts` 五校验器（`validateLimits`/`validateTimeouts` 无条件 + 分块族三链显式激活窄门；勿新写第二套——纯 import）；(2) §7.6 D7「抛错时机 = apply 期」选定与论证（与 listen 模式经 `createHubReplication` 逐点对齐 + 早于 provide；否决构造期备选并登记其时机差论据）；(3) §7.2 D2 矩阵 limits/timeouts 拆两层：「键表（共有，构造期）+ 值域（共有，装配期经 validate.ts）」；(4) §11 ALLOW 测试文件授权改写（冻结断言逐字保留 + 追加值域负控 + conflict 流程护栏）+ §12 新增 C5d–C5g 验收行（含 parity） | **已落实**。配套一致性修订：§1 目标 5、§2 B9、§3 缺口表第五行、§4 AC5 行、§5 E3 行、§6 表 U1 行、§7.3 D3 新增共享输入说明、§7.7 D8 import 块、§7.9 D9(h)、§8.2 L1/L2、§9 错误表新增装配期行、§10 调用方矩阵新增畸形值行、§13 R7 + 复查焦点、§15 证据清单 |
| OBS-1（非阻断）：§7.4 摘账原则与 stop 失败路径字面张力 | §7.4 关键语义首条追加调和句（诚实计数适用于 stop 之前的个别 close/terminate 失败；stop 一经进入即闩锁清零并以 rejection 承载失败信号） | 已落实（措辞调和，行为零变化——冻结类型注释「stop 后恒 0」钉死） |
| OBS-2（非阻断）：工厂台账永不摘除的内存增长面未登记 | §13 残余问题新增 F6 | 已落实（登记供宿主与后续票知情，非本票义务——DENY 禁触工厂） |
| OBS-3（非阻断）：新服务面无 Proxy-consumption 测试 | 不设设计义务；实现票**可选**在契约套件外补一条 Proxy 消费断言（ADR 0023 构造纪律——getter + freeze——设计已遵循） | 登记为可选项（未扩大 ALLOW/DENY；SA2 明示非必要） |
| OBS-4（非阻断）：D9-(e)/D2「校验 ≠ 消费」偏严解读 | 维持原设计（零改动） | 设计后冲突报告裁量点 1 已裁 no-conflict 并留档；SA8 复查时顺带确认（§13 复查焦点已含 U2/U3 落地） |
| OBS-5（非阻断）：iteration 0 §13-F1 自预告 `requiresConflictRecheck` 属措辞越位 | §13-F1 改写为引用评审/门禁的实际提交 | 已落实 |

---

## 15. 附：证据文件清单（worktree-relative）

- 任务简报：`wiki/raw/task_issue-422.md`；SA6 契约：`wiki/raw/task_issue-422_sa6_contract.md`；SA2 评审：`wiki/raw/task_issue-422_sa2_review.md`；设计后冲突门禁：`wiki/raw/task_issue-422_design_conflict_report.md`
- 契约测试件（落盘源）：`artifacts/sa6-issue422-contract-suite/ws-replication-issue422-listen-false.test.ts`、`artifacts/sa6-issue422-contract-suite/ws-replication-issue422-session-host-api.test-d.ts`
- 契约证据日志：`artifacts/sa6-issue422-{capability-gap,causal-feasibility}-probe.log`、`artifacts/sa6-issue422-{type-lock-red,package-tsc-red,runner-trigger-red,baseline-package-suite,post-cleanup-gates,stability-3x,mutation-sensitivity,final-clean-state}.log`
- 权威文本：`docs/adr/0032-transport-decoupling-edge-session-split.md`（:30,:64-66）、`docs/adr/0023-proxy-consumable-frozen-service-surfaces.md`、`docs/protocols/instance-replication-v1.md`（:582,:833）、`CONTEXT.md:229-231`、`packages/ws-replication/AGENTS.md`
- 源码锚点：`packages/ws-replication/src/{plugin.ts,hub-session-host.ts,hub-session.ts,hub-namespace.ts,defaults.ts,validate.ts,types.ts,index.ts}` 与组合根先例 `{hub-connection.ts:76-100,hub-edge-host.ts:761-777,peer-connection.ts:105-131}`、`packages/ws-replication/test/ws-replication-plugin.test.ts`、`packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts`、负控形态模板 `{ws-replication-ac7-faults.test.ts:192-216,ws-replication-issue244-ac-red.test.ts:704-715}`
