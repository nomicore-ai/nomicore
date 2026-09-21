# SA1 架构设计 — issue #419：路由键契约 codec 守卫测试（spec #415 T1）

> Phase：design（iteration 0，首次产出——`wiki/raw/task_issue-419_design.md` 此前不存在）。
> Dispatch：`sa-261755cd-cf21-4bfa-8cc9-003eb98baebb`（mabf-sa1）。
> 上游输入（全部亲读）：Host 任务简报 `wiki/raw/task_issue-419.md`（Issue #419 正文，state=open，
> Issue updated at 2026-09-21T14:21:34Z）；**已批准的** SA6 验收契约 `wiki/raw/task_issue-419_sa6_contract.md`
> （approve）及其可执行证据 `task_issue-419_sa6_route_key_probe.mts`（探针 P1–P4/NC1–NC3）、
> `task_issue-419_sa6_route_key_mutation_driver.mts`（变异 M1–M4/NM1/NM2）与 5 份
> `artifacts/sa6-issue419-*.log`（本轮逐份复核结论行）。**Issue 评论 REST 快照为空（`[]`）——无
> Owner 评论要求、无评论 ID/时间戳可落实（dispatch 注记与 SA6 §2 一致）。**
> 无 SA8 产物：`task_issue-419_relevant_decisions.md` / `task_issue-419_conflict_report.md` /
> `task_issue-419_design_conflict_report.md` 均不存在（SA6 §15.2 同证）——本设计按技能纪律以
> ADR 0032 + 协议规范 + 源码事实替代，并在 §6/§15 标记窄幅设计后冲突复查。
> worktree = `/home/wangjian/nomicore-fix-issue-419`，HEAD `27e012b`（本轮 `git log -1` 亲证，
> 与 SA6 §4 同一）。本设计只产出设计文档；不实现、不改任何生产代码或测试。

## 0. 设计结论摘要

1. **任务类型 = Feature / 纯增量测试**（承接 SA6 §1）：现行 codec 布局**正确**（探针 7/7 绿、
   变异矩阵两轮 6/6 expected），缺的是 ADR 0032 §4 要求的「结构性守卫测试」与布局事实的可执行登记。
   本设计是 **baseline-green + mutation-red** 形态，不得伪造当前代码即红的假断言。
2. **交付物 = 单一新测试文件 `packages/replication-protocol/test/codec-route-key-guard.test.ts`**。
   `src/` 零改动、`test/fixtures.ts` 零改动、文档零改动、wire 零改动。
3. **SD-1 裁决（本设计的核心范围决策）= SD-1B（test-only 单一事实源）**：布局字面量（35 / 1 /
   派生 21/22/56/57）在守卫文件顶部**唯一一处**集中钉死并做行为面交叉核对；**不**在
   `src/constants.ts` + `src/index.ts` 追加导出常量（SA6 推荐的 SD-1A 延后到 edge demux 消费者
   切片，保留常量名预留，见 §7.2/§13-F1）。裁决依据：Issue 正文 Owner 要求「纯增量测试，零行为
   变化」且评论快照为空（无放宽）；AC4 在 SD-1B 下可完整满足（RK-C4 双实现之一，探针 P4 即
   可执行证明）；公共 API 面是 append-only 契约面，追加导出应与其真实消费者同票评审。
4. **守卫测试结构 = 6 个 describe 组**（§8）：布局事实登记与交叉核对 / 域固定偏移（RK-C1）/
   UPDATE_CHUNK kind-first（RK-C2）/ ERROR 字段序（RK-C3）/ 差分推导（RK-C4）/ 负控（RK-C5）。
   断言面 = codec 公开 API 的**运行时帧字节** + 注册表值面；走查用**独立最小读取器**（故意不复用
   codec reader，防编码/解码同源缺陷互相抵消）；零源码字符串/正则断言、零 skip/only/todo、
   零 env 依赖。
5. **修正 SA6 两处证据笔误**（§7.5，均不影响契约条目）：`UPDATE_CHUNK_U32_MAX` golden 实为
   kind2 **非首** chunk（`chunkIndex=0xfffffffe`，无绑定块），非契约 §12.2 所述「kind2 首+绑定块」；
   探针头注「18 golden」为陈旧注释，语料实为 21 条（13+3+2+3，代码计数正确）。
6. **requiresConflictRecheck = true（窄幅）**（§15）：SA8 产物缺失 + 本设计对 SA6 推荐的 SD-1A
   做「本票不落地、延后到消费者切片」的裁决，需一次轻量冲突复查确认与 ADR 0032 §4「登记为同步
   维护契约」的语义相容；除此之外设计不触碰任何冻结面。

---

## 1. 任务类型、目标和非目标

**类型：Feature（能力缺口——结构性守卫与布局事实可执行登记缺失；SA6 §1 同判，非 Bug）。**

- **能力缺口**（SA6 §8 G1–G5，本轮逐项复核成立）：
  - G1 codec 不导出/不持有 namespaceId 长度（35）、前缀宽度（1）、域内偏移（21/22）等布局事实；
  - G2 13 型 namespace 域帧无 `[20]=0x23` + namespaceId ∈ `[21..56)` 逐型断言；
  - G3 无 UPDATE_CHUNK kind-first（`[22..57)`）守卫（既有测试只锁首字节是 kind）；
  - G4 无 ERROR §13 字段序走查守卫；
  - G5 无变异敏感性证据把守卫断言与布局事实绑定（防恒真/过松）。
- **目标**：把 ADR 0032 §4（D7/D11）的路由键布局事实固化为 `@nomicore/replication-protocol`
  包内**可执行、变异敏感、与 codec 同源消费**的结构性守卫测试——字段序一旦漂移，测试响亮失败
  且失败语义指向路由键布局（这是未来 edge O(帧头) demux（ADR 0032 决策 4）依赖的契约地基）。
- **非目标**：
  - 不实现 edge demux / SessionHost / OPEN 全解码路由分支（ADR 0032 决策 1–3、5，属 #420 及后续
    切片——SA6 §15.5 同判）；
  - 不改 wire 格式、不改协议文档语义、不改公共 API（SD-1B：`src/` 零改动）；
  - 不新增 golden fixtures 字面量（复用既有 21 条；所需变体在守卫文件内合成）；
  - 不在协议 §22 登记新资产（AC 未要求；作为可选 follow-up 记录，见 §13-F2）；
  - 不覆盖「合法无 sink → 合成 NAMESPACE_STATE_VIOLATION」等 edge 运行期行为。

