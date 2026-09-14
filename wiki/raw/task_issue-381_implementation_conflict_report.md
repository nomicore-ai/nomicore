# 实现冲突复查报告 — Issue #381（implementation 后 ADR / 规范 / 架构冲突复审）

- 被审对象：SA3 交付 diff（工作树未提交变更：`packages/doc-runtime/src/window.ts`、
  `packages/namespace-runtime/src/window-read.ts`、`packages/namespace-runtime/src/runtime.ts`、
  三份 doc-runtime 测试迁移 + 新增 `issue-381-window-total-red.test.ts`（414 行）+
  `artifacts/sa3-issue381-*.log` × 5）及其实现证据（`wiki/raw/task_issue-381_sa3_impl.md`）
- 任务简报：`wiki/raw/task_issue-381.md`（issue #381，AC1–AC5；Comments 空；本 dispatch 明示
  刷新 REST issue comments 零评论——无新增 owner 口径，无 owner 级 override 参与裁决）
- 上游链：`wiki/raw/task_issue-381_design.md`（SA1 iteration 0）、
  `wiki/raw/task_issue-381_sa6_contract.md`（approve）、
  `wiki/raw/task_issue-381_sa2_review.md`（approve，0 BLOCKER/0 MAJOR，O-1–O-4）、
  **`wiki/raw/task_issue-381_design_conflict_report.md`（前届 SA8 verdict clear，
  `requiresConflictRecheck: true`——本报告为其 §8 Required action 1 的兑现轮）**
- 冲突基准（本轮直接回查原文 + diff 亲证）：
  - `docs/adr/0029-filtered-window-read.md` 全文（已接受 2026-09-16；§5 L45–53、§8 L65–70、§1 L17、备选 L72–80）
  - `docs/adr/0028-window-read.md`（已接受；决策 7 L63–69 结算与失败、决策 8 L71–74 成本纪律、决策 9 L76–81 分层归属）
  - `docs/adr/0027-readdata-projection-text.md` / `docs/adr/0024-readdata-shape-budget.md`（相邻冻结面，零接触核对）
  - `CONTEXT.md` L61–67（「窗口读」「过滤窗口」词条，PR #380 写定，零 diff 亲证）
  - `docs/protocols/instance-replication-v1.md`（规范 wire 契约——变更集零接触面核对）
  - 模块 AGENTS：`packages/doc-runtime/AGENTS.md`、`packages/namespace-runtime/AGENTS.md`、
    `packages/namespace-registry/AGENTS.md`、`docs/AGENTS.md`（wiki/raw 为证据非规范）
  - ADR 全集 29 份扫描：无 superseded 状态；0028/0029 均 accepted，无与本票交叠的其他在册决议
- 独立核验方式（SA8 职域：静态 diff 与决策文本对照，不运行测试、不改任何被审对象）：
  - 全部 6 个修改文件 diff 逐 hunk 亲读；DENY 名单 15 路径 `git diff --stat` 逐路亲证为空
  - 结构审计 X1/X2/X3b 本轮**独立重跑**（与 `artifacts/sa3-issue381-structural-audit.log` 逐位一致）
  - `NamespaceRuntimeWindowReadOk` / `WindowReadFailure` 与 HEAD `git show` 逐字比对（IDENTICAL）
  - 保留集（S3 `canonicalWindowBudget`/`canonicalOrderBy`、S5 `anchorSchemaBody`、S6 四函数、
    ✂ 文法、`windowFailure`/`seamWindowOptionsInvalid`/`safePathCopy`/`foldSegment`）diff 亲证
    仅注释级措辞变化、函数体零改动
  - 证据日志（focused/full-gate/t-group-head-red/sensitivity-mutations/structural-audit）全文亲读，
    exit code 与用例计数逐一对上；红基线红因（`['ok','value']` ≠ `['ok','value','total']`）亲证
