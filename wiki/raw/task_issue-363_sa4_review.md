# SA4 实现静态审查 — issue #363（T1：投影文本渲染器）

- Dispatch：`sa-33a9659b-d693-4453-a71e-df8f12d406bf`（mabf-sa4 / implementation-review / iteration 0）
- 审查对象：当前工作树实现 diff（`packages/vfsl/src/index.ts` +6 行 + 新文件
  `packages/vfsl/src/render-projection-text.ts`（1002 行）+ 新测试四件
  `packages/vfsl/test/render-projection-text{.test,-control,-fixture,.test-d}.ts`）
- 基准 HEAD：`12674544d2f24eb7d47c47ca4613b894043711d4`（SA6/SA1/SA2/SA8 登记一致；本次复核未变）
- 审查方式：**纯静态**（不运行测试/不启动服务/不 curl/不建临时进程；只读 git/grep/实读源码与测试）
- Issue REST comments snapshot：**空**——无 owner 要求、无 comment ID、无逐字判据需核对
- 约束遵守：未修改任何既有文件；本文件为 SA4 唯一新建产物（skill 固定路径）

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-363.md`（Host brief） | 在场 | 票面 What-to-build + AC 6 条 |
| `wiki/raw/task_issue-363_sa6_contract.md`（approve） | 在场 | CT-1…CT-7、86 金标格、红因机制、§12.9 P1–P5、测试入口纪律 |
| `wiki/raw/task_issue-363_design.md`（iteration 2，SA2 approve） | 在场 | §7.0–§7.7 规范钉死、§11 ALLOW/DENY、§12/§12.1 验收、附录 A 样张 |
| `wiki/raw/task_issue-363_sa2_review.md`（iteration 2，approve） | 在场 | R1–R5/O1–O8 落实基线 |
| `wiki/raw/task_issue-363_sa3_impl.md`（iteration 1 返工版） | 在场 | I7 修复自述、红先记录、门禁结果 |
| `wiki/raw/task_issue-363_relevant_decisions.md` / `_conflict_report.md`（clear，D1–D18） | 在场 | frozen surfaces、包边界、复查路由 |
| `wiki/raw/task_issue-363_implementation_conflict_report.md`（**clear**，I7 闭合） | 在场 | 本次审查的实现门基线（SA8 iteration 2） |
| 实现与测试实读 | 本次 | 渲染器全文（1002 行逐段）、index diff、四测试件、`vitest.config.ts`、`tsconfig.typecheck.json`、`packages/vfsl/tsconfig.json`、`packages/vfsl/AGENTS.md`、既有 fixture 导出面 |
| git 只读核对 | 本次 | `git status --porcelain`（1 modified + 5 新包文件 + wiki 产物）、`git diff index.ts`、`git stash list`（空） |

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR。

静态审查结论：实现是已批准设计（iteration 2）与 SA6 契约的忠实落地。逐条攻击了
文法钉死（§7.1.0–§7.1.5）、docs 归位（§7.2）、`‡`/页脚/✂（§7.4，含 I7 修复的计数
全量性——三个 `markerText` 产生点逐一枚举无旁路无双重计数）、环/optional total 合成
（§7.1.3/§7.6）、trusted-domain 失败语义（§7.5）、纯度与确定性（§7.6/§9）、文件范围
（§11）与测试质量（SA6 §12.1–§12.8 + 设计 CT-8/CT-9）。86 金标格键集完整性、附录 A
样张与金标逐字节对照（A.1↔`F2 [] d9`、A.5↔`F1 ["config"]`/`["notes"]`、A.6↔
`F1 ["assets","img1"]`、A.7↔`F1 ["u","x"]`、A.4↔`F2 ["shallow","title"]`）均一致。
未发现静默失败、吞错、验收弱化、范围越界或契约连锁遗漏。遗留 5 项非阻塞观察（§12）。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| 票面 AC1：`renderProjectionText(projection, truncations?)` 经 index 导出、零选项、测试经动态接缝 | `index.ts` +6 行（1 值 + 1 类型导出，注释锚 ADR 0027 决策 2/3）；`render-projection-text.ts` L135–138 两参签名；红文件 L15 `import * as vfsl` + L66–72 `seamRenderer()` 动态属性读、非 function 时 loud 抛「能力缺口」文案 | ✓ |
| 票面 AC2：文法快照冻结（预算矩阵/M4/手造/无预算整读） | fixture `RENDER_GOLDENS` L222–309（86 格，录制区注释含 HEAD/日期/命令/人工核对清单 L211–220）；`EXPECTED_CELL_KEYS` L197–209 由路径集独立推导；G2.0 键集断言 + 86 it | ✓ |
| 票面 AC3：确定性（重复 + 交错逐字节相同） | G6.1/G6.2/G5.6/G8②③；实现零模块级可变状态（仅只读 const 集 L60–80）、字典序 tie-break L946–948 | ✓ |
| 票面 AC4：first-line 口径 + docs 敌意防御 | `firstLineText`/`foldText` L976–986（折叠→strip→≥2 追 `…`）；G4.1–G4.8 敌意/良性孪生（行数 + 首 ` // ` 前缀逐行同） | ✓ |
| 票面 AC5：`‡`/`[...]‡`/✂ 段；缺席或空无 ✂ | L60 页脚文案与设计 §7.4 逐字同；L994–1002 ✂ 段（含空路径 `[]` 拼写）；G3.1–G3.6/G5.1 三态等价 | ✓ |
| 票面 AC6：typecheck + 既有测试全绿 | SA3 §7：`tsc -p packages/vfsl` exit 0、根 `pnpm typecheck` exit 0、`pnpm test` 381 files / 4540 tests 0 failed（SA4 不复跑，静态核对测试入口真实性，见 §9） | ✓（运行证据采 SA3/SA8 记录；入口链静态复核为真） |
| SA6 CT-1…CT-7（§12.2–§12.8） | G1（4+5 类型面）/G2（96）/G3（10，含 I7 回归 G3.7a–d）/G4（8）/G5（6）/G6（3）+ 控制组 C1–C3（7）逐条在场，断言强度不低于契约 | ✓ |
| SA2 R4（环安全零变异观测） | 红文件 `auditProjection` L137–160 与设计 §12.1 算法逐字一致（节点身份 + 环安全摘要、禁 stringify）；G8 9 格执行 | ✓ |
| SA2 R5（InternalError 单一类身份） | 渲染器 L29 `import { InternalError } from './resolve.js'`；全包 `class InternalError` 定义数 = 1（`resolve.ts` L26，本次 grep 复核）；不经 index 导出 | ✓ |
| SA8 实现门 I7（optional 包装标记计数） | L504–506：`emitValue` optional 解包后 default 分支 `if (isSchemaTruncationMarker(inner)) ctx.section.markers += 1`（注释锚 SA8 I7）；G3.7a 冻结真实产物 `["opt"]` d0 全文逐行断言、G3.7b 四宿主位、G3.7c/d 负控；红先证据在 SA3 §7（expected 2 / received 1） | ✓ |
| SA8 门禁其余裁决（I1–I6、I8–I14） | 逐项静态复核维持：导出面纯加法、零选项、无头行、标量拼写、别名键序、✂ 段、P1/P2/R1 归位、P5 结构类型、P3 `YXmlFragment`（L782–783）、环/optional total、DENY 零触碰 | ✓ |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| §7.0 签名/`ProjectionTruncation`/联合入参/index 加法导出 | L44–51、L135–138、index diff（resolver 导出块后） | ✓ 结构同构 doc-runtime 条目（test-d G1.9 双向 `toMatchTypeOf` + 3 个 `@ts-expect-error` 反例） | — |
| §7.1.0 布局序（正文→别名块→页脚→✂；段间恰 1 空行；尾恰 1 `\n`；无头行） | L160–168 `blocks.join('\n\n') + '\n'`；L153–166 聚合序；G1.3/G1.4 反断言 | ✓ | — |
| §7.1.1 标量域拼写/`T[]`/`{}`/截断标记/环 `…` | `inlineLeafText` L772–791（`Pattern<JSON.stringify>`、`Int`/`Int<min, max>`、`Range`、`YXmlFragment`、ref 名直写）；`markerText` L799–801 | ✓ 与金标 F6 逐字一致 | — |
| §7.1.1 precedence 1（union/enum 元素数组恒展开） | `emitArray` L608–609 `unwrapKind==='enum' || needsExpansion(...)`（union 经 needsExpansion case 'union' 恒 true） | ✓ | — |
| §7.1.1 precedence 2 + §7.1.2 enum 折行（>100 UTF-16 / 非字段 optional 强制） | `emitEnum` L690–708（`forced`/`fold`）；`needsExpansion` L856 同判据 | ✓（宽度核算未计闭行定界符，见观察 O-B） | O-B |
| §7.1.2 对象恒块 / union 恒展开（判别式不渲染）/ Record 判定（恰一 `<key>`） | `emitObjectBlock` L515–551、`emitUnion` L636–678、`isRecordShape` L795–797 | ✓ 全文无 discriminator 读取（grep 证实） | — |
| §7.1.3 optional 合成（字段位吸收 + 四款附着 + 四宿主位 + 链解包单 `?`） | `inlinePrefix`/`inlineAttach`/`blockIndentOf` L374–424；解包 L452–471/`inlineText` L724–736；数组闭行 `[]?` L631、Record 闭行 `>?` L593、union 首成员行 L650–665 | ✓ 逐款核对（含金标 `F1 ["notes"]`=`string?`、`F1 ["config"]`=`{?` 块、G3.7 `[…]‡?`） | O-A |
| §7.1.4 裸宿主行承载注释（R1） | 裸字段/别名宿主行照常 `registerPosition`（L620–626、L647–648、L655–656）；金标 `inlPair: // 内联联合位`、`type AssetEntity = // 资产实体：封闭联合` 逐字节在场 | ✓ | — |
| §7.1.5 行尾注释（aliasDocs 前、docs 字典序、first-line、` · ` U+00B7、keyPattern 后缀、防御不变量） | `renderComment` L961–973（`c2 b7` 字节复核 = U+00B7）；`firstLineText`/`foldText` L976–986；keyPatterns 只挂对象开行（L538/L567/L588/L743） | ✓ | — |
| §7.2 docs 归位（规则 1–4：aliasDocs→别名头、别名首段专属锚定、正文尾缀匹配字典序最小、P1 静默丢弃；根位永不匹配） | `assignComments` L881–935 + `tailMatches` L937–944（`position.length > 0` 排除根位）；G4.5/G4.8 验证 P1 | ✓（位置序消费式实现 vs 设计「实现指引」尾缀映射草图——规范文本侧，SA8 已登记，见 O-C） | O-C |
| §7.3 P3 `xml` → `YXmlFragment` | L782–783；金标 `F1 ["assets","img1","body"]`/`F6 ["body"]` | ✓ | — |
| §7.4 `‡` 位标/页脚/计数不变量/✂ 段（含空路径 `[]`、输入序、段内折叠） | L163–165、L60、L994–1002；计数点 3 处（L442–443、L504–506、L714–715）逐一枚举：无未计数旁路（`validateNode` L215–219 保证 `kind:'truncated'` ⟺ `isSchemaTruncationMarker`；`inlineLeafText` 其余调用点不可达标记）、无双重计数（顶部检查对 optional 包装恒 false） | ✓ I7 修复正确且完备 | — |
| §7.5 畸形输入 `InternalError`（浅层 + 游走期清单，含 int both-or-neither） | L173–194（浅层：非对象/缺四键/三表非 plain/docs 值非 string[]）、L197–315（全树守卫：kind 封闭集、载荷、L272–283 int 半参）、L317–340（truncations）；无 try/catch 吞错（唯一 `try` L223 为 `finally` 栈清理） | ✓ | — |
| §7.6 环栈语义/`…`/DAG 各自完整/别名体自重入/纯度 | `ctx.stack` 每段局部 + add/delete 栈语义（L540–549、L590–592、L627–629、L667–677、L744–746、L751–753）；optional 链局部 `seen` 防；`needsExpansion`/`unwrapKind` 各自防环 | ✓ | — |
| §12.1 环安全审计（R4） | 测试 L137–160 逐字落地；G8 9 格 before/after 三段式断言 | ✓ | — |
| §12 CT-8/CT-9 强制验收 | G8（9 环格 × {无预算,d1,d9} 三构造器）、G9（8 抽样 + G9.1 可归因消息） | ✓ | — |
| 附录 A 样张 ↔ 金标 | A.1↔`F2 [] d9`（本次逐行渲染对照 40+ 行逐字一致）、A.2↔`F2 [] d1`（m=11→`‡` 12 次）、A.3↔G5 断言、A.4/A.5/A.6/A.7 ↔ 对应金标 | ✓ | — |

