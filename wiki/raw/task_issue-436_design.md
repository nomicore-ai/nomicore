# SA1 实现设计 — issue #436：doc-runtime 数组 fast path 接线与 S9 收窄（ADR 0033）

- 版本：**iteration 1**（修订版）。iteration 0 经 SA2 攻击评审（verdict **reject**，1 MAJOR
  F-1 + 4 MINOR O-1..O-4，`wiki/raw/task_issue-436_sa2_review.md`）后逐条修订；核心架构
  （闸门、O(k) 管线、S9 收窄、零写入、最小 edit）经评审确认无架构/数据安全缺陷，本轮修订面 =
  F-1 既有测试钉死面处置 + O-1..O-4（映射见 §14）。
- 设计基线 HEAD：`7407ce01367b6d7a3fe497cd78c4bcf085f3ddbb`（分支 `mabf/issue-436`，已含 PR #444 =
  issue #435 的 vfsl 逐元素接缝 + ADR 0033 立法；doc-runtime 消费侧未接线；`git log`/`git status`
  本轮复核一致）。
- 上游输入：`wiki/raw/task_issue-436.md`（Host 简报，Issue #436，comments = 空）、
  `wiki/raw/task_issue-436_sa6_contract.md`（已批准验收契约 + 证据）、
  `wiki/raw/task_issue-436_sa6_capability_probe.mts`（38 项探针，exit 0）、
  `packages/doc-runtime/test/issue-436-array-fastpath-{contract,control,fixture}` 三件套
  （8 红契约 + 17 绿负控 + 共享夹具，HEAD 实测 5 轮稳定）、
  `wiki/raw/task_issue-436_sa2_review.md`（本轮修订输入）。
- 缺失输入：`task_issue-436_relevant_decisions.md` / `_conflict_report.md` / SA8 门
  （iteration 1 仍不存在）。处置见 §6 与 §15。

---

## 1. 任务类型、目标与非目标

**任务类型：Feature（能力缺口接线）**。不虚构 Bug 根因：HEAD 的「整数组提取 → 全量重建 →
边界重投影」在 phase-1 契约（ADR-0007 issue #237 修订节）下是**正确**实现（SA6 负控 17/17 绿
+ 基线 5622 tests 全绿证明）。缺口 = ADR 0033 决策 1–4 要求的 doc-runtime 双轨分流、O(k) 结算
与 S9 收窄**尚无载体**，而 vfsl 侧接缝（#435 `applyElementwiseArrayMutation`）已交付就绪。

**目标**：

1. **闸门分流（AC1）**：`planMutationBoundary` 产出 kind=`array` 且边界值节点为非 union
   `T[]` 的数组写走 fast path；union 数组目标（`A[] | B[]`）与 union 穿越永久回退既有全量
   边界路径（双轨是有意保留，非待清理债）。
2. **O(k) 结算（AC2/AC3）**：fast path 跳过 S5 整数组 walk 与 S6 全量重建；越界检查读 live
   `Y.Array.length`（O(1)）；insert 逐新值过 element 子 schema + detached 构造（O(k)）；
   delete 仅域规则（O(1)）。
3. **S9 收窄（AC6）**：fast-path 提交保留安装事实核（长度算术 + 插入项同一性）原样，省略
   边界重投影核（新增收窄的验证输入变体）；legacy 路径双核不变；E201 语义（变体 C/D、
   `committed:true`、不回滚不补偿）不变。
4. **形态与纪律不变（AC4/AC5）**：commit 仍是 Y.Array 区间最小 edit（update bytes 与事件
   形态零变化 ⇒ 复制协议与诊断捕获零改动）；零写入纪律不变——一切拒绝先于 live 写。
5. **既有语义钉死面处置 + 文档一致性（AC7 可达性前提，本轮新增）**：两条钉死 Δ1 legacy
   拒绝语义的既有恒绿测试（§7.7 盘点）按 ADR 0033 决策 4 授权**定向重锚**到 union 数组载体
   并纳入本票范围；ADR-0007 #237 修订节陈旧句面按 `docs/AGENTS.md` 义务**默认追加修订注记**
   （§7.6）。不做这两项，AC7「根 `pnpm test` 绿」在现行接线下不可达（iteration 0 的
   「464 files 全绿」预测因此事实错误，已修正——§12）。

**非目标**（与 ADR 0033「不做什么」对齐）：

- 不动 `planMutationBoundary`（规划层完全不动——ADR 决策 1）；
- 不动 union 穿越边界路径（kind=`union` 分支）与 union 数组目标的 legacy 语义；
- 不动 plain 数组（YPlainArray 无 array-* 入口）、`set([])` 全量管线、set/delete/Record 边界路径；
- 不引入数组级约束、不建异步/抽样污染审计、不做 write-then-undo；
- 不新增公共导出（契约 B-1：只经既有公共入口 `applyValidatedMutation` 观察运行时行为）；
- 不修改 vfsl 任何代码（接缝已冻结交付）；
- 不借 §7.7 重锚弱化两条用例的意图锚（W5「领域失败留在 ok:false 联合」/对称面「提取型
  边界内损坏仍响亮拒绝」——重锚只换锚定载体，断言语义面不放宽）。

---

## 2. 当前行为与证据锚点（源码级）

单笔数组写（如 `['items']` 上的 `array-insert`）在 HEAD 的完整路径：

| 阶段 | 位置 | 行为 |
|---|---|---|
| 入口 | `packages/doc-runtime/src/mutation.ts` `applyValidatedMutation`（L139–167） | 外层事务断言 → `prepareMutation` → 单操作经 `prepareLocalMutation`（L193）；`set([])` 才走 legacy 全量 ROOT 管线（L197–210） |
| S3 规划 | `mutation-local.ts` L214 调 `planMutationBoundary`（vfsl `validate-patch.ts` L739–830） | 纯结构规划：kind=`array` 时 `prefix = full path`、`relPath = []`、`node = descendValues(values, prefix)`（**已归一化：非 ref、非 optional**，L719 JSDoc + L481–506 实现）；union 穿越首次冻结为 kind=`union` |
| S4 导航 | `mutation-local.ts` `navigateHops`（L117–180） | 逐跳载体/在场/越界域规则；返回边界 live 与结构节点（结构节点可能为 ref，消费方自行 resolve） |
| S5 整数组提取 | `mutation-local.ts` case `'array'` L296–347 中 L305 `walk(boundaryNode, boundaryLive, [], resolve)` | **O(n)**：逐元素 `ya.get(i)`（`extract.ts` L127–136）；元素污染 → 首错 fail-fast（INV-3）；目标位载体非 Y.Array → `Yjs 载体错位（ROOT）：期望 Y.Array，实际 X`，path `[]`（`extract.ts` L127–128 + L346–353，walk 以 path `[]` 起步） |
| S6 全量重建 | L307–311 `applyMutationAtBoundary(derived, plan, walked.snapshot, payload)` | 域规则（不 clamp、拒越界 no-op）+ 拷贝式重建 + **整个 proposed 数组过 `validateSubtree`**（vfsl `validate-patch.ts` L983–1011）；issue 按 `plan.prefix` rebase |
| 换根导航 | L313–318 `navigateLive(...)` + `resolve` | union 数组目标在此经 `resolveNode`（`mutation.ts` L531–547）以 walked 逻辑值消歧到成员 array 节点；非 union 目标直接得 array 节点 |
| S7 构造 | L322–331 insert 逐新值 `buildDetachedValue(derived, resolvedNode.element, v, [...path, index+i])` | detached 构造，首 issue 即返（`failIssue` = 本文件 L57 既有模块级助手） |
| S8 提交 | `mutation.ts` `commitPrepared`（L466–485）`target.insert(index, values)` / `target.delete(index, count)` | 单 guarded transaction 最小区间 edit |
| S9 双核 | `install-verify.ts` `verifyBoundaryIntact`（L395–459） | ① 安装事实核 O(1)（L397–428：长度算术 + 插入项 `get(index+i) === built[i]` 同一性）；② 边界重投影核 O(boundary)（L430–459：walk 重提取 + `productEqual` 对 `proposedBoundary`）——**当前对所有数组提交运行** |
| 批量 | `mutation.ts` `prepareBatchMutation`（L232–316）→ `composeBatchVerify`（L329–374） | 逐元素复用同一 `prepareLocalMutation`（L306）；阶段 C 按 `plan.prefix ⊊ path_j` 折迭兄弟足迹进 `proposedBoundary`（数组 plan 的 prefix = 操作路径，严格前缀谓词天然零匹配——引理 3）；折迭输入 = `parsed` 全体操作（L351–368 读 `parsed[j]`，**不依赖 item j 的 verify 变体**）——§7.5/§12.1 依据 |

**运行时证据**（SA6 契约 §5，探针 + 契约实测）：单元素 append/delete 的 live 元素读计数 ∝ n
（n=512→1026/1023，n=4096→8194/8191）；越界拒绝先付 n 次提取（512/4096）；n=10⁵ 单 append
150.7ms（×89.2/100× 规模）；区间外污染照旧阻断（`ok:false` path `["items",0]`）；区间外同事务
篡改照旧 E201-C。union 双轨事实：U1 `plan.kind='array'` ∧ `plan.node.kind='union'`（⇒ 闸门
第二条件必须看**节点** kind）；U2 union 穿越 `plan.kind='union'`；S1–S3 接缝存在且对 union
计划 fail closed。

