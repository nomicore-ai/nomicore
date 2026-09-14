/**
 * @nomicore/namespace-runtime —— watchMap 键容器变更订阅（issue #387 / ADR 0030
 * 「变更订阅」T1 tracer bullet 的 runtime 侧唯一实现载体；设计 §8-B/C/D/E/G）。
 *
 * 职责（ADR 0030 §7 分层）：订阅簿记 + 建立判定 + 事务级信号推导 + 真变判定 +
 * 槽外异步分发与有界队列 + 关停。registry lease 面只做透传与生命周期登记
 * （`lease.ts`）。
 *
 * 机制要点（逐款对应设计冻结项）：
 * - **D1/D2 挂点**：每 Runtime 恰一次 `ROOT.observeDeep`（构造期挂接，镜像
 *   `createSessionFanout` 的「每 Runtime 恰一次监听」纪律）；零订阅时空集合快路径。
 *   单一挂点天然覆盖 ADR §6 三来源（本地受控写 / 复制 apply / schema 安装）——
 *   **无过滤全事务推导**（设计 §7-D8）：origin 只作分类字段（null → 'local'；
 *   per-session symbol 复制 apply → 'replication'），**绝不按 origin 过滤**（ADR §5
 *   宁多勿漏唯一不变量）。
 * - **B 建立状态机**（全同步、顺序冻结）：lifecycle 门 → listener 形状门 → schema
 *   可用门 → path 单次快照 → schema 分类 → 登记。全部参数校验在建立时刻完成；
 *   失败路径零订阅登记、零 observer 变更。
 * - **C 事务级推导**：handler 每次回调 = 单事务 → 每订阅至多聚合一条 data 通知；
 *   同事务同 key 按首见序去重（`Map<key>`）。
 * - **D 真变判定**（ADR §5 宁多勿漏的实现边界）：add/delete 恒真变；update 仅当
 *   新旧两侧均为 plain 数据时结构深比较（undefined 键过滤，与 doc-runtime
 *   `mutation.ts` 的 `logicalValuesEqual` 同款纪律——本处为该纪律在 watch 面的
 *   单点副本，两者语义漂移时须同步复查），相等才过滤；任一侧为 live Y 载体 /
 *   非 plain → 不可判 → 保守通知。
 * - **E 分发**：每订阅 FIFO 有界队列（容量 = 构造单参数位，默认 16 实现常量；
 *   数值不进公共契约——ADR §6；T4 #390 的 testing 工厂注入为纯加法）+ 单飞微任务泵
 *   （每项投递前让步 20 次微任务，镜像 `FANOUT_DELIVERY_DEFERRAL_MICROTASKS`）——
 *   listener 调用全部移出事务栈与写序列器槽（AC6）；逐 listener 逐投递 try/catch
 *   静默隔离（AC7）。溢出：清空在队 data 通知 → 入队单条 `invalidate-all`
 *   （origin = 触发本次降级的事务 origin；ADR §6 语义，T1 实现之、T4 #390 补注入与
 *   验收）。
 * - **零 throw 硬红线**：handler 整体 try/catch 吞没——observer 内 throw 会经
 *   `transactGuarded` 收编 DOCRT-E203 写 fatal（永久禁写），直接违反 AC7。
 *
 * 边界（T1 非目标）：谓词 `where` / `WATCH_MAP_OPTIONS_INVALID`（T2 #388）、
 * `watch-end` 终止编排与 `'replication'` 验收断言（T3 #389）、父路径删除编排（T4
 * #390）、文档面（T5 #391）。`changes` 定位符不带值（信号不含值——通知为深冻结纯
 * 数据，零 payload / 零载体引用 / 零投影文本）。
 *
 * 空路径边界（设计 §7-D3 显式承认）：map 形 ROOT 下 `watchMap([])` 合法（ROOT 本身
 * 即键容器），通知流产出 `{ path: [], key }` 定位符——`[...path, key]` 即根级条目路径。
 */
import type * as Y from 'yjs';
import { resolveSchemaAtPath } from '@nomicore/vfsl';
import type { ValueSchema } from '@nomicore/vfsl';
import {
  RuntimeReadDisabledError,
  WATCH_MAP_CARRIER_MISMATCH_CODE,
  WATCH_MAP_SCHEMA_UNAVAILABLE_CODE,
  WatchMapError,
} from './errors.js';
import { isPlainRecord } from './plain-data.js';
import type { RuntimeState } from './p0.js';
import { normalizeReadPath } from './read-schema-projection.js';

