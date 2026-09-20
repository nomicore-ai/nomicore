# SA2 设计攻击评审 — issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦）

- 评审对象：`wiki/raw/task_issue-412_design.md`（**iteration 2**，SA1 产物——落实 SA2-7 修订路径 (b)：停机硬契约对 file/memory 路径统一调用）
- 仓库 / worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`）
- 评审人：SA2（独立攻击评审；不修改设计/代码/测试）
- Verdict：**approve**（0 × BLOCKER；0 × MAJOR；2 × MINOR 非阻断 + 3 项信息性）
- 迭代史：iteration 0 reject（SA2-1 MAJOR + 6 MINOR）→ iteration 1 reject（SA2-7 MAJOR + 4 MINOR）→ **iteration 2 approve**（本轮逐条复核修订落实，见 §13 修订映射）

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-412.md`（Host task brief；快照 updated 2026-09-20T17:31:48Z，Comments 节为空） | 存在，已读 |
| `wiki/raw/task_issue-412_design.md`（SA1 设计 iteration 2，2026-09-21 02:38 原位全量修订） | 存在，已逐节攻击 |
| **Issue comment `5751613018`**（MEMBER，updated `2026-09-20T18:03:36Z`） | iteration 1 已经 `gh api` 取回全文核对；本轮 dispatch 复述（「hard drain-before-dispose contract and ADR-0006 alignment」）与既有全文一致，作为本轮适用 Owner 要求 |
| `wiki/raw/task_issue-412_sa6_contract.md`（SA6 契约，verdict approve） | 存在，已读；两份契约测试文件存在性 + 形状抽验（`persistence-issue-412-drain-red.test.ts` / `-surface.test-d.ts`，DD-4 目标形状逐字段一致 → 零触碰成立） |
| `wiki/raw/task_issue-412_design_conflict_report.md`（SA8 设计后冲突复查——**现行文件为 iteration 1 修订版的原位更新复审**（02:21），O1–O3 + D1–D19 共 22 行：13 no-conflict + 6 implements + 3 evolution-required，verdict clear、`requiresConflictRecheck: true`） | 存在，已读——**注意：设计对该报告的三处描述仍停留在旧版计数，见 SA2-12（MINOR）** |
| 上一轮 SA2 评审（iteration 1，本文件前版） | 已读；SA2-7 修订落实逐条复核（§13.2） |
| 源码核验 | `packages/persistence/src/{lifecycle,contract,memory,file,index}.ts`、`packages/persistence/test/persistence-issue-412-*`、`packages/dsh-persistence/src/{probe,record}.ts`、`apps/yjs-server/src/{app,config,main,lifecycle,rest-hosting}.ts`、`vitest.config.ts`、既有测试锚（ordered-shutdown-red / app-config-red / lifecycle-watchdog-red）——**B1–B20 全部锚点逐条复核无误（本轮重点：新增 B19/B20 + DD-7 统一代码块 + S-5c 可行性）** |

## 2. Verdict

**approve**。iteration 2 按 SA2-7 路径 (b)（统一调用）完成修订，并满足我 iteration 1 §13.2 的全部接受条件：

