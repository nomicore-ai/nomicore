# SA10 Spec 审查 — issue #436：doc-runtime 数组 fast path 接线与 S9 收窄（ADR 0033）

- 审查对象：已提交最终交付 diff，基线 = Parent PR #434 head `7407ce01367b6d7a3fe497cd78c4bcf085f3ddbb`
  （`git merge-base --is-ancestor` 实测确认为 HEAD 祖先），HEAD = `f61e5831c6d434b2410b3f5a744beaa24e08d07f`
  （`feat(doc-runtime): add array mutation fast path`）。
- Issue 要求来源：`wiki/raw/task_issue-436.md`（Host 简报；Issue REST comments = 空，**无 Owner 要求**）。
- 验收契约：`wiki/raw/task_issue-436_sa6_contract.md`（SA6 approve；8 红契约 + 17 绿负控 + B-1..B-6 锚）。
- 规范面：`docs/adr/0033-elementwise-yarray-mutation-validation.md`（决策 1–6）、ADR-0007 #237 修订节
  （含本票新增 ADR 0033 修订注记）、`CONTEXT.md` L144/L202、`packages/doc-runtime/AGENTS.md`、
  `docs/AGENTS.md` 义务句。
- 上游工件：SA1 设计（iteration 1）、SA2 复审（approve）、SA8 设计/实现双冲突报告（clear / clear +
  requiresConflictRecheck=false）、SA3 实现报告、SA4 静态审查（approve，2 MINOR 不阻断）。
- 审查方法：对 committed diff 逐文件核对（`git diff 7407ce0..HEAD`），与 Issue AC1–AC7、SA6 §12.2
  目标行为、ADR 0033 决策 1–6 逐条映射；复核证据日志（SA3/SA6 artifacts）与冻结面（md5/git status）。
  SA10 不运行测试、不启动服务；结论 = committed diff 静态核对 + 已留档验证证据的双向印证。
- 结论：**approve**（AC1–AC7 全部满足；唯一偏差 D-1 = SA6 绿色判据中「探针 exit 0 不变」句面在实现后
  结构性不可达，经 SA4 裁决为准则句面陈旧而非实现缺陷——**PR 必须披露**，见 §5）。

## 1. 交付面与范围核对（scope creep 检查）

committed diff 的交付代码/文档面（`git diff --name-only` 实测）恰为：

| 路径 | 角色 | 范围判定 |
|---|---|---|
| `packages/doc-runtime/src/mutation-local.ts` | 闸门 + fast path F1–F5 + VerifyPlan 类型面 | 设计 ALLOW 1 ✓ |
| `packages/doc-runtime/src/install-verify.ts` | 事实核抽取 + VerifyPlan/verifyPrepared | 设计 ALLOW 2 ✓ |
| `packages/doc-runtime/src/mutation.ts` | 类型面 + verifyPrepared 调用 + 阶段 C 判别 | 设计 ALLOW 3 ✓ |
| `packages/doc-runtime/src/extract.ts` | `carrierMismatchIssue` @internal 导出（单一构造助手） | 设计 ALLOW 4（条件项取「导出助手」一侧，未两端都改）✓ |
| `docs/adr/0007-…md` | ADR 0033 修订注记（纯追加 16 行，0 删改） | 设计 ALLOW 5（docs/AGENTS.md 义务句默认执行）✓ |
| `packages/doc-runtime/test/apply-validated-mutation-fatal-contract.test.ts` | 仅 W5 用例定向重锚（schema 文本 + 注释授权链） | 设计 ALLOW 6 ✓ |
| `packages/doc-runtime/test/issue-237-path-localized-validation-red.test.ts` | 仅对称面用例 + 局部常量 `TEXT_LIB_ITEM_UNION` | 设计 ALLOW 7 ✓ |
| `packages/doc-runtime/test/issue-436-array-fastpath-{contract,control,fixture}.ts` | SA6 验收契约三件套（随交付入库） | SA6 固定产物 ✓ |

其余为 `artifacts/` 证据日志与 `wiki/raw/` 流程工件（SA 流水线惯例，非交付代码）。

**冻结面实测零触碰**：`packages/vfsl/**`、`packages/doc-runtime/src/index.ts`（公共导出面）、
`CONTEXT.md`、ADR 0033、ADR-0010、信封面/guard 区（mutation.ts diff 无该区 hunk）、
`vitest.config.ts`/`tsconfig*`/lockfile。SA6 三件套 md5 复算 = SA3 记录值
（`2dd066f4…`/`c9e0e6c1…`/`8358d454…`），红灯经实现自然转绿，验收未被篡改。
`git diff --check` 净。**无 scope creep、无越界。**

