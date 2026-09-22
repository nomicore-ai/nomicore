# 设计冲突门禁报告 — Issue #442（design 后 ADR 冲突复审；SA1 请求复查）

- 被审对象：`wiki/raw/task_issue-442_design.md`（SA1 design，449 行，iteration 0 首版）
- 任务简报：`wiki/raw/task_issue-442.md`（Issue #442：lease 端到端 Record/parent 逐 entry 校验行为钉死
  （ADR 0034）；feature；「不改实现，只把新语义在最高 seam 上立法成回归测试」；AC1–AC7；Blocked by #441；
  Comments 空）
- 上游固定产物：`wiki/raw/task_issue-442_sa6_contract.md`（SA6 **approve**）、
  `wiki/raw/task_issue-442_sa6_capability_probe.mts` + `artifacts/sa6-issue442-*.log`（14 份证据日志，HEAD
  7 轮 / baseline 4 轮 31/31、coverage-census、pre-typecheck、pre-test、head-focused-441-437）
- **缺席输入（如实登记）**：`task_issue-442_relevant_decisions.md`、`task_issue-442_conflict_report.md`
  （前置门禁工件，iteration 0 未产生——设计 §6/§14 已如实登记并直读 ADR 替代）；
  `task_issue-442_sa2_review.md` 不存在（无 SA2 攻击评审可读）。本报告的 Decision analysis 节对
  ADR 全集执行同等筛查，前置筛查缺口就此闭合。
- 冲突基准（本轮全部亲读原文）：`docs/adr/` 34 份（无 superseded；均「已接受」，部分带修订节）中被引
  及相关 12 份的关键条款——ADR-0034 全文（决策 1–6 + 不做什么 + 后果）、ADR-0033 全文（决策 1–6）、
  ADR-0007 issue #237 修订节 + ADR 0033/0034 修订注记（L62–159）、ADR-0010 正文（NamespaceLease 与
  ReplicationSession / Trusted raw update 节）+ #134/#237/#172 修订节、ADR-0011 全文（含 #228 澄清节）、
  ADR-0014 carrier 契约（L140–212）、ADR-0026 全文（信封双形态/批内不嵌套/单事务单 update bytes）、
  ADR-0009/0012/0017/0025 经词条与边界核对；`CONTEXT.md` 重建校验（L144）/零写入（L149）/原子变更
  （L152）/封闭对象（L166）/ReplicationSession（L197）/复制未校验（L201）词条；`docs/AGENTS.md`
  Authority 节；`packages/namespace-registry/AGENTS.md`、`packages/doc-runtime/AGENTS.md`、
  `packages/namespace-diagnostic-log/AGENTS.md`（明确收录的决策）
- 独立核验方式（源码仅作事实确认，不作冲突基准）：`git log` 亲证 HEAD `c42fb47` 含 #441 `61778bc`、
  pre-#441 基线 `3fd6aa8`（ Blocked by #441 已满足）；`mutation-local.ts` L285–310 闸门注释与双条件
  亲读；`testing.ts` L86/L126（`createRegistryTestScheduler`/`createNamespaceRegistryForTesting`）、
  `lease.ts` L312–337/L392（readData 双重载透传 / mutateData）、`namespace-diagnostic-log/src/index.ts`
  L56（`createBoundedMemoryDiagnosticLog` 公共面）亲证；`#437` fixture L270–300（生产形状诊断 binding +
  `../../namespace-diagnostic-log/src/index.js` 相对源码导入 + `importReplica` peer 面）与
  `#440` fixture 头注/Schema（L5–40，Record/parent 两形态覆盖）亲证；`vitest.config.ts` include/
  `maxWorkers:1`、registry `tsconfig.json` include `src/**/*.ts` 亲证；`packages/namespace-registry/test`
  无 `issue-442-*`、doc-runtime `issue-441-*` 三件在位亲证
- 裁决人：SA8 Conflict Gatekeeper（设计后复审轮）
- Worktree：`/home/wangjian/nomicore-fix-issue-442`（branch `mabf/issue-442`，HEAD `c42fb47`，干净——
  仅 untracked 上游产物与本报告）
- 时间：2026-09-22（UTC）

## Verdict

**clear**（`requiresConflictRecheck: false`）

