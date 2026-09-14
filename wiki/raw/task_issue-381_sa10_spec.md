# SA10 Spec 审查报告 — issue #381：[ADR 0029] P1 W1 冻结解除与 total 下沉（prefactor）

- 审查人：SA10（spec-review；dispatch `sa-1a34ac5f-9d7a-4f48-8c9f-6deba1f0f80e`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-381`（branch `mabf/issue-381`；HEAD `8a4fa404076afdae9d974c1ad15bd985e24d58ac`
  = PR #380 设计基线，与 dispatch 声明的刷新基点一致；实现为工作树未提交变更：6 修改文件 +88/−374 + 1 新测试文件 414 行）
- 审查方式：静态实读最终 diff（逐 hunk）、成品文件全文、新测试全文；只读 grep 独立重跑结构审计 X1/X2/X3b；
  `git diff --stat` 逐路亲证冻结面；未修改任何实现/测试/设计，未运行测试，未启动服务。
- Owner comment：无（简报 Comments 段空；dispatch 明示刷新 REST issue comments 零评论）⟹ 验收面 = 简报 AC1–AC5 逐字
  + SA6 验收契约（approve）+ ADR 0028 §7/§8/§9、ADR 0029 §5/§8 规范条款。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-381.md`（Host 简报；What to build L17；AC1–AC5 L21–25；Comments 空） | 在场，已读 |
| `wiki/raw/task_issue-381_sa6_contract.md`（SA6 验收契约，verdict approve；§12 T1–T9/M1–M4/R1–R6/X1–X5/G1–G2） | 在场，全文已读 |
| `wiki/raw/task_issue-381_design.md`（SA1 设计 iteration 0；D1–D6、§10 ALLOW/DENY） | 在场，全文已读 |
| `wiki/raw/task_issue-381_sa2_review.md`（approve；0 BLOCKER/0 MAJOR；O-1–O-4 MINOR） | 在场，已读 |
| `wiki/raw/task_issue-381_sa3_impl.md`（实现报告）+ 5 份 `artifacts/sa3-issue381-*.log` | 在场，全文/关键段亲读 |
| `wiki/raw/task_issue-381_sa4_review.md`（approve；0 BLOCKER/MAJOR；3 MINOR） | 在场，全文已读 |
| `wiki/raw/task_issue-381_sa7_report.md`（approve；lease 端到端逐字节活链路证明）+ `artifacts/sa7-issue381-dynamic-verify.log` | 在场，已读 |
| `wiki/raw/task_issue-381_design_conflict_report.md`（SA8 设计复查 clear）/ `task_issue-381_implementation_conflict_report.md`（SA8 实现复查 clear，`requiresConflictRecheck: false`） | 在场，已读 |
| 规范原文：`docs/adr/0029-filtered-window-read.md` §5（L45–53）/§8（L65–70）；`docs/adr/0028-window-read.md` §7（L63–69）/§8（L71–74）/§9（L76–81） | 本轮回查原文 |
| 最终 diff：`window.ts`、`window-read.ts`、`runtime.ts`、pins P7、type-guard.test-d、contract-red 头注、新 `issue-381-window-total-red.test.ts` | 逐 hunk 亲读；window-read.ts 成品 427 行全文亲读；新测试 414 行全文亲读 |

## 2. Issue AC 逐条核验（独立复核，不转述上游结论）

### AC1 — 两面成功恰三键 `{ok,value,total}`；total = 候选标识计数；失败形状不变 ✅ 达成

- **形状**：`window.ts` L100–107 两结果联合成功成员加必填 `total: number`；公共入口 L125/L139 返回字面量
  `{ ok: true, value: …, total: core.total }`（字面序 = ADR 0029 §5 字面序）；`WindowCoreResult`（L147）与
  `windowCore` 成功返回（L217）携 `total: candidates.length`。运行时三键由 T1 断言与 HEAD 红基线
  （`['ok','value']` ≠ `['ok','value','total']`，t-group-head-red.log 亲证）双向锁定。
