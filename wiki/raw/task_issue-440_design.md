# SA1 架构与实现设计 — issue #440：vfsl 逐 entry 校验扩展（Record + 封闭对象 delete）与一致性 fixture 扩展（ADR 0034）

- 角色：SA1（设计）｜iteration 0｜worktree `mabf/issue-440` @ HEAD `0a91f14`
- 输入：`wiki/raw/task_issue-440.md`（Host 简报）、`wiki/raw/task_issue-440_sa6_contract.md`（approve 契约，26 红 + 19 负控 + 107 等价例 + 10 触达面例）、`wiki/raw/task_issue-440_sa6_capability_probe.mts`（探针，27 项）、母法 `docs/adr/0034-record-and-parent-elementwise-validation.md`（HEAD 已合入）
- SA8 工件：`task_issue-440_relevant_decisions.md` / `_conflict_report.md` **不存在**（iteration 0，SA6 §1 已确认）——替代约束面见 §6

---

## 1. 任务类型、目标和非目标

**任务类型**：Feature（能力缺口——SA6 §8 已证据化，不虚构 Bug 根因）。现行「边界尺度全量重建 + `validateSubtree` 整体判定」在 phase-1 契约下**判定语义正确**；缺口 = ADR 0034 决策 1/2/4/5 要求的**公共接缝、一致性 fixture 载体与公开导出尚不存在**。

**目标**：

1. `@nomicore/vfsl` 公共入口新增 1 个运行时导出 `applyElementwiseEntryMutation(derived, plan, facts, payload)` + 2 个类型导出 `EntryCarrierFacts` / `ElementwiseEntryMutationPayload`（SA6 §12.1 绑定点 B-1/B-2/B-3，名目已冻结，本设计原样采用）；
2. 接缝在「schema 静态事实（plan）+ 目标键位在场性 O(1) 事实（`{has}`）+ 载荷」上结算 Record set/delete 与封闭对象 delete，**不消费整 map / 父对象提取值**；
3. Record set = 键 Pattern 校验 + 新值过值 schema（旧值不读）；Record delete = 仅在场/no-op 域规则；封闭对象 delete = 静态必填判定（必填 ∧ 非 `unknown` 标量 → 拒；optional ∨ `unknown` → 允；不读父值）；
4. issue 路径 `[...mapPath, key, ...]` 与现行全量路径**逐字节兼容**；域 message（no-op / 必填缺失）与现行逐字一致；
5. 一致性 fixture（SA6 已落位：`issue-440-elementwise-entry-fixture.ts`，107 等价例 + 10 触达面例）成为 ADR 0034 决策 5 的执法载体——实现必须使其全绿。

**非目标**（与 Issue「Blocked by #437」链及 ADR 0034 排序一致）：

- doc-runtime 按闸门分流接线、S9/E201/charge 收窄、性能基准（10⁵ entry）→ **#441**；
- lease 端到端用户可见行为钉正（污染文档经 lease 写/删）→ **#442**；
- union map 位 / union 穿越（kind=`union`）写路径 → **永久 legacy 轨**（ADR 0034 决策 1，本票闸门拒接管）；
- map 级约束语法 → 立法禁止（决策 5），不实现；
- 封闭对象字段 set → 本就 kind=`target` 整值替换，无优化空间，不涉及（ADR「不做什么」）；
- 修改 SA6 已落位的测试/夹具/test-d 文件（md5 已登记，§16）。

---

## 2. 当前行为与证据锚点（HEAD = `0a91f14`）

