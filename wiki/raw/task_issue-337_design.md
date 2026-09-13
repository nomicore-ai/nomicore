# SA1 设计 — Issue #337 `[shape-budget] T4: DeepOptional 预算读类型面`

- 派发：`sa-b3846512-0e87-42d8-906e-354bdc6b4353`（role `mabf-sa1`，phase `design`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-337`（branch `mabf/issue-337`，HEAD `cb8aaff0297a802432ba7532a407c65218852dce`；与 SA6 契约基线一致）
- 输入：任务简报 `wiki/raw/task_issue-337.md`（Issue #337 正文；**Comments 为空——无 Owner 评论要求**）、SA6 契约 `wiki/raw/task_issue-337_sa6_contract.md`、SA8 冲突门禁 `wiki/raw/task_issue-337_conflict_report.md`（verdict `clear`，`requiresConflictRecheck=true`）、决议摘录 `wiki/raw/task_issue-337_relevant_decisions.md`、源码与既有测试（锚点见 §2）。
- 本设计为**唯一设计产物**；不含实现代码、不含落盘测试（实现迭代交付）。无 SA2 评审输入（iteration 0，`wiki/raw/task_issue-337_sa2_review.md` 不存在——§14 按缺位记录）。

---

## 1. 任务类型、目标与非目标

**任务类型：Feature（能力缺口）**——SA6 §1 已定性：ADR-0024 决策 7 已立法、类型面未落地。本设计不虚构 Bug 根因。

**目标（全部 type-level）**：

1. `DeepOptional` 通用递归映射类型进入 `@nomicore/vfsl-protocol` 导出面，与 `PathAt` 并列（ADR-0024 L92 字面）；
2. 预算读的静态类型分叉可被消费方表达与锚定：带 options 读 → `DeepOptional<PathValue<PathAt<Map, P>>>`，无 options 读 → 现行 `PathValue<PathAt<Map, P>>` 完整子树承诺零降级（AC1/ADR-0024 L91）；
3. 协议导出枚举覆盖：`PROTOCOL_EXPORT_NAMES` 同变更集跟名（SA8 §8.1 阻塞级义务）；
4. test-d 锚：递归可选对象/数组/标量行为 + 判别字段 narrowing（AC2/AC3，ADR-0004 D4 装置）。

**非目标**：

- 不改任何运行时行为（零运行时 diff；读取/写入/失败通道/sequencer 全不动——ADR-0008 修订节边界）；
- 不升级 runtime/lease `readData` 的 legacy（无 options）静态面（AC1 明令禁止，SA6 排除假设 4）；
- 不做 per-schema 生成、不触生成器输出规格与 `domains/*/generated.ts`（ADR-0024 L92「零 per-schema 生成」+ ADR-0005）；
- 不触 `docs/integration`、typed-access 纪律文档、文档负控正则、ADR 回填（全部归 T5 #338——SA8 §8.3）；
- 不启用「判别字段保持必选」退路（SA6 §9 E5 实测 TS 5.9.3 支持可选化判别字段 narrowing，退路无触发证据；SA8 §8.4：未触发不得预防性豁免）；
- 不新增 CONTEXT.md 词条（L45–47「形状预算」已含 `DeepOptional<PathAt<…>>` 口径——SA8 §3 CONTEXT 行）。

## 2. 当前行为与证据锚点

| # | 事实 | 锚点 |
|---|---|---|
| B1 | 协议包纯类型模块，导出面恰 12 名，无 `DeepOptional`（SA6 P1 tsc checker 实测） | `packages/vfsl-protocol/src/index.ts`（157 行）；`artifacts/sa6-issue337-export-surface.log` |
| B2 | `VfslTypedAccess<Map>` 六方法（patch/read/kindOf/appendToArray/insertIntoArray/deleteFromArray）；`read` 返回 `PathValue<PathAt<Map, NoInfer<P>>>`，fail-closed 由 `FailClosedRest` rest 标记承担（未知路径 → 缺参 TS2554） | `index.ts` L118–154、L105–109、L125–129 |
| B3 | 既有测试**无** `keyof VfslTypedAccess` 方法集穷尽锚、**无**运行时实现者（全部 `declare const access` 消费）——接口加法不破任何在库锚 | `grep keyof VfslTypedAccess` 零命中；`packages/vfsl-protocol/test/*`、`domains/vfs3-assets/test/*`、`packages/vfsl-codegen/test/generate-discriminated-narrow.test-d.ts` |
| B4 | `PathValue` 产型即「读值类型」域：map → 封闭对象；**array 载体 → `Record<`${number}`, 元素值>`**（模板字面量索引签名，非 TS 数组）；plain 终态 → 声明处纯值（可为真 TS 数组/元组/readonly 数组）；可选字段 read → `T \| undefined`；成员独有字段 → `T \| undefined`（D2） | `index.ts` L61–72；`domains/vfs3-assets/test/vfs3-assets-projection.test-d.ts` L66–74（`ExpectedEntityValue.tags: Record<`${number}`, string>`）、L102、L125–141；`domains/vfs3-assets/generated.ts` L16–32 |
| B5 | runtime/lease `readData` 双重载已落（T3）：预算在前、legacy 在后；两成功成员 `value: unknown`；lease 镜像 + `_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` Equal 锁 | `packages/namespace-runtime/src/runtime.ts` L148–172、L214–220、L551–606；`packages/namespace-registry/src/lease.ts` L282–295、L410–421；`packages/namespace-registry/src/types.ts` L450–459、L675–679 |
| B6 | typed-stub 编译锁：`readData: () => readDataOk(...)` 赋给 runtime 替身依赖「`ReadDataOkShape` ⊆ 两联合成功成员」可赋值性——helper 头注明文将其设计为接口漂移编译锁 | `packages/namespace-runtime/test/helpers/readdata-ok-shape.ts` L21–24、L27–33；消费点 `packages/namespace-registry/test/registry-open.test.ts` L186/806/860 等 |
| B7 | 名单机制：`PROTOCOL_EXPORT_NAMES` 冻结 12 名 = 发射器碰撞守卫名单单一数据源；导出面增名不跟 → `generate-alias-collision-guard.test.ts`（checker 实测枚举）必红；「名单更新只改本文件一处」 | `packages/vfsl-codegen/src/protocol-surface.ts` L1–16；`packages/vfsl-codegen/test/generate-alias-collision-guard.test.ts` L66–76 + `tsc-helper.ts` L76–88；SA6 P5 敏感性实测 |
| B8 | 预算读运行时语义：容器（Y.Map/Y.Array/plain object/plain array）可被 depth 折叠/width 裁剪——**plain 值域同样递归受预算**（`copyPlainStrict` 携带 d/p；plain array 折叠为 `[]`、逐元素受 width） | `packages/doc-runtime/src/read.ts` L523–597（`projectValue`/`budgetFold`）、L697–712（`copyPlainStrict` 头注） |
| B9 | 共享 typecheck program：`tsconfig.typecheck.json` 单程序含全部 `packages/*/src|test` + `domains/*`——module augmentation 程序级全局；既有增广顶层键 = `name`/`portraitResourceId`/`tree`（protocol projection 测试）、`entityList`（codegen narrow 测试）、`assets`/`attachments`/`audit`/`notes`/`keywords`（vfs3-assets）；隔离先例 = 本地表 `LocalEmptyMap` / `AugVfslPathMap & VfslPathMap` | `tsconfig.typecheck.json`；`vitest.config.ts` L20；`packages/vfsl-protocol/test/vfsl-protocol-empty-fail-closed.test-d.ts` L5–24；`vfsl-protocol-projection.test-d.ts` L55–75、L91 |
| B10 | 包级 tsc：protocol/codegen tsconfig 含 `test/**`；**runtime/registry tsconfig 仅含 `src/**`**（包程序不含测试夹具） | `packages/vfsl-protocol/tsconfig.json`、`packages/vfsl-codegen/tsconfig.json` vs `packages/namespace-runtime/tsconfig.json`、`packages/namespace-registry/tsconfig.json` |
| B11 | EOPT 语义环境：`exactOptionalPropertyTypes: true`；Equal 助手无法区分 `{a?: string}` 与 `{a?: string \| undefined}`（E7），赋值可区分（TS2375） | `tsconfig.base.json` L10；SA6 `artifacts/sa6-issue337-type-probes.log` §(e) |
| B12 | 门禁基线（HEAD 全绿）：root typecheck / root 350 files 3841 tests / 四包 107 files 979 tests / 全 test-d 31 files 164 tests / `generate --check` | `artifacts/sa6-issue337-baseline-gates.log` |

## 3. 根因 / 能力缺口（承接 SA6 §8）

- **直接缺口**：协议类型面无 `DeepOptional`（B1 实测 12 名无该名；全仓 `*.ts` 零命中）→ ADR-0024 L92「进协议类型面与 `PathAt` 并列导出」零落地。
- **类型面缺口**：预算读无任何 deep-optional 出口——预算读价值列恒 `unknown`（B5），即 ADR-0024 L113 已否决的过保守方案是现状（SA6 P2：TS2344 实测）。
- **协议覆盖缺口**：加名不跟名单 → 碰撞守卫静默失效（B7；SA6 P5：以 `DeepOptional` 为领域别名今日 NO-THROW，假想第 13 名 → `silent=['DeepOptional']`）。
- **判别字段条件路径**：narrowing 兼容性无锚（AC3）；E5 实测 TS 5.9.3 支持（唯一 TS2322 证明窄化后 `T | undefined`，无 TS2339）→ 退路不触发。

## 4. Owner要求落实

无 Owner 评论：REST Issue-comments 读取为空（SA6 §2；SA8 §4 Overrides 表为空）。全部义务 = Issue 正文 AC1–AC4 + ADR-0024 决策 7。AC → 设计落点映射见 §12.1。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无评论） | — | — | — |

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 协议导出面 12 名、无 `DeepOptional`；`has_DeepOptional_*=false` | SA6 P1（`artifacts/sa6-issue337-export-surface.log`） | §7 决策 D-1：新增第 13 名纯类型导出 |
| 目标语义在 HEAD 不可表达（TS2305）+ 预算价值列 `unknown` ≠ deep-optional（TS2344） | SA6 P2（`artifacts/sa6-issue337-type-probes.log` §(a)） | §7 D-1/D-2：`DeepOptional` 定义 + 访问面 `readBudgeted` 落点 |
| 无 options 基线指纹（legacy 联合/`ReturnType`/typed 读/动态调用）HEAD 编译干净 | SA6 P3（同上 §(b)） | §7 D-3：零改动既有面（AC1 逐点保持） |
| 真实 runner 入口红：`TS2305 ... has no exported member 'DeepOptional'` | SA6 P4（`artifacts/sa6-issue337-runner-probe.log`） | §12.3 红灯重捕获协议（新测试文件先行落盘复红再实现） |
| 守卫敏感性：`DeepOptional` 别名 NO-THROW；假想第 13 名 → `silent=['DeepOptional']` | SA6 P5（`artifacts/sa6-issue337-guard-sensitivity.log`） | §7 D-4：`PROTOCOL_EXPORT_NAMES` 同变更集跟名（G1.7） |
| E4 语义模型实测：对象 EOPT 精确；同态数组含元素 `\| undefined`（`Q_ArrH_plain=false`）；数组显式分支 `{a?: string}[]`（`Q_ArrAware_plain=true`）、readonly 保留（`Q_ArrReadonlyAware=true`）；元组 `[string?, {a?: number}?]` | SA6 §9 E4（`artifacts/sa6-issue337-type-probes.log` §(d)/(e)） | §7 D-1 Q2 pin：三分支表示（变长数组/元组/对象） |
| E5 判别窄化实测：TS 5.9.3 支持，窄化后 `T \| undefined`（唯一 TS2322） | SA6 §9 E5 | §7 D-6：退路不启用；G4 锚定 |
| E6 载体反证：朴素 `DeepOptional<PathAt<…>>` 产 `{__brand?; __value?; __kind?}` 壳 | SA6 §9 E6 | §7 D-1 Q1 pin：值域组合 `DeepOptional<PathValue<PathAt<…>>>` + 记法桥接文档 |
| E7 Equal 盲点：`Q_Eopt_plain_vs_undef=true`（不可区分） | SA6 §9 E7 | §7 D-5 Q5 pin：Equal + 赋值负例叠加判据 |
| 与源码无矛盾 | 全部锚点复核（§2） | 无矛盾项 |

## 6. SA8约束落实

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| §8.1 名单跟名（阻塞级）：加名同变更集须在 `PROTOCOL_EXPORT_NAMES` 增 `'DeepOptional'` | §7 D-4、§11 ALLOW LIST | 落地：名单第 13 名 + 头注计数行如实更新；守卫半红转绿唯一变化 = `silent=[]` 恢复 | 是（§10(c) 核对项） |
| §8.2 现行为基准与落点钉死：无 options 分支逐点不变；`apps/yjs-server` 单参消费方不破；lease Equal 锁与「legacy 恒为最后」重载序如需变动须同变更集有意更新 | §7 D-3、§10 调用方矩阵 | **零改动** runtime/lease/yjs-server 面——落点选协议访问面（§7 D-2 论证），全部既有锁原样保持绿 | 是（§10(a) 落点确认——本设计即钉死） |
| §8.3 实现纪律：纯类型导出、零依赖、编译后空模块；零 per-schema 生成、`generate --check` 零漂移；不触 `docs/integration` 带参示例 | §7 D-1/D-4、§11、§12.2 G1.8/G5.4/G5.5 | 协议包 `dependencies` 零新增；`Object.keys` 仍 `[]`；不触生成器与生成物；不触文档 | 是（§10(c)） |
| §8.4 AC3 退路义务：仅 test-d 红灯实证后启用 | §7 D-6、§12.2 G4 | 不启用（E5 实测窄化成立）；test-d 锚定 narrowing；若实现迭代意外红灯 → 票内记录 + SA8 复核 | 条件性（当前不触发） |
| §10(a) 公共类型面/重载落点 | §7 D-2（Q3 pin + 备选否决） | 本设计钉死落点 = `VfslTypedAccess` 访问面 + 协议导出 | 是 |
| §10(b) 判别字段条件退路 | §7 D-6 | 未触发 | 否（不触发即无需） |
| §10(c) 名单/Equal 锁/零漂移/负向锚 | §12 验证映射 | G1.7/G0.2/G2.2/G5.4/G5.1/G5.2 全保留 | 是 |

## 7. 设计决策与主要备选方案

### D-1（Q1/Q2）`DeepOptional` 的域、语义与精确形态

**域（Q1 pin）**：`DeepOptional` 定义在**读值类型域**（`PathValue` 的产型域：封闭对象、模板索引签名对象、纯值数组/元组、标量、`null`、`T | undefined` 联合、判别联合），**不是**协议节点载体域。ADR-0024 L92 / CONTEXT.md L46 的记法 `DeepOptional<PathAt<…>>` 在协议导出的 doc-comment 中**显式桥接**为规范展开：

```
DeepOptional<PathAt<Map, P>>  ≡（记法速写）  DeepOptional<PathValue<PathAt<Map, P>>>
```

依据：E6 实测朴素套用节点载体产出 `{readonly __brand?; readonly __value?: string; readonly __kind?: 'leaf'}` 壳——非读值类型；`PathValue` 是载体→值的单一权威剥壳机制（`index.ts` L61–72），复用它即免第二套剥壳逻辑。

**语义（Q2 pin，三分支）**——输入分发（`T` 裸类型参数 → 条件类型对联合逐成员分发，判别联合因此逐成员映射）：

| 输入形态 | 判据 | 产型 | 依据/实测 |
|---|---|---|---|
| 变长数组 `E[]` / `readonly E[]` | `T extends readonly unknown[]` 且 `number extends T['length']` | `{ [K in keyof T]: DeepOptional<T[K]> }`（同态映射**不加** `?`）→ 元素类型递归可选化、元素保持必选（**无多余 `\| undefined`**）、readonly 修饰保留 | E4：`Q_ArrAware_plain=true`、`Q_ArrReadonlyAware=true`；G1.4 默认判据 |
| 元组 `[A, B]` | 同上但定长（`number extends T['length']` 为假） | `{ [K in keyof T]?: DeepOptional<T[K]> }` → 元素可选 + 递归 | E4：`[string?, {a?: number}?]`；诚实性：width 可裁任何定长位置（B8：plain 值域同样受预算） |
| 对象（含索引签名，含 array 载体的 `Record<`${number}`, E>` 投影） | `T extends object` | `{ [K in keyof T]?: DeepOptional<T[K]> }` → 封闭字段全可选并递归（EOPT 精确：`{a?: string}`，**不**加 `\| undefined`）；索引签名的值位变 `DeepOptional<E> \| undefined` | E4 `vObj`；EOPT（B11）。索引位加 `undefined` 非「多余」：缺席 = 查找落空，索引签名无「键省略」表示——与 D2「成员独有字段 read → `T \| undefined`」同源口径（B4） |
| 标量 / `null` / `undefined` / 字面量联合 | 其余 | 原样 `T` | E4：string / `string \| null` / `'image' \| 'text'` 原样 |

**精确形态（实现迭代按此字面化，位于 `index.ts` `PathValue` 声明之后、`PathKind` 之前）**：

```ts
export type DeepOptional<T> =
  T extends readonly unknown[]
    ? number extends T['length']
      ? { [K in keyof T]: DeepOptional<T[K]> }   // 变长数组：元素必选、递归、readonly 保留
      : { [K in keyof T]?: DeepOptional<T[K]> }  // 元组：元素可选（定长声明可被 width 截断）
    : T extends object
      ? { [K in keyof T]?: DeepOptional<T[K]> }  // 对象：全字段可选并递归；索引签名 → 值加 | undefined
      : T;                                        // 标量 / null / undefined 原样
```

**良好性质**（记录为实现核对点）：`DeepOptional<unknown> = unknown`（`unknown` 不满足任何分支前件——兜底安全，不会产出壳）；联合逐成员分发；递归经 TS 惰性求值（`VfslValueOf` 同款先例，`index.ts` L62–69）。

**域外输入声明**（doc-comment 记录，不做防御分支）：函数/类实例/`Date` 等——成功读值域不可能出现（`copyPlainStrict` 值域纪律拒之，B8）；协议节点载体（`PathSchema`/`UnknownPath`）——套用产壳（E6），规范用法是先经 `PathValue`。

**备选否决**：
- *同态 `?` 单分支映射*（`{[K in keyof T]?: ...}` 一把梭）：数组元素被强加 `| undefined`（E4 `Q_ArrH_plain=false`），违反 G1.4 默认判据——若选它须 SA8 复核改写契约，不选。
- *载体感知 `DeepOptional`（内部分支识别 `PathSchema` 并复刻剥壳）*：与 `VfslValueOf` 形成两套剥壳权威、把协议内部 brand 形状泄漏进通用类型语义、`UnknownPath` 处理纠缠——内聚性差，否决。

### D-2（Q3）落点接缝：`VfslTypedAccess` 新增预算读方法（本设计核心 pin）

**Pin：预算读类型接缝 = `@nomicore/vfsl-protocol` 的 `VfslTypedAccess<Map>` 新增第 7 方法 `readBudgeted`**（`read` 之后、`kindOf` 之前）：

```ts
readBudgeted<const P extends readonly string[]>(
  path: P,
  options: { depth?: number; maxChildrenPerNode?: number },
  ...rest: FailClosedRest<Map, P>
): DeepOptional<PathValue<PathAt<Map, NoInfer<P>>>>;
```

- 返回**值类型本身**（镜像 `read` 的 `PathValue<PathAt<…>>` 直返形态，`index.ts` L125–129）——运行时失败通道（PATH_NOT_ALLOWED/READ_OPTIONS_INVALID/released）仍在动态面（lease/runtime 结果联合），访问面是类型契约，宿主经既有单断言桥接模式（typed-access.md 步骤 6）接线；
- fail-closed 机制复用 `FailClosedRest`（未知字面量路径 → rest `[error]` → TS2554，G3.6 访问面变体：**不放松**）；
- `options` 为内联封闭结构形状（`{ depth?: number; maxChildrenPerNode?: number }`）——与 doc-runtime 单源 `NamespaceRuntimeReadDataOptions` 结构同一（T3 锚 `_optionsAlias`，`runtime-readdata-shape-budget.test-d.ts` L71–73）；协议包**不得** import doc-runtime（ADR-0004 D3 零依赖），故结构字面双站存在（残余风险 R-4）；
- Map 泛型参数化——无全局增广耦合，测试可用本地表（B9 先例），零碰撞纪律负担；
- 谱系：L91「无 options 保持 `PathAt` 完整子树承诺」与 L92「带 options → `DeepOptional`」是**同一类型读面**的一对分叉——该承诺今天活在 `VfslTypedAccess.read` 与宿主适配器（SA8 §8.2 明文），budget 承诺与之并列即 `read` / `readBudgeted` 两签名。root AGENTS typed-access 段的教义（动态 `readData` 面向 runtime-shaped data；typed 读用 `PathAt`/`PathValue`）与本 pin 一致。

**主备选（SA6 G3.1「主候选」：泛型化 runtime/lease `readData` 预算重载）——否决，理由链**：

1. **架构耦合**：`namespace-runtime` 现无 `@nomicore/vfsl-protocol` 依赖（B5/SA8 §8.2）；泛型化需新包图边 + runtime 公共 `.d.ts` 引用全局增广接口 `VfslPathMap`——**schema 无关运行时（ADR-0008）的公共类型语义变为 Program 相关**（未增广程序恒 `unknown`；增广程序才见结构），该包先例为零。
2. **发布面影响**：增广宿主程序中字面量预算调用的 `value` 从 `unknown` 收窄为 `DeepOptional<…>`——宿主既有 `result.value as SomeScalar` 断言（`unknown as string` 合法）会变 TS2352；按 ADR-0024 L69 先例须三包 minor bump + 已知消费方枚举，波及面与「纯类型票」的 G5.5 最小改动面纪律相悖。
3. **在库脆弱面**：typed-stub 编译锁（B6）依赖「`ReadDataOkShape` ⊆ 预算联合成功成员」可赋值性；泛型化后该赋值经 TS 目标签名擦除到约束（`P → readonly (string|number)[]` → `PathAt` 非 元组 → `never` → 守卫 → `unknown`）仍绿——但绿依赖擦除语义这一非显然机制，锁的解释成本与脆弱度上升；且退化为「未增广程序 root 预算读 value = `{}`」的怪异形态。
4. **契约自洽**：SA6 G3.6 自身为访问面落点预置了断言迁移条款（「无 options 仍 `PathValue<PathAt<…>>`、预算方法返回 `DeepOptional<PathValue<PathAt<…>>>`、未知路径仍编译错误」），§12.3 亦预置 `vfsl-protocol-budget-access.test-d.ts` 行——访问面是契约 sanctioned 的落点，非契约外选择，无需原位修订 SA6 契约。
5. **改动面**：访问面落点总改动 = 2 个源文件 + 2 个新测试文件（§11）；runtime 落点 = 4 处签名 + 2 个别名 + 依赖边 + lockfile + 增广夹具纪律——防御性取舍取前者。

**其余落点**：宿主适配器文档面单独落点 = T5 面（SA8 §8.3 禁本票代落）；组合落点（runtime + 访问面）继承 runtime 落点全部成本——均否决。

### D-3（AC1/Q6 侧）无 options 基线零降级 = 零改动

本设计**不触碰** runtime/lease `readData` 任何签名、别名、Equal 锁与重载序；不触碰 `read`/`patch`/`kindOf`/序列编辑三件套与 `PathPatchValue`/`PathElementValue`（写投影零改动——Q6 后半句）；`apps/yjs-server` L609 单参动态消费方零影响。AC1 由「零 diff + 既有锚全绿」逐点成立（G2.1–G2.5 全部无改动保持）。

### D-4（Q8 + SA8 §8.1）导出面与名单跟名

- `DeepOptional` **只**从 `@nomicore/vfsl-protocol` 出口（ADR-0024 L92 字面）；不从 `@nomicore/vfsl`、runtime、registry 或任何包再导出；`readBudgeted` 是既有导出 `VfslTypedAccess` 的方法加法，不构成第 14 名。
- 同一变更集在 `packages/vfsl-codegen/src/protocol-surface.ts` 的 `PROTOCOL_EXPORT_NAMES` 增补 `'DeepOptional'`（集内排在 `'VfslPathMap'` 后或 `'PathValue'` 邻位均可，集合无序）；头注「实测导出 12 名（2026-08-21 基点）」计数行**如实**追加一行 T4 增补注记（不静默改写历史基点描述）——单文件单处更新（该文件头注明文纪律）。
- 纯类型纪律：`index.ts` 全部为 type 声明/导出；`vfsl-protocol-empty-module.test.ts` 的 `Object.keys === []` 无改动保持绿；`package.json` `dependencies` 保持为零。

### D-5（Q5）断言判据形态（test-d 实现迭代按此写）

每条语义断言 = **相等 + 赋值双向**叠加（Equal 盲点对策，E7）：

1. 正例相等：`expectTypeOf<DeepOptional<X>>().toEqualTypeOf<手写独立 oracle>()`（oracle 手写，不引用被测类型自证——dogfood 测试纪律）；
2. EOPT 赋值负例：`// @ts-expect-error` 于 `{ a: undefined }` 赋给 `{a?: string}` 目标（TS2375 在 EOPT 下确实红；非 EOPT 实现会放行该行 → 自反转失败，即变异 D2 探针）；
3. 可选性正例：`const empty: DeepOptional<X> = {}` 编译通过；必填用法负例：`// @ts-expect-error`（把预算值当必填形状用）；
4. 在场标量精确：`NonNullable<BudgetValue['kind']>` Equal `'image' | 'text'`（字面量联合不宽化）+ 直接可赋值性；
5. 差分锁：同一路径 `read` 产型（完整）与 `readBudgeted` 产型（可选）**形状分叉**——完整 → 可选方向可赋值（`{a: string}` → `{a?: string}`，EOPT 下成立）、反向 `// @ts-expect-error`。

### D-6（AC3）判别字段 narrowing 与退路裁决

- `DeepOptional` 对判别字段**不豁免**（ADR-0024 L94）：`DeepOptional<Entity>` = `{kind?: 'image'; url?: string} | {kind?: 'text'; body?: string}`（G1.5，E4 `vEntity` 实测同形）。
- G4 锚（两处：协议语义文件 + 访问面文件）：对预算值 `switch (v.kind) { case 'image': … }` 与 `if (v.kind === 'image')` ——成员独有字段可访问（无 TS2339，锚 = 该访问行**无** `@ts-expect-error` 而编译通过）；窄化后类型精确 `T | undefined`（锚 = `// @ts-expect-error const s: string = v.url`，TS2322）。
- **退路裁决：不启用**。依据 E5 实测（TS 5.9.3 支持可选判别字段窄化，唯一诊断为 TS2322 而非 TS2339）。若实现迭代落盘 test-d 时意外实证 TS 不容（红灯非 TS2322 形态）→ 按契约 G4.3：票内记录证据与结论、修订 G1.5/G4、触发 SA8 复核——本设计不预防性豁免。

### D-7（Q6）未知路径与失败面

访问面：未知字面量路径 → `FailClosedRest` rest 标记 `[error: '路径不可解析 (UnknownPath)']` → 调用缺参 TS2554（与 `read` 同机制同文）——**编译期拒绝，不放松**。动态（非字面量）`string[]` 路径：`PathAt` → `never` → 返回 `never`——访问面本就仅承诺字面量路径（`const P` + rest 门），动态读的既有归宿是动态面 `lease.readData(path, options)`（本票零改动，value 仍 `unknown`，G3.6 动态面由既有行为继续满足）；`ok:false` 结果面、`READ_OPTIONS_INVALID`、released 通道全部零接触。宿主适配器把 `readBudgeted` 的类型接到 `lease.readData(path, options)` 结果时，失败分支照既有结果联合处理——类型面不越权描述失败。

### Q4/Q7（runtime/lease 泛型化问题）处置

按 D-2 落点选择，runtime/lease 公共结果别名**不泛型化**：`NamespaceRuntimeReadDataBudgetResult`/`NamespaceLeaseReadDataBudgetResult` 保持非泛型、`value: unknown`；Equal 锁与「legacy 恒为最后」重载序零变动。SA6 §15 Q4/Q7 所设义务随落点否决而消解（其前提「若落 runtime/lease 公共面」不成立）。

## 8. 接口、状态机与数据流

**接口变化（仅两处源文件）**：

1. `packages/vfsl-protocol/src/index.ts`：
   - `PathValue` 之后新增 `export type DeepOptional<T>`（§7 D-1 精确形态 + doc-comment：ADR-0024 决策 7 引注、值域契约、`DeepOptional<PathAt<…>>` 记法桥接声明、域外输入声明、判别字段不豁免、预算读非写前快照警示）；
   - `VfslTypedAccess<Map>` 的 `read` 之后新增 `readBudgeted` 方法（§7 D-2 签名 + doc-comment：L91/L92 分叉说明、fail-closed rest、options 结构与 doc-runtime 权威校验的关系）。
2. `packages/vfsl-codegen/src/protocol-surface.ts`：名单 +1 名 + 头注计数注记。

**状态机**：无——纯类型面，零运行时状态。**数据流**：无运行时数据流变化（依据：全部改动为 type 声明与 const 名单字符串；`tsc --emit` 后协议包仍为空模块；runtime/registry/doc-runtime 零 diff）。类型级数据流（编译期）：

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 类型投影 | 消费方 Program（宿主/测试）对 `readBudgeted(literalPath, options)` 调用点 | 无（编译期） | `P → PathAt<Map, NoInfer<P>> → PathValue → DeepOptional`（协议包内三段组合） | `.d.ts` 面 | 调用点返回类型 | 全字段可选值类型；未知路径 TS2554；字段必用 TS2322 | 编译错误即失败（fail-closed）；无清理 | G1/G3/G4 锚（§12.2） |

## 9. 错误、恢复、并发和幂等

- **错误**：全部编译期——未知路径 TS2554（rest 门）、预算值必填误用 TS2322/TS2339、EOPT 违例 TS2375、options 形状外键 TS2353（内联封闭形状拒绝 `schema: true` 等——与「预算参数不是 schema opt-in」一致且更严）。运行时失败语义（READ_OPTIONS_INVALID 等）零改动。
- **恢复/回滚**：变更纯加法、无状态——回滚 = revert 两源文件 + 删两测试文件；生成物、lockfile、其他包零触及（§13）。
- **并发/幂等**：不适用（零运行时）；类型求值确定性（SA6 §7：重复编译逐字节一致）。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `VfslTypedAccess` 测试消费者（protocol projection/empty-fail-closed、codegen narrow、vfs3-assets projection/migration） | `declare const access` 消费六方法 | 加法第 7 方法；无方法集穷尽锚 | **零改动**（B3 grep 证据） | §2 B3 |
| `apps/yjs-server` `lease.readData(path)`（L609，单参动态） | 命中 legacy 重载 | 完全不变 | 零改动；root typecheck 保护 | §2 B5；`app.ts` L609 |
| runtime/lease 行为与类型测试（T3 系、budget-passthrough、typed-stub 全家） | 绿（B12） | 全部面零 diff → 仍绿 | 零改动（含 `readdata-ok-shape.ts` 编译锁——不动即不破） | §2 B5/B6 |
| `generate-alias-collision-guard.test.ts` | 12 名逐一必抛、`silent=[]` | 实现序中间态红（导出名先落、名单未跟）→ 同变更集跟名后绿（13 名） | 零测试改动；**实现序纪律**：两处同 PR | §2 B7；SA6 P5 |
| 发射器 `generateProjection`（领域别名碰撞守卫） | `DeepOptional` 别名静默通过（今日名单无该名） | 名单含该名后：领域别名 `DeepOptional` → 必抛 `alias-protocol-export-collision`（fail-closed 方向加严） | 零改动；行为变化 = 守卫扩一名（预期内） | §2 B7；`protocol-surface.ts` L8–11 |
| 外部宿主（typed-access 适配器模式） | `read<P>(path): PathValue<…>` 单断言桥接 | 可选增 `readBudgeted`（包装 `lease.readData(path, options)`，同一桥接模式）；既有 `read` 零影响 | 宿主自择（T5 文档同步归 #338）；无破坏（接口加法只影响「实现」该接口者——宿主是消费者） | `.agents/skills/nomicore/typed-access.md` L41–46；B3 |
| `VfslTypedAccess` 的外部实现者（如存在） | 六方法 | 须补第 7 方法 | 在库零实现者（B3）；外部风险记 R-5（0.x minor bump 纪律） | §2 B3；ADR-0024 L69 |
| `domains/*/generated.ts` / 生成器 | 仅 import `PathSchema` 一名 | 零变化（`PROTOCOL_IMPORT_LINE` 不动、输出规格不动） | 零改动；`generate --check` 零漂移 | `protocol-surface.ts` L18–19；ADR-0005 |

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/vfsl-protocol/src/index.ts` | ① `PathValue` 后新增 `export type DeepOptional<T>`（§7 D-1 形态 + doc-comment 含记法桥接）；② `VfslTypedAccess.read` 后新增 `readBudgeted` 方法（§7 D-2 签名 + doc-comment） | ADR-0024 L92 协议类型面 + L91/L92 分叉的访问面落点（D-1/D-2） |
| `packages/vfsl-codegen/src/protocol-surface.ts` | `PROTOCOL_EXPORT_NAMES` 增 `'DeepOptional'`（13 名）+ 头注计数注记一行 | SA8 §8.1 阻塞级名单跟名义务（D-4） |
| `packages/vfsl-protocol/test/vfsl-protocol-deep-optional.test-d.ts` | 新增（G1.1–G1.6 + G4 语义锚；本地手写类型 + 本地 map 类型组合，零 `declare module` 增广——B9 隔离先例） | AC2/AC3 语义面红灯/绿灯（§12.2） |
| `packages/vfsl-protocol/test/vfsl-protocol-budget-access.test-d.ts` | 新增（G3 访问面镜像锚 + G2.3 差分回归 + G4 接缝窄化；本地 `LocalMap` 表） | AC2 接缝面 + AC1 差分锁（§12.2） |

