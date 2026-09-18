# SA9 最终标准审查 — Issue #406 窗口面同轴：`readArray` / `readMap` 的 `maxBytes`

- 派发：`sa-ff10df47-4450-48d1-89af-f1e0f34ca455`（role `mabf-sa9`，phase `standards-review`，iteration 0）
- 审查对象：**已提交交付** HEAD `f1f9cd0dbc6c82fd9138e6eff4584cab6619b0bd`（`feat(namespace-runtime): add window read byte budgets`，branch `mabf/issue-406`）；父 PR #403 基座 `docs/adr-0031-readdata-byte-budget` = `56cf54281574ba15a2c471bb79ea57e813a94868`（本次 `git log`/`git status` 实测：HEAD 恰为基座上 1 个提交，工作树干净）
- 审查方式：独立静态标准审查。全部源码/测试/文档/ADR 断言均为本次实读核验（非转抄上游报告结论）；按职责不运行测试、不修改任何代码/设计/测试，唯一写入产物即本文件
- Owner 评论：REST Issue-comment 快照为空（派发说明明示）——无评论来源 override、豁免或附加义务

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `docs/adr/0031-readdata-byte-budget.md`（母法，决策 1–6 + 修订节 + 备选否决表 + 验收节） | 全文实读 |
| `wiki/raw/task_issue-406_sa6_contract.md`（rev1 approve；18 冻结锚 + G1–G10/T1–T5/C1–C10 + pins D1–D7 + §12.8 门禁） | 全读 |
| `wiki/raw/task_issue-406_design.md`（SA1；DD-1–DD-9、ALLOW/DENY、R-1–R-8） | 全读 |
| `wiki/raw/task_issue-406_sa2_review.md`（approve；O-1–O-4） | 全读 |
| `wiki/raw/task_issue-406_sa3_impl.md`（首版；Deviations D-1/D-2） | 全读 |
| `wiki/raw/task_issue-406_sa4_review.md`（approve；O-1–O-5） | 全读 |
| `wiki/raw/task_issue-406_design_conflict_report.md`（SA8 设计门禁 clear；RA-406-1…5） | 全读 |
| `wiki/raw/task_issue-406_implementation_conflict_report.md`（SA8 实现门禁 clear；RA-406-1/2/3 闭合） | 全读 |
| 源码实读：`packages/namespace-runtime/src/{read-budget.ts,window-read.ts,runtime.ts}` 全文/diff、`packages/doc-runtime/src/window.ts` L300–L360（W1 校验器 parity 对照） | 完成 |
| 测试实读：`issue-406-*` 契约族 7 文件（fixture/red/control/test-d ×2/lease fixture/red/surface）抽样 + 全文 hygiene grep、`issue-405-maxbytes-control.test.ts` G11 diff、两处既有 `.test-d.ts` 中继锁 diff | 完成 |
| 文档实读：`.agents/skills/nomicore/typed-access.md` diff、`CONTEXT.md` L50–L54、`docs/integration/*` maxBytes 提及面、根 `AGENTS.md` 集成段 | 完成 |
| 范围实测：`git diff 56cf5428..f1f9cd0 --stat`（全量 21 文件）+ DENY 面定向 diff（空）+ `git diff --check`（exit 0） | 完成 |

## 2. Verdict

**approve**。未发现 BLOCKER 或 MAJOR。已提交交付在全部标准维度上合规：ADR 0031 决策 1–6 逐项忠实落地；模块责任归属正确（校验/度量住 runtime 组合层、doc-runtime/registry src 零 diff）；单一事实源纪律（message 模板唯一住 `read-budget.ts`、W1 五键权威不被复制、闸门权威 = canonical 复读值）成立；生命周期对称性平凡满足（纯读、零新资源）；文件范围守 ALLOW/DENY（唯一 ALLOW 外文件有父票 SA8 RA-I1 明文授权链且在案）；测试质量达标（冻结锚/独立 oracle、负控配平、零 skip/only/todo/env、真实 `@ts-expect-error` 负类型 fixture）。5 条非阻断观察见 §10。

