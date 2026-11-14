import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-timer'
import { requireClock } from '@nomicore/clock'
import { provideNomicorePersistence, type DocPersistence, type PersistenceScheduler } from './contract.js'

/**
 * Cordis wiring leaf for the persistence adapters (module-graph DAG: this
 * module imports `context`-level dependencies only; `lifecycle.ts` never
 * imports it).
 *
 * ⚠️ 宿主接线契约（R1/#15）——timer fiber 生命周期必须 ⊇ persistence adapter
 * 生命周期：宿主必须**先装 timer、后停 persistence**（本任务 DSH profile 的
 * clock → timer → persistence 装配序与 adapter → fiber dispose 序即满足）。
 * 若宿主先拆 timer fiber 再使用 persistence adapter，`scheduleRetry` →
 * `rootTimer.timeout` 会在 native 回调续体里抛 INACTIVE_EFFECT（uncaught）——该顺序
 * 是宿主接线契约，不在 persistence 内部防御（adapter `closed` 标志只覆盖自身
 * dispose 路径）。
 */

/**
 * 插件启动强依赖断言（AC2）：在 provide service **之前**同步执行；缺失任一
 * 依赖即 loud throw（不 fallback、不 console.error 后继续）。检验经
 * `ctx.get(name)` 安全探针（cordis 已核实：缺失返回 `undefined`、从不
 * throw），文案稳定、单句、含 service 名与安装指引。
 */
export function assertPersistenceHostDependencies(ctx: Context): void {
  requireClock(ctx) // 缺失 → throw 'required Cordis service "clock" is unavailable'（@nomicore/clock 现有文案）
  const timer = ctx.get('timer') as { timeout?: unknown } | undefined
  if (timer === undefined || typeof timer.timeout !== 'function') {
    throw new Error(
      'required Cordis service "timer" is unavailable: '
      + 'install @deepseek-ai/cordis-plugin-timer before the persistence plugin',
    )
  }
}

/**
 * Cordis Root timer 通道解析（ADR 0035 §2）。包内私有：本模块已是 Host 接线的
 * 唯一叶子，且不经 `src/index.ts` 再导出——不新增文件、不新增公共 export（AC7）。
 *
 * 形态 = `Symbol.for('cordis.root')` 优先、legacy `root` 实例属性兜底。存在但形状
 * 不符的候选**绝不**回落（不尝试另一通道、不尝试另一 host），而是**立即同步**以稳
 * 定单句失败；读取本身被拒绝（Proxy 拒绝）归一为「该通道缺席」——消费者无从得知被
 * 拒读取背后是否有值，归一后只按既有推进链前进（C-R4a–d）。
 */
const CORDIS_ROOT_SYMBOL = Symbol.for('cordis.root')
const ROOT_TIMER_UNAVAILABLE =
  'required Cordis root timer context is unavailable: the host root context must expose a callable timeout via '
  + "Symbol.for('cordis.root') or the legacy root property"

/** 调度所需的最小能力面：只要求 `timeout` 可调用，不探测其它 timer 能力。 */
interface RootTimerSource {
  timeout(callback: () => void, delayMs: number): () => void
}

function throwRootTimerUnavailable(): never {
  throw new Error(ROOT_TIMER_UNAVAILABLE)
}

/**
 * C-R4a：try/catch 只包单次 `Reflect.get`。形状断言、通道级联与最终 throw 全部在
 * catch 之外——malformed 通道不会被归一成「缺席」，proxy 噪声也不会泄漏给调用方。
 */
function safeReadChannel(host: object, key: PropertyKey): unknown {
  try {
    return Reflect.get(host, key)
  } catch {
    return undefined
  }
}

function assertRootTimerShape(candidate: unknown): RootTimerSource {
  if (typeof (candidate as RootTimerSource | null | undefined)?.timeout !== 'function') {
    throwRootTimerUnavailable()
  }
  return candidate as RootTimerSource
}

function tryResolveRootTimer(host: unknown): RootTimerSource | undefined {
  // F5：宿主非对象属于 malformed（不是「缺席」）——立即稳定 throw，
  // 既不产生 `Reflect.get(null, …)` 的 TypeError 噪声，也不落入级联。
  if (host === null || typeof host !== 'object') throwRootTimerUnavailable()
  // symbol 优先：symbol 存在（读取成功且非 nullish）时绝不读 legacy。
  const symbolRoot = safeReadChannel(host, CORDIS_ROOT_SYMBOL)
  if (symbolRoot !== undefined && symbolRoot !== null) return assertRootTimerShape(symbolRoot)
  const legacyRoot = safeReadChannel(host, 'root')
  if (legacyRoot !== undefined && legacyRoot !== null) return assertRootTimerShape(legacyRoot)
  return undefined
}