## 2. 当前行为与证据锚点（源码事实，HEAD `27e012b`，本轮亲读）

| # | 事实 | 锚点 |
|---|---|---|
| B1 | 固定 20-byte NMCR envelope；`ENVELOPE_HEADER_BYTES = 20` 已由 codec 导出 | `docs/protocols/instance-replication-v1.md` §3（L47–63）；`src/constants.ts` L15；`src/index.ts` L11 |
| B2 | namespaceId 文法 `^ns-[0-9a-f]{32}$`（35 字节 ASCII）；`NAMESPACE_ID_RE` 已导出 | 协议 §1；`src/constants.ts` L32 |
| B3 | payload = lib0 canonical（varString = varUint(字节数) + utf8；35 < 0x80 ⟹ 最短 varUint 恒 1 字节） | 协议 §4（L65–87）；`test/fixtures.ts` L9–15 契约锚注 |
| B4 | 每个 namespace-scope payload 首字段 = `varString namespaceId`（UPDATE_CHUNK 例外：kind 首字段） | 协议 §4 末段、§5（L115–117）、§10.3 字段表 |
| B5 | 消息注册表 18 型：connection 3（HELLO/HELLO_ACK/GOAWAY）+ either 1（ERROR）+ namespace 14；`MESSAGE_REGISTRY[kind].scope` 公开可读 | 协议 §5 表；`src/messages.ts` L80–102 |
| B6 | ERROR 字段序 = scope(u8) → code(varString) → fatal(u8) → retryable(u8) → relatedSequence?(marker+varUint32) → namespaceId?(marker+varString) → safeMessage(varString)；scope/fatal/retryable 由错误注册表导出，调用方不可覆盖 | 协议 §13（L379–393）；`src/payloads.ts` `encodeError` L320–349 |
| B7 | UPDATE_CHUNK 单形态：kind(varUint, 0/1/2) 首字段 → namespaceId → transferId → chunkIndex → chunkCount → totalBytes → [绑定块 iff kind≠0 ∧ chunkIndex=0] → bytes；绑定块 kind1 = replicationId+replicationEpoch、kind2 = syncRoundId | 协议 §10.3（L307–345）；`src/payloads.ts` `encodeUpdateChunk`（L700 区段）与 `decodeUpdateChunk` 注释块 |
| B8 | 21 条 golden 冻结向量（含 hex 字面量）：13 条 namespace 域非 chunk、3 条 chunk（BASIC=kind0 首 / MULTIBYTE=kind1 非首 / U32_MAX=kind2 非首·u32 极值）、2 条 ERROR、3 条连接级 | `test/fixtures.ts` `GOLDEN` L252–401（kind 分配注释 L365–370） |
| B9 | 既有最接近覆盖均不点名路由键事实：envelope 逐 offset 断言只进 header（0/4/5/6/8/12/16）；issue299 只锁 chunk 首字节 ∈ {0,1,2}；golden 全帧等式不给可消费布局事实、失败语义不指向路由键 | `test/codec-envelope.test.ts` L52–65；`test/codec-issue299-ac-red.test.ts` L285–290；`test/codec-messages-golden.test.ts`；SA6 §5-C（复核一致） |
| B10 | 仓内零布局事实登记：`src` 无 OFFSET/LAYOUT 常量；`21..56`/`22..57` 等只存在于 ADR 散文 | SA6 §5-A/B `grep` 证据（`artifacts/sa6-issue419-capability-gap.log`）；`src/constants.ts` 全文亲读确认 |
| B11 | 无 edge 消费者：`packages/ws-replication/src` 无 edge/session-host 模块——布局事实当前无任何登记点供 demux 消费 | SA6 §5-E |
| B12 | 测试发现与门禁：vitest include `packages/*/test/**/*.test.ts`；包 tsconfig include `src/**/*.ts + test/**/*.ts`（新测试文件受 `pnpm typecheck` 覆盖）；root `pnpm test` = `vitest run --typecheck` | `vitest.config.ts` L17；`packages/replication-protocol/tsconfig.json`；根 `package.json` scripts |
| B13 | 基线：包全量 13 文件 / 214 测试全绿 / Type Errors: no errors；包 tsc exit 0；目标路径发现性已实测（占位 1 用例 → 14 文件/215 绿后删除） | `artifacts/sa6-issue419-runner-trigger.log` §1–§3；`artifacts/sa6-issue419-package-tsc-baseline.log` |
| B14 | 现行布局正确且断言面变异敏感：探针对真实 codec 7/7 绿（5 次重复）；变异矩阵两轮 6/6 expected（M1–M4 各自点亮对应断言、NM1/NM2 保持绿） | `artifacts/sa6-issue419-probe-green.log`、`artifacts/sa6-issue419-mutation-sensitivity.log`（本轮复核 `RESULT 7/7 passed` 与两段 `MUTATION_RESULT 6/6 expected`） |
| B15 | 域词条已登记：CONTEXT.md「路由键契约（routing-key contract）」明确「与 codec 字段序同步维护，由结构性守卫测试锁死」 | `CONTEXT.md` L233–235 |

## 3. 能力缺口（承接 SA6 §8；Feature 形态的根因等价链）

- **为什么现状是缺口而不是 Bug**：ADR 0032 §4 明令「路由键布局与 codec 字段序登记为同步维护
  契约，codec 侧加结构性守卫测试」，而 B10/B11 显示仓内既无登记点也无守卫；同时 B14 证明现行
  wire 布局逐项符合 ADR——**不存在旧实现的失败行为**，故本票是能力补齐，可证伪性由变异红承载。
- **放大因素**（漂移发生时的静默错路路径，守卫必须点名锁死）：
  - UPDATE_CHUNK 的 kind ∈ {0,1,2} 均 < 0x23：若 `frame[20]` 被误读为 varString 前缀，会得到
    「长度 0/1/2」的短读而**不抛错**（SA6 §8）；
  - ERROR 的 namespaceId 在变长字段后（实测 payload+26/27，最坏 +46）：任何「统一 [21..56)」的
    简化提取会稳定取到 code 字符串（探针 P3、SA6 H5）。
- **排除项**：wire 形态缺陷（排除，B14）；golden 缺失（排除，B8）；前缀多字节可能性（排除，
  35 < 0x80 的 canonical 事实，SA6 H4）；「既有 golden 等式已足够」（排除为不足——B9 三点理由）。

