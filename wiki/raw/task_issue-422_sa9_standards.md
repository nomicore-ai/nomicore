# SA9 Standards 审查 — issue #422：hub 插件免 listen 模式（`listen: false`）与 `nomicoreHubSessionHost` 服务（spec #415 T5）

- 审查对象：**最终已提交 diff** — commit `55609d59ea86821cce39902448d415a105a993ec`（`feat(ws-replication): add hub session-only plugin mode`，2026-09-22 08:18 +0800），基线 = Parent PR #416 head `4ad13a35f782411d3c48096c31afa724f6eae067`（`spec/415-replication-transport-decoupling`，dispatch 确认稳定）。
- 审查人：SA9（独立 Standards 审查；未修改任何代码/设计/测试/证据；未运行测试、未启动服务；本文件为唯一可写产物）。
- Issue 评论经 REST 读取为**空**（dispatch 明示 none）：无 Owner 要求适用。
- Verdict：**approve**（零 BLOCKER / 零 MAJOR；4 条 MINOR 非阻断观察，见 §6）。
- `requiresConflictRecheck`：**false**（实现后冲突门禁 `task_issue-422_implementation_conflict_report.md` verdict clear、其 §10 自标 false，且本审查对 diff 的独立核对与其一致——无未闭合的决策冲突面）。

---

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| 提交 diff（`git diff 4ad13a3..55609d5`，14 文件：7 代码/文档 + 7 wiki 证据件） | 已逐 hunk 独立核对 |
| `wiki/raw/task_issue-422.md`（简报，6 AC） | 已读 |
| `wiki/raw/task_issue-422_design.md`（SA1 iteration 1，SA2 approve） | 已读（D1–D9、§11 ALLOW/DENY、§12 验收映射） |
| `wiki/raw/task_issue-422_sa2_review.md`（approve，F1 闭合） | 已读 |
| `wiki/raw/task_issue-422_sa3_impl.md`（实现报告） | 已读 |
| `wiki/raw/task_issue-422_sa4_review.md`（approve） | 已读 |
| `wiki/raw/task_issue-422_sa6_contract.md`（approve 契约；§12.1 冻结声明、§12.8 授权编辑） | 已读 |
| `wiki/raw/task_issue-422_{design,implementation}_conflict_report.md`（均 clear） | 已读 |
| 权威文本 | `docs/adr/0032`（决策 5 :30、后果 :64-66、决策 2）、`docs/adr/0023`（:45 构造纪律）、`docs/adr/0012`（:13/:17/:22）、`docs/protocols/instance-replication-v1.md`（§17/§21）、`CONTEXT.md`、`packages/ws-replication/AGENTS.md`、`docs/AGENTS.md` |
| 证据日志 | `artifacts/sa3-issue422-{red,focused-green,mutation-sensitivity,package-suite,root-gates}.log`、`artifacts/sa6-issue422-*.log`（计数交叉核算，§5） |

SA9 独立复核动作（非转抄上游结论）：`git diff --name-only` 变更集核对；listen 模式校验链与 `start()` 主体对 HEAD `git show 4ad13a3:…plugin.ts` 逐段比对；组合根窄门对 `hub-connection.ts:76-100`/`peer-connection.ts:105-131`/`hub-edge-host.ts:761-777` 并排比对；落盘测试 vs `artifacts/sa6-issue422-contract-suite/*` 字节 diff；冻结导出名单排序与计数核验；`git diff --check`；skip/only/todo grep；证据日志计数交叉核算。

---

## 2. Verdict

**approve**。交付 diff 全部落在批准设计（iteration 1）的 ALLOW/DENY 边界与 ADR 决策包络之内；listen 模式行为面逐字节保持（校验链零重排零消息变化、`start()` 主体仅引用改名）；公共面严格 append-only（13→15 名 + 2 类型 + 联合成员 + 模块增强一行）；冻结面（#420 工厂、`validate.ts`、wire/协议/peer 侧、既有测试）零触碰；测试质量标准（冻结断言逐字、变异敏感、类型锁、零 skip/only/todo）与证据链（红/绿/包全量/根门禁）计数自洽。无 BLOCKER/MAJOR。

---

## 3. 标准逐项审查

### 3.1 文件范围（设计 §11 ALLOW/DENY 硬门）

