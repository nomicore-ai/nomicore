/**
 * SA6 验收契约 — issue #447（γ-T1）：**异步 FIFO 管道夹具 + 缝词汇/tag 纪律**
 * （PIPE-C1/C2/C3、SEAM-C1/C2；设计 §8.2/§8.8/§12）。
 *
 * 纪律（SA6 §12.0）：断言 = 运行时行为（通道投递序/计数/零投递、缝消息词汇名集、tag 单调唯一、
 * `receipt.sequence === wire [8..12]` 配对）；结构门（PIPE-C3）**只作补充**（#420 先例同款）。
 * 零真实 timer / 零 wall-clock：延迟 = 显式释放步。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boot } from './driver.js';
import { settle, settleUntil } from './harness.js';
import {
  type AsyncSessionSeam,
  makeAsyncReplicationFacade,
  messageNameOf,
  makeSeamChannel,
  pumpUntil,
  wireFramesOfKind,
} from './issue447-async-seam.js';

/** §24.3 缝消息词汇闭集合（AC2 判据；无拒纳/闸门/信用词汇）。 */
const SEAM_VOCABULARY: ReadonlySet<string> = new Set([
  'frame',
  'receipt',
  'close',
  'terminateUnauthorized',
  'settled',
  'connection-fatal',
]);

/** 词汇闭集合校验器（负控可注入集合外消息名 ⇒ 校验红）。 */
function assertVocabulary(names: readonly string[]): void {
  for (const name of names) {
    if (!SEAM_VOCABULARY.has(name)) {
      throw new Error(`缝上出现闭集合外消息名：${name}`);
    }
  }
}

/** wire 原字节 `[8..12]` 大端出站序（#424 `rawSequence` 同款）。 */
function rawSequence(bytes: Uint8Array): number {
  return ((bytes[8]! << 24) | (bytes[9]! << 16) | (bytes[10]! << 8) | bytes[11]!) >>> 0;
}

interface GammaRun {
  readonly run: Awaited<ReturnType<typeof boot>>;
  readonly facade: ReturnType<typeof makeAsyncReplicationFacade>;
  readonly connectionKey: string;
}

async function bootGamma(): Promise<GammaRun> {
  let facade: ReturnType<typeof makeAsyncReplicationFacade> | undefined;
  const run = await boot({
    waitFor: 'none',
    random: () => 0.5,
    createHub: (options) => {
      facade = makeAsyncReplicationFacade(options);
      return facade.replication;
    },
  });
  if (facade === undefined) throw new Error('facade 未被 boot 调用');
  await pumpUntil(facade.host, () => run.namespaceState() === 'live', 'namespace live');
  return { run, facade, connectionKey: [...facade.host.connections.keys()][0]! };
}