`requiresConflictRecheck = false`（SA9 侧）：本票 SA8 实现后复审（RA-406-3）已闭合且 `requiresConflictRecheck=false`；本次标准复核未发现**新的**决策冲突面，不追加复查要求。

## 3. ADR 与决策合规

| 决策 | 标准要求 | 实读核验 | 判定 |
|---|---|---|---|
| ADR 0031 决策 1（三读面 options 域句、不新增校验码） | 六键闭合形状；`maxBytes` 域 = ≥1 有限整数（≤ 2^53−1）；域违约走各面既有码；缺席 ≡ 不设预算 | `window-read.ts` L90–L107 两面自持六键 interface（成员无 `readonly`，term/`WhereTerm` 单源 import doc-runtime）；域判据 `typeof === 'number' && Number.isSafeInteger(v) && v >= 1` 在 `splitWindowOptions`（runtime.ts）与 `canonicalWindowBudget`（window-read.ts L370–L375）**双处同判据**；present-undefined 双处剥离；域外 → `WINDOW_OPTIONS_INVALID` 恰四键（`windowBudgetAxisInvalid`，返回类型 = doc-runtime `WindowReadFailure` 单源锁）；零新码 | 合规 |
| ADR 0031 决策 2（同构度量、塑形后计量、账本不进公共面） | 总量 = 条目列表紧凑 JSON UTF-8 + 元素口径投影文本 UTF-8；✂/`‡` 自然计入；`schema:null` 计 0 | S6.5 闸（window-read.ts L271–L276）在 S6 结算与 ✂ 装配**之后**、return 之前；`deliveryBytes`（read-budget.ts L75–L79）= 两通道合计，`null` 计 0；成功路径不触碰四键、不加 bytes 键 | 合规 |
| ADR 0031 决策 3（超限零交付、三面同码同文同载荷、≤ 收） | 恰五键 `{ok,code,path,measuredBytes,message}`；message 逐字镜像；`measuredBytes` 只报合计 | `readBudgetExceeded`（read-budget.ts L88–L100）恰五键、`path` 经 `echoReadPath` 新鲜回显；模板 L52–L55 与被删除的 #405 runtime.ts 原文**逐字符一致**（本次 diff 对照确认）；readData 面构造点（runtime.ts L849–L853）已迁共享件；`>` 才拒（恰等收） | 合规 |
| ADR 0031 决策 4（分层落点 + 零变化清单） | 校验/度量住 runtime 组合层；doc-runtime 零改动；registry 别名跟随；恒四键/✂ 文法/渲染器/头行/`DeepOptional`/无 options 逐字节行为零变化 | DENY 面 `git diff --stat` 实测**全空**：`packages/doc-runtime`、`packages/vfsl`、`read-schema-projection.ts`、`packages/namespace-registry/src`、`packages/namespace-runtime/src/index.ts`、`CONTEXT.md`、`docs/`、`apps/`、`domains/`、配置文件；W1 收 relay 保持五键视野（split 消费 `maxBytes`） | 合规 |
| ADR 0031 决策 5（where 无对撞） | 无静默丢弃；装满判定永不说谎；✂ 永不装配不冲突 | S6 结算逻辑 diff 无 hunk（`@@ -207,6 +261,19` 纯加法插入核验）；闸门无 where 特殊分支、只读不写；WM4/WM5 同字节 305 判定相反锚在 fixture L241/L258 区与 SA6 §12.0 逐值一致 | 合规 |
| ADR 0031 决策 6 + 验收节（文档指引、门禁、minor bump） | 指引进 typed-access 纪律与作用域文档；发布随 minor bump | typed-access.md 窗口读小节同变更集补「Byte budget on windows」三段 + `WINDOW_OPTIONS_INVALID` 词条补域外 `maxBytes` + 失败词表补 `READ_BUDGET_EXCEEDED` 条（四要素逐项在场；相对链接 `../../../docs/adr/0031-…` 实测可解析）；版本未 bump = 发布门 RA-406-4 挂账（沿父票 RA-I2，归 Runner Host，不属代码交付面） | 合规（bump 挂账在案） |
| ADR 0028/0029（窗口读分层、恒四键、结算双语义、✂ 永不装配） | 组合层零计数/零谓词求值；`total` 单源消费 | window-read.ts 单源纪律注释与实现一致（本模块零计数函数、零导航镜像）；`truncated` 双语义 L257–L263 原样；失败面透传不吸收 | 合规 |
| ADR 0027/0024（修订链后） | 渲染器零选项纯函数；头行不记 maxBytes；E1/`DeepOptional` 不动 | vfsl/渲染器零 diff；canonical 下传 resolver 的 `budget` 恒两轴（L387–L389）；readData 值面/类型面零触碰 | 合规 |
| ADR 0008 + 三包 AGENTS | 读不进 sequencer；同步结果联合；lifecycle 停接纳稳定码；detached projections；公共 API 仅经 index.ts | 编排实读：S1 lifecycle 先于一切 options 触达；全同步、零状态写入、零订阅；产物 detached（entries W1 直通、schema 新鲜、path 新鲜回显）；registry/doc-runtime src 零改动即零公共 API 新增；runtime 侧无新方法/重载 | 合规 |
| ADR 0023 + 值导出审计 | 公共面演进可控；值导出键集冻结 | `index.ts` 零 diff 实测；`ReadDataBudgetExceededResult` 经 `runtime.ts` 原位 `export type {…} from './read-budget.js'` 保持模块面名字不变、无 index.ts 按名导出；grep 实测无 `readDataBudgetExceeded` 残留、无仓内按名外部消费方 | 合规 |
| 父票 OBL-WIN-1 / RA-1 / RA-3（挂账兑现） | 三面义务（同构度量/同码同文同载荷/负控/逐字镜像）；域钉死；文档挂账闭合 | 本票兑现且 SA8 实现门禁已逐项裁闭合（RA-406-1/2/3）；本次抽查复核一致（模板三方逐字符、域双点同判据、typed-access 四要素） | 合规 |

