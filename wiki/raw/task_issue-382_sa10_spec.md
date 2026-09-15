# SA10 规范符合性审查 — issue #382：[ADR 0029] P2 `where` 过滤原语（缝 1：doc-runtime）

- 角色：SA10（独立 Spec 审查者）；dispatch `sa-e42d8690-9590-4b64-8e81-b7402f021771`（mabf-sa10，phase spec-review，iteration 0）。
- 被审对象：**已提交最终 diff** `1b639e0ebe825ffbbfce377850c01ef620734f47..03a58c6f38bb09334bb05808779d2611ed786d25`（commit `03a58c6`「feat(doc-runtime): add where window filters」，8 文件，+1699/−38）。
- 权威基准：Parent PR #380 base `1b639e0`（Host 声明已刷新且稳定；本轮 `git rev-parse`/`git log` 复核 HEAD 即其父级单提交）。
- Owner 评论：REST 快照为空（dispatch 明示）——无 owner 需求、无 comment ID/时间戳；验收面 = 简报 AC1–AC8 + ADR 0029 + SA6 契约 + SA8 义务。
- 方法声明：SA10 全程只读（diff 全量、源码现行态、测试全文、ADR、wiki 产物、artifacts 日志）；**未运行测试/服务/探针、未修改任何代码/设计/测试**；「绿」结论 = artifacts 日志静态复核 + diff/源码独立比对。唯一写产物 = 本文件。
- 审查范围纪律：只判实现是否忠实满足 Issue 正文/Owner 评论/验收标准与是否越界；通用架构风格与仓库规范属 SA9，不在本报告裁决。

## 1. Verdict

**`approve`** —— 已提交 diff 是 Issue #382 正文（What to build + AC1–AC8）、accepted SA6 契约（B-1–B-11、C/D/V/P/T/Z/F/Y 组、M1–M5、S1–S4）与 ADR 0029 §1–§8 缝 1 要求的**完整且忠实**兑现；无关键 AC partial/unmet/unachievable；无 scope creep。7 项 MINOR/披露项（§6）均不阻断。

## 2. 审查输入与独立复核事实

| 输入 | 状态 |
|---|---|
| 简报 `wiki/raw/task_issue-382.md`（AC1–AC8；Blocked by #381 已 CLOSED） | 在场，逐条映射（§3） |
| SA6 契约 `…_sa6_contract.md`（approve） | 在场，B/C/D/V/P/T/Z/F/Y/M/S 逐组核对（§3/§4） |
| ADR 0029（accepted）+ ADR 0028/0027/0024 | 在场，§1–§8 逐条款核对（§4） |
| SA1 设计（iteration 1，SA2 approve R-1–R-4）+ 三轮 SA8（全部 `clear`；A1–A5/F1–F8/A1′–A4′/A6′/A1″–A3″） | 在场，义务逐条核对（§5） |
| SA3 实现报告 + SA4 审查（approve，0 BLOCKER/0 MAJOR/6 MINOR） | 在场；与 committed diff 对账一致（被审的「未提交 diff」= 现 commit `03a58c6` 内容：恰 5 修改 + 3 新测试） |
| 12 份 `artifacts/sa3-issue382-*.log` | 在场（untracked，见 §6-D2）；全部通读/尾段复核，时间线自洽 |

SA10 独立复核（非转抄上游）：

