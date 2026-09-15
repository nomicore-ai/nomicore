# SA2 设计攻击评审 — issue #382：[ADR 0029] P2 `where` 过滤原语（缝 1：doc-runtime）

- 评审者：SA2（独立设计攻击评审；dispatch `sa-ccd143d5-ed2e-476c-bc9b-1407b05aaf73`；iteration 0）。
- 被审对象：`wiki/raw/task_issue-382_design.md`（SA1，dispatch `sa-efc631cb-05ff-457b-9bf9-213ffacf4c54`，iteration 0 首版）。
- 评审基准：worktree `/home/wangjian/nomicore-fix-issue-382`，HEAD `1b639e0ebe825ffbbfce377850c01ef620734f47`（与设计 §基准快照一致；本评审全程只读源码与产物，未修改任何生产/测试/设计文件）。
- 评审重点（dispatch 指定）：**namespace-runtime compose 入口 fail-closed 机制（设计 D8）vs 「W1-only/P2（缝 1：doc-runtime）」范围表述与 SA8 A2 约束**。

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| 任务简报 `wiki/raw/task_issue-382.md` | 在场（35 行；What to build + AC1–AC8 + Blocked by #381） | 通读；AC 逐条映射（§3） |
| 设计 `wiki/raw/task_issue-382_design.md` | 在场（299 行，iteration 0 首版；§14 自证无前序评审） | 通读 + 逐项证据核验（见 §6–§12） |
| SA6 验收契约 `wiki/raw/task_issue-382_sa6_contract.md` | 在场（538 行；verdict `approve`） | 通读；§12.4 M5 与本评审重点直接相关 |
| SA8 决议清单 `wiki/raw/task_issue-382_relevant_decisions.md` | 在场（86 行） | 通读；ADR 0029/0028/0027/0024 摘录比对原文 |
| SA8 冲突报告 `wiki/raw/task_issue-382_conflict_report.md` | 在场（86 行；裁决 `clear`；A1–A5 + F1–F8） | 通读；A2 原文逐字比对 |
| `docs/adr/0029-filtered-window-read.md`（规范权威，accepted） | 在场（95 行） | 全文通读；§1–§8 + 三缝 + 备选 + 开放问题 |
| `docs/adr/0028-window-read.md`（基契约） | 在场 | 经 SA8 摘录 + window.ts 模块头交叉核验 |
| Owner 评论 | **无**（简报 Comments 段空；dispatch 明示评论 REST 刷新为空，无 comment ID/时间戳） | 与 SA6 §2 / SA8 §4 一致 |
| 源码事实 | — | 逐文件核验：`window.ts`（758 行全文）、`window-read.ts`（427 行全文）、`runtime.ts` L640–729 + L980、`lease.ts` L295–334/L440–464、`types.ts` L460–489、`doc-runtime/src/index.ts` 全文、`read.ts` sha256 |
| 测试事实 | — | `public-surface-type-guard.test-d.ts` L20–249、`issue-368-…contract-red.test.ts` L18–47、`issue-381-…total-red.test.ts` L370–394；全仓 grep `where[:=]` / `readArrayWindowAtPath` / `composeArray|MapWindowRead` / `.total` / `.test-d.ts` 中 `total` |

关键独立复核结果（设计与 SA6 的证据锚点全部对上）：

