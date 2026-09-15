# SA2 设计攻击评审 — issue #388：谓词订阅与宁多勿漏判定（变更订阅 T2）

- 评审轮：2026-09-15（**iteration 1 复评**；dispatch `sa-b8ea33a8-aa7e-41d3-a82c-b78f3cc06dae`；
  复评范围 = SA1 iteration-1 修订版对 SA2-1 的落实 + 调用面/兼容性/验证门独立复核）
- 被审对象：`wiki/raw/task_issue-388_design.md`（SA1 实现设计，**670 行，iteration 1 修订版**
  ——iteration 0 首产 648 行 + §11/§12/§13/§14/§16/头部修订；F-1–F-6 与 §7–§10 主体零改动）
- 评审基线：worktree `/home/wangjian/nomicore-fix-issue-388`，branch `mabf/issue-388`，HEAD `28faeae`
  （本轮 `git log -1` 实核，与设计/SA6 基线同一 commit——iteration 0 的核心验证地基未被移动）
- Verdict：**`approve`**（iteration 0 的唯一 MAJOR = SA2-1 **已完全落实**：调用方闭包修正
  逐行实核成立、验证门补齐且覆盖链真实、DENY 注记更正；0 × BLOCKER / 0 × MAJOR /
  3 × MINOR 非阻断观察。核心判定算法、门⑥、AC7 保守语义、类型面、矩阵、测试结构的
  iteration 0 攻击结论在本轮复读 + 同 HEAD 地基下维持成立。）