**既有测试钉定面（本轮盘点，详 §7.7）**：两条 HEAD 恒绿用例把 Δ1 的 legacy 拒绝语义钉进根
套件——`apply-validated-mutation-fatal-contract.test.ts` L209–235（W5 锚）与
`issue-237-path-localized-validation-red.test.ts` L548–569（对称面锚），目标均为**非 union**
`YArray<Item>` + 元素级污染 + 期望 `ok:false` 零写入；fast path 落地后即翻红。全仓扫描确认
钉死 Δ1/Δ2 旧语义的**恰为这两条**（扫描方法与保绿面结论见 §12.1）。

## 3. 能力缺口（Feature，承接 SA6 §8 不虚构根因）

| # | 缺口 | 现状证据 | 设计响应 |
|---|---|---|---|
| G-1 | 无闸门：数组分支一律 legacy 全量路径 | 契约 FA1–FA3 红（污染阻断 `ok:false` ≠ 目标 `ok:true`） | §7.1 双条件闸门 |
| G-2 | 成本 ∝ n：S5 walk + S6 重建 + S9 重投影三次全数组遍历 | FB1/FB2 红（读计数 1026/8194 ≫ ≤8）；G5 毫秒软证据 | §7.2 O(1)/O(k) 管线 |
| G-3 | 越界判定先整数组提取（非 live 长度 O(1)） | FB3 红（越界读计数 512 ≫ ≤4）；E3 | §7.2 F2 live 长度事实 |
| G-4 | S9 重投影核无差别覆盖全部数组提交 | FC1/FC2 红（区间外篡改 E201-C ≠ 目标静默通过）；E4 | §7.4 验证计划变体 |
| G-5 | 触达面未收窄：未触达元素仍承担污染检测 | G1a/G1b；ADR 决策 4 无载体 | §7.2/§9 行为面变化表 |
| G-6 | AC7 交付缺口：两条既有恒绿用例钉死 Δ1 旧义，现行「仅新增测试」范围下实现后必红 | §2 钉定面；SA2 F-1；本轮独立复核（§12.1） | §7.7 定向重锚入范围 |

明确不主张（负控钉死为正确且必须保持）：现行整数组路径无缺陷、域规则 message/path/顺序无偏差、
commit 字节形态无异常、union 轨行为正确（NA/NC/ND 17 绿）。

---

## 4. Owner要求落实

Host 简报明文「Current Issue REST comments: none (no owner requirements)」；SA6 契约 §2 同；
SA2 评审 §4 复核同。**本设计无 Owner 评论要求需要映射**；全部要求面来自 Issue 正文 AC1–AC7 +
ADR 0033 决策 1–6 + CONTEXT 词汇（L144「重建校验/数组位例外」、L202「复制未校验/触达面」）——
逐条落实见 §6 约束表与 §12 验收映射。

```markdown
## Owner要求落实
| Comment ID | Updated at | Requirement | Design section |
| （无——Host 简报明文 comments = 空） | — | — | §6/§12 为替代规范面映射 |
```

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| 接缝 `applyElementwiseArrayMutation(derived, plan, facts, payload)` 已交付：O(1) 载体事实 `{length}` + 新值逐元素；对 `plan.node.kind !== 'array'` / `plan.kind !== 'array'` / `relPath ≠ []` fail closed；返回 `ValidateResult` 直出（无 `proposedBoundary`） | `packages/vfsl/src/validate-patch.ts` L1079–1136；`src/index.ts` L129–145 已公共导出 `applyElementwiseArrayMutation` + `ArrayCarrierFacts` + `ElementwiseArrayMutationPayload`；探针 S1–S3 | §7.2 F3 直接消费；闸门三重锁见 §7.1 |
| 域规则文案在接缝侧逐字复用 legacy（`array-insert index 越界（不 clamp）` / `array-delete 范围越界（不 clamp、不接受越界 no-op）`，path `[...arrayPath, index]`） | `validate-patch.ts` L1111–1113 / L1130–1133 vs legacy L993–994 / L1003–1004；负控 NC1/NC2、探针 N1/N2 | §7.3 次序与逐字节一致性设计 |
| insert 新值 issue 路径 = 插入后位置 `[...arrayPath, index+j, ...原生相对 path]`，与全量路径逐字节兼容 | `validate-patch.ts` L1116–1123；NC3、探针 N3 | §7.2 F3/F4 不改路径构造 |
| 读计数代理：目标实例 `get`/`toArray`/`forEach` 计真（批量出口按 n 计入，无逃逸口） | 夹具 `issue-436-array-fastpath-fixture.ts` L112–145；探针 G2d/E8 | §7.2 成本核算（预算 ≤8/≤4） |
| `afterTransaction` cleanup 窗口篡改先于 `verifyBoundaryIntact` 派发（yjs 实证） | 夹具 L101–110；SA6 §12.4；issue #350 SA7 同款 | §7.4 事实核保留即可检出 NB1–NB3 形态 |
| 批量面：数组元素复用 `prepareLocalMutation`；数组 plan 的 prefix = 操作路径（引理 3 零折迭）；`BatchItem.verify` 目前要求 `proposedBoundary` | `mutation.ts` L305–311 / L329–374；SA6 §15 批量折迭行 | §7.5 批量接线 |
| 契约 8 红 / 负控 17 绿 / 探针 38 命中，红灯集合 md5 `719cbdb4…` 5 轮稳定；基线 typecheck+test 全绿 | SA6 §4/§13 + `artifacts/sa6-issue436-*.log` | §12 绿色判据 |

上游事实与源码无矛盾（本设计逐锚点核对了 SA6 引用的全部行号与符号；iteration 1 又经 SA2
逐锚点攻击复核——「行号引用抽验全中」）。

## 6. SA8约束落实

#436 无 SA8 工件（iteration 1 仍无）。以下为替代规范约束面（逐条）与落实位置：

| 来源 | 约束 | 设计位置 | 处理方式 | 需设计后冲突复查 |
|---|---|---|---|---|
| ADR 0033 决策 1 | 闸门 = plan kind=`array` ∧ 边界值节点 kind=`array`；union 数组目标永久回退；规划层不动 | §7.1 | 双条件闸门 + 接缝 fail-closed 双锁；`planMutationBoundary` 零改动 | 否（直接落实） |
| ADR 0033 决策 2 | 越界读 live `Y.Array.length` O(1)；域规则逐字一致（不 clamp、拒越界 no-op、批量一次判定）；insert 逐新值过 element 子 schema + `buildDetachedValue` 逐值 O(k)，issue 路径与现状逐字节一致；delete 仅域规则 O(1)；commit 最小 edit 不变；一切拒绝先于 live 写 | §7.2/§7.3/§9 | F2 facts + F3 接缝 + F4 复用既有构造；`commitPrepared` 零改动 | 否 |
| ADR 0033 决策 3 | 事实核原样保留；fast-path 省略重投影核；legacy 双核不变；区间外篡改静默通过为已确认取舍 | §7.4 | 验证计划判别联合；事实核单一实现两轨共享 | 否（FC/NB/NA 三向钉死） |
| ADR 0033 决策 4 | 触达面 = 数组载体 + 变更区间（载体由导航 O(1) 验证）；污染数组 delete 由拒绝转成功；不补异步审计 | §7.2 F1/§7.3/§7.7 | 载体检查保留在 fast path；元素级污染不再读取；**两条件随既有测试重锚 + ADR-0007 注记获得成文规范链（§7.6/§7.7 同批）** | 是（仅注记文本与重锚授权链一致性——§15 收窄范围） |
| ADR 0033 决策 5 | 「数组合法性 ⟺ 逐元素合法」立法；一致性 fixture 为 enforcement | 不动 vfsl（fixture 已由 #435 E 组交付） | 本票零 vfsl 改动 | 否 |
| ADR 0033 决策 6 | 性能验收软：O(n)→O(k) 等价证据，不钉毫秒 | §12 | FB 组结构性读计数；探针毫秒仅软证据 | 否 |
| ADR-0007 #237 修订节 | 损坏条款 (i) 载体形态违规（含 array-* 目标非 Y.Array）仍响亮拒绝；(iv) 触达面外不发现；零写入/observer no-rollback/禁 write-then-undo | §7.2 F1/§9 | 载体检查同文案保留；零写入次序不变；**条款 1「不逐元素」/条款 4(ii)「数组位」的陈旧句面按 §7.6 默认注记处置（O-1）** | 是（同上——注记即对本节的显式修订记录） |
| ADR-0010 #237 修订节（L333–361，后备句 L343–347 引数组含义） | 触达面语义引用 ADR-0007 损坏条款（单一真相源） | §7.6 | ADR 0033 决策 4 标题已点名修订该节数组含义；本票不在该文件追加注记（§7.6 记录该扫描结论） | 否（已被母法点名修订） |
| `docs/AGENTS.md` | 「When code behavior changes, update every normative document whose stated contract changed」——义务句非许可句 | §7.6 | ADR-0007 注记**默认执行**（O-1 落实）；豁免仅 Controller 明示裁决 | 是（同上） |
| ADR 0025/0026 | guard 评估先于 prepare；批量 E1–E6 信封语义 | §7.5 | guard/解析/信封校验区零改动 | 否 |
| `packages/doc-runtime/AGENTS.md` | 校验失败零写入；detached 构造 + 单 guarded transaction；公共面只经 `src/index.ts`；写后不变量失败 = fatal | §7/§9/§11 | 无新公共导出；fatal 分类不削弱 | 否 |
| 简报 AC1–AC7 | 验收 | §12（AC7 预测已按 §7.7 修正） | FA/FB/FC/NA/NB/NC/ND + 根门 | 否 |

