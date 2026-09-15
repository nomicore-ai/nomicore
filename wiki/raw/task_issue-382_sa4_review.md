# SA4 实现后红队审查 — issue #382：[ADR 0029] P2 `where` 过滤原语（缝 1：doc-runtime）

- 角色：SA4（实现静态审查者）；dispatch `sa-2eaa5c08-7bd9-42f9-be81-c4b0bd3f7df9`；iteration 0。
- 被审对象：worktree `/home/wangjian/nomicore-fix-issue-382` 当前未提交实现（5 修改 + 3 新测试 + 12 份 `artifacts/sa3-issue382-*.log`）+ SA3 报告 `wiki/raw/task_issue-382_sa3_impl.md`（dispatch `sa-34864478-43cc-451c-a169-8f49c7860975`，iteration 0）。
- 基准：HEAD `1b639e0ebe825ffbbfce377850c01ef620734f47`（与设计/SA6/SA8 三方基准快照一致，本轮 `git rev-parse HEAD` 复核）。
- 方法声明：SA4 全程只读（源码、diff、测试、ADR、AGENTS、wiki 产物、artifacts 日志）；**未运行任何测试/服务/探针、未创建临时进程**（skill 纪律）；所有「绿」结论为 artifacts 日志静态复核 + 结构/行为断言静态推演，非本评审自跑。唯一写产物 = 本文件。
- Owner 评论：REST 快照为空（无 comment ID/时间戳）——与简报、SA6 §2、SA2 §4、三轮 SA8 五方一致；无 owner 口径遗漏问题。

---

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| 简报 `wiki/raw/task_issue-382.md`（AC1–AC8） | 在场 | 通读；AC 逐条映射（§3） |
| 设计 `wiki/raw/task_issue-382_design.md`（SA1 iteration 1） | 在场 | §8.1–§8.7/§11 ALLOW-DENY/§12 逐项对照 diff（§4） |
| SA2 评审 `wiki/raw/task_issue-382_sa2_review.md`（approve，R-1–R-4） | 在场 | 逐条落实核对（§3.1） |
| SA6 契约 `wiki/raw/task_issue-382_sa6_contract.md`（approve） | 在场 | B-1–B-11、C/D/V/P/T/Z/F/Y、M1–M5、S1–S4、§12.7 变异表逐项（§3/§9） |
| SA8 前置 `…_conflict_report.md`（clear，A1–A5/F1–F8） | 在场 | 义务逐条（§3.2） |
| SA8 设计后 `…_design_conflict_report.md`（clear，A1′–A4′+A6′） | 在场 | 分支形态四纪律 + 双态证据核对（§4 D8 行、§8） |
| SA8 实现后 `…_implementation_conflict_report.md`（clear） | 在场 | K1–K10 独立复核（§2 独立验证） |
| SA3 报告 `…_sa3_impl.md` | 在场 | 全文 + 与实际 diff/日志逐项对账 |
| 实现事实 | — | `git diff` 全量逐 hunk；`window.ts`/`window-read.ts`/`index.ts` 现行全文关键区通读；冻结函数体 sha256 对 HEAD 逐件比对（§2） |
| 测试事实 | — | 3 新测试文件全文 + 2 迁移文件 diff；`vitest.config.ts` include + `tsconfig.typecheck.json` 采集；CI `ci.yml` 触发面 |
| 证据日志 | — | 12 份 `artifacts/sa3-issue382-*.log` 全部通读/抽样尾段复核（时间线 09:31→09:56 自洽：红灯基线 → D8 探针 → 变异 tsc → 结构审计 → 首轮全仓红（收敛门）→ 修复后全仓绿 → 聚焦家族复跑） |

## 2. Verdict

**`approve`**（无 BLOCKER、无 MAJOR；6 项 MINOR/观察项入 §12，均不阻断）。

核心结论：实现是已批准设计（iteration 1）与 SA6 契约的忠实落地——W1 `where` 合取过滤（管线序 where → orderBy → n、E 阶段内联、每 child 每 term 恰一次单段下钻）、`total` 值域加宽（own 键恒在、有 where 恒 undefined）、OPT 五键白名单 + W-4–W-13 descriptor 纪律校验、D8 compose 入口 fail-closed（先于 S3、键于 W1 结算、单源四键构造）全部逐点兑现；全部冻结面（read.ts 零 diff + sha256、S3/orderBy 判据体逐字节、runtime/lease/types 零 diff）经本评审独立重算证实；A6′ 双态变异证据齐全且探针有牙。