1. **ADR 层：0 hard-conflict、0 evolution-required、0 override 需求**。设计是**纯测试新增**（3 文件，
   ALLOW LIST 不含任何 `src` 路径；DENY LIST 显式冻结生产面/规范文档/上游产物），不触碰公共 API、
   wire、schema、持久化、状态机、生命周期或失败语义。全部对照项为 `no-conflict` 或
   `implements-existing-decision`——后者兑现的是 ADR-0034 决策 1 明文的「issue 路径 `[...mapPath, key]`
   与现行逐字节兼容（**兼容行为，钉回归测试**）」义务与 ADR-0014/0011 已冻结的记录/carrier 契约钉死，
   在任务简报指定的 lease 最高 seam 上落地。
2. **SA1 提请复核的两项解释性决策均裁定不越权**：(a) §7.6 非重复立法边界（S9/E201-C/fatal/commit 字节
   面不回落 lease seam）与 ADR-0034 后果-验证的验证面分配（S9 收窄归 doc-runtime 测试）逐字一致，
   `issue-440-elementwise-entry-*` 与 `issue-441-record-fastpath-*` 在位亲证，边界划分是**消费**而非
   修订；(b) §5 对 SA6 契约「30+4=34」vs 枚举「29+4=33」计数矛盾的仲裁**成立**——SA6 §12.3 逐 ID
   枚举（11+8+2+3+2+3=29 契约 + 4 负控 = 33）是其 §1/§13 头部算术（34、5757→5791）的内部矛盾方，
   以枚举为准 + 验收锚「零 skip 且逐 ID 覆盖 §12.3 全表」是正确读法；wiki/raw 属证据非规范
   （docs/AGENTS.md Authority 节 + ADR-0010 #172 修订节第 2 条），对证据内部矛盾的仲裁不构成决策修订。
3. **一处非阻断勘误**（Required action 1）：设计 §1/§7.7 两处以「ADR 0034 决策 6」为「软验收（不钉
   毫秒）」的出处——ADR-0034 决策 6 实为「与 ADR 0033 的关系与排序」；软验收实质出自 ADR-0034 后果-验证
   基准条款（「基准测试（如 10⁵ entry map 单键写耗时与 n 解耦）」）与 ADR-0033 决策 6（「不钉绝对毫秒
   数」）。「不钉毫秒、只用结构性读计数」的**行为**与真实决策文本完全合规，仅条款指针错误（源头是
   SA6 契约 §15 的同款误引，其 §3 本身列对），不影响任何断言、边界或冻结值。

## 1. Inputs and decision set

（见报告头「冲突基准」与「独立核验方式」；被审设计引用的全部代码锚点、测试先例、runner 配置、基线
修订均经本轮亲证，与设计 §2.1/§10/§11 的陈述一致。无 superseded ADR；被引修订节均为有效 append-only
修订而非废弃。）

## 2. Decision analysis