| # | 复核项 | 结果 |
|---|---|---|
| V-a | `read.ts` sha256 = `3bf6b8b0…b1b312` | **一致**（本评审实算；CB-9/F6/S1 成立） |
| V-b | `window.ts` L276–279 四键白名单、L259–312 `validateWindowOptions`、L175–222 `windowCore`（OPT L184 先于 N0 L188）、L512–531 `enumerateArrayCandidates`（不读元素）、L533–551 `enumerateMapCandidates`、L560–571 `drillField`、L695–708 `readableArrayElement`、L217 A 阶段 `total: candidates.length` | **全部一致**（CB-1–CB-4、D3/D4/D6 落点可行） |
| V-c | `window-read.ts`：`WindowComposeInput.total: number`（L101）、redispatch 闭包在两入口内（L124/L146）、**S3 失败的重派发在 `composeWindowRead` 函数体内（L157–162），不在 runtime.ts**、S6 `truncated = kept < total`（L176–177）、`seamWindowOptionsInvalid`（L408） | **一致**（D8 的「省一次重派发」主张成立：入口分支先于 L157 的 S3，跳过 L159 的 redispatch） |
| V-d | `runtime.ts` L683–704：S1→S2→compose；`options` **同一 raw 引用**先交 W1（L689/L701）再交 compose（L691/L703）；`windowResult.value/total` 直传 | **一致**（CB-7/D9 成立；敌意视图漂移通道在结构上真实存在：同一 Proxy 对 W1 与 S3 可呈不同键集视图） |
| V-e | `runtime.ts` L980 存在 `seamReadOptionsInvalid`（readData A-2c 接缝终态构造器） | **与设计 D8 备选拒绝理由 (b) 的「runtime.ts 无构造器」表述矛盾**（见 Required Revisions R-1） |
| V-f | compose 入口全仓消费点 = runtime.ts L691/L703 唯一；W1 入口生产消费点 = runtime.ts + window-read.ts redispatch；apps/domains 零引用 | **一致**（§10 调用方矩阵完备） |
| V-g | `types.ts` L468–480 / `lease.ts` L309–315 裸透传 + L446–450 Equal 锁；`index.ts` L49–63 type-only 导出块（`WhereTerm` 按 'Wh'<'Wi' 排在 `WindowDir` 前） | **一致**（CB-6/A3/M2 排序主张正确） |
| V-h | `public-surface-type-guard.test-d.ts` L215–216 是全仓唯一把窗口 `total` 钉死 `number` 的类型锁（全 `.test-d.ts` grep 复核；lease-surface 仅别名 Equal 锁，无 total 钉） | **一致**（M1 迁移面完备、无遗漏消费点） |
| V-i | `issue-381` T9c L383–388 `{n:1,where:'x'}` 断言 `WINDOW_OPTIONS_INVALID`；缝 1 后 `where:'x'` 因「非数组」（W-4）仍同码 | **一致**（M4 零改动 + R-6 label 过时为观察项成立） |
| V-j | 全仓测试无任何合法 `where` 调用（`where[:=]` 仅 4 处：vfsl 无关 ×3 + T9c 敌意负例 ×1） | **一致**（M4 回归面主张成立） |
| V-k | CONTEXT.md「窗口读」+「过滤窗口」词条在场且含 where 语义分工句 | **一致**（缝 3 已闭合、非目标成立） |

## 2. Verdict

**`approve`**（无 BLOCKER、无 MAJOR；4 项 MINOR 修订建议，见 §13，均不阻断安全实施）。

**评审重点结论（compose 入口 fail-closed 机制 D8 vs W1-only 范围与 SA8 A2）**：

1. **D8 不是范围越界，而是已批准契约 SA6 M5 的机械必然后果。**「缝 1 = doc-runtime」不是 W1 文件孤立主义：`total: number | undefined` 经 runtime.ts L691/L703 的 `windowResult.total` 实参流入 compose 的 `total: number` 形参——不加宽签名即 TS2345；加宽后若不加显式分支，S6（window-read.ts L177 `kept < total`）要么编译红、要么以 `as number`/`?? 0` 编译过并在 lease 面静默产出 `truncated:false` 的已过滤四键成功面（恰为 A2 禁止的静默通道；SA6 M5/§12.8 明令禁止兜底）。SA6 契约 §12.4 M5 原文即要求「`total` 加宽后必须在消费边界（runtime.ts L691/L703 + window-read.ts 消费签名）显式分支（响亮失败或缝 2 语义）」——**消费边界横跨两文件是 SA6 已批准的事实**，设计把分支落在 window-read.ts 而非 runtime.ts 是对 M5 的合法实现选择，且 DENY runtime.ts 有 typecheck 机械门背书（本评审按现行签名核验：runtime.ts L691/L703 对加宽形参天然编译通过，零 cast）。
2. **D8 与 SA8 A2 逐项相容**（本评审枚举 lease 面实传 `where` 的全部八类结局，见 §7）：非法 where → W1 OPT 响亮；合法 where + 缺席/载体不符 → 原码响亮；合法 where 过滤成功 → 入口分支响亮 `WINDOW_OPTIONS_INVALID`；两个方向的敌意视图漂移 → 入口分支（total===undefined 键于 W1 结果，视图无关）或 S3+重派发接缝终态，全数响亮，无静默通道。S3 四键白名单零改动（DENY 行明确），S3 镜像扩展正确留给缝 2。
3. **D8 的敌意漂移威胁分析经源码核验为真**：runtime.ts 把同一 `options` raw 引用先交 W1 再交 compose（V-d），S3 `canonicalWindowBudget` 以 `Object.keys` 重读（window-read.ts L213）——敌意 Proxy 的 ownKeys/descriptor trap 可对 W1 呈五键视图、对 S3 呈干净四键视图；若无入口分支，S3 通过后 S6 算出 `kept < undefined → false`，lease 得到已过滤四键成功面。设计选择键于 **W1 结算结果**（`total === undefined ⟺ where 已生效`，B-8 单源不变量）而非 options 二次重读，对漂移免疫且强化单一事实源——这是正确的判据选择。
4. **分支位置（compose 入口、函数体第一句）具备双重必要性**：除响亮失败外，它同时是 S6 消费 `total` 前唯一的免 cast 类型收窄点（放 runtime.ts 无法收窄 window-read.ts 内部计算）。设计 §15-2 已自行把「组合层新增失败位点」登记为设计后冲突复查点（SA8 前置门禁审的是任务简报，未见 D8）——该自我登记是诚实的，本评审确认 D8 与 A2/ADR 0029 §6「两层同步扩」无语义冲突（D8 不校验 where 形状、不重读 options，不是第三套校验器，而是结果键位闸门）。

