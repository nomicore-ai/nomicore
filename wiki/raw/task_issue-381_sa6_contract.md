# SA6 诊断与验收契约 — issue #381 P1：W1 冻结解除与 total 下沉（ADR 0029 prefactor）

- 任务类型：**Refactor（前置重构票）+ 一处刻意加法的原语面形状变更**（W1 成功结算两键 → 三键）。
  不是 Bug 修复；行为除「doc-runtime 窗口原语成功结算多一个 `total` 键」外零变化
  （issue #381「What to build」L17；AC1–AC5 L21–L25）。
- 本报告路径固定为 `wiki/raw/task_issue-381_sa6_contract.md`；本轮**未**创建/修改任何生产实现或可执行测试
  （dispatch 明确「without implementation or executable tests」）——§12 给出可由实现票/复核票机械执行的验收契约。
- Verdict：`approve`（诊断可信、契约可执行、红/绿证据齐备；详见 §13–§16）。

---

## 1. Task type and inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-381.md`（Host-owned） | 在场（32 行；What to build + AC1–AC5 + Blocked by: None） |
| `wiki/raw/task_issue-381_relevant_decisions.md` | **不存在**（`ls wiki/raw | grep 381` 仅命中简报） |
| `wiki/raw/task_issue-381_conflict_report.md` | **不存在** |
| SA8 设计/评审产物（`task_issue-381_design*.md` 等） | **不存在**；无既有 SA6 报告可原位修订 |
| Owner comment | 无（简报「## Comments」段空；dispatch 记录 REST comment 读回无评论） |
| 规范依据 | `docs/adr/0029-filtered-window-read.md` §1/§5/§6/§8；`docs/adr/0028-window-read.md` §7/§8 |
| 历史证据（非规范） | `wiki/raw/task_issue-368_*`（W1 交付 + 复制纪律）、`wiki/raw/task_issue-369_design.md` §13 R2（计数下沉 follow-up 的出处） |

任务类型判定依据：票面自称「这是 ADR 0029 的前置重构票」；目标状态 = 原语结算增键 + 组合层收缩，
不修复任何故障。ADR 0029 §8（L65–70）把该 follow-up 写成「解除 doc-runtime 窗口原语的包范围冻结：
`window.ts` 原地扩 where 与 total；S4 候选计数自 namespace-runtime **下沉**进 W1（枚举 / 过滤 / 计数同源）；
runtime 删除 S4 与全部出处标记镜像复制件……收缩为纯组合层」。本票只执行其中的 **total 下沉 + 镜像清账**，
`where` 留待后续票。

## 2. Owner comment mapping

无 owner comment（简报 Comments 段空，且本 dispatch 明确「REST comment read returned no comments,
so there are no additional owner requirements」）。因此验收面 = 简报 AC1–AC5 逐字 + ADR 0029 §5/§8 的规范约束，
无额外 owner 口径可映射。§12.2 给出 AC ↔ 验收面映射。

## 3. SA8 constraints（无 SA8 产物时的替代约束面）

无 SA8 设计产物在场，等效约束面取：

1. **ADR 0029 §5（L45–53）**：W1 成功结算形状 = `{ ok: true, value, total: number | undefined }`，
   `total` 键**恒在**；无 `where` = 零值域标识计数（= ADR 0028 现状语义）；有 `where` = `undefined`。
   本票无 `where` ⟹ 本票的 `total` **恒为计数数值**（不得为 `undefined`）。
2. **ADR 0029 §8（L65–70）**：解冻 `window.ts`；S4 计数下沉；删除 S4 与全部出处标记镜像复制件
   （点名 `navigate`/`navClassify`/`probeRoot`/`carrierOf`/`readableOwnDataValue` 等）；W1 成功形状变化
   牵动 doc-runtime 窗口测试家族断言的机械迁移。
3. **ADR 0028 §7（L63）/§8（L70–73，lease 面规范不变）**：lease 恒四键
   `{ok,value,schema,truncated}`；`truncated === kept < total`；✂ 段承载窗口事实；未入选子项零物化。
4. **#369 设计 §13 R2（L396–400）**：计数镜像的层间张力 = 已登记 follow-up（本票执行）；
   缓解前提 = 独立预言机边界矩阵（不得删除）。
