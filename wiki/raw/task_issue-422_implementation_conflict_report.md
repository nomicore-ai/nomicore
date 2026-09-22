# 冲突门禁报告（实现后复审）— issue #422

**被审对象**：implementation——issue #422 实际 diff（工作树，HEAD `4ad13a3`）：hub 插件免 listen 模式（`listen: false`）与 `nomicoreHubSessionHost` 服务（spec #415 T5）。变更集 = `packages/ws-replication/src/{plugin.ts,index.ts}`、`packages/ws-replication/README.md`、`CONTEXT.md`、`test/ws-replication-issue418-edge-session-split-contract.test.ts`（授权编辑）+ 两份新增测试（`ws-replication-issue422-listen-false.test.ts`、`ws-replication-issue422-session-host-api.test-d.ts`）。
**门禁类型**：实现后复审（design 后冲突报告 R1 指定；SA3 报告 `wiki/raw/task_issue-422_sa3_impl.md` §Deferred verification 登记待办）。
**复审焦点**（dispatch 指定）：实际 diff vs 适用 ADR 与规范协议的冲突——**含公共 API 与 session-only（免 listen）语义**；设计后报告 R1 清单 ①–⑧ 逐项核对。
**产出时间**：2026-09-22。SA8 只读审查：未修改任何被审对象/决策文档、未运行测试（证据取自静态 diff + SA3/SA6 日志登记）。

**对照基准**：

- `docs/adr/` 全集 31 份（0001–0030、0032；无 0031；独立盘点：除 0015（提议）外全部 accepted，无 superseded——0006/0020/0021/0025 的 grep 命中均为被引/修订叙述，非 supersede 状态）。核心相关：**0032**（决策 2/5、后果 :64-66、附录 A1/A2-β/A3）、**0023**（:45 构造纪律）、**0012**（:13/:15-22/:31-37）、0010（架构背书）。其余经标题/状态扫描确认无关联决策面。
- `CONTEXT.md`（「SessionHost」:229-231、「服务表面」:174 等）。
- `docs/protocols/instance-replication-v1.md`（§17 :564-616 配置纪律/分片计数口径、§21 :671-686 停机、§23.1 :833-846 发射侧归属）。
- `packages/ws-replication/AGENTS.md`（角色插件服务消费/所有权/teardown/公共导出纪律；§21 为停机权威）。
- issue #422 正文（`wiki/raw/task_issue-422.md`）；**Owner 评论经 REST 读取为空——无 Owner 要求，无 override 权威在场**。
- 证据件（非决策基准）：SA6 契约 `task_issue-422_sa6_contract.md`、SA2 评审、SA3 实现报告、`artifacts/sa6-issue422-contract-suite/*`、`artifacts/sa3-issue422-*.log`。

**基线核实**（本门禁独立执行于工作树 diff，非转抄 SA3/设计声明）：

- `git status`/`git diff` 全量核对：tracked 变更恰 5 文件（plugin.ts/index.ts/README/CONTEXT/418 冻结测试）；untracked 生产文件恰 2 测试；DENY 清单（`hub-session-host.ts`/`hub-session.ts`/`hub-namespace.ts`/`hub-split.ts`/`hub-edge.ts`/`hub-edge-host.ts`/`hub-connection.ts`/`peer-*.ts`/`testing.ts`/`defaults.ts`/`validate.ts`/`types.ts`/`ws-replication-plugin.test.ts`/`package.json`/`apps/yjs-server/**`/`docs/adr/**`/`docs/protocols/**`/`docs/integration/**`）**零 diff**。
- 落盘测试 vs `artifacts/sa6-issue422-contract-suite/*` diff 核对：运行时件 = 头部 doc 注释差异 + `302a304,419` 纯追加（C5d–C5g 五 `it`）；test-d = 仅头部 doc 注释差异，断言体逐字一致。
- 关键源码行号独立核实（见下表 Evidence 列，全部为当前工作树行号）。

---

## 1. Reviewed subject

**implementation**（issue #422 实际 diff）。审点含 dispatch 指定焦点：**公共 API（append-only 面、模块增强、冻结导出测试授权编辑）与 session-only 语义**（精确 `false` 分派、零 listener/零认证授权消费、`nomicoreHubReplication` 缺席、两入口互斥、两层校验纪律、stop 收口）。

## 2. Inputs and decision set

