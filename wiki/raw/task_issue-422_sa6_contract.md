# SA6 诊断与验收契约 — issue #422：hub 插件免 listen 模式（`listen: false`）与 `nomicoreHubSessionHost` 服务（spec #415 T5）

任务类型：**Feature（能力缺口）**——不是 Bug 根因；本契约证明「当前实现无此能力」，并把目标行为
固化为可执行的红灯验收契约。零生产实现改动、零设计落地、零最终修复。

- HEAD：`4ad13a35f782411d3c48096c31afa724f6eae067`（= PR #429 merge，含 #418/#419/#420/#421/#423）
- 证据根：`artifacts/sa6-issue422-*`（worktree-relative；命令见各节）
- 结论：**approve**——能力缺口稳定复现（3× 逐轮一致）、契约可执行且被真实 runner 发现、负控全绿、
  断言敏感性经变异驱动 4/4 证明。

---

## 1. Task type and inputs

| 输入 | 路径 | 说明 |
| --- | --- | --- |
| 任务简报（Host-owned） | `wiki/raw/task_issue-422.md` | Issue #422 正文 + 6 条 AC；Issue 评论经 REST 读取为**空**（无 owner 要求） |
| 权威决策 | `docs/adr/0032-transport-decoupling-edge-session-split.md` | 决策 5（:30）「免 listen 表达为显式 `listen: false`；SessionHost 服务（`nomicoreHubSessionHost`）仅免 listen 模式提供」；后果节（:64-66）「SessionHost 双轨（工厂 + 免 listen 插件服务）」「免 listen 的 worker 侧插件不再消费 tokens/authorization/verifyToken/authorize」「不提供 `nomicoreHubReplication`」；澄清附录 A1–A3（:32-53）公共面信号与降级登记 |
| 协议文本 | `docs/protocols/instance-replication-v1.md:582,:833` | 分片形态 `listen: false` 的 per-session assembly 计数口径与发射侧归属表（#423 已登记） |
| 词条 | `CONTEXT.md:229-231` | SessionHost 词条（authorize 不在此调用/句柄面） |
| 模块规约 | `packages/ws-replication/AGENTS.md` | role-specific Cordis 插件只消费 Instance/Clock/Timer/Registry；teardown 归属；公共导出仅经 `src/index.ts` |
| 兄弟票契约 | `wiki/raw/task_issue-418_sa6_contract.md`（§U4：本导出面留后续票）、`task_issue-420_sa6_contract.md`（§12.1 工厂冻结、§12.6 冻结导出授权编辑）、`task_issue-421_sa6_contract.md`、`task_issue-423_sa6_contract.md` | 冻结纪律与授权编辑口径 |
| **缺失** | `wiki/raw/task_issue-422_relevant_decisions.md`、`wiki/raw/task_issue-422_conflict_report.md`、任何 `task_issue-422_*design*` | 本票**无 SA8 门禁产物**（见 §15 U1）；按 skill「输入缺失时以简报/源码/日志/现有测试继续」执行 |

本票的审计对象 = 简报 + ADR 0032 决策 5 + 既有实现事实（`src/plugin.ts` / `src/hub-session-host.ts` / 冻结公共面）。

### 1.1 范围界定（非目标）

在范围内：hub 插件 `listen: false` 的**装配/服务面/校验/teardown** 与 `nomicoreHubSessionHost`
服务的公共签名冻结（含 test-d 锁定）。

不在范围内：listen 模式任何行为变化；wire/协议/错误码/事件词汇变化；`createHubSessionHost` 工厂面
（#420 已冻结）；`nomicoreHubReplication` 形态变化；`worker_threads`/`MessageChannel`/真跨线程 pipe
（ADR 决策 2 禁依赖 + 决策 5「真 worker 形态」留后续票）；peer 侧；nomic-server 宿主接线；
`#421` 设计 §13 登记的工厂级服务面聚合（connections/revoke 广播/close）。

---

## 2. Owner comment mapping

| 来源 | 内容 | 映射 |
| --- | --- | --- |
| Issue 评论（REST） | **无评论**（dispatch 明示：none；无 owner 要求） | 无额外约束；契约仅由正文 6 条 AC + ADR 0032 决策 5 约束 |
| Issue 正文 AC1–AC6 | 见 `wiki/raw/task_issue-422.md:21-26` | 逐条映射为 §12.1–§12.7（AC1→§12.2+§12.1；AC2→§12.3；AC3→§12.4；AC4→§12.5；AC5→§12.6；AC6→§12.7） |

---

## 3. SA8 constraints

- **无 SA8 产物**：本票缺失 `*_relevant_decisions.md` / `*_conflict_report.md`（§15 U1）。因此本契约的
  决策摘录由 SA6 从 ADR 0032 + 协议文本 + 兄弟票 SA6 契约直接取证（§1 表），并**显式登记该缺口**作为
  实现合入前的门禁义务（#418 R5''/R7'' 与本族 A6 范围跟踪口径一致：worker 形态票须过 SA8）。
- 可继承的 SA8 结论（来自 #420/#421/#423 报告，均在 HEAD 已闭合）：`listen: false` / `nomicoreHubSessionHost`
  / `createHubReplicationEdge` 三者属**后续票**导出面（#418 SA10 §9 行 4；#421 §8-A6；#423 SA6 §U4），
  本票是其中 T5（服务轨）的兑现。
- 冻结纪律（ADR 0032 后果节：公开面「一经发布即按 SA6 纪律冻结，演进只能 append-only」）：本契约
  §12.1 的公共面冻结 + test-d 锁定即该纪律的 T5 落地。

---

## 4. Environment and baseline