1. **三处文本对 memory 路径零矛盾**：DD-7(1) 统一代码块（`kind === 'file'` 守卫删除，file/memory 同一 `awaitDrainWithBudget(adapter.drain(), budget)`；memory 预算 = `DEFAULT_MAX_DIRTY_MS + DRAIN_MARGIN_MS` 缺省推导）、DD-8(1) 硬契约条款保持无条件 + 适用面申明（契约边界 = 配置的 store 面，不以 adapter 类名特判）、DD-8(4) 仓库外宿主指引（file/memory 统一 + 诚实边界）——三方对「memory 停机是否先 drain」给出**同一个答案（是）**。Owner「否则契约与实现继续脱节」的失败模式在核心交付物上消除。
2. **统一调用的技术依据经源码独立核验成立**：B19（config.ts:58-60 memory 变体无 schedule 键；memory.ts 工厂返回同款 `{apply, get instance()}` 公共句柄；app.ts:297 零 options 构造 → 内部 schedule 经 `resolvePersistenceSchedule(undefined)` = DEFAULT 500/5000；barrel 导出 `MemoryPersistence`/`FilePersistence`）与 B20（memory.ts io.write = abort 门 + 可选 writeSnapshot hook + mirror set——耐久面由 hook 决定）逐行属实。yjs-server 内置 memory 配置不接线 hook（config 闭集键无该通道）⟹ drain 对干净/脏面均微任务级 resolve，预算 race 是结构性上界。
3. **路径 (b) 的验收行已补**：S-5c（`vi.spyOn(MemoryPersistence.prototype, 'drain')` + memory 配置 stop → drain 恰一次、严格先于 `persistence-disposed`、四事件序完整、无预算事件、stop 正常返回）——机制可行性核验成立（barrel 原型面可达；vitest.config.ts:14 alias `@nomicore/persistence → packages/persistence/src/index.ts` 对 app 源与测试同映射 ⟹ 单模块实例；`createNomicoreApp` 的 `options.emitter`（lifecycle.ts:141）提供事件收集缝）。
4. **有界行为（本轮 dispatch 焦点）保持**：file 预算 ≤ 30_500ms、memory 预算 = 5_500ms，均 < 60s watchdog；degraded store（file）预算内收口 + `persistence-drain-budget-exceeded` 诚实事件 + 有损继续（SA2-1 闭合不被统一调用回退）；SIGHUP 换装「停旧」半程两 kind 均有界。
5. SA2-8/SA2-9/SA2-10/SA2-11 四个 MINOR 全部采纳（§13.3）。

本轮新发现仅 1 × MINOR（SA2-12：设计对 SA8 报告的三处描述停留在旧版计数/标签，§6 映射表缺现行报告 O1–O3/D18/D19 五行）+ 1 × MINOR（SA2-13：hub-peer 停机序句的预算公式未标注 memory 缺省分支）——均为 traceability/措辞级，实质义务（O1/O2/D18/D19 的落点）在正文 §4.1/DD-8/ALLOW 中已完整，不阻断安全实施。

## 3. 需求覆盖

| Requirement（issue 正文） | Design section | Assessment |
| --- | --- | --- |
| 「把所有脏 entry 落完盘再退」 | §7 DD-5、§8 | 覆盖（resolve ⟺ 静息观察点无待落盘状态） |
| 「对所有 live 脏 entry（含零 handle）立即 startFlush（跳过 debounce）」 | §8 状态机表第 3 行 | 覆盖；与 B3 私有先例的 `handles.size>0` 拒绝差异显式声明 |
| 「await 全部 settle（复用 archiveWaiters 或等价机制）」 | DD-5 骨架 + DD-5b | 覆盖；单通知面 + 驱逐点补全，无第二套 waiter 机制 |
| 「不 abort、不 destroy、不清（定时器之外的任何）状态」 | §1 非目标、§8/§9、C4/C5 | 覆盖且严于请求（定时器也不清） |
| 「drain 返回后 dispose() 可以安全立即执行」 | §9、C6 | 覆盖 |
| 「可选参数：只 drain 指定 key 集合」 | DD-4 | 覆盖；与 SA6 契约文件临时声明形状逐字段一致（本轮抽验 drain-red :83-90 / drain-surface :33-47，零触碰成立） |
| 「独立 retryDelayMs 配置，缺省保持现行为」 | DD-2/DD-3 | 覆盖；条件展开 + `retryBaseMs` getter 单源，与 lifecycle.ts:1030/:1088/:1116-1124 推演一致 |
| 「宿主侧把固定睡眠替换为 await persistence.drain()」 | DD-7 | 覆盖（有预算替换；**file 与 memory 两 kind 统一**——issue 诉求 + 「排空时延上界 < watchdog」不变量 + Owner 硬契约同构成立） |

## 4. Owner评论覆盖

Comment ID `5751613018`，updated `2026-09-20T18:03:36Z`，MEMBER——逐点核对：