## 2. AC 逐条判定（Issue 正文 × committed diff × SA6 契约）

### AC1 闸门正确：非 union `T[]` 走 fast path，union 数组目标回退 legacy —— **MET**

- 实现：`mutation-local.ts` L331–332 双条件合取 `plan.node.kind === 'array' && resolve(boundaryNode).kind === 'array'`
  （值侧 `plan.node` 经 descendValues 归一——union 数组目标此处为 `'union'`，探针 U1 钉死；
  结构侧提供 `.element` 供 detached 构造）；两树分歧（仅手造派生物可达）合取为假 → 回退 legacy
  （失败方向 = 多验证）。第三重锁：vfsl 接缝 `applyElementwiseArrayMutation` 对违约计划 fail closed。
- legacy 分支（L375–420）与 HEAD 逐字一致（仅 verify 包装 `{kind:'boundary',input:{…}}` 形变，
  SA8 实现后复查独立 diff 确认）；union 穿越在 `case 'union'` 零触碰；`planMutationBoundary` 零改动。
- 行为证据：契约 FA1–FA3（非 union 污染数组 insert/delete/批内 delete → `ok:true`）8/8 转绿；
  负控 NA1–NA4（union 数组目标/穿越永久 legacy：污染照旧拒绝零写入、区间外篡改照旧 E201-C、
  干净写照常）17/17 保绿（`artifacts/sa3-issue436-focused-final.log`：2 files/25 tests exit 0）。

### AC2 fast path 不再整数组提取/重建（O(n)→O(k) 等价证据）—— **MET**

- 实现：fast path F1–F5 无任何 `walk`/`applyMutationAtBoundary`/重投影调用；唯一元素读 =
  事实核同一性 `get(index+i)`×k；`target.length` 为 O(1) 载体属性（不经 get/toArray/forEach）。
- 等价证据（ADR 0033 决策 6 软验收允许）：契约 FB1/FB2 实测 append 读计数 **1**、delete **0**，
  n=512 与 n=4096 严格相等（≤8 预算内）；探针 G5 毫秒软证据 n=10³ 0.2ms vs n=10⁵ 0.3ms（×1.4，
  替代 HEAD 的 ×89.2/100× 规模）（`artifacts/sa3-issue436-probe-flip.txt`）。满足「以基准或等价
  证据证明耗时与 n 解耦」。

### AC3 越界检查基于 live 长度、域规则与 legacy 一致 —— **MET**

- 实现：F2 `beforeLength = target.length` 在任何元素读之前完成；F3 域规则经 vfsl 接缝
  `applyElementwiseArrayMutation(derived, plan, {length}, payload)`——越界 message/path 与 legacy
  逐字（接缝侧冻结交付，单一事实源，doc-runtime 零复制域规则）。
- 行为证据：契约 FB3 越界 insert/delete 读计数 **0**（≤4）+ 逐字 message/path
  （`array-delete 范围越界（不 clamp、不接受越界 no-op）` path `["items",512]`）；
  负控 NC1/NC2（逐字 + 零写入零 update）、NC4（`index===length`/`index+count===length` 照常接受，
  不 clamp、拒越界 no-op）保绿。

### AC4 commit 的 update 事件形态不变（复制与诊断捕获零回归）—— **MET**

- 实现：`commitPrepared`/`transactGuarded` 区零 diff；commit 对象形态与 legacy 同款
  （`target.insert/delete` 最小区间 edit）。
- 行为证据：负控 ND1–ND4（终态字节与 update 增量字节 ≡ 同 clientID 手写最小 edit；恰 1 个
  update 事件；同基态对端应用增量后逻辑值一致）保绿；探针 O 组（含 clear+rebuild 反证）保持 PASS。

### AC5 零写入：fast path 一切失败分支零写入、零 update 事件 —— **MET**

- 实现：F1（载体）/F3（越界、载荷域、新值校验）/F4（构造）一切失败在 `prepareLocalMutation` 内
  `return {kind:'fail'}`，先于任何 `transactGuarded`；无 write-then-undo 代码；批内聚合失败
  整体零写入（阶段 P/C 均在事务前）。
