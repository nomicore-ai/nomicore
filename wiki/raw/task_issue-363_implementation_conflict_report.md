# SA8 冲突报告 — issue #363（实现复查：投影文本渲染器 diff，**iteration 2 / I7 修复后复核**）

- Reviewed subject: **implementation**（被审对象 = 当前工作树实现 diff：
  `packages/vfsl/src/index.ts`（+6 行）+ 新文件 `packages/vfsl/src/render-projection-text.ts`
  （1002 行 = iteration 0 首版 999 行 + I7 修复 3 行）+ 新测试四件
  `packages/vfsl/test/render-projection-text{.test,-control,-fixture,.test-d}.ts`）
- 本轮性质：iteration 1 报告（verdict **reject**，唯一 hard-conflict = I7）的**修复后闭合复核**
  ——按该报告 §7 行 1–3（修复实现 / 补 twin 覆盖 / 复核 frozen surfaces）与 §9
  `requiresConflictRecheck: true` 义务执行；本版原位更新，只反映当前被审对象
- 审查基准：ADR 全集（26 篇文件在场、全部 accepted、无 superseded）+ `CONTEXT.md` +
  `docs/vfsl/v1-spec.md` + `packages/vfsl/AGENTS.md` + 根 `AGENTS.md` + 已批准设计
  `wiki/raw/task_issue-363_design.md`（iteration 2，SA2 approve）
- 诊断 HEAD：`12674544d2f24eb7d47c47ca4613b894043711d4`（= SA6 / SA1 / SA2 / SA3 /
  前置门禁与 iteration 1 登记值，本次 `git rev-parse HEAD` 复核一致；`git status` = 1
  modified（index.ts）+ 4 新包文件 + `wiki/raw/*363*` 任务产物，**无其他改动**）
- Issue REST comments snapshot：**空**（dispatch 明示）——无 owner 要求、无 comment ID、
  **无任何合法 override 来源**