| Comment 要求（原文要点） | Design section | Assessment |
| --- | --- | --- |
| 「优雅停机链路上，脏数据的写入完成应当是 dispose 语义的一部分（或其强制前置）」+「数据安全不应依赖宿主记得先调一次额外 API」 | §1 目标 3、§7 DD-7 | **file 与 memory 路径均覆盖**（iteration 2 统一；硬契约时序由 S-5c 锚定 drain 严格先于 `persistence-disposed`） |
| 「把『宿主优雅停机必须先 await drain() 再 dispose』写为**硬性契约**而非参考建议」 | §7 DD-8(1)（无条件条款 + 适用面申明）、§12 S-5a/S-5b/S-5c | 覆盖——条款、对外指引、自家实现三方同答案；SA8 O1 的「预算出口必须保持成文可观察条款」已入条款文本（「显式可观察退出，不是违约」） |
| 「同步修订 ADR-0006 :86 对 dispose 的现有定义——否则契约与实现继续脱节」 | §7 DD-8(1) dispose 对齐条款 | 覆盖（「本节**修订并扩展** :86 的 dispose 定义边界」——SA2-10 措辞已采纳；SA8 O2「约束性修订语气」满足） |
| 「可以接受 issue 的分层方案（公开 drain()，dispose 保持 abortive），但……」 | §1 非目标、DD-1、DD-7 备选 (iii) 否决 | 覆盖 |
| 「第三个击穿窗口：degraded entry 的 retry 回退窗（scheduleRetry :1116，backoff 上限 maxDirtyMs）」 | §3 触发面、§8 回退窗被动等待、DD-7 备选 (iv)、§13 风险行 1/2 | 覆盖；**§4.1 第 4 行 traceability 已补（SA2-11 落实）** |
| 「问题 2 同样复核属实……支持解耦为独立配置（缺省保持现行为）」 | §7 DD-2/DD-3 | 覆盖 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
| --- | --- | --- |
| SA6 §5 0a/0b 复现 + §13 红因分类 + 27+5 红/绿锚 | §5 表逐条承接；两份契约测试零触碰（DENY） | 与契约文件实际内容核对一致 |
| SA6 §15 D-5 六个未锚定交错 / D-7 同变更集要求 | §8/§9 显式语义 + S-1~S-4；ALLOW 同时含代码与文档 | 覆盖 |
| SA8 D1/D8/D19（evolution-required）+ O1/O2（Owner ADR 义务） | DD-5 一次性完成式排空；DD-2 键形状不变；DD-8 修订节 + 两份集成文档（四文件均在 ALLOW） | 实质覆盖；**但 §6 表只映射 D1–D17，现行报告的 O1–O3/D18/D19 无 §6 落点行（实质落点在 §4.1/DD-8(3)/(4)/ALLOW）——SA2-12** |
| SA8 D3/D10/D13/D11 | dispose 不变 / 单一拆卸链（memory 等待步同链内）/ wire 冻结 / 两 kind 保留 plugin 句柄（`.instance` 自有公共面） | 一致（D11 行已按两工厂细化，file.ts:262-274 + memory.ts 工厂核验属实） |
| SA8 required action 2/3/5/6 | retryDelayMs 不物化缺省键 / 预算事件先于 persistence-disposed（S-5b）/ 词表 + 宿主契约文档同变更集 / config 注释诚实边界 | 均有设计落点（DD-2 红线、S-5b、DD-8(3)/(4)、DD-7(2)） |
| apps/yjs-server/AGENTS「Single disposal chain」 | drain（含预算 race、含 memory 新等待步）= 链内等待非拆卸 | 成立（app.ts 单一 `persistenceFiber.dispose()` 位点 :575-576 核验） |
| persistence AGENTS「契约/生命周期变更必跑 root 门」 | §12 root `pnpm typecheck && pnpm test` | 与 package.json scripts + vitest.config include（含 `apps/*/test/**`）核验一致 |

## 6. 设计内部一致性