本评审独立静态验证（非转抄 SA3/SA8）：

| # | 验证项 | 方法 | 结果 |
|---|---|---|---|
| V-a | `read.ts` sha256 = `3bf6b8b0…b1b312`；`git diff` 空 | `sha256sum` + `git diff --stat` | 一致（F6 保持） |
| V-b | 冻结函数体逐字节：`validateOrderBy`/`navigate`/`compareCandidates`/`materializeItem`/`readableOwnDataValue`/`readableArrayElement`/`isPlainRecord`/`classifySortKey`/`compareSortKeys`/`compareCodePoints`/`safeSpreadPath`（window.ts）+ `canonicalWindowBudget`/`canonicalOrderBy`/`windowFailure`/`seamWindowOptionsInvalid`/`safePathCopy`（window-read.ts） | awk 函数体提取 + 工作区 vs HEAD sha256 逐件比对 | **16/16 SAME**（F4/S3 判据体/A2′④ 证实） |
| V-c | `runtime.ts`/`lease.ts`/`types.ts`/`CONTEXT.md`/`docs/**`/`vitest.config.ts`/`package.json`/`tsconfig*.json` 零 diff | `git status --porcelain` + `git diff --stat` | 零改动（D9/M4/DENY 证实） |
| V-d | D8 分支形态：`composeWindowRead`（L158）函数体**第一句可执行语句** = L168 `if (input.total === undefined) return seamWhereNotImplemented(input.path);`；先于 S3（`canonicalWindowBudget` 调用 L173，其键集白名单 L230 仍恰四键）；判据键于 `input.total`（W1 结算直通，非 options 重读、非 where 形状校验）；`seamWhereNotImplemented`（L440）经 `windowFailure`（L416，`safePathCopy` 四键单源） | 现行源码行号亲证 + structural-audit.log 对账 | A2′ 四纪律逐点成立 |
| V-e | A 阶段单点分支：`total: validated.value.where === undefined ? candidates.length : undefined`（三键字面量构造，own 键恒在） | `windowCore` 现行源码亲证 | B-8/D6 成立 |
| V-f | 防御性浅拷贝：`validateWhere` 产物 `out.push(term.term)` 为新鲜 plain 对象数组（与调用方零别名，SC-6 封死） | 源码亲证 | 成立 |
| V-g | 全仓 `ReadArrayWindowResult`/`ReadMapWindowResult` 消费点在 doc-runtime 外 = **零**；compose 唯一生产消费点 = `runtime.ts` L691/L703（直传 `windowResult.total`，无 cast/兜底）；`WhereTerm` 消费面 = doc-runtime src + 3 测试文件 | 全仓 grep | §7 契约连锁面完备 |
| V-h | 临时探针零残留：`__sa3_382*`/`__sa6_382*` 全仓 grep 零命中；D8 探针测试文件已删 | grep | SA6 §16/SA3「已删除」主张成立 |
| V-i | 日志内部一致性：红灯基线（src 还原 HEAD 后契约 44 failed/32 passed、类型 9 errors/3 failed）→ 实现后聚焦 11 文件 226 用例 + `Type Errors no errors` → 全仓 396 文件/4827 用例 exit 0 → `pnpm typecheck`（14 工程）exit 0 → D8 双态（变异态 `ok:true truncated:false keys=["t3"]` ∧ plain 对照仍拒 ∧ `stackDiscriminated=true ownKeysCalls=2`；还原态 `ok:false` ∧ `ownKeysCalls=1`）→ 纯删除变体 `tsc` exit 2（TS18048+TS2345） | 12 份日志交叉读 | 与 SA3 报告 V-1–V-10、SA8 K7/K8 逐项吻合，无矛盾 |

## 3. 上游要求落实

