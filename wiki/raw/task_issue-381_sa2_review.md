# SA2 设计攻击评审 — issue #381：[ADR 0029] P1 W1 冻结解除与 total 下沉（prefactor）

- 被审对象：`wiki/raw/task_issue-381_design.md`（SA1 design，iteration 0，348 行）
- 评审人：SA2（attack-design；dispatch sa-011fe016-9532-4db9-a35a-3e68e8e10ed5）
- Worktree：`/home/wangjian/nomicore-fix-issue-381`（branch `mabf/issue-381`，HEAD `8a4fa40` = 设计输入基线）
- 评审时间：2026-09-14（设计后；SA8 设计冲突报告已产出并纳入输入）

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-381.md`（任务简报；AC1–AC5；Comments 空） | 在场，已读 |
| `wiki/raw/task_issue-381_design.md`（被审设计） | 在场，全文已读 |
| `wiki/raw/task_issue-381_sa6_contract.md`（SA6 验收契约，verdict approve） | 在场，全文已读 |
| `wiki/raw/task_issue-381_design_conflict_report.md`（SA8 设计后冲突报告，verdict clear） | 在场，全文已读（设计成稿后产出——见 §5 注记 O-4） |
| `wiki/raw/task_issue-381_relevant_decisions.md` / `_conflict_report.md` | 不存在（SA8 报告 §2 同款结论；SA8 已按决策全集直接对照） |
| 规范文本（本轮亲读）：`docs/adr/0029-filtered-window-read.md`（§1/§5/§6/§7/§8/备选/验收；状态：已接受 2026-09-16）、`docs/adr/0028-window-read.md`（§7/§8/§9）、`CONTEXT.md` L61–67（「窗口读」「过滤窗口」词条） | 已核对 |
| 源码（本轮亲读）：`packages/doc-runtime/src/window.ts`（749 行全文）、`packages/namespace-runtime/src/window-read.ts`（742 行全文）、`runtime.ts` L651–714、`read-schema-projection.ts`（引用点）、`packages/namespace-runtime/src/index.ts`、`packages/doc-runtime/src/index.ts`、`packages/namespace-registry/src/lease.ts` L298–322、`types.ts` L460–484 | 已核对 |
| 测试（本轮亲读/grep）：pins P7（L325–338）、contract-red B-5 头注/helper/NC1–NC4（L25–95、L790–822）、`public-surface-type-guard.test-d.ts`（头注/imports/声明）、`public-surface-guard.test.ts` P-W1/P-W2（L66–75）、composition S3/S4/S5/E4（L156–330、L405–425）、lease E4/F1/F2/F6（L690–826）、`issue-369-window-read-lease-surface.test-d.ts`（L37–55）、形状集中化门（L55–62、L168–198）、fixture `issue-369-window-read-fixture.ts`（ROOT 9 键清点） | 已核对 |
| 全仓消费者 grep（亲证）：`countWindowCandidatesAtPath`、`composeArrayWindowRead`/`composeMapWindowRead`、`readArrayWindowAtPath`/`readMapWindowAtPath`、`ReadArrayWindowResult`/`ReadMapWindowResult` | 已核对 |
| 模块契约（本轮亲读）：`packages/doc-runtime/AGENTS.md`、`packages/namespace-runtime/AGENTS.md`、`packages/namespace-registry/AGENTS.md` | 已核对 |
| 历史证据：`wiki/raw/task_issue-369_design.md` §13 R2（L394–400） | 已核对 |
| Owner comment | 无（简报 Comments 段空 + dispatch 明示 REST 读回零评论） |

本轮评审方式：SA2 不运行测试、不启动服务；以源码/ADR/测试锚点的静态实读 + grep 亲证核验设计的每一条事实断言。

## 2. Verdict

**approve**。

- 无 BLOCKER、无 MAJOR。四条 MINOR 观察不阻断安全实施（见 §14）。
- 独立核验结论：设计对 HEAD 事实的全部关键断言（行号锚点、镜像块边界、删除集依赖闭合、消费者清点、唯一两键锁、守卫/门的扫描域、fixture ROOT=9、`copied from` 标记 11 处）经本轮源码实读**逐条成立**；D2 的「S4 ≡ W1 候选计数」逐位等价证明经两侧源码比对成立；ALLOW/DENY 与正文一致；验收映射可执行且落在真实测试入口。
- 设计与 SA8 冲突报告（clear）零冲突：报告的两项 override（W1 两键冻结解除、#369 R2 镜像清账）恰为设计的 D1/D3，权威（ADR 0029 §5/§8）已核；报告的 required actions 无一项要求设计修订。
- `pass` 仅指设计足以安全实施；实现与活链路验证仍归 SA4/SA7 及 SA8 实现期复查（设计 §14 / 报告 §10 均已标记 `requiresConflictRecheck: true`）。

---

## 3. 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| 简报 L17：W1 两公共入口成功结算新增 `total` 键（无 where 恒为候选标识计数） | §1 目标 1、§5 D1/D2 | 覆盖。`total := candidates.length` 与 `value` 同一次 `collectCandidates` 枚举（window.ts L189–196/L208 亲证）；`number` 收窄有 ADR 0029 §5 undefined 半域以 where 在场为前提的论证 + SA6 O1 + SA8 §3-2 双重背书 |
| 简报 L17：组合层删除自算计数与全部出处标记镜像复制件，收缩为纯组合层（S3/S5/S6） | §1 目标 2、§5 D3 | 覆盖。删除集（S4 三函数 + 镜像块除 `safePathCopy`）经依赖闭合检查成立（见 §6）；保留件清单显式冻结 |
| 简报 L17：行为除加键外零变化；lease 公共面逐字节不变（= AC1 后半 / AC3） | §5 D2 等价论证、§8 R1–R6、D6-M4 | 覆盖。确定性等价论证成立（全同步无 yield；两侧计数语义逐位一致，本轮比对 `enumerateArrayCandidates`/`enumerateMapCandidates` vs `countWindowCandidatesAtPath`/`countMapEntries` 源码确认）；E4 对抗场景差异如实登记为非阻断边界 |
| AC1：两面成功恰三键；total 语义；失败形状不变 | §5 D1/D2、§8 T1–T9 | 覆盖。失败面 `windowFailure`（window.ts L217–219）own 键集恰四键亲证；D1 明示失败面零改动 |
| AC2：组合层去计数/去镜像 + W1 冻结注释与「copied from」备注清账（ADR 0028 §13 R2 执行） | §5 D3/D5、§8 X1–X5 | 覆盖。X1–X5 结构审计承接 SA6 §12.6；「ADR 0028 §13 R2」引用谱系问题 SA8 §3-18 已注记（实指 #369 设计 §13 R2，本票无需动作） |
| AC3：lease 公共面逐字节不变；既有组合面测试零语义改动 | §5 D6-M4、§8 R1–R6、§9 | 覆盖。零 diff 可行性经本轮逐条核验：全对象 `toStrictEqual` 仅在失败成员（composition L423、lease L706/L739/L746 均为失败面上下文亲证）；`.value` 比较与 lease≡runtime 双侧同变；compose* 无任何测试导入（grep 亲证） |
| AC4：doc-runtime 窗口测试家族两键 → 三键迁移 | §5 D6-M1/M2/M3 | 覆盖。P7 确为唯一结算两键锁（本轮 grep 复核：contract-red L471/479/526 是条目形状断言、L798/L817 是姊妹负控，均不在迁移面；SA6 E3 变异实证同款结论） |
| AC5：全仓 `pnpm typecheck` + `pnpm test` 绿 | §8 G1/G2 | 覆盖。SA6 §4/§14 基线 + 运行器触发证据承接 |
| 非目标不扩大 | §1 非目标 | 覆盖。where/read.ts/readData/预算四键/✂ 文法/count 探针/新公共值导出逐项钉死，与 SA6 §12.9 逐字一致 |

## 4. Owner评论覆盖

无 owner comment（简报「## Comments」段为空；本 dispatch 明示 REST comment 读回无评论）。验收面 = 简报 AC1–AC5 + ADR 0029 §5/§8 规范约束，无额外 owner 口径可映射。与 SA6 §2、SA8 报告 §2 结论一致——**无遗漏评论**。

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 §5 探针：HEAD 两面成功 own 键集 `["ok","value"]`、`total === undefined`；失败面/fixture/零物化负控 PASS | §5.1 承接 + D1 红因对应 | 成立。window.ts L97–100/L116/L130 亲证两键字面量 |
| SA6 §5/E5 类型红：`Equal<keyof Extract<…,{ok:true}>, 'ok'\|'value'\|'total'>` = false | D6-M2 类型锁（HEAD 红） | 成立。`public-surface-type-guard.test-d.ts` 已 import 两联合并声明两结果常量（L28–50/L89–90 亲证），落点真实 |
| SA6 §9-E2 变异 A（total := kept）16/50 红 → total 在 lease 面承重 | D2 逐位等价证明 + 禁兜底（O1 前提） | 成立。E2 红面（✂ 事实行 / truncated / 恒四键）与 R2/R3 回归面吻合 |
| SA6 §9-E3 变异 B：仅 P7 红 ⟹ HEAD 族不校验 total 值 | D6-P3 独立预言机增量（T2–T5/T8） | 成立。反伪绿防线必要且已设计 |
| SA6 §9-E4 漂移探针：对抗性 trap 下 HEAD `kept 3/total 4` vs value 3 项 | R-381-1 非阻断边界登记（不判负、不写断言、不引新读路径） | 成立。与 SA6 §12.9/O4、SA8 §3-17 三方一致；见观察 O-3 的措辞精确化建议 |
| SA6 H7 / ADR 0029 §8：`read.ts` 零 diff 红线维持 | D1.4 + DENY LIST 首行 | 成立。window.ts L27–29 复制纪律段亲证在册且设计明示不动 |
| #369 设计 §13 R2：计数镜像 follow-up + 缓解前提（独立预言机矩阵不得删） | D6-M4 零 diff（矩阵原样保留） | 成立。#369 设计 L396–400 亲证；composition S4 oracle 矩阵（L252–325，native/Yjs 直数）在零 diff 树内 |
| SA8 冲突报告（clear）：18 项对照 = no-conflict 13 + implements-existing-decision 5；两项 override（权威 ADR 0029 §5/§8）；evolution-required 0 | 设计 D1/D3 即 override 兑现；§14 自标冲突复查 | 成立。报告 required action 1（实现期复查五项核对）不要求设计改动；action 2（P2 义务）已在设计 §12 登记；action 3（谱系注记）无动作 |
| SA8 报告 §5 冻结面九项（lease 四键 / ✂ 文法 / 失败族 / readData / 姊妹面 / 值导出集 / runtime 四名目 / lease 别名 / wire） | 设计 §8.1/DENY 逐项保持 | 成立。全部冻结面在本轮源码亲读中确认设计未触碰 |
| 包 AGENTS：doc-runtime 公共 API 只经 src/index.ts、公共面守卫逐导出记账；namespace-runtime 读在 sequencer 外、detached 投影；registry lease 透传 | §6 表 + §10 DENY（index 两文件、registry src 全域） | 成立。`doc-runtime/src/index.ts` L48（两枚值导出）+ L49–63（type-only）亲证；`public-surface-guard` P-W2 以 `Object.keys(ns)` 过滤 `/Window/` 断言恰两枚——type-only 成员形状变化不入运行时键集，守卫恒绿结论正确 |

## 6. 设计内部一致性

- **D2 等价证明逐位核验（本轮源码比对）**：数组面——W1 `enumerateArrayCandidates`（window.ts L503–522）对 Y.Array 按 `length`、plain array 按 `length` 循环（稀疏空洞计入）⟹ `candidates.length === target.length` ≡ 被删 S4 的 `target.target.length`（window-read.ts L425）；键面——W1 `enumerateMapCandidates`（L524–542：Y.Map `keys()` 过 `get(k) !== undefined`；plain object `Object.keys` 过 `readableOwnDataValue`）≡ 被删 `countMapEntries`（L435–447 同款双分支同款判据）。**逐位一致成立**。
- **D3 删除集依赖闭合核验**：删除的 19 个名目（S4 三函数 + 镜像 16 名目）的引用者仅为 S4 链自身与 L164 调用点；保留集（S3 `canonicalWindowBudget`/`canonicalOrderBy` 自带内联 `Number.isInteger` 校验，**不消费** `isNonNegInt`；S5 `anchorSchemaBody` 只消费 `state`/`segments`；S6 四函数；`windowFailure`/`seamWindowOptionsInvalid` 只依赖保留的 `safePathCopy`；`foldSegment` 被 S6 的 `windowFactsBlock`/`windowPathText` 消费）**零依赖删除件**。`WindowComposeInput.doc` 的体内唯一消费者确为 S4（L163）；`redispatch` 闭包现状即捕获包装函数参数 `doc`（L123/L144），设计「删 doc 字段、闭包直接捕获」与现状结构吻合。
- **签名/类型断言核验**：`compose*` 不进包 `src/index.ts`（index L65–70 仅 type-only 四名目）——签名变化为模块内部面属实；`redispatch` 声明类型 `{readonly ok:true; readonly value:unknown[]} | WindowReadFailure`（L103 亲证）下三键成功成员可结构化赋值、成功字段零消费（L156–160 仅失败透传 + 出口②）成立。
- **前后无矛盾**：§8.1 接口总览 ↔ §9 调用方矩阵 ↔ §10 ALLOW/DENY 三处对同一事实（doc-runtime 类型面加法、compose 内部签名、registry/lease 零变化、值导出零变化）叙述一致；D1 的「失败面零改动」与 T9/NC3 一致；D5 的 ADR/CONTEXT 零改动与 DENY 一致。未发现死引用、旧 API 引用或「附录承认但正文未改」的伪修订。
- **备选方案否决理由核验**：A1（违 AC2 结构契约）、A2（必触 read.ts 红线或新建跨包共享面）、A3（违 P-W2）、A4（等价实现自由）——均成立且与 SA6 H9/NC6 呼应。

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| C-1 | runtime ready，W1 已成功，S3 canonical 重读 options | 敌意 Proxy trap 在 descriptor 重读间插改 doc（插入/删除容器） | HEAD：S4 二次导航按新快照计数（E4：`kept 3/total 4`）或坍缩 `countingDefectFailure`；设计后：`total` 与 `value` 同一次枚举同源（`total=3, truncated:false`） | 无缺口——设计 R-381-1 已登记该对抗类为非阻断边界（SA6 §12.9/O4、SA8 §3-17 背书；无既有契约覆盖，确定性调用下逐字节不变） | 无（见观察 O-3 措辞建议） |
| C-2 | S3 判 options 不稳定 | redispatch 重派发 W1 | 失败成员原样透传（出口①）；竟又接受 → 接缝终态（出口②） | 无缺口——重派发产物多 `total` 键不被消费（L156–160 结构零消费；R-381-5 设计冻结） | 无 |
| C-3 | 任意读调用重复/并发交错 | 同步纯函数、零可变态、零 sequencer | 天然幂等；`maxWorkers:1` 确定性不变 | 无缺口（设计 §8.3 与包 AGENTS「读在 sequencer 外」一致） | 无 |
| C-4 | 进程重启 / 晚到回调 | 纯读路径，无持久化/订阅/后台任务 | 不适用 | 无缺口 | 无 |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E-1 | W1 失败（三码 + PATH_NOT_ALLOWED） | runtime S2 原样透传（L688/L700 现状不动） | 无——失败词表与形状零变化，B-5/NC3 锚定 | 无 |
| E-2 | 入选项物化失败 | fail-fast 整窗失败、无半窗（windowCore L204） | 无——M 段零改动；E4 毒项负控在零 diff 树内保持 | 无 |
| E-3 | `countingDefectFailure` 触发条件（W1 成功后二次导航失败） | 随 S4 删除而结构性消失 | 低——确定性输入下不可达（全同步、两次导航间仅 options descriptor 读可运行用户代码）；对抗输入下的失败→成功跃迁属 C-1 登记的同一非契约边界类 | 无（见观察 O-3） |
| E-4 | 实现期 `windowResult.total` 运行时缺席（类型 `number` 但未赋值） | T2（`typeof number` + 整数 + ≥0）+ T1 键集断言红；类型层 M2 锁键集（值类型缺席另有 T2 行为锁补位） | 无——防线在契约层已闭合；设计禁组合层 `?? 0` 兜底（O1 前提）防静默 | 无 |
| E-5 | 回滚需求 | 单变更集 `git revert`；无迁移/持久化/wire | 无 | 无 |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `ReadArrayWindowResult`/`ReadMapWindowResult` 成功成员 +`total` | 无遗漏。全仓消费者清点亲证：`namespace-runtime/src/runtime.ts`（唯一直接值消费者，D4 改 2 处）、`window-read.ts`（类型复用，`redispatch` 结构超类型成立）、`doc-runtime/src/index.ts`（既有 type-only 导出）、`public-surface-type-guard.test-d.ts`（M2 落点）；apps/domains 零命中 | grep `-rln` 亲证（与设计 §2.3、SA6 §10 同款结论） | 无 |
| `composeArrayWindowRead`/`composeMapWindowRead` 追加 `total` 末参 | 无遗漏。无任何测试导入 compose*（grep 亲证）；包 index 仅 type-only 转出四名目（L63–70 亲证） | grep 亲证 | 无 |
| `countWindowCandidatesAtPath` 删除（含 `export`） | 无遗漏。包外零消费者（index.ts 不转出、runtime.ts 不导入、全仓测试零引用） | grep 亲证（仅定义/调用/头注三处自引用） | 无 |
| lease `readArray`/`readMap` 透传联合 | 无遗漏。lease.ts L309–315 raw 引用直传、types.ts L468–484 别名跟随——成功面恒四键不因 W1 三键变化 | 源码亲读；lease-surface.test-d L49–52 四键 `AssertTrue<Equal>` 锁在零 diff 树内保持绿 | 无 |
| 零 diff 测试树的成功面耦合 | 无遗漏。全对象 `toStrictEqual` 仅失败成员（composition E4 L423、lease E4 L706、F1 L739、F2 L746——四处上下文本轮亲读均为 `PATH_NOT_ALLOWED`/三码失败）；`.value` 级比较（L207/L221/L611/L642）不受加键影响；F6 lease≡runtime 双侧同变 | 亲读 + SA6 H4/E3 实证 | 无 |
| wire / schema / 持久化 / readData | 零接触（文件范围外） | SA8 报告 §3-12 协议 grep 亲证 + 设计 §10 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 候选标识计数（枚举/过滤/计数同源） | 载体级原语 doc-runtime（ADR 0028 §9、ADR 0029 §8） | D1/D2 下沉进 `windowCore` | 正确归属——把 #369 冻结期被迫上移的组合层计数还原到规范层 |
| 组合选窗 + 投影文本 + ✂ 装配 | namespace-runtime（ADR 0028 §9） | D3 收缩为 S3/S5/S6，`total` 单源直通 | 正确归属——组合层零计数、零导航镜像 |
| lease 公共面与类型别名 | namespace-registry（ADR 0028 §9） | 零改动 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 组合层消费原语结算的截断事实 | `readData` 组合：`result.truncated`/`result.truncations` 由 doc-runtime 原语结算、runtime 直通消费（runtime.ts L664–669） | 窗口组合消费 W1 结算的 `total`（同款直通） | 一致 | 同一「原语单源 → 组合层零重算」协议，无平行机制 |
| S3 canonical 接缝（options descriptor 重读） | `readData` 的 `canonicalReadOptions`（A-2b/A-2c 两出口先例） | 保留不动（S3 全部） | 一致 | 零改动 |
| ✂ 块装配文法 | 渲染器 `blocks.join('\n\n') + '\n'` + ADR 0027 ✂ 段 | 保留不动（S6 全部） | 一致 | 零改动 |
| 独立预言机断言纪律 | `readdata-ok-shape.ts` 头注反伪绿不变量先例、#369 S4 oracle 矩阵 | T3/T5 沿用同款纪律；M4 保留 #369 矩阵 | 一致 | 复用既有测试协议，不新建平行断言通道 |

未找到可比实现缺失项：设计全部动作落在既有扩展点（W1 结算、compose 内部签名、既有测试文件族）上，无凭空新建面。

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 窗口候选计数 | 设计后：W1 `candidates.length`（单一权威） | 组合层 `input.total` 直通（零推导） | 无——正是本票消除的目标（HEAD 双份计数空间的 E4 漂移接缝被结构性移除） |
| lease `truncated`/✂ 事实 | W1 total + entries 同源推导 | 无第二份状态 | 无 |

### 生命周期对称性

纯同步读路径：无 register/dispose、无订阅、无后台任务、无 acquire/release；不适用（与包 AGENTS「读在 sequencer 外」一致）。

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| S4 计数（第二计数空间） | W1 枚举 | 删除 | 正确关闭（A1 否决理由成立） |
| W1 出处标记镜像块（267 行第二导航实现） | doc-runtime window.ts/carrier.ts 规范归属 | 删除（保留 `safePathCopy` 并重述注文） | 正确关闭；`safePathCopy` 保留理由（S3 接缝终态仍需 path 安全副本 + 新增公共值导出被 P-W2/NC6 禁止）经 SA8 §3-4 裁定成立 |
| 专用 count 原语 / n=0 计数探针 | 无（ADR 0029 §5 备案演进位） | 不做 | 正确（A3 否决） |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 八项逐一对上正文触点：window.ts（D1/D2）、window-read.ts（D3）、runtime.ts（D4/D5）、pins（M1）、type-guard.test-d（M2）、contract-red 头注（M3）、新测试文件（P3）、artifacts 日志（P5） | §5 决策与 §10 ALLOW 逐条交叉核对 | 无 |
| DENY 与正文无冲突：read.ts 零 diff（D1.4 明示保持）、carrier.ts 不动、两包 index 零改动、registry src 全域、两测试树零 diff（M4）、ADR/CONTEXT 零改动（D5）、配置零改动（vitest include `packages/*/test/**/*.test.ts` + typecheck include 亲证自动采集新文件） | §10 DENY 逐条与 §5/D5/M4 核对 | 无 |
| ALLOW 无无理由扩张：新文件与 artifacts 均有 SA6 §12.9-P3/§12.6-P5 承接；`issue-368-*-contract-red` 仅头注注释级改动（M3），与 AC2 清账义务对应 | §5 D6 | 无 |
| follow-up（P2 where、read.ts 冻结解除评估、count 演进位）未掩盖本任务必要项：AC1–AC5 全部在本票闭合（§12「任务内必要条件：全部满足」经 §8 映射核验成立） | §12 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1 三键 + total 语义 | P3-T1（键集恰三键，多/少一键红）、T2（数值性/整数/≥0）、T3（独立预言机：Y.Array/plain length 稀疏计入、Y.Map 非 undefined 键、plain object own-enumerable data 键——与 D2 等价证明的三个判据一一对应）、T4（min 双向）、T5 边界矩阵（沿 #369 fixture，ROOT=9 经 fixture 亲证：workRecords/tasks/assets/emptyAssets/meta/taskList/emptyTasks/emptyTags/probe 恰 9 键） | 无 | 无 |
| 排序/预算不变性 + 零物化 | T6/T7（total 恒定）、T8（N=2000 毒值 + n=2 → total=2000，「为 total 全量物化」必红） | 无 | 无 |
| 失败面不变 | T9（四键 + 三码 + PATH_NOT_ALLOWED 透传 + `'total' in r === false`） | 无 | 无 |
| AC2 结构清账 | X1（S4 三函数名 0 命中——注意 X1 自带 `packages/namespace-runtime/src/*.ts` 作用域）、X2（`copied from window.ts@ab6e390` ≤1 且措辞重述、`copied from carrier.ts` 归零）、X3（镜像函数名 0 命中，`foldSegment` 例外）、X4（块删除、无「保留但注释掉」）、X5（头注/JSDoc/B-5 清账）；原始输出落 artifacts | X3 未显式钉 grep 作用域（见观察 O-1） | 无阻断（MINOR，建议实现票把 X3 作用域钉为 `packages/namespace-runtime/src/*.ts`） |
| AC3 回归 | R1–R6（恒四键 helper、预言机 truncated、✂ byte 级、失败透传/released、lease≡runtime、depth 等价锚）全部为既有用例零改动保持绿 + 两测试树 `git diff --stat` 为空 | 无——零 diff 可行性经本轮静态核验（§9）+ SA6 E2/E3 变异实证 | 无 |
| AC4 迁移 | M1（P7 三键）、M2（类型锁）HEAD 红 → 迁移后绿；不迁移即红（E3 实证） | M2 的 `AssertTrue<Equal<…>>` 字面式与目标文件现行 `expectTypeOf` idiom 不同（文件未 import 该 helper；见观察 O-2） | 无阻断（MINOR——锁的语义无歧义，可按文件 idiom 等价表达） |
| AC5 全仓门 | G1/G2（typecheck/test exit 0），先聚焦后全仓 | 无 | 无 |
| 反伪绿 | 变异防线清单（§12.8 承接）：每条变异至少击穿一个用例组；禁同构造器期望 | 无 | 无 |
| 测试入口真实性 | P3 新文件按 `packages/*/test/**/*.test.ts` 自动采集（vitest.config L15/L20 亲证）；type-guard.test-d 按 typecheck include 采集 | 无 | 无 |

## 13. Required revisions

无 BLOCKER / MAJOR finding。实现票可直接进入实施。

## 14. Non-blocking observations

| ID | Observation | 建议（不阻断） |
|---|---|---|
| O-1 | **X3 审计命令未显式钉 grep 作用域**。X1 自带作用域（`packages/namespace-runtime/src/*.ts`）、X2 钉到 window-read.ts，X3 仅说「镜像函数名全量 0 命中」。若实现票把 X3 理解为全仓 grep，则对 doc-runtime 的**规范归属实现**（window.ts 自带 `navigate`/`navClassify`/`classifyArrayTarget`/`readableOwnDataValue`/`isNonNegInt` 等 13 件、carrier.ts 自带 `carrierOf`/`probeRoot`）必然命中——审计结构性不可过，且可能诱导误改 DENY 名单内的规范文件。 | 实现票执行 X3 时把作用域钉为 `packages/namespace-runtime/src/*.ts`（与 X1 同域）；artifacts 日志记录命令全文含路径参数。 |
| O-2 | **M2 类型锁的断言形态与目标文件 idiom 不匹配**。`public-surface-type-guard.test-d.ts` 全文使用 vitest `expectTypeOf(...)`（无 `AssertTrue`/`Equal` helper import）；设计/SA6 的字面式 `AssertTrue<Equal<keyof Extract<…>, 'ok'\|'value'\|'total'>>` 需补 helper 或改写。锁的语义（成功成员键集恰三键）无歧义，`expectTypeOf<keyof Extract<ReadArrayWindowResult,{ok:true}>>().toEqualTypeOf<'ok'\|'value'\|'total'>()` 可等价表达（仓内 `issue-369-window-read-lease-surface.test-d.ts` L49–52 即 AssertTrue idiom 先例，两种写法仓内均有先例）。 | 实现票按目标文件 idiom 落锁，红/绿判据不变（HEAD 红 = 键集缺 `total`）。 |
| O-3 | **§8.3「删除不缩小任何可达失败面」措辞在对抗输入域下不精确**。确定性输入下成立（S4 与 W1 两次导航间全同步、无自发改doc通道）；但在 R-381-1 已登记的对抗类内（S3 canonical 重读窗内 trap 变更 doc），若 trap 删除/移走容器，HEAD 可经 `countingDefectFailure` 以 `PATH_NOT_ALLOWED` 失败收尾，设计后则按 W1 快照成功返回——这是该对抗类的失败→成功跃迁（E4 探针展示的是成功面叙述修正）。行为处置本身正确（同属无契约覆盖的漂移修正，ADR 0029 §8 指令的兑现），仅措辞可能被 SA4/SA9 误读为「任何输入下失败面均不缩小」。 | 在 R-381-1 边界登记中补一句：该对抗类的可观察变化含「计数防御失败位（HEAD `countingDefectFailure`）不再可达」的失败→成功跃迁，同属不判负、不写断言、不引新读路径的边界。 |
| O-4 | **设计 §6/§14 对 SA8 产物在场性的陈述已过时**（非缺陷，时序产物）。设计成稿（19:31）时 `task_issue-381_design_conflict_report.md` 尚不存在；本轮评审时该报告已在场（19:43，verdict clear，18 项对照零冲突、零修订要求）。设计 §14 的复查理由 #3（SA8 产物缺席）已被报告的存在取代，理由 #1/#2（公共类型面变化 + 冻结解除）仍然成立且与报告 §10 一致。 | 无需设计修订；实现期冲突复查（双方均已标记 `requiresConflictRecheck: true`）直接以该报告 §8 五项核对清单为输入。 |

---

## 评审结论

设计通过攻击审查：需求（简报 AC1–AC5 + 「What to build」三要素）、上游事实（SA6 探针/变异/漂移证据）、SA8 约束（冲突报告 clear + 两项 override 兑现）、状态机/并发（纯同步读，对抗类已登记）、错误恢复（失败面零变化、防御位删除有据）、调用方矩阵（消费者清点零遗漏、零 diff 可行性静态核验成立）、架构一致性（计数权威回归规范层、单一事实源、平行机制关闭）、文件范围（ALLOW/DENY 与正文一致）与验收设计（T/M/R/X/G 可执行、真实测试入口、反伪绿防线）**均足以安全实施**。四条 MINOR 观察供实现票与 SA4/SA9 参照，不构成阻断。