---

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-388.md`（任务简报，35 行，AC1–AC8，Comments 空） | 在场 | 需求源 |
| `wiki/raw/task_issue-388_design.md`（SA1 设计，**670 行 iteration 1 修订版**） | 在场（本轮全文复读） | 被审对象（重点 §11/§12/§13/§14/§16 增量） |
| `wiki/raw/task_issue-388_sa2_review.md`（本评审 iteration 0 版，verdict `reject`，1 × MAJOR SA2-1） | 在场（被本轮原位更新取代） | 复评对照基准（Finding ID 映射） |
| `wiki/raw/task_issue-388_sa6_contract.md`（SA6 验收契约，approve，500 行） | 在场（本轮复读） | 契约基准（B-1–B-10 / N1–N15 / E1–E11 / §15 ★） |
| `wiki/raw/task_issue-388_conflict_report.md`（SA8 前置门禁，clear，143 行） | 在场（本轮复读） | 六条 required actions + 冻结面 |
| `wiki/raw/task_issue-388_relevant_decisions.md`（SA8 决策摘录，195 行） | 在场（本轮复读） | ADR 0030/0028/0025/0008/0009/0023 条款 |
| `docs/adr/0030-change-subscription.md`、`CONTEXT.md` L61–67 | iteration 0 实读；本轮引用条框复核 | 规范权威 / 术语口径 |
| **`packages/ws-replication/src/testing.ts`（114 行全文）** | **本轮实读** | SA2-1 行 4 证据复核（`decorateLease` L38–50/L88、`createHubReplicationForTesting` L90–114） |
| **`packages/ws-replication/package.json`（exports `./testing`）、`test/ws-replication-auth-lifecycle-red.test.ts` L40/L436/L456** | **本轮实读** | 出口真实性 + 门面实跑消费方 |
| **9 个 registry 测试替身文件（`grep -n watchMap` 逐行）** | **本轮实读** | SA2-1 行 5 证据逐行核对 |
| **4 处键审计表（runtime-close-lifecycle L179 / runtime-registry-internal-seam L292 / runtime-phase5-reset-fence-r2 L145 / registry-open L942）** | **本轮实读（含上下文）** | SA2-1 行 6 证据逐行核对 |
| **`packages/namespace-runtime/AGENTS.md` L19、`packages/namespace-registry/AGENTS.md` L19、`packages/ws-replication/AGENTS.md` 验证节** | **本轮实读** | root `pnpm typecheck`/`pnpm test` 强制门引文逐字核对 |
| **根 `package.json` scripts、`tsconfig.base.json`（`customConditions:['nomicore-source']`）、`tsconfig.typecheck.json`（include src+test）、`vitest.config.ts`（L15/L20/typecheck.tsconfig）** | **本轮实读** | §12 验证门覆盖链真实性（src 解析 / 程序面 / 采集面） |
| `packages/namespace-runtime/src/runtime.ts` L309–312/L753、`watch-map.ts`、`errors.ts` L241–271；registry `types.ts`、`lease.ts` L342–363/**L499–515/L569–573（Equal 锁全文）** | 本轮实读 | 行 3/7 wiring 与透传 + Equal 锁加宽机制 |
| T1 三件套（fixture L265–280 / surface L28–36、L100–113） | 本轮实读 | 行 2 兼容性（options 结构位 / `Parameters` 前缀扩展 / 负例保持红） |
| 全树 `grep -rn watchMap`（packages/apps/domains/scripts/docs/tests） | 本轮独立执行 | 调用面闭包完备性（**89 命中 / 23 文件**，与设计 §13 声明一致） |
| `artifacts/sa6-issue388-*.log`（18 份在场） | 本轮 ls 实核 | 基线证据在场性 |
| Owner 评论 | **0 条**（简报 `Comments:` 空 + dispatch owner feedback「REST comments read returned none」；SA6 §2 / SA8 §2/§4 三处同口径） | 无 owner override |

评审产物前置：iteration 0 版本被本轮**原位更新**（反映 iteration 1 设计；SA2-1 移出阻断项、
保留 Finding ID 供修订映射）。

---

## 2. Verdict

**`approve`** —— SA2-1（iteration 0 唯一 MAJOR）的三项修订要求（① §13 调用方增补 + 兼容依据、
② §12 补 root `pnpm test` 门、③ §11 DENY ws-replication 注记）**逐项落实且逐行实核成立**：

1. **调用面闭包修正为真**：本轮独立全树 grep 得 **89 命中 / 23 文件**，与设计 §13「89 命中分类
   收口」一致；23 文件全部落入 §13 行 2–8 或 §8.5/§11 ALLOW 实现面，**无遗漏调用方**；iteration 0
   的假断言「生产消费方为零」已被 §13 收口结论显式作废并更正。
2. **兼容性依据逐项成立**（本轮源码级核验）：`.bind` 保形（testing.ts L50 绑定引用类型 =
   `NamespaceLease['watchMap']` 全签名，加宽自动随行）；少参实现恒可赋值（9 替身 `() => Handle`
   对三参宽签名）；键审计与签名加宽正交（4 处 `'watchMap'` 均为键名进排序键集，非签名断言）；
   Equal 锁 `_watchMapMemberAlias`（lease.ts L510–512）双源同步加宽否则编译期红（fail-loud）。
3. **验证门覆盖链真实**：root `pnpm typecheck` 含 `tsc -p packages/ws-replication/tsconfig.json`
   （include `src/**/*.ts` 覆盖 testing.ts 门面）；root `pnpm test` = `vitest run --typecheck`
   （typecheck 程序 `tsconfig.typecheck.json` include 同时覆盖 `packages/*/src/**/*.ts` 与
   `packages/*/test/**/*.ts`——九替身在程序内；行为面实跑 ws-replication/runtime/registry 全套件）；
   `tsconfig.base.json` `customConditions:['nomicore-source']` 使跨包类型解析指向**活 src**
   （dist 不存在亦不遮蔽）——门面兼容性验证不会被陈旧构建产物伪绿。模块 AGENTS 引文
   （runtime L19）逐字相符。

设计主体（F-1–F-6 冻结、门⑥、判定算法、类型面、矩阵、测试结构）在 iteration 0 经独立攻击
（含 yjs@13.6.32 源码级核验）成立；本轮复读确认修订未触碰 §7–§10 语义，且评审基线 HEAD
未移动——iteration 0 核心结论维持。残留问题均为 MINOR（§14），不阻断实施。

---

## 3. 需求覆盖

本轮无新增需求源（owner 评论仍为 0）；AC1–AC8 → 设计落点的映射与 iteration 0 一致，本轮复读
设计正文确认映射未随修订漂移：

| Requirement（简报 AC） | Design section | Assessment |
|---|---|---|
| AC1 谓词词表 / `in` 集合语义 | §8.1（F-5）、§7.2（F-2）、§7.4（F-4）、N12/N12b、E1–E3 | 覆盖（iteration 0 已深核；本轮复读未变） |
| AC2 建立期裁决 + 建立后零参数错误 | §8.2 门⑥（a–d）、E4–E8/E11、N15 | 覆盖 |
| AC3 缺失/null 恒不匹配 | §8.3 `readMemberScalar`、N11 | 覆盖（O1 载体歧义仍在，非阻断，转实现相位） |
| AC4 同值写不通知 | §8.3 T1 前置合取、N5 | 覆盖 |
| AC5 匹配/不匹配（可判时）静默 | §7.1 公式、N1/N4/N7/N8 | 覆盖 |
| AC6 退出匹配集通知 | §7.1 表、N3/N10/N10b | 覆盖 |
| AC7 嵌套保守 + plain 精确 | F-1 逐字保守、N2/N6 + N9/N9b 对偶 | 覆盖（承重裁定，iteration 0 五点论证核验） |
| AC8 判定矩阵契约测试 | §9 + §10 三件套 + §12 映射 | 覆盖（§12 AC1 行 E12 死引用仍在——O2，非阻断） |
| 非目标不越界 | §1 非目标 + F-6 + §11 DENY | 覆盖（修订未扩大目标面） |

需求源完整性：issue body + AC1–AC8 + ADR 0030 决策 2/3/5 + CONTEXT L65–67 逐条锚定；
无静默扩大（无 notEquals/and/key 过滤/watchArray/含值通知/version）。

---

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| —（issue #388 评论 = 0） | — | §4（无 owner 要求需并入） | 无 owner 条款。四处独立确认（简报 `Comments:` 空、本轮 dispatch owner feedback、SA6 §2、SA8 §2/§4）；设计未虚构 owner 要求 |

---

## 5. 上游事实与SA8约束

iteration 0 的上游事实表（SA6 证据链 / SA8 Action 1–6 / 冻结面 / ADR 逐字条款 / vfsl AGENTS
InternalError 面收敛）本轮全部维持；修订增量相关行复核如下：

| Fact or constraint | Design response | Assessment（本轮复核） |
|---|---|---|
| SA8 Action 1 签名对账（纯加法 + 两别名） | §6 行 1、§8.1、§7.5 | 落实；T1 surface `[Path,Listener] extends Parameters` 在可选尾加宽下仍真（本轮实读 L32 + TS 元组前缀扩展规则核验） |
| SA8 Action 2 新码 append-only | §8.2/§8.6 | 落实；errors.ts 现状恰两码（iteration 0 实核，HEAD 未动） |
| SA8 Action 3 门次序不回退 | §8.2（⑥ 门位） | 落实 |
| SA8 Action 4 矩阵完备 | §9 对偶行 | 落实 |
| SA8 Action 5 槽外零 throw | §8.3/§8.7 | 落实 |
| SA8 Action 6 复查清单 | §15（flag = true 维持） | 落实 |
| SA8 冻结面（含 ws-replication 复制面零 diff） | §11 DENY | 落实；**DENY 行已按 SA2-1-③ 更新**——ws-replication 行现注「并非零消费（testing 门面 bind 保形零改动兼容，依据 §13 行 4）」，与源码事实一致（本轮实读 testing.ts + package.json exports） |
| 模块 AGENTS 验证门（runtime/registry/ws-replication 三处 root `pnpm typecheck` + `pnpm test` 强制） | **§12 新增引用（iteration 1）** | 落实：引文与 `packages/namespace-runtime/AGENTS.md` L19 **逐字相符**（本轮实读）；registry/ws-replication AGENTS 同款门在场 |

上游事实矛盾：**未发现**。设计 §2 锚点表与 §13 行 4–6 的全部行号经本轮逐行实核成立。

---

## 6. 设计内部一致性

| 检查点 | 结论 |
|---|---|
| SA2-1 修订自述（§16）↔ 正文实际改动 | **一致**：§16 声明 ①②③ 三项 + 两处一致性收口（头部输入清单、§14 回滚行「无消费方」限定）——全部在正文在场（头部 L9–12、§11 L559、§12 L585–586、§13 L595–616、§14 L630）；无「只在附录承认未改正文」的伪修订 |
| §13 调用方矩阵 ↔ 全树实况 | **一致且完备**：本轮独立 grep 89 命中/23 文件 = §13 行 2（T1 三件套 3 文件）+ 行 3/7/8（registry/runtime src 7 文件，全在 §8.5 ALLOW）+ 行 4（testing.ts）+ 行 5（9 替身）+ 行 6（4 审计，registry-open 与行 5 重叠）——**零遗漏文件**；apps/domains/scripts/docs（除 ADR 0030 规范文本）零命中 |
| §13 兼容性依据 ↔ TypeScript 语义 | 成立：`.bind` 无参绑定返回 `OmitThisParameter<F>` 保形全签名；`() => Handle` 少参恒可赋值给三参签名；键集断言与参数类型正交；`Object.freeze` 只加 Readonly 不改成员类型 |
| §12 验证门 ↔ 实际入口 | 一致：root `pnpm typecheck`（package.json scripts = 14 tsconfig 串，含 ws-replication）；root `pnpm test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；typecheck 程序 = `tsconfig.typecheck.json`（include src+test）；`customConditions:['nomicore-source']` 保证门面对**活 src** 类型校验（dist 缺席不遮蔽、不伪绿） |
| §7–§10（冻结裁定/算法/矩阵/测试）↔ iteration 0 已验证版本 | 本轮全文复读：F-1–F-6、门⑥ a–d、§8.3 判定表、§9 N/E 全行、§10 三件套结构与 iteration 0 攻击通过版一致——修订按 SA2-1 修订路由「不动 §7/§8/§9/§10」执行，无夹带语义变更 |
| 死引用 | §12 AC1 行「E12」仍存在（E 矩阵止于 E11）——iteration 0 O2 未修，设计 §16 已显式路由至实现相位（O2 保留为非阻断观察） |
| 前后相反 / 中间层缺失 | 未发现 |