## 4. 模块责任与架构惯例

| 维度 | 标准 | 实读核验 | 判定 |
|---|---|---|---|
| 责任归属 | 预算校验/度量 = runtime 组合层（唯一同时见两通道的层）；五键域/未知键/宿主判据与 message = W1 单一权威 | `splitWindowOptions` 对 `maxBytes` 以外键 `defineProperty` 原样复制 descriptor（不判域、不复制判据）；`{n:1,maxBytes:1,nope:1}` 仍以「未知键：nope」被 W1 拒（结构保证） | 正确 |
| 相似能力对照 | 与 #405 readData 面刻意同构（OBL-WIN-1）；接缝净化沿 #336/#369 两出口先例 | readData（runtime.ts L791–L859）与窗口新编排（L861–L925）并排实读：S2-G0 前置分支 + loud throw 不变式守卫、split→W1(relay)→canonical→闸 逐层同构；出口①/②结构不变 | 一致 |
| 内部模块惯例 | 包内按关注点分模块、不经 index.ts（`read-schema-projection.ts` 先例） | `read-budget.ts` 新建内部模块（100 行），index.ts 零 diff；模块方向零环（runtime/window-read → read-budget 值导入；window-read → runtime 仅 type-only；read-budget 零包内导入） | 一致 |
| 读纪律 parity（RA-406-1） | split/canonical 读纪律逐字镜像 W1（计数锚 4/5 结构前提） | W1 `validateWindowOptions`（window.ts L311 起）与 split/canonical 键循环逐字同构：`Object.keys` + 每键恰 1 次显式 `getOwnPropertyDescriptor`（= 每键 2 次现行次序）、`desc === undefined` 跳过、accessor 拒、present-undefined 剥离、宿主门 relay=raw 只耗一次 `getPrototypeOf`、整体 try 收编；重派发闭包 = re-split + re-W1(relay₂)（W1 只读 plain relay，raw 零二次触达） | 一致 |
| 生产码 cast 纪律 | 不 scatter `any`/cast | 三包源码 grep：零 `: any`/`as any`/`as never`/`as unknown`；唯一断言 = split 内 `{} as O` 单点（descriptor 动态复制的静态化，注释在案，SA3 登记、SA4 O-4 备案）——有界、非行为 cast | 合规（备案） |

