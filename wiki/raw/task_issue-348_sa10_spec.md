# SA10 独立 Spec 审查 — issue #348 条件写语义矩阵补全：深相等、读失败路径、XML 与 set([])（guard II）

| 项 | 值 |
|---|---|
| 审查对象 | 已提交最终 diff：commit `1bb6f32`「test(doc-runtime): cover guarded mutation semantics matrix」（分支 `mabf/issue-348`，基于权威父 PR #346 head `61e2daa`（adr0025-guarded-mutation）；工作区仅 Host brief `wiki/raw/task_issue-348.md` 未跟踪） |
| 审查基准 | issue #348 正文 + AC1–AC8（`wiki/raw/task_issue-348.md`）；SA6 验收契约 `wiki/raw/task_issue-348_sa6_contract.md`；ADR 0025（已接受）「评估语义/位置/错误域/组合」节；ADR 0026/0007/0008/0016 适用条款；SA8 前置门禁（clear，requiresConflictRecheck=false）；SA2（approve，2 MINOR）/SA4（approve）在册 |
| Owner 评论 | 无（dispatch 与 SA6 §2/SA8 §1 同口径：REST 读取为零评论）——无额外映射义务、无 override 在册 |
| 审查方式 | 静态审查（SA10 纪律：不运行测试、不改代码/设计/测试）；92 用例逐 ID 与 SA6 §12.2–§12.8 全表比对；断言与生产源码（mutation.ts/read.ts/index.ts）逐条静态核对；动态门证据（92/92、29 files/539 tests、typecheck exit 0）引自 SA3 报告记录并与 SA4 静态复核交叉核对 |
| **Verdict** | **approve**（AC1–AC8 全达成；无 unmet/partial/unachievable 项；无 scope creep；§8 三项 MINOR 观察均不阻断） |

---

## 1. Diff 范围核对（无 scope creep）

`git diff 61e2daa..HEAD --stat` 实证：恰 8 个新增文件、零删除、零生产改动。

- **交付物**：`packages/doc-runtime/test/issue-348-guard-semantics-matrix.test.ts`（新建，1086 行）——SA6 §12.1 冻结落点，issue 正文自述「本票以测试为主」的唯一交付形态。
- **wiki 证据文书 7 件**：sa6_contract / conflict_report / relevant_decisions / design / sa2_review / sa3_impl / sa4_review。父 commit `61e2daa`（#347）同样将 SA 文书随票提交（含 `task_issue-347_sa10_spec.md` 等 11 件）——仓内既有惯例，非 creep。
- **生产面零改动**：`packages/doc-runtime/src/mutation.ts` / `read.ts` / `index.ts`、namespace-runtime、vfsl、persistence、apps、domains、`docs/adr/**`、`CONTEXT.md`、`vitest.config.ts`、`package.json`、tsconfig、`pnpm-lock.yaml` 全部不在 diff 中——SA6 §12.11.1「修正范围 ∅」裁定在最终交付中保持成立（92 用例首次运行全绿，issue 正文「以 ADR 0025 为准修正实现」条件句未触发，设计 §13.3 条件修正路径未启用）。
- **DENY 面核对**：`issue-347-guard-envelope-red.test.ts`（N-A 负控基线）与 `public-surface-guard.test.ts`（N-E 公共面审计）原样未动（diff stat 实证），引用保持成立。

## 2. Issue AC 逐条核对

用例计数机械核验（grep 实测）：`it(` = 92、`describe(` = 7、组内 16/31/7/15/7/4/12，与 SA6 §12 用例权威逐 ID 相同（A1/A1b/A1d/A2–A14；B1–B25/B25b/B26–B30；C1–C7；D1–D15；E1–E7；F1–F4；G1–G12）。

