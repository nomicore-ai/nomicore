/**
 * @nomicore/namespace-runtime —— Runtime 构造与十四键公共面（设计 §3/§4 D1/D2/D3/D6/D8'；
 * issue #132 增第十一/十二键 enableReplication/bumpReplicationEpoch；
 * issue #369（ADR 0028 W2）增第十三/十四键 readArray/readMap——窗口读组合面）。
 *
 * 构造序（D1，R2 修订落实 SA2 #3/#4——一切 throw 与一切 seam 读取均在入队前）：
 *  V1 形状守卫（loud TypeError；seam 字段全部读取限于构造栈内有限次——校验与捕获
 *     合并、均在入队前，入队后零读取（INV-N14，SA4 N-1 精确化措辞）；此时零副作用）；
 *  V2 状态门（getStatus() ∈ {ready, persistence-degraded} 放行；released/disposed/
 *     未知值 → NamespaceRuntimeConstructionError throw——零副作用，INV-N4）；
 *  V2.5 复制事实预投影（issue #132：从 live META 单次纯读——share.has + getMap +
 *     has/get 探测，损坏 → 构造 throw 零副作用；status 从 t=0 起即诚实，预启用文档
 *     无「preparing 期短暂谎报 disabled」窗口）；
 *  V3 所有权转移（全部在入队前求值）：身份/载体一次捕获 → state 初始化 →
 *      env 一次成型（纯数据闭包）→ P0 入队（thunk = 纯调用 () => runP0(env)，
 *      零属性读取/零字面量构造/无可抛点）→ writeEnv 一次成型（D6.2）→
 *      十键对象构造并 freeze。
 *
 * 公共面（D2）：对象字面量 + 闭包（非 class 实例）——原型链是 Object.prototype，
 * handle/Y.Doc/sequencer/state 只存在于闭包；Object.freeze(runtime) 防属性注入。
 * 十二键恰好（issue #89/#90/#91/#92/#132）：owner / namespaceId / read /
 * getSchema / getMetadata / getActiveSchema / getStatus / mutateData（第八键 =
 * 唯一公共 ROOT 写入口，D1）+ replaceSchema（第九键，issue #91，唯一公共 SCHEMA
 * 写入口）**+ close（第十键，issue #92——close 生命周期：幂等、同步进 closing、
 * 队尾 barrier；详见接口 JSDoc 与 close.ts）+ enableReplication / bumpReplicationEpoch
 * （第十一/十二键，issue #132——Hub 显式复制管理操作，唯一公共 META 复制保留字段
 * 写入口；经同一 WriteSequencer，槽序 E1–E7 见 replication-write.ts）**。read/write
 * readArray/readMap（第十三/十四键，issue #369）与三数据投影 getter 的接纳门
 * （lifecycle gate）住在公共方法层（D4/D5.1）：
 * closing/closed 期 read 同步结果联合拒绝、三 getter 同步 throw
 * RUNTIME_READ_DISABLED（D-2，#93 rev2）、两种写同步入队拒绝（零入队）；
 * 槽内不设 lifecycle gate——已接纳任务无条件排空（ADR-0008）。
 * 生产工厂 createNamespaceRuntime 保留包内，index.ts 不 re-export（AC1 锁定
 * entry.createNamespaceRuntime === undefined）。
 *
 * 外部 release 后的行为（v1 边界，R3）：runtime 独占的是构造时取得的那份租约；
 * 调用方越过 runtime 直接 handle.release() 属调用方违约。后果仅体现为 D9 的写位
 * 瞬时观察转 false（写槽 S2 同拒）；读取面继续观察 live Y.Doc 引用（不崩、不静默换源）。
 */
import type * as Y from 'yjs';
import type { DocHandle, ReplicationIdentityRef } from '@nomicore/persistence';
import { readArrayWindowAtPath, readLogicalValueAtPath, readMapWindowAtPath } from '@nomicore/doc-runtime';
import type {
  MutationEnvelope,
  ReadLogicalValueAtPathBudgetResult,
  ReadLogicalValueAtPathOptions,
  ReadLogicalValueResult,
} from '@nomicore/doc-runtime';
import { compileSchemaEnvelope } from '@nomicore/vfsl';
import type {
  CompileSchemaEnvelopeResult,
  ResolveSchemaBudgetOptions,
  SchemaEnvelope,
} from '@nomicore/vfsl';
import type { DiagnosticIssue, NamespaceDiagnosticChangeEmitter } from '@nomicore/namespace-diagnostic-log';
import {
  NamespaceRuntimeConstructionError,
  RUNTIME_READ_DISABLED_CODE,
  RUNTIME_WRITE_DISABLED_CODE,
  RuntimeReadDisabledError,
} from './errors.js';
import { runP0 } from './p0.js';
import type { ActiveSchemaInfo, P0Env, RuntimeState } from './p0.js';
import { projectReadDataSchema } from './read-schema-projection.js';
import { composeArrayWindowRead, composeMapWindowRead } from './window-read.js';
import type {
  NamespaceRuntimeReadArrayOptions,
  NamespaceRuntimeReadArrayResult,
  NamespaceRuntimeReadMapOptions,
  NamespaceRuntimeReadMapResult,
} from './window-read.js';
import { projectMetadata, projectSchemaEnvelope } from './projection.js';
import { WriteSequencer } from './sequencer.js';
import { buildStatus } from './status.js';
import type { NamespaceRuntimeStatus } from './status.js';
import { enqueueCloseBarrier } from './close.js';
import type { CloseEnv } from './close.js';
import { runSchemaWriteSlot } from './schema-write.js';
import type { ReplaceSchemaInput, ReplaceSchemaResult, SchemaWriteEnv } from './schema-write.js';
import {
  readReplicationFacts,
  runBumpReplicationEpochSlot,
  runEnableReplicationSlot,
} from './replication-write.js';
import type {
  BumpReplicationEpochResult,
  EnableReplicationInput,
  EnableReplicationResult,
  ReplicationWriteEnv,
} from './replication-write.js';
import { runRootWriteSlot } from './write.js';
import { disabled } from './write.js';
import type { MutateDataResult, WriteEnv } from './write.js';
import { createSessionFanout, registerReplicationHost } from './replication-session.js';
import type { RuntimeReplicationHost } from './replication-session.js';
import type { SequencerSlotSample } from './sequencer.js';
import { buildDiagnosticEnv, createSlotDiag, emitAttempt, emitSlot } from './diagnostic.js';
import { createWatchHub } from './watch-map.js';
import type {
  NamespaceRuntimeWatchMapHandle,
  NamespaceRuntimeWatchMapNotification,
  NamespaceRuntimeWatchMapOptions,
} from './watch-map.js';


/** 复制观测注入（issue #238 §4/§7；缺省 dormant）。 */
export interface NamespaceReplicationObservability {
  readonly stageClock?: { now(): number };
  readonly slotMetrics?: (sample: SequencerSlotSample) => void;
}

/** seam 输入（D8'）：包内确定性测试接缝；@internal 沿 doc-runtime getCompiledWith 先例。 */
export interface NamespaceRuntimeSeamInput {
  /** 注入的独占租约（所有权经本 seam 转移）。 */
  readonly handle: DocHandle;
  /** P0 编译前 await 的可控门（resolve 控制；缺省无门）。 */
  readonly p0Gate?: Promise<void>;
  /** 注入编译步（缺省 vfsl compileSchemaEnvelope；抛错 = internal fault 注入）。 */
  readonly compile?: (envelope: SchemaEnvelope) => CompileSchemaEnvelopeResult;
  /** mutation 后 dirty notification 接缝（ADR-0008 原文命名，D6.1）：构造方绑定
   *  persistence.saveDoc(handle)；测试经 seam 注入确定性 notifier。缺省 = 未绑定
   *  （写槽 S2 loud 拒绝——D6.4 拒绝虚假降级立法，非静默 no-op）。 */
  readonly notifyDirty?: () => Promise<void>;
  /** Optional best-effort diagnostic emitter; requires an explicit clock. */
  readonly diagnosticEmitter?: NamespaceDiagnosticChangeEmitter;
  /** Epoch-millisecond source used for diagnostic observedAt. */
  readonly clock?: () => number;
  readonly replicationObservability?: NamespaceReplicationObservability;
  /** 【issue #390 / ADR 0030 T4】watch 通知队列容量（testing 注入经 Registry 第三参
   *  到达；缺省 undefined → `createWatchHub` 缺省参数 = 实现常量）。数值不进公共契约。 */
  readonly watchQueueCapacity?: number;
}

/** closing/closed 期 read 拒绝分支（#92）：ADR-0008 读取能力节「预期路径、载体和
 *  lifecycle 失败使用同步结果联合」——lifecycle 失败不是路径缺陷，独立稳定码
 *  RUNTIME_READ_DISABLED（不借用 PATH_NOT_ALLOWED 把生命周期失败伪装成路径缺陷）。 */