- 行为证据：负控 NC1–NC3（`encodeStateAsUpdate` 逐字节不变 ∧ update 事件数 0）、NA1/NA3 保绿。

### AC6 S9 收窄：fast-path 仅安装事实核；legacy 双核不变；E201 变体语义保持 —— **MET**

- 实现：`install-verify.ts` 步骤①逐字抽取为共享单实现 `verifyBoundaryInstallFacts`（E201-C
  四分支文案与 E201-D 包裹逐字保留）；新增 `VerifyPlan` 判别联合（`boundary` / `install-facts`）+
  `verifyPrepared` 分派器；fast-path 提交返回 `{kind:'install-facts', facts}`（无 proposedBoundary
  可比对——ADR 0033 决策 3）；`VerifyBoundaryIntactInput.proposedBoundary` 保持必填（拒绝
  「字段缺席静默跳核」形态）；legacy 五类构造点全包 `{kind:'boundary'}`；批量阶段 C 按
  `verify.kind !== 'boundary'` 跳折迭（引理 3 零命中依据注释在案，折迭输入侧 parsed 驱动不变）。
- 行为证据：契约 FC1/FC2（fast-path 区间外 observer 篡改不再 E201、静默通过）转绿；
  负控 NB1–NB3（fast path 上安装事实核保留：长度算术/插入项同一性 → E201-C，
  `phase='post-commit-verification'`、`committed:true`、DOCRT-E201 branded 断言）、
  NB4/NA2/NA4（legacy 双核不变）保绿。

### AC7 包测试 + 根 `pnpm typecheck` 与 `pnpm test` 绿 —— **MET**

- `artifacts/sa3-issue436-root-test.log`：根 `pnpm test`（`vitest run --typecheck`）**464 files /
  5647 tests 全绿，Type Errors: no errors，EXIT=0**（= SA6 post-contract 基线计数，失败面 8→0）；
- `artifacts/sa3-issue436-root-typecheck.log`：根 `pnpm typecheck`（15 包 tsconfig 链）**EXIT=0**；
- `artifacts/sa3-issue436-package-tsc.log`：`tsc -p packages/doc-runtime/tsconfig.json` **EXIT=0**；
- 两态判据（设计 §12）：`artifacts/sa3-issue436-reanchor-neutrality.log` 实现前态 = 重锚两文件
  47 passed + 失败面恰 = 契约 8 条（重锚实现中性实测）。

## 3. 规范符合性（ADR 0033 决策 1–6 与关联义务）

| 规范条款 | 判定 |
|---|---|
| 决策 1（闸门双条件；union 永久回退；规划层不动） | implements-existing-decision ✓（AC1 行） |
| 决策 2（live 长度 O(1)；域规则/issue 路径逐字；delete O(1)；最小 edit 不变；零写入先序） | ✓（AC2/AC3/AC4/AC5 行） |
| 决策 3（事实核原样保留；fast-path 省略重投影核；legacy 双核不变） | ✓（AC6 行；`VerifyPlan` 判别联合） |
| 决策 4（触达面 = 载体 + 变更区间；污染数组 delete 转成功；不补异步审计） | ✓（FA 组锚定；无任何审计代码新增） |
| 决策 5（逐元素可组成立法 + vfsl 一致性 fixture） | ✓（`packages/vfsl/**` 零改动，接缝冻结） |
| 决策 6（性能软验收，不钉毫秒） | ✓（结构性读计数 + 探针软证据，无毫秒阈值断言） |
| ADR-0007 #237 条款 1/4(ii)/7 陈旧句面 | ✓ ADR 0033 修订注记同变更集纯追加落地（L126–140），引文与条款原文逐字一致；作用域限定非 union `T[]`；union 与其余边界种类逐字保持 |
| ADR-0010 #237 后备句数组含义 | ✓ 已被 ADR 0033 决策 4 标题点名修订，文件零改动，引用链自洽（SA8 双报告裁决在案） |
| CONTEXT.md L144/L202 | ✓ 零改动（词条已随 ADR 0033 立法为目标态） |
| `packages/doc-runtime/AGENTS.md`（零写入；公共面只经 index.ts；写后失败 = fatal） | ✓ 新导出全 `@internal`（`carrierMismatchIssue`/`verifyBoundaryInstallFacts`/`VerifyPlan`/`verifyPrepared`），`src/index.ts` 零 diff，public-surface-guard 绿 |
| `docs/AGENTS.md` 义务句（行为变更→更新所有陈述契约变化的规范文档） | ✓ 注记默认执行未走豁免；SA3/SA8 双独立扫描证实陈旧面恰一处已闭合 |

