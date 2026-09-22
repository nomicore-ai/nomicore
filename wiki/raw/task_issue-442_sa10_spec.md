# SA10 Spec 审查 — Issue #442：lease 端到端 Record/parent 逐 entry 校验行为钉死（ADR 0034）

- 审查对象：**committed final delivery diff** `2c6f855509e3b287e1d3e262d3bd966d73b2c301`
  （`test(namespace-registry): cover lease record validation e2e`，分支 `mabf/issue-442`）
- 审查人：SA10（独立 Spec 审查；未修改任何代码/设计/测试，未运行测试，未启动服务）
- Worktree：`/home/wangjian/nomicore-fix-issue-442`；HEAD = 交付提交 `2c6f855`（工作树干净）
- 母 PR 锚定：dispatch 明示 PR #438（spec/adr-0034-record-elementwise-validation）freshly verified
  OPEN @ head `c42fb470fb3e5f67bc3ea2abc3720e03dfdb3963`；本会话 `git merge-base --is-ancestor`
  亲证 **`c42fb47` 是交付提交 `2c6f855` 的祖先**（直接父提交）
- Owner 评论面：Host 明示 `Current owner-comment requirements: none`（REST issue-comment `[]`；
  简报 Comments 段空）——唯一需求面 = Issue 正文 AC1–AC7
- iteration 0（无既有 `task_issue-442_sa10_spec.md` 需原位修订）

## 1. Reviewed inputs

| 输入 | 位置 | 状态 |
|---|---|---|
| 任务简报（Issue 正文） | `wiki/raw/task_issue-442.md`（AC1–AC7、Blocked by #441、Comments 空） | 已读 |
| 批准设计 | `wiki/raw/task_issue-442_design.md`（449 行） | 已读全文 |
| SA2 设计评审 | `wiki/raw/task_issue-442_sa2_review.md`（approve，Required revisions 空） | 已读 |
| SA6 验收契约 | `wiki/raw/task_issue-442_sa6_contract.md`（approve，§12.1–§12.4 冻结规格） | 已读全文 |
| SA3 实现报告 | `wiki/raw/task_issue-442_sa3_impl.md`（含 §8 两处非软化偏离申报） | 已读 |
| SA4 实现审查 | `wiki/raw/task_issue-442_sa4_review.md`（approve，无 BLOCKER/MAJOR，O-1..O-6 MINOR） | 已读 |
| SA8 设计冲突报告 | `wiki/raw/task_issue-442_design_conflict_report.md`（clear，RA-1/RA-2/RA-3） | 已读 |
| SA8 实现冲突报告 | `wiki/raw/task_issue-442_implementation_conflict_report.md`（clear） | 已读 |
| 母法 | `docs/adr/0034-record-and-parent-elementwise-validation.md`（决策 1–6 + 不做什么 + 后果） | 已读全文 |
| 交付测试 | `packages/namespace-registry/test/issue-442-lease-record-e2e-{fixture,contract.test,control.test}.ts`（640/603/154 行） | 已逐行读全文 |
| 验证证据 | `artifacts/sa3-issue442-{root-typecheck,root-test,focused-stability,baseline-discrimination}.log`、`artifacts/sa6-issue442-probe-head.log` | 已核对关键行与逐字冻结值 |

独立复核命令（本会话执行，只读）：`git show --stat 2c6f855`、
`git merge-base --is-ancestor c42fb47 2c6f855`、
`git diff --stat c42fb47 2c6f855 -- 'packages/**/src/**' vitest.config.ts package.json pnpm-lock.yaml docs/** CONTEXT.md`（**0 行**）、
`grep -c "it("`（契约 **29** / 负控 **4**）、
`grep -nE "\.skip|\.only|\.todo|process\.env|setTimeout|readFileSync"`（仅一处注释提及 setTimeout，零实际命中）、
证据日志尾部亲读（typecheck `ROOT_TYPECHECK_EXIT=0`；test `473 passed / 5790 passed`、`ROOT_TEST_EXIT=0`；
聚焦面 3×`2 files/33 tests`；baseline `15 failed | 18 passed (33)`，失败 ID 清单逐一提取亲证）。