- 裁决人：SA8 Conflict Gatekeeper（实现后复查轮，dispatch sa-38c7fe09-7d8f-4333-9bfe-9a739fd97b2a）
- Worktree：`/home/wangjian/nomicore-fix-issue-381`（branch `mabf/issue-381`，HEAD
  `8a4fa40` = 设计输入基线，未再推进；实现为工作树未提交变更，变更路径集与设计 §10 ALLOW 逐条对上）
- 时间：2026-09-14T12:16Z

## Verdict

**clear**（`requiresConflictRecheck: false`——见 §9/§10：前届报告标记的复查条件已全部闭合）

裁决分布（§3 对照表 17 项）：**no-conflict 12 项、implements-existing-decision 5 项、
evolution-required 0 项、hard-conflict 0 项**；前届两项 override（W1 两键冻结解除、#369 R2
镜像清账）实现范围逐项核对**未扩大**，排除面（read.ts / 姊妹面 / 值导出面 / lease 面）全部零 diff 亲证。

核心结论：SA3 diff 是 ADR 0029 §5/§8 操作性条款与前届 SA8 两项 override 的**忠实兑现**——
三键结算单源化、组合层收缩为纯组合层（S3/S5/S6）、测试家族机械迁移、lease 恒四键与 ✂ 文法
逐字节不变；无任何 ADR/CONTEXT/协议文本出现「文档说 A、代码做 B」漂移，无需任何文档随变更集修订。

---

## 1. Reviewed subject

**implementation**（SA3 交付 diff + 实现证据）。审定范围 = diff 与决策文本/前届 required-action
清单的一致性；不含实现质量、测试充分性、活链路验证完成度判断（SA4/SA7 职域）。

## 2. Inputs and decision set

