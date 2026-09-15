# SA7 独立动态验证报告 — issue #381：W1 冻结解除与 total 下沉（final-verification）

- 阶段：final-verification（SA7 动态验证）；日期 2026-09-14（UTC）
- Worktree：`/home/wangjian/nomicore-fix-issue-381`（branch `mabf/issue-381`，HEAD `8a4fa404076afdae9d974c1ad15bd985e24d58ac` + SA3 未提交实现改动，6 文件 +88/−374）
- dispatch：`sa-9af719ff-f087-45fc-8ec4-d8e2ac1149ae`（role `mabf-sa7`，iteration 0）
- 证据留档：`artifacts/sa7-issue381-dynamic-verify.log`（V1–V7 全量输出）
- 本轮边界：零产品代码改动、零既有测试改动；唯一新增 = 临时动态探针（已删除，见 §7）+
  本报告 + 证据日志；零提交、零推送、零 PR；不验证 SA9/SA10、不读远端 CI、不跑全仓回归

## Inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-381.md`（Host 简报；AC1–AC5；Comments 空） | 在场，已读 |
| `wiki/raw/task_issue-381_design.md`（SA1 设计 §8.2 数据流路线 ①–⑥、§11 验收映射） | 在场，全文已读 |
| `wiki/raw/task_issue-381_sa6_contract.md`（verdict approve；§12 契约 T/R/X/G 组） | 在场，全文已读 |
| `wiki/raw/task_issue-381_sa3_impl.md`（实现报告；Deferred verification #1 = 本轮主对象） | 在场，全文已读 |
| `wiki/raw/task_issue-381_sa4_review.md`（verdict approve；§11 后续动态验证项 1 = lease 面端到端逐字节不变） | 在场，全文已读 |
| `wiki/raw/task_issue-381_sa2_review.md` / `_design_conflict_report.md` / `_implementation_conflict_report.md` | 在场（约束面核对） |
| Owner comment | 无（简报 Comments 空 + dispatch 明示 REST 读回零评论）——无额外 owner 口径 |
| 活链路参照件（只读消费，未修改）：`issue-369-window-read-fixture.ts`、`real-persistence-scheduler.ts`、`registry-persistence-contract.test.ts`（FilePersistence 往返纪律）、`@nomicore/persistence`（Memory/File adapter、testing scheduler）、`@nomicore/namespace-registry/testing` | 已读 |

**SA4 点名的本轮动态对象**（SA4 §11 行 1；SA3 Deferred #1）：lease 面端到端
（Registry 装配 + 真实 persistence 全链路）逐字节不变——同输入下 lease `readArray`/`readMap`
四键结果（含 ✂ 事实行）与 HEAD 逐字节一致。SA4 §11 行 2（E4 对抗场景）维持「不判负、
不写断言、不引入新读路径」边界，本轮未为其立约（遵守）。

## Runtime environment

| 项 | 值 |
|---|---|
| node / pnpm / vitest / yjs | v24.13.0 / 10.28.2 / 3.2.7 / 13.6.32 |
| 运行条件 | `NODE_OPTIONS=--conditions=nomicore-source`（源码态解析，与 root `pnpm test` 同链）；`maxWorkers: 1` |
| 实现态 | 主 worktree（SA3 改动在场） |
| HEAD 基线态 | `.worktrees/sa7-head-8a4fa40`（detached @ `8a4fa40`；`pnpm install --offline --frozen-lockfile` 独立 node_modules——**禁止** symlink 主 worktree node_modules：pnpm 工作区包符号链接按相对路径解析会静默指向实现态 packages；独立安装后探针在 HEAD 解析到 HEAD 源码，经 vitest root 报头与本轮红/绿结果双向证实） |
| 动态驱动 | 临时探针 `packages/namespace-registry/test/issue-381-sa7-livechain-probe.test.ts`（vitest 收集；真实 `createMemoryPersistence`/`FilePersistence` + `createNamespaceRegistryForTesting` **生产 runtimeFactory**（无替换）+ `registry.open` → lease 公共面；W1 原语直调 + runtime seam 直面；§7 已删除） |

