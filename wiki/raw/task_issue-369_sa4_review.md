# SA4 实现静态审查 — issue #369 W2：lease 公共面 `readArray` / `readMap`（ADR 0028）

- 被审对象：SA3 W2 实现（**iteration 1**——F-369-1 返工轮）——worktree
  `/home/wangjian/nomicore-fix-issue-369`，branch `mabf/issue-369`，对 HEAD `ab6e390` 的
  工作区 diff（22 个 tracked 修改 + 5 个新代码/测试文件 + 证据日志与 wiki 产物）。
- 审查轮次：**iteration 1**（iteration 0 已 reject，唯一 MAJOR = F-369-1；本轮复核
  SA3 返工：S6 ✂ 事实行 pathText 快照化 + T8/T9 敌意 path 回归用例 + 其余面回归）。
- 审查方式：静态审查——逐文件读 diff 与新实现/测试全文；`normalizeReadPath` 与
  HEAD 逐字节对照（git diff 实读）；T8/T9 装置语义逐跳推演（Proxy get trap 计数 ×
  W1 材料化读 × 组合层单快照读）；证据日志（`artifacts/sa3-issue369-f369-1-*.log`）
  实读。未运行任何测试/服务/进程（SA4 纪律）。

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-369.md`（Host brief） | 在场 | What-to-build + AC1–AC6；评论数 0（本轮 dispatch 复述 REST 实读为空——无 owner 条款需映射） |
| `wiki/raw/task_issue-369_design.md`（SA1 冻结设计，F-1 修订版） | 在场 | §7.1 B-1–B-11、§7.2 B-6（规则 2 含「敌意 path → 两锚皆不可解析 → schema:null」）、§7.3 S1–S6（S5/S6 明文「pathText …取自 …normalizeReadPath 快照」）、§7.4 计数、§8.2、§9、§11 ALLOW/DENY、§12 验收、§13 R3/R4 |
| `wiki/raw/task_issue-369_sa2_review.md`（approve） | 在场 | F-1 呈现安全验收标准、N-1–N-6 |
| `wiki/raw/task_issue-369_sa6_contract.md`（approve 附冻结条件） | 在场 | §12.1–§12.8 用例/绑定/防线 |
| `wiki/raw/task_issue-369_design_conflict_report.md`（SA8，clear） | 在场 | RA-1–RA-5 实现期义务 |
| `wiki/raw/task_issue-369_sa3_impl.md`（iteration 1 报告） | 在场 | 变更清单（iteration 1 增量 = 3 个 ALLOW 路径）、偏差申报（`normalizeReadPath` 导出请求复核）、验证日志索引 |
| 本文件 iteration 0 版（reject / F-369-1） | 在场（本轮被原位替换） | 返工输入：§4 五跳可达性 + §10 Required change/Acceptance + §11 三型矩阵 |
| ADR 0028/0027/0024/0016/0008、`CONTEXT.md`、`packages/{doc-runtime,namespace-runtime,namespace-registry,ws-replication}/AGENTS.md`、`docs/AGENTS.md` | 已读 | 规范权威与包边界（读不进 sequencer；公共 API 仅经 `src/index.ts`） |
| 修复实现：`window-read.ts`（742 行全文）、`read-schema-projection.ts`（255 行全文 + git diff 对 HEAD）、`runtime.ts`/两包 `index.ts`/`types.ts`/`lease.ts` diff | 已读 | 本审主体 |
| 修复测试：lease-contract-red（890 行全文，含 T8/T9 + `hostilePathProxy`/`w1IterationReads`/`captureArrayRead` 装置）、composition-red（17 用例清单核对）、fixture、lease-surface.test-d + 8 个守卫/替身 diff | 已读 | 测试质量与触发 |
| `artifacts/sa3-issue369-f369-1-{red,red-tests-green,contract-green,affected-packages,typecheck-tree,typecheck-packages,typecheck-tests,docs-shape-gates}.log` | 实读 | 红绿与回归证据（红 = T8 裸抛逃逸逐字复现；绿 = 50/50 契约、四包 196 文件/2210 用例、typecheck 树/包/CI 等价全过、门 59 绿） |

## 2. Verdict

**approve** —— iteration 0 唯一阻断项 **F-369-1（MAJOR）已按 Required change 修复且验收
标准逐项兑现**：

1. **快照使用正确**：`composeWindowRead` 在 S4 后做**单次**
   `const segments = normalizeReadPath(path)`（`window-read.ts` L170）；锚链
   （`anchorSchemaBody(state, segments, …)`）与 ✂ 事实行（`windowFactsBlock(segments, …)`
   → `windowPathText(segments)`）**只消费该已验证快照**，类型收窄
   `readonly (string | number)[]`——`String(seg)` 对已校验原始值段全域收敛，组合层
   S5/S6 **结构上不存在对 raw path 的第二次迭代/spread**（iteration 0 的
   `windowPathText(path)` 二次 spread 已删除）；快照缺席（null）⟺ 正文 null（诚实
   null，设计 §7.2 规则 2 + ADR-0027 null 单义），绝不用不可验证 raw path 造事实行。
2. **敌意 proxy-path 测试证明零外抛与事实准确**：T8（主型）以真数组 Proxy + 计数型
   get trap（`Symbol.iterator` 访问计数；参照系 `w1IterationReads` 由直调 W1 冻结面实测，
   行为锚定非实现耦合）在第 (W1+2) 次迭代协议读返回 throwing-`toString` 段——修复前
   **红**（`artifacts/…f369-1-red.log` 逐字 `Error: probe: hostile path segment
   （F-369-1 二次 spread 投毒）` 经 `captureArrayRead` 显式捕获为 escaped ≠ undefined
   ——原始症状真实复现，判别力非合成）；修复后**绿**：零外抛 + 恒四键 + `value` ≡ 直调
   W1 + `truncated:true` + ✂ 事实行 Byte 级 `endsWith('\n\n✂ 截断事实：\n- workRecords ·
   窗口 · 基 index asc · kept 2/total 3\n')`（描述**实际读取路径**）+ 恰一行事实行 +
   `probe.iterations() === w1Reads + 1`（单快照纪律行为面不变量）。T9（诚实 null 型）：
   第 (W1+1) 次迭代协议读即组合层快照的迭代器同一性检查 → 投毒迭代器 ≠
   `Array.prototype[Symbol.iterator]` → 快照收敛 null → 零外抛、`ok:true`、`schema:null`、
   值通道与 `truncated` 保持。iteration 0 §11 三型矩阵全覆盖（段 throwing-`toString` +
   双 spread 漂移 = T8；迭代器非标准/自定义 = T9）。
3. **其余 W2 实现与冻结契约/设计一致**：iteration 1 增量仅 3 个 ALLOW 路径
   （`window-read.ts`、`read-schema-projection.ts`（仅 `export` 关键字 + JSDoc，函数体
   逐字节不变——git diff 实读核对）、lease-contract 测试 +T8/T9）；runtime/lease/
   types/两 index/守卫/替身/ws-replication testing/两文档与 iteration 0 已审状态一致
   （diff 内容逐块复核，无弱化、无语义漂移）；readData 冻结面零触碰（共享前奏结构等价
   + 既有字节锚在 2210 用例回归中全绿）；DENY 面零 diff（doc-runtime/vfsl/CONTEXT/
   docs-adr/vitest.config 无条目）。

无需设计轮回流：修复兑现设计 §7.3 S5/S6 既定快照纪律，不新增公共 API/schema/失败
语义面（`requiresConflictRecheck: false`，沿 SA8 clear 结论）。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| Issue What-to-build：恒四键、条目列表身份随行、`truncated === kept < total` | `window-read.ts` L177–183（S6 恰四键字面量结算）；契约 A1–A4/T1–T4/T8 | ✅ |
| schema = 元素口径投影文本、路径键控与数据无关、空容器照常、包装不进口径 | `anchorSchemaBody`（B-6 锚链，**只由快照构造锚路径**）+ `projectSchemaTextBody`；契约 A3/A6/S1–S4 | ✅ |
| ✂ 窗口事实段 kept/total + 基与方向；total=0 无 ✂ | `windowFactsBlock`/`appendWindowFacts`（B-8 文法，**pathText 槽只消费快照**）；契约 T1–T9 | ✅（F-369-1 修复后四槽全部收编） |
| 组合式 depth 等价锚 | S2 直通 W1；契约 A5/E1/E2 | ✅ |
| 失败面直通 W1 三码 + `PATH_NOT_ALLOWED`；全部同步、响亮不抛 | `runtime.ts` readArray/readMap S2；契约 F1/F2/E4（`'value' in result === false`）；T8/T9 零外抛断言 | ✅ |
| registry lease 别名与透传 | `types.ts` 四别名、`lease.ts` 两方法 + 4 Equal 锁；契约 F3/F5/F6 + Y1 | ✅ |
| 作用域文档同步 + 分工句 | typed-access「Window reads」节、cordis-plugin-hosting「窗口读」节（含 `schema:null` 单义句、封闭对象容器口径、depth 计量披露、护栏 vs 选择器分工句、✂ 样张） | ✅（N-2/RA-2 兑现；文档事实行样张与实现一致） |
| Owner 评论 | 0 条（dispatch 明示 REST 实读为空） | ✅ 无遗漏 |
| SA2 F-1（敌意 field 行注入） | 基槽 `field:` + `foldSegment(field)`（L370）；T5/T6 保持绿（回归日志） | ✅ 不回归 |
| SA4 F-369-1（iteration 0 唯一 MAJOR） | 见 §2/§4 —— 快照化 + T8/T9 + 红绿证据 | ✅ **已修复并验收** |
| SA8 RA-1–RA-5 | RA-1 锚链原样（S4 oracle 锚 = 容器路径）；RA-2 文档披露；RA-3 出处标记 + 预言机矩阵；RA-4 冻结面零 diff；RA-5 Byte 冻结常量 | ✅ |

## 4. 设计落实审查（含 F-369-1 修复核验）

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| B-1/B-2 方法名 `(path, options)`、第二参必填 | runtime 接口两成员 + lease 两方法；Y1 签名/arity/负例 | ✅ | — |
| B-3 options 单源 type-only 别名 | `window-read.ts` L58–61；Y1 Equal 锁 ×4 | ✅ | — |
| B-4 结局面（成功四键 / W1 失败原样 / disabled / released） | S6 字面量；S2 原样透传；`readDisabled` 先行；lease RELEASED_ISSUE 先行 | ✅ | — |
| B-6 锚链（数组单锚；键面 `<key>`→容器；皆败 null，**含敌意 path**） | `anchorSchemaBody` L323–335——锚路径只由 `segments` 快照构造（`[...segments, 0]` / `[...segments, '<key>']` / `segments`）；敌意 path → `normalizeReadPath` null → 锚不尝试 → null | ✅ 与设计 §7.2 规则 2「敌意 path → schema:null」精确对齐（iteration 0 经锚内 normalize 间接达成，iteration 1 前置单快照后语义等价且外抛面归零） | — |
| B-7 D1 无头行正文 + ✂ 块拼装 | `projectSchemaTextBody` + `appendWindowFacts`（剥尾 `\n` + `\n\n` + 块 + 恰一 `\n`） | ✅ 与渲染器 `blocks.join('\n\n')+'\n'` 同规则 | — |
| B-8 四插值槽确定性渲染 + 单行不变式 | 槽②③④（field 折叠、dir 闭集、`String()` 整数）保持；**槽① pathText 现取 S5 单次 `normalizeReadPath` 快照**（`windowPathText(segments)` L388–391，入参类型 `readonly (string | number)[]`）——设计 §7.3 S6 快照要求逐字兑现；`String(seg)` 只见原始值段，结构上零 ToPrimitive 外抛 | ✅ **F-369-1 修复核验通过** | ~~F-369-1~~（已解决） |
| B-9 计数 = 组合层 O(N) 标识枚举、与 W1 空间逐位一致 | `countWindowCandidatesAtPath`（整体 try 收编）；预言机矩阵 9 例（composition-red S4/T7 回归绿） | ✅ | — |
| B-10 released/lifecycle/raw 透传 | lease 短路先行；S1 gate 零 options 读取；F5 引用同一性 + argc===2 | ✅ | — |
| B-11 键集 12→14 / 13→15、值导出面不变 | 四守卫 diff 纯加法（+2 行/文件）；index type-only；`runtime-acceptance-exports-audit` 绿 | ✅ | — |
| §7.3 S1→S6 顺序不可换 | runtime 方法体 S1/S2 → `composeWindowRead` S3→S4→**快照**→S5→S6 | ✅ | — |
| §7.3 S5/S6「pathText/锚共用 normalizeReadPath 快照、raw path 恰被消费一次」 | L166–170 单次调用 + L173/L180–181 双消费 + T8 `probe.iterations() === w1Reads + 1` 行为锚 | ✅ **兑现**（iteration 0 偏离已消除） | — |
| §7.3 S3 canonical 接缝（双出口、重派发一次） | `canonicalWindowBudget`/`canonicalOrderBy`（整体双 try 收编；判据逐条镜像 W1） | ✅ | — |
| §7.4 计数镜像纪律（出处标记 + 防御位坍缩） | 镜像头注释 `copied from …`；`countingDefectFailure`（`safePathCopy` 守卫式回显） | ✅ | — |
| readData 零触碰 | `resolveSchemaBody` 共享前奏（iteration 0 已审，等价抽取）；**iteration 1 对 `normalizeReadPath` 仅加 `export` + JSDoc——git diff 对 HEAD 实读核对，函数体零改动**；readData 字节锚测试全绿（2210 用例内） | ✅ | — |
| §9 失败面「全部同步、响亮不抛」 | 敌意 path 通道外抛洞关闭（T8/T9）；残余通道复核见 §8 | ✅ | — |
| §8.2「敌意输入零 throw；InternalError 为可信域唯一逃逸（与 readData 同纯度）」 | `projectSchemaTextBody` 零 try/catch（可信域直通）；敌意输入全部先经守卫（normalizeReadPath/E100/各 try） | ✅ | — |
| 文档面（§11 两文件） | 见 §3；docs 同步门 + 收敛门绿（59 tests） | ✅ | — |

### F-369-1 修复详证（iteration 1 核验，替代 iteration 0 §4 详证）

- **快照源守卫强度实读**：`normalizeReadPath`（read-schema-projection.ts L237–255）——
  全函数体 try/catch；`Array.isArray` 守卫；`path[Symbol.iterator]` **同一性比较**（不
  调用迭代器——敌意迭代器函数从头到尾不被调用，投毒迭代器在此被捕 → null）；`length`
  整型检查；逐段 `typeof string|number` 域检查；产普通数组副本。任何敌意 trap/异态 →
  null，**结构上零外抛**。与 HEAD 逐字节一致（仅导出 + JSDoc）——readData 头行同源
  纪律未被复制成第二份守卫（单一事实源保持）。
- **组合层 raw path 全触点清单（修复后）**：① S2 W1（E100 全收编，doc-runtime 零 diff）；
  ② S3 失败重派发 = 再入 W1（同 E100）；接缝失败回显 = `safePathCopy`（`Array.isArray`
  守卫 + try/catch spread → 坍缩 `[]`）；③ S4 计数镜像 navigate（仅索引读，整体 try）；
  防御位回显同 `safePathCopy`；④ **S5/S6 单次 `normalizeReadPath`（唯一迭代协议触点）**；
  ⑤ S1 `readDisabled` → `echoReadPath`（守卫式 spread，与 readData 共享先例）。全部通道
  对敌意 path 收敛为结果联合成员或诚实 null——§9「响亮不抛」兑现。
- **T8 判别力推演**：投毒仅在超预算的 `Symbol.iterator` 读返回——唯一可达投毒段的路径
  是对 raw path 的**第二次迭代协议消费**（iteration 0 的 S6 二次 spread）。修复后组合层
  迭代协议读恰一次（快照同一性检查，且不调用返回值）→ 投毒迭代器永不触达；`iterations()
  === w1Reads + 1` 同时是回归哨兵（任何未来再引入的 raw path spread 必使计数 +1 并触发
  投毒 → 红）。参照系 `w1IterationReads` 以直调 W1 实测（零投毒纯计数 Proxy），不依赖
  组合层自身计数——测试是行为面断言，不与实现细节耦合。
- **事实准确性**：pathText 与锚链共用同一快照（同一视图），T8 断言事实行 Byte 级描述
  实际读取路径（`workRecords`）且 kept 2/total 3 与值通道/预言机一致；快照缺席时绝不
  造行（T9 `schema:null`）。iteration 0 O-2（spread #2 呈现漂移面）随之消除。

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 载体选窗原语 | doc-runtime | W1 零 diff（S2 只消费 raw） | ✅ |
| 组合（锚链/计数/✂/四键） | namespace-runtime | `window-read.ts` + runtime 闭包 | ✅ |
| lease 面与别名 | namespace-registry | types/lease/index + Equal 锁 | ✅ |
| 敌意 path 规范化守卫 | readData 既有单源 `normalizeReadPath` | **导出复用（非复制）**——窗口组合层与 readData 头行同源同纪律 | ✅（见 §6 偏差 1 复核） |
| 行注入防御 | 呈现层装配点 | field 槽 + pathText 槽（后者入参恒为已验证原始值段） | ✅ |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| canonical 接缝 | readData `canonicalReadOptions`（#336） | `canonicalWindowBudget` 判据镜像 W1 权威 + 双出口同构 | 一致 | W1 是窗口 options 单权威 |
| 敌意 path 快照消费 | readData 头行 `headLine(shared.normalized,…)` | 窗口 pathText/锚链消费同一 `normalizeReadPath` 产物 | **一致（修复后收敛）** | F-369-1 的根因正是偏离此先例 |
| lease 读透传 | `leaseReadData` released 短路 | 同款两方法 + 4 Equal 锁 | 一致 | B-5/B-10 |
| 投影正文 | `projectReadDataSchema` 前奏 | `resolveSchemaBody` 单点共享、字节等价 | 一致 | readData 快照测试锚定 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 敌意 path 守卫 | `normalizeReadPath`（read-schema-projection 单点） | 窗口快照 = 同函数同次调用产物 | 低（导出复用，零复制） |
| options/失败类型 | doc-runtime | type-only 别名 + Equal 锁 | 低 |
| 候选条目空间 | W1 枚举纪律 | 镜像计数（出处标记 + 预言机矩阵） | 中（R2 既定、防线在场） |
| schema 文本 | vfsl 渲染器 | 组合层追加 ✂ 窗口块 | 低 |

### 生命周期对称性

纯读、零订阅/缓存/后台/sequencer——无新增 acquire/release；失败可直接重试。✅

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二份敌意 path 守卫 | `normalizeReadPath` | 导出复用（**未**复制第二实现） | 非重复（修复方案正确取舍） |
| 第二截断事实载体 / 第二 options 校验 / 第二计数事实源 | — | ✂ 仅文本一载体；canonical 只净化；计数镜像 R2 登记 | 非重复 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| runtime `window-read.ts`（新） | 有 | 组合层主体（**iteration 1：S5/S6 单快照修正**） | ✅ |
| runtime `read-schema-projection.ts` | 有（§11「抽取并导出 `projectSchemaTextBody`」） | 共享前奏 + **`normalizeReadPath` 模块级导出**（iteration 1 增量；见下「偏差 1 复核」） | ✅ 可接受（申报偏差，最小必要） |
| runtime `runtime.ts` / `index.ts` | 有 | 接口+闭包/14 键/type-only 四别名 | ✅ |
| registry `types.ts`/`lease.ts`/`index.ts` | 有 | lease 两方法 + 四别名 + Equal 锁 | ✅ |
| 三个新契约测试 + fixture + test-d | 有（§12.8 路径逐字） | W2-A/S/T/E/F + Y1（**iteration 1：+T8/T9 敌意 path 用例与装置**） | ✅ |
| 四个键集守卫 + 两个接口 test-d + registry-open | 有（B-11/§10） | 12→14、13→15、类型面 +2（纯加法，diff 与 iteration 0 已审一致） | ✅ |
| `packages/ws-replication/src/testing.ts` | 无（申报偏差，iteration 0 已复核） | `decorateLease` +2 bind（本轮 diff 复核：纯委托） | ✅ 必要/最小/语义惰性 |
| 7 个 registry 测试替身 | 无（申报偏差，iteration 0 已复核） | `implements NamespaceRuntime` 补两成员（恒 `PATH_NOT_ALLOWED`） | ✅ 同上 |
| `typed-access.md` / `cordis-plugin-hosting.md` | 有（§11 文档面） | 窗口读消费段 + 分工句 + R1 披露 | ✅ |
| `artifacts/sa3-issue369-*.log`、`wiki/raw/*` | 诊断/固定报告 | 证据 | ✅ |
| DENY 面（doc-runtime/vfsl/CONTEXT/docs-adr/vitest.config/readData 行为） | — | `git status` 零条目；readData 行为与字节不变（导出-only 改动 + 回归绿） | ✅ 零触碰 |

**偏差 1 复核（SA3 请求项）——`normalizeReadPath` 由模块私有转为模块级导出**：
**必要**（设计 §7.3 S6 明文要求 pathText 取自该守卫快照；复制守卫 = 第二事实源/平行
机制，移动文件 = 更大扰动；导出是唯一不复制知识的路径）；**最小**（仅 `export` 关键字
+ JSDoc，函数体对 HEAD 逐字节不变）；**合规**（包内模块间导出，不经 `src/index.ts`——
公共 API 纪律保持；runtime index.ts 实查零再导出；唯一包内消费方 `window-read.ts`，
与既有 `projectReadDataSchema` 跨模块 import 同款先例；无包外引用——全仓 grep 实查）。
判定：接受，登记为观察项 O-7（ALLOW 条目措辞未点名，属 SA1 枚举粒度问题，同 O-4 类）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `NamespaceRuntime` 12→14 | registry 装配/internal seam/全部测试替身 | 替身补成员；生产装配走真实 runtime | 低 | — |
| `NamespaceLease` 13→15 | Host/DSH 工具、ws-replication `decorateLease` | 纯加法；bind 补齐 | 低 | — |
| readData 既有调用方 | 全部 | 字节不变（导出-only + 共享前奏等价；1642/1690 级字节锚在 2210 回归中绿） | 低 | — |
| W1 既有契约（#368） | 组合层 | doc-runtime 零 diff；F1/E4 与直调 W1 `toStrictEqual` | 低 | — |
| 值导出面/类型消费方 | exports-audit/3 个 test-d | type-only 不可见；audit 绿 | 低 | — |
| ✂ 窗口文本消费方 | 按行解析 ✂ 段的下游 | 四槽全部确定性渲染 + 单行不变式（T5/T6/T8）；敌意 path 下零 throw（消费方收到结果联合或诚实 null，不再收到裸异常） | 低 | — |
| `normalizeReadPath` 模块级导出 | 仅 `window-read.ts`（包内） | 单消费方、零公共面暴露 | 低 | O-7 |

## 8. 错误、恢复与并发

- **F-369-1 修复后的敌意面全景**（逐通道复核，静态推演逐跳核验）：path 通道——W1 E100
  收编 / 计数镜像 try 收编 / 快照守卫 null 收敛 / 失败回显 `safePathCopy` 守卫 / S1
  `echoReadPath` 守卫；options 通道——canonical 双 try + 重派发出口；field 通道——
  呈现层折叠（`String` 于已判 `typeof === 'string'` 值）；全部收敛为响亮结果联合或诚实
  null。✅
- **可信域唯一逃逸**：`projectSchemaTextBody` 零 try/catch——畸形 derived/投影的
  `InternalError` 直通（D4 纪律，与 readData 同纯度；生产不可达——`activeTools.derived`
  恒为 compile ok 产物）。✅ 与设计 §8.2 声明一致。
- W1 失败原样透传/无半窗 ✅（E4）；接缝双出口 ✅；计数防御位 ✅（W1 N0 先拒非 Y.Map
  ROOT → 结构性不可达）；锚败 null 非失败 ✅（T7 sparse / T9 快照不可验证——两类
  `schema:null × truncated:true` 均设计 §13 R4 既定）；released/disabled 先行 ✅；
  同快照一致性（同步调用栈、零 sequencer）✅；幂等（S3 两次调用 `toStrictEqual`）✅。
- **残余（设计登记、不增设机制）**：① §13 R3 canonical 双读漂移（options 通道）——
  设计明文接受；② 状态化 path 的**索引读漂移**（W1 导航读与快照读之间各自一致的
  plain-string 段视图可不同）——R3 同类呈现残余：快照单一且经域校验（无外抛、无
  投毒面），pathText 忠实描述快照视图；设计 §7.3 S5/S6 只要求「取自 normalizeReadPath
  快照」，已精确兑现。均不构成阻断。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| composition-red（17 用例，iteration 1 零改动） | 能力存在性；S1 零 options 触达；S3 三出口；S4 预言机 9 例矩阵；S5 锚链 oracle + 数据无关性；E3/E4 哨兵；readData/W1 负控 | `packages/*/test/**/*.test.ts`（contract-green log 实跑 2 文件/50 用例） | 无 skip/only；零源码文本断言 | — |
| lease-contract-red（33 用例 = iteration 0 31 + **T8/T9**） | W2-A1–A6 / S1–S4 / **T1–T9**（T8：零外抛 + 四键 + 值≡直调 W1 + Byte 级事实行描述实读路径 + 恰一行 + 迭代协议读恰 W1+1；T9：零外抛 + 诚实 null + 值/truncated 保持）/ E1–E4 / F1–F6 / NC1/NC4 | 同上 | **敌意 path 面已覆盖**（iteration 0 缺口闭合）；T8/T9 仅数组面（map 面共用同一 `composeWindowRead` 骨架与快照代码——结构覆盖，见 O-8） | — |
| lease-surface.test-d | options 单源 Equal ×4、恰四键、结果别名 Equal ×2、签名/arity、负例 ×5 | `--typecheck.only`（231 用例，Type Errors: no errors） | 无 | — |
| 键集守卫 ×4 + 接口 test-d ×2 | 14/15 键纯加法、既有键全保留；类型面正/负例 | 既有入口（affected-packages 2210 绿） | 无 | — |
| 收敛门 + docs 门 | family A/B；文档旧词汇扫描 | 59 tests 绿 | 无 | — |
| CI 触发 | 磁盘枚举分片 + `pnpm typecheck` + `--typecheck.only` | `.github/workflows/ci.yml`（iteration 0 已核；新用例在既有文件内，触发面不变） | 无 | — |

红灯真实性（iteration 1）：`f369-1-red.log`——修复前 T8 **红**，失败断言即
`escaped ≠ undefined` 且 escaped 为投毒 `Error`（F-369-1 原始症状逐字复现：裸异常逃出
lease 公共面）；同场 T9 绿（该型非外抛面，作 no-throw 守卫）、负控绿。修复后
`f369-1-red-tests-green.log` T8/T9 双绿；`f369-1-contract-green.log` 50/50 零回归。
测试对修复的敏感性经真实红绿对证明，非合成断言。

## 10. Required revisions

（无——iteration 0 唯一阻断项 F-369-1 已修复并验收：

| Finding ID | Severity | Status | Evidence |
|---|---|---|---|
| F-369-1 | MAJOR（iteration 0） | **已解决** | §2/§4：S6 pathText 快照化（`window-read.ts` L166–183, L320–398）+ `normalizeReadPath` 导出复用（函数体零改动）+ T8/T9（红→绿证据 `artifacts/sa3-issue369-f369-1-*.log`）；SA4 §10 Acceptance 三条（不抛断言 / 既有用例零回归 / 快照语义兑现）逐项满足 |

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 根 `pnpm test` 全量（388+ 文件含 `--typecheck`；SA3 按 skill 边界未跑） | SA7/Controller | 全绿、`Type Errors: no errors` | 任一既有套件回归 |
| `{}` 预算 ≡ 无预算渲染逐字节（canonical 空轴走 budgeted 分支；SA3 探针已断言，iteration 0 转动态项） | SA7 | `readData(锚, {})` 与 `readData(锚)` schema 正文逐字节相同（头行预算段除外） | 两分支渲染漂移 |
| 敌意 path readMap 面变体（T8/T9 同装置换 `readMap` + 键面锚链；静态结论 = 共用骨架已覆盖，动态复核廉价） | SA7（可选） | 同 T8/T9：零外抛、事实行/诚实 null 正确 | 任一裸抛 |
| Node 20/24 × 6 分片 CI（新用例在既有文件内自动入片） | CI | 全绿 | 分片环境差异 |

## 12. Non-blocking observations

| ID | Observation |
|---|---|
| O-1 | （沿 iteration 0，未变）键面容器回退锚未按 schema 形状收窄：设计 §7.2 规则 2 的事实前提与 resolver 实际行为不一致（容器锚在数组声明路径上可解析）。仅 raw 数据偏离 active schema 可达，后果为呈现失真无崩溃。建议 SA1 澄清回退是否应 map 形收窄，SA3 对齐并补 off-schema 异形用例。 |
| O-2 | ~~F-369-1 的呈现漂移面~~ **已随修复消除**（pathText 与锚链共用同一快照，二次 raw 读消失；T8 第⑤⑥断言锚定）。保留编号仅作返工映射。 |
| O-3 | （沿 iteration 0，未变）fixture 的跨包测试树依赖是新形态（runtime 契约测试 import registry 测试树 fixture；fixture 相对路径 import runtime src）。建议后续经包 testing 面暴露 seam 构造入口或对偶复制（卫生项）。 |
| O-4 | （沿 iteration 0，未变）SA1 设计 §11 ALLOW 列表未枚举 8 个被接口扩张编译强迫的消费方替身文件。后续设计票应以规则条款覆盖「接口 +N 键的替身同步面」。 |
| O-5 | （沿 iteration 0，更新）`countWindowCandidatesAtPath` 模块级导出但包外无消费——保持非 index 导出即合规；`normalizeReadPath` 同为模块级导出但已有包内消费方（window-read.ts），见 O-7。 |
| O-6 | （沿 iteration 0，未变）T5 单看判别力弱、T6 构成强判别——组合充分。 |
| O-7 | `normalizeReadPath` 模块级导出系 F-369-1 修复的最小实现路径（避免复制守卫/第二事实源），函数体对 HEAD 零改动、不经 `src/index.ts`、包外零引用——复核通过；但设计 §11 对该文件的 ALLOW 措辞（「抽取并导出 `projectSchemaTextBody`」）未点名本导出，属 SA1 枚举粒度缺口（与 O-4 同类）。后续设计票建议把「包内模块级导出（不经 index）」以规则条款预先覆盖。 |
| O-8 | T8/T9 敌意 path 用例仅走 `readArray` 面；`readMap` 与之共用 `composeWindowRead` 同一快照与装配代码（面特异部分——键面两级锚链——不触 raw path），静态结论已覆盖；动态变体列入 §11 可选项。另：T8 的计数断言只计 `Symbol.iterator` 读（投毒唯一投递面）；索引读视图漂移属 R3 类残余（§8），不在该断言职责内。 |
| O-9 | 证据日志卫生：`f369-1-typecheck-tree.log` 为 0 字节、`f369-1-typecheck-packages.log` 仅命令横幅——`tsc --noEmit` 成功的常态签名，但无 exit code 标记；本轮以 CI 等价 `--typecheck.only`「Type Errors: no errors」（231 用例）+ 四包运行期回归交叉佐证采信。建议 SA3 后续日志附 `echo exit=$?` 尾行。 |

---

**结论**：**approve**。iteration 0 唯一阻断项 F-369-1（MAJOR）已按 Required change 修复：
S5/S6 共用单次 `normalizeReadPath` 已验证快照（锚链与 ✂ 事实行 pathText 同源、绝不二次
spread）、快照缺席诚实 `schema:null`、组合层对敌意 path 全通道收编（零外抛）；T8/T9 以
真实红绿对证明判别力（修复前投毒异常逐字逃逸 → 修复后零外抛 + Byte 级准确事实行 +
迭代协议读恰 W1+1）；其余 W2 实现、测试、范围、文档与冻结设计一致，readData 冻结面与
DENY 面零触碰，四包 2210 用例 + 类型面 + 两道门零回归。9 项 Non-blocking observations
（O-2 已解决保留编号；新增 O-7/O-8/O-9）。无新 ADR 冲突风险
（`requiresConflictRecheck: false`——修复系设计 §7.3 S5/S6 既定快照纪律的兑现，不新增
公共 API/schema/失败语义面）。