export interface RuntimeReadDisabledResult {
  readonly ok: false;
  readonly code: 'RUNTIME_READ_DISABLED';
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/** read 失败成员（PATH_NOT_ALLOWED）：doc-runtime 单源派生——doc-runtime 保持 schema
 *  无关（负控/类型守卫双锚），失败形状以 doc-runtime 为准，不复制第二份（D1）。 */
type ReadLogicalValueFailure = Extract<ReadLogicalValueResult, { ok: false }>;

/** 预算读失败成员（PATH_NOT_ALLOWED | READ_OPTIONS_INVALID）：T1 预算联合的 Extract
 *  单源派生（零泄漏 d）——亦是接缝终态成员（seamReadOptionsInvalid）的返回类型注解
 *  （形状漂移编译锁：T1 为该成员加必填键即在此编译红）。 */
type ReadLogicalValueBudgetFailure = Extract<ReadLogicalValueAtPathBudgetResult, { ok: false }>;

/** readData options（ADR-0024 决策 1）：doc-runtime 单源类型别名（零复制）。 */
export type NamespaceRuntimeReadDataOptions = ReadLogicalValueAtPathOptions;

/** readData 成功分支（**单一四键形**；ADR-0027 决策 1/4——#364 破坏性修订，两联合共用
 *  同一成功成员类型、双成功形态坍缩）：value 为 doc-runtime 值透传（值缺席显式
 *  undefined，value 键恒在场）、`schema` 为**投影文本**（头行 + 渲染器正文 + ✂ 段；
 *  严格 `null` 单义直通——无 active schema / 路径偏离 / 敌意 path，绝非空串）、
 *  `truncated` 为本次读发生过截断的布尔机器信号（预算读逐字段透传值通道；无预算读恒
 *  false）。结构化 `truncations` 键退役——截断事实唯一载体 = 文本内 ✂ 段。
 *  失败分支 = doc-runtime PATH_NOT_ALLOWED 原样（不带 schema/truncated）+ closing/closed
 *  期 RuntimeReadDisabledResult（#92，原样）。 */
type ReadDataOkResult = {
  ok: true;
  value: unknown;
  schema: string | null;
  truncated: boolean;
};

/** read 结果联合（issue #273 / ADR-0016 + #336 ADR-0024 决策 4 + #364 ADR-0027 决策 1/4）：
 *  ready 期成功分支恒四键 `{ ok, value, schema, truncated }`（`ReadDataOkResult`）；
 *  失败分支 = doc-runtime PATH_NOT_ALLOWED 原样 + closing/closed 期
 *  RuntimeReadDisabledResult（#92，原样）——该联合**不含** READ_OPTIONS_INVALID
 *  （零泄漏：无 options 调用结构上不可达该码）。 */
export type NamespaceRuntimeReadDataResult =
  | ReadDataOkResult
  | ReadLogicalValueFailure
  | RuntimeReadDisabledResult;

/** 预算 read 结果联合（#336 ADR-0024 决策 1/4/6；#364 ADR-0027 决策 1/4 成功成员与
 *  legacy 同型）：成功面 = 同一 `ReadDataOkResult`（投影文本 + 截断布尔）；失败面追加
 *  READ_OPTIONS_INVALID（doc-runtime 预算联合 Extract 单源派生；含未知键、同步不抛、
 *  不借路径/生命周期码）。 */
export type NamespaceRuntimeReadDataBudgetResult =
  | ReadDataOkResult
  | ReadLogicalValueBudgetFailure
  | RuntimeReadDisabledResult;

/** Runtime 公共形状（D2 十键协议 + close + 复制管理两键 + 窗口读两键 = 十四键；
 *  键集/形状即公共契约——AC2/AC6/AC8 锚定）。 */
export interface NamespaceRuntime {
  /** 冻结的 owner 身份投影（只投影 userId）。 */
  readonly owner: Readonly<{ userId: string }>;
  /** namespaceId（= handle.docId，string 原始值天然不可变）。 */
  readonly namespaceId: string;
  /** readData 成功分支组合读（issue #273 / ADR-0016 + issue #336 / ADR-0024 决策 4/6 +
   *  issue #364 / ADR-0027 决策 1/2/3/4）：`value` 为 readLogicalValueAtPath 的值透传
   *  （读取保持 schema 无关、不进 sequencer、失败通道与读取保留不变量不变——ADR-0008
   *  修订节第 3 条），`schema` 为该路径的**投影文本**（`string | null`；头行 + 渲染器
   *  正文 + ✂ 段；每次读由 live derived 进程内重新渲染——string 原始值天然 detached，
   *  零缓存、调用方 mutation 绝不交叉污染 runtime 的活 schema 与后续读数）。always-on：
   *  无 schema opt-in 开关。
   *  形状（ADR-0027 决策 1，破坏性修订 —— 恒五键 → 恒四键）：成功分支**恒四键**
   *  `{ ok, value, schema, truncated }`——预算读与无预算读**同型**（结构化 `truncations`
   *  键退役，截断事实唯一载体 = 文本内 `✂ 截断事实：` 段；`truncated` 保留为机器信号：
   *  本次读发生过截断（值通道折叠/裁剪）为 true，无预算读恒 false）；失败分支形状不动、
   *  不带这些键（读在到达投影前失败，无值可截）。
   *  `schema: null` 单义（不是读的失败，读的 ok 恒真；严格 null、非空串）覆盖：① 无
   *  active schema（preparing/unavailable/fatal）；② 路径偏离 schema（raw 复制可产生
   *  schema 外数据）；③ 敌意/异态 path。路径合法但值缺席（value 显式 undefined）时
   *  schema 照常返回（路径键控）；空路径 [] 返回 ROOT 值投影文本。预算参数不是 schema
   *  开关。**已知限制（ADR-0027 已知限制 2，诚实形态）**：`schema:null` × 预算读发生
   *  截断时，键级消歧不可用——只剩 `truncated === true` 布尔，文本载体不可达。
   *  形状预算（ADR-0024 决策 1/6；#364 options 闭合形状零变化）：第二参 `options`
   *  （`{ depth?, maxChildrenPerNode? }` 封闭形状）在一次读内以**同一预算**贯通值通道
   *  （doc-runtime 三参）与投影通道（vfsl resolver 三参），两通道截断位置一一对应
   *  （ADR-0024 L81，错位即契约违约）；不传 options = 完整投影文本（头行省略预算段）。
   *  options 是 schema 无关的投影概念：`depth` 自路径终点向下限定可展开容器层数、
   *  `maxChildrenPerNode` 限定每容器保留子项数（width 对投影正文无操作——只体现为
   *  ✂ 段条目）。合法性以 doc-runtime 校验器为**单一权威**：非法 options（负数/非整数/
   *  非有限数/非对象/含未知多余键/accessor 键）响亮拒绝为稳定失败码
   *  `READ_OPTIONS_INVALID`（同步、不抛；不借用 PATH_NOT_ALLOWED / RUNTIME_READ_DISABLED
   *  ——预算缺陷不是路径缺陷，亦非生命周期缺陷）；depth 耗尽处被折容器键以折叠空壳在场，
   *  depth 条目 path 尾段 = 被折容器键名（「空壳 = 被裁」的辨识——ADR-0024 #359
   *  amendment；width 超限才是键省略）。敌意 options（Proxy/descriptor-视图不稳定）同样
   *  收敛 `READ_OPTIONS_INVALID`，绝不外抛、绝不静默为 `schema:null`。
   *  头行事实性（ADR-0027 决策 3）：`# readData [<实参 path 点分>]` + 有效预算段
   *  `{depth:N[,maxChildrenPerNode:K]}`（无有效预算则省略）；段呈现与 ✂ 段同规则
   *  （换行折叠为空格），头行恒不含换行。
   *  错误双域划界（D4；敌意/异态 path → schema:null 收敛、绝不外抛；`InternalError`
   *  ——可信域畸形 derived/投影入参——→ throw 逃逸，internal-bug-only、生产不可达——
   *  唯一逃逸 throw 通道；敌意输入零 throw）。
   *  lifecycle≠ready 期返回 RuntimeReadDisabledResult（同步、非抛、非 Promise——
   *  D4 lifecycle gate 即时生效、先于一切 options 读取与 doc 触碰，不等待已接纳任务
   *  排空）。
   *  重载序：预算重载在前、legacy 在后（`ReturnType` 取末签名 → registry lease 的
   *  `_readAlias` Equal 锚原文保持）。 */
  readonly readData: {
    (
      path: readonly (string | number)[],
      options: NamespaceRuntimeReadDataOptions,
    ): NamespaceRuntimeReadDataBudgetResult;
    (path: readonly (string | number)[]): NamespaceRuntimeReadDataResult;
  };
  /**
   * 数组面窗口读（ADR 0028 决策 1/3/4/6/7；issue #369 W2）：对 `path` 终点序列容器
   * （attached Y.Array / plain array）确定性选窗，一次调用拿到「条目列表值 + 元素口径
   * 投影文本 + 窗口截断事实」。
   *
   * - `value` = **条目列表** `{ index, value }[]`（身份随行、呈现序 = 有序基之序）；
   *   `{index,value}` 包装是传输形态，不进 schema 口径；空容器 → `value: []`；
   * - `schema` = **元素口径投影文本**（ADR-0027 形态；无头行）：锚 = `[...path, 0]`
   *   （单锚无回退），`renderProjectionText` 正文（含 `‡` 页脚与别名块）；截断且正文
   *   非 null 时追加 B-8 ✂ 窗口事实块（`✂ 截断事实：` + 一行
   *   `- <pathText> · 窗口 · 基 <basis> <dir> · kept <n>/total <N>`）；锚不可解析（无
   *   active schema / 路径偏离 / 敌意 path / 异形）→ 严格 `null`（锚失败不是读失败）；
   * - `truncated === kept < total`：`total` = 终点条目空间候选数（数组 = 长度，稀疏空洞
   *   计入；`n` 治理终点宽度，`depth` / `maxChildrenPerNode` 只治理入选项内部）；
   * - 组合式 depth 等价锚（决策 4）：每条目物化 ≡ 同预算 `readData([...path, index])`；
   *   未入选子项零物化（O(N) 标识枚举计数 + 只物化入选项）；
   * - options：`n` 必填 ≥1 有限整数（`n:0` 非法）；`orderBy` 仅收 `{by:'index',dir?}`；
   *   第二参必填、无重载；合法性以 doc-runtime W1 校验器为单一权威；
   * - 失败面（响亮不抛、同步结果联合）：W1 三码 `WINDOW_TARGET_ABSENT` /
   *   `WINDOW_CARRIER_MISMATCH` / `WINDOW_OPTIONS_INVALID` + `PATH_NOT_ALLOWED`
   *   原样透传（缺席**不吸收**、无半窗）；敌意 options 视图不稳定经接缝收编
   *   `WINDOW_OPTIONS_INVALID`；lifecycle≠ready（closing/closed）→
   *   `RuntimeReadDisabledResult`（零 options 读取、零 doc 触碰）。
   */
  readonly readArray: (
    path: readonly (string | number)[],
    options: NamespaceRuntimeReadArrayOptions,
  ) => NamespaceRuntimeReadArrayResult;
  /**
   * 键面容窗口读（ADR 0028 决策 1/3/4/6/7；issue #369 W2）：对 `path` 终点键容器
   * （attached Y.Map / plain object）确定性选窗——条目身份为 `key`（敌意键免疫：key 是
   * 条目字段值而非属性名）。
   *
   * 与 `readArray` 同款四键结算与失败面；差异仅两处：
   * - `orderBy` 词表：`{by:'key', dir?}`（缺省）或 `{field: 单段名, dir?}`（v1 恰单段）；
   * - 元素口径锚链（B-6）：`[...path, '<key>']`（Record 形：值树含动态键槽）→ 不可解析
   *   时回退 `[...path]` 容器口径（封闭对象形：容器类型块静态枚举全部条目键与值类型；
   *   该口径下 `depth` 自容器起算——已知限制，`depth ≥ 1` 得完整字段口径）。
   */
  readonly readMap: (
    path: readonly (string | number)[],
    options: NamespaceRuntimeReadMapOptions,
  ) => NamespaceRuntimeReadMapResult;
  /**
   * 第十五键（issue #387 / ADR 0030 T1；issue #388 T2 纯加法加宽第三参）：`path`
   * 终点键容器的变更订阅（无谓词形态 + 谓词形态）。
   *
   * - **建立判定全部由 active schema 完成**（ADR §3，零 live 载体探测）：valueSchema
   *   （ref 追尽后）`'object'` → 键容器（Y.Map 载体 / plain object 容器 / 封闭对象
   *   map，对齐 readMap 载体面）；`'array'` 载体、标量/终态形态、path 偏离 schema 或
   *   形状敌意 → `WATCH_MAP_CARRIER_MISMATCH`（同步 throw，message 区分原因，见
   *   `WatchMapError`）；**无 active schema 整体拒绝**
   *   `WATCH_MAP_SCHEMA_UNAVAILABLE`（legacy/preparing/unavailable/fatal 期）；
   * - **数据缺席合法**：schema 已声明但未物化 / 已删除的容器照常建立成功（订阅是机制
   *   不是数据快照——读对缺席报错、订阅宽容等待）；建立成功返回恰 `{ unsubscribe }`
   *   句柄（幂等退订、零 throw、退订后零通知）；
   * - **谓词（T2；ADR §2 封闭词表）**：第三参 `options.where` 为
   *   `{field, equals}` | `{field, in}`（恰一算子、单段 field、值域恒标量）；建立期由
   *   active schema 裁决（field 不存在 / 条目无统一值域 / 非标量域 / `in` 空数组 /
   *   词形非法）→ 同步 throw `WATCH_MAP_OPTIONS_INVALID`（失败零订阅登记）；
   *   省略 options / `undefined` / `{}` / `{where: undefined}` ⇒ 无谓词，T1 行为逐字不变；
   * - **通知判定（ADR §5 宁多勿漏）**：通知 ⟺ 真变 ∧（无谓词 ∨ 旧匹配 ∨ 新匹配 ∨
   *   旧态不可判 → 保守通知）。精确静默面 = 新增非匹配条目、plain 快照条目的整替/删除；
   *   保守面 = 嵌套部分更新（AC7 逐字）与 live Y 载体整替/删除（旧态被 Yjs 清空，
   *   不可判）。退出匹配集照常通知（消费方拉终态自辨删除视图项）；
   * - **通知**：`data` 通知恰三键 `{kind:'data', origin, changes}`——`changes` 为
   *   `{path, key}` 定位符列表（`[...path, key]` 直接拼下一轮读路径），**不含值**；
   *   一事务一通知（`observeDeep` 每事务恰一次回调）、同事务同 key 合并、FIFO；
   *   `origin` = 事务来源两态分类（本地受控写 `'local'`；复制 apply
   *   `'replication'`——**无过滤**，ADR §5 宁多勿漏）；
   * - **分发**：事务提交后在写序列器槽之外异步投递（单飞微任务泵）；订阅回调 throw
   *   静默隔离（不影响写结果、sequencer 行为与其他订阅）；有界队列溢出 →
   *   `invalidate-all`（订阅存活）；
   * - **生命周期**：lease 释放自动清理该 lease 全部订阅；
   *   lifecycle≠ready（closing/closed）期同步 throw `RuntimeReadDisabledError`（复用
   *   读域停接纳码族）。
   */
  readonly watchMap: (
    path: readonly (string | number)[],
    listener: (notification: NamespaceRuntimeWatchMapNotification) => void,
    options?: NamespaceRuntimeWatchMapOptions,
  ) => NamespaceRuntimeWatchMapHandle;
  /** SCHEMA 四标准键投影（D4；载体缺席 → null，载体异型 → loud throw NSRT-SCHEMA-E2；
   *  非 primitive 值 → loud throw）。
   *  lifecycle≠ready（closing/closed）期同步 throw RuntimeReadDisabledError（code
   *  RUNTIME_READ_DISABLED，包内类）——close 停接纳覆盖全部公共数据投影；getStatus
   *  不受影响（全生命周期观测面）。 */
  readonly getSchema: () => SchemaEnvelope | null;
  /** META 全键深拷贝（D5；载体异常/值域违规 → loud throw）。
   *  lifecycle≠ready（closing/closed）期同步 throw RuntimeReadDisabledError（code
   *  RUNTIME_READ_DISABLED，包内类）——close 停接纳覆盖全部公共数据投影；getStatus
   *  不受影响（全生命周期观测面）。 */
  readonly getMetadata: () => Record<string, unknown>;
  /** active schema 六字段身份（D8 + issue #282 加性第六键 `updatedAt`——当前 active
   *  schema generation 的安装时间（UTC ISO 8601）或 null（legacy/损坏，诚实缺席）；
   *  preparing/unavailable/fatal 期整体 null）。
   *  lifecycle≠ready（closing/closed）期同步 throw RuntimeReadDisabledError（code
   *  RUNTIME_READ_DISABLED，包内类）——close 停接纳覆盖全部公共数据投影；getStatus
   *  不受影响（全生命周期观测面）。 */
  readonly getActiveSchema: () => ActiveSchemaInfo | null;
  /** 结构化瞬时 capability status（D9 → D6，#92 七键；每次调用全新对象）。 */
  readonly getStatus: () => NamespaceRuntimeStatus;
  /** 唯一公共 ROOT 写入口（D1）：同步接纳定序（FIFO 由调用顺序决定）；
   *  不同步 throw、不同步结算——任何拒绝（gate/校验/快照）都经返回的 Promise 结算；
   *  internal fatal 经 Promise rejection（RuntimeWriteFatalError）。
   *  #92 接纳门（D5.1）：lifecycle≠ready 时同步不入队、经返回 Promise 即时 settle
   *  领域化联合（RUNTIME_WRITE_DISABLED）——零输入访问、零 doc 副作用。
   *  参数面类型化（ADR 0008 信封 + ADR 0025/0026 双形态 MutationEnvelope）：
   *  字面量调用获得判别联合补全与 excess property fail-closed（拼错 guard 键 /
   *  未知 op / 双形态同现编译期即红）；动态构造信封（JSON 反序列化、跨层传递）经
   *  `as MutationEnvelope` 显式断言退出静态检查——信封是纯数据、运行时校验
   *  （doc-runtime 信封解析）仍是不合格信封的唯一事实源，静态收紧零运行时语义变化。 */
  readonly mutateData: (mutation: MutationEnvelope) => Promise<MutateDataResult>;
  /** 唯一公共 SCHEMA 写入口（D1，issue #91）：与 mutateData 共享同一严格 FIFO write
   *  sequencer（同步接纳定序）；不依赖当前 schema 可编译（P0 unavailable 照常入槽，
   *  成功后恢复 ROOT write）；不同步 throw/结算——一切拒绝经返回的 Promise 结算；
   *  internal fatal 经 Promise rejection（RuntimeWriteFatalError）。
   *  #92 接纳门（D5.1）：同 mutateData——lifecycle≠ready 时零入队即时 ok:false。 */
  readonly replaceSchema: (input: ReplaceSchemaInput) => Promise<ReplaceSchemaResult>;
  /** 第十一/十二键（issue #132）：Hub 显式复制管理操作（ADR 0010 冻结名）——
   *  META 复制保留字段（replicationId/replicationEpoch）的唯一公共写入口。
   *  enableReplication 经同一 WriteSequencer 原子安装随机 128-bit 复制谱系 + epoch 1
   *  （单槽单事务，E1–E7 镜像 ROOT 写槽）；已启用命名空间 → 幂等 ok:true（零写入、
   *  零 notifyDirty、身份/epoch 不变——调用方传入的 replicationId 被弃用）；
   *  拒绝（ok:false, issues）经结果联合结算（REPLICATION_INPUT_INVALID /
   *  REPLICATION_META_ABSENT / RUNTIME_WRITE_DISABLED 系——内外部格式门 check
   *  提交前零写入）；写管线 internal fatal 经 RuntimeWriteFatalError rejection
   *  （committed 事实诚实）。
   *  #92 接纳门（D5.1）：同 mutateData——lifecycle≠ready 时零入队即时 ok:false。 */
  readonly enableReplication: (input: EnableReplicationInput) => Promise<EnableReplicationResult>;
  /** Hub 显式提升权威代际（身份不变——replicationId 永不被改写，INV-R1）。
   *  overflow（epoch = MAX_SAFE_INTEGER）→ ok:false 结果面拒绝、绝不回绕（判据先于
   *  任何 +1）；未启用 → REPLICATION_NOT_ENABLED；fatal/degraded/close →
   *  RUNTIME_WRITE_DISABLED 零写入。 */
  readonly bumpReplicationEpoch: () => Promise<BumpReplicationEpochResult>;
  /** 第十键（#92）：close 生命周期入口（ADR-0008「close() 幂等」）。
   *  幂等：所有调用（并发/顺序/已结算后）返回**同一 Promise 实例**（INV-C2）——
   *  barrier 恰入队一次、release 恰一次。
   *  首次调用**同步**进入 'closing' 并立即停止接纳公共 read/write（read 同步结果联合
   *  拒绝、两种写同步零入队拒绝——D4/D5.1）；close 前已接纳任务无条件排空（不取消、
   *  不设内部 timeout）；barrier 排在队列队尾、恰调一次 handle.release()（D3）。
   *  无论 release 成败 Runtime 都进入 'closed'；release 失败时本 Promise reject
   *  （稳定 NamespaceRuntimeCloseError，恒定 message + cause 保留原始异常——包内类，
   *  分类消费走 getStatus().close 摘要或 reason.code 字符串），后续调用返回同一
   *  已结算 Promise（同 rejection 原因，INV-C5）。
   *  【#92 / SA2 R-2】重入语义：在已接纳任务的槽体/notifier 回调内**同步**调用
   *  close() 属 FIFO 队尾语义——barrier 排在该任务之后，良定义无害（该写照常 settle、
   *  release 仍恰一次且晚于它）；但在 notifier 内 **await 本 close Promise 之后才
   *  放行**将构成自等待死锁（该写等 notifier → notifier 等 barrier → barrier 等该写
   *  settle）——close 与该写双双永挂起，属「不取消、不设内部 timeout」的契约行为，
   *  调用方不得如此使用。 */
  readonly close: () => Promise<void>;
}

// ═══════════════════════ R2：Registry 受控 reset fence（内部 capability；包内类型） ═══════════════════════

/**
 * 已核对复制身份的 checked 表达（设计 §3.2；结构上与 persistence 测
 * CheckedReplicationIdentity 逐字段相同——Registry 传入的读取闭包按结构赋值）。
 * `{ok:false}` = 合法读取但无匹配 enabled 事实（不带任何字段值，零泄露）。
 */
type CheckedFenceIdentity =
  | Readonly<{ ok: true; value: ReplicationIdentityRef }>
  | Readonly<{ ok: false }>;

/**
 * fence 的 persisted 读取闭包返回面（结构上与 persistence 测
 * PersistedIdentityProbeResult 相同；reject 面由 Registry 的 typed 错误分类学
 * 负责——fence 任务内 `await readPersisted()` 原样传播）。
 */
type ResetFencePersistedProbe =
  | Readonly<{ kind: 'found'; identity: CheckedFenceIdentity }>
  | Readonly<{ kind: 'missing' }>;

/**
 * beginResetFence 结果（设计 §3.4/§3.5）：
 * - `mismatch`：live/persisted 双源任一不合法或与 expected 不等——lifecycle 未动、
 *   零破坏（调用方返回领域缺失拒绝）；
 * - `missing`：committed snapshot 缺席（active entry 场景 = 持久化完整性缺陷，调用方
 *   loud fatal，不得把缺失当匹配）；
 * - `armed`：唯一成功线性化点——同一 FIFO 槽内已同步进入 closing（此后写接纳被
 *   lifecycle gate 拒绝）。`startCloseAfterFence()` 是 **lazy** close barrier 启动器：
 *   只能在 fence 槽结算后调用，绝不等待 fence 任务自身（无自等待证明，设计 §3.5）。
 */
type ResetFenceResult =
  | Readonly<{ kind: 'mismatch' }>
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'armed'; startCloseAfterFence: () => Promise<void> }>;