| # | 决策（路径·条款） | 被审设计行为 | 裁决 | 证据 | Required action |
|---|---|---|---|---|---|
| 1 | ADR-0034 决策 1（Record set/delete 逐 entry fast path；闸门=非 union Record 形态；union map 位永久双轨；**Record 值位 union 不阻断**；域规则不变 + 「issue 路径 `[...mapPath, key]` 与现行逐字节兼容（兼容行为，**钉回归测试**）」） | §7.3 A1–A11/U3–U4/V1–V3 立法 fast path 行为与成本（`ok` 位、污染保留、恰 1 update、读计数 ≤8/≥n/跨 n 相等）；§7.4 C1–C3 钉 union map 位永久 legacy；§7.5.1 逐字 message/path 冻结（`toBe` 非 `includes`） | **implements-existing-decision**（「钉回归测试」义务 + 简报 AC1/AC3/AC4 在 lease seam 兑现；不改实现） | ADR-0034 L16–22；设计 §7.3/§7.4；SA6 §5.2 HEAD 31/31 实测冻结值；`mutation-local.ts:285–310` 闸门亲证 | 无 |
| 2 | ADR-0034 决策 2（封闭对象 delete 静态判定：必填且非 unknown → 拒；optional ∨ unknown 标量 → 允许；`has` 拒 no-op 不变；未知键不可能在场） | §7.3 A6–A8（A8 静态理由 message 级判别）、B4–B6（必填拒/unknown 允许/重复 delete no-op）；§7.4 C4 | **implements-existing-decision** | ADR-0034 L24–31；设计 §7.3；SA6 §5.2/§5.3 A8 两面判别证据 | 无 |
| 3 | ADR-0034 决策 3 + 后果-验证（S9 收窄；验证面清单将「S9 收窄」归 **doc-runtime 测试**） | §1 非目标 + §7.6 不在 lease seam 重复立法 S9 安装事实核/E201-C/fatal 面/commit 字节等价（#441 FC/NB/NA/ND 组已锚，lease seam 不可观察重投影核） | **no-conflict**（边界划分=消费验证面分配，非修订） | ADR-0034 L33–35/L70；设计 §7.6；`packages/doc-runtime/test/issue-441-*` 三件在位亲证；SA6 §11「S9 在 lease seam 不可观察」裁定 | 无（SA1 提请确认项 (a)：**不越权**，见 Verdict 2a） |
| 4 | ADR-0034 决策 4（触达面=map/父载体+目标键位；触达面外污染不阻断不修复；触达面内载体位仍响亮拒绝）+ ADR-0010 issue #237 修订节第 1 条（后备句定稿）+ CONTEXT.md「复制未校验」词条（触达面收窄两阶段立法） | §7.3 A1–A11（污染保留 + `ok:true` + 零写入锚）；B7（`ROOT.tasks` 载体位逐字拒绝、path `[]`）；§7.5.2「不修复」负向断言形态（污染逐字不变 + 恰 1 update + R3 对端保留污染证伪整 map 重写） | **implements-existing-decision** | ADR-0034 L37–41；ADR-0010 L343–347（修订节）；CONTEXT.md L201–202；设计 §7.3/§7.5.2 | 无 |
| 5 | ADR-0034 决策 5（容器合法性 ⟺ 逐 entry 合法；禁止 map 级约束特判；enforcement = 一致性 fixture + 本文档，「数组案 fixture 扩展覆盖 Record/parent 两形态」） | B1–B8 逐字域规则冻结（键 Pattern/值 schema/no-op/必填）；一致性 fixture（逐 entry 判定 vs 全量 `validateSubtree` 等价）不在本票——归 #440 扩展面（§7.6） | **no-conflict**（enforcement 义务归属 #440；本轮亲证 `issue-440-elementwise-entry-fixture.ts` 头注与 Schema 覆盖 Record/parent 两形态，义务已在位） | ADR-0034 L43–49；设计 §7.6；`packages/vfsl/test/issue-440-elementwise-entry-fixture.ts:5–40` 亲证 | 无 |
| 6 | ADR-0034 后果-验证（基准测试「耗时与 n 解耦」；根 `pnpm typecheck`/`pnpm test`）+ ADR-0033 决策 6（性能验收软：「不钉绝对毫秒数」） | §7.5.3 成本断言=形态+不等式+跨规模相等（≤8/≥n/n=64 与 n=256 相等），不钉 `valueReads===1` 精确值、不钉毫秒；§12 验证命令 2/3 落地后复跑根 gates（AC7） | **no-conflict**（行为合规；**条款指针勘误**：设计 §1/§7.7「ADR 0034 决策 6 软验收」误引——ADR-0034 决策 6 是与 0033 排序（L51–55），软验收实质在 ADR-0034 后果-验证基准条款 + ADR-0033 决策 6；误引源自 SA6 契约 §15 同款错误，其 §3 列对） | ADR-0034 L69–70；ADR-0033 L52–54；设计 §1/§7.5.3/§7.7 | **RA-1（非阻断勘误）**：下次原位修订设计时更正指针；不改任何断言/边界/冻结值 |
| 7 | ADR-0033（数组逐元素先例；#435–437 完成为 ADR-0034 开工前置；lease 三件套立法纪律） | §7.1/§7.2 沿 #437 三件套结构（共享 fixture 零 vitest 依赖/契约/负控独立文件）；Map 读计数助手为数组版对偶新移植（8 出口全覆盖）；fixture 命名/常量与 #437 隔离（R-7） | **no-conflict** | ADR-0033 全文；ADR-0034 L51–55（排序已满足：#437 测试在位亲证）；设计 §7.2.4；`issue-437-lease-array-e2e-*.ts` 三件亲证 | 无 |
| 8 | ADR-0007 issue #237 修订节（路径级/边界级校验取代完整 ROOT 校验；损坏条款 (i) 导航逐跳载体形态违规仍响亮拒绝 / (iii) set 目标位旧值不读 / (iv) 触达面外不发现不修复不扫描）+ ADR 0033/0034 修订注记（Record 位/父位逐 entry 化） | B7/C1/C4（载体位响亮拒绝，path `[]`/`['mz']` 冻结值）；A3（delete 污染键自身不读旧值）；A 组（兄弟位污染不连坐） | **implements-existing-decision** | ADR-0007 L98–107（条款 4 定稿措辞）、L126–159（修订注记）；设计 §7.3/§7.4；SA6 §5.2 逐字冻结值 | 无 |
| 9 | ADR-0026（信封双形态互斥；`ops` 非空 ≤16、批内路径互不嵌套；全部成功单事务按序提交=单条 update bytes；一个写槽=一条诊断记录） | A11 批量 `{ops:[set t7, set t8]}`——兄弟路径不嵌套、2 ≤ 16、断言单事务单 update（差值恰 1）；E1 恰 1 条 root-mutation attempt | **no-conflict**（消费既有信封契约，断言方向与 ADR 逐字一致） | ADR-0026 L14–46；CONTEXT.md「原子变更」L152–155；设计 §7.3 A11/E1 | 无 |
| 10 | ADR-0010 正文（ReplicationSession 窄能力五件套：encodeStateVector/encodeDiff/subscribeOwnedUpdates/applyRemoteUpdate 进唯一 write sequencer/getStatus；「不暴露 live Y.Doc」；trusted raw 绕过 VFSL 预校验）+ #133 round-2 §3（importReplica 绑定 Hub 广告身份）+ CONTEXT.md「ReplicationSession」词条 | 污染只经 `session.applyRemoteUpdate`（§7.2.3 applyRawRemote，禁止 lease 层直写 live Y.Doc）；peer bootstrap 经 `registry.importReplica(owner, NS, snapshot, identity)`（identity 取 hub status 的 replicationId/epoch）；R1 断言 session 冻结四域+direction。fixture 的 `doc: Y.Doc` 引用是 **host 侧装置**（自有 Persistence 持有 handle，非库公共面暴露）——#437 合入先例同款（本轮亲证 L130/L187/L224–225/L351–358） | **no-conflict** | ADR-0010 L71–107、L283–287；CONTEXT.md L197–199；设计 §7.2.1/§7.2.3/§7.3 R1；`issue-437-lease-array-e2e-fixture.ts` 亲证 | 无 |
| 11 | ADR-0011（best-effort：emit 不改业务结局；诊断不参与提交条件；coverage 含 ROOT mutation；committed update=权威 effect，不得以 mutation input 冒充）+ #228 澄清节 | E1/E2 只读观察既有 attempt record/carrier（`updateCapture:true` 经 registry `diagnosticLog` 构造选项装配，#437 生产形状 binding 同款）；**不 wire 新发射**；异步扇出有界 settle（400 轮）；carrier 重放 oracle（真事务增量/空 doc 不物化） | **no-conflict** | ADR-0011 L18–27/L89–93/L107–129；设计 §7.3 E1/E2、§8 路线 3；`issue-437-lease-array-e2e-fixture.ts:281–299` 亲证 | 无 |
| 12 | ADR-0014（carrier：`format:'yjs-update-v1'`、payloadLength、CRC32C 8 位小写 hex、Base64、inline threshold；业务 producer 只提交 semantic emission）+ namespace-diagnostic-log AGENTS（冻结 v1 record 契约、emit 同步不 throw） | E1 carrier 形态断言（inline/format/正 payloadLength/8-hex crc32c/重放收敛）；E2 record/carrier **键集同构**（10+5 键）；不钉 `payloadLength=43`/`crc32c='be9fa1fe'` 魔数（证据值非断言字面量） | **implements-existing-decision**（钉死已冻结记录形态，不改它） | ADR-0014 L140–212；`packages/namespace-diagnostic-log/AGENTS.md` Contract 节；设计 §7.5.3 | 无 |
| 13 | `packages/namespace-registry/AGENTS.md`（公共 API 只经 `src/index.ts`；hostile/test 控件留在 explicit testing surface；lease=独立 caller capability） | 零新导出、零 `src` 改动（DENY LIST）；fixture 只消费 `@nomicore/namespace-registry`（+`/testing`）公共面；诊断包经 `../../namespace-diagnostic-log/src/index.js` 相对源码导入（其本身是 registry 包既有依赖；#437 合入先例逐字同款，本轮亲证 L46） | **no-conflict** | AGENTS.md Boundaries；设计 §7.2.1/§11；`vitest.config.ts` alias 双上下文解析亲证 | 无 |
| 14 | `packages/doc-runtime/AGENTS.md`（公共 API 只经 `src/index.ts`；绝不暴露 live 可写 ROOT/SCHEMA/META；post-write invariant 失败=fatal 非可恢复校验结果） | DENY LIST 含 `packages/doc-runtime/src/**` 与 `issue-441-*`（已合面冻结）；断言只经 lease 面，`doc` 引用仅装置面；fatal 面不立法（§7.6 归 #441） | **no-conflict** | AGENTS.md Boundaries；设计 §1/§7.6/§11 | 无 |
| 15 | `docs/AGENTS.md` Authority 节（wiki/raw 为证据非规范）+ ADR-0010 issue #172 修订节第 2 条（同款） | §5 对 SA6 契约计数矛盾（头部「30+4=34/5791」vs §12.3 枚举 29+4=33/5790）**记录并仲裁以枚举为准**，不静默复制；验收准绳=「零 skip/only/todo 且逐 ID 覆盖 §12.3 全表」 | **no-conflict**（对非规范证据的内部矛盾作读法仲裁，零决策文本被修订；仲裁经本轮独立复核**成立**：11+8+2+3+2+3=29 契约、5757+33=5790） | docs/AGENTS.md；ADR-0010 L315–318；设计 §5 承接表/R-6；SA6 §12.2 vs §12.3 亲证 | **RA-2**：实现期按枚举 33 落盘，Controller/SA7 按设计 R-6 口径知悉（SA1 提请确认项 (b)：**仲裁成立**) |
| 16 | 任务简报 AC1–AC7 + Blocked by #441 +「不改实现」 | §12 AC→契约组→用例 ID→证据逐条映射（AC1=A1–A11、AC2=B1–B8、AC3=C1–C3+U3、AC4=V1–V3、AC5=E1–E2、AC6=R1–R3、AC7=根 gates）；ALLOW LIST 仅 3 测试文件+设计产物；#441 已合入 HEAD（`61778bc` ⊂ `c42fb47` 亲证） | **no-conflict** | `wiki/raw/task_issue-442.md`；设计 §11/§12；`git log --oneline` 亲证 | 无 |

