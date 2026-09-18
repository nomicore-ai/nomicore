# SA2 设计攻击评审 — Issue #406 窗口面同轴：`readArray` / `readMap` 的 `maxBytes`

- 派发：`sa-0001336d-4c1f-4776-8879-59fb2a0d39e5`（role `mabf-sa2`，phase `design-review`，iteration 0）
- 被审对象：`wiki/raw/task_issue-406_design.md`（SA1，派发 `sa-7feb911c…`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-406`（branch `mabf/issue-406`，HEAD `56cf5428…` = `fix(#405)`，与 SA6 契约基线一致——本次 `git log`/`git status` 实测确认）
- 评审方式：全新视角独立攻击；所有源码/测试/文档断言均为本次实读核验（非转抄设计自述）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-406.md`（Host 任务简报，Issue updated 2026-09-18T02:09:17Z，Comments 段空） | 在场，实读 |
| `wiki/raw/task_issue-406_design.md`（SA1 设计，426 行） | 在场，全读 |
| `wiki/raw/task_issue-406_sa6_contract.md`（rev1，verdict approve；18 冻结锚 + 6 契约测试文件 + 2 处既有类型锁原位延伸） | 在场，全读 |
| `docs/adr/0031-readdata-byte-budget.md`（决策 1–6 + 修订节 + 备选否决表 + 验收节） | 在场，全读 |
| `wiki/raw/task_issue-405_design_conflict_report.md`（父票 SA8 裁决：RA-1/RA-2/RA-3/RA-D1/RA-D5=OBL-WIN-1） | 在场，全读 |
| `CONTEXT.md`「字节预算/形状预算/窗口读/过滤窗口/截断事实段」词条 | 在场，实读 |
| `.agents/skills/nomicore/typed-access.md` 字节预算段 + 窗口读小节（L140–L210） | 在场，实读 |
| 源码实读：`packages/doc-runtime/src/window.ts`（W1 全文）、`packages/namespace-runtime/src/runtime.ts`（readData 预算编排 L750–846、budget helpers L1085–1325）、`src/window-read.ts`（全文）、`src/index.ts`（全文）、`packages/namespace-registry/src/lease.ts`（L320–360、L470–505）、`src/types.ts`（窗口别名段） | 完成 |
| 测试实读：`issue-369-window-read-composition-red.test.ts`（敌意计数锚 L97–246）、`issue-406-window-maxbytes-fixture.ts`（锚表+模板）、`issue-406-window-maxbytes-red.test.ts`（G3/G5/G6/G10 断言）、`issue-406-window-maxbytes-control.test.ts`（C1–C9）、`issue-406-window-maxbytes.test-d.ts`（T1–T3）、`issue-406-lease-window-maxbytes-surface.test-d.ts`（T4–T5）、`issue-406-lease-window-maxbytes-red.test.ts`（G9）、`issue-383-window-where-type-guard.test-d.ts`、`issue-369-window-read-lease-surface.test-d.ts`（Omit 中继锁现形态）、`runtime-acceptance-exports-audit.test.ts`、`readdata-shape-assertion-consolidation-gate.test.ts`、`readdata-docs-adr0016-sync-control.test.ts` | 完成 |
| `wiki/raw/task_issue-406_relevant_decisions.md` / `_conflict_report.md` / `_design_conflict_report.md`（本票 SA8 产物） | **缺席**（设计 §6 如实登记并自建冲突基准 + `requiresConflictRecheck=true`；处置见 §5） |
| REST Issue-comment 快照 | **空（`[]`）**——与派发说明一致；无评论来源义务 |

## 2. Verdict

**approve**。未发现 BLOCKER 或 MAJOR。设计对 SA6 契约 rev1 的全部观测面（含 D1–D7 全部 pin 的推荐解）、ADR 0031 决策 1–6、父票 SA8 遗留义务（OBL-WIN-1/RA-1/RA-3）逐条给出可实施落点；本次独立攻击的重点面——敌意 descriptor 计数锚 parity（B10 的 4/5）、三面同文单源、W1 五键单一权威保持、类型锁可满足性、registry 零改动跟随——均经源码级重推导成立。仅有 4 条不阻断实施的观察项（§14）。

`pass` 仅覆盖设计层；实现与活链路验证仍归 SA4/SA7（含 R-1 计数锚 parity 的实现期验收与 `requiresConflictRecheck` 落点）。

## 3. 需求覆盖

| Requirement（Issue #406 正文/AC） | Design section | Assessment |
|---|---|---|
| options 追加同形 `maxBytes`（≥1 有限整数；非法 → `WINDOW_OPTIONS_INVALID`） | §1 目标、§7 DD-2/DD-3/DD-5 | 覆盖。域判据 `Number.isSafeInteger(v) && v >= 1` 双点同判（split 前置 + canonical 镜像）= RA-1 域钉死；实测 red 测试 G5 非法矩阵（`0/-1/1.5/NaN/±Infinity/'100'/true/2**53/2**53+2/1e21/{}`）只断言「码 + message 含 maxBytes + ≠ 未知键 message + 恰四键」——设计的 W1 无前缀措辞族满足，且不误引 readData 面的 `READ_OPTIONS_INVALID:` 前缀（引了反而错面） |
| 总量 = 条目列表（含 key/index 包装）紧凑 JSON + 元素口径投影文本 UTF-8（✂/头行自然计入） | §7 DD-6 | 覆盖。`deliveryBytes(entries, schema)` 复用 `#405` helper（runtime.ts L1298–1302 实读确认）；「头行自然计入」在窗口面退化为无头行（窗口 schema 本无头行，`projectSchemaTextBody` 实读确认）——Issue 措辞沿 readData 泛化，无冲突 |
| 超限 → 同码同文同载荷 `READ_BUDGET_EXCEEDED`（`path` 窗口目标、`measuredBytes` 合计、恰五键零交付） | §7 DD-6/DD-7、§8 路线⑦ | 覆盖。共享 `read-budget.ts` 单源模板；实测 fixture `budgetMessageTemplate`（L201–203）与 runtime 现行文案（L1321–1324）逐字节一致；`echoReadPath` 新鲜回显（G3 path 深等非同引用） |
| ≤ → 成功，交付物与无预算读逐字节相同 | §7 DD-6（闸门透明）、§12 AC3 行 | 覆盖。闸门在 S6 结算后只读不写；G1/G2/G8 + C1 锚定 |
| where 过滤窗口：同分支、装满判定不受影响、✂ 永不装配、无静默丢弃 | §7 DD-6（where 侧无特殊分支）、§12 AC4 行 | 覆盖。闸门在 `truncated` 双语义与 ✂ 分支结构之后（window-read.ts L203–210 实读确认插位点成立）；G6 三态 + WM4/WM5 同字节 305 判定相反锚 |
| lease 别名跟随 | §7 DD-1/DD-8、§10、§11（registry src DENY） | 覆盖且为零代码改动。实测 `types.ts` L482–L496 纯别名 + `lease.ts` L338–L345 raw 直传；lease.ts L492–505 Equal 锁自动成立 |
| AC1 域负控 / AC2 三面一致 / AC3 边界+回归 / AC4 where×预算 / AC5 度量等式 / AC6 lease 锁 / AC7 门禁 | §12 验收映射表（逐 AC 行） | 全覆盖；每行绑定既有契约组（G1–G10/T1–T5/C1–C10）与 §12.8 门禁六项，无缺项 |
| Blocked by #405 | §2 B7/B8（HEAD `56cf542` = 父票落地提交，实测一致） | 解除条件满足 |

目标无静默扩大：非目标（§1）与 ADR 0031 备选否决表、CONTEXT.md `_Avoid_` 逐条对齐；演进位（裁剪/载荷拆分/where 计数）保持「不承诺」。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| —（无评论） | — | — | 任务简报 `## Comments` 段空 + REST 快照 `[]`（本派发说明与 SA6 §2 双源一致）。设计 §4 以空表如实登记，无虚构评论义务。全部义务 = Issue 正文 AC1–AC7 + ADR 0031 + 父票 SA8 遗留 + CONTEXT.md 三词条——设计 §4 清单与实读一致，无遗漏 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 §5 P1/P2 能力缺口复现（`maxBytes` ≡ 未知键；TS2353 ×5；`Extract` = never） | §2 B1–B6/B12、§3、§5 | 承接完整。B1–B6/B9–B12 全部经本次源码实读复核为真（W1 白名单 L311–L315、canonical 五键 L262–L272、runtime 编排 L861–L882、纯别名 L69–L72、lease 直传 L338–L345、EOPT） |
| SA6 §12.7 pin D1（present-undefined ≡ 缺席） | DD-3（split 剥离）+ DD-5（canonical 剥离） | 推荐解；与 `#405` splitReadDataOptions L1257 同构；red 测试 G5/D1 断言逐字节一致 |
| pin D2（联合形态：直接追加共享成员，无重载分叉） | DD-8 | 推荐解；满足 T1 `_exceededFollow`/T5 `_threeFaceParity` Equal 锁（实测锁文本确认 `Equal<ArrayExceeded, ReadDataExceeded>` 依赖「同一接口成员」——DD-8 恰如此） |
| pin D3（runtime 自持六键 interface；doc-runtime 五键零 diff） | DD-2 | 推荐解。doc-runtime `ReadArrayWindowOptions/ReadMapWindowOptions` 实读为**无 readonly** 的 interface（L77–L92），DD-2 的六键逐成员镜像（term 类型单源 import）精确满足 T1 `Equal` 与 `Omit<…,'maxBytes'>` 中继锁 |
| pin D4（校验/度量住组合层；W1 五键单一权威） | DD-3/DD-5/DD-6 | 推荐解。`{n:1, maxBytes:1, nope:1}` 场景经重推导：split 消费合法 maxBytes、原样复制 nope → W1(relay) 以「未知键：nope」拒（message 单源不漂移） |
| pin D5（超限文案逐字节镜像 readData） | DD-7（共享 `read-budget.ts`，readData 构造点同变更集迁引） | 推荐解。父票 SA8 RA-D5 的「逐字镜像 DD-7 选定文案」指**超限分支文案**（三面同文义务，ADR 0031 决策 3 明文「面区分靠调用现场，不靠 message」）——设计用共享模板兑现；域拒 message 走 W1 措辞族是正确面属（镜像 readData 域文案会把 `READ_OPTIONS_INVALID` 前缀带进窗口面） |
| pin D6（度量对象 = 塑形后交付物） | DD-6（S6 之后、return 之前） | 推荐解；ADR 0031 决策 2 明文 |
| pin D7（定序：lifecycle > G0 > options 校验 > W1 目标/载体 > S3 接缝 > 预算） | DD-4/DD-9 | 推荐解。层内次序（split-先行 → `{n:0,maxBytes:0}` 以 maxBytes 域 message 拒）经实测 red 测试 G10 第三例只钉码不钉 message——无断言冲突，设计 §7 DD-9 已如实披露该层内次序决定 |
| 负控 N1–N9（HEAD 绿、实现后必须保持） | §5 表末行、§7 DD-4/DD-5/DD-9、§11 DENY | 逐点落位；C3/C4/C5/C6/C7/C8/C9 与 control 测试文件实测对应 |
| 父票 SA8 RA-D1 同款（split 读纪律 parity = 实现验收必要条件） | §13 R-1（明记「不得伪装成 follow-up」） | 诚实登记；本次独立重推导见 §7 表后判读 |
| OBL-DOC-406-1（typed-access.md 窗口读小节补词汇） | §6 表 RA-3 行、§11 ALLOW、§12 文档义务行 | 落点实名（L148–L205 范围实测确认现为无 maxBytes 词汇）；「readdata-docs 夹具族无回归」经查 `readdata-docs-adr0016-sync-control.test.ts` 的 typed-access 断言均为 readData 形状注记的在/缺席规则——窗口小节加法不触其判据，风险低且全量门禁可兜底 |
| 本票 SA8 产物缺席 | §6（直接实读 ADR 全集自建基准）+ §15（`requiresConflictRecheck=true`，四条理由） | 处置得当：设计不引入需 SA8 裁决的新语义（全部行为可回溯 ADR 0031 决策 1–5 或父票既有实现），自由位全采契约推荐解 |

## 6. 设计内部一致性

- 正文（§1 目标）↔ DD ↔ 数据流（§8）↔ 验收映射（§12）↔ 风险（§13）互相吻合；DD-6 伪代码的插位点与 `window-read.ts` 实际结构（S6 结算 L203–210 → return L210）吻合；DD-9 阶梯与 `#405` readData 阶梯（runtime.ts L791–839 实读）逐级同构。
- 死引用/旧 API：未发现。抽验的全部行号锚点（W1 L311–L315/L351、runtime L791–L799/L861–L882/L1237–L1270/L1281–L1325、window-read L69–L98/L250–L310/L551–L557、lease L338–L345/L492–L502、fixture L201–L203）与实际源码一致。
- 「附录承认但正文未改」式伪修订：未发现。A2 备选（canonical/W1 消费剥离视图）在正文 DD-5 以结构理由硬否决（见 §7 判读），否决依据可验证。
- 唯一内部小账目误差：§11 ALLOW 行「runtime/test/issue-406-*（5 文件）」——实测该 glob 命中 **4** 个文件（fixture/red/control/test-d；`ls` 复核），与 §2 B11 自己的「5 新文件（= 3 runtime 测试 + 2 registry 测试，不含 fixture）」口径混用。属笔误级（ALLOW 为 glob 范围，语义不受影响），列入 §14 观察。

## 7. 状态机与并发攻击

无新状态机（读路径全同步、零状态写入、零 sequencer；唯一状态 = runtime lifecycle，S1 门原样）——设计 §8/§9 如实声明且与 ADR 0008 一致。攻击集中在「敌意 options 视图」这一隐式状态面：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| C-1 | 稳定 options `{n:2}`（#369 状态化 Proxy：单键、每 validator pass 2 次 descriptor trap——`Object.keys` 可枚举性检查 + 显式读，本次读 helper 源码实锚） | 第 3 次 descriptor 读起抛错 | HEAD：W1 pass #1/#2 → canonical #3 抛 → 重派发 W1 #4 抛 → W1 收编 → exit① `WINDOW_OPTIONS_INVALID`；总 raw descriptor 读 = **4** | 无。新管线：split #1/#2 → W1 读 plain relay（零 raw trap）→ canonical #3 抛 → re-split #4 抛 → split 收编 → exit① 同码成员；总数仍 **4**，probe message 与 W1 L351 逐字相同（DD-7） | 无 |
| C-2 | 同上（交替 Proxy：仅第 3 次抛） | 仅第 3 次 descriptor 读抛 | HEAD：… canonical #3 抛 → 重派发 W1 #4/#5 过 → exit② 接缝终态（message 含「视图不稳定」）；总 = **5** | 无。新管线：re-split #4/#5 过 → W1(relay₂) 过 → exit② 同一接缝成员（window-read.ts L551–L557 原文不动）；总 = **5** | 无 |
| C-3 | 非 plain 宿主（class 实例/数组/null） | 任意键集 | W1 宿主门单源拒绝（message 单源留 W1） | 无。split 宿主门 relay=raw 直传（镜像 `#405` L1241–1246）；canonical 结构上不可达（W1 已失败） | 无 |
| C-4 | plain 宿主 + `Object.keys` 谎报键（desc undefined） | ownKeys 谎报 | 与 W1 同处置（≡ 非 own，跳过） | 无（DD-3 明记） | 无 |
| C-5 | lifecycle ≠ ready + 敌意 options | closing/closed 期调用 | `RUNTIME_READ_DISABLED`，trap 0 次 | 无。S1 原样先行（C6/N5 + lease released 短路三键 + get trap 0 次锚实测在案） | 无 |
| C-6 | 非数组 path + 非法/合法 `maxBytes` | path 非数组 | `PATH_NOT_ALLOWED`，零 options 读取 | 无。S2-G0 前置分支调 W1(raw)（其 G0 先于 OPT）；成功不可达 → loud throw 守卫（镜像 readData L795–799） | 无 |
| C-7 | split 与 canonical 间视图漂移（maxBytes 消失/变形） | 敌意 descriptor | 响亮失败（exit①/②），绝不静默放行/静默免预算 | 无。canonical 读 **raw** 六键镜像（DD-5）——present-undefined 剥离、域镜像违例、accessor 显形、trap 均触发 `{ok:false}` 两出口；与 `#405` canonical（L1127–1163）逐字同构 | 无 |
| C-8 | 同 doc 同参重复调用 / 并发读 | 任意 | 逐字节确定（零随机零时钟零共享可变态） | 无（§9；SA6 §7 时序同判） | 无 |

**判读（B10 parity 独立重推导）**：#369 计数锚的 trap 计数只覆盖 `getOwnPropertyDescriptor`（helper 源码实测），raw 上每 validator pass 恰 2 次（Object.keys 枚举性过滤 + 显式读）。新管线把「W1 读 raw」替换为「split 读 raw + W1 读 plain relay」，success path raw 命中数（2/pass）、状态化 4、交替 5、exit① 成员形状/码/message、exit② message 全部保持。设计将 R-1 列为实现验收必要条件而非既成事实——定位诚实。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E-1 | 非法 `maxBytes`（域/accessor/探测期） | split 前置 `WINDOW_OPTIONS_INVALID` 恰四键（W1 无前缀措辞族；getter 零执行） | 低。runtime 构造非 W1 单源——已按 `#405` `budgetAxisInvalid` 先例作 D1 豁免登记（DD-7），形状经 `WindowReadFailure` 单源类型注解锁死；实测无既有测试钉这些文本（grep 全仓仅 issue-406 文件含相关串） | 无 |
| E-2 | 超限 | 恰五键零交付、同步、path 新鲜回显、message 模板单源 | 无部分交付/半窗通道（失败成员结构上无 value/schema/truncated；T 锁 + G3/G6 断言） | 无 |
| E-3 | W1 目标缺席/载体不符 × 合法 `maxBytes` | 原样 `WINDOW_TARGET_ABSENT`/`WINDOW_CARRIER_MISMATCH`（预算不吸收） | 无。G10 锚定；预算判定在最后且结构上需要 W1 成功产物 | 无 |
| E-4 | 非法 options 同现（`{n:0,maxBytes:0}` 等） | `WINDOW_OPTIONS_INVALID`（校验先于度量） | 低。层内由 split-先行决定以 maxBytes 域 message 拒——实测 G10 断言只钉码；设计 §7 DD-9 已披露该次序 | 无 |
| E-5 | 重试语义 | `READ_BUDGET_EXCEEDED` 后重试 = 确定性调用方动作（ADR 0031 决策 6） | 无自动重试/回滚面（纯读） | 无 |
| E-6 | 唯一 throw 逃逸 | G0 后成功不变式守卫（internal-bug-only，生产不可达） | 与 `#405` L798 同款先例；敌意输入零外抛由 split/W1/canonical 三层 try 收编 | 无 |
| E-7 | `JSON.stringify` 不可序列化值（bigint/循环） | `deliveryBytes` 无 try 包裹 | 无新增暴露：条目值与 readData 值同源（同一 `readLogicalValueAtPath` 物化、yjs 编码域内 bigint/循环不可物化），且与已验收的 `#405` readData 面暴露完全同阶（列入 §14 观察 O-3 备案，不构成修订要求） | 无 |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `NamespaceRuntimeReadArrayOptions/ReadMapOptions`（五→六键） | 无。加法面：旧调用全部兼容；T1 `Parameters[1]` 锁实测为 `Equal<…, NamespaceRuntimeReadArrayOptions>`（自洽随动） | `issue-406-window-maxbytes.test-d.ts` 锁文本实测 | 无 |
| `NamespaceRuntimeReadArrayResult/ReadMapResult`（追加预算成员） | 仓内唯一生产消费方 = registry lease 透传（grep 实测：`lease.ts` L340/L344 仅有的非测试调用点）；无穷举 `code` 的窗口消费方（设计 §10 声明 + 本次 grep 复核为真） | 0.x minor 语义，ADR 0031 验收节明文授权；设计 §10 消费方行如实披露「按需认新码」 | 无 |
| registry `NamespaceLeaseRead*` 别名与 lease.ts Equal 锁 | 无。纯别名自动跟随（`types.ts` L482–L496 实测）；`lease.ts` L492–L505 `_readArrayAlias`/`_readMapAlias`/options 别名锁零改动成立 | 源码实测 | 无 |
| runtime `index.ts` 公共面 | 无。四个窗口类型名已从 `./window-read.js` 导出（实测 index.ts）；值导出审计只钉 `['RuntimeWriteFatalError']`（实测 audit 测试 L28） | index.ts 实测；`runtime-acceptance-exports-audit.test.ts` 实测 | 无 |
| `ReadDataBudgetExceededResult` 迁移 + re-export | 无。全仓 grep 实测该名仅出现于 `runtime.ts`（定义/消费 3 处），零外部按名消费方；`runtime.ts` re-export 保持模块面 | grep 实测 | 无 |
| doc-runtime W1 直调方（`#368/#381/#382` 契约 + C5/N4） | 无。doc-runtime 零 diff（DENY + `keyof` 五键硬锁 + `Extract<{maxBytes}> = never` 锁实测在 T1/T4） | 测试实测 | 无 |
| readData 面（`#405` 契约） | 无。共享件迁移行为零变化，C8 锚绿承诺；模板字节实测一致 | fixture L201–L203 vs runtime L1321–L1324 | 无 |
| 既有窗口测试族（`#369/#381/#382/#383`） | 无。plain options 下 relay 语义透明（descriptor 原样复制、键序保持、present-undefined/accessor/非枚举同处置）；计数锚见 §7 | §7 重推导 + window.ts/split 判据逐字对照 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| `maxBytes` 域校验 + 交付总量度量 + 超限分支 | runtime 组合层（唯一同时见两通道的层；ADR 0031 决策 4） | `runtime.ts` split/编排 + `window-read.ts` S3/S6.5 | 正确。W1 结构上看不到投影文本（SA6 已排除假设 2），设计不越层 |
| 五键域/未知键/宿主判据与 message | W1 单一权威 | split 忠实中继（原样复制 descriptor） | 正确，镜像 `#405` T1 关系 |
| 装满判定/total/✂ 装配 | W1 结算单源 + compose 分支结构（ADR 0029 §5/§8） | 原样不动；闸门只读不写 | 正确 |
| lifecycle 停接纳 | runtime S1 | 原样 | 正确 |
| lease 透传/别名 | registry（单源别名纪律） | 零改动跟随 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| readData 面 `maxBytes`（`#405`，HEAD `56cf542`） | S2b-0 G0 前置 → splitReadDataOptions → T1(relay) → canonicalReadOptions（闸门权威）→ S2b-5 预算闸 → readDataBudgetExceeded | 同构逐层镜像（S2-G0/S2-split/S2-W1(relay)/S3 六键/S6.5/共享件） | 一致（刻意同构，OBL-WIN-1 义务） | 三面同码同文同载荷要求结构对称；偏差面（措辞族/码）由各面既有码约束 |
| canonical 接缝净化（`#336`/`#369`） | `canonicalReadOptions`/`canonicalWindowBudget` 读纪律镜像 + 两出口 | 六键原位扩宽，出口结构不变 | 一致 | |
| 内部共享模块（`read-schema-projection.ts`、`errors.ts`、`status.ts`、`write.ts` 先例） | 包内按关注点分模块，不经 index.ts | `read-budget.ts` 新内部模块（零环方向：runtime→read-budget、window-read→read-budget、window-read→runtime 仅 type-only） | 一致 | 三面同文单源的落点合理 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 超限 message 模板 | `read-budget.ts` 唯一常量（readData 构造点同变更集迁引） | 三面构造点 | 低——R-2 已列缓解（C8/G3 双锚） |
| 闸门预算值 | canonical 复读值（组合层接缝单源） | split 首读仅服务前置定序（不喂闸门） | 低——与 `#405` 同构；split/canonical 判据双点漂移由 R-3 登记 + 注释互指 + G5 组级判据看守 |
| 五键判据/message | W1 | split 只中继不判定 | 无（结构保证） |
| `total`/truncated/✂ | W1 结算 + compose 分支结构 | 预算闸零参与 | 无 |
| maxBytes 域判据 | ADR 0031 决策 1（RA-1 钉死） | split + canonical 两处实现 | 低——同 `#405` 双点形态，G5 C-LIMIT 组级反伪绿 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 无新资源（纯读、零订阅、零缓存、detached 产物） | 无 | 结果联合成员即完整结果（拒绝无部分交付） | 对称性平凡满足；`path`/options 事后变异不影响已返回结果（G3 锚） |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套 options 校验器 | W1 `validateWindowOptions` | split 只做 maxBytes 轴前置拒 + descriptor 原样中继，**不复制**五键判据 | 非平行（豁免登记在案） |
| 第二套度量/文案 | `#405` `deliveryBytes`/`readDataBudgetExceeded` | 迁共享件单源化（把「近似拷贝」收敛为单点） | 反向收敛，正解 |
| 第二套预算失败联合/新公共名 | `ReadDataBudgetExceededResult` | 复用同一接口成员（A7 否决独立联合） | 非平行 |
| 新 cleanup worker/重试循环/状态字段 | — | 无 | 不适用 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW（runtime src 三文件 + typed-access.md + 契约测试沿用 + 两处既有锁零改动）与契约 §12.6「允许变更面」逐项吻合；无无理由扩张 | 契约 §12.6 vs 设计 §11 | 无 |
| DENY（doc-runtime/vfsl/渲染器/registry src/index.ts/CONTEXT/ADR/integration/fixture 冻结锚/其余既有测试）与契约「不可触碰面」吻合且与正文无冲突（DD-1 自称 index.ts 零改动 = DENY 一致；registry 零改动 = DENY 一致） | 同上 | 无 |
| §11 ALLOW 行「runtime/test/issue-406-*（5 文件）」计数与实际（4 文件：fixture/red/control/test-d，`ls` 实测）不符；B11 的「5 新文件」实为跨两包的测试文件计数（不含 fixture） | `ls packages/namespace-runtime/test/ \| grep 406` = 4 | 无（笔误级；glob 语义不受影响。见 O-1） |
| follow-up 无掩盖本任务必要项：R-1（计数锚 parity）明记为实现验收必要条件；OBL-DOC-406-1 设窗口闭合（义务关闭前不得宣告完成） | 设计 §13 R-1/R-6、§12 文档行 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC6 行为/类型 | 既有 SA6 契约组（G1–G10/T1–T5/C1–C10），HEAD 红/绿判定表在案（§12.4），参考闸门 18/18 + 6 变异体反证 | 无。断言只观察公共接缝（结果联合/own 键集/字节/投影文本/trap 计数），零源码字符串断言、零 skip/only | 无 |
| R-1 计数锚 parity（设计特有） | `issue-369` S3 组不改直接复跑（4/5/get-trap-0） | 无——§7 本次独立重推导确认结构前提成立（split 读纪律逐字镜像 + W1 读 relay 零 raw 触达） | 无 |
| AC7 门禁 | §12.8 六项：root typecheck / root 全量（`--conditions=nomicore-source`）/ 定点 vitest `--typecheck` / `git diff --stat` DENY 零 diff / 契约零 skip + 形状集中化门 family A/B 归零保持 / OBL-DOC-406-1 | 无缺项（与契约 §12.8 逐条对齐） | 无 |
| 测试入口真实性 | `vitest.config.ts` L15/L20 include 实测覆盖 `.test.ts`/`.test-d.ts` 两形态；root `tests/` 不在收集面（`ls` 实测仅 `acceptance`，无窗口消费方） | 无 | 无 |
| 错误路径伪绿风险 | G5 组级判据（非法矩阵「巧合绿」由同组有效域接受锚配平——契约 §12.5 R2 机制在案）；G10 只钉码与 split-先行层内次序兼容（断言文本实测） | 无 | 无 |
| 旧实现真实为红 | 契约 §13/§14 实测日志（4 红文件 = 恰本票契约；418 files/5073 tests 其余全绿） | 无 | 无 |
| 文档义务验收 | typed-access.md 窗口读小节含 `maxBytes` 词汇 + where×预算三语义；readdata-docs 夹具族无回归 | 低风险（该夹具族断言对象为 readData 形状注记规则，窗口小节加法不触判据；全量门禁兜底） | 无 |

## 13. Required revisions

无 BLOCKER / MAJOR。不需要设计修订。

## 14. Non-blocking observations

| # | 观察 | 证据 | 建议 |
|---|---|---|---|
| O-1 | §11 ALLOW 对 `packages/namespace-runtime/test/issue-406-*` 误记「5 文件」（实际 4：fixture/red/control/test-d）；与 §2 B11「5 新文件」（跨两包、不含 fixture）口径混用 | `ls` 实测 | 实现迭代沿用 glob 语义即可；如设计文档再版可更正计数 |
| O-2 | 根 `AGENTS.md`「Nomicore integration skill」段落以签名形态枚举窗口 options `{ n, orderBy, where?, depth?, maxChildrenPerNode? }`——本票落地后该枚举少 `maxBytes`（stale-by-omission）。父票 `#405` 对 readData 描述同样未补 `maxBytes`，且 SA8 RA-2 已把文档义务钉死为 SCOPE_DOCS 三文件 + CONTEXT.md，设计沿先例处理自洽 | 根 AGENTS.md 实文；`task_issue-405_design_conflict_report.md` RA-2 | 不阻断本票；可在后续文档巡扫（或下一次 AGENTS.md 触碰）时把两处 options 枚举一并对齐 |
| O-3 | `deliveryBytes` 的 `JSON.stringify` 无 try 包裹：若条目值含 bigint/循环引用会同步 throw。该暴露与已验收的 `#405` readData 面完全同阶（同一 helper、同一物化器 `readLogicalValueAtPath`、yjs 编码域内此类值不可物化），窗口面未引入新值类 | runtime.ts L1298–1302；ADR 0031 验收（`#405` SA8 clear） | 备案即可；若未来出现非 yjs 编码来源的 raw 数据面，需统一复查三面度量包裹性 |
| O-4 | DD-5/DD-6/DD-8 三节共同隐含三处内部签名联动：`CanonicalWindowBudget` ok 分支加 `maxBytes` 字段、`composeWindowRead` 内部返回类型加宽、`WindowComposeInput.redispatch` 闭包改由 runtime.ts 提供（re-split + re-W1(relay₂)）。均为 TypeScript 强制且观测面已锁，但分散在三个 DD——实现者应作为一个联动单元落地，勿只改其一 | window-read.ts L108–L125/L172–L211 现结构 | 实现期注意；无需设计修订 |

## 15. 附：与既有评审/门禁的关系

- 本文件为该 slug 首份 SA2 评审（设计 §14 如实登记「评审产物不存在」，本次 `ls`/glob 复核一致）。
- 设计自报 `requiresConflictRecheck = true`（§15，四条理由：公共 API 加法、本票 SA8 缺席、A2 硬否决等结构决策、OBL 未关闭）——SA8 门禁流程归属 Controller/SA8，本评审不否决该标志；本评审未发现**新增**的需冲突复查风险（全部行为可回溯 ADR 0031 决策 1–5 或父票既有实现），故 SA2 侧不附加冲突复查要求。
- 本评审不替代 SA4（实现审查）与 SA7（活链路验证）；R-1 计数锚 parity 的实证、DENY 面 `git diff` 证据、OBL-DOC-406-1 落地均待实现迭代兑现。