| 项 | 值 | 证据 |
| --- | --- | --- |
| HEAD | `4ad13a3` | `git rev-parse HEAD`（各日志头） |
| 运行时 | node v24.13.0；pnpm 10.28.2；vitest 3.2.7；typescript 5.9.3 | `pnpm install --offline --frozen-lockfile`（本地 store 复用 65 包，exit 0） |
| 包全量基线 | `ws-replication` 90 files / **785 tests passed**，`Type Errors no errors`，exit 0 | `artifacts/sa6-issue422-baseline-package-suite.log` |
| 包 typecheck 基线 | `tsc -p packages/ws-replication/tsconfig.json` exit 0 | `artifacts/sa6-issue422-post-cleanup-gates.log` |
| 现有插件测试 | `test/ws-replication-plugin.test.ts` 15 tests 绿（listen 模式服务面/校验/装配/teardown） | 同上（基线套件内） |
| 冻结生产导出面 | 13 名（`NOMICORE_HUB_REPLICATION_SERVICE` / `NOMICORE_PEER_REPLICATION_SERVICE` / `createHubReplication` / `createHubReplicationEdge` / `createHubReplicationPlugin` / `createHubSessionHost` / `createPeerReplication` / `createPeerReplicationPlugin` / `requireHubReplication` / `requirePeerReplication` / 3 × `DEFAULT_REPLICATION_*`） | `test/ws-replication-issue418-edge-session-split-contract.test.ts:144-158`；断言 :553 |
| 基底能力（在场） | `createHubSessionHost` 工厂公共导出（#420）+ 真 Registry/Runtime 夹具可驱动 OPEN→…→CLOSE 回合 | `src/hub-session-host.ts:261`；`src/index.ts:6`；§9 E1 |

复现基线命令：

```bash
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication/test
pnpm exec tsc -p packages/ws-replication/tsconfig.json
```

---

## 5. Positive reproduction（能力缺口的事实复现）

**最小输入**（一行）：

```ts
createHubReplicationPlugin({ listen: false }, {});
```

**实际（HEAD）**：`TypeError: hub replication listen: invalid configuration`
（`src/plugin.ts:292` → `assertRecord:160-165`）。复现率 **3/3**（`artifacts/sa6-issue422-stability-3x.log`）。

**期望（目标）**：同调用构造成功；`apply(ctx)` 成功并发布 `nomicoreHubSessionHost` 服务；
不发布 `nomicoreHubReplication`；零 listener；服务可 `open()` 真会话；`stop()` 后会话收口、timer 清零。

同一缺口在四个维度可观察（探针 `CAP-1..CAP-13`，`artifacts/sa6-issue422-capability-gap-probe.{mts,log}`）：

| 面 | HEAD 事实 | 探针 |
| --- | --- | --- |
| 配置联合 | `listen: boolean` 不被 `HubReplicationPluginConfig['listen']` 接受（TS2322） | `CAP-1` / 类型锁 §12.1 |
| 公共入口 | 13 名导出中无 `NOMICORE_HUB_SESSION_HOST_SERVICE` / `requireHubSessionHost`；`HubSessionHostService` / `HubSessionHostStatus` 类型不存在 | `CAP-12`；`tsc` 7 × TS2305/2724（`artifacts/sa6-issue422-type-lock-red.log`） |
| 服务面 | `ctx.get('nomicoreHubSessionHost')` 恒 `undefined`（模块增强未声明该服务） | `CAP-2/3/8/9` |
| 装配副作用 | `start()` 无条件 `listen.listen(...)` 且无条件 provide `nomicoreHubReplication` | `CAP-10` / `CAP-8` |

**关键边界（不是环境/夹具/入口故障）**：
- 同一探针进程内，listen 模式负控 40 项全绿（§6）——导入机制、Context 夹具、Registry/Runtime 夹具、
  timer/observer 采样面全部工作正常；
- runner 层同一文件内，负控 35 tests 绿、目标断言 4 tests 红，红因逐条为上述 TypeError（§13）。

---

## 6. Negative control

全部为 HEAD **绿**、实现后**必须保持绿**的相近负控（探针 `NC-*`，40/53 PASS）：

| 组 | 断言 | HEAD |
| --- | --- | --- |
| NC-1 | listen 模式：`nomicoreHubReplication` 在场且 `status === {state:'ready',connections:0}`；adapter 恰调用 1 次；`plugin.listener !== undefined` | 绿 |
| NC-2 | listen 模式：`ctx.get('nomicoreHubSessionHost') === undefined`（**两入口并存属非法形态**） | 绿（实现后仍须绿） |
| NC-3 ×16 | 非法 listen 形态（拼写键 `lisen`；`'false'`、`0`、`''`、`null`、`undefined`、`NaN`、`1`、`true`、`[]`、`{}`；缺 host/port；空 host；端口越界；path 非绝对；嵌套拼写键）→ 构造期 `TypeError` 且消息含 `hub replication` | 绿 |
| NC-3b ×16 | **敏感性锚**：同一批非法形态 + 其余配置全部合法（`tokens:[]`/`authorization:[]` + 合法 adapter）→ 仍必须 `TypeError`。静默降级实现会让本组构造成功 ⇒ 红 | 绿 |
| NC-4a/b/c/d | listen 模式要求链逐项不变：缺 adapter → `listen adapter is required`；缺认证 → `authentication is required`；缺授权 → `authorization is required`；三者齐备 → 构造成功 | 绿 |
| NC-5 | 配置错误不得回显凭据值（`do-not-print` 不出现在错误里） | 绿 |
| NC-6 | 补充结构门：`src/**` + `package.json` 对 `node:net|http|https|tls`、`ws`、`createServer(` 命中 0 | 绿 |
| 正向抑制负控 | 同一最小 OPEN 回合在授权投影 owner 不符时：零 `OPEN_OK` + 终局 `ERROR{NAMESPACE_NOT_FOUND}`（探针 `E3a`） | 绿 |

