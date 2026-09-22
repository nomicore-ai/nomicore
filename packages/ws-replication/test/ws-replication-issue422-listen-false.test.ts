/**
 * issue #422 运行时验收契约 —— hub 插件免 listen 模式（`listen: false`）与
 * `nomicoreHubSessionHost` 服务（AC1–AC6）。
 *
 * 交付形态：§12.2–§12.7 的冻结断言（SA6 契约逐条形态，`artifacts/sa6-issue422-contract-suite/`
 * 为同源基底）逐字保留；文件末尾**追加** SA2 F1 授权的 limits/timeouts 值域负控块（C5d–C5g：
 * 值域违例 / 两模式 parity / 分块族显式激活窄门双向）。纪律：零 skip/only/todo、零软化断言。
 *
 * 覆盖顺序：AC5 非法 listen 形态（负控，恒绿）→ AC4 listen 模式回归（负控，恒绿）→
 * AC1/AC2/AC3/AC6 免 listen 模式（目标断言）→ F1 值域负控（追加块）。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { Context } from '@deepseek-ai/cordis';
import { describe, expect, it, vi } from 'vitest';
import { provideClock } from '@nomicore/clock';
import { provideInstance } from '@nomicore/instance';
import { provideNomicoreRegistry } from '@nomicore/namespace-registry';
import { decodeMessage, encodeMessage } from '@nomicore/replication-protocol';
import {
  createHubReplicationPlugin,
  requireHubReplication,
  requireHubSessionHost,
  NOMICORE_HUB_SESSION_HOST_SERVICE,
  type ReplicationObserverEvent,
} from '@nomicore/ws-replication';
import {
  HUB_OWNER,
  PEER_INSTANCE,
  makeHubNamespace,
  makeNode,
  settleUntil,
  type ReplicaNode,
} from './harness.js';

const VALID_LISTEN = { host: '127.0.0.1', port: 0 } as const;

function effectTimer(ctx: Context): {
  timeout(callback: () => void, delayMs: number): () => void;
  active: Set<() => void>;
  delays: number[];
  calls: number;
} {
  const active = new Set<() => void>();
  const root = ctx.root;
  const counter = { calls: 0, delays: [] as number[] };
  return {
    active,
    get delays() {
      return counter.delays;
    },
    get calls() {
      return counter.calls;
    },
    timeout(callback, delayMs) {
      counter.calls += 1;
      counter.delays.push(delayMs);
      let dispose!: () => void;
      dispose = root.effect(() => {
        const handle = setTimeout(() => {
          active.delete(dispose);
          callback();
        }, delayMs);
        return () => {
          active.delete(dispose);
          clearTimeout(handle);
        };
      });
      active.add(dispose);
      return dispose;
    },
  };
}

function dependencies(
  ctx: Context,
  node: ReplicaNode,
  timer: ReturnType<typeof effectTimer>,
  registry: unknown = node.registry,
  role: 'hub' | 'peer' = 'hub',
): void {
  provideInstance(ctx, Object.freeze({ instanceId: `${role}-one`, role }));
  provideClock(ctx, { now: () => 1 });
  if (typeof ctx.root.timeout === 'function') ctx.provide('timer', timer as never);
  else ctx.provide('timer', { ...timer, ctx: { root: { ...ctx.root, timeout: timer.timeout } } } as never);
  provideNomicoreRegistry(ctx, registry as never);
}

describe('@422 AC5：非法 listen 形态构造期响亮 TypeError（负控，HEAD 必须绿）', () => {
  const invalid: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['拼写变体键', { lisen: false }],
    ['字符串伪值', { listen: 'false' }],
    ['数字 0', { listen: 0 }],
    ['空串', { listen: '' }],
    ['null', { listen: null }],
    ['undefined', { listen: undefined }],
    ['NaN', { listen: Number.NaN }],
    ['数字 1', { listen: 1 }],
    ['true', { listen: true }],
    ['空数组', { listen: [] }],
    ['空对象', { listen: {} }],
    ['缺 host/port', { listen: { port: 0 } }],
    ['空 host', { listen: { host: '', port: 0 } }],
    ['端口越界', { listen: { host: '127.0.0.1', port: 70_000 } }],
    ['path 非绝对', { listen: { host: '127.0.0.1', port: 0, path: 'nope' } }],
    ['嵌套拼写变体', { listen: { host: '127.0.0.1', port: 0, typo: 1 } }],
  ];

  for (const [label, config] of invalid) {
    it(`拒绝：${label}`, () => {
      expect(() => createHubReplicationPlugin(config as never, {})).toThrow(TypeError);
      try {
        createHubReplicationPlugin(config as never, {});
        throw new Error('unreachable');
      } catch (error) {
        // 响亮拒绝必须来自配置纪律（不是后续 adapter/角色错误）。
        expect(String(error)).toMatch(/hub replication/);
      }
    });
  }

  // NC-3b（敏感性锚）：非法形态在「其余配置全部合法」时仍必须响亮拒绝——把伪值静默降级为
  // 免 listen 的实现（falsy 陷阱）会让本组构造成功 ⇒ 本组红（消息面单独不足以判）。
  for (const [label, config] of invalid) {
    it(`拒绝（其余配置合法）：${label}`, () => {
      expect(() => createHubReplicationPlugin(
        { ...config, tokens: [], authorization: [] } as never,
        { listen: { listen: async () => ({ close: async () => undefined }) } },
      )).toThrow(TypeError);
    });
  }

  it('listen 模式既有要求链逐项不变（缺 adapter / 缺认证 / 缺授权）', () => {
    expect(() => createHubReplicationPlugin({ listen: VALID_LISTEN }, {})).toThrow(/listen adapter is required/);
    expect(() => createHubReplicationPlugin({ listen: VALID_LISTEN }, { listen: { listen: async () => ({ close: async () => undefined }) } })).toThrow(/authentication is required/);
    expect(() => createHubReplicationPlugin(
      { listen: VALID_LISTEN, tokens: [] },
      { listen: { listen: async () => ({ close: async () => undefined }) } },
    )).toThrow(/authorization is required/);
  });
});

describe('@422 AC4：listen 模式服务面/装配逐字节不变（负控，HEAD 必须绿）', () => {
  it('AC2 补充结构门：src/** 与 package.json 零网络面 API（GREEN 基线，须保持）', () => {
    const pattern = /node:(?:net|http|https|tls)\b|(?:from|require\()\s*['"]ws['"]|createServer\s*\(/u;
    const packageRoot = new URL('../', import.meta.url);
    expect(pattern.test(readFileSync(new URL('package.json', packageRoot), 'utf8'))).toBe(false);
    const sources = readdirSync(new URL('src', packageRoot)).filter((name) => name.endsWith('.ts'));
    expect(sources.length).toBeGreaterThan(0);
    for (const name of sources) {
      expect(pattern.test(readFileSync(new URL(`src/${name}`, packageRoot), 'utf8')), name).toBe(false);
    }
  });

  it('listen 模式提供 nomicoreHubReplication、调用 adapter 一次、不提供 SessionHost 服务', async () => {
    const node = await makeNode('hub');
    await makeHubNamespace(node);
    const ctx = new Context();
    const timer = effectTimer(ctx);
    dependencies(ctx, node, timer);
    const listen = vi.fn(async () => ({ port: 1, close: async () => undefined }));
    const plugin = createHubReplicationPlugin(
      { listen: VALID_LISTEN, tokens: [], authorization: [] },
      { listen: { listen } },
    );
    await plugin.apply(ctx);
    expect(listen).toHaveBeenCalledOnce();
    expect(plugin.listener).toBeDefined();
    expect(requireHubReplication(ctx).status).toEqual({ state: 'ready', connections: 0 });
    // 两入口并存属非法形态：listen 模式零 SessionHost 服务（消费方 get 得 undefined）。
    expect(ctx.get(NOMICORE_HUB_SESSION_HOST_SERVICE)).toBeUndefined();
    await ctx.fiber.dispose();
    expect(timer.active.size).toBe(0);
  });
});

describe('@422 AC1/AC2/AC3/AC6：免 listen 模式（目标断言；HEAD 必须红在能力缺口）', () => {
  it('角色校验纪律不变：免 listen 模式仍先于任何装配副作用拒绝 peer 角色', async () => {
    const node = await makeNode('hub');
    const ctx = new Context();
    const timer = effectTimer(ctx);
    dependencies(ctx, node, timer, node.registry, 'peer');
    const listenSpy = vi.fn(async () => ({ close: async () => undefined }));
    const plugin = createHubReplicationPlugin(
      { listen: false },
      { listen: { listen: listenSpy } },
    );
    expect(() => plugin.apply(ctx)).toThrow(/requires instance role "hub"/);
    expect(listenSpy).not.toHaveBeenCalled();
    expect(ctx.get(NOMICORE_HUB_SESSION_HOST_SERVICE)).toBeUndefined();
    await ctx.fiber.dispose();
  });

  it('装配成功 + 服务面 + 零 listener + 零 nomicoreHubReplication + 真会话回合 + 注入面', async () => {
    const node = await makeNode('hub');
    const fixture = await makeHubNamespace(node);
    const openCalls: Array<{ owner: unknown; namespaceId: unknown }> = [];
    const registry = new Proxy(node.registry, {
      get(target, property, receiver) {
        if (property === 'open') {
          return async (...args: unknown[]) => {
            openCalls.push({ owner: args[0], namespaceId: args[1] });
            return await (target.open as (...inner: unknown[]) => Promise<unknown>)(...args);
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? (value as (...inner: unknown[]) => unknown).bind(target) : value;
      },
    });
    const ctx = new Context();
    const timer = effectTimer(ctx);
    dependencies(ctx, node, timer, registry);
    const observerEvents: ReplicationObserverEvent[] = [];
    const listenSpy = vi.fn(async () => ({ close: async () => undefined }));

    const plugin = createHubReplicationPlugin(
      { listen: false, timeouts: { bootstrapTimeoutMs: 1234 } },
      { observer: (event) => observerEvents.push(event), listen: { listen: listenSpy } },
    );
    await plugin.apply(ctx);

    // AC1：服务面（逐成员可用）
    const service = requireHubSessionHost(ctx);
    expect(typeof service.open).toBe('function');
    expect(service.status).toEqual({ state: 'ready', sessions: 0 });

    // AC2：零 listener（adapter 零调用 + 白盒面 undefined）
    expect(listenSpy).not.toHaveBeenCalled();
    expect(plugin.listener).toBeUndefined();
    expect(plugin.replication).toBeUndefined();

    // AC3：不提供 nomicoreHubReplication（消费方得到服务不可用错误）
    expect(ctx.get('nomicoreHubReplication')).toBeUndefined();
    expect(() => requireHubReplication(ctx)).toThrow(/unavailable/);

    // 真会话回合（经服务 open；registry/observer/timer 注入面）
    const frames: Uint8Array[] = [];
    const handle = service.open({
      connectionKey: 'conn-1',
      remoteInstanceId: PEER_INSTANCE,
      namespaceId: fixture.namespaceId,
      authorization: { ok: true, localOwner: HUB_OWNER, permissions: { read: true, submit: true } },
      selectedCapabilities: 0,
    });
    handle.onFrame((frame) => {
      frames.push(frame);
      return 1;
    });
    handle.handleFrame(encodeMessage(
      { kind: 'OPEN_NAMESPACE', namespaceId: fixture.namespaceId, hasLocalReplica: false },
      { sequence: 1 },
    ));
    await settleUntil(
      () => frames.some((frame) => decodeMessage(frame).message.kind === 'OPEN_OK'),
      'OPEN_OK via nomicoreHubSessionHost',
    );
    expect(decodeMessage(frames[0]!).header.sequence).toBe(0); // 出帧占位 0（edge 盖章）
    expect(openCalls).toEqual([{ owner: HUB_OWNER, namespaceId: fixture.namespaceId }]);
    expect(observerEvents.some((event) => event.side === 'hub')).toBe(true);
    expect(timer.calls).toBeGreaterThan(0);
    // 配置 timeouts 注入 session 工厂：bootstrapTimeoutMs 必须原值落到 session 定时器 arm 点上。
    expect(timer.delays).toContain(1234);

    // AC6：stop → 会话收口（通道终态 closed）+ sessions 0 + timer 清零 + stop 后 open 拒绝
    const stopPromise = service.stop();
    expect(service.stop()).toBe(stopPromise);
    await stopPromise;
    await settleUntil(
      () => observerEvents.some(
        (event) => event.type === 'channel-state-changed'
          && event.side === 'hub'
          && event.namespaceId === fixture.namespaceId
          && event.to === 'closed',
      ),
      'session terminal closed',
    );
    expect(service.status).toEqual({ state: 'stopped', sessions: 0 });
    expect(timer.active.size).toBe(0);
    expect(() => service.open({
      connectionKey: 'conn-2',
      remoteInstanceId: PEER_INSTANCE,
      namespaceId: fixture.namespaceId,
      authorization: { ok: true, localOwner: HUB_OWNER, permissions: { read: true, submit: true } },
      selectedCapabilities: 0,
    })).toThrow();

    // 反向 yield teardown：服务撤销、timer 保持 0、零 Listener 残留
    await ctx.fiber.dispose();
    expect(() => requireHubSessionHost(ctx)).toThrow(/unavailable/);
    expect(timer.active.size).toBe(0);
    expect(listenSpy).not.toHaveBeenCalled();

    // 两入口并存属非法形态：listen 模式不提供 SessionHost 服务（消费方得到不可用错误）。
    const listenCtx = new Context();
    const listenTimer = effectTimer(listenCtx);
    dependencies(listenCtx, node, listenTimer);
    const listenPlugin = createHubReplicationPlugin(
      { listen: VALID_LISTEN, tokens: [], authorization: [] },
      { listen: { listen: vi.fn(async () => ({ close: async () => undefined })) } },
    );
    await listenPlugin.apply(listenCtx);
    expect(listenCtx.get(NOMICORE_HUB_SESSION_HOST_SERVICE)).toBeUndefined();
    expect(() => requireHubSessionHost(listenCtx)).toThrow(/unavailable/);
    await listenCtx.fiber.dispose();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA2 F1 授权追加块（C5d–C5g）：免 listen 模式 limits/timeouts **值域**响亮失败。
//
// 上方冻结套件只覆盖键表/形状层；键合法而值畸形（0ms 超时、lowWater ≥ highWater、
// 分块族链违例）时，免 listen 分支必须与 listen 模式在**同一生命周期点**（apply promise
// rejection）、**同一错误家族**（`validate.ts` TypeError）被拒绝——绝不静默 plumb 进会话。
// 追加块为新增 it，复用文件级夹具（effectTimer/dependencies/VALID_LISTEN），不触碰冻结断言。
// ─────────────────────────────────────────────────────────────────────────────
describe('@422 F1：免 listen 模式 limits/timeouts 值域响亮失败（值与 listen 模式同判）', () => {
  it('C5d：timeouts 正整数违例——构造不抛、apply rejection TypeError、零副作用', async () => {
    const node = await makeNode('hub');
    await makeHubNamespace(node);
    const ctx = new Context();
    const timer = effectTimer(ctx);
    dependencies(ctx, node, timer);
    const listenSpy = vi.fn(async () => ({ close: async () => undefined }));

    // 键表层无值域（bootstrapTimeoutMs ∈ TIMEOUT_KEYS）：构造必须成功——「一响一静」的第一层不响。
    const plugin = createHubReplicationPlugin(
      { listen: false, timeouts: { bootstrapTimeoutMs: 0 } },
      { listen: { listen: listenSpy } },
    );
    // 装配期（= listen 模式经 createHubReplication 的同款时机）响亮拒绝。
    const rejection = plugin.apply(ctx);
    await expect(rejection).rejects.toThrow(TypeError);
    await expect(rejection).rejects.toThrow(/bootstrapTimeoutMs/);
    // 零副作用：拒绝点先于 provide/effect ⇒ 零服务、零定时器、adapter 零调用。
    expect(ctx.get(NOMICORE_HUB_SESSION_HOST_SERVICE)).toBeUndefined();
    expect(timer.active.size).toBe(0);
    expect(listenSpy).not.toHaveBeenCalled();
    await ctx.fiber.dispose();
  });

  it('C5e：limits 跨字段违例（lowWater ≥ highWater）——构造不抛、apply rejection TypeError', async () => {
    const node = await makeNode('hub');
    await makeHubNamespace(node);
    const ctx = new Context();
    const timer = effectTimer(ctx);
    dependencies(ctx, node, timer);

    const plugin = createHubReplicationPlugin(
      { listen: false, limits: { lowWater: 2, highWater: 1 } },
      {},
    );
    const rejection = plugin.apply(ctx);
    await expect(rejection).rejects.toThrow(TypeError);
    await expect(rejection).rejects.toThrow(/lowWater/);
    expect(ctx.get(NOMICORE_HUB_SESSION_HOST_SERVICE)).toBeUndefined();
    expect(timer.active.size).toBe(0);
    await ctx.fiber.dispose();
  });

  it('C5f：parity——同一畸形值在 listen 模式同样构造成功 + apply rejection TypeError', async () => {
    const node = await makeNode('hub');
    await makeHubNamespace(node);

    const timeoutCtx = new Context();
    const timeoutTimer = effectTimer(timeoutCtx);
    dependencies(timeoutCtx, node, timeoutTimer);
    const timeoutPlugin = createHubReplicationPlugin(
      { listen: VALID_LISTEN, tokens: [], authorization: [], timeouts: { bootstrapTimeoutMs: 0 } },
      { listen: { listen: vi.fn(async () => ({ close: async () => undefined })) } },
    );
    await expect(timeoutPlugin.apply(timeoutCtx)).rejects.toThrow(TypeError);
    expect(timeoutCtx.get('nomicoreHubReplication')).toBeUndefined();
    await timeoutCtx.fiber.dispose();

    const limitsCtx = new Context();
    const limitsTimer = effectTimer(limitsCtx);
    dependencies(limitsCtx, node, limitsTimer);
    const limitsPlugin = createHubReplicationPlugin(
      { listen: VALID_LISTEN, tokens: [], authorization: [], limits: { lowWater: 2, highWater: 1 } },
      { listen: { listen: vi.fn(async () => ({ close: async () => undefined })) } },
    );
    await expect(limitsPlugin.apply(limitsCtx)).rejects.toThrow(/lowWater/);
    expect(limitsCtx.get('nomicoreHubReplication')).toBeUndefined();
    await limitsCtx.fiber.dispose();
  });

  it('C5g①：分块族显式激活——显式 maxChunksPerUpdate 激活链（4MiB > 4×512KiB=2MiB）', async () => {
    const node = await makeNode('hub');
    await makeHubNamespace(node);
    const ctx = new Context();
    const timer = effectTimer(ctx);
    dependencies(ctx, node, timer);

    const plugin = createHubReplicationPlugin(
      { listen: false, limits: { maxChunksPerUpdate: 4 } },
      {},
    );
    await expect(plugin.apply(ctx)).rejects.toThrow(TypeError);
    expect(ctx.get(NOMICORE_HUB_SESSION_HOST_SERVICE)).toBeUndefined();
    expect(timer.active.size).toBe(0);
    await ctx.fiber.dispose();
  });

  it('C5g②：非链门键不激活（N5/N6 非追溯性）——apply resolve、服务 ready', async () => {
    const node = await makeNode('hub');
    await makeHubNamespace(node);
    const ctx = new Context();
    const timer = effectTimer(ctx);
    dependencies(ctx, node, timer);

    // maxQueuedUpdateBytes 是既有键、非分块族链门键：1MiB ≥ 缺省 maxUpdateBytes(512KiB)，
    // 无条件链自洽 ⇒ 链不得被激活、存量合法配置不得误拒。
    const plugin = createHubReplicationPlugin(
      { listen: false, limits: { maxQueuedUpdateBytes: 1024 * 1024 } },
      {},
    );
    await plugin.apply(ctx);
    expect(requireHubSessionHost(ctx).status).toEqual({ state: 'ready', sessions: 0 });
    expect(timer.active.size).toBe(0);
    await ctx.fiber.dispose();
  });
});