| # | 复核项 | 方法 | 结果 |
|---|---|---|---|
| X1 | 变更文件集 = 恰 8 个 ALLOW 路径（3 src：`window.ts`/`index.ts`/`window-read.ts`；2 迁移测试；3 新测试）；`read.ts`/`runtime.ts`/`lease.ts`/`types.ts`/`CONTEXT.md`/`docs/**`/配置**零 diff** | `git diff --name-only 1b639e0..HEAD` | 一致（F6/D9/DENY 保持） |
| X2 | `read.ts` sha256 = `3bf6b8b0…b1b312`（F6 冻结值） | `sha256sum` 实算 | 一致 |
| X3 | `runtime.ts` 消费点 L691/L703 直传 `windowResult.total` 交加宽 compose；无 cast/兜底 | 源码 grep 亲证 | 成立（M5；root typecheck exit 0 佐证） |
| X4 | D8 分支形态：`composeWindowRead`（L158）函数体第一句可执行语句 = L168 `if (input.total === undefined) return seamWhereNotImplemented(input.path);`，先于 S3（L173）；S3 白名单 L230 仍恰四键；新构造器 L440 经单源 `windowFailure` | 现行源码通读 | A2′ 四纪律逐点成立 |
| X5 | 新测试三文件零 `.skip/.only/.todo/xit/xdescribe`；doc-runtime 契约文件零跨包 import（仅 `vitest`/`yjs`/`../src/index.js`） | grep 亲证 | 成立 |
| X6 | 临时探针零残留（`__sa3_382*`/`__sa6_382*` 两测试目录 ls 零命中） | ls/grep | 成立 |
| X7 | 红灯基线与绿证据链自洽：HEAD 还原态契约 44 failed/32 passed（红因逐条 =「未知键：where」）+ 类型 9 errors/3 failed → 实现后聚焦 11 文件 226 用例 + `Type Errors no errors` → 全仓 396 文件/4827 用例 exit 0（625.65s）→ `pnpm typecheck` 14 工程 exit 0 | 日志交叉读 | 与 SA3 V-1–V-10、SA8 K7 吻合 |
| X8 | A6′ 双态证据：变异态（删分支 + `?? 0`）分视图 Proxy 经 lease → `ok:true truncated:false keys=["t3"]`（静默已过滤成功面，探针有牙）∧ plain 对照仍 `ok:false`；还原态 → `ok:false WINDOW_OPTIONS_INVALID` ∧ `ownKeysCalls=1`；纯删除变体 `tsc` exit 2（TS18048+TS2345） | d8-probe 三日志亲读 | 齐全 |
| X9 | 结构审计 S1–S4（含 S4 增补位）全过；镜像标记 `copied from read.ts@36a73bb` 10→10 不减；diff 内零 subscribe/observe/memo/cache 新增 | structural-audit.log 亲读 + diff 对照 | 成立 |

## 3. Issue 正文与 AC 逐条核对

### 3.1 「What to build」逐句

| 简报要求 | 实现证据 | 判定 |
|---|---|---|
| 两面接受可选 `where`（谓词项列表合取过滤），键/序容器按条目值单段属性等值筛选 | `window.ts`：`WhereTerm`（L67–70）+ 两面 options `where?: readonly WhereTerm[]`；`whereMatches`/`matchesWhereTerm` 复用 `drillField` 单段下钻 + 严格 `===` | 满足 |
| 管线序 where → orderBy → n（匹配子集上选窗） | 过滤内联 E 阶段枚举循环（先于 S 排序与 n 前缀）；P1–P5 钉管线序（P1「排序→取 n→过滤」变异必红） | 满足 |
| 位置序短路选窗（凑满 n 个匹配即停） | 以**可观测等价**兑现（D7 单遍全枚举 + 内联过滤 + 排序 + 前缀；value/total/顺序与短路逐位一致）——SA6 §7/H8/O3、SA2 R-4、SA8 DR-19 三轮已裁定短路 = 成本纪律/实现自由、非行为断言 | 满足（已批准口径；披露项 §6-D1） |
| where 在场 `total` 为 undefined（匹配总数不承诺） | A 阶段单点分支 `where === undefined ? candidates.length : undefined`（own 键恒在，匹配数有意不报告）；T4–T6 `hasOwnProperty` 判定 | 满足 |
| WhereTerm v1 = `{field: 单段字面键, equals: string\|number\|boolean\|null}`，number 须 finite | 类型逐字对应；`validateWhereEquals` 闭集 + `Number.isFinite` 门；`field` 恰 string 零强制转换（V8 计数器证不调 `toString`） | 满足 |
| 直接可验：`readMapWindowAtPath(doc, ['tasks'], {n:5, where:[{field:'state',equals:'claimed'}]})` | C1 逐字用例（t1,t3,t5 + total undefined + 恰三键） | 满足 |

