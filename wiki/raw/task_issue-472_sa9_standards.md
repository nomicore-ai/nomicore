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
