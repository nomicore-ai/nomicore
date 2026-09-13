# task_issue-347 SA9 Standards 终审 — 条件写核心（guard I）

- 审查角色：SA9（mabf-sa9，iteration=0，standards-review）
- 被审对象：issue #347 最终已提交 diff `1b55d5c..HEAD`（HEAD = `4fd5f51`；实现提交 `47e164b`
  「feat(doc-runtime): add guarded mutation support」+ 末位 chore 提交仅追加 dispatch 记录一行）。
  父 PR #346 权威头 `1b55d5c431982a9672b0c162b64f8366089c7654` 已实测为被审提交的祖先。
- Owner 要求：无（REST `comments=[]`，brief/SA6/SA8/SA2/SA3/SA4 六源一致）——无额外 owner 要求。
- 审查方法：对照仓库 AGENTS（根/doc-runtime/namespace-runtime/docs）、ADR 0025/0026（逐条）、
  CONTEXT.md、模块责任、既有架构惯例、单一事实源、生命周期对称性、文件范围与测试质量标准，
  独立核读最终提交 diff 全量（`mutation.ts` +241/−30、`index.ts` +7/−2、两新测试文件、两审计追加）
  与 DENY 路径 `git diff`（全空实测）；不审查需求完整性（SA10 面），不运行测试、不改代码。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-347.md`（brief，AC1–AC9，comments=[]） | 已读 |
| `…_design.md`（SA1，D1–D9/ALLOW-DENY/§15 requiresConflictRecheck） | 已读 |
| `…_sa2_review.md`（approve，N1–N9 MINOR） | 已读 |
| `…_sa6_contract.md`（§12 冻结用例表/路径；§12.0 issue.code 口径） | 已读 |
| `…_sa3_impl.md`（V1–V8 证据；偏离 1 exclusive-union） | 已读 |
| `…_conflict_report.md`（SA8 前置门禁 clear + 四点复查预置） | 已读 |
| `…_implementation_conflict_report.md`（SA8 iteration=1，clear；偏离 1 专项复核 no-conflict） | 已读 |
| `…_sa4_review.md`（approve，无 BLOCKER/MAJOR；OBS-1–8） | 已读 |
| `docs/adr/0025`（L21–96 逐条）、`docs/adr/0026`（组合节） | 已读对照 |
| `AGENTS.md`（根）、`packages/doc-runtime/AGENTS.md`、`packages/namespace-runtime/AGENTS.md`、`docs/AGENTS.md` | 已读对照 |
| 最终提交源码 `packages/doc-runtime/src/{mutation,index}.ts`（880 行全文关键段） | 已读 |
| 新测试 `issue-347-guard-envelope-red.test.ts`（759 行）、`issue-347-guard-passthrough-red.test.ts`（330 行） | 已读 |
| 审计 `public-surface-guard.test.ts`、`public-surface-type-guard.test-d.ts` diff | 已读 |
| `vitest.config.ts`、`tsconfig.base.json`（`exactOptionalPropertyTypes` L10）、`.scratch/`、`git status` | 实测 |

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR。最终提交在 AGENTS 纪律、ADR 0025/0026 逐条兑现、模块责任、
单一事实源、生命周期对称性、文件范围与测试质量七个标准面上全部合规；SA3 唯一偏离
（exclusive-union `?: never`）经 SA8 专项复核 no-conflict、SA4 独立 TS 语义推演与本审查三方闭合，
方向为 fail-closed 收紧，与根 AGENTS typed-access 纪律一致。MINOR 项见 §9，不阻断。

## 3. AGENTS 与模块责任

| 标准 | 证据 | 结论 |
|---|---|---|
| 根 AGENTS：变更前读最近模块 AGENTS；公共 API 仅经 `src/index.ts` | 新导出恰三项（值 `MUTATION_GUARD_MISMATCH` + 类型 `MutationGuard`/`GuardedMutation`）全部经 `packages/doc-runtime/src/index.ts`（diff L23/L26–27） | ✅ |
| doc-runtime AGENTS L14：public-surface guard tests must account for every export | P4 值导出三断言（存在/字符串型/冻结字面量）+ T1a/b/c 类型用例（正例、`guard.path`/`guard?` 投影、四条 `@ts-expect-error` 负例、`GuardedMutation` 锚——SA2 N4 已吸收）；既有三断言原样（regex `/^applyValidatedMutation$/` 不受新常量影响，实测 diff） | ✅ |
| doc-runtime AGENTS：validated writes 支持恰公共四操作、验证失败零写入 | 四操作封闭键集仅旁路可选 `guard`（mutation.ts L609 单析取支）；形状错误/mismatch 均在任何 `transactGuarded` 之前 fail-fast 返回（单操作 L175–178、批量 L289–292） | ✅ |
| doc-runtime AGENTS：reads schema-independent；不暴露 live ROOT/SCHEMA/META/prepared state | guard 评估复用既有公共投影读 `readLogicalValueAtPath`（INV-R1 同步不抛、R9 零写入零事件）；无新暴露面 | ✅ |
| doc-runtime/namespace-runtime 责任分界（carrier mechanics vs persistence/lifecycle） | namespace-runtime **src 零 diff**（`git diff 1b55d5c..HEAD -- packages/namespace-runtime/src` 空，实测）；码经 R9 `result.issues as DiagnosticIssue[]` 结构透传，未给 `diagValidation` 加顶层 code（SA8 明令） | ✅ |
| 根 AGENTS typed-access：负例类型 fixtures fail-closed | T1b 四条 `@ts-expect-error`（absent 非字面 true/同现/缺 path/缺判别键）；SA3 V4 `tsc -p tsconfig.typecheck.json` exit 0 ⇒ 无 TS2578，负例真实命中（SA4 独立复核一致） | ✅ |
| docs AGENTS：行为变更须同步规范文档；文档不得虚构实现行为 | ADR 0025/0026、CONTEXT 词条、typed-access guard 小节均在基线 `1b55d5c` 先行兑现；本任务 docs 零改动且无需改动（SA8 两轮确认）；代码 JSDoc 与 ADR 语义一致 | ✅ |

## 4. ADR 0025/0026 逐条兑现（独立源码核验）

| ADR 条款 | 实现落点（实测行号） | 结论 |
|---|---|---|
| 0025 L21–27 信封形态（单条件判别联合） | `MutationGuard` L78–81（exclusive-union 渲染，见 §5 偏离闭合）；`parseGuard` L648–683 运行时恰其一/字面 true | ✅ |
| 0025 L42–44 谓词语义（投影深相等/absent 两满足源/路径纪律/禁 `[]`） | `evaluateGuard` L711–718 复用 `readLogicalValueAtPath`（read.ts L53+）+ `logicalValuesEqual`（L540–552）零新语义；`parseGuard` ⑥d 拒 `[]`；G6 证明读失败满足 absent 且 number 段非形状错误 | ✅ |
| 0025 L48–51 评估位置与原子性（解析后/分叉前/先于 schema；纯读不进事务） | 单操作 L168→L170(root fatal)→L175–178(guard)→L182(分叉)；schema 校验在两管线内部 ⇒ O1/O2/O3 双向对照；评估调用点均在 `transactGuarded` 之外 | ✅ |
| 0025 L53–58 两态错误域 | 形状族：`failIssue` 键缺席构造无 code（L865–867），`parseGuard` ①–⑥d 确定性序全表；不满足族：`mismatchIssue` L722–730 带码、`path:[...guard.path]` 新鲜副本、单侧 ≤256 字符截断 + 不可序列化回退 | ✅ |
| 0025 L58/L87 导出 + 审计 | 见 §3 行 2 | ✅ |
| 0025 L60 + 0011/0014 诊断透传、写槽零改动 | namespace-runtime/诊断包 src 零 diff（实测）；E3/E5 断言 stage=validation、result=rejected、record 级 `code===undefined`、`issues.items[0].code`=稳定码 | ✅ |
| 0025 L64–66 边界（不触复制/wire/replaceSchema/META） | 相关路径 `git diff` 全空（实测） | ✅ |
| 0025 L72–74/0026 L29、L53–55 两形态顶层 guard；元素永禁 | E1 过滤式演进 L230（消息模板零改动）；元素循环 `parseMutationCore(ops[i], prefix, false)` L252；`BatchedMutation.ops` 元素类型 `ValidatedMutation` 不动 ⇒ 静态 TS2353 + 运行时无码双层一致（N3/E7/#350 B6 锚保持） | ✅ |
| 0025 L86/0026 L65 无 guard 逐字节不变 | 未知键判定仅增 `!(allowGuard && k==='guard')` 析取支；N1–N4 重钉 `zzz` 文案（单/批量两处）+ 既有 402 用例零回归（SA3 V5/V8） | ✅ |
| 0008/CONTEXT 写序列器、零写入、槽序 | 评估为槽内同步纯读；M 组逐字节 `Y.encodeStateAsUpdate` + 0 事务 0 update 断言；槽序不改 | ✅ |
| 0002 机制非策略、词表封闭 | 谓词恰 equals/absent；无 exists/比较/组合子；`parseGuard` ② guard 内未知键封闭 | ✅ |

## 5. 架构惯例、单一事实源与生命周期对称性

- **相似能力对照（无平行机制）**：读取=既有 `readLogicalValueAtPath`；深相等=既有
  `logicalValuesEqual`；解析=唯一解析核 `parseMutationCore` 参数化（`allowGuard` 第三参），未建第二
  解析器；码载体=`DiagnosticIssue.code?: string` 先例同构（字段 + 消息前缀双载体）；可选信封键先例
  `{ops:undefined}`→E2 与 `{guard:undefined}`→parseGuard ① 同款 fail-closed。
- **单一事实源**：`MUTATION_GUARD_MISMATCH` 单点定义于 mutation.ts L62、index.ts 再导出；P2/E3/E5
  断言运行时拒绝码与公共导出同源。guard 可满足性唯一事实源为评估时点 committed Y.Doc 投影——无缓存/
  镜像/第二状态。信封合法性单通道（parseMutationCore + parseGuard）。
- **生命周期对称性**：无新增资源（同步纯读、零 register/subscribe/acquire）；mismatch 路径零事务零
  事件零 dirty 登记，无需清理；e2e 测试每例 teardown（`handle.release()` + `writer.dispose()`），强于
  既有 #350 测试约定。**不对称面不存在。**
- **SA3 偏离 1（exclusive-union `?: never`）闭合**：SA8 独立编译探针（A1/A2/B1–B9）证明 ADR 字面
  联合静态接纳 `{equals,absent}` 同现（fail-open 缺口），delivered 渲染在可赋值性层面拒绝且合法值
  集合不变；SA4 独立 TS 语义推演一致；JSDoc L71–77 双重留痕；运行时 parseGuard ③a/④/⑤a 拒绝面与
  静态面双层一致。属 ADR 0025 L57 自身立法错误族的静态补强，非 override——**本审查第三源确认
  no-conflict，无遗留标准面问题。**

## 6. 文件范围

| 维度 | 实测 |
|---|---|
| ALLOW 六路径 | `mutation.ts`(+241/−30)、`index.ts`(+7/−2)、`issue-347-guard-envelope-red.test.ts`（新 759 行）、`issue-347-guard-passthrough-red.test.ts`（新 330 行）、`public-surface-guard.test.ts`(+10)、`public-surface-type-guard.test-d.ts`(+39)——与设计 §10 ALLOW 逐字一致 ✅ |
| DENY 零 diff（实测 `git diff 1b55d5c..HEAD -- <path>` 全空） | namespace-runtime/src、namespace-diagnostic-log、doc-runtime/src/read.ts、mutation-local.ts、doc-runtime 其余 src、`issue-350-*` 冻结锚、docs/adr、CONTEXT.md、`.agents/`、wire/复制、`vitest.config.ts`/tsconfig/package.json/pnpm-lock.yaml ✅ |
| 末位 chore 提交 `4fd5f51` | 仅 `wiki/raw/task_issue-347_dispatch.md` +1 行（review group 记录），非实现面 ✅ |
| 工作区 | `git status` 仅 Host 预置 brief 未跟踪；`.scratch/issue-347/` 空目录残留（gitignored，SA4 OBS-7，cosmetic） |

## 7. 测试质量标准

| 标准 | 证据 | 结论 |
|---|---|---|
| 真实行为断言（非源码文本） | 全部断言面向结果联合/live Y.Doc 值/字节快照/事务与 update 计数/诊断 record/notifier 计数 | ✅ |
| 红灯敏感度（防伪绿三组互为对照） | S 组强制 `not.toMatch(/未知信封键\s*"guard"/)` + S0 合法 anchor 先行；M 组强制 `code===稳定码`（旧实现无 code 必红）；G 组强制 `ok:true` 落盘（旧实现必红） | ✅ |
| 红→绿证据 | SA3 V1（实现前 42 failed/10 passed，失败恰在目标行为断言；10 绿恰为负控）、V2 类型面同红；V3 52/52 绿、V4 tsc exit 0、V5 doc-runtime 28 文件/447 用例、V6 ns-runtime 50/379、V7 根 `pnpm typecheck` exit 0、V8 根 `pnpm test` 349 文件/3686 用例 exit 0 | ✅（SA4 静态采信 + 本审查一致性核验） |
| 收集面真实 | vitest include `packages/*/test/**/*.test.ts` 覆盖两新文件；typecheck include `*.test-d.ts` + `tsconfig.typecheck.json` 双入口 | ✅ |
| 无 skip/only/todo/env override/软断言 | grep 实测零命中 | ✅ |
| 契约用例覆盖 | G1–G9、M1–M10（含 M6b）、O1–O3、S0–S11、N1–N4、P1/P2、E1–E7、P4、T1a/b/c 与 SA6 §12 冻结表逐字对应；S9/S10/S11/<1KiB 为设计裁定超集（SA6 回写请求，非弱化） | ✅ |
| 冻结锚保持 | #350 B5–B7、元素 guard 拒绝、`zzz` 双文案、诊断指纹（诊断包零 diff ⇒ schema-freeze 不受影响） | ✅ |

## 8. Owner 要求与上游义务闭合

Owner 评论为零（comments=[]），无额外要求或 override；任务要求全部来自 issue 正文 + ADR。
SA2 N1–N9：N3/N4/N6/N7 已落实于实现与测试（SA4 §3 核验，本审查一致）；N1/N2 属设计文档笔误与
措辞（非交付面）；N5（E8）按 SA8 §7.4 记录 deferred；N8/N9 为已接受残余/裁量。SA6 §12.11 六项
义务逐项兑现（§4 表）。SA8 前置四点复查项（E1 演进/元素维持/逐字节不变/R9 零改动）经三轮独立
核验全部闭合；设计 §15 `requiresConflictRecheck` 已由 SA8 iteration=1 判 clear/false，本审查未发现
其外的新决策冲突面。

## 9. Non-blocking observations（MINOR，不阻断 approve）

- **M-1（R1 消息尾残余）**：批量未知键消息尾「批量信封只允许 "ops"」在顶层放行 guard 后语义略窄；
  为保 SA8 冻结面逐字节不变而有意保留（N2 钉住），cosmetic follow-up 须与 #350 锚联动评审
  （设计 §13 R1 / SA4 OBS-3）。
- **M-2（E8 序列器竞争显式用例 deferred）**：ADR 0025 L90 验证门槛提及序列器竞争测试；现以
  E2–E5 透传 + G9/M6b 批前语义覆盖，显式「同槽排队两写」用例留 SA6/SA7 后续轮（SA2 N5、SA8 §7.4
  均认可为增强；issue AC 未列；FIFO 语义系既有已测行为）。
- **M-3（<1 KiB message 预算未钉断言）**：设计 D8 承诺 <1 KiB，测试按契约冻结上界断言 <64 KiB
  （M8）；契约未冻结更严上界，SA4 OBS-4 记录不改判。
- **M-4（SA6 契约回写待办）**：S9/S10/S11、<1 KiB 预算、T1 四负例、E8 可选项的契约表同步待 SA6
  下一轮；测试已按超集落地，两态可判别性不依赖该回写（SA4 OBS-2）。
- **M-5（`.scratch/issue-347/` 空目录残留）**：gitignored、无内容、非实现面（SA4 OBS-7）。
- **M-6（设计文档笔误）**：SA2 N1（§13/§14 交叉引用）/N2（D6 不可达边界措辞）属设计产物文档面，
  已按选定次序正确实现，不影响交付代码与测试。

## 10. 结论路由（供 Controller）

- verdict：**approve**（无 BLOCKER/MAJOR；§9 M-1–M-6 为 MINOR 非阻断）。
- 标准面全部闭合：AGENTS 纪律、ADR 0025/0026 逐条兑现、模块责任零越界、单一事实源、生命周期
  对称性、文件范围恰为 ALLOW、测试质量（行为断言 + 敏感度对照 + 红绿证据 + 真实收集面）。
- 无新增 ADR 冲突面，无需再次冲突复查（SA8 iteration=1 已判 `requiresConflictRecheck: false`，
  本审查独立确认）。
