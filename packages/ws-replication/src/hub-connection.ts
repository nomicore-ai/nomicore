/**
 * hub-connection —— `createHubReplication`：accept/HELLO 门 + 服务面 + **单体 listen 的
 * 进程内组合根**（ADR 0032 决策 1；设计 §7 D7）。
 *
 * issue #418：连接级半边 = `createHubReplicationEdge`（hub-edge.ts），namespace 级半边 =
 * `createHubSessionHost`（hub-session.ts）——本模块按认证门序分配 edge，并由 edge 在构造期
 * 以 `sessionFactory` 装配 session（缝 = 函数调用，协议状态机单份）。服务面（accept/
 * acceptTrusted/revoke/requestReauth/close/dropConnection）与校验链原样保留。
 *
 * OPEN 时序（设计 §7 D5/D7）：edge 在首个 OPEN **到达点**建 admission 台账并立即投递
 * session（同步建通道 + `startOpen` = HEAD 时序），通道内的 authorize shim 经
 * `port.openAdmission` **异步拉取** edge 侧唯一真实 authorize 的结算结局——本模块只负责
 * 组合（注入 authorize 与 Registry），不感知该机制。
 */
import type { DuplexTransport, HubUpgradeRequest, UpgradeIdentity } from './types.js';
import { dispatchReplicationObserver } from './observer.js';
import { createHubReplicationEdge, type HubReplicationEdge } from './hub-edge.js';
import { createHubSessionHost } from './hub-session.js';
import type { NamespaceRegistry } from '@nomicore/namespace-registry';
import type {
  HubConnection,
  HubReplication,
  HubReplicationOptions,
  NamespaceAuthorizer,
  ReplicationClock,
  ReplicationObserver,
  ResolvedLimits,
  ResolvedTimeouts,
} from './types.js';
import type { ReplicationTimer } from './types.js';
import { resolveLimits, resolveTimeouts } from './defaults.js';
import {
  isValidInstanceId,
  validateHubOptions,
  validateInstanceId,
  validateLimits,
  validateTimeouts,
  validateChunkedBootstrapChain,
  validateChunkedSyncDiffChain,
  validateChunkedTransferChain,
} from './validate.js';

/**
 * 早到帧缓冲的条数界（模块常数，非配置 knob——HELLO 是唯一合法早到帧，守规矩的
 * peer 恰发 1 帧，16 为充裕余量；累计字节由「单帧界 limits.maxFrameBytes × 条数界」
 * 导出：≤ 16×maxFrameBytes）。
 *
 * 权威指向（#172 双标注）：帧限拒绝对外语义（条数越界 → WS 1008 / 单帧超界 →
 * WS 1009，close reason 恒 'upgrade-frame-limit'）以 docs/protocols/
 * instance-replication-v1.md 为唯一 wire contract（§14 WS close code 分类）。
 * 历史证据（立法沿革）：phase5 issue #138 设计 §3.2 R2 A2（早到帧有界化）+
 * R3 N1（同步重放型 transport 句柄安全）——wiki/raw 非规范，仅沿革记录。
 */
const MAX_EARLY_FRAMES = 16;

/**
 * issue #190：两 upgrade 入口（accept 门 3 / acceptTrusted 门 2）共享的有界早到帧
 * admission 单点。
 *
 * 权威指向（#172 双标注）：帧限拒绝对外语义（1009/1008 close-code 分类 +
 * auth-upgrade-rejected reason 闭集 frame-too-large/early-frame-limit）以
 * docs/protocols/instance-replication-v1.md 为唯一权威（§14 wire close-code 分类；
 * §23 observer reason 闭集——local seam）。历史证据（立法沿革）：phase5 issue #138
 * 设计 §3.2 R2 A2（早到帧有界化）+ R3 N1（同步重放型 transport 句柄安全）——
 * wiki/raw 非规范，仅沿革记录。
 *
 * 纪律（帧到达同步段、push 之前执行）：
 * - 幂等拒绝早退：拒绝后重放循环内后续帧直接 return（零保留零重放）；
 * - 单帧界：bytes.byteLength > limits.maxFrameBytes → 拒绝（§14 → 1009）；
 * - 条数界：frames.length >= MAX_EARLY_FRAMES（第 17 帧）→ 拒绝（policy → 1008）；
 * - 拒绝效果 = 置标志 + close(…, 'upgrade-frame-limit') + emit 帧限 reason（经注入回调）；
 * - 摘监听统一延后到注册完成后的同步收口段（R3 N1：no-op 句柄使 detach 任意时刻安全）。
 *
 * 资源账：保留上界 = MAX_EARLY_FRAMES × maxFrameBytes + 常数数组开销。
 */