// ─────────────────────────────── 类型面（冻结形状，设计 §8-A） ───────────────────────────────

/** data 通知：恰三键 `{kind, origin, changes}`；`changes` 为定位符列表（不含值）。 */
export type NamespaceRuntimeWatchMapNotification =
  | {
      readonly kind: 'data';
      readonly origin: 'local' | 'replication';
      readonly changes: readonly NamespaceRuntimeWatchMapChange[];
    }
  | { readonly kind: 'invalidate-all'; readonly origin: 'local' | 'replication' }
  | { readonly kind: 'watch-end'; readonly reason: 'schema-changed' | 'doc-replaced' };

/** 变更条目定位符：恰两键 `{path, key}`；`[...path, key]` 直接拼下一轮读路径
 *  （与窗口读条目身份同构——ADR §4）。 */
export interface NamespaceRuntimeWatchMapChange {
  /** = 订阅容器路径（新鲜普通数组副本）。 */
  readonly path: readonly (string | number)[];
  /** 条目键；`[ ...path, key ]` 直接可读。 */
  readonly key: string;
}

/** 订阅句柄：恰一键 `unsubscribe`（幂等、零 throw、退订后零通知）。 */
export interface NamespaceRuntimeWatchMapHandle {
  unsubscribe(): void;
}

/** 订阅中枢（runtime.ts 构造期一次成型；包内模块面，不经 index 导出）。 */
export interface NamespaceRuntimeWatchHub {
  watchMap(
    path: readonly (string | number)[],
    listener: (notification: NamespaceRuntimeWatchMapNotification) => void,
  ): NamespaceRuntimeWatchMapHandle;
  /** Runtime close 同步段收口：摘 observer、清全部订阅（静默——ADR §4 终结三因
   *  不含 runtime close；lease force-release 已先行清理，此处为防御性收口）。 */
  shutdown(): void;
}

// ─────────────────────────────── 实现常量（数值不进公共契约） ───────────────────────────────

/** 每订阅投递队列容量上限（ADR §6「数值不进公共契约——语义进契约，数值是构造参数 +
 *  实现默认」；单参数位使 T4 #390 的 testing 工厂注入为纯加法）。 */
const WATCH_QUEUE_CAPACITY_DEFAULT = 16;

/** 每次投递前的微任务让步数（镜像 `replication-session.ts`
 *  `FANOUT_DELIVERY_DEFERRAL_MICROTASKS` 的 20 与同款泵形——公平性论证同源；
 *  让步只产生微任务计数，不产生墙钟等待）。 */
const WATCH_DELIVERY_DEFERRAL_MICROTASKS = 20;

/** plain 数据递归判定的深度上限（环/超深 → 不可判 → 保守通知方向）。 */
const PLAIN_DATA_MAX_DEPTH = 32;

/** 建立失败 message（设计 §8-B 文案表：非空、互相可区分、零 path/身份回显）。 */
const SCHEMA_UNAVAILABLE_MESSAGE =
  '无 active schema（legacy/preparing/unavailable/fatal 期）——watchMap 整体不可用' +
  '（机制由 schema 定义，ADR 0030 §3）；本调用零订阅建立';
const ARRAY_CARRIER_MESSAGE =
  'path 终点为数组载体（序列容器不属键容器订阅面；watchArray 属 v2）——本调用零订阅建立';
const SCHEMA_DEVIATION_MESSAGE =
  'path 偏离 active schema——建立判定全部由 active schema 完成（ADR 0030 §3）；本调用零订阅建立';
const NON_KEY_CONTAINER_MESSAGE =
  'path 终点为非键容器（标量/终态形态）——本调用零订阅建立';
const PATH_SHAPE_MESSAGE =
  'path 形状非法或敌意（段域 string|number）——本调用零订阅建立';
/** ROOT 同名异型载体（doc 数据级损坏态；写槽载体纪律下 ROOT 子树事务结构不可产生
 *  ——订阅通知面不可达，响亮拒绝而非静默建立死订阅）。 */
const ROOT_CARRIER_MESSAGE =
  'ROOT 载体非键容器（非 Y.Map，本 Runtime 无键容器事务面）——本调用零订阅建立';

// ─────────────────────────────── 内部状态 ───────────────────────────────

