# SA9 Standards Review — issue #472（round 1 / standards-review iteration 0）

- Reviewed subject：`git diff --no-renames 6be891a3a0cb32fe21c3a6bf485f33428052ce7b..d5cf4850e317b51df9b50c33f8487d832565f8d6`。
- 审查方式：只读源码、提交、仓库规范与既有运行证据；按 SA9 职责未重跑测试、未启动服务、未修改代码/设计/测试。
- **verdict：reject**。
- 分级：**BLOCKER 0 / MAJOR 4 / MINOR 1；blocking = 4**。

## Findings

### SA9-1 — MAJOR：run-marker 的 `tree` 只绑定 Git index，未绑定被测 working tree；未暂存漂移可审计全绿

**证据**

1. `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs:1071-1079` 以 `git write-tree` 生成 marker，`run-baseline.mjs:1195-1225` 收尾仍只比较 HEAD（仅 standalone）与 `git write-tree`。`git write-tree` 写的是 **index**，不包含未暂存的 working-tree 内容。
2. 被测内容却来自 working tree：`run-baseline.mjs:251-260` 对 `git ls-files` 返回的每个路径直接 `fs.copyFileSync(source, target)`。因此 index tree 相同并不代表实际复制、执行的源码相同。
3. 这不是纯理论风险：`.cache/issue-472-impl/matrix-run-final.log:2` 的 C1 矩阵 marker 为 `head=6be891a… tree=b41d9e73…`，其中 `b41d9e73…` 正是 BASE tree；但 C1 四文件当时仍在 working tree 中被复制执行。只读命令 `git show -s --format='%H %T' 6be891a 1198312` 可复核 BASE tree=`b41d9e73bbeafe44831fdc85ef652964d7a65dab`，而真正 C1 commit tree=`da3f368fb4a959b53ab8e1f424e0369a6adf85e5`。所谓“单树绑定”在该轮并未绑定实际被测内容。
4. 现有 N-8c 只证明“另一提交且 index tree 改变”会红（`.cache/issue-472-final/08-n8c-n9-redo-summary.txt:3-5`），没有覆盖未暂存修改；SA7 `wiki/raw/task_issue-472_sa7_final_verification.md:8,186` 的“无 fail-open”因此过度声明。R 终验恰好干净只能使该次结果未受此缺陷影响，不能修复设施语义。

**闭合判据**

- marker 与收尾审计必须对 **tracked working-tree 内容**计算并比较确定性指纹，而不是比较真实 index 的 `git write-tree`；可用独立临时 index 执行 `read-tree HEAD` → `add -u` → `write-tree`，或等价的逐 tracked 文件内容摘要，且不得把允许变化的 untracked wiki 纳入指纹。同步更正设计 §7.4/D-11 把 `write-tree` 当作工作树漂移校验的错误归因，并按冲突门禁确认新指纹口径后再改实现。
- built-in 与 standalone 收尾均复核 HEAD 与上述指纹；新增负控：矩阵后仅做未暂存 tracked 修改、不 `git add`，审计必须 exit 1；另覆盖运行中未暂存漂移与同 tree HEAD 移动。
- 重跑 C1 等价控制时，marker/fingerprint 必须对应实际 C1 内容树 `da3f368f…`，不得再把 BASE tree `b41d9e73…` 当作实际 C1 内容绑定。

### SA9-2 — MAJOR：最终矩阵没有按强制口径固定 pnpm 10.28.2；把必做对齐写成“非判据偏离”

**证据**