---

## 7. 设计决策与主要备选方案

### 7.1 D1 — 闸门与永久双轨（AC1）

位置：`mutation-local.ts` `case 'array'`（L296–347），在 S4 `navigateHops` 成功之后、S5 `walk`
之前插入分流点。闸门为**双条件合取**（全部 O(1)，schema 尺度、与数据规模无关）：

```ts
// plan 来自 S3；boundaryNode/boundaryLive 来自 S4（均已在作用域）
const resolvedBoundary = resolve(boundaryNode);            // 仅 ref 链解析（makeRefResolver，非 union 消歧）
const fastEligible = plan.node.kind === 'array' && resolvedBoundary.kind === 'array';
```

- **条件一（值侧）**：`plan.node.kind === 'array'` —— ADR 决策 1 的「边界值节点 kind」
  （`plan.node` 已由 `descendValues` 归一化为非 ref，`validate-patch.ts` L719/L481–506）。
  union 数组目标（`uarr: YArray<number> | YArray<string>`）此处为 `'union'`（探针 U1）。
- **条件二（结构侧）**：`resolve(boundaryNode).kind === 'array'` —— fast path 需要结构树
  array 节点的 `.element` 供 `buildDetachedValue`；union 数组目标的结构节点同样是 union。
- 两树由同一 schema 求值产出，kinds 恒一致；**不一致（仅手造派生物可达）时合取为假 →
  回退 legacy 全量路径**——失败方向是「多验证」而非「漏验证」，绝不误接管。
- **第三重锁**：接缝 `applyElementwiseArrayMutation` 自身对 `plan.kind !== 'array'`、
  `relPath ≠ []`、`plan.node.kind !== 'array'` fail closed（`validate-patch.ts` L1086–1099）
  ——即使 doc-runtime 闸门写错，union 计划也无法经接缝静默通过。
- **闸门处 `resolve` 抛错分类（O-4）**：`resolve(boundaryNode)` 抛 `DerivedInvariantError`
  （ref 环/缺名等派生结构缺陷，仅手造派生物可达）时，与 legacy 路径在 `walk` 内部
  `resolve` 抛错走**同一 catch 面、同一分类（E204）**——两条路径均在 `prepareLocalMutation`
  内同一 try 包裹（`mutation.ts` 调用点收编 `DerivedInvariantError` 的既有路径不动）。闸门
  **不新增可达 E204 向量**：新增的 resolve 调用作用于与 legacy walk 相同的节点对象，抛错
  前提（派生结构本身损坏）两轨同源；正常 schema 下该调用恒不抛。

分流结果：

- `fastEligible === true` → §7.2 fast path；
- `false`（union 数组目标，或两树分歧）→ **既有 L305–346 代码原样执行**（walk →
  `applyMutationAtBoundary` → `navigateLive` 换根 → build → verify 含 `proposedBoundary`）
  ——即 union 永久 legacy 轨，逐字节不变（NA1–NA4 钉死）；**§7.7 两条重锚用例即锚定此轨**；
- union 穿越在 `case 'union'` 分支（L349–421），本票**零触碰**（NA3）。

被拒绝的闸门形态：仅按 `plan.kind` 接管（E7/U1：union 数组目标 `plan.kind='array'` 会失守，
NA1/NA2 红灯钉死）；在 `planMutationBoundary` 内分流（ADR 决策 1「规划层完全不动」）。

### 7.2 D2 — fast path 管线（AC2/AC3/AC5，O(1)/O(k)）

fast path 以六个 O(1)/O(k) 步骤替换 S5/S6（S3/S4/S7 语义不变、S8/S9 形态不变）。伪代码中
`commit`/`facts` 为局部声明（与 legacy 分支 L320–321 同款 `let` 声明形）、`failIssue`/
`walkResultIssues` 为 `mutation-local.ts` 既有模块级助手（L57/L203）、批值一律经
`mutation.values!` 取用（O-3 修订：iteration 0 裸引用未定义的 `values`）：

```ts
// —— F1 载体检查（O(1)；触达面内的载体位仍响亮拒绝——ADR-0007 损坏条款 (i)）——
if (carrierOf(boundaryLive) !== 'Y.Array') {
  // 与 legacy S5 首错同文案同 path：walk 以 path [] 起步 ⇒ issue.path === [] 、
  // message === `Yjs 载体错位（ROOT）：期望 Y.Array，实际 ${actual}`。
  // 实现：复用 extract.ts 的载体错位 issue 构造助手（@internal 导出，见 §11），
  // 不重新拼写字面量（防文案漂移；carrierOf null 不可达态的行为也随之一致）。
  return walkResultIssues(carrierMismatchIssue([], 'Y.Array', boundaryLive));
}
const target = boundaryLive as Y.Array<unknown>;

// —— F2 live 长度事实（O(1)；唯一载体读——length 不在元素读计数代理面）——
const beforeLength = target.length;

// —— F3 域规则 + 逐新值校验（接缝；O(k)）——
const payload = mutation.op === 'array-insert'
  ? { op: 'array-insert', index: mutation.index!, values: mutation.values! }
  : { op: 'array-delete', index: mutation.index!, count: mutation.count! };
const verdict = applyElementwiseArrayMutation(derived, plan, { length: beforeLength }, payload);
if (!verdict.ok) return { kind: 'fail', issues: verdict.issues };   // 域 message/path 逐字 legacy

// —— F4 detached 构造（仅 insert；O(k)，与 legacy 分支 L322–331 同款）——
let commit: PreparedCommit;                               // 局部声明（legacy 分支 L320 同款）
let facts: BoundaryCommitFacts;                           // 局部声明（legacy 分支 L321 同款）
if (mutation.op === 'array-insert') {
  const values = mutation.values!;                        // O-3 修正：批值经 mutation.values!（原稿误写裸 values）
  const builtValues: unknown[] = [];
  for (let j = 0; j < values.length; j++) {
    const built = buildDetachedValue(derived, resolvedBoundary.element, values[j]!,
      [...mutation.path, mutation.index! + j]);           // issue 路径构造逐字不变
    if (built.kind === 'issue') return failIssue(built.issue.path, built.issue.message);
    builtValues.push(built.value);
  }
  commit = { kind: 'array-insert', target, index: mutation.index!, values: builtValues };
  facts   = { kind: 'insert', target, index: mutation.index!, built: builtValues, beforeLength };
} else {
  commit = { kind: 'array-delete', target, index: mutation.index!, count: mutation.count! };
  facts   = { kind: 'delete-range', target, index: mutation.index!, count: mutation.count!, beforeLength };
}

// —— F5 验证计划（收窄变体，见 §7.4）——
return { kind: 'ok', commit, verify: { kind: 'install-facts', facts } };
```

要点与成本核算（对照读计数锚 B-3）：

- **F1**：`carrierOf` 是 instanceof 判定（`carrier.ts` L26–38），零元素读。载体违规
  （目标位被 raw replication 换成 plain 值/Y.Map 等）仍零写入响亮拒绝，issue 与 legacy S5
  首错**逐字节一致**（含 path `[]`）——既有 A-4 载体冒充用例（issue-237 测试 L287–298）
  保绿（§12.1）。
- **F2**：`target.length` 为 O(1) 载体属性，不经 `get/toArray/forEach` ⇒ 不计数。越界判定
  因此在**读任何元素之前**完成（FB3：越界拒绝读计数 0 ≤ 4，且与 n 无关）。
- **F3**：接缝内域规则与 legacy `applyMutationAtBoundary` 数组支同式同文案
  （越界 → 单 issue；insert 逐新值 `validateSubtree(values 树, node.element, v)`，issue path
  `[...plan.prefix, index+j, ...内层]`；delete 只查区间）——合法基线上接受/拒绝结论与
  issue 列表和 legacy **逐字节一致**（组合性：旧数组归纳合法 ∧ 新元素各自合法 ⇒ splice 后
  合法，ADR 0033 背景 1；#435 E 组一致性 fixture 已在参数化/随机用例下钉死
  逐元素 ≡ 整体验证；既有 A-6 28 等价场景全为合法基线，保绿——§12.1）。批量 `values[]`
  一次判定、issue 按插入后位置升序（NC3）。
- **F4**：复用既有 `buildDetachedValue`，构造与失败语义（含 XML/嵌套构造 issue）零变化。
- **F5**：commit 仍由 `commitPrepared` 以 `target.insert/delete` 提交（S8 零改动）⇒ 最小区间
  edit ⇒ 终态字节与 update 增量字节 ≡ 手写最小 edit（ND1–ND4 钉死，AC4）。
- **读计数预算**（结构性预测，k=1）：insert = 事实核同一性 `get(index)` ×1（≤8 ✓）；delete =
  0（≤8 ✓）；越界拒绝 = 0（≤4 ✓）；三者与 n 严格无关（无任何 `get/toArray/forEach` 全量出
  口；`validateSubtree`/`buildDetachedValue` 只消费 payload 值）。legacy 的 1026/1023/512 全部
  消失（S5 walk n + S6 重建 + S9 重投影 walk）。

### 7.3 D3 — 判定次序与行为面差异（AC3 兼容性）