| # | 事实 | 锚点（文件 : 符号） |
|---|---|---|
| C1 | 公共面 23 个运行时导出中无 Record/parent 逐 entry 接缝；`/elementwise/i` 仅命中数组位 `applyElementwiseArrayMutation` | SA6 G1（运行时反射，`artifacts/sa6-issue440-probe.log`）；`packages/vfsl/src/index.ts:132-147` 导出块 |
| C2 | 现行 record/parent 写判定唯一入口 `applyMutationAtBoundary` 是**边界值驱动**：set 支 `relNavigate` + `{...base, [key]: value}` 全量拷贝重建后 `validateSubtree(plan.node, proposed)` 整体判定；delete 支父对象 `hasOwn` 检 no-op + 删键重建后整体判定 | `packages/vfsl/src/validate-patch.ts:926-1012`（`applyMutationAtBoundary`）、`:1015-1022`（`validateBoundary`） |
| C3 | 以在场事实 `{has:true}` 代 `boundaryBase`：record set 报 `类型不匹配：期望对象，实际 boolean`（事实对象被当作 map 内容校验）；record/parent delete 报 no-op——现行接缝**无法**从静态事实 + 在场性工作 | SA6 G2 三支实测；`validate-patch.ts:941-960`（set 支 relNavigate/重建）、`:962-981`（delete 支 `Object.hasOwn` L973） |
| C4 | 规划闸门前提：Record 位 set/delete → `kind=record ∧ prefix=mapPath ∧ relPath=[key] ∧ node=object 含 '<key>' 槽（+keyPattern）`；封闭对象字段 delete → `kind=parent ∧ 无 '<key>' 槽`；union map 位 → `kind=union ∧ node.kind=union`（永久 legacy）；未声明键 delete 在规划层结构面即拒（`路径不存在：未知字段 "..."`） | `validate-patch.ts:739-822`（`planMutationBoundary` 边界定夺 L791-818）；SA6 G3 全表；负控 NC2 |
| C5 | Record 值校验是**纯逐 entry** 的：`validateObject` Record 形态对每个键只做 keyPattern 逐键判定 + 值逐值校验（键违规不阻断值校验——全收集、键 issue 先于值 issue）；空对象合法；无必填缺失、无未知键、**无任何 map 级约束** | `packages/vfsl/src/validate.ts:655-667`（Record 形态支）、`:369-379`（`validateKeyPattern`）；SA6 G5/E6 + NC6（200 entry 干净整体接受、entry 级非法响亮拒绝） |
| C6 | 封闭对象必填判定是**纯 schema 静态事实**：字段声明序扫描，`f.value.kind === 'optional'` 跳过；`resolveValues(f.value)` 为 `scalar ∧ type==='unknown'` 跳过（缺席视同接受）；否则 `present()` 缺失 → `缺少必填字段 "${name}"` @ `[...path, name]` | `validate.ts:670-682`（封闭对象形态支 (1)）、`:147-149`（`resolveValues` = `walkRefChain` + 值树透镜）；SA6 G4（`obj/req` delete 逐字） |
| C7 | keyPattern 携带在 Record 物化位的 object 值节点上（`{kind:'object'; fields; keyPattern?}`）；值树字段值可为 `ref`（按名引用）/ `optional`（仅字段位）包装 | `packages/vfsl/src/derived.ts:45,57-63`；`validate-patch.ts:481-518`（`descendValues` 归一化：边界节点恒非 ref/非 optional，字段值可 ref） |
| C8 | 数组位先例（#435/ADR 0033）：`applyElementwiseArrayMutation` 的判定管线 = 闸门三条件 fail closed → 载体域事实守卫（length）→ 载荷域守卫 → op 域规则（message 逐字复用 legacy）→ 逐新值过 `plan.node.element`（issue rebase `[...arrayPath, index+j, ...原生 path]`）；返回 `ValidateResult` 直出（无 `proposedBoundary`）；崩溃边界 `wrapElementwise`（E100 同款） | `validate-patch.ts:1039-1146`；实现提交 `006e416`（仅 `validate-patch.ts` + `index.ts` + 证据） |
| C9 | doc-runtime 现状：`case 'record'/'parent'` 必须 S5 `walk` 整 map/父值提取 → S6 `applyMutationAtBoundary` → S9 边界重投影（`proposedBoundary` 比对）；数组位已有 fast path 分流先例（#436，`case 'array'` 闸门 + `applyElementwiseArrayMutation`） | `packages/doc-runtime/src/mutation-local.ts:266-310`（record/parent 分支）、`:312+`（array fast path）；SA6 §8 step 3 |
| C10 | 基线绿：pre-contract 根 `pnpm typecheck` exit 0；根 `pnpm test` 466 files / 5667 tests 全绿；post-contract 唯一红面 = 本票契约 26 红 + test-d（7 条 TS 报错全在 `.test-d.ts`） | SA6 §4/§13（`artifacts/sa6-issue440-baseline-*.log`、`-post-*.log`） |

---

## 3. 能力缺口（Feature 根因链承接）

最深根因（SA6 §8 step 5，本设计确认）：**vfsl 公共面缺少「schema 静态事实 + 键位在场性 O(1) 事实 + 新值」结算判定的公共表达**。判定语义本身正确（负控 NC1–NC7 证明 legacy 轨全部兼容面正确且必须保持）；缺的是把「整容器验证」替换为「逐 entry 验证」的接缝与立法载体：

| 缺口 | AC | 红灯落点（SA6 §5.6） |
|---|---|---|
| Record set 逐 entry 接缝缺席（键 Pattern + 新值、旧值不读、逐字路径） | AC1 | 契约 B1–B5/B7（红） |
| Record delete 仅域规则判定缺席 | AC2 | 契约 C1–C5（红） |
| 封闭对象 delete 静态必填判定缺席 | AC3 | 契约 D1–D6（红） |
| Record/parent 一致性 fixture 无目标侧可比 | AC4 | 契约 E1–E3（红）+ 夹具 117 例 |
| 公开面新导出 + guard 缺席 | AC5 | 契约 A1/A2 + test-d（红） |

可达性证据（SA6 E1/E5）：见证实现与全量 oracle 在等价集 **107/107 逐字节一致**、注入公共面后契约 **26/26 全绿**、4 个错误实现变异 4/5/10/4 红——目标语义可表达、可满足、断言敏感。

---

## 4. Owner 要求落实

REST Issue comments = `[]`（SA6 §2 实读；简报同）——**无适用 owner 评论**。需求面 = Issue 正文 What to build + AC1–AC6 + ADR 0034 决策 1–5：

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无评论） | — | AC1 Record set：键 Pattern 违规、新值非法写入前拒绝；路径逐字节一致 | §7.2 决策 D2、§8 接缝管线 set 支 |
| （无评论） | — | AC2 Record delete：仅在场/no-op 域规则，不触碰其他 entry | §7.2 决策 D3、§8 delete-record 支 |
| （无评论） | — | AC3 封闭对象 delete 静态规则全矩阵 | §7.2 决策 D4、§8 delete-parent 支 |
| （无评论） | — | AC4 一致性 fixture 覆盖 Record + parent，逐字节一致 | §7.2 决策 D6、§12 验收映射 |
| （无评论） | — | AC5 公开面只经包公共入口导出，guard 覆盖新导出 | §7.2 决策 D1、§10 文件范围、§11 |
| （无评论） | — | AC6 包测试 + 根 typecheck/test 绿 | §12 验收映射 |
| （无评论） | — | 兄弟票消歧（SA6 §2.1–2.3）：「测试 seam 不新增」指观察面，不禁止 vfsl 新导出；未声明键分支规划层已拒；端到端行为钉正归 #442 | §7.2 决策 D5、§13 残余 |