决策集 = ADR 全集 + CONTEXT.md + `docs/protocols/instance-replication-v1.md` + `packages/ws-replication/AGENTS.md` 明确收录的契约。SA6 契约/SA2 评审/SA3 报告为证据件。设计（iteration 1）与设计后冲突报告（clear；R1–R4）为复查清单来源。Issue 评论为空（无 Owner 要求、无 override 权威）。

## 3. Decision analysis

| Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0032 | 决策 5（:30）「免 listen 表达为显式 `listen: false`；SessionHost 服务（`nomicoreHubSessionHost`）仅免 listen 模式提供」 | 分派 = 两条通用 record 断言**之后**的 `config.listen === false` 严格相等（拼写键/伪值/缺省形态全部落入既有 listen 断言链保持构造期 TypeError）；`ctx.provide(NOMICORE_HUB_SESSION_HOST_SERVICE)` 全文件唯一发布点位于 `startHubSessionHostService`，仅 `listenMode === undefined` 分支可达；listen 分支零发布（两入口互斥落地） | **implements-existing-decision** | `plugin.ts:347-354`（分派）、`:468-471`（分支）、`:616`（唯一 provide 点）；`assertRecord`（:187-192）拒 null/非对象/数组/未知键 | — |
| ADR 0032 | 后果（:64）「SessionHost 双轨（工厂 + 免 listen 插件服务）」 | 服务轨 = #420 冻结工厂直接消费（`createHubSessionHost`）+ `status`/`stop` 包装；`hub-session-host.ts` **零 diff**；未新增独立插件工厂（复用 `createHubReplicationPlugin` 单入口） | **implements-existing-decision** | `plugin.ts:540-571`（工厂消费）；git status（工厂零 diff）；`index.ts`（无新工厂导出名） | — |
| ADR 0032 | 后果（:65）「免 listen 模式的 worker 侧插件不再消费 tokens/authorization/verifyToken/authorize 配置……也不提供 `nomicoreHubReplication` 服务」 | `listenMode` 条件绑定：免 listen 时**不构造** staticVerifier/staticAuthorizer/adapter 闭包（连惰性闭包都不建）；分支先 return，零 `createHubReplication` 调用、零复制服务 provide；消费方经 `requireHubReplication` 得 `/unavailable/`。**裁量点 1（沿设计后报告裁定，未扩大）**：`validateHubSessionOnlyConfig` 对宿主**提供了**的 tokens/authorization/`overrides.listen` 做构造期形状校验（零运行时接线、零依赖其存在）——「校验 ≠ 消费」（ADR 0012:13/:17 + AC5 同向），不构成对 :65 的违反 | **implements-existing-decision** | `plugin.ts:436-442`（条件绑定）、`:468-471`、`:325-344`（形状子集）；`:525`（复制服务唯一 provide 点在 listen 分支） | — |
| ADR 0032 | 后果（:66）「公开面一经发布即冻结，演进只能 append-only」 | 公共面纯追加：`listen` 联合仅追加 `\| false`（listen 分支类型逐字不变）；`NOMICORE_HUB_SESSION_HOST_SERVICE` + `requireHubSessionHost` + `HubSessionHostService`/`HubSessionHostStatus`；模块增强恰一行（frozen 位置 `nomicoreHubReplication` 与 `nomicorePeerReplication` 之间）；`index.ts` +2 export 语句（13→15 名，零改名零删除）；#418 冻结清单排序插入 2 名（字典序成立） | **implements-existing-decision**（append-only 合法行使；#420/#421 先例） | `plugin.ts:100-118/:169-172`；`index.ts` diff；frozen test `:144-162`（`:553` 断言形态逐字未动） | — |
| ADR 0012 | :13「最终合并结果必须严格校验」；:17「limits/timeouts/backoff 按字段合并……未知键拒绝」 | 免 listen 分支值域半边落地（SA2 F1/D7）：插件即组合根——`resolveLimits`/`resolveTimeouts`（defaults.ts resolver，零逐字段 clamp）→ `validateLimits`/`validateTimeouts`（无条件）→ 分块族三链显式激活窄门 → 注入工厂；`mergeNested` 字段级合并与 config/overrides 键表断言逐字节保留 | **implements-existing-decision** | `plugin.ts:547-562`；`:432-433`；`:347-348`；`defaults.ts:61-70` | — |
| 协议 instance-replication-v1 | §17 :575「安全缺省、启动期响亮验证、绝不运行时 clamp」；:591-610 启动校验链清单；:614/:616「调用方显式配置……时对应链式校验响亮生效；未表达新键的存量配置不误判」（非追溯性） | 装配期（apply 内同步段）抛 `validate.ts` `TypeError` → async `start()` → `apply()` promise rejection，先于 `ctx.provide`/`ctx.effect`（零服务/零会话/零定时器）；三链窄门键集与谓词结构与 `hub-connection.ts:85-100` **逐键逐形等价**（`maxChunkedUpdateBytes` ∨ `maxChunksPerUpdate` → transfer 链；`maxChunkedBootstrapBytes` → bootstrap 链；`maxChunkedSyncDiffBytes` → sync-diff 链）；门输入 = 同一 `mergeNested` 结果（listen 分支传 `createHubReplication` 的同一对象，`:479`）——两模式激活判据字节等价；零运行时 clamp、零第二套校验器 | **implements-existing-decision** | `plugin.ts:547-562` vs `hub-connection.ts:76-100`（并排核对）；`validate.ts:140-282`；协议 :575/:591-616 | — |
| 协议 instance-replication-v1 | §17 :582「`listen: false` 下 `maxConcurrentAssembliesPerConnection` 降级为 per-session 计数」；§23.1 :833-846 发射侧归属表 | 零触碰：per-session 槽位在 #420 工厂（零 diff）；observer 经工厂配置注入（namespace 域发射侧 = 拥有事实的一侧）；插件层零新发射点 | no-conflict | git diff（`hub-session-host.ts`/`hub-namespace.ts` 零 diff）；`plugin.ts:569`（observer 直通） | — |
| 协议 instance-replication-v1 | §21 :675-686 停机顺序/异常安全（停接纳→排空→close sessions 释放 lease→上游归组合根；不得从 sequencer 槽内 await 上游收口） | `stop`：`serviceStopped = true` 闩锁先行（此后 `open` 响亮拒绝）→ `Promise.all(全台账 close())`（内含 drain→settleClose→lease release，#420 冻结工厂行为）→ `finally { timer.dispose(); sessions.clear(); }`（OwnedTimer 兜底，异常安全）；不触 Registry/上游；effect 反向 yield 形态与既有 hub/peer 插件同构（drain 期间服务在场） | no-conflict | `plugin.ts:576-577`（闩锁+拒绝）、`:595-603`（stop）、`:614-619`（effect；对照 `:522-528`/`:722-727` 既有模式） | — |
| ADR 0023 + CONTEXT.md:174 | :45「凡经 `ctx.provide` 发布的服务对象，函数成员一律以访问器属性构造 + `Object.freeze`」；返回值不适用 | `HubSessionHostService` = `Object.freeze` + 3 getter（`status`/`open`/`stop`，getter 返回稳定闭包）；包装句柄为服务方法返回值（CONTEXT.md:174 明文排除，不冻结合法） | **implements-existing-decision** | `plugin.ts:606-612`；`plugin.ts:515-521`（listen 模式同款既有形态） | — |
| ADR 0032 | 状态行（:4）「listen 模式行为逐字节不变」+ 简报 AC4 | `validateHubConfig` 唯一改动 = 在两条通用 record 断言后**插入**分派（listen 断言链 `:355-378` 零删除/零重排/零消息变化）；`start()` listen 主体仅引用改名（`authorize`→`listenMode.authorize` 等），表达式/调用次序/错误消息逐字保持；既有 15 项插件测试零 diff；服务发布/`listener` 语义不变 | no-conflict | plugin.ts diff 逐 hunk核对；`test/ws-replication-plugin.test.ts` 零 diff；SA3 `package-suite.log`（92 files/829 tests）登记 | — |
| ADR 0032 | 决策 2（:18）「nomicore 不引入 worker_threads/MessageChannel 的任何依赖或类型」 | 零新 import（新增 import 全为包内既有模块：defaults/hub-session-host/validate）；`package.json` 零 diff；零网络 API（结构门 NC-6 在测试 :143 在场） | no-conflict | plugin.ts import 块 diff；git status（package.json 零 diff） | — |
| ADR 0032 | 附录 A2-β（:48）authorize 不在 session 侧调用；`open()` 描述子纯 JSON | 服务 `open` = `host.open(input)` 原样转发（#420 冻结语义）；新代码零 authorize/transport 引用 | no-conflict | `plugin.ts:576-578`；`hub-session-host.ts:54-62`（零 diff） | — |
| ADR 0032 | 附录 A3（:53）dormant 降级面为对外可观察契约 | 工厂内已实现，服务轨零触碰（工厂零 diff） | no-conflict | git status | — |
| ADR 0032 | 后果（:67）peer 侧不拆分 | `peer-connection.ts`/`peer-namespace.ts`/peer 插件段零 diff | no-conflict | git status；`plugin.ts:623-731`（零 diff，经 diff 无 hunk） | — |
| ADR 0012 | :15/:31-37 角色 inject、side-effect 前角色断言、所有权（只拥有自身资源 + 发布服务）、:19 Fiber dispose 只 drain 自身 | `inject` 四服务不变；`apply` 前缀（requireNomicoreInstance→assertRole('hub')→requireClock→requireNomicoreRegistry→timerFromContext）两模式共享零改动（peer 角色先于一切装配副作用同步拒绝）；免 listen 模式插件只拥有会话台账 + 包装句柄 + OwnedTimer + 发布服务；上游 Registry 零触碰 | no-conflict | `plugin.ts:448-456`；`:572-612`（拥有面）；`:595-619`（teardown 面） | — |
| ADR 0012 | :16-18「Hub 配置拥有 listen、authentication、authorization……」/「Hub ready 表示 listener 已接纳且认证/授权已接线」（撰写时仅 listen 模式存在） | listen 模式条款逐字节保持；免 listen 模式语义由更晚的 ADR 0032:64-65 显式 carve-out 授权（后法细化的模式分工）——**裁量点 2（沿设计后报告裁定）** | no-conflict | ADR 0012:16-18 vs ADR 0032:64-65；listen 分支零变化 | — |
| ADR 0012 | :22「status、observer 与错误不得泄漏 token、Authorization、owner 完整值……」 | `HubSessionHostStatus` = `{state:'ready'\|'stopped', sessions:number}`（零凭据）；新错误消息（`…is unavailable`/`…is stopped`/`validate.ts` 家族）不含凭据值 | no-conflict | `plugin.ts:105-110/:417/:577`；`validate.ts` 消息形态（零编辑） | — |
| #418 冻结导出契约（测试编码的 ADR 0032:66 纪律） | `FROZEN_PRODUCTION_EXPORTS` 13 名 + `:553` 全等断言 | 一次性授权追加 2 名（各带来源注释，排序插入：`NOMICORE_HUB_R` < `NOMICORE_HUB_S`、`requireHubRe…` < `requireHubSe…` 成立）；零删除、零重排；断言形态 `Object.keys(productionApi).sort()).toEqual(...)` 逐字未动；`FROZEN_TESTING_EXPORTS` 不扰 | no-conflict（append-only 合法行使） | frozen test `:144-162`（当前态）；`:553` 区域 | — |
| `validate.ts` 单一事实源（SA4/SA2 既有纪律） | 校验器勿新写第二套 | 五校验器一律纯 import（`validate.ts` 本体零编辑）；`validateHubSessionOnlyConfig` 仅含键表/形状检查（镜像 listen 模式自有形状层），零值域逻辑复制 | no-conflict | `plugin.ts:15-21`（import）；`:325-344`（形状层）；git status（validate.ts 零 diff） | — |
| SA6 契约套件冻结断言 + SA2 F1(4) 授权追加 | §12.2–§12.7 冻结形态 / C5d–C5g 追加授权 | 落盘运行时件 = 契约套件逐字保留（diff 仅头部 doc 注释）+ 末尾纯追加 C5d–C5g 五 `it`（复用文件级夹具，不触碰冻结断言）；test-d 断言体逐字一致 | no-conflict（纯增量） | `diff` 落盘件 vs `artifacts/sa6-issue422-contract-suite/*`（本门禁独立执行：`302a304,419` 纯追加） | — |
| 简报 AC1–AC6（任务文本，非决策基准） | :21-:26 | AC1 装配+服务+test-d 锁；AC2 零 listener/零网络面；AC3 复制服务缺席；AC4 listen 逐字节不变；AC5 两层响亮（键表/形状构造期 + 值域装配期——**裁量点 3（沿设计后报告裁定）**：AC5 括注承重对象是「listen 拼写变体」，该层全构造期；值域按组合根纪律装配期，与 listen 模式既有两层纪律同构，决策集无一文本要求值域构造期抛出）；AC6 stop 收口+timer 清零（判据 = close promise resolve + `timer.active` 清零，不以 `settled` 为判据——ADR 0032:39 载体语义） | no-conflict | 实现全项落地（上各行）；测试断言面 `ws-replication-issue422-listen-false.test.ts` :88-313 + :315-419 | — |
| docs/AGENTS「行为变化同步规范文档」 | 行为变化须同步规范文档 | CONTEXT.md SessionHost 词条正文追加插件轨登记一句 + `_Avoid_` 追加两条；README 追加免 listen 条目——内容严格限于复述 ADR 0032:30/:64-66 已登记事实（服务名/精确 `false`/互斥/认证授权豁免），零新术语、零新决策语义；与代码同变更集 | **implements-existing-decision**（R2 闭合） | CONTEXT.md diff（:229-231 区域）；README diff（:10） | — |