设计明确但实现缺失项：**无**。

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| 投影文法权威 | vfsl（ADR 0027 决策 2） | `packages/vfsl/src/render-projection-text.ts` | ✓ |
| 头行前贴 | readData 组合层（缝 2） | 渲染器全文无 `# readData [` 产出行（grep 0 命中；G1.3 反断言） | ✓ |
| truncations 事实源 | doc-runtime 值通道 | 结构类型同构只读（L44–51；vfsl 零运行时依赖未变） | ✓ |
| trusted-domain 失败通道 | `resolve.ts` 唯一类定义 | import 复用（L29）；包内定义数 = 1 | ✓ |
| resolver 语义/切片 | resolver（冻结面） | 未触碰（git status 唯一 modified = index.ts） | ✓ |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| schema→文本发射 | `vfsl-codegen/src/emitter.ts`（构建期 TS 类型文本） | 运行期投影→呈现文本 | 一致（非重复） | 输入/输出/消费方三轴皆异（设计 §10.1 已裁定） |
| trusted-domain 失败 | `resolve.ts` L26 + 4 处跨模块 import | 同一路线 import | 一致 | 包内惯例延伸（R5） |
| 测试内 import 内部模块 | 4 个既有测试 `from '../src/resolve.js'`（budget-control/member-docs/resolve-schema-at-path 等，本次 grep） | 红文件 L18 同路线（`toBeInstanceOf(InternalError)` 强断言） | 一致 | 既有先例；不扩公共面 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| 投影内容/截断事实/别名闭包序 | resolver ok 四件套 / truncations 第二参 / `aliases` 键序 | 渲染文本（纯函数） | 无 |
| InternalError 类身份 | `resolve.ts` L26（唯一） | 无第二定义 | 无 |
| 金标快照 | `RENDER_GOLDENS`（录制区隔离注释 L221/310） | 86 格断言 | 无（键集由 `EXPECTED_CELL_KEYS` 独立推导锚定） |