### 3.2 AC1–AC8

| AC | 验收面（SA6 映射） | 实现与测试证据 | 判定 |
|---|---|---|---|
| AC1 合取正确性矩阵（多条件/field 缺席/值非标量/non-finite/同 field 重复/标量元素数组面/四载体族） | C1–C11、D1–D12、P1–P5 | 76 用例契约文件全组在场：四载体 fixture（Y.Map/plain/Y.Array/plain array）、C5 falsy 合法标量、C7 点号不拆分、C11 显式 undefined ≡ 缺席、P4 跨字段合取、D11 同 field AND 收敛 | **满足**（focused-family.log 76/76 绿） |
| AC2 安静不匹配（equals:null 双向、不炸读、不挤正常项） | D1–D12 | D3 在场 null 匹配/缺席与显式 undefined 不匹配（`mapMatchesOracle` 独立预言机对账）；D4–D6 脏条目全安静；D1 n=50 零挤出 | **满足** |
| AC3 入参侧响亮（空数组/超 16/非 finite/非闭集/未知键/非法原型/形状漂移 → `WINDOW_OPTIONS_INVALID`） | V1–V21 | V1–V21 全组在场；V3（恰 16 合法）/V20（`where:undefined` ≡ 缺席）两反向边界 `ok:true` 锚定校验器非「见 where 即拒」 | **满足** |
| AC4 敌意 options 零 `[[Get]]`/零外抛/收编响亮 | V11–V17 | 全 descriptor 读 + 双层 try 收编；V11/V15/D7 计数器 `=== 0`；V13/V14 四 trap 抛 Proxy 零外抛 | **满足** |
| AC5 零物化哨兵（未匹配条目内埋 non-finite/稀疏空洞毒值必须 `ok:true`） | Z1–Z8 | Z1–Z8 在场（N=2000：NaN 标量/NaN 值键/空洞/未匹配内埋 payload:NaN/嵌套空洞）；NC8 证哨兵有牙（同毒值经姊妹全量物化确实 `PATH_NOT_ALLOWED`） | **满足** |
| AC6 where 在场 `total === undefined`；缺席 = 标识计数（P1 零回归） | T1–T6 | T1–T3 无 where 数值计数（独立预言机）；T4/T5 有 where own 键在场且 undefined（matches≥n 与 <n/0 双向，禁 JSON 判定） | **满足** |
| AC7 三失败码不回归；where 不触碰 orderBy 词表（readArray 仍仅 `by:'index'`） | F1–F6、C8/V18 | 零新码；`validateOrderBy` 函数体逐字节未动（SA4 V-b 16/16 SAME，本轮 diff 无该函数 hunk）；C8/V18 三向语境外排序仍拒；F4 `PATH_NOT_ALLOWED` where 变体 fail-fast 无半窗 | **满足** |
| AC8 缝 1 测试先例（#368 家族同款）+ 全仓 typecheck/测试绿 | §12.5/§12.6/§14 | 新三文件沿 `import * as docRuntime` + `expectWindowOk/Err` + fixture builder + 独立预言机 + NC 组家族形态；全仓 396 文件/4827 用例 exit 0、14 工程 typecheck exit 0（日志复核） | **满足** |

## 4. ADR 0029 §1–§8（缝 1 范围）逐条款核对