| 输入 | 角色 |
|---|---|
| `wiki/raw/task_issue-381.md` | 任务简报（AC1–AC5；Comments 空 + 本 dispatch 明示刷新读回零评论） |
| `wiki/raw/task_issue-381_design.md` | 设计权威（D1–D6、§10 ALLOW/DENY、§8 验收映射） |
| `wiki/raw/task_issue-381_sa6_contract.md` | 验收契约（T1–T9/M1–M4/R1–R6/X1–X5/G1–G2） |
| `wiki/raw/task_issue-381_sa2_review.md` | 攻击评审（approve；O-1–O-4 非阻断观察） |
| `wiki/raw/task_issue-381_design_conflict_report.md` | **前届 SA8 裁决**（clear；§8 required-action 清单 = 本轮核对输入） |
| `wiki/raw/task_issue-381_sa3_impl.md` | 被审实现报告（含 §「SA8 required action 1 自查」） |
| `docs/adr/0029`（accepted） | 规范权威：W1 三键结算（§5）、冻结解除 + S4 下沉 + 镜像清账 + 测试迁移（§8） |
| `docs/adr/0028`（accepted） | lease 恒四键/✂ 事实/三码（§7）、成本纪律（§8）、分层归属（§9） |
| `docs/adr/0027 / 0024`、协议文档、三包 AGENTS、CONTEXT.md L61–67 | 相邻冻结面与边界契约 |
| SA3 交付物 | 6 修改文件 + 1 新测试 + 5 artifacts 日志（变更路径集 = 设计 ALLOW 八项逐条对上） |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实现行为） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0029 §5 | L48：W1 成功结算从恰两键扩为 `{ok:true, value, total}`，total 键恒在；无 where = 零值域标识计数 | 两联合成功成员加必填 `total: number`；`windowCore` 成功返回 `total: candidates.length`（与 `value` 出自同一次 `collectCandidates` 枚举，L198–217 亲证）；两公共入口字面序 `{ok, value, total}`；失败成员零改动 | **implements-existing-decision** | ADR 0029 L48；`window.ts` diff 亲读（L100–105/L125/L139/L147/L217）；T1–T8 独立预言机 14/14 绿（focused 日志） | 无（已闭合） |
| 2 | ADR 0029 §5（类型分期） | L48 终态 `number \| undefined`（undefined 半域以 where 在场为前提） | P1 收窄 `total: number`，运行时恒数值；组合层零 `?? 0` 兜底（O1 前提，`window-read.ts` L176–177 亲证 `const truncated = kept < total` 直用）；类型锁 `toEqualTypeOf<number>()` 锁死 | **no-conflict** | 前届报告 §3-2 裁定（owner P1 分期 + ADR 自身预授权 P2 纯类型加宽）；`public-surface-type-guard.test-d.ts` 新增 `it` diff 亲读；T2 数值性 + T9e 失败无 total 锁 | 无（P2 where 票落地时按前届 action 2 再过门） |
| 3 | ADR 0029 §8 | L67：解除 doc-runtime 窗口原语包范围冻结，`window.ts` 原地扩 total | `window.ts` 原地修改（+31/−10）；**read.ts 冻结未被波及**：头注「复制纪律」段（L29–30）与 10 处 `copied from read.ts@36a73bb` 标记逐字保留，`read.ts` 本体零 diff | **implements-existing-decision** | ADR 0029 L67；`window.ts` diff + `grep -c` = 10 标记亲证；`git diff --stat -- read.ts` 空 | 无 |
| 4 | ADR 0029 §8 | L68：S4 候选计数下沉 W1（枚举/过滤/计数同源，消除接缝漂移） | S4 调用点与三函数（`countWindowCandidatesAtPath`/`countMapEntries`/`countingDefectFailure`）全删；`total` 自 W1 结算直通（runtime L691/L703 唯二消费点，全仓 grep 亲证）；X1 独立重跑 = 0 命中 | **implements-existing-decision** | ADR 0029 L68；本轮独立 grep（exit=1）；structural-audit.log X1；T3/T5 预言机逐位对账绿 | 无 |
| 5 | ADR 0029 §8 | L69：runtime 删 S4 与全部出处标记镜像（~270 行），收缩纯组合层 S3/S5/S6 | 镜像块 15 名目 + 2 类型别名全删（742 → 427 行，−315）；X3b 独立重跑 = 0 命中；X2：`copied from window.ts@ab6e390` = 0（≤1 上界内，从严达成）、`copied from carrier.ts` = 0；唯一保留件 `safePathCopy` 注文重述为「本地防御件……**非镜像纪律存续**」；`foldSegment` 出处标记（read-schema-projection.ts）按前届 §3-4/保留集合法保留；`WindowComposeInput` 删 `doc` 增 `total`；编排收缩 S3→S5→S6 | **implements-existing-decision** | ADR 0029 L69；`window-read.ts` 全文 427 行亲读 + hunk 逐个核对；本轮独立 grep X2/X3b；structural-audit.log（含 X3a 同名独立实现诚实注解 + `git log -S` 5db6f83 佐证） | 无 |
| 6 | ADR 0029 §8 | L70：两键 → 三键牵动 doc-runtime 窗口测试家族机械迁移 | P7 成功半 `['ok','value']` → `['ok','value','total']`（失败半两处四键断言零改动，diff 亲证）；类型锁按文件 `expectTypeOf` idiom 落锁（SA2 O-2 兑现）；contract-red B-5 仅头注措辞（零断言改动）；新 T1–T9 独立预言机契约文件 | **implements-existing-decision** | ADR 0029 L70；三测试文件 diff 亲读；pins 11/11 绿、type-guard 14 用例 `✓ TS` 绿（focused 日志） | 无 |
| 7 | ADR 0028 §7 | L63：lease 恒四键 `{ok,value,schema,truncated}`、`truncated === kept < total`、窗口事实进 ✂ 段；L64–68 三码 + `PATH_NOT_ALLOWED`、响亮不抛 | `NamespaceRuntimeWindowReadOk` 与 HEAD 逐字 IDENTICAL（diff 亲证）；S6 ✂ 装配函数（`WINDOW_TRUNCATION_HEADER`/`windowFactsBlock`/`appendWindowFacts`/`windowPathText`）函数体零改动（仅 JSDoc 注释级补注「total = W1 结算单源直通」）；registry src/test + namespace-runtime/test 零 diff；被删 `countingDefectFailure` 非 §7 失败词表成员（前届 §3-5 已裁定），三码 + 透传全保留 | **no-conflict** | ADR 0028 L63–68；`git show HEAD` 比对 IDENTICAL；DENY 15 路径零 diff 亲证；lease 33/33 + composition 17/17 零改动全绿（focused 日志） | 无 |
| 8 | ADR 0028 §8 | L71–74：只物化入选项、未入选子项零物化 | `total = candidates.length` 为枚举完成后 O(1) 读，零额外遍历/物化；T8 N=2000 毒值 + n=2 → `total=2000`、`value.length=2` 哨兵绿 | **no-conflict** | ADR 0028 L71–74；`window.ts` L217（`candidates.length` 在 M 物化段之后由既有变量携带）；T8 用例亲读 + 绿 | 无 |
| 9 | ADR 0028 §9 + ADR 0029 §7 | 载体级原语归 doc-runtime、组合归 namespace-runtime、lease 归 registry；谓词/计数是实际数据值、schema 无关 | 计数权威回归 W1（载体级）；组合层零计数零导航镜像；`total` 为 schema 无关标识计数；lease/registry 零改动 | **implements-existing-decision** | ADR 0028 L76–81、ADR 0029 §7；diff 分层归属亲证（三包各只动应动面） | 无 |
| 10 | ADR 0029 §1 + 备选 L78 | 不新增第四读方法、不改 readData、lease 恒四键与 runtime 十四键面不动；否决「结算加第五键 total」 | 零新读方法；`total` 只进 W1 原语结算（三键），不进 lease 结算（恒四键，#7 亲证）；readData 通道零触碰 | **no-conflict** | ADR 0029 L17/L78；变更路径集不含 readData/预算面任何文件 | 无 |
| 11 | ADR 0027 / ADR 0024 | ✂ 段唯一事实载体 / 预算结构盲纪律 | ✂ 文法与装配判据逐字保留（#7）；readData options / 预算轴词表零接触 | **no-conflict** | S6 函数体零改动亲证；变更集文件范围核对 | 无 |
| 12 | CONTEXT.md L61–67 | 「窗口读」：窗口事实（kept/total）进 ✂ 段（lease 面语义）；「过滤窗口」：where 缺席时 total = 标识计数、truncated = kept < total、✂ 照旧 | CONTEXT.md 零 diff；实现行为与「where 缺席」半句逐字一致（total = 标识计数即 D2 语义）；词条不描述 W1 原语层键集，无词汇漂移 | **no-conflict** | `git diff --stat -- CONTEXT.md` 空；词条亲读；P1 实现语义 = 词条「where 缺席时」分支 | 无 |
| 13 | `docs/protocols/instance-replication-v1.md` | 规范 wire 契约冻结值 | 零接触：窗口读为 lease 层进程内同步读路径，从不上 wire；变更集无网络/持久化文件 | **no-conflict** | 变更路径集核对（6+1 文件全在 packages 读路径） | 无 |
| 14 | `packages/doc-runtime/AGENTS.md` | 公共 API 只经 `src/index.ts`；守卫逐导出记账；读 schema 无关 | `src/index.ts` 零 diff（零新值导出；类型名目既有导出仅成员形状变化）；public-surface-guard 6/6 绿（P-W1/P-W2 恒两枚值导出） | **no-conflict** | `git diff --stat -- packages/doc-runtime/src/index.ts` 空；focused + full-gate 日志 | 无 |
| 15 | `packages/namespace-runtime/AGENTS.md` / `packages/namespace-registry/AGENTS.md` | 读在 sequencer 外、公共 API 只暴露 detached 投影、lease 透传 | 组合层收缩仍纯同步读、零可变态、零 sequencer；`compose*` 不进包 `src/index.ts`（零 diff，模块内部面）；lease/types 零改动透传 | **no-conflict** | `window-read.ts` 全文亲读（零 sequencer/订阅/可变态）；两 index + registry src 零 diff | 无 |
| 16 | 设计 §10 ALLOW/DENY + 前届 override 排除面 | ALLOW 八项 / DENY 逐项 | 变更路径集与 ALLOW 八项**一一对应无溢出**；DENY 全部零 diff（本轮 15 路径逐一 `git diff --stat` 亲证）；S3/S5/S6 保留集函数体零改动（唯二 diff 命中为头注注释行）；`redispatch` 声明类型维持两字段结构超类型（R-381-5 冻结，成功字段零消费 L156–161 亲证） | **no-conflict** | `git status --short` + diff 亲证；hunk 级 grep（仅 2 行注释命中保留函数名） | 无 |
| 17 | 前届 SA8 §3-17 / 设计 R-381-1 / SA2 O-3（E4 对抗边界） | 无契约覆盖的对抗类：不判负、不写断言、不引新读路径 | 未写任何 E4 对抗场景断言（T 组亲读：零 trap 插改用例）；未引入新读路径（值导出集恒两枚）；SA3 报告按 O-3 精确化登记失败→成功跃迁边界 | **no-conflict** | 新测试文件全文亲读；T9c `where:'x'` 用例为 P1 闭合词表未知键拒绝负控（非 where 实现，不预占 P2 词表）；SA3 §「对抗性 S4 移除边界」 | 无 |

