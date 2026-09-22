/**
 * SA6 验收契约 — issue #424（spec #415 T7）：**授权等价性矩阵**（AC1；契约 §12.1 AUTH-C1~C5）。
 *
 * 核心证据 = 同一授权表 + 同一 `Uint8Array` 脚本下，单体 listen 形态（`createHubReplication`
 * = ADR 0032 决策 1 的进程内组合根）与分片形态（公共 `createHubReplicationEdge` + 公共
 * `createHubSessionHost` × 真 Registry/Runtime，经内存管道接线）的 wire 输出四态一致。
 *
 * ─────────────────── 硬门定义（契约 §12.1「必须写进测试注释」；设计 §7.2 三层确定性断言） ───────────────────
 *
 * 逐字节 = 出站帧 `Uint8Array` → hex **全等且顺序全等**。适用面 = **无 Yjs 载荷的控制帧
 * 枚举白名单**：`HELLO_ACK` / `OPEN_OK` / `ERROR` / `CLOSE_OK` / `GOAWAY`（L1）。
 * 数据帧枚举白名单：`BOOTSTRAP_SNAPSHOT` / `UPDATE` / `UPDATE_CHUNK` / `SYNC_STEP2`（L2）——
 * 判据 = 帧 kind+seq 骨架相等 ∧ `Y.applyUpdate` 后 `ROOT`/`META` 语义相等。
 * 其余全部 kind 落 L3：`kind(code?)#sequence` 逐帧序列相等。
 *
 * **禁止**把数据帧（Yjs 载荷帧）的字节相等写成断言：Yjs `clientID` 由 Yjs 自身随机生成，
 * 与拓扑无关——连单体自身两次独立建文档的全轨迹也不等（SA6 因果实验 1 / AUTH-C5(a)；
 * 协议 §22 L701 三层断言纪律）。观察面（observer 事件集）**不入 parity**（协议 §23.1 已登记
 * 形态差异；把 observer 纳入会制造假红）。
 *
 * 纪律：断言 = 运行时行为（wire 原字节 / `[8..12]` 序 / 会话计数 / 描述子 JSON / 文档语义）；
 * 零源码 grep 断言；零 skip/only/todo；零 env override；stub 只在宿主缝另一侧（authorize 桩、
 * 假 timer）；被测对象恒为真身。
 *
 * SD-3 装配纪律（设计 §7.4）：**每条轨迹场景各自建 worker（SessionHost/Registry）与工厂**，
 * 键空间不交叉（`connectionKey = ${instanceId}-conn-${n}` 为工厂实例计数器）。同 seed 恒产出
 * 同 namespaceId ⟹ 两形态脚本字节完全一致（同源前提）。
 *
 * 契约条目落点：AUTH-C1（pass parity + 重开矩阵）/ AUTH-C2（deny）/ AUTH-C3（throw）/
 * AUTH-C4（闩锁期重 OPEN 拒答 + authorize 恰一次）/ AUTH-C5（负控 a/b/c）/ NC2（pass 重 OPEN
 * → OPEN_OK×2）/ NC4（协商形态 parity + 协商位可见）。
 *
 * 规范引用（设计 §12.1）：协议 §3 L57（envelope 固定头 / 序纪律）、§7.1 L176（OPEN 矩阵与
 * 重开「每个请求都收到 OPEN_OK 或 ERROR」）、§13.1 L415（namespace 域 `INTERNAL_ERROR`
 * 非连接 fatal）、§13.2 L424/L425（`REOPEN_REQUIRES_RECONNECT`→closed / `UNAUTHORIZED`→failed）、
 * §22 L701（conformance 三层确定性断言）、§23.1 L838-845（观测形态差异——observer 面不入
 * parity）、§6.1 L137（`CAP_CHUNKED_UPDATE = 0x00000001`）；ADR 0032 决策 3 + 澄清附录 A2-β
 * （authorize 在 edge 单点、未授权 OPEN 不过缝）。
 */