- **B1–B20 全部源码锚点逐条复核无误**。本轮重点：B19（config.ts:58-60 / app.ts:85/:297 / memory.ts 工厂 / index.ts:48-56 barrel——全部属实）、B20（memory.ts io.write 的 abort 门 + hook + mirror set、dispose 的 drain-then-clear——属实）；B15（rest-hosting.ts:151-171 tagged race + timer 早清——`awaitDrainWithBudget` 镜像逐行同构）；B9/B10/B16/B17 维持。
- **SA2-7 三处不一致已消除**：iteration 1 的三个互斥答案（DD-7「memory 不引入 drain」/ DD-8(1) 无条件条款 / DD-8(4)「file/memory」指引）在 iteration 2 统一为「file 与 memory 停机统一先 drain（有预算）」。全文扫描（§1 目标 3、§2 B19/B20、§4.1/§4.2、§5、§6 D10/D11、§7 DD-7(1) 代码块与 memory bullet、§8 L4、§10、§11 ALLOW、§12 S-5c、§13、§15）对 memory 路径**零矛盾**——「维持现状」「不引入 drain」类残留表述已全部删除。
- 统一代码块细节核验：`kind === 'file'` 守卫删除后预算推导 `schedule?.maxDirtyMs ?? DEFAULT_MAX_DIRTY_MS` 与现行 config 形状（file 变体 `schedule?` 可选、memory 变体无键）精确匹配（config.ts:58-60 + 校验环核验）；`persistencePlugin` 字段并集类型上 `.instance` → `FilePersistence | MemoryPersistence | undefined`，两类 `drain` 为 DD-1 同签名具体类方法 ⟹ 并集调用类型安全；`sleep` 保留论证（:1060/:1085/:1101/:1129 四处使用）属实。
- iteration 0/1 的其余一致面维持：预算表述四点一致（DD-7/§8 L4/§13/config/main 注释）、「永不 reject」限定 store 失败面、静息观察点措辞——零回归。
- **新发现（→ SA2-12，MINOR）**：设计对 SA8 报告的描述与现行文件不符——(i) 头部 line 9 称「iteration 0 verdict clear：0 hard-conflict、3 × evolution-required」，而现行文件（02:21，早于设计 02:38）是 **iteration 1 修订版复审**（原位更新）；(ii) §6 表头「12 no-conflict + 3 implements + 2 evolution-required」与现行报告实际计数（**13 + 6 + 3**，O1–O3 + D1–D19 共 22 行）不匹配（该计数匹配已被原位更新取代的 iteration 0 版）；(iii) §15.1「evolution-required 两项（D1、D8）」——现行报告为**三项**（D1/D8/D19）；(iv) §6 映射表缺 O1–O3/D18/D19 五行（实质义务在正文有落点，见 §5 行 3）。该缺口不改变任何行为/范围/验收，但使「SA8 决议逐条落实」的 traceability 工具（§6 表）对现行报告不完备。

## 7. 状态机与并发攻击

