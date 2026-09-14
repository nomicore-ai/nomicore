# 设计冲突门禁报告 — Issue #381（design 后 ADR / 规范 / 架构冲突复审）

- 被审对象：`wiki/raw/task_issue-381_design.md`（SA1 design，iteration 0，348 行）——焦点为
  **doc-runtime 窗口原语公共结果类型面变化**（W1 成功结算两键 → 三键，新增必填 `total`）与
  **namespace-runtime 镜像复制件删除**（S4 候选计数下沉 + 出处标记镜像清账）
- 任务简报：`wiki/raw/task_issue-381.md`（issue #381，AC1–AC5；REST comment 读回零评论——无额外 owner 口径，无 owner 级 override 声明）
- 上游证据：`wiki/raw/task_issue-381_sa6_contract.md`（SA6 验收契约，verdict approve）；无 SA2 评审输入（iteration 0）
- 前置产物缺席声明：`task_issue-381_relevant_decisions.md` 与 `task_issue-381_conflict_report.md` 均不存在
  （本报告为 #381 首份 SA8 产物，按 design 复查规程直接对照决策全集裁决）
- 冲突基准（本轮直接回查原文）：
  - `docs/adr/0029-filtered-window-read.md` 全文（状态：已接受 2026-09-16；§5 L45–53 结算语义、§8 L65–70 冻结解除与镜像清账、§1/§6/§7、备选 L72–80、验收 L82–86）
  - `docs/adr/0028-window-read.md` 全文（状态：已接受 2026-09-14；决策 7 L61–68 结算与失败、决策 8 L70–73 成本纪律、决策 9 L75–80 分层归属）
  - `docs/adr/0027-readdata-projection-text.md`（✂ 段唯一事实载体 / readData 四键交付——本票零接触面核对）
  - `docs/adr/0024-readdata-shape-budget.md`（预算结构盲纪律——readData options 零改动核对）
  - `CONTEXT.md` L61–67（「窗口读」「过滤窗口」两词条，PR #380 已写定）
  - `docs/protocols/instance-replication-v1.md`（规范 wire 契约——grep 亲证零窗口读/result-type 面；文中「窗口」均为复制 in-flight 窗口语义，与本票无交叠）
  - 模块 AGENTS：`packages/doc-runtime/AGENTS.md`、`packages/namespace-runtime/AGENTS.md`、`packages/namespace-registry/AGENTS.md`
  - wiki 证据链（非规范，docs/AGENTS.md 权威声明）：`wiki/raw/task_issue-368_design.md`（W1 冻结面/两键绑定出处）、
    `wiki/raw/task_issue-369_design.md` §13 R2 L396–400（计数镜像层间张力 follow-up 登记）、
    `wiki/raw/task_issue-369_design_conflict_report.md` L59/L154/L168（前届 SA8 对镜像是「张力登记非违规」的裁定及 R2 保留条件）
- 独立核验方式：设计引用的全部代码锚点本轮亲读源码（`window.ts` 头注/L97–100/L109–131/L139/L185–213/L217–229、
  `window-read.ts` 头注 L1–39/`WindowComposeInput` L93–104/组合入口 L109–146/S3–S6 L148–184/S4 块 L400–474/
  镜像块 L476–742 含 11 处出处标记 grep 亲证、`runtime.ts` L672–702、`lease.ts` L305–315、`types.ts` L465–482、
  `namespace-runtime/src/index.ts` L60–70）；全仓消费者清点 grep 亲证（`countWindowCandidatesAtPath` 零包外消费者；
  apps/domains 零窗口面命中）；测试锚点亲证（P7 两键锁 pins L325–338、contract-red B-5 L29/L83 与 W1-NC1 姊妹负控 L798、
  P-W1/P-W2 值导出守卫、type-guard.test-d 导入面、lease↔W1 `toStrictEqual` 仅失败成员 E4 ~L706/F1/F2、
  形状集中化门 `readdata-shape-assertion-consolidation-gate.test.ts` 作用域 = namespace-runtime/test +
  namespace-registry/test 且 doc-runtime 键集断言为负样本 L196）
