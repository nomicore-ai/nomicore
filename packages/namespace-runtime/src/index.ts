/**
 * @nomicore/namespace-runtime —— 公共入口（ADR-0008 Runtime 骨架子集；issue #89 + #90 + #91 + #92）。
 *
 * #92 公共面演进：Runtime 十键（+close 生命周期键）；getStatus 七键（+close 摘要键、
 * lifecycle 三态）；read 结果联合 +RuntimeReadDisabledResult 分支（closing/closed 期
 * 停接纳）。
 *
 * #273 增量（ADR-0016）：readData 成功分支形状演进为 { ok:true, value, schema }——
 * schema 为路径语义投影（ReadDataSchemaProjection | null，每次读 detached 深拷贝、
 * always-on 零开关）；失败分支（PATH_NOT_ALLOWED / RUNTIME_READ_DISABLED）与十二键
 * 键集不变；类型导出键集不变（NamespaceRuntimeReadDataResult 形状随组合面演进）。
 *
 * #336 增量（ADR-0024 决策 4/6，破坏性修订）：readData 成功分支**恒五键**（+#truncated
 * /+truncations）；新增预算重载 `readData(path, options?)`（同一预算贯通值与投影两通道）
 * 与预算结果联合 `NamespaceRuntimeReadDataBudgetResult`（追加 READ_OPTIONS_INVALID 失败
 * 分支；legacy 联合零泄漏）；新增 options 别名 `NamespaceRuntimeReadDataOptions` 与
 * `ReadLogicalValueTruncationEntry` 转出（全部 type-only——值导出面仍恰
 * RuntimeWriteFatalError 一键）。
 *
 * #364 增量（ADR-0027 决策 1/2/4，破坏性修订）：readData 成功分支再修订为**恒四键**
 * `{ ok, value, schema, truncated }`——`schema` 为**投影文本**（头行 + 渲染器正文 + ✂ 段；
 * `string | null`，null 单义直通），结构化 `truncations` 键退役（截断事实唯一载体 = 文本内
 * ✂ 段），`truncated` 保留为机器信号；投影 detach 深拷贝层退役（文本原始值天然 detached）；
 * 两联合成功成员坍缩为**同一四键类型**（联合名与双重载签名保留——失败面结构不同，
 * READ_OPTIONS_INVALID 零泄漏锁不动）；`ReadLogicalValueTruncationEntry` 公共转出**退役**
 * （原为已退役 truncations 键的命名面而设；值通道类型的消费方直依 `@nomicore/doc-runtime`）。
 * 类型导出面其余键集不变。
 *
 * #405 增量（ADR 0031 决策 1–4，破坏性 minor）：readData options 闭合形状两键 → **三键**
 * （`{ depth?, maxChildrenPerNode?, maxBytes? }`——`maxBytes` = 交付总量收/拒闸，≥1 的有限
 * 整数 ≤ 2^53−1，缺席 ≡ 不设预算）；预算结果联合 `NamespaceRuntimeReadDataBudgetResult`
 * 追加 `READ_BUDGET_EXCEEDED` 失败分支（超限**零交付**恰五键
 * `{ ok:false, code, path, measuredBytes, message }`；成功面恒四键零变化、账本不进公共面）；
 * legacy 联合与 `ReturnType` 末签名锚零变化（注册入口按名单源别名自动跟随）。
 * **导出键集零变化**（新失败成员为包内名，经 `Extract<…, { code:'READ_BUDGET_EXCEEDED' }>`
 * 结构可达；本入口仅注释增量——值导出面仍恰 `RuntimeWriteFatalError` 一键）。
 *
 * #132 增量：Runtime 十二键（+enableReplication/bumpReplicationEpoch 复制管理操作键）；
 * getStatus 八键（+replication 复制域）；type-only 追加五个复制管理类型（值导出面仍
 * 恰一键——REPLICATION_ID_PATTERN 等值导出不进本入口）。
 *
 * #369 增量（ADR 0028 决策 1/3/6/7/9，纯加法）：Runtime 十四键
 * （+readArray/readMap 窗口读组合面——成功恒四键 `{ ok, value, schema, truncated }`，
 * `value` 为条目列表、`schema` 为元素口径投影文本 + ✂ 窗口事实块、`truncated === kept < total`）；
 * type-only 追加四个窗口读别名（options 为 doc-runtime 单源别名；结果含 W1 失败成员与
 * `RuntimeReadDisabledResult`）；值导出面仍恰 `RuntimeWriteFatalError` 一键。
 *
 * #387 增量（ADR 0030 T1，纯加法）：Runtime 十五键（+watchMap 键容器变更订阅——
 * 建立判定全由 active schema 完成、通知为不含值的 `{path,key}` 定位符、一事务一通知、
 * 槽外异步分发）；type-only 追加三个 watch 别名（通知/定位符/句柄；值导出面仍恰
 * `RuntimeWriteFatalError` 一键）。
 *
 * #388 增量（ADR 0030 T2，纯加法）：watchMap 签名原位加宽第三参 `options?`
 * （谓词 `{field, equals}` | `{field, in}`，值域恒标量；建立期 schema 侧裁决，非法
 * 同步 throw `WATCH_MAP_OPTIONS_INVALID` / 零登记；通知判定 = 真变 ∧（旧匹配 ∨
 * 新匹配 ∨ 旧态不可判保守）——宁多勿漏）；type-only 追加两个别名（options 袋 +
 * 标量值域；值导出面不变、Runtime 键集不变）。
 *
 * 公共面纪律（AC1/AC2/AC6/AC9 锚定；issue #93 round 2 收口）：
 * - 值导出恰一键：RuntimeWriteFatalError（ADR-0008 点名的稳定 rejection 形状——
 *   instanceof 判别 committed/phase 是上层「不得自动重试非幂等写」纪律的依赖面）；
 * - 测试 seam（createNamespaceRuntimeWithSeam + NamespaceRuntimeSeamInput）与生产
 *   工厂 createNamespaceRuntime 一并保留包内（runtime.ts 模块级导出，ADR-0008
 *   「测试通过包内确定性 seam 注入」「生产工厂保留包内」——「包内」= 包内模块通道
 *   相对导入，不经本入口，亦不设 ./testing 子路径 export）；本入口对二者零
 *   re-export——seam 输入类型含 DocHandle，随值一并撤出公共面（AC6 点名对象）；
 * - 不导出 WriteSequencer / 运行态；构造/投影错误类别仍不导出（code+message
 *   字符串消费）；
 * - handler/Y.Doc/sequencer 永不从本入口出现；mutateData 是 runtime 面方法而非模块级导出。
 */
