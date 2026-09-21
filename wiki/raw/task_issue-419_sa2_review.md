# task_issue-419 SA2 设计攻击评审 — 路由键契约 codec 守卫测试（spec #415 T1）

- Reviewed subject：`wiki/raw/task_issue-419_design.md`（SA1 设计，iteration 0，首次产出）
- Dispatch：`sa-950be66e-cfd0-4dbe-8cb2-896f70c6fc0b`（mabf-sa2，phase design-review，iteration 0）
- Verdict：**approve**（无 BLOCKER / 无 MAJOR；4 条非阻断观察，见 §13/§14）
- 本文件是唯一可写产物；未修改设计、生产代码、测试或其他 SA 产物。

## 1. Reviewed inputs

| 输入 | 状态 | 本轮核验方式 |
|---|---|---|
| `wiki/raw/task_issue-419.md`（Host 简报） | 存在 | 全文亲读；Issue #419 正文 + AC1–AC5 + 空评论 |
| `wiki/raw/task_issue-419_sa6_contract.md`（已批准契约） | 存在 | 全文亲读；RK-C1–C7 / SD-1 / 变异矩阵 / §12.0 门禁逐条比对 |
| `wiki/raw/task_issue-419_sa6_route_key_probe.mts`（探针 P1–P4/NC1–NC3） | 存在 | 全文亲读（416 行）；设计引用的 L28/L84–101/L111–120/L128–145/L148–159/L162–169/L223–262/L298–337/L377–405 逐段核对一致 |
| `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts`（M1–M4/NM1/NM2） | 存在 | 全文亲读；副本机制（cp→单点替换→SA6_CODEC_SRC→自清理）与锚点唯一性检查（L188–194）确认 |
| `artifacts/sa6-issue419-*.log` ×5 | 存在 | 结论行亲证：`RESULT 7/7 passed`、两段 `MUTATION_RESULT 6/6 expected`、占位 14 文件/215 绿→洁净基线 13 文件/214 绿、tsc EXIT=0 |
| `wiki/raw/task_issue-419_design_conflict_report.md`（SA8 冲突门） | **存在**（22:45:39 生成，晚于设计 22:40:34——设计 L11「不存在」声明在写作时点为真，git status + mtime 亲证） | 全文亲读；verdict `clear`（1 × implements-existing-decision + 11 × no-conflict），`requiresConflictRecheck=false`，已裁定 SD-1B 与 ADR 0032 §4 相容 |
| `wiki/raw/task_issue-419_relevant_decisions.md` / `_conflict_report.md` | 不存在（glob 亲证） | 无既有决议/冲突产物；SA8 冲突门报告为替代闭环 |
| 源码与测试 | — | `src/constants.ts`、`src/index.ts`、`src/messages.ts`、`src/errors.ts`、`src/payloads.ts`（encodeError L320–349 / encodeUpdateChunk L728–812 亲读）、`src/canonical.ts`、`src/limits.ts`、`test/fixtures.ts`、`test/codec-envelope.test.ts`、`test/codec-issue299-ac-red.test.ts`、`test/codec-issue246-doc-contract.test.ts`、`test/codec-package-contract.test.ts`、`test/codec-messages-golden.test.ts`、`vitest.config.ts`、包 `tsconfig.json`、根 `package.json` |
| 规范文本 | — | `docs/adr/0032-transport-decoupling-edge-session-split.md` §4（L24–26）全文；`docs/protocols/instance-replication-v1.md` §1/§3/§4/§5/§10.3/§13 逐节；`CONTEXT.md` L233–235（路由键契约词条） |
| Issue 评论 REST 快照 | **空（`[]`）**（dispatch 明示） | 无 Owner 评论要求、无评论 ID/时间戳可映射 |

## 2. Verdict

**approve**。设计的任务定类（Feature / 纯增量测试，baseline-green + mutation-red）、交付形态（单一测试文件）、SD-1B 裁决、守卫结构（6 describe 组）、断言面（运行时帧字节 + 公开 API 值面 + 独立走查器）、文件范围（ALLOW 单文件 + DENY 全覆盖）与验收映射（AC1–AC5 + RK-C1–C7 + 门禁五条）全部经本轮源码级独立核验成立；对 SA6 契约的两处证据笔误修正经 fixtures 源码亲证为真；设计自请的窄幅冲突复查已由其后生成的 SA8 冲突门报告（clear）闭合。无阻断 finding。