## 4. Owner要求落实

Issue 评论 REST 快照 = `[]`：**无评论 ID/更新时间/作者可映射**（dispatch 明示，SA6 §2 同证）。
Owner 要求 = Issue 正文（最高优先级输入），逐条映射：

| Owner 要求（Issue 正文） | 设计落实 | 备注 |
|---|---|---|
| 「为 ADR 0032 的路由键契约…落地结构性守卫测试」 | §8 守卫文件全案 | ADR 0032 §4 是规范来源（B15 词条同向） |
| 「锁死 namespace 域帧的 namespaceId 定偏移布局（varString 长度前缀恒 1 字节、帧字节 [21..56]）」 | §8 G2（RK-C1） | 13 型 + OPEN 两态 + 13 条 golden 双面 |
| 「UPDATE_CHUNK 的 kind 首字段偏移（namespaceId 在 [22..57]）」 | §8 G3（RK-C2） | 3 kind × 首/非首 = 6 组合 + 3 条 chunk golden |
| 「ERROR payload 字段序（code → fatal → retryable → relatedSequence? → namespaceId? → safeMessage）」 | §8 G4（RK-C3） | 四象限 + 最坏前缀 + 独立走查 |
| 「codec 字段序一旦漂移，测试响亮失败——edge 的 O(帧头) demux 依赖这些布局事实」 | §8 失败语义设计 + §12 RK-C6 变异敏感性门禁 | 失败消息点名消息型与偏移 |
| 「纯增量测试，零行为变化」 | §7.2 SD-1B 裁决 + §11 DENY LIST（`src/` 零改动）+ §12 零行为面门禁 | **本设计的 SD-1 裁决依据** |
| AC1–AC5 | §12 验收映射表 | 与 SA6 §2 映射一致 |
| 「Blocked by: None」+「（重发：前票 #417 已关闭）」 | 无等待项；#417 关闭无追加要求 | — |

## 5. 复现和根因承接

| 上游事实（SA6 契约） | 证据位置 | 设计响应 |
|---|---|---|
| 探针 P1–P4/NC1–NC3 对真实 codec 7/7 绿（5 次重复） | `task_issue-419_sa6_route_key_probe.mts`；`sa6-issue419-probe-green.log` | 守卫断言面以探针为种子超集落地（§8 用例矩阵逐条对应 P/NC id）；baseline-green 形态确立——**禁止**制造当前代码即红的假断言 |
| 变异矩阵 M1–M4 红（各自点亮对应断言、失败详情点名消息型/偏移）、NM1/NM2 绿，两轮一致 | `task_issue-419_sa6_route_key_mutation_driver.mts`；`sa6-issue419-mutation-sensitivity.log` | RK-C6：实现票必须复跑该矩阵并写入验证日志（§12）；守卫每组断言 ⊇ 探针对应断言（映射表 §8.7），保证变异敏感性对长期资产成立 |
| 能力缺口 G1–G5、负控语义（NC1 连接级无 key / NC2 规则可判别 / NC3 语料计数+例外集合双向锁定） | SA6 §6/§8；`sa6-issue419-capability-gap.log` | §8 G6 三条负控原样保留；§3 缺口表承接 |
| 目标路径发现性 + 占位参与套件（14 文件/215）+ 洁净基线（13/214） | `sa6-issue419-runner-trigger.log` | §12 门禁命令与期望计数（落地后 14 文件/215+） |
| 包 tsc 基线 exit 0；tsconfig 覆盖 test/ | `sa6-issue419-package-tsc-baseline.log`；B12 | §12 门禁 2 |
| 差分推导可行（零新增常量即得偏移） | 探针 P4（L298–337） | §8 G5（RK-C4）落地为独立 describe |
| ERROR mini-decode 预算：实测最坏 46 字节、断言上界 64 | SA6 §12.3-6、§15.3 | §8 G4 断言 6 沿用 ≤64（登记为 edge 预算契约；注册表增长越界即红属有意行为，§13-R4） |
| SA6 §12.2 称 `UPDATE_CHUNK_U32_MAX` golden 为「kind2 首+绑定块」 | 与 `test/fixtures.ts` L391–400 矛盾（实为 kind2 非首：`chunkIndex=0xfffffffe`、无 syncRoundId） | **设计修正**（§7.5）：golden chunk 覆盖 = kind0 首 / kind1 非首 / kind2 非首；kind1/kind2 首 chunk 绑定块形态由守卫内合成用例覆盖（探针 `chunkMessages` 已含）；NC3 chunkRule=3 计数不变 |
| 探针头注「NC3 … 18 golden」 | 探针 L28 注释 vs L377–405 代码（21 条语料，计数断言正确） | **设计修正**（§7.5）：以 21 为准（13 fixed + 3 chunk + 2 error + 3 connection） |

## 6. SA8约束落实

无 SA8 产物（`_relevant_decisions.md` / `_conflict_report.md` / `_design_conflict_report.md`
不存在；SA6 §15.2 同证）。以下为替代证据推导的硬约束：

| 决议或义务 | 替代证据 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|---|
| ADR 0032 §4（已接受）：namespace 域帧 namespaceId 恒在 `[21..56]`；UPDATE_CHUNK kind 首字段 → `[22..57]`；前缀恒 1 字节；OPEN 全解码 / ERROR 有界 mini-decode 两例外；「codec 侧加结构性守卫测试」 | `docs/adr/0032-transport-decoupling-edge-session-split.md` L24–26 | §8 全部断言以该文为规范字面 | 直接落实（守卫测试即 ADR 的明令） | 否（落实而非修订） |
| 协议 §22 conformance：golden/roundtrip/截断/fail-closed 既有清单不得回退；新增守卫不得改变 wire | `docs/protocols/instance-replication-v1.md` §22 | §11 DENY（wire/协议文档零改动）；§12 门禁含全量套件 | 遵守 | 否 |
| 包边界：codec 传输/Registry 无关；公开 API 只经 `src/index.ts`；注册表 append-only；失败只抛 ProtocolError | `packages/replication-protocol/AGENTS.md` | §7.2（SD-1B 正是避免动公共 API 面）+ §8（守卫只 import 公开 API 与 `./fixtures`） | 遵守 | 否 |
| 测试纪律：无 skip/only/todo、无 env override、无 fallback、无吞错、无源码字符串/正则断言 | SA6 §3-4 | §8.6 断言纪律 | 遵守（探针的 `SA6_CODEC_SRC` env 机制是 SA6 诊断专用，**不进**守卫测试） | 否 |
| SD-1（SA6 留给设计裁决的开范围决策） | SA6 §12.5（A/B 两案、推荐 A 待批）；Issue 正文「纯增量测试，零行为变化」 | §7.2 裁决 = **B**，A 的常量名预留并延后（§13-F1） | **是**——对 SA6 推荐案做了「本票不落地」的裁决，需确认与 ADR 0032 §4「登记」语义相容（§15） |