---

## 7. 状态机与并发攻击

iteration 0 攻击记录 A1–A7 在同 HEAD、同 §8 算法下全部维持（A1 的 yjs@13.6.32
`addChangedTypeToTransaction` 门控事实、A4 深冻结快照、A6 敌意 in 成员窗口收窄、A7 先在暴露
归属）。本轮增量攻击（针对修订新增的调用面/门面声明）：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| A8（新） | `decorateLease` 门面在册（ws-replication testing 出口） | lease/runtime `watchMap` 成员类型加宽（T2 实现） | 门面对象仍满足 `NamespaceLease` 结构（类型与运行时双双零改动） | **无**：`watchMap: lease.watchMap.bind(lease)`（testing.ts L50）类型 = 源成员全签名的 `OmitThisParameter` 投影，加宽自动随行；第三参经绑定函数原样透传底层 lease（门面零解释）；root typecheck（ws-replication tsconfig include src）+ root test（vitest --typecheck 程序含 src）双门捕获 | — |
| A9（新） | 9 个 registry 测试替身实现 `watchMap(): Handle { throw }` / `watchMap: () => { throw }` | `NamespaceRuntime['watchMap']` 加宽为三参 | 替身对象对宽 `NamespaceRuntime` 形状的可赋值性保持 | **无**：TS 少参可赋值性（本轮逐行实读 9 处：5 方法形 + 4 属性形，行号与设计 §13 行 5 逐字一致）；替身注释自证「键集义务纯加法」 | — |
| A10（新） | 4 处键审计表（`'watchMap'` 进 `toStrictEqual` 排序键集） | lease/runtime 签名原位加宽（不新增键） | 键集断言零影响 | **无**：4 处均为键名断言（本轮实读上下文：runtime-close-lifecycle L179 还伴随负向事件订阅词审计——`on/off/subscribe/...` 不在 runtime 上，与 watchMap 加宽无接触面） | — |
| A11（新） | Equal 锁 `_watchMapMemberAlias`（lease.ts L510–512：`Parameters<NamespaceLease['watchMap']> ≡ Parameters<NamespaceRuntime['watchMap']>`） | 实现只加宽单侧（lease 或 runtime 漏改） | 编译期红（fail-loud） | **无**：锁在 ALLOW 内同步加宽后仍双源对偶；新 Options/ScalarValue 两锁补齐后 T2 面 ▸ 完整 | — |