### 生命周期对称性

纯函数：无 acquire/release/后台任务/订阅；回滚 = 删 1 实现文件 + index 6 行 + 4 测试件。✓

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二 InternalError 类 | `resolve.ts` 唯一定义 | import 复用 | 已消除（R5 落实） |
| docs 归位/切片第二权威 | `sliceDocs`（resolver 切片，冻结） | 渲染侧归位（呈现） | 非重复（辖域切分：切片已冻结，渲染只消费投影内键） |
| 测试侧本地 `RenderTruncationEntry` | 未来公共 `ProjectionTruncation` | fixture L31–35 结构同形本地类型 | 非重复（保 HEAD 绿 + 红因归因；类型面由 test-d 锁公共名） |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `packages/vfsl/src/render-projection-text.ts`（新，1002 行） | §11 ALLOW 行 1 | 渲染器实现（I7 修复 L504–506 含于内） | ✓ |
| `packages/vfsl/src/index.ts`（+6 行） | §11 ALLOW 行 2（1 值 + 1 类型导出 + 注释锚） | 公共 API 只经 index（D1）；置于 resolver 导出块后 ✓；既有 20 导出零改动（控制组 C1 超集断言） | ✓（+6 = 2 导出行 + 4 注释锚行，注释锚系 ALLOW 单元格明示要求与仓内惯例，见 O-E） |
| `packages/vfsl/test/render-projection-text.test.ts`（新，733 行 / 144 it） | §11 ALLOW 行 3 | 运行时红契约（含 CT-8 审计助手为局部函数、G3.7a–d） | ✓ |
| `packages/vfsl/test/render-projection-text.test-d.ts`（新，66 行 / 5 it） | §11 ALLOW 行 4 | 类型面契约（静态 import + `@ts-expect-error`） | ✓ |
| `packages/vfsl/test/render-projection-text-control.test.ts`（新，169 行 / 7 it） | §11 ALLOW 行 5 | 恒绿控制组（不引用新名目） | ✓ |
| `packages/vfsl/test/render-projection-text-fixture.ts`（新，631 行） | §11 ALLOW 行 6 | 金标 + 手造 + truncations + 畸形抽样（+I7 twin 构造器为加法段；录制区 L221–310 未触碰） | ✓ |
| `wiki/raw/task_issue-363_sa4_review.md`（本文件） | skill 固定产物 | SA4 审查报告 | ✓ |