## 7. 设计决策与主要备选方案

### 7.1 D1 — 交付形态：单一守卫测试文件（复用既有 golden，零 fixture 改动）

新文件 `packages/replication-protocol/test/codec-route-key-guard.test.ts` 是**唯一**交付物：
- import 面 = `@nomicore/replication-protocol` 公开 API（`encodeMessage`/`decodeMessage`/
  `MESSAGE_REGISTRY`/`CONNECTION_ERRORS`/`NAMESPACE_ERRORS`/`ENVELOPE_HEADER_BYTES`/
  `CAP_CHUNKED_UPDATE`）+ `./fixtures` 的 `GOLDEN`/`NS`/`hexToBytes`（与既有测试 import 约定
  一致，`codec-envelope.test.ts` L12–29 同款）；
- 所需 ERROR/chunk 变体（四象限、最坏前缀、kind1/kind2 首 chunk 绑定块）在文件内合成
  （探针 `errorMessages`/`chunkMessages` 即种子），**不追加** `fixtures.ts`——保护 21 条冻结
  golden 语料与依赖它的既有断言（issue299 条数断言 ≥3 等），把 diff 压到单文件。
- 备选（否决）：把变体追加进 `fixtures.ts`——SA6 §10 虽允许「只追加」，但会扩大改动面并使
  golden 语料与本票的合成变体混流；单文件自含更符合「纯增量测试」。

### 7.2 D2 — SD-1 裁决：SD-1B（test-only 单一事实源），SD-1A 延后到消费者切片

**裁决：本票取 SD-1B**——`src/constants.ts` 与 `src/index.ts` **零改动**；布局字面量在守卫
文件顶部单一冻结块钉死（35 / 1，及由 `ENVELOPE_HEADER_BYTES` 同源派生的 21/22/56/57），并按
§8 G1 做行为面交叉核对（文法推导 + 运行时观察 + 差分推导）。

依据（按约束优先级）：
1. **Issue 正文（Owner 最高优先级输入）明示「纯增量测试，零行为变化」**，且评论快照为空——
   无任何放宽该范围的 Owner 要求。向 `src/index.ts` 追加导出是公共 API 面变更，超出「纯增量
   测试」的字面范围。
2. **AC4 在 SD-1B 下可完整满足**：AC4 要求「守卫测试与 codec 同源消费布局常量/解码器（不手抄
   第二份字段序）」。SA6 RK-C4 明确给出两条合法实现，「同源解码器/行为推导」即 SD-1B 形态，
   且探针 P4 是其可执行可行性证明（B14）。本设计的同源面：20 ← codec 导出
   `ENVELOPE_HEADER_BYTES`；值面事实 ← `encodeMessage`/`decodeMessage`/错误注册表；35 ← 与
   codec 文法交叉核对（codec 接受的合法 namespaceId 的 UTF-8 字节长度）；偏移 ← 差分推导交叉。
   「不手抄第二份字段序」由独立走查器 + 注册表值面核对保证（字段序不抄，偏移字面量一处钉死）。
3. **公共 API 是 append-only 契约面**（包 AGENTS.md「Add public APIs only through src/index.ts;
   exported types and runtime codec behavior must evolve together」）：新增导出应当与其真实
   消费者一起评审。当前无消费者（B11：edge demux 属 #420+ 后续切片），现在导出 = 在测试票里
   夹带一次无人消费的 API 冻结决策。
4. **SD-1A 的收益不可提前兑现**：其价值是「未来 edge demux 有单一事实源」；消费者落地时再登记
   （消费驱动时序）零额外成本——常量名已预留（§13-F1），届时切换是机械改动。
5. **防双向漂移能力不因 B 案受损**（RK-C4 的核心关切）：字面量单点钉死 + 差分推导 + golden
   全帧等式（fixtures 冻结 hex，任何 codec 漂移都会先在 `codec-messages-golden.test.ts` 红）+
   ADR/协议规范文本共同构成背板。SA6 自己的回退条款：「若判定本 issue 必须绝对 test-only，则取
   SD-1B，且 RK-C1–C3 与变异矩阵不变（探针即 SD-1B 形态的可执行证明）」——本设计正式启用该条款。

**残余风险（诚实登记，§13-R1）**：「codec 与守卫钉死块协同编辑」在 SD-1B 下可静默绿——但这与
SD-1A 下「codec 与常量协同编辑」同构；两案的规范背板同为 ADR 0032 §4 + 协议文本 + 冻结 golden
+ 评审纪律。变异矩阵（单侧漂移必红）在两案下等价成立。

**备选（否决）**：SD-1A（本票即追加 `NAMESPACE_ID_BYTES`/`NAMESPACE_ID_VARSTRING_PREFIX_BYTES`/
`NAMESPACE_DOMAIN_NAMESPACE_ID_OFFSET`/`UPDATE_CHUNK_NAMESPACE_ID_OFFSET` 并导出）——优点是
ADR「登记」语义的 codec 侧落位与 edge 未来单一事实源；否决理由 = 上述 1/3（范围越界 + 无消费者
的 API 冻结）。**不是永久否决**：§13-F1 作为消费者切片的预留决策记录。

### 7.3 D3 — 守卫结构：6 个 describe 组（契约 §12.0「建议 4 组」的纯组织性扩展）

分组：G1 布局事实登记与交叉核对 / G2 域固定偏移 / G3 chunk kind-first / G4 ERROR 字段序 /
G5 差分推导 / G6 负控。相对 SA6「建议 4 组」多出 G1（钉死块）与 G5（差分）两个**独立**组：
纯组织选择，不删任何契约断言，且让 AC4 的两条实现路径（钉死 + 行为推导）各有独立失败语义。
若实现票或评审偏好 4 组，G1 并入 G2 头部、G5 并入 G2/G3 尾部即可——断言集合不变。

### 7.4 D4 — 断言面与失败语义

