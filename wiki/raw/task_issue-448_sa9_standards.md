# SA9 标准评审 — issue #448（γ-T2）：γ 异步缝 live update 数据面（verification-only 契约落盘）

- Dispatch：`sa-b236e88e-ea70-458d-89e8-ce4c347959f1`（mabf-sa9 / standards-review / iteration 0）
- 评审对象：branch `mabf/issue-448` 的最终提交 diff——commit `0c92b3ebe991e056a874c1030f182414b686a1ba`（`test(ws-replication): add live update data plane contract`），父 = `321d951b76a39136322614296cdcc560c2dc6ab7`（= 派工声明的 PR #446 权威头，`git rev-parse` 实查解析一致、为 HEAD~1）
- 评审方式：独立只读静态复核。SA9 实读任务简报、设计、SA2/SA3/SA4/SA6 产物与两份冲突报告全文，逐行读回提交内的全部代码改动（契约 684 行、夹具 133 行、append diff +10/-0），抽核规范原文（协议 §23.1/§24.8、模块 `AGENTS.md`、根 `vitest.config.ts`）、仓库惯例（命名/变异先例/artifacts 入库/提交信息格式）与 git 事实（文件模式、whitespace gate、scope diff）。未运行测试、未启动服务、未修改任何文件。
- Owner 评论：派工明示 REST 读取为空数组 + 简报 `## Comments` 空——无可映射的 owner 追加要求。

---

## 1. Verdict

**`approve`**（0 BLOCKER / 0 MAJOR；3 条 MINOR 见 §9，均不阻断）。

提交严格落在批准设计 §11 ALLOW LIST 内，DENY 面零触碰；verification-only 裁定（零生产实现面）经 SA9 独立抽核与仓库事实无矛盾；测试质量、单一事实源、生命周期对称性、架构惯例各项标准逐项满足（§3–§8）。

---

## 2. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-448.md`（简报：Issue 正文 6 AC + `Blocked by #447` + Parent PR #446；Comments 空） | 在场，已读（提交内 32 行版） |
| `wiki/raw/task_issue-448_design.md`（SA1；§7-D1 verification-only / §7-D2 契约落盘 / §7-D3 append-only / §7-D5 验证门 / §11 ALLOW-DENY） | 在场，全文已读 |
| `wiki/raw/task_issue-448_sa2_review.md`（`approve`，0B/0M，O1–O4） | 在场，全文已读 |
| `wiki/raw/task_issue-448_sa3_impl.md`（落盘/守门 + V0–V4） | 在场，已读（提交内 138 行版；worktree 另有未提交追补，见 §9-M1） |
| `wiki/raw/task_issue-448_sa4_review.md`（`approve`，0B/0M，O1–O5） | 在场，全文已读 |
| `wiki/raw/task_issue-448_sa6_contract.md`（`approve`；反向诊断 + 13 锚 + NC-1…NC-7） | 在场，全文已读 |
| `wiki/raw/task_issue-448_design_conflict_report.md`（SA8 设计后 `clear`、`requiresConflictRecheck: false`） | 在场（verdict 节实读） |
| `wiki/raw/task_issue-448_implementation_conflict_report.md`（SA8 实现后 `clear`、`requiresConflictRecheck: false`） | 在场（verdict 节实读） |
| 提交内代码面：`ws-replication-issue448-live-data-plane.test.ts`（684 行 / 恰 13 `it(`）、`issue448-live-seam.ts`（133 行）、`issue447-async-seam.ts`（+10/-0） | 全部逐行读回 |
| 证据日志 ×5（contract-run / repeat5 / package-suite / package-suite-precontract / package-tsc） | 在场，关键数字抽核自洽 |
| 规范原文：`docs/protocols/instance-replication-v1.md`（§23.1 事件表 :745/:747/:749/:751、§24.4 :1126、§24.8 :1149-1152）、`packages/ws-replication/AGENTS.md`、根 `AGENTS.md`、根 `vitest.config.ts` | 实读对照 |

---

## 3. 仓库 AGENTS 与模块责任

