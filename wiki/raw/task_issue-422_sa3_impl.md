# SA3 Implementation Report — issue #422

- 任务：hub 插件免 listen 模式（`listen: false`）与 `nomicoreHubSessionHost` 服务（spec #415 T5）
- 依据：`wiki/raw/task_issue-422_design.md`（iteration 1，SA2 approve）+ `wiki/raw/task_issue-422_sa6_contract.md`（approve 红灯契约）+ `wiki/raw/task_issue-422_design_conflict_report.md`（clear；R1–R4 为规范性约束）
- HEAD：`4ad13a3`（工作树仅本票变更 + 未跟踪 artifacts/wiki）
- 状态：实现完成；红灯契约转绿；受影响 package typecheck、package 全量、根 `pnpm typecheck`/`pnpm test` 全绿。

## Inputs consumed

| 输入 | 路径 | 用途 |
| --- | --- | --- |
| 任务简报 | `wiki/raw/task_issue-422.md` | AC1–AC6；Issue 评论为空（无 Owner 要求） |
| 批准设计（iteration 1） | `wiki/raw/task_issue-422_design.md` | D1–D9、§11 ALLOW/DENY、§12 验收映射、§7.6 D7（SA2 F1 修订） |
| SA2 评审 | `wiki/raw/task_issue-422_sa2_review.md` | F1（已闭合）与 OBS-1–OBS-12 处置口径 |
| SA6 契约 | `wiki/raw/task_issue-422_sa6_contract.md` | §12.0 交付路径、§12.1–§12.8 冻结形态、§12.8 授权编辑 |
| 契约套件基底 | `artifacts/sa6-issue422-contract-suite/*.test.ts` / `*.test-d.ts` | 落盘新测试的同源基底（冻结断言逐字保留） |
| 设计后冲突门禁 | `wiki/raw/task_issue-422_design_conflict_report.md` | R1（实现后复查清单）/R2（文档同变更集）/R3（宿主侧文档观察项）/R4（合入前 SA8 clear 未闭合） |
| 源码锚点 | `src/{plugin,index,hub-session-host,defaults,validate}.ts`、`hub-connection.ts:74-114`、`test/ws-replication-plugin.test.ts`、`test/ws-replication-issue418-*.test.ts` | 实现面/组合根先例/冻结清单/AC4 背书体 |

缺失输入：`task_issue-422_relevant_decisions.md`/`task_issue-422_conflict_report.md`（契约 U1 已登记，合入前 SA8 义务开放，§13-F1/R4）；`task_issue-422_sa3_impl.md` 此前不存在（本文件为原位首版）。

## Existing worktree reconciliation

- 实现前工作树**无**本票生产改动：`git status` 仅 SA6 未跟踪 artifacts、`wiki/raw/task_issue-422*` 五件与本票无关的既有未跟踪项；`packages/**`、`CONTEXT.md`、`docs/**` 零 diff（与 SA6 §16 最终清洁态一致）。
- 无历史 SA3 实现需要保留/修正；本次为唯一实现集（7 个 ALLOW 路径 + 证据日志）。
- 临时变异副本（F1 敏感性探针）落在 `.scratch/sa3-422/`，探针结束已 `rm -rf`；生产文件经 md5 校验原位还原（见 §Verification）。

## Changed paths