## Changed Data Flow Verification

设计 §8.2 声明改变的路：①②（W1 单遍枚举 + 选窗物化，成功结算两键 → 三键）与
⑤（S6 单源 total 消费）。

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| ①② W1 原语结算 | 成功恰三键 `{ok,value,total}`；total = 候选标识计数，与 value 同一次枚举 | 探针 S1c：`readArrayWindowAtPath(doc,['workRecords'],{n:2,desc})` / `readMapWindowAtPath(doc,['tasks'],{n:2,field desc})` 直调（MemoryPersistence 真实 handle → runtime seam 同 doc） | W1 成功结算 own 键集 = `['ok','value','total']`；array 面 total=3（workRecords 候选 3）、map 面 total=3（tasks 非 undefined 键 3）；value 与 HEAD 逐字节同值同序 | 三键 + total=3 | HEAD 两键 `['ok','value']` → 实现态三键且 total=3；108 样本中**恰此 2 样本**与 HEAD 不同（V3） | PASS（唯一行为差异 = 设计变更本体，AC1/D1/D2） |
| ①→⑤ 单源贯通 | `total` 由 W1 结算携带，组合层零重算（S4 删除） | 探针 S1 lease `readArray(['workRecords'],{n:2})`：✂ 事实行 `- workRecords · 窗口 · 基 index asc · kept 2/total 3`；毒值 fixture S1b：`kept 2/total 2000` | W1 枚举（total=2000，零物化：value.length=2）→ runtime S2 直通 → 组合层 S3→S5→S6 `truncated = kept < total` → lease 四键 | ✂ 行与 truncated 承接 W1 同一次枚举的计数 | 实现 ✂/truncated 与 HEAD（S4 第二次导航计数）**逐字节一致**（V3）；`total` 承重性另由 SA3 变异 C（`total := kept` → 16/50 红，sensitivity-mutations.log）反证：组合层确在消费真实 total 而非 kept | PASS |
| ⑥ registry 透传 | lease 原样透传 runtime 联合（恒四键） | 探针 S1c runtime seam 直面 vs S1 lease 公共面（同 options：`{n:2, index desc, depth:1}` / `{n:2, field desc, depth:1}`） | runtime 直面结果与 lease 结果（经 `createNamespaceRegistryForTesting` 生产装配 + `registry.open`）逐字节相等（V4 复核 `=== true` 两面） | lease ≡ runtime | 逐字节相等；lease 层零解释、零复制 | PASS |

## Preserved Data Flow Verification