裁决分布：**no-conflict 11 项、implements-existing-decision 5 项、evolution-required 0、hard-conflict 0**。

## 3. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

设计未声明任何 override，也未发现需要 override 的场合（纯测试新增不触碰任何被冻结契约）。Owner 评论
面为空（REST issue-comment `[]`、简报 Comments 段空），无 Owner 授权的决策覆盖。

## 4. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| issue message/path 形态（`[...mapPath, key]` rebase、逐字域规则文案、no-op/必填/键 Pattern/载体错位文案） | ADR-0034 决策 1 末条（「与现行逐字节兼容（兼容行为，钉回归测试）」） | 设计 §7.5.1 以 `toBe` 逐字钉死（B1–B8/A8/C1/C4）；SA6 §6-C3 两面逐字同 | 不变（测试钉死而非修改） |
| mutateData 信封双形态（单操作/`ops` 批量互斥、批内不嵌套、≤16） | ADR-0026 决策「信封形态」节；CONTEXT「原子变更」 | 设计消费两种形态（A11 批量），零信封改动 | 不变 |
| ReplicationSession 公共面与拒绝码闭集 | ADR-0010 #134 修订节（append-only 码表/O-11 状态形状）；CONTEXT「ReplicationSession」 | fixture 只消费（applyRemoteUpdate/subscribeOwnedUpdates/encodeDiff/encodeStateVector/getStatus/importReplica） | 不变 |
| 复制 wire 契约（instance-replication-v1.md 帧/状态机/错误码） | `docs/protocols/instance-replication-v1.md`（normative） | AC6 仅断言协议面不变；R1–R3 全在进程内 session 面，零 wire 代码触碰（DENY LIST ws-replication/replication-protocol 未列入 ALLOW） | 不变 |
| 诊断 v1 record schema + update carrier 形态 | `packages/namespace-diagnostic-log/AGENTS.md`（冻结指纹钉死）；ADR-0014 L140–212 | E1/E2 只读观察 + 键集同构断言；不钉魔数 | 不变 |
| registry/doc-runtime/vfsl 公共导出面 | 两包 AGENTS.md「Add public APIs only through src/index.ts」+ ADR-0034 后果-验证 public-surface guard | DENY LIST `packages/*/src/**`；无新导出；public-surface guard 不触发（设计 §10） | 不变 |
| ADR/CONTEXT/docs 规范文档 | `docs/AGENTS.md`（Amend or supersede explicitly） | DENY LIST `docs/adr/**`、`CONTEXT.md`、`docs/**`（「无决策/词汇变化」） | 不变 |
| 根 gates（`pnpm typecheck`/`pnpm test`） | ADR-0034 后果-验证末句 | 设计 §12 验证命令 2/3：落地后 471→473 files、5757→5790 tests 全绿（AC7） | 待实现期复跑（既定门，非冲突） |

