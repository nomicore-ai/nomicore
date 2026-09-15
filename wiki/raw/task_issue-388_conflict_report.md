# SA8 前置门禁冲突报告 — issue #388：谓词订阅与宁多勿漏判定（变更订阅 T2）

- 复审对象：**task**（任务简报 `wiki/raw/task_issue-388.md` 全文，38 行）
- 复审轮：2026-09-14（iteration 0；dispatch `sa-52989373-ffcb-4666-acfe-0a5052eef640`）
- Worktree：`/home/wangjian/nomicore-fix-issue-388`（HEAD `28faeae`——T1 #387 已合入；
  ADR / CONTEXT / 协议文档相对 HEAD 零 diff，规范基准未被本任务触碰）
- 结论速览：**verdict = clear**；26 项对照 = 14 × implements-existing-decision +
  12 × no-conflict；0 hard-conflict；0 evolution-required；0 override；
  **requiresConflictRecheck = true**（公共 API 加宽 + 新失败语义 + 谓词判定语义尚待
  实现核对）

---

## 1. Reviewed subject

**task**——issue #388 任务简报：在 T1（#387）无谓词通路上叠加 `watchMap(path, { where })`
谓词订阅与宁多勿漏判定纪律（What to build + 8 条验收项 + Blocked by #387）。简报自锚
规范权威 = ADR 0030 决策 2 / 5。