> NC-3 单独**不足以**判定静默降级（falsy 实现会把 `{listen:0}` 推进到 `listen adapter is required`
> 同样是 TypeError）；故 NC-3b 是「拼写错误不得静默降级为免 listen」的承重判据（§8 M1 已实证）。

---

## 7. Stability, scale and timing

- 探针 3 轮（`artifacts/sa6-issue422-stability-3x.log`）：能力缺口探针逐轮 `PROBE_RESULT 40/53` 且
  `FAILED_IDS` 逐字一致；可达性探针逐轮 `13/13`、零失败。
- 时间/规模条件：全部为微任务 + 确定性 fake-scheduler 驱动，无 real sleep、无 socket、无 worker；
  最小输入 = 单次构造 + 单 Context 装配 + 单 (连接,namespace) OPEN 回合。
- 无竞态面（本票不引入并发路径）；`timer` 采样为注入式计数器，无墙钟依赖。

---

## 8. Capability gap chain（能力缺口链，非缺陷根因）

| Step | Fact | Evidence | Confidence |
| --- | --- | --- | --- |
| S1 需求 | 免 listen 模式 = 显式 `listen: false`、零 listener 合法装配、提供 `nomicoreHubSessionHost`、不提供 `nomicoreHubReplication`、免 tokens/authorization/verifyToken/authorize、非法拼写不得静默降级 | ADR `0032:30,:64-66`；`wiki/raw/task_issue-422.md:17-26` | 高（权威文本） |
| S2 症状（直接故障点） | `createHubReplicationPlugin({listen:false},{})` → `TypeError('hub replication listen: invalid configuration')` | `src/plugin.ts:292`（`assertRecord(config.listen, 'hub replication listen', {host,port,path})`）→ `:160-165`；探针 `CAP-1`；runner 红日志 2 条同因 | 高（实测 + 源码单点） |
| S3 类型面缺口 | `HubReplicationPluginConfig.listen` 无 `false` 成员 | `src/plugin.ts:86-92`；`tsc` 类型锁 TS2322 | 高 |
| S4 服务面缺口 | 模块增强只声明 `nomicoreHubReplication` / `nomicorePeerReplication`；无 `NOMICORE_HUB_SESSION_HOST_SERVICE` / `requireHubSessionHost` / `HubSessionHostService` / `HubSessionHostStatus`；`src/index.ts` 13 名导出零命中 | `src/plugin.ts:143-148`；`src/index.ts:11-18,25-41,75-95`；探针 `CAP-2/3/12`；`tsc` 7 错 | 高 |
| S5 装配缺口（放大因素） | `start()` 无条件 `createHubReplication(...)` + `await listen.listen(...)` + `provide('nomicoreHubReplication')`；`validateHubConfig` 无条件要求 adapter + tokens/authorization | `src/plugin.ts:298,301-302,392-402,406-420,435-448` | 高 |
| S6 需求侧消费面缺口 | 服务轨缺席 ⇒ worker 侧宿主无法取得「namespace 级会话工厂 + worker 本地注入面」的消费入口（工厂面已由 #420 提供，插件服务面才是 T5 交付） | 探针 `CAP-4/5/6/7`（目标断言不可达）；`artifacts/sa6-issue422-causal-feasibility-probe.log` E1（工厂面可达） | 高 |
| S7 在场基础（非缺口） | 真 namespace FSM/工厂已公共：`createHubSessionHost` + 真 Registry/Runtime 回合可驱动（OPEN_OK→BOOTSTRAP_SNAPSHOT），timer/observer/registry 注入面可观察 | `src/hub-session-host.ts:44-89,261`；`src/index.ts:6`；可行性探针 13/13 | 高 |
| S8 未证实假设 | 「插件 stop 后 `settled` 信号可作收口判据」——**实测为假**（见 C1） | `hub-namespace.ts:509,1137,1699`（三入口）vs `:1204-1212`（连接级 close 不经 `notifySettled`）；探针 `E2e` | 高 |
| S9 排除项 | 环境/夹具/入口问题（同进程负控 40 项绿）；wire/协议面（本票零触碰）；依赖缺失（`worker_threads` 等，探针 `NC-6` + 结构基线绿） | §6 / §11 | 高 |

---

## 9. Causal experiments

| # | 实验 | 结论 | 证据 |
| --- | --- | --- | --- |
| E1 | **可达性**：把契约测试的同一最小回合（`open()` → `OPEN_NAMESPACE` → `OPEN_OK`）经**既有公共工厂** `createHubSessionHost` + 真 Registry/Runtime 驱动 | 13/13 绿：出帧 `OPEN_OK`+`BOOTSTRAP_SNAPSHOT`（占位 sequence=0）、`registry.open(HUB_OWNER, nsId)` 恰一次、timer 注入被 arm（`delays=[10000,1234]`）、observer 注入得 `channel-state-changed`/`bootstrap-snapshot-sent` | `artifacts/sa6-issue422-causal-feasibility-probe.{mts,log}` |
| E2 | **收口语义**：`handle.close()`（连接级 close）后观察信号与状态 | `close()` 幂等且 resolve；observer 边沿 `bootstrapping→closing→closed`；timer 清零；**零 `settled` 信号** ⇒ AC6 判据改用「通道终态 closed + sessions 计数 + timer 清零」 | 同上 `E2a–E2e`；源码 `hub-namespace.ts:1181-1212,1716-1720,1807-1822` |
| E3 | **配置 plumb**：`timeouts.bootstrapTimeoutMs = 1234` 是否原值到达 session 定时器 | 是（`delays` 含 1234）⇒ limits/timeouts 注入面可观察、断言可承重 | 同上 `E1f` |
| E4 | **负控**：同回合换 owner 投影（`PEER_OWNER`） | 零 `OPEN_OK` + `ERROR{NAMESPACE_NOT_FOUND}` ⇒ 回合是真实注册表行为、不是空跑 | 同上 `E3a` |
| M1–M3 / NM1 | **变异敏感性**（§8.1 表） | 4/4 符合预期（含 1 个等价改写零变红） | `artifacts/sa6-issue422-mutation-sensitivity.log` |