1. 上游硬约束不是可选建议：`wiki/raw/task_issue-472_sa6_acceptance_contract.md:645` 明确“最终验证必须固定 10.28.2 PATH”；同文件 `:83,180` 要求所有 pnpm 语义固定并记录版本，`wiki/raw/task_issue-472_design.md:368` 也规定复验全程固定。
2. 实际终验矩阵却在默认 shell 的 pnpm 11.28.5 下运行：SA7 自己在 `wiki/raw/task_issue-472_sa7_final_verification.md:162` 如实承认；`.cache/cordis-baselines/evidence/root-test/root-test.json:6130-6133` 更直接记录 `pnpmProbe.exitCode=1` 及 “current pnpm is v11.28.5”。只有发布三连的 `.cache/issue-472-final/05-pnpm-version.txt:1-3` 是 10.28.2，不能反向证明矩阵环境。
3. SA7 `:159-162` 把此事列为“记录性，非判据偏离”，与上述强制条件冲突；`e3d5881` 提交正文⑦还把 C1 `5959/5991` 与 C2 `5987/5991` 一并置于“固定 pnpm 10.28.2 下”语义中，但 C1 的 32 红包含 28 个 PATH 环境红，该归因同样不准确（复核命令：`git show -s --format=%B e3d5881`）。
4. **并非指控伪绿或扩账**：SA7 `:33,138,162` 和 root-test JSON `:6001-6035,6115-6126` 如实披露 5959/5991、failed=32=4 frozen+28 environment、`failedUnexpected=[]`、`exitCode=1`；`root-test-known-red.json` 相对 BASE 零 diff。问题是强制终验环境没有执行，而非这些红被掩盖。

**闭合判据**

- 在同一 R 树上以明确的 10.28.2 shim 置于 PATH 首位重跑完整 `--all --matrix`，不得以只跑 root-test 子集替代；落盘 `pnpm --version`=10.28.2 且 root-test `pnpmProbe.exitCode=0`。
- 按新实跑原样披露 counts、4 个既有 frozen 红及 `failedUnexpected`；若出现台账外新红必须停手，不得扩账或用 env override 消除。同步更正终验/后续记录中“C1 也在固定 pnpm 下”的归因及“非判据偏离”的分类。

### SA9-3 — MAJOR：G13.g 的 tracked wiki allowlist 实际扩到了整个 `wiki/**`，超出追认的 `wiki/raw/task_issue-472*.md`

**证据**

1. `packages/persistence/test/fixtures/cordis-baselines/gates.mjs:127-132` 的 `isTicketDoc()` 只要求 `posix.startsWith('wiki/')` 且 basename 匹配 `task_issue-472*.md`，因此 `wiki/task_issue-472_probe.md`、`wiki/other/task_issue-472_probe.md` 均被 tracked 全树条款放行。
2. 追认钉值却是直接位于 `wiki/raw/` 的本票产物：`wiki/raw/task_issue-472_design.md:246` 与 `wiki/raw/task_issue-472_design_conflict_report.md:277-284` 均写 `wiki/raw/task_issue-472*.md`；交付条件 8 禁止继续扩大 allowlist。untracked ⊆ `wiki/**` 是另一项明确规则，不能据此放宽 tracked 分量。
3. 可复现负控：在 R 的一次性副本新建 `wiki/task_issue-472_probe.md` 并 `git add`（必须 staged，避免落入本来就允许的 untracked 规则），该路径会进入 `git diff --no-renames --name-only BASE`，但 `gates.mjs:1173-1182` 不产 problem；G7 只查 `docs/`，其他 gate 也不拥有此路径。实际交付 20 文件虽全部在允许范围，机械门禁仍未兑现钉值。

**闭合判据**

- tracked 判定必须限定 direct parent 恰为 `wiki/raw` 且 basename 匹配 `task_issue-472*.md`；不得接受 `wiki/` 根下或更深子目录的同名片。
- 增加 staged `wiki/task_issue-472_probe.md` 与 `wiki/raw/nested/task_issue-472_probe.md` 两个负控，G13.g 均须指名判红；现有 C3 的 `wiki/raw/task_issue-472*.md` 正向控制保持绿。

### SA9-4 — MAJOR：条件 9 要求的落盘空 `problems` 列表不存在，SA7 的 `problems=[]` 只有自述断言

**证据**

1. 现行判定口径 `wiki/raw/task_issue-472_design_conflict_report.md:286-296,331-338` 明确要求：exit 0 **且打印/落盘的 problems 列表为空列表**，并特别说明“不是自述文本”。
2. `packages/persistence/test/fixtures/cordis-baselines/run-baseline.mjs:1390-1397` 在空数组时只打印 `EVIDENCE AUDIT PASS ...`，完全不输出 `problems`；非空时才逐项打印。
3. 因此 `.cache/issue-472-final/02-matrix-all.log:47-48`、`.cache/issue-472-impl/audit-standalone-final.log:1-2`、`.cache/issue-472-final/09-final-state.log:16-18` 都只有 PASS 与 exit=0，没有可机判的空列表。SA7 `wiki/raw/task_issue-472_sa7_final_verification.md:30,137,145,156` 多处把这些日志直接引作 `problems=[]` 证据，不满足已加固的条件 9。这里不是断言内部数组实际非空，而是交付要求的独立可观察证据缺失。