5. **包边界**（`packages/doc-runtime/AGENTS.md` / `packages/namespace-runtime/AGENTS.md`）：
   公共 API 只经 `src/index.ts`；读不进写 sequencer；公共面只暴露 detached 投影。

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| Worktree | `/home/wangjian/nomicore-fix-issue-381`（一次性 dispatch；工作树干净，唯一未跟踪文件 = Host 提供的 `wiki/raw/task_issue-381.md`） |
| HEAD | `8a4fa404076afdae9d974c1ad15bd985e24d58ac`「ADR 0029 过滤窗口——窗口读 where 词表演进（设计基线）」（= PR #380 设计基线；`where` 实现不在场） |
| 依赖 | 本 worktree 初始无 `node_modules`；`pnpm install --offline --frozen-lockfile` → 65 包复用 store，exit 0 |
| 工具链 | node v24.13.0；pnpm 10.28.2；vitest 3.2.7；tsx 4.23.12；typescript 5.9.3；yjs 13.6.32 |
| 运行器 | root `pnpm test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；`maxWorkers: 1`；include = `packages/*/test/**/*.test.ts` 等 |
| 基线（聚焦窗口家族，5 文件） | **114 passed / 0 failed**（doc-runtime 契约 47 + pins 11 + public-surface 6 + namespace-runtime 组合 17 + namespace-registry lease 33）；两次运行一致（1.80s / 1.74s） |
| 基线（全仓，实现前） | `pnpm typecheck` **exit 0**；`pnpm test` **exit 0**：392 文件 / 4730 用例全绿、typecheck no errors（624.18s） |
| 基线（带类型检查的聚焦运行） | 3 个 .test.ts + 2 个 .test-d.ts → 5 文件 / 79 用例（含 `✓ TS` 13 + 2）全绿，typecheck no errors |

## 5. Positive reproduction（目标契约在 HEAD 处为红；红因 = `total` 键缺席）

诊断探针（`/tmp/sa6-381-probe.ts`，一次性、非仓内测试；HEAD 实跑）：

| 观察 | HEAD 实际 | 目标契约 | 结果 |
|---|---|---|---|
| array 面成功结算 own 键集 | `["ok","value"]` | `{ok,value,total}` | **FAIL**（红） |
| map 面成功结算 own 键集 | `["ok","value"]` | `{ok,value,total}` | **FAIL**（红） |
| array 面 `total === 容器 length`（3） | `total === undefined` | `3` | **FAIL**（红） |
| map 面 `total === 非 undefined 键数`（3） | `total === undefined` | `3` | **FAIL**（红） |
| 失败结算 own 键集 | `["code","message","ok","path"]` | 不变 | PASS（负控，见 §6） |
| fixture 健全（值/序正确） | 条目 `[{index:0,value:10},{index:1,value:20}]` | — | PASS（红不来自 fixture） |
| 零物化基线（尾部毒值未入选） | `ok:true` | — | PASS（红不来自入口/环境） |

类型层探针（一次性 `packages/doc-runtime/test/__sa6_381_type_probe.ts`，运行后已删除）：

```
error TS2344: Type 'false' does not satisfy the constraint 'true'.   (keyof ArrayOk)
error TS2344: Type 'false' does not satisfy the constraint 'true'.   (keyof MapOk)
error TS2322: Type 'true' is not assignable to type 'false'.          (×2)
```

即 `Equal<keyof Extract<ReadArrayWindowResult,{ok:true}>, 'ok'|'value'|'total'>` 在 HEAD 为 `false`，
`ReadMapWindowResult` 同款 —— 目标类型契约在 HEAD 处红，红因与运行时红因同一（成功成员缺 `total` 键）。

结构缺口（`grep`/实读，非行为断言，仅为影响面清点）：
`packages/namespace-runtime/src/window-read.ts` 仍持有 S4 计数（`countWindowCandidatesAtPath` L412–433、
`countMapEntries` L435–447、`countingDefectFailure` L468–474）与 W1 出处标记镜像复制件整块
L476–742（**267 行**；`copied from window.ts@ab6e390` / `carrier.ts@ab6e390` 标记 **11 处**：
L478/488/493/498/504/522/535/553/671/706/722）。

## 6. Negative control（当前全绿；实现后必须保持全绿）

| # | 负控 | 现状证据 |
|---|---|---|
| NC1 | 姊妹 `readLogicalValueAtPath` 成功面仍恰两键 `{ok,value}`（窗口增键不回渗姊妹） | `issue-368-...-contract-red.test.ts` W1-NC1（L793–802）绿；探针 PASS |
| NC2 | 姊妹预算成功面仍恰四键 `{ok,value,truncated,truncations}` | 同文件 W1-NC3（L813–820）绿 |
| NC3 | 窗口失败结算形状不变：`{code,ok,path,message}` 四键、三码 + `PATH_NOT_ALLOWED`、无 `value`/`total` | pins P7 失败半（L334/L337）绿；lease F1/F2/E4 绿；探针 PASS |
| NC4 | 未入选子项零物化：尾部毒值 + `n=2` → `ok:true` | 探针 PASS；lease E3（N=2000，`kept 2/total 2000`）绿 |
| NC5 | lease 恒四键 + 独立预言机 total/truncated/✂ 一致 | composition S4 矩阵（L252–325）+ lease T1–T7 绿 |
| NC6 | doc-runtime 公共值导出集不变（两枚窗口值导出） | `public-surface-guard.test.ts` P-W1/P-W2（L65–77）绿 |
| NC7 | registry lease 透传 ≡ runtime（`toStrictEqual`） | lease F6（L783–800）绿 |

## 7. Stability, scale and timing

- 全链路同步、单 Y.Doc、无网络/无服务/无时钟依赖；`maxWorkers: 1`。聚焦窗口家族两次运行结果逐项一致（0 flake）。
- 规模哨兵：E3 的 N=2000 毒值容器（`n=2` → `ok:true`、`total` 必须仍为 2000）——任何「为拿 total 而物化」
  的实现必红（ADR 0028 §8 成本纪律的既有哨兵，本票不得削弱）。
- 计数成本：`total = candidates.length` 由 W1 既有 O(N) 枚举（`enumerateArrayCandidates` /
  `enumerateMapCandidates`，决策 8）顺带产出，零额外遍历、零额外物化；无 `where` 的标识计数不需要额外全扫
  （`where` 在场时「匹配总数不承诺 / 计数不可短路」的语义属后续票，ADR 0029 §5）。
- 时序/并发条件：`runtime.ts` S2 → `window-read.ts` S3 → S4 全同步，中间无 await/yield；唯一可在两次导航间
  运行的用户代码是 options 的 Proxy/descriptor trap（见 §9-E4），既有契约不覆盖该对抗场景。

## 8. Root-cause chain / capability gap chain

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 1（症状） | W1 成功结算缺 `total`；计数权在组合层 | `window.ts` L97–100 / L116 / L130（`{ok:true, value}`）；`window-read.ts` L162–164（S4 自算） | 高（源码 + 探针实跑） |
| 2（直接故障点） | W1 枚举完成的候选空间没有随结算携带，组合层只能再导航一次独立计数 | `window.ts` `windowCore` L189–208；`window-read.ts` `countWindowCandidatesAtPath` L412–433 | 高（源码） |
| 3（为什么存在） | #368 的**包范围冻结**把 `window.ts` 钉为不可改，组合层被迫以出处标记镜像复用导航/分类并自算计数 | `window.ts` 头注 L27–29；`window-read.ts` 头注 L35–38；#369 设计 §13 R2（L396–400 预知并接受该成本） | 高（文档 + 11 处镜像标记） |
| 4（触发条件） | ADR 0029 §8 解除冻结并要求 total 下沉；本票 AC1–AC5 执行 | ADR 0029 L65–70；简报 L17/L21–25 | 高（规范） |
| 5（放大因素） | 双份计数空间（W1 枚举 vs S4 计数）在对抗性 options trap 下可漂移：lease 的 `truncated`/✂ 描述「另一个快照」 | §9-E4 实跑：`kept 3/total 4` 而 `value` 取自 3 项快照 | 高（实跑） |
| 6（最深根因） | **计数权威归属错层**：候选标识计数应属载体级原语（枚举/过滤/计数同源），当前由组合层第二次导航复算 | ADR 0029 §8「S4 候选计数自 namespace-runtime 下沉进 W1（枚举 / 过滤 / 计数同源，消除『W1 数的候选集 ≠ runtime 数的匹配集』接缝漂移）」 | 高（规范 + §9-E2/E4 因果实验） |
| 7（未证实假设） | 无承重未证实假设。`total` 声明类型取 `number` 还是 `number \| undefined` 属实现期设计自由（§15-O1） | — | — |
| 8（排除项） | 不是 `where` 缺陷（HEAD 无 where）；不是 lease/registry 缺陷（透传与组合面零改动）；不是 fixture/环境/入口问题（§5 探针与 §6 负控） | 简报 L17「行为除……外零变化」 | 高 |

---

## 9. Causal experiments（控制变量 / 反证；全部已回滚，证据见 §16）

**E1 — HEAD 观察探针**（`/tmp/sa6-381-probe.ts`）：见 §5 表。红因 = `total` 键缺席，红不来自 fixture/环境/入口
（同探针内三项负控 PASS）。

**E2 — 变异 A：组合层 `total := kept`**（`window-read.ts` `const total = counted.total;` → `const total = kept;`，
一次性改动）：

```
Test Files  2 failed (2)   Tests  16 failed | 34 passed (50)
```

红面覆盖 lease A1/A2/A4、T 组（✂ 事实行/truncated/边界矩阵）与 composition S3 正常面、S4 矩阵、S5 无 schema 面、
E3（`kept 2/total 2000`）。结论：`total` 在 lease 面**承重可观察**（`truncated` + ✂ 事实行 + 恒四键形状 helper），
被删的 S4 语义必须被 W1 单源等价承接。

**E3 — 变异 B：模拟实现目标形状（原语成功面加 `total`，但值取 `entries.length` 这一**错**语义）**
（`window.ts` 两入口成功字面量各加 `total: (core.value as unknown[]).length`）：

```
Test Files  1 failed | 2 passed (3)
✗ W1-P7 … > P7 成功恰两键 {ok,value}；失败恰四键 {code,ok,path,message}
  AssertionError: expected [ 'ok', 'value', 'total' ] to strictly equal [ 'ok', 'value' ]