| 项 | 期望 | 实测 | 结论 |
| --- | --- | --- | --- |
| 变更集 | 恰 7 个 ALLOW 路径（plugin.ts / index.ts / 418 冻结测试 / 2 份新测试 / README / CONTEXT.md） | `git diff --name-only 4ad13a3..55609d5 -- packages/ CONTEXT.md docs/ apps/` 输出恰为该 7 路径 | ✓ |
| DENY 零 diff | `hub-session-host.ts`/`hub-session.ts`/`hub-namespace.ts`/`hub-connection.ts`/`hub-edge*.ts`/`peer-*.ts`/`testing.ts`/`defaults.ts`/`validate.ts`/`types.ts`/`ws-replication-plugin.test.ts` 及其余既有测试、`package.json`、`apps/**`、`docs/adr/**`、`docs/protocols/**`、`docs/integration/**` | 同上命令输出零命中；`git diff … -- packages/ws-replication/package.json` 为空（零新依赖） | ✓ |
| 既有测试编辑 | 仅 §12.8 授权的一处（418 冻结清单） | diff 核实：仅 `FROZEN_PRODUCTION_EXPORTS` 数组内 +2 条目（各带一行来源注释），零删除零重排；`:553`→`:557` 断言形态 `Object.keys(productionApi).sort()).toEqual(FROZEN_PRODUCTION_EXPORTS)` 逐字未动；`FROZEN_TESTING_EXPORTS` 不扰 | ✓（注释行见 §6-M1） |
| wiki 证据件 | 7 份任务产物随变更集归档 | 与仓内归档惯例一致（先例 `docs: add issue 421 task evidence` 等提交） | ✓ |

### 3.2 仓库 AGENTS 与模块责任

| 标准 | 实测 | 结论 |
| --- | --- | --- |
| 包 AGENTS：role-specific 插件只消费 Instance/Clock/Timer/Registry | `inject: ['nomicoreInstance','clock','timer','nomicoreRegistry']` 两模式共享、零改动（plugin.ts:448）；`apply` 前缀（requireInstance→assertRole('hub')→requireClock→requireRegistry→timerFromContext）零改动，peer 角色先于一切装配副作用同步拒绝 | ✓ |
| 包 AGENTS：插件只拥有 listener/dialer、replication controller、connections/channels 与 published service；上游 teardown 归组合根 | 免 listen 分支插件仅拥有：会话台账 + 包装句柄 + OwnedTimer + 发布服务（plugin.ts:572-619）；Registry/Runtime/上游服务零触碰 | ✓ |
| 包 AGENTS：公共导出仅经 `src/index.ts` | 新面全部经 index.ts 两条 export 语句（:21 值、:44 类型）；运行时导出恰 15 名（本审查脚本计数核实） | ✓ |
| 包 AGENTS：传输层不伸入 Runtime/Persistence/快照/活 Y.Doc | 免 listen 分支仅经 #420 公共工厂 + Registry lease 消费；零内部缝穿越 | ✓ |
| 模块责任：配置校验/装配/服务发布/teardown 归插件；会话 FSM 归 #420 工厂 | `validateHubSessionOnlyConfig`/`startHubSessionHostService` 均为 plugin.ts 内私有；`hub-session-host.ts` 零 diff（工厂冻结面保持） | ✓ |

### 3.3 ADR / 协议符合性

