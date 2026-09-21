# SA3 Implementation Report

- Issue：#419「路由键契约 codec 守卫测试（spec #415 T1）」
- Dispatch：`sa-c6ed4ec2-4463-4843-aed9-22775471dd9a`（mabf-sa3，phase implementation，iteration 0）
- worktree：`/home/wangjian/nomicore-fix-issue-419`，HEAD `27e012b`
- 结论：实现完成，规定验证全过——守卫文件 19 用例全绿、包全量 14 文件/233 测试全绿 + 0 类型错误、
  包 tsc exit 0、RK-C6 变异矩阵两轮 6/6 expected、`git diff -- packages/replication-protocol/src` 为空。
  无阻塞、无未收敛偏差（3 条已登记偏差均为 SA2 非阻断观察的采纳 / 加固，见 §8）。

## Inputs consumed

| 输入 | 状态 | 本轮用途 |
|---|---|---|
| `wiki/raw/task_issue-419.md`（Host 简报） | 存在，亲读 | Issue 正文 AC1–AC5、「纯增量测试，零行为变化」 |
| `wiki/raw/task_issue-419_sa6_contract.md`（已批准契约） | 存在，亲读 | RK-C1–C7 / 计数契约 / §12.0 门禁五条 / SD-1 两案 |
| `wiki/raw/task_issue-419_design.md`（SA1 设计） | 存在，亲读 | §8 守卫详案（G1–G6）、§8.0 登记块、§7.2 SD-1B、§11 ALLOW/DENY、§12 门禁 |
| `wiki/raw/task_issue-419_sa2_review.md` | 存在，亲读 | verdict approve；无 BLOCKER/MAJOR；非阻断观察 O1–O4 |
| `wiki/raw/task_issue-419_design_conflict_report.md`（SA8） | 存在，亲读 | verdict **clear**、`requiresConflictRecheck=false`、Required actions 1–4（R1 实现票范围、R2 R3 头注） |
| `wiki/raw/task_issue-419_sa6_route_key_probe.mts` | 存在，亲读 | P1–P4/NC1–NC3 断言面种子（设计 §8.8 映射基准） |
| `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts` | 存在，亲读 | RK-C6 门禁命令与 6 变异锚点 |
| `artifacts/sa6-issue419-*.log` ×5 | 存在，亲读 | 基线：13 文件/214 测试、tsc exit 0、探针 7/7、变异两轮 6/6 |
| Issue 评论 REST 快照 | **空（`[]`）**（dispatch 明示；SA6 §2 同证） | 无 Owner 评论要求、无评论 ID/时间戳可落实 |
| 规范文本 | 亲读 | `docs/adr/0032-transport-decoupling-edge-session-split.md` §4；`docs/protocols/instance-replication-v1.md` §1/§3/§4/§5/§10.3/§13/§22 |
| 源码与测试 | 亲读 | `packages/replication-protocol/{src/index.ts,src/constants.ts,src/messages.ts,src/errors.ts,src/payloads.ts,src/limits.ts}`、`test/fixtures.ts`、`test/codec-envelope.test.ts`、`test/codec-messages-golden.test.ts`、`test/codec-package-contract.test.ts`、`test/codec-issue299-ac-red.test.ts`、`packages/replication-protocol/{AGENTS.md,tsconfig.json}`、`vitest.config.ts`、`tsconfig.base.json` |

## Existing worktree reconciliation

- 本票此前**无** `wiki/raw/task_issue-419_sa3_impl.md`、**无**未提交实现（`git status --porcelain` 起始仅
  Host 简报 + SA6 只读资产，与 SA6 §16 收尾一致）——本轮为首次产出，无待修订的旧实现需要保留/删除。
- 交付文件 `packages/replication-protocol/test/codec-route-key-guard.test.ts` 由 SA6 发现性占位后删除，
  SA6 §16 明示「该路径留给实现票」——本轮首次落地为正式守卫，非覆盖既有半成品。
