# SA1 实现设计 — issue #364：T2 readData 投影文本化原子切换（恒四键、✂ 单一截断载体、组合层退役）

- 任务：`wiki/raw/task_issue-364.md`（Host brief，Issue #364，REST comments 为空）
- 上游契约：`wiki/raw/task_issue-364_sa6_contract.md`（approve，CT-1..CT-10 + 附录 A/B/C）
- SA8 前置门禁：`wiki/raw/task_issue-364_relevant_decisions.md` + `wiki/raw/task_issue-364_conflict_report.md`（verdict **clear**，`requiresConflictRecheck: true`）
- 设计基线 HEAD：`f8a06fea4285a61bf0f48570b0269d47dfa03fb0`（分支 `mabf/issue-364` = `origin/adr0027-projection-text` tip；本设计全部源码锚点在该 HEAD 实读复核）
- 本设计为执行票设计：**不含实现代码、不含验收测试本体**；生产/测试/文档改动交 SA3/SA7 按本文件落成。

---

## 1. 任务类型、目标与非目标

**任务类型**：Feature（交付形态换代）+ Refactor 面（detach 深拷贝层退役、消费测试翻新）——与 SA6 §1 判定一致；无 Bug 根因链可复现（缺口 = 已接受决策 ADR 0027 决策 1/4 未实现）。

**目标**（一次原子切换，落地即全绿，无中间态）：

1. `readData` 成功分支坍缩为**恒四键** `{ ok, value, schema, truncated }`：`schema` = 投影文本（`string`）或 `null`；结构化 `truncations` 键删除；`truncated` 布尔保留为机器信号。
2. 投影文本组装序：组合层前贴头行（实参 path + 有效预算）→ `renderProjectionText`（T1，冻结）正文 → ✂ 段（渲染器内部块序）。
3. 投影 detach 深拷贝层退役：渲染器进程内直读 resolver 产物，文本（原始值）天然 detached。
4. 结果类型坍缩：两联合的**成功成员同一四键类型**；联合名与双重载签名保留（CT-8 解释，见 §7-D3）；registry lease 类型别名跟随、透传零语义变化。
5. `schema: null` 三情形单义直通（严格 null，非空串）；失败分支形状/语义/定序零变化；options 闭合形状 `{ depth?, maxChildrenPerNode? }` 零变化（校验、失败码、三层透传不动）。
6. 仓内全部 readData 消费测试翻新（恒五键 / JSON 投影深等 → 恒四键 / 文本断言）+ 作用域文档与文档负控 fixture 词汇重录。

**非目标**：

- 不改 ADR 0027 / 0016 / 0024 正文（历史记录；修订指针已登记）；不新增 ADR；CONTEXT.md 只做零漂移核对（J7）。
- 不改渲染器（`packages/vfsl/src/render-projection-text.ts` 行为零变化；144 条 T1 测试是冻结基线）；不改 resolver 输出契约（JSON 四件套仍是渲染器输入）。
- 不改值通道（doc-runtime 递归、截断两形态、E1 吸收纪律、`ReadLogicalValueTruncationEntry` 形状全部冻结）。
- 不改版本号 / 发布链（AC10：破坏性 minor bump 归发布流程）；DSH 探针工具零代码改动（ADR 0027 决策 5）。
- 不做 schema 文本缓存（ADR 0027 开放问题挂起；本设计每次读重新渲染，B4 无陈旧文本）。

## 2. 当前行为与证据锚点（HEAD `f8a06fe` 实读）

| # | 事实 | 锚点 |
| --- | --- | --- |
| CB1 | readData 成功分支两处恒五键组装：无预算 `runtime.ts` L572–578、预算 L600–606；`schema` 位 = `projectReadDataSchema` 的 detached 对象 | `packages/namespace-runtime/src/runtime.ts` L552–607 |
| CB2 | 结果联合双名在场：`NamespaceRuntimeReadDataResult`（L148–157，legacy 联合注释明文「不含 READ_OPTIONS_INVALID（零泄漏）」）与 `NamespaceRuntimeReadDataBudgetResult`（L163–172）；成功成员 schema 分别为 `ReadDataSchemaProjection \| null` / `BudgetedReadDataSchemaProjection \| null`，均带 `truncations: readonly ReadLogicalValueTruncationEntry[]` | 同上 L137–172 |
| CB3 | 投影组合单点 `projectReadDataSchema`：状态守卫（`schemaState !== 'ready'` → null）→ 敌意 path 规范化（`normalizeReadPath`，内层 try 只包扫描）→ `resolveSchemaAtPath` 两/三参显式分流 → **整体深拷贝**（`detachReadSchemaProjection` L142–156 + `cloneValueSchema` 10-case 分派 L169–255 + `cloneDiscriminator`/`cloneNumberRecord`/`cloneDocsRecord` L259–303） | `packages/namespace-runtime/src/read-schema-projection.ts` L61–94、L134–303 |
| CB4 | InternalError 唯一逃逸通道：模块对 resolver 调用零 try/catch；敌意 path 收敛 null 绝不外抛（`normalizeReadPath` L114–132） | 同上 L83–93、L114–132 |
| CB5 | 预算读编排：lifecycle gate 先行（L565–568）→ T1 三参值读 → 失败原样透传 → `canonicalReadOptions` 接缝净化（L587，实现 L834–861：Object.keys 键空间 + descriptor 取值 + 零 `[[Get]]` + present-undefined 剥离 + -0 归一）→ 净化失败两出口（重派发 / `seamReadOptionsInvalid` L588–599）→ 投影只吃 canonical（L603） | `runtime.ts` L557–607、L818–884 |
| CB6 | 渲染器已公共导出但生产面零接线：`packages/vfsl/src/index.ts` L154–155 导出 `renderProjectionText` + `ProjectionTruncation`；`grep renderProjectionText packages/*/src \| grep -v vfsl/src` → 0 命中（本次复核 = SA6 E5）；头行 `# readData` src 树 0 命中（= SA6 E4） | `packages/vfsl/src/render-projection-text.ts` L135–169 |
| CB7 | 渲染器签名冻结：`renderProjectionText(projection, truncations?)` 零选项、同步、纯函数；`truncations` 缺席/`undefined`/`[]` 三态输出逐字节相同；输出以恰一个 `\n` 结尾；✂ 段 path 记法 = `entry.path.length === 0 ? '[]' : map(foldText(String(seg))).join('.')`，`foldText = replace(/\r\n\|\n\|\r/g, ' ').trim()` | 同上 L128–169、L984–1002 |
| CB8 | `ProjectionTruncation`（vfsl L44–51）与 `ReadLogicalValueTruncationEntry`（`doc-runtime/src/read.ts` L88–92）结构同构 `{path, kind:'depth'\|'width', omitted}`——组合层零 cast 透传由结构类型保证（T1 §12.2 双向锚定 = CT-8 H6） | 两文件实读 |
| CB9 | lease 透传：`leaseReadData` released 短路先于一切透传，active 期 raw options 引用原样直传（`lease.ts` L282–295）；Equal 组合锁在场（L410–421：`_readAlias` / `_readBudgetAlias` / `_readOverloadOrder`）；别名定义 `types.ts` L450–459（JSDoc 含「五键成功面」词汇） | `packages/namespace-registry/src/lease.ts`、`src/types.ts` |
| CB10 | `ReadLogicalValueTruncationEntry` 公共转出仅在 `namespace-runtime/src/index.ts` L46；仓内从 `@nomicore/namespace-runtime` 导入该符号的只有 `runtime-readdata-shape-budget.test-d.ts` L20–21（其 `Equal<LegacyOk['truncations'], …>` 锁本票删除）——无其他消费者（本次 grep 复核） | 实测 grep |
| CB11 | 消费面：`apps/yjs-server/src/app.ts` L609 只消费 `.ok`/`.value`；`packages/ws-replication/src/testing.ts` L47 只做 `lease.readData.bind(lease)`；测试树 `truncations` 断言分布 17 文件（runtime/registry 两树 + doc-runtime 自身 + vfsl 渲染器自己的 fixture） | 实测 grep |
| CB12 | 测试形状收敛仪器：`readdata-ok-shape.ts`（`READDATA_OK_KEYS` 五键、`ReadDataOkShape`、`readDataOk`/`expectReadDataOk`/`expectReadDataOkKeys`，反伪绿不变量 = 两侧独立构造）；`readdata-shape-assertion-scan.ts`（`SUCCESS_SHAPE_KEYS` 五键、family A/B AST 检测器）；收敛门测试 + 文档 fixture（`hasFourKeyParagraph` = valueSchema+aliasDocs、`staleAnnotationViolations` 现谓词要求 schema+truncated+truncations 全在场、`adr0016Refs` 只认 0016） | 对应文件实读 |
| CB13 | 基线绿：聚焦家族 15 文件 276 tests、根 typecheck exit 0、根测试 381 files / 4540 tests（SA6 §4/§13 实测，日志 `task_issue-364_sa6_baseline.log`）；红灯签名 = 恰四键断言处红、received 多 `truncations`（SA6 E2，`task_issue-364_sa6_probe.log`） | SA6 契约 §4/§5/§13 |

