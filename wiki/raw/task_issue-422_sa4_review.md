# SA4 实现静态审查 — issue #422：hub 插件免 listen 模式（`listen: false`）与 `nomicoreHubSessionHost` 服务

- 审查对象：SA3 实现（工作树 diff：`packages/ws-replication/src/{plugin,index}.ts`、`packages/ws-replication/test/ws-replication-issue422-{listen-false.test.ts,session-host-api.test-d.ts}`、`test/ws-replication-issue418-edge-session-split-contract.test.ts`、`packages/ws-replication/README.md`、`CONTEXT.md`）+ 证据日志 `artifacts/sa3-issue422-*`。
- 基线：HEAD `4ad13a3`（与设计/契约一致）；`git diff --name-only` 恰 5 文件 + 2 新测试 + 2 文档（见 §文件范围审查）。
- 审查人：SA4（未修改任何实现/设计/测试/证据；本文件为唯一可写产物，原位首版）。
- Verdict：**approve**（无 BLOCKER / 无 MAJOR；6 条非阻断观察，见 §Non-blocking observations）。

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-422.md`（简报，6 AC；Issue 评论 REST 读取为空——无 Owner 要求） | 在场，已读 |
| `wiki/raw/task_issue-422_design.md`（SA1 设计 **iteration 1**，SA2 approve） | 在场，全文已读（D1–D9、§11 ALLOW/DENY、§12 验收映射） |
| `wiki/raw/task_issue-422_sa2_review.md`（approve；F1 已闭合 + OBS-1–OBS-12） | 在场，已读 |
| `wiki/raw/task_issue-422_sa6_contract.md`（approve 红灯契约；§12.1 冻结声明 + §12.8 授权编辑） | 在场，全文已读 |
| `wiki/raw/task_issue-422_design_conflict_report.md`（clear；R1–R4 规范性约束） | 在场，已读 |
| `wiki/raw/task_issue-422_sa3_impl.md`（SA3 实现报告） | 在场，已读 |
| 源码核验 | `plugin.ts` 全文（新 731 行 vs HEAD diff）；`index.ts`；`hub-session-host.ts` 全文（零 diff 核实）；`hub-connection.ts:74-114`（组合根先例并排比对）；`defaults.ts:60-70`；`validate.ts:140-282`；`peer-connection.ts`/`hub-edge-host.ts`（git 零 diff） |
| 测试核验 | 落盘两份 422 测试 vs `artifacts/sa6-issue422-contract-suite/*` 逐字节 diff（冻结段仅头部 doc 注释差异 + 末尾追加块）；418 冻结清单编辑；`vitest.config.ts` include/typecheck include；`tsconfig.typecheck.json` 口径 |
| 证据日志 | `artifacts/sa3-issue422-{red,focused-green,mutation-sensitivity,package-suite,root-gates}.log`（计数交叉核算，见 §测试质量审查） |
| git 状态 | `git status --porcelain` / `git diff --name-only` / `git stash list`（空） |

## 2. Verdict

**approve**。实现逐项落实批准设计 iteration 1 的 D1–D8 与 SA6 契约 §12.1 冻结形态；listen 模式主体仅引用改名（同值同序同消息，逐表达式核对）；文件范围严守 ALLOW/DENY；两份新测试的冻结断言逐字保留 + F1 授权追加块落地且经变异证据证明敏感；红/绿/包全量/根门禁日志计数自洽。无 BLOCKER/MAJOR finding；非阻断观察见 §14。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| AC1（:21）`listen:false` 装配成功 + 服务签名 test-d 锁定 | `plugin.ts:351-354`（分派）、`:540-620`（装配+服务）；`test/ws-replication-issue422-session-host-api.test-d.ts`（T1–T4 + 7 负控）；focused-green 44/44（含 Type Errors no errors） | 落实 |
| AC2（:22）零 listener、零网络面 | 免 listen 分支零 adapter 调用（`start` 早退于 `listenMode.listen.listen`）；`plugin.listener/replication` 恒 undefined（工厂级变量仅在 listen 分支赋值）；NC-6 结构门在冻结套件内保持绿 | 落实 |
| AC3（:23）不提供 `nomicoreHubReplication` | 免 listen 分支零 `provide(NOMICORE_HUB_REPLICATION_SERVICE)`；`requireHubReplication` 在免 listen ctx 抛 `/unavailable/`（测试 :232-233）；反向（listen ctx 无 SessionHost 服务）双向断言（:301-302） | 落实 |
| AC4（:24）listen 模式逐字节不变 | `:292-316`（HEAD listen 断言链）零删除/零重排/零消息变化（diff 核实：分派插入在两条通用 record 断言之后、listen 链之前）；`start` listen 主体仅 `listenMode.*` 引用改名（值/求值时机/次序逐项等价——见 §4 D3 行）；既有 `ws-replication-plugin.test.ts` 零 diff + 包全量 829 绿 + 根 5559 绿 | 落实 |
| AC5（:25）非法配置响亮 TypeError、无静默降级 | 键表/形状层构造期（`validateHubSessionOnlyConfig` 子集 + 16 形态落入未动 listen 链）；值域层装配期（D7）；NC-3/NC-3b ×16 + 要求链测试在冻结套件内全绿 | 落实（两层读法与 SA2/冲突报告裁量点 3 一致） |
| AC6（:26）stop 后会话收口、timer 清零 | `stop`：`serviceStopped=true` 先行 → `Promise.all(close)` → `finally { timer.dispose(); sessions.clear(); }`；effect 反向 yield `[stop, revoke]`；收口判据 = close resolve + timer 清零，不以 `settled` 为判据（测试 :264-290） | 落实 |
| ADR 0032:30/:64-66 | 精确 `false` 分派；SessionHost 服务仅免 listen 分支 provide；双轨（工厂零 diff + 服务包装）；免 listen 零 verifier/authorizer 构造（`listenMode` 条件绑定）；公共面 append-only 13→15 | 落实 |
| SA2 F1（值域校验半边） | `startHubSessionHostService` 顶部 `resolveLimits/resolveTimeouts` → `validateLimits/validateTimeouts`（无条件）→ 分块族三链显式激活窄门；纯 import 五校验器（`validate.ts` 零 diff）；C5d–C5g 追加块 + 变异证据（3 failed 恰 C5d/C5e/C5g①） | 落实 |
| SA2 OBS-1/2/3/4/5/6/7/8 处置 | OBS-6（嵌套工厂内，闭包直读 `limits/timeouts/overrides`——`plugin.ts:540-546`）；OBS-8（未加 `validateInstanceId`，附不可达推理——`packages/instance` 构造期同源正则）；OBS-7（断言绑语义子串 `/bootstrapTimeoutMs/`、`/lowWater/`）；OBS-1（闩锁 + finally + rejection 承载）；OBS-3（未追加 Proxy 断言——设计明示可选） | 与设计口径一致 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| D1 分派：精确 `=== false` 严格相等，位置在两条通用 record 断言之后 | `plugin.ts:346-354` | 一致。16 伪值形态（`'false'`/`0`/`''`/`null`/`undefined`/`NaN`/`1`/`true`/`[]`/`{}`/缺 host/port/空 host/端口越界/path 非绝对/嵌套拼写）全部不满足 `=== false` 而落入未动 listen 链（`assertRecord(config.listen, …)` 拒绝非对象；`new Boolean(false)` 亦被 host 值域检查拒） | 无 |
| D2 校验矩阵：免 listen 子集镜像 listen 顺序，仅去要求项 | `plugin.ts:325-344` | 一致。顺序 = tokens/auth 形状 → limits/timeouts 四处 record 键表 → verifyToken/authorize 形状 → listen 形状（提供时）→ observer；`overrides.x ?? config.x` 合并选择与整集合替换语义镜像 `:362-363`；值域不在构造期（与 listen 模式两层同构） | 无 |
| D3 装配分派：`listenMode` 条件绑定、免 listen 零 verifier/authorizer 闭包 | `plugin.ts:434-442`、`:468-471` | 一致。**listen 模式行为等价性逐项核对**：`listenMode.{verifyToken,authorize,listen,endpoint}` 在构造期以与 HEAD 相同的次序求值（staticVerifier→staticAuthorizer→listen 绑定）；`endpoint` 即 `config.listen` 同一对象引用，`.host/.port/.path` 仍在 apply 期读取；`authenticate` 闭包改读 `listenMode.verifyToken`（闭包内对象，无外部可变性）——同值同时机同消息 | 无 |
| D4 `overrides.listen` 提供时形状校验、零消费 | `plugin.ts:339-342`（校验）；`:468-471`（免 listen 分支先于 listen 主体 return——adapter 永不被调用） | 一致（C2a spy 零调用断言绿） | 无 |
| D5 服务构造：resolve+validate → 工厂 → 台账 + 包装句柄 + freeze/getter | `plugin.ts:540-612` | 一致。键 `${connectionKey}\u0000${namespaceId}` 与工厂同构；5 成员全委托；`close`/`terminateUnauthorized` 记账级 memoize（`??=`，同一 promise）；`release` 仅 fulfill 摘账（`.then(release)` 无 onRejected——reject 保留计数，诚实）；`Object.freeze` + getter（ADR 0023）；`status` getter 实时读 `serviceStopped`/`sessions.size` | 无 |
| D6 teardown：stop → 全会话并发收口 → timer 兜底 → 反向 yield | `plugin.ts:595-603`、`:614-619` | 一致。`serviceStopped` 闩锁先行（JS 单线程无竞态窗口）；`drainPromise ??=` 幂等；`finally` 保证 timer 清零；effect 反向 yield 序 `[stop, revoke]` 与 listen 模式 `:522-528` 同构 | 无 |
| D7 值域校验：完整组合根形态，纯 import 五校验器 | `plugin.ts:547-562` | **逐行并排比对 `hub-connection.ts:74-100` 成立**：resolveLimits→resolveTimeouts→validateLimits→validateTimeouts（同序）→ 三链窄门（同键集 `maxChunkedUpdateBytes ∨ maxChunksPerUpdate` / `maxChunkedBootstrapBytes` / `maxChunkedSyncDiffBytes`、同 `Object.prototype.hasOwnProperty.call` 判据、同 `!= null` 门、同「门看合并结果、校验 resolved 结果」语义）。门输入 = 工厂闭包 `limits`（`mergeNested` 于 `:432` 构造）——与 listen 分支 `:479` 传给 `createHubReplication` 的是**同一对象**（两模式激活判据等价）。抛错先于 `ctx.provide`/`ctx.effect`（零清理）。唯一差异 = 不调 `validateHubOptions`（OBS-8 已登记，instanceId 由 Instance 服务构造期同源正则把关，分叉不可达） | 无 |
| D8 公共面：契约 §12.1 冻结形态逐字落地 | `plugin.ts:37-40,98-118,169-175,414-419`；`index.ts:19-21,44` | 一致。常量字面量、两接口（含 doc 注释逐字）、`requireHubSessionHost` 镜像 `requireHubReplication`（错误消息 `'required Cordis service "nomicoreHubSessionHost" is unavailable'`）、模块增强一行插于 hub/peer 之间、index 两条 export 语句紧邻既有 plugin.js 块 | 无 |
| D9 否决项未被采纳 | 无第二插件工厂、无 falsy 判定、无裸工厂暴露、无 `settled` 判据、无 verifier 惰性构造、无兼容壳、无第二套校验器 | 一致 | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| 配置校验/装配/服务发布/teardown | role-specific 插件（包 AGENTS） | `plugin.ts` 私有分支/嵌套函数 | 正确 |
| 会话 FSM/Registry lease | `hub-namespace.ts` + #420 工厂（零 diff 核实） | 仅经工厂消费 | 正确 |
| limits/timeouts resolve+validate | 组合根（免 listen 形态下 = 插件） | `startHubSessionHostService` 顶部（第 4 处组合根，与三先例逐行同构） | 正确 |
| 上游服务 teardown | 宿主组合根 | 不触碰 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| 组合根 limits/timeouts 处理 | `hub-connection.ts:74-100`、`hub-edge-host.ts:761-777`、`peer-connection.ts:105-131` | `plugin.ts:547-562` 第 4 处 | 一致 | 单一事实源 `validate.ts`/`defaults.ts` 纯 import（`plugin.ts` 现 4 处 `./validate.js` import 之一，无第二套） |
| 服务发布 + drain 保序 / stop 幂等 + 闩锁 / ADR 0023 冻结面 | `plugin.ts:501-528`（hub listen）、`:667-727`（peer） | `:595-619` 同构 | 一致 | 反向 yield `[stop, revoke]`、`??=` 幂等、freeze+getter |
| 免 listen 表达 | 无先例（ADR 0032:30 唯一授权） | 精确 `false` | 一致 | — |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| 会话唯一性 | #420 工厂台账 | 服务台账（同构键） | 低（工厂侧重开拒绝，服务 `open` 直通；F6 已登记） |
| 服务生命周期 | `serviceStopped` 闩锁 + `drainPromise` | `status` | 无 |
| 值域合法性 | `validate.ts` 五校验器 | 两模式各自的 apply 期拒绝 | 无（同一校验器实例族） |
| 复制服务缺席 | 零 provide | `ctx.get` undefined / require 抛错 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| apply → 校验 → 工厂 + 台账 + provide | stop（闩锁 → 全 close → timer.dispose → clear）→ revoke | 值域拒绝早于 provide（零清理）；close reject → stop reject + timer finally 清零 | 对称（与 listen 模式同构） |
| OwnedTimer（空集起步） | `dispose()`（stop finally） | 早退路径零注册句柄 | 对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二插件工厂 / 第二套校验 / 第二状态机 | 既有插件入口 / `validate.ts` / `hub-namespace.ts` FSM | 均未新增 | 无平行 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `packages/ws-replication/src/plugin.ts` | ALLOW 行 1（D1–D8） | 唯一实现面（+193/−13） | 内（DENY 文件零触碰：`git diff --name-only` 不含 `hub-session-host.ts`/`hub-session.ts`/`hub-namespace.ts`/`validate.ts`/`defaults.ts`/`types.ts`/peer 侧/`testing.ts`） |
| `packages/ws-replication/src/index.ts` | ALLOW 行 2 | +2 值 +2 类型（排序插入、既有 13 名零改名零删除） | 内 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | ALLOW 行 3（§12.8 唯一授权编辑） | `FROZEN_PRODUCTION_EXPORTS` 追加 2 名；**:557 断言形态逐字未动**；15 名数组经排序全序验证（`NOMICORE_HUB_R` < `NOMICORE_HUB_S`；`requireHubRe…` < `requireHubSe…`；`createHubRe…` < `createHubSe…`）；`FROZEN_TESTING_EXPORTS` 不扰 | 内（数组内两行来源注释见 OBS-5，值集无扰） |
| `packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts`（新增） | ALLOW 行 4（§12.0 + SA2 F1(4)） | 冻结套件逐字落盘 + 追加 C5d–C5g 5 `it` | 内（diff 核实：冻结段 10–302 行与 artifacts 基底逐字一致，仅头部 doc 注释改写 + 末尾追加；无 skip/only/todo） |
| `packages/ws-replication/test/ws-replication-issue422-session-host-api.test-d.ts`（新增） | ALLOW 行 5（§12.1） | test-d 类型锁 | 内（断言体与基底逐字一致，仅头部注释差异） |
| `packages/ws-replication/README.md` | ALLOW 行 6 | `createHubReplicationPlugin` 条目后追加免 listen 条目（复述 ADR 0032:30/:64-66） | 内（纯追加） |
| `CONTEXT.md` | ALLOW 行 7（U7） | SessionHost 词条追加插件轨一句 + `_Avoid_` 追加两条子句 | 内（纯追加、与代码同变更集——R2 满足） |
| 未跟踪 `artifacts/sa3-issue422-*.log` ×5 | — | 证据日志（非实现路径，不在 vitest/tsc include 内） | 说明项 |

无越界：DENY 全集（`ws-replication-plugin.test.ts`、其余既有测试、`package.json`、`apps/**`、`docs/adr/**`、`docs/protocols/**`、`docs/integration/**`）零 diff。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `HubReplicationPluginConfig.listen` 联合扩展 | `apps/yjs-server/src/app.ts:419`（listen 对象）；`issue421` test-d 参数元组 | 零影响（对象 ≠ false 走原链；联合不改元组形态）；根 `pnpm typecheck` exit 0（15 tsconfig） | 无 | 无 |
| 新服务常量/require/2 类型/模块增强行 | 全仓 grep：`apps/**` 零引用（新消费入口属宿主侧后续票 F4）；5 处 `declare module` 成员不相交 | append-only，无破坏 | 无 | 无 |
| `requireHubReplication`（免 listen ctx） | 消费方 | `/unavailable/`（AC3 语义同款）——测试断言 | 无 | 无 |
| 免 listen 宿主提供畸形 limits/timeouts 值 | 宿主组合根 | 构造成功 → apply rejection `TypeError`（`validate.ts` 家族）——与 listen 模式同生命周期点同家族（C5f parity 双向锁定） | 无 | 无 |
| `plugin.replication`/`plugin.listener`（免 listen） | 白盒消费方 | 恒 undefined（C2b） | 无 | 无 |
| stop-after-open / 双 stop / dispose 竞态 | 服务消费方 | 闩锁先 reject；`??=` 同一 promise；effect 复用闭包 | 无 | 无 |

## 8. 错误、恢复与并发

| 维度 | 审查结论 |
| --- | --- |
| 构造期错误 | 免 listen 仅通用键表 + 子集形状可抛 `TypeError`（消息含 `hub replication`，不回显凭据值——`assertCollKind`/`assertRecord` 消息形态核实）；listen 链零重排（NC-4a/b/d 要求链逐项保持） |
| 装配期值域错误 | 五校验器同步抛 → async `start()` → `apply()` rejection；先于 provide/effect；OwnedTimer 句柄集为空（`timerFromContext` 只包装不注册）——零清理义务，与 listen 模式 `:472`（`createHubReplication` 构造器抛）逐点对齐 |
| 角色错误 | 共享 `apply` 前缀（`:450-451`），peer 同步抛、零副作用（C1e 测试） |
| stop 失败 | `Promise.all` 任一 reject → stop reject（响亮传播，无吞错）；`finally` timer 仍清零；重复 stop 返回同一 rejected promise（重试即重观察） |
| 摘账语义 | `release` 仅 fulfill 摘账（reject 保留——诚实计数）；stop 闩锁后强制清零并以 rejection 承载失败信号——冻结类型注释「stop 后恒 0」钉死（OBS-1 调和口径，行为零漂移） |
| 并发 | 单线程 fiber；`serviceStopped` 先行消除 stop/open 竞态；多句柄并发 close 独立链；重复键由工厂响亮拒绝（服务台账不先 `set`——`host.open` 抛出时零台账写入，无双源分歧） |
| 资源所有权 | 插件仅拥有台账/包装句柄/OwnedTimer/发布服务；Registry/Runtime 归宿主（包 AGENTS 纪律） |

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| 422 运行时件 AC5 组（33 `it`：16 + 16 + 1） | 16 非法形态 ×（裸/其余配置合法）构造期 `TypeError` + `/hub replication/`；listen 要求链逐项 | `vitest.config.ts:15` include → `pnpm test` / `vitest run packages/ws-replication/test` | NC-3b 为静默降级敏感性锚（M1 变异面保持） | 无 |
| 422 运行时件 AC4 组（2 `it`） | NC-6 结构门（src/package.json 零网络 API）；listen 模式 adapter 恰一次/服务在场/SessionHost 恒缺席/timer 清零 | 同上 | 无 | 无 |
| 422 运行时件目标组（2 `it`） | C1a–C1e/C2/C3/C6 全链：真 Registry/Runtime OPEN 回合、`registry.open` 恰一次、1234 原值 plumb、observer `side:'hub'`、stop 收口（通道终态 closed + sessions 0 + timer 0 + stop 后 open 拒绝 + dispose 后 `/unavailable/`）、peer 角色同步拒绝 | 同上 | `ctx.fiber.dispose()` 每用例收尾，夹具隔离（每 `it` 独立 Context） | 无 |
| 422 追加块 C5d–C5g（5 `it`，SA2 F1(4) 授权） | 值域违例构造不抛 → apply rejection `TypeError` + 语义子串 + 零副作用（零服务/零定时器/adapter 零调用）；listen 半侧 parity；窄门激活（4MiB > 4×512KiB）与非激活（N5/N6 非追溯）双向 | 同上 | 算术核对成立（DEFAULT 值 4MiB/512KiB；`maxQueuedUpdateBytes 1MiB ≥ maxUpdateBytes 512KiB` 无条件链自洽）；变异证据：注释五校验调用 → 恰 C5d/C5e/C5g① 红（3 failed \| 39 passed），C5f/C5g② 保持绿——非伪绿 | 无 |
| 422 test-d（2 `it`） | T1–T4 正向锁定 + 7 `@ts-expect-error` 负控（伪值 5 形态、`requestReauth` 混入、`state:'running'`） | `vitest.config.ts:20` typecheck include + `tsconfig.typecheck.json`；`tsc -p packages/ws-replication/tsconfig.json` 二次把关 | 无 | 无 |
| 418 冻结契约（17 tests） | 15 名导出面全等 + `:557` 断言形态逐字 | 包全量内 | 授权编辑仅 2 名排序插入 | 无 |
| 既有 `ws-replication-plugin.test.ts`（15 tests） | listen 模式行为背书 | 包全量内 | 零 diff | 无 |

**计数交叉核算**：冻结 37 + 追加 5 = 42 运行时 + 2 test-d = 44（focused-green `Tests 44 passed (44)`、`Type Errors no errors`）；实现前红 `8 failed \| 36 passed (44)`（= 目标组 2 + 追加块 4 运行时红 + test-d 2——与 HEAD 能力缺口红因一致，日志逐条 `TypeError: hub replication listen…`/TS2322）；包全量 92 files/829 tests（基线 90/785 + 44）；根 455 files/5559 tests + typecheck exit 0。变异还原 md5 `379c9459…` 与当前 `plugin.ts` 一致、五校验调用在场。skip/only/todo 全仓新文件零命中。

## 10. Required revisions

无（无 BLOCKER / MAJOR / MINOR 阻断项）。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| SA8 R1 实现后冲突复查未闭合（公共面 13→15、免 listen 装配期值域失败类、`validate.ts` import 面、追加块不触碰冻结断言、DENY 零 diff） | 总控路由（冲突报告 R1/R4；SA3 报告 §Deferred 已登记） | SA8 对实现 diff 逐项 clear | 合入前未执行 R1 |
| 真实 Cordis 宿主组合（nomic-server worker 侧消费 `requireHubSessionHost`） | 宿主侧后续票（设计 F4） | 服务在真实 app 生命周期内可开/收口 | — |
| 新测试 CI 重复运行稳定性（SA3 单轮 + SA6 探针 3×） | CI | 逐轮绿 | 偶发红 |
| 冻结服务 Proxy 消费（ADR 0023，OBS-3 可选项） | 动态验证 | Proxy 包装后 `status/open/stop` 可用 | — |

## 12. Non-blocking observations

| ID | Observation | Suggestion |
| --- | --- | --- |
| OBS-1 | SA8 R1 实现后复查与 dispatch 前门禁产物（契约 U1）均未闭合——合入前义务，非实现缺陷 | Controller 路由 SA8 执行 R1（含 iteration 1 三项增量）后再合入 |
| OBS-2 | `docs/integration/cordis-plugin-hosting.md:179`「Hub plugin 只有在 listener 建立后才发布 ready service」在 `listen:false` 落地后仅对 listen 模式成立 | 宿主侧后续票（F4/R3）补模式限定；本票 DENY 正确未改 |
| OBS-3 | C2c（无 adapter 构造不得抛 `listen adapter is required`）无专门冻结断言，由追加块 C5e/C5g①/C5g② 的 `{}` overrides 构造传递覆盖（若实现误要求 adapter，这些 `it` 在构造行即红） | 可选：后续在契约套件外补一条直断言；敏感性已在场，非义务 |
| OBS-4 | 命名偏离设计参考实现：`drainPromise`/`serviceStopped` vs 设计的 `stopPromise`/`stopped`（避免遮蔽工厂级 listen 模式闭包，必要改名）；行为逐字一致 | 无需动作（登记映射即可） |
| OBS-5 | 冻结清单数组内追加了两行来源注释（设计措辞为「排序插入、零删除、零重排」）；`:557` `toEqual` 只比值集，断言语义零扰 | 后续冻结面编辑以纯条目插入为默认，注释置于数组外 |
| OBS-6 | 工作树存在无关未跟踪项 `.scratch/vfsl-v1-parser/spec.md`（早于本票 SA6 探针时间戳，属其他任务遗留；gitignored、零门禁影响） | 留档；非本票范围 |