## 1. Inputs and decision set

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-363_design.md`（iteration 2） | 在场（SA2 approve） | 规范性设计：§7.4 点 1/2（位标/页脚配对 + `countOccurrences('‡') === (m===0?0:m+1)` 计数不变量，L415–429）、§11 ALLOW/DENY（L576–605）、§12 验收、附录 A.2（`[]` d1，m=11 → `‡` 计 12） |
| `wiki/raw/task_issue-363_sa2_review.md`（iteration 2） | 在场（approve，无 Required revisions） | R4/R5/O1–O8 落实基线 |
| `wiki/raw/task_issue-363_sa3_impl.md`（iteration 1 返工版） | 在场 | I7 修复自述 + 红先记录 + 门禁复跑 + 86 金标零漂移声明 |
| `wiki/raw/task_issue-363_sa6_contract.md` | 在场（approve） | §12.4 CT-3 计数不变量/页脚恰 1 行/m=0 负断言（L296–306） |
| 前置门禁 `task_issue-363_relevant_decisions.md` / `task_issue-363_conflict_report.md`（clear）+ iteration 1 实现复查（reject，I7） | 在场 | D1–D18 决议、frozen surfaces、I1–I14 裁决基线与 §7 返工指令 |
| SA4 / SA9 产物 | 缺席（尚未产出） | —（非阻塞：SA8 以设计 + 决策文本 + diff + 独立探针直接对照） |
| ADR 0027（+ 0016/0024#359/0003/0019/0020/0021 语义面） | 在场（accepted） | 直接决策依据；决策 3「被截位以 `‡` 标记（**页脚一行解释**）…如实 `[...]‡`」（ADR 0027 L37） |
| `CONTEXT.md` 词汇 | 在场 | 语义 schema 投影 / 投影文本 / 截断事实段 / 标记类型 / 挂载锚位 |
| 源码/fixture/证据实读 + **SA8 独立只读探针** | 本次 | `render-projection-text.ts` 全文（计数点逐一枚举）、`index.ts` diff、`needsExpansion`/`unwrapKind`（标记恒不展开）、fixture twin 构造器 + 86 金标全量、runtime 测试 G3.6/G3.7a–d + `countMarkers`；SA3 证据日志实读（`/tmp/sa3-363-evidence/red-i7-regression.log` 等）；**SA8 探针 `/tmp/sa8-363-probe2.ts`**（冻结 resolver 真实产物 `['opt']` d0/d1、四宿主位 twin、深链、混合计数、86 格计数不变量 + 逐字节重渲染比对）——全部通过（见 I7 行） |

## 2. Decision analysis

| # | Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | ADR 0027 决策 2 + 验收缝 1；`packages/vfsl/AGENTS.md`「公共 API 只经 `src/index.ts`」 | 渲染器经公共入口导出 | `index.ts` 纯 +6 行（注释锚 + `export { renderProjectionText }` + `export type { ProjectionTruncation }`）；实现文件恰导出 2 名；既有导出零改动（控制组 `FROZEN_EXPORTS` 20 名超集断言在场） | **implements-existing-decision** | `git diff packages/vfsl/src/index.ts`；control test L30–52；grep `^export` = 恰 2 处 | 无 |
| I2 | ADR 0027 决策 2 | 零选项、同步、纯函数、逐字节确定 | 两参签名；零模块级可变状态、零 memo、零 I/O；每调用全新局部状态；I7 修复（+3 行）只增计数不改任何输出构造路径 | **implements-existing-decision** | render-projection-text.ts L135–138、L60–80、L878–932 | 无 |
| I3 | ADR 0027 决策 2（头行归缝 2 组合层） | 渲染器不产出头行 | 全文无 `# readData [` 产出行 | **no-conflict** | grep 0 命中；设计 §7.1.0 第 4 款 | 无 |
| I4 | ADR 0027 决策 3；v1-spec §2 | 标量域照源文法拼写 | `Pattern<JSON.stringify>`/裸 `Int`/`Int<min, max>`/`Range`/enum ` \| ` 声明序/`YXmlFragment`/`T[]`/`Record<string, T>`/`{}`；超 100 列（UTF-16）折行 | **implements-existing-decision** | L769–807、L677–706；金标 F6 家族 9 格逐字在场 | 无 |
| I5 | ADR 0027 决策 3 | 别名块 = 闭包发现序；未引用别名照样渲染 | `Object.keys(aliases)` 键序；`unreferencedAliasProjection` 断言在场 | **implements-existing-decision** | L144–150；fixture L540–553 | 无 |
| I6 | ADR 0027 决策 2/3；CONTEXT「投影文本」 | 口径恒 first-line + docs 文本防御 | 首条 + `…`、换行折叠、strip、` · ` 连接、全空省略；注释只落完整结构前缀后 | **implements-existing-decision** | L957–983；CT-4 敌意/良性孪生 + 金标 | 无 |
| **I7（本轮闭合）** | ADR 0027 决策 3「被截位以 `‡` 标记（**页脚一行解释**），容器线索无名时如实 `[...]‡`」（L37）；设计 §7.4 点 1/2（m>0 恒页脚 + `countOccurrences('‡') === (m===0?0:m+1)`；点 1 明文「根位 inline `[...]‡?`（optional 根）」）；SA6 §12.4 CT-3 | `‡` 位标与页脚配对、optional 包装 own-line 宿主位全计数 | **已修复**：`emitValue` optional 链解包后 `default` 分支补 `if (isSchemaTruncationMarker(inner)) ctx.section.markers += 1`（L504–506，注释显式锚定设计 §7.4 点 2 与 SA8 I7）。**计数全量性（SA8 逐一枚举）**：`markerText` 全文件恰 3 个调用点——①`emitValue` 顶部 L444（计数 L443）②`inlineText` 顶部 L717（计数 L715）③`inlineLeafText` case `'truncated'` L787，其唯一调用点 L507（计数 L506）与 L767（`inlineText` default——标记已被顶部 L714 截获，且 `validateNode` L215–219 保证凡 `kind:'truncated'` 必过 `isSchemaTruncationMarker`（= kind+clue 形状恰判，resolver L144–156），畸形者 fail loud）⟹ **无未计数旁路**；optional 包装在顶部检查上恒 false ⟹ **无双重计数**（混合 m=2 → `‡` 计 3，探针实测）。页脚聚合 L163–165（m>0 恰 1 行，位于全部别名块后、✂ 段前） | **implements-existing-decision**（iteration 1 hard-conflict 已按既有决策唯一确定的正确行为修复，零 redesign / 零 ADR 修订） | 修复：render-projection-text.ts L504–506；**独立复核（SA8 探针 `/tmp/sa8-363-probe2.ts`，全部通过）**：冻结 resolver 真实产物 `['opt']` d0 = `"[...]‡?\n\n‡ 截断标记：…\n"`（m=1、`‡` 计 2、首行 `[...]‡?`、页脚恰 1 行）——iteration 1 缺陷输入已恢复配对；`['plain']` d0 对照 2；`['opt']` d1 负控 0；四宿主位 twin（root/field/member/alias）各 m=1 → 2、markerless 负控 0；深链 `optional{optional{marker}}` m=1 → 2；混合 m=2 → 3（无双重计数）；**86 金标格逐格计数不变量 0 失败 + 逐字节重渲染 0 漂移**。**回归覆盖（SA8 实读）**：G3.7a（L362–373，冻结真实产物输入锚 `BUDGET_OPTIONAL_TWIN_PATHS.optional`，全文逐行断言 `['[...]‡?', '', FOOTER]`）、G3.7b（L375–392，手造 twin 四宿主位：位标拼写/m/`‡` 计/页脚恰 1 行/页脚居后）、G3.7c/d（L394–414，m=0 负控含 `?` 合成仍在）；`bare` 位对 `optional{marker}` 不可达已由源码证实（`needsExpansion` L824 对标记恒 false ⟹ 标记元素容器永不展开 ⟹ 不产生 bare 宿主调用），fixture L390–393 注释登记该边界。**红先敏感性（SA3 证据实读）**：`red-i7-regression.log` 中 G3.7a/b 恰在 `‡` 计数断言红（expected 2 / received 1）、负控 G3.7c/d 通过——红因即 I7 本身，非伪红；`green-i7-regression.log` 4 passed | 无 |
| I8 | ADR 0027 决策 3 + CONTEXT「截断事实段」 | ✂ 段：在场才出现、逐条 path/kind/omitted、文末块 | 头行/条目/输入序/空路径 `[]`/段内换行折叠/三态逐字节相同且无 `✂`、与 `‡` 共存序正文→页脚→✂ | **implements-existing-decision** | L62–63、L166、L991–999；CT-5 金标 | 无 |
| I9 | ADR 0027 决策 3 首条 + ADR 0024 #359 amendment 第 3/4 条；前置门禁 D15 | 可见性切片延续；docs 归位只按「投影表在场 + 位置已渲染」 | 归位四规则逐条落地（aliasDocs→别名头行含裸宿主行 R1、别名首段专属锚定、尾缀匹配字典序最小胜出、无宿主键静默丢弃 P1）；标记替换类型不替换位置 | **implements-existing-decision**（P1/P2/R1 为授权内文法粒度钉死，iteration 1 裁定维持） | L876–955；金标 `F2 [] d1`/`F1 ["assets","img1"]`/`F2 ["shallow","title"]` | 无 |
| I10 | ADR 0024 决策 3；ADR 0027 决策 2/缝 2 | truncations 第二参与 doc-runtime 条目结构兼容 | `ProjectionTruncation = { path; kind: 'depth'\|'width'; omitted }` 同构；vfsl 零运行时依赖 | **no-conflict** | L44–51；`packages/vfsl/package.json` 未改（git status）；test-d | 无 |
| I11 | CONTEXT「标记类型」；前置门禁 D15 P3 | `xml` 形态拼写 | `{kind:'xml'}` → `YXmlFragment` 裸名；金标逐字在场 | **implements-existing-decision** | L779–780（本轮行号 +3 后）；金标 `F1 ["assets","img1","body"]`/`F6 ["body"]` | 无 |
| I12 | ADR 0027 决策 2（返回 `string`，失败通道未规定 = D18）+ ADR 0016 trusted-domain 例外先例 + `packages/vfsl/AGENTS.md` 显式例外条款 + 设计 §7.5（SA2 approve） | 畸形 projection/truncations 失败语义 | 浅层形状守卫 + 全树游走守卫；全部 `throw InternalError`；单一类身份（`import` 自 `./resolve.js`，包内定义数 = 1）。**I7 修复未新增任何 throw 路径**；计数补丁位于已通过守卫的合法节点分支 | **no-conflict**（授权内通道裁定，iteration 1 裁定维持） | L29、L171–340；`resolve.ts` L26 唯一定义（本仓 grep 复核）；CT-9 八抽样 | 无 |
| I13 | ADR 0027 决策 2（输入含环合法投影）× 冻结 resolver 环防御 + 设计 §7.6/§7.1.3 | 环/optional 全位 total 渲染 | 栈语义重入 `…`；DAG 各自完整渲染；optional 链解包单 `?`、四宿主位附着；**I7 修复后 optional+标记合成（`[...]‡?`）与计数并存**（G3.7a/b 显式断言 `?` 不丢失） | **implements-existing-decision**（total 函数义务；`…` 记号与 R2 合成 iteration 1 裁定维持） | L441–511、L512–675；CT-8 9 格；金标 `F1 ["notes"]`/`F1 ["config"]` | 无 |
| I14 | ADR 0027 决策 1/4/5；前置门禁 D12/D13 | T1 纯加法、不触碰 readData/组合层/版本链 | DENY 面零触碰：`git status` 逐一核对（唯一 modified = index.ts +6；resolver/`resolve.ts`/`derived.ts`/`evaluate.ts`/`validate*.ts`/`namespace-runtime`/`doc-runtime`/`docs/**`/`CONTEXT.md`/v1-spec/tsconfig/vitest.config/版本号全未改）；fixture 改动为**加法段**（twin 构造器 + 头部清单一行，`RENDER_GOLDENS` 录制区零改动——86 键集与字节经探针重渲染逐格复核 0 漂移） | **no-conflict** | `git status --porcelain`；SA3 §3/§6；探针第 5 组 | 无 |