## 3. 根因 / 能力缺口

**缺口**：readData 投影通道仍是「JSON 四件套对象 + 结构化 truncations 键」，而 ADR 0027（已接受，2026-09-14）决策 1/2/4 要求「投影文本（头行 + 渲染器正文 + ✂ 段）+ 恒四键 + detach 退役」。渲染器 T1 #363 已合入 HEAD 但生产面零接线（CB6）；头行无实现；父分支 tip ≡ HEAD，无任何 T2 实现可复用（SA6 §8 Step 6）。因果实验：同一 HEAD 只加目标断言即红（E2），删掉即绿——红因可归因到 `truncations` 键与 schema 类型。

**放大因素**：消费测试与文档把旧形状字面写死（恒五键 / 四件套 / truncations），且类型面 Equal 锁使「半截双形态」编译不可行——这正是 issue 要求原子切换的约束来源（SA6 §8 Step 7、E7）。

## 4. Owner 要求落实

Issue REST comments 快照为空（dispatch 明示 none）——无 owner 逐字判据、无 comment ID 需要转写。契约判据全集 = issue body（What-to-build 5 条 + AC 10 条）+ ADR 0027 决策 1/2/3/4/5 + SA6 CT-1..CT-10。逐条映射：

| Issue 要求 | 设计落点 |
| --- | --- |
| 无条件文本化、一次调用返回四键 | §7-D1/D2/D5、§8 |
| 组装序（头行 → renderProjectionText → ✂） | §7-D1、§8 数据流 |
| detach 深拷贝层退役（文本天然 detached） | §7-D4、§9 |
| 结果类型坍缩为单一四键形（双结果联合消失）；lease 别名跟随、透传零语义变化 | §7-D3（CT-8 解释：成功成员同型坍缩、联合名保留）、§10 |
| `schema: null` 单义、失败分支不带 schema/truncated | §7-D1、§9（负控层 2） |
| options 闭合形状零变化 | §7-D1（canonical 复用）、§9（CT-6 面） |
| 消费测试翻新、作用域文档与 fixture 词汇重录 | §11 ALLOW LIST、§7-D8 |
| root 全绿；版本 bump 归发布流程 | §12 验证映射、§11 DENY LIST |

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
| --- | --- | --- |
| 恒五键 + object schema（E1 探针：`PROBE_BASELINE_KEYS=[ok,value,schema,truncated,truncations]`） | SA6 §5 E1；probe log；CB1 本次源码复核一致 | §7-D5 删 `truncations` 键位；成功分支四处组装点（两联合类型 + 两运行时组装）同步四键化 |
| 目标契约红灯签名（E2：恰四键断言处红） | SA6 §5 E2；probe log | 红因归因成立，设计按 CT-1 落 A1/A2 断言组（§12） |
| lease 面同缺口（E3：`readdata-docs-adr0016-sync-control.test.ts` L145–165 现断言五键 + 四件套投影体 + `truncations === []`） | SA6 §5 E3；本次实读一致 | 该文件翻新为四键 + 文本断言（§11 ALLOW LIST #29） |
| 头行未实现（E4：`# readData` 0 命中）/ 组合层零接线（E5） | SA6 §5 E4/E5；本次 grep 复核一致 | §7-D1/D2 新增头行组装与渲染器接线（组合层职责，不进渲染器） |
| 81 格预算矩阵结论：`truncated ⟺ ✂ 在场` 在可达矩阵成立；width-only 格 `truncated=true` 且 `‡` 缺席 | SA6 §9 E3 | CT-4 D1/D2/D4 断言组照录（§12）；U2 残差见 §13 |
| oracle 可行性（E7：`compileSchemaEnvelope` → `resolveSchemaAtPath` → `renderProjectionText` 全公共 API 链路可达） | SA6 §9 E7、§12.0 | 测试 oracle recipe 沿用（§12）；一致性锚不依赖内部 seam |
| 消费面 76 文件 / 必改 16 + 建议同步 3 | SA6 §10.2 | §11 ALLOW LIST 逐文件落位（清单一致，本次 grep 交叉复核） |
| 突变敏感性 M1–M8 | SA6 §12.11 | §12 验证映射（SA7 执行期必做） |

上游事实与源码矛盾：**未发现**。SA6/SA8 的全部源码行号锚点（runtime.ts L148–172/L552–607、read-schema-projection.ts L134–303、lease.ts L410–422、vfsl index L154）本次实读均一致。

