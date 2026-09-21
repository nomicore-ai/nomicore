# task_issue-419 实现冲突复查报告（SA8 / conflict-gate）

- Reviewed subject: **implementation**（SA3 交付：新文件 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（743 行，6 describe 组 / 19 用例）+ 5 份 `artifacts/sa3-issue419-*.log` 证据；报告 `wiki/raw/task_issue-419_sa3_impl.md`）
- Dispatch：`sa-8a507e37-eb74-4a48-b770-7eb352bd7494`（mabf-sa8，phase conflict-gate，iteration 0）
- Verdict：**clear**（裁决分布：`implements-existing-decision` ×1，`no-conflict` ×11，`evolution-required` ×0，`hard-conflict` ×0）
- requiresConflictRecheck：**false**（§9 给出理由）
- 触发依据：Host 派发实现后冲突门禁。设计 §15 自请的窄幅复查已由 `task_issue-419_design_conflict_report.md`（clear / false）闭合；本报告核对**实际交付 diff** 未偏离该裁决（SD-1B 保持、`src/` 零改动、ADR 0032 §4 义务落地未夹带契约变更）。
- 本报告为 SA8 唯一产物（新建，无同类旧报告可原位更新）：未修改任何被审对象、决策文档、代码或测试，未运行测试（证据日志按文件亲读，不替代决策文本）。Issue 评论 REST 快照 = **空（`[]`）**——无 Owner 评论 override、无评论 ID/时间戳可落实；Owner 要求 = Issue 正文（`wiki/raw/task_issue-419.md`）。

## 1. Inputs and decision set

| 输入 | 状态 | 本轮用途 |
|---|---|---|
| `wiki/raw/task_issue-419_sa3_impl.md` | 存在，亲读 | 被审对象的自述（Changed paths / 门禁结果 / 偏差登记） |
| `packages/replication-protocol/test/codec-route-key-guard.test.ts` | 存在（untracked 新文件），全文亲读 | 被审对象本体，逐行对照决策条款 |
| `artifacts/sa3-issue419-{package-suite,scope-and-tsc,mutation-rerun,guard-mutation-evidence,targeted-repeat}.log` | 存在，结论行亲证 | 门禁证据交叉（EXIT=0 ×3、两轮 `MUTATION_RESULT 6/6 expected`、SRC_CLEAN）——事实确认，不替代决策文本 |
| `wiki/raw/task_issue-419_design.md` / `_sa2_review.md` / `_design_conflict_report.md` | 存在，亲读 | 设计基线（SD-1B 裁决、§8 详案、§11 ALLOW/DENY、§12 门禁）、SA2 O1–O4、设计门禁裁决（clear / false） |
| `wiki/raw/task_issue-419_sa6_contract.md` + 探针/变异驱动 `.mts` + 5 份 `artifacts/sa6-issue419-*.log` | 存在 | 上游契约与可执行证据（RK-C1–C7 / 变异锚点） |
| `wiki/raw/task_issue-419.md`（Host 简报） | 存在，亲读 | Issue 正文 AC1–AC5 +「纯增量测试，零行为变化」 |
| SA4 / SA9 产物 | **不存在**（glob 亲证：`task_issue-419` 家族无 `sa4`/`sa9` 文件） | 无下游评审 finding 可交叉；若后续产生新决策面，按技能另行触发冲突门 |
| `docs/adr/0032-transport-decoupling-edge-session-split.md` | 已接受（状态行亲证） | 路由键契约唯一规范来源（§4 决策 4，L26） |
| `docs/adr/0010` / `0013` / `0022` | 已接受；0013/0022 状态行明示 wire 冻结值以协议文档为唯一权威 | 复制架构与分块传输冻结面 |
| `docs/protocols/instance-replication-v1.md` | 已接受（规范 wire contract） | §1（L7 起）/§3（L47）/§4（L65，L79 首字段规则）/§5（L89）/§10.3（L307）/§13（L379）/§22（L687）逐节亲读 |
| `CONTEXT.md` L225–227（复制 Edge）、L233–235（路由键契约词条，L234「由结构性守卫测试锁死」亲证） | 域词条 | 「登记/锁死」语义的域内权威解释 |
| `packages/replication-protocol/AGENTS.md` | 模块决策（边界 + 验证门） | 公共 API / 注册表 append-only / fail-closed 边界 |
| 源码与测试事实 | 亲读 | `src/index.ts`（导出面 L8–56）、`src/constants.ts`（L15 `ENVELOPE_HEADER_BYTES=20`、L32 `NAMESPACE_ID_RE` 未 re-export）、`src/messages.ts`（L80–102 18 键注册表）、`src/errors.ts`（L122/L138）、`test/fixtures.ts`（L252–401 GOLDEN **21 条**逐名清点、RID/bytesToHex/hexToBytes 导出亲证） |

