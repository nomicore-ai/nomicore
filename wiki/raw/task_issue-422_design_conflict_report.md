# 冲突门禁报告（设计后复审）— issue #422

**被审对象**：SA1 设计 `wiki/raw/task_issue-422_design.md`（**iteration 1**——按 SA2 评审 reject/MAJOR F1 原位修订后的当前版本；issue #422：hub 插件免 listen 模式（`listen: false`）与 `nomicoreHubSessionHost` 服务，spec #415 T5）
**门禁类型**：设计后复审（SA1 修订设计产出后；SA2 review `wiki/raw/task_issue-422_sa2_review.md` 在场——iteration 1 的修订输入）
**产出时间**：2026-09-22（原位更新；只反映 iteration 1 被审对象，不堆叠 iteration 0 结论）
**复审焦点**（dispatch 指定）：修订版新增的 **session-only（免 listen）值域校验行为**（设计 §7.6 D7 + §7.2 D2 两层矩阵 + §7.4 参考实现前段）与决策集的一致性。

**对照基准**：

- `docs/adr/` 全集 30 份（0001–0030、0032；无 0031；状态独立盘点：除 0015（提议）外全部 accepted，无 superseded；0016/0024 的 0027 修订指针均与本票无关。核心相关：**0032**、0023、0012、0010、0013/0022；其余经逐份标题/状态扫描确认无关联决策面）；
- `CONTEXT.md`（「SessionHost」:229-231、「服务表面」:174 等词条全文）；
- `docs/protocols/instance-replication-v1.md`（§17 :574-616 配置纪律与分片计数口径、§21 停机顺序、§23.1 :833 发射侧归属表）；
- `packages/ws-replication/AGENTS.md`（模块契约：角色插件服务消费/所有权/公共导出纪律、§21 为停机权威）；
- issue #422 正文（简报 `wiki/raw/task_issue-422.md`）；**Owner 评论经 REST 读取为空——无 Owner 要求，无 override 权威在场**。
- 证据件（非决策基准）：SA6 契约 `task_issue-422_sa6_contract.md`、SA2 评审 `task_issue-422_sa2_review.md`、`artifacts/sa6-issue422-contract-suite/*`。

**基线核实**（本门禁独立重执行于 HEAD `4ad13a3`，非转抄设计/契约/评审声明；重点覆盖 iteration 1 新增面的全部源码锚）：

