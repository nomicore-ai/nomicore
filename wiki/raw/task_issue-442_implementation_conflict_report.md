# 实现冲突门禁报告 — Issue #442（implementation 复审：lease mutateData 端到端回归测试三件套）

- 被审对象：**implementation**——当前 diff 的 3 个新增测试文件（untracked，零 tracked 改动）：
  `packages/namespace-registry/test/issue-442-lease-record-e2e-fixture.ts`（640 行，零 vitest 依赖）、
  `issue-442-lease-record-e2e-contract.test.ts`（603 行，29 its）、
  `issue-442-lease-record-e2e-control.test.ts`（154 行，4 its）
- 任务简报：`wiki/raw/task_issue-442.md`（Issue #442：lease 端到端 Record/parent 逐 entry 校验行为钉死
  （ADR 0034）；feature；「不改实现，只把新语义在最高 seam 上立法成回归测试」；AC1–AC7；Blocked by #441
  已满足——`61778bc` ⊂ HEAD `c42fb47`；Owner 评论面空：REST issue-comment `[]`，简报 Comments 段空）
- 上游固定产物（本轮全部亲读）：SA1 设计 `task_issue-442_design.md`（449 行）、SA2 攻击评审
  `task_issue-442_sa2_review.md`（**approve**，Required revisions 空，O-1..O-5）、SA8 设计冲突报告
  `task_issue-442_design_conflict_report.md`（**clear**，RA-1/RA-2/RA-3）、SA6 契约
  `task_issue-442_sa6_contract.md` §12.1–§12.4（冻结规格）+ §5.2/§5.3（冻结值）、SA3 实现报告
  `task_issue-442_sa3_impl.md`、`artifacts/sa3-issue442-{root-typecheck,root-test,focused-stability,
  baseline-discrimination}.log`、`artifacts/sa6-issue442-*.log`（14 件）
- **缺席输入（如实登记）**：`task_issue-442_relevant_decisions.md`、`task_issue-442_conflict_report.md`
  （前置门禁工件，iteration 0 未产生；设计 §6 已申报，设计后冲突报告已对 ADR 全集执行同等筛查并
  **clear**）；`task_issue-442_sa4_review.md`、`task_issue-442_sa9_standards.md` 不存在（无 SA4/SA9
  工件可读）。本报告按 dispatch 指令对**已落地测试**独立执行 ADR/规范/架构冲突筛查，不依赖缺席工件。
- 复审触发条件核对（skill 既定）：设计后冲突报告 §9 预告「实际 diff 越出 ALLOW LIST 则触发
  implementation 复查」——本轮 diff 未越出（见 §5），但 dispatch（总控）明示对本实现执行冲突复审，
  且被审对象为「把语义钉死成回归测试」的立法交付物（其断言字面量本身成为长期契约面），复审成立。
- 冲突基准（本轮全部亲读原文）：ADR-0034 全文（决策 1–6 + 不做什么 + 后果）、ADR-0033 全文（决策
  1–6，含零写入纪律与「钉回归测试」先例）、ADR-0007 issue #237 修订节条款 4 定稿措辞 + ADR
  0033/0034 修订注记（L126–159）、ADR-0010 正文 NamespaceLease/ReplicationSession/trusted raw 节
  （L71–111/L220）+ #134 拒绝码闭集 + #237 修订节 + #172 修订节、ADR-0011 全文（含 #228 澄清节）、
  ADR-0014 carrier 契约（L140–212：inline Base64/CRC32C 8 位小写 hex/payloadLength/format）、
  ADR-0026 全文（信封双形态互斥/批内不嵌套 ≤16/单事务单 update/一个写槽一条诊断）、ADR-0009/0012/
  0017/0025 经词条与边界核对；`CONTEXT.md` 重建校验（L144）/零写入（L149）/原子变更（L152）/
  封闭对象（L166）/ReplicationSession（L197）/复制未校验（L201）词条；`docs/AGENTS.md` Authority 节；
  `packages/namespace-registry/AGENTS.md`（本轮经系统注入亲读）与 `packages/doc-runtime`、
  `packages/namespace-diagnostic-log` 两包 AGENTS（经设计报告 §6 承接面 + 公共面消费亲证）。
  无 superseded ADR；被引修订节均为有效 append-only 修订。