| 决策 | 要求 | 实测 | 结论 |
| --- | --- | --- | --- |
| ADR 0032 决策 5（:30） | 免 listen = 显式 `listen: false`；SessionHost 服务仅免 listen 模式提供 | 分派 = 两条通用 record 断言之后 `config.listen === false` 严格相等（plugin.ts:347-354）——无 falsy 判定、无缺省隐式；`ctx.provide(NOMICORE_HUB_SESSION_HOST_SERVICE)` 唯一发布点在 `startHubSessionHostService`，仅 `listenMode === undefined` 分支可达（:468-471/:616）；listen 分支零发布（互斥落地，测试 :170/:301-302 双向钉死） | ✓ |
| ADR 0032 :64 | SessionHost 双轨（工厂 + 免 listen 插件服务） | 服务轨 = #420 冻结工厂直接消费 + `status`/`stop` 包装；工厂零 diff；未新增第二插件工厂（设计 D9-a 否决项未被采纳） | ✓ |
| ADR 0032 :65 | 免 listen 不消费 tokens/authorization/verifyToken/authorize；不提供 `nomicoreHubReplication` | `listenMode` 条件绑定：免 listen 时连 staticVerifier/staticAuthorizer 闭包都不构造（plugin.ts:436-442）；分支早退，零 `createHubReplication`、零复制服务 provide；提供时的形状校验保留（「校验 ≠ 消费」裁量点，设计后/实现后冲突门禁均裁 no-conflict，未扩大） | ✓ |
| ADR 0032 :66 | 公开面冻结、演进 append-only | `listen` 联合仅追加 `\| false`（listen 分支类型逐字不变）；+1 常量 +1 require 函数 +2 类型 + 模块增强恰一行（hub/peer 之间）；index.ts +2 语句（既有 13 名零改名零删除）；#418 冻结名单按授权通道追加 | ✓ |
| ADR 0032 决策 2（:18） | 零 worker_threads/MessageChannel 依赖/类型 | 新 import 全为包内既有模块（defaults/hub-session-host/validate）；`package.json` 零 diff；零网络 API（NC-6 结构门在新测试 :143-152 在场） | ✓ |
| ADR 0023（:45） | `ctx.provide` 发布的服务：函数成员访问器属性 + `Object.freeze` | `HubSessionHostService` = `Object.freeze` + `get status/open/stop`（getter 返回稳定闭包，plugin.ts:606-612）；包装句柄为方法返回值（ADR 明文排除面），不冻结合法 | ✓ |
| ADR 0012 :13/:17 | 合并结果严格校验；字段级合并 + 未知键拒绝 | 键表/形状层构造期（`HUB_CONFIG_KEYS`/`HUB_OVERRIDE_KEYS` + 子集校验），值域层装配期（见下行）；`mergeNested` 与四处 record 键表断言逐字节保留 | ✓ |
| 协议 §17（:575/:591-616） | 启动期响亮验证、绝不运行时 clamp；分块族链「显式表达才激活」、存量配置不误判 | `startHubSessionHostService` 顶部 `resolveLimits/resolveTimeouts` → `validateLimits/validateTimeouts`（无条件）→ 三链显式激活窄门（键集、`hasOwnProperty` 谓词、`!= null` 门与 `hub-connection.ts:85-100` 逐键逐形等价；门输入 = 同一 `mergeNested` 闭包对象 = listen 分支传 `createHubReplication` 的同一对象，两模式激活判据等价）；零 clamp | ✓ |
| 协议 §21（:675-686） | 停机顺序：停接纳→排空→close→lease 释放；上游归组合根；异常安全 | `stop`：`serviceStopped=true` 闩锁先行（此后 `open` 响亮拒绝）→ `Promise.all(全台账 close())` → `finally { timer.dispose(); sessions.clear(); }`；不触 Registry/上游；effect 反向 yield `[stop, revoke]` 与 hub/peer 既有模式同构 | ✓ |
| ADR 0012 :22 | status/observer/错误不泄漏凭据 | `HubSessionHostStatus` = `{state, sessions}` 零凭据；新错误消息（`…is unavailable`/`…is stopped`）不含凭据值；NC-5 负控在冻结套件内保持 | ✓ |

### 3.4 单一事实源与平行机制

| 检查 | 实测 | 结论 |
| --- | --- | --- |
| 校验器单一事实源 | `validateLimits`/`validateTimeouts`/三条分块族链纯 import 自 `validate.ts`（零编辑、零第二套校验、零值域逻辑复制；`validateHubSessionOnlyConfig` 仅键表/形状层，镜像 listen 模式自有形状层） | ✓ |
| resolver 单一事实源 | `resolveLimits`/`resolveTimeouts` 纯 import 自 `defaults.ts` | ✓ |
| 会话唯一性事实源 | #420 工厂台账为权威；服务台账键 `${connectionKey}\u0000${namespaceId}` 与工厂同构；`host.open` 抛出先于台账 `set`（重复键零双源分歧） | ✓ |
| 第二状态机/第二插件工厂/兼容壳 | 均未新增（服务生命周期两态闩锁，非协议 FSM） | ✓ |
| AC6 判据 | 收口判据 = `close()` promise resolve + `timer.active` 清零；未采用被 E2e 证伪的 `settled` 信号 | ✓ |

### 3.5 生命周期对称性

| Acquire | Release | 失败路径 | 结论 |
| --- | --- | --- | --- |
| `apply` → 校验 → 工厂 + 台账 + `ctx.provide` + `ctx.effect` | `stop`（闩锁 → 全 close → `timer.dispose` → `clear`）→ 反向 yield `revoke` | 值域违例：同步抛 → `apply()` promise rejection，**先于 provide/effect**（零服务/零会话/零定时器，零清理义务——与 listen 模式经 `createHubReplication` 构造器抛出逐点对齐）；close reject → stop reject 响亮传播 + `finally` timer 仍清零；`drainPromise ??=` 幂等（重复 stop 同一 promise） | 对称 ✓ |
| OwnedTimer（`timerFromContext` 包装） | `dispose()`（stop `finally` + effect 复用同一闭包） | 值域拒绝点句柄集为空（零注册） | 对称 ✓ |

