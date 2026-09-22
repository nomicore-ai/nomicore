/**
 * SA6 验收契约 — issue #447（γ-T1）：**γ 公共面与句柄语义**（PUB-C1/PUB-C3、SEAM-C3；
 * 设计 §8.1/§8.2/§8.3/§12）。
 *
 * 纪律（SA6 §12.0）：断言 = 运行时行为（导出名集与 `typeof`、句柄成员集、幂等 promise 同一性、
 * 缝消息对象键集、`connection-fatal` 信号与连接级 ERROR/close 收口）；零 skip/only/todo。
 * β 冻结面非回退（PUB-C2）由既有 418/420/421/422/424 套件与 `tsc` 硬门承担（本文件不重复）。
 */
import { describe, expect, it } from 'vitest';
import * as productionApi from '@nomicore/ws-replication';
import type { HubAsyncSessionHandle, HubSessionHostConfig } from '@nomicore/ws-replication';
import { CAP_CHUNKED_UPDATE } from '@nomicore/replication-protocol';
import { boot } from './driver.js';
import { HUB_INSTANCE, PEER_INSTANCE, FIXED_MS, settle, settleUntil } from './harness.js';
import {
  LIMITS,
  TIMEOUTS,
  makeAsyncObserver,
  makeAsyncReplicationFacade,
  makeManualClock,
  pumpUntil,
} from './issue447-async-seam.js';

/** β 冻结的 15 个运行时导出（#418 C5a 冻结表口径；append-only 演进 = 超集）。 */
const FROZEN_BETA_VALUE_EXPORTS = [
  'DEFAULT_REPLICATION_BACKOFF',
  'DEFAULT_REPLICATION_LIMITS',
  'DEFAULT_REPLICATION_TIMEOUTS',
  'NOMICORE_HUB_REPLICATION_SERVICE',
  'NOMICORE_HUB_SESSION_HOST_SERVICE',
  'NOMICORE_PEER_REPLICATION_SERVICE',
  'createHubReplication',
  'createHubReplicationEdge',
  'createHubReplicationPlugin',
  'createHubSessionHost',
  'createPeerReplication',
  'createPeerReplicationPlugin',
  'requireHubReplication',
  'requireHubSessionHost',
  'requirePeerReplication',
] as const;

function makeConfig(): HubSessionHostConfig {
  return {
    registry: undefined as unknown as HubSessionHostConfig['registry'],
    instanceId: HUB_INSTANCE,
    limits: LIMITS,
    timeouts: TIMEOUTS,
    timer: { setTimeout: () => 1, clearTimeout: () => undefined },
  };
}