---

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 公共面 23 导出零落点（G1） | SA6 §5.1 + 探针 | 新增恰 1 运行时导出 + 2 类型导出（§7.2 D1）；既有 23 个逐字节不变（负控 NC5.1 锚定） |
| legacy 必须消费整 map/父值（G2 三支） | SA6 §5.2 | 接缝输入面收窄为 `{has}`（B-2）；不收 boundaryBase |
| 规划闸门形状冻结（G3 + NC2） | SA6 §5.3 | 接缝闸门消费同一形状（§8 ①）；不改 `planMutationBoundary` |
| 现状语义快照（G4 + NC1）：键 Pattern message/序、非法新值 rebase、no-op、必填 delete、optional/unknown 允许、值位 union 仲裁、delete 不查键 Pattern | SA6 §5.4 | 判定语义经 `validateSubtree` 单源继承（§7.2 D2）；域 message 逐字复用冻结常量（§8 ④） |
| 立法前提（G5/E6/NC6）：Record 无 map 级约束 | SA6 §5.5 | 单 entry 视图等价论证的规范基础（§7.2 D2 论证） |
| 见证 107/107 + 干跑 26/26 + 变异敏感（E1/E5/E9） | SA6 §9/§13 | 本设计采用的语义面即见证语义面的直接实现（§7 对照） |
| 触达面收窄（决策 4；E2/NC7 对照基线） | SA6 §9 | 接缝只收 `{has}` = 输入面表达；端到端钉正归 #442（§13 残余 2） |
| 基线绿 + 唯一红面 = 本票契约 + test-d（C10） | SA6 §13 | §12 绿色判据逐条承接 |

上游事实与源码**无矛盾**（本设计逐锚点核对了 `validate-patch.ts` / `validate.ts` / `derived.ts` / `mutation-local.ts`，SA6 引用的行号与符号全部在场且语义一致）。

---

## 6. SA8 约束落实

`task_issue-440_relevant_decisions.md` / `_conflict_report.md` **不存在**（iteration 0）。替代规范约束面（SA6 §3 同源，本设计逐条落实）：

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| ADR 0034 决策 1：闸门（map 位非 union Record 形态；union map 位永久 legacy；Record 值位 union 不影响 fast path；旧值不读） | §8 ①闸门 + ④set 支 | kind/node/`<key>` 槽三重闸门 fail closed；`blobs` 值位 union 经 `<key>` 槽整体过 `validateSubtree`（union 判别内嵌）；set 不读 `facts.has` | 否（实现已合入 ADR） |
| ADR 0034 决策 2：封闭对象 delete 静态必填判定（必填 ∧ 非 unknown 标量 → 拒；optional ∨ unknown → 允；`has` 拒 no-op；不读父值） | §8 ④delete-parent 支 | 字段声明表查找 + optional 包装检查 + ref 解析后 unknown 标量检查；逐字复用 `缺少必填字段` message | 否 |
| ADR 0034 决策 3：fast-path 返回 `ValidateResult` 直出（无 `proposedBoundary`） | §7.2 D1、§8 返回 | 签名/返回即如此（B-4；test-d 负面夹具锚定） | 否 |
| ADR 0034 决策 4：触达面 = 载体 + 目标键位 | §7.2 D5 | 本票以输入面（只收 `{has}`）+ fixture 触达面组表达；接线归 #441 | 否 |
| ADR 0034 决策 5：容器合法性 ⟺ 逐 entry 合法；禁止 map 级约束特判；enforcement = 一致性 fixture | §7.2 D6、§12 | fixture 已落位（107+10 例）；实现使其全绿即为执法 | 否 |
| ADR 0034 决策 6/后果：基准与 S9/E201/charge 归 #441/#442 | §1 非目标、§13 | 本票只钉语义面 + 结构面 | 否 |
| ADR 0033（同族先例）：接缝形状、fail closed 纪律、`ValidateResult` 直出、E100 崩溃边界 | §7.2 D1、§8 | 命名族/管线/崩溃边界与 `applyElementwiseArrayMutation` 同构；#435 签名面不动（NC5.2） | 否 |
| `packages/vfsl/AGENTS.md`：公共 API 只经 `src/index.ts`；同步/纯函数/不抛错（畸形输入走判别联合）；稳定 message/顺序/path 是兼容行为；不引入 Yjs 关切 | §7.2 D1/D7、§8、§10 | 唯一新导出经 index.ts；纯函数 + `wrapElementwise` E100；既有语义 message 零复制（单源继承）；零 Yjs 引用 | 否 |
| 根 `AGENTS.md` 测试纪律（零 skip/only/todo、零 env override、真实入口发现） | §12 | 测试已由 SA6 落位并冻结；设计不改测试 | 否 |
| SA6 §12.1 绑定点 B-1…B-6（名目/形状/oracle/夹具冻结） | §7.2 D1、§8 | 本设计原样采用 B-1…B-6，**不触发契约重绑** | 否 |
| **缺 SA8 预检工件本身** | 本表 | iteration 0 无 SA8 决议摘录/冲突报告；本设计以 ADR 0033/0034 + 包纪律 + SA6 §3 替代，并按技能规则标记设计后 ADR 冲突复查（见 §15） | **是**（保守：新增公共 API 导出） |

---

## 7. 设计决策与主要备选方案

### 7.1 总形状