## 2. Verdict

**approve**。

交付 diff 忠实满足 Issue 正文全部 7 条 AC，无遗漏、无部分实现、无错误实现、无 scope creep；
无必须披露的未达成项。SA6 契约 §12.3 全部 33 个 ID（契约 29 + 负控 4）逐一在位且断言/冻结值
与上游实测逐字相符；「不改实现」逐字兑现（交付 diff 对 `packages/**/src/**`、runner 配置、
规范文档零改动，7213 行全部为新增文件）；根 gate 证据（typecheck exit 0、test 473 files /
5790 tests 全绿）在位且与 SA8 RA-2 仲裁口径（枚举 33、5757→5790）逐项吻合。判别性证据
（pre-#441 `3fd6aa8` 基线 15 红 / 18 绿，失败 ID 恰为 A1–A11、U3、U4、V3、R3）证明所钉
断言对 ADR 0034 行为变化敏感而非恒真。3 条非阻断观察见 §6，均不阻断 approve。

## 3. AC 逐条核对（Issue 正文 → 交付证据 → 判定）

| AC | 交付证据 | 判定 |
|---|---|---|
| AC1 行为变化钉正：污染 Record map 写/删未触达 entry 非法的键位，目标键合法即成功（旧语义连带拒绝）；封闭对象 delete 同理 | 契约 AC1 组 **A1–A11**（contract L117-274）：Record map 面 = 兄弟载体错位（A1 set/A2 delete/A3 删污染键自身）、兄弟值非法（A4）、兄弟键违约（A5）、值位 union（A9）、深层 Record（A10）、批量信封单事务单 update（A11）；封闭对象面 = delete optional（A6）/unknown（A7）/必填静态拒绝（A8，message 级判别）。每条均断言 `ok` 位 + 污染逐字保留（`'oops'`/`qty:'x'`/`deep===5`/`nope`）+ update 差值恰 1 + 目标键终态 | **met** |
| AC2 不变量钉死：键 Pattern/非法新值零写入 + issue 路径 `[...mapPath,key]` 不变；no-op delete 拒绝；必填 delete 拒、unknown 标量 delete 允许 | 契约 AC2 组 **B1–B8**（L278-375）：B1 非法新值逐字 `类型不匹配：期望 number，实际 string` @ `['tasks','t9','qty']`；B2 键 Pattern 逐字 @ `['codes','nope']`；B3/B6 no-op 逐字 `delete 目标键不存在（拒绝 no-op）`；B4 必填拒 `缺少必填字段 "req"`；B5 unknown 允许；B7 触达面内载体位逐字 `Yjs 载体错位（ROOT）…` path `[]`；B8 深层 rebase `['outer','inner','n2','qty']`。全部拒绝分支附三面零写入锚（stateBytes 逐位 ∧ update 差值 0 ∧ owned 差值 0） | **met** |
| AC3 union map 位端到端行为与性能路径不变（仍全量边界校验） | 负控 **C1–C3** + 契约 **U3** union 半：C1 同污染同 op 照旧逐字拒绝（`ROOT.mz`/`['mz']`，A/B 对照证 A 组非恒真）；C2 干净 set/delete 照常 ok；C3/U3 union 半读计数 ≥ n（全量边界校验仍在） | **met** |
| AC4 Record 值位 union 仍走 fast path（行为正确且不经全量提取） | 契约 AC4 组 **V1–V3**：V1 两支成员均 ok；V2 恰 2 条联合成员 issue 逐字 `toEqual` 全数组 + 零写入；V3 读计数 ≤8 且 n=64/256 相等（与 n 解耦） | **met** |
| AC5 诊断烟测：fast path 提交的 committed update bytes 记录形态不变 | 契约 AC5 组 **E1–E2**：E1 恰 1 条 root-mutation attempt、stage='transaction'、source={kind:'local'}、committed effect:update、inline carrier（format='yjs-update-v1'、payloadLength>0、8-hex crc32c）、carrier 重放为真事务增量、空 doc 不物化 ROOT；E2 Record 写 vs 标量写的 record/carrier 排序键集逐键同构 | **met** |
| AC6 复制烟测：fast path 提交经 replication apply 在对端收敛、无协议面变化 | 契约 AC6 组 **R1–R3**：R1 owned update 重放收敛 + peer apply ok + 逻辑值相等 + diff 定点 + session 四域（open/hub-to-peer/peer/hub-442）；R2 最小增量（空 doc 不物化 ROOT）+ 1 提交=1 owned 事件、2 笔=2；R3 对端既得新值又保留污染（证伪整 map 重写） | **met** |
| AC7 根 `pnpm typecheck` 与 `pnpm test` 绿 | `artifacts/sa3-issue442-root-typecheck.log`（15 包 `tsc -p` 全过，`ROOT_TYPECHECK_EXIT=0`）；`artifacts/sa3-issue442-root-test.log`（**473 files / 5790 tests passed**，`Type Errors: no errors`，`ROOT_TEST_EXIT=0`；起点 471/5757 ⇒ 恰 +2 文件 +33 用例，与两 `.test.ts` 命中 include 面一致）；聚焦面 3 轮 × 33/33（`sa3-issue442-focused-stability.log`） | **met** |

