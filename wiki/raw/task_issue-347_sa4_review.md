# task_issue-347 SA4 实现静态审查 — 条件写核心（guard I）

- 审查角色：SA4（mabf-sa4，iteration=0，implementation-review）
- 被审对象：issue #347 已实现的 guarded mutation 变更（工作区 diff vs 基线 `1b55d5c`，分支 `mabf/issue-347`）
- 审查方法：静态审查——逐行核读 `git diff 1b55d5c` 全部 267 行新增与周边源码、两新测试文件全文、
  公共面两审计文件、read.ts/write.ts/diagnostic.ts/诊断投影关键段、vitest/tsconfig 运行入口；
  不运行测试、不启动服务、不创建进程（SA4 纪律）；运行时绿证据采信 SA3 V1–V8 与 SA8 独立探针并作静态一致性核验。
- Owner 评论：无（REST `comments=[]`；brief/SA6/SA2/SA3/SA8 五源一致）——无额外 owner 要求。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-347.md`（brief，AC1–AC9，comments=[]） | 已读 |
| `wiki/raw/task_issue-347_sa6_contract.md`（§12 冻结用例表与测试路径） | 已读，逐用例对照 |
| `wiki/raw/task_issue-347_design.md`（SA1，§5 D1–D9/§10 范围/§12 映射） | 已读 |
| `wiki/raw/task_issue-347_sa2_review.md`（approve；N1–N9 MINOR） | 已读 |
| `wiki/raw/task_issue-347_sa3_impl.md`（V1–V8、偏离 1 exclusive-union） | 已读 |
| `wiki/raw/task_issue-347_implementation_conflict_report.md`（SA8 iteration=1，clear） | 已读 |
| `wiki/raw/task_issue-347_relevant_decisions.md` / `…_conflict_report.md`（SA8 前置门禁） | 已读 |
| `docs/adr/0025-guarded-mutation-conditional-write.md`、`docs/adr/0026-atomic-mutation-envelope.md` | 已读（0025 L21–95 逐条） |
| `packages/doc-runtime/src/mutation.ts`（880 行，diff 与全文关键段）、`src/index.ts` | 已读 |
| `packages/doc-runtime/src/read.ts`（投影/缺席/失败单通道）、`src/mutation-local.ts`（ParsedMutation 消费面） | 关键段已读 |
| `packages/namespace-runtime/src/write.ts`（S3/S5/R9）、`src/runtime.ts`（mutateData 签名） | 关键段已读 |
| `packages/namespace-diagnostic-log/src/{schema,projection/issues}.ts`（DiagnosticIssue.code? 与投影截断） | 关键段已读 |
| 新测试 `issue-347-guard-envelope-red.test.ts`（759 行全文）、`issue-347-guard-passthrough-red.test.ts`（330 行全文） | 已读 |
| `public-surface-guard.test.ts`、`public-surface-type-guard.test-d.ts`（含既有断言） | 已读 |
| `issue-350-batch-envelope-red.test.ts` B5–B7 冻结锚、`vitest.config.ts`、`tsconfig.typecheck.json` | 已读 |
| `packages/doc-runtime/AGENTS.md`、`packages/namespace-runtime/AGENTS.md` | 已读对照 |
| git 状态（4 modified + 2 新测试 + wiki 未跟踪；DENY 路径 diff 全空） | 实测 |

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR。实现忠实落实 SA1 设计 D1–D9、issue AC1–AC9 与 SA6 冻结契约；
文件范围恰为 ALLOW 六路径；全部冻结面（元素禁 guard、无 guard 逐字节不变、诊断指纹、wire、写槽 R9、
槽序）静态核验保持；测试为真实行为测试、被真实 runner 收集、组间互为敏感度对照。SA3 偏离 1
（exclusive-union `?: never`）经 SA8 编译探针 + 本审查独立 TS 语义推演确认为「合法值集合不变的
fail-closed 收紧」，与运行时 parseGuard 拒绝面双层一致。MINOR 项见 §12，不阻断。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| Issue AC1：合法 guard 满足四动词 + `set([])` 提交 | `evaluateGuard`（mutation.ts L711–719）satisfied → 既有管线；G1–G5/G8 测试（test L204–274、L348–360） | 落实（评估纯读在分叉前，成功路径零额外事务） |
| AC2：equals 不满足 → 单 issue + 码 + path + 零写入 | `mismatchIssue`（L722–730）：`code: MUTATION_GUARD_MISMATCH`、`path: [...guard.path]` 新鲜副本；M1–M3/M5/M8/M10 断言码/单 issue/字节不变/0 事务 0 update | 落实 |
| AC3：absent 两态 | `evaluateGuard` absent 分支 `!read.ok \|\| read.value === undefined`（L716）；G3/G6/M4 | 落实（读失败与缺键吸收均满足，ADR 0025 L43） |
| AC4：形状错误全家桶无码零写入不可重试 | `parseGuard` ①–⑥d 确定性检查序（L648–682）；`failIssue` 构造无 code 键（L865–867）；S1–S11 含设计三项裁定（S9 未知键/S10 equals:undefined/S11 guard:undefined） | 落实（超出 ADR 枚举的三项为 SA1 裁量 + SA2 approve + 回写请求范围内） |
| AC5：guard 评估先于 schema 校验 | 单操作：parse → root fatal 检查（L170）→ guard 评估（L175–178）→ 分叉（L182）；schema 校验在局部/legacy 管线内部；O1/O2/O3 双向对照 | 落实 |
| AC6：无 guard 逐字节不变 + 带码结果联合透传 | 未知键判定仅增析取支 `!(allowGuard && k==='guard')`（L609）；E1 过滤式放行（L230）；N1–N4 + E1/E6/E7 负控；R9 `issues` 原样透传（write.ts L205–209，零改动） | 落实 |
| AC7：两导出 + 审计同步 | index.ts L23/L26–27 值导出 `MUTATION_GUARD_MISMATCH` + 类型 `MutationGuard`/`GuardedMutation`；P4（public-surface-guard L55–61）+ T1a/b/c（type-guard L98–131）；既有三断言原样（regex `/^applyValidatedMutation$/` 不受新常量影响） | 落实（AGENTS「审计覆盖每一导出」满足：值 1 + 类型 2 全锚定） |
| AC8：批量顶层 guard（评估一次、批前 committed、先于逐 op、单 issue）；元素 guard=形状错误 | `prepareBatchMutation` E1→E2–E5→E6 parseGuard（L276–282）→ root 检查（L284）→ G 评估恰一次（L287–292）→ P 循环；元素 `parseMutationCore(ops[i], prefix, false)`（L252）+ `BatchedMutation.ops` 元素类型不动（L88）；G8/G9/M6/M6b/M7/O3/N3/E7 | 落实 |
| AC9：根 typecheck + doc-runtime 测试 | SA3 V5（28 文件/447 用例）/V7（pnpm typecheck exit 0）/V8（根 pnpm test 3686 用例 exit 0）；本审查静态核验类型一致性（见 §4/§9）与运行入口真实性 | 采信 + 静态一致（SA4 不复跑；列入 §11 动态验证项） |
| SA2 N1–N9（全 MINOR） | N3（parseGuard 位次置于 op 自身检查后，L633–636 注释标注）/N4（T1c GuardedMutation 锚）/N6（M9 独立用例）/N7（截断后置 + 不可序列化回退 L757–767）已落实；N1/N2 属设计文档笔误与措辞，N5（E8）按记录 deferred，N8 保持 R1 残余，N9 保持类型 `equals: unknown` | 落实或按记录处置，无遗漏 |
| SA6 §12.11 六项义务 | ①D2 issue.code 落地 ②键封闭演进 + 元素排除（L609/L230/L252）③插入点（§4 AC5 行）④复用 readLogicalValueAtPath + logicalValuesEqual（L712–715，零第二套语义）⑤仅经 index.ts 导出 ⑥冻结面零回归（§6） | 逐项落实 |
| SA8 required actions 1–5（前置报告）与 implementation 复查四点 | E1 键封闭演进/元素维持/单操作无 guard 不变/R9 零改动——全部在本审查独立复核（§5/§6/§7） | 落实 |

Owner 评论映射：`comments=[]`，无遗漏义务。

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D1 `MutationGuard` 判别联合 | mutation.ts L78–81（exclusive-union `?: never` 渲染，JSDoc L71–77 说明） | 语义契约兑现：两成员、恰其一、字面 true、path `readonly (string\|number)[]`。偏离 1 见下 | 无（SA8 no-conflict，本审查独立确认） |
| D1 偏离：exclusive-union 替代字面联合 | L78–81 | TS 语义独立推演确认：字面联合的 excess-property 检查不拒绝「存在于任一成员」的键（`{equals,absent}` 同现静态接纳——设计 D1 原声称可拒系事实错误，SA3 认定成立）；`?: never` 在可赋值性层面拒绝同现与显式 `undefined`；合法值集合不变（成员一 `absent`、成员二 `equals` 本就不存在）；与运行时 parseGuard ③a/④/⑤a 拒绝面完全一致 | 无（fail-closed 收紧，方向与根 AGENTS typed-access 纪律一致；SA8 编译探针 A1/A2/B1–B9 佐证） |
| D2 码载体 `issue.code` + `MUTATION_GUARD_MISMATCH` 常量 | L52–56（常量）、L50–54（`MutationIssue.code?: string` JSDoc 明示键缺席=不可重试） | 两态可判别成立：`code===MUTATION_GUARD_MISMATCH ⟺ 可重试`；形状族一律键缺席构造（failIssue 无 code） | 无 |
| D3 键封闭演进（OPTIONAL 旁路 + allowGuard 参数 + E1 过滤式） | L606–609（单操作）、L228–230（批量 E1）、L252（元素 false） | 无 guard 输入消息逐字节保持（判定式仅增一个析取支；`zzz` 文案 N1/N2 重钉）；`{ops,guard,zzz}` extra 仍只含 zzz；`{op,ops,guard}` 双形态消息保持 | 无 |
| D4 `parseGuard` 检查序 ①–⑥d + 三项裁定 | L640–682：①plainObjectOf ②未知键封闭 {path,equals,absent} ③a/③b 恰其一 ④字面 true ⑤a equals 非 undefined ⑤b containsNonFiniteNumber（任意深度）⑥a–d path 族 | 与设计表逐行一致；`containsNonFiniteNumber`（L687–693）按「任意深度含」递归（数组/plain 对象），其余载体不含；返回 path 为新鲜副本 `[...env.path]`；S9/S10/S11 加测 | 无 |
| D5 评估语义 | `evaluateGuard` L711–719：absent=`!read.ok \|\| value===undefined`；equals=`read.ok && logicalValuesEqual(read.value, guard.equals)`；`isAbsentGuard` 谓词判别（L703–708） | 复用两既有符号零新语义；`logicalValuesEqual`（L540–552）undefined 键过滤对称深相等——M10 非子集不满足、G7-①undefined 键过滤、G7-②键序无关由实现直接成立；equals:undefined 已被 ⑤a 排除 ⇒ `logicalValuesEqual(undefined, 确定值)` 恒 false（M3） | 无 |
| D6 评估插入点 | 单操作 L168→L170→L175→L182（parse→root fatal→guard→分叉）；批量 E1–E5→E6→root 检查→G→P（L228–306）；评估均在 `transactGuarded` 之外 | 与 ADR 0025 L48–51 及 SA2 N2 选定次序逐位嵌合；legacy `set([])` 在分叉前过评估（G5） | 无 |
| D7 类型面（GuardedMutation/BatchedMutation.guard?/MutationEnvelope） | L83–91：交集式 `ValidatedMutation & {guard?}`、`ops` 元素类型不动、联合重组 | 元素携带 guard 静态 TS2353（既有负例 L86–87 保持）+ 运行时封闭双层一致；`mutationEnvelope toMatchTypeOf<ValidatedMutation \| BatchedMutation>` 结构子类型成立（交集+可选键均为窄化） | 无 |
| D8 mismatch 消息模板与有界摘要 | `mismatchIssue`/`renderGuardPath`/`summarizeLogicalValue`/`truncateSummary` L722–767：码前缀模板、单侧 ≤256 字符 + `…(截断)`、JSON.stringify 抛错/非字符串回退 `<不可序列化：类型>` | M1/M2 期望/实际文本在场、M4 缺席标记匹配、M8 1 MiB equals → 摘要 ~260 字符（<1 KiB < 诊断 4096B 预算 < 契约 64 KiB） | 无 |
| D9 导出与审计 | index.ts diff + P4 + T1a/b/c | 见 §3 AC7 行 | 无 |
| 设计 §13 R4 敌意输入 | 循环 equals → containsNonFiniteNumber 无 visited 集 → 栈溢出 → prepareMutation 既有 catch 收编 E205 无码零写入（L202–212）；e2e 面 S3 先拒 | 与现役 cyclic set value→cloneJson→E205 同构，不新增立法面 | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| guard 形状校验与槽前评估 | doc-runtime（信封解析/prepare 编排 Owner） | mutation.ts 唯一实现文件 | ✅ 符合包 AGENTS「validated writes 支持恰公共四操作 + 验证失败零写入」 |
| 原子性/时序 | namespace-runtime 写序列器（不动） | 零改动，FIFO 既有语义 | ✅ ADR 0025 L49 归属保持 |
| 码入诊断日志 | 诊断包投影（不动） | 复用 `DiagnosticIssue.code?`（schema.ts L141）+ R9 透传 | ✅ 未给 diagValidation 加顶层 code（SA8 明令；E3/E5 断言 record 级 `code===undefined`） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 投影读取 | `readLogicalValueAtPath`（read.ts，INV-R1 同步不抛/R9 零写入零事件） | 直接调用（L712） | 一致 | SA8 required action 4；XML 终点投影字符串比较（read.ts L351–352）恰为 ADR 0025 L44「指向 XML 终点则与其投影值比较」的兑现 |
| 结构深相等 | `logicalValuesEqual`（L540–552，union 仲裁既有） | 直接调用（L715） | 一致 | 零第二套相等语义 |
| 稳定码载体 | `DiagnosticIssue.code?` + S3 层码先例（消息前缀 + 字段双载体） | `MutationIssue.code?` + 消息码前缀（D8 模板） | 一致 | 分层分工（record 级 vs issue 条目级）与先例同构 |
| 信封键封闭 | 单一解析核 `parseMutationCore`（prefix 参数化） | 增第三参 `allowGuard`，无第二解析器 | 一致 | 「唯一解析核」现状保持 |
| 可选信封键先例 | `{ops: undefined}` 走 E2 拒绝 | `{guard: undefined}` 走 parseGuard ① 拒绝（S11） | 一致 | 同款 fail-closed |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| `MUTATION_GUARD_MISMATCH` 常量值 | mutation.ts L55 单点定义，index.ts 再导出 | 两测试经 `import * as ns` 断言同源（P2/E3/E5） | 无 |
| guard 可满足性 | 评估时点 committed Y.Doc 投影 | 无缓存/镜像/第二状态 | 无 |
| 信封合法性 | parseMutationCore + parseGuard 单通道 | 无平行校验路径 | 无 |

### 生命周期对称性

无新增资源：评估为同步纯读（无 register/subscribe/acquire）；mismatch 路径零事务零事件零 dirty 登记，
无需清理；e2e 测试每例 teardown（release + dispose）——强于既有 #350 测试约定（其无 teardown）。
**不对称面不存在。**

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套读取/相等/解析/清理/状态机 | read.ts / logicalValuesEqual / parseMutationCore | 全部复用或参数化扩展 | 无平行 |
| 单一 issue 专用过度抽象 | — | parseGuard/evaluateGuard 等皆为 guard 专用最小函数 | 无过度抽象 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/doc-runtime/src/mutation.ts`（+241/−30） | ALLOW 行 1 | guard 解析/形状校验/评估/稳定码/公共类型 | ✅ 恰为 D2–D8 落点 |
| `packages/doc-runtime/src/index.ts`（+7/−2） | ALLOW 行 2 | 两类导出 | ✅ 公共 API 仅经 src/index.ts（包 AGENTS） |
| `packages/doc-runtime/test/issue-347-guard-envelope-red.test.ts`（新，759 行） | ALLOW 行 3（SA6 §12.1 冻结路径逐字一致） | G/M/O/S/N/P 契约用例 | ✅ |
| `packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts`（新，330 行） | ALLOW 行 4（冻结路径一致） | E 用例端到端 | ✅ |
| `packages/doc-runtime/test/public-surface-guard.test.ts`（+10） | ALLOW 行 5 | P4 审计追加，既有 3 断言原样 | ✅ |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts`（+39） | ALLOW 行 6 | T1a/b/c 追加，既有断言原样 | ✅ |
| `wiki/raw/task_issue-347_sa3_impl.md` 等 wiki 文件（未跟踪） | 技能固定产物 / Host 预置 | 各角色产物 | ✅ 非 implementation 面 |

DENY 核验（`git diff 1b55d5c -- <path>` 全空，实测）：`packages/namespace-runtime/src/**`、
`packages/namespace-diagnostic-log/**`、`packages/doc-runtime/src/read.ts`、`mutation-local.ts`、
doc-runtime 其余 src、`issue-350-*` 冻结锚、docs/ADR、CONTEXT.md、typed-access、wire/复制、
`vitest.config.ts`/tsconfig/package.json/lockfile。无越界。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `applyValidatedMutation(derived, doc, mutation)` 第三参 | 唯一生产 caller：namespace-runtime S5（write.ts L187） | 签名零改动（`ValidatedMutation \| unknown`）；guard 信封经 S3 深冻快照原样进入；mismatch issues（含 code）经 R9 `result.issues as DiagnosticIssue[]` 结构化透传 | 无——`MutationIssue.code?: string` 与 `DiagnosticIssue.code?`（schema.ts L141）结构兼容，投影 full 256B/redacted 保留（projection/issues.ts L135/L156–170） | 无 |
| `mutateData(mutation: unknown)` | Host typed adapter / 测试 | runtime.ts L178 参数本为 `unknown`，guard 信封无需改型 | 无 | 无 |
| `MutationIssue` 增可选 `code?` | 公共类型消费方 | 加性可选键、结构超集；mutation-local.ts 仅类型导入；`DataMutationIssue` 名目独立 | 无 | 无 |
| `MutationEnvelope`/`BatchedMutation` 形状演进 | 既有类型断言（type-guard L76–93） | `ops` 元素类型不变 ⇒ 元素 guard TS2353 负例保持；`toMatchTypeOf` 单向结构子类型成立；三个既有 `@ts-expect-error` 负例（双形态/元素 guard/字符串）仍编译错 | 无 | 无 |
| S3 快照层 vs guard 形状族分层 | e2e 调用方 | `equals` NaN/undefined 值键仍被 S3 以 `MUTATION_INPUT_NOT_PLAIN_DATA` 先拒（stage=input-snapshot、record 级码）——E6 绿负控固化；直打层由 parseGuard ⑤a/⑤b 裁决（S7/S10） | 无（两层模式既有，非缺陷） | 无 |
| 复制 apply / wire / replaceSchema / META | 边界外（ADR 0025 L64–66） | 零改动、零断言；grep 无信封形状的 wire 侧消费者 | 无 | 无 |
| 诊断 record schema 指纹 | schema-freeze 测试 | namespace-diagnostic-log 零 diff | 无 | 无 |

关键 caller 无遗漏（生产 caller 唯一；其余为测试与类型消费方）。

## 8. 错误、恢复与并发

| 检查点 | 结论 | 证据 |
|---|---|---|
| 静默失败/伪装成功 | 无：形状族与评估不满足均为显式 `ok:false` 单 issue；无 fallback 掩盖 | parseGuard/mismatchIssue 构造；M/S 组断言 |
| 部分完成诚实性 | 无部分完成：mismatch 在任何 `transactGuarded` 之前返回（单操作 L175–178 在 L141/L147 事务之前；批量 G 在 P 与最终事务之前） | prepareMutation/applyValidatedMutation 控制流；expectZeroWrite 断言字节 + 0 事务 + 0 update |
| 错误分类稳定性 | 两态错误域可判别：`code===MUTATION_GUARD_MISMATCH ⟺ 可重试`；形状族键缺席；fatal 通道（E204/E205）不变 | D2 + failIssue；O2 证明 schema 域拒绝仍无码 |
| 重试幂等 | guard 信封纯数据，评估为 committed 状态纯函数；M9 拒绝→状态改写→重放通过 | M9 用例 |
| 回滚/清理 | 零写入拒绝无需回滚；评估零事件 ⇒ 无 dirty 登记（notifier 0 断言） | E3/E5 |
| TOCTOU/并发 | 单写槽内评估+提交同槽（FIFO 独占，ADR 0025 L49）；doc-runtime 直打无序列器——与现役全部 mutation 一致的既有边界，非本任务引入 | write.ts S5 同槽；设计 §9 |
| 迟到回调/失败后复活 | 同步纯函数、零订阅零注册；evaluateGuard 不抛（read INV-R1） | read.ts L53–135 |
| 敌意/病态输入 | 循环 equals → containsNonFiniteNumber 栈溢出 → 既有 catch E205 无码零写入（e2e 面 S3 先拒）；getter/Proxy 在 e2e 面由 S3 四查先拒、直打面 E205 收编；bigint/Date 经 ⑤b 放行后评估期自然不相等、摘要回退 `<不可序列化：…>` | L202–212 catch；summarizeLogicalValue try/catch |
| 批量 guard 与批内 op 写入竞态 | G 评估恰一次、读批前 committed（ops 写入在其后单事务）；M6b 反向对照（equals=批后意图值 → 拒绝） | prepareBatchMutation 次序；G9/M6b |
| `-0`/`null` 边界 | `logicalValuesEqual` 沿用 `===`（0 与 -0 相等）——复用底座既有语义；`absent` 对 null 有值不满足（null 是合法值） | L540–552；read.ts D4 |

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-347-guard-envelope-red.test.ts` P1/P2 | 值导出存在性/字符串型/字面量；运行时码与导出同源 | 根 vitest include `packages/*/test/**/*.test.ts`（vitest.config.ts L15） | 无 | 无 |
| G1–G9 | `ok:true`、值落盘、恰 1 事务 1 update（G8 批量单事务）、G9 批前 committed | 同上 | 无（旧实现必红——组敏感度成立） | 无 |
| M1–M10（含 M6b） | 单 issue、`code===导出值`、path 深等 guard 路径、字节不变、0 事务 0 update、message 期望/实际/缺席标记/截断（<64 KiB）、M9 重放、M10 非子集 | 同上 | 无（旧实现无 code 字段必红） | 无 |
| O1–O3 | 不满足+非法新值只报 guard（无「类型不匹配」）；满足后 schema 管线可达（有该消息/聚合 ≥2 无码） | 同上 | 无（双向对照，防 guard 吞掉 schema 拒绝或反之） | 无 |
| S0–S11 | 合法 anchor 先行；形状族单 issue、`code===undefined`、零写入、`message` 不匹配 `/未知信封键\s*"guard"/`；S9/S10/S11 设计裁定 | 同上 | 无（anchor + not-toMatch 防与能力缺失同义反复；若 guard 被静默忽略则 S2–S11 的 ok:false 必红——fail-open 敏感） | 无 |
| N1–N4 | 无 guard 四动词/批量/`set([])`/`zzz` 文案（单操作与批量两处）/元素 guard 无码拒绝 + 零写入 | 同上 | 无 | 无 |
| `issue-347-guard-passthrough-red.test.ts` E1–E7 | ok 联合、readData 值、字节、update/notifier 计数、诊断恰 1 record（stage=validation/rejected、record 级无码、`issues.items[0].code`=稳定码、policy=full）、E6 S3 分层（stage=input-snapshot、record 级 `MUTATION_INPUT_NOT_PLAIN_DATA`）、E7 元素禁令 | 同上（namespace-runtime test 目录在 include 面内；#350 同路径模式既有文件在收集面内佐证） | 无；fixture 每例独立 setup + teardown（release/dispose），强于 #350 约定 | 无 |
| `public-surface-type-guard.test-d.ts` T1a/b/c | 正例 + path/equals/guard 投影；四条 `@ts-expect-error` 负例；GuardedMutation 锚 | vitest typecheck include `packages/*/test/**/*.test-d.ts`（L20）+ tsconfig.typecheck.json `packages/*/test/**/*.ts`（`.test-d.ts` 亦匹配）→ `pnpm test`（--typecheck）与 `tsc -p tsconfig.typecheck.json` 双入口 | 无；SA3 V4 exit 0 ⇒ 无 TS2578（负例真实命中） | 无 |
| `public-surface-guard.test.ts` P4 | 新值导出三断言；既有三断言原样（第三断言 regex 过滤不受新常量影响） | 同 P1 | 无 | 无 |

无 skip/only/todo/env override（grep 实测）；无源码字符串断言代替行为验证；断言全部面向结果联合/字节/
事件/诊断 record。红灯证据：SA3 V1（实现前 42 failed/10 passed，10 绿恰为负控）+ V2（类型面红）——
红在正确断言处，负控未被误伤。

## 10. Required revisions

无 BLOCKER / MAJOR finding。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 全仓回归与类型门（AC9 终验） | SA7/最终验证：根 `pnpm typecheck` + 根 `pnpm test`（= vitest run --typecheck） | 两者 exit 0（SA3 V7/V8 已绿，收口前复跑一次） | 任一失败或出现 TS2578（`@ts-expect-error` 失效） |
| 序列器竞争显式用例（ADR 0025 L90；E8 deferred） | SA6/SA7 后续轮 | 同槽队列两写：后写 guard equals 前写已提交值 → 后写通过（FIFO 内见前写 committed） | 后写误读批前/队前状态或产生 TOCTOU 拒绝 |
| 红灯敏感度复核（防测试腐化） | 在基线 `1b55d5c` 上重放两新测试文件 | G/M/O/P 组红（未知键/无 code/导出缺失）、N/E1/E6/E7 绿 | 负控在基线变红（说明负控误钉新行为）或目标组意外绿 |
| 大子树 equals 摘要成本（设计 N7） | hostile 规模 doc + 深子树 guard | 拒绝仍同步完成、message ≤ ~1 KiB | 截断前 O(子树) stringify 造成不可接受停顿（无正确性影响） |
| 循环引用 equals（直打层） | doc-runtime 直打带 cyclic equals | E205 无码单 issue、零写入（与 cyclic set value 现役同构） | 抛出穿透或伪成功 |

## 12. Non-blocking observations

- **OBS-1（E8 竞争用例 deferred）**：ADR 0025 L90 验证门槛提及「序列器竞争测试」；显式「排队第二写见
  第一写 committed」用例未落地（SA2 N5 认可为增强、SA8 §7.4 记录、issue AC 未列）。FIFO 语义系既有
  已测行为（runtime-mutate-root-sequencer 等）且 guard 不改槽序、评估在槽内——静态推理后写必见前写
  committed；建议 SA6 回写轮采纳 E8 使该属性直接可观测（§11 已列）。
- **OBS-2（SA6 契约回写待办）**：S9/S10/S11、<1 KiB message 预算、T1 四负例、E8 可选项的契约表同步
  仍待 SA6 下一轮（SA3/SA8 已记录）；测试已按超集落地，两态可判别性不依赖该回写。
- **OBS-3（R1 消息尾残余）**：`未知信封键 "k"（批量信封只允许 "ops"）` 在顶层放行 guard 后语义略窄；
  为保 SA8 冻结面逐字节不变而保留（N2 钉住）。cosmetic follow-up，演进须与 #350 锚联动评审。
- **OBS-4（<1 KiB 预算未钉断言）**：设计 D8 承诺 message <1 KiB，测试仅按契约冻结上界断言 <64 KiB
  （M8）；SA3 手测 ≈300 字符。如需钉死可加 `toBeLessThan(1024)`——契约未冻结，不改判。
- **OBS-5（`issue.path` 新鲜性）**：契约 §12.0 以深度相等定义可观察口径，测试 toEqual 恰好如此；
  「非别名调用方数组」未单独断言（实现 `[...guard.path]` 两次拷贝，静态确认）。
- **OBS-6（`equals: undefined` 静态/运行时差异）**：类型面 `equals: unknown` 静态接纳 undefined、
  运行时 ⑤a 拒绝（S10）——SA2 N9 已接受（`unknown` 减 `undefined` 无干净写法；e2e 面 S3 先拒使差异
  对宿主不可达）。
- **OBS-7（空目录残留）**：`.scratch/issue-347/` 为空目录残留（内容已按 SA6 §16 删除；gitignored、
  无文件内容、不属实现面）。可在收口清理时移除。
- **OBS-8（exclusive-union 文本差异）**：`MutationGuard` 渲染与 ADR 0025 L23–27 snippet 存在
  `?: never` 文本差异——JSDoc（mutation.ts L71–77）与 SA8 报告双重留痕；可选 cosmetic ADR 注记
  follow-up（SA8 §7.2，非义务）。

## 13. 是否需要后续 ADR 冲突复查

**否**。SA8 implementation 复查（iteration=1）已对设计 §15 全部待核对决策面（新公共导出、新失败语义、
E1 键封闭演进、`MutationIssue.code` 载体、exclusive-union 收紧）逐项闭合并判 clear /
`requiresConflictRecheck: false`；本审查未发现其外的新的 ADR 冲突风险面（四点冻结面独立复核全保持，
DENY 零 diff），无需再次触发。