## 4. Overrides

继承前届报告两项 override，本轮核对**范围逐项未扩大**：

| Old decision | Override authority | Scope | 实现核对结果（Actual） |
|---|---|---|---|
| #368 D9/B-5：W1 成功结算恰两键 + P7 两键锚 + `window.ts` 包范围冻结 | ADR 0029 §5 + §8（accepted）+ issue #381 owner P1 分期 | 仅 W1 窗口原语成功结算形状（两键 → 三键）与 `window.ts` 冻结解除 | **兑现且未扩大**：`window.ts` 原地三键化；P7/类型锁机械迁移；排除面逐项亲证——`read.ts` 零 diff（复制纪律段 + 10 标记逐字保留）、姊妹面 `readLogicalValueAtPath` 零触碰（read.ts 零 diff + `WindowReadFailure` 接口与 HEAD IDENTICAL）、值导出面零变化（index.ts 零 diff + 守卫绿） |
| #369 设计 §13 R2 存续安排：组合层出处标记镜像 + S4 自算计数 | ADR 0029 §8（R2 follow-up 正式执行） | namespace-runtime S4 计数与全部 W1 出处标记镜像（11 处标记、~262 行） | **兑现且未扩大**：S4 三函数与镜像 15 名目 + 2 类型别名全删（X1/X3b = 0，本轮独立重跑）；保留件恰为前届裁定清单（`safePathCopy` 注文重述否认镜像存续；`foldSegment` 合法出处标记保留）；独立预言机矩阵（composition S4 oracle）零 diff 保留（M4）；X2 从严达成（`copied from window.ts` = 0 < 上界 1） |