- 独立核验方式（源码仅作事实确认，不作冲突基准）：`git diff --stat` 空 + `git status --porcelain` 非
  untracked 行为零（零生产改动实证）；两测试文件 `it(` 计数 29+4=33、零 `skip/only/todo/env
  override/fs 读源码`（grep 实证）；33 个 ID 与 SA6 §12.3 全表逐 ID 对照（A1–A11/B1–B8/U3–U4/V1–V3/
  E1–E2/R1–R3 + C1–C4，断言与冻结值逐条核对相符，含 B7 path `[]`、C1 `ROOT.mz` path `['mz']`、
  V2 两 issue 逐字、E1/E2 键集同构、R1 session 四域）；fixture 导入面亲证（yjs、persistence 类型、
  registry 公共面 + `/testing` 显式测试面、诊断包 `../../namespace-diagnostic-log/src/index.js` 相对
  源码导入——#437 合入先例 L46 逐字同款）；污染注入亲证只经 `session.applyRemoteUpdate`（远端副本
  构造 + 增量，live doc 无 lease 层直写）；`testing.ts` 显式测试面（L86/L126）、`lease.ts` 公共面
  （readData 双重载透传/openReplicationSession 输入恰两键）亲证；非重复立法锚在位亲证（#440
  fixture、#441 三件、#437 三件）；证据日志尾部亲读（root typecheck `ROOT_TYPECHECK_EXIT=0`、
  root test `473 passed / 5790 passed`、聚焦面 3×`2 files/33 tests`、baseline `3fd6aa8` 判别面
  `15 failed | 18 passed (33)`）
- 裁决人：SA8 Conflict Gatekeeper（implementation 复审轮）
- Worktree：`/home/wangjian/nomicore-fix-issue-442`（branch `mabf/issue-442`，HEAD `c42fb47`）
- 时间：2026-09-22（UTC）

## Verdict（先述结论）

**clear**（`requiresConflictRecheck: false`）

1. **diff 面完全落在 ALLOW LIST 内**：恰 3 个新测试文件（fixture + 契约 29 + 负控 4 = 33 its），
   `git diff` 零 tracked 改动——`packages/**/src/**`、`vitest.config.ts`、根 `package.json`、
   `pnpm-lock.yaml`、`docs/**`、`CONTEXT.md`、wire/协议代码全部未触碰。Issue「不改实现」逐字兑现。
2. **ADR 层：0 hard-conflict、0 evolution-required、0 override**。全部对照项为 `no-conflict`（9）或
   `implements-existing-decision`（6）。测试钉死的每一个行为断言都能在 ADR-0034 决策 1/2/4/5、
   ADR-0007 #237 修订节条款 4、ADR-0014 carrier 契约、ADR-0026 信封契约、CONTEXT「复制未校验」
   词条中找到**既有的**规范出处——交付物是把这些既有决策在 lease 最高 seam 上钉成回归测试
   （ADR-0034 决策 1 末句明文义务「兼容行为，钉回归测试」），不是创设或修订任何决策。
3. **实现与冻结规格零漂移**：33 个 ID 逐一在位、逐字 message/path 冻结值与 SA6 §12.3/§5.2 实测
   逐条相符、零 skip/only/todo、零 env override、零源码字符串断言、零软化。两处实现期决策
   （三面零写入锚统一落盘、B6 先结算首删扇出）均落在 SA6 §12.1 B-8 与 SA2 O-4 既定蕴含面内，
   属消费而非加严/软化（§3 行 7）。