### 9.1 变异敏感性（实跑）

| 变异 | 语义漂移 | 期望失败集 | 实测 |
| --- | --- | --- | --- |
| M1 | `!config.listen` **falsy 陷阱**：`0`/`''`/`null`/`undefined`/`NaN` 静默降级为免 listen（形状校验被跳过，其余链保留） | HEAD 13 项 + `NC-3b-*-{number-0,empty-string,null,undefined-value,nan}`（5 项） | ✅ 逐项相等 |
| M2 | 删除 listen 模式「认证必需」校验 | HEAD 13 项 + `NC-4b` | ✅ |
| M3 | 删除 listen 模式「adapter 必需」校验 | HEAD 13 项 + `NC-4a` | ✅ |
| NM1 | 等价改写 `overrides.listen === undefined` → `== null` | 与 HEAD 完全一致（13 项，无增无减） | ✅ 零漂移 |

> 驱动纪律：`packages/**` 零写入——源码副本落 `.scratch/sa6-422/mutants/<id>/src`（仅 symlink 包内
> `node_modules`），逐变异一次替换（命中数 ≠ 1 即 ABORT），跑完 `rm -rf`（§16）。命令：
> `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa6-issue422-mutation-driver.mts`。

---

## 10. Impact surface

| 面 | 位置 | 变更性质 |
| --- | --- | --- |
| 配置类型 | `src/plugin.ts:86-92` `HubReplicationPluginConfig.listen` | append-only 联合：`… | false`（listen 模式类型不变） |
| 配置校验 | `src/plugin.ts:289-316` `validateHubConfig` | 分派：精确 `false` → 免 listen 分支（跳过 listen 形状/adapter/tokens/authorization 要求）；其余形态**沿用现有断言**（含拼写键拒绝） |
| 装配 | `src/plugin.ts:385-449` `start()` | 免 listen 分支：不调用 adapter、不 `createHubReplication`、不 provide 复制服务；构造 `createHubSessionHost` + 会话台账 + `stop`/effect |
| 服务面 | `src/plugin.ts`（新常量/类型/`requireHubSessionHost`/模块增强新增行） | append-only 新增 |
| 公共入口 | `src/index.ts` | 追加 2 值 + 2 类型（排序插入） |
| 既有冻结断言 | `test/ws-replication-issue418-edge-session-split-contract.test.ts:144-158` | **授权的一次性编辑**：`FROZEN_PRODUCTION_EXPORTS` 追加 2 名（零删除/零重排；:553 断言形态不变） |
| 文档 | ADR 0032 决策 5/后果节已登记本形态（:30,:64-66）；协议 §17/§23.1/:833 已登记分片形态 | 本票**无需**修订（如需补 CONTEXT.md 服务词条，属 design 决策） |
| 调用方 | worker 侧宿主（nomic-server ingress=edge / namespace home worker=SessionHost 服务） | 新消费入口；listen 模式调用方零影响 |
| 非影响 | wire 格式、错误码、事件词汇、`hub-namespace.ts`、`hub-session-host.ts`、`testing.ts`、peer 侧 | 零 diff（硬门） |

---

## 11. Ruled-out hypotheses

| 假设 | 排除依据 |
| --- | --- |
| 红是环境/依赖缺失（vitest/tsx/cordis 不可用） | 同 run 负控 40 项绿；包全量 90 files/785 tests 绿（§4） |
| 红是夹具/入口错误（Context/Registry/timer 装配不当） | 同探针进程内 listen 模式装配成功且服务在场（NC-1）；runner 同文件负控 35 tests 绿（§13） |
| 已存在等价的免 listen 出口（其他配置键/工厂） | `HUB_CONFIG_KEYS = {listen,tokens,authorization,limits,timeouts}`（`:150`）无第二开关；`HubReplicationPluginOverrides` 无免 listen 开关；公共导出 13 名零命中（§5） |
| 服务轨可由 #420 工厂直接替代（无需插件服务） | ADR 0032:30/:64-66 明示「SessionHost 双轨（工厂 + 免 listen 插件服务）」，服务轨是 T5 交付；工厂面无 Cordis 服务发布/注入 ctx 依赖/teardown 编排 |
| `settled` 信号可作 stop 收口判据 | **实测反例**：连接级 close 不发射 `settled`（E2e；源码 :1204-1212 不经 `notifySettled`） |
| 免 listen 模式应继续要求 tokens/authorization | 与 ADR 0032:65 + 简报 :17 直接矛盾（认证授权是 edge 侧职责） |
| 两入口（复制服务 + SessionHost 服务）可并存 | 简报 :17「SessionHost 服务仅免 listen 模式提供（两入口并存属非法形态）」+ ADR 0032:30 |

---

## 12. Acceptance contract and test paths

### 12.0 交付路径与门禁

- 运行时验收测试：`packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts`
- 类型冻结测试：`packages/ws-replication/test/ws-replication-issue422-session-host-api.test-d.ts`
- 冻结本契约的逐条形态（SA6 已实跑的同一份代码，供实现票按原路径落盘）：
  `artifacts/sa6-issue422-contract-suite/*.test.ts` / `*.test-d.ts`
- 夹具零新增（复用 `test/harness.ts` 的真 Registry/Runtime + `makeNode`/`makeHubNamespace`/`settleUntil`；
  文件内局部 `effectTimer` 与 `proxy registry` 仅计数注入，无协议决策）。
