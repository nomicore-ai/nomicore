# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #348
Title: 条件写语义矩阵补全：深相等、读失败路径、XML 与 set([])（guard II）
State: open
Issue updated at: 2026-09-13T01:27:44Z

## Issue body

## Parent

PR #346（adr0025-guarded-mutation）

## What to build

在 #347 落地的条件写核心之上，把 ADR 0025「评估语义」节的每一条边界补成可执行用例，完成 Seam 1 语义矩阵：谓词比较与路径读取的全部边角行为有测试锚定。本票以测试为主，若边角暴露 #347 实现的偏差，以 ADR 0025 为准修正实现。

## Acceptance criteria

- [ ] 深相等细节：嵌套 plain object/array 结构比较、undefined 键过滤语义（`{a:1}` 与显式 `a:undefined` 过滤后相等）、`-0` 与 `0` 相等
- [ ] 读失败路径（`PATH_NOT_ALLOWED`）：穿越标量/非下钻终态 → equals 判不满足 / absent 判满足；中间容器缺失与数组越界按缺席吸收语义处理
- [ ] guard 路径穿越 XML「不可下钻终态」→ equals 不满足 / absent 满足；guard 路径指向 XML 终点 → 与其投影逻辑值比较
- [ ] guard 路径为数组下标段（number）时按数组位置读取，段纪律与 mutation path 一致
- [ ] `set([])` legacy 全量替换管线同样先过 guard：不满足零写入、满足正常走 legacy 管线
- [ ] equals 对大子树结构比较可用（投影值 vs 手写期望结构）
- [ ] 批量形态 `{ ops, guard }` 的 guard 用例：顶层 guard 评估语义与单操作形态一致
- [ ] 语义矩阵用例按 doc-runtime 既有 mutation 测试组织方式落位；根 `pnpm typecheck` + doc-runtime 测试通过

## Blocked by

- #347

## Comments
