# task_issue-348 SA4 实现静态审查（guard II 语义矩阵落地）

- 被审对象：SA3 交付 `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts`（新建，1086 行）+ `wiki/raw/task_issue-348_sa3_impl.md`
- 审查角色：SA4（实现静态审查；不修改实现/设计/测试，不运行测试、不启动服务、不创建临时进程）
- 基线核对：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（branch `mabf/issue-348`）；`git status --porcelain` 仅 8 个未跟踪文件（1 测试 + 7 wiki 任务产物），**零 tracked 改动**
- iteration 0（首版；此前无 `task_issue-348_sa4_review.md`）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-348.md`（issue 正文 8 AC + Blocked by #347；评论 REST 读取为空——与 dispatch 同口径） | 已读 |
| `wiki/raw/task_issue-348_sa6_contract.md`（§12.0–§12.9 用例权威 + §12.11 修正范围裁定） | 已读 |
| `wiki/raw/task_issue-348_design.md`（SA1 设计；ALLOW/DENY、D1–D9、§13.3 条件修正路径） | 已读 |
| `wiki/raw/task_issue-348_sa2_review.md`（approve；R1/R2 MINOR + N1–N6） | 已读 |
| `wiki/raw/task_issue-348_conflict_report.md`（SA8 clear；§4 冻结面 8 项；requiresConflictRecheck=false） | 已读 |
| `wiki/raw/task_issue-348_relevant_decisions.md`（ADR 0025/0026/0007/0008/0016/0002 条款摘录） | 已读 |
| `wiki/raw/task_issue-348_sa3_impl.md`（SA3 实现报告） | 已读 |
| 源码只读核对：`packages/doc-runtime/src/mutation.ts`（guard 面：L130–213/L223–307/L540–552/L594–683/L687–693/L711–752）、`read.ts`（L53–135/L320–390）、`index.ts`（L23/L25–32）、`materialize.ts` | 已核 |
| 测试与配置：新测试文件全文 1086 行、`issue-347-guard-envelope-red.test.ts`（惯例基线 L1–175）、`vitest.config.ts`、`packages/doc-runtime/tsconfig.json`、根 `package.json`、`.github/workflows/ci.yml`、yjs 13.6.32 `XmlFragment/Y.Text.toJSON` 源 | 已核 |
| ADR 原文抽核：0025 L42–44/L48–51/L53–58/L72–74（评估语义/位置/错误域/组合节）、0026 L29/L53–55、0007 L29/L93–96、0008 L23/L26 | 已核 |

SA4 未运行任何测试；运行时结果（92/92、29 files/539 tests、typecheck exit 0）引自 SA3 报告记录并与 SA6 §5/§14 探针证据交叉核对，静态侧全部断言与实现源码逐条比对成立（见 §9）。

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR、无需生产修正、无新 ADR 冲突风险（requiresConflictRecheck = false）。

- 交付物 = 单个新增测试文件，落在 SA6 §12.1 / 设计 §11 冻结落点，ALLOW 面内；DENY 面全部未触碰（`mutation.ts`/`read.ts`/`index.ts` sha1 与 HEAD 逐字节一致：`dd46e2bc…`/`7e1a0496…`/`e7f36c5f…`，实测 `git show HEAD:… \| sha1sum` 相同）。
- 92 用例与 SA6 §12.2–§12.8 逐 ID 1:1（实测 `it(` 计数 92、`describe(` 计数 7、组内 16/31/7/15/7/4/12）；三态判决契约（满足/不满足/形状错误）逐条锚定运行时可观察行为。
- 全部断言与生产源码语义静态一致（§9 表）；未发现重言式、软化断言、skip/only/todo、源码字符串断言或 runner 盲区。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| Issue AC1 深相等（嵌套、undefined 键过滤、`-0`/`0`） | A 组 16 `it`（A1/A1b/A1d/A2–A14）；A1/A1d 用 `baseSnapshot({n:0})`、A1b `{n:-0}` 并前置 `Object.is(root.get('n'),-0)===true` 保号断言、A8 `{values:[1,0,3]}`、A12 `{free:{z:0}}` | 落实。与 `logicalValuesEqual`（mutation.ts L540–552：`===` 首判 + 数组逐位 + plain undefined 键过滤 + 键完整）逐条对齐 |
| Issue AC2 读失败两态/缺席吸收 | B 组 31 `it`（B1–B30 含 B25b）；标量穿越/中间缺失/越界/负·非整数下标/null 穿越与终点/plain 缺键/Y.Text/空 XML/Date/detached 全覆盖 | 落实。极性与 `evaluateGuard`（L711–718：absent ⇔ `!read.ok\|\|value===undefined`；equals ⇔ `read.ok && logicalValuesEqual`）和 `read.ts` 导航/投影（L70–127/L340–364）逐条一致 |
| Issue AC3 XML 两形态 | C1–C7：终点投影字符串比较（C1/C2）、终点 absent 不满足（C3）、穿越两形态（C4–C7，string/number 段各一对） | 落实。`read.ts` L106–107 穿越 → notAllowed；L351–352 终点 → `toString()` 语义字符串 |
| Issue AC4 数组下标段纪律 | D1–D15：Y.Array/嵌套/plain/YPlainArray 位置读、`-0` 归一、string 段落数组与 number 段落 Y.Map 读失败、越界吸收、`MAX_SAFE_INTEGER+2`/`NaN` 段非形状错误 | 落实。`parseGuard` L673–677 仅查段型 `string\|number`（NaN/负数/越界值段过形状）；读面 `isNonNegInt` 判非下标 → 读失败 |
| Issue AC5 `set([])` 先过 guard | E1–E7：不满足零写入三件套 + `n` 保持 4711；满足走完整 legacy（E2 ROOT 全等、E3 省略可选键后 `has('reviewer')===false`）；E4↔E7 次序对照（`类型不匹配` 互斥出现） | 落实。guard 评估位点 mutation.ts L175–178 实测位于 L182 `isRootReplace` 分叉前、legacy 校验（L188–198）之前 |
| Issue AC6 大子树 | F1–F4（程序化 64 键/256 元素；F3/F4 `message.length<4096`）+ A14（24 层深） | 落实。截断上界静态可证：`GUARD_SUMMARY_LIMIT=256` 单侧截断 + 模板（L731–742），总量 < 1KB |
| Issue AC7 批量顶层同语义 | G1–G12 与单操作配对（标题内标注配对 ID）；满足 = 两 op 全落盘 + 1 事务 1 update（`expectBatchLanded`）；不满足 = 恰 1 issue + 零写入；G10 锚「guard 先于逐操作 prepare、无 schema 消息」 | 落实。批量 G 段 L287–292 实测先于 P 段 L293–304；单事务提交 L141–143 |
| Issue AC8 落位 + 门 | 落点 = 冻结路径；`vitest.config.ts` L15 include 覆盖；根 `typecheck` 含 doc-runtime（`test/**/*.ts`）；SA3 记录 29 files/539 tests + typecheck exit 0 | 落实。文件计数实测 27 `.test.ts` + 2 `.test-d.ts` = 29；447+92=539 算术一致；CI 分片按磁盘枚举（ci.yml L46–49「新测试文件自动落入某片，不会漏跑」） |
| Issue「以 ADR 0025 为准修正实现」条件句 | 未触发：SA3 记录首次运行 92/92 全绿，生产修正范围保持 ∅，§13.3 条件路径未启用 | 落实。sha1 三文件与 HEAD 一致为直接证据 |
| SA6 §12.0 判决契约/纪律 | `expectCommitted`/`expectGuardMismatch`/`expectShapeError` 集中编码；grep `.skip\|.only\|.todo\|console.\|as any\|process.env` 0 命中 | 落实 |
| SA6 §12.9 负控 N-A–N-E | N-A/N-E 引用保持（本文件不重复断言无 guard 基线与导出面，仅 `expectGuardMismatch` 内保留一行同源检查，#347 P2 同款）；N-B/N-C/N-D 内嵌成对（A1↔A1d、A3↔A4、A5/A2↔A7、A9↔A11、F1/F2↔F3/F4；B 组 absent 满足 ↔ B25/C3/E6/G3 有值不满足；E4↔E7） | 落实 |
| SA8 §4 冻结面 8 项 | 全部未触碰（sha1 一致）；矩阵只断言现值，无任何契约改写 | 落实 |
| SA2 R1（fixture 变体枚举不完整） | 文件头 L38–40 显式「非穷举枚举，前置条件以 SA6 表为准」+ 逐条落码：A1/A1d `n:0`（L238/L255）、A8 `values:[1,0,3]`（L322）、G6 `n:0`（L1025）、E5 合法全量快照 `baseSnapshot({n:42})`（L890） | 落实；M2/M3 增量锚极性未被翻转 |
| SA2 R2（detached 措辞超出 fixture 能力） | 文件头 L40–42 改写为「B28 是 loud 拒绝区分锚（静默投影 `''` 会使 absent 满足转红）；B29/B30 锚 equals 的 M1 敏感性」；B28 absent 满足 + 落盘、B29/B30 equals 不满足 | 落实；设计与实现口径一致 |
| SA2 N3（满足态落盘断言） | 59 个满足态用例全部携带落盘断言（`n=2`/`taskEntry`/`valuesArray.toJSON`/`root.toJSON`/`expectBatchLanded`；实测 `expectCommitted` 59 调用点 = 92−31 mismatch−1 shape−1 schema 拒绝） | 落实 |
| SA2 N4/N5/N6（message 辅助锚） | C2 `toContain('<p>hi</p>')` 次级断言注明辅助；E4 `toContain('类型不匹配')` ↔ E7/G10 `not.toContain`；B25 absent 不满足（正极性反例）+ B25b `equals:''` 满足 | 落实；主断言恒为判决契约 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1 单文件落位（冻结路径） | `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts`（唯一源码交付物） | 一致：每 issue 单测试文件惯例（issue-237/347/350 先例） | 无 |
| D2 fixture 自包含 + #347 严格超集 | `TEXT`/`derivedOf`/`baseSnapshot`/`fixture` 内联（L63–111）；TEXT 与 SA6 §12.0 冻结文本逐字相同；既有字段同形，新增 `tags?`/t3/body/blob/free | 一致：test/ 目录无共享 helper（实测），无第二 fixture 体系 | 无 |
| D3 一个 `it` 恰一用例 ID，ID 置标题首 token | 92 `it` 标题实测（A1…G12）；计数锚 28→29 files、447→539 tests 与文件计数/算术一致 | 一致 | 无 |
| D4 恰 7 个顶层 describe、组序=AC 序、无嵌套 | 7 个 describe 标题与设计 §7 D4 逐字同形（含组名与用例数） | 一致 | 无 |
| D5 负控组织（引用保持 + 内嵌成对） | N-A/N-E 零重复（引用 #347/public-surface 既有文件）；成对用例同 fixture 相邻落位且极性互反 | 一致 | 无 |
| D6 助手集 + 新增 `expectCommitted` | #347 五助手同款语义内联；`expectCommitted`（L183–191）= ok:true + 恰 1 本地事务 + 恰 1 update；落盘断言逐用例内联 | 一致（签名与 `watchWrites` 返回型匹配） | 无 |
| D7 断言纪律 | 全部断言观察结果联合/活动值/事务·update 计数/字节快照；grep skip/only/todo/env override/`as any`/console = 0 命中（实测 exit 1）；message 仅次级 | 一致 | 无 |
| D8 文件头 doc-comment（目标绿声明） | L1–48：引 ADR 0025 L42–44/L48–51/L53–58/L72–74、ADR 0026 L29/L53–55、ADR 0008 L23/L26、ADR 0007 L29/L93–96 + SA6 §12 用例 ID + M1–M4 反伪绿证据 + R1/R2 澄清；**无**「红灯现状」段（HEAD 无红灯，未虚构） | 一致：与 ADR 原文抽核相符 | 无 |
| §8.1 B 组直造载体变体 | B22–B24 `root.set('free', new Y.Text('t'))`、B25/B25b 空 `Y.XmlFragment()`、B26/B27 `new Date(0)`、B28–B30 `{frag: new Y.XmlFragment()}` plain 内嵌 detached；构造均在 `watchWrites` 之前（S2 次序纪律落实，实测逐例核对） | 一致：read 系列测试同款先例（schema-independent 读面契约内） | 无 |
| §8.3 无运行时数据流变化 | 生产源零改动（sha1 三文件 = HEAD） | 一致 | 无 |
| §13.3 条件修正路径 | 未触发（无红灯）；DENY 面未开 | 一致 | 无 |

设计明确但实现缺失：无。实现必要偏离设计：无。

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| guard 语义可执行锚（Seam 1） | doc-runtime 测试（ADR 0025 L90/issue 定位） | 新测试文件，经 `applyValidatedMutation` 公共入口（`run` 助手） | 正确：不触碰 namespace-runtime/诊断透传面 |
| 语义权威 | ADR 0025 + SA6 §12 表 | 测试只断言现值；文件头声明用例来源与前置条件权威归属 SA6 表 | 正确：无第二语义源 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 每 issue 单测试文件 | `issue-237-*`/`issue-347-*`/`issue-350-*` | 单文件 92 `it` | 一致 | D1 同款 |
| 自包含 fixture + 内联助手 | #347 L46–172（`derivedOf`/`baseSnapshot`/`fixture`/`run`/`bytes`/`taskEntry`/`watchWrites`/`expectZeroWrite`/`expectGuardMismatch`/`expectShapeError`） | 同款助手逐语义复制（含事务计数口径 `transaction.local && changed.size>0`、`encodeStateAsUpdate` 字节快照） | 一致 | 新增 `expectCommitted`/`valuesArray`/`guarded`/`rootReplace`/`bigTasks`/`deepFree`/`batchOps`/`expectBatchLanded` 均为本票口径集中化，非平行机制 |
| 直造载体 fixture | `read-logical-value-at-path-schema-independent.test.ts`（`root.set('textVal', new Y.Text('hi'))` 等先例） | B22–B30 同款手法 | 一致 | 锚定的是 read.ts 显式契约分支（R2 #2 detached loud 拒绝等） |
| 用例 ID 入标题 + 文件头引 ADR 行号 | #347 全文风格 | 同款 | 一致 | — |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 用例输入/期望 | SA6 §12.2–§12.8 表 | 测试文件（逐 ID 1:1） | 低：标题 ID + 文件头权威声明；实现与表逐行核对一致（本评审核对全部 92 例的路径/谓词/极性） |
| 稳定码 | `mutation.ts` 导出经 `index.ts` | 测试内字面量 + `GUARD_MISMATCH_EXPORT` 同源双断言 | 无：漂移两向均红 |
| fixture 文本 | SA6 §12.0 冻结 | 测试 `TEXT` | 无：逐字相同（实测比对） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 每 `it` 自建 `Y.Doc` + `watchWrites` 挂观测器 | runner 进程回收（vitest `maxWorkers:1`）；无跨用例可变状态 | 测试失败即红，无清理路径需求 | 无缺口（与 #347 同款；D7/设计 §9 落实） |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 共享 helper 模块 | 无（test/ 实测无非测试 .ts） | 未引入 | 无重复 |
| 第二 fixture/错误域/词表 | ADR 0025 两态错误域 | 只断言不改变 | 无重复 |
| 配置改动 | vitest include/tsconfig include 已覆盖 | 零配置改动 | 无重复 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts`（新建，未跟踪） | 设计 §11 ALLOW 第 1 行（SA6 §12.1 冻结落点） | AC1–AC8 全部用例落点 | 面内 |
| `wiki/raw/task_issue-348_sa3_impl.md`（新建，未跟踪） | SA3 技能固定产物位 | 实现报告 | 面内（非源码路径） |
| 其余 6 个未跟踪 `wiki/raw/task_issue-348*.md` | Host/上游产物（SA6/SA8/SA1/SA2 在 SA3 派发前已存在，mtime 09:27–10:07 早于 SA3 报告 10:12） | 只读输入 | 非 SA3 改动 |

- DENY 面核对（全部未触碰，`git diff HEAD --stat` 为空）：`mutation.ts`/`read.ts`/`index.ts` sha1 与 HEAD 逐字节一致（实测）；`issue-347-guard-envelope-red.test.ts`、`public-surface-guard.test.ts`、`issue-350-*`、namespace-runtime/vfsl/persistence/apps/domains、`docs/adr/**`、`CONTEXT.md`、`vitest.config.ts`、`package.json`、tsconfig、`pnpm-lock.yaml` 均 tracked 干净。
- 临时探针残留：`packages/doc-runtime/` 下无 `.sa3-probe`/`.sa6-probe` 目录（实测）；SA3 报告称收尾删除，与磁盘一致。
- 越 ALLOW 或触 DENY：**无**。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `applyValidatedMutation` 结果联合 | 生产调用方（namespace-runtime 写槽 `write.ts`、typed adapter） | 生产零改动；测试经公共入口消费结果联合，无行为变化 | 无 | 无 |
| `MUTATION_GUARD_MISMATCH` 值导出 + 4 类型导出 | `public-surface-guard.test.ts`（N-E）与外部消费者 | 导出集冻结（sha1 一致）；`expectGuardMismatch` 双向同源断言 | 无 | 无 |
| 既有测试基线（28 files/447 tests） | #347/#350/public-surface 等 | 全部 tracked 未改；AC8 门整目录运行使其充当负控载体 | 无 | 无 |
| vitest 发现新文件 | 根 `vitest.config.ts` L15 include | `packages/*/test/**/*.test.ts` 覆盖冻结落点；CI 分片按磁盘枚举（ci.yml L46–49）自动纳入 | 无 | 无 |
| typecheck 覆盖新文件 | 根 `pnpm typecheck` | doc-runtime tsconfig `include: ["src/**/*.ts","test/**/*.ts"]` 实测覆盖；SA3 记录 exit 0 | 无 | 无 |

无遗漏 caller；无返回值/抛错/nullable/异步时序/取消/资源关闭/事件监听器/后台任务/持久化恢复/wire-schema 消费者变化（测试唯一交付物）。

## 8. 错误、恢复与并发

| 检查项 | 结果 |
|---|---|
| 错误两态锚定（形状错误无码 / 不满足稳定码） | A13（`equals:undefined` → `parseGuard` L664–666 拒绝，实测源码在案）；31 例 mismatch 断 `code==='MUTATION_GUARD_MISMATCH'` 且与导出同源、`path` toEqual guard 路径、零写入三件套 |
| 零写入三件套真实性 | `expectZeroWrite` = `encodeStateAsUpdate` 字节不变 + 0 本地事务 + 0 update；经 `expectGuardMismatch`（31 调用点）/`expectShapeError`（A13）/E4 显式调用，覆盖全部 32 个拒绝用例（实测计数 31+1+1=33 处调用含 E4，其中 E4 为 schema 拒绝路径） |
| 评估不进事务 | 两个评估点（L175–178/L289–292）实测均位于 `transactGuarded`（L141/L147）之前；拒绝路径在任何事务开启前返回 → 0 事务断言可区分 |
| 次序语义（先于 schema、先于逐操作 prepare） | E4↔E7、G10 以 `类型不匹配` 互斥出现锚定；与源码位点一致 |
| 部分完成/迟到回调/重启 | 本地同步 API + 每例独立 `Y.Doc`，无该面；批内原子性由单 `transactGuarded`（L141–143）承载，G 组断言 1 事务 1 update |
| 并发/TOCTOU | 无新增面（原子性归写序列器 FIFO，ADR 0008 L40–51）；序列器竞争面归既有 namespace-runtime 测试（引用保持） |
| 吞错/伪成功 | 无 try/catch 吞错、无 fallback、无软化断言（grep 实测）；fixture 构造失败以 throw 响亮（`derivedOf`/`fixture`） |
| B22–B30 直造载体依赖 yjs 集成行为 | detached（`doc===null`）与 plain 内嵌不集成是 read.ts R2 #2 显式契约分支（L341–344）；yjs 升级敏感性列入后续动态验证项（§10） |

静态无法确认的运行风险（规模耗时、flake、消息长度实测值）列入 §10；不以猜测替代。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| A1/A1b/A8/A12/G6（-0 族，M2 增量锚） | 满足态 `ok:true`+1 事务 1 update+落盘；A1b 另前置 `Object.is(n,-0)===true` 保号证据 | 根 vitest include；CI 分片 | 无：真实比较而非同义反复（A1c 证据落地为运行时断言） | 无 |
| A5/A6/A7/G8（undefined 键过滤，M4 锚） | 过滤后相等满足 / 键完整非子集不满足 | 同上 | 无：与 `logicalValuesEqual` L548–551 键过滤+长度判等逐条对齐 | 无 |
| B1–B30（读失败两态，M1 锚 13 例） | absent 满足/equals 不满足成对；越界吸收（B5/B11/B20）、负·非整数·NaN·MAX_SAFE_INTEGER+2 段均为读失败非形状错误 | 同上 | 无：极性与 `evaluateGuard`/`read.ts` 分支逐条一致（含 B25 空串属有值的正极性反例） | 无 |
| C1–C7（XML 两形态） | 终点投影字符串相等/不满足；穿越两态 | 同上 | 无：C2 message 辅助断言注明次级 | 无 |
| D1–D15（下标段纪律） | 位置读/段型不符读失败/越界吸收/`-0` 归一 | 同上 | 无 | 无 |
| E1–E7（set([]) 先过 guard，M3 增量锚） | 不满足零写入+`n` 不变；满足 ROOT 全等新快照；E3 `has('reviewer')===false` 证清空重装非合并；E4↔E7 次序互斥 | 同上 | 无：E3 是 legacy 管线归属的真实区分锚 | 无 |
| F1–F4/A14（大子树/深结构） | 整树 equals 满足；单元素/单键差异不满足；message < 4096 | 同上 | 无：截断上界静态可证（单侧 256+标记） | 无 |
| G1–G12（批量顶层同语义） | 与单操作配对判决一一相同；不满足恰 1 issue 无聚合；G10 无 schema 消息 | 同上 | 无：配对 ID 入标题（N-E 成对声明） | 无 |
| A13（形状对照） | 无码 + 恰 1 issue + 零写入 | 同上 | 注 1：本文件 `expectShapeError` 未复制 #347 的 `not.toMatch(/未知信封键\s*"guard"/)` 次级断言——#347 该断言属其红灯语境（防能力缺失拒绝伪装），HEAD 能力已在库，A13 锚定的是形状族成员语义；非弱化（见 §12 O1） | 无 |
| 全文件 | — | — | skip/only/todo/env override/`as any`/console 0 命中（实测）；无源码字符串断言；fixture 每例独立、无跨用例共享 | 无 |

Runner 真实触发性：`vitest.config.ts` include 覆盖 + SA6 §14 runner-trigger 探针在案 + CI 分片磁盘枚举（ci.yml L78–80 `test -n "$files"` 防空片假绿）+ 根 typecheck 包含 `test/**/*.ts`。类型面：SA3 记录 `pnpm typecheck` exit 0；静态核对导入（`@nomicore/vfsl` 别名、`../src/index.js` 后缀、`ApplyValidatedMutationResult`/`MutationIssue` 类型导出均在 `index.ts` L25–32）与 #347 同款，无新类型面。

计数核对（防弱化的机械锚）：`it(` = 92；`describe(` = 7；`expectCommitted` 59 调用（= 92−31−1−1）；`expectGuardMismatch` 31 调用；`expectShapeError` 1 调用（A13）；`expectBatchLanded` 9 调用 + 定义 1 = G 组满足态 9 例（G3/G4/G10 为拒绝态）——与 SA6 §12.2–§12.8 表逐组一致。

## 10. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 92/92 与 29 files/539 tests 复现（SA3 单轮记录 + 收尾复跑 8.74s；SA4 未运行） | CI test 分片 / 后续验证轮 | 新文件 92 用例全绿、套件 29 files/539 tests、typecheck exit 0 | 任一用例红或计数漂移（>539 提示用例重排/重复，<539 提示漏收集） |
| 变异敏感度 M1–M4 对落地矩阵文件复跑（SA6 §9.2 用探针等价 92 例实测 13/5/3/3；对最终文件复跑需临时改 DENY 面 `mutation.ts`，SA3 已按 §13.3 正确拒绝越权） | Controller 决定路由（需临时变异授权） | M1 红 13 例（B1/B7/B9/B15/B23/B27/B29/B30/C4/C7/D4/D6/G4）、M2 红 5 例（A1/A1b/A8/A12/G6）、M3 红 3 例（E1/E6/E7）、M4 红 3 例（A5/A6/G8） | 任一模型下矩阵全绿 = 锚定失效（重言式） |
| B22–B30 直造载体对 yjs 升级的稳定性（detached `doc===null`、`Y.Text`/`XmlFragment` 投影行为） | yjs 版本升级时的根套件 | 29 files 全绿 | 升级后 detached/Y.Text/XML 用例红 = 依赖内部行为变化，需回 read.ts 契约分支评估 |
| F3/F4 消息长度与耗时（记录值 594/593 字符、新文件 124ms/整目录 12.19s） | CI 时长趋势 | 分片耗时不显著劣化、message 恒 < 4096 | 耗时异常增长或长度越界（截断逻辑回归） |

## 11. Required revisions

无。未发现 BLOCKER/MAJOR/MINOR 阻断项；无需生产修正（SA6 §12.11.1 修正范围 ∅ 裁定在实现中保持成立：三生产文件 sha1 与 HEAD 一致）；无需设计修订；无需冲突门复查（SA8 冻结面零触碰，requiresConflictRecheck=false 维持）。

## 12. Non-blocking observations

| # | 观察 | 说明 |
|---|---|---|
| O1 | 本文件 `expectShapeError` 较 #347 版少 `not.toMatch(/未知信封键\s*"guard"/)` 次级断言 | #347 该断言服务其红灯语境（防「未知键拒绝」伪装形状错误）；HEAD guard 能力在库后该断言恒真，删去是正确的语境适配而非弱化。A13 主断言（无码+零写入+恰 1 issue）完整 |
| O2 | E4 仅断 `issues[0]` 未断长度 | legacy 全量校验可聚合多 issue，钉死长度反而脆；主断言（code undefined + `类型不匹配` + 零写入）足以锚定次序语义。有意为之，可接受 |
| O3 | `guarded()` 承载值统一 `set n=2`（A13 为形状对照无承载写语义） | 与 SA6 §12.2「op 用 set n=2 承载」一致；guard 路径与写入路径解耦（A2 另断言 t1 不被改动） |
| O4 | 文件头声称「B28 静默投影 `''` 会使 absent 满足转红」 | 静态核实成立：`projectValue` 对 attached XML 返回 `''` 字符串 → `read.value===undefined` 为假 → absent 不满足；B28 的区分锚地位真实 |
| O5 | fixture `Task` 较 #347 增可选 `tags?`（既有字段同形） | 设计 D2「严格超集（仅增不改）」的既知差异，SA2 §10 已如实标注；语义可比性保持 |