- 裁决人：SA8 Conflict Gatekeeper（设计后复审轮，dispatch sa-fe8ac3dd-00f2-4848-a433-e398b8ed594e）
- Worktree：`/home/wangjian/nomicore-fix-issue-381`（branch `mabf/issue-381`，HEAD `8a4fa40` = 设计输入基线，工作树除 wiki/raw 三份 #381 产物外干净）
- 时间：2026-09-14T11:41Z

## Verdict

**clear**（`requiresConflictRecheck: true`——见 §9/§10）

裁决分布（§3 对照表 18 项）：**no-conflict 13 项、implements-existing-decision 5 项、evolution-required 0 项、hard-conflict 0 项**；
两项 override（W1 两键冻结解除、#369 R2 镜像存续安排）均有合法权威（已接受 ADR 0029 §5/§8），无 owner 级口头 override 参与裁决。

核心结论：本设计不是新决策，而是 **ADR 0029 §5/§8 已接受条款在 owner 明示 P1 分期下的兑现票**。
公共结果类型面变化（两键 → 三键）与镜像删除的每一步都能在 ADR 0029 的操作性文本中找到逐字指令；
lease 公共面（恒四键 + ✂ 文法 + 三码失败族）与 read.ts 冻结面均被设计显式保持；无任何 ADR/CONTEXT/协议文本需要随本变更集修订。

---

## 1. Reviewed subject

**design**（`wiki/raw/task_issue-381_design.md`）。审定范围 = 设计文本及其对代码/测试现状的事实断言；
不含实现质量、测试充分性、验收完成度判断（SA2/SA4/SA6/SA7 职域）。

## 2. Inputs and decision set

| 输入 | 角色 |
|---|---|
| `wiki/raw/task_issue-381.md` | 任务简报（AC1–AC5；Comments 空 + dispatch 明示 REST 读回无评论 → 零 owner 附加口径） |
| `wiki/raw/task_issue-381_design.md` | 被审对象（SA1 iteration 0） |
| `wiki/raw/task_issue-381_sa6_contract.md` | 上游验收契约（§12 契约 + §13–§16 红/绿证据；evidence，非规范） |
| `docs/adr/0029`（已接受） | **规范权威**：W1 三键结算（§5）、冻结解除 + S4 下沉 + 镜像清账 + 测试迁移（§8） |
| `docs/adr/0028`（已接受） | lease 恒四键/✂ 事实/三码（§7）、成本纪律（§8）、分层归属（§9） |
| `docs/adr/0027 / 0024`（已接受） | readData 四键与 ✂ 唯一载体 / 预算结构盲——均为本票相邻冻结面 |
| `CONTEXT.md` L61–67 | 「窗口读」「过滤窗口」词条（PR #380 写定） |
| `docs/protocols/instance-replication-v1.md` | 规范 wire 契约（本票零接触；grep 亲证无窗口读面） |
| 三包 `AGENTS.md` | 模块边界决策（公共面纪律、sequencer 外读、lease 透传） |
| wiki/raw #368/#369 设计与前届 SA8 报告 | 证据链：冻结面出处、R2 follow-up 登记、前届裁定条件（非规范） |