4. **设计后报告三条 Required actions 全部兑现**：RA-1 条款指针勘误已在 SA3 报告 §4 备注位登记；
   RA-2 按枚举 33 落盘（实测 5757→5790，+33）；RA-3 根 gates 复跑绿（typecheck exit 0、test
   473/5790）。

## 1. Inputs and decision set

（见报告头「冲突基准」与「独立核验方式」。被审 diff 引用的全部装置面——registry 显式测试
seam、lease 公共面、session 窄能力、诊断生产形状 binding、persistence stub——均经本轮源码级
亲证为既有公共/显式测试面，无新开通道、无新导出、无内部 seam 消费。）

## 2. Decision analysis

| # | 决策（路径·条款） | 被审实现行为 | 裁决 | 证据 | Required action |
|---|---|---|---|---|---|
| 1 | ADR-0034 决策 1（Record set/delete 逐 entry fast path；闸门=非 union Record；union map 位永久双轨 legacy；**Record 值位 union 不阻断**；域规则不变；「issue 路径 `[...mapPath, key]` 与现行逐字节兼容（兼容行为，**钉回归测试**）」） | A1–A11/V1–V3 立法 fast path 行为（`ok` 位/污染保留/恰 1 update/读计数 ≤8 且跨 n 相等）；C1–C3+U3 union 半钉 union map 位永久 legacy（污染照旧连带拒绝、干净写照常、读计数 ≥ n）；逐字 message 以 `toBe` 精确断言（非 `includes`） | **implements-existing-decision**（决策 1 末句义务在 lease seam 兑现；零生产改动） | `docs/adr/0034-…md` L16–22；contract A1–A11/U3–U4/V1–V3、control C1–C3；`artifacts/sa3-issue442-baseline-discrimination.log`（15 红=旧语义连带拒绝/读计数 ∝ n，判别性实证） | 无 |
| 2 | ADR-0034 决策 2（封闭对象 delete 静态判定：必填且非 `unknown` → 拒；optional ∨ `unknown` 标量 → 允许；「`unknown` 字段缺席视同接受」；`has` 拒 no-op 不变） | A6–A8（A8 静态理由 message 级判别）、B4–B6（必填拒/unknown 允/重复删 no-op）；B3/B6 no-op 逐字文案 + path | **implements-existing-decision** | ADR-0034 L24–31；contract A6–A8/B3–B6；SA6 §5.2/§5.3 两面实测 | 无（AN-1 解读注记见下） |
| 3 | ADR-0034 决策 3（S9 收窄：安装事实核 O(1) 保留、fast-path 提交省略边界重投影、E201 收窄到目标键） | **不重复立法**：三文件零 `install-facts`/`E201`/`FatalError`/`verifyPlan` 字样（grep 实证）；该面归 #441 doc-runtime 测试（在位亲证）——lease seam 无法观察重投影核，边界划分经设计后报告 Verdict 2a 裁定不越权 | **no-conflict** | ADR-0034 L33–35/L70；grep 实证；`packages/doc-runtime/test/issue-441-record-fastpath-contract.test.ts` 在位 | 无 |
| 4 | ADR-0034 决策 4（触达面=map/父载体+目标键位；未触达污染不阻断不修复不扫描）+ ADR-0010 issue #237 修订节第 1 条后备句 + CONTEXT「复制未校验」词条（两阶段触达面收窄立法） | A 组污染保留断言（`'oops'`/`qty:'x'`/`deep===5`/`nope` 在场）+ 恰 1 update；R3 对端保留污染（证伪整 map 重写）；B7/C4 触达面内载体位响亮拒绝（path `[]`） | **implements-existing-decision** | ADR-0034 L37–41；ADR-0007 L98–107 条款 4(i)/(iv)；CONTEXT.md L201–202；contract A1–A11/B7、control C4、contract R3 | 无 |
| 5 | ADR-0034 决策 5（容器合法性 ⟺ 逐 entry 合法；禁止 map 级约束特判；enforcement = 一致性 fixture（#440 扩展）+ 本文档） | B1–B8 逐字域规则冻结 = 消费决策 5 的用户可见契约面；一致性 fixture（逐 entry vs `validateSubtree` 等价）不在本 diff——归 #440 vfsl 面（`issue-440-elementwise-entry-fixture.ts` 在位亲证，Record/parent 两形态覆盖） | **no-conflict**（enforcement 义务归属正确，未越权复制） | ADR-0034 L43–49；contract B1–B8；`packages/vfsl/test/issue-440-elementwise-entry-fixture.ts` 亲证 | 无 |
| 6 | ADR-0034 后果-验证（基准「耗时与 n 解耦」；根 typecheck/test）+ ADR-0033 决策 6（性能验收软：不钉绝对毫秒数） | U3/U4/V3/C3 成本断言=结构性读计数（≤8 / ≥n / n=64 与 256 相等），零毫秒阈值、零 `valueReads===1` 魔数；根 gates 复跑绿 | **no-conflict**（行为与真实条款一致；设计 §1/§7.7 的「ADR 0034 决策 6」指针误引已按 RA-1 在 SA3 报告 §4 备注位更正登记） | ADR-0034 L67–70；ADR-0033 L52–54；contract U3–U4/V3、control C3；`artifacts/sa3-issue442-root-{typecheck,test}.log` | 无（RA-1 已闭） |
| 7 | ADR-0033 决策 2 末条（零写入纪律：「一切拒绝先于 live Y.Doc 写，不引入 write-then-undo」）+ 决策 2「issue 路径…钉回归测试」 + #437 三件套立法先例 | 全部拒绝分支（A8、B1–B4、B6 重复删、B7、B8、V2、C1、C4）统一三面零写入锚：`encodeStateAsUpdate` 逐位不变 ∧ update 事件差值 0 ∧ owned update 差值 0（`flushAsyncFanout` 24 轮排空后断言）——即 SA6 §12.1 B-8 对「零写入锚」的定义本体；SA2 O-4 已裁定该维度被零写入语义蕴含（拒绝在事务前 fail ⇒ 无事务无 update 事件）、不可能伪红；baseline 证据显示该 18 条不变量组在旧新两面同绿（无加严红面） | **implements-existing-decision**（消费 B-8 冻结锚定义与 ADR-0033 零写入纪律；非擅自加严） | ADR-0033 L27–31；SA6 §12.1 B-8；SA2 O-4；contract `expectRejectedZeroWrite` 全拒绝分支；`artifacts/sa3-issue442-baseline-discrimination.log`（18 passed 含全部不变量 its） | 无 |
| 8 | ADR-0007 issue #237 修订节条款 4 定稿（(i) 导航逐跳载体形态违规响亮拒绝；(iii) set 目标位旧值不读；(iv) 触达面外不发现不修复不扫描）+ ADR 0033/0034 修订注记（union 容器目标按原文逐字保持） | B7/C1/C4 载体位逐字拒绝（`Yjs 载体错位（ROOT）` path `[]` / `（ROOT.mz）` path `['mz']`）；A3 delete 污染键自身不读旧值；A 组兄弟位污染不连坐；C1 union map 位照旧连带拒绝（决策原文保持面的钉死） | **implements-existing-decision** | ADR-0007 L98–107、L126–159；contract A3/B7/B8、control C1/C4 | 无 |
| 9 | ADR-0026（信封双形态互斥；`ops` 非空 ≤16、批内路径互不嵌套；全部成功单事务按序提交=单条 update bytes；一个写槽=一条诊断记录） | A11 批量 `{ops:[set t7, set t8]}`（兄弟路径不嵌套、2≤16）断言 update 差值恰 1；E1 断言恰 1 条 root-mutation attempt；每次调用恰用一种信封形态（互斥面不被触碰） | **no-conflict**（纯消费） | ADR-0026 L14–46；CONTEXT.md L152–155；contract A11/E1 | 无 |
| 10 | ADR-0010 正文（ReplicationSession 窄能力：encodeStateVector/encodeDiff/subscribeOwnedUpdates/applyRemoteUpdate 进唯一 write sequencer/getStatus；session 冻结 localRole/remoteInstanceId；不暴露 live Y.Doc；trusted raw 不继承 zero-write 保证）+ #134 修订节（拒绝码闭集）+ #237 round-2 §3（importReplica 绑定 Hub 广告身份第 4 参） | 污染只经 `session.applyRemoteUpdate`（fixture `applyRawRemote` 远端副本求增量，live doc 零 lease 层直写——grep 亲证）；R1 断言 session 冻结四域（state/direction/localRole/remoteInstanceId）；peer bootstrap 经 `registry.importReplica(owner, NS, snapshot, identity)` 且 identity 取 hub status 复制事实（非文档自身值）；fixture 的 `doc` 引用是测试自有 persistence 持有的装置面（#437 合入先例同款）；session 全部经 `lease.openReplicationSession` 打开、每 fixture 恰一个 | **no-conflict** | ADR-0010 L71–111/L220/L236–237/L287；CONTEXT.md L197–199；fixture `applyRawRemote`/`openPeerFixture`；`#437` fixture 先例亲证 | 无 |
| 11 | ADR-0011（best-effort：emit/排队/持久化/丢弃失败不得改变业务结局；emitter non-throwing seam；诊断不参与提交条件）+ #228 澄清节 | E1/E2 只读观察既有 attempt record/carrier（经 registry `diagnosticLog` 构造选项装配生产形状 binding，#437 先例同款）；不 wire 新发射、不改 emit 调用点；断言先有界 `settleUntil`（400 轮 setImmediate）沉降，业务结局断言与诊断断言互相独立 | **no-conflict** | ADR-0011 L18–31/L109–129/L154–160；fixture `waitForRootMutationRecords`；contract E1/E2 | 无 |
| 12 | ADR-0014（carrier：inline RFC 4648 Base64 + payloadLength + CRC32C 8 位小写 hex、`format:'yjs-update-v1'`；业务 producer 只提交 semantic emission）+ namespace-diagnostic-log AGENTS（冻结 v1 record 契约） | E1 carrier 形态断言（inline/format/正 payloadLength/8-hex crc32c）+ `carrierBytes` 严格解码后核对 payloadLength（「reader 严格解码 Base64 后核对 payloadLength 与 CRC」的消费面）；E2 record/carrier 键集同构；不钉 `payloadLength=43`/`crc32c='be9fa1fe'` 魔数；测试不构造 carrier（producer 语义不触碰） | **implements-existing-decision**（钉死已冻结记录形态） | ADR-0014 L140–212；fixture `carrierBytes`；contract E1/E2 | 无 |
| 13 | `packages/namespace-registry/AGENTS.md`（公共 API 只经 `src/index.ts`；hostile/test 控件留显式测试面；lease=独立 caller capability；session 只经 lease、每 lease 至多一个；生产装配 role 只读自 Instance 服务） | 零 `src/**` 改动、零新导出（`git diff` 空）；fixture 只消费 `@nomicore/namespace-registry`（类型）+ `/testing`（`createNamespaceRegistryForTesting`/`createRegistryTestScheduler`——`src/testing.ts` 显式测试面，`role`/`diagnosticLog` 等 override 均为该面既有选项）；诊断包经相对源码导入（registry 包既有依赖 + #437 合入先例 L46 逐字同款）；fixture 文件非 `*.test.ts`，不进任何包公共导出面 | **no-conflict** | registry AGENTS Boundaries；`src/testing.ts` L38–126 亲证；`git status` 实证；#437 fixture L46 亲证 | 无 |
| 14 | `packages/doc-runtime`/`packages/namespace-diagnostic-log` AGENTS（公共面只经 `src/index.ts`；诊断 v1 record 契约冻结；emit 同步不 throw） + 根 AGENTS typed-writes 强制项适用面（「applications or independent projects」的业务写路径） | DENY 面零触碰（`doc-runtime/src/**`、`issue-441-*`、`issue-437-*`、vfsl 面全部未动，git 实证）；本 diff 为仓内 runtime 回归测试，非应用/独立项目业务写——动态 envelope（字面量路径 + 故意非法值）正是被测对象（B1/B2 类用例在生成类型面不可表达，属 hostile-path 立法本体）；#437/#441 合入先例同款 | **no-conflict** | 两包 AGENTS；根 AGENTS typed-access 段适用面；`git status` 实证 | 无 |
| 15 | 任务简报 AC1–AC7 +「不改实现」+ `docs/AGENTS.md` Authority 节（wiki/raw 证据非规范） | AC→用例映射逐条兑现（AC1=A1–A11、AC2=B1–B8、AC3=C1–C3+U3、AC4=V1–V3、AC5=E1–E2、AC6=R1–R3、AC7=根 gates 绿）；33 its 与 SA6 §12.3 枚举逐 ID 相等（RA-2 口径：5757→5790 实测相符）；Owner 评论面空 ⇒ 无未映射要求；SA3 报告/证据日志落在证据目录，不改任何规范文档 | **no-conflict** | `wiki/raw/task_issue-442.md`；`artifacts/sa3-issue442-root-test.log`（473/5790）；本报告 §2 各行证据 | 无 |