| 标准 | 证据 | 判定 |
|---|---|---|
| 根 AGENTS「改动前读最近嵌套 AGENTS.md」 | `packages/ws-replication/AGENTS.md` 已被各上游阶段与本评审实读；其 Boundary/Verification 条款在设计 §6 逐条落实 | **符合** |
| 模块 Boundary：γ 缝 append-only、β 同步冻结逐字不动、缝词汇闭集合无拒纳/闸门/信用词汇 | 提交对 `packages/ws-replication/src/**` **零 diff**（`git show --stat` 全文件清单实查）；缝词汇零新增——`edgeObserver` 是测试夹具 options 成员，非缝消息/事件型/错误码 | **符合** |
| 模块 Boundary：生产 API 经 `src/index.ts`；测试控制在显式测试面 | 两新文件均在 `packages/ws-replication/test/`；生产导出面零触碰 | **符合** |
| 模块 Verification 门：状态机路径改动跑聚焦测试；缝变更加跑拆分契约/parity；wire/生命周期变更加跑根门禁 | 本票零生产/零 wire/零生命周期改动 ⇒ 根门禁触发条件不满足；设计 §7-D5 仍指定包级全量（101 文件/897 用例）+ 包 tsc（exit 0）作交付证据，**超出 test-only 改动的最低要求**；根 `pnpm test`/`pnpm typecheck` 显式登记 defer 至 CI 与 #451（设计 §7-D5/§12、SA3 Deferred verification 表） | **符合**（deferral 已登记，见 §9-M2） |
| 根 AGENTS Typed Namespace writes 强制条款 | 不适用——本票零 Namespace 写路径代码；测试经既有 driver 的 `writeHub` 业务写驱动，不触碰 `mutateData`/schema 投影面 | **N/A** |
| 根 AGENTS worktree 纪律（仓库本地 `.worktrees/`） | worktree gitdir = `/home/wangjian/nomicore/.git/worktrees/nomicore-fix-issue-448`（`.git` 指针实读） | **符合** |
| 责任归属：应用层（测试夹具）只编排/观测投影，零协议决策 | `issue448-live-seam.ts` 头注释明示纪律；全文实读：仅 boot adopt 装配 + registry 同一性/连接数恰 1 前提断言 + 观测投影（`dataFramesSent`/`hubFrames`/`events`/`fatalSignals`），不合成应答帧、不选错误码、不复制状态机 | **符合** |

---

## 4. ADR 与规范一致性

| 规范条款 | 提交落点 | SA9 抽核 |
|---|---|---|
| ADR 0032 附录 A4 / 协议 §24 是被锚定的权威，非被修订对象 | `docs/**` 零 diff | **符合**——零语义变化 ⇒ 无文档同步义务 |
| §24.8：`update-sent` 在 edge 盖章点；`update-acked`/chunked 族在 session 结算点；`ackLatencyMs` t0 = 推送时刻 | LIVE-OBS-C1（`update-sent` sequence = wire 序、bytes = 载荷长）、LIVE-ACK-C1（k=7/m=5 ⇒ `ackLatencyMs === 12`）+ NC-5 变异（rekey 重采样 ⇒ 退化为 m 必红） | **符合**（原文 :1149-1152 实读逐句对上） |
| §24.8「跨线程事件无全序」 | 契约**零跨线程事件序断言**；LIVE-ORD-C1 仅断言单通道 FIFO 消费序（`delivered()` 下标 strict 先行） | **符合**——规范内的正确断言形态 |
| §23.1 事件字段集：`chunked-update-acked` 键集冻结（无 `sequence`）；宿主直驱帧 `sendQueueMs` 整键缺席 | LIVE-DRAIN-C1 `not.toHaveProperty('sequence')`；LIVE-OBS-C1 `not.toHaveProperty('sendQueueMs')` ×2 | **符合**（:745/:749/:751 实读一致；缺席断言是登记缺面守门，非实现主张——设计 §7-D4） |
| §24.4 两相记账（pending 自推送占窗、rekey 换键不换槽） | LIVE-WINDOW-C1/C2：恰 2 帧过缝、放回执不释放槽、ACK 后第 3 帧、4 笔全结算后第 4 笔直推 | **符合**（:1126 实读一致） |
| 模块 Boundary：edge 盖章单点、session 编码 `sequence=0` 占位 | 契约以 `probes.stamps`（盖章事实）回读配对，不自行推导 wire 序 | **符合** |

---

## 5. 既有架构惯例

| 惯例 | 证据 | 判定 |
|---|---|---|
| 测试命名 `ws-replication-issueNNN-*.test.ts` / 夹具 `issueNNN-*.ts` | `git ls-files packages/ws-replication/test` 实查：issue137/420/424/447 同款命名成排 | **符合** |
| 变异敏感性负控形态（`await import('../src/update-channel.js')` prototype 注入 + `finally` 恢复） | #447 先例实存：`ws-replication-issue447-async-session-round.test.ts:443`；本契约 NC-4（:139-171）/NC-5（:307-362）同款且 `try/finally` 恢复对称 | **符合** |
| β parity 判据复用 #424 ORACLE-2 helpers | `issue424-sharded-hub.ts` 六导出（`framesHexEqual`/`controlFramesOf`/`dataFramesOf`/`skeletonOf`/`docStateOf`/`makeShardedReplicationFacade`）经动态 import + 结构类型投影复用，不重造判据 | **符合** |
| `artifacts/` 证据日志入库 | 仓库已跟踪 380 个 artifacts 文件（`git ls-files artifacts | wc -l`）；`.gitignore` 不排除该目录 | **符合** |
| 提交信息格式 | `test(ws-replication): add live update data plane contract`——与历史（`feat(ws-replication): …`、`test(ws-replication): …`、`docs: …`）同款 conventional 格式 | **符合** |
| 验证环境开关 | 仅 `NODE_OPTIONS=--conditions=nomicore-source`（仓库既有测试脚本同款条件导出，非伪造开关） | **符合** |