设计声明不变的路：lease 公共面（恒四键 + ✂ 文法 byte 级 + 失败词表）、readData 姊妹面、
registry/lease 测试零语义改动。方法：同一探针在 HEAD `8a4fa40` 与实现态**同输入双跑**，
108 样本逐字节 A/B（V3）。

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| lease 成功面 | 恒四键 `{ok,value,schema,truncated}`；✂ 事实行 byte 级不变；truncated ≡ kept<total | S1 矩阵 23 个成功样本（index/key/field × asc/desc、n≥total/n<total、depth 0/1/2、maxChildrenPerNode、ROOT 面 `kept 4/total 9`、空容器 ×3、raw 偏 schema 面 schema:null ×4）+ S1b 毒值 2 样本 + S2 重启前后 66 样本 | HEAD dump（/tmp/sa7-381-head-dump.json） | 实现态 dump **106/108 逐字节一致**（全部 lease 面样本零差异：`- workRecords · 窗口 · 基 index desc · kept 2/total 3`、`- tasks · 窗口 · 基 field:priority desc · kept 2/total 3`、`- [] · 窗口 · 基 key asc · kept 4/total 9`、`kept 2/total 2000` 等全逐字相同） | PASS |
| lease 失败面 | 三码 + `PATH_NOT_ALLOWED` 透传；own 键集恰四键；path 精确到项；无半窗 | S1 失败矩阵 9 样本（缺键 ×2、载体不符 ×2、n=0、未知 options 键 `where:'x'`、array 面 field 项、稀疏空洞 fail-fast `['probe','sparse',1]`）+ S1b E4（毒值入选项 `['workRecords',1999]`，message `non-finite number（目标）`） | HEAD dump | 逐字节一致（code/path/message 全同；E4 与直调 W1 同型失败在两侧均无 `value`/`total` 键） | PASS |
| 既有契约测试族 | composition 17 + lease 33 零改动全绿（M4 零 diff） | vitest 直跑两文件 | HEAD worktree：50/50 绿（V6） | 实现态：50/50 绿（V5 的 8 文件 144/144 含之；两树该两目录 `git diff --stat` 为空） | PASS |
| FilePersistence 重启恢复 | 磁盘快照往返后 lease 读 byte 级不变；不复活旧路径 | S2：createDoc → lease 矩阵 → flush（testScheduler advanceBy 1000）→ 快照落盘（`users/u-369/ns-369.snapshot`）→ dispose → 新 FilePersistence/新 Registry `open` → 同矩阵 | —（HEAD 侧同探针同跑） | 33 样本重启前后逐字节一致；HEAD↔实现态的 S2 双侧 dump 亦逐字节一致（含 §9 登记的 3 个 plain 数据发散样本**同签名双侧复现**，证明其为基线持久化语义而非本票行为差异） | PASS |
| readData 姊妹面 / 公共导出面 | 增键不回渗（NC1/NC2/NC6） | 既有 pins/contract/guard/type-guard 测试（V5 144/144） | SA6 §4 基线绿 | 实现态绿（`✓ TS` 含 `total: number` 类型锁） | PASS |

## State Machine Verification

纯同步读路径 + lease/registry 生命周期（本轮活链路观察点）：

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| doc 在 persistence、runtime 未建 | `registry.open(owner, docId)`（生产 runtimeFactory） | open → loadDoc → runtime 构造 → schema `preparing→ready` → lease active；读可用 | 探针 S1/S1b/S2 全部 lease 在 schema ready 后读取成功（轮询至 ready，<5s） | 未出现 open 失败/读被拒 | PASS |
| lease active | `lease.release()` | released 短路**先于**一切透传：后续 `readArray` 同步返回冻结 released issue | released 后 `readArray` 返回 own 键集 `['ok','code','message']`、`ok:false`（与 HEAD 逐字节一致） | 无透传泄漏（未返回窗口结果或 W1 形状） | PASS |
| runtime 已关 / persistence 已 dispose | 新 FilePersistence + 新 Registry `open`（S2 重启腿） | 从磁盘快照重建 doc → schema ready → lease 四键读与重启前逐字节一致 | 33/33 样本逐字节一致；快照文件在场（V4 `S2:snapshot-files`） | 无旧路径复活、无读取失败、无形状漂移 | PASS |
| 毒值容器（N=2000） | `readArray n=2` / `n=3 desc` | 成功腿：仅物化 2 项 + total=2000；失败腿：首物化项 fail-fast `PATH_NOT_ALLOWED`、path 精确到项 | `kept 2/total 2000`（truncated:true）+ `['workRecords',1999]` fail-fast——两者均与 HEAD 逐字节一致 | 无半窗、无静默跳项、无全量物化（value.length=2） | PASS |

## Error and Cleanup Flow

- **错误传播**：全部失败码经 lease 原样透传且与 HEAD 逐字节一致（§Preserved 失败面行）；
  E4 入选毒项 fail-fast 无半窗（`value`/`total` 键均不在失败结算上）。
- **清理时序**：S1/S1b 每例 `lease.release()` → `persistence.dispose()`；S2 `release → flush →
  dispose → 重开 → release → dispose`，全部正常结算（探针 4/4 绿、无未决句柄告警）。