| AC | 实现落点（committed 测试） | 判定 |
|---|---|---|
| AC1 深相等细节：嵌套 plain object/array、undefined 键过滤（`{a:1}` ≡ 显式 `a:undefined`）、`-0` ≡ `0` | A 组 16 例：A2/A9/A10/A14 嵌套结构（A14 程序化 24 层）；A5 幽灵 undefined 键过滤、A6 缺键≡显式 undefined（t3 缺可选 `reviewer`）、A7 键完整非子集负控；A1/A1b（含 `Object.is(n,-0)` 保号前置，落实 SA6 A1c 证据）/A8/A12 四向 `-0`/`0`；A3↔A4 数组顺序敏感成对 | ✅ met。与 `logicalValuesEqual`（mutation.ts L540–552：`===` 首判 ⇒ `-0===0` 为 true；数组逐位递归；plain 对象 undefined 键过滤 + 键数相等）逐条对齐，亦即 ADR 0025 L42「结构深相等、undefined 键过滤」的可执行化 |
| AC2 读失败路径：穿越标量/非下钻终态 → equals 不满足/absent 满足；中间缺失与越界按缺席吸收 | B 组 31 例：B1/B2 标量穿越、B3/B4 中间容器缺失（缺键吸收）、B5–B10 Y.Array 越界/负下标/非整数下标、B11/B12 plain array 越界、B14–B16 null 穿越 vs null 终点（B16 `equals:null` 满足——null 是合法值）、B17/B18 plain 缺键、B19 布尔穿越、B20/B21 失败先于后续段、B22–B24 Y.Text、B25/B25b 空 XML 终点 `''` 属有值（absent 不满足 / equals `''` 满足）、B26/B27 Date 不可下钻、B28–B30 detached 载体 loud 拒绝 | ✅ met。极性与 `evaluateGuard`（L711–718：absent ⇔ `!read.ok \|\| value===undefined`；equals ⇔ `read.ok && logicalValuesEqual`）逐条一致；直造载体变体（Y.Text/空 XML/Date/detached）有 read 系列测试同款先例，锚定的是 read.ts 显式契约分支 |
| AC3 XML：穿越不可下钻终态两态；指向 XML 终点与投影逻辑值比较 | C1 `['body']` equals `'<p>hi</p>'` 满足（X0 口径：投影值即 `toString()` 语义字符串）；C2 反极性 + message 含实际摘要（次级辅助断言）；C3 absent 不满足；C4/C5（string 段）与 C6/C7（number 段）穿越两态 | ✅ met，与 ADR 0025 L44 / ADR 0008 L26 逐字对应 |
| AC4 guard 路径 number 段按数组位置读取、段纪律同 mutation path | D1/D2/D9/D12 四种载体位置读（Y.Array/嵌套 Y.Array/plain array/YPlainArray）、D3/D13 `-0` 归一、D10 下标段+键段混用、D4–D7/D11 段型不符=读失败（非形状错误）、D8 index==length 越界吸收、D14/D15 值域边界段（`MAX_SAFE_INTEGER+2`/`NaN`）非形状错误 | ✅ met。`parseGuard`（L673–677）仅查段型 string\|number 的源码事实与「值域边界沿读面」的断言口径一致；段纪律与 ADR 0007 L29 一致 |
| AC5 `set([])` legacy 全量替换同样先过 guard：不满足零写入、满足走 legacy | E1 不满足零写入三件套 + `n` 保持 4711（M3 盲区增量锚）；E2 满足后 ROOT 全等新快照 + 恰 1 事务 1 update；E3 省略可选 `reviewer` → `has('reviewer')===false`（证明清空重装非合并）；E5/E6 absent 两极；E4↔E7 次序对照（schema `类型不匹配` 消息与 guard 稳定码互斥出现） | ✅ met。源码实证 guard 评估位点 L175–178 位于 `isRootReplace` 分叉（L182）之前，legacy 管线归属（ADR 0007 L93–96）不变 |
| AC6 equals 对大子树结构比较可用（投影值 vs 手写期望结构） | F1 64 键 Record 整树、F2 256 元素数组整树满足；F3/F4 同规模单元素/单键差异 → 不满足 + `message.length < 4096`（截断防爆）；深度方向由 A14 覆盖 | ✅ met。`GUARD_SUMMARY_LIMIT=256` 单侧截断 + 模板（L731–737）使上界静态可证 |
| AC7 批量形态 `{ ops, guard }` 顶层 guard 语义与单操作一致 | G1–G12 固定 ops（`set tasks.t1.status` + `array-insert values@1 [9]`），标题内标注单操作配对 ID（G1↔A2、G4↔C4、G6↔A1、G10↔E7/O1 等）；满足 = 两 op 全落盘 + 恰 1 事务 1 update；不满足 = 恰 1 issue（无聚合）+ 稳定码 + path=guard 路径 + 零写入 | ✅ met。源码实证批量 G 段 L289–292 先于逐操作 prepare L296–304，恰一次评估（ADR 0025 L74 / ADR 0026 L53–55） |
| AC8 按 doc-runtime 既有 mutation 测试组织方式落位；根 `pnpm typecheck` + doc-runtime 测试通过 | 单文件冻结落点；自包含 fixture（`TEXT` 与 SA6 §12.0 冻结文本逐字相同，实测比对）；#347 同款内联助手（`watchWrites`/`bytes`/`expectZeroWrite`/`expectGuardMismatch`/`expectShapeError`）+ `expectCommitted`；7 个平铺 describe 按 AC 序、用例 ID 入 `it` 标题首 token；文件头 doc-comment 引 ADR 行号 + 契约用例 ID + 目标绿声明（未照抄 #347 红灯段，HEAD 无红灯未虚构） | ✅ met。可发现性静态可证：根 `vitest.config.ts` L15 include `packages/*/test/**/*.test.ts` 覆盖落点；`packages/doc-runtime/tsconfig.json` include `test/**/*.ts` 纳入根 `pnpm typecheck`（package.json L13 含该 tsconfig）。门结果引自 SA3 记录：92/92 首跑全绿、doc-runtime 29 files/539 tests、根 typecheck exit 0（SA10 纪律不复跑，见 §8 观察 2） |