- 既有面锚点复核：`plugin.ts` :86-92（listen 联合仅对象形态）、:143-148（模块增强仅两服务）、:150（`HUB_CONFIG_KEYS` 五键 + `HUB_OVERRIDE_KEYS`）、:289-316（校验链顺序：config/overrides 键表→listen record→listen 值域→:298 adapter 必需→:300-302 认证/授权必需→:303-304 形状→:305-308 limits/timeouts 键表→:309-310 verifyToken/authorize→:311-314 adapter 形状→:315 observer）、:345-349（require 镜像形态）、:361-366（validateHubConfig→mergeNested→staticVerifier/staticAuthorizer→listen 绑定）、:372-378（apply 前缀：requireNomicoreInstance→assertRole('hub')→requireClock→requireNomicoreRegistry→timerFromContext；`apply` 返回 `start(...)` promise）、:392-448（start 内 `createHubReplication`(:392)→`listen.listen`(:406)→provide；`stopPromise ??=`+finally `timer.dispose()`；ADR 0023 注记 + Object.freeze + getter；effect 反向 yield [revoke, stop]）；`hub-session-host.ts` :44-52（`ResolvedLimits`/`ResolvedTimeouts` 必需 + :47 注释明文「组合根 resolve+validate 后注入（既有纪律）」）、:73-84（5 成员句柄）、:243-257（同键响亮拒绝）、:261（工厂）；`hub-session.ts` :277-283（`closeTail` 幂等）；`hub-namespace.ts` :1181-1189（quiesceConnection）、:1191-1198（terminateUnauthorized revoke 链幂等）、:1204-1212（onConnectionClosed：drain→settleClose→setState('closed')，**无 notifySettled**）；冻结测试 :144-158（`FROZEN_PRODUCTION_EXPORTS` 13 名，已含 #420/#421 追加先例）与 :553（`Object.keys(productionApi).sort()).toEqual(...)` 断言形态）；`index.ts` 运行时导出恰 13 名。
- **iteration 1 新增面锚点逐条独立核实**（D7 承重证据）：
  - 三处既有组合根全部为 resolve + `validateLimits` + `validateTimeouts` + 分块族三链**显式激活窄门**的完整形态：`hub-connection.ts:76-100`、`hub-edge-host.ts:761-777`、`peer-connection.ts:105-131`（门看 `options.limits` 上 `hasOwnProperty`（显式表达面），对 resolve 后合并结果校验）——D7「逐行镜像」主张成立；
  - `defaults.ts:61-70`（`resolveLimits`/`resolveTimeouts`：DEFAULT 展开 + partial 整值替换，注释明文「逐字段 clamp 是禁区」）；`validate.ts` 五校验器行号核实：`validateLimits`:140-206（正有限安全整数 + 无条件跨字段链：budget 三链、`maxQueuedUpdateBytes ≥ maxUpdateBytes`、`maxQueuedControlBytes ≥ maxBootstrapBytes + 开销`、`lowWater < highWater`、`highWater ≤ maxQueuedBytesPerConnection`）、`validateChunkedTransferChain`:223-234、`validateChunkedBootstrapChain`:245-251、`validateChunkedSyncDiffChain`:258-264、`validateTimeouts`:266-282（含 `pongTimeoutMs < pingIntervalMs`）；:208-243 注释载明 N5/N6 非追溯性纪律；全部经 `assertCollKind` 抛 **TypeError**（消息前缀 `limits:`/`timeouts:`，不回显凭据）——设计 §9「错误家族」声明与源码一致；
  - `hub-session.ts`/`hub-session-host.ts` **零 validate import**（grep 证实）——免 listen 形态下插件即组合根、validate 半边只能落在插件的主张成立；
  - `plugin.ts` 现状**零 validate.ts import**（仅本地 validateTokens/validateAuthorization/validateTargets）——D7 的五函数 import 为净新增、纯 import、`validate.ts` 零编辑；
  - `mergeNested`（:214-217）：双 undefined → undefined，否则字段级合并——listen 分支 :399 传给 `createHubReplication` 的与免 listen 分支 D7 门输入是**同一对象**，「两模式激活判据字节等价」主张成立；listen 模式值域 TypeError 发生在 `start()` 内（apply 期 promise rejection）——「时机逐点对齐」主张成立；
  - 冻结契约套件 `artifacts/sa6-issue422-contract-suite/ws-replication-issue422-listen-false.test.ts` **无任何值域负控**（仅 :215 `bootstrapTimeoutMs:1234` 正向 plumb 断言）——SA2 F1「伪绿盲区」属实，设计追加 C5d–C5g 为纯增量；
  - 全源（packages/apps/domains）零 `nomicoreHubSessionHost`/`NOMICORE_HUB_SESSION_HOST_SERVICE`/`listen === false` 命中——服务面/分派仍为净新增；`apps/yjs-server/src/app.ts:419` listen 对象配置消费方在场。

---

## 1. Reviewed subject

**design**（`wiki/raw/task_issue-422_design.md`，iteration 1）。审点含派发令指定焦点：**新增的免 listen（session-only）值域校验行为**（D7：装配期 resolve+validate + 分块族显式激活窄门）与 ADR/规范一致性；iteration 0 已裁决的其余决策面（分派语义、服务构造、公共面、teardown、DENY 清单）逐项复核确认未漂移。

## 2. Inputs and decision set

决策集：ADR 全集 + CONTEXT.md + `docs/protocols/instance-replication-v1.md` + `packages/ws-replication/AGENTS.md` 明确收录的契约（角色插件服务消费/所有权/公共导出纪律、§21 停机权威）。SA6 契约与 SA2 评审为证据件/修订输入，非决策基准。Issue 评论经 REST 读取为空（无 Owner 要求、无 override 权威）。dispatch 前 SA8 产物（`*_relevant_decisions.md`/`*_conflict_report.md`）仍缺失（契约 §15-U1；见 §8-R4）。