fast path 与 legacy 的检查次序对齐：载体（≈S5 首错位）→ 域规则（≈S6）→ 构造（S7）。合法基线
上一切 message/path/顺序逐字节不变（NC 组）。**有意的行为面差异**仅两处 + 一处次序推论，全部
为 ADR 已确认取舍：

| # | 场景 | legacy（HEAD） | fast path（目标） | 依据 |
|---|---|---|---|---|
| Δ1 | 非 union `T[]`、区间外元素污染（数值/字段级）+ delete/insert | `ok:false`（S5 污染首错，如 path `["items",0]`）；**两条既有恒绿用例钉死此义（§7.7）** | `ok:true`，污染保留不修复（不读取） | ADR 决策 4；FA1/FA2/FA3 |
| Δ2 | 非 union `T[]` 提交、同事务 observer 区间外篡改（长度不变） | throw E201-C（重投影核） | 静默通过（`ok:true`，doc 保持 observer 状态） | ADR 决策 3；FC1/FC2 |
| Δ3 | 污染 ∧ 越界组合输入 | 报污染（S5 先于 S6 域规则） | 报越界（不读元素，域规则先决） | 触达面收窄的自然推论；全仓扫描无既有用例钉此组合（FB3 夹具为干净数组、FA 夹具为界内操作——SA2 §6 与本轮复核一致）——判定不再依赖未触达元素状态，与 Δ1 同源 |

载体级污染（目标位整体非 Y.Array）**不属于**差异面：两条轨都以同文案响亮拒绝（F1）。

### 7.4 D4 — S9 收窄：验证计划判别联合（AC6）

`install-verify.ts` 改造（全部 @internal，不经 `src/index.ts`）：

1. **抽取安装事实核**：把 `verifyBoundaryIntact` 的步骤 ①（L397–428，含 try/catch →
   `boundaryE201D` 包裹）原样抽为独立函数：

   ```ts
   /** @internal 安装事实核（O(1)：长度算术 + 插入项同一性 + set/delete 键事实）。 */
   export function verifyBoundaryInstallFacts(facts: BoundaryCommitFacts): void
   ```

   `verifyBoundaryIntact` 改为调用它后执行步骤 ②（重投影核）——**行为逐字节不变**（legacy
   调用方无感知）。抽取目的：事实核单一实现、两轨共享（NB 组要求两轨事实行为一致）。
2. **新增验证计划判别联合**（即简报「新增收窄的验证输入变体」）：

   ```ts
   /** @internal S9 验证计划（issue #436 / ADR 0033 决策 3）：
    *  boundary      = 事实核 + 边界重投影核（legacy 轨全量输入不变）；
    *  install-facts = 仅安装事实核（fast-path 数组提交——无 proposedBoundary 可比对）。 */
   export type VerifyPlan =
     | { kind: 'boundary'; input: VerifyBoundaryIntactInput }
     | { kind: 'install-facts'; facts: BoundaryCommitFacts };

   /** @internal 分派器：单点分派两轨验证。 */
   export function verifyPrepared(plan: VerifyPlan): void
   ```

   `VerifyBoundaryIntactInput` 自身**不变**（`proposedBoundary` 保持必填，L350–359）——
   target/parent/record/union/array-legacy 五类既有调用点零改动；收窄只发生在新变体上。
3. **消费点**（`mutation.ts`）：`MutationPrepared` 的 `local` 变体与 `BatchItem.verify` 的类型
   由 `VerifyBoundaryIntactInput` 改为 `VerifyPlan`；单操作验证调用（L164）与批量验证循环
   （L153）改为 `verifyPrepared(...)`；`applyValidatedMutation` 的 legacy 分支
   （`verifyInstall` + `verifySnapshotIntact`）不动。

E201 语义保持：事实核偏离 → `boundaryE201C`（`post-commit-verification`、`committed:true`、
不回滚不补偿）；核自身异常 → `boundaryE201D`（防线未能运行，绝不假成功）。fast path 的检出面
= 长度算术 + 变更区间内插入项同一性（NB1：批外额外插入；NB2：插入项被覆写；NB3：被删区间被
补回——长度算术）；区间外同事务篡改不再检出（Δ2）。

**被拒绝的形态**：把 `proposedBoundary` 改为可选字段并在缺失时跳过重投影核——「字段缺席 ⇒
静默跳过一个核」是静默降级形状，未来调用点漏传将无声弱化 S9 而非响亮失败；判别联合获得
exhaustive 检查。另拒绝「fast path 内联裸事实检查」——会在 mutation.ts 复制 E201-D 包裹与
文案纪律，两轨事实核漂移风险。

### 7.5 D5 — 批量面接线（AC1/AC5 批量形态）

批量元素复用 `prepareLocalMutation`（`mutation.ts` L306）⇒ 数组分支自动继承双轨：

- 信封校验 E1–E6、顶层 guard 评估（G）、逐操作 prepare 聚合（P）全部零改动——FA3（污染数组
  delete 在批内 `ok:true`）与 NC5（干净批 `ok:true`）由同一闸门自然满足；
- **阶段 C 折迭守卫**：`composeBatchVerify` 只对 `verify.kind === 'boundary'` 的 item 折迭
  兄弟足迹（现 L350 无条件读 `verify.proposedBoundary` 必须判别化——`install-facts` 项直接
  跳过，无 `proposedBoundary` 可保护/折迭）；**折迭的输入侧不变**：内层循环读 `parsed[j]`
  重放兄弟操作效果（L351–368），不读 item j 的 verify 变体——legacy 边界项对批内 fast-path
  数组足迹的吸收照旧。正确性依据：fast path 仅产生于 kind=`array` 计划，其 `prefix` = 操作
  自身路径，E5 批内路径互不嵌套 ⇒ 严格前缀匹配结构性零命中（引理 3，既有注释已载）；
  record/parent/union 边界项恒为 `boundary` 变体，折迭语义零变化；
- 事实一致性：`beforeLength` 在 prepare 期读取；同批不存在对同一数组的第二个操作（E5 禁
  `['items']` 与 `['items']`/`['items',*]` 并存），批内前序操作不改变本数组长度 ⇒ 事实核输入
  有效（与 legacy 现状同构）。

### 7.6 D6 — ADR-0007 文档一致性注记（默认执行，O-1 落实）

CONTEXT.md 两词条（L144「数组位例外」、L202「触达面收窄」）与 ADR 0033 已按目标状态立法，
实现后即与现实一致，零改动。**残留陈旧面恰一处**：`docs/adr/0007-logical-validation-and-
yjs-runtime-bridge.md` issue #237 修订节（L62–124）——条款 1 的「批量 values[] / count 一次
整体判定，**不逐元素**」（L76–77）与条款 4(ii) 边界清单中的「数组位」（L102–103：「……
数组位……内部既存载体/值域非法仍响亮拒绝」）仍表述 phase-1 数组语义。ADR 0033 决策 4 的标题
只点名修订了 **ADR-0010** issue #237 修订节（L333–361；其后备句 L343–347 引用 ADR-0007 损坏
条款为单一真相源）的数组含义，未点名 ADR-0007 该节。

**处置（iteration 0 的「条件二选一」改为默认执行）**：`docs/AGENTS.md` 的「When code
behavior changes, update every normative document whose stated contract changed」是**义务句
而非许可句**——非 union `T[]` 数组位的既存损坏拒绝语义随本票实现改变，ADR-0007 该节即为
「陈述契约变化的规范文档」，注记为**本票默认交付物**（ALLOW LIST 无条件项）：在该节末尾追加
修订注记（不重写既有条款，沿仓库「显式修订节 + 授权链」惯例；授权 = 已接受的 ADR 0033 决策
4，无需新增 Owner 裁决），建议文案：

> **ADR 0033 修订注记（2026-09-22）**：本节条款 1 的「批量 values[] / count 一次整体判定，
> 不逐元素」与条款 4(ii) 中的「数组位」字面，自 ADR 0033（`docs/adr/0033-elementwise-
> yarray-mutation-validation.md` 决策 1–4）起就**非 union `T[]` 数组位**修订为：逐元素校验、
> 触达面收窄为「数组载体 + 变更区间」——区间外既存损坏不再被普通数组写发现（污染数组的
> delete/insert 照常成功）；条款 7 的「array……按边界规模」成本句对该类目标相应为 O(变更量)。
> union 数组目标（`A[] | B[]`）与本节其余边界种类（union 穿越位、Record 位、delete 父 map
> 位）按本节原文逐字保持；载体形态违规（条款 4(i)）不受影响。ADR-0010 issue #237 修订节
> 后备句的数组含义同步随 ADR 0033 决策 4 修订（该节已被其标题点名，无需另行注记）。

- **豁免路径（唯一）**：Controller 明示裁决「不做注记」时方可省略，且实现报告必须记录该
  裁决引用，不得静默留白。iteration 0 的「实现期自行二选一 + 记理由」选项**废止**（把义务
  降级为可辩护项——SA2 O-1）。
- **与 §7.7 的同批协同**：注记落地后，条款 4(ii)「数组位」对非 union 目标的旧义有了成文
  修订依据，§7.7 两条钉死该旧义的测试重锚即有完整规范链；两者随实现**同批交付、同批复核**
  （SA2 O-1 明示该协同）。

### 7.7 D7 — 既有语义钉死用例盘点与定向重锚（F-1 落实，AC7 前提）