并发框架事实不变：单线程观察器 + `maxWorkers:1`；谓词求值在观察器同步段，无交错、无持久化、
无 wire 状态参与。

---

## 8. 错误与恢复攻击

iteration 0 的 E-1–E-6 结论全部维持（同步 throw 零登记 / 逐 key 保守 + 外层吞没 / 旧态不可判
保守 / schema 变更沿用编译谓词至 T3 / message 零回显 / 静默死订阅全拒绝）。修订未引入新失败
路径：§13 行 4–6 是纯事实清单与验证门补齐，零运行时行为声明——无新错误面。无新增 finding。

---

## 9. 契约影响审查（本轮复评核心）

| API or contract | Caller handling in revised design | Evidence（本轮独立实核） | Assessment |
|---|---|---|---|
| `NamespaceLease['watchMap']` / `NamespaceRuntime['watchMap']` 第三参加宽 | §13 行 1–8 全分类 + 收口结论（「生产消费方为零」作废更正） | 全树 grep **89 命中/23 文件**；行 4 = `packages/ws-replication/src/testing.ts` L50（`decorateLease` L38–50，返回类型 `NamespaceLease`，L88 闭合；`createHubReplicationForTesting` L90–114 Proxy 装配；`package.json` `exports['./testing']` → `./src/testing.ts`；消费方 `ws-replication-auth-lifecycle-red.test.ts` L40 import + L436/L456 实跑）；行 5 = 9 替身（registry-sa7-hostile L191 / registry-idle L268 / registry-shutdown L215 / registry-sa7-rev1 L236 / registry-sa7-concurrency L193 方法形 + registry-readdata-projection-text-red L113 / registry-readdata-budget-passthrough L123 / registry-open L191 / issue-369-window-read-lease-contract-red L887 属性形）；行 6 = 4 审计（runtime-close-lifecycle L179 / runtime-registry-internal-seam L292 / runtime-phase5-reset-fence-r2 L145 / registry-open L942） | **闭包完备、行号精确、兼容依据成立**——SA2-1-① 落实 |
| 兼容性验证门 | §12「纯加法不回退」行（root `pnpm typecheck` + **root `pnpm test`**，AGENTS 引文逐字）+ 新增「SA2-1 调用面兼容」行（覆盖路径逐项） | runtime AGENTS L19 引文逐字相符；root typecheck scripts 含 `tsc -p packages/ws-replication/tsconfig.json`（include `src/**/*.ts` 覆盖门面）；root test = `vitest run --typecheck`，typecheck.tsconfig = `tsconfig.typecheck.json`（include `packages/*/src/**/*.ts` + `packages/*/test/**/*.ts`，九替身在程序内，`ignoreSourceErrors` 默认 false → 程序内错误即红）；`customConditions:['nomicore-source']` → 门面对活 src 校验 | **门真实且覆盖面正确**——SA2-1-② 落实 |
| T1 三件套（DENY 不改） | §13 行 2 | fixture `watchMapOf` L269–274 结构提取位已含 `options?: unknown` 第三位（实读）；surface L32 `[Path,Listener] extends Parameters` 在可选尾下仍真；L105–111 负例（缺 path/缺回调/非函数/非数组）在加宽签名下仍红（实读） | 零改动兼容成立 |
| 通知载荷 / 队列 / 分发 / 复制 / 持久化 / 诊断 / 窗口读 | §8.4「零改动」+ §11 DENY | iteration 0 实核维持；修订未新增接触声明 | 无缺口 |