import { describe, expect, it } from 'vitest';
import { CAP_CHUNKED_UPDATE, decodeMessage } from '@nomicore/replication-protocol';
import {
  LIMITS,
  type Form,
  type Trace,
  closeNsFrame,
  controlFramesOf,
  dataFramesOf,
  decodeAll,
  docStateOf,
  framesHexEqual,
  helloFrame,
  makeShardedWorker,
  openFrame,
  parityOf,
  runMonolithTrace,
  runShardTrace,
  skeletonOf,
} from './issue424-sharded-hub.js';

const SEED = 1000;
const ROOT_N = 42;

/** 语料 namespaceId（同 seed ⟹ 恒定；两形态脚本共用同一字节数组）。 */
async function corpusNamespace(): Promise<string> {
  const probe = await makeShardedWorker(0, { seed: SEED, rootN: ROOT_N });
  return probe.namespaceId;
}

/** 每条分片轨迹：新 worker（新 SessionHost/Registry）+ 新工厂 ⟹ 键空间不交叉（SD-3）。 */
async function shardTrace(form: Form, script: readonly Uint8Array[]): Promise<Trace> {
  const worker = await makeShardedWorker(0, { seed: SEED, rootN: ROOT_N });
  expect(worker.namespaceId).toBe(scriptNamespaceId(script));
  return runShardTrace(form, [worker], script);
}

/** 每条单体轨迹：新 Registry/文档（独立建文档——与分片侧同 seed 同 ns 身份）。 */
async function monoTrace(form: Form, script: readonly Uint8Array[]): Promise<Trace> {
  const mirror = await makeShardedWorker(0, { seed: SEED, rootN: ROOT_N });
  expect(mirror.namespaceId).toBe(scriptNamespaceId(script));
  return runMonolithTrace(form, mirror.registry, script);
}

/** 脚本第 2 帧（OPEN_NAMESPACE）的 namespaceId（同源前提断言用）。 */
function scriptNamespaceId(script: readonly Uint8Array[]): string {
  const open = script.find(
    (bytes) =>
      (decodeMessage(bytes, { maxFrameBytes: LIMITS.maxFrameBytes }).message as { kind: string })
        .kind === 'OPEN_NAMESPACE',
  );
  if (open === undefined) throw new Error('语料脚本缺 OPEN_NAMESPACE');
  return (
    decodeMessage(open, { maxFrameBytes: LIMITS.maxFrameBytes }).message as { namespaceId: string }
  ).namespaceId;
}

function replayScript(namespaceId: string): readonly Uint8Array[] {
  return [helloFrame(1), openFrame(namespaceId, 2), openFrame(namespaceId, 3)];
}

function codesOf(frames: readonly Uint8Array[]): string[] {
  return decodeAll(frames)
    .filter((item) => item.kind === 'ERROR')
    .map((item) => item.code ?? '');
}

function framesOfCode(frames: readonly Uint8Array[], code: string): Uint8Array[] {
  return frames.filter((bytes) => {
    const message = decodeMessage(bytes, { maxFrameBytes: LIMITS.maxFrameBytes }).message as {
      kind: string;
      code?: string;
    };
    return message.kind === 'ERROR' && message.code === code;
  });
}