## 3. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0032 | 决策 5（:30）「免 listen 表达为显式 `listen: false`；SessionHost 服务（`nomicoreHubSessionHost`）仅免 listen 模式提供」 | D1 仅 `=== false` 严格相等分派（16 伪值形态落入既有链保持 TypeError；缺省/拼写键不降级）；D5/D8 服务仅免 listen 分支 provide；listen 模式恒不提供（C4d）；两入口并存非法 | **implements-existing-decision** | ADR 0032:30；设计 §7.1/§7.4/§7.7；plugin.ts:292/445（已核） | 实现后核对分派位置（通用键表断言之后）与 listen 模式零 provide |
| ADR 0032 | 后果（:64）「SessionHost 双轨（工厂 + 免 listen 插件服务）」 | 服务轨 = 复用 #420 冻结工厂（`hub-session-host.ts` 零 diff）+ `status`/`stop` 包装；不新增独立插件工厂（D9-a 否决） | **implements-existing-decision** | ADR 0032:64；设计 §7.4/§7.9(a)；DENY `hub-session-host.ts` | 实现后核对工厂零 diff |
| ADR 0032 | 后果（:65）「免 listen 模式的 worker 侧插件不再消费 tokens/authorization/verifyToken/authorize 配置……也不提供 `nomicoreHubReplication` 服务」 | D2/D3：四者不再要求；`listenMode === undefined` 时不构造 staticVerifier/staticAuthorizer 闭包、不 plumb（零消费）；零 `createHubReplication`、零复制服务 provide；消费方经 `requireHubReplication` 得 `/unavailable/`。iteration 1 未触碰该面（修订仅加值域校验） | **implements-existing-decision** | ADR 0032:65；设计 §7.2/§7.3/§7.9(e)(g)；plugin.ts:364-365/392/445（已核） | 实现后核对零 verifier/authorizer 构造、零复制 provide |
| ADR 0032 | 后果（:66）「公开面一经发布即冻结，演进只能 append-only」 | D8 纯追加：配置联合 `| false`（既有成员逐字）、2 值 + 2 类型、模块增强一行、index +2 值 +2 类型（排序插入）；#418 冻结清单一次性授权追加 2 名。iteration 1 对 §7.7 仅追加 import 块（D7 五校验器纯 import），冻结形态语句零变化（与契约 §12.1 逐字比对仍一致） | **implements-existing-decision**（append-only 演进的合法行使） | ADR 0032:66；设计 §7.7；frozen test :144-158/:553（已核，字典序 `NOMICORE_HUB_R` < `NOMICORE_HUB_S`、`requireHubRe…` < `requireHubSe…` 成立） | **实现后核对**（见 §8-R1） |
| **ADR 0012** | **:13「最终合并结果必须严格校验」；:17「limits/timeouts/backoff 按字段合并……未知键拒绝」（iteration 1 新增裁决行） | **D7：免 listen 分支在 resolve 之后、注入 `createHubSessionHost` 之前执行 `validateLimits`+`validateTimeouts`（无条件）+ 分块族三链（显式激活窄门）——iteration 0 缺席的值域半边补齐，插件作为该形态组合根履行「合并结果严格校验」义务；mergeNested 字段级合并与键表拒绝逐字节保留** | **implements-existing-decision** | ADR 0012:13/:17；设计 §7.6 D7/§7.2 D2；`validate.ts:140-282`（已核）；三组合根先例 `hub-connection.ts:76-100` 等（已核） | 实现后核对五校验器接线形态与先例逐行一致（§8-R1） |
| **协议 instance-replication-v1** | **§17 :574-577「分块传输配置：安全缺省、启动期响亮验证、绝不运行时 clamp」+ 配置启动校验链清单；:614/:616「调用方显式配置……时对应链式校验响亮生效；未表达新键的存量配置不误判」（非追溯性）（iteration 1 新增裁决行）** | **D7 逐条兑现：无条件链（budget/队列/水位/控制额度）+ 三条显式激活链（`maxChunkedUpdateBytes` ∨ `maxChunksPerUpdate` → transfer 链；`maxChunkedBootstrapBytes` → bootstrap 链；`maxChunkedSyncDiffBytes` → sync-diff 链）；门输入 = mergeNested 合并结果（显式表达面），对 resolve 结果校验；零 clamp、零第二套校验器（纯 import `validate.ts`）；抛错时机 = apply 期（「启动期响亮验证」的既有时点——listen 模式现状同款）。C5g 负控双向钉住激活/不激活语义** | **implements-existing-decision** | 协议 :574-577/:614/:616（已核原文）；设计 §7.6 D7 步骤 3/§12 C5g；`validate.ts:208-243` 注释（N5/N6）；`hub-connection.ts:85-100` 同款窄门（已核） | 实现后核对窄门键集与先例逐字节等价（§8-R1） |
| #420 工厂配置契约（代码事实，佐证） | `hub-session-host.ts:47`「limits: ResolvedLimits; // 组合根 resolve+validate 后注入（既有纪律）」 | D7 正是兑现该注释的组合根义务——iteration 0 只 resolve 不 validate 即违反此契约（SA2 F1）；工厂零校验、零 diff 保持 | no-conflict（义务兑现，非契约改变） | `hub-session-host.ts:44-52`（已核）；`hub-session.ts`/`hub-session-host.ts` 零 validate import（grep 已核）；设计 §7.6 | 实现后核对工厂仍零 diff |
| ADR 0032 | 状态行（:4）+ 决策 5「listen 模式行为逐字节不变」 | D2 listen 模式校验链零删除/零重排/零消息变化；D7 仅存在于免 listen 分支（listen 分支值域校验仍由 `createHubReplication` 承担，零重复校验）；既有 15 项插件测试 DENY | no-conflict | ADR 0032:4；设计 §7.2/§7.6/§11；plugin.ts:392（已核：listen 值域校验在 start 内 = apply 期，不受 D7 影响） | 实现票逐表达式核对 :292-316/:392-448（R1） |
| ADR 0032 | 决策 2（:18）「nomicore 不引入 worker_threads/MessageChannel 的任何依赖或类型」 | 零新依赖、进程内服务面；D7 的 `validate.ts` import 为包内既有模块（非新依赖）；`package.json` DENY；NC-6 结构门保持 | no-conflict | ADR 0032:18；设计 §7.3/§7.6/§11 | — |
| ADR 0032 | 附录 A1（:38-41）缝信号载体：`closed` = `close()` promise resolve；`settled` = 通道终态恰一次信号 | D6 stop 收口判据 = 句柄 `close()` promise resolve + `timer.active` 清零；不以 `settled` 为判据（连接级 close 不经 notifySettled——已复核 `hub-namespace.ts:1204-1212` 无该调用） | no-conflict | ADR 0032:39；设计 §7.5/S8；hub-namespace.ts:1204-1212（已核） | — |
| ADR 0032 | 附录 A2-β（:48）authorize 不在 session 侧调用；`open()` 描述子纯 JSON | 服务 `open` 原样转发 `HubSessionOpenInput`（#420 冻结语义零改动）；D7 不触碰 open 路径 | no-conflict | ADR 0032:48；设计 §7.4；hub-session-host.ts:54-62 | — |
| ADR 0032 | 附录 A3（:53）dormant 降级面为对外可观察契约 | 工厂内已实现（dataGateOpen 恒 true 等），服务轨不触碰 | no-conflict | ADR 0032:53；hub-session-host.ts:186-206 | — |
| ADR 0032 | 后果（:67）peer 侧不拆分 | peer 源文件全 DENY | no-conflict | ADR 0032:67；设计 §11 | — |
| ADR 0012 | :15-17/:31-37 角色 inject、side-effect 前角色断言、所有权（只拥有自身资源 + 发布服务）、:22 凭据不泄漏 | inject 四服务不变；角色断言先于一切装配副作用（C1e，共享 apply 前缀——已核 :372-378）；免 listen 模式下插件只拥有会话台账 + 包装句柄 + OwnedTimer + 发布服务；D7 抛错点先于 `ctx.provide`（零清理义务）；错误消息不回显凭据（`validate.ts` assertCollKind 消息形态已核） | no-conflict | ADR 0012:15-22/:31-37；设计 §7.3/§7.6/§9；plugin.ts:372-378（已核） | — |
| ADR 0012 | :16-18「Hub 配置拥有 listen、authentication、authorization……」/「Hub ready 表示 listener 已接纳且认证/授权已接线」（撰写时仅 listen 模式存在） | listen 模式条款逐字节保持；免 listen 模式语义由更晚的 ADR 0032:64-65 显式 carve-out 授权（后法细化的模式分工，非契约改变） | no-conflict（裁量点 2，见下） | ADR 0012:16-18 vs ADR 0032:64-65 | — |
| 协议 instance-replication-v1 | §17 :582「`listen: false` 下 `maxConcurrentAssembliesPerConnection` 降级为 per-session 计数」；§23.1 :833 发射侧归属表 | 分片形态已为规范登记形态；服务轨驱动工厂（per-session 槽位在 `hub-session-host.ts` 已实现）；D7 校验的是同一配置键族的值域，不触碰计数口径；零协议修订 | no-conflict（规范文本零触碰且已登记本形态） | 协议 :582/:833（已核）；hub-session-host.ts:192-200 | — |
| 协议 instance-replication-v1 | §21 停机顺序/异常安全（停接纳→排空→close sessions 释放 lease→上游归组合根；不得从 sequencer 槽内 await 上游收口） | D5/D6：stopped 闩锁先行拒新 open→全台账 close（内含 drainPendingApplies + lease release）→timer 兜底→revoke；不触 Registry；close reject 响亮传播不吞错；iteration 1 未改该面 | no-conflict | 协议 §21（已核）；设计 §7.5/§9；hub-namespace.ts:1204-1212（已核） | — |
| ADR 0023 + CONTEXT.md:174 | 「凡经 `ctx.provide` 发布的服务对象，函数成员一律访问器属性 + `Object.freeze`」；服务方法返回值不适用 | `HubSessionHostService` = Object.freeze + getter（status/open/stop）；包装句柄为服务方法返回值，不在纪律面（CONTEXT.md:174 明文排除） | **implements-existing-decision** | ADR 0023:45；CONTEXT.md:174（已核）；设计 §7.4；plugin.ts:431-441 同款（已核） | 实现后核对冻结服务形态 |
| ws-replication AGENTS | :16-18「角色插件消费 Instance/Clock/Timer/Registry；只拥有自身资源与发布服务；teardown 归组合根；公共导出仅经 `src/index.ts`」 | 同 ADR 0012 行逐项对齐；新导出经 `src/index.ts` 追加；D7 import `validate.ts` 不属公共导出面变更 | no-conflict | AGENTS.md:16-18（已核）；设计 §7.3/§7.6/§7.7 | — |
| #418 冻结导出契约（测试编码的 ADR 0032:66 冻结纪律） | `FROZEN_PRODUCTION_EXPORTS` 13 名 + :553 全等断言 | 一次性授权追加 2 名（字典序成立）；零删除零重排；`FROZEN_TESTING_EXPORTS` 不扰 | no-conflict（append-only 纪律的合法行使；测试文件本身非决策基准） | 设计 §7.7；frozen test :144-158/:553（已核） | **实现后核对**（见 §8-R1） |
| CONTEXT.md | 「SessionHost」词条（:229-231）现仅登记工厂轨；docs/AGENTS 要求行为变化同步规范文档 | ALLOW：正文补一句插件轨登记 + `_Avoid_` 追加，严格复述 ADR 0032:30/:64-66 已登记事实，零新语义。iteration 1 未扩大该编辑（D7 属实现行为，词条不承载校验细节） | **implements-existing-decision**（文档同步义务，非契约修订） | CONTEXT.md:229-231（已核）；ADR 0032:30/:64-66；设计 §11/U7 | 实现后核对编辑严格 additive（§8-R2） |
| **简报 AC5 两层读法（iteration 1 新增裁决行）** | 正文 :25「非法配置（含 listen 字段拼写变体）构造期响亮 TypeError，无静默降级」 | 设计读法：AC5 的构造期承诺由**键表/形状层**承接（listen 拼写/伪值 16 形态全构造期 TypeError——C5a–C5c）；limits/timeouts **值域层**按组合根纪律在装配期响亮（D7）——与 listen 模式既有两层纪律同构（listen 模式值域 TypeError 本就发生在 apply 期，源码已核 `plugin.ts:392` 在 `start()` 内），「无静默降级」对两层均成立（C5d–C5f 断言构造不抛但 apply rejection 响亮） | no-conflict（简报为任务文本非决策基准；且全部决策文本无一规定值域错误须构造期——ADR 0012:13 只要求严格校验、协议 §17 只要求「启动期响亮验证」；两层读法与既有 listen 模式行为完全对齐，裁量点 3 见下） | 简报 :25；设计 §7.6 时机论证/§4 AC5 行/§12 C5d–C5f；plugin.ts:392（已核） | 实现后核对 parity 断言（C5f）在场且绿（§8-R1） |
| **`validate.ts` 单一事实源（iteration 1 新增裁决行）** | SA4/既有纪律：校验器单一事实源，勿新写第二套（SA2 §10 平行机制检查） | D7 五校验器一律纯 import（`plugin.ts` 现状零 validate import 已核——import 为净新增）；`validate.ts` 本体 DENY 零编辑；无任何校验逻辑复制/改写 | no-conflict | 设计 §7.6/§11 DENY；`validate.ts:140-282`（已核）；plugin.ts import 面（已核） | 实现后核对零第二套校验（§8-R1） |
| **冻结契约套件 + 追加负控块（iteration 1 新增裁决行）** | SA6 契约 §12.2–§12.7 冻结断言（证据件）；SA2 F1(4) 授权追加 | 落盘测试 = 契约套件逐字保留 + **追加** C5d–C5g 值域负控 `it`（套件本身无值域负控——已核 :215 仅正向 plumb）；护栏：若需改冻结断言本身须走 conflict 流程 | no-conflict（纯增量；契约测试非决策基准，且不触碰 #418 冻结测试） | 设计 §11 ALLOW/§12；`artifacts/sa6-issue422-contract-suite/ws-replication-issue422-listen-false.test.ts`（已核） | 实现后核对冻结断言逐字未动（§8-R1） |

