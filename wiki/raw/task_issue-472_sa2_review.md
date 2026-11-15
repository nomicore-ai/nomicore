# SA2 设计攻击评审 — issue #472：Cordis rc.12 三基线回归与 Nomicore `0.5.0` 收官（round 1；**iteration 2 = rev2 复查为当前结论**，iteration 1 / iteration 0 节保留可追溯）

## 0. iteration 2 复查结论（Verdict）

**approve**（BLOCKER 0 / MAJOR 0；新非阻塞观察 3 条 SA2-18…SA2-20）。**SA2-13 = CLOSED**。

rev2（562 行，本会话 `wc -l` 实测）以「一个 flag（§7.3.g 原语钉 `--no-renames`）+ 一行注入（§10 F-K）+ 五处裁定面口径注记 + SA8 rev1 增量吸收（条件 3′/9/10、PV-8a/8b、PV-6 注记）」完成最小闭合；iter-0 四条 MAJOR（SA2-1/2/3/4）与 iter-1 唯一 blocking（SA2-13）全部 CLOSED 且逐项核实无回滚/削弱。设计可进入实现；本 approve 只覆盖设计层，不替代 SA4/SA7 对实现与活链路的验证。

Reviewed subject：`wiki/raw/task_issue-472_design.md` rev2；上游输入 = 本文件 iter-1 节（reject，blocking=SA2-13）与 `task_issue-472_design_conflict_report.md`（§1–§12，250 行本轮通读）。评审方式：只读、全部结论以本会话一手证据重验（见 §0.1 证据清单）。

### 0.1 一手证据清单（iteration 2，本会话实测）

| 证据 | 命令/位置 | 结果 |
|---|---|---|
| rename 折叠复测 | `git diff --name-only 27e012b^ 27e012b` vs `--no-renames` | 默认只列 `CONTEXT.md` + `docs/adr/0032-…`（旧路径 `0031-…` 被吞）；`--no-renames --name-status` = `M CONTEXT.md` + `D 0031…` + `A 0032…`（两条路径各一行）；`diff.renames` 未设置（exit 1，builtin 默认 true） |
| pathspec 内折叠 | `git diff --name-only 27e012b^ 27e012b -- docs/adr` | 只列新路径 `0032-…`——证明无 pathspec 全树 diff 确实是唯一受折叠影响的裁定形态；pathspec 排除新路径时（`-- 'docs/adr/0031*'`）旧路径以 D 呈现 |
| 当前树状态 | `git rev-parse HEAD` / `git status --porcelain` | HEAD = `6be891a`（= PV-1 目标 BASE）；porcelain 恰 6 个 `wiki/raw/task_issue-472*.md` untracked，与设计头部自验一致 |
| 起点态验证 | `git diff --no-renames --name-only 6be891a` | 输出为空 ⊆ absent 允许集——BASE 重钉后干净树的 no-renames 判定不产生新噪声面 |
| F-K 可行性 | `git ls-files .github/workflows/ci.yml` | tracked ✓（注入对象存在）；新路径 basename `task_issue-472_renamed.md` 命中 `task_issue-472*.md` glob |
| G3 免疫边界 | `git ls-tree -r --name-only 6be891a -- packages/ws-replication/test/` | `WS_ALLOW_NEW_FILES` 4 文件（cordis-baseline-support / root-channel / root-timers / baseline-lifecycle）在 BASE 均 tracked ⇒ 非 add 候选 ⇒ pathspec 内 rename 折叠产物永不可能是 allowlist 内路径 |
| gates.mjs 实码 | L41（BASE）、L58–65（FACILITY_ALLOW）、L133–142（`changedPaths`：`diff --name-only BASE -- pathspec`）、L1116–1141（G1′/G2/G3/G4/G7 pathspec）、`gateG12()`（pathspec=FACILITY_DIR）、L1144–1153（逐 gate `[gates]` 行 + 1 行汇总） | 与设计 §7.3.g 引用的行号与语义逐项一致 |
| 条件 9 前提 | 现盘 `.cache/cordis-baselines/evidence/gates/gates.json` | `summary` 恰 12 行、首行 G2（`slice(-12)` 截断实证）；13 gate = 14 行 `[gates]` 输出口径成立 |
| run-baseline 实码 | L545–550（`<suite>.json` 无前缀）、L881/L885（gates cell digest=B3 + `slice(-12)`）、L992（root-test digest=B1） | 与设计 §7.4/§16 引用一致（SA2-1/SA2-5 锚点未漂移） |

### 0.2 dispatch 六项复查要求逐项结论

| # | 要求 | 结论 | 证据要点 |
|---|---|---|---|
| 1 | SA2-13 是否 CLOSED | **CLOSED** | §7.3.g 把原语**逐字钉为命令串** `git diff --no-renames --name-only BASE`（无 pathspec；等价 `--name-status` 口径），并附**反复用禁令**「实现不得复用带默认 rename 语义的 `changedPaths()` 变体做本款全树判定」——不是纯文字声明；「rename ≡ 旧路径删除 + 新路径新增、两条都必须落允许集」在 `--no-renames --name-only` 下机械可执行（本会话 D+A 两行复测）；「声明一套、实现可绕过另一套」的残留排查见 §1 |
| 2 | §10 F-K 是否足以证伪 | **是** | 注入两端同时成立：旧路径 `.github/workflows/ci.yml` tracked 且不在 absent/exact 允许集（允许集 = 4 设施 + 8 release + wiki glob，§4.1 PV-8a 与 §7.3.g 两处逐项核对）；新路径命中 wiki glob——正面命中「新路径绿、旧路径藏」的折叠洞。`git mv` 后两路径均在 tracked 侧可见（staged A/D），不依赖 untracked 判定。红点唯一：G1′/G2/G4/G12 pathspec 实读均不含 `.github` 与 `wiki`（G12=pathspec `FACILITY_DIR`），G3/G5–G11 亦不触（内容扫描限生产 src）⇒ 唯一红 = G13.g 指名旧路径，无误触发、证据无歧义 |
| 3 | 同款口径注记是否补齐 | **是（无裁定面遗漏）** | §7.3.a（逐文件 diff 统一带 flag +「防条款间残留默认语义」理由）、§7.3.b（逐字节 = 读 BASE blob 直比、rename 免疫；改用 diff 变体则必须带 flag）、§7.3.c 与 §6.2 验证 1（numstat 带 flag +「对修改型形状无操作、钉值逐字不变」）、§11 步骤 8（`--no-renames --name-only 6be891a..R`，与 G13.g 同口径）、§4.1 PV-4 口径注记——五处 + 注记齐备。残留默认语义的 diff 共 4 处，逐一排除（见 §1.3） |
| 4 | absent/exact 两态与允许集完备性 | **自洽** | absent 允许集「不含 8 个 release 文件」在 §4.1 PV-8a / §7.3.1 / §7.3.g 三处一致 ⇒ C1 自洽（release 面未动时 absent 过；任何 release 文件提前变动被 absent 版本检查 + absent 允许集双红）；exact 允许集 = C1 设施 4 + release 8 + `wiki/raw/task_issue-472*.md` glob 三分量齐；跨提交时序下 BASE 语义为 commit↔worktree 累积 diff——C1（已提交）+ C2（工作树/已提交）两分量都落在 exact 允许集内，中间态按 F-F/F-G 红，无误判面；当前干净树对 6be891a 的 no-renames 变更集为空（起点态实测） |
| 5 | 条件 9/10 是否落实为可验证条款 | **是** | 条件 9：命令 + 判据（内置审计 exit 0 ∧ `problems=[]` ∧ gates summary 全量 14 行）落在 §4.2-9 / §7.4 末段 / §11 步骤 2 / §16；14 行前提本会话实测成立（13 gate 行 + 1 汇总行；现盘 summary 恰 12 行、首行 G2）。条件 10：依赖禁令写入 **§11 最终验证计划专段**（「条件 10 依赖禁令」）与 **§12 风险表**（SA8 三处表述行），另 §14 DENY facility 行 / §17 第 2 条 / §0(b)；三处替换核对口径逐字在案 |
| 6 | 是否回滚/削弱已 CLOSED 项 | **无回滚** | SA2-1（§7.4 六类允许清单 + 三类 digest 期望 + logPath 三判，L259–271 在位）/ SA2-3（§7.3.f + §7.5 死条目 + PV-8b 逐字对齐，L132/L245/L286 在位）/ SA2-4（F-F/F-G/F-H/F-I/F-J、N-6b/N-7b + 覆盖声明更正段，L344–362 在位）/ SA2-13（本轮 CLOSED）逐项锚点核对；PV-1…PV-8b、交付条件 1–10（含 3′）、§12 八条停手、§14 ALLOW 13 行、D-8…D-11、mtime 威胁模型、`--evidence-dir` 禁令、C3 glob、SA2-14 措辞张力（条件 3′ 已统一）全部保持 |