---

## 6. 单一事实源与生命周期对称性

**单一事实源**（契约只回读权威事实，不镜像、不推导）：

| Fact | Authoritative source | 契约读法 | 判定 |
|---|---|---|---|
| wire 序 | edge 盖章返回值（`probes.stamps`） | `stampOfSequence` 回读盖章记录与扣留缓冲回执配对；事件 `sequence` 与之逐位相等 | **无第二事实源** |
| 窗口占用 | `effectiveInFlightCount` 单点（生产） | 外部观察（过缝帧数/事件数恰 N），不镜像内部账本 | **无** |
| tag↔序配对 | 盖章事实 + 回执缓冲 | 断言回读，不推导 | **无** |
| 观测归属 | §24.8 发射点归属 | 单 recorder 双挂 + 恰一次计数 + 字段值判别 | **无**（理论残余判别力已由 SA4 §12-O2 登记，非本评审新增面） |

**生命周期对称性**：

| Acquire | Release | 判定 |
|---|---|---|
| 变异 prototype 注入（NC-4/NC-5） | `finally` 恢复原引用（:168-170、:359-361 实读） | **对称**；根 `vitest.config.ts:17` `maxWorkers: 1` 串行 ⇒ 无跨文件污染面 |
| 每用例 boot round（独立 registry/scheduler/wire） | 无显式 teardown——与 #447 套件同款先例；全内存、每回合独立 scheduler | **可接受**（SA4 O3 已登记为 TRIVIAL 惯例维持） |
| 生产生命周期 | 零生产改动 ⇒ 零影响 | **N/A** |

---

## 7. 文件范围

提交全文件清单（`git show --stat --raw` 实查）对照设计 §11：

| 提交内路径 | ALLOW/DENY 对照 | 判定 |
|---|---|---|
| `packages/ws-replication/test/ws-replication-issue448-live-data-plane.test.ts`（新增 684 行） | ALLOW 第 1 项 | **合规** |
| `packages/ws-replication/test/issue448-live-seam.ts`（新增 133 行） | ALLOW 第 2 项 | **合规** |
| `packages/ws-replication/test/issue447-async-seam.ts`（M，**+10/-0**） | ALLOW 第 3 项（append-only） | **合规**：两 hunk 纯新增（7 行 doc-comment+可选成员、3 行条件展开）；既有行零改写；缺省零传 = `...(undefined ? {} : …)` 展开为空 ⇒ #447 行为逐字不变；edge 工厂调用段实读确认先前无 `observer` 键、无键遮蔽（:434-445） |
| `artifacts/sa6-issue448-*.log` ×5（新增） | ALLOW 第 4 项 | **合规** |
| `wiki/raw/task_issue-448{,_design,_design_conflict_report,_implementation_conflict_report,_sa2_review,_sa3_impl,_sa4_review,_sa6_contract}.md`（新增 ×9） | ALLOW 第 5 项 + §11 注记（下游流水线产物各自 dispatch 授权） | **合规** |
| DENY 面：`packages/ws-replication/src/**`、`docs/**`、`CONTEXT.md`、模块 `AGENTS.md`、`packages/replication-protocol/**`、根 `vitest.config.ts`/`tsconfig*.json`/`package.json`、`pnpm-lock.yaml`、#447 三个 `.test.ts` 本体、#449/#450/#451 范围面 | 提交清单逐项核对 | **全部零 diff，无越界、无未列改动、无临时/_scratch 文件混入** |
| 文件模式 | `git show --raw`：新增全部 `100644`（SA2 O3 的 0600 权限已由 SA3 chmod 归一） | **合规** |
| 白空格门禁 | `git show 0c92b3e --check` **exit 0**（iteration 1 的 3 处 `blank line at EOF` 修复已含在提交内：契约 684 行、简报 32 行、precontract 日志 248 行——与 SA3 追补表一致） | **合规** |

---

## 8. 测试质量标准

