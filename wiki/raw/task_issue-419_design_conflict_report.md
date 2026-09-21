# task_issue-419 设计冲突复查报告（SA8 / conflict-gate）

- Reviewed subject: **design**（`wiki/raw/task_issue-419_design.md`，iteration 0，首次产出）
- Dispatch：`sa-b1efec94-c5eb-4de3-999f-3a4c51edb0fc`（mabf-sa8，phase conflict-gate）
- Verdict：**clear**（裁决分布：`implements-existing-decision` ×1，`no-conflict` ×11，`evolution-required` ×0，`hard-conflict` ×0）
- requiresConflictRecheck：**false**（§10 给出理由；设计 §15 自请的窄幅复查由本报告闭合）
- 本报告为 SA8 唯一产物；未修改任何被审对象、决策文档、代码或测试，未运行测试。

## 1. Inputs and decision set

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-419_design.md` | 被审对象（SA1 设计，iteration 0） | 逐条对照 |
| `wiki/raw/task_issue-419.md` | Host 简报（Issue #419 正文，state=open） | Owner 要求来源 |
| `wiki/raw/task_issue-419_sa6_contract.md` | SA6 验收契约（approve）+ 探针/变异驱动两份 `.mts` 与 5 份 `artifacts/sa6-issue419-*.log` | 上游契约与可执行证据 |
| SA2 review（`task_issue-419_sa2_review.md`） | **不存在**（设计 §14 自述；本轮 glob 亲证） | 无评审 finding 可交叉 |
| Issue 评论 REST 快照 | **空（`[]`）**（dispatch 明示；SA6 §2 同证） | 无 Owner 评论 override、无评论 ID/时间戳可落实；Owner 要求 = Issue 正文 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 已接受（影响包 `@nomicore/ws-replication`；wire/协议语义零变化） | 路由键契约唯一规范来源 |
| `docs/adr/0010`、`0013`、`0022` | 已接受，均未被 superseded（0013/0022 状态行明示 wire 冻结值以协议文档为唯一权威） | 复制架构与分块传输冻结面 |
| `docs/protocols/instance-replication-v1.md` | 已接受（规范 wire contract） | §1/§3/§4/§5/§10.3/§13/§22 逐节亲读 |
| `CONTEXT.md` L225–227（复制 Edge）、L233–235（路由键契约） | 域词条 | 「登记」语义的域内权威解释 |
| `packages/replication-protocol/AGENTS.md` | 模块决策（边界 + 验证门） | 公共 API/注册表/fail-closed 边界 |
| 源码与测试事实 | `src/constants.ts`、`src/messages.ts`、`src/index.ts`、`src/limits.ts`、`test/fixtures.ts`、`vitest.config.ts`、包 tsconfig、`git log -1`（HEAD `27e012b6…`） | 确认设计证据锚点，不替代决策文本 |

ADR 状态核查：仓内 32 份 ADR 无一份被整体 supersede 与本任务相关（0016/0024/0027 的修订关系均在 VFSL 读面族，与本票无关）；ADR 0015 为「提议」状态，不构成约束。冲突基准中不含代码与 wiki 其他文档。

## 2. Decision analysis

| # | Decision | Clause | Subject behavior（设计行为） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 §4（决策 4） | 「路由键布局与 codec 字段序登记为同步维护契约，**codec 侧加结构性守卫测试**」（L26） | 设计交付单一守卫测试文件 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（§8：登记块 + 6 describe 组 + 独立走查器），兑现该明令但尚未实现的义务 | **implements-existing-decision** | ADR 0032 L26；设计 §1 目标、§8 全案；仓内现状零守卫（SA6 §5-A/B/D） | 无——本设计即义务的兑现载体 |
| 2 | ADR 0032 §4（决策 4） | namespaceId 恒在 `[21..56]`、UPDATE_CHUNK 因 kind 首字段在 `[22..57]`、varString 前缀恒 1 字节、OPEN 全解码 / ERROR 有界 mini-decode 两例外（L26） | 设计 §8.0 钉死块（20←codec 导出、35、1，派生 21/22/56/57）+ §8.2/§8.3 断言矩阵 + §8.4 ERROR 例外走查，全部与该条款一致 | no-conflict | ADR 0032 L26；协议 §1 L11（`^ns-[0-9a-f]{32}$`）、§3 L49–59（20B 头）、§4 L79–85（varString 首字段）；fixtures hex 亲证（OPEN_NAMESPACE payload 首 2 字节 `23 6e73…`；ERROR_NS `01 14 …` 首字段是 scope 非 0x23） | 无。注：ADR 散文区间记法 `[21..56]` 与设计半开窗 `[21,56)`/`subarray(21,56)` 均指自 21 起 35 字节窗口（21+35=56），语义一致，非实质分歧 |
| 3 | **ADR 0032 §4「登记为同步维护契约」× SD-1B 裁决**（本复查核心） | 同上 L26：「登记」一词是否要求 codec `src/` 侧导出常量（SD-1A） | 设计 §7.2 裁决 **SD-1B**：`src/constants.ts`/`src/index.ts` 零改动，布局字面量在守卫文件顶部单一冻结块 + 行为面交叉核对（文法/运行时/差分推导）；SD-1A 的常量名预留并延后到消费者切片（§13-F1） | **no-conflict** | （a）ADR L26 对 codec 侧的可操作命令字面 = 「加结构性守卫测试」，未命令导出常量；（b）CONTEXT.md L234 对同一决策的域内权威解释：「与 codec 字段序同步维护，**由结构性守卫测试锁死**」——锁定机制被明示为守卫测试而非 `src/` 常量；（c）Issue 正文「纯增量测试，零行为变化」（Owner 最高优先级输入）且评论快照为空（无放宽）；（d）SA6 §12.5 自留回退条款：「若 SA8 判定本 issue 必须绝对 test-only，则取 SD-1B，且 RK-C1–C3 与变异矩阵不变」——Issue 正文的 test-only 范围触发该条款；（e）ADR 0032「后果」节冻结的是 edge/session 公开面（尚不存在），不含 codec 内部常量布局 | 无——SA8 裁定 SD-1B 与 ADR 0032 §4 文本及 CONTEXT 词条相容；F1 保留升格路径，未封闭任何未来决策 |
| 4 | `packages/replication-protocol/AGENTS.md`（Boundaries） | 「Add public APIs only through `src/index.ts`; exported types and runtime codec behavior must evolve together」（L14） | SD-1B 不新增任何公共 API；守卫只 import 既有导出（`encodeMessage`/`decodeMessage`/`MESSAGE_REGISTRY`/`CONNECTION_ERRORS`/`NAMESPACE_ERRORS`/`ENVELOPE_HEADER_BYTES`/`CAP_CHUNKED_UPDATE`，亲证均在 `src/index.ts` 导出）与 `./fixtures` | no-conflict | AGENTS.md L14；设计 §7.1/§7.2；`src/index.ts` L8–15、L16、L24、L53–56 | 无。注：F1 落地票（追加常量导出）属公共 API append-only 面变更，届时须自带冲突门禁 |
| 5 | `packages/replication-protocol/AGENTS.md`（Boundaries） | 「Treat message codes, capability bits, error codes… as compatibility registries. Extend append-only… never renumber or silently reinterpret」（L11） | 守卫消费注册表值面并断言精确计数（NC2：namespace-scope 恰 14 型、18 键注册表）；R3 把「注册表增长触发计数红」登记为有意行为，守卫头注写明维护契约 | no-conflict | AGENTS.md L11；`src/messages.ts` L80–102（18 键：3 connection + ERROR either + 14 namespace，亲证）；设计 §8.6/§13-R3 | 无——计数锁迫使新型加入时显式决定「落定偏移或登记例外」，正是 append-only 纪律要求的有意识演进；实现时须落实 R3 的头注维护契约文字 |
| 6 | 协议 §10.3（UPDATE_CHUNK `0x42` 单形态，issue #295/ADR 0022） | 字段序 kind(varUint) → namespaceId → transferId → chunkIndex → chunkCount → totalBytes → bytes；绑定块当且仅当 `kind≠0 ∧ chunkIndex=0`，位于 totalBytes 之后、bytes 之前（L311–323） | 设计 §8.3 断言 kind-first（`[22..57)`）、三 kind 枚举全覆盖、首/非首绑定块不位移 namespaceId、6 组合 + 3 条 chunk golden 双面 | no-conflict | 协议 L311–323；`test/fixtures.ts` L365–400（kind 分配注释与三条 chunk golden hex 亲证） | 无 |
| 7 | 协议 §13（ERROR 字段序） | scope(u8) → code(varString) → fatal → retryable → relatedSequence? → namespaceId? → safeMessage；「Encoder从 code registry导出 scope/fatal/retryable…调用方不能 override」（L381–393） | 设计 §8.4 用独立最小读取器按 §13 序走查：注册表同源断言 fatal/retryable、optional marker 出现性、relatedSequence 先于 namespaceId、safeMessage 恰好全消费、连接级字节级无 key | no-conflict | 协议 L381–393；fixtures ERROR_CONN/ERROR_NS hex 逐字段亲证（`00 09 BAD_MAGIC…` / `01 14 SYNC_STATE_VIOLATION 01 00 01 0c 01 23…0e…`） | 无 |
| 8 | ADR 0013 / ADR 0022 状态行 | wire 冻结值（0x42 字段序、错误码/reason 词表）以协议文档为唯一权威；ADR 0032 状态行「wire 格式与协议语义零变化」 | 设计 §11 DENY：`src/**`、wire、协议文档、ADR、CONTEXT 零改动；§12 门禁 4（`git diff --stat -- packages/replication-protocol/src` 必须为空） | no-conflict | ADR 0013/0022/0032 状态行；设计 §11/§12 | 无 |
| 9 | 协议 §22（Conformance tests） | 既有清单（golden/roundtrip/截断/fail-closed/互通矩阵/资产锚）不得回退；§22 未列路由键守卫资产 | 设计不改 §22（F2 把登记留作可选 follow-up 给 Controller）；AC5 门禁保全量既有套件绿 | no-conflict | 协议 §22 L687–708（无路由键守卫条目；资产锚仅覆盖既有 issue 家族）；设计 §11/§13-F2；AC1–AC5 未要求 §22 登记 | 无——若 Controller 采纳 F2，须连带跑 D6-1 引用存在性检查（`codec-issue246-doc-contract.test.ts:338` 亲证存在） |
| 10 | ADR 0032 §4（ERROR 例外条款） | 「ERROR 的 namespaceId 在变长字段后，edge 对其特例跑**几十字节**的有界 mini-decode」（L26，无数值规范） | 设计 §8.4 断言 6：namespaceId 距 payload 起点 ≤ `ERROR_NS_PREFIX_BUDGET`（64；实测最坏 46）；R4 把越界红登记为有意行为 | no-conflict | ADR 0032 L26（仅定性「几十字节」）；SA6 §12.3-6/§15.3；设计 §8.4/§13-R4 | 无——64 是测试局部上界断言（锁定派生事实），非新规范预算；未来 edge 切片自行裁决预算时按 SA6 §15.3 同步该断言即可 |
| 11 | 上游契约事实修正（设计 §7.5） | SA6 §12.2 称 `UPDATE_CHUNK_U32_MAX` 为「kind2 首+绑定块」；探针头注称「18 golden」 | 设计以源码事实为准：U32_MAX 实为 kind2 **非首**（`chunkIndex=0xfffffffe`、hex 无 syncRoundId）；语料计数以 21 为准（13+3+2+3）；守卫覆盖矩阵不变（kind1/kind2 首 chunk 绑定块由合成用例补齐） | no-conflict | `test/fixtures.ts` L391–400（transferKind=2、chunkIndex=0xfffffffe、payload hex 逐段亲证无绑定块）；L252–401 全量清点 = 21 条；探针 L28 注释「18 golden」vs L377 遍历全量 `GOLDEN`（陈旧注释，代码计数正确） | 无——SA6 契约文件是输入证据而非决策文本；实现票以设计 §8 矩阵为准（设计 §13-F3） |
| 12 | SA6 契约 §3-4 测试纪律（无 skip/only/todo、无 env override、无 fallback、无吞错、无源码字符串/正则断言） | 契约明文 | 设计 §8.7 断言纪律全项承接；探针的 `SA6_CODEC_SRC` env 机制明示不进守卫测试 | no-conflict | SA6 契约 §3-4；设计 §6/§8.7 | 无 |

补充核查（不构成独立行）：设计 B5（18 型注册表构成）、B8（21 条 golden 构成）、B11（`packages/ws-replication/src` 无 edge/session-host 模块，亲证目录清单）、B12（vitest include `packages/*/test/**/*.test.ts` 与包 tsconfig include `test/**/*.ts`，亲证）、B15（CONTEXT.md L233–235 词条原文）、`DecodeOptions.selectedCapabilities` 为真实既有选项（`src/limits.ts` L27–32）——均与源码事实一致，未发现失实证据锚点。

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

无需任何 override：SD-1B 不是对既有决策的覆盖，而是对 ADR 0032 §4 字面命令（「codec 侧加结构性守卫测试」）的直接落实；SA6 §12.5 的 SD-1A 仅是上游**推荐**（推荐者自留 test-only 回退条款，且 SA6 非决策当局）；Issue 正文 + 空评论快照界定的 test-only 范围是 Owner 最高优先级输入。实现方便利、测试通过、已有代码均未被用作 override 依据。

## 4. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计实际方案） |
|---|---|---|---|
| Wire 格式 | 20B envelope 布局、各 payload 字段序（§4/§10.3/§13）、消息码、错误码、capability 位 | 协议 §3/§4/§5/§10.3/§13；ADR 0013/0022 状态行 | 不触碰（测试只读观察帧字节；§11 DENY `src/**`；§12 门禁 4 零 src diff） |
| 21 条 golden 向量字面量 | `test/fixtures.ts` `GOLDEN` 冻结 hex 与依赖它的既有断言 | fixtures L252–401；协议 §22 | 不追加不改写（§7.1：变体在守卫文件内合成；§11 DENY fixtures.ts） |
| 公共 API（`@nomicore/replication-protocol`） | append-only，只经 `src/index.ts`，导出类型与运行时行为同步演进 | 包 AGENTS.md L14 | 零新增导出（SD-1B）；守卫仅消费既有导出 |
| 协议 §22 conformance 清单与既有 13 个测试文件 | 既有套件全绿不回退 | 协议 §22；AC5；设计 B13 基线（13 文件/214 绿） | §12 门禁 1/3 全量跑；§11 DENY 既有 `*.test.ts` |
| ADR 0032 / CONTEXT.md 词条 | 决策与术语文本 | docs/AGENTS.md「Authority」 | 只读规范来源（§11 DENY）；不引入新域词 |
| edge/session 公开面 | 一经发布按 SA6 纪律冻结（当前尚不存在） | ADR 0032「后果」L43 | 不存在即不触碰；F1 把常量升格留给消费者切片并要求届时同票评审 |

## 5. Evolution requirements

无 `evolution-required` 项。本设计零契约变更：不修订任何 ADR/CONTEXT/协议条款，无新旧语义、迁移、版本或失败语义更替。两项 follow-up 均为**延后决策**而非本票修订义务：

- **F1**（消费驱动的常量升格）：属未来 #420+ edge demux 票的公共 API append-only 变更，该票须自带设计 + 冲突门禁（含 SD-1A 落位、CONTEXT/§22 登记裁决）。
- **F2**（§22 资产登记，可选）：Controller 裁决项；采纳时须连带 D6-1 引用存在性检查。

## 6. Hard conflicts

无。未发现任何与已接受决策不兼容且无合法 override 的行为；设计的 DENY LIST（§11）与零行为面门禁（§12 门禁 4）把实现票的改动面钉在单一测试文件。

## 7. Required actions

1. **实现票**：按设计 §8/§11/§12 落地——单一新文件、`src/` 与 `fixtures.ts` 与文档零改动、门禁 1–5（含 RK-C6 变异矩阵复跑）全过。
2. **实现票**：落实设计 §13-R3 的守卫头注维护契约文字（「新型加入 = 有意识的契约修订」），使注册表 append-only 纪律与计数红的因果关系在资产内自解释。
3. **Controller（可选）**：裁决 F2（是否把守卫文件登记进协议 §22）；采纳则连带 D6-1。
4. **未来 #420+ edge demux 票**：F1 升格 + mini-decode 预算裁决须随该票重新过 SA8 冲突门禁（公共 API 面 + ERROR 预算耦合）。

## 8. Verdict

**clear** —— 12 项对照中 1 项 `implements-existing-decision`（ADR 0032 §4 守卫测试义务的兑现）、11 项 `no-conflict`；无 `evolution-required`、无 `hard-conflict`、无未闭合 override。设计 §7.5 对 SA6 两处证据笔误的修正经源码亲证成立。设计自身标记的开放点（SD-1 裁决）经本报告裁定与决策集相容。

## 9. requiresConflictRecheck

**false**。理由：

1. 设计 §15 自请的窄幅复查的两个依据均由本报告闭合：（a）SA8 产物缺失——本报告即首份设计冲突复查；（b）SD-1B 与 ADR 0032 §4「登记」语义的相容性——§2 行 3 已裁定 no-conflict。
2. 按技能规则，该标志在「公共 API、wire、schema、持久化、状态机、生命周期、失败语义或正式 override 尚待实现核对」时为 true。本设计为纯 no-conflict + 无新决策面的 existing-decision 兑现：实现票 diff = 单一测试文件，零公共 API/wire/持久化/状态机/失败语义变更，无正式 override；零行为面门禁（`git diff --stat -- packages/replication-protocol/src` 为空）在实现票验收中直接可核。
3. F1/F2 属未来票的决策面，其冲突门禁随各自任务触发，不在本标志的承接范围内。