## 6. SA8 约束落实

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
| --- | --- | --- | --- |
| 裁决 clear；按 SA6 §10/§12 派发实现 | 全文 | 本设计即 §10.1/§10.2/§10.3 的可实施化 | — |
| **SA1 必须显式采纳 CT-8 解释**（成功成员坍缩为同一四键类型；两联合名与重载序保留、零泄漏锁不动；偏离须先修订契约） | §7-D3 | **采纳**：单一共享成功类型 + 双联合名保留；「合并双联合」字面读法列为已否决备选 A2 | 是（复查项 1：实现 diff 上核对联合未合并、零泄漏注释在位） |
| W1：附录 A 空路径伪公式与 C1/附录 B 样张张力——冻结 oracle 期望串前先对齐 | §7-D2 | 设计冻结：空路径 pathText = 空串（头行 = `# readData []`），以 C1/附录 B/ADR 文法 `[<path>]` 为操作性口径；登记为契约 U1 程序内对齐（不动 ADR） | 是（复查项 2） |
| W2（= SA6 U2）：若出现可达「投影独截」格，按 AC4 改 OR 并先修订 CT-4 | §13 残余 | 设计不演示出该格（`truncated` 取值通道透传，见 §7-D5）；演进路径照录 | 是（复查项 3：CT-4 D1/D2 落实核对） |
| W3（= SA6 U3）：`ReadLogicalValueTruncationEntry` 公共转出由 SA1 显式决断 | §7-D6 | **决断：退役公共转出**（依据见该节） | 是（复查项 4） |
| W4：ADR 权威源健全性门（J7）保持在场且绿，不得改写 ADR 历史 | §7-D8、§11 DENY LIST | docs/adr/** 全量 DENY；fixture 的 ADR 健全性门样本保持 | 是（复查项 5） |
| 冻结面：值通道 / 渲染器 / resolver 输出 / options 闭合形状与失败码 / 失败分支与生命周期 / 读域框架 / ADR 正文 / CONTEXT 语义 / 版本发布链 / 写路径复制诊断 / typed-access 预算纪律三句 | §9、§11 DENY LIST、§7-D8 | 逐项保持（见 §9 负控层与 §11）；纪律三句 = `typed-access.md` L128「Typed budget discipline…」整句原文保留（SA6 J1 引用的 L126/L130/L132 为其邻域段，见 §7-D8 精确定位） | 是（SA8 §9 明示本票 requiresConflictRecheck: true；实现 diff 逐项复核第 4 节冻结面） |
| 包边界（runtime/registry/vfsl AGENTS）+ 根 AGENTS typed-access 写纪律（组合层零 cast） | §7-D1、§9 | `ProjectionTruncation`↔`ReadLogicalValueTruncationEntry` 结构兼容（CB8），组合层零 `as`；H6 类型锚 | 是（SA4 审查证据核对零 cast） |

**requiresConflictRecheck 结论**：**true**（§15 详述）。本设计不新增决策面、不触碰冻结面语义，但公共读面形状变更是实质 API 面，且 W1/W3 在本设计内做出决断——SA8 §9 的 (a)(b)(c) 三条触发条件全部命中，实现后须按其第 7.4 节逐项复核。

## 7. 设计决策与主要备选方案

### D1 文本组装所有权：`read-schema-projection.ts` 升格为「投影文本组合单点」

`projectReadDataSchema` **保留函数名**（SA6 CT-7 G4 的内部类型级锚：返回类型 `string | null`），签名演化为：

```ts
// 无预算读（legacy 两参调用面零变化）
export function projectReadDataSchema(state: RuntimeState, path: readonly (string|number)[]): string | null;
// 预算读：canonical options + 值通道截断清单（渲染器第二参）
export function projectReadDataSchema(
  state: RuntimeState,
  path: readonly (string|number)[],
  options: ResolveSchemaBudgetOptions,
  truncations: readonly ReadLogicalValueTruncationEntry[],
): string | null;
```

内部编排（守卫顺序与现状逐位相同，仅产出形态换文本）：

1. 状态守卫：`schemaState !== 'ready' || activeTools === undefined` → `null`（先于 path 守卫，不触碰敌意对象——现状纪律保持）。
2. 敌意 path 规范化：`normalizeReadPath` 原样保留（内层 try 只包扫描、迭代纯度校验、普通数组副本）→ `null` 收敛。
3. resolver 两分支显式分流（无 cast）：无预算走两参、预算走三参（canonical）；`!resolved.ok` → `null`（两码同收敛）。
4. **头行前贴**：`headLine(normalized, options)` + `'\n\n'` + `renderProjectionText(resolved, truncations)`；无预算分支 renderer 第二参缺席（`undefined ≡ []` 三态逐字节同，CB7/T1 已锚）。
5. `InternalError` 逃逸面扩为 resolver + renderer 两处零 catch：渲染器对畸形 projection/truncations 同样 `throw InternalError`（trusted domain，L21–22）——组合层不得包 try（E5 锚）。

`runtime.ts` 两处组装点随之变为：legacy `schema: projectReadDataSchema(state, path)`；预算 `schema: projectReadDataSchema(state, path, canonical.options, result.truncations)`（清单源 = 值通道载体计数，B-4 零合成纪律保持）。

**理由**：头行事实（实参 path 段值 + canonical 预算）与规范化快照同源——头行必须从**规范化后的普通数组快照**取段（见 D2 防御要点），该快照归本模块所有；把头行/渲染留在本模块维持「readData 成功分支 schema 附加单点」（模块头注既有职责）且避免对敌意 path 的二次读取。

**备选 A1（否决）**：模块只交 resolver ok 产物、`runtime.ts` 贴头行并调渲染器——头行需重读原始 path（敌意面对二次读取非确定）或把规范化数组再传出（接口变胖）；且 `projectReadDataSchema` 返回类型不再是 `string | null`，违反 CT-7 G4 锚。

### D2 头行规格（冻结，含 W1 对齐）

```
schema（非 null） = headLine(normalizedPath, options) + "\n\n" + renderProjectionText(resolved, truncations?)

headLine(path, options) = "# readData [" + pathText + "]" + budgetSuffix

pathText = path.length === 0 ? "" : path.map(foldSegment).join(".")
foldSegment(seg) = String(seg).replace(/\r\n|\n|\r/g, " ").trim()   // 与渲染器 foldText 同规则（L984–986）

budgetSuffix(options)：
  两键皆缺席（undefined）        → ""
  仅 depth                      → " {depth:" + String(depth) + "}"
  仅 maxChildrenPerNode         → " {maxChildrenPerNode:" + String(k) + "}"
  两者                          → " {depth:" + String(depth) + ",maxChildrenPerNode:" + String(k) + "}"
  （键序固定 depth → maxChildrenPerNode；逗号无空格；-0 已由 canonical 归一为 0）
```

- **W1 对齐（设计冻结）**：空路径 `pathText = ""` → 头行 `# readData []`。SA6 附录 A 伪公式行 `path.length === 0 ? "[]"` 的字面代入会得 `[[]]`，与其自身操作性断言 C1（「文本以 `# readData []\n\n` 开头」）与附录 B 样张（`# readData [] {depth:1}`）矛盾。本设计以 C1/附录 B/ADR 0027 决策 3 文法 `# readData [<path>]`（空路径 = 括号内空）为操作性口径；该对齐属契约 U1 程序内的内部一致性修订，**不动 ADR**。SA3 落 oracle 期望串一律按 C1/B；渲染器 ✂ 段空路径记法 `'[]'`（L998）与头行视觉一致，互不冲突。
- **防御要点 1（敌意单读）**：头行段值取自 `normalizeReadPath` 产出的普通数组快照——该快照按构造等于实参 path 在守卫时刻的段值（string|number 原样拷贝，不做别名解析），满足 C3「实参 path 而非解析路径/别名名」；同时敌意对象（如全转发 Proxy）只被读一次，头行不会观察到与 resolver 不同的第二次读视图。
- **防御要点 2（行注入）**：段含 `\n`/`\r\n`/`\r` 折叠为空格 + trim（C6）；头行因此**恒不含换行**——这同时是测试侧「剥离头行取渲染器正文」程序的前置（`text.substring(text.indexOf('\n\n') + 2)` 恰落在头/正文边界，用于 CT-4 D4/E1 的正文逐字节对照）。
- **防御要点 3（呈现形态）**：段含 `.`、空白等歧义字符如实呈现（U5：头行是事实锚/人读形态，不承诺 round-trip；程序化结构需求走 resolver 直达——ADR 0027 已知限制 1）。
- **预算段事实源**：预算分支用组合层 canonical 净化后的有效预算（present-undefined 剥离、-0 归一、仅 own-enumerable——`canonicalReadOptions` 现实现即此，CB5）；无预算分支无后缀。F3 canonical 等价（`{}` / `{depth: undefined}` / 非 enumerable / 继承键污染 → 全文与无 options 读逐字节相等）由「canonical 剥离 → 后缀空 + resolver 空预算 ≡ 两参（既有 D3/F-x1 断言锚）+ `[]` ≡ `undefined`（T1 三态锚）」三层既有事实叠加成立，无需新机制。
- **数字段**：`String(n)`（与 ✂ 段记法同规则；`-0` → `"0"`、大数走 JS 默认十进制——呈现形态，确定性由 ECMAScript ToString 保证）。

### D3 结果类型坍缩（CT-8 解释采纳）

`runtime.ts`：

```ts
/** 成功分支恒四键（单一四键形——两联合共用同一成功成员类型；ADR 0027 决策 1/4）。 */
type ReadDataOkResult = {
  ok: true;
  value: unknown;          // 值缺席显式 undefined，键恒在场
  schema: string | null;   // 投影文本或 null（严格 null，无 undefined 第三态）
  truncated: boolean;      // 机器信号：本次读发生过截断（值通道折叠/裁剪或投影截断）
};

export type NamespaceRuntimeReadDataResult =
  | ReadDataOkResult
  | ReadLogicalValueFailure
  | RuntimeReadDisabledResult;

export type NamespaceRuntimeReadDataBudgetResult =
  | ReadDataOkResult
  | ReadLogicalValueBudgetFailure
  | RuntimeReadDisabledResult;
