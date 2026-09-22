# SA2 设计攻击评审 — issue #422：hub 插件免 listen 模式（`listen: false`）与 `nomicoreHubSessionHost` 服务

- 评审对象：`wiki/raw/task_issue-422_design.md`（**iteration 1**——按本评审 iteration 0 的 F1 修订；HEAD `4ad13a3`）
- 评审人：SA2（独立攻击评审；未修改任何设计/生产/测试/契约文件；本文件为唯一可写产物，原位更新）
- Verdict：**approve**（iteration 0 的 F1 MAJOR 已按四点要求全部闭合，经源码逐行核验；无 BLOCKER/MAJOR；4 条非阻断观察）
- `requiresConflictRecheck`：**true**（理由见 §2/§15——既有 clear 门禁的被审对象是 iteration 0；iteration 1 新增失败类/import 面/测试授权须并入下一次冲突检查执行）

---

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-422.md`（简报，6 AC） | 在场，已读 |
| `wiki/raw/task_issue-422_design.md`（SA1 设计 **iteration 1**，2026-09-22 修订版） | 在场，全文已读（含 §14 修订映射） |
| `wiki/raw/task_issue-422_sa6_contract.md`（approve 契约） | 在场，全文已读 |
| `wiki/raw/task_issue-422_design_conflict_report.md`（设计后冲突门禁，clear；**被审对象为 iteration 0**） | 在场，全文已读 |
| `wiki/raw/task_issue-422_relevant_decisions.md` / `task_issue-422_conflict_report.md` | **缺失**（契约 §15-U1 已登记；设计后门禁已补位、合入前 SA8 clear 义务开放——设计 §13-F1） |
| 源码核验（本轮全部重验） | `plugin.ts`（:1-79 import 面、:86-92、:143-148、:150-165、:214-217、:289-316、:345-349、:357-383、:385-449、:452-560）；`hub-connection.ts:40-114`（组合根完整形态）；`hub-edge-host.ts:740-780`（同款窄门）；`peer-connection.ts:95-144`（同款窄门）；`validate.ts` 全文（assertCollKind 消息形态、validateLimits:140-206、三链 :223-264、validateTimeouts:266-282）；`defaults.ts` 全文（resolver :61-70 + DEFAULT 值）；`hub-session-host.ts` 全文（:44-52 配置契约、:73-89 句柄/工厂面、:168-171 close、:207-208 clock 门控、:239-257 唯一性台账、:261）；`hub-session.ts:265-289`（closeTail 幂等）；`hub-namespace.ts:1178-1212`（quiesce/terminate/onConnectionClosed 不经 notifySettled）；`index.ts` 全文；`packages/instance/src`（instanceId 构造期校验） |
| 契约测试件 | `artifacts/sa6-issue422-contract-suite/ws-replication-issue422-{listen-false.test.ts,session-host-api.test-d.ts}` 逐断言核对（含文件级夹具可用性——`effectTimer`/`dependencies`/`VALID_LISTEN`/harness 均在场，追加块可直接复用） |
| 测试形态模板 | `test/ws-replication-ac7-faults.test.ts:192-216`（构造期响亮校验模板）、`test/ws-replication-issue244-ac-red.test.ts:704-734`（R1c 激活门模板——设计 C5g ① 的算术先例）、`test/ws-replication-issue418-edge-session-split-contract.test.ts:144-165,551-557`（冻结清单 + `:553` 断言形态） |
| grep 证据 | `src/` 内 `./validate.js` 恰 3 处 import（hub-connection/hub-edge-host/peer-connection）+ `./defaults.js` 3 处——plugin.ts 追加后为第 4 处组合根、零第二套校验；全仓 5 处 `declare module '@deepseek-ai/cordis'` 成员不相交；`hub-session.ts`/`hub-session-host.ts` 零 validate import |

Issue 评论经 REST 读取为空（dispatch 明示 none）；无 Owner 评论要求。

---

## 2. Verdict

**approve**。

**F1（iteration 0 唯一 MAJOR）已闭合，四点修订逐一核验成立**：

1. **校验半边**（§7.4 前段 + §7.6 D7）：`startHubSessionHostService` 顶部执行完整组合根形态——`resolveLimits`/`resolveTimeouts`（defaults.ts:61-70）→ 无条件 `validateLimits`/`validateTimeouts`（validate.ts:140-206/:266-282）→ 分块族三链显式激活窄门。与三处既有组合根**逐行同构**（本轮已并排比对 `hub-connection.ts:76-100`、`hub-edge-host.ts:761-777`、`peer-connection.ts:105-131`）：门输入、`Object.prototype.hasOwnProperty` 判定、传参（resolved 结果）、三链键集全部一致。校验器一律 import `validate.ts` 五函数（plugin.ts 现无同名符号、无 import 冲突；`hub-session-host.ts` 不 import plugin.ts，零环）——无第二套校验。
2. **时机**（§7.6「抛错时机 = apply 期」）：免 listen 分支在 `start()` 内同步抛 → async `start()` → `apply()` promise rejection；listen 模式同配置经 `:392` `createHubReplication` 构造器同步抛 → 同为 apply promise rejection（`:392` 在 `:405` try 块外，无捕获）。**同生命周期点、同错误家族**（validate.ts `TypeError`）。拒绝点先于 `ctx.provide`/`ctx.effect`，且该点 OwnedTimer 句柄集为空（`timerFromContext` 只读 require + 空集合闭包）——零服务/零会话/零定时器，**零清理义务与 listen 模式逐点对齐**。构造期备选的否决论证（时机不对称 = F1 谴责分叉的时序翻版）成立。
3. **D2 矩阵**（§7.2）：limits/timeouts 行拆为「键表（共有，构造期）+ 值域（共有，装配期经 validate.ts）」——iteration 0 的「一响一静」分叉消除；D2-(b) 自家主张与实现自此一致。
4. **测试授权**（§11/§12 C5d–C5g）：冻结断言逐字保留 + 追加值域负控 + conflict 流程护栏。四组断言的**算术与红/绿三态全部经源码核验为真**（见 §12 验收设计审查）——含双向变异敏感（漏接链→C5g①红；宽门误拒→C5g②红）。

iteration 1 无新增 BLOCKER/MAJOR；`approve` 仅表示设计通过审查，实现与活链路验证仍归 SA4/SA7。

`requiresConflictRecheck: true` 的理由：在场的设计后冲突门禁（clear）**被审对象是 iteration 0**（其报告 :3-4 自记「无 SA2 review——iteration 0 不存在」），且其基线核实引 `hub-edge-host.ts:761-762`/`hub-connection.ts:76-77` 时同样只取了 resolve 半边。iteration 1 新增的三项面（免 listen 装配期值域失败类、`validate.ts` 五函数 import 面、追加负控块授权）尚未经任何冲突门禁分析。该三项已由设计自身登记进复查范围（§6 U1 行、§13-F1、R7、复查焦点清单）——本标记与设计登记一致，非新增矛盾；下一次冲突检查执行（合入前 SA8 clear / R1 实现后复查）必须覆盖该增量。

---

## 3. 需求覆盖

| Requirement | Design section | Assessment |
| --- | --- | --- |
| AC1（:21）`listen:false` 装配成功 + 服务签名 test-d 锁定 | §7 D1/D5/D8；§12（C1a–C1f/T1–T4） | 覆盖（iteration 0 已核；本轮复核契约套件与设计 §7.7 冻结形态逐字一致，test-d 件断言齐备） |
| AC2（:22）零 listener、零网络面 | §7 D2/D4；§12（C2a–C2d） | 覆盖（D7 新增 import 面 `validate.ts`/`defaults.ts`/`hub-session-host.ts` 均无网络 API——NC-6 结构门模式逐字核对零命中） |
| AC3（:23）不提供 `nomicoreHubReplication` | §7 D5；§12（C3a–C3c） | 覆盖（免 listen 分支零 provide；`requireHubReplication` `/unavailable/` 镜像 `:345-349`） |
| AC4（:24）listen 模式逐字节不变 | §7 D1/D2 + §11 DENY；§12（C4a–C4f） | 覆盖。iteration 1 对 listen 路径的唯一新增面是 plugin.ts 顶部 import（零行为）；dispatch 插入点（:290-291 后、:292 前）与 `listenMode` 条件绑定等价性维持 iteration 0 核验结论 |
| AC5（:25）非法配置响亮 TypeError、无静默降级 | §7 D1 + §7.6 D7；§12（C5a–C5g） | **覆盖（本轮重点）**。两层读法成立：键表/形状层构造期（16 形态 ×2 组，listen 链零重排）；值域层装配期（D7）。「构造期 TypeError」的字面读法与 AC4（listen 模式逐字节不变，同配置 HEAD 即 apply 期抛）**联合不可满足**，设计的两层读法是唯一自洽解释，且已在 §7.6 明文论证——「无静默降级」对两层均成立 |
| AC6（:26）stop 后会话收口、timer 清零 | §7 D5/D6；§12（C6a–C6d） | 覆盖（收口判据 = close resolve + timer 清零；`hub-namespace.ts:1204-1212` 不经 `notifySettled` 已复核） |
| 简报 :17 注入面 / 认证授权豁免 | §7 D2/D3/D5/D7 | 覆盖（registry/timer/clock 直通；observer 经 `overrides.observer`；免 listen 零 verifier/authorizer 构造） |
| Blocked by #420 | — | 已解除（`createHubSessionHost` 在场，`src/index.ts:6`） |

## 4. Owner 评论覆盖

| Comment ID | Updated at | Design section | Assessment |
| --- | --- | --- | --- |
| （无评论） | — | §4 | Issue 评论经 REST 读取为空（dispatch 明示 none）。无遗漏义务 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
| --- | --- | --- |
| S2 构造期 TypeError 单点 `plugin.ts:292` | D1 前置 `=== false` 分派 | 成立（拼写键先被 :290 键表拒绝；分派位置正确） |
| S3/S4/S5 类型/服务面/装配缺口 | D8/D3 | 成立（源码现状与 B2–B5 一致，本轮复核） |
| S7 工厂面在场 | D5 包装复用 | 成立（`:243-257` 唯一性、`:168-171` close 直通 `closeTail`） |
| S8 `settled` 不可作 stop 判据 | D6 | 成立（`:1204-1212` 无 `notifySettled`，复核） |
| **B9（iteration 1 重写）组合根完整形态** | D7 | **成立**：三处先例（`hub-connection.ts:76-100`、`hub-edge-host.ts:761-777`、`peer-connection.ts:105-131`）本轮逐行并排比对——resolve → validateLimits/validateTimeouts → 三链窄门，D7 镜像一致；`hub-session-host.ts:47`「组合根 resolve+validate 后注入（既有纪律）」注释原文核实在场，`hub-session.ts`/`hub-session-host.ts` 零 validate import（grep 复核）。iteration 0 的「半真」指摘消除 |
| M1 falsy 陷阱 | D1 仅严格相等 | 成立（M1 变异敏感面保持） |
| M2/M3 校验删除敏感性 | D2 listen 链零重排 | 成立 |
| E1/E3 工厂可达性与 1234 plumb | D5/D7 | 成立（1234 经 `resolveTimeouts`+`validateTimeouts` 正整数门放行——`positiveSafeInteger(1234)` 通过，plumb 路径不受校验半边影响） |
| ADR 0032:30/:64-66/:18/:48/:53 | §6 表逐条 | 引文核对无误；两处裁量点（U2/U3）维持 iteration 0 评估（OBS-4） |
| ADR 0032:66 冻结面 + #418 冻结清单授权编辑 | §7.7/§11 | 成立（字典序复核：`NOMICORE_HUB_R` < `NOMICORE_HUB_S` < `NOMICORE_PEER`；`requireHubRe…` < `requireHubSe…` < `requirePeer…`；`:553` 断言形态 `Object.keys(productionApi).sort()).toEqual(FROZEN_PRODUCTION_EXPORTS)` 原文核对一致；15 名排序全序验证通过） |
| 契约 U1（无 SA8 门禁产物） | §6/§13-F1 | 已登记；**设计后门禁（clear）被审对象为 iteration 0，其 R1 清单须按设计 §13-F1 追加 iteration 1 三项**——本评审 `requiresConflictRecheck: true` 与之对齐 |
| 契约 U7/U8（文档面、inject 面） | §11、D3 | 成立（README :9 锚点核实在场——`createHubReplicationPlugin` 条目；CONTEXT.md SessionHost 词条在场；inject 四服务不变） |
| 契约 U2/U3（提供时处置留 design） | D2/D4/D9-(f) | 授权范围内 design 决策，维持（冲突报告裁量点 1 已裁 no-conflict 留档） |

---

## 6. 设计内部一致性

| # | 检查点 | 结论 |
| --- | --- | --- |
| I1 | §7.7 公共面 vs 契约 §12.1 冻结声明 | 逐字一致（常量、两接口、`requireHubSessionHost`、模块增强插入位置、index.ts 两条语句、test-d 断言面） |
| I2 | §7.4 参考实现 vs §8 数据流/§9 错误表 vs §12 映射 | 一致；`status`/`stop`/`open` 语义、幂等（`stopPromise ??=`）、闩锁（`stopped` 先行）相互印证 |
| I3 | D2「被消费的面校验保持一致」 vs D5/D7 实现 | **一致（iteration 0 的 I3 不一致已消除）**：limits/timeouts 键表（构造期）+ 值域（装配期）两模式共有；observer 形状两模式共有 |
| I4 | §7.4 摘账原则 vs `finally { sessions.clear(); }` | 已调和（OBS-1 修订句在场：「诚实计数适用于 stop 之前的个别失败；stop 一经进入即闩锁清零并以 rejection 承载失败信号」）——措辞级，行为被冻结类型注释钉死，无安全面 |
| I5 | 死引用/旧 API 扫描 | 未发现。iteration 1 新增锚点全部核验：`hub-connection.ts:76-100`/`:85-100`、`hub-edge-host.ts:761-777`、`peer-connection.ts:105-131`、`validate.ts:140-206/:223-234/:245-251/:258-264/:266-282/:208-243`、`defaults.ts:61-70`、`plugin.ts:399`、`hub-session-host.ts:47/:207-208`、模板 `ac7-faults:192-216`、`issue244-ac-red:704-715`（R1c 算术先例原文核对：4MiB > 4×512KiB=2MiB） |
| I6 | D3 TS 窄化（`endpoint: config.listen`） | 维持 iteration 0 评估：TS ≥4.4 别名条件窄化成立；即便不窄化也是编译期可见错误 |
| I7 | 回滚清单（7 文件）与 ALLOW LIST | 一致 |
| I8 | **iteration 1 修订的全文一致性**（§1 目标 5 / §2 B9 / §3 第五行 / §4 AC5 行 / §5 E3 行 / §6 U1 行 / §7.2/§7.3/§7.4/§7.6/§7.7/§7.9(h) / §8.2 L1-L2 / §9 / §10 / §11 / §12 / §13 R7+复查焦点 / §14 / §15） | 逐节核对：两层纪律口径全文一致；无 iteration 0 残留表述（「仅 resolve」「同款」半边引用均已改写）；§14 修订映射与正文实际内容相符 |
| I9 | §7.6「两模式激活判据字节等价」主张 | 核验成立：门输入 = 同一 `mergeNested` 闭包对象（`plugin.ts:362` 创建、`:399` 传给 `createHubReplication`、D7 在免 listen 分支读同一闭包变量）；spread 产物均为自有可枚举属性，`hasOwnProperty` 判定等价；`mergeNested` 在构造期完成，两模式对构造后宿主改写原 config 同样免疫 |

---

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
| --- | --- | --- | --- | --- | --- |
| SM-1..SM-8 | （同 iteration 0：stop 闩锁/重复 stop/并发 dispose/混序收口/fatal 摘账/重开拒绝/16 形态构造/peer 角色） | — | — | 无（iteration 0 已核；本轮复核关键锚点未变） | — |
| SM-9（iteration 0 F1 载体） | 装配期 | limits/timeouts **键合法、值畸形**（`bootstrapTimeoutMs:0`、`maxFrameBytes:-1`、`lowWater ≥ highWater`、分块族链违例） | 两模式同生命周期点（apply promise rejection）、同错误家族（validate.ts `TypeError`）拒绝 | **无（已闭合）**：listen 经 `createHubReplication`（`:76-100`）、免 listen 经 D7（同款五函数 + 同款窄门、同一门输入对象） | — |
| SM-10（新增攻击） | 构造后、apply 前 | 宿主改写原 `config.limits` 对象（追加链上键） | 两模式均以构造期 `mergeNested` 快照为准，不受改写影响 | 无：`:362` 在构造期合并为快照对象；D7 门与 `:399` 消费同一快照——两模式行为天然等价 | — |
| SM-11（新增攻击） | apply 中 | 值域 `TypeError` 抛出时 Cordis 侧已发生什么 | 拒绝点先于 `ctx.provide`/`ctx.effect`；`timerFromContext` 的句柄集为空——零注册、零撤销义务 | 无（与 listen 模式 `:392` 抛出点完全同构） | — |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
| --- | --- | --- | --- | --- |
| ER-1..ER-4, ER-6, ER-7 | （同 iteration 0） | 构造期/装配期依赖/服务不可用/stop 失败/observer 隔离/描述子畸形 | 无（iteration 0 已核；ER-4 的 OBS-1 措辞已调和） | — |
| ER-5（iteration 0 F1 载体） | 免 listen 模式 limits/timeouts 值畸形 | **D7**：`startHubSessionHostService` 顶部五校验器抛 `TypeError`（validate.ts 消息家族，不回显凭据），经 `apply()` rejection 响亮传播；时机/家族与 listen 模式对齐；零服务/零会话/零定时器 | **已消除**（构造/装配/发布三段中「静默段」不复存在；C5d–C5g 消灭伪绿盲区） | — |
| ER-8（新增攻击） | 值域校验**宽门**实现（`limits != null` 即激活三链） | C5g② 钉死：`{maxQueuedUpdateBytes:1MiB}`（仅显式既有键）须 apply resolve、服务 `{state:'ready',sessions:0}`——宽门会因链① 4MiB(缺省) ≤ 1MiB(显式) 误拒 → 测试红 | 已被验收设计覆盖（双向变异敏感） | — |
| ER-9（新增攻击） | 值域校验**漏门**实现（三链全不接） | C5g① 钉死：`{maxChunksPerUpdate:4}` 须 apply rejection（链② 4MiB > 2MiB）——漏门实现 apply resolve → 测试红 | 已被验收设计覆盖 | — |

---

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
| --- | --- | --- | --- |
| `HubReplicationPluginConfig.listen` 联合扩展 | 无（`issue421 test-d:93-95` 参数元组断言引用类型名，联合扩展不改元组形态——iteration 0 已核，本轮维持） | 源码 | — |
| 新增服务常量/require/2 类型 | 无：模块增强 5 处成员不相交（grep 复核）；`HubSessionHostService extends HubSessionHost` 所需 type import 在 §7.7 import 块在场 | grep + 源码 | — |
| `FROZEN_PRODUCTION_EXPORTS` 授权编辑 | 无：15 名字典序全序验证通过；`:553` 断言形态逐字不变；`FROZEN_TESTING_EXPORTS` 不扰 | 测试 :144-165/:553 已读 | — |
| **免 listen 宿主提供畸形 limits/timeouts 值** | 设计 §10 新增行：宿主在装配点得到与 listen 模式一致的 `apply()` rejection；「新失败面 = listen 模式既有失败面的分支化」——与源码事实相符（同 validator、同时机） | `validate.ts:140-282`；`hub-connection.ts:76-100` | — |
| `requireHubReplication` 消费方（免 listen ctx） | `/unavailable/`（AC3 语义） | `plugin.ts:345-349` | — |
| listen 模式宿主 `apps/yjs-server/src/app.ts:419` | 零影响（listen 分支零扰动；iteration 1 仅增 import） | 源码 | — |
| plugin.ts 新 import 面（`defaults.js`/`validate.js`/`hub-session-host.js`） | 无冲突：现无同名符号；`hub-session-host.ts` 不反向 import plugin.ts（零环）；NC-6 模式对三文件零命中 | grep + 源码 | — |

---

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
| --- | --- | --- | --- |
| 配置校验/装配/服务发布/teardown | role-specific 插件 | `plugin.ts` 私有分支/函数 | 正确 |
| 会话 FSM/Registry lease | `hub-namespace.ts` + #420 工厂（零 diff） | 仅经工厂消费 | 正确 |
| **limits/timeouts resolve + validate** | 组合根（免 listen 形态下 = 插件） | D5/D7 **完整形态**（resolve + validate + 三链窄门） | **正确（iteration 0 缺口已补）** |
| 上游服务 teardown | 宿主组合根 | 不触碰 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| Cordis 服务发布 + drain 保序 / stop 幂等 + 闩锁 / ADR 0023 冻结面 | `plugin.ts:442-448`、`:421-430`、`:431-441`、`:509-550` | D5/D6 同构 | 一致 | — |
| **组合根 limits/timeouts 处理** | 三处：resolve + `validateLimits`/`validateTimeouts` + 分块族显式激活链（`hub-connection.ts:76-100`、`hub-edge-host.ts:761-777`、`peer-connection.ts:105-131`） | D7 **第四处，逐行同构**（同 resolver、同校验器、同窄门键集、同门输入语义） | **一致（iteration 0 分叉已消除）** | 单一事实源 `validate.ts`（纯 import；grep 证实将成为第 4 个 import 方，无第二套） |
| 免 listen 表达 | 无先例（本票首创）；最近似 = peer 无 listener 启动形态 | D1 显式 `false` | 一致 | ADR 0032:30 唯一授权表达 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| 会话唯一性 | #420 工厂台账 | 服务台账（同构键） | 低（设计显式登记重开在工厂侧拒绝） |
| 服务生命周期 | `stopped` 闩锁 + `stopPromise` | `status` | 无 |
| **limits/timeouts 值域合法性** | `validate.ts` 五校验器 | 两模式各自的 apply 期拒绝 | **无（同一校验器实例族，无第二语义源）** |
| 复制服务缺席 | 零 provide | `ctx.get` undefined / require 抛错 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| apply → 校验 → 工厂 + 台账 + provide | stop（全会话 close → timer.dispose → clear）→ revoke | 值域拒绝：早于 provide，零清理；stop 失败：响亮 + timer finally 清零 | 对称（两模式同构） |
| OwnedTimer | `dispose()`（stop finally + effect 复用闭包） | 早退路径零注册句柄 | 对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
| --- | --- | --- | --- |
| 第二插件工厂 | 既有插件入口 | 未新增 | 正确否决（D9-a） |
| 第二套校验/解析 | `defaults.ts` + `validate.ts` | **纯 import 复用**（五函数 + 两 resolver） | 无平行（iteration 0 的「校验器未复用」已消除） |
| 第二状态机 | `hub-namespace.ts` FSM | 零新增 | 无平行 |

---

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
| --- | --- | --- |
| ALLOW 7 文件与契约 §10/§12.8/U7 一致 | plugin.ts 行已更新为含 D7 全部实现面与新 import；无静默扩张 | 无 |
| ALLOW 对新测试文件的描述（「冻结断言逐字保留 + 追加值域负控 + conflict 护栏」） | 与 SA2 §13-F1(4) 授权逐字对齐；追加块为新增 `it`、复用文件级夹具（`effectTimer`/`dependencies`/`VALID_LISTEN` 已核实在场于契约套件文件） | 无 |
| DENY `defaults.ts`/`validate.ts` 本体 | DENY 指修改；纯 import 已明示豁免（`src/` 三处既有 import 先例） | 无 |
| DENY 其余既有测试/协议/ADR/apps | 与 AC4/契约 §12.8-2 一致 | 无 |

---

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
| --- | --- | --- | --- |
| AC1–AC4、AC6（C1–C4、C6 组） | 契约套件（iteration 0 已逐断言核对；本轮复核夹具与断言可满足性） | 无 | — |
| AC5 listen 形态面（C5a–C5c） | NC-3/NC-3b ×16 + M1–M3 | 无 | — |
| **F1 值域——timeouts 正整数违例（C5d）** | `{listen:false, timeouts:{bootstrapTimeoutMs:0}}`：构造不抛（`bootstrapTimeoutMs` ∈ TIMEOUT_KEYS，键表层无值域——源码核实）→ apply rejection `TypeError` + 零副作用断言 | 无。红/红/绿三态核实：HEAD 构造即抛（能力缺口红）→ 缺校验实现 apply resolve（红）→ 实现后绿 | — |
| **F1 值域——limits 跨字段（C5e）** | `{listen:false, limits:{lowWater:2,highWater:1}}`：构造不抛（两键 ∈ LIMIT_KEYS）→ apply rejection（`validate.ts:188-192` `lowWater 必须 < highWater`——消息语义核实）| 无 | — |
| **F1 parity（C5f）** | 同畸形值 listen 模式：`{listen:VALID_LISTEN, tokens:[], authorization:[], …同值}` + 合法 adapter——构造过（`tokens:[]` 满足 `:301-302` 要求链，源码核实）→ apply rejection（`:392` 在 try 外直传）| 无。listen 半侧 HEAD 恒绿（锁定既有行为）；免 listen 半侧红→绿——「同一畸形值两模式均被拒」在同生命周期点意义上可承重 | — |
| **F1 分块族激活门（C5g）** | ① `{maxChunksPerUpdate:4}` → 门激活（`hasOwnProperty` 命中）→ 链② `4MiB ≤ 4×512KiB=2MiB` 违例（DEFAULT 值核实：`maxChunkedUpdateBytes=4MiB`、`maxUpdateBytes=512KiB`）→ rejection；与 `issue244-ac-red R1c` 先例算术一致。② `{maxQueuedUpdateBytes:1MiB}` → 非链门键不激活；无条件链全自洽（1MiB ≥ 512KiB 缺省 `maxUpdateBytes`；其余缺省组合核实通过）→ resolve + ready | 无。双向变异敏感核实：漏门实现①红、宽门实现②红（宽门下链① 4MiB ≤ 1MiB 违例误拒） | — |
| 测试落点真实性 / 观察行为而非源码文本 | `vitest.config.ts` include + test-d typecheck include + 包 tsconfig（iteration 0 已核，未变）；全部断言为运行时/类型行为 | 无 | — |
| 实现后命令组（§12） | 与契约 §12.0 一致 | 无 | — |

---

## 13. Required revisions

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
| --- | --- | --- | --- | --- | --- |
| ~~F1~~（**resolved——iteration 1**） | ~~MAJOR~~ | 设计 §7.4/§7.6/§7.2/§11/§12/§14；源码 `hub-connection.ts:76-100`、`hub-edge-host.ts:761-777`、`peer-connection.ts:105-131`、`validate.ts:140-282`、`defaults.ts:61-70`、`hub-session-host.ts:47` | ~~免 listen 分支 limits/timeouts 值域校验缺失~~ | 四点修订（校验半边/时机论证/D2 矩阵/测试授权）**已全部落实并经本轮源码逐行核验**（§2/§6-I3/§7-SM-9/§8-ER-5/§10/§12） | 已达成：设计文本含四点；C5d–C5g 红绿三态与算术核实为真；冻结契约套件断言集逐字保留；listen 模式零扰动 |

**当前无 BLOCKER 或 MAJOR finding。**

---

## 14. Non-blocking observations

| ID | Observation | Suggestion |
| --- | --- | --- |
| OBS-6 | §7.4 `startHubSessionHostService` 参考实现引用 `limits`/`timeouts`/`overrides`——这些标识符仅在 `createHubReplicationPlugin` 工厂闭包内可见（同 HEAD 的 `start` 嵌套形态），而「plugin.ts 内私有」的措辞可被误读为模块顶层函数 | 实现票把函数嵌套在工厂内（与 `start` 同层）或显式传参（`limits`/`timeouts`/`observer`）；§7.6 已三处钉死门输入 = 同一 `mergeNested` 对象，且错误嵌套属编译期可见错误（fail-closed），无安全面 |
| OBS-7 | §7.6/§9 把值域错误消息族描述为「前缀 `limits:`/`timeouts:`」——单字段违例（如 C5d 的 `bootstrapTimeoutMs:0`）实际前缀是字段名（`bootstrapTimeoutMs: bootstrapTimeoutMs 必须为正有限安全整数`，validate.ts:24-26）；跨字段违例才是 `limits:`/`timeouts:` 前缀 | 措辞精度修正即可；C5d/C5e 断言未绑定前缀（`rejects.toThrow(TypeError)` + 语义子串），零实质影响 |
| OBS-8 | 两模式对 `identity.instanceId` 的校验不对称：listen 模式经 `createHubReplication` → `validateHubOptions` 校验 instanceId 文法；免 listen 分支无对应校验（工厂零校验） | 实际不可达分叉：Instance 服务自身构造期即校验同一文法（`packages/instance` `validateInstanceConfig`：`^[a-z][a-z0-9-]{0,62}$`，与 validate.ts 同源正则）。可选：免 listen 分支加一行 `validateInstanceId(identity.instanceId, 'instanceId')` 换取逐字 parity，或在实现说明中登记该推理；非义务 |
| OBS-9（承 OBS-2，设计已登记为 F6） | #420 工厂台账永不摘除的内存增长面 | 设计 §13-F6 已登记（DENY 禁触工厂），维持——供宿主与后续票知情 |
| OBS-10（承 OBS-3） | 新服务面无 ADR 0023 Proxy-consumption 断言 | 设计已登记为可选项（构造纪律 getter + freeze 已遵循）；维持非必要 |
| OBS-11（承 OBS-4） | D9-(e)/D2「校验 ≠ 消费」偏严解读 | 维持；冲突报告裁量点 1 已裁 no-conflict 留档，SA8 复查顺带确认 |
| OBS-12（承 OBS-5） | 设计正文预告 `requiresConflictRecheck` 的措辞越位 | iteration 1 §13-F1 已改写为引用评审/门禁各自提交——已落实，撤销该观察 |

---

## 15. 评审结论路由建议（供 Controller）

1. **设计通过**（approve）：SA1 修订闭合 F1 全部四点；iteration 1 可进入实现票。
2. **冲突检查增量**：在场设计后门禁（clear）的被审对象是 iteration 0；下一次冲突检查执行（合入前 SA8 clear——契约 U1 义务——与/或 R1 实现后复查）必须覆盖 iteration 1 三项增量：免 listen 装配期值域 `TypeError` 失败类、`validate.ts` 五函数 import 面、追加负控块不触碰冻结断言。本评审 `requiresConflictRecheck: true` 即为此提交。
3. 实现票按 §12 命令组执行并登记日志；C4 组（listen 回归）与冻结契约套件逐字断言保持绿是实现完成的硬判据。
4. `pass` 不替代 SA4/SA7 对实现与活链路的验证。