interface WatchSubscription {
  /** 订阅容器路径（冻结快照——建立时刻单次拷贝，此后只读）。 */
  readonly containerPath: readonly (string | number)[];
  readonly listener: (notification: NamespaceRuntimeWatchMapNotification) => void;
  /** FIFO 有界队列（只在事务观察器内入队、只在泵内出队——单线程无交错）。 */
  readonly queue: NamespaceRuntimeWatchMapNotification[];
  /** 泵单飞守卫（任一时刻每订阅至多一个泵 continuation 挂起）。 */
  pumpScheduled: boolean;
  /** 退订标志（幂等守卫 + 泵在下一让步点的退出判据 + handler 跳过判据）。 */
  unsubscribed: boolean;
}

// ─────────────────────────────── 建立判定（设计 §8-B） ───────────────────────────────

/**
 * 载体 kind 追尽：`{kind:'ref'}` 经别名闭包查表、`{kind:'optional'}` 透明解包
 * （`?:` 字段包装——`ghost?: Record<string, Task>` 的「数据缺席合法」正例依赖此步）；
 * 其余 kind 原样返回（union 属 D3 已知限制：按非键容器拒绝，R4）。
 * ref 目标缺席或成环 → `'unknown'`（不可判 → 按非键容器拒绝，fail-closed；T1
 * fixture 无环，属防御面）。
 */
function resolveCarrierKind(
  valueSchema: ValueSchema,
  aliases: Readonly<Record<string, ValueSchema>>,
): ValueSchema['kind'] | 'unknown' {
  let current: ValueSchema = valueSchema;
  const visited = new Set<string>();
  for (;;) {
    if (current.kind === 'ref') {
      if (visited.has(current.name)) return 'unknown'; // ref 环
      visited.add(current.name);
      const target: ValueSchema | undefined = aliases[current.name];
      if (target === undefined) return 'unknown'; // 闭包缺席（结构上不可达）
      current = target;
      continue;
    }
    if (current.kind === 'optional') {
      current = current.value; // 可选包装透明（非容器判定落在被包装的值语义上）
      continue;
    }
    return current.kind;
  }
}

// ─────────────────────────────── 真变判定（设计 §8-D） ───────────────────────────────

/** plain 数据判据：标量（string/number/boolean/undefined/null/bigint）或递归 plain 的
 *  object/array；live Y 载体（原型链非 Object.prototype）、类实例、function/symbol、
 *  超深/环 → 非 plain（→ 不可判 → 保守通知）。 */
function isPlainData(value: unknown, depth = 0): boolean {
  if (value === null) return true;
  const kind = typeof value;
  if (
    kind === 'string'
    || kind === 'number'
    || kind === 'boolean'
    || kind === 'undefined'
    || kind === 'bigint'
  ) {
    return true;
  }
  if (kind !== 'object') return false; // function / symbol
  if (depth >= PLAIN_DATA_MAX_DEPTH) return false; // 超深/环 → 不可判
  if (Array.isArray(value)) {
    return value.every((item) => isPlainData(item, depth + 1));
  }
  if (!isPlainRecord(value as object)) return false; // 含 live Y 载体（prototype 链判据）
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => isPlainData(record[key], depth + 1));
}

/** 结构深比较（undefined 键过滤——与 doc-runtime `mutation.ts` `logicalValuesEqual`
 *  同款纪律；调用方已保证两侧均 plain）。深度耗尽 → false（→ 判为真变 → 保守通知）。 */
function plainDataEquals(a: unknown, b: unknown, depth = 0): boolean {
  if (depth >= PLAIN_DATA_MAX_DEPTH) return false;
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return a.length === b.length && a.every((item, index) => plainDataEquals(item, b[index], depth + 1));
  }
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined);
  const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined);
  return (
    leftKeys.length === rightKeys.length
    && leftKeys.every(
      (key) => right[key] !== undefined && plainDataEquals(left[key], right[key], depth + 1),
    )
  );
}

/** 单键真变判定：add/delete 恒真变；update 两侧均 plain → 深比较，相等则过滤；
 *  任一侧为 live Y 载体 / 非 plain → 不可判 → 保守通知（ADR §5 原文授权）。 */