## 2. Inputs and decision set

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-388.md` | 在场 | 被审对象（需求源） |
| `docs/adr/0030-change-subscription.md` | **规范权威**（已接受，HEAD 零 diff） | §1/§2/§3/§4/§5/§6/§7/备选/验收逐条款对照主基准 |
| ADR 0028、0025、0008、0009、0023、0016/0024/0027、0010/0013/0022、0011/0014、0017/0018 | 已接受 | 词形 / 错误风格 / 测试先例 / 稳定码注册 / lease 生命周期 / 冻结表面范围 / readData 与复制零改动 / 诊断不混用 / schema 邻接（摘录见 `task_issue-388_relevant_decisions.md`） |
| `CONTEXT.md` L61–63（窗口读）、L65–67（变更订阅） | 在场 | 术语一致性（含 `_Avoid_` 面审计） |
| `packages/namespace-runtime/AGENTS.md`、`packages/namespace-registry/AGENTS.md` | 在场 | 模块决策面（槽外纪律 / detached projections / 公共 API 仅经 index） |
| `docs/protocols/instance-replication-v1.md`、`docs/phases/`、`docs/vfsl/` | 在场（本轮 grep） | 复制 wire 零接触独立确认；phase / vfsl 文档零变更订阅名目（无额外规范约束） |
| issue #388 评论 | **0 条**（本轮 `gh issue view 388` 复读 `comments:[]`；dispatch owner feedback：REST comments read returned none） | 无 Owner override 权威在场 |
| 源码现状事实（非决策文本） | 本轮实读 | T1 已交付面与 T2 预留位：`watch-map.ts` L36–38（谓词显式列为 T2 非目标）、`errors.ts` L241–255（WATCH_MAP_* 两码 append-only 注册）、`types.ts` L490–493 / L749–752（lease 面无 options 参数，注释明文「T2 #388 随 `{where}` 加法引入」） |
| T1 家族 evidence（`task_issue-387_design.md` §7-B2、`task_issue-387_design_conflict_report.md`） | 在场（evidence 非规范） | 分期义务承接（签名简写对账）与既有窄读裁决（ADR 0008 L101）延续性核验 |

决策集状态核查：ADR 全集 28 篇均「已接受」；0007/0016/0024 为部分条款被 0008/0027 修订
（被取代条款与本任务无接触面）；无整篇 superseded——全部现行有效。ADR 编号无 0029（0028 →
0030 直接跳号，非缺失文件事故）。

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（task brief） | Classification | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | ADR 0030 §2（L23–25） | 谓词词形封闭小集：`{ field, equals } \| { field, in }` | 简报 AC1 同款词形，恰两算子 | **implements-existing-decision** | ADR L23–25 ts 块逐字；CONTEXT L66「谓词词表 `equals`/`in`」同款 | 无 |
| 2 | ADR 0030 §2（L27） | `field` 限定单段属性名；值域恒标量（string / number / boolean / 字面量） | 简报 AC1「值域恒标量（string / number / boolean / 字面量）」逐字 | **implements-existing-decision** | ADR L27；词形对齐窗口读 `field` 单段（ADR 0028 L31）与 guard `equals`（ADR 0025 L25） | 无 |
| 3 | ADR 0030 §2（L29） | `in` 为集合语义（顺序无关、去重） | 简报 AC1「`in` 集合语义（顺序无关、去重）」逐字 | **implements-existing-decision** | ADR L29 前半 | 无 |
| 4 | ADR 0030 §2（L29）+ §3（L37） | `in` 空数组响亮拒绝（对齐 `WINDOW_OPTIONS_INVALID` 规则非法拒绝风格）→ `WATCH_MAP_OPTIONS_INVALID` | 简报 AC2「`in` 空数组 → `WATCH_MAP_OPTIONS_INVALID`」 | **implements-existing-decision** | ADR L29 后半 + L37；`errors.ts` L241–255 现无该码（T1 预留）——新码 append-only 注册属实现义务 | 无（实现期注册） |
| 5 | ADR 0030 §3（L37） | 谓词非法三情形：field 不存在 / 非标量域 / `in` 空数组 → `WATCH_MAP_OPTIONS_INVALID` | 简报 AC2 恰同三情形同码 | **implements-existing-decision** | ADR L37 逐字 | 无 |
| 6 | ADR 0030 §3（L39） | 全部参数校验在建立时刻完成——建立后通知流零参数错误 | 简报 AC2「（建立后通知流零参数错误）」逐字 | **implements-existing-decision** | ADR L39 | 无 |
| 7 | ADR 0030 §2（L28） | 缺失 / null 恒不匹配，所有算子一视同仁；NULL 三值逻辑不存在 | 简报 AC3 逐字（含括注「NULL 三值逻辑不存在」） | **implements-existing-decision** | ADR L28；`notEquals` 不在词表（L28 + 备选 L82）——简报未引入 | 无 |
| 8 | ADR 0030 §5（L57） | 同值写过滤：载体 delta 存在但条目投影值未变 → 语义投影比较过滤（实测同值 set 仍产生 Yjs update delta） | 简报 AC4 同款（括注复述 Yjs 事实） | **implements-existing-decision** | ADR L57；T1 已落 `isRealChange`（`watch-map.ts` L220–233）——T2 将其与谓词合取 | 无 |
| 9 | ADR 0030 §5（L57） | 通知条件 = 真变 ∧（无谓词 ∨ **新旧匹配态任一成立** ∨ 旧态不可判保守通知） | 简报 AC5「匹配条目变更 → 通知；不匹配条目变更 → 不通知」 | **implements-existing-decision** | ADR L57 条件式；简报 AC5 的「不匹配 → 不通知」仅在旧态可判时成立——与 AC7（保守通知）合取后与条件式完全一致；「降噪是谓词的存在理由」不越宁多勿漏界（AC6/AC7 均向多通知方向收敛） | 设计轮须把 AC5 ∧ AC7 的合取解释固化为判定矩阵行，防止实现把降噪置于不变量之上（advisory） |
| 10 | ADR 0030 §5（L57 + L60） | 新旧匹配态任一成立 → 通知（旧匹配新不匹配 = 退出匹配集）；消费方按 key 幂等拉终态自辨——不在场则删 | 简报 AC6「退出匹配集也通知……消费方拉终态自辨删除视图项——订阅者视图不残留过时条目」 | **implements-existing-decision** | ADR L57 + L60 消费协议逐点对应 | 无 |
| 11 | ADR 0030 §5（L59） | 旧态不可判来源：嵌套 `Y.Map` 部分更新（容器浅 delta 无条目级 oldValue）→ 保守通知；plain object 条目恒整值替换、oldValue 恒在场、判定恒精确 | 简报 AC7 同款两分支逐字级对应 | **implements-existing-decision** | ADR L59；T1 已落 `isNestedEntryChanged` 保守分支（`watch-map.ts` L249–259） | 无 |
| 12 | ADR 0030 备选（L78） | effect 三态分型（entered / left / changed）已否决——不承诺方向，消费方拉终态自辨 | 简报 AC6 描述「退出匹配集」为**收到信号的原因**，信号本身仍是普通 data 通知、无方向字段、无分型 API；删除视图项由消费方自辨 | no-conflict | ADR L78 + L58（一句话承诺）；CONTEXT L67 `_Avoid_`「effect 分型 entered/left/changed」未触碰 | 无 |
| 13 | ADR 0030 验收（L90/L93/L96） | 主缝 = lease 公共面 registry 契约测试家族；判定纪律矩阵（同值写不通知 / 嵌套保守 / 退出匹配集 / 无谓词全通知）；先例 = 窗口读 lease 契约三件套 | 简报 AC8「判定矩阵契约测试锚定上述全部行为（先例 = 窗口读 lease 契约家族；场景矩阵基于 ADR 0030 记录的 Yjs 事实）」 | **implements-existing-decision** | ADR L90 + L93 + L96；简报 AC 全集 ⊆ ADR 验收 L91/L93 矩阵行 | 无 |
| 14 | ADR 0030 §1（L16） | `watchMap(path, { where? }) → { unsubscribe }`（省略回调位的简写） | 简报 What to build 用同款简写 `watchMap(path, { where })` | no-conflict | ADR/CONTEXT/issue 四处简写同源；具体绑定 T1 设计 §7-B2 已冻结为 `watchMap(path, listener, options?)` 纯加法加宽（`task_issue-387_design.md` L139/L644；registry `types.ts` L493 注释明文 T2 加法位）——简报未指定参数序，无冲突面 | 设计轮履行分期义务「T2 签名简写对账」（T1 SA8 报告 §10 登记），明示纯加法路径 |
| 15 | ADR 0030 §3（L35 + L38） | 无 active schema 整体不可用（含无谓词）；数据缺席合法（纯 schema 侧判定，零 live 载体探测） | 简报未重述两条（T1 已落 ③ schema 门 + ⑤ 纯 schema 分类，`watch-map.ts` L426–454）；AC2「按 active schema 裁决」同口径，未引入任何载体探测要求 | no-conflict（义务经 T1 既有门延续，简报无弱化面） | ADR L35/L38；T1 实现现状实读 | 实现后复查项：谓词门叠加不得回退缺席宽容与 schema 门次序 |
| 16 | ADR 0030 §2（L30–31） | 不做 `and` / key 级过滤；新增算子属词表演进，须过设计评审 | 简报词表恰 `equals` / `in` 两算子，零加宽、零组合子 | no-conflict | ADR L30–31 + 备选 L82；简报 AC1 全文 | 无 |
| 17 | ADR 0030 §4（L44–53） | 三 kind 闭集 + data 形状（`{kind, origin, changes}`，定位符恰 `{path, key}`）+ origin 两态 + 无 version/rev | 简报零触碰通知形态——只交付建立判定与通知**是否发出**的矩阵，不改通知载荷 | no-conflict | ADR L44–53；简报全文无通知形状条目；CONTEXT L67 `_Avoid_`（version/rev、事件流）未触碰 | 无 |
| 18 | ADR 0030 §6（L64–66） | 挂点 = 写序列器事务提交后异步分发；回调 throw 静默隔离；有界队列溢出 → invalidate-all；数值不进公共契约 | 简报零触碰分发面（溢出注入与父路径删除编排属 T4 #390） | no-conflict | ADR L64–66；T1 已落单飞微任务泵 + 槽外纪律（`watch-map.ts` L310–341）；T2 谓词求值进观察器路径须维持零 throw 红线（模块面事实，实现期核对） | 实现后复查项：谓词求值不引入 sequencer 槽位工作 / observer 内 throw 路径 |
| 19 | ADR 0030 §7（L69–73） | runtime：谓词求值 + 宁多勿漏判定；registry：lease 公共面 + 类型别名透传；复制协议零改动 | 简报落点一致（谓词与判定属 runtime 职责，测试主缝在 registry lease 家族——AC8）；零复制接触 | **implements-existing-decision** | ADR L71–73；T1 分层先例（`watch-map.ts` runtime 唯一载体 + `lease.ts` 透传） | 无 |
| 20 | ADR 0008（L101 + 词汇收口注册 L121–131） | 「v1 不提供公共事件订阅」（status 可观测性段语境）；稳定码 append-only 注册、区分域靠 message | watchMap 谓词形态 = ADR 0030 后法特定授权的业务数据信号面（同一 §1 公共面内），非队列进度/内部事件；新码 `WATCH_MAP_OPTIONS_INVALID` 按注册纪律追加，既有码（`WATCH_MAP_CARRIER_MISMATCH` / `WATCH_MAP_SCHEMA_UNAVAILABLE`）零改动 | no-conflict（窄读 + 后法授权，沿 T1 SA8 行 13 裁决）+ **implements-existing-decision**（稳定码注册纪律） | ADR 0008 L101 语境实读；`errors.ts` L241–255 append-only 段现状 | 实现后复查项：通知面恒三 kind 闭集、无进度/内部事件夹带（沿 T1 登记项） |
| 21 | ADR 0028（L21/L31/L66–67）+ ADR 0025（L25/L42） | 窗口读 `field` 恰单段、`WINDOW_OPTIONS_INVALID` 规则非法拒绝风格、键容器 = Y.Map + plain object；guard `equals` 封闭词形（机制非策略） | 简报 `field` 单段标量词形、`WATCH_MAP_OPTIONS_INVALID` 命名、键容器判定矩阵载体口径全部沿家族先例；未复用 guard 的结构深相等全域（`where.equals` 恒标量为 ADR 0030 自有冻结） | no-conflict | ADR 0030 §2 L27 明文「对齐窗口读 `field` 约束与 guard `equals` 词形」；ADR 0028/0025 条款实读 | 无 |
| 22 | ADR 0023（L41/L45） | 冻结服务表面 = `ctx.provide` 服务对象（函数成员访问器化）；**返回值（NamespaceLease 等）不受影响** | 简报的 options / 谓词类型落 lease 返回值面与 runtime 模块内；冻结 registry 服务字面量零触碰 | no-conflict | ADR 0023 L41 明文排除返回值；T1 先例（lease 第 16 键加法未动 `registry.ts`） | 实现后复查项：若实现需动任何 `ctx.provide` 字面量（非预期），函数成员须访问器化 |
| 23 | ADR 0009（lease capability）+ ADR 0030 §1（L18） | lease = 调用方 capability；释放即全部订阅清理；退订幂等零回声 | 简报谓词订阅同生命周期继承 T1 清理面，无独立生命周期条目、无生命周期变更 | no-conflict | ADR 0009 + ADR 0030 L16–18；T1 `lease.ts` doRelease 清理先例 | 无 |
| 24 | ADR 0016/0024/0027（readData 四键形态）+ ADR 0028（窗口读面） | readData / 窗口读零改动（ADR 0030 状态行明文） | 简报消费协议 = 消费方用既有拉面（readData / 窗口读）自辨终态，零读面改动要求 | no-conflict | ADR 0030 状态行；简报 AC6「消费方拉终态自辨」使用既有面 | 实现后复查项：readData / readArray / readMap 面零 diff |
| 25 | ADR 0010/0013/0022 + `docs/protocols/instance-replication-v1.md` | 复制 wire 冻结；通知不出进程（ADR 0030 §7 L73） | 简报零复制接触；协议文档全树 grep 零 `watchMap` / `where` 名目（本轮独立复核） | no-conflict | ADR 0030 L73；协议文档 grep 复核 | 实现后复查项：ws-replication / replication-protocol / persistence 包零 diff（沿 T1 DENY 面） |
| 26 | ADR 0011/0014（诊断日志）+ ADR 0017/0018（schema 生命周期）+ CONTEXT L65–67 术语 + Blocked by #387 | 诊断日志不混用为通知通道；schema 变更下谓词静默死亡由 `watch-end` 终结（T3 #389）；「变更订阅」词条口径；T1 依赖已合入 | 简报零诊断接触；零 `watch-end` 条目（分期边界正确，判定矩阵不引入终结语义）；术语逐项与词条一致（宁多勿漏 / 定位信号 / 拉终态自辨），`_Avoid_` 面零触碰；#387 已在 HEAD `28faeae` | no-conflict | ADR 0030 L85（watch-end 正解）+ 备选；CONTEXT L66 实读；`git log` HEAD 确认；T1 `watch-map.ts` L36–38 边界注释（谓词显式归 T2） | 无 |

裁决分布：**14 × implements-existing-decision（行 1–11、13、19、20b）+ 12 × no-conflict；
0 hard-conflict；0 evolution-required；0 override。**

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

issue #388 评论 = 0（本轮 `gh` 复读 + dispatch owner feedback 确认）；无新 ADR 修订、无协议
版本升级、无决策文本自授权演进条款被援引。**不存在任何 override 诉求**——简报全部行为面
均在 ADR 0030 既有条款内。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result |
|---|---|---|---|
| readData 交付形态 | 恒四键 `{ok, value, schema, truncated}`、截断事实唯一载体 = 投影文本 ✂ 段 | ADR 0027（修订 0016/0024 交付条款）；ADR 0030 状态行「readData 零改动」 | 简报零触碰 → 不变（实现后复核 diff） |
| 窗口读公共面 | `readArray` / `readMap` 签名、`WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` / `WINDOW_OPTIONS_INVALID` 三码与窗口语义 | ADR 0028 L21/L65–67 | 简报零触碰 → 不变 |
| 复制 wire | instance-replication-v1 全部帧 / 状态机 / 错误码 / reason 词表；chunked（0013/0022）冻结值；通知不出进程 | ADR 0010/0013/0022 + ADR 0030 §7 L73 | 简报零接触；协议文档 grep 零 watchMap → 不变 |
| 通知三 kind 词表与 data 形状 | `{kind:'data', origin, changes:[{path,key}]}` / `invalidate-all` / `watch-end`；无 version/rev、无 effect 分型、无含值 | ADR 0030 §4 L44–53 + 备选 L78/L79；CONTEXT `_Avoid_` | 简报只改「是否通知」，载荷面不变 → 不变 |
| 谓词封闭词表 | 恰 `equals` / `in`；无 `notEquals` / `and` / key 过滤 / 数组载体 | ADR 0030 §2 L28–30 + 备选 L82/L83 | 简报词表恰两算子 → 不变 |
| WATCH_MAP 既有稳定码 | `WATCH_MAP_CARRIER_MISMATCH`（ADR 逐字）、`WATCH_MAP_SCHEMA_UNAVAILABLE`（T1 冻结）零改动；新码 append-only | `errors.ts` L241–255；ADR 0008 词汇收口注册 | 简报只新增 `WATCH_MAP_OPTIONS_INVALID` → 不变（实现期按 append-only 注册核对） |
| lease 生命周期语义 | 释放即全部订阅清理、退订幂等零回声、订阅 = lease capability | ADR 0030 §1 L16–18 + ADR 0009 | 简报零生命周期变更 → 不变 |
| 诊断变更日志面 | 不得作为通知通道混用；emit 永不抛；slot 外纪律 | ADR 0011/0014 + ADR 0030 背景 / 验收 L97 | 简报零诊断接触 → 不变 |
| Registry Cordis 服务字面量 | `ctx.provide` 服务对象函数成员访问器化（若被触碰）；返回值面不受此约束 | ADR 0023 L41/L45 | 简报落点在 lease 返回值面 + runtime 模块 → 字面量不变 |
| guard / mutation 信封面 | `{path, equals}` / `{path, absent}` 词表与语义零改动 | ADR 0025 L25/L42 | 简报零触碰 → 不变 |

## 6. Evolution requirements

无。简报全部行为面（词表、错误码、判定矩阵、测试缝）均为 ADR 0030 已接受条款的直接兑现，
不改变任何既有契约——无需 ADR / CONTEXT / 协议文档修订计划。CONTEXT「变更订阅」词条
（L65–67）已预先覆盖谓词词表与判定纪律，T2 落地后词条无需变更（文档缝属 T5 #391）。

## 7. Hard conflicts

无。逐条对照见 §3——简报与 ADR 0030 决策 2 / 3 / 5 及验收节在条款级逐字一致；
未发现与任何现行 ADR、CONTEXT 术语、模块 AGENTS 决策面或协议文档的不兼容点。

## 8. Required actions

全部为非阻塞 advisory / 后续核对项（不构成 gate 停止条件）：

1. **设计轮签名对账**（分期义务承接，T1 SA8 报告登记）：ADR §1 简写
   `watchMap(path, { where? })` vs T1 冻结绑定 `watchMap(path, listener, options?)`——T2 设计
   须明示纯加法加宽路径与 `NamespaceRuntimeWatchMapOptions` / `NamespaceLeaseWatchMapOptions`
   别名引入（registry `types.ts` L493 预留位）。
2. **新码注册**：`WATCH_MAP_OPTIONS_INVALID` 以 append-only 进 `WatchMapErrorCode` 联合
   （既有两码零改动；message 恒含稳定码前缀、非空、互相可区分、零 path/身份回显——沿 T1
   message 文案纪律）。
3. **建立门次序不回退**：谓词校验全部前置于登记（失败零订阅登记）；schema 门 / 载体门
   （T1 已落）次序保持；数据缺席宽容不得因谓词求值便利而引入 live 载体探测。
4. **判定矩阵完备性**：契约测试须锚定简报 AC 全集 = ADR 验收 L93 判定纪律矩阵行（同值写
   不通知 / 退出匹配集通知 / 嵌套保守 / plain 精确 / 缺失与 null 不匹配 / `in` 集合语义 /
   谓词非法三情形）——AC5「不匹配不通知」与 AC7「保守通知」的合取边界须有显式矩阵行。
5. **槽外与零 throw 纪律延续**：谓词求值属观察器内纯读，不进 sequencer 槽位、不得引入
   observer 内 throw 路径（沿 T1 硬红线）。
6. **实现后复查清单**（对应 `requiresConflictRecheck = true`）：公共 API 加宽（options 参数 +
   类型别名 + `*.test-d.ts` surface 断言更新）、新失败语义（三分支 + 稳定码）、判定矩阵红绿、
   DENY 面（readData / 窗口读 / 复制 / 诊断 / 持久化）零 diff。

## 9. Verdict

**clear**——26 项对照全部为 no-conflict 或 implements-existing-decision；无 evolution-required、
无 override、无 hard-conflict。任务简报可进入 SA1 设计阶段。

（`approve` 不是 SA8 verdict；本 verdict 仅表达「与既有决策集无冲突」，设计优劣属 SA2、
实现质量属 SA4/SA7。）

## 10. requiresConflictRecheck

**true**。理由：本任务兑现尚待实现核对的公共 API 面（lease `watchMap` options 参数加宽 +
类型别名族）与失败语义（`WATCH_MAP_OPTIONS_INVALID` 稳定码 + 谓词非法三分支 + 建立门
次序不回退），且谓词求值进入通知推导路径（零 throw / 槽外纪律）为新的实现核对面——
按纪律须在设计复审或实现复审时核对文档与代码同变更集、语义一致、override 未扩大。
