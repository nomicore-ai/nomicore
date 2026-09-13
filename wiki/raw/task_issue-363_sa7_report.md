# SA7 动态验证报告 — issue #363（T1：投影文本渲染器）

- Dispatch：`sa-09408d50-70b7-4186-a1a6-19422590400f`（mabf-sa7 / final-verification / iteration 0）
- 验证对象：当前工作树最终实现（`packages/vfsl/src/index.ts` +6 行 + 新文件
  `packages/vfsl/src/render-projection-text.ts`（1002 行，含 SA8 I7 修复）+ 契约测试四件）
- 基准 HEAD：`12674544d2f24eb7d47c47ca4613b894043711d4`（与 SA6/SA1/SA2/SA3/SA4/SA8 登记
  一致；本次 `git rev-parse HEAD` 复核未变）
- 验证范围（dispatch 钉死）：#363 渲染器实现的相关**数据流**与**状态机行为**的动态验证，
  重点为 contract-critical 的 **marker（‡）/ truncation（✂）/ optional（?）/ cycle（…）**
  四类行为；不做一般设计或实现评审；不修改实现文件
- 上游门状态：SA4 **approve**（`task_issue-363_sa4_review.md` §2）、SA8 实现门 **clear**
  （iteration 2，I7 闭合）——本报告只在 SA4 pass 基础上独立动态求证
- Issue REST comments snapshot：**空**（无 owner 要求、无 comment ID 适用）

---

## 1. Inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-363.md` | 在场 | 票面 What-to-build + AC 6 条（动态验收基准） |
| `wiki/raw/task_issue-363_design.md`（iteration 2，SA2 approve） | 在场 | §7.0–§7.7 文法/归位/失败语义钉死、§8 数据流路线、§12/§12.1 CT-1…CT-9 验收、附录 A 样张 |
| `wiki/raw/task_issue-363_sa6_contract.md`（approve） | 在场 | CT-1…CT-7 断言组、86 金标格、§12.9 P1–P5、控制组规格 |
| `wiki/raw/task_issue-363_sa3_impl.md`（iteration 1 返工版） | 在场 | I7 修复自述、门禁记录（381/4540）、金标零漂移声明（待动态复核） |
| `wiki/raw/task_issue-363_sa4_review.md`（approve） | 在场 | §11「后续动态验证项」两行（根门禁、金标字节稳定性）——本报告直接承接 |
| `wiki/raw/task_issue-363_relevant_decisions.md` / `_conflict_report.md` / `_implementation_conflict_report.md`（SA8，clear） | 在场 | 不可变协议边界识别（frozen surfaces：resolver、20 导出面、doc-runtime 条目形状、`InternalError` 单一类身份、86 金标快照） |
| 实现与测试实读 + 六个外部动态探针 | 本次 | 数据路线、中间值、状态转换、错误传播的运行时证据 |

## 2. Runtime environment

```
worktree：/home/wangjian/nomicore-fix-issue-363（HEAD 12674544d2f24eb7d47c47ca4613b894043711d4）
node v24.13.0 · pnpm 10.28.2 · vitest 3.2.7 · tsx（node_modules/.bin，既有安装，零网络）
运行方式：vitest（契约/控制/类型三件）+ tsx 外部探针（/tmp，worktree 外）+ 根门禁 pnpm typecheck / pnpm test
无服务、无端口、无网络、无持久化；全部命令前台或受控后台 job（已收尾，见 §8）
```

## 3. Changed Data Flow Verification

