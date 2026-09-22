# SA4 实现静态审查 — issue #442：lease `mutateData` 端到端 Record/parent 逐 entry 校验行为钉死（ADR 0034）

- 审查对象：SA3 落盘的 3 个新测试文件（`packages/namespace-registry/test/issue-442-lease-record-e2e-{fixture,contract,control}.ts`，640/603/154 行）
- 审查人：SA4（实现静态审查；未修改任何实现/设计/测试，未运行测试、未启动服务）
- Worktree：`/home/wangjian/nomicore-fix-issue-442`（HEAD `c42fb47`，分支 `mabf/issue-442`）
- iteration 0（无既有 `task_issue-442_sa4_review.md` 需原位修订；本文件为首版）

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-442.md`（Issue #442 正文、AC1–AC7、Blocked by #441、Comments 空） | 已读 |
| 批准设计 | `wiki/raw/task_issue-442_design.md`（449 行） | 已读全文 |
| SA2 设计评审 | `wiki/raw/task_issue-442_sa2_review.md`（approve，Required revisions 空，O-1..O-5） | 已读全文 |
| SA6 验收契约 | `wiki/raw/task_issue-442_sa6_contract.md`（approve，§12.1–§12.4 冻结规格） | 已读全文 |
| SA8 设计冲突报告 | `wiki/raw/task_issue-442_design_conflict_report.md`（clear，RA-1/RA-2/RA-3） | 已读全文 |
| SA3 实现报告 | `wiki/raw/task_issue-442_sa3_impl.md`（含 §8 两处偏离申报） | 已读全文 |
| SA6 探针 + 证据日志 | `wiki/raw/task_issue-442_sa6_capability_probe.mts`、`artifacts/sa6-issue442-*.log`（14 件） | 抽读 + 存在性核对 |
| SA3 验证证据 | `artifacts/sa3-issue442-{focused-stability,root-typecheck,root-test,baseline-discrimination}.log` | 已核对关键行（§8/§9） |
| 被审实现 | `packages/namespace-registry/test/issue-442-lease-record-e2e-{fixture,contract,control}.ts` | 已逐行读全文 |
| 母法/先例 | `docs/adr/0034-…md`、`docs/adr/0033-…md`、`packages/doc-runtime/src/mutation-local.ts:285-345`（闸门亲读）、`CONTEXT.md` L144/L202（逐 entry 例外 / 触达面收窄词条） | 已读 |
| 结构先例 | `packages/namespace-registry/test/issue-437-lease-array-e2e-fixture.ts`（相对源码导入 L46、settleUntil rounds=200） | 已抽读 |
| 被测公共面源码 | `packages/namespace-registry/src/{lease.ts,testing.ts,types.ts,index.ts}`、`packages/namespace-diagnostic-log/src/{index.ts,record.ts,schema.ts}`、`packages/persistence/src/index.ts` | 亲证导出名与字段 |
| Runner/构建面 | `vitest.config.ts`（include / maxWorkers:1 / typecheck.include）、`packages/namespace-registry/tsconfig.json`（include 仅 `src/**`） | 亲证 |
| 缺失输入 | `task_issue-442_relevant_decisions.md`、`task_issue-442_conflict_report.md`、`task_issue-442_sa7_report.md` | 确认不存在（iteration 0；设计 §6/§14 与 SA8 复审已闭合该缺口） |

独立复核命令（本会话执行，只读）：`git status --short`、`git diff --stat`（空）、`git worktree list`
（baseline worktree 已移除）、`grep`（skip/only/todo/env/setTimeout/readFileSync）、`ls packages/namespace-registry/test/`、
`grep -c "it("`（契约 29 / 负控 4）。

## 2. Verdict

**approve**。

无 BLOCKER、无 MAJOR finding。实现是**纯测试新增三件套**（契约 29 its + 负控 4 its = 33），逐 ID 逐断言
承接 SA6 契约 §12.3 全部冻结值（本评审逐行核对，含 B7 path `[]`、C1 `ROOT.mz`/`['mz']`、V2 恰 2 条联合
issue、U3/U4/V3 的 ≤8/≥n/跨 n 相等、E1/E2 形态与键集同构、R1–R3 收敛/最小增量/污染保留），零生产改动、
零 DENY 触碰、零 skip/only/todo、零 env override、零源码字符串断言；两处实现偏离（§8）均为有据的非软化
决策且经基线证据双面验证。根 gate 证据（473 files / 5790 tests、typecheck exit 0）与设计 §12 验证命令
及 SA8 RA-2/RA-3 口径（枚举 33、5790）逐项相符。4 条 MINOR 观察见 §12，不阻断。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| Issue 正文「本 ticket 不改实现，只把新语义在最高 seam 上立法成回归测试」 | `git diff --stat` 空；`git status --short packages/` 恰为 3 个新测试文件；被测面全部经 `createNamespaceRegistryForTesting` → `registry.open`/`importReplica` → `lease.mutateData`/`readData` | 落实。零生产改动；seam 为 lease（最高） |
| AC1 行为变化钉正（污染 Record/封闭对象写删目标键合法即成功） | 契约 `describe('issue #442 AC1 — …')` A1–A11（contract L117-274）：`expectOk` + 污染保留（`'oops'`/`qty:'x'`/`deep===5`/`nope` 在场）+ `updateCount` 差值恰 1 + 终态键值 | 覆盖。11 用例含载体错位/值非法/键违约/值位 union/深层/批量/封闭对象三态 |
| AC2 不变量钉死（键 Pattern/非法新值零写入 + issue 路径、no-op delete、必填拒/unknown 允许） | AC2 组 B1–B8（L278-375）：`expectRejected` 逐字 `toBe` message + `toEqual` path + 三面零写入锚 | 覆盖。B7 path `[]`、B8 深度 rebase `['outer','inner','n2','qty']`、B5/B6 允许面 |
| AC3 union map 位端到端行为与性能路径不变 | 负控 C1–C3（control L94-133）+ 契约 U3 union 半（`maybe` ≥ n） | 覆盖。C1 同污染同 op 的 A/B 对照证 A 组 `ok:true` 非恒真 |
| AC4 Record 值位 union 仍 fast path | V1–V3（L425-477）：两支成员接受、V2 恰 2 issue 逐字、V3 ≤8 且 n=64/256 相等 | 覆盖 |
| AC5 诊断烟测（committed update bytes 记录形态不变） | E1/E2（L481-529）：恰 1 root-mutation attempt、stage/source/result/carrier 形态、重放 oracle、空 doc 不物化、键集同构 | 覆盖。未钉 `payloadLength=43`/`crc32c` 魔数（设计 §7.5.3 明示证据值非断言字面量） |
| AC6 复制烟测（经 replication apply 收敛、无协议面变化） | R1–R3（L533-602）：peer 收敛 + diff 定点 + session 四域、最小增量 + 1 提交=1 事件、污染保留 | 覆盖。协议承载物（update bytes）零变化，仅消费公共 session 面 |
| AC7 根 `pnpm typecheck`/`pnpm test` 绿 | `artifacts/sa3-issue442-root-typecheck.log`（`ROOT_TYPECHECK_EXIT=0`，15 包）；`artifacts/sa3-issue442-root-test.log`（**473 files / 5790 tests passed**，`Type Errors: no errors`，`ROOT_TEST_EXIT=0`） | 达成。5757+33=5790、471+2=473 与 SA8 RA-2 枚举口径逐项吻合 |
| Owner 评论要求 | REST issue-comment `[]`、简报 Comments 段空（Host 明示 none） | 无 owner 附加要求；实现未虚构映射，唯一需求面 = AC1–AC7 |
| SA2 O-1..O-5（均 MINOR 无需动作） | SA3 报告 §4 逐条落实；O-4 的「零 update」维度由三面锚实现（见 §8 偏离 1） | 落实 |
| SA8 RA-1（条款指针勘误，登记于实现期备注位） | SA3 报告 §4 行 7：软验收规范出处更正为 ADR 0034 后果-验证基准条款 + ADR 0033 决策 6；本票断言面（机器无关读计数）合规 | 落实（登记不阻断） |
| SA8 RA-2（按枚举 33 落盘；准绳 = 零 skip + 逐 ID 覆盖 §12.3 全表） | 落盘 29+4=33；`grep` 零 skip/only/todo；33 个 ID 逐一在位（§6/§9 核对）；根 test 5790 | 达成 |
| SA8 RA-3（既定门：聚焦面 33 全绿 + 根 gates） | focused 3 轮 33/33（`sa3-issue442-focused-stability.log`）+ 根 gates（上行） | 达成 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §7.1 三文件交付（fixture 非测试入口 + 契约 29 + 负控 4，独立负控文件） | 三文件齐备；fixture 文件名不含 `.test.ts`（vitest include `packages/*/test/**/*.test.ts` 不收集，`vitest.config.ts` 亲证）；负控独立于契约文件（SA6 §12.4 纪律） | 一致 | — |
| §7.2.1 导入面全公共 + 零 vitest 依赖 | fixture 仅 import `yjs`、`@nomicore/persistence`（type）、`@nomicore/namespace-registry`（type）+ `/testing` + `../../namespace-diagnostic-log/src/index.js`；全文件零 `vitest` import（grep 实证）；本地 `assert` + 有界 `settleUntil`（rounds=400，与探针一致；#437 为 200——SA2 O-3 已裁定「同款」指纪律非数值） | 一致（相对源码导入 = #437 fixture L46 逐字先例） | — |
| §7.2.2 schema/seed/常量逐字冻结 | `SCHEMA_442.text` 与 SA6 §12.2 schema 逐字相同（七字段逐行比对）；seed `n=1`、`tasks t0..tN-1 (i%100)+1`、`codes id-1`、`blobs/maybe b*/m*`、`outer.inner n1`、`obj req/opt/unk/deep` 全同；常量 NS/OWNER(frozen)/NOW_MS/hub-442/peer-442/4242/999999（peer 4243、重放 987654）逐值相同 | 一致 | — |
| §7.2.3 fixture 形状（updateEvents 在 open 前挂 / peer 在 import 后挂 / `applyRawRemote` 只经 `session.applyRemoteUpdate` / doc 引用仅装置面） | `openLeaseFixture` L300-302（open 前挂）；`openPeerFixture` L401-404（import 后挂）；`applyRawRemote` L570-583（远端副本 clientID 999999 → 增量 → `session.applyRemoteUpdate`，assert `ok`）；`rawMapAt`/`rootMap` 仅用于污染构造与读计数导航，断言一律经 `readValue(lease,…)` | 一致 | — |
| §7.2.4 Map 读计数助手（8 出口、覆盖整个 await 窗口、finally 零残留） | `countMapReadsAsync` L498-561：`get/has` 逐次、`keys/values/entries/toJSON/Symbol.iterator/forEach` 各按 `map.size`；包装先装后 `await run()`、`finally` `delete` 全部 8 个 own 属性（实例遮蔽原型，删除即还原） | 一致 | — |
| §7.2.5 确定性纪律（零时钟/计数随机/受控 scheduler/clientID 固定/污染一律新键，唯一同键覆盖 `obj.deep`） | 固定 `NOW_MS`、`makeCounterRandomBytes`（16-byte 幂等序列，非 16 即 throw）、`createRegistryTestScheduler`；污染键 `t9/nope/b9/n9/mz` 全为新键，唯一同键覆盖 `obj.deep→5`（A6/A7/A8/B7 组外无同键污染） | 一致 | — |
| §7.3 契约 29 its（AC 分组 describe、断言与冻结值逐字承接） | 6 个 describe（AC1–AC6）× 29 its；逐 ID 断言集合与 SA6 §12.3 / 设计 §7.3 全表逐行核对相符（§9 详表） | 一致 | — |
| §7.4 负控 4 its（恒绿 + A/B 对照） | C1（同污染同 op 在 union map 位照旧逐字拒绝 `Yjs 载体错位（ROOT.mz）` path `['mz']`）、C2（干净 set/delete ok）、C3（maybe n=64 ≥ n）、C4（ROOT.tasks 载体位 path `[]`） | 一致 | — |
| §7.5.1 逐字 message/path（`toBe` 非 `includes`） | `expectRejected`：`issues[0].message).toBe(message)` + `path).toEqual([...path])`；V2 用 `toEqual` 钉**恰 2 条** issue 的完整数组 | 一致 | — |
| §7.5.2 「不修复」负向断言形态（污染逐字不变 + 恰 1 update；不为不修复引入文档级字节全等） | A1–A11 均以 readData 逻辑值断言污染保留 + update 差值恰 1；`stateBytes` 全等只用于拒绝分支 | 一致 | — |
| §7.5.3 成本断言 = 形态 + 不等式 + 跨规模相等，不钉精确值/毫秒 | U3/U4/V3/C3 仅 `≤8` / `≥n` / 相等；E1 只 `payloadLength>0` + `/^[0-9a-f]{8}$/` | 一致 | — |
| §7.5.4 判别性由 SA6 基线证据承载（交付测试不携带 baseline 分支/环境变量） | 两测试文件零 `process.env`、零 CLI 参数分支（grep 实证）；判别性由 SA6 probe-baseline 4 轮 + SA3 复核（§8）承载 | 一致 | — |
| §7.6/§7.7 非重复立法边界与备选否决 | 未触碰 #440/#441/#441-frozen/#437 文件；未复用 `registry-phase5-replication-session-red` 夹具；未引入毫秒阈值；fixture 未 import vitest | 一致 | — |
| §8 四条数据流路线（污染注入/业务写/诊断扇出/复制收敛） | 测试装置驱动顺序与设计表逐行对应（applyRawRemote 前置 → mutateData → settle → 断言） | 一致 | — |
| §9 错误语义（装置前提 throw 红、被测行为只断言返回值） | fixture `assert` throw（含 JSON 判别体消息）；`readValue`/`applyRawRemote`/`openLeaseFixture` 对装置失败 throw；`mutateData` 结果只走 `expectOk`/`expectRejected` | 一致 | — |
| §10 调用方矩阵（vitest 收集 +2、typecheck 不变、生产调用方零变化） | include 面亲证命中；registry tsconfig 仅 `src/**` ⇒ 新文件不进包 tsc 面（根 typecheck exit 0 实证）；零生产改动 ⇒ 生产调用方零影响 | 一致 | — |
| §12 验证命令 1–5 | 命令 1/5（3 轮 33/33）、2（exit 0）、3（473/5790）、4（15 红/18 绿）全部有日志证据且数字相符 | 一致 | — |
| 设计明确但实现缺失 | 无——全部 §7.2–§7.4 装置与用例在位 | 无缺失 | — |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| lease seam 行为立法（信封门/批量折迭/诊断泵/复制扇出叠加面） | `packages/namespace-registry`（AGENTS.md：lease 是独立 caller capability） | 三件套落 `packages/namespace-registry/test/` | 正确 |
| 生产语义（闸门/域规则/S9） | doc-runtime/vfsl（#440/#441 已锚） | 未重复立法（无 `src` 改动、无 #441/#440 文件触碰） | 正确——不越权复制底层状态机 |
| 污染注入通道 | trusted raw replication 面（ADR 0010） | 只经 `session.applyRemoteUpdate`；`doc` 引用仅装置面 | 正确 |
| 诊断观察 | 只读消费既有 emitter（ADR 0011 best-effort） | `createBoundedMemoryDiagnosticLog` 生产形状 binding（同 #437 fixture L281-299 先例），不 wire 新发射 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| lease 端到端立法三件套（ADR 0033 数组案） | `issue-437-lease-array-e2e-{fixture,contract,control}.ts` | 同构独立成套（schema/助手族不同；Map 读计数为数组版对偶） | 一致 | per-issue fixture 惯例（369/383/387-390 同款）；共享会耦合红因 |
| 诊断生产形状 binding | #437 fixture `:281-299` | 同款 options + emitter/runtimeEmitterFor | 一致 | 生产形状先例 |
| 相对源码导入诊断包 | #437 fixture `:46` | 同一 import 语句形态 | 一致 | 既有先例（诊断包本就是 registry 依赖） |
| 会话夹具复用 | `registry-phase5-replication-session-red` | 不复用（设计 §7.7-2 否决） | 一致（有据偏离） | 该夹具锚会话语义、无 schema ROOT/诊断/读计数 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 冻结行为值 | SA6 契约 §12.3 + probe EVIDENCE（HEAD 实测） | 测试断言字面量 | 无——逐字承接（本评审逐条比对，含 V2 两 issue 全数组、B7 path `[]`） |
| 用例基数 | §12.3 逐 ID 枚举（33） | 落盘 33 / 根 test 5790 | 无——SA8 RA-2 仲裁已闭环，实测一致 |
| fixture 常量 | 文件内私有冻结（`_442` 后缀区分导出面） | 无外部镜像 | 无（与 #437 常量重名由模块隔离消解，R-7） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| `openLeaseFixture`/`openPeerFixture`（open/import + session + 订阅） | 不显式 teardown（#437 先例：纯内存装置、fake scheduler、vitest worker 回收，无端口/句柄/长驻进程） | 装置失败即 assert throw（红） | 可接受——先例一致；唯一的就地 acquire/release（读计数包装）在 `finally` 对称删除 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套读计数助手 | #437 `countElementReadsAsync`（Y.Array） | `countMapReadsAsync`（Y.Map 8 出口） | 非重复——载面对偶（设计 §7.2.4 明示新移植） |
| 第二套 lease fixture | #437 fixture | 独立 #442 fixture（互不 import） | 非重复——schema/断言族不同 |
| 新 runner/脚本/门 | 根 `pnpm test` | 无（探针在 `wiki/raw/**` 不入门禁） | 无新增 |

阻断项清单（错误 Owner / 绕过既有能力 / 双事实源 / 生命周期不对称 / 无迁移平行机制）：**零命中**。

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-registry/test/issue-442-lease-record-e2e-fixture.ts`（新增 640 行） | ALLOW §11 行 2 | §7.2 全部装置 | 合规 |
| `packages/namespace-registry/test/issue-442-lease-record-e2e-contract.test.ts`（新增 603 行） | ALLOW §11 行 3 | §7.3 AC1–AC6 立法（29 its） | 合规 |
| `packages/namespace-registry/test/issue-442-lease-record-e2e-control.test.ts`（新增 154 行） | ALLOW §11 行 4 | §7.4 负控（4 its） | 合规 |
| `artifacts/sa3-issue442-*.log`（4 件） | 设计 §11 括注（Host 证据目录惯例） | 验证证据 | 合规（非实现面） |
| `wiki/raw/task_issue-442_sa3_impl.md` | SA3 skill 固定产物 | 实现报告 | 合规 |
| `wiki/raw/task_issue-442_sa4_review.md`（本文件） | SA4 skill 固定产物 | 审查报告 | 合规 |

- `git diff --stat` **空**（零 tracked 改动）⇒ DENY LIST 全部未触碰：`packages/**/src/**`、`issue-441-*`、
  `vfsl/**`、`issue-437-*`、`namespace-runtime/**`、`namespace-diagnostic-log/**`、`persistence/**`、
  `vitest.config.ts`、根 `package.json`、`pnpm-lock.yaml`、`docs/**`、`CONTEXT.md`、上游 wiki/raw 产物。
- `git worktree list` 不含 baseline worktree（SA3 申报已 `remove --force`，亲证无残留）；`wiki/raw` 无
  `.tmp-*` 临时脚本残留。
- ALLOW 内未修改路径：无（4 条 ALLOW 路径全部落盘）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| vitest runner 收集面 | 根 `pnpm test` | 两 `.test.ts` 命中 `packages/*/test/**/*.test.ts`；fixture `-fixture.ts` 不被收集 | 无（473 files 实证 +2 恰为两测试文件） | — |
| 根 `pnpm typecheck`（15 包 `tsc -p`） | CI/本地 | registry tsconfig include 仅 `src/**` ⇒ 新文件不进任何包 tsc 面；根 typecheck exit 0 | 无（既有模式，SA2 O-1/O-5） | — |
| `lease.mutateData`/`readData`/session 公共面 | 生产调用方 | 零生产改动、零新导出 ⇒ 零 ripple | 无 | — |
| `ReplicationSession` 公共面（fixture 消费 `localRole`/`remoteInstanceId`/`encodeDiff`/`encodeStateVector`/`subscribeOwnedUpdates`/`applyRemoteUpdate`/`getStatus`） | 两测试文件 | 全部为 `src/types.ts:673` + `lease.ts:290-305` 暴露的公共成员（亲证） | 无 | — |
| `registry.importReplica(owner, NS, snapshot, identity)` | fixture `openPeerFixture` | `src/types.ts:853`/`registry.ts:2263` 公共面；identity 取 hub status 的 replicationId/epoch | 无 | — |
| 诊断公共面（`createBoundedMemoryDiagnosticLog`/`AttemptRecord`/`UpdateCarrier`/`BoundedMemoryDiagnosticLog`） | fixture | `namespace-diagnostic-log/src/index.ts:15/35/56-57` 导出亲证；`AttemptRecord` 字段（recordKind/operation/stage/source/result）与 `record.ts:103` 一致；`updateCarrierOf` 的 committed+update 分支与 `AttemptResult` 联合成员一致 | 无 | — |
| #441/#437 既有测试 | 同 runner | 互不 import、零共享文件（目录清单亲证）；根 test 全绿含其 65 tests | 无 | — |
| registry public-surface guard | `src/index.ts` 导出面 | 无 `src/index.ts` 变更 ⇒ 不触发 | 无 | — |

## 8. 错误、恢复与并发

| 风险面 | 实现处理 | Assessment |
|---|---|---|
| 被测行为失败伪装成功 | 一切被测失败走判别联合断言（`expectOk` 用 `toEqual({ok:true})` 钉**恰** `{ok:true}` 形状——多余字段/ok:false 均红；`issueList` 对无 issues 的 `ok:false` 在 `issues.length>0` 处红） | 无静默失败面 |
| 零写入锚伪绿（「当刻为 0」不构成锚） | `expectRejectedZeroWrite` 先 `flushAsyncFanout(24)` 排空在途扇出，再断言 stateBytes 逐位 ∧ update 差值 0 ∧ owned 差值 0（三面 = SA6 §12.1 B-8） | 健壮（fail-loud 有界排空，非跳过） |
| 装置前提 vs 被测行为混淆 | fixture `assert`（throw 红，消息含 JSON 判别体）vs 测试 `expect*`（断言返回值） | 区分明确（设计 §9 落实） |
| 异步扇出竞态 | 有界 `settleUntil`(400)/`flushAsyncFanout`(24)/`waitForOwnedUpdates`/`waitForRootMutationRecords`，零 `setTimeout`（grep 实证，仅注释提及）；超限即 assert 红 | 无竞猜、无伪绿通道 |
| B6 差值断言被首删扇出污染 | 偏离 2：重复 delete 前先 `waitForOwnedUpdates(fx, 1)` 结算首删扇出（contract L337） | 装置前提修正，正确（否则排空会把首删 owned update 计入差值 → 伪红） |
| 读计数包装残留 | `finally` 删除全部 8 个 own 属性（实例遮蔽原型，删除即还原） | 零跨 it 污染 |
| 并发/隔离 | 每 it 独立 fixture（独立 registry/persistence/doc）；U4/V3 双 fixture 同 it 内独立；`maxWorkers:1`；模块级零可变共享态（仅常量与纯函数） | 无跨 it 干扰 |
| 回滚 | 纯新增 3 文件，删除即回到 471/5757 基线 | 无生产状态迁移 |
| 静态无法确认项 | 见 §11（沉降轮数余量、长时稳定性） | 如实登记，不猜测通过 |

## 9. 测试质量审查

Runner 入口：根 `pnpm test`（= `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`）与聚焦
`npx vitest run packages/namespace-registry/test/issue-442-lease-record-e2e-{contract,control}.test.ts`；
两者证据日志均在位（`sa3-issue442-focused-stability.log` 3 轮、`sa3-issue442-root-test.log`）。

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| A1 | ok:true（形状钉死）+ 污染保留 `'oops'` + update 差值恰 1 + `tasks.t3` 逻辑值 | 根 test + 聚焦面（实跑 33/33） | 无 | — |
| A2/A3 | ok + 恰 1 update + 键消失（A3 = delete 污染键自身，不读旧值） | 同上 | 无 | — |
| A4/A5 | ok + 恰 1 update + 污染未修复（`qty:'x'` / `nope` 在场）+ 目标键终态 | 同上 | 无 | — |
| A6/A7 | ok + 恰 1 update + `opt`/`unk` 消失 + `deep===5` 保留 | 同上 | 无 | — |
| A8 | `ok:false` + 逐字 `缺少必填字段 "req"` + path `['obj','req']` + 三面零写入（message 级判别：基线实测旧语义为 `Yjs 载体错位（ROOT.deep）`，判别日志亲证） | 同上 | 无 | — |
| A9/A10 | ok + 恰 1 update + 污染保留 + 目标键/深层终态 | 同上 | 无 | — |
| A11 | ok + **单事务单 update**（差值恰 1）+ 批内两键写入 + 污染保留（ADR 0026） | 同上 | 无 | — |
| B1–B4/B6–B8 | 逐字 message + path（含 B7 path `[]`、B8 四段 rebase）+ 三面零写入；B6 首删 ok + 重复 no-op 逐字 | 同上 | 无 | — |
| B5 | ok + `unk` 消失（unknown 标量 delete 允许） | 同上 | 无 | — |
| U3 | fast 轨 `valueReads ≤8`；union legacy `≥ n`（基线实测 fast 半 259 ∝ n → 红，判别日志亲证） | 同上 | 成本半未同 it 断言 `ok`（见 O-1） | MINOR（观察） |
| U4 | n=64 与 n=256 均 ≤8 且**相等** | 同上 | 同上 | MINOR（观察） |
| V1/V2/V3 | 两支成员 ok；V2 `toEqual` 钉恰 2 条联合 issue 全数组 + 零写入；V3 ≤8 且相等 | 同上 | V3 同 U4 | MINOR（观察） |
| E1 | 恰 1 root-mutation attempt + stage/source + committed effect:update + inline carrier 形态（format/正长度/8-hex crc32c/payloadLength 自洽）+ 同基态重放含 `t3` + 空 doc 不物化 ROOT | 同上 | 无（不钉 43/be9fa1fe 魔数 = 设计 §7.5.3 明示） | — |
| E2 | 两 record 排序键集逐键相同 + 两 carrier 排序键集逐键相同 + 总数恰 2 | 同上 | 无 | — |
| R1 | owned update 重放（同基态含 t3）+ peer apply ok + 逻辑值相等 + diff 定点 + session 四域（open/hub-to-peer/peer/hub-442） | 同上 | 无 | — |
| R2 | 空 doc 不物化 ROOT + 同基态重放含 t3 + 两笔恰 2 owned 事件 | 同上 | 无 | — |
| R3 | peer bootstrap 自含污染（readData 证 `'oops'`）+ apply 后既得 `t3` 又保留 `t9='oops'`（证伪整 map 重写） | 同上 | 无 | — |
| C1 | union map 位同污染同 op 逐字拒绝（`ROOT.mz`/`['mz']`）+ 三面零写入（A/B 对照 ⇒ A 组非恒真） | 同上 | 无 | — |
| C2/C3 | union 干净 set/delete ok；maybe n=64 `≥ n` | 同上 | 无 | — |
| C4 | 触达面内载体位逐字拒绝 + path `[]` + 三面零写入（fast path 未放松载体检查） | 同上 | 无 | — |

**发现性/敏感性证据**：`artifacts/sa3-issue442-baseline-discrimination.log`（detached worktree @ `3fd6aa8` +
复制三文件）实测 **15 failed \| 18 passed (33)**，失败 ID 恰为 A1–A11、U3、U4、V3、R3，失败原因亲证为旧语义
（A1 收到 `ok:false + Yjs 载体错位（ROOT.t9）`；A8 收到 `Yjs 载体错位（ROOT.deep）` 而非静态必填文案——
message 级判别成立；U3 fast 半 `{"valueReads":259}` ∝ n），负控 4/4 与不变量组 18 条在旧实现同绿 ⇒
判别/不变量分组与 SA6 §5.3 完全一致，断言敏感性经负控（mutation-style 复核）证实。
**纪律**：零 `skip/only/todo`、零 `process.env`、零源码字符串断言（grep 实证）；fixture 零 vitest 依赖。

## 10. Required revisions

无 BLOCKER / MAJOR finding，本表为空。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 沉降余量在更慢 CI 上的稳定性（`flushAsyncFanout` 24 轮 / `settleUntil` 400 轮；本机实测 <10 轮） | SA7/Controller 在 CI 环境复跑聚焦面 ≥3 轮 + 根 test | 逐轮 33/33、5790/5790，零 flakes | 任一轮出现「沉降 N 轮后仍未满足」或 owned/update 差值断言偶发红 |
| U3/U4/V3 的 ≤8 上限对计数面轻微演化的余量（实测 1，阈值 8） | 后续实现演进时自然覆盖 | 读计数在 1..8 内仍绿；>8 或 ∝ n 显红（预期立法行为） | 无故红即计数出口新增（须过 #442 面评审显形） |
| 读计数代理第三出口逃逸（R-1 理论残留） | 若 doc-runtime 改用未包装出口整 map 提取 | 行为断言（A/B/V/R 组）仍钉住正确性；成本断言可能失明 | 仅成本断言失明而行为面同绿 ⇒ 按设计 R-1 接受或补出口 |
| 长时/大规模（n≫256、毫秒级）基准 | ADR 0034 后果-验证基准条款（另票/follow-up） | 非本票 AC；本票仅结构性读计数 | 不适用 |

## 12. Non-blocking observations

| ID | 观察 | 建议处置 |
|---|---|---|
| O-1 | U3/U4/V3/C3 四条成本用例在其 `it` 内未断言所测 `mutateData` 的 `ok` 位（SA6 §12.3 该四行本就只冻结读计数断言；行为配对按设计 §7.5.3 为套件级——A11/E1/R1/R2 已钉 clean 新键写 `ok:true`，假想「clean 新键写被拒但读数少」的回归会使 U4/V3 保持绿但被 A11/E1/R1/R2 捕获） | 无需动作；未来原位修订时可在这四条的 `countMapReadsAsync` 回调后补一行 `expectOk`，使成本/行为配对自含 |
| O-2 | 偏离 1：三面零写入锚（stateBytes ∧ update 差值 ∧ owned 差值）统一应用到全部 18 条拒绝分支，宽于设计 §7.3 前言「表内标注处」。SA2 O-4 已裁定该维度被「拒绝在事务前 fail」语义蕴含（无事务 ⇒ 无 update/owned 事件），不可能伪红；SA6 §12.1 B-8 本就以三面定义零写入；判别日志亲证该 18 条在 `3fd6aa8` 与 HEAD 均绿 | 接受（加严非软化，且已双面实证）；无需动作 |
| O-3 | 偏离 2：B6 在重复 delete 前先 `waitForOwnedUpdates(fx,1)` 结算首删扇出——正确的装置前提修正（否则差值被首删扇出污染而伪红），非验收面变化 | 接受 |
| O-4 | registry 包测试文件不在任何静态 tsc 面（包 tsconfig 仅 `src/**`；vitest `--typecheck` 只收 `*.test-d.ts`），fixture/测试的类型错误只能运行时显形——该包既有模式（#437 同状，SA2 O-5），非本票引入；本评审已逐一亲证 fixture 全部 import 的类型名在公共面上真实存在 | 无需动作；如仓库未来统一收紧测试类型面，属独立议题 |
| O-5 | `openLeaseFixture` 的 `role:'peer'` 分支（`remoteInstanceId: HUB_INSTANCE_ID`）未被任何用例消费（peer 一律经 `openPeerFixture` bootstrap）；无行为影响，仅装置面冗余 | 无需动作（可在未来修订时移除或注明保留原因） |
| O-6 | `expectOk` 以 `toEqual({ok:true})` 钉死成功成员**恰**为 `{ok:true}`——比 SA6「`ok` 位」更强；当前 HEAD 成功面即此形状（聚焦 33/33 实证），若未来成功成员增字段会在此显红（预期立法行为，非伪红风险） | 无需动作；知悉该语义即可 |

---

## 附：本审查结论一句话

**approve**：SA3 以三件套（fixture 640 行零 vitest 依赖 + 契约 29 its + 负控 4 its）把 SA6 契约 §12.3
全部 33 个 ID 的冻结值逐字落盘在 lease 最高 seam，零生产改动、零 DENY 触碰、零 skip/env/源码字符串，
判别性经 `3fd6aa8` 基线复核（15 红/18 绿，失败原因恰为旧语义连带拒绝与读计数 ∝ n）与负控 A/B 对照双重
证实；根 gates 473 files / 5790 tests 与 typecheck exit 0 的证据日志在位且与 SA8 RA-2/RA-3 口径逐项
吻合；两处申报偏离均为有据的非软化决策。6 条 MINOR 观察不阻断。