### 3.1 简报 AC × SA2 R-1–R-4

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 合取正确性矩阵（多条件/field 缺席/非标量/non-finite/同 field 重复/标量元素数组面/四载体族） | `window.ts` E+W 内联过滤 + `whereMatches`/`matchesWhereTerm`；契约测试 C1–C11（76 用例文件内）+ 四载体 fixture（Y.Map/plain object/Y.Array/plain array——plain 值经 Yjs `ContentAny` 原样存活，#368 家族同款装载） | 落实 |
| AC2 安静不匹配纪律（equals:null 双向、不炸读、不挤正常项） | `drillField→undefined ⇒ false` + `matchesWhereTerm` typeof/finite/严格 `===` 门；D1–D12（含 D3 equals:null、D7 accessor 计数器 === 0） | 落实 |
| AC3 入参侧响亮（空数组/超 16/非 finite/非闭集/未知键/非法原型/形状漂移 → `WINDOW_OPTIONS_INVALID`） | `validateWhere`/`validateWhereTerm`/`validateWhereEquals`；V1–V21（V3/V20 反向边界 `ok:true` 在场） | 落实 |
| AC4 敌意 options 零 `[[Get]]`、零外抛、收编响亮 | 全 descriptor 读（含 length/逐下标）、双层 try + E100 backstop；V11–V17（计数器断言 0） | 落实 |
| AC5 零物化哨兵 | 谓词单段下钻 + 仅入选项物化；Z1–Z8（毒值/空洞/未匹配内埋毒/嵌套空洞，N=2000） | 落实 |
| AC6 total 双形态 | A 阶段单点分支；T1–T6 + `hasOwnProperty` 判 own 键（禁 JSON）；类型锁 M1/Y3 加宽 `number \| undefined` | 落实 |
| AC7 三失败码不回归 + orderBy 词表不动 | `validateOrderBy` 函数体 sha256 SAME；F1–F6 + C8/V18 三向负例；失败面恰四键 | 落实 |
| AC8 #368 家族先例 + 全仓绿 | 3 新文件沿 contract-red/type-guard 家族形态（`import * as docRuntime` + 独立预言机 + NC 组）；全仓 396/4827 + typecheck exit 0（artifacts 复核） | 落实 |
| SA2 R-1（D8 落点论据：类型收窄在消费点 + 失败构造单源） | 分支落 window-read.ts，`const total = input.total;` 单点收窄（无 `?? 0`/`as number`）；`seamWhereNotImplemented` 复用 `windowFailure` 单源；runtime.ts 零 diff 且 typecheck exit 0 | 落实 |
| SA2 R-2（敌意漂移缺行为级钩子） | D8 双态探针证据（mutated：`ok:true truncated:false keys=["t3"]` 已过滤静默面 ∧ plain 隔离对照；live：`ok:false` ∧ `ownKeysCalls=1`）+ S4 增补检查位入 structural-audit.log | 落实 |
| SA2 R-3（F7 归位、零跨包 import） | doc-runtime 契约文件仅 import `vitest`/`yjs`/`../src/index.js`，组清单 C/D/V/P/T/Z + F1–F6；F7 严格形态仅实现期审计；P4 条件不变式落 registry 新文件 | 落实 |
| SA2 R-4（短路口径注） | D7 单遍全枚举实现；P5/Z5 锚定可观测等价；无第二读路径/流式分叉 | 落实 |

### 3.2 SA8 义务（A1–A5 / A1′–A4′ / A6′）

