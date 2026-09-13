# SA10 Spec Review — issue #347 条件写核心（doc-runtime 信封解析、槽前评估与 `MUTATION_GUARD_MISMATCH`，guard I）

- 审查角色：SA10（mabf-sa10，iteration=0，spec-review，one-shot dispatch sa-25c71c3f）
- 被审对象：最终已提交 diff `1b55d5c..HEAD`（`47e164b` feat(doc-runtime): add guarded mutation support +
  `4fd5f51` chore: record final review dispatch——后者仅动 wiki dispatch 一行，代码面与 SA3/SA4/SA8 审过的
  工作区完全一致）
- Parent PR #346 authoritative head：`1b55d5c431982a9672b0c162b64f8366089c7654`，经 `git merge-base
  --is-ancestor` 实证为被审提交的祖先 ✓
- Owner 评论：无（REST `comments=[]`；brief/SA6/SA8/SA3/SA4 五源一致）——验收契约 = issue 正文
  AC1–AC10 + ADR 0025（含 0026 组合节）+ SA6 冻结契约 §12
- 审查方法：独立核读 Issue 正文、ADR 0025/0026、SA6 契约、SA1 设计（D1–D9）、SA3/SA4/SA8 产物；
  逐行核读 `git diff 1b55d5c..HEAD` 全部代码与测试改动；`git diff --name-only` 与定向 diff 独立实证
  文件范围；按 SA10 纪律不运行测试（AC10 以 SA3 V5/V7/V8 运行证据 + SA4 静态一致性核验 + 提交后
  工作区代码面零漂移为据）

## Verdict: **approve**

Issue 全部 10 条 AC 逐条核验为满足；文件范围恰为设计 ALLOW 六路径 + wiki 产物，DENY 面（namespace-runtime
src、诊断包、read.ts、mutation-local.ts、ADR/CONTEXT/wire）经独立 `git diff` 实证零改动；无 scope
creep。下述披露项全部为已评审记录的设计裁定/延期项，属 MINOR，不阻断 approve。

## AC 逐条核验

| AC | 要求 | 实现证据（独立核读） | 判定 |
|---|---|---|---|
| AC1 | 合法 guard 且满足的 set/delete/array-insert/array-delete 正常提交落盘 | `parseMutationCore` 第三参 `allowGuard=true`（单操作顶层，`mutation.ts` L586/L594/L609）；`prepareMutation` 在 parse 成功、分叉前评估（L175–178）；G1–G5 测试断言 `ok:true`、值落盘、恰 1 事务 1 update（`issue-347-guard-envelope-red.test.ts` L204–274） | ✅ met |
| AC2 | equals 不满足 → `ok:false` 单 issue + 稳定码 `MUTATION_GUARD_MISMATCH` + `issue.path`=guard 路径 + 零写入 | `mismatchIssue`（L722–730）：`code: MUTATION_GUARD_MISMATCH`、`path: [...guard.path]` 新鲜副本、message 含期望/实际有界摘要；`expectGuardMismatch`（test L131–148）钉单 issue/码/同源导出/path 深等/字节不变/0 事务 0 update；M1–M3/M5/M8/M10 全组（缺键吸收、PATH_NOT_ALLOWED、1 MiB 截断 <64 KiB、非子集不满足） | ✅ met |
| AC3 | absent 满足（缺键）→ 提交；不满足（键有值）→ 零写入拒绝带码 | `evaluateGuard` absent 分支 `!read.ok \|\| read.value === undefined`（L716）——读失败与缺键吸收两满足源，与 ADR 0025 L43 逐字一致；G3/G6（缺键/标量穿越/number 段落 Y.Map）与 M4（键有值 + 缺席语义标记） | ✅ met |
| AC4 | 形状错误全家桶零写入拒绝且不带码（不可重试）：非对象/非恰其一/缺 path/absent 非字面 true/段型错/`[]`/equals 含非有限数 | `parseGuard` 确定性检查序 ①–⑥d（L648–682）逐族覆盖；`containsNonFiniteNumber` 任意深度（L687–693）；`failIssue` 构造无 `code` 键（L865–867）；S1–S8 断言 `code===undefined`、零写入、message 不匹配 `/未知信封键\s*"guard"/`，S0 anchor 防与能力缺失同义反复 | ✅ met |
| AC5 | guard 评估先于 schema 校验；新值非法 + guard 不满足时只报 guard | 单操作：评估（L175–178）先于 `isRootReplace` 分叉（L182），schema 校验在两管线内部；批量：G（L289–292）先于 P 循环（L296）；O1（无「类型不匹配」）+ O2/O3 反向对照（guard 满足后 schema 管线可达、聚合语义不变） | ✅ met |
| AC6 | 无 guard 既有调用行为逐字节不变；带 guard 信封在公共面结果联合正确透传 | 未知键判定仅增析取支 `!(allowGuard && k==='guard')`（L609）；批量 E1 过滤式放行（L230）；N1–N4 负控钉无 guard 四动词/批量/`set([])`/`zzz` 文案与零写入；e2e E1–E5 经 `mutateData` 透传（R9 零改动，`write.ts` 无 diff）；S3 分层负控 E6 保持 | ✅ met |
| AC7 | `MutationGuard` 类型与 `MUTATION_GUARD_MISMATCH` 从公共入口导出；公共面审计测试同步 | `index.ts` diff：值导出 `MUTATION_GUARD_MISMATCH` + 类型导出 `MutationGuard`/`GuardedMutation`（头注同步）；P4 追加（`public-surface-guard.test.ts` L55–61，存在性+字符串型+冻结字面量）；T1a/b/c 追加（正例+path 投影+四条 `@ts-expect-error` 负例+`GuardedMutation` 锚） | ✅ met |
| AC8 | 批量顶层 `{ops, guard}`：评估一次、先于逐操作 prepare；不满足整体零写入单 issue | `prepareBatchMutation`：E1 放行 guard → E2–E5 既有 → E6 `parseGuard`（L276–282）→ root fatal 位保持 → G 评估恰一次（L289–292）→ P 循环；G8（整批单事务原子）、G9（读批前 committed）、M6（恰 1 issue 无聚合）、M6b（批后意图值反向对照）、E4/E5（e2e） | ✅ met |
| AC9 | 批量元素携带 `guard` = 形状错误（无码、不可重试） | 元素循环 `parseMutationCore(ops[i], prefix, false)`（L252）——封闭键集天然排除；`BatchedMutation.ops` 元素类型 `ValidatedMutation` 不动（静态 TS2353 双层）；N3/E7 + #350 B6 冻结锚（SA3 V5 既有 402 用例零回归） | ✅ met |
| AC10 | 根 `pnpm typecheck` 与 doc-runtime 相关测试通过 | SA3 运行证据：V5 doc-runtime 28 文件/447 用例绿、V7 根 typecheck exit 0、V8 根 `pnpm test` 349 文件/3686 用例 exit 0；SA4 静态一致性核验通过；最终提交 `4fd5f51` 仅动 wiki，代码面与被验工作区逐字节一致（`git status` 实证仅 brief 未跟踪）。SA10 按纪律不复跑 | ✅ met（证据采信） |

## ADR 0025 规范符合性抽查（关键条款）

- L21–27 信封形态：`MutationGuard` 两成员判别联合、`path` 段纪律、`[]` 拒绝——兑现（类型面渲染差异见披露项 D-1）。
- L42–44 谓词语义：`equals` = `readLogicalValueAtPath` 投影 ⊗ `logicalValuesEqual`（undefined 键过滤深相等，复用既有底座零第二套语义）；`absent` 两满足源；XML 终态穿越 → 读失败路径——逐条兑现。
- L48–51 评估位置与原子性：prepare 阶段、解析后分叉前、先于 schema 校验、纯读零写入零事件、调用点均在 `transactGuarded` 之外（FIFO 归属不变）——兑现。
- L53–58 两态错误域：形状族无码 fail-fast；评估不满足单 issue + 稳定码 + guard 路径 + 期望/实际截断摘要（单侧 ≤256 字符，实测 M8 ≈300 字符 <1 KiB ≪ 诊断 4096B 预算）——兑现。
- L60 诊断收益：E3/E5 断言 stage=validation、result=rejected、record 级 `code===undefined`、码落 `issues.items[].code`；namespace-runtime 与诊断包零 diff（独立实证）——兑现。
- L72–74（0026 组合节）：双形态顶层 guard、元素永禁、批量评估先于逐 op prepare——兑现。
- L64–66 边界：复制/wire/replaceSchema/META 零改动零断言——兑现。
- L86 旧调用方不受影响：可选键旁路、消息逐字节不变——兑现。

## 文件范围与 scope creep 审查

`git diff --name-only 1b55d5c..HEAD`（独立实测）：`packages/doc-runtime/src/{mutation,index}.ts`、
`packages/doc-runtime/test/{issue-347-guard-envelope-red,public-surface-guard,public-surface-type-guard.test-d}`、
`packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` + wiki 产物——恰为设计 §10 ALLOW
六路径。DENY 面（`packages/namespace-runtime/src/**`、`packages/namespace-diagnostic-log/**`、`read.ts`、
`mutation-local.ts`、docs/ADR、CONTEXT.md、wire/复制、配置/lockfile）定向 diff 全空（独立实测）。
**无 scope creep。**

## PR 必须披露的未达成/偏离项（全部已在上游产物留痕；均为 MINOR）

- **D-1（类型面渲染偏离，SA8 no-conflict 闭合）**：`MutationGuard` 采用 exclusive-union `?: never`
  渲染（`mutation.ts` L78–81），与 ADR 0025 L23–27 snippet 字面联合存在文本差异。动因：字面联合静态
  接纳 `{equals, absent}` 同现（设计 D1 原声称可拒系事实错误）；收紧后合法值集合不变、与运行时
  `parseGuard` 拒绝面一致（fail-closed 方向）。SA8 编译探针（A1/A2/B1–B9）+ SA4 独立 TS 推演双重确认。
  可选 cosmetic follow-up：ADR snippet 注记（非义务）。
- **D-2（设计裁定超 ADR 枚举，契约回写待办）**：S9（guard 内未知键）/S10（`equals: undefined`）/
  S11（`{guard: undefined}`）三项形状错误裁定为 SA1 D4 裁量 + SA2 approve，超出 SA6 冻结契约表
  （其 §15 未决项），实现按超集落地且未弱化任何契约断言；SA6 契约回写（含 <1 KiB message 预算、
  T1 四负例）待下一轮同步——测试已按超集绿，两态可判别性不依赖该回写。
- **D-3（延期项：E8 序列器竞争显式用例）**：ADR 0025 L90 验证门槛提及「序列器竞争测试」；显式
  「同槽排队后写见前写 committed」用例未落地（SA2 N5/SA8 §7.4/SA4 OBS-1 一致记为 deferred，
  **非 issue #347 AC**）。静态依据：guard 评估在写槽内、槽序零改动、FIFO 语义为既有已测行为；
  G9/M6b 已覆盖「读批前 committed」同型语义。建议 SA6/SA7 后续轮落地为可直接观测用例。
- **D-4（R1 残余，保冻结面取舍）**：批量顶层未知键消息尾「只允许 "ops"」在 guard 放行后语义略窄；
  为保无 guard 消息逐字节不变（SA8 冻结面 + N2 钉住）而保留；演进须与 #350 冻结锚联动评审。
- **D-5（琐事）**：`.scratch/issue-347/` 空目录残留（gitignored、无内容、不属实现面）。

## 结论

当前实现忠实满足 issue #347 正文全部验收条目、ADR 0025（含 0026 组合节）与 SA6 冻结验收契约；
无遗漏、无部分实现、无错误实现、无 scope creep。全部披露项（D-1～D-5）均为已评审闭合或记录在案的
MINOR 项。**verdict: approve**。