### 3.6 listen 模式逐字节不变（AC4 承重）

- `validateHubConfig`：对 HEAD `git show 4ad13a3:plugin.ts` 逐段比对——唯一改动 = 在两条通用 record 断言后**纯插入** 6 行分派（含注释）；listen 断言链（listen 形状 → adapter 必需 → 认证/授权必需 → tokens/authorization 形状 → limits/timeouts 键表 → verifyToken/authorize/listen/observer 形状）零删除、零重排、零消息变化。
- `start()` listen 主体：仅引用改名（`authorize`/`verifyToken`/`listen`/`config.listen.{host,port,path}` → `listenMode.*`）；对象字面量求值次序（verifyToken→authorize→listen）与时机（构造期）不变；`endpoint` 即 `config.listen` 同一引用；`authenticate` 闭包改读 `listenMode.verifyToken`（const 对象、无外部可变性）——同值同序同时机同消息。
- `createHubReplication` 调用面（含 `limits`/`timeouts`/observer spread 与 `acceptTrusted` 检查、try/catch 形态、stop 闭包、ADR 0023 服务构造、effect 反向 yield）：逐字未动。
- 既有 `test/ws-replication-plugin.test.ts` 零 diff；包全量 829 绿 + 根 5559 绿背书。

### 3.7 测试质量标准

| 标准 | 实测 | 结论 |
| --- | --- | --- |
| 冻结断言逐字保留（契约 §12.0） | 运行时件：artifact 基底第 10-302 行 vs 落盘件第 11-303 行 `diff` 为空（**冻结体字节一致**）；差异 = 头部 doc 注释改写 + 末尾 `302a304,419` 纯追加（C5d–C5g 五 `it`）。test-d：断言体逐字一致，仅头部注释差异 | ✓（头注释见 §6-M2） |
| F1 追加块授权 | 追加块为新增 `it`、复用文件级夹具（`effectTimer`/`dependencies`/`VALID_LISTEN`）、不触碰冻结断言——与 SA2 §13-F1(4) 授权口径逐字对齐 | ✓ |
| 断言敏感性（非伪绿） | `artifacts/sa3-issue422-mutation-sensitivity.log`：临时注释五校验调用后 `Tests 3 failed \| 39 passed (42)`，红恰为 C5d/C5e/C5g①；C5f parity 与 C5g② 保持绿（方向正确：parity 锁定 listen 既有行为、非激活面不因漏接校验而红）；探针后 md5 原位还原 | ✓ |
| 行为断言纪律 | 全部为运行时行为/可观察边沿（服务在场、spy 零调用、通道终态、timer 清零、apply rejection 错误家族与语义子串）；唯一结构断言 = 契约 §12.3 明示豁免的 NC-6 补充结构门 | ✓ |
| 类型锁 | test-d：T1–T4 正向 + 7 × `@ts-expect-error` 负控（伪值 5 形态、`requestReauth` 混入、`state:'running'`）；`vitest.config.ts:15,20` include 与包 tsconfig `include:["src/**","test/**"]` 双重发现核实 | ✓ |
| skip/only/todo | 两份新文件 grep 零命中 | ✓ |
| 夹具纪律 | 复用 `test/harness.js` 真 Registry/Runtime；文件级 `effectTimer`/proxy registry 仅计数注入、无协议决策；每 `it` 独立 Context、`ctx.fiber.dispose()` 收尾 | ✓ |

### 3.8 文档同步（docs/AGENTS 编辑纪律）

- CONTEXT.md SessionHost 词条：正文追加插件轨登记一句 + `_Avoid_` 追加两条（仅精确 `false`、两入口并存非法）——diff 核实为同段落内纯追加，内容限于复述 ADR 0032:30/:64-66 已登记事实，零新术语、零新决策语义。
- README：`createHubReplicationPlugin` 条目后追加一条免 listen 条目（服务名/认证授权豁免/互斥/`stop` drain 语义），表述与实现及 ADR 一致。
- 两处文档与代码**同变更集**（冲突门禁 R2 闭合）；ADR/协议/集成文档零修订（决策文本已登记本形态，无需 evolution）。
- `git diff --check 4ad13a3..55609d5` 干净（exit 0）。

---

## 4. Owner 要求与流程义务核对

