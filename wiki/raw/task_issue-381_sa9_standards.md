# SA9 Standards 审查 — issue #381：[ADR 0029] P1 W1 冻结解除与 total 下沉（prefactor）

- 被审对象：最终交付 diff（工作树未提交变更，基线 HEAD `8a4fa404076afdae9d974c1ad15bd985e24d58ac` = PR #380 `adr-0029-filtered-window` 设计基线，与 dispatch 声明的刷新权威一致）
  - 6 修改文件（`+88/−374`）：`packages/doc-runtime/src/window.ts`（+20/−11）、`packages/namespace-runtime/src/window-read.ts`（+40/−355，742→427 行）、`packages/namespace-runtime/src/runtime.ts`（+6/−4）、`issue-368-window-read-design-pins.test.ts`（+2/−2）、`public-surface-type-guard.test-d.ts`（+16/−0）、`issue-368-window-read-contract-red.test.ts`（+4/−2，纯头注）
  - 1 新测试文件：`issue-381-window-total-red.test.ts`（414 行，T1–T9）
  - 证据日志：`artifacts/sa3-issue381-*.log` × 5 + `artifacts/sa7-issue381-dynamic-verify.log`
- 审查人：SA9（standards-review；dispatch `sa-4ab8d1ff-68c9-4916-b15a-71e4133903e1`，iteration 0）
- 审查方式：静态实读（diff 逐 hunk、成品文件全文、规范文本、模块 AGENTS）+ 只读 grep/diff 独立重跑结构审计与零 diff 声明；**未修改实现/设计/测试，未运行测试，未启动服务**（测试证据以 SA3/SA7 artifacts 交叉核对采信，exit code 与计数逐一亲读对上）。
- Owner comment：无（dispatch 明示刷新 REST issue comments 零评论）——无额外 owner 口径可映射。
- SA9 职域边界：只判标准符合性（AGENTS/ADR/模块责任/架构惯例/单一事实源/生命周期对称性/文件范围/测试质量）；需求完整实现判定归 SA10，本轮不越界。

## Verdict

**approve**。零 BLOCKER、零 MAJOR；四条 MINOR 观察不阻断（§8，全部承接上游既有登记，非本轮新发现）。