补充核对（非 AC 字面但属 Issue 正文「What to build」与 ADR 0034 母法）：
- **最高 seam**：全部业务写/读经 `createNamespaceRegistryForTesting` → 生产 Runtime 装配 →
  `registry.open`/`importReplica` → `lease.mutateData`/`lease.readData`（fixture L293-420 亲证）；
  raw 污染只经 `session.applyRemoteUpdate`（`applyRawRemote` L570-583），lease 层零直写 live Y.Doc。
- **「不改实现」**：交付 diff 对生产面/规范面零改动（§1 复核命令 0 行 diff；`git show --stat`
  全部为新增文件，0 删除）。
- **判别性立法成立**：`sa3-issue442-baseline-discrimination.log` 实测 pre-#441 `3fd6aa8` 上
  恰 A1–A11、U3、U4、V3、R3 **15 红**（失败原因亲证为旧语义连带拒绝/读计数 ∝ n），其余 18 绿；
  与 SA6 §5.3/§13 及设计 §12 验证命令 4 完全一致。
- **逐字冻结值与上游实测一致**：A8/B1/B2/B3/B4/B6 的 message+path 与
  `artifacts/sa6-issue442-probe-head.log` EVIDENCE 行逐字比对相符（本会话抽核）。

## 4. Owner 评论要求

无（REST issue-comment `[]`、简报 Comments 段空、Host 明示 none）。交付未虚构映射行；
唯一需求面 AC1–AC7 全部落实，见 §3。

## 5. 上游 finding / Required actions 闭环核对