本票唯一新增运行时数据路线 =「投影 → 文本」（设计 §8 表）。设计声明改变的逐跳动态证据：

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 入口：公共导出面 | index.ts 加 1 值导出 + 1 类型导出，20 既有导出不动（D1） | probe1（`import * as vfsl` 动态读） | `exportCount=21`；`typeof renderProjectionText==='function'`；SA6 §5 冻结 20 名逐一在场 | 21 = 20+1，seam 可用 | 21/21 冻结名全在场 | ✓ |
| 输入：resolver ok 产物直入 | 签名收投影联合；ok 结果多 `ok:true` 键容忍（§7.0/§7.5） | probe1：`resolveSchemaAtPath(budgetFixtureDerived(),[])` ok 结果原样直传 | `render(okResult)` 返回 string 且 ≡ 四键子集渲染（逐字节） | 直传零转换 | `textOk === render(fourKeySubset)` 逐字节相等 | ✓ |
| 转换：零选项确定性 | 零选项、同步、逐字节确定（D2/D14） | probe1：一参 vs 二参 `undefined`；重复调用；与 resolver 无预算重读交错（render A→resolve→render A→render B→render A） | 三次 A 逐字节相同（len 749=749=749）；B 不同；1 参 ≡ `undefined` | 三态同路、交错不变 | 全部逐字节相同 | ✓ |
| 关键中间值：`‡` 标记/页脚（含 I7） | 每标记恰 1 个 `‡`；m>0 恒页脚；`countOccurrences('‡')===m+1`（§7.4） | probe2：冻结 resolver 真实产物 `['opt']` d0（optional{marker}）；`[]` d1（m=11）；手造 twin 四宿主位；双标记；86 金标全格 | `['opt']` d0 = `"[...]‡?\n\n‡ 截断标记：…\n"`（‡ 计 2=m+1，页脚恰 1 行）；`[]` d1 ‡ 计 12、`shallow: Ledger‡`（ref 线索）/`deep: [...]‡`（container 线索）；四宿主位 m=1→‡2+页脚；m=2→3；86 格不变量 0 失败 | 位标/页脚配对、线索如实、无双重/无旁路计数 | 全部命中（I7 修复在真实产物上成立） | ✓ |
| 关键中间值：✂ 段（truncations 第二参） | 在场才出现；逐条 path/kind/omitted；文末块；三态等价（§7.4/D10） | probe3：缺席/`undefined`/`[]` 三态；单/多/数字段/空路径/乱序清单；删条目/改 kind/改 omitted 敏感性；与 ‡ 共存 | 三态逐字节相同且无 `✂`；`- tags · width · 省略 2 项`；`items.0` 数字段；空路径 `[]` 拼写；乱序保输入序且重复逐字节同；删/改敏感性全命中；共存序 body→页脚→✂ | 段为文末块、输入序、三态同路 | 全部命中 | ✓ |
| 关键中间值：optional `?` 合成 | 字段位吸收 `名?:`；非字段位四款附着；链解包单 `?`（§7.1.3/R2） | probe4：F1 `['notes']`/`['config']` 金标格；`[]` 无预算 `opt?: {`；手造链 `optional{optional{scalar}}`、深链 optional{optional{marker}}、数组元素 `string?[]`、Record 值 `Record<string, string?>` | `string?\n`；`{?\n  retries: number\n}\n`；`opt?: {` 与 `req: {` 对照；链恰 1 个 `?`；深链 `[...]‡?`+页脚（‡2、`?` 1） | `?` 恰呈现一次、落点按款 | 全部命中 | ✓ |
| 交付：输出 string、无头行 | 返回 string；不产出 `# readData [`（D4） | probe1：`typeof==='string'`；`includes('# readData [')===false` | 无头行 | 无伪造事实 | 命中 | ✓ |
| 快照锚定：86 金标冻结面 | 金标逐字节稳定（SA8 frozen surfaces 表末行） | probe2：`renderCellInputs()` 86 格当前渲染 vs `RENDER_GOLDENS` 录制字节 | drift=0（86/86 逐字节相等）；键数 86 | 零漂移 | 零漂移（SA3「零重录」声明获独立复核） | ✓ |

## 4. Preserved Data Flow Verification

