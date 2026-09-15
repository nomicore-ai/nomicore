# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #382
Title: [ADR 0029] P2 — where 过滤原语（缝 1：doc-runtime）
State: open
Issue updated at: 2026-09-14T17:18:36Z

## Issue body

## Parent

PR #380（adr-0029-filtered-window）

## What to build

窗口原语两面接受可选 `where`（谓词项列表合取过滤）：在键容器 / 序列容器上按条目值单段属性等值筛选（如「所有 state == 'claimed' 的 task」），管线序 where → orderBy → n（在匹配子集上选窗），位置序短路选窗（凑满 n 个匹配即停），where 在场时 `total` 为 undefined（匹配总数不承诺）。WhereTerm v1 = `{field: 单段字面键, equals: string|number|boolean|null}`，number 须 finite。直接可验：`readMapWindowAtPath(doc, ['tasks'], {n:5, where:[{field:'state',equals:'claimed'}]})`。

## Acceptance criteria

- [ ] 合取语义正确性矩阵全绿：多条件、field 缺席、值非标量（容器/载体）、值 non-finite、同 field 重复项、数组面元素本身为标量、Y.Map / plain object / Y.Array / plain array 四载体族
- [ ] 安静不匹配纪律：脏条目不匹配任何 equals（含 equals:null 对缺席 field 不匹配；在场 null 匹配 equals:null）、不炸读、不挤掉正常条目
- [ ] 入参侧响亮：空数组、超 16 项、非 finite number、非闭集值类型、WhereTerm 未知键 / 非法原型 / 形状漂移 → `WINDOW_OPTIONS_INVALID`
- [ ] 敌意 options（accessor / Proxy / trap 异常）零 `[[Get]]` 执行、零外抛、收编为响亮失败
- [ ] 零物化哨兵：未匹配条目内埋 non-finite / 稀疏空洞毒值必须 `ok:true`（递归未触及）
- [ ] where 在场：`total === undefined`；where 缺席：`total` = 标识计数（P1 语义零回归）
- [ ] 既有三失败码语义不回归（WINDOW_TARGET_ABSENT / WINDOW_CARRIER_MISMATCH / WINDOW_OPTIONS_INVALID）；where 不触碰 orderBy 面词表（readArray 仍仅 by:'index'）
- [ ] 缝 1 测试先例：issue #368 窗口契约测试家族同款风格；全仓 typecheck + 测试绿

## Blocked by

- #381

## Comments
