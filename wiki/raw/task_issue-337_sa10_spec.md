# SA10 Spec Review — Issue #337 `[shape-budget] T4: DeepOptional 预算读类型面`

- 派发：`sa-bf057eba-18ef-4dc6-ad00-33c7837ffa1c`（role `mabf-sa10`，phase `spec-review`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-337`（branch `mabf/issue-337`）
- 审查对象：交付提交 `7654f85ecd14e11c9abb60b4ed3c6fbf69bcd9ba`（`feat(protocol): add budgeted read type surface`）对 Parent PR #332 base `cb8aaff0297a802432ba7532a407c65218852dce` 的最终 diff
- Issue comments：REST 刷新为空——无 Owner 评论要求，无 override 可应用
- 纪律声明：SA10 零运行（无 tsc/vitest/服务）；结论基于最终 diff 逐行审查、落盘证据日志交叉核对、sha256 独立复验与上游产物（SA6 契约 / SA1 设计 / SA2 / SA3 / SA4 / SA8 ×2）比对
- 上游 verdict 链：SA6 `approve`（契约）→ SA8 前置 `clear`（recheck=true）→ SA1 设计 → SA8 设计后 `clear`（24 项 = 16 no-conflict + 8 implements-existing-decision）→ SA2 `approve`（N1–N5 非阻断）→ SA3 实现完成（红灯重捕获 + 全门绿）→ SA4 `approve`（O1–O4 非阻断）

## Verdict

**approve** —— 交付提交忠实满足 Issue #337 正文全部四条 AC、ADR-0024 决策 7（L91/L92/L94/L113/L127/L130）与 SA6 验收契约全部断言组；无遗漏、无部分实现、无错误实现、无 scope creep；§6 列出 PR 必须披露的已记录解释/未达成项（均为上游已裁决的 sanctioned 选择或归票 follow-up，非缺口）。

## 1. 交付面（最终 diff，`cb8aaff..7654f85`）

| 路径 | 改动 | 契约/设计落点 |
|---|---|---|
| `packages/vfsl-protocol/src/index.ts`（+51/−1） | ① `PathValue` 后新增第 13 名纯类型导出 `DeepOptional<T>`（三分支：变长数组同态不加 `?`、元组元素可选、对象全字段可选并递归、索引签名值位 `\| undefined`、标量/`null`/字面量联合原样）+ doc-comment（ADR-0024 决策 7 引注、记法桥接、域外输入、判别不豁免、非写前快照警示）；② `VfslTypedAccess.read` 后新增第 7 方法 `readBudgeted<const P>(path, {depth?, maxChildrenPerNode?}, ...rest: FailClosedRest<Map, P>): DeepOptional<PathValue<PathAt<Map, NoInfer<P>>>>`；③ 接口头注「六个→七个类型严格方法」（SA3 §8 已申报，零语义） | 设计 §7 D-1/D-2 逐字；SA6 G1/G3；ADR-0024 L91/L92 |
| `packages/vfsl-codegen/src/protocol-surface.ts`（+4/−1） | `PROTOCOL_EXPORT_NAMES` 增补 `'DeepOptional'`（13 名，按 `index.ts` 声明序排 `'PathValue'` 后）；头注如实追加 T4 注记，2026-08-21 基点描述原地保留 | SA8 §8.1 阻塞级名单跟名；设计 D-4；SA6 G1.7 |
| `packages/vfsl-protocol/test/vfsl-protocol-deep-optional.test-d.ts`（新，175 行 / 19 tests） | G1.1–G1.6（导入、对象递归 EOPT 精确 + `{}`/部分/满赋值正例 + `{a: undefined}` TS2375 负例 + 必填误用、标量/unknown/`T\|undefined` 分发、数组三态 + 索引签名 + 判别数组、判别联合不豁免 + 字面量精确、载体桥接正/负例）+ G4（if/switch 窄化）；5 条 `@ts-expect-error` 指令（L57/64/141/154/166） | SA6 §12.3 文件 1 |
| `packages/vfsl-protocol/test/vfsl-protocol-budget-access.test-d.ts`（新，233 行 / 20 tests） | G3.1 六路径 + 根路径 `[]`（D5）、G3.2 差分锁（`read` 完整形 + 双向赋值）、G3.3 `{}` 正例 + 必填误用、G3.4 `NonNullable` 精确、G3.6 三负例（TS2554 ×2 + TS2353）+ `read`/`kindOf` rest 门回归、G2.3 既有六方法零降级、G4 接缝镜像；10 条 `@ts-expect-error` 指令（L107/132/147/171/176/181/186/188/216/224） | SA6 §12.3 文件 2（G3.6 预声明备选落点行） |
| `wiki/raw/task_issue-337_*.md` ×8 | 流水线证据产物（契约/设计/评审/冲突报告），与既往票同例 | — |

**越界核对**：`git diff --name-only` 显示 wiki 之外恰 4 文件（2 源 + 2 测试），全部命中设计 §11 ALLOW；`packages/namespace-runtime`、`namespace-registry`、`doc-runtime`、`vfsl`、`domains`、`docs`、`CONTEXT.md`、`apps`、`pnpm-lock.yaml`、`packages/vfsl-protocol/package.json`、全部既有测试 **零改动**（DENY 全遵守）。

**交付=已审实现的字节级证明**：`sha256sum packages/vfsl-protocol/src/index.ts` = `0d55884f7877721ded4310e9cc2ed263a60844bb1d36db2e1400640c826c47b6`，与 SA3 报告 §2 记录值及 SA4 独立复验值逐字一致——提交内容即绿灯证据所对应的实现状态，无提交后漂移。

## 2. AC 逐条核对

| Issue AC | 交付证据 | 判定 |
|---|---|---|
| **AC1** 无 options 调用的静态类型与现行为完全一致（PathAt 承诺零降级，type-level） | runtime/lease/`VfslTypedAccess.read`/yjs-server **零 diff**（diff 面实证）；T3 系 Equal 锁（`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder`）、`ReturnType` 末签名锁、typed-stub 编译锁文件零触碰；新文件 G3.2 差分锁显式锚 `read(['box'])` Equal `{n: number}` 完整形 + 完整→可选单向赋值 + 反向 `@ts-expect-error`；root typecheck 14 project exit 0（`artifacts/sa3-issue337-root-typecheck-generate.log`） | **met**（零 diff + 差分锚 = 零降级的最强形态） |
| **AC2** 预算读类型全字段可选；在场标量保留精确类型（联合字面量）；数组元素递归可选化（type-level） | `DeepOptional` 三分支形态 = 设计 D-1 逐字；文件 1 G1.2–G1.5（对象递归 EOPT 精确、标量/字面量联合原样不宽化、变长数组元素递归且无多余 `\| undefined`、readonly 保留、元组可选、判别联合不豁免）；文件 2 G3.1 六路径 + 根路径、G3.3 `{}` 可赋值、G3.4 `NonNullable<…['kind']>` Equal `'image'\|'text'`；变异敏感性实跑（`artifacts/sa3-issue337-mutation-sensitivity.log`）：D2 非 EOPT → 恰 1 错（TS2578 自反转探针）、D3 浅层 → 30 错、D4 元素加 `\| undefined` → 6 错，每次复原 sha256 OK | **met**（type-level 正负例齐备且断言敏感实证） |
| **AC3** 判别联合附注：可选化判别字段 switch narrowing 由 test-d 锚定；TS 不容时启用退路并票内记录 | G4 双文件锚（文件 1 if + switch、文件 2 接缝镜像）：成员独有字段访问行无 `@ts-expect-error` 而编译通过（无 TS2339）；`const exact: string = v.url` TS2322 负例（窄化后精确 `T \| undefined`）；实现无判别豁免分支（联合逐成员分发天然不豁免）；**退路未启用**——SA6 §9 E5 实测 TS 5.9.3 支持窄化（唯一 TS2322），符合 ADR-0024 L94「未触发不得预防性豁免」；无票内记录义务（未触发） | **met**（锚定在位；退路条件路径如实登记） |
| **AC4** 未知路径/错误值的既有负向类型锚保持红；全套包门禁 + root typecheck/test | 既有 4 个 test-d（49 条 `@ts-expect-error`）零改动；root `pnpm test`：**352 files / 3880 tests passed，Type Errors: no errors**（基线 350/3841 → +2/+39 恰为新文件，`artifacts/sa3-issue337-root-test.log`）；四包 targeted：**109 files / 1018 tests passed，no errors**（含守卫 4 tests、empty-module 1 test 绿，`artifacts/sa3-issue337-targeted-vitest.log`）；root `pnpm typecheck`（14 project）exit 0；`pnpm generate --check` exit 0 零漂移；包级 `tsc -p`（vfsl-protocol / vfsl-codegen）exit 0（`artifacts/sa3-issue337-package-tsc.log`）；新增 fail-closed 负例（未知路径 TS2554、缺 options、形状外键 TS2353）全部真错误（红日志 TS2578 级联反转实证） | **met** |

## 3. 规范（ADR-0024 决策 7 + SA8 义务）核对

| 规范条款 | 交付落实 | 判定 |
|---|---|---|
| ADR-0024 L92：`DeepOptional` 进协议类型面与 `PathAt` 并列导出、零 per-schema 生成 | 第 13 名纯类型导出，只从 `@nomicore/vfsl-protocol` 出口；`domains/*/generated.ts` 与生成器输出规格零 diff、`generate --check` exit 0 | met |
| ADR-0024 L91：无 options 保持 `PathAt` 完整子树承诺 | `VfslTypedAccess.read`（PathAt 承诺实际存活面）零 diff + G3.2 差分锚 | met |
| ADR-0024 L94：判别字段不豁免；narrowing test-d 锚定；条件退路 | G1.5/G4 锚定；退路未触发未启用 | met |
| ADR-0024 L113（备选否决）：预算读静态类型 `unknown` 被否 | `readBudgeted` 返回 `DeepOptional<…>` 值类型（非 unknown）；动态面 `readData(path, options)` 的 `value: unknown` 维持——该面为 ADR-0016 L77/根 AGENTS 认可的 runtime-shaped 归宿，且属 L91 零降级保护对象（SA8 设计后复审裁 no-conflict） | met |
| ADR-0024 L127 类型面验收行 / L130 门禁行 | AC2 逐点对应；§2 AC4 门禁全绿 | met |
| SA8 §8.1 名单跟名（阻塞级） | 同变更集 `PROTOCOL_EXPORT_NAMES` 13 名；`artifacts/sa3-issue337-export-surface.log`：actual 13 = frozen 13、`has_DeepOptional_*=true`、`alias<DeepOptional>` THROW（`alias-protocol-export-collision`）、`guardSilent=[]` | met |
| SA8 §8.2 现行为基准与落点 | 落点 = `VfslTypedAccess.readBudgeted`（SA6 G3.6 预声明备选分支、SA8 设计后复审 sanctioned）；Equal 锁/重载序/单参动态消费方零触碰 | met |
| SA8 §8.3 实现纪律 | 纯 type 导出（empty-module 测试绿）；`package.json` 零改动（无 dependencies）；零 per-schema 生成；`docs/integration` 零触碰（T5 负控不越界） | met |
| SA8 §8.4 退路义务 | 未触发不启用；G4.3 条件路径在测试头注登记 | met |
| SA2 N1–N5 | N1 索引签名 oracle 未放宽（L107–111/L84–88 断言在位）；N2 TS2554 表述记录；N3 options 双站字段对照记录（协议内联 × doc-runtime `ReadLogicalValueAtPathOptions` 逐字段一致，SA4 §3 复核）；N4 已采纳（文件 1 L83–85）；N5 既有测试零改动 | met |

## 4. 测试质量与红/绿证据链

- **红灯重捕获**（测试文件在场 + 两源文件回退 HEAD）：包 tsc 红 24 错 = TS2305（`DeepOptional` 不存在）×1 + TS2339（`readBudgeted` 不存在）×13 + 级联 TS2578 ×10；vitest 入口红 `2 failed | 3 passed (5 files)`，同目录既有 3 文件全绿——归因 = 目标能力缺失本身，非环境/入口错误（`artifacts/sa3-issue337-red-package-tsc.log`、`sa3-issue337-red-contract.log`）；恢复后 sha256 两次 OK。
- **绿灯**：§2 AC4 全门数字与 SA6 基线（`artifacts/sa6-issue337-baseline-gates.log`）对账一致，增量恰为 +2 files/+39 tests。
- **无弱化**：grep 实证两新文件零 `skip`/`only`/`todo`/`@ts-ignore`/`as any`；断言全部观察类型投影行为（手写独立 oracle Equal + 赋值双向 + `@ts-expect-error` 自反转），零源码字符串断言；泛型方法取型不经 `ReturnType`（设计纪律遵守）。
- **指令计数独立复核**：文件 1 = 5 条、文件 2 = 10 条 `@ts-expect-error` 指令（SA3 报告称 18 条为 grep 混入 docstring 的笔误，SA4 O1 已裁；测试本身无问题）。
- **SA10 边界**：本审查不重跑门禁（纪律禁止）；交付内容与绿灯证据的字节级同一性由 sha256 独立复验保证（§1）。

## 5. Scope creep 审查

交付面 = 设计 ALLOW 四文件 + wiki 证据产物，零越界；无顺手修订（DENY 全遵守，含 emitter/守卫测试头注「12 名」历史引述保留——SA2 N5/SA4 O3 已裁）；`DeepOptional` 未做成运行时值/生成物；未预防性启用判别字段退路；未触 T5 #338 文档面。**无 scope creep。**

## 6. PR 必须披露的已记录解释/未达成项（非缺口，均经上游裁决或归票）

1. **落点解释（最重要）**：Issue 正文「readData 重载——带 options 返回 `DeepOptional<PathAt<…>>`」兑现于 **typed 访问面** `VfslTypedAccess.readBudgeted`（第 7 方法），而非泛型化 runtime/lease `readData` 预算重载。依据链：「PathAt 完整子树承诺」现行为只活在 typed 面（动态 `readData` 两通道成功成员恒 `value: unknown`，无从谈起 PathAt 承诺的保持）；SA6 契约 G3.6 预声明该备选分支（断言迁移条款逐字）；SA8 前置门禁 §8.2 裁落点为设计自由、设计后复审裁 no-conflict；runtime 落点五点否决链（新包图边 + Program 相关公共语义 + 发布面收窄 + stub 锁脆弱 + 改动面）在设计 §7 D-2 记录。动态 `readData(path, options)` 的静态 `value: unknown` **维持不变**（runtime-shaped 面归宿，AC1 零降级对象）。
2. **记法桥接**：ADR-0024 L92 / Issue 正文记法 `DeepOptional<PathAt<…>>` 是速写，规范展开为 `DeepOptional<PathValue<PathAt<…>>>`（值域），由协议 doc-comment 显式桥接；载体直套产壳（SA6 E6 反证）由 G1.6 负例锚定为域外用法。
3. **判别字段退路未启用**：TS 5.9.3 实测支持可选判别字段窄化（SA6 E5），退路条件未触发、无票内记录义务；若未来 TS 升级致 G4 锚红（非 TS2322 形态）→ 按 G4.3 条款记录 + SA8 复核（R-2 哨兵）。
4. **T5 #338 follow-up（非本票义务）**：typed-access 预算纪律文档（`readBudgeted` 宿主接线示例）、`readDataOptionUsages` 文档负控正则修订、`docs/integration` 形状注记、ADR 0008/0016 回填——本票零触碰。
5. **发布面**：`VfslTypedAccess` 接口加法对库外「实现者」是破坏面（在库零实现者，B3 grep 实证）——按 0.x minor bump 先例（ADR-0024 L69）随 `@nomicore/vfsl-protocol` 发布流处理（设计 R-5）。
6. **options 形状双站字面**：协议内联 `{depth?, maxChildrenPerNode?}` 与 doc-runtime 单源 `ReadLogicalValueAtPathOptions` 逐字段一致（本次对照记录）；漂移哨兵 = T3 `_optionsAlias` Equal 锁 + G3.6 TS2353 负例（设计 R-4）。
7. **SA8 implementation 复查**：`requiresConflictRecheck=true` 的实现期复查属后续角色既定流程；本审查核对项（名单成对、runtime 零 diff、负向锚保持红、empty-module、零依赖、零漂移、红灯纪律）均已在案证据自洽，无冲突输入。

## 7. Non-blocking observations

- **O1（MINOR，commit hygiene）**：交付提交信息 `feat(protocol): add budgeted read type surface` 未按谱系先例（`fix(#33x): [shape-budget] Tx: …`）携带 `#337` 票号与任务系标题——追溯性弱于 SA3 建议稿，不影响内容正确性。
- **O2（MINOR，已申报）**：接口头注「六个→七个」为设计 ALLOW 行未逐条列出的纯注释准确性维护，SA3 §8 已如实申报，SA4 O2 接受，本审查同判。
- **O3（信息）**：SA4 O1（报告断言计数笔误）/O3（emitter 等历史「12 名」引述残留，DENY 内不可顺手改）/O4（动态 `string[]` 路径无显式负例锚，设计未要求、机制已由 SA2 N2 记录）——均为非阻断观察，无需本票处理。

---

SA10 结论：**approve**。最终交付忠实满足 Issue #337 正文 AC1–AC4、ADR-0024 决策 7 与 SA6 验收契约全部断言组及 SA8 §8 行动 1–4；文件范围闭合；红/绿/变异证据链完整且交付内容与证据字节同一（sha256 复验）；§6 披露项均为上游已裁决的 sanctioned 解释或归票 follow-up。MINOR 观察不阻断 approve。