无 owner 评论级 override（刷新读回零评论）；实现方便性、测试通过、既有代码在本裁决中未充当 override。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（diff 亲证） |
|---|---|---|---|
| lease 结算恒四键 own 键集 | `{ok, value, schema, truncated}`；`truncated === kept < total` | ADR 0028 §7 L63；CONTEXT.md L62 | **保持**：`NamespaceRuntimeWindowReadOk` 与 HEAD 逐字 IDENTICAL；registry src/test + namespace-runtime/test 零 diff；lease 33/33 零改动绿 |
| ✂ 窗口事实块文法 | 头行 + 恰一行事实行 + 四插值槽 + 块间 `\n\n` + 结尾单 `\n` | ADR 0027 决策 1 窗口对偶；ADR 0028 §7 | **保持**：S6 四函数体零改动（仅 JSDoc 补注单源出处）；R3 byte 级断言零 diff 全绿 |
| 窗口失败码族与失败形状 | 三码 + `PATH_NOT_ALLOWED` 透传；own 键集恰 `{code,ok,path,message}` | ADR 0028 §7 L64–68 | **保持**：`WindowReadFailure` 接口与 HEAD IDENTICAL；`windowFailure` 零改动；T9a–T9e 五用例绿（含 `'total' in failure === false` 负控） |
| readData 四键交付与 options 闭合形状 | `{ok,value,schema,truncated}`；预算轴词表 | ADR 0027 / 0024；ADR 0029 §1 | **保持**：零接触（变更路径集不含任何 readData/预算文件） |
| `readLogicalValueAtPath` / `read.ts` | 三参签名与语义逐字不变（零 diff 红线） | #368 冻结（ADR 0029 §8 未解除） | **保持**：`git diff --stat` 空；window.ts 内 read.ts 复制纪律段与 10 处标记逐字保留 |
| doc-runtime 公共值导出集 | 窗口面恰两枚值导出 | `public-surface-guard.test.ts` P-W1/P-W2；包 AGENTS | **保持**：`src/index.ts` 零 diff；守卫 6/6 绿（focused + full-gate 日志） |
| namespace-runtime 公共类型四名目 | `NamespaceRuntimeRead{Array,Map}{Options,Result}` 形状（成功仍四键） | `namespace-runtime/src/index.ts`（零 diff） | **保持**：四名目定义与 HEAD 逐字一致；index 零 diff |
| lease / registry 类型别名与透传 | `NamespaceLeaseRead*` 别名；released 短路先于透传 | `types.ts` / `lease.ts`（ADR 0009/0028 §9） | **保持**：`packages/namespace-registry/src/**` 零 diff |
| 规范 wire 面（instance-replication-v1） | 全部帧/码/状态机冻结值 | 协议文档 | **零接触**（无网络/持久化/复制文件在变更集） |
| CONTEXT.md「窗口读」/「过滤窗口」词条 | PR #380 写定文本 | CONTEXT.md L61–67 | **保持**：零 diff；P1 实现行为与「where 缺席时」分支逐字一致 |