| 条款 | 要求 | 实现 | 判定 |
|---|---|---|---|
| §1 公共面 | options 增 `where: readonly WhereTerm[]`；不新增第四读方法；不改 readData；恒四键/十四键面不动 | 两面 options 加法；无新方法/新值导出（NC6 恰两枚）；`read.ts` 零 diff（X2）；lease 四键基线不变（P4 负控 `'total' in result === false`） | 满足 |
| §2 WhereTerm v1 | 两键必填、标量闭集、finite、合取、空数组拒、上限 16、同 field 重复合法、形状终态 | `WHERE_TERM_LIMIT = 16` 具名单点；W-9 恰两键白名单；无 in/范围/OR/NOT/多段/深相等入口（词表零扩大） | 满足 |
| §3 不匹配处置 | 数据侧安静不匹配 × 入参侧响亮 | `drillField → undefined ⇒ false`；非标量/non-finite 恒 false；入参三校验函数全响亮收编同码 | 满足 |
| §4 管线序与对称性 | where → orderBy → n；readArray 对称获得；where 不触碰 orderBy 面词表；过滤进 doc-runtime 原语 | E+W 内联过滤先于 S/M；两面对称；orderBy 判据体未动；过滤落 W1 原地（S2 审计：零新读路径/模块） | 满足 |
| §5 结算（缝 1 面） | total 键恒在：无 where 计数/有 where undefined；匹配总数恒不承诺 | A 阶段单点分支；匹配数有意不报告；truncated 双语义/✂ 永不装配**未实现**（缝 2 面，正确未做——where 路径 compose 入口即拒，到不了 S6） | 满足（缝 2 义务见 §6-D6） |
| §6 敌意校验（W1 层） | 恰两键白名单、plain 原型链、零 `[[Get]]`、零 accessor、trap 收编；三码族复用 | W-1–W-14 判据全落地；零新码；**S3 镜像未扩**——缝 2 后置（SA8 DR-6/DR-11 已裁定分阶段合法，中间态由 D8 分支保持响亮，严于 S3 单独把关） | 满足 |
| §7 schema 无关 | 谓词比较实际数据值；不得援引为规则引擎先例 | 只消费载体原始值；零 schema/领域语义注入 | 满足 |
| §8 W1 冻结解除 | `window.ts` 原地扩 where 与 total | 原地扩、零新 src 文件；total 单源 W1（组合层零计数零重算维持） | 满足 |

ADR 0029 验收缝 1 六项（过滤矩阵/total 双形态/零物化哨兵/敌意形状校验/三失败码/#368 先例）全部闭合（§3.2）。ADR 0028 基契约（总序/平局锚/三码/零物化/分层）经 F1–F6、NC1–NC8 与既有家族（#368 47+11、#381 14、#369 17+33、surface guards）全绿保持。

## 5. SA8 义务与缝序约束核对

| 义务 | 实现 | 判定 |
|---|---|---|
| A1/A1′ 词表纪律 | v1 闭集即终态；16 哨兵未改；演进位零入口 | 落实 |
| A2/A2′ 缝序一致性（中间态响亮） | D8 compose 入口 fail-closed：第一句/先于 S3/键于 W1 结算 `total===undefined`/单源四键构造/S3 判据体逐字节不动/runtime·lease·types 零 diff（X1/X3/X4）；与 HEAD E5 同码同向；敌意漂移通道经双态探针实证封死（X8） | 落实 |
| A3/A3′ 公共面守卫 | `export type { WhereTerm }` type-only（字母序 `'Wh'<'Wi'`）；M2 记账/投影断言；P-W1/P-W2 值导出恰两枚 | 落实 |
| A4/A4′ 冻结面 | X1/X2：read.ts sha256 一致、runtime/registry 零 diff、无 where 路径 `where !== undefined` 守卫逐字节 | 落实 |
| A5 测试先例 | #368 家族形态 + 全仓门绿 | 落实 |
| A6′ 敌意漂移双态证据 | X8 齐全（探针有牙 + 分支存活 + 编译期第二道），与 S1–S4 同列登记 | 落实 |
| F1–F8 冻结面 | F1 readData options 零触碰（NC4 `READ_OPTIONS_INVALID`）；F2 lease 恒四键；F3 零新码；F4 orderBy 词表；F5 where 形状终态；F6 read.ts；F7 无 where 零回归；F8 ✂ 零触碰（缝 2 终态待核对） | 逐项保持 |
| SA2 R-1–R-4 | R-1 D8 落点论据（消费点收窄 + 单源构造）、R-2 行为级钩子（双态探针 + S4 增补位）、R-3 F7 归位（契约文件零跨包 import；P4 落 registry）、R-4 短路口径注 | 逐条落实 |