## 3. 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| 简报 What to build：两面 options 增可选 `where`（合取、单段 field 等值、finite number） | §1 目标 1、§8.1、§8.3 W-10/W-11 | 覆盖；与 ADR 0029 §1/§2 逐字一致 |
| 管线序 where → orderBy → n（匹配子集上选窗） | §8.4（E+W 内联过滤 → S → 取前缀）、D3/D7 | 覆盖；P 组钉序 |
| 位置序短路选窗（凑满 n 个匹配即停） | D7 明示 v1 不做流式短路（可观测等价） | **有偏差但已显式处置**：SA6 §7/H8/O3（已批准契约）裁定短路为成本纪律、不可行为断言、实现自由；设计登记 follow-up ②（真实规模压力 ~10⁵ 再评估）。可观测契约（value/total/顺序）零损失，见 Non-blocking observations N-4 |
| `total` 在场 undefined / 缺席计数 | §8.1/D6/§8.4 A 阶段、T 组 | 覆盖（B-8：own 键恒在） |
| AC1 合取正确性矩阵 | §12 → C1–C11 | 覆盖 |
| AC2 安静不匹配纪律 | §12 → D1–D12 | 覆盖（含 equals:null 双向） |
| AC3 入参侧响亮 | §8.3 W-1–W-14、§12 → V1–V21 | 覆盖（V 组伪绿登记 + V3/V20 反向边界处置正确） |
| AC4 敌意 options 零 `[[Get]]`/零外抛 | W-2/W-6/W-13、§12 → V11–V17 | 覆盖（descriptor 纪律沿 `validateWindowOptions` 既有先例 L280–286） |
| AC5 零物化哨兵 | D4 单段下钻、§12 → Z1–Z8 | 覆盖 |
| AC6 total 双形态 | D6、§12 → T1–T6 | 覆盖（hasOwnProperty 判 own 键，禁 JSON） |
| AC7 三失败码不回归 + orderBy 词表不动 | §8.7、W-14、§12 → F1–F6/C8/V18 | 覆盖 |
| AC8 缝 1 测试先例 + 全仓绿 | §11 新三文件、§12 AC8 行 | 覆盖（采集规则经 SA6 §14 实证，零配置改动） |
| Blocked by #381 | 基准 HEAD `1b639e0`（#381 已入） | 满足 |