| 决议或义务 | Implementation evidence | Assessment |
|---|---|---|
| A1/A1′ 词表纪律 | 键集恰两键、闭集 + finite、零 truthiness、零强制转换、16 哨兵具名常量 `WHERE_TERM_LIMIT` 未改；无 in/范围/OR/NOT/多段/深相等入口 | 落实 |
| A2/A2′ 缝序一致性（中间态响亮） | V-d 四纪律逐点；中间态与 HEAD E5 同码同向（`WINDOW_OPTIONS_INVALID`）；S3 未放宽、无绕过通道（探针实证漂移态被入口分支封死） | 落实 |
| A3/A3′ 公共面守卫 | `index.ts` `export type { WhereTerm }` type-only（字母序 `'Wh'<'Wi'`）；M2 记账/投影断言；NC6 + P-W1/P-W2 值导出恰两枚 | 落实 |
| A4/A4′ 冻结面 | V-a/V-b/V-c 全部 SAME/零 diff；镜像标记 10→10 | 落实 |
| A5 测试先例 | #368 家族形态 + 全仓门绿（artifacts） | 落实 |
| A6′ 敌意漂移双态证据 | V-i：双态 + 编译期第二道（纯删除 exit 2；`?? 0` 变体可编译 → 行为级探针不可替代的论据成立）；与 S1–S4 同列登记 | 落实 |
| F1–F8 冻结面 | F1（readData options 零触碰，NC4 `READ_OPTIONS_INVALID`）；F2（lease 恒四键，P4 负控 `'total' in result === false`）；F3（零新码）；F4（validateOrderBy SAME）；F5（v1 闭集即终态）；F6（sha256 一致）；F7（无 where 全家族绿）；F8（where 路径到不了 S6/✂） | 逐项保持 |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| D2/§8.1 类型面（`WhereTerm` 两键全必填、两面 `where?: readonly WhereTerm[]`、成功面 `total: number\|undefined`、`NormalizedWhereTerm`/`ValidatedWindowOptions.where`） | `window.ts` L62–91/L122–133/L181–193 | 逐字对应 | —— |
| D5/§8.3 OPT 校验（五键白名单 W-1；accessor 拒 W-2；present-undefined ≡ 缺席 W-3；数组性 W-4；descriptor 读 length + 0/16 门 W-5；逐下标 descriptor + 空洞/accessor 拒 W-6；元素值门 W-7；plain/null 原型 W-8；恰两键 W-9；field 零强制转换 W-10；equals 闭集 + finite + 禁 truthiness W-11/W-12；trap 收编 W-13；n/orderBy 不动 W-14） | `validateWindowOptions` L309–353 + `validateWhere` L362–405 + `validateWhereTerm` L407–461 + `validateWhereEquals` L463–476 | 十四判据逐条在场；W-3 顶层豁免与 W-9 term 层不豁免的有意相反正确落地 | —— |
| D3/§8.4 E+W 内联过滤（map 面复用循环内已读 child；array 面 where 在场逐下标原始读一次：Y.Array `get(i)` / plain `readableArrayElement`，`kind !== 'ok'` 安静跳过；where 缺席 array 面零元素读） | `enumerateArrayCandidates` L687–721 / `enumerateMapCandidates` L723–748（`where !== undefined` 守卫） | 与设计逐句对应；空洞/越界/accessor 下标安静不匹配 vs 物化位 `PATH_NOT_ALLOWED` 的双语义分界按 §8.4 落地（D9/Z3 vs NC8 各锚） | —— |
| D4 谓词下钻复用 `drillField` + 标量等值判定 | `whereMatches` L755–763 / `matchesWhereTerm` L769–776；`drillField` 本体零改动仅注释扩写 | 单段原始读、绝不整项物化 | —— |
| D6 A 阶段 total 单点分支 | `windowCore` L247–250 | own 键恒在；匹配数有意不报告 | —— |
| D7 不做流式短路（单遍全枚举 + 匹配集排序 + 前缀） | 骨架零分叉（无第二读路径）；P5/Z5 可观测等价锚 | 与简报「短路」以 SA6 §7/H8/O3 裁定的等价口径兑现（R-4 注在案） | —— |
| D8 compose 入口 fail-closed + 新私有构造器 | V-d；`WindowComposeInput.total`/两入口签名加宽；`seamWhereNotImplemented` 四键单源 | A2′ 四纪律逐点成立；S3/S5/S6 语义零改动 | —— |
| D9 runtime/registry/lease 零 diff | V-c | typecheck 机械门佐证（root typecheck exit 0，无 cast/兜底） | —— |
| D10/M1–M5 测试迁移 | M1（L215–216 加宽 + 注释）/M2（导入/声明/投影断言）/M3（#368 头注注释级）diff 亲证；M4 零改动文件未触碰；M5 = window-read.ts 消费边界显式分支 | 迁移面精确、无越界 | —— |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| where 形状权威校验 | doc-runtime W1（载体机制、schema 无关；ADR 0028 §9） | `window.ts` OPT 内 | 正确 |
| 候选过滤 + total 单源 | W1（ADR 0029 §8 下沉后单源） | E+W + A 阶段单点 | 正确（组合层零计数零重算维持） |
| 中间态响亮失败构造 | 组合层 window-read.ts（接缝失败单源，镜像 readData A-2b/A-2c 先例） | `seamWhereNotImplemented` 经 `windowFailure` | 正确（非第三套校验器：不重读 options、不校验形状） |
| lease 零校验透传 | registry（ADR 0028 §9） | `lease.ts` 零 diff 裸透传 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 接缝视图不稳定 → 响亮终态 | runtime.ts readData `canonicalReadOptions` + 重派发 + `seamReadOptionsInvalid` | compose 入口 `total===undefined` 键位闸门 + `seamWhereNotImplemented` | 一致（同族协议；判据换结果键位获漂移免疫，SA8 DR-6 已裁） | 非平行机制 |
| options 封闭形状 descriptor 校验 | `validateWindowOptions`/`canonicalWindowBudget`（键集白名单 + descriptor 读 + try 收编） | W-1–W-14 同款纪律 | 一致 | length descriptor 读是既有纪律在新轴的推广 |
| 单段下钻 | `drillField`（orderBy field 基既有） | 直接复用 | 一致 | 避免同能力双协议 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 候选/匹配计数 | W1 A 阶段单点 | compose 直通；S6 零重算 | 低 |
| 「where 是否已生效」 | W1 结算 `total === undefined`（B-8） | D8 分支判据（不重读 options） | 低（比 S3 options 二次重读抗漂移；探针双态实证） |
| where 词表形状 | ADR 0029 §2（终态） | 类型面 + §8.3 判据 | 低 |