## 3. ADR 0025 条款核对

| 条款 | 核对结果 |
|---|---|
| L42 `equals` 与投影逻辑值结构深相等（undefined 键过滤；比较对象 = `readLogicalValueAtPath` 投影值） | ✅ A 组 + C1 + F 组全部以投影值为比较对象；实现 `evaluateGuard` L715 字面兑现 |
| L43 `absent`：读失败（`PATH_NOT_ALLOWED`）或投影 undefined（缺键吸收）均满足 | ✅ B 组两态 31 例全覆盖（含空 XML `''` 属有值、null 终点属有值的反直觉边界） |
| L44 guard 路径段纪律同 mutation path；穿越 XML → 读失败两态；指向 XML 终点比投影值；路径禁 `[]` | ✅ C 组 + D 组兑现；`[]` 禁令属 #347 形状族既有锚（S 组），本票未重复亦未违反 |
| L48–51 评估在解析后、局部/legacy 分叉前、先于 schema 校验、纯读不进事务；`set([])` 同样生效 | ✅ E4↔E7、G10 以消息互斥锚定次序；零写入三件套（字节快照 + 0 事务 + 0 update）在全部 32 个拒绝用例强制 |
| L53–58 错误域两态：形状错误无码不可重试；不满足单 issue、稳定码 `MUTATION_GUARD_MISMATCH`、`issue.path`=guard 路径、message 截断摘要可重试 | ✅ `expectShapeError`（A13）/`expectGuardMismatch`（31 调用点）集中编码；稳定码双断言（字面量 + 与 `ns.MUTATION_GUARD_MISMATCH` 公共导出同源，#347 P2 同款）；F3/F4 锚 message 有界 |
| L72–74 guard 适用双形态顶层；批内元素禁 guard；批量下评估次序不变 | ✅ G 组兑现顶层批量形态；批内元素禁令属 #347/#350 既有锚（本票不重复，N-A 引用保持面内） |
| L60/L62–66 边界（诊断透传、只约束受控写、跨实例约定级） | ✅ 本票不触碰这些面（零生产 diff），无违反 |

文件头 doc-comment 所引 ADR 0025 L42–44/L48–51/L53–58/L72–74、ADR 0026 L29/L53–55、ADR 0008 L23/L26、ADR 0007 L29/L93–96 经抽核与原文相符（SA2 已逐行 sed 验证，本轮抽核 0008 L23/L26、0007 L29/L93–96 命中）。

## 4. SA6 验收契约核对

- **§12.0 判决契约三态**：满足（`expectCommitted` = ok:true + 恰 1 本地事务 + 恰 1 update + 逐用例落盘值断言——59 个满足态用例全部携带落盘断言，落实 SA2 N3）；不满足（`expectGuardMismatch` = ok:false + 恰 1 issue + 稳定码同源双断言 + `path` toEqual guard 路径 + 零写入三件套）；形状错误（`expectShapeError` = 无码 + 恰 1 issue + 零写入）。✅
- **§12.2–§12.8 用例权威**：92 ID 1:1，输入前置条件（A1/A1d `n:0`、A1b `n:-0`、A8 `values:[1,0,3]`、A12 `free:{z:0}`、G6 `n:0`、E5 合法全量快照）逐条落码——SA2 R1（MINOR）已在文件头 L38–40 显式声明「非穷举枚举，前置条件以 SA6 表为准」并逐条落实；SA2 R2（detached 措辞）已改写为「B28 是 loud 拒绝区分锚、B29/B30 锚 M1 敏感性」，B28 用 absent 满足 + 落盘、B29/B30 用 equals 不满足，无超出 fixture 能力的主张。✅
- **§12.9 负控**：N-A/N-E 引用保持（#347 N1–N4 与 public-surface 文件零 diff，仅 `expectGuardMismatch` 内保留一行导出同源检查）；N-B（A1↔A1d、A3↔A4、A5/A2↔A7、A9↔A11、F1/F2↔F3/F4）/N-C（读失败 absent 满足 ↔ B25/C3/E6/G3 有值不满足）/N-D（E4↔E7、G10）内嵌成对。✅
- **§12.11 修正范围裁定**：∅ 在最终交付中保持（生产三文件不在 diff；SA6 §16 冻结 sha1 未被触碰——diff stat 实证）。✅
- **§13 非红灯声明**：文件头明示目标绿、不伪称红灯，并引 §9.2 M1–M4 变异敏感度作反伪绿证据。✅
- **§9.3 边界排除**（A15/Z1–Z3/D14–D15 非 AC 项）：矩阵未纳入这些非 AC 边界作修正请求；D14/D15 仅以 absent 满足锚「非形状错误」现值，与裁定口径一致。✅