设计声明不变的路线（§1 目标 5「冻结面零触碰」）动态证据：

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
| --- | --- | --- | --- | --- | --- |
| resolver 无预算 JSON 通道 | `sha256(JSON.stringify(resolveSchemaAtPath(budgetFixtureDerived(),[])))` ≡ `e600851a…`（SA6 §4/§13 基线） | probe1 | SA6 实测 `e600851a81744bd5…`（2026-09-13） | 逐字节相等（`e600851a81744bd5…` ≡ `BUDGET_NO_BUDGET_DIGESTS['[]']`） | ✓ |
| resolver ok/失败形状 | ok 恒四键；失败通道 `SCHEMA_OPTIONS_INVALID` 不变 | probe1 | SA6 §12.8 控制组规格 | ok=true 四键在场；`{depth:-1}` → `ok=false, code=SCHEMA_OPTIONS_INVALID` | ✓ |
| 公共导出面 | 20 冻结值导出超集在场（SA6 §5 清单） | probe1 | SA6 E1 `exportCount=20` | 20 名逐一在场（总数 21 = 加法） | ✓ |
| readData/doc-runtime/namespace-runtime | 本票零触碰（ADR 0027 决策 1/4 缝 2） | `git status --porcelain` + 根测试 | SA6/SA3 基线 378/4384→381/4540 | 唯一 tracked 修改 = `index.ts`；根 `pnpm test` 381 files/4540 tests 0 failed（含 doc-runtime/namespace-runtime 全部既有断言） | ✓ |
| 既有 vfsl 测试基线 | 既有 48 files/960 tests（SA6 §4）不受实现影响 | 根 `pnpm test` + 聚焦运行 | SA6 基线绿 | 51 files/1116 tests 记录于 SA3；本次根跑 381/4540 全绿、0 type errors | ✓ |
| `InternalError` 单一类身份 | 包内 `class InternalError` 定义数 = 1（`resolve.ts` L26）；渲染器 import 复用（R5） | grep + probe6 `instanceof` | 设计 §2/R5 事实 | 定义数 = 1；8 类畸形输入抛出对象全部 `instanceof`（resolve.ts 类）且 `name==='InternalError'` | ✓ |

## 5. State Machine Verification

渲染器为纯函数，**无持久状态机**（设计 §8）；状态机面 = 渲染 descent 的**进行中节点栈**
（stack 语义）+ optional 链局部 seen + 守卫顺序。动态状态转换证据：

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
| --- | --- | --- | --- | --- | --- |
| 栈空（acyclic 投影） | 正常 descent | 逐节点 push→render→pop；输出完整文本 | 86 金标格 + F1 手造格全部完整渲染（drift=0） | 无提前 `…`、无挂死、无 throw | ✓ |
| 栈含祖先（环重入） | 4 环构造器 × {无预算, d1, d9}（12 格，≥ 设计 CT-8 的 9 格） | 重入位渲染 `…`（U+2026）后返回，**不构造、不抛、不无限递归** | 12 格全部返回 string（wall-clock 5ms）；透传格（无预算/d9/optional 透明 d1）含 `…`；unionRing/containerRing d1（设计判定的 2 个非环格）`…` 缺席 | 无 `TypeError: circular`、无栈溢出、无静默丢整棵子树 | ✓ |
| DAG 共享（非祖先重访） | 同一节点对象作两兄弟 + 复用为别名体（probe 附查） | 每次出现**各自完整渲染**（栈已弹出） | `{a:{s:string} b:{s:string}}` + `type Alias = {s:string}` 三处全展开 | 全局 visited 式坍缩（第二/三处变 `…`）未出现 | ✓ |
| 合法递归别名 | `recursiveAliasDerived()` 无预算整读 | 按名 ref 直写终止 | 返回 string（len 67） | 无限展开未出现 | ✓ |
| m=0（无标记） | 无预算整读 / 无标记 twin | 无 `‡`、无页脚 | `[]` 无预算与 markerless twin 均无 `‡`/无页脚文本 | 空页脚、`‡` 残留未出现 | ✓ |
| truncations 空/缺席 | 三态输入 | 无 `✂` 段，三态逐字节相同 | probe3 全部命中 | 空段头残留未出现 | ✓ |
| 畸形输入（8 类） | 缺键/坏 kind/坏 truncations/坏 docs/int 半参/坏节点/坏别名体/非数组 | **进入守卫即 throw `InternalError`**，不产出部分输出 | 8/8 抛出、`name==='InternalError'`、`instanceof resolve.ts` 类、消息含键名/kind 实值（如 `valueSchema kind 非法 "bogus"`、`truncations[0].kind 非法 "height"`、`int … min=1 max=undefined`） | 静默降级、裸 `TypeError`、部分 string 未出现 | ✓ |
| throw 后再调用 | 8 次 throw 后渲染干净投影 | 无跨调用残留状态，输出正确 | `render(clean)==='number\n'` | 错误状态泄漏/后续调用污染未出现 | ✓ |

