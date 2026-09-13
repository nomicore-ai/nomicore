# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #363
Title: T1: 投影文本渲染器——@nomicore/vfsl 公共导出（ADR 0027 决策 2/3）
State: open
Issue updated at: 2026-09-13T09:13:44Z

## Issue body

## Parent

PR #362（adr0027-projection-text）

## What to build

语义 schema 投影的确定性文本渲染器，作为 `@nomicore/vfsl` 公共导出：任何持有 resolver ok 产物（语义 schema 投影）的消费方，可用一个零选项纯函数得到其投影文本（含截断事实 ✂ 段），输出逐字节确定、可快照锚定。本票为纯加法：不触碰 readData，零既有行为变化。

文法按 ADR 0027 决策 3（规范性）：

- 字段行 `名?: 类型 // 口径首行…`——`?` 可选、`T[]` 数组、ref 直写别名名；
- 标量域照 VFSL 源文法：`Int<1, 9999999999>` / `Range<0, 100>` / `Pattern<"…">` / enum `"a" | "b"`（` | ` 分隔，超 100 列折行缩进续行）；
- Record / union 照源文法（`Record<string, T>` + 行尾 keyPattern 注释；union `| { … }` 不特判判别式）；
- 别名块 = 闭包发现序（与 resolver aliases 键序同源）；
- 口径恒 first-line（多行注释取首行 + `…`）；docs 文本防御：注释内换行折叠、文本永不破坏文法结构；
- 被截位 `‡` 标记 + 页脚一行解释；容器线索无名时如实 `[...]‡`，不编造类型名；
- 可见性切片延续 ADR 0024 #359 amendment——渲染不增删投影内容，投影里在场/缺席什么就呈现什么；
- ✂ 截断事实段：truncations 在场时逐条呈现 路径 / 裁因（depth/width）/ 省略计数；缺席或空清单时段整体不出现。

## Acceptance criteria

- [ ] `renderProjectionText(projection, truncations?)` 经 `@nomicore/vfsl` 公共入口导出，零选项签名（测试经 index 动态接缝取导出，不读实现源码）
- [ ] 文法各形态快照冻结：预算夹具家族（evaluate 产物 × path × depth 矩阵）、m4 成员注释夹具、手造派生物（槽位/截断边界）、无预算整读
- [ ] 确定性：同输入重复调用、与无预算读交错调用，输出逐字节相同
- [ ] first-line 口径与 docs 文本防御（含换行、`//`、`}` 等敌意内容的注释不破坏结构）
- [ ] `‡` / `[...]‡` / ✂ 段呈现符合 ADR 0027；truncations 缺席或空时无 ✂ 段
- [ ] `@nomicore/vfsl` typecheck + 既有测试全绿（纯加法回归锚）；root `pnpm typecheck` / `pnpm test` 绿

## Blocked by

None（可立即开始）

## Comments
