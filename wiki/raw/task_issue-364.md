# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #364
Title: T2: readData 投影文本化原子切换——恒四键、截断事实单一载体、组合层退役（ADR 0027 决策 1/4）
State: open
Issue updated at: 2026-09-13T12:53:50Z

## Issue body

## Parent

PR #362（adr0027-projection-text）

## What to build

readData 的投影通道**无条件文本化**（原子切换，规格不允许半截双形态）：`NamespaceLease.readData` 一次调用直接返回 `{ ok, value, schema, truncated }`——schema 位为投影文本（头行 + 渲染正文 + ✂ 段），结构化 truncations 键退役（✂ 段成为截断事实唯一载体），truncated 布尔保留为机器信号。同票完成组合层退役、结果类型坍缩、仓内全部消费测试翻新、作用域文档与文档负控重录——落地即全绿，不留中间态。

行为细节：

- schema 文本组装序：组合层前贴头行（实参 path + 预算；无预算省略预算段）→ `renderProjectionText`（T1）正文 → ✂ 段；
- 投影 detach 深拷贝层退役：渲染器进程内直读 resolver 产物，文本天然 detached（隔离不变量由形态保证）；
- readData 结果类型坍缩为单一四键形（预算 / legacy 双结果联合消失）；registry lease 类型别名跟随、透传零语义变化；
- `schema: null` 单义不变（无 active schema / 路径偏离 / 敌意 path → null 直通，非空串）；失败分支不带 schema / truncated；
- options 闭合形状 `{ depth?, maxChildrenPerNode? }` 零变化（校验、失败码、三层透传不动）。

## Acceptance criteria

- [ ] 成功分支恒四键 own 键集 = {ok, value, schema, truncated}；结构化 truncations 键不再在场（负控）
- [ ] `schema` ≡ 头行 + `renderProjectionText(resolveSchemaAtPath(derived, normalized, options), truncations)`——一致性锚（测试经 compileSchemaEnvelope 取 derived 作 oracle），渲染器与组合层不漂移
- [ ] 头行事实性：反映真实调用 path 与预算（预算读印 `{depth:N[,maxChildrenPerNode:K]}`，无预算省略）
- [ ] `truncated` === 本次读发生过截断（值通道折叠/裁剪或投影截断任一）；与 ✂ 段一致
- [ ] `schema: null` 三情形单义直通；失败分支（PATH_NOT_ALLOWED / READ_OPTIONS_INVALID / lifecycle）形状与语义不变
- [ ] options 闭合形状零变化回归：非法 options 响亮拒绝、合法预算三层透传逐字节
- [ ] 投影 detach 深拷贝层退役（组合层不再有投影克隆路径）；detached 行为锚（文本与 runtime 活 schema 零交叉污染）
- [ ] 仓内全部 readData 消费测试翻新：恒五键 / JSON 投影深等断言改为恒四键 / 文本断言（runtime-readdata 全家族、registry 行为锚、lease 透传）
- [ ] 作用域文档同步：typed-access、cordis-plugin-hosting 改写为投影文本词汇；`readdata-docs-adr0016-contract-fixture` 匹配器词汇重录（四件套交付 / 恒五键旧词汇清退，投影文本 / 恒四键词汇在场）
- [ ] root `pnpm typecheck` / `pnpm test` 全绿；发布随破坏性 minor bump（归发布流程，不在本票改版本号）

## Blocked by

- #363（T1 投影文本渲染器）

## Comments