---

## 10. 架构一致性与惯例审查

iteration 0 的责任归属 / 相似能力对照 / 单一事实源 / 生命周期对称性 / 平行机制五表结论全部
维持（修订零架构声明变更）。增量确认：

### 责任归属（增量）

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 调用面兼容论证与验证门 | 设计（SA1）+ 模块 AGENTS 门 | §13/§12（修订） | 正确：兼容性验证落模块强制门（root typecheck/test），非设计自declare 绿 |

### 相似能力对照（增量）

| Similar capability | Existing implementation | Proposed design | Consistent or divergent |
|---|---|---|---|
| shipped testing 门面透传成员 | `decorateLease` 对 readData/readMap/mutateData 等全部 `.bind` 透传（testing.ts L43–58） | watchMap 门面成员同一模式（行 4 论证） | 一致（既有装配模式，T2 零改动即兼容） |

### 单一事实源 / 生命周期对称性 / 平行机制

无变化：谓词语义单一源（编译冻结快照）、无第二事实源、无平行机制（iteration 0 结论维持）。

---

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW LIST（10 项）vs §8.5/§10 落点 | 逐行对齐（iteration 0 核验维持） | 无 |
| DENY ws-replication 行 ↔ §13 行 4 | **一致**（SA2-1-③）：DENY 行注「并非零消费——testing 门面 bind 保形零改动兼容，依据 §13 行 4」，与源码事实（testing.ts L50 + exports ./testing）相符；DENY 维持零修改正确——兼容性来自 bind 保形而非需要改动 | 无 |
| DENY 其余各行 ↔ 正文 | 一致（T1 三件套/helper/config/registry.ts/vfsl/诊断/复制面零接触声明与正文一致） | 无 |
| ALLOW 无理由扩张 / follow-up 掩盖 | 未发现（T3/T4/T5 分期边界未变） | 无 |