ADR 状态核查：仓内 31 份 ADR 文件（0001–0030 + 0032；0031 已由 HEAD `27e012b`「改号 0031→0032」提交让出编号）。与本任务相关者（0010/0013/0022/0032）均「已接受」、无一被 superseded；ADR 0015 为「提议」，不构成约束。注：设计门禁报告曾表述「仓内 32 份 ADR」——系改号前的计数口径，对各项裁决无影响。

当前 diff 事实（本轮亲证）：`git diff --stat HEAD` **空输出**（零已跟踪文件修改）；untracked 变更集 = 1 个测试文件 + 5 份 sa3 证据日志 + 5 份 sa6 只读日志 + 8 份 `wiki/raw/task_issue-419*` 文档/脚本；`.scratch/` 仅剩既有 `vfsl-v1-parser`（无 `sa3-419` 残留）；根目录无 `vitest.mutant.config.ts` 残留（SA3 §Deviations-3 所述临时配置已删）。

## 2. Decision analysis

| # | Decision | Clause | Subject behavior（实现行为） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0032 §4（决策 4） | 「路由键布局与 codec 字段序登记为同步维护契约，**codec 侧加结构性守卫测试**」（L26） | 交付单一守卫文件（G1 登记与交叉核对 / G2 域固定偏移 / G3 chunk kind-first / G4 ERROR 字段序 / G5 差分推导 / G6 负控，19 用例），把该明令义务落地为仓内长期资产——设计门禁行 1 的 `implements-existing-decision` 在实现层兑现 | **implements-existing-decision** | ADR 0032 L26；测试文件 L310–743（六组全案）；CONTEXT.md L234（锁定机制=「由结构性守卫测试锁死」，与交付形态一致）；此前仓内零守卫（SA6 §5-A/B） | 无——义务已兑现，且未夹带任何契约变更 |
| 2 | ADR 0032 §4（决策 4） | namespaceId 恒在 `[21..56]`、UPDATE_CHUNK 因 kind 首字段在 `[22..57]`、varString 前缀恒 1 字节（L26） | 登记块以 `HEADER_BYTES`（= codec 导出 `ENVELOPE_HEADER_BYTES`）+ `NS_PREFIX_BYTES`(1) + `NS_BYTES`(35) 派生 21/22/56/57（L60–66）；G1-a 唯一裸字面量钉死点（L313–323）；G2/G3 断言只落在运行时帧字节与 golden 字节两源（L352–485）。半开窗 `subarray(21,56)` 与 ADR 散文 `[21..56]` 同指 21 起 35 字节窗口（设计门禁行 2 已裁定记法等价，实现沿用同口径） | no-conflict | ADR 0032 L26；测试 L54–67、L313–323、L352–485；协议 §3 L47–63（20B 头）、§1 L11（`^ns-[0-9a-f]{32}$`） | 无 |
| 3 | ADR 0032 §4（ERROR 例外条款） | 「ERROR 的 namespaceId 在变长字段后，edge 对其特例跑**几十字节**的有界 mini-decode」（L26，无数值规范） | `ERROR_NS_PREFIX_BUDGET = 64` 为测试局部上界断言（G4-b/G4-d：实测距离 ≤ 64 + 字段序公式逐项核对），非新规范预算；与设计 §8.4/§13-R4 及设计门禁行 10 裁决一致 | no-conflict | ADR 0032 L26；测试 L67、L524–574；`src/errors.ts` 注册表（G4-d 动态取最长码，O2 采纳形态） | 无——未来 edge 切片裁决预算时按 SA6 §15.3 同步该断言（设计门禁行 10 同判） |
| 4 | ADR 0032 状态行 + ADR 0013/0022 状态行 | 0032「wire 格式与协议语义零变化」；0013/0022「wire 冻结值……以 `docs/protocols/instance-replication-v1.md` 为唯一权威」 | `git diff --stat -- packages/replication-protocol/src` 空输出（本轮亲证）；守卫纯读观察帧字节，零写入生产面；Issue 正文「纯增量测试，零行为变化」由此兑现 | no-conflict | 三份 ADR 状态行；本轮 `git diff`/`git status` 亲证；`artifacts/sa3-issue419-scope-and-tsc.log`（SRC_CLEAN=yes / TSC_EXIT=0） | 无 |
| 5 | `packages/replication-protocol/AGENTS.md`（Boundaries） | 「Add public APIs only through `src/index.ts`; exported types and runtime codec behavior must evolve together」 | 零 `src/` 改动、零新增导出（SD-1B 维持）；守卫 import 面逐符号核对全部在既有公共导出面上（`CAP_CHUNKED_UPDATE`/`ENVELOPE_HEADER_BYTES`/`MESSAGE_REGISTRY`/`NAMESPACE_ERRORS`/`ProtocolError`/`lookupError`/`decodeMessage`/`encodeMessage` + 8 类型），并正确**不** import `NAMESPACE_ID_RE`（`src/index.ts` 未 re-export 该符号——SA2 O1 接受条件满足） | no-conflict | AGENTS.md Boundaries；`src/index.ts` L8–56 逐符号亲证；测试 L33–52；本轮 grep 零 `../src` 深导入 | 无 |
| 6 | `packages/replication-protocol/AGENTS.md`（Boundaries） | 「Treat message codes…error codes…as compatibility registries. Extend append-only…never renumber or silently reinterpret」 | 守卫只**消费**注册表值面并断言精确计数（18 键注册表 → namespace-scope 恰 14、固定偏移适用型恰 13；`GOLDEN.length === 21` + 例外集合恰 8 元素）；文件头注 L25–28 落实「新型加入 = 有意识的契约修订信号」维护契约——设计门禁 Required action 2 / 设计 §13-R3 的实现层兑现 | no-conflict | AGENTS.md；`src/messages.ts` L80–102（3 connection + ERROR either + 14 namespace，亲数）；`test/fixtures.ts` L252–401（21 条逐名清点：13 域 + 3 chunk + 2 ERROR + 3 连接级）；测试 L25–28、L667–742 | 无——计数红迫使 append-only 演进显式化，正是该条款要求的纪律 |
| 7 | 协议 §1 文法 + §4 首字段规则 + §3 固定头 | `^ns-[0-9a-f]{32}$`（35 字节）；「每个 namespace-scope payload 首字段都是 varString namespaceId」（L79）；20-byte envelope | G1-b/G1-d 双向锁定 35（接受面：合法 id 可编码 + `[21..56)` 窗口 = NS；拒绝面：34/36 字符 → `MALFORMED_FRAME`）；G1-c 运行时前缀观察；G2 逐型断言且覆盖集由注册表 scope 动态推导（13 型集合等值断言，非手抄清单） | no-conflict | 协议 §1 L11、§3 L47–63、§4 L65–87；测试 L325–347、L353–377；`src/constants.ts` L15 | 无 |
| 8 | 协议 §10.3（UPDATE_CHUNK 单形态，ADR 0022） | kind(varUint) 首字段 → namespaceId → …；绑定块当且仅当 `kind≠0 ∧ chunkIndex=0`，位于 totalBytes 之后、bytes 之前 | G3：`kind@20` ∈ {0,1,2}、`prefix@21`、`[22..57)`、绑定块不位移（`indexOfBytes` 实测起点 = 22 且首/非首一致）、kind ≠ 0x23 可判别、三 kind 枚举锁、3 条 chunk golden 双面 + 字节/重编码互锁 | no-conflict | 协议 §10.3 L307–345；测试 L406–485；fixtures `UPDATE_CHUNK_{BASIC,MULTIBYTE,U32_MAX}`（U32_MAX 按 fixtures 事实处理为 kind2 非首——设计 §7.5 修正经 SA2 亲证成立，本轮 fixtures 亲读同向） | 无 |
| 9 | 协议 §13（ERROR 字段序 + 注册表导出） | scope(u8) → code(varString) → fatal → retryable → relatedSequence? → namespaceId? → safeMessage；「Encoder 从 code registry 导出 scope/fatal/retryable……调用方不能 override」 | `walkError` 独立最小读取器按 §13 序走查（relatedSequence 先于 namespaceId、safeMessage 末字段且零尾随）；fatal/retryable 位经 `lookupError` 注册表同源断言（非手抄 bool）；`fatal=false` wire 样本（`ACK_TIMEOUT`，`src/errors.ts` L138 亲证唯一 fatal=false 码）；连接级字节级无 key | no-conflict | 协议 §13 L379–393；测试 L238–308、L489–603；`src/errors.ts` L122/L138 | 无 |
| 10 | 协议 §22（Conformance tests） | 既有清单（golden/roundtrip/截断/fail-closed/互通矩阵/资产锚）不得回退；§22 未列路由键守卫资产 | 协议文档零改动（`git diff` 空）；包全量 14 文件/233 测试全绿 + tsc exit 0（证据日志结论行亲证，含 §22 既有资产与 D6-1 引用存在性检查）；守卫未登记进 §22——F2 仍留 Controller 可选裁决（与设计门禁行 9 一致） | no-conflict | 协议 §22 L687–708；本轮 git diff 空；`artifacts/sa3-issue419-package-suite.log`（EXIT=0） | 无——若 Controller 采纳 F2，须连带 D6-1 引用存在性检查 |
| 11 | 设计 §7.2 SD-1B 裁决（经设计门禁行 3 裁定与 ADR 0032 §4「登记」语义相容） | 「纯增量测试，零行为变化」（Issue 正文）⟹ `src/constants.ts`/`src/index.ts` 零改动，布局字面量在守卫文件单点钉死 | 实现严格维持 SD-1B：登记块 L54–67 为唯一登记点，含升格路径头注（对应设计 §13-F1 预留）；零新增 codec 常量/导出（`src` diff 空亲证） | no-conflict | 设计 §7.2/§13-F1；设计门禁 §2 行 3；测试 L54–67；本轮 git diff 空 | 无——F1 升格属 #420+ 消费者切片，届时须自带冲突门禁（设计门禁 Required action 4 同判） |
| 12 | 测试纪律（SA6 契约 §3-4，经设计 §8.7 收录为硬约束） | 零 skip/only/todo、零 env override、零 fallback、零吞错、零源码字符串/正则断言 | 本轮独立 grep 亲证：零 `.skip/.only/.todo/xit/xdescribe`、零 `process.env`/`readFileSync`/`require`、零 `toMatch`/`RegExp`、零 `../src` 深导入；裸偏移字面量 21/22/56/57 仅出现于注释散文与 G1-a 钉死断言（逐命中行核对）；`must`/`mustByte` 辅助为响亮失败而非吞错 | no-conflict | 本轮 grep（三个 pattern 均 exit 1 无命中）；测试 L77–178（工具面）、L313–321（唯一钉死点） | 无 |