interface EarlyFrameAdmission {
  /** 有界缓冲（≤16 帧，每帧 ≤ maxFrameBytes）——分配时随连接注入构造尾重放。 */
  readonly frames: Uint8Array[];
  /** admission 拒绝已发生（帧限或外部 markRejected）——迟归/后续帧不复活。 */
  isRejected(): boolean;
  /** 外部标记拒绝（accept() auth timer 超时路径专用；无副作用——close/emit 由调用方路径自理）。 */
  markRejected(): void;
  /** 接纳窗口内对端已断（onClose 观察）。 */
  isEarlyClosed(): boolean;
  /** 幂等摘除两监听（重放期内调用 = 无害 no-op，R3 N1）。 */
  detach(): void;
}

function installEarlyFrameAdmission(
  transport: DuplexTransport,
  limits: ResolvedLimits,
  emitFrameLimitRejected: (reason: 'frame-too-large' | 'early-frame-limit') => void,
): EarlyFrameAdmission {
  const frames: Uint8Array[] = [];
  const state = { rejected: false, earlyClosed: false };
  // R3 N1（一行级，原样保留）：off 句柄 no-op 初始化——同步重放型 transport
  // （TcpTransport 实存形态：onMessage 注册即同步重放积压、重放先于 return/句柄赋值，
  // sa7-r2-transport:132-144）上，积压帧可在赋值语句完成前触发本 listener 的拒绝路径；
  // no-op 句柄使 detach 在【任意时刻】安全（重放期内调用 = 无害 no-op），注册完成后
  // 重赋真句柄。拒绝的【效果】（置标志 + close）在重放期内照常生效；【摘监听】统一
  // 延后到注册完成后的同步段收口——不再从 transport.onMessage(...) 调用点同步抛
  // TypeError（那会使 async accept 的 promise reject，违反 §8.2 硬不变量，且异常展开
  // 会流产重放循环——pendingFrames 已 splice、余帧丢失、transport 未按设计关闭）。
  let offMessage: () => void = () => {};
  let offClose: () => void = () => {};
  const detach = (): void => { offMessage(); offClose(); }; // 幂等（重复摘除零副作用）
  offMessage = transport.onMessage((bytes) => {
    if (state.rejected) return; // 已拒（重放循环内后续帧）——幂等早退
    if (bytes.byteLength > limits.maxFrameBytes) {
      // 单帧界：复用既有 limit（ADR 0010「最大 WS frame」）；§14 语义 → 1009
      state.rejected = true;
      closeAdmission(transport, 1009, 'upgrade-frame-limit'); // §3.4 守卫版 close
      emitFrameLimitRejected('frame-too-large');
      return;
    }
    if (frames.length >= MAX_EARLY_FRAMES) {
      // 条数界：第 17 帧即拒（policy）→ 1008
      state.rejected = true;
      closeAdmission(transport, 1008, 'upgrade-frame-limit');
      emitFrameLimitRejected('early-frame-limit');
      return;
    }
    frames.push(bytes); // 唯一保留点——三检全过才保留
  });
  offClose = transport.onClose(() => { state.earlyClosed = true; });
  return {
    frames,
    isRejected: () => state.rejected,
    markRejected: () => { state.rejected = true; },
    isEarlyClosed: () => state.earlyClosed,
    detach,
  };
}