- 运行命令（实现后逐条执行并把日志登记进交付说明）：
  - `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication/test`
  - `pnpm exec tsc -p packages/ws-replication/tsconfig.json`
  - `pnpm test`（根；`--typecheck`）与 `pnpm typecheck`（15 tsconfig 串行）
- 纪律：`skip/only/todo`、env override、fallback、吞错、软化断言全部禁止；断言全部为运行时行为/
  可观察边沿（类型面由 test-d + `@ts-expect-error` 自证）。**不得**以源码字符串/正则断言替代行为验证
  （唯一例外 = §12.3 的补充结构门 NC-6，其行为判据 CAP-9/CAP-10 同时存在且互不替代）。

### 12.1 AC1（前半）— 公共面冻结（test-d 锁定）

**冻结声明（逐字，实现必须逐字段一致）**：

```ts
// packages/ws-replication/src/plugin.ts（增量；既有成员零改名零删除）
import type { Context } from '@deepseek-ai/cordis';
import type { HubSessionHost } from './hub-session-host.js'; // #420 已冻结工厂面

export const NOMICORE_HUB_SESSION_HOST_SERVICE = 'nomicoreHubSessionHost' as const;

export interface HubReplicationPluginConfig {
  /** 唯一改动：联合追加精确 `false`（免 listen 模式）；listen 模式分支类型逐字节不变。 */
  readonly listen: Readonly<{ readonly host: string; readonly port: number; readonly path?: string }> | false;
  readonly tokens?: readonly HubStaticToken[];
  readonly authorization?: readonly HubStaticAuthorization[];
  readonly limits?: Readonly<Partial<ReplicationLimits>>;
  readonly timeouts?: Readonly<Partial<ReplicationTimeouts>>;
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

export function requireHubSessionHost(ctx: Context): HubSessionHostService;

declare module '@deepseek-ai/cordis' {
  interface Context {
    nomicoreHubReplication: HubReplicationService;
    nomicoreHubSessionHost: HubSessionHostService; // ← 新增行（仅此处追加）
    nomicorePeerReplication: PeerReplicationService;
  }
}
```

`src/index.ts` 追加（排序插入；既有 13 名零改名零删除）：

```ts
export { NOMICORE_HUB_SESSION_HOST_SERVICE, requireHubSessionHost } from './plugin.js';
export type { HubSessionHostService, HubSessionHostStatus } from './plugin.js';
```

**test-d 锁定项**（`…issue422-session-host-api.test-d.ts`；SA6 已实跑同一形态）：

| # | 正向锁定 | 负控（`@ts-expect-error` 必填，未触发即 TS2578） |
| --- | --- | --- |
| T1 | `false` 可赋给 `HubReplicationPluginConfig['listen']`；`{listen:false}` 字面量零 cast 通过；`{listen:{host,port}}` 仍通过 | `{listen:'false'}` / `{listen:0}` / `{listen:null}` / `{listen:undefined}` / `{listen:{…,lisen:false}}` 均不得通过 |
| T2 | `NOMICORE_HUB_SESSION_HOST_SERVICE` 精确等于字面量 `'nomicoreHubSessionHost'` | — |
| T3 | `requireHubSessionHost(ctx) → HubSessionHostService`；`ctx.get('nomicoreHubSessionHost')` 精确等于 `HubSessionHostService \| undefined`（模块增强） | — |
| T4 | `HubSessionHostService extends HubSessionHost`；`open → HubSessionHandle`；`status → HubSessionHostStatus`；`state → 'ready'\|'stopped'`；`sessions → number`；`stop → Promise<void>` | `service.requestReauth(…)` 不得存在（连接级成员不混入）；`status.state = 'running'` 不得通过 |

### 12.2 AC1（后半）— `listen: false` 装配 + 服务可用 + 真会话 + 注入面

| # | 断言（运行时行为） | HEAD | 目标 |
| --- | --- | --- | --- |
| C1a | `createHubReplicationPlugin({listen:false},{})` 构造**不抛**；`apply(ctx)`（ctx 具备 `nomicoreInstance:hub`/`clock`/`timer`/`nomicoreRegistry`）resolve | 红（TypeError） | 绿 |
| C1b | `requireHubSessionHost(ctx)` 返回服务且 `typeof service.open === 'function'`；`service.status` 恰为 `{state:'ready',sessions:0}` | 红 | 绿 |
| C1c | 经服务 `open({connectionKey,remoteInstanceId,namespaceId,authorization:ok-投影,selectedCapabilities:0})` → `handleFrame(encodeMessage(OPEN_NAMESPACE,{sequence:1}))` → `onFrame` 收到 `OPEN_OK`（占位 sequence=0） | 红 | 绿 |
| C1d | **注入面**：`registry.open(localOwner=authorization.localOwner, nsId)` 恰一次（ctx Registry）；session 定时器被 arm 且 `timeouts.bootstrapTimeoutMs` 原值到达（探针 E1f 证明可达）；`overrides.observer` 收到 `side:'hub'` 事件 | 红 | 绿 |
| C1e | 角色纪律不变：`nomicoreInstance.role === 'peer'` 时 `apply` 同步抛 `/requires instance role "hub"/`，零 listener/零服务 | 红（构造先抛 TypeError） | 绿 |
| C1f | 类型面：§12.1 T1–T4 全绿（`tsc` 0 错 + `@ts-expect-error` 全被触发） | 红（7 × TS2305/2724 + TS2322） | 绿 |

### 12.3 AC2 — 免 listen 模式零 listener、零网络面