ADR 全集 28 份扫描：无 superseded 状态的窗口读相关 ADR；0028/0029 均 accepted 且 0029 明示「实现排 ADR 0028 全阶段之后」——时序成立（#368/#369 已落地，HEAD 亲证窗口面在场）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（设计行为） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0029 §5 | L48：「W1（doc-runtime 窗口原语）成功结算从恰两键扩为 `{ok:true, value, total}`——**total 键恒在**：无 where = 零值域标识计数（ADR 0028 现状语义）」 | 设计 D1：两面结果联合成功成员加必填 `total`；D2：`total := candidates.length`，与 `value` 出自同一次 `collectCandidates` 枚举（`windowCore` L189–208 亲证枚举先于选窗，`kept` 已消费同一长度） | **implements-existing-decision** | ADR 0029 L48；设计 §5-D1/D2；`window.ts` L97–100/L189–208 亲证 | 无（实现期按 §9 复查核对） |
| 2 | ADR 0029 §5（类型分期） | L48 终态类型 `total: number \| undefined`（undefined 形态仅在有 where 时可达） | 设计 P1 阶段收窄为 `total: number`（本票无 where，运行时恒数值；R-381-4 预堵 P2 加宽时的 `?? 0` 兜底） | **no-conflict** | ADR 0029 L48 的 undefined 半域以 where 在场为前提（L47–48）；issue #381 owner 明示 P1 prefactor 分期（票题「P1——W1 冻结解除与 total 下沉」+ AC1「无 where 时恒为候选标识计数」）；P2 加宽为 ADR 自身预授权的纯类型演进，无文本需修订 | P2（where）票落地 `number \| undefined` 加宽 + §6 两层校验同步扩——已由设计 §12 登记为任务外 follow-up，非本票义务 |
| 3 | ADR 0029 §8 | L67–70：解冻 `window.ts`；S4 计数下沉 W1（枚举/过滤/计数同源，消除接缝漂移）；runtime 删 S4 与全部出处标记镜像（`navigate`/`navClassify`/`probeRoot`/`carrierOf`/`readableOwnDataValue` 等约 270 行）收缩为纯组合层（S3/S5/S6）；W1 两键→三键牵动测试家族机械迁移 | 设计 D1（原地改 window.ts）、D3（删 S4 调用点/函数块 + 镜像整块，11 处标记清账，X1–X4 结构审计）、D4（runtime 消费 `windowResult.total`）、D5（注释清账）、D6-M1/M2/M3（P7 两键→三键、类型锁、B-5 注释）——逐条对应 §8 四个子弹 | **implements-existing-decision** | ADR 0029 L65–70；设计 §5-D1/D3/D4/D5/D6；`window-read.ts` L35–38/L162–164/L400–474/L476–742 + 11 处标记（L478/488/493/498/504/522/535/553/671/706/722）本轮 grep 亲证 | 无（实现期按 §9 复查核对） |
| 4 | ADR 0029 §8（镜像清单边界） | L69 枚举为非穷尽示例（「…等约 270 行」），目标态 = 纯组合层（S3 净化 / S5 锚链 / S6 ✂ 装配） | 设计保留 `safePathCopy`（~8 行）并重述注文为「本地防御件，非镜像纪律存续」（X2：`copied from window.ts@ab6e390` ≤1 命中且不再声称冻结/镜像） | **no-conflict** | `safePathCopy` 服务于组合层自留失败构造 `windowFailure`/`seamWindowOptionsInvalid`（接缝终态属 ADR 0029 §6 明文保留的「runtime S3 镜像」层），非导航/分类机制镜像；替代路径（导出 W1 模块私有 `safeSpreadPath`）需新增公共值导出——无任何决策授权，且违 P-W2 守卫与 doc-runtime AGENTS「Add public APIs only through src/index.ts」；删除则剥夺 S3 接缝终态的 path 安全副本能力。§8 目标态（组合层零计数、零导航镜像）不受 8 行防御件保留影响 | 实现期核对 X2（≤1 命中、措辞重述、`copied from carrier.ts` 归零） |
| 5 | ADR 0028 §7 | L63：lease 恒四键 `{ok,value,schema,truncated}`、`truncated === kept < total`、窗口事实进 ✂ 段；L64–68：三码 + `PATH_NOT_ALLOWED` 语义、响亮不抛 | 设计 lease 面零改动（AC3/R1–R3）：四键形状、`truncated` 判据、✂ 装配逐字保留；S6 段 `truncated = kept < total` 仅换 total 供源（单源直通）；删除 `countingDefectFailure` 防御位 | **no-conflict** | 设计 §5-D3-S6/§8-R1–R3；`window-read.ts` L166–183 亲证 S6 结构；被删防御位触发条件（W1 成功后第二次导航失败）在单源下结构性不存在——L468–474 亲证其为 #369 设计产物而非 ADR 契约成员，ADR 0028 §7 失败词表不含它，删除不缩小任何 ADR 约定的可达失败面；接缝终态 `seamWindowOptionsInvalid` 保留 | 无 |
| 6 | ADR 0028 §8 | L70–73：O(N) 子项枚举 + 只物化入选项；未入选子项零物化（毒值哨兵锚定） | 设计 D2：`total = candidates.length` 是枚举完成后的 O(1) 读——零额外遍历、零额外物化；T8（N=2000 毒值 + n=2）哨兵保持 | **no-conflict** | ADR 0028 L70–73；设计 §5-D2/§8-T8；`window.ts` L191/L196 亲证 `candidates`/`kept` 同源 | 无 |
| 7 | ADR 0028 §9（+ ADR 0029 §7） | L75–80：载体级窗口原语归 doc-runtime、组合选窗归 namespace-runtime、lease 面归 registry；readData 与 ADR-0024 options 零改动；0029 §7：谓词/计数是实际数据值、doc-runtime 不依赖 schema | 设计把候选计数权威下沉进 W1 原语（载体机制回归规范归属层），组合层收缩为纯组合；readData/options/schema 通道零触碰 | **implements-existing-decision** | ADR 0029 §8 第二子弹明文指令该层间移动；ADR 0028 §9「载体级窗口原语」归属定义被强化而非削弱；`total` 为载体级标识计数，schema 无关 | 无 |
| 8 | ADR 0029 §1 + 备选 | L17（不新增第四读方法、不改 readData、恒四键与十四键 runtime 面不动）；L78（否决「结算加第五键 total」——破坏恒四键 own 键集纪律） | 设计零新方法、零 readData 改动；`total` 只进 W1 原语结算（三键），不进 lease 结算（恒四键） | **no-conflict** | ADR 0029 L17/L78；设计 §8.1 接口变化总览（registry lease / types 零变化）；`lease.ts` L305–315/`types.ts` L465–482 亲证透传别名面 | 无 |
| 9 | ADR 0027 | ✂ 段为截断事实唯一载体；readData 交付恒四键 `{ok,value,schema,truncated}` | 窗口 ✂ 事实块（头行 + 恰一行事实行 + 四插值槽）文法零改动；readData 零触碰 | **no-conflict** | `WINDOW_TRUNCATION_HEADER`/`windowFactsBlock`/`appendWindowFacts` 在保留集（设计 §5-D3）；readData 不在设计文件范围（§10） | 无 |
| 10 | ADR 0024 | 预算结构盲纪律（options 不看数据值做决定） | 窗口 options（P1 形态）零变化；`where` 不在本票 | **no-conflict** | ADR 0029 §10 已裁定 where 不进 readData options；设计 §1 非目标明示 | 无 |
| 11 | CONTEXT.md L61–67 | 「窗口读」词条：lease 面语义（四键/✂ kept+total/三码）；「过滤窗口」词条：「where 缺席时沿窗口读精确语义（total = 标识计数、truncated = kept < total、✂ 照旧）」 | 设计 D5：ADR 0028/0029、CONTEXT.md 零改动——词条描述的 lease 语义与 where 终态语义均不因 P1 改变；「total = 标识计数」与 D2 逐字一致 | **no-conflict** | CONTEXT.md L66 亲读；词条不描述 W1 原语层键集（原语层形状属 ADR 0029 §5 自身记载），无词汇漂移、无需新词条 | 无 |
| 12 | `docs/protocols/instance-replication-v1.md` | 规范 wire 契约（帧/码/状态机冻结值） | 零接触：窗口读是 lease 层读路径，从不上 wire；全同步进程内，无网络/持久化形态 | **no-conflict** | grep 亲证协议文档零窗口读/result-type 面（文中「窗口」均为复制 in-flight 窗口）；设计 §8.2「无网络/持久化/wire 形态变化」 | 无 |
| 13 | `packages/doc-runtime/AGENTS.md` | 公共 API 只经 `src/index.ts`；守卫测试逐导出记账；读保持 schema 无关；公共类型/读契约变化须跑全仓门 | 设计零新值导出（`index.ts` 零改动——类型名目已全量导出，仅成员形状变化，P-W1/P-W2 守卫恒绿亲证：type-only 导出不入运行时 `Object.keys(ns)`）；total 为 schema 无关标识计数；AC5 全仓 `pnpm typecheck` + `pnpm test` | **no-conflict** | AGENTS.md L14/L18；`public-surface-guard.test.ts` L63–75 亲证；设计 §6/§8.1/§10-DENY | 无 |
| 14 | `packages/namespace-runtime/AGENTS.md` + `packages/namespace-registry/AGENTS.md` | 读在 sequencer 外、公共 API 只暴露 detached 投影；lease 为独立调用方能力、透传 | 组合层收缩仍纯同步读、零可变态、零 sequencer；`compose*` 签名变化为模块内部面（不进包 `src/index.ts`——亲证仅 type-only 转出四名目）；lease/types 零改动 | **no-conflict** | `namespace-runtime/src/index.ts` L60–70 亲证；`lease.ts` 原样透传亲证；设计 §8.1/§9 调用方矩阵 | 无 |
| 15 | wiki 证据链：#368 设计冻结面（D9/B-5 两键绑定、P7 锚、window.ts 包范围冻结）+ `window.ts`/`window-read.ts` 头注冻结措辞 | #368 设计冻结 W1 两键；#369 设计 §13 R2 以出处标记镜像 + 组合层自算计数为既定路径并登记 follow-up | 设计解除该冻结并迁移 P7（两键→三键）——冻结解除的合法性**不依赖 wiki 证据效力**，由 ADR 0029 §5/§8（已接受 ADR）直接提供 | **implements-existing-decision**（经 §4 Overrides 表登记的正式解除） | ADR 0029 §8 标题与 L67；`docs/AGENTS.md` 权威声明（wiki/raw 为证据非规范）；`window.ts` L24/L27–29、`window-read.ts` L35–38 冻结措辞亲证（本票清账对象） | 实现期核对头注清账（X5）与 P7 迁移一致性 |
| 16 | wiki 证据链：#369 §13 R2 缓解前提（前届 SA8 报告 L59/L154：独立预言机边界矩阵不得删除） | R2 follow-up 执行时须保住组合面 oracle 矩阵 | 设计 M4：`packages/namespace-runtime/test/**` + `packages/namespace-registry/test/**` 零 diff（AC3），composition S4 矩阵（独立预言机）原样保留 | **implements-existing-decision** | 设计 §5-D6-M4/§11-AC2 行；`issue-369-window-read-composition-red.test.ts` 在零 diff 树内 | 无 |
| 17 | ADR 0029 §8（接缝漂移消除指令）vs 设计 R-381-1（E4 对抗场景边界登记） | L68：「消除『W1 数的候选集 ≠ runtime 数的匹配集』接缝漂移」 | 下沉后 E4 对抗场景（S3 重读间 trap 插改 doc）的 lease 可观察差异（HEAD `kept 3/total 4` → 同源 `total=3, truncated:false`）正是 §8 指令要消除的漂移本身；设计登记为非阻断边界：不判负、不写断言、不引入新读路径 | **no-conflict** | 无任何 ADR/协议/CONTEXT 条款覆盖对抗性中途变更的确定性语义；既有契约（ADR 0028 §5 总序确定性 = 同一数据同一窗口）在确定性输入下逐字保持（设计 §5-D2 等价论证）；AC3「逐字节不变」的论证域 = 确定性调用，与 E4 非契约域不矛盾 | 若未来 Owner 要求对该场景立约：新契约票（设计已登记） |
| 18 | 引用谱系精确性观察 | issue AC2 与 ADR 0029 §8 标题引「ADR 0028 §13 R2」/「ADR 0028 R2」 | ADR 0028 无 §13/R2 条目（章节清点亲证：决策 1–9 + 备选/验收/开放问题）；R2 登记实际位于 `wiki/raw/task_issue-369_design.md` §13 L396–400 | **no-conflict**（谱系注记，非冲突） | ADR 0029 §8 操作性文本（L67–70）自含且无歧义——删除对象、下沉动作、迁移义务均逐字可执行，不依赖该引用解析；wiki 证据链完整可溯 | 仅记录；本票无需动作（不改 ADR——措辞属 PR #380 已写定文本，且不产生语义歧义） |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| #368 设计 D9/B-5：W1 成功结算恰两键 + P7 两键 own 键集锚 + `window.ts` 包范围冻结（镜像于 `window.ts` 头注 L24 与 `window-read.ts` 头注 L35–38；wiki 证据层） | **ADR 0029 §5 + §8**（已接受，2026-09-16）+ issue #381 owner P1 分期（prefactor 票） | 仅 W1 窗口原语成功结算形状（两键 → 三键）与 `window.ts` 冻结解除；**排除**：`read.ts` 零 diff 红线（0029 §8 只解冻窗口原语——设计 DENY 亲证维持）、姊妹面 `readLogicalValueAtPath` 两键结算（W1-NC1/NC2 负控亲证不在迁移面） | W1 成功结算恰三键 `{ok,value,total}`；P1 阶段 `total: number`（无 where 恒数值）；P7/类型锁机械迁移；冻结措辞清账（X5） |
| #369 设计 §13 R2 存续安排：组合层出处标记镜像 + S4 自算计数（前届 SA8 裁定「张力登记非违规」，以 R2 follow-up + 独立预言机矩阵为保留条件） | **ADR 0029 §8**（「ADR 0028 R2 执行」——即 #369 §13 R2 follow-up 的正式执行） | namespace-runtime S4 候选计数与全部出处标记镜像复制件（11 处标记、~262 行删除） | 删 S4 与镜像；`total` 单源消费自 W1 结算；保留件（`safePathCopy`）重述注文不再声称冻结/镜像（X2 ≤1 命中、`copied from carrier.ts` 归零）；独立预言机矩阵零改动保留（M4）；组合层收缩为 S3/S5/S6 |