### 生命周期对称性

纯读、零资源获取/订阅/timer/sequencer 触点；读不进写 sequencer（ADR 0008 边界维持）；registry P4 测试自身 `withLease` finally 中 `lease.release()` + `registry.shutdown()` 对称清理。无不对称项。

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第三套 options 校验器？ | W1 `validateWindowOptions` + S3 `canonicalWindowBudget` | D8 不校验形状、不重读 options | 非平行机制 |
| 第二读路径（短路分叉）？ | 单遍枚举骨架 | 无分叉 | 无 |
| 新失败码？ | 三码 + `PATH_NOT_ALLOWED` | D8 复用 `WINDOW_OPTIONS_INVALID` | 无新增 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/doc-runtime/src/window.ts` | ALLOW 行 1 | §8.1/§8.3/§8.4/A 阶段/注释 | ✅ 原地扩；冻结邻体逐字节（V-b） |
| `packages/doc-runtime/src/index.ts` | ALLOW 行 2 | type-only 导出 + 头注 | ✅ |
| `packages/namespace-runtime/src/window-read.ts` | ALLOW 行 3（仅签名/入口分支/注释） | D8/M5 | ✅ S3/canonicalOrderBy 判据体 SAME（V-b） |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | ALLOW 行 4 | M1/M2 | ✅ |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` | ALLOW 行 5 | M3 注释级 | ✅ 零断言改动（diff 仅 2 行头注） |
| `packages/doc-runtime/test/issue-382-where-window-contract-red.test.ts`（新） | ALLOW 行 6 | C/D/V/P/T/Z + F1–F6 + NC | ✅ 零跨包 import |
| `packages/doc-runtime/test/issue-382-where-window-type-guard.test-d.ts`（新） | ALLOW 行 7 | Y1–Y4 | ✅ |
| `packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts`（新） | ALLOW 行 8 | P4 条件不变式 | ✅ helper 相对导入有 5+ 处既有先例 |
| `artifacts/sa3-issue382-*.log`（12 份） | 非 ALLOW 源码面，但 SA6 §12.5 P6/SA8 A6′ 明令「记入实现票 artifacts 与 S1–S4 同列」；仓内 `artifacts/` 已有 sa3/sa6/sa7 既有日志先例（git tracked） | 实现证据 | ⚠ 说明项：非产品代码；建议随实现同票提交（见 OBS-4） |
| `wiki/raw/task_issue-382_sa3_impl.md` 等 wiki 产物 | SA skill 固定产物 | 报告 | ✅ |

