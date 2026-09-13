# task_issue-347 SA2 设计攻击评审 — 条件写核心（guard I）

- 评审角色：SA2（mabf-sa2，iteration=0，design-review）
- 被评审对象：`wiki/raw/task_issue-347_design.md`（SA1 iteration=0；实现基线 `mabf/issue-347` @ `1b55d5c`，本评审期间 git HEAD 实测一致）
- 评审方法：独立攻击审查——对照 issue 正文 AC、SA6 契约、SA8 冲突报告/决策摘录与 **HEAD 源码逐条核验**设计事实锚点（不运行测试、不启动服务、不改任何生产/设计文件）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-347.md`（brief，issue #347，comments=[]） | 已读 |
| `wiki/raw/task_issue-347_design.md`（SA1 设计） | 已读，逐节攻击 |
| `wiki/raw/task_issue-347_sa6_contract.md`（SA6 验收契约） | 已读 |
| `wiki/raw/task_issue-347_relevant_decisions.md` / `…_conflict_report.md`（SA8） | 已读 |
| `docs/adr/0025-guarded-mutation-conditional-write.md`、`docs/adr/0026-atomic-mutation-envelope.md` | 已读，逐条对照 |
| `packages/doc-runtime/src/{mutation,read,index}.ts` | 已读（mutation.ts 全文 697 行） |
| `packages/doc-runtime/src/mutation-local.ts`（类型消费）、`packages/namespace-runtime/src/{write,diagnostic}.ts` | 关键段已读 |
| `packages/namespace-diagnostic-log/src/{schema,projection/issues}.ts` | 关键段已读 |
| `packages/doc-runtime/test/{public-surface-guard.test.ts, public-surface-type-guard.test-d.ts, issue-350-batch-envelope-red.test.ts}` | 已读（含 `expectShapeReject` helper） |
| `CONTEXT.md` 条件写/原子变更词条、`.agents/skills/nomicore/typed-access.md` guard 小节 | 已验证在位 |
| `tsconfig.base.json`（`exactOptionalPropertyTypes: true` L10）、git HEAD/branch | 已验证 |

## 2. Verdict

**approve** —— 无 BLOCKER、无 MAJOR。设计可以安全实施。

核心理由（均经源码独立复核，非转述 SA1）：

1. **源码事实全真**：设计 §2 的 12 条事实锚点逐条命中 HEAD（`parseMutationCore` specs L540–545 / 未知键 L549–550；批量 E1 L186–193；单操作 prepare 次序 L132→L134→L140；`MutationIssue` L38–41；`readLogicalValueAtPath(doc, path)` 签名与 `{ok:true,value}|{ok:false,code:'PATH_NOT_ALLOWED'}` 联合 read.ts L44–56；`logicalValuesEqual` L483–495；`index.ts` L20–28 零稳定码；写槽 S3/S5/R9 write.ts L139–146/L187/L205–209；`DiagnosticIssue.code?` schema.ts L139–146；投影 code 256B/message 4096B 截断 projection/issues.ts L164–173）。
2. **冻结面真实可保**：`expectShapeReject`（#350 测试 L104–110）只断言 `ok:false` + 逐字节零写入，不锁消息尾；`public-surface-guard.test.ts` 第三断言 regex `/^applyValidatedMutation$/`（L48–49）不受新常量影响；`public-surface-type-guard.test-d.ts` 既有断言在 D7 类型演进下逐一仍绿（见 §9 分析）；仓库内**无任何测试**冻结「单操作/批量顶层 guard=未知键」现状（grep 实测：guard 命中仅元素级 B6、类型负例 L85 与无关标识）——顶层放行不破坏任何既有锚。
3. **复用而非平行**：谓词完全复用 `readLogicalValueAtPath` + `logicalValuesEqual`（SA8 required action 4），码载体复用 `DiagnosticIssue.code?` 先例与 R9 `issues as DiagnosticIssue[]` 既有转型（write.ts L207），零新读取/相等/schema 通道。
4. **两态错误域可判别**：`code === MUTATION_GUARD_MISMATCH` ⟺ 可重试评估不满足；键缺席构造 ⟺ 不可重试形状错误；与 S3 层 `MUTATION_INPUT_NOT_PLAIN_DATA`（record 级 code）分工清晰，无歧义双载体。

## 3. 需求覆盖

| Requirement（issue 正文） | Design section | Assessment |
|---|---|---|
| 四操作信封可选单条件 guard，信封解析完成全部形状校验 | §5 D3/D4 | 覆盖：D4 检查表是 issue AC4 七项的超集（另加 guard 内未知键、`equals:undefined`、`{guard:undefined}` 三项裁定，均有回写请求 R2） |
| 评估在 prepare 阶段（解析后、分叉前、schema 校验前），对 committed 载体投影逻辑值断言 equals/absent | §5 D5/D6 | 覆盖：插入次序与 ADR 0025 L48–51 逐字对齐；谓词伪代码签名与 read.ts 实际签名一致（`(doc, path)`） |
| 不满足 → 零写入单 issue，稳定码 + `issue.path`=guard 路径 + 截断摘要 | §5 D5/D8 | 覆盖：path 为新鲜副本；消息预算 <1KiB（低于诊断 full 投影 4096B，保真零截断） |
| `MutationGuard` 类型与稳定码经公共入口导出 + 公共面审计同步 | §5 D1/D2/D9 | 覆盖（见 §12 N4 关于 `GuardedMutation` 审计锚的补充建议） |
| AC1 合法 guard 满足提交 | §12 AC1 行（G1–G9） | 覆盖 |
| AC2 equals 不满足（值不同/缺键吸收 undefined）单 issue + 码 + path + 零写入 | §12 AC2 行（M1–M5/M8/M10） | 覆盖（M9 归属见 N6） |
| AC3 absent 两态 | §12 AC3 行（G3/G6、M4） | 覆盖 |
| AC4 形状错误全家桶无码零写入不可重试 | §12 AC4 行（S1–S8） | 覆盖 |
| AC5 guard 先于 schema 校验（不满足+非法新值只报 guard） | §12 AC5 行（O1–O3） | 覆盖，含反证对照（O2/O3 证明 schema 管线仍可达） |
| AC6 无 guard 逐字节不变 + 带码结果联合透传 | §5 D3/D7、§11、§8 路线 3 | 覆盖 |
| AC7 两导出 + 审计 | §5 D9 | 覆盖 |
| AC8 批量顶层 guard（一次评估、批前 committed、先于逐 op、单 issue）；元素 guard=形状错误 | §5 D3.2/D3.3/D6、§12 AC8 行 | 覆盖（allowGuard=false 保元素冻结面） |
| AC9 根 typecheck + doc-runtime 测试 | §12 AC9 行 | 覆盖（运行入口与 SA6 §14 证据一致） |
| Blocked-by #350 | 设计头部（基线含 PR #354） | 已满足（git log 实测 `1b55d5c` = fix(#350)） |

目标/非目标无静默扩大：谓词词表演进、复制/wire、槽序、诊断 schema、实现与测试落地均明示为非目标（§1）。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无——REST `comments=[]`，brief §Comments、SA6 §2、SA8 §1、dispatch 日志四源一致） | — | 设计 §4 明示记录 | 无遗漏义务；任务要求完全来自 issue 正文 + ADR 0025/0026，设计据此推导 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA8 required action 1：四动词键集纳入可选 guard；元素解析核不加 | §5 D3.1（OPTIONAL_KEYS 旁路）/D3.2（allowGuard 参数） | 落实；无 guard 输入未知键消息逐字节保持（判定式仅增 `!OPTIONAL_KEYS.includes(k)` 一个析取支） |
| SA8 required action 2：评估插入点（单 op parse 后/分叉前；批量 E 校验后/P 循环前；纯读不进事务不改槽序） | §5 D6 | 落实；与 mutation.ts 现有次序（L132→L134→L140；L234→L239）精确嵌合，`transactGuarded` 之外 |
| SA8 required action 3：两导出经 src/index.ts + 审计同步 | §5 D9 | 落实（P4/T1；`GuardedMutation` 审计锚补充见 N4） |
| SA8 required action 4：复用投影读取 + 深相等，不新起第二套 | §5 D5 | 落实；伪代码调用的两个符号与真实签名/语义（含 D4 缺席吸收、PATH_NOT_ALLOWED 单通道、INV-R1/R9）核验一致 |
| SA8 required action 5 + 冻结面（N3/B6、诊断指纹、wire、写槽 R9、E2–E5） | §10 DENY LIST、§11 | 落实：schema-freeze.test.ts 在位；`diagValidation` 无顶层 code（diagnostic.ts L271–274 实测）；DENY 覆盖全部冻结文件 |
| SA8 分层备注：非有限数/undefined 值键经 mutateData 被 S3 先拒 | §6 表、§13 R2、S7 直打 + E6 绿负控 | 落实（copyFrozen L344–349/L429 实测：`非有限 number`、`键 "k" 值为 undefined`） |
| SA6 §12.11 六项 SA1/SA3 义务 | §5 D2（1）、D3（2）、D6（3）、D5（4）、D9（5）、§10（6） | 逐项落实 |
| SA6 §15 七项未决 | §5 D2/D4/D8 + §13 R2（回写请求） | 全部裁定并显式披露，无静默立法；两态可判别性未放弃 |
| SA8 §9 预置 design 冲突复查四点（E1 演进/元素维持/逐字节不变/R9 零改动） | 设计 §15 自评「需要」并逐点对应 | 一致；本评审未发现需要**额外**冲突复查的新风险面（见 §14 后注） |

## 6. 设计内部一致性

| 检查点 | 结果 |
|---|---|
| 正文/伪代码/接口/数据流/验收映射相互引用 | 一致（D2–D9 ↔ §8 路线 1–3 ↔ §12 行逐一对得上） |
| D5 伪代码 API 真实性 | `readLogicalValueAtPath(doc, path)` 签名、返回联合、TS 判别窄化（`!read.ok \|\| read.value === undefined`）全部成立 |
| D7 类型演进 vs 既有类型断言 | 逐一推演保持绿（详见 §9） |
| 无 guard 路径行为不变论证 | OPTIONAL_KEYS 只旁路 'guard'；missing/path/value 检查序不变；failIssue 构造无 code 键 ⇒ JSON 序列化同形 |
| 死引用/旧 API | 未发现指向不存在符号或旧签名 |
| **MINOR-1（见 N1）**：三处内部引用写「§14 R2 / §14 R3」，实际内容在 **§13**（风险与残余问题）——§5 D4、§12 AC4 行、§12 ADR-L90 行 | 交叉引用失准，不影响实施 |
| **MINOR-2（见 N2）**：D6「结构不可达边界记录」称「手造非 root derived + 不满足 guard → 评估返回 ok:false 而 E204 fatal 不触发」，与同一节明示的「root 检查保持在先」次序自相矛盾（按该次序 E204 必先于评估抛出） | 仅涉不可达路径的备案措辞，需改写以免 SA3/SA9 误读实际次序 |

## 7. 状态机与并发攻击

guard 无自身状态机（一次性纯读判定）；针对编排次序与并发的攻击如下，**未发现缺口**：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| C1 | committed 状态 S，单操作带 satisfied guard | `applyValidatedMutation` | 评估纯读 → 既有管线提交最小 edit；评估与提交之间同步无 yield | 无（prepareMutation 全同步；read INV-R9 零事件） | — |
| C2 | committed S，mismatch | 同上 | 返回前零 `transactGuarded` 调用 ⇒ 字节不变、0 changed afterTransaction、0 update | 无（D6 明示事务外评估；§9 失败诚实性） | — |
| C3 | 批量 `{ops,guard}`，guard 路径被批内 op 改写 | G9/M6b | 恰一次评估、读批前 committed；P 循环写在其后事务 | 无（D6 批量次序 E→G→P 与代码 L234–249 嵌合） | — |
| C4 | 同一 guard 信封重放（M9） | 前次 mismatch → 状态被他人改写 → 重放 | 纯数据确定性重评 ⇒ 可通过 | 无（§9 幂等） | — |
| C5 | 两写排队同一 FIFO 槽 | 后写 guard equals 前写已提交值 | 后写在本槽内见前写 committed（ADR 0025 L49/L90） | 设计承认无直接用例（R3/E8 为增强建议） | 非阻塞（见 N5）：FIFO 语义系既有已测行为，guard 不改槽序 |
| C6 | doc-runtime 直打无序列器并发 | 两个直接调用方交错 | 无原子性承诺（与现役全部 mutation 一致，非本任务引入） | 无（§9 明示边界） | — |
| C7 | 进程重启/迟到回调/后台任务 | — | 同步纯函数，无注册资源、无订阅、无持久化足迹（拒绝零 update ⇒ 无 dirty 登记） | 无 | — |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E-A | guard 形状错误族（非对象/非恰其一/缺 path/absent 非字面 true/段型错/`[]`/equals 含非有限数 + 三项新增裁定） | 信封解析期 fail-fast 单 issue、无码、path `[]`、零写入、不可重试（D4 全表） | 无；与 AC4/SA6 S 组逐例对齐 | — |
| E-B | 评估不满足 | 带码单 issue、path=guard 路径新鲜副本、有界消息、零事务零写入、可重试（D5/D8） | 无 | — |
| E-C | 循环引用 `equals`（直打 doc-runtime） | `containsNonFiniteNumber` 递归栈溢出 → 既有 catch 收编 E205 无码零写入（mutation.ts L160–170 实测存在该 catch） | 与 cyclic `set` value→`cloneJson` 抛错→E205 现役行为同构；e2e 面 S3 `循环引用` 先拒 | — |
| E-D | 敌意 getter/Proxy（直打） | parseGuard/summarize 读取面抛错 → E205；e2e 面 S3 四查先拒（accessor 零执行） | 与现役两层模式一致，不升格 fatal | — |
| E-E | `JSON.stringify` 抛错（如 `equals` 含 bigint/Date 原型对象） | D8 显式回退 `<不可序列化：${wordOf}>`；bigint/Date 经 D4「不含非有限数」放行后在评估期自然不相等 | 无伪成功；消息仍有界 | — |
| E-F | 读失败（PATH_NOT_ALLOWED / E100 崩溃边界） | equals → 不满足；absent → 满足（ADR 0025 L43 明文立法） | 这是 ADR 已接受的语义（不是设计缺陷）；read.ts 同步不抛错（INV-R1）保证两态确定性 | — |
| E-G | guard 满足 + 操作失败（schema 非法等） | 进入既有管线：单操作 fail-fast / 批量聚合全部 issues（无码）——O2/O3 对照 | 无伪降级；guard 不改变聚合语义 | — |
| E-H | 回滚 | git revert 两个 src 文件 + 删测试文件即恢复基线；可选键前向兼容 | 无数据/schema/wire 迁移 | — |

失败诚实性成立：mismatch 返回前无任何事务调用与事件（可被 AC2 零写入断言逐字节观察）；不存在以 fallback 掩盖缺失不变量的路径。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `applyValidatedMutation(derived, doc, mutation)` 签名 | 无——第三参本为 `ValidatedMutation \| unknown`（即 unknown，mutation.ts L97），guard 信封无需改签名 | 源码实测 | — |
| `MutationIssue` + 可选 `code?: string` | 无——加性可选键。消费方核验：mutation-local.ts 仅类型导入；namespace-runtime `DataMutationIssue` 名目独立（write.ts L74–77）；R9 `result.issues as DiagnosticIssue[]`（write.ts L207）与 `DiagnosticIssue.code?`（schema.ts L141）结构兼容；诊断投影 `isValidItem` 接受可选 string code、full 256B/redacted 保留（projection/issues.ts L87/L135/L156–173） | 源码实测 | — |
| `BatchedMutation`/`MutationEnvelope` 形状演进（`guard?`） | 无——既有类型断言逐一推演仍绿：L76 `ops` 仍 `readonly ValidatedMutation[]`；L77 元素类型不变；L78 `toMatchTypeOf<ValidatedMutation \| BatchedMutation>` 单向结构子类型成立（交集+可选键均为窄化）；L83/L85/L87 三个 `@ts-expect-error` 负例（双形态/元素 guard/字符串）全部仍编译错 | public-surface-type-guard.test-d.ts L74–91 逐条推演 | — |
| 公共面审计（值导出） | 无——第三断言 regex `/^applyValidatedMutation$/` 不匹配新常量；第二断言只 typeof 五项既有导出、无总数枚举 | public-surface-guard.test.ts L38–50 实测 | — |
| 写槽 S3/S5/R9、诊断、持久化 | 无——S3 深冻对 guard plain data 通过（NaN/undefined 先拒即 E6 分层）；R9 结构化透传；拒绝零 update ⇒ 无 notifyDirty | write.ts/diagnostic.ts 实测 | — |
| 复制/wire/`replaceSchema`/META | 无消费（guard 是本地信封键，不进 wire）；grep 无信封形状的 wire 侧消费者 | ADR 0025 L64–66 | — |
| `exactOptionalPropertyTypes: true` | 设计已声明并利用（`guard?: MutationGuard` 静态拒 `guard: undefined`；`code?: string` 禁显式 undefined）与 D4 ① 运行时裁定同向 | tsconfig.base.json L10 实测 | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| guard 形状校验 + 槽前评估 | doc-runtime（信封解析与 prepare 编排的 Owner） | `mutation.ts` 唯一实现文件 | ✅ |
| 原子性/时序 | namespace-runtime 写序列器（不动） | 零改动，靠 FIFO 既有语义 | ✅ 与 ADR 0025 L49 归属一致 |
| 码入诊断日志 | 诊断包投影（不动） | 复用 `DiagnosticIssue.code?` + R9 | ✅ 不给 `diagValidation` 加顶层 code（SA8 明令） |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 投影读取 | `readLogicalValueAtPath`（read.ts，公共导出） | 直接调用，零新语义 | 一致 | SA8 required action 4 |
| 结构深相等 | `logicalValuesEqual`（mutation.ts L483–495，服务 union 仲裁） | 直接调用 | 一致 | 同上；G7 三形态由此免费获得 |
| 稳定码载体 | `DiagnosticIssue.code?: string` + S3 层 `MUTATION_INPUT_NOT_PLAIN_DATA`（消息前缀+record 级码） | `MutationIssue.code?` + issue 条目级码 + 消息前缀 | 一致（分层分工不同但风格同源） | ADR 0025 L58/L60 两处落点各自对齐先例 |
| 信封键封闭 | 单一解析核 `parseMutationCore`（参数化 prefix） | 增第三参 `allowGuard`，不建第二解析器 | 一致 | 「唯一解析核」现状保持（D3 备选否决理由成立） |
| 可选信封键先例 | #350 批量形态（`ops` 键 + `{ops:undefined}` 走 E2） | `{guard:undefined}` 同款拒绝 | 一致 | D4 ① 裁定援引现役先例 |

未找到可比实现时已如实记录（如「doc-runtime 首个领域拒绝稳定码」——grep 实测 src 面零稳定码导出）。

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| `MUTATION_GUARD_MISMATCH` 常量值 | mutation.ts 单点定义，index.ts 再导出 | 测试经 `import * as ns` 断言同源（P2） | 无 |
| guard 可满足性 | committed Y.Doc 状态（评估时点） | 无缓存/镜像/第二状态字段 | 无 |
| 信封合法性 | parseMutationCore/parseGuard 单通道 | 无平行校验路径 | 无 |

### 生命周期对称性

无新增资源：评估是同步纯读，无 register/subscribe/acquire；mismatch 路径零事务零事件，无需清理。**对称性不适用且无悬挂面**。

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套读取/相等语义 | read.ts / logicalValuesEqual | 复用 | 无平行 |
| 第二套解析器 | parseMutationCore | 参数化扩展 | 无平行 |
| 第二套清理/重试/状态机 | — | 无 | 无平行 |
| 仅为单一 issue 的通用抽象 | — | parseGuard/evaluateGuard 等皆为 guard 专用最小函数 | 无过度抽象 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW 六路径与正文落点一一对应（两 src + 两新测试 + 两审计追加） | §5 决策全部落在 mutation.ts/index.ts；测试路径与 SA6 §12.1 冻结路径逐字一致 | 无 |
| 新测试文件收集面真实 | vitest include `packages/*/test/**/*.test.ts` 覆盖 `packages/doc-runtime/test/` 与 `packages/namespace-runtime/test/`（SA6 §14 已证；doc-runtime 现存 25 `.test.ts` + 2 `.test-d.ts` = 27 文件，与 SA6 §4 口径一致） | 无 |
| DENY 与正文无冲突：read.ts（谓词底座原样）、mutation-local.ts（评估点之后零感知）、#350 测试（只读锚）、namespace-runtime src/诊断包（零改动靠结构兼容达成） | 本评审逐文件核验上述「零改动」主张全部成立 | 无 |
| ADR/CONTEXT/typed-access 列 DENY 的理由（基线先行兑现） | 实测：ADR 0025 L58/L87、CONTEXT「条件写」词条、typed-access「Guarded mutations (ADR 0025)」小节均在位且语义与设计一致 | 无 |
| 无 ALLOW 无理由扩张；follow-up（R1 消息尾失真）不掩盖本任务必要项 | R1 是 SA8 冻结面强制保消息的必然残余，且 #350 锚不锁尾 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC8 全部映射到 SA6 冻结用例 ID（G/M/O/S/N/E/P/T） | §12 表逐行 | M9 未出现在 §12 AC2 行（沿袭 SA6 §12.10 自身映射；M9 在契约 §12.3 与设计 §9 均有定义与落点） | 非阻塞（N6）：建议映射行补记 M9 |
| 红灯敏感度（防伪绿） | S 组强制 `not.toMatch(/未知信封键\s*"guard"/)` + 合法 anchor；M 组强制 `code===稳定码`（旧实现无 code 必红）；G 组强制 `ok:true` 落盘 | 无——三组互为反证 | — |
| 行为观察而非源码文本 | 全部用例断言运行时结果联合/字节/update/事务计数 | 无 | — |
| 错误路径可红 | 形状族/不满足族/次序族/负控族分列 | 无 | — |
| 运行入口真实 | `pnpm typecheck`、`NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run …`、根 `pnpm test`（= vitest run --typecheck） | 无 | — |
| ADR 0025 L90 序列器竞争测试 | E2–E5（透传）+ G9/M6b（批前语义）；E8 为建议增强（R3） | 无直接「排队第二写见第一写 committed」用例 | 非阻塞（N5） |
| message 预算收紧回写 | 设计 <1KiB vs 契约 64KiB 上界；R2 已列回写请求 | 无 | — |

## 13. Required revisions

**无 BLOCKER / MAJOR finding。** 设计可进入实现准备（SA6 用例表回写 + SA3 实现轮次）。

## 14. Non-blocking observations

以下 MINOR 项不阻断实施；建议 SA1 在下一版设计（或 SA6 回写轮）顺手吸收：

- **N1（内部引用失准）**：§5 D4、§12 AC4 行、§12 ADR-L90 行三处「§14 R2 / §14 R3」应为「**§13** R2 / R3」（§14 是「评审修订映射」，R1–R5 位于 §13）。接受条件：交叉引用指向实际内容节。
- **N2（不可达边界备注自相矛盾）**：D6 末条称「手造非 root derived + 不满足 guard → 评估返回 ok:false 而 E204 fatal 不触发」，与同节「root 检查保持在先」次序矛盾（按该次序 E204 必先抛出）。建议改写为与选定次序一致的表述（或明示该备注针对的替代插入点不存在）。接受条件：正文不再含两种互斥次序描述。
- **N3（parseGuard 在解析核内的检查位次未钉死）**：D4 定义了 guard 内部确定性检查序，但未钉死 parseGuard 相对 op 自身字段检查（missing/path/value）的调用位置——`{op:'set', path:'x', value:2, guard:42}` 这类复合缺陷输入先报哪个消息未定义。SA6 S 组用例均以合法 op 承载，不影响验收；建议钉死（推荐：op 自身形状检查全部通过后再 parseGuard，使非 guard 缺陷消息保持既有优先级），避免 SA3/SA6 对消息次序产生分歧。
- **N4（`GuardedMutation` 导出的审计锚）**：doc-runtime AGENTS 要求「public-surface guard tests must account for every export」；D9 的 P4/T1 只点名 `MUTATION_GUARD_MISMATCH` 与 `MutationGuard`，同为新增导出的 `GuardedMutation` 无锚。建议 T1 追加 `GuardedMutation` 正例（含 `guard?: MutationGuard` 投影）与（可选）信封级正/负例。零边际成本（同文件已在改）。
- **N5（E8 序列器竞争用例）**：ADR 0025 L90 把「namespace-runtime 写槽透传与序列器竞争测试」列入验证门槛；设计 R3 将显式竞争用例（同槽队列两写、后写 guard equals 前写已提交值）列为增强。认可其论证（FIFO 语义系既有已测行为、guard 不改槽序、issue AC 未列），但建议 SA6 下一轮采纳 E8 以完整兑现 ADR 门槛——尤其 guard 的核心卖点是消灭 TOCTOU，一条直接用例能让该属性回归可观测。
- **N6（M9 映射记账）**：§12 AC2 行未列 M9（可重试语义）；SA6 §12.10 自身同样未映射。建议任一侧补记，防用例表落地时遗漏。
- **N7（实际值摘要成本）**：`summarizeLogicalValue(实际)` 对大子树是 O(投影子树) 的 `JSON.stringify`（截断发生在序列化之后）。深相等本就 O(n)，可接受；无需性能断言，仅提示 SA3 实现时保持「截断后置 + throw 回退」即可。
- **N8（R1 消息尾失真）**：`未知信封键 "k"（批量信封只允许 "ops"）` 在顶层放行 guard 后语义略窄——认可保消息的取舍（SA8 冻结面 + N4/B6 锚约束），已诚实记录为 cosmetic follow-up。
- **N9（`equals: undefined` 静态/运行时差异）**：联合类型 `equals: unknown` 静态接纳 `undefined`，运行时按 ⑤a 拒为形状错误。此为 SA6 §15 明文提请的裁量项，设计已给理由并回写（e2e 面 S3 先拒使该差异对宿主不可达）；接受，无需改型（`unknown` 减 `undefined` 无干净写法且收益为零）。

**关于 requiresConflictRecheck**：本评审未发现 SA8 冲突报告 §2/§4/§7 之外的新的 ADR 冲突面——设计触及的四个复查点（E1 键封闭演进、元素级 guard 维持拒绝、单操作无 guard 逐字节不变、写槽 R9 零改动）均已在 SA8 §9 预置的 design 冲突复查范围内，且本评审对四点全部给出独立源码级确认。故 SA2 不额外触发新的冲突复查；SA8 已排期的 design 复审照常执行即可。

## 15. 结论路由（供 Controller）

- verdict：**approve**（无 BLOCKER/MAJOR；N1–N9 为 MINOR 非阻断）。
- 建议后续：SA6 下一轮按设计 §13 R2 回写升级用例表（S9、equals:undefined、{guard:undefined}、<1KiB 预算、可选 E8、T1 补 `GuardedMutation` 锚）→ SA3 按 ALLOW LIST 实现 → SA8 design 冲突复审（按其 §9 四点）。