```

- **两联合名与双重载签名保留**（SA8 必行动作 2 / SA6 CT-8 注）：`READ_OPTIONS_INVALID` 只属预算联合（ADR 0024 决策 6 零泄漏，未被 0027 修订）——合并联合会使 legacy 两参调用结构可达该码，与 issue AC6「失败码不动」直接冲突（SA8 硬冲突排除项 1）。legacy 联合的零泄漏注释（L146–147）**原文保留**。
- 重载序不动（预算在前、legacy 最后——`ReturnType` 取末签名，lease `_readOverloadOrder` 锚保持）。
- `ReadDataSchemaProjection` / `BudgetedReadDataSchemaProjection` 类型导入从 `runtime.ts` 移除（成功成员不再引用；两类型仍是 vfsl 公共类型与渲染器入参契约，在 `read-schema-projection.ts` 内部继续使用）。
- registry 别名 `NamespaceLeaseReadDataResult` / `NamespaceLeaseReadDataBudgetResult`（types.ts L450–459）**代码零变化自动跟随**；Equal 组合锁（lease.ts L410–421）原文保持、两侧同变仍相等；JSDoc 词汇重录（「五键成功面」→「恒四键 + 投影文本」）。
- `ReadDataOkResult` 不必从 index.ts 公共导出（消费方以 `Extract<…, {ok:true}>` 探测，H1/H2 锚不需要具名）；如 SA3 实现时发现 test-d 需要具名，可仅在该内部类型上加导出——不视为公共面扩张（它已是两个公共联合的成员结构）。

**备选 A2（否决）**：合并两联合为单一联合——制造未登记硬冲突（见上）；「双结果联合消失」的正确读法是**成功成员的双形态消失**（`ReadDataSchemaProjection | null` 与 `BudgetedReadDataSchemaProjection | null` 两支消失），SA8 已裁定该解释是全决策集唯一自洽读法。

### D4 detach 深拷贝层退役

- 删除 `detachReadSchemaProjection`、`cloneValueSchema`（两重载 + 10-case 分派）、`cloneDiscriminator`、`cloneNumberRecord`、`cloneDocsRecord`、`CloneMemo`（`read-schema-projection.ts` L134–303 整段）。
- 渲染器进程内直读 resolver ok 产物（零拷贝、零缓存、每次读重新 resolve + render）；隔离不变量由文本原始值形态保证（G1/G2 行为锚替代旧 `Object.isFrozen`/引用互异断言——它们对 string 无意义，G3 明令不得原样保留）。
- `InternalError` 逃逸、敌意 path null 收敛、状态守卫顺序全部不动（D1 编排 1–3 与现状逐位相同）。

**备选 A3（否决）**：保留克隆层「对文本也克隆」——原始值无对象可操作，ADR 0027 决策 4 明令退役；SA6 §11 已排除。

### D5 `truncations` 键删除与 `truncated` 语义

- 成功组装删 `truncations` 键位；legacy 分支新鲜 `[]` 常量纪律随之消亡。
- `truncated`：预算分支逐字段透传 `result.truncated`（B14 保持，=== truncations.length > 0）；legacy 分支硬编码 `false`（D1：无预算读结构上无截断）。**不做 OR 合成**（U2 残差登记见 §13）：可达域内 `truncated ⟺ ✂ 在场`（SA6 E3 81 格矩阵），CT-4 D1/D2 按值通道口径钉死。
- `schema: null` × 预算截断（raw 键 + depth:0）：`schema === null` 且 `truncated === true` 合法共存（CT-4 D6 诚实形态；ADR 0027 已知限制 2——文档如实陈述，不谎称可消歧）。

### D6 U3 决断：退役 `ReadLogicalValueTruncationEntry` 公共转出

**决断：退役** `packages/namespace-runtime/src/index.ts` L46 的 `export type { ReadLogicalValueTruncationEntry } from '@nomicore/doc-runtime'`。

依据：(a) 该转出是 #336 为「truncations 键的公共命名面」增设（index.ts L44–45 注释原文：消费方无需直依 doc-runtime）；键退役后 readData 交付面不再携带该词汇，转出成为死词汇，违背 ADR 0027 决策 1「JSON 投影四件套从公共读面退役」的爆炸半径收敛方向。(b) 仓内唯一从 `@nomicore/namespace-runtime` 导入该符号的是 `runtime-readdata-shape-budget.test-d.ts`（CB10），其相关 Equal 锁本票删除——退役零外部破坏。(c) doc-runtime 本体类型不动（值通道冻结面），需要值通道事实类型的消费方直依 `@nomicore/doc-runtime`（其公共面既有且冻结）。(d) SA6 U3 明示两选均不改 CT-1..CT-10；SA8 W3 仅要求显式决断 + 记录依据（本节即依据）。内部使用（runtime.ts / read-schema-projection.ts 的参数类型）继续自 doc-runtime 直接导入。

**备选 A4（否决但登记）**：保留转出 + JSDoc 声明其为值通道事实——可行（SA8 允许），但保留一个交付面已不存在的键的命名转出，公共面词汇与交付形状脱节，且下次清理仍要再做一次破坏性变更；退役与「原子切换、不留中间态」的票旨一致。

### D7 options 闭合形状与失败面零变化（负控设计）

- `NamespaceRuntimeReadDataOptions` 别名、doc-runtime 校验单源、`canonicalReadOptions` 接缝净化、`seamReadOptionsInvalid` 两出口、lifecycle gate 定序（先于一切 options 读取与 doc 触碰）、`PATH_NOT_ALLOWED` / `READ_OPTIONS_INVALID` / `RUNTIME_READ_DISABLED` 键集与语义、released lease 短路——**全部零改动**（设计不触碰这些代码路径；由 CT-5/CT-6 回归锚证明）。
- 唯一接触点：预算分支在既有 canonical 成功点把 `canonical.options` 与 `result.truncations` 多传一跳给 `projectReadDataSchema`（D1）——对 options 对象本身零复制、零校验、零触达新增。

### D8 文档与 fixture 词汇重录策略（CT-10）

**作用域文档**（三份，ALLOW LIST #31–33）：

1. `.agents/skills/nomicore/typed-access.md`：
   - L43（adapter bullet 的五键枚举）→ 恒四键 + `schema` 为投影文本（头行/正文/✂）；
   - L110（Read result 段的五键句 + `truncated`/`truncations` 描述）→ 四键 + 文本词汇 + ✂ 单一载体 + `truncated` 机器信号；
   - L116–L122（四件套具名、docs/aliasDocs 键规约、"detached deep copy" 句）→ 投影文本文法词汇（字段行 `名?: 类型 // 口径首行`、行尾注释按可见性随行、别名块）；「每次读 detached 深拷贝」句改写为「每次读由活 derived 重新渲染文本，原始值天然隔离、勿跨读缓存」（B4 对偶）；
   - **L128「Typed budget discipline (ADR 0024 decision 7)…」整句原文保留**（`hasBudgetDisciplineParagraph` 四正则的锚定段 = 预算纪律三句：静态完整性 / 可选访问 DeepOptional / 非写前完整快照；SA6 J1 引用的 L126/L130/L132 为其邻域段——本设计精确定位到 L128 单句，避免误改锚定句）；
   - L130 的截断消歧句（`listed in truncations` / truncation markers / docs-aliasDocs slices）→ ✂ 段词汇（「折叠壳列在 ✂ 段 = 被裁；✂ 段无条目的空壳 = 真空；键缺席且不在 ✂ 段 = 真缺席」）+ `‡` 标记词汇 + 行尾注释可见性词汇；L132 预算后写纪律句语义保持（其「truncated value」措辞不涉交付键，可原样）；
   - 权威源挂接：ADR 0027（交付形态）+ ADR 0016/0024（语义/预算）双引用（J1 的 `adr0016Refs` 放宽条件）。
2. `docs/integration/cordis-plugin-hosting.md` L340–352：示例注释块五键 → 四键 + 文本样张（头行/正文/✂ 三段式示例）；L379–386 跨 realm 陷阱节**语义零变化**（path/options realm 同一性结论对文本通道同样成立——`schema: null` 收敛机制不动）。
3. `docs/integration/external-project-vfsl-codegen.md` L288 段：恒五键陈述 → 恒四键 + 投影文本；适配器示例（只收窄 `.value`）零代码变化。

**CONTEXT.md**：只读零漂移核对（L38–58 已由 ADR 0027 提交写完，本次实读确认在场：投影文本 / ✂ 段 / 截断省略 / 形状预算词条 + _Avoid_ 旧词汇清退）；发现漂移才按 `docs/AGENTS.md` 就地修正，不改语义（J7）。

**文档负控 fixture**（ALLOW LIST #28–30）：

- `readdata-docs-adr0016-contract-fixture.ts`：
  - `hasFourKeyParagraph`（现 = valueSchema+aliasDocs）→ 重录为投影文本具名要求（R3'：投影文本词汇锚）；
  - `hasKeyConventionParagraph`（现 = aliasDocs+键规约）→ 重录为 ✂ 段与头行词汇要求（R4'）；
  - `staleAnnotationViolations` **双向修复**（J6）：新谓词 = 行注释 `// { ok: true, …}` 须含 `ok/value/schema/truncated`；`truncations` 在场视为陈旧（现谓词对新四键注记假红、对旧五键注记假绿——两个方向都错）；
  - `adr0016Refs` 放宽（J1）：0027 在场 ∧ 0016/0024 语义引用在场；
  - `readDataOptionUsages`、`hasBudgetDisciplineParagraph`、R1/R2/R5/R6/R7 谓词骨架保持，样本词汇随 ADR 0027 重录。
- `readdata-docs-adr0016-sync-control.test.ts`：行为锚（真实 Registry `lease.readData(['title'])`）改四键 + 文本断言（现 L145–165 五键 + 四件套投影体 + `truncations === []`）；匹配器正负样本按新词汇**双向**重录（新词汇正样本命中、旧词汇负样本命中——防关键词空转伪绿，J6）。
- `readdata-docs-adr0016-sync-red.test.ts`：R3/R4 改 R3'（投影文本具名）/R4'（✂ 段与头行）；R1/R2/R5/R6/R7 重录 ADR 0027 词汇。
- **ADR 健全性门保持**（W4）：sync-control 对 `docs/adr/0016`、`docs/adr/0024` 正文的权威源断言（含旧词汇 `ReadDataSchemaProjection | null`、`truncations: TruncationsEntry[]`）**保持在场且绿**——ADR 是历史记录；不得为过门改写 ADR（J7 watch 项）。

**备选 A5（否决）**：为减少 fixture 改动保留旧谓词、只改文档——旧谓词对新文档必假红（`staleAnnotationViolations` 现谓词要求 truncations 在场），且 J4/J5 的双向清退/在场门无法成立。