实现序（红灯纪律，SA6 §13）：**先落两测试文件在 HEAD 复跑捕获红**（预期：TS2305 `DeepOptional` 不存在 + TS2339 `readBudgeted` 不存在；协议包 tsc 因 `test/**` 纳入而连带红——与 #24/#335 先例同款）→ 再改两源文件 → 全门禁。

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/namespace-runtime/src/**`、`packages/namespace-registry/src/**`（含 `runtime.ts`/`lease.ts`/`types.ts`） | SA6 G3.1 主候选落点 | 本设计 D-2 否决该落点；AC1 零降级最稳实现 = 零 diff；Equal 锁/重载序/stub 编译锁全保持 |
| `packages/namespace-runtime/package.json`、`packages/namespace-registry/package.json`、`pnpm-lock.yaml` | runtime 落点的依赖边 | 落点未选；协议包 `dependencies` 保持为零（G1.8） |
| `packages/doc-runtime/**`、`packages/vfsl/**` | T1/T2 已落预算通道 | 类型票零运行时变更（ADR-0008 修订节边界） |
| `domains/**`（schema.vfsl、generated.ts、测试） | 判别联合 fixture 来源 | 零 per-schema 生成（ADR-0024 L92）；生成物禁手改（domains/AGENTS） |
| `docs/integration/**`、`.agents/skills/nomicore/typed-access.md` | 预算读示例/纪律文档 | 归 T5 #338；现行负控正则禁一切带参示例（SA8 §8.3） |
| `docs/adr/**`、`CONTEXT.md` | 母法与词条 | 决策已立法；词条 L45–47 已含口径；ADR 回填归 PR #332/T5 |
| `packages/vfsl-codegen/src/**`（除 protocol-surface.ts） | 发射器/输出规格 | 生成器输出规格冻结；`PROTOCOL_IMPORT_LINE` 不动 |
| 既有测试文件（protocol 3 个、codegen 守卫、runtime/registry T3 系、vfs3-assets 4 键锚、empty-module、readdata-docs 负控 fixture） | 回归/负控面 | G0/G2 全绿基线 = 零改动保持（G5.5）；文档负控正则修订归 T5 |
| `apps/**` | 消费方 | yjs-server 单参动态调用零影响；无 app 改动需求 |

## 12. 验收与验证映射

### 12.1 AC → 设计落点

| Issue AC | 断言组（SA6 §12.2） | 本设计落点 | HEAD 预期 → 目标 |
|---|---|---|---|
| AC1 无 options 静态类型零降级 | G2（+G0.4） | D-3：零 diff；G2.1–G2.5 既有锚无改动保持 | 绿 → 绿 |
| AC2 全字段可选/标量精确/数组递归 | G1（语义）+ G3（接缝·访问面变体） | D-1/D-2/D-5：`DeepOptional` + `readBudgeted` + 判据 | 红（TS2305/TS2339）→ 绿 |
| AC3 判别 narrowing test-d 锚定 | G4 | D-6：两文件 narrowing 段；退路不启用 | 红 → 绿（E5 实测形态） |
| AC4 负向锚保持红 + 全门禁 | G0/G5 | D-4 名单跟名 + §12.3 门禁 | 绿 → 绿（守卫中间红仅实现序内） |
| SA8 §8.1 名单 | G1.7 + G0.2/G0.5 | D-4 | 守卫红（加名未跟时）→ 绿（13=13） |
| SA8 §8.2 基准与落点 | G2 + Q3–Q7 | D-2/D-3/D-7（Q4/Q7 消解） | 指纹绿 → 绿 |
| SA8 §8.3 纪律 | G1.8/G5.4/G5.5 | D-4 + §11 范围 | 绿 → 绿 |

### 12.2 测试锚规格（定义，不落盘；ADR-0004 D4 装置）

**文件 1 `packages/vfsl-protocol/test/vfsl-protocol-deep-optional.test-d.ts`（G1.1–G1.6 + G4）**：

- G1.1：`import type { DeepOptional } from '@nomicore/vfsl-protocol'` 编译（HEAD 红 TS2305）；
- G1.2 对象：`Equal<DeepOptional<{a: string; n: {b: number}}>, {a?: string; n?: {b?: number}}>`；`const o: DeepOptional<…> = {}` 正例；部分赋值 `{n: {}}` 正例；`// @ts-expect-error` 于 `{a: undefined}`（EOPT 负例，变异 D2 探针）；`// @ts-expect-error` 于必填误用（`obj.n.b` 当 `number` 用）；
- G1.3 标量：`DeepOptional<string>`=`string`；`DeepOptional<string | null>`=`string | null`；`DeepOptional<'image' | 'text'>`=`'image' | 'text'`；`DeepOptional<unknown>`=`unknown`（兜底性质锚）；
- G1.4 数组三态：`DeepOptional<{a: string}[]>`=`{a?: string}[]`（元素**无** `| undefined`——`Equal<DeepOptional<{a:string}[]>[number], {a?: string}>`）；`DeepOptional<readonly {a: string}[]>`=`readonly {a?: string}[]`；`DeepOptional<[string, {a: number}]>`=`[string?, {a?: number}?]`；`DeepOptional<Record<`${number}`, string>>` 的 `V['0']`=`string | undefined`（索引缺席口径）；嵌套递归 `DeepOptional<{list: {a: string}[]}>=` `{list?: {a?: string}[]}`；
- G1.5 判别联合：`Equal<DeepOptional<Entity>, {kind?: 'image'; url?: string} | {kind?: 'text'; body?: string}>`（不豁免）；
- G1.6 桥接：本地 map 类型 `type M = { label: PathSchema<string, 'leaf'>; box: PathSchema<{n: PathSchema<number, 'leaf'>}, 'map'>; … }`——`Equal<DeepOptional<PathValue<PathAt<M, ['box']>>>, {n?: number}>`；负例：`DeepOptional<PathAt<M, ['label']>>`（载体直套）`// @ts-expect-error` 当 `string` 用（壳非值——域外用法锚）；
- G4：`switch (v.kind)` / `if (v.kind === 'image')` 两形态——成员独有字段访问行**无** expect-error（无 TS2339）；`// @ts-expect-error const s: string = v.url`（TS2322，`T | undefined`）。

**文件 2 `packages/vfsl-protocol/test/vfsl-protocol-budget-access.test-d.ts`（G3 访问面 + G2.3 差分 + G4 接缝）**：

- 本地 `interface LocalMap { label: PathSchema<string,'leaf'>; kind: PathSchema<'image'|'text','leaf'>; box: PathSchema<{n: PathSchema<number,'leaf'>},'map'>; ents: PathSchema<Record<string, PathSchema<Entity,'map'>>,'map'>; kw: PathSchema<Record<`${number}`, PathSchema<{v: PathSchema<string,'leaf'>},'map'>>,'array'>; plainArr: PathSchema<{a: string}[], 'plain'> }`（顶层键与一切既有增广零碰撞——B9 键清单；本地接口非 `declare module`，程序级零泄漏；`plainArr` 取对象元素纯值数组以锚 plain 值域的数组分支）；
- G3.1：`Equal<access.readBudgeted(['box'], {depth: 0}), {n?: number}>`；实体路径 → 判别联合可选形；数组载体路径（`kw`）→ `Record<`${number}`, {v?: string} | undefined>` 索引形；plain 数组路径（`plainArr`）→ `{a?: string}[]` 形（元素无多余 `| undefined`）；
- G3.2 差分：同一路径 `access.read(['box'])` 仍 Equal 完整形 `{n: number}`（**不含**可选化泄漏——AC1 差分锁）；完整值可赋给预算形（正例：`{n: number}` → `{n?: number}`）、反向 `// @ts-expect-error`；
- G3.3：`const b = access.readBudgeted(['box'], {depth: 0}); const empty: typeof b = {}` 正例（注意不得经 `ReturnType` 取型——泛型方法返回型会擦除到约束退化为 `never`）；必填误用负例（`// @ts-expect-error const n: number = b.n`）；
- G3.4：`NonNullable<BudgetValue['kind']>` Equal `'image' | 'text'`；
- G3.6：`// @ts-expect-error access.readBudgeted(['noSuchKey'], {depth: 0})`（TS2554 rest 门）；`// @ts-expect-error` 缺 options 实参；`// @ts-expect-error` options 形状外键（`{depth: 1, schema: true}` → TS2353）；
- 根路径 D5：`access.readBudgeted([], {depth: 1})` → `DeepOptional<LocalMap 值>`（`{}` 可赋值正例 + 自有键 `label` 访问为 `string | undefined` 锚）；
- G4 接缝镜像：预算实体值上 `switch/if` 窄化（同文件 1 形态）。

### 12.3 验证门（实现完成后全部通过；含 HEAD 红灯重捕获前置步）

```bash
# 0) 红灯重捕获（测试文件先落盘）：预期 TS2305 + TS2339 红且既有 3 文件仍绿
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/vfsl-protocol/test --typecheck --passWithNoTests=false
# 1) 包级
pnpm exec tsc -p packages/vfsl-protocol/tsconfig.json
pnpm exec tsc -p packages/vfsl-codegen/tsconfig.json
# 2) root 全门
pnpm typecheck
pnpm generate --check
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run \
  packages/vfsl-protocol/test packages/vfsl-codegen/test \
  packages/namespace-runtime/test packages/namespace-registry/test \
  --typecheck --passWithNoTests=false
NODE_OPTIONS=--conditions=nomicore-source pnpm test
```

**变异敏感性**（SA6 §12.5 D1–D10 全数沿用，落点映射更新）：D1（只加名单不实现/拼写漂移）→ G1.1/G1.7 红；D2（非 EOPT）→ 文件 1/2 的 `{a: undefined}` 负例自反转；D3（浅层不递归）→ 嵌套断言红；D4（数组元素多余 undefined/丢 readonly/元组表示漂移）→ G1.4 红；D5（判别豁免）→ G1.5/G4 红；D6（载体直套当值型）→ G1.6 负例放行 → 红；D7（无 options 面被污染）→ 因零改动本不可发生；若发生 → 既有 projection/migration 锚 + root typecheck 红；D8（lease 别名/重载序漂移）→ 同上不可发生路径；D9（运行时值/依赖/生成物泄漏）→ empty-module/`generate --check` 红；D10（结果面加键）→ 不可发生（结果联合零接触）。

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 等级 | 处置 |
|---|---|---|---|
| R-1 | TS 实例化深度：`DeepOptional` 递归映射在病态深 schema 上可能触 TS2589/编译变慢 | 低 | 值域为有限 schema 投影（`VfslValueOf` 同款递归先例）；SA6 §7 不设时序门禁，以 root 门禁覆盖；若某域实测触发 → 票内记录 + 单独评估（不在本票预防） |
| R-2 | 判别窄化 TS 版本敏感（E5 基于 5.9.3；TS 升级改变行为时 G4 锚会先红） | 低 | G4 锚即哨兵；触发时按 G4.3 退路条款处理（记录 + SA8 复核） |
| R-3 | 元组/readonly 数组仅在 plain 终态值域出现（B4），test-d 覆盖它们属域内防御 | 信息 | 文件 1 锚之（G1.4 三态）；表示 pin 已按诚实性论证（width 可裁定长位置） |
| R-4 | options 形状双站字面（协议内联 vs doc-runtime 单源别名）漂移风险 | 低 | 两侧均有 Equal 锚（T3 `_optionsAlias` + 文件 2 的形状负例 TS2353）；doc-runtime 演进时 T3 锚先红强制同步；跨包单源合并属后续演进（记录，不在本票加依赖边） |
| R-5 | `VfslTypedAccess` 公共接口加法对外部「实现者」是破坏面（在库零实现者，B3） | 低 | 0.x minor bump 先例（ADR-0024 L69）随 `@nomicore/vfsl-protocol` 发布流处理；实现说明记录 |
| R-6 | 实现序纪律：导出名先落而名单未跟 → 守卫中间红 | 流程 | 同一变更集强制成对（§11 实现序）；SA8 §10(c) 复核核对项 |
| R-7 | `DeepOptional<PathAt<…>>` 记法（ADR/CONTEXT/issue 原文）与本设计值域展开的读者歧义 | 中 | 协议 doc-comment 显式桥接声明（D-1）；T5 #338 文档同步时在作用域文档沿用同一展开口径（本票不触文档） |

**回滚**：revert `index.ts` + `protocol-surface.ts` 两文件、删除两测试文件——无迁移、无状态、无 lockfile、无其他包 diff；守卫回到 12 名基线。

**明确的 follow-up（非本票义务）**：T5 #338——typed-access 预算纪律文档（`readBudgeted` 宿主接线示例与「预算读一律可选访问/非写前快照」条款）、文档负控正则修订、`docs/integration` 形状注记、ADR 0008/0016 回填。本票为其提供类型面前提。

## 14. 评审修订映射

本 iteration 无 SA2 评审输入（`wiki/raw/task_issue-337_sa2_review.md` 不存在）。无适用 finding。

## 15. 是否需要设计后 ADR 冲突复查

**需要（`requiresConflictRecheck = true`）**。理由：

1. 公共协议类型面加法：第 13 名导出 + `VfslTypedAccess` 第 7 方法（公共 API 变化——SA8 §10(a) 直接对象）；
2. 本设计钉死 SA8 §10(a) 的落点裁决（访问面而非 runtime/lease 面）与 Q1/Q2 表示 pin（记法桥接、数组/元组/索引签名三态表示）——SA8 后置复核应核对这些 pin 与 ADR-0024 决策 7、ADR-0004 D2/D3/D5 的一致性；
3. 名单跟名 / Equal 锁零变动 / 生成物零漂移 / 49 条既有负向锚保持红，均需实现后逐项核对（SA8 §10(c)）；
4. 判别字段退路（§10(b)）当前不触发（E5 证据），条件路径保持登记。

母法本身零修订：本设计不触碰任何 ADR 条款、不产生新决策面（ADR-0024 决策 7 已立法；CONTEXT.md 词条已含口径）。