裁决分布：**implements-existing-decision × 10**（I1/I2/I4/I5/I6/**I7（已修复）**/I8/I9/I11/I13）、
**no-conflict × 4**（I3/I10/I12/I14）；**hard-conflict × 0、evolution-required × 0**。

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |
| —（无） | —（Issue comments 空；无新 ADR；无协议版本升级；无决策文本自允演进条款被援引） | — | — |

I7 修复未援引任何 override——正确行为（m>0 恒页脚、`‡` 计 = m+1）由 ADR 0027 决策 3 与设计
§7.4 点 2 原文唯一确定，修复是既有决策的兑现，无需决策演进。

## 4. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 核对） |
| --- | --- | --- | --- |
| `resolveSchemaAtPath` 语义/投影包装联合/`SchemaTruncationMarker` 形态 | 文件零改动 | ADR 0016 L52–73；ADR 0024 决策 5 | ✓ `resolve-schema-at-path.ts` 未改（git status）；`isSchemaTruncationMarker` L144–156 原样（探针经其真实产物复核） |
| vfsl 既有公共导出面 | 20 值导出在场（超集） | 前置门禁 §4；control test `FROZEN_EXPORTS` L30–52 | ✓ index.ts 仍纯 +6 行；20 名逐一在场 |
| doc-runtime 值通道 truncations 条目形状 | `{ path; kind; omitted }` | ADR 0024 决策 3 | ✓ 文件未改；渲染器结构同构零引用 |
| readData 公共面 / namespace-runtime | 本票零触碰 | ADR 0027 决策 1/4（缝 2 生效） | ✓ git status 无该包改动 |
| ValueSchema 冻结 11 kind + int both-or-neither | 渲染器只读消费 | ADR 0003 | ✓ 未扩展语义联合 |
| CONTEXT 词汇 / `docs/**` / v1-spec / ADR | 零改动 | ADR 0027 已写全词汇 | ✓ 未改 |
| wire / 持久化 / 诊断日志 / 复制面 | 全部不变 | ADR 0010/0013/0022/0011/0014 | ✓ 影响面不含任何上述文件 |
| `InternalError` 单一类身份 | 包内定义数 = 1，不经 index 导出 | ADR 0016 先例；设计 R5 | ✓ 全包恰 `resolve.ts` L26；渲染器 import 复用（本仓 grep 复核） |
| **86 金标快照 + 附录 A 样张（本票新增冻结面）** | 逐字节稳定；实现后不得漂移 | ADR 0027 决策 3「快照锚定」；设计 §12 CT-2 / §11 范围说明（86 格不变） | ✓ **SA8 探针独立复核**：86 格（键集 = `EXPECTED_CELL_KEYS`）逐格重渲染与 `RENDER_GOLDENS` 录制字节 0 漂移、计数不变量 0 失败；`F2 [] d1` 与设计附录 A.2 逐字一致（m=11 → `‡` 计 12）；fixture 改动为 twin 构造器加法段，录制区零触碰；SA3 `golden-verify.log` 同判 |