两项 override 均为「新 ADR 修订既有决策」法定通道；无 owner 评论级 override（零评论）；实现方便性/测试通过/既有代码均未在本裁决中充当 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（设计处置；实现期逐项核对） |
|---|---|---|---|
| lease 结算恒四键 own 键集 | `{ok, value, schema, truncated}` 成功面；`truncated === kept < total` | ADR 0028 §7 L63；CONTEXT.md L62；`lease.ts`/`types.ts` | 设计零改动（AC3/R1）；M4 两测试树零 diff |
| ✂ 窗口事实块文法 | 头行 `✂ 截断事实：` + 恰一行事实行 + 四插值槽确定性渲染 + 块间 `\n\n` + 结尾单 `\n` | ADR 0027 决策 1 的窗口对偶（`WINDOW_TRUNCATION_HEADER` 注释亲证）；ADR 0028 §7 | S6 全部函数在保留集，装配判据逐字不变；R3 byte 级断言零改动 |
| 窗口失败码族与失败形状 | `WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` / `WINDOW_OPTIONS_INVALID` + `PATH_NOT_ALLOWED` 透传；失败 own 键集恰 `{code,ok,path,message}` | ADR 0028 §7 L64–68；`window.ts` L217–219 亲证 | 失败面零改动（D1）；被删 `countingDefectFailure` 非 ADR 契约成员（见 §3-5） |
| readData 四键交付与 options 闭合形状 | `{ok,value,schema,truncated}`；预算轴词表 | ADR 0027 / 0024；ADR 0029 §1 L17 | 零触碰（§10 文件范围外） |
| `readLogicalValueAtPath` / `read.ts` | 三参签名与语义逐字不变（零 diff 红线） | #368 冻结（ADR 0029 §8 未解除）；`window.ts` L27–29 复制纪律亲证 | DENY LIST 明示零 diff（SA6 H7 承接） |
| doc-runtime 公共值导出集 | 窗口面恰两枚值导出（`readArrayWindowAtPath` / `readMapWindowAtPath`） | `public-surface-guard.test.ts` P-W1/P-W2 L63–75 亲证；AGENTS「守卫逐导出记账」 | 零新值导出；`index.ts` 零改动；类型名目既有导出仅成员形状变化（运行时守卫不受 type-only 导出影响） |
| namespace-runtime 公共类型四名目 | `NamespaceRuntimeRead{Array,Map}{Options,Result}` 形状（成功仍四键） | `namespace-runtime/src/index.ts` L60–70 亲证 | 零变化（§8.1）；compose 签名为模块内部面 |
| lease / registry 类型别名与透传 | `NamespaceLeaseRead*` = runtime 联合别名；released 短路先于透传 | `types.ts` L465–482、`lease.ts` L305–315 亲证；ADR 0009/0028 §9 | 零变化（AC3） |
| 规范 wire 面（instance-replication-v1） | 全部帧/码/状态机冻结值 | 协议文档 grep 亲证零窗口面 | 零接触 |
| CONTEXT.md「窗口读」/「过滤窗口」词条 | PR #380 写定文本 | CONTEXT.md L61–67 亲读 | 零改动（D5）——词条语义与 P1 后行为一致 |