## 1. SA2-13 闭合判定（CLOSED）与「声明 vs 实现」残留排查

iter-1 required change 的三个组成部分逐项核对：

| Required change | rev2 落点 | 判定 |
|---|---|---|
| §7.3.g（及 §14/§15 相应表述）把原语钉为 `git diff --name-only --no-renames BASE`（或等价 `--name-status`） | §7.3.g 原文命令串逐字在案；§14 ALLOW gates.mjs 行（「原语钉 `git diff --no-renames --name-only BASE`」）与 DENY `.github` 行（「改名挪走同样以旧路径删除计红——F-K 注入面」）、§15 SA2-13 行、§18.1（g 原语入复查核对清单）同步 | ✓ |
| §10 增 F-K 注入 + 应红点 + 对照 | §10 F-K 行：`git mv .github/workflows/ci.yml wiki/raw/task_issue-472_renamed.md` ⇒ G13.g 红并指名旧路径、G1′/G2/G4/G12 仍绿、干净 C1/C2 13/13 不回归；红灯时机（F-H…F-K 于 C1）；覆盖声明扩至 F-A…F-K 且仍以 §10 表为唯一权威口径 | ✓ |
| 请 SA8 在实现后复查/勘误中给 PV-8a 补注 `--no-renames` 口径 | 设计 §4.2 冲突取舍规则段 + §17：「SA8 将在实现后复查中给 PV-8a 补注该口径（钉值语义不变）」——已排期且落在 SA8 §11.7 既有 requiresConflictRecheck 环内，不需要新开裁决 | ✓（见 SA2-20） |

**「声明一套、实现可绕过另一套」残留排查**（全量枚举设计正文所有 `git diff` 用途，本会话 grep 逐条）：

| 用途 | 位置 | flag | 排查结论 |
|---|---|---|---|
| G13.g 全树变更集 | §7.3.g | `--no-renames` ✓ | 主裁定面，原语钉死 |
| G13.a 逐文件文本 diff | §7.3.a | `--no-renames` ✓ | 7 文件为修改型，flag 无操作但显式携带（防条款间漂移） |
| G13.c manifest numstat | §7.3.c | `--no-renames` ✓ | numstat 钉值逐字不变 |
| §6.2 验证 1 形状 | §6.2 | `--no-renames` ✓ | 与 PV-4 注记互证 |
| §11 步骤 8 形状复核 | §11 | `--no-renames` ✓ | 「与 G13.g 同口径」显式声明，双保险 |
| §15 AC4 diff | §15 | `--no-renames` ✓ | `19df983..R` / `6be891a..R` 两段均带 |
| lockfile 零 diff | §6.2 判据 3 / §11 步骤 6 / §13 | 无 flag | **非裁定面且免疫**：`--exit-code -- pnpm-lock.yaml` 为 pathspec 限定零 diff 判定——rename 出 pathspec ⇒ 配对失败 ⇒ 旧路径 D ⇒ 非空 ⇒ 红；rename 进 pathspec 不可能（pnpm-lock.yaml 在 BASE 存在，非 add 候选目标）。零 diff 语义对 rename 单调 |
| G6 空白检查 | §7.2 G6 | 无 flag | `--check` 为空白错误检查，非变更集/allowlist 裁定；改名折叠不产生「放行」语义 |
| §3 历史证据命令 | §3 表 | 无 flag | 上游事实的成文证据（SA1 已执行的复核记录），非实现指令；其绑定面（AC4/步骤 8）已由 §15 的 `--no-renames` 版本承载；且该命令本身 pathspec 限定 |
| §8 方案 B 叙述 | §8 | 无 flag | 回退方案的记录文案「`git diff 19df983..R` 零 diff」——零 diff 判定对 rename 单调（任何改名至少产出新路径一行 ⇒ 非零 ⇒ 红），无 fail-open；且方案 B 仅在 owner 否决 A 时启用 |

`changedPaths()` 复用面：设计指名 G1′/G2/G12 免疫（「pathspec 外 add 候选被滤、rename 配对失败、旧路径以 D 呈现」），本会话补充验证 **G3**（另一个 `changedPaths()` allowlist gate，设计未指名）同样免疫——其 4 个 `WS_ALLOW_NEW_FILES` 条目在 BASE=6be891a 均 tracked（`git ls-tree` 实证），非 add 候选 ⇒ pathspec 内 rename 折叠的单行产物不可能是 allowlist 内路径 ⇒ 任何折叠仍红；G4/G7/G9 为 `assertNoChange`（任何一行即红）。且 G13.g（`--no-renames` 全树）对任何折叠形态兜底红。结论：**无残留可绕过面**。

## 2. Non-blocking observations（iteration 2）

| ID | Observation |
|---|---|
| SA2-18 | §7.3.g 与头部自验记录把免疫的 pathspec gate 枚举为「G1′/G2/G12」，未点名同样调用 `changedPaths()` 的 G3；G3 实际免疫但其依据是「allowlist 4 文件在 BASE 均 tracked（非 add 候选）」而非「pathspec 外候选被滤」。建议随 G12 detail 文案更正时顺手补一句注记，避免实现后复查者重复排查；G13.g 全树兜底，非缺口。 |
| SA2-19 | §7.3.g「等价实现 `--name-status`——D/R/A 状态均按两条路径计入变更集」措辞在 `--no-renames` 下 R 记录不会出现；该等价性的准确读法是「即使实现误用默认 `--name-status`，只要 R 记录的两个路径都计入变更集即与 `--no-renames` 等价」（本会话 R098 → D+A 实证）。措辞精度问题，主原语（`--no-renames --name-only`）无歧义。 |
| SA2-20 | SA8 §11.3 PV-8a **原文**（权威追认文本）仍无 `--no-renames` 字样，其「删除/改名计入变更集 ⇒ 红」句在默认 rename detection 下对改名半句不成立（SA2-13 同判）。设计已把 flag 并入自身 PV-8a 渲染、声明钉值语义不变、并把 SA8 补注排期到实现后复查（§4.2 取舍规则段/§17）。实现后复查必须确认该补注实际落盘（否则终验若直接引用 SA8 原文会再次踩中同一失实表述）——该义务已由 SA8 §11.7 requiresConflictRecheck=true 的既有环覆盖，无需新开。 |

## 3. 结论（iteration 2）

rev2 的修订恰好落在 iter-1 预期「一个词 + §10 一行注入」的闭合面上并适度扩展为全文口径纪律：SA2-13 CLOSED（原语钉死 + 复用禁令 + 注入证伪面 + 五处裁定面口径统一 + 允许集两态显式化），SA2-1/SA2-3/SA2-4 无回滚，SA8 rev1 增量（条件 3′/9/10、PV-8a/8b、PV-6 注记）逐字吸收且判据可验证。**approve**——设计层闭合，实现与终验按 §10 表（F-A…F-K + N-5…N-9）与 §11 八步执行；F-K 应红实红 log、干净 C1/C2 13/13、条件 9 的 `problems=[]` 与全量 14 行属实现/终验执行事实，由 SA4/SA7 与实现后复查验证。

---

## 0. iteration 1 复查结论（Verdict，历史保留）

**reject**（BLOCKER 0 / MAJOR 1 = 新发现 SA2-13；iter-0 四条 MAJOR 中 **3 条 CLOSED、1 条 PARTIAL**）。

主体判定：rev1（538 行）对 iter-0 四条 MAJOR 的定向修订**实质到位**——SA2-1/SA2-3/SA2-4 逐条以一手证据核实闭合，SA2-2 的全树绑定机制在 C1/C2 两态、删除、`.cache/**` 边界上自洽，**但在其自己新增的机械条款上有一个被实测证伪的缝隙**：`git diff --name-only`（默认 rename detection）对**改名**只列新路径、隐藏被删旧路径，§7.3.g「改名同样计入变更集 ⇒ 红，覆盖 T-7」的声明与 git 实际行为不符（SA8 刚发布的 PV-8a 逐字继承了同一表述）。以本票自立的纪律（「任何应红实绿直接阻断」§12.8），该条款作为 SA2-2 的核心交付必须先钉死一个 flag（`--no-renames`）并补一条改名注入。修订面为一个词 + §10 一行注入，不动任何架构决策（PV-8a 的钉值语义「改名 ⇒ 红」不变，`--no-renames` 恰是兑现该钉值的实现），预期一轮微修订即可 approve。