- **语义**（本轮源码比对）：`total = candidates.length` 与 `value` 出自**同一次** `collectCandidates` 枚举——
  数组面 `enumerateArrayCandidates`（L511–530）对 Y.Array/plain array 按 `length` 逐下标 push（稀疏空洞计入）
  ⟹ `candidates.length === target.length`；键面 `enumerateMapCandidates`（L533–548）Y.Map `keys()` 过
  `get(k) !== undefined`、plain object `Object.keys` 过 `readableOwnDataValue`（descriptor 纪律排
  accessor/non-enumerable/undefined）⟹ 恰为 AC1「非 undefined 键计数」，且与被删 S4 的 `target.length` /
  `countMapEntries` 判据逐位一致（AC3 逐字节不变的论证基础成立）。零额外遍历/物化（ADR 0028 §8）。
- **本票无 where ⟹ total 恒数值**：声明类型收窄为 `number`（非 `number | undefined`）——符合 ADR 0029 §5
  （undefined 半域以 where 在场为前提，属 P2 票；SA6 §15-O1 / SA8 实现复查 §3-2 背书）；组合层无 `?? 0` 兜底
  （window-read.ts `const truncated = kept < total` 直用传入 total，亲证）。
- **失败形状不变**：`WindowReadFailure` 接口与 HEAD 逐字 IDENTICAL（本轮 `git show` diff 比对）；
  `windowFailure` 零改动；T9a–T9e 锁四键 own 键集、三码 + `PATH_NOT_ALLOWED` 透传、失败成员无 `value`/`total`；
  pins P7 失败半两处四键断言零改动（diff 亲证）。

### AC2 — 组合层去计数/去镜像 + 单源消费 + 注释清账 ✅ 达成（本轮独立重跑结构审计）

- X1：`grep "countWindowCandidatesAtPath|countMapEntries|countingDefectFailure" packages/namespace-runtime/src/` = **0 命中**（本轮重跑）。
- X2：`copied from window.ts@ab6e390` / `copied from carrier.ts@ab6e390` 于 window-read.ts = **0 命中**
  （契约上界 ≤1，从严达成；唯一保留件 `safePathCopy` 注文重述为「本地防御件……非镜像纪律存续」）。
- X3b：镜像函数名全量（`navigate`/`navClassify`/`absentNav`/`notAllowedNav`/`classifyArrayTarget`/
  `classifyMapTarget`/`describeCarrierWord`/`carrierOf`/`probeRoot`/`readableOwnDataValue`/`readableArrayElement`/
  `isNonNegInt`/`segMsg`/`yjsWord`/`isPlainRecord`）于 window-read.ts = **0 命中**（本轮重跑）；
  `foldSegment` 按契约例外保留（出处 `read-schema-projection.ts`，非 W1 冻结面）。
- X4：window-read.ts **742 → 427 行**（−315），无「保留但注释掉」；S4 调用点与防御失败构造同步删除。
- 单源消费：`WindowComposeInput` 删 `doc` 增 `total`；`composeArray/MapWindowRead` 追加 `total` 末参；
  编排收缩 S3 → S5 → S6；`runtime.ts` L691/L703 传 `windowResult.total`（全仓唯二消费点）。
- X5 清账：window-read.ts 头注重写（「复制纪律（RA-3/SA2 N-4）」段整体删除、「单源纪律」段新增）、
  runtime.ts JSDoc 删「S4 O(N) 计数」改述 W1 单源、contract-red B-5 头注同步（numstat 4/2 全为注释行，零断言改动）。

### AC3 — registry lease 公共面行为逐字节不变 ✅ 达成

- `NamespaceRuntimeWindowReadOk`（lease 成功恒四键面）与 HEAD 逐字 **IDENTICAL**（本轮精确 diff 比对）；
  `packages/namespace-registry/**`（src + test）与 `packages/namespace-runtime/test/**` `git diff --stat` **全空**（本轮逐路亲证）。
- 既有组合面/lease 测试零语义改动且全绿：composition 17/17 + lease 33/33（focused 日志；SA7 在 HEAD 基线 worktree
  复跑 50/50 绿，证明 refactor 基线不伪称红）。