iteration 0/1 的 SM-1~SM-18 结论在骨架未变前提下维持；本轮攻击集中在 memory 统一步的新交错：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
| --- | --- | --- | --- | --- | --- |
| SM-19 | memory 配置，脏 entry（boot 期 provision 写） | performStop 第 3 步统一 drain | `startFlush` → flush → io.write（abort 未点火 + mirror set，微任务级）→ finally 通知 → 重扫干净 → resolve；预算 race 胜 'drained'，零事件 | 无——memory.ts io.write 无外部 I/O 失败面（B20 核验）；`throwIfAborted` 仅 dispose 后点火 | — |
| SM-20 | memory 配置，boot 窗口 stop（plugin 未 apply） | performStop 第 3 步 | `persistencePlugin?.instance === undefined` → 跳过（F2 纪律，与 restHost/diagnostics optional 同款） | 无——两工厂 instance 均在 apply() 内赋值（memory.ts/file.ts 核验） | — |
| SM-21 | memory 配置，drain 等待中 `flushing` 在途 | 统一步 | 注册 waiter → 该 flush finally 通知 → 重扫退出（single-flight 双门防重复发起） | 无 | — |
| SM-22 | memory 配置 + 外部 hook 接线（yjs-server 配置面不可达；第三方宿主可达） | drain 遇 hook store 持续失败 | degraded + 内部退避；宿主预算（本设计对 yjs-server = 5_500）到点 → 事件 + 有损继续 | 无——DD-8(1)/(4) 适用面申明已覆盖（「接线外部 store 的 memory 实例与 file 同质受保护」）；yjs-server config 闭集键使该态在本仓不可达 | — |
| SM-23 | SIGHUP 换装「停旧」半程（memory） | reload → app.stop() | drain 即时完成，换装链不引入新等待；file 路径 ≤ 30.5s（既有结论） | 无 | — |
| SM-24 | `stop()` 二次并发调用（memory/file 任意） | — | 单一停机 promise；drain 恰一次（S-5c 断言「恰被调用 1 次」与单链结构一致） | 无 | — |
| SM-25 | drain 调用与 3b fiber dispose 交错 | 顺序 await | drain await 先返回（完成或预算尽）才进 3b；败者续体经 dispose 通知点 2 → 重扫 closed → vacuous resolve | 无（iteration 1 SM-13/ER-4 推演在统一路径下同构成立） | — |

（SM-4 驱逐 liveness（DD-5b）与 SM-12~SM-18 的 iteration 1 结论维持——本轮对驱逐点三处 + waiter 注册/释放时序的重新推演与上轮一致。）

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
| --- | --- | --- | --- | --- |
| ER-1 | store 写失败（file，drain 强制 flush 轮） | degraded + 内部退避；drain 被动等待；store 失败面永不 reject | 语义诚实 | — |
| ER-2 | 持续失败 store（file） | 预算到点 → `persistence-drain-budget-exceeded`（先于 `persistence-disposed`）→ 有损 dispose；链 ≤ 30.5s 收口 | SA2-1 闭合保持 | — |
| ER-3 | drain promise reject（结构性不可达） | 链 catch → `app-stop-failed` + rethrow → `exit(1)`（fail loud）；该路径预算 timer 残留 ≤ 30.5s（与 rest-hosting 同款形状，两消费端均 `process.exit` 终结） | 实害为零 | —（信息性，维持上轮记录） |
| ER-4 | 预算尽后 drain 败者续体（file/memory 同构） | dispose 通知点 2 → vacuous resolve；零 unhandled rejection；S-5b 锚定 | 无 | — |
| ER-5 | 非法 `retryDelayMs` / File unsafe target | RangeError 词表自动扩展 / `validateIdentity` bare Error（S-4） | 无（例外申明已入 DD-5/§9） | — |
| ER-6 | memory 路径统一 drain 的失败面 | 内置配置无外部 I/O 失败面（B20）⟹ 无 degraded、无预算事件、无 reject；S-5c 锚定 stop 正常 resolve | 无 | — |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
| --- | --- | --- | --- |
| `DocPersistence.drain?`（optional 新成员） | 无——三成员字面量/13 stub 零迁移；surface 锚形状兼容（本轮抽验 drain-surface.test-d.ts:33-47） | contract.ts:80-139 先例 | — |
| `apps/yjs-server` performStop（**file/memory 统一**） | 预算组合、`.instance` 两 kind 可达性（B19）、boot 窗口跳过、事件位次（`diagnostics-closed` 与 `persistence-disposed` 之间）、四事件序（findIndex 免疫）全部正确 | app.ts:565-577 现状、§7 DD-7 | — |
| `main.ts` SIGHUP/SIGTERM 链 | 行为不变（预算内必然返回，两 kind 同）；注释刷新覆盖 file/memory | main.ts:30/:67-105 | — |
| stdout NDJSON 消费方 | 新事件 additive 且条件性（词表注记已采纳——SA2-8）；既有锚 findIndex/presence 断言免疫 | B17；hub-peer-deployment.md:36-41 | — |
| nomic-server（仓库外宿主） | 硬契约指引 file/memory 统一 + 示例代码块加有界 drain 步（SA2-9 落实）——与 app 实现同答案 | DD-8(4) | — |
| DSH probe/record/golden | 镜像行 + 记录头冻结 + 默认时间线零漂移 | DD-6 | — |
| 根门禁 | `pnpm test` include 覆盖 `apps/*/test/**`（S-5a/S-5b/S-5c 会被发现）；typecheck 清单与 §12 一致 | vitest.config.ts、package.json | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
| --- | --- | --- | --- |
| drain 状态机 | PersistenceLifecycle（ADR 0006:157-159） | lifecycle 单点；adapter 委派 | 正确 |
| 停机编排与预算（含 memory 统一） | 应用组合根 | DD-7 app 侧（预算推导 + race + 诚实事件；memory 缺省预算分支） | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| app 停机有界排空 | `RestHosting.drain(REST_DRAIN_BUDGET_MS)`（tagged race + timer 早清 + 预算尽诚实继续） | `awaitDrainWithBudget` 同款纪律，两 kind 共用 | **一致**（不 abort drain 的差异有意且已论证） | — |
| 归档/删除 settle 排空 | settleEntryForArchive/settleEntryForDelete | drain 泛化 + DD-5b 通知面补全 | 一致（issue 明示的一般化） | — |
| optional 成员 / 配置键 / plugin 句柄放置 | importDoc/archiveDoc/probe/deleteDoc 四连先例；`.instance` 消费先例（profile.ts:65/79） | drain optional + retryDelayMs? + 两 kind 保留句柄 | 一致（B14/B19） | — |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| settle 完成通知 | `archiveWaiters` 单面 | drain/archive/delete 复用 | 无 |
| retry 基准 | `retryBaseMs` getter 单源 | 两落点引用 + probe 镜像 | 无 |
| 停机硬契约表述 | ADR 0006 修订节（DD-8(1)，无条件） | cordis-plugin-hosting 指引 + app 实现（两 kind 统一） | **无（SA2-7 已消除；三方同答案）** |
| memory 预算缺省 | app `DEFAULT_MAX_DIRTY_MS`（5_000，注释刷新为「file 缺省 schedule 与 memory 内部 DEFAULT schedule 同源」） | 镜像 persistence 包 `DEFAULT_PERSISTENCE_SCHEDULE.maxDirtyMs`（lifecycle ctor `resolvePersistenceSchedule(undefined)` 核验） | 跨包常量镜像无编译期绑定——**信息性**（对内置 memory 无实害：无 degraded 面，预算结构性不消耗；file 缺省路径同款镜像先例） |