DENY 核对（git status --porcelain 逐一）：`resolve-schema-at-path.ts`/`resolve.ts`/`derived.ts`/
`evaluate.ts`/`validate*.ts`、既有 `packages/vfsl/test/**` 全部、`namespace-runtime`/`doc-runtime`、
`docs/**`/`CONTEXT.md`/v1-spec、`vitest.config.ts`/tsconfig、版本链——**零触碰**；
`git stash list` 空、无遗留探针文件（`zz-*` 计数 0）。ALLOW 中未修改路径：无（六行全部命中）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| index 加法导出（1 值 + 1 类型） | 既有 20 导出的全部消费方（namespace-runtime、doc-runtime、apps、既有测试） | 零改动（加法；C1 超集断言钉死） | 无 | — |
| resolver 调用方（T2 缝 2，本票不接线） | readData 组合层 | 台账挂缝 2 票（SA3 §8、SA8 §7 行 3）；「窄化 ok 后直传」类型面成立（ok 分支多余 `ok:true` 键对联合入参可赋值；运行时浅层守卫明示额外键容忍 L178–180 注释与设计 §7.5 一致） | 无（跨票） | — |
| doc-runtime truncations 生产方（T2） | 值通道 | 结构同构（G1.9 双向 `toMatchTypeOf`）；vfsl 零依赖不变 | 无 | — |
| 失败通道消费方 | 未来 T2 调用方 | 同步 throw、`error.name === 'InternalError'`、单一类身份（`toBeInstanceOf` 可用） | 无 | — |
| 类型面新公共名 `ProjectionTruncation` | 类型消费者 | 加法 `export type`；不与既有名冲突（grep 复核） | 无 | — |

