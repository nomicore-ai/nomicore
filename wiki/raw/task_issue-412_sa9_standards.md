# SA9 Standards Review — issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦 + 停机硬契约）

- 任务：issue #412（standards-review，iteration 0）
- 审查对象：**最终已提交 diff**——commit `1fef4348dad49eb6c2891ca48d89013974b5b952`（`feat(persistence): add completion drain lifecycle`），权威基线 `main@c3f7bd9e474d465e95e870def353a65c70363076`，分支 `mabf/issue-412`
- 适用 Owner 要求：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`（MEMBER）——graceful-shutdown 的 **drain-before-dispose 硬契约** 与 **ADR-0006 对齐**（dispose 保持 abortive 时保留分层公开 drain）
- 审查纪律：静态标准审查（不运行测试、不启动服务、不修改代码/设计/测试、不调度其他 SA）；范围 = 仓库/工程标准符合性，不审查 Issue 需求是否完整实现（SA10 面）

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| 最终 diff（`git diff c3f7bd9..HEAD`，25 文件，+3397/−52） | 全量逐行核对 | 被审对象 |
| `wiki/raw/task_issue-412.md`（Host brief） | 已读 | Issue 请求面 |
| `wiki/raw/task_issue-412_design.md`（iteration 2，SA2 approve） | 已读（全 558 行） | 批准设计：DD-1~DD-8、§11 ALLOW/DENY |
| `wiki/raw/task_issue-412_sa6_contract.md`（approve） | 已读 | 契约 C1–C14、冻结审计裁决 |
| `wiki/raw/task_issue-412_sa2_review.md`（iteration 2 approve） | 已读 | SA2-1~SA2-13 落实基准 |
| `wiki/raw/task_issue-412_sa3_impl.md` | 已读 | 实现申报（验证证据不独立复跑） |
| `wiki/raw/task_issue-412_sa4_review.md`（approve） | 已读 | 实现质量结论与 MINOR 清单 |
| `wiki/raw/task_issue-412_design_conflict_report.md` / `..._implementation_conflict_report.md`（SA8，均 clear） | 已读 | ADR 冲突门禁结论、F1 记录 |
| 模块 AGENTS（root / docs / persistence / dsh-persistence / apps / apps-yjs-server） | 已读 | 标准裁决依据 |
| ADR 0006（含新修订节）、CONTEXT.md、hub-peer-deployment.md、cordis-plugin-hosting.md | 已读（diff + 上下文） | 规范同步核对 |
| `vitest.config.ts`、root `package.json` scripts | 已读 | runner 发现与验证门 |

## 2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；6 × MINOR 全部非阻断，见 §10）。

核心判定：实现与 iteration 2 批准设计逐条一致；Owner 硬契约与 ADR-0006 对齐要求在**规范条款（ADR 修订节第 3/4 条）、对外指引（cordis-plugin-hosting）、自家实现（app.ts 停机链 file/memory 统一）、验收证据（S-5a/S-5b/S-5c）**四个面上给出同一个答案；模块责任、单一事实源、生命周期对称性、文件范围、测试质量全部符合仓库 AGENTS 与既有惯例。

## 3. Owner 要求（comment 5751613018）标准符合性

| 要求 | 证据 | 判定 |
| --- | --- | --- |
| graceful shutdown 必须有 await-drain-before-dispose **硬契约** | ① ADR 0006 修订节第 3 条（:270-274）：无条件条款 + 「预算尽后继续 dispose 是显式可观察退出，不是违约」+ 未 drain 直接 dispose 的代价申明；② app.ts:618-632 结构性强制——`persistenceFiber.dispose()`（3b）唯一调用点在 `awaitDrainWithBudget(adapter.drain(), budgetMs)` await 之后，两出口 = 完成或预算事件已发射；③ cordis-plugin-hosting.md:64/:458-478 对仓库外宿主同款硬契约 + 示例代码块演示有界 drain | **符合**（成文 + 结构性执行 + 对外指引三方一致，不以 adapter 类型特判——SA2-7 路径 (b) 在实现面兑现：`kind === 'file'` 守卫确认删除） |
| ADR-0006 dispose 语义/契约必须对齐 | 修订节第 4 条（:276）以约束性语气「本节**修订并扩展** :86 的 dispose 定义边界」（issue #79 引用式修订惯例）；dispose 保持 abortive/有损（§228-5 重申）、「从来不是持久性屏障」、持久性唯一经分层 drain 表达；diff 核实 dispose 段唯一变化 = 通知点 2 抽为 `releaseSettleWaiters`（`splice(0)` + 同步 call 逐字节等价） | **符合** |
| dispose 保持 abortive 时保留**分层公开 drain** | `DocPersistence.drain?` optional 分层成员（contract.ts:149-176，importDoc/archiveDoc/probe/deleteDoc 同款放置先例）；drain 未并入 dispose；「dispose 内部先 drain」备选否决论证入 ADR 第 4 条 | **符合** |

## 4. 仓库 AGENTS 符合性

| AGENTS 条款 | 核对结果 |
| --- | --- |
| root：改 `packages/`、`apps/`、`docs/` 前读最近嵌套 AGENTS | 过程产物证实各 SA 已读；本审查逐条对照 |
| persistence：公共导出经 `src/index.ts` | ✅ `type PersistenceDrainTarget` 经 barrel 导出（index.ts:37） |
| persistence：两 adapter 满足同一契约；I/O 细节不外泄 | ✅ drain 状态机单点落 `PersistenceLifecycle`（ADR 0006:157-159）；Memory/File 纯委派；File 侧仅加入口 `validateIdentity`（与其余公开入口同款）；SA6 C14 双 adapter 矩阵锚定等价 |
| persistence：契约/生命周期变更跑 root `pnpm typecheck` + `pnpm test` | ✅ SA3 申报 typecheck exit 0、全量 5242 tests 仅 2 个既有无关失败（见 §9）；本角色不复跑，申报与静态证据一致 |
| dsh-persistence：保留机器可读记录形状；探针确定性 | ✅ `record.ts`/`events.ts`/`profile.ts`/`cli.ts` 零触碰（diff 核实）；probe.ts 仅退避镜像一行锁步，缺省表达式 `(undefined ?? debounceMs) \|\| 1` 与旧式逐字节同值 ⟹ 默认时间线零漂移；无墙钟依赖引入 |
| apps：只消费包公共导出，不用包内部子路径/测试缝 | ✅ app.ts 仅从 `@nomicore/persistence` barrel 导入 `createFilePersistencePlugin`/`createMemoryPersistencePlugin`（index.ts:51/57 公共导出）；`apps/yjs-server/src/` 零 testing-seam 导入（grep 核实） |
| apps/yjs-server：单一拆卸链，不得触发第二条并发拆卸链 | ✅ drain（含预算 race）位于同一 `performStop` 链内（diagnostics-closed 之后、fiber dispose 之前）——是**等待**步不是拆卸动作；`stop()` single-flight 未触碰；S-5c 断言二次 stop 不触发第二次 drain。MINOR：AGENTS 摘要行未列举新等待步（§10 M-2） |
| apps/yjs-server：stdout 严格 NDJSON 生命周期事件通道 | ✅ 新事件 `persistence-drain-budget-exceeded` 载荷 `{event, budgetMs}` 纯数值（脱敏合规）；additive；hub-peer-deployment.md 词表同步且带**条件性注记**（不误导读作每次停机必发） |
| docs：新域词条入 CONTEXT.md；ADR 显式增量修订；行为变更同步规范文档 | ✅ CONTEXT.md:139-142「完成式排空（drain）」词条含 `_Avoid_` 行（含「把 drain 并进 dispose」禁令）；ADR 0006 以增量修订节演进（非静默矛盾）；行为契约变化的两份集成文档同变更集更新；`git diff --check` 干净 |
| docs：链接到权威源而非多处复制规则 | ✅ 各文档以「见 ADR 0006 修订节」指引，未复制条款全文 |

## 5. ADR 与模块责任

| 检查 | 结果 |
| --- | --- |
| ADR 0006 :34（不设外部协调器） | drain = 一次性完成式排空（归档 settle 范式 :37/:213 的公开化），非周期协调器；回退窗内 retry 退避仍是唯一调度源（:195——drain 只注册 waiter 被动等待，零热循环，1f 锚定）；修订节含「与 :34 的关系」不冲突申明。**符合** |
| ADR 0006 §228-5 + :86（dispose 冻结面） | dispose 语义零变化（abort/clearTimers/handles.clear/doc.destroy/cells.clear/allSettled 顺序与成员不变）；Memory.dispose 清 mirror 语义未触碰。**符合** |
| ADR 0006 :221-232（optional/派生面先例） | drain = `DocPersistence` optional readonly 属性；不进 `ReplicaPersistence`（语义家族区分）；三成员字面量绿守卫保持（surface 类型锚）。**符合** |
| 责任归属 | drain 状态机 → lifecycle（调度事实所有者）；targets 校验 → File adapter（路径安全事实所有者）；停机预算/诚实事件 → 宿主组合层（库级 API 无预算参数——Owner 分层要求）；retry 基准 → `retryBaseMs` 单 getter。**全部正确，无状态机复制、无责任越界** |
| wire/协议冻结 | `docs/protocols/**`、`packages/ws-replication/**` 零触碰（diff 核实）。**符合** |

## 6. 既有架构惯例、单一事实源、生命周期对称性

- **惯例复用**：`awaitDrainWithBudget` 镜像同仓 REST 排空纪律（tagged-outcome `Promise.race` + timer 早清 + 进程级 setTimeout）；不对称点（不 abort drain）有注释论证（abort 等价物 = 随后的冻结 dispose）；`PersistenceDrainTarget` 公开词汇 + 内部复合键保持私有（archiveDoc `expectedReplicationIdentity` 包装先例同族）；预算推导零新增配置键（`REST_DRAIN_BUDGET_MS` 纪律）。
- **单一事实源**：retry 首基准 = `retryBaseMs` 单 getter，createEntry 初始化与 flush 成功回落两落点共用；settle 通知面 = `archiveWaiters` 单面（flush finally 通知点 1 / dispose 通知点 2 / 驱逐释放），未引入第二套 waiter/事件机制；预算 = `maxDirtyMs + DRAIN_MARGIN_MS` 单推导（事件载荷同源）。**无平行机制**（无第二 cleanup/retry loop、无第二拆卸链、无第二事件通道）。
- **生命周期对称性**：drain 不获取任何资源（不 abort/destroy/清定时器/驱逐）；**「任何移除 live entry 的路径必须释放其 settle waiters」不变量补全**——live-entry 移除点全集（dispose / settleEntryForDelete 驱逐腿 :677 / settleEntryForArchive 干净驱逐腿 :707 / maybeEvict :1193）统一经 `releaseSettleWaiters`（:1218-1231）释放，修复了 drain 公开后暴露面变大的既有 liveness 空洞；预算败者 drain 续体由 dispose 通知点 2 收口为 vacuous resolve（store 失败面永不 reject ⟹ 零 unhandled rejection）。对称性成立。

## 7. 文件范围（ALLOW/DENY）

`git diff --name-only c3f7bd9..HEAD` 核对（17 个代码/文档/测试文件 + 8 个 wiki 过程产物）：

- **ALLOW 15 行全部兑现、无越界**：contract.ts / lifecycle.ts / memory.ts / file.ts / index.ts / probe.ts / app.ts / config.ts（注释+拒绝文案 parenthetical，行为零变化）/ main.ts（仅注释，diff 核实无行为行）/ ADR 0006 / CONTEXT.md / hub-peer-deployment.md / cordis-plugin-hosting.md / 两个建议新增测试文件。
- **DENY 零触碰**：`service.ts`、`testing.ts`、`namespace-registry/**`、dsh `record.ts/events.ts/profile.ts/cli.ts`、既有 persistence 测试四组冻结审计（`persistence-contract.test.ts` 等）、`apps/yjs-server/test/` 既有锚（ordered-shutdown-red / app-config-red / lifecycle-watchdog-red / issue270-*）、`docs/protocols/**`、`packages/ws-replication/**`——diff 名单核实全部未触碰。
- **SA6 两份契约测试文件**（drain-red 27 tests / drain-surface 5 tests）：内容零修改地由 untracked 验收证据转为提交（结构抽验与 SA6 §13 清单一致：§0 4 + §1 14 + §2 6 + §3 3 = 27；类型锚 5）——「零触碰」义务（SA2-6）在内容面成立。
- **wiki 过程产物**：8 份 SA 报告随 commit 归档，`wiki/raw/` 既有大量 `task_*_sa*.md` 先例（task_191/228/237 系列）——符合仓库惯例。

## 8. 测试质量标准

| 维度 | 核对结果 |
| --- | --- |
| runner 真实发现 | `vitest.config.ts` include `packages/*/test/**/*.test.ts` + `apps/*/test/**/*.test.ts` 覆盖三个新运行期文件；typecheck include `packages/*/test/**/*.test-d.ts` 覆盖类型面文件；root `pnpm test` = `vitest run --typecheck` 全量触发 |
| skip/only/todo | 四个新测试文件 grep 核实**零** skip/only/todo |
| 真实故障面 | 真实 yjs / 真实 Memory·File adapter（真实 tmpdir + 真实 fs mkdir/writeFile/rename + EISDIR 注入）；零 mock 被测对象（唯一包装面 = 既有 `createPersistenceIoFaultSeam` around-seam 与 S-5c 的**公共类原型** spy——`MemoryPersistence` 经 barrel 公开导出，非内部缝） |
| 确定性 | fake scheduler 脚本化（零 real sleep）；竞态一律 `withTimeout`（挂起即失败）；File 侧结算用探针屏障而非微任务计数；S-5b 故障注入为确定性持续失败（首重试基准 1000ms > 预算 520ms，无 timing 竞争） |
| 断言面 | 全部行为断言（attempts 计数 / committedN 新实例读 / 事件序 findIndex / spy 计数）；零源码字符串/正则断言；事件名常量是公共 NDJSON 词表（hub-peer-deployment.md 规范化面） |
| 红→绿归因 | SA6 红因逐条归因于目标断言（14 运行期 TypeError + 4 行为 + 3 类型锚），基线保持项（0a/0b/2b/3a-3c）设计内保持绿；SA3 申报契约 27+5 转绿 + 三包切片全绿 + mutation 反证三项（删驱逐通知→S-3 红；恢复 file 守卫→S-5c 红；恢复固定睡眠→S-5a/b/c 红），静态可区分性成立 |
| 类型面 | `test-d.ts` 五锚（两类面 drain / schedule 键 / 三成员字面量 / 实现关系）；`legacyThreeMemberAdapter` 绿守卫锚定 optional 放置（ADR 先例） |

## 9. 验证门申报的一致性核对（SA9 不复跑，核对申报自洽性）

- SA3 申报：root `pnpm typecheck` exit 0；root `pnpm test` 5242 tests 中 **2 个失败为既有且无关**——`packages/vfsl-codegen/test/generate-union-member-docs.test.ts` 的 `generate --check` 版本横幅新鲜度断言。**静态复核属实**：`domains/vfs3-assets/generated.ts` 横幅 `@nomicore/vfsl-codegen@0.1.3` vs 包版本 `0.2.0`，失配源自基线上的发布提交 `abbb89a`（`git log c3f7bd9` 核实）；本 diff 零触碰 `domains/**`、`packages/vfsl*`。**结论：不属本 diff 缺陷，不阻断标准判定**（其修复超出本任务 ALLOW）。
- 各包 AGENTS 验证门（persistence 契约+包 typecheck、dsh determinism、app typecheck+套件）在 SA3 报告中逐条有命令与结果；与本审查的静态核验（runner include、导入面、冻结面零触碰）一致。

## 10. Findings（全部 MINOR，非阻断）

| # | 严重度 | Finding | 证据 | 建议处置 |
| --- | --- | --- | --- | --- |
| M-1 | MINOR | ADR 0006 新修订节内三处「第 4 条」交叉引用悬空：第 2 条「本条与第 4 条『退避即唯一 flush 调度源』一致」与「见第 4 条『重试直到成功或插件停止』」、第 3 条「仍是唯一调度源（第 4 条）」——被引短语实际位于 :34（决策节 bullet，无编号）与 :195（issue #79 修订节第 2 条），本 ADR 任何修订节的「第 4 条」均不含这两个短语（本节第 4 条 = dispose 对齐条款） | ADR 0006:264/:267/:273 vs :34/:195；SA8 实现后报告 F1 同款记录 | 后续 docs 变更集把三处改为可解析引用（「:34」/「#79 修订节第 2 条」/逐字短语直引）；纯文本修正，零语义后果（短语逐字唯一可定位），无需新门禁 |
| M-2 | MINOR | `apps/yjs-server/AGENTS.md`「Single disposal chain」摘要行未列举新增的链内排空等待步（陈述仍真——drain 是同一链内的**等待**非第二条拆卸链；该文件不在设计 ALLOW，未触碰正确） | AGENTS 行 21-25 vs app.ts:604-632；SA3 Deferred / SA4 N-1 / SA8 action 2 同款记录 | 后续文档变更集顺带补一句（如「…→ diagnostics O(1) close → bounded persistence drain → persistence dispose → …」） |
| M-3 | MINOR | `awaitDrainWithBudget`：若 drain promise reject（设计判定结构性不可达——store 失败面永不 reject，仅剩 adapter 契约违约级 bug），`await Promise.race` 抛出使 `clearTimeout` 被跳过，预算 timer（≤30.5s）残留至自然到点；fail-loud 路径（app-stop-failed → exit(1)）不受阻 | app.ts:554-568；SA4 N-2 | 可改 try/finally 包裹 race 以早清 timer；非本任务必要 |
| M-4 | MINOR | S-5a `expect(elapsedMs).toBeLessThan(450)` 为墙钟上界断言，极慢 CI 上单次真实 fs write+rename 可能偶发击穿（`withTimeout` 3000ms 与预算 5500ms 两道主保护不受影响，仅「远小于预算」上界敏感） | persistence-drain-shutdown.test.ts:93-97；SA4 N-3 | 观察 CI 稳定性后酌情放宽（如 < 预算/2） |
| M-5 | MINOR | `persistence-issue-412-drain-semantics.test.ts:151` 格式缺陷：`makeFresh` 闭包收尾与 `dispose` 属性挤在一行（`} as MemoryPersistenceOptions),    dispose: () => …`），应为两行 | 源码 :146-152 | 后续测试触碰时顺带拆行；纯风格 |
| M-6 | MINOR（design 侧） | SA2-12：设计文档对 SA8 设计后报告的三处计数/traceability 描述停留在旧版（§6 表头计数、§15.1 evolution-required 项数、§6 缺 O1–O3/D18/D19 行）——SA1 产物文本滞后，实质义务落点在正文 §4.1/DD-8/ALLOW 完整 | design line 9/§6/§15 vs SA8 报告现行版；SA2 §6、SA4 N-4 | 路由 SA1/Controller 文本修订；零行为影响 |

另记录两项观察（不构成 finding）：(i) `flush()` finally 通知点 1 保留内联 `splice(0)+call` 而未调用 `releaseSettleWaiters`（行为逐字节等价；统一方法覆盖的是四处**移除点**——SA4 N-5 同款结论）；(ii) SA6 契约两文件与新语义测试沿用 `asDrain` 窄化助手调用 optional 成员——保留「特征缺失 → TypeError 红」的锚定属性，是刻意的测试设计而非 `any` 泄漏。

## 11. 结论

- 仓库/工程标准全部满足：模块 AGENTS 边界（persistence 契约面、dsh 记录形状、apps 公共导出消费、yjs-server 单拆卸链与 NDJSON 通道、docs 词汇/ADR 纪律）逐条符合；ADR 0006 经增量修订节对齐（含 Owner 要求的 :86 修订并扩展与无条件停机硬契约条款）；模块责任、既有惯例、单一事实源、生命周期对称性无违例；文件范围与 ALLOW/DENY 精确贴合；测试质量（发现性、确定性、行为断言、红绿归因、mutation 敏感性）达标。
- 6 项 MINOR 均为非阻断的文本/风格/鲁棒性余量事项，其中 M-1/M-2 已被 SA8 列为非阻断 follow-up，M-3/M-4 被 SA4 列为非阻断观察。
- **Verdict: approve**。
