/**
 * hub-split —— hub 侧 Edge / SessionHost 拆分**内部缝契约**（ADR 0032 决策 1/2；设计 §7 D1）。
 *
 * 本模块只承载两半之间的类型与同步不变量，**不导出任何运行时值**（零新公共 API：两工厂
 * 仅在 `hub-edge.ts` / `hub-session.ts` 模块级导出，绝不进 `src/index.ts` / `src/testing.ts`）。
 *
 * 缝纪律（决策 2 + 设计 §7 D1/D5；同步不变量）：
 * - 缝上只过 **namespace 域帧**（已解码消息 + wire 序号）+ **纯 JSON 的 OPEN 准入结局**
 *   （`HubOpenAdmission`）+ 4 个生命周期控制信号（`sink.close` / `sink.terminateNamespace`
 *   / `port.onChannelSettled` / `sink.close()` 的 promise）——连接级帧（HELLO/HELLO_ACK/
 *   GOAWAY/连接级 ERROR）绝不上缝，由 edge 直接出站；
 * - **delivered ⇒ session `channels` 在场（到达点同步）**：`sink.openNamespace(message)` 返回前
 *   通道已写入 `channels`（= HEAD `onOpenNamespace` :880-894 时序；authorize 在途亦然）；
 * - **listen 形态通道只增不减**（`channels` 唯一写入点 = 首个 OPEN 投递）；
 * - **settled 单调且每通道至多一次**（`port.onChannelSettled`）；
 * - **admission 台账 ⟺ 首个 OPEN 已投递（⟺ 通道在场——锁步不变量，C0d 断言）**：edge 在
 *   投递前于**同一同步段**建台账（`beginAdmission` 先于 `sink.openNamespace`）；台账缺失
 *   即不变量破坏 → `port.openAdmission` 响亮 reject（无静默 fallback）；
 * - **每 (连接, namespace) 至多一条 admission 记录 ⟹ 恰一次真实 `authorize`**：edge 是唯一
 *   真实授权调用点，session 的 `authorize` shim 只**拉取**已发起/已结算的结局（结构性不可
 *   触达真实授权器，无法注入/影响/重试授权）。
 */
import type { ReplicationMessage } from '@nomicore/replication-protocol';
import type { DataSenderFacet } from './backpressure.js';
import type { HubNamespaceChannel } from './hub-namespace.js';
import type {
  HubConnectionState,
  NamespaceAuthorization,
  ReplicationObserverEvent,
} from './types.js';

/** 首个 OPEN 的入站形态（OPEN 全解码在 edge 完成——决策 3）。 */
export type OpenNamespaceInbound = Extract<ReplicationMessage, { kind: 'OPEN_NAMESPACE' }>;

/**
 * OPEN 准入结局（edge 真实 authorize 的结算投影；纯 JSON 可过缝，决策 2）。
 *
 * - `authorized`：authorize 返回 ok 且 `permissions.read`；shim 原样回放完整 ok-投影；
 * - `denied`：`{ok:false}` 或 ok 但无 read——edge 结算时单分支折叠
 *   （`hub-namespace.ts:355-359` 的 `!authz.ok || !permissions.read`），shim 一律回放
 *   `{ok:false}`（续体在 `registry.open` 之前短路）；
 * - `throw`：authorize 抛出（同步 throw 与异步拒绝同归；shim reject → `startOpen` catch →
 *   `INTERNAL_ERROR`；错误值被 catch 丢弃，仅「抛出」这一事实上 wire）。
 *
 * 无 `revoked` 结局：revoke 由**在场通道**的 `terminateUnauthorized()` 原生承载（D5.5），
 * authorize 结局按真实值流动（迟归续体由 `isOpenAborted` 静默/D-H1 回收吸收）。
 */
export type HubOpenAdmission =
  | { readonly outcome: 'authorized'; readonly authorization: Extract<NamespaceAuthorization, { ok: true }> }
  | { readonly outcome: 'denied' }
  | { readonly outcome: 'throw' };

/**
 * issue #423（ADR 0032 决策 5/2）：出站 data 帧的 **session 侧发送记账投影**（纯 JSON）。
 *
 * ADR 决策 5 把「依赖盖章后 sequence 的出站事件」（`update-sent`）的发射点划归 edge
 * （盖章事实所有者），而 `sendQueueMs` 是 session 侧记账事实（§23.1：帧实际出队 − 帧内
 * 最旧业务项入队；§23.4：发送方进程内精确）。本投影是两者之间的 append-only 承载面：
 * - 只过**差值**（有限数值），不过绝对时间戳——分片形态下 edge 与 session 是不同时钟
 *   域实例，跨域减法产生垃圾值（§23.3「绝对时间戳不入事件」同源纪律）；
 * - `sendQueueMs` 缺省 = 成员缺席（clock 缺面 / 无 observer / 宿主直驱帧无 session 记账）
 *   ——「缺面 = 字段缺失」纪律，绝不折叠为 0；
 * - 形状与 `UpdateChannelHost.sendUpdateFrame` / `HubChannelHost.sendData` 的同名可选形参
 *   **同形同步维护**（结构化类型兼容，peer 侧少参实现零改动）；本类型为纯类型、不进
 *   `src/index.ts` / `src/testing.ts`（公共面零变化）。
 */
export interface HubSendAccounting {
  readonly sendQueueMs?: number;
}