- **探针自身清理**：见 §7（工作树恢复至 SA3 实现态原样，`.worktrees/` 清空）。
- **发现的非 #381 发散面**（登记，不判负）：S2 重启往返中恰 3/33 样本发散（`M-root-full`、
  `raw-hostile`、`F-sparse-hole-failfast`）——根因是 fixture 的**非 JSON 安全 plain 数据**
  （稀疏数组空洞、enumerable accessor）经 Yjs 快照编码后输入本身变化（空洞→null、
  accessor→数据值）；窗口读如实报告变化后的输入（发散均在姊妹 `read.ts` 物化 message 与
  raw 值面，两文件零 diff）。该发散签名在 HEAD 与实现态**逐字节同款复现**
  （V4 复核 `S2:divergent-signature` HEAD===IMPL），为基线持久化语义，与本票变更零交集。

## Temporary Diagnostics

| 项 | 记录 |
|---|---|
| 添加 | 临时探针 1 份（`packages/namespace-registry/test/issue-381-sa7-livechain-probe.test.ts`，vitest 收集，仅消费公共面：lease/runtime seam/W1 公共原语/公共 persistence API；零源码插桩、零 `[SA7-DATAFLOW]` 运行时日志——现有观察点（结果联合 + 投影文本）已足以观察全部关键跳点）；HEAD worktree 1 份（`.worktrees/sa7-head-8a4fa40` + 其内探针副本 + 独立 node_modules）；/tmp dump 4 份 |
| 删除 | 探针双份已删；`git worktree remove --force` + `prune`（`.worktrees/` 空、`git worktree list` 无 sa7 条目）；`grep -rl sa7-livechain-probe packages/ wiki/` = 0 命中；`grep SA7-DATAFLOW` 于本任务 git-modified/new 文件 = 0 命中（80 个历史命中全部属于其他任务的冻结 SA7 报告） |
| 删除后复跑 | 移除探针后重跑聚焦 8 文件族 `--typecheck`：**144/144 绿、Type Errors: no errors、Errors 0**（与 SA3 focused 日志逐位一致）——移除诊断后结果不变 |
| git 状态复核 | `git status --short` = 恰 SA3 实现态（6 modified + 新 T 组测试 + SA3 artifacts + wiki 输入）；`git diff HEAD --stat` = 6 文件 +88/−374；无 stash、无 marker、无 `.worktrees` 残留 |
| artifactPaths | 临时物不入 artifactPaths（skill 红线）；留档仅 `wiki/raw/task_issue-381_sa7_report.md` + `artifacts/sa7-issue381-dynamic-verify.log` |

## Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA4 §11-1 / SA3 Deferred-1 | lease 端到端逐字节不变（registry 装配 + 真实 persistence） | 探针双跑 A/B（V1/V3） | 同输入 lease 四键（含 ✂）逐字节一致 | 106/108 一致；仅 2 差异 = W1 直调三键化（设计变更本体） | sa7-issue381-dynamic-verify.log V3 | PASS | 无 |
| SA4 §11-1 | 真实 persistence 全链路（非 stub） | S1/S1b `createMemoryPersistence`（realPersistenceScheduler）+ `registry.open` 生产装配；S2 `FilePersistence` 磁盘快照往返 | 链路成立且输出确定 | 全链路成立；S2 重启 33/33 逐字节一致；快照文件在场 | log V1/V4 | PASS | 无 |
| SA4 §11-2 / 设计 R-381-1 | E4 对抗场景不立约、不引入新读路径 | 本轮遵守（探针仅公共面，零 trap 装置、零断言） | 不判负 | 未触发 | — | N/A（边界维持） | 无 |
| Design §8.2-①②⑤ | W1 单源 total 贯通至 ✂/truncated | S1c 直调 + S1 lease + S1b 毒值 | 三键 + ✂ 承接同源计数 | 见 §Changed Data Flow | log V3/V4 | PASS | 无 |
| SA6 R1–R6（经 SA4 转承） | 既有 lease/composition 零改动全绿 | V5/V6 直跑 | 实现态 144/144；HEAD 基线 50/50 | 一致 | log V5/V6 | PASS | 无 |
| SA6 §12.8 敏感度（total 承重） | 变异防线 | SA3 artifacts 交叉核对（本轮不重复变异） | 变异 C 16/50 红 | sensitivity-mutations.log 在场且 SA4 已核 | artifacts/sa3-issue381-sensitivity-mutations.log | PASS（采信 + 本轮字节证据独立印证 total 消费真实） | 无 |
| 额外发现（本轮） | FilePersistence 往返对非 JSON 安全 plain 数据的输入变化 | S2 双跑 | —（无契约预期） | 3/33 样本发散，HEAD 同签名复现 → 基线语义 | log V4 divergent-signature | 记录 | 如需立约 → 新契约票（非本票） |

