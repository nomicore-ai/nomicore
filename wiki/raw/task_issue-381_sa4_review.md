# SA4 实现静态审查 — issue #381：[ADR 0029] P1 W1 冻结解除与 total 下沉（prefactor）

- 被审对象：SA3 交付 diff（6 个修改文件 + 1 个新测试文件 + 5 份 artifacts 日志）及其实现报告
  `wiki/raw/task_issue-381_sa3_impl.md`
- 审查人：SA4（implementation-review；dispatch `sa-011fdde0-6763-4a95-80f9-68b608b8a86d`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-381`（branch `mabf/issue-381`，基线 HEAD `8a4fa40` = 设计输入基线）
- 审查方式：静态实读（diff 逐 hunk、成品文件全文、测试源码、artifacts 日志）+ 只读 grep 结构审计独立重跑；
  未修改任何实现/设计/测试，未运行测试（测试证据以 SA3 artifacts 交叉核对采信）。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-381.md`（Host 简报；AC1–AC5；Comments 空） | 在场，已读 |
| `wiki/raw/task_issue-381_design.md`（SA1 设计 iteration 0，348 行） | 在场，全文已读 |
| `wiki/raw/task_issue-381_sa6_contract.md`（verdict approve；§12 契约） | 在场，全文已读 |
| `wiki/raw/task_issue-381_sa2_review.md`（verdict approve；O-1–O-4） | 在场，全文已读 |
| `wiki/raw/task_issue-381_sa3_impl.md`（实现报告） | 在场，全文已读 |
| `wiki/raw/task_issue-381_design_conflict_report.md`（前届 SA8，clear） | 在场，已读（经 SA3/实现复查报告转引核对） |
| `wiki/raw/task_issue-381_implementation_conflict_report.md`（SA8 实现后复查，clear，`requiresConflictRecheck: false`） | 在场，全文已读 |
| `wiki/raw/task_issue-381_relevant_decisions.md` / `_conflict_report.md` | 不存在（SA6 §1 / SA8 §2 / SA3 Inputs 三方同款结论；SA8 已按 ADR 全集直接对照） |
| 规范文本：`docs/adr/0029-filtered-window-read.md` §5/§8、`docs/adr/0028-window-read.md` §7/§8/§9 | 经设计/契约/SA8 报告的条款引用核对（本轮 SA4 以实现行为对照条款语义） |
| 源码 diff：`window.ts`、`window-read.ts`、`runtime.ts` | 逐 hunk 亲读；`window-read.ts` 成品 427 行全文亲读 |
| 测试 diff：pins P7、type-guard.test-d、contract-red 头注、新 `issue-381-window-total-red.test.ts`（414 行全文） | 亲读 |
| artifacts：`sa3-issue381-{structural-audit,t-group-head-red,focused-window-family,sensitivity-mutations,full-gate}.log` | 全文/关键段亲读，exit code 与用例计数逐一对上 |
| Owner comment | 无（简报 Comments 空 + dispatch 明示 REST 读回零评论） |
| 模块 AGENTS：`packages/doc-runtime/AGENTS.md`、`packages/namespace-runtime/AGENTS.md` | 已读（边界核对：公共 API 只经 src/index.ts；读在 sequencer 外） |

## 2. Verdict

**approve**。

- 无 BLOCKER、无 MAJOR。三条 MINOR 观察不阻断（见 §12）。
- 独立核验结论：实现与设计 §5 D1–D6 及 SA6 契约逐条一致——W1 两面成功结算恰三键且 `total = candidates.length`
  与 `value` 同一次枚举同源；组合层 S4 计数与 W1 出处标记镜像（15 名目 + 2 类型别名）经本轮 grep 独立重跑
  确认全量消失（X1 = 0、X2 = 0、X3b = 0）；`NamespaceRuntimeWindowReadOk`（lease 恒四键面）与 HEAD 逐字
  IDENTICAL；registry/两测试树零 diff；变更路径集与 ALLOW 八项一一对应无溢出；DENY 15 路径逐一零 diff。