裁决分布：**no-conflict 9 项、implements-existing-decision 6 项、evolution-required 0、hard-conflict 0**。

**AN-1（非阻断解读注记，无需动作）**：ADR-0034 决策 2 的「`unknown` 标量」指**声明类型**为
`unknown`（VFSL 标量类型的 catch-all）——封闭对象 delete 合法性「由 schema 静态判定，不读父值」，
判定输入是字段类型而非运行时值形状（「`unknown` 字段缺席视同接受，现行语义保留」同向）。B5/A7
删除 `unk: unknown`（seed 值 `{k:1}`）断言允许，与该静态规则一致（HEAD 与 baseline 两面实测同绿，
SA6 §5.2/§5.3）；测试 it 标题沿简报 AC2 原文「unknown 标量字段」措辞，不构成对值域的额外立法。

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

实现未声明任何 override，也未发现需要 override 的场合（纯测试新增，不触碰任何被冻结契约）。
Owner 评论面为空（REST issue-comment `[]`、简报 Comments 段空），无 Owner 授权的决策覆盖。

## 4. Frozen surfaces（implementation 逐项核对实际 diff）

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| issue message/path 形态（`[...mapPath, key, …]` rebase、逐字域规则文案、no-op/必填/键 Pattern/载体错位文案） | ADR-0034 决策 1 末条（「与现行逐字节兼容（钉回归测试）」）+ ADR-0007 条款 4(i) | contract B1–B8/A8、control C1/C4 以 `toBe` 逐字断言冻结值 | **不变**——diff 为测试钉死，零生产改动（`git diff` 空）；冻结值与 SA6 §5.2 HEAD 实测逐字相符 |
| mutateData 信封双形态（单操作/`ops` 批量互斥、批内不嵌套、≤16、单事务单 update） | ADR-0026 决策节；CONTEXT「原子变更」 | contract A11 消费批量形态（2 ops 兄弟路径） | **不变**（仅消费；`mutation.ts` 零改动） |
| ReplicationSession 公共面与拒绝码闭集（O-11 状态形状、#134 append-only 码表） | ADR-0010 #134 修订节；CONTEXT「ReplicationSession」 | fixture/R1 只消费五件套 + 冻结四域断言 | **不变**（`lease.ts`/runtime/replication 代码零改动） |
| 复制 wire 契约（`docs/protocols/instance-replication-v1.md` 帧/状态机/错误码） | normative 协议文档 | AC6 仅以进程内 session 面断言「协议承载物零变化」（owned update/diff 定点）；ws-replication/replication-protocol 包零 diff | **不变** |
| 诊断 v1 record schema + update carrier 形态 | `packages/namespace-diagnostic-log/AGENTS.md` 冻结指纹；ADR-0014 L140–212 | E1/E2 只读观察 + 键集同构；零 `namespace-diagnostic-log/src` 改动 | **不变** |
| registry/doc-runtime/vfsl 公共导出面（public-surface guard） | 三包 AGENTS「Add public APIs only through src/index.ts」 | 零 `src/**` 改动；fixture/测试非导出面（`*.test.ts` 收集面外的共享文件，#437 同款） | **不变**（public-surface guard 不触发） |
| ADR/CONTEXT/docs 规范文档与术语 | `docs/AGENTS.md`（Amend or supersede explicitly） | `git status`：`docs/**`、`CONTEXT.md` 零改动 | **不变** |
| 根 gates（`pnpm typecheck`/`pnpm test`） | ADR-0034 后果-验证末句；简报 AC7 | `artifacts/sa3-issue442-root-typecheck.log`（exit 0）、`root-test.log`（473 files/5790 tests 全绿、Type Errors: no errors） | **达成**（文件 +2、用例 +33，与 RA-2 枚举口径 5790 相符） |

