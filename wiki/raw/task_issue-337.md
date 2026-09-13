# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #337
Title: [shape-budget] T4: DeepOptional 预算读类型面
State: open
Issue updated at: 2026-09-12T18:47:36Z

## Issue body

## Parent

PR #332（adr-0024-readdata-shape-budget）

## What to build

预算读的静态类型面(ADR-0024 决策 7):`DeepOptional` 通用递归映射类型(对象全字段可选并递归 / 数组元素递归 / 标量原样)进入协议类型面与 `PathAt` 并列导出;readData 重载——无 options 保持 `PathAt` 完整子树承诺,带 options 返回 `DeepOptional<PathAt<…>>`。

## Acceptance criteria

- [ ] 无 options 调用的静态类型与现行为完全一致(PathAt 承诺零降级,type-level)
- [ ] 预算读类型全字段可选;在场标量保留精确类型(联合字面量);数组元素递归可选化(type-level)
- [ ] 判别联合附注:可选化判别字段的 switch narrowing 兼容性由 test-d 锚定;TS 不容时启用「判别字段保持必选」退路并在票内记录
- [ ] 未知路径/错误值的既有负向类型锚保持红;全套包门禁 + root typecheck/test

## Blocked by

- #336

## Comments