- SA3 声明的验证证据（聚焦 8 文件 144 用例、T 组 HEAD 红 9/5、变异 A/B/C 击穿面、全仓 typecheck/test
  exit 0 393 文件/4745 用例）与 artifacts 日志逐位对上，无伪报迹象。

---

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| 简报 AC1：两面成功恰三键 `{ok,value,total}`；total = 候选标识计数（数组 = length；键面 = 非 undefined 键数）；失败形状不变 | `window.ts` L100–107 两联合成功成员加必填 `total: number`；L125/L138 入口字面量 `{ok, value, total}`（字面序 = 设计 D1.3）；L217 `total: candidates.length`；`windowFailure`（L226–228）与全部失败路径零改动；T1–T8 绿（focused 日志） | 落实。`total` 数值性由类型（`number`，非 `number \| undefined`）+ T2 + 类型锁 `toEqualTypeOf<number>()` 双面锁死（SA6 O1 前提：无 where 恒数值） |
| 简报 AC1/AC2：组合层删除自算计数与全部出处标记镜像复制件，收缩为纯组合层 | `window-read.ts` 742 → 427 行；S4 调用点与三函数（`countWindowCandidatesAtPath`/`countMapEntries`/`countingDefectFailure`）删除；镜像块 15 名目 + 2 类型别名删除；本轮独立重跑 X1 = 0 命中、X2 = 0 命中、X3b = 0 命中 | 落实。保留件恰为设计冻结清单（`safePathCopy` 注文重述否认镜像存续、`foldSegment` 合法出处标记、S3/S5/S6 全部、两失败构造） |
| 简报 AC2：W1 冻结注释与「copied from」镜像纪律备注同步清理 | `window-read.ts` 头注重写（删 S4 条目/复制纪律段，新增「单源纪律」段）；`runtime.ts` JSDoc 删「S4 O(N) 计数」改述 W1 单源；contract-red B-5 头注同步（X5） | 落实。`copied from window.ts@ab6e390` / `carrier.ts@ab6e390` 均归零（≤1 上界从严达成）；唯余 `foldSegment` 的 `read-schema-projection.ts` 合法出处 |
| 简报 AC3：lease 公共面逐字节不变；既有组合面测试零语义改动 | `NamespaceRuntimeWindowReadOk`（L62–70）与 HEAD `diff` 逐字 IDENTICAL（本轮比对）；`packages/namespace-registry/**` 与 `packages/namespace-runtime/test/**` `git diff --stat` 空；lease 33/33 + composition 17/17 零改动全绿（focused 日志） | 落实。S6 ✂ 装配函数体零改动（仅 JSDoc 补注）；`truncated = kept < total` 直用传入 total，无 `?? 0` 兜底 |
| 简报 AC4：doc-runtime 窗口测试家族两键 → 三键迁移 | pins P7 成功半 `['ok','value','total']`（失败半两处四键断言零改动，diff 亲证）；type-guard.test-d 新增 `it` 三键锁 + `total: number` 锁 + 失败四键锁（`expectTypeOf` idiom，SA2 O-2 兑现）；contract-red 仅头注（numstat 4/2 全为注释行） | 落实。红/绿判据成立：T 组 HEAD 红 9 failed/5 passed（红因 = `['ok','value']` ≠ `['ok','value','total']`，t-group-head-red.log 亲证） |
| 简报 AC5：全仓 `pnpm typecheck` + `pnpm test` 绿 | full-gate.log：typecheck exit 0（14 tsconfig 串行）；test exit 0，393 文件/4745 用例、Type Errors: no errors | 落实（SA4 未复跑；日志计数与 SA6 基线 +1 文件/+15 用例逐位对账成立：新 T 组 14 + 类型锁 1） |
| SA6 §12.8 反伪绿防线 | sensitivity-mutations.log：变异 A（`total := entries.length`）5 红；变异 B（+1）9 红；变异 C（组合层 kept 顶替）16/50 红（与 SA6 §9-E2 逐位一致）；均还原复绿 | 落实。独立预言机纪律真实：`arrayOracle`/`mapOracle` 用原生 `length`/`keys()`+descriptor 直数，零实现复用 |
| SA2 O-1（X3 作用域钉定） | structural-audit.log 记 X3a（SA2 钉定域全量原始输出）+ X3b（镜像承载文件）；X3a 的 10 行命中全部在 `projection.ts`/`plain-data.ts`（Phase 3 #85 既有同名独立实现，本变更集零 diff） | 落实且诚实：未伪报 X3a = 0，未越界修改无关文件 |
| SA2 O-2（M2 按 idiom 落锁） | type-guard.test-d 新增 `it` 用 `expectTypeOf<…>().toEqualTypeOf<…>()`（文件既有 idiom），未引入 helper | 落实 |
| SA2 O-3（对抗边界精确化） | SA3 报告 §「对抗性 S4 移除边界」按建议登记（含 `countingDefectFailure` 失败→成功跃迁）；零 E4 断言、零新读路径 | 落实 |
| SA8 实现后复查（clear）required actions | action 1 五项核对闭合；action 2（P2 where 义务）维持登记；action 3 谱系注记仅记录；action 4（未使用 import）路由到本轮 SA4（见 §12-O1） | 落实 |
| Owner comment | 无（dispatch 明示 REST 读回零评论） | 无遗漏 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1.1 结果联合三键化（`total: number` 声明类型） | `window.ts` L100–107 | 一致：类型选择 `number`（非 `number \| undefined`），成功成员必填；注释引 ADR 0029 §5 | 无 |
| D1.2 `WindowCoreResult` + `windowCore` 成功返回 | `window.ts` L147、L217 | 一致：`total: candidates.length` 由既有枚举变量携带，O(1) 读，零额外遍历/物化 | 无 |
| D1.3 公共入口包装与字面序 | `window.ts` L125、L138 | 一致：`{ ok, value, total }` 字面序；T1 锁 `['ok','value','total']` | 无 |
| D1.4 注释同步（头注三键 + read.ts 复制纪律段保持） | `window.ts` L24–26（A 装配段）、L29–31（复制纪律段原样） | 一致：`read.ts` 零 diff 红线维持（H7）；10 处 `copied from read.ts@36a73bb` 标记逐字保留 | 无 |
| D2 total 语义逐位等价 | `window.ts` L512–530（`enumerateArrayCandidates`：Y.Array/plain array 按 `length` 逐下标 push，稀疏空洞计入）+ L533–548（`enumerateMapCandidates`：Y.Map `keys()` 过 `get(k)!==undefined`；plain object `Object.keys` 过 `readableOwnDataValue`＝descriptor 纪律排 accessor/non-enumerable/undefined） | 一致：与被删 S4 的 `target.length` / `countMapEntries` 判据逐位相同（本轮与 HEAD diff 双侧比对）；`candidates.length` 在就地排序后不变 ⟹ `value.length ≤ total` 结构恒成立 | 无 |
| D3 组合层收缩（删 S4 + 删镜像、保留集、签名） | `window-read.ts` L92–104（`WindowComposeInput` 删 `doc` 增 `total`）、L109–148（compose* 追加 `total` 末参，`redispatch` 闭包捕获参数 `doc`）、L150–182（编排 S3→S5→S6，`const truncated = kept < total` 直用）、L416–427（`safePathCopy` 唯一保留件） | 一致：删除集与保留集与设计 §5-D3 清单完全吻合；`redispatch` 声明类型维持两字段结构超类型（成功字段零消费，L159–161 仅失败透传 + 出口②）＝ R-381-5 冻结兑现 | 无 |
| D3 备选否决（A1 保留 S4 / A2 抽共享 / A3 count 原语 / A4 传整个成员） | 实现取双参方案 | 一致：无共享模块抽取、无新公共导出、组合层零计数 | 无 |
| D4 runtime 消费点 | `runtime.ts` L691、L703（`windowResult.total` 末参追加）；S1 lifecycle gate 与 S2 失败透传（L689/L701）零改动 | 一致 | 无 |
| D5 注释/文档清账 | `window-read.ts` 头注、`runtime.ts` JSDoc L675–681、contract-red B-5；ADR 0028/0029 与 CONTEXT.md 零改动 | 一致（X5）；注意头注 L26「ADR 0028 §13 R2」谱系措辞系简报原文回声（实指 #369 设计 §13 R2，SA8 §3-18 已注记无动作）→ §12-O2 | 无（MINOR 观察见 §12） |
| D6 测试迁移与增量（M1–M4/P3/P5） | pins P7、type-guard.test-d、contract-red 头注、新 T 组文件、5 份 artifacts | 一致：M4 零 diff 达成；P3 落 T1–T9 全量（见 §9） | 无 |
| 非目标不越界（无 where、无 read.ts 触碰、无 readData/✂ 文法变化、无 count 探针、无新公共值导出） | `src/index.ts` 两文件零 diff；`public-surface-guard` 6/6 绿（focused 日志）；T9c `where:'x'` 用例是 P1 闭合词表未知键拒绝负控（`validateWindowOptions` L277–279 真实拒绝路径），非 where 实现 | 一致 | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 候选标识计数（枚举/过滤/计数同源） | doc-runtime 载体级原语（ADR 0028 §9 / ADR 0029 §8） | `windowCore` 枚举产物 `candidates.length` 随结算携带 | 正确——计数权威回归规范层，组合层零计数 |
| 组合选窗 + 投影文本 + ✂ 装配 | namespace-runtime | `window-read.ts` S3/S5/S6，`total` 直通 | 正确——纯组合层 |
| lease 公共面与类型别名 | namespace-registry | 零改动透传 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 组合层消费原语结算的截断事实 | `readData` 组合直通消费 doc-runtime 原语的 `truncated`（runtime.ts 同款直通先例） | `compose*(…, entries, total)` 直通 W1 结算 | 一致 | 同一「原语单源 → 组合层零重算」协议，无平行机制 |
| S3 canonical 接缝 / ✂ 文法 / 独立预言机断言纪律 | `canonicalReadOptions` 两出口先例、渲染器拼装规则、`readdata-ok-shape` 反伪绿头注 | S3/S5/S6 函数体零改动；T 组预言机沿仓内纪律 | 一致 | 复用既有协议 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 窗口候选计数 | W1 `candidates.length`（唯一权威） | 组合层 `input.total` 直通（零推导、零兜底） | 无——HEAD 的双份计数空间（S4 第二次导航）被结构性移除，E4 漂移接缝消除 |

