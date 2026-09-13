# task_issue-348 SA2 设计攻击评审（guard II 语义矩阵）

- 被审对象：`wiki/raw/task_issue-348_design.md`（SA1 iteration 0 首版设计）
- 评审角色：SA2（独立设计攻击；不修改设计、不实现、不运行测试、不启动服务）
- 基线核对：HEAD `61e2daa37e21b467e7ce130d5c4db7be38bde982`（branch `mabf/issue-348`，`git status --short` 仅未跟踪任务产物，无生产改动）
- 评审时间：iteration 0（首轮；`wiki/raw/task_issue-348_sa2_review.md` 此前不存在，本文件为首版）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-348.md`（issue 正文 + 8 AC + Blocked by #347） | 已读 |
| `wiki/raw/task_issue-348_design.md`（被审设计） | 已读 |
| `wiki/raw/task_issue-348_sa6_contract.md`（SA6 诊断与验收契约） | 已读 |
| `wiki/raw/task_issue-348_conflict_report.md`（SA8 前置门禁，verdict clear、requiresConflictRecheck false） | 已读 |
| `wiki/raw/task_issue-348_relevant_decisions.md`（SA8 决策摘录） | 已读 |
| Issue 评论（REST） | 无（dispatch 与 SA6 §2/SA8 §1 同口径：零评论、零 Owner 要求） |
| 源码核对（只读）：`packages/doc-runtime/src/mutation.ts`（880 行）、`read.ts`（454 行）、`index.ts`、`materialize.ts`、`detached-build.ts`；`packages/doc-runtime/test/`（28 文件实测）、`packages/namespace-runtime/src/write.ts`、`packages/vfsl/src/validate.ts`、`packages/vfsl/src/derived.ts`；`vitest.config.ts`、`package.json`、`packages/doc-runtime/tsconfig.json` | 已核 |
| ADR 行号核对：0025（L42–44/L48–51/L53–58/L60/L72–74/L86–90/L94）、0007（L93–96）、0008（L18/L23/L26/L40–51/L109）、0026（L29/L53–55/L65）、0016（L74）、CONTEXT.md（L85–87/L113–122） | 已核（逐行 sed 验证，全部命中） |

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR。设计是一份可安全实施的纯测试锚定设计：生产修正范围 ∅ 的裁定有 SA6 92/92 运行时证据与 M1–M4 变异敏感度支撑；92 用例逐 AC 锚定、组织方式与 `issue-347` 既有惯例逐点对齐；全部源码/ADR/配置引注重抽核实无误。两项 MINOR 修订建议（R1 fixture 变体枚举不完整、R2 detached 用例措辞超出 fixture 能力）不阻断实施，见 §13。

## 3. 需求覆盖

| Requirement（issue 正文） | Design section | Assessment |
|---|---|---|
| AC1 深相等：嵌套结构、undefined 键过滤（`{a:1}` ≡ 显式 `a:undefined`）、`-0`/`0` | §7 D3/D4、§8.2 A 组（16 用例：A1–A14 含 A1b/A1d） | 覆盖。A5（幽灵键）/A6（缺键≡显式 undefined）/A7（键完整非子集）正锚 AC 原文三分句；A1/A1b/A8/A12/G6 锚 `-0`（实现 `logicalValuesEqual` L541 `===` 首判实测 `-0===0` 为 true，与 ADR 0025 L42 相容） |
| AC2 读失败两态：穿越标量/非下钻终态、中间缺失、越界缺席吸收 | §8.2 B 组（31 用例） | 覆盖。B1/B19 标量、B3/B17/B18 中间缺失、B5/B11/B20 越界吸收、B22–B27 非下钻终态、B28–B30 detached；两态极性成对（SA6 §12.3 全表核对无缺行） |
| AC3 XML：穿越不可下钻终态两态 / 指向终点比投影值 | §8.2 C 组（7 用例） | 覆盖。C4–C7 穿越（`read.ts` L106–107）、C1/C2 终点投影比较（L351–352 `toString()` 语义字符串；X0 证据）、C3 absent 对字符串不满足 |
| AC4 数组下标段纪律（number 位置读取、同 mutation path） | §8.2 D 组（15 用例） | 覆盖。D1/D2/D9/D12/D13 位置读取四种载体；D3/D13 `-0` 归一；D4–D7/D10/D11 段型纪律；D8 越界吸收；D14/D15 值域边界沿读面（非形状错误） |
| AC5 `set([])` legacy 先过 guard：不满足零写入 / 满足走 legacy | §8.2 E 组（7 用例） | 覆盖。E1/E6/E7 不满足零写入（M3 盲区增量锚）；E2/E3 满足走完整清空重装（E3 省略可选键证明非合并）；E4/E7 评估先于 schema 校验 |
| AC6 大子树结构比较 | §8.2 F 组（4 用例）+ A14（24 层深） | 覆盖。宽（64 键/256 元素）由 F1–F4，深由 A14；万层级深经 SA6 §9.3 裁定为非 AC 边界，排除正当 |
| AC7 批量顶层 guard 与单操作同语义 | §8.2 G 组（12 用例，G1–G12 与单操作配对声明） | 覆盖。实现位点核实（`prepareBatchMutation` G 段 L287–292 先于逐操作 prepare L293–304，恰一次评估） |
| AC8 按既有组织方式落位 + 根 typecheck + doc-runtime 测试通过 | §7 D1–D8、§11、§12 | 覆盖。落点/门命令与 SA6 §12.1 逐字一致；组织惯例与 `issue-347` 实测对齐（见 §10） |
| 「以 ADR 0025 为准修正实现」（issue 正文条件句） | §13.3 有界条件修正路径 | 覆盖。触发器、允许面、SA8 冻结面禁区、回退动作齐备 |

未发现目标静默扩大或非目标侵蚀：词表封闭、错误域形状、wire/schema/持久化/生命周期面全部冻结（§1 非目标与 SA6 §10/§12.12 一致）。

## 4. Owner评论覆盖

Issue 评论经 REST 读取：**无**。无 Owner 要求、无 override 授权在册，映射表为空。设计 §4 同口径陈述，无遗漏。

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 §5：HEAD 92/92 与 ADR 0025 一致、修正范围 ∅ | §1/§3/§11 主范围 = 纯测试新增；不为「以防万一」预留生产改动 | 落实；与 issue「以测试为主」一致 |
| SA6 §9.2：M2（-0/0）与 M3（set([]) 跳 guard）下既有 447 用例全绿（盲区） | §3/§8.2 把 A1/A1b/A8/A12/G6 与 E1/E6/E7 标注为不可替代增量锚 | 落实；反伪绿证据链完整（M1 13 例/M2 5 例/M3 3 例/M4 3 例 DEV 击穿数与 SA6 逐字一致） |
| SA6 §7：4 轮 92/92 无 flake；两处不符均为探针自身缺陷 | §9 测试自身全同步、无定时器/并发/真实时钟 | 落实 |
| SA6 §9.3 边界观察 A15/Z1–Z3/D14–D15 非 AC、不请求修正 | §1 非目标排除 + §13.4 残余问题登记 | 落实；D14/D15 的「非形状错误」由 absent 满足即可锚定（B8/B10/D15 满足态 + B7/B9 稳定码拒绝态，两极均有） |
| SA8 冻结面（§4 八项）：稳定码字面量、不满足 issue 形态、形状错误族、谓词词表、单操作无 guard 逐字节契约、公共导出集、评估位置与次序、`set([])` 管线归属 | §6/§8 只断言现值；§13.3 第 2 条列全部禁区 + 触碰即回 SA8 | 落实；条件性入口界定清晰，本票既定面零触碰 |
| SA8 §8 第 3 条：修正触及 mutation/read 契约 → 追加根 `pnpm test` | §12 条件门 | 落实（与 `packages/doc-runtime/AGENTS.md` Verification 一致） |
| SA8 §7 前置：#347（61e2daa）与 #350/ADR 0026（1b55d5c）已落地 | §2.1 锚点直接消费公共入口 | 核实：`git log` 两提交在库；`namespace-runtime/src/write.ts` L24 `applyValidatedMutation` 导入在案 |
| ADR 0025 L48 评估位置（解析后、分叉前、先于 schema、纯读不进事务） | §2.1 表逐行锚定（mutation.ts L173–178/L182、L287–292） | 逐行核实无误（实测 L175–178 在 L182 `isRootReplace` 分叉前；两评估点均在 `transactGuarded` 之外） |
| ADR 0008 L23 缺键/越界吸收、L26 XML 终态 | §2.1 read.ts 锚（L79/L85/L94/L101/L106–107/L351–352） | 逐行核实无误 |

## 6. 设计内部一致性

核对项与结果：

| 检查 | 结果 |
|---|---|
| §2.1 全部源码行号锚点（mutation.ts L130–158/L160–213/L173–178/L182/L223–307/L287–292/L293–304/L535/L540–552/L589–593/L594–642/L644–683/L711–718/L722–729/L731–737；read.ts L26–27/L44–46/L53–135/L79/L85/L94/L101/L106–107/L112–113/L116–117/L247–248/L341–344/L351–354；index.ts L23/L24–33） | **全部命中**，与源码逐行比对无偏差（含 `GUARD_SUMMARY_LIMIT=256`、`resolveNode` L535 共享消费点） |
| §8.1 fixture TEXT 与 SA6 §12.0 | 逐字相同；`YPlainArray<YLeaf<string>>`/`YXmlFragment<{p:string}>`/类型别名前置有 `domains/vfs3-assets/schema.vfsl` L19/L23 先例；`free: unknown` 合法（`packages/vfsl/src/derived.ts` L51 scalar 词表含 `'unknown'`） |
| 用例计数 | 16+31+7+15+7+4+12=92 ✓；447+92=539 ✓；doc-runtime/test 实测 26 `.test.ts` + 2 `.test-d.ts` = 28 files（SA6 基线口径）→ 29 ✓ |
| §8.2 与 SA6 §12.2–§12.8 用例表逐行比对 | 用例 ID、语义类别、极性全部一致；**发现 R1**：设计各组 fixture 变体枚举不完整（A 组漏 A1/A1d 的 `doc n:0`、A8 的 `values:[1,0,3]`；G 组标「标准」漏 G6 的 `doc n=0`；E 组未写 E5 的合法全量快照 value）——前言已声明以 SA6 表为准，故为文档级不一致而非契约缺口（详见 §13 R1） |
| §2.2/§5 与 §8.2 B28–B30 措辞 | **发现 R2**：「即使内容字面相等也不满足」超出 §8.1 自定 fixture（空 `new Y.XmlFragment()`，无可比内容）的锚定能力；区分锚实为 B28（详见 §13 R2） |
| §2.3 既有锚引注 | `issue-347` 实测 41 it ✓、759 行 ✓、助手 L54–167 ✓；区间记法漏 M6b（N1，非阻断） |
| §7 决策互斥性 | D1–D9 备选否决理由与正文自洽；D6 `expectCommitted` 签名与 `watchWrites` 返回型（`{txs:{count};updates:Uint8Array[]}`）一致；§11 DENY 与 §13.3 条件开放不冲突（DENY 行内已注明唯一例外入口） |
| §12 验收映射 vs §8.2 | 逐 AC 行对应，无死引用；§12 条件门与 §13.3 第 4 条闭环 |

## 7. 状态机与并发攻击

本设计无新增运行时状态机（测试唯一交付物）。攻击面落在测试对既有状态/时序的观察口径上：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| S1 | 活动文档、guard 信封待评估 | 评估与事务的相对次序 | guard 评估纯读、不进事务、零事件；不满足零事务零 update | 无缺口：mutation.ts L175–178/L289–292 实测位于 `transactGuarded`（L141/L147）之前；§2.2 断言口径（0 事务/0 update/字节不变三件套经 `expectZeroWrite`）可观察区分 | 无 |
| S2 | B22–B30 直造载体 fixture（`root.set` 直接改文档） | 观测器挂接次序 | `watchWrites`/字节快照必须在直造之后、`run` 之前，否则把 fixture 构造计入事务计数 | 无缺口：§8.1 明示「`fixture()` 后 `fx.root.set(…)`」，助手按 #347 同款语义（`expectZeroWrite(fx, watch, before)` 以调用方传入 `before` 为基准）；read 系列测试 L272–283 同款先例 | 无 |
| S3 | 同文件 92 用例 | 用例间状态泄漏 | 每 `it` 独立 `fixture()` + 独立 `Y.Doc`，无跨用例共享 | 无缺口：D7 明示；#347 同款；`vitest.config.ts` L17 `maxWorkers: 1` 实测在案 | 无 |
| S4 | 写序列器并发面（多写者竞争 guard 读到的 committed 值） | 并发场景 | 原子性归序列器 FIFO（ADR 0008 L40–51），非本票新增面 | 无缺口：§9 明示由既有 `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts`（实测存在）与根套件覆盖；矩阵不加并发面 | 无 |
| S5 | 批量双 op 满足态 | 单事务原子提交 | 恰 1 本地事务 + 1 update、两 op 全落盘 | 无缺口：mutation.ts L141–143 单 `transactGuarded` 包全部 `commitPrepared`；§8.2 G 组断言与实现一致 | 无 |
| S6 | 重复事件/迟到回调/进程重启 | — | 本地同步 API + 只读断言，无该面 | 不适用（无新增异步/持久化面） | 无 |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E1 | guard 形状错误（A13 `equals:undefined`） | 无码单 issue + 零写入三件套（`expectShapeError`，#347 S10 同源） | 低：parseGuard L664–666 实测拒绝该形态；断言含 `code===undefined` 防伪绿 | 无 |
| E2 | 评估不满足（读失败/值不符） | 稳定码 + `path`=`toEqual(guard.path)` 新鲜副本 + 零写入三件套 | 低：与公共导出同源断言（#347 P2 同款）防字面量漂移 | 无 |
| E3 | detached 载体静默投影（假设性回归） | B28（absent 满足）为区分锚：静默投影 `''` 会令 absent 不满足而红 | 低：`read.ts` L247–248/L341–344 是冻结契约分支且触碰须回 SA8；矩阵 B28 已锚 | 无（措辞问题见 R2） |
| E4 | 读面栈溢出收编为 `PATH_NOT_ALLOWED`（Z3）→ absent 放行写入 | SA6 §9.3 裁定为 ADR 0025 L43 字面一致、非 AC 项；设计排除出矩阵 | 无（受控 schema 写路径不可产出该形态；不伪降级、不掩盖——设计明示登记为残余问题 §13.4） | 无 |
| E5 | 实现期意外红灯（探针与正式测试口径差） | §13.3 有界条件修正路径：允许面、禁区、`logicalValuesEqual` 共享约束（L535 `resolveNode` 消费在案）、回 SA8 触发器 | 低：fail-loud 且有回退动作，不允许票内静默改契约 | 无 |
| E6 | equals 侧非 JSON 输入（循环/万层深/原型链） | fail-closed 零写入（Z1 E205/Z2/A15 mismatch）；非目标、不请求修正 | 无：不以后续 fallback 掩盖——语义未定义面显式登记为独立决策入口 | 无 |

正常路径不变量（满足 = 恰 1 事务 + 1 update + 落盘值）在 §2.2/§8.0 成文且由 `expectCommitted` 集中编码，无伪降级。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `applyValidatedMutation` 生产调用方（namespace-runtime 写槽） | 无——设计零生产改动，结果联合/导出面冻结 | `packages/namespace-runtime/src/write.ts` L24 导入在案；§10 调用方矩阵与源码一致 | 无 |
| `MUTATION_GUARD_MISMATCH` 公共导出 | 无——N-E 经 `public-surface-guard.test.ts` 引用保持 + `expectGuardMismatch` 内同源断言（#347 P2 同款一行成本） | index.ts L23 实测导出；#347 L131–149 助手同源断言先例 | 无 |
| 既有测试基线（#347/#350/public-surface 等 28 files/447 tests） | 无——DENY LIST 禁改；AC8 门整目录运行使其充当 N-A/N-E 载体 | §11 DENY 表；vitest include 全目录 | 无 |
| 根 vitest 发现新文件 | 无——include `packages/*/test/**/*.test.ts`（vitest.config.ts L15 实测）覆盖冻结落点；SA6 §14 runner-trigger 已证 | §10 行 3 | 无 |
| 根 `pnpm typecheck` 覆盖新文件 | 无——doc-runtime tsconfig include `test/**/*.ts` 实测；typecheck 脚本含该包（package.json L13） | §10 行 4 | 无 |

无未覆盖调用方；无返回值/抛错/nullable/异步时序/取消/生命周期变化。

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| guard 语义可执行锚 | doc-runtime 测试（Seam 1） | `packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts` | 正确：与 ADR 0025 L90/issue 定位一致；不触碰 namespace-runtime/诊断面（ADR 0025 L60 透传面零改动） |
| 语义权威 | ADR 0025 + SA6 §12 用例表 | 设计只做组织与覆盖计划，输入细目显式引 SA6 表 | 正确：无第二语义源（唯一漂移点即 R1 的枚举不完整，已列修订） |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 每 issue 单测试文件 | `issue-237-*`、`issue-347-*`、`issue-350-*`（实测在库） | D1 单文件 | 一致 | #350 多文件为 SA7 增补特殊产物，设计已诚实标注 |
| 自包含 fixture + 内联助手 | #347 L46–167（实测 `derivedOf`/`baseSnapshot`/`fixture`/`run`/`bytes`/`taskEntry`/`watchWrites`/`expectZeroWrite`/`expectGuardMismatch`/`expectShapeError`）；test/ 目录无任何共享 helper 文件（实测） | D2/D6 同款内联 + 新增 `expectCommitted` | 一致 | 新助手是满足态口径集中化，非平行机制 |
| 直造载体 fixture | `read-logical-value-at-path-schema-independent.test.ts` L272–283（`root.set('badNested', {ok:1, ys:new Y.Map()})`、`root.set('textVal', new Y.Text('hi'))` 实测先例） | §8.1 变体表（Y.Text/空 XML/Date/plain 内嵌 detached） | 一致 | 同款构造手法、同款契约分支（read.ts R2 #2） |
| 用例 ID 入 `it` 标题 + 文件头引 ADR 行号 | #347 全文风格 | D3/D8 | 一致 | D8 并正确禁止照抄「HEAD 红」段（HEAD 无红灯，抄写即虚构——反伪造纪律） |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 用例输入/期望 | SA6 §12.2–§12.8 表 | 设计 §8.2 组织层摘要 | 低：前言显式声明权威归属；R1 的枚举不完整是该风险的已识别实例，修订后消除 |
| fixture 文本 | SA6 §12.0（冻结） | 设计 §8.1（逐字相同，实测比对） | 无 |
| 语义规范 | ADR 0025/0008 | 测试断言（只观察现值） | 无（断言不得定义语义——D7 禁源码文本断言） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 每 `it` 自建 `Y.Doc` + `watchWrites` 挂观测器 | 文件内无显式卸载；#347 同款，vitest 每 worker 进程隔离 + `maxWorkers:1` | 测试失败即红，无清理路径需求 | 无缺口（测试进程生命周期归 runner；无跨用例可变状态——D7） |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 共享 helper 模块 | 无（test/ 目录实测无非测试 .ts） | D2 明确不引入 | 无重复 |
| 第二 fixture 体系 | #347 fixture | D2 严格超集（既有字段逐字段同形，仅增不改——与 #347 TEXT 实测比对属实：n/a/values/more 同形，tasks 增可选 `tags?`、新增 t3/body/blob/free） | 无重复 |
| 配置改动 | vitest.config.ts include 已覆盖 | §11 DENY 配置零改动 | 无重复 |
| 第二错误域/词表 | ADR 0025 L53–58 两态 | 只断言、不改变 | 无重复 |

阻断项检查（错误 Owner/绕过既有能力/双事实源/生命周期不对称/无迁移方案的异协议）：**均未触发**。

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW：新测试文件 + 设计产物自身，共 2 项 | 与正文涉及的全部落点一致；无第三路径被引用 | 无 |
| DENY：`mutation.ts`/`read.ts`/`index.ts`/既有测试/跨包/ADR/配置 | 行内已注明 §13.3 唯一条件例外入口；与 SA8 冻结面表逐项对应 | 无 |
| ALLOW 无无理由扩张 | §13.3 条件开放 `mutation.ts` guard 专属逻辑有 SA6 §12.11.2 依据并附禁区清单；主范围仍为 ∅ | 无 |
| follow-up（§13.4 A15/Z 系、词表演进） | 均为独立决策入口（ADR 0025 L94 路径），未掩盖本票必要项 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC7 每条有可执行验收 | A–G 组 92 用例，断言观察结果联合/活动值/事务与 update 计数/字节快照（非源码文本） | 无（D7 机械禁令 + SA6 §12.0 判决契约冻结） | 无 |
| 非重言式（防只断言现状） | SA6 §9.2 变异敏感度：M1–M4 全击穿（13/5/3/3 例），M2/M3 为既有套件盲区增量锚 | 无 | 无 |
| 「旧实现真实为红」适格性 | 本票为**目标绿回归矩阵**——能力已由 #347 红灯落地（SA6 §13 明文）；设计 D8 禁止伪称红灯 | 无：反伪造口径正确，避免把「未实例化」虚构成「HEAD 红」 | 无 |
| 错误路径伪绿风险 | 不满足 = 稳定码 + path + 零写入三件套；形状错误 = 无码 + 零写入；absent 对有值（含 `''`，B25/C3/E6/G3）不满足的反极性成对 | 无 | 无 |
| 回归/并发/重启场景 | 回归 = 整目录门 + 既有 447 基线保持；并发 = 既有序列器竞争测试（引用保持）；重启 = 本地同步 API 无该面 | 无 | 无 |
| 测试落在真实入口 | vitest include L15 实测覆盖冻结落点；SA6 §14 runner-trigger 探针在案；typecheck 含 `test/**/*.ts` 实测 | 无 | 无 |
| 计数确定性自查锚 | 29 files / 539 tests（D3 1:1 映射 + ID 清单冻结） | 无（算术核实） | 无 |
| 条件门完整性 | 修正触及 mutation/read 契约 → 追加根 `pnpm test`（AGENTS.md Verification 一致） | 无 | 无 |

## 13. Required revisions

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
|---|---|---|---|---|---|
| R1 | MINOR | 设计 §8.2 A 组「fixture：标准（A12 用…、A1b 用…、A14…）」、G 组「fixture：标准」、E 组「E1–E4/E7 的 value 为…」；SA6 §12.2 A1/A1d 行首「doc `n:0`」、A8「doc `values:[1,0,3]`」、§12.8 G6「（doc n=0）」、§12.6 E5 需 schema 合法全量快照 value | 各组 fixture 变体枚举不完整且括号列举呈穷举貌：按「标准」落 A1/A1d/G6 会得到 mismatch 而非预期 `ok:true`（响亮失败、可恢复）；若实现者为转绿翻转期望极性，将直接废掉 A1/A1b/A8/A12/G6 这组 M2 盲区增量锚（§3 缺口链的核心证据） | §8.2 各组把 doc/guard 前置条件与 value 规格补全（A1/A1d `baseSnapshot({n:0})`、A8 `baseSnapshot({values:[1,0,3]})`、G6 同 A1、E5 value=合法全量快照），或改写为「括号仅为示例，变体一律以 SA6 §12.2–§12.8 表行首前置条件为准」的显式非穷举声明 | 设计 §8.2 与 SA6 §12.2–§12.8 逐行核对后：A1/A1d/A8/G6 的 doc 前置条件与 E5 的 value 在设计文本中可见或被显式委派，无「标准」误导残留 |
| R2 | MINOR | 设计 §8.2 B 组「detached loud 拒绝禁止静默投影（B28–B30，即使内容字面相等也不满足）」；§8.1 变体表构造为空 `new Y.XmlFragment()`（无可比内容；never-integrated 类型不可先集成再改内容） | 措辞超出 fixture 锚定能力：B29/B30 在「静默投影」假设回归下与 loud 拒绝同判（空投影 `''` ≠ 期望值 → 均 mismatch），本身不区分两行为；真正区分锚是 B28（absent 满足：静默投影 `''` 会使 absent 不满足而红） | 删去或改写该短语（如「B28 为 loud 拒绝的区分锚；B29/B30 锚读失败路径上 equals 的 M1 敏感性」），不要求构造内容相等 fixture | §8.2 B 组描述与 B28–B30 断言口径一致，设计无超出 fixture 能力的主张 |

无 BLOCKER / MAJOR。R1/R2 为实现前应修的文档级修订，不构成实施安全风险（R1 错误落法响亮失败且权威表在册；R2 不影响断言本身）。

## 14. Non-blocking observations

| # | 观察 | 说明 |
|---|---|---|
| N1 | §2.3 引 #347 用例清单区间记法「G1–G9/M1–M10/O1–O3/S0–S11/N1–N4/P1–P2（41 用例）」漏 M6b | 区间和为 40；文件实测 41 个 `it`（M6 与 M6b 并存）。纯引注精度，不影响任何结论 |
| N2 | D6 助手枚举未列 `baseSnapshot`/`taskEntry`/`guardIssues` | 三者在 #347 实有（L68/L99/L104 附近）且 §8.1/§8.2 自用；D2 已覆盖 `baseSnapshot`，落码时按 #347 全套内联即可 |
| N3 | `expectCommitted`（ok + 1 事务 + 1 update）不含落盘值断言 | 设计已明示落盘值逐用例内联；建议实现时每个满足态用例至少携带一条落盘值断言（§8.2 多数行已含，如 `n=2`、`taskEntry(fx,'t1')`、`values` toJSON） |
| N4 | C2 的 message 辅助断言 `toContain('<p>hi</p>')` 依赖摘要 JSON 含实际值 | 成立：`summarizeLogicalValue` 用 `JSON.stringify`（`'<p>hi</p>'` 序列化为 `"<p>hi</p>"`，包含断言子串）；主断言仍是判决契约，符合 D7「文案仅辅助」 |
| N5 | E4 的 `类型不匹配` 文案锚 | 经核实存在于 `packages/vfsl/src/validate.ts` L462（`类型不匹配：期望 ${t.type}，实际 …`），且 #347 O1/M7 已有同款 `not.toContain` 负向用法先例；次级断言可行 |
| N6 | B25「空 XML 终点投影 `''` 属有值」的极性归属 | 设计 §5 已正确把它标注为 N-C 正极性反例（非负控失败），与 SA6 §6 注一致，无「绿灯即通过」误读风险 |

## 15. 评审方法与边界声明

- 本评审只读取证据：未修改设计/生产代码/测试，未运行任何测试或探针，未启动服务；全部源码行号、配置、ADR 行号、测试惯例均经静态逐行核对（见 §1）。
- 运行时观察（92/92、M1–M4 变异、X0/A1c、消息长度 594/593）引自 SA6 契约的实测记录，本评审核对其内部一致性与与静态源码的相容性，不重复执行。
- `pass`（approve）仅表示设计通过审查；实现与活链路验证仍归 SA4/SA7/后续流程。