function isRealChange(
  target: Y.Map<unknown>,
  key: string,
  info: { readonly action: 'add' | 'update' | 'delete'; readonly oldValue: unknown },
): boolean {
  if (info.action !== 'update') return true;
  const previous = info.oldValue;
  const next: unknown = target.get(key); // observer 期事务已提交，读安全
  if (previous === next) return false; // 同值/同引用：无变化
  if (!isPlainData(previous) || !isPlainData(next)) return true; // 不可判 → 保守通知
  return !plainDataEquals(previous, next);
}

// ─────────────────────────────── 事务推导（设计 §8-C） ───────────────────────────────

/** `containerPath` 是否为 `eventPath` 的前缀（逐段严格相等）。 */
function isPathPrefix(
  containerPath: readonly (string | number)[],
  eventPath: readonly (string | number)[],
): boolean {
  if (eventPath.length < containerPath.length) return false;
  for (let i = 0; i < containerPath.length; i += 1) {
    if (eventPath[i] !== containerPath[i]) return false;
  }
  return true;
}

/** 嵌套事件（C-2）的条目级聚合：任一变更键真变或不可判 → 该条目产出定位符。
 *  `changes.keys` 为空 = 目标为序列/非键容器载体（delta 无键级 oldValue，不可判）
 *  → 保守通知（ADR §5 宁多勿漏）。 */
function isNestedEntryChanged(event: Y.YEvent<Y.Map<unknown>>): boolean {
  const keys = event.changes.keys;
  if (keys.size === 0) return true; // 非键容器载体内部变更 → 不可判 → 保守通知
  for (const [key, info] of keys) {
    if (isRealChange(event.target, key, info)) return true;
  }
  return false;
}

/** 单事务 → 单订阅的定位符列表（首见序去重）；无命中 → 空列表（不发通知）。 */
function collectChanges(
  events: ReadonlyArray<Y.YEvent<Y.Map<unknown>>>,
  containerPath: readonly (string | number)[],
): NamespaceRuntimeWatchMapChange[] {
  const byKey = new Map<string, NamespaceRuntimeWatchMapChange>();
  const depth = containerPath.length;
  for (const event of events) {
    const eventPath: ReadonlyArray<string | number> = event.path; // 观察型（ROOT）→ 变更型路径
    if (!isPathPrefix(containerPath, eventPath)) continue; // C-4 无关
    if (eventPath.length === depth) {
      // C-1 容器本体：逐键真变判定
      for (const [key, info] of event.changes.keys) {
        if (isRealChange(event.target, key, info)) {
          byKey.set(key, makeChange(containerPath, key));
        }
      }
      continue;
    }
    // C-2 容器内嵌套：条目 key = event.path[containerPath.length]（键容器条目键恒 string）
    const entryKey: string | number | undefined = eventPath[depth];
    if (typeof entryKey !== 'string') continue; // 结构上不可达（防御：非键段不外泄）
    if (isNestedEntryChanged(event)) {
      byKey.set(entryKey, makeChange(containerPath, entryKey));
    }
    // C-3 容器级事件（父路径 + 本条键 = 容器创建/删除/整替）→ T1 不产出条目定位符
    //（父路径删除编排属 T4 #390）——落入「无命中」分支。
  }
  return [...byKey.values()];
}

/** 定位符构造：path 为订阅容器路径的新鲜普通数组副本（N3 的 `toStrictEqual`
 *  与窗口读条目同构由此成立）；变更对象深冻结（信号纯数据、不含值）。 */
function makeChange(
  containerPath: readonly (string | number)[],
  key: string,
): NamespaceRuntimeWatchMapChange {
  return Object.freeze({ path: Object.freeze([...containerPath]), key });
}

/** origin 分类（ADR §4 两态；设计 §7-D8 无过滤）：本地图写 `doc.transact(body)` 无
 *  origin → `null` → 'local'；复制 apply（per-session symbol，`Y.applyUpdate` 第三参）
 *  → 'replication'。**不按 origin 过滤任何来源**——对启用复制的活命名空间过滤即
 *  蓄意漏通知，违反 ADR §5 唯一不变量。 */
function classifyOrigin(origin: unknown): 'local' | 'replication' {
  if (origin == null) return 'local'; // null / undefined（本地图写）
  return typeof origin === 'symbol' ? 'replication' : 'local';
}

// ─────────────────────────────── 分发（设计 §8-E） ───────────────────────────────