## 6. Error and Cleanup Flow

- **错误传播**：唯一失败通道 = `InternalError`（trusted-domain，loud）；8 类抽样全部同步抛出、
  消息可归因（含位置/键名/kind 实值）、无吞错、无部分输出（throw 即无返回值）；
- **可重入/恢复**：纯函数——修复输入后重调即得全量输出；8 次 throw 后干净渲染正确；
- **清理时序**：无 I/O/句柄/后台任务/订阅；唯一 `try` 为 `finally` 栈清理（SA4 静态证实），
  运行时以环格零挂死 + 零变异佐证；本验证未启动任何长驻服务，后台根门禁 job 已收尾
  （`job_list` 无 running 项）；
- **零变异（错误/正常双路）**：acyclic 输入 `JSON.stringify` 前后不变（probe1）；环输入按
  设计 §12.1 环安全审计（节点身份保全 + 环安全摘要，禁 stringify）12 格全过（probe5）。

## 7. Temporary Diagnostics

- **worktree 内临时日志：零添加**。全部动态观测经（a）既有契约/控制/类型测试、（b）返回值与
  存储状态（金标 fixture、冻结摘要）、（c）/tmp 外部探针（`probe1…probe6`，worktree 外）取得，
  未达「必须向代码加 `[SA7-DATAFLOW]` 日志」的阈值；
- 删除项：无（无添加项）；worktree 内 `grep -c "SA7-DATAFLOW"` 于实现与五个测试文件 = 0；
- 移除后复跑：所有关键场景本就是在**零仓内插桩**状态下运行（探针只读消费公共入口与既有
  fixture 导出），结果即无插桩基线；
- `git status --porcelain` 收尾核对：` M packages/vfsl/src/index.ts` + 5 个 untracked 包文件 +
  `wiki/raw/*363*`（Host/SA 产物，含本报告）——与 SA4 §6 记录的工作树状态一致，DENY 面零触碰；