### D9 测试形状收敛仪器四键化（CT-9）

- `readdata-ok-shape.ts`：`READDATA_OK_KEYS` → `['ok','schema','truncated','value']`；`ReadDataOkShape` → `{ ok: true; value: unknown; schema: string | null; truncated: boolean }`；`readDataOk(value, schema, truncated = false)` / `expectReadDataOk({value, schema, truncated?})` 删 truncations 参数；反伪绿不变量（两侧独立内联构造）原文保持。「纯面/预算面」双 schema 类型区分消亡（两联合成功成员同型，typed stub 可赋值锁反而加强——四键形状对两重载通用）；helper 头注的「预算断言纪律」段随动改写。
- `readdata-shape-assertion-scan.ts`：`SUCCESS_SHAPE_KEYS` → 四键；family B「恰五元素」判定随常量改为四元素（SA6 I2 点名 L192 元数判定随动）；头注与样本重录；family A 检测器（`ok:true && hasSchema`）判定逻辑零变化（对四键字面量天然继续命中）。
- 收敛门测试：四键正样本；五键字面量改列**负样本**（成功形状不得再含 truncations——扫描器对五键成功字面量必须报违规）。
- **新契约测试的仪器纪律**：恰键集断言一律走 `expectReadDataOkKeys`（helper 内 `READDATA_OK_KEYS` 是标识符非数组字面量，不触发 family B）；`'truncations' in r === false`、`JSON.stringify(r)` 包含性检查、`typeof r.schema === 'string'` 等不是深等家族方法调用——不触发 family A。新红文件因此天然收敛门干净（与既有 `runtime-readdata-*` 家族同姿势）。

## 8. 接口、状态机和数据流

### 8.1 受影响接口与类型清单

| 接口/类型 | 位置 | 变化 |
| --- | --- | --- |
| `NamespaceRuntimeReadDataResult` | runtime.ts L148–157 | 成功成员 → 单一四键形（schema: `string \| null`；删 truncations）；失败成员不变 |
| `NamespaceRuntimeReadDataBudgetResult` | runtime.ts L163–172 | 同上（与 legacy 共用同一成功成员类型 `ReadDataOkResult`） |
| `ReadDataOkResult`（新增内部类型） | runtime.ts | `{ ok: true; value: unknown; schema: string \| null; truncated: boolean }`；两联合共用 |
| `projectReadDataSchema`（重载面） | read-schema-projection.ts L61–74 | 返回 `string \| null`（两重载同）；预算重载追加第 4 参 `truncations` |
| `headLine`（新增，包内不导出） | read-schema-projection.ts | §7-D2 规格；输入 = 规范化 path 快照 + canonical options |
| `normalizeReadPath` / `canonicalReadOptions` / `seamReadOptionsInvalid` / `readDisabled` | 两模块 | **零变化** |
| `NamespaceRuntime.readData` / `NamespaceLease.readData`（签名与重载序） | runtime.ts L215–221 / types.ts L675–679 / lease.ts L282–295 | 签名零变化；JSDoc 重录；lease 透传代码零语义变化 |
| `NamespaceLeaseReadDataResult` / `NamespaceLeaseReadDataBudgetResult` | registry types.ts L450–459 | 代码零变化（自动跟随）；JSDoc 重录 |
| Equal 组合锁 `_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` | lease.ts L410–421 | 原文保持（两侧同变仍相等） |
| `ReadLogicalValueTruncationEntry` 公共转出 | namespace-runtime index.ts L46 | **删除**（U3 决断，§7-D6）；index.ts 头注补 #364 增量段 |
| 删除符号 | read-schema-projection.ts L134–303 | `detachReadSchemaProjection` / `cloneValueSchema` / `cloneDiscriminator` / `cloneNumberRecord` / `cloneDocsRecord` / `CloneMemo` |
| 测试仪器类型 | helpers | `ReadDataOkShape` / `READDATA_OK_KEYS` / `SUCCESS_SHAPE_KEYS` 四键化（§7-D9） |

### 8.2 状态机

readData 无自有状态机（同步纯观察）。涉及的生命周期/状态判定零变化：`state.lifecycle !== 'ready'` → `RUNTIME_READ_DISABLED`（先于一切）；`schemaState !== 'ready'` → `schema: null`；released lease → `NAMESPACE_LEASE_RELEASED` 短路。**本设计不新增任何状态、缓存或记忆**（每次读重新 resolve + render，B4）。

### 8.3 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 无预算成功读 | caller → `lease.readData(path)` → `runtime.readData(path)` | 无写入（读在 sequencer 外，只观察已提交事实） | lifecycle gate → doc-runtime 两参值读（`{ok,value}`）→ `projectReadDataSchema(state, path)`：状态守卫 → 敌意规范化 → resolver 两参 → 头行（无预算段）+ `renderProjectionText(resolved)` | 无存储、无传输、零缓存（每次读重新求值） | 四键结果 `{ok:true, value, schema: 头行+正文, truncated:false}`；schema 为 string 原始值（天然 detached） | 值透传 + 投影文本；同参重复读逐字节相等 | 值失败 → PATH_NOT_ALLOWED 原样（无 schema/truncated）；敌意 path → schema:null；InternalError → throw 逃逸 | CT-1 A1/A3、CT-2 B1–B5、CT-3 C1–C7、CT-5 E1/E2 |
| R2 预算成功读 | caller → `lease.readData(path, options)`（raw 引用原样直传） | 无写入 | lifecycle gate → T1 三参值读（权威校验）→ canonical 接缝净化（零 `[[Get]]`）→ `projectReadDataSchema(state, path, canonical.options, result.truncations)`：resolver 三参 → 头行（预算段）+ `renderProjectionText(resolved, truncations)`（✂ 段由渲染器按非空清单追加） | 同上 | 四键结果；`truncated` 透传值通道布尔 | 文本含预算段事实；截断事实唯一载体 = ✂ 段；`truncated ⟺ ✂ 在场` | options 非法 → READ_OPTIONS_INVALID（恰 `{ok,code,path,message}`）；净化不稳定 → 两出口响亮；resolver 失败 → schema:null（truncated 仍可 true，D6 诚实形态） | CT-1 A2、CT-4 D1–D7、CT-6 F1–F4 |
| R3 失败/生命周期分支 | caller（任意期） | 无写入 | 短路原样透传（零 schema 工作） | 无 | `{ok:false, code, path, message}` / released issue | 键集与语义与 HEAD 逐字节同 | 无清理需求（零副作用） | CT-1 A4/A5、CT-5 E3/E4、I4/I5 |
| R4 lease 透传 | caller → lease | 无 | released 短路先于透传；active 期 raw options 同一引用抵达 runtime | 无 | lease 结果 ≡ runtime 直调（逐字段，含文本逐字节） | A6 键集与值逐字段相等 | 透传层零新增错误面 | CT-1 A6、CT-6 F4 |

跨模块边界共四跳（doc-runtime 值通道 ↔ runtime 组合层 ↔ vfsl resolver/renderer ↔ registry lease），每跳数据形态：Y.Doc 已提交事实 → plain value + truncations 清单（冻结）→ resolver 四件套（进程内直读，不出公共面）→ 文本 string + 四键对象。事实源始终是 live derived/Y.Doc 已提交状态；无最终一致性窗口（同步读）；失败后可见性 = 失败联合原样（无部分输出——渲染器无部分输出保证，L22）。

## 9. 错误、恢复、并发和幂等