## 8. 错误、恢复与并发

- **错误**：唯一失败通道 `InternalError`；浅层守卫先于游走守卫先于渲染（L139–141 顺序 =
  设计 §8 流水 ①）；消息含位置/键名/kind 实值（G9.1 断言 `bogus`/`min|max|int` 在场）；
  无顶层 catch、无部分输出（throw 即无返回值，G9 `toBeDefined` 兜静默降级检测）；
  唯一 `try`（L223）是 `finally` 栈清理，不吞错。✓
- **计数全量性（I7 攻击复核）**：`markerText` 全文件调用点恰 3（L444/L507 经 L506 计数/L717
  经 L715 计数）；`inlineLeafText` case `'truncated'`（L787）仅被 L507（已计数）与 L767
  （`inlineText` default——标记已在 L714 顶部截获）调用；`validateNode` L215–219 保证
  `kind:'truncated'` 必过 `isSchemaTruncationMarker` ⟹ 无未计数旁路；optional 包装节点
  在 L442 顶部检查恒 false ⟹ 无双重计数（混合形状 m=2 → `‡` 3，SA3/SA8 探针双证）。✓
- **环与并发**：栈语义（每段局部 `ctx.stack`，add/delete 配对于 L549/L592/L629/L677/
  L746/L753）；optional 链环以局部 `seen` 终止（L456–466/L725–734/L831–837）；DAG 共享
  各自完整渲染（与测试 `countMarkers` 同为栈口径 ⟹ 计数不变量在环/DAG 输入下自洽）；
  零可变共享状态 ⟹ 可重入。✓