/**
 * 单飞微任务泵（镜像 `createSessionFanout.schedulePump`）：自延伸链 + 每项投递前
 * 让步 20 次微任务；listener 调用全部移出事务栈与写序列器槽；逐 listener 逐投递
 * try/catch 静默隔离（X1——通知失败不是业务失败）；退订/关停后下一让步点退出。
 * 投递集 = 当前订阅 listener（订阅级快照在退订标志后不再可达）。
 */
function schedulePump(subscription: WatchSubscription): void {
  if (subscription.pumpScheduled) return;
  subscription.pumpScheduled = true;
  void (async () => {
    try {
      while (subscription.queue.length > 0 && !subscription.unsubscribed) {
        for (let i = 0; i < WATCH_DELIVERY_DEFERRAL_MICROTASKS; i += 1) await Promise.resolve();
        if (subscription.unsubscribed || subscription.queue.length === 0) return; // 让步后重检
        const item = subscription.queue.shift();
        if (item === undefined) return;
        try {
          subscription.listener(item);
        } catch {
          // X1 静默隔离：回调 throw 不影响写结果、sequencer 行为与其他订阅
        }
      }
    } catch {
      // 最外层兜底：listener 已逐个隔离、shift() 结构性不可抛，未来任何编辑引入的
      // 非 listener 抛点收敛于此（泵零 unhandled rejection）
    } finally {
      subscription.pumpScheduled = false; // 与 while 退出检查同一同步段 ⇒ 无丢失唤醒
    }
  })();
}

/**
 * ROOT 载体捕获（构造期，容错）：正常文档返回 live `Y.Map`；**同名异型载体**
 * （ROOT 已是 Y.Text 等——`doc.getMap` 抛「已用不同构造器定义」）捕获为缺席。
 *
 * 依据（frozen 契约，非本设计可改）：`runtime-p0-sequencer.test.ts` AC5「P0 不读取或
 * 验证 ROOT——ROOT 载体非 Y.Map（Y.Text）仍照常 ready」要求 Runtime 构造在任意 ROOT
 * 载体下照常成功、P0 照常 ready。此类文档上 ROOT 子树事务结构上不可产生（写槽载体
 * 纪律拒绝），通知面不可达 → 订阅建立响亮拒绝（`watchMap` 第 ③b 门），绝不静默建立
 * 一个永不投递的订阅。`getMap` 抛错路径零副作用（不创建、不替换既有载体）。
 */
function captureRootMap(doc: Y.Doc): Y.Map<unknown> | undefined {
  try {
    return doc.getMap('ROOT');
  } catch {
    return undefined;
  }
}

/**
 * 创建订阅中枢：构造期挂接 ROOT `observeDeep`（每 Runtime 恰一次）；
 * `queueCapacity` 为唯一构造参数位（缺省 16 实现常量——T4 #390 注入纯加法）。
 */