## 1. Reviewed inputs（iteration 1）

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-472_design.md`（rev1，538 行，`wc -l` 实测） | 被审对象（iteration 1 定向修订） |
| `wiki/raw/task_issue-472_sa2_review.md`（本文件 iter-0 节，verdict=reject，SA2-1…SA2-12） | 修订依据与闭合判据来源 |
| `wiki/raw/task_issue-472_design_conflict_report.md`（**本会话 07:11:34 追加 §11/§12 后 250 行**：rev1 复查 verdict=clear、PV-8a/PV-8b 正式发布、交付条件增补 3′/9/10、勘误 E-1/E-2/E-3） | 追认面与钉值权威源 |
| `wiki/raw/task_issue-472_sa6_acceptance_contract.md`（§12.0.1/§12.0.2/A1-6/D1–D15 锚点本轮 spot check） | 上游契约 |
| `docs/adr/0035-cordis-rc12-root-compatibility.md` + 16 manifest ranges（`^4.0.1`/`^1.1.3` 本轮实读） | 规范面 |
| 一手核验源 | `run-baseline.mjs`（L215/L447/L545–550/L552–559/L840–868/L871–887/L900–1014/L1081–1150 逐段实读）、`gates.mjs`（L41/L58–65/L125–163/L988–1003/L1109–1144 实读）、`.cache/cordis-baselines/evidence/{B1,B2,B3,gates,root-test,matrix}` 全量 ls + cell JSON 字段 node 实读（B1=96/B2=98/B3=102 文件）、4 个 `fault-*/` 目录内容逐个 ls、`git diff --name-only` rename 行为实证（`27e012b` 历史改名 + `--no-renames` 对照 + `git diff --help` diff.renames 默认值）、`.gitignore` L4/L18、当前 porcelain（恰 6 个 `wiki/raw/task_issue-472*.md` untracked）、`matrix.json`（41 cells，keys={generatedAt,cells}） |

评审方式：只读、全部结论以本会话一手证据重验。SA8 报告在本会话中途（07:11:34）被追加 §11/§12：本轮已按**追加后**的 250 行版本核对（iter-0 时点只有 §1–§10/158 行，dispatch 所述「PV-1…PV-7 与 8 条交付条件」对应旧貌；PV-8a/8b 现已由 SA8 §11.3 正式发布，与本评审的追认授权核对一致）。

## 2. iter-0 MAJOR 逐条闭合判定

| Finding | 判定 | 证据与理由 |
|---|---|---|
| **SA2-1**（审计允许集与实盘布局不符） | **CLOSED** | ① 六类允许清单与实盘**逐文件对账通过**：B1 96 文件 = 13 个 cell JSON（`{typecheck,provenance,root-probe,contract,real-timer,dsh-profile,unload,ws-package,guard-proxy,ws-cordis-channel,ws-cordis-timers,replication-lifecycle,composition-root}.json` 与 §7.4 检查 7① 名单逐一相符）+ `B1-typecheck.json`（类②）+ `B1-*.log`（类③，含 `B1-root-probe.mjs.log` 与 15 个 `B1-typecheck-<project>.log`）+ `B1-*.vitest.json`（类④）；B2=98/B3=102 增量恰为 `fault-*.json`（类⑤）与 `fault-*/` 目录（类⑥），4 个 fault 目录（fallback/legacy-shim/substitute-npm/substitute-rc12）内容**全部**只有 `*.log`/`*.vitest.json`，无嵌套。`gates/`={gates.json,gates.log}、`root-test/`={root-test.json,root-test.log,root-test.vitest.json}、`matrix/`={matrix.json}、顶层恰 6 目录（`tmp/` 允许、`run-marker.json` 新增）均与 §7.4 允许集一致。② 三类 digest 期望与实盘吻合：`run-baseline.mjs` L881 `provenanceDigestFor('B3')`（gates cell，实盘 gates.json digest `112f0db0…` === B3 digest ✓）、L992 `provenanceDigestFor('B1')`（root-test cell，实盘 `377092f3…` === B1 digest ✓）、L558/L861 baseline cell 按 `cell.baseline`；两特例 cell `baseline='default'` 的归位校验已定义。③ `<suite>.json` 无基线前缀（L545–550 实读）、`<B>-typecheck.json` 聚合件（L854–855 实读）、`tmp/` 为 runVitest 默认兜底（L447 实读）均与 §7.4 承接行一致。④ 假红消除路径成立：干净矩阵重跑内置审计 exit 0 已钉为验收（§7.4 末段/§11 步骤 2/§15，SA8 条件 9 同判）；假绿面：任何越类形状红 + 必需集 digest/名集/状态/mtime 钉死，扩类回 SA8（票级钉值）纪律保留 |
| **SA2-2**（release diff 缺机械全树绑定） | **PARTIAL** | 闭合部分：① `git diff --name-only BASE` = commit↔工作树 diff（含 BASE 之后已提交历史，非仅工作树）——与仓内既有原语 `changedPaths()`（gates.mjs L134–142，G12/G1′/G2 同款语义）一致，因此 **C1 态**（4 设施文件为工作树或已提交变更）与 **C2 态**（设施文件已在 BASE 后历史 + release 文件在工作树/已提交）的 tracked 变更集都 ⊆ 允许集，两态自洽 ✓；② 删除计入变更集 ⇒ 红（T-7 成立）✓；③ untracked（porcelain）⊆ `wiki/**` 在现盘可达（恰 6 个 `task_issue-472*.md`），`.cache/`（.gitignore L18）与 `.worktrees/`（L4）gitignored 无噪声 ✓；④ F-H/F-I 注入可证伪（越界注释 → G13.g 指名红，G1′/G2/G4 同时绿，红点唯一）✓；⑤ §14/§15/§16 执法面归因已按实码更正，SA8 勘误 E-2 同步 ✓。**未闭合部分：改名（rename）在默认 rename detection 下被隐藏**——见 §3 新发现 SA2-13。§7.3.g「改名同样计入变更集 ⇒ 红，覆盖 T-7」半句失实 |
| **SA2-3**（baselines.json 未钉死） | **CLOSED** | ① G13.f 两态均要求与 BASE 逐字节相同（absent 态 §7.3.1 明列三冻结件含 baselines.json）✓；② 「G12 白名单内 + G13 逐字节钉死」无语义缝隙：G12 与 G13 恒同进程同跑（gates.mjs 单一 `main()`，L1140–L1144 全部 13 gate 一次执行；gates cell 整体执行 gates.mjs；无任何只跑 G12 不跑 G13 的路径）⇒ G12 名义放行永不单独生效，实际不可变更 ✓；③ `FACILITY_ALLOW` 保持 5 文件是**唯一与 PV-6 已钉组成相容**的选项（移除反而改已追认闭集组成），D-9 理由成立且 SA8 §11.2 已追认 ✓；④ 归因更正闭环：设计 §7.3.f/§7.5/§14 + G12 detail 文案更新要求 + SA8 勘误 E-1/条件 10（「终验不得以 G12 零 diff 作为执行依据」）三方一致 ✓；⑤ F-J 单字节注入应红点唯一（G13.f 红、G12 名义 PASS、log 指名 baselines.json），干净 C1/C2 13/13 绿为对照 ✓ |
| **SA2-4**（新分支缺证伪） | **CLOSED** | §10 七行新增注入逐一核对：F-F（部分 bump 3/7 + 再生 manifest：absent 红=3 文件 version≠BASE、exact 红=4 个 pinned≠to，G1′ 绿 ⇒ 红点唯一 G13）✓；F-G（C2 后回退 persistence：absent 红=6 文件异于 BASE ∧ manifest 异于 BASE，exact 红=version≠to ∧ filename 交叉检查；G6 绿——artifacts 已提交未动 ⇒ 红点唯一，**absent 分支首次红灯实证**）✓；F-H/F-I（src / scripts+.github 越界注释 → G13.g 指名红，G1′/G2/G4 绿）✓；F-J（G13.f）✓；N-6b 明确覆盖检查 6 的 (a) 不存在与 (b) `../../escape.log` 越界两分支 ✓；N-7b（`zz-old.json` 不属六类 ⇒ 检查 7 红）✓；红灯捕获时机更新（F-G 在 C2 形成后，N 系在 `--audit-evidence` 完成时）✓。「SA8 §3-S1 过度声明」的口径更正到位：设计 §10 专段声明以本表为唯一权威口径 + §0(b)/§17/§18 禁止终验引用，SA8 勘误 E-3 + 条件 10 已同步落实 ✓ |

## 3. Required revisions（iteration 1）

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
|---|---|---|---|---|---|
| **SA2-13**（新发现；SA2-2 的残余缺口） | MAJOR | 本会话实证：以仓内历史改名提交 `27e012b`（`R098 docs/adr/0031-…md → docs/adr/0032-…md`）测试——`git diff --name-only 27e012b^ 27e012b` **只列新路径**（旧路径 0031 被默认 rename detection 吞掉），`--no-renames` 下两路径均列；`diff.renames` 未设置（builtin 默认 true，`git diff --help` 确认）。既有 pathspec 限定的 gate 不受此影响（pathspec 外的 add 候选被滤掉 ⇒ rename 配对失败 ⇒ 旧路径以 D 呈现，已实测），**唯独 §7.3.g 的全仓（无 pathspec）diff 受影响** | §7.3.g（与 SA8 刚发布的 PV-8a 同文）声称「删除/**改名**同样计入变更集 ⇒ 红，覆盖 T-7」——改名半句与 git 实际行为不符：把一个无 gate 覆盖、无字节钉死的 tracked 文件**改名进允许集**（如 `git mv .github/workflows/ci.yml wiki/raw/task_issue-472_ci.md`，或任何不被 import 的测试文件/11 包 src 文件改入 wiki glob），`--name-only` 只显示 glob 内新路径 ⇒ G13.g 绿、被删旧路径不可见、13 gate 全绿。ci.yml 被移走后无任何其他 gate/步骤强制发现（F-I 只注入注释；G6/G1′/G2/G4 均不看 .github）。SA2-2 建立的机械执法面在本应覆盖的「改名」类上 fail-open，且 §10 无改名注入 ⇒ 该洞不会被负控暴露 | §7.3.g（及 §14/§15 相应表述）把 tracked 判定原语钉为 **`git diff --name-only --no-renames BASE`**（或等价的 `--name-status --no-renames`，D/R/A 均按两条路径计入变更集）；§10 增一行 **F-K**：在实现树一次性副本上 `git mv .github/workflows/ci.yml wiki/raw/task_issue-472_renamed.md`（或同类 src→wiki 改名）⇒ gates exit 1 且**指名被删旧路径**，G1′/G2/G4/G12 同时仍绿；同时请 SA8 在实现后复查/勘误中给 PV-8a 补注 `--no-renames` 口径（钉值语义「改名 ⇒ 红」不变，本条只是兑现该钉值的机械配方，不构成新决策面） | F-K 注入留下「应红实红 + 指名旧路径」log（`.cache/issue-472-impl/`）；干净 C1/C2 树 13/13 绿不回归；`--no-renames` 下现盘六个 wiki untracked / 两态允许集判定不变（本会话已核对 `--no-renames` 只多列改名旧路径，不影响 add/delete 计数语义） |

## 4. 回滚/削弱复查（dispatch 项 5）

| iter-0 已核实成立项 | rev1 状态 |
|---|---|
| 版本闭包与矩阵（7 包 from→to、41 cells、registry 现值） | **未回滚**：§6.1 矩阵与 PV-3 逐字一致；§7.3 末 41-cell/13-gate 表述保持 |
| BASE 重钉 / G1′+G3 allowlist / G13 两态（iter-0 判「主体成立」的部分） | **未回滚**且被强化（f/g 款） |
| C1→C2→C3 提交时序与 G6/G13 红点归因 | **未回滚**：§9 末段按 iter-0 §6 的精确化口径书写（中间态 G6 绿 ∧ G13 红；再生后 G6 红） |
| D1–D15 → §11 步骤映射、AC 证据只认 exact 态树 | **未回滚**：§11 归属表原样保持 |
| 方案 A 三 entry 可捕获性（exports/ls-tree/farm 论证） | **未回滚**：§8 落点保持，仅增 describe 文案修正（SA2-9） |
| 停手条件 8 条 + 负控纪律（`--passWithNoTests=false`、外层 exit 0 ⇔ 内层 observed=fail、审计无重定向参数） | **未回滚**：§12 八条齐备；§7.4 末「不提供 `--evidence-dir`」保持 |
| C1 文件集由条件 1 的「三文件」扩为 4 文件（+run-baseline.mjs） | **非削弱**：SA8 §11.2 已澄清条件 1 是三元组一致性约束而非排他枚举；run-baseline.mjs 属 #471 已批准 FACILITY_ALLOW 面 |
| ALLOW/DENY 面 | §14 ALLOW 13 行（4 设施 + 8 release + wiki glob）与 §6.1/§7/§8/§9 逐行对账一致；DENY 归因已按实码改写（不再声称 G2/G4/G13 旧口径） |

## 5. PV 与交付条件吸收核对（dispatch 项 6）

- **PV-1…PV-7**：与 SA8 §8.1 原文程序化比对——语义逐字一致；仅有的差异为行尾句号、PV-6 省略「SA6 A1-6『12/12 或扩展后的等价 gate 数』」引文缩写与「本追认明示项」→「追认明示项」，无语义变化（SA6 原文 L416 本轮实读确认 A1-6 口径）。**PV-4 numstat 7 增 + 7 删**（§4.1/§6.2/§7.3.c 三处一致）、**PV-6 13 gate/41 cells/G12 5 文件/G5 7 entry** 逐项吻合。
- **条件 1–8**：逐条核对一致；**条件 4 两分文案**在 §4.2-4 与 §8 两处逐字（含禁令句），iter-0 SA2-8 的风险（把修正写成「#471 未发生公共面扩展」）已消除。
- **PV-8a/PV-8b**：属本评审 iter-0 §15.1 预授权的「并入 PV 清单后由 SA8 发布」两钉，SA8 §11.2/§11.3 已按程序发布并裁定「在追认面内、无需 owner 升级」——**不是新的票级决策**，追认链完整。
- SA8 报告 07:11 追加的 §11（rev1 复查 clear）与 §12 勘误（E-1/E-2/E-3）+ 条件 3′/9/10 与 rev1 设计内容互相印证，无未被吸收的新义务（条件 9 = §7.4 相容判据 + D-10 全量 summary，rev1 已内建；条件 10 = §0(b)/§17/§18 已有表述）。

## 6. MINOR 处置核对（dispatch 项 7）

SA2-5/6/7/8/9/10/11 采纳（修订位置逐条落实，本轮抽查 §5 D-8…D-11、§7.1 四处 base 串分工、§7.2 口径、§3 表头、§9 C3、§14/§16 均在）；SA2-12 部分采纳（威胁模型 §7.4 末段成文；龄窗口拒绝理由具体：长矩阵假红风险 + 小步回拨无实质增益 + 对抗面已由 head 绑定/write-tree 比对/终验独立重跑承担，升级路径「随新票裁决」成文）——与 iter-0 的「可选加固」定位一致，**可接受**。八条 MINOR 中无一条属于「必须在实现前闭合」而未闭合者。

## 7. Non-blocking observations（iteration 1）

| ID | Observation |
|---|---|
| SA2-14 | §4.2-3 括注「F-A…F-J 在 C1 完成时」与 §10 末段「F-G 在 C2 形成后」存在措辞级张力（F-G 的 absent 分支需 exact 起点树）；SA8 条件 3′ 已按 §10 口径重述，实现以 §10 为准即可，无需改设计文本结构，建议随 SA2-13 修订顺手统一。 |
| SA2-15 | 设计 §17 称三处更正「由 SA8 在实现后复查时处理」——SA8 已于本轮（07:11）以 §12 勘误形式提前生效并加条件 10；设计文本无害地滞后于报告现状，实现记录按 SA8 现行版执行（更正已生效，无需再等）。 |
| SA2-16 | SA8 勘误 E-3 自认的残余：`scripts/package-catalog.mjs` 的 G13.e 逐字节红分支无直接注入（F-I 只证 `scripts/**` 面由 G13.g 红）——同意非阻塞（g 款机械子sume + 步骤 8 手工字节核对），但实现后复查不得宣称「catalog 漂移分支已注入证伪」（SA8 原文同判）。 |
| SA2-17 | PV-6 的 A1-6 引文缩写与 PV-1…PV-7 的行尾句号差异属誊写层面，若 SA2-13 修订再版可顺手对齐，不构成义务。 |

## 8. 结论（iteration 1）

rev1 的修订质量高：四条 MAJOR 中三条完全闭合、一条 90% 闭合，八条 MINOR 处置全部合理，无任何已核实项被回滚或削弱，PV/条件吸收精确，追认链（含 SA8 本轮追加的 PV-8a/8b 发布与勘误）完整自洽。唯一阻断项 **SA2-13** 是新机械条款自身的「声明 vs 原语」失配——`--no-renames` 一个 flag + F-K 一行注入即可闭合，不动架构、不动钉值语义、无需重开任何裁决。修订后直接进入实现。

---

# 以下为 iteration 0 原文（保留可追溯；其 verdict=reject 由 4 条 MAJOR 触发，处置状态以上文 iteration 1 节为准）

# SA2 设计攻击评审 — issue #472：Cordis rc.12 三基线回归与 Nomicore `0.5.0` 收官（round 1，iteration 0）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-472_design.md`（SA1 iter 0，442 行） | 被审对象 |
| `wiki/raw/task_issue-472_sa6_acceptance_contract.md`（817 行，verdict=approve） | 上游契约（§12 / §17 / §18.2–18.3） |
| `docs/adr/0035-cordis-rc12-root-compatibility.md`（118 行） | 规范面 |
| `wiki/raw/task_issue-472.md`（Issue brief，`## Comments` 空） | 需求面 |
| `wiki/raw/task_issue-472_design_conflict_report.md`（06:44 落盘，SA8 设计后冲突复查，verdict=clear，S1/S3 ratified-with-conditions + PV-1…PV-7） | 评审中途出现的追加输入；本评审已吸收其钉值并逐条核对其中与设计/事实不符的归因（见 SA2-3、SA2-8、SA2-11、§13） |
| 一手核验源 | `packages/persistence/test/fixtures/cordis-baselines/{gates.mjs,run-baseline.mjs,baselines.json,root-test-known-red.json,public-surface.base.json}`、`scripts/{create-publish-manifest,build-local-packages,verify-package-tarballs,pack-package}.mjs`、`scripts/package-catalog.mjs`、15 个 `package.json`、`pnpm-lock.yaml`、`vitest.config.ts`、`.github/workflows/ci.yml`、`INSTALL.md` L162–219、`.gitignore`、`.cache/cordis-baselines/evidence/**`（41-cell 实盘布局）、`.cache/sa6-472/**`（probe log 实盘）、npm registry（15 包 versions/dist-tags 逐个实查） |

评审方式：只读；所有关键断言以本会话一手证据重验（git diff/ls-tree/show、逐 manifest 读、registry 查询、盘上证据布局），不以设计或 SA6/SA8 报告自述为依据。

## 2. Verdict

**reject**（BLOCKER 0 / MAJOR 4 / MINOR 见 §14）。

设计的主体结构成立：7 包闭包与版本矩阵经我独立重算与 registry 实查**精确无误**；BASE 重钉推导、G13 两态思路、C1→C2→C3 时序、S4 台账冻结、D1–D15 映射均自洽且与 SA6 契约一致。4 条 MAJOR 全部是「机械 fail-closed 面的最后一段没钉死 / 验收负控缺口」，修订成本低（每条都有精确闭合判据），但按本票自身立下的纪律（「任何应红实绿直接阻断」「fail-closed 无 fallback」）必须在实现前修订。

## 3. 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| Issue L21（AC1）三基线全仓 typecheck + 完整运行时矩阵 | §7、§11、§15、§16 | 覆盖；41-cell 结构与 gates cell 13 gate 的相容性成立（`matrix.json` 实盘 41 cells 复核） |
| Issue L22（AC2）独立解析路径/Root 通道/回退阻断 | §7.4、§10、§11 步骤 3–4、§15 | 覆盖（fault ×4 + N-5 + 审计负控）；审计检查 6/7 缺红灯注入（SA2-4） |
| Issue L23（AC3）真实打包产物门禁 | §6.2、§11 步骤 5、§13、§15 | 覆盖；`verify-package-tarballs.mjs` 的 filename↔version/多余键检查实读确认（缺键→filename undefined→红；多余键→unexpected 红） |
| Issue L24（AC4）0.5.0 版本与变更记录 + 公共契约冻结 | §6.1、§8、§9.2、§15 | 覆盖；版本矩阵与 registry 实查一致（见 §5）；公共契约「冻结」的机械执行面有缺口（SA2-2） |
| Issue L25（AC5）依赖范围/归属不变 | §6.1、§12.1、§14、§15 | 覆盖；16 manifest 现值 `^4.0.1`/`^1.1.3` 本会话复核 |
| Issue L26（AC6）回填 + 不改 #468 Parent | §9.3、§15、§16 | 覆盖 |
| Issue L27（AC7）排除真实部署/patch 移除 | §1、§9.2、§12、§15 | 覆盖；INSTALL L199–205 复核（真实 publish 需 main+clean+whoami），D-7 不越权成立 |
| Issue L28（AC8）#464–#466 保持撤回 | §9.2、§12、§15 | 覆盖 |

## 4. Owner评论覆盖

Issue #472 无任何评论（brief `## Comments` 空；SA6 与 SA8 冲突报告两轮独立 `gh api .../comments --paginate → []`）。无 owner 追加要求、无豁免。SA8 §3-S2 裁定 S2 无需 owner 事前确认、仅保留升级触发器——与设计 §0/§12.4 一致，本评审无异议。

## 5. 上游事实与SA8约束（独立重验）

| Fact or constraint | Design response | Assessment |
|---|---|---|
| 7 包闭包 = {persistence, dsh-persistence, namespace-runtime, namespace-registry, namespace-api, ws-replication, yjs-server} | §3 表 + §6.1 矩阵 | **成立**（本会话逐 manifest 重算：正向闭包恰 7 包；反向核查 8 个非闭包包 workspace 依赖与闭包交集为空——doc-runtime/vfsl-codegen/namespace-diagnostic-log 仅依赖 vfsl 线）。注：§3 表头「workspace 依赖」列只列闭包相关子集（dsh-persistence 实际还有 clock；namespace-api 还有 vfsl；yjs-server 9 项列 4 项），结论对但表头易误读（SA2-11） |
| `create-publish-manifest.mjs` 把 `workspace:{*,^,~}` 重写为依赖方当前精确版本（dependencies/optionalDependencies/peerDependencies；本仓无 peer/optional workspace 项） | §6.1/§13 | **成立**（L10–L40 实读；devDependencies 不重写也不参与 packed 语义） |
| 版本目标与 registry 一致：15 包 latest = 现值；persistence 0.5.0 / dsh 0.5.0 / runtime 0.5.0 / registry 0.5.0 / api 0.4.0 / ws 0.6.0 / yjs 0.6.0 **均未发布** | §6.1「当前（=registry 已发布）」 | **成立**（npm registry 15 包 versions+dist-tags 本会话逐个实查；无漏 bump/多 bump） |
| `19df983` 先例 = 闭包联动 minor、每 package.json 恰 1 行、manifest 每键 2 行、chore(release) 正文 | §6.1/§9.2 | **成立**（`git show 19df983 --stat/--name-only` 实读：9 包 + manifest + generated.ts；generated.ts 因 vfsl-codegen bump 而刷新——本票 codegen 不在闭包，`generate --check` 零 diff 推导一致） |
| 生产面自 `19df983` 仅两 seam 文件 | §3 | **成立**（`git diff 19df983..HEAD --name-only -- 'packages/*/src/**' 'apps/*/src/**' 'domains/**' 'docs/protocols/**'` = service.ts + plugin.ts） |
| HEAD gates 12/12、矩阵 41 cells、probe G1′/G3/G6 红、publish:verify 2 mismatch | §3/§7 | **成立**（`evidence/gates/gates.json`、`matrix.json`（41 cells，generatedAt=2026-11-14T22:24:17.171Z）、`.cache/sa6-472/gates-release-probe.log`（3/12 failed + node_modules symlink 噪声在 log 尾部可见）、`publish-verify-head.log`（EXIT=1）全部实盘复核） |
| `baselines.json` 的 `base` 字段无代码读方 | §7.1 | **成立**（grep 全设施目录：仅 `MANIFEST.baselines`/`MANIFEST.suites` 被消费；`.base` 无读方）——保留 `d59a4d1` 作出处记录可行，但注意 `root-test-known-red.json` 的 `capturedAt` 与 surface test 描述文本里的旧 base 串（SA2-9） |
| lockfile `link:` importer、版本不参与解析 | §6.2.3 | **成立**（pnpm-lock importers 实读：`'@nomicore/clock': specifier workspace:* / version link:../clock`） |
| CI L172 降级 verify | §3 | **成立**（ci.yml 实读 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0 pnpm publish:verify`） |
| `artifacts/local-packages/*.tgz` gitignored | §14 | **成立**（.gitignore 实读；pack 后 tracked 变化只剩 manifest.json，G6 语义成立） |
| 方案 A 三 entry 可在 BASE 捕获 | §8 | **成立**（`exports['./testing']→./src/testing.ts` 实读；`git ls-tree 6be891a` 确认 clock/namespace-registry index.ts、ws testing.ts 均在 BASE；farm 机制 links 全部 workspace 依赖、外部依赖回 main repo node_modules realpath，tsx+`nomicore-source` 既有路径不变；实现期仍有解析失败风险，设计已按停手+方案 B 处理，SA8 条件 5 追认） |
| SA6 §17 D1–D15 → §11 步骤 2/3/4/5/6/7 | §11 归属表 | **完备**（D1–D9 步骤 2；D10/D11 步骤 5；D12 步骤 3；D13 步骤 2+4；D14 root-test cell；D15 步骤 6/7；无遗漏） |

## 6. 设计内部一致性

- §0/§5/§7/§9/§14 相互一致：8 文件 allowlist（7 package.json + manifest）四处表述一致；C1/C2 文件分组与 §14 ALLOW 前 12 行一致；方案 A/B 文件范围互斥表述一致。
- gate 数 12→13 与 41-cell：gates 仍是 1 cell，矩阵结构不变 ✓（A1-6「或扩展后的等价 gate 数」满足）。
- **G6 时序精确化**（回应 dispatch 项 7）：「C2 前 G6 必红」不成立——仅编辑 7 个 version 行、未再生 manifest 时，`git status --porcelain -- artifacts/` 为空且无空白错误，G6 绿；此时树由 **G13** 判红（manifest 交叉检查失败 + absent 态不满足）。再生 manifest 后未提交时 G6 红（F-D 正确捕获）。组合效果「两步之间无合法半 release 态」成立，但红点归因是 G13+G6 而非 G6 单独——设计 §0 D-6 的表述（"旧 gates…G1′/G3/G6"）是对旧 gate 的描述，无错误；实现记录时按此归因即可。
- §16 调用方矩阵逐行核实：`run-baseline.mjs` L871–L887（runGatesCell）、L1081–L1108（matrix 主流程）、`gates.mjs` L58–L65/L988–L1003（FACILITY_ALLOW/G12）、ci.yml L165–L180、pnpm-lock L282–L296 均与实码吻合。唯一失准：gates cell summary 是 `slice(-12)`（run-baseline.mjs L885），13 gate 时会静默丢弃前两行 [gates] 输出（见 SA2-5）。
- 设计先于 SA8 冲突报告成文：§7.3c「恰 7 行增删」需按 SA8 PV-4 钉为 numstat 7删+7增；§8 记录修正文案需按 SA8 条件 4 两分（#471 以 3 条 runtime 断言等价承载 7/7 覆盖）——设计必须回写吸收（SA2-8），否则实现者按设计旧文案写 release 正文会违反 A4-5。

## 7. 状态机与并发攻击（G13 两态 × 提交时序 × 证据生命周期）

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| T-1 | absent（C1 已提交） | 只 bump 7 之 k（如 3 包）并再生 manifest | 两态皆不满足 ⇒ gates 红；G1′ 仍绿（全部变更 ⊆ 8 文件白名单） | 判定逻辑在 §7.3.3 已列（「部分 bump…红」），但 F-A…F-E 无此注入，未证伪 | SA2-4（F-F 注入） |
| T-2 | exact（C2 已提交） | 回退其中一个 version 文件为 from 值（manifest 未再生） | absent 失败（6 文件异于 BASE）∧ exact 失败 ⇒ 红 | 无注入 | SA2-4（F-G 注入） |
| T-3 | exact 形状、未提交 | 7 行 bump + manifest 已再生 | G6 红（artifacts dirty）；G13 exact 内容判定本身可过 | 设计 F-D 已捕获 ✓ | 无 |
| T-4 | 矩阵运行中 | 中途修改工作树（tree 漂移） | marker 记录 head/tree/porcelain，但**无检查消费 tree**；matrix.json 增 runHead/runTree 亦无比对 | 披露不校验 | SA2-7 |
| T-5 | 上一轮证据在盘 | 换入旧 cell / 旧 matrix | mtime ≥ marker、名集、digest、（standalone）head 比对 ⇒ 红 | N-6…N-8d 覆盖 ✓；检查 6（logPath 断链）与检查 7（换名旧工件）无注入 | SA2-4 |
| T-6 | 任意 | marker 本身被回拨（mtime/startedAt 早于陈旧证据） | 检查 4 反向放行 | 未设防、未声明威胁模型 | SA2-12（声明为防意外过期/混用，非对抗伪造；或加 marker 龄窗口） |
| T-7 | G1′ 白名单内文件 | 删除 `packages/clock/package.json` 或 `manifest.json` | 删除计入 changed ⇒ G1′ 红 ✓（assertAllowlist 对删除路径同样判 unexpected） | 无 | 无 |
| T-8 | G13 exact.a | 重排键序 / CRLF / 行尾空白 / version 行移位 | 深度相等 ∧ 文本 diff 恰 1删1增 ∧ 增删行逐字匹配 `  "version": "X.Y.Z",` 三重钉 ⇒ 全部红 ✓（重排/换行风格 → 行数≠1；空白 → 逐字匹配失败） | 无（PV-3/PV-4 口径下穷尽） | 无 |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E-1 | 干净矩阵跑完，审计对合法布局误判红（`<B>-typecheck.json` 聚合件、`fault-*/` 目录不在检查 7 允许类） | 检查 7 按设计字面集判红 | **实现即卡的假阳性**；或实现者被迫放宽成「runner 写过的都算」⇒ 检查 7 空转 | SA2-1 |
| E-2 | G5 重捕失败（farm/tsx 解析） | 响亮 exit + 停手 + 方案 B 重议（§12 风险表；SA8 条件 5 追认为等效停手） | 无静默降级 ✓ | 无 |
| E-3 | pack:local 中途失败 | build 脚本先 `rm -rf` outDir 再重建，manifest 确定性可再生 | 幂等 ✓ | 无 |
| E-4 | ws-replication `node_modules` symlink 噪声 | 不开白名单，按 unexpected 红并如实上报环境问题 | 诚实 ✓（probe log 实证该噪声形态） | 无 |
| E-5 | `.worktrees/base-snapshot` 残留 | gates exit 2 前置检查（既有行为） | ✓ | 无 |
| E-6 | pnpm shim 拒绝 workspace | 全流程固定 10.28.2 + 记录 `pnpm --version` | ✓ | 无 |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| gates cell JSON 的 `summary` 字段消费方（SA10/final verification 读 gates.json） | `slice(-12)` 在 13 gate（14 行 [gates] 输出）下丢 G1′/G2 两行；设计 §16 称「自动继承 13 gate 输出」失准 | run-baseline.mjs L885；现盘 gates.json summary 恰 12 行（已缺 G1′） | SA2-5 |
| `auditEvidence()` 的 per-cell digest 期望 | gates cell `provenanceDigest = provenanceDigestFor('B3')`、root-test cell = `provenanceDigestFor('B1')`、baseline 字段为 `default`——设计检查 3 写「每 cell 的 digest === provenanceDigestFor(<B>)」未定义这两类特例 | run-baseline.mjs L881、L992 | 并入 SA2-1 |
| `verify-package-tarballs.mjs`（只读者） | 输入变化（7 新版本）零代码改动 ✓；manifest 缺键/多余键由其内建检查兜底（filename undefined→红；多余键→unexpected 红） | scripts/verify-package-tarballs.mjs L19–L21、L66–L68 | 无 |
| vitest alias / surface test 调用方（G5 runtime + root-test/CI 共用） | 5→8 个 it、计数 +3、名集不变；ENRIES 与 SNAPSHOT 键集断言双向锁定（缺键/多键均红） | cordis-public-surface.test.ts L33–L41；vitest.config.ts alias 实读 | 无（SA2-9 文案项） |

## 10. 架构一致性与惯例审查

### 责任归属
| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| release 批次形状审计 | gates.mjs（机械 gate Owner） | G13（两态） | ✓ 落在既有 gate 文件，未新增平行通道 |
| 证据审计 | run-baseline.mjs（证据生产者） | `--audit-evidence` + 内置收尾 | ✓ D-4 正确拒绝一次性 `audit-matrix.mjs` 转正与 `scripts/` 新文件（G12 闭集纪律保持） |

### 相似能力对照
| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| gate allowlist | G3 `assertAllowlist` / WS_ALLOW_NEW_FILES | G1′ 改 `assertAllowlist` | 一致 | 复用既有原语 |
| 快照捕获 | `--write-surface-snapshot`（base worktree+farm+tsx） | 不变，仅 entry 数 4→7 | 一致 | 机制零改动 |
| 台账冻结 | root-test 名集纪律（B-3a…e） | G13-d 升级为逐字节 | 一致（更严） | SA8 §3-S4 追认 |

### 单一事实源
| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 规范 BASE | gates.mjs `BASE` | `RELEASE_BATCH.base`（设计 §7.3 又钉一次 `6be891a`） | 低但可免——应引用同一常量（SA2-10） |
| `baselines.json` 的 `base` 文档字段 | 保留 `d59a4d1`（出处记录） | 无代码读方（已核验） | 可接受；但 ledger `capturedAt`/测试描述文本中的旧 base 串需同步澄清（SA2-9） |
| **baselines.json 工件身份/integrity 钉值** | baselines.json 本体 | **G12 允许其 diff，G13 不钉** | **MAJOR（SA2-3）**——与 catalog/ledger 被逐字节钉死形成不对称，且 SA8 §5 表把该项的执行面错误归因为「G12 零 diff」 |

### 生命周期对称性
C1→C2→C3 无资源获取/释放问题；worktree 捕获有 add/remove 对称（G5 finally 清理）✓；回滚 = 本地 reset，无外部状态 ✓。

### 平行机制检查
无第二套 runner/audit/probe/log 格式；审计并入 run-baseline.mjs ✓；无 `--release-mode` 开关（D-3 拒绝，正确）✓。

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| `packages/**/src/**`、`apps/**/src/**`、`scripts/**`（catalog 外）、`.github/**`、非 facility 的 `packages/*/test/**`（含 12 suite 测试文件本体）**不在任何 gate 的 pathspec 内**；§14 DENY 第 1 行把执行面归因「G2/G4/G13 把关」失实（G2 只覆盖 3 个 src 树：gates.mjs L1119–L1123；G4 只覆盖 2 个 entry 文件：L1128–L1131；G13 只钉 manifest/lock/catalog/台账）。例：`packages/clock/src/system.ts`、`packages/persistence/test/cordis-root-real-timer.test.ts`、`scripts/create-publish-manifest.mjs`、`.github/workflows/ci.yml` 的改动在 13 个 gate 全绿 | gates.mjs G1′/G2/G4/G7/G9/G12 pathspec 逐行实读 | SA2-2（G13 增全树条款或新 gate；至少修正 §14/SA8 §5 的归因表述并显式接受「唯 final verification 手工步骤 8 把关」的残余风险） |
| §14 ALLOW/C3 的 wiki 入库范围未枚举（「`task_issue-472_sa10_spec.md` 等 final-verification 产物」）；本 SA2 评审、SA8 冲突报告、brief、dispatch 是否入 C3 未定 | 设计 §9 C3；worktree 现状 5 个 untracked `task_issue-472*.md`；`git ls-files wiki/raw` 证明仓库确有入库惯例 | SA2-6 |
| ALLOW 13 行与 §6.1/§7/§8 逐行对账一致；`*.tgz` gitignore 语义成立；DENY 无与正文冲突项 | 本会话逐行核对 | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| G13 两态「其他形状=红」 | F-A…F-E + N-6…N-9 | **部分 bump（7 之 k）、exact 后单文件回退、审计检查 6（logPath）、检查 7（stray file）无注入**——两态设计的核心红分支未证伪；SA8 §3-S1「F-A…F-E 恰把这些中间态一一证伪」与设计 §10 表不符（过度声明） | SA2-4 |
| 证据审计七检查 | 检查 1–5 有 N-6/N-7/N-8a–d/N-8c 对应；检查 6/7 无 | 同上 | SA2-4 |
| 审计与实盘布局相容 | 检查 7 允许类 {必需集, fault-*.json, *.log, *.vitest.json, tmp/, run-marker.json} | 实盘 `evidence/B1/B1-typecheck.json`（聚合件）、`evidence/B3/fault-fallback/`（目录，内含 .log/.vitest.json 与 `*.mjs.log`）不在允许类字面集内 ⇒ **干净运行即假红**；检查 3 的 gates(B3)/root-test(B1) digest 特例未定义 | SA2-1 |
| A4-4 公共契约冻结五项 | guard-proxy/contract/unload cell + `git diff 19df983..R` + `generate --check` | 手工 diff 是唯一全树执行面（见 SA2-2） | SA2-2 |
| 其余 AC1/AC2/AC3/AC6/AC7/AC8 证据设计 | §11/§15 | 完备（命令、路径、失败判据齐备） | 无 |

## 13. Required revisions

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
|---|---|---|---|---|---|
| **SA2-1** | MAJOR | `run-baseline.mjs` L854–855（`evidence/<B>/<B>-typecheck.json` 聚合件）；实盘 `ls .cache/cordis-baselines/evidence/B1/`（含 `B1-typecheck.json`）、`evidence/B3/fault-fallback/`（无扩展名目录，内含 `B3-provenance.log` 等）；L881（gates cell `provenanceDigest: provenanceDigestFor('B3')`）、L992（root-test `provenanceDigestFor('B1')`）；设计 §7.4 检查 3/检查 7 | 证据审计的目录纪律允许集与真实布局不符：`<B>-typecheck.json` 不属任何允许类 ⇒ 按设计字面实现的 `auditEvidence()` 会对**干净的本轮矩阵**判红（fail-closed 假阳性），实现者要么卡死要么被迫放宽到使检查 7 空转；检查 3 的「每 cell digest === provenanceDigestFor(<B>)」对 baseline='default' 的 gates/root-test cell 未定义特例；`fault-*` 目录的 walk 语义（按文件递归 or 按目录项）未定义 | 设计 §7.4 增补精确允许清单：`<B>/{typecheck+12 suites}.json`、`<B>/<B>-typecheck.json`、`<B>-typecheck-*.log`/`*.log`、`*.vitest.json`、`fault-*`（目录，递归仅容 `*.log`/`*.vitest.json`）、`tmp/`、`run-marker.json`、`gates|root-test|matrix` 三 cell；检查 3 明确「39 个 baseline cell 按 cell.baseline 比对；gates cell 期望 = provenanceDigestFor('B3')、root-test cell 期望 = provenanceDigestFor('B1')（沿用现值）」 | 在 HEAD 干净树上重跑 `--all --matrix`：内置审计 exit 0 且无 problems；随后按 N-6…N-9 注入仍逐项 exit 1 |
| **SA2-2** | MAJOR | gates.mjs L1116（G1′ pathspec=lock+17 manifests+artifacts）、L1119–L1123（G2 仅 persistence/dsh-persistence/namespace-registry src）、L1128–L1131（G4 仅 2 entry 文件）、L1135（G7=docs）；设计 §7.3 b/e（G13 只钉 8 manifest+lock+8 包 manifest+根+vfs3-assets+台账+catalog）；§14 DENY 第 1 行「（G2/G4/G13 把关）」；SA8 冲突报告 §5 第 3 行同款归因 | release diff 没有任何**机械全树绑定**：11 个包的 src 树、全部非 facility 测试文件（含 12 suite 本体）、`scripts/**`（catalog 外）、`.github/**` 不在任何 gate pathspec 内；§14/SA8 的把关归因失实。本票的立论「R 相对 BASE 只允许版本行+manifest+设施文件」目前只有 final verification 手工步骤 8（`git diff 6be891a..R` ⊆ ALLOW）执行 | 二选一（推荐前者）：① G13 两态各增一条全树条款——`git diff --name-only 6be891a` 的 tracked 变更集 ⊆ {8 个 release 文件 + C1 的 4 个设施文件}，untracked ⊆ `wiki/**`（或仅查 tracked），越界即红（属收紧，随 S1 已追认面一并实现，无需新裁决）；② 若维持手工把关，则 §14 DENY 的归因改为「final verification 步骤 8 手工审计 + G8/G10/G11 内容面扫描 + 三基线行为矩阵」，并在 §15 风险表登记该残余 | 实现树（C1/C2）上注入一个 gate 覆盖面外的越界改动（如 `packages/clock/src/system.ts` 加一行注释）⇒ gates exit 1 并指名文件；§14/SA8 §5 归因修正后复核 |
| **SA2-3** | MAJOR | gates.mjs L60–L65（`FACILITY_ALLOW` 含 `baselines.json`——G12 **允许**其 diff）；设计 §7.3 a–e（G13 钉 manifest/lock/8+2 manifest/台账/catalog，**无 baselines.json**）；设计 §7.5「baselines.json 继续零 diff」仅为义务声明；SA8 冲突报告 §5 第 1 行把该冻结面执行归因为「G12 零 diff」——与 L60–L65 事实相反 | `baselines.json` 是三基线工件身份的唯一钉值源（B1/B2 integrity、B3 dshCommit，AC2/A2-1 的根基），却在 release gate 上既被 G12 白名单放行、又不被 G13 逐字节钉死——与 catalog/ledger 的处理不对称；一个随 release 提交混入的 baselines.json 改动可重定义工件身份且 13 gate 全绿。SA8 §5 的错误归因会令终验跳过该项 | G13 两态各增：`baselines.json` 与 BASE 逐字节相同（并入现有 b/e 款）；或把 `baselines.json` 从 `FACILITY_ALLOW` 移除（BASE 重钉后 C1 并无合法 diff 需求，白名单项已死）。同时在实现后复查时更正 SA8 §5 第 1 行的执行面表述 | 注入 `baselines.json` 单字节改动（如 B1 cordis integrity 尾位）⇒ G13 红；干净 C1/C2 树上 13/13 绿 |
| **SA2-4** | MAJOR | 设计 §10 红灯表（F-A…F-E、N-6…N-9）；设计 §7.3.3 声称「部分 bump…红」、§7.4 检查 6/7；SA6 §6.2「任何负控应红实绿直接阻断」；SA8 §3-S1「F-A…F-E 负控恰把这些中间态一一证伪」 | 新判定分支缺证伪：① 部分 bump（7 之 k，G1′ 全绿场景下唯一红点是 G13）；② exact 后单文件回退（absent 失败分支从未红灯实证）；③ 审计检查 6（cell `logPath` 指向不存在/跨目录文件）；④ 审计检查 7（换名旧工件混入目录）。SA8 的「一一证伪」声明与设计 §10 表不符 | §10 表增补四行：F-F（仅 bump 3/7 并再生 manifest ⇒ G13 红、G1′ 绿）、F-G（C2 后回退 persistence 至 0.4.0 ⇒ G13 红）、N-6b（改写某 cell `logPath` 为不存在路径 ⇒ 审计 exit 1）、N-7b（在 `evidence/B1/` 放置一个换名旧工件（如 `zz-old.json`）⇒ 审计 exit 1）；红灯 log 同入 `.cache/issue-472-impl/` | 四项注入各留下「应红实红」log；SA8 复查时以实际表为准更正「一一证伪」的覆盖声明 |

## 14. Non-blocking observations

| ID | Observation |
|---|---|
| SA2-5 | `run-baseline.mjs` L885 `summary` 的 `slice(-12)`：13 gate = 14 行 `[gates]` 输出，会静默丢 G1′/G2 两行（现盘 gates.json 已缺 G1′ 行）。改 `slice(-14)` 或按末行截断；§16「自动继承 13 gate 输出」随之更正。 |
| SA2-6 | C3（docs(wiki)）入库范围应枚举为 `wiki/raw/task_issue-472*.md` 全集（brief、dispatch、SA6 契约、设计、SA8 冲突报告、本 SA2 评审、sa10_spec 及后续轮产物），与 `#470/#471` 的 `docs(wiki)` 惯例一致；设计 ALLOW 仅列 2 个文件，Controller 按行暂存时会产生范围歧义。 |
| SA2-7 | run-marker 的 `tree`/`porcelain` 与 `matrix.json` 的 `runHead/runTree` 只记录不校验：建议内置审计收尾时比对 `git write-tree` === marker.tree（抓运行中树漂移），或明示两者为 disclosure-only。 |
| SA2-8 | 设计须逐字回写吸收 SA8 钉值：§7.3c「恰 7 行增删」→ PV-4 的 numstat 7删+7增口径；§8/§9.2 记录修正文案 → SA8 条件 4 的两分表述（承认 #471 以 3 条 runtime 断言等价承载 7/7 覆盖）。设计文本当前会把修正写成「#471 未发生公共面扩展」，本身成为新的不准确记录（违反 A4-5）。 |
| SA2-9 | `cordis-public-surface.test.ts` L32 describe 文本「vs base 279dba4 捕获」在 6be891a 重捕后失真；§8 的文案更新应一并处理（改为新 BASE 或去掉具体 sha）。ledger `capturedAt: "BASE d59a4d1"` 保留属出处记录，建议在 §7.1 加一句显式说明三处 base 串的语义分工。 |
| SA2-10 | `RELEASE_BATCH.base` 与 `BASE` 常量重复钉 `6be891a`：应引用同一常量（`base: BASE`），消除第二个可漂移钉值。 |
| SA2-11 | 两处表述精确化：① §7.2「语义是收窄到白名单，不是放宽」——对 8 个白名单文件相对旧 G1′ 是**受控开口**（零 diff→allowlist），实质是「白名单外语义不变 + 白名单内移交 G13 更强形状执法」，建议按此表述（SA8 §3-S1 ② 的论证才是准确版本）；② §3 闭包表「workspace 依赖」列实为「闭包内 workspace 依赖」子集（dsh-persistence 漏列 clock、namespace-api 漏列 vfsl、yjs-server 9 项列 4 项），结论正确但表头应改「闭包内 workspace 依赖（其余 workspace 依赖均不在闭包、不变）」以免 SA8/owner 误读。 |
| SA2-12 | mtime 新鲜度的威胁模型应成文：marker 回拨可令检查 4 反向放行（N-8a 只回拨 cell 不回拨 marker），本审计防「意外过期/跨轮混用」，不防对抗性伪造（对抗面由 marker.head 单树绑定 + final verification 独立重跑承担）；如需更强可加「marker.startedAt 与 matrix.generatedAt 差值上限」。 |

## 15. 对 SA8 追认事项的意见（dispatch 要求）

1. **S1（ratified-with-conditions）：支持追认，但 PV 清单需随本评审补两钉**——`baselines.json` 逐字节（SA2-3）与全树变更集 ⊆ ALLOW（SA2-2）应并入 G13 钉值后发布；PV-3/PV-4/PV-6/PV-7 与我的独立核验一致，无异议。
2. **S2（ratified）：同意**「按既有流程」读法无需 owner 事前确认；7 包闭包与 registry 现值经我独立重算/实查精确无误；升级触发器（统一 minor/CHANGELOG/根版本）保留正确。
3. **S3（ratified-with-conditions，方案 A）：支持**；三 entry 均为既有公共面（exports/ls-tree 实证），G12 +1 与快照重捕机制可行；条件 4 的两分文案必须回写进设计 §8（SA2-8），否则设计文本与追认条件冲突。
4. **S4（ratified）：支持**；G13-d 逐字节冻结严格于既有名集纪律，名集谓词与计数 +3 正交，无「计数变化破坏台账」缝隙。
5. **对 SA8 报告本身的更正请求（实现后复查时处理）**：§5 表第 1 行（baselines.json「G12 零 diff」——实际 G12 允许其 diff）与第 3 行（公共 API 冻结执行面「G2/G4/G7」——G2 仅 3 包 src、G4 仅 2 文件）两处归因与 `gates.mjs` 实码不符；§3-S1「F-A…F-E 恰把这些中间态一一证伪」与设计 §10 表不符（部分 bump/catalog 漂移无注入）。建议随 SA2-2/3/4 的修订一并更正，避免终验按错误归因漏查。

## 16. 结论

主体设计可实施性高：版本闭包/矩阵、时序、复验计划、风险停手条件全部经一手证据核实成立。reject 仅由 4 条 MAJOR 触发，全部集中在「fail-closed 的最后一公里」：审计允许集与实盘布局不符（SA2-1）、release diff 缺机械全树绑定且归因失实（SA2-2）、工件身份源未被钉死（SA2-3）、两态与审计的新分支缺红灯证伪（SA2-4）。四条的修订都是 G13/§7.4/§10 内的局部增补，修订后无需重开架构决策（S1 已追认面内），预期一轮修订即可达到 approve。