## 5. Evolution requirements

无。I7 修复是单一代码路径的计数补齐（+3 行），正确行为由既有决策唯一确定；G3.7 回归覆盖与
fixture twin 构造器均为设计 §11 ALLOW 行 3/行 6 文件内的加法（服务 SA6 §12.4 CT-3 强制验收，
86 金标矩阵集合不变——设计 §11 范围说明的钉死条件满足）。`bare` 宿主位不可达的覆盖边界以
源码证实（`needsExpansion` L824 标记恒 false）并登记于 fixture 注释，属文法粒度内事实陈述，
非决策面。设计 §15 登记的五类新裁决面维持 iteration 1 裁定（I1/I9/I11/I12/I13 行）：均为既有
决策的兑现或文法粒度内钉死，无一构成 evolution-required。

## 6. Hard conflicts

**无。** iteration 1 的唯一 hard-conflict（I7：optional 包装截断标记不计数 ⟹ twin 投影缺
`‡` 页脚）已修复并经三方独立证据闭合：①源码计数点全量枚举（3 个 `markerText` 调用点全部
计数、无旁路、无双重计数）；②红先回归 G3.7a–d（红因恰为缺陷签名，绿后 4 passed）；③SA8
独立探针在冻结 resolver 真实产物、四宿主位 twin、深链、混合形状与全部 86 金标格上复验
配对文法与计数不变量成立。