DENY 全域核验：`read.ts`（sha256 一致）、`runtime.ts`/`lease.ts`/`types.ts`、既有测试家族（#368 pins/contract、#381、public-surface-guard、#369 全部）、`CONTEXT.md`、`docs/**`、配置文件——全部零改动（V-c）。无超 ALLOW 产品文件。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `Read*WindowResult` 成功面 `total: number\|undefined` | 全仓 doc-runtime 外消费点 = **零**（grep 亲证）；runtime.ts L691/L703 直传加宽后 compose 形参 | 无 cast/兜底；`pnpm typecheck` 14 工程 exit 0（M5 机械门） | 无 | —— |
| compose 两入口签名加宽 | 唯一生产消费点 runtime.ts L691/L703；#369 组合测试经包内相对导入 | 数值实参天然兼容 `number\|undefined` | 无 | —— |
| options 别名链（registry→runtime→doc-runtime） | lease 类型面自动获得 `where?`（Equal 锁继续成立，lease-surface `.test-d` 绿）；运行时中间态响亮（P4 实测 `WINDOW_OPTIONS_INVALID`） | 与 SA8 A2 预案一致 | 无 | —— |
| `WhereTerm` 新公共类型 | type-only 导出；运行时键空间零新增（NC6/P-W1/P-W2）；M2/Y1 记账 | 公共面守卫义务闭合 | 无 | —— |
| readData 姊妹/预算通道 | 冻结零 diff；NC4 钉 `READ_OPTIONS_INVALID` | 无渗入 | 无 | —— |
| 失败语义变化（lease where 失败 message 换因） | message 非契约字段（SA6 §15-O2/B-9 只锁四键形状）；行为断言只锁 code | 无 caller 承接 message 文本 | 无 | —— |

## 8. 错误、恢复与并发