- **纯度**：无 memo/时钟/随机；`JSON.stringify` 仅用于原始值（regex/enum 值/keyPattern，
  L777/L805/L971）无环风险；G6.3（无环辖域 stringify）+ G8⑤（环辖域审计）双口径覆盖。✓
- **静态无法确认项**：见 §11 后续动态验证项（根门禁运行结果、金标字节稳定性采信
  SA3/SA8 记录，SA4 未复跑）。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `render-projection-text.test.ts`（144 it：G1 4、G2 96（含 86 金格）、G3 10、G4 8、G5 6、G6 3、G8 9、G9 9 — 44 处 `it(` 调用点含 3 个循环体展开 86+9+8） | CT-1…CT-6、CT-8、CT-9 全组 + I7 回归 | `vitest.config.ts` `include: packages/*/test/**/*.test.ts` ✓（本次实读）；根 `pnpm test` = `vitest run --typecheck` | 无 skip/only/todo/env override/fallback（grep 0 命中）；接缝为每测试第一条语句（红因归因能力缺口）；不 grep 生产源码 | — |
| `render-projection-text.test-d.ts`（5 it） | 导出在场/返回 string/双入参/零选项 2 反例/结构同构 + 封闭判别 3 反例（共 5 个 `@ts-expect-error`） | typecheck `include: packages/*/test/**/*.test-d.ts` + `tsconfig.typecheck.json` 含 `packages/*/test/**/*.ts` ✓；包 `tsc` include `test/**/*.ts` ✓ | 无 | — |
| `render-projection-text-control.test.ts`（7 it） | 20 导出超集、无预算全路径 sha256 摘要、失败码、`[]` d1 标记集、`['mode']` d1 docs 键集、`SCHEMA_OPTIONS_INVALID` | 同上 include ✓ | 控制组不引用新名目（HEAD/实现后恒绿）；范围反断言（头行缺席）按 SA6 §12.8 放红文件 G1.3 ✓ | — |
| `render-projection-text-fixture.ts`（非测试文件） | 金标 86 + `EXPECTED_CELL_KEYS` 独立推导（F1 12 + F2 37 + F3 16 + F4 9 + F5 3 + F6 9；G2.0 断言 86）+ 敌意/良性孪生 + I7 twin + 畸形 8 抽样 | 包 tsc include `test/**/*.ts` ✓（不被 vitest 收集，符合 SA6 §12.1 第四行定位） | 录制区有隔离注释与录制纪律头部（HEAD/日期/命令/5 条人工核对清单） | — |
| 红灯纪律 | 运行时红文件顶层不静态 import 新名目（仅 `import * as vfsl` + 动态读；`InternalError`/环夹具/`resolveSchemaAtPath` 为既有名目/内部模块，有 4 个既有测试先例） | — | `.test-d.ts` 才静态 import（类型面红）✓ | — |
| 敏感性/负控 | 删标记 → `‡` 减 1（G3.4）；换线索 → 形态变（G3.2）；删/增/清 docs → 结构行不变（G4.4–G4.6）；三态 ✂ 等价（G5.1）；m=0 负断言（G3.3/G3.7c/d）；`ROOT.beta.leaf` 无宿主键不出现（G4.8 特判负断言） | — | 无 | — |

测试计数与 SA3 声明一致（144 契约 + 7 控制 = 151；+4 为 G3.7a–d）。测试未被真实 runner
发现的风险：无（include glob 与 typecheck include 均实读覆盖；SA6 E6 亦曾实测同 glob）。

## 10. Required revisions