## 3. 需求覆盖

| Requirement（Issue 正文 / AC） | Design section | Assessment |
|---|---|---|
| 「为 ADR 0032 的路由键契约…落地结构性守卫测试」 | §1 目标、§8 全案 | 落实。ADR 0032 §4 L26 明令「codec 侧加结构性守卫测试」，守卫文件落在 `@nomicore/replication-protocol`（行为 Owner 包） |
| 「锁死 namespace 域帧 namespaceId 定偏移布局（前缀恒 1 字节、[21..56]）」 | §8.0 钉死块、§8.2 G2（14 构造 + 13 golden 双面） | 落实。13 型清单与 `MESSAGE_REGISTRY` 14 个 namespace-scope 型（去 UPDATE_CHUNK）逐一吻合（`src/messages.ts` L80–102 亲证）；golden 双面含 `encodeMessage(g.message, { sequence: g.sequence })`（`EncodeOptions.sequence` 真实存在，`src/limits.ts` + 既有测试同款用法亲证） |
| 「UPDATE_CHUNK kind 首字段偏移（namespaceId 在 [22..57]）」 | §8.3 G3（6 组合 + 3 chunk golden） | 落实。字段序与 `encodeUpdateChunk` 写序（L797–811）逐字段一致；kind ∈ {0,1,2} 均 < 0x23 的可判别断言在位 |
| 「ERROR payload 字段序（code → fatal → retryable → relatedSequence? → namespaceId? → safeMessage）」 | §8.4 G4（四象限 + 变长 code + 最坏 + 2 golden） | 落实。走查序与 `encodeError`（L332–348）及协议 §13（L381–393）逐字段一致；fatal/retryable 同源消费错误注册表（`entry.fatal` / `entry.retryable !== 'no'`，与 codec 写侧公式逐字同形） |
| 「codec 字段序一旦漂移，测试响亮失败——edge 的 O(帧头) demux 依赖这些布局事实」 | §7.4 失败语义（消息型+偏移+实测值）、§12 RK-C6 变异复跑门禁 | 落实。失败消息模板直接沿用探针实测形态（`prefix@20 = X ≠ 0x23` 等，变异日志亲证点名消息型） |
| 「纯增量测试，零行为变化」 | §7.2 SD-1B、§11 DENY（`src/**` 零改动）、§12 门禁 4（`git diff --stat` 为空） | 落实。这是 SD-1 裁决的 Owner 文本依据（见 §5） |
| AC1–AC5 | §12 验收映射表 | 落实，与 SA6 §2 映射逐条同构；AC5 门禁 = 包全量（发现性/类型覆盖/config 亲证，见 §11） |
| 「Blocked by: None」+「重发：前票 #417 已关闭」 | §4 末行 | 无等待项，#417 无追加要求 |

## 4. Owner评论覆盖