**闭合判据**

- built-in 与 standalone 都在成功和失败路径的现有日志中落盘结构化审计结果（至少显式 `problems=[]` / 非空数组），并保留各自 exit code；成功日志不得只给 PASS 自述。若另增 JSON artifact，必须同步审计目录允许集并履行相应追认，不能造成新的越类文件。
- 重跑干净矩阵与 standalone，引用包含空列表的新日志；N 系负控须显示对应非空列表且 exit 1，防止只添加装饰性 `[]` 输出。

### SA9-5 — MINOR：新增/变更设施的注释与 standalone guard 有可维护性失真

**证据与闭合判据**

1. `gates.mjs:5` 仍称 G1′ 为 zero-diff，`gates.mjs:7,70-71` 仍按旧的 plugin.ts/四个新 fixture 描述 G3，与 `gates.mjs:1486-1495,1505-1525` 的 release 语义不符。应更新为“白名单外零 diff + 白名单内由 G13 钉形状”及“tracked 仅 package.json、四 fixture 保持零 diff”。
2. `run-baseline.mjs:901-903` 仍写“13 gates = 14 lines incl. summary”，但当前保留 G10 七行明细，实际 `evidence/gates/gates.json:10-31` 为 21 行；SA8 §13.3 已允许 14/21。应改成逐 gate+汇总完备、其他 `[gates]` stdout 全保留，不再暗示固定 14。
3. standalone 的“missing evidence directory”分支 `run-baseline.mjs:1375-1379` 被 `run-baseline.mjs:1464-1473` 的先导 `mkdirp(EVIDENCE)` 变成不可达诊断。应在 standalone 审计前不要创建目录（把 `mkdirp` 移到需要写证据的分支），或删除死 guard 并统一实际错误语义；补一个空目录/不存在目录负控，确保仍响亮 exit 1。

## 已核实通过的标准面（不抵销上述 findings）