- 断言只观察 **运行时帧字节**（`encodeMessage` 产出与 golden hex 解码两源）与**公开 API 值面**
  （`decodeMessage` 回读、注册表 scope/错误码条目）；失败消息必须点名消息型 + 偏移 + 实测值
  （探针模板 `${kind}: prefix@20 = X ≠ 0x23` 直接沿用），使「路由键布局漂移」可从失败文本定位。
- ERROR 走查用**独立最小读取器**（模块私有 `readVarUint`/`readVarString`，探针 L84–101 同款）：
  故意不复用 codec 的 CanonicalReader——若编码/解码共享同一缺陷，走查仍会红；值面再经
  `decodeMessage` 交叉核对（防走查器自身笔误）。
- 双向判别是守卫的目的而非副作用：`[21..56)` 与 `[22..57)` 两规则、连接级无 key、ERROR 例外，
  都必须有「不得互相误纳」的显式断言（G6 NC2/NC3 承载）。

### 7.5 D5 — SA6 证据笔误修正（不改变任何契约条目）

1. `UPDATE_CHUNK_U32_MAX` golden 的形态：SA6 §12.2 表述为「kind2 首+绑定块」；源码事实（B8）
   为 kind2 **非首**（`chunkIndex=0xfffffffe`，payload hex 无 syncRoundId）。守卫以源码事实
   为准；首 chunk 绑定块覆盖由合成用例（kind1-first+replicationId/Epoch、kind2-first+syncRoundId）
   承担，覆盖矩阵不变（6 组合全量）。
2. 探针头注「18 golden」为陈旧注释（issue #295 追加 3 条 chunk golden 之前的历史计数）；守卫与
   NC3 计数以 21 为准（代码计数断言本就正确，B14）。

## 8. 接口、状态机和数据流（守卫测试文件详案）

### 8.0 模块级布局事实登记块（全文件唯一出现点）

```ts
// —— 路由键布局事实（单一事实源；规范来源：ADR 0032 §4 / 协议 §1 §3 §4 §10.3 §13）——
// SD-1B：本块是 issue #419 范围内的唯一登记点；消费者切片（edge demux）落地时应升格为
// src/constants.ts 导出常量（名字见设计 §13-F1）并把本块改为消费 + 钉死断言。
const HEADER_BYTES = ENVELOPE_HEADER_BYTES;            // 同源消费 codec 导出（= 20，G1 断言）
const NS_BYTES = 35;                                   // `ns-` + 32 hex（协议 §1 文法）
const NS_PREFIX_BYTES = 1;                             // 35 < 0x80 ⟹ canonical varUint 最短编码
const NS_OFFSET_DOMAIN = HEADER_BYTES + NS_PREFIX_BYTES;  // 21（派生，不手写）
const NS_END_DOMAIN = NS_OFFSET_DOMAIN + NS_BYTES;        // 56（派生）
const NS_OFFSET_CHUNK = NS_OFFSET_DOMAIN + 1;             // 22（kind 首字段占 1 字节；kind ∈ {0,1,2} 恒单字节）
const NS_END_CHUNK = NS_OFFSET_CHUNK + NS_BYTES;          // 57（派生）
const ERROR_NS_PREFIX_BUDGET = 64;                     // edge mini-decode 有界预算上界（实测最坏 46）
```

约束：`21`/`22`/`56`/`57` 等偏移数字**只允许**经上述派生出现于断言中（除 G1 钉死用例的字面量
断言外，全文件不得再出现裸偏移字面量）；`NS_BYTES`/`NS_PREFIX_BYTES` 字面量仅此一处。

### 8.1 G1 布局事实登记与交叉核对（RK-C4 前半；AC4）

| 用例 | 断言 |
|---|---|
| G1-a header 同源 | `ENVELOPE_HEADER_BYTES === 20`（协议 §3 字面量钉死；codec 自报值消费） |
| G1-b 35 的文法交叉 | `NS`（fixtures 合法 id）匹配 codec 接受面：`encodeMessage` 成功（即通过 `checkNamespaceId`）且 `new TextEncoder().encode(NS).byteLength === NS_BYTES === 35`——钉死值与 codec 实际文法互证，非手抄孤证 |
| G1-c 前缀宽度推导与观察 | 任一 namespace 域帧 `frame[HEADER_BYTES] === NS_BYTES && frame[HEADER_BYTES] < 0x80`（运行时观察 canonical 单字节前缀，与「35 < 0x80 ⟹ 1 字节」推导互证） |

### 8.2 G2 域固定偏移（RK-C1 / AC1）

输入矩阵（14 构造，探针 `domainMessages` L128–145 原样种子）：13 型各 1（OPEN_NAMESPACE /
OPEN_OK / CLOSE_NAMESPACE / CLOSE_OK / BOOTSTRAP_SNAPSHOT / BOOTSTRAP_ACK / IDENTITY_CHANGED /
SYNC_STEP1 / SYNC_STEP2 / SYNC_APPLIED / RESYNC_REQUIRED / UPDATE / UPDATE_ACK）+ OPEN_NAMESPACE
`hasLocalReplica=false` 无 identity 变体（identity 两态）。

每构造断言（对 `encodeMessage(msg)` 帧）：
1. `frame.length ≥ NS_END_DOMAIN`；
2. `frame[HEADER_BYTES] === NS_BYTES`（=0x23）且 `< 0x80`；
3. `utf8(frame.subarray(21, 56)) === msg.namespaceId`（用派生常量，含 `ns-` 字面）；
4. `decodeMessage(frame).message.namespaceId === msg.namespaceId`（值面交叉）；
5. `MESSAGE_REGISTRY[kind].scope === 'namespace'`（规则适用域由注册表支撑）；
6. 覆盖计数 = 14（13 型 + OPEN 两态，防构造面退化）。

golden 双面（契约 §12.1「golden 帧字节与重编码字节都要成立」）：对 `GOLDEN` 中 13 条 namespace
域非 chunk golden（B8 清单）：对 `hexToBytes(g.frameHex)` 与 `encodeMessage(g.message,
{ sequence: g.sequence })` 两份字节各跑断言 2/3/4——golden 字节锚「已发布 wire 事实」，重编码
字节锚「当前编码器行为」，两面向互相锁死。

### 8.3 G3 UPDATE_CHUNK kind-first（RK-C2 / AC2）