## 5. 单一事实源

| 事实 | 权威源 | 核验 | 漂移风险 |
|---|---|---|---|
| 超限 message 模板 | `read-budget.ts` `budgetExceededMessage`（唯一常量式构造点） | 三面（readData/readArray/readMap）同一构造器；grep 实测 src 无第二模板；fixture `budgetMessageTemplate`（测试侧独立期望）逐字一致 | 低（C8/G3 双锚） |
| 闸门预算值 | canonical 复读值（`CanonicalWindowBudget.maxBytes`） | split 返回值结构性不含 maxBytes（不喂闸门）；与 #405 同构 | 低 |
| W1 五键判据/message | doc-runtime `validateWindowOptions` | split 只中继不判定；探测期 message 与 W1 L351 收编条**逐字相同**（本次逐字符比对） | 无（结构保证） |
| `total`/truncated/✂ | W1 结算 + S6 分支结构 | 闸门零参与（diff 无 S6 hunk） | 无 |
| 类型面单源 | 六键自持 interface + `Omit<…,'maxBytes'>` 中继锁 + `keyof` 硬锁 + lease 纯别名 | 两处既有 `.test-d.ts` diff = SA6 §12.2 登记的锁原位延伸（实测一致）；registry `types.ts`/`lease.ts` 零 diff 自动跟随 | 低（编译红锁） |

## 6. 生命周期对称性

纯读路径：零新资源、零订阅、零缓存、零 sequencer 交互；每次调用全新产物（detached）；拒绝成员即完整结果（零部分交付、零清理义务）；`close()` 幂等与 lifecycle 停接纳面零触碰（S1 门原样先行）。**平凡满足。**

## 7. 文件范围审查

| 路径 | ALLOW/DENY 依据 | 实测 | 判定 |
|---|---|---|---|
| `packages/namespace-runtime/src/read-budget.ts`（新）/ `window-read.ts` / `runtime.ts` | 设计 §11 ALLOW | 在 diff | 合规 |
| `.agents/skills/nomicore/typed-access.md` | ALLOW（OBL-DOC-406-1；SCOPE_DOCS 实名清单一员） | +9 行纯加法 | 合规 |
| `packages/namespace-runtime/test/issue-406-*`（4 文件）+ `packages/namespace-registry/test/issue-406-*`（3 文件） | ALLOW（SA6 §12.2 清单沿用） | 与清单一一对应 | 合规 |
| 两处既有 `.test-d.ts` 中继锁延伸 | ALLOW（SA6 §12.2 原位延伸，HEAD 即绿） | diff 恰为登记的 `Omit` 中继形态 | 合规 |
| `packages/namespace-runtime/test/issue-406-window-maxbytes-control.test.ts` C7 装置修订 | ALLOW「仅装置缺陷时原位修订并记录理由」 | `maxBytes:1→0` + 理由注释 + **增强** `toContain('maxBytes')`；与同契约 G5 有效域接受锚的矛盾论证成立（D-2 在案） | 合规（授权面内） |
| `packages/namespace-runtime/test/issue-405-maxbytes-control.test.ts` G11 前两条断言改写 | 设计 ALLOW **未列**（落 DENY「其余既有测试」）；授权链 = 父票 SA8 实现门禁 §8 RA-I1「届时原位改写并送门禁复核」+ 本票 SA8 RA-406-3 | 改写后 `READ_BUDGET_EXCEEDED` 恰五键（键集复用 `BUDGET_FAILURE_KEYS` 单源常量）；回退敏感（窗口面退回未知键即红）；doc-runtime 直调与无预算用例零改动；SA8 实现门禁复核通过 | **偏离设计 ALLOW 但有上游明文授权**（非阻断；SA4 O-1 已登记） |
| DENY 面（doc-runtime/vfsl/渲染器/registry src/index.ts/CONTEXT/docs/protocols/配置/fixture 冻结锚） | 设计 §11 DENY + ADR 0031 决策 4 | `git diff --stat` 实测**全空**；fixture 锚表 spot-check（WA0=199+100=299、WM9=49+187=236、WM4/WM5=305）与 SA6 §12.0 逐值一致 | 合规 |
| `wiki/raw/task_issue-406_*`（7 份 SA 产物随变更集提交） | 仓内惯例（#405 同款：wiki/raw 属证据非规范契约） | 在 diff | 合规 |