### 生命周期对称性

drain 不获取资源，无对称释放义务；app 预算 timer 一次性、双路早清；memory 等待步为链内 await（非拆卸）。✓

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
| --- | --- | --- | --- |
| 第二套 cleanup/flush/waiter 通道 | archiveWaiters + flush finally | 复用 | 无平行机制 |
| 第二拆卸链 / memory 独立停机路径 | 单一 performStop 链 | 统一步（无 kind 特判——**反而消除了 iteration 1 的 memory 特判分支**） | 无 |
| 预算配置键 | 无（REST 预算 = 模块常量纪律） | 预算推导 + 模块常量边距（memory = 缺省推导） | 无新增键 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
| --- | --- | --- |
| ALLOW LIST 与 DD-1~DD-8 落点核对 | 全部实现/测试/文档路径在 ALLOW（app.ts 行含「`kind==='file'` 守卫删除 + 两 kind 句柄统一 + 两常量注释刷新」；memory.ts/file.ts drain 委派；两新测试文件；四份规范文档）；DENY 与正文无冲突（SA6 两契约文件零触碰；service.ts 零改动成立；`apps/yjs-server/test` 既有测试零触碰——S-5 以新增文件承载） | — |
| S-5c 对 barrel 的依赖 | `MemoryPersistence` 自 `@nomicore/persistence` 公开导出（index.ts:48-56 核验）——无需为验收改导出面 | — |
| follow-up 清单 | 4 项均为独立立法/仓库外事项，不掩盖本任务必要项 | — |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
| --- | --- | --- | --- |
| C1–C14（SA6 契约） | 27+5 红/绿锚（已就位、零触碰） | 无 | — |
| S-1~S-4（D-5 语义缺口） | 新增 `persistence-issue-412-drain-semantics.test.ts` | 无 | — |
| S-5a 健康 store 端到端（file） | 小 schedule → 停机前写入 → stop 远小于预算返回 + 重启见最新内容 + 四事件序 + 无预算事件 | 无 | — |
| S-5b degraded store 端到端（file） | EISDIR 确定性注入（tmp 路径预置目录；file.ts `writeCommittedSnapshot` mkdir→writeFile(tmp)→rename 写前无 tmp 清理核验）→ 预算内返回 + 事件先于 `persistence-disposed` + 序列完整 + 有损诚实 + withTimeout | 无 | — |
| **S-5c memory 统一路径（SA2-7 验收）** | `vi.spyOn(MemoryPersistence.prototype, 'drain')` + memory 配置 + 注入 emitter → drain 恰一次、调用时刻 `persistence-disposed` 未发射、四事件序完整、无预算事件、stop 正常 resolve（withTimeout 包裹） | **机制可行性核验成立**：类原型面经 barrel 可达；模块实例一致性由 vitest resolve.alias（`@nomicore/persistence → packages/persistence/src/index.ts`）对 app 源与测试统一映射保证（设计 S-5c 行表述为「workspace 解析」——措辞见 §14 信息性注 3）；`createNomicoreApp` 的 `options.emitter` 为既有事件收集缝（lifecycle.ts:141） | 无 |
| Runner 命令 | §12 五条命令（含 yjs-server tsc+test 覆盖 S-5 三用例） | 与 vitest include / 根 typecheck 清单核验一致 | — |