| Path | Design section | Change |
| --- | --- | --- |
| `packages/ws-replication/src/plugin.ts` | §7.1 D1、§7.2 D2、§7.3 D3、§7.4 D5、§7.5 D6、§7.6 D7、§7.7 D8 | 纯追加 + listen 模式引用改名（详见下） |
| `packages/ws-replication/src/index.ts` | §7.7 D8、§12.1 | +1 值导出语句（`NOMICORE_HUB_SESSION_HOST_SERVICE`/`requireHubSessionHost`）+1 类型导出语句（`HubSessionHostService`/`HubSessionHostStatus`）；既有 13 名零改名零删除 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | §7.7、§12.8 | `FROZEN_PRODUCTION_EXPORTS` 排序插入 2 名（各带一行来源注释）；零删除、零重排；`:553` 断言形态逐字未动 |
| `packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts`（新增） | §12.0/§12.2–§12.7 + SA2 F1(4) | 契约套件逐字落盘（相对 artifacts 基底 diff 仅头部 doc 注释）+ **追加** C5d–C5g 值域负控 5 × `it` |
| `packages/ws-replication/test/ws-replication-issue422-session-host-api.test-d.ts`（新增） | §12.1（T1–T4） | 契约套件逐字落盘（相对 artifacts 基底仅头部 doc 注释差异；断言体 md5 一致） |
| `packages/ws-replication/README.md` | §11 ALLOW（docs/AGENTS 行为同步义务） | Cordis plugins 节 `createHubReplicationPlugin` 条目后追加免 listen 条目（复述 ADR 0032:30/:64-66） |
| `CONTEXT.md` | §11 ALLOW/U7 | SessionHost 词条正文追加插件轨登记一句 + `_Avoid_` 追加两条（仅精确 `false`；两入口并存非法） |
| `artifacts/sa3-issue422-{red,focused-green,mutation-sensitivity,package-suite,root-gates}.log`（新增，未跟踪证据） | — | 红/绿/变异/包全量/根门禁日志（非实现路径） |

`plugin.ts` 增量明细：

1. import：`resolveLimits`/`resolveTimeouts`（`defaults.ts`）、`createHubSessionHost` + 类型（`hub-session-host.ts`）、`validate.ts` 五校验器（**纯 import，validate.ts 零编辑**）。
2. `NOMICORE_HUB_SESSION_HOST_SERVICE = 'nomicoreHubSessionHost'`；`listen` 联合仅追加 `| false`（listen 分支类型逐字不变）。
3. 新类型 `HubSessionHostStatus`（`state:'ready'|'stopped'` + `sessions`）/ `HubSessionHostService extends HubSessionHost`（`status` + `stop()`）；模块增强新增 `nomicoreHubSessionHost: HubSessionHostService` 一行。
4. `requireHubSessionHost(ctx)`：镜像 `requireHubReplication`，缺席/撤销 → `Error('required Cordis service "nomicoreHubSessionHost" is unavailable')`。
5. `validateHubConfig`：两条通用 record 断言之后插入 **`config.listen === false` 严格相等分派** → `validateHubSessionOnlyConfig` 后 `return`；listen 断言链 `:292-316` 零删除、零重排、零消息变化。
6. `validateHubSessionOnlyConfig`（新，私有）：子序列顺序镜像 listen 模式（tokens/authorization 形状 → limits/timeouts records → verifyToken/authorize/listen 形状 → observer）；**不要求** listen 形状/adapter/tokens/authorization；提供 `overrides.listen` 时同款形状校验但零消费（D4「校验 ≠ 消费」）。
7. 工厂绑定：`const endpoint = config.listen === false ? undefined : config.listen;` + `listenMode` 条件绑定（免 listen 模式**不构造** staticVerifier/staticAuthorizer/adapter 闭包——ADR 0032:65）。
8. `start()`：免 listen 模式（`listenMode === undefined`）→ `startHubSessionHostService(...) ; return`；listen 模式主体仅引用改名（`listenMode.verifyToken`/`.authorize`/`.listen`/`.endpoint.{host,port,path}`），表达式/调用次序/消息逐字保持（`git diff` 可核）。
9. `startHubSessionHostService`（新，嵌套于工厂内——SA2 OBS-6 采纳）：`resolveLimits`/`resolveTimeouts` → `validateLimits`/`validateTimeouts`（无条件）→ 分块族三链**显式激活窄门**（`hasOwnProperty` 命中 `maxChunkedUpdateBytes`∨`maxChunksPerUpdate` → transfer 链；`maxChunkedBootstrapBytes` → bootstrap 链；`maxChunkedSyncDiffBytes` → sync-diff 链；门输入 = 同一 `mergeNested` 结果，与 `hub-connection.ts:85-100` 键集/判据等价）→ `createHubSessionHost`（注入 registry/instanceId/已解析已校验 limits+timeouts/OwnedTimer/observer/clock）→ 会话台账（键 `${connectionKey}\u0000${namespaceId}` 与工厂同构）+ 5 成员全委托包装句柄（`close`/`terminateUnauthorized` 记账级 memoize，fulfill 才摘账）→ 幂等 `stop()`（`stopped=true` 先行 → `Promise.all(close)` → `finally { timer.dispose(); sessions.clear(); }`）→ `Object.freeze` + getter 服务（ADR 0023）→ `ctx.effect` 反向 yield `[stop, revoke]`。零 listener、零 `nomicoreHubReplication` provide。