| 标准 | SA9 实查 | 判定 |
|---|---|---|
| 零 `skip/only/todo`、零 `process.env`、零 `vi.useFakeTimers/spyOn` | grep 实查两新文件全部 exit 1（无命中）；时源为注入式 `makeManualClock`（非全局 fake timer） | **符合** |
| 断言 = 运行时行为（非源码 grep 式） | 13 用例逐条实读：wire 帧 kind/序、`[8..12]` 盖章配对、缝消费序下标、observer 单事件字段值、文档快照逐值、peer 收敛值 | **符合** |
| 断言非恒真（负控/变异有牙） | NC-4（剥 `pendingSends` ⇒ 断言第 3 帧必过缝 =3，**自我验证式**：变异无效则 2≠3 自红）、NC-5（t0 重采样 ⇒ `= m` 必红）、NC-1/NC-2（违契注入 ⇒ 响亮 `ACK_STATE_VIOLATION`）、NC-6（43→44 ⇒ 语义比对必报差异）、NC-7（时间/泵零驱动）——均在同一次运行内且 `finally` 恢复 | **符合** |
| 测试入口真实 | 根 `vitest.config.ts:15` `include = ['packages/*/test/**/*.test.ts', …]` 逐字命中新文件；包 `tsconfig.json` `include` 覆盖 `test/**/*.ts`（两新文件）；包全量证据 101 文件/897 用例（= 100/884 基线 + 本契约 13，数字自洽） | **符合** |
| 夹具纪律（复用不复制） | `issue448-live-seam.ts` 复用 #447 装配面（`makeAsyncReplicationFacade`/`pumpUntil`/`wireFramesOfKind`/`makeAsyncObserver`）+ registry 同一性、连接数恰 1 前置断言（:100-108）防错位装配 | **符合** |
| 证据链诚实 | 契约在 baseline 即绿——**不伪称红灯**；历史红依据（pre-T1 `c86ccbc` 零 γ 面）为 git 级事实；tsc 门 `exit=0` 显式记录（落实 SA2 O1）；日志数字自洽（13/13、43/43 = 13+15+7+8、101/897） | **符合** |
| 确定性/无竞态 | 显式 release + 扣留 + 手动时源 + 有界微任务泵；零真实 timer/网络/长驻服务 | **符合** |
| 断言诊断信息 | 每条 `expect` 携中文判据说明（AC 锚 + 预期语义） | **良好实践** |

---

## 9. Findings（全部 MINOR，不阻断）

- **M1（MINOR，流水线文档漂移）**：提交内 `wiki/raw/task_issue-448_sa3_impl.md` 为 138 行的 iteration-0 版，仍引用契约 686 行口径且不含「iteration 1 追补」段；而追补（178 行版，记录 whitespace 修复与 W1–W5 复验）目前仅以**未提交**的 worktree 修改存在（`git status`：`modified: wiki/raw/task_issue-448_sa3_impl.md`）。whitespace 修复本体已在提交内，故仅属 wiki 报告与提交态的口径漂移，且修正已在 worktree 就位——收尾阶段一并提交即可。不影响代码/测试/验收语义。
- **M2（MINOR，已登记的验证 deferral）**：根 `pnpm typecheck`/`pnpm test` 全仓门禁未在本票运行，显式 defer 至 CI 收尾与 #451（设计 §7-D5/§12、SA3 Deferred verification 表）。模块 AGENTS 的根门禁触发条件（wire/lifecycle change）不满足，包级全量 + 包 tsc 证据已超 test-only 改动最低要求。登记以便 SA10/收尾方知晓残余门禁。
- **M3（MINOR，上游遗留措辞）**：SA2 O2（设计 §11 DENY 行「`issue447-*.test.ts` 之外的既有 #447 套件语义」字面可误读）在提交内设计文本中仍未修订；SA2/SA3/SA4 均判语义无歧义、按范围不处理。维持非阻断。

（登记而非 finding：SA4 §12-O2 关于 LIVE-OBS-C1 归属判别在 tag≡wire 序巧合下的理论残余敏感度——规范内断言形态正确，由恰一次计数 + #423 族 edge 锚共同兜底。）

---

## 10. 结论

- 提交 `0c92b3e` 在仓库 AGENTS/模块规约、ADR 0032 附录 A4 与协议 §24、单一事实源、生命周期对称性、文件范围（ALLOW 全命中 / DENY 零触碰）、测试质量（行为断言、负控/变异有牙、入口真实、证据诚实自洽）各维度**全部符合标准**。
- 与上游链条（SA6 `approve`、SA2 `approve`、SA8 设计/实现双 `clear`、SA4 `approve`）一致；SA9 独立抽核未发现与仓库事实的矛盾。
- **Verdict：`approve`**；`requiresConflictRecheck: false`（零生产语义变化，无新增协议决策——与两轮 SA8 门禁同向）。