**裁决分布**：implements-existing-decision ×6；no-conflict ×16；evolution-required ×0；hard-conflict ×0。

**三处裁量点**（沿设计后报告裁定复核，实现未扩大、未偏离）：

1. **「提供时形状校验 ≠ 消费」**：`validateHubSessionOnlyConfig`（plugin.ts:325-344）对提供的 tokens/authorization/`overrides.listen` 只做形状校验，零运行时接线、零闭包构造——ADR 0032:65 禁的是消费（接线/依赖），实现与设计裁定一致。
2. **ADR 0012:16-18 与新模式的表述差**：listen 模式条款逐字节保持；免 listen 语义由 ADR 0032:64-65 carve-out 授权。实现无扩大。
3. **AC5 两层读法**：值域错误在装配期（apply promise rejection）——与 listen 模式现状（`createHubReplication` 组合根、同为 apply 期）同生命周期点同错误家族；协议 §17「启动期响亮验证」覆盖该时点。实现与裁定一致（C5d–C5f parity 断言在场）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | — | — | — |

无需任何 override：免 listen 模式、SessionHost 服务、认证授权豁免、复制服务缺席、append-only 公共面扩展、装配期值域校验全部为 ADR 0032（:30/:64-66）+ ADR 0012:13 + 协议 §17 既有决策/义务的兑现。Issue 评论为空，无 Owner override 权威在场。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| wire 格式/消息码/协议错误码/事件词表 | 零触碰 | 协议全文；diff 文件清单 | **零 diff**（codec/FSM/edge/session 源文件全部不在变更集） |
| listen 模式行为与服务面 | 逐字节不变（校验链零重排零消息变化；start 主体仅引用改名；值域校验仍单点在 `createHubReplication`） | ADR 0032:4；AC4 | **保持**（diff 逐 hunk 核对：分派为纯插入；listen 链 `:355-378` 逐字未动；`ws-replication-plugin.test.ts` 零 diff） |
| #420 工厂面（`hub-session-host.ts`） | 零 diff | 设计 §11 DENY | **零 diff** ✓ |
| `nomicoreHubReplication` 形态 | 不变；免 listen 模式不提供 | ADR 0032:65 | 形态零变化；免 listen 分支零 provide ✓ |
| peer 侧 | 零触碰 | ADR 0032:67 | **零 diff** ✓ |
| 公共导出集 | append-only 13→15 | ADR 0032:66；frozen test `:553` | 运行时导出恰 +2 名（排序插入、零删除/改名/重排）；类型 +2；断言形态逐字 ✓ |
| 配置联合 | 仅追加 `\| false` | ADR 0032:30/:66 | `plugin.ts:102` 恰一成员追加，既有成员逐字 ✓ |
| `validate.ts` 校验器本体 | 零编辑、纯 import、无第二套 | 设计 §11；SA2 §11 | **零 diff**；五函数纯 import；新校验函数仅形状层（无值域复制） ✓ |
| 免 listen 值域失败语义 | 装配期 TypeError（apply rejection，先于 provide）；无条件链 + 三链窄门键集与 `hub-connection.ts:85-100` 等价 | 设计 §7.6；协议 §17 | **落地一致**（`:547-562` 并排核对逐键等价；门输入 = 同一合并对象） ✓ |
| 依赖面 | 零新依赖/零跨线程类型 | ADR 0032:18 | `package.json` 零 diff；import 全为包内模块 ✓ |
| `FROZEN_TESTING_EXPORTS` / 契约套件冻结断言 | 不扰 / 逐字保留（追加块为增量） | 设计 §7.7/§11 | 冻结清单 testing 段零变化；落盘测试相对契约基底 = 头注释 + 纯追加 ✓ |