## 4. 行为面差异（全部为 ADR 立法取舍，非回归）

| # | 差异 | 授权 | 锚定 |
|---|---|---|---|
| Δ1 | 非 union `T[]` 区间外元素污染不再阻断 insert/delete（`ok:true`，污染保留不修复） | ADR 0033 决策 4 | 契约 FA1–FA3 |
| Δ2 | fast-path 提交的区间外同事务 observer 篡改由 E201-C 变为静默通过 | ADR 0033 决策 3（已确认取舍） | 契约 FC1/FC2；事实核检出面向内保留（NB1–NB3） |
| Δ3 | 污染 ∧ 越界组合输入由报污染变为报越界（触达面收窄自然推论） | ADR 0033 决策 4 | 设计 §7.3；全仓扫描无既有用例钉旧次序 |
| 重锚 | 两条既有恒绿用例（W5 / issue-237 对称面）锚定载体迁移至 union 数组 legacy 永久拒绝面；seed/污染/操作/断言逐字未改，断言语义面零放宽 | ADR 0033 决策 1/4 + ADR-0007 注记（同批）；SA2 F-1 裁决、SA8 测试重锚授权专项裁决 | 两态 47 passed ×2 实测；意图锚（领域失败留 ok:false 联合 / 提取型边界内损坏响亮拒绝）存续 |

## 5. PR 必须披露的未达成项与偏差

1. **D-1（唯一偏差；非 AC 未达成，为准则句面不可达）**：SA6 契约 §12.2 第 8 条与 §13 绿色判据含
   「探针 exit 0 不变」。实现后该判据**结构性不可达**——探针 G 组 12 项断言的恰是「HEAD 现状 /
   fast path 未接线」这一能力缺口本身（探针头部 L5–L10 自标注），本票的实现正是关闭该缺口。
   实测探针 exit 1：38 checks = **26 PASS（U/S/O/N 组 + G2d，探针自标注「post-change 必须保持」
   的不变量面全绿）/ 12 FAIL（恰 = G 组，每条观测值逐条等于契约 §12.2 目标行为：
   `ok:true`、reads=1/0、`thrown=undefined`、×1.4）**。探针位于 `wiki/raw/`，不在 vitest
   include 面（SA6 §14），不构成 CI 门禁项；SA3 未修改探针/契约（修改即篡改变更前证据），
   SA4 §12 O-1 已裁决该句为准则句面陈旧而非实现缺陷。**建议 follow-up（非阻断）**：由
   acceptance-contract 角色另出变更后探针（G 组改写为目标行为断言）收口机器判据；n=10⁵ 毫秒面
   当前仅 ×1.4 软读数（ADR 决策 6 软验收允许）。
2. **ADR-0008 #237 镜像节括注**（SA8 可选编辑跟进，不阻塞）：「（O(1) 安装事实核 + O(boundary)
   重投影核）」为 #237 期 S9 组成摘要，fast-path 后非 union 数组提交为 install-facts 单核；
   该节授权链以 ADR-0007 为单一真相源且自身契约未变，不构成矛盾——如后续顺路修订可补半句
   对齐粒度。
3. **ADR 0033 已声明的让渡面登记**（非本票新引入，随实现生效）：raw-replication 污染检测面缩小
   （未触达元素不再被普通写发现）；E201 检测面收窄到变更区间；`array-delete` 被删元素前像不再
   免费获得（ADR 0033「不做什么」末条已登记为独立议题）。

## 6. 结论

**approve**——committed 交付忠实满足 Issue #436 正文 AC1–AC7 与 SA6 已批准验收契约的全部
行为锚（闸门双轨 / O(k) 结构性证据 / live 长度越界 / update 字节形态 / 零写入 / S9 收窄与 E201
语义保持 / 三门禁全绿），并对 ADR 0033 决策 1–6 为逐条 implements-existing-decision；范围严格
落在批准设计 ALLOW LIST 内，冻结面（vfsl、公共导出、SA6 三件套、母法文本、CONTEXT）md5/diff
级零触碰，无 scope creep。唯一偏差 D-1 为验收准则中一句与契约自身目标行为内部矛盾的判据措辞，
已按唯一正确读法处置并经 SA4 裁决，非实现缺陷；§5 三项为 PR 披露面，均不阻断合入。