/** fence 槽内返回子集（startCloseAfterFence 只由槽后 continuation 产出——槽内
 *  绝不创建/await close barrier；类型面同样禁止把 armed 裸结果当完整结果消费）。 */
type ResetFenceTaskResult =
  | Readonly<{ kind: 'mismatch' }>
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'armed' }>;

/** 结构等值判别（设计 §3.2；actual.ok===false → 恒 false，绝不把未知当匹配）。 */
function fenceIdentityEquals(
  actual: CheckedFenceIdentity,
  expected: ReplicationIdentityRef,
): boolean {
  return actual.ok
    && actual.value.replicationId === expected.replicationId
    && actual.value.replicationEpoch === expected.replicationEpoch;
}

/**
 * Registry 受控 reset fence 的 Runtime 侧（设计 §3.4/§3.5）：唯一 write sequencer
 * 槽内先完成双源核验，再同步进入 closing；槽后由 lazy continuation 创建 close
 * barrier。live 身份读取自 state.replication（与 getStatus 同一真相源；构造期
 * V2.5 预投影 + enable/bump 槽 E5.5 整替——INV-R5）。
 */
function createBeginResetFence(
  sequencer: WriteSequencer,
  state: RuntimeState,
  closeAfterFence: () => Promise<void>,
): (
  expected: ReplicationIdentityRef,
  readPersisted: () => Promise<ResetFencePersistedProbe>,
) => Promise<ResetFenceResult> {
  return function beginResetFence(
    expected: ReplicationIdentityRef,
    readPersisted: () => Promise<ResetFencePersistedProbe>,
  ): Promise<ResetFenceResult> {
    // 防御性接纳门（内部 capability 契约违约通道，稳定 message 零身份回显）：
    // Registry 只在 active entry 上调用本能力；lifecycle 已关闭时拒绝启动。
    if (state.lifecycle !== 'ready') {
      return Promise.reject(
        new Error('beginResetFence: Runtime lifecycle 非 ready，拒绝启动 reset fence'),
      );
    }
    const fenceTask = sequencer.enqueue(async (): Promise<ResetFenceTaskResult> => {
      // ① 先取 persisted（外部 I/O）——此时 lifecycle 仍 ready：probe 失败/mismatch
      //    均发生在零破坏阶段（设计 §3.5 (2)）
      const persisted = await readPersisted();
      if (persisted.kind === 'missing') return { kind: 'missing' } as const;
      // ② live 投影：enable/bump 等此前已接纳的 mutation 必先于本 task 结算并参与
      //    核验（同一 FIFO——「此前已接纳任务无条件排空」）；disabled 态 = {ok:false}
      const live = state.replication;
      const liveChecked: CheckedFenceIdentity = live.state === 'enabled'
        ? { ok: true, value: { replicationId: live.replicationId, replicationEpoch: live.replicationEpoch } }
        : { ok: false };
      // ③ 严格直读：live 与 persisted 都必须与 expected 相等（任一不等/disabled → mismatch）
      if (
        !fenceIdentityEquals(liveChecked, expected)
        || !fenceIdentityEquals(persisted.identity, expected)
      ) {
        return { kind: 'mismatch' } as const;
      }
      // ④ 线性化点：同步进入 closing 后本 task 返回——绝不在此创建或 await close
      //    barrier（自等待禁律；设计 §3.5 (3)）
      state.lifecycle = 'closing';
      return { kind: 'armed' } as const;
    }, 'close-barrier');
    // ⑤ 槽后 continuation：fence task 已结算、不再是 sequencer 活跃任务——唯有此刻
    //    才允许懒创建 close barrier（predecessor tail 必然不含仍在活动的 fence 任务，
    //    依赖图无环；设计 §3.5 (4) + 无自等待证明）
    return fenceTask.then((result) => {
      if (result.kind !== 'armed') return result;
      let started: Promise<void> | undefined;
      return {
        kind: 'armed' as const,
        startCloseAfterFence: () => (started ??= closeAfterFence()),
      };
    });
  };
}

