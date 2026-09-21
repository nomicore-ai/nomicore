# task_issue-419 SA4 实现静态审查 — 路由键契约 codec 守卫测试（spec #415 T1）

- Reviewed subject：SA3 交付 = 新文件 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（743 行，
  6 describe 组 / 19 用例）+ 5 份 `artifacts/sa3-issue419-*.log` 证据；报告 `wiki/raw/task_issue-419_sa3_impl.md`
- Dispatch：`sa-5416f75e-36f7-4d90-b398-c16efddae1cb`（mabf-sa4，phase implementation-review，iteration 0）
- Verdict：**approve**（无 BLOCKER / 无 MAJOR；4 条非阻断观察，见 §10/§11）
- 本轮为零修改静态审查：未修改任何被审对象、实现、设计、测试或证据；未运行测试/服务；唯一写入 = 本文件（新建）。
  Issue 评论 REST 快照 = **空（`[]`）**（dispatch 明示）——无 Owner 评论要求、无评论 ID/时间戳可映射。

## 1. Reviewed inputs

| 输入 | 状态 | 本轮核验方式 |
|---|---|---|
| `wiki/raw/task_issue-419.md`（Host 简报） | 存在 | 全文亲读；AC1–AC5 +「纯增量测试，零行为变化」+ 空 Comments |
| `wiki/raw/task_issue-419_sa6_contract.md`（已批准契约） | 存在 | 全文亲读；RK-C1–C7 / SD-1 两案 / §12.0 门禁 / §12.6 计数契约逐条比对 |
| `wiki/raw/task_issue-419_design.md`（SA1 设计） | 存在 | 全文亲读；§8.0–§8.8 守卫详案、§7.2 SD-1B、§7.5 笔误修正、§11 ALLOW/DENY、§12 门禁 |
| `wiki/raw/task_issue-419_sa2_review.md` | 存在 | 全文亲读；approve；O1–O4 非阻断观察的落实面 |
| `wiki/raw/task_issue-419_design_conflict_report.md`（SA8 设计门） | 存在 | 全文亲读；clear / requiresConflictRecheck=false；Required actions 1–4 |
| `wiki/raw/task_issue-419_implementation_conflict_report.md`（SA8 实现门，本轮审查期间生成） | 存在 | 全文亲读；clear / false；12 项对照与本轮独立结论互相印证 |
| `wiki/raw/task_issue-419_sa6_route_key_probe.mts`（416 行） | 存在 | 全文亲读；P1–P4/NC1–NC3 断言面与守卫逐条比对（§9 ⊇ 映射独立复核） |
| `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts` | 存在 | 结构亲读（副本机制/锚点）；sha256 与 SA6 §17 一致（targeted-repeat.log + 本轮未重算，采信哈希链） |
| `artifacts/sa3-issue419-{package-suite,scope-and-tsc,mutation-rerun,guard-mutation-evidence,targeted-repeat}.log` | 存在 | 全文亲读；结论行（14 文件/233 绿、TSC_EXIT=0、SRC diff 空、两轮 6/6、19 用例 ×2、sha256 完整性）逐项核对 |
| `artifacts/sa6-issue419-*.log` ×5 | 存在 | 只读；SA6 §17 登记哈希经 sa3 targeted-repeat.log 核对一致 |
| 源码与测试 | — | `src/index.ts`（导出面 L8–56 逐符号）、`src/constants.ts`（L15/L45）、`src/messages.ts`（L80–102 注册表 18 键）、`src/errors.ts`（L100–158 两注册表 + `lookupError` L169–174 + ACK_TIMEOUT L138）、`src/payloads.ts`（`encodeError` L320–349、`encodeUpdateChunk` L728–812、`decodeMessage` L914–927、`encodeMessage` L933–942、`checkNamespaceId` L60–64）、`src/limits.ts`（DecodeOptions/EncodeOptions）、`test/fixtures.ts`（GOLDEN L252–401 全 21 条逐名亲读、`GoldenFixture` L220、`NS`/`RID`/`bytesToHex`/`hexToBytes` 导出） |
| Runner 与门禁基础设施 | — | `vitest.config.ts` L15（include）、`packages/replication-protocol/tsconfig.json`（include `test/**/*.ts`）、根 `package.json` scripts（`test` = vitest run --typecheck；`typecheck` 含本包 tsc） |
| 规范文本 | — | ADR 0032 §4（L24–26 亲读）；协议 §13（L379–393 亲读）；协议 §1/§3/§4/§10.3 经 SA2/SA8 亲证 + 本轮 fixtures hex 交叉 |
| Git 状态 | — | 本轮亲证：`git diff --stat` 与 `git diff --cached --stat` 均空（零已跟踪文件修改）；HEAD `27e012b6…` 与 SA6/设计基线一致；untracked = 1 测试文件 + 10 证据日志 + 9 wiki 文档/脚本；守卫文件 sha256 `32aa83a5ffaa6a3c…` 与 `sa3-issue419-scope-and-tsc.log` 记录一致（证据对应当前文件版本）；`.scratch/` 仅剩已跟踪的 `vfsl-v1-parser`（`git ls-files` 亲证其为 tracked，非残留垃圾） |