目标/非目标无静默扩大：非目标清单（§1）与 A1/F1–F8 逐条对应；唯一超出 doc-runtime 包的 ALLOW 项（window-read.ts 签名+入口分支）由 SA6 M5 背书（见 §2 结论 1）。

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| ——（无） | ——（无） | 设计 §4 显式登记「无 owner 评论」 | 与简报（Comments 段空）、dispatch（评论 REST 刷新为空）、SA6 §2、SA8 §4 四方一致；验收面 = 简报 AC + ADR 0029 + SA8 义务，处置正确 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 §5：合法 where 在 HEAD 全红（A1–A17/C5）、类型层六处红（E4） | §5 承接表 + §12 期望转绿映射 | 逐条承接；红因定位（OPT 键集 + total 值域）与源码一致（V-b） |
| SA6 §5/E5：lease 中间态现状响亮（`WINDOW_OPTIONS_INVALID`） | §8.6 保持同码同向（换因：W1 生效后组合层拒） | 同码成立；message 非契约（SA6 §15-O2），四键失败面形状不变（B-9） |
| SA8 A1 词表纪律 | §8.3 两键白名单 + 标量闭集 + 非目标 | 落实（in/范围/OR/NOT/多段/深相等一律 v1 外） |
| SA8 A2 缝序一致性（中间态响亮；不得绕过 S3 静默通道；S3 镜像归缝 2） | §8.6 + D8 入口 fail-closed；S3 逐字节不动（DENY） | **落实且经源码级攻击验证**（§2 结论 2/3、§7 攻击表）；设计自登记冲突复查（§15-2），恰当 |
| SA8 A3 公共面守卫 | §8.2 `export type { WhereTerm }` + M2 记账 | 落实（type-only；P-W1/P-W2 值导出面保持两枚，V-b/g 核验） |
| SA8 A4 冻结面（read.ts 零 diff / window.ts 原地 / 无 where 逐字节） | §8.4 守卫 `where !== undefined`、§11 DENY、S1 审计 | 落实（sha256 本评审复算一致；array 面 where 缺席零元素读的表述与 CB-4 现状吻合） |
| SA8 A5 测试先例 | D10 + §12 | 落实（#368 家族形态 + 全仓门） |
| SA8 F1–F8 冻结面 | §6 逐行映射 | 全部落实（含 F8：where 路径到不了 S6，✂ 装配零触碰） |
| ADR 0029 §5「位置序短路」成本纪律 | D7 显式不做 + follow-up ② | 与 SA6 §7/H8/O3 裁定一致；非静默偏离（N-4） |
| ADR 0029 §8「S4 下沉」已由 #381 完成 | 基准即 #381 后状态（L217 total 单源） | 一致 |

上游事实与源码无矛盾：设计 §5 末句「逐点核对行号一致」经本评审独立复核成立（V-b–V-d）。

## 6. 设计内部一致性

| 检查项 | 结果 |
|---|---|
| 正文（§1 目标 6）与 D8/§8.6/R-3/R-1 对中间态机制的描述 | 一致（四处均键于 `total === undefined`，先于 S3，新私有构造器，缝 2 整体取代） |
| §8.1 类型面 ↔ §8.3 校验判据 ↔ §8.4 管线 ↔ §12 验收 | 一致（W-1 五键 ↔ options `where?`；W-11 闭集 ↔ WhereTerm 类型；D6 ↔ T 组） |
| D8「省一次 W1 重派发」 | **成立**：redispatch 调用点在 `composeWindowRead` L159（window-read.ts 体内），入口分支先于 S3 即跳过（V-c） |
| D8 备选拒绝理由 (b)「runtime.ts 无构造器，复制即双源」 | **事实错误**：runtime.ts L980 有 `seamReadOptionsInvalid`（readData 接缝终态构造器）。结论（放 compose）仍正确，但论据失真 → R-1 |
| D9「runtime.ts 零 diff 天然 typecheck」 | 按现行签名核验成立（L691/L703 实参 `number \| undefined` → 加宽形参；`options` 别名含 `where?` 可选键；返回类型不变） |
| M4「#381 T9c 断言不变绿」 | 成立（`where:'x'` 新因「非数组」同码；V-i） |
| M1「不迁移则 TS2344 红」自证 | 成立（L215–216 `toEqualTypeOf<number>()` 对加宽类型必红；V-h 全仓唯一钉） |
| §8.3 W-3（顶层 present-undefined 豁免）vs W-9（term 层不豁免） | 有意相反且各锚 V20/V9，与既有 `validateWindowOptions` L286 vs 键集门 L277 的不对称纪律同构 |
| §8.4 array 面「过滤位安静跳过 vs 物化位 PATH_NOT_ALLOWED」双语义 | 显式登记（R-4）且与 CB-4 现状（空洞计入 length、入选才物化判 violation）吻合 |
| 死引用/旧 API/伪修订 | 未发现（§14 评审映射空置与 iteration 0 事实一致） |

## 7. 状态机与并发攻击