**裁决分布**：implements-existing-decision ×8；no-conflict ×15；evolution-required ×0；hard-conflict ×0。

**三处裁量点明示**（均裁 no-conflict，理由留档）：

1. **「提供时形状校验 ≠ 消费」（设计 §7.2/§7.8；SA2 OBS-4 请 SA8 顺带确认——本复审确认）**：ADR 0032:65 禁的是「消费」（接线进运行时对象/依赖其存在）；免 listen 模式对宿主共享配置对象中**提供了但畸形**的 tokens/authorization/adapter 做构造期响亮形状校验，与 ADR 0012:17「最终合并结果必须严格校验」+ 简报 AC5「静默放行正是所禁」同向，且零运行时接线（连 staticVerifier/staticAuthorizer 闭包都不建，D3 条件绑定已消除解读空间）。不构成对 :65 的违反。iteration 1 维持该裁量，未扩大。
2. **ADR 0012:16-18 与新模式的表述差**：ADR 0012 撰写时 Hub 插件仅有 listen 模式；免 listen 模式是 ADR 0032 自创的新模式，其语义由 ADR 0032:64-65 明文给出。ADR 0012 对 listen 模式的条款逐字节保持（AC4），对新模式无主张、无矛盾——非 supersede、非 evolution-required。
3. **AC5「构造期 TypeError」的两层读法（iteration 1 新增，D7 时机）**：值域错误裁为装配期（apply promise rejection）而非构造期。理由：(a) 简报 AC5 括注的承重对象是「listen 字段拼写变体」——该层全构造期保持；(b) listen 模式同配置的值域 TypeError 现状即装配期（源码已核），构造期化会在两模式间制造新的时机不对称（SA2 F1 谴责的分叉的时序翻版，设计 §7.6 否决备选论证成立）；(c) 决策集无一文本要求值域错误构造期抛出——ADR 0012:13 只要求「严格校验」，协议 §17 要求「启动期响亮验证」（apply 期属启动期）。该读法与决策集完全相容；若 Owner 未来裁 stricter 读法，属简报层澄清，不构成本门禁的冲突。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无需任何 override：免 listen 模式、SessionHost 服务、认证授权豁免、复制服务缺席、append-only 公共面扩展、**装配期值域校验（D7——ADR 0012:13 与协议 §17 的既有义务在新形态的兑现，校验器单一事实源）**——全部为既有决策明文授权或既有规范义务的兑现，而非对任何决策的覆盖。Issue 评论为空，亦无 Owner override 权威在场。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| wire 格式/消息码/协议错误码/事件词表 | 零触碰 | 协议全文；设计 §1 非目标/§11 DENY 协议文档 | 设计不触碰（D7 仅配置校验，分片形态已由协议 §17/:582、§23.1/:833 登记）——待实现 diff 复核 |
| listen 模式行为与服务面 | 逐字节不变（含值域校验仍由 `createHubReplication` 单点承担、无双重校验） | ADR 0032:4；AC4；D2 零重排声明；既有 15 项插件测试 + 包全量 DENY | 设计保持（D7 仅免 listen 分支；除一处授权冻结清单追加外零既有测试编辑）——待实现 diff 复核 |
| #420 工厂面（`hub-session-host.ts`） | 零 diff | 设计 §11 DENY；契约 §12.1 引用不改 | 设计经包装/委托消费——待实现 diff 复核 |
| `nomicoreHubReplication` 服务形态 | 形态不变；免 listen 模式不提供 | ADR 0032:65；C3a–C3c | 设计一致 |
| peer 侧 | 零触碰 | ADR 0032:67 | 设计 DENY 一致 |
| 公共导出集 | append-only（13→15，零改名零删除） | ADR 0032:66；§7.7；frozen test :553 | 设计纯追加（字典序核验成立；iteration 1 未改该面）——**待实现核对** |
| 配置联合 | 仅追加 `| false` 成员，既有成员逐字 | ADR 0032:30/:66 | 设计一致——待实现核对 |
| **`validate.ts` 校验器本体** | **零编辑（纯 import；单一事实源，无第二套校验）** | 设计 §11 DENY + §7.6；SA2 §11 | 设计一致（import 面 = 五函数净新增于 plugin.ts）——**待实现核对** |
| **免 listen 值域失败语义** | **装配期 TypeError（apply promise rejection，消息 `limits:`/`timeouts:` 家族），拒绝点先于 provide——与 listen 模式同生命周期点、同错误家族；无条件链 + 分块族显式激活窄门（键集与 `hub-connection.ts:85-100` 等价）** | 设计 §7.6 D7/§9；协议 §17 :574-577/:614/:616；ADR 0012:13 | 设计已定形——**待实现核对（新失败类为本复审后置 recheck 主项）** |
| 依赖面 | 零新依赖/零跨线程类型 | ADR 0032 决策 2（:18） | 设计一致（包内 import 非依赖变化；NC-6 结构门保持） |
| `FROZEN_TESTING_EXPORTS` / 契约套件冻结断言 | 不扰 / 逐字保留（追加负控块为增量） | 设计 §7.7/§11；SA2 F1(4) | 设计一致——待实现核对 |