## SA2 Finding落实

| Finding ID | Implementation | Result |
| --- | --- | --- |
| **F1（MAJOR，iteration 1 已闭合的四处修订要求）** | (1) §7.4/§7.6 校验半边：`startHubSessionHostService` 顶部 `resolveLimits/resolveTimeouts` + `validateLimits/validateTimeouts` + 分块族三链窄门（纯 import 五函数，零第二套校验）；(2) 时机：全部位于 `start()` 免 listen 分支内同步执行 → async `start()` → `apply()` promise rejection，且先于 `provide`/`effect`（零服务/零会话/零定时器、零清理）；(3) D2 矩阵两层：键表/形状构造期 + 值域装配期；(4) 追加负控块 C5d–C5g 落盘、冻结断言未触碰 | 落实；C5d–C5g 5 项绿；变异探针（临时注释五校验调用）令 C5d/C5e/C5g① 恰转红、C5f/C5g② 保持绿 → 断言敏感 |
| OBS-1（摘账措辞调和） | `stop` 采用「闩锁先行 + `finally` 清零 + rejection 承载失败信号」；个别 close/terminate reject 时保留台账（诚实计数） | 落实（行为符合设计；无新增面） |
| OBS-2 / OBS-9（工厂台账永不摘除） | 不改工厂（DENY）；服务台账与工厂台账同构键、无第二事实源 | 登记（非本票义务，沿设计 §13-F6） |
| OBS-3 / OBS-10（无 Proxy 消费断言） | 非义务：新服务已按 ADR 0023 构造（`Object.freeze` + getter） | 未追加测试（设计明示可选；未扩大 ALLOW） |
| OBS-4 / OBS-11（U2/U3「校验 ≠ 消费」偏严解读） | 维持设计：`overrides.listen` 提供时形状校验、零调用（C2a 绿证明零调用） | 落实 |
| OBS-5 / OBS-12（`requiresConflictRecheck` 措辞越位） | 设计已改；本报告按评审/门禁实际提交口径说明（见 §Deferred verification） | 落实 |
| OBS-6（`startHubSessionHostService` 可见性） | 函数**嵌套于 `createHubReplicationPlugin` 工厂内**（与 `start` 同层），直接消费闭包 `limits`/`timeouts`/`overrides` | 落实 |
| OBS-7（错误消息族措辞精度） | C5d/C5e 断言绑定语义子串（`/bootstrapTimeoutMs/`、`/lowWater/`）而非 `limits:`/`timeouts:` 前缀；实际单字段前缀 = 字段名（`validate.ts:24-26`） | 落实（断言避免错误前缀假设） |
| OBS-8（instanceId 校验不对称） | **未加** `validateInstanceId`（设计标为非义务）：免 listen 分支的 `identity` 来自 `requireNomicoreInstance(ctx)`，`packages/instance` 构造期以同源正则 `^[a-z][a-z0-9-]{0,62}$` 校验（`packages/instance/src/*.ts:26,86-88`），分叉实际不可达 | 已登记推理，零行为差 |

## File scope check