**无**（无 BLOCKER / MAJOR）。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| 根门禁实际绿（SA4 未复跑） | SA7 验收 / CI：`pnpm typecheck`、`pnpm test` | exit 0；0 failed / 0 type errors（文件/用例数 ≥ 381/4540） | 任何 failed / type error |
| 86 金标字节稳定性（防未来漂移） | 聚焦命令（设计 §12）：`NODE_OPTIONS=--conditions=nomicore-source vitest run packages/vfsl/test/render-projection-text*.test.ts --typecheck` | 151 passed、金标逐字节相等 | 金标重录需求出现（应触发 SA8 快照冻结面复核） |
| 缝 2 接线时序（跨票） | T2 票：组合层窄化 ok 后直传 + truncations 透传 | `schema ≡ renderProjectionText(窄化 ok 产物)` 一致性锚成立 | 直传需转换/适配（结构兼容破坏） |
| O-A 形态可达性（跨票观察） | T2 若产出 optional 包裹 union 且首成员为 inline enum 的非字段位投影 | 输出确定、可解释（`\| "a" \| "b"?`） | 无（登记项，非阻断） |

## 12. Non-blocking observations

| # | Observation | Evidence | Suggestion |
| --- | --- | --- | --- |
| O-A | optional 包裹 union（非字段位）且首成员为 **inline enum** 时，`?` 落首成员行末尾产出 `\| "a" \| "b"?`——字面符合设计 §7.1.3 款④「首成员行前缀末尾」，但与 §7.1.1 precedence 2 所防御的 `"a" \| "b"?` 读感歧义同形（设计 §13 L7 只登记了嵌套 `\|` 不可分，未含 `?` 变体）；仅手造/环透传可达，86 金标格无此形态，逐字节确定 | `emitUnion` L653–665 firstSuffix 传递 + `emitEnum` L695 非 fold 路径 | 若 T2 实际产出该形态，在 ADR 0027 文法粒度内议「比照 precedence 2 强制折行」（跨票台账，非本票条件） |
| O-B | `needsExpansion` 的 enum 折行宽判据核算结构前缀时未计入尾随定界符（Record 的 `>`、数组的 `[]`、optional 的 `?`）——恰在 100 列边界的组合格与「全行宽 >100」的朴素读法可能相差 1–2 列；行为确定且已被金标冻结（P4 快照权威） | `needsExpansion` L844/L851/L856（prefixText 递增不含闭行） | 无需行动；如日后重钉 P4 排版须整族重录金标并过 SA8 冻结面复核 |
| O-C | docs 尾缀匹配实现为「位置渲染序 + 消费式」（先到位置取字典序最小键，落败键即弃），与设计 §7.2 非规范性「实现指引」（键中心尾缀→最小键映射，一键可命中多位）在退化格上不同——实现取规范规则文本一侧（「剩余 docs 键」语义含消费）；SA8 iteration 2 §7 行 2 已登记，金标族无碰撞格 | `assignComments` L909–926 vs 设计 §7.2 实现指引 | 维持登记；歧义用例永不进断言（P2 契约边界） |
| O-D | `validateNode` optional 分支向内层传递同一 `where` 标签（不扩展路径段）——深 optional 链的畸形消息定位精度略降（仍含键名/kind 语境，G9.1 通过） | L298–301 | 可在后续票微调消息粒度；非验收面 |
| O-E | index.ts 实际 +6 行（2 导出行 + 4 注释锚行）vs 设计 §11 ALLOW 行 2 措辞「追加 2 行」——注释锚系同一 ALLOW 单元格明示要求（「+ 注释锚 ADR 0027 决策 2/3」）与 index.ts 全文惯例（每导出块带 issue/ADR 锚），SA8 I1 已按 +6 复核接受 | index diff；index.ts 相邻块同款注释锚 | 无需行动（措辞与实际的差已由 SA8 裁定覆盖） |

## 13. 复查路由

本轮未发现新的 ADR 冲突风险面：实现未越设计 §15 已登记的复查枚举（公共 API、快照冻结、
P1/P3、`…` 记号、§7.5 通道、R1/R2 裁决面），SA8 实现门（iteration 2，clear）已按 frozen
surfaces 表闭合实现后核对。`requiresConflictRecheck: false`（SA4 侧）。