在 `packages/vfsl/src/validate-patch.ts` 的 #435 节之后追加 #440 节（同族布局），新增两个类型 + 一个函数；`src/index.ts` 导出块追加 3 个名字。**纯加法**：既有 23 个运行时导出、`applyElementwiseArrayMutation` 签名面、`planMutationBoundary` / `applyMutationAtBoundary` / `validateSubtree` 全部不动。

### 7.2 决策清单

**D1 公共接缝签名（采纳 SA6 B-1/B-2/B-3/B-4 冻结名目）**

```ts
/** entry 载体域事实（ADR 0034 决策 1/2）：目标键位在场性 O(1) 投影——不含其他 entry / 父值。 */
export type EntryCarrierFacts = { readonly has: boolean };

/** 逐 entry mutation 载荷：字段与 BoundaryMutationPayload 同名支逐字一致；词表恰两支。 */
export type ElementwiseEntryMutationPayload =
  | { op: 'set'; value: unknown }
  | { op: 'delete' };

export function applyElementwiseEntryMutation(
  derived: DerivedSchema,
  plan: MutationBoundaryPlan,
  facts: EntryCarrierFacts,
  payload: ElementwiseEntryMutationPayload,
): ValidateResult
```

- `EntryCarrierFacts.has` 语义 = `Y.Map.has(key)` / 父对象 `Object.hasOwn` 同义（O(1)）；与 legacy delete 支的 `Object.hasOwn(obj, key)`（`validate-patch.ts:973`）同一判定基准（**不是** `present()` 的「undefined 视同缺席」——delete 域规则从不区分 undefined 值）。
- 返回 `ValidateResult` 直出（ok 支恰 `{ ok: true }`，无 `result`/`proposedBoundary` 包装——决策 3）；同步、纯函数、不抛错（`wrapElementwise` 崩溃边界收编 E100，与 #435 同款）；不修改 `derived`/`plan`/`facts`/`payload`（契约 A2 纯函数断言）。

**D2 Record set = 单 entry 视图过共享解释器（核心决策）**

不自行重写键 Pattern 判定与值校验，而是构造**合成单 entry 视图**后过 `validateSubtree`：

```ts
const proposed: Record<string, unknown> = { [key]: payload.value }; // 计算键——'__proto__' 落自有属性（文件既定纪律）
const sub = validateSubtree(derived.values, plan.node, proposed);
if (sub.ok) return { ok: true };
return {
  ok: false,
  issues: sub.issues.map((i) => ({ message: i.message, path: [...plan.prefix, ...i.path] })),
};
```

*等价论证（决策 5 立法的直接推论）*：legacy set 判定 = `validateObject` Record 形态对 proposed map `{...base, [key]: value}` 的**逐键独立**判定（C5：无 map 级约束，E6/NC6 立法前提证明）。故判定限制在目标键位 ⟺ 对单 entry 视图 `{[key]: value}` 的判定。issue 路径：validateObject 在 `[k, ...值内]` 相对位发射、legacy 经 `validateBoundary` 以 `[...plan.prefix, ...issue.path]` rebase（C2）——本接缝 rebase 式逐字相同。键 issue 先于值 issue（全收集语义）、keyPattern 编译错误族（Pattern 正则无法编译/不支持构造/规模超限/预算耗尽）、100 条截断标记、E100、charge 记账——全部从 `validate.ts` **单源继承，零消息复制**。与 legacy 的唯一可观察差异 = 不收集其他键位的 issue——恰是决策 4 触达面收窄，fixture E2/E3 组以 oracle 对照证明该差异精确落位。`payload.value === undefined`：与 legacy 同构（`{[key]: undefined}` 过值 schema → 响亮型错 issue，确定性、无特判）。

**D3 Record delete = 仅域规则**

`facts.has === false` → 拒 no-op（message `delete 目标键不存在（拒绝 no-op）` @ `[...plan.prefix, key]`，与 legacy `issueAt(..., plan.relPath)` 逐字节同源）；`has === true` → `{ ok: true }`（空对象合法 ⇒ 删除永不使 Record 非法——ADR 决策 1）。**不查键 Pattern**（C4/G4：delete 目标键本身违规照常成功）、不触碰其他 entry（O(1)）。

**D4 封闭对象 delete = 静态必填判定（不读父值）**

```
has=false → 拒 no-op（同 D3 文案/路径）
has=true：
  field = plan.node.fields 中 name === key 的声明字段
  field 未找到 → fail closed（手造计划；规划层不可达——C4/G3.4）
  field.value.kind === 'optional' → { ok: true }
  inner = walkRefChain(field.value, valueLens(derived.values))   // 与 resolveValues 同算法同文案（C6/C7）
  inner.kind === 'scalar' && inner.type === 'unknown' → { ok: true }（缺席视同接受的现行语义保留）
  否则 → 拒：缺少必填字段 "${key}" @ [...plan.prefix, key]（与 validateObject 封闭形态支 (1) 逐字同源）
```

判定镜像 `validate.ts:672-681` 的次序与语义：optional 包装在字段位先查（`D10`：optional 仅字段位出现）、ref 解析后判 unknown 标量。`walkRefChain` 的环/缺名 InternalError 由崩溃边界收编为 E100（可信域畸形 → loud，包纪律）。必填非 unknown 的全形态（标量/对象/union/enum/pattern/int…）一律拒——`obj.req`（string）、`obj.child`（内联对象）、`obj.u`（string|number union）与嵌套 `panel.node.req` 全矩阵即契约 D1。

**D5 触达面输入表达**

接缝输入只有 `{has}`（目标键位在场性），结构上不携带其他 entry / 父值——「污染容器写由连带拒绝变目标键合法即成功」在**输入面**被钉死（决策 4 的本票份额）；fixture 触达面组 10 例（污染在目标键位之外）+ 负控 NC7（legacy 现状连带拒绝）构成对照基线。端到端接线归 #441。