## 6. Evolution requirements

**无**。本设计（含 iteration 1 的 D7 修订）不需要修订任何 ADR、CONTEXT 语义或协议文档：免 listen 表达、服务面、认证授权豁免、复制服务缺席、per-session 计数口径、发射侧归属、**配置值域启动期响亮验证 + 显式激活非追溯纪律**均已被 ADR 0032（决策 5/后果节/附录）、ADR 0012:13/:17、协议 §17 在先登记或义务化；D7 是这些既有义务在新形态的兑现（校验器复用 `validate.ts` 单一事实源，无第二语义源——设计主张经本门禁独立核实成立）。设计计划的两处文档编辑（CONTEXT.md SessionHost 词条追加、README 免 listen 条目）为 docs/AGENTS「行为变化同步规范文档」义务的**纯增量登记**（内容限于复述 ADR 0032 已登记事实），不属 evolution-required；实现时须与代码同变更集（见 §8-R2）。

## 7. Hard conflicts

**无。** 派发令指定焦点——新增的 session-only 值域校验行为（D7）——经逐条款对照为**既有规范义务的兑现**：ADR 0012:13（合并结果严格校验）、协议 §17（启动期响亮验证、绝不运行时 clamp、显式激活非追溯）、#420 工厂配置契约（组合根 resolve+validate 注入）均由此行为满足而非被违反；iteration 0 的「一响一静」缺口反而是对 ADR 0012:13 的违反，iteration 1 修正了它。listen 模式/wire/peer/工厂冻结面零触碰；公共面扩展走 ADR 0032:66 append-only 唯一合法通道（#420/#421 先例在场）。未发现与决策集不兼容的任何条款。