## Commands and Evidence

| # | 命令（要点） | 结果 |
|---|---|---|
| V1 | 探针双跑（实现态 / HEAD worktree `8a4fa40`，各自 `SA7_DUMP`） | 各 4/4 绿；dump 108 样本 ×2 |
| V2 | 实现态探针复跑 + `cmp` | dump 逐字节一致（确定性，零 flake） |
| V3 | 108 样本 HEAD↔实现态逐字节 A/B | **106 一致 / 2 差异**；差异恰 = `S1c:W1-{array,map}-direct` 两键→三键（total=3） |
| V4 | 关键样本抽取 + 跳点等价复核 | runtime 直面 ≡ lease（两面 `=== true`）；✂/失败/released/快照文件样本全留档 |
| V5 | 聚焦 8 文件族 `--typecheck`（探针移除后） | **8 文件 / 144 用例绿；Type Errors: no errors；Errors 0** |
| V6 | HEAD worktree 上 composition + lease 两文件 | **50/50 绿**（refactor 基线） |
| V7 | 临时物清理 + git 状态复核 | 全部移除；工作树 = SA3 实现态原样 |

## Deviations

1. **探针 poll 循环的类型措辞**（临时件内部）：`--typecheck` 下 vitest 报 8 条
   TypeCheckError（schema state 词表猜测 `loading/compiling`），全部指向探针自身行 90，
   不触及产品/既有测试；探针以 `--typecheck.enabled=false` 采证并在移除后以 V5 干净复跑
   收口（144/144、Errors 0）。
2. **S2 plain 数据发散**（§Error and Cleanup 登记款）：非 #381 行为差异（HEAD 同签名），
   不判负、不修改 fixture（属无关面 churn）。
3. **未复跑全仓门**（G1/G2）：SA7 不跑全仓回归（skill 边界）；SA3 full-gate artifacts
   经 SA4 核对采信，本轮以聚焦族 + typecheck 独立复证窗口面。
4. **未使用 HEAD symlink**：HEAD 基线采用独立 `pnpm install --offline`（避免 pnpm 相对
   symlink 静默解析到实现态），已在 §Runtime environment 记录理由。

## Verdict

**approve**。

- 设计声明改变的数据流按设计变化：W1 两面成功结算恰三键且 `total` 与 `value` 同一次枚举
  （`total=3` 双面实证）；组合层 ✂/truncated 消费 W1 单源计数；实现态与 HEAD 的全部
  108 样本中**恰 2 处差异 = 该设计变更本体**，无任何溢出差异。
- 设计声明保持的数据流保持不变：lease 公共面（恒四键 + ✂ 事实行 + 失败词表 + released
  短路）经真实 persistence + Registry 生产装配全链路 **106/106 逐字节一致**；FilePersistence
  磁盘快照重启往返 33/33 逐字节一致；既有契约族零改动全绿（HEAD 50/50 / 实现态 144/144）。
- 状态机转换正确、禁止状态未出现（released 短路先于透传、重启不复活旧路径、毒值零物化）。
- 错误与清理符合设计；临时诊断已安全清理并复核（移除后关键场景复跑结果不变）。
- SA4 点名的动态验证项（SA3 Deferred #1）关闭：lease 面端到端逐字节不变获本轮独立活体证明。