| Changed path | ALLOW entry | Purpose |
| --- | --- | --- |
| `packages/ws-replication/src/plugin.ts` | ALLOW 行 1（D1–D8 全部实现） | 配置联合/校验分派/条件绑定/服务装配/公共面 |
| `packages/ws-replication/src/index.ts` | ALLOW 行 2（§7.7 两条 export） | 公共入口 15 名 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-contract.test.ts` | ALLOW 行 3（§12.8 唯一授权编辑） | 冻结清单追加 2 名 |
| `packages/ws-replication/test/ws-replication-issue422-listen-false.test.ts` | ALLOW 行 4（§12.0 + SA2 F1(4) 追加授权） | 运行时验收 + 值域负控 |
| `packages/ws-replication/test/ws-replication-issue422-session-host-api.test-d.ts` | ALLOW 行 5（§12.1 类型冻结） | test-d 锁定 |
| `packages/ws-replication/README.md` | ALLOW 行 6 | 行为文档同步 |
| `CONTEXT.md` | ALLOW 行 7（U7） | SessionHost 词条登记 |

DENY 核对（`git diff --name-only` 定向查询，输出为空 = 零 diff）：`src/{hub-session-host,hub-session,hub-namespace,hub-split,hub-edge,hub-edge-host,hub-connection,peer-connection,peer-namespace,testing,defaults,validate,types}.ts`、`test/ws-replication-plugin.test.ts` 及其余既有测试、`package.json`、`apps/yjs-server/**`、`docs/adr/**`、`docs/protocols/**`、`docs/integration/**`。

## Verification

| Command | Result | Evidence |
| --- | --- | --- |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck <两份 422 契约路径>`（实现前，红灯） | **红**：`Test Files 2 failed (2)`、`Tests 8 failed | 36 passed (44)`、`Type Errors 2 failed`、exit 1。红因 = 能力缺口（`TypeError: hub replication listen: invalid configuration`；类型面 7×TS2305/2724+TS2322+TS2578）；负控（NC-3/NC-3b ×16、listen 回归、结构门）全绿 | `artifacts/sa3-issue422-red.log` |
| 同上（实现后，绿灯） | **绿**：`Test Files 2 passed (2)`、`Tests 44 passed (44)`、`Type Errors no errors`、exit 0（运行时文件 42 = 冻结 37 + 追加 5） | `artifacts/sa3-issue422-focused-green.log` |
| 变异敏感性（临时注释 5 个 `validate*` 调用 → 跑 422 运行时件 → 经 md5 原位还原） | `Tests 3 failed | 39 passed (42)`：恰 C5d/C5e/C5g① 红；C5f parity 与 C5g②（非激活）保持绿 → F1 校验半边为承重实现、非伪绿。还原后 md5 `379c9459ee8b81686c0ac08b0b19d5bb` 与备份一致、`MUT ` 残留 0 | `artifacts/sa3-issue422-mutation-sensitivity.log` |
| `pnpm exec tsc -p packages/ws-replication/tsconfig.json` | exit 0（还原后复跑仍 0） | 本报告 + 命令输出 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/ws-replication/test`（受影响 package 全量） | **92 files / 829 tests passed**、`Type Errors no errors`、exit 0（基线 90/785 + 新 42 + test-d 2） | `artifacts/sa3-issue422-package-suite.log` |
| `pnpm typecheck`（根，15 tsconfig 串行；设计 §12 明示命令） | exit 0 | `artifacts/sa3-issue422-root-gates.log:1-6` |
| `pnpm test`（根 `--typecheck`；设计 §12 明示命令） | **455 files / 5559 tests passed**、`Type Errors no errors`、exit 0 | `artifacts/sa3-issue422-root-gates.log:7-759` |
| 冻结面核验：`diff` 落盘测试 vs `artifacts/sa6-issue422-contract-suite/*` | 运行时件恰 2 hunk（头部 doc 注释 + 追加块；冻结断言零删除零改写）；test-d 断言体逐字一致（`tail` 比对 exit 0） | 本报告 §Changed paths + 命令输出 |
| 冻结清单核验：418 契约测试（追加 2 名后 17 tests） | 绿（`:553` `Object.keys(productionApi).sort()` 全等断言形态未动） | `artifacts/sa3-issue422-package-suite.log` 内该文件 ✓ |
| AC4 背书：既有 15 项插件测试 + 包全量 + 根 `pnpm test` | 全绿、零改动（`test/ws-replication-plugin.test.ts` 零 diff） | 同上 |

## Deferred verification

- **SA8 R1 实现后冲突复查（未闭合，合入前义务）**：实现 diff 已落地，需按设计 §13/冲突报告 R1 逐项核对——①公共面 13→15 名 append-only（本报告正向证据在场）；②`listen` 联合仅追加 `| false`；③listen 模式校验链/start 主体零重排零消息变化；④免 listen 零 verifier/authorizer 构造、零 `nomicoreHubReplication` provide；⑤服务 `Object.freeze` + getter；⑥DENY 零 diff；⑦**D7 值域半边**（`validate.ts` 纯 import、resolve→validate 次序、三链窄门键集与 `hub-connection.ts:85-100` 逐字节等价、抛错先于 provide、零第二套校验、追加块未触碰冻结断言）；⑧CONTEXT.md/README 追加严格 additive 且与代码同变更集（R2 已满足）。dispatch 前 SA8 门禁产物仍缺失（契约 U1），R4 未清。
- **SA4/SA7 动态验证 / 真实环境验收**：不在 SA3 职责内；本报告仅交付冻结契约红绿、受影响 package typecheck/全量、根门禁与变异敏感性。
- **R3（非阻塞观察）**：`docs/integration/cordis-plugin-hosting.md:179`「Hub plugin 只有在 listener 建立后才发布 ready service」在 `listen:false` 落地后仅对 listen 模式成立 —— 该文档为 DENY（宿主侧后续票 F4），本票未改，留给宿主侧票补模式限定。
- **F2/F3/F4/F5/F6**（设计 §13 残余问题）：后续票/宿主侧，本票零预留，未触碰。

## Deviations or blockers

- 无阻塞、无需设计修订；ALLOW/DENY 边界内完成，未新增公共导出名、未新写第二套校验器、未触碰协议/ADR/工厂冻结面。
- 实现层两处设计留白按 OBS 口径落地并登记：`startHubSessionHostService` 嵌套于工厂（OBS-6）；未加 `validateInstanceId`（OBS-8，非义务，附不可达推理）。
- 追加块相对设计 §12 略有强化：C5d 额外断言 adapter 零调用与 apply 拒绝消息语义子串（`/bootstrapTimeoutMs/`）、C5e/C5f 断言 `/lowWater/` 语义子串——均为既有 D2/C2a 语义，不放松任何冻结断言。
- `requiresConflictRecheck` 与设计 §13「是否需要设计后 ADR 冲突复查：是」及冲突报告 R1/R4 一致：本实现 diff（冻结导出面 13→15、`validate.ts` import 面、免 listen 装配期值域失败类）待 SA8 实现后复查闭合；本报告不代为宣告已清。

## Suggested commit message

```
feat(ws-replication): hub plugin listen:false session-only mode + nomicoreHubSessionHost service

- HubReplicationPluginConfig.listen accepts exact `false` (strict equality only; no falsy shortcut)
- session-only assembly: zero listener, no tokens/authorization/verifyToken/authorize requirement,
  no nomicoreHubReplication provide; publishes nomicoreHubSessionHost (open + status + idempotent stop)
- composition-root discipline: resolveLimits/resolveTimeouts + validate.ts validators (incl. explicit
  chunked-family activation gates) before createHubSessionHost; failures reject apply() before provide
- public surface append-only: +1 const, +1 require fn, +2 types, module augmentation line, index exports
- frozen export list (#418 contract) appends NOMICORE_HUB_SESSION_HOST_SERVICE / requireHubSessionHost
- tests: issue422 runtime contract (frozen SA6 assertions + C5d–C5g value-domain negative controls)
  and test-d type lock; docs: README + CONTEXT.md SessionHost entry
```
