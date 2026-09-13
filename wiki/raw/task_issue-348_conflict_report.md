# task_issue-348 冲突报告（SA8 前置门禁）

- Reviewed subject: **task**（`wiki/raw/task_issue-348.md`，issue #348「条件写语义矩阵补全：深相等、读失败路径、XML 与 set([])（guard II）」）
- 报告时间：2026-09-13；iteration 0
- 总控问题：条件写语义矩阵是否与 ADR 0025 及适用规范约束冲突、是否存在未满足前置

## 1. Inputs and decision set

- 输入：任务简报 `wiki/raw/task_issue-348.md`（含 issue 正文与验收标准）；issue 评论经 REST 读取：**无**（无 Owner 要求，故无任何 override 授权在册）。
- 决策集：`CONTEXT.md` 全部词条；`docs/adr/` 全集（0001–0026，除下述外均 accepted 且无被 superseded 者涉及本票；ADR 0007 的 open/read 条款被 ADR 0008 部分取代、其 validated mutation/零写入条款仍有效）；`docs/protocols/` 不涉本票（guard 是本地受控写信封语义，非 wire 面——CONTEXT.md「条件写」词条 Avoid 明示）；模块决策 `packages/doc-runtime/AGENTS.md`。
- 源码仅用于确认当前事实（见第 8 节与 relevant_decisions §9），不构成裁决依据。

## 2. Decision analysis