```

结论（两条）：① P7 是**唯一**两键锁（其余 63 用例——47 契约 + 10 pins + 6 守卫——对加法键不敏感，迁移面窄且机械）；
② HEAD 测试家族**不校验 total 的值**（错语义照样绿）⟹ §12.3 的独立预言机断言是必需增量，否则实现可伪绿。

**E4 — 漂移探针（单源必要性的行为证据）**（`/tmp/sa6-381-drift-probe3.ts`；经 `createNamespaceRuntimeWithSeam`
构造真实 runtime，`workRecords` 3 项、options = `{n:3}` 的 Proxy，在 descriptor 第 3 次调用——即 S3 canonical 重读、
W1 已结算之后——向容器 push 第 4 项）：

```
doc length before read: 3 | mutated at descriptor call: 3 | doc length after read: 4
lease result: {"ok":true,"value":[3 项：index 0,1,2],"schema":"… ✂ 截断事实：\n- workRecords · 窗口 · 基 index asc · kept 3/total 4\n","truncated":true}
```

HEAD：`value` 取自 3 项快照，`truncated`/✂ 却按 4 项快照叙述（S4 第二次导航）。下沉后 `total` 与 `value` 同一次
枚举产出 ⟹ 期望 `total=3`、`truncated:false`、无 ✂ 块。该差异**不在既有契约覆盖面**（既有测试零语义改动仍全绿），
属「单源」带来的对抗场景一致性修正；§12.9 将其登记为**非阻断边界**，不作断言（避免把改进误报为回归）。

**E5 — 类型探针**：见 §5；证明 §12.4 的类型锁在 HEAD 为红。

**回滚证据**：E2/E3 改动均已 `git checkout --` 还原；E5 探针文件已 `rm`；三个还原检查点 `git status --short` /
`git diff --stat` 仅剩 Host 简报未跟踪，`npx tsc -p packages/doc-runtime/tsconfig.json` exit 0，聚焦 114/114 复绿。

## 10. Impact surface

| 面 | 位置（HEAD 行号） | 本票动作 |
|---|---|---|
| W1 公共入口 | `packages/doc-runtime/src/window.ts` L109–117（array）、L123–131（map） | 成功字面量加 `total`（与 `value` 同一次 `windowCore` 产出） |
| W1 内部结算 | `window.ts` `windowCore` L166–213（枚举 L189、`kept` L196、成功返回 L208）、`WindowCoreResult` L139 | 成功成员携 `total = candidates.length` |
| W1 结果类型 | `window.ts` L97–100（两联合成功成员） | 增必填 `total`（本票无 where ⟹ 恒数值；ADR 0029 §5 终态为 `number \| undefined`，见 §15-O1） |
| W1 公共面守卫 | `packages/doc-runtime/src/index.ts` L48–63；`public-surface-guard.test.ts` | 值导出零变化（类型成员加法；守卫无需改） |
| 组合层 S4 | `packages/namespace-runtime/src/window-read.ts` L162–164、L400–447、L468–474 | **删除**计数与防御失败构造 |
| 组合层镜像 | 同文件 L476–742（11 处 W1 出处标记） | **删除**导航/分类/键空间镜像；保留件（`safePathCopy`、`windowFailure`、`seamWindowOptionsInvalid`、`foldSegment`）重述非冻结理由 |
| 组合层签名 | 同文件 `composeArrayWindowRead`/`composeMapWindowRead`（L109–146）、`WindowComposeInput`（L93–104）、S6（L177–183） | 改为消费 W1 结算的 `total`（`doc` 不再用于计数；内部签名自由） |
| runtime 消费点 | `packages/namespace-runtime/src/runtime.ts` L676–702（L687–689、L699–701） | 把 W1 成功成员的 `total` 一并交给组合层；JSDoc L678 的「S4 O(N) 计数」同步清理 |
| registry lease | `packages/namespace-registry/src/lease.ts` L309–315；`types.ts` L468–482 | **零改动**（原样透传 runtime 四键联合） |
| 类型层 | `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` L32–49/L85–90；`packages/namespace-registry/test/issue-369-window-read-lease-surface.test-d.ts` L43–56 | 前者加 W1 三键锁；后者（lease 四键锁）**零改动** |
| 测试族 | doc-runtime #368 家族 | 两键 → 三键机械迁移 + total 预言机增量（§12） |
| 文档 | `window-read.ts` 头注（L1–39）、`runtime.ts` JSDoc、`issue-368-*-contract-red` 头注 B-5 | 措辞同步（W1 冻结解除 / 镜像纪律清账）；ADR 0028/0029、CONTEXT.md 已由 PR #380 写定，**无需改** |

**公共面结论**：doc-runtime 值导出集不变；lease/runtime 公共签名与四键成功面不变；唯一公共类型变化 =
doc-runtime 窗口结果联合成功成员增必填 `total`（ADR 0029 §5/§8 明示；消费者清点：全仓仅有
`namespace-runtime/src/window-read.ts`（`WindowReadFailure` 单源类型复用）与测试文件引用这些类型，
`runtime.ts` 只消费值通道——`grep -rn "ReadArrayWindowResult\|ReadMapWindowResult" packages apps domains` 实证）。

## 11. Ruled-out hypotheses

| # | 假设 | 结论 | 反证 |
|---|---|---|---|
| H1 | 「owner comment 有额外要求」 | 排除 | 简报 Comments 空 + dispatch 明示 REST 读回无评论（§2） |
| H2 | 「本票包含 `where` 实现」 | 排除 | `window.ts` 无 where 词表（L54–68 仅 n/orderBy/depth/maxChildrenPerNode）；ADR 0029 §8 把 where 的语义展开留在后续票 |
| H3 | 「两键锁在契约 helper B-5 里，迁移面很大」 | 排除 | `issue-368-...-contract-red` L84–90 显式允许额外字段；E3 实证仅 P7 红 |
| H4 | 「lease/组合面测试需要语义迁移」 | 排除 | 组合/lease 测试只比较 `.value`、失败成员或 lease≡runtime（L207/221/423/706/739/746/783–800），无「成功整对象 vs 原语成功整对象」断言；且成功面对比只走 lease↔runtime 同形 |
| H5 | 「HEAD 测试能抓住错误的 total 值」 | 排除 | E3：错语义 `total=kept` 下唯一红 = P7（键集），无值断言 |
| H6 | 「删 S4 会改变确定性行为（逐字节不变不成立）」 | 排除 | 全同步无 yield；确定性调用下 S4 计数 ≡ W1 候选数（枚举纪律逐位一致，§9-E2 对账）。唯一差异面 = 对抗性 trap 插入的文档变更（E4），属漂移修正 |
| H7 | 「`read.ts` 冻结也解除（可抽共享模块）」 | 排除 | ADR 0029 §8 只解冻窗口原语；`read.ts` 零 diff 纪律与 `copied from read.ts@36a73bb` 标记维持（`window.ts` L27–29/§11 DENY 先例） |
| H8 | 「三键断言会触发形状集中化门」 | 排除 | `readdata-shape-assertion-consolidation-gate.test.ts` 扫描域 = `namespace-runtime/test` + `namespace-registry/test`（L58–61）；doc-runtime 恰两键被列为**负样本**（L171–173、L195–197） |
| H9 | 「组合层可保留 S4 只做对账/防御」 | 排除（契约判负） | 票面 AC2 明示「不再持有候选计数逻辑与镜像复制件」；保留即违反结构契约（§12.6），且与「单源」根因相悖 |

---

## 12. Acceptance contract and test paths

> 契约纪律：全部断言锚定**运行时行为**（结果联合、own 键集、条目列表、✂ 文本、Y.Doc 值）；禁止源码字符串/正则
> 断言代替行为验证；禁止 skip/only/todo、env override、fallback、吞错；禁止以冻结 fixture 弱化。§12.6 的结构契约
> 单独标注为「结构性证据（非行为测试）」，不作为行为断言的替代。

### 12.1 绑定表与不变量（实现期不得漂移）

| 绑定 | 值 | 来源 |
|---|---|---|
| B-1 原语入口 | `readArrayWindowAtPath(doc, path, options)` / `readMapWindowAtPath(...)` | 既有公共面（#368）；本票不改名 |
| B-2 成功结算形状 | own 键集**恰三键** `{ok, value, total}`；`total` 键恒在 | AC1；ADR 0029 §5 |
| B-3 `total` 语义（无 where） | 候选**标识**计数：数组面 = `target.length`（Y.Array/plain array 同式，稀疏空洞计入）；键面 = 非 `undefined` 值键数（Y.Map `keys()` 中 `get(k) !== undefined`；plain object own-enumerable data 键且值非 `undefined`） | AC1；ADR 0029 §5；#369 §13 R2 对账先例 |
| B-4 `total` 与 `value` 关系 | `value.length === Math.min(n, total)`；`total` 与 `orderBy` 基（index/key/field）及 `depth`/`maxChildrenPerNode` 无关 | ADR 0028 决策 3/4/8；本票 AC1 |
| B-5 失败结算形状 | own 键集**恰四键** `{code, ok, path, message}`；三稳定码 + 透传 `PATH_NOT_ALLOWED`；无 `value`/`total` | AC1「失败结算形状不变」；#368 pins P7 |
| B-6 lease 公共面 | 成功恒四键 `{ok, value, schema, truncated}`；`truncated === kept < total`；✂ 事实行 `kept n/total N` 逐字节不变 | ADR 0028 §7；AC3 |
| B-7 单源 | lease 的 `total` 来自 W1 结算（与 `entries` 同一次枚举），组合层零重算、零镜像 | AC2；ADR 0029 §8 |
| B-8 类型面 | doc-runtime 两结果联合成功成员含 `total`；lease/runtime 类型与公共值导出集零变化 | AC3/AC4 |

### 12.2 Issue AC ↔ 验收面映射

| AC | 验收面 | 用例组（§12.3–12.6） |
|---|---|---|
| AC1 两面成功恰三键 + total 语义 + 失败形状不变 | 行为（doc-runtime 原语） | T1–T9、NC3 |
| AC2 组合层去计数/去镜像 + 注释清账 | 行为（S6 仍正确）+ 结构审计 | R1–R5、X1–X5 |
| AC3 lease 公共面逐字节不变 | 行为（既有组合/lease 测试零改动） | R1–R5、NC5–NC7 |
| AC4 doc-runtime 窗口测试家族两键→三键迁移 | 测试迁移 + 类型锁 | M1–M2、T1 |
| AC5 全仓 `pnpm typecheck` + `pnpm test` 绿 | 全仓门 | G1–G2 |

### 12.3 正向契约（行为断言；目标实现下必须绿，HEAD 下红）

对 `readArrayWindowAtPath` / `readMapWindowAtPath` 两入口、（Y.Array/plain array）×（Y.Map/plain object）四载体：

| # | 断言（运行时观察） | 期望 |
|---|---|---|
| T1 | 任一 `ok:true` 结算的 own 键集 | 恰三键；ADR 0029 §5 字面序 `['ok','value','total']`（等价允许：`Object.keys(...).sort()` = `['ok','total','value']`）；多一键/少一键即红 |
| T2 | `typeof total === 'number'` 且 `Number.isInteger(total)` 且 `total >= 0` | 本票恒真（无 where；不得出现 `undefined`/`NaN`/负数） |
| T3 | `total` ≡ 独立预言机（原生/Yjs 直数，零实现复用）：Y.Array `length`；plain array `length`（稀疏空洞计入）；Y.Map `[...keys()].filter(k => get(k) !== undefined).length`；plain object own-enumerable data 键且值非 `undefined` 数 | 逐位一致 |
| T4 | `value.length === Math.min(n, total)`，`n ≥ total` 与 `n < total` 两向 | 逐位一致 |
| T5 | 边界矩阵（沿 #369 S4/T7 矩阵，预言机对账） | Y.Array 全量（3/3）；空 Y.Array（0）；Y.Map 显式 `undefined` 值键（k1,k2=undefined,k3 → 2）；plain object `{a,b:undefined,c}` → 2；plain object accessor/non-enumerable → 1；空 plain object → 0；空 Y.Map → 0；稀疏 plain array → `length`（4，n=1 避开空洞物化）；ROOT 面 `[]` → 9（沿用 #369 fixture 的 ROOT 键数） |
| T6 | 排序基不变性：同一容器 `index`/`key`/`field` × `asc`/`desc` 各向 `total` 恒定（`total` 不随排序/方向变化） | 恒定 |
| T7 | 预算轴不变性：`depth`/`maxChildrenPerNode` 在场或缺席时 `total` 恒定（预算只影响物化，不影响候选计数） | 恒定 |
| T8 | 零物化哨兵（原语面）：Y.Array = `[30,10,NaN×1998]`，`n=2` → `ok:true`、`value.length=2`、`total=2000`（任何「为 total 全量物化」实现必红） | 逐位一致 |
| T9 | 失败面（三码 + `PATH_NOT_ALLOWED`）：`WINDOW_TARGET_ABSENT`（缺键/越界）、`WINDOW_CARRIER_MISMATCH`（载体不符）、`WINDOW_OPTIONS_INVALID`（n=0/非法词表）、入选项物化失败透传 `PATH_NOT_ALLOWED`；失败 own 键集恰四键、`'value' in r === false`、`'total' in r === false` | 形状与语义均不变 |

### 12.4 迁移契约（AC4：两键 → 三键，机械、可枚举；本轮未改测试文件）

| # | 位置 | 迁移动作 |
|---|---|---|
| M1 | `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts` L325–338（P7） | 成功半 `Object.keys(ok)).toStrictEqual(['ok','value'])` → `toStrictEqual(['ok','value','total'])`（ADR 0029 §5 字面序；等价允许 `.sort()` + `['ok','total','value']`）。失败半两处四键断言**零改动**。E3 实证：不迁移即在此处红（红因 = 新增键，正是形状变更） |
| M2 | `packages/doc-runtime/test/public-surface-type-guard.test-d.ts`（L32–49 导入 / L85–90 声明处） | 增类型锁：`AssertTrue<Equal<keyof Extract<ReadArrayWindowResult,{ok:true}>, 'ok'|'value'|'total'>>`、`ReadMapWindowResult` 同款（HEAD 红，见 §5 E5） |
| M3 | `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` 头注 B-5（L29–31） | 措辞同步「B-5 曾不锁键集；三键锁现由 P7 + 类型锁承载」（注释级，非断言） |
| M4 | `packages/namespace-runtime/test/**`、`packages/namespace-registry/test/**` | **零改动**（AC3；`git diff --stat` 应为空）。若实现期发现某断言只在 W1 形状上耦合，先报设计修订，不得就地把期望改软 |

### 12.5 回归契约（AC3：lease 公共面逐字节不变；必须保持绿）

| # | 断言 | 执行面 |
|---|---|---|
| R1 | lease/runtime 成功恰四键 `{ok,value,schema,truncated}`（集中化 helper `expectReadDataOkKeys`） | #369 lease A1/A2、runtime S5 等 |
| R2 | `truncated === value.length < 独立预言机 total`；✂ 段仅在 truncated ∧ schema 非 null 时装配 | #369 lease T1–T7、composition S4 矩阵 |
| R3 | ✂ 事实行 Byte 级不变：`- workRecords · 窗口 · 基 index desc · kept 2/total 3`、`- tasks · 窗口 · 基 field:priority desc · kept 2/total 3`、`- [] · 窗口 · 基 key asc · kept 2/total 9`、`kept 2/total 2000` | 既有常量与断言逐字 |
| R4 | 失败透传 ≡ 直调 W1（`toStrictEqual`；既有 lease 用例 E4/F1/F2）；released / lifecycle≠ready 成员不变（F3/F4/F5） | 既有 lease 测试 |
| R5 | registry lease ≡ runtime 逐字段（F6）；lease 类型别名/第二参必填/词表 fail-closed 类型锁不变 | 既有 lease-surface.test-d |
| R6 | 组合式 depth 等价锚（入选项 ≡ 同预算 `readData(项路径)` 正文）与 schema 锚链零漂移 | composition S5 oracle 组 |

### 12.6 结构契约（AC2：组合层纯净；结构性审计，非行为测试，不得替代 §12.3/12.5）

审计命令与期望（由实现票记录原始输出，SA4/SA9 复核）：

| # | 审计 | 期望 |
|---|---|---|
| X1 | `grep -n "countWindowCandidatesAtPath\|countMapEntries\|countingDefectFailure" packages/namespace-runtime/src/*.ts` | 0 命中 |
| X2 | `grep -n "copied from window.ts@ab6e390\|copied from carrier.ts@ab6e390" packages/namespace-runtime/src/window-read.ts` | 仅失败构造仍需的 `safePathCopy` 至多 1 命中，且注文已重述（不再声称 W1 冻结/镜像纪律）；`copied from carrier.ts` 归零 |
| X3 | W1 镜像函数名全量消失：`navigate`、`navClassify`、`absentNav`、`notAllowedNav`、`classifyArrayTarget`、`classifyMapTarget`、`describeCarrierWord`、`carrierOf`、`probeRoot`、`readableOwnDataValue`、`readableArrayElement`、`isNonNegInt`、`segMsg`、`yjsWord`、`isPlainRecord` | 0 命中（`foldSegment` 例外——其出处是 `read-schema-projection.ts`，非 W1 冻结面，保留） |
| X4 | `window-read.ts` 体量收缩：L476–742（267 行）镜像整块中，除失败构造仍需的 `safePathCopy`（L479–486）外全部函数删除；S4 块 L400–447、L468–474 删除 | 行数单调下降；无「保留但注释掉」的复制件 |
| X5 | 头注/JSDoc 清账：`window-read.ts` 头注 L1–39、`runtime.ts` L676–681、`issue-368-*-contract-red` B-5 | 「W1 冻结 / 镜像纪律 / S4 计数」措辞不再出现在现行契约描述中 |

### 12.7 负控（必须保持绿；§6 同表）

NC1–NC7（§6）。特别地：NC1/NC2 证明增键不回渗 `readLogicalValueAtPath`；NC4 证明零物化纪律未因 total 破坏；
NC6 证明值导出面纯加法纪律未破。

### 12.8 敏感度与反伪绿防线

| 变异 | 必须击穿 | 证据基础 |
|---|---|---|
| 原语 `total := value.length`（少算截断）或 `total := total + 1` / 负数 / `undefined` | T2–T5、T8 | E3 已证 HEAD 面不敏感 ⟹ 新断言必需 |
| 原语为拿 total 物化全部候选 | T8（N=2000 毒值 + n=2 必须 `ok:true`） | E3 语义；ADR 0028 §8 |
| 原语 total 按 `where` 后匹配数算（提前实现过滤语义） | T3/T5（无 where 时应为标识计数） | ADR 0029 §5 |
| 组合层保留 S4/镜像（结构回流） | X1–X3 | AC2 |
| 组合层 `truncated := false` 或 `total` 用 kept 顶替 | R2、R3 | E2（16 红实证） |
| lease 面加第五键 / 改四键集 | R1、R5 | #369 既有断言 |
| 把期望对象与实际从同一构造器派生（伪绿） | 禁令：total 断言必须使用**独立预言机**（原生/Yjs 直数） | 仓内 `readdata-ok-shape.ts` 头注反伪绿不变量先例 |

### 12.9 测试路径与红线（本轮未创建；供实现票落地）

| # | 路径 | 动作 |
|---|---|---|
| P1 | `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts` | M1（P7 三键迁移） |
| P2 | `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | M2（类型锁） |
| P3 | `packages/doc-runtime/test/issue-381-window-total-red.test.ts`（推荐新文件；或并入 #368 契约文件） | §12.3 T1–T9 新增用例组 |
| P4 | `packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts`、`packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`、`.../issue-369-window-read-lease-surface.test-d.ts` | **零改动**（AC3 回归面） |
| P5 | 结构审计输出（X1–X5） | 记入实现票/复核票 artifacts（如 `artifacts/sa3-issue381-*.log`） |

**边界与非目标（不得越界）**：不加 `where`（词表/校验/语义均不动）；不改 `readLogicalValueAtPath`；
不改 `readData`/预算四键；不改 ADR 0028 四键语法与 ✂ 文法；不改 `read.ts` zero-diff 纪律；
不做「count 能力 / n=0 计数探针」；不新增公共值导出。
**非阻断边界（登记不判负）**：E4 对抗场景下 lease 的 `truncated`/✂ 从「与 value 不同快照」修正为「同源一致」——
既有契约零覆盖，属单源带来的严格改进；实现票不得为实现该一致性引入新读路径，也不得专门为此写断言。

### 12.10 Red/green 判定

- **T 组（§12.3）在 HEAD 红**（红因 = `total` 键/值缺席，实证 §5）；目标实现后绿。
- **M1/M2 在 HEAD 红**（两键锁/类型锁）；迁移后绿。
- **R 组（§12.5）在 HEAD 绿**，目标实现后**必须仍绿且测试文件零 diff**（refactor 基线：不伪称红灯）。
- **G1/G2 全仓门**：目标实现后 `pnpm typecheck` / `pnpm test` exit 0。

---

## 13. Red/green evidence

| 证据 | 命令/位置 | 结果 |
|---|---|---|
| HEAD 原语成功键集（红基线） | `/tmp/sa6-381-probe.ts`（tsx） | `["ok","value"]`；三键/total-oracle 断言 FAIL（actual `total=undefined`） |
| HEAD 失败键集（负控绿） | 同上 | `["code","message","ok","path"]` PASS |
| HEAD fixture/零物化（负控绿） | 同上 | 值/序正确、毒值尾部 `ok:true` PASS |
| HEAD 类型锁（红基线） | 一次性 `__sa6_381_type_probe.ts` + `tsc -p packages/doc-runtime/tsconfig.json` | TS2344/TS2322（已删除探针；删除后 tsc exit 0） |
| HEAD 两键锁确为唯一 | pins P7（L325–338），当前绿 | E3 变异下唯一红（`expected ['ok','value','total'] to strictly equal ['ok','value']`） |
| total 承重（回归契约有牙） | E2 变异（16/50 红） | 已回滚复绿 |
| lease 面既有基线 | 聚焦 5 文件 | 114/114 绿（两次），与全仓 392 文件/4730 用例绿一致 |
| 单源必要性（漂移） | E4 探针 | HEAD `kept 3/total 4` vs value 3 项快照 |
| 期望实现后的绿面 | §12.3/12.4 目标断言 + 全仓门 | 待实现票执行（本票不实现） |

## 14. Runner trigger evidence

| 运行器入口 | 命令 | 实测 |
|---|---|---|
| 聚焦（无类型检查） | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run <5 个窗口文件> --typecheck.enabled=false` | 5 文件 / 114 用例绿（1.80s、1.74s 两次） |
| 聚焦（含 .test-d 类型检查） | `... npx vitest run <3 个 .test.ts> <2 个 .test-d.ts> --typecheck` | 5 文件 / 79 用例绿，`✓ TS` 13+2，typecheck no errors |
| 全仓门（AC5） | `pnpm typecheck`；`pnpm test` | exit 0 / exit 0；392 文件 / 4730 用例；624.18s |
| 采集规则 | `vitest.config.ts` include `packages/*/test/**/*.test.ts` + typecheck.include `packages/*/test/**/*.test-d.ts`（tsconfig `./tsconfig.typecheck.json`） | 新文件按既有命名（`issue-381-*-red.test.ts` / `*.test-d.ts`）自动被采集，无需改配置 |
| 别名/条件 | `NODE_OPTIONS=--conditions=nomicore-source` + vitest alias `@nomicore/*` → `src/index.ts` | 源码态运行实证（探针与测试同一解析链） |

## 15. Unknowns and blockers

- **O1（设计自由，不阻塞）**：本票 `total` 的**声明类型**取 `number`（最小足迹；P2 引入 where 时按 ADR 0029 §5
  加宽为 `number | undefined`）或预加宽为 `number | undefined` 均可接受，**前提**是无 where 调用下运行时
  `total` 恒为数值（§12.3 T2 强制），且组合层不得以 `total ?? 0` 之类兜底掩盖缺席（S6 的 `truncated` 必须来自
  真实 total）。类型锁 M2 只锁键集，不锁该成员的具体类型。
- **O2（实现自由，不阻塞）**：组合层内部签名（`compose*(..., entries, total)` vs 传整个 W1 成功成员）、
  新用例文件命名（P3）、`windowCore` 内部结算字段名——均不影响本契约的可观察断言。
- **O3（后续票边界）**：`where` 在场时 `total=undefined`、✂ 永不装配、`truncated` 装满判定（ADR 0029 §5）
  **不属本票**；本票契约不得提前预占这些语义（T2 恒数值即其边界）。
- **O4（非阻断）**：E4 的对抗场景一致性修正无既有契约覆盖；已登记为边界，不要求断言。
- **无阻塞项**：诊断稳定复现、根因（权威错层）经规范 + 两向变异 + 漂移探针证实；契约红在正确原因、负控全绿、
  运行器真实可触发。**无需要 owner 决策的开放问题。**

## 16. Temporary diagnostics cleanup

| 临时物 | 位置 | 清理 |
|---|---|---|
| 变异 A（组合层 `total := kept`） | `packages/namespace-runtime/src/window-read.ts` | `git checkout --` 还原；`git diff --stat` 空 |
| 变异 B（原语成功面加 `total`） | `packages/doc-runtime/src/window.ts` | `git checkout --` 还原；`git diff --stat` 空 |
| 类型探针 `__sa6_381_type_probe.ts` | `packages/doc-runtime/test/` | `rm` 删除；删除后 `tsc -p packages/doc-runtime/tsconfig.json` exit 0 |
| 行为/漂移探针 | `/tmp/sa6-381-probe.ts`、`/tmp/sa6-381-drift-probe*.ts` | 仅存在于 `/tmp`（不入 worktree）；worktree `git status --short` 仅 `?? wiki/raw/task_issue-381.md`（Host 简报） |
| 依赖安装 | `node_modules/`（gitignored） | 保留（运行器需要）；无仓内跟踪物 |

还原后复核：聚焦 5 文件 114/114 绿；`pnpm typecheck` exit 0；`pnpm test` exit 0（392/4730）——
全部在还原后的干净 HEAD 上执行。

---

## Verdict

**approve**。

理由：① 目标能力缺口在 HEAD 处稳定复现并经运行时探针 + 类型探针双向证实（红因 = `total` 键缺席，非环境/fixture/入口）；
② 根因（计数权威错层 + #368 冻结下的镜像自算）由规范文本、11 处出处标记、两向变异实验与漂移探针共同证实，
最深根因与 ADR 0029 §8 的下沉要求逐字一致；③ 验收契约把 AC1–AC5 转成可执行断言面（原语三键 + 独立预言机 total 矩阵 +
失败形状 + lease 逐字节回归 + 结构清账审计），并给出负控、敏感度防线与真实运行器触发命令；
④ 既有测试面在 HEAD 全绿（Refactor 基线不伪称红），目标断言面在 HEAD 红且红因正确；
⑤ 无阻塞未知项（O1/O2 为实现期设计自由，已给判定边界）。
