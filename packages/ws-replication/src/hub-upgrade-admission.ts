/**
 * hub-upgrade-admission —— 两 upgrade 入口（`accept` 门 3 / `acceptTrusted` 门 2）与 edge 公共
 * 工厂（`hub-edge-host.ts`）**共享的有界早到帧 admission 单点**（issue #190；ADR 0032 决策 3）。
 *
 * 本模块是 `hub-connection.ts:44–151` 自包含符号族（`MAX_EARLY_FRAMES` /
 * `EarlyFrameAdmission` / `installEarlyFrameAdmission` / `closeAdmission`）的**逐字搬迁**落点
 * （设计 §7-D1 选项 α）：搬迁使公共工厂与单体组合根共享同一实现（#190「同一机制单点」纪律），
 * 同时 `hub-connection.ts` 模块运行时导出面保持 `['createHubReplication']` 单键
 * （#418 C0c structure.test 模块键面断言零改动保持绿）。
 *
 * **不进 `src/index.ts` / `src/testing.ts`**（零新公共 API）。
 */
import type { DuplexTransport, ResolvedLimits } from './types.js';

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
export const MAX_EARLY_FRAMES = 16;

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
export interface EarlyFrameAdmission {
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

export function installEarlyFrameAdmission(
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
export function closeAdmission(transport: DuplexTransport, code: number, reason: string): void {
  try {
    transport.close(code, reason);
  } catch {
    // transport 契约外形态（close 抛出）：拒绝效果已生效（标志已置、事件仍发）——
    // 残局归 transport 所有者；与 index.ts safeCloseTransport「吞二次异常」同款纪律。
  }
}
