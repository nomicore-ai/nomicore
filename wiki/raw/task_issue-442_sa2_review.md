# SA2 设计攻击评审 — issue #442：lease 端到端 Record/parent 逐 entry 校验行为钉死（ADR 0034）

- 评审对象：`wiki/raw/task_issue-442_design.md`（iteration 0 首版，HEAD `c42fb47`）
- 评审人：SA2（独立攻击评审；未修改设计/生产代码/测试）
- 评审日期基线：worktree `/home/wangjian/nomicore-fix-issue-442`（`.git` → `c42fb47` Merge PR #458）

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-442.md`（Issue #442 正文，AC1–AC7，Comments 空，Blocked by #441） | 已读 |
| SA1 设计 | `wiki/raw/task_issue-442_design.md`（449 行） | 已读全文 |
| SA6 契约（approve） | `wiki/raw/task_issue-442_sa6_contract.md` | 已读全文 |
| SA6 探针 | `wiki/raw/task_issue-442_sa6_capability_probe.mts`（1085 行） | 抽读关键段（fixture/persistence/读计数/U/E/R 组） |
| SA6 证据日志 | `artifacts/sa6-issue442-*.log`（probe-head×7、probe-baseline×4、coverage-census、pre-typecheck、pre-test、head-focused-441-437，共 14 件） | 已核对存在性与关键行 |
| 母法/先例 ADR | `docs/adr/0034-record-and-parent-elementwise-validation.md`（69 行全文）、`docs/adr/0033`（决策清单与「性能验收（软）」节） | 已读 |
| 词汇 | `CONTEXT.md`「逐 entry 例外」「触达面收窄」词条（L144/L202） | 已读 |
| 实现锚点源码 | `packages/doc-runtime/src/mutation-local.ts`（闸门 F1–F5/legacy 分支）、`mutation.ts`（信封类型）、`packages/namespace-registry/src/lease.ts`（session/readData/mutateData 透传）、`src/testing.ts` | 已逐段核对 |
| 结构先例源码 | `packages/namespace-registry/test/issue-437-lease-array-e2e-{fixture,contract}.ts` | 已读 fixture 全部关键段 |
| Runner/构建面 | `vitest.config.ts`、根 `package.json`、`packages/namespace-registry/tsconfig.json`、`packages/doc-runtime/tsconfig.json`、根 `tsconfig.typecheck.json` | 已核对 |
| 缺失输入 | `task_issue-442_relevant_decisions.md`、`_conflict_report.md`、既有 `_sa2_review.md`、既有 #442 测试 | 确认不存在（iteration 0）；设计 §0/§6 如实申报并以直读 ADR + AGENTS 替代 |

独立复核命令（本会话执行，只读）：`git diff --stat 3fd6aa8 HEAD -- packages/`（恰为 #441 五文件）、
`git diff --stat 3fd6aa8 HEAD -- pnpm-lock.yaml package.json vitest.config.ts`（空）、probe-head/baseline `SUMMARY … passed=31 failures=0`、
pre-test `471 files / 5757 tests`、census 清单、`ls wiki/raw`、`ls packages/namespace-registry/test/`（无 `issue-442-*`）。

## 2. Verdict

**approve**。

无 BLOCKER、无 MAJOR finding。设计把一个纯测试立法票（Issue 明示「不改实现」）收敛为 3 文件、
33 its（契约 29 + 负控 4）的可实施规格，逐字承接 SA6 契约 §12.3 的全部冻结值；需求覆盖、架构归属、
文件范围与验收设计均可安全实施。SA6 契约自身「30+4=34」的算术笔误被设计识别、独立复核确认并以
逐 ID 枚举（33）为准仲裁（见 §6）。3 条 MINOR 观察见 §14，均不阻断。

`pass` 仅指设计通过审查；实现与活链路验证仍由后续 SA4/SA7 承担。

## 3. 需求覆盖

| Requirement（简报 AC） | Design section | Assessment |
|---|---|---|
| AC1 行为变化钉正：污染 Record map 写/删目标键合法即成功；封闭对象 delete 同理（旧语义连带拒绝） | §7.3 A1–A11（A6/A7/A8 封闭对象面）；§12 行 1 | 覆盖。A1–A5/A9–A11 Record map 面（兄弟值非法/键违约/值位 union/深层/批量），A6–A8 封闭对象 delete 三态（optional 允/unknown 允/必填拒）。A8 为 message 级判别（静态理由 vs 旧父值载体错位），判别强度高于 ok 位 |
| AC2 不变量：键 Pattern 与非法新值零写入 + issue 路径 `[...mapPath,key]` 不变；no-op delete 拒；必填 delete 拒、unknown 标量 delete 允 | §7.3 B1–B8；§12 行 2 | 覆盖。B2（键 Pattern）、B1/B8（值非法浅/深 rebase）、B3/B6（no-op）、B4/B5（必填拒/unknown 允）、B7（触达面内载体位 path `[]`）。逐字 message + 序列化 path + 零写入锚 |
| AC3 union map 位端到端行为与性能路径不变（仍全量边界校验） | §7.4 C1–C3 + §7.3 U3 union 半；§12 行 3 | 覆盖。C1 污染照旧逐字拒绝（A/B 对照）、C2 干净写照常、C3/U3 union 半读计数 ≥ n（实测 514 ∝ n） |
| AC4 Record 值位 union 端到端仍 fast path（行为正确且不经全量提取） | §7.3 V1–V3；§12 行 4 | 覆盖。V1 两支成员接受、V2 非法值两 issue 逐字拒、V3 读计数 ≤8 且 n=64/256 相等（实测 1/1） |
| AC5 诊断烟测：committed update bytes 记录形态不变 | §7.3 E1–E2；§7.5.3；§12 行 5 | 覆盖。E1 record 形态（stage/source/result/inline carrier/重放 oracle/空 doc 不物化）、E2 与标量写 record+carrier 键集逐键同构 |
| AC6 复制烟测：fast path 提交经 replication apply 收敛、无协议面变化 | §7.3 R1–R3；§12 行 6 | 覆盖。R1 收敛 + diff 定点 + session 状态、R2 最小增量 + 1 提交=1 事件、R3 污染保留（证伪整 map 重写） |
| AC7 根 `pnpm typecheck` 与 `pnpm test` 绿 | §10 行 2/3；§12 验证命令 2/3 | 覆盖。期望 471→473 files、5757→5790 tests（33 its；算术独立复核成立）；R-6 以「零 skip 且逐 ID 覆盖 §12.3 全表」为准绳防数字机械对齐 |
| Issue 正文「本 ticket 不改实现」 | §1 非目标、§11 ALLOW/DENY | 覆盖。ALLOW LIST 仅设计产物 + 3 个新测试文件；`packages/**/src/**` 零改动且入 DENY |

目标/非目标无静默扩大：非目标（S9/E201-C/fatal 面不重复立法、union 穿越位、异步审计、毫秒阈值）
逐条有 ADR 0034「不做什么」或 SA6 §10/§11 裁定背书。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无） | — | §4 | 维护者 REST issue-comment read 返回 `[]`（Host 明示 `Current owner-comment requirements: none`）；简报 Comments 段为空。设计如实申报「无 owner 附加要求」，未虚构映射行。唯一需求面 = AC1–AC7，见 §3 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 结论 approve：能力缺口 = lease 最高 seam 回归覆盖面缺口；HEAD 行为 31/31 正确 | §5 行 1：纯测试交付（3 文件零生产改动） | 一致。census 独立复核：`packages/namespace-registry/test/` 无 `issue-442-*`，ADR 0034 语义断言仅存在于 doc-runtime/vfsl 测试 |
| 判别组在 `3fd6aa8` 按旧语义失败（15 条），不变量组两面同绿 | §5 行 2 + §7.5.4：交付测试只断言 HEAD 期望，判别性由 SA6 基线证据承载，红面复跑为可选命令 | 一致。`git diff --stat 3fd6aa8 HEAD -- packages/` 独立复核恰为 #441 五文件（mutation-local/mutation + 三测试）；lockfile/package.json/vitest.config 无 diff——「单变量修订」的基线选择成立 |
| 契约 §12.2/12.3 规格（ID/断言/冻结值/纪律）不得改变 | §5 行 3 + §7.2–7.4 全量承接 | 一致。33 个 ID 逐一对照无缺漏；冻结值与 `artifacts/sa6-issue442-probe-head.log` EVIDENCE 行逐字核对相符（A8/B1–B8/U1/C1 message+path、U3 1/514、U4/V3 1/1、V2 两 issue、E1 10+5 键/payloadLength=43/crc32c=be9fa1fe） |
| 计数矛盾：契约 §1/§13 称 30+4=34，其 §12.3 枚举为 29+4=33 | §5 行 4：以枚举 33 为准，落地期望 473/5790；R-6 定验收准绳 | **仲裁正确**。SA2 独立重数：§12.3 契约组 A11+B8+U2+V3+E2+R3=29、负控 4、合计 33；SA6「34/5791」系其自身算术笔误。设计未静默复制也未软化，公开记录并给了防争议准绳 |
| 读计数是结构性代理（理论失明出口） | §5 行 5 + §7.2.4（8 出口全覆盖）+ §7.5.3（成对行为断言） | 一致。probe `countMapReadsAsync` 实现（get/has 逐次 + keys/values/entries/toJSON/Symbol.iterator/forEach 按 size）与设计 §7.2.4 的 8 出口逐一对得上；union ≥n 反证在 C3 |
| 同键覆盖污染依赖 clientID 决胜 | §5 行 6 + §7.2.5（hub 4242/remote 999999 显式冻结） | 一致，且设计比 SA6 契约 §7 的措辞更严：SA6 允许 `obj.deep`/`blobs.b1` 两处同键覆盖，设计的污染一律新键、唯一例外 `obj.deep`（A9 用新键 `b9`）——确定性面收窄，无漂移风险 |
| ADR 0034 决策 1–6、ADR 0033 先例、ADR 0010 raw 面、ADR 0011/0014 诊断 best-effort、两包 AGENTS.md | §6 替代约束面逐条落实表 + §14 复查声明 | 一致（SA8 工件缺席已如实申报）。决策 1/2/4/5 的行为落点与 ADR 原文逐条核对相符；决策 3（S9）不重复立法的边界划分与 SA6 §11 裁定一致（lease seam 无法区分重投影核）；诊断只读观察不 wire 新发射，符合「emit 不改业务结局」 |
| `packages/namespace-registry/AGENTS.md`：公共 API 只经 `src/index.ts`、testing surface 显式、public-surface guard | §6 行 10 + §11（无 `src/` 改动、无新导出） | 一致。fixture 只消费 `@nomicore/namespace-registry`（+`/testing`）与诊断包公共面；`importReplica`/`openReplicationSession` 均为 #437 fixture 已消费的公共面（源码核对） |

## 6. 设计内部一致性

逐项交叉核对结果：

- **数量自洽**：§7.1「29 its + 4 its」= §7.3 表行数（A1–A11、B1–B8、U3–U4、V1–V3、E1–E2、R1–R3 = 29）+ §7.4（C1–C4）= 33；§12 验证命令 1 期望「2 files / 33 tests」、命令 3 期望「文件 +2、用例 +33」、AC7 行 5790——三处口径一致。判别组 15 its（A1–A11、U3、U4、V3、R3）+ 不变量 18 = 33，与 SA6 §13 的 15 条判别断言一致。
- **冻结值与证据一致**：§7.3/§7.4 全部「冻结值」列与 probe EVIDENCE 行及 SA6 §5.2 逐字相同（本评审逐条抽核，含 B7 path `[]`、C1 `ROOT.mz` path `['mz']`、U3 514、E1 键集）。
- **schema/seed/常量一致**：§7.2.2 与 SA6 §12.2 schema 逐字相同、与 probe `SCHEMA_TEXT`/`buildDoc` 相同（含 `unk={k:1}`、`codes` 仅 `id-1`、尺寸参数默认 3/1/1）；常量块（NS/OWNER/NOW_MS/4242/999999/hub-442/peer-442）与 probe 常量块逐值相同。
- **装置语义一致**：§7.2.3 的 hub `updateEvents` 在 `registry.open` 前挂、peer 在 import 后挂、`applyRawRemote` 远端副本求增量走 `session.applyRemoteUpdate`——与 probe `openFixture`/`openPeerFixture`/`applyRawRemote` 实现逐行对应；peer `doc`=快照实例且 `ProbePersistence.importDoc` 按引用存 doc（源码核对），故 peer `updateEvents` 可数到 live apply，装置前提成立。
- **无死引用**：设计引用的全部文件/行号抽核存在（`mutation-local.ts:285-342/344-381`、`mutation.ts:69-104`、`lease.ts:294-337/392-394`、`testing.ts:86/126`、#437 fixture `:281-299`、`vitest.config.ts:15`、registry tsconfig include）；14 件 `artifacts/sa6-issue442-*.log` 全部在位，7+4 轮计数与日志文件名相符。
- **无伪修订/前后矛盾**：正文与 ALLOW/DENY、验收表、风险表互相支撑；「不修复」负向断言形态（§7.5.2）与 R3 对端保留污染互证；U1/U2 重编号为 C1/C2、B7 在 C4 独立重锚均在 §5 行 4 显式申报，非静默改动。
- **一处自我表述微瑕**：§7.3 前言称「与 SA6 §12.3 逐行同强度，不擅自加严」，但 A8/B2 两行在 SA6 只标「零写入」处加了「零 update」。该加维度被「零写入」语义蕴含（拒绝在事务前 fail，无事务即无 update 事件），不可能伪红——记为 §14 观察 O-4，非矛盾。

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SM-1 | fixture 已 open、schema ready | raw 污染 apply 与业务写并发提交 | 写 sequencer 单槽有序，二者无竞态 | 无缺口——§9 明示「污染 apply 与业务写同槽排序」；#437/探针同款事实 | 无 |
| SM-2 | 诊断/复制异步扇出未完成 | 断言先于扇出到达 | 有界 `settleUntil`（setImmediate 400 轮，实测 <10）沉降后断言；超限即 assert 红 | 无缺口——§7.2.1/§8 路线 3/4；零 `setTimeout` 竞猜 | 无 |
| SM-3 | lease released（理论迟到面） | 测试期 release 后再 mutate | 本票每 it 独立 fixture 且不 release（#437 同款）；released 语义是既有已测面 | 无缺口——§9 幂等/资源清理段如实声明不显式 release 的先例依据 | 无 |
| SM-4 | peer bootstrap 进行中 | hub 写先于 peer import 完成 | `openPeerFixture` 内 `waitForSchemaReady` 屏障后测试才继续 | 无缺口——§7.2.3 装置顺序与 probe 一致 | 无 |
| SM-5 | 读计数包装在场 | `mutateData` 判定在 sequencer 槽内 await 之后执行 | 包装覆盖整个 `await run()` 窗口 | 无缺口——§7.2.4 显式陈述该事实（#437 `countElementReadsAsync` 同款注释先例） | 无 |

并发面补充：`maxWorkers:1`（`vitest.config.ts:17` 核对）+ 每 it 全新 registry/namespace/doc，跨 it 零共享态。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | 被测行为失败（`ok:false`） | 判别联合断言（非 throw）+ 零写入锚（stateBytes 逐字节 + 标注处零 update + 复制 fixture 零 owned update） | 无静默失败面 | 无 |
| ER-2 | 装置前提失败（open/enable/import/readData/applyRemoteUpdate 失败） | fixture `assert` 就地 throw → it 红，消息含 JSON 判别体 | 失败定位到装置 vs 被测的区分明确（§9） | 无 |
| ER-3 | settle 超限（异步扇出不到达） | 400 轮后 assert 红（fail loud），非跳过/软化 | 无伪绿通道 | 无 |
| ER-4 | 读计数包装残留（断言中途 throw） | `finally` 中 `delete` 全部 8 个包装，零残留（§7.2.4） | 无跨 it 污染 | 无 |
| ER-5 | 诊断 emit 失败（理论） | 只读观察既有 emitter，不 wire 新发射；ADR 0011 best-effort 面                                         | 零新增风险 | 无 |
| ER-6 | 回滚需求 | 纯新增 3 文件，删除即回退到 471/5757 基线（R-8） | 无生产状态迁移 | 无 |

正常路径不变量（恰 1 update、1 提交=1 owned 事件、终态键值）均以行为断言钉死，无 fallback 掩盖。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| vitest runner 收集面 | 无——两 `.test.ts` 命中 `packages/*/test/**/*.test.ts`；裸 fixture 不收集 | `vitest.config.ts:15`；#437 同目录 2 files/20 tests 实跑证据（SA6 §14） | 无 |
| 根 `pnpm typecheck`（15 包 `tsc -p`） | 无——新文件在 `packages/namespace-registry/test/`，该包 tsconfig include 仅 `src/**`（源码核对），不进任何包 tsc 面 | `packages/namespace-registry/tsconfig.json`；根 `package.json` scripts | 无（§14 O-1 修正一处对比措辞） |
| `lease.mutateData`/`readData`/session 公共面生产调用方 | 无——零生产改动、零新导出；消费面仅测试 | §11 DENY LIST；`lease.ts:294-337/392-394` 透传锚核对 | 无 |
| #441/#437 既有测试 | 无——互不 import、常量重名由「通用名不导出」纪律消解（R-7） | `packages/{doc-runtime,namespace-registry}/test/` 文件清单 | 无 |
| registry public-surface guard | 无——无 `src/index.ts` 变更 | registry AGENTS.md Boundaries；§10 末行 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| lease seam 行为立法（信封门/批量折迭/诊断泵/复制扇出叠加面） | `packages/namespace-registry`（lease 是独立 caller capability，AGENTS.md） | §7.1 三件套落 `packages/namespace-registry/test/` | 正确 |
| 生产语义（闸门/域规则/S9） | doc-runtime/vfsl（#440/#441 已锚） | §7.6 非重复立法边界 | 正确——不越权复制底层状态机 |
| 污染注入通道 | trusted raw replication 面（ADR 0010） | §7.2.3 `applyRawRemote` 只经 `session.applyRemoteUpdate` | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| lease 端到端立法三件套（ADR 0033 数组案） | `issue-437-lease-array-e2e-{fixture,contract,control}.ts`（524 行 fixture） | 同构独立成套（Map 读计数为新移植对偶） | 一致 | schema/助手族不同；共享会耦合红因；仓库 per-issue fixture 惯例（369/383/387/388/389/390 同款） |
| 诊断生产形状 binding | #437 fixture `:281-299`（`createBoundedMemoryDiagnosticLog` + emitter/runtimeEmitterFor） | §2.1/§7.2.1 逐字复用同款 | 一致 | 生产形状先例 |
| 会话夹具 | `registry-phase5-replication-session-red` | 不复用（§7.7-2） | 一致（有据偏离） | 该夹具锚会话语义、无 schema 化 ROOT/诊断/读计数，复用会混红因 |
| 相对源码导入诊断包 | #437 fixture `../../namespace-diagnostic-log/src/index.js` | §7.2.1 同款（双上下文解析一致性已论证） | 一致 | 既有先例，非本设计新开通道 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 冻结行为值 | SA6 契约 §12.3 + probe EVIDENCE（HEAD 实测） | 设计 §7.3/§7.4 表 | 无——逐字承接，未二次转写失真（本评审逐条核对） |
| 用例基数 | §12.3 逐 ID 枚举（33） | SA6 §1/§13 的「34」 | 已由设计显式仲裁并定防争议准绳（R-6），不构成双事实源 |
| fixture 常量 | 文件内私有冻结 | 无外部镜像 | 无（R-7 重名纪律） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| `openLeaseFixture`/`openPeerFixture`（open/import + session + 订阅） | 不显式 teardown（#437 先例：vitest worker 回收，fake scheduler 无真实 timer/端口/句柄） | 装置失败即 assert 红 | 可接受——纯内存装置，先例一致；读计数包装 finally 删除是唯一的就地 acquire/release，对称成立 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套读计数助手 | #437 `countElementReadsAsync`（Y.Array） | `countMapReadsAsync`（Y.Map 8 出口） | 非重复——载面对偶，probe 已验证同构纪律 |
| 第二套 lease fixture | #437 fixture | 独立 #442 fixture | 非重复——schema/断言族不同，耦合反而制造红因混淆 |
| 新 runner/脚本 | 根 `pnpm test` | 无 | 无新增（探针在 `wiki/raw/**` 不入门禁，SA6 §14） |

阻断项清单（错误 Owner / 绕过既有能力 / 双事实源 / 生命周期不对称 / 无迁移方案的协议分叉 / 「改动更少」式偏离）：**零命中**。

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW LIST 4 路径（设计产物 + 3 新测试文件） | §11；与 §7.1 交付物一一对应，无正文外路径 | 无 |
| DENY LIST 与正文无冲突 | §1 非目标（零 `src` 改动）、§7.6（不动 #440/#441/#437 面）、§10（零新导出）均被 DENY 覆盖 | 无 |
| ALLOW 无无理由扩张 | 4 路径各有任务必然性；`artifacts/` 注记为 Host 证据目录惯例，非实现面 | 无 |
| follow-up 未掩盖必要项 | §13 三条 follow-up（异步审计、合法性重建审计、lease 面 S9 烟测）均有 ADR 0034 决策 4「需要时另行设计」/SA6 §15 裁定背书，非本票 AC | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC6 行为立法 | 33 its，全部观察运行时行为（判别联合/逐字 message/path/readData 逻辑值/update 事件/状态字节/读计数/诊断 record/owned update），零源码字符串断言 | 无 | 无 |
| 判别性（旧实现必红） | SA6 基线证据（`--baseline` 4 轮 31/31 命中旧语义）+ 可选复核命令（detached worktree @ `3fd6aa8`，15 its 红、失败原因恰为旧语义） | 无——交付测试不携带 baseline 分支是 SA6 §14 冻结纪律，判别性由证据链承载而非测试自举 | 无 |
| 错误路径伪绿风险 | 拒绝分支零写入锚 + 负控 C1/C4（A/B 对照证 `ok:true` 非恒真）+ C2/C3（legacy 轨可用性与成本） | 无 | 无 |
| 回归/并发/重启场景 | 每 it 独立 fixture、sequencer 单槽、有界 settle、`maxWorkers:1`；纯测试票无进程重启面 | 无（重启面不适用于本交付物形态） | 无 |
| 测试落点为仓库真实入口 | 两 `.test.ts` 命中根 vitest include；fixture 非入口；AC7 复跑根 gates | 无 | 无 |
| 数字口径 | 5790 = 5757+33（独立复核）；R-6 准绳防机械对齐 | 无 | 无 |
| 稳定性 | 命令 5 聚焦面复跑 ≥3 轮（SA6 7+4 轮先例） | 无 | 无 |

## 13. Required revisions

无 BLOCKER / MAJOR finding，本表为空。

## 14. Non-blocking observations

| ID | 观察 | 建议处置 |
|---|---|---|
| O-1 | §10 调用方矩阵「测试文件不进包 tsc 面（仓库既有模式，#437/#441 同款）」的对比不精确：`packages/doc-runtime/tsconfig.json` include 含 `test/**`（#441 测试**在**其包 tsc 面内），仅 registry 包排除测试。对本票的操作性结论（registry 新测试不影响根 typecheck）不受影响且证据充分（registry tsconfig 源码核对） | 实现期无需动作；后续修订设计时把括注改为「#437 同款（registry 包 tsconfig 仅 `src/**`；doc-runtime 包含 `test/**`，故 #441 不同款）」 |
| O-2 | 引用滑差：「ADR 0034 决策 6 软验收」（§1 非目标末条、§7.7-3）——软性能验收是 **ADR 0033 决策 6**（「性能验收（软）」：不钉绝对毫秒数）；ADR 0034 的决策 6 是与 0033 的关系与排序（ADR 0034 后果节的「基准测试」承袭 0033 软验收口径）。SA6 契约 §7 同款滑差，设计系承接而非自创；实质行为（机器无关读计数、n 解耦判据）完全符合两 ADR | 同上，修订时改引「ADR 0033 决策 6（经 ADR 0034 后果节承袭）」 |
| O-3 | §7.2.1「`settleUntil(read, message, rounds=400)`……#437/探针同款时序纪律」：#437 fixture 默认 200 轮、探针 400 轮；「同款」指有界 setImmediate 纪律而非数值。设计取 400 与直接证据源（探针）一致，无风险 | 无需动作（可选：注明「#437 为 200，探针/本设计取 400」） |
| O-4 | §7.3 A8/B2 两行在 SA6 §12.3 同行仅标「零写入」处加标「零 update」，与「不擅自加严」的声明微冲突。所加维度被零写入语义蕴含（拒绝在事务前 fail → 无事务无 update 事件），不可能伪红 | 无需动作；实现期照设计表落盘即可 |
| O-5 | registry 包测试文件不在任何静态 tsc 面（包 tsconfig 仅 `src/**`；vitest typecheck 只收 `*.test-d.ts`）——fixture/测试的类型错误只能靠运行时显形。这是该包既有模式（#437 同状），非本设计引入；设计已在 §10 如实声明 | 无需动作；如未来仓库统一收紧测试类型面，属独立议题 |

---

## 附：评审结论一句话

设计以 3 文件 33 its 把 ADR 0034 的 lease-seam 用户可见行为与不变量完整立法（AC1–AC6 全覆盖、AC7
口径算术独立复核成立），冻结值与 SA6 探针证据逐字相符，架构归属、文件范围、非重复立法边界均有
源码与 ADR 依据；唯一需留意的是其对 SA6「34/5791」笔误的仲裁（以枚举 33/5790 为准）——SA2 独立
重数确认该仲裁正确，Controller/SA7 按此口径验收即可。**approve**。