- **错误面零变化**：失败三分支键集/语义/定序不动（D7）；`InternalError` 唯一逃逸通道保持且扩盖渲染器 throw（同为 trusted-domain，不进结果联合、无部分输出——CB6/L21–22）；敌意 path/options 零 throw、零 trap 执行（`normalizeReadPath` 迭代器同一性比较不调用迭代器；`canonicalReadOptions` 零 `[[Get]]`；头行只操作规范化快照，敌意面单读）。
- **无静默 fallback**：正常路径不变量缺失 fail loud（渲染器/ resolver 对畸形 trusted 输入 throw）；非法 options 响亮 `READ_OPTIONS_INVALID`，绝不静默 `schema:null`（F1）。`schema:null` 不是失败而是单义交付（三情形），`ok` 恒真。
- **恢复/重试**：读是纯观察，天然可重试；无部分状态需要回滚。写路径（mutateData/replaceSchema）零触碰。
- **并发**：读在 FIFO sequencer 之外、同步无 await、单线程内无竞态；`replaceSchema` 后同路径读反映新 derived（P0/SCHEMA 写槽完成后 activeTools 更新，读面无缓存——B4）；交错读确定性由 renderer 纯函数 + resolver 确定性保证（同输入同输出逐字节）。
- **幂等**：同参重复读逐字节相等（无 memo，纯函数链）；lease release 幂等、released 短路稳定 issue 原样。
- **资源所有权**：文本 string 无所有权问题；resolver 产物为每次调用新鲜局部值（进程内直读后即弃，零缓存零共享）——旧「identity-memo 深拷贝」所有权机制随 D4 整体退役。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
| --- | --- | --- | --- | --- |
| `apps/yjs-server/src/app.ts` L609 | `lease.readData(path)` 后只判 `result.ok`、取 `result.value` | 同左（值通道不变） | **零改动**（root typecheck 证明） | CB11 实读 |
| `packages/ws-replication/src/testing.ts` L47 | `readData: lease.readData.bind(lease)` 绑定透传 | 同左 | **零改动** | CB11 实读 |
| registry 行为测试（idle/open/create/sa7-*/shutdown/concurrency/hostile） | 经 `readDataOk`/`expectReadDataOk` 替身与断言（`schema: null` 场景为主） | helper 四键化后自动随动 | 调用点零改或小改（helper 双参签名保持） | §10.2 grep 清单（idle 11 处 / open 4 处 / rev1 4 处 / create 3 处 / hostile 2 处 / concurrency·shutdown 各 1 处） |
| `registry-readdata-budget-passthrough.test(.test-d)` | 五键 Equal + `viaLease.truncations.length > 0` + 双投影 schema 类型 | 四键 Equal + 文本 oracle + ✂ 断言；透传引用锚/released 三键锚/生产装配等价锚保持 | 翻新（ALLOW LIST #23/24） | SA6 §10.2；L219 实读 |
| 类型面消费（`runtime-readdata-shape-budget.test-d.ts` 等 4 个 test-d） | `keyof` 五键 Equal + `LegacyOk['truncations']` + 双投影类型 | 四键 Equal + `schema: string\|null` + 零泄漏负例（`@ts-expect-error` on `r.truncations` / `r.schema.valueSchema`） | 翻新（ALLOW LIST #20/21/25/26） | SA6 CT-8/CT-9 |
| 文档负控消费（sync-control/sync-red） | 五键行为锚 + 旧词汇匹配器 | 四键 + 文本锚；匹配器双向重录 | 翻新（ALLOW LIST #28–30） | §7-D8 |
| DSH 会话级只读探针工具（仓外部署） | 原样透传读结果 | 输出形态随包升级自然变化（object → string） | **零代码改动**（ADR 0027 决策 5 明文） | ADR 0027 L50–53 |
| 仓外 API 消费方（`@nomicore/namespace-runtime` / `registry` 导入者） | 五键 + JSON 投影 | 四键 + 文本；`ReadLogicalValueTruncationEntry` 转出退役 | 破坏性变更随破坏性 minor bump（归发布流程，本票不改版本号）；仓内消费方全部翻新 | ADR 0027 决策 5；issue AC10 |

无未覆盖调用方：全仓 readData 触及面 SA6 实测 76 文件（runtime 45 / registry 26 / vfsl 3 仅注释 / ws-replication 1 / app src 1），本次 grep 交叉复核一致；其中必须改 16 + 建议同步 3 + helper 随动组 + 零改动组（.ok/.value 消费）全覆盖于 §11。

## 11. 文件范围

### ALLOW LIST

生产实现（5）：

| 路径 | 预期改动 | 原因 |
| --- | --- | --- |
| `packages/namespace-runtime/src/read-schema-projection.ts` | 删 clone 家族（L134–303）；`projectReadDataSchema` 返回 `string\|null` + 预算重载第 4 参；新增 `headLine`（§7-D2 规格）；模块头注/JSDoc 重录（文本组装、隔离形态、renderer 接线） | D1/D2/D4；CT-2/5/7 |
| `packages/namespace-runtime/src/runtime.ts` | 结果类型坍缩（`ReadDataOkResult` 共用；两联合名/零泄漏注释/重载序保留）；两处组装四键化；JSDoc 重录（L140–147/L180–214/L542–550）；移除不再使用的投影类型导入 | D3/D5；CT-1/9 |
| `packages/namespace-runtime/src/index.ts` | 删 `ReadLogicalValueTruncationEntry` 转出（L44–46）；头注补 #364 增量段 | D6/U3；CT-9 |
| `packages/namespace-registry/src/types.ts` | L448–459 两别名 JSDoc 词汇重录（代码零变化） | CT-1/9 |
| `packages/namespace-registry/src/lease.ts` | `leaseReadData` JSDoc 词汇重录（透传代码零语义变化；Equal 锁原文保持） | CT-1/9 |

新契约测试（5，SA3+SA7 落成，先红后绿）：

| 路径 | 预期改动 | 原因 |
| --- | --- | --- |
| `packages/namespace-runtime/test/runtime-readdata-projection-text-red.test.ts` | 新建：CT-1 A 组 / CT-2 B 组 / CT-3 C 组 / CT-4 D 组 / CT-5 E 组 / CT-6 F 组 / CT-7 G 组（§12.0 oracle recipe） | 主缝红灯契约 |
| `packages/namespace-runtime/test/runtime-readdata-projection-text-control.test.ts` | 新建：负控/回归锚（值通道零变化、失败面、B'/D'/E' 组） | SA6 附录 C |
| `packages/namespace-runtime/test/runtime-readdata-projection-text.test-d.ts` | 新建：CT-8 H1–H6 类型锚 | 编译期锁 |
| `packages/namespace-registry/test/registry-readdata-projection-text-red.test.ts` | 新建：CT-1/4/6 lease 与生产装配面（A' 组） | lease 缝 |
| `packages/namespace-registry/test/registry-readdata-projection-text.test-d.ts` | 新建：lease 类型锚（H4 组合锁镜像） | lease 编译锁 |

存量测试翻新（16 必改 + 3 建议同步 + helper 随动组）：

