# task_issue-424 SA10 Spec 审查 — 分片形态端到端等价性验收（spec #415 T7）

- 被审对象：**已提交最终交付 diff** `efd958f..a62f23f`（HEAD = `a62f23f423dc80de08e8a34db5748358e77a63f9`「test(ws-replication): cover sharded hub equivalence」；稳定父基线 = `efd958f`「fix(#420) … (#430)」）
- 审查基准：Issue #424 正文（`wiki/raw/task_issue-424.md`，AC1–AC6）+ 已批准 SA6 验收契约（`task_issue-424_sa6_contract.md`，verdict=approve）+ 适用规范（ADR 0032、`docs/protocols/instance-replication-v1.md`、CONTEXT.md 复制域）+ 批准设计迭代 1（`task_issue-424_design.md`，SA2 approve）
- Owner 评论：REST 快照为空数组（dispatch 明示）——**无 Owner 评论要求可纳入**，无被忽略的 override（与 SA6/SA8/SA2/SA3/SA4 五方结论一致）
- 审查方式：静态逐点亲验（交付 diff、五文件全读、规范行锚 sed 抽验、git 范围/纪律扫描、证据日志抽读）；未修改任何产物、未运行测试、未启动服务
- 结论：**`approve`** —— AC1–AC6 全部满足；无遗漏/部分实现/错误实现/scope creep；关键 AC 无 partial/unmet/unachievable；MINOR 观察不阻断

---

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| Issue 简报 | `wiki/raw/task_issue-424.md`（AC1–AC6；Comments 空） | 全读 |
| SA6 验收契约 | `wiki/raw/task_issue-424_sa6_contract.md`（§12.0–§12.8、NC1–NC4、硬门、GATE） | 全读 |
| 批准设计（迭代 1） | `wiki/raw/task_issue-424_design.md`（642 行） | 全读 |
| SA2 设计复审 / SA3 实现报告 / SA4 静态审查 / SA7 动态验证 | `task_issue-424_sa2_review.md` / `_sa3_impl.md` / `_sa4_review.md` / `_sa7_report.md` | 全读/抽验 |
| SA8 三道门禁 | `_conflict_report.md`（clear）/ `_design_conflict_report.md`（clear）/ `_implementation_conflict_report.md`（clear，requiresConflictRecheck=false） | 全读/抽验 |
| 交付物（被审对象） | `packages/ws-replication/test/issue424-sharded-hub.ts`（841 行）+ 4 个 `ws-replication-issue424-*.test.ts`（257/212/215/340 行，25 用例） | 全读 |
| 规范 | ADR 0032 决策 1–5/A1/A2-β/A3/后果；协议 §3 L57、§5 L114、§6.1 L137、§6.3、§7.1 L176、§12 L375、§13.1/§13.2、§14、§17 L582、§21 L684、§22 L701、§23.1 | sed 逐行抽验属实 |
| 交付证据 | `artifacts/issue424-{gate-full-suite,gate-typecheck,gate-scope,focused-determinism}.log` + `artifacts/issue424-sa7-*.log`（6 份，rebased 基线复采） | 抽读 |
| git 范围 | `git diff --stat efd958f..HEAD -- <全 DENY 面>`；`git diff --name-status efd958f..HEAD`；纪律 grep | 亲验 |

无缺失输入；上一阶段产物齐备且 verdict 链闭合（SA6 approve → SA8 clear×3 → SA2 approve → SA4 approve → SA7 approve）。

## 2. Verdict 与理由

**`approve`**。交付 diff 忠实满足 Issue 正文与 SA6 契约：

1. **范围精确**：交付 commit 在 `packages/` 下的全部改动 = ALLOW LIST 的 5 个 test-only 新文件（1865 行纯新增，零删除零修改）；`packages/ws-replication/src/**`、`packages/replication-protocol/**`、`packages/namespace-registry/**`、`apps/**`、`domains/**`、`docs/**`、`vitest.config.ts`、`tsconfig*.json`、`package.json`、`pnpm-*`、既有 455 个测试文件对父基线**零 diff**（亲验，与 gate-scope.log 三段一致）。零 scope creep。
2. **AC 全覆盖**：AC1–AC6 逐条映射到已提交断言（§3 表），契约条目 AUTH-C1~C5、ROUND-C1~C4、SHARD-C1~C3、SEQ-C1、TERM-C1~C3、REVOKE-C1~C3、REAUTH-C1~C2、GATE-C1~C3 与全部负控（NC1–NC4、AUTH-C5(a)(b)(c)、TERM-C3、REAUTH-C2、SD-2(b)、ROUND 装配前提）逐条在位且判据无削弱。
3. **规范一致**：测试引用的协议/ADR 行锚全部抽验属实；ADR 0032 决策 1（状态机单份，只装配公共工厂真身）、决策 2（缝只过字节/纯 JSON、`[8..12]` mux 盖章）、决策 3（authorize edge 单点、未授权不过缝）、决策 4（无 sink 合成 STATE_VIOLATION）、决策 5+A1（信号载体映射、回传序零改写）在夹具中逐条兑现；硬门三层判据（L1 控制帧字节 / L2 数据帧文档语义 / L3 全轨迹骨架）与契约 §12.1、协议 §22 L701 完全一致，未放宽未加严。
4. **门禁证据**：AC6 收官门禁（459 文件/5584 测试全绿、0 类型错误、根+包 typecheck exit 0、DENY 零 diff）证据已随交付 commit 落 `artifacts/`，且 SA7 在当前稳定父基线 `efd958f` 上独立复采复现。

## 3. Issue 要求 → 契约 → 已提交交付 逐项映射

| Issue AC（简报原文要点） | 契约条目 | 已提交交付（文件:行） | 判定 |
|---|---|---|---|
| **AC1** 授权等价矩阵：通过 / `NAMESPACE_UNAUTHORIZED` 拒绝 / authorizer 抛错 `INTERNAL_ERROR` / 闩锁期重 OPEN 拒答，四形态单体 vs 分片 wire 逐字节相同 | AUTH-C1~C5 + NC2/NC4 | `ws-replication-issue424-auth-parity.test.ts` 7 用例：C1（控制帧 hex 逐帧等 `HELLO_ACK#1 OPEN_OK#2 OPEN_OK#4` + 骨架等 + `BOOTSTRAP_SNAPSHOT#3` 文档语义等 + authorize 两形态各恰一次，L118-138）；C2（deny 全轨迹 hex 逐帧等 + 分片零会话零解析，L140-157）；C3（throw 全轨迹等 + 零会话 + 连接存活，L159-177）；C4（闩锁重开恰一帧逐字节等 + authorize 恰一次 ×deny/throw 双形，L179-194）；C5(a)(b)(c) 负控（L196-219）；NC2（pass 重开 `OPEN_OK×2`，L221-235）；NC4（协商形态 parity + 双协商位，L237-256）。硬门定义原文写入头注 L8-19（契约「必须写进测试注释」义务兑现） | ✔ 满足 |
| **AC2** 跨缝完整协议回合：OPEN→bootstrap→live→reconcile→CLOSE，含 `UPDATE_CHUNK` 协商与非协商两形态 | ROUND-C1~C4 + 装配前提 | `ws-replication-issue424-cross-seam-round.test.ts` 5 用例：C1（OPEN_OK×1/BOOTSTRAP×1/BOOTSTRAP_ACK 回指快照序/SYNC 三段各≥1/live/`encodeStateAsUpdate` 收敛，L145-148+L72-96）；C2（双向 UPDATE+ACK 回指+两侧 ROOT 更新+零 resync，L150-153+L99-121）；C3（CLOSE_OK 回指 L375 + settled 恰一次经缝，L155-158+L124-142）；C4（协商形态全回合复跑 C1~C3 + HELLO_ACK 与描述子协商位，L160-180）；boot TERM 收尾（close 同 promise + 会话收口 + pending 不增 + 零新出站 + 零 unhandled，L182-211）。每形态 boot 后引用同一性前提断言 `worker.registry === run.hubNode.registry`（L56-59，F-R1 闭合的可执行形态） | ✔ 满足（协商深度 = SD-4 最小读法，经 SA8 裁决不违约；深度分块矩阵归既有 #243/#246/#300/#301 资产锚，协议 §22 登记） |
| **AC3** 一条连接复用多 namespace 分属不同 session host：demux/mux 正确、出站 sequence 严格递增 | SHARD-C1~C3 + SEQ-C1 | `ws-replication-issue424-multi-worker.test.ts` 4 用例：C1（A/B 各恰一次解析、A→w0/B→w1、同 connectionKey，L62-88）；C2（出站覆盖两 ns、每 ns OPEN_OK 恰一且先于 BOOTSTRAP，L90-112）；C3/NC1（第三 ns 未 OPEN → 合成 `NAMESPACE_STATE_VIOLATION` + 零会话 + 连接存活 + 不落任一 worker + 双形态逐字节等，L114-159）；SEQ-C1（`[8..12]` BE 恰为 `[1..N]`——强于「严格递增」；每 ns 首帧序=注入序；同工厂第二连接首帧序=1 且首连接不受影响，L161-214） | ✔ 满足 |
| **AC4** 连接终结传播：edge 关闭 → 全部 session close 到达 + 资源释放（无泄漏断言） | TERM-C1~C3 | `ws-replication-issue424-lifecycle.test.ts`：C1（state=closed、两会话 closeCalls≥1、推进 30s 零新出站，L101-116）；C2（两 worker scheduler pending 不增 + `handle.close()` 同 promise + 零 unhandled，L118-146）；C3（连接隔离负控：关其一 → 另一零 close 零新出站，L148-186）；boot 形态面由 cross-seam-round 收尾用例覆盖 | ✔ 满足 |
| **AC5** revoke/reauth 经 edge 入口路由到正确 session（`terminateUnauthorized`）且 wire 与单体一致 | REVOKE-C1~C3 + REAUTH-C1~C2 | lifecycle：REVOKE-C1（terminate 恰一次 + ns `ERROR(NAMESPACE_UNAUTHORIZED)` + 末帧与单体 `hub.revoke` 逐字节等，L188-209）；C2（跨 worker 零外溢，L211-227）；C3（未知/已终态幂等无副作用，L229-246）；REAUTH-C1（GOAWAY(REAUTH_REQUIRED, drain>0)×1 → CLOSE → settled×1 → 零 deadline 推进下 close(1001)，L248-288）；REAUTH-C2（阴性对照不关闭，L290-310） | ✔ 满足 |
| **AC6** 既有 listen 全量套件 + 根 typecheck/test 绿灯（收官门禁） | GATE-C1~C3 | 证据随 commit 落位：`artifacts/issue424-gate-full-suite.log`（459 文件/5584 测试全绿、Type Errors no errors、exit 0；基线 455/5559 只增 +4/+25）、`-gate-typecheck.log`（根 typecheck exit 0 ×2）、`-gate-scope.log`（DENY 面零 diff/零触碰 + 纪律扫描命中 0）、`-focused-determinism.log`（聚焦 25/25 ×3 轮 + 包 tsc exit 0）；SA7 在当前父基线 `efd958f` 独立复采全绿（`-sa7-full-suite.log` 等 6 份） | ✔ 满足 |
| 「内存管道 + 一条连接、多 namespace、多会话宿主拓扑（模拟 ingress/worker 分片）」 | §12.0 交付路径 + SHARD 组 | 夹具 `issue424-sharded-hub.ts`：进程内内存管道（`makeRecordingPipe` L504-555）接线公共 `createHubReplicationEdge`（ingress）与 ≥2 公共 `createHubSessionHost`（worker 分片，各持真 Registry/Runtime，`makeShardedWorker` L194-217）；零 worker_threads/MessageChannel（ADR 0032 决策 2） | ✔ 满足 |
| 「证明 ADR 0032 的语义等价承诺」 | 全部六组 | 等价性证据 = wire 面（L1/L2/L3 三层硬门）+ 状态机行为；observer 面按 H8/协议 §23.1 排除（正确——形态差异已登记为文档化差异） | ✔ 满足 |

## 4. Owner 评论映射

REST 评论快照 = `[]`（dispatch 明示）。**无评论 id/时间戳可映射、无 Owner 附加要求、无被忽略的 override**。Owner 要求 = Issue 正文，§3 已逐项映射完毕。

## 5. 规范符合性抽验（亲验）

| 规范锚点 | 抽验结果 |
|---|---|
| 协议 §3 L57「sequence 从 1 严格递增」 | 属实；SEQ-C1 断言 `[1..N]` 精确序列 + 第二连接重起算 |
| 协议 §5 L114 / §6.1 L137（`0x42` 仅协商后；`CAP_CHUNKED_UPDATE=0x00000001`） | 属实；NC4/ROUND-C4 协商位断言在位未删 |
| 协议 §7.1 L176（OPEN 合流矩阵「每请求收答」） | 属实；AUTH-C1 重开 `OPEN_OK×2`、AUTH-C4 闩锁恰一帧 |
| 协议 §12 L375（`CLOSE_OK.ackedSequence` 回指 CLOSE_NAMESPACE sequence） | 属实；ROUND-C3 断言在位 |
| 协议 §13.1 L415 / §13.2 L424/L425/L430 / §14（错误注册表与 WS close code） | 属实；AUTH-C2/C3、SHARD-C3、SD-2(b)（1011 'protocol-error'）断言与注册表逐行吻合 |
| 协议 §6.3 / §21 L684（drain 提前完成 / deadline 1001） | 属实；REAUTH-C1 零推进下 close(1001) + 阴性对照 |
| 协议 §22 L701（三层确定性断言；Yjs clientID 使跨会话字节全等不适用） | 属实；夹具 L1/L2/L3 枚举白名单判据（L618-697）与之同构；AUTH-C5(a) 负控冻结该语料属性 |
| 协议 §23.1 / §17 L582（观测/计数口径形态差异登记） | 属实；25 用例零 observer/assembly 口径断言入 parity |
| ADR 0032 决策 1–5、A1/A2-β/A3、后果 L64-67 | 属实；夹具只装配公共工厂真身（零 fork）、桥只搬运（零应答合成/零缓冲/零重试）、四成员缝投影与信号映射逐行对应（fixture L323-421）、公共面零变更（append-only 冻结遵守） |

## 6. 范围与纪律核验（亲验）

- **diff 面**：`git diff --stat efd958f..HEAD -- <DENY 全面>` 空输出；`git diff --name-status` 除 wiki/raw 流水线产物外 = 14 份 `artifacts/` 证据日志 + 5 个 test-only 文件（全 `A`，零 `M`）。既有 455 测试文件零触碰（grep 无命中）。
- **纪律扫描**：新 5 文件零 `.skip/.only/.todo`、零 `process.env`（grep exit=1）；唯一 `setTimeout` 命中 = `makeAccountingTimer` 注入式假 timer 的接口实现（记账不触发）；载入面全为公共入口 + `./harness.js`/`./driver.js`，零深路径生产 import。
- **发现面**：4 个 `.test.ts` 命中 `vitest.config.ts` include 规则；夹具（非 `.test.ts`）入包 tsconfig include（`test/**/*.ts`）——门禁日志双双 exit 0 佐证。
- **硬门纪律**：判据未放宽（L1 五 kind/L2 四 kind 与契约逐 kind 一致）未加严；数据帧零字节断言；负控全部在位。

## 7. 未达成/偏差披露登记（PR 必须披露项的核对）

以下为交付链**已披露**事项（全部落在已提交产物内；无未披露项）：

| 项 | 性质 | 披露位置 | 状态 |
|---|---|---|---|
| D1–D6 实现与设计文本的登记差异（增补 `accept`/探针面成员/`makeAccountingTimer` 导出；TIMEOUTS 同值类型收窄；每轨迹新建 worker） | test-only 增补或 SA8 预裁定选项；零验收语义变更 | SA3 报告 §Deviations（已提交）；SA4 §4 逐条核 | 已披露，无阻断 |
| D5 `DEFAULT_REPLICATION_TIMEOUTS as SessionHostTimeouts` 收窄的 follow-up（生产侧放宽常量声明类型 = 公共面 append-only 新票） | 设计文本精度差，非生产缺陷 | SA3 §Deviations D5 + §Deferred 3；SA8 实现门禁 §8-2；SA4 §12-O3 | 已披露，归新票 |
| SA4 MINOR O1（`fires()` 结构性恒 0；判别力由「零触发 timer 下观察到 close(1001)」承载）、O2（`docStateOf` 不 apply `UPDATE_CHUNK` 载荷——当前语料不产生，判据 inert）、O4（facade `revoke`/`requestReauth` 无套件直接驱动——契约钉在 connection 级，一致）、O5（AUTH-C5(a) 依赖 clientID 不碰撞，失败方向安全）、O6（部分 pipe 场景未显式 close——per-test 进程内对象，maxWorkers 1 无干扰） | MINOR，不阻断 | SA4 §12（已提交） | 已披露 |
| 设计追加断言（SD-2(b) 退化负控、ROUND 装配前提）超出契约最小清单 | 不削弱任何契约条目；经 SA8  adjudication | 设计 §7.3/§12.0；lifecycle L312-339；cross-seam-round L56-59 | 已披露，合规 |
| 明确 follow-up（设计 §13）：SD-2/SD-3 宿主指引规范化（docs）、γ 真 worker 形态、确定性 clientID 注入、boot+多会话宿主夹具形态 | 本票非目标，非伪装 follow-up（任务内必要条件 §13 已全部交付） | 设计 §13；SA3 §Deferred 3 | 已披露 |

**无 SD-1 偏差**（套件未暴露任何生产偏差；`artifacts/issue424-deviation-*.log` 不存在 = 正确的零触发形态）；**无未达成的任务内必要条件**。

## 8. Findings

无 BLOCKER / MAJOR / MINOR 新增。SA4 §12 的 O1–O6 MINOR 观察经本轮复核成立且不阻断 approve（判据强度、inert 判据、follow-up 归属均已在交付链内正确登记）。

## 9. 结论

交付 diff 在稳定父基线 `efd958f` 上忠实、完整地满足 Issue #424 正文全部六条 AC 与 SA6 批准契约的全部条目；规范行锚与 ADR 0032 决策逐项相符；范围严格 test-only（DENY 面零 diff）；无遗漏、无部分实现、无错误实现、无 scope creep；应披露项（D1–D6、SA4 MINOR、follow-up 清单）全部已在已提交产物中披露。**verdict = approve**。