输入矩阵（6 合成组合，探针 `chunkMessages` L148–159 种子）：kind0 首 / kind0 非首 / kind1 首
（含 `replicationId`+`replicationEpoch` 绑定块）/ kind1 非首 / kind2 首（含 `syncRoundId` 绑定块）/
kind2 非首；另覆盖 3 条 chunk golden（BASIC=kind0 首 / MULTIBYTE=kind1 非首 / U32_MAX=kind2
非首·u32 极值——§7.5 修正后的事实面）。

断言：
1. `frame[HEADER_BYTES] === transferKind`（kind ∈ {0,1,2}）；
2. `frame[HEADER_BYTES + 1] === NS_BYTES`（=0x23，且 `< 0x80`）；
3. `utf8(frame.subarray(22, 57)) === msg.namespaceId`；
4. `decodeMessage(frame, { selectedCapabilities: CAP_CHUNKED_UPDATE })` 回读
   `transferKind`/`namespaceId` 一致（chunk 帧解码需已协商 capability，既有测试同款选项）；
5. **绑定块不位移**：同 kind 的首/非首两帧 namespaceId 同偏移（绑定块在 totalBytes 之后、bytes
   之前，不进入 `[22..57)`）；
6. **可判别**：`frame[HEADER_BYTES] !== NS_BYTES`（kind 恒 < 0x23，两规则不可互相误纳）；
7. kind 三态全覆盖 `{0,1,2}`（枚举断言）；
8. 3 条 chunk golden 走 kind-first 规则（golden 字节 + 重编码字节双面）。

### 8.4 G4 ERROR 字段序（RK-C3 / AC3）

输入：四象限（连接级/namespace 级 × relatedSequence 有无，探针 `errorMessages` L162–169）+
变长 code 样本 + 2 条 ERROR golden（ERROR_CONN/ERROR_NS）+ 最坏用例（最长 namespace 错误码
`NAMESPACE_REOPEN_REQUIRES_RECONNECT` 35B + `relatedSequence = 0xffffffff` 5 字节 varUint）。

走查器 = 模块私有 `walkError`（探针 L223–262 种子，独立最小读取器），按 §13 固定序消费并断言：
1. `frame[HEADER_BYTES] === scope`（0/1，固定偏移）；
2. `code` = 紧随 varString；`fatal`/`retryable` 紧随两字节，且与 `CONNECTION_ERRORS`/
   `NAMESPACE_ERRORS` 注册表条目一致（同源消费注册表，不手抄 bool）；
3. `relatedSequence` marker ∈ {0,1} 与出现性一致，值 = `decodeMessage` 回读值；**必须先于
   namespaceId**（走查序即断言序）；
4. `namespaceId` marker ∈ {0,1} 与 scope 等价（namespace ⇔ present）；出现时 varString 前缀 1
   字节、值 35 字节；
5. `safeMessage` 必须是末字段且**恰好全消费**（`p === frame.length`，零尾随）；
6. namespace 级：`utf8(frame.subarray(21, 56)) !== namespaceId`（该窗口是 code——ERROR 不得被
   固定偏移规则误纳）且 namespaceId 距 payload起点 ≤ `ERROR_NS_PREFIX_BUDGET`（64；实测最坏
   `1+1+35+1+1+1+5+1 = 46`）；
7. 连接级：帧内**字节级**不含 namespaceId（`containsBytes`，不做整帧 UTF-8 解码——探针
   L111–120 同款防御）；
8. 值面交叉：`decodeMessage(frame)` 回读 code/relatedSequence/namespaceId/safeMessage 与构造
   输入一致；最坏用例的 namespaceId 前缀字节数按公式逐项核对。

### 8.5 G5 差分推导（RK-C4 后半 / AC4；探针 P4 种子）

对 5 个代表构造（UPDATE、CLOSE_OK、RESYNC_REQUIRED 域型 + UPDATE_CHUNK kind0、kind2-首 chunk
型）：同型两帧仅 namespaceId 值不同（`ns-`+32×'0' vs 32×'f'）→
1. 两帧等长；
2. 差异窗口 `[first..last+1)` 的起点 = 字段窗口起点 + 3（`ns-` 字面不变成分）、终点 = 字段窗口
   终点（值域差窗 = 字段窗口去掉不变成分）；
3. 窗口前一字节 = `NS_BYTES`（0x23 前缀稳定）；
4. 登记字段窗口字节 === 对应 namespaceId 全量（差分结果与钉死偏移互证——**偏移事实不依赖任何
   新增 codec 常量即可被行为面覆盖**）。

### 8.6 G6 负控（RK-C5；探针 NC1–NC3 原样保留，无漂移时必须全绿）

| 用例 | 断言 | 为什么是负控 |
|---|---|---|
| NC1 连接级帧无路由键 | HELLO / HELLO_ACK / GOAWAY / 连接级 ERROR 四帧：`frame[HEADER_BYTES] !== NS_BYTES`、字节级不含 namespaceId（`containsBytes`）、且仍可 `decodeMessage`（负控不是「拒绝」而是「无路由键」） | 证明路由键断言不是「任何帧都命中的恒真断言」；连接级帧无 key 是规则的一部分 |
| NC2 注册表 scope 判别 | namespace-scope 恰 14 型（18 − 3 连接级 − ERROR either）；`MESSAGE_REGISTRY.ERROR.scope === 'either'`；UPDATE_CHUNK 必为 namespace scope 但首字节是 kind（`frame[20] ≤ 2` 且 `frame[21] === 0x23`），不得被 `[21..56)` 规则误纳 | 证明两条定偏移规则可判别（`[21..56)` 与 `[22..57)` 不可互相误纳）；规则塌缩时（如 M2）本用例必须红——这是判别性负控的语义 |
| NC3 语料级判别 | 遍历 `GOLDEN` 21 条：恰 13 条落固定偏移规则（`frame[20]=0x23` 且 `[21..56)` = NS，且均为 namespace scope 非 chunk 非 ERROR）；例外集合恰 = `{HELLO, HELLO_ACK, GOAWAY, ERROR_CONN, ERROR_NS, UPDATE_CHUNK_BASIC, UPDATE_CHUNK_MULTIBYTE, UPDATE_CHUNK_U32_MAX}`；其中 3 条 chunk 走 kind-first 规则、2 条 ERROR 走字段序规则（`frame[20] ≠ 0x23`，首字段是 scope） | 语料级「计数 + 例外集合」双向锁定：规则过松（多纳）或过紧（漏纳）都红；21 = 13 fixed + 3 chunk + 2 error + 3 connection |

### 8.7 断言纪律（硬约束）