**盘点（全仓既有测试扫描，SA2 §13 + 本轮独立复核一致）**：以下两条 HEAD 恒绿用例（SA6
pre-contract 基线 5622 全绿含之）钉死 Δ1 的 legacy 拒绝语义，fast path 落地后必翻红——其
目标均为**非 union** `YArray<Item>`、元素级污染在变更区间外、期望 `ok:false` 零写入，正是
Δ1 场景；其授权链均引 ADR-0007 #237 修订节条款 4(ii)——恰为 §7.6 识别的陈旧句面：

| # | 用例（文件/行号/锚） | 现断言（HEAD 恒绿） | fast path 后目标行为 | 处置 | 授权 |
|---|---|---|---|---|---|
| P-1 | `packages/doc-runtime/test/apply-validated-mutation-fatal-contract.test.ts` L209–235（describe「领域失败面不进入 fatal 通道（AC-3/W5 护栏）」，W5 锚） | schema `W5_TEXT`（L218）`items: YArray<Item>`（非 union）；L225 `items.get(0).set('qty','not-a-number')` 后 L227–229 `array-insert index 1` 合法新值；断言 `result.ok === false` + `issues.length > 0`（L230–233）+ `stateBytes` 不变（L234） | `ok:true`（污染在区间外不读取）+ 污染保留 ⇒ 三断言全翻红 | **定向重锚**（下 a 项） | ADR 0033 决策 4 + ADR-0007 #237 修订节 ADR 0033 注记（§7.6 同批） |
| P-2 | `packages/doc-runtime/test/issue-237-path-localized-validation-red.test.ts` L548–569（describe「A-7 set 整值替换修复语义」内「对称面（绿锁定）」锚） | 共享夹具 `TEXT_LIB_ITEM`（L91–92）`library: YArray<Item>`（非 union）；L553–555 `library.get(0).set('qty','corrupt-not-a-number')` 后 L559–562 `array-insert index 1`；断言 `r.ok === false` + `stateBytes` 不变 + `ev.count === 0` + `library.length === 3`（L565–568） | 同上 `ok:true`、length 变 4 ⇒ 四断言全翻红 | **定向重锚**（下 b 项） | 同上 |

**处置设计（重锚到 union 数组载体——legacy 永久拒绝面）**：

- **a. P-1（W5）定向修订**：`W5_TEXT` 的 `items` 字段改为 union 数组声明（如
  `items: YArray<Item> | YArray<string>`）；seed/污染/操作/断言**原样保留**——union 数组
  目标永久走 legacy 全量边界（§7.1），元素污染照旧 `ok:false` + issues + 零写入（探针
  U3/负控 NA1 同款行为），「领域失败留在 ok:false 联合、不被 fatal 通道吞并」的 W5 意图
  锚原样成立。用例注释追加授权链（ADR 0033 决策 4 + ADR-0007 注记），保留既有
  issue #237 授权链沿革（仓库注释携带授权链的惯例）。
- **b. P-2（对称面）定向修订**：**新增局部 schema 常量**（如 `TEXT_LIB_ITEM_UNION`：
  `library: YArray<Item> | YArray<string>`；**不得改共享 `TEXT_LIB_ITEM`**——A-2/A-4/A-5/
  A-6 等用例共用之），该用例 `fixtureOf` 改用局部常量；seed（`librarySeed(3)`）/污染/操作/
  断言**原样保留**。「提取型边界内既存损坏仍响亮拒绝」的对称面意图锚在 union 数组 legacy
  面原样成立（与 A-7 set 目标位修复语义的互补三分面继续成立：set 目标位修复 / 非_union
  数组位区间外不发现〔SA6 FA 组锚定〕/ union 数组位整边界响亮拒绝〔本用例锚定〕）。注释
  同 a 项更新授权链。
- **实现中性（顺序安全）**：union 数组目标在 HEAD 与实现后**均为 legacy 全量路径**（§7.1
  永久双轨），重锚后的两用例在两态下都绿——重锚与实现的落地顺序无行为依赖；但两者必须
  **同批交付**（同一变更集），否则实现后、重锚前存在红窗（AC7 不可达）。
- **测试技术可行性**：union 数组物化/消歧已被 SA6 夹具实证（`uarr: YArray<number> |
  YArray<string>` seed `[1,2,3]` → number 成员；污染后无成员可容 → `ok:false` path
  `['uarr',0]`，NA1/U3）；`{name,qty}` 记录元素 union（`YArray<Item> | YArray<string>`）
  同理：seed 消歧到 Item 成员，`qty` 污染后两成员皆不容 ⇒ 首错拒绝。两用例均不断言具体
  issue path（P-1 只断言 `issues.length > 0`；P-2 不查 issues），无路径断言可破。

**处置选项裁决**：

| 选项 | 裁决 | 理由 |
|---|---|---|
| 重锚到 union 数组载体 | **采纳** | 两用例意图（W5「领域失败不被 fatal 吞并」/对称面「提取型边界内损坏响亮拒绝」）在 legacy 永久拒绝面上原样成立；断言面零放宽；实现中性（两态均绿）；与 SA6 契约零重叠（FA 组锚定的是非 union 面**新**目标行为，重锚锚定的是 union 面**不变**行为——互补不重复） |
| 期望翻转为目标行为（`ok:true` + 污染保留） | 拒绝 | 与 SA6 契约 FA1–FA3 完全重复（非 union 污染写 `ok:true` 已有专用红转绿锚）；且消灭两用例的意图锚——W5 所在 describe 主题是「领域失败不进 fatal 通道」，翻转后不再锚定该主题；对称面「三分面互补」语义随之丢失 |
| 删除两用例 | 拒绝 | union legacy 拒绝面失去既有护栏锚（SA6 NA1 虽也锚 union 拒绝，但 W5 的 fatal-通道护栏与对称面的三分面语义独立成锚）；删锚弱于移锚 |

**范围与禁区**：两文件的定向修订**仅限上述两用例**（schema 文本/局部常量/注释授权链/锚定
载体），文件内其余用例零触碰；SA6 三件套仍冻结（DENY）。断言语义面（`ok:false` + 零写入 +
`issues > 0` / `length` 不变）**不得放宽**——SA4 复核点。

### 7.8 未选择的主要方案（汇总）

| 方案 | 拒绝原因 |
|---|---|
| 仅按 `plan.kind='array'` 接管 | union 数组目标 `plan.kind='array'`（U1）会被误接管，NA1/NA2 红灯 |
| 在 `planMutationBoundary` 内分流 | ADR 决策 1 明文「规划层完全不动」 |
| doc-runtime 内联复制域规则（不经接缝） | 域 message/path 逐字一致是兼容行为；复制必漂移；#435 接缝即为此交付 |
| `proposedBoundary` 可选化 + 缺失跳核 | 静默降级形状（见 §7.4） |
| fast path 区间内重投影（保留部分重投影核） | 违反 ADR 决策 3「省略」定夺（事实核的插入项同一性已覆盖变更区间身份）；FC 组钉死省略形态 |
| 保留整数组 walk 但跳过 validate | 不满足 FB 读计数预算（仍 O(n) 提取）；半措施 |
| write-then-undo / 提交后回滚 | 包纪律 + ADR 决策 2 明文禁止；零写入锚 B-4 |
| P-1/P-2 期望翻转或删除（§7.7 选项 b/c） | 与 SA6 FA 组重复/意图锚丢失（§7.7 裁决表） |
| ADR-0007 注记留待实现期自行二选一 | docs/AGENTS.md 为义务句；二选一把义务降级为可辩护项（O-1）；仅保留 Controller 明示豁免路径 |

---

## 8. 接口、类型与数据流路线

### 8.1 类型面变化（全部 @internal）

```ts
// install-verify.ts（新增导出，均 @internal——不经 src/index.ts）
export type VerifyPlan =
  | { kind: 'boundary'; input: VerifyBoundaryIntactInput }
  | { kind: 'install-facts'; facts: BoundaryCommitFacts };
export function verifyBoundaryInstallFacts(facts: BoundaryCommitFacts): void;  // 抽取的事实核
export function verifyPrepared(plan: VerifyPlan): void;                        // 分派器

// mutation-local.ts
export type LocalPreparedResult =
  | { kind: 'fail'; issues: MutationIssue[] }
  | { kind: 'ok'; commit: PreparedCommit; verify: VerifyPlan };   // was VerifyBoundaryIntactInput

// mutation.ts
type MutationPrepared = … | { kind: 'local'; commit: PreparedCommit; verify: VerifyPlan } | …;
interface BatchItem { commit: PreparedCommit; verify: VerifyPlan }            // was VerifyBoundaryIntactInput

// mutation-local.ts（新增 import，均为 #435 已公共导出的既有面）
import { applyElementwiseArrayMutation } from '@nomicore/vfsl';
import type { ArrayCarrierFacts, ElementwiseArrayMutationPayload } from '@nomicore/vfsl';
```

公共导出面（`src/index.ts`）零变化；`VerifyBoundaryIntactInput`/`BoundaryCommitFacts` 保持
原形。无状态机、无持久化、无 wire 变化。