/**
 * 拒绝路径 close 守卫（#190 唯一超越「原样收敛」的强化）：admission 拒绝时 transport
 * 契约外形态（close 抛出）不得经 onMessage(...) 调用点展开——那会流产同步重放循环
 * 且 reject 调用方 promise（acceptTrusted 唯一生产 caller 为 fire-and-forget，
 * apps/yjs-server/src/app.ts:274 → unhandledRejection 进程级风险）。守卫吞异常后
 * 拒绝效果已生效（标志已置、事件仍发），残局归 transport 所有者；与
 * apps/yjs-server/src/index.ts:364-368 safeCloseTransport「吞二次异常」同款纪律。
 * 契约内 transport（close 不抛，全部现存 fixture/生产 adapter）行为零变化。
 */
function closeAdmission(transport: DuplexTransport, code: number, reason: string): void {
  try {
    transport.close(code, reason);
  } catch {
    // transport 契约外形态（close 抛出）：拒绝效果已生效（标志已置、事件仍发）——
    // 残局归 transport 所有者；与 index.ts safeCloseTransport「吞二次异常」同款纪律。
  }
}

export function createHubReplication(options: HubReplicationOptions): HubReplication {
  return new HubReplicationImpl(options);
}

/** Hub 内部共享面（连接实例访问）。 */
interface HubInternals {
  readonly instanceId: string;
  readonly registry: NamespaceRegistry;
  readonly authorize: NamespaceAuthorizer;
  readonly timer: ReplicationTimer;
  readonly limits: ResolvedLimits;
  readonly timeouts: ResolvedTimeouts;
  readonly observer: ReplicationObserver | undefined;
  readonly clock: ReplicationClock | undefined;
  dropConnection(connection: HubReplicationEdge): void;
}

class HubReplicationImpl implements HubReplication {
  private readonly limits: ResolvedLimits;
  private readonly timeouts: ResolvedTimeouts;
  private readonly connectionList: HubReplicationEdge[] = [];
  private closed = false;
  private connectionCounter = 0;
  private closeTail: Promise<void> = Promise.resolve();
  private readonly internals: HubInternals;

  constructor(private readonly options: HubReplicationOptions) {
    validateHubOptions(options);
    const limits = resolveLimits(options.limits);
    const timeouts = resolveTimeouts(options.timeouts);
    validateLimits(limits);
    validateTimeouts(timeouts);
    // issue #244（D1，SA4-2 收口）：跨字段响亮链——仅当调用方显式表达任一「分块族链上
    // 键」（maxChunkedUpdateBytes ∨ maxChunksPerUpdate，两链不等式的操作数键）时对合并
    // 结果校验两链（R1a/N1 + R1c 转绿判据——{maxChunksPerUpdate: 4} + 缺省 envelope 亦
    // 激活：链② 4MiB > 4×512KiB=2MiB；缺省值自洽由 DEFAULT 构造成立：4MiB ≤ 4MiB ∧
    // 4MiB ≤ 64×512KiB=32MiB；仅显式既有键不激活 = 非追溯性，N5/N6 锁定，见 validate.ts）。
    if (
      options.limits != null &&
      (Object.prototype.hasOwnProperty.call(options.limits, 'maxChunkedUpdateBytes') ||
        Object.prototype.hasOwnProperty.call(options.limits, 'maxChunksPerUpdate'))
    ) {
      validateChunkedTransferChain(limits);
    }
    // issue #295（D6 裁决，SA8 R38）：两条聚合上限链②各自独立——仅当调用方**显式表达
    // 对应新键**时对合并结果校验（协议 §17「显式配置…时对应链式校验响亮生效；未表达新键
    // 的存量配置不误判」；#244 家族门与链①原样保留在上方块内）。
    if (options.limits != null && Object.prototype.hasOwnProperty.call(options.limits, 'maxChunkedBootstrapBytes')) {
      validateChunkedBootstrapChain(limits);
    }
    if (options.limits != null && Object.prototype.hasOwnProperty.call(options.limits, 'maxChunkedSyncDiffBytes')) {
      validateChunkedSyncDiffChain(limits);
    }
    this.limits = limits;
    this.timeouts = timeouts;
    this.internals = {
      instanceId: options.instanceId,
      registry: options.registry,
      authorize: options.authorize,
      timer: options.timer,
      limits,
      timeouts,
      observer: options.observer,
      clock: options.clock,
      dropConnection: (connection) => this.dropConnection(connection),
    };
  }