零 `skip`/`only`/`todo`；零 env 读取；零 try/catch 吞错（decode 成功是断言的一部分，失败即测试
红）；零源码字符串/正则断言（不 import 也不 grep `src`）；一切字面量锚定帧字节与公开 API 值面。

### 8.8 用例 ↔ 探针断言面映射（RK-C6 的长期资产等价性）

| 守卫组 | ⊇ 探针 id | 变异点亮对应（B14 实测） |
|---|---|---|
| G1+G2 | P1 | M1（RESYNC_REQUIRED 序换）、M4（UPDATE 前插字段）→ `prefix@20` 红 |
| G3 | P2 | M2（chunk kind 序换）→ `kind@20` 红 |
| G4 | P3 | M3（ERROR optional 块序换）→ 走查错位红 |
| G5 | P4 | M1/M2/M4 的差分值域起点红 |
| G6 | NC1/NC2/NC3 | M2 同时点亮 NC2（规则塌缩时判别性负控**必须**红——正确行为）；NM1/NM2 全绿（不锁实现写法、不越界连接级语义） |

### 8.9 数据流路线

**无运行时数据流变化**（依据：交付物是测试文件，`src/` 零改动（§11 DENY）、wire/协议/持久化
零改动；守卫自身只做纯字节算术 + 公开 API 调用，无计时器/网络/文件 IO——B14 已证确定性、
~3–8s 全量套件耗时）。唯一「新数据」是测试内合成帧与 golden hex 的只读消费，不跨任何模块、
进程或持久化边界。

## 9. 错误、恢复、并发和幂等

- **失败语义（守卫的价值面）**：布局漂移 → 对应断言响亮红，失败消息点名消息型 + 偏移 + 实测值
  （§7.4），可直接定位到具体编码器函数；不存在静默通过路径（变异矩阵 B14 是非恒真证明）。
- **无生产错误面变化**：不新增/不修改任何运行时错误、ProtocolError 分类或失败语义（DENY LIST
  保证）。
- **并发/幂等**：守卫为纯函数式断言，无共享状态、无顺序依赖；vitest `maxWorkers: 1`（B12）下
  与既有 13 文件串行共存，重复运行确定性成立（探针 5 次重复全绿同证）。
- **恢复/回滚**：见 §13-R5（删除单文件即完全回滚）。

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| vitest runner（发现面） | 13 文件/214 测试 | 14 文件/215+ 测试（新文件自然并入 AC5 套件） | 无（include 已覆盖目标路径，占位实测 14/215 绿） | B12/B13 |
| root `pnpm test` / `pnpm typecheck`（CI 门禁） | 绿 | 绿（新文件在包 tsconfig include 内，tsc exit 0 基线） | 无 | B12/B13 |
| `codec-messages-golden.test.ts` 等既有 13 文件 | 绿 | 不受影响（守卫零 fixture 改动、零 src 改动、无全局副作用） | 无 | §7.1/§11 |
| `codec-issue246-doc-contract.test.ts` D6-1（引用文件存在性） | 检查 §22/ADR/CONTEXT 引用的 `*.test.ts` 存在 | 不受影响（本票不改 §22/ADR/CONTEXT → 不新增引用；新测试文件本身不被引用） | 无 | B9/§11 DENY（文档零改动） |
| 未来 edge demux（#420+，尚不存在） | 无布局事实登记点可消费（B11） | 经守卫的钉死块/后续升格常量消费（§13-F1 预留） | 属消费者切片 | B11/§7.2 |
| codec 公开 API 消费者 | 18 型 + 既有导出 | 零变化（SD-1B 不动 `src/index.ts`） | 无 | §7.2 |

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/replication-protocol/test/codec-route-key-guard.test.ts` | **新建**（唯一交付文件；§8 全案：登记块 + 独立走查器 + 6 describe 组） | AC1–AC4 的守卫本体；目标路径发现性已实测（B13） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/replication-protocol/src/**`（含 `constants.ts`/`index.ts`） | SD-1A 候选落点 | Issue 正文「纯增量测试，零行为变化」+ SD-1B 裁决（§7.2）；零行为面门禁：`git diff --stat -- packages/replication-protocol/src` 必须为空 |
| `packages/replication-protocol/test/fixtures.ts` | golden 语料复用源 | 保护 21 条冻结向量与依赖它的既有断言；所需变体在守卫内合成（§7.1） |
| `packages/replication-protocol/test/*.test.ts`（既有 13 文件） | 既有套件 | AC5 要求全量保持绿；本票零回退面 |
| `docs/protocols/instance-replication-v1.md`（含 §22） | 规范依据 | AC 未要求 §22 登记（§13-F2 可选 follow-up）；文档零改动是「纯增量测试」的一部分；避免触碰 D6-1 引用耦合 |
| `docs/adr/0032-*.md` | 已接受 ADR | 只读规范来源 |
| `CONTEXT.md` | 域词条 | 「路由键契约」词条已存在（B15），本票不引入新域词 |
| `packages/ws-replication/**` | edge demux 属 #420+ | 非本票范围（§1 非目标） |
| `wiki/raw/task_issue-419*.md|.mts`、`artifacts/sa6-issue419-*.log` | Host 简报与 SA6 证据 | 只读输入（探针/驱动是 SA6 诊断资产，长期保留） |
| `vitest.config.ts`、根/包 `package.json`、`tsconfig*.json` | 门禁基础设施 | 发现与类型覆盖已就绪（B12），零配置需求 |

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 每种 namespace 域消息型 golden 帧断言 namespaceId 精确偏移与长度前缀 | 探针 P1 绿（7/7 之一） | G2：14 构造 + 13 golden 双面（§8.2） | 全绿；漂移时 `prefix@20`/窗口不等红并点名消息型（M1/M4 实测形态） |
| AC2 UPDATE_CHUNK 三 kind（含首 chunk 绑定块形态）偏移断言 | 探针 P2 绿 | G3：6 组合 + 3 chunk golden（§8.3） | 全绿；kind 序换时 `kind@20` 红（M2 实测形态） |
| AC3 ERROR 四象限字段序守卫 | 探针 P3 绿 | G4：四象限 + 变长 code + 最坏 + 2 golden（§8.4） | 全绿；optional 块序换时走查错位红（M3 实测形态） |
| AC4 同源消费布局常量/解码器、不手抄第二份字段序 | 探针 P4 绿（差分零常量可行） | G1（钉死 + 文法/运行时交叉）+ G5（差分推导）+ 全部值面经公开 API（§8.1/§8.5） | 字面量单点钉死；偏移可由行为面差分复得 |
| AC5 全量既有套件绿灯 | 基线 13 文件/214 绿 + tsc exit 0 | 门禁（下） | 落地后 14 文件/215+ 全绿、Type Errors: no errors |
| 零行为变化（Issue 正文） | SA6 收尾 `git diff` 空 | `git diff --stat -- packages/replication-protocol/src` | 为空 |
| 守卫非恒真（G5 风险） | 变异矩阵两轮 6/6 | RK-C6：实现票复跑 SA6 变异驱动并把两轮结果写入验证日志；同时按 §8.7 映射表确认守卫断言面 ⊇ 探针对应 id | M1–M4 各自红、NM1/NM2 绿、6/6 expected |
| 计数契约（SA6 §12.6 自检） | — | ≥13 型固定偏移 + ≥6 chunk 组合 + ≥5 ERROR 用例（4 象限 + 最坏）+ 3 负控 + 5 变异类 | 守卫文件内用例计数满足 |