---

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC8 行为矩阵 / 首红证据 / 负控 / 采集面 | §9 + §10.3 纪律 + §12 映射（iteration 0 核验维持） | O1（N11 载体歧义）/ O2（E12 死引用）/ O3（E3 `note` 锚）转实现相位（设计 §16 显式路由） | 非阻断（§14） |
| **全网回归门（SA2-1-② 核心）** | §12「纯加法不回退」= T1 三件套 + registry 全量 + **根 `pnpm typecheck` + 根 `pnpm test`**（模块 AGENTS 逐字引用）+ 新「SA2-1 调用面兼容」行（覆盖路径：ws-replication tsconfig 含门面 / vitest --typecheck 程序含九替身 / ws-replication 套件实跑门面） | **无**——门与覆盖链均经本轮实核真实（见 §9 表） | — |
| 类型面（surface） | §10.4 正例/Equal 锁/负例 + §13 行 7（`_watchMapMemberAlias` 随 Parameters 自动加宽，新两锁） | 无（负例形在加宽签名下仍红；exactOptionalPropertyTypes 下 `{where:undefined}` 类型面拒、运行时门⑥-a 剥离接受——分层 fail-closed，E10 行为断言经 fixture 中性面可达，无矛盾） | — |

---

## 13. Required revisions

| Finding ID | Severity | Status | Resolution evidence |
|---|---|---|---|
| SA2-1 | ~~MAJOR~~ | **已解决（本轮验收）** | ① §13 行 4/5/6 + 收口结论（全树 89 命中/23 文件分类收口，「生产消费方为零」作废更正）——本轮逐行实核成立；② §12 root `pnpm test` 门（AGENTS 引文逐字）+ 专用兼容行（覆盖链实核真实）；③ §11 DENY ws-replication 注记更新；另头部输入清单与 §14 回滚行「无消费方」限定两处一致性收口在场。冻结裁定 F-1–F6 与 §7–§10 零改动（修订路由遵守） |