- **提交与范围**：C1 `1198312` 恰 4 设施文件、C2 `e3d5881` 恰 8 release 文件、C3a `d5cf485` 恰 8 wiki 文件；最终 20 文件=4+8+8。`packages/**/src/**`、`apps/**/src/**`、`domains/**`、`docs/**`、`scripts/**`、`.github/**` 零 diff。
- **release 数字**：七个 `package.json` 各 numstat 1+1，manifest 为 7+7、15 键且版本文件名一致；`pnpm-lock.yaml`、catalog、ledger、`baselines.json` 零 diff。B3 digest `9d6633550e82c2960ec58e31a8626af7482d53ad323a612c0dce2f3e0a44221c` 可由 `.cache/issue-472-final/01-acquire-all.log:40` 复核。
- **发布证据**：`.cache/issue-472-final/05-release-gates-summary.txt:1-15` 记录 pnpm 10.28.2、默认 verify、15/15 与 reproducible 15/15；未见 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0` 伪绿。C2 的 #471 修正文案符合“既承认 3 条 runtime 覆盖、又明确 7-entry 快照由 #472 落地”的两分要求。
- **surface 测试质量**：`cordis-public-surface.test.ts:22-50` 为 7 entry、1 个键集断言+7 个逐 entry 严格相等断言（共 8 个 it），不是无断言装饰；`public-surface.base.json` 恰 7 键，四个旧 entry 内容未被改写。
- **diff 原语**：G13 全树、逐文件文本、manifest numstat、`changedPaths()` 与 G3 均携带 `--no-renames`（如 `gates.mjs:212-224,1250,1295,1304,1510`）；最终形状审计也使用同原语。
- **文档与钉值寿命**：`INSTALL.md:162-219` 的真实发布流程未改变，规范文档没有本票 facility 的旧行为声明需要同步；`docs/AGENTS.md:5` 明确 wiki/raw 是证据而非规范。`gates.mjs:96-100` 明示 RELEASE_BATCH 为票级钉值、下个 release 重钉，未发现锁文件或生成物不同步。

## 结论

**reject；blocking=4（SA9-1…SA9-4），BLOCKER=0，MINOR=1。** 当前 release 形状与多数实证数字真实可复核，root-test 也没有被伪绿或扩账；但 working-tree 证据绑定、强制 pnpm 终验环境、tracked wiki 精确范围和条件 9 的可机判空问题列表四项硬标准尚未闭合。SA9-5 不单独阻断。

---

# iteration 1 — remediation 后终审复查

- Reviewed subject：`git diff --no-renames 6be891a3a0cb32fe21c3a6bf485f33428052ce7b..ae0dc6dfcef24150156d665c238fcb97877fa4e2`；交付链 C1 `1198312` → 旧 R/C2 `e3d5881` → C3a `d5cf485` → R′/C4 `a7fb8ff` → C5 `66a35f6` → C6a `ae0dc6d`。
- 审查方式：只读实码、Git 对象与一手日志/JSON；未重跑测试、未启动服务、未修改代码/设计/测试。本节为追加复查，iteration-0 历史原样保留。下文 `iter1/` 均指 `.cache/issue-472-final/iter1/`。
- **verdict：approve**。
- 分级：**BLOCKER 0 / MAJOR 0 / MINOR 1；blocking = 0**。SA9-1…SA9-4 均 CLOSED；SA9-5 为 PARTIAL，残余仅是注释失真，不阻断。

## 1. 原 findings 逐条复核

### SA9-1 — CLOSED（原 MAJOR）

1. **内容指纹原语已落地。** `run-baseline.mjs:1107-1116` 的 `trackedWorktreeFingerprint()` 在 `os.tmpdir()` 建临时目录，以独立 `GIT_INDEX_FILE` 依次执行 `read-tree HEAD` → `add -u` → `write-tree`，并在 `finally` 删除临时目录；真实 index/HEAD/ref 不作为指纹来源。`writeRunMarker()` 在 `:1121-1127` 写 `{startedAt, head, worktree, porcelain}`；`:1244-1277` 在 built-in/standalone 共用的 `auditRunMarker()` 中比较当前指纹与 `marker.worktree`，standalone 的 HEAD 检查独立保留。
2. **旧字段未回流。** 当前实码没有 `marker.tree` / `matrix.runTree` 消费或写入；`:1351-1355` 与 `:1568-1573` 使用 `runHead`/`runWorktree`，后者直接取 `marker.worktree`。R′ 的 `.cache/cordis-baselines/evidence/run-marker.json:1-6` 与 `matrix/matrix.json:1-5` 也实际只有新字段。
3. **R′ 身份成立。** Git 一手核对 `a7fb8ffe562febb0bdcf8cad632723a3cf90559e^{tree}` = `91c1c49a38746a9314955d632989939aad418379`；上述 marker 与 matrix 分别记录同一 OID，且 `runHead`/`marker.head` 均为完整 R′ HEAD。因此 `marker.worktree === runWorktree === R′ tree`，不是 BASE 或真实 index 的替代值。
4. **三个负控均为实际红。** N-8e 日志 `iter1/audit-N-8e.log:1-3` 在未暂存 `INSTALL.md` 漂移后 exit 1，RESULT 恰含 1 个 drift problem，恢复日志 `:1-2` 回绿；N-8f 的 `iter1/04-n8f-matrix.log:1,47-52` 证明 marker 后、运行中漂移使 built-in 审计含 drift problem 且 `MATRIX FAIL`；N-8g 的 `iter1/audit-N-8g.log:1-3` 在同内容空提交后只有 HEAD problem，无 drift problem。对应执行脚本还分别记录了不 `git add`、首个证据出现后才注入、`--allow-empty` 的注入方式（`n-series.sh:101-105`、`n8f.sh:54-77`、`falsify-n5-n8c-n8g-n10-n9.sh:69-78`）。

### SA9-2 — CLOSED（原 MAJOR）

1. 固定 shim 实体 `.cache/issue-472-final/bin/pnpm:1-3` 直接 exec corepack 缓存的 pnpm 10.28.2；R′ 复验的 `iter1/00-pnpm-version.txt:1` 与 `05-pnpm-version.txt:1-2` 落盘 10.28.2，后者同时记录 registry-integrity override 在 env 中出现 0 次。
2. `iter1/02-matrix-all.log:1-49` 是同次完整 `--all --matrix` 输出：41 个 cell 全列、内置审计 RESULT exit 0、`MATRIX PASS: 41 cells`；`02-matrix-all.exit` 为 exit 0，不是 root-test 子集替代。
3. 一手 `.cache/cordis-baselines/evidence/root-test/root-test.json:6001-6007,6059-6079` 记录 `failedUnexpected=[]`、实际 counts `passed=5987 / failed=4 / total=5991`，以及 `pnpmProbe={exitCode:0, stdout:"10.28.2", stderr:""}`。四个失败名在 `:6001-6005` 全量列出，仍为冻结 test-d 红；没有宣称 root-test 全绿或扩账。

### SA9-3 — CLOSED（原 MAJOR）

1. `gates.mjs:139-142` 现已要求 `path.posix.dirname(posix) === 'wiki/raw'` 且 basename 匹配 `/^task_issue-472.*\.md$/`；`g13ChangesetProblems()` 在 `:1182-1193` 对每个全树 tracked change 调用它，untracked ⊆ `wiki/**` 分量未变。
2. F-L 一手日志 `iter1/falsify-F-L.log:1-5,327-361` 显示探针确为 staged `A  wiki/task_issue-472_probe.md`，G13 exact 唯一 problem 指名该路径，G1′/G2/G4/G12 同轮 PASS。F-M 的 `iter1/falsify-F-M.log:1-5,327-361` 同样证明 staged `wiki/raw/nested/…` 被指名判红。
3. 正向控制 `iter1/falsify-F-control-exact.log:5-25,325-339` 在 R′ 已交付的 8 个 `wiki/raw/task_issue-472*.md` 全部在位时 13/13 PASS、G13 state=exact；收窄没有误伤已交付文档。

### SA9-4 — CLOSED（原 MAJOR）

1. `run-baseline.mjs:1455-1463` 的统一 `printAudit()` 在人读 PASS/FAIL 前输出一行 `EVIDENCE AUDIT RESULT (<context>): exit=<0|1> problems=<JSON>`；两个调用点分别为 standalone（`:1545-1548`）和 built-in（`:1577-1581`），exit code 仍由同一 `problems.length` 决定。
2. 成功证据不是自述：built-in `iter1/02-matrix-all.log:47` 与 standalone `iter1/audit-control-clean.log:1`、`audit-closing.log:1` 均有字面量 `exit=0 problems=[]`，且每份日志恰一行 RESULT。失败证据 `audit-N-8e.log:1` 与 `audit-N-10-missing.log:1` 为非空 JSON 数组 + exit 1，排除了装饰性空列表路径。
3. C4 精确 diff 只增加既有日志通道输出，没有新增证据 artifact，也没有修改 `auditEvidenceDirectory()` 的允许集；C4 全提交恰为两个设施文件。

### SA9-5 — PARTIAL（原 MINOR；不阻断）

**已闭合部分**：gates 头注 `gates.mjs:5-11` 已改为白名单外零 diff + G13 钉形状；gates-cell 注释 `run-baseline.mjs:903-911` 已改成 summary 完备性而非固定 14 行；`main()` 头部的 `mkdirp(EVIDENCE)` 已删除（`:1530-1549`）。N-10 缺目录在 `iter1/audit-N-10-missing.log:1-3` 实际命中 `missing evidence directory`、exit 1；空目录在 `audit-N-10-empty.log:1-3` 也为 exit 1 + 49 problems。

**残余 MINOR**：注释尚未全部对齐。`gates.mjs:74-75` 仍称「the only ws-replication paths that may differ … are the four new test files」，遗漏实际允许的 `package.json`，与同文件 `:9-11` 及 G3 实码矛盾；`run-baseline.mjs:1537-1539` 新增注释称 missing **or empty** evidence root 都到达 missing-directory guard，但空目录实际走 missing-marker/cell 检查（上述 49-problem 日志），并不到达该 guard。另 `run-baseline.mjs:1046,1075` 仍写 N-6…N-9 与终验 `R`，未反映 N-10/R′。这些只是维护性文案残留，不改变上述机械判定与负控结果，故不升为 blocking。

## 2. C5 记录更正（条件 11）

**通过。** `git show -s --format=%B 66a35f6` 的正文逐项满足本轮指定判据：

- 口径两分明确区分未固定 PATH 的 C1/旧 R `5959/5991 = 4 frozen + 28 environment` 与固定 10.28.2 的 C2 预验/R′ `5987/5991 = 4 frozen`，并明确作废 C2 ⑦ 的混同归因与 SA7 的「非判据偏离」分类。一手对照分别为 `.cache/issue-472-impl/matrix-run-final.log:47`、旧 R 的 `.cache/issue-472-final/02-matrix-all.log:46` 及其保存的 matrix `iter1/n8d-old-matrix-round1.json:10861-10875`（pnpmProbe exit 1 / 11.28.5）、固定口径 `c2-probe-matrix.log:4,51` 与本轮 R′ root-test JSON。
- 正文给出 R′ 完整 HEAD `a7fb8ffe562febb0bdcf8cad632723a3cf90559e` 和 tree `91c1c49a38746a9314955d632989939aad418379`，声明 AC1–AC4 重新绑定 R′，旧 `e3d5881`/`d5cf485` 的绿仅留历史；并保留 A4-3 其余各项的不变引用。
- Git 实测 C5 parent 恰为 R′，且 `66a35f6^{tree}` 与 `a7fb8ff^{tree}` 都是 `91c1c49a…`；`git diff-tree` 对 C5 返回 0 文件。C2 原对象/原正文仍在祖先链中，未 reword；C5 是追加的 message-only empty commit。复验收尾日志时间为 11:34（`iter1/09-final-state.log`），C5 commit 时间为 11:36，次序亦符合。

## 3. T-1/T-2、提交卫生与新增风险

- **T-1/T-2 通过。** `iter1/release-gates.sh:20-82` 先真实 `pack:local`，再 `cp -a artifacts/local-packages` 到一次性副本；T-1 在副本的 persistence tarball 中位偏移 XOR 1 字节，T-2 在另一副本删除 yjs-server tarball，然后分别换入并运行默认 `publish:verify`。一手 `05-T1-publish-verify.log:6-8,69-70` 与 `05-T2-publish-verify.log:65-70` 均 exit 1 且按 tarball 文件名指名。`05-sha256-pre.txt`、`05-sha256-post-T1.txt`、`05-sha256-post-T2.txt` 各 16 行逐字一致；恢复后 `05-publish-verify-post-restore.log:75` 为 15/15，`05-publish-reproducible-post-restore.log:5` 也为 15/15。
- **提交卫生通过。** `git diff-tree --no-renames` 实测：C4 恰 2 个设施文件；C5 零文件；C6a 仅 7 个 `wiki/raw/task_issue-472*.md`（5 M + 2 A）。最终范围恰 22 文件 = 4 设施 + 8 release + 10 wiki；生产 `src`、`docs`、`scripts`、`.github`、`domains` 均无 diff。C4 tree 与预定 R′ OID 一致。
- **新增实现风险**：新增 `os` import 与指纹 helper 均有实际消费，临时目录有 `finally` 清理；未发现新的死代码、可绕过分支或伪绿路径。唯一残留是 SA9-5 所列注释失真。
- **条件 10 纪律**：本次未把 E-1…E-5 的作废归因当作核对依据。内容绑定只按 PV-9 实码 + R′ marker/matrix + N-8e/f/g 判定；tracked wiki 只按 direct-parent 实码 + F-L/F-M/正向控制判定；其余结论来自 Git 对象与一手运行日志。

## 4. 结论

**approve；blocking=0。** 四个原 MAJOR 全部 CLOSED，C5 更正、T-1/T-2 与提交边界均有一手证据。SA9-5 因注释残留判 PARTIAL，保留 **1 个非阻断 MINOR**；无 BLOCKER/MAJOR。