  /** auth-upgrade-rejected 发射（pre-connection：无 connectionId 可挂——攻击点 #8 文档化形态）。 */
  private emitUpgradeRejected(
    reason:
      | 'hub-shutdown'
      | 'missing-token'
      | 'verifier-missing'
      | 'frame-too-large'
      | 'early-frame-limit'
      | 'auth-timeout'
      | 'invalid-credentials'
      | 'invalid-instance-id'
      | 'peer-disconnected',
  ): void {
    if (this.options.observer === undefined) return;
    dispatchReplicationObserver(this.options.observer, {
      type: 'auth-upgrade-rejected',
      side: 'hub',
      reason,
    });
  }

  async accept(transport: DuplexTransport, request?: HubUpgradeRequest): Promise<HubConnection | undefined> {
    // ── 门 0：停止接纳（生命周期门先于认证——已 close 的 hub 对新 upgrade 零工作）──
    if (this.closed) {
      transport.close(1001, 'hub-shutdown');
      this.emitUpgradeRejected('hub-shutdown');
      return undefined;
    }

    // ── 门 1：缺凭据（未传 request / 无 token 字段 / 非字符串 / 空串）→ 拒绝 ──
    const token = request?.token;
    if (typeof token !== 'string' || token.length === 0) {
      transport.close(1008, 'upgrade-unauthorized'); // 静态 reason，零 token/身份回显（AC-7）
      this.emitUpgradeRejected('missing-token');
      return undefined;
    }

    // ── 门 2：无认证器（类型必填 + §2.3 构造期 TypeError 后的纵深防御——JS 调用方绕过类型）
    //    「无认证器 = 全部 upgrade 拒绝」——fail-closed，绝不 fail-open ──
    if (typeof this.options.verifyToken !== 'function') {
      transport.close(1008, 'upgrade-unauthorized');
      this.emitUpgradeRejected('verifier-missing');
      return undefined;
    }

    // ── 门 3（#190 收敛：共享有界早到帧 admission——R2 A2 三检 + R3 N1 句柄纪律原样
    //    内聚于 installEarlyFrameAdmission，两 upgrade 入口同一机制单点）──
    const admission = installEarlyFrameAdmission(
      transport, this.limits, (reason) => this.emitUpgradeRejected(reason),
    );
    // 注册完成后的同步收口段（R3 N1）：同步重放期已拒（或注册期早断）→ 摘真句柄 + 直接拒绝
    // 返回。此刻 auth timer 尚未武装——零清理面；非重放路径两标志恒 false，本检查零开销通过。
    if (admission.isRejected() || admission.isEarlyClosed()) {
      admission.detach();
      return undefined;
    }
    // 认证等待封顶（显式政策，非沉默）：复用 timeouts.helloTimeoutMs——握手预算的既有载体，
    // 零新 knob；超时 = 拒绝分配（1008 静态 reason）。起止：门 3 武装 → 任何出口即清（§8.1 矩阵）。
    const authHandle = this.internals.timer.setTimeout(() => {
      admission.markRejected(); // 超时拒绝标记（迟归不复活）——close/emit 由本路径自理
      admission.detach(); // 此时句柄必为真值（注册已完成）
      if (!transport.closed) transport.close(1008, 'upgrade-timeout');
      this.emitUpgradeRejected('auth-timeout');
    }, this.timeouts.helloTimeoutMs);
    const clearAuthTimer = (): void => { this.internals.timer.clearTimeout(authHandle); };

    // ── 门 4：验证（accept 永不 reject——红灯 #5 零 unhandled rejection 的不变量）──
    let instanceId: unknown;
    try {
      const verdict = await this.options.verifyToken(token);
      clearAuthTimer(); // 首要动作：验证器已归，封顶 timer 必清
      if (admission.isRejected()) return undefined; // 缓冲期已拒（预算/超时）——迟归不复活
      if (verdict === null || typeof verdict !== 'object' || (verdict as { ok?: unknown }).ok !== true) {
        this.emitUpgradeRejected('invalid-credentials');
        return this.rejectUpgrade(transport, admission.detach); // {ok:false} 或畸形裁决
      }
      instanceId = (verdict as { instanceId: unknown }).instanceId;
    } catch {
      clearAuthTimer();
      if (admission.isRejected()) return undefined; // 超时在先、验证器抛错在后——仍 undefined
      this.emitUpgradeRejected('invalid-credentials');
      return this.rejectUpgrade(transport, admission.detach); // 验证器抛错
    }
    // A2-d 单帧超界变体的零宽窗口面（§3.1 竞态消除）：即时验证器（1 tick）下，首帧
    // 投递微任务与验证器续体在同一批次竞争——先让出一次微任务，使排队中的首帧先进入
    // 早到缓冲（超界 → 拒绝 + close(1009) / 条数界 → 拒绝 + close(1008)），
    // 门 5 再按拒绝标志（或 transport.closed）收口零分配——「帧到达同步段即拒、
    // 零分配」在验证器即时归的零宽窗口同样成立。
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    if (admission.isRejected()) return undefined; // 早到缓冲已拒（预算/超界）——验后迟拒的兜底复核
    // instanceId 文法违例（红灯 #4：'Bad-Id!'）→ 视为无效凭据
    if (!isValidInstanceId(instanceId)) {
      this.emitUpgradeRejected('invalid-instance-id');
      return this.rejectUpgrade(transport, admission.detach);
    }

    // ── 门 5：认证期间世界变化（R2 A4：先摘早到监听 → 再检查 → 再构造——顺序唯一基准 §3.3）──
    admission.detach();
    if (this.closed) {
      transport.close(1001, 'hub-shutdown');
      this.emitUpgradeRejected('hub-shutdown');
      return undefined;
    }
    if (admission.isEarlyClosed() || transport.closed) {
      this.emitUpgradeRejected('peer-disconnected'); // 对端已断：零分配、零 close 副作用
      return undefined;
    }

    // ── 分配：认证身份随连接注入；早到帧在构造尾部按序重放（§3.3）──
    // 单体 listen = edge + session 的进程内组合（ADR 0032 决策 1；D7）
    const connection = this.createEdge(transport, instanceId as string, admission.frames);
    this.connectionList.push(connection);
    return connection;
  }