**被解除的冻结面**（唯一）：W1 成功结算 own 键集两键（含 P7 锚）与 `window.ts` 包范围冻结——经 §4 Override 1 合法解除；实现期须核对解除范围未扩大（read.ts / 姊妹面 / 值导出面均不得被波及）。

## 6. Evolution requirements

**无**。本设计不要求任何 ADR / CONTEXT.md / 协议文档随变更集修订：

- 公共结果类型变化由 ADR 0029 §5 **预先记载**（两键扩三键、total 恒在）——实现规范而非修订规范；
- 冻结解除由 ADR 0029 §8 **预先指令**；
- lease 面、✂ 文法、失败族、readData、wire 全部不变——无「文档说 A、代码做 B」的漂移面；
- P2（where）的 `total: number | undefined` 加宽与 §6 两层校验扩展是 ADR 0029 **已含**的终态义务（owner 分期），届时亦无需修订 ADR——只需实现。

唯一文本级注记：§3-18 的「ADR 0028 §13 R2」引用谱系不精确（实为 #369 设计 §13 R2），不构成语义歧义或修订义务，仅记录。

## 7. Hard conflicts

**无**。全部 18 项对照中无任何「与现有决策不兼容且无合法 override / 正式修订路径」项。

## 8. Required actions

| # | 动作 | 责任/时机 |
|---|---|---|
| 1 | **实现后冲突复查**（本报告标记 `requiresConflictRecheck: true` 的兑现）：核对 (a) 文档-代码同变更集——`window.ts`/`window-read.ts`/`runtime.ts` 头注与 JSDoc 清账随代码同步（X5）；(b) override 范围未扩大——`read.ts` 零 diff、零新公共导出、`copied from` 标记 ≤1 且措辞重述、`copied from carrier.ts` 归零（X2）；(c) P7/类型锁迁移与 ADR 0029 §5 三键语义一致（含失败半四键负控不动）；(d) lease 四键 + ✂ byte 级断言零 diff 全绿（M4/R1–R3）；(e) 结构审计 X1/X3/X4 落 `artifacts/sa3-issue381-*.log` | SA8 implementation 复查轮（若总控调度） |
| 2 | P2（where）票义务登记确认：`total` 类型加宽 `number → number \| undefined`（ADR 0029 §5）+ W1/S3 两层校验同步扩（§6）+ truncated 双语义 + ✂ 永不装配（§5）——设计 §12 已登记为任务外 follow-up；P2 设计时须再过冲突门 | 后续票（非本票缺陷） |
| 3 | 谱系注记（§3-18）：「ADR 0028 §13 R2」实指 `wiki/raw/task_issue-369_design.md` §13 R2——仅记录，本票与后续票均无需改 ADR 文本 | 无动作 |