describe('issue #447 PIPE — 异步 FIFO 通道夹具（显式释放；零投递；故障注入）', () => {
  it('PIPE-C1：每方向投递序 === 入队序；每条恰一次；计数守恒；两会话零串道；变异 reorderNext ⇒ 红', () => {
    const a = makeSeamChannel<string>();
    const b = makeSeamChannel<string>();
    const enqueued = ['m1', 'm2', 'm3', 'm4', 'm5'];
    for (const message of enqueued) a.enqueue(message);
    for (const message of ['b1', 'b2']) b.enqueue(message);
    // 乱序释放时刻：交替单条释放与整批释放。
    expect(a.release(2)).toBe(2);
    expect(a.release()).toBe(3);
    expect(b.release()).toBe(2);
    expect(a.delivered()).toEqual(enqueued);
    expect(b.delivered()).toEqual(['b1', 'b2']);
    // 计数守恒 + 不重（delivered 长度 = 入队数；pending 归零）。
    expect(a.delivered().length).toBe(enqueued.length);
    expect(a.pending()).toEqual([]);
    expect(new Set(a.delivered()).size, '不重').toBe(enqueued.length);
    // 跨会话零串道。
    expect(a.delivered().some((message) => message.startsWith('b'))).toBe(false);
    expect(b.delivered().some((message) => message.startsWith('m'))).toBe(false);

    // 变异负控：reorderNext ⇒ 下一次 release 交换前两条 ⇒ 投递序 ≠ 入队序（断言必红）。
    const mutated = makeSeamChannel<string>();
    for (const message of ['x1', 'x2', 'x3']) mutated.enqueue(message);
    mutated.reorderNext();
    mutated.release();
    expect(mutated.delivered()).toEqual(['x2', 'x1', 'x3']);
    expect(mutated.delivered()).not.toEqual(['x1', 'x2', 'x3']);
  });

  it('PIPE-C2：不 release ⇒ 零投递（pending 恒增）；release 返回值 = 投递数（确定性）；投递只发生在显式释放同步段（零真实 timer/wall-clock）', async () => {
    const channel = makeSeamChannel<number>();
    for (let index = 1; index <= 4; index += 1) channel.enqueue(index);
    // 排空微任务（零真实时间）：未调用 release ⇒ 零投递。
    await settle();
    expect(channel.delivered()).toEqual([]);
    expect(channel.pending()).toEqual([1, 2, 3, 4]);
    // 释放步数 = 投递数的确定性函数。
    expect(channel.release(1)).toBe(1);
    expect(channel.release(1)).toBe(1);
    expect(channel.delivered()).toEqual([1, 2]);
    expect(channel.pending()).toEqual([3, 4]);
    expect(channel.release()).toBe(2);
    expect(channel.release()).toBe(0);
    // 「延迟参数」有效且非线性：新入队 + 立即释放 ⇒ 即时投递（非恒零）。
    channel.enqueue(5);
    expect(channel.release()).toBe(1);
    expect(channel.delivered()).toEqual([1, 2, 3, 4, 5]);
    // 扣留开关（withhold）⇒ release 零投递（负控：扣留面真实存在）。
    channel.setHeld(true);
    channel.enqueue(6);
    expect(channel.release()).toBe(0);
    expect(channel.pending()).toEqual([6]);
    channel.setHeld(false);
    expect(channel.release()).toBe(1);
  });

  it('PIPE-C2（回合面）：扣留 edge→session ⇒ 投递数为释放步数的函数（扣留期零增加）', async () => {
    const gamma = await bootGamma();
    const { facade, run, connectionKey } = gamma;
    const seam = facade.host.channel(connectionKey, run.nsId);
    const before = seam.edgeToSession.delivered().length;
    facade.host.withholdEdgeToSession(connectionKey, run.nsId);
    await run.writeHub({ n: 77 });
    await pumpUntil(facade.host, () => run.hubFrames('UPDATE').length >= 1, 'hub→peer UPDATE');
    // 扣留期：edge→session 零新投递（延迟真实存在）。
    expect(seam.edgeToSession.delivered().length).toBe(before);
    expect(seam.edgeToSession.pending().length).toBeGreaterThanOrEqual(1);
    facade.host.withholdEdgeToSession(connectionKey, run.nsId, false);
    await pumpUntil(facade.host, () => seam.edgeToSession.pending().length === 0, '释放后投递完成');
    expect(seam.edgeToSession.delivered().length).toBeGreaterThan(before);
  }, 30_000);

  it('PIPE-C3（补充结构门，非替代）：`package.json` 与 `src/**` 对 worker_threads|MessageChannel|MessagePort 命中 0（γ 保持；#420 先例同款）', () => {
    const root = new URL('..', import.meta.url).pathname;
    const files: string[] = [join(root, 'package.json')];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.ts')) files.push(full);
      }
    };
    walk(join(root, 'src'));
    const pattern = /worker_threads|MessageChannel|MessagePort/;
    const hits: string[] = [];
    for (const file of files) {
      if (pattern.test(readFileSync(file, 'utf8'))) hits.push(file);
    }
    expect(hits, `跨线程面命中（${JSON.stringify(hits)}）`).toEqual([]);
  });
});