管线为纯函数无状态机；攻击面 = 管线阶段序、敌意 trap、视图漂移、幂等。

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SC-1 | lease 面实传合法 `where`（plain options） | runtime S1 ready → W1 接受过滤（total=undefined）→ compose | 响亮 `WINDOW_OPTIONS_INVALID`（与 HEAD E5 同码），无 ok:true | 无（D8 入口分支；S3+重派发为冗余二道闸） | —— |
| SC-2 | 敌意 options Proxy：W1 视图含 `where`、S3 视图干净四键 | W1 过滤（total=undefined）→ S3 通过 → S6 `kept<undefined→false` | 不得静默产出已过滤四键成功面 | **无缺口（D8 封死）**：入口分支键于 W1 结果，视图无关 | 建议补变异审计钩子（R-2） |
| SC-3 | 敌意 Proxy 反向：W1 视图干净、S3 视图含 `where` | W1 不过滤（total=number）→ S3 键集漂移 → 重派发 W1 仍接受 | 接缝终态 `WINDOW_OPTIONS_INVALID`（既有 S3 机制，零改动覆盖） | 无 | —— |
| SC-4 | 敌意 Proxy 在 W1 首调与 S3 重派发之间翻转视图 | S3 失败 → redispatch → W1 再拒 | 出口①透传 W1 失败成员（既有机制） | 无 | —— |
| SC-5 | W1 首调与 lease 后续调用间 doc 并发写 | 全链同步、读不进 sequencer | 两次调用各自快照语义（D13/NC7 现状） | 无（§9 并发段与 ADR 0008 读边界一致） | —— |
| SC-6 | 校验与过滤之间敌意 where 数组翻转元素视图 | OPT 校验后 E+W 消费谓词 | 过滤必须消费校验时快照 | 无（§8.1 防御性浅拷贝进新鲜对象数组，零别名——本攻击被显式封死） | —— |
| SC-7 | 同一调用内排序下钻与谓词下钻重复读同 field | E+W + S 各自 `drillField` | 同步全程、doc 无并发写，重复读无正确性影响 | 无（§8.4 显式登记成本上界 N×16） | —— |
| SC-8 | 两次导航间 options/where trap 执行用户代码 | descriptor 探测 | 零 `[[Get]]`、零 accessor 执行、trap 抛出收编（W-2/W-6/W-13） | 无（沿 validateWindowOptions L280–286/L309–310 既有 try 纪律） | —— |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER-1 | where 形状非法（空数组/超 16/非 finite/闭集外/未知键/非 plain/hole/accessor/Proxy） | OPT 阶段收编 `WINDOW_OPTIONS_INVALID`，零 doc 触碰（W-1–W-13；V21 保证先于 N0/N1） | 低；V 组 HEAD 伪绿已登记，红证据归 C/D/P/T/Z/Y（R-5） | —— |
| ER-2 | 合法 where + 路径缺席 / 载体不符 | `WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH`（不被 where 吸收；F1/F2 配对） | 低；与 HEAD（OPT 先拒）可观察差异已由 SA6 F1 新用例钉为目标行为 | —— |
| ER-3 | 入选项物化失败（命中项内 detached 等） | M 阶段 fail-fast `PATH_NOT_ALLOWED`，path 精确到项、无半窗（F4 where 变体） | 低 | —— |
| ER-4 | lease 面组合层失败（中间态/接缝） | 四键失败面、无 value/total/truncated（B-9）；新私有构造器 message 非契约 | 低；**新构造器必须沿用 `windowFailure`/`safePathCopy` 同款四键形状与 path 安全副本**（实现细节，§8.6 已隐含单源复用 seamWindowOptionsInvalid 纪律） | N-5（观察项：实现票照 `seamWindowOptionsInvalid` 形态即可） |
| ER-5 | 部分成功/伪成功 | 无半窗、无 memo、模块级零可变态；幂等逐字节一致（防御性拷贝使调用后改写原数组不影响已结算结果） | 低 | —— |
| ER-6 | 回滚 | 单 commit 纯加法 + M1/M2/M3 同票同滚（R-8） | 低 | —— |
| ER-7 | 敌意 where 数组 length 说谎（descriptor 缺失/非非负整数） | W-5 descriptor 读 length，缺失/非法即拒（杜绝 Proxy length get trap） | 低 | —— |