补充核查（不构成独立行）：SA3 报告自述的三条增强性偏差（G1-b 追加运行时窗口断言、采纳 SA2 O2/O3/O4、补充性 scratch 诊断已删）均落在单一 ALLOW 文件内、均为断言加强而非放宽，不触碰任何决策面——SA8 不评断言优劣（SA2/SA4 职责），仅确认无契约影响；`.scratch/` 与临时配置零残留已亲证。

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

无需任何 override：Issue 评论 REST 快照为空（无 Owner 评论可覆盖任何决策）；变更集无 ADR 修订/废弃、无协议版本升级；实现未声称任何 override（三条偏差均为测试断言面增强，非决策覆盖）。实现便利、测试通过、已有代码、其他 SA 同意均未被用作 override 依据。

## 4. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 核对） |
|---|---|---|---|
| Wire 格式 | 20B envelope 布局、各 payload 字段序（§4/§10.3/§13）、消息码、错误码、capability 位 | 协议 §3/§4/§5/§10.3/§13；ADR 0013/0022 状态行（协议文档为唯一权威） | **未触碰**：`git diff --stat -- packages/replication-protocol/src` 空输出（本轮亲证 + sa3 证据日志同证）；守卫只读观察帧字节 |
| 21 条 golden 向量字面量 | `test/fixtures.ts` `GOLDEN` 冻结 hex 与依赖它的既有断言 | fixtures L252–401（21 条逐名清点）；协议 §22 | **未触碰**：fixtures.ts 为已跟踪文件且零 modification 条目（git status 亲证）；所需变体全部在守卫文件内合成 |
| 公共 API（`@nomicore/replication-protocol`） | append-only，只经 `src/index.ts`，导出类型与运行时行为同步演进 | 包 AGENTS.md | **零新增/零修改导出**（src diff 空）；守卫 import 面逐符号均在既有导出面上 |
| 协议 §22 conformance 清单与既有 13 个测试文件 | 既有套件全绿不回退 | 协议 §22；AC5；基线 13 文件/214 | **未触碰**（零 modification 条目）；包全量 14 文件/233 全绿 + 0 类型错误 + tsc exit 0（证据日志结论行亲证） |
| ADR 0032 / CONTEXT.md 词条 / 协议文档文本 | 决策与术语文本 | docs/AGENTS.md「Authority」 | **零改动**（git diff 空）；无新域词引入 |
| edge/session 公开面 | 一经发布即冻结（当前尚不存在） | ADR 0032「后果」L43 | 不存在即不触碰；F1 常量升格留给 #420+ 消费者切片 |