## 13. Required revisions

**无 BLOCKER / MAJOR。**

### 13.1 iteration 0 → iteration 1 修订映射（历史轮；iteration 1 评审已复核全部落实——SA2-1~SA2-6，维持该结论）

### 13.2 iteration 1 → iteration 2 修订映射（本轮逐条复核）

| Finding | 修订位置 | 复核结论 |
| --- | --- | --- |
| **SA2-7（MAJOR）**：三处文本对「memory 停机是否先 drain」互斥 | §7 DD-7(1)（守卫删除 + 统一代码块 + 句柄两 kind + memory bullet 四点技术依据 + 备选 (a) 否决）、DD-8(1)（无条件 + 适用面申明）、DD-8(4)（统一指引 + 示例代码块）、§1/§2 B19/B20、§4、§5、§6 D10/D11、§8 L4、§10、§11、§12 S-5c、§13 | **已落实（路径 (b) 统一调用）**——三处文本零矛盾（§6 核验）；S-5a/S-5b 不受影响；S-5c memory 验收行已补且满足 iteration 1 §13.2 acceptance 全部条件（§2 本轮四点核验） |
| SA2-8（词表条件性注记） | DD-8(3) | 已采纳 |
| SA2-9（示例代码块加 drain 步） | DD-8(4) | 已采纳 |
| SA2-10（:86「修订并扩展」措辞） | DD-8(1) | 已采纳 |
| SA2-11（§4.1 第三窗口 traceability 行） | §4.1 第 4 行 | 已采纳 |

### 13.3 本轮无阻断 finding

## 14. Non-blocking observations