/**
 * 派生 plugin 路径的唯一 PersistenceScheduler 来源（AC3）：内部先执行
 * `assertPersistenceHostDependencies`（订单保证：断言失败时任何 service
 * 都未提供），再在 **apply 期一次性**解析并校验 Root timer 通道（缺席/形状不符/
 * 宿主非对象 → 同步稳定单句 throw，而不是延迟到首次 saveDoc 的 TypeError 噪声）。
 *
 * 解析结果被捕获为 rootTimer **对象引用**，此后每次调度以
 * `rootTimer.timeout(callback, delayMs)` **方法调用形态**武装：TimerService.timeout
 * 的实现体首行即 `this.ctx.effect(...)`。
 *   ✅ rootTimer.timeout(callback, delayMs)
 *   ❌ const timeout = rootTimer.timeout; timeout(...)   —— detach 后 `this === undefined`，
 *      首个 arm 即 TypeError，正是本 seam 要消灭的「延迟到首次调度才炸」故障形态。
 * 该 disposer 是幂等的（timer 触发时先 `dispose()` 再 `callback()`），故 disposer 即
 * handle：`clearTimeout(handle) === handle()`。
 */
export function createCordisPersistenceScheduler(ctx: Context): PersistenceScheduler {
  assertPersistenceHostDependencies(ctx)
  const rootTimer = tryResolveRootTimer(ctx) ?? throwRootTimerUnavailable()
  return {
    // Persistence 的调度器属于 adapter 资源，而不是单次调用 saveDoc 时的当前 fiber。
    // root Context 的生命周期覆盖完整 Host，可让卸载排空期间的 dirty notification 继续
    // 武装 flush timer；adapter.dispose() 会在依赖方 settle 后显式清理这些 timer。
    setTimeout: (callback, delayMs) => rootTimer.timeout(callback, delayMs),
    clearTimeout: (handle) => { (handle as () => void)() },
  }
}

/**
 * 绑定 persistence adapter 的 Cordis 生命周期（rev1 问题 3，ADR-0006 :86 宿主逆序
 * 停止职责 + ADR-0009 :103 Plugin dispose 有序 disposer）：service 撤销与 adapter
 * dispose 纳入同一个**有序** effect——
 *
 *   卸载序（effect 本地 disposables 逆序串行执行）：
 *     drainStep（先执行）：await revoke() —— 撤服务（调用路径，设计 §5#5①：revoke 的
 *                          类型签名是 `() => void`（provideNomicorePersistence 的返回
 *                          类型），运行时实为 cordis effect wrapper——先调用、后 await
 *                          其返回值：wrapper 调用体在未启动态 finalizeDisposal 启动处置
 *                          任务并返回 inFlight promise，await 等的是该返回值（全程
 *                          等待）；「delete store → notify → await 全部依赖 fiber
 *                          卸载完成」是该处置任务**自身的执行内容**，不是 await
 *                          revoke() 直接执行的次序；且完整 join 语义只在 runDisposable
 *                          路径（§5#5，effectInertia 恒返 inFlight）——join 完整性由
 *                          yield re-parent + 串行链保证，不依赖裸 await 的 join）；
 *                          finally 兜底 await adapter.dispose()（撤销链异常也不漏资源
 *                          释放）；
 *     revoke（后执行）  ：runDisposable 经 effectInertia join 到同一处置任务（no-op）。
 *
 * 由此 adapter dispose（文件句柄/后台任务/Y.Doc 缓存释放）严格晚于
 * nomicorePersistence 全部依赖方（如 NamespaceRegistry plugin：其 shutdown 排空
 * 期间的 handle.release / saveDoc 的 entry 断言全程面对未 disposed 的 adapter
 * ——「close 撞已销毁 handle」聚合失败被消灭）——AC11「先于 Persistence dispose」
 * 从 fiber 级提升为 adapter 级真实保证。
 *
 * 调度生命周期：生产 scheduler 通过 apply 期解析出的 root timer 通道武装 timer，使 adapter fiber
 * 进入 UNLOADING 后、依赖 Registry 排空此前接纳写的窗口内，`saveDoc` 仍能完成 dirty
 * 登记。adapter.dispose() 在依赖方 settle 后清理全部 timer，因此不会把调度资源泄漏到
 * adapter 生命周期之外。真实 TimerService 集成回归见 Registry R5P 测试。
 *
 * 直接调用 adapter.dispose() 的宿主编排（不经 fiber 卸载）不受影响：dispose 语义
 * 与幂等性零变化（宿主职责，ADR-0006 :86）。
 */
export function bindPersistenceAdapterLifecycle(
  ctx: Context,
  adapter: DocPersistence & { dispose(): Promise<void> },
  label: string,
): void {
  ctx.effect(function* () {
    // yield 收集序 [revoke, drainStep] → 逆序执行 [drainStep, revoke]。
    // yield revoke 同时把嵌套 provide wrapper 从 fiber 级并发清单 re-parent 进本
    // 有序表——否则它与 drainStep 在 fiber _unload 的 Promise.all 中并发（round 1
    // 缺陷根源，§5#1/#6）。
    const revoke = provideNomicorePersistence(ctx, adapter)
    yield revoke
    yield async () => {
      try {
        await revoke() // 撤服务 → 级联依赖 fiber 卸载并 settle
        // （await revoke() = 先调用后 await 返回值：直接调用体在未启动态
        //  finalizeDisposal 启动 disposal 并返回 inFlight——await 等的是该返回值，
        //  全程等待；归因区分见设计 §5#5）
      } finally {
        await adapter.dispose() // 依赖方 settle 后才释放 adapter 资源；revoke 异常亦不漏
      }
    }
  }, label)
}