| Decision | Clause | Subject behavior | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| ADR 0025 | L42（equals 结构深相等、undefined 键过滤、比较对象为 `readLogicalValueAtPath` 投影逻辑值） | AC1 深相等细节（嵌套 plain object/array、`{a:1}` ≡ 显式 `a:undefined` 过滤后相等、`-0` ≡ `0`）与 AC6 大子树比较：把既有裁决落成可执行用例。`-0`/`0` 经结构深相等的严格相等语义自然成立，非新语义 | implements-existing-decision | `docs/adr/0025-guarded-mutation-conditional-write.md` L42；实现事实 `packages/doc-runtime/src/mutation.ts` L540–552、L711–715 | 无（按 ADR 0025 落测试；若暴露 #347 偏差以 ADR 0025 为准修正——任务简报明示） |
| ADR 0025 + ADR 0008 | 0025 L43（读失败或投影 `undefined` 均满足 absent）；0008 L23（缺键/越界成功返回 `undefined`、中间缺失立即结束） | AC2 读失败路径：穿越标量/非下钻终态 `PATH_NOT_ALLOWED` → equals 不满足 / absent 满足；中间容器缺失与数组越界按缺席吸收 | implements-existing-decision | `docs/adr/0025-…` L43–44；`docs/adr/0008-…` L23；实现事实 `mutation.ts` L713–715、`read.ts` L26–27/L46 | 无 |
| ADR 0025 + ADR 0008 | 0025 L44（穿越 XML 不可下钻终态 → 读失败两态；指向 XML 终点 → 与其投影值比较）；0008 L26（XML 终态返回语义字符串） | AC3 guard 路径穿越 XML / 指向 XML 终点两形态用例 | implements-existing-decision | `docs/adr/0025-…` L44；`docs/adr/0008-…` L26；实现事实 `read.ts` L106–107、L351–352 | 无 |
| ADR 0025 + ADR 0007 | 0025 L44（guard 路径段纪律同 mutation path：string=键、number=数组下标）；0007 L29（路径统一 `readonly (string\|number)[]`） | AC4 数组下标段（number）按数组位置读取、段纪律与 mutation path 一致 | implements-existing-decision | `docs/adr/0025-…` L44；`docs/adr/0007-…` L29；实现事实 `mutation.ts` L673–677 | 无 |
| ADR 0025 + ADR 0007(#237 修订节条款 3) | 0025 L48（评估在解析后、局部/legacy 分叉前；`set([])` legacy 管线同样生效）；0007 L93–96（`set([])` 唯一全量形态走完整清空重装） | AC5 `set([])` legacy 全量替换先过 guard：不满足零写入、满足正常走 legacy 管线 | implements-existing-decision | `docs/adr/0025-…` L48；`docs/adr/0007-…` L93–96；实现事实 `mutation.ts` L173–188（guard 在 L175–178，分叉在 L182） | 无 |
| ADR 0025 + ADR 0026 | 0025 L72–74（guard 适用于双形态顶层、批内元素不得携带、批量下次序不变）；0026 L29、L53–55 | AC7 `{ ops, guard }` 顶层 guard 评估语义与单操作一致 | implements-existing-decision | `docs/adr/0025-…` L72–74；`docs/adr/0026-atomic-mutation-envelope.md` L29、L53–55；实现事实 `mutation.ts` L228–291 | 无 |
| ADR 0025 | L53–58（错误域两态：形状错误无码不可重试；不满足 `MUTATION_GUARD_MISMATCH` 单 issue、`issue.path`=guard 条件路径、message 截断摘要、可重试） | 矩阵用例须锚定两态错误域现值，不改动其形状 | no-conflict | `docs/adr/0025-…` L53–58；实现事实 `mutation.ts` L644–683、L720–729 | 无（矩阵属测试锚定，非语义变更） |
| ADR 0025 | L94 开放问题 1（谓词词表封闭：`exists`/数字比较/`neq`/多条件/放开 `[]` 须过设计评审） | #348 验收项全部落在 `equals`/`absent` 二词表与既有段纪律内，未请求词表演进 | no-conflict | `docs/adr/0025-…` L94、L21–27 | 无 |
| ADR 0025 + ADR 0002 | 0025 L68–70（不 supersede；谓词无领域词表）；0002 L3（authority 规则完全出范围） | 语义矩阵不含状态机/单调性等领域断言，仅谓词边界 | no-conflict | `docs/adr/0025-…` L68–70；`docs/adr/0002-…` L3 | 无 |
| ADR 0008 | L18、L40–51、L109（读写边界、单 FIFO 序列器、`readLogicalValueAtPath` schema-independent）；0025 L49–51（原子性归序列器、guard 纯读不进事务、先于 schema 校验） | 矩阵用例构造不得把 guard 评估挪进事务或改变槽内次序；用例经 `applyValidatedMutation` 公共入口即可保持该面 | no-conflict | `docs/adr/0008-…` L18、L40–51、L109；`docs/adr/0025-…` L49–51 | 无 |
| ADR 0016 | L74（doc-runtime 不动、读取 schema 无关、投影属 readData 附加） | guard 比较用载体投影读取，不涉语义 schema 投影 | no-conflict | `docs/adr/0016-readdata-semantic-schema-projection.md` L74 | 无 |
| CONTEXT.md | L120–122「条件写」、L85–87「载体投影读取」、L113–114「零写入」、L116–118「原子变更」 | 验收项措辞与词条一致（可选前置条件、双形态顶层、缺席吸收、零写入、批量互斥同拒） | no-conflict | `CONTEXT.md` L85–87、L113–118、L120–122 | 无 |
| packages/doc-runtime/AGENTS.md | Boundaries（公共 API 只经 `src/index.ts`、public-surface 测试覆盖每一导出、验证失败零写入）+ Verification（doc-runtime 测试；契约变化时根 `pnpm typecheck` + `pnpm test`） | AC8 按 doc-runtime 既有 mutation 测试组织方式落位 + 根 `pnpm typecheck` + doc-runtime 测试通过 | implements-existing-decision | `packages/doc-runtime/AGENTS.md`；ADR 0025 L87、L90；实现事实 `packages/doc-runtime/test/`（`apply-validated-mutation-operations.test.ts`、`issue-347-guard-envelope-red.test.ts` 等既有组织）、`public-surface-guard.test.ts` L55–59 | 无（注：AC8 门槛为 ADR 0025 L90 落地门槛的 doc-runtime 子集——L90 的 namespace-runtime 面已由 #347 闭环（`packages/namespace-runtime/test/issue-347-guard-passthrough-red.test.ts` 在册）；若 #348 修正实现改变了 mutation/read 契约，则按 AGENTS.md 须补根 `pnpm test`） |

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| （无） | （无——issue 评论为空，无 Owner 覆盖；亦无需 override） | — | — |

## 4. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| 稳定码字面量 `MUTATION_GUARD_MISMATCH` | 字面量与语义（零写入单 issue、可重试 CAS 拒绝）不变；矩阵只锚定 | ADR 0025 L58；`mutation.ts` L60–62、L728 | #348 未请求变更；无冲突 |
| 不满足 issue 形态 | `issue.path` = guard 条件路径；message 含期望/实际有界摘要（截断防爆）；单 issue 不聚合 | ADR 0025 L58；`mutation.ts` L720–729、L731–737 | 同上 |
| guard 形状错误族 | 无码信封校验拒绝、零写入、不可重试；全表含 `path` 为 `[]` 与 `equals` 含非有限数 | ADR 0025 L57；`mutation.ts` L644–683 | 同上 |
| 谓词词表 | 恰 `equals`/`absent` 二谓词、guard 路径禁 `[]`、批内元素禁 guard | ADR 0025 L44、L94；ADR 0026 L29 | 同上 |
| 单操作无 guard 契约 | 无 guard 信封行为逐字节不变（含消息优先级） | ADR 0026 L65；ADR 0025 L86；`mutation.ts` L162–169、L594、L636–638 | 同上 |
| doc-runtime 公共面导出集 | `MutationGuard`/`GuardedMutation`/`BatchedMutation`/`MutationEnvelope`/`MUTATION_GUARD_MISMATCH` 经 `src/index.ts`；public-surface 审计覆盖每一导出 | ADR 0025 L87；`packages/doc-runtime/AGENTS.md`；`index.ts` L23、L28–31 | 同上 |
| 评估位置与次序 | prepare 阶段、解析后、局部/legacy 分叉前、先于 schema 校验、纯读不进事务；批量下顶层恰一次先于逐操作 prepare | ADR 0025 L48–51、L74 | 同上 |
| `set([])` 管线归属 | 唯一全量形态继续走完整 ROOT 清空重装（不因 guard 改道） | ADR 0007 L93–96；ADR 0025 L48 | 同上 |

## 5. Evolution requirements

无。全部对照项为 no-conflict 或 implements-existing-decision；#348 不改变任何契约、不新增决策面（无 wire/schema/持久化/状态机/生命周期/失败语义演进，无词表扩容）。

## 6. Hard conflicts

无。

## 7. Prerequisite（总控问题之二）

- **#348 声明 Blocked by #347**：已满足——本 worktree `git log` 61e2daa「fix(#347): 条件写核心：doc-runtime 信封解析、槽前评估与 MUTATION_GUARD_MISMATCH（guard I）」已落地（含 doc-runtime red 测试、namespace-runtime 写槽透传 red 测试、public-surface 值导出审计）。
- **AC7（批量形态 guard）传递性前置 ADR 0026 批量信封**：已满足——1b55d5c「fix(#350)」先行落地，符合 ADR 0025 L74 / ADR 0026 L55 的实现票序（0026 先行、0025 双形态随后，由 #347 承载）。
- 结论：**无未满足前置**；guard 语义矩阵的全部落点（信封、评估、错误域、双形态）已在库中存在，#348 是对这些面的测试锚定与 ADR 对齐修正。

## 8. Required actions

1. 无阻塞动作；可继续派发（SA1 设计/后续 SA 流程照常）。
2. （非阻塞提醒）若语义矩阵暴露 #347 实现偏差而修正实现：修正必须收敛于 ADR 0025 冻结面（第 4 节）；若任何修正实际改动了冻结面所列形态（稳定码字面量、issue 形态、形状错误族、评估位置/次序、单操作无 guard 逐字节契约、公共导出集），即构成新决策面，须回到 SA8 复核。
3. （非阻塞提醒）实现修正若触及 mutation/read 契约，按 `packages/doc-runtime/AGENTS.md` Verification 须跑根 `pnpm test`（AC8 只列 typecheck + doc-runtime 测试）。

## 9. Verdict

**clear** —— 全部对照项为 no-conflict 或 implements-existing-decision；无 evolution-required、无 hard-conflict、无需 override；前置（#347 及传递性 #350/ADR 0026）均已在当前 worktree 满足。

## 10. requiresConflictRecheck

**false** —— 纯既有决策兑现（测试锚定已落地的 ADR 0025 语义），无公共 API/wire/schema/持久化/状态机/生命周期/失败语义或正式 override 尚待实现核对；唯一条件性再核入口见第 8 节第 2 条（修正触碰冻结面时另起，不属本票既定面）。