| # | 断言 | 形态 | HEAD / 目标 |
| --- | --- | --- | --- |
| C2a | 注入 `overrides.listen.listen` spy 后（**契约决定 D1：该 override 在免 listen 模式不被消费，零调用**）装配成功且 spy 调用数 0 | 行为（承重） | 红 / 绿 |
| C2b | `plugin.listener === undefined` 且 `plugin.replication === undefined`（白盒面恒 undefined） | 行为 | 红 / 绿 |
| C2c | 无 adapter 时构造**不得**抛 `listen adapter is required` | 行为 | 红 / 绿 |
| C2d | 补充结构门 NC-6：`src/**` + `package.json` 对网络/socket API 命中 0 | 结构（补充；行为由 C2a/C2b 承担） | 绿（须保持） |

> 「零网络面」的最终承载者是宿主（nomicore 只经 `HubListenAdapter` 缝）；nomicore 侧的契约是
> **adapter 零调用 + 零网络 API 引用**这两条可判据。

### 12.4 AC3 — 免 listen 模式不提供 `nomicoreHubReplication`

| # | 断言 | HEAD | 目标 |
| --- | --- | --- | --- |
| C3a | `ctx.get('nomicoreHubReplication') === undefined` | 红（不可达装配） | 绿 |
| C3b | `requireHubReplication(ctx)` 抛 `/unavailable/`（消费方得到服务不可用错误） | 红 | 绿 |
| C3c | 服务面不混入连接级成员（test-d 负控 `requestReauth`；运行时 `typeof service.requestReauth === 'undefined'`） | 红 | 绿 |

### 12.5 AC4 — listen 模式既有行为逐字节不变（回归）

| # | 断言 | HEAD | 目标 |
| --- | --- | --- | --- |
| C4a | `test/ws-replication-plugin.test.ts` 15 tests 断言逐字不变且全绿 | 绿 | 绿 |
| C4b | 包全量 `vitest run --typecheck packages/ws-replication/test` 90 files/785 tests 绿（基线 §4） | 绿 | 绿 |
| C4c | listen 模式：adapter 恰调用一次、`plugin.listener` 在场、`nomicoreHubReplication.status === {state:'ready',connections:0}` | 绿 | 绿 |
| C4d | listen 模式：`ctx.get('nomicoreHubSessionHost') === undefined`（两入口并存属非法形态） | 绿 | 绿 |
| C4e | listen 模式要求链（NC-4a/b/c/d）与凭据不回显（NC-5）逐项不变 | 绿 | 绿 |
| C4f | 授权编辑：`FROZEN_PRODUCTION_EXPORTS` 追加 `NOMICORE_HUB_SESSION_HOST_SERVICE`、`requireHubSessionHost`（排序插入、零删除/零重排）；公共入口 `Object.keys(...).sort()` 与之一致 | 绿（追加后） | 绿 |

### 12.6 AC5 — 非法配置构造期响亮 TypeError，无静默降级

| # | 断言 | HEAD | 目标 |
| --- | --- | --- | --- |
| C5a | NC-3 ×16：仅**精确 `false`** 选择免 listen；`lisen`（拼写键）、`'false'`、`0`、`''`、`null`、`undefined`、`NaN`、`1`、`true`、`[]`、`{}`、缺 host/port、空 host、端口越界、path 非绝对、嵌套拼写键 → `TypeError` 且消息含 `hub replication` | 绿 | 绿 |
| C5b | NC-3b ×16：同批形态在「其余配置全部合法」时仍必须 `TypeError`（**静默降级敏感性锚**，M1 实证） | 绿 | 绿 |
| C5c | 实现后新增 listen 模式分支不得放宽既有断言（M2/M3 实证 NC-4a/NC-4b 敏感） | 绿 | 绿 |

### 12.7 AC6 — teardown 纪律：会话全部收口、timer 清零

| # | 断言 | HEAD | 目标 |
| --- | --- | --- | --- |
| C6a | `service.stop()` 幂等（二次调用返回同一 promise）；`await` 后每个经服务开启的会话进入通道终态（observer `channel-state-changed{side:'hub',namespaceId,to:'closed'}`） | 红 | 绿 |
| C6b | `stop()` 后 `service.status` 恰为 `{state:'stopped',sessions:0}`；`service.open(...)` 响亮抛错（停止后不再接纳新会话） | 红 | 绿 |
| C6c | `stop()` 后插件 OwnedTimer 清零（`timer.active.size === 0`）；`ctx.fiber.dispose()` 走 effect 反向 yield：服务撤销（`requireHubSessionHost` 抛 `/unavailable/`）、timer 保持 0、零 listener 残留 | 红 | 绿 |
| C6d | **不得**以 `settled` 信号作为 stop 收口判据（C1 实测：连接级 close 不发射 settled） | — | 事实登记 |

### 12.8 红/绿期望矩阵与授权编辑

| 验收件 | 旧实现（HEAD `4ad13a3`） | 目标实现 | 实测证据 |
| --- | --- | --- | --- |
| §12.2 C1a–C1f（运行时） | **红**：`TypeError: hub replication listen: invalid configuration`（`plugin.ts:163`/`:292`） | 绿 | `artifacts/sa6-issue422-runner-trigger-red.log`（2 tests 红、同因）；探针 `CAP-1..CAP-13` |
| §12.1 test-d（类型锁） | **红**：TS2724/TS2305 ×4 名 + TS2322（`listen:false`）+ 2 × TS2578（指令未触发） | 绿：0 错 + 负控全触发 | `artifacts/sa6-issue422-type-lock-red.log`（7 错，exit 2）；`…package-tsc-red.log`（16 错，exit 2） |
| §12.3–§12.4（零 listener/零复制服务） | **红**：装配不可达（同 C1a） | 绿 | 探查 `CAP-8/9/10` |
| §12.5（listen 回归） | 绿（须保持） | 绿 | `artifacts/sa6-issue422-baseline-package-suite.log`（785 绿）；runner 负控 35 tests 绿 |
| §12.6（非法形态） | 绿（须保持） | 绿 | 探针 `NC-3/NC-3b/NC-4/NC-5` 40/53 PASS |
| §12.7（teardown） | **红**：服务不存在 | 绿 | 可达性探针 `E2a–E2e`（13/13） |