**D6 一致性 fixture 执法**

`issue-440-elementwise-entry-fixture.ts`（117 例：107 等价 + 10 触达面；`mulberry32(440)` 冻结）已由 SA6 落位且 md5 登记——实现使其 E1（107/107 逐字节一致）、E2（10/10 可分）、E3（目标行为 + issue 只落目标键位前缀）全绿即完成决策 5 执法。未来任何 map 级约束特判将使 E1/E2 或 NC4/NC6 红灯。

**D7 公开面与公共入口纪律**

只经 `src/index.ts` 追加导出（见 §10）；`validate-patch.ts` 内部复用既有私有助手（`singleIssue`、`wrapElementwise`、`valueLens`），不新增模块级可变状态、零 Yjs 引用。

### 7.3 主要备选方案与未选原因

| 备选 | 内容 | 未选原因 |
|---|---|---|
| A2 直接槽位校验 + 自研 keyPattern | 自行 `compile/match` 键 + `validateSubtree(<key>槽, value)` 分别判定 | keyPattern 判定与 Pattern 引擎错误族 message（`validate.ts:355-379` 私有）须复制或另开内部导出——**message 是兼容行为**（包纪律），复制引入漂移风险；导出扩面无必要。单 entry 视图（D2）零复制达成同一冻结语义 |
| A3 委托 `applyMutationAtBoundary` + 合成基值 | 以 `{[key]: value}` 为 boundaryBase 走 legacy 全函数（SA6 见证形状） | 语义等价（relNavigate/rebuildAlong 对合成基值均为 no-op），但多一层包装（`ApplyBoundaryResult` → `ValidateResult` 映射）与无谓间接层；D2 是同一单源的更短路径 |
| A4 两名制/不同名目 | 如 `applyElementwiseRecordMutation` 等 | 违反 SA6 B-1 冻结名目，触发契约重绑（§12.1 注释）与 SA6 重跑；与 #435 命名族（`ArrayCarrierFacts`/`ElementwiseArrayMutationPayload`）不再同构，违反 ADR 0034 §6「复用而非另起平行机制」 |
| A5 顺带做 doc-runtime 分流 | 在本票接线 fast path | 破坏 Blocked-by 链（#441/#442 的既定范围）；SA6 §10 明示消费方不在本票实现 |

---

## 8. 接口、状态机与数据流

### 8.1 判定管线（纯函数决策流；无持久状态、无状态机）

```
applyElementwiseEntryMutation(derived, plan, facts, payload)
└─ wrapElementwise（E100 崩溃边界，复用 #435 助手）
   ① 闸门（ADR 0034 决策 1/2；违约 fail closed——响亮 issue，不抛、不静默 ok）
      a. plan.kind ∈ {'record','parent'}？       否 → singleIssue(闸门 message①, [...plan.prefix, ...plan.relPath])
      b. plan.relPath.length === 1 ∧ relPath[0] 为 string？ 否 → 同上（message① 携带实参）
      c. plan.node.kind === 'object'？            否 → singleIssue(闸门 message②, [...plan.prefix, ...plan.relPath])
      d. kind ↔ 形态一致：record ⇒ 含 '<key>' 槽；parent ⇒ 无 '<key>' 槽？ 否 → singleIssue(闸门 message③, 同路径)
   ② 载体域事实守卫：typeof facts.has === 'boolean'？ 否 → singleIssue(闸门 message④, [...plan.prefix])
   ③ 载荷词表守卫：payload.op ∈ {'set','delete'}？   否 → singleIssue(闸门 message⑤, [...plan.prefix])
      parent ∧ op='set' → singleIssue(闸门 message⑥, [...plan.prefix, key])（封闭对象 set 是 target 位整值替换）
   ④ 分派（key = plan.relPath[0]；entryPath = [...plan.prefix, key]）
      set（此时 kind 必为 record）→ D2：{ [key]: payload.value } → validateSubtree(plan.node) → rebase [...plan.prefix, ...]
      delete：
        has=false → singleIssue('delete 目标键不存在（拒绝 no-op）', entryPath)      ← 冻结文案（NC1.3）
        has=true ∧ kind=record → { ok: true }
        has=true ∧ kind=parent → D4 静态必填判定（缺字段 fail closed；optional/unknown → ok；
                                   必填非 unknown → singleIssue(`缺少必填字段 "${key}"`, entryPath)） ← 冻结文案（NC1.4）
```

闸门 message①–⑥ 为**新面文案**（SA6 §15.3 明示不冻结，仅钉 `ok:false ∧ issues.length>0`），家族风格对齐数组接缝（`validate-patch.ts:1088-1098`）：①`逐 entry 校验仅服务 planMutationBoundary 的 record/parent 计划（要求 kind∈{record,parent} 且 relPath 为单段 string 目标键；实际 kind=…、relPath 长度=…）；union map 位与其他计划请走 applyMutationAtBoundary，数组目标请走 applyElementwiseArrayMutation`；②`逐 entry 校验要求边界值节点为 object（实际 …）；union 容器目标永久走 applyMutationAtBoundary 整体验证（ADR 0034 决策 1）`；③`逐 entry 校验的 record 计划要求 Record 形态（object 节点含 '<key>' 槽）、parent 计划要求封闭对象形态（无 '<key>' 槽）——违约计划 fail closed`；④`逐 entry 校验的载体域事实非法：has 必须是布尔值（目标键位在场性，O(1)）`；⑤`逐 entry 校验载荷非法：词表恰 {op:'set';value}|{op:'delete'}（array-* 请走 applyElementwiseArrayMutation）`；⑥`封闭对象字段 set 是 kind=target 整值替换（旧值不读），不适用逐 entry 接缝；请走 applyMutationAtBoundary`。