无静默失败、无 fallback 掩盖正常路径不变量：无 where 路径以 `where !== undefined` 守卫逐字节保持（F7/T1–T3/NC1–NC3 锚定）。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| W1 `read*WindowAtPath` options/结果类型加宽 | 无：可选属性加法，旧调用零影响；直读调用方获得过滤能力即缝 1 目的 | V-b/V-f；grep 全消费点 | —— |
| `composeArrayWindowRead`/`composeMapWindowRead` 签名加宽 + 入口分支 | 无未覆盖调用方（全仓唯一消费点 runtime.ts L691/L703，V-f）；#369 组合测试不直接 import compose（V-f） | V-c/V-d/V-f | —— |
| `runtime.readArray/readMap` | 零 diff 主张经现行签名核验成立（类型自然通过，无 cast/兜底）；`pnpm typecheck` 机械门 | V-d | —— |
| lease `readArray/readMap` + 别名链 | 别名自动透传（Equal 锁继续成立）；中间态响亮（SC-1） | V-g | —— |
| `WhereTerm` 公共导出 | type-only；值导出面两枚不变（P-W1/P-W2）；M2 记账含投影断言 | V-g | —— |
| readData 姊妹 / 预算通道 | 冻结；D9 负控钉 `READ_OPTIONS_INVALID` | NC4 | —— |
| 类型锁消费点 | M1 覆盖全仓唯一 total 钉（L215–216）；lease-surface 为别名 Equal 锁自动跟随 | V-h | —— |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| where 形状权威校验 | doc-runtime W1（载体机制、schema 无关；ADR 0028 §9/模块 AGENTS） | §8.3 OPT 内 | 正确 |
| 候选过滤 + total 单源 | W1（枚举/过滤/计数同源；ADR 0029 §8） | §8.4 E+W/A | 正确（组合层零计数零重算维持） |
| 中间态响亮失败构造 | 组合层（接缝失败单源于 window-read.ts；镜像 readData A-2b/A-2c 先例） | D8 新私有构造器 | 正确（注意 R-1 论据修正） |
| lease 零校验透传 | registry（ADR 0028 §9） | D9 零 diff | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 接缝视图不稳定 → 响亮终态 | runtime.ts readData：`canonicalReadOptions` + 重派发 + `seamReadOptionsInvalid`（A-2b/A-2c） | compose 入口 `total===undefined` 分支 + 新构造器 | **一致**（同款「canonical 判据不一致即接缝终态」协议；D8 判据换成结果键位以获得漂移免疫，属加强不是偏离） | 平行机制检查通过：非第二套 cleanup/重试/状态机 |
| options 封闭形状 descriptor 校验 | `validateWindowOptions`/`validateOrderBy`/`canonicalWindowBudget`（键集白名单 + descriptor 读 + try 收编 + present-undefined 剥离） | §8.3 W-1–W-14 逐判据沿 same 纪律 | 一致 | W-5 length descriptor 读是既有纪律在新轴上的正确推广 |
| 单段下钻 | `drillField`（orderBy field 基既有） | D4 复用 | 一致 | 避免「相似能力采用不同协议」 |
| 契约测试家族 | #368 contract-red + design-pins、#381 total-red | D10 新 issue-382 家族文件 + 最小迁移 | 一致 | #368 家族形态（import \* as docRuntime + 独立预言机 + 负控） |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 候选/匹配计数 | W1 A 阶段单点（D6） | compose 直通；S6 零重算 | 低（ADR 0029 §8 下沉已完成，L217 现状吻合） |
| 「where 是否已生效」 | W1 结算 `total === undefined`（B-8） | D8 分支判据；**不**重读 options | 低——比 S3 的 options 二次重读更抗漂移（SC-2/SC-3 双向验证） |
| where 词表形状 | ADR 0029 §2（F5 终态） | §8.3 判据表 + 类型面 | 低 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 纯读、无资源获取 | 无（无订阅/timer/sequencer；读不进写 sequencer） | 同步返回、可重试、零部分状态 | 对称（§9；与 ADR 0008/namespace-runtime AGENTS 一致） |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第三套 options 校验器？ | W1 `validateWindowOptions` + S3 `canonicalWindowBudget` | D8 **不**校验形状、不重读 options——纯结果键位闸门 | 非平行机制（若 D8 改为在组合层重校验 where 形状才算，设计未如此） |
| 第二读路径（流式短路分叉）？ | 单遍枚举骨架 | D7 明示不做短路分叉 | 无（S2 结构审计风险已规避） |
| 新失败码？ | 三码 + PATH_NOT_ALLOWED | D8 复用 `WINDOW_OPTIONS_INVALID` | 无新增（F3） |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW `window.ts`（原地扩：类型/OPT/E+W/A/注释） | 唯一实现落点；§8 列出位点与 DENY 行（validateOrderBy/navigate/collectCandidates/compareCandidates/materializeItem/read.ts 复制件逐字节不动）互补自洽 | —— |
| ALLOW `doc-runtime/src/index.ts`（type-only 一句 + 头注） | A3 义务；现导出块 L49–63 形态吻合 | —— |
| ALLOW `window-read.ts`（两入口 + `WindowComposeInput` 签名加宽；入口分支 + 新私有构造器 + 注释） | SA6 M5 背书；DENY 行明确 S3/canonicalOrderBy 逻辑体不动——本评审核验 D8 不触碰 L157–162/L203–306 判据 | —— |
| ALLOW 三新测试文件 + M1/M2/M3 迁移 | M1 目标 L215–216 为全仓唯一钉（V-h）；M3 注释级零断言改动 | R-3（F 组归位澄清） |
| DENY `runtime.ts` / `lease.ts` / `types.ts` / 既有测试家族 / CONTEXT.md / ADR / 配置 | 零 diff 可行性经类型核验（V-d/V-g）；#381 T9c 等回归面经 V-i/V-j 核验 | —— |
| ALLOW 无无理由扩张；follow-up（缝 2 / 短路 / 词表演进）未掩盖本票必要项 | §13 Follow-up 行三项均 ADR 开放问题登记 | —— |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1–AC6（C/D/P/T/Z 组） | 新契约文件 + FIX-382-A fixture + 独立预言机（SA6 §12.3 已机械给出用例定义） | 无实质缺口；红/绿判定与伪绿登记（V 组）已被设计 §12/§5 正确承接 | —— |
| AC7（F 组） | F1–F6 行为断言 | F7 是 lease 级断言（需 registry 装配），ALLOW 表把它并入 doc-runtime 契约文件组清单，易误导实现票跨包反向 import | R-3 |
| AC8 + 类型面 | 新 `.test-d.ts`（Y1–Y4）+ M1/M2 + 全仓门 | 无 | —— |
| SA8 A2 中间态 | F7 实现期审计 + P4 条件不变式（registry 新文件，缝 1/缝 2 两态皆真） | P4 不变量**不能**侦测「已过滤的静默通过」（ok:true ∧ 条目全满足谓词 ⟹ 不变量绿）；D8 分支自身的存活仅有编译期收窄钉（删除分支 → S6 编译红或被迫 `as number`，两者皆可见），无行为级变异守卫 | R-2 |
| 结构审计 S1–S4 | read.ts sha256 / 落点 / 无 where 基线 / S3 未放宽 | 未含「D8 分支存在且先于 S3」的审计位 | R-2 |
| 反伪绿 | §12.7 十四类变异 → 对应组击穿 | 无「删除/弱化 D8 分支」变异 | R-2 |