## 5. Evolution requirements

无 `evolution-required` 项。实现零契约变更：不修订任何 ADR/CONTEXT/协议条款，无新旧语义、迁移、版本或失败语义更替；`src/`、wire、公共 API、持久化、状态机、生命周期面全部零改动。两项 follow-up 维持设计门禁的「延后决策」定性，非本变更集修订义务：

- **F1**（消费驱动的常量升格）：#420+ edge demux 票的公共 API append-only 变更，须随该票自带设计 + 冲突门禁。
- **F2**（§22 资产登记，可选）：Controller 裁决项；采纳时连带 D6-1 引用存在性检查。

## 6. Hard conflicts

无。未发现任何与已接受决策不兼容且无合法 override 的行为。实际 diff = 单一新测试文件 + 证据日志，全部冻结面（§4）逐项核对未触碰。

## 7. Required actions

1. **无阻断项、无必须修订项**——实现与决策集完全一致，可进入后续验收流程（SA4/SA7 质量与活链路验证非 SA8 职责）。
2. （转发，非本票义务）F1 升格随 #420+ 票重新过 SA8 冲突门禁；F2 由 Controller 裁决，采纳则连带 D6-1。
3. （记录）SA4/SA9 产物尚不存在；若后续评审发现**新决策面**（本 diff 未开启任何此类面），按技能纪律另行触发冲突门，不在本报告预支。