## 5. Evolution requirements

无。diff 零契约变更：不修订任何 ADR/CONTEXT/协议条款，不新增诊断/复制/错误码词表值，无迁移、
兼容、版本或失败语义问题。SA3 报告 §7 登记的 deferred 项（S9/E201/fatal 面归 #441、raw 污染异步
审计「需要时另行设计」、合法性重建 follow-up、毫秒级基准、真实网络复制）均与 ADR-0034「不做什么」
及设计 §13 follow-up 登记一致，正确地不在本票承担。

## 6. Hard conflicts

无。

## 7. Required actions

无阻断项。设计后报告的三条 Required actions 兑现情况（闭环登记）：

1. **RA-1（条款指针勘误）— 已闭**：SA3 报告 §4 以实现期备注位登记正确出处（ADR-0034 后果-验证
   基准条款 + ADR-0033 决策 6）；交付测试的成本断言与真实条款完全一致（§2 行 6）。
2. **RA-2（枚举 33 口径）— 已闭**：落地实测 29+4=33 its、根 test 5757→5790（+33），与仲裁口径
   逐 ID 相符；零 skip/only/todo。
3. **RA-3（既定门复跑）— 已闭**：root typecheck exit 0、root test 473/5790 全绿、聚焦面 3×33/33
   零 flakes、baseline 判别面 15 红/18 绿且失败原因恰为旧语义（证据日志尾部亲读）。