**当前阻断项：无。**（0 × BLOCKER / 0 × MAJOR）

---

## 14. Non-blocking observations

| ID | Observation | Disposition |
|---|---|---|
| O1 | §9 N11 触发列载体歧义（iteration 0 遗留） | 设计 §16 已路由实现相位：落测试时按载体拆行或内联标注 |
| O2 | §12 AC1 行仍引用不存在的「E12」（E 矩阵止于 E11；意图疑为 E7 形态族） | 设计 §16 已路由实现相位；落契约测试时更正引用 |
| O3 | §9 E3「可选标量（note）」字段锚不在 §9 记号/§10.2 fixture（iteration 0 遗留） | 设计 §16 已路由实现相位：改锚 `status?` 或 fixture 补 `note?` |
| O4 | 门⑥-b in 成员索引读（[[Get]]）与「零 [[Get]] 纪律」自述不完全一致（结果面仍全路径 fail-closed） | 设计 §16 已路由实现相位（own-descriptor 读可收窄自伤窗口） |
| O5 | registry types.ts lease 成员 JSDoc 需补 `WATCH_MAP_OPTIONS_INVALID`（ALLOW 内纯记录性） | 实现相位并入 types.ts 改动项 |
| O6 | 门⑥-d 去重机制未明示（存在量词语义下中性） | 实现相位明示或不去重 |
| O7 | N7/N8 可达性依赖的 Yjs「同事务新建 type 不发自有事件」事实未进 §2/§14 事实表（yjs@13.6.32 实核成立） | 设计 §16 已路由：实现相位补记风险表，与「oldValue 清空」同列复核 |
| O9（新，MINOR） | §16/头部将评审输入标注为「iteration 1」而评审文件自标「iteration 0」（设计的 iteration 计数 = 设计自身修订轮，评审轮计数不同源）；指称唯一（仅一份 SA2 评审文件、verdict reject、1 MAJOR）但标签易致未来读者找不存在的「iteration 1 评审文件」 | 非阻断：后续修订统一口径为「设计 iteration N / 评审 iteration M」或在 §16 注明计数口径 |
| O10（新，MINOR） | §12「SA2-1 调用面兼容」行断言 root `pnpm test` 下「九替身与四审计文件零 diff 全绿」——该断言在 HEAD 尚无实跑日志（SA6 基线只跑过 root typecheck + 包级 registry）；断言性质是**实现相位验证门的预期观察**，静态覆盖链（本轮已核）支持其可执行性 | 非阻断：实现相位跑 root `pnpm test` 时留存 exit 0 日志即闭环；无需设计改动 |

---

## 15. 复核声明

- 本评审未修改设计文档、生产代码或测试；唯一产物为本文件（原位更新 iteration 0 版）。
- 评审未运行测试/服务/探针；全部验证为源码/配置/文档静态实读（grep、逐行行号核对、
  tsconfig/scripts/vitest 配置核对、模块 AGENTS 引文核对）与 TypeScript 语义推理
  （bind 保形 / 少参可赋值 / 元组前缀扩展 / exactOptionalPropertyTypes 分层）。
- 核心判定算法等 §7–§10 结论承接 iteration 0 攻击记录（同 review lineage、同 HEAD `28faeae`
  未移动、yjs@13.6.32 同版本），本轮复读确认相关章节零改动。
- `requiresConflictRecheck`：本轮修订（调用面事实修正 + 验证门补齐）不触及 ADR 冻结面、
  不产生新决策冲突面，无需因本评审重跑 ADR 冲突检查；设计自身 §15 的
  `requiresConflictRecheck = true`（公共 API 加宽/新失败语义/矩阵红绿/DENY 零 diff 实现后
  复核）维持正确，由后续相位执行。
- `pass` 仅表示设计通过审查；实现与活链路验证仍归 SA4/SA7。