### 8.2 全矩阵行为表（与契约 A–F 一一对应）

| 输入面 | 判定 | issue（message / path） | 契约锚 |
|---|---|---|---|
| record set 新键/既有键 × 合法值 | `{ok:true}` | — | B1/B6 |
| record set 非法新值 | 拒 | 值 schema 原生 issue @ `[...prefix, key, ...值内]` | B2（`tasks/zz9/qty`） |
| record set 键 Pattern 违规（合法值） | 拒 | `Record 键 "nope" 不满足 Pattern 正则 /^(id-[0-9]+)$/` @ `[...prefix, key]` | B3 |
| record set 键违规 + 非法值 | 拒 | 两 issue，键先值后 | B4 |
| record set 值位 union（blobs） | 仲裁 | union 三段算法原生 issue（`联合成员 2/2：…`）@ `[...prefix, key, n]` | B5/NC1.5 |
| record set `has` 真/假 | 判决逐字节恒同（不读） | — | B6 |
| record delete 缺席键 | 拒 | `delete 目标键不存在（拒绝 no-op）` @ `[...prefix, key]` | C1/C5 |
| record delete 在场键（含键违规） | `{ok:true}` | — | C2/C4 |
| record delete 邻位污染 | 判决与干净基线逐字节同 | — | C3/E2 |
| parent delete 必填非 unknown（req/child/u/嵌套 req） | 拒 | `缺少必填字段 "…"` @ `[...prefix, key]` | D1/D6 |
| parent delete optional / unknown 标量 | `{ok:true}` | — | D2 |
| parent delete 缺席字段（无论必填性） | 拒 | no-op 文案同上 | D3 |
| parent delete 目标字段值非法 / 同胞污染 | 判决与干净基线逐字节同（静态性） | — | D4/D5 |
| union map 位（kind=union）/ target / array / 手造 kind / relPath≠[key] / parent+set / array 载荷 | 拒（fail closed） | 闸门 message（新面） | F1/F2/F3 |
| 等价集 107 例 | 与全量 oracle 逐字节一致 | — | E1 |
| 触达面 10 例 | 与 oracle 逐字节可分（目标键位合法即成功 / 只报目标键位） | — | E2/E3 |

### 8.3 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚 |
|---|---|---|---|---|---|---|---|---|
| 判定流（本票唯一运行时数据流） | 实现后调用方（本票内仅测试）：`derived`（冻结派生物）+ `plan`（规划产物）+ `{has}`（O(1) 载体事实）+ 载荷 | 无写入——纯函数；唯一中间对象 = 单 entry 合成视图（调用局部，即弃） | `validate-patch.ts` 内：闸门 → 守卫 → `validateSubtree`（值树透镜解 ref，调用局部 memo）/ 静态字段表查找 | 零存储、零传输、零网络、零时钟 | 返回 `ValidateResult`（纯 JSON 值） | accept `{ok:true}` / reject 携 issue（message+path 兼容面逐字节） | 一切拒绝经判别联合返回；内部异常 → E100 单 issue；无资源需清理 | 契约 A–F |
| （对照）legacy 全量流 | doc-runtime `case 'record'/'parent'`：S5 walk 整 map/父值 → S6 重建 + 整体校验 → S9 重投影 | Y.Doc 提交（#441 前不变） | O(n) 提取 + `{...base}` 展开 | live Y.Doc | `proposedBoundary` 比对 | 现行行为（负控锚定，本票不动） | 同现行 | NC1/NC3/NC7 |

**本票无跨模块、跨进程或跨持久化边界的运行时数据流变化**：新接缝是纯函数加法，live 载体读写、S5/S6/S9、Y.Doc 提交面零改动（依据：C2/C9 + ADR 0034 排序；doc-runtime 改动属 #441）。

---

## 9. 错误、恢复、并发和幂等

- **错误面**：一切失败经返回值判别联合（`{ok:false, issues}`），函数从不抛错；内部异常（手造派生物 ref 环/缺名、两树分歧、深嵌套栈溢出）由 `wrapElementwise` 收编为单条 `VFSL-E100`（与 #435/既有全家同款）。不存在静默 `ok:true` 路径：闸门/守卫/未声明字段全部响亮拒绝。
- **无静默 fallback**：闸门外计划不降级、不代答——明确拒绝并指路（`applyMutationAtBoundary` / `applyElementwiseArrayMutation`）；union map 位不被误接管（F2）。
- **并发/幂等**：同步纯函数，零共享可变状态（一切中间态调用局部）；同输入恒同输出（fixture 种子冻结可复现）。无重试语义需求；「重试」= 再次调用，幂等。
- **资源所有权**：不创建需释放的资源；`derived`/`plan` 只读（A2 断言 plan 不被突变）；合成视图调用局部即弃。
- **恢复/回滚**：无状态可回滚。整票回滚 = 移除新增导出与接缝节（纯加法，零既有面依赖新代码——见 §13）。

---