| 项 | 状态 |
| --- | --- |
| Issue 评论（REST） | 为空——无 Owner 要求适用 |
| 设计审批链 | SA1 iteration 1 → SA2 approve（F1 四点闭合）→ SA3 实现 → SA4 approve；链完整、产物在场 |
| 冲突门禁 | 设计后 clear（R1–R4 义务）；实现后 clear（R1 清单 ①–⑧ 逐项核对、R2 闭合、§10 `requiresConflictRecheck: false`）——SA2 `requiresConflictRecheck: true` 指定的 iteration 1 三项增量（装配期值域失败类、`validate.ts` import 面、追加块不触冻结断言）已被实现后门禁覆盖 |
| dispatch 前 SA8 字面产物（`*_relevant_decisions.md`/`*_conflict_report.md`） | 仍缺失（契约 U1 已登记）；决策内容经设计后 + 实现后双门禁覆盖，无缺失裁决（实现后报告 R4「实质闭合」）。见 §6-M4 |

---

## 5. 证据链一致性（计数交叉核算）

| 证据 | 声明 | 本审查核算 | 结论 |
| --- | --- | --- | --- |
| `sa3-issue422-red.log` | 实现前红：`8 failed \| 36 passed (44)` + `Type Errors 2 failed` | 与 HEAD 能力缺口红因一致（构造期 `TypeError: hub replication listen…` + 类型面 TS 错）；负控组同 run 全绿 | ✓ |
| `sa3-issue422-focused-green.log` | `Tests 44 passed (44)`、`Type Errors no errors` | 44 = 42 运行时（37 冻结 + 5 F1 追加）+ 2 test-d，与文件实数一致 | ✓ |
| `sa3-issue422-package-suite.log` | `Test Files 92 passed`、`Tests 829 passed` | 829 = 基线 785 + 44；92 = 90 + 2，与 SA6 基线日志一致 | ✓ |
| `sa3-issue422-root-gates.log` | `pnpm typecheck` `TYPECHECK_EXIT=0`（15 tsconfig 串行）+ `pnpm test` `TEST_EXIT=0`（455 files / 5559 tests） | 日志尾行核实 | ✓ |
| `sa3-issue422-mutation-sensitivity.log` | 恰 C5d/C5e/C5g① 红 | 日志逐项 `×`/`✓` 标记核实（§3.7） | ✓ |

验证命令组与设计 §12/契约 §12.0 明示命令逐字一致（vitest `--typecheck`、包 `tsc`、根 `pnpm test`/`pnpm typecheck`），满足包 AGENTS「wire 或生命周期变化须跑包 typecheck + 根门禁」的验证门要求。

---

## 6. Non-blocking observations（MINOR，均不阻断 approve）

| ID | 观察 | 处置建议 |
| --- | --- | --- |
| M1 | 418 冻结名单数组内随 2 个条目各插入一行来源注释（设计措辞为「排序插入、零删除、零重排」——条目本身满足；注释对 `toEqual` 值集断言惰性，SA4 OBS-5 已登记） | 后续冻结面编辑以纯条目插入为默认、注释置于数组外 |
| M2 | 两份新测试的头部 doc 注释相对 SA6 artifact 基底改写（冻结断言体字节一致，SA3/SA4 均已登记；契约冻结对象是断言形态而非文件头） | 无需动作 |
| M3 | `docs/integration/cordis-plugin-hosting.md:179`「Hub plugin 只有在 listener 建立后才发布 ready service」在 `listen:false` 落地后仅对 listen 模式成立——该文件属 DENY（宿主侧后续票，设计 F4/冲突报告 R3 已登记），本票未改正确 | 宿主侧票补模式限定 |
| M4 | dispatch 前 SA8 字面产物（`*_relevant_decisions.md`/`*_conflict_report.md`）缺失（契约 U1）；设计后 + 实现后双冲突门禁均 clear 且覆盖 iteration 1 增量，属流程记账缺口而非决策缺口 | 若总控要求字面文件名闭合 U1，按流程补记；不构成本票合入的决策阻塞 |

---

## 7. 结论

交付 diff 与证据满足仓库与工程标准：AGENTS/包 AGENTS 边界、ADR 0032 决策 5 及后果节、ADR 0023 构造纪律、ADR 0012 校验与凭据纪律、协议 §17/§21 配置与停机权威、单一事实源（`validate.ts`/`defaults.ts`/工厂台账）、生命周期对称性（反向 yield + 幂等 stop + `finally` timer 清零）、文件范围（ALLOW 恰 7 路径、DENY 零 diff）、测试质量（冻结断言字节一致、授权追加、变异敏感、类型锁、零软化）与文档同步（同变更集纯追加）。零 BLOCKER/MAJOR；4 条 MINOR 已登记。**approve**。