## 8. Required actions

| # | 义务 | 裁给 |
|---|---|---|
| R1 | **实现后冲突复查**（本报告即标记；iteration 1 已并入设计 §13-F1 的追加项）：逐项核对——①公共面 append-only 落地（15 名、字典序插入、`:553` 断言形态逐字）；②`listen` 联合仅追加 `| false`；③listen 模式校验链与 start 主体零重排零消息变化（AC4）；④免 listen 零 verifier/authorizer 构造与零 `nomicoreHubReplication` provide；⑤服务 Object.freeze + getter 形态（ADR 0023）；⑥DENY 清单全部零 diff；⑦（iteration 1 追加）**D7 值域校验半边：`validate.ts` 五函数纯 import、resolve→validate 次序、无条件链 + 分块族显式激活窄门与 `hub-connection.ts:85-100` 键集逐字节等价、抛错先于 provide（新失败类 = apply rejection TypeError）、`validate.ts` 本体零编辑零第二套校验、追加负控块 C5d–C5g 不触碰契约冻结断言**；⑧CONTEXT.md/README 编辑严格 additive 且与代码同变更集 | 实现阶段 SA8 |
| R2 | CONTEXT.md/README 编辑与代码同变更集，内容严格限于复述 ADR 0032:30/:64-66（零新语义、零新术语；不承载 D7 校验细节） | 实现票 |
| R3 | 非阻塞观察（维持 iteration 0 登记）：`docs/integration/cordis-plugin-hosting.md:179`「Hub plugin 只有在 listener 建立后才发布 ready service」在 `listen: false` 落地后仅对 listen 模式成立。该文档非规范决策文档（不构成阻塞依据），设计已 DENY 并把 worker 组合文档裁给宿主侧后续票（F4）；建议该票落地时为本句补模式限定，避免表述漂移 | 宿主侧后续票（F4） |
| R4 | F1（契约 U1 登记的合入前 SA8 义务）由本设计后复审（iteration 1，本次 clear）+ R1 实现后复查共同闭合；**在 R1 完成前不得视为已清**。dispatch 前 SA8 产物（relevant_decisions/conflict_report）仍缺失，合入前义务保持开放 | 总控 |