## 10. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/vfsl/src/validate-patch.ts` | 在 #435 节后追加 #440 节：`EntryCarrierFacts` / `ElementwiseEntryMutationPayload` 类型 + `applyElementwiseEntryMutation` 实现（复用 `singleIssue`/`wrapElementwise`/`valueLens`）；文件头注释追加 issue #440 一句 | 接缝本体；同族先例 #435 的实现落点（提交 `006e416` 同款范围） |
| `packages/vfsl/src/index.ts` | 既有 `validate-patch.js` 导出块追加 `applyElementwiseEntryMutation`（值）与 `EntryCarrierFacts`、`ElementwiseEntryMutationPayload`（类型）；头注释与 #435 注释块追加 #440 行 | 包纪律：公共 API 只经 `src/index.ts`（AC5） |
| `artifacts/sa3-issue440-*.log`（新增证据文件） | 实现角色的聚焦/根 gates 证据日志（惯例同 #435 提交） | 仓库既有实现证据惯例 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/vfsl/test/issue-440-elementwise-entry-contract.test.ts` | 红灯契约（26 tests） | SA6 冻结验收面（md5 `a595c8ae…` 登记）；实现使其翻绿，不得改断言 |
| `packages/vfsl/test/issue-440-elementwise-entry-control.test.ts` | 恒绿负控（19 tests） | 同上（md5 `46829054…`）；实现后须保持绿 |
| `packages/vfsl/test/issue-440-elementwise-entry-fixture.ts` | 共享夹具（117 例） | 同上（md5 `ce86199a…`）；决策 5 执法载体 |
| `packages/vfsl/test/issue-440-elementwise-entry.test-d.ts` | 类型契约 | 同上（md5 `0fe31a97…`）；签名面冻结（B-1…B-4） |
| `wiki/raw/task_issue-440_sa6_contract.md`、`wiki/raw/task_issue-440_sa6_capability_probe.mts` | SA6 诊断与探针 | 上游只读输入（md5 登记） |
| `packages/vfsl/src/validate.ts` | 共享解释器 | 设计为零改动（`validateSubtree` 已内部导出、消息族单源继承）；改它将扩面且引入消息漂移风险 |
| `packages/vfsl/src/derived.ts`、`resolve.ts`、`pattern.ts` 等 | 类型/透镜/引擎 | 无需改动；保持冻结面 |
| `packages/vfsl/test/issue-435-*`（4 文件） | #435 冻结面 | `applyElementwiseArrayMutation` 签名面不得动（NC5.2 + #435 契约） |
| `packages/doc-runtime/**`、`packages/namespace-runtime/**` 等 | 消费方接线 | #441/#442 既定范围（Blocked by 链） |
| `docs/adr/0034-*.md`、`docs/adr/0033-*.md`、`CONTEXT.md`、`docs/vfsl/**` | 规范面 | ADR 0034 与 CONTEXT.md「重建校验/复制未校验」词条已随 HEAD `0a91f14` 立法完毕；本票实现不产生新的规范契约变化 |

---

## 11. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `packages/vfsl/src/index.ts` 公共面消费者（编译期） | 23 运行时导出；`applyElementwiseArrayMutation` 已在场 | +1 运行时导出 +2 类型导出（纯加法）；既有导出逐字节不变 | 零（无破坏性变更；NC5.1 超集锚保证） | §2 C1；`index.ts:132-147` |
| doc-runtime `mutation-local.ts` `case 'record'/'parent'`（未来主要消费者） | S5 walk 整 map/父值 → S6 `applyMutationAtBoundary` → S9 重投影 | **本票不变**；#441 起按闸门分流：非 union Record 位/封闭对象 delete → `applyElementwiseEntryMutation`（`facts = { has: Y.Map.has(key) }`），union/其余 → legacy | 本票零；#441 接线（分流模板同 `case 'array'` #436 先例） | §2 C9；`mutation-local.ts:266-310`、`312+` |
| doc-runtime `case 'array'`（数组位） | 已消费 `applyElementwiseArrayMutation`（#436） | 不变 | 零 | `mutation-local.ts:312+` |
| vfsl 既有路径级接缝（`validatePatch`/`validateAppendToArray`/…） | 独立入口 | 不变 | 零 | `validate-patch.ts:623-698` |
| SA6 契约/负控/test-d | 红（缺导出） | 全绿（26/19/test-d） | 零（已冻结） | §12 |
| 未来外部消费者（#442 lease 端到端） | 不存在 | 经 doc-runtime 间接受益 | 本票零 | SA6 §10 |

**返回值/抛错/nullable/异步/取消/生命周期语义对既有调用方零变化**（纯加法；新接缝自身是新的同步纯函数面）。

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 Record set（B1–B5/B7） | 契约红 7；G4 快照 | 已落位 `issue-440-elementwise-entry-contract.test.ts` B 组 | 26 红转绿（红因 `能力缺口：@` 消失） |
| AC2 Record delete（C1–C5） | 契约红 5 | 同上 C 组 | 同上 |
| AC3 封闭对象 delete 矩阵（D1–D6） | 契约红 6 | 同上 D 组 | 同上 |
| AC4 一致性 fixture（E1–E3 + NC4） | 契约红 3；夹具 117 例 | 同上 E 组 + 负控 NC4 | 等价集 107/107 逐字节一致；触达面 10/10 可分 |
| AC5 公开面 + guard（A1/A2 + test-d + NC5） | 契约红 2；test-d TS2724×3 等 7 错 | 已落位 `.test-d.ts` + NC5 | test-d 7 错全消（3 条 `@ts-expect-error` 命中）；23 既有导出在场 |
| AC6 gates | SA6 §4 基线绿；§13 post 红 | `tsc -p packages/vfsl/tsconfig.json --noEmit`；根 `pnpm typecheck`；根 `pnpm test`（= `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`） | 包 tsc exit 0；根 typecheck exit 0（15 包 `&&` 链不再停在 vfsl）；根 test 全绿（基线 466/5667 + 本票 45 tests = 469 files，零第 4 方回归） |
| 闸门 fail closed（F1–F3） | 契约红 3 | 同上 F 组 | union/target/array/手造 kind/relPath≠[key]/parent+set/array 载荷 全部 `ok:false` 且带 issue，从不抛 |
| 兼容面冻结 | 负控绿 19 | `issue-440-elementwise-entry-control.test.ts` NC1–NC7 | 实现后保持 19/19 绿（legacy 轨逐字不变） |
| 纯函数性 | A2 | plan JSON 前后比对（已含于契约 A2） | 逐字节相同 |
| 探针 | `artifacts/sa6-issue440-probe.log`（exit 0，27/27） | 探针为 HEAD 态诊断（wiki 证据，不在 vitest 发现面） | **预期 G1.1/G1.2 两项翻红**（导出由缺席转为在场——缺口的正向闭合）；O/REF/NC 各项不变绿。post-implementation 绿判据以契约/负控/test-d/根 gates 为准（§13 残余 1 详述） |