Issue 评论 REST 快照 = `[]`（dispatch 明示，SA6 §2 同证）：**无评论 ID / updated_at / 作者可映射**。Owner 要求 = Issue 正文，已在 §3 逐条覆盖。设计 §4 明确记录该事实且未虚构评论义务——合规。

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 RK-C1（逐型 golden 固定偏移，golden 字节 + 重编码字节双面） | §8.2 | 满足且更精确：重编码显式带 `{ sequence: g.sequence }`（比契约 §12.1 的裸 `encodeMessage(golden.message)` 更准确——sequence 缺省 1 会改写 header 字节，虽不影响 payload 偏移断言） |
| SA6 RK-C2（3 kind × 首/非首，绑定块不位移，可判别） | §8.3 | 满足；契约 §12.2 对 `UPDATE_CHUNK_U32_MAX` 的「kind2 首+绑定块」描述与 fixtures 事实不符（见下），设计 §7.5 修正后覆盖矩阵仍 6 组合全量 |
| SA6 RK-C3（ERROR 四象限 + 独立最小读取器 + 预算 ≤64） | §8.4 | 满足；断言 1–8 ⊇ 契约 §12.3 断言 1–7（断言 8 的最坏公式 `1+1+35+1+1+1+5+1=46` 经 `encodeError` 写序逐项重算吻合；最长 namespace 错误码 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`=35B 经 `src/errors.ts` 26 码逐个长度比对确认为最长） |
| SA6 RK-C4（同源消费，不手抄第二份字段序；字面量一处钉死） | §8.0 钉死块 + §8.1 G1 + §8.5 G5 | 满足（SD-1B 路径）：20 ← codec 导出 `ENVELOPE_HEADER_BYTES`（G1-a 钉死）；35/1 单点钉死；21/22/56/57 派生不手写；值面 ← `encodeMessage`/`decodeMessage`/注册表；偏移 ← 差分推导（探针 P4 可执行证明）。独立走查器硬编码 §13 走查序是 RK-C3 明令的断言侧 oracle，经 M3 实测敏感 + `decodeMessage` 值面交叉核对，不构成「第二份可漂移字段序」 |
| SA6 RK-C5（NC1–NC3 无漂移全绿） | §8.6 G6 原样保留 | 满足；三条负控断言面与探针 L341–406 逐条等价（含 NC3 例外集合 8 元素逐名一致） |
| SA6 RK-C6（变异矩阵复跑 + 结果写入验证日志） | §12 门禁 5 + §8.7 映射表 | 满足；§8.7「守卫 ⊇ 探针」映射本轮逐组独立复核成立（G1+G2⊇P1、G3⊇P2、G4⊇P3、G5⊇P4、G6⊇NC1–NC3，逐断言清单见 §12） |
| SA6 RK-C7（三命令 + 零行为面） | §12 门禁 1–4 | 满足；命令与 SA6 §12.0 逐字一致 |
| SA6 SD-1（开放范围决策，推荐 A、回退 B） | §7.2 裁决 B + §13-F1 升格路径 | 相容。B 是契约明文的合法实现路径（「若判定本 issue 必须绝对 test-only，则取 SD-1B，且 RK-C1–C3 与变异矩阵不变」）；Issue 正文「纯增量测试，零行为变化」+ 空评论快照构成 test-only 范围依据；SA8 冲突门已裁定与 ADR 0032 §4「登记为同步维护契约」no-conflict（CONTEXT.md L234 把锁定机制明示为「由结构性守卫测试锁死」，非 `src/` 常量） |
| SA6 §12.2 对 `UPDATE_CHUNK_U32_MAX` 的形态描述 | §7.5-1 修正（kind2 非首、无绑定块） | **修正经独立亲证成立**：`test/fixtures.ts` L391–400（transferKind=2、chunkIndex=0xfffffffe、payload hex 无 syncRoundId）+ L369–370 kind 分配注释同向；首 chunk 绑定块覆盖由合成用例承担（kind1-first/kind2-first，探针 chunkMessages L154/L156 即种子），6 组合覆盖不减 |
| SA6/探针头注「18 golden」 | §7.5-2 修正（语料实为 21） | 修正亲证成立：探针 L28 注释 vs L377 遍历全量 `GOLDEN` + L401 计数断言；fixtures L252–401 清点 = 21（13+3+2+3） |
| SA8 设计冲突门（`_design_conflict_report.md`，clear） | 设计 §15 自请窄幅复查 | 已闭合：SA8 裁定 12 项对照无冲突、SD-1B 相容、requiresConflictRecheck=false；其 Required actions（R3 头注、F2 留 Controller、F1 随消费者切片）与设计 §13 一致 |
| ADR 0032 §4 全部布局事实（[21..56)/[22..57)/前缀 1B/OPEN 全解码/ERROR 有界 mini-decode） | §8 断言矩阵 + §8.4 例外走查 | 逐项落实（ADR L24–26 亲读；区间记法 `[21..56]`（ADR 散文）与 `[21,56)`/`subarray(21,56)`（设计/探针）均指 21 起 35 字节窗口，语义一致） |

## 6. 设计内部一致性

- **正文 ↔ 伪代码 ↔ 断言矩阵**：§0 摘要的六点结论与 §7 决策、§8 详案、§11 范围、§12 门禁、§13 风险逐项对得上；§8.0 钉死块的派生关系（20+1=21、21+1=22、+35=56/57）算术正确且与「偏移字面量仅派生出现」的自我约束不矛盾（20/35/1 各恰一处）。
- **接口签名真实性**：`encodeMessage(msg, { sequence })`、`decodeMessage(frame, { selectedCapabilities: CAP_CHUNKED_UPDATE })`、`MESSAGE_REGISTRY[kind].scope`、`CONNECTION_ERRORS`/`NAMESPACE_ERRORS` 条目 `fatal`/`retryable`、`ENVELOPE_HEADER_BYTES`——全部经 `src/index.ts` 导出面 + `src/limits.ts` 选项面 + 既有测试同款用法（`codec-package-contract.test.ts` L86/L89）亲证存在。
- **无死引用/旧 API**：设计引用的探针行号、fixtures 行号、测试文件行号（envelope L52–65、issue299 L285–290、D6-1 于 issue246 L338）本轮全部命中且内容相符。
- **时间线声明**：设计称三份 SA8 产物不存在——写作时点（22:40:34）为真；冲突门报告 22:45:39 生成后已闭合设计 §15 的自请复查，无需设计改文（其结论与设计裁决同向）。
- **唯一发现的内部不精确**（非阻断，见 §14-O1）：B2 称「`NAMESPACE_ID_RE` 已导出」——它在 `src/constants.ts` L32 是模块级导出，但**未**经 `src/index.ts` re-export，不在包公共 API 面。设计 §7.1 的守卫 import 清单正确地不含它、G1-b 机制（encode 接受面）也不依赖它，故无实际依赖断裂；风险仅为实现者若按 B2 字面从包根 import 会在编译期响亮失败（不静默）。

## 7. 状态机与并发攻击

生产面零状态机变化（`src/` 零改动、DENY LIST 钉死），可攻击面只剩测试资产与验证工具自身：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| S1 | 干净仓（HEAD `27e012b`） | 实现票加入守卫文件后跑包全量 | 14 文件/215+ 绿、Type Errors: no errors（占位实测已证 14/215） | 无（发现性/类型覆盖/tsc include 三链亲证） | 无 |
| S2 | 守卫文件在位 | 重复运行 / 与既有 12 个 `.test.ts` + 1 个 `.test-d.ts` 并存 | 确定性全绿（探针 5 次重复同证；`maxWorkers: 1` 串行共存，vitest.config.ts L17 亲证） | 无 | 无 |
| S3 | 变异驱动运行中 | M1–M4/NM1/NM2 逐个施加于 `.scratch/sa6-419/mutants/<id>/src` 副本 | 每轮运行后副本删除、收尾删 scratch 根；锚点命中数 ≠1 时 SETUP-FAIL 且不计通过 | 无（驱动 L27–35/L188–194/L213/L216 亲读；SA6 §16 收尾复核） | 无 |
| S4 | 注册表 append-only 增长（新 namespace-scope 型 / 更长错误码） | 守卫 NC2/NC3 精确计数或 ERROR 预算断言 | 响亮红（有意行为：新型必须显式决定落定偏移或登记例外） | 无——R3/R4 已把该红登记为维护契约，头注要求与 SA8 Required action 2 对齐 | 无 |

无非法状态转换、重复事件、幂等或重启类缺口：交付物是无共享状态的纯断言资产，回滚 = 删除单文件（R5）。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E1 | 布局漂移（字段序换/前插字段/optional 块换序） | 对应断言响亮红，失败消息点名消息型+偏移+实测值（M1–M4 两轮实测形态） | 无静默通过路径——变异矩阵是「非恒真」的可执行证明 | 无 |
| E2 | 守卫写过松/恒真 | RK-C6 强制复跑变异矩阵 + NC2/NC3 双向判别（规则塌缩即红，M2 点亮 NC2 实证）+ §8.7 ⊇ 映射防断言面缩水 | 已覆盖 | 无 |
| E3 | 走查器自身笔误 | 值面经 `decodeMessage` 交叉核对（G4-8）+ golden 字节锚 | 已覆盖 | 无 |
| E4 | 断言内 decode 抛错 | §8.7 零吞错纪律：decode 成功是断言一部分，失败即测试红 | 已覆盖 | 无 |
| E5 | 「当前代码即红」的假红（环境/fixture/入口错误） | baseline-green 形态明令禁止伪造红灯（SA6 H2 + 设计 §5/§13） | 已覆盖 | 无 |
| E6 | fatal/retryable 位编码漂移（如对 fatal=false 码写 1） | G4-8 的 `decodeMessage` 交叉核对即背书：`decodeError` L278–285 对位-注册表不一致抛 MALFORMED_FRAME → 守卫红 | 已覆盖（见 §14-O3 的可选强化） | 无 |

无回滚/清理缺口：单一交付文件、变异副本自清理、无配置残留。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| vitest 发现面 | 无：include `packages/*/test/**/*.test.ts` 覆盖目标路径，占位实测 14 文件/215 绿后删除 | `vitest.config.ts` L15；`sa6-issue419-runner-trigger.log` | 无 |
| 根 `pnpm test` / `pnpm typecheck` | 无：两 script 均含本包环节；包 tsconfig include `src/**/*.ts + test/**/*.ts` 使新文件受类型门禁 | 根 `package.json` L11/L13；包 `tsconfig.json` L3 | 无 |
| 既有 13 个测试文件 | 无：守卫零 fixture 改动、零 src 改动、无全局副作用（纯函数式断言） | §7.1/§11；fixtures 21 条冻结向量未动 | 无 |
| `codec-issue246-doc-contract.test.ts` D6-1（引用存在性） | 无：D6-1 是「§22/ADR/CONTEXT 引用的 `*.test.ts` 必须存在」单向检查（L338–343 亲读），新增未被引用文件不触发 | 设计 §10 行 4 | 无 |
| codec 公开 API 消费者 | 无：SD-1B 零新增导出；守卫仅 import 既有公共面 + `./fixtures`（与既有测试 import 约定一致，包内无 `../src` 深导入先例——grep 亲证零命中） | `src/index.ts`；§7.1/§7.2 | 无 |
| 未来 edge demux（#420+） | 无遗漏：设计明示其不在本票范围，F1 预留常量名与升格路径（升格票须自带冲突门禁——SA8 §5 同判） | §1 非目标/§10/§13-F1 | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 路由键布局守卫 | 拥有 codec 字段序的包（`@nomicore/replication-protocol`） | `packages/replication-protocol/test/codec-route-key-guard.test.ts` | 正确——ADR 0032 §4 明令「codec 侧」；非 ws-replication、非跨包新抽象 |
| 布局事实登记（本票范围） | 守卫文件内单点（SD-1B）；codec 导出常量延后到消费者切片 | §8.0 钉死块 + §13-F1 | 归属经 SA8 冲突门裁定相容；无第二权威状态 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| envelope 逐 offset 断言 | `codec-envelope.test.ts` L52–65（只进 header 0/4/5/6/8/12/16） | G2 进入 payload 偏移 | 一致（扩展而非平行） | 复用同款「逐 offset + golden 双面」手法，断言面推进到 [20..57) |
| chunk 首字节守卫 | `codec-issue299-ac-red.test.ts` L285–290（首字节 ∈ {0,1,2}） | G3 锁 kind@20 + prefix@21 + [22..57) + 绑定块不位移 | 一致（严格超集） | 设计 B9 明示既有覆盖不足的三点理由 |
| 全帧 golden 等式 | `codec-messages-golden.test.ts`（21 条 hex 等式） | 复用同语料做偏移断言（不复制字面量） | 一致 | 复用 `GOLDEN`/`NS`/`hexToBytes` 与 import 约定，零新 fixture 通道 |
| capability 门控解码 | 既有测试 `decodeMessage(..., { selectedCapabilities: CAP_CHUNKED_UPDATE })` | G3-4 同款选项 | 一致 | `codec-package-contract.test.ts` L89 / `codec-messages-golden.test.ts` 同款 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 布局字面量 20/35/1 | 守卫钉死块（单点）+ `ENVELOPE_HEADER_BYTES` 导出值（G1-a 互证） | 21/22/56/57 派生 | 低：单侧漂移必红（变异矩阵）；协同漂移与 SD-1A 同构，背板 = ADR/协议文本 + 21 条冻结 golden hex（任何 wire 漂移先在 golden 等式红） |
| 消息 scope / 错误码元数据 | `MESSAGE_REGISTRY` / `CONNECTION_ERRORS` / `NAMESPACE_ERRORS`（冻结注册表） | 守卫仅消费值面 | 低：注册表 append-only，增长触发计数红 = 有意契约修订（R3） |
| golden 语料 | `test/fixtures.ts` 冻结 hex | 守卫只读 | 无（DENY 钉死 fixtures.ts） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 新增单一测试文件（无注册/订阅/进程） | 删除该文件即完全回滚（R5） | 无运行时生命周期；变异驱动副本 create/remove 对称且自清理 | 对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二套 golden 语料 | `test/fixtures.ts` GOLDEN | 文件内合成变体（四象限/最坏/kind1-2 首chunk） | 非重复：合成的是**非冻结**变体，冻结语料零触碰；避免把本票变体混入 golden 通道（§7.1 备选否决理由成立） |
| 第二套读取器 | codec `CanonicalReader` | 守卫私有 `readVarUint`/`readVarString`/`walkError` | 非重复：故意独立（防编码/解码同源缺陷互抵），值面经 `decodeMessage` 交叉核对——SA6 RK-C3 明令此形态 |
| 第二测试入口/runner 配置 | vitest include + 包 tsconfig | 零配置改动 | 无平行通道 |
| env 驱动机制 | 探针 `SA6_CODEC_SRC`（SA6 诊断专用） | 明示不进守卫（§6/§8.7 零 env 读取） | 正确隔离 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW = 单一新文件 `packages/replication-protocol/test/codec-route-key-guard.test.ts` | §8 全部内容（钉死块/走查器/6 组/合成变体）均落于该文件；§7.1 明示变体不进 fixtures | 无 |
| DENY `src/**`（含 SD-1A 落点） | §7.2 SD-1B + §12 门禁 4（`git diff --stat` 为空）；与 Issue「纯增量测试，零行为变化」一致 | 无 |
| DENY `fixtures.ts` / 既有 13 测试文件 | AC5 全量保持绿；issue299 的「chunk golden ≥3」等既有断言依赖语料稳定 | 无 |
| DENY 协议文档（含 §22）/ADR/CONTEXT | F2 把 §22 登记留 Controller（AC 未要求）；D6-1 引用耦合不被触碰 | 无 |
| DENY `wiki/raw` 输入与 `artifacts/` 证据 | 只读；门禁 5 复跑变异驱动是运行而非修改 | 无 |
| follow-up（F1/F2）是否掩盖本任务必要项 | 否：AC1–AC5 均不依赖 F1/F2；F1 属 #420+ 消费者切片的公共 API 决策（SA8 同判） | 无 |
| 范围与正文一致性 | 正文无任何需要触碰 DENY 路径的步骤；ALLOW 无无理由扩张 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1（逐型偏移+前缀） | G2：14 构造 + 13 golden 双面；探针 P1 绿 + M1/M4 红 | 无——13 型清单与注册表亲证吻合；golden 双面重编码带 sequence | 无 |
| AC2（3 kind 偏移） | G3：6 组合 + 3 chunk golden；探针 P2 绿 + M2 红（含 NC2 联动红） | 无——U32_MAX 形态修正后覆盖矩阵不变（合成用例补首 chunk 绑定块） | 无 |
| AC3（ERROR 字段序） | G4：四象限 + 变长 code + 最坏 + 2 golden；探针 P3 绿 + M3 红 | 无——见 §14-O3 可选强化（fatal=false 样本） | 无 |
| AC4（同源消费） | G1（钉死+文法/运行时交叉）+ G5（差分推导）+ 全部值面经公开 API | 无——SD-1B 是 RK-C4 明文合法路径；「不手抄第二份字段序」由独立 oracle + 注册表值面 + 差分互证满足 | 无 |
| AC5（全量绿灯） | 门禁 1（包全量）+ 门禁 2（包 tsc）+ 门禁 3（根 test/typecheck）；基线与占位实测在库 | 无 | 无 |
| 零行为变化 | 门禁 4（src diff 为空） | 无 | 无 |
| 守卫非恒真 | 门禁 5（变异矩阵两轮 6/6）+ §8.7 ⊇ 映射 | 无——本轮逐组复核 ⊇ 映射成立（G1+G2⊇P1 逐断言、G3⊇P2、G4⊇P3、G5⊇P4、G6⊇NC1–NC3） | 无 |
| 计数契约 | ≥13 型 + ≥6 chunk 组合 + ≥5 ERROR 用例 + 3 负控 + 5 变异类（§12 末行自检） | 无 | 无 |
| 测试观察行为而非源码文本 | §8.7 断言纪律（零源码字符串/正则、零 skip/only/todo、零 env、零吞错） | 无 | 无 |
| 旧实现「真红」问题 | 不适用且正确处理：现行布局正确（探针 7/7），契约形态 = baseline-green + mutation-red，设计明令禁止伪造当前代码即红的假断言 | 无 | 无 |

## 13. Required revisions

无（无 BLOCKER / 无 MAJOR finding）。

## 14. Non-blocking observations

- **O1（B2 措辞精确性）**：B2 称「`NAMESPACE_ID_RE` 已导出」——其为 `src/constants.ts` 模块级导出，但未经 `src/index.ts` re-export，**不在包公共 API 面**。设计 §7.1 import 清单与 G1-b 机制均不依赖它（encode 接受面交叉），故无断裂；建议实现票注意：守卫不得从包根 import 该符号（会编译期红）也不应深导入 `../src/constants.js`（包内既有测试零 `../src` 导入先例，grep 亲证）。接受条件：守卫文件 import 面仅 `@nomicore/replication-protocol` + `./fixtures`（与 §7.1 一致）。
- **O2（最坏用例的 code 识别方式）**：§8.4 散文把最坏用例钉在 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`（35B，经 `src/errors.ts` 26 码逐个长度比对确为最长）；探针 P3（L289）是从 `Object.keys(NAMESPACE_ERRORS)` 动态取最长码。建议守卫沿用动态推导，使最坏用例随注册表 append-only 增长自动跟踪（R4 的预算红仍是背板，两种写法均合规）。
- **O3（fatal=false 的 wire 形态样本，可选）**：G4 四象限种子（BAD_MAGIC/SYNC_STATE_VIOLATION）均为 fatal=true、retryable=no（wire `01 00`）。若编码器仅对 fatal=false 码写错位，G4-8 的 `decodeMessage` 交叉核对已会红（`decodeError` L278–285 对位-注册表不一致抛 MALFORMED_FRAME），故非缺口；可选加一条 `ACK_TIMEOUT`（唯一 fatal=false 码）样本使 wire 0/1 位形态直接入样。
- **O4（grammar 拒绝面，可选）**：G1-b 的 35 交叉核对是接受方向（合法 id 可编码 + 前缀字节 = 35 观测）。可选加一条拒绝方向钉死（如 34 字符 id 经 `encodeMessage` 抛 `ProtocolError('MALFORMED_FRAME')`），把「恒 35」前提双向锁定；grammar 拒绝面已由既有 malformed 套件覆盖，非本守卫义务。

## 15. 评审方法与限制

- 本轮为独立攻击审查：全部 finding 均以源码/规范/产物亲读为证据，未运行业务测试、未启动服务、未修改任何被审对象（唯一写入 = 本文件）。
- `pass` 仅表示设计通过审查，不替代 SA4/SA7 对实现与活链路的后续验证。
- SA8 冲突门报告在本设计之后生成并已闭合设计自请的窄幅复查；本轮未发现需要**重新**执行 ADR 冲突检查的新风险（SD-1 相容性已由该报告裁定，O1–O4 均不触及决策面）。