export { RuntimeWriteFatalError } from './errors.js';
export type {
  NamespaceRuntime,
  NamespaceRuntimeReadDataBudgetResult,
  NamespaceRuntimeReadDataOptions,
  NamespaceRuntimeReadDataResult,
  RuntimeReadDisabledResult,
} from './runtime.js';
// #336（ADR-0024 T3）：`ReadLogicalValueTruncationEntry` 曾在此转出（truncations 键的
// 公共命名面）。#364（ADR-0027 决策 1）退役该键后此转出成为死词汇——本入口不再导出；
// 需要值通道截断事实类型的消费方直依 `@nomicore/doc-runtime`（其公共面既有且冻结）。
export type { NamespaceRuntimeStatus } from './status.js';
// issue #369（ADR 0028 W2）：窗口读公共类型（type-only——值导出面仍恰
// RuntimeWriteFatalError 一键冻结；options 为 doc-runtime 单源别名）。
export type {
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadArrayResult,
  NamespaceRuntimeReadMapOptions,
  NamespaceRuntimeReadMapResult,
} from './window-read.js';
export type { ActiveSchemaInfo } from './p0.js';
// issue #387（ADR 0030 T1）：watchMap 变更订阅公共类型（type-only——值导出面仍恰
// RuntimeWriteFatalError 一键冻结）。
export type {
  NamespaceRuntimeWatchMapChange,
  NamespaceRuntimeWatchMapHandle,
  NamespaceRuntimeWatchMapNotification,
} from './watch-map.js';
// issue #388（ADR 0030 T2，纯加法）：watchMap 谓词 options 面（type-only +2——
// options 袋 + 标量值域别名；`where` 联合为模块内部类型，结构经 Options 可达）。
export type {
  NamespaceRuntimeWatchMapOptions,
  NamespaceRuntimeWatchMapScalarValue,
} from './watch-map.js';
export type { RuntimeWriteFatalPhase } from './errors.js';
export type { DataMutationIssue, MutateDataResult } from './write.js';
export type { ReplaceSchemaInput, SchemaReplacementIssue, ReplaceSchemaResult } from './schema-write.js';
// issue #132：复制管理写面的公共类型（type-only——值导出面仍恰 RuntimeWriteFatalError
// 一键冻结；REPLICATION_ID_PATTERN 等值导出不进本入口）。
export type {
  BumpReplicationEpochResult,
  EnableReplicationInput,
  EnableReplicationResult,
  NamespaceRuntimeReplicationStatus,
  ReplicationManagementIssue,
} from './replication-write.js';