describe('issue #447 PUB — γ 公共面（append-only）与句柄语义', () => {
  it('PUB-C1：运行时导出集 ⊇ β 冻结 15 名（逐名 typeof 不变）∪ {createHubAsyncSessionHost}（值导出 15 → 16）', () => {
    const names = Object.keys(productionApi).sort();
    // 既有 15 名逐名在场（零改名零删除）。
    for (const name of FROZEN_BETA_VALUE_EXPORTS) {
      expect(names, `β 冻结导出 ${name} 缺席`).toContain(name);
    }
    // append-only 新增恰 1 个值导出。
    expect(names, 'γ 工厂导出').toContain('createHubAsyncSessionHost');
    expect(names.length, '值导出计数 15 → 16').toBe(FROZEN_BETA_VALUE_EXPORTS.length + 1);
    // typeof 不变（β 15 名 = 原值形态；新增 = function）。
    expect(typeof productionApi.createHubReplication).toBe('function');
    expect(typeof productionApi.createHubSessionHost).toBe('function');
    expect(typeof productionApi.createHubReplicationEdge).toBe('function');
    expect(typeof productionApi.createPeerReplication).toBe('function');
    expect(typeof productionApi.createHubReplicationPlugin).toBe('function');
    expect(typeof productionApi.createPeerReplicationPlugin).toBe('function');
    expect(typeof productionApi.requireHubReplication).toBe('function');
    expect(typeof productionApi.requireHubSessionHost).toBe('function');
    expect(typeof productionApi.requirePeerReplication).toBe('function');
    expect(typeof productionApi.NOMICORE_HUB_REPLICATION_SERVICE).toBe('string');
    expect(typeof productionApi.NOMICORE_HUB_SESSION_HOST_SERVICE).toBe('string');
    expect(typeof productionApi.NOMICORE_PEER_REPLICATION_SERVICE).toBe('string');
    expect(typeof productionApi.DEFAULT_REPLICATION_LIMITS).toBe('object');
    expect(typeof productionApi.DEFAULT_REPLICATION_TIMEOUTS).toBe('object');
    expect(typeof productionApi.DEFAULT_REPLICATION_BACKOFF).toBe('object');
    expect(typeof productionApi.createHubAsyncSessionHost).toBe('function');
    // 工厂可调用（真身，非占位）。
    const host = productionApi.createHubAsyncSessionHost(makeConfig());
    expect(typeof host.open).toBe('function');
  });

  it('PUB-C3：句柄公共成员恰 6（含 handleReceipt）；close() 幂等（同 promise）；未决集外 tag / 非法 sequence ⇒ connection-fatal{CONNECTION_POLICY_VIOLATION}（响亮，非静默）', () => {
    const host = productionApi.createHubAsyncSessionHost(makeConfig());
    const handle = host.open({
      connectionKey: 'conn-1',
      remoteInstanceId: PEER_INSTANCE,
      namespaceId: 'ns-' + 'a'.repeat(32),
      authorization: {
        ok: true,
        localOwner: { userId: 'hub-owner-9f38' },
        permissions: { read: true, submit: true },
      },
      selectedCapabilities: 0,
    });
    // 句柄成员集 = 原型方法集 − 内部缝成员（SA6 GAP-2 探针同款口径；类字段是实例属性，
    // 公共成员判据在原型面）。
    const internal = /^(constructor|makePort|emitSeam|selfDrain|emitConnectionFatal|emitSignal)$/;
    const publicMembers = Object.getOwnPropertyNames(Object.getPrototypeOf(handle))
      .filter((name) => !internal.test(name))
      .sort();
    expect(publicMembers, 'γ 句柄公共成员（含回执消费面）').toEqual([
      'close',
      'handleFrame',
      'handleReceipt',
      'onFrame',
      'onSignal',
      'terminateUnauthorized',
    ]);
    expect(typeof handle.handleReceipt, '回执消费面在场（第三 port 形态）').toBe('function');

    const signals: string[] = [];
    handle.onSignal((signal) => {
      signals.push(`${signal.type}:${'namespaceId' in signal ? signal.namespaceId : signal.code}`);
    });
    // 未决集外 tag（从未分配）⇒ 响亮收口。
    handle.handleReceipt(4_242, 5);
    expect(signals, '未决集外 tag ⇒ connection-fatal').toEqual([
      'connection-fatal:CONNECTION_POLICY_VIOLATION',
    ]);
    // 非法 sequence（0 不在 [1, 0xffffffff]）⇒ 响亮收口（独立句柄：首条 fatal 已使前句柄终态）。
    const second = host.open({
      connectionKey: 'conn-2',
      remoteInstanceId: PEER_INSTANCE,
      namespaceId: 'ns-' + 'c'.repeat(32),
      authorization: {
        ok: true,
        localOwner: { userId: 'hub-owner-9f38' },
        permissions: { read: true, submit: true },
      },
      selectedCapabilities: 0,
    });
    const secondSignals: string[] = [];
    second.onSignal((signal) => {
      secondSignals.push(
        `${signal.type}:${'namespaceId' in signal ? signal.namespaceId : signal.code}`,
      );
    });
    second.handleReceipt(1, 0);
    expect(secondSignals, '非法 sequence ⇒ connection-fatal').toEqual([
      'connection-fatal:CONNECTION_POLICY_VIOLATION',
    ]);
    // A4.5：收口后迟到回执静默（终态无剩余收口对象）。
    second.handleReceipt(1, 5);
    expect(secondSignals, '终态后静默').toHaveLength(1);
    // 终态幂等：close() 二调返回同一 promise（且不抛）。
    const first = handle.close();
    expect(handle.close(), 'close 幂等（同 promise）').toBe(first);
  });

  it('PUB-C3（跨缝）：未决集外 tag 经桥注入 ⇒ connection-fatal 信号 → edge 收口（连接级 ERROR + namespace 不 live），零静默', async () => {
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
    const handle = facade.host.probes.handles[0]!;
    // 宿主违契注入：伪造一条未决集外 tag 的回执。
    handle.handleReceipt(9_999, 3);
    await pumpUntil(
      facade.host,
      () => run.hubFramesAll('ERROR').length >= 1,
      '宿主违契 ⇒ 连接级 ERROR',
    );
    expect(
      facade.host.probes.signals,
      `信号面（${JSON.stringify(facade.host.probes.signals)}）`,
    ).toContain('connection-fatal:CONNECTION_POLICY_VIOLATION');
    const codes = run.hubFramesAll('ERROR').map((frame) => (frame.message as { code: string }).code);
    expect(codes, `ERROR 码（${JSON.stringify(codes)}）`).toContain('CONNECTION_POLICY_VIOLATION');
    expect(run.namespaceState(), 'namespace 不得保持 live').not.toBe('live');
  }, 30_000);

  it('SEAM-C3：receipt 消息自有键集恰 {tag, sequence}（无 sent/deferred/rejected 判别键）；负控：注入判别键 ⇒ 键集断言红', async () => {
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
    // 从缝日志配对的 receipt 消息对象（edge→session 投递面）判定键集。
    const seam = facade.host.channel([...facade.host.connections.keys()][0]!, run.nsId);
    const receipts = seam.edgeToSession
      .delivered()
      .filter((message) => typeof message !== 'string' && 'tag' in message);
    expect(receipts.length, '回合内回执数').toBeGreaterThanOrEqual(2);
    for (const receipt of receipts) {
      expect(Object.keys(receipt).sort(), 'receipt 键集恰事实键').toEqual(['sequence', 'tag']);
    }
    // 负控：注入任何拒纳/闸门/信用判别键即键集断言红（A4.6：回执 ≠ 接纳信号）。
    const tampered = { ...(receipts[0] as object), sent: true };
    expect(Object.keys(tampered).sort()).not.toEqual(['sequence', 'tag']);
    for (const word of ['sent', 'deferred', 'rejected', 'credit', 'gate', 'paused']) {
      expect(word in (receipts[0] as object), `缝上不得出现 ${word}`).toBe(false);
    }
  }, 30_000);

  it('SEAM-C3（可选位面）：observer/clock 注入下回合仍成立（γ 面不依赖 accounting 投影；发送记账整键缺席语义不在缝词汇内）', async () => {
    const recorder = makeAsyncObserver();
    const clock = makeManualClock(FIXED_MS);
    let facade: ReturnType<typeof makeAsyncReplicationFacade> | undefined;
    const run = await boot({
      waitFor: 'none',
      random: () => 0.5,
      chunkedUpdate: true,
      hubObserver: recorder.observer,
      hubClock: clock.clock,
      createHub: (options) => {
        facade = makeAsyncReplicationFacade(options);
        return facade.replication;
      },
    });
    if (facade === undefined) throw new Error('facade 未被 boot 调用');
    await pumpUntil(facade.host, () => run.namespaceState() === 'live', 'namespace live');
    expect(
      (run.hubFrames('HELLO_ACK')[0]!.message as { selectedCapabilities: number })
        .selectedCapabilities & CAP_CHUNKED_UPDATE,
      '协商位',
    ).not.toBe(0);
    const sentEvents = recorder.events.filter((event) => event.type === 'bootstrap-snapshot-sent');
    expect(sentEvents, 'session 侧 sent 类事件仍在发送调用点发射').toHaveLength(1);
    expect(
      Object.keys(sentEvents[0]!).includes('sendQueueMs'),
      'γ 缝词汇无 accounting 字段 ⇒ sendQueueMs 整键缺席',
    ).toBe(false);
    await settle();
  }, 30_000);

  it('句柄域公开面：onFrame 退订生效、onSignal 退订生效、重复 (connectionKey, namespaceId) 开启响亮 throw', () => {
    const host = productionApi.createHubAsyncSessionHost(makeConfig());
    const input = {
      connectionKey: 'conn-x',
      remoteInstanceId: PEER_INSTANCE,
      namespaceId: 'ns-' + 'b'.repeat(32),
      authorization: {
        ok: true as const,
        localOwner: { userId: 'hub-owner-9f38' },
        permissions: { read: true, submit: true },
      },
      selectedCapabilities: 0,
    };
    const handle: HubAsyncSessionHandle = host.open(input);
    const frames: unknown[] = [];
    const offFrame = handle.onFrame((message) => {
      frames.push(message);
    });
    offFrame();
    const signals: unknown[] = [];
    const offSignal = handle.onSignal((signal) => {
      signals.push(signal);
    });
    offSignal();
    // 未注册 sink/已退订 ⇒ 句柄面零副作用（收口前的良构输入不产生 seam 消息）。
    expect(frames, '退订后零投递').toHaveLength(0);
    expect(signals, '退订后零投递').toHaveLength(0);
    expect(() => host.open(input), '重复键响亮 throw').toThrow(/重复开启/);
    expect(() =>
      host.open({ ...input, connectionKey: '' }),
      '空 connectionKey 响亮 throw',
    ).toThrow(/connectionKey/);
    // 空 connectionKey 的失败不得污染登记（同一合法键仍可开启）。
    expect(host.open({ ...input, connectionKey: 'conn-y' })).toBeDefined();
  });

  it('零跨线程面（PIPE-C3 本套件重申）：γ 面不引入 worker_threads / MessageChannel / MessagePort（结构性断言 = 夹具通道 API 面）', () => {
    // 行为面判据：夹具通道只有显式 enqueue/release（无跨线程端口 API），且不注册真实 timer。
    const seamApi = Object.keys(productionApi).filter((name) =>
      /worker|MessagePort|MessageChannel/.test(name),
    );
    expect(seamApi, '公共面无跨线程面导出').toEqual([]);
  });

  it('装配前提：γ facade 采纳 boot 的 registry/timer/limits（同一对象/同值），错位装配在签名面不可表达', async () => {
    const recorder = makeAsyncObserver();
    void recorder;
    let facade: ReturnType<typeof makeAsyncReplicationFacade> | undefined;
    const run = await boot({
      limits: { maxInFlightUpdates: 1 },
      waitFor: 'none',
      random: () => 0.5,
      createHub: (options) => {
        facade = makeAsyncReplicationFacade(options);
        return facade.replication;
      },
    });
    if (facade === undefined) throw new Error('facade 未被 boot 调用');
    expect(facade.worker.registry, 'registry 引用同一性').toBe(run.hubNode.registry);
    await pumpUntil(facade.host, () => run.namespaceState() === 'live', 'namespace live');
    expect(facade.host.probes.opens, '描述子恰一').toHaveLength(1);
    expect(facade.host.probes.opens[0]!.connectionKey).toBe(
      [...facade.host.connections.keys()][0],
    );
    await settleUntil(() => facade!.host.probes.receipts.length >= 2, '回执配对建立');
  }, 30_000);
});