## 8. Verdict

**clear** —— 12 项对照中 1 项 `implements-existing-decision`（ADR 0032 §4「codec 侧加结构性守卫测试」义务的实现层兑现：守卫资产落地、计数锁与头注维护契约在位）、11 项 `no-conflict`；无 `evolution-required`、无 `hard-conflict`、无未闭合 override。设计门禁（clear / false）裁定的 SD-1B 范围在实现中得到严格维持：实际 diff 零 `src/`、零公共 API、零 wire、零文档改动，唯一交付物落在设计 §11 ALLOW LIST 的唯一一行内。SA3 报告的自述与仓库事实逐项吻合（diff 面、导出面、注册表计数、golden 计数、证据日志结论行、scratch 清理），未发现失实证据锚点。

## 9. requiresConflictRecheck

**false**。理由：

1. 技能规则将该标志置 true 的条件是「公共 API、wire、schema、持久化、状态机、生命周期、失败语义或正式 override 尚待实现核对」。本实现为纯 no-conflict + 无新决策面的 existing-decision 兑现：上述全部面在本轮已逐项核对为零改动（§4 冻结面表 + §1 diff 事实），无任何尚待核对的实现面。
2. 设计门禁已裁定 `requiresConflictRecheck=false`；本轮实现复查确认交付未偏离该裁决（SD-1B 维持、义务落地未夹带变更）——设计→实现链路闭合。
3. F1/F2 属未来票的决策面，其冲突门禁随各自任务触发，不在本标志承接范围内；SA4/SA9 尚未运行，但其评审对象是质量与验收（非决策面），且本 diff 未开启任何需要它们回填冲突核对的面。