1. **SA2-12（MINOR）：设计对 SA8 报告的描述停留在被原位更新取代的旧版**。证据：设计头部 line 9（「SA8 设计后冲突复查，**iteration 0** verdict clear：0 hard-conflict、**3 × evolution-required**」）、§6 表头（「**12** no-conflict + **3** implements + **2** evolution-required」）、§15.1（「evolution-required**两项**（D1 公开 drain、D8 schedule 新键）」）——而现行 `task_issue-412_design_conflict_report.md`（02:21，早于 iteration 2 设计 02:38）为 **iteration 1 修订版复审**（原位更新），实际 22 行（O1–O3 + D1–D19）、**13 no-conflict + 6 implements + 3 evolution-required（D1/D8/D19）**；§6 映射表只覆盖 D1–D17。问题：traceability 工具（§6 表 + 头部输入描述）与上游事实不符，后续 SA4/SA7 按 §6 逐条验收时会发现 5 行（O1–O3/D18/D19）无映射且计数对不上——实质义务均有正文落点（O1/O2 → §4.1/DD-8(1)；O3 → §4.1；D18 → B17/DD-8(3)/§10；D19 → DD-8(3)/(4)/ALLOW），故不阻断。修订要求：头部 line 9 改为「iteration 1 修订版复审（原位更新）」并引用 13+6+3 计数；§6 表头计数同步；§15.1「两项」改「三项（D1/D8/D19）」；§6 补 O1–O3/D18/D19 五行映射（可引用 §4.1/DD-8 行号）。接受条件：三处描述与现行报告文件逐字对上、22 行均有落点。
2. **SA2-13（MINOR）：hub-peer-deployment.md 停机序句的预算公式未标注 memory 缺省分支**。DD-8(3) 拟文「对持久化 adapter（file 与 memory 配置统一）执行有界完成式排空（`drain()`，预算 = maxDirtyMs + 边距 < 60s watchdog…）」——memory 配置的操作员面上不存在 `maxDirtyMs` 键（B19），按字面会误导其寻找不存在的旋钮。修订要求：该句预算括注补「（memory 配置 = 缺省推导）」或同款限定。接受条件：文档句对两种配置的预算来源均可读出正确值。
3. **信息性**：`DEFAULT_MAX_DIRTY_MS`（app）与 `DEFAULT_PERSISTENCE_SCHEDULE.maxDirtyMs`（persistence 包）为跨包常量镜像、无编译期绑定；memory 预算缺省推导继承该镜像。对内置 memory 配置实害为零（无 degraded 面，预算结构性不消耗），且 file 缺省路径同款镜像为先例；设计 DD-7(1)/(2) 注释刷新已如实声明同源关系。仅记录。
4. **信息性**：S-5c 的模块实例一致性论证，实际保证机制是 vitest `resolve.alias`（`@nomicore/persistence` → `packages/persistence/src/index.ts`，vitest.config.ts:14）对 app 源与测试源的同映射，而非设计所述「同一 specifier 经 workspace 解析」。结论不变（单模块实例成立），建议 SA3 落地注释时引用 alias 为准。
5. **信息性**：`awaitDrainWithBudget` 在 drain reject 路径（结构性不可达）不清理预算 timer——与 rest-hosting 同款形状且两消费端均以 `process.exit` 终结，实害为零（iteration 1 ER-3 结论维持）。

## 15. 裁决与路由

- **approve**（0 BLOCKER / 0 MAJOR；SA2-12、SA2-13 为 MINOR 非阻断）。Owner 要求的硬契约（dispose 前 await drain——完成或预算耗尽且可观察）与 ADR-0006 对齐（:86 修订并扩展 + 分层保持）在 file 与 memory 两路径上**规范条款、对外指引、自家实现、验收证据四方一致**；有界行为（file ≤ 30.5s / memory 5.5s / 均高于 60s watchdog 的安全侧）经源码独立核验成立。
- `pass` 仅表示设计通过审查；实现与活链路验证由后续 SA4/SA7 承接（SA8 报告 required action 7 的实现后复查仍待执行）。
- `requiresConflictRecheck`：本轮**不提交**——iteration 2 的 memory 统一落在设计 §15 已标记的「ADR 修订节落地 + 宿主契约表述 + 消费方停机语义」复查面内，未发现新的 ADR 冲突维度；SA2-12/SA2-13 为 traceability/措辞修订，不触碰决策面。
- 路由建议：Controller 可放行进入实现；SA2-12/SA2-13 可随实现变更集顺带修正（纯文本，无行为影响）。