独立复核结论：交付 diff 是 ADR 0029 §5/§8 操作性条款的忠实兑现，全部结构声明（X1/X2/X3b、LEASE 面逐字 IDENTICAL、DENY 零 diff、行数单调下降）经本轮**独立重跑逐一成立**；证据链（HEAD 红 9/5 → 绿 14/14 → 变异 A/B/C 击穿与还原 → 全仓门 exit 0 → SA7 活链路 106/108 字节级 A/B）完整闭合。

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-381.md`（简报；AC1–AC5；Comments 空） | 已读 |
| `wiki/raw/task_issue-381_design.md`（SA1 iteration 0） | 已读 |
| `wiki/raw/task_issue-381_sa2_review.md`（approve；O-1–O-4） | 已读 |
| `wiki/raw/task_issue-381_sa3_impl.md`（实现报告） | 已读 |
| `wiki/raw/task_issue-381_sa4_review.md`（approve；O1–O3） | 已读 |
| `wiki/raw/task_issue-381_sa6_contract.md`（approve；§12 契约） | 已读 |
| `wiki/raw/task_issue-381_sa7_report.md`（approve；活链路 A/B） | 已读 |
| `wiki/raw/task_issue-381_design_conflict_report.md` / `_implementation_conflict_report.md`（SA8，均 clear；后者 `requiresConflictRecheck: false`） | 已读 |
| 规范文本（本轮亲读）：`docs/adr/0029-filtered-window-read.md` §5/§8、备选「结算加第五键 total」否决；`docs/adr/0028-window-read.md` §6–§9；根 `AGENTS.md`（窗口读词表段） | 已核对 |
| 模块契约（本轮亲读）：`packages/doc-runtime/AGENTS.md`、`packages/namespace-runtime/AGENTS.md` | 已核对 |
| 源码成品（本轮亲读）：`window.ts` 全 diff + 枚举/结算段（L160–230、L500–550）；`window-read.ts` 成品 427 行全文；`runtime.ts` diff；新测试文件 414 行全文 | 已核对 |
| 证据日志（本轮亲读关键段）：full-gate（typecheck exit=0；test 393 文件/4745 用例 exit=0、Type Errors: no errors）、t-group-head-red（9 failed/5 passed）、sensitivity-mutations（击穿 + 还原复绿）、structural-audit、sa7-dynamic-verify（V5 144/144、V6 HEAD 50/50、V7 清场） | 已核对 |

## 2. 标准逐项裁决

### 2.1 仓库 AGENTS.md

| 标准 | 裁决 | 证据 |
|---|---|---|
| 模块指导（改 `packages/` 前读最近 AGENTS.md） | 符合 | doc-runtime / namespace-runtime AGENTS 均已纳入约束面（设计 §6、SA3 Inputs、本轮亲读复核） |
| 窗口读词表纪律（lease 恒四键、三码响亮失败、`truncated === kept < total`、✂ 承载窗口事实、条目身份随行） | 符合 | `NamespaceRuntimeWindowReadOk` 与 HEAD **逐字 IDENTICAL**（本轮 `git show HEAD` 比对）；S6 ✂ 四函数体零改动（diff 亲证，仅 JSDoc 补注单源出处）；失败面三码 + `PATH_NOT_ALLOWED` 透传零改动；`{index,value}`/`{key,value}` 身份字段不变 |
| typed-access / 写侧强制纪律 | 不适用 | 纯读路径重构，零 Namespace 写、零 mutation 面触碰 |
| worktree 纪律（`.worktrees/` 仓内、临时物清场） | 符合 | `.worktrees/` 目录为空（SA7 清场 V7 + 本轮 `ls` 亲证）；无 stash/marker/探针残留 |

### 2.2 ADR 符合性

| ADR 条款 | 裁决 | 证据（本轮独立核验） |
|---|---|---|
| 0029 §5：W1 成功结算 `{ok:true, value, total}`，`total` 键恒在；无 where = 零值域标识计数 | 符合 | `window.ts` 两联合成功成员必填 `total: number`（L100–107）；`windowCore` 成功返回 `total: candidates.length`（L217）与 `value` 出自同一次 `collectCandidates` 枚举；两公共入口字面序 `{ok, value, total}`（L125/L138）。P1 收窄 `number`（非 `number\|undefined`）：undefined 半域以 where 在场为前提（ADR 0029 §5 原文），本票无 where ⟹ 恒数值；SA8 前后两届均裁定该分期无冲突（实现复查 §3-2），类型锁 `toEqualTypeOf<number>()` + T2 数值性双锁 |
| 0029 §8：解冻 `window.ts`；S4 计数下沉；删 S4 与全部出处标记镜像；收缩纯组合层（S3/S5/S6）；测试家族机械迁移 | 符合 | **独立重跑**：X1（S4 三函数名 grep `packages/namespace-runtime/src/*.ts`）= 0 命中；X3b（镜像 18 名目 grep `window-read.ts`）= 0 命中；X2：`copied from` 仅余 1 处 = `foldSegment` 的 `read-schema-projection.ts@ab6e390` 合法出处（非 W1 冻结面，设计/SA8 裁定的保留件）；`window-read.ts` 742→427 行单调下降、无「保留但注释掉」；编排收缩 S3→S5→S6（成品 L150–182 亲证） |
| 0028 §7：lease 恒四键、三码 + `PATH_NOT_ALLOWED`、响亮不抛 | 符合 | lease 成功类型与 `WindowReadFailure` 均与 HEAD IDENTICAL；registry `src/**` 与两测试树零 diff（本轮 `git diff --stat` 亲证为空）；`windowFailure`/`seamWindowOptionsInvalid` 零改动；被删 `countingDefectFailure` 非 §7 失败词表成员（SA8 §3-5 裁定），其对抗域失败→成功跃迁已按四方共识登记为非阻断边界（§8-O4） |
| 0028 §8：成本纪律（只物化入选项、未入选零物化） | 符合 | `total = candidates.length` 为既有 O(N) 枚举完成后的 O(1) 读，零额外遍历/物化（枚举器 L512–548 亲证：标识 + 排序键，零值物化）；T8 N=2000 毒值哨兵在场且变异 A（`total := entries.length`）实证击穿 |
| 0028 §9 / 0029 §7：分层归属（载体原语 doc-runtime / 组合 namespace-runtime / lease registry） | 符合 | 计数权威回归载体层（枚举/过滤/计数同源）；组合层零计数、零导航镜像；registry 零改动透传；`total` 为 schema 无关标识计数（doc-runtime「reads schema-independent」边界保持） |
| 0029 §1 + 备选：不新增第四读方法、不改 readData、否决「lease 结算加第五键 total」 | 符合 | `total` 只进 W1 原语结算（三键），不进 lease 结算（恒四键 IDENTICAL 亲证）；readData/预算面文件零接触（变更路径集核对） |
| 0027：✂ 段唯一事实载体 | 符合 | ✂ 文法函数体零改动；行注入防御（`foldSegment` 折叠）保留；SA7 活链路 ✂ 事实行 byte 级一致（`kept 2/total 3`、`kept 4/total 9`、`kept 2/total 2000` 等样本双侧逐字相同） |
| CONTEXT.md「窗口读」/「过滤窗口」词条 | 符合 | 零 diff；实现语义 = 「where 缺席时」分支逐字兑现 |

### 2.3 模块 AGENTS 边界

| 边界 | 裁决 | 证据 |
|---|---|---|
| doc-runtime：公共 API 只经 `src/index.ts`；守卫逐导出记账 | 符合 | `src/index.ts` 零 diff（零新值导出；类型名目既有导出，仅成员形状变化）；`public-surface-guard.test.ts` 零 diff 且 6/6 绿（P-W1/P-W2 恒两枚窗口值导出，full-gate 日志亲证） |
| doc-runtime：reads schema-independent | 符合 | 计数 = 载体标识枚举，零 schema 依赖 |
| namespace-runtime：读在 sequencer 外；公共 API 只暴露 detached 投影 | 符合 | 成品全文亲证：纯同步、零可变态、零缓存、零订阅、零 sequencer；`compose*` 不进包 `src/index.ts`（零 diff，模块内部面）；registry 经 restricted seam 的既有分工不变 |
| namespace-runtime：验证门（focused + root typecheck/test） | 符合 | 聚焦 8 文件 144/144 + 三包 tsc exit 0（focused 日志）；root `pnpm typecheck` exit 0、`pnpm test` 393 文件/4745 用例 exit 0（full-gate 日志亲读，与 SA6 基线 +1 文件/+15 用例逐位对账） |

### 2.4 架构惯例与相似能力一致性

| 对照 | 裁决 |
|---|---|
| 「原语单源 → 组合层零重算」协议 | 与 readData 组合直通消费原语截断事实的既有先例同款（`compose*(…, entries, total)` 直通 W1 结算）；无平行机制生长 |
| S3 canonical 接缝 / ✂ 文法 / 独立预言机纪律 | 全部复用既有协议（`canonicalReadOptions` 两出口镜像、渲染器拼装规则、反伪绿头注纪律），未新建平行通道 |
| 注释清账与代码同变更集 | 头注（`window-read.ts` 重写、`window.ts` A 装配段三键化）、`runtime.ts` JSDoc 删「S4 O(N) 计数」、contract-red B-5 措辞同步——均与代码同 diff 落盘，无「文档说 A、代码做 B」漂移 |

### 2.5 单一事实源

| 事实 | 权威源 | 裁决 |
|---|---|---|
| 窗口候选计数 | W1 `candidates.length`（与 `value` 同一次枚举） | 符合——HEAD 的双份计数空间（S4 第二次导航 + 防御位）被结构性移除；组合层 `truncated = kept < total` 直用传入值，零 `?? 0` 兜底（成品 L177 亲证） |
| 导航/载体分类机制 | doc-runtime `window.ts`/`carrier.ts` | 符合——267 行出处标记镜像整块删除（15 名目 + 2 类型别名）；`safePathCopy` 唯一保留件注文重述为「本地防御件，非镜像纪律存续」；`foldSegment` 出处非 W1 面、合法保留 |
| lease 形状与类型别名 | registry 透传 runtime 联合 | 符合——零 diff；W1 三键只存在于 runtime 内部通道 |

### 2.6 生命周期对称性

纯同步读路径：无 register/dispose、无订阅、无后台任务、无 acquire/release——**不适用且合规**（与两包 AGENTS「读在写 sequencer 外」一致）。无新增生命周期义务，无可破坏的对称性。

### 2.7 文件范围

| 检查 | 结果 |
|---|---|
| 变更路径集 vs 设计 §10 ALLOW（8 项） | 一一对应无溢出（本轮 `git status`/`git diff --numstat` 亲证） |
| DENY 15 路径 | 全部零 diff（本轮单条 `git diff --stat` 亲证输出为空）：`read.ts`（零 diff 红线 + window.ts 内复制纪律段与 10 处 `copied from read.ts@36a73bb` 标记逐字保留）、`carrier.ts`、两包 `index.ts`、`public-surface-guard.test.ts`、`read-schema-projection.ts`、`namespace-runtime/test/**`、`namespace-registry/**`（src+test）、`docs/`、`CONTEXT.md`、`vitest.config.ts`、`tsconfig.*`、`package.json` |
| contract-red 触碰面 | numstat 4/2 全为头注行（diff 亲证），零断言改动——符合 M3「注释级」约束 |
| 新文件正当性 | 新测试文件（SA6 §12.9-P3 承接）与 artifacts 日志（§12.6-P5 承接）均有契约出处；测试按既有 include 模式自动采集，零配置改动 |

### 2.8 测试质量标准

| 标准 | 裁决 | 证据 |
|---|---|---|
| 断言锚定运行时行为、独立预言机 | 符合 | T3/T5 预言机 = 原生 `length`/`keys()` + `getOwnPropertyDescriptor` 直数，零实现复用；T5 预言机先自证（防空载体恒等式伪绿） |
| 红→绿证据真实 | 符合 | T 组 HEAD 红 9 failed/5 passed（红因 = `['ok','value']` 缺 `total`，t-group-head-red.log 亲证）；实现后 14/14 绿；失败面负控（T9）HEAD 即绿不伪称红 |
| 反伪绿/敏感度 | 符合 | 变异 A（少算）5 红、B（错值）9 红、C（组合层 kept 顶替）16/50 红（与 SA6 §9-E2 逐位一致）；还原后 14/14 + 50/50 复绿（sensitivity-mutations.log 亲证） |
| 零削弱模式 | 符合 | 变更测试文件零 skip/only/todo（本轮 grep = 0）；零 env override/fallback/吞错/源码字符串断言（新文件全文亲读） |
| 回归面零语义改动（AC3） | 符合 | `namespace-runtime/test` + `namespace-registry/test` 零 diff；composition 17/17 + lease 33/33 零改动全绿（focused 日志 + SA7 V5/V6 双侧复跑） |
| 动态活链路 | 符合 | SA7：lease 面 108 样本 A/B 恰 2 处差异 = W1 直调三键化（设计变更本体），lease 公共面 106/106 逐字节一致；FilePersistence 重启 33/33；临时探针清场后复跑 144/144 不变 |

## 3. Required revisions

无 BLOCKER / MAJOR finding。

## 4. Non-blocking observations（MINOR，不阻断）

| ID | 观察 | 处置建议（不阻断） |
|---|---|---|
| O1 | `window-read.ts` L26 头注「ADR 0028 §13 R2 执行」谱系措辞不精确（ADR 0028 无 §13，实指 #369 设计 §13 R2）；该措辞回声简报 AC2 原文，SA8 §3-18 已登记为谱系注记、SA4 O2 同款结论 | 无需本票动作；后续触碰该头注时顺手修正为「#369 设计 §13 R2」 |
| O2 | `window-read.ts` L40 保留未使用 import（`renderProjectionText, resolveSchemaAtPath`）——HEAD 即未使用（SA4 `git show HEAD` 亲证），本票保留以最小化 diff，属有意取舍而非新引入 | 后续清洁票统一移除 |
| O3 | composition 测试 describe 标签仍含历史「S4」词——设计 R-381-3 明示 M4 零 diff 优先于措辞洁癖，断言全部 oracle 化、不依赖实现分期 | 无需动作 |
| O4 | 对抗类边界（SA6 §12.9/SA2 O-3/SA8 §3-17/设计 R-381-1 四方共识）：S3 canonical 重读窗内 trap 变更 doc 的场景类内，被删 `countingDefectFailure` 防御位不再可达（失败→成功跃迁）且 `truncated`/✂ 叙述修正为同源一致——既有契约零覆盖、确定性输入域逐字节不变，处置 = 不判负、不写断言、不引新读路径；实现严格遵守（新测试零 trap 插改用例，全文亲证） | 维持登记；若未来 Owner 要求对该类立约需新契约票 |

## 5. 结论

交付 diff 在仓库 AGENTS、ADR 0027/0028/0029、模块责任（计数权威回归载体层、组合层纯化、registry 透传）、单一事实源（total 单源直通、镜像清账）、生命周期对称性（纯同步读，不适用且合规）、文件范围（ALLOW 一一对应、DENY 15 路径零 diff）与测试质量（独立预言机、真实红绿、变异敏感度、零削弱）七个标准面全部符合；四条 MINOR 均为上游已登记的诚实留档，不构成阻断。**verdict = approve**；`requiresConflictRecheck = false`（SA8 实现后复查已闭合，本轮无新冲突面）。