  async acceptTrusted(
    transport: DuplexTransport,
    identity: UpgradeIdentity,
  ): Promise<HubConnection | undefined> {
    if (this.closed) {
      transport.close(1001, 'hub-shutdown');
      this.emitUpgradeRejected('hub-shutdown');
      return undefined;
    }
    if (!isValidInstanceId(identity?.peerInstanceId)) {
      transport.close(1008, 'upgrade-unauthorized');
      this.emitUpgradeRejected('invalid-instance-id');
      return undefined;
    }
    // ── 门 2（#190 修复本体）：共享有界早到帧 admission（与 accept() 门 3 同一机制单点）──
    //    trusted 路径无验证器、无 auth timer（单同步段零 await）——注册到收口零 await，
    //    唯一可达拒绝源是同步重放期帧限拒绝。
    const admission = installEarlyFrameAdmission(
      transport, this.limits, (reason) => this.emitUpgradeRejected(reason),
    );
    // 注册后同步收口段（R3 N1 同款；检查序 = 拒绝原因优先级序——帧限拒绝自身会 close
    // transport（transport.closed === true），isRejected() 必须先于 transport.closed
    // 检查，否则拒绝被误分类为 peer-disconnected 并补发错误事件）：
    if (admission.isRejected()) {
      admission.detach();
      return undefined; // 帧限拒绝已在监听器内完成 close + observer 事件——零分配、零补发事件
    }
    if (this.closed) { // 防御性复查（单同步段内实际不可达）
      admission.detach();
      transport.close(1001, 'hub-shutdown');
      this.emitUpgradeRejected('hub-shutdown');
      return undefined;
    }
    if (admission.isEarlyClosed() || transport.closed) { // 对端已断：零 close 副作用
      admission.detach();
      this.emitUpgradeRejected('peer-disconnected');
      return undefined;
    }
    // 分配（§3.3 唯一顺序基准：先摘早到监听 → 检查 → 构造）
    admission.detach();
    const connection = this.createEdge(transport, identity.peerInstanceId, admission.frames);
    this.connectionList.push(connection);
    return connection;
  }