export function createWatchHub(
  doc: Y.Doc,
  state: RuntimeState,
  queueCapacity: number = WATCH_QUEUE_CAPACITY_DEFAULT,
): NamespaceRuntimeWatchHub {
  const subscriptions = new Set<WatchSubscription>();
  let shutdownDone = false;
  const root = captureRootMap(doc); // 构造期捕获（异型载体 → undefined，构造不抛）

  /** 事务观察器（每事务恰一次回调；**只入队不投递**）。整体 try/catch 吞没——
   *  零 throw 硬红线（throw 会经 transactGuarded 收编 DOCRT-E203 写 fatal）。 */
  const onRootTransaction = (
    events: ReadonlyArray<Y.YEvent<Y.Map<unknown>>>,
    transaction: Y.Transaction,
  ): void => {
    try {
      if (subscriptions.size === 0) return; // 零订阅快路径
      const origin = classifyOrigin(transaction.origin);
      for (const subscription of subscriptions) {
        if (subscription.unsubscribed) continue;
        const changes = collectChanges(events, subscription.containerPath);
        if (changes.length === 0) continue;
        enqueueData(subscription, origin, changes);
      }
    } catch {
      // handler 整体吞没（R1 红线）：任何内部异常不得升级为写 fatal、不得改变写结果
    }
  };
  // 构造期挂接（每 Runtime 恰一次；零订阅快路径在 handler 内）；异型载体 → 不挂接，
  // 订阅建立于第 ③b 门响亮拒绝（见 captureRootMap 注）。
  if (root !== undefined) root.observeDeep(onRootTransaction);

  /** 入队（溢出 → 清队 + 单条 invalidate-all；订阅存活——ADR §6 语义）。 */
  function enqueueData(
    subscription: WatchSubscription,
    origin: 'local' | 'replication',
    changes: readonly NamespaceRuntimeWatchMapChange[],
  ): void {
    if (subscription.unsubscribed) return;
    if (subscription.queue.length >= queueCapacity) {
      subscription.queue.length = 0; // 清空在队 data 通知
      subscription.queue.push(Object.freeze({ kind: 'invalidate-all', origin }));
    } else {
      subscription.queue.push(
        Object.freeze({ kind: 'data', origin, changes: Object.freeze([...changes]) }),
      );
    }
    schedulePump(subscription);
  }

  return {
    watchMap(path, listener) {
      // ① lifecycle 门（runtime 侧；停接纳期零订阅建立、零 doc 触碰）
      const lifecycle = state.lifecycle;
      if (lifecycle !== 'ready') {
        throw new RuntimeReadDisabledError('watchMap', lifecycle);
      }
      // ② listener 形状门（沿 subscribeOwnedUpdates 形状门禁先例）
      if (typeof listener !== 'function') {
        throw new TypeError('watchMap: listener 必须是函数（订阅回调——ADR 0030 §6）');
      }
      // ③ schema 可用门（B-4：无 active schema 整体拒绝，含无谓词形态）
      if (state.schemaState !== 'ready' || state.activeTools === undefined) {
        throw new WatchMapError(WATCH_MAP_SCHEMA_UNAVAILABLE_CODE, SCHEMA_UNAVAILABLE_MESSAGE);
      }
      // ③b ROOT 载体门（构造期捕获缺席 = ROOT 同名异型载体）：通知面结构不可达 →
      // 响亮拒绝，绝不静默建立一个永不投递的订阅（本调用零订阅建立）
      if (root === undefined) {
        throw new WatchMapError(WATCH_MAP_CARRIER_MISMATCH_CODE, ROOT_CARRIER_MESSAGE);
      }
      // ④ path 单次快照（敌意 path 收敛 null——与读面同一纪律）
      const snapshot = normalizeReadPath(path);
      if (snapshot === null) {
        throw new WatchMapError(WATCH_MAP_CARRIER_MISMATCH_CODE, PATH_SHAPE_MESSAGE);
      }
      // ⑤ schema 分类（纯 active schema 侧：零 live 载体探测——数据缺席合法）
      const resolved = resolveSchemaAtPath(state.activeTools.derived, snapshot);
      if (!resolved.ok) {
        throw new WatchMapError(
          WATCH_MAP_CARRIER_MISMATCH_CODE,
          resolved.code === 'SCHEMA_PATH_NOT_FOUND' ? SCHEMA_DEVIATION_MESSAGE : PATH_SHAPE_MESSAGE,
        );
      }
      const kind = resolveCarrierKind(resolved.valueSchema, resolved.aliases);
      if (kind !== 'object') {
        throw new WatchMapError(
          WATCH_MAP_CARRIER_MISMATCH_CODE,
          kind === 'array' ? ARRAY_CARRIER_MESSAGE : NON_KEY_CONTAINER_MESSAGE,
        );
      }
      // ⑥ 登记（校验全前置——失败路径零登记；成功路径返回幂等包装句柄）
      const containerPath: readonly (string | number)[] = Object.freeze([...snapshot]);
      const subscription: WatchSubscription = {
        containerPath,
        listener,
        queue: [],
        pumpScheduled: false,
        unsubscribed: false,
      };
      subscriptions.add(subscription);
      let unsubscribed = false;
      const handle: NamespaceRuntimeWatchMapHandle = {
        unsubscribe: (): void => {
          if (unsubscribed) return; // 幂等：重复退订零 throw、零副作用
          unsubscribed = true;
          subscription.unsubscribed = true;
          subscription.queue.length = 0; // 在途投递于下一让步点停止（L1）
          subscriptions.delete(subscription);
        },
      };
      return Object.freeze(handle);
    },
    shutdown() {
      if (shutdownDone) return; // 幂等（close 同步段防御性收口）
      shutdownDone = true;
      if (root !== undefined) root.unobserveDeep(onRootTransaction);
      for (const subscription of subscriptions) {
        subscription.unsubscribed = true;
        subscription.queue.length = 0;
      }
      subscriptions.clear();
    },
  };
}