- SA7 活链路独立证明：真实 persistence（Memory + File 磁盘快照重启往返）+ Registry 生产装配下，108 样本
  HEAD↔实现态逐字节 A/B = **106 一致、仅 2 差异**，且 2 差异恰为 W1 直调三键化（设计变更本体）——lease 公共面
  零溢出差异；released 短路、失败词表、✂ 事实行（`kept 2/total 3`、`kept 2/total 2000`、`- [] · 窗口 · 基 key asc · kept 4/total 9` 等）逐字节一致。

### AC4 — doc-runtime 窗口测试家族两键 → 三键迁移 ✅ 达成

- M1：pins P7 成功半 `['ok','value']` → `['ok','value','total']`（失败半零改动；标题措辞同步）。
- M2：`public-surface-type-guard.test-d.ts` 新增 `it`——两面成功成员 `keyof` = `'ok'|'value'|'total'`、
  `total` 成员 `toEqualTypeOf<number>()`、失败成员恰四键（按目标文件 `expectTypeOf` idiom，SA2 O-2 兑现）。
- M3：contract-red B-5 头注措辞同步（注释级）。
- 增量：新 `issue-381-window-total-red.test.ts`（T1–T9，14 用例）——独立预言机（原生 `length` / `keys()`+descriptor
  直数，零实现复用）对账四载体 + 9 项边界矩阵（含 ROOT 面 9 键）、`min(n,total)` 双向、排序基/预算轴不变性、
  N=2000 毒值零物化哨兵、失败面五用例；预言机先自证防空载体恒等式伪绿；零 skip/only/todo、零 env override、
  零吞错、零源码字符串断言（全文亲证）。红/绿判据成立：HEAD 红 9 failed/5 passed（红因 = total 缺席，
  T9 负控绿）→ 实现后 14/14 绿；敏感度变异 A/B/C（`total:=entries.length` 5 红 / `+1` 9 红 / 组合层 kept 顶替 16 红）
  各击穿对应面且还原复绿（sensitivity-mutations.log 亲读）。

### AC5 — 全仓 `pnpm typecheck` + `pnpm test` 绿 ✅ 达成（证据采信，计数逐位对账）

- `artifacts/sa3-issue381-full-gate.log`：`pnpm typecheck` **exit=0**（14 tsconfig 串行）；
  `pnpm test`（`vitest run --typecheck`）**exit=0**：**393 文件 / 4745 用例全绿、Type Errors: no errors**、626.05s。
- 与 SA6 §4 基线（392/4730）逐位对账：**+1 文件**（新 T 组）、**+15 用例**（T 组 14 + 类型锁 1），无既有用例删改。
- SA7 移除临时探针后聚焦 8 文件族 `--typecheck` 复跑 144/144 绿、Errors 0，与 SA3 focused 日志逐位一致。

## 3. 规范符合性（ADR 0028/0029 条款对照，本轮回查原文）

| 条款 | 实现行为 | 判定 |
|---|---|---|
| ADR 0029 §5：W1 成功结算 `{ok:true, value, total}`，total 键恒在；无 where = 零值域标识计数 | 三键化 + `candidates.length` 同源；`number` 收窄（undefined 半域属 P2） | 符合 |
| ADR 0029 §8：解冻 `window.ts`；S4 计数下沉（枚举/过滤/计数同源）；删 S4 与全部出处标记镜像（点名 5 件等 ~270 行）；收缩纯组合层 S3/S5/S6；测试家族机械迁移 | 逐条兑现（§2 AC1/AC2/AC4）；被点名 5 件全部 0 命中 | 符合 |
| ADR 0028 §7：lease 恒四键、`truncated === kept < total`、✂ 事实、三码响亮不抛 | 四键面 IDENTICAL；S6 ✂ 装配四函数体零改动（仅 JSDoc 补注）；失败词表零变化 | 符合 |
| ADR 0028 §8：只物化入选项、未入选子项零物化 | total 为枚举后 O(1) 读；T8 哨兵 N=2000 + n=2 → total=2000、value.length=2 | 符合 |
| ADR 0028 §9 / ADR 0029 §7：计数/schema 无关标识计数归载体级原语；组合/lease 分层 | 计数权威回归 W1；组合层零计数零导航；registry 零改动 | 符合 |
| ADR 0029 §1 + 备选「结算加第五键 total」否决：total 不进 lease 结算 | total 仅进 W1 原语三键；lease 恒四键不动 | 符合 |