**授权的既有测试编辑（除此外既有测试文件零改动）**：

1. `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts:144-158`
   `FROZEN_PRODUCTION_EXPORTS` 追加 `NOMICORE_HUB_SESSION_HOST_SERVICE`（排在
   `NOMICORE_HUB_REPLICATION_SERVICE` 之后）与 `requireHubSessionHost`（排在 `requireHubReplication`
   之后）；零删除、零重排；`:553` 的断言形态逐字不变（先例：#420 §12.6、#421 实施）。
2. 其余既有测试（含 `ws-replication-plugin.test.ts`）**逐字不变**——AC4 的「逐字节不变」由它们背书。

### 12.9 Runner 触发与发现机制

- `vitest.config.ts:15` `include: ['packages/*/test/**/*.test.ts', …]` ⇒ §12.0 的运行时文件由
  `pnpm test`（`NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`）与
  `vitest run <path>` 发现；
- `vitest.config.ts:20` `typecheck.include: ['packages/*/test/**/*.test-d.ts']` + `tsconfig.typecheck.json`
  （`packages/*/test/**/*.ts`）⇒ §12.1 的 test-d 由 `--typecheck` 收集；同时
  `tsc -p packages/ws-replication/tsconfig.json`（`include: ["src/**/*.ts","test/**/*.ts"]`）二次把关。

---

## 13. Red/green or baseline evidence

| 证据 | 文件 | 结果 |
| --- | --- | --- |
| 包全量基线（clean tree） | `artifacts/sa6-issue422-baseline-package-suite.log` | 90 files / 785 tests passed，Type Errors none，exit 0 |
| 清理后门禁复跑 | `artifacts/sa6-issue422-post-cleanup-gates.log` | `tsc` exit 0 + 90 files / 785 tests，exit 0 |
| 能力缺口探针（含负控） | `artifacts/sa6-issue422-capability-gap-probe.log` | `PROBE_RESULT 40/53`；13 项 CAP 全红（能力缺口 CONFIRMED）、40 项 NC 全绿 |
| 可达性/因果探针 | `artifacts/sa6-issue422-causal-feasibility-probe.log` | `PROBE_RESULT 13/13`（含 E1f 配置 plumb、E2e 零 settled 反例、E3a 负控） |
| 类型层红灯（test-d 形态） | `artifacts/sa6-issue422-type-lock-red.log` | 7 × TS 错，`[tsc exit: 2]` |
| 包 tsc 红灯（契约路径在场） | `artifacts/sa6-issue422-package-tsc-red.log` | 16 × TS 错，`[tsc exit: 2]` |
| **Runner 触发 + 红因 + 负控** | `artifacts/sa6-issue422-runner-trigger-red.log` | 2 files failed；`Tests 4 failed \| 35 passed (39)`；`Type Errors 2 failed`；`vitest exit 1`。4 条红 = 2 × 运行时（逐条 `TypeError: hub replication listen: invalid configuration` @ `plugin.ts:163`）+ 2 × test-d（TypeCheckError）；35 条绿 = NC-3×16 + NC-3b×16 + 要求链 + listen 回归 + 结构门 |
| 变异敏感性 | `artifacts/sa6-issue422-mutation-sensitivity.log` | `MUTATION_RESULT 4/4 expected`，exit 0 |
| 3× 稳定性 | `artifacts/sa6-issue422-stability-3x.log` | 能力探针 3 轮同 `40/53` + 同 `FAILED_IDS`；可达性探针 3 轮 `13/13` |
| 最终清洁态 | `artifacts/sa6-issue422-final-clean-state.log` | `git status` 仅 untracked artifacts/ + 既有 brief；`tsc` exit 0；`.scratch/sa6-422` 不存在；测试路径 422 命中 0 |

红因判定：runner 红是**能力缺口**而非环境/夹具/入口——同一 run、同一文件、同一导入机制下 35 条负控
（含 listen 模式全回合装配）全绿，且红因堆栈单点落在 `validateHubConfig`（`plugin.ts:292`）的
`assertRecord`（`:163`）。

---

## 14. Runner trigger evidence

- **发现机制**：见 §12.9；SA6 已实跑：把 `artifacts/sa6-issue422-contract-suite/` 的两个文件复制到
  契约路径 → `vitest run --typecheck <两路径>` → `Test Files 2 failed (2)` /
  `Tests 4 failed | 35 passed (39)` / `Type Errors 2 failed` / `vitest exit 1`；同一批文件在
  `tsc -p packages/ws-replication/tsconfig.json` 下报 16 错（exit 2）。日志：
  `artifacts/sa6-issue422-runner-trigger-red.log`、`…package-tsc-red.log`。
- **反空跑**：负控组自身即「非空跑」证据——NC-1 用同一 Context 夹具跑通 listen 模式全装配并断言
  adapter 恰一次、服务在场；NC-3/NC-3b 断言由 `plugin.ts` 真实校验路径抛出（堆栈可读）。
- **实现后须执行的触发命令**：§12.0；并须追加 `pnpm test`（根）与 `pnpm typecheck`（根）的日志。
- 临时文件已删除（§16）：`ls packages/ws-replication/test | grep -c 422` = 0。

---

## 15. Unknowns and blockers