## 8. 测试质量标准

| 标准 | 核验 | 判定 |
|---|---|---|
| 卫生（SA6 §12.5 R10）：零 skip/only/todo/env override/fallback/源码字符串断言 | 全部 7 个契约/夹具文件 grep（`\.skip|\.only|\.todo|process\.env|readFileSync|__dirname|require\(|vi\.stubEnv|vi\.mock`）**零命中** | 达标 |
| 期望来源纪律（R1）：冻结锚或独立 oracle，绝不从被测 `measuredBytes` 反推 | fixture 锚表 + `measureWindowChannels` 独立两通道测量（同运行无预算读）；`expectBudgetFailure` 拒自证（fixture L346 键集前置断言） | 达标 |
| 反伪绿配平（R2/R11/R12/R13） | G5 非法矩阵 + 有效域接受锚同组；G2 边界成对（total 收/total−1 拒）；WM4/WM5 同字节反判定；变异体反证在契约 §9 E2 | 达标 |
| 类型负控真实触发编译红 | 两 `.test-d.ts` 共 10 处 `@ts-expect-error`（第七键/string 值型/缺 n/EOPT/失败面禁成功键） | 达标 |
| 红灯契约保持性 | 红灯断言只观察公共接缝（结果联合/own 键集/字节/投影文本/trap 计数/异常观测）；G 组目标语义断言零改动（两处修订均为授权面内装置/作用域断言，且强度不降反升） | 达标 |
| 发现入口真实 | 文件落 `vitest.config.ts` L15/L20 include 模式（`.test.ts`/`.test-d.ts`），无需配置变更 | 达标 |
| 契约连锁 | 仓内无窗口失败码的生产消费方（grep 实测：doc-runtime/runtime src 与测试之外零引用）；`compose*WindowRead` 签名变化（doc 形参 → redispatch 闭包）唯一消费方 = runtime.ts，未经 index.ts 导出 | 无 ripple |

## 9. 文档标准（docs/AGENTS.md）

| 规则 | 核验 | 判定 |
|---|---|---|
| 词汇精确；引入/变更领域词须同步 CONTEXT.md | 「字节预算」词条 L54 已声明**三读面**同码同文（实测）→ CONTEXT.md 零 diff 正确；typed-access.md 词汇与 ADR/CONTEXT 逐点一致 | 合规 |
| 代码行为变化须同步每份陈述该契约的规范文档 | typed-access.md 同变更集落地；`docs/integration/*` 实测仅述 readData 面（cordis-plugin-hosting L361–L375、external-project-vfsl-codegen L288 均不枚举窗口 options）→ 零 diff 正确；docs/adr 无需修订（本票兑现既有决策非新决策） | 合规 |
| 链接与引用文件名检查；`git diff --check` | typed-access.md 新增相对链接（ADR 0031/0027）实测可解析；`git diff 56cf5428..f1f9cd0 --check` exit 0 | 合规 |

## 10. Non-blocking observations（MINOR，不阻断 approve）