非阻断注记：AN-1（§2 行 2，`unknown` 标量 = 声明类型解读，行为两面实测同绿，无需动作）。

## 8. Verdict

**clear**

- diff 恰为 ALLOW LIST 三文件（fixture + 契约 29 + 负控 4），零 tracked 改动、零生产面触碰；
  「不改实现，只立法回归测试」逐字兑现。
- 15 项对照全部为 `no-conflict`（9）或 `implements-existing-decision`（6）；无 evolution-required、
  无 hard-conflict、无 override 需求；两处实现期决策（三面零写入锚、B6 扇出结算）均落在冻结契约
  自身的定义面内。
- 33 个用例与 SA6 §12.3 冻结规格逐 ID、逐冻结值相符；判别性由 baseline 证据（15 红）承载，
  与 SA6 §14 纪律一致（交付测试不携带 baseline 分支）。

## 9. requiresConflictRecheck

**false**。理由：纯测试新增已落地并被本报告逐项核对——公共 API、wire、schema、持久化、状态机、
生命周期、失败语义零触碰（`git diff` 空），无正式 override 待实现核对；被钉死的全部行为期望均
为既有 ADR 决策的消费而非创设，且其「文档与代码同变更集」的语义面不存在（本变更集不改任何
文档契约）。后续若有人在生产面（`src/**`/协议/诊断契约）修订 Record/parent 语义，本三件套红灯
即为回归信号，属测试立法目的而非待核对冲突。