| # | 项 | 状态/要求 |
| --- | --- | --- |
| U1 | **本票无 SA8 门禁产物**（无 `relevant_decisions`/`conflict_report`） | 本契约的决策摘录由 SA6 直接取证（§1/§3）。实现合入前应补 SA8 clear（#418 R5''/R7'' 与兄弟票 A6 范围跟踪口径）；若 SA8 对 §12.1 冻结面有异议，走 conflict 流程而非静默改契约 |
| U2 | 免 listen 模式**同时提供** `tokens`/`authorization`/`verifyToken`/`authorize` 的合法性 | 契约只冻结「**不再要求**」（省略必合法）与「免 listen 模式不得调用 authenticate/authorize（edge 侧职责）」。提供时的处置（是否仍做形状校验 / 是否响亮拒绝）**留给 design 决策**，本契约不设断言，避免以未决点制造伪红 |
| U3 | `overrides.listen` 在 `listen:false` 下的处置 | **契约冻结 D1：不被消费、零调用**（宿主组合根可能统一传 overrides；「非法形态」条款只约束服务面）。若 design 选择响亮拒绝该组合，须走 conflict 流程并同步 §12.3 C2a |
| U4 | SessionHost 服务成员集 | 冻结 `open`（= #420 `HubSessionHost` 面）+ `status` + `stop`；**append-only 演进**（ADR 0032 后果节）。连接级成员（`requestReauth` 等）不得混入（§12.4 C3c） |
| U5 | 真 worker/异步 pipe 形态（跨线程 pending 有界、异步序回传） | 仍是后续票（ADR 决策 5 γ；#418 R4''/R5''）；本票只交付进程内 SessionHost 工厂的插件服务面 |
| U6 | 服务面聚合（connections/revoke 广播/close 全量） | #421 设计 §13 follow-up (e)；本票不预留 |
| U7 | 文档面 | ADR 0032 已登记 `listen:false`/服务名（:30,:64-66），协议 §17/:833 已登记分片形态；如需在 CONTEXT.md 补「SessionHost 服务」消费词条，属 design 决策（不得与 ADR 冲突） |
| U8 | 插件 `inject` 面 | 保持 `['nomicoreInstance','clock','timer','nomicoreRegistry']` 不变（免 listen 模式同样消费四者；observer 走上游 override 注入，非 Cordis 服务） |

---

## 16. Temporary diagnostics cleanup

| 项 | 处置 |
| --- | --- |
| 临时契约测试文件（`packages/ws-replication/test/ws-replication-issue422-{listen-false.test.ts,session-host-api.test-d.ts}`） | **已删除**；逐条形态保留在 `artifacts/sa6-issue422-contract-suite/`（`artifacts/` 不在任何 vitest/tsc include 内，零门禁污染）；`ls packages/ws-replication/test \| grep -c 422` = 0 |
| 变异副本 | **已删除**：`.scratch/sa6-422/mutants/**`（驱动内 `rm -rf`，收尾核验 `.scratch/sa6-422` 不存在） |
| 生产代码/既有测试/文档 | **零改动**：`git status --short` 仅 untracked `artifacts/sa6-issue422-*` + 既有未跟踪 `wiki/raw/task_issue-422.md`；`packages/**`、`docs/**`、`CONTEXT.md` 无 diff |
| 长驻服务/后台作业 | 无（探针为一次性前台命令；vitest 无 watch；无 nohup/setsid/PID 文件/轮询）；收尾前已确认全部 background job 结束 |
| 保留的诊断资产（非临时） | `artifacts/sa6-issue422-{capability-gap,causal-feasibility}-probe.mts` + `.log`、`artifacts/sa6-issue422-mutation-driver.mts` + `.log`、`artifacts/sa6-issue422-type-lock-probe/{probe.ts,tsconfig.json}`、`artifacts/sa6-issue422-{type-lock-red,package-tsc-red,runner-trigger-red,baseline-package-suite,post-cleanup-gates,stability-3x,final-clean-state}.log`、`artifacts/sa6-issue422-contract-suite/**` |

复现命令（全部前台、可重复）：

```bash
# 环境
pnpm install --offline --frozen-lockfile
# 能力缺口（含负控；有缺口时 exit 0 = CONFIRMED）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa6-issue422-capability-gap-probe.mts
# 可达性/因果
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa6-issue422-causal-feasibility-probe.mts
# 类型锁红灯
pnpm exec tsc -p artifacts/sa6-issue422-type-lock-probe/tsconfig.json
# 变异敏感性（4/4 expected）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa6-issue422-mutation-driver.mts
# runner 触发（契约路径版）
cp artifacts/sa6-issue422-contract-suite/*.test.ts artifacts/sa6-issue422-contract-suite/*.test-d.ts packages/ws-replication/test/
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts packages/ws-replication/test/ws-replication-issue422-session-host-api.test-d.ts
rm packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts packages/ws-replication/test/ws-replication-issue422-session-host-api.test-d.ts
```

---

## 附：artifactPaths（worktree-relative）

```text
wiki/raw/task_issue-422_sa6_contract.md
artifacts/sa6-issue422-capability-gap-probe.mts
artifacts/sa6-issue422-capability-gap-probe.log
artifacts/sa6-issue422-causal-feasibility-probe.mts
artifacts/sa6-issue422-causal-feasibility-probe.log
artifacts/sa6-issue422-mutation-driver.mts
artifacts/sa6-issue422-mutation-sensitivity.log
artifacts/sa6-issue422-type-lock-probe/tsconfig.json
artifacts/sa6-issue422-type-lock-probe/probe.ts
artifacts/sa6-issue422-type-lock-red.log
artifacts/sa6-issue422-package-tsc-red.log
artifacts/sa6-issue422-runner-trigger-red.log
artifacts/sa6-issue422-baseline-package-suite.log
artifacts/sa6-issue422-post-cleanup-gates.log
artifacts/sa6-issue422-stability-3x.log
artifacts/sa6-issue422-final-clean-state.log
artifacts/sa6-issue422-contract-suite/ws-replication-issue422-listen-false.test.ts
artifacts/sa6-issue422-contract-suite/ws-replication-issue422-session-host-api.test-d.ts
```