- **零静默失败**：入参非法全收编 `WINDOW_OPTIONS_INVALID`（双层 try + `windowCore` E100 backstop，零外抛）；入选项物化失败 fail-fast `PATH_NOT_ALLOWED`、path 精确到项、无半窗（F4）。
- **数据侧安静不匹配**逐类静态推演验证：field 缺席/显式 undefined/detached/标量条目/plain array 条目（`isPlainRecord` 排除）/非标量字段值（Y.Map/plain object/array）/non-finite/equals:null 双向——`drillField` + `matchesWhereTerm` 的控制流对每类都归 `false`（不炸读、不挤正常项），与 D 组/Z 组断言一致。
- **并发/幂等**：全链同步、零可变态；防御性浅拷贝使 OPT 后 E+W 只消费快照（SC-6 封死）；同实参重复调用逐字节一致（NC7）。唯一用户代码窗口 = options/where 的 trap，已全数收编。
- **静态无法确认项**：13 类变异的实际击穿（见 §11 后续动态验证项 1）、CI 首跑（项 2）。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-382-where-window-contract-red.test.ts`（76 用例：C11/D12/V21/P5/T5/Z8/F6/NC8） | 运行时行为：结果联合、own 键集（恰三键/恰四键）、条目身份与值、accessor 计数器、`hasOwnProperty` 判 total、独立预言机（native/Yjs 直数）对账、毒值哨兵 + 有牙负控（NC8 经姊妹全量物化证毒值确实响亮） | root `pnpm test`（include `packages/*/test/**/*.test.ts` 自动采集；focused-family.log 实证 76 用例执行 ✓） | T4/T6 合并为单一 `it`（OBS-1，覆盖等价）；V13/V14 无执行计数器（OBS-2，SA6 规格本就只要求响亮∧零外抛；零执行判别由 V11/V15/D7 计数器承担） | MINOR 观察 |
| `issue-382-where-window-type-guard.test-d.ts`（3 用例） | Y1–Y4：可导入、投影、total 加宽、键集锁、`@ts-expect-error` 负例（含 bigint/多段 field/非数组 where/语境外 orderBy） | `vitest --typecheck`（typecheck.include 采集；focused-family.log `✓ TS` 实证） | 无；红灯基线 TS2578×5 → 实现后全消费（type-red.log 对账） | —— |
| `issue-382-lease-where-no-silent-pass.test.ts`（3 用例） | P4 条件不变式（ok:true ⟹ 条目全满足谓词；ok:false ⟹ 码 = `WINDOW_OPTIONS_INVALID`）+ 无 where 四键基线（集中化 helper + `truncated===true` + `'total' in result===false`） | root `pnpm test`（实证 ✓） | 条件不变式对「已过滤静默通过」恒绿——SA6 P4 明文形态，由 D8 双态探针补行为级证据（已齐） | —— |
| 迁移 M1/M2/M3 | 类型锁加宽自证；`WhereTerm` 记账；头注同步 | 同上（实证 ✓） | 无 | —— |
| 红灯基线（V-1/V-2） | src 还原 HEAD 后 44 failed/32 passed + 类型 9 errors——红因 = 词表位缺席，非环境 | red-contract/type-red 日志 | 无伪绿迹象；C8/V 组伪绿已按 SA6 §12.3.3 登记定位 | —— |
| 屏蔽审计 | 全部新文件 grep `.skip/.only/.todo/xit/xdescribe` 零命中；零 env override、零 fallback、零源码字符串断言 | grep 亲证 | 无 | —— |

## 10. Required revisions

无 BLOCKER、无 MAJOR。**无必须修订项。**

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| SA6 §12.7 其余 13 类变异的动态击穿（SA8 A2″ 移交 SA4/SA7 域；静态已核对每类存在对应击穿用例：ignore-where→C/P、见 where 即拒→C/V3/V20、不校验→V、全量物化→Z、整项深读→Z6–Z8、管线错序→P1、total 计数→T4–T6、truthiness→C5/D2、`[[Get]]` 下钻→D7/V11/V15、词表放宽→C8/V18、readData 渗入→NC4、软化→纪律禁） | 复核票（Controller 路由）逐类植入变异并跑聚焦家族 | 每类至少一个用例红 | 任一变异全绿即测试敏感度缺口 |
| CI 首跑（push 后 `ci.yml`：typecheck 单跑 + test 分片） | CI | exit 0 | 任一分片红 |
| 缝 2 票（A1″）：D8 分支被「truncated 双语义 + ✂ 永不装配 + S3 镜像扩展」整体取代；F7 严格断言预期翻转、F8 终态生效 | 缝 2 实现票 + 届时冲突门禁（DR-5/A2′/A1″） | P4 条件不变式无需退役仍绿；取代完整 | 残留死分支 / S3 镜像未扩 / ✂ 装配了 where 面 |
| 位置序成本短路（Follow-up ②，触发 ~10⁵） | 后续性能票 | 可观测结果不变 | 引入第二读路径（S2 审计禁） |

## 12. Non-blocking observations

- **OBS-1（MINOR，测试组织）**：契约文件 T 组以 5 个 `it` 覆盖 SA6 表格 T1–T6（T4/T6 合并为一个用例，二者断言集同点：own 键在场 + `undefined` + 恰三键）。覆盖等价、无弱化；仅与表格行号非一一对应，登记备查。
- **OBS-2（MINOR，敌意面判别力）**：V13/V14（四 trap 抛异常 Proxy）只断言「响亮 ∧ 零外抛」，无法区分「零 `[[Get]]`」与「`[[Get]]` 被收编」——与 SA6 §12.3.3 规格一致；零执行判别由 V11/V15/D7 的计数器断言（`=== 0`）实际承担，防线完整。
- **OBS-3（MINOR，遗留 label）**：`#381` T9c 用例 label「未知键」语义过时（`{n:1,where:'x'}` 新拒绝因 = 非数组，断言仍同码绿）——设计 R-6 已裁为观察项非改动项，M4 零改动纪律优先，维持。
- **OBS-4（说明项，证据落盘）**：`artifacts/sa3-issue382-*.log` 目前 untracked；`artifacts/` 内 sa3/sa6/sa7 既有日志均为 git tracked 先例。建议 Controller 提交时将其随实现同票纳入，否则 A6′/S1–S4 证据链不随仓存活（SA3 报告已按先例登记，非范围违规）。
- **OBS-5（说明项，校验次序）**：OPT 内 where 校验位于 orderBy 校验之后——两者失败码同为 `WINDOW_OPTIONS_INVALID`，可观察行为无差异；V21（OPT 先于 N0/N1）不受影响。
- **OBS-6（说明项，哨兵提醒）**：`WHERE_TERM_LIMIT = 16` 为 O1 哨兵——后续若调整须先改 ADR/简报口径，不得静默偏离（现行值与简报 AC3「16 合法 / 17 非法」一致，V2/V3 锚定）。

---

SA4 未修改任何实现、设计或测试；未运行测试/服务/探针；未等待或调度其他 SA；唯一写产物 = 本文件。