被解除的冻结面（唯一，同前届 Override 1）：W1 成功结算两键 + `window.ts` 包冻结——解除范围
**未扩大**（见 §4 行 1）。

## 6. Evolution requirements

**无**。实现后复查确认（skill 三问逐项）：

- 文档与代码同变更集：代码动作全部由 ADR 0029 §5/§8 **预先记载/预先指令**——实现规范而非修订规范；
  规范文本（ADR 0028/0029、CONTEXT.md、协议）零 diff 且无一处出现「文档说 A、代码做 B」；
- 语义一致：P1 `total: number` = ADR 0029 §5 无 where 半域的精确兑现（undefined 半域属 P2，
  ADR 自身预授权的纯类型加宽，无需文本修订）；
- override 未扩大、旧引用已更新：§4/§5 逐项亲证；头注/JSDoc/B-5 措辞清账（X5）与代码同步落盘。

前届 §3-18 谱系注记（「ADR 0028 §13 R2」实指 #369 设计 §13 R2）维持仅记录、无动作。

## 7. Hard conflicts

**无**。17 项对照全部落在 no-conflict / implements-existing-decision；无任何「与现有决策不兼容
且无合法 override / 正式修订路径」项。

实现期新观察（均非冲突，如实记录）：

1. **X3a 同名命中**：`projection.ts`/`plain-data.ts` 自带 `isPlainRecord`/`readableOwnDataValue` 等
   同名助手（Phase 3 #85 既有独立实现，`git log -S` 佐证；本变更集零 diff）——非 #369 镜像件，
   SA3 未伪报 0 命中、未越界修改（DENY 纪律保持）。无冲突。