  private rejectUpgrade(transport: DuplexTransport, detachEarly: () => void): undefined {
    detachEarly(); // 幂等——预算路径已摘时零副作用
    transport.close(1008, 'upgrade-unauthorized');
    return undefined;
  }

  async revoke(instanceIdentity: string, namespaceId: string): Promise<void> {
    const tails: Promise<void>[] = [];
    for (const connection of [...this.connectionList]) { // 拷贝迭代——revoke 途中连接可能收口
      if (connection.authenticatedInstanceId !== instanceIdentity) continue; // 认证身份为权威键
      tails.push(connection.revokeNamespace(namespaceId));
    }
    await Promise.all(tails); // 未知 scope → 空数组 → resolve
  }

  /** issue #175（AC1/AC2/AC3/AC6/AC7）：认证/授权 Adapter 主动 reauth 事件 seam——按认证
   *  实例身份定位连接（绝不以 token 值为键），对每个匹配连接发送
   *  GOAWAY(REAUTH_REQUIRED, drainTimeoutMs>0) 并按 drain/deadline 规则以 WS 1001 收口。
   *  未知实例/已收口连接 → 无副作用 resolve；重复调用幂等。resolve 语义 =「请求已受理」
   *  （GOAWAY 同步冲刷 + deadline 同步武装后即归；等待 drain 结算的是 deadline 回调）。
   *  全路径零 throw（sendControl 的 framing 异常在 beginReauth 内 fail-closed 收口）。 */
  async requestReauth(instanceIdentity: string): Promise<void> {
    if (this.closed) return; // hub 已停机：迟到请求零副作用（AC6）
    for (const connection of [...this.connectionList]) { // 拷贝迭代——同 revoke：发起途中连接可能收口
      if (connection.authenticatedInstanceId !== instanceIdentity) continue; // 认证身份为权威键（AC3/AC7）
      connection.beginReauth(); // 同步发起：GOAWAY 同步冲刷 + deadline 同步武装
    }
  }

  get connections(): readonly HubConnection[] {
    return this.connectionList;
  }

  close(): Promise<void> {
    if (this.closed) return this.closeTail;
    this.closed = true; // 先置位：accept 门 0 即刻生效（§3.2）
    for (const connection of [...this.connectionList]) {
      connection.close(1001, 'hub-shutdown');
    }
    this.closeTail = Promise.all(
      this.connectionList.map((connection) => connection.settle()),
    ).then(() => undefined);
    return this.closeTail;
  }

  /** 单体 listen 的进程内组合（D7）：edge 构造序与现状 `HubConnectionImpl` 构造序逐点对应
   *  （内部状态 → sender/outbound → port → session = sessionFactory(port) → hello timer →
   *  transport 订阅 → 早到帧重放）。 */
  private createEdge(
    transport: DuplexTransport,
    peerInstanceId: string,
    earlyFrames: readonly Uint8Array[],
  ): HubReplicationEdge {
    const internals = this.internals;
    let connection: HubReplicationEdge | undefined;
    connection = createHubReplicationEdge({
      transport,
      timer: internals.timer,
      limits: internals.limits,
      timeouts: internals.timeouts,
      ...(internals.observer !== undefined ? { observer: internals.observer } : {}),
      ...(internals.clock !== undefined ? { clock: internals.clock } : {}),
      instanceId: internals.instanceId,
      peerInstanceId,
      connectionCounter: this.connectionCounter++,
      authorize: internals.authorize,
      earlyFrames,
      sessionFactory: (port) =>
        createHubSessionHost({
          port,
          registry: internals.registry,
          instanceId: internals.instanceId,
          peerInstanceId,
          timer: internals.timer,
          limits: internals.limits,
          timeouts: internals.timeouts,
        }),
      onConnectionDropped: () => {
        if (connection !== undefined) this.dropConnection(connection);
      },
    });
    return connection;
  }

  private dropConnection(connection: HubReplicationEdge): void {
    const index = this.connectionList.indexOf(connection);
    if (index >= 0) this.connectionList.splice(index, 1);
  }
}