SA1 不编写/运行测试；上表「所需」均已在 SA6 产物中落位，实现角色的绿色判据 = SA6 §13：**契约 26/26、负控 19/19、test-d 类型红转绿、根 `pnpm typecheck` exit 0、根 `pnpm test` 全绿**。

---

## 13. 风险、回滚和残余问题

| 风险 | 评估 | 缓解 |
|---|---|---|
| 消息漂移（兼容面） | 低 | D2/D4 设计使既有语义 message 全部单源继承（`validateSubtree` + 冻结常量），实现零新增既有语义文案；E1 逐字节比较 + NC1 常量锚双保险 |
| 闸门误接管（union map 位/数组位） | 低 | 三重闸门（kind ∧ node ∧ `<key>` 槽一致性）fail closed；F2/NC2.3 钉死；失败方向 = 多验证而非漏验证 |
| 合成视图的对抗键（`__proto__` 等） | 低 | 计算键展开是本文件既定纪律（头注释 L25-26），`'__proto__'` 落自有属性；Record 形态不做字段名查表（除 `<key>` 槽），无原型污染面 |
| charge/截断语义差异 | 无（预期内） | 接缝只对目标 entry 计费/收集——ADR 0034「后果」明示的 charge 计数变化；E2/E3 证明差异恰为触达面收窄 |
| scope 蔓延（doc-runtime/测试文件） | 低 | §10 ALLOW/DENY 显式钉死；评审若需扩范围须显式更新列表 |

**回滚**：纯加法——移除 `validate-patch.ts` #440 节与 `index.ts` 三行导出即回到 HEAD 行为；无数据迁移、无持久化格式、无 wire 面。

**残余问题**（非本票阻塞项）：

1. **探针 G1 翻红的解释口径**：SA6 §13 绿色判据字面包含「探针 exit 0」，但探针 G1.1/G1.2 断言的正是导出**缺席**（HEAD 态缺口证据）；实现后该两项必然翻红（缺口的正向闭合），探针其余 25 项（G2–G5/REF/O1–O3/NC1–NC2）不依赖新导出、保持绿。建议 Controller 路由时以「契约 26/26 + 负控 19/19 + test-d 转绿 + 根 gates」为权威绿判据；如需探针在实现后复跑留档，其 G1 翻红应按本条解读（不修改冻结探针文件）。此为 SA6 报告内部口径的小瑕疵，非设计冲突。
2. **触达面收窄的端到端用户可见行为**（污染文档经 lease 写/删）与 doc-runtime 分流接线、S9/E201/charge、10⁵ entry 基准 → #441/#442（Blocked by 链）。
3. **F 组闸门文案未冻结**（SA6 §15.3 有意留白）：本设计 §8.1 给出建议文案；实现可微调措辞，仅受「`ok:false` ∧ 带 issue ∧ 不抛」约束。
4. **未声明键 delete 分支**不进接缝判定矩阵（规划层结构面即拒，G3.4/NC2.4 冻结）；接缝内对应的手造计划分支按 fail closed 处理（D4 首行）。
5. **性能软验收**（ADR 决策 6）不在本票：结构面证据（输入不含其他 entry/父值）已由 B-2 输入面钉死；绝对耗时归 #441。

**无阻塞项**：能力缺口可运行证据化、目标语义可达（107/107 + 26/26 干跑）、契约可执行、入口真实、红因单一稳定、负控恒绿（SA6 §15）。

---

## 14. 评审修订映射

`wiki/raw/task_issue-440_sa2_review.md` **不存在**（iteration 0，无评审输入）——本节不适用。

---

## 15. 是否需要设计后 ADR 冲突复查

**是（`requiresConflictRecheck: true`），理由**：

1. **公共 API 变化**：`@nomicore/vfsl` 公共面新增 1 运行时导出 + 2 类型导出（虽为纯加法，仍属公共 API 面变化——触发复查条件之一）；
2. **SA8 预检工件缺席**：`_relevant_decisions.md` / `_conflict_report.md` 不存在（iteration 0），本设计以 ADR 0033/0034 + 包纪律 + SA6 §3 替代约束面自行核对——按技能规则（缺 SA8 产物 → 读取相关 ADR 并标记冲突复查）应提交复查。

核对结论（供复查者参考）：设计**不触碰**任何 ADR 冻结面、不修订既有决策——ADR 0034 已在 HEAD 合入且本设计是其决策 1/2/4/5 的直接实现；ADR 0033 面（`applyElementwiseArrayMutation` 签名）零改动；message/顺序/path 兼容行为逐字节保持（负控锚定）。预期复查结论为无冲突。