### 8.2 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| 单操作 fast path（非 union T[] insert/delete） | 调用方 → `applyValidatedMutation(derived, doc, {op:'array-*',…})` | 无（prepare 期零 live 写） | S3 规划 → S4 导航 → 闸门 → F1 载体/F2 长度/F3 接缝校验/F4 detached 构造 | — | `target.length`（O(1)）、事实核 `get(index+i)`（k 次） | `ok:true` + 恰 1 个 update 事件（最小 edit 字节 ≡ 手写） | 一切拒绝（载体/越界/新值/构造）先于 live 写：`ok:false` 零写入零 update | FA1/FA2、FB1–FB3、NC1–NC4、ND1–ND4 |
| 提交 + S9（fast path） | 同上（prepare 全绿） | `transactGuarded` 内 `commitPrepared`：`target.insert/delete` | 单 guarded Yjs transaction 最小区间 edit | live Y.Doc（yjs update 流） | `verifyPrepared({kind:'install-facts'})` → 事实核 | 长度/同一性符合 ⇒ `ok:true`；同事务区间内干扰 ⇒ throw E201-C（committed:true） | fatal 不回滚不补偿；doc 保持 observer 实际状态 | NB1–NB3、FC1/FC2 |
| 单操作 legacy（union 数组目标 / union 穿越 / set/delete/Record/target） | 同上，闸门不合 | 同上 | 既有 S5 walk → S6 全量重建校验 → S7 构造（代码原样） | 同上 | `verifyBoundaryIntact` 双核 | 与 HEAD 逐字节一致（污染拒绝/E201-C 双核/干净写照常）——§7.7 两重锚用例锚定此轨 | 与 HEAD 一致 | NA1–NA4、NB4、NC 组、**P-1/P-2（重锚后）** |
| 批量（信封 `{ops}`） | 调用方批量信封 | 单事务按序 `commitPrepared` ×N | E1–E6 → guard → 逐操作 prepare（含闸门分流）→ 阶段 C（`install-facts` 项跳折迭；legacy 边界项照常吸收 parsed 足迹） | 同上（单条 owned update） | 逐操作 `verifyPrepared` | 全绿 `ok:true`；任一失败聚合 issues 整体零写入 | 聚合失败零写入；fatal 穿出 E204/E205 分类 | FA3、NC3、NC5、TD-3/S6/S7（保绿，§12.1） |
| 复制/诊断下游 | yjs update 事件流 | — | update bytes 与 HEAD 逐字节相同（commit 形态不变） | 复制协议/诊断捕获 | 既有订阅面 | 零变化（单事件、最小增量） | — | ND2/ND4 |

运行时数据创建面唯一实质变化：非 union 数组写的校验输入从「整数组逻辑快照」变为「载体长度事实
+ 新值/区间」；写入字节流零变化。

---

## 9. 错误、恢复、并发与幂等

- **零写入（AC5）**：fast path 一切失败分支（F1 载体、F3 越界/载荷域、F3 新值校验、F4 构造、
  批内聚合失败）都在 `prepareLocalMutation` 内返回 `{kind:'fail'}`，先于任何
  `transactGuarded`；无 write-then-undo。锚 B-4：`encodeStateAsUpdate` 逐字节不变 ∧ update
  事件数 0（NC1–NC3、NA1/NA3；P-1/P-2 重锚后断言面同样零写入）。
- **fatal 分类不削弱**：E201 变体 C/D 文案、`phase='post-commit-verification'`、
  `committed:true`、不回滚不补偿——事实核抽取为逐字移动，两轨同源。E203/E204/E205 面零变化
  （`DerivedInvariantError` 收编路径不动）：闸门后结构节点非 array 的两树分歧守卫以「回退
  legacy」处置；闸门处 `resolve(boundaryNode)` 抛 `DerivedInvariantError` 与 legacy walk
  内 resolve 抛错**同 try、同 catch、同分类（E204）**，无新增可达向量（§7.1 O-4）。
- **并发/TOCTOU**：同步单线程调用面（`assertOutermostTransactionContext` 不变）；prepare 读
  长度与提交在同一同步调用内。唯一干扰窗口是同事务 observer（`afterTransaction` cleanup），
  其检出面 = 事实核（Δ2 为已确认收窄；长度变化形态仍检出——TD-3 保绿机理，§12.1）。批量同构。
- **幂等/重试**：非本系统属性（CAS 经 ADR 0025 guard，评估位置与语义零改动）；领域拒绝与
  fatal 的可重试性分类不变。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| `applyValidatedMutation` 公共调用方（namespace-runtime typed adapter、宿主、测试） | 判别联合结果 + throw fatal | 签名/结果面零变化；可观察差异仅 Δ1/Δ2/Δ3（均为 ADR 立法取舍） | 无 | `src/index.ts` 导出面零变化；SA6 契约 B-1（只经公共入口观察） |
| `prepareBatchMutation` / `composeBatchVerify`（mutation.ts 内部） | `verify: VerifyBoundaryIntactInput`；无条件折迭 | `verify: VerifyPlan`；`install-facts` 项跳折迭（折迭输入侧 parsed 驱动不变） | §7.5 两处 | `mutation.ts` L305–311/L347–371 |
| `verifyBoundaryIntact` 既有调用点（mutation.ts L153/L164） | 直调 | 经 `verifyPrepared` 分派；legacy 行为不变 | §7.4 第 3 点 | `mutation.ts` L147–166 |
| `verifyInstall` / `verifySnapshotIntact` 消费方（materialize/replace/create-initial-document/schema-replace） | 不经 `verifyBoundaryIntact` | 零影响 | 无 | `grep VerifyBoundaryIntactInput` 全仓仅 mutation-local/mutation.ts |
| 复制协议 / 诊断捕获（namespace-runtime、namespace-diagnostic-log、ws-replication） | 订阅 update 事件/字节 | update 事件数与字节形态零变化 | 无 | ND1–ND4；ADR 0033「复制协议、诊断捕获零改动」 |
| `readLogicalValueAtPath` / 物化面 | 不在写管线 | 零影响 | 无 | 读面独立（ADR 0008） |
| **既有测试 P-1**（`apply-validated-mutation-fatal-contract.test.ts` W5 用例，L209–235） | 非 union `YArray<Item>` 污染 + insert → 断言 `ok:false` 零写入（恒绿） | fast path 下实际行为变 `ok:true`（Δ1）——断言面若不动必翻红 | **定向重锚**到 union 数组载体（§7.7 a；ALLOW LIST 定向项） | SA2 F-1 证据①；本轮 L209–235 复核 |
| **既有测试 P-2**（`issue-237-path-localized-validation-red.test.ts` 对称面用例，L548–569） | 同上（恒绿，另断言 `ev.count===0`/`length===3`） | 同上（四断言全翻红） | **定向重锚**（§7.7 b；局部 union schema 常量，不动共享 `TEXT_LIB_ITEM`） | SA2 F-1 证据②；本轮 L548–569 复核 |