- 探针与日志留存于 `/tmp/sa7-363-evidence/`（worktree 外，不进 artifactPaths）。

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SA6 | CT-1 公共导出 + 零选项签名（§12.2） | probe1 + 聚焦 vitest（G1 组） | seam function、21 导出、1 参 ≡ `undefined`、无头行 | 全部命中 | `/tmp/sa7-363-evidence/probe1-dataflow.ts` 输出；`focused-contract.log` | 通过 | — |
| SA6 | CT-2 文法快照矩阵 86 格（§12.3） | probe2 独立重渲染 vs `RENDER_GOLDENS` | 逐字节相等 | drift=0 | probe2 输出 | 通过 | — |
| SA6 | CT-3 `‡`/`[...]‡`/页脚/计数不变量（§12.4）+ SA8 I7 | probe2（冻结产物 `['opt']` d0、`[]` d1、四宿主位 twin、双标记、m=0 负控、86 格不变量） | `‡===m+1`、页脚恰 1、线索如实、m=0 无 ‡ | 全部命中（m=11→12、m=1→2、m=2→3） | probe2 输出 | 通过 | — |
| SA6 | CT-4 first-line + docs 防御（§12.5） | 聚焦 vitest（G4 组 8 项）+ 86 金标重渲染 | 敌意/良性孪生结构行相同、增删/清空敏感性 | 156 项全绿 | `focused-contract.log` | 通过 | — |
| SA6 | CT-5 ✂ 段三态/条目/序（§12.6） | probe3 | 三态等价、条目逐字段呈现、文末块、共存序 | 全部命中 | `/tmp/sa7-363-evidence/probe3-truncations.ts` 输出 | 通过 | — |
| SA6 | CT-6 确定性与纯函数（§12.7） | probe1（acyclic）+ probe5（环） | 重复/交错逐字节同、零变异 | 全部命中 | probe1/probe5 输出 | 通过 | — |
| SA6 | CT-7 纯加法控制组（§12.8） | 聚焦 vitest 控制文件 + probe1 冻结摘要/失败码 + 根门禁 | 恒绿、20 导出超集、摘要不变 | 全部命中 | `focused-contract.log`；probe1 输出；`root-test.log` | 通过 | — |
| Design | CT-8 环投影终止/`…`/确定性/零变异（§7.6/§12.1） | probe5：4 构造器 × 3 预算（12 格 ⊇ 强制 9 格）+ 递归别名 + DAG 共享 | 终止、`…` 在透传格、逐字节确定、§12.1 审计三段式全过 | 全部命中（含 O4 半句：optionalRing d1 含 `…`；两非环格 `…` 缺席） | `/tmp/sa7-363-evidence/probe5-cycle.ts` 输出 | 通过 | — |
| Design | CT-9 畸形输入 `InternalError`（§7.5） | probe6：8 抽样 + ok:true 容忍边界 + throw 后恢复 | loud 抛、`name`/`instanceof`/可归因消息、无部分输出 | 全部命中（消息实值见 §5 表） | `/tmp/sa7-363-evidence/probe6-malformed.ts` 输出 | 通过 | — |
| SA4 | §11 后续动态验证项行 1：根门禁实际绿 | 根 `pnpm typecheck` / `pnpm test`（后台 job，已收尾） | exit 0；0 failed / 0 type errors；数 ≥ 381/4540 | typecheck exit 0；test 381 files/4540 tests、no type errors、exit 0 | `root-typecheck.log` / `root-test.log` | 通过 | — |
| SA4 | §11 行 2：金标字节稳定性（防未来漂移） | probe2 86 格重渲染比对 | 151 项聚焦全绿 + 逐字节相等 | 聚焦 156 项全绿（144 契约+7 控制+5 类型）；drift=0 | `focused-contract.log`；probe2 输出 | 通过 | — |
| SA4 | O-A optional 包裹 union 且首成员 inline enum 形态（跨票登记） | 未验证（设计 L6/L7 与 SA4 §12 均判跨票观察，86 金标无此格） | — | — | — | 不适用 | 维持跨票台账（T2 若产出该形态再议，ADR 0027 文法粒度内） |
| Design | P1 无宿主 docs 键丢弃（§7.2 规则 4） | 86 金标（含 `F2 ["shallow","title"]` 两键全丢格）+ 聚焦 G4.5/G4.8 | 无宿主键零输出贡献 | 金标 drift=0、G4 全绿 | probe2；`focused-contract.log` | 通过 | — |

## 9. Commands and Evidence