| 路径 | 预期改动 | 原因 |
| --- | --- | --- |
| `packages/namespace-runtime/test/helpers/readdata-ok-shape.ts` | 四键 + `schema: string\|null` + 删 truncations 参数；反伪绿不变量保持 | D9；全消费面单点 |
| `packages/namespace-runtime/test/helpers/readdata-shape-assertion-scan.ts` | `SUCCESS_SHAPE_KEYS` 四键；family B 元数随动；头注/样本重录 | D9；CT-9 I2 |
| `packages/namespace-runtime/test/readdata-shape-assertion-consolidation-gate.test.ts` | 四键正样本；五键字面量改负样本 | CT-9 I2 |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget-red.test.ts` | A 四键；B/C `r.truncations` → 值通道 oracle + ✂ 断言；D 标记对齐 → oracle + `‡` 在场/缺席；**E1 width 无操作** → 渲染器正文（剥离头行后）逐字节相等 + ✂ 在场 + `‡` 缺席 + 全文与无预算读不等；F/G/H 措辞与 `truncations` 读取改锚；F4/F5/D3/D4 无预算等价 → 全文逐字节相等 | CT-4/CT-9 |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget-control.test.ts` | 四键 + 文本 oracle；detach 组（L162–186 引用互异/冻结/clue mutation）→ 文本隔离锚（G1/G2）；失败面 L123–142 保持 | CT-2/CT-7 |
| `packages/namespace-runtime/test/runtime-readdata-schema-projection-red.test.ts` | 15 条深等 + 引用隔离组（L255–320）→ 文本一致性锚（oracle 渲染）+ `schema:null` 三情形 + 文本隔离；`InternalError` 逃逸锚保留 | CT-2/CT-5/CT-7 |
| `packages/namespace-runtime/test/runtime-readdata-schema-projection-control.test.ts` | 基本保持；成功分支措辞与采样随动 | 负控层 |
| `packages/namespace-runtime/test/runtime-readdata-hostile-path-guard.test.ts` | 恰三键 `toEqual`（L39/54/62）→ 恰四键（`truncated:false`）；`Object.isFrozen(r.schema.valueSchema)`（L81）退役；敌意零调用锚保持 | CT-1/CT-5 |
| `packages/namespace-runtime/test/runtime-readdata-int-range.test.ts` | `schema.valueSchema` 深等（L139–224）→ 文本 oracle（`Int<1, 100>` 等文法断言经渲染器）；隔离组 → 文本锚；`ReadDataOkShape` 用点随动 | CT-2 |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget.test-d.ts` | 四键 Equal + `truncated: boolean` + `schema: string\|null` + 零泄漏负例；删 `LegacyOk['truncations']` 锁与 `ReadLogicalValueTruncationEntry` 导入（随 D6） | CT-8 |
| `packages/namespace-runtime/test/runtime-readdata-schema-red.test-d.ts` | `HasSchemaOnOk` 锚 `string\|null` + 四键；doc-runtime 保持性守卫不动 | CT-8 |
| `packages/namespace-runtime/test/runtime-data-interface.test-d.ts` | 保持可赋值 + 补 `@ts-expect-error`（`r.truncations` / `r.schema.valueSchema`）（建议同步） | CT-9 I1 |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test.ts` | 四键 + 文本 oracle + ✂；透传引用锚/released 三键锚（L189–200）/生产装配等价锚（L203–221）保持 | CT-1/4/6 |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test-d.ts` | 四键 Equal + `string\|null` + 零泄漏负例；失败面无新键锁（L61–66）保持 | CT-8/CT-9 I5 |
| `packages/namespace-registry/test/registry-readdata-schema-red.test-d.ts` | lease 别名锚 `string\|null` + 四键；别名组合锁保持 | CT-8 H4 |
| `packages/namespace-registry/test/registry-data-interface.test-d.ts` | 保持可赋值 + 四键探针（建议同步） | CT-9 |
| `packages/namespace-registry/test/registry-phase5-bootstrap-reset-r2-internal.test.ts` | L271 陈旧两键替身 → 四键 shape（建议同步；扫描/编译门抓不到，靠清单） | CT-9 I3 |
| `packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` | 匹配器词汇重录（R3'/R4'、`staleAnnotationViolations` 双向、`adr0016Refs` 放宽）；`readDataOptionUsages`/`hasBudgetDisciplineParagraph` 保持 | CT-10 J1/J6 |
| `packages/namespace-registry/test/readdata-docs-adr0016-sync-control.test.ts` | 行为锚四键 + 文本；匹配器正负样本双向重录；**ADR 权威源健全性门（L294–313）保持在场** | CT-10 J2/J7 |
| `packages/namespace-registry/test/readdata-docs-adr0016-sync-red.test.ts` | R3'/R4'；R1/R2/R5/R6/R7 重录 ADR 0027 词汇 | CT-10 J4/J5 |
| helper 随动组：`registry-idle/open/create/sa7-rev1/sa7-hostile/sa7-concurrency/shutdown` 各 `.test.ts` | 经 helper 四键化自动随动（调用点零改或小改；`registry-open` L959 失败 `toEqual` 与 L1002–1006 released 锚不变） | CT-9 I4 |

文档（3 + 1 只读）：

| 路径 | 预期改动 | 原因 |
| --- | --- | --- |
| `.agents/skills/nomicore/typed-access.md` | §7-D8 第 1 条的逐点重录；**L128 纪律句原文保留**；权威源挂 0027+0016/0024 | CT-10 J1/J4/J5 |
| `docs/integration/cordis-plugin-hosting.md` | L340–352 示例注释四键 + 文本样张；跨 realm 节语义零变化 | CT-10 J2 |
| `docs/integration/external-project-vfsl-codegen.md` | L288 段四键 + 文本 | CT-10 J3 |
| `CONTEXT.md` | 只读零漂移核对（J7；发现漂移按 docs/AGENTS 就地修正，不改语义——条件例外已登记） | 词表权威 |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
| --- | --- | --- |
| `packages/vfsl/src/**`（含 `render-projection-text.ts`、resolver、index.ts） | 渲染器与 resolver 是本票的输入契约 | T1 冻结（ADR 0027 决策 2；144 条测试冻结基线；M 表禁改渲染器） |
| `packages/vfsl/test/render-projection-text*.test.ts` / `resolve-schema-at-path*.test.ts` | 渲染器/resolver 契约测试 | 冻结基线；resolver JSON 四件套输出仍是渲染器输入契约 |
| `packages/doc-runtime/**` | 值通道 | ADR 0024 决策 1/2/5/6/7 冻结面；`ReadLogicalValueTruncationEntry` 形状冻结（H5） |
| `docs/adr/**` | 历史决策记录 | docs/AGENTS：ADR 是历史记录；修订指针已由 0027 登记；J7 门保持绿（W4） |
| `CONTEXT.md` 语义 | 词表权威 | 已由 ADR 0027 提交写完；本票只核对（条件性修正仅限漂移且不改语义） |
| 根 `package.json` / 各包 `package.json` version / `pnpm-lock.yaml` / publish 脚本 | 发布链 | AC10 / ADR 0027 决策 5：bump 归发布流程，本票 diff 需无版本改动 |
| 根 `vitest.config.ts` / `tsconfig*.json` | 测试入口 | 入口不变（SA8 §14 触发证据已实测新文件自动发现） |
| `apps/yjs-server/src/**`、`packages/ws-replication/src/**` | 只读消费方 | 只消费 `.ok`/`.value`；零改动由 root typecheck + 全量测试证明 |
| `packages/namespace-runtime/src/write.ts`、`schema-write.ts`、`replication-write.ts`、`p0.ts`、`status.ts` | 写路径/状态面 | 读面任务零关系（根 AGENTS 写纪律；SA6 §10.4） |
| 诊断日志包（`packages/namespace-diagnostic-log/**`）与 diagnostic 接线 | 观测面 | 与 readData 无关（SA8 §1） |
| `packages/namespace-registry/src/index.ts` | registry 公共入口 | 类型名零变化，无需改导出 |
| `wiki/raw/**` 其他任务产物 | 证据区 | 只读输入（Host/其他 SA 所有） |

## 12. 验收与验证映射

> 断言纪律沿用 SA6 §12 头注：只观察公共接缝运行时输出；oracle 只用公共 API 独立求值（`compileSchemaEnvelope` → `resolveSchemaAtPath` → `renderProjectionText`；值通道直调 `readLogicalValueAtPath`）；不 skip/only/todo/env override/fallback；不吞错；装置前提失败 fail loud。SA1 不编写/运行测试——下表为 SA3/SA7 的落成要求。

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
| --- | --- | --- | --- |
| CT-1 恒四键 / truncations 退役（AC1） | SA6 E1/E2 红灯签名（旧形恒五键） | red 文件 A1–A6：键集 sort 严格四键、`'truncations' in r === false`、`JSON.stringify` 不含 `"truncations"`、失败分支恰 `{ok,code,path,message}`、released 短路、lease ≡ runtime 逐字段 | 旧实现红（E2 已证）；新实现绿 |
| CT-2 一致性锚（AC2） | SA6 E7 oracle 可行性 + 附录 B 样张 | B1–B5：≥9 路径 × ≥9 预算矩阵（strict+raw 夹具），`r.schema === headLine + '\n\n' + renderProjectionText(独立编译 derived 的 resolve 产物, 值通道 truncations)` **逐字节 `===`**；B4 replaceSchema 后文本随新 derived | 渲染器与组合层零漂移；expected/actual 独立构造（反伪绿 B5） |
| CT-3 头行事实性（AC3） | 无（E4：头行 0 命中） | C1–C7：空路径 `# readData []\n\n` 开头、多段/数字段点分、实参 path 非别名名、预算段三形、canonical 等价全文逐字节、行注入折叠、`schema:null` 无头行 | 头行按 §7-D2 冻结格式（W1 对齐后） |
| CT-4 截断事实一致（AC4） | SA6 E3 81 格矩阵 | D1–D7：`truncated === valueOracle.truncated`；`⟺ ✂ 在场`；D3 depth 截断三信号齐；D4 width-only `‡` 缺席对偶；D5 无截断零信号；D6 null×预算诚实形态；D7 值通道语义零变化（B/C/G 组沿用） | 截断事实单一载体 = ✂ 段 |
| CT-5 null 单义与失败/生命周期（AC5） | 既有 hostile-path/lifecycle 套件绿基线 | E1–E6：三情形严格 null 非空串、敌意 trap 零调用、lifecycle 定序、非法 path+options 定序、InternalError 逃逸（注入畸形 derived → throw 构造名 `InternalError`）、敌意输入零 throw | 失败分支与 HEAD 逐字节同形为 |
| CT-6 options 零变化（AC6） | 既有 F 矩阵绿基线 | F1–F4：非法矩阵 → READ_OPTIONS_INVALID 恰四键失败形；差分矩阵 ≡ doc-runtime 权威；canonical 等价全文逐字节；lease 三层透传 raw 同一引用 | options 面零漂移 |
| CT-7 detach 退役与文本隔离（AC7） | 旧 detach 断言组在场（将退役） | G1–G2：`typeof schema === 'string'`、结果图无 `"valueSchema"` 键、连续/交错读逐字节相等、改写 `r.value` 后文本不变、replaceSchema 后无陈旧缓存；G3 旧引用/冻结断言整组退役；G4 结构面：`projectReadDataSchema: string \| null` 类型锚 + clone 符号不再存在（SA4 AST/符号证据） | 隔离由形态保证 |
| CT-8 类型面（AC1/2/7 编译锁） | 既有 test-d 五键锁在场（将翻新） | H1–H6：四键 Equal（两联合成功成员同型）、`schema: string\|null` 精确可空、`Extract<…,{truncations:unknown}> === never` + `@ts-expect-error`、lease 组合锁与重载序、doc-runtime 保持性守卫、渲染器入参零 cast 可赋值 | 半截双形态编译不可行 |
| CT-9 消费面翻新门（AC8） | 收敛门/扫描器在场 | I1–I5：root typecheck + `vitest --typecheck` 全绿；收敛门四键化（family A/B 归零 + 五键负样本命中）；旧词汇行为断言归零；失败分支字面断言保持；失败面无新键锁保持 | 全仓无遗留五键/两键伪形（phase5 L271 建议同步项除外——已列入清单） |
| CT-10 文档负控（AC9) | 旧匹配器在场（将重录） | J1–J7：三文档新词汇在场（投影文本/恒四键/✂/头行/truncated 机器信号/ADR-0027 引用）、旧词汇清退归零、匹配器双向敏感性自控、`staleAnnotationViolations` 新谓词、L128 纪律段保持、CONTEXT 零漂移、ADR 健全性门保持绿 | 文档与实现词汇一致 |
| §12.11 突变敏感性 M1–M8 | — | SA7 实施期：临时改实现 → 跑契约 → 还原，记录击穿面（M1 恢复 truncations 键 / M2 返回对象 / M3 删 truncated / M4 去头行 / M5 ✂ 失真 / M6 头行打印别名 / M7 敌意 null 收敛失效 / M8 detach 复活） | 每突变至少击穿对应 CT 断言 |
| root 门禁（AC10） | SA6 §13 基线（4540 tests 绿） | `pnpm typecheck` + `pnpm test`（`--typecheck`）全绿；`git diff --stat` 核对 §11 DENY LIST 零改动、无版本号改动 | 落地即全绿 |

**TDD-ready 变更序列**（红 → 绿 → 门禁；SA3/SA7 执行）：

1. **Step 0 基线**：记录 HEAD `f8a06fe` 聚焦家族 + root 门禁绿基线（SA6 §13 已录，可直接引用）。
2. **Step 1 RED（测试先行，生产零改动）**：按依赖序落测试面——(1a) helpers 四键化（`readdata-ok-shape.ts`、`readdata-shape-assertion-scan.ts`）；(1b) 五个新契约文件（red/control/test-d × runtime + registry）；(1c) 存量翻新 16 + 建议同步 3 + helper 随动组；(1d) 文档 fixture 匹配器与 sync 样本重录（文档本体未改 → 文档门红，可归因）。运行聚焦家族 + `--typecheck`：**必须红**，红点全部可归因到四键/字符串/头行/✂/词汇断言（含类型面 `r.truncations` 编译红——E7 锁的预期表现）；记录完整输出。
3. **Step 2 GREEN（生产实现）**：(2a) `read-schema-projection.ts`（clone 家族删除 → headLine + renderer 接线 → `string|null`）；(2b) `runtime.ts`（类型坍缩 + 组装四键化 + JSDoc）；(2c) `index.ts`（JSDoc + 转出退役）；(2d) registry `types.ts`/`lease.ts` JSDoc。运行聚焦家族：契约测试转绿（文档门除外）。
4. **Step 3 文档**：三作用域文档重录（L128 纪律句原文保留）；CONTEXT 零漂移核对。文档门转绿。
5. **Step 4 root 门禁**：`pnpm typecheck` + `pnpm test` 全绿。
6. **Step 5 突变与审计**：M1–M8 逐突变击穿并还原；`git diff --stat` 对照 §11（DENY 零改动、无版本改动、ALLOW 全覆盖）。

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 等级 | 处置 |
| --- | --- | --- | --- |
| R1 | 原子性风险：测试与生产必须同票落成，任何半截合入（如仅改生产）在 CI 必红（类型面 Equal 锁 + 字面断言） | 中 | 序列 Step 1–2 不可拆分提交；红/绿证据各留一份完整日志（SA6 §13 程序） |
| R2 | U2 残差：极端自造 derived（值树与 schema 两树分歧等）理论上可能出现「投影独截」格，使 `truncated === 值通道布尔` 与 issue AC4 的 OR 读法分歧 | 低（81 格可达矩阵内不可区分，SA6 E3） | 设计按值通道口径钉死（D5）；若实现/测试期演示出可达格，**先修订 SA6 CT-4 再改实现**（SA8 W2 程序），不得静默改语义 |
| R3 | W1 已由本设计对齐（空路径 `# readData []`），但 SA6 附录 A 伪公式原文未改 | 低 | SA3 oracle 期望串一律按 C1/附录 B；建议 SA7 报告引用本设计 §7-D2 作为对齐依据（契约 U1 程序内修订，不动 ADR） |
| R4 | U4：`schema:null` × 预算读只剩 `truncated` 布尔（键级消歧失效） | 已登记 | CT-4 D6 诚实锚 + 文档如实陈述（J4/J5 词汇要求「不得谎称可消歧」） |
| R5 | 文档重录误伤锚定句（L128 纪律句、ADR 健全性门样本）导致假红/伪绿 | 中 | §7-D8 精确定位锚定句并明令原文保留；J6 双向敏感性自控 + J7 门保持 |
| R6 | 收敛门/扫描器四键化后，新契约测试若内联恰键集数组字面量会误触 family B | 低 | §7-D9 仪器纪律：键集断言走 `expectReadDataOkKeys` |
| R7 | phase5 L271 两键伪形是扫描/编译双盲区 | 低 | 已列建议同步项（ALLOW LIST #27）；不作为门项（SA6 I3 原文），SA7 diff 审计核对 |
| R8 | 回滚条件：实现引入未预期破坏（如渲染器误改、值通道漂移） | 低 | 本票为纯读面切换、零持久化/协议影响；回滚 = revert 整票（原子性使半回滚不可编译）；冻结面回归锚（CT-5/CT-6/H5/渲染器 144 测试）是漂移即红的哨兵 |
| R9 | Follow-up（明确非本票）：schema 文本缓存（ADR 0027 开放问题）；marker 紧凑表示（ADR 0024 挂起）；破坏性 minor bump 与发布链（AC10 归发布流程）；`ReadDataOkResult` 是否升公共具名导出（如消费方需要，属加法演进） | — | 不伪装为任务内必要条件 |

**任务内必要条件无缺口**：环境齐备（SA6 §4 离线装齐）、oracle 可达（E7）、测试入口真实（E6/§14）、缺口可复现（E1/E2）——无阻塞。

## 14. 评审修订映射

`wiki/raw/task_issue-364_sa2_review.md` 不存在（iteration 0，无评审输入）——本设计为首版，无待落实 finding。后续评审意见到达时按 skill §10 程序在本节增列 Finding → 修订位置映射并原位修订全文。

## 15. 是否需要设计后 ADR 冲突复查及理由

**requiresConflictRecheck = true**。理由（SA8 §9 三条件全部命中，本设计复核确认）：

1. **公共 API 结果形状变更**（恒四键 + `schema: string | null`）是实质 API 面——尽管是 ADR 0027 已接受决策的直接兑现，实现 diff 上的形状落地仍需对照冻结面逐项核对（SA8 第 4 节 11 项冻结面 + CT-8 解释落实 + §10.4 红线零改动 + 无版本号改动）。
2. **本设计内做出了三项契约级决断/对齐**，需实现一致性核对：(a) CT-8 联合解释的采纳与落实（成功成员同型坍缩、联合名/零泄漏保留——复查实现未合并联合）；(b) W1 头行空路径口径对齐（`# readData []`）；(c) W3/U3 `ReadLogicalValueTruncationEntry` 公共转出退役决断。
3. **SA6 契约级冻结点**（附录 A 字节格式、U2 值通道 truncated 口径、M1–M8 突变面）需在实现 diff 与 SA7 证据上复核（SA8 watch 项 W1–W4 的关闭条件）。

本设计自身**不新增决策面、不修订任何 ADR、不触碰冻结面语义**（§6 表逐项落实）；全部设计决策在 ADR 0027 决策 1/2/3/4/5 框架内，CT-8 解释与 W1/W3 决断均按 SA8 指定的程序（显式采纳/登记，偏离才需先修订契约）执行。