其余既有测试面（A-2/A-4/A-5/A-6、TD-3、S6/S7、guard/信封/物化/干净数组写）不受影响——逐项
机理见 §12.1 扫描结论。

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因（对应正文） |
|---|---|---|
| `packages/doc-runtime/src/mutation-local.ts` | `case 'array'` 插入 §7.1 闸门与 §7.2 fast path 分支（legacy 分支代码原样保留）；`LocalPreparedResult.verify` → `VerifyPlan`；新增 vfsl 接缝 import；模块头 S5/S6/S9 管线注释更新为双轨描述 | §7.1/§7.2/§8.1 |
| `packages/doc-runtime/src/install-verify.ts` | 抽取事实核为 `@internal verifyBoundaryInstallFacts`（逐字移动）；新增 `@internal VerifyPlan` + `verifyPrepared`；`verifyBoundaryIntact` 改调抽取核（行为不变）；#237 段注释补 ADR 0033 收窄说明 | §7.4/§8.1 |
| `packages/doc-runtime/src/mutation.ts` | `MutationPrepared`/`BatchItem.verify` → `VerifyPlan`；两处验证调用改 `verifyPrepared`；`composeBatchVerify` 对 `install-facts` 项跳折迭（含引理 3 依据注释） | §7.4/§7.5/§8.1 |
| `packages/doc-runtime/src/extract.ts` | （条件）`@internal` 导出载体错位 issue 构造助手（现私有 `mismatchIssue`/`makeIssue` 面）供 fast path F1 同文案复用；若 SA3 选择在 mutation-local 内以相同助手纪律内联，则本文件零改动——二选一，不得两端都改 | §7.2 F1（同文案反漂移） |
| `docs/adr/0007-logical-validation-and-yjs-runtime-bridge.md` | **（默认执行，O-1）**issue #237 修订节（L62–124）末尾追加 ADR 0033 修订注记（建议文案见 §7.6，不重写既有条款）；豁免仅限 Controller 明示裁决且实现报告记录 | §7.6（docs/AGENTS.md 义务句） |
| `packages/doc-runtime/test/apply-validated-mutation-fatal-contract.test.ts` | **（定向修订，F-1）仅 W5 用例（L209–235）**：`W5_TEXT` 的 `items` 改 union 数组声明 + 注释追加授权链；seed/操作/断言原样保留、断言语义面不放宽；文件内其余用例零触碰 | §7.7 a/§10/§12（AC7 可达性） |
| `packages/doc-runtime/test/issue-237-path-localized-validation-red.test.ts` | **（定向修订，F-1）仅对称面用例（L548–569）**：新增局部 `TEXT_LIB_ITEM_UNION` 常量并令该用例 `fixtureOf` 改用之 + 注释追加授权链；共享 `TEXT_LIB_ITEM` 与其余用例（A-1..A-7 等）零触碰 | §7.7 b/§10/§12（AC7 可达性） |
| `packages/doc-runtime/test/**`（除上述两定向文件外，仅新增文件） | 可选补充回归用例；**不得修改**任何既有测试文件（含 SA6 三件套） | §12（非必需——SA6 契约即验收面） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/test/issue-436-array-fastpath-contract.test.ts` / `-control.test.ts` / `-fixture.ts` | SA6 验收契约/负控/夹具 | 红灯必须经实现自然转绿；修改即篡改验收（SA6 §12.4 契约纪律） |
| 上两定向测试文件的**其余用例**（fatal-contract W1–W4/AC-6 等；issue-237 A-1..A-7、R 组等） | 不钉死 Δ1 旧义（§12.1 扫描） | 定向范围纪律：重锚只触及盘点表两用例；扩散即无授权范围扩张（SA2 F-1 修订要求） |
| `packages/vfsl/**` | 逐元素接缝 + 一致性 fixture（ADR 决策 5 enforcement）已由 #435 交付冻结 | 本票是 doc-runtime 接线票；接缝语义/导出面不动 |
| `packages/doc-runtime/src/index.ts` | 公共导出面 | 无新公共 API（契约 B-1）；public-surface guard 测试面不动 |
| `packages/doc-runtime/src/mutation.ts` 的信封解析/`parseMutationCore`/`parseGuard`/`evaluateGuard`/E1–E6 区 | 解析与 guard 语义冻结 | message 逐字节兼容面；本票只需 §7.4/§7.5 两处触碰 |
| `packages/doc-runtime/src/{materialize,replace,create-initial-document,schema-replace,read,extract(除条件项)}.ts` | 全量物化/替换/读面 | 不在本票触达面（SA6 §10「不受影响」） |
| `packages/namespace-runtime/**`、`packages/namespace-diagnostic-log/**`、`apps/**`、wire/协议文档 | 复制/诊断/宿主面 | update bytes 与事件形态零变化（ND 组钉死） |
| `docs/adr/0033-*.md`、`docs/adr/0010-*.md`、`CONTEXT.md`、`docs/vfsl/**`、`docs/protocols/**` | 规范母法与词汇 | 0033 已按目标状态立法；0010 #237 节已被 ADR 0033 决策 4 标题点名修订，无需本票注记（§7.6） |
| `vitest.config.ts`、`tsconfig*.json`、`pnpm-lock.yaml`、`package.json`（各包） | 配置面 | 无配置/依赖变化（SA6 §16 同款纪律） |

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据（HEAD） | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 闸门分流 | 契约 FA1–FA3 红（8 轮红之一）；负控 NA1–NA4 绿；探针 U1/U2/S1–S3 | 已有：`issue-436-array-fastpath-contract.test.ts` FA 组 + `-control.test.ts` NA 组（零修改） | FA1–FA3 转绿：非 union 污染数组 delete/insert（含批内）`ok:true` + 污染保留；NA1–NA4 保持绿：union 目标/穿越照旧拒绝、E201-C、干净写 ok |
| AC2 O(n)→O(k) | FB1/FB2 红（读计数 1026/1023、8194/8191）；探针 G2/G2d/G5（n=10⁵ ×89.2） | 已有：FB1/FB2 + 探针（探针不在门禁面，作软证据） | k=1 insert 读计数 ≤8（预测 =1）、delete ≤8（预测 =0），n=512 与 n=4096 相等；探针 exit 0 不变 |
| AC3 live 长度越界 + 域规则一致 | FB3 红（越界读计数 512/4096）；NC1/NC2/NC4 绿 | 已有：FB3 + NC1–NC4 | 越界 insert/delete 读计数 ≤4（预测 =0）；message/path 逐字不变；`index===length`/`index+count===length` 接受；一切拒绝零写入零 update |
| AC4 update 事件形态 | ND1–ND4 绿（无 fast path 可比）；探针 O1–O5（含 clear+rebuild 反证） | 已有：ND 组（fast path 落地后即比较 API 轨） | 恰 1 个 update 事件；终态/增量字节 ≡ 同 clientID 手写最小 edit；对端复制收敛 |
| AC5 零写入 | NC1–NC3/NA1/NA3 绿（绑在 legacy 路径上） | 已有：同上用例在 fast path 分流后自然覆盖目标分支 | 拒绝分支 `encodeStateAsUpdate` 逐字节不变 ∧ update 事件数 0；批内任一失败整体零写入 |
| AC6 S9 收窄 | FC1/FC2 红（区间外篡改 E201-C）；NB1–NB4/NA2/NA4 绿 | 已有：FC + NB + NA 组 | FC1/FC2 转绿（区间外篡改静默通过、`ok:true`、doc 保持篡改态）；NB1–NB3 转绿于 fast path（长度算术/同一性 E201-C 保留）；NB4/NA2/NA4 保持绿（legacy 双核） |
| **F-1 既有钉死用例处置** | P-1/P-2 在 HEAD 恒绿（SA6 基线 5622 含之）且钉死 Δ1 旧义；SA2 全仓扫描 + 本轮独立复核恰两条 | §7.7 定向重锚（union 数组载体），随实现同批交付 | 重锚后 P-1/P-2 在**实现前**（重锚先落）与**实现后**均绿：`ok:false` + issues>0（P-1）/ `ev.count===0`+`length===3`（P-2）+ 零写入；意图锚保持（W5 领域失败留联合/对称面提取型边界响亮拒绝）；断言面不放宽 |
| **AC7 门禁复绿（预测修正）** | post-contract 根 test 失败面恰 = 契约 8 条（SA6 §4：464 files/5647 tests，8 failed）；P-1/P-2 恒绿 | `npx vitest run packages/doc-runtime/test/issue-436-array-fastpath-{contract,control}.test.ts`；`npx tsc -p packages/doc-runtime/tsconfig.json`；根 `pnpm typecheck`；根 `pnpm test` | **实现前**（§7.7 重锚 + §7.6 注记已落、src 未动）：根 test 失败面恰 = 契约 8 条（重锚两用例绿——union 轨两态均 legacy）；**实现后**：契约 8/8 绿 + 负控 17/17 绿 + 重锚 2 用例绿 + 全部既有面绿 = **464 files 全绿（5647 tests，Type Errors: no errors）** + 两根门 exit 0。iteration 0「464 全绿」预测未计 P-1/P-2 翻红，本轮已修正——全绿以 §7.7 定向修订同批交付为前提 |
| 闸门不过度接管（风险 R1） | NA 组绿 | 已有 | union 目标永不被 fast path 接管 |
| 事实核两轨一致（风险 R2） | NB4 绿 | 已有 | 同一事实核实现共享 |

SA1 不编写/运行测试；上表用例已由 SA6 交付（FA/FB/FC/NA/NB/NC/ND），§7.7 两项为对既有用例的
定向重锚；实现后由验证角色执行。

### 12.1 既有测试面扫描结论（O-2 落实；SA2 §12 代核 + 本轮独立复核一致）

扫描方法：doc-runtime 全部含 `array-insert|array-delete` 的既有测试文件（10 个）逐文件核对
「污染/篡改 + 数组操作」组合与期望方向；两轮独立扫描（SA2 攻击评审、SA1 本轮）结论一致。

| 既有测试 | 位置 | 与本票关系 | 结论与机理 |
|---|---|---|---|
| P-1 W5（fatal-contract） | `apply-validated-mutation-fatal-contract.test.ts` L209–235 | 钉死 Δ1（非 union 污染 + insert → `ok:false` 零写入） | **唯一两条翻转面之一** → §7.7 a 重锚 |
| P-2 对称面（issue-237） | `issue-237-path-localized-validation-red.test.ts` L548–569 | 同上（另钉 `length` 不变） | **另一条** → §7.7 b 重锚 |
| A-2 无关分支不访问（issue-237，L211–242） | set 面无关分支污染 → `ok:true` | 不在数组分支（set op）；语义由 #237 早已立法 | 保绿（零关联） |
| A-4 载体冒充（issue-237，L272–299） | Y.Map 冒充数组位 → `ok:false` 零写入 | F1 载体检查保留（ADR-0007 损坏条款 (i)，同文案同 path） | 保绿（Δ 表明示非差异面） |
| A-5 批量整判（issue-237，L303–） | 新值含非法元素 → 整批拒；越界不 clamp | 域规则经接缝逐字（`values` 批一次判定/越界 message 同 legacy） | 保绿（§7.2 F3；NC1–NC3 同款） |
| A-6 行为等价 28 场景（issue-237，L374–513） | 合法基线（`expectValidBaseline` 前置）增量判定 ≡ 完整 proposed 校验 | 无污染场景；fast path ≡ oracle 由组合性保证（ADR 决策 5 + #435 E 组） | 保绿 |
| TD-3 批后数组干扰（issue-350-sa7-batch-divergence，L171–190） | `notes: YArray<string>` 批量 insert + observer 追加 EXTRA → E201-C | 长度**变化**形态：install-facts 长度算术检出；且批内 delete 的 legacy 边界项重投影（parsed 驱动折迭照旧）双通道均在 | 保绿（双通道检出，§7.5） |
| S6/S7 共享边界折迭（issue-350-batch-shared-boundary，L226–276） | array 足迹折入 delete/Record 边界 | 折迭输入 = `parsed[j]`（`composeBatchVerify` L351–368），不依赖 item j 的 verify 变体；boundary 项折迭逻辑零改动 | 保绿（§7.5） |
| guard/信封面（issue-347/348/350-batch-envelope） | E1–E6/guard 语义 | 本票零触碰区（§11 DENY） | 保绿（零关联） |
| 物化/fatal 动态面（transaction-fatal-materialize-contract、sa7-fatal-dynamic-verify） | materialize/verifyInstall 面 | 不经 `verifyBoundaryIntact`；无数组污染锚 | 保绿（零关联） |
| 干净数组写（apply-validated-mutation-operations 等） | 合法基线 insert/delete/append/越界 | fast path 合法基线行为与 legacy 逐字节一致（§7.3） | 保绿 |

**结论**：钉死 Δ1/Δ2 旧语义的既有用例**恰为 P-1/P-2 两条**；其余既有面在本设计下全部保绿
（机理如上，SA3/SA4 复核不必重扫全仓）。

---

## 13. 风险、回滚与残余问题

| 风险 | 等级 | 缓解 | 检出锚 |
|---|---|---|---|
| R1 闸门漏看节点 kind（union 被误接管） | 高 | 双条件合取 + 接缝 fail-closed 第三锁 + legacy 分支原样保留 | NA1/NA2 红灯即fail |
| R2 事实核被连带给省略 | 高 | 事实核为共享单实现；`install-facts` 变体只跳重投影核 | NB1–NB3 |
| R3 载体错位文案漂移（F1 手拼字面量） | 中 | 复用 extract.ts 同一构造助手（条件 ALLOW 项） | 既有 doc-runtime carrier/nested-path 测试 + A-4 + NC 域规则组（文案面） |
| R4 compose 折迭误吞 `install-facts` 项或漏折 legacy 项 | 中 | `verify.kind` 判别 + 引理 3 零命中论证；折迭输入侧（parsed 驱动）不动 | NC5/FA3 + TD-3/S6/S7（§12.1） |
| R5 读计数预算意外超出（如误用 `toArray`/`toJSON` 调试残留） | 中 | 设计明示唯一元素读 = 事实核 `get(index+i)`×k；实现评审点 | FB1–FB3（预算 ≤8/≤4 且 n 无关） |
| R6 Δ3（污染∧越界组合报告次序变化）被当作回归 | 低 | §7.3 明示为触达面收窄推论，非回归；全仓扫描无既有用例钉旧次序 | —（设计澄清；§12.1） |
| R7 ADR-0007 注记义务未履行 | 低 | D6 默认执行（ALLOW LIST 无条件项）；豁免仅 Controller 明示裁决且实现报告记录 | `git diff` 核对注记在位 + docs/AGENTS.md 义务句 |
| **R8 既有锚迁移弱化意图（重锚把护栏锚改虚）** | 中 | 重锚锚定载体 = union 数组 legacy 永久拒绝面（ADR 决策 1 立法保留），意图/断言面原样；实现中性（两态均绿）；SA4 复核 diff 面 = 仅 schema 文本/局部常量/注释授权链，断言语义不放宽（§7.7 禁区） | P-1/P-2 双态绿 + NA1（union 拒绝面）双锚 |
| **R9 定向修订与实现不同批落地（红窗/无授权改测试）** | 中 | §7.7 明示同批交付（同一变更集）；设计已把定向修订入 ALLOW LIST——SA3 无需现场扩权 | AC7 两态预测（§12：实现前失败面恰 = 契约 8） |

**回滚**：改动封闭于 doc-runtime 内部管线三文件（+ 条件性 extract.ts + ADR-0007 注记 + 两测试
定向重锚）；无 schema/wire/持久化迁移。回滚 = 恢复单一 legacy 路径 + 还原两用例锚定载体与
注记（同一 revert），契约 FA/FC 组回到红、其余面不变，无数据迁移。**失败可重试性**：领域拒绝
可重试语义不变；fatal 不可恢复语义不变。

**残余问题 / follow-up（非本票必要条件）**：

- raw-replication 污染检测面缩小（未触达元素不再被普通写发现）为 ADR 0033 已声明让渡；
  合法性重建机制与 carrier 覆盖面审计仍是 ADR-0010 #237 修订节 follow-up (a)/(b) 登记
  项，不因本票关闭。
- `array-delete` 前像捕获（fast path 后不再免费获得被删元素）为独立议题（ADR 0033
  「不做什么」末条已登记）。
- 毫秒级性能基线（n=10⁵ 解耦）仅探针软证据，不入门禁（ADR 决策 6）。
- 非 union 数组位「区间外污染 + 合法写」的恒定 `ok:true` 目标行为已由 SA6 FA 组锚定，无需
  另立持久回归锚（§7.7 选项 b 拒绝理由之一）。

## 14. 评审修订映射

评审输入：`wiki/raw/task_issue-436_sa2_review.md`（iteration 0 设计攻击评审，verdict reject，
F-1 MAJOR + O-1..O-4 MINOR）。逐条落实：

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **F-1（MAJOR）**：两条既有恒绿测试钉死 legacy Δ1 语义，实现后必翻红；原范围「仅新增文件」下 AC7 不可达成；§12 全绿预测事实错误 | §1 目标 5；§2 钉定面段；§3 G-6；§6 决策 4 行；§7.7（盘点表 P-1/P-2：文件/行号/现断言/目标行为/处置/授权 + 重锚设计 a/b + 实现中性 + 可行性 + 选项裁决）；§8.2 legacy 行；§10 新增 P-1/P-2 两行；§11 ALLOW 两定向项 + DENY「其余用例」行；§12 F-1 行 + AC7 行预测修正 + §12.1；§13 R8/R9 | **已落实**：两用例显式盘点（含行号/处置/授权）；定向测试修订入 ALLOW（注明 ADR 0033 决策 4 授权、禁触 SA6 三件套与文件内其余用例）；AC7 预测修正为两态判据（实现前失败面恰 = 契约 8；实现后 464 files/5647 全绿含两条重锚用例）；§13 补 R8（锚迁移）+ R9（同批交付）。复审核对点即 §12 AC7/F-1 两行 |
| **O-1（MINOR）**：ADR-0007 注记应默认执行；选项 b 把义务降级为可辩护项；注记与两测试修订应同批复核 | §7.6（重写：默认执行 + 建议文案 + 唯一豁免 = Controller 明示裁决 + 与 §7.7 同批协同）；§6 ADR-0007/docs-AGENTS 行；§11 ALLOW（条件→无条件）；§7.8 拒绝行；§13 R7 | **已落实**：a 定为默认，原「实现期二选一」废止；同批复核要求写入 §7.6/§7.7 |
| **O-2（MINOR）**：§12/§13 应补「既有测试面扫描结论」使 SA3/SA4 不必重扫 | §12.1（新表：两条翻转 + A-2/A-4/A-5/A-6/TD-3/S6/S7/guard/物化/干净写保绿机理 + 扫描方法与双轮一致声明） | **已落实** |
| **O-3（MINOR）**：§7.2 伪代码裸 `values` 未定义、`commit/facts/failIssue` 未声明 | §7.2（`const values = mutation.values!` + 注释标注 O-3 修正；`let commit: PreparedCommit` / `let facts: BoundaryCommitFacts` 局部声明并标 legacy L320–321 同款；`failIssue`/`walkResultIssues` 标注为 mutation-local L57/L203 既有助手） | **已落实** |
| **O-4（MINOR）**：闸门处 `resolve` 抛 DerivedInvariantError 的分类未明写 | §7.1 末新增专段（同 try/同 catch/同分类 E204；无新增可达向量；正常 schema 恒不抛）；§9 fatal 分类段同步 | **已落实** |

SA2 评审「附：正面确认」的七项论断（闸门正确性/永久 union 回退/O(k)/live 长度边界/零写入与
E201/最小 edit/S9 收窄）在本设计对应章节（§7.1/§7.2/§7.4）未改动实质，仅按 O-3/O-4 补充
说明；§12.1 采纳其全仓扫描结论并经本轮独立复核。

## 15. 设计后 ADR 冲突复查评估

**结论：需要（`requiresConflictRecheck = true`），范围收窄**。iteration 0 判「不需要」的
三点依据（无公共 API/wire/schema/状态机变化；不修订决议只落实现行 ADR；缺 SA8 工件的缺省
复查已被实质覆盖）对 **fast path 实现面本身仍成立**（该面经 SA2 逐锚点攻击确认无架构冲突，
本轮未改实质）。iteration 1 新增两类交付物使复查重新必要：

1. **规范性文档编辑**：本票现在**修改 ADR 文件本身**（ADR-0007 #237 修订节追加修订注记，
   §7.6）——即对既有决策文档的陈述契约做显式修订记录。虽授权链完整（ADR 0033 决策 4 已
   接受 + docs/AGENTS.md 义务句），注记文本与 ADR-0007 正文其余条款、ADR 0033 决策 1–4、
   ADR-0010 L343–347 引句的一致性应由冲突复查独立核验（iteration 0 无 SA8 工件，该一致性
   此前仅由设计自证）。
2. **既有验收锚迁移**：两条既有恒绿测试的定向重锚（§7.7）以 ADR 0033 决策 4 为授权，但
   「重锚不弱化意图锚」的判定（断言面不放宽、union 载体上意图原样成立）值得随注记同批复核
   （SA2 O-1 亦明示两者应同批复核）。

复查范围建议限定为：① 注记建议文案（§7.6）与 ADR-0007 条款 1/4(ii)/7、ADR 0033、ADR-0010
引句的一致性；② §7.7 重锚授权链与意图保持；③ 其余面（fast path 实现管线）不要求重查。