/**
 * 包内确定性 seam 构造器（AC8；@internal）。#93 rev2（D-1）收口：seam 与生产工厂
 * createNamespaceRuntime 一并保留本文件模块级导出，index.ts 对二者零 re-export——
 * 「包内」= 包内模块通道相对导入（测试经 '../src/runtime.js' 消费 seam），不经公共
 * 入口，亦不设 ./testing 子路径 export（与 index.ts 头注公共面纪律段对齐）。
 * 全同步：V1 形状守卫 → V2 状态门 → V3 入队 + 返回（P0 经 sequencer 微任务起步，
 * 绝不在构造调用栈内同步结算——INV-N1）。构造 throw 路径零副作用（INV-N4：
 * 所有校验/身份捕获均前置于 enqueue，任何 throw 都在 P0 微任务启动之前）。
 */
export function createNamespaceRuntimeWithSeam(input: NamespaceRuntimeSeamInput): NamespaceRuntime {
  // V1 形状守卫（seam 字段捕获为局部常量——读取均限构造栈内、入队前；任何不满足即
  // throw，此时零副作用）
  const captured = captureSeamInput(input);
  const { handle, userId, docId, doc } = captured;

  // V2 状态门（所有权转移的判定时点是 V2 放行）
  const status0 = handle.getStatus();
  if (status0 !== 'ready' && status0 !== 'persistence-degraded') {
    // 'released'/'disposed'/未知值 → 同 throw（DocHandleStatus 词表冻结于 ADR-0006；
    // 未知值 = adapter 契约违背，loud 而非猜测降级）。类不导出（errors.ts），
    // 稳定 message 供诊断：code 'HANDLE_NOT_USABLE' + 观测状态值。
    throw new NamespaceRuntimeConstructionError(
      `HANDLE_NOT_USABLE: DocHandle 状态 ${status0} 不可构造（接受 ready/persistence-degraded）`,
    );
  }

  // V3b seam 编译步捕获（缺省 vfsl compileSchemaEnvelope——`??` 无隐式降级语义：
  //   seam 提供即注入，未提供即真实编译步）
  const compile = captured.compile ?? compileSchemaEnvelope;

  // V2.5 复制事实预投影（issue #132；纯读：share.has + getMap + has/get 探测——
  //   R2 修订后含键存在性判别。ReplicationMetaCorruptError → 构造 throw = 零副作用
  //   （INV-N4）；status 从 t=0 起即诚实（预启用文档不存在「preparing 期短暂谎报
  //   disabled」窗口——SA6 类型锚锁死两态联合，无 'unknown' 第三态可用，唯一诚实解
  //   是构造期就位而非 P0 期补读；P0 的「只读取 SCHEMA 标准四键」职责保持不变））。
  const replicationFacts = readReplicationFacts(doc);

  // 运行态（闭包私有；唯一可变源——P0 终态迁移单点写入，读取方法零写；
  //   #92：lifecycle 写入点仅 close() 同步段与 runCloseBarrier 两处——INV-C1；
  //   #132：replication 写入点仅构造栈（上方预投影）与复制槽 E5.5 两处——INV-R5）
  const state: RuntimeState = {
    schemaState: 'preparing',
    lifecycle: 'ready',
    replication: replicationFacts,
  };

  // V3c env 一次成型（INV-N14：纯数据闭包——thunk 内零求值面、无可抛点）
  const env: P0Env = { doc, state, p0Gate: captured.p0Gate, compile };

  // V3c' writeEnv 一次成型（D6.2：写槽纯数据闭包；notifyDirty 显式 undefined 联合）
  const writeEnv: WriteEnv = { doc, handle, state, notifyDirty: captured.notifyDirty };

  // V3c''-pre watch 订阅中枢一次成型（【issue #387 / ADR 0030 T1】设计 §8-G；【issue #389
  //   T3】D5-a 构造序前移——其依赖仅 doc/state（构造栈早期即在场），schemaWriteEnv 与
  //   replicationHost 各捕获同一局部量（INV-N14 捕获局部量纪律）；构造期挂接 ROOT
  //   observeDeep（每 Runtime 恰一次；零订阅时空集合快路径）；origin 无过滤分类在产
  //   （D8），复制 apply 经 ROOT 子树结构性直达，无槽可接线。
  //   【T4 #390】第三参 = 装配缝捕获的通知队列容量（undefined → 缺省参数 = 实现常量；
  //   测试经 Registry testing overrides 加法字段真达此处——AC1/AC5）。
  const watchHub = createWatchHub(doc, state, captured.watchQueueCapacity);

  // V3c'' schemaWriteEnv 一次成型（D10 零新增注入点：同一批捕获局部量——compile 与
  //   writeEnv 共源的既有 seam 字段同时服务 P0 与 SCHEMA 写槽）
  // 【issue #282】clock 解析：注入 clock seam 优先（Registry 生产装配恒注入 Instance
  //   Clock——单时钟权威），缺省 Date.now（seam 直构/legacy 两参工厂路径——updatedAt
  //   为系统时钟读数，诚实记录安装时间）；S4.5 单点读取、读数校验在槽内。
  // 【issue #389 / T3】S5.6 `watch-end:'schema-changed'` 编排消费同一 watchHub 局部量。
  const schemaWriteEnv: SchemaWriteEnv = {
    doc,
    handle,
    state,
    notifyDirty: captured.notifyDirty,
    compile,
    clock: captured.clock ?? Date.now,
    watchHub,
  };

  // V3c''' closeEnv 一次成型（D2/D3：barrier 纯数据闭包——release 槽体零读 seam 输入）
  const closeEnv: CloseEnv = { handle, state };

  // V3c'''' Fanout + replicationWriteEnv 一次成型（#132 + issue #134：fanout 先于
  //   replicationWriteEnv——bump 槽 E5.5 fenceStale 经 env.fanout 消费同一局部量
  //  （INV-N14 纪律延续：同批捕获局部量、零新增注入点）；fanout 挂接无条件执行
  //  （无 session 时空集合快路径）；每 Runtime 恰一次 doc.on('update') 监听——INV-S2）
  const fanout = createSessionFanout(doc);
  const replicationWriteEnv: ReplicationWriteEnv = {
    doc,
    handle,
    state,
    notifyDirty: captured.notifyDirty,
    fanout,
  };
  const diagEnv = buildDiagnosticEnv(captured.diagnosticEmitter, captured.clock);

  // V3d sequencer + P0 入队（INV-N1：return 前 P0 已是队首 pending 节点；微任务起步；
  //     thunk = 纯调用 () => runP0(env)，零属性读取/零字面量构造/无可抛点——
  //     INV-N12 的「槽体全 catch」从此是结构事实）
  const obsStageClock = captured.replicationObservability?.stageClock;
  const obsSlotMetrics = captured.replicationObservability?.slotMetrics;
  const sequencer = new WriteSequencer(
    obsStageClock !== undefined && obsSlotMetrics !== undefined
      ? { now: () => obsStageClock.now(), sink: obsSlotMetrics }
      : undefined,
  );
  void sequencer.enqueue(() => runP0(env), 'P0');

  // V3d' closePromise 幂等缓存（INV-C2 的载体——并发/已结算后调用返回同一实例）
  let closePromise: Promise<void> | undefined;

  // V3d'' replication host 一次成型（issue #134 §4.1：仅依赖已捕获局部量与 sequencer
  //   ——INV-N14 纪律延续；fanout 已在 V3c'''' 创建——同一局部量）
  const replicationHost: RuntimeReplicationHost = {
    doc,
    handle,
    state,
    sequencer,
    notifyDirty: captured.notifyDirty,
    fanout,
    diagEnv,
    compile, // 【issue #286】apply 槽 R5.6 re-arm 共享段消费（V3b 同一捕获局部量）
    watchHub, // 【issue #389 / T3】R5.7 `watch-end:'schema-changed'` 编排（同一局部量）
    ...(obsStageClock !== undefined ? { stageClock: obsStageClock } : {}),
  };

  // V3d''' close barrier 懒创建（R2，设计 §3.5 (4)）：公共 close() 首调用与 reset
  // fence 的 startCloseAfterFence() 共用同一幂等入口——barrier 恰入队一次，
  // 二者返回同一 Promise（普通 close 幂等 + fence-armed 后公共 close 不建第二
  // barrier 的双重保证，SA2 R3 红线测试 2 锚）。
  const lazyCloseBarrier = (): Promise<void> => {
    if (closePromise !== undefined) return closePromise;
    closePromise = enqueueCloseBarrier(sequencer, closeEnv);
    return closePromise;
  };

  // V3d'''' reset/普通 close 共用关闭 admission 分型（【issue #389 / ADR 0030 §4 T3】D5-b）：
  // 两种风味**共享同步首步** `fanout.terminateAll('runtime-close')`——现状 session 终止
  // 语义逐字保持（R2-2 不变量：close() 同步终止/detach 全部存活 ReplicationSession；
  // terminateAll 幂等，两入口汇合零重复副作用）。
  //   ① 正常 close 风味（idle/delete/shutdown/公共 close()）：fanout 终止 + 静默收口
  //      （watch 订阅静默清场——ADR §4 终结三因不含 runtime close；缺一即非现状）。
  //   ② reset fence 风味（startCloseAfterFence 唯一消费者）：fanout 终止 + watch 订阅
  //      终止（doc-replaced，同步段队尾追加 + 摘除）+ 投递结算并入 close 承诺——
  //      `registry.resetReplica` 结算（await closePromise 之后）即「reset 前已建立的
  //      订阅流已含已投递的 watch-end 且为末条」（B-T3-3 冻结机制；registry 零改动）。
  //      force-release 在此同步段之后触发 lease 清理 → 句柄 unsubscribe 对 terminated
  //      为 no-op（不清队 ⟹ 滞留 data 必达，B-T3-6）。
  // 风味由**首调用者**固定：`beginResetFence` 在 lifecycle ≠ 'ready' 时拒绝 ⇒ 公共 close
  // 先行后 fence 不可达；反向（fence 先行、公共 close 复用）安全。缓存已置位后第二入口
  // 直接复用同一实例、不重跑任何风味体（admission 恰执行一次；SA2 N-4/N-5'）。
  const closeAfterFenceNormal = (): Promise<void> => {
    fanout.terminateAll('runtime-close');
    // 【issue #387】watch 中枢同步收口（与 fanout.terminateAll 并置）：摘 observer、
    //   清全部订阅（静默——ADR §4 终结三因不含 runtime close；lease force-release 已
    //   先行清理，此处为防御性收口）。
    watchHub.shutdown();
    return lazyCloseBarrier();
  };

  const closeAfterFenceReset = (): Promise<void> => {
    if (closePromise !== undefined) return closePromise; // 第二入口直接复用（不重跑风味体）
    fanout.terminateAll('runtime-close'); // 共享同步首步（现状/A 不变量逐字保持）
    const delivered = watchHub.terminateAll('doc-replaced'); // 同步段：队尾追加 + 注销
    const barrier = lazyCloseBarrier(); // 唯一 close barrier（懒创建，恰一次）
    const admission = barrier.then(async () => {
      await delivered; // 终止项投递结算（有界微任务——无墙钟、无 I/O）
      // 防御性收口后置（此时 terminated 订阅队列已排空）；barrier reject 时本成功臂
      // 不执行 ⟹ 跳过（良性：terminated 已摘除、集合空走 observer 快路径、lifecycle
      // ='closed' 拒新订阅；终止项仍经独立微任务泵送达）。**禁止**为补上该收口构造
      // 可 reject 的第二承诺链（SA2 N-1：admission 承诺除 barrier reject 外零新增
      // reject 面；`.then` 内调用自身零抛点）。
      watchHub.shutdown();
    });
    closePromise = admission; // 缓存完整 admission 承诺（barrier + 投递结算 + 收口）
    return admission;
  };

  // V3d''''' 受控 reset fence（设计 §3.4/§3.5）：唯一写 sequencer 槽内双源核验 + 同步
  // arm closing；槽后懒启动共享关闭 admission（reset 风味）。仅以 non-enumerable 键挂到
  // runtime 对象（Object.keys 十二键审计不漂移——runtime-acceptance-exports-audit /
  // runtime-registry-internal-seam 既有锚零回归）。
  const beginResetFence = createBeginResetFence(sequencer, state, closeAfterFenceReset);
  // V3e 公共面（十四键闭包对象；owner/namespaceId 由 V3a 捕获局部量构造——不再解引用成员）
  const owner = Object.freeze({ userId });

  /**
   * readData 组合体（#336 ADR-0024 决策 4/6；#364 ADR-0027 决策 1/2/3/4；函数声明 +
   * 双重载——无 cast 落地重载属性的唯一常规形态：返回联合的实现闭包不可赋给重载属性，
   * 带重载声明的函数类型即重载签名集）。
   *
   * 编排（B-1/B-2）：S1 lifecycle gate 先行（closing/closed → RUNTIME_READ_DISABLED，
   * 零 options 读取、零 doc 触碰）→ S2a 无 options（两参值读 + 两参投影文本，头行无
   * 预算段；无截断布尔恒 false——结构上无截断）→ S2b 预算（三参值读；T1 权威校验的
   * G0 → options → N0 定序原样生效；失败成员原样透传）→ C 接缝净化 canonicalReadOptions
   * （T1 同款读纪律，零 [[Get]]）→ P 投影文本四参（canonical 恒过 resolver 第二道门 +
   * 值通道截断清单喂渲染器 ✂ 段）→ **恒四键组装**（truncated 逐字段透传，零合成——
   * 清单源 = 值通道载体计数；结构化 truncations 键退役）。
   */
  function readData(path: readonly (string | number)[]): NamespaceRuntimeReadDataResult;
  function readData(
    path: readonly (string | number)[],
    options: NamespaceRuntimeReadDataOptions,
  ): NamespaceRuntimeReadDataBudgetResult;
  function readData(
    path: readonly (string | number)[],
    options?: NamespaceRuntimeReadDataOptions,
  ): NamespaceRuntimeReadDataResult | NamespaceRuntimeReadDataBudgetResult {
    // D4 lifecycle gate 在组合**之前**：closing/closed 期同步结果联合拒绝（非抛、
    // 非 Promise、零触碰 live Y.Doc——RED 锚 case 2/4 三重锁；#336 B-1：先于一切 options
    // 触达——停接纳期敌意 trap 零执行）。ready 期 = ADR-0016 组合（D2）：值读先行 →
    // 失败短路（零 schema 工作，失败对象不带成功键）→ 成功恒四键。
    const lifecycle = state.lifecycle;
    if (lifecycle !== 'ready') {
      return readDisabled(lifecycle, path);
    }
    if (options === undefined) {
      const result = readLogicalValueAtPath(doc, path);
      if (!result.ok) return result; // 失败短路：PATH_NOT_ALLOWED 原样透传（不带新键）
      return {
        ok: true,
        value: result.value,
        schema: projectReadDataSchema(state, path), // 投影文本（头行无预算段 + 正文）
        truncated: false, // 无预算读结构上无截断（ADR-0024 决策 2）
      };
    }
    // 三参：T1 权威校验（G0 → options → N0 → N1 → P1）；PATH_NOT_ALLOWED |
    // READ_OPTIONS_INVALID 原样透传（零形状复制——D1 单源纪律）。
    const result = readLogicalValueAtPath(doc, path, options);
    if (!result.ok) return result;
    // C 接缝净化（仅值通道成功后；读纪律与 T1 validateReadOptions 逐字对齐：
    // Object.keys 键空间 + descriptor data-property 取值 + try 收编 + present-undefined
    // 剥离/-0 归一；零 [[Get]]——get trap 从不执行）。
    const canonical = canonicalReadOptions(options);
    if (!canonical.ok) {
      // A-2b：视图不稳定（敌意 descriptor/Proxy 在读间漂移或抛异常）→ 响亮失败。
      // 出口①：重派发——T1 权威再校验（状态化 trap 复掷由 T1 内层 try 单源收编为
      // READ_OPTIONS_INVALID；options 失败于 N0 前短路、零 doc 触碰；重派发全程顶层
      // try，不可能外抛）。
      const reDispatch = readLogicalValueAtPath(doc, path, options);
      if (!reDispatch.ok) return reDispatch;
      // 出口②：交替视图终态（T1 竟又接受——两通道同预算在该输入上不可判定，唯一诚实
      // 出路是响亮失败；A-2c D1 登记豁免：由 runtime 构造成员，形状由 Extract 单源
      // 类型注解锁死）。
      return seamReadOptionsInvalid(path);
    }
    return {
      ok: true,
      value: result.value,
      schema: projectReadDataSchema(state, path, canonical.options, result.truncations), // 投影文本：头行（canonical 预算段）+ 正文 + ✂ 段
      truncated: result.truncated, // B14 透传：本次读发生过截断（=== 值通道截断）
    };
  }

  /**
   * 窗口读组合体（ADR 0028 决策 9 第三层；issue #369 W2；函数体 = S1 → S2 → S3–S6）。
   *
   * S1 lifecycle gate 先行（closing/closed → RUNTIME_READ_DISABLED，零 options 读取、
   * 零 doc 触碰——镜像 readData B-1）；S2 W1 载体原语**直通**（raw 引用；失败成员原样
   * 返回，绝不吸收、无半窗——options 合法性由 W1 单权威裁定，非法 options 零 doc 触碰）；
   * W1 成功后把成功成员（`value` 条目列表 + `total` 候选/匹配计数双形态）交
   * `window-read.ts` 组合（S3 canonical 接缝五键镜像 → S5 锚链投影正文 → S6 四键结算；
   * `truncated` 双语义见 ADR 0029 §5：无 `where` = `kept < total` + ✂ 窗口事实块，
   * 有 `where` = 装满判定 `kept === n` 且 ✂ 永不装配）；`total` 消费自 W1 单源
   * （ADR 0029 §8 下沉），组合层零重算、零谓词求值。全方法同步、零 sequencer、
   * 零状态写入。
   */
  function readArray(
    path: readonly (string | number)[],
    options: NamespaceRuntimeReadArrayOptions,
  ): NamespaceRuntimeReadArrayResult {
    const lifecycle = state.lifecycle;
    if (lifecycle !== 'ready') return readDisabled(lifecycle, path);
    const windowResult = readArrayWindowAtPath(doc, path, options);
    if (!windowResult.ok) return windowResult; // S2：三码 + PATH_NOT_ALLOWED 原样透传
    return composeArrayWindowRead(state, doc, path, options, windowResult.value, windowResult.total);
  }

  /** 键面容窗口读组合体（同 readArray 骨架；面符换 map、锚链两级见 window-read.ts）。 */
  function readMap(
    path: readonly (string | number)[],
    options: NamespaceRuntimeReadMapOptions,
  ): NamespaceRuntimeReadMapResult {
    const lifecycle = state.lifecycle;
    if (lifecycle !== 'ready') return readDisabled(lifecycle, path);
    const windowResult = readMapWindowAtPath(doc, path, options);
    if (!windowResult.ok) return windowResult;
    return composeMapWindowRead(state, doc, path, options, windowResult.value, windowResult.total);
  }

  const runtime: NamespaceRuntime = {
    owner,
    namespaceId: docId,
    readData,
    readArray,
    readMap,
    // 【issue #387 / ADR 0030 T1；T2 #388 纯加法加宽第三参】第十五键：lease 面透传
    //   对偶（readData/readMap 同款）；建立判定（含谓词门⑥）/lifecycle 门/登记全在
    //   hub 内（同步 throw 面原样上抛——B-3；options raw 引用直传，runtime 层零解释）。
    watchMap: (path, listener, options) => watchHub.watchMap(path, listener, options),
    getSchema: () => {
      // D2（#93 rev2，SA8 裁决 B）：数据投影 getter 停接纳——key 仅 lifecycle（裁决 H：
      // 绝不 keyed on fatal/schemaState）；拒绝先于触碰 live Y.Doc（INV 同 read() 分支）
      if (state.lifecycle !== 'ready') {
        throw new RuntimeReadDisabledError('getSchema', state.lifecycle);
      }
      return projectSchemaEnvelope(doc, 'public'); // D4（INV-N13 守卫）
    },
    getMetadata: () => {
      // D2（#93 rev2，SA8 裁决 B）：同 getSchema——key 仅 lifecycle；拒绝先于
      // 深拷贝递归（零触碰 live Y.Doc——F-3 原始 RangeError 不外泄的证明面）
      if (state.lifecycle !== 'ready') {
        throw new RuntimeReadDisabledError('getMetadata', state.lifecycle);
      }
      return projectMetadata(doc); // D5（深拷贝 / 载体与值域双 loud）
    },
    getActiveSchema: () => {
      // D2（#93 rev2，SA8 裁决 B）：同 getSchema——key 仅 lifecycle；不触 doc
      if (state.lifecycle !== 'ready') {
        throw new RuntimeReadDisabledError('getActiveSchema', state.lifecycle);
      }
      return state.activeInfo ?? null; // D8（preparing/unavailable/fatal 期 null 照常）
    },
    getStatus: () => buildStatus(handle, state), // D9 → D6（handle 仅用于 ready 期 writableNow 瞬时观察）
    mutateData: (mutation: MutationEnvelope): Promise<MutateDataResult> => {
      // D5.1 接纳门：lifecycle≠ready 时同步零入队拒绝（INV-C3）——经返回 Promise
      // 即时 settle 领域化联合（不 throw、不读 mutation——Proxy 零触发、零 doc 副作用）
      if (state.lifecycle !== 'ready') {
        const result = disabled(lifecycleWriteRefusal(state.lifecycle));
        if (result.ok === false) {
          emitAttempt(diagEnv, {
            operation: 'root-mutation', stage: 'acceptance', result: { kind: 'rejected' },
            code: RUNTIME_WRITE_DISABLED_CODE, input: { status: 'not-accessed' },
            issues: result.issues as DiagnosticIssue[],
          });
        }
        return Promise.resolve(result);
      }
      const diag = diagEnv.emitter !== undefined ? createSlotDiag('root-mutation') : undefined;
      const settled = sequencer.enqueue(() => runRootWriteSlot(writeEnv, mutation, diag), 'S');
      void settled.then(
        (value) => { emitSlot(diagEnv, diag, { kind: 'fulfilled', value }); },
        () => { emitSlot(diagEnv, diag, { kind: 'rejected' }); },
      );
      return settled;
    },
    replaceSchema: (input: ReplaceSchemaInput): Promise<ReplaceSchemaResult> => {
      // D5.1 接纳门：同 mutateData——lifecycle≠ready 时零入队即时 ok:false
      if (state.lifecycle !== 'ready') {
        const result = disabled(lifecycleWriteRefusal(state.lifecycle));
        if (result.ok === false) {
          emitAttempt(diagEnv, {
            operation: 'schema-replacement', stage: 'acceptance', result: { kind: 'rejected' },
            code: RUNTIME_WRITE_DISABLED_CODE, input: { status: 'not-accessed' },
            issues: result.issues as DiagnosticIssue[],
          });
        }
        return Promise.resolve(result);
      }
      const diag = diagEnv.emitter !== undefined ? createSlotDiag('schema-replacement') : undefined;
      const settled = sequencer.enqueue(() => runSchemaWriteSlot(schemaWriteEnv, input, diag), 'schema');
      void settled.then(
        (value) => { emitSlot(diagEnv, diag, { kind: 'fulfilled', value }); },
        () => { emitSlot(diagEnv, diag, { kind: 'rejected' }); },
      );
      return settled;
    },
    enableReplication: (input: EnableReplicationInput): Promise<EnableReplicationResult> => {
      // D5.1 接纳门（#132）：同 mutateData——lifecycle≠ready 时零入队即时 ok:false
      if (state.lifecycle !== 'ready') {
        const result = disabled(lifecycleWriteRefusal(state.lifecycle)) as EnableReplicationResult;
        if (result.ok === false) {
          emitAttempt(diagEnv, {
            operation: 'replication-enable', stage: 'acceptance', result: { kind: 'rejected' },
            code: RUNTIME_WRITE_DISABLED_CODE, input: { status: 'not-accessed' },
            issues: result.issues as DiagnosticIssue[],
          });
        }
        return Promise.resolve(result);
      }
      // D1（#132）：与 mutateData/replaceSchema 同一 sequencer 实例——同步接纳定序、
      // 占槽互斥（FIFO 互通）；thunk 是纯调用——input 引用仅被捕获不被读取
      //（Proxy 零触发），无可抛点；槽 E3 单读捕获定序在队列内
      const diag = diagEnv.emitter !== undefined ? createSlotDiag('replication-enable') : undefined;
      const settled = sequencer.enqueue(() => runEnableReplicationSlot(replicationWriteEnv, input, diag), 'E');
      void settled.then(
        (value) => { emitSlot(diagEnv, diag, { kind: 'fulfilled', value }); },
        () => { emitSlot(diagEnv, diag, { kind: 'rejected' }); },
      );
      return settled;
    },
    bumpReplicationEpoch: (): Promise<BumpReplicationEpochResult> => {
      // D5.1 接纳门（#132）：同 mutateData——lifecycle≠ready 时零入队即时 ok:false
      if (state.lifecycle !== 'ready') {
        const result = disabled(lifecycleWriteRefusal(state.lifecycle)) as BumpReplicationEpochResult;
        if (result.ok === false) {
          emitAttempt(diagEnv, {
            operation: 'replication-epoch-bump', stage: 'acceptance', result: { kind: 'rejected' },
            code: RUNTIME_WRITE_DISABLED_CODE, issues: result.issues as DiagnosticIssue[],
          });
        }
        return Promise.resolve(result);
      }
      const diag = diagEnv.emitter !== undefined ? createSlotDiag('replication-epoch-bump') : undefined;
      if (diag !== undefined) diag.input = undefined;
      const settled = sequencer.enqueue(() => runBumpReplicationEpochSlot(replicationWriteEnv, diag), 'bump');
      void settled.then(
        (value) => { emitSlot(diagEnv, diag, { kind: 'fulfilled', value }); },
        () => { emitSlot(diagEnv, diag, { kind: 'rejected' }); },
      );
      return settled;
    },
    close: (): Promise<void> => {
      // D2：幂等（INV-C2）——已赋值（含已结算 reject）即返回同一实例，release 恰一次
      if (closePromise !== undefined) return closePromise;
      // 同步迁移（返回前可观测——RED 锚「close() 返回前 lifecycle==='closing'」，
      // INV-C1）；写入点在 close() 同步段，与接纳门 check-then-enqueue 无交错（JS
      // run-to-completion，§12 #6）
      state.lifecycle = 'closing';
      // R2-2（issue #134 round 2，§3.1）：共享关闭 admission 同步终止/detach 全部
      // 现存 sessions，再创建队尾 barrier；reset fence 也走同一入口，避免归档/bootstrap
      // 后旧 session 仍 attached。conflicted 终态不降级；已接纳 apply 槽照常排空。
      // 【issue #389 / T3】公共 close = 正常风味（fanout 终止 + watch 订阅静默收口）；
      // 若 reset 风味已先行（fence 先行、close 复用），早退分支已返回同一实例。
      closePromise = closeAfterFenceNormal();
      return closePromise;
    },
  };
  // R2：受控 reset fence 以 non-enumerable 键附加（不进入公共十二键/声明图；
  // freeze 前定义——Object.freeze 后属性不可增删的既定纪律保持）。
  Object.defineProperty(runtime, 'beginResetFence', {
    value: beginResetFence,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  const frozen = Object.freeze(runtime);
  // V3f replication host 登记（SA2 R1 #15：runtime 对象构造后、返回之前——WeakMap 以
  // 对象引用为键；不触碰 runtime 对象本身、零可枚举属性污染——Object.keys(runtime)
  // 仍恰十二键，runtime-registry-internal-seam.test.ts 键集锁零改动即绿）
  registerReplicationHost(frozen, replicationHost);
  return frozen;
}

/**
 * #155：Runtime 诊断注入（Registry 生产装配第三参的载荷形状；§4-D6——emitter 与
 * clock 成对：observedAt 唯一来源 = Registry 注入 Clock（#149 §5.2 配对纪律）。
 * 该类型定义于本文件（`internal.ts` 只做 type re-export——值导出键集冻结）。
 */
export interface RuntimeForRegistryDiagnostic {
  readonly emitter?: NamespaceDiagnosticChangeEmitter;
  readonly clock?: () => number;
  readonly replicationObservability?: NamespaceReplicationObservability;
  /** 【issue #390 / ADR 0030 T4】watch 通知队列容量（testing 控件经 Registry 装配缝
   *  到达；公共契约零泄漏——主入口构造选项不含本字段）。 */
  readonly watchQueueCapacity?: number;
}

/**
 * 生产构造器（包内，index.ts 不导出——AC1 锁定）。D6.3：绑定义务显式化为必填参数——
 * 未来 Registry 传 `() => persistence.saveDoc(handle)`（ADR-0008「由构造方绑定」）。
 * #155（§4-D6）：可选第三参 `diagnostic`（emitter+clock 成对）——不传 = 既有行为
 * 逐字节不变（条件展开进 seam input；`captureSeamInput` 成对校验/loud 语义零改动）。
 * @internal
 */
export function createNamespaceRuntime(
  handle: DocHandle,
  notifyDirty: () => Promise<void>,
  diagnostic?: RuntimeForRegistryDiagnostic,
): NamespaceRuntime {
  return createNamespaceRuntimeWithSeam({
    handle,
    notifyDirty,
    ...(diagnostic !== undefined
      ? {
          ...(diagnostic.emitter !== undefined ? { diagnosticEmitter: diagnostic.emitter } : {}),
          ...(diagnostic.clock !== undefined ? { clock: diagnostic.clock } : {}),
          ...(diagnostic.replicationObservability !== undefined
            ? { replicationObservability: diagnostic.replicationObservability }
            : {}),
          ...(diagnostic.watchQueueCapacity !== undefined
            ? { watchQueueCapacity: diagnostic.watchQueueCapacity }
            : {}),
        }
      : {}),
  });
}

/** D4 包内 helper：closing/closed 期 read 停接纳的结果联合分支（不导出）。
 *  message 插值仅 lifecycle 字面量（'closing'/'closed' 闭集字符串）——稳定；属 close 域
 *  术语，与 fatal 域文案分域（INV-C10）。 */
function readDisabled(lifecycle: 'closing' | 'closed', path: unknown): RuntimeReadDisabledResult {
  return {
    ok: false,
    code: RUNTIME_READ_DISABLED_CODE,
    path: echoReadPath(path),
    message: `${RUNTIME_READ_DISABLED_CODE}: Runtime lifecycle 为 ${lifecycle}——` +
      'close 已停止接纳公共读取；本调用不触碰 live Y.Doc',
  };
}

/** 包内 path 回显 helper（不导出；readDisabled 既有纪律提取为共用——#336 A-2c）：
 *  非数组 → []；Array.isArray 守卫 + try/catch spread，敌意 Proxy 数组坍缩 []（沿
 *  doc-runtime safeSpreadPath 纪律）；恒返回新鲜副本（不别名调用方数组）。 */
function echoReadPath(path: unknown): readonly (string | number)[] {
  if (!Array.isArray(path)) return [];
  try {
    return [...path];
  } catch {
    return []; // 敌意 Proxy 数组防御（沿 read.ts safeSpreadPath 纪律）
  }
}

/**
 * #336 接缝净化（包内，不导出）：仅在 `readLogicalValueAtPath` 三参调用**成功后**执行。
 * 读纪律与 T1 权威（doc-runtime `validateReadOptions`，read.ts L326–361）逐字对齐：
 *  (a) 键空间 = `Object.keys(raw)`（own enumerable string 键——与非 enumerable/继承键双盲）；
 *  (b) 轴值 = `Object.getOwnPropertyDescriptor(raw, key)` 的 data-property `value`——全程零
 *      `[[Get]]`（零 get trap 执行、零继承链查找），accessor 显形即视图已变；
 *  (c) 整体 try 收编探测期 trap 异常（与 T1 同一收编面减 getPrototypeOf——canonical 的轴
 *      只依赖 own-enumerable 键视图，原型视图漂移不可能改变任何轴值；省去即少一次 trap 触达）；
 *  (d) 仅「键在场（descriptor 存在且非 accessor）∧ 值为 ≥0 有限整数」才写入 canonical
 *      （present-undefined/ownKeys 谎报键/非 enumerable 一律不写）；-0 归一 0（镜像 T1 H10）。
 *
 * T1 已成功 ⟹ 其第一次读到的视图满足接受判据。本函数以同一纪律重读：凡与该判据不一致
 * （键集漂移 / accessor 显形 / 值非法化 / trap 抛异常）⟹ 对象在两次读之间不稳定（非确定性
 * 敌意体）→ 返回 ok:false 交组合层响亮失败（A-2b），绝不静默、绝不外抛。净化器**不比权威
 * 看得更多**（SA2 F1 修订核心）；T1 演进时本 helper 是唯一需同步复查点（注释互指锚定）。
 */
function canonicalReadOptions(raw: ReadLogicalValueAtPathOptions): CanonicalReadOptions {
  try {
    const out: { depth?: number; maxChildrenPerNode?: number } = {};
    for (const key of Object.keys(raw)) {
      // (a) 与 T1 同一键空间
      if (key !== 'depth' && key !== 'maxChildrenPerNode') {
        return { ok: false }; // 键集漂移：T1 视角本应拒绝 → 视图不稳定
      }
      const desc = Object.getOwnPropertyDescriptor(raw, key); // (b) 与 T1 同一取值通道（零 [[Get]]）
      if (desc === undefined) continue; // ownKeys 谎报键：与 T1 同处置（≡ 非 own，不写）
      if (desc.get !== undefined || desc.set !== undefined) {
        return { ok: false }; // accessor 显形（T1 已拒、如今在场）→ 视图不稳定
      }
      const value = desc.value;
      if (value === undefined) continue; // (d) present-undefined ≡ 缺席（R1）——剥离
      if (
        typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value) || value < 0
      ) {
        return { ok: false }; // 值非法/已变异：绝不把非法值喂给 resolver 第二道门（ER-1 收口）
      }
      if (key === 'depth') out.depth = value === 0 ? 0 : value; // H10：-0 归一（镜像 T1 L353）
      else out.maxChildrenPerNode = value === 0 ? 0 : value;
    }
    return { ok: true, options: out }; // 全新 plain 字面量；键集 ⊆ 两轴、值全合法
  } catch {
    return { ok: false }; // (c) 探测期 trap 异常——收编，绝不外抛
  }
}

/**
 * 接缝净化判别结果（#336 A-2/A-2b）：异常不作跨函数控制流（判别联合返回——与 T1
 * `{ok:false,msg}` 同款）。
 */
type CanonicalReadOptions =
  | { readonly ok: true; readonly options: ResolveSchemaBudgetOptions }
  | { readonly ok: false };

/**
 * 接缝终态成员（包内，不导出；#336 A-2c）：唯一构造触发 = 净化视图不稳定 ∧ T1 重派发又接受。
 *
 * 豁免登记（对 D1「失败形状以 doc-runtime 为准，不复制第二份」）：本构造点的触发条件是
 * 接缝级的「读间视图不稳定」，T1 自身的一次校验在结构上无法观察到该条件（它只做一次读）。
 * 形状漂移风险以返回类型注解锁死——类型 `ReadLogicalValueBudgetFailure` 即
 * `Extract<T1 预算联合, {ok:false}>`（类型仍单源）：T1 未来为该成员加必填键时，本对象
 * 字面量在此编译红（fail loud，不静默漂移）。path 回显复用 `echoReadPath`（与
 * readDisabled 同纪律，非新形状）；message 恒非空。
 */
function seamReadOptionsInvalid(path: readonly (string | number)[]): ReadLogicalValueBudgetFailure {
  return {
    ok: false,
    code: 'READ_OPTIONS_INVALID',
    path: echoReadPath(path),
    message:
      'READ_OPTIONS_INVALID: options 视图在读取期间不稳定（敌意 descriptor/Proxy）——接缝拒绝组合同预算读',
  };
}

/** D5.1 包内 helper：lifecycle≠ready 期写接纳拒绝的稳定 reason（不导出）。
 *  同 readDisabled——插值仅 lifecycle 字面量，close 域术语（INV-C10）；
 *  disabled() 尾注「零写入、输入零访问」如实（拒绝分支不读 mutation/input）。 */
function lifecycleWriteRefusal(lifecycle: 'closing' | 'closed'): string {
  return `Runtime lifecycle 为 ${lifecycle}——close 已停止接纳公共写；close 前已接纳任务仍无条件排空，本调用不入队`;
}

/** V1 形状守卫 + 捕获（INV-N14：seam 字段读取全部限于构造栈内有限次——V1 校验读取与
 *  捕获合并于本函数、均在 enqueue 之前；入队后零读取（thunk/槽体/公共面只消费捕获的
 *  局部量——flaky getter 的任何行为在构造期 throw 或已被捕获，入队后对 runtime 不可
 *  观测）。此后 runtime 只消费局部量。 */
function captureSeamInput(input: unknown): {
  handle: DocHandle;
  userId: string;
  docId: string;
  doc: Y.Doc;
  p0Gate: Promise<void> | undefined;
  compile: ((envelope: SchemaEnvelope) => CompileSchemaEnvelopeResult) | undefined;
  notifyDirty: (() => Promise<void>) | undefined;
  diagnosticEmitter: NamespaceDiagnosticChangeEmitter | undefined;
  clock: (() => number) | undefined;
  replicationObservability: NamespaceReplicationObservability | undefined;
  watchQueueCapacity: number | undefined;
} {
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('seam 输入必须是对象（{ handle, p0Gate?, compile?, notifyDirty? }）');
  }
  const rec = input as Record<string, unknown>;
  // handle 形状（防御 seam 调用方传残缺 handle——残缺任何 throw 均在入队前，INV-N4）
  const handle = rec.handle;
  if (typeof handle !== 'object' || handle === null) {
    throw new TypeError('seam 输入缺少 handle（必须为 DocHandle 形状对象）');
  }
  const h = handle as Record<string, unknown>;
  if (typeof h.getStatus !== 'function') {
    throw new TypeError('handle.getStatus 必须为 function（DocHandle 契约）');
  }
  // D10（#92）：release 成为 close barrier 的 load-bearing 依赖——契约违背（缺 release）
  // 应在构造栈 loud 拒绝（INV-N4：一切校验前置于 enqueue、throw 路径零副作用），
  // 而非深埋 barrier 内 TypeError
  if (typeof h.release !== 'function') {
    throw new TypeError('handle.release 必须为 function（DocHandle 契约）');
  }
  const owner = h.owner;
  if (typeof owner !== 'object' || owner === null) {
    throw new TypeError('handle.owner 必须为对象（User 契约）');
  }
  const userId = (owner as Record<string, unknown>).userId;
  if (typeof userId !== 'string') {
    throw new TypeError('handle.owner.userId 必须为 string（User 契约）');
  }
  const docId = h.docId;
  if (typeof docId !== 'string') {
    throw new TypeError('handle.docId 必须为 string（DocHandle 契约）');
  }
  const doc = h.doc;
  if (typeof doc !== 'object' || doc === null) {
    throw new TypeError('handle.doc 必须为对象（Y.Doc 契约）');
  }
  // seam 可选字段（捕获为局部常量——读取均限构造栈内、入队前）
  let p0Gate: Promise<void> | undefined;
  if (rec.p0Gate !== undefined) {
    const g = rec.p0Gate;
    if (typeof g !== 'object' || g === null || typeof (g as { then?: unknown }).then !== 'function') {
      throw new TypeError('input.p0Gate 若提供必须是 thenable（Promise）');
    }
    p0Gate = g as Promise<void>;
  }
  let compile: ((envelope: SchemaEnvelope) => CompileSchemaEnvelopeResult) | undefined;
  if (rec.compile !== undefined) {
    if (typeof rec.compile !== 'function') {
      throw new TypeError('input.compile 若提供必须是 function');
    }
    compile = rec.compile as (envelope: SchemaEnvelope) => CompileSchemaEnvelopeResult;
  }
  let notifyDirty: (() => Promise<void>) | undefined;
  if (rec.notifyDirty !== undefined) {
    if (typeof rec.notifyDirty !== 'function') {
      throw new TypeError('input.notifyDirty 若提供必须是 function（persistence.saveDoc(handle) 窄接缝）');
    }
    notifyDirty = rec.notifyDirty as () => Promise<void>;
  }
  let diagnosticEmitter: NamespaceDiagnosticChangeEmitter | undefined;
  if (rec.diagnosticEmitter !== undefined) {
    const emitter = rec.diagnosticEmitter;
    if (typeof emitter !== 'object' || emitter === null || typeof (emitter as { emit?: unknown }).emit !== 'function') {
      throw new TypeError('input.diagnosticEmitter 若提供必须是含 emit 方法的对象');
    }
    const d = doc as Record<string, unknown>;
    if (typeof d.on !== 'function' || typeof d.off !== 'function') {
      throw new TypeError('装配 diagnosticEmitter 时 handle.doc 必须具备 on/off 方法');
    }
    diagnosticEmitter = emitter as NamespaceDiagnosticChangeEmitter;
  }
  let clock: (() => number) | undefined;
  if (rec.clock !== undefined) {
    if (typeof rec.clock !== 'function') throw new TypeError('input.clock 若提供必须是 function');
    clock = rec.clock as () => number;
  }
  if (diagnosticEmitter !== undefined && clock === undefined) {
    throw new TypeError('装配 diagnosticEmitter 时必须同时注入 clock');
  }
  let replicationObservability: NamespaceReplicationObservability | undefined;
  if (rec.replicationObservability !== undefined) {
    const value = rec.replicationObservability;
    if (typeof value !== 'object' || value === null) throw new TypeError('input.replicationObservability 若提供必须是对象');
    const orec = value as Record<string, unknown>;
    const stageClock = orec.stageClock;
    const slotMetrics = orec.slotMetrics;
    if (stageClock !== undefined && (typeof stageClock !== 'object' || stageClock === null || typeof (stageClock as { now?: unknown }).now !== 'function')) {
      throw new TypeError('input.replicationObservability.stageClock 若提供必须是 { now(): number }');
    }
    if (slotMetrics !== undefined && typeof slotMetrics !== 'function') throw new TypeError('input.replicationObservability.slotMetrics 若提供必须是 function');
    replicationObservability = {
      ...(stageClock !== undefined ? { stageClock: stageClock as { now(): number } } : {}),
      ...(slotMetrics !== undefined ? { slotMetrics: slotMetrics as (sample: SequencerSlotSample) => void } : {}),
    };
  }
  // 【issue #390 / ADR 0030 T4】watch 队列容量形状门（沿本文件逐字段形状门纪律；
  // Registry 单点已挡垃圾值，此处为直连 seam 调用方的防御面）：提供则必须是
  // 1..2147483647 的有限整数——否则构造期同步 throw（INV-N4：前置于 enqueue、零副作用），
  // 绝不静默按「恒溢出」降级运行（fail loud，非 fallback）。
  let watchQueueCapacity: number | undefined;
  if (rec.watchQueueCapacity !== undefined) {
    const value = rec.watchQueueCapacity;
    if (
      typeof value !== 'number'
      || !Number.isInteger(value)
      || value < 1
      || value > 2_147_483_647
    ) {
      throw new TypeError(
        'input.watchQueueCapacity 若提供必须是 1..2147483647 的有限整数（watch 通知队列容量）',
      );
    }
    watchQueueCapacity = value;
  }
  return {
    handle: handle as DocHandle,
    userId: userId as string,
    docId: docId as string,
    doc: doc as Y.Doc,
    p0Gate,
    compile,
    notifyDirty,
    diagnosticEmitter,
    clock,
    replicationObservability,
    watchQueueCapacity,
  };
}