## 13. Required revisions

以下均为 **MINOR**（不影响安全实施与验收；不阻断 `approve`），供 SA1 在实现票传递前原位落实：

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
|---|---|---|---|---|---|
| R-1 | MINOR | `packages/namespace-runtime/src/runtime.ts` L980（`function seamReadOptionsInvalid`）；设计 §7 D8 备选拒绝理由 (b) | D8 以「runtime.ts 无构造器，复制即双源」拒绝 runtime.ts 落点——事实错误：runtime.ts 已有 readData 接缝终态构造器。真正论据是：(a) `total` 的类型收窄必须发生在消费点（window-read.ts L177 `kept < total`），runtime.ts 分支无法收窄组合层内部计算，window-read.ts 仍须自行处理 `number \| undefined`（双点处理）；(b) 窗口域失败构造器单源于 window-read.ts（`windowFailure`/`seamWindowOptionsInvalid`） | 修正 D8 (b) 论据为上述收窄/单源论证；结论（compose 入口）不变 | 设计文本不再含与源码矛盾的事实断言；实现票不据错误论据锚定落点 |
| R-2 | MINOR | 设计 §12「SA8 A2 中间态」行 + §12.6 S1–S4 + R-1 行；SA6 §12.3.7 F7/§12.5 P4 | D8 唯一独占防御的敌意漂移通道（SC-2）无任何行为级验证钩子：P4 条件不变式对「已过滤静默通过」恒绿、F7 严格形态仅实现期审计且不含漂移探针、§12.7 变异表无「删除/软化入口分支」变异。缓解在（编译期收窄钉 + 缝 2 落地测试），但 D8 的存在理由恰是该通道 | §12 实现期审计增补两项：① 变异探针——临时删除入口分支（或改 `as number`）+ 构造对 W1/S3 呈不同键视图的 options Proxy 经 lease 调用 → 必须观测到静默已过滤成功面（证明探针有牙）→ 恢复分支后同调用必须 `WINDOW_OPTIONS_INVALID`；② S4 审计补「入口分支先于 S3 且键于 W1 结算 total」检查位 | 实现票 artifacts 含上述变异前后双态证据；审计登记与 S1–S4 同列 |
| R-3 | MINOR | 设计 §11 ALLOW 新契约文件行「C/D/V/P/T/Z/F 组（SA6 §12.3.1–§12.3.7）」vs §12/D10（F7 = 实现期审计 + P4 归 registry 新文件） | F7 是 lease 级断言，doc-runtime 测试文件无法承载（反向依赖 namespace-registry）；ALLOW 组清单与 §12 处置不一致，易致实现票跨包 import | ALLOW 行组清单改为「C/D/V/P/T/Z + F1–F6（F7 见 §12：实现期审计 + P4 耐久形态落 registry 测试）」 | 文件范围与验收映射单一口径；新契约文件零跨包 import |
| R-4 | MINOR | 简报 What to build「位置序短路选窗（凑满 n 个匹配即停）」vs 设计 D7 | v1 不做流式短路与简报散文表述存在口径差（SA6 §7/H8/O3 已裁定为成本纪律/实现自由，可观测结果等价，故非缺陷），但该差异应防止后续票误读为「简报项未交付」 | §13 Follow-up ② 增注一句：「简报『短路』表述按 SA6 §7/H8 裁定以可观测等价兑现；成本短路为登记在案的演进位（触发条件 ~10⁵）」 | follow-up 登记含此注；实现票验收不以短路为门槛 |