**门禁命令**（实现票验收口径，与 SA6 §12.0 一致）：

```bash
# 1) AC5 包全量（期望 14 文件 / 215+ 全绿，Type Errors: no errors）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/replication-protocol
# 2) 包类型检查（新文件在 include 内；exit 0）
pnpm exec tsc -p packages/replication-protocol/tsconfig.json
# 3) CI 级：根 pnpm test / pnpm typecheck
# 4) 零行为面（必须为空输出）
git diff --stat -- packages/replication-protocol/src
# 5) RK-C6 变异敏感性（期望 MUTATION_RESULT 6/6 expected, exit 0；两轮）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts
```

## 13. 风险、回滚和残余问题

| id | 风险/残余 | 评级 | 处置 |
|---|---|---|---|
| R1 | 双向协同漂移：codec 与守卫钉死块（SD-1B）或 codec 与常量（SD-1A）被同一改动协同编辑 → 守卫静默绿 | 低（与 SD-1A 同构） | 背板 = ADR 0032 §4 + 协议 §1/§3/§10.3/§13 规范文本 + 21 条冻结 golden hex（任何 wire 漂移先在 `codec-messages-golden.test.ts` 红）+ 评审纪律；单侧漂移必红已由变异矩阵证明 |
| R2 | 守卫写过松/恒真 | 中 | RK-C6 强制变异复跑 + NC2/NC3 双向判别（规则塌缩即红）+ §8.7 映射表防断言面缩水 |
| R3 | 注册表 append-only 增长（新 namespace-scope 消息型 / 更长错误码）触发 NC2/NC3 精确计数或 ERROR 预算红 | 低（**有意行为**） | 新 namespace 域型必须显式决定「落 [21..56) 固定偏移」或「登记为例外」——这正是守卫的职责；维护契约写入守卫文件头注（新型加入 = 有意识的契约修订） |
| R4 | ERROR mini-decode 预算（≤64）依赖当前注册表最长 code（35B） | 低（有意行为） | 错误码增长越过预算即红 → 逼迫重估 edge 预算（SA6 §15.3 已登记该耦合；不影响 key 位置事实本身） |
| R5 | 回滚 | 平凡 | 删除单一测试文件即完全回滚；零生产耦合、零配置残留 |
| F1 | **follow-up（消费驱动的登记升格）**：edge demux 切片（#420+，ADR 0032 决策 3/4）落地时，把布局事实升格为 `src/constants.ts` 追加 + `src/index.ts` 导出（预留名：`NAMESPACE_ID_BYTES`、`NAMESPACE_ID_VARSTRING_PREFIX_BYTES`、`NAMESPACE_DOMAIN_NAMESPACE_ID_OFFSET`、`UPDATE_CHUNK_NAMESPACE_ID_OFFSET`），守卫登记块改为消费常量 + 保留 G1 钉死断言；该票同时裁决 CONTEXT/§22 是否登记 | — | 建议路由：随 edge demux 实现票一起评审（公共 API append-only 面变更须与其消费者同票）；本设计不预支 |
| F2 | **follow-up（可选）**：把守卫文件登记进协议 §22 conformance 资产清单 | — | AC 未要求；若做须连带跑 D6-1 引用存在性检查；留给 Controller 裁决 |
| F3 | SA6 两处证据笔误已由本设计修正（§7.5），SA6 契约文件本身不改（只读上游产物） | — | 实现票以本设计 §8 矩阵为准 |

**任务内解决项**：无遗留——SD-1 已裁决、守卫结构已定案、全部断言面有探针种子与变异证明。
**未证实假设**：无（SA6 §8 同判；所有断言均已在真实 codec 字节上实测）。

## 14. 评审修订映射

本轮为 iteration 0，`wiki/raw/task_issue-419_sa2_review.md` 不存在——无评审 finding 可映射；
章节保留占位，出现评审输入后按技能纪律逐条落实。

## 15. 是否需要设计后 ADR 冲突复查及理由

**需要（`requiresConflictRecheck = true`，窄幅）。** 理由：

1. **SA8 产物缺失**（§6）：无既有决议/冲突报告可对齐；本设计以 ADR 0032 §4 + 协议规范替代
   推导硬约束（技能纪律：缺 SA8 产物 → 读相关 ADR 并标记冲突复查）。
2. **对上游推荐案做了范围裁决**：SA6 §12.5 推荐 SD-1A（codec 侧常量登记）并认为其「更契合
   ADR 0032 §4『登记为同步维护契约』语义」；本设计裁决本票取 SD-1B、SD-1A 延后到消费者切片
   （§7.2/F1）。该裁决的直接依据是 Issue 正文的 test-only 范围（Owner 最高优先级输入）与
   RK-C4 的双实现条款，**不与任何已接受 ADR 文本冲突**（ADR 0032 §4 的字面命令「codec 侧加
   结构性守卫测试」由本设计完整落实），但「登记」一词的解释空间值得一次轻量复查背书。
3. **复查范围应当很小**：设计本身 test-only、零 wire/零公共 API/零文档改动、不触碰任何 ADR
   冻结面、不修订任何已接受决策（SD-1 是 SA6 显式留给设计的开范围决策）——复查焦点仅为
   §7.2 的 SD-1B 裁决与 ADR 0032 §4 语义的相容性，以及 §7.5 两处 SA6 证据笔误修正的采信。