| # | 观察 | 证据 | 处置建议 |
|---|---|---|---|
| M-1 | 根 `AGENTS.md`「Typed Namespace writes」段窗口 options 签名枚举 stale-by-omission：现文 `readArray(path, { n, orderBy, where?, depth?, maxChildrenPerNode? })` 少 `maxBytes`（同段 readData 描述自 #405 起亦未补 `maxBytes`） | 根 AGENTS.md L31 实文；SA8 RA-406-5（advisory，open）已裁：非作用域规范文档、非决策义务、不阻断收尾 | 并入下一次文档巡扫（连同 #405 readData 口径与父票 RA-I3 scanner 三键化），不宜长期悬空 |
| M-2 | 验证证据日志未留档于 HEAD：SA3/SA4 报告引用的 `artifacts/sa3-issue406-*.log` 与 SA6 §13 引用的 `artifacts/sa6-issue406-*.log` 在提交树与工作区均不存在（SA6 §16 自记「未跟踪新增文件，不入分支提交」）；父票 #405 则将 artifacts 随 PR 提交（仓内 10 份在案） | `git ls-files artifacts | grep 406` = 空；`ls artifacts/` 无 406 文件 | 流程上自洽（SA6 已登记处置），但弱化「从提交树独立复验门禁结论」的审计链；建议后续票恢复 #405 的留档惯例或在报告中附关键命令输出摘要 |
| M-3 | Host 任务简报 `wiki/raw/task_issue-406.md` 未随变更集提交（SA1/SA2/SA3/SA4/SA6/SA8 均以其为「在场」输入引用；父票 #405 的简报已提交在案） | `ls wiki/raw/task_issue-406*` 无简报文件；`git log --all -- wiki/raw/task_issue-406.md` 空 | 纯追溯性缺口（Issue 正文为权威，REST 快照为空四方一致）；建议 Host 侧统一简报留档纪律 |
| M-4 | `splitWindowOptions` 的 `{} as O` 单点类型断言（descriptor 动态复制构造的静态化） | runtime.ts #406 段注释在案；SA3 §Deviations 登记；SA4 O-4 备案 | 维持现状；W1 键空间演进时本点与 canonical 为唯一需同步复查点（注释互指已在案） |
| M-5 | `deliveryBytes` 的 `JSON.stringify` 无 try 包裹：与已验收 #405 readData 面同阶暴露（同一 helper、同一 yjs 物化域，bigint/循环不可物化），本次迁移零行为变化、未扩大暴露 | read-budget.ts L75–L79；SA2 O-3 / SA4 §8 备案 | 备案即可；若未来出现非 yjs 来源的 raw 数据面，统一复查三面度量包裹性 |

## 11. 与既有评审/门禁的关系

- 本文件为该 slug 首份 SA9 标准审查（glob 复核无既往 `task_issue-406_sa9_standards.md`）。
- SA8 实现门禁（RA-406-3 落点）已裁 `clear` 且 `requiresConflictRecheck=false`；本审查独立复核其关键事实主张（DENY 零 diff、模板逐字节、锚表逐值、G11/C7 授权链、读纪律 parity 结构）全部成立，未发现新冲突面，SA9 侧不追加冲突复查。
- 上游审查链（SA2 approve / SA4 approve / SA8 双门禁 clear）与本审查结论一致；本审查不替代 SA10（Issue 需求完整性验收）与 SA7（活链路动态验证）。
- 剩余挂账（均不属本变更集、各自自带门禁触发条件）：RA-406-4 发布 minor bump（= 父票 RA-I2，阻塞发布不阻塞代码交付）；父票 RA-I3（doc-sync scanner 三键化）、RA-I4（CI 终态复跑）；RA-406-5（M-1，advisory）。

## 12. 结论

**approve**。Issue #406 已提交交付（HEAD `f1f9cd0`）符合仓库 AGENTS/ADR/模块责任/既有架构惯例/单一事实源/生命周期对称性/文件范围/测试质量全部标准面；唯一 ALLOW 外文件变更有父票 SA8 RA-I1 明文授权且经本票 SA8 实现门禁复核通过；5 条 MINOR 观察均非阻断。BLOCKER/MAJOR：无。