### 生命周期对称性

纯同步读路径：无 register/dispose、无订阅、无后台任务、零可变态、读在写 sequencer 外（两包 AGENTS 边界保持）。不适用且合规。

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| S4 计数（第二计数空间） | W1 枚举 | 已删除（X1 = 0 独立重跑） | 正确关闭 |
| W1 出处标记镜像块（267 行第二导航实现） | doc-runtime window.ts/carrier.ts 规范归属 | 已删除（X3b = 0；X2 = 0） | 正确关闭；`safePathCopy` 保留理由成立（接缝终态仍需 path 安全副本 + 新公共值导出被 P-W2/NC6 禁止） |
| 专用 count 原语 / n=0 探针 | 无（ADR 0029 §5 备案演进位） | 未引入 | 正确 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/doc-runtime/src/window.ts`（+20/−11） | §10 ALLOW 行 1 | D1/D2 三键化 + 单源 total | 在范围；失败面与 read.ts 复制纪律段零触碰 |
| `packages/namespace-runtime/src/window-read.ts`（+40/−355） | §10 ALLOW 行 2 | D3 组合层收缩 | 在范围；742 → 427 行单调下降，无「保留但注释掉」 |
| `packages/namespace-runtime/src/runtime.ts`（+6/−4） | §10 ALLOW 行 3 | D4/D5 消费点 + JSDoc | 在范围 |
| `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts`（+2/−2） | §10 ALLOW 行 4 | M1 P7 迁移 | 在范围；仅成功半一行断言 + 标题 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts`（+16/−0） | §10 ALLOW 行 5 | M2 类型锁 | 在范围；单一新增 `it` |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts`（+4/−2） | §10 ALLOW 行 6（仅头注） | M3 B-5 措辞 | 在范围；numstat 与 diff 亲证全部为注释行，零断言改动 |
| `packages/doc-runtime/test/issue-381-window-total-red.test.ts`（新，414 行） | §10 ALLOW 行 7 | P3 T1–T9 增量 | 在范围；自含 fixture + 独立预言机，零新基础设施 |
| `artifacts/sa3-issue381-*.log`（5 份，未跟踪） | §10 ALLOW 行 8（模式） | P5 证据留档 | 在范围 |

DENY 核对（本轮逐一 `git diff --stat` 亲证为空）：`read.ts`、`carrier.ts`、`doc-runtime/src/index.ts`、
`public-surface-guard.test.ts`、`namespace-runtime/src/index.ts`、`read-schema-projection.ts`、
`namespace-runtime/test/**`、`namespace-registry/**`（src + test）、`docs/adr/0028`、`docs/adr/0029`、
`CONTEXT.md`、`vitest.config.ts`、`tsconfig.*`、`package.json`。临时物清场：`.worktrees/` 目录存在但为空
（SA3 的 `sa3-red-head` HEAD 红 worktree 已移除），且被 `.gitignore` 覆盖；工作树无 stash/无 marker。
无越界。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `ReadArrayWindowResult`/`ReadMapWindowResult` 成功成员 +`total` | 全仓消费者清点（本轮 grep 亲证）：src 面 = `runtime.ts`（唯一直接值消费者，已迁移）+ `window-read.ts`（类型复用）+ 两 `src/index.ts`（type-only 转出，零 diff）；测试面 = 4 个 doc-runtime 文件 + composition/lease（零 diff 树）；apps/domains 零命中 | 类型加法成员；成功面新增键不破坏任何既有 `.value`/失败面消费；`redispatch` 声明类型为结构超类型，三键成功成员可赋值且成功字段零消费 | 无 | 无 |
| `composeArrayWindowRead`/`composeMapWindowRead` 追加 `total` 末参 | 仅 `runtime.ts` 两处调用（grep 亲证，无测试导入） | 两调用点同步迁移 | 无 | 无 |
| `countWindowCandidatesAtPath` 删除（含 export） | 包外零消费者（index 不转出、runtime 不导入、全仓测试零引用——本轮 grep 复核） | 无需迁移 | 无 | 无 |
| lease `readArray`/`readMap` 透传联合 | `lease.ts`/`types.ts` 零 diff | 成功面恒四键（`NamespaceRuntimeWindowReadOk` 与 HEAD IDENTICAL）；W1 三键只存在于 runtime 内部通道 | 无 | 无 |
| S6 ✂ 事实行 byte 级 | R3 断言零 diff 全绿（lease T 组/composition/E3） | `windowFactsBlock`/`appendWindowFacts`/`windowPathText` 函数体零改动 | 无 | 无 |
| wire / schema / 持久化 / readData / 姊妹 `readLogicalValueAtPath` | 变更路径集不含任何相关文件（read.ts 零 diff 亲证） | 零接触 | 无 | 无 |

## 8. 错误、恢复与并发

- **失败语义零变化**：三码 + `PATH_NOT_ALLOWED`、own 键集恰四键、无 `value`/`total`（T9a–T9e 五用例 + pins P7 失败半零改动）；`windowFailure` 两处（window.ts/window-read.ts）零改动。
- **删除的防御位**：`countingDefectFailure`（HEAD 的 S4 计数防御 `PATH_NOT_ALLOWED`）触发条件「W1 成功后第二次导航失败」在单源下结构性不存在。确定性输入域下不可达（全同步、两次导航间仅 options descriptor 读可运行用户代码）；对抗输入域下的失败→成功跃迁已按 SA2 O-3 在 SA3 报告精确登记为非阻断边界（与 SA6 §12.9/O4、SA8 §3-17、设计 R-381-1 四方一致）——不判负、不写断言、不引新读路径，实现严格遵守。
- **无吞错/无伪装成功**：`expectOk` helper 在测试侧响亮抛；实现侧失败成员原样透传（runtime S2、S3 出口①）。
- **重试/幂等**：无新重试路径；S3 出口①重派发语义不变（重派发产物含 `total` 但成功字段零消费）。纯同步零可变态 ⟹ 天然幂等。
- **回滚**：单变更集、无迁移/持久化/wire；`git revert` 即恢复。
- **静态无法确认项**：见 §11（lease 端到端活链路、长时运行下的内存/性能面——本变更方向为净删除，风险趋降）。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-381-window-total-red.test.ts` T1/T2 | 成功 own 键集恰 `['ok','value','total']`（字面序）；`typeof number` + 整数 + ≥0 | `packages/*/test/**/*.test.ts` 自动采集（full-gate 393 文件含本文件；focused 14/14） | 无——多/少一键即红（HEAD 红 9/5 实证） | 无 |
| T3 独立预言机 | 四载体 + 边界载体 total ≡ 原生 `length` / `keys()`+descriptor 直数（稀疏空洞、undefined 值键、accessor、non-enumerable 全覆盖） | 同上 | 无——预言机零实现复用；与 `enumerateArrayCandidates`/`enumerateMapCandidates`/`readableOwnDataValue` 判据逐位对得上（本轮源码比对） | 无 |
| T5 边界矩阵 | 9 项矩阵（空载体 ×3、undefined 值键 ×2、accessor/non-enumerable、稀疏、ROOT 面 9 键）；预言机先自证防空载体恒等式伪绿 | 同上 | 无——`expected` 用常量与预言机双轨 | 无 |
| T4 | `value.length === min(n, total)` 双向 + 空载体 | 同上 | 无 | 无 |
| T6/T7 | 排序基（index/key/field × asc/desc）与预算轴（depth/maxChildrenPerNode 在场/缺席）下 total 恒定 | 同上 | 无 | 无 |
| T8 | N=2000 毒值 + n=2 → `total=2000`、`value.length=2`（零物化哨兵） | 同上 | 无——变异 A 实证击穿（expected 2 to be 2000） | 无 |
| T9a–T9e | 失败面四键 + 三码 + 透传 + 无 value/total；T9c `where:'x'` 为 P1 闭合词表未知键拒绝负控（`validateWindowOptions` L277–279 真实路径，非 where 实现） | 同上 | 无——HEAD 即绿（负控不伪称红，与 SA6 §12.10 一致） | 无 |
| pins P7（迁移） | 成功恰三键（字面序）；失败恰四键零改动 | 既有文件 | 无 | 无 |
| type-guard.test-d 新 `it` | `keyof` 成功成员 = `'ok'\|'value'\|'total'`、`total: number`、失败成员恰四键 | `--typecheck` 采集（focused `✓ TS` 14 用例） | 无——按文件 `expectTypeOf` idiom（SA2 O-2） | 无 |
| contract-red B-5（注释级） | 无断言改动 | 既有 47 用例 | 无 | 无 |
| 断言纪律全局 | 零 skip/only/todo、零 env override、零 fallback、零吞错、零源码字符串断言（本轮全文亲证） | — | 无 | 无 |
| 敏感度（SA6 §12.8） | 变异 A/B/C 各击穿对应用例组（sensitivity-mutations.log：A=5 红、B=9 红、C=16/50 红，还原复绿 14/14 + 50/50） | 一次性实验（已还原） | 无 | 无 |

SA6 红灯断言保持：T 组在 HEAD 红（9 failed/5 passed，红因 = total 缺席）→ 实现后绿（14/14）；
R 组（lease/composition）实现前后均绿且文件零 diff。测试真实被 package 命令与 CI 入口发现
（root `pnpm test` include 覆盖新文件，full-gate 计数 +1 文件/+15 用例与基线逐位对账）。

## 10. Required revisions

无 BLOCKER / MAJOR finding。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| lease 面端到端逐字节不变（registry 装配 + 真实 persistence 全链路） | SA7 活链路验证（SA3 deferred 项 1；SA4 静态无法替代） | 与 HEAD 同输入下 lease `readArray`/`readMap` 四键结果（含 ✂ 事实行）逐字节一致 | 任何键集/事实行/值序差异 |
| E4 对抗场景（S3 重读窗内 trap 变更 doc）行为 | 已登记非阻断边界（SA6 §12.9/O4）；如未来 Owner 要求立约需新契约票 | `total` 与 `value` 同快照（`total=3, truncated:false`） | 不适用（本轮不判负、不写断言） |
| P2（where）票类型加宽落地时组合层是否引入 `?? 0` 兜底 | P2 票设计期（ADR 0029 §5；SA8 实现复查 action 2） | `total: number \| undefined` 纯类型加宽，S6 双语义显式处理 | 兜底掩盖缺席即违 O1 前提 |
| 未使用 import 清洁度（`renderProjectionText`/`resolveSchemaAtPath`） | 后续清洁票（见 §12-O1） | 删除后全仓门复绿 | 无（非本票缺陷） |

## 12. Non-blocking observations

| ID | Observation | 建议（不阻断） |
|---|---|---|
| O1 | **`window-read.ts` L40 保留未使用 import**（`renderProjectionText, resolveSchemaAtPath`）：HEAD 即未使用（`git show HEAD` L41 亲证），非本票引入；SA3 已如实披露（报告 Deviations #2），SA8 §7-2 路由至本轮 SA4。本票删除属无关面 churn（DENY「不扩大范围」纪律优先）。 | 后续清洁票统一移除（连同 X3a 同名命中文件的口径注记一并复核）；不影响本票验收。 |
| O2 | **头注谱系措辞**：`window-read.ts` L26「ADR 0028 §13 R2 执行」实指 #369 设计 §13 R2（ADR 0028 无该节）；该措辞回声自简报 AC2 原文，SA8 §3-18 已登记为谱系注记、无动作。 | 无需本票动作；后续触碰该头注时顺手修正为「#369 设计 §13 R2」。 |
| O3 | **composition 测试 describe 标签仍含历史「S4」词**（如「S4 total 计数…」）：设计 R-381-3 明示 M4 零 diff 优先级高于措辞洁癖，标签为历史锚、断言全部 oracle 化。 | 无需动作；与设计裁决一致。 |

---

## 收尾结论

实现是设计 D1–D6 与 SA6 验收契约的忠实兑现：W1 三键结算单源化（total 与 value 同一次枚举）、组合层收缩为
纯组合层（S3/S5/S6）、测试家族机械迁移 + 独立预言机增量、lease 恒四键与 ✂ 文法逐字节不变、冻结面
（read.ts / 姊妹面 / 值导出面 / registry）全部零 diff。结构审计 X1–X5 经本轮独立重跑一致；证据链
（HEAD 红 → 绿 → 变异敏感度 → 全仓门）完整且与 artifacts 对得上。无 BLOCKER/MAJOR；三条 MINOR 观察留档。
verdict = **approve**。