## 14. Non-blocking observations

- **N-1（D8 判据的健全性证明）**：`total === undefined ⟺ where 已在 W1 生效` 依赖 B-8 单点不变量（D6：A 阶段 `where === undefined ? candidates.length : undefined`；`candidates.length` 恒数值，含空容器 0）。compose 仅在 W1 成功后被调用（runtime.ts L690/L702 失败早退），失败结算无 total 键——判据无双义来源。建议实现票在 window.ts A 阶段旁保留一行该不变量注释锚（§8.1 已含模块头注释改写，覆盖到位）。
- **N-2（新私有构造器形状）**：须照 `seamWindowOptionsInvalid` 同款纪律：`windowFailure('WINDOW_OPTIONS_INVALID', path, msg)` + `safePathCopy`、message 恒非空、own 键恰四键。§8.6 已声明「新私有构造器」，形态自由度足够，实现票照既例即可。
- **N-3（W-6 非索引 own 属性不参与语义）**：对 where 数组的非索引 own 属性（如 `arr.foo`）忽略而非拒绝，与 options 对象的未知键拒绝纪律形成有意对照（数组=有序索引空间，对象=封闭形状）。判据表已显式写明；如后续票认为应收紧，属词表演进须走 ADR。无需本票动作。
- **N-4（短路口径）**：见 R-4；补充：ADR 0029 备选节「为 total 废掉位置序短路路径……不可接受」的语境是反对「恒输出匹配总数」方案，不构成对「total 恒 undefined 且暂不实现短路」的否定——设计取的是可观测等价 + 成本登记路线，与 ADR 目标不冲突。
- **N-5（lease 中间态 message 变化）**：缝 1 后 lease where 失败的 message 从「未知键」变为新构造器文案（W1 已实际执行过滤后才拒）。message 非契约字段（SA6 §15-O2、B-9 只锁四键形状）；行为断言只锁 code。实现期无需对齐文案。
- **N-6（`#381` T9c label）**：设计 R-6 定为观察项非改动项——正确（断言语义不变绿优先，M4 零改动纪律）。

---

评审产物唯一：本文件。SA2 未修改设计、生产代码、测试或任何其他文件；未运行测试/服务；未调度或等待其他 SA。