## 5. Evolution requirements

无。设计零契约变更：不修订任何 ADR/CONTEXT/协议条款，不新增词表值（诊断 update-omitted reason、
observer 事件、错误码、stages 等冻结词表面均未触碰），无迁移/兼容/版本问题。唯一登记的 follow-up
（合法性重建、carrier 覆盖面审计、raw 污染异步审计）均为 ADR-0010 #237 修订节第 2 条与 ADR-0034
「不做什么」既有的另票登记，设计正确地不承担（§13）。

## 6. Hard conflicts

无。

## 7. Required actions

1. **RA-1（非阻断勘误，证据卫生）**：设计 §1 与 §7.7 的「ADR 0034 决策 6 软验收」条款指针有误——
   ADR-0034 决策 6（`docs/adr/0034-...md` L51–55）是「与 ADR 0033 的关系与排序」；性能软验收的规范
   出处是 ADR-0034 后果-验证基准条款（L70「基准测试（如 10⁵ entry map 单键写耗时与 n 解耦）」）与
   ADR-0033 决策 6（L52–54「不钉绝对毫秒数」）。误引继承自 SA6 契约 §15（其 §3 列对）。设计的实际
   行为（结构性读计数、不钉毫秒）与真实决策文本完全一致，故不阻断；在下次原位修订设计或实现期备注时
   更正指针即可。