/** session → edge（进程内组合成员；worker 形态下由后续票重塑，D6 边界注记）。 */
export interface HubSessionEdgePort {
  /**
   * OPEN 准入结局的异步取得（本版新增行为面成员；设计 §7 D5.3）：返回 edge 侧该
   * (连接, namespace) **唯一在途真实 authorize** 的结算投影——promise 至多结算一次、
   * 除台账缺失外**永不 reject**（`throw` 结局以值承载）。
   *
   * 调用时机：仅 `channelHost.authorize` shim 在 `startOpen` 首 await 处调用（通道此时必处
   * `'opening'`）。**台账缺失 ⟹ 不变量破坏**（通道存在 ⟺ 台账存在）→ reject（响亮
   * fail-loud → `startOpen` catch → `INTERNAL_ERROR`，零静默 fallback）。连接已收口后结算
   * 照常传播（D5.6/H1：迟归续体的 lease 回收依赖此）。
   */
  openAdmission(namespaceId: string): Promise<HubOpenAdmission>;
  /** 出站控制帧（session 已以 sequence=0 占位编码）。返回 edge 盖章后的 wire 序；
   *  0 = 未发送/被拒（与既有 `sendControl` 契约同形）。 */
  sendControlFrame(frame: Uint8Array): number;
  /** 出站数据帧（UPDATE / UPDATE_CHUNK，session 已占位编码）。返回盖章后 wire 序；
   *  0 = 准入拒绝。
   *  issue #423（append-only 可选参数）：`accounting` = session 侧发送记账投影（纯 JSON，
   *  见 `HubSendAccounting`）——`update-sent` 的 `sendQueueMs` 唯一来源；宿主直驱帧
   *  不传（整键缺席，缺面 dormant）。既有单参实现/桩类型兼容（少参恒可赋值）。 */
  sendDataFrame(frame: Uint8Array, accounting?: HubSendAccounting): number;
  /** 连接级 data 水位闸门（设计 D3.1 data 闸门前置判据）。 */
  dataGateOpen(): boolean;
  /** data 入队通知（§4.4 wheel 登记 + 连接总压检查）。 */
  onDataQueued(namespaceId: string): void;
  /** 请求连接级 drain（§4.5）。 */
  requestDataDrain(): void;
  /** HELLO 协商位（会话期恒定；issue #243）。 */
  chunkedUpdateNegotiated(): boolean;
  /** ACK_STATE_VIOLATION 等通道→连接收口（默认 close code 1002）。 */
  connectionFatal(code: string, wsCloseCode?: number): void;
  /** 通道进入终态的一次性通知（drain 提前完成观测输入，D5.4）。 */
  onChannelSettled(namespaceId: string): void;
  /** 连接级入站并发 assembly 槽（issue #244；listen 形态归 edge）。 */
  tryBeginInboundAssembly(namespaceId: string): boolean;
  endInboundAssembly(namespaceId: string): void;
  /** observer 是否在场（热路径纪律）。 */
  observerPresent(): boolean;
  /** observer 事件分发（隔离语义仍在 dispatchReplicationObserver 单点，edge 侧执行）。 */
  emitObserver(event: ReplicationObserverEvent): void;
  /** 连接级受控 observability id（握手完成前 undefined）。 */
  connectionId(): string | undefined;
  /** 连接状态投影（D3.1 data 前置判据：'closed' ⟺ HEAD `!isEmitAllowed()`）。 */
  connectionState(): HubConnectionState;
  /** socket 缓冲未冲刷字节（issue #231）。 */
  bufferedAmount(): number | undefined;
  /** 单调时源（clock 缺省/无 observer 时 undefined）。 */
  now?(): number | undefined;
}

/** edge → session（决策 2 的 4 控制信号 × 进程内形态；D6）。 */
export interface HubSessionSink {
  /**
   * OPEN 投递（= HEAD `onOpenNamespace` :880-894：无通道即同步建 + `channels.set` +
   * `startOpen`；有通道即 `onOpen` 重开矩阵）。**到达点无条件调用**（authorize 结局产出
   * 之前）——准入结局不经参数传递，通道内的 `authorize` shim 经 `port.openAdmission` 异步
   * 取得（D5.1/D5.2/D5.3）。`channels` 写入在返回前完成（delivered ⇒ 通道在场）。
   */
  openNamespace(message: OpenNamespaceInbound): void;
  /** 非 OPEN 的 namespace 域帧（已确认该 ns 已投递——台账命中）。sequence = wire 序
   *  （SYNC_STEP1/2、CLOSE_NAMESPACE 记账需要）。 */
  namespaceFrame(message: ReplicationMessage, sequence: number): void;
  /** 'close' 信号：同步前缀（全通道 quiesceConnection）+ 异步尾（全通道
   *  onConnectionClosed 汇流）；幂等。 */
  close(): Promise<void>;
  /** 'terminateUnauthorized' 信号（revoke 链；≈ HEAD `channels.get(nsId)?.terminateUnauthorized()`：
   *  无通道/quiet 态 → 无副作用 resolve）。 */
  terminateNamespace(namespaceId: string): Promise<void>;
  /** listen 形态 drain/wheel/shed 的通道 facet 查询（进程内组合成员；D6 边界注记）。 */
  dataFacetOf(namespaceId: string): DataSenderFacet | undefined;
  /** listen 形态通道表的**只读观测投影**（进程内组合成员；同 `dataFacetOf` 的观测类口径）：
   *  唯一事实源仍是 session 半边的 `channels` Map（listen 形态只增不减），edge 侧持有同一
   *  Map 引用仅用于既有白盒锚（AC4「既有全量测试不改而绿」——
   *  `hub.connections[0].channels.get(nsId)` 只读投影模式）。**非路由判据、非第二事实源**
   *  ——edge 路由与 drain 判定读自身 admission 台账（D4b/D5.4）。 */
  readonly channels: ReadonlyMap<string, HubNamespaceChannel>;
}