## 2. Verdict

**approve**。实现与批准设计 §8、SA6 契约 RK-C1–C7、Issue 正文 AC1–AC5 逐项吻合且多处为断言加强；
文件范围严格落在 ALLOW 单行内（DENY 全未触碰，live `git diff` 亲证）；测试行为质量合格——断言只观察
运行时帧字节与公开 API 值面、零 skip/only/todo/env/源码字符串断言（本轮独立 grep 复核）、真实 runner
入口已触发（目标文件 ×2 + 包全量 14 文件/233 绿）且被根 `pnpm test`/`pnpm typecheck` 两条 CI 入口覆盖；
变异敏感性双证据在库（SA6 探针矩阵两轮 6/6 正式门禁 + 守卫自身跑变异副本 6/6 补充）。三条已登记偏差
均为 SA2 非阻断观察的采纳或断言加强，无验收弱化。无 BLOCKER / MAJOR finding。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1：每种 namespace 域消息型 golden 帧断言 namespaceId 精确偏移与长度前缀 | G2-a（14 构造逐型：`prefix@20`/`<0x80`/`[21..56)` 窗口/decode 回读/注册表 scope；覆盖集与注册表推导集合**等值断言**，非手抄清单）+ G2-b（13 条 golden 双面 + 字节/重编码互锁） | 落实（⊃ 探针 P1：多出 golden 双面与集合等值锁） |
| AC2：UPDATE_CHUNK 三 kind（含首 chunk 绑定块）偏移断言 | G3-a（6 组合：`kind@20`/`prefix@21`/`[22..57)`/CAP 门控解码回读/kind≠0x23 可判别）+ G3-b（绑定块不位移：`indexOfBytes` 实测起点=22 且首/非首一致 + kind≠0 首 chunk 必带绑定块的构造面自检）+ G3-c（三态枚举）+ G3-d（3 条 chunk golden 双面 + 互锁） | 落实（⊃ 探针 P2；设计 §7.5 修正后首 chunk 绑定块由合成用例补齐，覆盖矩阵 6 组合不减） |
| AC3：ERROR 字段序（连接级/namespace 级 × relatedSequence 有无）守卫 | G4-a（四象限 + fatal=false 样本 + 走查/解码双面值交叉）+ G4-b（`[21..56)` 是 code 不得误纳 + ≤64 预算）+ G4-c（连接级字节级无 key）+ G4-d（最坏用例公式逐项 + 动态最长码）+ G4-e（2 条 ERROR golden 双面 + scope 两态覆盖） | 落实（⊃ 探针 P3：多出 fatal=false wire 样本与 golden 面） |
| AC4：与 codec 同源消费，不手抄第二份字段序 | G1-a 唯一裸字面量钉死点（20/35/1/21/22/56/57/64）；20 ← codec 导出 `ENVELOPE_HEADER_BYTES`；值面 ← `encodeMessage`/`decodeMessage`/`MESSAGE_REGISTRY`/`lookupError`；偏移 ← G5 差分推导（5 代表构造）互证；走查序是 RK-C3 明令的断言侧 oracle 且经解码值面交叉 | 落实（SD-1B 形态，SA6 §12.4 第二条合法路径；SA8 设计门行 3 裁定相容） |
| AC5：包全量既有套件绿灯 | `sa3-issue419-package-suite.log`：14 文件 / 233 测试全绿 / Type Errors: no errors / EXIT=0（基线 13/214 + 守卫 19，算术自洽；含 envelope/golden/malformed/truncation/interop/fuzz/package-contract/test-d 全家族——包 AGENTS 验证门齐） | 落实 |
| 「纯增量测试，零行为变化」 | live `git diff` 全仓为空（src/fixtures/既有测试/文档/配置零改动）；守卫只读观察帧字节 | 落实 |
| SA2 O1（import 面精确性） | 守卫 import 仅 `@nomicore/replication-protocol`（8 值 + 8 类型，逐符号对 `src/index.ts` L8–56 亲证均在导出面）+ `./fixtures`；零 `../src` 深导入、零 `NAMESPACE_ID_RE` 引用（本轮 grep 亲证） | 落实（接受条件满足） |
| SA2 O2（最坏 code 动态推导） | G4-d `Object.keys(NAMESPACE_ERRORS).reduce(...)`；本轮独立重算最长码 = `NAMESPACE_REOPEN_REQUIRES_RECONNECT`（35B），公式 1+1+35+1+1+1+5+1=46 与 `encodeError` 写序逐项吻合，≤64 | 落实 |
| SA2 O3（fatal=false wire 样本，可选） | G4-a `ns/fatal-false`（`ACK_TIMEOUT`）；本轮亲证其为唯一 `fatal:false` 的 namespace 码（`src/errors.ts` L138），`lookupError('namespace',…)` 命中 → wire `fatal=0` 位形态入样 | 落实（加强） |
| SA2 O4（grammar 拒绝方向，可选） | G1-d：34/36 字符 id → `ProtocolError('MALFORMED_FRAME')`；本轮亲证 `checkNamespaceId` 走 `throwMalformed`（payloads L60–64），分类断言正确 | 落实（加强） |
| SA8 实现门 Required actions | 1（单文件/零改动/门禁全过）、2（头注维护契约 L25–28 在位，逐字覆盖「有意识的契约修订信号」语义） | 落实 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §8.0 登记块：字面量单点 + 派生偏移 + 20 同源 | L54–67 | 一致：`NS_BYTES`/`NS_PREFIX_BYTES` 字面量全文件唯一；21/22/56/57 只经派生式出现（本轮 grep：裸字面量仅注释散文 + G1-a 钉死点） | 无 |
| §8.1 G1（钉死 + 文法/运行时交叉） | G1-a/b/c（+O4 采纳的 G1-d） | 一致且加强：G1-b 额外断言 codec 写出的 `[21..56)` 窗口 = NS（已登记偏差 1，见 §10-O1） | 无 |
| §8.2 G2（14 构造 + 13 golden 双面） | G2-a/b | 一致；构造面覆盖集改由注册表动态推导并做集合等值断言（比设计散文更抗手抄漂移） | 无 |
| §8.3 G3（6 组合 + 绑定块不位移 + 可判别 + 3 golden） | G3-a/b/c/d | 一致；`indexOfBytes` 把「绑定块不位移」从推断升级为实测字节定位 | 无 |
| §8.4 G4（四象限 + 独立走查器 + 预算 + 值面交叉） | walkError L256–308 + G4-a…e | 一致；走查序与 `encodeError` 写序（payloads L332–348）逐字段吻合；fatal/retryable 经 `lookupError` 注册表同源（非手抄 bool） | 无 |
| §8.5 G5（差分推导） | G5-a | 一致（5 代表构造与探针 P4 同集；断言逐条等价 + 登记窗口全量核对） | 无 |
| §8.6 G6（NC1–NC3 原样保留） | NC1/NC2/NC3 | 一致（NC3 计数/例外集合/双向锁定齐；比探针多 `GOLDEN.length===21` 前置锁） | 无 |
| §8.7 断言纪律 | 全文件 | 本轮独立 grep：零 skip/only/todo、零 env、零文件读、零 `toMatch`/RegExp、零吞错（`must`/`mustByte` 为响亮失败辅助） | 无 |
| §7.5 SA6 证据笔误修正采信 | G3-d/G6 按 fixtures 事实处理 U32_MAX 为 kind2 非首；NC3 以 21 计 | 一致（本轮 fixtures L391–400 亲证：`chunkIndex=0xfffffffe`、hex 无 syncRoundId） | 无 |
| §7.2 SD-1B（src 零改动） | git diff 空 | 一致（未夹带 SD-1A 常量导出；升格路径留 F1） | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 路由键布局守卫 | 拥有 codec 字段序的包 | `packages/replication-protocol/test/` | 正确（ADR 0032 §4「codec 侧」明令；非 ws-replication、非跨包抽象） |
| 布局事实登记（本票范围） | 守卫文件内单点（SD-1B，SA8 已裁定） | 登记块 L54–67 + 头注升格路径 | 正确（无第二权威状态） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| envelope 逐 offset 断言 | `codec-envelope.test.ts`（只进 header） | G2 推进到 payload [20..57) | 一致（扩展） | 同款逐 offset + golden 手法 |
| chunk 首字节守卫 | `codec-issue299-ac-red.test.ts`（首字节 ∈ {0,1,2}） | G3 锁 kind@20+prefix@21+窗口+不位移 | 一致（严格超集） | 设计 B9 已论证既有不足 |
| 全帧 golden 等式 | `codec-messages-golden.test.ts` | 复用同语料做偏移断言（零字面量复制） | 一致 | import `GOLDEN`/`NS`/`hexToBytes` 与既有约定同款 |
| capability 门控解码 | 既有测试 `{ selectedCapabilities: CAP_CHUNKED_UPDATE }` | G3/G3-d 同款选项 | 一致 | 公开选项面，`decodeMessage` L917 门控亲证 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 布局字面量 20/35/1 | 守卫钉死块（单点）+ `ENVELOPE_HEADER_BYTES` 导出互证（G1-a） | 21/22/56/57 派生 | 低：单侧漂移必红（变异证据）；协同漂移与 SD-1A 同构，背板 = ADR/协议文本 + 21 条冻结 golden hex + 评审纪律 |
| scope/错误码元数据 | `MESSAGE_REGISTRY` / 两错误注册表（冻结） | 守卫仅消费值面 | 低：append-only 增长触发计数红 = 有意契约修订（R3，头注在位） |
| golden 语料 | `test/fixtures.ts` 冻结 hex | 守卫只读 | 无（DENY 钉死，本轮 git 亲证未触碰） |