## 9. Verdict

**clear**

- 18 项对照全部落在 `no-conflict`（13，含 P1 类型分期核验与引用谱系注记两份边界裁决）与 `implements-existing-decision`（5：§3 行 1/3/7/15/16）；
- 两项 override 均有合法权威（已接受 ADR 0029 §5/§8），scope 收窄明确、被排除面（read.ts / 姊妹面 / 值导出面）在设计 DENY LIST 与非目标中逐项钉死；
- evolution-required 0：无文档修订缺口；hard-conflict 0：无阻断项；
- 设计的事实断言本轮独立核验全部成立（含两处易错点：P7 确为 W1 窗口面唯一两键锁——contract-red L798 是姊妹面 NC1 负控、shape-budget 两处是姊妹面预算锁，均不在迁移面；`countWindowCandidatesAtPath` 导出确无包外消费者）。

## 10. requiresConflictRecheck

**true**

理由（skill 触发条件逐项）：

1. **公共 API 类型面变化尚待实现核对**：doc-runtime 两结果联合（经 `src/index.ts` 既有导出）成功成员增必填 `total`——实现须与设计 D1 逐位一致（键序、失败面零变化、类型锁迁移）。
2. **正式 override（冻结解除）尚待实现核对**：W1 两键冻结 + `window.ts` 包冻结的解除范围、镜像清账边界（safePathCopy 保留件措辞）、read.ts 红线维持，须在 diff 上逐项确认未扩大。
3. lease 恒四键 byte 级不变（AC3）与 M4 零 diff 是行为承诺，实现后须以两测试树 `git diff --stat` 为空 + 既有用例零改动全绿闭合。

若实现严格落在设计 §10 ALLOW/DENY 清单内，复查预期结论为维持 clear。