## 5. 测试质量（反弱化机械核对）

- `grep -nE '\.skip|\.only|\.todo|process\.env|as any|console\.'` = **0 命中**（实测）。
- 全部断言观察运行时行为：结果联合、活动 Y.Doc 值、事务/update 事件计数、`Y.encodeStateAsUpdate` 字节快照；无源码字符串/正则断言；message 文案仅次级辅助（C2/E4/E7/G10/F3/F4，均注明辅助且主断言为判决契约）。
- 每个 `it` 独立 `fixture()`，无跨用例共享可变状态；全同步、无定时器、无真实时钟。
- B22–B30 直造载体构造均位于 `watchWrites`/`bytes` 之前（次序纪律落实，逐例核对）——零写入基线为「post-setup」状态，口径正确。
- 无成对合 `it`、无嵌套 describe、无重复 #347 负控——设计 D3/D4/D5 逐字兑现。

## 6. 上游义务与冻结面核对

- **SA8 §4 冻结面 8 项**（稳定码字面量、不满足 issue 形态、形状错误族、谓词词表、单操作无 guard 逐字节契约、公共导出集、评估位置与次序、`set([])` 管线归属）：矩阵只断言现值、零生产 diff，全部未触碰；无回 SA8 复核触发。requiresConflictRecheck=false 维持。✅
- **前置**：`Blocked by #347`（61e2daa）与传递前置 #350/ADR 0026（1b55d5c）在父链在册；本 commit 基于权威父 head `61e2daa`（dispatch 指定），基点正确。✅
- **SA2 MINOR（R1/R2）**：均已落实（§4）；N1–N6 观察亦逐条响应（SA3 报告在案）。✅
- **SA4 approve 前置**（生产修正范围 ∅、DENY 面零触碰）：在最终 committed diff 中保持成立。✅
- **doc-runtime AGENTS.md**：公共面只经 `src/index.ts`（未改）；mutation/read 契约无变化 ⇒ 根 `pnpm test` 条件门未触发（SA8 §8 第 3 条口径）。✅

## 7. PR 必须披露的未达成项

**无。** AC1–AC8 全部 met；无 unmet/partial/unachievable；无 Owner 要求遗漏；无 scope creep。

## 8. Non-blocking observations（不阻断 approve）

1. **变异敏感度对最终文件的复跑属既定延期验证**：SA6 §9.2 的 M1–M4 击穿证据（13/5/3/3）由等价探针取得；对 committed 文件复跑需临时改动 DENY 面 `mutation.ts`，SA3/SA4 已正确拒绝越权并列入后续动态验证（SA3 Deferred verification、SA4 §10）。非 AC 项，证据链完整。
2. **AC8 门结果为在案记录而非 SA10 复跑**：92/92、29 files/539 tests、根 typecheck exit 0 引自 SA3 记录（SA4 静态复核一致）；SA10 纪律不运行测试，但发现性（vitest include、tsconfig include、CI 分片按磁盘枚举）已静态核实，门可由任何后续轮次确定性地重放。
3. **B22–B30 直造载体依赖 yjs 集成行为**（detached `doc===null`、空 XmlFragment 投影 `''`）：锚定的是 read.ts 显式契约分支，yjs 升级敏感性已在 SA4 §10 登记为观察项；fixture 手法有 read 系列既有先例。
4. **Host brief 未跟踪**：`wiki/raw/task_issue-348.md` 仍为未跟踪文件（#347 惯例是 brief 随票入库）；属 finalize 提交组合事项，非交付内容的 spec 缺口，提请 finalize 步骤留意。

---

结论：**approve**。交付物忠实满足 issue #348 正文 8 条 AC、SA6 验收契约全表（92 用例 1:1、负控组织、判决契约）、ADR 0025 适用条款与 SA8 冻结面；无遗漏、无部分实现、无错误实现、无 scope creep。