- 一次性 scratch 诊断（`.scratch/sa3-419/`，补充变异证据用）运行后已整目录删除；
  `.scratch/` 现仅剩仓内既有 `vfsl-v1-parser`（`ls` 亲证）。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/replication-protocol/test/codec-route-key-guard.test.ts` | §8.0–§8.7（+§7.3 六组结构、§7.4 失败语义、§7.5 证据笔误修正、§13-R3 头注） | **新建**，743 行：模块级布局事实登记块 + 独立最小读取器（`readVarUint`/`readVarString`/`walkError`）+ 6 个 describe 组 / 19 用例（G1 4、G2 2、G3 4、G4 5、G5 1、G6 3） |
| `artifacts/sa3-issue419-package-suite.log` | §12 门禁 1（AC5） | 新增证据日志：包全量 `--typecheck` 输出 |
| `artifacts/sa3-issue419-scope-and-tsc.log` | §12 门禁 2 + 门禁 4 | 新增证据日志：包 tsc exit 0、`git diff --stat -- src` 为空、`git status` |
| `artifacts/sa3-issue419-mutation-rerun.log` | §12 门禁 5（RK-C6） | 新增证据日志：SA6 变异驱动两轮 6/6 expected |
| `artifacts/sa3-issue419-guard-mutation-evidence.log` | §8.8 映射表加固（补充） | 新增证据日志：守卫文件自身跑在 6 个变异 codec 副本上的结果（含首轮原始输出） |
| `artifacts/sa3-issue419-targeted-repeat.log` | §12 门禁 1 前置 + §9 确定性 | 新增证据日志：目标文件 ×2 运行 + SA6 只读资产 sha256 完整性核对 |
| `wiki/raw/task_issue-419_sa3_impl.md` | 技能固定产物 | 本报告（原位新建） |

`src/`、`test/fixtures.ts`、既有 13 个 `*.test.ts`、`*.test-d.ts`、wire/协议文档、ADR、`CONTEXT.md`、
`packages/ws-replication/**`、`vitest.config.ts`、`package.json`、`tsconfig*.json`：**零改动**（见 §6 核对）。

## SA2 Finding 落实

SA2 verdict = **approve**，§13「Required revisions：无（无 BLOCKER / 无 MAJOR finding）」——无阻断项待落实。
§14 的 4 条非阻断观察逐条处置：

| Finding ID | Implementation | Result |
|---|---|---|
| O1（import 面精确性：`NAMESPACE_ID_RE` 不在公共 API 面，不得深导入 `../src`） | 守卫 import 面仅 `@nomicore/replication-protocol`（`CAP_CHUNKED_UPDATE`/`ENVELOPE_HEADER_BYTES`/`MESSAGE_REGISTRY`/`NAMESPACE_ERRORS`/`ProtocolError`/`decodeMessage`/`encodeMessage`/`lookupError` + 5 个类型）与 `./fixtures`（`GOLDEN`/`NS`/`RID`/`bytesToHex`/`hexToBytes`/`type GoldenFixture`）；零 `../src` 深导入、零 `NAMESPACE_ID_RE` 引用 | 符合（接受条件满足；tsc exit 0 亲证） |
| O2（最坏 ERROR 用例的 code 建议动态推导） | G4-d 用 `Object.keys(NAMESPACE_ERRORS).reduce((a,b) => b.length > a.length ? b : a)` 动态取当前最长码（现解析为 35B 的 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`），公式 `1 + NS_PREFIX_BYTES + longestCode.length + 1 + 1 + 1 + 5 + 1` 逐项核对 | **采纳**（R4 预算红仍由 `≤ ERROR_NS_PREFIX_BUDGET` 承载） |
| O3（fatal=false 的 wire 位形态样本，可选） | G4-a 增加 `ns/fatal-false` 样本（`ACK_TIMEOUT`，唯一 `fatal=false` 码 → wire `fatal=0`）；G4-b 计数随之 = 3 | **采纳**（四象限判别集合仍以 4 元素断言锁定，样本不计入象限集合） |
| O4（grammar 拒绝方向，可选） | G1-d：34 / 36 字符 namespaceId 经 `encodeMessage` → `ProtocolError('MALFORMED_FRAME')`（`expectMalformed`） | **采纳**（把「恒 35」前提由单向接受扩展为双向锁定） |
| SA8 Required action 1（实现票范围/R1） | 单一新文件；`src/`、`fixtures.ts`、文档零改动；门禁 1–5 全过 | 满足 |
| SA8 Required action 2（R3 头注维护契约） | 守卫文件头注含：「消息注册表与错误注册表 append-only。新增 namespace-scope 消息型 = 必须显式裁决『落 [21..56) 固定偏移』还是『登记为例外』；新增错误码 = 必须复核 ERROR mini-decode 预算（≤ 64 字节）……这是**有意识的契约修订信号**，不是测试脆弱」 | 满足 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/replication-protocol/test/codec-route-key-guard.test.ts` | 设计 §11 ALLOW LIST 唯一一行（新建，唯一交付文件） | AC1–AC4 守卫本体；§8 全案 |
| `artifacts/sa3-issue419-package-suite.log` | DENY 未覆盖（DENY 仅列 `artifacts/sa6-issue419-*.log` 为只读输入） | AC5/门禁 1 原始证据 |
| `artifacts/sa3-issue419-scope-and-tsc.log` | 同上 | 门禁 2（tsc）与门禁 4（零行为面）原始证据 |
| `artifacts/sa3-issue419-mutation-rerun.log` | 同上 | 门禁 5（RK-C6）两轮原始证据 |
| `artifacts/sa3-issue419-guard-mutation-evidence.log` | 同上 | §8.8「守卫 ⊇ 探针」映射的可执行加固证据（补充，非门禁替代） |
| `artifacts/sa3-issue419-targeted-repeat.log` | 同上 | 发现性/确定性 + SA6 只读资产完整性证据 |
| `wiki/raw/task_issue-419_sa3_impl.md` | 技能固定产物路径（非 DENY 项；DENY 仅钉 `wiki/raw/task_issue-419*.md|.mts` 的**既有 Host/SA6 输入**为只读） | 本报告 |

DENY LIST 逐项复核（全部未触碰）：

- `packages/replication-protocol/src/**`：`git diff --stat` 空输出（门禁 4）。
- `test/fixtures.ts` 与既有 13 个测试文件：未出现在 `git status` 变更集中（均为已跟踪文件、无 modification 条目）。
- `docs/protocols/instance-replication-v1.md`、`docs/adr/0032-*.md`、`CONTEXT.md`、`packages/ws-replication/**`、
  `vitest.config.ts`、根/包 `package.json`、`tsconfig*.json`：零改动。
- `wiki/raw/task_issue-419*.md|.mts` 与 `artifacts/sa6-issue419-*.log`：只读；sha256 与 SA6 §17 登记前缀
  逐项一致（`b340dcd3…`/`3631b43f…`/`b054b3c0…`/`c8f67f9b…`/`1f23a7a0…`/`1960c24a…`/`96abbb72…`，
  见 `artifacts/sa3-issue419-targeted-repeat.log` 尾段）。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/replication-protocol/test/codec-route-key-guard.test.ts`（×2） | **19 passed (19)**、`Type Errors no errors`、EXIT=0（两次一致） | `artifacts/sa3-issue419-targeted-repeat.log` §run 1/2 |
| 门禁 1（AC5）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/replication-protocol` | **14 文件 / 233 测试全绿 / Type Errors: no errors / EXIT=0**（基线 13/214 + 守卫 19；≥215 期望满足） | `artifacts/sa3-issue419-package-suite.log` |
| 门禁 2：`pnpm exec tsc -p packages/replication-protocol/tsconfig.json` | `TSC_EXIT=0`（无诊断） | `artifacts/sa3-issue419-scope-and-tsc.log` |
| 门禁 4（零行为面）：`git diff --stat -- packages/replication-protocol/src` | **空输出**；`git diff --quiet` → `SRC_CLEAN=yes` | `artifacts/sa3-issue419-scope-and-tsc.log` |
| 门禁 5（RK-C6）：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts`（两轮） | 两轮均 **`MUTATION_RESULT 6/6 expected`**、EXIT=0；M1→P1/P4 红、M2→P2/P4/NC2 红、M3→P3 红、M4→P1/P4 红、NM1/NM2 全绿（失败详情与 SA6 基线逐字一致） | `artifacts/sa3-issue419-mutation-rerun.log` |
| 补充（§8.8 加固）：守卫文件跑在 6 个变异 codec 副本上 | 最终一轮 **`GUARD_MUTATION_RESULT 6/6 expected`**、EXIT=0：M1→`[G2-a,G2-b,G5-a]`、M2→`[G3-a,G3-b,G3-d,G5-a,NC2]`、M3→`[G4-a..G4-e]`、M4→`[G1-b,G2-a,G2-b,G5-a]`、NM1/NM2 全绿（EXIT=0）。真实 `src/` 零写入（副本机制 + 收尾 scratch 删除） | `artifacts/sa3-issue419-guard-mutation-evidence.log`（含首轮原始输出） |
| SA6 只读资产完整性：`sha256sum` | 7 份资产哈希前缀与 SA6 §17 登记逐项一致 | `artifacts/sa3-issue419-targeted-repeat.log` 尾段 |
| scratch 清理 | `.scratch/sa3-419` 不存在；`.scratch/` 仅剩既有 `vfsl-v1-parser` | 终端输出（`ls` 亲证） |

**断言面 ⊇ 探针（设计 §8.8 映射，逐组本轮亲核）**

| 守卫组 | ⊇ 探针 id | 承载断言 |
|---|---|---|
| G1-a/b/c + G2-a/b | P1 | 头长 20 同源钉死、35 文法接受面 + UTF-8 字节数、运行时前缀观察、14 构造（13 型逐型 = 注册表 scope 推导集合）逐帧 `prefix@20`/`[21..56)`/decode 回读/scope、13 条 golden 双面 |
| G3-a…d | P2 | `kind@20`、`prefix@21`、`[22..57)`、`selectedCapabilities` 解码回读、`kind ≠ 0x23` 可判别、绑定块不位移（`indexOfBytes` 实测起点 = 22）、kind 三态枚举、3 条 chunk golden 双面 |
| G4-a…e | P3 | 独立走查器按 §13 序全消费（scope→code→fatal→retryable→relatedSequence?→namespaceId?→safeMessage，零尾随）、注册表同源 fatal/retryable、marker ∈ {0,1} 与 scope 等价、namespaceId 前缀 1B/值 35B、`[21..56)` 是 code 不得误纳、距离 ≤ 64、连接级字节级无 key、值面经 `decodeMessage` 交叉、最坏公式 |
| G5-a | P4 | 5 代表构造差分：等长、值域差窗 = 字段窗去 3 字节不变成分、窗前 1 字节 = 0x23、登记窗 = namespaceId 全量 |
| G6 NC1/NC2/NC3 | NC1/NC2/NC3 | 连接级无路由键且仍可解码；namespace-scope 恰 14 / ERROR=either / 固定规则适用 13 / chunk 不得被误纳；21 条语料 fixed=13 / chunk=3 / error=2 + 例外集合恰 8 元素 |

**计数契约自检（SA6 §12.6）**：≥13 型固定偏移（13 型 / 14 构造 + 13 golden）✓；≥6 chunk 组合（6）+ 3 golden ✓；
≥5 ERROR 用例（四象限 4 + fatal=false 1 + 最坏 1 + 2 golden）✓；3 负控 ✓；5 变异类（M1–M4 + NM1/NM2，两轮）✓。

**纪律自检（SA6 §3-4 / 设计 §8.7）**：`grep` 亲证零 `skip/only/todo`、零 `process.env`、零 `readFileSync`
（无源码文本消费）、零 `toMatch/RegExp`（无源码字符串断言）；断言只观察帧字节与公开 API 值面；裸偏移字面量
`21/22/56/57` 仅出现在注释散文与 G1-a 钉死用例（`grep -nE "[^0-9_](21|22|56|57)[^0-9_]"` 逐个核对）。

## Deferred verification

| 项 | 为什么不在 SA3 范围 | 建议承接方 |
|---|---|---|
| 门禁 3（CI 级）：根 `pnpm test` / `pnpm typecheck` | 技能明示 SA3 不承担全仓测试/更广回归；本票 diff = 单一测试文件 + 证据日志，包内全量（门禁 1/2）已覆盖受影响面 | SA7 / CI |
| 守卫文件在**真实** `src/` 之外的长期敏感性 | 已用「SA6 探针矩阵两轮（正式门禁）+ 守卫自身跑变异副本 6/6（补充）」双证据覆盖；无新增运行期面 | SA4/SA7 按其判断复核 |
| F1（布局事实升格为 `src/constants.ts` 导出，随 #420+ edge demux）、F2（§22 资产登记，Controller 可选） | SA8 §5/§7 明示属未来票决策面，本轮不预支 | Controller / #420+ 票 |
| 协议 §22 资产清单回退检查（D6-1 引用存在性） | 本票不改协议文档、不新增被引用资产 → D6-1 不受影响；包全量套件已含该检查并绿 | 已由门禁 1 覆盖 |

## Deviations or blockers

无阻塞。以下 3 条为已登记的**增强性偏差**（均不改变验收语义、不弱化任何 SA6 红灯断言）：

1. **G1-b 多一条运行时窗口断言**：除设计 §8.1 字面要求的「encode 接受面 + `TextEncoder` 字节数 = 35」外，
   G1-b 还断言 codec **实际写出**的 `[21..56)` 窗口 = `NS`（把「钉死值与 codec 行为互证」落实到偏移面）。
   后果：守卫级补充证据首轮显示 M4（前导字段位移）额外点亮 G1-b（原始输出保留在证据日志中，未回改任何断言）；
   这是有意敏感面，非过紧——G1-b 仍以 codec 公开行为为唯一观察对象。
2. **采纳 SA2 O2/O3/O4**：最坏用例动态取最长 namespace 码（R4 预算红仍在位）、新增 `fatal=false` wire 样本、
   新增 grammar 拒绝方向用例（G1-d）。三者均在 ALLOW 文件内、均为加强而非放宽。
3. **补充性 scratch 诊断已删除**：守卫级变异驱动是临时诊断（`vitest.mutant.config.ts` 需临时别名配置，
   属工具范畴而非仓内资产），已在报告中登记其变异锚点/期望集合与全部原始输出；正式门禁仍由仓内长期资产
   `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts` 承载，可随时复现。

设计 §7.5 的两处 SA6 证据笔误已在实现中按设计采信：`UPDATE_CHUNK_U32_MAX` 按 fixtures 事实处理为
kind2 **非首**（无绑定块），kind1/kind2 首 chunk 绑定块形态由守卫内合成用例承担（G3-a/G3-b 断言首 chunk
必须携带绑定块形态）；NC3 语料计数以 21 为准（G6 断言 `GOLDEN.length === 21`）。

## Suggested commit message

```
test(#419): replication-protocol 路由键契约 codec 守卫测试（ADR 0032 §4 / spec #415 T1）

新增 packages/replication-protocol/test/codec-route-key-guard.test.ts（19 用例 / 6 组）：
namespace 域固定偏移 [21..56)（13 型 + OPEN identity 两态 + 13 条 golden 双面）、
UPDATE_CHUNK kind-first [22..57)（3 kind × 首/非首 + 绑定块不位移）、ERROR §13 字段序
（四象限 + fatal=false + 最坏 + 2 条 golden，独立最小读取器）、差分推导（零新增 codec 常量）、
布局事实单点登记 + 39 行头注维护契约、NC1–NC3 负控。

纯增量测试：src/、test/fixtures.ts、既有 13 个测试文件、wire/协议文档零改动；
门禁：包全量 14 文件/233 测试全绿 + 0 类型错误、包 tsc exit 0、src diff 为空、
SA6 变异矩阵两轮 6/6 expected（守卫自身跑变异副本 6/6，补充证据）。
```