| # | Command | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/vitest run packages/vfsl/test/render-projection-text.test.ts packages/vfsl/test/render-projection-text-control.test.ts packages/vfsl/test/render-projection-text.test-d.ts --typecheck` | exit 0：**3 files / 156 tests passed（144 契约 + 7 控制 + 5 类型），Type Errors: no errors**（10.11s） | `/tmp/sa7-363-evidence/focused-contract.log` |
| 2 | `pnpm typecheck`（14 tsconfig 串行） | exit 0（`TYPECHECK_EXIT=0`） | `/tmp/sa7-363-evidence/root-typecheck.log` |
| 3 | `pnpm test`（全仓 `vitest run --typecheck`） | exit 0：**381 files / 4540 tests passed，Type Errors: no errors**（588.55s）——与 SA3 §7 记录逐数一致 | `/tmp/sa7-363-evidence/root-test.log` |
| 4 | `tsx /tmp/sa7-363-evidence/probe1-dataflow.ts` | exit 0，failures=0（seam/路线/确定性/纯度/保真 digest/失败通道，33 项 PASS） | probe1 输出（本报告 §3/§4 摘录） |
| 5 | `tsx /tmp/sa7-363-evidence/probe2-marker.ts` | exit 0，failures=0（I7/线索/计数/页脚/86 金标，31 项 PASS） | probe2 输出 |
| 6 | `tsx /tmp/sa7-363-evidence/probe3-truncations.ts` | exit 0，failures=0（✂ 三态/条目/序/敏感性，17 项 PASS） | probe3 输出 |
| 7 | `tsx /tmp/sa7-363-evidence/probe4-optional.ts` | exit 0，failures=0（optional 四款附着/链解包/宿主位，10 项 PASS） | probe4 输出 |
| 8 | `timeout 90 tsx /tmp/sa7-363-evidence/probe5-cycle.ts` | exit 0，failures=0（12 环格 + 递归别名 + DAG，78 项 PASS；wall-clock 5ms） | probe5 输出 |
| 9 | `tsx /tmp/sa7-363-evidence/probe6-malformed.ts` | exit 0，failures=0（8 抽样 × 4 断言 + 边界 + 恢复，35 项 PASS） | probe6 输出 |
| 10 | `grep -rn "class InternalError" packages/vfsl/src/` | 恰 1 处（`resolve.ts:26`） | 本报告 §4 |
| 11 | `git status --porcelain`；`git rev-parse HEAD` | `12674544…` 未变；tracked 修改仅 `index.ts`；stash 空 | 本报告 §7 |

## 10. Deviations

- **无阻断偏离、无验收弱化**。以下为超集/登记项：
  1. 环验证按 4 构造器 × 3 预算执行（12 格 ⊇ 设计 CT-8 强制的 9 格；`optionalTwoCycleDerived`
     为超集格，行为与 optionalRing 同判通过）；
  2. DAG 共享/别名体复用展开、optional 数组元素与 Record 值合成（`string?[]`、
     `Record<string, string?>`）为契约外附查，结论与设计 §7.1.3/§7.6 一致；
  3. 未新增任何仓内补充测试：既有契约四件 + 外部只读探针已足以观察全部设计点名跳点与
     状态转换（skill「优先使用已有测试」路线）；SA3 待 SA7 复核的「`bare` 位不可达证明」
     经源码事实（容器展开谓词对标记恒 false ⟹ 不产生 bare 宿主调用）与四可达宿主位动态
     全绿共同佐证，维持 SA3/SA8 登记边界；
  4. SA4 O-A 形态（optional 包裹 union 首成员 inline enum）维持跨票台账，不属本票验收面
     （设计 §13 L6/L7、SA4 §12 同判）。

## 11. Verdict

**approve**。

- 设计声明改变的数据流（投影 → 文本的唯一新路线：入口、输入直传、确定性、`‡`/页脚（含
  I7 optional 包装计数）、✂ 段、optional `?` 合成、无头行、86 金标快照锚定）**全部按设计变化**
  且有运行时逐跳证据；
- 设计声明保持的数据流（resolver 冻结摘要/失败通道、20 导出面、readData/doc-runtime/
  namespace-runtime、`InternalError` 单一类身份）**全部保持不变**；
- 状态机（descent 栈语义）：合法顺序正确、环重入 `…`、DAG 各自完整、禁止状态（挂死、
  裸 `TypeError`、部分输出、m=0 残留页脚、空 ✂ 段、头行）**均未出现**；
- 错误与清理：8 类畸形 loud 抛 `InternalError`（可归因、单一类身份）、throw 后零残留、
  零资源泄漏；环/acyclic 双辖域零变异审计全过；
- 根门禁 typecheck/test 双 exit 0（381/4540、0 failed、0 type errors）；SA4 §11 两项
  「后续动态验证」均闭合；
- 临时诊断零添加，worktree 与 SA4 审查时状态一致（DENY 面零触碰）。

`requiresConflictRecheck: false`（SA7 侧）：动态验证未发现新的 ADR 冲突风险面；设计 §15 登记
的复查枚举已由 SA8 实现门 iteration 2 按 frozen surfaces 表闭合（clear / false）。