2. **RA-2（实现期验收口径）**：按枚举 **33 its（契约 29 + 负控 4）** 落盘；验收准绳 =「零 skip/only/
   todo 且逐 ID 覆盖 SA6 §12.3 全表」，不机械对齐 SA6 §1/§13 的「34/5791」算术笔误（设计 §5/R-6
   已登记；Controller/SA7 知悉）。根 gate 期望 473 files / 5790 tests。
3. **RA-3（既定门）**：落地后复跑根 `pnpm typecheck` 与 `pnpm test`（AC7；设计 §12 验证命令 2/3），
   聚焦面 `npx vitest run packages/namespace-registry/test/issue-442-lease-record-e2e-{contract,control}.test.ts`
   2 files / 33 tests 全绿。

## 8. Verdict

**clear**

- 全部 16 项对照为 `no-conflict`（11）或 `implements-existing-decision`（5）；无 `evolution-required`、
  无 `hard-conflict`、无 override 需求。
- SA1 提请复核的两项解释性决策（§7.6 非重复立法边界、§5 计数矛盾仲裁）均裁定成立且不越权。
- 唯一发现（RA-1 条款指针误引）为非阻断证据卫生项，不构成「缺少必要修订」——被指条款的真实文本
  支持设计的全部行为断言。

## 9. requiresConflictRecheck

**false**。理由：纯测试新增（3 文件），零生产实现/公共 API/wire/schema/持久化/状态机/生命周期/失败
语义变更，无正式 override 待实现核对；全部裁决为 no-conflict 或既有决策兑现（无新决策面）；实现期
交付物为按 SA6 §12.3 冻结规格落盘的测试文件，其行为期望已由 SA6 在 HEAD 7 轮 31/31 实测锚定，
无「实现后需再核对文档与代码同变更集」的语义面。若实现期实际 diff 越出 ALLOW LIST（触碰任何
`src`/规范文档/wire 面），则触发 implementation 复查（skill 既定条件），与本裁决无关。
