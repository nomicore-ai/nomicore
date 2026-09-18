# SA4 实现静态审查 — Issue #406 窗口面同轴：`readArray` / `readMap` 的 `maxBytes`

- 派发：`sa-60410bc7-ad05-419d-85f4-870571ca35d5`（role `mabf-sa4`，phase `implementation-review`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-406`（branch `mabf/issue-406`，基线 HEAD `56cf5428…` = `fix(#405)`；本次 `git status`/`git log` 实测复核）
- 被审对象：SA3 实现报告 `wiki/raw/task_issue-406_sa3_impl.md`（派发 `sa-32f8adfc…`，iteration 0）+ 工作区实际 diff/新文件
- 审查方式：全新视角静态攻击；全部源码/测试/文档断言均为本次实读核验；SA4 未运行任何测试（运行证据取自 SA3 落盘 artifacts 的实读复核）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-406.md`（Host 简报；`## Comments` 段空，Issue updated 2026-09-18T02:09:17Z） | 在场，实读 |
| `wiki/raw/task_issue-406_sa6_contract.md`（rev1，verdict approve；18 冻结锚 + G1–G10/T1–T5/C1–C10 + pins D1–D7 + §12.8 门禁） | 在场，全读 |
| `wiki/raw/task_issue-406_design.md`（SA1，426 行；DD-1–DD-9、ALLOW/DENY、R-1–R-8） | 在场，全读 |
| `wiki/raw/task_issue-406_sa2_review.md`（approve；O-1–O-4） | 在场，全读 |
| `wiki/raw/task_issue-406_design_conflict_report.md`（SA8 设计门禁，clear；RA-406-1…5） | 在场，全读 |
| `wiki/raw/task_issue-405_implementation_conflict_report.md` §8 **RA-I1**（D-1 授权链核验对象） | 在场，实读（L110 原文逐字核验） |
| `wiki/raw/task_issue-406_sa3_impl.md`（SA3 报告；Changed paths / Deviations D-1/D-2 / Verification） | 在场，全读 |
| REST Issue-comment 快照 | **空（`[]`）**——与派发说明一致；无评论来源义务（SA6 §2 / SA2 §4 / SA3 三方一致，本次不复核 REST） |
| 源码实读：`runtime.ts`（readData 编排 L750–850、readArray/readMap L861–925、`splitWindowOptions`/`windowBudgetAxisInvalid`/三条 message 常量 L1324–1420）、`window-read.ts`（全文，六键 interface/联合/canonical/S6.5）、`read-budget.ts`（新建全文）、`doc-runtime/src/window.ts`（`validateWindowOptions`/`windowCore` G0–OPT 定序实读对照）、`index.ts` 导出面 | 完成 |
| 测试实读：`issue-406-*` 7 文件（fixture/red/control/test-d ×2 + lease fixture/red/surface）、`issue-405-maxbytes-control.test.ts` G11 改写、`issue-369-window-read-composition-red.test.ts`（计数锚段）、`issue-383/issue-369` 两 `.test-d.ts` 中继锁、`readdata-shape-assertion-consolidation-gate.test.ts`（门机制） | 完成 |
| SA3 artifacts 实读复核：`sa3-issue406-{contract-family,focused-typecheck,full-test-final,root-typecheck,r1-counting-anchors,scope-diff}.log` | 完成（结论与 SA3 报告一致：45/45、172 files/2125 tests、422 files/5095 tests exit 0、计数锚 71 tests 绿、DENY 空） |

## 2. Verdict

**approve**。未发现 BLOCKER 或 MAJOR。SA6 rev1 契约的全部观测面（G1–G10 行为、T1–T5 类型、C1–C10 控制组、18 冻结锚逐字节）经源码级静态核验为忠实落地；pins D1–D7 全部按推荐解实现；SA8 冻结面 14 项逐项保持（DENY 面 git diff 实测为空）；两处测试修订（D-1 `#405` G11 原位改写、D-2 C7 装置缺陷修订）经独立重推导**均为有效修订而非弱化**，授权链与矛盾论证均在案。R-1 计数锚 parity（RA-406-1）经静态结构推导成立且有 SA3 实跑日志佐证。5 条非阻断观察见 §12。

`requiresConflictRecheck = false`（SA4 侧）：本次未发现**新的** ADR 冲突风险——公共 API 加法、`read-budget.ts` 迁移、G11 改写均已由 SA8 RA-406-3 既定复查标志覆盖，无需追加。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| Issue AC1 两面 `maxBytes` 域负控（`WINDOW_OPTIONS_INVALID`，message 区分域） | `runtime.ts` `splitWindowOptions`（域判据 `typeof === 'number' && Number.isSafeInteger && >= 1`，accessor 拒、getter 零执行）+ `windowBudgetAxisInvalid`（恰四键，W1 无码前缀措辞族 `window options.maxBytes …`）；红测试 G5 非法矩阵 ×12 × 两面 + 有效域接受锚（`{maxBytes:1}` → 超限码）+ C-LIMIT | 落实。域判据与 RA-1 钉死（1..2^53−1）一致；`2^53`/`2^53+2`/`1e21` 拒、`2^53−1` 收（G5 锚在案）；message 含 `maxBytes` 且 ≠ 未知键文案（G5 断言双向） |
| Issue AC2 超限同码同文同载荷；三面一致 | 共享 `read-budget.ts`：`readBudgetExceeded` 恰五键 + `budgetExceededMessage` 唯一模板（本次与被删除的 `#405` runtime.ts 原文**逐字节比对一致**）；G3 三面键集/码/模板一致断言 + path 新鲜回显（深等非同引用、事后变异不影响） | 落实。模板单源无第二份（grep 实测 src 内唯一构造点 = `read-budget.ts` L88–100） |
| Issue AC3 ≤ 边界成功；无预算逐字节回归 | `window-read.ts` S6.5 闸（`canonical.maxBytes !== undefined` 时 `deliveryBytes(entries, schema)`，`>` 才拒；成功路径零触碰四键）；G1/G2（`total` 收 ≡ 无预算读、`total−1` 拒且 `measuredBytes = total`）+ C1/C10 冻结锚复验 | 落实。闸在 S6 结算后只读不写（源码序：✂ 装配 → 闸 → return） |
| Issue AC4 where × 预算（同分支/装满判定不受影响/无静默丢弃） | 闸门无 where 特殊分支；`truncated` 双语义与 ✂ 分支结构先行结算；G6（WM4/WM5 同字节 305 判定相反各自保持 + 超限恰五键无 `value` + schema 无 ✂）+ C9 | 落实 |
| Issue AC5 度量等式构造性成立 | `deliveryBytes` = `utf8(JSON.stringify(value)) + utf8(schema ?? 0)`（三面同一 helper，组合式记账零镜像）；G4（18 锚构造性等式 + CJK `utf8 ≠ utf16` + 双通道 ≠ 单通道 + `schema:null` 计 0） | 落实。等式由构造成立，无需镜像代码 |
| Issue AC6 registry lease 别名锁延伸 | registry `src/**` 零 diff（git status 实测）；`types.ts` 纯别名自动含六键/新成员；G9 行为（lease ≡ runtime 逐字段、released 冻结三键 + get trap 0 次）+ T5 类型锁（三面同载荷 `Equal` 锁） | 落实（零改动即跟随 = 设计 DD-8 兑现） |
| Issue AC7 门禁 | SA3 artifacts：root typecheck exit 0、root 全量 422 files/5095 tests exit 0（`full-test-final.log` 尾行 `FULLTEST_EXIT=0` 实读）、定点 `--typecheck` 172 files/2125 tests、DENY `git diff` 空、契约零 skip/only/todo（本次 grep 复核 none） | 落实 |
| SA6 pins D1–D7 | D1 present-undefined 剥离（split `value === undefined → continue` + canonical 同处置 L355）；D2 联合直接追加共享成员（无重载）；D3 runtime 自持六键 interface（成员无 `readonly`、term 类型单源 import；`Omit` 中继 + `keyof` 硬锁双锚）；D4 校验/度量住组合层、W1 单一权威（五键/未知键/宿主判据与 message 全留 W1——split 对其余键 descriptor 原样复制不判定）；D5 模板逐字节镜像（见 AC2 行）；D6 塑形后交付物计量（闸在 ✂/`‡` 装配后）；D7 定序 ladder（S1 → S2-G0 → split → W1 → S3 → S6.5，源码序实读确认） | 全部采推荐解，无「另有选择」 |
| SA8 RA-406-1（split/canonical 读纪律 parity = 实现验收必要条件） | `splitWindowOptions` 键循环与 W1 `validateWindowOptions` 逐字同构（`Object.keys` + 每键恰 1 次显式 `getOwnPropertyDescriptor`、零 `[[Get]]`、宿主门 relay=raw 原样直传、try 收编）；重派发闭包 = re-split + re-W1(relay₂)。静态计数推导：状态化 trap 总 raw descriptor 读 **4**（split #1/#2 → canonical #3 抛 → re-split #4 抛 → 收编）；交替 trap **5**（… → re-split #4/#5 过 → exit②）——与 `issue-369` S3 组锚（`descriptorCalls() === 4/5`，断言原文零改动）吻合；SA3 实跑 `r1-counting-anchors.log` 2 files/71 tests 绿 | 落实（结构推导 + 实跑证据双确认；探测期 message 与 W1 L351 收编条逐字相同——本次逐字符比对一致，exit① 文本零漂移 = R-7 兑现） |
| SA8 RA-406-2 / OBL-DOC-406-1（typed-access.md 窗口读小节补词汇） | `.agents/skills/nomicore/typed-access.md` diff：新增「Byte budget on windows: `maxBytes`」三段（同码同文三面一契约 / 域 / 总量 = 条目列表含 `{index\|key,value}` 包装紧凑 JSON + 元素口径投影文本、✂/`‡` 自然计入、`schema:null` 计 0 / ≤ 逐字节相同、> 恰五键零交付不塑形 / where × 预算三语义 / 定序 / 确定性重试）+ `WINDOW_OPTIONS_INVALID` 词条补域外 `maxBytes` + 失败词表补 `READ_BUDGET_EXCEEDED` 条 | 落实。SA6 §12.6 要求的四要素（同码同文、总量构成、where 三语义、不塑形）逐项在场；`readdata-docs-adr0016-*` 门 43/43 绿（focused log） |
| SA8 RA-406-4（minor bump 发布门） | SA3 §Deferred #3 登记，归 Runner Host | 挂账在案（非本审查面） |
| SA8 RA-406-5（根 AGENTS.md 枚举 stale-by-omission，advisory） | 未修改（SA8 裁定非决策义务、不阻断收尾）；SA3 §Deferred #4 记录移交 | 与 SA8 裁决一致（见 §12 O-2） |
| 父票 OBL-WIN-1（三面义务：同构度量、同码同文同载荷、负控、message 逐字镜像） | 本票即兑现票：以上各行合并成立；`readData` 面 JSDoc 镜像义务句由共享件构造点满足 | 关闭（兑现方式经本审查核对） |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| DD-1 变更落点：生产改动集中 runtime `src/**` 三文件；`index.ts` 零改动 | `window-read.ts`/`runtime.ts` 改、`read-budget.ts` 新建（100 行）；`index.ts` 不在 diff（实测）；模块方向零环（runtime→read-budget 值导入、window-read→read-budget 值导入、window-read→runtime 仅 type-only） | 一致 | — |
| DD-2 六键自持 interface（成员无 readonly、term 单源 import、第二参必填无重载） | `window-read.ts` L57–81：两面 interface 成员逐字 `{n; orderBy?; depth?; maxChildrenPerNode?; where?; maxBytes?}`；term/`WhereTerm` 自 doc-runtime `import type`；`Parameters[1]` 锁（test-d） | 一致（T1 `Equal` 锁绿） | — |
| DD-3 `splitWindowOptions` raw 第一读者（maxBytes 剥离/域拒前置；其余 descriptor 原样复制；不提取闸门值） | `runtime.ts` L1363–1410：宿主门 relay=raw；`Object.keys` + 每键 1 次显式 descriptor；maxBytes 四分支（accessor 拒/present-undefined 剥/域外拒/合法消费不进 relay）；其余键 `defineProperty` 原样复制；`desc === undefined` 跳过；try 收编；**不返回 maxBytes 值** | 一致（`{n:1, maxBytes:1, nope:1}` 仍以「未知键：nope」被 W1 拒——nope 原样进 relay） | — |
| DD-4 G0 前置分支（非数组 path → W1(raw)，成功 → loud throw） | `runtime.ts` readArray/readMap 开头：`!Array.isArray(path)` → `readArrayWindowAtPath(doc, path, options)` 原样返回失败 / `throw` 守卫；W1 `windowCore` G0 实测先于 OPT（window.ts L207–212）→ 零 options 读取成立 | 一致（C3 锚：非数组 path × 非法/合法 maxBytes → `PATH_NOT_ALLOWED`） | — |
| DD-5 canonical 六键镜像 + 闸门权威 = canonical 复读值；重派发闭包由 runtime 提供 | `window-read.ts` `canonicalWindowBudget` 白名单六键 + `maxBytes` 域镜像 + ok 分支回传；compose 形参 `redispatch: WindowRedispatch`（doc 形参移除）；runtime 提供闭包（re-split + re-W1(relay₂)）；canonical/split 均读 **raw**（A2 否决面未触碰） | 一致 | — |
| DD-6 S6.5 预算闸（S6 之后、return 前；`deliveryBytes(entries, schema)`） | `window-read.ts` L264–275：插位点在 ✂ 窗口事实块装配之后、`return {ok:true,…}` 之前；恰等收、`>` 零交付 | 一致（与设计伪代码逐行同构） | — |
| DD-7 三条窗口面 message 常量（W1 无码前缀措辞族；探测条与 W1 L351 逐字相同） | `runtime.ts` L1329–1338 三常量；与 `window.ts` W1 现行文案族逐字对照：探测条**逐字符一致**；域/accessor 条同族句式（`window options.maxBytes 必须…` / `…不得为 accessor…`） | 一致（R-7 兑现：状态化 trap exit① message 零漂移；grep 全仓无既有测试钉域/accessor 条文本） | — |
| DD-8 结果联合追加共享成员（不另立具名联合/无重载/零新导出名） | `window-read.ts` 两联合原位加 `ReadDataBudgetExceededResult`；接口本体迁 `read-budget.ts` + `runtime.ts` 原位 `export type {…} from './read-budget.js'`（模块面名字不变）；`index.ts` 零 diff；值导出键集审计面不动 | 一致（`Extract<…,{code}>` 双面 `Equal` 锁绿） | — |
| DD-9 编排与失败优先级阶梯 | 源码序实测：S1 lifecycle（`state.lifecycle !== 'ready'` 先行）→ S2-G0 → S2-split → S2-W1(relay) → S3 → S5/S6 → S6.5；`{n:0, maxBytes:0}` 以 maxBytes 域 message 拒（层内 split-先行，G10 只钉码——断言文本实测只断 code） | 一致 | — |
| 设计 §10 调用方矩阵（lease 零改动 / TS 消费方按需认新码 / doc-runtime 直调零变化 / readData 面共享件迁移行为零变化） | registry src 零 diff；doc-runtime 零 diff（C5 锚定直调仍拒 `maxBytes` 未知键）；readData 编排仅换 import（`readBudgetExceeded`/`deliveryBytes`/`echoReadPath` 本地定义删除、模板与函数体逐字节相同——本次 diff 对照） | 一致 | — |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| `maxBytes` 域校验 + 窗口交付总量度量 + 超限分支 | runtime 组合层（ADR 0031 决策 4；唯一同时见两通道的层） | `runtime.ts` split/编排 + `window-read.ts` S3/S6.5 | 正确 |
| 五键域/未知键/宿主判据与 message | W1 单一权威 | split 忠实中继（descriptor 原样复制、relay 下传）；canonical 只镜像不产出 | 正确（DD-3 逐字兑现） |
| 装满判定/total/✂ 装配 | W1 结算单源 + compose 分支结构 | S5/S6 逐字节不变；闸门只读不写 | 正确 |
| lifecycle 停接纳 | runtime S1 | 原样先行（C6：closed 期敌意 proxy → `RUNTIME_READ_DISABLED`、get trap 0 次） | 正确 |
| lease 透传/别名 | registry（单源别名纪律） | 零 diff 自动跟随 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| readData 面 `maxBytes`（`#405`） | S2b-0 → splitReadDataOptions → T1(relay) → canonicalReadOptions → S2b-5 → readDataBudgetExceeded | 同构逐层镜像（S2-G0/S2-split/S2-W1(relay)/S3 六键/S6.5/共享件） | 一致（刻意同构，OBL-WIN-1） | readData 编排（runtime.ts L795–849）与窗口新编排（L861–925）本次并排实读对照 |
| canonical 接缝净化（`#336`/`#369`） | `canonicalReadOptions`/`canonicalWindowBudget` 读纪律镜像 + 两出口 | 六键原位扩宽，出口①/②结构不变（exit②「视图不稳定」成员原文在场 L632–641） | 一致 | |
| 内部共享模块（`read-schema-projection.ts` 等先例） | 包内按关注点分模块，不经 index.ts | `read-budget.ts` 新内部模块（零环方向） | 一致 | 三面同文单源的正解落点 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 超限 message 模板 | `read-budget.ts` 唯一常量（readData 构造点同变更集迁引） | 三面构造点 | 低——grep 实测 src 无第二模板；C8/G3 双锚 |
| 闸门预算值 | canonical 复读值 | split 首读仅服务前置定序（不喂闸门——split 返回值无 maxBytes 字段，结构性保证） | 低 |
| maxBytes 域判据 | ADR 0031 决策 1（RA-1） | split + canonical 两处实现（注释互指锚定在案） | 低——同 `#405` 双点既定形态，G5 组级判据看守 |
| 五键判据/message | W1 | split 只中继 | 无（结构保证） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 无新资源（纯读、零订阅、零缓存、detached 产物、零 sequencer——ADR 0008 不变量保持） | 无 | 拒绝成员即完整结果（零部分交付）；`READ_BUDGET_EXCEEDED` 后重试 = 确定性调用方动作 | 平凡满足；G3 锚 path/options 事后变异不影响已返回结果 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套 options 校验器 | W1 | split 只做 maxBytes 轴前置拒 + descriptor 原样中继，不复制五键判据 | 非平行（DD-7 豁免登记沿 `budgetAxisInvalid` 先例） |
| 第二套度量/文案 | `#405` 局部定义 | 迁 `read-budget.ts` 单源化 | 反向收敛，正解 |
| 第二套预算失败联合/新公共名 | `ReadDataBudgetExceededResult` | 复用同一接口成员（A7 否决落地） | 非平行 |
| 新 cleanup worker/重试循环/状态字段 | — | 无 | 不适用 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-runtime/src/read-budget.ts`（新） | ALLOW「新建：共享模板 + readBudgetExceeded + deliveryBytes + echoReadPath + ReadDataBudgetExceededResult」 | 三面同文单源 | 在 ALLOW 内 |
| `packages/namespace-runtime/src/window-read.ts` | ALLOW（六键 interface/联合/canonical/S6.5/注释） | DD-2/5/6/8 | 在 ALLOW 内 |
| `packages/namespace-runtime/src/runtime.ts` | ALLOW（编排/split/常量/迁移/JSDoc） | DD-1/3/4/7/9 | 在 ALLOW 内 |
| `.agents/skills/nomicore/typed-access.md` | ALLOW（窗口读小节补词汇） | OBL-DOC-406-1（RA-406-2） | 在 ALLOW 内 |
| `packages/namespace-runtime/test/issue-406-window-maxbytes-control.test.ts`（SA6 落盘文件原位修订 1 用例） | ALLOW「仅当实现期发现装置缺陷时原位修订并记录理由」 | C7 装置缺陷（§9 D-2 行） | 在 ALLOW 内（修订有效性见 §9） |
| `packages/namespace-runtime/test/issue-405-maxbytes-control.test.ts`（**设计 ALLOW 未列**，落 DENY「其余既有测试」） | —（授权链 = 父票 SA8 RA-I1 + 本票 SA8 RA-406-3） | G11 前两条断言原位改写 | **偏离设计 ALLOW，有上游 SA8 逐字授权**（§12 O-1 详述；非阻断） |
| `packages/namespace-registry/test/issue-369-window-read-lease-surface.test-d.ts`、`packages/namespace-runtime/test/issue-383-window-where-type-guard.test-d.ts`（M ×2） | ALLOW「零改动（SA6 已原位延伸为 Omit 中继锁）」 | SA6 落盘的锁延伸 | 现形态与 SA6 §12.2 记载逐字一致（`Omit<…,'maxBytes'>` 中继锁 + 命名同步；SA6 基线日志佐其为落盘态）；SA3 声明零改动可信 |
| 新增 7 契约/夹具文件（runtime 4 + registry 3） | ALLOW（SA6 §12.2 清单沿用） | 契约族 | 在 ALLOW 内；fixture 冻结锚与 SA6 §12.0 表 18/18 逐字节核对一致（totals/双通道/truncated/✂ 行） |
| DENY 面（doc-runtime / vfsl / read-schema-projection.ts / registry src / index.ts / CONTEXT.md / docs / protocols / 其余既有测试） | — | — | **零 diff**（`git diff --stat` 实测 6 文件全数列举 + `scope-diff.log` 复核） |

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `NamespaceRuntimeReadArray/ReadMapOptions`（五→六键） | 仓内生产消费方 = registry lease 透传（`lease.ts` L338–L345，零 diff）；TS 字面量旧调用全兼容 | 加法面；`Parameters[1]` 锁自洽随动 | 无 | — |
| 两窗口结果联合（+预算成员） | `code` 穷举窄化的 TS 消费方 | 0.x minor 语义（ADR 0031 验收节授权）；仓内无穷举窗口 `code` 的生产消费方（本次 grep 复核：`registry-readdata-budget-passthrough.test-d.ts` 为 readData 面锁、无窗口引用） | 低（外部消费方按需认新码） | — |
| `composeArrayWindowRead`/`composeMapWindowRead` 签名变化（doc 形参 → redispatch 闭包） | grep 实测唯一消费方 = `runtime.ts`（L898/L921）；两函数不经 `index.ts` 导出（index 仅 type-only re-export 四类型名） | 内部 seam，无外部 ripple | 无 | — |
| `ReadDataBudgetExceededResult` 迁移 + re-export | `runtime.ts` 原位 `export type {…} from './read-budget.js'`（模块面名字不变）；`window-read.ts` 改 import 自 read-budget（type-only 经 runtime 亦可，实际直读 read-budget——注释与 DD-1 方向声明一致） | 仓内零外部按名消费方（SA2 grep + 本次复核） | 无 | — |
| doc-runtime W1 直调面（`#368/#381/#382` 契约 + C5/N4） | doc-runtime 零 diff；runtime 仅在 G0 分支以 raw options 调 W1（其 G0 先行零 options 读取） | 五键类型 + 行为冻结保持（C5 断言直调携 `maxBytes` → 未知键） | 无 | — |
| readData 面（`#405` 契约族） | 共享件迁移零行为变化：模板/`deliveryBytes`/`echoReadPath` 函数体与被删原文逐字节相同（本次 diff 对照）；C8 锚绿（focused log） | 无 | — | |
| 既有窗口测试族（`#369/#381/#382/#383`） | 无预算路径 relay 语义透明（descriptor 原样复制、键序保持——integer-like 键先行 + 插入序在 relay 上重放后 `Object.keys` 序不变；present-undefined/accessor/非枚举同 W1 处置）；计数锚 4/5 结构保持（§3 RA-406-1 行） | 回归绿（全量 5095 + 定点 71 tests 日志） | 无 | — |
| lease released 短路 | `lease.ts` 零 diff；G9 released 用例（冻结三键 + get trap 0 次）绿 | 无 | — | |

## 8. 错误、恢复与并发

- **错误面全枚举（同步联合、零 throw）**：`RUNTIME_READ_DISABLED`（S1）→ `PATH_NOT_ALLOWED`（G0 分支透传 / W1 物化透传）→ `WINDOW_OPTIONS_INVALID`（split 域/accessor/探测、W1 五键/未知键/宿主、S3 接缝终态）→ `WINDOW_TARGET_ABSENT`/`WINDOW_CARRIER_MISMATCH`（W1 原样，预算不吸收——G10）→ `READ_BUDGET_EXCEEDED`（S6.5 最后）。唯一 throw 逃逸 = G0 后成功不变式守卫（internal-bug-only，镜像 readData L842–846 先例）。**静态核验通过**。
- **敌意输入收编**：split/W1/canonical 三层各自内层 try（split 的 try 覆盖宿主门 + 键循环 + `defineProperty`；`getPrototypeOf` 抛出同被收编）；零 `[[Get]]`（split 键循环仅 descriptor；C7-get-trap 用例 get trap 0 次）；getter 零执行（G5 accessor 锚）。
- **TOCTOU（split 与 canonical 间视图漂移）**：canonical 六键镜像读 raw——maxBytes 消失（present-undefined）→ 剥离后闸门不设预算但 W1 已按 relay 成功？静态推导：canonical 对其余五键判据不一致即 `{ok:false}`；maxBytes 单键漂移为非法 → `{ok:false}` → 出口①/②响亮；漂移为合法不同值 → 闸门用 canonical 后读值（设计 DD-5 明文权威，与 `#405` 同构）。无静默免预算通道（合法值漂移仍设预算，仅预算值取后读）。
- **恢复/幂等**：纯读、零共享可变态、零缓存；同 doc 同参逐字节确定（零随机零时钟）；`READ_BUDGET_EXCEEDED` 后重试 = 确定性调用方动作（typed-access.md 已录指引）。
- **`JSON.stringify` 包裹性（SA2 O-3 同阶备案）**：`deliveryBytes` 无 try 包裹；条目值与 readData 值同源（同一 yjs 物化域，bigint/循环不可物化），迁移零行为变化，未扩大暴露。维持备案。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-406-window-maxbytes-red.test.ts`（20 用例） | G1 18 锚 ≤ 逐字节一致（exact + 域顶宽预算）；G2 边界对（total 收/total−1 拒 + measuredBytes = 冻结锚 = 独立 oracle 双锚）；G3 恰五键/零成功键/path 新鲜回显/模板/零外抛 + 三面一致；G4 构造性等式/单位/通道；G5 非法矩阵 ×12 × 两面 + **有效域接受锚**（反伪绿配平）+ D1 + accessor/frozen；G6 超限同分支/装满三态/✂ 永不装配/WM4-WM5 同字节反判定；G8 不塑形；G10 优先级 | `vitest.config.ts` L15 `packages/*/test/**/*.test.ts` | 期望来源纪律（R1）遵守：冻结锚常量或同运行无预算读独立测量（`measureWindowChannels` 不消费被测载荷）；`expectBudgetFailure` 拒自证 | 无 |
| `issue-406-window-maxbytes-control.test.ts`（12 用例，含 D-2 修订） | C1 18 锚冻结字节/✂ 行；C2 零泄漏；C3 G0 定序；C4 非 enumerable ≡ 缺席；C5 doc-runtime 直调拒未知键；C6 lifecycle 先行；C7 敌意零外抛/零 `[[Get]]`；C8 readData 镜像文案；C9 装满判定；C10 装置自洽 | 同上 | C7 第二用例装置修订（§下 D-2 行）——**有效性核验通过**：矛盾论证成立（`maxBytes:1` 域内 ⇒ 按 G5 必走 `READ_BUDGET_EXCEEDED`，与原断言四键 `WINDOW_OPTIONS_INVALID` 在任何满足 G 组的实现上不可同时成立）；修订以域外 `maxBytes: 0` 承载原意图（敌意宿主 + 零 `[[Get]]` → 响亮 options 码），并**增强** `toContain('maxBytes')` 域断言；判据结构/零外抛/零 trap 断言零弱化；理由注释在案 | 无（有效修订） |
| `issue-406-window-maxbytes.test-d.ts`（2 用例） | 六键闭合 `Equal`/`keyof`、`Omit` 中继、联合预算成员 ≡ readData 成员（`Equal` 双面）、恰五键零成功键、方法签名、doc-runtime 五键硬锁、EOPT `@ts-expect-error`、未知第七键/`string` 值型/缺 `n` 编译红 | L20 typecheck include + `--typecheck` | 负控经 `@ts-expect-error` 真实触发编译红路径 | 无 |
| `issue-406-lease-window-maxbytes-red.test.ts`（4 用例） | G9 收/拒侧 lease ≡ runtime 逐字段（含 where/`schema:null`、`measuredBytes` 逐字、模板一致）；released 冻结三键 + get trap 0 次；无预算 18 锚回归 | 同上 | 同 doc 双面装配（`#383` fixture 先例）；依赖方向 registry → runtime 合法 | 无 |
| `issue-406-lease-window-maxbytes-surface.test-d.ts`（2 用例） | 别名组合锁延续/options 跟随/三面同载荷 `Equal`（lease 窗口 ≡ runtime 窗口 ≡ lease readData）/签名锁/doc-runtime 五键锁/released 联合锚 | L20 | 无 | 无 |
| `issue-405-maxbytes-control.test.ts` G11 改写（D-1） | 窗口面 `{n:1, maxBytes:1}` → `READ_BUDGET_EXCEEDED` 恰五键（键集经 `BUDGET_FAILURE_KEYS` 单源常量——形状集中化纪律）；无预算窗口读现状 + doc-runtime 直调断言 + 装置前提断言零改动 | 同上 | **改写有效性核验通过**：①授权链逐字在案（父票 SA8 RA-I1「G11 前两条断言届时原位改写并送门禁复核」+ 本票 SA8 RA-406-3 引用）；②对回退敏感（窗口面退回「maxBytes ≡ 未知键」即红）；③不弱化（原断言对象 = 已被本票设计性取代的 HEAD 事实；`#405` 面其余断言零触碰） | 无（有效修订；授权面偏离见 §12 O-1） |
| 两处 `.test-d.ts` 中继锁（SA6 延伸态） | `Omit<…,'maxBytes'> ≡ doc-runtime 五键`（双向防倒灌/防丢失）+ lease 单源别名锁保留 | L20 | 锁语义随六键自持形态正确演进（非弱化——原「纯别名 Equal」在新形态下必然红，SA6 已按演进链改写） | 无 |
| `issue-369-window-read-composition-red.test.ts` S3 组（零改动复跑） | 状态化 trap descriptor 读 = 4、交替 trap = 5、get trap 恒 0 | 同上 | 断言原文零改动（本次实读复核）；新管线结构推导满足（§3 RA-406-1 行） | 无 |
| 形状集中化门 + doc-sync 门 | family A/B 归零；`readdata-docs-adr0016-*` 43/43 | 全量入口 | #406 新文件形状经 helper/常量表达；G11 改写复用 `BUDGET_FAILURE_KEYS` | 无 |
| 契约族发现入口与卫生 | 7 文件全在 include 模式内；零 `skip`/`only`/`todo`/env override/源码字符串断言（`readFileSync`/`__dirname`/`require`/`process.env` grep 均无） | — | 无 | 无 |

**SA6 红灯断言保持性**：红灯契约 22 用例（18 红 + 2 巧合绿 + 2 类型红）全部保持原文（fixture 冻结锚与 SA6 §12.0 逐字节一致），实现后全绿（`contract-family.log` 45/45）；控制组/中继锁 HEAD 绿保持。未发现以源码字符串断言或装置改动吸收红灯的伪绿。

## 10. Required revisions

无 BLOCKER / MAJOR。不需要实现修订。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| CI 终态复跑（SA3 证据为本地运行） | CI / Runner Host | root `pnpm typecheck` + `pnpm test` exit 0（422 files / 5095 tests / no type errors） | 任一回归即阻断合并（父票 RA-I4 同款流程项） |
| 计数锚 parity 的运行时复核（RA-406-1 收口） | SA7 活链路 / CI | `issue-369` S3 组：状态化 trap = 4、交替 = 5、get trap = 0 | 计数漂移即 split 读纪律回归 |
| 三面同文在发布构建（非 source 条件）下的复核 | 发布流程 | 产物面 `READ_BUDGET_EXCEEDED` message 逐字节 = 模板（`read-budget.ts` 单源） | 文案漂移即 R-2 回归 |
| minor bump（RA-406-4） | Runner Host 发布门 | `@nomicore/namespace-runtime` 以 minor 位发布 | 以 patch 位发布即违反 ADR 0031 验收节 |

## 12. Non-blocking observations

| # | 观察 | 证据 | 建议 |
|---|---|---|---|
| O-1 | `issue-405-maxbytes-control.test.ts` G11 改写落在 #406 设计 ALLOW 之外（设计 §11 DENY「其余既有测试」），授权链在父票 SA8 RA-I1 + 本票 SA8 RA-406-3（「送门禁复核」）——设计文档 ALLOW 清单未列该文件属 SA1 §11 的登记缺口，SA3 已按 Deviations D-1 透明披露 | 父票实现门禁 §8 L110 原文；设计 §11；SA3 §Deviations D-1 | 修订本身有效（§9 核验）；「门禁复核」义务随 RA-406-3 既定 `requiresConflictRecheck` 流转，SA8/SA9 实现后复审确认即可；如设计文档再版可补列该文件 |
| O-2 | 根 `AGENTS.md` Nomicore 集成段窗口 options 签名枚举 stale-by-omission（少 `maxBytes`；readData 描述同样未补）——RA-406-5 advisory 未闭合 | 根 AGENTS.md 实文；SA8 §8 RA-406-5（非决策义务、不阻断收尾） | 并入下一次文档巡扫（连同 #405 readData 口径），不宜长期悬空 |
| O-3 | 红测试 G5 内一处字面四键集 `['code','message','ok','path']`（L228）与 fixture `WINDOW_FAILURE_KEYS`/`expectWindowFailure` 的集中化表达重复——形状集中化门只辖 readData 成功面族，不违规，仅冗余 | red test L228 vs fixture L189 | 可在下次触碰该文件时收敛为常量引用；不阻断 |
| O-4 | `splitWindowOptions` 的 `{} as O` 单点类型断言（descriptor 动态复制的静态化）——运行时 relay 恒五键视图由构造保证，`Omit` 中继锁与 C5 行为锚双向看护；SA3 已在报告中登记 | runtime.ts L1383–1385 注释 | 维持现状；若未来 W1 键空间演进，此处与 canonical 是唯一需同步复查点（注释互指已在案） |
| O-5 | SA1 设计 §11 的 `issue-406-*` 文件计数笔误（SA2 O-1 遗留）：实际 runtime 包 4 文件 + registry 包 3 文件 + 2 处既有锁 | `ls`/glob 实测 | 历史笔误，glob 语义无影响，无需行动 |

## 13. 附：与既有评审/门禁的关系

- 本文件为该 slug 首份 SA4 评审（glob 复核无既往 `task_issue-406_sa4_review.md`）。
- SA8 RA-406-3 的实现后复审由本报告承担静态侧；DENY 面 git diff 证据、OBL-DOC-406-1 形态、C8 逐字节、RA-I1 改写点均已逐项核对（§3/§6/§7/§9）。动态侧（CI 复跑 / SA7 活链路）见 §11。
- 本评审不运行测试、不修改实现/设计/测试；唯一可写产物即本文件。