## 6. MINOR / 披露项（均不阻断 approve）

- **D1（披露，短路口径）**：简报「位置序短路选窗（凑满 n 个匹配即停）」按 SA6 §7/H8/O3 + SA2 R-4 + SA8 DR-19 的已批准裁定以**可观测等价**兑现（value/total/顺序与短路逐位一致；P5/Z5 锚定）；实现未做流式短路（D7 单遍全枚举），成本短路是登记在案的演进位（触发 ~10⁵）。PR 必须披露此口径注，防后续票误读为「简报项未交付」。
- **D2（披露，证据落盘）**：12 份 `artifacts/sa3-issue382-*.log` 为 untracked（不在 committed diff 内）；仓内 `artifacts/` 既有 sa3/sa6/sa7 日志均 git tracked。建议随实现同票提交，否则 A6′/S1–S4 证据链不随仓存活（SA4 OBS-4 同主张）。
- **D3（MINOR，测试组织）**：T 组以 5 个 `it` 覆盖 SA6 表格 T1–T6（T4/T6 合并，断言集同点）；覆盖等价（SA4 OBS-1）。
- **D4（MINOR，敌意面判别力）**：V13/V14 只断言「响亮 ∧ 零外抛」（与 SA6 规格一致）；零 `[[Get]]` 判别由 V11/V15/D7 计数器承担，防线完整（SA4 OBS-2）。
- **D5（MINOR，遗留 label）**：#381 T9c label「未知键」语义过时（`where:'x'` 新因 = 非数组，断言仍同码绿）；M4 零改动纪律维持（SA4 OBS-3/设计 R-6）。
- **D6（披露，缝 2 未闭合义务，非本票范围）**：lease 面 where 接收、`truncated` 双语义、✂ 有 where 永不装配、S3 镜像「两层同步扩」属缝 2，须在 **PR #380 阶段收官前**由缝 2 票闭合并**整体取代 D8 分支**（SA8 A1″/A2′）；届时 F7 严格断言预期翻转（P4 条件不变式无退役义务）。本票中间态响亮纪律正确，但 PR 必须披露「两层同步扩」尚未履行。
- **D7（披露，后续动态验证）**：SA6 §12.7 十四类变异中 13 类（除已核 D8 类）的动态击穿移交复核票（SA8 A2″）；CI 首跑待 push 后验证（SA4 §11）。

## 7. 范围判定（无 scope creep）

diff 恰为设计 §11 ALLOW 全集：唯一实现落点 `window.ts` 原地扩 + type-only 导出 + `window-read.ts` 消费边界显式分支；无第四读方法、无新公共值导出、无新失败码、无新 src 模块、无 readData/预算轴渗入、无 lease 四键/`truncated`/✂ 改动、无 CONTEXT/ADR/配置改动、无词表扩大（in/范围/OR/NOT/多段 field/深相等全部响亮拒绝）、无缝 2 语义偷跑（lease where 保持响亮失败）。既有测试迁移精确限于 M1（total 钉加宽自证）/M2（WhereTerm 记账）/M3（#368 头注注释级 2 行），M4 零改动文件全部未触碰。

## 8. 结论

实现忠实且完整地满足 Issue #382 正文、accepted SA6 契约与 ADR 0029 缝 1 全部验收要求；三轮 SA8 冲突门禁（前置/设计后/实现后）均 `clear`，SA2/SA4 均 approve；红/绿证据链与 A6′ 双态证据齐全且经本轮独立复核自洽。**无关键 AC partial/unmet/unachievable，verdict = `approve`**；§6 七项 MINOR/披露项随 PR 披露，不构成阻断。

---

SA10 未修改任何实现、设计或测试；未运行测试/服务/探针；未调度其他 SA；未 commit/push/创建 PR/finalize；唯一写产物 = 本文件。