| 项 | 级别 | 交付落实 | 判定 |
|---|---|---|---|
| SA8 RA-1（「ADR 0034 决策 6 软验收」条款指针勘误） | 非阻断勘误 | SA3 报告 §4 备注位已登记正确出处（ADR 0034 后果-验证基准条款 + ADR 0033 决策 6）；交付测试只用机器无关读计数、零毫秒阈值，行为与真实条款一致 | 已闭 |
| SA8 RA-2（按枚举 33 落盘；准绳=零 skip + 逐 ID 覆盖 §12.3 全表） | 验收口径 | 落盘 29+4=33；grep 零 skip/only/todo；33 ID 逐一对照 SA6 §12.3 全表无缺漏；根 test 实测 5757→5790（+33） | 已闭（SA6 头部「34/5791」为其自身算术笔误，设计 §5/R-6、SA2 §5、SA8 Verdict-2b 三方仲裁以枚举为准，交付符合仲裁口径） |
| SA8 RA-3（既定门：根 gates + 聚焦面 33 全绿） | 既定门 | §3 AC7 行证据 | 已闭 |
| SA2 O-1..O-5 | MINOR | SA3 §4 / SA4 §3 逐条落实或如实记录 | 不阻断 |
| SA3 §8 偏离 1（三面零写入锚统一至全部拒绝分支） | 申报偏离 | SA6 §12.1 B-8 本就以三面定义零写入锚；SA2 O-4 裁定被零写入语义蕴含、不可伪红；SA4 O-2 与 SA8 实现报告行 7 均裁定「加严非软化」且基线两面同绿 | 接受，不构成 spec 缺口 |
| SA3 §8 偏离 2（B6 重复 delete 前先结算首删扇出） | 申报偏离 | 差值断言的装置前提修正（否则首删 owned update 污染差值→伪红）；SA4 O-3 接受 | 接受，非验收面变化 |

## 6. Non-blocking observations（不阻断 approve）

| ID | 观察 | 处置建议 |
|---|---|---|
| N-1 | SA6 契约 §1/§13 头部称「契约 30 + 负控 4 = 34 → 5791」，与其 §12.3 逐 ID 枚举（29+4=33 → 5790）自相矛盾。交付按三方仲裁（设计 §5/R-6、SA2 §5、SA8 RA-2）以枚举 33 落盘，根 test 实测 +33 吻合。**此为上游证据笔误而非交付缺口**；但 PR 描述/merge 面若引用 SA6 头部数字宜注明以枚举 33/5790 为准 | PR 披露时附带一句口径说明即可（SA8 RA-2 已要求 Controller/SA7 知悉） |
| N-2 | U3/U4/V3/C3 四条成本用例在其 `it` 内未断言所测 `mutateData` 的 `ok` 位（SA6 §12.3 该四行本就只冻结读计数断言；行为配对由套件级 A11/E1/R1/R2 承担——SA4 O-1 同判且给出反证链） | 无需动作；未来原位修订可在计数回调后补一行 `expectOk` 使成本/行为配对自含 |
| N-3 | `openLeaseFixture` 的 `role:'peer'` 分支（`remoteInstanceId: HUB_INSTANCE_ID`）未被任何用例消费（peer 一律经 `openPeerFixture` bootstrap）——装置面冗余，无行为影响（SA4 O-5 同判） | 无需动作；未来修订时移除或注明保留原因 |

## 7. 必须披露的未达成项

**无。** 无 AC partial / unmet / unachievable；无 scope creep（交付 diff 恰为设计 ALLOW LIST
三测试文件 + Host 证据目录 artifacts + SA 固定 wiki/raw 产物；生产实现、runner 配置、
规范文档、wire/协议代码零触碰）；无静默偏离（两处实现期决策均已在上游申报并经 SA4/SA8
裁定为非软化）；无遗留临时诊断（baseline worktree 已移除，本会话 `git status` 干净亲证）。

---

## 附：审查结论一句话

**approve**：交付提交 `2c6f855` 以零生产改动的纯测试三件套（fixture 640 行零 vitest 依赖 +
契约 29 its + 负控 4 its）把 ADR 0034 的 lease 最高 seam 用户可见行为与不变量逐 ID、逐字
立法（AC1–AC6 全覆盖），判别性经 `3fd6aa8` 基线 15 红/18 绿实证，根 gates 证据
（typecheck exit 0、test 473 files/5790 tests 全绿、聚焦面 3×33/33）在位且与 SA8 RA-2
仲裁口径逐项吻合；母 PR #438 head `c42fb47` 为交付祖先亲证成立，Owner 评论面为空；
3 条非阻断观察不阻断合并。