describe('issue #447 SEAM — 缝词汇闭集合与 tag/回执配对', () => {
  it('SEAM-C1：回合缝日志消息名 ⊆ §24.3 闭集合；lane ∈ {control,data}；负控：集合外消息名（sent/deferred/rejected/credit/gate/paused）⇒ 校验红', async () => {
    const gamma = await bootGamma();
    const { facade } = gamma;
    const log = facade.host.log;
    expect(log.length, '缝日志非空').toBeGreaterThan(0);
    assertVocabulary(log.map((entry) => entry.name));
    // 出站帧（session→edge）必携 lane ∈ {control,data}；入站帧（edge→session `frame{bytes}`）
    // 无 lane 字段（§24.3 词汇表逐字：该方向只承载字节）。
    for (const entry of log) {
      if (entry.name !== 'frame') continue;
      if (entry.direction === 'edge-to-session') {
        expect(entry.lane, '入站帧不携 lane（§24.3）').toBeUndefined();
        continue;
      }
      expect(['control', 'data']).toContain(entry.lane);
    }
    expect(
      log.some((entry) => entry.direction === 'session-to-edge' && entry.name === 'frame'),
      '存在出站帧日志',
    ).toBe(true);
    // 闭集合逐字（AC2：无拒纳/闸门/信用词汇）。
    expect([...SEAM_VOCABULARY].sort()).toEqual([
      'close',
      'connection-fatal',
      'frame',
      'receipt',
      'settled',
      'terminateUnauthorized',
    ]);
    // 负控（可执行）：集合外消息名必须让校验器红。
    for (const word of ['sent', 'deferred', 'rejected', 'credit', 'gate', 'paused']) {
      expect(() => assertVocabulary([word]), `集合外词汇 ${word}`).toThrow(/闭集合外/);
    }
    // 词汇名单点提取器自身的行为（消息名判别 = 结构，而非夹具自记字段）。
    expect(messageNameOf({ tag: 1, sequence: 2 })).toBe('receipt');
    expect(messageNameOf({ tag: 1, bytes: new Uint8Array(), lane: 'control' })).toBe('frame');
    expect(messageNameOf('close')).toBe('close');
    expect(messageNameOf('terminateUnauthorized')).toBe('terminateUnauthorized');
    expect(messageNameOf({ type: 'settled', namespaceId: 'ns' })).toBe('settled');
    expect(messageNameOf({ type: 'connection-fatal', code: 'X' })).toBe('connection-fatal');
  }, 30_000);

  it('SEAM-C2：每出站帧携 tag；tag 句柄域内严格单调唯一；每 tag 恰一条 receipt；receipt.sequence === 该帧 wire [8..12]；全连接严格递增', async () => {
    const gamma = await bootGamma();
    const { facade, run } = gamma;
    const stamps = facade.host.probes.stamps;
    const outbound = facade.host.probes.outbound;
    expect(outbound.length, '出站帧数').toBeGreaterThanOrEqual(2);
    expect(stamps.length, '已盖章帧数').toBe(outbound.length);
    // 每出站帧携 tag（正整数；句柄域内自 1 单调唯一）。
    for (const frame of outbound) {
      expect(Number.isInteger(frame.tag), `tag 整数（${frame.tag}）`).toBe(true);
      expect(frame.tag).toBeGreaterThanOrEqual(1);
    }
    const tags = outbound.map((frame) => frame.tag);
    expect(tags, 'tag 严格递增（自 1）').toEqual(tags.map((_tag, index) => index + 1));
    // 每 tag 恰一条 receipt；sequence = 同 tag 帧的盖章值 = wire `[8..12]`。
    const receipts = facade.host.probes.receipts;
    expect(receipts.length, '每 tag 恰一条回执').toBe(tags.length);
    for (const receipt of receipts) {
      const stamp = stamps.find((entry) => entry.tag === receipt.tag);
      expect(stamp, `tag ${receipt.tag} 盖章记录`).toBeDefined();
      expect(receipt.sequence, `tag ${receipt.tag} 回执序 = 盖章序`).toBe(stamp!.sequence);
      expect(
        wireFramesOfKind(run.wire.hubToPeer, 'frame')
          .map((frame) => frame.sequence)
          .includes(receipt.sequence) ||
          run.wire.hubToPeer.some((bytes) => rawSequence(bytes) === receipt.sequence),
        `wire 存在序 ${receipt.sequence} 的帧`,
      ).toBe(true);
    }
    // 全连接严格递增（每连接自 1、不重不跳）。
    const sequences = stamps.map((stamp) => stamp.sequence);
    for (let index = 1; index < sequences.length; index += 1) {
      expect(sequences[index]!).toBe(sequences[index - 1]! + 1);
    }
  }, 30_000);

  it('SEAM-C2 负控（dropReceipts(1)）：回执配对不再成立（pairing 校验必红）；reorderNext 亦使投递序 ≠ 入队序', async () => {
    // ① 丢失一条回执 ⇒ 配对计数不成立（可执行负控；回合内注入）。
    let facade: ReturnType<typeof makeAsyncReplicationFacade> | undefined;
    const run = await boot({
      waitFor: 'none',
      random: () => 0.5,
      createHub: (options) => {
        facade = makeAsyncReplicationFacade(options);
        return facade.replication;
      },
    });
    if (facade === undefined) throw new Error('facade 未被 boot 调用');
    await settleUntil(() => facade!.host.seams.size === 1, 'γ 会话通道对建立');
    const connectionKey = [...facade.host.connections.keys()][0]!;
    facade.host.dropReceipts(connectionKey, run.nsId, 1);
    await pumpUntil(
      facade.host,
      () =>
        facade!.host.probes.stamps.length >= 2 ||
        run.namespaceState() === 'live',
      '回执丢失后缝面推进',
    );
    const pairingHolds = (
      stamps: readonly { tag: number }[],
      receipts: readonly { tag: number }[],
    ): boolean =>
      stamps.length === receipts.length && stamps.every((stamp) => receipts.some((r) => r.tag === stamp.tag));
    expect(
      pairingHolds(facade.host.probes.stamps, facade.host.probes.receipts),
      `丢回执后「每 tag 恰一条回执」必不成立（stamps=${facade.host.probes.stamps.length} receipts=${facade.host.probes.receipts.length}）`,
    ).toBe(false);

    // ② 乱序注入使投递序 ≠ 入队序（PIPE-C1 的通道级变异在回合夹具上复现）。
    const seam: AsyncSessionSeam = facade.host.channel(connectionKey, run.nsId);
    const deliveredBefore = seam.sessionToEdge.delivered().length;
    facade.host.reorderNext(connectionKey, run.nsId, 'session-to-edge');
    seam.sessionToEdge.enqueue({ type: 'settled', namespaceId: run.nsId });
    seam.sessionToEdge.enqueue({ type: 'connection-fatal', code: 'X' });
    seam.sessionToEdge.release();
    const tail = seam.sessionToEdge.delivered().slice(deliveredBefore);
    expect(tail.map((message) => messageNameOf(message))).toEqual(['connection-fatal', 'settled']);
    expect(tail.map((message) => messageNameOf(message))).not.toEqual(['settled', 'connection-fatal']);
  }, 30_000);
});