describe('issue #424 AC1 — 授权等价性矩阵（单体 listen vs 分片形态）', () => {
  it('AUTH-C1 通过形态：控制帧 hex 逐帧相等（HELLO_ACK#1 / OPEN_OK#2 / OPEN_OK#4）、骨架相等、BOOTSTRAP_SNAPSHOT#3 文档语义相等', async () => {
    const script = replayScript(await corpusNamespace());
    const mono = await monoTrace('pass', script);
    const shard = await shardTrace('pass', script);

    const parity = parityOf(mono, shard);
    expect(parity.ok, parity.detail).toBe(true);
    // L1：无 Yjs 载荷的控制帧逐字节 + 顺序全等（含重开矩阵 OPEN_OK×2）。
    expect(framesHexEqual(controlFramesOf(mono.frames), controlFramesOf(shard.frames))).toBeUndefined();
    expect(skeletonOf(controlFramesOf(shard.frames))).toBe('HELLO_ACK#1 OPEN_OK#2 OPEN_OK#4');
    // L2：数据帧骨架 + 文档语义（clientID 不入判据）。
    expect(skeletonOf(dataFramesOf(shard.frames))).toBe('BOOTSTRAP_SNAPSHOT#3');
    expect(docStateOf(dataFramesOf(mono.frames))).toBe(docStateOf(dataFramesOf(shard.frames)));
    // L3：全轨迹骨架。
    expect(skeletonOf(shard.frames)).toBe(skeletonOf(mono.frames));
    // 授权单点：两形态 authorize 各恰一次；分片侧恰一会话、恰一次解析。
    expect(mono.authorizeCalls).toHaveLength(1);
    expect(shard.authorizeCalls).toHaveLength(1);
    expect(shard.opens).toHaveLength(1);
    expect(shard.sessions).toHaveLength(1);
  });

  it('AUTH-C2 拒绝形态（NAMESPACE_UNAUTHORIZED）：全轨迹 hex 逐帧相等；分片侧零会话（未授权 OPEN 不过缝）', async () => {
    const script = replayScript(await corpusNamespace());
    const mono = await monoTrace('deny', script);
    const shard = await shardTrace('deny', script);

    expect(framesHexEqual(mono.frames, shard.frames)).toBeUndefined();
    expect(skeletonOf(shard.frames)).toBe(
      'HELLO_ACK#1 ERROR(NAMESPACE_UNAUTHORIZED)#2 ERROR(NAMESPACE_REOPEN_REQUIRES_RECONNECT)#3',
    );
    expect(codesOf(shard.frames)).toEqual([
      'NAMESPACE_UNAUTHORIZED',
      'NAMESPACE_REOPEN_REQUIRES_RECONNECT',
    ]);
    // ADR 0032 决策 3 / A2-β：denied 不过公共缝——零会话、零 resolveSessionSink 调用。
    expect(shard.sessions).toHaveLength(0);
    expect(shard.opens).toHaveLength(0);
    expect(shard.authorizeCalls).toHaveLength(1);
  });

  it('AUTH-C3 authorizer 抛错（INTERNAL_ERROR）：全轨迹 hex 逐帧相等；分片侧零会话；连接存活（namespace 域错误非连接 fatal）', async () => {
    const script = replayScript(await corpusNamespace());
    const mono = await monoTrace('throw', script);
    const shard = await shardTrace('throw', script);

    expect(framesHexEqual(mono.frames, shard.frames)).toBeUndefined();
    expect(skeletonOf(shard.frames)).toBe(
      'HELLO_ACK#1 ERROR(INTERNAL_ERROR)#2 ERROR(NAMESPACE_REOPEN_REQUIRES_RECONNECT)#3',
    );
    expect(codesOf(shard.frames)).toEqual([
      'INTERNAL_ERROR',
      'NAMESPACE_REOPEN_REQUIRES_RECONNECT',
    ]);
    expect(shard.sessions).toHaveLength(0);
    expect(shard.opens).toHaveLength(0);
    // 协议 §13.1 L415：namespace 域 INTERNAL_ERROR 非连接 fatal。
    expect(shard.state).not.toBe('closed');
    expect(shard.hubClose).toBeUndefined();
  });

  it('AUTH-C4 闩锁期重 OPEN 拒答：恰一帧 NAMESPACE_REOPEN_REQUIRES_RECONNECT 逐字节与单体相等；authorize 不重复（恰一次）', async () => {
    const script = replayScript(await corpusNamespace());
    for (const form of ['deny', 'throw'] as const) {
      const mono = await monoTrace(form, script);
      const shard = await shardTrace(form, script);

      const monoReopen = framesOfCode(mono.frames, 'NAMESPACE_REOPEN_REQUIRES_RECONNECT');
      const shardReopen = framesOfCode(shard.frames, 'NAMESPACE_REOPEN_REQUIRES_RECONNECT');
      expect(shardReopen, `${form}: 闩锁拒答帧数`).toHaveLength(1);
      expect(monoReopen, `${form}: 单体闩锁拒答帧数`).toHaveLength(1);
      expect(framesHexEqual(monoReopen, shardReopen), `${form}: 闩锁拒答字节`).toBeUndefined();
      // ADR 0032 决策 3：authorize 每 (连接, namespace) 仅在首次 OPEN 调用一次，重 OPEN 合流。
      expect(mono.authorizeCalls, `${form}: 单体 authorize 次数`).toHaveLength(1);
      expect(shard.authorizeCalls, `${form}: 分片 authorize 次数`).toHaveLength(1);
    }
  });

  it('AUTH-C5 负控：parity 断言非恒真——(a) 单体 vs 单体（独立文档）全轨迹不等、(b) pass 单体 vs deny 分片控制帧不等、(c) deny 零会话 vs pass 恰一会话', async () => {
    const script = replayScript(await corpusNamespace());

    // (a) 语料因果负控（O7）：全轨迹逐字节「连单体自身」都不成立 ⟹ 硬门必须限定控制帧语料。
    const left = await monoTrace('pass', script);
    const right = await monoTrace('pass', script);
    expect(framesHexEqual(controlFramesOf(left.frames), controlFramesOf(right.frames))).toBeUndefined();
    expect(framesHexEqual(left.frames, right.frames), '单体自身全轨迹逐字节相等').not.toBeUndefined();
    expect(docStateOf(dataFramesOf(left.frames))).toBe(docStateOf(dataFramesOf(right.frames)));

    // (b) 对照语料非同一输出：pass 单体 vs deny 分片控制帧必须不等（非恒真门）。
    const passMono = await monoTrace('pass', script);
    const denyShard = await shardTrace('deny', script);
    expect(
      framesHexEqual(controlFramesOf(passMono.frames), controlFramesOf(denyShard.frames)),
      'pass 单体与 deny 分片控制帧相等（门为恒真）',
    ).not.toBeUndefined();

    // (c) NC3：deny 分片零会话（未授权 OPEN 不过缝）vs pass 分片恰一会话。
    const denyFresh = await shardTrace('deny', script);
    const passFresh = await shardTrace('pass', script);
    expect(denyFresh.sessions).toHaveLength(0);
    expect(passFresh.sessions).toHaveLength(1);
  });

  it('NC2 通过形态 live 后重 OPEN → OPEN_OK×2（非闩锁拒答）；对照 deny 形态恰一帧拒答', async () => {
    const script = replayScript(await corpusNamespace());
    const mono = await monoTrace('pass', script);
    const shard = await shardTrace('pass', script);

    const parity = parityOf(mono, shard);
    expect(parity.ok, parity.detail).toBe(true);
    expect(decodeAll(shard.frames).filter((item) => item.kind === 'OPEN_OK')).toHaveLength(2);
    expect(codesOf(shard.frames)).toEqual([]);

    const denied = await shardTrace('deny', script);
    expect(
      codesOf(denied.frames).filter((code) => code === 'NAMESPACE_REOPEN_REQUIRES_RECONNECT'),
    ).toHaveLength(1);
  });

  it('NC4 协商形态（CAP_CHUNKED_UPDATE）：parity 仍成立；HELLO_ACK.selectedCapabilities 与描述子 selectedCapabilities 均携带协商位', async () => {
    const namespaceId = await corpusNamespace();
    const script = [helloFrame(1, CAP_CHUNKED_UPDATE), openFrame(namespaceId, 2), closeNsFrame(namespaceId, 3)];
    const mono = await monoTrace('pass', script);
    const shard = await shardTrace('pass', script);

    const parity = parityOf(mono, shard);
    expect(parity.ok, parity.detail).toBe(true);

    const helloAckIndex = decodeAll(shard.frames).findIndex((item) => item.kind === 'HELLO_ACK');
    expect(helloAckIndex).toBeGreaterThanOrEqual(0);
    const helloAck = decodeMessage(shard.frames[helloAckIndex]!, {
      maxFrameBytes: LIMITS.maxFrameBytes,
    }).message as { selectedCapabilities: number };
    // 协议 §6.1 L137：CAP_CHUNKED_UPDATE = 0x00000001（required 满足后的交集）。
    expect(helloAck.selectedCapabilities & CAP_CHUNKED_UPDATE).not.toBe(0);

    expect(shard.opens).toHaveLength(1);
    expect(shard.opens[0]!.selectedCapabilities & CAP_CHUNKED_UPDATE).not.toBe(0);
  });
});