SA8 实现后冲突复查 verdict = **clear**（17 项对照：no-conflict 12 + implements-existing-decision 5；
两项 override 范围未扩大；`requiresConflictRecheck: false`）——本轮抽查其关键亲证（X1/X2/X3b、
IDENTICAL 比对、DENY 零 diff）独立重跑一致。

## 4. Scope 核验（遗漏 / 部分实现 / scope creep）

- **变更路径集** = 设计 §10 ALLOW 八项一一对应，无溢出；DENY 15 路径（`read.ts`、`carrier.ts`、两 `src/index.ts`、
  `public-surface-guard.test.ts`、`read-schema-projection.ts`、registry 全部、两测试树、ADR 0028/0029、CONTEXT.md、
  运行器配置、package.json）本轮逐一 `git diff --stat` 亲证为零。
- **非目标不越界**：未实现 `where`（封闭词表仍响亮拒绝未知键，T9c 为真实拒绝路径负控而非 where 实现）；
  未触 `readLogicalValueAtPath`/readData/预算四键/✂ 文法；未做 count 探针；零新公共值导出（两 index.ts 零 diff）。
- **无遗漏**：简报 What to build（L17）三动作（原语加 total、删自算计数与镜像、收缩纯组合层）与 AC1–AC5 全部落地；
  无部分实现项；SA2 O-1–O-4 全部落实（X3 作用域钉定且诚实注解同名命中、类型锁按 idiom、对抗边界精确化登记、SA8 五项核对闭合）。
- **临时物清场**：`.worktrees/` 空、SA7 探针双份已删、无 stash/marker；`git status --short` 恰为预期变更集
  （6 modified + 1 新测试 + 5+1 artifacts + Host/wiki 输入）。

## 5. PR 必须披露的未达成项 / 行为边界（均非 AC 未达，登记备披露）

1. **E4 对抗类行为修正（无契约覆盖的边界）**：options Proxy/descriptor trap 在 S3 canonical 重读窗内变更 doc 的
   对抗输入类下，lease 的 `truncated`/✂ 由 HEAD「与 value 不同快照」（第二次导航计数）修正为「同源一致」；
   同对抗类内被删的 `countingDefectFailure`（PATH_NOT_ALLOWED 计数防御位）存在失败→成功跃迁。确定性输入域下
   lease 可观察行为逐字节不变（SA7 108 样本实证）；四方（SA6 §12.9/O4、SA2 O-3、SA8 §3-17、设计 R-381-1）一致登记为
   **不判负、不写断言、不引新读路径**。PR 描述应披露该对抗类语义修正。
2. **P2（where）票登记义务**：`total` 声明类型将由 `number` 加宽为 `number | undefined` + W1/S3 两层校验同步扩 +
   `truncated` 双语义 + ✂ 永不装配（ADR 0029 §5/§6）——属后续票，本票未预占，非未达成项。
3. **MINOR 观察（不阻断）**：① window-read.ts 头注「ADR 0028 §13 R2」谱系措辞实指 #369 设计 §13 R2
   （ADR 0028 无 §13；该措辞回声简报 AC2 原文，SA8 §3-18 / SA4 O2 已注记无动作）；② `window-read.ts` 保留
   HEAD 既有的未使用 import（`renderProjectionText`/`resolveSchemaAtPath`，非本票引入，留后续清洁票）；
   ③ composition 测试 describe 标签保留历史「S4」词（设计 R-381-3 明示 M4 零 diff 优先）。

## 6. Verdict

**approve**。

AC1–AC5 全部达成且经本轮独立复核（diff 逐 hunk、结构审计 grep 重跑、冻结面逐路 `git diff --stat`、
IDENTICAL 比对、证据日志计数对账）；实现忠实于 issue 正文、SA6 验收契约与 ADR 0028/0029 规范条款；
无遗漏、无部分实现、无错误实现、无 scope creep。§5 三项为 PR 披露备登记，均不构成 AC 未达（无 BLOCKER 级
partial/unmet/unachievable）。