2. **未使用 import 保留**（`renderProjectionText`/`resolveSchemaAtPath`）：HEAD 即未使用（本轮
   `git show HEAD` 亲证），保留以最小化 diff——实现清洁度观察，归 SA4/后续清洁票职域，无决策面牵涉。
3. **T9c `where:'x'` 负控**：P1 闭合词表下未知键响亮拒绝（`WINDOW_OPTIONS_INVALID`）——不实现
   where、不预占 P2 词表（`where` 为 string 形态在 P2 终态下同样非法）。无冲突。

## 8. Required actions

| # | 动作 | 责任/时机 | 状态 |
|---|---|---|---|
| 1 | 前届 required action 1（实现后冲突复查五项核对） | SA8 本轮 | **闭合**：(a) X5 头注/JSDoc/B-5 清账与代码同变更集——三处 diff 亲证；(b) override 范围未扩大——read.ts/carrier.ts/两 index/两测试树/registry src/docs/CONTEXT/配置 15 路径零 diff + X2 = 0；(c) P7/类型锁迁移与 ADR 0029 §5 一致（失败半四键负控零改动）；(d) lease 四键 + ✂ byte 级零 diff 全绿（lease 33/33 + composition 17/17 + 全仓 393 文件/4745 用例 exit 0）；(e) X1/X3/X4 原始输出落 `artifacts/sa3-issue381-structural-audit.log` 且本轮独立重跑一致 |
| 2 | P2（where）票义务：`total` 加宽 `number → number \| undefined` + W1/S3 两层校验同步扩 + truncated 双语义 + ✂ 永不装配（ADR 0029 §5/§6） | 后续票（非本票缺陷；设计 §12 已登记） | 维持登记；P2 设计时须再过冲突门 |
| 3 | 谱系注记（前届 §3-18） | 无动作 | 仅记录 |
| 4 | 实现清洁度观察（§7-2 未使用 import） | SA4 / 后续清洁票（非冲突门禁义务） | 仅记录 |

## 9. Verdict

**clear**

- 17 项对照：no-conflict 12 + implements-existing-decision 5（§3 行 1/3/4/5/6/9）；evolution-required 0；hard-conflict 0；
- 前届两项 override 兑现且范围逐项未扩大，排除面（read.ts / 姊妹面 / 值导出面 / lease 面）全部零 diff 亲证；
- 前届 required action 1（a）–（e）五项核对全部闭合，其中 X1/X2/X3b 经本轮独立重跑与 SA3 审计日志逐位一致；
- 冻结面十项（§5）逐项保持；E4 对抗边界维持「不判负、不写断言、不引新读路径」登记（SA2 O-3 精确化已被 SA3 落实）；
- 证据链完整：红基线（T 组 HEAD 9 failed，红因 = total 缺席）→ 绿（14/14）→ 变异敏感度（A/B/C 各击穿 + 还原复绿）→ 全仓门（typecheck exit 0；393 文件/4745 用例 exit 0，较基线 +1 文件/+15 用例，无既有用例删改）。

## 10. requiresConflictRecheck

**false**

理由（skill 判据逐项）：前届标记 `true` 的三个复查条件（公共 API 类型面尚待实现核对 / 正式
override 尚待实现核对 / lease 逐字节不变承诺尚待闭合）已由本轮实现复查逐项闭合（§4/§5/§8-1）；
本变更集内不再有「公共 API、wire、schema、持久化、状态机、生命周期、失败语义或正式 override
尚待实现核对」的悬挂项。P2（where）票是未来任务自身的门禁义务（其设计期再过门），不构成本
变更集的未闭合复查。
