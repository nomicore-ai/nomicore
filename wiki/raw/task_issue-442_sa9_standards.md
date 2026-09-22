# SA9 Standards 审查 — issue #442：lease 端到端 Record/parent 逐 entry 校验行为钉死（ADR 0034）

- 审查对象：**committed final delivery** `2c6f855509e3b287e1d3e262d3bd966d73b2c301`
  （`test(namespace-registry): cover lease record validation e2e`），其父 `c42fb47`
  （Merge PR #458，含 #441 `61778bc`）即权威母 PR #438 线 verified head `c42fb470…3963`
  的祖先链上一环；delivery diff = `c42fb47..2c6f855`。
- 审查人：SA9（独立 Standards 审查；未修改任何文件、未运行测试、未启动服务、未调度其他 SA）
- Worktree：`/home/wangjian/nomicore-fix-issue-442`（branch `mabf/issue-442`，HEAD `2c6f855`，
  `git status --porcelain` 干净）
- 范围声明：只审查仓库 AGENTS / ADR / 模块责任 / 既有架构惯例 / 单一事实源 / 生命周期对称性 /
  文件范围 / 测试质量标准符合性；Issue 需求完整实现归属 SA10，不在本报告裁定。
- Owner 评论面：REST issue-comment `[]`、简报 Comments 段空（Host 明示 none）——无附加标准面。

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-442.md`（AC1–AC7、Blocked by #441、Comments 空） | 已读 |
| SA1 设计 / SA2 评审 / SA3 实现 / SA4 审查 | `wiki/raw/task_issue-442_{design,sa2_review,sa3_impl,sa4_review}.md` | 已读全文 |
| SA8 双轮冲突门禁 | `task_issue-442_design_conflict_report.md`（clear，RA-1/2/3）、`task_issue-442_implementation_conflict_report.md`（clear） | 已读全文 |
| SA6 契约 | `task_issue-442_sa6_contract.md`（§12.2 schema 冻结段亲核） | 抽读关键段 |
| 被审 diff | `git show --stat 2c6f855`（31 files，+7213）；3 测试文件逐行通读（640/603/154 行） | 亲读 |
| 规范基准 | 根 `AGENTS.md`、`packages/namespace-registry/AGENTS.md`（系统注入亲读）、`vitest.config.ts`、`packages/namespace-registry/{tsconfig.json,package.json}` | 亲证 |
| 生产措辞源 | `packages/vfsl/src/validate.ts`、`validate-patch.ts`、`packages/doc-runtime/src/{mutation.ts,mutation-local.ts,extract.ts,carrier.ts}` | grep 亲证 |
| 先例 | `packages/namespace-registry/test/issue-437-lease-array-e2e-{fixture,contract,control}.ts` | 抽读亲证 |
| 门禁证据 | `artifacts/sa3-issue442-{root-typecheck,root-test,focused-stability,baseline-discrimination}.log`、`artifacts/sa6-issue442-*.log`（19 件随 commit 落盘） | 尾部亲读 |

独立复核命令（本会话执行，只读）：`git log/status/worktree list`、`git diff --stat c42fb47 2c6f855 --
<deny paths>`（空）、`grep`（skip/only/todo、process.env、setTimeout、fs/readFileSync、vitest-in-fixture）、
`grep -c "it("`（29/4）、生产 message 模板 grep、`vitest.config.ts` include/`maxWorkers`、registry
tsconfig/package.json exports 与依赖面、#437 fixture L46/L50–58 先例比对、证据日志尾部亲读。

## 2. Verdict

**approve**。无 BLOCKER、无 MAJOR finding。committed delivery 在全部八个 standards 维度上符合仓库
规范与既有惯例；5 条 MINOR 观察见 §10，均不阻断。

## 3. 文件范围（file scope）

| 检查 | 实测 | 判定 |
|---|---|---|
| diff 是否越出 ALLOW LIST | `git show --stat 2c6f855`：恰 3 个新测试文件（ALLOW §11 行 2–4）+ 19 件 `artifacts/` 证据日志 + 9 件 `wiki/raw/` 上游/SA 产物；`git diff --stat c42fb47 2c6f855 -- packages/**/src/** docs/** CONTEXT.md vitest.config.ts package.json pnpm-lock.yaml` **空** | 合规——Issue「不改实现」逐字兑现 |
| DENY LIST 触碰 | `packages/doc-runtime/**`、`issue-441-*`、`issue-437-*`、`vfsl/**`、`namespace-runtime/**`、`namespace-diagnostic-log/**`、`persistence/**` 全部零 diff | 合规 |
| 证据/评审工件入库惯例 | #441 delivery 同款（`24b3e7f docs(mabf): retain issue 441 verification evidence`、`52f8c45 … record final issue 441 reviews`）——artifacts/wiki 随票落盘是仓库既定惯例 | 合规（先例一致） |
| wiki/raw 定位 | `docs/AGENTS.md` Authority 节：wiki/raw 为证据非规范——本 diff 未把任何证据文件升格为规范面 | 合规 |

## 4. 模块责任（module responsibility）

| Behavior | Expected owner | Actual | 判定 |
|---|---|---|---|
| lease seam 行为立法（信封门/批量折迭/诊断泵/复制扇出叠加面） | `packages/namespace-registry`（AGENTS.md：lease 是独立 caller capability；本包是 runtimes/leases/sessions 的 host-level owner） | 三件套落 `packages/namespace-registry/test/` | 正确 |
| 公共导出面 | 「Add public APIs only through `src/index.ts`；hostile/test 控件留 explicit testing surface」 | 零 `src/**` 改动、零新导出；fixture 只消费 `@nomicore/namespace-registry`（type）+ `/testing`（`createNamespaceRegistryForTesting`/`createRegistryTestScheduler`——package.json exports L11–14 亲证该显式测试面） | 正确——public-surface guard 不触发 |
| 污染注入通道 | trusted raw replication 面（ADR 0010） | `applyRawRemote`（fixture L570–583）只经 `session.applyRemoteUpdate`；live doc 无 lease 层直写；`doc` 引用仅装置面（fixture 自有 persistence 持有 handle） | 正确 |
| 诊断观察 | 只读消费既有 emitter（ADR 0011 best-effort；diagnostic-log AGENTS 冻结 v1 record 契约） | 生产形状 binding（`createBoundedMemoryDiagnosticLog` + emitter/runtimeEmitterFor，fixture L304–321），不 wire 新发射 | 正确 |
| 生产语义（闸门/域规则/S9） | doc-runtime/vfsl（#440/#441 已锚） | 三文件零 `install-facts`/`E201`/`verifyPlan` 面立法（SA8 implementation 报告 grep 实证），不越权复制底层状态机 | 正确 |

## 5. ADR 符合性（独立抽核；SA8 双轮门禁已 clear）

| ADR 条款 | 实现落点 | 本轮独立核验 | 判定 |
|---|---|---|---|
| 0034 决策 1（逐 entry fast path + 闸门 + union map 位永久双轨 + 值位 union 不阻断 + 「兼容行为，钉回归测试」义务） | A1–A11、U3/U4、V1–V3、C1–C3 | 断言方向与决策逐字一致；冻结 message 在生产模板亲证在场（下表） | 符合 |
| 0034 决策 2（封闭对象 delete 静态判定） | A6–A8、B4–B6 | A8 静态理由 message 级判别；B5 unknown 标量允许、B6 重复删 no-op | 符合 |
| 0034 决策 4 + 0007 #237 条款 4（触达面收窄；载体位响亮拒绝） | A 组污染保留 + B7/C4 载体错位拒绝（path `[]`/`['mz']`） | `mutation-local.ts:159`（`Yjs 载体错位（ROOT）：期望 Y.Map，实际 ${carrier}`）与 `carrier.ts:15`（`'plain value'` 词汇表）亲证措辞同源 | 符合 |
| 0034 决策 5（域规则逐字兼容） | B1–B8 `toBe` 逐字 + `toEqual` path | 模板亲证：`validate.ts:680`（缺少必填字段）、`validate.ts:374`（Pattern 正则）、`mutation.ts:814`/`validate-patch.ts:1272`（no-op）、`validate.ts:243`（类型不匹配）、`validate.ts:529+680/687`（联合成员 i/N 前缀 + 未知字段） | 符合 |
| 0033 决策 2（零写入纪律，拒绝先于 live 写） | 全部拒绝分支三面零写入锚（stateBytes ∧ update 差值 ∧ owned 差值，`flushAsyncFanout` 排空后断言） | 与 SA6 §12.1 B-8 定义同形；SA2 O-4 已裁定该维度被零写入语义蕴含，非擅自加严 | 符合 |
| 0026（信封互斥/批内不嵌套/单事务单 update/一写槽一诊断记录） | A11 批量差值恰 1；E1 恰 1 条 root-mutation | 断言方向与 ADR 逐字一致，纯消费 | 符合 |
| 0014 + diagnostic-log AGENTS（carrier 形态冻结） | E1 形态断言（inline/format/正长度/8-hex crc32c）+ 重放 oracle；E2 键集同构 | 不钉 `payloadLength=43`/`crc32c='be9fa1fe'` 魔数（证据值非断言字面量，设计 §7.5.3） | 符合 |
| 0010（session 窄能力/冻结四域/importReplica 绑定 hub 身份） | R1 四域断言；`openPeerFixture` identity 取 hub status 复制事实 | 只消费公共五件套；零 wire 面触碰 | 符合 |
| 0034 后果-验证 + 0033 决策 6（性能软验收） | U3/U4/V3/C3 结构性读计数（≤8 / ≥n / 跨 n 相等），零毫秒阈值 | 行为合规；设计条款指针误引已由 SA8 RA-1 登记在 SA3 报告 §4 备注位（§10 O-5） | 符合 |

## 6. 既有架构惯例

| 惯例 | 先例 | 本实现 | 判定 |
|---|---|---|---|
| per-issue 三件套（fixture 零 vitest + 契约 + 独立负控） | `issue-437-lease-array-e2e-*`（同目录 369/383/387–390 同款形态） | `issue-442-lease-record-e2e-*` 同构独立成套 | 一致 |
| fixture 零 vitest 依赖、本地 `assert`、有界 setImmediate 沉降、零 setTimeout | #437 fixture（rounds=200）；探针/本票取 400 | grep 亲证 fixture 零 vitest import（仅注释提及）、零 setTimeout（仅注释）；`settleUntil` 400 轮 / `flushAsyncFanout` 24 轮 | 一致 |
| 相对源码导入诊断包 | #437 fixture L46 `../../namespace-diagnostic-log/src/index.js` | 同一形态（fixture L41–46）；`namespace-diagnostic-log` 是 registry 既有依赖（package.json L27 亲证） | 一致 |
| 断言助手按文件自含（`issueOf`/`flushMicrotasks` 在 #437 contract/control 各自重复定义） | #437 contract L45–54 / control L29–36 | `expectOk`/`issueList`/`expectRejected`/`expectRejectedZeroWrite` 在两文件各自定义（grep `function expectOk` 各 1） | 一致（先例同款，非平行机制违规） |
| fixture 通用名常量导出（NOW_MS/HUB_CLIENT_ID/REMOTE_CLIENT_ID） | #437 fixture L50–58 逐字同款导出 | fixture L50–62 同形态导出 | 一致（见 §10 O-2 措辞注记） |
| vitest 收集面 | include `packages/*/test/**/*.test.ts`（L15 亲证）；裸 fixture 不收集 | 两 `.test.ts` 命中、fixture 不命中；root test 473 files（471+2）实证 | 一致 |
| 测试不进包 tsc 面 | registry tsconfig include 仅 `src/**/*.ts`（亲证） | 新文件在 `test/`；root typecheck exit 0 实证 | 一致（既有模式，§10 O-4） |
| 确定性纪律 | 固定时钟/计数 randomBytes/受控 scheduler/显式 clientID | 全量落实；污染一律新键，唯一同键覆盖 `obj.deep`（clientID 决胜，两端 id 显式冻结） | 一致 |

## 7. 单一事实源

| Fact | Authoritative source | Derived state | 漂移风险 |
|---|---|---|---|
| 冻结行为值（message/path/读计数/键集） | SA6 契约 §12.3 + probe EVIDENCE（HEAD 实测） | 测试断言字面量 | 无——SA2/SA4 已逐条核对，本轮对全部 message 模板做了生产源码亲证（§5） |
| schema 文本 | SA6 §12.2 冻结块 | fixture `SCHEMA_442.text`（L64–82）逐字相同（契约块内行尾注释为说明标注，非 schema 文本） | 无 |
| 用例基数 | §12.3 逐 ID 枚举 33（29+4） | 落盘 `it(` 计数 29+4=33（grep 实证）；root test 5757→5790（+33）、471→473 files（日志尾部亲读） | 无——SA6 头部「34/5791」笔误已经 SA1 §5/SA2 §5/SA8 RA-2 三方仲裁闭合，无双事实源残留 |
| fixture 常量 | 文件内冻结 | 无外部镜像；与 #437 重名由 vitest 模块隔离消解 | 无 |

## 8. 生命周期对称性

| Start/acquire | Stop/release | 判定 |
|---|---|---|
| `countMapReadsAsync` 包装 8 个 `Y.Map` 读取出口 | `finally` 中 `delete` 全部 8 个 own 属性（fixture L548–560，实例遮蔽原型、删除即还原） | 对称、零残留 |
| `openLeaseFixture`/`openPeerFixture`（open/import + session + 订阅） | 不显式 teardown | 可接受——#437 合入先例同款：纯内存装置、fake scheduler、零端口/句柄/长驻进程，vitest worker 回收；`LeaseRecordHandle.release()` 为 stub（装置面） |
| 诊断/复制异步扇出 | 有界 `settleUntil`(400)/`flushAsyncFanout`(24) 沉降，超限即 assert 红 | 对称（fail-loud，非跳过） |

## 9. 测试质量标准

| 标准 | 实测 | 判定 |
|---|---|---|
| 零 skip/only/todo | grep 实证（两测试文件 + fixture） | 合规 |
| 零 env override / 零 baseline 分支 | `process.env` grep 为零；判别性由 SA6 基线 + SA3 复核证据承载（SA6 §14 纪律） | 合规 |
| 零源码字符串断言 | `readFileSync`/`fs.` grep 为零；断言全为运行时行为（判别联合/逐字 message/path/readData 逻辑值/update 事件/状态字节/读计数/诊断 record/owned update） | 合规 |
| 逐字冻结形态 | `toBe` 精确 message（非 `includes`）+ `toEqual` path；V2 `toEqual` 钉恰 2 条 issue 全数组 | 合规（立法本体） |
| 零写入锚健壮性 | 三面锚先 `flushAsyncFanout` 排空再断言（防「当刻为 0」伪锚）；B6 重复删前先结算首删扇出（装置前提修正，SA3 §8 偏离 2、SA4 O-3 接受） | 合规 |
| 负控独立性 | C1–C4 独立文件（SA6 §12.4）；C1/C4 同污染同 op 的 A/B 对照证契约 `ok:true` 非恒真 | 合规 |
| 判别性证据 | `artifacts/sa3-issue442-baseline-discrimination.log`：detached @ `3fd6aa8` 实测 15 failed / 18 passed，失败 ID 恰为 A1–A11/U3/U4/V3/R3 且原因恰为旧语义 | 合规（证据随 commit 落盘） |
| 根门禁证据 | `ROOT_TYPECHECK_EXIT=0`；`Test Files 473 passed (473)`、`Tests 5790 passed (5790)`、`Type Errors: no errors`、`ROOT_TEST_EXIT=0` | 合规（SA9 不复跑，仅核验证据在位且数字与 RA-2/RA-3 口径逐项相符） |
| 非软化的实现期决策 | 三面零写入锚统一应用（SA2 O-4 蕴含面）、B6 扇出结算——SA4 §8 逐项接受，本轮复核同意 | 合规 |

## 10. Non-blocking observations（MINOR，不阻断）

| ID | 观察 | 处置建议 |
|---|---|---|
| O-1 | U3/U4/V3/C3 四条成本用例在其 `it` 内未断言所测 `mutateData` 的 `ok` 位（SA6 §12.3 该四行本就只冻结读计数；行为配对为套件级——A11/E1/R1/R2 钉 clean 写 `ok:true`） | 承接 SA4 O-1；无需动作，未来原位修订可补一行 `expectOk` 使成本/行为配对自含 |
| O-2 | 设计 R-7 称通用名常量「保持文件内私有不导出」，实现实际 `export`（`NOW_MS`/`HUB_CLIENT_ID` 等）——与 #437 fixture L50–58 合入先例逐字同款；vitest 模块隔离下无碰撞面（`REPLAY_CLIENT_ID` 由契约文件消费） | 措辞注记，无需动作（实现遵从的是已合入先例） |
| O-3 | `openLeaseFixture` 的 `role:'peer'` 分支未被任何用例消费（peer 一律经 `openPeerFixture` bootstrap） | 承接 SA4 O-5；装置面冗余，无行为影响 |
| O-4 | registry 包测试文件不在任何静态 tsc 面（包 tsconfig 仅 `src/**`；vitest `--typecheck` 只收 `*.test-d.ts`），类型错误只能运行时显形 | 既有仓库模式（#437 同状，SA2 O-5/SA4 O-4），非本票引入；如未来统一收紧属独立议题 |
| O-5 | SA8 RA-1 条款指针勘误（设计误引「ADR 0034 决策 6」为软验收出处）已在 SA3 报告 §4 备注位登记；交付断言面与真实条款（ADR 0034 后果-验证基准 + ADR 0033 决策 6）一致 | 已闭环，无需动作 |

## 11. 结论一句话

committed delivery `2c6f855` 恰以 ALLOW LIST 三件套（fixture 640 行零 vitest 依赖 + 契约 29 its +
负控 4 its）把 ADR 0034 的 lease-seam 行为与不变量钉成回归测试：文件范围零越界（生产/规范/配置
面零 diff）、模块责任正确（registry 测试面 + 显式 `/testing` seam + trusted raw 污染通道）、ADR
0034/0033/0026/0014/0010/0011 逐条符合且冻结措辞经生产模板亲证、架构惯例与 #437 合入先例逐款一致、
单一事实源无残留（33/5790 仲裁口径实测相符）、生命周期对称（读计数包装 finally 还原）、测试质量
纪律全绿（零 skip/env/源码字符串、负控独立、判别性基线证据与根门禁证据随 commit 落盘）。**approve**。