## 7. Required actions

1. **无阻塧行动**——I7 连同其回归覆盖义务（iteration 1 §7 行 1–3）全部闭合；本报告 §9
   的实现后核对义务随之闭合。
2. 非阻塞登记（承接 iteration 1 §7 行 4，无需行动）：设计 §7.2「实现指引」尾缀→最小键映射
   草图与规范规则文本在退化格上不同；实现取规范文本一侧，金标族无碰撞格，无契约影响。
3. 跨票台账不变（非本票义务）：缝 2（恒四键/头行/一致性锚/minor bump）、缝 3（文档词汇
   重录）、敌意 getter 边界（ADR 0027 决策 5；设计 §13 F1）。
4. 后续 SA 角色分工不受本报告影响：SA4/SA7 的实现质量与验收复核、SA7 对 G3.7 断言强度
   （含 `bare` 不可达证明的独立复核）仍按各自职责执行——该判断属 SA7 辖域，SA8 仅确认其
   不构成决策冲突。

## 8. Verdict

**clear** —— iteration 1 唯一的 hard-conflict（I7）已按既有决策唯一确定的行为修复
（`emitValue` optional 解包后 default 分支补计数，+3 行），marker/footer 配对文法
（ADR 0027 决策 3）与计数不变量（设计 §7.4 点 2 / SA6 §12.4）在冻结 resolver 真实产物、
四类可达 own-line 宿主位（root/field/member/alias；`bare` 经源码证实不可达并登记）、深链、
混合形状及全部 86 金标格上成立；回归覆盖 G3.7a–d 红先敏感、负控齐备；frozen surfaces
（含 86 金标快照冻结面）经 SA8 独立探针逐格复核零漂移、零重录；DENY 面零触碰；其余全部
对照项维持 no-conflict / implements-existing-decision。无 override、无 evolution-required、
无新决策面。

## 9. requiresConflictRecheck

**false** —— 设计 §15 登记的实现后核对义务（公共 API、快照冻结、P1/P3、`…` 记号 + §7.5
通道、R1/R2 五类新裁决面）已由 iteration 1 §2 裁定并经本次闭合复核；I7 修复引入的文法行为
变化（twin 投影恢复页脚）与新增回归覆盖均已按 frozen surfaces 表逐项核对实际 diff
（86 金标字节稳定、twin 断言在场、DENY 面零触碰），实现后复查已闭合。缝 2/缝 3 为独立
后续票的生效点，不构成本 diff 的待核对义务。