## 6. Evolution requirements

**无。** 实现不需要修订任何 ADR、CONTEXT 语义或协议文档：全部新行为（免 listen 表达、服务面、认证授权豁免、复制服务缺席、装配期值域校验）均为既有决策明文授权或既有规范义务的兑现。两处文档编辑（CONTEXT.md SessionHost 词条、README）为 docs/AGENTS 同步义务的纯增量登记（内容限于复述 ADR 0032 已登记事实），与代码同变更集——R2 闭合。

## 7. Hard conflicts

**无。** dispatch 指定焦点——公共 API 与 session-only 语义——逐项对照：公共面扩展走 ADR 0032:66 append-only 唯一合法通道（#420/#421 先例）；session-only 语义（精确 `false` 严格相等、零 listener、零认证授权消费、`nomicoreHubReplication` 缺席、两入口互斥、两层校验、stop 收口）逐条兑现 ADR 0032:30/:64-66 + ADR 0012:13 + 协议 §17/:21；listen 模式/wire/peer/工厂冻结面零触碰。未发现与决策集不兼容的任何条款。

## 8. Required actions

| # | 义务 | 状态 |
|---|---|---|
| R1（设计后报告） | 实现后冲突复查 ①–⑧：①公共面 append-only 15 名/字典序/`:553` 形态；②`listen` 联合仅追加 `false`；③listen 校验链与 start 主体零重排零消息变化；④免 listen 零 verifier/authorizer 构造、零复制 provide；⑤服务 freeze+getter；⑥DENY 零 diff；⑦D7 值域半边（纯 import/次序/窄门键集等价/先于 provide/零第二套/追加块不触冻结断言）；⑧CONTEXT/README 严格 additive 同变更集 | **本报告闭合**（①–⑧ 全项核对通过，见 §3/§5） |
| R2（设计后报告） | 文档与代码同变更集、严格复述 | **闭合**（同工作树 diff） |
| R3（设计后报告，非阻塞） | `docs/integration/cordis-plugin-hosting.md:179`「Hub plugin 只有 listener 建立后才发布 ready service」在 `listen:false` 落地后仅对 listen 模式成立——非规范决策文档，不构成阻塞；实现按 DENY 未改 | 维持登记，宿主侧后续票（设计 §13-F4）落地时补模式限定 |
| R4（设计后报告） | 合入前 SA8 clear 义务 = 设计后复审（clear）+ R1 实现后复查共同闭合 | **实质闭合**（本报告 clear）。书面向登记：dispatch 前字面产物（`task_issue-422_relevant_decisions.md`/`task_issue-422_conflict_report.md`）仍缺失（契约 U1）——决策内容经设计后复审与本实现后复审双清覆盖，无缺失裁决；若总控要求字面文件名闭合 U1，属流程记账事项，非决策缺口 |

## 9. Verdict

**clear**

实现 diff 全部落在既有决策与规范义务的包络之内：免 listen 模式与 `nomicoreHubSessionHost` 服务为 ADR 0032 决策 5 及后果节的兑现（implements-existing-decision ×6）；listen 模式/wire/peer/#420 工厂/`validate.ts` 冻结面零触碰（no-conflict ×16）；公共 API 扩展（15 名 + 2 类型 + 联合成员 + 模块增强一行）严格 append-only；session-only 语义（精确 `false`、零认证授权消费、复制服务缺席、两入口互斥、装配期值域响亮、stop 收口）逐条与 ADR 0012:13、协议 §17/§21、ADR 0023 一致。设计后报告 R1 清单 ①–⑧ 全项核对通过，R2/R4 闭合。无 evolution-required、无 hard-conflict、无 override 需求。

## 10. requiresConflictRecheck

**false** —— 设计后报告标记的全部待核对项（公共 API、#418 冻结面编辑、新服务生命周期/失败语义、免 listen 装配期值域失败类、CONTEXT/README 编辑）已由本实现后复查逐项对照实际 diff 闭合；无公共 API/wire/schema/持久化/状态机/生命周期/失败语义项尚待实现核对，无正式 override 在途。