### 生命周期对称性 / 平行机制检查

无运行时生命周期（纯断言资产；回滚 = 删单文件）。无平行机制：无第二 golden 语料（变体在文件内合成）、
无第二测试入口/runner 配置、无 env 驱动通道（探针的 `SA6_CODEC_SRC` 是 SA6 诊断专用，未进守卫——本轮
grep 亲证零 `process.env`）；独立走查器是 RK-C3 明令形态（防编码/解码同源缺陷互抵），非重复实现。

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/replication-protocol/test/codec-route-key-guard.test.ts` | 设计 §11 ALLOW 唯一行（新建） | AC1–AC4 守卫本体 | 在范围内；sha256 与证据日志记录一致 |
| `artifacts/sa3-issue419-*.log` ×5 | DENY 未覆盖（DENY 仅钉 `artifacts/sa6-*` 只读） | 门禁原始证据 | 合规；sa6 资产哈希未变 |
| `wiki/raw/task_issue-419_sa3_impl.md` | 技能固定产物（非 DENY 既有输入） | 实现报告 | 合规 |

DENY 逐项复核（本轮 live 亲证）：`src/**`（git diff 空）、`test/fixtures.ts` 与既有 13 测试文件（零
modification 条目）、协议文档/ADR/CONTEXT（零改动）、`packages/ws-replication/**`、`vitest.config.ts`、
根/包 `package.json`、`tsconfig*.json` 全部未触碰；`wiki/raw/task_issue-419*.md|.mts` 既有输入与
`artifacts/sa6-*` 只读（哈希链一致）。无越界。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| vitest 发现面 | 根 `pnpm test`（CI） | include `packages/*/test/**/*.test.ts` 覆盖目标路径；目标文件 ×2 直跑绿 + 全量套件 14 文件含本文件 | 无 | 无 |
| 类型门禁 | 根 `pnpm typecheck`（CI） | typecheck script 显式含 `tsc -p packages/replication-protocol/tsconfig.json`（include `test/**/*.ts`）；包 tsc exit 0 | 无 | 无 |
| codec 公开 API 消费者 | 全仓 | 零 src 改动、零新增导出 → 无涟漪 | 无 | 无 |
| `codec-issue246-doc-contract.test.ts` D6-1 | 协议 §22 引用存在性 | 本票零文档改动、新文件未被引用 → 不触发；且该检查在包全量中绿 | 无 | 无 |
| 既有 13 测试文件 | 共享 fixtures | fixtures 零改动、守卫无全局副作用（纯函数式断言、maxWorkers:1 串行） | 无 | 无 |
| 未来 edge demux（#420+） | 布局事实消费者 | F1 升格路径已预留（登记块头注），非本票义务 | 无（已登记 follow-up） | 无 |

## 8. 错误、恢复与并发

- **无静默失败路径**：decode 成功本身是断言的一部分（失败即红）；`must`/`mustByte`/`expectMalformed`
  全部响亮失败；walkError 的 scope/marker 越界值直接红。
- **部分完成诚实报告**：不适用（无多步副作用）；守卫是纯字节算术 + 公开 API 调用，无计时器/网络/文件 IO。
- **并发/幂等**：无共享状态；探针 5 次重复 + 守卫 ×2 直跑一致（确定性证据在库）。
- **失败语义可定位**：失败消息一律点名消息型 + 偏移 + 实测值（`prefix@20 = X ≠ 0x23` 形态，变异日志亲证）。
- **进程/重启/回滚**：无运行时面；回滚 = 删除单文件（R5）。
- 静态无法确认的项：无（全部断言面均可在源码/字节层静态核验，且已有运行证据日志佐证）。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| G1-a…d（4） | 登记字面量钉死；35 文法接受/拒绝双向；运行时前缀观察 | vitest（包全量 + 目标直跑 ×2，日志亲证） | 无 | 无 |
| G2-a/b（2） | 14 构造逐型固定偏移 + 13 golden 双面互锁 | 同上 | 无（覆盖集 = 注册表推导集合等值断言，抗手抄退化） | 无 |
| G3-a…d（4） | 6 组合 kind-first + 绑定块不位移 + 三态枚举 + 3 golden 双面 | 同上 | 无 | 无 |
| G4-a…e（5） | 四象限走查 + fatal=false + 预算/公式 + 2 golden 双面 | 同上 | 无 | 无 |
| G5-a（1） | 差分推导（5 代表构造） | 同上 | 无 | 无 |
| NC1/NC2/NC3（3） | 非恒真 / 规则判别 / 语料计数与例外集合双向锁定 | 同上 | 无 | 无 |

- **SA6 红灯断言保持**：守卫 ⊇ 探针逐检查复核成立——P1→G1+G2（含 14 构造与逐型断言全集）、P2→G3、
  P3→G4（walkError 断言序逐条对应：scope∈{0,1}/code 紧随/fatal·retryable 注册表一致/marker 出现性/
  ns 长度 35·前缀 1B·值 0x23/safeMessage 末字段零尾随/scope⇔ns 等价/预算 ≤64/连接级字节级无 key/最坏公式）、
  P4→G5（同集同断言）、NC1–NC3→G6（等价或更强；`indexOfBytes===-1` ⟺ 探针 `!containsBytes`）。
- **变异敏感性（非恒真证明）**：正式门禁 = SA6 探针矩阵两轮 6/6 expected（M1→P1/P4、M2→P2/P4/NC2、
  M3→P3、M4→P1/P4、NM1/NM2 全绿，失败详情与 SA6 基线逐字一致）；补充 = 守卫自身跑 6 变异副本 6/6 expected
  （M4 额外点亮 G1-b 属已登记的有意敏感面，见 §10-O1；首轮原始输出保留、无断言回改）。
- **无 skip/only/todo、无源码字符串/正则断言、无 env**：本轮独立 grep 三组 pattern 全部零命中。
- **fixture/资源隔离**：无跨文件状态；变体全部文件内合成；golden 冻结语料零触碰。
- **CI 触发性**：包全量 + 根 test/typecheck 两入口均覆盖（§7）。
- **计数契约自检**（SA6 §12.6）：13 型（14 构造 + 13 golden）/ 6 chunk 组合 + 3 golden / 7 ERROR 用例
  （四象限 + fatal=false + 最坏 + 2 golden）/ 3 负控 / 5 变异类（两轮）——全部满足且多数超额。

## 10. Required revisions

无（无 BLOCKER / 无 MAJOR finding）。

## 11. Non-blocking observations

- **O1（G1-b 超设计字面的加强，已由 SA3 登记为偏差 1）**：设计 §8.1 只要求「encode 接受面 + UTF-8 字节数
  = 35」，实现额外断言 codec 写出的 `[21..56)` 窗口 = NS。后果是 M4（前导字段整体位移）会额外点亮 G1-b
  ——这是把「钉死值与 codec 行为互证」推进到偏移面的**加强**，非过紧（观察对象仍是 codec 公开行为）；
  首轮 5/6 → 期望集修正后 6/6 的过程在证据日志中完整保留且无断言回改，属诚实证据处理。接受。
- **O2（根级门禁 3 延后）**：SA3 跑了门禁 1/2/4/5，根 `pnpm test` / `pnpm typecheck` 延后给 SA7/CI 并登记
  理由。本轮静态核证两条根入口均覆盖新文件（vitest include + typecheck script 显式含本包 tsc），且包级
  等价物已绿，残余风险极小。建议 SA7/CI 收口时补跑一次全仓门禁即可。
- **O3（守卫级变异驱动未持久化）**：补充证据的 scratch 驱动（`guard-mutation-driver.mts` + 临时
  `vitest.mutant.config.ts`）用后即删，M4→G1-b 期望集修正只存在于日志散文中。正式 RK-C6 门禁由仓内长期
  资产 SA6 探针驱动承载（可随时复跑），故非缺口；若未来想复跑守卫级矩阵需按日志重搭驱动。可接受。
- **O4（G4-b 下界措辞）**：`walked.nsStart` 用 `toBeGreaterThan(0)` 而非 `> HEADER_BYTES`；后续距离断言
  （`nsStart - HEADER_BYTES` 的公式/预算核对）已实际上下夹逼，无行为影响。纯措辞级。

## 12. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 全仓回归（根级门禁 3） | SA7/CI 跑根 `pnpm test` 与 `pnpm typecheck` | 两命令 exit 0（新文件被发现并入套件） | 任何包因新文件引入失败（静态分析未发现路径） |
| 守卫长期变异敏感性复跑 | 复跑 `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts`（两轮） | `MUTATION_RESULT 6/6 expected`，exit 0 | 任意变异不再点亮对应探针检查 |
| 注册表 append-only 演进 | 未来新增 namespace-scope 消息型/错误码 | NC2/NC3/G2 计数响亮红 = 有意识契约修订信号（头注已写明处置） | 新型静默落入旧计数（不该发生——计数为精确等值断言） |

---

审查方法与限制：本轮为零修改静态审查（读源码/设计/契约/证据日志/git 状态 + 只读 grep），未运行任何测试、
未启动服务、未创建临时进程；运行性结论一律采信 SA3/SA6 证据日志并核对其内部一致性与哈希链（守卫文件
sha256 与日志记录一致）。`approve` 不替代 SA7 对活链路/全仓门禁的最终验证。