## 9. Verdict

**clear**

iteration 1 设计全部实质决策点落在既有决策与规范义务的包络之内：免 listen 模式为 ADR 0032 决策 5 及后果节的兑现（implements-existing-decision），listen 模式/wire/peer/工厂冻结面零触碰（no-conflict），公共面扩展走 :66 append-only 唯一合法通道（#420/#421 先例在场）。**派发令焦点——新增 session-only 值域校验（D7）——为 ADR 0012:13「合并结果严格校验」+ 协议 §17「启动期响亮验证/显式激活非追溯」+ #420 工厂组合根契约的义务兑现（implements-existing-decision），校验器单一事实源（纯 import），时机/错误家族/激活判据与 listen 模式逐点对齐（源码独立核实），无第二语义源。** SA2 F1 的四处修订要求全部落实且未引入新决策面漂移。无 evolution-required、无 hard-conflict、无 override 需求。设计自身登记的复查需求（§13）正确且与本报告 R1 一致。

## 10. requiresConflictRecheck

**true** —— 公共 API 扩展（新服务常量/require 函数/2 类型 + 配置联合成员）、#418 冻结导出面的一次性授权编辑、新服务生命周期/失败语义（stop 收口、stop-then-open 拒绝、服务撤销不可用面）、**iteration 1 新增的免 listen 装配期值域失败类（D7：apply rejection TypeError、validate.ts import 面、窄门激活判据）**、CONTEXT.md/README 词条编辑均尚待实现 diff 逐项核对（§8-R1/R2）；dispatch 前 SA8 门禁产物缺失的合入前义务（§8-R4）亦未闭合。实现后复查闭合前保持 true。
